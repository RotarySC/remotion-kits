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
  readonly topic: string;
  /** 每方 = `'主体\t说法'`（TAB 分隔），2–3 方 */
  readonly sides: readonly string[];
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
 * **本类型特有版式：各方说法** —— 一个议题 + 若干方立场**并列对照**。
 *
 * 槽契约（`LAYOUT_SPECS.stance`）：
 *   topic  必填 · fit-n-lines
 *   sides  必填 · fit        ← 每方 = `'主体\t说法'`
 *   note   可选 · clamp
 *
 * 并列而不是逐条：这个版式的信息就是「**对照**」—— 谁和谁不一致。
 * 竖排成清单会让读者只能记住最后一条；并排列在一起，差异是眼睛直接看到的。
 * 分隔用**竖线**（`rule` 色）而不是边框盒子 —— 盒子会让每一方看起来是独立的卡片，
 * 竖线才表示「同一张桌子上的几方」。
 */
export const StanceLayout: React.FC<Props> = ({topic, sides, note, staggerInFrames}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const easing = Easing.bezier(...theme.motion.enter);
  const {scale, contentWidth} = box;

  const heading = useFittedLines({
    text: topic,
    maxLines: 2,
    maxBoxWidth: contentWidth * 0.84,
    minFontSize: Math.round(theme.type.subhead * scale),
    maxFontSize: Math.round(theme.type.heading * scale),
  });

  const entries = sides.map(splitEntry);
  const count = Math.max(1, entries.length);

  const columnGap = Math.round(theme.space.gap * scale);
  const divider = Math.max(1, Math.round(theme.graphic.ruleThickness * scale));
  // 每方一列，竖线占 count − 1 条
  const columnWidth = Math.floor(
    (contentWidth - columnGap * (count - 1) - divider * (count - 1)) / count,
  );

  const longestSide = entries.reduce((acc, e) => (e.body.length > acc.length ? e.body : acc), '');
  const longestName = entries.reduce((acc, e) => (e.head.length > acc.length ? e.head : acc), '');

  // 字数受列宽限制：方数越多，同样的字数要用越小的字号 —— 护栏按最长的一条算一次，
  // 所有列共用（`.map()` 里不能逐列调 hook）。
  const sideSize = useFittedFontSize({
    text: longestSide,
    withinWidth: columnWidth * 0.94,
    minFontSize: Math.round(theme.type.caption * scale * 1.05),
    maxFontSize: Math.round(theme.type.body * scale),
    fontWeight: 500,
  });

  const nameSize = useFittedFontSize({
    text: longestName,
    withinWidth: columnWidth * 0.94,
    minFontSize: Math.round(theme.type.subhead * scale * 0.7),
    maxFontSize: Math.round(theme.type.subhead * scale),
    fontWeight: 700,
  });

  // ⚠️ **显式给的节奏不参与收紧** —— 收紧是系统对**自己的默认值**做的事（见 `references/master-contract.md`）。
  const stagger =
    staggerInFrames ?? staggerFrames(theme.motion.stagger, count, durationInFrames, 40);

  // T06 的判据：显式节奏若让**末条来不及出现**，喊一声（行为不变，只把静默变可见）。
  // 首条起始 16、入场长度 22 是本版式的内联值（`start = 16 + index * stagger`）。
  warnIfStaggerOverflows({
    who: 'StanceLayout',
    stagger,
    count,
    durationInFrames,
    lead: 16,
    enterDurationInFrames: 22,
  });

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
            name={`Stance topic ${index + 1}`}
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

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: columnGap,
          width: '100%',
        }}
      >
        {entries.map((entry, index) => {
          const start = Math.round(16 + index * stagger);

          return (
            <React.Fragment key={index}>
              {index > 0 ? (
                <div
                  style={{
                    width: divider,
                    alignSelf: 'stretch',
                    backgroundColor: theme.color.rule,
                    borderRadius: theme.graphic.blockRadius * scale,
                    transformOrigin: 'center center',
                    scale: interpolate(frame, [start - 4, start + 12], ['1 0', '1 1'], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                      easing,
                    }),
                  }}
                />
              ) : null}

              <div
                style={{
                  width: columnWidth,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: Math.round(theme.space.gapTight * scale * 0.7),
                  opacity: interpolate(frame, [start, start + 20], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing,
                  }),
                  translate: interpolate(
                    frame,
                    [start, start + 22],
                    ['0px 16px', '0px 0px'],
                    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing},
                  ),
                }}
              >
                <Interactive.Div
                  name={`Stance side ${index + 1} name`}
                  style={{
                    color: theme.color.accent,
                    fontSize: nameSize,
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  {entry.head}
                </Interactive.Div>

                <div
                  style={{
                    height: Math.max(1, Math.round(theme.graphic.accentBar * scale * 0.5)),
                    width: Math.round(columnWidth * 0.3),
                    borderRadius: theme.graphic.blockRadius * scale,
                    backgroundColor: theme.color.accent,
                    transformOrigin: 'left center',
                    scale: interpolate(frame, [start + 4, start + 22], ['0 1', '1 1'], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                      easing,
                    }),
                  }}
                />

                <Interactive.Div
                  name={`Stance side ${index + 1} text`}
                  style={{
                    color: theme.color.ink,
                    fontSize: sideSize,
                    fontWeight: 500,
                    lineHeight: 1.38,
                  }}
                >
                  {entry.body}
                </Interactive.Div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {note ? (
        <div style={{maxWidth: contentWidth * 0.7}}>
          <ClampLines
            text={note}
            maxLines={1}
            fontSize={Math.round(theme.type.caption * scale)}
            delayInFrames={Math.round(16 + count * stagger)}
            name="Stance note"
          />
        </div>
      ) : null}
    </div>
  );
};
