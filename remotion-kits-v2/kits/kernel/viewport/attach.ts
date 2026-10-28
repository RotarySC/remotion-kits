import type {Camera, Framing, HostEnv, SceneHost, Vec3} from './types';

/**
 * **装载外壳** —— 把一个「外部场景」变成 `SceneHost` 的那 40 行。
 *
 * 作者要写的不是这一份，而是它要的那几个零件（`build` / `advance` / `dispose` …）。
 * 外壳只负责三件事：**建一次**、**把绝对时间递进去**、**出错时把话说清楚**。
 *
 * ## 移植清单（这几条都是实测踩出来的，不是猜的）
 *
 * 第 1–3 条**可以机器验证**：接入后跑 `portingAudit(host, {read})`（本文件末尾），
 * 它扫几个不对齐的时刻比对「直接 `advance(t)`」与「回 0 再推进」的读数。
 * 第 4–6 条没有这种判据，只能真渲染一次比对（做法写在 `portingAudit` 的注释里）。
 *
 * 1. **关掉素材自己的时钟**：删掉 / 短路它的 `requestAnimationFrame` 循环，
 *    或让它走「只渲一帧」的分支 —— 否则画面由真实时间驱动，`t` 说了不算。
 *    （港口素材的做法：加 `?still` 查询参数，`start()` 只渲一帧。）
 * 2. **暴露绝对时间的推进口**：`advance(t) = 跑一遍 updater + 画一帧`。
 *    ⚠️ 若素材里存在**按 `dt` 累加**的积分器（港口是云的水平漂移），必须改成 `t` 的闭式，
 *    否则同一 `t` 两次渲染结果不同 —— 严格说不算「能重放」。
 * 3. **补上只在循环里做的事**：有些 uniform 只在 rAF 循环里被赋值（港口是水面倒影的时间），
 *    单帧分支漏掉它，抽图与播放就不是同一个画面。
 * 4. **机位从外面给**：素材自己 `OrbitControls.update()` 的机位要能被覆盖，别读全局相机。
 * 5. **尺寸从外面给**：用 `resizeTo(w, h)` 而不是读 `window.innerWidth`。
 * 6. **释放**：`renderer.dispose()` 只放资源、**不丢 WebGL 上下文**；卸载还要主动
 *    `gl.getExtension('WEBGL_lose_context')?.loseContext()`，否则反复挂载会攒上下文。
 *
 * ## 边界
 *
 * 这份外壳**不造内容**：它不知道场景里有什么，也不会替你摆东西。它只回答
 * 「这一帧该画什么」—— 内容归作者，编排归 `cameras.ts` / `framing.ts`。
 */

export type HostParts<T> = {
  /** 建场景。**只调一次**（挂载时）；里面可以做异步准备，但不能读时钟 */
  build(env: HostEnv): T;
  /** 推进到绝对时间 `t` 并画一帧 */
  advance(instance: T, t: number): void;
  setCamera?(instance: T, camera: Camera): void;
  setFraming?(instance: T, framing: Framing): void;
  targetPos?(instance: T, name: string): Vec3 | null;
  resize?(instance: T, width: number, height: number, dpr: number): void;
  dispose(instance: T): void;
  /** 出错信息里带的名字，便于定位是哪一份素材 */
  label?: string;
};

/** 把零件拼成 `SceneHost`。建场景失败会抛出带素材名的错误，不静默黑屏。 */
export function createHost<T>(env: HostEnv, parts: HostParts<T>): SceneHost {
  const name = parts.label ?? 'scene';
  let instance: T;
  try {
    instance = parts.build(env);
  } catch (error) {
    throw new Error(`[${name}] 装载失败：${(error as Error)?.message ?? error}`);
  }

  return {
    advance(t) {
      parts.advance(instance, t);
    },
    setCamera: parts.setCamera
      ? (camera) => {
          parts.setCamera?.(instance, camera);
        }
      : undefined,
    setFraming: parts.setFraming
      ? (framing) => {
          parts.setFraming?.(instance, framing);
        }
      : undefined,
    targetPos: parts.targetPos
      ? (targetName) => parts.targetPos?.(instance, targetName) ?? null
      : undefined,
    resizeTo: parts.resize
      ? (width, height, dpr) => {
          parts.resize?.(instance, width, height, dpr);
        }
      : undefined,
    dispose() {
      parts.dispose(instance);
    },
  };
}

/**
 * **纯度探针**：同一帧，两条来路必须落在同一个画面。
 *
 *   · `jump`   直接 `advance(t)`；
 *   · `walked` 从 0 起按 `1/fps` **一帧一帧**走到 `t`（模拟「序列里前面已经播过几十帧」）。
 *
 * 两者不同 ⇒ 场景里还留着**按调用次数累加**的东西（阻尼 / 弹簧 / 每帧走一步的积分器）。
 * `read()` 由调用方给：读一个像素、读一个 uniform、读宿主自报的 `stats` 都行。
 *
 * ⚠️ 这里有一个**写错过**的坑，值得留在注释里：把 `walked` 那一侧写成
 * 「`advance(0)` 之后再 `advance(t)`」是**证伪不了**的 —— 那条路与 `jump` 只差一次调用，
 * 「跳过去能自洽」的错误照样全过（实测：按 `dt` 线性累加的宿主、只在循环里赋值的宿主，
 * 两种错法都能骗过那种写法，`check-porting-audit.mjs` 的红证就是这么发现的）。
 * 判据必须是**逐帧走过去**。
 */
export function replayProbe(
  host: SceneHost,
  t: number,
  read: () => string,
  fps = 30,
): {same: boolean; jump: string; walked: string} {
  host.advance(t);
  const jump = read();
  host.advance(0);
  const steps = Math.max(1, Math.round(t * fps));
  for (let k = 1; k < steps; k++) {
    host.advance(k / fps);
  }
  host.advance(t);
  const walked = read();
  return {same: jump === walked, jump, walked};
}

/**
 * **移植体检**：扫多个时刻跑 `replayProbe`，回答一个问题 ——
 * 「同一 `t` 的读数，会不会因为**前面播过多少帧**而变」。
 *
 * **能抓到**：按调用次数累加的积分器（阻尼 / 弹簧 / 每帧走一步）、
 * 以及任何「`advance(0)` 不把它完全归零」的状态。
 *
 * **抓不到**（别把这份体检当全绿）：
 *   · 第 1 条「素材自带时钟」—— 那是**不确定**而不是**不一致**：同一 `t` 渲两次比对才看得出；
 *   · 第 3 条「只在循环里赋的值」—— 适配器的单帧分支少赋一个 uniform，两条来路都一样地少，
 *     只有和原始效果对照才能发现；
 *   · 第 4–6 条（机位 / 尺寸 / 释放）—— 它们没有「同一 `t` 两次读数」这种判据；
 *   · 线性等价的 `dt` 累加（`acc += t - last`）会判过 —— 那种写法**确实**可重放，判过是对的。
 *
 * `read` 由调用方给；返回空 `failures` = 过。过不了就别走 `<Viewport>`，去渲序列帧用 `MediaStage` 播。
 *
 * ⚠️ 体检会**移动宿主的时间**（最后停在最后一个 `times` 值上）。
 * 量完要自己 `advance` 回构图需要的那一帧 —— 与 `<Viewport>` 里「回看之后要推进回 `t`」是同一个坑
 * （实测：漏这一步，跟随会多滞后 `samples-1` 帧）。
 */
export function portingAudit(
  host: SceneHost,
  options: {read: () => string; fps?: number; times?: readonly number[]},
): {ok: boolean; checked: number; failures: readonly {t: number; jump: string; walked: string}[]} {
  const fps = options.fps ?? 30;
  const times = options.times ?? [0.5, 1.7, 2.9, 4, 7.5];
  const failures: {t: number; jump: string; walked: string}[] = [];
  for (const t of times) {
    const {same, jump, walked} = replayProbe(host, t, options.read, fps);
    if (!same) {
      failures.push({t, jump, walked});
    }
  }
  return {ok: failures.length === 0, checked: times.length, failures};
}
