/**
 * 母版层的**槽通用件** —— `lines` 槽的编码解析。
 *
 * `lines` 槽的每一条是 `'主字段\t说明'`，约定写在 `master/types.ts` 顶部。
 *
 * ## 为什么单独一个文件
 *
 * `splitEntry` 是**槽编码约定**的实现，而约定属于「`kind: 'lines'`」这件事、
 * 不属于某一个版式。内核里目前只有 `ListLayout` 消费它，看起来可以内联；
 * 但约定只能有**一份**实现 —— 各版式各写一遍，就是「改一处漏一处」，
 * 而内核已经因为「版式自己解析」这件事吃过一次亏（见 `ListLayout` 的注释）。
 *
 * ## 这里**故意没有**什么
 *
 * 逐条错开的时序（`staggerFrames`）不在本文件里。它是**时序策略**，不是槽编码约定：
 * 目前只有热点解析套件需要（`timeline` / `stance` / `multi-stat` 三个消费者），
 * 内核里一个都没有。按 `references/authoring.md` 步骤 0「复用 ≥2 次就隔离」，
 * 它还不该上升成内核能力 —— 所以它住在那**一个类型包自己的** `master/stagger.ts` 里。
 *
 * 判据是**跨类型包复用**，不是「消费者数量够多」：等第二个类型包也需要它，
 * 再把它移进本文件，那时它才真的是内核能力。
 */

/** `lines` 槽的分隔符。用 TAB 而不是逗号或竖线 —— 文案里出现逗号和竖线是常态，TAB 不会 */
export const SLOT_SEP = '\t';

/**
 * 拆一条 `lines` 槽。
 *
 * 没有分隔符时**整条当说明**（`head` 为空）—— 宁可少显示一个主字段，
 * 也不要把整句话错当成主字段。这是「护栏宁可保守」的同一原则，
 * 也是「普通清单」与「对照清单」能共用同一个版式的原因。
 */
export const splitEntry = (raw: string): {readonly head: string; readonly body: string} => {
  const index = raw.indexOf(SLOT_SEP);

  if (index < 0) {
    return {head: '', body: raw.trim()};
  }

  return {
    head: raw.slice(0, index).trim(),
    body: raw.slice(index + 1).trim(),
  };
};
