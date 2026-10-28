import type {Framing} from './types';

/**
 * **取景** —— 「把世界投到这块画布」的那几个数。全部是纯函数，不碰画布、不碰机位。
 *
 * 为什么要单拎出来：同一条 3D 内容在竖屏、16:9、微观放大、四宫格里，
 * 需要的**不是不同的机位**，而是不同的取景。机位回答「从哪儿看」，取景回答「看多大」。
 *
 * ⚠️ 一个从实测里来的限制：**取景由宿主执行**。宿主的相机是不是透视、有没有正交相机，
 * 只有它自己知道 —— 这一层只能把参数算好递进去（`SceneHost.setFraming`），不能替它设。
 * 所以这里的函数给的是**参数**，不是「设好相机」。
 */

/** 画幅比。正方形也返回 1，不会给 0。 */
export function aspectOf(width: number, height: number): number {
  return height > 0 ? width / height : 1;
}

/**
 * 透视相机：让一个半径 `radius` 的球**正好装进垂直视野**所需的距离。
 * `margin` 是留给边缘的余量（1 = 贴边，0.9 = 四边各留 5%）。
 */
export function fitDistance(radius: number, fovDeg: number, margin = 0.9): number {
  const safeMargin = Math.min(0.99, Math.max(0.1, margin));
  const half = (Math.max(1, Math.min(179, fovDeg)) * Math.PI) / 360;
  return radius / (Math.sin(half) * safeMargin);
}

/**
 * 正交相机：让半径 `radius` 的球装进画面所需的**视口高度**（世界单位）。
 * ⚠️ 画幅比 <1（竖屏）时约束在水平方向，所以按 `min(aspect, 1)` 放宽 —— 否则竖屏会切掉两侧。
 */
export function fitOrthoHeight(radius: number, aspect: number, margin = 0.9): number {
  const safeMargin = Math.min(0.99, Math.max(0.1, margin));
  const narrow = Math.min(1, Math.max(0.05, aspect));
  return (2 * radius) / (safeMargin * narrow);
}

/** 把 `Framing` 补成宿主能直接用的完整形态（缺省：透视 40°）。 */
export function normalizeFraming(framing: Framing | undefined): Required<Pick<Framing, 'mode' | 'fov' | 'orthoHeight'>> {
  return {
    mode: framing?.mode ?? 'perspective',
    fov: framing?.fov ?? 40,
    orthoHeight: framing?.orthoHeight ?? 10,
  };
}

/**
 * 缓冲区尺寸 = 设计尺寸 × dpr，但 **dpr 夹在 [1, 2]**：
 * 3D 场景的代价跟像素数成正比，而展示页的格子常常只有两三百 CSS 像素宽 ——
 * 按 3 倍 dp 渲染是在为看不见的像素付钱（B1 实测：1200×675 的缓冲区显示在 211×119 的格子里，过采样 5.7×）。
 */
export function bufferSize(width: number, height: number, dpr: number): {width: number; height: number; dpr: number} {
  const d = Math.min(2, Math.max(1, dpr));
  return {
    width: Math.max(1, Math.round(width * d)),
    height: Math.max(1, Math.round(height * d)),
    dpr: d,
  };
}
