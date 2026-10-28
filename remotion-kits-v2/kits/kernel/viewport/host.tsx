import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {useTheme} from '../theme/context';
import {isCameraTrack, resolveCamera, type CameraTrack} from './cameras';
import {bufferSize, normalizeFraming} from './framing';
import type {Camera, Framing, HostEnv, SceneAdapter, SceneHost, TargetLookup} from './types';

/**
 * `<Viewport>` —— 三维场景的**门面**：一块画布 + 「每帧把机位定下来、再推进」。
 *
 * 它不认识你接进来的是什么：`adapter` 造出 `SceneHost`，之后只剩四件事：
 *
 * ```
 * 每帧： camera = cameras.at(t, lookup)      ← 机位（t 的纯函数；follow 会先回看几帧）
 *        host.setCamera(camera)             ← 机位
 *        host.setFraming(framing)           ← 取景（视场角 / 正交高度）
 *        host.advance(t)                    ← 画这一帧（绝对时间）
 * ```
 *
 * 三条硬约定（每一条都有实测来历）：
 *
 * 1. **`advance` 传绝对时间**。任何「再往前走一帧」的写法都会让序列帧与单帧抽图不一致。
 * 2. **画布必须在文档里**才建场景。素材常写 `document.getElementById('c')`，
 *    而 `getElementById` 找不到游离元素 —— 港口实测会直接 `TypeError: reading 'width'`。
 * 3. **卸载要 `dispose()`，且宿主自己补 `WEBGL_lose_context`**：`renderer.dispose()`
 *    只放资源、不丢上下文；展示页反复挂载会把浏览器上下文配额抽干。
 */
export type ViewportProps = {
  /** 装载适配器。建议用 `createHost` 拼，别手写 `SceneHost` */
  adapter: SceneAdapter;
  /** 直给机位，或一份机位脚本（`cameras.ts` 的 `CameraTrack`） */
  camera?: Camera | CameraTrack;
  /** 取景。缺省透视 40° */
  framing?: Framing;
  /** 设计尺寸（CSS 像素）。缺省 960×540 */
  width?: number;
  height?: number;
  /** 缓冲区倍率；缺省 1（3D 的代价与像素数成正比，见 `framing.ts` 的 `bufferSize`） */
  dpr?: number;
  /** 左上角打印帧号 / 机位 / 自报状态（排查用） */
  debug?: boolean;
};

export const Viewport: React.FC<ViewportProps> = ({
  adapter,
  camera,
  framing,
  width = 960,
  height = 540,
  dpr = 1,
  debug = false,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const t = frame / config.fps;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<SceneHost | null>(null);
  const adapterRef = useRef<SceneAdapter | null>(null);
  const drawn = useRef(false);
  const [handle] = useState(() => delayRender('viewport: build scene host'));
  const [note, setNote] = useState('');

  const buffer = bufferSize(width, height, dpr);
  const normalized = normalizeFraming(framing);

  // ---- 建宿主：只做一次。换 adapter 才重建 ----
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (hostRef.current && adapterRef.current === adapter) {
      return;
    }
    if (hostRef.current) {
      hostRef.current.dispose();
      hostRef.current = null;
    }
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const env: HostEnv = {
      canvas,
      width,
      height,
      dpr: buffer.dpr,
      accent: theme.color.accent,
      document: typeof document === 'undefined' ? undefined : document,
    };
    try {
      hostRef.current = adapter(env);
      adapterRef.current = adapter;
      hostRef.current.setFraming?.(normalized);
    } catch (error) {
      // 不把它变成一个永远等下去的 delayRender：把错误显式暴露出来
      console.error('viewport: 装载失败', error);
      setNote(String((error as Error)?.message ?? error));
      continueRender(handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  // ---- 尺寸变化：只转发，不重建 ----
  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) {
      return;
    }
    if (canvas.width !== buffer.width || canvas.height !== buffer.height) {
      canvas.width = buffer.width;
      canvas.height = buffer.height;
      host.resizeTo?.(width, height, buffer.dpr);
    }
  }, [buffer.width, buffer.height, width, height, buffer.dpr]);

  // ---- 每帧：定机位 → 取景 → 推进 ----
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const lookup: TargetLookup = (name, at) => {
      if (!host.targetPos) {
        return null;
      }
      // 绝对时间：只为在 `at` 那一刻读位置。读完还要再推进回 t（下面统一做）
      host.advance(at);
      return host.targetPos(name);
    };

    if (camera) {
      const resolved = isCameraTrack(camera)
        ? resolveCamera(
            camera,
            {
              t,
              frame,
              fps: config.fps,
              durationInFrames: config.durationInFrames,
              // 机位要知道取景才能反解「主体占多大」（`shots` 用）；从这一处下发，别两处各写
              framing: normalized,
              aspect: buffer.height > 0 ? buffer.width / buffer.height : 1,
            },
            lookup,
          )
        : camera;
      if (resolved) {
        host.setCamera?.(resolved);
      }
    }
    host.setFraming?.(normalized);
    host.advance(t);

    if (debug) {
      setNote(`frame ${frame} · t ${t.toFixed(3)}s · ${buffer.width}×${buffer.height}（dpr ${buffer.dpr}）`);
    }
    if (!drawn.current) {
      drawn.current = true;
      continueRender(handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, camera, framing, frame, config.fps, config.durationInFrames, buffer.width, buffer.height, buffer.dpr, debug, handle]);

  // ---- 卸载：释放 ----
  useEffect(() => {
    return () => {
      const host = hostRef.current;
      hostRef.current = null;
      adapterRef.current = null;
      host?.dispose();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{display: 'block', width, height}}
        // 素材常按 id 找画布；这里不设 id —— 多实例同屏时 id 会撞，靠 `HostEnv.canvas` 传进去
      />
      {debug ? (
        <div style={{font: '20px/1.5 ' + theme.font.mono, color: theme.color.muted, marginTop: 8}}>
          {note || 'viewport: 装载中…'}
        </div>
      ) : null}
    </>
  );
};
