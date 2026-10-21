import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useFittedFontSize, useFittedLines} from '../../guards/fitting';
import {useTheme} from '../../theme/context';
import {useMasterBox} from '../MasterContext';

type Props = {
  readonly text: string;
  /** 出处。可选 */
  readonly attribution?: string;
};

/**
 * 引述版式：一句话 + 出处。
 *
 * 槽契约（`LAYOUT_SPECS.quote`）：
 *   text         必填 · fit-n-lines  ← 引文必须完整，缩字号不截断
 *   attribution  可选 · fit
 *
 * 引号字号取 `type.hero`（主题里最大的那一档），引文取 `type.body..heading`，
 * 出处取 `type.caption..body` —— 三个层级都由主题的字阶决定。
 */
export const QuoteLayout: React.FC<Props> = ({text, attribution}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();

  // 引文留出左边的引号与缩进
  const textWidth = box.contentWidth * 0.86;

  const {fontSize: textSize, lines: textLines} = useFittedLines({
    text,
    maxLines: 4,
    maxBoxWidth: textWidth,
    minFontSize: Math.round(theme.type.body * box.scale),
    maxFontSize: Math.round(theme.type.heading * box.scale),
    fontWeight: 500,
  });

  const attributionSize = useFittedFontSize({
    text: attribution ?? '',
    withinWidth: textWidth,
    minFontSize: Math.round(theme.type.caption * box.scale * 0.9),
    maxFontSize: Math.round(theme.type.body * box.scale * 0.8),
    fontWeight: 500,
  });

  const easing = Easing.bezier(...theme.motion.enter);
  const markSize = Math.round(theme.type.hero * box.scale * 0.9);

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
        gap: theme.space.gapTight,
        maxWidth: box.contentWidth,
      }}
    >
      <div
        style={{
          color: theme.color.accent,
          fontFamily: theme.font.family,
          fontSize: markSize,
          fontWeight: 700,
          lineHeight: 0.6,
          height: markSize * 0.5,
          transformOrigin: 'left center',
          scale: interpolate(frame, [0, 20], [0.5, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
            output: 'perceptual-scale',
          }),
        }}
      >
        &ldquo;
      </div>

      <div style={{display: 'flex', flexDirection: 'column', paddingLeft: box.scale * 8}}>
        {textLines.map((line, index) => (
          <Interactive.Div
            key={`${index}-${line}`}
            name={`Quote line ${index + 1}`}
            style={{
              color: theme.color.ink,
              fontFamily: theme.font.family,
              fontSize: textSize,
              fontWeight: 500,
              lineHeight: 1.34,
              letterSpacing: -0.3,
              opacity: interpolate(frame, [6, 28], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing,
              }),
              translate: interpolate(frame, [6, 28], ['0px 20px', '0px 0px'], {
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

      {attribution ? (
        <Interactive.Div
          name="Quote attribution"
          style={{
            color: theme.color.muted,
            fontFamily: theme.font.mono,
            fontSize: attributionSize,
            fontWeight: 500,
            letterSpacing: 0.6,
            paddingLeft: box.scale * 8,
            opacity: interpolate(frame, [26, 44], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing,
            }),
          }}
        >
          {attribution}
        </Interactive.Div>
      ) : null}
    </div>
  );
};
