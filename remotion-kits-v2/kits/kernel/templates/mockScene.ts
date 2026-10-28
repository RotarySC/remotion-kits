import {createHost} from '../viewport/attach';
import type {Camera, Framing, HostEnv, SceneAdapter, Vec3} from '../viewport/types';

/**
 * **占位夹具**（不是资产、不承诺复用）—— 只为让「三维视图」那一格有东西看，
 * 顺便把契约的每个零件都跑一遍：装载 / 机位 / 取景 / 尺寸 / 释放。
 *
 * 它画的是一个**线框立方体** + 一颗绕着它走的**主体**（红点），用 canvas 2D 手写投影 ——
 * 一根第三方依赖都不引。这样夹具的体积与「被接入的场景」无关：素材多大都行，这里永远只有几 KB。
 *
 * 为什么非要有那个红点：`SceneHost.targetPos` 如果恒定返回原点，`follow` 机位就永远在跟空气 ——
 * 一条没有任何消费者、也没有任何证据的路径。红点让「跟随」有了真目标：
 * 它按 `t` 的闭式运动（周期 4 秒，与立方体自转同周期，所以循环接缝不跳），
 * 并且用**与环境不同的色相**画出来，于是「跟得准不准」可以按像素量，而不是靠眼睛说「大约在中间」。
 *
 * ⚠️ 它**不是**让人照着造 3D 的模板。真素材是作者在 Blender / 网页工具里做好的东西，
 * 由 `viewport/attach.ts` 的移植清单接进来；这个夹具只是「一块能被看的体 + 一个能被跟的物体」。
 */

const D2R = Math.PI / 180;
/** 立方体半边长 */
const R = 0.72;
const CUBE: readonly Vec3[] = [
  [-R, -R, -R], [R, -R, -R], [R, R, -R], [-R, R, -R],
  [-R, -R, R], [R, -R, R], [R, R, R], [-R, R, R],
];
const EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** 主体（红点）的轨道，与立方体自转同周期 —— 两者都在 4 秒回到原位，循环才不跳 */
const SUBJECT_PERIOD = 4;
const SUBJECT_RADIUS = 2.05;
const SUBJECT_HEIGHT = 0.35;
/** 主体刻意用第二色：与环境色分开，人一眼看得出「跟的是谁」，验证也能按像素找它 */
const SUBJECT_COLOR = '#FF3B3B';

/** 主体的世界坐标，`t` 的**闭式**（不做任何累加）。`targetPos` 与绘制共用这一个函数。 */
function subjectPos(t: number): Vec3 {
  const a = (2 * Math.PI * t) / SUBJECT_PERIOD;
  return [Math.sin(a) * SUBJECT_RADIUS, SUBJECT_HEIGHT, Math.cos(a) * SUBJECT_RADIUS];
}

type V = [number, number, number];
const sub = (a: Vec3, b: Vec3): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: V): V => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

type State = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  accent: string;
  /** 眼位 / 注视点。由 `<Viewport>` 每帧下发；夹具把它们当成真的相机用 */
  eye: Vec3;
  look: Vec3;
  framing: Framing;
  /** 最近一次 `advance` 的绝对时间。`targetPos` 只能读它 —— 见该字段的注释 */
  t: number;
};

/** 球坐标机位 → 眼位（与 `cameras.ts` 的约定一致：azimuth 绕 Y，0 = +Z）。 */
function toEye(camera: Camera | undefined, fallback: Vec3): {eye: Vec3; look: Vec3} {
  if (!camera) return {eye: fallback, look: [0, 0, 0]};
  if ('position' in camera) return {eye: camera.position, look: camera.target ?? [0, 0, 0]};
  const ce = Math.cos(camera.elevation * D2R);
  const target = camera.target ?? [0, 0, 0];
  return {
    eye: [
      target[0] + Math.sin(camera.azimuth * D2R) * ce * camera.distance,
      target[1] + Math.sin(camera.elevation * D2R) * camera.distance,
      target[2] + Math.cos(camera.azimuth * D2R) * ce * camera.distance,
    ],
    look: target,
  };
}

/**
 * 世界 → 屏幕。两种取景都支持：`perspective` 用竖直角 `fov`，`orthographic` 用
 * `orthoHeight`（视口在世界单位里的**高度**，所以它翻倍 ⇒ 画面里的东西缩小一半）。
 * 返回 `null` = 在相机背后。
 *
 * 为什么夹具必须两种都实现：它是「契约的每个零件都跑一遍」的那份东西，
 * 只认 `fov` 就等于把 `orthoHeight` 变成无人消费的参数 —— 那样这条契约是**设计过、没验证过**。
 */
function project(
  p: Vec3,
  eye: Vec3,
  look: Vec3,
  framing: Framing,
  w: number,
  h: number,
): {x: number; y: number; z: number} | null {
  const aspect = h > 0 ? w / h : 1;
  const f = unit(sub(look, eye));
  const r = unit(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const rel = sub(p, eye);
  const z = dot(rel, f);
  if (z <= 0.02) return null; // 在相机背后：跳过，别画成镜像
  if (framing.mode === 'orthographic') {
    const oh = framing.orthoHeight ?? 10;
    const kx = w / (oh * aspect);
    const ky = h / oh;
    return {x: w / 2 + dot(rel, r) * kx, y: h / 2 - dot(rel, u) * ky, z};
  }
  const k = 1 / Math.tan(((framing.fov ?? 40) * D2R) / 2);
  const ndcX = ((dot(rel, r) * k) / aspect) / z;
  const ndcY = (dot(rel, u) * k) / z;
  return {x: (ndcX * 0.5 + 0.5) * w, y: (0.5 - ndcY * 0.5) * h, z};
}

function draw(s: State, t: number) {
  const {ctx, canvas} = s;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // 姿态：绕 Y 半圈即与自身重合（立方体亦然），所以 4 秒一个循环接缝不跳
  const spin = Math.PI * (t / 4);
  const tilt = 0.42;
  const rotate = (p: Vec3): Vec3 => {
    // 先绕 X 倾斜，再绕 Y 自转
    const cx = Math.cos(tilt), sx = Math.sin(tilt);
    const y1 = p[1] * cx - p[2] * sx;
    const z1 = p[1] * sx + p[2] * cx;
    const cy = Math.cos(spin), sy = Math.sin(spin);
    return [p[0] * cy + z1 * sy, y1, -p[0] * sy + z1 * cy];
  };

  const pts = CUBE.map((p) => project(rotate(p), s.eye, s.look, s.framing, w, h));

  // 线宽按**缓冲区**像素给：展示页的格子可能只有一两百 CSS 像素宽，
  // 按设计尺寸写 1px 会在缩放下变成 0.2px，看起来像没有画（实测过）。
  ctx.lineWidth = Math.max(3, w / 140);
  ctx.lineCap = 'round';
  ctx.strokeStyle = s.accent;

  // 近大远小：越远的棱越淡，画面才有前后关系（只用几何算，不读像素）
  const zs = pts.map((p) => (p ? p.z : 0));
  const zMin = Math.min(...zs.filter((z) => z > 0));
  const zMax = Math.max(...zs);
  for (const [a, b] of EDGES) {
    const pa = pts[a];
    const pb = pts[b];
    if (!pa || !pb) continue;
    const depth = (pa.z + pb.z) / 2;
    const near = zMax > zMin ? 1 - (depth - zMin) / (zMax - zMin) : 1;
    ctx.globalAlpha = 0.28 + 0.72 * near;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 主体：实心圆点。用 `t` 的闭式位置，所以它既是「被画的物」也是「被跟随的目标」，
  // 两者永远一致 —— 跟随偏了就是机位的问题，不会赖到「目标读错」上。
  const sp = project(subjectPos(t), s.eye, s.look, s.framing, w, h);
  if (sp) {
    ctx.fillStyle = SUBJECT_COLOR;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, Math.max(5, w / 100), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 给展示页用的夹具适配器。 */
export const mockScene: SceneAdapter = (env: HostEnv) =>
  createHost(env, {
    label: 'mock-scene',
    build: (e) => {
      const ctx = e.canvas.getContext('2d');
      if (!ctx) {
        throw new Error('拿不到 2D 上下文');
      }
      return {
        ctx,
        canvas: e.canvas,
        accent: e.accent ?? '#5B8CFF',
        eye: [2.4, 1.7, 3.0] as Vec3,
        look: [0, 0, 0] as Vec3,
        framing: {mode: 'perspective', fov: 40} as Framing,
        t: 0,
      } satisfies State;
    },
    advance: (s, t) => {
      s.t = t;
      draw(s, t);
    },
    setCamera: (s, camera) => {
      const {eye, look} = toEye(camera, s.eye);
      s.eye = eye;
      s.look = look;
    },
    setFraming: (s, framing) => {
      s.framing = framing;
    },
    resize: (s, width, height) => {
      // canvas 的 width / height 由 `<Viewport>` 设；这里只需要重画一次
      s.canvas.style.width = width + 'px';
      s.canvas.style.height = height + 'px';
    },
    // 活目标。调 `targetPos` 之前调用方已经 `advance(at)` 过，所以这里读 `s.t` 就是「那一帧」，
    // 不许自己再存一份位置（那会变成缓存，跟随就会晚一拍）。
    targetPos: (s, name) => {
      if (name === 'subject') return subjectPos(s.t);
      if (name === 'center') return [0, 0, 0] as Vec3;
      return null;
    },
    dispose: (s) => {
      s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
    },
  });
