import {SLOT_SEP} from '../master/slots';

/**
 * 演示用的**数据夹具** —— `TextTag` / `RichTextBox` / `BarChart` 三个原语共用。
 *
 * ⚠️ 这些是**夹具**，不是套件的能力：真实片子里内容由调用方给。
 *
 * 内容取「渲染耗时」这一组数：它对本套件的读者是自明的（一套组件存在的理由
 * 就是压掉写代码与等渲染这两件事），而且**数值有真有假** —— 见下面那一行 `—`。
 */

/**
 * `lines` 槽的一条 —— **用 `SLOT_SEP` 拼，不要手打 TAB**。
 *
 * 约定写在 `master/types.ts` 顶部：PowerShell 的双引号字符串不会把 `\t` 退化成 TAB，
 * 手写反斜杠转义会让约定静默失效（消费方拿到的是两个字符 `\` `t`）。
 */
const slot = (head: string, body: string): string => `${head}${SLOT_SEP}${body}`;

/** 条形图的演示数据：复用组件前后的渲染耗时（秒） */
export const MOCK_BARS: readonly string[] = [
  slot('首次渲染', '8.4'),
  slot('复用组件后', '3.2'),
  slot('配置档压低', '1.8'),
  slot('抽帧复核', '0.9'),
];

/**
 * 多一行**测不出数**的 —— 演示「数值的诚实回退」（条长 0、数值列显示原文）。
 *
 * 这一行必须真的出现在某个场景里：它是组件的一条分支，而**没被渲染过的分支
 * 等于没写**（`references/authoring.md` 步骤 3）。
 */
export const MOCK_BARS_WITH_GAP: readonly string[] = [
  ...MOCK_BARS,
  slot('增量渲染', '—'),
];

/**
 * 富文本框的演示文案：三种标记各来一次，外加一个分段。
 *
 * 三种标记都必须在场 —— 它们是三条渲染分支，少一种就是少验一条。
 */
export const MOCK_RICH = [
  '三种标记写在同一个字符串里：**加粗**是重量，==高亮==是落点，`等宽`是字面量。',
  '槽位传进来的就是字符串，所以这条路**能直接喂数据**。',
].join('\n');

/** 标签的演示文案 —— 四种分量各一枚（分量也是分支，四种都要在场） */
export const MOCK_TAGS: readonly {
  readonly text: string;
  readonly tone: 'solid' | 'tint' | 'outline' | 'muted';
}[] = [
  {text: '已证实', tone: 'solid'},
  {text: '高危', tone: 'tint'},
  {text: '本地打包', tone: 'outline'},
  {text: '传闻', tone: 'muted'},
];

/**
 * 内容卡的两段夹具 —— **一长一短**。
 *
 * 长短是**故意的**：它们要证明「**框高跟内容走**」（高的那张内容更多），
 * 而不是「所有框一样高」。展示页的验收就拿这两张比高度。
 */
export const MOCK_PANEL_TALL = [
  '**框高跟内容走**：内容多就高、内容少就低 —— 没有高度 prop，也不裁切。',
  '长内容靠**原位替换**（同一个框，只换里面的正文），不是滚动。',
  '卡内默认是**不透明底** —— 背景那层网格必须被卡挡住，卡里才是干净的。',
].join('\n');

/** 短的那张 —— 只有一句话，所以它必须比上面那张**矮** */
export const MOCK_PANEL_SHORT = '卡尾贴在框底，是标注与徽章的锚位。';

/**
 * 第二页 —— 比第一页**短**（窗口要收紧），但不是一行（一行会看起来像「换了一张卡」）。
 *
 * 它演示的是**原位替换**：同一个框，只换里面的正文；页码跟着变，窗口跟着收紧。
 * 第二行是**实测踩到的坑**：框不顶部锚定的话，收紧会变成上下一起缩。
 */
export const MOCK_PANEL_PAGE2 = [
  '字少了，所以**窗口跟着收紧** —— 上边缘不动，只有下边缘往上收。',
  '⚠️ 框必须**顶部锚定**：垂直居中会让收紧变成上下一起缩。',
].join('\n');

/**
 * 大数字的夹具。静态三份，覆盖 `unit` / `label` / `note` / `align` 四条可选分支：
 *
 *   * `MOCK_STAT`          —— 四个字段全给（数字 + 单位 + 标签 + 说明）
 *   * `MOCK_STAT_CENTERED` —— 居中、**没有**说明
 *   * `MOCK_STAT_BARE`     —— **只有数字**
 *
 * 「只有数字」那份不是凑数：三个可选字段都得有「不给」的形态被渲染过，
 * 否则那几条分支等于没写（`references/authoring.md` 步骤 3）。
 *
 * 值取 `—` 是刻意的：它同时证明**格式化属于内容层** —— `value` 是字符串，
 * 组件不解析它，所以「还没测出数」可以原样交给它。
 *
 * 动态那三种（跳动 / 计数到 / 数位滚动）的夹具在下面 —— 它们的形状不同，
 * 因为**责任方不同**：前两种的数是**调用方**算的，只有滚动要组件参与。
 */
export const MOCK_STAT_COPY = {
  unit: '%',
  label: '复用组件后的渲染耗时',
} as const;

export const MOCK_STAT = {
  value: '86.6',
  ...MOCK_STAT_COPY,
  note: '同一段素材、同一台机器、各抽 30 帧',
} as const;

export const MOCK_STAT_CENTERED = {
  value: '1,284',
  unit: 'ms',
  label: '首次渲染',
} as const;

export const MOCK_STAT_BARE = '—';

/**
 * 「计数到」的数值夹具 —— **数值**，不是字符串。
 *
 * 它和 `MOCK_STAT.value` 说的是同一个数，但形状不同，因为**责任方不同**：
 * 插值由**调用方**做（`interpolate` 吃数字），格式化也由调用方做（`toFixed`），
 * 组件拿到的仍然是字符串。这条正是「格式化属于内容层」的落地方式。
 */
export const MOCK_STAT_COUNT = {from: 0, to: 86.6, decimals: 1} as const;

/**
 * 数位滚动的起点 —— 与 `MOCK_STAT.value` **等长**（这是它能滚的前提）。
 *
 * 用 `00.0` 而不是 `0.0` 是刻意的：等长之下每一位都能配上对，
 * 而 `0`→`8`、`0`→`6` 的**逐位线性**恰好读起来像一次计数到。
 */
export const MOCK_STAT_ROLL_FROM = '00.0';

/**
 * **故意短一位**的起点 —— 演练「不等长 → 不滚」那条降级分支。
 *
 * 它不报错、也不猜，只是**不动**（症状看得见）。理由见 `Stat` 的 `rollFrom` 注释。
 */
export const MOCK_STAT_ROLL_SHORT = '0.0';
