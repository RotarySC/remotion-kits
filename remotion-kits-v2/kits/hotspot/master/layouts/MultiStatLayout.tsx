import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ClampLines} from '../../../kernel/guards/ClampLines';
import {useFittedFontSize} from '../../../kernel/guards/fitting';
import {useTheme} from '../../../kernel/theme/context';
import {warnIfStaggerOverflows} from '../../../kernel/guards/diagnostics';
import {useMasterBox} from '../../../kernel/master/MasterContext';
import {splitEntry} from '../../../kernel/master/slots';
import {staggerFrames} from '../stagger';

type Props = {
  readonly label: string;
  /** 每个 = `'数值\t说明'`（TAB 分隔），2–4 个 */
  readonly items: readonly string[];
  /** 共同单位 / 后缀。可选 */
  readonly unit?: string;
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
 * **本类型特有版式：多个数字并列** —— 一组数字共同说明一件事。
 *
 * 槽契约（`LAYOUT_SPECS['multi-stat']`）：
 *   label  必填 · fit
 *   items  必填 · fit        ← 每个 = `'数值\t说明'`
 *   unit   可选 · fit
 *   note   可选 · clamp
 *
 * 与基座的 `stat`（一个数字占满一屏）是**两种信息形态**，不是同一件事的两种排版：
 * `stat` 说的是「这个数字很大」，`multi-stat` 说的是「这几个数字放一起能看出趋势」。
 * 所以要横排、要可比较、要不让任何一个抢走注意力 —— 因此所有数字**共用一个字号**
 * （按最长的那个定），而不是各自撑满自己的格子。
 *
 * 数值仍是字符串：格式化（千分位、百分号、正负号）属于内容层，不该让版式去猜
 * —— 与 `StatLayout` 同一条约定。
 */
export const MultiStatLayout: React.FC<Props> = ({label, items, unit, note, staggerInFrames}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const easing = Easing.bezier(...theme.motion.enter);
  const {scale, contentWidth} = box;

  const entries = items.map(splitEntry);
  const count = Math.max(1, entries.length);

  const columnGap = Math.round(theme.space.gap * scale);
  const divider = Math.max(1, Math.round(theme.graphic.ruleThickness * scale));
  const cellWidth = Math.floor(
    (contentWidth - columnGap * (count - 1) - divider * (count - 1)) / count,
  );

  const labelSize = useFittedFontSize({
    text: label,
    withinWidth: contentWidth * 0.86,
    minFontSize: Math.round(theme.type.subhead * scale),
    maxFontSize: Math.round(theme.type.heading * scale),
    fontWeight: 700,
  });

  const unitSize = useFittedFontSize({
    text: unit ?? '',
    withinWidth: cellWidth * 0.22,
    minFontSize: Math.round(theme.type.caption * scale),
    maxFontSize: Math.round(theme.type.subhead * scale),
    fontWeight: 600,
  });

  // 所有数字共用一个字号：取最长的一个。各自撑满会让小数字被放大成假的重点。
  const longestValue = entries.reduce((acc, e) => (e.head.length > acc.length ? e.head : acc), '');
  const longestCaption = entries.reduce((acc, e) => (e.body.length > acc.length ? e.body : acc), '');

  const valueSize = useFittedFontSize({
    text: longestValue,
    withinWidth: cellWidth * 0.94 - (unit ? unitSize * 2.2 : 0),
    minFontSize: Math.round(theme.type.heading * scale * 0.8),
    maxFontSize: Math.round(theme.type.stat * scale),
    fontWeight: 700,
  });

  const captionSize = useFittedFontSize({
    text: longestCaption,
    withinWidth: cellWidth * 0.94,
    minFontSize: Math.round(theme.type.caption * scale),
    maxFontSize: Math.round(theme.type.body * scale * 0.92),
    fontWeight: 500,
  });

  // ⚠️ **显式给的节奏不参与收紧** —— 收紧是系统对**自己的默认值**做的事（见 `references/master-contract.md`）。
  const stagger =
    staggerInFrames ?? staggerFrames(theme.motion.stagger, count, durationInFrames, 40);

  // T06 的判据：显式节奏若让**末条来不及出现**，喊一声（行为不变，只把静默变可见）。
  // 首条起始 14、入场长度 22 是本版式的内联值（`start = 14 + index * stagger`）。
  warnIfStaggerOverflows({
    who: 'MultiStatLayout',
    stagger,
    count,
    durationInFrames,
    lead: 14,
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
      <Interactive.Div
        name="Multi-stat label"
        style={{
          color: theme.color.ink,
          fontSize: labelSize,
          fontWeight: 700,
          lineHeight: 1.18,
          letterSpacing: -0.6,
          opacity: interpolate(frame, [0, 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
          translate: interpolate(frame, [0, 20], ['0px 12px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      >
        {label}
      </Interactive.Div>

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
          const start = Math.round(14 + index * stagger);

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
                  width: cellWidth,
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
                    ['0px 18px', '0px 0px'],
                    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing},
                  ),
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: Math.round(10 * scale),
                  }}
                >
                  <Interactive.Div
                    name={`Multi-stat ${index + 1} value`}
                    style={{
                      color: theme.color.accent,
                      fontFamily: theme.font.mono,
                      fontSize: valueSize,
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: -2,
                      transformOrigin: 'left bottom',
                      scale: interpolate(frame, [start, start + 22], [0.88, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                        easing,
                        output: 'perceptual-scale',
                      }),
                    }}
                  >
                    {entry.head}
                  </Interactive.Div>

                  {unit ? (
                    <div
                      style={{
                        color: theme.color.muted,
                        fontSize: unitSize,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {unit}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    height: Math.max(1, Math.round(theme.graphic.accentBar * scale * 0.5)),
                    width: Math.round(cellWidth * 0.34),
                    borderRadius: theme.graphic.blockRadius * scale,
                    backgroundColor: theme.color.rule,
                    transformOrigin: 'left center',
                    scale: interpolate(frame, [start + 6, start + 24], ['0 1', '1 1'], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                      easing,
                    }),
                  }}
                />

                <Interactive.Div
                  name={`Multi-stat ${index + 1} caption`}
                  style={{
                    color: theme.color.muted,
                    fontSize: captionSize,
                    fontWeight: 500,
                    lineHeight: 1.34,
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
            delayInFrames={Math.round(14 + count * stagger)}
            name="Multi-stat note"
          />
        </div>
      ) : null}
    </div>
  );
};
