import {useMemo} from 'react';
import {fitText, fitTextOnNLines, measureText} from '@remotion/layout-utils';
import {useTheme} from '../theme/context';

/**
 * 溢出护栏 —— 母版契约第 5 节的实现。
 *
 * 为什么必须有：母版要固定时长，而内容是变长的。没有护栏，长标题会溢出画布或
 * 把版面顶开 —— 这是「模板化出片」每天都会遇到的失败。
 *
 * 这三个钩子都是**纯测量**，把结果交给版式去画，这样入场动效仍然由版式 / 原语提供。
 *
 * 注意：测量用的是与渲染**同一个** `fontFamily` 字符串，且两者都取自 `useTheme()`。
 * 换主题时字号会跟着字族一起重算 —— 这正是「换主题不用改版式」还能不溢出的原因。
 * 用网络字体时必须先等字体加载完（`waitUntilDone()`），否则量的是回退字体的宽度。
 */

type FitSizeOptions = {
  readonly text: string;
  readonly withinWidth: number;
  /** 字号下限，防止长文本被缩到不可读 */
  readonly minFontSize: number;
  readonly maxFontSize: number;
  readonly fontWeight?: number;
};

/** 单行自适应：返回一个能让 `text` 塞进 `withinWidth` 的字号，并夹在上下限之间 */
export const useFittedFontSize = ({
  text,
  withinWidth,
  minFontSize,
  maxFontSize,
  fontWeight = 700,
}: FitSizeOptions): number => {
  const theme = useTheme();

  return useMemo(() => {
    const {fontSize} = fitText({
      text,
      withinWidth,
      fontFamily: theme.font.family,
      fontWeight,
    });

    // 上下限可能被调用方的密度系数弄反（min > max）。先把两个界规范化，
    // 否则 `Math.min(max, Math.max(min, x))` 会无声忽略下限。
    const lo = Math.min(minFontSize, maxFontSize);
    const hi = Math.max(minFontSize, maxFontSize);

    return Math.min(hi, Math.max(lo, Math.floor(fontSize)));
  }, [text, withinWidth, minFontSize, maxFontSize, fontWeight, theme.font.family]);
};

type FitLinesOptions = {
  readonly text: string;
  readonly maxLines: number;
  readonly maxBoxWidth: number;
  readonly minFontSize: number;
  readonly maxFontSize: number;
  readonly fontWeight?: number;
};

/**
 * 均衡断行 —— 把文本重新断成 `lineCount` 行，让各行长度**尽量接近**。
 *
 * 为什么需要：`fitTextOnNLines` 是**逐字贪心**断行，中文很容易断出「末行只剩一个字」
 * 的孤字（`kit-core` 示例内容的 headline 就断出过「下」）。
 *
 * **只在每一行都仍放得进 `maxBoxWidth` 时才采用均衡结果**，否则返回 `null`，
 * 让调用方退回库的贪心断行 —— 宁可不好看，不可溢出。
 */
const balanceLines = ({
  text,
  lineCount,
  maxBoxWidth,
  fontSize,
  fontFamily,
  fontWeight,
}: {
  readonly text: string;
  readonly lineCount: number;
  readonly maxBoxWidth: number;
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly fontWeight: number;
}): readonly string[] | null => {
  if (lineCount <= 1 || text.length <= lineCount) {
    return null;
  }

  // 目标行长 = 总字数 ÷ 行数。中文一字一格，所以按字数分配 ≈ 按宽度分配
  const target = Math.ceil(text.length / lineCount);
  const isWordChar = (c: string) => /[A-Za-z0-9]/.test(c);
  const out: string[] = [];
  let cursor = 0;

  for (let i = 0; i < lineCount - 1; i++) {
    let end = Math.min(text.length, cursor + target);

    // 不要在 ASCII 词中间断开（中文可以逐字断）
    while (end < text.length && isWordChar(text[end - 1]) && isWordChar(text[end])) {
      end += 1;
    }

    if (end <= cursor) {
      return null;
    }

    out.push(text.slice(cursor, end));
    cursor = end;
  }

  out.push(text.slice(cursor));

  const stillFits = out.every(
    (line) => measureText({text: line, fontFamily, fontSize, fontWeight}).width <= maxBoxWidth,
  );

  return stillFits ? out : null;
};

/**
 * 多行自适应：返回字号与**换行点**。
 * 用返回的 `lines` 逐行渲染，就能精确控制断行，不依赖浏览器的折行。
 *
 * 断行做过**均衡**：先让库给一个能放进 N 行的字号，再用 `balanceLines` 重新分配各行长度，
 * 避免孤字；均衡后若有行放不下，就退回库的贪心结果。
 */
export const useFittedLines = ({
  text,
  maxLines,
  maxBoxWidth,
  minFontSize,
  maxFontSize,
  fontWeight = 700,
}: FitLinesOptions): {readonly fontSize: number; readonly lines: readonly string[]} => {
  const theme = useTheme();

  return useMemo(() => {
    const fitted = fitTextOnNLines({
      text,
      maxLines,
      maxBoxWidth,
      fontFamily: theme.font.family,
      fontWeight,
      maxFontSize,
    });

    const fontSize = Math.floor(fitted.fontSize);

    // 已经在下限以下就不再缩：宁可换行多，也不缩成蚂蚁
    if (fontSize < minFontSize) {
      return {fontSize: minFontSize, lines: [text]};
    }

    const balanced = balanceLines({
      text,
      lineCount: fitted.lines.length,
      maxBoxWidth,
      fontSize,
      fontFamily: theme.font.family,
      fontWeight,
    });

    return {fontSize, lines: balanced ?? fitted.lines};
  }, [text, maxLines, maxBoxWidth, minFontSize, maxFontSize, fontWeight, theme.font.family]);
};

type MeasureOptions = {
  readonly text: string;
  readonly fontSize: number;
  readonly fontWeight?: number;
};

/** 直接量一段文本的宽高。用于需要自己排版判断的场合 */
export const useTextSize = ({
  text,
  fontSize,
  fontWeight = 400,
}: MeasureOptions): {readonly width: number; readonly height: number} => {
  const theme = useTheme();

  return useMemo(
    () =>
      measureText({
        text,
        fontFamily: theme.font.family,
        fontSize,
        fontWeight,
      }),
    [text, fontSize, fontWeight, theme.font.family],
  );
};
