import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useFittedLines} from '../../guards/fitting';
import {ClampLines} from '../../guards/ClampLines';
import {useTheme} from '../../theme/context';
import {useMasterBox} from '../MasterContext';

type Props = {
  /** 序号，如 `01`。可选 */
  readonly index?: string;
  readonly title: string;
  /** 两三行摘要。可选 */
  readonly summary?: string;
};

/**
 * 头条版式：序号 + 标题 + 摘要。
 *
 * 槽契约（`LAYOUT_SPECS.headline`）：
 *   index    可选 · none
 *   title    必填 · fit-n-lines   ← 头条标题必须完整显示，所以缩字号而不是截断
 *   summary  可选 · clamp         ← 摘要显示不完没关系，所以截断
 *
 * 序号 + 强调条 + 摘要，三件都用主题：序号字号取 `type.subhead`、强调条粗细取
 * `graphic.accentBar` 与圆角 `graphic.blockRadius`、摘要字号取 `type.body`。
 */
export const HeadlineLayout: React.FC<Props> = ({index, title, summary}) => {
  const theme = useTheme();
  const box = useMasterBox();
  const frame = useCurrentFrame();

  const indexSize = Math.round(theme.type.subhead * box.scale);

  // 「01」那一列会占掉标题的宽度，所以标题实际能用的宽度**不等于** `contentWidth`。
  //
  // **护栏测的宽度必须与标题实际渲染的盒子一致。** 否则护栏会按更宽的盒子选一个偏大的字号，
  // 浏览器再按真实盒宽**重新贪心折行** —— 末行就可能只剩一个字。
  // 抽帧抓到过：headline 标题断出孤字「下」，根因就是这个宽度差，**不是**断行算法。
  // （序号列宽 = 两个字宽 + 与标题的间距；mono 数字约 0.6em/字，留 2.4em 余量。）
  const INDEX_GAP = 28;
  const indexColWidth = index ? Math.round(indexSize * 2.4) + INDEX_GAP : 0;
  const titleWidth = box.contentWidth - indexColWidth;

  const {fontSize: titleSize, lines: titleLines} = useFittedLines({
    text: title,
    maxLines: 3,
    maxBoxWidth: titleWidth,
    minFontSize: Math.round(theme.type.heading * box.scale),
    maxFontSize: Math.round(theme.type.title * box.scale),
    fontWeight: 700,
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
        gap: theme.space.gapTight * 1.5,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          // 间距已算进 `indexColWidth`，**不要**在这里再写 `gap` ——
          // 否则护栏的宽度算式与实际渲染盒会再次错开，正是本次修掉的那个缺陷。
        }}
      >
        {index ? (
          <Interactive.Div
            name="Headline index"
            style={{
              color: theme.color.accent,
              fontFamily: theme.font.mono,
              fontSize: indexSize,
              fontWeight: 700,
              letterSpacing: 1,
              paddingTop: titleSize * 0.22,
              width: indexColWidth,
              flexShrink: 0,
              opacity: interpolate(frame, [0, 14], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing,
              }),
              translate: interpolate(frame, [0, 14], ['-16px 0px', '0px 0px'], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing,
              }),
            }}
          >
            {index}
          </Interactive.Div>
        ) : null}

        <div style={{display: 'flex', flexDirection: 'column', width: titleWidth, flexShrink: 0}}>
          {titleLines.map((line, lineIndex) => (
            <Interactive.Div
              key={`${lineIndex}-${line}`}
              name={`Headline title line ${lineIndex + 1}`}
              style={{
                color: theme.color.ink,
                fontFamily: theme.font.family,
                fontSize: titleSize,
                fontWeight: 700,
                lineHeight: 1.18,
                letterSpacing: -0.5,
                opacity: interpolate(frame, [4, 26], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing,
                }),
                translate: interpolate(frame, [4, 26], ['0px 24px', '0px 0px'], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing,
                }),
              }}
            >
              {line}
            </Interactive.Div>
          ))}
        </div>
      </div>

      <div
        style={{
          height: theme.graphic.accentBar * box.scale,
          width: theme.graphic.accentBar * box.scale * 6,
          borderRadius: theme.graphic.blockRadius * box.scale,
          backgroundColor: theme.color.accent,
          transformOrigin: 'left center',
          scale: interpolate(frame, [18, 40], ['0 1', '1 1'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing,
          }),
        }}
      />

      {summary ? (
        <div style={{maxWidth: box.contentWidth * 0.82}}>
          <ClampLines
            text={summary}
            maxLines={3}
            fontSize={Math.round(theme.type.body * box.scale)}
            delayInFrames={22}
            name="Headline summary"
          />
        </div>
      ) : null}
    </div>
  );
};
