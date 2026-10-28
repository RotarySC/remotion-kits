import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  readonly text: string;
  readonly attribution?: string;
  readonly fontSize?: number;
  readonly color?: string;
  readonly accentColor?: string;
  readonly delayInFrames?: number;
  readonly enterDurationInFrames?: number;
  /**
   * 透传给 `Interactive` 的 Sequence 起始帧。**入场（以及一切帧相关取值）也从这一帧起算** ——
   * 见组件体内那段 `localFrame` 的说明。
   */
  readonly from?: number;
  readonly maxWidth?: number;
  readonly name?: string;
};

/**
 * 引用卡：大引号 + 引文 + 出处。
 * 引号用 `output: 'perceptual-scale'` —— 线性缩放在大尺寸下会显得偏小。
 *
 * 引号色 / 正文色 / 出处色 / 字族来自主题；字号与 `maxWidth` 默认值是内联值。
 */
export const Quote: React.FC<Props> = ({
  text,
  attribution,
  fontSize = 52,
  color,
  accentColor,
  delayInFrames = 0,
  enterDurationInFrames = 24,
  from,
  maxWidth = 1200,
  name = 'Quote',
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
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
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
          ['0px 24px', '0px 0px'],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        ),
      }}
    >
      <div
        style={{
          color: accentColor ?? theme.color.accent,
          fontFamily: theme.font.family,
          fontSize: 120,
          fontWeight: 700,
          lineHeight: 0.6,
          height: 56,
          scale: interpolate(localFrame, [delayInFrames, delayInFrames + 20], [0.6, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: 'perceptual-scale',
          }),
          transformOrigin: 'left center',
        }}
      >
        &ldquo;
      </div>

      <div
        style={{
          color: color ?? theme.color.ink,
          fontFamily: theme.font.family,
          fontSize,
          fontWeight: 500,
          lineHeight: 1.4,
          // 长引文靠浏览器折行。**必须开 `balance`**：默认的贪心折行会让末行只剩一个字
          // （抽帧抓到过「长引文末字换行」）。这与护栏里那个孤字问题是**同一个根因** ——
          // 贪心断行；只是那一个发生在 `useFittedLines` 算出的断行上，这一个发生在浏览器折行上。
          textWrap: 'balance',
        }}
      >
        {text}
      </div>

      {attribution ? (
        <div
          style={{
            color: theme.color.muted,
            fontFamily: theme.font.family,
            fontSize: 32,
            fontWeight: 400,
            opacity: interpolate(
              localFrame,
              [delayInFrames + enterDurationInFrames, delayInFrames + enterDurationInFrames + 16],
              [0, 1],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        >
          {attribution}
        </div>
      ) : null}
    </Interactive.Div>
  );
};
