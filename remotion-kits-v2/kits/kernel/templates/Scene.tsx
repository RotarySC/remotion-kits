import React from 'react';
import {SafeArea} from '../components/SafeArea';
import {Stage} from '../components/Stage';

type Props = {
  readonly children: React.ReactNode;
  readonly background?: string;
  /** 叠一层网格 */
  readonly grid?: boolean;
  /** 四角压暗 */
  readonly vignette?: boolean;
  readonly align?: 'top' | 'center' | 'bottom';
  /** 内容列的样式覆盖（gap、对齐等） */
  readonly contentStyle?: React.CSSProperties;
};

/**
 * 单场景脚手架：Stage（背景）→ SafeArea（安全区）→ 内容列。
 *
 * 用法：
 *   <Sequence from={0} durationInFrames={90} premountFor={30} name="Scene 1">
 *     <Scene grid>
 *       <SectionHeading index="01" title="..." />
 *       <Title text="..." />
 *     </Scene>
 *   </Sequence>
 *
 * 场景时长由外层 `<Sequence>` 决定；场景内部的动效从该序列的本地 0 帧起算。
 */
export const Scene: React.FC<Props> = ({
  children,
  background,
  grid = false,
  vignette = false,
  align = 'center',
  contentStyle,
}) => {
  return (
    <Stage background={background} grid={grid} vignette={vignette}>
      <SafeArea align={align}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            width: '100%',
            ...contentStyle,
          }}
        >
          {children}
        </div>
      </SafeArea>
    </Stage>
  );
};