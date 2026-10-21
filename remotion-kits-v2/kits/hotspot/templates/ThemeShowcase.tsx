import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MasterFrame} from '../master/MasterFrame';
import {getTheme} from '../theme';
import type {ThemeId} from '../theme';
import {ShowcaseScenes, useShowcaseFurniture} from './ShowcaseScenes';

type Props = {
  readonly themeId: ThemeId;
};

/**
 * 主题演示合成 —— **主题级验证载体**：一个主题一个合成（在 `Root.tsx` 里按 `THEME_IDS` 批量注册）。
 *
 * 与 `HotspotMasterShowcase` 的**唯一变量是主题**：内容来自同一份 `ShowcaseScenes`，
 * 版式调用完全一样。所以并排看时，差异只可能来自主题 ——
 * 这正是「换主题不换版式」这句话的可视化证据（硬指标是哈希比对，见 `theme-contract.md` 第 6.3 节）。
 *
 *   npx remotion still HotspotThemeShowcase-signal-dark    out/t-sd-296.png --frame=296 --scale=0.5
 *   npx remotion still HotspotThemeShowcase-alert-contrast out/t-ac-296.png --frame=296 --scale=0.5
 */
export const HotspotThemeShowcase: React.FC<Props> = ({themeId}) => {
  const theme = getTheme(themeId);
  const furniture = useShowcaseFurniture();

  return (
    <AbsoluteFill style={{backgroundColor: theme.color.bg}}>
      <MasterFrame theme={theme} grid vignette furniture={furniture}>
        <ShowcaseScenes />
      </MasterFrame>
    </AbsoluteFill>
  );
};
