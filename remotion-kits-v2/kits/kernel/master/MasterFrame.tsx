import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {Stage} from '../components/Stage';
import {ThemeProvider, THEMES, THEME_IDS} from '../theme';
import type {Theme} from '../theme/types';
import {FooterRail} from './furniture/FooterRail';
import {Masthead} from './furniture/Masthead';
import {MasterBoxProvider} from './MasterContext';
import type {FurnitureConfig} from './types';

type Props = {
  readonly children: React.ReactNode;
  /** 换主题只需换这个 prop；版式与家具不用改一行 */
  readonly theme?: Theme;
  readonly furniture?: FurnitureConfig;
  readonly background?: string;
  readonly grid?: boolean;
  readonly vignette?: boolean;
  readonly contentStyle?: React.CSSProperties;
};

/**
 * 母版引擎。
 *
 * 渲染顺序与职责：
 *   1. 挂两个 provider —— 主题（`ThemeProvider`）与几何（`MasterBoxProvider`）
 *   2. `Stage` —— 背景（色 / 网格 / 暗角），网格与暗角的颜色也来自主题
 *   3. 内容区 —— 为家具**预留**上下内边距，`children` 放这里（通常是若干 `<Sequence>`）
 *   4. 固定家具 —— 报头带与页脚，整片常在，不参与场景入场动效
 *
 * **两条家具带的预留判据是「这一带上有没有东西」，不是「有没有某一件家具」**：
 *   - 报头带按 `masthead` **或** `headExtra` 预留；
 *   - 页脚带按 `footer` **或** `footExtra` 预留。
 * 只判其中一个，另一种组合就会把内容压住 —— 这是「家具与内容区不得重叠」的直接后果。
 * `headExtra` / `footExtra` 是**通用插槽**：类型包自己的家具挂在那里，内核不认识具体是哪一件。
 *
 * 家具画在内容之上，且不会与内容重叠 —— 内边距是按家具实际高度算的。
 * 几何与主题都通过 provider 下发，版式与家具据此测量、上色。
 */
export const MasterFrame: React.FC<Props> = ({
  children,
  theme = THEMES[THEME_IDS[0]],
  furniture,
  background,
  grid = false,
  vignette = false,
  contentStyle,
}) => {
  const {width, height} = useVideoConfig();
  // 安全区与字阶的基准是 1080；取宽高比的**较小值** —— 1920x1080 与 1080x1920
  // 都用 1:1 基准。基准值本身写在主题的 `safe` 里，内核不假设具体数字。
  // 用 width/1080 会把纵向值也放大（1920 宽 → 1.78 倍），版式整体偏大。
  const scale = Math.min(width / 1080, height / 1080);

  const insetX = Math.round(theme.safe.x * scale);
  const insetY = Math.round(theme.safe.y * scale);

  const hasHeader = Boolean(furniture?.masthead || furniture?.headExtra);
  const hasFooter = Boolean(furniture?.footer || furniture?.footExtra);

  const mastheadHeight = hasHeader ? Math.round(theme.space.mastheadHeight * scale) : 0;
  const footerHeight = hasFooter ? Math.round(theme.space.footerHeight * scale) : 0;
  const railReserve = furniture?.footer?.progress
    ? Math.round(theme.graphic.railThickness * scale) + 12
    : 0;

  const padTop = insetY + mastheadHeight;
  const padBottom = insetY + footerHeight + railReserve;

  const contentWidth = width - insetX * 2;
  const contentHeight = height - padTop - padBottom;

  return (
    <ThemeProvider theme={theme}>
      <MasterBoxProvider box={{scale, insetX, insetY, contentWidth, contentHeight}}>
        <Stage
          background={background ?? theme.color.bg}
          grid={grid}
          gridColor={theme.color.grid}
          vignette={vignette}
          vignetteColor={theme.color.vignette}
        >
          {/*
            内容盒用四个 inset 定位，**必须同时把 width/height 置 auto**。

            为什么：`AbsoluteFill` 底层是 `AbsoluteFillElement`，它内置
            `width: '100%'` / `height: '100%'`，并把传入的 style 展开在最后。
            而 CSS 过约束时 **width/height 会压过 right/bottom** —— 于是
            `top: 204 + bottom: 196 + height: 100%` 会得到超出画布的盒子，
            `left/right` 也会被 100% 宽度吃掉，内容直接右溢出。
          */}
          <AbsoluteFill
            style={{
              left: insetX,
              right: insetX,
              top: padTop,
              bottom: padBottom,
              width: 'auto',
              height: 'auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              ...contentStyle,
            }}
          >
            {children}
          </AbsoluteFill>

          {hasHeader ? (
            <Masthead
              title={furniture?.masthead?.title}
              meta={furniture?.masthead?.meta}
              extra={furniture?.headExtra}
              insetX={insetX}
              insetY={insetY}
              height={mastheadHeight}
            />
          ) : null}

          {hasFooter ? (
            <FooterRail
              left={furniture?.footer?.left}
              right={furniture?.footer?.right}
              extra={furniture?.footExtra}
              progress={furniture?.footer?.progress}
              insetX={insetX}
              insetY={insetY}
              height={footerHeight}
            />
          ) : null}
        </Stage>
      </MasterBoxProvider>
    </ThemeProvider>
  );
};
