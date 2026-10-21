# assets —— 套件自带的演示素材

## `demo-clip.mp4`

**自造的**演示视频（不是从任何地方下载的，所以没有 provenance 问题）。

| | |
| --- | --- |
| 规格 | 320×180 / 30fps / **60 帧（2 秒）** / H.264 / **14 KB** |
| 内容 | 一个横移的块 + 帧号 + 一条走满的进度条 |

**内容刻意做成「逐帧可见地变」。** 如果它是静止的，抽帧出来的图和静态图一模一样 ——
**验收就分不出「视频在播」和「视频没播」**，`kind: 'video'` 那条分支等于没验。

## 它怎么被用

`templates/KitShowcase.tsx` 里 **`import demoClip from '../assets/demo-clip.mp4'`**，
然后当 `src` 传给 `MediaStage`。

这条路是**实测选出来的**，两个候选都被否掉了：

| 候选 | 结果 |
| --- | --- |
| **data URI**（`data:video/mp4;base64,…`） | ❌ **`<OffthreadVideo>` 不认** —— 它把 URL 交给 Remotion 自己的取帧服务，服务取不到 `data:` 协议（实测：渲染直接失败，出不了图） |
| **`staticFile('demo-clip.mp4')`** | ❌ 它解析到**工程的 `public/`** —— 套件就不自包含了（工程忘了放这个文件就是一片黑，而且不报错） |
| **`import` 一个真实的 mp4 文件** | ✅ **可行**：打包器把它变成自己服务器上的 URL，`<OffthreadVideo>` 取得到（实测 `remotion still` exit 0，画面正确） |

代价是**展示页的 esbuild 打包需要一条 loader**（`.mp4 → dataurl`，见 `showcase/generate.ps1`）——
因为画廊跑在浏览器里，没有那个服务器。浏览器里 `<OffthreadVideo>` 退化成普通 `<video>`，data URI 它认。

## 怎么重新生成

源合成在一次性探针里（不属于套件）。要重做的话，照这个规格写一个 320×180 / 30fps / 60 帧的合成，
里面必须有**逐帧变化的元素**，然后：

```powershell
remotion render <entry> <CompId> out/demo-clip.mp4
Copy-Item out/demo-clip.mp4 <SKILL_DIR>\kits\kernel\assets\demo-clip.mp4
```
