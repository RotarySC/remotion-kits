import {Easing, interpolate} from 'remotion';

/**
 * 入场动画的**最小公共计算** ＋ **「淡入上移」具名组合**。
 *
 * ## 为什么有这份文件（T07-① 的裁定）
 *
 * 裁定原文：「作为已完成的盘点；随后实现最小公共计算与"淡入上移"组合，**保留现有默认效果**。」
 * 落地时分两件东西，别混：
 *
 * - **`enterFade`** —— 最小公共计算：给「从某个偏移处淡入到原位」这件事算两个值
 *   （`opacity` / `translate`）。**它不渲染、不建节点、不读任何 React context**，
 *   只吃一个已经拿到的 `frame`。所以它既能在元件层用，也能在母版层用，还能在测试里直接调。
 * - **`fadeUp`** —— 具名组合：把 `enterFade` 的 `shift` 固定成「起点在下方 N px」，
 *   也就是实测里出现最多的那条形状（`0px Npx → 0px 0px`，视觉上是**上移**）。
 *
 * ## ⚠️ 它**不**负责的事（都是有意留白的）
 *
 * - **不改现有调用处。** 裁定里「保留现有默认效果」＝ 现有 16 处淡入上移**一个字不改**，
 *   所以这份文件是**新增的一条路**，不是一次迁移。
 *   代价如实说：现有那 32 处硬编码曲线**这一轮不减少**。
 * - **不做横移。** 实测 16 处里 10 处是上移、**4 处是右移**（`-Npx 0px → 0px 0px`）。
 *   横移那 4 处以**后**再说，不硬塞进名叫「上移」的组合里 —— 那会名实不符。
 * - **不替调用处决定曲线。** `curve` 默认取 `DEFAULT_ENTER_CURVE`，恰好与 `theme/default.ts` 的
 *   `motion.enter` 同值 —— 但这是**巧合的便利**，不是「读主题」。
 *   要用主题曲线的调用处**自己把值传进来**（母版层那 6 处就是这么写的）。
 * - **不做可编辑性上的任何手脚。** 用它与用内联 `interpolate` 在 Studio 里**同样**是计算值
 *   （AGENTS §3.8 已测：整套件 0 格动画可编辑）。它不改善也不恶化这件事。
 */

/** 与 `theme/default.ts` 的 `motion.enter` **同值**的默认曲线。改主题不会改到这里。 */
export const DEFAULT_ENTER_CURVE = [0.16, 1, 0.3, 1] as const;

export type EnterCurve = readonly [number, number, number, number];

export type EnterFadeOptions = {
  /** 当前帧。**由调用处传入** —— 这样它不依赖任何 hook，母版层与元件层同一份实现 */
  readonly frame: number;
  /** 入场起始帧（含）。相对调用处所在序列的时间原点 */
  readonly startInFrames: number;
  /** 入场长度（帧）。**不是** Sequence 的 `durationInFrames` */
  readonly durationInFrames: number;
  /** 起点偏移（任意合法 CSS `translate` 值），动画把它收敛到 `0px 0px` */
  readonly shift: string;
  readonly curve?: EnterCurve;
};

export type EnterFade = {
  readonly opacity: number;
  readonly translate: string;
};

/**
 * **最小公共计算**：从 `(frame, 起点, 时长, 偏移)` 算出入场这一刻的 `opacity` 与 `translate`。
 *
 * 两头都 `clamp`：起点之前恒为「还没进来」，终点之后恒为「已经到位」。
 */
export const enterFade = ({
  frame,
  startInFrames,
  durationInFrames,
  shift,
  curve = DEFAULT_ENTER_CURVE,
}: EnterFadeOptions): EnterFade => {
  const easing = Easing.bezier(curve[0], curve[1], curve[2], curve[3]);
  const range = [startInFrames, startInFrames + durationInFrames];
  const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing} as const;
  return {
    opacity: interpolate(frame, range, [0, 1], clamp),
    translate: interpolate(frame, range, [shift, '0px 0px'], clamp),
  };
};

/**
 * **具名组合：淡入上移。**
 *
 * ```tsx
 * const enter = fadeUp({frame, startInFrames: delayInFrames, durationInFrames: enterDurationInFrames});
 * <Interactive.Div style={{...enter}}>…</Interactive.Div>
 * ```
 *
 * `distanceInPx` 默认 **28** —— 与 `Title` 现有那条一致，所以「什么都不传」得到的就是最常见的那一档。
 * 实测里出现过的其它距离：`14`（`Stat` / `StatLayout`）· `16`（`Subtitle`）· `20`（`QuoteLayout`）·
 * `24`（`Quote` / `ClosingLayout`）· `32`（`CoverLayout`）—— 都靠这一个参数表达。
 */
export const fadeUp = ({
  distanceInPx = 28,
  ...rest
}: Omit<EnterFadeOptions, 'shift'> & {readonly distanceInPx?: number}): EnterFade =>
  enterFade({...rest, shift: `0px ${distanceInPx}px`});
