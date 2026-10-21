/**
 * 热点解析的槽契约 —— **只声明本类型特有的三个版式**。
 *
 * 通用的 6 个（`cover` / `headline` / `list` / `stat` / `quote` / `closing`）由**内核**提供
 * （`kits/kernel/master/types.ts` 的 `LAYOUT_SPECS`），这里**不重复一份** ——
 * 内核是它们的唯一权威来源，复制一份就是「改一处漏一处」。
 *
 * `FurnitureConfig` 同理：内核那部分（报头 / 页脚 / 两个通用插槽）原样继承，
 * 这里只用 `&` 追加本类型的两件家具。
 *
 * **九个版式 = 内核的 6 个 + 本类型特有的 3 个**（`timeline` / `stance` / `multi-stat`）。
 * 后三个正是本套件存在的理由 —— 「事件脉络」「各方立场」「多个数字并列」
 * 这三种信息形态，内核那 6 个装不下（见 `creation-workflow.md` 第 1 步的拆解）。
 *
 * **`lines` 槽的编码约定**：每条用 **TAB**（`\t`）分隔「主字段」与「说明」。
 * 用 TAB 而不是逗号或竖线 —— 文案里出现逗号和竖线是常态，TAB 不会。
 * 例：`'09-18 14:20\t官方通报首次发布'`。
 * 解析只有一份实现：内核的 `master/slots.ts` 的 `splitEntry`。
 */

import type {
  FurnitureConfig as KernelFurniture,
  LayoutSpec,
} from '../../kernel/master/types';

/** 母版家具 —— 内核那部分 **加上** 本类型特有的两件 */
export type FurnitureConfig = KernelFurniture & {
  /**
   * **本类型特有**：事件当前时间戳。
   *
   * 热点是**在推进的** —— 「事件第几天 / 最后更新时间 / 处在哪个阶段」每期都在，
   * 所以它属于家具而不是场景内容。占报头带的第二行（内核的 `headExtra` 插槽）。
   */
  readonly eventStamp?: {
    /** 如「事件第 3 天」 */
    readonly elapsed: string;
    /** 如「2026-09-18 14:20 更新」 */
    readonly updatedAt: string;
    /** 阶段标签，如「发酵期」。可选 */
    readonly phase?: string;
  };
  /**
   * **本类型特有**：消息来源与可信度。
   *
   * 热点解析的可信度是内容的一部分，不能只在文案里写一句。
   * 渲染在页脚**左侧**（内核的 `footExtra` 插槽）；给了它就**忽略** `footer.left`
   * —— 两者抢同一个位置（那条规则写在内核的 `FooterRail` 里）。
   */
  readonly source?: {
    readonly name: string;
    /** 缺省视为 `medium`。只影响徽章的强调程度，不引入新色值 */
    readonly credibility?: 'high' | 'medium' | 'low';
  };
};

/** 本类型特有的版式名。内核那 6 个不在这里 —— 它们归内核 */
export type LayoutName = 'timeline' | 'stance' | 'multi-stat';

export const LAYOUT_SPECS: Record<LayoutName, LayoutSpec<LayoutName>> = {
  timeline: {
    name: 'timeline',
    purpose: '事件脉络：一条时间线从起点推演到当前',
    slots: [
      {name: 'title', kind: 'text', required: true, overflow: 'fit-n-lines', note: '脉络标题'},
      {
        name: 'events',
        kind: 'lines',
        required: true,
        overflow: 'fit',
        note: "每个节点 = '时刻\\t事件'，最多 6 个",
      },
      {name: 'note', kind: 'meta', required: false, overflow: 'clamp', note: '补充说明'},
    ],
  },
  stance: {
    name: 'stance',
    purpose: '各方说法：一个议题 + 若干方立场并列',
    slots: [
      {name: 'topic', kind: 'text', required: true, overflow: 'fit-n-lines', note: '争议的那个问题'},
      {
        name: 'sides',
        kind: 'lines',
        required: true,
        overflow: 'fit',
        note: "每方 = '主体\\t说法'，2–3 方",
      },
      {name: 'note', kind: 'meta', required: false, overflow: 'clamp', note: '补充说明'},
    ],
  },
  'multi-stat': {
    name: 'multi-stat',
    purpose: '多个数字并列 + 一个共同标签',
    slots: [
      {name: 'label', kind: 'text', required: true, overflow: 'fit', note: '这几个数字共同说明什么'},
      {
        name: 'items',
        kind: 'lines',
        required: true,
        overflow: 'fit',
        note: "每个 = '数值\\t说明'，2–4 个",
      },
      {name: 'unit', kind: 'text', required: false, overflow: 'fit', note: '共同单位 / 后缀。**只有全部数字同单位时**才用；单位不一致就把单位写进每个数值里'},
      {name: 'note', kind: 'meta', required: false, overflow: 'clamp', note: '补充说明'},
    ],
  },
};

/**
 * 本类型版式的候选顺序。
 *
 * 三个版式都插在**举证段** —— 它们是「这条新闻靠什么站住」的那一段，
 * 位置在内核的 `stat` 与 `quote` 之间（内核那个 `LAYOUT_ORDER` 管它自己那 6 个）。
 */
export const LAYOUT_ORDER: readonly LayoutName[] = ['timeline', 'stance', 'multi-stat'];
