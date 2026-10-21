# 组件契约

每个放进套件的组件都必须满足以下规则。这不是风格偏好 —— 违反任何一条，要么渲染出错，要么在 Studio 里变灰不可编辑，要么在并行渲染时失步。

---

## 1. 确定性：一切由帧驱动

- 动画只能用 `useCurrentFrame()` + `interpolate()` 算出来；
- **禁止** CSS `transition` / `animation` —— 渲染器不执行它们，动画根本不会动；
- **禁止** Tailwind 的 `transition-*` / `animate-*` 类，同理；
- **禁止** `@react-three/fiber` 的 `useFrame()`，会导致渲染闪烁；
- 异步资源（字体、Lottie、地图、字幕 JSON）用 `delayRender()` / `continueRender()` 包住，否则渲染会在资源到位前截帧。

## 2. 插值的硬约束（**tsc 抓不到，只有渲染会报错**）

- **每个分量的单位必须各自一致。** `['0px 100%', '0px 0px']` 会在渲染时抛错（第二个分量把 `%` 和 `px` 混用），必须写成 `['0px 100%', '0px 0%']`；
- 同一次 `interpolate` 的所有输出值必须是**同一类型**；
- `scale` 用无单位数字，`translate` 用长度或百分比，`rotate` 用 `deg` / `rad` / `grad` / `turn`；
- 动画 `scale` 时加 `output: 'perceptual-scale'` —— 线性缩放在大尺寸下视觉上偏小（可见面积随 `scale²` 变化）；
- 区间**默认不 clamp**，跨出区间会继续外推。绝大多数情况都要写 `extrapolateLeft: 'clamp'` 与 `extrapolateRight: 'clamp'`。

## 3. 内联纪律：Studio 能否编辑的**必要条件**

Remotion Studio 只能编辑与打关键帧**内联硬编码**的值。任何常量引用都会让该值变成「计算值」，在 Studio 里变灰。

⚠️ **但「内联」是必要条件，不是充分条件**（2026-10-05 实测，推翻了本节原来的口径）。
判定是**逐格看那一格属性的整个表达式**：`interpolate()` 的 input range 用 prop 做了运算、
或 `easing` 里出现 `...spread` / 标识符，**整格**就变 `computed` 而变灰 ——
**哪怕 range 那两个数字本身是硬编码的**。同对象里别的格不受影响（逐格判定，**不连坐**）。

**实测读数**（`remotion-kit-lab/tools/probe-editability-survey.cjs`，调的是 Studio 服务端
`can-update-sequence-props` 那条**判定路径本体**；范围 `kernel/components` ＋ `kernel/master`
＋ `hotspot/master`，42 个 `<Interactive.*>` 标签）：
`static` **148** · **`keyframed` 0** · `computed` **230**
⇒ **今天套件里没有任何一格的动画能在 Studio 里调** —— 元件层与母版层一样。

| 层 | 杀掉那一格的东西 | 对照组 |
| --- | --- | --- |
| **元件层** | `interpolate(frame, [delayInFrames, delayInFrames + enterDurationInFrames], …)` —— range 里的**变量运算** | B |
| **母版层** | `easing: Easing.bezier(...theme.motion.enter)` —— easing 里的**展开** | D |

母版那条最反直觉：`CoverLayout` 的 range 是**硬编码**的 `[2, 18]`、本该可编辑，实测仍然 `computed`。
所以**「内联」与「读主题」两条路今天都是灰的** —— 照做本节的纪律**不等于**那一格就可编辑。

**必须内联在组件体内 / 调用处：**

- `interpolate()` 的输入区间、输出区间、`easing`、`extrapolate*`、`output`；
- 逐实例的 `fontSize`、`translate`、`opacity`、`delayInFrames`；
- `Interactive.*` 的 `name`（硬编码，不要算出来）。

**可以来自主题（`useTheme()`）：**

- 品牌色（含网格线 `color.grid` 与暗角 `color.vignette`）、字体族、安全区基准、字阶、间距、图形语言。

代价要认：主题值不可逐处编辑。这正是我们想要的 —— 它们本来就不该逐处不同（颜色如此，动效曲线同理）。
⚠️ 但**反过来不成立**：内联的值也不一定可编辑。今天**静态值**内联了就可编辑（`fontSize = 96` 那一类），
**动画值**内联了仍然变灰（见本节上面那张表）。

### 主题只能从 context 读

```tsx
import {useTheme} from '../theme/context';   // ✅ 唯一正当入口
// import {theme} from '../theme/default';   // ❌ 组件只会长成那一个主题的样子
```

组件、版式、家具、护栏**一律不许 import 具体主题文件**（`theme/paper-seal` 之类）。
只有主题注册表与合成入口可以（见 `theme-contract.md` 第 3 节）。

### 分层例外

| 层 | 主题怎么进来 | 字号默认值 | 理由 |
| --- | --- | --- | --- |
| **组件层**（`components/` 的原语） | `useTheme()` 取色 / 字族 | **内联**（`fontSize = 96`） | 逐实例微调有价值；要让标题跟随主题字阶就显式传 `theme.type.title`，或直接用版式 |
| **母版层**（`master/layouts/`、`master/furniture/`） | `useTheme()` 取全部 | **主题字阶 × `box.scale`** | 母版是「一个套件一个主题」，字阶与动效签名本就该全局一致 |

同理，护栏（`guards/fitting.ts`）算出的字号是**计算值**，Studio 不可编辑 —— 护栏的职责是「不溢出」，不是「可微调」。

**这些是有意的取舍，不是疏漏。** 判断标准是：这个值**该不该逐处不同**？

- 该逐处不同 → 内联（**静态值**则内联即可编辑；**动画值**今天仍不可编辑，见本节）
- 不该逐处不同 → 主题 / 护栏（不可编辑，但全局一致）

**不要用 `transform` 字符串**，用 `scale` / `translate` / `rotate` 独立属性（只有它们可交互编辑）。`skew()`、`perspective()`、顺序敏感的多段变换链除外。

## 4. 时序

- 组件从**自己的本地 0 帧**起算，这样放进任何 `<Sequence>` 都对；
- 入场延迟用 `delayInFrames`，**不要**用 Sequence 的 `durationInFrames` 表达延迟；
- 入场长度用 `enterDurationInFrames`，**不要**叫 `durationInFrames` —— 那个名字在 `Interactive.*` / `<Sequence>` 上已经有 Sequence 语义，重名会串味；
- 组件若要透传 Sequence 起始帧，用 `from` 并原样转给 `Interactive.*`。

## 5. 布局与尺寸

- 尺寸基准取自 `useVideoConfig()`（`width` / `height` / `fps`），或由显式 prop 给；
- **安全区按 1080 基准等比缩放，取宽高比的较小值**：`const scale = Math.min(width / 1080, height / 1080)`，左右 80px、上下 100px 乘上 `scale`。
  ⚠️ 用 `width / 1080` 是**错的**：1920×1080 会得到 1.78 倍，纵向留白与字阶一起被放大。取较小值让 1920×1080 与 1080×1920 都落在 1:1 基准，4K 才翻倍。
  这条对**三处**同时成立：版式（`useMasterBox().scale`）、家具（同左）、`SafeArea`。三处尺度必须一致，否则同一帧里两套尺度打架（抽帧抓到过：页脚小字比正文还大）；
- ⚠️ **给固定家具让位不能用 `padding`。** 场景是 `<Sequence>`（默认 `layout="absolute-fill"`，即绝对定位），**绝对定位的子元素不会被父级的 padding 挤开** —— 内容会从 y=0 开始画，直接压在报头上。要用 `top`/`bottom` 定位的内容盒（`MasterFrame` 已如此实现）；
- 1080 宽基准下的最小字号：主标题 ≥ 84px、重要支撑文字 ≥ 44px；按宽度等比缩放；
- 容器类组件（`SafeArea` / `Stage`）**故意不用** `Interactive.*` —— 免得时间线被容器塞满。可选中、可拖拽的应该是内容元素。

### 显式参数永不静默改变（**已由 T05 / T04 / T06 落地**）

> ✅ **对齐（2026-10-05）：这条原则不是候选 —— 它已经由三次裁定分别落地。**
> **T05**（2026-10-05）在「明确诊断／类型限制／公开优先级」三选一里取**明确诊断**；
> **T04** 让 `align` 与 `sizing='equal'｜'fill'` 同给时**真生效** —— 下面那张表因此**少一行**（那条诊断退休）；
> **T06** 裁「显式 `staggerInFrames` **原样生效**，代价用溢出诊断顶上」。
> 判据与实测：`docs/2026-10-05-阶段2-局部实现-实测证据.md`（T05 / T06）
> · `docs/2026-10-05-T04-子项尺寸契约-裁定.md`（T04）。
> 定层那一套（`creation-workflow.md` 第 1 节）同日按 `§2 ＋ A01 ＋ T01` 对齐，**同属「不是候选」**。

**调用方显式给的参数，要么原样生效，要么以可见方式失效 —— 永不静默改变。**

- **「可见」** 有三种落法：① **画面/页面上看得出来**（溢出、被切掉、演示合成里有一格对照）；
  ② **生成器报 WARN / NOTE**；③ **开发期诊断** —— 一次性的 `console.warn`，
  同时出现在 Studio 控制台与出片日志（`remotion render --log=verbose`）。
  ⚠️ 第 ③ 种 2026-10-05 才落地（`guards/diagnostics.ts`）。它**不改行为**，
  所以对「产物必须是确定的」没有任何影响；它的判据是**能被证伪的**：
  `showcase/verify.mjs` 有一条「console error/warning 为 0」的断言盯着误报，
  而真报的时候日志里逐条点名（见下）；
- **静默改变是最坏的形态**：值被改了、画面看起来正常、没有任何地方报告 —— 调用方**无从知道自己给错了**。
  这类问题在抽帧里也常常看不出来，因为它「看起来是对的」；
- ⚠️ 因此凡是「越界了怎么办」的语义（比例不匹配、值超出范围、时长不够），**契约必须写死后果**，
  并让后果落在上面那三种「可见」上 —— **不要**让它退化成一句静默的兜底；
- **已落地的诊断**（都在 `Flow` 与四个版式上，`guards/diagnostics.ts`）：
  | 情形 | 诊断 |
  | --- | --- |
  | `ratio` 里有非正数 | `ratio[i] = 0 不是正数 —— 已按 1 处理（静默兜底），比例会是错的` |
  | `ratio` 长度与子项数不匹配 | `ratio 给了 3 个数、却有 2 个子项 —— 多的忽略、缺的按 1，比例会静默错位` |
  | 子项包在 Fragment 里（DOM 盒子数 > React 子项数） | `React 数到 1 个子项，DOM 里却落下 3 个盒子……轨道只生成了 1 条` |
  | 显式节奏让末条来不及出现（T06） | `末条来不及出现 —— 第 214 帧起、到第 232 帧才入场完，而这段场景只有 90 帧` |
  ⚠️ **2026-10-05 退休一条**（T04）：`align` 与 `sizing='equal'｜'fill'` 同给时以前会被静默吃掉、
  只靠诊断喊一声。现在 `align` 写进 CSS 变量、元素读得到，**它一定生效** —— 诊断随之删除。
  「显式参数永不静默改变」在这里的落法，从「报一声」升级成了「真生效」。
  ⚠️ 最后一条的判据**必须是真实 DOM 的子项数**：拿 `React.Children` 自己跟自己比永远相等
  —— 那是「一条永远绿的断言」，比没有更坏；
- **仍只能靠文档写明的一处**（组件测不出来）：`Flow` 的 `sizing='fill'` 在**高度 auto 的父级**里
  会退化成 `equal`（不是 `natural`）。渲染期读不到「父级有没有给我确定高度」，所以这一条没有诊断，
  只有后果说明 —— 见 `kits/kernel/kit.md` 的已知限制；
- **与本条不冲突的是护栏**：护栏作用的对象是**内容**（可变长文本，本来就没人给它字号），
  不是调用方**显式给**的参数。

### `display`：原语自己声明**显示语义**（对齐 HTML）

原语不是一类东西，但**不因此就需要外面给它一个「宿主」** —— 正确的做法是它自己声明该怎么占位，
就像 HTML 里 `<span>` 天生 inline、`<div>` 天生 block。声明写在 `components/specs.tsx` 的 `display` 字段：

| `display` | 含义 | **在格子里怎么响应**（T04） | 原语 |
| --- | --- | --- | --- |
| `block` | 块级，**自己撑开盒子** | `'auto'` —— 照容器办 | `Title` / `Subtitle` / `SectionHeading` / `Quote` / `BulletList` / `TextReveal` / `RichTextBox` / `ProgressBar` / `MediaStage` / `BarChart` / `Stat` |
| `inline` | 行内片段，**盒子就是那件东西** | `'center'` —— 按内容、居中 | `Emphasis` / `TextTag` |
| `container` | 撑满给它的盒子，本身没有视觉身份 | `'auto'` —— 照组里办 | `SafeArea` / `Stage` / `Flow` / `Panel` / `ScrollArea` / `MediaCard` |

**判据**：把原语当成一个 HTML 标签挂到页面上，它该是什么 `display`？

⚠️ 这三行**不止是分类**：从 T04（2026-10-05）起，`display` 同时决定这个元素**在被分配到的格子里怎么响应** ——
第三列那个值就是元素写在根盒子上的 `alignSelf` / `justifySelf` 兜底（`guards/placement.ts`）。
所以**改一个原语的 `display` 等于改它在 `Flow` 里的行为**，不是改文档。

⚠️ **`Panel` 是改判过来的**（2026-10-05，原本写 `block`）：它的内层是无条件 `height: 100%`，
那正是「撑满给它的盒子」。改判之前声明与行为是分叉的 —— 实测它在 `equal` 组里第一子高**就等于格子高**。
判据是量出来的、不是读出来的：`Stage2Probe` 场景 C 把 16 个原语逐个放进确定高的格子。

> ⚠️ **这条曾经写反过。** 早先这里叫「最小宿主」，把显示语义写成了**外部要求**
> （「`Emphasis` 必须包在一句话里，否则会撒谎」）—— 那是把「元素自己的属性」
> 错当成「展示页的责任」。方向反了之后，展示页就被迫给每个控件套一个视频框，
> 于是「以元素为单位」这件事根本做不到。修正的做法就是上面这条：让元素**自己声明**。

**每个原语还要声明自己的 `demoFrame`（动画完成帧）。** 展示页默认定格在它 ——
因为 Remotion 在 **frame 0 时所有元素的 opacity 都是 0**，定格在 0 只会得到一页空白。
各元素入场长度不同（24 / 30 / 40 / 44 / 48），所以这个值必须**逐个声明**，不能全页取一个数。

### `tunable`：只声明「想改 / 能改」的那几个 prop

展示页的格子只有那么大，**挂不下 prop 表** —— 上一版把整张表摊在卡里，
结果是一屏看不到画面。所以每个原语声明 **1–3 个**最可能被改的 prop，
展示页只把这几个挂成格子下面的词条：

```tsx
tunable: ['fontSize', 'align'],
```

**为什么是声明而不是推断**：拿 `Title` 试一遍，12 个 prop 里「能改」的有 9 个
（`fontSize` / `align` / `maxWidth` / `letterSpacing` / `lineHeight` / `fontWeight` /
`color` / `enterDurationInFrames` / `delayInFrames`），挂不上格子。
所以这是**排序**问题，不是过滤问题 —— 而「最想改的 3 个」只有懂这个元素的人答得出来。
与 `display` / `demoFrame` 同理：**推断是脆的，而且推出来的东西没法被校验**。

**判据**：这个词条能不能让你说出「把它改成 X」。
内容是内容（`text` / `children`）、接线是接线（`from` / `name`）—— 它们不是旋钮。

**生成器会校验**：名字必须在 `props` 里存在（否则 **WARN**）、数量 1–3（否则 **NOTE**）。
`0 个` 不报错，但那意味着这个元素在墙上只剩名字。

### 中文名**不在**这里（也不在 `Theme` / `LAYOUT_SPECS` 里）

展示页上每个展品显示成 `Title · 主标题`，那个中文名住在**套件根的 `labels.ts`**，
与另外四层（版式 / 家具 / 主题 / 场景）共用一张表：

```ts
export const LABELS = {
  elements: {'Title': '主标题', …},
  …
};
```

**不要给 `ComponentSpec` / `LayoutSpec` / `Theme` / `FurnitureConfig` 加 `label` 字段** ——
中文名是**展示**，而这几个类型在出片路径上被真正消费；而且五层里有三层根本没有声明文件
（家具只有字段 + 文件、主题只有 `Theme` 对象、场景只有 `<Sequence name>` 的字符串），
逐层加字段会变成三套机制。一张表 = 一套机制，管五层，而且**覆盖率可以被双向校验**
（发现到的展品少一个名字报 WARN、表里的键对不上展品也报 WARN）。
理由的完整版写在 `labels.ts` 的文件头。

### 排列：**空间归容器，响应归子项**（T04 · 2026-10-05 裁定）

一屏里「谁占多宽、之间隔多少」由一个**排列容器**（`Flow`）统一表达 —— 调用方**不必**知道子项
是什么元素，容器也**不给子项注入任何 prop**。三条边界：

- **容器不决定「这组画在画面哪里」** —— 那归母版 / 场景。与 `Panel` 同一条立场
  （组件一旦知道自己在画面里站哪儿，就会和母版的位置打架）；
- **容器不给子项注入样式** —— 用 `grid` + `fr` 轨道，所以 Fragment / 自定义组件都进得来
  （给子项 `cloneElement` 注 `style` 那条路对它们是脆的）；
- **「内容撑开框」与「框去适应素材」是两件事**：`Panel` 走前者、`MediaStage` 走后者 ——
  所以 `Panel` 能被容器拉伸（内层无条件 `height: 100%`），而 `MediaStage` 的尺寸
  仍由它自己按素材定（它写了确定的 `width` / `height`，而 `stretch` 本来就够不着定尺寸的盒子）。

#### 契约正文

```
Flow   分配空间 —— 轨道、间距、交叉轴的**格子**尺寸
子项   绘制响应 —— 它自己决定要不要填满那个格子
```

四句话，缺一句就会退化成另一条错路：

1. **`sizing` 管格子，`align` 管格子里面。** 三个词（`natural` / `equal` / `fill`）说的都是
   **格子**的交叉轴，**不是**格子里那件东西。⚠️ 因此 **`'equal'` 承诺的是「等高格子」，
   不保证三枚标签看起来一样高** —— 要真等高，用容器类子项（`Panel`）或用显式布局条目。
   （2026-10-05 之前是反的：`align-items: stretch` 把每个子项的根盒子都拉满。）
2. **元素声明自己的自然默认。** `display` 那一栏就是它（见上 §`display`）：
   容器类与块级 `'auto'`（照容器办）、行内片段 `'center'`（按内容、居中）。
   ⚠️ **块级为什么不是 `'start'`**：元素根盒子上的 `align-self` 会**盖掉父容器的 `align-items`**，
   给块级写死 `'start'` 会让 `<AbsoluteFill style={{alignItems:'center'}}>` 那类调用处**失效**
   （实测：`KitShowcase` 7 个场景变样）。而**块级原语的根盒子都不承载外观**（`ProgressBar` /
   `MediaStage` 有确定尺寸，其余根盒子透明），所以它们本来就没有意见 —— 见 §4 的 16 格归类。
3. **实例可以覆盖它。** 组级 `align` 写进 `--kit-align`，元素读得到 ——
   所以 `align` 在 `equal` / `fill` 下**也一定生效**（以前会被静默吃掉、只报一条警告）。
4. **异构组合走显式布局条目。** 三类子项混在一组、而各自的自然默认都不合意时，
   用显式的比例 / 轨道（`ratio` · `tracks`）把它们摆平 —— 那是可选路径，不是默认路径。

#### 混合主轴轨道：`tracks`（2026-10-06 U2 落地，实测在 `docs/2026-10-06-U2-混合轨道-实测证据.md`）

主轴原先只有**一种**分法（全体 `ratio` 或 `row` 全体等分），于是「上卡吃剩余、下卡按内容高」
这类**混排**没有词。`tracks` 补的就是这一个入口，**一个 prop、两种项**：

```
type FlowTrack = number | 'content'
'content' —— 这一项按自己的内容取得主轴尺寸，不参与剩余空间分配
正数      —— 扣除内容轨道与间距后按这个权重分剩余（**不是像素**）
```

落到 CSS 是一行：**内容项 `auto`、权重项 `minmax(0, Nfr)`**（`[1,'content']` ⇒ `minmax(0,1fr) auto`）。

四条边界（都是**实测**，不是设计推断）：

- **与 `ratio` 互斥**，类型上排除双传（`TS2322`），运行期对绕过类型的输入喊一条诊断。
  ⚠️ **代价如实说**：`Flow` 的 props 因此是**联合**，「整体转发一份 props 对象」
  （`{...ComponentProps<typeof Flow>}`）过不了 `tsc` —— 全库只有一处（`Stage2Probe`），就地 cast。
- **`column` 下带权重必须配 `sizing="fill"`**，并由上层给出确定高度：不定空间里 `fr` 行会
  塌成最高者。**这条只为 `column` 喊** —— `row` 的主轴宽由父级给、与 `sizing` 无关，
  给它也喊就是假警报。
- ⚠️ **内容轨是 `max-content`**：`row` 上它**不会**自己折行去适配容器。内容比容器宽/高时，
  它会在「maximize tracks」这一步**先吃掉全部可用空间**，权重轨被压到 0 —— 组宽高都对、
  **不报错**，看起来像「这一格没画」。所以：**内容轨适合有自然尺寸的东西**（标签、定尺寸媒体、
  一行标题），长文本／高内容属于**权重轨**。这种情况会**喊一条诊断**
  （读真实几何，不是读声明）。
- **旧调用逐字节不变**：不给 `tracks` 时走的就是原来那条路（`ratio` 或等分 / `column` 留空），
  逐帧回归（旧调用 ＋ 旁证共 8 个合成）两侧相同。

⚠️ **容器类必须写 `'auto'`，不能写 `'stretch'`。** `Panel` 一边要在 `equal` / `fill` 里撑满、
一边要在 `natural` 里按内容走 —— 这两件事都靠 `'auto'` 把决定权交回组里的 `align-items`。
写死 `'stretch'` 会让 `natural` 也撑满，等于把这个词废掉。

⚠️ **机制住在 `guards/placement.ts`**，两处实现细节是**实测**出来的、不是设计出来的：

- **两个变量** —— 交叉轴是哪一根取决于 `Flow` 的方向（`row` 是 `align-self`，`column` 是
  `justify-self`），而元素不知道自己在什么方向里。所以 `Flow` 把**主轴**那根写死 `'stretch'`
  （子项必须填满自己的轨道，`ratio` 靠它），**交叉轴**那根才写 `align` 或不表态；
- **「不表态」只能是 `'initial'`，不能是 `'unset'`** —— 自订属性可继承，`unset` 对它等于
  `inherit`，嵌套的 `Flow` 会把外层的 `align` 漏给内层子项。实测（`Stage2Probe` 场景 V）：
  不设变量 `@y=80`（漏）、`unset` **`@y=80`（照样漏）**、`initial` `@y=0`（挡住）。

#### 实测（`Stage2Probe` 场景 T04，`fill` 组、父级 300）

| 子项 | 改前 | 改后 |
| --- | --- | --- |
| `Panel`（容器） | `277x300 > 277x300` | `277x300 > 277x300` —— **没动**，拉伸是它的功能 |
| `TextTag`（行内） | `277x300 > 275x298` | `277x45 > 275x43 @y=127` —— 回到内容高、**居中** |
| `Emphasis`（行内） | `277x300 > 297x312` | `277x19 > 297x31 @y=141` —— 同上 |
| `RichTextBox`（块级） | `277x300 > 277x85` | **逐行不变**（外盒仍被撑满 —— 它透明，看不见；见下面那条⚠️） |

⚠️ **块级那一行「逐行不变」是刻意的，不是没改到。** 块级写的是 `'auto'`（照容器办）——
因为**根盒子上的 `align-self` 会盖掉父容器的 `align-items`**，给块级写死 `'start'`
会让 `<AbsoluteFill style={{alignItems:'center'}}>` 那类调用处失效：实测 `KitShowcase`
**7 个场景**变样（Scene 5/6 的大媒体框从居中变成贴左）。而块级原语的根盒子都不承载外观，
所以「被撑」看不见 —— 它们本来就没有意见。

⚠️ **没有「第三个外观类」。** 本文件早先的版本在这里写过一句「`Quote` 的左侧强调条是
`height: 100%`，撑多高它就多高」—— **那是把差分图上的虚线框看成了强调条**。
`Quote` 根本没有强调条：它的第一个孩子是一个 56px 的引号字形，根盒子是透明的。
场景 A 里 `182 → 260` 变的只是**透明根盒子的高度**，内容 `@y=0` 与内盒**都没动** ——
那是**看不见的**。教训：**「看图看出来的」也要用数字复验一遍**，否则它会把结论带偏一整节。

**挂载一个原语需要什么**（实测）：`ThemeProvider` + 一个帧时钟。
**不需要** `<Player>`，也不需要给每个控件一个 1920×1080 的合成 ——
整页一个舞台（provider 栈 + 单时钟）就够，组件像 HTML 标签一样直接挂载、按自身尺寸显示。
只有 `container` 类需要给定尺寸的盒子（`SafeArea` 的内边距按合成尺寸算，不是按它所在的盒子）。

## 6. 禁止的渲染期操作

- **补间里绝不调 `getBoundingClientRect()`** —— 渲染器并行采样会失步。布局常量在 setup 时算一次并复用；确实要测 DOM 就除以 `useCurrentScale()`；
- **绝不用 `width` / `height` / `top` / `left` 做动画** —— 用 `scale` / `translate`；
- 不在渲染函数里新建大对象或数组（每帧都会跑）；
- 不给 `.map()` 出来的**带时序的 clip**（`<Video>` / `<Audio>`）自动生成 —— 那是视频编辑的规矩。组件内部的文字行用 `.map()` 是安全的。

## 7. 命名与文件

- 文件名 = 组件名（PascalCase）；多导出的模块（`guards/fitting.ts`、`templates/ShowcaseScenes.tsx`）按**主导出**命名；
- props 用 `type` 声明，**不用 `interface`**（`defaultProps` 的类型安全要求）；
- props 全部 `readonly`；
- 每个 prop 都写一句注释说明它是什么、单位是什么；
- 数值 prop 一律是**像素**或**帧**，并在注释里写明。

## 8. 自检清单（提交前逐条过）

- [ ] 无 CSS `transition` / `animation` / Tailwind 动画类
- [ ] 所有 `interpolate` 的 `extrapolate*` 明确写了
- [ ] `scale` 动画带了 `output: 'perceptual-scale'`
- [ ] 多分量插值的**每个分量单位一致**
- [ ] 关键值内联，没有被常量引用污染
- [ ] 颜色 / 字族来自 `useTheme()`，没有 import 具体主题文件
- [ ] `Interactive.*` 有硬编码 `name`
- [ ] 补间里没有 `getBoundingClientRect()`
- [ ] 没有动画 `width` / `height` / `top` / `left`
- [ ] 异步资源包了 `delayRender` / `continueRender`
- [ ] 已在演示合成里加了一个场景
- [ ] 在 `components/specs.tsx` 里声明了 `display`（block / inline / container）、`demoFrame`（动画完成帧）
      与 `tunable`（1–3 个「想改 / 能改」的 prop，判据是能不能说出「把它改成 X」）
- [ ] `npx tsc --noEmit` 通过
- [ ] **抽帧看过**，动效真的动了
