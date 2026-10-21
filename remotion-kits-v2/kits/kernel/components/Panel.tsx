import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';
import {DEFAULT_SKIN_ID, resolveSkin, skinRadius, type SkinId} from '../skins';
import {CornerMarks} from '../skins/CornerMarks';

type Props = {
  /** 卡身。**内容无关** —— 框不知道里面装的是推文、数字、清单项还是一段长文 */
  readonly children: React.ReactNode;
  /** 卡头（可选）。给了它就带一条分隔线 —— 那是「卡头」这个区的可见边界 */
  readonly header?: React.ReactNode;
  /** 卡尾（可选）。**贴在框底** —— 标注 / 徽章 / 进度条的锚位 */
  readonly footer?: React.ReactNode;
  /**
   * 宽度。三档：
   *
   *   * **省略** —— 撑满给它的盒子（在 flex 行里则按内容 —— 那是浏览器的规则，不是这里的）；
   *   * **数字** —— 固定像素宽；
   *   * **`'fit'`** —— **跟内容走**（紧凑块）：不再撑满，收到内容那么宽。
   *
   * ⚠️ 数字是**外框宽度**（含描边与内边距）—— 给了宽度就按 `border-box` 算，
   * 于是「`width={600}`」量出来就是 600，而不是 600 + 内边距 + 描边。
   *
   * 为什么需要它：一屏摆多张卡时要能对齐；而**单张卡**（一个数据点、一句引文、
   * 一段被引用的原文）又常常要**紧凑** —— 没有这个旋钮，紧凑只能靠在外面套一层
   * `display: flex` 的壳，而那层壳是纯噪音（它不做别的事）。
   */
  readonly width?: number | 'fit';
  /** 内边距（像素） */
  readonly padding?: number;
  /** 卡头 / 卡身 / 卡尾之间的间距（像素） */
  readonly gap?: number;
  /** 描边色。省略取主题 `color.ink` */
  readonly borderColor?: string;
  /** 描边宽（像素）。省略取主题 `graphic.ruleThickness` */
  readonly borderWidth?: number;
  /** 圆角（像素）。省略取**皮**，皮不主张再取主题 `graphic.blockRadius` */
  readonly radius?: number;
  /**
   * **皮** —— 外观的具名预设（T08）。省略 = `'plain'`（＝今天的长相）。
   *
   * 皮只声明**它与主题不同的那几项**，且只声明**形状 / 结构的选择**（圆角档、角标），
   * 不声明标量、不声明色值。所以三级优先是：
   *
   *   1. **实例 prop**（`radius={24}`）—— 你说的算；
   *   2. **皮**（`skin="corner-marks"` 的 `radius: 'square'`）；
   *   3. **主题**（`graphic.blockRadius`）。
   *
   * ⚠️ 名字不存在时**明确报错**（`skins/index.ts` 的 `resolveSkin` 抛异常），
   * **不静默退回 `plain`** —— 静默回退的症状是「画面看着正常，只是不像你以为的那张皮」。
   *
   * 表在 `skins/index.ts`；要加一张皮按那份文件头的判据来，别只往表里塞名字。
   */
  readonly skin?: SkinId;
  /**
   * 卡内底色。省略取主题 `color.bg`。
   *
   * ⚠️ **默认不透明是功能，不是外观** —— 背景上那层网格（或任何底纹）必须被卡挡住，
   * 卡内才是干净的。传 `'transparent'` 会让网格穿进卡里。
   */
  readonly background?: string;
  /**
   * 硬偏移阴影（右下，无模糊）。**默认关**。
   *
   * ⚠️ 默认关是因为它**在深色主题上根本看不见**（黑阴影压在近黑的底上）——
   * 与「网格色必须与底色同向」是同一个坑。要用就显式开，并让 `shadowColor` 取主题的墨色。
   */
  readonly shadow?: boolean;
  /** 阴影色。省略取描边色 */
  readonly shadowColor?: string;
  /** 阴影偏移（像素） */
  readonly shadowOffset?: number;
  /**
   * 0–1 的**强调态**驱动量：**讲到别处时把这一张压暗**。
   *
   * 一屏摆多张卡时，「现在讲到哪一张」必须有个出口 —— 这就是它。
   * 与其它原语一样：**组件自己不动**，缓动由调用方决定
   * （例如 `dim={focusOf(frame, i) ? 0 : 1}`）。
   */
  readonly dim?: number;
  /** 入场延迟（帧）—— 一排卡片靠它错开 */
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

/**
 * 内容卡 —— 一个**有边界的容器**，把「一块内容」变成一个可指认的单元。
 *
 * ## 它在片子里干四件活（每一件都对应一个 API 决定）
 *
 * | 职责 | 靠什么实现 |
 * | --- | --- |
 * | **① 注意力单位** —— 框的粒度 = 「能被单独讲到」的最小单位 | `dim` 驱动量（讲到别处时压暗） |
 * | **② 引用范围** —— 框内是引用、框外是我的话说 | 描边划界；来源 / 状态挂在 `header` / `footer` |
 * | **③ 比较单位** —— 要比就得先各自成块 | `children` 内容无关 + `width` 旋钮（撑满 / 定宽 / 收紧） |
 * | **④ 标注挂点** —— 标注属于这个框，不浮在画面上 | `footer` 贴在框底 |
 *
 * ## 为什么不是 `MediaStage`
 *
 * 两者方向**相反**：`MediaStage` 是「**框去适应素材**」（16:9、`fit`、标签条压在图上）；
 * 这里是「**内容撑开框**」。所以它是新原语，而不是给 `MediaStage` 加一个模式。
 *
 * ## 三条设计决定
 *
 * 1. **框高在自然高度的父级里跟内容走** —— 没有 `height` prop，**也不裁切、不滚动**。
 *    内容多就高、内容少就低，这是有意的：视频里长内容靠**硬切分页**（换一页内容），
 *    不是靠滚动，也不是靠把框拉齐。要**并排等高 / 撑满一行**就把它们放进 `Flow`：
 *    它给轨道确定高度，这里的内层就撑满（第 5 条）。
 *    ⚠️ 顺带说清「硬切」为什么是对的：契约**禁止动画 `height`**，而缩放整个框会把字也缩放（变形）。
 *    所以翻页时框高**突变**，不补间 —— 这既合规，也正是「硬切换」该有的样子。
 * 2. **卡内是不透明底**（默认取主题 `color.bg`）—— 见 `background` 的注释：这是功能。
 * 3. **硬阴影可选、默认关** —— 见 `shadow` 的注释：这是为了不在深色主题上画一个看不见的东西。
 * 4. **宽度只有三档**（撑满 / 定宽 / 收紧），**没有对齐** —— 「居中还是靠左」是**外面容器**的事：
 *    卡自己不知道它在画面里站哪儿，一旦知道就会和母版的位置打架。
 * 5. **可被拉伸，但那不是一个「开关」** —— 内层无条件 `height: 100%`：父级给了确定高度就撑满，
 *    父级是 `auto` 就按内容走。P0 实测（合成层 + 展示页）两条路的差别是**零**，
 *    所以「请拉伸我」这个声明**不必要** —— 一个旋钮就够，那个旋钮在 `Flow` 上。
 *
 * 颜色 / 字族 / 圆角 / 分隔线全部来自 `useTheme()`；内边距与间距是内联默认值（Studio 可编辑）。
 *
 * ## 皮（T08）：**一个可选的外观预设**，不是第二条主题
 *
 * `skin` 只改**形状 / 结构的选择**（圆角档、四角角标），而且**实例 prop 永远盖得住它**。
 * 色板 / 字阶 / 动效签名 / 图形标量仍然全归主题 —— 这样才不会出现
 * 「两个来源都能改颜色」那件事（架构基线 §9.1 明令不许）。
 * 表与判据在 `skins/index.ts`；四角角标那件装饰在 `skins/CornerMarks.tsx`。
 */
export const Panel: React.FC<Props> = ({
  children,
  header,
  footer,
  width,
  padding = 28,
  gap = 18,
  borderColor,
  borderWidth,
  radius,
  skin = DEFAULT_SKIN_ID,
  background,
  shadow = false,
  shadowColor,
  shadowOffset = 8,
  dim = 0,
  delayInFrames = 0,
  enterDurationInFrames = 22,
  from,
  name = 'Panel',
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

  const edge = borderColor ?? theme.color.ink;
  const lineWidth = borderWidth ?? theme.graphic.ruleThickness;
  // 三级优先：**实例 > 皮 > 主题**。`skinRadius` 在皮没主张这一项时给 `undefined`，
  // 于是 `??` 继续往主题退 —— 「皮只写差异」这句话在这里落成一行代码。
  const skinSpec = resolveSkin(skin);
  const panelRadius = radius ?? skinRadius(skinSpec) ?? theme.graphic.blockRadius;
  const cornerMarks = skinSpec.cornerMarks === true;
  const dividerWidth = Math.max(1, Math.round(lineWidth / 2));
  const clampedDim = Math.min(1, Math.max(0, dim));

  // 三档宽度。`'fit'` 是 CSS 的 `fit-content`：收到内容那么宽。
  // **外框与卡身给同一个值** —— 卡身决定长相，外框决定它在父容器里占多宽
  // （只给卡身的话，父容器是「撑满」的块时，一张定宽卡会贴在左边，看起来像没居中）。
  const sized = width === 'fit' ? 'fit-content' : width;

  const enter = interpolate(
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
    ['0px 16px', '0px 0px'],
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
        // 容器类：**照组里办**（`'auto'`，不是写死 `'stretch'`）——
        // `equal` / `fill` 里撑满、`natural` 里按内容走，这两件事都靠它。
        // 写死 `'stretch'` 会让 `natural` 也撑满，那等于把 `natural` 这个词废掉。
        ...placeSelf('auto'),
        // 入场与压暗**两个来源都作用在透明度上**，所以相乘 —— 别让后者把前者覆盖掉
        opacity: enter * (1 - clampedDim * 0.68),
        translate,
        width: sized,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap,
          padding,
          width: sized,
          // `border-box` 只在**给了宽度**时才有区别：它让 `width` 指的是外框宽度。
          // 不给宽度（`auto`）时它什么都不影响，所以这里可以无条件写。
          boxSizing: 'border-box',
          // **可被拉伸**：父级（`Flow`）给了确定高度时撑满它。父级高度是 `auto` 时，
          // 百分比高度按 CSS 解析为 `auto` —— 于是「框高跟内容走」在自然高度的父级里**逐帧不变**
          // （P0 实测：合成层与展示页都是零影响，63 项断言逐行 0 差异）。
          // 所以这里**不需要**「请拉伸我」的开关：见文件头第 1 条。
          height: '100%',
          border: `${lineWidth}px solid ${edge}`,
          borderRadius: panelRadius,
          // 只为**皮要的角标**加定位上下文。默认皮不写 ⇒ 今天所有画面的样式对象逐字节不变。
          position: cornerMarks ? 'relative' : undefined,
          backgroundColor: background ?? theme.color.bg,
          boxShadow: shadow
            ? `${shadowOffset}px ${shadowOffset}px 0 0 ${shadowColor ?? edge}`
            : undefined,
        }}
      >
        {header ? (
          <div
            style={{
              paddingBottom: Math.round(gap * 0.5),
              borderBottom: `${dividerWidth}px solid ${theme.color.rule}`,
            }}
          >
            {header}
          </div>
        ) : null}

        <div>{children}</div>

        {footer ? <div>{footer}</div> : null}

        {/* 皮要的角标。**画在最后** —— 它是装饰，盖在框内所有内容之上（四个角上本来也没内容） */}
        {cornerMarks ? <CornerMarks /> : null}
      </div>
    </Interactive.Div>
  );
};
