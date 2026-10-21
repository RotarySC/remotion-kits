import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  readonly lines: readonly string[];
  readonly fontSize?: number;
  readonly color?: string;
  readonly align?: 'left' | 'center' | 'right';
  /** 每行之间的间隔（帧） */
  readonly staggerInFrames?: number;
  readonly lineDurationInFrames?: number;
  readonly delayInFrames?: number;
  /**
   * 透传给 `Interactive` 的 Sequence 起始帧。**入场（以及一切帧相关取值）也从这一帧起算** ——
   * 见组件体内那段 `localFrame` 的说明。
   */
  readonly from?: number;
  readonly fontWeight?: number;
  readonly lineHeight?: number;
  readonly maxWidth?: number;
};

/**
 * 逐行揭示：每行装在 `overflow: hidden` 的遮罩里向上推出，形成「擦拭」感。
 *
 * 关于 `.map()` 与 Studio：这里用 `.map()` 渲染文字行是安全的 —— 视频编辑那条
 * 「不要用 .map() 生成可编辑片段」的规则针对的是**带时序的 clip**（Video/Audio），
 * 不是组件内部的文字行。代价是这些行的 `name` 由索引算出，Studio 仍可选中，
 * 但回写不如硬编码名字稳定。要最大保真度就在调用处逐行摆多个组件。
 *
 * 颜色与字族来自主题；字号默认值是内联值（见 `Title` 的说明）。
 */
export const TextReveal: React.FC<Props> = ({
  lines,
  fontSize = 72,
  color,
  align = 'left',
  staggerInFrames = 6,
  lineDurationInFrames = 22,
  delayInFrames = 0,
  from,
  fontWeight = 600,
  lineHeight = 1.22,
  maxWidth = 1100,
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
    <div
      style={{
        // 块级：根盒子**不承载外观**，所以照容器办（'auto'）—— 被撑也不变形，见 `guards/placement.ts`
        ...placeSelf('auto'),
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        maxWidth,
        width: '100%',
      }}
    >
      {lines.map((line, index) => {
        const start = delayInFrames + index * staggerInFrames;

        return (
          <div
            key={`${index}-${line}`}
            style={{
              overflow: 'hidden',
              width: '100%',
              textAlign: align,
            }}
          >
            <Interactive.Div
              name={`Reveal line ${index + 1}`}
              style={{
                color: color ?? theme.color.ink,
                fontFamily: theme.font.family,
                fontSize,
                fontWeight,
                lineHeight,
                textAlign: align,
                opacity: interpolate(localFrame, [start, start + lineDurationInFrames], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
                // 每个分量的单位必须各自一致：x 用 px，y 用百分比。
                // 写成 ['0px 100%', '0px 0px'] 会在渲染时抛错（% 与 px 混用）——
                // tsc 抓不到，只有抽帧能抓到。
                translate: interpolate(
                  localFrame,
                  [start, start + lineDurationInFrames],
                  ['0px 100%', '0px 0%'],
                  {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  },
                ),
              }}
            >
              {line}
            </Interactive.Div>
          </div>
        );
      })}
    </div>
  );
};
