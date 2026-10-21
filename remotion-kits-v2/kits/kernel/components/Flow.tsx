import React from 'react';
import {warnOnce} from '../guards/diagnostics';
import {crossVars} from '../guards/placement';
import {useTheme} from '../theme/context';

/**
 * 主轴上的**一项**怎么取得空间（U2）：
 *
 *   * `'content'` —— 这一项**按自己的内容**取得主轴尺寸，**不参与**剩余空间的权重分配；
 *   * 正数 —— 扣除内容轨道与间距之后，按这个**权重**分剩余空间。⚠️ **不是像素**。
 *
 * 例：`[1, 'content']` ＝ 上卡吃剩余、下卡按内容；`['content', 2, 1]` ＝ 一项内容占位，
 * 其余两项按 2:1 分剩余。`direction` 决定主轴是宽还是高。
 */
export type FlowTrack = number | 'content';

type Props = {
  /** 主轴方向。默认 `'row'` */
  readonly direction?: 'row' | 'column';
  /**
   * 主轴上各子项的**相对比例**（如 `[2, 1]`）。省略 = 等分（见下面「轴」一节）。
   *
   * ⚠️ 长度与子项数不一致时：**多出的忽略、缺的按 1 算**，非正数也按 1 算 ——
   * 两条都是**静默兜底**，所以现在会**在开发期警告一次**（`console.warn`，画面不受影响）。
   * 演示合成里另摆了一个不匹配的对照，让它在展示页上看得见（`kit.md` 的已知限制）。
   */
  readonly ratio?: readonly number[];
  /**
   * **混合主轴轨道**（U2，2026-10-06）：把主轴上**每一项**显式点名 —— 见 `FlowTrack`。
   *
   * ```
   * <Flow direction="column" sizing="fill" tracks={[1, 'content']}>
   *   <Panel>{mainContent}</Panel>     ← 吃剩余高度
   *   <Panel>{footerContent}</Panel>   ← 按内容取高
   * </Flow>
   * ```
   *
   * ⚠️ **与 `ratio` 互斥**（两个都表示「主轴怎么分」）。类型上排除双传；绕过类型硬传时
   * 以 `tracks` 为准并喊一条诊断，**不静默二选一**。
   *
   * ⚠️ **`column` 下必须配 `sizing="fill"`**（并让上层给出确定的主轴空间）：`fr` 要有
   * 「可分的确定空间」才成立 —— 高度不定时 `fr` 行会**全部塌成最高者**（文件头「轴」那节
   * 量到过：三枚 470px 的内容被撑成 754px）。这一条**只为 `column` 配诊断**：`row` 的主轴
   * （宽）是块级元素天然拿到的确定尺寸，与 `sizing`（管交叉轴）无关 —— 给它也喊就是**假警报**。
   *
   * ⚠️ **兜底沿用 `ratio` 那条原则**（多的忽略、缺的与无效的按**权重 1**），并配开发期警告。
   * ⚠️ 它**不改变**格子内部的对齐入口（`sizing` / `align` 各管各的），也不替子项决定文字或
   * 素材怎么响应 —— 那是子项自己的事。
   */
  readonly tracks?: readonly FlowTrack[];
  /** 子项之间的间距（像素）。省略取主题的 `space.gap` */
  readonly gap?: number;
  /**
   * **三档尺寸语义**（明确的三个词，不靠隐式行为）。它管的是**交叉轴**：
   *
   *   * `'natural'`（默认）—— 交叉轴按**子项自己的内容**（参差）；
   *   * `'equal'`   —— 交叉轴**取组内最大者**（行里是等高；列里是等宽）；
   *   * `'fill'`    —— 交叉轴**撑满本组被给到的那条轴**。
   *
   * ⚠️ **三个词说的都是「格子」，不是「格子里那件东西」**（T04 裁定，2026-10-05）。
   * 于是 `'equal'` 承诺的是**等高格子**，不保证三枚标签看起来一样高 ——
   * 要真等高，用容器类子项（`Panel`）或用显式布局条目。
   *
   * 于是 `row` 下它管高、`column` 下它管宽 —— 同一个词在两轴上各自落到同一个概念（交叉轴）。
   *
   * ⚠️ `'fill'` 要求**本组能被撑开**（放在有确定高度的父级里）。父级高度是 `auto` 时
   * 百分比高度按 CSS 解析为 `auto`，本组就只剩交叉轴的拉伸 —— **实测那等于 `'equal'`**：
   * 三条会同高，因为 `stretch` 仍然在起作用。**这条只能由契约写明** ——
   * 组件在渲染期测不出「你没给我高度」。
   *
   * ⭐ **`'fill'` 会把「被给到的那条轴」传给自己的行**（2026-10-06 修）：父级给的是**确定高度**时，
   * 本组的行也写成 `minmax(0, 1fr)`，于是 `Flow` 套 `Flow` 时内层**真的能等分**它那一格
   * （读数：外壳 300 ⇒ 内层两块 **136.0 / 136.0**）。修之前只写 `height: 100%`，
   * 而本组自己的隐式 `auto` 行在「内容比被给到的那条轴高」时按内容算 ⇒ 连带溢出（实测 **+43.1px**）。
   * 详见文件头「嵌套」一节。
   */
  readonly sizing?: 'natural' | 'equal' | 'fill';
  /**
   * 交叉轴对齐。**省略 = 不表态** —— 每个子项用自己的自然默认（见 `placement.ts`）。
   *
   * ⚠️ 与早先的行为不同，两处：
   *
   *   1. 省略时不再是「一律 `'start'`」：`equal` / `fill` 下格子仍被拉齐，
   *      但**格子里面**那件东西由它自己决定填不填 —— 一枚行内标签不该被拉成色块；
   *   2. 给了它就**一定生效**。以前 `equal` / `fill` 时 `align` 会被吃掉
   *      （只报一条开发期警告），因为那时「拉伸」写在容器上、够不着子项。
   *      现在它写进 `--kit-align`，元素读得到。
   *
   * 一句话：**`sizing` 管格子，`align` 管格子里面**。
   */
  readonly align?: 'start' | 'center' | 'end' | 'stretch';
  readonly children?: React.ReactNode;
};

/**
 * **主轴怎么分**这件事只有一种说法，两个入口互斥（U2）。写成联合而不是靠一句注释：
 * 双传在 `tsc` 那一步就报错（`TS2322`），不会走到运行期才发现「用哪个」。
 * ⚠️ 这与 T05 的「明确诊断」不冲突 —— 类型限制是**给写代码的人**的，运行期那条诊断
 * 是给**绕过类型的人**的（`as any` / 从 JSON 来的配置），两条都留着。
 */
type TrackProps =
  | {
      readonly ratio?: readonly number[];
      readonly tracks?: never;
    }
  | {
      readonly ratio?: never;
      readonly tracks: readonly FlowTrack[];
    };

/**
 * 对外类型 ＝ 上面那块 `Props` ∩ `TrackProps`（互斥就在这里表达）。
 *
 * ⚠️ **为什么不直接改 `Props`**：展示页生成器按正则 `type Props = \{…\n\};` 读这一块
 * 来做「声明 ↔ 源码」校验 —— 上一条把 `Props` 改名成 `CommonProps` 之后，两个套件
 * 各多出一条 WARN（「Flow 里找不到 type Props，无法校验声明」），而那正是**验收判据**
 * （生成器 0 WARN）。所以互斥挂在**另起的一个类型**上，`Props` 这一块保持生成器认得的形状。
 */
type FlowProps = Props & TrackProps;

/**
 * 排列容器 —— 一屏里的**相对位置与比例**，由一个容器统一表达。
 *
 * ## 它解决什么
 *
 * 在这之前，「三张等宽卡」「主 2 : 侧 1」只能靠**手写 flex**：调用方要给每个子项套一层壳、
 * 自己写 `flex: '2 1 0'`、自己处理 `min-width: 0`（否则长内容会把轨道撑爆）。
 * 那是每个片子都要重写一遍的**形** —— 而形应该写一次。
 *
 * ## 它不解决什么（有意）
 *
 * * **不决定「组画在画面的哪里」** —— 那归母版 / 场景。与 `Panel` 同一条立场：
 *   一旦组件知道自己在画面里站哪儿，就会和母版的位置打架；
 * * **不给子项注入样式** —— 用 `grid` + `fr` 轨道，所以调用方**不必知道**子项是什么元素，
 *   也不用给它加任何 prop（`cloneElement` 那条路对 Fragment / 自定义组件是脆的）；
 * * **不持有内容** —— 摆什么、几个，是调用处的事（`children` 的顺序就是位置）。
 *
 * ## 轴：两个轴各有一句话（2026-10-05 按实测改过）
 *
 * ```
 * 交叉轴  —— 永远由 `sizing` 决定（natural / equal / fill 都作用在这里）
 * 主轴    —— 只有在「有东西可分」的时候才分：`ratio` 给了就按比例分
 * ```
 *
 * `row` 的宽度是块级元素天然拿到的**确定尺寸**，所以省略 `ratio` 时主轴按 `1fr` 等分
 * （「三张等宽卡」就是这么来的）。
 *
 * ⚠️ `column` 的高度**不是**天然确定的 —— 旧实现照样写 `gridTemplateRows: minmax(0, Nfr)`，
 * 而 `fr` 在不定高容器里按「max(内容 ÷ flex) × flex」解析，后果实测是：
 * **每一行都等于最高的那条，组高 = 条数 × 最高者**（三枚内容合计 470px 的格子被撑到 754px）。
 * 也就是说 `column` 下那个词叫 `natural` 却不 natural。
 * 现在改成：**`ratio` 缺省时不写主轴轨道**，行按内容高（`auto`）——
 * `column` 的 `natural` 终于是真的 natural，`fill` 也仍靠 `height: 100%` 撑满。
 *
 * ## 嵌套：`fill` 要把那条轴**传下去**（2026-10-06 修，实测读数在 `docs/2026-10-06-G15-嵌套fill-缺陷与修法.md`）
 *
 * 修之前，`fill` 只对本组做一件事：写 `height: 100%`（占满被给到的那条轴）。可它**自己的行**
 * 还是隐式 `auto` —— 于是「确定高度」传不到格子里：
 *
 * ```
 * 外层 row fill（外壳 300 确定）
 *   └─ 内层 column fill（写 height:100% + grid-auto-rows: minmax(0,1fr)）
 *        隐式 auto 行「按内容算」；而 `fr` 在不定高里会把**每一行都撑成最高的那条**
 *        ⇒ 内层的内容高报成 343.125 > 300 ⇒ 外层那一行按 343.125 算 ⇒ **整组溢出 43.1px**
 * ```
 *
 * ⚠️ **它是「条件性」缺陷**：外壳 300 时溢出，**外壳 400 时完全正常**（343.125 < 400，
 * 有剩余空间 ⇒ `auto` 行被拉长 ⇒ 确定高度才落到格子里）。所以只量一档高度分不出
 * 「溢出」与「内容高」两种读法 —— 两档都要量。
 *
 * 修法是一行：`fill` 时**本组的行也写成 `minmax(0, 1fr)`**（`row` 下是 `gridAutoRows`，
 * `column` 下本来就有这一句）。父级高度确定 ⇒ 行 ＝ 被给到的那条轴；不确定 ⇒ `fr` 与 `auto`
 * 等价（同一档退化，不变差）。读数：外壳 300 ⇒ 内层组 **300.0**、两块 **136.0 / 136.0**。
 *
 * ⚠️ **仍然没有词能表达 P4 那种「上卡吃剩余、下卡自然高」**：`fill` 是**等分**、
 * `natural` 在确定高度的组里会**平分剩余**、`ratio` 只能给比例（读数见同一份记录）。
 * 这是**能力缺口**，不是本缺陷的一部分 —— 不靠改 `fill` 解决。
 *
 * ## 混合主轴轨道：`tracks`（U2，2026-10-06 落地，读数在 `docs/2026-10-06-U2-混合轨道-实测证据.md`）
 *
 * 旧模型的主轴只有**一种**分法：要么全体按 `ratio` 分、要么（`row`）全体等分。于是
 * 「上卡吃剩余、下卡按内容高」这一类**混排**没有词 —— 只能手写 flex 骨架，或者把组切碎。
 * `tracks` 补的就是这一个入口：
 *
 * ```
 * 主轴上的每一项点名一次 —— 'content' 按内容取尺寸；正数按权重分**剩余**空间
 * ```
 *
 * 落到 CSS 上是一行：**内容项 `auto`、权重项 `minmax(0, Nfr)`**（`[1,'content']` ⇒
 * `minmax(0, 1fr) auto`）。⚠️ 这仍是**实现候选**：`row` 方向的长内容、宽度约束与折行
 * 行为要按实测写（内容尺寸受可用宽度／字体／子项响应影响，**不等同于缓存一个像素值**）。
 *
 * 三条边界：
 *
 * * **互斥** —— `tracks` 与 `ratio` 都说「主轴怎么分」，类型上排除双传（`TS2322`），
 *   运行期对绕过类型的输入喊一条诊断（`as any` / JSON 配置）。
 * * **要确定的主轴空间** —— `fr` 在不定空间里会**全部塌成最高者**，所以 `column` 下
 *   带权重时必须配 `sizing="fill"` 并让上层给出确定高度；`row` 的宽本来就是确定的，
 *   **不为它喊**（假警报会把「该喊的时候喊」这条判据一起废掉）。
 * * **不改变别的词** —— `sizing` 仍管格子、`align` 仍管格子里面、子项仍自己决定怎么响应；
 *   溢出**不自动**缩小字号或藏内容（那归对应容器与项目）。
 *
 * ⚠️ **旧调用逐字节不变**：不给 `tracks` 时走的那条路就是今天这条（`ratio` 或等分 /
 * `column` 留空），实测证据里那些合成两侧同帧相同。
 *
 * ## 为什么是「一个旋钮管三档」
 *
 * `sizing` 只有三个词，且**轴相对**：`column` 下 `'equal'` 管的是**宽**。
 * 叫 `height` 会说谎，所以不叫 height。
 *
 * ## 与子项的分工（2026-10-05 按 T04 裁定改过）
 *
 * `Flow` 管「**你们怎么分空间**」，子项管「**我怎么响应**」。两组值各管一头：
 *
 * ```
 * sizing  管**格子**的交叉轴（natural / equal / fill）
 * align   管**格子里面**那件东西怎么放（不表态 = 子项用自己的自然默认）
 * ```
 *
 * 而「自然默认」是**子项自己声明**的（`placement.ts`）：容器与块级「照容器办」、
 * 行内片段「按内容居中」。⚠️ **块级为什么没有意见**：根盒子上的 `align-self` 会盖掉父容器的
 * `align-items`，而块级原语的根盒子都不承载外观（被撑看不见）—— 实测见 `placement.ts` 的文件头。
 * 所以 `Flow` **始终不必知道子项是什么元素** ——
 * 它只往自己身上写一对 CSS 变量（`--kit-align` / `--kit-justify`），子项读得到。
 *
 * ⚠️ 在这之前是反的：`align-items: stretch` 把**每个**子项的根盒子都拉满，
 * 于是「盒子即外观」的元素被拉变形 —— 实测一枚 24px 高的标签长成 `286x150` 的色块
 * （`TextTag` / `Emphasis`；见 `kit.md` 的已知限制与
 * `docs/2026-10-05-T04-子项尺寸契约-待裁定.md` 的实测表）。
 *
 * ⚠️ 顺带一处行为变化：`align` 以前在 `equal` / `fill` 下**会被吃掉**（只报一条开发期警告），
 * 现在它写进变量、元素读得到，所以**一定生效** —— 那条诊断随之退休。
 */
export const Flow: React.FC<FlowProps> = ({
  direction = 'row',
  ratio,
  tracks,
  gap,
  sizing = 'natural',
  align,
  children,
}) => {
  const theme = useTheme();

  const items = React.Children.toArray(children);
  const count = items.length;
  const trackGap = gap ?? theme.space.gap;

  // 比例归一：缺的按 1、非正数按 1（多的自然忽略 —— 只按子项数取用）。
  // ⚠️ 这是**有意**的静默兜底（调用处不该为了一次手滑整页崩掉），
  // 但静默正是它坏的地方 —— 所以两处兜底都配一条**开发期警告**。
  const weights = items.map((_, i) => {
    const w = ratio?.[i];
    return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 1;
  });

  if (ratio) {
    const badIndex = ratio.findIndex(
      (w) => !(typeof w === 'number' && Number.isFinite(w) && w > 0),
    );
    if (badIndex >= 0) {
      warnOnce(
        `ratio-value:${String(ratio[badIndex])}`,
        `ratio[${badIndex}] = ${String(ratio[badIndex])} 不是正数 —— 已按 1 处理（静默兜底），比例会是错的。`,
      );
    }
    if (ratio.length !== count) {
      warnOnce(
        `ratio-length:${ratio.length}:${count}`,
        `ratio 给了 ${ratio.length} 个数、却有 ${count} 个子项 —— 多的忽略、缺的按 1，比例会静默错位。`,
      );
    }
  }

  /** 一个正数权重 → `minmax(0, Nfr)`；`'content'` → 自己的内容尺寸（`auto`）。 */
  const asTrack = (w: number | 'content'): string =>
    w === 'content' ? 'auto' : `minmax(0, ${w}fr)`;

  // ── U2：混合主轴轨道 ────────────────────────────────────────────────
  // ⚠️ 三条都是**沿用 `ratio` 那条原则**（兜底 ＋ 喊一声），不是新发明的政策：
  // 调用处不该为一次手滑整页崩掉，但静默正是它坏的地方。
  const mainTracks = (() => {
    if (!tracks) {
      return weights.map(asTrack).join(' ');
    }
    if (ratio) {
      // 绕过类型硬传两个：**以 tracks 为准**，但不静默 —— 喊一声，说清楚用了哪个。
      warnOnce(
        'tracks-and-ratio',
        `同时给了 ratio 与 tracks —— 两者都表示「主轴怎么分」，这次**以 tracks 为准**、ratio 被忽略。` +
          `类型上本该拦住（两个一起传过不了 tsc），大概是 as any 或从 JSON 配置来的。`,
      );
    }
    const specs = items.map((_, i) => {
      // ⚠️ 「缺的」与「给了但无效」是两件事，**各喊一条**：同一次手滑只该看到一条诊断，
      // 否则同一个根因会刷两条消息（那是噪声，不是覆盖）。
      const t = i < tracks.length ? tracks[i] : undefined;
      if (t === 'content') {
        return asTrack('content');
      }
      if (typeof t === 'number' && Number.isFinite(t) && t > 0) {
        return asTrack(t);
      }
      if (i >= tracks.length) {
        return asTrack(1);
      }
      warnOnce(
        `tracks-value:${i}:${String(t)}`,
        `tracks[${i}] = ${String(t)} 既不是 'content' 也不是正数 —— 已按**权重 1**兜底（与 ratio 同一条原则），分配会是错的。`,
      );
      return asTrack(1);
    });
    if (tracks.length !== count) {
      warnOnce(
        `tracks-length:${tracks.length}:${count}`,
        `tracks 给了 ${tracks.length} 项、却有 ${count} 个子项 —— ` +
          `缺的按**权重 1**兜底、多的忽略（与 ratio 同一条原则）；轨道按子项数生成，不会留空轨。`,
      );
    }
    return specs.join(' ');
  })();

  // 生成出来的轨道里**有没有权重轨道**（`'content'` 之外的一切都会变成 `fr`，含兜底那条）。
  const hasWeightTrack = tracks
    ? items.some((_, i) => tracks[i] !== 'content')
    : false;

  const isRow = direction === 'row';
  // ⚠️ **只为 `column` 喊**：`row` 的主轴（宽）是块级元素天然拿到的确定尺寸，`sizing` 管的是
  // 交叉轴（高）—— 给 `row` 也喊就是假警报（假警报会把「该喊的时候喊」这条判据一起废掉）。
  if (tracks && hasWeightTrack && !isRow && sizing !== 'fill') {
    warnOnce(
      `tracks-needs-fill:${direction}:${sizing}`,
      `column 下带权重的主轴轨道需要一个**确定的高度**，而现在 sizing="${sizing}" 通常给不出来 —— ` +
        `不定高容器里 fr 行会**全部塌成最高者**（组高 = 条数 × 最高者），分配会静默走样。` +
        `把上层的高度定下来（给确定高度，或 nesting 在 fill 组里）并写 sizing="fill"。`,
    );
  }

  // 交叉轴那根：**没给 `align` 时也照组里办** —— `equal` / `fill` 仍把格子拉齐，
  // 只是不再把子项的根盒子一起拉变形。子项自己带默认，组里的意见走 `--kit-align`（placement.ts）。
  const cross = align ?? (sizing === 'natural' ? 'start' : 'stretch');
  // 权重轨道用 `minmax(0, Nfr)`：不加 `0` 时，长内容的 min-width 会把轨道撑爆（手写 flex 要用
  // `min-width: 0` 解决的正是同一件事 —— 现在它写在容器里一次）。内容轨道是 `auto`。

  const style: React.CSSProperties = isRow
    ? {
        display: 'grid',
        // `tracks` 缺省时这一串就是今天的等分（`ratio` 参与、或者全是 1fr）—— 旧调用逐字节不变。
        gridTemplateColumns: mainTracks,
        columnGap: trackGap,
        alignItems: cross,
        // `fill` 时本组要占满被给到的高度，里面的轨道才会跟着长
        height: sizing === 'fill' ? '100%' : undefined,
        // ⚠️ 光有 `height: 100%` 不够 —— 它只让**本组**占满，本组自己的那条隐式 `auto` 行
        // 仍然「按内容算」。父级高度确定时 `auto` 行只在**有剩余空间**时才会被拉长；一旦
        // 内容比被给到的那条轴高（`fr` 在不定高里会把每一行撑成最高的那条 ⇒ 内容高被抬高），
        // 行就按内容算 ⇒ 本组连带溢出（2026-10-06 实测：外壳 300 / 内容 343.125 ⇒ +43.1px）。
        // 所以 `fill` 必须把「被给到的那条轴」**传下去**：行也写成 `minmax(0, 1fr)`。
        // 父级高度不确定时这一句与 `auto` 等价（`fr` 退回内容）—— 与 `height: 100%` 同一档退化。
        gridAutoRows: sizing === 'fill' ? 'minmax(0, 1fr)' : undefined,
      }
    : {
        display: 'grid',
        // ⚠️ **只在给了 `ratio` / `tracks` 时才写主轴轨道** —— 见文件头「轴」那一节：
        // 不定高的容器里 `fr` 行会全部塌成「最高者」，那正是 `natural` 说谎的原因。
        // 缺省时留空，行是隐式的 `auto`（各自内容高）。
        gridTemplateRows: ratio || tracks ? mainTracks : undefined,
        // `fill` 还要把**被给到的那条轴**分给各行 —— 否则组撑满了、里面各行还是内容高，
        // 底部留一片空（2026-10-05 实测：`align-content` 的初值**不会**替我们拉长 auto 行，
        // 所以这一条必须显式写）。`ratio` / `tracks` 给了就由上面那行轨道负责，这里不重复
        // —— 显式轨道与隐式行抢同一条轴只会让读数变得难解释。
        // ⚠️ 2026-10-06：`row` 那一半补上了**同一条**（交叉轴＝行），否则嵌套时高度传不下去。
        gridAutoRows:
          !ratio && !tracks && sizing === 'fill' ? 'minmax(0, 1fr)' : undefined,
        rowGap: trackGap,
        justifyItems: cross,
        height: sizing === 'fill' ? '100%' : undefined,
      };

  // 组里的意见写在**自己身上**，给子项读；`Flow` 自己不读它 —— 否则会读到自己刚写的值，
  // 把外层 `Flow` 的意见顶掉（见 `placement.ts` 末节）。
  Object.assign(style, crossVars(isRow, align));

  /**
   * 「React 数到几个子项」与「DOM 里真落下几个盒子」必须一致。
   *
   * 不一致的典型是子项包在 **Fragment** 里（`<Flow><>{a}{b}{c}</></Flow>`）：
   * Fragment 不产生 DOM，于是 `React.Children.toArray` 只数到 **1** 个，
   * 而 grid 里**真的有三个盒子** —— 一条轨道、三个子项，自动换行把整组变成竖排。
   * 调用方要的是横排，拿到的是竖排，**不报错**。
   *
   * 判据必须是**真实 DOM 的子项数**：拿 `React.Children` 自己跟自己比永远相等
   * （那是「一条永远绿的断言」，比没有更坏）。
   * 只报「DOM 比 React 多」这一侧 —— 反过来（子项渲染成 `null`）是合法的条件渲染。
   */
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const domCount = el.children.length;
    if (domCount > count) {
      warnOnce(
        `children:${count}:${domCount}`,
        `React 数到 ${count} 个子项，DOM 里却落下 ${domCount} 个盒子 —— 子项大概包在 Fragment 里（<>{a}{b}{c}</>）。` +
          `轨道只生成了 ${count} 条，多出来的盒子被自动换行排到下一行。把子项摊平（数组或并列的 JSX）即可。`,
      );
    }

    // ── U2：权重轨道被**静默压到 0**（2026-10-06 实测，读数在 `docs/2026-10-06-U2-混合轨道-实测证据.md`）
    //
    // 这是 `tracks` 唯一一种**看起来像成功**的坏结果：`auto` 轨道的增长上限是它的 `max-content`，
    // 而网格的「maximize tracks」这一步**先**把可用空间分给 `auto` 轨道、之后才轮到 `fr` 轨道。
    // 于是内容比容器宽时（row 上一句长文本、column 上一段高内容），内容轨会**先吃掉全部可用空间**，
    // 权重轨被压到 0 —— 组高/组宽都对、**不报错**，画面看起来像「这一格没画」。
    // 判据必须来自**真实几何**（拿声明的轨道串自己跟自己比永远相等），所以这里读子项的主轴尺寸。
    if (tracks && count > 0) {
      const main = (el_: HTMLElement): number =>
        isRow ? el_.getBoundingClientRect().width : el_.getBoundingClientRect().height;
      const containerMain = main(el);
      if (containerMain > 0) {
        Array.from(el.children).forEach((child, i) => {
          if (tracks[i] === 'content' || i >= tracks.length) {
            return;
          }
          if (main(child as HTMLElement) < 1) {
            warnOnce(
              `tracks-collapsed:${i}:${direction}`,
              `tracks 里第 ${i} 项是**权重轨道**，实测主轴尺寸被压到了 0 —— ` +
                `内容轨（'content'）的 max-content 比容器还${isRow ? '宽' : '高'}，` +
                `它在这一步先吃掉了全部可用空间，剩下 0 分给权重。` +
                `内容轨适合**有自然尺寸**的东西（标签、固定尺寸的媒体、一行标题）；` +
                `长文本／高内容属于**权重轨**。要么把内容项收窄（给它自己的宽度或折行约束），` +
                `要么改用 ratio。⚠️ 这条**不改行为**，只把静默变成可见。`,
            );
          }
        });
      }
    }
  }, [count, tracks, direction, isRow]);

  return (
    <div ref={ref} style={style}>
      {count > 0 ? items : null}
    </div>
  );
};
