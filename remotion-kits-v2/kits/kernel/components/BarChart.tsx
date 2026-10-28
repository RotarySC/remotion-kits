import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {splitEntry} from '../master/slots';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

type Props = {
  /**
   * `lines` 槽：每条是 `'标签<TAB>数值'`。
   *
   * ⚠️ **用 `SLOT_SEP` 拼，不要手打 TAB** —— 写内容的地方手打 TAB 会静默失效。
   * 解析走 `master/slots.ts` 的 `splitEntry`：**槽编码只有一份实现**，
   * 组件消费 `lines` 槽时也走它，绝不各写一遍。
   */
  readonly items: readonly string[];
  /**
   * 满格对应的值。省略则取所有数值里的**最大值**。
   *
   * 给它是为了让几屏之间的条形**可比** —— 各屏各按自己的最大值归一，
   * 观众会以为「这一屏的第一名」和「上一屏的第一名」一样长。
   */
  readonly max?: number;
  /** 字号（像素）—— 标签与数值都按它推 */
  readonly fontSize?: number;
  /** 条高（像素） */
  readonly barHeight?: number;
  /** 行间距（像素） */
  readonly gap?: number;
  /** 标签列宽（像素）。**必须是固定值** —— 自动宽会让每根条从不同的 x 起跑，就没法比了 */
  readonly labelWidth?: number;
  /** 数值列宽（像素） */
  readonly valueWidth?: number;
  /** 条的填充色。省略取主题 `color.accent` */
  readonly color?: string;
  /** 轨底色。省略取主题 `color.rule` */
  readonly trackColor?: string;
  /** 圆角（像素）。省略取主题 `graphic.blockRadius` */
  readonly radius?: number;
  /** 数值后缀（`%` / `s` / `ms`） */
  readonly unit?: string;
  /** 数值小数位 */
  readonly decimals?: number;
  /** 相邻两条之间错开的帧数 */
  readonly staggerInFrames?: number;
  /** 单根条生长完的时长（帧） */
  readonly barDurationInFrames?: number;
  /** 入场延迟（帧） */
  readonly delayInFrames?: number;
  /**
   * 透传给 `Interactive` 的 Sequence 起始帧。**入场（以及一切帧相关取值）也从这一帧起算** ——
   * 见组件体内那段 `localFrame` 的说明。
   */
  readonly from?: number;
  /** Studio 时间线显示名，硬编码 */
  readonly name?: string;
  /** 整张图的宽度。像素或 CSS 长度 */
  readonly width?: number | string;
};

/**
 * 水平条形图 —— 一行一个类别，条的长度编码数值。
 *
 * ## 为什么叫 `BarChart` 而不是 `HBarChart`
 *
 * 中文里「条形图」本来就是横的（竖的叫**柱状图**）。所以 `BarChart` 这个名字
 * 对它自己已经说清楚了，而 `ColumnChart` 那个位置留给以后真要做竖排时用。
 *
 * ## 三个设计决定
 *
 * 1. **数值列固定宽、右对齐，不骑在条的末端。** 骑在末端会随条的成长一路移动，
 *    一屏里所有数字都在动；固定成一列之后，**只有长度在动，数字是静止的参照**。
 *    而且条长到 100% 时数字也不会被挤出去。
 * 2. **条的生长不用 `perceptual-scale`。** 一维生长（`'0 1' → '1 1'`）编码的是**数据**，
 *    加感知曲线等于把数值也一起弯掉；`perceptual-scale` 是给**二维均匀缩放**的
 *    （`TextTag` 的弹出、`BulletList` 的方块才用它）。
 * 3. **轨一直画。** 轨给出满格的参照 —— 没有轨时，「38 比 21 长」只能靠两根条互相比，
 *    有了轨就能各自和满格比。它同时给 `color.rule` 一个正当消费者。
 *
 * ## 数值的诚实回退
 *
 * 条目**不是** `'标签<TAB>数值'` 的形状时（没写 TAB、或数值不是数），
 * 这一行照样画：标签照显示、条长 0、数值列显示**原文**。
 * **绝不猜、也绝不悄悄丢掉这一行** —— 少画一行是静默的谎，画成 0 至少看得见。
 * （`splitEntry` 在没有分隔符时把整条当说明，所以此时标签取那整条。）
 *
 * 颜色 / 字族 / 圆角来自 `useTheme()`；字号与几何默认值是内联值（Studio 可编辑）。
 */
export const BarChart: React.FC<Props> = ({
  items,
  max,
  fontSize = 30,
  barHeight = 22,
  gap = 22,
  labelWidth = 300,
  valueWidth = 150,
  color,
  trackColor,
  radius,
  unit,
  decimals = 0,
  staggerInFrames = 6,
  barDurationInFrames = 20,
  delayInFrames = 0,
  from,
  name = 'Bar chart',
  width = '100%',
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

  const rows = items.map((raw) => {
    const {head, body} = splitEntry(raw);
    const parsed = Number(body);
    const numeric = head !== '' && body !== '' && Number.isFinite(parsed);

    return {
      label: head !== '' ? head : body,
      value: numeric ? parsed : 0,
      text: numeric ? `${parsed.toFixed(decimals)}${unit ?? ''}` : head !== '' ? body : '',
    };
  });

  const peak = max ?? rows.reduce((acc, row) => Math.max(acc, row.value), 0);
  const barRadius = radius ?? theme.graphic.blockRadius;
  const barColor = color ?? theme.color.accent;

  return (
    <Interactive.Div
      name={name}
      from={from}
      style={{
        // 块级：根盒子**不承载外观**，所以照容器办（'auto'）—— 被撑也不变形，见 `guards/placement.ts`
        ...placeSelf('auto'),
        display: 'flex',
        flexDirection: 'column',
        gap,
        width,
      }}
    >
      {rows.map((row, index) => {
        const start = delayInFrames + index * staggerInFrames;
        const ratio = peak > 0 ? Math.min(1, Math.max(0, row.value / peak)) : 0;

        const grow = interpolate(
          localFrame,
          [start, start + barDurationInFrames],
          [0, 1],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        );

        // 标签与轨先立住，数字**随后**才落 —— 先看见长度，再读数字
        const rowOpacity = interpolate(localFrame, [start, start + barDurationInFrames * 0.4], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });

        const valueOpacity = interpolate(
          localFrame,
          [start + barDurationInFrames * 0.5, start + barDurationInFrames],
          [0, 1],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        );

        return (
          <Interactive.Div
            key={`${index}-${row.label}`}
            name={`Bar ${index + 1}`}
            style={{
              display: 'grid',
              gridTemplateColumns: `${labelWidth}px 1fr ${valueWidth}px`,
              alignItems: 'center',
              columnGap: Math.round(fontSize * 0.7),
              opacity: rowOpacity,
            }}
          >
            <div
              style={{
                fontFamily: theme.font.family,
                fontSize,
                lineHeight: 1.3,
                color: theme.color.ink,
              }}
            >
              {row.label}
            </div>

            <div
              style={{
                height: barHeight,
                backgroundColor: trackColor ?? theme.color.rule,
                borderRadius: barRadius,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  backgroundColor: barColor,
                  borderRadius: barRadius,
                  transformOrigin: 'left center',
                  // 一维生长：`ratio` 是数据，`grow` 是入场。**不加** `perceptual-scale`
                  scale: `${ratio * grow} 1`,
                }}
              />
            </div>

            <div
              style={{
                textAlign: 'right',
                whiteSpace: 'nowrap',
                fontFamily: theme.font.mono,
                fontSize: Math.round(fontSize * 0.95),
                color: barColor,
                opacity: valueOpacity,
              }}
            >
              {row.text}
            </div>
          </Interactive.Div>
        );
      })}
    </Interactive.Div>
  );
};
