#!/usr/bin/env node
/**
 * 拍 README 里的展示页图（`media/showcase-*.jpg` 的原图）。
 *
 * 为什么要有脚本：README 的图会随界面漂移，而**过期的配图比没有更坏** —— 读者照着找不到按钮。
 * 数字/截图能重出一遍的东西，就别指望"当初那张一直对"。
 *
 * 与 `remotion-kits-v2/showcase/verify-*.mjs` 的区别：那些是**验收证据**（fullPage、含断言状态、落 `out/`），
 * 这里拍的是**介绍图**（视口截图、无断言痕迹、落 `media/`）。两者用途不同，不要混用。
 *
 * 用法（先在另一个终端起展示页，见 README「用法 / 展示页」）：
 *   node tools/shoot-readme-figures.mjs [url] [outDir]
 *   node tools/shoot-readme-figures.mjs http://127.0.0.1:18499/ out/readme-figures
 *
 * Playwright 包路径用 `PLAYWRIGHT_PATH` 指（本机不自带）；浏览器优先 Edge（本机没有 Chrome）。
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PLAYWRIGHT_PATH =
  process.env.PLAYWRIGHT_PATH ??
  'C:\\Users\\Rotary\\Documents\\Comprehensive\\Files\\GithubFiles\\career-ops\\node_modules\\playwright';
const BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const {chromium} = require(PLAYWRIGHT_PATH);
const browserExe = BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate));

const url = process.argv[2] ?? 'http://127.0.0.1:18499/';
const outDir = path.resolve(process.argv[3] ?? path.join(here, '..', 'out', 'readme-figures'));
fs.mkdirSync(outDir, {recursive: true});

/**
 * 三张图分别是「总览 / 内核目录 / 工作台」。
 * ⚠️ 工作台那格**开机停在 frame 0**，而 frame 0 所有元素 opacity 全 0（README 已知限制里那条）——
 * 所以要先点一次播放、等一会儿再截，否则拍到的是一块黑板。
 * ⚠️ 必须按 `.play` 选择器点，**不能按坐标扫**：1920×1080 下侧栏底部那颗「切换页面明暗」
 * 也落在左下角同一片区域（y≈1030、x≈27），按位置的循环会先命中它，拍出来是暗色页面。
 */
const shots = [
  {name: '01-overview.png', hash: '#page=overview'},
  {name: '02-kernel.png', hash: '#page=kernel'},
  {name: '03-workbench.png', hash: '#asset=kernel/arrangement/Flow', playFirst: true},
];

const browser = await chromium.launch({
  ...(browserExe ? {executablePath: browserExe} : {}),
  args: ['--force-color-profile=srgb'],
});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

for (const shot of shots) {
  await page.goto(url + shot.hash, {waitUntil: 'networkidle'});
  await page.waitForTimeout(1600); // 字体与缩略图解码
  if (shot.playFirst) {
    await page.locator('.play').first().click();
    await page.waitForTimeout(1500); // 让播放器走到有内容的帧
  }
  const file = path.join(outDir, shot.name);
  await page.screenshot({path: file});
  console.log(shot.name, '→', file, fs.statSync(file).size + ' B');
}

await browser.close();
console.log('done: ' + outDir);
