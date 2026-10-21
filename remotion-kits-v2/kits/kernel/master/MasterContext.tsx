import React, {createContext, useContext} from 'react';

/**
 * 母版几何下发 —— 版式与家具从这里取**内容区尺寸**，而不是层层透传。
 *
 * 主题**不在**这里，主题由 `theme/context.tsx` 下发。分开的理由是职责不同：
 *   - 主题：长相（色板 / 字阶 / 间距 / 动效签名），与画布无关
 *   - 几何：这一帧的内容区可用宽高，随画布尺寸与家具高度变化
 *
 * 版式做溢出护栏测量时需要 `contentWidth`，所以几何必须能取到。
 * 两者都在 `MasterFrame` 里挂上：`ThemeProvider` → `MasterBoxProvider` → `Stage`。
 */

export type MasterBox = {
  /** 画布相对 1080 基准的缩放系数 = `Math.min(width, height) / 1080` */
  readonly scale: number;
  readonly insetX: number;
  readonly insetY: number;
  /** 内容区可用宽度 = 画布宽 − 左右安全区 */
  readonly contentWidth: number;
  /** 内容区可用高度 = 画布高 − 上下安全区 − 家具预留 */
  readonly contentHeight: number;
};

const MasterBoxContext = createContext<MasterBox>({
  scale: 1,
  insetX: 80,
  insetY: 100,
  contentWidth: 1920 - 160,
  contentHeight: 1080 - 200,
});

export const MasterBoxProvider: React.FC<{
  readonly box: MasterBox;
  readonly children: React.ReactNode;
}> = ({box, children}) => {
  return <MasterBoxContext.Provider value={box}>{children}</MasterBoxContext.Provider>;
};

/** 当前母版几何。未套母版时返回按 1920x1080 估算的值 */
export const useMasterBox = (): MasterBox => useContext(MasterBoxContext);
