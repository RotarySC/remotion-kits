import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  /** 标签文字。**短** —— 两三个字到六七个字；一整句话不是标签，去用 `Subtitle` */
  readonly text: string;
  /**
   * 分量，从重到轻：
   *   `solid`   实底（主色填充 + 底色文字）—— 最重，一屏只该有一两个
   *   `tint`    淡底（主色的一层半透明）+ 主色文字 —— 默认
   *   `outline` 透明底 + 主色描边 + 主色文字
   *   `muted`   中性（rule 描边 + muted 文字）—— 次要信息，不抢眼
   */
  readonly tone?: 'solid' | 'tint' | 'outline' | 'muted';
  /** 字号（像素）。内边距按它等比推出，所以**这一个旋钮决定整枚标签的大小** */
  readonly fontSize?: number;
  /** 圆角（像素）。省略取主题的 `graphic.blockRadius` —— 方角还是胶囊跟着主题走 */
  readonly radius?: number;
  /** 主色。省略取主题 `color.accent`（`tone: 'muted'` 时取 `color.muted`） */
  readonly color?: string;
  /** 入场延迟（帧）—— 一排标签靠它错开，**不要**用 `<Sequence>` 的时长表达延迟 */
  readonly delayInFrames?: number;
  /** 入场长度（帧）。不是 `<Sequence>` 的 `durationInFrames` */
  readonly enterDurationInFrames?: number;
  /** 透传给 `Interactive.Span` 的 Sequence 起始帧。**入场也从这一帧起算**，见 `localFrame` */
  readonly from?: number;
  /** Studio 时间线显示名，硬编码 */
  readonly name?: string;
};

/**
 * 文字标签 —— 一小段文字装在一个盒子里的**行内片段**（对齐 HTML 里 `<span class="chip">`）。
 *
 * ## 为什么它是 `inline`
 *
 * 标签天生**成排出现**（「已证实 / 高危 / 本地打包」），而且它自己不占一整行 ——
 * 和 `Emphasis` 同理：把标签当成一个 HTML 标签挂到页面上，它该是 `inline-block`。
 * 所以**成排的排版是调用方的事**：把若干枚标签放进一个 `display: flex` 的行里，
 * 用各自的 `delayInFrames` 错开入场。组件不替调用方决定一排几枚、要不要换行。
 *
 * ## 四种分量
 *
 * 不是四种颜色，是**四个重量档**：`solid` 实底 → `tint` 淡底 → `outline` 描边 →
 * `muted` 中性。同一屏里混用才对（全部用 `solid` 等于没有重点）。
 *
 * ## 两个实现细节
 *
 * 1. **淡底不用颜色运算**，而是一层绝对定位的底色 + `opacity` —— 与 `Emphasis`
 *    的高亮同一手法。主题给的是十六进制字符串，组件不该去做 `color-mix` 那类推算。
 * 2. **四种分量的盒子几何必须完全一致**：描边的那两种会把盒子撑大 2px，
 *    于是同一排里它们比实底的那两枚高一截。所以实底 / 淡底也写一条
 *    `1px solid transparent` 占位 —— 边框宽度参与布局，这不是装饰。
 *
 * 颜色 / 字族 / 圆角全部来自 `useTheme()`；字号是内联默认值（Studio 可编辑）。
 */
export const TextTag: React.FC<Props> = ({
  text,
  tone = 'tint',
  fontSize = 28,
  radius,
  color,
  delayInFrames = 0,
  enterDurationInFrames = 18,
  from,
  name = 'Text tag',
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

  const tagRadius = radius ?? theme.graphic.blockRadius;
  const main = color ?? (tone === 'muted' ? theme.color.muted : theme.color.accent);
  const edge = tone === 'muted' ? theme.color.rule : main;

  const opacity = interpolate(
    localFrame,
    [delayInFrames, delayInFrames + enterDurationInFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  // 「弹出来」：从 0.86 长到 1，带一点回弹。**均匀缩放**（两个轴一起），
  // 所以带 `perceptual-scale` —— 一维生长（`'0 1' → '1 1'`）才不该带它。
  const scale = interpolate(
    localFrame,
    [delayInFrames, delayInFrames + enterDurationInFrames],
    [0.86, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.back(1.4)),
      output: 'perceptual-scale',
    },
  );

  const padX = Math.round(fontSize * 0.72);
  const padY = Math.round(fontSize * 0.24);

  return (
    <Interactive.Span
      name={name}
      from={from}
      style={{
        // 行内片段：**盒子就是这枚标签**，所以它声明「按内容、居中」——
        // 被 `align-items: stretch` 拉满就等于把它拉成一块色板（T04 实测 286x150）。
        // 组里显式给了 `align` 时，那 一行仍然赢（变量见 `placement.ts`）。
        ...placeSelf('center'),
        position: 'relative',
        display: 'inline-block',
        whiteSpace: 'nowrap',
        padding: `${padY}px ${padX}px`,
        borderRadius: tagRadius,
        fontFamily: theme.font.family,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: 0.5,
        opacity,
        scale,
        // 四种分量的盒子几何一致 —— 见文件头第 2 条
        backgroundColor: tone === 'solid' ? main : undefined,
        color: tone === 'solid' ? theme.color.bg : main,
        border: `1px solid ${tone === 'solid' || tone === 'tint' ? 'transparent' : edge}`,
      }}
    >
      {tone === 'tint' ? (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: main,
            opacity: 0.16,
            borderRadius: tagRadius,
          }}
        />
      ) : null}

      <span style={{position: 'relative'}}>{text}</span>
    </Interactive.Span>
  );
};
