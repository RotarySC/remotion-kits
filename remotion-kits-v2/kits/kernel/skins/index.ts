/**
 * **皮** —— 外观的具名预设（T08 裁定）。
 *
 * ## 裁定原文（用户 2026-10-05）
 *
 * > 从已有参考中选一到两种确实有用、差异清楚的外观，验证机制。这个数量只限定首批。
 * > 每种皮只描述实际差异，六组候选字段按需要采用。
 * > 皮通过现有组件能力实现；需要新的装饰能力时，增加一个可组合的小能力。
 * > …皮提供的默认值允许实例覆盖。
 * > 超出预设表达范围时，项目仍可组合 JSX 或修改工程副本。
 * > 选择不存在的皮明确报错；…未使用提示属于维护辅助。
 *
 * 完整记录：`docs/2026-10-05-T08-皮-裁定.md`。
 *
 * ## 首批为什么是这两张（不是四张）
 *
 * 历史四张参考样式（`arch-v4.html`：`plain` / `band-outline` / `corner-marks` / `soft-round`）
 * 里，只有 **`corner-marks`（图 2）** 的**定义性差异**落在「现有能力 ＋ 一件装饰」之内：
 *
 * | 参考 | 定义性差异 | 本批做不做 |
 * | --- | --- | --- |
 * | `plain` | 无 —— 它就是现状 | ✅ **基线**：差异表为空，用来证明「机制本身不动画面」 |
 * | `corner-marks` | 直角 ＋ 四角角标 | ✅ 直角＝已有 `radius`；角标＝**一件**可组合装饰（裁定授权的那个） |
 * | `band-outline` | **通栏头带**（贴框边・带底色） | ❌ 那不是装饰，是**改头的排法**（头与内边距的关系）⇒ 超出「走现有能力」 |
 * | `soft-round` | 柔和模糊阴影 ＋ **彩色标题** ＋ 内嵌 pill | ❌ 彩色标题要 accent 家族 —— 那是**主题字段扩展**，v4/v5 自己就把它划在皮外；混进来会变成「两个都能改颜色」（§9.1 明确不许） |
 *
 * ⚠️ 「一到两种」**只限定首批**（裁定原话）。表是可以长的 —— 长的时候按同一条判据：
 * **定义性差异能不能靠现有能力 ＋ 至多一件小能力表达**；不能，就先别建皮。
 *
 * ## 皮只写「与主题不同的那几项」
 *
 * 六组历史候选字段是 `header` / band 参数 / `divider` / `shadow` / `radius` / `cornerMarks`。
 * 本批**按需要采用两项**（`radius` / `cornerMarks`），其余四项**不采用** ——
 * 不是「暂缺」，是**没有消费者**：`corner-marks` 不需要它们，而
 * §9.2 那条「声明了却没人读的字段是谎话」对皮一样成立。
 *
 * ## 标量归谁：**不归皮**
 *
 * 参考图 2 写的是「1px 细线」。但 `1` 是**标量**，按 §9.2「标量允许读取主题默认值或由实例
 * 明确覆盖」—— 所以它**不进皮表**，由调用处写 `borderWidth={1}`。
 * 皮管**形状与结构的选择**（直角 / 角标），标量管粗细大小。这条分界是**测出来的**：
 * 见 `Panel` 的 `radius` 三级优先（实例 > 皮 > 主题）。
 *
 * ## 谁选皮：**调用处**
 *
 * 皮住在内核、**由调用处点名**（`<Panel skin="corner-marks">`），主题不管这件事 ——
 * 主题给色板 / 字阶 / 动效签名 / 图形标量。这与 §14 阶段 3「主题提供默认倾向，
 * 项目控制时间和局部外观」一致；也是 §9.1 那条「不许变成两个都能改颜色」的唯一落法。
 */

/** 皮的 id。**改这张表 = 改工程的本地形状**（T01：源码分发，工程可自行修改） */
export type SkinId = 'plain' | 'corner-marks';

/** 圆角的三种**语义**取值。`'theme'` 不是「0」，是「这张皮在这一项上**没有主张**」 */
export type SkinRadius = 'theme' | 'square' | 'pill';

/**
 * 一张皮 ＝ **它与主题不同的那几项**。没写的项一律听主题。
 *
 * ⚠️ 这里**只放形状 / 结构的选择**，不放标量、不放色值：
 * 色值由主题给（否则封层检查就废了），标量由主题默认或实例覆盖。
 */
export type Skin = {
  readonly id: SkinId;
  /** 圆角。省略 = 不主张（听主题 `graphic.blockRadius`） */
  readonly radius?: SkinRadius;
  /** 四角角标 —— 一件**外挂装饰**，不改骨架（`skins/CornerMarks.tsx`） */
  readonly cornerMarks?: boolean;
};

/**
 * 皮表。
 *
 * `plain` 的差异表**是空的** —— 这不是省事，是**判据**：机制本身必须不动画面
 * （历史 `arch-v4` 的第 4 条规则：「默认皮 ＝ 现状 → 机制本身不动画面」）。
 */
const SKINS: Readonly<Record<SkinId, Skin>> = {
  plain: {id: 'plain'},
  'corner-marks': {id: 'corner-marks', radius: 'square', cornerMarks: true},
};

/** 全部皮 id。**这个数组是给工具看的**（生成器按 `SKIN_IDS` 发现皮，不靠手写清单） */
export const SKIN_IDS: readonly SkinId[] = ['plain', 'corner-marks'];

/** 缺省皮。**必须是 `plain`** —— 换掉它就等于换掉今天所有画面的长相 */
export const DEFAULT_SKIN_ID: SkinId = 'plain';

/** 语义圆角 → 像素。`'theme'` 没有像素值，落回 `undefined`（调用处再退回主题） */
const SKIN_RADIUS: Readonly<Record<SkinRadius, number | undefined>> = {
  theme: undefined,
  square: 0,
  pill: 999,
};

/**
 * 按 id 取皮。**不存在的名字明确失败**（裁定原文），**不静默退回 `plain`**。
 *
 * ⚠️ 为什么用 `throw` 而不是 `console.warn`：静默回退的症状是「画面看起来正常，
 * 只是不像你以为的那张皮」—— 那种错**不会有人发现**。抛出去则渲染立刻失败，
 * 报错文本里带着可选清单（与 `theme/index.ts` 那句「id 不存在时是类型错误」是两种
 * 场景：那里 id 来自 TS 字面量，这里 id 可能来自项目自己的配置 / 数据）。
 */
export const resolveSkin = (id: string): Skin => {
  const skin = (SKINS as Readonly<Record<string, Skin | undefined>>)[id];

  if (!skin) {
    throw new Error(
      `[kits/skins] 没有这张皮：'${id}'。可选：${SKIN_IDS.join(' / ')}。` +
        `（皮是具名预设 —— 不存在的名字明确失败，不静默退回 '${DEFAULT_SKIN_ID}'）`,
    );
  }

  return skin;
};

/** 皮给的圆角默认值。`undefined` = 这张皮没主张，调用处继续往主题退 */
export const skinRadius = (skin: Skin): number | undefined =>
  skin.radius === undefined ? undefined : SKIN_RADIUS[skin.radius];
