import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../../../kernel/theme/context';
import {useMasterBox} from '../../../kernel/master/MasterContext';

type Props = {
  /** 如「事件第 3 天」 */
  readonly elapsed: string;
  /** 如「2026-09-18 14:20 更新」 */
  readonly updatedAt: string;
  /** 阶段标签，如「发酵期」。可选 */
  readonly phase?: string;
};

/**
 * **本类型特有家具**：事件当前时间戳。
 *
 * 为什么它是家具而不是场景内容：热点是**在推进的** —— 「第几天 / 最后更新 / 处在哪个阶段」
 * 整片每一帧都成立，不随场景变。按母版契约第 2 节，**整片常在的元素必须由母版渲染一次**，
 * 否则每场戏都会「重新出现」一次。
 *
 * 只消费主题已有的维度，**没有引入任何新字段**：
 *   - 色：`accent` / `furniture`，胶囊底用 `bg` 当文字色（深浅主题下都保证对比度）；
 *   - 字：`font.mono` + `type.caption`（时间戳属于元信息，用等宽更清楚）；
 *   - 形：`graphic.accentBar` 的粗细、`graphic.blockRadius` 的圆角。
 * 所以换主题时它会跟着整片一起变 —— 不需要为它加一个主题字段。
 *
 * 字号用母版的 `box.scale`（`min(w,h)/1080`），**不要用 `width/1080`**（见 `Masthead` 的说明）。
 */
export const EventStamp: React.FC<Props> = ({elapsed, updatedAt, phase}) => {
  const theme = useTheme();
  const {scale} = useMasterBox();
  const frame = useCurrentFrame();

  const easing = Easing.bezier(...theme.motion.enter);
  const fontSize = Math.round(theme.type.caption * scale);
  const padX = Math.round(theme.space.gapTight * 0.7 * scale);

  return (
    <Interactive.Div
      name="Event stamp"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Math.round(theme.space.gapTight * scale),
        fontFamily: theme.font.mono,
        fontSize,
        whiteSpace: 'nowrap',
      }}
    >
      {/* 强调条：从左边生长出来，是整片级的轻微入场，与场景无关 */}
      <div
        style={{
          width: Math.round(theme.graphic.accentBar * scale),
          height: fontSize,
          borderRadius: theme.graphic.blockRadius * scale,
          backgroundColor: theme.color.accent,
          transformOrigin: 'left center',
          scale: interpolate(frame, [4, 22], ['0 1', '1 1'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      />

      <span
        style={{
          color: theme.color.accent,
          fontWeight: 700,
          letterSpacing: 0.4,
          opacity: interpolate(frame, [6, 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      >
        {elapsed}
      </span>

      <span
        style={{
          color: theme.color.furniture,
          fontWeight: 500,
          letterSpacing: 0.4,
          opacity: interpolate(frame, [10, 28], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      >
        {updatedAt}
      </span>

      {phase ? (
        <span
          style={{
            color: theme.color.bg,
            backgroundColor: theme.color.accent,
            borderRadius: theme.graphic.blockRadius * scale,
            padding: `2px ${padX}px`,
            fontWeight: 700,
            letterSpacing: 0.6,
            opacity: interpolate(frame, [14, 30], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing,
            }),
          }}
        >
          {phase}
        </span>
      ) : null}
    </Interactive.Div>
  );
};
