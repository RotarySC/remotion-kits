import React, {createContext, useContext} from 'react';
import {THEMES, THEME_IDS} from './index';
import type {Theme} from './types';

/**
 * 主题下发 —— **组件层、母版层、护栏都只从这里读主题**。
 *
 * 为什么必须是 context 而不是模块级常量：
 *   组件如果 import 某个主题模块，它就只会长成那一个主题的样子 ——
 *   同一套组件放进另一个主题就失效。
 *   契约：**任何层都不许 import 具体的主题文件**（`theme/paper-seal.ts` 之类），
 *   只能 import 本文件与 `theme/index.ts` 的注册表。
 *
 * 未套母版时返回**本套件注册表里的第一个主题**，所以组件单独使用（不经母版）也能跑。
 */
const ThemeContext = createContext<Theme | null>(null);

export const ThemeProvider: React.FC<{
  readonly theme: Theme;
  readonly children: React.ReactNode;
}> = ({theme, children}) => {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

/**
 * 当前主题。未套母版时返回**内核注册表里的第一个主题**。
 *
 * 为什么是「注册表第一项」而不是写死一个 id：写死 `defaultDark` 就等于**内核替类型包
 * 选了长相**（热点解析那套的默认是 `signal-dark`）。
 *
 * ⚠️ 兜底是**内核注册表**的第一项，而且全系统只有这一份 context ——
 * 类型包不再复制一份（拆分前它与内核那份只差一行，是两个要各自维护的分叉）。
 * **类型包的默认主题由它自己的母版适配器表达**（如 `kits/hotspot/master/MasterFrame.tsx`
 * 的 `theme = THEMES[THEME_IDS[0]]`），不由这里表达。
 *
 * ⚠️ 这里读 `./index` 是**循环引用**（index 又 re-export 本文件）。安全的前提是
 * **取值必须发生在调用时**：模块初始化时 `THEMES` 还在 TDZ 里，读它会直接抛。
 * 所以这个 `??` 不能提到模块顶层。
 */
export const useTheme = (): Theme => {
  const themed = useContext(ThemeContext);
  return themed ?? THEMES[THEME_IDS[0]];
};
