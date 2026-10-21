import type React from 'react';
export type Kind =
  | 'primitive'
  | 'arrangement'
  | 'layout'
  | 'frame'
  | 'furniture'
  | 'theme'
  | 'skin'
  | 'motion'
  | 'example';
export type Demonstration = {
  id: string;
  name: string;
  from: number;
  duration: number;
  line?: number;
  layoutTag?: string;
};
export type Asset = {
  id: string;
  kind: Kind;
  owner: string;
  name: string;
  label: string;
  purpose: string;
  sourcePath: string;
  demoIds: string[];
  demoFrame: number;
  display?: string;
  props?: {
    name: string;
    kind: string;
    required: boolean;
    note?: string;
    fallback?: string;
    values?: string[];
  }[];
  publicProps?: {name: string; required: boolean; type: string}[];
  tunable?: string[];
  slots?: {name: string; kind: string; required: boolean; overflow: string; note?: string}[];
  demonstrations?: Demonstration[];
  skin?: {id: string; radius?: string; cornerMarks?: boolean};
};
export type Suite = {
  name: string;
  role: 'kernel' | 'type';
  guidePath?: string;
  themeIds: string[];
  owned: string[];
  refs: string[];
  composedFrom: string[];
  inherited: Record<string, string>;
  layoutCount: number;
  layoutSceneCount: number;
  sceneFrames: number;
};
export type Manifest = {
  schemaVersion: number;
  library: {kernel: string; typePacks: string[]; initialSuite: string | null};
  buildId: string;
  generatedAt: string;
  sourceDigest: string;
  source: {kind: string; path: string};
  runtime: {project: string; remotion: string};
  warnings: string[];
  notes: string[];
  suites: Suite[];
  assets: Asset[];
  images?: Record<string, string>;
};
export type Library = {
  components?: readonly any[];
  elements: Record<string, React.ComponentType<any>>;
  exports: Record<string, any>;
  ThemeProvider?: React.ComponentType<any>;
  getTheme?: (id: any) => any;
  MasterFrame?: React.ComponentType<any>;
  ShowcaseScenes?: React.ComponentType<any>;
  useShowcaseFurniture?: () => any;
  KitShowcase?: React.ComponentType<any>;
  Stage?: React.ComponentType<any>;
  skins?: any;
  motion?: any;
};
export type Registry = Record<string, Library>;
export type Controls = {
  height: number;
  length: 'short' | 'long';
  arrangement: 'tracks' | 'equal' | 'ratio';
  skin: string;
  radius: boolean;
  title: string;
  start: number;
  duration: number;
  distance: number;
  scroll: number;
  anchor: 'manual' | 'start' | 'middle' | 'end';
  bounds: boolean;
};
export const DEFAULT_CONTROLS: Controls = {
  height: 560,
  length: 'short',
  arrangement: 'tracks',
  skin: 'plain',
  radius: false,
  title: '让空间跟着内容走',
  start: 0,
  duration: 30,
  distance: 28,
  scroll: 0,
  anchor: 'manual',
  bounds: false,
};
export const KIND_LABELS: Record<Kind, string> = {
  primitive: '原语',
  arrangement: '排列',
  layout: '版式',
  frame: '母版',
  furniture: '家具',
  theme: '主题',
  skin: '皮',
  motion: '动效',
  example: '组合演示',
};
export function ownedCategories(manifest: Manifest, owner: string) {
  const assets = manifest.assets.filter((asset) => asset.owner === owner);
  return (Object.keys(KIND_LABELS) as Kind[]).flatMap((kind) => {
    const count = assets.filter((asset) => asset.kind === kind).length;
    return count ? [{kind, label: KIND_LABELS[kind], count}] : [];
  });
}
export function trialWindow(manifest: Manifest, selected: Asset) {
  const ordered = (Object.keys(KIND_LABELS) as Kind[]).flatMap((kind) =>
    manifest.assets.filter((asset) => asset.owner === selected.owner && asset.kind === kind),
  );
  const index = ordered.findIndex((asset) => asset.id === selected.id);
  const from = Math.max(0, Math.min(index, ordered.length - 4));
  return ordered.slice(from, from + 4);
}
