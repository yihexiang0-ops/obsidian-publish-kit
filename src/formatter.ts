export function clampTitle(input: string, maxLength: number): string {
  const trimmed = input.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\n?/m, "")
    .replace(/!\[\[([^\]]+)]]/g, "$1")
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, "$1")
    .replace(/\[\[([^\]|#]+)(?:[|#][^\]]*)?]]/g, "$1")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractSentences(text: string, maxSentences: number): string[] {
  const parts = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0 && text.trim()) {
    return [text.trim()];
  }

  return parts.slice(0, maxSentences);
}

export function buildHashtags(input: string): string[] {
  const tags = new Set<string>();
  const text = input.toLowerCase();

  tags.add("#小红书");
  tags.add("#内容创作");

  if (/[历/史史]|朝代|帝国|王朝|古代/.test(input)) {
    tags.add("#历史");
  }
  if (/职场|沟通|老板|管理/.test(input)) {
    tags.add("#职场");
  }
  if (/写作|排版|发布|markdown/.test(text)) {
    tags.add("#写作");
  }
  if (/观点|认知|成长|思考/.test(input)) {
    tags.add("#认知升级");
  }

  return [...tags].slice(0, 6);
}

export function slugifyFileName(value: string): string {
  const normalized = value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, 80) || "untitled";
}

