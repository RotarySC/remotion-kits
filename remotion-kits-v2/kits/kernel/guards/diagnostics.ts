/**
 * **开发期诊断** —— 系统「看出来了」但**不该替调用方改**的那些事，喊一声。
 *
 * ## 为什么需要它，以及为什么是现在
 *
 * 2026-10-05 的实测（`docs/2026-10-05-阶段2-局部实现-实测证据.md`）量到四处**静默**：
 * 比例非正数被兜成 1、`align` 被 `sizing` 吃掉、`fill` 在 auto 父级里退化、
 * 子项包在 Fragment 里被数成 1 个（整组变竖排）—— 四处都**不报错、画面照出**。
 * 同时量到 T06 的静默：显式节奏让末条来不及出现时，**后四条永不出现，也不报错**。
 *
 * 架构基线 §13 的 T05 要的是「明确诊断／类型限制／公开优先级」三选一。
 * 裁定取的是**明确诊断**：类型限制那条路会让生成器的「声明 ↔ 源码」正则校验失效
 * （见 `kit.md` 关于联合类型那段），而「公开优先级」正是现在的静默本身。
 *
 * ## 两条纪律
 *
 * 1. **同一个问题只喊一次** —— Remotion 逐帧重跑渲染，不去重就是每帧一条，日志直接没用。
 * 2. **不走 `NODE_ENV` 开关** —— 出片日志是出问题时唯一的现场。
 *    而且 `showcase/verify.mjs` 有一条「console error/warning 为 0」的断言盯着它：
 *    **「该喊的时候喊、不该喊的时候不喊」这件事是被测着的**，不是靠自觉。
 */

const warned = new Set<string>();

/**
 * 同一个 `key` 只发一次（跨帧、跨组件实例都算）。`key` 要能区分不同的**问题**，
 * 而不是不同的**渲染**。
 */
export const warnOnce = (key: string, message: string): void => {
  if (warned.has(key)) {
    return;
  }
  warned.add(key);
  console.warn(`[套件] ${message}`);
};

/**
 * T06 的判据：**显式节奏会不会让末条来不及出现**。
 *
 * 政策本身（2026-10-05 裁定）：**显式给的值原样生效、不参与收紧** ——
 * 收紧是系统对**自己的默认值**做的事，不是替调用方改他给的数。
 * 代价是显式值可以溢出场景，而溢出的表现是「最后几条永不出现」，**看着像没写**。
 * 所以这里把溢出这件事**喊出来**：不改行为，只把静默变成可见。
 *
 * ⚠️ 四个版式各有自己的 `lead` 与入场时长（它们**不是**同一个公式，见设计文档 §5.3
 * 「不统一那两份收紧公式」）—— 所以这两个数由调用方给，本函数不假设。
 *
 * @param who                    版式名（进日志，便于定位）
 * @param stagger                最终生效的错开帧数（显式值或收紧后的默认值）
 * @param count                  条数
 * @param durationInFrames       当前序列的时长（`useVideoConfig().durationInFrames`）
 * @param lead                   首条起始前的静场（帧）
 * @param enterDurationInFrames  单条入场长度（帧）
 */
export const warnIfStaggerOverflows = ({
  who,
  stagger,
  count,
  durationInFrames,
  lead,
  enterDurationInFrames,
}: {
  readonly who: string;
  readonly stagger: number;
  readonly count: number;
  readonly durationInFrames: number;
  readonly lead: number;
  readonly enterDurationInFrames: number;
}): void => {
  if (count <= 1) {
    return;
  }

  const lastStart = Math.round(lead + (count - 1) * stagger);
  const lastEnd = lastStart + enterDurationInFrames;
  if (lastEnd <= durationInFrames) {
    return;
  }

  const overflow = lastEnd - durationInFrames;
  warnOnce(
    `stagger:${who}:${stagger}:${count}:${durationInFrames}`,
    `${who}：末条来不及出现 —— 第 ${lastStart} 帧起、到第 ${lastEnd} 帧才入场完，` +
      `而这段场景只有 ${durationInFrames} 帧（超出 ${overflow} 帧）。` +
      `显式给的节奏**不参与收紧**，所以后面这几条会是空的。` +
      `调小 staggerInFrames，或把这一段场景拉长。`,
  );
};
