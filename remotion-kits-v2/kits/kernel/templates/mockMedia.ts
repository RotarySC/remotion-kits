/**
 * 演示素材 —— **现场画出来的**，技能里没有一个二进制文件。
 *
 * ## 为什么不用真图片
 *
 * 1. **自包含**：套件要能独立验证，不能依赖工程里恰好有某张图；技能发布出去之后也一样；
 * 2. **确定性**：没有解码、没有加载时序、没有外部路径，抽帧结果可复现；
 * 3. **最坏情况更好造**：一张漂亮照片会掩盖问题，而这里可以**故意**塞进最容易坏的形态 ——
 *    深色页头（深底浅字压在浅底上）、1px 细线、九行小字、彩色强调块。
 *    这些东西在缩到 380px 宽时最容易糊掉或被裁掉，正好用来验 `fit` 与描边。
 *
 * 它是 **data URI**（`data:image/svg+xml;utf8,…`）而不是文件路径，所以
 * `MediaStage` 的 `src` 分支走的是**真的 `<Img>`**，不是「没给 src 就画 children」那条退路 ——
 * 两条路要各验一遍，混在一起等于只验了一条。
 *
 * ## 为什么住在 `templates/`
 *
 * 它是**演示内容**，不是组件。`specs.tsx`（声明文件）也引用它 —— 那是**声明**在引用演示素材，
 * 不是运行时组件在依赖模板层，方向没问题。
 */

const ACCENTS = ['#2F6FEB', '#D93A5B', '#00A37A'];
const TITLES = ['Official response', 'Community thread', 'Open letter'];
const LABELS = ['官方回应', '社区讨论', '联署声明'];
const SOURCES = ['@sama · 09-09', 'Hacker News · 1186 分', 'mathandai.org'];

/** 第 `i` 张「网页截图」的主文案 —— 演示里给标签条用 */
export const mockLabel = (i: number) => LABELS[i % LABELS.length];

/** 第 `i` 张「网页截图」的副文案 —— 演示里给标签条用 */
export const mockSource = (i: number) => SOURCES[i % SOURCES.length];

/**
 * 一张程序生成的「网页截图」（**960×720 = 4:3**，data URI）。
 *
 * ⚠️ **故意不是 16:9。** 框是 16:9，内容不是 —— 这样 `fit` 的两条分支在抽帧里**才看得出效果**：
 * `cover` 会裁掉两边、`contain` 会留出边。内容与框同比例时两者长得一模一样，
 * 那个 tunable 就等于**没测到**（夹具的职责是最坏情况，不是最好看）。
 *
 * 九行内容刻意**长度不一**（越往下越短），缩到迷你框时能看出是不是被裁掉了一截。
 */
export const mockShot = (i: number): string => {
  const accent = ACCENTS[i % ACCENTS.length];
  const rows = Array.from({length: 9}, (_, k) => {
    const y = 300 + k * 42;
    return (
      `<rect x="88" y="${y}" width="${330 - k * 9}" height="13" rx="6" fill="#12161d" opacity="0.78"/>` +
      `<rect x="470" y="${y}" width="${150 + (k % 3) * 34}" height="13" rx="6" fill="#8b949e" opacity="0.55"/>` +
      `<rect x="88" y="${y + 22}" width="800" height="1" fill="#e3e6ea"/>`
    );
  }).join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">` +
    `<rect width="960" height="720" fill="#f6f7f9"/>` +
    // 深色页头：深底浅字压在浅底上，缩放时最容易先糊
    `<rect width="960" height="76" fill="#12161d"/>` +
    `<text x="34" y="50" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="28" font-weight="700" fill="#f6f7f9">${TITLES[i % TITLES.length]}</text>` +
    `<rect x="790" y="24" width="140" height="30" rx="6" fill="${accent}"/>` +
    `<text x="860" y="45" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="17" fill="#ffffff">LIVE</text>` +
    // 大标题 + 强调条
    `<text x="88" y="200" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="58" font-weight="700" fill="#12161d">Endorsers</text>` +
    `<rect x="88" y="232" width="96" height="7" fill="${accent}"/>` +
    // 侧栏卡片（1px 细边）
    `<rect x="676" y="150" width="212" height="430" rx="14" fill="#ffffff" stroke="#e3e6ea" stroke-width="1"/>` +
    `<rect x="704" y="188" width="156" height="15" rx="7" fill="#12161d" opacity="0.8"/>` +
    `<rect x="704" y="222" width="120" height="11" rx="5" fill="#8b949e" opacity="0.6"/>` +
    `<rect x="704" y="262" width="156" height="44" rx="10" fill="${accent}"/>` +
    rows +
    // 底部进度条：长度随 i 变，让三张缩略图一眼可分
    `<rect x="88" y="652" width="${240 + i * 70}" height="7" fill="${accent}" opacity="0.9"/>` +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
