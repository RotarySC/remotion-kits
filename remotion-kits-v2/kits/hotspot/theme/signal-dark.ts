/**
 * `signal-dark` —— 冷静的数据感（深底 + 青绿强调 + 等宽数字 + 直角细线）。
 *
 * **本套件的默认主题**。方向定调：热点解析容易滑向情绪化，这套长相刻意做成
 * 「仪表盘」—— 数字用等宽、线条 1px、圆角 0，让画面看起来像在陈述而不是在煽动。
 *
 * 七个维度都与其他方向明显不同（见 `alert-contrast.ts`）。
 * 字体族**必须点名本机真实存在的字**（`Microsoft YaHei` / `Consolas`）：
 * 只写装不上的字体名时 Chromium 会按字重逐段回退，同帧混排宋体 + 黑体，
 * 而且护栏量到的宽度不是渲染字体的宽度。
 */

import type {Theme} from '../../kernel/theme/types';

export const signalDark: Theme = {
  name: 'signal-dark',

  color: {
    bg: '#070B0D',
    ink: '#E6F0EE',
    muted: '#7C948F',
    accent: '#2FD4A8',
    // 界格线 / 时间线轨道用它。**抽帧校准过**：初值 #1B2927 在 #070B0D 底上
    // 几乎不可见 —— 时间线的竖轨直接消失、页脚规则线看不出、数字下的强调条发灰。
    // 浅色主题同一个版式却正常，说明问题在**这个值**而不是版式：`rule` 要能当结构线用。
    rule: '#2E4440',
    furniture: '#5A736E',
    // 网格与暗角必须与 bg 同向，否则浅色主题上网格会直接消失
    grid: 'rgba(255,255,255,0.040)',
    vignette: 'rgba(0,0,0,0.50)',
  },

  font: {
    family: '"Microsoft YaHei", "Trebuchet MS", system-ui, sans-serif',
    mono: '"Consolas", "Courier New", ui-monospace, monospace',
  },

  type: {
    hero: 104,
    title: 88,
    heading: 52,
    subhead: 38,
    body: 30,
    caption: 22,
    stat: 164,
  },

  safe: {
    x: 88,
    y: 104,
  },

  space: {
    // 报头带要放**两行**（栏目名 + 事件时间戳），所以比基座的 72 高
    mastheadHeight: 104,
    footerHeight: 68,
    gapTight: 14,
    gap: 28,
    gapLoose: 48,
  },

  motion: {
    enter: [0.22, 1, 0.36, 1],
    stagger: 6,
  },

  graphic: {
    ruleThickness: 1,
    accentBar: 4,
    railThickness: 3,
    blockRadius: 0,
  },
};
