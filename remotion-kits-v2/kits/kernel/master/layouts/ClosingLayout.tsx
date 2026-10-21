import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useFittedFontSize, useFittedLines} from '../../guards/fitting';
import {useTheme} from '../../theme/context';
import {useMasterBox} from '../MasterContext';

type Props = {
  readonly title: string;
  /** 下期预告 / 号召 / 署名。可选 */
  readonly meta?: string;
};

/**
 * 收束版式：一句总结 + 元信息。
 *
 * 槽契约（`LAYOUT_SPECS.closing`）：
 *   title  必填 · fit-n-lines
 *   meta   可选 · fit
 *
 * 上方那条强调块用 `graphic.accentBar` × `graphic.blockRadius`：前者决定粗细，后者决定
 * 方角还是胶囊。版式不关心具体是哪个主题 —— 也**不许在版式里提具体主题名**，
 * 否则这段代码会开始为某个主题做假设。
 */
export const ClosingLayout: React.FC<Props> = ({title, meta}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();

  const {fontSize: titleSize, lines: titleLines} = useFittedLines({
    text: title,
    maxLines: 3,
    maxBoxWidth: box.contentWidth,
    minFontSize: Math.round(theme.type.heading * box.scale),
    maxFontSize: Math.round(theme.type.title * box.scale),
    fontWeight: 700,
  });

  const metaSize = useFittedFontSize({
    text: meta ?? '',
    withinWidth: box.contentWidth,
    minFontSize: Math.round(theme.type.caption * box.scale),
    maxFontSize: Math.round(theme.type.body * box.scale),
    fontWeight: 500,
  });

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
        gap: theme.space.gap,
      }}
    >
      <div
        style={{
          height: theme.graphic.accentBar * box.scale,
          width: theme.graphic.accentBar * box.scale * 8,
          borderRadius: theme.graphic.blockRadius * box.scale,
          backgroundColor: theme.color.accent,
          transformOrigin: 'left center',
          scale: interpolate(frame, [0, 22], ['0 1', '1 1'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      />

      <div style={{display: 'flex', flexDirection: 'column'}}>
        {titleLines.map((line, index) => (
          <Interactive.Div
            key={`${index}-${line}`}
            name={`Closing line ${index + 1}`}
            style={{
              color: theme.color.ink,
              fontFamily: theme.font.family,
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.16,
              letterSpacing: -0.6,
              opacity: interpolate(frame, [8, 30], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing,
              }),
              translate: interpolate(frame, [8, 30], ['0px 24px', '0px 0px'], {
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
          name="Closing meta"
          style={{
            color: theme.color.muted,
            fontFamily: theme.font.mono,
            fontSize: metaSize,
            fontWeight: 500,
            letterSpacing: 0.8,
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
