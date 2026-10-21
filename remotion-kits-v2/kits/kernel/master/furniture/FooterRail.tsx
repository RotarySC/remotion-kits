import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../../theme/context';
import {useMasterBox} from '../MasterContext';

type Props = {
  readonly left?: string;
  readonly right?: string;
  /**
   * 页脚**左侧**那一格，由调用方给。给了它就顶掉 `left`（两者抢同一个位置）——
   * 这是显式规则，不是「谁后写谁赢」。类型包自己的家具（来源徽章、状态灯…）挂这里。
   */
  readonly extra?: React.ReactNode;
  readonly progress?: {
    readonly current: number;
    readonly total: number;
  };
  readonly insetX: number;
  readonly insetY: number;
  readonly height: number;
};

/**
 * 页脚家具 —— 进度分段 + 规则线 + 左右两段小字。整片常在。
 *
 * 左侧那一格是**通用插槽**：类型包自己的常在元素（来源徽章、状态灯…）挂在 `extra` 上，
 * 它**顶掉** `left` —— 两者抢同一个位置，这是显式规则，不是「谁后写谁赢」。
 *
 * 进度分段是**整片级**的持续动效（随当前段推进），不属于任何场景，
 * 所以它不会在每场戏重新播一次。
 *
 * 字号同样用母版的 `box.scale`，不能用 `width/1080` —— 见 `Masthead` 的说明。
 * 线段圆角来自主题的 `graphic.blockRadius`（方角 ↔ 胶囊是主题身份的一部分）。
 */
export const FooterRail: React.FC<Props> = ({
  left,
  right,
  extra,
  progress,
  insetX,
  insetY,
  height,
}) => {
  const theme = useTheme();
  const {scale} = useMasterBox();
  const frame = useCurrentFrame();

  const railThickness = Math.max(2, Math.round(theme.graphic.railThickness * scale));
  const total = progress?.total ?? 0;
  const current = progress?.current ?? 0;

  return (
    <Interactive.Div
      name="Footer rail"
      style={{
        position: 'absolute',
        left: insetX,
        right: insetX,
        bottom: insetY,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: 14,
        fontFamily: theme.font.family,
      }}
    >
      {total > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            width: '100%',
          }}
        >
          {Array.from({length: total}).map((_, index) => {
            const reached = index < current;

            return (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: railThickness,
                  borderRadius: theme.graphic.blockRadius * scale,
                  backgroundColor: reached ? theme.color.accent : theme.color.rule,
                  opacity: interpolate(
                    frame,
                    [index * 3, index * 3 + 14],
                    [0, reached ? 1 : 0.55],
                    {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                      easing: Easing.bezier(...theme.motion.enter),
                    },
                  ),
                }}
              />
            );
          })}
        </div>
      ) : null}

      <div
        style={{
          height: Math.max(1, Math.round(theme.graphic.ruleThickness * scale * 0.5)),
          width: '100%',
          backgroundColor: theme.color.rule,
          borderRadius: theme.graphic.blockRadius * scale,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          color: theme.color.furniture,
          fontSize: Math.round(theme.type.caption * scale),
          fontWeight: 500,
          fontFamily: theme.font.mono,
          letterSpacing: 0.4,
        }}
      >
        {extra ? (
          <>{extra}</>
        ) : (
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: interpolate(frame, [0, 20], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(...theme.motion.enter),
              }),
            }}
          >
            {left ?? ''}
          </span>
        )}

        <span
          style={{
            whiteSpace: 'nowrap',
            opacity: interpolate(frame, [0, 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(...theme.motion.enter),
            }),
          }}
        >
          {right ?? ''}
        </span>
      </div>
    </Interactive.Div>
  );
};
