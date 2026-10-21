import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  readonly children: React.ReactNode;
  /** highlight = 底色块在字后面；underline = 下划线；box = 圈框 */
  readonly kind?: 'highlight' | 'underline' | 'box';
  readonly color?: string;
  readonly delayInFrames?: number;
  readonly drawDurationInFrames?: number;
  readonly thickness?: number;
  readonly name?: string;
};

/**
 * 关键词强调。零依赖自绘 —— 不引入额外包，避免版本对齐成本。
 *
 * 装饰条用 `scale` 沿 X 轴生长，**绝不改 `width`**：结构性属性在渲染器并行采样时会失步。
 * `transformOrigin: left center` 让生长从左边开始。
 *
 * 颜色默认取主题的 `color.accent` —— 换主题时强调色跟着走，不用逐处改。
 */
export const Emphasis: React.FC<Props> = ({
  children,
  kind = 'highlight',
  color,
  delayInFrames = 0,
  drawDurationInFrames = 18,
  thickness = 6,
  name = 'Emphasis',
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const markColor = color ?? theme.color.accent;

  const grow = interpolate(
    frame,
    [delayInFrames, delayInFrames + drawDurationInFrames],
    ['0 1', '1 1'],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  return (
    <Interactive.Span
      name={name}
      style={{
        // 行内片段，与 `TextTag` 同一条：那圈高亮 / 下划线 / 方框是**绝对定位在根盒子上的**，
        // 所以根盒子被拉多高，那圈框就有多高 —— 被撑即变形。
        ...placeSelf('center'),
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {kind === 'highlight' ? (
        <span
          style={{
            position: 'absolute',
            left: -4,
            right: -4,
            top: '0.08em',
            bottom: '0.02em',
            backgroundColor: markColor,
            opacity: 0.24,
            transformOrigin: 'left center',
            scale: grow,
          }}
        />
      ) : null}

      {kind === 'underline' ? (
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -thickness * 0.8,
            height: thickness,
            backgroundColor: markColor,
            transformOrigin: 'left center',
            scale: grow,
          }}
        />
      ) : null}

      {kind === 'box' ? (
        <span
          style={{
            position: 'absolute',
            left: -10,
            right: -10,
            top: -6,
            bottom: -6,
            border: `${thickness * 0.4}px solid ${markColor}`,
            transformOrigin: 'left center',
            scale: grow,
          }}
        />
      ) : null}

      <span style={{position: 'relative'}}>{children}</span>
    </Interactive.Span>
  );
};
