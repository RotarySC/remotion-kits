// 展示界面的玻璃材质；不覆盖 .native-scene 内套件自己的主题。
export const GLASS_STYLES = `
:root {
  --bg: #edeef0;
  --surface: rgba(255,255,255,.52);
  --line: rgba(94,110,142,.16);
  --text: #202838;
  --muted: #566174;
  --accent: #165dcc;
  --on-accent: #fff;
  color-scheme: light;
}
.app {
  --bg: #edeef0;
  --surface: rgba(255,255,255,.52);
  --line: rgba(94,110,142,.16);
  --text: #202838;
  --muted: #566174;
  --accent: #165dcc;
  --on-accent: #fff;
  --glass-bar: rgba(249,251,255,.58);
  --glass-side: rgba(246,248,255,.48);
  --glass-panel: rgba(255,255,255,.50);
  --glass-raised: rgba(255,255,255,.74);
  --glass-edge: rgba(255,255,255,.76);
  --control: rgba(255,255,255,.48);
  --selected: rgba(47,111,221,.12);
  --selected-edge: rgba(47,111,221,.25);
  --solid-surface: #f4f5f7;
  --panel-shadow: 0 8px 28px rgba(41,54,90,.065), inset 0 1px 0 rgba(255,255,255,.38);
  --warning: #92531b;
  --success: #16704a;
  margin: 0;
  width: 100%;
  height: 100dvh;
  min-height: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  /* 中性浅灰：不带色相。缩略图里是视频帧自己的近黑底（主题 #0B0D10），
     页面越少彩度，那块黑就越像「装进去的屏」而不是「挖出来的洞」。 */
  background: #edeef0;
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.app.dark {
  --bg: #171717;
  --surface: rgba(40,40,40,.63);
  --line: rgba(255,255,255,.13);
  --text: #f2f2f2;
  --muted: #b5b5b5;
  --accent: #e2e2e2;
  --on-accent: #1d1d1d;
  --glass-bar: rgba(28,28,28,.68);
  --glass-side: rgba(24,24,24,.64);
  --glass-panel: rgba(40,40,40,.58);
  --glass-raised: rgba(57,57,57,.76);
  --glass-edge: rgba(255,255,255,.14);
  --control: rgba(32,32,32,.72);
  --selected: rgba(255,255,255,.10);
  --selected-edge: rgba(255,255,255,.22);
  --solid-surface: #282828;
  --panel-shadow: 0 8px 26px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.035);
  --warning: #f4c88e;
  --success: #a0e4c0;
  color-scheme: dark;
  background:
    radial-gradient(ellipse at 8% 4%, rgba(255,255,255,.09), transparent 48%),
    radial-gradient(ellipse at 94% 24%, rgba(96,96,96,.10), transparent 51%),
    radial-gradient(ellipse at 20% 100%, rgba(255,255,255,.045), transparent 52%),
    #151515;
}
.app.dark .asset-card:hover,
.app.dark .related button:hover,
.app.dark .capability-grid > button:hover,
.app.dark .pack-card:hover { box-shadow: 0 9px 26px rgba(0,0,0,.24); }
.app.dark .primary-action,.app.dark .play { box-shadow: 0 2px 6px rgba(0,0,0,.20); }
.app.dark .sync-dialog { box-shadow: 0 25px 80px rgba(0,0,0,.45); }
.app.dark .sync-dialog::backdrop { background: rgba(0,0,0,.35); }
.topbar {
  padding: 15px 24px;
  background: var(--glass-bar);
  border-bottom-color: var(--line);
  -webkit-backdrop-filter: blur(24px) saturate(155%);
  backdrop-filter: blur(24px) saturate(155%);
}
.brand { gap: 11px; }
.brand > b { color: var(--accent); font-size: 30px; letter-spacing: -3px; }
.brand > b span { color: var(--accent); opacity: .55; }
.brand > div { font-size: 13px; font-weight: 650; }
.brand small { color: var(--muted); font-size: 9px; font-weight: 500; letter-spacing: 1.5px; }
.search input {
  background: var(--control);
  border-color: var(--line);
  border-radius: 10px;
  box-shadow: inset 0 1px 2px rgba(27,45,75,.035);
}
.search input::placeholder { color: var(--muted); opacity: .85; }
.search kbd { border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; }
.sync-button {
  background: var(--control);
  border-color: var(--line);
  border-radius: 10px;
  min-height: 38px;
  box-shadow: 0 1px 2px rgba(35,50,80,.035);
}
.dot { background: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb,var(--success) 10%,transparent); }
.sidebar {
  background: var(--glass-side);
  border-right-color: var(--line);
  padding: 22px 17px 17px;
  -webkit-backdrop-filter: blur(24px) saturate(145%);
  backdrop-filter: blur(24px) saturate(145%);
}
.sidebar nav > button,
.sidebar-catalog nav a {
  border-radius: 9px;
  min-height: 42px;
  transition: background-color 160ms ease, color 160ms ease;
}
.sidebar nav > button { font-size: 13px; margin-bottom: 4px; }
.sidebar nav > button:hover,
.sidebar-catalog nav a:hover { background: var(--control); color: var(--text); }
.sidebar nav > button.active,
.sidebar-catalog nav a.active {
  background: var(--selected);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--selected-edge);
  font-weight: 600;
}
.catalog-owner strong { color: var(--text); }
.catalog-owner > span { color: var(--muted); }
.sidebar-bottom { font-size: 11px; }
.sidebar-bottom button { color: var(--muted); }
.workspace { padding: 29px 30px 24px; }
.eyebrow { color: var(--muted); font-size: 10px; letter-spacing: 1.6px; }
.workspace h1 { font-size: 25px; font-weight: 650; letter-spacing: -.8px; }
.overview-intro .lead { font-size: 28px; font-weight: 600; letter-spacing: -.85px; line-height: 1.5; }
.overview-intro { margin-bottom: 30px; line-height: 1.8; }
.overview-grid { gap: 20px; }
.overview-grid article,
.pack-card,
.asset-card,
.capability-grid > button,
.preview,
.inspector,
.related button {
  background: var(--glass-panel);
  border-color: var(--glass-edge);
  border-radius: 16px;
  box-shadow: var(--panel-shadow);
}
.overview-grid article,
.inspector {
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
}
.overview-grid article { padding: 30px; }
.overview-grid h2 { font-size: 27px; font-weight: 650; letter-spacing: -.65px; }
/* 「如何组合」是**脚注**，不是第三张卡：去掉玻璃底板、圆角与阴影，只留一道上规则线，宽度随网格。
   内容是两条路径，所以并排两栏 —— 排成上下两行普通段落时，看不出「A 走到 C」。
   ⚠️ 基础样式里它带着 padding:28px / border:1px / border-radius:8px / background / max-width:1000px，
   四条都要显式清掉，否则它会继续以「第三张卡」的形态出现，而且右边缘短一截。 */
.relationship {
  margin-top: 24px;
  max-width: none;
  padding: 22px 0 0;
  border: 0;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  color: var(--muted);
}
.rel-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.rel-head strong { color: var(--text); font-size: 14px; font-weight: 600; }
.rel-head small { color: var(--muted); font-size: 11px; }
.rel-paths { display: grid; grid-template-columns: 1fr 1.4fr; gap: 28px; margin-top: 14px; }
.rel-path > span { display: block; color: var(--muted); font-size: 10px; letter-spacing: 1.1px; margin-bottom: 6px; }
.rel-path p { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; font-size: 13px; color: var(--text); }
.rel-path p b { font-weight: 550; }
.rel-path p i { color: var(--accent); font-style: normal; opacity: .75; }
.rel-path + .rel-path { border-left: 1px solid var(--line); padding-left: 28px; }
.gallery-grid { gap: 18px; }
.asset-card,
.related button,
.capability-grid > button,
.pack-card { transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease; }
.asset-card:hover,
.related button:hover,
.capability-grid > button:hover,
.pack-card:hover { background: var(--glass-raised); border-color: var(--selected-edge); box-shadow: 0 9px 26px rgba(33,61,104,.10); }
.card-info { padding: 18px; }
.card-name code { color: var(--text); font-size: 14px; font-weight: 600; }
.card-info p { line-height: 1.8; }
.card-footer { border-top: 1px solid var(--line); padding-top: 11px; }
.tag { color: var(--accent); background: var(--selected); border-color: var(--selected-edge); border-radius: 6px; padding: 3px 8px; }
.views { background: var(--control); border-color: var(--line); border-radius: 10px; padding: 3px; gap: 2px; }
.views button { border-radius: 7px; }
.views .active { background: var(--glass-raised); box-shadow: 0 1px 4px rgba(37,48,72,.10); }
.primary-action,
.play { background: var(--accent); color: var(--on-accent); box-shadow: 0 2px 6px rgba(22,93,204,.13); border-radius: 9px; }
.secondary-action,
.dependency-links button,
.reset { background: var(--control); border-color: var(--line); border-radius: 9px; }
.primary-action:hover,.play:hover { filter: brightness(1.05); }
.secondary-action:hover,.dependency-links button:hover,.reset:hover { background: var(--glass-raised); }
.breadcrumb button { color: var(--accent); }
.asset-head h2 { font-size: 23px; letter-spacing: -.4px; }
.asset-head h2 code { font-weight: 600; }
.purpose { line-height: 1.85; }
.preview-toolbar { padding: 12px 15px; background: var(--control); border-color: var(--line); }
.canvas { background: #0b0e14; }
/* 浅色模式下缩略图里那块近黑视频帧（主题 color.bg，默认 #0B0D10）直接挨着卡片的浅色面，
   会形成一次亮度断崖。**不改帧的底色**（那是演示内容本身），只给边界一道 1px 内描边：
   读起来是「框住的一块屏」。暗色模式不加 —— 深对深本来就是同一族，描边只会显脏。 */
.app:not(.dark) .card-preview .canvas { box-shadow: inset 0 0 0 1px rgba(24,32,48,.13); }
.player-bar { background: var(--control); border-color: var(--line); padding: 12px 15px; }
.player-bar .play { height: 32px; }
.related-title { color: var(--text); font-weight: 500; }
.related-title small { color: var(--muted); font-weight: 400; }
.related button { padding: 18px 13px; border-radius: 12px; }
.related button.active { border-color: var(--accent); background: var(--selected); box-shadow: inset 0 0 0 1px var(--selected-edge); }
.related code { font-size: 13px; color: var(--accent); }
.inspector-head { padding: 17px 18px; font-weight: 600; }
.inspector-head small { font-weight: 400; }
.inspector-tabs { padding: 0 18px; gap: 21px; }
.inspector-tabs button { padding: 13px 0; }
.inspector-body,.source-detail { padding: 20px 18px; }
.field select,
.field input:not([type=range]),
.demo-row > select { background: var(--control); color: var(--text); border-color: var(--line); border-radius: 8px; min-height: 37px; }
.field select option,.demo-row > select option { background: var(--solid-surface); color: var(--text); }
.field > label,.field-label { font-weight: 500; }
.help { font-size: 12px; }
.choices button { background: var(--control); border-color: var(--line); border-radius: 8px; min-height: 34px; }
.choices .active { color: var(--accent); background: var(--selected); border-color: var(--selected-edge); }
.app input[type=range] { accent-color: var(--accent); }
.app input[type=checkbox] { accent-color: var(--accent); }
.empty { background: var(--control); border-color: var(--line); border-radius: 12px; }
.stale-banner { color: var(--warning); background: color-mix(in srgb,var(--warning) 9%,var(--glass-panel)); border-color: color-mix(in srgb,var(--warning) 30%,transparent); border-radius: 10px; }
.sync-dialog {
  --surface: var(--glass-panel);
  background: var(--glass-raised);
  color: var(--text);
  border: 1px solid var(--glass-edge);
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 25px 80px rgba(16,27,57,.24);
  -webkit-backdrop-filter: blur(28px) saturate(155%);
  backdrop-filter: blur(28px) saturate(155%);
}
.sync-dialog::backdrop { background: rgba(27,34,57,.18); -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px); }
.sync-dialog pre { color: var(--warning); }
.toast { background: var(--glass-raised); color: var(--text); border: 1px solid var(--glass-edge); border-radius: 12px; box-shadow: var(--panel-shadow); }
.workspace::-webkit-scrollbar { width: 8px; }
.workspace::-webkit-scrollbar-track { background: transparent; }
.workspace::-webkit-scrollbar-thumb { background: color-mix(in srgb,var(--muted) 34%,transparent); border-radius: 8px; }
.workspace::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.app button:focus-visible,.app a:focus-visible,.app input:focus-visible,.app select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media(max-width:1180px) {
  .sidebar { padding: 20px 11px; }
  .workspace { padding: 25px 22px; }
}
@media(max-width:650px) {
  .topbar { padding: 13px 16px; }
  .sidebar { padding: 12px; }
  .workspace { padding: 21px 16px; }
  .workspace h1 { font-size: 23px; }
  .overview-intro .lead { font-size: 24px; }
  .overview-grid article { padding: 24px; }
  .rel-paths { grid-template-columns: 1fr; gap: 14px; }
  .rel-path + .rel-path { border-left: 0; padding-left: 0; }
  .brand > b { font-size: 28px; }
  .sidebar-catalog nav a { min-height: 40px; }
}
/* 回退档只处理**有玻璃底板**的面；「如何组合」已经是无底板的脚注，列进来会把它又变成一张卡。 */
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
  .topbar,.sidebar,.overview-grid article,.inspector,.sync-dialog { background: var(--solid-surface); }
}
@media(prefers-reduced-transparency:reduce) {
  .topbar,.sidebar,.overview-grid article,.inspector,.sync-dialog,.asset-card,.pack-card,.preview,.related button { background: var(--solid-surface); -webkit-backdrop-filter: none; backdrop-filter: none; }
  .sync-dialog::backdrop { -webkit-backdrop-filter: none; backdrop-filter: none; }
}
@media(forced-colors:active) {
  .app { background: Canvas; color: CanvasText; border-color: CanvasText; }
  .topbar,.sidebar,.overview-grid article,.inspector,.sync-dialog,.asset-card,.pack-card,.preview,.related button { background: Canvas; border-color: CanvasText; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: none; }
  .rel-path p i { color: CanvasText; }
  .app button:focus-visible,.app a:focus-visible,.app input:focus-visible,.app select:focus-visible { outline-color: Highlight; }
}
`;
