/**
 * 默认主题 `default-dark` —— 深色现代风。
 *
 * 这是**基座默认**，不是「唯一」：换主题只要把别的 `Theme` 传给 `<MasterFrame theme={...}>`。
 * 要加主题就照本文件复制改名，再登记进 `theme/index.ts` —— 版式与家具一行都不用改。
 *
 * 为什么缓动与逐实例尺寸不在主题里 —— **两件事的理由不一样，别并成一句**：
 *   * **逐实例尺寸** 该逐处不同，所以内联写在组件 / 版式里；静态值在 Studio 里可编辑。
 *   * **缓动** 不该逐处不同，所以从设计上就属于主题的「动效签名」。
 *     ⚠️ **不要**拿「内联就可编辑」当把它内联的理由：2026-10-05 实测，原语层那些内联曲线
 *     **今天也是 `computed`**（全层 `keyframed` 0 格）—— `interpolate` 的 input range 一旦
 *     用 prop 的运算，**整格**就变灰。见 `references/component-contract.md` §3。
 *   主题只放「本就不该逐处不同」的东西（色板、字阶、动效签名、图形语言）。
 */

import type {Theme} from './types';

export const defaultDark: Theme = {
  name: 'default-dark',

  color: {
    bg: '#0B0D10',
    ink: '#F4F6F8',
    muted: '#9AA4B2',
    accent: '#5B8CFF',
    rule: '#2A2F38',
    furniture: '#6B7684',
    grid: 'rgba(255,255,255,0.035)',
    vignette: 'rgba(0,0,0,0.55)',
  },

  font: {
    // "Inter" 排第一是品牌意图：项目里用 @remotion/fonts 加载后自然生效。
    // 后面必须跟一个**真实存在**的中文字族（"Microsoft YaHei" 在 Windows 上一定在），
    // 否则中文会按字重逐段回退到不同字体 —— 同一帧里混排宋体与黑体。
    family: '"Inter", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Consolas", ui-monospace, monospace',
  },

  type: {
    hero: 112,
    title: 96,
    heading: 56,
    subhead: 40,
    body: 32,
    caption: 24,
    stat: 180,
  },

  safe: {
    x: 80,
    y: 100,
  },

  space: {
    mastheadHeight: 72,
    footerHeight: 64,
    gapTight: 16,
    gap: 32,
    gapLoose: 56,
  },

  motion: {
    enter: [0.16, 1, 0.3, 1],
    stagger: 7,
  },

  graphic: {
    ruleThickness: 2,
    accentBar: 6,
    railThickness: 4,
    blockRadius: 4,
  },
};
