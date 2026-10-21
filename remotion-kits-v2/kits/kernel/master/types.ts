/**
 * 母版类型契约。
 *
 * `LAYOUT_SPECS` 是**机器可读**的版式注册表：每个版式的槽、必填性、溢出策略。
 * 它本身就是正式契约；若将来要做「内容 → 版式分配」，消费它而不是靠猜。
 *
 * **`lines` 槽的编码约定**：每条用 **TAB**（`\t`）分隔「主字段」与「说明」。
 * 用 TAB 而不是逗号或竖线 —— 文案里出现逗号和竖线是常态，TAB 不会。
 * 例：`'本地打包\t客户端扫描工作区…'`。
 *
 * 解析只有一份实现：`master/slots.ts` 的 `splitEntry`。
 * **`kind: 'lines'` 的槽，消费方必须解析它** —— 直接把整条字符串交给浏览器，
 * TAB 会被 HTML 塌缩成一个空格，主字段与说明的区别在视觉上完全消失（本套件踩过）。
 */

import type {ReactNode} from 'react';

/**
 * 固定家具的内容。全部可选 —— 不传就不渲染那件家具。
 *
 * **`headExtra` / `footExtra` 是通用插槽**：类型包自己的家具（时间戳、来源徽章、
 * 状态灯…）挂在这里，内核只知道「这一带上有没有东西」，不认识具体是哪一件。
 * 内核因此不反向依赖任何类型包（见架构基线 §3.1 的归属表）。
 */
export type FurnitureConfig = {
  /** 报头：名称 + 右侧元信息（期号 / 日期 / 品类） */
  readonly masthead?: {
    readonly title: string;
    readonly meta?: string;
  };
  /** 报头带的第二行。类型包自己的常在元素 */
  readonly headExtra?: ReactNode;
  /** 页脚：规则线 + 可选进度分段 + 左右两段小字 */
  readonly footer?: {
    readonly left?: string;
    readonly right?: string;
    /** 进度：当前段 / 总段。省略则不画分段 */
    readonly progress?: {
      readonly current: number;
      readonly total: number;
    };
  };
  /** 页脚左侧那一格。给了它就顶掉 `footer.left` */
  readonly footExtra?: ReactNode;
};

export type LayoutName = 'cover' | 'headline' | 'list' | 'stat' | 'quote' | 'closing';

export const LAYOUT_NAMES: readonly LayoutName[] = [
  'cover',
  'headline',
  'list',
  'stat',
  'quote',
  'closing',
];

export type SlotKind = 'text' | 'lines' | 'number' | 'meta';

/** 溢出策略，对应母版契约第 5 节 */
export type SlotOverflow = 'fit' | 'fit-n-lines' | 'clamp' | 'none';

export type SlotSpec = {
  readonly name: string;
  readonly kind: SlotKind;
  readonly required: boolean;
  readonly overflow: SlotOverflow;
  readonly note: string;
};

/**
 * 版式的槽契约。`name` 泛化到 `N`，所以**类型包能声明自己的版式名**而不必
 * 复制这个形状，也不必把自己的名字塞进内核的联合类型（见架构基线 §3.1）。
 */
export type LayoutSpec<N extends string = LayoutName> = {
  readonly name: N;
  readonly purpose: string;
  readonly slots: readonly SlotSpec[];
};

/**
 * 调用方的**控制参数** —— 与内容槽住在同一个 props 上，但**性质不同**（T09 裁定）：
 *
 * | | 装的是什么 | 例子 |
 * | --- | --- | --- |
 * | **内容槽**（`slots` 里那些） | 这次**要说什么** —— 作品内容 | `title` / `items` / `events` |
 * | **控制参数**（本列表） | 这次**怎么排** —— 不含任何内容 | `staggerInFrames` |
 *
 * **`LAYOUT_SPECS` 只装内容槽，不收控制参数。** 判据是那句话本身能不能成立：
 * 注册表回答的问题是「**这个版式有哪些槽**」，而槽＝内容；把节奏参数混进去，
 * 这个问题的答案就不再是「要说什么」，而是「要说什么 ＋ 怎么排」。
 *
 * 消费方（场景类型 / 槽声明审计器）拿这份声明**先把两类分开，再各自比对** ——
 * 分开之前比，会得到一个看起来像缺陷的读数（T09 材料里就发生过一次，见 AGENTS）。
 *
 * ⚠️ 今天只有 `staggerInFrames` 一个。它**跨两侧**存在（内核的 `ListLayout` 与类型包的
 * `TimelineLayout` / `StanceLayout` / `MultiStatLayout`），所以这份声明住在**内核**；
 * 出现第二个时再考虑分组。
 */
export const LAYOUT_CONTROL_PROPS = ['staggerInFrames'] as const;
export type LayoutControlProp = (typeof LAYOUT_CONTROL_PROPS)[number];

export const LAYOUT_SPECS: Record<LayoutName, LayoutSpec> = {
  cover: {
    name: 'cover',
    purpose: '开篇：一句话立住主题',
    slots: [
      {name: 'kicker', kind: 'text', required: false, overflow: 'fit', note: '眉题，几个字'},
      {name: 'title', kind: 'text', required: true, overflow: 'fit-n-lines', note: '主标题'},
      {name: 'meta', kind: 'meta', required: false, overflow: 'fit', note: '日期 / 期号 / 来源'},
    ],
  },
  headline: {
    name: 'headline',
    purpose: '头条：序号 + 标题 + 摘要',
    slots: [
      {name: 'index', kind: 'meta', required: false, overflow: 'none', note: '如 01'},
      {name: 'title', kind: 'text', required: true, overflow: 'fit-n-lines', note: '头条标题'},
      {name: 'summary', kind: 'text', required: false, overflow: 'clamp', note: '两三行摘要'},
    ],
  },
  list: {
    name: 'list',
    purpose: '条目清单：一个标题 + 若干条',
    slots: [
      {name: 'title', kind: 'text', required: true, overflow: 'fit', note: '清单标题'},
      {name: 'items', kind: 'lines', required: true, overflow: 'fit', note: '条目文字数组'},
    ],
  },
  stat: {
    name: 'stat',
    purpose: '数据：一个数字 + 说明',
    slots: [
      {name: 'value', kind: 'number', required: true, overflow: 'fit', note: '数字主体'},
      {name: 'unit', kind: 'text', required: false, overflow: 'fit', note: '单位 / 后缀'},
      {name: 'label', kind: 'text', required: true, overflow: 'fit', note: '这个数字是什么'},
      {name: 'note', kind: 'meta', required: false, overflow: 'clamp', note: '补充说明'},
    ],
  },
  quote: {
    name: 'quote',
    purpose: '引述：一句话 + 出处',
    slots: [
      {name: 'text', kind: 'text', required: true, overflow: 'fit-n-lines', note: '引文'},
      {name: 'attribution', kind: 'meta', required: false, overflow: 'fit', note: '出处'},
    ],
  },
  closing: {
    name: 'closing',
    purpose: '收束：一句总结 + 元信息',
    slots: [
      {name: 'title', kind: 'text', required: true, overflow: 'fit-n-lines', note: '结语'},
      {name: 'meta', kind: 'meta', required: false, overflow: 'fit', note: '下期预告 / 号召 / 署名'},
    ],
  },
};

/** 版式分配用的候选顺序：若将来实现数据层，按需从这里挑 */
export const LAYOUT_ORDER: readonly LayoutName[] = [
  'cover',
  'headline',
  'list',
  'stat',
  'quote',
  'closing',
];