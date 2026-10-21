import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MasterFrame} from '../master/MasterFrame';
import {defaultDark} from '../theme/default';
import {ShowcaseScenes, useShowcaseFurniture} from './ShowcaseScenes';

/**
 * 母版演示合成 —— **同时是母版级验证载体**（用默认主题）。
 *
 * 关键点：内容与版式调用来自 `ShowcaseScenes`，那里刻意用**最坏情况内容**
 * （超长标题、8 条清单、12 位数字），因为母版契约第 7 节要求
 * 「按版式抽帧 + 用最坏情况内容」验证。好看不是目标，**扛住才是**。
 *
 *   npx remotion still MasterShowcase out/m-30.png  --frame=30     # cover
 *   npx remotion still MasterShowcase out/m-90.png  --frame=90     # headline
 *   npx remotion still MasterShowcase out/m-150.png --frame=150    # list
 *   npx remotion still MasterShowcase out/m-210.png --frame=210    # stat
 *   npx remotion still MasterShowcase out/m-270.png --frame=270    # quote
 *   npx remotion still MasterShowcase out/m-330.png --frame=330    # closing
 *   npx remotion still MasterShowcase out/m-390.png --frame=390    # list（带主字段）
 *   npx remotion still MasterShowcase out/m-470.png --frame=470    # list（显式节奏 40，与 m-150 配对）
 *
 * 1920x1080 / 30fps / 480 帧（16 秒）= 8 个版式场景 × 60 帧（`SHOWCASE_TOTAL_FRAMES`）。
 * ⚠️ **新增场景一律追加在末尾**（见 `ShowcaseScenes.tsx`）：总长会变，但前七场的帧号不动，
 * 上面这些命令与 `kit.md` 里已记录的抽帧帧号继续有效。
 * 主题层的对照验证见 `ThemeShowcase.tsx`。
 */
export const MasterShowcase: React.FC = () => {
  const furniture = useShowcaseFurniture();

  return (
    <AbsoluteFill style={{backgroundColor: defaultDark.color.bg}}>
      <MasterFrame grid furniture={furniture}>
        <ShowcaseScenes />
      </MasterFrame>
    </AbsoluteFill>
  );
};
