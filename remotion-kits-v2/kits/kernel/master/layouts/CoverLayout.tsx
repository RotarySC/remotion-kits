import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useFittedFontSize, useFittedLines} from '../../guards/fitting';
import {useTheme} from '../../theme/context';
import {useMasterBox} from '../MasterContext';

type Props = {
  /** 眉题，几个字。可选 */
  readonly kicker?: string;
  readonly title: string;
  /** 日期 / 期号 / 来源。可选 */
  readonly meta?: string;
};

/**
 * 开篇版式：一句话立住主题。
 *
 * 槽契约（见 `master/types.ts` 的 `LAYOUT_SPECS.cover`）：
 *   kicker  可选 · fit
 *   title   必填 · fit-n-lines
 *   meta    可选 · fit
 *
 * 三段之间用主题里最松的一档间距（`space.gapLoose`）—— 开篇是全片最需要留白的一版。
 * 本文件**不含任何具体色值、字体名、字号**，全部来自 `useTheme()`。
 */
export const CoverLayout: React.FC<Props> = ({kicker, title, meta}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();

  const kickerSize = useFittedFontSize({
    text: kicker ?? '',
    withinWidth: box.contentWidth * 0.6,
    minFontSize: Math.round(theme.type.caption * box.scale),
    maxFontSize: Math.round(theme.type.subhead * box.scale),
    fontWeight: 600,
  });

  const {fontSize: titleSize, lines: titleLines} = useFittedLines({
    text: title,
    maxLines: 3,
    maxBoxWidth: box.contentWidth,
    minFontSize: Math.round(theme.type.heading * box.scale),
    maxFontSize: Math.round(theme.type.hero * box.scale),
    fontWeight: 700,
  });

  const metaSize = Math.round(theme.type.caption * box.scale);
  const easing = Easing.bezier(...theme.motion.enter);

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
        gap: theme.space.gapLoose,
      }}
    >
      {kicker ? (
        <Interactive.Div
          name="Cover kicker"
          style={{
            color: theme.color.accent,
            fontFamily: theme.font.mono,
            fontSize: kickerSize,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
            opacity: interpolate(frame, [2, 18], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing,
            }),
          }}
        >
          {kicker}
        </Interactive.Div>
      ) : null}

      <div style={{display: 'flex', flexDirection: 'column'}}>
        {titleLines.map((line, index) => (
          <Interactive.Div
            key={`${index}-${line}`}
            name={`Cover title line ${index + 1}`}
            style={{
              color: theme.color.ink,
              fontFamily: theme.font.family,
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1,
              opacity: interpolate(frame, [8, 30], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing,
              }),
              translate: interpolate(frame, [8, 30], ['0px 32px', '0px 0px'], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing,
              }),
            }}
          >
            {line}
          </Interactive.Div>
        ))}
      </div>

      {meta ? (
        <Interactive.Div
          name="Cover meta"
          style={{
            color: theme.color.muted,
            fontFamily: theme.font.mono,
            fontSize: metaSize,
            fontWeight: 500,
            letterSpacing: 1,
            opacity: interpolate(frame, [26, 44], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing,
            }),
          }}
        >
          {meta}
        </Interactive.Div>
      ) : null}
    </div>
  );
};
