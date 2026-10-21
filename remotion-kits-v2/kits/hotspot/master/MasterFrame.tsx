import React from 'react';
import {MasterFrame as KernelMasterFrame} from '../../kernel/master/MasterFrame';
import type {Theme} from '../../kernel/theme/types';
import {THEMES, THEME_IDS} from '../theme';
import {EventStamp} from './furniture/EventStamp';
import {SourceBadge} from './furniture/SourceBadge';
import type {FurnitureConfig} from './types';

type Props = {
  readonly children: React.ReactNode;
  /** 换主题只需换这个 prop；版式与家具不用改一行 */
  readonly theme?: Theme;
  readonly furniture?: FurnitureConfig;
  readonly background?: string;
  readonly grid?: boolean;
  readonly vignette?: boolean;
  readonly contentStyle?: React.CSSProperties;
};

/**
 * 母版引擎 —— **本类型包的适配器**，不是内核母版的另一份实现。
 *
 * 内核的母版引擎不认识 `eventStamp` / `source`：它只提供两条家具带和两个**通用插槽**
 * （`headExtra` / `footExtra`）。本套件那两件家具在这里被渲染成插槽内容送进去。
 *
 * 为什么要有这一层，而不是让调用方自己写 `<EventStamp>`：
 * 调用方的接口得是**稳定的** —— 它给的是数据（`furniture={{eventStamp: {…}}}`），
 * 不该被要求知道内核的插槽长什么样、也不该被要求 import 家具组件。
 * 于是「内核不认识类型专属家具」与「调用方不感知内核插槽」两件事同时成立。
 *
 * 这也是架构基线 §10.1 说的「类型包中的差异通过**扩展或组合**表达」——
 * 这里就是组合：内核的引擎 + 本套件的两件家具。
 *
 * 逻辑只有一份：带高预留、给家具让位、缩放基准全在内核那份里，这一层一个字都不重复。
 */
export const MasterFrame: React.FC<Props> = ({
  furniture,
  theme = THEMES[THEME_IDS[0]],
  ...rest
}) => {
  const {eventStamp, source, ...kernelFurniture} = furniture ?? {};

  return (
    <KernelMasterFrame
      {...rest}
      theme={theme}
      furniture={{
        ...kernelFurniture,
        headExtra: eventStamp ? <EventStamp {...eventStamp} /> : undefined,
        footExtra: source ? (
          <SourceBadge name={source.name} credibility={source.credibility} />
        ) : undefined,
      }}
    />
  );
};
