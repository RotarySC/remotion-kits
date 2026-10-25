import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {showcaseDir, exists, digest} from './lib/source.mjs';
import {current} from './lib/build.mjs';
import {verifyStructure} from './verify-structure.mjs';
const argv = process.argv.slice(2),
  args = {};
for (let i = 0; i < argv.length; i++) args[argv[i].replace(/^--/, '')] = argv[++i];
if (!args.project || !args.work) {
  console.error(
    'node verify-pipeline.mjs --project <依赖工程> --work <新夹具目录> --playwright <已有包路径>',
  );
  process.exit(2);
}
const root = path.resolve(args.work);
if (await exists(root)) throw new Error('夹具目录必须不存在，避免写入原有文件');
await fs.mkdir(root, {recursive: true});
const runtime = path.join(root, 'runtime'),
  source = path.join(runtime, 'src/kits'),
  out = path.join(root, 'dist'),
  checks = [],
  buildCli = path.join(showcaseDir, 'build.mjs'),
  base = ['--project', runtime, '--fixture-source', source, '--out', out];
await fs.mkdir(runtime, {recursive: true});
await fs.writeFile(path.join(runtime, 'package.json'), '{}');
await fs.symlink(
  path.resolve(args.project, 'node_modules'),
  path.join(runtime, 'node_modules'),
  'junction',
);
await fs.cp(path.resolve(showcaseDir, '../kits'), source, {recursive: true});
await fs.cp(path.join(source, 'hotspot'), path.join(source, 'second-pack'), {recursive: true});
const minimal = path.join(source, 'minimal-pack');
await fs.mkdir(minimal);
await fs.writeFile(
  path.join(minimal, 'compose.ts'),
  "export const COMPOSE={sources:['../kernel']} as const;\n",
);
await fs.writeFile(
  path.join(minimal, 'motion.ts'),
  'export const beat=(frame:number)=>frame%12;\n',
);
function run(extra = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [buildCli, ...base, ...extra], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let text = '';
    child.stdout.on('data', (data) => (text += data));
    child.stderr.on('data', (data) => (text += data));
    child.on('error', (error) => resolve({code: -1, text: error.message}));
    child.on('exit', (code) => resolve({code, text}));
  });
}
function check(name, value, detail) {
  checks.push({name, pass: !!value, detail});
  console.log((value ? 'PASS ' : 'FAIL ') + name);
  if (!value) throw new Error(name + ': ' + JSON.stringify(detail));
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let watcher,
  browser,
  page,
  url,
  watchLog = '';
async function state() {
  return (await fetch(url + '/__showcase_status')).json();
}
async function until(fn, label, interval = 400) {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {}
    await wait(interval);
  }
  throw new Error('等待超时 ' + label + '\n' + watchLog.slice(-12000));
}
const components = path.join(source, 'kernel/components'),
  specFile = path.join(components, 'specs.tsx'),
  labelFile = path.join(source, 'kernel/labels.ts'),
  flowFile = path.join(components, 'Flow.tsx');
try {
  check('夹具工程没有 Root.tsx', !(await exists(path.join(runtime, 'src/Root.tsx'))));
  check('未构建的新鲜度检查失败', (await run(['--check'])).code === 3);
  const initial = await run();
  check('无 Root 的独立构建通过', initial.code === 0, initial.text);
  const baseline = await current(out);
  check(
    '唯一内核与多个类型包显式分类',
    baseline.library.kernel === 'kernel' &&
      baseline.suites.filter((s) => s.role === 'kernel').length === 1 &&
      baseline.library.typePacks.length === 3,
  );
  check(
    '局部类型包只拥有一项动效',
    baseline.suites.find((s) => s.name === 'minimal-pack').owned.length === 1 &&
      baseline.assets.find((a) => a.owner === 'minimal-pack').kind === 'motion',
  );
  check(
    '不存在的内核声明被拒绝',
    (await run(['--kernel', 'missing-kernel', '--discover'])).code === 1,
  );
  await fs.unlink(path.join(minimal, 'compose.ts'));
  const missingComposition = await run(['--discover']);
  const unresolved = JSON.parse(missingComposition.text);
  check(
    '组合声明缺失不会把类型包变成内核',
    missingComposition.code === 2 &&
      unresolved.suites.find((s) => s.name === 'minimal-pack').role === 'type' &&
      unresolved.suites.filter((s) => s.role === 'kernel').length === 1,
  );
  await fs.writeFile(
    path.join(minimal, 'compose.ts'),
    "export const COMPOSE={sources:['../kernel']} as const;\n",
  );
  const focused = await run(['--suite', 'hotspot', '--discover']);
  const focusManifest = JSON.parse(focused.text);
  check(
    '初始包选择不裁掉内核或其他包',
    focused.code === 0 &&
      focusManifest.library.initialSuite === 'hotspot' &&
      focusManifest.assets.length === baseline.assets.length &&
      focusManifest.suites.length === baseline.suites.length,
  );
  check('构建后新鲜度通过', (await run(['--check'])).code === 0);
  check('静态图参数不冒充源变动', (await run(['--check', '--images', '--scale', '1'])).code === 0);
  const flowText = await fs.readFile(flowFile, 'utf8');
  check('Props 重命名负对照确实改变源', flowText.includes('type Props'));
  await fs.writeFile(flowFile, flowText.replace(/\bProps\b/g, 'FlowPublicInput'));
  check('公开类型变化使摘要过期', (await run(['--check'])).code === 3);
  const rename = await run();
  check('私有类型名改变仍可构建', rename.code === 0, rename.text);
  const named = await current(out);
  check(
    'tracks 没因私有类型名而丢失',
    named.assets.find((a) => a.name === 'Flow').publicProps.some((p) => p.name === 'tracks'),
  );
  watcher = spawn(process.execPath, [buildCli, ...base, '--watch', '--port', '0'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  watcher.stdout.on('data', (data) => {
    const text = String(data);
    watchLog += text;
    url ??= text.match(/SHOWCASE_URL=(http:\/\/[^\s]+)/)?.[1]?.replace(/\/$/, '');
  });
  watcher.stderr.on('data', (data) => (watchLog += data));
  await until(() => url, '服务 URL');
  await until(async () => {
    const s = await state();
    return s.phase === 'ready' && !s.pending && s;
  }, '首次监听构建');
  const guideUrl = url + '/__showcase_doc?' + new URLSearchParams({source, pack: 'hotspot'});
  const guide = await fetch(guideUrl);
  check(
    '包说明读取当前清单的真实来源',
    guide.status === 200 &&
      (await guide.text()) === (await fs.readFile(path.join(source, 'hotspot/kit.md'), 'utf8')),
  );
  check(
    '说明拒绝任意来源',
    (await fetch(url + '/__showcase_doc?' + new URLSearchParams({source: root, pack: 'hotspot'})))
      .status === 400,
  );
  check(
    '说明拒绝越过包目录',
    (await fetch(url + '/__showcase_doc?' + new URLSearchParams({source, pack: '../kernel'})))
      .status === 400,
  );
  const watchBaseline = await current(out),
    watchedBytes = await fs.readFile(flowFile);
  await fs.writeFile(flowFile, watchedBytes);
  await wait(4200);
  const unchangedState = await state();
  check(
    '原字节保存不触发构建或新版本',
    unchangedState.phase === 'ready' &&
      !unchangedState.pending &&
      unchangedState.buildId === watchBaseline.buildId,
    unchangedState,
  );
  const req = createRequire(import.meta.url),
    {chromium} = req(args.playwright ?? 'playwright');
  browser = await chromium.launch({
    headless: true,
    executablePath: args.browser ?? chromium.executablePath(),
  });
  page = await browser.newPage();
  const fixtureFlow = baseline.assets.find(
    (a) => a.name === 'Flow' && a.owner === baseline.library.kernel,
  );
  await page.goto(
    url +
      '#' +
      new URLSearchParams({page: 'kernel', tab: baseline.library.kernel, asset: fixtureFlow.id}),
  );
  await page.waitForFunction(() => window.__DSH_MANIFEST__);
  await page.getByRole('button', {name: '长内容', exact: true}).click();
  await page.locator('#title').fill('刷新后保留这段内容');
  const good = await current(out),
    oldHtml = await fs.readFile(path.join(out, 'index.html'));
  await fs.writeFile(
    path.join(components, 'NewPublic.tsx'),
    "import React from 'react';\nexport const NewPublic:React.FC<{text:string}>=({text})=><div>{text}</div>;\n",
  );
  const failure = await until(async () => {
    const s = await state();
    return s.phase === 'failed' && !s.pending && s;
  }, '未登记文件被拒绝');
  check(
    '未 import 的新增文件触发诊断',
    failure.error.includes('NewPublic') && failure.error.includes('未进入 COMPONENT_SPECS'),
    failure.error,
  );
  check(
    '失败保留入口字节和 buildId',
    (await fs.readFile(path.join(out, 'index.html'))).equals(oldHtml) &&
      (await current(out)).buildId === good.buildId,
  );
  await page.waitForSelector('.stale-banner');
  check(
    '旧页面仍有画面且提示不同步',
    (await page.locator('[data-live-flow]').count()) === 1 &&
      (await page
        .locator('.stale-banner')
        .innerText()
        .then((t) => t.includes('NewPublic'))),
  );
  const originalSpec = await fs.readFile(specFile, 'utf8'),
    originalLabels = await fs.readFile(labelFile, 'utf8');
  const item =
    "{name:'NewPublic',display:'block',demoFrame:44,tunable:['text'],purpose:'新增发现的验证夹具',props:[{name:'text',kind:'text',required:true}],Demo:()=> <NewPublic text=\"新能力\"/>},";
  const validSpec =
    "import {NewPublic} from './NewPublic';\n" +
    originalSpec.replace(
      'export const COMPONENT_SPECS: readonly ComponentSpec[] = [',
      'export const COMPONENT_SPECS: readonly ComponentSpec[] = [\n' + item,
    );
  await fs.writeFile(specFile, validSpec);
  await fs.writeFile(
    labelFile,
    originalLabels.replace('elements: {', "elements: {\n    'NewPublic': '新增能力',"),
  );
  const added = await until(async () => {
    const s = await state();
    return s.phase === 'ready' && !s.pending && s.buildId !== good.buildId && (await current(out));
  }, '新增已登记资产');
  check(
    '新增真实资产进入目录',
    added.assets.length === baseline.assets.length + 1 &&
      added.assets.some((a) => a.name === 'NewPublic'),
  );
  await page.waitForFunction((id) => window.__DSH_MANIFEST__?.buildId === id, added.buildId);
  check(
    '成功后自动刷新并保留实例设置',
    (await page.locator('#title').inputValue()) === '刷新后保留这段内容' &&
      (await page
        .getByRole('button', {name: '长内容', exact: true})
        .getAttribute('aria-pressed')) === 'true',
  );
  await wait(4200);
  const settledAfterAdd = await state();
  check(
    '同一次修改没有重复发布',
    (await current(out)).buildId === added.buildId &&
      settledAfterAdd.phase === 'ready' &&
      !settledAfterAdd.pending,
  );
  await fs.writeFile(
    specFile,
    validSpec.replace("name:'text',kind:'text'", "name:'ghost',kind:'text'"),
  );
  const badProp = await until(async () => {
    const s = await state();
    return s.phase === 'failed' && !s.pending && s;
  }, '错误 prop 被拒绝');
  check(
    '实际 Props 拒绝假声明',
    badProp.error.includes('ghost') && (await current(out)).buildId === added.buildId,
    badProp.error,
  );
  await fs.writeFile(specFile, validSpec);
  await until(async () => {
    const s = await state();
    return s.phase === 'ready' && !s.pending && s;
  }, '修复后恢复');
  await fs.rename(
    path.join(components, 'NewPublic.tsx'),
    path.join(components, 'RenamedPublic.tsx'),
  );
  await fs.writeFile(
    path.join(components, 'RenamedPublic.tsx'),
    "import React from 'react';\nexport const RenamedPublic:React.FC<{text:string}>=({text})=><div>{text}</div>;\n",
  );
  await fs.writeFile(specFile, validSpec.replaceAll('NewPublic', 'RenamedPublic'));
  await fs.writeFile(
    labelFile,
    originalLabels.replace('elements: {', "elements: {\n    'RenamedPublic': '改名能力',"),
  );
  const renamed = await until(async () => {
    const s = await state();
    const m = await current(out);
    return (
      s.phase === 'ready' && !s.pending && m.assets.some((a) => a.name === 'RenamedPublic') && m
    );
  }, '重命名');
  check(
    '重命名清除旧展品',
    !renamed.assets.some((a) => a.name === 'NewPublic') &&
      renamed.assets.some((a) => a.name === 'RenamedPublic'),
  );
  await fs.unlink(path.join(components, 'RenamedPublic.tsx'));
  await fs.writeFile(specFile, originalSpec);
  await fs.writeFile(labelFile, originalLabels);
  const removed = await until(async () => {
    const s = await state();
    const m = await current(out);
    return (
      s.phase === 'ready' && !s.pending && !m.assets.some((a) => a.name === 'RenamedPublic') && m
    );
  }, '删除');
  check('删除恢复真实目录数量', removed.assets.length === baseline.assets.length);
  const theme = path.join(source, 'kernel/theme/unregistered.ts');
  await fs.writeFile(
    theme,
    "import type {Theme} from './types';import {defaultDark} from './default';export const ignored:Theme={...defaultDark,name:'forgotten'};\n",
  );
  const themeFail = await until(async () => {
    const s = await state();
    return s.phase === 'failed' && !s.pending && s;
  }, '未登记主题');
  check('未导入主题也会报警', themeFail.error.includes('没有进入 theme/index.ts'), themeFail.error);
  await fs.unlink(theme);
  await until(async () => {
    const s = await state();
    return s.phase === 'ready' && !s.pending && s;
  }, '主题恢复');
  const rejected = await fetch(url + '/__showcase_source', {
    method: 'POST',
    body: JSON.stringify({key: 'arbitrary-outside-path'}),
  });
  check('演示服务不提供来源切换接口', rejected.status === 404);
  // 构建期间改来源：写 A → 等候选目录出现 → 写 B，让改动压在在飞构建里。
  // 两个时序点都可能被负载拖慢：轮询错过候选窗口时，改动会落在发布之后（guard 不触发），
  // 这次观测就无效 —— 重试，不把轮询时序当成结论。
  const guardHits = () => (watchLog.match(/构建期间来源再次变化/g) ?? []).length;
  let inFlight = null,
    converged,
    digressed = [],
    attempts = 0;
  while (!inFlight && attempts < 3) {
    attempts++;
    const guardsBefore = guardHits();
    await fs.writeFile(
      flowFile,
      Buffer.concat([watchedBytes, Buffer.from(`\n// concurrent A${attempts}\n`)]),
    );
    await until(async () => (await state()).phase === 'building', '构建期间修改的起点');
    const inFlightDigest = await digest({project: runtime, source, suite: ''});
    const candidate = await until(
      async () =>
        (await fs.readdir(path.join(out, 'builds'))).find((name) =>
          name.startsWith(inFlightDigest.slice(0, 12)),
        ),
      '来源快照已读完，候选目录已建立',
      80,
    );
    const publishedAtWrite = await current(out);
    await fs.writeFile(
      flowFile,
      Buffer.concat([watchedBytes, Buffer.from(`\n// concurrent B${attempts}\n`)]),
    );
    // 一次等待同时确认空闲与一致，并记录期间出现过的每次「发布摘要 ≠ 当前来源」。
    // 不在等待之后再读一次摘要来比对：两次分开读之间的窗口正是这条断言先前偶发红的位置。
    // 监听没反应过就谈不上「吞掉」：写入落盘到事件到达之间，页面仍停在上一个版本。
    let acknowledged = false;
    digressed = [];
    converged = await until(async () => {
      const s = await state();
      if (s.phase !== 'ready' || s.pending) {
        acknowledged = true;
        return null;
      }
      const published = await current(out);
      if (!published) return null;
      const actual = await digest({project: runtime, source, suite: ''});
      if (published.sourceDigest !== actual) {
        if (acknowledged)
          digressed.push({
            published: published.buildId,
            digest: published.sourceDigest.slice(0, 12),
            actual: actual.slice(0, 12),
          });
        return null;
      }
      return acknowledged ? {published, actual} : null;
    }, '构建期间的新修改最终同步');
    if (publishedAtWrite?.buildId !== candidate && guardHits() > guardsBefore) inFlight = candidate;
  }
  check('中途变更的过时候选没有发布', !!inFlight, {尝试次数: attempts, 过时候选: inFlight});
  check(
    '构建期间的新修改没有被失败摘要吞掉',
    !!inFlight && digressed.length === 0 && converged.published.buildId !== inFlight,
    {
      尝试次数: attempts,
      过时候选: inFlight,
      已发布: converged.published.buildId,
      发布摘要: converged.published.sourceDigest.slice(0, 12),
      来源摘要: converged.actual.slice(0, 12),
      等待期间的分歧: digressed.slice(0, 5),
    },
  );
  const settled = await current(out);
  await wait(4200);
  const quiet = await state();
  check(
    '追赶完成后监听恢复稳定',
    (await current(out)).buildId === settled.buildId && quiet.phase === 'ready' && !quiet.pending,
    quiet,
  );
  check('最终摘要新鲜', (await run(['--check'])).code === 0);
  const structure = await verifyStructure(page, url, root);
  check(
    '多个类型包的页面语义验收通过',
    structure.every((c) => c.pass),
    {assertions: structure.length},
  );
  await fs.writeFile(
    path.join(root, 'verification.json'),
    JSON.stringify({checks, url, buildId: (await current(out)).buildId, watchLog}, null, 2),
  );
  console.log(checks.length + ' 项管线断言通过。');
} catch (error) {
  await fs.writeFile(
    path.join(root, 'verification.json'),
    JSON.stringify({checks, error: error.stack, watchLog}, null, 2),
  );
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await browser?.close();
  watcher?.kill();
}
// 夹具和证据保留供复核；node_modules 是 junction，不做递归删除。
