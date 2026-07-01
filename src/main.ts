import {
  App,
  ButtonComponent,
  Component,
  MarkdownRenderer,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";
import { toJpeg, toPng } from "html-to-image";
import { buildExportManifest, buildXhsBundle } from "./xhs";
import { DEFAULT_SETTINGS, PublishKitSettings, ResolvedAsset, XhsBundle, XhsCard } from "./types";
import { slugifyFileName } from "./formatter";

export default class PublishKitPlugin extends Plugin {
  settings: PublishKitSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon("image-up", "Prepare current note for Xiaohongshu", () => {
      void this.openWorkspace();
    });

    this.addCommand({
      id: "prepare-current-note-for-xiaohongshu",
      name: "Prepare current note for Xiaohongshu",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) {
          return false;
        }
        if (!checking) {
          void this.openWorkspace();
        }
        return true;
      },
    });

    this.addSettingTab(new PublishKitSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async openWorkspace(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    if (!file) {
      new Notice("Open a Markdown note before using Publish Kit.");
      return;
    }

    const bundle = await buildXhsBundle(this.app, file, this.settings);
    new PublishKitModal(this.app, this, file, bundle).open();
  }

  async exportBundle(file: TFile, bundle: XhsBundle): Promise<string> {
    const base = normalizePath(`exports/${slugifyFileName(bundle.sourceTitle)}`);
    const assetsDir = normalizePath(`${base}/assets`);
    const cardsDir = normalizePath(`${base}/cards`);

    await this.ensureFolder("exports");
    await this.ensureFolder(base);
    await this.ensureFolder(assetsDir);
    await this.ensureFolder(cardsDir);

    await this.app.vault.adapter.write(
      normalizePath(`${base}/caption.md`),
      `${bundle.caption}\n`,
    );
    await this.app.vault.adapter.write(
      normalizePath(`${base}/publish.json`),
      buildExportManifest(bundle),
    );

    for (const asset of bundle.assets) {
      if (!asset.resolved || asset.isRemote || !asset.path) {
        continue;
      }
      const source = this.app.vault.getAbstractFileByPath(asset.path);
      if (!(source instanceof TFile)) {
        continue;
      }
      const binary = await this.app.vault.readBinary(source);
      await this.app.vault.adapter.writeBinary(normalizePath(`${assetsDir}/${asset.exportFileName}`), binary);
    }

    await this.app.vault.adapter.write(
      normalizePath(`${base}/assets.md`),
      renderAssetList(bundle.assets),
    );

    return base;
  }

  async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing) {
      return;
    }
    await this.app.vault.createFolder(normalized);
  }
}

class PublishKitModal extends Modal {
  private readonly renderChild = new Component();
  private captionEl!: HTMLTextAreaElement;
  private cardPreviewEl!: HTMLDivElement;
  private cardImageEl!: HTMLDivElement;
  private structureEl!: HTMLDivElement;
  private assetsEl!: HTMLDivElement;
  private issuesEl!: HTMLDivElement;
  private metaEl!: HTMLDivElement;
  private renderedCards = new Map<number, HTMLElement>();
  private isGenerating = false;

  constructor(
    app: App,
    private readonly plugin: PublishKitPlugin,
    private readonly file: TFile,
    private readonly bundle: XhsBundle,
  ) {
    super(app);
    this.modalEl.addClass("publish-kit-modal");
  }

  async onOpen(): Promise<void> {
    this.buildLayout();
    await this.renderCardPreviews();
    await this.generateCardImages();
  }

  onClose(): void {
    this.renderChild.unload();
    this.contentEl.empty();
  }

  private buildLayout(): void {
    const { contentEl } = this;
    contentEl.empty();

    const header = contentEl.createDiv({ cls: "publish-kit-header" });
    const headCopy = header.createDiv();
    headCopy.createEl("h2", {
      cls: "publish-kit-title",
      text: this.bundle.coverTitle,
    });
    this.metaEl = headCopy.createDiv({ cls: "publish-kit-meta" });
    this.metaEl.setText(this.describeBundle());

    const actions = header.createDiv({ cls: "publish-kit-actions publish-kit-actions-inline" });
    new ButtonComponent(actions)
      .setButtonText("Copy caption")
      .setCta()
      .onClick(() => {
        void navigator.clipboard.writeText(this.bundle.caption);
        new Notice("Copied Xiaohongshu caption.");
      });
    new ButtonComponent(actions)
      .setButtonText("Export package")
      .onClick(() => {
        void this.exportPackage();
      });
    new ButtonComponent(actions)
      .setButtonText("Regenerate cards")
      .onClick(() => {
        void this.generateCardImages();
      });

    const grid = contentEl.createDiv({ cls: "publish-kit-grid" });
    const left = grid.createDiv({ cls: "publish-kit-column" });
    const right = grid.createDiv({ cls: "publish-kit-column" });

    const captionPanel = left.createDiv({ cls: "publish-kit-panel" });
    captionPanel.createEl("h3", { text: "Caption" });
    this.captionEl = captionPanel.createEl("textarea", { cls: "publish-kit-caption" });
    this.captionEl.value = this.bundle.caption;

    const cardPanel = left.createDiv({ cls: "publish-kit-panel" });
    cardPanel.createEl("h3", { text: "Card Preview" });
    this.cardPreviewEl = cardPanel.createDiv({ cls: "publish-kit-card-list" });

    const generatedPanel = left.createDiv({ cls: "publish-kit-panel" });
    generatedPanel.createEl("h3", { text: "Generated Card Images" });
    this.cardImageEl = generatedPanel.createDiv({ cls: "publish-kit-card-image-list" });

    const structurePanel = right.createDiv({ cls: "publish-kit-panel" });
    structurePanel.createEl("h3", { text: "Original Structure" });
    this.structureEl = structurePanel.createDiv();
    renderStructure(this.structureEl, this.bundle);

    const assetsPanel = right.createDiv({ cls: "publish-kit-panel" });
    assetsPanel.createEl("h3", { text: "Images" });
    this.assetsEl = assetsPanel.createDiv();
    renderAssets(this.assetsEl, this.bundle.assets);

    const issuesPanel = right.createDiv({ cls: "publish-kit-panel" });
    issuesPanel.createEl("h3", { text: "Issues" });
    this.issuesEl = issuesPanel.createDiv();
    renderIssues(this.issuesEl, this.bundle.issues);
  }

  private describeBundle(): string {
    return `${this.bundle.sourcePath} · ${this.bundle.assets.length} image asset(s) · ${this.bundle.cards.length} cards`;
  }

  private async renderCardPreviews(): Promise<void> {
    this.cardPreviewEl.empty();
    this.renderedCards.clear();

    for (const card of this.bundle.cards) {
      const shell = this.cardPreviewEl.createDiv({ cls: "publish-kit-card-shell" });
      shell.style.width = `${this.plugin.settings.cardWidth}px`;
      shell.createDiv({
        cls: "publish-kit-card-chip",
        text: card.kind === "cover" ? "Cover" : `Card ${card.index}`,
      });
      shell.createEl("h4", {
        cls: "publish-kit-card-title",
        text: card.title,
      });

      if (card.kind === "cover") {
        const summary = shell.createDiv({ cls: "publish-kit-cover-summary" });
        summary.setText(card.markdown || this.bundle.caption);
      } else {
        const body = shell.createDiv({ cls: "publish-kit-card-markdown markdown-rendered" });
        await MarkdownRenderer.render(this.app, card.markdown, body, this.file.path, this.renderChild);
      }

      this.renderedCards.set(card.index, shell);
    }
  }

  private async generateCardImages(): Promise<void> {
    if (this.isGenerating) {
      return;
    }

    this.isGenerating = true;
    this.cardImageEl.empty();
    this.cardImageEl.createDiv({
      cls: "publish-kit-empty",
      text: "Generating card images...",
    });

    try {
      for (const card of this.bundle.cards) {
        const shell = this.renderedCards.get(card.index);
        if (!shell) {
          continue;
        }

        await waitForImages(shell);
        const dataUrl =
          this.plugin.settings.imageFormat === "jpeg"
            ? await toJpeg(shell, {
                cacheBust: true,
                pixelRatio: 2,
                quality: 0.95,
                backgroundColor: "#f7f1e8",
              })
            : await toPng(shell, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: "#f7f1e8",
              });
        card.imageDataUrl = dataUrl;
      }

      this.renderGeneratedImages();
      this.metaEl.setText(this.describeBundle());
    } catch (error) {
      this.cardImageEl.empty();
      this.cardImageEl.createDiv({
        cls: "publish-kit-empty",
        text: `Card rendering failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      new Notice("Publish Kit could not generate card images.");
    } finally {
      this.isGenerating = false;
    }
  }

  private renderGeneratedImages(): void {
    this.cardImageEl.empty();
    const available = this.bundle.cards.filter((card) => card.imageDataUrl);

    if (available.length === 0) {
      this.cardImageEl.createDiv({
        cls: "publish-kit-empty",
        text: "No card images generated yet.",
      });
      return;
    }

    for (const card of available) {
      const item = this.cardImageEl.createDiv({ cls: "publish-kit-card-image-item" });
      item.createDiv({
        cls: "publish-kit-card-image-meta",
        text: `${card.kind === "cover" ? "Cover" : `Card ${card.index}`} · ${card.exportFileName}.${this.plugin.settings.imageFormat}`,
      });
      item.createEl("img", {
        cls: "publish-kit-card-image-preview",
        attr: {
          src: card.imageDataUrl ?? "",
          alt: card.title,
        },
      });
    }
  }

  private async exportPackage(): Promise<void> {
    if (this.bundle.cards.some((card) => !card.imageDataUrl)) {
      await this.generateCardImages();
    }

    const base = await this.plugin.exportBundle(this.file, this.bundle);
    const cardsDir = normalizePath(`${base}/cards`);

    for (const card of this.bundle.cards) {
      if (!card.imageDataUrl) {
        continue;
      }
      const target = normalizePath(`${cardsDir}/${card.exportFileName}.${this.plugin.settings.imageFormat}`);
      await this.app.vault.adapter.writeBinary(target, dataUrlToArrayBuffer(card.imageDataUrl));
    }

    new Notice(`Exported Xiaohongshu package to ${base}.`);
  }
}

class PublishKitSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: PublishKitPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Card width")
      .setDesc("Rendered export width in pixels.")
      .addText((text) =>
        text
          .setPlaceholder("1080")
          .setValue(String(this.plugin.settings.cardWidth))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed >= 720) {
              this.plugin.settings.cardWidth = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Image format")
      .setDesc("Export card images as PNG or JPEG.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("png", "PNG")
          .addOption("jpeg", "JPEG")
          .setValue(this.plugin.settings.imageFormat)
          .onChange(async (value: "png" | "jpeg") => {
            this.plugin.settings.imageFormat = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Cover strategy")
      .setDesc("Choose whether the cover stays text-first or prefers image-heavy notes later.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("title-summary", "Title + summary")
          .addOption("title-image", "Title + image (reserved)")
          .setValue(this.plugin.settings.coverStrategy)
          .onChange(async (value: "title-summary" | "title-image") => {
            this.plugin.settings.coverStrategy = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max blocks per card")
      .setDesc("Start a new card when this block count is reached.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 8, 1)
          .setValue(this.plugin.settings.maxBlocksPerCard)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxBlocksPerCard = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max title length")
      .setDesc("Clamp the generated cover title to this character count.")
      .addSlider((slider) =>
        slider
          .setLimits(18, 48, 1)
          .setValue(this.plugin.settings.maxTitleLength)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxTitleLength = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}

function renderStructure(container: HTMLElement, bundle: XhsBundle): void {
  if (bundle.blocks.length === 0) {
    container.createDiv({ cls: "publish-kit-empty", text: "No markdown blocks detected." });
    return;
  }

  for (const block of bundle.blocks) {
    const item = container.createDiv({ cls: "publish-kit-structure-item" });
    const label = block.headingText
      ? `H${block.headingLevel} · ${block.headingText}`
      : `${block.type} · ${block.text.slice(0, 48)}`;
    item.createDiv({ cls: "publish-kit-structure-label", text: label });
    item.createDiv({
      cls: "publish-kit-structure-snippet",
      text: block.text.slice(0, 120) || block.markdown.slice(0, 120),
    });
  }
}

function renderAssets(container: HTMLElement, assets: ResolvedAsset[]): void {
  if (assets.length === 0) {
    container.createDiv({ cls: "publish-kit-empty", text: "No images detected." });
    return;
  }

  for (const asset of assets) {
    container.createDiv({
      cls: "publish-kit-asset-item",
      text: `${asset.index}. ${asset.resolved ? "OK" : asset.isRemote ? "REMOTE" : "MISSING"} · ${asset.path ?? asset.link}`,
    });
  }
}

function renderIssues(container: HTMLElement, issues: XhsBundle["issues"]): void {
  if (issues.length === 0) {
    container.createDiv({ cls: "publish-kit-empty", text: "No rendering issues detected." });
    return;
  }

  for (const issue of issues) {
    const item = container.createDiv({ cls: "publish-kit-issue-item" });
    item.createDiv({
      cls: `publish-kit-issue-level is-${issue.level}`,
      text: issue.level.toUpperCase(),
    });
    item.createDiv({ text: issue.message });
    if (issue.detail) {
      item.createDiv({
        cls: "publish-kit-issue-detail",
        text: issue.detail,
      });
    }
  }
}

function renderAssetList(assets: ResolvedAsset[]): string {
  if (assets.length === 0) {
    return "# Assets\n\nNo images detected.\n";
  }

  const rows = assets.map((asset) => {
    const status = asset.resolved ? "resolved" : asset.isRemote ? "remote" : "missing";
    const path = asset.path ?? asset.link;
    return `- [ ] ${asset.index}. ${asset.exportFileName} (${status}) - ${path}`;
  });
  return `# Assets\n\n${rows.join("\n")}\n`;
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const [, base64 = ""] = dataUrl.split(",", 2);
  const buffer = Buffer.from(base64, "base64");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
