import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const argv = process.argv.slice(2),
  url = argv.shift(),
  args = {};
for (let i = 0; i < argv.length; i++) args[argv[i].replace(/^--/, '')] = argv[++i];
if (!url) {
  console.error('node verify.mjs <URL> --playwright <已有 Playwright 包路径> --out <证据目录>');
  process.exit(2);
}
const req = createRequire(import.meta.url),
  {chromium} = req(args.playwright ?? 'playwright'),
  out = path.resolve(args.out ?? 'showcase-evidence');
await fs.mkdir(out, {recursive: true});
const browser = await chromium.launch({
  headless: true,
  executablePath: args.browser ?? chromium.executablePath(),
  args: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
});
const context = await browser.newContext({
    viewport: {width: 1600, height: 1080},
    deviceScaleFactor: 1,
  }),
  page = await context.newPage(),
  errors = [],
  warnings = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
function check(name, value, detail) {
  checks.push({name, pass: !!value, detail});
  if (!value) throw new Error('FAIL ' + name + ': ' + JSON.stringify(detail));
}
async function settle() {
  await page.waitForTimeout(160);
}
async function range(selector, value) {
  await page.locator(selector).evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
      element,
      String(value),
    );
    element.dispatchEvent(new Event('input', {bubbles: true}));
    element.dispatchEvent(new Event('change', {bubbles: true}));
  }, value);
  await settle();
}
async function open(asset, scope = 'all') {
  const next = new URL(url);
  next.hash = new URLSearchParams({tab: scope, asset});
  await page.goto(next.href);
  await page.waitForFunction(() => window.__DSH_MANIFEST__);
  await page.getByRole('button', {name: '工作台', exact: true}).click();
  await page.getByRole('button', {name: '参数', exact: true}).click();
  if (await page.getByRole('button', {name: '重置当前试验', exact: true}).count())
    await page.getByRole('button', {name: '重置当前试验', exact: true}).click();
  await settle();
}
async function flowSizes() {
  return page.locator('[data-live-flow]').evaluate((root) => {
    const main = root.querySelector('[data-space-main]'),
      note = root.querySelector('[data-space-note]'),
      panels = [main.parentElement.parentElement, note.parentElement.parentElement];
    return {
      height: root.offsetHeight,
      rows: panels.map((n) => n.offsetHeight),
      note: note.offsetHeight,
      grid: getComputedStyle(panels[0].parentElement).gridTemplateRows,
    };
  });
}
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__DSH_MANIFEST__);
  const manifest = await page.evaluate(() => window.__DSH_MANIFEST__);
  check(
    '公开资产 id 唯一',
    new Set(manifest.assets.map((a) => a.id)).size === manifest.assets.length,
  );
  check(
    '0 WARN 且保留覆盖提示',
    manifest.warnings.length === 0 && manifest.notes.some((n) => n.includes('省略')),
    {warnings: manifest.warnings, notes: manifest.notes.length},
  );
  const flow = manifest.assets.find((a) => a.name === 'Flow'),
    panel = manifest.assets.find((a) => a.name === 'Panel'),
    scroll = manifest.assets.find((a) => a.name === 'ScrollArea'),
    motion = manifest.assets.find((a) => a.name === 'fadeUp');
  check(
    '公开 Props 可读 tracks 与 ratio',
    flow.publicProps.some((p) => p.name === 'tracks') &&
      flow.publicProps.some((p) => p.name === 'ratio'),
  );
  check(
    '明确唯一内核',
    manifest.library.kernel && manifest.suites.filter((s) => s.role === 'kernel').length === 1,
  );
  for (const suite of manifest.suites.filter((s) => s.role === 'type')) {
    const next = new URL(url);
    next.hash = new URLSearchParams({page: 'type-detail', tab: suite.name});
    await page.goto(next.href);
    await page.waitForFunction(() => window.__DSH_MANIFEST__);
    check(
      suite.name + ' 自有目录数量',
      (await page.locator('[data-owned-assets] .asset-card').count()) === suite.owned.length,
      {expected: suite.owned.length},
    );
    check(
      suite.name + ' 自有目录没有补入资产',
      await page
        .locator('[data-owned-assets] .asset-card')
        .evaluateAll((nodes, owner) => nodes.every((n) => n.dataset.owner === owner), suite.name),
    );
  }
  await open(flow.id);
  const short = await flowSizes();
  await page.getByRole('button', {name: '长内容', exact: true}).click();
  const long = await flowSizes();
  check(
    '内容轨道增高，主轨道让出空间',
    long.note > short.note && long.rows[1] > short.rows[1] && long.rows[0] < short.rows[0],
    {short, long},
  );
  await range('#height', 760);
  const taller = await flowSizes();
  check(
    'Flow 消费父级高度',
    taller.height === 760 &&
      taller.rows[0] > long.rows[0] &&
      Math.abs(taller.rows[1] - long.rows[1]) < 2,
    taller,
  );
  await page.getByRole('button', {name: '等分', exact: true}).click();
  const equal = await flowSizes();
  check('等分等高', Math.abs(equal.rows[0] - equal.rows[1]) < 2, equal);
  await page.getByRole('button', {name: '2 : 1', exact: true}).click();
  const ratio = await flowSizes();
  check('2:1 分配生效', Math.abs(ratio.rows[0] / ratio.rows[1] - 2) < 0.03, ratio);
  await page.getByRole('button', {name: '剩余 + 内容', exact: true}).click();
  await page.locator('#title').fill('这是当前调用的内容');
  check(
    '编辑标题改变实际画面',
    await page
      .locator('[data-space-main]')
      .innerText()
      .then((t) => t.includes('这是当前调用的内容')),
  );
  await page.screenshot({path: path.join(out, 'workbench.png'), fullPage: true});
  await page.getByRole('button', {name: '对照', exact: true}).click();
  const compare = await page
    .locator('[data-space-note]')
    .evaluateAll((nodes) => nodes.map((n) => n.offsetHeight));
  check('对照两份实际内容高度不同', compare.length === 2 && compare[1] > compare[0], compare);
  await page.screenshot({path: path.join(out, 'compare.png'), fullPage: true});
  await open(panel.id);
  await page.locator('#skin').selectOption('corner-marks');
  const before = await page
    .locator('[data-live-panel]')
    .evaluate((n) => getComputedStyle(n.parentElement.parentElement).borderRadius);
  await page.locator('#radius').check();
  const after = await page
    .locator('[data-live-panel]')
    .evaluate((n) => getComputedStyle(n.parentElement.parentElement).borderRadius);
  check('实例圆角覆盖真实皮', after === '22px' && before !== after, {before, after});
  for (const suite of manifest.suites)
    for (const theme of suite.themeIds) {
      await open(flow.id, suite.name);
      await page.locator('#theme').selectOption(theme);
      check(
        suite.name + '/' + theme + ' 可挂载',
        (await page.locator('[data-live-flow]').count()) === 1 &&
          (await page.locator('.demo-error').count()) === 0,
      );
    }
  await open(scroll.id);
  await page.getByRole('button', {name: '长内容', exact: true}).click();
  await page.locator('#anchor').selectOption('middle');
  await settle();
  const metrics = await page.locator('[data-scroll-metrics]').evaluate((n) => ({
    content: +n.dataset.contentSize,
    viewport: +n.dataset.viewportSize,
    scroll: +n.dataset.scroll,
  }));
  check(
    'ScrollArea 测量有效且不越底',
    metrics.viewport > 0 &&
      metrics.content > metrics.viewport &&
      metrics.scroll > 0 &&
      metrics.scroll <= metrics.content - metrics.viewport,
    metrics,
  );
  const anchor = await page.locator('[data-anchor-index="6"]').evaluate((n) => ({
    rect: n.getBoundingClientRect().toJSON(),
    box: n.closest('[data-live-scroll]').getBoundingClientRect().toJSON(),
  }));
  check(
    '锚点实际进入窗口',
    anchor.rect.top >= anchor.box.top - 1 && anchor.rect.bottom <= anchor.box.bottom + 1,
    anchor,
  );
  await page.locator('#anchor').selectOption('manual');
  await range('[aria-label="预览帧"]', 0);
  await range('#scroll', 0);
  const atStart = await page.locator('[data-scroll-metrics]').getAttribute('data-scroll');
  await range('[aria-label="预览帧"]', 89);
  const atEnd = await page.locator('[data-scroll-metrics]').getAttribute('data-scroll');
  check(
    '逐帧滚到底',
    +atStart === 0 && Math.abs(+atEnd - (metrics.content - metrics.viewport)) < 2,
    {atStart, atEnd},
  );
  await open(motion.id);
  await range('#start', 30);
  await range('[aria-label="预览帧"]', 29);
  const hidden = await page
    .locator('[data-live-motion]')
    .evaluate((n) => getComputedStyle(n).opacity);
  await range('[aria-label="预览帧"]', 60);
  const shown = await page.locator('[data-live-motion]').evaluate((n) => ({
    opacity: getComputedStyle(n).opacity,
    translate: getComputedStyle(n).translate,
  }));
  check(
    '公共动效起点与时长生效',
    hidden === '0' && shown.opacity === '1' && /^0px(?: 0px)?$/.test(shown.translate),
    {hidden, shown},
  );
  await page.getByRole('button', {name: '用法', exact: true}).click();
  check(
    '调用示意有实际参数',
    await page
      .locator('.inspector pre')
      .innerText()
      .then((t) => t.includes('startInFrames: 30')),
  );
  await page
    .getByRole('navigation', {name: '系统导航'})
    .getByRole('button', {name: '系统总览', exact: true})
    .click();
  await page.getByRole('textbox', {name: '搜索能力'}).fill('ScrollArea');
  check('搜索过滤', (await page.locator('.asset-card').count()) === 1);
  await page.getByRole('textbox', {name: '搜索能力'}).fill('');
  for (const suite of manifest.suites) {
    const categories = [
      ...new Set(manifest.assets.filter((a) => a.owner === suite.name).map((a) => a.kind)),
    ];
    for (const category of categories) {
      const next = new URL(url);
      next.hash = new URLSearchParams({
        page: suite.role === 'kernel' ? 'kernel' : 'type-detail',
        tab: suite.name,
        category,
      });
      await page.goto(next.href);
      await page.waitForFunction(() => window.__DSH_MANIFEST__);
      const groupCards = page.locator('[data-owned-kind="' + category + '"] .asset-card');
      for (const card of await groupCards.all()) {
        await card.scrollIntoViewIfNeeded();
        await settle();
      }
      check(
        suite.name + '/' + category + ' 自有分组数量正确且无错误边界',
        (await groupCards.count()) ===
          manifest.assets.filter((a) => a.owner === suite.name && a.kind === category).length &&
          (await page.locator('.demo-error').count()) === 0,
      );
    }
  }
  const gallery = new URL(url);
  gallery.hash = new URLSearchParams({
    page: 'kernel',
    tab: manifest.library.kernel,
    category: 'arrangement',
  });
  await page.goto(gallery.href);
  await page.waitForFunction(() => window.__DSH_MANIFEST__);
  await settle();
  await page.screenshot({path: path.join(out, 'gallery.png')});
  for (const asset of manifest.assets.filter((a) => a.kind === 'layout'))
    for (const demo of asset.demoIds) {
      await open(asset.id, asset.owner);
      await page.locator('#demo').selectOption(demo);
      await settle();
      check(
        asset.id + '/' + demo + ' 实际场景挂载',
        (await page.locator('.demo-error').count()) === 0 &&
          (await page
            .locator('.preview')
            .innerText()
            .then((t) => t.length > 20)),
      );
    }
  check(
    '显式节奏溢出仍诊断',
    warnings.some((t) => t.includes('末条来不及出现')),
  );
  const unexpected = warnings.filter(
    (t) => !t.includes('[套件]') || !/末条来不及出现|ratio|比例|非正|Fragment|align|fill/.test(t),
  );
  check('无非预期警告', unexpected.length === 0, unexpected);
  check('运行与控制台无错误', errors.length === 0, errors);
  await open(flow.id);
  await page.locator('.sync-button').click();
  check('同步详情打开', await page.locator('dialog').isVisible());
  await page.getByRole('button', {name: '关闭同步详情'}).click();
  check('同步详情关闭', !(await page.locator('dialog').isVisible()));
  await page.keyboard.press('/');
  check(
    '键盘搜索',
    await page
      .getByRole('textbox', {name: '搜索能力'})
      .evaluate((n) => n === document.activeElement),
  );
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.locator('#title').click();
  await page.getByRole('button', {name: '播放', exact: true}).click();
  check(
    '减少动态设置生效',
    await page
      .locator('.toast')
      .innerText()
      .then((t) => t.includes('减少动态')),
  );
  for (const width of [900, 390]) {
    await page.setViewportSize({width, height: 1000});
    await settle();
    const size = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    check(width + ' 无横向页面溢出', size.scroll <= size.width + 1, size);
    await page.screenshot({path: path.join(out, 'responsive-' + width + '.png'), fullPage: true});
  }
  await fs.writeFile(
    path.join(out, 'verification.json'),
    JSON.stringify({url, buildId: manifest.buildId, checks, errors, warnings}, null, 2),
  );
  console.log(`${checks.length} 项通过；0 运行错误；${warnings.length} 条已识别套件诊断。`);
} catch (error) {
  await page.screenshot({path: path.join(out, 'failure.png'), fullPage: true});
  await fs.writeFile(
    path.join(out, 'verification.json'),
    JSON.stringify({url, checks, errors, warnings, error: error.stack}, null, 2),
  );
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await browser.close();
}
