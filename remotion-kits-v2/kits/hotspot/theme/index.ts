/**
 * 主题注册表 —— **热点解析**套件的两个方向。
 *
 * 加一个主题的完整动作（三处，**版式与家具一行都不用改**）：
 *   1. 照 `signal-dark.ts` 复制一份 `theme/<新 id>.ts`，导出 `export const <驼峰 id>: Theme`；
 *   2. 在下面的 `THEMES` / `THEME_IDS` 里登记；
 *   3. 跑一遍 `references/theme-contract.md` 第 6 节的验证（每个版式每个主题抽一帧 +
 *      内核那几层 `master/**` + `guards/**` + `components/**` 的哈希比对）。
 *
 * 主题自己的演示合成就用 `THEME_IDS.map(...)` 批量注册，见 `templates/ThemeShowcase.tsx`。
 *
 * **只有两个主题是有意的**：这是类型专属套件，不是通用内核 ——
 * 两个**明显对立**的方向（冷静数据感 ↔ 高警示头版感）够用户用眼睛选，
 * 多放几个近似的只会让选择变难。
 *
 * ⚠️ `THEMES` / `THEME_IDS` 是**本套件自己的**；`Theme` 类型与 `ThemeProvider` /
 * `useTheme` 来自内核（`kits/kernel/theme/`）—— 全系统**只有一份** context 对象，
 * 所以原语、版式、家具读到的主题永远是同一个。
 *
 * ⚠️ `useTheme` 的兜底值取**内核注册表的第一项**（`default-dark`），不是本表第一项
 * —— 本套件不再有自己那份 `context.tsx`（拆分前有，两份只差一行）。
 * 本套件的默认主题由 `master/MasterFrame.tsx` 的适配器表达：
 * 它写 `theme = THEMES[THEME_IDS[0]]`，所以 `signal-dark` 排在前 = 没传 theme 时的长相。
 * **顺序仍然表达默认主题**，只是那件事现在由母版适配器负责，不是由 useTheme 负责。
 */

import type {Theme} from '../../kernel/theme/types';
import {alertContrast} from './alert-contrast';
import {signalDark} from './signal-dark';

/** 主题 id。**必须与主题对象里的 `name` 完全一致**（抽帧与注册表都靠它对上） */
export type ThemeId = 'signal-dark' | 'alert-contrast';

export const THEMES: Record<ThemeId, Theme> = {
  'signal-dark': signalDark,
  'alert-contrast': alertContrast,
};

export const THEME_IDS: readonly ThemeId[] = ['signal-dark', 'alert-contrast'];

/** 按 id 取主题。id 不存在时是类型错误，不是运行时错误 */
export const getTheme = (id: ThemeId): Theme => THEMES[id];

export {ThemeProvider, useTheme} from '../../kernel/theme/context';
export {signalDark} from './signal-dark';
export {alertContrast} from './alert-contrast';
export type {Theme} from '../../kernel/theme/types';
