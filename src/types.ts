export interface PublishKitSettings {
  cardWidth: number;
  imageFormat: "png" | "jpeg";
  coverStrategy: "title-summary" | "title-image";
  maxBlocksPerCard: number;
  maxCardCharacters: number;
  maxTitleLength: number;
}

export const DEFAULT_SETTINGS: PublishKitSettings = {
  cardWidth: 1080,
  imageFormat: "png",
  coverStrategy: "title-summary",
  maxBlocksPerCard: 4,
  maxCardCharacters: 680,
  maxTitleLength: 34,
};

export interface DocumentBlock {
  index: number;
  type: string;
  markdown: string;
  text: string;
  headingLevel?: number;
  headingText?: string;
}

export interface ResolvedAsset {
  index: number;
  alt: string;
  original: string;
  link: string;
  path: string | null;
  resolved: boolean;
  isRemote: boolean;
  extension: string;
  mimeType: string | null;
  dataUrl: string | null;
  exportFileName: string;
  note?: string;
}

export interface RenderIssue {
  level: "warning" | "error";
  message: string;
  detail?: string;
}

export interface XhsCard {
  index: number;
  kind: "cover" | "content";
  title: string;
  markdown: string;
  blockIndexes: number[];
  exportFileName: string;
  imageDataUrl?: string;
}

export interface XhsBundle {
  sourceTitle: string;
  sourcePath: string;
  coverTitle: string;
  caption: string;
  hashtags: string[];
  blocks: DocumentBlock[];
  cards: XhsCard[];
  assets: ResolvedAsset[];
  issues: RenderIssue[];
}

