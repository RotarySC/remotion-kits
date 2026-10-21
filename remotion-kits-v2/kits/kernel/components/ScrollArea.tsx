import React from 'react';
import {useCurrentScale} from 'remotion';
import {useTheme} from '../theme/context';
import {placeSelf} from '../guards/placement';

/** 组件量到的两个尺寸（像素）：`viewport` = 视口高，`content` = 内容高 */
export type ScrollAreaSizes = {
  readonly viewport: number;
  readonly content: number;
};

type Props = {
  /**
   * `0`–`1` 的滚动位置。`0` = 内容顶对齐视口顶，`1` = 内容底对齐视口底。**越界夹取**。
   *
   * 是**驱动量**，与 `ProgressBar` 的 `progress` / `MediaCard` 的 `focus` 同理：
   * 组件只把它映射成位移，缓动由调用方决定 —— 节奏属于这一支片子，不属于套件。
   */
  readonly scroll: number;
  /** 要滚动的**内容**。行号沟这类东西也属于内容 —— 它**跟着一起滚** */
  readonly children?: React.ReactNode;
  /** 钉在视口上方的**头**（不参与滚动）。省略则视口占满整个盒子 */
  readonly header?: React.ReactNode;
  /**
   * 内容实际高度（像素）。
   *
   * **省略则由组件自己量** —— 这是官方做法（`useCurrentScale()` 修正），且实测 `frame 0` 就有值。
   * 只在「内容含异步媒体、量不准」时才需要显式给。
   */
  readonly contentHeight?: number;
  /** 右缘画一条滚动轨。**默认不画** —— 它是「窗口戏服」，不是「能滚动」的必要条件 */
  readonly rail?: boolean;
  /** 轨的粗细（像素）。省略取 6 */
  readonly railWidth?: number;
  /**
   * **尺寸通知**（最小接口）：量到视口高 / 内容高之后喊一次，之后**只在数变了**时再喊。
   *
   * 存在理由只有一个：「把第 k 行放到视口正中」要算 `f = y / (内容高 − 视口高)`，
   * 而这个式子里**只有视口高是调用方未必知道的数**（表头高由内容决定时更是如此）。
   * 组件已经量过它了 —— 与其让每个调用处各自再量一遍，不如把**这两个数**交出来；
   * 算式住在 `anchorScroll` 里，它是**通用**的、不依赖这个组件。
   *
   * 组件**量**、调用方**决定讲到哪**（与「元素自然默认 ＋ 实例可覆盖」同一种分工）。
   *
   * ⚠️ 通知是在 `useEffect` 里喊的 ⇒ 拿它 `setState` 的调用方**首帧拿到的是旧值**
   * （与「调用处自己量」同一类延迟）。表头高写死、或显式给了 `contentHeight` 的那一帧就已经是对的。
   */
  readonly onMeasured?: (sizes: ScrollAreaSizes) => void;
};

/**
 * **滚动区** —— 一个裁切视口，把比它高的内容按 `scroll` 平移。
 *
 * 视频里**没有「滚动」这个动作**（没有用户、没有滚轮、没有触摸），所以「滚动显示长内容」
 * 就是**框不动、内容按帧平移、超出部分被裁掉**。这个组件就是那件事。
 *
 * ## 内容高由组件自己量
 *
 * 「滚多远」= 内容高 − 视口高。内容高是唯一需要知道的数，而它**可以量**：
 * `useCurrentScale()` 修正 + `ref` + `useEffect`，量一次之后复用。
 *
 * ⚠️ **这不是「渲染期测量」** —— `component-contract.md` §6 禁的是**在补间里**调
 * `getBoundingClientRect()`（渲染器并行采样会失步），**不是禁止测量**。
 * 官方文档（`remotion-markdown/measuring-dom-nodes`）给的就是这个做法：
 * 量一次、`useState` 存住、之后只读。
 *
 * 所以「内容高」不必由调用方声明 —— 声明错了会**静默变空**（框里什么都没有，不报错），
 * 而量出来的不会错。`contentHeight` 只作为**覆盖**留给量不准的情况。
 *
 * ⚠️ **只量一次不够。** 实测：首次 `useEffect` 里**视口**量到的是 **0**
 * （弹性子项的高度那一刻还没解出来），而内容量到的是对的（它是绝对定位的）。
 * 后果很隐蔽：`max = 内容高 − 0` 偏大，滚到底时把内容**整个推出框外**。所以用
 * `ResizeObserver` 在尺寸定下来之后再量一次 —— 这也是 Remotion 文档在「测量 DOM 节点」
 * 那一页末尾指向 `react-use-measure` 的原因。
 *
 * ⚠️ **内容在渲染期不会变，所以量一次就够。** 要动态换内容，请换 `key` 让组件重挂载。
 *
 * ## 平移用 `translate`，不用 `top`
 *
 * §6：**绝不用 `width` / `height` / `top` / `left` 做动画**。所以内容层与轨的滑块都用
 * `translate` / `scale` 这两个独立变换属性（不用 `transform` 字符串 —— 只有独立属性在 Studio 里可编辑）。
 *
 * ## 头可以钉住
 *
 * `header` 不参与滚动。这不是「钉住素材的一部分」（那做不到 —— 一张平面图里没有「表头」这个对象，
 * 要钉只能先把表头裁出来），而是**结构上的头**：它本来就是一个独立元素。
 *
 * ## 锚点：把第 k 行放到视口正中
 *
 * 「讲到哪滚到哪」＝ 由**帧**算出 `scroll`：`f = y / (内容高 − 视口高)`。
 * 这个式子里**只有视口高是调用方未必知道的数**（表头高由内容决定时更是如此），而组件已经量过它 ——
 * 所以 `onMeasured` 把两个数交出来，算式住在 `anchorScroll` 里（它是**通用**的，不依赖这个组件）。
 * 也是「元素自然默认 ＋ 实例可覆盖」那种分工：组件**量**、调用方**决定讲到哪**。
 *
 * ⚠️ 实测（`docs/2026-10-06-锚点与素材结构-待裁定.md`）：视口高给对 ⇒ 偏差 **0.0px**；
 * 给错 29px（表头估 52、真实 81）⇒ 偏差 **+8.5 / −5.1px**；**首行 / 末行没有解**，只能贴边。
 * 素材（整张截图）也能锚，但 `target` / `size` 得由作者**按源坐标标注**（再乘显示 scale）——
 * 目测差 1px，第 k 行就偏 ≈k px。
 *
 * ## 轨是「窗口戏服」，默认不画
 *
 * 真实片子里有**滚一张长表格但完全不要轨**的 —— 靠**底边切掉半行**就足以提示「还有」。
 * 要轨的场景是「这个框想读成一个**真的窗口**」（标题栏 + 三个点 + 轨 = 全套 chrome）。
 * 所以它是**可选的装饰**，不是滚动功能的组成部分。
 *
 * 几何照**真滚动条**：滑块长度 = 可见高 / 内容高，位置 = `scroll`。
 * 动机既然是**拟真**，几何就该照**被模仿的那个东西**。
 */
export const ScrollArea: React.FC<Props> = ({
  scroll,
  children,
  header,
  contentHeight,
  rail = false,
  railWidth = 6,
  onMeasured,
}) => {
  const theme = useTheme();
  const rawScale = useCurrentScale();
  // 宿主在量出自己的尺寸之前 `scale` 可能是 0 —— 除以 0 会得到 `Infinity`，兜一下
  const scale = rawScale > 0 ? rawScale : 1;
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = React.useState<ScrollAreaSizes>({viewport: 0, content: 0});

  // 通知：回调放 ref（**不进依赖链** —— 内联箭头每次都换身份，进依赖会让 effect 每帧重跑），
  // 并且**只在数变了**时喊一次（否则调用方一 `setState` 就自己咬自己）。
  const notifyRef = React.useRef(onMeasured);
  notifyRef.current = onMeasured;
  const reportedRef = React.useRef<ScrollAreaSizes | null>(null);

  // 量一次、之后复用 —— 见上面「内容高由组件自己量」。
  // Remotion 给视频容器加了 `scale()` 变换，所以 `getBoundingClientRect()` 的值要除以 `useCurrentScale()`。
  //
  // ⚠️ **只量一次是不够的。** 实测：首次 `useEffect` 里**视口量到 0**，而内容量到的是对的
  // （内容层是绝对定位的，高度不依赖弹性布局；视口是弹性子项，那一刻高度还没解出来）。
  // 后果很隐蔽：`max = 内容高 − 0` 偏大，滚到底时把内容**整个推出框外** —— 框是空的，不报错。
  // 所以要用 `ResizeObserver` 在尺寸定下来之后再量一次（这也是 Remotion 的
  // 「测量 DOM 节点」那页在末尾指向 `react-use-measure` 的原因）。
  React.useEffect(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) {
      return;
    }

    const measure = () => {
      const sizes: ScrollAreaSizes = {
        viewport: vp.getBoundingClientRect().height / scale,
        content: ct.getBoundingClientRect().height / scale,
      };
      setMeasured(sizes);
      const notify = notifyRef.current;
      const prev = reportedRef.current;
      if (!notify || (prev && prev.viewport === sizes.viewport && prev.content === sizes.content)) {
        return;
      }
      reportedRef.current = sizes;
      notify(sizes);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    // 观察的是**尺寸**，而平移不改变尺寸 —— 所以它不会和 `setMeasured` 互相触发
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(ct);
    return () => ro.disconnect();
  }, [scale]);

  const viewportH = measured.viewport;
  const contentH = contentHeight ?? measured.content;

  const f = Math.min(1, Math.max(0, scroll));
  // 内容不比视口高 → **没得滚**。不是报错：`scroll` 无效、内容不动
  const max = Math.max(0, contentH - viewportH);
  const y = f * max;

  // 滑块长度 = 可见高 / 内容高（下限取轨宽 —— 再短就看不出是一条轨了）；位置 = scroll
  const thumbRatio =
    viewportH > 0
      ? Math.max(railWidth / viewportH, Math.min(1, viewportH / Math.max(1, contentH)))
      : 1;
  const thumbOffset = f * viewportH * (1 - thumbRatio);

  return (
    <div
      style={{
        // 容器类：照组里办（`'auto'`）—— 与 `Panel` 同理，见 `guards/placement.ts`。
        // 它的内层本来就写了 `height: '100%'`，所以它在 `equal` / `fill` 里一直能撑满（实测 150/150）。
        ...placeSelf('auto'),
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {header ? <div style={{flexShrink: 0}}>{header}</div> : null}

      <div
        ref={viewportRef}
        style={{position: 'relative', flex: '1 1 0%', minHeight: 0, overflow: 'hidden'}}
      >
        {/* 内容层：用 `translate` 平移（§6 不许动画 top / left） */}
        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            translate: `0 ${-y}px`,
          }}
        >
          {children}
        </div>

        {rail ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              // 间隙 = 轨宽的 1.5 倍 —— 贴着框边会看起来像被切掉
              right: Math.round(railWidth * 1.5),
              width: railWidth,
              backgroundColor: theme.color.rule,
              borderRadius: railWidth / 2,
              overflow: 'hidden',
            }}
          >
            {/* 滑块：用 `scale` 定长度、`translate` 定位置（同样是为了不碰 height / top） */}
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: theme.color.accent,
                borderRadius: railWidth / 2,
                transformOrigin: 'top center',
                translate: `0 ${thumbOffset}px`,
                scale: `1 ${thumbRatio}`,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * **通用定位计算**：把内容里的某一条放进视口，返回 `ScrollArea` 要的 `0`–`1`。
 *
 * 它**不知道**内容是等高行、是表、是一张图 —— 只知道「那一条在内容里的位置和多大」。
 * 所以「等高行」这种常见情形由调用方一行写出来：`target: offset + index * itemSize`。
 *
 * ```
 * const [sizes, setSizes] = useState<ScrollAreaSizes | null>(null);
 * <ScrollArea scroll={anchorScroll({target: 52 + k * 60, size: 60, content: 772, viewport: sizes?.viewport ?? 0})}
 *             contentHeight={772} onMeasured={setSizes}>…</ScrollArea>
 * ```
 *
 * 四个几何量必须是**同一个坐标空间**（像素）：结构版就是它自己排出来的像素；
 * **素材版（整张截图）要先标源坐标再乘显示 scale** —— 「图里表头多高、行多高」只活在图的像素里，
 * 所以那两个数只能由作者给人肉标注（实测：目测差 1px，第 k 条偏 ≈k px）。
 *
 * ⚠️ **越界就是没有解**，按 `align` 的方向**贴边**（`0` / `1`），不报错 —— 与组件的
 * 「`scroll` 越界夹取」一致。`max = content − viewport`；`y` 必须落在 `[0, max]` 内。
 * 实测：内容 720 / 视口 208 ⇒ `max` 512，能**居中**的只有第 2..9 条（第 0 条与第 11 条无解）。
 */
export const anchorScroll = ({
  target,
  size,
  content,
  viewport,
  align = 'center',
}: {
  /** 目标条目**顶边**在内容里的偏移（像素） */
  readonly target: number;
  /** 目标条目自身的高度（像素） */
  readonly size: number;
  /** 内容总高（像素）。`onMeasured` 的 `content` 或调用方声明的 `contentHeight` 就是真值 */
  readonly content: number;
  /** 视口高（像素）。`onMeasured` 的 `viewport`，或表头写死时作者自己算出来的那个数 */
  readonly viewport: number;
  /** 目标条目落在视口里的位置。默认 `'center'`（讲到哪，哪一条在正中） */
  readonly align?: 'center' | 'start' | 'end';
}): number => {
  const max = Math.max(0, content - viewport);
  if (max <= 0) {
    // 内容不比视口高 ⇒ 没得滚（与组件那句「`scroll` 无效、内容不动」同义）
    return 0;
  }
  const y =
    align === 'start'
      ? target
      : align === 'end'
        ? target + size - viewport
        : target + size / 2 - viewport / 2;
  return Math.min(1, Math.max(0, y / max));
};