---
name: remotion-kits
description: "Remotion 组件套件构建：把一类视频需求沉淀成可复用组件（主题 / 母版 / 原语），覆盖造新套件、改已有套件、复用现成套件三条路径，验收靠按版式抽帧。触发词：套件、组件库、可复用组件、做一套组件、改版式、改主题、reusable components、component kit。"
---

# Remotion 组件套件

把「一类视频需求」做成「一套可复用组件」：**产物是套件，片子是顺带产物**。
一个内核（主题 / 母版 / 原语 / 护栏）＋ 每个类型一个只放差异的类型包。

## 先分流

| 你要做的 | 入口 | 主产出 |
| --- | --- | --- |
| 这个类型还没有套件，要造一套 | 第一节 | `kits/<类型>/` ＋ 演示合成 ＋ `kit.md` |
| 改已有套件（组件 / 版式 / 主题） | 第二节 | 改动 ＋ 按波及面重跑 |
| 现成套件能覆盖，要装进工程 | 第三节 | 工程内 `src/kits/` 副本 ＋ 组装好的场景 |
| 只是预览、抽帧、出片 | **不跑本技能** → `remotion-studio` / `remotion-render` | — |
| 还没定要做什么视频 | 先 `remotion-intent` | — |
| 调色、特效、地图、字幕 | 别的领域技能；本技能只给骨架组件 | — |

## 不变量

违反任何一条，产物就不是「可复用套件」：

1. **原语只住内核。** 类型包只放差异（自己的主题 / 版式 / 家具 / 场景）；动手前先看内核里有没有现成的。
2. **安装 ＝ 内核 ＋ 类型包两份一起。** 类型包结构上没有原语，只装它会编译不过。
3. **复制，不是依赖。** 套件版本化复制进工程；工程可就地改，改坏了重新复制一次。
4. **主题只从 `useTheme()` 取色。** 组件与母版不 import 具体主题文件，不写死品牌色。
5. **换主题不换版式。** 主题改动的验收是「版式 0 行 diff」。
6. **家具在母版写一次。** 场景里不再摆报头 / 页脚 / 进度。
7. **新组件必须进演示合成。** 没有场景就不算入库，也没有验证载体。
8. **验收是看图，不是 `tsc` 绿。** 渲染期问题只有抽帧能抓到。

## 定层：新东西放哪

问两件事，**两个维度不是一套互斥分类**：

| 维度 | 取值 |
| --- | --- |
| **这是什么资产** | 主题 · 皮 · 版式 · 母版 · 原语 · 家具 · 夹具 |
| **谁持有并维护它** | 内核（全系统一份）· 类型包（这个类型专属）· 项目（这一部作品） |

判据是**复用需求**，不是类别名：跨类型通用 → 内核；这个类型每期都要 → 类型包；只有这一部这样 → 项目副本。
只有一部作品时，「只有这一部用」的东西默认就住项目。

## 一、造一套新套件

八步，**第 1 步是唯一强制暂停**：没拿到用户确认的信息形态清单，不开始写代码。

| 步 | 完成判据 |
| --- | --- |
| 1 需求拆解 | 这类视频每期讲哪几种东西 → 信息形态清单，**用户确认** |
| 2 定槽 | 每个版式的槽、必填性、溢出策略写进 `LAYOUT_SPECS` |
| 3 定家具 | 每期都在的元素进 `FurnitureConfig` |
| 4 定主题 | 2–3 个方向让用户**用眼睛选**，落成 `theme/<id>.ts` 并登记 |
| 5 创作 | 顺序：主题 → 母版 → 按需补组件 |
| 6 演示合成 | 用**最坏情况内容**给新东西加场景（不可省） |
| 7 验证 | 走第四节 |
| 8 入库 | `kits/<类型>/` ＋ `kit.md` ＋ `labels.ts` ＋ `compose.ts`，登记进 `references/catalog.md` |

文件级落点：

- **主题**：照 `theme/default.ts` 复制 → 登记 `theme/index.ts` → 跑 [`references/theme-contract.md`](references/theme-contract.md) §6 的三步验证。
- **版式**：`master/layouts/` ＋ 槽注册 `master/types.ts` → 场景加进 `templates/ShowcaseScenes.tsx`（母版演示与所有主题演示都会覆盖到它）。先看内核 `master/layouts/` 里已有什么。
- **家具**：`master/furniture/` ＋ `FurnitureConfig`（用 `&` 扩展内核那份）。
- **组件**：见 `references/authoring.md`。复用 ≥2 次、或这一支独有且复杂到值得隔离，才做成组件。
- **中文名**：`labels.ts` 五层各一条，只服务展示页，不进运行时契约。缺一条不会报错（那一格退回英文），只有重跑生成器才查得到。
- **`compose.ts`**：一行资产声明（如 `sources: ['../kernel']`），生成器照它补入类型包缺的两层。

新类型专属的东西**直接建在 `kits/<类型>/`**。只有跨类型通用才进内核；先堆进内核等以后再拆，会换来两次搬迁。

## 二、改已有套件

新增是从零验一个；**修改验的是波及面**。

**1. 先定在哪儿改。** 只影响这一支片子 → 在**工程副本**里改；下次同类视频还会想要 → 回**技能里的套件**改，再用更新器送进工程（第三节末）。

**2. 再定根因层 —— 症状 ≠ 根因层。** 症状总出现在消费方，根因常在被消费的那个约定。动手前问一句：**这个值是写死的，还是本该从别处取的？**

常见误判：换主题后颜色不变 → 不是主题，是组件没走 `useTheme()`；页脚压住内容 → 不是版式往下挪，是母版的让位方式；各处字号不齐 → 不是逐处调，是缩放基准。

**3. 按波及面重跑，漏一个消费者就漏一次回归。**

| 改了 | 必须重跑 |
| --- | --- |
| `theme/**` | 每主题 × 每版式抽帧 ＋「版式 0 行 diff」 |
| `guards/**` | 全部版式 × 全部主题 |
| `components/**` | 该套件的 `KitShowcase` ＋ 用到它的版式 |
| `kits/kernel/**` | **每个类型包**的演示合成 ＋ 展示页重建（代价最大；能在类型包里改就别动内核） |

完整方法、症状 → 根因对照、回归范围见 `references/modification-workflow.md`。

## 三、复用 → 安装 → 组装

**先查可用性**：`references/catalog.md` 只列已沉淀、抽过帧的套件。有 `BRIEF.md` 时直接用它的 `genre` 与受众，不要重问。

**安装**（内核 ＋ 该类型包，两份）：

```powershell
pwsh -File "<技能目录>\tools\update-kits.ps1" -Project "<工程根>" -Install
```

它等同复制两份 `kits/`，但**顺手记下基线** —— 母本以后改了，更新器靠基线分清「上游改了（可安全重刷）」与「你为这一支片子改过（绝不碰）」。手工 `Copy-Item` 装出来的副本没有基线，只能事后用 `-Adopt` 补，而它只在副本与母本逐字节全等时才允许。

**装上后**：在 `theme/index.ts` 选 `ThemeId`（或照 `theme/default.ts` 复制改一份）；把套件自带的演示合成注册进工程 `Root.tsx`；跑一遍第四节，确认装进来的东西能编译、能出帧。

**组装 ＝ 在母版里摆版式**（不是裸组件）：

```tsx
<MasterFrame theme={getTheme('<ThemeId>')} furniture={{masthead: {...}, footer: {...}}}>
  <Sequence from={0} durationInFrames={90} premountFor={30} name="Scene 1">
    <CoverLayout kicker="…" title="…" meta="…" />
  </Sequence>
</MasterFrame>
```

- 每个 `<Sequence>` 都给 `premountFor`；`name` 是 Studio 时间线上的标签，写死。
- 逐实例的**尺寸**内联在调用处（静态值才可编辑）。时间也内联，但它今天仍会被算成不可编辑的一格 —— 判据见 [`references/component-contract.md`](references/component-contract.md) §3。

**更新已装的副本**：

```powershell
pwsh -File <技能>\tools\update-kits.ps1 -Project <工程根>                  # 只报告，默认一个字节都不写
pwsh -File <技能>\tools\update-kits.ps1 -Project <工程根> -Apply           # 有未解决项时拒绝
pwsh -File <技能>\tools\update-kits.ps1 -Project <工程根> -Apply -Partial
pwsh -File <技能>\tools\update-kits.ps1 -Project <工程根> -Resolve all -Decision keep-local
pwsh -File <技能>\tools\update-kits.ps1 -Project <工程根> -Rollback latest
```

默认只覆盖「仅母本修改」与「首次母本新增」；工程侧改动、冲突、母本删除都只报告。它不合并、不做语义判断、不删工程文件、不回填母本。
退出码：`0` 完成 · `1` 有可更新 · `2` 用法错误 · `3` 需要裁决 · `4` 计划过期（先重跑一次扫描）· `5` 验证失败并已回滚 · `6` 需要恢复。

**改完技能里的套件之后**：`-Scan` 看一眼 → 有未解决项就 `-Resolve` → `-Apply`。

## 四、验收（改完必跑）

```powershell
Push-Location <工程根>
& .\node_modules\.bin\tsc.cmd --noEmit
& .\node_modules\.bin\remotion.cmd compositions
& .\node_modules\.bin\remotion.cmd still KitShowcase   out\k.png --frame=30
& .\node_modules\.bin\remotion.cmd still MasterShowcase out\m.png --frame=30
Pop-Location
```

- **按版式抽帧**（每个版式一张），不是按场景抽；清单类版式补一张末尾帧；**改了主题就每主题 × 每版式各一张**。
- 抽完**真的打开图看**：溢出、对比度、字距、家具压住内容、动画没动 —— `tsc` 与 ESLint 一条都抓不到。
- 展示页：`showcase/generate.ps1 -Project <依赖工程>` 后 **WARN 必须为 0**（NOTE 是覆盖提示，不阻断）；收尾跑 `-CheckFresh` 返回 0 才算输出与来源一致。构建失败会保留上一个成功版本。
- WebGL 类组件（效果 / 3D / 地图）渲染时加 `--gl=angle`，并建议 `--concurrency=1`；并发按 `npx remotion benchmark` 实测，不猜。
- 改了组件就把结果记回该套件的 `kit.md`。

## 五、指针（按分支读，不要通读）

| 什么时候读 | 文件 |
| --- | --- |
| 造套件的完整方法与反例 | `references/creation-workflow.md` |
| 改已有件的完整方法与回归范围 | `references/modification-workflow.md` |
| 主题的七个身份维度、0 行改动硬指标 | `references/theme-contract.md` |
| 母版的家具 / 版式 / 槽、定位缩放陷阱 | `references/master-contract.md` |
| 组件的确定性、插值、内联纪律 | `references/component-contract.md` |
| 新组件入库的子流程 | `references/authoring.md` |
| 渲染档位与昂贵组件的 flag | `references/render-profiles.md` |
| 有哪些套件、常见类型怎么配版式 | `references/catalog.md` |
| 展示页怎么用、构建失败怎么查 | `showcase/README.md` |
| 某个套件能干什么、已知限制 | `kits/<套件>/kit.md` |

## 六、目录骨架

```text
<技能>/
├── SKILL.md
├── references/      ← 契约与流程（见第五节）
├── showcase/        ← 套件展示页：生成器、画廊、验收脚本
├── tools/           ← 更新器与它的验收套件
└── kits/
    ├── kernel/      ← 内核：全系统一份。主题 / 母版 / 原语 / 护栏 / 演示
    └── <类型>/      ← 类型包：只放差异 ＋ compose.ts ＋ 自己的 MasterFrame 适配器
```

**原语只有内核那一份。** 想看某套件能做出什么，打开展示页：类型包那一页会连同它补入的层一起摆出来，并标明来源。

本技能不做：不发明 Remotion 没有的能力；不把未验证的组件说成可用；不替用户决定品牌观感。
