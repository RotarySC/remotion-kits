/**
 * 热点解析的**时序策略** —— 逐条错开的帧间隔，按场景时长收紧。
 *
 * ## 为什么住在类型包里，而不是内核的 `master/slots.ts`
 *
 * 它是**时序策略**，不是槽编码约定。目前只有本套件需要（`timeline` / `stance` /
 * `multi-stat` 三个消费者），内核里一个都没有。按 `references/authoring.md` 步骤 0
 * 「复用 ≥2 次就隔离」，它不该为了「以后可能有人用」而上升成内核能力 ——
 * 判据是**跨类型包复用**，不是「消费者数量够多」。
 * 等第二个类型包也需要它，再移进内核的 `slots.ts`。
 *
 * 名字与内核的 `slots.ts` 分开，是为了让「内核的东西」与「本类型的东西」
 * 一眼可分 —— 同名不同内容才是分叉的来源。
 */

/**
 * 逐条错开的帧间隔 —— **按场景时长收紧**。
 *
 * 固定间隔配长清单，会让最后几条来不及出现；这是母版层已经踩过一次的缺陷
 * （见 `references/master-contract.md` 第 2 节）。所以这里用「预算 ÷ 条数」压住基础间隔：
 * 场景短就自动挤紧，场景长才用主题声明的间隔。
 *
 * ⚠️ **显式给的节奏不参与收紧** —— 收紧是系统对**自己的默认值**做的事，
 * 不是替调用方改他给的数（见 `references/master-contract.md`）。
 * **T06 已于 2026-10-05 裁定为这一侧**；溢出的代价由**各版式**调
 * `kernel/guards/diagnostics.ts` 的 `warnIfStaggerOverflows` 顶上（不改行为，只喊一声）。
 * 本文件**不做**那个诊断 —— `lead` 与入场时长是各版式的内联值，只有版式自己知道。
 *
 * @param base             主题声明的错开帧数（`theme.motion.stagger`）
 * @param count            条数
 * @param durationInFrames 当前序列的时长（`useVideoConfig().durationInFrames`）
 * @param hold             给最后一条预留的入场完成时间（帧）
 */
export const staggerFrames = (
  base: number,
  count: number,
  durationInFrames: number,
  hold = 34,
): number => {
  if (count <= 1) {
    return base;
  }

  const budget = Math.max(0, durationInFrames - hold);

  return Math.min(base, budget / (count - 1));
};
