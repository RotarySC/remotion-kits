import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';
import {Emphasis} from './Emphasis';

type Props = {
  /**
   * 正文。**一个字符串**，里面可以写三种轻量标记（见文件头），`\n` 分段。
   *
   * 为什么是字符串而不是 runs 数组：母版的槽位传进来就是字符串。
   * 要结构化的那些调用方可以先用下面导出的 `parseRichText` 自己拆。
   */
  readonly text: string;
  /** 字号（像素） */
  readonly fontSize?: number;
  /** 行高倍数 */
  readonly lineHeight?: number;
  /** 正文墨色。省略取主题 `color.ink` */
  readonly color?: string;
  /** 标记色（高亮 / 行内代码）。省略取主题 `color.accent` */
  readonly accentColor?: string;
  readonly align?: 'left' | 'center' | 'right';
  /** 画一个框（结论框 / 要点框）。默认不画 —— 它先是正文，其次才可能是框 */
  readonly box?: boolean;
  /** 框底色。省略透明（只有描边） */
  readonly boxColor?: string;
  /** 框描边色。省略取主题 `color.rule` */
  readonly borderColor?: string;
  /** 最大宽度（像素） */
  readonly maxWidth?: number;
  /** 入场延迟（帧） */
  readonly delayInFrames?: number;
  /** 入场长度（帧） */
  readonly enterDurationInFrames?: number;
  /**
   * 透传给 `Interactive` 的 Sequence 起始帧。**入场（以及一切帧相关取值）也从这一帧起算** ——
   * 见组件体内那段 `localFrame` 的说明。
   */
  readonly from?: number;
  /** Studio 时间线显示名，硬编码 */
  readonly name?: string;
};

/** 富文本里一段同格式的文字 */
export type RichRun = {
  readonly text: string;
  readonly kind: 'plain' | 'strong' | 'highlight' | 'code';
};

/**
 * 三种标记。**顺序无关紧要** —— 解析按「谁先出现」取，不按这张表的顺序。
 *
 * 为什么是这三个：它们分别对应「重量 / 落点 / 字面量」，是技术讲解里真正会用到的三件事。
 * 没有取 `__下划线__` 这类，是因为 `_` 在代码内容里太常见（`__init__`），
 * 而本套件的正文里出现代码是常态。
 */
const MARKERS: readonly {readonly token: string; readonly kind: RichRun['kind']}[] = [
  {token: '**', kind: 'strong'},
  {token: '==', kind: 'highlight'},
  {token: '`', kind: 'code'},
];

/**
 * 把带标记的字符串拆成一段段同格式的文字。
 *
 * ## 解析规则（三条，都是为了让「写错」不会静默出事）
 *
 * 1. **谁先出现谁先切** —— 不是按标记表的顺序，所以 `**a** 和 `b`` 里谁在前谁先成段；
 * 2. **不配对就原样输出** —— 找不到收尾标记（或里面是空的）时，这个标记**当字面量**，
 *    不吞掉后面的正文。所以「随手打了一个 `**`」最坏的结果是多显示两个星号，
 *    而不是把半篇文章吃掉；
 * 3. **不嵌套** —— 段里再出现标记就是普通字符。规则简单到可以一眼看穿，
 *    比支持嵌套更值：正文是内容，不该在渲染期做小语言解析。
 *
 * ⚠️ 标记本身会被**消费掉**（不出现在输出里），所以「输出拼回去 = 输入」只在
 * **没有任何配对标记**时成立。要拿纯文本请用 `richTextToPlain`。
 */
export const parseRichText = (text: string): readonly RichRun[] => {
  const out: RichRun[] = [];
  let buffer = '';
  let cursor = 0;

  const flush = (kind: RichRun['kind']) => {
    if (buffer !== '') {
      out.push({text: buffer, kind});
      buffer = '';
    }
  };

  while (cursor < text.length) {
    // 找**最早出现**的那个标记
    let at = -1;
    let marker: (typeof MARKERS)[number] | null = null;

    for (const candidate of MARKERS) {
      const found = text.indexOf(candidate.token, cursor);
      if (found >= 0 && (at < 0 || found < at)) {
        at = found;
        marker = candidate;
      }
    }

    if (marker === null || at < 0) {
      buffer += text.slice(cursor);
      break;
    }

    const close = text.indexOf(marker.token, at + marker.token.length);

    // 没有收尾（或中间是空的）→ 这个标记当字面量，继续往后扫
    if (close < 0 || close === at + marker.token.length) {
      buffer += text.slice(cursor, at + marker.token.length);
      cursor = at + marker.token.length;
      continue;
    }

    buffer += text.slice(cursor, at);
    flush('plain');
    out.push({text: text.slice(at + marker.token.length, close), kind: marker.kind});
    cursor = close + marker.token.length;
  }

  flush('plain');

  return out.length > 0 ? out : [{text: '', kind: 'plain'}];
};

/**
 * 去掉所有标记的纯文本 —— 供需要自己排版 / 测量字号的调用方使用
 * （`guards/fitting.ts` 量的是字宽，标记必须先去干净，否则会多量出几个星号的宽度）。
 */
export const richTextToPlain = (text: string): string =>
  parseRichText(text)
    .map((run) => run.text)
    .join('');

/**
 * 富文本框 —— 一段**混排格式**的正文，格式用轻量标记写在同一个字符串里。
 *
 * ## 标记
 *
 * | 写法 | 效果 |
 * | --- | --- |
 * | `**加粗**` | 加粗（字重 700） |
 * | `==高亮==` | 底色高亮 —— **复用 `Emphasis`**，不另画一套 |
 * | `` `等宽` `` | 行内代码：等宽字族 + 主题的 rule 底色 + 强调色文字 |
 *
 * `\n` 分段。解析规则与两条不变量见 `parseRichText`。
 *
 * ## 为什么值得是一个组件
 *
 * 「一句话里有三个词要强调」是讲解类视频的日常需求。没有它，只能手写
 * `<Emphasis>` 交错在 JSX 里 —— 内容与结构混在一起，而且**内容没法从槽位来**
 * （槽位传的是字符串）。有了它，`content` 槽里写
 * `'最慢的是 **渲染**，==配置档== 压的就是它'` 就能出片。
 *
 * ## `box` 是次要的
 *
 * 它先是正文，其次才可能是框。所以 `box` 默认关；开了只加一层描边与内边距，
 * 底色默认透明（**不替调用方决定这是不是一张卡片**）。
 *
 * 颜色 / 字族 / 圆角来自 `useTheme()`；字号是内联默认值（Studio 可编辑）。
 */
export const RichTextBox: React.FC<Props> = ({
  text,
  fontSize = 34,
  lineHeight = 1.6,
  color,
  accentColor,
  align = 'left',
  box = false,
  boxColor,
  borderColor,
  maxWidth = 1100,
  delayInFrames = 0,
  enterDurationInFrames = 22,
  from,
  name = 'Rich text box',
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  /**
   * 入场与**所有帧相关取值**都读局部帧：`from` 挪的是 `Interactive.Div` 内部那层
   * `<Sequence from>` 的挂载窗口，组件体内 `useCurrentFrame()` 拿到的却是外层帧 ⇒
   * 不减掉 `from`，`from={30}` 会在挂载那一刻就已经入场完毕（静默、不报错）。
   * `from` 缺省时 `localFrame === frame`，现有调用逐帧不变。
   */
  const localFrame = frame - (from ?? 0);

  const accent = accentColor ?? theme.color.accent;
  const paragraphs = text.split('\n');
  const codeRadius = Math.round(theme.graphic.blockRadius * 0.6);

  const opacity = interpolate(
    localFrame,
    [delayInFrames, delayInFrames + enterDurationInFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  const translate = interpolate(
    localFrame,
    [delayInFrames, delayInFrames + enterDurationInFrames],
    ['0px 18px', '0px 0px'],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  return (
    <Interactive.Div
      name={name}
      from={from}
      style={{
        // 块级：根盒子**不承载外观**，所以照容器办（'auto'）—— 被撑也不变形，见 `guards/placement.ts`
        ...placeSelf('auto'),
        width: '100%',
        maxWidth,
        opacity,
        translate,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontFamily: theme.font.family,
          fontSize,
          lineHeight,
          color: color ?? theme.color.ink,
          textAlign: align,
          ...(box
            ? {
                border: `1px solid ${borderColor ?? theme.color.rule}`,
                backgroundColor: boxColor ?? 'transparent',
                borderRadius: theme.graphic.blockRadius * 2,
                padding: Math.round(fontSize * 1.1),
              }
            : {}),
        }}
      >
        {paragraphs.map((paragraph, index) => (
          <div
            key={`${index}-${paragraph}`}
            style={{marginTop: index === 0 ? 0 : Math.round(fontSize * lineHeight * 0.55)}}
          >
            {parseRichText(paragraph).map((run, runIndex) => {
              if (run.kind === 'strong') {
                return (
                  <span key={runIndex} style={{fontWeight: 700}}>
                    {run.text}
                  </span>
                );
              }

              if (run.kind === 'highlight') {
                // 复用行内强调原语 —— 高亮的画法只有一份实现
                return (
                  <Emphasis
                    key={runIndex}
                    kind="highlight"
                    color={accent}
                    delayInFrames={delayInFrames + 6}
                    drawDurationInFrames={14}
                  >
                    {run.text}
                  </Emphasis>
                );
              }

              if (run.kind === 'code') {
                return (
                  <span
                    key={runIndex}
                    style={{
                      fontFamily: theme.font.mono,
                      fontSize: Math.round(fontSize * 0.92),
                      backgroundColor: theme.color.rule,
                      color: accent,
                      padding: '0.04em 0.34em',
                      borderRadius: codeRadius,
                    }}
                  >
                    {run.text}
                  </span>
                );
              }

              return <span key={runIndex}>{run.text}</span>;
            })}
          </div>
        ))}
      </div>
    </Interactive.Div>
  );
};
