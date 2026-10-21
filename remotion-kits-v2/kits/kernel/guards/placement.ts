import type React from 'react';

/**
 * 元素对「被分配到的格子」的响应 —— T04 裁定（2026-10-05）。
 *
 * ## 职责分界（一句话）
 *
 * ```
 * Flow   分配空间 —— 轨道、间距、交叉轴的格子尺寸
 * 元素   绘制响应 —— 它自己决定要不要填满那个格子
 * ```
 *
 * 在这之前是反的：`Flow` 用 `align-items: stretch` 把**所有**子项的根盒子拉满，
 * 于是「盒子就是那件东西」的元素会被拉变形 —— 实测一枚 24px 高的标签长成 `286x150`
 * 的色块（`Stage2Probe` 场景 T04 / C）。
 *
 * ## 为什么用 CSS 变量
 *
 * 两条要求同时成立只有一个办法：元素**声明自己的默认**，调用处（组级的 `align`）**能覆盖它**。
 * 于是元素写 `var(--kit-align, <自己的默认>)`，`Flow` 把组里的意见放进那个变量。
 *
 * ## 两个默认值，不是三个同义词
 *
 * | 值 | 含义 | 谁用 |
 * | --- | --- | --- |
 * | `'auto'` | **照容器办**（`align-items` / `justify-items`） | 容器类 ＋ 块级 |
 * | `'center'` | 按内容、居中 | 行内片段（`TextTag` / `Emphasis`） |
 *
 * ⚠️ **块级是 `'auto'` 而不是 `'start'` —— 这一处是实测推翻设计。**
 *
 * 一开始按「块级 = 按内容」给 11 个块级原语写了 `'start'`。**全量逐帧比对当场否掉**：
 * 元素根盒子上的 `align-self` 会**盖掉父容器的 `align-items`** —— 于是凡是用
 * `<AbsoluteFill style={{alignItems:'center'}}>` 这类普通 flex 容器定位原语的调用处
 * **全部失效**（`KitShowcase` 里 7 个场景变样：Scene 5/6 的大媒体框从居中变成贴左）。
 * 那与 T04 裁定的第二句正好相反：**「实例可覆盖」要求调用处压得住元素默认**。
 *
 * 而**块级原语的根盒子都不承载外观** —— `ProgressBar` 与 `MediaStage` 写了确定的尺寸
 * （`stretch` 本来就够不着它们），其余（`Title` / `Quote` / `RichTextBox` / `BarChart` / `Stat` …）
 * 根盒子是透明的。所以「根盒子被撑成格子高」**在画面上看不见** ——
 * 它们**本来就没有意见**，`'auto'` 才是诚实的；写死 `'start'` 只会把它们变成一个
 * 会跟调用处打架的声明。
 *
 * ⚠️ **因此规则不是「按 `display` 分类」，而是**：只有「**根盒子就是那件东西**」的元素
 * 才需要声明（行内片段），其余一律 `'auto'`。量化依据见
 * `docs/2026-10-05-T04-子项尺寸契约-裁定.md` §4：16 个原语里 13 个的根盒子都会被撑满，
 * 所以「根盒子会不会被撑」几乎不区分任何东西 —— 分界线在**那件东西画在哪一层**。
 *
 * ## 为什么是两个变量，不是一个
 *
 * 交叉轴是哪一根**取决于方向**：`row` 是块轴（`align-self`），`column` 是行内轴（`justify-self`）。
 * 而元素不知道自己在什么方向里。所以 `Flow`：
 *
 *   * **主轴**那根写成一个确定值 `'stretch'` —— 元素必须填满自己的轨道（`ratio` 靠它）；
 *   * **交叉轴**那根写 `align`，没给就写 `'initial'`（不表态）。
 *
 * 于是元素带的那份默认**只会落在交叉轴上**。
 *
 * ⚠️ **「不表态」必须写 `'initial'`。** 自订属性是**可继承**的，所以 `unset`
 * 挡不住继承 —— 嵌套的 `Flow` 会把外层的 `align` 漏给内层子项。实测
 * （`Stage2Probe` 场景 V，外层给 `center`、目标高 40、格子高 200）：
 * 中间层不设变量 `@y=80`（漏）、写 `unset` **`@y=80`（照样漏）**、
 * 写 `initial` `@y=0`（挡住）。只有 `initial` 是对的。
 *
 * ## `Flow` 自己不用它
 *
 * `Flow` 往自己身上写这两个变量（给子项），所以它**不能**再用它们来摆放自己 ——
 * 那会读到自己的值，把外层 `Flow` 的意见顶掉。它作为子项时照旧由外层的
 * `align-items` 摆（`align-self` 不动 = 初值 `auto`）。
 */

/** 元素在交叉轴上的自然默认 —— 见上表。当前只有两个值：容器与块级 `'auto'`、行内片段 `'center'` */
export type CrossSelf = 'auto' | 'center';

/**
 * 元素根盒子上的那两行。
 *
 * 只在它是 flex / grid 子项时起作用；普通块级流里两条都被忽略，
 * 所以可以无条件写在根盒子上，不必问「我是不是在 `Flow` 里」。
 */
export const placeSelf = (cross: CrossSelf): React.CSSProperties => ({
  alignSelf: `var(--kit-align, ${cross})` as React.CSSProperties['alignSelf'],
  justifySelf: `var(--kit-justify, ${cross})` as React.CSSProperties['justifySelf'],
});

/**
 * `Flow` 往自己身上写的那对变量。
 *
 * `align` 省略 = **不表态**（`'initial'`），让每个元素用自己的默认 ——
 * 那正是「元素自然默认」这句话的执行点。
 */
export const crossVars = (
  isRow: boolean,
  align: 'start' | 'center' | 'end' | 'stretch' | undefined,
): React.CSSProperties => {
  const opinion = align ?? 'initial';

  return (
    isRow
      ? {'--kit-align': opinion, '--kit-justify': 'stretch'}
      : {'--kit-align': 'stretch', '--kit-justify': opinion}
  ) as React.CSSProperties;
};
