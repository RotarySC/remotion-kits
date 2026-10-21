import React from 'react';
import {Interactive} from 'remotion';
import {useTheme} from '../theme/context';

type Props = {
  /**
   * 角标臂长（像素）—— 一条 L 的两个臂等长。
   *
   * 默认 **24**：历史参考（`arch-v4.html` 的 `corner-marks`）画的是 **12**，但那 12 是在
   * 一张约 250px 宽的演示卡上量的（≈ 卡的 5% 宽）。本套件的卡在 1080 高的片子里通常
   * 540–840 宽，按同一比例是 26–40 —— 12 在这个尺度上几乎看不见。
   */
  readonly size?: number;
  /** 线宽（像素）。省略取主题 `graphic.ruleThickness` */
  readonly thickness?: number;
  /** 线色。省略取主题 `color.ink` */
  readonly color?: string;
  /**
   * 相对框边**内缩**（像素）。默认 **10**。
   *
   * ⚠️ 这个默认值不是凑的，是**实测逼出来的**：历史参考（`arch-v4.html`）里框是
   * **1px**、角标 **2px**，所以角标贴在角上比框线粗一档、看得见。
   * 本套件框的粗细来自**主题**（`graphic.ruleThickness`，默认 **2px**）——
   * 角标贴角（`inset: 0`）时两者**逐像素重合**，抽帧出来**看不出任何东西**
   * （2026-10-05 实测：24px 臂长 / 2px 线宽 贴在 2px 框上，与 `plain` 那一张几乎无法区分）。
   * 内缩 10px 之后它读成一组**独立的括号**：框是框，角标是角标。
   */
  readonly inset?: number;
  /** Studio 时间线显示名，硬编码 */
  readonly name?: string;
};

/** 四个角。`vertical` / `horizontal` 各自决定那一条边画在哪一侧 —— 见下面的 `borderXWidth` */
const CORNERS = [
  {key: 'tl', pos: {top: 0, left: 0}, vertical: 'top', horizontal: 'left'},
  {key: 'tr', pos: {top: 0, right: 0}, vertical: 'top', horizontal: 'right'},
  {key: 'bl', pos: {bottom: 0, left: 0}, vertical: 'bottom', horizontal: 'left'},
  {key: 'br', pos: {bottom: 0, right: 0}, vertical: 'bottom', horizontal: 'right'},
] as const;

/**
 * **四角角标** —— 一件**可组合的装饰**（T08 裁定那句「需要新的装饰能力时，增加一个可组合的小能力」）。
 *
 * ## 它为什么是「一件小能力」而不是「Panel 的一个新模式」
 *
 * 四个 L 形角标**不落在任何槽里**，也**不改骨架**（头 / 身 / 尾怎么排它一概不管）。
 * 按 `references/creation-workflow.md` 与历史 `arch-v5` §1 的判据，改骨架的才是新原语；
 * 不改骨架的是**字段 / 装饰** —— 所以它是一件平的、能在任何相对定位的盒子角上用的东西。
 *
 * 它**自己找位置**：外层 `position: absolute; inset: 0` 铺满父盒的**内边距盒**
 * （＝ 框线以内那一圈就是它的四个角），四个 L 各贴一角。
 * ⚠️ **父盒必须是定位元素**（`position: relative|absolute|fixed`）—— 否则它会去贴更外面那个祖先。
 * `Panel` 走皮渲染它时**只为这一件事**加上 `position: relative`（见 `Panel.tsx`）：
 * 默认皮不写，所以今天所有画面的样式对象**逐字节不变**。
 *
 * ## 它不做什么
 *
 * - **不带入场动效。** 角标是框的一部分，跟着框出现；`Panel` 的入场已经作用在整框的
 *   `opacity` / `translate` 上，再给角标一条自己的曲线只会让两者错开。
 * - **不做「角上放内容」。** 那是槽的事 —— 有内容要放就说明它不是装饰，是原语。
 * - **不读皮的 id。** 皮表说 `cornerMarks: true`，`Panel` 就把这一件挂上；
 *   这件东西自己**不认识任何皮的名字**（＝ 有限解释器，加一张皮不动这里的代码）。
 */
export const CornerMarks: React.FC<Props> = ({
  size = 24,
  thickness,
  color,
  inset = 10,
  name = 'CornerMarks',
}) => {
  const theme = useTheme();
  const line = thickness ?? theme.graphic.ruleThickness;
  const stroke = color ?? theme.color.ink;

  return (
    <Interactive.Div
      name={name}
      style={{
        position: 'absolute',
        // `inset: 0` ＝ 父盒的**内边距盒**（框线以内）。四个 L 就贴在这一圈的四角上。
        inset: 0,
        // 装饰不该拦住鼠标 / 不该参与命中 —— 它铺满整个盒子
        pointerEvents: 'none',
      }}
    >
      {CORNERS.map((c) => (
        <div
          key={c.key}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            boxSizing: 'border-box',
            // ⚠️ `borderStyle` 一给，四条边都会按 `medium`（3px）画 ——
            // 所以先无条件把四条边清零，再只把该有的两条打开。
            // 顺序不能换：后面的键要盖住前面的。
            borderStyle: 'solid',
            borderColor: stroke,
            borderWidth: 0,
            [c.vertical === 'top' ? 'borderTopWidth' : 'borderBottomWidth']: line,
            [c.horizontal === 'left' ? 'borderLeftWidth' : 'borderRightWidth']: line,
            ...c.pos,
            [c.vertical]: inset,
            [c.horizontal]: inset,
          }}
        />
      ))}
    </Interactive.Div>
  );
};
