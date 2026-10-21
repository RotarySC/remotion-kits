/**
 * 主题 `bubble-pop` —— 卡通 / 高饱和 / 圆角。
 *
 * 与 `default-dark`、`paper-seal` 的差异集中在**图形语言与节奏**：
 * 粗线、胶囊圆角、更大的字阶、更小的边距（画面更满）、带回弹的入场曲线、
 * 更短的错开间隔（更跳）。三者放一起看，不会有人认为是「同一套换了个色」。
 */

import type {Theme} from './types';

export const bubblePop: Theme = {
  name: 'bubble-pop',

  color: {
    bg: '#FFF6EA',
    ink: '#1B1B3A',
    muted: '#6C6C97',
    accent: '#FF4E7A',
    rule: '#E6D6C4',
    furniture: '#8B87AE',
    grid: 'rgba(27,27,58,0.06)',
    vignette: 'rgba(255,120,60,0.22)',
  },

  font: {
    // Comic Sans 负责拉丁（序号、日期、数字），中文落到微软雅黑。
    family: '"Comic Sans MS", "Microsoft YaHei", "Segoe UI", sans-serif',
    mono: '"Consolas", "Courier New", monospace',
  },

  type: {
    hero: 132,
    title: 104,
    heading: 62,
    subhead: 46,
    body: 34,
    caption: 26,
    stat: 196,
  },

  safe: {
    // 边距更小 —— 卡通风要「填满」
    x: 72,
    y: 92,
  },

  space: {
    mastheadHeight: 92,
    footerHeight: 84,
    gapTight: 20,
    gap: 40,
    gapLoose: 64,
  },

  motion: {
    // y 超出 [0,1] 是合法的：Easing.bezier 只校验 x（见 remotion 的 bezier.ts）
    enter: [0.34, 1.56, 0.64, 1],
    stagger: 5,
  },

  graphic: {
    ruleThickness: 5,
    accentBar: 20,
    railThickness: 12,
    blockRadius: 999, // 胶囊
  },
};
