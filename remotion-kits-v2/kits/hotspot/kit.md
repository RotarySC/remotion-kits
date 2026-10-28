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
hotspot/                    ← **只放差异**：内核那一层由 `compose.ts` 补入，不在这里
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
│   │                           `LAYOUT_CONTROL_PROPS`，判据见 [`master-contract.md`](../../references/master-contract.md) §4）
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
  `compose.ts` 的声明与目录一致（生成器会 WARN）、本套件自己那几层的回归（[`modification-workflow.md`](../../references/modification-workflow.md) 第 5 节）；
- **组件层未新增任何原语**：本套件的价值在版式层与家具层，叶子元素沿用内核
  （按 `authoring.md` 步骤 0，三个新版式的内部结构只出现一次，内联比重抽象更省事）。

## 主题清单（**方向对立，用眼睛选**）

| id | 长相 | 关键差异 |
| --- | --- | --- |
| `signal-dark`（默认） | 冷静的数据感 | 近黑底 + 青绿强调 + 等宽数字 + **1px 细线 + 直角（圆角 0）**；报头带 104 |
| `alert-contrast` | 高警示的头版感 | 纸白底 + 近黑墨 + 朱红强调 + **4px 粗线 + 胶囊（圆角 999）**；报头带 116；入场带回弹 |

两个方向在**色板、字族、字阶、安全区、间距、动效签名、图形语言**七个维度上都不一样
（[`theme-contract.md`](../../references/theme-contract.md) 第 1 节），不是「同一套换了个色」。
字体族都点名了具体字族（`Microsoft YaHei` / `Consolas` / `SimHei` / `Courier New`）—— 这些要在系统里真的装了才生效，目的是避免 Chromium 按字重逐段回退。

**加第三个主题的最简路径**：照 `signal-dark.ts` 复制一份 → 在 `theme/index.ts` 三处登记 →
重跑下方闭环。**版式与家具一行都不用改**（判据见 [`theme-contract.md`](../../references/theme-contract.md) 第 6.3 节）。

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
其中 `list` 曾经漏了这一步 —— 真实片子的抽帧抓到过，`tsc` 全绿、画面里主字段与说明粘成一句。

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

## 验证记录

**验收 = 三件事**：`tsc --noEmit` exit 0 · `compositions` 列出全部合成 · **按版式抽帧并真的看图**
（9 个版式各一张，清单类补末尾帧；加主题时每主题 × 每版式一张）。命令见 [`SKILL.md`](../../SKILL.md) 第四节。

本套件的三个专属版式是抽帧重点：它们的分栏与字号在真实文案上最容易出问题。
