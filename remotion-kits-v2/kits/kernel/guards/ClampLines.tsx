import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';

type Props = {
  readonly text: string;
  /** 最多显示几行，超出部分截断 */
  readonly maxLines: number;
  readonly fontSize: number;
  readonly color?: string;
  readonly fontWeight?: number;
  readonly lineHeight?: number;
  readonly delayInFrames?: number;
  readonly enterDurationInFrames?: number;
  readonly name?: string;
};

/**
 * 截断护栏 —— 母版契约第 5 节的第三种策略。
 *
 * 与 `useFittedLines()` 的区别：
 *   - `useFittedLines()` **缩小字号**让内容塞进 N 行 —— 适合「必须完整显示」的槽（头条、引文）
 *   - 本组件 **保持字号不变，截断溢出** —— 适合「显示不完也没关系」的槽（摘要、补充说明）
 *
 * 用 CSS `-webkit-line-clamp` 实现：不测量，代价最低，Chromium 下可靠。
 *
 * 颜色与字族来自主题；`fontSize` 必须由调用方给（通常是主题字阶 × 母版缩放）。
 */
export const ClampLines: React.FC<Props> = ({
  text,
  maxLines,
  fontSize,
  color,
  fontWeight = 400,
  lineHeight = 1.45,
  delayInFrames = 0,
  enterDurationInFrames = 18,
  name = 'Clamped text',
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();

  return (
    <Interactive.Div
      name={name}
      style={{
        color: color ?? theme.color.muted,
        fontFamily: theme.font.family,
        fontSize,
        fontWeight,
        lineHeight,
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        opacity: interpolate(
          frame,
          [delayInFrames, delayInFrames + enterDurationInFrames],
          [0, 1],
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
