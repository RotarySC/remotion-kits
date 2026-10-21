import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  readonly text: string;
  readonly fontSize?: number;
  readonly color?: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly delayInFrames?: number;
  readonly enterDurationInFrames?: number;
  /**
   * 透传给 `Interactive` 的 Sequence 起始帧。**入场（以及一切帧相关取值）也从这一帧起算** ——
   * 见组件体内那段 `localFrame` 的说明。
   */
  readonly from?: number;
  readonly name?: string;
  readonly fontWeight?: number;
  readonly lineHeight?: number;
  readonly maxWidth?: number;
};

/**
 * 副标题 / 支撑文字。比 Title 更缓、位移更小，避免两行同时抢注意力。
 * 尺寸基准（1080 宽）：重要支撑文字 ≥ 44px。
 *
 * 颜色与字族来自主题；字号默认值是内联值（见 `Title` 的说明）。
 */
export const Subtitle: React.FC<Props> = ({
  text,
  fontSize = 40,
  color,
  align = 'left',
  delayInFrames = 8,
  enterDurationInFrames = 24,
  from,
  name = 'Subtitle',
  fontWeight = 400,
  lineHeight = 1.4,
  maxWidth = 900,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  /**
   * 入场与**所有帧相关取值**都读局部帧：`from` 挪的是 `Interactive.Div` 内部那层
   * `<Sequence from>` 的挂载窗口，组件体内 `useCurrentFrame()` 拿到的却是外层帧 ⇒
   * 不减掉 `from`，`from={30}` 会在挂载那一刻就已经入场完毕（静默、不报错）。
   * `from` 缺省时 `localFrame === frame`，现有调用逐帧不变。
   */
  const localFrame = frame - (from ?? 0);

  return (
    <Interactive.Div
      name={name}
      from={from}
      style={{
        // 块级：根盒子**不承载外观**，所以照容器办（'auto'）—— 被撑也不变形，见 `guards/placement.ts`
        ...placeSelf('auto'),
        color: color ?? theme.color.muted,
        fontFamily: theme.font.family,
        fontSize,
        fontWeight,
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
          ['0px 16px', '0px 0px'],
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
