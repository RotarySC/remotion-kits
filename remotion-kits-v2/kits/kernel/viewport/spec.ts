/**
 * `VIEWPORT_SPECS` —— 三维视图层的**机器可读登记表**。
 *
 * 与 `components/specs.tsx` 的 `COMPONENT_SPECS`、`master/types.ts` 的 `LAYOUT_SPECS` 同构：
 * 展示页按这张表发现「这一类能做什么」，而不是靠手写清单（手写清单一定会漂移）。
 *
 * ⚠️ 这里登记的是**能力**（宿主 + 机位 + 取景），不是**内容**。
 * 场景本身永远是外部素材，不入库、不登记 —— 与 mp4 / 截图同一条规矩。
 */
export type ViewportPropSpec = {
  readonly name: string;
  readonly kind: 'text' | 'number' | 'boolean' | 'enum' | 'color' | 'callback' | 'node';
  readonly required: boolean;
  readonly note?: string;
  readonly fallback?: string;
  readonly values?: readonly string[];
};

export type ViewportSpec = {
  readonly name: string;
  /** 短句：这一类解决什么问题 */
  readonly purpose: string;
  readonly props: readonly ViewportPropSpec[];
  /** 展示页「实例试验」里可现场调的 prop 名 */
  readonly tunable: readonly string[];
  /** 定格帧：frame 0 时多数内容还不可见，展示页默认停在动画完成帧 */
  readonly demoFrame: number;
  /**
   * 演示窗口长度（帧）。展示页按它**循环**播放这一幕 —— 机位脚本把 `end` 写在这个长度上，
   * 接缝处才不会跳。缺省 120 = 4 秒 @30fps。
   */
  readonly loopFrames?: number;
};

export const VIEWPORT_SPECS: readonly ViewportSpec[] = [
  {
    name: 'Viewport',
    purpose:
      '三维视图。把一个外部三维场景按帧播起来，并编排机位与取景；场景内容不进仓库，机位是 t 的纯函数',
    props: [
      {
        name: 'adapter',
        kind: 'callback',
        required: true,
        note: '装载适配器：把外部素材包成 SceneHost（`createHost` 拼装，见 viewport/attach.ts）',
      },
      {
        name: 'camera',
        kind: 'callback',
        required: false,
        note: '直给机位 {position,target} / {azimuth,elevation,distance,target}；机位脚本（static / crane / orbit / dolly / keyframes / cut / follow）；或**分镜**（shots：主体尺寸 + 镜头表，按「主体占画面几成」反解距离）',
      },
      {
        name: 'framing',
        kind: 'enum',
        required: false,
        fallback: 'perspective',
        values: ['perspective', 'orthographic'],
        note: '取景模式；fov / orthoHeight 跟着它解释',
      },
      {name: 'width', kind: 'number', required: false, fallback: '960', note: '画布设计宽度（CSS 像素）'},
      {name: 'height', kind: 'number', required: false, fallback: '540', note: '画布设计高度（CSS 像素）'},
      {
        name: 'dpr',
        kind: 'number',
        required: false,
        fallback: '1',
        note: '缓冲区倍率；夹在 [1,2]，3D 代价与像素数成正比',
      },
      {name: 'debug', kind: 'boolean', required: false, fallback: 'false', note: '打印帧号与缓冲区尺寸（排查用）'},
    ],
    tunable: ['camera', 'framing', 'dpr'],
    demoFrame: 44,
    loopFrames: 120,
  },
];
