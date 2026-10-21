import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../../../kernel/theme/context';
import {useMasterBox} from '../../../kernel/master/MasterContext';

type Credibility = 'high' | 'medium' | 'low';

type Props = {
  readonly name: string;
  /** 缺省视为 `medium`。只影响徽章的强调程度，不引入新色值 */
  readonly credibility?: Credibility;
};

const LABEL: Record<Credibility, string> = {
  high: '可信度高',
  medium: '可信度中',
  low: '可信度低',
};

/**
 * **本类型特有家具**：消息来源与可信度。
 *
 * 为什么它是家具：热点解析里「这条消息谁说的、可信到什么程度」是**整片成立的前提**，
 * 不是某一场戏的内容 —— 每期都要有，位置固定，所以按母版契约第 2 节属于家具。
 *
 * **可信度只用现有色板表达**，没有为它加新主题字段：
 *   - `high`   → 实心强调色徽章（`accent` 底 + `bg` 字）
 *   - `medium` → 描边徽章（`accent` 边与字，透明底）
 *   - `low`    → 弱化描边徽章（`muted` 边与字）
 * 三级在深色与浅色主题上都能分辨 —— 这是「不为一个家具新增主题维度」的实测样本。
 *
 * 圆角取 `graphic.blockRadius`，所以它在仪表盘风主题里是方角、在头版风主题里是胶囊。
 */
export const SourceBadge: React.FC<Props> = ({name, credibility = 'medium'}) => {
  const theme = useTheme();
  const {scale} = useMasterBox();
  const frame = useCurrentFrame();

  const easing = Easing.bezier(...theme.motion.enter);
  const fontSize = Math.round(theme.type.caption * scale);
  const padX = Math.round(theme.space.gapTight * 0.7 * scale);

  const filled = credibility === 'high';
  const chipColor = credibility === 'low' ? theme.color.muted : theme.color.accent;

  return (
    <Interactive.Div
      name="Source badge"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Math.round(theme.space.gapTight * scale),
        fontFamily: theme.font.family,
        fontSize,
        whiteSpace: 'nowrap',
        opacity: interpolate(frame, [0, 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing,
        }),
      }}
    >
      <span style={{color: theme.color.furniture, fontWeight: 500}}>来源：{name}</span>

      <span
        style={{
          color: filled ? theme.color.bg : chipColor,
          backgroundColor: filled ? chipColor : 'transparent',
          border: `${Math.max(1, Math.round(theme.graphic.ruleThickness * scale * 0.5))}px solid ${chipColor}`,
          borderRadius: theme.graphic.blockRadius * scale,
          padding: `1px ${padX}px`,
          fontWeight: 700,
          letterSpacing: 0.6,
        }}
      >
        {LABEL[credibility]}
      </span>
    </Interactive.Div>
  );
};
