#!/usr/bin/env node
/**
 * 一次性家务：把 AGENTS.md §5 的**两张历史表**整段搬进细节档案（附录 C.1 / C.2）。
 *
 * 为什么是这两张：§5 的正文只剩「未决项唯一清单是设计文档 §13（现为空）」＋本工作区约束；
 * 那张「自裁动作 → T 项」映射表与「其余活清单」按定义是**历史**（后者全部划掉），
 * 而 AGENTS.md 顶着宿主 65536 B 的指令预算（2026-10-06 已被截断过一次）。
 *
 * 判据：① 搬走的行**逐行零改动**（脚本核对：搬走的行数 ＋ 两侧内容逐行相等）；
 *       ② 正文里的字节数真的降下来；③ 搬完后 §5 仍指向新家。
 *
 * 用法：node tools/agents-s5-to-archive.cjs [--apply]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AGENTS = path.join(ROOT, 'AGENTS.md');
const ARCHIVE = path.join(ROOT, 'docs', 'AGENTS-细节档案-2026-10.md');
const APPLY = process.argv.includes('--apply');

const ag = fs.readFileSync(AGENTS, 'utf8');
const L = ag.split('\n');

const idxOf = (pred, from = 0) => {
  for (let i = from; i < L.length; i++) if (pred(L[i])) return i;
  return -1;
};

// —— 表的边界：按内容找，不按写死的行号（行号会因为别处的编辑而漂）——
const mapStart = idxOf((l) => l.startsWith('| 自裁的 / **2026-10-05'));
let mapEnd = mapStart;
while (mapEnd + 1 < L.length && L[mapEnd + 1].startsWith('|')) mapEnd++;

const listStart = idxOf((l) => l.startsWith('**其余活清单**'));
let listEnd = listStart;
while (listEnd + 1 < L.length && !(L[listEnd + 1] === '' && L[listEnd + 2] === '---')) listEnd++;

if (mapStart < 0 || listStart < 0) throw new Error('找不到表的边界');

const mapBlock = L.slice(mapStart, mapEnd + 1);
const listBlock = L.slice(listStart, listEnd + 1);

const MAP_REPLACEMENT = [
  '> **历史映射表已整段搬走** ⇒ `docs/AGENTS-细节档案-2026-10.md` **附录 C.1**：',
  '> 把自裁过的动作挂回 T01–T09 ＋ 五次「状态对齐」的裁法与判据（含事实约束）。',
  '> **本文件不复制裁定内容** —— 每条的记录文件在各条脚下与 §7 索引。',
];

const LIST_REPLACEMENT = [
  '**未决 / 未做的活**（只留索引；已完成的那批 ⇒ 档案 **附录 C.2**）',
  '',
  '| 活 | 状态 / 去哪看 |',
  '| --- | --- |',
  '| **G09** —— Studio 写回在「结构被第三方改过」时**静默落到包装层** | ⚠️ **发现缺陷**；真实 Studio 流程验证进行中 ⇒ `docs/2026-10-06-量测缺口-逐项读数.md` §1.18 |',
  '| **G15** —— 嵌套 `Flow` 给内层 `sizing="fill"` 会**溢出 43.1px** | 🔧 **当内核布局缺陷修**（2026-10-06）⇒ 同上 §1.14 |',
  '| 更新后**整片渲染重跑**（片子那份 mp4 还是 2026-09-20 的） | 未开工 · 不是裁定项 |',
  '| `-Rollback` 只动文件、**不动基线代次** ⇒ 回滚后基线仍认定工程是新的 | 未开工（读数 ⇒ 同上 §1.13） |',
  '| 探针树（~22 文件）· `out/`（~135 MB）· `.kit-origin`（517.6 KB/代）· 40+ 已合并分支 | 家务，未开工 |',
];

// 从后往前替换，前面的下标才不失效
let out = L.slice();
out.splice(listStart, listEnd - listStart + 1, ...LIST_REPLACEMENT);
out = out.slice();
out.splice(mapStart, mapEnd - mapStart + 1, ...MAP_REPLACEMENT);
const newAgents = out.join('\n');

const archOld = fs.readFileSync(ARCHIVE, 'utf8');
const archNew =
  archOld.replace(/\s*$/, '\n') +
  '\n---\n\n' +
  [
    '## 附录 C · 原 §5 的两张表（2026-10-06 从 AGENTS.md 整段搬出）',
    '',
    '搬出理由：AGENTS.md §5 的正文只剩「未决项唯一清单是设计文档 §13（现为空）」＋本工作区约束；',
    '下面两张按定义是**历史**（C.2 全部已划掉），而 AGENTS.md 顶着宿主 65536 B 的指令预算 ——',
    '2026-10-06 它被**截断过一次**（65306 → 65142 B，尾部 §7 那两行掉了）。',
    '⚠️ **搬出时逐行零改动**，量测口径一并留下；搬运脚本 `tools/agents-s5-to-archive.cjs` 自己核对行数与内容。',
    '',
    '### C.1 自裁动作 → T 项映射（原 §5 第一张表）',
    '',
    '原文导语：**未决项的唯一清单是设计文档 §13**（T01–T09）；**2026-10-05 起全部已裁，那张表是空的** ——',
    '本表是**历史映射**：把自裁过的动作挂回对应的 T 项，并留下裁定要用的事实约束。**当时的倾向全部作废为待裁定。**',
    '',
    ...mapBlock,
    '',
    '### C.2 其余活清单（原 §5 第二张表，2026-10-05 逐条当场复测）',
    '',
    ...listBlock,
    '',
  ].join('\n');

// —— 自检：搬走的每一行都出现在档案里，且只出现一次（按行序核对）——
let cursor = archOld.length > 0 ? 0 : 0;
for (const line of [...mapBlock, ...listBlock]) {
  if (line.trim() === '') continue;
  const at = archNew.indexOf(line, cursor);
  if (at < 0) throw new Error('核对失败：档案里找不到这一行 —— ' + line.slice(0, 60));
  cursor = at + line.length;
}

const before = Buffer.byteLength(ag, 'utf8');
const after = Buffer.byteLength(newAgents, 'utf8');
console.log(`AGENTS.md  ${before} → ${after} B   （−${before - after}）`);
console.log(`搬走 ${mapBlock.length} ＋ ${listBlock.length} 行 · 换上 ${MAP_REPLACEMENT.length} ＋ ${LIST_REPLACEMENT.length} 行`);
console.log(`档案 ${Buffer.byteLength(archOld, 'utf8')} → ${Buffer.byteLength(archNew, 'utf8')} B`);
console.log(`宿主预算 65536 B（2026-10-06 实测可投递上限 65142）⇒ 余量 ${65536 - after} B / 相对 65142 余量 ${65142 - after} B`);

if (APPLY) {
  fs.writeFileSync(ARCHIVE, archNew);
  fs.writeFileSync(AGENTS, newAgents);
  console.log('已写入（AGENTS.md ＋ 档案）');
} else {
  console.log('（--apply 才写盘）');
}
