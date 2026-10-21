import React from 'react';
import {Sequence, useCurrentFrame} from 'remotion';
import {ClosingLayout} from '../master/layouts/ClosingLayout';
import {CoverLayout} from '../master/layouts/CoverLayout';
import {HeadlineLayout} from '../master/layouts/HeadlineLayout';
import {ListLayout} from '../master/layouts/ListLayout';
import {QuoteLayout} from '../master/layouts/QuoteLayout';
import {StatLayout} from '../master/layouts/StatLayout';
import {SLOT_SEP} from '../master/slots';
import type {FurnitureConfig} from '../master/types';

/**
 * 演示内容 —— **母版演示与主题演示共用同一份**。
 *
 * 这是「换主题不换版式」这件事的对照组：内容完全一样、版式调用完全一样，
 * 唯一变量是 `<MasterFrame theme={...}>`。
 * 所以本文件**不许 import 任何主题**，也不许出现色值、字体名、字号。
 */

/** 每个版式占用的帧数 */
export const SHOWCASE_SCENE_FRAMES = 60;

/**
 * `list` 的八条最坏情况内容 —— **第一遍与第三遍共用同一份**。
 *
 * 共用是刻意的：第三遍是「显式节奏」那张对照，要和第一遍**只差一个变量**
 * （`staggerInFrames`）。两边各写一份迟早会漂成不可比的两套内容，
 * 那时候抽出来的两张图差在哪就说不清了。
 */
const EIGHT_ITEMS = [
  '第一条：短',
  '第二条：长度中等的条目，用于验证字号自适应',
  '第三条：这一条刻意写得比其余条目都长，用来确认清单不会溢出内容区',
  '第四条：短',
  '第五条：中等长度的一条',
  '第六条：短',
  '第七条：又一个较长的条目，检查多条目时的行距收敛',
  '第八条：短',
] as const;

/**
 * 演示里按顺序用到的版式 —— 抽帧清单也按它来。
 *
 * `list` 出现**三次**，每一次都在演练一条别的路走不到的分支：
 *
 * 1. **第一遍（`from=120`）** —— 条目**不带**主字段；
 * 2. **第二遍（`from=360`）** —— 条目**带**主字段（`'主字段\t说明'`）。
 *    只演练一条，另一条就是静默的：`ListLayout` 漏解析 TAB 那个缺陷，
 *    正是因为夹具里从来没有带主字段的条目，才在展示页里完全看不见
 *    （最后是真实片子的抽帧抓到的）。
 * 3. **第三遍（`from=420`）** —— **显式节奏 × 短场景**（设计文档 2026-10-03 §5.2
 *    要求的常驻对照）。与第一遍内容逐字相同、只多一个 `staggerInFrames={40}`。
 *
 * **新增一律追加在末尾、不插在中间** —— 这样前面所有场景的帧号一个都不动，
 * `MasterShowcase.tsx` 与 `kit.md` 里已记录的抽帧帧号继续有效。
 * 夹具的顺序本来就不承载叙事，不值得为「相邻」去重排整卷。
 */
export const SHOWCASE_LAYOUTS = [
  'cover',
  'headline',
  'list',
  'stat',
  'quote',
  'closing',
  'list',
  'list',
] as const;

export const SHOWCASE_TOTAL_FRAMES = SHOWCASE_LAYOUTS.length * SHOWCASE_SCENE_FRAMES;

/**
 * 固定家具的内容。**故意用最坏情况文案**（长报头名、长期号），
 * 让护栏与家具高度在抽帧里真的被压一遍。
 */
export const useShowcaseFurniture = (): FurnitureConfig => {
  const frame = useCurrentFrame();
  const total = SHOWCASE_LAYOUTS.length;

  return {
    masthead: {title: '夜读日报', meta: '第 042 期 · 2026-09-19'},
    footer: {
      left: '来源：内部整理',
      right: '内容自述',
      progress: {
        current: Math.min(total, Math.floor(frame / SHOWCASE_SCENE_FRAMES) + 1),
        total,
      },
    },
  };
};

/** 八个场景（`list` 演练三次：不带主字段 / 带主字段 / 显式节奏），全部用**最坏情况内容** */
export const ShowcaseScenes: React.FC = () => {
  return (
    <>
      <Sequence from={0} durationInFrames={60} premountFor={30} name="cover">
        <CoverLayout
          kicker="今日必读"
          title="主编推荐：这一期为什么值得从头看到尾"
          meta="2026-09-19 · 共 6 版"
        />
      </Sequence>

      <Sequence from={60} durationInFrames={60} premountFor={30} name="headline">
        <HeadlineLayout
          index="01"
          title="封面文章标题故意写得很长，用来验证三行以内能不能放下"
          summary="摘要同样写到最坏情况：这段话故意拉长，目的是让截断护栏在三行处真的生效，而不是看起来恰好放得下。真实内容只会更短。"
        />
      </Sequence>

      <Sequence from={120} durationInFrames={60} premountFor={30} name="list (no main field)">
        <ListLayout title="今日八条" items={EIGHT_ITEMS} />
      </Sequence>

      <Sequence from={180} durationInFrames={60} premountFor={30} name="stat">
        <StatLayout
          value="1,284,730,915"
          unit="次"
          label="本期全平台阅读量"
          note="备注写到两行，用来验证截断护栏在上限处生效，而不是把版面顶开。"
        />
      </Sequence>

      <Sequence from={240} durationInFrames={60} premountFor={30} name="quote">
        <QuoteLayout
          text="模板的价值不在于它替你做了决定，而在于它把不该每天重新决定的东西一次定死。"
          attribution="—— 母版契约第 1 节"
        />
      </Sequence>

      <Sequence from={300} durationInFrames={60} premountFor={30} name="closing">
        <ClosingLayout title="明天同一时间，第 043 期" meta="订阅 / 反馈 / 投稿" />
      </Sequence>

      {/*
        `list` 第二遍：条目**带主字段**。

        这是 `lines` 槽的另一条分支，也是**最容易坏**的那条 —— 消费方必须调 `splitEntry`
        把 TAB 拆开，否则 HTML 会把 TAB 塌缩成一个空格，主字段与说明的区别直接消失。
        主字段长度刻意不一致（2 字 / 5 字 / 1 字 / 5 字），用来压主字段列的宽度对齐。
      */}
      <Sequence from={360} durationInFrames={60} premountFor={30} name="list (main field)">
        <ListLayout
          title="带主字段的清单"
          items={[
            `主字段一${SLOT_SEP}短`,
            `第二个主字段${SLOT_SEP}长度中等的说明，用来验证分栏之后正文列的字号自适应`,
            `三${SLOT_SEP}这一条刻意写得比其余条目都长，用来确认带主字段时清单不会溢出内容区`,
            `第四个主字段${SLOT_SEP}又一个较长的条目，检查主字段宽度不一致时两列的对齐`,
          ]}
        />
      </Sequence>

      {/*
        `list` 第三遍：**显式节奏 × 短场景**（设计文档 2026-10-03 §5.2 要求常驻的那张对照）。

        与第一遍（`from=120`，不给 `staggerInFrames`）**内容逐字相同、只差一个 prop**，
        所以要对比就把两场的**同一相对帧**抽出来看：

          npx remotion still MasterShowcase out/m-170.png --frame=170   # 默认节奏
          npx remotion still MasterShowcase out/m-470.png --frame=470   # 显式 40（同一相对帧）

        两张应当**明显不同** —— 默认那一帧八条全在，显式 40 时第 50 帧只出得来第一条。
        抽帧帧号之所以照旧有效：新场景**追加在末尾**，前面七场一个都没动。
        ⚠️ 标题直接写清它是什么，因为这个场景存在的意义就是「给抽帧看」，不是给人欣赏。
      */}
      <Sequence
        from={420}
        durationInFrames={60}
        premountFor={30}
        name="list (explicit stagger)"
      >
        <ListLayout
          title="显式节奏 40 × 60 帧场景"
          items={EIGHT_ITEMS}
          staggerInFrames={40}
        />
      </Sequence>
    </>
  );
};
