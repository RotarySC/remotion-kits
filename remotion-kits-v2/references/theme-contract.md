# 主题契约

**主题（theme）= 一套视频的「长相」**：色板、字体族、字阶、安全区、间距、动效签名、图形语言。

**主题 / 母版 / 组件三层**；三层不必由同一个套件提供（内核与类型包的分工见 `SKILL.md` 的「不变量」与「定层」）。
主题是其中唯一「可以整包替换」的一层 —— 换主题不换版式，换版式不换主题。

契约分**三层**，本文件管主题层：

| 层 | 文件 |
| --- | --- |
| **主题层（长相）** | **本文件**、`kits/kernel/theme/`（内核的 4 个）＋ 各类型包自己的 `theme/` |
| 母版层（版面） | `master-contract.md`、`master/` |
| 组件层（原语规则） | `component-contract.md`、`components/` |

> **「数据层（内容入槽）」尚未定义** —— 本技能只管到「组件能装下内容」。详见 `master-contract.md` 开头。

---

## 1. 主题的七个身份维度

| 维度 | 控制什么 | 典型差异手法（不是「换个蓝」） |
| --- | --- | --- |
| `color` | 底、墨、次要文字、强调色、分隔线、家具墨色、**网格线**、**暗角** | 深底浅字 ↔ 浅底墨字；强调色是冷蓝还是朱砂 |
| `font` | 正文字族 `family` + 元信息字族 `mono` | 黑体 ↔ 楷体 ↔ 等宽；中文用不用书法体 |
| `type` | 七级字阶（hero / title / heading / subhead / body / caption / stat） | 字阶是「扁而稳」还是「大而跳」 |
| `safe` | 安全区标量（`x` / `y`，1080 基准） | 宽边距的书画感 ↔ 满画面的卡通感 |
| `space` | 家具高度（报头 / 页脚）+ 三档间距 | 报头高一点、正文更松 |
| `motion` | 入场贝塞尔 + 逐条错开帧数 | 无回弹强减速 ↔ 带过冲的回弹；错开 3 帧 ↔ 10 帧 |
| `graphic` | 线宽、强调条粗细、进度轨粗细、圆角 | 1px 细直角 ↔ 20px 粗胶囊 |

**差异必须落在多个维度上。** 只改 `color.accent` 不叫新主题，那叫同一个主题的变体 ——
内核里现存四个主题（`default-dark` / `paper-seal` / `bubble-pop` / `neon-terminal`）
在每个维度上都不一样，把它们放一起没人会认为是「同一套换了个色」。

参考：`theme/default.ts`（深色现代）、`paper-seal.ts`（宣纸楷书）、
`bubble-pop.ts`（卡通胶囊）、`neon-terminal.ts`（等宽终端）。

---

## 2. 主题绝不包含什么

主题**只给标量**，不给结构。判断法两条，任一条命中就说明放错了层：

1. **这个值会不会出现在两个以上版式里、且应该长得一样？** 不会 → 可能属于母版。
2. **换掉这个值，版式的结构要不要变**（换行、换位、换顺序、加元素）？要 → 属于母版或护栏。

| 属于主题 | 属于母版 |
| --- | --- |
| 色板、字族、字阶、安全区标量、间距标量、家具高度、动效签名、图形粗细与圆角 | 家具的位置与顺序、版式清单、槽契约、场景时长、内容区盒模型、每个版式的排版结构 |

`space.mastheadHeight` 属于主题 —— 它是一个**高度值**，不是一个位置；
「报头在左上角、页脚在底部」才是母版。

**展示用的字段也不属于主题。** 主题的中文名（展示页上那个 `signal-dark · 信号暗色`）
住在套件根的 `labels.ts`，不在 `Theme` 里 —— 展示页读的是那张表，出片路径一行都不碰它。
`Theme` 的每个字段都必须有消费者（第 5 节），而中文名只有展示页消费，
所以它进 `Theme` 就违反了本节与第 5 节两条。同理见 `component-contract.md` §5。

---

## 3. 命名、文件与覆盖规则

- 文件：`kits/<套件>/theme/<kebab-id>.ts`（内核用的是 `kits/kernel/theme/`）；导出：`export const <camelId>: Theme = {...}`；
- **`theme.name` 必须与该文件注册的 id 完全一致** —— 抽帧、合成 id、注册表都靠它对上；
- **必须登记**进 `theme/index.ts` 的三处：`ThemeId` 联合类型、`THEMES`、`THEME_IDS`；
- 派生主题允许写成 `{...baseTheme, name: 'new-id', color: {...baseTheme.color, accent: '#…'}}`，
  但结果必须**完全解析**（不留 `undefined`），且 `name` 必须换。差异到需要改五个维度时就别派生，独立写一份；
- 项目里换主题只有两种正当做法：
  1. 直接改主题文件（一个套件一个主题时的常态）；
  2. `<MasterFrame theme={getTheme('paper-seal')}>`（同一套版式跑多个主题）；
  3. **绝不改版式**、**绝不在版式里写 `if (themeName === …)`**；
- 一个主题一个合成时用 `THEME_IDS.map(...)` 批量注册 —— 范例见 `templates/ThemeShowcase.tsx`。

**谁能 import 具体主题文件**：只有主题注册表（`theme/index.ts`）与合成入口
（`templates/*Showcase.tsx` 这类演示 / 入口文件）。**版式、家具、护栏、组件一律不许** ——
它们只能 `import {useTheme} from '…/theme'`（各套件 `theme/index.ts` 都 re-export 内核那一份
`context` —— 全系统只有**一个** `ThemeProvider`，复制第二个就会读到两份主题）。
这是「换主题不换版式」在代码层的判据。

---

## 4. 主题怎么读到：只走 context，不走模块常量

```tsx
import {useTheme} from '../theme/context';

const theme = useTheme();
```

- 主题由 `MasterFrame` 用 `<ThemeProvider>` 下发；组件层、母版层、护栏都从 `useTheme()` 读；
- **未套母版时** `useTheme()` 返回**内核注册表里的第一个主题**（`default-dark`）——
  所以原语可以脱离母版单独使用。⚠️ 类型包要表达「本套件的默认长相」，是在**它自己的母版适配器**里
  给 `theme` 一个默认值（如 `kits/hotspot/master/MasterFrame.tsx` 的 `theme = THEMES[THEME_IDS[0]]`），
  **不是**再复制一份 `context.tsx`（拆分前每个套件各有一份，两份只差一行 —— 那就是分叉）；
- **不要**在模块顶层 `import {theme} from '…/theme/default'` 然后到处引用。
  那样组件只会长成那一个主题的样子，同一套组件放进别的主题就失效
  （内核里曾经有个 `tokens.ts` 就是这么干的，已删除）。

## 5. 每个字段都必须有消费者

**声明了却没人读的字段是谎话** —— 它让人以为换个值有用。加字段时顺手加消费者，
删消费者时顺手删字段。

`motion.damping` 就是这么被删掉的：它从第一版起就没有任何版式读它。

| 字段 | 消费者 |
| --- | --- |
| `color.bg` | `MasterFrame` → `Stage`；演示合成的外层 `AbsoluteFill` |
| `color.ink` | 6 个版式的标题 / 正文；`Masthead`；原语 `Title` / `TextReveal` / `BulletList` / `Quote` / `SectionHeading` |
| `color.muted` | cover meta、stat unit、quote attribution、closing meta；`ClampLines`、`Subtitle` |
| `color.accent` | cover kicker、headline index、stat value、强调条、列表标记；`FooterRail` 进度段；原语 `Emphasis` / `ProgressBar` / `BulletList` |
| `color.rule` | stat 分隔线；`FooterRail` 规则线与未达进度段；原语 `ProgressBar` 轨道 / `SectionHeading` 分隔线 |
| `color.furniture` | `Masthead` 的 meta、`FooterRail` 的左右小字 |
| `color.grid` | `MasterFrame` → `Stage` 的网格线 |
| `color.vignette` | `MasterFrame` → `Stage` 的暗角外圈 |
| `font.family` | 版式正文与标题、`Masthead`、`FooterRail`、`ClampLines`、`guards/fitting` 的测量、全部原语 |
| `font.mono` | 各版式的元信息 + `Masthead` meta + `FooterRail` 小字 |
| `type.*` | 见 `master/types.ts` 的槽契约；家具字号取 `subhead` / `caption` |
| `safe.x` / `safe.y` | `MasterFrame` 的 `insetX` / `insetY`；`SafeArea` 的默认内边距 |
| `space.mastheadHeight` / `space.footerHeight` | `MasterFrame` 算 `padTop` / `padBottom`（内容区被真正挤开） |
| `space.gapTight` / `gap` / `gapLoose` | quote·stat·headline 的紧间距 / list·closing 的标准间距 / cover 的松间距 |
| `motion.enter` | 6 个版式 + 2 件家具的 `Easing.bezier(...)` |
| `motion.stagger` | `ListLayout` 的条目错开（还会按场景时长自动收紧） |
| `graphic.ruleThickness` | `StatLayout` 分隔线、`FooterRail` 规则线、`MasterFrame` 的 `railReserve` |
| `graphic.accentBar` | `HeadlineLayout` / `ClosingLayout` 强调条、`ListLayout` 标记宽 |
| `graphic.railThickness` | `FooterRail` 进度段高、`MasterFrame` 的 `railReserve` |
| `graphic.blockRadius` | 强调条 / 列表标记 / 分隔线 / 进度段 / 页脚规则线的圆角 |

---

## 6. 验证（主题级）

主题改动**必须**按下面三步验证，缺一步都不算完成。

### 6.1 静态：层是否封住了

四个封层目录（版式 / 家具 / 护栏 / 组件）里不许出现**色值、具体主题名、主题注册表**：

```bash
grep -rnE "#[0-9A-Fa-f]{3,8}|getTheme|theme/default|default-dark|paper-seal|bubble-pop|neon-terminal" \
  kits/kernel/master/layouts kits/kernel/master/furniture kits/kernel/guards kits/kernel/components
```

**空输出才算过**（连注释里都不许提主题名 —— 一旦提了，这段代码就开始为某个主题做假设）。
注意这三处**不在**封层内，它们本来就要碰主题：
`master/MasterFrame.tsx`（默认主题）、`master/MasterContext.tsx`（只管几何）、
`theme/*`、`templates/*Showcase.tsx`（合成入口）。

唯一允许写死的颜色是 `Stage` 里暗角渐变的透明端 `rgba(0,0,0,0)` —— 它是渐变的中性元素，
真正的颜色来自 `theme.color.vignette`。

### 6.2 抽帧：每个主题 × 每个版式一张

```bash
npx tsc --noEmit
npx remotion compositions
npx remotion still ThemeShowcase-paper-seal  out/ps-30.png  --frame=30   # cover
npx remotion still ThemeShowcase-paper-seal  out/ps-90.png  --frame=90   # headline
npx remotion still ThemeShowcase-paper-seal  out/ps-150.png --frame=150  # list
npx remotion still ThemeShowcase-paper-seal  out/ps-210.png --frame=210  # stat
npx remotion still ThemeShowcase-paper-seal  out/ps-270.png --frame=270  # quote
npx remotion still ThemeShowcase-paper-seal  out/ps-330.png --frame=330  # closing
```

`--scale=0.5` 够看色彩 / 字体 / 尺度；交付前挑一张全分辨率复核文字渲染。

**必须逐张看图。** `tsc` 与 `compositions` 都抓不到字体回退、对比度不足、
网格看不见、暗角发脏、字号溢出这类问题 —— 只有看图能抓到。

### 6.3 硬指标：换主题时版式 0 行改动

对**除 `theme/` 与 `templates/` 之外**的全部文件做 SHA256 比对（即 `master/**` + `guards/**` + `components/**`）。
两个方向都要测：

**（a）加一个主题**（`neon-terminal` 就是这么进来的）：先固定哈希基线 → 加主题 + 登记 → 再取一次哈希。

**（b）改一个主题**（更严格，改的是已有主题的字段）：

```powershell
$k = "<SKILL_DIR>\kits\kernel"
function Get-Sealed {
  Get-ChildItem $k -Recurse -File | Where-Object {
    $_.Extension -in '.ts','.tsx' -and $_.FullName -notmatch '\\theme\\' -and $_.FullName -notmatch '\\templates\\'
  } | Sort-Object FullName | ForEach-Object {
    "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.Substring(0,16), $_.FullName.Substring($k.Length+1)
  }
}
$s1 = Get-Sealed
# …改 paper-seal 的 accent / stagger / blockRadius 三处…
Compare-Object $s1 (Get-Sealed)      # 期望：无输出
```

**判据**：加一个主题前后，`master/**` + `guards/**` + `components/**` 逐条一致（版式 0 行改动）；改已有主题再还原，同样逐条一致。

> 如果加一个主题动了版式，说明主题层没抽干净：**回去改版式 / 母版去消费主题字段**，
> 而不是在版式里加特例。

---

## 7. 反例清单

- ❌ 主题里写版式名、场景顺序、绝对坐标（`mastheadX: 80`）—— 那是母版
- ❌ 版式 / 家具 / 组件里写死色值（`#5B8CFF`）或字体名
- ❌ 版式 / 家具 / 组件 import 具体主题文件
- ❌ 模块顶层 import 主题单例并到处引用（组件就再也不跟着主题走）
- ❌ 主题里声明没人读的字段
- ❌ 字体栈里全是装不上的字（同帧混排宋体 + 黑体；护栏量到的宽度也不是渲染字体的宽度）
- ❌ 主题按 `width / 1080` 缩放（应 `Math.min(width, height) / 1080`）
- ❌ 浅色主题沿用写死的白色网格、纯黑暗角（看不见 / 发脏）
- ❌ 用「改版式」实现换主题
- ❌ 只抽一个主题的帧就宣布「主题层没问题」
