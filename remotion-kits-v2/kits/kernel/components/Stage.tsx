import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useTheme} from '../theme/context';

type Props = {
  readonly children?: React.ReactNode;
  readonly background?: string;
  /** 叠一层网格；给排版驱动的片子一点结构感 */
  readonly grid?: boolean;
  /** 网格线颜色。省略则取主题的 `color.grid` */
  readonly gridColor?: string;
  readonly gridSize?: number;
  /** 四角压暗，让中心内容更聚焦 */
  readonly vignette?: boolean;
  /** 暗角最外圈的颜色。省略则取主题的 `color.vignette` */
  readonly vignetteColor?: string;
};

/**
 * 舞台 / 背景容器。纯静态，无动效 —— 动效属于内容元素。
 * 同样是布局脚手架，故意不用 `Interactive.*`。
 *
 * 背景色、网格线、暗角的**颜色全部来自主题**（未传 prop 时取 `useTheme()`）——
 * 浅色主题上如果网格还是写死的白色，网格会直接看不见；暗角用纯黑则发脏。
 */
export const Stage: React.FC<Props> = ({
  children,
  background,
  grid = false,
  gridColor,
  gridSize = 80,
  vignette = false,
  vignetteColor,
}) => {
  const theme = useTheme();

  return (
    <AbsoluteFill style={{backgroundColor: background ?? theme.color.bg}}>
      {grid ? (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(to right, ${
              gridColor ?? theme.color.grid
            } 1px, transparent 1px), linear-gradient(to bottom, ${
              gridColor ?? theme.color.grid
            } 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
        />
      ) : null}
      {vignette ? (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, ${
              vignetteColor ?? theme.color.vignette
            } 100%)`,
          }}
        />
      ) : null}
      {children}
    </AbsoluteFill>
  );
};
