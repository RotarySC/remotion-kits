import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ClampLines} from '../../../kernel/guards/ClampLines';
import {useFittedFontSize, useFittedLines} from '../../../kernel/guards/fitting';
import {useTheme} from '../../../kernel/theme/context';
import {warnIfStaggerOverflows} from '../../../kernel/guards/diagnostics';
import {useMasterBox} from '../../../kernel/master/MasterContext';
import {splitEntry} from '../../../kernel/master/slots';
import {staggerFrames} from '../stagger';

type Props = {
  readonly title: string;
  /** 每个节点 = `'时刻\t事件'`（TAB 分隔），最多 6 个 */
  readonly events: readonly string[];
  /** 补充说明。可选 */
  readonly note?: string;

  /**
   * **本期节奏**：逐条错开的帧数。省略 → 主题 `motion.stagger`。
   *
   * ⚠️ 主题那个值会**按场景时长收紧**（免得末条来不及出现）；**显式给的值不参与收紧、原样生效** ——
   * 收紧是系统对**自己的默认值**做的事，不是替调用方改他给的数（见 `references/master-contract.md`）。
   */
  readonly staggerInFrames?: number;
};

/**
 * **本类型特有版式：事件脉络** —— 一条**纵向**时间线从起点推演到当前。
 *
 * 槽契约（`LAYOUT_SPECS.timeline`）：
 *   title   必填 · fit-n-lines
 *   events  必填 · fit        ← 每个节点 = `'时刻\t事件'`
 *   note    可选 · clamp
 *
 * 为什么纵向而不是横向：节点的事件描述可能到 40 字，横向铺 6 列每列只有 290px，
 * 一列放不下就得缩字号 —— 纵向每行可用 `contentWidth − 时刻列`，40 字在正文号下也放得下。
 * 这类「形态决定方向」的判断属于版式，不该让内容去迁就。
 *
 * 三个版式共用的解析与时序在 `../slots`。
 */
export const TimelineLayout: React.FC<Props> = ({title, events, note, staggerInFrames}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const easing = Easing.bezier(...theme.motion.enter);
  const {scale, contentWidth} = box;

  const heading = useFittedLines({
    text: title,
    maxLines: 2,
    maxBoxWidth: contentWidth * 0.86,
    minFontSize: Math.round(theme.type.subhead * scale),
    maxFontSize: Math.round(theme.type.heading * scale),
  });

  const entries = events.map(splitEntry);

  const timeCol = Math.round(contentWidth * 0.14);
  const railCol = Math.max(
    Math.round(theme.graphic.accentBar * scale * 3.2),
    Math.round(28 * scale),
  );
  const bodyWidth = contentWidth - timeCol - railCol - Math.round(theme.space.gap * scale * 2);

  // 每行**同一个**字号：以最长的一条为准。
  // 不能用 `.map()` 里逐行调 hook —— hook 数量会随条数变化，违反 hook 规则。
  const longestBody = entries.reduce((acc, e) => (e.body.length > acc.length ? e.body : acc), '');
  const longestHead = entries.reduce((acc, e) => (e.head.length > acc.length ? e.head : acc), '');

  const bodySize = useFittedFontSize({
    text: longestBody,
    withinWidth: bodyWidth,
    minFontSize: Math.round(theme.type.caption * scale),
    maxFontSize: Math.round(theme.type.body * scale),
    fontWeight: 500,
  });

  const headSize = useFittedFontSize({
    text: longestHead,
    withinWidth: timeCol,
    minFontSize: Math.round(theme.type.caption * scale * 0.8),
    maxFontSize: Math.round(theme.type.caption * scale),
    fontWeight: 700,
  });

  // ⚠️ **显式给的节奏不参与收紧** —— 收紧是系统对**自己的默认值**做的事（见 `references/master-contract.md`）。
  const stagger =
    staggerInFrames ?? staggerFrames(theme.motion.stagger, entries.length, durationInFrames, 40);

  // T06 的判据：显式节奏若让**末条来不及出现**，喊一声（行为不变，只把静默变可见）。
  // 首条起始 14、入场长度 20 是本版式的内联值（`start = 14 + index * stagger`）。
  warnIfStaggerOverflows({
    who: 'TimelineLayout',
    stagger,
    count: entries.length,
    durationInFrames,
    lead: 14,
    enterDurationInFrames: 20,
  });
  const dot = Math.max(8, Math.round(theme.graphic.accentBar * scale * 1.7));
  const activeDot = Math.round(dot * 1.45);
  // 轨道是**结构线**，不是发丝线：取 `graphic.railThickness`（1px 直角主题给 3px，
  // 粗条主题给 6px）而不是 `ruleThickness`。抽帧抓到过差别 —— 用发丝粗细时
  // 深色主题下轨道直接看不见，时间线读起来像一份清单。
  const railThickness = Math.max(2, Math.round(theme.graphic.railThickness * scale));

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
        fontFamily: theme.font.family,
      }}
    >
      <div style={{display: 'flex', flexDirection: 'column', gap: Math.round(4 * scale)}}>
        {heading.lines.map((line, index) => (
          <Interactive.Div
            key={index}
            name={`Timeline title ${index + 1}`}
            style={{
              color: theme.color.ink,
              fontSize: heading.fontSize,
              fontWeight: 700,
              lineHeight: 1.18,
              letterSpacing: -0.6,
              opacity: interpolate(frame, [index * 4, index * 4 + 18], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing,
              }),
              translate: interpolate(
                frame,
                [index * 4, index * 4 + 20],
                ['0px 12px', '0px 0px'],
                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing},
              ),
            }}
          >
            {line}
          </Interactive.Div>
        ))}
      </div>

      <div style={{display: 'flex', flexDirection: 'column', width: '100%'}}>
        {entries.map((entry, index) => {
          const isFirst = index === 0;
          const isLast = index === entries.length - 1;
          const start = Math.round(14 + index * stagger);
          const dotSize = isLast ? activeDot : dot;

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: Math.round(theme.space.gap * scale),
                paddingTop: Math.round(theme.space.gapTight * scale * 0.55),
                paddingBottom: Math.round(theme.space.gapTight * scale * 0.55),
                opacity: interpolate(frame, [start, start + 18], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing,
                }),
                translate: interpolate(
                  frame,
                  [start, start + 20],
                  ['0px 10px', '0px 0px'],
                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing},
                ),
              }}
            >
              <div
                style={{
                  width: timeCol,
                  textAlign: 'right',
                  color: isLast ? theme.color.accent : theme.color.muted,
                  fontFamily: theme.font.mono,
                  fontSize: headSize,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.head}
              </div>

              {/*
                轨道列：一条竖线 + 一个节点。线在首行从节点中心往上不画、末行往下不画，
                这样时间线的两端都收在节点上，而不是悬空出去。
              */}
              <div
                style={{
                  position: 'relative',
                  width: railCol,
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    marginLeft: -Math.round(railThickness / 2),
                    top: isFirst ? '50%' : 0,
                    bottom: isLast ? '50%' : 0,
                    width: railThickness,
                    backgroundColor: theme.color.rule,
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    width: dotSize,
                    height: dotSize,
                    borderRadius: theme.graphic.blockRadius * scale,
                    backgroundColor: isLast ? theme.color.accent : theme.color.rule,
                    border: `${railThickness}px solid ${theme.color.accent}`,
                    transformOrigin: 'center center',
                    scale: interpolate(frame, [start + 2, start + 20], [0.4, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                      easing,
                      output: 'perceptual-scale',
                    }),
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  color: theme.color.ink,
                  fontSize: bodySize,
                  fontWeight: isLast ? 700 : 500,
                  lineHeight: 1.3,
                }}
              >
                {entry.body}
              </div>
            </div>
          );
        })}
      </div>

      {note ? (
        <div style={{maxWidth: contentWidth * 0.7}}>
          <ClampLines
            text={note}
            maxLines={1}
            fontSize={Math.round(theme.type.caption * scale)}
            delayInFrames={Math.round(14 + entries.length * stagger)}
            name="Timeline note"
          />
        </div>
      ) : null}
    </div>
  );
};
