import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  showcaseDir,
  slash,
  exists,
  dependencies,
  digest,
  discover,
  programFor,
  diagnostics,
} from './source.mjs';

export async function current(out) {
  try {
    const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
    const id = html.match(/data-build-id="([\w-]+)"/)?.[1];
    if (!id) return null;
    const manifest = JSON.parse(
      await fs.readFile(path.join(out, 'builds', id, 'manifest.json'), 'utf8'),
    );
    return manifest;
  } catch {
    return null;
  }
}
export async function fresh(config) {
  const published = await current(config.out),
    sourceDigest = await digest(config);
  return {fresh: published?.sourceDigest === sourceDigest, published, sourceDigest};
}
async function atomic(file, contents) {
  const tmp = file + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  await fs.writeFile(tmp, contents);
  await fs.rename(tmp, file);
}
function importModule(file, alias) {
  return `import * as ${alias} from ${JSON.stringify(slash(file))};`;
}
export function entryFor(manifest, runtime, render = false) {
  const imports = [],
    registry = [];
  let i = 0;
  if (render) imports.push("import {registerRoot} from 'remotion';");
  for (const [name, lib] of Object.entries(runtime)) {
    const fields = [],
      elementFields = [],
      exportFields = [];
    for (const [key, m] of Object.entries(lib.modules ?? {})) {
      const alias = 'Lib' + i++;
      imports.push(importModule(m.file, alias));
      if (key === 'components') fields.push(`components:${alias}.COMPONENT_SPECS`);
      if (key === 'theme')
        fields.push(`ThemeProvider:${alias}.ThemeProvider,getTheme:${alias}.getTheme`);
      if (['skins', 'motion'].includes(key)) fields.push(`${key}:${alias}`);
    }
    for (const [key, module] of Object.entries(lib)) {
      if (key === 'modules') continue;
      const alias = 'Live' + i++;
      imports.push(importModule(module.file, alias));
      fields.push(`${key}:${alias}.${module.exportName}`);
    }
    for (const a of manifest.assets.filter(
      (a) => a.owner === name && ['primitive', 'arrangement'].includes(a.kind),
    )) {
      const componentFile = path.join(path.dirname(lib.modules.components.file), a.name + '.tsx'),
        alias = 'Element' + i++;
      imports.push(importModule(componentFile, alias));
      elementFields.push(`${JSON.stringify(a.name)}:${alias}.${a.name}`);
      exportFields.push(`${JSON.stringify(a.name)}:${alias}`);
    }
    registry.push(
      `${JSON.stringify(name)}:{${fields.join(',')},elements:{${elementFields.join(',')}},exports:{${exportFields.join(',')}}}`,
    );
  }
  const model = slash(path.join(showcaseDir, 'gallery/model')),
    app = slash(path.join(showcaseDir, 'gallery', render ? 'render' : 'app'));
  return (
    imports.join('\n') +
    `\nimport {${render ? 'createStillRoot' : 'mount'}} from ${JSON.stringify(app)};\nimport type {Manifest,Registry} from ${JSON.stringify(model)};\nconst manifest:Manifest=${JSON.stringify(manifest)};\nconst registry:Registry={${registry.join(',')}};\n${render ? 'registerRoot(createStillRoot' : 'mount'}({manifest,registry})${render ? ')' : ''};\n`
  );
}
export async function build(config) {
  const sourceDigest = await digest(config),
    found = await discover(config),
    {manifest, runtime, ts} = found;
  if (manifest.warnings.length) throw new Error('来源校验失败：\n' + manifest.warnings.join('\n'));
  manifest.sourceDigest = sourceDigest;
  manifest.generatedAt = new Date().toISOString();
  manifest.buildId =
    sourceDigest.slice(0, 12) +
    '-' +
    Date.now().toString(36) +
    '-' +
    crypto.randomBytes(2).toString('hex');
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-showcase-')),
    candidate = path.join(config.out, 'builds', manifest.buildId);
  const {esbuild} = dependencies(config.project);
  try {
    const entry = path.join(work, 'entry.tsx');
    await fs.writeFile(entry, entryFor(manifest, runtime));
    const program = programFor(ts, [entry], config.project),
      errors = diagnostics(ts, program);
    if (errors.length) throw new Error('生成入口类型检查失败：\n' + errors.join('\n'));
    await fs.mkdir(candidate, {recursive: true});
    if (config.images) {
      await renderImages(config, manifest, runtime, work, candidate);
      await fs.writeFile(entry, entryFor(manifest, runtime));
    }
    await esbuild
      .build({
        entryPoints: [entry],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'chrome110',
        jsx: 'automatic',
        minify: true,
        outfile: path.join(candidate, 'bundle.js'),
        nodePaths: [path.join(config.project, 'node_modules')],
        loader: {
          '.mp4': 'dataurl',
          '.png': 'dataurl',
          '.jpg': 'dataurl',
          '.svg': 'dataurl',
          '.webp': 'dataurl',
        },
        define: {'process.env.NODE_ENV': '"production"'},
        metafile: true,
      })
      .then((result) =>
        fs.writeFile(
          path.join(candidate, 'dependencies.json'),
          JSON.stringify(result.metafile, null, 2),
        ),
      );
    if ((await digest(config)) !== sourceDigest)
      throw new Error('构建期间来源再次变化；候选结果未发布，请重建。');
    await fs.writeFile(path.join(candidate, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await fs.writeFile(path.join(candidate, 'index.html'), htmlFor(manifest, 'bundle.js'));
    await atomic(
      path.join(config.out, 'index.html'),
      htmlFor(manifest, `builds/${manifest.buildId}/bundle.js`),
    );
    console.log(
      `已发布 ${manifest.buildId} · ${manifest.assets.length} 个唯一资产 · ${manifest.suites.map((s) => s.name + ': ' + s.layoutCount + ' 版式 / ' + s.layoutSceneCount + ' 场景').join(' · ')} · ${manifest.notes.length} 条覆盖提示`,
    );
    return manifest;
  } finally {
    const resolved = path.resolve(work),
      tempRoot = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(tempRoot) || !path.basename(resolved).startsWith('kit-showcase-'))
      throw new Error('拒绝清理非构建临时目录');
    await fs.rm(resolved, {recursive: true, force: true});
  }
}
function htmlFor(m, bundle) {
  return `<!doctype html><html lang="zh-CN" data-build-id="${m.buildId}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>套件能力目录</title></head><body><div id="root"></div><script src="${bundle}"></script></body></html>`;
}
async function renderImages(config, manifest, runtime, work, candidate) {
  const {req} = dependencies(config.project),
    {bundle} = req('@remotion/bundler'),
    {selectComposition, renderStill, openBrowser} = req('@remotion/renderer');
  const entry = path.join(work, 'render-entry.tsx');
  await fs.writeFile(entry, entryFor(manifest, runtime, true));
  const errors = diagnostics(
    req('typescript'),
    programFor(req('typescript'), [entry], config.project),
  );
  if (errors.length) throw new Error('抽帧入口类型检查失败：\n' + errors.join('\n'));
  const serveUrl = await bundle({
    entryPoint: entry,
    onProgress: () => {},
    webpackOverride: (options) => ({
      ...options,
      resolve: {
        ...options.resolve,
        modules: [path.join(config.project, 'node_modules'), 'node_modules'],
      },
    }),
  });
  const output = path.join(candidate, 'assets');
  await fs.mkdir(output, {recursive: true});
  manifest.images = {};
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    browserExecutable = (await exists(edge)) ? edge : undefined,
    puppeteerInstance = await openBrowser('chrome', {
      browserExecutable,
      chromiumOptions: {gl: 'angle'},
    });
  try {
    const selected = config.suite ? manifest.suites.find((s) => s.name === config.suite) : null;
    for (const asset of manifest.assets.filter(
      (a) => a.demoIds.length && (!selected || selected.refs.includes(a.id)),
    )) {
      const themeSuite = manifest.suites.find((s) => s.name === asset.owner) ?? manifest.suites[0],
        theme = themeSuite.themeIds[0];
      const inputProps = {
          assetId: asset.id,
          themeSuite: themeSuite.name,
          themeId: theme,
          demoId: asset.demoIds.includes('experiment') ? 'experiment' : asset.demoIds[0],
        },
        composition = await selectComposition({
          serveUrl,
          id: 'KitGalleryStill',
          inputProps,
          browserExecutable,
          puppeteerInstance,
        }),
        filename = crypto.createHash('sha256').update(asset.id).digest('hex').slice(0, 14) + '.png';
      await renderStill({
        composition,
        serveUrl,
        inputProps,
        frame: Math.min(asset.demoFrame, composition.durationInFrames - 1),
        output: path.join(output, filename),
        imageFormat: 'png',
        scale: config.scale,
        browserExecutable,
        puppeteerInstance,
      });
      manifest.images[asset.id] = `builds/${manifest.buildId}/assets/${filename}`;
    }
  } finally {
    await puppeteerInstance.close({silent: true});
  }
}
