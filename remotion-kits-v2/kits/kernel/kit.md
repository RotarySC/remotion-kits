# kernel — 清单（内核）

**内核。** 它不是「一堆通用组件」，而是**三层**：

```
主题层（长相）  ×  母版层（版面）  ×  组件层（原语）
```

**全系统只有这一份。** 类型包**不复制它** —— 类型包只放差异，并在自己的 `compose.ts` 里声明
「我组合了哪些来源」。展示层照那份声明把内核的**元件层**（19 个原语 + `COMPONENT_SPECS` +
`Stage` 底色）与**组件层演示**（`KitShowcase` 及其夹具）补进类型包那一页；
运行时则靠那个类型包自己的 `master/MasterFrame.tsx` **适配器**把「内核引擎 + 本套件家具」组合起来。

内核**不需要 `compose.ts`** —— 它上游没有别的来源。

## 何时用

任何视频都要它 —— 但它是**内核**，不是最终外观。用法有两层：

| 怎么用 | 读哪 |
| --- | --- |
| **直接用内核**（单一通用视频） | 下面这张表 |
| **通过一个类型包用**（热点解析这类） | 那个类型包的 `kit.md` —— 内核由它的 `compose.ts` 补入，你不用手动接 |

| 你要的东西 | 从这里拿 |
| --- | --- |
| 换一套长相（色板 / 字体 / 字阶 / 圆角） | `theme/index.ts` 的 4 个主题，或照 `theme/default.ts` 复制一份 |
| **换一张皮**（框的形状与装饰，不动颜色） | `skins/index.ts` 的皮表 ＋ `<Panel skin="…">` —— 见下「皮清单」 |
| 母版引擎（家具 + 内容区预约 + 几何下发） | `master/MasterFrame.tsx` |
| 一套能直接跑的通用版式 | `master/layouts/` 的 6 个版式 |
| 溢出护栏（测量 / 截断） | `guards/fitting.ts`、`guards/ClampLines.tsx` |
| 开发期诊断（参数越界 / 时序溢出） | `guards/diagnostics.ts`（`warnOnce` 去重；`warnIfStaggerOverflows` 报告） |
| 契约原语（文字动效等） | `components/` |
| **片子里要接一个三维场景**（外部素材，可编排机位） | `viewport/` —— 见下「三维视图」；场景内容不入库 |
| 机器可读的槽契约 | `master/types.ts` 的 `LAYOUT_SPECS` |
| **控制参数**（不是槽） | `master/types.ts` 的 `LAYOUT_CONTROL_PROPS` —— 「怎么排」类参数（`staggerInFrames`），**不进** `LAYOUT_SPECS`。判据见 `master-contract.md` §4 |
| 验证载体 | `templates/` 的 4 个演示合成 |
| 组件层验证（**故意不经过母版**） | `templates/Scene.tsx` —— 见下 |
| **类型专属家具怎么挂进来** | `master/types.ts` 的两个通用插槽 `headExtra` / `footExtra`（`master-contract.md` 有完整例子） |

## 结构

```
kernel/
├── labels.ts                 ← **内核那几层**的中文名（只服务展示页，不进运行时契约）
├── theme/                    ← 主题层：长相（唯一能整包替换的一层）
│   ├── types.ts              ← Theme 类型契约（七个身份维度）
│   ├── context.tsx           ← ThemeProvider / useTheme（各层唯一的主题入口）
│   ├── default.ts            ← default-dark：深色现代
│   ├── paper-seal.ts         ← 宣纸楷书
│   ├── bubble-pop.ts         ← 卡通胶囊
│   ├── neon-terminal.ts      ← 等宽终端
│   └── index.ts              ← ThemeId / THEMES / getTheme 注册表
├── master/                   ← 母版层：版面
│   ├── types.ts              ← 家具配置 + LAYOUT_SPECS（机器可读的槽契约）
│   │                             + LAYOUT_CONTROL_PROPS（控制参数，**不进**槽表）
│   ├── slots.ts              ← `lines` 槽的 TAB 编码解析（`SLOT_SEP` / `splitEntry`）
│   ├── MasterContext.tsx     ← 下发母版几何（版式测量要用 contentWidth）
│   ├── MasterFrame.tsx       ← 母版引擎
│   ├── furniture/
│   │   ├── Masthead.tsx      ← 报头：名称 + 元信息
│   │   └── FooterRail.tsx    ← 页脚：进度分段 + 规则线 + 左右小字
│   └── layouts/              ← 6 个通用版式（cover / headline / list / stat / quote / closing）
├── guards/
│   ├── fitting.ts            ← useFittedFontSize / useFittedLines / useTextSize
│   ├── ClampLines.tsx        ← 截断护栏
│   └── diagnostics.ts        ← 开发期诊断：`warnOnce` ＋ 时序溢出判据
├── skins/                    ← 皮：外观的**具名预设**
│   ├── index.ts              ← 皮表 + `SkinId` + `resolveSkin`（不存在的皮**明确报错**）
│   └── CornerMarks.tsx       ← 四角角标 —— 唯一那件**可组合的小装饰能力**
├── motion.ts                 ← 入场动效的最小公共计算 ＋「淡入上移」组合
├── viewport/                 ← **三维视图**：把外部三维场景接进来并按帧编排（不含场景内容）
│   ├── types.ts              ← SceneAdapter / SceneHost / Camera / Framing 的契约
│   ├── host.tsx              ← <Viewport>：画布 ＋ 每帧「定机位 → 取景 → 推进」
│   ├── cameras.ts            ← 机位库：static / crane / orbit / dolly / keyframes / cut / follow（全是 t 的纯函数）
│   ├── framing.ts            ← 取景：画幅、透视/正交的「装满画面」计算、缓冲区尺寸
│   ├── attach.ts             ← createHost 外壳 ＋ replayProbe（纯度探针）
│   └── spec.ts               ← VIEWPORT_SPECS：登记「这一类能做什么」
├── assets/                   ← 演示素材：自造的 `demo-clip.mp4`（240×180 / 60 帧 / 13 KB），见 assets/README.md
├── components/               ← 19 个契约原语（Title / Subtitle / TextReveal / Emphasis / BulletList / Quote / SectionHeading / ProgressBar / SafeArea / Stage / MediaStage / MediaCard / ScrollArea / TextTag / RichTextBox / BarChart / Panel / Flow / Stat）
│   └── specs.tsx             ← COMPONENT_SPECS：每个原语的 prop / `display` / `demoFrame` / 演示实例（展示页原语视图的数据来源，生成器会对照源码校验）
└── templates/
    ├── ShowcaseScenes.tsx    ← 母版演示与主题演示**共用**的最坏情况内容
    ├── KitShowcase.tsx       ← 组件层验证载体
    ├── MasterShowcase.tsx    ← 母版层验证载体（默认主题）
    ├── ThemeShowcase.tsx     ← 主题层验证载体（一个主题一个合成）
    ├── mockMedia.ts          ← 演示素材的**程序生成**部分（4:3 的 SVG「网页截图」，data URI）
    ├── mockDoc.tsx           ← `ScrollArea` 的长文档夹具（行号沟 + 正文 + 标题栏）
    ├── mockData.ts           ← `TextTag` / `RichTextBox` / `BarChart` / `Panel` / `Stat` 的夹具（含 `lines` 槽的 TAB 拼接）
    ├── mockScene.ts          ← `Viewport` 的**占位夹具**：线框立方体 + 一颗绕行的红点（canvas 2D 手写投影，几 KB）。红点是 `follow` 的目标，也是「跟得准不准」可按像素量的那个记号。⚠️ 不是资产、不承诺复用，也**不是**「怎么造 3D」的模板
    └── Scene.tsx             ← 组件层演示的脚手架（**故意不经过母版**）
```

## 什么时候不用母版（`Scene.tsx`）

**母版是标配** —— 三要素（家具 / 版式 / 槽契约）缺一个就退化成「一堆组件」。只有一个例外：

**组件层验证不走母版。** `KitShowcase` 用 `Scene.tsx` 而不是 `MasterFrame`，因为母版会带进来两样东西 ——
**家具**（报头 / 页脚 / 进度）与**内容区几何**（安全区预约与缩放）。它们会**遮蔽组件自身的行为**：
一个原语的位置或字号看着「对」，可能只是母版刚好把它摆对了地方。

| 验证哪一层 | 用什么 | 为什么 |
| --- | --- | --- |
| 组件层（原语） | `Scene.tsx` | **隔离** —— 看到的只能是组件自己的表现 |
| 母版层 | `MasterFrame`（默认主题） | 验家具与版式的配合 |
| 主题层 | `MasterFrame` + 换主题 | 同一份内容，差异只可能来自主题 |

**出片一律用母版。** `Scene.tsx` 只服务验证，不是成片可用的轻量替代品。

## 主题清单

| id | 长相 | 关键差异 |
| --- | --- | --- |
| `default-dark` | 深色现代 | Inter / 微软雅黑，冷蓝强调，圆角 4，边距 80/100 |
| `paper-seal` | 宣纸楷书 | KaiTi / FangSong，朱砂强调，方角，边距 96/112，横排更松 |
| `bubble-pop` | 卡通 | Comic Sans / 微软雅黑，荧光粉强调，粗胶囊（圆角 999），大字号小边距 |
| `neon-terminal` | 终端 | 全等宽 + FangSong，霓虹绿强调，1px 直角，最小边距 |

四个主题在**色板、字族、字阶、安全区、间距、动效签名、图形语言**七个维度上都不一样。
契约、命名规则与「0 行改动」硬指标见 `references/theme-contract.md`。

## 皮清单

**皮 ＝ 外观的具名预设**，由**调用处**点名：`<Panel skin="corner-marks">`。
它只声明**形状 / 结构的选择**（圆角档、角标），**不声明标量、不声明色值** ——
颜色仍全归主题，粗细归实例。所以三级优先是 **实例 prop > 皮 > 主题**。

| id | 差异项（就这两条） | 出处 |
| --- | --- | --- |
| `plain` | **空** —— 它就是现状 | 缺省皮。差异表为空是**判据**：机制本身必须不动画面 |
| `corner-marks` | `radius: 'square'` ＋ `cornerMarks: true` | 历史参考 `arch-v4.html` 的「图 2」 |

- **名字不存在时会直接抛错**（`resolveSkin`），**不静默退回 `plain`** —— 静默回退的症状是
  「画面看着正常，只是不像你以为的那张皮」，那种错不会有人发现。
- **标量不进皮表**：参考里那句「1px 细线」由调用处写 `borderWidth={1}`，不是皮的字段
  （§9.2：标量允许读主题默认值或由实例明确覆盖）。
- **首批只有这两张**，是裁定「选一到两种」的落地；加皮前先读 `skins/index.ts` 文件头那条判据
  （**定义性差异能不能靠现有能力 ＋ 至多一件小能力表达**，不能就先别建皮）。
  今天明确**没做**的两张与原因也写在那个文件头（`band-outline` 要改头的排法；
  `soft-round` 的彩色标题属于主题字段扩展，混进来会变成「两个都能改颜色」）。
- 四角角标那件装饰在 `skins/CornerMarks.tsx`。⚠️ 它**默认内缩 10px**：
  参考里框是 1px、角标 2px 所以贴角看得见；本套件框的粗细来自主题（默认 2px），
  贴角（`inset: 0`）时两者逐像素重合、抽帧出来**什么都看不见**（实测）。

## 三维视图（`viewport`）

片子里遇到 3D 场景时用它。**它不是建模工具、也不是场景库** —— 场景由作者在 Blender / 网页工具里做好，
这一层只管三件事：

| 这层做 | 怎么做 |
| --- | --- |
| **装载** | `SceneAdapter` 把外部素材包成 `SceneHost`；`createHost` 给外壳，作者填 5 个零件 |
| **机位** | `cameras.ts`：`static` / `crane` / `orbit` / `dolly` / `keyframes` / `cut` / `follow`，全是 `t` 的纯函数；`shots`（分镜）见下 |
| **取景** | `framing.ts`：画幅比、透视 `fov` / 正交高度、「装满画面」的计算 |
| **分镜** | `shots.ts`：给一个主体尺寸和几张镜头，按「主体占画面几成」反解距离，排成一条带切点与过渡的镜头表 |

三条判据：

- **场景内容不入库**（与 mp4 / 截图同一条规矩）；`templates/mockScene.ts` 只是占位夹具，让目录那一格有东西看。
- **能按 `t` 重放的才进得来**：靠真实时钟、靠「每次调用累加一步」的都过不了 `replayProbe` / `portingAudit`，那种就渲成序列帧走 `MediaStage`。
- **卸载要释放**：`renderer.dispose()` 只放资源、不丢上下文，`dispose()` 里还要主动 `WEBGL_lose_context`。

完整装载清单与边界见 [`references/viewport-contract.md`](../../references/viewport-contract.md)。

### 分镜（`shots`）：有建模、缺镜头

场景本身**没有镜头**时用它 —— 模型给了，但没人决定「先看全景还是先看窗、要不要切、什么时候推近」。
这时补的不是内容，是**看的方式**：产物是一份纯 JSON 镜头表，几何一个字节都不动。

```tsx
<Viewport
  adapter={myScene}
  framing={{mode: 'perspective', fov: 40}}
  camera={{
    kind: 'shots',
    subject: {center: [0, 0, 0], size: [1.44, 1.91, 1.91]}, // 主体的世界 AABB
    shots: [
      {id: 'establishing', duration: 1.3, view: {azimuth: 30, elevation: 14}, framing: {fill: 0.5},
       move: {to: {azimuth: 60, elevation: 12}}},
      {id: 'detail', duration: 1.2, view: {azimuth: 60, elevation: 12}, framing: {fill: 0.72}},
      {id: 'return', duration: 1.5, view: {azimuth: 95, elevation: 8}, framing: {fill: 0.6},
       transition: {frames: 10}, move: {to: {azimuth: 30, elevation: 14, fill: 0.5}}},
    ],
  }}
/>
```

五条约束（每一条都量过）：

| 约束 | 说明 |
| --- | --- |
| `subject.size` 是**世界单位**的 AABB | 说小了画面会空、说大了镜头会被推远。旋转件要报**旋转后**的包围盒（上面的 `1.91` 是立方体倾斜后的高度，不是边长 `1.44`）。⚠️ 因为量的是**包围盒**，所以肉眼看到的物体通常比 `fill` 小 —— 想让它读起来正好占几成，就按物体的实际外形声明 |
| `fill` = 主体**投影高度**占画面高度的比例 | 不是屏幕百分比、也不是宽度。宽度任何时候都不许溢出，装不下就退让（高度占比随之变小） |
| 各镜 `duration` 之和 = 合成长度 | 短了最后一镜被截断，长了最后一镜会停住 |
| `transition.frames` 在这一镜**开头** | 缺省硬切。过渡的起点是**上一镜末尾的姿态**（闭式可算，不需要记住上一帧） |
| 首尾要接得上（循环片段） | 最后一镜的 `move.to` 写回第一镜的 `view` / `fill`，接缝才是同一个机位 |

⚠️ **正交取景下的分镜还没做**：`orthoHeight` 决定大小、距离不影响它，取景尺的假设不成立；
现在会按透视解算并 `console.warn`。要正交就用固定机位 + `framing`。

## 依赖

**唯一额外依赖：`@remotion/layout-utils`（官方包，版本随 Remotion）。**

为什么不是「零依赖」：母版的溢出护栏必须**真的测量**。固定时长配变长内容，靠猜字号一定会溢出。这个包提供的 `fitText` / `fitTextOnNLines` 是唯一可靠的做法。

```bash
npx remotion add @remotion/layout-utils
```

## 安装

```powershell
Copy-Item "<SKILL_DIR>\kits\kernel" "<project>\src\kits\kernel" -Recurse
```

> ⚠️ **（新）装一个类型包时，内核也要装。** 类型包只放差异，原语在内核里 —— 只装它那一份编译不过。
> 两份一起装的命令见 `SKILL.md` 第七节。

然后注册演示合成（验证载体）。**主题演示按 `THEME_IDS` 批量注册**，一个主题一个合成：

```tsx
import {Composition} from 'remotion';
import {THEME_IDS} from './kits/kernel/theme';
import {KitShowcase} from './kits/kernel/templates/KitShowcase';
import {MasterShowcase} from './kits/kernel/templates/MasterShowcase';
import {ThemeShowcase} from './kits/kernel/templates/ThemeShowcase';

<Composition id="KitShowcase" component={KitShowcase} durationInFrames={1200} fps={30} width={1920} height={1080} />
<Composition id="MasterShowcase" component={MasterShowcase} durationInFrames={480} fps={30} width={1920} height={1080} />
{THEME_IDS.map((themeId) => (
  <Composition
    key={themeId}
    id={`ThemeShowcase-${themeId}`}
    component={ThemeShowcase}
    defaultProps={{themeId}}
    durationInFrames={480}
    fps={30}
    width={1920}
    height={1080}
  />
))}
```

## 用法

```tsx
import {getTheme} from './kits/kernel/theme';

<MasterFrame
  theme={getTheme('paper-seal')}          // ← 换主题只改这一行
  furniture={{
    masthead: {title: '夜读日报', meta: '第 042 期 · 2026-09-19'},
    footer: {
      left: '来源：内部整理',
      right: '内容自述',
      progress: {current: 2, total: 6},   // 整片级动效，随帧推进
    },
  }}
>
  <Sequence from={0} durationInFrames={60} premountFor={30} name="cover">
    <CoverLayout kicker="今日必读" title="…" meta="2026-09-19" />
  </Sequence>
  <Sequence from={60} durationInFrames={60} premountFor={30} name="headline">
    <HeadlineLayout index="01" title="…" summary="…" />
  </Sequence>
</MasterFrame>
```

要点：

- **家具在母版层渲染一次**，不要在场景里重复报头；
- 版式**只管内容区**，不重复家具、不改安全区；
- 版式入场动效从**该序列的本地 0 帧**起算；
- 换主题只换 `<MasterFrame theme={...}>`，版式一行都不用改；
- 原语的色 / 字族也来自主题（`useTheme()`），不用逐处改。

## 六个版式的槽契约

见 `master/types.ts` 的 `LAYOUT_SPECS`（机器可读）。摘要：

| 版式 | 槽 | 溢出策略 |
| --- | --- | --- |
| `cover` | kicker? · title · meta? | fit · **fit-n-lines** · fit |
| `headline` | index? · title · summary? | none · **fit-n-lines** · clamp |
| `list` | title · items[] | fit · fit（逐条 + 按条数收行距） |
| `stat` | value · unit? · label · note? | fit · fit · fit · clamp |
| `quote` | text · attribution? | **fit-n-lines** · fit |
| `closing` | title · meta? | **fit-n-lines** · fit |

**`lines` 槽的编码约定**：`items` 这一类槽的每条是 `'主字段<TAB>说明'`，用 **TAB** 分隔
（文案里出现逗号和竖线是常态，TAB 不会）。解析只有一份实现：`master/slots.ts` 的 `splitEntry`。
**没有分隔符时整条当说明**，此时 `list` 退回**单列整宽** ——
所以「普通清单」与「带主字段的对照清单」共用同一个版式，两条分支在演示合成里**各摆了一遍**。

**必填槽必须完整显示**（所以是 fit-n-lines：缩字号）；**可选槽显示不完没关系**（所以是 clamp：截断）。

## 渲染配置档

纯 DOM，无 WebGL、无外部素材、无字体下载 —— **无特殊渲染要求**。

```bash
npx remotion render <comp-id> out/draft.mp4 --scale=0.5 --crf=28 --jpeg-quality=70
```

抽帧时 `--scale=0.5` 就够做主题对比（色彩 / 字体 / 尺度都能看清），交付前再全分辨率抽查一张。

## 已知限制

| 限制 | 对策 |
| --- | --- |
| 用网络字体时，字体未加载则测量不准 | 先 `waitUntilDone()` 再渲染；或改用系统字体。**字体栈必须点名目标环境里真实存在的字**，否则中文字重会逐段回退，同帧混排宋体 + 黑体 |
| 母版层从主题取缓动（`theme.motion.enter`），在 Studio 里不可逐处编辑 | **有意为之**：动效签名属于主题。⚠️ **原语层（`components/`）的缓动虽然内联，今天也不可编辑** —— 今天全层 `keyframed` **0** 格；内联只是必要条件，成因与读数见 `references/component-contract.md` §3 |
| 护栏算出的字号是「计算值」，Studio 不可编辑 | 同上 —— 护栏的职责是「不溢出」，不是「可微调」 |
| 原语的字号默认值是内联常量（如 `Title` 的 96），不跟随主题字阶 | **有意为之**：Studio 只能编辑内联值。要跟随主题就显式传 `theme.type.title`，或直接用版式 |
| 版式的 `name`、`.map()` 出的行名由索引算 | Studio 可选中，回写不如硬编码名字稳定 |
| 暗角会压暗边角，而报头 / 页脚在边角 | `muted` / `furniture` 偏暗的主题要把暗角收浅（`neon-terminal` 抽帧后就是这么修的） |
| **`MediaCard` 不校验 `from` / `to`** | 它按帧坐标绝对定位，两个矩形由调用方给 —— 组件**在渲染路径里不许测量**，所以它没法知道你给的 `from` 是不是它真实所在的位置。给错了它不会报错，只是落在错的地方 |
| **`MediaCard` 的展开要自己给 `to`** | 「居中 + 70% 宽」这类构图是调用方算的。组件不猜排版 |
| **`MediaStage` / `MediaCard` 没有入场动效** | **有意为之**：它们是承载内容的框，什么时候出现、怎么出现属于调用方（`<Sequence>` / `focus`） |
| **演示视频靠 `import` 一个 mp4** | 在 Remotion 自己的打包器里由 webpack 处理；**展示页的 esbuild 需要一条 `.mp4 → dataurl` loader**（`generate.ps1` 里已加）。⚠️ 但**渲染时不能用 data URI** —— `<OffthreadVideo>` 会把它交给取帧服务，服务取不到 `data:` 协议（实测渲染直接失败） |
| `MediaStage` 的 `src` 与 `kind` 是分开的两个 prop | **有意为之**：不去猜扩展名（`a.png` 与 `a.png.mp4` 都合法）。给了 `src` 就必须给 `kind` |
| **`ScrollArea` 只在渲染期量一次尺寸** | 内容在渲染期不会变，所以量一次就够。**要动态换内容，请换 `key` 让组件重挂载** —— 否则量到的还是旧的 |
| **`ScrollArea` 的 `scale` 为 0 时兜成 1** | 宿主在量出自己的尺寸之前可能给 0（画廊的格子就是）。不兜会得到 `Infinity` |
| **`ScrollArea` 只平移一整个内容块**（素材 / 结构的边界在这儿） | ① **钉表头**：「钉住素材的一部分」做不到 —— 一张截图里**没有「表头」这个对象**；`header` prop 钉的是**独立元素**（结构）。截图要钉，只能在**素材制作那一步**把表头切成另一张图（那张图自己有高度），或从图里裁一条出来（`clip` 是**写死的像素**，缝 = 带高 − `clip`：宽 1000 时实测 **18.3px**、正文顶还会重影 22 图象素）。② **锚行**：结构版的行高是**代码里的数**（`ROW_H`），截图版只能靠**源坐标标注**（图内表头高 / 行高）× 显示 scale —— 实测目测差 1px，第 k 条就偏 ≈k px（k=7 时 **7.5px**）。③ **首行 / 末行居中没有解**：`y` 必须落在 `[0, max]` 内，本夹具里 k=11 贴底后偏 **74.0px** |
| **`MediaStage` 不提供滚动 API，长内容交给 `ScrollArea`** | `MediaStage` 只负责「把内容塞进框里」（`fit` / 标签条 / 框）；要**滚动显示**长内容就换成 `<MediaStage><ScrollArea scroll>…</ScrollArea></MediaStage>` —— 机制在 `ScrollArea` 里：内容放进 `children`、绝对定位、按 `scroll` 平移，超出部分由它自己的 `overflow: hidden` 裁掉（视频里没有「滚动」这个动作，所谓滚动就是**框不动、内容按帧平移**）。⚠️ **「滚多远」由 `ScrollArea` 自己量**（见 `references/component-contract.md` §6：**测量是允许的**，条件是别在补间里测、要除以 `useCurrentScale()`）。早先这里记的「组件不许测量、所以滚多远只能由调用方声明」是**错的推论**，已作废 |
| **`TextTag` 假设文字是短的** | 它 `whiteSpace: nowrap` —— 一枚标签不换行（换行的胶囊看起来是坏的）。太长就**溢出**，不报错。标签是「两三个字到六七个字」，一整句话该用 `Subtitle` |
| **`TextTag` 的四种分量共用一套盒子几何** | 描边的那两种会把盒子撑大 2px，同一排里就错位了。所以实底 / 淡底也写了一条 `1px solid transparent` 占位 —— **这条边框不是装饰，它参与布局**，删掉就会让四种分量高低不一 |
| **`RichTextBox` 的标记是「小语言」，规则只有三条** | 谁先出现谁先切 / 不配对就原样输出 / 不嵌套。所以 `**` 只打一半最坏是多显示两个星号（**不会吞掉后半篇**）。⚠️ 标记本身会被消费掉，要纯文本用导出的 `richTextToPlain`（测量字号前必须先过它，否则会多量出几个星号的宽度） |
| **`BarChart` 的条目不是 `'标签<TAB>数值'` 时照样画** | 标签照显示、条长 0、数值列显示**原文**（实测抽帧里那行 `增量渲染 —` 就是）。**绝不猜、也绝不悄悄丢掉这一行** —— 少画一行是静默的谎，画成 0 至少看得见 |
| **`BarChart` 的标签列宽必须固定** | `labelWidth` 是几何，不是审美：自动宽会让每根条从不同的 x 起跑，那就没法比了。标签太长会**换行**并把那一行撑高（组件不替你截断 —— 截断是静默的丢内容） |
| **`Panel` 没有高度 prop**，但**天生可被拉伸** | 内层是**无条件** `height: 100%`：父级给了确定高度就撑满，父级是 `auto` 就按内容走 —— 所以「框高跟内容走」只在**自然高度的父级**里成立。**并排等高 / 撑满一行**把它放进 `Flow` 就行。<br>⚠️ **由元素声明自然默认**（`display: 'container'` ⇒ 根盒子写 `alignSelf: var(--kit-align, auto)`），**实例**可覆盖；`Panel` 的 `display` 是 `container` |
| **`Panel` 不滚动、也不裁切** | 长内容靠**原位替换**（调用方按帧换 `children`），不是滚动。⚠️ 框高因此是**离散**变化的：契约**禁止动画 `height`**，而缩放整个框会把字也缩放（变形）。<br>⚠️ **调用方必须让框顶部锚定** —— 否则「窗口收紧」会变成「上下一起缩」（垂直居中时），看起来是窗口在跳 |
| **`Panel` 的硬阴影默认关** | 深色主题上黑阴影压在近黑的底上**根本看不见**（与「网格色必须与底色同向」是同一个坑）。要用就显式开；`shadowColor` 默认取描边色（= 主题 `ink`），于是深色主题上它自动变成**浅色偏移**，仍然看得见 |
| **`Panel` 的 `background` 默认不透明** | 这是**功能不是外观**：背景那层网格（或任何底纹）必须被卡挡住，卡内才是干净的。传 `'transparent'` 会让网格穿进卡里 |
| **`Panel` 的 `width` 只有三档**（撑满 / 定宽 / 收紧），**没有对齐** | 「居中还是靠左」是**外面容器**的事 —— 卡不知道自己在画面里站哪儿，知道了就会和母版的位置打架。⚠️ 数字是**外框宽度**（给了宽度就按 `border-box`），所以 `width={600}` 量出来正好是 600。⚠️ `'fit'` 是「跟内容走」：内容里有**不换行的宽元素**（一长串等宽字符、固定列宽的表）时它会撑出画面，组件不截断 |
| **`viewport` 的 `follow` 每帧会多跑 `samples-1` 次 `advance`** | 平滑靠**闭环采样**（在 `t`、`t-dt`… 上取目标位置加权平均），不靠阻尼 —— 代价就是这几次推进。`samples` 越大越稳越贵；`samples: 1` 时主体被完全钉在画面中心（实测 120 帧离中心 `0.00 px`），`samples: 4` 会滞后 `7.47 px`（闭式 `7.48 px`） |
| **多张 `<Viewport>` 同屏未测** | 一张一个 WebGL 上下文。同屏摆很多个之前先想想是否该合成一张图；「上限约十几个」只是经验值，没有实测读数 |
| **`viewport` 的正交取景要求宿主自己实现** | 本层只把 `orthoHeight` 递过去。宿主的相机只有它自己知道是透视还是正交 —— 夹具一开始就漏了这条（只读 `fov`，`orthoHeight` 静默不生效），现在两种都实现 |
| **没有「一屏多框」的版式**（**不加**） | 一屏摆多张框 = `Flow` ＋ `Panel`。**并排**：`ratio` ＋ `sizing="fill"`（`row` · `[2,1]` · 壳高确定 ⇒ 两框 `1173x240` / `587x240`，宽比 **1.998**、同高同顶、间隔 20）；**成列**：按需要的对齐选 `natural`（各按内容，参差）/ `equal`（取组内最大）/ `fill`（撑满本格）—— 判据是「参考图要的那三种对齐，今天各有一个词对应」。框里摆什么由 `Panel.children` 决定（**内容无关**），这正是**不**做成版式的理由：版式槽是字符串，而框里是数字 / 长文 / 徽章 |
| **`Stat` 不自己缩字号** | 变长的数字（3 位到 12 位）**不会自动适配** —— 护栏住在母版层（`guards/fitting.ts` 的消费者全是版式）。要护栏就走 `stat` 版式；在组件层由调用方给 `fontSize`（与 `Title` 一致） |
| **`Stat` 的单位 / 标签 / 说明字号由 `fontSize` 按比例推出**（0.3 / 0.28 / 0.2） | **有意为之**：一个数据点的大小是**一个整体** —— 数字变大，单位和标签该跟着变大，否则「量级」这个信息就散了。代价是推出来的字号是**计算值**，Studio 不可编辑（与 `TextTag` 的内边距、`MediaStage` 的标签字号同一种取舍） |
| **`Stat` 的 `value` 是字符串，组件一个字符都不解析** | 千分位 / 货币 / `≈` / `—` / `1.2 万` 都**原样**印出来。想让组件替你格式化是**做错了层**（那是内容层的活），与 `BarChart`「测不出数就显示原文」同一条裁定 |
| **`MediaStage` 的默认尺寸是「安全区里放得下的最大 16:9」** | 不是「安全区内容区宽度」—— 1760 宽的 16:9 有 990 高，而安全区只有 880，框会上下各越出 55px、压进报头与页脚带。⚠️ 组件层**只知道安全区**；版式层若要放进家具带**之间**的内容区，由版式显式给 `width` / `height` |
| **`Stat` 的数字区不加 `letterSpacing`** | **有意为之**：逐位滚动要求**列宽与字符前进量精确相等**，字距会让两者差 `N × 字距` 像素，列就与幽灵占位错开。母版 `StatLayout` 有 `-2`，这里**没有** —— 别「顺手对齐」过来 |
| **`Stat` 的 `rollFrom` 必须与 `value` 等长** | 不等长时**不滚**（直接显示 `value`）—— 长度不同就无从判断「谁对上谁」，而**猜**比不动更坏。症状是「它不动」，看得见 |
| **`Stat` 的数位滚动是逐位线性，不是数值插值** | `'0'` → `'99'` 的中点是 `'55'`，不是 `'49.5'`。要**数值正确**的计数到，走「调用方每帧算字符串」那条路（组件不参与） |
| **`Stat` 的 `reserveChars` 与 `rollFrom` 的作用都要跨帧才看得见** | 所以它们**不在元素格里**（定格一帧时滚动那条与静态那条一模一样），只在 `KitShowcase` 的场景里 —— 展示页的规则是「动态用于感受、静态用于判断」 |

| **`Flow` 的 `fill` 要求本组能被撑开** | 父级高度是 `auto` 时，百分比高度按 CSS 解析为 `auto`，于是本组只剩交叉轴的拉伸 —— **实测那等于 `equal`**（三条**同高**），**不是 `natural`**（参差）。不报错。判据：给本组一个**确定高度**的父级（元素格与 Scene 15 都这么做）。这条只能由契约写明 —— 组件在渲染期测不出「你没给我高度」。⚠️ **嵌套时 `fill` 会把「被给到的那条轴」传下去**：本组的行也写成 `minmax(0, 1fr)`，于是 `Flow` 套 `Flow` 时内层**真的能等分它那一格**（外壳 300 ⇒ 内层两块 **136.0 / 136.0**）。修之前只写 `height: 100%`，而本组自己的隐式 `auto` 行在「内容比被给到的那条轴高」时按内容算 ⇒ **连带溢出 +43.1px**；⚠️ 这个缺陷是**条件性**的（同一份代码、外壳 **400 时完全正常**）⇒ **只量一档高度量不出它** |
| **`Flow` 的 `sizing` 管的是交叉轴，主轴只在「有东西可分」时才分** | `row` 的宽度是块级元素天然拿到的确定尺寸 → 省略 `ratio` 时按 `1fr` 等分（「三张等宽卡」）。`column` 的高度**不是**天确定的，所以**省略 `ratio` 时根本不写主轴轨道**，行按内容高（`auto`）；`fill` 另给 `grid-auto-rows: minmax(0, 1fr)` 把被给到的高度分给各行（⚠️ **组高不定时**这些 `1fr` 行都按**最高者**解析 —— 成列三框实测由 `138/99/138` 变成 `138/138/138`、组高 `403 → 442` ⇒ `fill` 在成列时**连主轴行高一起拉平**，这是「只管交叉轴」那句的一个**例外**）。（`fr` 在不定高容器里按「max(内容 ÷ flex) × flex」解析 ⇒ 每行都等于最高者、组高 = 条数 × 最高者。）`row` 下也写同一句（交叉轴＝行高）—— 那是「把被给到的那条轴传下去」，见上一条 |
| **`Flow` 的 `ratio` 有静默兜底，但现在会喊** | 多的忽略、缺的按 1、**非正数也按 1**（后一条原先没写在文档里）。三条兜底都会**开发期警告一次**（`console.warn`，改行为＝不改）。演示合成里另摆了一个不匹配的对照（Scene 15 第三格标题直接写「比例缺位 → 按 1」），让规则在画面上可见 |
| **`Flow` 的 `justify`（主轴分布）** | 轨道是 `minmax(0, Nfr)` ＋ `tracks` 里的 `auto` 内容轨，**分布由轨道自己决定**，于是 `justify-content` 没有消费者 —— 按「没有消费者就不要加字段」删掉。**按内容定宽的轨道由 `tracks` 提供**（`'content'` ⇒ `auto`） |
| **`Flow` 的 `tracks`：混合主轴轨道** | `tracks: readonly (number \| 'content')[]`：`'content'` 按内容取主轴尺寸、正数按权重分**剩余**。落到 CSS ＝ 内容项 `auto`、权重项 `minmax(0, Nfr)`（`[1,'content']` ⇒ `minmax(0,1fr) auto`）。**互斥**：与 `ratio` 都说「主轴怎么分」，类型上排除双传（`TS2322`），**代价**是 props 成了联合 ⇒ 「整体转发 props」（`{...ComponentProps<typeof Flow>}`）过不了 `tsc`（只能就地 cast）。**要确定空间**：`column` 下带权重必须 `sizing="fill"` ＋ 上层给确定高度（不定空间里 `fr` 行塌成最高者）——这条**只为 `column` 喊**，`row` 的主轴宽由父级给、与 `sizing` 无关（给它喊是假警报）。⚠️ **内容轨是 `max-content`**：`row` 上不会自己折行；内容比容器宽/高时它**先吃掉全部可用空间**、权重轨被压到 0（组宽高都对、**不报错**，看着像「这一格没画」）⇒ 这种情况现在会**读真实几何**喊一条诊断（`tracks-collapsed`）。读数：容器 300／下卡内容 51 ⇒ 上卡 `225.0`，容器 400 ⇒ 上卡 `325.0`（**＋100，下卡 51.0 不变**）；下卡 1 行 → 3 行 ⇒ `225.0 → 171.0`；`['content',2,1]` ⇒ `51 / 134 / 67`；`row` 的 `[1,'content']` ⇒ 宽 `377 / 479` |
| **`Flow` 的 `align` 与 `sizing` 各管一头** | `align` 写进 CSS 变量、元素读得到，**一定生效**（`equal` / `fill` 下也是）。分工是：`sizing` 管**格子**的交叉轴，`align` 管**格子里面**那件东西怎么放；`align` 省略时元素用自己的自然默认（容器与块级 `auto`「照容器办」/ 行内片段 `center`）。⚠️ 因此 **`'equal'` 承诺的是「等高格子」**，不保证子项看起来等高 —— 要真等高就用容器类子项或显式布局条目 |
| **`Flow` 数到的子项数与 DOM 盒子数可能不一致** | 子项包在 **Fragment** 里时（`<Flow><>{a}{b}{c}</></Flow>`）`React.Children.toArray` 只数到 **1** 个，而 grid 里真有三个盒子 → 一条轨道装三个 → **整组变竖排**，不报错。现在会用**真实 DOM 子项数**比对并警告（拿 `React.Children` 自己跟自己比永远相等，那是永远绿的断言）。修法：把子项摊平成数组或并列的 JSX |

## 验证记录

**验收 = 三件事**：`tsc --noEmit` exit 0 · `compositions` 列出全部合成 · **按版式抽帧并真的看图**
（每个版式一张，清单类补末尾帧）。命令与判据见 `SKILL.md` 第四节。

改了内核任何一层，按 `references/modification-workflow.md` 第 5 节把回归扩到**每个类型包**的演示合成。

## 实施记录

逐轮实施记录**不在本文件里**：各原语的设计理由、缺陷与修法、当时的抽帧读数都留在 **git 历史**
（`git log --follow -- kits/kernel/kit.md`）。本文件只描述**现状**：清单 / 已知限制 / 验收要跑什么。
