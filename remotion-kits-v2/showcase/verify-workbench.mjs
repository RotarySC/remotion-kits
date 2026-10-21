import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

export async function verifyWorkbench(page, url, out) {
  await fs.mkdir(out, {recursive: true});
  const checks = [];
  function check(name, pass, detail) {
    checks.push({name, pass: !!pass, detail});
    if (!pass) throw Error('FAIL ' + name + ': ' + JSON.stringify(detail));
  }
  async function go(asset, scope = asset.owner) {
    await page.goto(url);
    await page.evaluate(() => sessionStorage.clear());
    const next = new URL(url);
    next.hash = new URLSearchParams({tab: scope, asset: asset.id});
    await page.goto(next.href);
    await page.waitForSelector('.inspector');
    await page.waitForTimeout(170);
  }
  async function range(value) {
    await page.locator('[aria-label="预览帧"]').evaluate((n, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
        n,
        String(value),
      );
      n.dispatchEvent(new Event('input', {bubbles: true}));
      n.dispatchEvent(new Event('change', {bubbles: true}));
    }, value);
    await page.waitForTimeout(170);
  }
  const progress = () => page.locator('.player-bar code').innerText();
  const suggestions = () =>
    page.locator('[data-trial-asset]').evaluateAll((ns) => ns.map((n) => n.dataset.trialAsset));
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__DSH_MANIFEST__);
    const manifest = await page.evaluate(() => window.__DSH_MANIFEST__);
    const flow = manifest.assets.find((a) => a.name === 'Flow');
    await go(flow);
    check('新打开的演示进度为0', /^0 \/ /.test(await progress()), await progress());
    await range(45);
    await page.reload();
    await page.waitForSelector('.inspector');
    check('同一展品刷新保留临时进度', /^45 \/ /.test(await progress()), await progress());
    await page.getByRole('button', {name: '重置当前试验', exact: true}).click();
    check('重置试验回到0', /^0 \/ /.test(await progress()), await progress());
    await range(45);
    const nextItem = page.locator('[data-trial-asset]').nth(1);
    await nextItem.click();
    check('选择下一展品回到0', /^0 \/ /.test(await progress()), await progress());
    const offset = manifest.assets.find((a) => a.demonstrations?.some((d) => d.from > 0));
    check('存在非零全局起点的真实场景', !!offset);
    await go(offset);
    const scene = offset.demonstrations.find((d) => d.from > 0);
    await page.locator('#demo').selectOption(scene.id);
    const actualFrame = +(await page.locator('[aria-label="预览帧"]').inputValue());
    check(
      '切换场景从相对0开始并保留全局起点',
      /^0 \/ /.test(await progress()) && actualFrame === scene.from,
      {progress: await progress(), actualFrame, scene},
    );
    const kinds = [
      'primitive',
      'arrangement',
      'layout',
      'frame',
      'furniture',
      'theme',
      'skin',
      'motion',
      'example',
    ];
    for (const suite of manifest.suites) {
      const ordered = kinds.flatMap((kind) =>
        manifest.assets.filter((a) => a.owner === suite.name && a.kind === kind),
      );
      const last = ordered.length - 1;
      const indices = [
        ...new Set([
          0,
          Math.floor(last / 2),
          ...Array.from({length: Math.min(4, ordered.length)}, (_, n) => last - n),
        ]),
      ];
      for (const index of indices) {
        await go(ordered[index]);
        const ids = await suggestions();
        const expected =
          index + 4 <= ordered.length ? ordered.slice(index, index + 4) : ordered.slice(-4);
        check(
          suite.name + '/' + index + ' 四项窗口与目录顺序一致',
          JSON.stringify(ids) === JSON.stringify(expected.map((a) => a.id)),
          {ids, expected: expected.map((a) => a.id)},
        );
        check(
          suite.name + '/' + index + ' 当前项高亮且归属正确',
          (await page.locator('[data-trial-asset].active').getAttribute('data-trial-asset')) ===
            ordered[index].id && ids.every((id) => suite.owned.includes(id)),
        );
      }
    }
    await go(flow);
    await page.getByRole('button', {name: '用法', exact: true}).click();
    await page.locator('.inspector summary').click();
    for (const width of [1600, 1000]) {
      await page.setViewportSize({width, height: 850});
      const geometry = await page.evaluate(() => {
        const p = document.querySelector('.preview').getBoundingClientRect(),
          i = document.querySelector('.inspector').getBoundingClientRect(),
          t = document.querySelector('.related').getBoundingClientRect();
        return {preview: p.toJSON(), inspector: i.toJSON(), trials: t.toJSON()};
      });
      check(
        width + ' 实例试验对齐预览并止于试一试底部',
        Math.abs(geometry.preview.top - geometry.inspector.top) < 1 &&
          Math.abs(geometry.trials.bottom - geometry.inspector.bottom) < 1,
        geometry,
      );
    }
    const overflow = await page.locator('.inspector').evaluate((n) => ({
      client: n.clientHeight,
      content: n.scrollHeight,
      overflow: getComputedStyle(n).overflowY,
      scrollbar: getComputedStyle(n).scrollbarWidth,
      pseudo: getComputedStyle(n, '::-webkit-scrollbar').display,
    }));
    check(
      '实例试验溢出裁切且隐藏滚动条',
      overflow.content > overflow.client &&
        overflow.overflow === 'auto' &&
        overflow.scrollbar === 'none' &&
        overflow.pseudo === 'none',
      overflow,
    );
    await page.locator('.inspector').hover();
    const mainBefore = await page.locator('.workspace').evaluate((n) => n.scrollTop);
    await page.mouse.wheel(0, 230);
    await page.waitForTimeout(180);
    const scroll = await page.locator('.inspector').evaluate((n) => n.scrollTop);
    check(
      '实例试验原生滚轮滚动且不带动主区',
      scroll > 0 && (await page.locator('.workspace').evaluate((n) => n.scrollTop)) === mainBefore,
      {scroll, mainBefore},
    );
    await page.locator('.inspector').focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(180);
    check(
      '隐藏滚动条后仍可键盘滚动',
      await page.locator('.inspector').evaluate((n) => n.scrollTop > 230),
      await page.locator('.inspector').evaluate((n) => n.scrollTop),
    );
    await page.screenshot({path: path.join(out, 'workbench-overflow.png'), fullPage: true});
    await page.setViewportSize({width: 1600, height: 1080});
    await go(manifest.assets.find((a) => a.name === 'ScrollArea'));
    await page.locator('.workspace').evaluate((n) => {
      const p = n.querySelector('.preview');
      n.scrollTop += p.getBoundingClientRect().top - n.getBoundingClientRect().top - 12;
    });
    await page.screenshot({path: path.join(out, 'workbench-aligned.png'), fullPage: true});
    for (const width of [900, 390]) {
      await page.setViewportSize({width, height: 850});
      check(
        width + ' 工作台无横向溢出',
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      );
      check(
        width + ' 窄屏试验栏有高度限制',
        await page
          .locator('.inspector')
          .evaluate((n) => n.clientHeight <= 420 && n.clientHeight > 200),
      );
      await page.locator('.inspector').scrollIntoViewIfNeeded();
      await page.screenshot({path: path.join(out, 'workbench-' + width + '.png'), fullPage: true});
    }
    await fs.writeFile(
      path.join(out, 'workbench.json'),
      JSON.stringify({checks, buildId: manifest.buildId}, null, 2) + '\n',
    );
    return checks;
  } catch (error) {
    await fs.writeFile(
      path.join(out, 'workbench.json'),
      JSON.stringify({checks, error: error.stack}, null, 2) + '\n',
    );
    await page.screenshot({path: path.join(out, 'workbench-failure.png'), fullPage: true});
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [url, ...argv] = process.argv.slice(2),
    args = {};
  for (let i = 0; i < argv.length; i++) args[argv[i].slice(2)] = argv[++i];
  const {chromium} = createRequire(import.meta.url)(args.playwright ?? 'playwright');
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromium.executablePath(),
    ignoreDefaultArgs: ['--hide-scrollbars'],
  });
  try {
    const page = await browser.newPage({viewport: {width: 1600, height: 1080}});
    const checks = await verifyWorkbench(page, url, path.resolve(args.out ?? 'workbench-evidence'));
    console.log(checks.length + ' 项工作台检查通过。');
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
