import {ease, type Ease} from './easing';
import {resolveShots, type ShotListSpec} from './shots';
import type {Camera, CameraCtx, TargetLookup, Vec3} from './types';

export {ease};
export type {Ease};

/**
 * **机位库** —— 全部是 `t` 的纯函数，没有一帧状态。
 *
 * 为什么不用「每帧朝目标挪一点」那种阻尼：那样机位就依赖调用历史，
 * 于是**序列里的第 N 帧**与**单帧抽图**必然不同（前者的画面受前 N-1 帧影响）。
 * 这里所有平滑都改成**闭环采样**：在 `t`、`t-dt`、`t-2dt`… 上取目标位置再加权平均 ——
 * 仍然是 `t` 的闭式，所以任意帧可以直接跳。
 *
 * 描述符是**纯 JSON**（能在 Studio 的 props 面板里编辑、能 `--props` 传）：
 *
 *   {kind:'static',  position:[x,y,z], target:[x,y,z]}
 *   {kind:'crane',   target:[x,y,z], from:{azimuth,elevation,distance}, to:{…}, ease?, start?, end?}
 *   {kind:'orbit',   center:[x,y,z], radius, height, fromDeg, toDeg, ease?, start?, end?}
 *   {kind:'dolly',   from:[x,y,z], to:[x,y,z], target:[…], ease?, start?, end?}
 *   {kind:'keyframes', keys:[{t, position, target}, …], ease?}
 *   {kind:'cut',     segments:[{until, camera:<spec>}, …]}      ← 段内连续，交界处**故意**跳一次
 *   {kind:'follow',  cue:'b1', mode:'world'|'radial', offset:[x,y,z], lag?, samples?}
 *   {kind:'shots',   subject:{center,size}, shots:[{id,duration,view,framing,move?,transition?}]}  ← 分镜，见 shots.ts
 *
 * 角度单位是**度**（写 JSON 时比弧度好读），内部再转。
 * `start` / `end` 单位是**秒**，缺省 = 整段合成。
 */

export type Spherical = {readonly azimuth: number; readonly elevation: number; readonly distance: number};

export type CameraTrack =
  | {readonly kind: 'static'; readonly position: Vec3; readonly target?: Vec3}
  | {
      readonly kind: 'crane';
      readonly target: Vec3;
      readonly from: Spherical;
      readonly to: Spherical;
      readonly ease?: Ease;
      readonly start?: number;
      readonly end?: number;
    }
  | {
      readonly kind: 'orbit';
      readonly center: Vec3;
      readonly radius: number;
      readonly height: number;
      readonly fromDeg: number;
      readonly toDeg: number;
      readonly ease?: Ease;
      readonly start?: number;
      readonly end?: number;
    }
  | {
      readonly kind: 'dolly';
      readonly from: Vec3;
      readonly to: Vec3;
      readonly target: Vec3;
      readonly ease?: Ease;
      readonly start?: number;
      readonly end?: number;
    }
  | {
      readonly kind: 'keyframes';
      readonly keys: readonly {readonly t: number; readonly position: Vec3; readonly target: Vec3}[];
      readonly ease?: Ease;
    }
  | {
      readonly kind: 'cut';
      readonly segments: readonly {readonly until: number; readonly camera: CameraTrack}[];
    }
  | {
      readonly kind: 'follow';
      /** 目标名，由 `SceneHost.targetPos` 解析 */
      readonly cue: string;
      /** `world`：机位 = 目标 + 固定世界偏移（目标在画面里会移动）；`radial`：始终保持同一侧正面视角 */
      readonly mode?: 'world' | 'radial';
      readonly offset?: Vec3;
      /** 秒；>0 = 看目标「之前」的位置（机位比目标慢半拍，长镜头更稳） */
      readonly lag?: number;
      /** 闭环采样数；1 = 不平滑。样本越多越稳，代价是每帧多跑 `samples-1` 次 `advance` */
      readonly samples?: number;
      /** 找不到目标时的兜底注视点（世界坐标），省得黑屏 */
      readonly fallback?: Vec3;
    }
  | ShotListSpec;

const D2R = Math.PI / 180;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);



/** 段落进度：`start` / `end` 缺省 = 整段合成（秒）。 */
function progress(ctx: CameraCtx, start: number | undefined, end: number | undefined, e?: Ease) {
  const s = start ?? 0;
  const e2 = end ?? ctx.durationInFrames / ctx.fps;
  const span = e2 - s;
  const p = span <= 0 ? 1 : clamp01((ctx.t - s) / span);
  return ease(e)(p);
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** 球坐标 → 世界位置（azimuth 绕 Y，0 = +Z 方向）。 */
export function spherical(target: Vec3, azimuthDeg: number, elevationDeg: number, distance: number): Vec3 {
  const az = azimuthDeg * D2R;
  const el = elevationDeg * D2R;
  const ce = Math.cos(el);
  return [
    target[0] + Math.sin(az) * ce * distance,
    target[1] + Math.sin(el) * distance,
    target[2] + Math.cos(az) * ce * distance,
  ];
}

/**
 * 把机位脚本解析成「这一帧的机位」。`lookup` 只在 `follow` 里被调用。
 * 返回 `null` 表示脚本给不出机位（例如空 `keyframes`）—— 调用方沿用宿主默认机位。
 */
export function resolveCamera(spec: CameraTrack, ctx: CameraCtx, lookup: TargetLookup): Camera | null {
  switch (spec.kind) {
    case 'static':
      return {position: spec.position, target: spec.target};

    case 'crane': {
      const p = progress(ctx, spec.start, spec.end, spec.ease);
      return {
        position: spherical(
          spec.target,
          lerp(spec.from.azimuth, spec.to.azimuth, p),
          lerp(spec.from.elevation, spec.to.elevation, p),
          lerp(spec.from.distance, spec.to.distance, p),
        ),
        target: spec.target,
      };
    }

    case 'orbit': {
      const q = progress(ctx, spec.start, spec.end, spec.ease);
      const az = lerp(spec.fromDeg, spec.toDeg, q) * D2R;
      return {
        position: [
          spec.center[0] + Math.sin(az) * spec.radius,
          spec.center[1] + spec.height,
          spec.center[2] + Math.cos(az) * spec.radius,
        ],
        target: spec.center,
      };
    }

    case 'dolly':
      return {
        position: lerp3(spec.from, spec.to, progress(ctx, spec.start, spec.end, spec.ease)),
        target: spec.target,
      };

    case 'keyframes': {
      const keys = spec.keys;
      if (!keys.length) return null;
      const first = keys[0];
      if (ctx.t <= first.t) return {position: first.position, target: first.target};
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        if (ctx.t <= b.t) {
          const span = b.t - a.t;
          const u = span <= 0 ? 1 : (ctx.t - a.t) / span;
          const w = ease(spec.ease)(clamp01(u));
          return {position: lerp3(a.position, b.position, w), target: lerp3(a.target, b.target, w)};
        }
      }
      const last = keys[keys.length - 1];
      return {position: last.position, target: last.target};
    }

    case 'cut': {
      const segments = spec.segments;
      if (!segments.length) return null;
      const hit = segments.find((s) => ctx.t < s.until) ?? segments[segments.length - 1];
      return resolveCamera(hit.camera, ctx, lookup);
    }

    case 'follow': {
      const mode = spec.mode ?? 'radial';
      const offset = spec.offset ?? [0, 3.5, 14];
      const lag = spec.lag ?? 0;
      const samples = Math.max(1, spec.samples ?? 1);
      const fallback = spec.fallback ?? [0, 0.5, 0];

      const at = (t: number): Vec3 => {
        const p = lookup(spec.cue, t);
        return p ?? fallback;
      };
      // 闭环采样：t、t-dt、t-2dt… 用三角权重加权。仍是 t 的纯函数（见文件头）
      let target: Vec3;
      if (samples <= 1) {
        target = at(ctx.t - lag);
      } else {
        const dt = 1 / ctx.fps;
        const acc = [0, 0, 0];
        let wsum = 0;
        for (let k = 0; k < samples; k++) {
          const w = 1 - 0.5 * (k / samples);
          const p = at(ctx.t - lag - k * dt);
          acc[0] += p[0] * w;
          acc[1] += p[1] * w;
          acc[2] += p[2] * w;
          wsum += w;
        }
        target = [acc[0] / wsum, acc[1] / wsum, acc[2] / wsum];
      }

      if (mode === 'radial') {
        // 从场地中心那一侧看过去：水平方向取「目标 → 原点」的反向，高度单独给
        const len = Math.hypot(target[0], target[2]) || 1;
        const horizontal = Math.hypot(offset[0], offset[2]);
        return {
          position: [
            target[0] - (target[0] / len) * horizontal,
            target[1] + offset[1],
            target[2] - (target[2] / len) * horizontal,
          ],
          target,
        };
      }
      return {
        position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]],
        target,
      };
    }

    case 'shots':
      return resolveShots(spec, ctx);

    default:
      return null;
  }
}

/** 是不是一份机位脚本（而不是直给的 `Camera`）。`Camera` 没有 `kind` 字段。 */
export function isCameraTrack(value: Camera | CameraTrack): value is CameraTrack {
  return typeof value === 'object' && value !== null && 'kind' in value;
}
