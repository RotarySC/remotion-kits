# hotspot — 清单（热点解析）

**类型包**（不是内核）。给「一起事件从出现到发酵」这类**周期性、模板化的热点解析**视频用：
每期讲同一组信息形态（立题 / 脉络 / 各方说法 / 数据 / 引述 / 收束），
只是内容在换。所以它把**版面骨架**一次做掉，之后每期只填内容。

**它只放差异。** 它是 `kits/kernel/` 的**组合者**，不是它的副本 —— 内核那三层
（19 个原语 / 通用版式 / 通用家具 / 护栏 / 母版引擎 / 4 个主题）全系统只有一份，
本套件通过根目录的 `compose.ts` 声明从它补入。本套件自己加的是**内核装不下的三样**：

| 加的东西 | 为什么内核装不下 |
| --- | --- |
| **3 个版式**：`timeline` / `stance` / `multi-stat` | 内核只有 cover / headline / list / stat / quote / closing；「事件脉络」「各方立场并列」「多个数字对照」是三种**不同的信息形态**，不是同一个版式的换皮 |
| **2 件家具**：事件时间戳、来源与可信度 | 热点是**在推进的**，而且「谁说的、可信到什么程度」是整片成立的前提 —— 两者每期都在，属于家具 |
| **2 个主题**：`signal-dark` / `alert-contrast` | 类型专属的视觉身份（冷静数据感 ↔ 高警示头版感） |

> **它是怎么来的**：按 `references/creation-workflow.md` 的八步 —— 先从「热点解析」这个类型需求
> 拆解出信息形态，再按「主题 → 母版 → 组件」的顺序逐层落地，最后抽帧验证、入库。
> （拆分前它确实是内核的一份完整副本；2026-10-04 的 T01/T02 裁定之后改成「只放差异」，
> 本文件下面那些**验证记录**保留了当时的写法与数字 —— 那是历史，不改。）

## 何时用

| 你要的东西 | 从这里拿 |
| --- | --- |
| 事件脉络（时刻 + 事件，推演到当前） | `master/layouts/TimelineLayout.tsx` |
| 各方说法并列对照 | `master/layouts/StanceLayout.tsx` |
| 多个数字放在一起比较 | `master/layouts/MultiStatLayout.tsx` |
| 内核那 6 个通用版式 | `kits/kernel/master/layouts/` |
| 事件时间戳、来源可信度 | `master/furniture/EventStamp.tsx`、`master/furniture/SourceBadge.tsx` |
| 换一套长相 | `theme/index.ts` 的 2 个方向（内核那 4 个也能直接用） |
| 母版引擎 / 护栏 / 19 个原语 | `kits/kernel/` —— **不用复制**，装的时候一起装；元件层由 `compose.ts` 补入 |
| 运行时怎么组合 | `master/MasterFrame.tsx`（内核引擎 + 本套件家具的**适配器**） |
| 验证载体 | `templates/` 的母版演示与主题演示 |

## 结构

```
hotspot/                    ← **17 个文件**（内核 55；拆分前本套件是 57 —— 差的就是内核那一层）
├── compose.ts              ← ★ **资产声明**：`sources: ['../kernel']`
├── kit.md
├── labels.ts               ← **只填本套件那几层**（版式 / 家具 / 主题 / 自己那几场场景）；
│                              元素与组件层场景的中文名归内核那份 —— 生成器按合并视图取表
├── theme/                  ← 本类型自己的两个方向（唯一能整包替换的一层）
│   ├── signal-dark.ts      ← 默认：冷静的数据感
│   ├── alert-contrast.ts   ← 高警示的头版感
│   └── index.ts            ← ThemeId / THEMES / THEME_IDS / getTheme 注册表；
│                              re-export 内核的 `ThemeProvider` / `useTheme`（全系统只有一个 context）
├── master/                 ← 母版层：本类型的版面差异
│   ├── types.ts            ← 本类型那 3 个版式的 LAYOUT_SPECS + `FurnitureConfig` 的 `&` 扩展
│   │                          （**控制参数** `staggerInFrames` 不进槽表 —— 名字在内核的
│   │                           `LAYOUT_CONTROL_PROPS`，判据见 `master-contract.md` §4）
│   ├── stagger.ts          ← 三个新版式共用的逐条时序收紧
│   ├── MasterFrame.tsx     ← ★ **适配器**：把本套件家具送进内核引擎的 `headExtra` / `footExtra`
│   ├── furniture/
│   │   ├── EventStamp.tsx  ← ★ 本类型特有
│   │   └── SourceBadge.tsx ← ★ 本类型特有
│   └── layouts/            ← 3 个 ★ 本类型特有（通用那 6 个在内核里）
└── templates/
    ├── ShowcaseScenes.tsx  ← 母版演示与主题演示**共用**的最坏情况内容
    ├── MasterShowcase.tsx  ← 母版层验证载体（默认主题）
    └── ThemeShowcase.tsx   ← 主题层验证载体（一个主题一个合成）
```

⚠️ **没有 `components/`、`guards/`、`assets/`、`KitShowcase.tsx`、`mock*.ts`、`Scene.tsx`**
—— 那些都在**内核**里。本套件**不持有元件层**，所以也不带 `COMPONENT_SPECS`、
不带组件层演示合成、不为内核的 19 个原语写中文名。

## 与内核的关系（**组合，不是复制**）

| | 在哪 | 为什么 |
| --- | --- | --- |
| 原语 19 个 + `COMPONENT_SPECS` + `Stage` 底色 | **内核** | 类型包**结构上不可能**持有它们 |
| 组件层演示（`KitShowcase` + `mock*` 夹具 + `Scene`） | **内核** | 它演示的就是原语；原语在主那里，演示也在主那里 |
| 通用版式 6 个 / 通用家具 2 件 / 护栏 / 母版引擎 / 4 个主题 | **内核** | 所有类型包共用 |
| 本类型那 3 个版式 / 2 件家具 / 2 个主题 / 母版与主题演示 | **本套件** | 内核装不下的那些 |
| 展示层的组合方式 | **本套件的 `compose.ts`** | 生成器照声明补入上面两行；**工具不认识 `kernel` 这个名字** |
| 运行时的组合方式 | **本套件的 `master/MasterFrame.tsx`** | 内核引擎 + 本套件家具，**调用方接口不变** |

**装的时候内核与类型包一起装**（`SKILL.md` 第七节）—— 本套件自己没有原语，单独一份编译不过。

- **「改内核不会自动流入」这句话的代价变了**：本套件**没有**内核那份文件，
  所以不存在「两份同时在改、改一处漏一处」。要守的只有两件 ——
  `compose.ts` 的声明与目录一致（生成器会 WARN）、本套件自己那几层的回归（`modification-workflow.md` 第 5 节）；
- **组件层未新增任何原语**：本套件的价值在版式层与家具层，叶子元素沿用内核
  （按 `authoring.md` 步骤 0，三个新版式的内部结构只出现一次，内联比重抽象更省事）。

## 主题清单（**方向对立，用眼睛选**）

| id | 长相 | 关键差异 |
| --- | --- | --- |
| `signal-dark`（默认） | 冷静的数据感 | 近黑底 + 青绿强调 + 等宽数字 + **1px 细线 + 直角（圆角 0）**；报头带 104 |
| `alert-contrast` | 高警示的头版感 | 纸白底 + 近黑墨 + 朱红强调 + **4px 粗线 + 胶囊（圆角 999）**；报头带 116；入场带回弹 |

两个方向在**色板、字族、字阶、安全区、间距、动效签名、图形语言**七个维度上都不一样
（`theme-contract.md` 第 1 节），不是「同一套换了个色」。
字体族都点名了**本机真实存在**的字（`Microsoft YaHei` / `Consolas` / `SimHei` / `Courier New`），
避免 Chromium 按字重逐段回退。

**加第三个主题的最简路径**：照 `signal-dark.ts` 复制一份 → 在 `theme/index.ts` 三处登记 →
重跑下方闭环。**版式与家具一行都不用改**（已实测，见验证记录）。

## 九个版式的槽契约

见 `master/types.ts` 的 `LAYOUT_SPECS`（机器可读）。摘要：

| 版式 | 槽 | 溢出策略 |
| --- | --- | --- |
| `cover` | kicker? · title · meta? | fit · **fit-n-lines** · fit |
| `headline` | index? · title · summary? | none · **fit-n-lines** · clamp |
| `list` | title · items[] | fit · fit（逐条 + 按条数收行距；带主字段时**分两列**） |
| `stat` | value · unit? · label · note? | fit · fit · fit · clamp |
| **`timeline`** | title · events[] · note? | **fit-n-lines** · fit · clamp |
| **`stance`** | topic · sides[] · note? | **fit-n-lines** · fit · clamp |
| **`multi-stat`** | label · items[] · unit? · note? | fit · fit · fit · clamp |
| `quote` | text · attribution? | **fit-n-lines** · fit |
| `closing` | title · meta? | **fit-n-lines** · fit |

**`lines` 槽的编码约定**：每条用 **TAB**（`\t`）分隔主字段与说明，例如
`'09-18 14:20\t监管部门通报已介入'`。用 TAB 而不是逗号或竖线 —— 文案里出现逗号和竖线是常态。
解析在 `master/slots.ts`，**没有分隔符时整条当说明**（宁可少一个时刻，也不错切）。

**消费 `lines` 槽的版式必须调用 `splitEntry`** —— 直接把整条字符串交给浏览器，
TAB 会被 HTML 塌缩成一个空格，主字段与说明的区别**完全消失**，而且不报错、`tsc` 全绿。
本套件有 4 个消费者：`timeline` / `stance` / `multi-stat` / `list`。
其中 `list` 曾经漏了这一步（真实片子的抽帧抓到，见验证记录）。

### 三个新版式的设计理由（都是形态决定的）

| 版式 | 关键决定 | 为什么 |
| --- | --- | --- |
| `timeline` | **纵向**而不是横向 | 节点描述可能到 40 字；横向 6 列每列只有 290px，一列放不下就得缩字号。纵向每行可用 `contentWidth − 时刻列`，正文号也放得下 |
| `stance` | **并列**而不是逐条，用**竖线**分隔 | 这个版式的信息就是「对照」—— 竖排成清单只能记住最后一条；用盒子会让每一方看起来是独立卡片，竖线才表示「同一张桌子上的几方」 |
| `multi-stat` | 所有数字**共用一个字号**（按最长的定） | 各自撑满会让小数字被放大成假的重点。这是与内核 `stat` 的本质区别：`stat` 说「这个数字很大」，`multi-stat` 说「这几个数字放一起能看出趋势」 |

## 本类型特有的两件家具

| 家具 | 内容 | 位置 |
| --- | --- | --- |
| `EventStamp` | `elapsed`（事件第 N 天）· `updatedAt`（最后更新）· `phase?`（阶段标签） | 报头带**第二行** |
| `SourceBadge` | `name`（来源）· `credibility?`（`high`/`medium`/`low`） | 页脚**左侧**；给了它就忽略 `footer.left`（两者抢同一位置） |

**两件都没有新增主题维度 —— 这是实测结论，不是设计假设。**
它们只消费已有的七个维度：色用 `accent` / `furniture` / `bg` / `muted`，字用 `font.mono` + `type.caption`，
形用 `graphic.accentBar` 与 `graphic.blockRadius`。

- 报头容下第二行靠**调高 `space.mastheadHeight`**（104 / 116）—— 那本来就是个标量，属于主题；
- 可信度三级只用现有色板表达：`high` 实心强调色徽章、`medium` 描边徽章、`low` 弱化（`muted`）描边徽章。

> 母版契约说「出现 `if (theme.name === …)` 即说明主题层缺字段」。这两件家具**没有出现任何分支**，
> 所以主题层不需要为它们加字段。如果将来要加「可信度专用色」，那才该是一个新的主题字段。

## 安装

```powershell
Copy-Item "<SKILL_DIR>\kits\hotspot" "<project>\src\kits\hotspot" -Recurse
```

然后注册演示合成（验证载体）：

```tsx
import {Composition} from 'remotion';
import {THEME_IDS} from './kits/hotspot/theme';
import {KitShowcase} from './kits/hotspot/templates/KitShowcase';
import {HotspotMasterShowcase} from './kits/hotspot/templates/MasterShowcase';
import {HotspotThemeShowcase} from './kits/hotspot/templates/ThemeShowcase';
import {SHOWCASE_TOTAL_FRAMES} from './kits/hotspot/templates/ShowcaseScenes';

<Composition id="HotspotKitShowcase" component={KitShowcase} durationInFrames={240} fps={30} width={1920} height={1080} />
<Composition id="HotspotMasterShowcase" component={HotspotMasterShowcase} durationInFrames={SHOWCASE_TOTAL_FRAMES} fps={30} width={1920} height={1080} />
{THEME_IDS.map((themeId) => (
  <Composition key={themeId} id={`HotspotThemeShowcase-${themeId}`} component={HotspotThemeShowcase}
    defaultProps={{themeId}} durationInFrames={SHOWCASE_TOTAL_FRAMES} fps={30} width={1920} height={1080} />
))}
```

## 用法

```tsx
import {getTheme} from './kits/hotspot/theme';

<MasterFrame
  theme={getTheme('signal-dark')}          // ← 换主题只改这一行
  furniture={{
    masthead: {title: '热点解析', meta: '第 018 期 · 2026-09-19'},
    eventStamp: {elapsed: '事件第 3 天', updatedAt: '2026-09-18 14:20 更新', phase: '发酵期'},
    source: {name: '多方公开信息', credibility: 'high'},
    footer: {right: '内容自述', progress: {current: 2, total: 6}},
  }}
>
  <Sequence from={0} durationInFrames={60} premountFor={30} name="timeline">
    <TimelineLayout
      title="事件是怎么走到这一步的"
      events={['09-16 09:12\t一段现场视频出现', '09-18 14:20\t监管部门通报已介入']}
    />
  </Sequence>
</MasterFrame>
```

## 依赖

与内核相同：**唯一额外依赖 `@remotion/layout-utils`（官方包，版本随 Remotion）**。
溢出护栏必须真的测量，靠猜字号一定会溢出。

```bash
npx remotion add @remotion/layout-utils
```

## 渲染配置档

纯 DOM，无 WebGL、无外部素材、无字体下载 —— **无特殊渲染要求**。见 `render-profiles.md` 的「纯排版」档。

```bash
npx remotion render HotspotMasterShowcase out/draft.mp4 --scale=0.5 --crf=28 --jpeg-quality=70
```

## 已知限制

| 限制 | 对策 |
| --- | --- |
| `lines` 槽用 TAB 编码，**内容侧必须遵守** | 文案里出现 TAB 会错切。生成内容时把 TAB 当保留字符 |
| `stance` 方数越多，每方越窄、字号越小 | 3 方以上建议拆成两屏；护栏会给下限，但接近下限时可读性已经变差 |
| `multi-stat` 共用字号 ⇒ **数字越多越小** | 4 个是上限；再多的数字请拆版式，而不是继续缩 |
| `multi-stat` 的 `unit` 是**共享单位** | 数字**异质**时**不要传 `unit`**，把单位写进每个数值里（如 `'2 小时 41 分'`）。传了会把单位套到不该有的数字上 —— 抽帧抓到过「02:41 条」这种错话 |
| `EventStamp` 的内容是**静态字符串** | 时间戳不由版式计算（「第几天」需要知道事件起点）。内容侧负责格式化 |
| 元件层是**整层**从内核补入的 | 本套件**不能在保留内核 19 个原语的同时再添第 20 个**。真需要时：通用的进内核，只服务本类型版式的放本套件自己的目录做**内部件**（它不是契约原语）。边界与理由见 `references/authoring.md` 步骤 1 |
| `Scene.tsx` 只服务组件层验证 | 出片一律用母版；组件层验证**故意不经过母版**，否则家具与几何会遮蔽组件自身的行为。⚠️ 它现在住在**内核**（随元件层一起补入） |
| 三个新版式的分栏靠 `flex: 1` + 固定 `width` | 中文断行由浏览器做（护栏量的是最长一条的整体宽度），极长单词会溢出 |

## 验证记录（实测，非推断）

> ⚠️ **本节是历史记录，按当时的样子保留。** 那个时期：内核叫 `kit-core`、
> **每个套件各带一份内核的完整副本**（本套件当时 57 个文件）、展示页的页签是 `#tab=kit-core`、
> 每个套件自带 `KitShowcase` 与 `FORKS.md`。2026-10-04 的 T01/T02 裁定之后这些都不成立了
> （见本文件开头的「与内核的关系」）。**`FORKS.md` 后来按 T01 §3 删掉了** ——
> 它的活由**更新器**的基线接手（`tools/update-kits.ps1`）。
> **要复现这里的命令，把 `kit-core` 换成 `kernel`**；那几轮的逐字节比对记录仍然说明当时的事实，
> 但已经不是今天该做的动作。
> 教训本身没变：**`tsc` 抓不到渲染期错误，抽帧是唯一可靠的确认手段。**

环境：Remotion **4.0.523**、TypeScript **5.8.2**、React **19.0.0**、`strict: true`、Chromium 内核 = Edge。

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit` | ✅ exit 0 |
| `remotion compositions` | ✅ 4 个合成注册成功：`HotspotKitShowcase`(240) / `HotspotMasterShowcase`(660) / `HotspotThemeShowcase-signal-dark`(660) / `HotspotThemeShowcase-alert-contrast`(660) |
| **6.1 静态封层**（layouts / furniture / guards / components 里的色值 / 主题名 / `getTheme`） | ✅ **0 命中**；4 个封层目录里每个文件都只 import `theme/context` |
| **6.2 抽帧**：2 个主题 × 10 个场景（`--scale=0.5`） | ✅ 20 张全部 exit 0，逐张目视正确 |
| **6.2 抽帧**：4 个清单类版式的**末尾帧**（全分辨率） | ✅ `timeline`@296 / `stance`@356 / `multi-stat`@416（异质）/@476（同质） |
| 组件层（`HotspotKitShowcase` @178） | ✅ 出图正常，强调条 / 高亮 / 下划线都跟着主题走 |
| **6.3 硬指标**：改 `signal-dark` 的 `accent` + `stagger` + `blockRadius` 三处 | ✅ **29 个封层文件逐条一致（版式 0 行改动）**；还原后与基线逐条一致 |
| 可选分支覆盖 | ✅ `phase` 有/无、`unit` 有/无、可信度 `high`/`medium`/`low`、`note` 有/无 —— 全部在抽帧里出现过 |
| **基座回归同步** | ✅ 基座修掉「孤字 / 长引文折行」两个缺陷后，本套件的 `guards/fitting.ts`、`components/Quote.tsx`、`master/layouts/HeadlineLayout.tsx` 已同步（12 个封层文件与 `kit-core` 再次逐字节一致），并重跑本套件的 **2 主题 × 10 场景**抽帧 |

### 抽帧抓到并修掉的 2 个缺陷（`tsc` 全绿，只有看图能发现）

| # | 症状 | 根因 | 修法 |
| --- | --- | --- | --- |
| 1 | **时间线的竖轨在深色主题下几乎看不见**，版式读起来像一份清单 | 两个原因叠加：`signal-dark` 的 `rule`（`#1B2927`）太暗，不足以承担结构线；轨道又取了发丝粗细（`ruleThickness` = 1px）。**同一个版式在浅色主题下正常**，说明问题在值而不在版式 | ① `rule` → `#2E4440`（界格线要能当结构线用）；② 轨道改用 `graphic.railThickness`（1px 主题给 3px、粗条主题给 6px）。顺带让页脚规则线与数字下强调条也变清楚 |
| 2 | **共享 `unit` 被套到异质数字上**，出现「02:41 条」「17.4 条」这种错话 | 槽契约把 `unit` 定义成「共同单位」，而热点解析里的数字**常常不同单位**（讨论量 / 账号数 / 用时 / 增速），所以这个字段在真实内容上会被误用 | ① `LAYOUT_SPECS` 的 `note` 写明「**只有全部数字同单位时才用**；不一致就把单位写进每个数值里」；② 演示改成**两个 `multi-stat` 场景**：一次异质（单位内嵌、不传 `unit`）、一次同质（传 `unit`）—— 两条分支各验一遍 |

> 这两条都是**框架该暴露的东西**：第 1 条说明「主题值要经过抽帧校准，不能凭感觉给」，
> 第 2 条说明「槽契约的字段语义要在真实内容上验，否则会被误用」。两条均已写进上表的已知限制。

### 回写：`list` 漏解析 `lines` 槽 + 夹具补上缺失的分支

`list` 的 `items` 是 `lines` 槽，却从未调用 `splitEntry`。**本套件的演示合成一直没暴露它** ——
因为 `list` 场景从来没写过带主字段的条目，这条分支在展示页里根本走不到。
最后是**一支真实片子**的抽帧一撞就撞上了：一段
「本地打包 据排查：客户端扫描工作区…」被读成一句话。

修法与波及面：`kits/*/master/layouts/ListLayout.tsx`（两份）、基座新增 `master/slots.ts`、
`references/master-contract.md` §4/§5 各补一条硬规则。夹具侧 `SHOWCASE_LAYOUTS` 里
`list` 出现**两次**（不带 / 带主字段），第二遍放在**末尾**以免改动前面所有场景的帧号。

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit` | ✅ exit 0 |
| `remotion compositions` | ✅ `HotspotMasterShowcase … 660 (22.00 sec)`（11 场景 × 60 帧） |
| 抽帧：**带主字段** | `HotspotMasterShowcase @656`（场景 10）→ ✅ 主字段右对齐 / 等宽 / 强调色，与说明**一眼分得开**；5 条主字段长度不一，未溢出 |
| 抽帧：**不带主字段** | `HotspotThemeShowcase-signal-dark @176`（场景 2）→ ✅ 照旧，帧号与改动前一致 |
| 主题对照 | `HotspotThemeShowcase-alert-contrast @656` 抽查浅色主题 → ✅ 强调色在纸白底上对比度足够 |
| 演示合成 | ✅ `list` 两条分支各一场；旧帧号（176 / 296 / 356 / 416 / 476 / 510 / 570）**全部仍然有效** |

> **教训**：「每个 prop 分支都摆一遍」如果只有**声明**、没有校验，就等于没摆。
> 本套件的可选分支覆盖表（文件头注释）当时列了 4 条，恰好漏掉的就是最容易坏的那条结构分支。

### 展示页：五层展品补中文名（新增 `labels.ts`）

需求是「展示页里每个展品都要有中文名」。口径：**代码名在前、中文名在后**（`Title · 主标题`），
五层全做（元素 / 版式 / 家具 / 主题 / 场景）。

| 检查 | 结果 |
| --- | --- |
| 新增 `labels.ts` | **29 条**：元素 10 / 版式 9 / 家具 4 / 主题 2 / 场景 4 |
| 覆盖率校验（`generate.ps1`） | ✅ **0 处不一致**（`-DiscoverOnly`） |
| 校验器**真的会响**（反向注入） | ✅ 把 `'Title'` 改成 `'Titel'` + 删掉 `'alert-contrast'` → 命中 **3 条 WARN**（元素缺名 / 键对不上 / 主题缺名），还原后回到 0 |
| 展示页验收（`showcase/verify.mjs`） | ✅ **49/49**（当轮总数；现为 **52**），从 `#tab=*` / `hotspot` / `kit-core` 三个入口各跑一遍 |
| 页面观感 | ✅ 抽图确认：元素铭牌 `Title · 主标题`、版式 `cover · 封面`、家具 `EventStamp · 事件时间戳`、主题 `signal-dark · 信号暗色`、场景 `Scene 1 — heading · 标题` |
| **出片路径 0 行改动** | ✅ `theme/**` + `master/**` + `guards/**` + `components/**` + `templates/**` 共 **40 个文件与改动前逐字节一致**（SHA256 比对） |

> `labels.ts` **只被 `showcase/generate.ps1` 解析**，出片路径一次都不读它 ——
> 所以它没有进 `ComponentSpec` / `LayoutSpec` / `Theme` / `FurnitureConfig`。
> 中文名是展示，不是运行；而且五层里有三层根本没有声明文件，逐层加字段会变成三套机制。

### 新增两个原语：`MediaStage` + `MediaCard`（自基座复制）

基座加了「多媒体框」两个原语（大框 + 带缩放特性的迷你框），本套件**原样复制**：

| 检查 | 结果 |
| --- | --- |
| 复制范围 | `components/{MediaStage,MediaCard,specs}.tsx`、`templates/{KitShowcase,mockMedia}.tsx/ts`、`assets/`、`labels.ts` 的 `elements` 两条 |
| 与基座逐字节一致 | ✅ 上述文件与本套件的对应文件**逐字节相同**（`Scene.tsx` 也仍一致） |
| `tsc --noEmit` | ✅ exit 0 |
| `remotion compositions` | ✅ `HotspotKitShowcase` **510 帧**（原 240：+3 场） |
| 抽帧 | ✅ 与基座同一组：大框静态（`cover` 裁切）/ 大框视频（`contain` 留边 + 逐帧在变）/ 迷你框群静止与展开 |
| **基座后续修正已回灌** | ✅ 基座修掉「标题在半程换边」「展开框被静止框压住」两处后，`components/{MediaCard,specs}.tsx` 已重新复制（本套件 4 个副本的 `MediaCard.tsx` / `MediaStage.tsx` / `specs.tsx` 再次**逐字节一致**） |
| **新增 `ScrollArea` 已回灌** | ✅ 基座新增「滚动区」后，`components/ScrollArea.tsx`、`templates/{mockDoc.tsx,KitShowcase.tsx}`、`components/specs.tsx` 已复制（四份副本**逐字节一致**）；本套件的 `labels.ts` 只加了 2 条（元素 `ScrollArea` + 场景 `Scene 8`），**其余各层仍是本套件自己的** |
| **`ScrollArea` 在本套件也抽帧验过** | ✅ `HotspotKitShowcase` 600 帧，8 场各一张；`Scene 8` 用**本套件的主题**渲染（标题栏与行号取 `signal-dark` 的 accent），钉住 / 平移 / 滑块位置都对 |
| **本套件特有部分一行未动** | ✅ `theme/**` `master/**`（含 3 个专属版式与 2 件专属家具）、`ShowcaseScenes.tsx` 的 11 场景夹具均未改 |

设计与两个实测坑见 `kits/kernel/kit.md` 的同名小节 —— 不在这里重抄一份（两份真相一定会分叉）。

### 新增三个原语：`TextTag` + `RichTextBox` + `BarChart`（自基座复制）

基座加了「文字标签 / 富文本框 / 水平条形图」三个原语，本套件**原样复制**：

| 检查 | 结果 |
| --- | --- |
| 复制范围 | `components/{TextTag,RichTextBox,BarChart,specs}.tsx`、`templates/{mockData.ts,KitShowcase.tsx}`；本套件的 `labels.ts` 只加了 6 条（3 元素 + 3 场景） |
| 与基座逐字节一致 | ✅ 上述文件与本套件的对应文件**逐字节相同**（四份副本一起比对） |
| `tsc --noEmit` | ✅ exit 0 |
| `remotion compositions` | ✅ `HotspotKitShowcase` **780 帧**（原 600：+3 场各 60 帧） |
| 抽帧 | ✅ 三场各一张（`648 / 690 / 755`）—— 用**本套件的主题**渲染：标签取 `signal-dark` 的绿强调 + 方角，条形图的条与数值同色，富文本的高亮 / 行内代码都跟着主题走 |
| 回归抽帧 | ✅ 8 场各一张（`30/90/150/210/270/330/430/555`）**与改动前逐字节相同** —— 本套件特有部分零回归 |
| **本套件特有部分一行未动** | ✅ `theme/**`、`master/**`（含 3 个专属版式与 2 件专属家具）、`ShowcaseScenes.tsx` 的 11 场景夹具均未改 |

三条设计决定与两条实现细节见 `kits/kernel/kit.md` 的同名小节 —— 不在这里重抄一份。

### 新增一个原语：`Panel`（内容卡，自基座复制）

基座加了「内容卡」原语（有边界的容器：头 / 身 / 尾三段槽、框高跟内容走、`dim` 强调态），本套件**原样复制**：

| 检查 | 结果 |
| --- | --- |
| 复制范围 | `components/{Panel,specs}.tsx`、`templates/{mockData.ts,KitShowcase.tsx}`；本套件的 `labels.ts` 只加了 2 条（元素 `Panel` + 场景 `Scene 12`） |
| 与基座逐字节一致 | ✅ 上述文件与本套件的对应文件**逐字节相同**（四份副本一起比对） |
| `tsc --noEmit` | ✅ exit 0 |
| `remotion compositions` | ✅ `HotspotKitShowcase` **840 帧**（原 780：+1 场 60 帧） |
| 抽帧 | ✅ 两帧（`810` / `828`，强调态的两个端点）—— 用**本套件的主题**渲染：标签取 `signal-dark` 的绿强调、方角；描边与硬阴影取 `ink`，所以深色主题上是**浅色偏移**，仍然看得见 |
| 回归抽帧 | ✅ 8 场各一张与改动前逐字节相同 |
| **本套件特有部分一行未动** | ✅ `theme/**`、`master/**`（含 3 个专属版式与 2 件专属家具）、`ShowcaseScenes.tsx` 的 11 场景夹具均未改 |

⚠️ **一条同步事故（这一轮踩的，已恢复）**：批量复制时 `labels.ts` 被当成「套件无关文件」，
于是**基座那份覆盖了本套件的** —— 9 个版式 / 4 件家具 / 2 个主题的中文名全被抹掉。
靠已发布的技能镜像恢复。**教训**：`labels.ts` 是套件特有的，**不要写进多套件批量复制的清单**。

### 新增一个原语：`Stat`（大数字）+ `Panel` 的宽度旋钮（自基座复制）

基座这一轮做了两件事：给 `Panel` 加了**宽度旋钮**（撑满 / 定宽 / `'fit'` 跟内容走），
新增「大数字」原语（数字 + 单位 + 标签，三段错开入场）。本套件**原样复制**：

| 检查 | 结果 |
| --- | --- |
| 复制范围 | `components/{Panel,Stat,specs}.tsx`、`templates/{mockData.ts,KitShowcase.tsx}`；本套件的 `labels.ts` 只加了 2 条（元素 `Stat` + 场景 `Scene 13`） |
| 与基座逐字节一致 | ✅ 上述文件与本套件的对应文件**逐字节相同**（四份副本一起比对） |
| `tsc --noEmit` | ✅ exit 0 |
| `remotion compositions` | ✅ `HotspotKitShowcase` **900 帧**（原 840：+1 场 60 帧）；`HotspotMasterShowcase` 未动（660） |
| 抽帧 | ✅ 大数字（`870` / `850`）—— 用**本套件的主题**渲染：数字取 `signal-dark` 的青绿强调、方角、等宽；三段错开（第 10 帧只有数字，第 30 帧齐） |
| 回归抽帧 | ✅ 内容卡（`805`）与改动前逐字节相同；13 场各一张都出得来 |
| 展示页验收 | ✅ **61/61**（上一轮 57）；本套件的元素墙 **18/18** 有中文名 |
| **本套件特有部分一行未动** | ✅ `theme/**`、`master/**`（含 3 个专属版式与 2 件专属家具）、`ShowcaseScenes.tsx` 的 11 场景夹具均未改 |

### 大数字的三条「动态」（自基座复制）

基座这一轮给 `Stat` 加了两件事：`reserveChars`（数字区按 N 个字符预留宽度 —— 跳动与计数到时
位数变化不会推着单位跑）与 `rollFrom` + `roll`（逐位滚动）。本套件**原样复制**：

| 检查 | 结果 |
| --- | --- |
| 复制范围 | `components/{Stat,specs}.tsx`、`templates/{mockData.ts,KitShowcase.tsx}`；本套件的 `labels.ts` 改了 1 条（`Scene 13` 改名）+ 加了 1 条（`Scene 14`） |
| 与基座逐字节一致 | ✅ 上述文件与本套件的对应文件**逐字节相同**（四份副本一起比对） |
| `tsc --noEmit` | ✅ exit 0 |
| `remotion compositions` | ✅ `HotspotKitShowcase` **960 帧**（原 900：+1 场 60 帧）；`HotspotMasterShowcase` 未动（660） |
| 抽帧 | ✅ 两条新场景都出得来（计数到 `854` / `866` / `880`、数位滚动 `915` / `950`）；`%` 的像素位置在本套件的主题下同样恒定 |
| 展示页验收 | ✅ **62/62**（上一轮 61）；本套件的场景墙 **14/14** 有中文名 |
| **本套件特有部分一行未动** | ✅ `theme/**`、`master/**`（含 3 个专属版式与 2 件专属家具）、`ShowcaseScenes.tsx` 的 11 场景夹具均未改 |

### 元素格子的「越界与贴边」＋ `MediaStage` 默认尺寸的修正（自基座复制）

基座这一轮修了三件事，其中**只有第三件是组件逻辑**：

1. `Stat` 演示的字号 / 条间距（摆得太大，贴着内容区上下边）；
2. `Panel` 演示从**上下叠**改成**左右并排**，并把它那两段的 `RichTextBox.maxWidth` 从 460 收到 300；
3. **`MediaStage` 的默认尺寸**：原来取安全区的**宽度**（1760），而 16:9 的 1760 有 990 高 ——
   安全区只有 880，框**上下各越出 55px**、压进报头与页脚带。改成**安全区里放得下的最大 16:9**。

| 检查 | 结果 |
| --- | --- |
| 复制范围 | `components/{MediaStage,specs}.tsx`（`Panel.tsx` / `Stat.tsx` 本轮未改，只改演示） |
| 与基座逐字节一致 | ✅ 上述文件与本套件的对应文件**逐字节相同**（四份副本一起比对） |
| `tsc --noEmit` | ✅ exit 0 |
| `remotion compositions` | ✅ 两条时间轴都没变（`HotspotKitShowcase` 960 / `HotspotMasterShowcase` 660） |
| 抽帧 | ✅ 多媒体框两场（`270` / `330`）用**本套件的主题**渲染：方角、`signal-dark` 的描边色，1564×880 落在安全区内 |
| 展示页验收 | ✅ **63/63**（上一轮 62）；本套件的 18 个元素格四边余量都够（16:9 满幅那条按判据豁免） |
| **本套件特有部分一行未动** | ✅ `theme/**`、`master/**`、`ShowcaseScenes.tsx` 的 11 场景夹具均未改 |

### 新增一个原语：`Flow`（排列）＋ `Panel` 可被拉伸 ＋ 版式节奏可覆盖（自基座复制，2026-10-03）

基座这一轮把「一屏怎么分」从手写 flex 收进容器（`Flow`）、让 `Panel` **天生可被拉伸**，
并给五个版式加了 `staggerInFrames`（**显式值原样生效、不参与收紧** —— ⚠️ 当时**未裁定**，见 T06；
**T06 已于 2026-10-05 裁定为「原样生效 ＋ 溢出诊断」**，见本节末）。本套件：

| 检查 | 结果 |
| --- | --- |
| 复制范围 | `components/{Flow,Panel,specs}.tsx`、`templates/KitShowcase.tsx`（四份**逐字节相同**）；`labels.ts` 只加了 2 条（元素 `Flow` + 场景 `Scene 15`） |
| 本套件**特有**改动 | 三个专属版式 `TimelineLayout` / `StanceLayout` / `MultiStatLayout` ＋ `ListLayout` 各加 `staggerInFrames`（走 `slots.ts` 的 `staggerFrames`，而基座那份是**内联公式** —— 两份公式仍不等价，见下） |
| `tsc --noEmit` | ✅ exit 0 |
| `HotspotKitShowcase` | 960 → **1020 帧**（+1 场 60 帧） |
| 抽帧（**本套件主题**） | ✅ `out/flow/hs-flow-990.png` 扫描边实测：主 **1151** · 侧 **575**（比值 **2.002**）、两卡竖直跨度**都是** 110..637；下行三格宽 **847/423/423**（B:C 1.000）、三格高 **162/162/162**（极差 **0**） |
| 默认画面不变 | ✅ 既有场景的帧在改动前后**逐字节相同**（基座侧实测 Scene 12 的 800 / 820 帧），而新场景不同 —— **两向都有对照** |
| 一条**有意没做**的事 | 基座那份 `ListLayout` 的内联收紧公式与 `slots.ts` 的 `staggerFrames` **仍不等价**（`hold` 32 vs 34、基座多一个下限 `Math.max(2, …)`）。统一会改动默认画面，而本轮验收基准恰恰是「默认逐帧不变」，所以**留着** —— 记为已知问题 |

判据细节与两条测量坑（8px 硬阴影要取亮段起点、竖直扫描要按行限定 y 范围）见 `kits/kernel/kit.md` 的同名小节。

### 复跑命令

```powershell
$lab="<LAB>"; $k="<SKILL_DIR>\kits\hotspot"
Remove-Item "$lab\src\kits\hotspot" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item $k "$lab\src\kits\hotspot" -Recurse
Push-Location $lab
& "$lab\node_modules\.bin\tsc.cmd" --noEmit
& "$lab\node_modules\.bin\remotion.cmd" compositions
# 每个主题每个版式一张（前 4 个取中点帧，后 4 个清单类取末尾帧，quote/closing 取中点）
foreach ($t in @('signal-dark','alert-contrast')) {
  foreach ($f in @(30,90,150,210,296,356,416,476,510,570,630)) {
    & "$lab\node_modules\.bin\remotion.cmd" still "HotspotThemeShowcase-$t" "out/$t-$f.png" --frame=$f --scale=0.5
  }
}
# 本类型特有的 3 个版式 + 两个 multi-stat + 带主字段的 list：全分辨率末尾帧
foreach ($f in @(296,356,416,476,656)) {
  & "$lab\node_modules\.bin\remotion.cmd" still HotspotMasterShowcase "out/m-$f.png" --frame=$f
}
Pop-Location
```

然后**用看图工具逐张看** —— 这是唯一可靠的验收方式。**注意：3 个新版式是清单类的，抽中点帧会只看到前几条。**

### T06 落地：显式节奏溢出的诊断（2026-10-05）

裁定**原样生效、不参与收紧**，代价用**开发期诊断**顶上。本套件三个版式
（`TimelineLayout` / `StanceLayout` / `MultiStatLayout`）各加一次
`warnIfStaggerOverflows`（来自**内核**的 `guards/diagnostics.ts`）——判据是
`首条起始 + (条数−1) × stagger + 入场时长 > 场景时长` 就喊一声，**不改行为**。

| 项 | 值 |
| --- | --- |
| 三个版式的参数 | `TimelineLayout` lead **14** / 入场 **20** · `StanceLayout` **16** / **22** · `MultiStatLayout` **14** / **22** |
| 为什么参数要由版式给 | 它们**不是**同一个数（内核那份 `ListLayout` 是 14 / 18）—— 这正是「不统一收紧公式」那条既有决定在诊断上的后果 |
| 新增的跨套件依赖 | `../../../kernel/guards/diagnostics` —— 类型包 import 内核是 T01/T02 之后的正常形状（也正因此踩到了更新器的一个缺陷，见 `docs/2026-10-04-更新器-裁定与执行.md` §6 第 10 条） |
| 误报检查 | 展示页验收的「console error/warning 为 0」那条断言对三个版式的**默认**路径仍然全绿（默认值是收紧过的，本来就不会溢出） |
