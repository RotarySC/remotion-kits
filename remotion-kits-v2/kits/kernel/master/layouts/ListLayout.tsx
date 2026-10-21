import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useFittedFontSize} from '../../guards/fitting';
import {warnIfStaggerOverflows} from '../../guards/diagnostics';
import {useTheme} from '../../theme/context';
import {useMasterBox} from '../MasterContext';
import {splitEntry} from '../slots';

type Props = {
  readonly title: string;
  readonly items: readonly string[];

  /**
   * **本期节奏**：逐条错开的帧数。省略 → 主题 `motion.stagger`。
   *
   * ⚠️ 主题那个值会**按场景时长收紧**（免得末条来不及出现）；**显式给的值不参与收紧、原样生效** ——
   * 收紧是系统对**自己的默认值**做的事，不是替调用方改他给的数（见 `references/master-contract.md`）。
   */
  readonly staggerInFrames?: number;
};

/**
 * 条目清单版式：一个标题 + 若干条。
 *
 * 槽契约（`LAYOUT_SPECS.list`）：
 *   title  必填 · fit
 *   items  必填 · fit（逐条自适应字号 —— 条目长短不一时靠它撑住版式）
 *
 * 条目数变化时，靠 `delayInFrames` 的错开自然铺开；条数多则整体更紧凑
 * （`gap` 按条数收窄），这是「模板化出片」避免溢出的关键一手。
 *
 * 标记块的宽 / 圆角 / 颜色分别来自 `graphic.accentBar`、`graphic.blockRadius`、
 * `color.accent` —— 方角 ↔ 胶囊是主题身份的一部分，不能写死在这里。
 */
export const ListLayout: React.FC<Props> = ({title, items, staggerInFrames}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();

  // 在 <Sequence> 内，`useVideoConfig().durationInFrames` 返回的是**该序列的时长**
  // （Remotion 源码 use-unsafe-video-config.ts：`durationInFrames: ctxDuration ?? ...`）。
  // 据此把错开间隔收紧到塞得进去 —— 否则 8 条清单塞进 60 帧的场景时，
  // 后几条永远来不及出现（抽帧验证抓到的就是这个）。
  const {durationInFrames} = useVideoConfig();
  const lead = 14;
  const tail = 18;
  // ⚠️ **显式给的节奏不参与收紧** —— 收紧是系统对**自己的默认值**做的事，
  // 不是替调用方改他给的数（硬规则见 `references/component-contract.md` 第 5 节）。
  const stagger =
    staggerInFrames ??
    (items.length > 1
      ? Math.max(
          2,
          Math.min(
            theme.motion.stagger,
            Math.floor((durationInFrames - lead - tail) / (items.length - 1)),
          ),
        )
      : theme.motion.stagger);

  // T06 的判据：显式节奏若让**末条来不及出现**，喊一声（行为不变，只把静默变可见）。
  // 首条起始 `lead`、入场长度 18 都是本版式的内联值 —— 诊断不替版式假设它们。
  warnIfStaggerOverflows({
    who: 'ListLayout',
    stagger,
    count: items.length,
    durationInFrames,
    lead,
    enterDurationInFrames: 18,
  });

  const titleSize = useFittedFontSize({
    text: title,
    withinWidth: box.contentWidth,
    minFontSize: Math.round(theme.type.subhead * box.scale),
    maxFontSize: Math.round(theme.type.heading * box.scale),
    fontWeight: 700,
  });

  // 条数越多，行距越紧，保证整体落在内容区内
  const density = items.length > 6 ? 0.62 : items.length > 4 ? 0.78 : 1;
  const gap = Math.round(theme.space.gapTight * box.scale * density);

  /**
   * **`lines` 槽的 TAB 编码必须在这里拆开。**
   *
   * 缺陷与根因（真实片子的抽帧抓到，随后回写到这里）：
   * 条目的文案按契约写成 `'主字段\t说明'`，但早先这里直接把整条字符串交给浏览器渲染
   * —— HTML 把 TAB 塌缩成一个空格，于是「本地打包 据排查：客户端扫描工作区…」
   * 被读成**一句话**，主字段与说明的区别在视觉上完全消失。
   *
   * 根因**不在文案**，在于：本版式的 `items` 是 `lines` 槽，却从未调用 `splitEntry`。
   * 本套件里**只有这一个** `lines` 槽版式 —— 没有第二个版式能替它暴露这件事，
   * 所以它一直是静默的。这也正是演示合成必须**真的演练带主字段的条目**的原因：
   * 那是唯一能看见这条分支的地方。
   *
   * 没有分隔符时 `head` 为空，此时退回**单列整宽**（不渲染空的主字段列），
   * 所以「没有主字段的普通清单」与「有主字段的对照清单」都能用同一版式。
   */
  const entries = items.map(splitEntry);
  const hasHead = entries.some((entry) => entry.head.length > 0);
  const headColWidth = Math.round(box.contentWidth * 0.26);
  const markerPitch = theme.graphic.accentBar * box.scale * 3;
  const rowGap = 20;

  // 字号按**最长的那个渲染片段**算：有主字段时两块分栏，没主字段时整条整宽
  const longestFragment = entries.reduce((longest, entry) => {
    const candidates = hasHead ? [entry.body, entry.head] : [entry.body];
    return candidates.reduce((acc, fragment) => (fragment.length > acc.length ? fragment : acc), longest);
  }, '');

  /**
   * 度量盒宽必须等于**正文实际渲染的盒宽**。
   *
   * 有主字段时正文列被主字段列挤窄了 `headColWidth + rowGap`；
   * 若仍按整宽去测，护栏会选出一个偏大的字号，浏览器再按真实盒宽重新折行
   * —— 这正是 `HeadlineLayout` 踩过的同一个坑（见 `master-contract.md` 第 5 节：
   * 「护栏测的宽度必须与文本实际渲染的盒子一致」）。
   */
  const bodyWidth = hasHead
    ? box.contentWidth - markerPitch - headColWidth - rowGap
    : box.contentWidth - markerPitch;

  const itemSize = useFittedFontSize({
    text: longestFragment,
    withinWidth: hasHead ? Math.min(bodyWidth, headColWidth) : bodyWidth,
    minFontSize: Math.round(theme.type.caption * box.scale * 1.2),
    maxFontSize: Math.round(theme.type.body * box.scale * density),
    fontWeight: 400,
  });

  const easing = Easing.bezier(...theme.motion.enter);
  const markerWidth = theme.graphic.accentBar * box.scale;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: theme.space.gap,
      }}
    >
      <Interactive.Div
        name="List title"
        style={{
          color: theme.color.ink,
          fontFamily: theme.font.family,
          fontSize: titleSize,
          fontWeight: 700,
          letterSpacing: -0.4,
          opacity: interpolate(frame, [0, 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
          translate: interpolate(frame, [0, 18], ['-20px 0px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      >
        {title}
      </Interactive.Div>

      <div style={{display: 'flex', flexDirection: 'column', gap}}>
        {entries.map((entry, index) => {
          const start = lead + index * stagger;

          return (
            <Interactive.Div
              key={`${index}-${entry.head}-${entry.body}`}
              name={`List item ${index + 1}`}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 20,
                opacity: interpolate(frame, [start, start + 18], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing,
                }),
                translate: interpolate(frame, [start, start + 18], ['-18px 0px', '0px 0px'], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing,
                }),
              }}
            >
              <div
                style={{
                  width: markerWidth,
                  height: itemSize * 0.5,
                  marginTop: itemSize * 0.34,
                  flexShrink: 0,
                  borderRadius: theme.graphic.blockRadius * box.scale,
                  backgroundColor: theme.color.accent,
                  transformOrigin: 'left center',
                  scale: interpolate(frame, [start, start + 18], ['0 1', '1 1'], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing,
                  }),
                }}
              />

              {/*
                主字段列：有主字段时才渲染。右对齐 + 等宽 + 强调色 ——
                与 `TimelineLayout` 的时刻列同一套语言，因为语义相同（「这条属于什么」）。
                说明列吃掉剩余宽度，两条之间的分栏让「主字段 ≠ 说明」一眼可见。
              */}
              {hasHead && entry.head ? (
                <Interactive.Div
                  name={`List item ${index + 1} head`}
                  style={{
                    width: headColWidth,
                    flexShrink: 0,
                    color: theme.color.accent,
                    fontFamily: theme.font.mono,
                    fontSize: itemSize * 0.92,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    letterSpacing: 0.2,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.head}
                </Interactive.Div>
              ) : null}

              <div
                style={{
                  flex: 1,
                  color: theme.color.ink,
                  fontFamily: theme.font.family,
                  fontSize: itemSize,
                  fontWeight: 400,
                  lineHeight: 1.4,
                }}
              >
                {entry.body}
              </div>
            </Interactive.Div>
          );
        })}
      </div>
    </div>
  );
};
