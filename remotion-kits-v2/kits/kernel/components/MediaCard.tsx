import React from 'react';
import {MediaStage} from './MediaStage';
import type {MediaRect} from './MediaStage';

/**
 * ⚠️ **这些 prop 必须逐条列出来，不能写成 `Omit<…> & {…}`。**
 *
 * 展示页生成器读的是**源码里的 `type Props = {…}` 字面文本**（`Parse-ComponentSpecs`），
 * 用 `Omit` / 交叉类型写，它只读得到 `from` / `to` / `focus`，
 * 于是把 `src` / `fit` / `label` 这些**真实存在的 prop 报成「没写进 COMPONENT_SPECS」**。
 * 代价是：`MediaStage` 将来加 prop，这里要**同步列一遍**。
 */
type Props = {
  /** 图片 / 视频地址。给了它就忽略 `children` */
  readonly src?: string;
  /** 媒体类型。给了 `src` 就必须给 */
  readonly kind?: 'image' | 'video';
  /** 没有 `src` 时渲染的内容 */
  readonly children?: React.ReactNode;
  /** 内容怎么填进框 */
  readonly fit?: 'cover' | 'contain';
  readonly label?: string;
  readonly source?: string;
  /** 标签字号（像素）。省略则取框高的 5% */
  readonly labelFontSize?: number;
  /** 描边色。省略取主题 `color.accent` */
  readonly borderColor?: string;
  /** 描边粗细（像素）。省略取主题 `graphic.accentBar` */
  readonly borderWidth?: number;
  /** 圆角（像素）。省略取主题 `graphic.blockRadius` */
  readonly radius?: number;
  /** 框底色。省略取主题 `color.bg` */
  readonly background?: string;
  /**
   * 标签条贴哪条边。
   *
   * `'auto'` = **静止在下沿、一进展开态就换到上沿**（判据是 `focus > 0`）。
   * 迷你态读作「缩略图 + 图说」，展开态读作「窗口 + 标题栏」。
   * 这是**声明**出来的行为，不是猜的：不写 `'auto'` 就一直是同一侧。
   *
   * ⚠️ 判据必须是「**在不在展开态**」，不能是「**展开到几成**」。
   * 用 `focus ≥ 0.5` 时那次换边落在连续补间的**正中间** —— 看到的是标题在飞行途中
   * 从下沿跳到上沿。换边本来就是一次**离散**变化，离散变化要落在**边界**上：
   * `focus` 一离开 0 就已经是展开态了，所以换边也发生在那一帧。
   */
  readonly labelPlacement?: 'bottom' | 'top' | 'auto';
  /** 静止时的矩形（帧坐标，像素） */
  readonly from: MediaRect;
  /** 完全展开后的目标矩形（帧坐标，像素） */
  readonly to: MediaRect;
  /** `0` = 停在 `from`，`1` = 完全到 `to`，中间值就是补间进度 */
  readonly focus?: number;
};

/**
 * **迷你多媒体框** —— 一个 16:9 的小框，带**缩放特性**：讲到它时长大并移到别处。
 *
 * 内部就是一个 `MediaStage`（框本体只有一份，不复制），外面套一层定位。
 *
 * ## 为什么是绝对件，以及为什么 `from` / `to` 都由调用方给
 *
 * 组件在渲染路径里**不许测量**（`component-contract.md` §6）。而「长大并移到画面中心」
 * 要求知道**它现在在哪**——那正是测量才能得到的。所以答案不是测量，而是**让它不依赖测量**：
 *
 *   * 它按**帧坐标**把自己绝对定位在 `from` → `to` 之间插值出来的矩形上；
 *   * 两个矩形都是**调用方给的**，组件不推断、不校验（也给不了）。
 *
 * 这与展示页 `ElementCell` 那条同源：「**元素自己没有位置，必须指定一个**」。
 * 实际使用里，多个迷你框本来就是手工排版的绝对件（样例视频里那三个就是），
 * 所以 `from` 不是额外负担，它就是那次的排版结果。
 *
 * 也正因为它是绝对件，`components/specs.tsx` 把它的 `display` 声明成 **`container`**：
 * 那不是「它是容器」的意思，而是「**宿主必须给它整块画布**」—— 不给，它就没法按帧坐标定位。
 *
 * ## 不做缓动
 *
 * `focus` 是**驱动量**，与 `ProgressBar` 的 `progress` 同理：组件只负责把它映射成几何，
 * 缓动由调用方决定（想匀速就匀速，想回弹就回弹）。组件替调用方选一条曲线，
 * 就是替它决定了节奏 —— 而节奏属于这一支片子，不属于套件。
 *
 * ## 补间的是 `left/top/width/height`，不是 `transform: scale`
 *
 * 用 `transform` 就得管 `transform-origin`、单位、以及 `scale` 的 `perceptual-scale`；
 * 直接插值盒子尺寸没有这些坑，而且 `from` / `to` 都是 16:9 时画面不会拉伸。
 * 代价是它**每帧都在重排**（不是合成层动画）—— 对这种数量级（几个框）无所谓。
 *
 * ## 展开的框盖住没展开的
 *
 * 「移到画面正中」如果不带层序，结果就是**被右列那两个静止框压住**（实测如此，一眼可见）。
 * 组件不认兄弟，但它认识**自己的** `focus`：**展开度就是层序**，与位置同源 ——
 * 和 `from` / `to` 一样，这不是新增的输入，只是把同一个驱动量多映射一个输出。
 *
 * 用 `Math.ceil` 而不是 `Math.round`：要的不变式是 **`focus > 0` ⟺ `z > 0`**。
 * `round` 在极小的 `focus` 上会退化成 0、与静止框并列，于是展开的头一两帧仍会被盖住。
 * 静止时全是 0 —— 仍由 **DOM 顺序**决定，静止排版与加这一条之前完全一致。
 *
 * 想让某个静止框压在展开框之上（比如它是一层 UI），把那个框**包一层带 `z-index` 的
 * 外壳**即可；组件不提供「层序」这个 prop，因为展开态本该就在最上面，那是这个交互的定义。
 */
export const MediaCard: React.FC<Props> = ({
  from,
  to,
  focus = 0,
  labelPlacement = 'bottom',
  ...media
}) => {
  // 只夹不缓动 —— 见上面「不做缓动」
  const f = Math.min(1, Math.max(0, focus));
  const at = (a: number, b: number) => a + (b - a) * f;

  const rect = {
    x: at(from.x, to.x),
    y: at(from.y, to.y),
    width: at(from.width, to.width),
    height: at(from.height, to.height),
  };

  // 换边的判据是「在不在展开态」，不是「展开到几成」—— 见上面 `labelPlacement` 的说明
  const place = labelPlacement === 'auto' ? (f > 0 ? 'top' : 'bottom') : labelPlacement;

  // 展开度就是层序 —— 见上面「展开的框盖住没展开的」
  const z = Math.ceil(f * 100);

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: z,
      }}
    >
      <MediaStage
        {...media}
        width={rect.width}
        height={rect.height}
        labelPlacement={place}
      />
    </div>
  );
};
