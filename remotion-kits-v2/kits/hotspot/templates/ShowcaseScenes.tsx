/**
 * 热点解析套件的**演示内容** —— 全部用**最坏情况文案**。
 *
 * 母版演示（`MasterShowcase`）与主题演示（`ThemeShowcase`）共用这一份内容，
 * 所以「换主题不换版式」能顺带被验证：同一份内容换个主题跑，逐张对比。
 *
 * ⚠️ **这里只摆本套件自己的三个版式**（`timeline` / `stance` / `multi-stat`）。
 * 内核那 6 个通用版式（`cover` / `headline` / `list` / `stat` / `quote` / `closing`）
 * 由**内核自己的** `ShowcaseScenes` 摆 —— 一份夹具只摆在它所属的那一层，
 * 两边都摆就是「改一处漏一处」。展示页因此分工：内核那一页看通用版式，
 * 本套件这一页看类型专属版式。
 *
 * **夹具的职责是最坏情况，不是最好看**：最长标题、最多条目、最大数字、空的可选槽。
 * 好看的演示内容会掩盖溢出，而溢出正是「固定时长 + 变长内容」的主要死法。
 */

import React from 'react';
import {Sequence, useCurrentFrame} from 'remotion';
import {MultiStatLayout} from '../master/layouts/MultiStatLayout';
import {StanceLayout} from '../master/layouts/StanceLayout';
import {TimelineLayout} from '../master/layouts/TimelineLayout';
import type {FurnitureConfig} from '../master/types';

export const SHOWCASE_SCENE_FRAMES = 60;

/**
 * 演示里按顺序用到的版式。
 * **抽帧清单按它算**：第 i 个版式的末尾帧 = `i × 60 + 56`，中点帧 = `i × 60 + 30`。
 * `multi-stat` 出现两次是有意的 —— 数字**异质**（单位写进数值里）与**同质**（共享 `unit`）
 * 是两条分支，各要一遍。
 *
 * **第二遍一律放在末尾、不紧挨第一遍** —— 这样前面所有场景的帧号一个都不动，
 * `MasterShowcase.tsx` 与 `kit.md` 里已记录的抽帧帧号继续有效。
 * 夹具的顺序本来就不承载叙事，不值得为「相邻」去重排整卷。
 */
export const SHOWCASE_LAYOUTS = ['timeline', 'stance', 'multi-stat', 'multi-stat'] as const;

export const SHOWCASE_TOTAL_FRAMES = SHOWCASE_LAYOUTS.length * SHOWCASE_SCENE_FRAMES;

const CREDIBILITY_ROTATION = ['high', 'medium', 'low'] as const;

/**
 * 固定家具的内容。**故意用最坏情况文案**（长栏目名 + 长元信息 + 满级时间戳），
 * 让两行报头与页脚徽章在抽帧里真的被压一遍。
 *
 * 两件家具都是本类型特有的，经 `MasterFrame` 适配器渲染进内核的通用插槽 ——
 * 这里写的是**数据**，调用方不需要知道内核的插槽长什么样。
 */
export const useShowcaseFurniture = (): FurnitureConfig => {
  const frame = useCurrentFrame();
  const total = SHOWCASE_LAYOUTS.length;
  const sceneIndex = Math.min(total - 1, Math.floor(frame / SHOWCASE_SCENE_FRAMES));

  return {
    masthead: {title: '热点解析', meta: '第 018 期 · 2026-09-19'},
    eventStamp: {
      elapsed: `事件第 ${sceneIndex + 1} 天`,
      updatedAt: '2026-09-18 14:20 更新',
      // 隔一个给一次：抽帧同时覆盖「有阶段标签」与「没有」两种分支
      ...(sceneIndex % 2 === 0 ? {phase: '发酵期'} : {}),
    },
    // 三级轮换：抽帧能一次看到实心 / 描边 / 弱化描边三种徽章
    source: {
      name: '多方公开信息',
      credibility: CREDIBILITY_ROTATION[sceneIndex % CREDIBILITY_ROTATION.length],
    },
    footer: {
      right: '内容自述',
      progress: {current: sceneIndex + 1, total},
    },
  };
};

/** 四个场景，全部用**最坏情况内容** */
export const ShowcaseScenes: React.FC = () => {
  return (
    <>
      <Sequence from={0} durationInFrames={60} premountFor={30} name="timeline">
        <TimelineLayout
          title="事件是怎么走到这一步的"
          events={[
            '09-16 09:12\t一段现场视频在本地社交平台出现，转发量不足百次',
            '09-16 21:40\t两个本地账号转发并附上各自的解读，说法开始出现分歧',
            '09-17 08:05\t当事一方发布书面说明，否认视频里被指认的行为',
            '09-17 15:30\t另一当事方回应，承认接触但否认存在过错，双方说法直接冲突',
            '09-18 10:00\t平台对相关内容加上来源提示，并表示正在核查',
            '09-18 14:20\t监管部门通报已介入，呼吁不要传播未经核实的信息',
          ]}
          note="时间以公开可见的发布时刻为准，不包含私下传播。"
        />
      </Sequence>

      <Sequence from={60} durationInFrames={60} premountFor={30} name="stance">
        <StanceLayout
          topic="争议的核心：那份说明到底有没有正面回应视频里的指认"
          sides={[
            '当事一方\t说明里明确否认了视频中出现的具体行为，但没有解释视频拍摄的时间与场景，只说「与事实不符」。',
            '当事另一方\t认为否认等于回避，指出说明回避了最关键的一点，即当时两人是否在同一地点。',
            '监管部门\t通报只确认已介入核查，没有对任何一方的说法表态，也未给出核查完成的时间表。',
          ]}
          note="三方说法均来自公开渠道原文，此处未作改写。"
        />
      </Sequence>

      {/* multi-stat 第一遍：数字**异质**，单位写进数值里，**不传 `unit`** */}
      <Sequence from={120} durationInFrames={60} premountFor={30} name="multi-stat (heterogeneous)">
        <MultiStatLayout
          label="把四个数字放在一起，能看出这件事还在往上走"
          items={[
            '3,742,918 条\t全网相关讨论量',
            '184,206 个\t参与转发的独立账号数',
            '2 小时 41 分\t从首发到进入公共议题的用时',
            '17.4 条/时\t每小时的讨论增量，仍在上升',
          ]}
          note="统计口径为公开可见的转发与评论，不含私密群组内的传播。"
        />
      </Sequence>

      {/* multi-stat 第二遍：数字**同质**，用共享 `unit` */}
      <Sequence from={180} durationInFrames={60} premountFor={30} name="multi-stat (homogeneous)">
        <MultiStatLayout
          label="三个同口径的数字"
          items={[
            '3,742,918\t全网相关讨论量',
            '184,206\t参与转发的独立账号数',
            '96,540\t带定位信息的那部分转发',
          ]}
          unit="条"
          note="这一遍刻意只放同单位的数字，用来验证 `unit` 分支。"
        />
      </Sequence>
    </>
  );
};
