import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  readonly items: readonly string[];
  readonly fontSize?: number;
  readonly color?: string;
  readonly bulletColor?: string;
  readonly gap?: number;
  /** 相邻两条之间的间隔（帧） */
  readonly staggerInFrames?: number;
  readonly itemDurationInFrames?: number;
  readonly delayInFrames?: number;
  /**
   * 透传给 `Interactive` 的 Sequence 起始帧。**入场（以及一切帧相关取值）也从这一帧起算** ——
   * 见组件体内那段 `localFrame` 的说明。
   */
  readonly from?: number;
  readonly bulletSize?: number;
  readonly maxWidth?: number;
};

/**
 * 要点列表，逐条错开入场。
 *
 * 每条是一个 `Interactive.Div`，可在 Studio 里单独选中。名字由索引算出 —— 见
 * TextReveal 里关于 `.map()` 与 Studio 的说明。
 *
 * 文字色 / 项目符号色 / 字族来自主题；字号与间距默认值是内联值（Studio 可编辑）。
 */
export const BulletList: React.FC<Props> = ({
  items,
  fontSize = 44,
  color,
  bulletColor,
  gap = 28,
  staggerInFrames = 7,
  itemDurationInFrames = 20,
  delayInFrames = 0,
  from,
  bulletSize = 12,
  maxWidth = 1000,
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
        gap,
        maxWidth,
        width: '100%',
      }}
    >
      {items.map((item, index) => {
        const start = delayInFrames + index * staggerInFrames;

        return (
          <Interactive.Div
            key={`${index}-${item}`}
            name={`Bullet ${index + 1}`}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 24,
              opacity: interpolate(localFrame, [start, start + itemDurationInFrames], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: interpolate(
                localFrame,
                [start, start + itemDurationInFrames],
                ['-24px 0px', '0px 0px'],
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
                width: bulletSize,
                height: bulletSize,
                marginTop: fontSize * 0.42,
                flexShrink: 0,
                backgroundColor: bulletColor ?? theme.color.accent,
                scale: interpolate(localFrame, [start, start + itemDurationInFrames], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                  output: 'perceptual-scale',
                }),
              }}
            />
            <div
              style={{
                color: color ?? theme.color.ink,
                fontFamily: theme.font.family,
                fontSize,
                lineHeight: 1.35,
                fontWeight: 400,
              }}
            >
              {item}
            </div>
          </Interactive.Div>
        );
      })}
    </div>
  );
};
