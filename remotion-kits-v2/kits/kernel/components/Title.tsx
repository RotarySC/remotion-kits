import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  readonly text: string;
  readonly fontSize?: number;
  readonly color?: string;
  readonly align?: 'left' | 'center' | 'right';
  /** 本地时间线上的入场延迟（帧）。放在 `<Sequence>` 里时从该序列的 0 起算 */
  readonly delayInFrames?: number;
  /** 入场动效长度（帧）。**不是** Sequence 的 durationInFrames */
  readonly enterDurationInFrames?: number;
  /** 透传给 Interactive.Div 的 Sequence 起始帧。**入场也从这一帧起算**（见下面 `localFrame`） */
  readonly from?: number;
  /** Studio 时间线里的显示名。硬编码，不要算出来 */
  readonly name?: string;
  readonly fontWeight?: number;
  readonly letterSpacing?: number;
  readonly lineHeight?: number;
  readonly maxWidth?: number;
};

/**
 * 主标题。入场 = 透明度 + 上移，缓动为无回弹的强减速曲线。
 *
 * 尺寸基准（1080 宽）：主标题 ≥ 84px。默认 96px 是按 1920 宽给的。
 *
 * 颜色与字族来自主题（`useTheme()`）；**字号默认值是内联值**，这是有意的 ——
 * Studio 只能编辑内联硬编码的值。要让标题跟随主题字阶，把 `theme.type.title` 传进来，
 * 或者直接用母版版式（`master/layouts/`），那里的字号由主题算。
 */
export const Title: React.FC<Props> = ({
  text,
  fontSize = 96,
  color,
  align = 'left',
  delayInFrames = 0,
  enterDurationInFrames = 24,
  from,
  name = 'Title',
  fontWeight = 700,
  letterSpacing = -0.5,
  lineHeight = 1.08,
  maxWidth,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  /**
   * ⚠️ **入场读的必须是「`from` 之后那一帧」，不是外层帧。**
   *
   * `Interactive.Div` 内部建的是 `<Sequence layout="none" from={from ?? 0}>` —— 它挪的是
   * **DOM 挂载窗口**，而组件体内这个 `useCurrentFrame()` 拿到的是**外层帧**。
   * 于是 `from={30}` 会在挂载那一刻就已经入场完毕（墨量比 1.000，静默、不报错、不警告）。
   *
   * 修法就是**把 `from` 从帧里减掉** —— 那正是 Sequence 子树里 `useCurrentFrame()` 会得到的数
   * （`remotion/dist/cjs/Interactive.js`：`Sequence {layout:'none', from: from ?? 0, …}`）。
   * 入场的**形状一个字没动**，`from` 缺省时 `localFrame === frame` ⇒ 现有调用逐帧不变。
   *
   * 量测见 `docs/2026-10-06-from语义-裁定与落地.md`：改前 `from={30}` 的墨量比 1.000、
   * 对照组（调用方自己包 `<Sequence from={30}>`）0.000；改后两条逐帧相同。
   */
  const localFrame = frame - (from ?? 0);

  return (
    <Interactive.Div
      name={name}
      from={from}
      style={{
        // 块级：根盒子**不承载外观**，所以照容器办（'auto'）—— 被撑也不变形，见 `guards/placement.ts`
        ...placeSelf('auto'),
        color: color ?? theme.color.ink,
        fontFamily: theme.font.family,
        fontSize,
        fontWeight,
        letterSpacing,
        lineHeight,
        textAlign: align,
        maxWidth,
        opacity: interpolate(
          localFrame,
          [delayInFrames, delayInFrames + enterDurationInFrames],
          [0, 1],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        ),
        translate: interpolate(
          localFrame,
          [delayInFrames, delayInFrames + enterDurationInFrames],
          ['0px 28px', '0px 0px'],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        ),
      }}
    >
      {text}
    </Interactive.Div>
  );
};
