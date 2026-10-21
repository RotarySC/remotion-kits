/**
 * 主题 `neon-terminal` —— 终端 / 数据流。
 *
 * 第四个主题，**加进来时版式、家具、护栏、组件一个字节都没改** —— 这是
 * 「换主题不换版式」这条硬指标的实测证据（见 `references/theme-contract.md` 第 6.3 节：
 * 加主题前后对 `master/` + `guards/` + `components/` 做 SHA256 比对，逐条一致）。
 *
 * 身份差异集中在**字族（全等宽 + 仿宋中文）+ 字阶（更小更密）+ 边距（更满）+
 * 图形语言（1px 细线、直角）**，与前三个主题放在一起不会混淆。
 *
 * 本主题抽帧后改过一轮色：第一版的 `muted` / `furniture` 太暗，配上 0.70 的暗角，
 * 摘要、备注、页脚小字几乎读不出来。**暗角是叠加在边角上的**，而报头与页脚正好在边角 ——
 * 深色主题要么把次要文字调亮，要么把暗角收浅，二者必居其一。
 */

import type {Theme} from './types';

export const neonTerminal: Theme = {
  name: 'neon-terminal',

  color: {
    bg: '#04070A',
    ink: '#D7FFF0',
    muted: '#8CC0B0',
    accent: '#00E5A0',
    rule: '#1E4A3C',
    furniture: '#6FA394',
    grid: 'rgba(0,229,160,0.08)',
    vignette: 'rgba(0,0,0,0.45)',
  },

  font: {
    // 连正文都用等宽：这是本主题的身份。Consolas 负责拉丁，仿宋负责中文 ——
    // 两个脚本都有**点名**的字族，不靠系统兜底（见 types.ts 顶部第 2 条）。
    family: '"Consolas", "FangSong", "Courier New", monospace',
    mono: '"Consolas", "FangSong", "Courier New", monospace',
  },

  type: {
    hero: 88,
    title: 76,
    heading: 46,
    subhead: 34,
    body: 28,
    caption: 22,
    stat: 150,
  },

  safe: {
    // 边距最小 —— 终端感的「信息密度」
    x: 64,
    y: 84,
  },

  space: {
    mastheadHeight: 60,
    footerHeight: 56,
    gapTight: 12,
    gap: 24,
    gapLoose: 40,
  },

  motion: {
    // 快、短、无回弹：机器感
    enter: [0.4, 0, 0.2, 1],
    stagger: 3,
  },

  graphic: {
    ruleThickness: 1,
    accentBar: 4,
    railThickness: 3,
    blockRadius: 0, // 直角
  },
};
