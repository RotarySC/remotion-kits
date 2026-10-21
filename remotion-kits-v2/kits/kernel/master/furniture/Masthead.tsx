import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../../theme/context';
import {useMasterBox} from '../MasterContext';

type Props = {
  readonly title?: string;
  readonly meta?: string;
  /**
   * 报头带的**第二行**，由调用方给。类型包自己的家具（时间戳、状态条之类）挂这里。
   *
   * 为什么不给内核加具体字段：内核一旦认识 `eventStamp`，就反向依赖了那个类型包
   * （见架构基线 §3.1 的归属表）。给一个通用插槽，差异由组合表达。
   */
  readonly extra?: React.ReactNode;
  readonly insetX: number;
  readonly insetY: number;
  readonly height: number;
};

/**
 * 报头家具 —— **最多两行**：上面栏目名 + 元信息，下面 `extra`。整片常在。
 *
 * 第二行是**通用插槽**：类型包自己的常在元素（时间戳、状态条…）挂在这里，
 * 而它必须落在母版为家具预留的高度带内（`theme.space.mastheadHeight`）。
 * 所以加一件家具**不需要新增主题维度** —— 把 `space.mastheadHeight` 调高即可容下两行，
 * 那个字段本来就该由主题决定（「报头多高」是标量，属于主题；
 * 「报头在左上角」是位置，属于母版）。
 *
 * 契约：位置由母版给的 inset 固定、内容来自母版 props、不参与场景入场动效。
 * 字号必须用母版的 `box.scale`（`min(w,h)/1080`）—— **不能用 `width/1080`**：
 * 后者在 1920 宽下是 1.78 倍，报头会涨到比正文还大并挤出预留高度带。
 */
export const Masthead: React.FC<Props> = ({
  title,
  meta,
  extra,
  insetX,
  insetY,
  height,
}) => {
  const theme = useTheme();
  const {scale} = useMasterBox();
  const frame = useCurrentFrame();

  const easing = Easing.bezier(...theme.motion.enter);
  const lineGap = Math.round(theme.space.gapTight * scale * 0.5);

  return (
    <Interactive.Div
      name="Masthead"
      style={{
        position: 'absolute',
        left: insetX,
        right: insetX,
        top: insetY,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: lineGap,
        fontFamily: theme.font.family,
        opacity: interpolate(frame, [0, 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing,
        }),
      }}
    >
      {title ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: Math.round(theme.space.gap * scale),
          }}
        >
          <div
            style={{
              color: theme.color.ink,
              fontSize: Math.round(theme.type.subhead * scale),
              fontWeight: 700,
              letterSpacing: -0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>

          {meta ? (
            <div
              style={{
                color: theme.color.furniture,
                fontSize: Math.round(theme.type.caption * scale),
                fontWeight: 500,
                fontFamily: theme.font.mono,
                letterSpacing: 0.5,
                whiteSpace: 'nowrap',
              }}
            >
              {meta}
            </div>
          ) : null}
        </div>
      ) : null}

      {extra}
    </Interactive.Div>
  );
};
