import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
export async function verifyStructure(page, url, out) {
  const checks = [];
  const check = (name, pass, detail) => {
    checks.push({name, pass: !!pass, detail});
    if (!pass) throw new Error('FAIL ' + name + ': ' + JSON.stringify(detail));
  };
  const go = async (params = {}) => {
    const target = new URL(url);
    target.hash = new URLSearchParams(params).toString();
    await page.goto(target.href);
    await page.waitForFunction(() => window.__DSH_MANIFEST__);
  };
  try {
    await page.evaluate(() => sessionStorage.clear()).catch(() => {});
    await go({page: 'overview'});
    const manifest = await page.evaluate(() => window.__DSH_MANIFEST__);
    check('总览默认表达系统结构', (await page.locator('main h1').innerText()) === '系统总览');
    check('总览没有整库资产瀑布流', (await page.locator('main .asset-card').count()) === 0);
    check(
      '总览移除当前类型包展品区',
      (await page.locator('main [data-pack-card]').count()) === 0 &&
        !(await page.locator('main').innerText()).includes('当前类型包'),
    );
    check(
      '唯一内核有独立入口',
      (await page
        .getByRole('navigation', {name: '系统导航'})
        .getByRole('button', {name: '通用内核', exact: true})
        .count()) === 1,
    );
    check(
      '清单明确唯一内核与类型包集合',
      !!manifest.library?.kernel &&
        manifest.suites.filter((s) => s.role === 'kernel').length === 1 &&
        manifest.library.typePacks.length ===
          manifest.suites.filter((s) => s.role === 'type').length,
    );
    const kernel = manifest.suites.find((s) => s.name === manifest.library.kernel),
      packs = manifest.suites.filter((s) => s.role === 'type');
    check(
      '上半区仍保留三个职责入口',
      (await page.getByRole('navigation', {name: '系统导航'}).getByRole('button').count()) === 3,
    );
    const verifyContext = async (suite) => {
      const actual = [
        ...new Set(manifest.assets.filter((a) => a.owner === suite.name).map((a) => a.kind)),
      ].sort();
      const shown = await page
        .locator('[data-owner-nav="' + suite.name + '"] [data-category]')
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.category).sort());
      check(
        suite.name + ' 侧栏只显示当前归属的自有分类',
        (await page.locator('[data-owner-nav]').count()) === 1 &&
          JSON.stringify(actual) === JSON.stringify(shown),
        {actual, shown},
      );
      check(
        suite.name + ' 分类不显示右侧数字',
        (await page.locator('[data-owner-category] small').count()) === 0 &&
          (await page.locator('[data-owned-kind] .section-heading small').count()) === 0 &&
          (await page
            .locator('[data-owner-category]')
            .evaluateAll((nodes) =>
              nodes.every(
                (n) =>
                  n.children.length === 1 &&
                  n.textContent.trim() === n.firstElementChild.textContent.trim() &&
                  n.getAttribute('aria-label') ===
                    n.dataset.ownerCategory + ' · ' + n.firstElementChild.textContent.trim(),
              ),
            )),
      );
    };
    const toggle = page.locator('[data-type-packs-toggle]');
    check('总览下半区没有元素分类', (await page.locator('[data-sidebar-catalog]').count()) === 0);
    check(
      '类型包入口默认折叠且已改名',
      (await toggle.innerText()).includes('类型包') &&
        !(await toggle.innerText()).includes('目录') &&
        (await toggle.getAttribute('aria-expanded')) === 'false' &&
        (await page.locator('[data-type-pack-link]').count()) === 0,
    );
    await page.screenshot({path: path.join(out, 'overview.png'), fullPage: true});
    const overviewUrl = page.url();
    await toggle.focus();
    await page.keyboard.press('Enter');
    check(
      '键盘展开类型包不改变主页面',
      (await toggle.getAttribute('aria-expanded')) === 'true' &&
        page.url() === overviewUrl &&
        (await page.locator('main').getAttribute('data-page')) === 'overview',
    );
    check(
      '展开列表只列实际类型包',
      JSON.stringify(
        await page
          .locator('[data-type-pack-link]')
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.typePackLink)),
      ) === JSON.stringify(packs.map((p) => p.name)),
    );
    check('总览展开菜单也不显示分类', (await page.locator('[data-sidebar-catalog]').count()) === 0);
    await page.screenshot({path: path.join(out, 'type-packs-menu.png'), fullPage: true});
    await page.keyboard.press('Space');
    check(
      '类型包菜单可以键盘收起',
      (await toggle.getAttribute('aria-expanded')) === 'false' &&
        (await page.locator('[data-type-pack-link]').count()) === 0,
    );
    await page.getByRole('button', {name: '选择类型包 ↗', exact: true}).click();
    check(
      '总览选择类型包按钮展开侧栏列表',
      (await toggle.getAttribute('aria-expanded')) === 'true' && page.url() === overviewUrl,
    );
    for (const pack of packs) {
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      await page.locator('[data-type-pack-link="' + pack.name + '"]').focus();
      await page.keyboard.press('Enter');
      check(
        pack.name + ' 选择后自动收起并保留键盘焦点',
        (await toggle.getAttribute('aria-expanded')) === 'false' &&
          (await page.locator('[data-type-pack-link]').count()) === 0 &&
          (await toggle.evaluate((n) => document.activeElement === n)) &&
          (await page.locator('main').getAttribute('data-page')) === 'type-detail' &&
          new URL(page.url()).hash.includes('tab=' + pack.name),
      );
      await verifyContext(pack);
      check(
        pack.name + ' 默认仅展示自有记录',
        (await page.locator('[data-owned-assets] .asset-card').count()) === pack.owned.length,
        {owned: pack.owned.length},
      );
      const owners = await page
        .locator('[data-owned-assets] .asset-card')
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.owner));
      check(
        pack.name + ' 没混入内核与其他类型包',
        owners.every((owner) => owner === pack.name),
        owners,
      );
      const kinds = [
        ...new Set(manifest.assets.filter((a) => a.owner === pack.name).map((a) => a.kind)),
      ];
      check(
        pack.name + ' 分类只对应实际自有内容',
        (await page.locator('[data-owned-assets] [data-owned-kind]').count()) === kinds.length,
        {kinds},
      );
      check(
        pack.name + ' 依赖在独立区域说明',
        (await page.locator('[data-composition]').count()) === 1 &&
          (await page.locator('[data-composition] .asset-card').count()) === 0,
      );
      check(
        pack.name + ' 说明入口只对应实际存在的文件',
        (await page.locator('[data-pack-guide]').count()) === (pack.guidePath ? 1 : 0),
      );
      if (manifest.assets.some((a) => a.owner === pack.name && a.kind === 'frame'))
        check(
          pack.name + ' 整体演示实际挂载',
          (await page.locator('[data-pack-preview] .native-scene').count()) === 1 &&
            (await page.locator('.demo-error').count()) === 0,
        );
      if (pack.inherited.elements === kernel.name)
        check(
          pack.name + ' 原语依赖指向实际供应方',
          (await page.locator('[data-composition]').innerText()).includes(kernel.name),
        );
    }
    if (packs.length) {
      const pack = packs.find((p) => p.inherited.elements === kernel.name),
        panel = manifest.assets.find(
          (a) => a.owner === kernel.name && a.name === 'Panel' && a.kind === 'primitive',
        );
      if (pack && panel) {
        await go({page: 'type-detail', tab: pack.name});
        for (const card of await page.locator('[data-owned-assets] .asset-card').all()) {
          await card.scrollIntoViewIfNeeded();
          await page.waitForTimeout(80);
        }
        await page.locator('main').evaluate((n) => (n.scrollTop = 0));
        await page.screenshot({path: path.join(out, 'type-detail.png'), fullPage: true});
        await page.locator('[data-dependency-asset="' + panel.id + '"]').click();
        check(
          '从类型包试用内核保留组合情境',
          (await page.locator('[data-context]').innerText()).includes(pack.name) &&
            (await page.locator('.asset-head').innerText()).includes(kernel.name),
        );
        check(
          '试用内核实际使用包主题',
          (await page.locator('#theme option').allTextContents()).join('|') ===
            pack.themeIds.join('|'),
        );
        await page
          .getByRole('button', {name: '返回 ' + pack.name + ' 自有内容', exact: true})
          .click();
        check(
          '返回类型包目录不泄漏内核卡片',
          (await page.locator('[data-owned-assets] .asset-card').count()) === pack.owned.length,
        );
      }
    }
    await go({page: 'kernel', tab: kernel.name});
    await verifyContext(kernel);
    check(
      '内核默认按元素类型分节',
      (await page.locator('main [data-owned-kind]').count()) ===
        new Set(manifest.assets.filter((a) => a.owner === kernel.name).map((a) => a.kind)).size &&
        (await page.locator('[data-owned-assets] .asset-card').count()) === kernel.owned.length,
    );
    for (const suite of [kernel, ...packs]) {
      await go({page: suite.role === 'kernel' ? 'kernel' : 'type-detail', tab: suite.name});
      const kinds = [
        ...new Set(manifest.assets.filter((a) => a.owner === suite.name).map((a) => a.kind)),
      ];
      for (const kind of kinds) {
        await page
          .locator('[data-owner-category="' + suite.name + '"][data-category="' + kind + '"]')
          .click();
        const shown = await page
          .locator('[data-owned-assets] .asset-card')
          .evaluateAll((nodes) =>
            nodes.map((n) => ({owner: n.dataset.owner, kind: n.dataset.kind})),
          );
        check(
          suite.name + '/' + kind + ' 标签导航保留完整自有目录',
          shown.length === manifest.assets.filter((a) => a.owner === suite.name).length &&
            shown.every((a) => a.owner === suite.name) &&
            (await page.locator('[data-owned-kind]').count()) === kinds.length,
          {shown},
        );
        check(
          suite.name + '/' + kind + ' 标签定位到真实分组且链接可重开',
          new URL(page.url()).hash.includes('category=' + kind) &&
            (await page.locator('[data-owned-kind="' + kind + '"]').evaluate((section) => {
              const main = section.closest('main'),
                box = main.getBoundingClientRect(),
                item = section.getBoundingClientRect();
              const target = Math.min(
                main.scrollHeight - main.clientHeight,
                Math.max(0, main.scrollTop + item.top - box.top - 20),
              );
              return (
                Math.abs(main.scrollTop - target) < 2 &&
                item.top < box.bottom &&
                item.bottom > box.top
              );
            })) &&
            (await page.locator('[data-owner-category][aria-current="location"]').count()) === 1,
        );
      }
    }
    await go({page: 'kernel', tab: kernel.name});
    await page.locator('[data-owner-category][data-category="arrangement"]').click();
    check(
      '页内标签保留所有内核分组',
      (await page.locator('[data-owned-assets] .asset-card').count()) === kernel.owned.length,
    );
    await page.locator('main').evaluate((n) => (n.scrollTop = 0));
    await page.waitForTimeout(80);
    const activeAfterScroll = await page
      .locator('[data-owner-category]')
      .evaluateAll(
        (nodes) =>
          nodes.find((n) => n.getAttribute('aria-current') === 'location')?.dataset.category,
      );
    check('手动滚动更新标签高亮', activeAfterScroll === 'primitive', {activeAfterScroll});
    await page.locator('[data-owner-category][data-category="arrangement"]').click();
    check(
      '重复点击同一标签仍定位到分组',
      await page
        .locator('[data-owned-kind="arrangement"]')
        .evaluate(
          (section) =>
            Math.abs(
              section.getBoundingClientRect().top -
                section.closest('main').getBoundingClientRect().top -
                20,
            ) < 2,
        ),
    );
    await page.reload();
    await page.waitForFunction(() => window.__DSH_MANIFEST__);
    check(
      '标签链接刷新仍保留整页并定位',
      (await page.locator('[data-owned-assets] .asset-card').count()) === kernel.owned.length &&
        (await page
          .locator('[data-owned-kind="arrangement"]')
          .evaluate(
            (section) =>
              Math.abs(
                section.getBoundingClientRect().top -
                  section.closest('main').getBoundingClientRect().top -
                  20,
              ) < 2,
          )),
    );
    await page
      .locator('[data-owner-category="' + kernel.name + '"][data-category="arrangement"]')
      .click();
    const flow = manifest.assets.find((a) => a.owner === kernel.name && a.name === 'Flow');
    await page.locator('[data-asset-id="' + flow.id + '"] .card-info').click();
    check(
      '直接使用内核无需先选择类型包',
      (await page.locator('[data-live-flow]').count()) === 1 &&
        (await page.locator('main').getAttribute('data-page')) === 'kernel',
    );
    check(
      '工作台只保留工作台和对照按钮',
      JSON.stringify(await page.locator('.views button').allTextContents()) ===
        JSON.stringify(['工作台', '对照']) &&
        (await page.getByRole('button', {name: '画廊', exact: true}).count()) === 0 &&
        (await page.getByRole('button', {name: '返回内核目录', exact: true}).count()) === 1,
    );
    await page.getByRole('button', {name: '对照', exact: true}).click();
    await page.getByRole('button', {name: '工作台', exact: true}).click();
    await page.getByRole('button', {name: '返回内核目录', exact: true}).click();
    check(
      '移除画廊后返回入口仍打开完整目录',
      (await page.locator('[data-owned-assets] .asset-card').count()) === kernel.owned.length,
    );
    await page.locator('[data-owner-category][data-category="arrangement"]').click();
    await page.locator('[data-asset-id="' + flow.id + '"] .card-info').click();
    await page.getByRole('textbox', {name: '搜索能力'}).fill('Panel');
    check(
      '跨包搜索单独标明归属',
      (await page.locator('[data-search-owner="' + kernel.name + '"]').count()) === 1,
    );
    const panel = manifest.assets.find(
      (a) => a.owner === kernel.name && a.name === 'Panel' && a.kind === 'primitive',
    );
    await page.locator('[data-search-owner] [data-asset-id="' + panel.id + '"] .card-info').click();
    check(
      '搜索结果进入真实维护归属',
      (await page.locator('[data-live-panel]').count()) === 1 &&
        (await page.locator('main').getAttribute('data-page')) === 'kernel',
    );
    await page.goBack();
    check(
      '浏览器返回恢复搜索情境',
      (await page.getByRole('textbox', {name: '搜索能力'}).inputValue()) === 'Panel',
    );
    if (packs.length > 1)
      check(
        '多个类型包共享一个内核入口',
        (await page
          .getByRole('navigation', {name: '系统导航'})
          .getByRole('button', {name: '通用内核', exact: true})
          .count()) === 1 && packs.every((p) => manifest.library.typePacks.includes(p.name)),
      );
    await go({page: 'type-index'});
    check(
      '旧类型包目录链接返回总览而非目录主页',
      (await page.locator('main').getAttribute('data-page')) === 'overview' &&
        (await page.locator('[data-sidebar-catalog]').count()) === 0 &&
        (await page.locator('[data-pack-card]').count()) === 0,
    );
    await go({page: 'type-detail', tab: 'missing-pack'});
    check(
      '已删除或未知类型包返回总览',
      (await page.locator('main').getAttribute('data-page')) === 'overview' &&
        (await page.locator('[data-sidebar-catalog]').count()) === 0,
    );
    await go({page: 'kernel', tab: kernel.name});
    await page.setViewportSize({width: 1600, height: 620});
    await toggle.click();
    const scrollbar = await page.locator('.sidebar').evaluate((n) => {
      const thumb = getComputedStyle(n, '::-webkit-scrollbar-thumb'),
        bar = getComputedStyle(n, '::-webkit-scrollbar'),
        track = getComputedStyle(n, '::-webkit-scrollbar-track');
      return {
        width: bar.width,
        radius: thumb.borderTopLeftRadius,
        color: thumb.backgroundColor,
        track: track.backgroundColor,
      };
    });
    check(
      '侧栏使用8px圆角主题滚动条',
      scrollbar.width === '8px' &&
        scrollbar.radius === '8px' &&
        scrollbar.color !== 'rgba(0, 0, 0, 0)' &&
        scrollbar.track === 'rgba(0, 0, 0, 0)',
      scrollbar,
    );
    await page.getByRole('button', {name: '切换页面明暗', exact: true}).click();
    const paperColor = await page
      .locator('.sidebar')
      .evaluate((n) => getComputedStyle(n, '::-webkit-scrollbar-thumb').backgroundColor);
    check('侧栏滚动条随明暗主题换色', paperColor !== scrollbar.color, {
      dark: scrollbar.color,
      paper: paperColor,
    });
    await page.screenshot({path: path.join(out, 'paper-scrollbar.png')});
    await page.getByRole('button', {name: '切换页面明暗', exact: true}).click();
    for (const viewport of [
      {width: 1600, height: 620},
      {width: 900, height: 720},
      {width: 390, height: 620},
    ]) {
      await page.setViewportSize(viewport);
      await go({page: 'kernel', tab: kernel.name});
      check(
        viewport.width + ' 内核目录链接不被旧工作台或筛选覆盖',
        (await page.locator('main [data-owned-assets] .asset-card').count()) ===
          kernel.owned.length,
      );
      const main = page.locator('main'),
        side = page.locator('.sidebar');
      await toggle.click();
      await main.evaluate((n) => (n.scrollTop = 0));
      await side.evaluate((n) => (n.scrollTop = 0));
      const before = await page.evaluate(() => ({
        main: document.querySelector('main').scrollTop,
        side: document.querySelector('.sidebar').scrollTop,
        window: scrollY,
      }));
      const mainBox = await main.boundingBox();
      await page.mouse.move(mainBox.x + 12, mainBox.y + 16);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(160);
      const afterMain = await page.evaluate(() => ({
        main: document.querySelector('main').scrollTop,
        side: document.querySelector('.sidebar').scrollTop,
        window: scrollY,
      }));
      check(
        viewport.width + ' 主区域实际滚动且侧栏不动',
        afterMain.main > before.main && afterMain.side === before.side && afterMain.window === 0,
        {before, afterMain},
      );
      const sideBox = await side.boundingBox();
      await page.mouse.move(sideBox.x + 8, sideBox.y + 16);
      await page.mouse.wheel(0, 480);
      await page.waitForTimeout(160);
      const afterSide = await page.evaluate(() => ({
        main: document.querySelector('main').scrollTop,
        side: document.querySelector('.sidebar').scrollTop,
        window: scrollY,
      }));
      check(
        viewport.width + ' 侧栏实际滚动且主区域不动',
        afterSide.side > afterMain.side &&
          afterSide.main === afterMain.main &&
          afterSide.window === 0,
        {afterMain, afterSide},
      );
      await main.evaluate((n) => (n.scrollTop = n.scrollHeight));
      const boundary = await side.evaluate((n) => n.scrollTop);
      await page.mouse.move(mainBox.x + 12, mainBox.y + 16);
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(120);
      check(
        viewport.width + ' 主区域滚到底不带动外层或侧栏',
        await page.evaluate(
          (sideTop) => scrollY === 0 && document.querySelector('.sidebar').scrollTop === sideTop,
          boundary,
        ),
      );
      await side.focus();
      await side.evaluate((n) => (n.scrollTop = 0));
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(200);
      check(viewport.width + ' 侧栏支持键盘滚动', await side.evaluate((n) => n.scrollTop > 0));
      await main.evaluate((n) => (n.scrollTop = 0));
      await side.evaluate((n) => (n.scrollTop = 0));
      await toggle.click();
      await page.screenshot({path: path.join(out, 'split-' + viewport.width + '.png')});
    }
    for (const width of [900, 390]) {
      await page.setViewportSize({width, height: 1000});
      await go({page: 'overview'});
      check(
        width + ' 总览无横向溢出',
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      );
      await page.screenshot({path: path.join(out, 'structure-' + width + '.png'), fullPage: true});
      if (packs.length) {
        await go({page: 'type-detail', tab: packs[0].name});
        check(
          width + ' 类型包详情无横向溢出',
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
      }
    }
    await fs.writeFile(
      path.join(out, 'structure.json'),
      JSON.stringify({checks, buildId: manifest.buildId}, null, 2),
    );
    return checks;
  } catch (error) {
    await fs.writeFile(
      path.join(out, 'structure.json'),
      JSON.stringify({checks, error: error.stack}, null, 2),
    );
    await page.screenshot({path: path.join(out, 'structure-failure.png'), fullPage: true});
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2),
    url = argv.shift(),
    args = {};
  for (let i = 0; i < argv.length; i++) args[argv[i].slice(2)] = argv[++i];
  const out = path.resolve(args.out ?? 'structure-evidence');
  await fs.mkdir(out, {recursive: true});
  const {chromium} = createRequire(import.meta.url)(args.playwright ?? 'playwright'),
    browser = await chromium.launch({headless: true, executablePath: chromium.executablePath(), ignoreDefaultArgs: ['--hide-scrollbars']}),
    page = await browser.newPage({viewport: {width: 1600, height: 1080}});
  try {
    const checks = await verifyStructure(page, url, out);
    console.log(checks.length + ' 项页面结构断言通过。');
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
