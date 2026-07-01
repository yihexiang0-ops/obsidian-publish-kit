import {
  App,
  ButtonComponent,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  TFile,
  normalizePath,
} from "obsidian";
import { buildPublishBundle } from "./formatter";
import { AssetInfo, PlatformKey, PlatformOutput, PublishBundle } from "./types";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"]);

export default class PublishKitPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addRibbonIcon("send", "Format current note for platforms", () => {
      void this.openFormatter();
    });

    this.addCommand({
      id: "format-current-note-for-platforms",
      name: "Format current note for platforms",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) {
          return false;
        }
        if (!checking) {
          void this.openFormatter();
        }
        return true;
      },
    });
  }

  async openFormatter(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    if (!file) {
      new Notice("Open a Markdown note before using Publish Kit.");
      return;
    }

    const markdown = await this.app.vault.cachedRead(file);
    const assets = this.collectAssets(markdown, file);
    const bundle = buildPublishBundle(markdown, file.basename, file.path, assets);
    new PublishKitModal(this.app, this, bundle).open();
  }

  collectAssets(markdown: string, sourceFile: TFile): AssetInfo[] {
    const assets = new Map<string, AssetInfo>();
    const addAsset = (rawTarget: string, alt: string) => {
      const target = cleanImageTarget(rawTarget);
      const resolved = this.resolveVaultFile(target, sourceFile);
      const extension = getExtension(target);
      if (!IMAGE_EXTENSIONS.has(extension)) {
        return;
      }

      const key = target.toLowerCase();
      if (!assets.has(key)) {
        assets.set(key, {
          alt: alt.trim(),
          original: target,
          path: resolved?.path ?? null,
          resolved: Boolean(resolved),
          extension,
        });
      }
    };

    for (const match of markdown.matchAll(/!\[([^\]]*)]\(([^)\n]+)\)/g)) {
      addAsset(match[2], match[1]);
    }

    for (const match of markdown.matchAll(/!\[\[([^\]\n]+)]]/g)) {
      const [target, alias] = match[1].split("|");
      addAsset(target.split("#")[0], alias ?? target);
    }

    return [...assets.values()];
  }

  resolveVaultFile(target: string, sourceFile: TFile): TFile | null {
    const linked = this.app.metadataCache.getFirstLinkpathDest(target, sourceFile.path);
    if (linked instanceof TFile) {
      return linked;
    }

    const sourceFolder = sourceFile.parent?.path ?? "";
    const candidatePath = normalizePath(sourceFolder ? `${sourceFolder}/${target}` : target);
    const candidate = this.app.vault.getAbstractFileByPath(candidatePath);
    return candidate instanceof TFile ? candidate : null;
  }

  async exportBundle(bundle: PublishBundle): Promise<string> {
    const base = normalizePath(`exports/${safePathSegment(bundle.sourceTitle)}`);
    const assetsDir = normalizePath(`${base}/assets`);
    await this.ensureFolder("exports");
    await this.ensureFolder(base);
    await this.ensureFolder(assetsDir);

    for (const output of bundle.outputs) {
      const path = normalizePath(`${base}/${output.key}.${extensionForOutput(output)}`);
      await this.app.vault.adapter.write(path, exportTextForOutput(output));
    }

    await this.app.vault.adapter.write(
      normalizePath(`${base}/asset-checklist.md`),
      renderAssetChecklist(bundle.assets),
    );

    for (const asset of bundle.assets) {
      if (!asset.path) {
        continue;
      }
      const source = this.app.vault.getAbstractFileByPath(asset.path);
      if (!(source instanceof TFile)) {
        continue;
      }
      const binary = await this.app.vault.readBinary(source);
      const targetPath = normalizePath(`${assetsDir}/${source.name}`);
      await this.app.vault.adapter.writeBinary(targetPath, binary);
    }

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
  private activePlatform: PlatformKey = "wechat";

  constructor(
    app: App,
    private readonly plugin: PublishKitPlugin,
    private readonly bundle: PublishBundle,
  ) {
    super(app);
    this.modalEl.addClass("publish-kit-modal");
  }

  onOpen(): void {
    this.render();
  }

  render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const header = contentEl.createDiv({ cls: "publish-kit-header" });
    const titleWrap = header.createDiv();
    titleWrap.createEl("h2", {
      cls: "publish-kit-title",
      text: this.bundle.sourceTitle,
    });
    titleWrap.createDiv({
      cls: "publish-kit-meta",
      text: `${this.bundle.sourcePath} · ${this.bundle.assets.length} image asset(s)`,
    });

    const tabs = contentEl.createDiv({ cls: "publish-kit-tabs" });
    for (const output of this.bundle.outputs) {
      const tab = tabs.createEl("button", {
        cls: `publish-kit-tab${output.key === this.activePlatform ? " is-active" : ""}`,
        text: output.label,
      });
      tab.addEventListener("click", () => {
        this.activePlatform = output.key;
        this.render();
      });
    }

    const output = this.currentOutput();
    const actions = contentEl.createDiv({ cls: "publish-kit-actions" });
    new ButtonComponent(actions)
      .setButtonText(output.copyLabel)
      .setCta()
      .onClick(() => {
        void this.copyOutput(output);
      });
    new ButtonComponent(actions)
      .setButtonText("Export files")
      .onClick(() => {
        void this.exportFiles();
      });

    const grid = contentEl.createDiv({ cls: "publish-kit-grid" });
    const previewPanel = grid.createDiv({ cls: "publish-kit-panel" });
    previewPanel.createEl("h3", { text: "Preview" });
    this.renderPreview(previewPanel.createDiv({ cls: "publish-kit-preview" }), output);

    const sidePanel = grid.createDiv({ cls: "publish-kit-panel" });
    sidePanel.createEl("h3", { text: "Checklist" });
    for (const item of output.checklist) {
      sidePanel.createDiv({ cls: "publish-kit-check-item", text: item });
    }

    sidePanel.createEl("h3", { text: "Images" });
    if (this.bundle.assets.length === 0) {
      sidePanel.createDiv({ cls: "publish-kit-empty", text: "No local images detected." });
    } else {
      for (const asset of this.bundle.assets) {
        sidePanel.createDiv({
          cls: "publish-kit-asset-item",
          text: `${asset.resolved ? "OK" : "Missing"} · ${asset.alt || asset.original} · ${asset.path ?? asset.original}`,
        });
      }
    }
  }

  renderPreview(container: HTMLElement, output: PlatformOutput): void {
    if (output.html) {
      container.createDiv().innerHTML = output.html;
      return;
    }

    if (output.cards) {
      for (const card of output.cards) {
        const item = container.createDiv({ cls: "publish-kit-card-item" });
        item.createEl("strong", { text: `Card ${card.index}: ${card.title}` });
        item.createEl("p", { text: card.body });
      }
      container.createEl("hr");
      container.createEl("pre", {
        cls: "publish-kit-plain",
        text: output.primaryText,
      });
      return;
    }

    if (output.thread) {
      for (const segment of output.thread) {
        const item = container.createDiv({ cls: "publish-kit-thread-item" });
        item.createDiv({
          cls: "publish-kit-thread-count",
          text: `${segment.weightedLength}/280 weighted characters`,
        });
        item.createEl("div", {
          cls: "publish-kit-plain",
          text: segment.text,
        });
      }
      return;
    }

    container.createEl("pre", {
      cls: "publish-kit-plain",
      text: output.primaryText,
    });
  }

  currentOutput(): PlatformOutput {
    return this.bundle.outputs.find((output) => output.key === this.activePlatform) ?? this.bundle.outputs[0];
  }

  async copyOutput(output: PlatformOutput): Promise<void> {
    if (output.html && navigator.clipboard && "write" in navigator.clipboard) {
      try {
        const ClipboardItemCtor = window.ClipboardItem;
        if (ClipboardItemCtor) {
          await navigator.clipboard.write([
            new ClipboardItemCtor({
              "text/html": new Blob([output.html], { type: "text/html" }),
              "text/plain": new Blob([output.primaryText], { type: "text/plain" }),
            }),
          ]);
          new Notice(`Copied ${output.label} HTML.`);
          return;
        }
      } catch {
        // Fall through to plain-text copy below.
      }
    }

    await navigator.clipboard.writeText(output.primaryText);
    new Notice(`Copied ${output.label} draft.`);
  }

  async exportFiles(): Promise<void> {
    const path = await this.plugin.exportBundle(this.bundle);
    new Notice(`Exported Publish Kit files to ${path}.`);
  }
}

function cleanImageTarget(rawTarget: string): string {
  const trimmed = rawTarget.trim().replace(/^<|>$/g, "");
  const withoutTitle = trimmed.match(/^("[^"]+"|'[^']+'|\S+)/)?.[1] ?? trimmed;
  return withoutTitle.replace(/^['"]|['"]$/g, "");
}

function getExtension(path: string): string {
  const clean = path.split("?")[0].split("#")[0];
  const index = clean.lastIndexOf(".");
  return index === -1 ? "" : clean.slice(index + 1).toLowerCase();
}

function safePathSegment(value: string): string {
  const safe = value.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim();
  return safe.slice(0, 80) || "untitled";
}

function extensionForOutput(output: PlatformOutput): "html" | "md" | "txt" {
  if (output.key === "wechat") {
    return "html";
  }
  if (output.key === "x") {
    return "txt";
  }
  return "md";
}

function exportTextForOutput(output: PlatformOutput): string {
  if (output.key === "wechat" && output.html) {
    return output.html;
  }
  if (output.cards) {
    return output.markdown ? `${output.markdown}\n\n## Caption\n\n${output.primaryText}` : output.primaryText;
  }
  return output.primaryText;
}

function renderAssetChecklist(assets: AssetInfo[]): string {
  if (assets.length === 0) {
    return "# Asset Checklist\n\nNo local images detected.\n";
  }

  const rows = assets.map((asset, index) => {
    const status = asset.resolved ? "resolved" : "missing";
    return `- [ ] ${index + 1}. ${asset.alt || asset.original} (${status}) - ${asset.path ?? asset.original}`;
  });

  return `# Asset Checklist\n\n${rows.join("\n")}\n`;
}

