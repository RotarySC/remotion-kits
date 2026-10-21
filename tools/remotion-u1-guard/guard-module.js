"use strict";
/**
 * U1 保存护栏 —— 拒绝「拿着**过期目标**」的保存请求。
 *
 * ## 它防的是什么（复现过的形状）
 *
 * 保存路由的行为是：**内容现场重读，位置用前端缓存的那一份**。所以当别人在两次编辑之间
 * 改了盘上那个文件（例如把目标元素包进一层 `<div>`），旧的 `nodePath` 仍然解析得开 ——
 * 只是解到了包装层，于是属性**静默写到 `<div>` 上**、不报错。
 * 前端那条护栏（文件一变就作废选中态）只覆盖 ≥1 s 的时序，实测有 **<1 s 的窗口**。
 *
 * ## 判据：**这份源码还是不是当初解析出那个目标的那一份**
 *
 * 订阅时服务端就已经读过这份文件 ⇒ 那一刻把「文件内容的哈希」连同一个随机票据记下，
 * 票据塞进返回给前端的 `nodePath` 对象里。保存时：
 *
 *   · 票据**认得**，且当前内容哈希**等于**票据里那个  ⇒ 通过（那个位置就是当初那个位置）；
 *   · 票据**认得**，但哈希**不等**                        ⇒ **拒绝**（文件在那之后变过）；
 *   · 票据**不认得**                                     ⇒ 放行，并**记一笔 miss**。
 *
 * 第三态为什么是放行而不是拒绝：票据只活在本进程内（Studio 重启、或那次订阅早于本补丁都会没有），
 * 一律拒绝等于把「开着 Studio 就不能编辑」变成规矩 —— 那正是方案 §1 明令不做的创作限制。
 * 代价如实记：**那些情形退回今天的行为**，并且**每次落进第三态都会在服务端终端喊一句**
 * （每个文件只喊一次，见 `warnNoToken`）＋ `getStats().noToken` 计数。
 * ⚠️ **2026-10-06 晚实测更正**：上面这半句原来写的是「miss 计数会出现在日志里」——**当时是假的**：
 * `getStats()` 到处都没人调，落进第三态**一点声音都没有**（＝「静默地没有保护」，与被修的缺陷同族）。
 * 现在补上了 `warnNoToken`，并把它变成一条可证伪的读数（`tools/u1-thirdstate.ps1`）。
 *
 * ## 自家写入要「续票」，别人的写入不能
 *
 * 连续拖动会连发多次保存，每次写完文件内容都变了 —— 若就此让票据过期，第二次拖动就会被拒。
 * 所以**每次成功写完，服务端把票据里记的哈希推进到刚写下的那份**（票据 id 不变，前端不用配合）。
 * ⚠️ **这句话 2026-10-06 之前只是「写了」**：续票点跑在写盘**之前**，而写盘那一次调用末尾
 * 就把票据作废了 ⇒ 续票当场被抹掉，第二次保存其实走的是第三态（放行）。现在作废点会认出自家写入，
 * 续票才真的生效（判据：第二次保存的 `reason` 是 `content-unchanged`，不是 `no-token`）。
 * 反过来，**不是由保存路由写的**那次写入（Studio 自己的插入/复制/撤销，或外部编辑器）
 * 会把该文件的票据**作废**：前者的目的是别误伤正常编辑（接下来落回「放行＋记一笔」），
 * 后者的目的是别让一张过期票据继续冒充有效。
 *
 * ⚠️ 已知边界（写在 README 里，别当成封住了）：
 *   1. 票据表在**进程内存**里 ⇒ Studio 一重启就全没了（退化成「放行 ＋ 喊一句 ＋ 记 miss」）；
 *   2. 「作废」是**按文件**作的 ⇒ 同文件里别的元素的票据也一起失效；
 *   3. 校验与落盘之间仍有缝隙（源码上就是 `await updateMultipleSequenceProps` 那一段）——
 *      挡住的是**已复现的那些时序**，不是「任意并发都安全」；
 *      落进那条缝的第三方写入会被本次保存**覆盖**（写出去的字节＝校验时那份 ＋ 本次编辑），
 *      所以它的后果是「别人的改动丢了」，不是「写到包装层」——
 *      写到包装层需要**校验时**内容就已经变过，而那条路现在是**拒绝**（读数 `tools/u1-seam.ps1`）。
 */

const crypto = require("node:crypto");

const MAX_TOKENS = 500;

/** tokenId → {file, contentHash, nodePath} */
const tokens = new Map();
/** absolutePath(小写) → 内容哈希：**保存路由自己**最近写下的那份 */
const selfWritten = new Map();

let seq = 0;
let stats = {passed: 0, refused: 0, noToken: 0};
/** 已经为哪些文件喊过一次「这次放行的保存没有票据」（避免连续拖动刷屏；一个文件一次就够） */
const warnedNoToken = new Set();

/**
 * 落进第三态时喊一声。**为什么要有这个**：第三态＝「这个元素在重新选中之前没有过期保护」，
 * 而那正是 U1 要修的那个形状 —— 静默地没有保护。它的三个入口（Studio 重启 / 订阅早于本补丁 /
 * 票据表被挤掉）都不该让用户自己猜。模板与拒绝文案同一句「重新选中再改」。
 */
const warnNoToken = (file) => {
  const k = keyOf(file);
  if (warnedNoToken.has(k)) { return false; }
  warnedNoToken.add(k);
  try {
    console.warn(
      `[U1 guard] 放行了一次**没有票据**的保存：${file}\n` +
      `  原因：这次订阅早于本护栏，或 Studio 重启过，或票据表被挤掉（MAX_TOKENS=${MAX_TOKENS}）。\n` +
      `  后果：该元素的「过期编辑」保护在**重新选中它**之前不生效（本次已放行）。`,
    );
  } catch (e) { }
  return true;
};

const hashOf = (content) => crypto.createHash("sha256").update(content, "utf8").digest("hex");
const keyOf = (file) => String(file).replace(/\\/g, "/").toLowerCase();

/**
 * 订阅时调用：把「那一刻的源码」与「那一刻解析出的位置」绑在一起，返回要递给前端的票据。
 */
const mintToken = ({file, contentHash, nodePath}) => {
  seq += 1;
  const id = `${Date.now().toString(36)}-${seq}`;
  tokens.set(id, {file: keyOf(file), contentHash, nodePath});
  while (tokens.size > MAX_TOKENS) {
    const oldest = tokens.keys().next().value;
    tokens.delete(oldest);
  }
  return id;
};

/**
 * Studio 自己写完一个源文件之后调用（保存路由）：把该文件**尚认得**的票据推进到新内容。
 * 只推进内容哈希 —— 位置没变，身份没变。
 */
const refreshTokensForFile = (file, content) => {
  const k = keyOf(file);
  const h = hashOf(content);
  selfWritten.set(k, h);
  let n = 0;
  for (const rec of tokens.values()) {
    if (rec.file === k) { rec.contentHash = h; n += 1; }
  }
  return n;
};

/**
 * **不是**由保存路由写的那次写入（Studio 自己的结构性改动 / 撤销 / 外部编辑器）之后调用：
 * 该文件的票据一律作废 —— 它们所依据的那份源码已经不在了。
 * 之所以作废而不是拒绝到底：否则「Studio 自己插一个镜头」就会让这个文件里所有元素
 * 在重新选中之前一律存不进去（方案 §4.5 明说不能因自家写入误拒）。
 *
 * ⚠️ **但「自家写入」必须先在 `selfWritten` 里认得出来**（2026-10-06 实测修）：
 * 保存路由的顺序是「**先续票 → 再写盘**」，而写盘那一次调用的末尾**就调到过这里**
 * ⇒ 第一版打完补丁之后，**每保存一次，该文件的票据就被作废一次**：连续保存不会误拒
 * （第二态→第三态，结果一样），可是**一张过期票据从此不再拦得住任何东西** ——
 * 保存过一次之后，第三方把包装层加上、前端再拿旧位置保存，就会**静默写到 `<div>` 上**，
 * 即 U1 要修的那个缺陷原样回来（读数：`out/u1-lifecycle/lifecycle.txt`）。
 * ⇒ 判据：这一次写入的内容**就是保存路由刚写下的那份**时，不作废（票据已被续票点推进到它）。
 * 万一外部写入的内容与自家上次写下的一模一样，跳过作废也无害 —— 那份源码**确实**还是票据指的那份。
 */
const invalidateTokensForFile = (file, content) => {
  const k = keyOf(file);
  // 红证注入点（与 `DSH_U1_GUARD_DISABLE` 同族：只在显式设了环境变量时生效）：
  // 设上它 ⇒ 退回「自家写入也一律作废」的旧行为，上面那条缺陷必须回来。
  const ownWrite =
    process.env.DSH_U1_GUARD_OWNWRITE_AS_THIRD !== "1" &&
    typeof content === "string" &&
    selfWritten.get(k) === hashOf(content);
  if (ownWrite) {
    return 0;
  }
  let n = 0;
  for (const [id, rec] of tokens.entries()) {
    if (rec.file === k) { tokens.delete(id); n += 1; }
  }
  return n;
};

/**
 * 保存时逐条判定。`edit.nodePath.__guard` 是订阅时塞进去的那张票据。
 * 返回 {ok:true} 或 {ok:false, reason, detail}。
 */
const checkEdit = ({edit, absolutePath, fileContents}) => {
  // ── 红证用的注入点（与更新器那边的 `KITUPD_CRASH_AT` 同族）：**只在显式设了环境变量时**生效，
  //    正常使用是空操作。它的用途是当场证明「这条拒绝真的在干活」：设上它，缺陷必须回来。
  //    没有它，那条断言就是一句没法证伪的话。
  if (process.env.DSH_U1_GUARD_DISABLE === "1") {
    stats.noToken += 1;
    return {ok: true, reason: "disabled-by-env"};
  }
  const tokenId = edit && edit.nodePath ? edit.nodePath.__guard : null;
  if (typeof tokenId !== "string" || !tokens.has(tokenId)) {
    stats.noToken += 1;
    const warned = warnNoToken(absolutePath);
    return {ok: true, reason: "no-token", tokenId: tokenId || null, warned};
  }
  const rec = tokens.get(tokenId);
  const nowHash = hashOf(fileContents);
  if (rec.contentHash === nowHash) {
    stats.passed += 1;
    return {ok: true, reason: "content-unchanged", tokenId};
  }
  stats.refused += 1;
  return {
    ok: false,
    reason: "source-changed",
    tokenId,
    detail: {
      file: absolutePath,
      expected: rec.contentHash.slice(0, 12),
      actual: nowHash.slice(0, 12),
      target: rec.nodePath,
    },
  };
};

/** 拒绝时给人看的那句话 —— 直接走 `handler.js` 的 `{success:false,error}` 与前端那条通知。 */
const refusalMessage = (detail) =>
  `Could not save: the source file changed after this element was selected ` +
  `(expected ${detail.expected}..., found ${detail.actual}...) — ` +
  `re-select the element in Studio and try again. ` +
  `拒绝写入：源码在这个目标被解析出来之后变过，请重新选中元素再改。`;

const getStats = () => ({...stats, tokens: tokens.size, noTokenFiles: [...warnedNoToken]});
const resetForTests = () => { tokens.clear(); selfWritten.clear(); warnedNoToken.clear(); stats = {passed: 0, refused: 0, noToken: 0}; };

exports.mintToken = mintToken;
exports.refreshTokensForFile = refreshTokensForFile;
exports.invalidateTokensForFile = invalidateTokensForFile;
exports.checkEdit = checkEdit;
exports.refusalMessage = refusalMessage;
exports.getStats = getStats;
exports.resetForTests = resetForTests;
