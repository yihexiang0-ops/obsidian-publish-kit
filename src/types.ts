export type PlatformKey = "wechat" | "xiaohongshu" | "zhihu" | "x";

export interface AssetInfo {
  alt: string;
  original: string;
  path: string | null;
  resolved: boolean;
  extension: string;
}

export interface ThreadSegment {
  index: number;
  text: string;
  weightedLength: number;
}

export interface XiaohongshuCard {
  index: number;
  title: string;
  body: string;
}

export interface PlatformOutput {
  key: PlatformKey;
  label: string;
  copyLabel: string;
  primaryText: string;
  html?: string;
  markdown?: string;
  thread?: ThreadSegment[];
  cards?: XiaohongshuCard[];
  checklist: string[];
}

export interface PublishBundle {
  sourceTitle: string;
  sourcePath: string;
  assets: AssetInfo[];
  outputs: PlatformOutput[];
}

