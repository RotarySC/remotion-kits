import {ease, type Ease} from './easing';
import type {Camera, CameraCtx, Vec3} from './types';

/**
 * **分镜（`shots`）** —— 「有建模、缺镜头」时补的那一层。
 *
 * 输入是**一个主体**（中心 + 世界尺寸）与几张**镜头**（构图 / 运动 / 时长 / 怎么接），
 * 输出是每一帧的机位。产物是**纯 JSON**：不碰几何、不碰材质、不碰渲染器 ——
 * 它只回答「这一秒从哪儿看、看多大、要不要切」。
 *
 * ## 一条从真实素材学来的规矩：构图用**世界单位**声明，不用屏幕百分比
 *
 * 屏幕百分比要绕透视（近大远小）：同一个「占 60%」在不同距离上是两个机位。
 * 反过来，声明「主体投影高度 = 画面高度的 0.6」是**关于画面**的，而画面由 fov + 画幅比决定 ——
 * 于是距离可以反解，而且换画幅比不会把构图毁掉。
 *
 * 这份解法在 `assets/枪械建模/src/scene/camera.js` 里已经用了一次（它声明的是
 * `frame: {w:392, h:252}`「主体深度处画面要覆盖多大」，再由竖直 fov 反解距离，
 * 并且是照参考图量出来的 71.5% / 71.4%）。这里把它抽成通用形态：声明 `fill`，算距离。
 *
 * ## 为什么距离要**迭代**求，而不是一步算完
 *
 * 一阶解把主体当成「过中心、垂直于视线的平面」，于是透视下近端偏大 —— 立方体 1.44 商
 * 在距离 3.6 上实测差 **3–10%**。所以这里先给一阶解，再按「投影出来到底多大」迭代几轮，
 * 收敛到**声明的占比真的出现在画面上**。迭代是纯数学（投影 8 个角），不需要渲染。
 */

const D2R = Math.PI / 180;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type V = [number, number, number];
const sub = (a: Vec3, b: Vec3): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: V): V => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const lerp3 = (a: Vec3, b: Vec3, k: number): V => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/**
 * 主体。**世界坐标的中心 + AABB 尺寸**（宽 / 高 / 深，世界单位）。
 *
 * 为什么不是「半径」：片子里常见的主体是长方形的（枪、机器、楼、人），
 * 用球半径会让构图在某个方向上永远留一大片空。
 */
export type ShotSubject = {
  readonly center: Vec3;
  readonly size: Vec3;
};

/** 从哪儿看。角度单位是**度**，与 `cameras.ts` 的机位脚本一致。 */
export type ShotView = {
  /** 方位角：绕 Y 转，0 = 从 +Z 方向看过去 */
  readonly azimuth: number;
  /** 仰角：正 = 从上方俯看 */
  readonly elevation: number;
};

/** 看多大。 */
export type ShotFraming = {
  /**
   * 主体的**投影高度**占画面高度的比例（0.6 = 占六成）。取值 (0, 1]。
   * 宽度任何时候都不许溢出画面：真装了不下会退让（高度占比随之变小）。
   */
  readonly fill: number;
  /** 主体中心相对画面中心的偏移（±1 = 到画面边缘）。`+x` 向右、`+y` 向上 */
  readonly shift?: {readonly x: number; readonly y: number};
};

/** 一个镜头。 */
export type Shot = {
  /** 名字。镜头表靠它对上「第几镜」，也是校验与挑选时的键 */
  readonly id: string;
  /** 这一镜多少秒 */
  readonly duration: number;
  /**
   * 这一镜的取景对象；省略 = 用镜头表的 subject。
   * 特写镜头要框的是**局部**（窗、门廊、枪口），全景要框的是整体 —— 一个 subject 覆盖不了。
   */
  readonly subject?: ShotSubject;
  /** 起始视角 */
  readonly view: ShotView;
  readonly framing: ShotFraming;
  /** 这一镜**之内**怎么动（缺省不动） */
  readonly move?: {
    readonly to: ShotView & {
      /** 运动终点的构图；省略 = 与起点相同（只动视角，不变景别） */
      readonly fill?: number;
    };
    readonly ease?: Ease;
  };
  /**
   * 怎么从**上一镜**接到这一镜。缺省**硬切**。
   * 给了 `frames` 就在这一镜**开头**过渡：从上一镜末尾的姿态过渡到本镜起始姿态。
   */
  readonly transition?: {readonly frames?: number; readonly ease?: Ease};
};

/** 镜头表 —— 就是「制作好的镜头」。 */
export type ShotListSpec = {
  readonly kind: 'shots';
  readonly subject: ShotSubject;
  readonly shots: readonly Shot[];
};

/** 主体指向相机的单位方向（`azimuth` 绕 Y，0 = +Z）。 */
function dirOf(azimuth: number, elevation: number): V {
  const a = azimuth * D2R;
  const e = Math.max(-89, Math.min(89, elevation)) * D2R;
  const ce = Math.cos(e);
  return [Math.sin(a) * ce, Math.sin(e), Math.cos(a) * ce];
}

/** 相机的右 / 上向量 —— 与 `mockScene.ts` 的投影约定一致（f 从相机指向主体）。 */
function axesOf(azimuth: number, elevation: number): {right: V; up: V; forward: V} {
  const forward = mul(dirOf(azimuth, elevation), -1);
  const right = unit(cross(forward, [0, 1, 0]));
  return {right, up: cross(right, forward), forward};
}

function corners(subject: ShotSubject): Vec3[] {
  const [w, h, d] = subject.size;
  const out: Vec3[] = [];
  for (const sx of [-0.5, 0.5]) {
    for (const sy of [-0.5, 0.5]) {
      for (const sz of [-0.5, 0.5]) {
        out.push([subject.center[0] + sx * w, subject.center[1] + sy * h, subject.center[2] + sz * d]);
      }
    }
  }
  return out;
}

/** 正交意义上主体在画面的横 / 竖方向各占多少世界单位（过中心、垂直于视线）。 */
export function subjectExtent(subject: ShotSubject, view: ShotView): {width: number; height: number} {
  const {right, up} = axesOf(view.azimuth, view.elevation);
  let w = 0;
  let h = 0;
  for (const c of corners(subject)) {
    const rel = sub(c, subject.center);
    w = Math.max(w, Math.abs(dot(rel, right)));
    h = Math.max(h, Math.abs(dot(rel, up)));
  }
  return {width: w * 2, height: h * 2};
}

/**
 * 给定**一对照位**（眼位 + 注视点），主体投影出来占画面的比例。
 *
 * 为什么要有「相机对」这一版：`shift` 一开，主体就不在光轴上了，离轴投影比
 * 「过中心的平面」大 —— 按居中几何解出来的距离拿到成片上会偏（实测：声明 0.85
 * 只渲出 0.7664，差 30 px）。所以求解必须用**真实的、已偏移的相机**来量。
 */
export function projectedFillCamera(
  subject: ShotSubject,
  position: Vec3,
  target: Vec3,
  fov: number,
  aspect: number,
): {width: number; height: number} {
  const forward = unit(sub(target, position));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const k = 1 / Math.tan((fov * D2R) / 2);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let visible = 0;
  for (const c of corners(subject)) {
    const rel = sub(c, position);
    const z = dot(rel, forward);
    if (z <= 1e-3) {
      continue; // 在相机背后（或几乎贴着镜头）：看不见，不参与测量
    }
    visible++;
    const ndcX = (dot(rel, right) * k) / aspect / z;
    const ndcY = (dot(rel, up) * k) / z;
    minX = Math.min(minX, ndcX);
    maxX = Math.max(maxX, ndcX);
    minY = Math.min(minY, ndcY);
    maxY = Math.max(maxY, ndcY);
  }
  if (visible < 2) {
    return {width: Infinity, height: Infinity}; // 一个角都不在前方：这个距离不是在「看」主体
  }
  return {width: (maxX - minX) / 2, height: (maxY - minY) / 2};
}

/**
 * 给定视角与距离，主体投影出来占画面的比例（相机在光轴上看主体中心）。
 * 这是 `projectedFillCamera` 的简化入口，量测与单测用它就够了。
 */
export function projectedFill(
  subject: ShotSubject,
  view: ShotView,
  distance: number,
  fov: number,
  aspect: number,
): {width: number; height: number} {
  const position = add(subject.center, mul(dirOf(view.azimuth, view.elevation), distance));
  return projectedFillCamera(subject, position, subject.center, fov, aspect);
}

export type SolvedShot = {
  /** 眼位 */
  readonly position: Vec3;
  /** 注视点（`shift` 已算进去） */
  readonly target: Vec3;
  readonly distance: number;
  /** 主体所在深度处，画面覆盖的世界宽 / 高 */
  readonly visible: {width: number; height: number};
  /** 迭代收敛后主体实际占画面的比例 */
  readonly achieved: {width: number; height: number};
};

/**
 * **取景尺**：给定主体、视角、构图，解出机位。
 *
 * 解法分两段，都是**单调一维求根**：
 *   1. 高度：找距离让「投影高度 = fill」；
 *   2. 宽度守卫：若该距离上宽度溢出，就再往远推，直到宽度 = 0.98 画面宽
 *      （这时高度占比**小于**声明值 —— 装不下就得退，这一点写在契约里）。
 *
 * ⚠️ 别用「一阶解 + 按比例乘」那种迭代：主体比距离还宽时会有角跑到相机背后，
 * 投影函数返回 `Infinity`，乘一下距离翻倍、再乘一下又翻回来 —— 实测会震荡到一个
 * 随机的位置（`check-shot-solver.mjs` 的第一版就是这么红的）。二分不会震荡。
 */
export function solveShot(
  subject: ShotSubject,
  view: ShotView,
  framing: ShotFraming,
  options: {fov: number; aspect: number},
): SolvedShot {
  const fill = Math.max(0.01, Math.min(1, framing.fill));
  const fov = options.fov;
  const aspect = options.aspect > 0 ? options.aspect : 1;
  const tanHalf = Math.tan((fov * D2R) / 2);
  const shift = framing.shift ?? {x: 0, y: 0};
  const {right, up} = axesOf(view.azimuth, view.elevation);
  const dir = dirOf(view.azimuth, view.elevation);

  /** 按距离摆出真实的相机（`shift` 已算进去），并量它到底看见多大 */
  const place = (d: number) => {
    const visible = {width: 2 * d * tanHalf * aspect, height: 2 * d * tanHalf};
    // 主体要往右 ⇒ 注视点往左；往上 ⇒ 注视点往下
    const target = add(
      add(subject.center, mul(right, -shift.x * visible.width * 0.5)),
      mul(up, -shift.y * visible.height * 0.5),
    );
    const position = add(target, mul(dir, d));
    return {position, target, visible};
  };
  const measure = (d: number) => {
    const p = place(d);
    return projectedFillCamera(subject, p.position, p.target, fov, aspect);
  };

  // 下界只保证「不是贴着主体中心」，不要求在外接球之外 —— 特写允许相机进到跟前，
  // 那时相机背后的角由 `projectedFillCamera` 跳过，测的是看得见的那部分
  const radius = Math.hypot(subject.size[0], subject.size[1], subject.size[2]) / 2 || 0.001;
  const lo = Math.max(1e-3, radius * 0.05);

  /** 在 [lo, ∞) 上按对数二分：`fraction(d)` 随距离单调递减 */
  const solveDistance = (fraction: (d: number) => number, target: number): number => {
    let hi = Math.max(lo * 2, radius * 4);
    for (let i = 0; i < 64 && fraction(hi) > target; i++) {
      hi *= 2;
    }
    if (!(fraction(hi) <= target)) {
      return hi; // 退到极限也装不下（主体无穷大之类）：给个能用的距离，别返回 NaN
    }
    let a = lo;
    let b = hi;
    for (let i = 0; i < 64; i++) {
      const mid = Math.sqrt(a * b);
      if (fraction(mid) > target) {
        a = mid;
      } else {
        b = mid;
      }
    }
    return Math.sqrt(a * b);
  };

  // 1) 高度 2) 宽度守卫（只放不收）
  let distance = solveDistance((d) => measure(d).height, fill);
  if (measure(distance).width > 0.98) {
    distance = solveDistance((d) => measure(d).width, 0.98);
  }

  const {position, target, visible} = place(distance);
  return {position, target, distance, visible, achieved: measure(distance)};
}

/** 镜头表的**总时长**（秒）。构图长度要等于它，否则最后一镜会被截断。 */
export function shotsDuration(spec: ShotListSpec): number {
  let total = 0;
  for (const shot of spec.shots) {
    total += Math.max(0, shot.duration);
  }
  return total;
}

function poseAt(shot: Shot, p: number): {view: ShotView; fill: number} {
  const move = shot.move;
  if (!move) {
    return {view: shot.view, fill: shot.framing.fill};
  }
  const k = ease(move.ease)(clamp01(p));
  return {
    view: {
      azimuth: lerp(shot.view.azimuth, move.to.azimuth, k),
      elevation: lerp(shot.view.elevation, move.to.elevation, k),
    },
    fill: lerp(shot.framing.fill, move.to.fill ?? shot.framing.fill, k),
  };
}

/**
 * 解析这一帧的机位。**纯函数**：只看 `t` 与镜头表，没有任何跨帧状态。
 *
 * 为什么过渡能做成纯函数：过渡的起点是「上一镜末尾的姿态」，而它是闭式算得出来的
 * （把上一镜的进度钉在 1），不需要记住上一帧画到哪儿。
 */
export function resolveShots(spec: ShotListSpec, ctx: CameraCtx): Camera | null {
  const shots = spec.shots;
  if (!shots.length) {
    return null;
  }
  const fov = ctx.framing?.fov ?? 40;
  const aspect = ctx.aspect && ctx.aspect > 0 ? ctx.aspect : 16 / 9;
  if (ctx.framing?.mode === 'orthographic') {
    // 正交下「距离」不改变大小（大小由 orthoHeight 决定），所以取景尺在这里不成立。
    // 与其悄悄算错，不如按透视解出来给机位、并把话写在契约里（正交分镜待做）。
    console.warn('viewport/shots: 正交取景下的分镜取景尚未实现，按透视解算机位');
  }

  const total = shotsDuration(spec);
  const t = Math.max(0, Math.min(total, ctx.t));

  let start = 0;
  let index = shots.length - 1;
  for (let i = 0; i < shots.length; i++) {
    const end = start + Math.max(0, shots[i].duration);
    if (t < end || i === shots.length - 1) {
      index = i;
      break;
    }
    start = end;
  }

  const shot = shots[index];
  const duration = Math.max(1e-6, shot.duration);
  const progress = clamp01((t - start) / duration);
  const pose = poseAt(shot, progress);
  const subject = shot.subject ?? spec.subject;
  const solved = solveShot(
    subject,
    pose.view,
    {fill: pose.fill, shift: shot.framing.shift},
    {fov, aspect},
  );

  // 过渡：在这一镜的开头，从上一镜的**末尾姿态**平滑过来（硬切时跳过）
  const frames = shot.transition?.frames ?? 0;
  if (index > 0 && frames > 0) {
    const span = frames / Math.max(1, ctx.fps);
    if (t < start + span) {
      const prev = shots[index - 1];
      const prevPose = poseAt(prev, 1);
      const prevSolved = solveShot(
        prev.subject ?? spec.subject,
        prevPose.view,
        {fill: prevPose.fill, shift: prev.framing.shift},
        {fov, aspect},
      );
      const w = ease(shot.transition?.ease)(clamp01((t - start) / span));
      return {
        position: lerp3(prevSolved.position, solved.position, w),
        target: lerp3(prevSolved.target, solved.target, w),
      };
    }
  }

  return {position: solved.position, target: solved.target};
}
