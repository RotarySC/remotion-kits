import React from 'react';
import {Internals} from 'remotion';

/**
 * **页面级舞台** —— 把 `<Player>` 内部那份环境提到页面根上提供**一次**。
 *
 * ## 为什么要这样
 *
 * 展示页原来给每张卡套一个 `<Player>`，于是**挂载单元变成了「合成」**
 * （1920×1080 / 60 帧），每个控件都被塞进一个 16:9 视频框里 ——
 * 正是「以元素为单位」要消灭的东西。
 *
 * 现在整页只有**一个** provider 栈，原语像 HTML 标签一样直接挂载、按自身尺寸显示。
 *
 * ## 为什么**没有全局时钟**
 *
 * 早先这里有一个 rAF 全局时钟 + 页头一条大传送带。那条传送带是「每卡一个 `<Player>`」
 * 时代的遗留：按下去只有主题整卷与家具带在动，而**最需要看节奏的原语层永远定格**。
 * 动静放反了，而且它把「几十个格子一起播」的仲裁问题也一起带了进来。
 *
 * 现在**每个格子自己算帧，而且只有鼠标底下那一个在动**（`useHoverFrames`）：
 *
 *   * 静态 = 定格在一个有内容可看的帧（不是 frame 0，那时所有元素 opacity 都是 0）；
 *   * 悬停 = 播一遍入场 / 循环一场，离开立刻复位。
 *
 * 于是**没有仲裁问题**（同时只有一个在动），也不需要「同时只播一个」那套机器。
 * 顺带，页面在没有人操作时是**完全静止**的 —— 这正是墙上「可扫」的前提。
 *
 * ## 实测依据（搭这个舞台时做过一次独立探针）
 *
 *   * `Internals` 零缺项；11 个原语全部渲染，**Runtime 异常 0 条、console error/warning 0 条**；
 *   * `useVideoConfig()` 在页面级舞台上拿得到 `1920x1080 @30fps`；
 *   * `Internals` 在 4.0.523 → 4.0.526 **零键消失**（169 → 171）。
 *
 * ## 一个必须记住的坑
 *
 * **`TimelineContext.frame` 是按 composition id 索引的表**，不是数字
 * （`useTimelinePosition` 里是 `state.frame[videoConfig.id]`），且会被 `durationInFrames` 夹住。
 */

export const STAGE_ID = 'stage';
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
export const STAGE_FPS = 30;

export const Stage: React.FC<{
  readonly duration: number;
  readonly children: React.ReactNode;
}> = ({duration, children}) => {
  // 帧恒为 0：整页没有全局时钟，帧由每个格子自己给（`FrameAt` / `useHoverFrames`）
  const frameRef = React.useRef<Record<string, number>>({[STAGE_ID]: 0});
  const tagsRef = React.useRef<unknown[]>([]);

  // ⚠️ `isPlaying` 必须是**函数**，不是布尔值。
  //
  // 媒体组件（`<OffthreadVideo>` 在非渲染环境会退化成 `VideoForDevelopment…`）会调
  // `useMediaPlayback` → `usePlaying`，而它的实现是：
  //
  //     useSyncExternalStore(setTimeline.subscribePlaying, timeline.isPlaying, timeline.isPlaying)
  //
  // 第 2、3 个参数是 **getSnapshot** —— 给一个布尔值就报
  // `TypeError: getSnapshot is not a function`（实测：整页白屏、0 个格子）。
  //
  // 这个坑**一直存在**，只是页面里没有媒体组件时没人读它。场景层一摆上
  // 带 `kind: 'video'` 的多媒体框，它立刻炸 —— 而且报错名字是压缩过的 `t is not a function`。
  // **定位方法**：把 `build.mjs` 的 `minify` 关掉重建一次，再用 CDP 订阅
  // `Runtime.exceptionThrown`，读它的完整 description 与栈帧 —— 别靠猜报错名。
  const timeline = React.useMemo(
    // ⚠️ `audioAndVideoTags` 是**一个 ref**，不是数组 —— 媒体组件写的是
    // `audioAndVideoTags.current.push(tag)`。给裸数组就报 `Cannot read properties of undefined
    // (reading 'push')`（实测）。
    () => ({frame: {[STAGE_ID]: 0}, isPlaying: () => false, audioAndVideoTags: tagsRef}),
    [],
  );

  const setTimeline = React.useMemo(
    () => ({
      setFrame: () => undefined,
      setPlaying: () => undefined,
      setBuffering: () => undefined,
      subscribePlaying: () => () => undefined,
      subscribeBuffering: () => () => undefined,
      isPlaying: () => false,
      isBuffering: () => false,
      frameRef,
      audioAndVideoTags: tagsRef,
    }),
    [],
  );

  const playbackRate = React.useMemo(() => ({playbackRate: 1, setPlaybackRate: () => undefined}), []);

  const compositionManager = React.useMemo(
    () => ({
      compositions: [
        {
          component: () => null,
          durationInFrames: duration,
          height: STAGE_HEIGHT,
          width: STAGE_WIDTH,
          fps: STAGE_FPS,
          id: STAGE_ID,
          order: null,
          folderName: null,
          parentFolderName: null,
          schema: null,
          calculateMetadata: null,
          stack: null,
        },
      ],
      folders: [],
      currentAssetMetadata: null,
      currentCompositionMetadata: {
        defaultCodec: null,
        defaultOutName: null,
        defaultPixelFormat: null,
        defaultProResProfile: null,
        defaultSampleRate: null,
        defaultVideoImageFormat: null,
        durationInFrames: duration,
        fps: STAGE_FPS,
        height: STAGE_HEIGHT,
        width: STAGE_WIDTH,
        props: {},
      },
      canvasContent: {type: 'composition', compositionId: STAGE_ID},
    }),
    [duration],
  );

  const env = React.useMemo(
    () => ({
      isPlayer: true,
      isRendering: false,
      isStudio: false,
      isClientSideRendering: false,
      isReadOnlyStudio: false,
    }),
    [],
  );

  const logLevel = React.useMemo(() => ({logLevel: 'error', mountTime: Date.now()}), []);

  const {
    CanUseRemotionHooksProvider,
    LogLevelContext,
    RemotionEnvironmentContext,
    AbsoluteTimeContext,
    PlaybackRateContext,
    TimelineContext,
    CompositionManager,
    SequenceRegistrationContext,
    SequenceManagerProvider,
    SetTimelineContext,
    DurationsContextProvider,
    MediaVolumeContext,
    SetMediaVolumeContext,
    BufferingProvider,
    SharedAudioContextProvider,
    SharedAudioTagsContextProvider,
    CurrentScaleContext,
  } = Internals as any;

  // 缺项**大声报出来**，不静默降级 —— 否则页面会白得莫名其妙
  const missing = Object.entries({
    CanUseRemotionHooksProvider,
    LogLevelContext,
    RemotionEnvironmentContext,
    AbsoluteTimeContext,
    PlaybackRateContext,
    TimelineContext,
    CompositionManager,
    SequenceRegistrationContext,
    SequenceManagerProvider,
    SetTimelineContext,
    DurationsContextProvider,
    MediaVolumeContext,
    SetMediaVolumeContext,
    BufferingProvider,
    SharedAudioContextProvider,
    SharedAudioTagsContextProvider,
    CurrentScaleContext,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    return (
      <pre className="fatal">
        这套 Remotion 版本的 `Internals` 缺少舞台需要的项：{missing.join('、')}
        {'\n'}展示页无法启动。请核对 `remotion` 版本（本机验证过 4.0.523 与 4.0.526）。
      </pre>
    );
  }

  return (
    <CanUseRemotionHooksProvider>
      <LogLevelContext.Provider value={logLevel}>
        <RemotionEnvironmentContext.Provider value={env}>
          <AbsoluteTimeContext.Provider value={timeline}>
            <PlaybackRateContext.Provider value={playbackRate}>
              <TimelineContext.Provider value={timeline}>
                <CompositionManager.Provider value={compositionManager}>
                  <SequenceRegistrationContext.Provider value={true}>
                    {/* ⚠️ `SetTimelineContext` **必须在媒体层之外**。
                        `BufferingProvider` 自己就会读它（`useBuffering`），套在里面它只能读到
                        默认值 —— 于是抛 `SetTimelineContext is missing. This is likely caused by a
                        Remotion version mismatch.`（实测）。`@remotion/player` 也是把它放在
                        `SharedPlayerContexts` **之外**的。 */}
                    <SetTimelineContext.Provider value={setTimeline}>
                      <SequenceManagerProvider>
                        {/* ── 媒体层（**不是可选的**）────────────────────────────────
                            这几个 provider 是照 `@remotion/player` 的 `SharedPlayerContexts`
                            **原样顺序**抄的：`DurationsContextProvider` → `MediaVolumeContext` →
                            `SetMediaVolumeContext` → `BufferingProvider` → `SharedAudioContextProvider`
                            → `SharedAudioTagsContextProvider`。

                            为什么必须补：场景层渲染的是套件的 `KitShowcase`，里面可能有
                            `<OffthreadVideo>`（多媒体框的 `kind: 'video'` 分支）。它要读
                            `SharedAudioContext` 与 `MediaVolumeContext` —— 缺一个就**整页抛异常、白屏**
                            （实测三次，每次报错名都不一样）。

                            画廊是**静音预览**：`audioEnabled={false}`、`mediaVolume: 0`、`playerMuted: true`。
                            它照样提供那些 context 对象，只是不真的建 AudioContext。 */}
                        <DurationsContextProvider>
                          <MediaVolumeContext.Provider value={{playerMuted: true, mediaVolume: 0}}>
                            <SetMediaVolumeContext.Provider
                              value={{setPlayerMuted: () => undefined, setMediaVolume: () => undefined}}
                            >
                              <BufferingProvider>
                                <SharedAudioContextProvider
                                  audioEnabled={false}
                                  audioLatencyHint="interactive"
                                  previewSampleRate={null}
                                  _experimentalKeepAudioContextAlive={false}
                                >
                                  <SharedAudioTagsContextProvider numberOfAudioTags={0}>
                                    {children}
                                  </SharedAudioTagsContextProvider>
                                </SharedAudioContextProvider>
                              </BufferingProvider>
                            </SetMediaVolumeContext.Provider>
                          </MediaVolumeContext.Provider>
                        </DurationsContextProvider>
                      </SequenceManagerProvider>
                    </SetTimelineContext.Provider>
                  </SequenceRegistrationContext.Provider>
                </CompositionManager.Provider>
              </TimelineContext.Provider>
            </PlaybackRateContext.Provider>
          </AbsoluteTimeContext.Provider>
        </RemotionEnvironmentContext.Provider>
      </LogLevelContext.Provider>
    </CanUseRemotionHooksProvider>
  );
};

/** 把**一个具体帧号**包成 Remotion 的 `TimelineContext`（覆盖它，不新开时钟） */
/**
 * 把一个盒子的**缩放系数**喂给 `useCurrentScale()`。
 *
 * 画廊每格自己 `transform: scale(...)`，所以格子里的 `getBoundingClientRect()` 拿到的是
 * **缩放后**的值。Remotion 的 `useCurrentScale()` 就是用来抵消这件事的 —— 但它要求上下文里
 * 有值，否则**抛异常**（`useCurrentScale() was called outside of a Remotion context.`）。
 * 实测：加上 `ScrollArea`（第一个读它的原语）之后**整页白屏**，11 条断言一起红。
 *
 * 所以**每个自己缩放的盒子**都要包一层，且要传**那一格自己的** scale —— 传常数 1 会让
 * 测量结果差一个缩放倍率（页面上的格子是缩过的）。
 */
export const ScaleProvider: React.FC<{
  readonly scale: number;
  readonly children: React.ReactNode;
}> = ({scale, children}) => {
  const {CurrentScaleContext} = Internals as any;
  if (!CurrentScaleContext) {
    return <>{children}</>;
  }

  return (
    <CurrentScaleContext.Provider value={{type: 'scale', scale}}>
      {children}
    </CurrentScaleContext.Provider>
  );
};

export const FrameAt: React.FC<{
  readonly frame: number;
  readonly children: React.ReactNode;
}> = ({frame, children}) => {
  const {TimelineContext} = Internals as any;

  // ⚠️ `isPlaying` 同样必须是**函数** —— 与 `Stage` 那处同一个坑，而且**这一处才是真正会炸的**：
  // 媒体组件都在格子里，格子里的 `TimelineContext` 是这里给的。
  // `usePlaying()` 把它当 `getSnapshot` 用，给布尔值就报 `getSnapshot is not a function`。
  // `audioAndVideoTags` 同样必须是 **ref**（见 `Stage` 里的说明）。
  const tagsRef = React.useRef<unknown[]>([]);

  const value = React.useMemo(
    () => ({frame: {[STAGE_ID]: frame}, isPlaying: () => false, audioAndVideoTags: tagsRef}),
    [frame],
  );

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
};

/**
 * 格子悬停时该播什么。
 *
 *   * `once` —— 从第 0 帧播到 `to`，然后**停住**（元素入场：它是「从无到有」，循环会让人
 *     分不清哪一帧才是它的常态）；
 *   * `loop` —— 在 `[from, from + duration)` 里循环（版式取它那一场、家具取一场的长度）。
 */
export type HoverSpec =
  | {readonly kind: 'once'; readonly to: number}
  | {
      readonly kind: 'loop';
      readonly from: number;
      readonly duration: number;
      /** 静止时定格在哪一帧。不给就用这一段的末尾（清单类内容「内容全在」的那一帧） */
      readonly rest?: number;
    };

/**
 * **格子靠这个拿帧** —— 由调用方告诉它「现在要不要动」，它只负责算帧。
 *
 * 为什么不把 hover 也包进来：有的格子是**悬停就动**（元素 / 家具 / 场景），
 * 有的是**展开才动**（版式卡组）。让 hook 只管帧、调用方管触发，两条路都干净。
 *
 * 三个刻意的选择：
 *
 * 1. **不动时不起 rAF。** 墙上几十个格子，同时只有一个是活的 ——
 *    所以不需要「同时只播一个」的仲裁机器（那套东西随逐卡 `<Player>` 一起删了）；
 * 2. **停下立刻复位，不播反向动画。** 扫墙会反复进出，反向动画会把节奏拖垮，
 *    而且它不表达任何信息；
 * 3. **静止帧不是 frame 0。** frame 0 时所有元素 opacity 都是 0 —— 静止帧要么是
 *    完成帧（元素）、要么是场景末尾帧（版式 / 家具）。扫过去必须**每格都有东西看**。
 */
export const useFrames = (spec: HoverSpec, playing: boolean): number => {
  const to = spec.kind === 'once' ? spec.to : 0;
  const from = spec.kind === 'loop' ? spec.from : 0;
  const duration = spec.kind === 'loop' ? spec.duration : 0;
  const restGiven = spec.kind === 'loop' ? (spec.rest ?? -1) : -1;
  const loop = duration > 0;
  const rest = loop ? (restGiven >= 0 ? restGiven : from + duration - 1) : to;

  const [frame, setFrame] = React.useState(rest);

  React.useEffect(() => {
    if (!playing) {
      setFrame(rest);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const elapsed = (t: number) => Math.floor(((t - start) / 1000) * STAGE_FPS);

    if (loop) {
      const tick = (t: number) => {
        setFrame(from + (elapsed(t) % duration));
        raf = requestAnimationFrame(tick);
      };
      setFrame(from);
      raf = requestAnimationFrame(tick);
    } else {
      const tick = (t: number) => {
        const f = Math.min(to, elapsed(t));
        setFrame(f);
        if (f < to) {
          raf = requestAnimationFrame(tick);
        }
      };
      setFrame(0);
      raf = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(raf);
  }, [playing, loop, from, duration, to, rest]);

  return frame;
};
