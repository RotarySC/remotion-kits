#!/usr/bin/env node
/**
 * 生成架构草图（SVG）—— `docs/2026-10-07-系统架构-草图.svg`。
 *
 * 为什么用脚本而不是手写 SVG：这张图会随系统变化（层数、文件数、判据数），手写的 SVG
 * 一改就容易**图文不一致**，而图文不一致的架构图比没有更坏 —— 它说谎。脚本里数字集中在
 * `FACTS`，改一处即可；生成完用 §6 的两条命令复核（XML 合法 ＋ 真的渲出来看一眼）。
 *
 * 用法：
 *   node tools/architecture-sketch.mjs                 # 写 docs/2026-10-07-系统架构-草图.svg
 *   node tools/architecture-sketch.mjs --out <path>    # 写别处
 *
 * 复核（两条都要）：
 *   pwsh -Command "[xml](Get-Content -Raw 'docs\2026-10-07-系统架构-草图.svg') | Out-Null; 'XML OK'"
 *   & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new \
 *       --disable-gpu --screenshot=docs\2026-10-07-系统架构-草图.png --window-size=1280,940 \
 *       "file:///<仓库>/docs/2026-10-07-系统架构-草图.svg"     # 然后**真的看图**
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = (() => {
  const i = process.argv.indexOf('--out');
  return i >= 0 ? process.argv[i + 1] : path.join(ROOT, 'docs', '2026-10-07-系统架构-草图.svg');
})();

// —— 图里的数字集中在这里。改的时候改这里，别再手改 SVG。 ——
const FACTS = {
  copies: '75',
  kernel: '58',
  hotspot: '17',
  mirrorFiles: '99',
  refs: '8',
  updaterScripts: '4',
  primitives: '19',
  layoutsKernel: '6',
  furnitureKernel: '2',
  themesKernel: '4',
  guards: '4',
  skins: '2',
  templates: '8',
  layoutsHotspot: '3',
  furnitureHotspot: '2',
  themesHotspot: '2',
  demosHotspot: '3',
  decodeName: '230',
  decodeKind: '211',
  assertions: '67',
  updaterCases: '210',
  date: '2026-10-07',
  doc: '2026-10-07-系统架构-现状描述.md',
};

const W = 1280;
const H = 940;
const FF = "'Microsoft YaHei','Segoe UI','Noto Sans SC',sans-serif";
const C = {
  ink: '#1f2430',
  muted: '#6b7480',
  band: '#f5f6f8',
  bandStroke: '#dde1e6',
  box: '#ffffff',
  boxStroke: '#b7bfc9',
  arrow: '#6b7480',
  kernel: { fill: '#eef4ff', stroke: '#4a7fd4' },
  hotspot: { fill: '#fff5e9', stroke: '#d08a3c' },
  project: { fill: '#eefaf3', stroke: '#3fa06a' },
  tool: { fill: '#f4f1fb', stroke: '#8a76c9' },
  warn: '#b4552d',
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const parts = [];
const rect = (x, y, w, h, o = {}) => {
  const { fill = C.box, stroke = C.boxStroke, sw = 1.2, r = 8, dash = null } = o;
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${
      dash ? ` stroke-dasharray="${dash}"` : ''
    }/>`,
  );
};
const text = (x, y, s, o = {}) => {
  const { size = 12, weight = 400, fill = C.ink, anchor = 'start', italic = false } = o;
  parts.push(
    `<text x="${x}" y="${y}" font-family="${FF}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${
      italic ? ' font-style="italic"' : ''
    }>${esc(s)}</text>`,
  );
};
const arrow = (x1, y1, x2, y2, label, labelDy = -8) => {
  parts.push(
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.arrow}" stroke-width="1.6" marker-end="url(#ah)"/>`,
  );
  if (label) {
    text((x1 + x2) / 2, (y1 + y2) / 2 + labelDy, label, {
      size: 11,
      fill: C.muted,
      anchor: 'middle',
    });
  }
};
// 一行里并排的小标签（chip）
const chipRow = (x, y, items, o = {}) => {
  const { h = 28, pad = 14, gap = 10, size = 11.5, fill = '#ffffff', stroke = C.boxStroke } = o;
  let cx = x;
  for (const it of items) {
    const w = Math.round(it.length * size + pad * 2);
    rect(cx, y, w, h, { fill, stroke, r: 14, sw: 1 });
    text(cx + w / 2, y + h / 2 + 4, it, { size, anchor: 'middle', fill: C.ink });
    cx += w + gap;
  }
};

const band = (y, h, label) => {
  rect(40, y, W - 80, h, { fill: C.band, stroke: C.bandStroke, r: 12, sw: 1 });
  text(56, y + 26, label, { size: 14, weight: 700, fill: C.ink });
};

// ————————————————————————— 标题 —————————————————————————
text(40, 40, '视频工作区 · 套件系统现状', { size: 22, weight: 700 });
text(330, 40, `（${FACTS.date} 实测）`, { size: 14, fill: C.muted });
text(40, 62, '内核装通用机制 · 类型包装题材差异 · 片子工程装这部片子的一切 —— 三者靠「版本化源码复制」连接、靠「基线＋更新器」同步、靠「验证环」证明它真的这样工作。', {
  size: 12.5,
  fill: C.muted,
});

// ——————————————————— ① 发布与副本 ———————————————————
band(88, 176, '① 发布与副本 —— 版本化源码复制（T01）');
rect(56, 118, 300, 104, { fill: C.kernel.fill, stroke: C.kernel.stroke, sw: 1.6 });
text(72, 142, '母本（技能目录）', { size: 13.5, weight: 700 });
text(72, 164, '~\\.dsh\\skills\\remotion-kits', { size: 11, fill: C.muted });
text(72, 184, `kits\\ = ${FACTS.copies} 文件`, { size: 11.5 });
text(72, 204, `＋ SKILL.md · ${FACTS.refs} 契约 · 展示页 · ${FACTS.updaterScripts} 更新器`, { size: 11, fill: C.muted });

arrow(360, 170, 412, 170, '复制');

rect(416, 118, 286, 104, { fill: C.box, stroke: C.boxStroke, sw: 1.6 });
text(432, 142, '仓库镜像 remotion-kits-v2', { size: 13.5, weight: 700 });
text(432, 164, `${FACTS.mirrorFiles} 文件`, { size: 11.5 });
text(432, 184, 'mirror-check.ps1：97 全等', { size: 11, fill: C.muted });
text(432, 204, '（不一致就不许提交）', { size: 11, fill: C.muted });

arrow(706, 170, 758, 170, '分发');

rect(762, 118, 462, 104, { fill: C.project.fill, stroke: C.project.stroke, sw: 1.6 });
text(778, 140, '工程副本（各自可独立修改的源码快照）', { size: 13, weight: 700 });
rect(778, 150, 210, 28, { fill: '#ffffff', stroke: C.project.stroke, r: 6, sw: 1 });
text(793, 169, `lab 基线工程 · ${FACTS.copies}`, { size: 11.5 });
rect(998, 150, 210, 28, { fill: '#ffffff', stroke: C.project.stroke, r: 6, sw: 1 });
text(1013, 169, `zcode 片子工程 · ${FACTS.copies}`, { size: 11.5 });
text(778, 198, '.kit-origin 基线：逐文件哈希 ＋ 运行记录', { size: 11, fill: C.muted });
text(778, 214, '更新器：默认一个字节都不写 · 四趟提交 · 逐对象三态恢复', { size: 11, fill: C.muted });
text(56, 250, `四副本 ${FACTS.copies}/${FACTS.copies} 逐字节相同（六组两两比对全 0）· 复测：pwsh tools\\kit-copy-check.ps1（控制组 0 · 红证 1）`, {
  size: 11.5,
  weight: 700,
  fill: '#2f6b46',
});

// ——————————————————— ② 套件内部分层 ———————————————————
band(280, 212, '② 套件内部分层 —— 类型包只放差异（T02）');
rect(56, 306, 700, 132, { fill: C.kernel.fill, stroke: C.kernel.stroke, sw: 1.6 });
text(72, 332, `内核 kernel · ${FACTS.kernel} 文件`, { size: 13.5, weight: 700 });
chipRow(72, 344, [
  `${FACTS.primitives} 原语`,
  `${FACTS.layoutsKernel} 版式`,
  `${FACTS.furnitureKernel} 家具`,
  `${FACTS.themesKernel} 主题`,
], { fill: '#ffffff', stroke: C.kernel.stroke });
chipRow(72, 380, [
  `guards ${FACTS.guards}`,
  `skins ${FACTS.skins}`,
  `templates ${FACTS.templates}`,
  'motion.ts',
], { fill: '#ffffff', stroke: C.kernel.stroke });
text(72, 426, `components/specs.tsx 声明表：name ${FACTS.decodeName} · kind ${FACTS.decodeKind}`, {
  size: 11,
  fill: C.muted,
});

rect(786, 306, 438, 132, { fill: C.hotspot.fill, stroke: C.hotspot.stroke, sw: 1.6 });
text(802, 332, `类型包 hotspot · ${FACTS.hotspot} 文件`, { size: 13.5, weight: 700 });
chipRow(802, 344, [
  `${FACTS.layoutsHotspot} 版式`,
  `${FACTS.furnitureHotspot} 家具`,
  `${FACTS.themesHotspot} 主题`,
  `${FACTS.demosHotspot} 演示`,
], { fill: '#ffffff', stroke: C.hotspot.stroke });
text(802, 398, 'compose.ts（资产声明）· kit.md · labels.ts', { size: 11, fill: C.muted });
text(802, 418, '原语与组件层演示不在它这里', { size: 11, fill: C.muted });
text(802, 434, `（那两层从声明里的来源补：${FACTS.primitives} 原语 ＋ 组件层演示）`, { size: 10.5, fill: C.muted });

arrow(786, 356, 756, 356);
text(56, 460, "compose.ts 只声明来源（sources: ['../kernel']）：工具按声明逐层补「元件层 / 组件层演示」两层；工具不认识「kernel」这个名字 —— 名字住在数据里。", {
  size: 11.5,
  fill: C.muted,
});
text(56, 480, '主题 / 版式 / 家具不补：那是本套件的差异，本套件提供就是权威。', { size: 11.5, fill: C.muted });

// ——————————————————— ③ 运行时装配链 ———————————————————
band(510, 212, '③ 运行时装配链 —— 一部片子怎么被画出来');
const chain = [
  ['项目 Root.tsx', ['合成注册：主合成 720 帧', '＋ 片段 ＋ Probe'], C.project],
  ['项目 dispatcher', ['renderScene ＋ Sequence 循环', '（T09 裁定：留在项目）'], C.project],
  ['版式 LayoutName', ['Scene 从 9 个版式的', '公开 props 派生（T09）'], C.kernel],
  ['原语', ['Flow · Panel · ScrollArea …', `${FACTS.primitives} 个`], C.kernel],
  ['主题 · 动效 · 皮', ['theme 4 主题 · motion.ts', '实例 prop > 皮 > 主题'], C.kernel],
];
const bw = 214;
const gapx = 26;
chain.forEach(([title, lines, tone], i) => {
  const x = 56 + i * (bw + gapx);
  rect(x, 554, bw, 76, { fill: tone.fill, stroke: tone.stroke, sw: 1.4 });
  text(x + bw / 2, 578, title, { size: 12.5, weight: 700, anchor: 'middle' });
  lines.forEach((l, k) => text(x + bw / 2, 596 + k * 15, l, { size: 10.5, fill: C.muted, anchor: 'middle' }));
  if (i < chain.length - 1) arrow(x + bw + 2, 592, x + bw + gapx - 2, 592);
});
rect(56, 650, W - 112, 56, { fill: '#ffffff', stroke: C.boxStroke, r: 8, sw: 1.2 });
text(72, 672, '契约带（沿链生效）：', { size: 12, weight: 700 });
text(196, 672, '尺寸 T03 轴语义 · T04 元素自然默认 ＋ 实例可覆盖 · G15 minmax(0,1fr) · U2 tracks 混合主轴轨道', {
  size: 11.5,
});
text(196, 694, '动效 T07-①（motion.ts，零回归是硬判据）· 皮 T08（三级优先）· 诊断 T05/T06（guards/diagnostics，只在开发期喊）', {
  size: 11.5,
});

// ——————————————————— ④ 验证环 ———————————————————
band(736, 168, '④ 验证环 —— 「怎么知道它对」');
const tools = [
  ['mirror-check.ps1', '97 文件全等'],
  ['update-kits.ps1', `${FACTS.updaterCases} 项 / 0 失败 · 六组红证`],
  ['generate + verify', `${FACTS.assertions} 断言 × 三入口`],
  ['证据装置', 'g07/g09/g15/u1-*/u2-*'],
  ['U1 护栏补丁', 'node_modules（不入库）'],
  ['agents-check.cjs', '事实记号包含检查'],
];
const tw = 186;
const tgap = 18;
tools.forEach(([title, detail], i) => {
  const x = 56 + i * (tw + tgap);
  rect(x, 778, tw, 64, { fill: C.tool.fill, stroke: C.tool.stroke, sw: 1.2 });
  text(x + tw / 2, 802, title, { size: 11.5, weight: 700, anchor: 'middle' });
  text(x + tw / 2, 822, detail, { size: 10.5, fill: C.muted, anchor: 'middle' });
});
text(56, 866, '⚠️ 仍未做：更新后「整片渲染重跑」（zcode 的 mp4 仍是 2026-09-20 —— 改动与画面等价是结构推断，没有整片帧哈希封过）· G13 运行时仍是 4/4 帧抽样。', {
  size: 11.5,
  fill: C.warn,
  weight: 700,
});
text(56, 888, `图由 tools/architecture-sketch.cjs 生成（数字集中在 FACTS，改一处即可）· 判据与复测命令 ⇒ docs/${FACTS.doc}`, {
  size: 10.5,
  fill: C.muted,
});

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="视频工作区套件系统架构草图">
<defs>
  <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="${C.arrow}"/>
  </marker>
</defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>
${parts.join('\n')}
</svg>
`;

fs.writeFileSync(OUT, svg);
console.log(`已写出 ${path.relative(ROOT, OUT)} · ${Buffer.byteLength(svg, 'utf8')} B · ${W}×${H}`);
