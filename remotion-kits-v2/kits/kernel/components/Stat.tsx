import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  /**
   * 数字本身。**是字符串，不是 `number`。**
   *
   * 千分位、货币符号、正负号、`≈`、`—`、`1.2 万` 都是**内容层**的活 ——
   * 让组件去解析 / 格式化，就等于把内容约定写进形态里（与 `BarChart` 的
   * 「测不出数就显示原文」是同一条裁定）。
   *
   * ⚠️ **它可以逐帧变**（组件本来就每帧重渲染）—— 那是「跳动」与「计数到」的实现方式：
   * 调用方每帧算好字符串传进来。见 `reserveChars` 与文件头的「数字的三种动态」。
   */
  readonly value: string;
  /** 单位 / 后缀，如 `%` / `ms` / `亿`。**单独排**，不跟着数字放大 */
  readonly unit?: string;
  /** 这个数字**是什么**（一句话） */
  readonly label?: string;
  /** 补充说明（口径 / 条件 / 出处） */
  readonly note?: string;
  /**
   * 数字字号（像素）。单位 / 标签 / 说明的字号**按它等比推出** —— 见文件头第 2 条。
   *
   * 默认值是**内联**的（Studio 可编辑）。要让它跟随主题字阶就显式传 `theme.type.stat`。
   */
  readonly fontSize?: number;
  /** 对齐。`center` 用于「整屏只有这一个数」的单卡场景 */
  readonly align?: 'left' | 'center';
  /** 数字色。省略取主题 `color.accent` */
  readonly color?: string;
  /** 标签色。省略取主题 `color.ink` */
  readonly labelColor?: string;
  /** 上限宽度（像素）。数字不换行，但标签与说明会 */
  readonly maxWidth?: number;
  /**
   * 数字区**按 N 个字符预留宽度**。
   *
   * 为什么需要：等宽族保证「**同位数**换值整行不动」，但**位数一变就会晃** ——
   * `9.9` → `10.2` 多一位，**单位被推着往右移**；而**计数到**（`0.0` → `86.6`）
   * 从头到尾都在变位数。给了它，数字区固定占 N 个字符宽，值在框里**左对齐**
   * （数字往右长，单位不动）。
   *
   * 实现是「幽灵占位」：同一字体同一字号渲染 N 个 `0`，让它当**宽度与基线**的捐赠者，
   * 真值绝对定位盖在上面 —— 所以不依赖任何字体度量，换主题 / 换字号都不会偏。
   */
  readonly reserveChars?: number;
  /**
   * **数位滚动**的起点字符串：每一位从 `rollFrom[i]` 滚到 `value[i]`。
   *
   * ⚠️ **必须与 `value` 等长**。不等长时**不滚**（直接显示 `value`）——
   * 长度不同就无从判断「谁对上谁」，而**猜**比不动更坏（与 `BarChart`
   * 「测不出数就显示原文」同一条裁定）。症状是「它不动」，看得见。
   */
  readonly rollFrom?: string;
  /**
   * 数位滚动的驱动量 0–1。**只有同时给了 `rollFrom` 且两者等长时才生效**。
   * 缓动由调用方决定（与 `ScrollArea` 的 `scroll` 同一个约定）。
   */
  readonly roll?: number;
  /** 入场延迟（帧） */
  readonly delayInFrames?: number;
  /** **整段**入场的长度（帧）。三段（数字 / 单位 / 标签）按它错开，不是一个元素的时长 */
  readonly enterDurationInFrames?: number;
  /** 透传给 `Interactive` 的 Sequence 起始帧（**不是**滚动的起点，那是 `rollFrom`）。**入场也从这一帧起算**，见 `localFrame` */
  readonly from?: number;
  /** Studio 时间线显示名，硬编码 */
  readonly name?: string;
};

/**
 * 一列数位滚过哪些字形 —— 从 `a` 到 `b` 要经过的那几个。
 *
 * 同字符 → 一个字形（不滚）；两个都是数字 → `a..b`（含两端，正反都行）；
 * 其余（`.` / `,` / 非数字）→ 一个字形（不滚）。
 *
 * ⚠️ **这是逐位线性，不是数值插值**：`'0'` → `'99'` 的中点是 `'55'`，不是 `'49.5'`。
 * 要**数值正确**的计数到，由调用方每帧算好字符串传 `value` —— 那是另一条路，不是这条。
 */
const glyphsOf = (a: string, b: string): readonly string[] => {
  const isDigit = (c: string) => c >= '0' && c <= '9';
  if (!isDigit(a) || !isDigit(b)) {
    return [b];
  }

  const da = a.charCodeAt(0);
  const db = b.charCodeAt(0);
  if (da === db) {
    return [b];
  }

  const step = db > da ? 1 : -1;
  const out: string[] = [];
  for (let c = da; step > 0 ? c <= db : c >= db; c += step) {
    out.push(String.fromCharCode(c));
  }
  return out;
};

/**
 * 逐位滚动 —— `to` 的每一位是一个**裁切列**，列里竖排着一串字形，按 `progress` 平移。
 *
 * 宽度 = `to.length` 个字符（每列 `1ch`），**恒定**，所以滚动时单位不会晃。
 * 平移用 `translate`（契约允许），不用 `top` / `height`。
 */
const DigitRoll: React.FC<{
  readonly from: string;
  readonly to: string;
  readonly progress: number;
  readonly fontSize: number;
}> = ({from, to, progress, fontSize}) => {
  return (
    <span style={{position: 'absolute', left: 0, top: 0, display: 'flex'}}>
      {to.split('').map((ch, i) => {
        const strip = glyphsOf(from[i] ?? ch, ch);
        // 落在第几个字形上 —— **连续**（不是整格跳）；顺滑的缓动由调用方给
        const offset = progress * (strip.length - 1);

        return (
          <span
            key={`${i}-${ch}`}
            style={{
              position: 'relative',
              overflow: 'hidden',
              // 等宽族里 `1ch` = 一个字符的前进量，所以 N 列正好拼成 N 个字符宽
              width: '1ch',
              height: fontSize,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                translate: `0px ${-offset * fontSize}px`,
              }}
            >
              {strip.map((g) => (
                <span key={g} style={{display: 'block', height: fontSize, lineHeight: 1}}>
                  {g}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};

/**
 * 大数字 —— 一个**数据点**：数字 + 单位 + 标签（+ 一句说明）。
 *
 * ## 它在片子里干四件活（每一件都对应一个 API 决定）
 *
 * | 职责 | 靠什么实现 |
 * | --- | --- |
 * | **① 落点** —— 前面铺垫、数字出现、后面解释 | 三段**错开**入场：数字先落 → 单位跟上 → 标签最后 |
 * | **② 量级** —— 「大」本身就是信息 | 字号远大于正文；入场是 `scale` 从 0.86 **长**上来，不是滑进来 |
 * | **③ 单位不属于数字** —— `%` 不该跟着放大到 160px | `unit` 是**另一个**行内元素，字号按 0.3 推 |
 * | **④ 格式化属于内容层** | `value` 是字符串，组件一个字都不解析 |
 *
 * ## 数字的三种「动态」（两种在调用方，一种在组件里）
 *
 * | 形态 | 怎么做 | 谁负责 |
 * | --- | --- | --- |
 * | **跳动** —— `86.6` → `91.2` 一帧换掉 | 调用方按帧换 `value` 字符串 | 调用方 |
 * | **计数到** —— `0.0` → `86.6` 连续长 | 调用方每帧 `interpolate` **数值**、再格式化成字符串 | 调用方 |
 * | **数位滚动** —— 每一位上下翻 | `rollFrom` + `roll`，组件逐位平移 | **组件** |
 *
 * 前两种**不需要组件知道那是个数字** —— 这正是「格式化属于内容层」换来的：组件只把字符串印出来。
 * ⚠️ 但位数一变整行就会晃，所以它们要用 `reserveChars`。
 *
 * 第三种是唯一需要组件参与的：它得知道「哪一位滚到哪一位」，所以要多一个起点字符串。
 * ⚠️ 它是**逐位线性**，与「计数到」**不是同一件事** —— 两条都得用眼睛看：
 * 计数到是数字**跳**（整串换掉），滚动是数字**滑**（每一位上下走）。
 *
 * ## 为什么不是 `Title` 加大字号
 *
 * 三处都不一样：**基线**（单位与数字同排，靠 `baseline` 对齐，不是居中）、
 * **原点**（`scale` 从左下 / 中下长起，不是从中心）、**字族**（数字用 `font.mono`）。
 * 一个「大一点的标题」量不出这三样，所以它是新原语。
 *
 * ## 三条设计决定
 *
 * 1. **`value` 是字符串而不是 `number`** —— 与母版 `stat` 版式同一条裁定（见 prop 注释）。
 * 2. **单位 / 标签 / 说明的字号由 `fontSize` 按比例推出**（0.3 / 0.28 / 0.2），
 *    **不做成三个独立 prop** —— 一个数据点的大小是**一个整体**：数字变大，它的单位和标签
 *    该跟着变大，否则「量级」这个信息就散了。⚠️ 推出来的字号是**计算值**，Studio 不可编辑 ——
 *    这与 `TextTag` 的内边距、`MediaStage` 的标签字号是同一种取舍。
 * 3. **不做溢出护栏** —— 变长的数字（3 位到 12 位）在这里**不会自动缩字号**：
 *    护栏住在母版层（`guards/fitting.ts` 的消费者全是版式），要让数字自己缩就走
 *    `stat` 版式。组件层保持「调用方给字号」，与 `Title` 一致。
 *
 * ⚠️ **数字区不加 `letterSpacing`**（母版的 `StatLayout` 有 `-2`，这里**故意没有**）：
 * 逐位滚动要求**列宽与字符前进量精确相等**，而字距会让两者差 `N × 字距` 像素 ——
 * 列就与幽灵占位错开。等宽族本来就够紧，少一个会让两套机制打架的旋钮。
 *
 * 颜色 / 字族来自 `useTheme()`；字号与间距是内联默认值（Studio 可编辑）。
 */
export const Stat: React.FC<Props> = ({
  value,
  unit,
  label,
  note,
  fontSize = 160,
  align = 'left',
  color,
  labelColor,
  maxWidth = 1000,
  reserveChars,
  rollFrom,
  roll,
  delayInFrames = 0,
  enterDurationInFrames = 28,
  from,
  name = 'Stat',
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

  const centered = align === 'center';

  // 三段错开：数字先落（缩放 + 淡入）→ 单位跟上 → 标签最后。
  // 比例是**内联**的（改 `enterDurationInFrames` 会整段伸缩，节奏不变）。
  const valueEnd = delayInFrames + enterDurationInFrames;
  const valueMid = delayInFrames + enterDurationInFrames * 0.72;
  const unitStart = delayInFrames + enterDurationInFrames * 0.35;
  const unitEnd = delayInFrames + enterDurationInFrames * 0.95;
  const labelStart = delayInFrames + enterDurationInFrames * 0.6;
  const labelEnd = delayInFrames + enterDurationInFrames * 1.2;
  const noteStart = delayInFrames + enterDurationInFrames * 0.85;
  const noteEnd = delayInFrames + enterDurationInFrames * 1.45;

  // 只有「给了起点、而且与 `value` 等长」才滚 —— 不等长就不动，见 `rollFrom` 的注释
  const rollStart =
    rollFrom !== undefined && rollFrom.length === value.length && roll !== undefined
      ? rollFrom
      : null;
  const clampedRoll = Math.min(1, Math.max(0, roll ?? 0));

  // 「幽灵占位」的**字数**：滚动时必须是 `value` 的长度（列宽要对得上），
  // 否则用调用方预留的那个数。都没有就不加幽灵，走原来那条路。
  const ghostChars =
    rollStart !== null
      ? value.length
      : reserveChars !== undefined && reserveChars > 0
        ? reserveChars
        : null;
  const ghost = ghostChars === null ? null : '0'.repeat(ghostChars);

  return (
    <Interactive.Div
      name={name}
      from={from}
      style={{
        // 块级：根盒子**不承载外观**，所以照容器办（'auto'）—— 被撑也不变形，见 `guards/placement.ts`
        ...placeSelf('auto'),
        display: 'flex',
        flexDirection: 'column',
        alignItems: centered ? 'center' : 'flex-start',
        gap: 14,
        width: '100%',
        maxWidth,
      }}
    >
      {/* 数字与单位**同排、按基线对齐** —— 单位坐在这行字的底线上，不是这行的中间 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: centered ? 'center' : 'flex-start',
          gap: 16,
          width: '100%',
        }}
      >
        <Interactive.Div
          name="Stat value"
          style={{
            color: color ?? theme.color.accent,
            fontFamily: theme.font.mono,
            fontSize,
            fontWeight: 700,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            // 有幽灵时才需要定位 —— 真值 / 滚动列要盖在它上面
            position: ghost === null ? undefined : 'relative',
            opacity: interpolate(localFrame, [delayInFrames, valueMid], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            // 从**基线**长上来 —— 原点在底部，数字才像「落」在版面上；
            // 从中心缩放会看起来像飘进来。
            scale: interpolate(localFrame, [delayInFrames, valueEnd], [0.86, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              output: 'perceptual-scale',
            }),
            transformOrigin: centered ? 'center bottom' : 'left bottom',
          }}
        >
          {ghost === null ? (
            value
          ) : (
            <>
              {/*
                幽灵：**同一个字体、同一个字号、同一行高**，所以它捐出来的宽度与基线都是精确的 ——
                不依赖任何字体度量，换主题 / 换字号都不会偏。`aria-hidden` 是给它一个说法，
                它本来就 `visibility: hidden`。
              */}
              <span aria-hidden="true" style={{visibility: 'hidden'}}>
                {ghost}
              </span>
              {rollStart !== null ? (
                <DigitRoll
                  from={rollStart}
                  to={value}
                  progress={clampedRoll}
                  fontSize={fontSize}
                />
              ) : (
                <span style={{position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap'}}>
                  {value}
                </span>
              )}
            </>
          )}
        </Interactive.Div>

        {unit ? (
          <Interactive.Div
            name="Stat unit"
            style={{
              color: theme.color.muted,
              fontFamily: theme.font.family,
              fontSize: Math.round(fontSize * 0.3),
              fontWeight: 600,
              lineHeight: 1,
              opacity: interpolate(localFrame, [unitStart, unitEnd], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            {unit}
          </Interactive.Div>
        ) : null}
      </div>

      {label ? (
        <Interactive.Div
          name="Stat label"
          style={{
            color: labelColor ?? theme.color.ink,
            fontFamily: theme.font.family,
            fontSize: Math.round(fontSize * 0.28),
            fontWeight: 500,
            lineHeight: 1.3,
            textAlign: centered ? 'center' : 'left',
            opacity: interpolate(localFrame, [labelStart, labelEnd], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(
              localFrame,
              [labelStart, labelEnd],
              ['0px 14px', '0px 0px'],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
          }}
        >
          {label}
        </Interactive.Div>
      ) : null}

      {note ? (
        <div
          style={{
            // 说明比标签更窄 —— 与母版 `stat` 版式同一条比例（0.8），长句不该横贯整个数字
            maxWidth: Math.round(maxWidth * 0.8),
            color: theme.color.muted,
            fontFamily: theme.font.family,
            fontSize: Math.round(fontSize * 0.2),
            fontWeight: 400,
            lineHeight: 1.5,
            textAlign: centered ? 'center' : 'left',
            opacity: interpolate(localFrame, [noteStart, noteEnd], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          {note}
        </div>
      ) : null}
    </Interactive.Div>
  );
};
