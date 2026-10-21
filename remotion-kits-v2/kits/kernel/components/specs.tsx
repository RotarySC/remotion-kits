import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {MOCK_BARS, MOCK_PANEL_SHORT, MOCK_PANEL_TALL, MOCK_RICH, MOCK_STAT, MOCK_STAT_BARE, MOCK_STAT_CENTERED, MOCK_STAT_ROLL_FROM, MOCK_TAGS} from '../templates/mockData';
import {mockLabel, mockShot, mockSource} from '../templates/mockMedia';
import {MockDoc} from '../templates/mockDoc';
import {useTheme} from '../theme/context';
import {SKIN_IDS} from '../skins';
import {BarChart} from './BarChart';
import {BulletList} from './BulletList';
import {Emphasis} from './Emphasis';
import {Flow} from './Flow';
import {MediaCard} from './MediaCard';
import {MediaStage} from './MediaStage';
import {Panel} from './Panel';
import {ProgressBar} from './ProgressBar';
import {Quote} from './Quote';
import {RichTextBox} from './RichTextBox';
import {SafeArea} from './SafeArea';
import {ScrollArea} from './ScrollArea';
import {SectionHeading} from './SectionHeading';
import {Stage} from './Stage';
import {Stat} from './Stat';
import {Subtitle} from './Subtitle';
import {TextReveal} from './TextReveal';
import {TextTag} from './TextTag';
import {Title} from './Title';

/**
 * 契约原语的**声明**：每个原语有哪些 prop、它的**默认显示语义**、一个诚实的演示实例、
 * 以及它自己的**动画完成帧**。
 *
 * ## 为什么要有这个文件
 *
 * 原语以前只有一段 TS 类型，没有**机器可读**的声明 —— 于是「展示页要按元素为单位展示原语」
 * 这件事只能靠手写清单，而手写清单一定会漂移。
 * 版式层早就有对应物：`master/types.ts` 的 `LAYOUT_SPECS`。这里是组件层的同构物。
 *
 * ## 为什么不是「解析 TS props 类型」
 *
 * 解析是脆的，而且**解析出来的东西没法被校验**。声明 + 自动发现 + 漂移报警才是本框架的做法：
 * 生成器会拿这里声明的 prop 名去对照组件源码里的 `type Props`，对不上就报警。
 *
 * ## `display`：默认显示语义（见 `component-contract.md` 第 5 节）
 *
 * 对齐 HTML 的 `display` —— **元素自己声明它该怎么占位**，而不是要求外面给它一个「宿主」：
 *
 *   * `block`     —— 块级，自己撑开盒子（`Title` / `Quote` / `BulletList` …）
 *   * `inline`    —— 行内片段，**自己没有盒子**，活在文本流里（`Emphasis`，与 `<span>` 同理）
 *   * `container` —— 容器，撑满给它的盒子，本身没有视觉身份（`SafeArea` / `Stage`）
 *
 * > 早先这里叫 `host`（自己 / 一句话 / 一屏），把「显示语义」写成了**外部要求**
 * > （「`Emphasis` 必须包在一句话里」）。方向是反的 —— 完整理由见
 * > `references/component-contract.md` §5。
 *
 * ## `demoFrame`：每个元素自己的**动画完成帧**
 *
 * 展示页默认**定格**在这一帧，而不是 frame 0 —— 因为 Remotion 在 frame 0 时
 * 所有元素的 opacity 都是 0，定格在 0 只会得到一页空白。
 * 各元素入场长度不同，所以这个值必须**逐个声明**，不能全页取一个数。
 *
 * ## `Demo` 由声明方决定「这张元素卡该长什么样」
 *
 * 不设 `variants` 之类的 API —— 想展示多个取值（例如 `Emphasis` 的三种 `kind`），
 * **在 `Demo` 里一起摆出来**就行。这样「怎么展示才算诚实」由最懂这个原语的人回答，
 * 而不是由展示页猜。
 *
 * ## `tunable`：只挂「想改 / 能改」的
 *
 * 展示页的格子只有那么大，挂不下 prop 表（那正是上一版「一屏看不到画面」的原因）。
 * 所以每个原语声明 **1–3 个**最可能被改的 prop，展示页只把这几个挂成词条。
 * 判据是「**这个词条能不能让你说出「把它改成 X」**」—— 见类型定义处的完整理由。
 */

export type ComponentDisplay = 'inline' | 'block' | 'container';

export type ComponentPropSpec = {
  readonly name: string;
  readonly kind:
    | 'text'
    | 'lines'
    | 'number'
    | 'boolean'
    | 'enum'
    | 'color'
    | 'node'
    | 'rect'
    // 函数型 prop（`ScrollArea.onMeasured` 是第一个）。**不进展示页词条**：它没有取值可挂，
    // 存在只是为了让这份声明与组件 props **逐项对得上**（T09 那条「声明 vs 实现」的规矩）。
    | 'callback';
  readonly required: boolean;
  /** 组件里内联的默认值，写成字符串**只用于展示**（不参与运行） */
  readonly fallback?: string;
  /** `kind: 'enum'` 时的全部取值 */
  readonly values?: readonly string[];
  readonly note?: string;
};

export type ComponentSpec = {
  readonly name: string;
  readonly display: ComponentDisplay;
  /** 这个元素的**动画完成帧** —— 卡片默认定格在它，而不是 frame 0（那时 opacity 全是 0） */
  readonly demoFrame: number;
  /**
   * **想改 / 能改的那几个 prop**（1–3 个）—— 展示页只把这几个挂成格子上的词条。
   *
   * 为什么是**声明**而不是推断：拿 `Title` 试一遍，12 个 prop 里「能改」的有 9 个
   * （`fontSize` / `align` / `maxWidth` / `letterSpacing` / `lineHeight` / `fontWeight` /
   * `color` / `enterDurationInFrames` / `delayInFrames`），挂不上格子。
   * 所以这是**排序**问题，而「最想改的 3 个」只有懂这个元素的人答得出来 ——
   * 与 `display` / `demoFrame` 同理：推断是脆的，而且推出来的东西**没法被校验**。
   *
   * **判据**：这个词条能不能让你说出「把它改成 X」。
   * 内容是内容（`text` / `children`）、接线是接线（`from` / `name`），它们不是旋钮。
   *
   * 生成器会校验：名字必须在 `props` 里存在（否则 WARN）、数量 1–3（否则 NOTE）。
   */
  readonly tunable: readonly string[];
  readonly purpose: string;
  readonly props: readonly ComponentPropSpec[];
  /** 隔离演示 —— 在带主题的盒子里渲染。**不要 import 具体主题文件**，用 `useTheme()` */
  readonly Demo: React.FC;
};

/** 演示用的一行说明文字，保证各卡片的演示文案风格一致 */
const Note: React.FC<{readonly children: React.ReactNode}> = ({children}) => {
  const theme = useTheme();

  return (
    <div
      style={{
        fontFamily: theme.font.mono,
        fontSize: 20,
        color: theme.color.muted,
        letterSpacing: 0.4,
      }}
    >
      {children}
    </div>
  );
};

export const COMPONENT_SPECS: readonly ComponentSpec[] = [
  {
    name: 'Title',
    display: 'block',
    demoFrame: 40,
    tunable: ['fontSize', 'align', 'maxWidth'],
    purpose: '主标题。入场 = 透明度 + 上移，无回弹的强减速曲线',
    props: [
      {name: 'text', kind: 'text', required: true},
      {name: 'fontSize', kind: 'number', required: false, fallback: '96', note: '像素'},
      {name: 'color', kind: 'color', required: false, note: '省略则取主题的 ink'},
      {name: 'align', kind: 'enum', required: false, fallback: 'left', values: ['left', 'center', 'right']},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0', note: '本地时间线的入场延迟（帧）'},
      {name: 'enterDurationInFrames', kind: 'number', required: false, fallback: '24', note: '入场长度（帧）。不是 Sequence 的 durationInFrames'},
      {name: 'from', kind: 'number', required: false, note: '透传给 Interactive 的 Sequence 起始帧'},
      {name: 'name', kind: 'text', required: false, fallback: 'Title', note: 'Studio 时间线显示名，硬编码'},
      {name: 'fontWeight', kind: 'number', required: false, fallback: '700'},
      {name: 'letterSpacing', kind: 'number', required: false, fallback: '-0.5'},
      {name: 'lineHeight', kind: 'number', required: false, fallback: '1.08'},
      {name: 'maxWidth', kind: 'number', required: false, note: '像素'},
    ],
    Demo: () => <Title text="写代码，然后等渲染" fontSize={84} />,
  },
  {
    name: 'Subtitle',
    display: 'block',
    demoFrame: 40,
    tunable: ['fontSize', 'align', 'maxWidth'],
    purpose: '副标题 / 支撑句。与 Title 同一套入场，但更轻',
    props: [
      {name: 'text', kind: 'text', required: true},
      {name: 'fontSize', kind: 'number', required: false, fallback: '40'},
      {name: 'color', kind: 'color', required: false},
      {name: 'align', kind: 'enum', required: false, fallback: 'left', values: ['left', 'center', 'right']},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '8'},
      {name: 'enterDurationInFrames', kind: 'number', required: false, fallback: '24'},
      {name: 'from', kind: 'number', required: false},
      {name: 'name', kind: 'text', required: false, fallback: 'Subtitle'},
      {name: 'fontWeight', kind: 'number', required: false, fallback: '400'},
      {name: 'lineHeight', kind: 'number', required: false, fallback: '1.4'},
      {name: 'maxWidth', kind: 'number', required: false, fallback: '900'},
    ],
    Demo: () => (
      <Subtitle
        text="复用组件省掉的是编写时间，渲染配置档省掉的是等待时间。"
        fontSize={38}
      />
    ),
  },
  {
    name: 'SectionHeading',
    display: 'block',
    demoFrame: 40,
    tunable: ['fontSize', 'index'],
    purpose: '小节标题。序号 + 标题 + 规则线，用来在版式内部再分节',
    props: [
      {name: 'index', kind: 'text', required: false, note: '序号，如 01'},
      {name: 'title', kind: 'text', required: true},
      {name: 'color', kind: 'color', required: false},
      {name: 'accentColor', kind: 'color', required: false},
      {name: 'ruleColor', kind: 'color', required: false},
      {name: 'fontSize', kind: 'number', required: false, fallback: '56'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'enterDurationInFrames', kind: 'number', required: false, fallback: '22'},
      {name: 'from', kind: 'number', required: false},
      {name: 'name', kind: 'text', required: false, fallback: 'Section heading'},
    ],
    Demo: () => <SectionHeading index="01" title="套件演示" />,
  },
  {
    name: 'Quote',
    display: 'block',
    demoFrame: 40,
    tunable: ['fontSize', 'maxWidth'],
    purpose: '引述。左侧强调条 + 引文 + 出处，入场为透明度 + 上移',
    props: [
      {name: 'text', kind: 'text', required: true},
      {name: 'attribution', kind: 'text', required: false, note: '出处，通常带破折号'},
      {name: 'fontSize', kind: 'number', required: false, fallback: '52'},
      {name: 'color', kind: 'color', required: false},
      {name: 'accentColor', kind: 'color', required: false, note: '左侧强调条的颜色'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'enterDurationInFrames', kind: 'number', required: false, fallback: '24'},
      {name: 'from', kind: 'number', required: false},
      {name: 'maxWidth', kind: 'number', required: false, fallback: '1200'},
      {name: 'name', kind: 'text', required: false, fallback: 'Quote'},
    ],
    Demo: () => (
      <Quote
        text="复用组件省掉的是编写时间，配置档省掉的是等待时间。"
        attribution="—— kit-core"
        fontSize={44}
      />
    ),
  },
  {
    name: 'BulletList',
    display: 'block',
    demoFrame: 48,
    tunable: ['fontSize', 'gap', 'staggerInFrames'],
    purpose: '条目清单。逐条错开入场，标记块从左侧生长',
    props: [
      {name: 'items', kind: 'lines', required: true},
      {name: 'fontSize', kind: 'number', required: false, fallback: '44'},
      {name: 'color', kind: 'color', required: false},
      {name: 'bulletColor', kind: 'color', required: false},
      {name: 'gap', kind: 'number', required: false, fallback: '28', note: '条间距（像素）'},
      {name: 'staggerInFrames', kind: 'number', required: false, fallback: '7', note: '逐条错开间隔（帧）'},
      {name: 'itemDurationInFrames', kind: 'number', required: false, fallback: '20'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'from', kind: 'number', required: false},
      {name: 'bulletSize', kind: 'number', required: false, fallback: '12'},
      {name: 'maxWidth', kind: 'number', required: false, fallback: '1000'},
    ],
    Demo: () => (
      <BulletList items={['组件复用', '渲染配置档', '抽帧验证']} fontSize={38} />
    ),
  },
  {
    name: 'TextReveal',
    display: 'block',
    demoFrame: 44,
    tunable: ['fontSize', 'staggerInFrames', 'lineHeight'],
    purpose: '逐行揭示。每行装在遮罩里向上推出，用来给整句台词一个节奏',
    props: [
      {name: 'lines', kind: 'lines', required: true},
      {name: 'fontSize', kind: 'number', required: false, fallback: '72'},
      {name: 'color', kind: 'color', required: false},
      {name: 'align', kind: 'enum', required: false, fallback: 'left', values: ['left', 'center', 'right']},
      {name: 'staggerInFrames', kind: 'number', required: false, fallback: '6'},
      {name: 'lineDurationInFrames', kind: 'number', required: false, fallback: '22'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'from', kind: 'number', required: false},
      {name: 'fontWeight', kind: 'number', required: false, fallback: '600'},
      {name: 'lineHeight', kind: 'number', required: false, fallback: '1.22'},
      {name: 'maxWidth', kind: 'number', required: false, fallback: '1100'},
    ],
    Demo: () => <TextReveal lines={['逐行揭示', '每行装在遮罩里']} fontSize={56} />,
  },
  {
    name: 'ProgressBar',
    display: 'block',
    demoFrame: 24,
    tunable: ['height', 'progress'],
    purpose: '进度条。填充宽度由 `progress` 驱动，用来表达「整片走到哪了」',
    props: [
      {name: 'progress', kind: 'number', required: true, note: '0–1'},
      {name: 'color', kind: 'color', required: false, note: '填充色，省略取主题 accent'},
      {name: 'trackColor', kind: 'color', required: false},
      {name: 'height', kind: 'number', required: false, fallback: '6'},
      {name: 'width', kind: 'text', required: false, fallback: '100%', note: '像素或 CSS 长度'},
      {name: 'radius', kind: 'number', required: false, fallback: '3'},
    ],
    Demo: () => (
      <div style={{width: 900}}>
        <ProgressBar progress={0.62} />
      </div>
    ),
  },
  {
    name: 'Emphasis',
    display: 'inline',
    demoFrame: 30,
    tunable: ['kind', 'thickness'],
    purpose: '行内强调。三种形态：高亮 / 下划线 / 方框，都随帧绘制出来',
    props: [
      {name: 'children', kind: 'node', required: true},
      {name: 'kind', kind: 'enum', required: false, fallback: 'highlight', values: ['highlight', 'underline', 'box']},
      {name: 'color', kind: 'color', required: false},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'drawDurationInFrames', kind: 'number', required: false, fallback: '18', note: '绘制（划出 / 框出）的时长'},
      {name: 'thickness', kind: 'number', required: false, fallback: '6'},
      {name: 'name', kind: 'text', required: false, fallback: 'Emphasis'},
    ],
    // `display: inline` —— 行内片段，**自己没有盒子**，所以演示必须放在文本流里（像 <span>）。三种形态一起摆，省掉一个 variants API。
    Demo: () => {
      const theme = useTheme();

      return (
        <div
          style={{
            fontFamily: theme.font.family,
            fontSize: 46,
            fontWeight: 700,
            lineHeight: 1.6,
            color: theme.color.ink,
          }}
        >
          最慢的两件事是{' '}
          <Emphasis kind="highlight">写代码</Emphasis> 和{' '}
          <Emphasis kind="underline">渲染</Emphasis>，第三种形态是{' '}
          <Emphasis kind="box">方框</Emphasis>。
        </div>
      );
    },
  },
  {
    name: 'SafeArea',
    display: 'container',
    demoFrame: 24,
    tunable: ['insetX', 'insetY', 'align'],
    purpose: '安全区容器。按主题的 safe 基准留边，保证内容不贴边',
    props: [
      {name: 'children', kind: 'node', required: true},
      {name: 'insetX', kind: 'number', required: false, note: '省略则取主题 safe.x × 缩放'},
      {name: 'insetY', kind: 'number', required: false},
      {name: 'align', kind: 'enum', required: false, fallback: 'center', values: ['top', 'center', 'bottom']},
      {name: 'style', kind: 'node', required: false},
    ],
    // `display: container` —— 撑满给它的盒子，本身没有视觉身份；要展示的是「它把内容放在哪」，所以画一条安全区边界
    Demo: () => {
      const theme = useTheme();

      return (
        <SafeArea>
          <div
            style={{
              outline: `2px dashed ${theme.color.rule}`,
              outlineOffset: 0,
              padding: 40,
              fontFamily: theme.font.mono,
              fontSize: 24,
              color: theme.color.muted,
            }}
          >
            这段内容被 SafeArea 框住了 —— 虚线就是安全区边界
          </div>
        </SafeArea>
      );
    },
  },
  {
    name: 'Stage',
    display: 'container',
    demoFrame: 24,
    tunable: ['grid', 'vignette', 'gridSize'],
    purpose: '背景舞台。底色 + 可选网格 + 可选暗角，颜色的来源都在主题里',
    props: [
      {name: 'children', kind: 'node', required: false},
      {name: 'background', kind: 'color', required: false, note: '省略取主题 color.bg'},
      {name: 'grid', kind: 'boolean', required: false, fallback: 'false'},
      {name: 'gridColor', kind: 'color', required: false},
      {name: 'gridSize', kind: 'number', required: false, fallback: '80'},
      {name: 'vignette', kind: 'boolean', required: false, fallback: 'false'},
      {name: 'vignetteColor', kind: 'color', required: false},
    ],
    Demo: () => (
      <Stage grid vignette>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Note>网格 + 暗角都由主题给色</Note>
        </div>
      </Stage>
    ),
  },
  {
    name: 'MediaStage',
    display: 'block',
    demoFrame: 24,
    tunable: ['fit', 'labelPlacement', 'radius'],
    purpose: '多媒体框。正中心安全区内的 16:9 大框，放图片 / 视频 / 自绘内容',
    props: [
      {name: 'src', kind: 'text', required: false, note: '图片 / 视频地址。给了它就忽略 children'},
      {name: 'kind', kind: 'enum', required: false, values: ['image', 'video'], note: '给了 src 就必须给 —— 不猜扩展名'},
      {name: 'children', kind: 'node', required: false, note: '没有 src 时渲染的内容'},
      {name: 'width', kind: 'number', required: false, note: '像素。省略则取安全区内容区宽度'},
      {name: 'height', kind: 'number', required: false, note: '像素。省略则按 16:9 从 width 推'},
      {name: 'fit', kind: 'enum', required: false, fallback: 'cover', values: ['cover', 'contain']},
      {name: 'label', kind: 'text', required: false},
      {name: 'source', kind: 'text', required: false},
      {name: 'labelPlacement', kind: 'enum', required: false, fallback: 'bottom', values: ['bottom', 'top']},
      {name: 'labelFontSize', kind: 'number', required: false, note: '像素。省略则取框高的 5%'},
      {name: 'borderColor', kind: 'color', required: false, note: '省略取主题 color.accent'},
      {name: 'borderWidth', kind: 'number', required: false, note: '像素。省略取主题 graphic.accentBar'},
      {name: 'radius', kind: 'number', required: false, note: '像素。省略取主题 graphic.blockRadius'},
      {name: 'background', kind: 'color', required: false, note: '框底色；fit: contain 时留边露出来的那块'},
    ],
    // 演示走的是**真的 `src`**（data URI 的 SVG 截图）—— 不是「没给 src 就画 children」那条退路。
    // 两条路要各验一遍，混在一起等于只验了一条。
    Demo: () => (
      <MediaStage src={mockShot(0)} kind="image" label={mockLabel(0)} source={mockSource(0)} />
    ),
  },
  {
    name: 'MediaCard',
    display: 'container',
    demoFrame: 40,
    tunable: ['fit', 'labelPlacement', 'focus'],
    purpose: '迷你多媒体框。带缩放特性 —— 讲到它时按 focus 长大并移到目标矩形',
    props: [
      {name: 'src', kind: 'text', required: false},
      {name: 'kind', kind: 'enum', required: false, values: ['image', 'video']},
      {name: 'children', kind: 'node', required: false},
      {name: 'fit', kind: 'enum', required: false, fallback: 'cover', values: ['cover', 'contain']},
      {name: 'label', kind: 'text', required: false},
      {name: 'source', kind: 'text', required: false},
      {name: 'labelFontSize', kind: 'number', required: false},
      {name: 'borderColor', kind: 'color', required: false},
      {name: 'borderWidth', kind: 'number', required: false},
      {name: 'radius', kind: 'number', required: false},
      {name: 'background', kind: 'color', required: false},
      {name: 'labelPlacement', kind: 'enum', required: false, fallback: 'bottom', values: ['bottom', 'top', 'auto'], note: 'auto = 静止在下沿，一进展开态就换到上沿'},
      {name: 'from', kind: 'rect', required: true, note: '静止时的矩形（帧坐标）'},
      {name: 'to', kind: 'rect', required: true, note: '展开后的目标矩形（帧坐标）'},
      {name: 'focus', kind: 'number', required: false, fallback: '0', note: '0–1，驱动量；缓动由调用方决定'},
    ],
    // 悬停这一格时 `demoFrame` 从 0 走到 40，中间那张就长大并移到正中 ——
    // 展示页的悬停动画**真的**驱动了 `focus`，因为它读的是当前帧。
    Demo: () => {
      const frame = useCurrentFrame();
      const focus = interpolate(frame, [0, 40], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

      return (
        <>
          {DEMO_CARDS.map((from, i) => (
            <MediaCard
              key={i}
              from={from}
              to={DEMO_CARD_TO}
              focus={i === 1 ? focus : 0}
              src={mockShot(i)}
              kind="image"
              label={mockLabel(i)}
              source={mockSource(i)}
              labelPlacement="auto"
            />
          ))}
        </>
      );
    },
  },
  {
    name: 'ScrollArea',
    display: 'container',
    demoFrame: 40,
    tunable: ['scroll', 'rail', 'railWidth'],
    purpose: '滚动区。一个裁切视口，把比它高的内容按 scroll 平移 —— 视频里没有「滚动」这个动作，只有按帧平移',
    props: [
      {name: 'scroll', kind: 'number', required: true, note: '0–1 的滚动位置，驱动量；缓动由调用方决定'},
      {name: 'children', kind: 'node', required: false, note: '要滚动的内容；行号沟也算内容，它跟着滚'},
      {name: 'header', kind: 'node', required: false, note: '钉在视口上方的头，不参与滚动'},
      {name: 'contentHeight', kind: 'number', required: false, note: '像素。省略则组件自己量（量是官方做法）'},
      {name: 'rail', kind: 'boolean', required: false, fallback: 'false', note: '右缘画滚动轨；默认不画'},
      {name: 'railWidth', kind: 'number', required: false, fallback: '6', note: '像素'},
      {name: 'onMeasured', kind: 'callback', required: false, note: '尺寸通知（最小接口）：把量到的 {viewport, content} 交出来，只在数变了时喊；锚点算式用 anchorScroll'},
    ],
    // 这一格**真的在滚**：`demoFrame` 上 `scroll = 1`，所以静止帧停在「滚到底」；
    // 悬停时从 0 走到 1，内容整体上移、滑块同步往下走。
    Demo: () => {
      const frame = useCurrentFrame();
      const scroll = interpolate(frame, [0, 40], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

      return (
        <ScrollArea scroll={scroll} rail>
          <MockDoc />
        </ScrollArea>
      );
    },
  },
  {
    name: 'TextTag',
    display: 'inline',
    demoFrame: 36,
    tunable: ['tone', 'fontSize', 'radius'],
    purpose: '文字标签。一小段文字装在盒子里，四种分量从实底到中性；成排的排版由调用方给',
    props: [
      {name: 'text', kind: 'text', required: true},
      {name: 'tone', kind: 'enum', required: false, fallback: 'tint', values: ['solid', 'tint', 'outline', 'muted']},
      {name: 'fontSize', kind: 'number', required: false, fallback: '28', note: '像素。内边距按它等比推出'},
      {name: 'radius', kind: 'number', required: false, note: '像素。省略取主题 graphic.blockRadius'},
      {name: 'color', kind: 'color', required: false, note: '省略取主题 color.accent'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0', note: '一排标签靠它错开'},
      {name: 'enterDurationInFrames', kind: 'number', required: false, fallback: '18'},
      {name: 'from', kind: 'number', required: false},
      {name: 'name', kind: 'text', required: false, fallback: 'Text tag'},
    ],
    // `display: inline` —— 标签**自己没有盒子**，成排才是它的常态，所以演示必须摆成一排
    // （像一排 `<span>`）。四种分量一起摆：少摆一种就是少验一条分支。
    Demo: () => (
      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16}}>
        {MOCK_TAGS.map((tag, i) => (
          <TextTag key={tag.text} text={tag.text} tone={tag.tone} delayInFrames={i * 6} />
        ))}
      </div>
    ),
  },
  {
    name: 'RichTextBox',
    display: 'block',
    demoFrame: 40,
    tunable: ['fontSize', 'box', 'lineHeight'],
    purpose: '富文本框。一段正文里混排加粗 / 高亮 / 等宽，格式用轻量标记写在同一个字符串里',
    props: [
      {name: 'text', kind: 'text', required: true, note: '带标记的正文；换行符分段'},
      {name: 'fontSize', kind: 'number', required: false, fallback: '34', note: '像素'},
      {name: 'lineHeight', kind: 'number', required: false, fallback: '1.6'},
      {name: 'color', kind: 'color', required: false, note: '省略取主题 color.ink'},
      {name: 'accentColor', kind: 'color', required: false, note: '高亮 / 行内代码的色'},
      {name: 'align', kind: 'enum', required: false, fallback: 'left', values: ['left', 'center', 'right']},
      {name: 'box', kind: 'boolean', required: false, fallback: 'false', note: '画一层描边与内边距'},
      {name: 'boxColor', kind: 'color', required: false, note: '省略透明'},
      {name: 'borderColor', kind: 'color', required: false, note: '省略取主题 color.rule'},
      {name: 'maxWidth', kind: 'number', required: false, fallback: '1100', note: '像素'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'enterDurationInFrames', kind: 'number', required: false, fallback: '22'},
      {name: 'from', kind: 'number', required: false},
      {name: 'name', kind: 'text', required: false, fallback: 'Rich text box'},
    ],
    // `box` 的两条分支都要摆：不开是正文，开了才是结论框。
    // 第一种里三种标记也都在场（`**加粗**` / `==高亮==` / `等宽`）。
    Demo: () => (
      <div style={{display: 'flex', flexDirection: 'column', gap: 28, width: 940}}>
        <RichTextBox text={MOCK_RICH} fontSize={32} />
        <RichTextBox
          text="**框**是可选的：开了只加一层描边与内边距，底色默认透明。"
          fontSize={28}
          box
        />
      </div>
    ),
  },
  {
    name: 'BarChart',
    display: 'block',
    demoFrame: 44,
    tunable: ['max', 'barHeight', 'gap'],
    purpose: '水平条形图。一行一个类别，条长编码数值；标签列固定宽，数值列右对齐',
    props: [
      {name: 'items', kind: 'lines', required: true, note: "每条是 '标签<TAB>数值'"},
      {name: 'max', kind: 'number', required: false, note: '满格值。省略取最大数值'},
      {name: 'fontSize', kind: 'number', required: false, fallback: '30', note: '像素'},
      {name: 'barHeight', kind: 'number', required: false, fallback: '22', note: '像素'},
      {name: 'gap', kind: 'number', required: false, fallback: '22', note: '行间距（像素）'},
      {name: 'labelWidth', kind: 'number', required: false, fallback: '300', note: '像素。必须固定'},
      {name: 'valueWidth', kind: 'number', required: false, fallback: '150', note: '像素'},
      {name: 'color', kind: 'color', required: false, note: '条色，省略取主题 color.accent'},
      {name: 'trackColor', kind: 'color', required: false, note: '省略取主题 color.rule'},
      {name: 'radius', kind: 'number', required: false, note: '像素。省略取主题 graphic.blockRadius'},
      {name: 'unit', kind: 'text', required: false, note: '数值后缀，如 s / %'},
      {name: 'decimals', kind: 'number', required: false, fallback: '0'},
      {name: 'staggerInFrames', kind: 'number', required: false, fallback: '6', note: '逐条错开（帧）'},
      {name: 'barDurationInFrames', kind: 'number', required: false, fallback: '20'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'from', kind: 'number', required: false},
      {name: 'name', kind: 'text', required: false, fallback: 'Bar chart'},
      {name: 'width', kind: 'text', required: false, fallback: '100%', note: '像素或 CSS 长度'},
    ],
    Demo: () => (
      <div style={{width: 1000}}>
        <BarChart items={MOCK_BARS} fontSize={30} unit="s" decimals={1} />
      </div>
    ),
  },
  {
    name: 'Panel',
    // ⚠️ 2026-10-05 T04 改判：原本声明 `block`，但它的内层写了无条件 `height: 100%`
    // —— 那正是「撑满给它的盒子」，也就是 `container`。改判之前，
    // 「`display` 声明了什么」与「元素实际怎么响应」是分叉的：
    // 实测它在 `equal` 组里第一子高 = 格子高（`Stage2Probe` 场景 C）。
    display: 'container',
    demoFrame: 30,
    tunable: ['width', 'shadow', 'dim'],
    purpose: '内容卡。有边界的容器：头 / 身 / 尾三段槽，框高在自然高度的父级里跟内容走，讲到别处时可压暗',
    props: [
      {name: 'children', kind: 'node', required: true, note: '卡身，内容无关'},
      {name: 'header', kind: 'node', required: false, note: '卡头；给了它就带一条分隔线'},
      {name: 'footer', kind: 'node', required: false, note: '卡尾，贴在框底 —— 标注 / 徽章的锚位'},
      {name: 'width', kind: 'text', required: false, note: '像素，或 fit（跟内容走）。省略则撑满'},
      {name: 'padding', kind: 'number', required: false, fallback: '28', note: '像素'},
      {name: 'gap', kind: 'number', required: false, fallback: '18', note: '三段之间的间距（像素）'},
      {name: 'borderColor', kind: 'color', required: false, note: '省略取主题 color.ink'},
      {name: 'borderWidth', kind: 'number', required: false, note: '像素。省略取主题 graphic.ruleThickness'},
      {name: 'radius', kind: 'number', required: false, note: '像素。省略取皮，皮不主张再取主题 graphic.blockRadius'},
      {name: 'skin', kind: 'enum', required: false, values: [...SKIN_IDS], note: '外观预设（T08）。省略 = plain；名字不存在时明确报错，不静默回退'},
      {name: 'background', kind: 'color', required: false, note: '省略取主题 color.bg（不透明，挡网格）'},
      {name: 'shadow', kind: 'boolean', required: false, fallback: 'false', note: '硬偏移阴影；默认关'},
      {name: 'shadowColor', kind: 'color', required: false, note: '省略取描边色'},
      {name: 'shadowOffset', kind: 'number', required: false, fallback: '8', note: '像素'},
      {name: 'dim', kind: 'number', required: false, fallback: '0', note: '0–1 强调态：讲到别处时压暗'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'enterDurationInFrames', kind: 'number', required: false, fallback: '22'},
      {name: 'from', kind: 'number', required: false},
      {name: 'name', kind: 'text', required: false, fallback: 'Panel'},
    ],
    // 分支要摆全：`header`+`footer`+`shadow` 开的那张、`dim=1`（压暗）的那张，
    // 以及 `width` 的三档。
    //
    // ⚠️ **两段并排，不是上下叠。** 叠起来时演示盒子有 805px 高，而安全区只有 880 ——
    // 「居中」照样成立，可它**贴着内容区的上下边**（实测余量只有 38px），看起来就是越界。
    //
    // ⚠️ **宽度是算出来的，不是看着差不多就行。** 这一段是个**收缩到内容**的 flex 行，
    // 所以它的宽 = 两段各自 max-content 之和。而 `Panel` 的 max-content = `RichTextBox` 的
    // `maxWidth` + 内边距（28×2）+ 描边 —— 给 460 的话，一长一短那一段就有 1064 宽，
    // 加上宽度那一段的 700，整盒 1804 > 安全区 1760，**右侧被切掉**（实测余量 13px）。
    // 现在：一长一短 `maxWidth` 300（两段各 360 → 744），宽度段 700 → 合计 1484，四边都留得下。
    //
    // 宽度那一段**不能再窄**：它的「撑满」是验收里 `fit` 的对照（判据是 `fit < 撑满 × 0.7`），
    // 700 之下 `fit`（实测 432）才明显更窄。
    //
    // ⚠️ 「一长一短」那一段挂 `data-panel="heights"` —— 展示页的验收从这里取两张卡比高度。
    // **别靠 `.el` 的第一个子元素**：那样一改布局就会静默错位（选择器要稳定把手，不能是结构位置）。
    Demo: () => {
      const theme = useTheme();

      return (
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 40}}>
          {/* 一长一短 —— 框高跟内容走；右边那张演示强调态（`dim`） */}
          <div
            data-panel="heights"
            style={{display: 'flex', alignItems: 'flex-start', gap: 24}}
          >
            <Panel
              shadow
              header={
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    fontFamily: theme.font.family,
                    fontSize: 22,
                  }}
                >
                  <span style={{fontWeight: 700, color: theme.color.ink}}>中文翻译</span>
                  <span style={{color: theme.color.muted}}>第 1 / 2 页</span>
                </div>
              }
              footer={<TextTag text="正文未提 blended" tone="solid" fontSize={22} />}
            >
              <RichTextBox text={MOCK_PANEL_TALL} fontSize={22} maxWidth={300} />
            </Panel>

            <Panel shadow dim={1}>
              <RichTextBox text={MOCK_PANEL_SHORT} fontSize={22} maxWidth={300} />
            </Panel>
          </div>

          {/* `width` 的三档，**同一段内容**：撑满（省略）→ 收紧（`'fit'`）→ 定宽（数字）。
              这一段必须待在**撑满的上下文**里（一个纯块级的列），否则三档量不出差别 ——
              放在 flex 行里的话，「省略」也会按内容收，于是它和 `'fit'` 长得一模一样。 */}
          <div
            data-panel="widths"
            style={{display: 'flex', flexDirection: 'column', gap: 16, width: 700}}
          >
            <Panel shadow>
              <RichTextBox text={MOCK_PANEL_SHORT} fontSize={22} />
            </Panel>
            <Panel shadow width="fit">
              <RichTextBox text={MOCK_PANEL_SHORT} fontSize={22} />
            </Panel>
            <Panel shadow width={360}>
              <RichTextBox text={MOCK_PANEL_SHORT} fontSize={22} />
            </Panel>
          </div>
        </div>
      );
    },
  },
  {
    name: 'Flow',
    display: 'container',
    demoFrame: 44,
    tunable: ['ratio', 'sizing', 'gap'],
    purpose: '排列容器。一屏里的相对比例与间距由它统一表达，子项不必知道这件事；三档尺寸语义都是显式的词',
    props: [
      {name: 'children', kind: 'node', required: false, note: '按顺序落进各轨道 —— 顺序就是位置'},
      {name: 'direction', kind: 'enum', required: false, fallback: 'row', values: ['row', 'column']},
      {
        name: 'ratio',
        kind: 'text',
        required: false,
        note: '数字数组，如 [2, 1, 1]（相对比例）；省略则等分。长度不匹配时多的忽略、缺的按 1',
      },
      {
        name: 'tracks',
        kind: 'text',
        required: false,
        note: '混合主轴轨道（与 ratio 互斥）：数字＝按权重分剩余、\'content\'＝按内容取尺寸。如 [1, \'content\']。⚠️ column 下要配 sizing="fill"',
      },
      {name: 'gap', kind: 'number', required: false, note: '像素。省略取主题 space.gap'},
      {
        name: 'sizing',
        kind: 'enum',
        required: false,
        fallback: 'natural',
        values: ['natural', 'equal', 'fill'],
        note: 'natural 按内容 · equal 等高 · fill 撑满本组被给到的高度',
      },
      {
        name: 'align',
        kind: 'enum',
        required: false,
        fallback: 'start',
        values: ['start', 'center', 'end', 'stretch'],
        note: '交叉轴对齐，**一定生效**（T04 起写进 --kit-align）；省略时子项用自己的自然默认',
      },
    ],
    // 三段**同样的孩子**，只换 `sizing` —— 比例恒定为 2:1:1，于是三行之间的差别只可能来自尺寸档。
    // 每行的外框给**确定高度**（240），`fill` 才撑得满；`natural` / `equal` 在同一高度里各按自己的规则。
    Demo: () => {
      const theme = useTheme();

      const kid = (text: string) => (
        <Panel shadow>
          <RichTextBox text={text} fontSize={20} maxWidth={260} />
        </Panel>
      );

      const row = (sizing: 'natural' | 'equal' | 'fill') => (
        // ⚠️ `data-flow` 是**稳定把手**：展示页的验收按它取三行的高度，不看结构位置
        // （改布局不会让它静默错位）。三行同样的孩子、同样的比例 —— 只有 sizing 在换。
        <div data-flow={sizing} style={{height: 240, width: '100%'}}>
          <Flow ratio={[2, 1, 1]} gap={20} sizing={sizing}>
            {kid('两句话。这一档比另外两个孩子高一点，参差就是这样来的。')}
            {kid('一句话。')}
            {kid('两句。')}
          </Flow>
        </div>
      );

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            width: 1760,
            fontFamily: theme.font.mono,
            fontSize: 20,
            color: theme.color.muted,
          }}
        >
          <Note>同样三个孩子 · 比例固定 2 : 1 : 1 · 只有 sizing 在换</Note>
          {row('natural')}
          <Note>↑ natural — 各自按内容高（参差）</Note>
          {row('equal')}
          <Note>↑ equal — 都取最高那个</Note>
          {row('fill')}
          <Note>↑ fill — 都撑满这 240</Note>

          {/* U2（2026-10-06）：混合主轴轨道 —— 一列里「上卡吃剩余、下卡按内容高」 */}
          <Note>混排：tracks=[1, &apos;content&apos;] —— 上卡吃剩余、下卡**按内容**（对比上面的 ratio：全体按比例）</Note>
          {/* ⚠️ `data-flow-tracks` 是**稳定把手**：验收按它取上下两卡的高度，不看结构位置 */}
          <div data-flow-tracks="1-content" style={{height: 300, width: 900}}>
            <Flow direction="column" tracks={[1, 'content']} gap={20} sizing="fill">
              <Panel shadow>
                <RichTextBox text="上卡：吃剩余高度。容器从 300 加到 400，长高的就是这一块。" fontSize={20} maxWidth={760} />
              </Panel>
              <Panel shadow>
                <RichTextBox text="下卡：按内容取高（一句话）。" fontSize={20} maxWidth={760} />
              </Panel>
            </Flow>
          </div>
          <Note>
            ↑ 下卡的高度**由它的文案决定**，上卡拿走剩下的 —— 这份表达在旧参数里没有词
          </Note>
        </div>
      );
    },
  },
  {
    name: 'Stat',
    display: 'block',
    demoFrame: 44,
    tunable: ['fontSize', 'align', 'reserveChars'],
    purpose: '大数字。一个数据点：数字 + 单位 + 标签；三段错开入场，还能逐位滚动',
    props: [
      {name: 'value', kind: 'text', required: true, note: '字符串而不是 number —— 格式化属于内容层；可以逐帧变'},
      {name: 'unit', kind: 'text', required: false, note: '单位 / 后缀，如 % / ms / 亿；单独排'},
      {name: 'label', kind: 'text', required: false, note: '这个数字是什么'},
      {name: 'note', kind: 'text', required: false, note: '补充说明（口径 / 条件 / 出处）'},
      {name: 'fontSize', kind: 'number', required: false, fallback: '160', note: '数字字号（像素）；单位 / 标签 / 说明按它等比推出'},
      {name: 'align', kind: 'enum', required: false, fallback: 'left', values: ['left', 'center']},
      {name: 'color', kind: 'color', required: false, note: '数字色，省略取主题 color.accent'},
      {name: 'labelColor', kind: 'color', required: false, note: '省略取主题 color.ink'},
      {name: 'maxWidth', kind: 'number', required: false, fallback: '1000', note: '像素'},
      {name: 'reserveChars', kind: 'number', required: false, note: '数字区按 N 个字符预留宽度 —— 位数变化时不推着单位跑'},
      {name: 'rollFrom', kind: 'text', required: false, note: '数位滚动的起点；必须与 value 等长，否则不滚'},
      {name: 'roll', kind: 'number', required: false, note: '0–1 驱动量；只有给了 rollFrom 且等长时才生效'},
      {name: 'delayInFrames', kind: 'number', required: false, fallback: '0'},
      {name: 'enterDurationInFrames', kind: 'number', required: false, fallback: '28', note: '整段入场的长度（帧），三段按它错开'},
      {name: 'from', kind: 'number', required: false},
      {name: 'name', kind: 'text', required: false, fallback: 'Stat'},
    ],
    // 四条分支各摆一遍：**满的**（数字 + 单位 + 标签 + 说明）、**居中的**（没有说明）、
    // **只有数字的**（值是 `—`，证明组件不解析它）、以及**逐位滚动的**。
    //
    // ⚠️ 滚动那条的 `roll` 读的是**当前帧** —— 所以静止时它停在终点（与静态那条长得一样），
    // **悬停时它真的逐位滚**。定格帧看不出的行为，只能靠悬停播出来（与 `MediaCard` / `ScrollArea` 同一种做法）。
    Demo: () => {
      const frame = useCurrentFrame();
      const roll = interpolate(frame, [6, 40], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

      return (
        // ⚠️ 字号 90、条间距 24 是**按安全区定的**，不是审美：四条叠起来时，
        // 默认字号 120 会让演示盒子有 853px 高 —— 安全区只有 880，于是它**贴着内容区的上下边**
        // （实测余量 14px）。90 之后高度约 668，四边都留出余量。
        <div style={{display: 'flex', flexDirection: 'column', gap: 24, width: 1000}}>
          <Stat {...MOCK_STAT} fontSize={90} />
          <Stat {...MOCK_STAT_CENTERED} align="center" fontSize={90} />
          <Stat value={MOCK_STAT_BARE} fontSize={90} />
          <Stat {...MOCK_STAT} rollFrom={MOCK_STAT_ROLL_FROM} roll={roll} fontSize={90} />
        </div>
      );
    },
  },
];

/** 演示用的排版常量 —— 与 `templates/KitShowcase.tsx` 的迷你框群同一套坐标 */
const DEMO_CARDS = [
  {x: 1460, y: 200, width: 380, height: 214},
  {x: 1460, y: 434, width: 380, height: 214},
  {x: 1460, y: 668, width: 380, height: 214},
] as const;

const DEMO_CARD_TO = {x: 288, y: 162, width: 1344, height: 756} as const;
