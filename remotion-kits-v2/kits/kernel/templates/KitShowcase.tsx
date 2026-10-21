import React from 'react';
import {AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame} from 'remotion';
import demoClip from '../assets/demo-clip.mp4';
import {BarChart} from '../components/BarChart';
import {BulletList} from '../components/BulletList';
import {Emphasis} from '../components/Emphasis';
import {Flow} from '../components/Flow';
import {MediaCard} from '../components/MediaCard';
import {MediaStage} from '../components/MediaStage';
import {Panel} from '../components/Panel';
import {ProgressBar} from '../components/ProgressBar';
import {Quote} from '../components/Quote';
import {RichTextBox} from '../components/RichTextBox';
import {ScrollArea} from '../components/ScrollArea';
import {SectionHeading} from '../components/SectionHeading';
import {Stat} from '../components/Stat';
import {Subtitle} from '../components/Subtitle';
import {TextReveal} from '../components/TextReveal';
import {TextTag} from '../components/TextTag';
import {Title} from '../components/Title';
import {useTheme} from '../theme/context';
import {
  MOCK_BARS_WITH_GAP,
  MOCK_PANEL_PAGE2,
  MOCK_PANEL_SHORT,
  MOCK_PANEL_TALL,
  MOCK_RICH,
  MOCK_STAT,
  MOCK_STAT_COPY,
  MOCK_STAT_COUNT,
  MOCK_STAT_ROLL_FROM,
  MOCK_STAT_ROLL_SHORT,
} from './mockData';
import {MockDoc, MockTitleBar} from './mockDoc';
import {mockLabel, mockShot, mockSource} from './mockMedia';
import {Scene} from './Scene';

const Progress: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <ProgressBar
      progress={interpolate(frame, [0, 52], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })}
    />
  );
};

/**
 * 三个迷你框的排版（帧坐标，1920×1080）。
 *
 * 这**就是** `MediaCard` 的 `from` —— 它不测量、不推断，两个矩形都由调用方给。
 * 右列竖排三个，放大后统一去画面正中（70% 宽）。
 */
const CARD_FROM = [
  {x: 1460, y: 200, width: 380, height: 214},
  {x: 1460, y: 434, width: 380, height: 214},
  {x: 1460, y: 668, width: 380, height: 214},
] as const;

const CARD_TO = {x: 288, y: 162, width: 1344, height: 756} as const;

const CARD_STEP = 50;

/** 依次展开：第 i 个框在自己的那 50 帧里 长大 → 保持 → 缩回 */
const focusOf = (frame: number, index: number): number => {
  const ease = (t: number) => Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, t)));
  const t = frame - index * CARD_STEP;

  if (t <= 0) return 0;
  if (t < 14) return ease(t / 14); // 长大
  if (t < 36) return 1; // 保持 —— 「讲到它」的这段时间
  if (t < CARD_STEP) return 1 - ease((t - 36) / 14); // 缩回
  return 0;
};

/** 迷你框群：讲到哪条，哪条长大并移到画面正中 */
const MediaCards: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {CARD_FROM.map((from, i) => (
        <MediaCard
          key={i}
          from={from}
          to={CARD_TO}
          focus={focusOf(frame, i)}
          src={mockShot(i)}
          kind="image"
          label={mockLabel(i)}
          source={mockSource(i)}
          labelPlacement="auto"
        />
      ))}
    </AbsoluteFill>
  );
};

/**
 * 滚动区：一张「窗口卡」—— **钉住的标题栏 + 会滚的正文**。
 *
 * `MediaStage` 只给框（**故意不给 `label`** —— 那会画出一条标签条，而标题栏在这里是
 * `ScrollArea` 的 `header`，它要占位、不能被内容穿过去）。
 */
const ScrollScene: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [8, 62], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <MediaStage width={1344} height={756}>
        <ScrollArea scroll={scroll} header={<MockTitleBar />} rail>
          <MockDoc />
        </ScrollArea>
      </MediaStage>
    </AbsoluteFill>
  );
};

/**
 * 内容卡：**同一个框，正文原位替换**，窗口跟着收紧；右侧那张演示强调态。
 *
 * 三件事在这一个场景里同时成立：
 *   ① **原位替换** —— 第 30 帧把正文换成第二页（连同页码），**位置不动**；
 *   ② **窗口收紧** —— 第二页字少，所以框**矮下去**。⚠️ 框是**顶部锚定**的
 *      （`alignItems: 'flex-start'`），所以只有下边缘往上收 —— 若垂直居中，收紧会变成上下一起动；
 *   ③ **强调态** —— 讲到右卡时左卡压暗，反之亦然（`dim` 是驱动量，缓动在这里）。
 *
 * ⚠️ 高度变化是**离散**的（不补间）：契约禁止动画 `height`，而缩放整个框会把字也缩放（变形）。
 */
const PanelScene: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const toRight = interpolate(frame, [34, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  // **原位替换**：到点直接换正文，位置不动
  const page = frame < 30 ? 1 : 2;

  return (
    // ⚠️ `align="top"` 是**必须的**，不是构图偏好：框高跟内容走，若把内容垂直居中，
    // 「窗口收紧」会变成**上下一起缩**（看起来是窗口在跳）。顶部锚定之后，只有下边缘往上收。
    <Scene grid align="top" contentStyle={{alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 32, width: 1560}}>
        <Panel
          shadow
          dim={toRight}
          header={
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span style={{fontWeight: 700, fontSize: 30}}>中文翻译</span>
              <span style={{fontSize: 26, color: theme.color.muted}}>
                第 {page} / 2 页 · 全文未删节
              </span>
            </div>
          }
          footer={<TextTag text="正文未提 blended" tone="solid" fontSize={26} />}
        >
          <RichTextBox
            text={page === 1 ? MOCK_PANEL_TALL : MOCK_PANEL_PAGE2}
            fontSize={30}
            maxWidth={640}
          />
        </Panel>

        <Panel shadow dim={1 - toRight}>
          <RichTextBox text={MOCK_PANEL_SHORT} fontSize={30} maxWidth={640} />
        </Panel>
      </div>
    </Scene>
  );
};

/**
 * 大数字 · **计数到 + 跳动** —— 两条路都在**调用方**，组件一个字都不解析。
 *
 * ① **计数到**：每帧把**数值**插值出来、格式化成字符串传 `value`。位数一路在变
 *    （`0.0` → `86.6`），所以必须 `reserveChars` —— 否则单位被推着往右跑。
 * ② **跳动**：到点**一帧换掉**（不补间）。同位数时等宽族保证整行不动 —— 所以换的值
 *    故意保持 4 位。
 */
const StatCountScene: React.FC = () => {
  const frame = useCurrentFrame();

  const counted = interpolate(
    frame,
    [10, 42],
    [MOCK_STAT_COUNT.from, MOCK_STAT_COUNT.to],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      // ⚠️ 用 inOut 而不是 out：**低位数那一小段要看得见**。
      // `86.6` 这个终点让「3 位」只占整个行程的前 12%，用 out 的话那一段会挤在开头几帧里，
      // 而单位的淡入要到第 10 帧才开始 —— 于是「位数变了、单位却不动」这件事**根本看不见**。
      easing: Easing.inOut(Easing.cubic),
    },
  ).toFixed(MOCK_STAT_COUNT.decimals);

  // 42 帧之后：跳动两次 —— **一帧换掉**，不是滚动
  const value = frame < 45 ? counted : frame < 51 ? '91.2' : '88.4';

  return (
    <Scene grid contentStyle={{alignItems: 'center'}}>
      <Stat
        {...MOCK_STAT_COPY}
        value={value}
        note="计数到 = 调用方每帧算字符串；到点一帧换掉 = 跳动。位数会变，所以必须 reserveChars。"
        align="center"
        reserveChars={4}
      />
    </Scene>
  );
};

/**
 * 大数字 · **数位滚动** —— 组件里唯一一条「知道那是数字」的路。
 *
 * 每一位从自己的起点滚到自己的终点（**逐位线性**，不是数值插值）。
 * 左边起点等长（每位都滚）；右边起点**短一位** → 不滚、直接显示 —— 不报错、也不猜。
 */
const StatRollScene: React.FC = () => {
  const frame = useCurrentFrame();
  const roll = interpolate(frame, [8, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <Scene grid contentStyle={{alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 96}}>
        <Stat {...MOCK_STAT} rollFrom={MOCK_STAT_ROLL_FROM} roll={roll} />
        <Stat {...MOCK_STAT} rollFrom={MOCK_STAT_ROLL_SHORT} roll={roll} />
      </div>
      <Subtitle
        text="左：起点等长 → 每位都滚　｜　右：起点短一位 → 不滚"
        align="center"
        maxWidth={1400}
        delayInFrames={26}
      />
    </Scene>
  );
};

/**
 * 排列 · **比例（含一个写全与省略等价的对照）**。
 *
 * 上一行：主 2 : 侧 1，`sizing="fill"` —— 两个框都撑满这一行被给到的高度。
 * 下一行：三个孩子、`ratio` **写全** `[2, 1, 1]`。
 *
 * ⚠️ **这里曾经故意只写 `[2, 1]`**（缺的那个按 1 算），理由是「`Flow` 唯一一处会静默错位的地方，
 * 摆进演示让它看得见」。**2026-10-05 改了** —— 那一处现在**不再静默**：缺位与非正数都会
 * 开发期警告（T05 裁定「明确诊断」）。于是本演示的处境变了：
 * **本套件自己的演示不该踩自己的诊断** —— 拿一个必然报错的调用当永久演示，
 * 会让展示页那条「console error/warning 为 0」的断言只能靠白名单放行，
 * 而白名单会顺带盖住真问题。规则本身改由**诊断 + `kit.md` 的已知限制**承担。
 * 画面**几何没变**：`[2, 1]` 补成的权重就是 `[2, 1, 1]`，轨道逐条相同。
 *
 * ⚠️ 两行的外框都给了**确定高度**：`fill` / `equal` 要成立，本组必须能被撑开 ——
 * 父级高度是 `auto` 时百分比高度按 CSS 解析为 `auto`，`fill` 会退化成 **`equal`**（三条同高，
 * 不是「按内容参差」；2026-10-05 实测改正）。这条前提写在 `Flow` 的 prop 注释与 `kit.md` 里。
 */
const FlowScene: React.FC = () => {
  const theme = useTheme();

  const caption = (text: string) => (
    <span style={{fontFamily: theme.font.mono, fontSize: 22, color: theme.color.muted}}>
      {text}
    </span>
  );

  return (
    <Scene grid contentStyle={{alignItems: 'center'}}>
      {/* 主 2 : 侧 1 —— 两个都撑满这 520 */}
      <div style={{width: 1760, height: 520}}>
        <Flow ratio={[2, 1]} gap={32} sizing="fill">
          <Panel shadow header={caption('主 · ratio 2 · filling 520')}>
            <RichTextBox
              text="比例与尺寸都由**这一个容器**表达：调用方不必给子项加任何 prop，也不必知道子项是什么元素。"
              fontSize={26}
              maxWidth={900}
            />
          </Panel>
          <Panel shadow header={caption('侧 · ratio 1')}>
            <RichTextBox text="同样的高度，窄的那一侧。" fontSize={26} maxWidth={420} />
          </Panel>
        </Flow>
      </div>

      {/* 三个孩子 → 三个数写全；缺位与 `[2, 1]` 等价，但那种写法现在会警告 */}
      <div style={{width: 1760, height: 220}}>
        <Flow ratio={[2, 1, 1]} gap={32} sizing="equal">
          <Panel shadow header={caption('A · ratio 2')}>
            <RichTextBox text="第一格。" fontSize={26} maxWidth={520} />
          </Panel>
          <Panel shadow header={caption('B · ratio 1')}>
            <RichTextBox text="第二格。" fontSize={26} maxWidth={400} />
          </Panel>
          <Panel shadow header={caption('C · ratio 1')}>
            <RichTextBox text="第三格。" fontSize={26} maxWidth={400} />
          </Panel>
        </Flow>
      </div>

      <Subtitle
        text="上行 fill（撑满 520）　｜　下行三个孩子 → ratio 写全 [2, 1, 1]（缺位等价，但会报警）"
        align="center"
        maxWidth={1500}
        delayInFrames={24}
      />
    </Scene>
  );
};

/**
 * **皮**（外观预设，T08）—— 三场，回答三件不同的事。
 *
 * ⚠️ 这三场与别的场景有一处不同：**它们演示的不是一个原语，而是一套机制**。
 * 所以判据也不同 —— 不看「好不好看」，看这三件能不能被当场指出来：
 *
 *   ① **预设可枚举**：同一个 `<Panel>`、同一段内容，`skin` 换成另一个 id 就是另一张卡；
 *   ② **皮不管内容**：长短两段内容走同一张皮，差异只来自内容；
 *   ③ **默认值可被实例覆盖**：皮的圆角是**默认**，`radius` 一说就盖住；
 *      而**标量**（描边粗细）根本不进皮表 —— 它本来就该由实例给。
 *
 * ⚠️ 主题切换在这三场上是**免费**的：展示页把整面墙套在同一个 provider 里，
 * 所以换主题时这三格跟着换 —— 皮的形状不动、主题的色与字在动，两件事互不抢。
 * 这正是架构基线 §9.1 那条「不许变成两个都能改颜色」要的可见证据。
 */
const SkinPresetsScene: React.FC = () => {
  const theme = useTheme();

  const caption = (text: string) => (
    <span style={{fontFamily: theme.font.mono, fontSize: 22, color: theme.color.muted}}>
      {text}
    </span>
  );

  return (
    <Scene grid contentStyle={{alignItems: 'center'}}>
      {/* 两张卡**同宽同高**（同一段内容，宽都写死 840）—— 这一场要比的是长相，不是尺寸。
          ⚠️ 不给外层固定高度：`sizing="equal"` 要的是一个**能被撑开**的组，
          给死 520 会让两张卡吊在一大块空白的上沿（实测踩过）。 */}
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 40}}>
        <Panel width={840} header={caption('skin 省略 = plain（＝现状）')}>
          <RichTextBox text={MOCK_PANEL_SHORT} fontSize={26} maxWidth={760} />
        </Panel>
        <Panel skin="corner-marks" width={840} header={caption('skin="corner-marks"')}>
          <RichTextBox text={MOCK_PANEL_SHORT} fontSize={26} maxWidth={760} />
        </Panel>
      </div>

      <Subtitle
        text="同一段内容、同一个 Panel：右边这张在皮表里只写了两项 —— 直角 ＋ 四角角标"
        align="center"
        maxWidth={1500}
        delayInFrames={20}
      />
    </Scene>
  );
};

const SkinContentScene: React.FC = () => {
  const theme = useTheme();

  const caption = (text: string) => (
    <span style={{fontFamily: theme.font.mono, fontSize: 22, color: theme.color.muted}}>
      {text}
    </span>
  );

  return (
    <Scene grid contentStyle={{alignItems: 'center'}}>
      {/* 刻意**不用 `Flow`**：框高要跟内容走（长短不同 → 高矮不同），
          而 `Flow` 会给轨道确定高度，那就成了「等高」—— 这一场要看的是它**不**等高 */}
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 40}}>
        <Panel skin="corner-marks" width={820} header={caption('短内容 · 3 行')}>
          <RichTextBox text={MOCK_PANEL_SHORT} fontSize={26} maxWidth={700} />
        </Panel>
        <Panel skin="corner-marks" width={820} header={caption('长内容 · 整页')}>
          <RichTextBox text={MOCK_PANEL_TALL} fontSize={26} maxWidth={700} />
        </Panel>
      </div>

      <Subtitle
        text="同一张皮、不同长度的内容 —— 皮碰不到内容，框高仍然跟内容走"
        align="center"
        maxWidth={1500}
        delayInFrames={20}
      />
    </Scene>
  );
};

const SkinOverrideScene: React.FC = () => {
  const theme = useTheme();

  const caption = (text: string) => (
    <span style={{fontFamily: theme.font.mono, fontSize: 20, color: theme.color.muted}}>
      {text}
    </span>
  );

  return (
    <Scene grid contentStyle={{alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 40}}>
        <Panel skin="corner-marks" width={540} header={caption('① 皮的原样')}>
          <RichTextBox text={MOCK_PANEL_SHORT} fontSize={24} maxWidth={460} />
        </Panel>
        {/* 皮的 `radius: 'square'` 是**默认值** —— 实例一说就盖住 */}
        <Panel skin="corner-marks" radius={24} width={540} header={caption('② radius={24}')}>
          <RichTextBox text={MOCK_PANEL_SHORT} fontSize={24} maxWidth={460} />
        </Panel>
        {/* 「1px 细线」是**标量**，按 §9.2 归实例，不进皮表 */}
        <Panel skin="corner-marks" borderWidth={1} width={540} header={caption('③ borderWidth={1}')}>
          <RichTextBox text={MOCK_PANEL_SHORT} fontSize={24} maxWidth={460} />
        </Panel>
      </div>

      <Subtitle
        text="皮的差异项是默认值：② 用 radius 盖住了皮的直角；③ 里「1px 细线」是标量，由实例给 —— 它不进皮表"
        align="center"
        maxWidth={1680}
        delayInFrames={20}
      />
    </Scene>
  );
};

/**
 * kit-core 的演示合成 —— 同时是**组件层渲染验证**用的合成。
 *
 * 它把套件里每个组件都摆了一遍。改完任何组件后，对每个场景中点各出一张单帧，
 * 就能看出动效有没有真的动起来：
 *
 *   npx remotion still KitShowcase out/kit-1.png --frame=30
 *   npx remotion still KitShowcase out/kit-5.png --frame=270
 *   npx remotion still KitShowcase out/kit-6.png --frame=330
 *   npx remotion still KitShowcase out/kit-7.png --frame=420
 *   npx remotion still KitShowcase out/kit-8.png --frame=550
 *   npx remotion still KitShowcase out/kit-9.png --frame=648
 *   npx remotion still KitShowcase out/kit-10.png --frame=690
 *   npx remotion still KitShowcase out/kit-11.png --frame=755
 *   npx remotion still KitShowcase out/kit-12.png --frame=805
 *   npx remotion still KitShowcase out/kit-12b.png --frame=815   ← 原位替换之后（窗口收紧了）
 *   npx remotion still KitShowcase out/kit-13.png --frame=870
 *   npx remotion still KitShowcase out/kit-14.png --frame=930
 *   npx remotion still KitShowcase out/kit-15.png --frame=990
 *   npx remotion still KitShowcase out/kit-16.png --frame=1050
 *   npx remotion still KitShowcase out/kit-17.png --frame=1110
 *   npx remotion still KitShowcase out/kit-18.png --frame=1170
 *
 * 颜色 / 字族全部取自 `useTheme()`（未套母版时是默认主题 `default-dark`）。
 * 组件的**字号**仍是调用处内联的值 —— 那是 Studio 可编辑性换来的代价，见 `Title`。
 *
 * 1920x1080 / 30fps / **1200 帧（40 秒）**：前四个场景各 60 帧，两个大媒体框各 60 帧，
 * 迷你框群 150 帧（3 个框 × 50 帧），滚动区 90 帧，
 * 标签 / 富文本框 / 条形图 / 内容卡各 60 帧，大数字两场（计数到 + 跳动 / 数位滚动）各 60 帧，
 * 排列一场（Scene 15：比例 / 三档尺寸 / `ratio` 缺位对照）60 帧，
 * 皮三场（Scene 16–18：预设对照 / 长短内容 / 局部覆盖）各 60 帧。
 * ⚠️ 帧数是**加出来的**，改任何一场都要连着改两处：这里，与 `Root.tsx` 的
 * `durationInFrames={1200}`（写小了会让展示页末尾几格被静默夹帧，见 `showcase/README.md`）。
 */
export const KitShowcase: React.FC = () => {
  const theme = useTheme();

  return (
    <AbsoluteFill style={{backgroundColor: theme.color.bg}}>
      <Sequence from={0} durationInFrames={60} premountFor={30} name="Scene 1 — heading">
        <Scene grid>
          <SectionHeading index="01" title="套件演示" />
          <Title
            text="写代码，然后等渲染"
            fontSize={96}
            color={theme.color.ink}
            delayInFrames={8}
          />
          <Subtitle
            text="这两件事最慢。复用组件把第一件压掉，渲染配置档压第二件。"
            delayInFrames={16}
          />
        </Scene>
      </Sequence>

      <Sequence from={60} durationInFrames={60} premountFor={30} name="Scene 2 — reveal">
        <Scene align="center">
          <TextReveal
            lines={['逐行揭示', '每行装在遮罩里', '向上推出']}
            fontSize={80}
            delayInFrames={6}
          />
        </Scene>
      </Sequence>

      <Sequence from={120} durationInFrames={60} premountFor={30} name="Scene 3 — emphasis">
        <Scene grid vignette>
          <div
            style={{
              fontFamily: theme.font.family,
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.4,
              color: theme.color.ink,
            }}
          >
            最慢的两件事是{' '}
            <Emphasis kind="highlight" color={theme.color.accent} delayInFrames={10}>
              写代码
            </Emphasis>{' '}
            和{' '}
            <Emphasis kind="underline" color={theme.color.accent} delayInFrames={20}>
              渲染
            </Emphasis>
          </div>
          <BulletList
            items={['组件复用', '渲染配置档', '抽帧验证']}
            fontSize={40}
            delayInFrames={28}
          />
        </Scene>
      </Sequence>

      <Sequence from={180} durationInFrames={60} premountFor={30} name="Scene 4 — quote">
        <Scene align="bottom">
          <Quote
            text="复用组件省掉的是编写时间，配置档省掉的是等待时间。"
            attribution="kit-core"
            fontSize={52}
            delayInFrames={4}
          />
          <Progress />
        </Scene>
      </Sequence>

      {/* 大媒体框 + **静态内容**（`src` 走 `<Img>`，不是 children 那条退路） */}
      <Sequence from={240} durationInFrames={60} premountFor={30} name="Scene 5 — media stage, still">
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <MediaStage
            src={mockShot(1)}
            kind="image"
            label={mockLabel(1)}
            source={mockSource(1)}
          />
        </AbsoluteFill>
      </Sequence>

      {/* 大媒体框 + **视频**（`kind: 'video'` 走 `<OffthreadVideo>`） */}
      <Sequence from={300} durationInFrames={60} premountFor={30} name="Scene 6 — media stage, video">
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <MediaStage
            src={demoClip}
            kind="video"
            label="演示片段"
            source="自渲染 · 60 帧"
            fit="contain"
          />
        </AbsoluteFill>
      </Sequence>

      {/* 迷你框群：依次展开 —— `focus` 是驱动量，缓动在调用方（这里） */}
      <Sequence from={360} durationInFrames={150} premountFor={30} name="Scene 7 — media cards">
        <MediaCards />
      </Sequence>

      {/* 滚动区：钉住的标题栏 + 会滚的正文 —— `scroll` 是驱动量，缓动在调用方（这里） */}
      <Sequence from={510} durationInFrames={90} premountFor={30} name="Scene 8 — scroll area">
        <ScrollScene />
      </Sequence>

      {/* 标签：四种分量摆成一排 —— 标签自己没有盒子，**成排才是它的常态**。
          `delayInFrames` 逐枚内联（错开是这一排的排版，不是组件的事）。 */}
      <Sequence from={600} durationInFrames={60} premountFor={30} name="Scene 9 — text tags">
        <Scene grid contentStyle={{alignItems: 'center'}}>
          <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18}}>
            <TextTag text="已证实" tone="solid" fontSize={34} />
            <TextTag text="高危" tone="tint" fontSize={34} delayInFrames={6} />
            <TextTag text="本地打包" tone="outline" fontSize={34} delayInFrames={12} />
            <TextTag text="传闻" tone="muted" fontSize={34} delayInFrames={18} />
          </div>
          <Subtitle
            text="标签是短的：两三个字到六七个字。四种分量从实底到中性，混用才对。"
            align="center"
            delayInFrames={24}
          />
        </Scene>
      </Sequence>

      {/* 富文本框：三种标记 + 分段，外加 `box` 的两条分支各来一个 */}
      <Sequence from={660} durationInFrames={60} premountFor={30} name="Scene 10 — rich text box">
        <Scene align="center" contentStyle={{alignItems: 'center'}}>
          <RichTextBox text={MOCK_RICH} fontSize={44} />
          <RichTextBox
            text="**框**是可选的 —— 开了只加一层描边与内边距，底色默认透明。"
            fontSize={34}
            box
            delayInFrames={10}
          />
        </Scene>
      </Sequence>

      {/* 条形图：末行是**测不出数**的那条 —— 数值列显示原文、条长 0（诚实回退，不是 bug） */}
      <Sequence from={720} durationInFrames={60} premountFor={30} name="Scene 11 — bar chart">
        <Scene align="center" contentStyle={{alignItems: 'center'}}>
          <div style={{width: 1180}}>
            <BarChart
              items={MOCK_BARS_WITH_GAP}
              fontSize={34}
              barHeight={26}
              gap={26}
              labelWidth={340}
              valueWidth={170}
              unit="s"
              decimals={1}
            />
          </div>
        </Scene>
      </Sequence>

      {/* 内容卡：一长一短并排 + 强调态切换 —— 框高跟内容走，翻页是硬切 */}
      <Sequence from={780} durationInFrames={60} premountFor={30} name="Scene 12 — panel">
        <PanelScene />
      </Sequence>

      {/* 大数字 · 计数到 + 跳动 —— 两条路都在**调用方**：它只把字符串印出来 */}
      <Sequence from={840} durationInFrames={60} premountFor={30} name="Scene 13 — stat, count-up">
        <StatCountScene />
      </Sequence>

      {/* 大数字 · 数位滚动 —— 组件里唯一一条「知道那是数字」的路 */}
      <Sequence from={900} durationInFrames={60} premountFor={30} name="Scene 14 — digit roll">
        <StatRollScene />
      </Sequence>

      {/* 排列：比例 + 三档尺寸 —— 含一个 ratio 缺位的对照 */}
      <Sequence
        from={960}
        durationInFrames={60}
        premountFor={30}
        name="Scene 15 — flow, ratio & mismatch"
      >
        <FlowScene />
      </Sequence>

      {/* 皮（T08）：预设对照 / 长短内容 / 局部覆盖 —— 三场各回答一件事 */}
      <Sequence from={1020} durationInFrames={60} premountFor={30} name="Scene 16 — skin, presets">
        <SkinPresetsScene />
      </Sequence>

      <Sequence from={1080} durationInFrames={60} premountFor={30} name="Scene 17 — skin, long & short">
        <SkinContentScene />
      </Sequence>

      <Sequence from={1140} durationInFrames={60} premountFor={30} name="Scene 18 — skin, local override">
        <SkinOverrideScene />
      </Sequence>
    </AbsoluteFill>
  );
};

