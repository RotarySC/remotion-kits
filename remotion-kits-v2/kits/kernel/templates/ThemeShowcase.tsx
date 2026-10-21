import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MasterFrame} from '../master/MasterFrame';
import {getTheme, type ThemeId} from '../theme';
import {ShowcaseScenes, useShowcaseFurniture} from './ShowcaseScenes';

type Props = {
  /** 用哪个主题。必须是在 `theme/index.ts` 里注册过的 id */
  readonly themeId?: ThemeId;
};

/**
 * 主题演示合成 —— **主题级验证载体**。
 *
 * 与 `MasterShowcase` 的唯一差别是 `themeId`：内容与版式调用是同一份
 * （`ShowcaseScenes`），所以把两个合成的同一帧并排看，差异**只可能**来自主题。
 *
 * 一个主题一个合成，注册方式是 `THEME_IDS.map(...)`：
 *
 *   {THEME_IDS.map((themeId) => (
 *     <Composition
 *       key={themeId}
 *       id={`ThemeShowcase-${themeId}`}
 *       component={ThemeShowcase}
 *       defaultProps={{themeId}}
 *       durationInFrames={360}
 *       fps={30}
 *       width={1920}
 *       height={1080}
 *     />
 *   ))}
 *
 * 抽帧（每个主题每个版式一张）：
 *
 *   npx remotion still ThemeShowcase-paper-seal out/ps-150.png --frame=150
 *
 * 这里比 `MasterShowcase` 多开了 `vignette`：暗角颜色也是主题的一部分，
 * 不开就永远验证不到 `color.vignette`。
 */
export const ThemeShowcase: React.FC<Props> = ({themeId = 'default-dark'}) => {
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
