import {
  AssetInfo,
  PlatformOutput,
  PublishBundle,
  ThreadSegment,
  XiaohongshuCard,
} from "./types";

const URL_PATTERN = /https?:\/\/[^\s)]+/g;
const MEDIA_PLACEHOLDER_PATTERN = /\[image:[^\]]+\]/gi;

export function buildPublishBundle(
  markdown: string,
  sourceTitle: string,
  sourcePath: string,
  assets: AssetInfo[],
): PublishBundle {
  const cleanMarkdown = stripFrontmatter(markdown);
  const title = extractTitle(cleanMarkdown, sourceTitle);
  const plainText = markdownToPlainText(cleanMarkdown, assets);
  const zhihuMarkdown = toZhihuMarkdown(cleanMarkdown, assets);
  const wechatHtml = toWechatHtml(cleanMarkdown, assets);
  const xiaohongshu = toXiaohongshu(title, plainText, assets);
  const xThread = splitXThread(plainText);

  const outputs: PlatformOutput[] = [
    {
      key: "wechat",
      label: "WeChat",
      copyLabel: "Copy HTML",
      primaryText: wechatHtml,
      html: wechatHtml,
      checklist: [
        "Paste into the WeChat editor and verify spacing.",
        "Upload or paste each local image manually.",
        "Set cover image and preview title before publishing.",
        "Confirm links and code blocks after paste.",
      ],
    },
    {
      key: "xiaohongshu",
      label: "Xiaohongshu",
      copyLabel: "Copy Caption",
      primaryText: xiaohongshu.caption,
      markdown: xiaohongshu.markdown,
      cards: xiaohongshu.cards,
      checklist: [
        "Use the first card as the cover card.",
        "Keep image cards near a 3:4 vertical layout.",
        "Upload local images in the order shown below.",
        "Review hashtags and remove any that feel forced.",
      ],
    },
    {
      key: "zhihu",
      label: "Zhihu",
      copyLabel: "Copy Markdown",
      primaryText: zhihuMarkdown,
      markdown: zhihuMarkdown,
      checklist: [
        "Paste into Zhihu and confirm headings and code blocks.",
        "Upload or paste local images manually.",
        "Check table rendering after paste.",
        "Preview before publishing because Zhihu editor behavior can vary.",
      ],
    },
    {
      key: "x",
      label: "X",
      copyLabel: "Copy Thread",
      primaryText: xThread.map((segment) => segment.text).join("\n\n"),
      thread: xThread,
      checklist: [
        "Paste each thread segment in order.",
        "Attach images manually where the note references them.",
        "Re-check URL previews after posting draft text.",
        "Keep sensitive private-note context out of public posts.",
      ],
    },
  ];

  return {
    sourceTitle: title,
    sourcePath,
    assets,
    outputs,
  };
}

export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) {
    return markdown;
  }

  const closing = markdown.indexOf("\n---", 3);
  if (closing === -1) {
    return markdown;
  }

  return markdown.slice(closing + 4).trimStart();
}

export function extractTitle(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m);
  if (!heading) {
    return fallback;
  }

  return stripInlineMarkdown(heading[1]).trim() || fallback;
}

export function markdownToPlainText(markdown: string, assets: AssetInfo[]): string {
  let text = replaceImageReferences(markdown, assets, (asset) => `[image:${asset.alt || asset.original}]`);
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "- ");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```[a-zA-Z0-9_-]*\n?/g, "").replace(/```/g, ""),
  );
  text = stripInlineMarkdown(text);
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export function toZhihuMarkdown(markdown: string, assets: AssetInfo[]): string {
  const transformed = replaceImageReferences(markdown, assets, (asset) => {
    const label = asset.alt || asset.original;
    const target = asset.path ?? asset.original;
    return `![${label}](${target})`;
  });

  return transformed.replace(/\n{3,}/g, "\n\n").trim();
}

export function toWechatHtml(markdown: string, assets: AssetInfo[]): string {
  const lines = replaceImageReferences(markdown, assets, (asset) => {
    const label = asset.alt || asset.original;
    return `\n\n[image:${label}]\n\n`;
  }).split(/\r?\n/);

  const html: string[] = [
    '<section style="font-size:16px;line-height:1.8;color:#202124;letter-spacing:0;background:#ffffff;">',
  ];
  let paragraph: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    html.push(
      `<p style="margin:0 0 16px;">${inlineMarkdownToHtml(paragraph.join(" "))}</p>`,
    );
    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (code === null) {
        flushParagraph();
        code = [];
      } else {
        html.push(
          `<pre style="margin:0 0 16px;padding:12px;border-radius:6px;background:#f6f8fa;overflow:auto;"><code>${escapeHtml(code.join("\n"))}</code></pre>`,
        );
        code = null;
      }
      continue;
    }

    if (code !== null) {
      code.push(line);
      continue;
    }

    if (trimmed.length === 0) {
      flushParagraph();
      continue;
    }

    const image = trimmed.match(/^\[image:(.+)]$/i);
    if (image) {
      flushParagraph();
      html.push(
        `<section style="margin:18px 0;padding:12px;border:1px dashed #9aa0a6;border-radius:6px;color:#5f6368;text-align:center;">Local image: ${escapeHtml(image[1])}</section>`,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const size = level === 1 ? 24 : level === 2 ? 20 : 18;
      html.push(
        `<h${Math.min(level, 3)} style="margin:28px 0 12px;font-size:${size}px;line-height:1.35;color:#123c35;font-weight:700;">${inlineMarkdownToHtml(heading[2])}</h${Math.min(level, 3)}>`,
      );
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      html.push(
        `<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:4px solid #237a6f;background:#f4faf8;color:#3c4043;">${inlineMarkdownToHtml(trimmed.replace(/^>\s?/, ""))}</blockquote>`,
      );
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      html.push(
        `<p style="margin:0 0 10px;padding-left:10px;">• ${inlineMarkdownToHtml(trimmed.replace(/^[-*+]\s+|^\d+\.\s+/, ""))}</p>`,
      );
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  html.push("</section>");
  return html.join("\n");
}

export function toXiaohongshu(
  title: string,
  plainText: string,
  assets: AssetInfo[],
): { caption: string; markdown: string; cards: XiaohongshuCard[] } {
  const chunks = splitByLength(plainText.replace(MEDIA_PLACEHOLDER_PATTERN, ""), 150);
  const cards: XiaohongshuCard[] = [
    {
      index: 1,
      title,
      body: "封面卡：保留一个明确结论，控制在 2-3 行。",
    },
    ...chunks.slice(0, 8).map((chunk, index) => ({
      index: index + 2,
      title: index === 0 ? "核心观点" : `要点 ${index + 1}`,
      body: chunk,
    })),
  ];

  const tags = suggestHashtags(title, plainText);
  const imageLine =
    assets.length > 0
      ? `\n\n图片顺序：${assets.map((asset, index) => `${index + 1}. ${asset.alt || asset.original}`).join("；")}`
      : "";
  const caption = `${title}\n\n${plainText.slice(0, 700).trim()}${imageLine}\n\n${tags.join(" ")}`.trim();
  const markdown = cards
    .map((card) => `## Card ${card.index}: ${card.title}\n\n${card.body}`)
    .join("\n\n");

  return { caption, markdown, cards };
}

export function splitXThread(text: string, maxWeightedLength = 280): ThreadSegment[] {
  const clean = text
    .replace(MEDIA_PLACEHOLDER_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const paragraphs = clean.split(/\n{2,}/).flatMap((paragraph) => splitBySentence(paragraph));
  const segments: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (weightedXLength(candidate) <= maxWeightedLength) {
      current = candidate;
      continue;
    }

    if (current) {
      segments.push(current);
      current = "";
    }

    if (weightedXLength(paragraph) <= maxWeightedLength) {
      current = paragraph;
      continue;
    }

    segments.push(...splitLongText(paragraph, maxWeightedLength));
  }

  if (current) {
    segments.push(current);
  }

  return segments.map((segment, index) => ({
    index: index + 1,
    text: `${index + 1}/${segments.length} ${segment}`.trim(),
    weightedLength: weightedXLength(`${index + 1}/${segments.length} ${segment}`),
  }));
}

export function weightedXLength(text: string): number {
  let length = 0;
  let cursor = 0;
  const matches = [...text.matchAll(URL_PATTERN)];

  for (const match of matches) {
    const index = match.index ?? 0;
    length += weightedNonUrlLength(text.slice(cursor, index));
    length += 23;
    cursor = index + match[0].length;
  }

  length += weightedNonUrlLength(text.slice(cursor));
  return length;
}

function weightedNonUrlLength(text: string): number {
  let length = 0;
  for (const char of Array.from(text)) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (/\s/.test(char)) {
      length += 1;
    } else if (codePoint > 0x2e80 || codePoint > 0xffff) {
      length += 2;
    } else {
      length += 1;
    }
  }
  return length;
}

function replaceImageReferences(
  markdown: string,
  assets: AssetInfo[],
  replacement: (asset: AssetInfo) => string,
): string {
  let output = markdown;

  for (const asset of assets) {
    const escapedOriginal = escapeRegExp(asset.original);
    output = output.replace(
      new RegExp(`!\\[[^\\]]*]\\(${escapedOriginal.replace(/\\ /g, "\\s+")}\\)`, "g"),
      replacement(asset),
    );
    output = output.replace(
      new RegExp(`!\\[\\[${escapedOriginal}(?:[#|][^\\]]*)?\\]\\]`, "g"),
      replacement(asset),
    );
  }

  return output;
}

function inlineMarkdownToHtml(markdown: string): string {
  let html = escapeHtml(markdown);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f3f4;padding:1px 4px;border-radius:4px;">$1</code>');
  html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2" style="color:#237a6f;text-decoration:none;">$1</a>');
  return html;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?]]/g, "$1")
    .replace(/\[\[([^\]|#]+)(?:[|#][^\]]*)?]]/g, "$1")
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function splitBySentence(text: string): string[] {
  const parts = text
    .split(/(?<=[。！？!?\.])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function splitLongText(text: string, maxWeightedLength: number): string[] {
  const words = Array.from(text);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current + word;
    if (weightedXLength(candidate) <= maxWeightedLength) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current);
      }
      current = word;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function splitByLength(text: string, maxCharacters: number): string[] {
  const result: string[] = [];
  let current = "";

  for (const char of Array.from(text.replace(/\n{2,}/g, "\n"))) {
    if (current.length >= maxCharacters && /[。！？!?，,；;\n]/.test(char)) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

function suggestHashtags(title: string, plainText: string): string[] {
  const tags = new Set(["#读书笔记", "#知识分享"]);
  const combined = `${title} ${plainText}`;

  if (/AI|人工智能|模型|ChatGPT|Claude/i.test(combined)) {
    tags.add("#AI工具");
  }
  if (/写作|内容|自媒体|公众号|小红书/.test(combined)) {
    tags.add("#内容创作");
  }
  if (/效率|工具|工作流|workflow/i.test(combined)) {
    tags.add("#效率工具");
  }

  return [...tags].slice(0, 5);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

