/**
 * 主题注册表 —— 套件里一共有哪些主题，从这里查。
 *
 * 加一个主题的完整动作（三处，**版式与家具一行都不用改**）：
 *   1. 照 `default.ts` 复制一份 `theme/<新 id>.ts`，导出 `export const <驼峰 id>: Theme`；
 *   2. 在下面的 `THEMES` / `THEME_IDS` 里登记；
 *   3. 跑一遍 `references/theme-contract.md` 第 6 节的验证（每个版式每个主题抽一帧）。
 *
 * 主题自己的演示合成就用 `THEME_IDS.map(...)` 批量注册，见 `templates/ThemeShowcase.tsx`。
 */

import {bubblePop} from './bubble-pop';
import {defaultDark} from './default';
import {neonTerminal} from './neon-terminal';
import {paperSeal} from './paper-seal';
import type {Theme} from './types';

/** 主题 id。**必须与主题对象里的 `name` 完全一致**（抽帧与注册表都靠它对上） */
export type ThemeId = 'default-dark' | 'paper-seal' | 'bubble-pop' | 'neon-terminal';

export const THEMES: Record<ThemeId, Theme> = {
  'default-dark': defaultDark,
  'paper-seal': paperSeal,
  'bubble-pop': bubblePop,
  'neon-terminal': neonTerminal,
};

export const THEME_IDS: readonly ThemeId[] = [
  'default-dark',
  'paper-seal',
  'bubble-pop',
  'neon-terminal',
];

/** 按 id 取主题。id 不存在时是类型错误，不是运行时错误 */
export const getTheme = (id: ThemeId): Theme => THEMES[id];

export {ThemeProvider, useTheme} from './context';
export {defaultDark} from './default';
export type {Theme} from './types';
