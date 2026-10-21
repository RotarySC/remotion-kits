import React from 'react';
import {Img, OffthreadVideo, useVideoConfig} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

/**
 * 帧坐标下的一个矩形（像素，与合成同坐标系）。
 *
 * 之所以是**公开契约**而不是内部类型：`MediaCard` 要「移到某处」，而组件在渲染路径里
 * **不许测量**（`component-contract.md` §6：补间里绝不调 `getBoundingClientRect` ——
 * 渲染器并行采样会失步）。所以「从哪来、到哪去」只能由调用方给出，两个矩形就是它的载体。
 */
export type MediaRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type Props = {
  /** 图片 / 视频地址。**给了它就忽略 `children`** */
  readonly src?: string;
  /** 媒体类型。**给了 `src` 就必须给** —— 不去猜扩展名（`a.png` 与 `a.png.mp4` 都合法） */
  readonly kind?: 'image' | 'video';
  /** 没有 `src` 时渲染的内容（占位画面 / 自绘 DOM） */
  readonly children?: React.ReactNode;
  /** 框宽（像素）。省略则取**安全区里放得下的最大 16:9** 的那个宽度 */
  readonly width?: number;
  /** 框高（像素）。省略则按 **16:9** 从框宽推出 */
  readonly height?: number;
  /** 内容怎么填进框。`cover` 裁掉多余、`contain` 留边（露出的边是 `background`） */
  readonly fit?: 'cover' | 'contain';
  /** 标签条主文案（如「联署名单」） */
  readonly label?: string;
  /** 标签条副文案（如来源域名 / 分数 / 日期）。省略则只显示主文案 */
  readonly source?: string;
  /** 标签条贴哪条边。**`MediaCard` 展开时会用它换边**（那是它多一个 `'auto'` 的原因） */
  readonly labelPlacement?: 'bottom' | 'top';
  /** 标签字号（像素）。省略则取框高的 5% —— 框会放大好几倍，固定字号在迷你态会溢出 */
  readonly labelFontSize?: number;
  /** 描边色。省略则取主题的 `color.accent` */
  readonly borderColor?: string;
  /** 描边粗细（像素）。省略则取主题的 `graphic.accentBar`（它本就是「强调框」的粗细） */
  readonly borderWidth?: number;
  /** 圆角（像素）。省略则取主题的 `graphic.blockRadius`（`bubble-pop` 会给到胶囊） */
  readonly radius?: number;
  /** 框底色 —— `fit: 'contain'` 时留边露出来的那块。省略则取主题的 `color.bg` */
  readonly background?: string;
};

/**
 * **多媒体框** —— 一个 16:9 的框，用来放图片、视频，或任何自绘内容。
 *
 * ## 为什么没有入场动效
 *
 * 套件里其它内容原语都有 `delayInFrames` / `enterDurationInFrames`，这个**故意没有**：
 * 它是**承载内容的框**，不是一段文字。什么时候出现、怎么出现，取决于它在版式里的位置 ——
 * 那是调用方的 `<Sequence>` 与 `MediaCard` 的 `focus` 该决定的事。
 * 组件不替调用方决定这件事，也不多出两个没人调的 prop。
 *
 * ## 尺寸与基准
 *
 * 默认尺寸 = **安全区里放得下的最大 16:9**，缩放基准与母版一致：`Math.min(width, height) / 1080`。
 *
 * ⚠️ **只按安全区的「宽度」算是不够的** —— 实测：1920×1080 上安全区内容区是 1760×880，
 * 而 1760 宽的 16:9 是 **990** 高，于是框**上下各越出 55px**、压进报头与页脚带里。
 * 安全区是硬契约，所以默认取**两个方向都放得下**的那个宽度（这里 1564×880）。
 * 要更大的框就显式给 `width` —— 那时越界是调用方的选择。
 *
 * **不要用 `width / 1080`** —— 1920 宽会得到 1.78 倍，安全区被撑开（`SafeArea` 踩过）。
 *
 * ## 颜色全部来自主题
 *
 * 描边取 `color.accent`、粗细取 `graphic.accentBar`、圆角取 `graphic.blockRadius`。
 * 标签条用**反相**配色：底 = `color.ink`、主文案 = `color.bg`、副文案 = `color.accent` ——
 * 所以深色主题上是白底深字、浅色主题上是深底白字，两边都读得清。
 *
 * ## 视频是**帧驱动**的
 *
 * `kind: 'video'` 走 `<OffthreadVideo>`（不是原生 `<video>`）：它在渲染时按帧取画面，
 * 所以同一帧永远得到同一张图。原生 `<video>` 会让抽帧结果依赖真实时间，**不可复现**。
 */
export const MediaStage: React.FC<Props> = ({
  src,
  kind,
  children,
  width,
  height,
  fit = 'cover',
  label,
  source,
  labelPlacement = 'bottom',
  labelFontSize,
  borderColor,
  borderWidth,
  radius,
  background,
}) => {
  const theme = useTheme();
  const {width: canvasW, height: canvasH} = useVideoConfig();
  const scale = Math.min(canvasW / 1080, canvasH / 1080);

  // 省略尺寸时的默认：**安全区里放得下的最大 16:9**。
  // 两个方向都要看 —— 只按宽度算的话，1760 宽的 16:9 有 990 高，而安全区只有 880 高。
  const safeW = canvasW - 2 * theme.safe.x * scale;
  const safeH = canvasH - 2 * theme.safe.y * scale;
  const w = width ?? Math.round(Math.min(safeW, (safeH * 16) / 9));
  const h = height ?? Math.round((w * 9) / 16);

  const bw = borderWidth ?? theme.graphic.accentBar;
  const r = radius ?? theme.graphic.blockRadius;
  const fs = labelFontSize ?? Math.max(11, Math.round(h * 0.05));

  const media = src ? (
    kind === 'video' ? (
      <OffthreadVideo src={src} style={{width: '100%', height: '100%', objectFit: fit}} />
    ) : (
      <Img src={src} style={{width: '100%', height: '100%', objectFit: fit}} />
    )
  ) : (
    children
  );

  const bar =
    label || source ? (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          [labelPlacement]: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: Math.round(fs * 0.7),
          padding: `${Math.round(fs * 0.32)}px ${Math.round(fs * 0.7)}px`,
          backgroundColor: theme.color.ink,
          fontFamily: theme.font.family,
          fontSize: fs,
          lineHeight: 1.25,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {label ? (
          <span style={{color: theme.color.bg, fontWeight: 700}}>{label}</span>
        ) : null}
        {source ? (
          <span style={{color: theme.color.accent, fontFamily: theme.font.mono}}>{source}</span>
        ) : null}
      </div>
    ) : null;

  return (
    <div
      style={{
        // 块级：根盒子**不承载外观**，所以照容器办（'auto'）—— 被撑也不变形，见 `guards/placement.ts`
        ...placeSelf('auto'),
        position: 'relative',
        width: w,
        height: h,
        boxSizing: 'border-box',
        border: `${bw}px solid ${borderColor ?? theme.color.accent}`,
        borderRadius: r,
        backgroundColor: background ?? theme.color.bg,
        overflow: 'hidden',
      }}
    >
      <div style={{position: 'absolute', inset: 0, display: 'flex'}}>{media}</div>
      {bar}
    </div>
  );
};
