import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  /** 章节编号，例如 "01"。省略则不显示 */
  readonly index?: string;
  readonly title: string;
  readonly color?: string;
  readonly accentColor?: string;
  readonly ruleColor?: string;
  readonly fontSize?: number;
  readonly delayInFrames?: number;
  readonly enterDurationInFrames?: number;
  /**
   * 透传给 `Interactive` 的 Sequence 起始帧。**入场（以及一切帧相关取值）也从这一帧起算** ——
   * 见组件体内那段 `localFrame` 的说明。
   */
  readonly from?: number;
  readonly name?: string;
};

/**
 * 章节标题：编号 + 标题 + 一条从左侧生长出来的分隔线。
 * 分隔线同样用 `scale` 而非 `width`。
 *
 * 四种颜色（正文 / 编号 / 分隔线 / 字族）全部来自主题；字号默认值是内联值。
 */
export const SectionHeading: React.FC<Props> = ({
  index,
  title,
  color,
  accentColor,
  ruleColor,
  fontSize = 56,
  delayInFrames = 0,
  enterDurationInFrames = 22,
  from,
  name = 'Section heading',
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
        gap: 18,
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 20,
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
            ['-16px 0px', '0px 0px'],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        {index ? (
          <span
            style={{
              color: accentColor ?? theme.color.accent,
              fontFamily: theme.font.mono,
              fontSize: fontSize * 0.5,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            {index}
          </span>
        ) : null}
        <span
          style={{
            color: color ?? theme.color.ink,
            fontFamily: theme.font.family,
            fontSize,
            fontWeight: 700,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </span>
      </div>

      <div
        style={{
          height: 2,
          width: '100%',
          backgroundColor: ruleColor ?? theme.color.rule,
          transformOrigin: 'left center',
          scale: interpolate(
            localFrame,
            [delayInFrames + 6, delayInFrames + 6 + enterDurationInFrames + 8],
            ['0 1', '1 1'],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      />
    </Interactive.Div>
  );
};
