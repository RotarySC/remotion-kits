#!/usr/bin/env node
/**
 * U1 补丁的**可重复应用**器：把「保存护栏」打进本机那棵依赖树里的 `@remotion/studio-server`。
 *
 * ## 为什么不是 `patch-package`
 *
 * ① 它靠 `git diff` 的**行级上下文**，包版本一变就失败得比较难读；
 * ② 它要有 `postinstall` 挂在自己管的那棵树上 —— 而这里 `node_modules` 是 **junction**
 *    （lab → demo 的物理树，zcode 又指向 lab）；
 * ③ 最要紧的：判据要能分清「**未应用 / 已应用 / 身份不符**」三态。哈希清单分得清，diff 上下文分不清。
 *
 * ⇒ 每条改动都记 `beforeSha256` 与 `afterSha256`：**两个都不等就拒绝**（包版本可能变了），
 * 绝不硬套。事实依据：真 Studio 里那条保存路径**不能**靠「读一遍源码」推断，必须真的打进去量。
 *
 * ## 改哪几处（三处插入 ＋ 一个新模块）
 *
 * | 文件 | 插入 | 作用 |
 * | --- | --- | --- |
 * | `preview-server/sequence-props-watchers.js` | 订阅结果返回前，给 `nodePath` 挂一张票据 | 铸造点（**单点**：三处返回分支都汇到这里） |
 * | `preview-server/routes/save-sequence-props.js` | ① 读文件之后、调 codemod 之前逐条判定；② 写完刷新票据 | 拒绝点 ＋ 续票点 |
 * | `file-watcher.js` | 写盘通知处：**不是保存路由写的**就把该文件票据作废（自家写入要先认得出来，见该处注释） | 别让过期票据冒充有效 |
 * | `preview-server/undo-stack.js` | 撤销 / 重做的写盘口：**序列属性编辑**的恢复带 `__dshSelfRestore` 标记 | 撤销之后护栏**不能**失去抓手（否则「撤销 → 别人包一层 → 再存」就又静默写到包装层） |
 *
 * 用法：
 *   node tools/remotion-u1-guard/apply.cjs --status
 *   node tools/remotion-u1-guard/apply.cjs --apply
 *   node tools/remotion-u1-guard/apply.cjs --revert
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const WORKSPACE = path.resolve(__dirname, "..", "..");
const NM = path.join(WORKSPACE, "remotion-kit-lab", "node_modules", "@remotion", "studio-server", "dist");
const WITHIN = path.join(WORKSPACE, "tools", "remotion-u1-guard");
const STATE = path.join(WITHIN, "state.json");
const BACKUP = path.join(WITHIN, "orig");
const MODULE_SRC = path.join(WITHIN, "guard-module.js");
const MODULE_DST = path.join(NM, "preview-server", "sequence-props-save-guard.js");

const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").toUpperCase();
const read = (p) => fs.readFileSync(p, "utf8");

const EDITS = [
  {
    name: "sequence-props-watchers.js",
    rel: "preview-server/sequence-props-watchers.js",
    // 铸造点：返回订阅结果之前。三处返回分支都汇到这一个 `return initialResult`。
    anchor:
      "    watcherInfo.unwatch = unwatch;\n" +
      "    if (!sequencePropsWatchers[clientId]) {",
    replace:
      "    watcherInfo.unwatch = unwatch;\n" +
      "    // U1 保存护栏：把「解析出这个目标的那份源码」绑进一张票据，随订阅结果递给前端。\n" +
      "    // 前端不认识这个字段（也不影响 `stringifySequenceSubscriptionKey` —— 它只取四个具名字段），\n" +
      "    // 但会把它**原样带回**在保存请求里 —— 实测过（out/u1-roundtrip/readings.md）。\n" +
      "    try {\n" +
      "        const guard = require('./sequence-props-save-guard');\n" +
      "        const guardFile = node_path_1.default.resolve(remotionRoot, fileName);\n" +
      "        if (initialResult && initialResult.nodePath && typeof initialResult.nodePath.nodePath !== 'undefined') {\n" +
      "            initialResult.nodePath.__guard = guard.mintToken({\n" +
      "                file: guardFile,\n" +
      "                contentHash: crypto.createHash('sha256').update(require('node:fs').readFileSync(guardFile, 'utf-8'), 'utf8').digest('hex'),\n" +
      "                nodePath: initialResult.nodePath.nodePath,\n" +
      "            });\n" +
      "        }\n" +
      "    }\n" +
      "    catch (e) {\n" +
      "        renderer_1.RenderInternals.Log.error({ indent: false, logLevel }, 'U1 guard: mint failed: ' + e.message);\n" +
      "    }\n" +
      "    if (!sequencePropsWatchers[clientId]) {",
    extraTop: "const crypto = require('node:crypto');\n",
  },
  {
    name: "routes/save-sequence-props.js",
    rel: "preview-server/routes/save-sequence-props.js",
    // ① 拒绝点：现场读完文件之后、调 codemod 写回之前
    anchor: "        const fileContents = (0, node_fs_1.readFileSync)(absolutePath, 'utf-8');",
    replace:
      "        const fileContents = (0, node_fs_1.readFileSync)(absolutePath, 'utf-8');\n" +
      "        // U1 保存护栏（拒绝点）：位置是前端缓存的那一份，内容却是现场重读的 —— 两者必须对得上。\n" +
      "        // 判据不是「路径还解析得开」（那条路在包装层上照样为真），而是「这份源码还是不是当初那份」。\n" +
      "        for (const edit of group.edits) {\n" +
      "            const verdict = guard.checkEdit({ edit, absolutePath, fileContents });\n" +
      "            if (!verdict.ok) {\n" +
      "                throw new Error(guard.refusalMessage(verdict.detail));\n" +
      "            }\n" +
      "        }",
    // ② 续票点：写盘之后，把该文件尚认得的票据推进到刚写下的内容
    anchor2: "    for (const [absolutePath, output] of outputByPath) {",
    replace2:
      "    for (const [absolutePath, output] of outputByPath) {\n" +
      "        // U1 保存护栏（续票点）：连续拖动会连发保存，每次写完内容都变了 —— 不推进就等于\n" +
      "        // 第二次拖动被自家上一次写入拒掉。位置与身份都没变，只推进内容哈希。\n" +
      "        try { guard.refreshTokensForFile(absolutePath, output); } catch (e) { }",
    // ⚠️ 相对路径数清楚：本文件在 `dist/preview-server/routes/`，新模块在 `dist/preview-server/`
    // ⇒ 只上一级（`../../` 会指到 `dist/` 去，实测 MODULE_NOT_FOUND）。
    extraTop: "const guard = require('../sequence-props-save-guard');\n",
  },
  {
    name: "file-watcher.js",
    rel: "file-watcher.js",
    // 作废点：**所有**源文件写入都经过这里（`_writeFileAndNotifyFileWatchers` 里的那一次 writeFileSync）。
    // 锚点带上前后两行是为了唯一性（单看那一句可能别处也有）。
    anchor:
      "        var _a;\n" +
      "        (0, node_fs_1.writeFileSync)(file, content);\n" +
      "        const shared = sharedWatchers.get(getRegistryKey(file, false));",
    replace:
      "        var _a;\n" +
      "        (0, node_fs_1.writeFileSync)(file, content);\n" +
      "        try {\n" +
      "            // U1 保存护栏（作废点）：这里经手的是**所有**源文件写入。⚠️ 必须把 content 一起递进去：\n" +
      "            // 保存路由是「**先续票 → 再写盘**」，而写盘这一次调用的末尾就落到这里 ⇒ 第一版认不出自家写入，\n" +
      "            // 于是每保存一次就把该文件的票据全部作废，连带把 U1 要修的那个包装层误写放了回来\n" +
      "            // （读数 out/u1-lifecycle/lifecycle.txt 的 L2 修前那一行）。护栏那边靠 selfWritten\n" +
      "            // 认出「这就是我刚写下的那份」并跳过。\n" +
      "            // ⚠️ 2026-10-06 晚补第二例：**撤销 / 重做一次序列属性编辑**也是自家写，而且写回的是\n" +
      "            // 「同一个调用点该有的那份内容」（路径没动）⇒ 带 `__dshSelfRestore` 标记时改成**续票**。\n" +
      "            // 不作废的理由不只是「别误拒」：作废会让护栏对该文件**失去抓手** —— 撤销之后再有人包一层、\n" +
      "            // 前端拿旧位置保存，就会静默写到包装层上（读数 tools/u1-undo.cjs 的 undo-then-wrap）。\n" +
      "            // 结构性写入（插入 / 复制 / 撤销结构性编辑）不带那个标记 ⇒ 照旧作废（路径可能已经错位）。\n" +
      "            // 红证注入点：DSH_U1_GUARD_NO_SELFRESTORE=1 ⇒ 把它当成第三方写入（旧行为）。\n" +
      "            const guard = require('./preview-server/sequence-props-save-guard');\n" +
      "            if (metadata && metadata.__dshSelfRestore && process.env.DSH_U1_GUARD_NO_SELFRESTORE !== '1') {\n" +
      "                guard.refreshTokensForFile(file, content);\n" +
      "            }\n" +
      "            else {\n" +
      "                guard.invalidateTokensForFile(file, content);\n" +
      "            }\n" +
      "        }\n" +
      "        catch (e) { }\n" +
      "        const shared = sharedWatchers.get(getRegistryKey(file, false));",
  },
  {
    name: "preview-server/undo-stack.js",
    rel: "preview-server/undo-stack.js",
    // 撤销的写盘口（`popUndo`）：给**序列属性编辑**的恢复打上 `__dshSelfRestore`。
    // 锚点里带上 `content: snapshot.oldContents` 这一行 —— 它与 `popRedo` 那一段**逐字相同**，
    // 只差这一个字段，所以两条锚点各自唯一。
    anchor:
      "            (0, file_watcher_1.writeFileAndNotifyFileWatchers)({\n" +
      "                file: snapshot.filePath,\n" +
      "                content: snapshot.oldContents,\n" +
      "                originatorClientId: undefined,\n" +
      "                metadata: snapshot.nodePathRemappings === null\n" +
      "                    ? null\n" +
      "                    : { skipSequencePropsUpdate: true },\n" +
      "            });",
    replace:
      "            (0, file_watcher_1.writeFileAndNotifyFileWatchers)({\n" +
      "                file: snapshot.filePath,\n" +
      "                content: snapshot.oldContents,\n" +
      "                originatorClientId: undefined,\n" +
      "                // U1: 序列属性编辑的撤销 = 自家写回同一处内容（路径没动）⇒ 带标记，护栏续票而不是作废。\n" +
      "                metadata: { ...(snapshot.nodePathRemappings === null ? {} : { skipSequencePropsUpdate: true }), ...(entry.entryType === 'sequence-props' ? { __dshSelfRestore: true } : {}) },\n" +
      "            });",
    // 重做的写盘口（`popRedo`）：同一处理，只是内容是 `newContents`
    anchor2:
      "        (0, file_watcher_1.writeFileAndNotifyFileWatchers)({\n" +
      "            file: snapshot.filePath,\n" +
      "            content: snapshot.newContents,\n" +
      "            originatorClientId: undefined,\n" +
      "            metadata: snapshot.nodePathRemappings === null\n" +
      "                ? null\n" +
      "                : { skipSequencePropsUpdate: true },\n" +
      "        });",
    replace2:
      "        (0, file_watcher_1.writeFileAndNotifyFileWatchers)({\n" +
      "            file: snapshot.filePath,\n" +
      "            content: snapshot.newContents,\n" +
      "            originatorClientId: undefined,\n" +
      "            // U1: 同上 —— 重做也是自家写回同一处内容\n" +
      "            metadata: { ...(snapshot.nodePathRemappings === null ? {} : { skipSequencePropsUpdate: true }), ...(entry.entryType === 'sequence-props' ? { __dshSelfRestore: true } : {}) },\n" +
      "        });",
  },
];

const readState = () => (fs.existsSync(STATE) ? JSON.parse(read(STATE)) : null);

function applyOne(edit, state) {
  const target = edit.absPath;
  const src = read(target);
  const rec = {name: edit.name, absPath: target, beforeSha: sha(target), afterSha: null, backup: null};
  state.files.push(rec);
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));      // ① 先记账
  fs.mkdirSync(BACKUP, {recursive: true});
  // ⚠️ 备份名要**拍平**：`routes/save-sequence-props.js` 当文件名会缺目录、直接 ENOENT
  // （上一版就是这么死在第二个文件上的 —— 记了账、还没打，revert 又得能认出这种半成品）。
  rec.backup = path.join(BACKUP, edit.name.replace(/[\\/]/g, "__"));
  fs.writeFileSync(rec.backup, src);                            // ② 再备份
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

  let out = src;
  const pairs = [[edit.anchor, edit.replace]];
  if (edit.anchor2) { pairs.push([edit.anchor2, edit.replace2]); }
  for (const [a, r] of pairs) {
    const n = out.split(a).length - 1;
    if (n !== 1) { throw new Error(`锚点命中 ${n} 次（必须恰好 1 次）：${edit.name}`); }
    out = out.replace(a, r);
  }
  if (edit.extraTop && !out.includes(edit.extraTop.trim())) { out = edit.extraTop + out; }
  fs.writeFileSync(target, out);                                 // ③ 最后才动文件
  rec.afterSha = sha(target);
  if (rec.afterSha === rec.beforeSha) { throw new Error(`写完哈希没变：${edit.name}`); }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`已打：${edit.name}\n  before ${rec.beforeSha.slice(0, 16)}…\n  after  ${rec.afterSha.slice(0, 16)}…`);
}

const cmd = process.argv[2];

if (cmd === "--apply") {
  if (readState()) { console.error("已经应用过了（先 --revert）"); process.exit(2); }
  const pkg = read(path.join(WORKSPACE, "remotion-kit-lab", "node_modules", "@remotion", "studio-server", "package.json"));
  const version = JSON.parse(pkg).version;
  if (version !== "4.0.523") { console.error(`包版本是 ${version}，这份补丁只针对 4.0.523 —— 拒绝盲套`); process.exit(3); }
  const state = {patch: "u1-save-guard", remotionVersion: version, appliedAt: new Date().toISOString(), files: [], module: MODULE_DST};
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  // 新模块先落地（它不在任何备份里，还原时直接删）
  fs.copyFileSync(MODULE_SRC, MODULE_DST);
  state.moduleSha = sha(MODULE_DST);
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`已装新模块：sequence-props-save-guard.js  ${state.moduleSha.slice(0, 16)}…`);
  for (const e of EDITS) {
    e.absPath = path.join(NM, e.rel.replace(/\//g, path.sep));
    applyOne(e, state);
  }
  console.log("\n补丁已应用。⚠️ 要让 Studio 生效必须**重启**它（服务端在 require 时就把代码读进去了）。");
} else if (cmd === "--revert") {
  const state = readState();
  if (!state) { console.error("没有应用记录"); process.exit(2); }
  let bad = 0;
  for (const f of state.files) {
    const now = sha(f.absPath);
    if (f.afterSha === null) {
      // 「记了账、还没打」的半成品：文件应当还是原样；若不是，就不硬来
      if (now === f.beforeSha) { continue; }
      console.error(`拒绝还原（记了账但没打完，而盘上又变了）：${f.name}`); bad++; continue;
    }
    if (now !== f.afterSha) { console.error(`拒绝还原（当前哈希既不是打完的那份）：${f.name}`); bad++; continue; }
    fs.copyFileSync(f.backup, f.absPath);
    if (sha(f.absPath) !== f.beforeSha) { console.error(`还原后哈希不符：${f.name}`); bad++; continue; }
    console.log(`已还原：${f.name}`);
  }
  if (fs.existsSync(state.module)) { fs.rmSync(state.module); console.log("已删新模块：sequence-props-save-guard.js"); }
  if (bad > 0) { console.error(`有 ${bad} 处没还原（状态文件留着）`); process.exit(5); }
  fs.rmSync(STATE);
  console.log("全部还原，状态文件已清。");
} else if (cmd === "--status") {
  const state = readState();
  console.log(`补丁 u1-save-guard：${state ? `已应用（${state.appliedAt}）` : "未应用"}`);
  if (state) {
    console.log(`  新模块 ${fs.existsSync(state.module) ? "在" : "**不在了**"}`);
    for (const f of state.files) {
      const now = sha(f.absPath);
      const verdict = now === f.afterSha ? "已应用" : now === f.beforeSha ? "未应用" : "都不是（拒绝）";
      console.log(`  ${f.name}: ${verdict}`);
    }
  }
} else {
  console.log("用法：node tools/remotion-u1-guard/apply.cjs --apply | --revert | --status");
  process.exit(1);
}
