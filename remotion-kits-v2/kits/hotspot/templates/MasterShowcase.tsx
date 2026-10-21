import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MasterFrame} from '../master/MasterFrame';
import {signalDark} from '../theme/signal-dark';
import {ShowcaseScenes, useShowcaseFurniture} from './ShowcaseScenes';

/**
 * 母版演示合成 —— **同时是母版级验证载体**（用本套件的默认主题 `signal-dark`）。
 *
 * 关键点：内容与版式调用来自 `ShowcaseScenes`，那里刻意用**最坏情况内容**，
 * 因为母版契约第 7 节要求「按版式抽帧 + 用最坏情况内容」验证。
 *
 * 抽帧清单 —— **按版式，不按场景**。本套件只演它自己的 **4 个**版式
 * （通用那 6 个由内核那份 `MasterShowcase` 承担 —— 类型包不持有内核原语），
 * 且四个都是**清单类**，所以一律取**末尾帧**，否则最后几条还没入场就抽了。
 * 末尾帧 = `i × 60 + 56`（`SHOWCASE_SCENE_FRAMES = 60`，见 `ShowcaseScenes.tsx`）：
 *
 *   npx remotion still HotspotMasterShowcase out/h-56.png  --frame=56     # timeline   ★ 末尾
 *   npx remotion still HotspotMasterShowcase out/h-116.png --frame=116    # stance     ★ 末尾
 *   npx remotion still HotspotMasterShowcase out/h-176.png --frame=176    # multi-stat ★ 末尾（异质）
 *   npx remotion still HotspotMasterShowcase out/h-236.png --frame=236    # multi-stat ★ 末尾（同质）
 *
 * 1920x1080 / 30fps / **240 帧（8 秒）** = 4 个版式 × 60 帧（`SHOWCASE_TOTAL_FRAMES`）。
 * 主题层的对照验证见 `ThemeShowcase.tsx`。
 */
export const HotspotMasterShowcase: React.FC = () => {
  const furniture = useShowcaseFurniture();

  return (
    <AbsoluteFill style={{backgroundColor: signalDark.color.bg}}>
      <MasterFrame grid furniture={furniture}>
        <ShowcaseScenes />
      </MasterFrame>
    </AbsoluteFill>
  );
};
