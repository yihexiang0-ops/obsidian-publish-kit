import {
  App,
  CachedMetadata,
  EmbedCache,
  TFile,
  getLinkpath,
  normalizePath,
} from "obsidian";
import {
  DocumentBlock,
  PublishKitSettings,
  RenderIssue,
  ResolvedAsset,
  XhsBundle,
  XhsCard,
} from "./types";
import { buildHashtags, clampTitle, extractSentences, slugifyFileName, stripMarkdown } from "./formatter";

type PosLike = {
  start: { line: number; col: number };
  end: { line: number; col: number };
};

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"]);
const REMOTE_PATTERN = /^https?:\/\//i;

export async function buildXhsBundle(
  app: App,
  file: TFile,
  settings: PublishKitSettings,
): Promise<XhsBundle> {
  const markdown = await app.vault.cachedRead(file);
  const cache = app.metadataCache.getFileCache(file);
  const issues: RenderIssue[] = [];
  const assets = await resolveAssets(app, file, cache, issues);
  const blocks = extractBlocks(markdown, cache, assets);
  const sourceTitle = extractTitle(blocks, file.basename);
  const coverTitle = clampTitle(sourceTitle, settings.maxTitleLength);
  const cards = buildCards(blocks, sourceTitle, settings);
  const plainText = blocks.map((block) => block.text).filter(Boolean).join("\n\n").trim();
  const summary = extractSentences(plainText, 3).join("\n");
  const hashtags = buildHashtags(`${sourceTitle} ${plainText}`);
  const captionParts = [sourceTitle, summary, hashtags.join(" ")].filter(Boolean);

  if (assets.length === 0) {
    issues.push({
      level: "warning",
      message: "未检测到图片资源",
      detail: "当前笔记没有识别出可用于小红书导出的图片。",
    });
  }

  return {
    sourceTitle,
    sourcePath: file.path,
    coverTitle,
    caption: captionParts.join("\n\n").trim(),
    hashtags,
    blocks,
    cards,
    assets,
    issues,
  };
}

export function hydrateMarkdown(markdown: string, assets: ResolvedAsset[]): string {
  let output = markdown;

  for (const asset of assets) {
    const replacement = asset.dataUrl
      ? `![${escapeLabel(asset.alt || asset.exportFileName)}](${asset.dataUrl})`
      : asset.isRemote
        ? `![${escapeLabel(asset.alt || asset.exportFileName)}](${asset.link})`
        : asset.original;
    output = output.split(asset.original).join(replacement);
  }

  return output;
}

export function buildExportManifest(bundle: XhsBundle): string {
  return JSON.stringify(
    {
      sourceTitle: bundle.sourceTitle,
      sourcePath: bundle.sourcePath,
      caption: bundle.caption,
      hashtags: bundle.hashtags,
      cards: bundle.cards.map((card) => ({
        index: card.index,
        kind: card.kind,
        title: card.title,
        exportFileName: card.exportFileName,
        blockIndexes: card.blockIndexes,
      })),
      assets: bundle.assets.map((asset) => ({
        index: asset.index,
        original: asset.original,
        link: asset.link,
        path: asset.path,
        resolved: asset.resolved,
        isRemote: asset.isRemote,
        exportFileName: asset.exportFileName,
        note: asset.note ?? null,
      })),
      issues: bundle.issues,
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

function extractTitle(blocks: DocumentBlock[], fallback: string): string {
  const heading = blocks.find((block) => block.headingLevel === 1 && block.headingText);
  if (heading?.headingText) {
    return heading.headingText;
  }

  const firstNonEmpty = blocks.find((block) => block.text.trim());
  if (!firstNonEmpty) {
    return fallback;
  }

  return clampTitle(firstNonEmpty.text.split(/\n+/)[0], 60) || fallback;
}

async function resolveAssets(
  app: App,
  file: TFile,
  cache: CachedMetadata | null,
  issues: RenderIssue[],
): Promise<ResolvedAsset[]> {
  const embeds = cache?.embeds ?? [];
  const assets: ResolvedAsset[] = [];
  const seen = new Set<string>();

  for (const embed of embeds) {
    if (!embed.original.startsWith("!")) {
      continue;
    }

    const key = `${embed.position.start.line}:${embed.position.start.col}:${embed.original}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const asset = await resolveAsset(app, file, embed, assets.length + 1);
    if (!asset) {
      issues.push({
        level: "warning",
        message: "跳过非图片嵌入",
        detail: embed.original,
      });
      continue;
    }

    if (!asset.resolved && !asset.isRemote) {
      issues.push({
        level: "warning",
        message: "图片未解析成功",
        detail: asset.original,
      });
    }

    if (asset.isRemote) {
      issues.push({
        level: "warning",
        message: "检测到远程图片",
        detail: `${asset.original} 将保留远程地址，不会导出到本地 assets 目录。`,
      });
    }

    assets.push(asset);
  }

  return assets;
}

async function resolveAsset(
  app: App,
  file: TFile,
  embed: EmbedCache,
  index: number,
): Promise<ResolvedAsset | null> {
  const link = embed.link.trim();
  const isRemote = REMOTE_PATTERN.test(link);
  const alt = (embed.displayText ?? "").trim();

  if (isRemote) {
    const extension = extensionFromPath(link);
    if (extension && !IMAGE_EXTENSIONS.has(extension)) {
      return null;
    }

    return {
      index,
      alt,
      original: embed.original,
      link,
      path: null,
      resolved: true,
      isRemote: true,
      extension,
      mimeType: mimeTypeForExtension(extension),
      dataUrl: null,
      exportFileName: `${String(index).padStart(2, "0")}-${slugifyFileName(fileNameFromLink(link) || "remote-image")}.${extension || "png"}`,
      note: "remote-image",
    };
  }

  const linkPath = getLinkpath(link);
  const linked = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
  const resolved =
    linked instanceof TFile
      ? linked
      : resolveRelativeAsset(app, file, linkPath);

  if (!(resolved instanceof TFile) || !IMAGE_EXTENSIONS.has(resolved.extension.toLowerCase())) {
    return {
      index,
      alt,
      original: embed.original,
      link,
      path: resolved instanceof TFile ? resolved.path : null,
      resolved: false,
      isRemote: false,
      extension: resolved instanceof TFile ? resolved.extension.toLowerCase() : extensionFromPath(link),
      mimeType: resolved instanceof TFile ? mimeTypeForExtension(resolved.extension.toLowerCase()) : null,
      dataUrl: null,
      exportFileName: `${String(index).padStart(2, "0")}-${slugifyFileName(fileNameFromLink(link) || "image")}.${extensionFromPath(link) || "png"}`,
      note: "missing-or-not-image",
    };
  }

  const extension = resolved.extension.toLowerCase();
  const mimeType = mimeTypeForExtension(extension);
  const dataUrl = mimeType
    ? arrayBufferToDataUrl(await app.vault.readBinary(resolved), mimeType)
    : null;

  return {
    index,
    alt,
    original: embed.original,
    link,
    path: resolved.path,
    resolved: true,
    isRemote: false,
    extension,
    mimeType,
    dataUrl,
    exportFileName: `${String(index).padStart(2, "0")}-${slugifyFileName(resolved.basename)}.${extension}`,
  };
}

function resolveRelativeAsset(app: App, file: TFile, linkPath: string): TFile | null {
  const sourceFolder = file.parent?.path ?? "";
  const candidatePath = normalizePath(sourceFolder ? `${sourceFolder}/${linkPath}` : linkPath);
  const candidate = app.vault.getAbstractFileByPath(candidatePath);
  return candidate instanceof TFile ? candidate : null;
}

function extractBlocks(
  markdown: string,
  cache: CachedMetadata | null,
  assets: ResolvedAsset[],
): DocumentBlock[] {
  const sections = cache?.sections ?? [];
  const blocks: DocumentBlock[] = [];

  for (const section of sections) {
    if (section.type === "yaml") {
      continue;
    }

    const raw = sliceByPos(markdown, section.position).trim();
    if (!raw) {
      continue;
    }

    const heading = raw.match(/^(#{1,6})\s+(.+)$/m);
    const hydrated = hydrateMarkdown(raw, assets);
    blocks.push({
      index: blocks.length + 1,
      type: section.type,
      markdown: hydrated,
      text: stripMarkdown(raw),
      headingLevel: heading ? heading[1].length : undefined,
      headingText: heading ? heading[2].trim() : undefined,
    });
  }

  return blocks;
}

function buildCards(
  blocks: DocumentBlock[],
  sourceTitle: string,
  settings: PublishKitSettings,
): XhsCard[] {
  const cards: XhsCard[] = [];
  const summaryLines = extractSentences(blocks.map((block) => block.text).join(" "), 2);
  cards.push({
    index: 1,
    kind: "cover",
    title: sourceTitle,
    markdown: summaryLines.join("\n\n").trim(),
    blockIndexes: [],
    exportFileName: "card-01-cover",
  });

  let current: DocumentBlock[] = [];
  let currentCharacters = 0;

  const flush = () => {
    if (current.length === 0) {
      return;
    }

    const firstHeading = current.find((block) => block.headingText)?.headingText;
    const markdown = current.map((block) => block.markdown).join("\n\n");
    cards.push({
      index: cards.length + 1,
      kind: "content",
      title: firstHeading ?? `要点 ${cards.length}`,
      markdown,
      blockIndexes: current.map((block) => block.index),
      exportFileName: `card-${String(cards.length + 1).padStart(2, "0")}`,
    });
    current = [];
    currentCharacters = 0;
  };

  for (const block of blocks) {
    const blockLength = block.text.length;
    const startsNewTopic = Boolean(block.headingLevel && current.length > 0);
    const tooManyBlocks = current.length >= settings.maxBlocksPerCard;
    const tooManyCharacters = currentCharacters + blockLength > settings.maxCardCharacters;

    if (startsNewTopic || tooManyBlocks || tooManyCharacters) {
      flush();
    }

    current.push(block);
    currentCharacters += blockLength;

    if (block.type === "table" || block.type === "code") {
      flush();
    }
  }

  flush();
  return cards;
}

function sliceByPos(markdown: string, position: PosLike): string {
  const offsets = getLineOffsets(markdown);
  const start = offsets[position.start.line] + position.start.col;
  const end = offsets[position.end.line] + position.end.col;
  return markdown.slice(start, end);
}

function getLineOffsets(markdown: string): number[] {
  const offsets = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function extensionFromPath(path: string): string {
  const clean = path.split("?")[0].split("#")[0];
  const index = clean.lastIndexOf(".");
  return index === -1 ? "" : clean.slice(index + 1).toLowerCase();
}

function fileNameFromLink(link: string): string {
  const clean = link.split("?")[0].split("#")[0];
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] ?? clean;
}

function mimeTypeForExtension(extension: string): string | null {
  switch (extension.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    case "avif":
      return "image/avif";
    default:
      return null;
  }
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function escapeLabel(label: string): string {
  return label.replace(/]/g, "\\]");
}

