# 渲染配置档

视频制作里第二慢的事是**等渲染**。这份文件把「怎么让它快一点」变成可执行的东西：每个套件给一档配置，并标明哪些组件昂贵。

**所有 flag 都来自 Remotion CLI 官方文档，不是猜的。**

---

## 三档配置

| 档位 | 用途 | 关键 flag |
| --- | --- | --- |
| **草稿** | 迭代期看节奏、看版式 | `--scale=0.5` `--crf=28` `--jpeg-quality=70` |
| **审片** | 给用户看、走评审关 | `--crf=20` `--jpeg-quality=85` |
| **交付** | 最终成片 | `--crf=18` `--jpeg-quality=95`（或按平台要求给 `--video-bitrate`） |

**迭代期务必用草稿档。** `--scale=0.5` 把像素量砍到四分之一，通常是最省的一刀。

---

## 通用规则

- **并发不是越高越好。** 默认值通常已经接近最优；要动就实测，别猜：
  ```bash
  npx remotion benchmark src/index.ts <comp-id> --runs=3 --concurrencies=1,2,4,8
  ```
- **打包缓存**：`--bundle-cache`（默认开）让第二次渲染跳过打包。首次打包可能几十秒，后续渲染显著变快；
- **媒体缓存**：素材多时调 `--media-cache-size-in-bytes` / `--offthreadvideo-cache-size-in-bytes`，避免反复解码；
- **只渲染一段**：`--frames=0-99` 只渲前 100 帧，快速验证动效；
- **音画分离**：`--separate-audio-to=out/audio.wav` 可以单独拿音轨；
- **静音渲染**：`--muted` 跳过音轨，纯画面迭代时更快；
- **内存紧张**：`--disallow-parallel-encoding` 让渲染与编码不再并行，更省内存、可能更慢。

---

## 昂贵组件与对应配置

按**组件类别 / 依赖**标注（不是按套件名）。**这一列决定你要不要开 WebGL、要不要压并发。**

| 组件类别 / 依赖 | 昂贵在哪 | 渲染要求 |
| --- | --- | --- |
| 纯排版 / 纯 DOM（内核现状） | 无 | **无特殊要求** |
| 图表动画、计数滚动、密集 SVG 路径 | SVG 重绘 | 注意 `--concurrency`，SVG 重绘可能成为瓶颈 |
| 素材视频 / 音频（`<OffthreadVideo>` / `<Audio>`） | 解码 | 调 `--media-cache-size-in-bytes`；纯画面迭代时用 `--muted` |
| 需要透明通道的输出 | 编码 | 见「特殊输出」小节 —— 少了 `--image-format=png` 会静默丢 alpha |
| `@remotion/effects` | **全部 WebGL2** | 必须 `--gl=angle`；建议 `--concurrency=1` |
| `@remotion/three` | **WebGL** | 必须 `--gl=angle` |
| `remotion-maps` | **WebGL + 瓦片加载** | 必须 `--gl=angle --concurrency=1`；相机每帧 `jumpTo` 会 shimmer，改用固定底板 |
| `<HtmlInCanvas>` | Chrome 149+ 且需开 flag | 必须在启动参数里开启，否则整块画不出来 |

**WebGL 是默认关闭的。** 忘了开 `--gl=angle` 的典型症状是效果渲染成空白或直接失败。也可以在 `remotion.config.ts` 里设成全局默认：

```ts
import {Config} from '@remotion/cli/config';
Config.setChromiumOpenGlRenderer('angle');
```

---

## 特殊输出

**透明视频**（给剪辑软件或网页）：

```bash
# ProRes 4444，给剪辑软件
npx remotion render <comp-id> out.mov \
  --codec=prores --prores-profile=4444 \
  --image-format=png --pixel-format=yuva444p10le

# VP9 WebM，给网页
npx remotion render <comp-id> out.webm \
  --codec=vp9 --image-format=png --pixel-format=yuva420p
```

**未开 `--image-format=png` 会丢透明通道**，这是个静默失败。

---

## 本机环境的坑

- **没有 Chrome 时**，Remotion 需要显式指向 Edge：`Config.setBrowserExecutable('...msedge.exe')`。项目里的 `remotion.config.ts` 应当做一次候选探测；
- **`--props` 内联 JSON 在 Windows shell 里会被吃掉引号** —— 必须写成文件再用 `--props=props.json`；
- **沙箱受限环境**：如果 Node 的管道 stdio 被禁，Remotion 派生浏览器会报 `spawn EPERM`。这不是项目的问题，是运行环境限制 —— 需要放宽权限才能渲染。

---

## 实测记录

**在把某台机器/某个套件的数字写进这里之前，先跑 `benchmark`。** 不要抄别人的数字。

| 套件 | 机器 | 并发 | 档位 | 墙钟 |
| --- | --- | --- | --- | --- |
| 内核 | 本机（Edge 内核） | 默认 | 草稿 | ⬜ 待实测 |

> 内核（当时叫 `kit-core`）的首次打包（`remotion compositions`）在本机耗时约 **53 秒**，
> 之后有打包缓存。这印证了「第二次渲染显著变快」—— 这是**当时的实测记录**，换了套件要重测。