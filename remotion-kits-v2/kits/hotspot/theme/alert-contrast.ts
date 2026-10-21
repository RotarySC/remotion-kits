/**
 * `alert-contrast` —— 高警示的头版感（浅底 + 黑墨 + 朱红 + 粗条 + 胶囊）。
 *
 * 与 `signal-dark` 的**方向对立**：那套在陈述，这套在提醒。
 * 浅纸底 + 近乎纯黑的正文 + 朱红强调，靠对比度把「这件事很重要」直接压出来；
 * 强调条与进度轨都加粗，圆角走胶囊（999）—— 标签感而不是仪表盘感。
 *
 * **浅色主题的两个坑**（都踩过，见 `theme-contract.md`）：
 *   1. `grid` 必须比 `bg` 深，否则网格在白底上直接消失；
 *   2. `vignette` 用同色系的深色（这里带一点暖褐），**不能用纯黑** —— 纯黑在浅底上会发脏。
 */

import type {Theme} from '../../kernel/theme/types';

export const alertContrast: Theme = {
  name: 'alert-contrast',

  color: {
    bg: '#F6F3EC',
    ink: '#141210',
    muted: '#6B6357',
    accent: '#C8202A',
    rule: '#D6CFC0',
    furniture: '#8A8071',
    grid: 'rgba(20,18,16,0.055)',
    vignette: 'rgba(60,48,30,0.16)',
  },

  font: {
    // SimHei 是本机真实存在的粗黑体；Georgia 只是给西文一个衬线对照。
    family: '"SimHei", "Microsoft YaHei", "Georgia", sans-serif',
    mono: '"Courier New", "Consolas", ui-monospace, monospace',
  },

  type: {
    hero: 128,
    title: 104,
    heading: 60,
    subhead: 42,
    body: 34,
    caption: 26,
    stat: 200,
  },

  safe: {
    x: 72,
    y: 88,
  },

  space: {
    mastheadHeight: 116,
    footerHeight: 72,
    gapTight: 18,
    gap: 36,
    gapLoose: 60,
  },

  motion: {
    // 带回弹的入场（y 超出 [0,1]）—— 契约允许，见 `theme/types.ts` 的 motion 注释。
    enter: [0.34, 1.56, 0.64, 1],
    stagger: 9,
  },

  graphic: {
    ruleThickness: 4,
    accentBar: 12,
    railThickness: 6,
    blockRadius: 999,
  },
};
