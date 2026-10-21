/**
 * 主题的类型契约 —— **一套视频的「长相」**。
 *
 * 主题只有七个维度：色板、字体族、字阶、安全区、间距、动效签名、图形语言。
 * 它**不含任何布局信息**：不给版式、不给位置、不给槽、不给场景顺序。
 * 完整的边界与写法见 `references/theme-contract.md`。
 *
 * 两条硬规则（都是踩过的）：
 *   1. `type` 与 `safe` 的基准是 **1080**，母版按 `Math.min(width, height) / 1080`
 *      缩放 —— 1920×1080 与 1080×1920 都落在 1:1，4K 才翻倍。**不要按画布宽度缩放**：
 *      `width / 1080` 在 1920 宽下是 1.78 倍，字阶与留白会一起被放大。
 *   2. 字体族必须点名**目标环境里真实存在的字**。只写不存在的字体名时，Chromium 会
 *      按字重逐段回退到不同的中文系统字体 —— 同一帧里出现宋体 + 黑体混排，
 *      而且护栏量到的宽度与实际渲染的不是同一种字。
 *
 * 每个字段都必须有消费者。声明了却没人读的字段是**谎话** —— 它会让人以为换个值有用。
 * 字段 → 消费者的对照表在 `references/theme-contract.md` 第 4 节，改动时同步维护。
 */

export type Theme = {
  /** 主题名。**必须与 `theme/index.ts` 里注册的 id 完全一致** */
  readonly name: string;

  readonly color: {
    /** 画面底色 */
    readonly bg: string;
    /** 正文墨色 */
    readonly ink: string;
    /** 次要文字 */
    readonly muted: string;
    /** 强调色：眉题、序号、数字、列表标记、强调条 */
    readonly accent: string;
    /** 分隔线、界格线、进度轨底色 */
    readonly rule: string;
    /** 固定家具的墨色 —— 通常比正文更淡，避免抢内容 */
    readonly furniture: string;
    /** 背景网格线颜色。必须与 `bg` 明暗同向，否则浅色主题上网格直接消失 */
    readonly grid: string;
    /** 暗角颜色。深色主题用黑；浅色主题要用同色系的深色，用纯黑会发脏 */
    readonly vignette: string;
  };

  readonly font: {
    /** 正文与标题的字族。必须点名真实存在的字，见本文件顶部第 2 条 */
    readonly family: string;
    /** 元信息 / 数字的字族（期号、日期、统计数字） */
    readonly mono: string;
  };

  /** 字阶，以 **1080 基准**为单位（母版按 min(w,h)/1080 缩放后才使用） */
  readonly type: {
    readonly hero: number;
    readonly title: number;
    readonly heading: number;
    readonly subhead: number;
    readonly body: number;
    readonly caption: number;
    /** 数据版式的数字主体 */
    readonly stat: number;
  };

  /** 安全区基准，以 **1080 基准**为准 */
  readonly safe: {
    readonly x: number;
    readonly y: number;
  };

  /**
   * 间距与家具尺度。
   *
   * 边界：主题给的是**标量**（多高、多松、多粗），母版决定**放哪里、按什么顺序**。
   * 所以 `mastheadHeight` 属于主题（它是一个高度值），而「报头在左上角」属于母版。
   */
  readonly space: {
    /** 报头区高度 */
    readonly mastheadHeight: number;
    /** 页脚区高度（进度分段 + 规则线 + 左右小字） */
    readonly footerHeight: number;
    readonly gapTight: number;
    readonly gap: number;
    readonly gapLoose: number;
  };

  /**
   * 动效签名 —— 这套主题的「手感」。
   *
   * 只有贝塞尔入场曲线与错开间隔两项：母版层统一从这里取，保证整片的动势一致。
   * 需要回弹 / 弹簧时再加 `spring`，但**必须同时有消费者**（见本文件顶部最后一段）。
   */
  readonly motion: {
    /** 标准入场贝塞尔，与 `Easing.bezier` 的入参一致。y 允许超出 [0,1] 做回弹 */
    readonly enter: readonly [number, number, number, number];
    /** 逐条错开的帧数。版式会按场景时长再收紧 */
    readonly stagger: number;
  };

  /** 图形语言 —— 线条与色块的粗细、圆角，决定这套主题的「手气」 */
  readonly graphic: {
    readonly ruleThickness: number;
    readonly accentBar: number;
    readonly railThickness: number;
    /** 强调条 / 列表标记 / 规则线的圆角。0 = 方角，999 = 胶囊 */
    readonly blockRadius: number;
  };
};
