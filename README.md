# Remotion 组件套件框架

把「**一类视频需求**」沉淀成「**一套可复用组件**」的框架：**一个内核**（主题 / 母版 / 原语 / 护栏）
＋**若干类型包**（只放差异），外加一个**展示页**，让每个组件**真的渲染出来**给人看，而不是读代码描述。

> **这个仓库只是框架本身。** 设计文档、裁定记录、细节档案、抽帧物证与具体片子工程都留在作者的工作区里
> （见 `.gitignore` 第一组）。所以本文件、[`AGENTS.md`](AGENTS.md) 与 [`remotion-workflow.md`](remotion-workflow.md)
> 里指向 `docs/…`、`remotion-kit-lab/`、`hotspot-zcode/` 的路径在 clone 出来的仓库里**不解析** ——
> 它们是**工作区坐标**，不是仓库内的链接。

## 目录

| 路径 | 是什么 |
| --- | --- |
| `remotion-kits-v2/` | **套件**：`kits/`（内核 58 文件 ＋ 类型包 `hotspot` 17）· `references/`（8 份契约）· `showcase/`（展示页生成器 ＋ 画廊）· `tools/`（更新器 ＋ 它的验收套件）· `SKILL.md` |
| `tools/` | 工作区维护工具：镜像比对 · 更新器基线修剪 · 抽帧修剪 · 套件清单 · 架构草图 · `AGENTS.md` 搬家与校验 · Studio 护栏打/撤 |
| [`AGENTS.md`](AGENTS.md) | 这台机器与这套工具链的**环境事实**（每条带复测命令）＋ 已知教训与坑 |
| [`remotion-workflow.md`](remotion-workflow.md) | 从需求到成片的一条主线（八阶段），以及每一步的完成判据 |

## 它怎么组织

**内核 `remotion-kits-v2/kits/kernel/`**：19 个契约原语 ＋ 6 个通用版式 ＋ 2 件家具 ＋ 4 个主题
＋ 溢出护栏 ＋ 最小动效机制 ＋ 皮的具名预设。**全系统只有这一份。**

**类型包 `remotion-kits-v2/kits/<类型>/`**：**只放差异** —— 这个类型自己的版式 / 家具 / 主题，
外加一份 `compose.ts` **资产声明**（本套件缺的那几层去哪儿取）。它**不持有原语**（原语结构上就是内核的），
运行时靠自己的 `master/MasterFrame.tsx` **适配器**把「内核引擎 ＋ 本套件家具」组合起来，调用方接口不变。

**分发是版本化源码复制**，不是共享依赖：套件被复制进工程，工程可以就地改；要跟随上游更新就跑
[`remotion-kits-v2/tools/update-kits.ps1`](remotion-kits-v2/tools/update-kits.ps1)。它靠
`<工程>/.kit-origin/` 里的**基线**分清「上游改了」与「你为这支片子改过」—— 没有基线，这两件事长得一模一样。

## 装进一个工程

```powershell
# 内核 ＋ 该类型包一起装（类型包自己没有原语，缺了会编译不过）
pwsh -File remotion-kits-v2\tools\update-kits.ps1 -Project <工程根> -Install
```

手工复制也行（`remotion-kits-v2\kits\kernel` ＋ `remotion-kits-v2\kits\<类型>` → `<工程>\src\kits\`），
但那样**没有基线**，之后只能用 `-Adopt` 补，而它**只在副本与母本逐字节全等时才允许**。
更新器默认**只报告不写**：`-Scan` 看一眼 → 有未解决项就 `-Resolve` → `-Apply`。

## 看套件长什么样

```powershell
# 生成展示页（输出到 remotion-kits-v2\showcase\dist\，双击 index.html 即开）
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <工程根>    # -Suite <套件> -DiscoverOnly -WithImages

# 验收：三个入口都要绿
node remotion-kits-v2\showcase\verify.mjs "file:///<绝对路径>/remotion-kits-v2/showcase/dist/index.html#tab=kernel"
```

生成器**自动发现**资产（解析各层的正式声明，不靠手写清单 —— 手写清单一定漂移，而漂移的展示页会说谎）。
产物是一张画廊墙：静态可扫、悬停播动效。⚠️ `-Project` **必须是绝对路径**。

## 权威在哪（本仓库不复制规定）

| 问题 | 去哪 |
| --- | --- |
| 五层职责与流程 | [`remotion-kits-v2/SKILL.md`](remotion-kits-v2/SKILL.md) |
| 主题 / 母版 / 组件契约 | `remotion-kits-v2/references/theme-contract.md` · `master-contract.md` · `component-contract.md` |
| 创作流程 · 改造流程 · 新组件入库 · 渲染档 · 套件目录 | `remotion-kits-v2/references/` 下的 `creation-workflow.md` · `modification-workflow.md` · `authoring.md` · `render-profiles.md` · `catalog.md` |
| 展示页的设计理由与验收断言清单 | `remotion-kits-v2/showcase/README.md` |
| 某个套件能干什么 / 已知限制 / 验证记录 | `remotion-kits-v2/kits/<套件>/kit.md` |
| 这台机器的环境事实、坑与教训 | [`AGENTS.md`](AGENTS.md) |

**沿用注意**：仓库里的套件版本锁定 `remotion` / `@remotion/*` **4.0.523**、`react` **19.0.0**、
`typescript` **5.8.2**；新工程请先看自己 `package.json` 的实际版本，别把这个当永久常量。
