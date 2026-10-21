/**
 * 展品的**中文名** —— 只服务展示页（`showcase/`），**不是运行时契约**。
 *
 * ## 为什么单开一个文件，而不是给 `ComponentSpec` / `LayoutSpec` / `Theme` 各加一个字段
 *
 * 1. **中文名是展示，不是运行。** `Theme` 与 `LAYOUT_SPECS` 在出片路径上被真正消费，
 *    往里塞只给展示页看的字段，等于让「运行契约」带上展示的尾巴。
 * 2. **五层里有三层根本没有声明文件**：家具只有 `FurnitureConfig` 的字段 + 文件，
 *    主题只有 `Theme` 对象，场景只有 `KitShowcase` 里 `<Sequence name>` 的字符串。
 *    逐层加字段会变成**三套不同的机制**；一张表 = 一套机制，管五层。
 * 3. 于是**覆盖率可以被校验**（见下），这是它值得存在的前提。
 *
 * ## 为什么必须有覆盖率校验（`generate.ps1` 做）
 *
 * 缺中文名这件事**自己是不会响的** —— 页面照常渲染，只是那一格退回只有代码名，
 * 看起来像「本来就这样」。所以生成器会拿**发现到的**展品清单去比这张表：
 * 少一个 → `WARN`（这一格没有中文名）；多一个 → `WARN`（键打错了，或展品已经删了）。
 * 没有校验的声明一定会漂移，而漂移的展示页比没有更坏：它说谎。
 *
 * ## 格式约定
 *
 * 五层各一个子表，键是**展品的代码名**（元素 = 组件名、版式 = kebab 名、
 * 家具 = 文件基名、主题 = 主题 id、场景 = `<Sequence name>` 原文），值是**短中文名**。
 * 短名不是说明 —— 每个元素还有 `specs.tsx` 的 `purpose`、每个版式还有 `LAYOUT_SPECS.purpose`
 * 负责那一句话。这里只回答「**它叫什么**」。
 *
 * ⚠️ 值里不要出现单引号（生成器按 `'键': '值'` 逐行解析）。
 */

export const LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  /** 契约原语 —— 键 = `components/specs.tsx` 里 `COMPONENT_SPECS` 的 `name` */
  elements: {
    'Title': '主标题',
    'Subtitle': '副标题',
    'SectionHeading': '小节标题',
    'Quote': '引述',
    'BulletList': '条目清单',
    'TextReveal': '逐行揭示',
    'ProgressBar': '进度条',
    'Emphasis': '行内强调',
    'SafeArea': '安全区',
    'Stage': '背景舞台',
    'MediaStage': '媒体框',
    'MediaCard': '迷你媒体框',
    'ScrollArea': '滚动区',
    'TextTag': '文字标签',
    'RichTextBox': '富文本框',
    'BarChart': '水平条形图',
    'Panel': '内容卡',
    'Flow': '排列',
    'Stat': '大数字',
  },

  /** 版式 —— 键 = `master/types.ts` 的 `LayoutName` */
  layouts: {
    'cover': '封面',
    'headline': '头条',
    'list': '清单',
    'stat': '数据',
    'quote': '引述',
    'closing': '收束',
  },

  /** 固定家具 —— 键 = `master/furniture/` 下的文件基名 */
  furniture: {
    'Masthead': '报头',
    'FooterRail': '页脚栏',
  },

  /** 主题 —— 键 = `theme/index.ts` 的 `THEME_IDS`。名字取方向，不逐字直译 */
  themes: {
    'default-dark': '默认暗色',
    'paper-seal': '宣纸朱砂',
    'neon-terminal': '霓虹终端',
    'bubble-pop': '泡泡卡通',
  },

  /** 组件层场景 —— 键 = `templates/KitShowcase.tsx` 里 `<Sequence name="…">` 的**原文** */
  scenes: {
    'Scene 1 — heading': '标题',
    'Scene 2 — reveal': '逐行揭示',
    'Scene 3 — emphasis': '行内强调',
    'Scene 4 — quote': '引述',
    'Scene 5 — media stage, still': '媒体框 · 静态',
    'Scene 6 — media stage, video': '媒体框 · 视频',
    'Scene 7 — media cards': '迷你框群',
    'Scene 8 — scroll area': '滚动区 · 长文档',
    'Scene 9 — text tags': '标签 · 一行四枚',
    'Scene 10 — rich text box': '富文本框 · 三种标记',
    'Scene 11 — bar chart': '条形图 · 渲染耗时',
    'Scene 12 — panel': '内容卡 · 头身尾',
    'Scene 13 — stat, count-up': '大数字 · 计数到 + 跳动',
    'Scene 14 — digit roll': '大数字 · 数位滚动',
    'Scene 15 — flow, ratio & mismatch': '排列 · 比例与不匹配对照',
    'Scene 16 — skin, presets': '皮 · 预设对照',
    'Scene 17 — skin, long & short': '皮 · 长短内容',
    'Scene 18 — skin, local override': '皮 · 局部覆盖',
  },
};
