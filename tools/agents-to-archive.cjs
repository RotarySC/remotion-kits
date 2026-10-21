#!/usr/bin/env node
/**
 * 把 AGENTS.md 里「明细该住档案、原地只该留结论与索引」的整段搬进细节档案。
 *
 * 为什么需要这个工具：AGENTS.md 顶着宿主 65536 B 的指令预算，2026-10-06 一天里**被截断过三次**
 * （65306 / 65469 / 65664 B —— 尾部内容在投递时静默消失）。规矩是「一超过 ~64 KB 就先搬再加」，
 * 而「搬」这件事以前是手写的一次性脚本（`docs\_move_sections.py`，**从未入库**）＋ 手工编辑，
 * 于是：① 每次都重新写一遍边界与核对；② 边界靠写死的行号，别处一编辑就漂。
 *
 * 判据（本脚本自己核对，任一不成立就不写盘）：
 *   ① 每个块的起止标记**各命中且只命中一次**；
 *   ② 块之间不重叠、顺序递增；块内没有空行（空行意味着边界取错了）；
 *   ③ 搬走的每一行（非空）**逐行原样出现在档案里**，且按原顺序；
 *   ④ 搬走的整段**不再出现在 AGENTS.md 里**（「原地不留独自行」）；
 *   ⑤ 换上的每一行都真的在输出里；
 *   ⑥ AGENTS.md 的字节数**真的降了**。
 * ⚠️ 搬家最怕**静默丢内容** —— 所以宁可因为一句话没找到标记而拒绝，也不做「尽力而为」的部分搬运。
 * ⚠️ 已经搬过的块标 `appliedAt`，之后**永不重跑**（标记没了，重跑必然 throw）。
 *
 * 用法：
 *   node tools/agents-to-archive.cjs                       # 只报告（一个字节都不写）
 *   node tools/agents-to-archive.cjs --apply               # 写盘（AGENTS.md ＋ 档案）
 *   node tools/agents-to-archive.cjs --only u1-readings --apply    # 只搬指定块
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AGENTS = path.join(ROOT, 'AGENTS.md');
const ARCHIVE = path.join(ROOT, 'docs', 'AGENTS-细节档案-2026-10.md');
const APPLY = process.argv.includes('--apply');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1].split(',').map((s) => s.trim()) : null;
})();

const HOST_BUDGET = 65536; // 宿主指令预算
const OBSERVED_LIMIT = 65142; // 2026-10-06 实测「还能完整投递」的上限

const ag = fs.readFileSync(AGENTS, 'utf8');
const archOld = fs.readFileSync(ARCHIVE, 'utf8');
if (ag.includes('\r\n') || archOld.includes('\r\n')) {
  throw new Error('本脚本假定 LF 行尾（两份文件实测都是 LF）——发现 CRLF，先确认再说');
}
const L = ag.split('\n');

const idxWhere = (pred, from = 0) => {
  for (let i = from; i < L.length; i++) if (pred(L[i])) return i;
  return -1;
};
const sw = (p) => (l) => l.startsWith(p);
const eq = (s) => (l) => l === s;

// —— 附录登记表：标题与导语住这里；小节标题由块自己带 ——
const APPENDIX = {
  L: {
    title: '## 附录 L · 头部「坐标」区的 T01–T09 明细与四次「状态对齐」（原 AGENTS.md 头部，2026-10-07 搬出）',
    intro: [
      '> 搬出理由：AGENTS.md 头部自己写着「**未决项只有设计文档 §13**」与「**本文件只给索引、不复制裁定内容**」，',
      '> 而那段把 9 条裁定的细节与四次「状态对齐」又抄了一遍（1976 ＋ 2195 B）——2026-10-06 之后余量只剩 949 B。',
      '> ⇒ 原地改成逐条索引（T 号 ＋ 一句话裁法 ＋ 记录文件），**明细整段搬到这里，逐行零改动**。',
      '> 裁法与事实约束的简表另见 **附录 C.1**。',
    ],
  },
  M: {
    title: '## 附录 M · 本文件自己的裁撤史：搬家记账（原 §4 与 §5 头部，2026-10-07 搬出）',
    intro: [
      '> 搬出理由：这段是**本文件自己的记账**（搬了多少行、就地压缩了多少 KB、每次截断发生在多少字节），',
      '> 对「怎么用这个工作区」没有指导作用，但它解释了 §5 那条规矩**为什么存在** ⇒',
      '> 规矩与结论留在 §5，账目搬到这里。',
    ],
  },
  N: {
    title: '## 附录 N · U1 / U2 的逐条读数与套件口径（原 §3.18 / §3.19 明细，2026-10-07 搬出）',
    intro: [
      '> 搬出理由同前几轮：AGENTS.md 原地只留**结论**（判据 / 三态 / 缝的形状 / 按钮的存在与五态 / 零回归与分发都验过），',
      '> 把**逐条读数、套件口径、夹具教训**搬到这里 —— 这也是 §3.9–§3.17 各自的既定做法（附录 D–K）。',
      '> ⚠️ 搬出时**逐行零改动**；证据文档：`docs/2026-10-06-U1-保存护栏-实测证据.md`（§11–§15）·',
      '> `docs/2026-10-06-U2-混合轨道-实测证据.md`。',
    ],
  },
  O: {
    title: '## 附录 O · 更新器事务的逐条口径（原 §1.9 表尾四行，2026-10-07 搬出）',
    intro: [
      '> 搬出理由：这四行与 §3.17 是**同一批事实的两处写法**（§3.17 写着「逐条读数 ⇒ 附录 K」），',
      '> 而 AGENTS.md 只需要一条可用来查的口径 ⇒ 表里留三行摘要，原文整段搬到这里。',
      '> 记录：`docs/2026-10-04-更新器-裁定与执行.md` · `docs/2026-10-06-U4-完整恢复事务-实测证据.md`（附录 K 是它的读数）。',
    ],
  },
};

// —— 块的定义：边界一律按**内容标记**找，不写行号（行号会因别处编辑而漂）——
const BLOCKS = [
  {
    id: 'header-t',
    appliedAt: '2026-10-07',
    appendix: 'L',
    head: '### L.1 T01–T09 的逐条细节（原头部）',
    where: '头部「坐标」区的 T01–T09 逐条细节（原 14–30 行）',
    from: sw('> **T01** 版本化源码分发'),
    until: sw('> **至此 §13 的 T01–T09 全部已裁'),
    replacement: [],
  },
  {
    id: 'header-align',
    appliedAt: '2026-10-07',
    appendix: 'L',
    head: '### L.2 四次「状态对齐」的原文（原头部）',
    where: '头部四次「状态对齐」的四段原文（原 31–48 行）',
    from: sw('> **2026-10-05 另做了一次「状态对齐」（不是新裁定项）**'),
    until: sw('> ⚠️ **两个维度别排成互斥分类**'),
    replacement: [],
  },
  {
    id: 's4-body',
    appliedAt: '2026-10-07',
    appendix: 'M',
    head: '### M.1 原 §4 正文（2026-10-03 快照的去向）',
    where: '§4 正文（快照的去向 ＋ 「哪些是就地压缩掉的」）',
    from: sw('**已搬走** ⇒ `docs/AGENTS-细节档案-2026-10.md` 附录 B'),
    until: eq('---'),
    replacement: [],
  },
  {
    id: 's5-move-log',
    appliedAt: '2026-10-07',
    appendix: 'M',
    head: '### M.2 原 §5 的三次搬家记账（2026-10-06）',
    where: '§5 的三次搬家记账（含已失效的 `docs\\_move_sections.py` 引用）',
    from: sw('> ⚠️ **2026-10-06 搬家的原因**'),
    until: sw('> ⚠️ **规矩重申'),
    replacement: [],
  },

  // ——— 第二轮（2026-10-07）：U1 / U2 的读数与更新器表尾 ———
  {
    id: 'u1-readings',
    appliedAt: '2026-10-07',
    appendix: 'N',
    head: '### N.1 U1（§3.18）的读数：缝 · 前端按钮 · 三个自家写入洞 · 真实 UI',
    where: '§3.18 的读数四节（缝 / 前端按钮 / 三个洞 / 真实 UI，原 341–362 行）',
    from: sw('- ⚠️ **校验与落盘之间那条缝现在有形状了**'),
    until: sw('- **方案 §4 十行对照表**'),
    replacement: [
      '- ⚠️ **校验与落盘之间那条缝有形状了**：缝**不是**同步区 —— 源码上就是 `await updateMultipleSequenceProps` 那一段，',
      '  实测宽 **36–115 ms**；第三方写入落进缝里 ⇒ 保存**成功**、**别人的改动被这次保存覆盖**（last-write-wins），',
      '  而**包装层拿不到属性**（「写到包装层」需要**校验时**内容就已变过 ⇒ 那条路是**拒绝**）。',
      '- ⚠️ **前端没有「撤销历史面板」**（`UndoHistory` 0 命中）：真正的表面是 `components/UndoRedoButtons.js` 那两个按钮',
      '  （状态由 `undo-redo-stack-changed` 推来）—— **两叠都空 ⇒ 整对不在 DOM**，有一叠非空 ⇒ **两个都渲染**、空的只 `disabled`。',
      '  读数：空⇒不在 · 编辑后 `undo=enabled redo=disabled` · `Ctrl+Z` ⇒ 反过来 · `Ctrl+Shift+Z` ⇒ 回新值 · 第三方改盘 ⇒ 整对消失。',
      '- ⚠️ **三个「自家写入被当成别人改的」洞已修**（各有两个红证）：`DSH_U1_GUARD_OWNWRITE_AS_THIRD`（每保存一次票据全死）·',
      '  `DSH_U1_GUARD_NO_SELFRESTORE`（撤销后失去抓手；**序列属性编辑**的恢复改成**续票**，**结构性**撤销照旧作废）。',
      '- **真实 UI 全流程也量到了**：正常编辑 36→42 落盘 · **竞态被拒**（改盘→抬起 **234 ms**）＋ 前端提示 ·',
      '  `Ctrl+Z` ⇒ 36 · `Ctrl+Shift+Z` ⇒ 42。⚠️ 这格长期记成「未量」的根因**不在 Studio，在探针**（⇒ §1.6）。',
      '- 套件：`u1-thirdstate` **24/0**（红证 **19/5**）· `u1-seam` **25/0** · `u1-lifecycle` **33/0** · `u1-undo` **23/0** ·',
      '  `u1-ui-undo-buttons` **15/0** · `u1-ui-check` **10/0**（红证 **9/0**）；工具 `tools/u1-*.ps1`。',
      '- 逐条明细 / 三个入口的构造 / 夹具**两行**同名属性的教训 ⇒ 档案 **附录 N**。',
    ],
  },
  {
    id: 'u2-verify',
    appliedAt: '2026-10-07',
    appendix: 'N',
    head: '### N.2 U2（§3.19）的读数：零回归与分发验证',
    where: '§3.19 的零回归 / 分发 / 记录（原 387–393 行）',
    from: sw('- **零回归**：旧调用 5 个合成 **12 帧相同 / 0 变化**'),
    until: eq('---'),
    replacement: [
      '- **零回归与分发都已验**：旧调用 5 个合成 **12 帧相同 / 0 变化** · 旁证 3 个 **6 帧相同** · 5 个新夹具**全部「该红」**·',
      '  镜像 97 全等 · lab/zcode 更新器「写后验证通过、应用后 0 可更新」· **独立哈希 75/75 逐字节相等** · `tsc` 0/0 ·',
      '  片子合成 7 条（720 帧不变）· 生成器 **0 WARN** · `verify.mjs` 三入口绿。⚠️ 抽样从 **frame 1** 起',
      '  （frame 0 opacity 全 0 ⇒ 拿它比是「两边的空白帧」）；⚠️ 脚本第一版把 after 侧复成了 `HEAD` ⇒ 差点得到**假**的完美零回归。',
      '- 逐条读数 / 5 张读数板与物证清单 / 工具说明 ⇒ 档案 **附录 N**。',
    ],
  },
  {
    id: 'updater-rows',
    appliedAt: '2026-10-07',
    appendix: 'O',
    head: '### O.1 原 §1.9 表尾四行（`-Rollback` / 四趟提交 / 恢复三态 / 故障注入 / 验收 / 红证）',
    where: '§1.9 表尾事务相关的六行（合并成三行摘要）',
    from: sw('| ⚠️ **`-Rollback` 是「未完成事务的恢复」'),
    until: sw('**四条设计上要记住的**'),
    replacement: [
      '| ⚠️ **`-Rollback`** 是「**未完成事务的恢复**」，不是「撤销已提交的更新」 | 四种情形读数 ⇒ §3.17 / **附录 O**：健康工程**空操作** · 已提交的计划**拒绝** · 中断（有第三方编辑）**跳过并原样保留** · 中断（无第三方编辑）**真回滚**；只动文件、**不动基线代次 / manifest** |',
      '| 事务：**四趟提交** ＋ **恢复三态** | 提交序 = **写（各套件）→ 整工程验证一次 → 逐个换清单 → 运行级 `COMMITTED`**；恢复按**逐对象三态**、范围含**来源清单与生效代次**（明细 ⇒ §3.17 / **附录 O**） |',
      '| 验收 · 故障注入 · 红证 | 夹具 **210 项 / 0 失败**（含 9 条**真断点注入**用例）· `KITUPD_CRASH_AT=<点名>` 注入点常驻（用 `[Environment]::Exit(97)`，**不是** `exit`）· **六组红证**全红（顶点改坏 → 跑全套断言）：⚠️ 摘掉的锚点必须**命中且只命中一次**，否则判「红证无效」；套件中途崩了也判无效（不能把「工具坏了」读成「断言没红」——实测踩过两次） |',
    ],
  },
];

// —— 定位与自检 ①②——
const active = BLOCKS.filter((b) => !b.appliedAt && (!ONLY || ONLY.includes(b.id)));
if (!active.length) {
  if (ONLY) throw new Error(`--only 没选中任何块：${ONLY.join(',')}`);
  // 全部块都已到位 —— 这不是失败，是「没有可搬的」
  console.log(`没有可搬的块（${BLOCKS.length} 个块全部已 appliedAt）。`);
  console.log('要再搬，就在 BLOCKS 里加一块（起止标记按**内容**写，不要写行号），再 --only <id>。');
  process.exit(0);
}

let prev = null;
for (const b of active) {
  const s = idxWhere(b.from);
  if (s < 0) throw new Error(`块的起点标记没找到（${b.id}）`);
  if (idxWhere(b.from, s + 1) >= 0) throw new Error(`块的起点标记命中不止一次（${b.id}）—— 无法确定搬哪一段`);
  const u = idxWhere(b.until, s + 1);
  if (u < 0) throw new Error(`块的终点标记没找到（${b.id}）`);
  b.start = s;
  b.end = u - 1;
  while (b.end > b.start && L[b.end].trim() === '') b.end--; // 尾随空行留在原地
  b.lines = L.slice(b.start, b.end + 1);
  if (b.lines.some((l) => l.trim() === '')) throw new Error(`块里有空行（${b.id}）—— 边界取错了`);
  if (!b.replacement.length) throw new Error(`块没给替换文本（${b.id}）`);
}
// 声明顺序不必等于文档顺序 —— 定位之后按**文档位置**排，再查重叠（否则一个早写的块会被误判成重叠）
active.sort((a, b) => a.start - b.start);
for (const b of active) {
  if (prev !== null && b.start <= prev) throw new Error(`块重叠（${b.id}）`);
  prev = b.end;
}

// —— 换掉 AGENTS.md 里的块（从后往前，前面下标才不失效）——
let out = L.slice();
for (const b of [...active].reverse()) {
  out.splice(b.start, b.end - b.start + 1, ...b.replacement);
}
const newAgents = out.join('\n');

// —— 档案：按 appendix 登记表的顺序分组追加 ——
const additions = [];
for (const key of Object.keys(APPENDIX)) {
  const subs = active.filter((b) => b.appendix === key);
  if (!subs.length) continue;
  additions.push('---', '', APPENDIX[key].title, '', ...APPENDIX[key].intro, '');
  for (const b of subs) additions.push(b.head, '', ...b.lines, '');
}
const archBase = archOld.replace(/\s*$/, '\n'); // 记号：新增内容从 archBase.length 之后开始
const archNew = archBase + '\n' + additions.join('\n');

// —— 自检 ③④⑤⑥ ——
for (const b of active) {
  let cursor = archBase.length; // 只在**新增**的那一段里找，免得撞上档案里旧有的同义行
  for (const line of b.lines) {
    if (line.trim() === '') continue;
    const at = archNew.indexOf(line, cursor);
    if (at < 0) throw new Error(`核对失败：档案里找不到这一行（${b.id}）—— ` + line.slice(0, 60));
    cursor = at + line.length;
  }
  if (newAgents.includes(b.lines.join('\n'))) throw new Error(`核对失败：搬走的整段还在 AGENTS.md 里（${b.id}）`);
  for (const line of b.replacement) {
    if (!newAgents.includes(line)) throw new Error(`核对失败：换上的这行不在输出里（${b.id}）—— ` + line.slice(0, 60));
  }
}

const before = Buffer.byteLength(ag, 'utf8');
const after = Buffer.byteLength(newAgents, 'utf8');
if (after >= before) throw new Error(`核对失败：字节数没降（${before} → ${after}）`);

for (const b of active) {
  const mb = Buffer.byteLength(b.lines.join('\n'), 'utf8');
  const rb = Buffer.byteLength(b.replacement.join('\n'), 'utf8');
  console.log(
    `[${b.id}] ${b.where}\n` +
      `   搬走 ${String(b.lines.length).padStart(2)} 行 / ${String(mb).padStart(4)} B  →  换上 ` +
      `${b.replacement.length} 行 / ${rb} B   （−${mb - rb}）`,
  );
}
console.log('');
console.log(`AGENTS.md  ${before} → ${after} B   （−${before - after}）`);
console.log(
  `宿主预算 ${HOST_BUDGET} ⇒ 余量 ${HOST_BUDGET - after} B（相对 2026-10-06 实测可投递上限 ${OBSERVED_LIMIT}：${OBSERVED_LIMIT - after} B）`,
);
console.log(`档案 ${Buffer.byteLength(archOld, 'utf8')} → ${Buffer.byteLength(archNew, 'utf8')} B`);

if (APPLY) {
  fs.writeFileSync(ARCHIVE, archNew);
  fs.writeFileSync(AGENTS, newAgents);
  console.log('已写入（AGENTS.md ＋ 档案）');
} else {
  console.log('（--apply 才写盘）');
}
