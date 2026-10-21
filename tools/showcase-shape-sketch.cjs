'use strict';

/*
 * 展示页「类型包那一页」的改造草图 —— 生成 SVG，不是手画。
 *
 * 手画的图迟早与读数分叉，而分叉的展示图比没有更坏（它说谎）。
 * 所以这里的每个数字都集中在 FACTS 里，改一处即可重生成；
 * 并且带三条自检（见文件末尾）：**不许出现 markdown 的 `**`、文字不许越界、
 * 结构块与 FACTS 的数量必须对得上** —— 认不出来的图不许写出去。
 *
 * 用法： node tools/showcase-shape-sketch.cjs [输出路径]
 * 默认写到 out/showcase-review/showcase-type-package-sketch.svg
 */

const fs = require('fs');
const path = require('path');

// ── 读数（全部来自 2026-10-07 当场跑出来的生成器输出）────────────────────────
//
//   pwsh -File <技能>\showcase\generate.ps1 -Project <lab> -DiscoverOnly
//     hotspot: 2 个主题 · 4 个版式场景 · 2 件家具 · 18 个组件场景 · 整卷 240 帧 · 中文名 44
//     kernel : 4 个主题 · 8 个版式场景 · 2 件家具 · 18 个组件场景 · 整卷 480 帧 · 中文名 49
//
//   ⚠️ 44 = 7（自己：3 版式 + 2 家具 + 2 主题）＋ 37（内核的：19 元素 + 18 场景）
//      —— 这一条是「把补入的层算成本套件的」最直接的证据。
const FACTS = {
  typePackage: {
    name: 'hotspot',
    role: '类型包',
    layouts: 3,
    furniture: 2,
    themes: 2,
    demos: 3,
    // 它自己的 labels.ts 只有四张子表 ⇒ 只有 7 条中文名
    ownLabelNames: 7,
    // 自己的演示合成占的帧数：4 场 × 60 帧
    totalFrames: 240,
    sceneCount: 4,
  },
  // 补入的层（compose.ts 声明 sources: ['../kernel']）
  borrowed: {elements: 19, kitScenes: 18},
  // 页面今天报的数（套件墙上那张卡）
  oldCard: {themes: 2, elements: 19, layouts: 4, furniture: 2},
  // 卡片下面那排 chip 只列得出 3 个 —— 同一个渲染里两个口径
  chips: {
    themes: ['signal-dark · 信号暗色', 'alert-contrast · 警示对比'],
    layouts: ['timeline · 脉络', 'stance · 立场', 'multi-stat · 多数字'],
  },
  // 版式分节今天摆 4 行：multi-stat 按场景并列成两行
  oldLayoutRows: ['timeline', 'stance', 'multi-stat（场景 2）', 'multi-stat（场景 3）'],
};

// ── 画布与配色 ───────────────────────────────────────────────────────────────
const W = 1280;
const H = 1570;
const C = {
  bg: '#0e1014',
  panel: '#171a20',
  panel2: '#1d2129',
  line: '#2b313b',
  ink: '#e2e6ec',
  dim: '#99a1ad',
  mute: '#6f7885',
  accent: '#56a5ff',
  accentSoft: '#1b2b40',
  good: '#3ec98f',
  goodSoft: '#152b23',
  bad: '#e8676c',
  badSoft: '#2e1a1d',
  warn: '#e5b95c',
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 粗略估宽：CJK 与全角按 1em，其余按 0.56em —— 只用来做越界自检与 chip 宽度 */
const est = (s, size) => {
  let w = 0;
  for (const ch of String(s)) {
    w += /[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f]/.test(ch) ? size : size * 0.56;
  }
  return w;
};

const out = [];
const put = (s) => out.push(s);

function rect(x, y, w, h, o = {}) {
  put(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 6}" ` +
      `fill="${o.fill ?? 'none'}"` +
      (o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"` : '') +
      (o.dash ? ` stroke-dasharray="${o.dash}"` : '') +
      `/>`
  );
}

function text(x, y, s, o = {}) {
  put(
    `<text x="${x}" y="${y}" font-size="${o.size ?? 13}" fill="${o.fill ?? C.ink}"` +
      ` text-anchor="${o.anchor ?? 'start'}"` +
      (o.weight ? ` font-weight="${o.weight}"` : '') +
      (o.opacity ? ` opacity="${o.opacity}"` : '') +
      `>${esc(s)}</text>`
  );
  CHECKS.bounds.push([x, y, s, o.size ?? 13, o.anchor ?? 'start']);
}

function rule(x, y, w, color = C.line) {
  put(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${color}" stroke-width="1"/>`);
}

/** 一枚 chip，返回它占的宽度（含内边距） */
function chip(x, y, label, o = {}) {
  const size = o.size ?? 12;
  const pad = o.pad ?? 9;
  const w = est(label, size) + pad * 2;
  const h = o.h ?? 24;
  rect(x, y, w, h, {
    rx: h / 2,
    fill: o.fill ?? C.panel2,
    stroke: o.stroke ?? C.line,
  });
  text(x + pad, y + h / 2 + size * 0.36, label, {size, fill: o.color ?? C.dim});
  CHECKS.chips.push([x, w, label]);
  return w;
}

function chipRow(x, y, labels, o = {}) {
  const gap = o.gap ?? 8;
  let cx = x;
  for (const l of labels) {
    cx += chip(cx, y, l, o) + gap;
  }
  return cx - x - gap;
}

function sectionLabel(x, y, num, title, sub) {
  let cx = x;
  text(cx, y, num, {size: 15, weight: 700, fill: C.accent});
  cx += est(num, 15) + 8;
  text(cx, y, title, {size: 15, weight: 700, fill: C.ink});
  cx += est(title, 15) + 12;
  if (sub) {
    text(cx, y, sub, {size: 12, fill: C.mute});
  }
  rule(x, y + 12, W - x * 2, C.line);
}

// ── 自检账本 ────────────────────────────────────────────────────────────────
const CHECKS = {bounds: [], chips: [], markerHits: 0};

// ════════════════════════════════════════════════════════════════════════════
put(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ` +
    `font-family="Microsoft YaHei, Segoe UI, sans-serif">`
);
put(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`);

// ── 标题 ────────────────────────────────────────────────────────────────────
text(48, 46, '展示页 · 类型包那一页 —— 改造草图', {size: 26, weight: 700});
text(
  48,
  74,
  '提案（尚未落地）· 2026-10-07 · 数字取自生成器当场读数 · 生成器 tools/showcase-shape-sketch.cjs',
  {size: 12, fill: C.mute}
);

// ── ① 套件墙上那张卡：旧 → 新 ───────────────────────────────────────────────
sectionLabel(48, 124, '①', '套件墙上那张卡：旧 → 新', '同一个渲染里两个口径，是这条缺陷最硬的形状');

const cardY = 152;
const cardH = 300;
const cardW = 520;
const leftX = 48;
const rightX = 712;

function suiteCard(x, y, o) {
  rect(x, y, cardW, cardH, {fill: C.panel, stroke: o.stroke, sw: 1.5, rx: 10});
  // 代表帧（整卡宽 —— 与页面上那张卡同形）
  rect(x + 18, y + 18, cardW - 36, 96, {fill: '#0b0d11', stroke: C.line, rx: 4});
  text(x + cardW / 2, y + 74, '代表帧', {size: 12, fill: C.mute, anchor: 'middle'});
  // 名字与角色徽标
  text(x + 18, y + 146, FACTS.typePackage.name, {size: 19, weight: 700});
  chip(x + 18 + est(FACTS.typePackage.name, 19) + 10, y + 128, o.badge, {
    size: 11,
    h: 20,
    fill: o.badgeBg,
    stroke: o.badgeFg,
    color: o.badgeFg,
  });
  // 统计行
  text(x + 18, y + 172, o.stats, {size: 13, fill: o.statsFill ?? C.dim});
  // chip 两排
  chipRow(x + 18, y + 184, FACTS.chips.themes, {size: 11, h: 22, fill: C.panel2});
  chipRow(x + 18, y + 212, FACTS.chips.layouts, {size: 11, h: 22, fill: C.panel2});
  // 结论
  rect(x + 18, y + 246, cardW - 36, 42, {
    fill: o.noteBg,
    stroke: o.noteFg,
    rx: 6,
    dash: '4 3',
  });
  text(x + 30, y + 264, o.note1, {size: 11.5, fill: o.noteFg});
  text(x + 30, y + 280, o.note2, {size: 11.5, fill: o.noteFg, opacity: 0.85});
}

suiteCard(leftX, cardY, {
  stroke: C.bad,
  badge: '旧',
  badgeBg: C.badSoft,
  badgeFg: C.bad,
  stats: `${FACTS.oldCard.themes} 主题 · ${FACTS.oldCard.elements} 元素 · ${FACTS.oldCard.layouts} 版式 · ${FACTS.oldCard.furniture} 家具`,
  statsFill: C.bad,
  noteBg: C.badSoft,
  noteFg: C.bad,
  note1: `统计行说 ${FACTS.oldCard.layouts} 版式，下面那排 chip 只列得出 ${FACTS.typePackage.layouts} 个`,
  note2: `${FACTS.oldCard.elements} 元素读的是补入的层 —— 本套件一个原语都没有`,
});

suiteCard(rightX, cardY, {
  stroke: C.good,
  badge: '新',
  badgeBg: C.goodSoft,
  badgeFg: C.good,
  stats: `${FACTS.typePackage.layouts} 版式 · ${FACTS.typePackage.furniture} 家具 · ${FACTS.typePackage.themes} 主题 · ${FACTS.typePackage.demos} 演示`,
  statsFill: C.good,
  noteBg: C.goodSoft,
  noteFg: C.good,
  note1: '统计行与 chip 出处相同 —— 都来自本套件自己的声明',
  note2: '补入的层不计入本套件；它们在 kernel 那一页',
});

// 箭头
(function () {
  const y = cardY + cardH / 2;
  put(
    `<line x1="${leftX + cardW + 22}" y1="${y}" x2="${rightX - 26}" y2="${y}" stroke="${C.mute}" stroke-width="1.5"/>`
  );
  put(
    `<path d="M ${rightX - 26} ${y} l -10 -5 l 0 10 z" fill="${C.mute}"/>`
  );
  text((leftX + cardW + rightX) / 2, y - 12, '只改口径', {size: 11, fill: C.mute, anchor: 'middle'});
})();

// ── ② 类型包那一页（改后）────────────────────────────────────────────────────
sectionLabel(48, 490, '②', '类型包那一页（改后）', '只摆本套件带来的东西；借入的层退成一行指路');

const PX = 48;
const PY = 518;
const PW = W - PX * 2;
const PH = 620;
rect(PX, PY, PW, PH, {fill: C.panel, stroke: C.line, rx: 10});

const IN = PX + 22; // 内容左边界
const IW = PW - 44; // 内容宽度

// 顶部导航（页面级，不进套件）
rect(PX + 1, PY + 1, PW - 2, 40, {fill: '#12151a', rx: 9});
text(IN, PY + 26, '套件展示', {size: 12, fill: C.mute});
let navX = IN + 62;
for (const [t, active] of [['全部', false], [FACTS.typePackage.name, true], ['kernel', false]]) {
  const w = est(t, 12) + 22;
  rect(navX, PY + 10, w, 22, {
    rx: 5,
    fill: active ? C.accentSoft : 'none',
    stroke: active ? C.accent : C.line,
  });
  text(navX + w / 2, PY + 25, t, {
    size: 12,
    fill: active ? C.accent : C.dim,
    anchor: 'middle',
  });
  navX += w + 8;
}
rect(navX + 20, PY + 10, IN + IW - navX - 20, 22, {
  rx: 5,
  fill: '#0b0d11',
  stroke: C.line,
});
text(navX + 32, PY + 25, '筛选：代码名 / 中文名 / 源码路径…', {size: 11, fill: C.mute});

// 套件头
let y = PY + 58;
text(IN, y, FACTS.typePackage.name, {size: 21, weight: 700});
let bx = IN + est(FACTS.typePackage.name, 21) + 12;
rect(bx, y - 17, est(FACTS.typePackage.role, 11) + 18, 20, {
  rx: 10,
  fill: C.accentSoft,
  stroke: C.accent,
});
text(bx + 9, y - 3, FACTS.typePackage.role, {size: 11, fill: C.accent});
y += 24;
text(
  IN,
  y,
  `${FACTS.typePackage.layouts} 版式 · ${FACTS.typePackage.furniture} 家具 · ${FACTS.typePackage.themes} 主题 · ${FACTS.typePackage.demos} 演示`,
  {size: 14, fill: C.ink, weight: 700}
);
text(IN + 300, y, `组合自 ../kernel（compose.ts）· 本页只讲 ${FACTS.typePackage.name} 带来的差异`, {
  size: 12,
  fill: C.mute,
});

// 归属条（借入的层 = 指路，不是墙）
y += 26;
rect(IN, y, IW, 44, {fill: C.accentSoft, stroke: C.accent, rx: 6, dash: '5 3'});
text(IN + 16, y + 19, '内核借入的层 —— 不在本页摆：', {size: 12, fill: C.accent, weight: 700});
text(
  IN + 16,
  y + 36,
  `${FACTS.borrowed.elements} 原语 · ${FACTS.borrowed.kitScenes} 组件层场景　→　去 kernel 那一页看`,
  {size: 12, fill: C.dim}
);
const linkW = est('→ kernel', 12) + 22;
rect(IN + IW - linkW - 14, y + 11, linkW, 22, {rx: 11, fill: 'none', stroke: C.accent});
text(IN + IW - linkW - 14 + linkW / 2, y + 26, '→ kernel', {
  size: 12,
  fill: C.accent,
  anchor: 'middle',
});

// 主题行
y += 60;
text(IN, y + 16, '主题', {size: 14, weight: 700});
const themeRowX = IN + 56;
chipRow(themeRowX, y, FACTS.chips.themes, {size: 12, h: 26, fill: C.panel2});
chip(IN + IW - 92, y, '联络表 ▸', {size: 12, h: 26, fill: 'none', stroke: C.line, color: C.dim});

// 版式分节
y += 46;
rule(IN, y, IW);
text(IN, y + 24, '版式', {size: 14, weight: 700});
text(IN + 44, y + 24, `${FACTS.typePackage.layouts} 个 · 悬停某一条就地展开`, {
  size: 12,
  fill: C.mute,
});

const rows = [
  ['timeline', '脉络', '1 场', ''],
  ['stance', '立场', '1 场', ''],
  [
    'multi-stat',
    '多数字',
    '2 场',
    '场景 2 / 场景 3（这里只占一行）',
  ],
];
let ry = y + 36;
for (const [code, cn, times, note] of rows) {
  rect(IN, ry, IW, 38, {fill: C.panel2, stroke: C.line, rx: 6});
  rect(IN + 12, ry + 9, 3, 20, {fill: C.accent, rx: 1.5});
  text(IN + 26, ry + 24, code, {size: 13, weight: 700});
  let cx2 = IN + 26 + est(code, 13) + 10;
  text(cx2, ry + 24, `· ${cn}`, {size: 13, fill: C.dim});
  cx2 += est(`· ${cn}`, 13) + 14;
  chip(cx2, ry + 8, 'layout', {size: 10, h: 20, pad: 7});
  cx2 += est('layout', 10) + 14 + 12;
  chip(cx2, ry + 8, `槽 ${code === 'multi-stat' ? 3 : 2}`, {size: 10, h: 20, pad: 7});
  cx2 += est(`槽 ${code === 'multi-stat' ? 3 : 2}`, 10) + 14 + 12;
  chip(cx2, ry + 8, '必填 1', {size: 10, h: 20, pad: 7});
  if (note) {
    text(IN + IW - 16, ry + 24, note, {size: 11, fill: C.good, anchor: 'end'});
  } else {
    text(IN + IW - 16, ry + 24, `${times} · 悬停展开`, {size: 11, fill: C.mute, anchor: 'end'});
  }
  ry += 46;
}
text(IN, ry + 14, '旧版在这里摆 4 行（multi-stat 按场景并列成两行）；改成按版式去重 —— 场景数退成标注。', {
  size: 11,
  fill: C.good,
});

// 固定家具
y = ry + 34;
rule(IN, y, IW);
text(IN, y + 24, '固定家具', {size: 14, weight: 700});
text(IN + 68, y + 24, `${FACTS.typePackage.furniture} 件 · 只框住那条带，悬停循环一场`, {
  size: 12,
  fill: C.mute,
});
let fy = y + 36;
const furn = ['EventStamp · 事件时间戳', 'SourceBadge · 来源徽章'];
const fw = (IW - 16) / 2;
furn.forEach((cn, i) => {
  const fx = IN + i * (fw + 16);
  rect(fx, fy, fw, 56, {fill: '#0b0d11', stroke: C.line, rx: 6});
  text(fx + 12, fy + 24, cn, {size: 12, fill: C.dim});
  text(fx + 12, fy + 42, '按主题裁那条带 · 各主题报头高不同', {size: 10.5, fill: C.mute});
});
fy += 64;

// 演示
rule(IN, fy, IW);
text(IN, fy + 24, '演示', {size: 14, weight: 700});
text(IN + 44, fy + 24, `${FACTS.typePackage.demos} 件（本套件自己的）`, {
  size: 12,
  fill: C.mute,
});
chipRow(
  IN,
  fy + 36,
  ['MasterShowcase.tsx', 'ShowcaseScenes.tsx', 'ThemeShowcase.tsx'],
  {size: 11, h: 24, fill: C.panel2}
);
text(
  IN + IW,
  fy + 52,
  `${FACTS.typePackage.sceneCount} 场 × 60 帧 = ${FACTS.typePackage.totalFrames} 帧 · 母版与主题两条时间轴`,
  {size: 11, fill: C.mute, anchor: 'end'}
);

// ── ③ 改了什么 ──────────────────────────────────────────────────────────────
sectionLabel(48, 1178, '③', '改了什么', '只有一条是新东西；三条是把口径改对');

const changes = [
  [
    '统计行',
    `只报本套件自己的四项：${FACTS.typePackage.layouts} 版式 · ${FACTS.typePackage.furniture} 家具 · ${FACTS.typePackage.themes} 主题 · ${FACTS.typePackage.demos} 演示`,
    `旧：${FACTS.oldCard.themes} 主题 · ${FACTS.oldCard.elements} 元素 · ${FACTS.oldCard.layouts} 版式 · ${FACTS.oldCard.furniture} 家具`,
  ],
  [
    '元素墙 · 组件层场景墙',
    '从类型包这一页移走，改成一行指路（带 kernel 页链接）',
    `旧：两面墙都摆出来，小字注「补自 kernel」—— 归到了本套件头上`,
  ],
  [
    '版式分节',
    `按版式去重：${FACTS.typePackage.layouts} 条`,
    `旧：${FACTS.oldLayoutRows.length} 行（multi-stat 按场景并列）`,
  ],
  [
    '骨架图说明',
    '例子换成本套件自己的版式',
    '旧：点着内核的 headline',
  ],
];
let cy = 1206;
for (const [what, now, before] of changes) {
  rect(48, cy, W - 96, 48, {fill: C.panel, stroke: C.line, rx: 6});
  text(60, cy + 21, what, {size: 13, weight: 700, fill: C.ink});
  text(60, cy + 39, now, {size: 11.5, fill: C.good});
  text(W - 60, cy + 21, '旧', {size: 11, fill: C.bad, anchor: 'end'});
  text(W - 60, cy + 39, before, {size: 11.5, fill: C.bad, anchor: 'end'});
  cy += 54;
}

// ── 页脚 ────────────────────────────────────────────────────────────────────
rule(48, 1452, W - 96, C.line);
text(
  48,
  1478,
  '⚠ 与 T02 §5 冲突：那条裁定明确要求「合并视图 ＋ 两个分节标题写明补自 kernel」。',
  {size: 12.5, fill: C.warn}
);
text(
  48,
  1500,
  '本图是新意图覆盖它 —— 落地时要留一份记录并同步 showcase/README.md，不是当成 bug 修。',
  {size: 12.5, fill: C.warn}
);
text(
  48,
  1528,
  '本图未落地：generate.ps1 / gallery / verify.mjs 一个字没改；类型包自己 7 条中文名 vs 页面上 44 条仍在。',
  {size: 11.5, fill: C.mute}
);
put('</svg>');

// ── 三条自检：认不出来的图不许写出去 ────────────────────────────────────────
const svg = out.join('\n');
const problems = [];

// ① markdown 的粗体标记漏进 SVG 文字（2026-10-07 在架构草图上踩过一次）
if (svg.includes('**')) {
  problems.push('SVG 文字里出现了 markdown 的 ** 标记');
}
// ② 文字越界（按 est 估宽，右边留 24px；纵向也查 —— 页脚那三行曾经掉到画布外面）
for (const [x, y, s, size, anchor] of CHECKS.bounds) {
  const w = est(s, size);
  const right = anchor === 'middle' ? x + w / 2 : anchor === 'end' ? x : x + w;
  const left = anchor === 'middle' ? x - w / 2 : x;
  if (right > W - 20) {
    problems.push(`文字越出右边界 (${right.toFixed(0)}px)：${s.slice(0, 30)}`);
  }
  if (left < 28) {
    problems.push(`文字越出左边界 (${left.toFixed(0)}px)：${s.slice(0, 30)}`);
  }
  if (y > H - 12) {
    problems.push(`文字掉出下边界 (y=${y} > ${H - 12})：${s.slice(0, 30)}`);
  }
}
// ③ 结构块数量必须与 FACTS 对得上（图上说的数 = FACTS 里的数）
const mustAppear = [
  `${FACTS.typePackage.layouts} 版式 · ${FACTS.typePackage.furniture} 家具 · ${FACTS.typePackage.themes} 主题 · ${FACTS.typePackage.demos} 演示`,
  `${FACTS.oldCard.elements} 元素`,
  `${FACTS.borrowed.elements} 原语`,
  `${FACTS.borrowed.kitScenes} 组件层场景`,
];
for (const m of mustAppear) {
  if (!svg.includes(m)) {
    problems.push(`图上找不到 FACTS 里那个读数的渲染：${m}`);
  }
}
for (const l of FACTS.chips.layouts) {
  if (!svg.includes(l)) {
    problems.push(`图上找不到版式 chip：${l}`);
  }
}

const target =
  process.argv[2] ||
  path.join(__dirname, '..', 'out', 'showcase-review', 'showcase-type-package-sketch.svg');

if (problems.length > 0) {
  console.error('自检没过，拒绝写文件：');
  for (const p of problems) {
    console.error('  ✗ ' + p);
  }
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), {recursive: true});
fs.writeFileSync(target, svg, 'utf8');
console.log(`OK  ${target}`);
console.log(`    ${Buffer.byteLength(svg, 'utf8')} B · ${W}x${H} · 文字 ${CHECKS.bounds.length} 处 · chip ${CHECKS.chips.length} 枚`);
