# Remotion 组件套件框架

把「**一类视频需求**」沉淀成「**一套可复用组件**」：**一个内核**（主题 / 母版 / 原语 / 护栏）＋**若干类型包**（只放差异），外加一个**展示页**，让每个组件真的渲染出来给人看，而不是读代码描述。

## 能力

| 能力 | 说明 |
| --- | --- |
| 内核原语 19 | `remotion-kits-v2/kits/kernel/components/`：Panel · Flow · Stat · BarChart · ScrollArea · MediaStage · RichTextBox …；`specs.tsx` 是唯一登记表 |
| 通用版式 6 | cover · headline · list · stat · quote · closing；`LAYOUT_SPECS` 与 `ShowcaseScenes` 一一对应 |
| 家具 2 | `FooterRail` · `Masthead`：由母版注入，场景不自己摆 |
| 主题 4 | `default-dark` · `paper-seal` · `bubble-pop` · `neon-terminal`；换主题不动版式 |
| 溢出护栏 4 | `fitting` · `ClampLines` · `diagnostics` · `placement`：溢出要喊出来，不静默裁掉 |
| 最小动效 | `motion.ts`：公共计算 ＋「淡入上移」组合；`from` 是入场时间原点 |
| 皮（外观预设） | `skins/`：具名预设 ＋ 四角角标；优先级 实例 prop > 皮 > 主题；默认皮一个像素都不动 |
| 类型包 hotspot | 3 版式（timeline / stance / multi-stat）· 2 家具（事件时间戳 / 来源与可信度）· 2 主题 · 母版 / 场景 / 主题三份演示 ＋ `compose.ts` 资产声明 |
| 展示页 | 画廊 · 工作台（真实夹具＋主题＋临时试验）· 内容对照 · 全局搜索；**自动发现**资产，不手写清单 |
| 更新器 | [`update-kits.ps1`](remotion-kits-v2/tools/update-kits.ps1)：按 `.kit-origin` 基线把母本改动刷进工程副本，**默认只报告** |
| 契约 8 份 | [`references/`](remotion-kits-v2/references/)：主题 / 母版 / 组件 / 创作 / 改造 / 入库 / 渲染档 / 目录 |
| 维护工具 | [`tools/`](tools/)：镜像与多副本哈希比对 · 套件盘点 · 基线修剪 · 抽帧修剪 · 架构草图 · Studio 护栏打/撤 · 别名探测 · 帧差 |

**组织方式**：内核 **58** 个文件全系统只有一份；类型包 **17** 个文件只放差异，运行时靠自己的 `master/MasterFrame.tsx` 适配器把「内核引擎 ＋ 本套件家具」组合起来，调用方接口不变。

**规模**（2026-10-27 现测）：仓库 **133** 个文件 ＝ [`remotion-kits-v2/`](remotion-kits-v2/) **113**（`kits/` 75 ＝ kernel 58 ＋ hotspot 17 · `references/` 8 · `showcase/` 25 · `tools/` 4）＋ [`tools/`](tools/) 16 ＋ 根 4。

**分发是版本化源码复制，不是共享依赖**：套件被复制进工程，工程可以就地改；要跟随上游更新就跑更新器。它靠 `<工程>/.kit-origin/` 里的**基线**分清「上游改了」与「你为这支片子改过」—— 没有基线，这两件事长得一模一样。

## 安装与启动

前置条件（2026-10-25 实测）：

| 条件 | 事实 |
| --- | --- |
| Node / npm | v24.18.0 / 11.16.0；`npm ping --fetch-retries=0 --fetch-timeout=15000` 现测 **2.4 s PONG** |
| PowerShell | 7.6.8 |
| Chromium 内核 | **只有 Edge**：`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`（156.0.4314.42）。**没有 Chrome**，不探测就 `still` / `render` 全失败 |
| 中文字体 | `msyh.ttc` · `msyhbd.ttc` · `simhei.ttf` · `simsun.ttc` · `consola.ttf` · `arial.ttf` 均在 `C:\Windows\Fonts` |
| 依赖工程 | 一个已装 react / remotion / typescript / esbuild 的 Remotion 工程；展示页与各工程共用同一棵依赖树（junction） |

```powershell
# 1) 内核＋该类型包一起装（类型包自己没有原语，缺了编译不过）
pwsh -File remotion-kits-v2\tools\update-kits.ps1 -Project <工程根> -Install

# 2) 复用已有依赖树（可选）。删 junction 用 cmd /c rmdir，别用 Remove-Item -Recurse
New-Item -ItemType Junction -Path <工程根>\node_modules -Target <已有依赖树>\node_modules

# 3) 类型检查与合成清单 —— 必须在工程根执行
Push-Location <工程根>
& .\node_modules\.bin\tsc.cmd --noEmit
& .\node_modules\.bin\remotion.cmd compositions
Pop-Location
```

工程根的 `remotion.config.ts` 至少要探测浏览器并固定 WebGL 后端，否则 `still` / `render` 起不来：

```ts
import fs from 'node:fs';
import { Config } from '@remotion/cli/config';

const browser = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));
if (browser) Config.setBrowserExecutable(browser);
Config.setChromiumOpenGlRenderer('angle');
```

## 用法

### Remotion CLI

| 命令 | 用途 | 坑 |
| --- | --- | --- |
| `remotion versions` | 核对 `remotion` 与全部 `@remotion/*` 同版 | — |
| `remotion compositions` | 列出合成与帧数 | `--log=error` 会把清单一起吞掉 |
| `remotion still <Id> out\x.png --frame=30` | 抽单帧 | frame 0 所有元素 opacity 全 0，别拿它判空白 |
| `remotion studio` | 预览与调参 | 右侧 Inspector 默认收起（`Ctrl+J`） |
| `remotion render <Id> out\final.mp4` | 出片 | 复杂 props 走 JSON 文件，Windows 命令行传不动 |
| `remotion ffprobe out\final.mp4` | 核交付规格 | — |

⚠️ `remotion` 从**当前工作目录**推断工程根与入口点：在别处调用直接报 `No entry point specified`（`tsc -p` 不受影响）。
本仓库沿用的组合是 `remotion` / `@remotion/*` **4.0.523**、`react` **19.0.0**、`typescript` **5.8.2** —— 新工程先看自己 `package.json` 的实际版本，别把这当永久常量。

### 更新器（把母本改动刷进工程）

```powershell
pwsh -File remotion-kits-v2\tools\update-kits.ps1 -Project <工程根>                  # 只报告，一个字节都不写
pwsh -File remotion-kits-v2\tools\update-kits.ps1 -Project <工程根> -Apply           # 有未解决项时拒绝
pwsh -File remotion-kits-v2\tools\update-kits.ps1 -Project <工程根> -Apply -Partial  # 只写无歧义部分
pwsh -File remotion-kits-v2\tools\update-kits.ps1 -Project <工程根> -Resolve all -Decision keep-local
pwsh -File remotion-kits-v2\tools\update-kits.ps1 -Project <工程根> -Rollback latest
```

| 事实 | 值 |
| --- | --- |
| 基线位置 | `<工程>\.kit-origin\<套件>\`：`.origin.json` ＋ `baselines/gNNNN/` ＋ `plans/<id>/` ＋ `runs/<runId>/run.json` |
| 会自动覆盖的 | **仅**「母本修改」与「首次母本新增」；工程改动 / 工程新增 / 本地删除逐字节不动，只在报告里列出 |
| 绝不自动做 | 删工程文件、三方合并、语义判断、回填母本 |
| 退出码 | `0` 完成 · `1` 有可更新 · `2` 用法错误 · `3` 需要裁决 · `4` 计划过期（**必须先重跑 `-Scan`**）· `5` 验证失败并已回滚 · `6` 需要恢复 |
| `-Rollback` 是什么 | **未完成事务的恢复**，不是撤销已提交的更新；只动文件，不动基线代次与清单 |

### 展示页

```powershell
# 持续监听，成功构建后页面自动刷新（默认 18499，被占就 -Port 18500）
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程> -Watch

# 单次生成离线页（入口 <技能>/showcase/dist/index.html，需连同 builds/ 一起移动）
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程>

# 只做发现与校验（输出 JSON 清单）：成功=0，WARN=2
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程> -DiscoverOnly

# 新鲜度：对应最新来源=0，未构建或过期=3
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程> -CheckFresh

# 真抽静帧（慢，需 @remotion/bundler ＋ @remotion/renderer）
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程> -WithImages -Scale 0.5
```

- `-Project` **只借依赖**（react / remotion / typescript / esbuild），不读该工程的 `Root.tsx`，也不扫描视频项目列表。
- 生成器读的是**脚本自己所在套件的 `kits/`**：装成技能时是技能母本，在仓库里就是 `remotion-kits-v2/kits`。
- 自动发现：解析 `THEME_IDS` / `LAYOUT_SPECS` / `COMPONENT_SPECS` / `FurnitureConfig` / `Root.tsx` 注册 / `compose.ts` 资产声明，再扫文件系统。**手写清单一定漂移，而漂移的展示页会撒谎。**
- 报警两级：`WARN` ＝ 登记 / 类型 / 来源不一致（阻断发布）；`NOTE` ＝ 夹具没演练到（不阻断）。
- 输出在 `dist/builds/<buildId>/`，通过校验才原子替换入口；失败候选不发布，页面继续服务上一成功版本。

### 镜像同步（改过 `kits/**` 或 `references/**` 之后）

```powershell
pwsh -NoProfile -File tools\mirror-check.ps1     # 母本 ↔ 仓库快照：退出码 0（逐文件全等）才可提交
pwsh -NoProfile -File tools\kit-copy-check.ps1   # 母本 / 仓库 / 各工程副本的 SHA256
```

⚠️ 同步是**复制覆盖 ＋ 删掉多出来的文件**，绝不「删除 ＋ 改名」：技能目录被热重载监视，`Remove-Item -Recurse` 会撞文件锁，结果是目录删不掉、文件已删光。
⚠️ 整文件覆盖 `SKILL.md` 前确认头两行是 `---` —— 丢了 frontmatter，技能会立刻从技能目录消失。

### 细节去哪看

| 问题 | 去哪 |
| --- | --- |
| 五层职责、创作 / 改造 / 入库 / 渲染档 | [`SKILL.md`](remotion-kits-v2/SKILL.md) 与 [`references/`](remotion-kits-v2/references/) |
| 主题 / 母版 / 组件契约 | `references/theme-contract.md` · `master-contract.md` · `component-contract.md` |
| 某个套件能干什么、已知限制 | [`kits/kernel/kit.md`](remotion-kits-v2/kits/kernel/kit.md) · [`kits/hotspot/kit.md`](remotion-kits-v2/kits/hotspot/kit.md) |
| 展示页设计与验收断言 | [`showcase/README.md`](remotion-kits-v2/showcase/README.md) · [`showcase/DESIGN.md`](remotion-kits-v2/showcase/DESIGN.md) |
| 从需求到成片的八阶段主线 | [`remotion-workflow.md`](remotion-workflow.md) |

## 自验

```powershell
# 1) 类型与合成清单（在工程根；期望 tsc 退出码 0，合成条数符合预期）
Push-Location <工程根>; & .\node_modules\.bin\tsc.cmd --noEmit; & .\node_modules\.bin\remotion.cmd compositions; Pop-Location
# 若环境不允许派生子进程，类型检查可以绕开 .cmd 包装直跑（实测 exit 0 / 4.9 s）：
# node .\node_modules\typescript\bin\tsc --noEmit

# 2) 套件发现（不构建页面；期望退出码 0、无 WARN）
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程> -DiscoverOnly

# 3) 构建一次，再查新鲜度（期望 0）
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程>
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程> -CheckFresh

# 4) 浏览器验收：先起监听，再另开终端跑（Playwright 不自带，用已有的包路径）
pwsh -File remotion-kits-v2\showcase\generate.ps1 -Project <依赖工程> -Watch
node remotion-kits-v2\showcase\verify.mjs            http://127.0.0.1:18499/ --playwright <Playwright包> --out <证据目录>
node remotion-kits-v2\showcase\verify-structure.mjs  http://127.0.0.1:18499/ --playwright <Playwright包> --out <证据目录>
node remotion-kits-v2\showcase\verify-workbench.mjs  http://127.0.0.1:18499/ --playwright <Playwright包> --out <证据目录>
node remotion-kits-v2\showcase\verify-pipeline.mjs   --project <依赖工程> --work <新目录> --playwright <Playwright包>

# 5) 仓库一致性判据（有母本或工程副本时才跑；全新 clone 可跳过）
pwsh -NoProfile -File tools\mirror-check.ps1
pwsh -NoProfile -File tools\kit-copy-check.ps1
git diff --check
```

末次完整读数（**2026-10-25 重跑**，与 2026-10-08 记录逐项一致）：页面结构 **88 项** · 工作台 **39 项** · 真实交互 **59 项 / 0 运行错误 / 1 条预期诊断** · 同步管线 **34 项**。单次构建 **12.4 s**，发布 1 个 build（63 个唯一资产 · hotspot 3 版式 / 4 场景 · kernel 6 版式 / 8 场景 · **24 条 NOTE、0 WARN**），随后 `-CheckFresh` 返回 `fresh: true`；`tsc --noEmit` exit 0 · `mirror-check` **113/113** · `kit-copy-check` **75/75 × 4 处**。

**测什么算数**：

- `tsc` 全绿不等于对。**抽帧是唯一可靠的验收手段，而且必须真的看图。**
- 新断言必须证明过它会红：把被测那行临时改回错的样子，看它真的失败。永远绿的断言等于没有，而且更坏。
- 帧哈希不能只渲一遍：`remotion render --sequence` 本身不逐帧确定，同一份代码两遍渲染约 **5%** 的帧会变（子像素抗锯齿）。判据是「两侧各自两次都一致」的那些帧；更稳的是同码对照或逐帧哈希集合（相等=同 · 不相交=真不同 · 部分重叠=判不了）。

## 已知限制与未验证项

| 限制 | 事实 |
| --- | --- |
| **Studio 里 0 格动画可编辑** | 2026-10-05 实测 42 个 `Interactive.*`：`static` **148** · `keyframed` **0** · `computed` **230**。元件层成因是 `interpolate` 的 range 里有变量运算；母版层是 `easing` 里展开 `Easing.bezier(...)`。判定**逐格、不连坐** |
| schema 面板 | 本地 4.0.523 **能用**，但面板在右侧栏、默认收起（`Ctrl+J`）；只放开「调用处能就地解析成静态值」的字段：字面量 ✅ · 裸模块常量 ✅ · 常量下标 ❌ · 实例局部变量 ❌ · 帧相关表达式 ❌。写回改的是**调用处的 JSX attribute**，保存有延迟 |
| 浏览器 | 只有 Edge；不探测并 `setBrowserExecutable` 就 still / render 全失败 |
| 子进程 | `remotion` 会派生 esbuild 与 Edge；受限环境（本沙箱）报 **`spawn EPERM`**，必须换到允许子进程的终端跑（`tsc` 不受影响） |
| `frame 0` | 所有元素 opacity 全 0，别用 frame 0 判「是不是空白」 |
| `from` | 已是**入场时间原点**；旧的 `from` ＋ `delayInFrames` 会推两遍（2026-10-06 已修） |
| 嵌套 `fill` | 已修（`row` 分支补 `minmax(0, 1fr)`）；只量一档容器高度量不出它 |
| `tracks` 与 `ratio` | 类型互斥（双传 `TS2322`）⇒ props 成联合，「整体转发 props」要 cast |
| `MediaStage` | 渲染期**不能**用 data URI：`<OffthreadVideo>` 的取帧服务不认 `data:` |
| 行尾 | `.gitattributes` 是 `* -text`。判据是逐文件哈希，改成 `text=auto` 会让判据**静默失效** |

**最容易再踩的坑**：

- **PowerShell**：变量不区分大小写 ⇒ 局部变量与参数同名会静默覆盖（`$out` 覆盖 `-Out`，报错还指在无辜行）；`@($list)` 里 `$list` 是 `List[object]` 必定抛（空的也抛）；`$arr[0]` 在单元素结果上取到字符串首字符；双引号 here-string 里反引号是转义符（提交信息会静默损坏 ⇒ 用单引号）；`Copy-Item "<源>\*" "<目标>" -Recurse` 在目标不存在时把目录摊平且不报错；**`Remove-Item -Recurse` 会顺着 junction 删掉目标目录的内容**；`Get-ChildItem -File` 不递归，数与系统对不上。
- **无头浏览器验收**：`file://` 下不能用 query string，要用 hash（`#frame=45`）；`--screenshot` 是异步写盘，紧接着 `Test-Path` 会误判；无头下 `requestAnimationFrame` 播放会被节流，要加 `--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding`；`autoPlay` 没有用户手势会被拦，验播放必须真的点一次；CDP target 要按 JSON 解析取 `type=page` 那一条，别用跨条目的懒匹配正则。

**未验证 / 未做**：

- 套件更新后的**整片渲染重跑**没做过：目前「改动与画面等价」是结构推断，没有对整片做帧哈希封样。
- 展示页的 GPU 性能基准没跑过；`-WithImages` 静帧抽取本轮未重跑（46 张是 2026-10-08 的）。
- 本文件（2026-10-25）只改文档，但 `tsc`、展示页构建与四个 verify 入口都已重跑，读数见「自验」；母版边界与多类型包夹具两组（11 / 118 项）本轮未重跑。
