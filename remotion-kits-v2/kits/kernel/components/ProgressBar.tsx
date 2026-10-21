import React from 'react';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  /**
   * 0–1 的进度值。
   *
   * **由调用方内联算出** —— 例如
   *   progress={interpolate(frame, [0, 240], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
   * 这样可编辑、可打关键帧的值就留在调用处，Studio 能直接改。
   */
  readonly progress: number;
  readonly color?: string;
  readonly trackColor?: string;
  readonly height?: number;
  readonly width?: number | string;
  readonly radius?: number;
};

/**
 * 进度指示条。填充部分用 `scale` 沿 X 轴生长，不改 `width`。
 * 静态组件，无自身动效 —— 进度完全由传入的 `progress` 决定。
 *
 * 前后两色默认取主题的 `color.accent` / `color.rule`。
 * ⚠️ `scale` 会跟着父级缩放，所以圆角（`radius`）在母版里要乘 `box.scale` 再传进来，
 * 否则高 DPI 画布上圆角看起来偏小。
 */
export const ProgressBar: React.FC<Props> = ({
  progress,
  color,
  trackColor,
  height = 6,
  width = '100%',
  radius = 3,
}) => {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div
      style={{
        // 块级：根盒子**不承载外观**，所以照容器办（'auto'）—— 被撑也不变形，见 `guards/placement.ts`
        ...placeSelf('auto'),
        width,
        height,
        backgroundColor: trackColor ?? theme.color.rule,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: '100%',
          backgroundColor: color ?? theme.color.accent,
          borderRadius: radius,
          transformOrigin: 'left center',
          scale: `${clamped} 1`,
        }}
      />
    </div>
  );
};
