import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useFittedFontSize} from '../../guards/fitting';
import {ClampLines} from '../../guards/ClampLines';
import {useTheme} from '../../theme/context';
import {useMasterBox} from '../MasterContext';

type Props = {
  readonly value: string;
  /** 单位 / 后缀，如 `%` 或 `亿`。可选 */
  readonly unit?: string;
  readonly label: string;
  /** 补充说明。可选 */
  readonly note?: string;
};

/**
 * 数据版式：一个数字 + 说明。
 *
 * 槽契约（`LAYOUT_SPECS.stat`）：
 *   value  必填 · fit         ← 数字长度变化极大（3 位到 12 位），必须缩字号
 *   unit   可选 · fit
 *   label  必填 · fit
 *   note   可选 · clamp
 *
 * `value` 是字符串而不是 number —— 格式化（千分位、货币、正负号）属于内容层，
 * 不该让版式去猜。数字不换行，所以用单行 `fitText` 而非 `fitTextOnNLines`。
 *
 * 数字用 `font.mono` + `type.stat`，单位用 `type.subhead..heading`，分隔线用
 * `graphic.ruleThickness` 与 `graphic.blockRadius` —— 全部来自主题。
 */
export const StatLayout: React.FC<Props> = ({value, unit, label, note}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();

  const unitSize = useFittedFontSize({
    text: unit ?? '',
    withinWidth: box.contentWidth * 0.25,
    minFontSize: Math.round(theme.type.subhead * box.scale),
    maxFontSize: Math.round(theme.type.heading * box.scale),
    fontWeight: 600,
  });

  const valueSize = useFittedFontSize({
    text: value,
    // 数字与单位同排，所以要扣掉单位那一块的宽度
    withinWidth: box.contentWidth - (unit ? unitSize * 2.2 : 0),
    minFontSize: Math.round(theme.type.title * box.scale * 0.6),
    maxFontSize: Math.round(theme.type.stat * box.scale),
    fontWeight: 700,
  });

  const labelSize = useFittedFontSize({
    text: label,
    withinWidth: box.contentWidth * 0.8,
    minFontSize: Math.round(theme.type.body * box.scale * 0.8),
    maxFontSize: Math.round(theme.type.subhead * box.scale),
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
        gap: theme.space.gapTight,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 16,
        }}
      >
        <Interactive.Div
          name="Stat value"
          style={{
            color: theme.color.accent,
            fontFamily: theme.font.mono,
            fontSize: valueSize,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -2,
            opacity: interpolate(frame, [0, 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing,
            }),
            scale: interpolate(frame, [0, 26], [0.86, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing,
              output: 'perceptual-scale',
            }),
            transformOrigin: 'left bottom',
          }}
        >
          {value}
        </Interactive.Div>

        {unit ? (
          <Interactive.Div
            name="Stat unit"
            style={{
              color: theme.color.muted,
              fontFamily: theme.font.family,
              fontSize: unitSize,
              fontWeight: 600,
              opacity: interpolate(frame, [10, 28], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing,
              }),
            }}
          >
            {unit}
          </Interactive.Div>
        ) : null}
      </div>

      <div
        style={{
          height: theme.graphic.ruleThickness * box.scale,
          width: box.contentWidth * 0.34,
          borderRadius: theme.graphic.blockRadius * box.scale,
          backgroundColor: theme.color.rule,
          transformOrigin: 'left center',
          scale: interpolate(frame, [14, 34], ['0 1', '1 1'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      />

      <Interactive.Div
        name="Stat label"
        style={{
          color: theme.color.ink,
          fontFamily: theme.font.family,
          fontSize: labelSize,
          fontWeight: 500,
          opacity: interpolate(frame, [18, 36], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
          translate: interpolate(frame, [18, 36], ['0px 14px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      >
        {label}
      </Interactive.Div>

      {note ? (
        <div style={{maxWidth: box.contentWidth * 0.7}}>
          <ClampLines
            text={note}
            maxLines={2}
            fontSize={Math.round(theme.type.caption * box.scale)}
            delayInFrames={26}
            name="Stat note"
          />
        </div>
      ) : null}
    </div>
  );
};
