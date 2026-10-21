#!/usr/bin/env node
/**
 * AGENTS.md 的**压缩守卫**：压缩/搬家之后，「事实」还在不在。
 *
 * 为什么要它：AGENTS.md 靠「就地压缩 ＋ 整段搬进档案」维持 65536 B 预算，而这两种操作
 * **都能静默丢事实**（一句话被改写得像原意、一个读数被顺手删掉）。定规矩容易，判据难：
 * 「压缩后还是对的」不是可失败的东西。这里把它变成可失败的 —— 把文件里的**事实记号**
 * （反引号里的标识符、路径、数字读数）抽出来做**集合包含检查**：
 *
 *   记号(旧 AGENTS.md) ⊆ 记号(新 AGENTS.md) ∪ 记号(档案)
 *
 * 也就是：**任何离开了本文件的东西，都必须能在档案里找到**；找不到就是丢了（退出码 1）。
 * ⚠️ 这是**必要不充分**条件：它证明「没丢记号」，不证明「改写没改变语义」—— 后者靠人读 diff。
 *
 * 三条判据：
 *   ① 控制：今天这份（旧 == 新）必须**零违规** —— 否则工具本身在误报；
 *   ② 红证：把某个记号从**新文件与档案里一起**抹掉，必须**报出那一个**（--redproof）；
 *   ③ 真跑：--vs <rev> 拿 git 里的旧版本比工作树（默认 HEAD）。
 *
 * 用法：
 *   node tools/agents-check.cjs facts [--vs HEAD] [--all]   # --all 连「只在档案里」的也列出来
 *   node tools/agents-check.cjs refs                        # 文件里提到的 docs/** tools/** 路径是否真的存在
 *   node tools/agents-check.cjs --redproof                  # 上面 ①② 两条自检
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const AGENTS = path.join(ROOT, 'AGENTS.md');
const ARCHIVE = path.join(ROOT, 'docs', 'AGENTS-细节档案-2026-10.md');

const argv = process.argv.slice(2);
const MODE = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'facts';
const REDPROOF = argv.includes('--redproof');
const REV = (() => {
  const i = argv.indexOf('--vs');
  return i >= 0 ? argv[i + 1] : 'HEAD';
})();

// —— 事实记号的定义 ——
const CODE_RE = /`([^`\n]+)`/g;                       // 反引号里的标识符 / 路径 / 命令
const PATH_RE = /(?:docs|tools|out|src|kits|references|showcase|remotion-kit-lab|hotspot-zcode|remotion-kits-v2)[/\\][\w.\-/%\\\u4e00-\u9fff]*/g;
const NUM_RE = /(?<![\d.])\d+(?:\.\d+)?(?![\d.])/g;   // 读数 / 字节数 / 行数 / 帧数

const TRIM = /^[\s"'（(]+|[\s"'）),.;：:、，。]+$/g;

function tokenize(text) {
  const out = new Map(); // token -> 类别
  const add = (t, kind) => {
    const v = t.replace(TRIM, '');
    if (!v || v.length > 120) return;
    if (!out.has(v)) out.set(v, kind);
  };
  for (const m of text.matchAll(CODE_RE)) add(m[1], 'code');
  for (const m of text.matchAll(PATH_RE)) add(m[0], 'path');
  for (const m of text.matchAll(NUM_RE)) add(m[0], 'num');
  return out;
}

const fileText = (p) => fs.readFileSync(p, 'utf8');
const gitText = (rev) => execFileSync('git', ['show', `${rev}:AGENTS.md`], { cwd: ROOT, encoding: 'utf8' });

function compare(before, afterAgents, archive) {
  const B = tokenize(before);
  const A = tokenize(afterAgents);
  const C = tokenize(archive);
  const lost = [];      // 两边都没有 ⇒ 真丢了
  const movedOut = [];  // 本文件里没了、档案里有 ⇒ 搬家
  for (const [tok, kind] of B) {
    if (A.has(tok)) continue;
    if (C.has(tok)) movedOut.push([tok, kind]);
    else lost.push([tok, kind]);
  }
  return { total: B.size, lost, movedOut };
}

function reportLost(lost, before) {
  const lineOf = (tok) => {
    const i = before.indexOf(tok);
    if (i < 0) return '';
    const s = before.lastIndexOf('\n', i) + 1;
    const e = before.indexOf('\n', i);
    return before.slice(s, e < 0 ? i + 60 : e).trim().slice(0, 100);
  };
  for (const [tok, kind] of lost) console.log(`  ✗ [${kind}] ${tok}\n      原句：${lineOf(tok)}`);
}

// ————————————————————————————————— 模式 —————————————————————————————————
if (MODE === 'facts' || REDPROOF) {
  const before = gitText(REV);
  const afterAgents = fileText(AGENTS);
  const archive = fileText(ARCHIVE);

  if (REDPROOF) {
    const ctl = compare(before, afterAgents, archive);
    console.log(`① 控制（旧 == 工作树）：违规 ${ctl.lost.length} 项`);
    const bad = ctl.lost.length !== 0;
    if (bad) reportLost(ctl.lost, before);

    // ② 红证：挑一个**有辨识度的读数**（三位以上、且不是年份），从新文件与档案里一起抹掉
    const nums = [...tokenize(before)].filter(
      ([t, k]) => k === 'num' && t.length >= 3 && !/^20\d\d$/.test(t) && !/^\d{4}-\d{2}-\d{2}$/.test(t),
    );
    const pick = nums.find(([t]) => afterAgents.includes(t) && archive.includes(t));
    if (!pick) throw new Error('红证无法构造：找不到同时出现在两处的三位数字记号');
    const [tok] = pick;
    const cut = (s) => s.split(tok).join('«抹掉»');
    const red = compare(before, cut(afterAgents), cut(archive));
    const hit = red.lost.filter(([t]) => t === tok);
    console.log(`② 红证（把 ${tok} 从新文件与档案里一起抹掉）：报出 ${hit.length} 项（应为 1）`);
    if (hit.length) reportLost(hit, before);

    const ok = !bad && hit.length === 1;
    console.log(ok ? 'SELFTEST PASS（控制零违规 ＋ 红证恰好命中）' : 'SELFTEST FAIL');
    process.exit(ok ? 0 : 1);
  }

  const r = compare(before, afterAgents, archive);
  console.log(`比对 ${REV}:AGENTS.md  →  工作树 AGENTS.md ＋ 档案`);
  console.log(`旧文件事实记号 ${r.total} 个 · 搬到档案 ${r.movedOut.length} 个 · **丢失 ${r.lost.length} 个**`);
  if (argv.includes('--all') && r.movedOut.length) {
    const byKind = {};
    for (const [t, k] of r.movedOut) (byKind[k] ||= []).push(t);
    for (const k of Object.keys(byKind)) console.log(`  · 搬到档案的 [${k}]：${byKind[k].join(' · ')}`);
  }
  if (r.lost.length) {
    reportLost(r.lost, before);
    console.log('FAIL：有记号既不在本文件也不在档案里 —— 要么搬漏了，要么压掉了');
    process.exit(1);
  }
  console.log('PASS：离开本文件的记号全部能在档案里找到（必要不充分：语义还得读 diff）');
  process.exit(0);
}

if (MODE === 'refs') {
  // 文件里提到的路径要**按被测系统自己算出来的那一条**去查 —— 这里的坑是它们有多个根：
  // 仓库根 · `remotion-kit-lab\`（`tools/u1-*.ps1`、`out/*` 指的都是它）· 片子工程 · 技能目录。
  const ROOTS = [
    ROOT,
    path.join(ROOT, 'remotion-kit-lab'),
    path.join(ROOT, 'hotspot-zcode', 'production'),
    path.join(process.env.USERPROFILE || '', '.dsh', 'skills', 'remotion-kits'),
  ].filter((p) => p && fs.existsSync(p));

  const refsOf = (text) => {
    const cand = new Set();
    for (const m of text.matchAll(CODE_RE)) for (const p of m[1].matchAll(PATH_RE)) cand.add(p[0].replace(TRIM, ''));
    for (const m of text.matchAll(PATH_RE)) cand.add(m[0].replace(TRIM, ''));
    return cand;
  };
  const skip = (p) => /[<>*…{}$]/.test(p) || p.endsWith('-') || p.endsWith('/-') || /^node_modules/.test(p);
  const unresolvable = (text) =>
    new Set(
      [...refsOf(text)].filter((p) => !skip(p) && !ROOTS.some((r) => fs.existsSync(path.join(r, p)))),
    );

  const before = unresolvable(gitText(REV));
  const after = unresolvable(fileText(AGENTS));
  const added = [...after].filter((p) => !before.has(p)).sort();
  console.log(
    `refs 比对（${REV} → 工作树；根：${ROOTS.map((r) => path.relative(ROOT, r) || '.').join(' · ')}）`,
  );
  console.log(`  解析不到的引用：旧 ${before.size} 个 → 新 ${after.size} 个（旧有的那些仍列在下面，供人判断）`);
  for (const p of [...before].sort()) console.log(`  · 旧有 · ${p}`);
  if (added.length) {
    for (const p of added) console.log(`  ✗ **本次新增**且解析不到：${p}`);
    console.log('FAIL：新写的引用指向不存在的路径');
    process.exit(1);
  }
  console.log('PASS：没有新增解析不到的引用（判据是「不新增」，不是「全都能解析」—— 旧有的那些是既存状态）');
  process.exit(0);
}

console.log('用法：node tools/agents-check.cjs [facts|refs|--redproof] [--vs REV] [--all]');
process.exit(2);
