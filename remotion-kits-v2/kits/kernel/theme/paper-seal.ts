/**
 * 主题 `paper-seal` —— 宣纸 + 朱砂 + 楷书。
 *
 * 用来证明主题层是真的：它与 `default-dark` 的差异不是「换个颜色」，而是
 * **色板（浅底墨字）× 字族（楷体 / 仿宋）× 字阶（更扁）× 留白（更宽）
 * × 图形语言（方角、粗朱砂条、细分隔线）** 五个维度同时不同。
 *
 * 版式与家具**没有为本主题改过一行**。这就是主题层存在的理由。
 */

import type {Theme} from './types';

export const paperSeal: Theme = {
  name: 'paper-seal',

  color: {
    bg: '#F2E8D6', // 宣纸
    ink: '#231F19', // 墨
    muted: '#7A6C55',
    accent: '#B4342A', // 朱砂
    rule: '#D8C7A6', // 界格
    furniture: '#8C7C60',
    grid: 'rgba(122,98,60,0.10)',
    vignette: 'rgba(90,68,36,0.30)',
  },

  font: {
    // 楷体（KaiTi）在 Windows 上一定在；后面的 serif 是兜底。
    family: '"KaiTi", "STKaiti", "Kaiti SC", "SimSun", serif',
    mono: '"FangSong", "STFangsong", "Consolas", monospace',
  },

  type: {
    hero: 104,
    title: 88,
    heading: 54,
    subhead: 40,
    body: 32,
    caption: 24,
    stat: 168,
  },

  safe: {
    // 比 default-dark 宽的边距：宣纸的「天头地脚」
    x: 96,
    y: 112,
  },

  space: {
    mastheadHeight: 96,
    footerHeight: 76,
    gapTight: 18,
    gap: 36,
    gapLoose: 60,
  },

  motion: {
    // 更缓、更长的错开：书画式的从容
    enter: [0.22, 1, 0.36, 1],
    stagger: 10,
  },

  graphic: {
    ruleThickness: 2,
    accentBar: 12, // 印章式的粗条
    railThickness: 6,
    blockRadius: 0, // 方角
  },
};
