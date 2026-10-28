/**
 * **三维视图（`viewport`）层的类型契约。**
 *
 * 这一层存在的理由：片子里的 3D 素材永远是**外部的**（作者在 Blender / 网页工具 / 素材包里做），
 * 但「怎么让它在 Remotion 里按帧播、怎么编排机位、怎么取景」是每次都要重做一遍的活。
 * 那部分不产生内容，所以它不是资产、也不是建模工具 —— 是一层**宿主**。
 *
 * 三个类型，三段责任：
 *
 *   `SceneAdapter`  作者给的那一个函数：把外部素材变成一个 `SceneHost`；
 *   `SceneHost`     本层唯一认的东西 —— **不透明**，只有「推进 / 机位 / 取景 / 尺寸 / 释放」；
 *   `Camera`        `CameraFn` / 机位脚本 的产物，全部是 `t` 的纯函数（见 `cameras.ts`）。
 *
 * ⚠️ 两条不许妥协的：
 *
 * 1. **`advance(t)` 是绝对时间**，不是「再往前走一帧」。它必须能被任意跳、
 *    同一 `t` 反复调用结果相同 —— 否则序列帧与单帧抽图必然不一致。
 * 2. **宿主不许读真实时钟**（`performance.now()` / `requestAnimationFrame` / `Date.now()`），
 *    也不许按 `dt` 累加。素材自带 rAF 循环时，由适配器在装载阶段把它关掉。
 *
 * 「能按 `t` 重放」是准入判据；做不到的素材只能渲成序列帧，走 `MediaStage`。
 */

export type Vec3 = readonly [number, number, number];

/** 宿主拿到的环境。**框架给什么，宿主就只许用什么** —— 不要回头读 `window`。 */
export type HostEnv = {
  /** 已经在文档里的画布。尺寸由框架设；宿主用 `canvas.width / height` 取缓冲区尺寸 */
  readonly canvas: HTMLCanvasElement;
  /** 设计尺寸（CSS 像素） */
  readonly width: number;
  readonly height: number;
  /** 设备像素比；缓冲区别名 = 设计尺寸 × dpr */
  readonly dpr: number;
  /** 主题强调色（`#rrggbb`）。宿主可以拿它给物体上色，也可以不理 */
  readonly accent?: string;
  /**
   * 素材需要「离线创建元素」时用它（例如把贴图 `new Image()` 出来）。
   * 传进来是为了多实例场景下不误用全局 document —— 与「素材硬编码 `getElementById`」是同一类坑。
   */
  readonly document?: Document;
};

/**
 * 机位。两种写法：
 *   · 直给世界坐标 `{position, target}`；
 *   · 球坐标 `{azimuth, elevation, distance, target}`（azimuth 绕 Y，0 = +Z 方向）。
 * 球坐标是为了「环绕某物」写起来短，不是另一套相机。
 */
export type Camera =
  | {readonly position: Vec3; readonly target?: Vec3}
  | {
      readonly azimuth: number;
      readonly elevation: number;
      readonly distance: number;
      readonly target?: Vec3;
    };

/** 取景：把世界投到这块画布。宿主不支持就忽略。 */
export type Framing = {
  readonly mode: 'perspective' | 'orthographic';
  /** `perspective`：垂直视场角（度） */
  readonly fov?: number;
  /** `orthographic`：视口在世界单位里的高度 */
  readonly orthoHeight?: number;
};

/**
 * **不透明的场景宿主** —— 本层唯一认的东西。
 *
 * 只有 `advance` 与 `dispose` 是必须的；其余都是「宿主愿意暴露就暴露」。
 * 这决定了它既能接自带渲染循环的素材，也能接一个只有 `render(t)` 的极简渲染器。
 */
export type SceneHost = {
  /** 推进到**绝对时间** `t`（秒）并画出来。必须是 `t` 的纯函数 */
  advance(t: number): void;
  /** 下发机位。宿主没有相机（例如纯 2D 画布）可省略 */
  setCamera?(camera: Camera): void;
  /** 下发取景（视场角 / 正交高度）。同上 */
  setFraming?(framing: Framing): void;
  /**
   * 活目标的世界坐标：用于跟随（`cameras.ts` 的 `follow`）。
   * ⚠️ 读之前调用方会先 `advance(at)` —— 所以这里返回的必须是**当前 `at` 那一帧**的位置，
   * 不许自己缓存上一帧。找不到就返回 `null`，跟随会退回静态目标。
   */
  targetPos?(name: string): Vec3 | null;
  resizeTo?(width: number, height: number, dpr: number): void;
  dispose(): void;
};

/** 装载适配器：**作者要写的就是这一个函数**。见 `attach.ts` 的 `createHost`。 */
export type SceneAdapter = (env: HostEnv) => SceneHost;

/** 机位解析用的上下文 —— 与 Remotion 的合成参数一一对应，别的不给。 */
export type CameraCtx = {
  readonly t: number;
  readonly frame: number;
  readonly fps: number;
  readonly durationInFrames: number;
  /**
   * 这一帧的取景（已归一化：`mode` / `fov` / `orthoHeight` 都有值）。
   *
   * 为什么机位需要它：`follow` 不需要，但 `shots` **要** —— 「主体占画面六成」这句话
   * 只有知道 fov 才能换算成距离。取景只在一个地方声明（`<Viewport framing>`），
   * 机位读它，两处不各写一份，也就不会漂移。
   */
  readonly framing?: Framing;
  /** 画幅比（宽 / 高）。`shots` 用它守「宽度不许溢出画面」 */
  readonly aspect?: number;
};

/**
 * 目标查询：`lookup(name, at)` 表示「在 `at` 这一刻该目标的**世界坐标**」。
 * 实现方（`host.tsx`）会先 `host.advance(at)` 再读 `host.targetPos(name)`。
 */
export type TargetLookup = (name: string, at: number) => Vec3 | null;

/** 机位函数：纯函数。不得读时钟、不得带上一帧状态。 */
export type CameraFn = (ctx: CameraCtx, lookup: TargetLookup) => Camera;
