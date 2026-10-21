import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useTheme} from '../theme/context';

type Props = {
  readonly children: React.ReactNode;
  /** 左右内边距；省略则取主题的 `safe.x` 并按画布缩放 */
  readonly insetX?: number;
  /** 上下内边距；省略则取主题的 `safe.y` 并按画布缩放 */
  readonly insetY?: number;
  readonly align?: 'top' | 'center' | 'bottom';
  readonly style?: React.CSSProperties;
};

/**
 * 安全区容器。
 *
 * 这是布局脚手架，不是内容元素 —— 故意**不用** `Interactive.*`，免得时间线被容器塞满。
 * 内容元素（Title / Quote / …）才应该是可选中、可拖拽的。
 *
 * 基准与母版一致：`Math.min(width, height) / 1080`。**不要用 `width / 1080`** ——
 * 1920 宽会得到 1.78 倍，安全区被撑到 143px，画面留白失控（抽帧验证抓到过）。
 * 基准值来自主题（`safe.x` / `safe.y`），未套母版时也能用。
 */
export const SafeArea: React.FC<Props> = ({
  children,
  insetX,
  insetY,
  align = 'center',
  style,
}) => {
  const theme = useTheme();
  const {width, height} = useVideoConfig();
  const scale = Math.min(width / 1080, height / 1080);

  const x = insetX ?? Math.round(theme.safe.x * scale);
  const y = insetY ?? Math.round(theme.safe.y * scale);

  const justify = align === 'top' ? 'flex-start' : align === 'bottom' ? 'flex-end' : 'center';

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        paddingLeft: x,
        paddingRight: x,
        paddingTop: y,
        paddingBottom: y,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
