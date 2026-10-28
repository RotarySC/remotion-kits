import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire, Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {audit} from './audit.mjs';

export const showcaseDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const slash = (p) => p.replaceAll('\\', '/');
export async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
export async function files(root) {
  if (!(await exists(root))) return [];
  const result = [];
  for (const entry of await fs.readdir(root, {withFileTypes: true})) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const p = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...(await files(p)));
    else if (entry.isFile()) result.push(p);
  }
  return result.sort();
}
export function dependencies(project) {
  const req = createRequire(path.join(project, 'package.json'));
  return {
    req,
    ts: req('typescript'),
    esbuild: req('esbuild'),
    nodeModules: path.dirname(req.resolve('react/package.json')) + '/..',
  };
}
export async function digest(config) {
  const hash = crypto.createHash('sha256');
  hash.update(
    JSON.stringify({
      source: path.resolve(config.source),
      project: config.project,
      suite: config.suite,
      kernel: config.kernel ?? '',
    }),
  );
  const paths = [
    ...(await files(config.source)),
    ...(await files(path.join(showcaseDir, 'gallery'))),
    ...(await files(path.join(showcaseDir, 'lib'))),
    path.join(showcaseDir, 'build.mjs'),
    path.join(showcaseDir, 'generate.ps1'),
    path.join(showcaseDir, 'library.json'),
  ];
  for (const p of paths.sort()) {
    hash.update(slash(p));
    hash.update(await fs.readFile(p));
  }
  const {req} = dependencies(config.project);
  for (const pkg of ['react', 'react-dom', 'remotion', 'typescript', 'esbuild']) {
    // 长期运行的监听进程不能依赖 require 的 JSON 缓存来判断依赖是否更新。
    const metadata = JSON.parse(await fs.readFile(req.resolve(pkg + '/package.json'), 'utf8'));
    hash.update(pkg + metadata.version);
  }
  return hash.digest('hex');
}
function syntax(ts, file, text) {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}
function walk(ts, node, visit) {
  visit(node);
  ts.forEachChild(node, (n) => walk(ts, n, visit));
}
function literal(ts, node, constants = {}) {
  if (!node) return undefined;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isIdentifier(node)) return constants[node.text];
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
    return literal(ts, node.expression, constants);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((n) => literal(ts, n, constants));
  if (ts.isBinaryExpression(node)) {
    const a = literal(ts, node.left, constants),
      b = literal(ts, node.right, constants);
    switch (node.operatorToken.kind) {
      case ts.SyntaxKind.PlusToken:
        return a + b;
      case ts.SyntaxKind.MinusToken:
        return a - b;
      case ts.SyntaxKind.AsteriskToken:
        return a * b;
      case ts.SyntaxKind.SlashToken:
        return a / b;
    }
  }
  return undefined;
}
export async function sequences(ts, file) {
  if (!(await exists(file))) return [];
  const source = syntax(ts, file, await fs.readFile(file, 'utf8')),
    constants = {},
    result = [];
  walk(ts, source, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
      constants[node.name.text] = literal(ts, node.initializer, constants);
  });
  walk(ts, source, (node) => {
    if (!ts.isJsxElement(node) || node.openingElement.tagName.getText(source) !== 'Sequence')
      return;
    const attrs = {};
    for (const a of node.openingElement.attributes.properties)
      if (ts.isJsxAttribute(a))
        attrs[a.name.text] =
          a.initializer && ts.isJsxExpression(a.initializer)
            ? literal(ts, a.initializer.expression, constants)
            : literal(ts, a.initializer, constants);
    const tags = [];
    walk(ts, node, (n) => {
      if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n))
        tags.push(n.tagName.getText(source));
    });
    result.push({
      name: attrs.name || `scene-${result.length + 1}`,
      from: attrs.from ?? 0,
      duration: attrs.durationInFrames,
      layoutTag: tags.find((t) => t.endsWith('Layout')),
      line: source.getLineAndCharacterOfPosition(node.pos).line + 1,
    });
  });
  return result;
}
export function programFor(ts, roots, project) {
  const options = {
    noEmit: true,
    allowImportingTsExtensions: true,
    strict: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
    types: [],
  };
  const host = ts.createCompilerHost(options);
  host.resolveModuleNames = (names, containing) =>
    names.map(
      (name) =>
        ts.resolveModuleName(name, containing, options, ts.sys).resolvedModule ??
        ts.resolveModuleName(name, path.join(project, '__showcase__.tsx'), options, ts.sys)
          .resolvedModule,
    );
  return ts.createProgram(roots, options, host);
}
export function publicProps(ts, program, file, name) {
  const source = program.getSourceFile(file);
  if (!source) return null;
  const checker = program.getTypeChecker(),
    symbol = checker.getSymbolAtLocation(source);
  if (!symbol) return null;
  const exported = checker
    .getExportsOfModule(symbol)
    .find((s) => s.name === name || s.name === 'default');
  if (!exported) return null;
  const type = checker.getTypeOfSymbolAtLocation(exported, exported.valueDeclaration ?? source);
  const signature = checker.getSignaturesOfType(type, ts.SignatureKind.Call)[0];
  if (!signature?.parameters[0]) return null;
  const parameter = signature.parameters[0],
    props = checker.getTypeOfSymbolAtLocation(parameter, parameter.valueDeclaration ?? source);
  const variants = props.isUnion() ? props.types : [props];
  const merged = new Map();
  for (const variant of variants)
    for (const p of checker.getPropertiesOfType(variant))
      merged.set(p.name, {
        name: p.name,
        required: !(p.flags & ts.SymbolFlags.Optional),
        type: checker.typeToString(
          checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration ?? source),
        ),
      });
  return [...merged.values()];
}
export function diagnostics(ts, program) {
  return ts
    .getPreEmitDiagnostics(program)
    .map(
      (d) =>
        `${d.file ? slash(d.file.fileName) + ':' + (d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1) + ' ' : ''}${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`,
    );
}

export async function discover(config) {
  const {ts, esbuild} = dependencies(config.project),
    allFiles = await files(config.source),
    warnings = [],
    notes = [];
  const dirs = (await fs.readdir(config.source, {withFileTypes: true}))
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({name: e.name, dir: path.join(config.source, e.name)}));
  if (!dirs.length) throw new Error('来源根目录中没有套件');
  const declaration = JSON.parse(await fs.readFile(path.join(showcaseDir, 'library.json'), 'utf8'));
  const kernel = config.kernel || declaration.kernel;
  if (
    typeof kernel !== 'string' ||
    path.basename(kernel) !== kernel ||
    !dirs.some((s) => s.name === kernel)
  )
    throw new Error('展示配置必须明确一个存在的内核目录；请检查 library.json 或 --kernel。');
  const imports = [],
    factEntries = [],
    modules = {};
  let index = 0;
  for (const suite of dirs) {
    const m = {};
    for (const [key, relative] of Object.entries({
      components: 'components/specs.tsx',
      theme: 'theme/index.ts',
      labels: 'labels.ts',
      compose: 'compose.ts',
      layouts: 'master/types.ts',
      showcase: 'templates/ShowcaseScenes.tsx',
      skins: 'skins/index.ts',
      motion: 'motion.ts',
      viewport: 'viewport/spec.ts',
    })) {
      const file = path.join(suite.dir, relative);
      if (await exists(file)) {
        const alias = 'M' + index++;
        imports.push(`import * as ${alias} from ${JSON.stringify(slash(file))};`);
        m[key] = {alias, file};
      }
    }
    modules[suite.name] = m;
    factEntries.push(
      `${JSON.stringify(suite.name)}:{${Object.entries(m)
        .map(([k, v]) => `${k}:${v.alias}`)
        .join(',')}}`,
    );
  }
  const contents = imports.join('\n') + `\nexport const facts={${factEntries.join(',')}};`;
  const compiled = await esbuild.build({
    stdin: {contents, resolveDir: config.project, loader: 'tsx'},
    write: false,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    nodePaths: [path.join(config.project, 'node_modules')],
    loader: {
      '.mp4': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.svg': 'dataurl',
      '.webp': 'dataurl',
    },
  });
  const evaluator = new Module(path.join(config.project, '__showcase_facts__.cjs'));
  evaluator.filename = path.join(config.project, '__showcase_facts__.cjs');
  evaluator.paths = Module._nodeModulePaths(config.project);
  evaluator._compile(compiled.outputFiles[0].text, evaluator.filename);
  const facts = evaluator.exports.facts;
  const program = programFor(
    ts,
    allFiles.filter((f) => /\.(ts|tsx)$/.test(f)),
    config.project,
  );
  warnings.push(...diagnostics(ts, program));
  const suites = [],
    assets = [],
    runtime = {},
    byName = new Map(dirs.map((d) => [d.name, d])),
    usedAssetIds = new Set();
  const composeSources = (name) => {
    const declaration = facts[name]?.compose?.COMPOSE?.sources ?? [];
    if (!Array.isArray(declaration)) {
      warnings.push(`${name}/compose.ts: sources 必须是数组`);
      return [];
    }
    return declaration
      .map((relative) => {
        const target = path.resolve(byName.get(name).dir, relative),
          found = dirs.find((d) => d.dir === target);
        if (!found) warnings.push(`${name}/compose.ts: 找不到来源 ${relative}`);
        return found?.name;
      })
      .filter(Boolean);
  };
  function resolveLayer(name, layer, seen = []) {
    if (seen.includes(name)) {
      warnings.push(`compose 来源循环：${[...seen, name].join(' → ')}`);
      return null;
    }
    if (layer === 'elements' && facts[name]?.components?.COMPONENT_SPECS) return name;
    if (layer === 'scenes' && runtime[name]?.KitShowcase) return name;
    for (const origin of composeSources(name)) {
      const found = resolveLayer(origin, layer, [...seen, name]);
      if (found) return found;
    }
    return null;
  }
  for (const suite of dirs) {
    runtime[suite.name] = {};
    for (const [key, relative, exportName] of [
      ['MasterFrame', 'master/MasterFrame.tsx', 'MasterFrame'],
      ['ShowcaseScenes', 'templates/ShowcaseScenes.tsx', 'ShowcaseScenes'],
      ['useShowcaseFurniture', 'templates/ShowcaseScenes.tsx', 'useShowcaseFurniture'],
      ['KitShowcase', 'templates/KitShowcase.tsx', 'KitShowcase'],
      ['Stage', 'components/Stage.tsx', 'Stage'],
      // 三维视图层：宿主组件 + 占位夹具。两个都由展示页直接取用（与母版/场景同一种取法）
      ['Viewport', 'viewport/host.tsx', 'Viewport'],
      ['MockScene', 'templates/mockScene.ts', 'mockScene'],
    ]) {
      const file = path.join(suite.dir, relative);
      if (await exists(file)) runtime[suite.name][key] = {file, exportName};
    }
    runtime[suite.name].modules = modules[suite.name];
  }
  const add = (asset) => {
    if (usedAssetIds.has(asset.id)) {
      warnings.push(`资产 id 重复：${asset.id}`);
      return;
    }
    usedAssetIds.add(asset.id);
    assets.push(asset);
  };
  const label = (name, layer, key) => facts[name]?.labels?.LABELS?.[layer]?.[key];
  const mk = (suite, kind, name, file, extra = {}) => ({
    id: `${suite}/${kind}/${name}`,
    kind,
    owner: suite,
    name,
    label: name,
    purpose: '',
    sourcePath: slash(path.relative(config.source, file)),
    ...extra,
  });
  for (const suite of dirs) {
    const name = suite.name,
      f = facts[name],
      m = modules[name];
    const own = [];
    const push = (a) => {
      add(a);
      own.push(a.id);
    };
    for (const spec of f.components?.COMPONENT_SPECS ?? []) {
      const file = path.join(suite.dir, 'components', spec.name + '.tsx'),
        props = publicProps(ts, program, file, spec.name);
      if (!(await exists(file))) {
        warnings.push(`${name}: ${spec.name} 的登记没有源码 ${file}`);
        continue;
      }
      if (!props) warnings.push(`${name}/${spec.name}: 公开组件类型无法解析`);
      const actual = new Set(props?.map((p) => p.name));
      for (const p of spec.props)
        if (!actual.has(p.name))
          warnings.push(`${name}/${spec.name}: 声明 prop ${p.name} 不存在于公开 Props`);
      for (const p of props ?? [])
        if (!spec.props.some((v) => v.name === p.name))
          notes.push(`${name}/${spec.name}: ${p.name} 未写展示说明`);
      for (const p of spec.tunable)
        if (!spec.props.some((v) => v.name === p))
          warnings.push(`${name}/${spec.name}: tunable ${p} 无对应声明`);
      const cn = label(name, 'elements', spec.name);
      if (!cn) warnings.push(`${name}/labels.ts: elements 缺 ${spec.name}`);
      push(
        mk(name, spec.name === 'Flow' ? 'arrangement' : 'primitive', spec.name, file, {
          label: cn ?? spec.name,
          purpose: spec.purpose,
          props: spec.props,
          publicProps: props ?? [],
          tunable: spec.tunable,
          display: spec.display,
          demoFrame: spec.demoFrame,
          demoIds: [
            'registry',
            ...(['Flow', 'Panel', 'ScrollArea'].includes(spec.name) ? ['experiment'] : []),
          ],
        }),
      );
    }
    const registered = new Set((f.components?.COMPONENT_SPECS ?? []).map((s) => s.name));
    for (const file of allFiles.filter(
      (p) =>
        path.dirname(p) === path.join(suite.dir, 'components') &&
        p.endsWith('.tsx') &&
        path.basename(p) !== 'specs.tsx',
    )) {
      const nameOfFile = path.basename(file, '.tsx');
      if (!registered.has(nameOfFile))
        warnings.push(`${name}/components/${nameOfFile}: 未进入 COMPONENT_SPECS，不能静默遗漏`);
    }
    await audit({
      ts,
      program,
      suite,
      facts: f,
      allFiles: allFiles.filter((p) => p.startsWith(suite.dir + path.sep)),
      publicProps,
      warnings,
      notes,
      controlProps: Object.values(facts).flatMap(
        (item) => item.layouts?.LAYOUT_CONTROL_PROPS ?? [],
      ),
    });
    const layoutScenes = await sequences(ts, path.join(suite.dir, 'templates/ShowcaseScenes.tsx'));
    const sceneLayouts = f.showcase?.SHOWCASE_LAYOUTS ?? [],
      sceneFrames = f.showcase?.SHOWCASE_SCENE_FRAMES ?? 60;
    for (const spec of Object.values(f.layouts?.LAYOUT_SPECS ?? {})) {
      const demonstrations = sceneLayouts
        .map((n, i) =>
          n === spec.name
            ? {
                id: 'scene-' + i,
                name: layoutScenes[i]?.name ?? spec.name,
                from: layoutScenes[i]?.from ?? i * sceneFrames,
                duration: layoutScenes[i]?.duration ?? sceneFrames,
              }
            : null,
        )
        .filter(Boolean);
      const file =
        allFiles.find(
          (p) =>
            path.dirname(p) === path.join(suite.dir, 'master/layouts') &&
            layoutScenes.some(
              (s, i) => sceneLayouts[i] === spec.name && p.endsWith('/' + s.layoutTag + '.tsx'),
            ),
        ) ||
        allFiles.find(
          (p) =>
            path.dirname(p) === path.join(suite.dir, 'master/layouts') &&
            path
              .basename(p)
              .toLowerCase()
              .replace(/[^a-z]/g, '')
              .startsWith(spec.name.replace(/[^a-z]/g, '')),
        );
      if (!demonstrations.length) warnings.push(`${name}/${spec.name}: 版式没有演示场景`);
      const cn = label(name, 'layouts', spec.name);
      if (!cn) warnings.push(`${name}/labels.ts: layouts 缺 ${spec.name}`);
      push(
        mk(name, 'layout', spec.name, file ?? m.layouts.file, {
          label: cn ?? spec.name,
          purpose: spec.purpose,
          slots: spec.slots,
          demonstrations,
          demoIds: demonstrations.map((d) => d.id),
          demoFrame: demonstrations[0]
            ? demonstrations[0].from + demonstrations[0].duration - 1
            : 44,
        }),
      );
    }
    if (runtime[name].MasterFrame)
      push(
        mk(name, 'frame', 'MasterFrame', runtime[name].MasterFrame.file, {
          label: '画面母版',
          purpose: '真实母版提供内容空间与家具位置。',
          demoIds: ['frame'],
          demoFrame: 44,
        }),
      );
    for (const file of allFiles.filter(
      (p) => path.dirname(p) === path.join(suite.dir, 'master/furniture') && p.endsWith('.tsx'),
    )) {
      const key = path.basename(file, '.tsx'),
        cn = label(name, 'furniture', key);
      if (!cn) warnings.push(`${name}/labels.ts: furniture 缺 ${key}`);
      push(
        mk(name, 'furniture', key, file, {
          label: cn ?? key,
          purpose: '在真实母版中查看家具及其上下文。',
          demoIds: ['frame'],
          demoFrame: 44,
        }),
      );
    }
    for (const id of f.theme?.THEME_IDS ?? []) {
      const theme = f.theme.getTheme(id);
      if (!theme || theme.name !== id) warnings.push(`${name}/theme: ${id} 未对应同名主题`);
      const cn = label(name, 'themes', id);
      if (!cn) warnings.push(`${name}/labels.ts: themes 缺 ${id}`);
      push(
        mk(name, 'theme', id, m.theme.file, {
          label: cn ?? id,
          purpose: '同一组版式与内容，换一套视觉默认值。',
          demoIds: ['theme'],
          demoFrame: 44,
        }),
      );
    }
    for (const id of f.skins?.SKIN_IDS ?? []) {
      const skin = f.skins.resolveSkin(id);
      push(
        mk(name, 'skin', id, m.skins.file, {
          label: id === 'plain' ? '基础皮' : id === 'corner-marks' ? '角标皮' : id,
          purpose: '只声明相对主题的外观差异；实例设置仍优先。',
          skin,
          demoIds: registered.has('Panel') ? ['experiment'] : [],
          demoFrame: 44,
        }),
      );
    }
    if (m.motion) {
      const source = program.getSourceFile(m.motion.file),
        checker = program.getTypeChecker(),
        symbol = source && checker.getSymbolAtLocation(source);
      for (const exported of symbol ? checker.getExportsOfModule(symbol) : []) {
        if (!exported.valueDeclaration) continue;
        const type = checker.getTypeOfSymbolAtLocation(exported, exported.valueDeclaration);
        if (!checker.getSignaturesOfType(type, ts.SignatureKind.Call).length) continue;
        const adapted = ['enterFade', 'fadeUp'].includes(exported.name);
        if (!adapted) notes.push(`${name}/${exported.name}: 动效已发现，尚无展示适配器`);
        push(
          mk(name, 'motion', exported.name, m.motion.file, {
            label:
              exported.name === 'fadeUp'
                ? '淡入上移'
                : exported.name === 'enterFade'
                  ? '入场计算'
                  : exported.name,
            purpose: '调用公共计算，起点与时长由实例决定。',
            demoIds: adapted ? ['experiment'] : [],
            demoFrame: 44,
          }),
        );
      }
    }
    const scenes = await sequences(ts, path.join(suite.dir, 'templates/KitShowcase.tsx'));
    for (const scene of scenes) {
      if (!Number.isFinite(scene.from) || !Number.isFinite(scene.duration)) {
        warnings.push(`${name}/${scene.name}: 无法确定演示帧区间`);
        continue;
      }
      const cn = label(name, 'scenes', scene.name);
      if (!cn) warnings.push(`${name}/labels.ts: scenes 缺 ${scene.name}`);
      push(
        mk(name, 'example', scene.name, runtime[name].KitShowcase.file, {
          label: cn ?? scene.name,
          purpose: '已有组件层组合夹具。',
          demonstrations: [{id: 'scene', ...scene}],
          demoIds: ['scene'],
          demoFrame: scene.from + scene.duration - 1,
        }),
      );
    }
    if (registered.has('Flow') && registered.has('Panel'))
      push(
        mk(name, 'example', 'FreeComposition', path.join(showcaseDir, 'gallery/demos.tsx'), {
          sourcePath: slash(path.join(showcaseDir, 'gallery/demos.tsx')),
          label: '自由 JSX 组合',
          purpose: '原语与普通 JSX 同时参与画面；内容由调用处持有。',
          demoIds: ['experiment'],
          demoFrame: 44,
        }),
      );
    // **三维视图**：这里登记的是「能力」（宿主 + 机位 + 取景），不是场景内容。
    // 与组件那条路同一条纪律 —— 声明（VIEWPORT_SPECS）与源码（ViewportProps）互为镜像，漂了就报警。
    const viewportFile = path.join(suite.dir, 'viewport/host.tsx');
    const viewportSpecs = f.viewport?.VIEWPORT_SPECS ?? [];
    if (viewportSpecs.length && !(await exists(viewportFile)))
      warnings.push(`${name}: 声明了三维视图，但缺少 ${viewportFile}`);
    const viewportNames = [];
    for (const spec of viewportSpecs) {
      const cn = label(name, 'viewports', spec.name);
      if (!cn) warnings.push(`${name}/labels.ts: viewports 缺 ${spec.name}`);
      if (!(await exists(viewportFile))) continue;
      const actual = publicProps(ts, program, viewportFile, spec.name);
      if (!actual) {
        warnings.push(`${name}/${spec.name}: 公开 Props 无法解析（三维视图）`);
        continue;
      }
      const actualNames = new Set(actual.map((p) => p.name));
      for (const p of spec.props)
        if (!actualNames.has(p.name))
          warnings.push(`${name}/${spec.name}: 声明 prop ${p.name} 不存在于公开 Props（三维视图）`);
      for (const p of actual)
        if (!spec.props.some((v) => v.name === p.name))
          notes.push(`${name}/${spec.name}: ${p.name} 未写展示说明`);
      for (const t of spec.tunable ?? [])
        if (!spec.props.some((p) => p.name === t))
          warnings.push(`${name}/${spec.name}: tunable ${t} 无对应声明`);
      viewportNames.push(spec.name);
      const loopFrames = spec.loopFrames ?? 120;
      push(
        mk(name, 'viewport', spec.name, viewportFile, {
          label: cn ?? spec.name,
          purpose: spec.purpose,
          props: spec.props,
          publicProps: actual,
          tunable: spec.tunable,
          // 演示窗口就是**一个循环**：画廊的格子按 [from, from+duration) 循环播，
          // 所以接缝处是否跳，由套件里那份机位脚本负责（见 viewport/spec.ts 的 loopFrames）
          demonstrations: [
            {id: 'viewport', name: spec.name, from: 0, duration: loopFrames},
          ],
          demoIds: ['viewport'],
          demoFrame: spec.demoFrame,
        }),
      );
    }
    for (const [layer, keys] of Object.entries({
      elements: [...registered],
      layouts: Object.keys(f.layouts?.LAYOUT_SPECS ?? {}),
      furniture: allFiles
        .filter(
          (p) => path.dirname(p) === path.join(suite.dir, 'master/furniture') && p.endsWith('.tsx'),
        )
        .map((p) => path.basename(p, '.tsx')),
      themes: f.theme?.THEME_IDS ?? [],
      scenes: scenes.map((s) => s.name),
      viewports: viewportNames,
    }))
      for (const key of Object.keys(f.labels?.LABELS?.[layer] ?? {}))
        if (!keys.includes(key)) warnings.push(`${name}/labels.ts: ${layer} 存在无资产标签 ${key}`);
    suites.push({
      name,
      role: name === kernel ? 'kernel' : 'type',
      guidePath: (await exists(path.join(suite.dir, 'kit.md'))) ? `${name}/kit.md` : undefined,
      themeIds: [...(f.theme?.THEME_IDS ?? [])],
      owned: own,
      refs: [...own],
      composedFrom: composeSources(name),
      inherited: {},
      layoutCount: Object.keys(f.layouts?.LAYOUT_SPECS ?? {}).length,
      layoutSceneCount: sceneLayouts.length,
      sceneFrames,
    });
  }
  for (const suite of suites) {
    if (suite.role === 'kernel' && suite.composedFrom.length)
      warnings.push(`${suite.name}: 内核不能反向依赖类型包，请检查内核声明或 compose 来源`);
    for (const layer of ['elements', 'scenes']) {
      const owner = resolveLayer(suite.name, layer);
      if (owner && owner !== suite.name) {
        suite.inherited[layer] = owner;
        const kinds = layer === 'elements' ? ['primitive', 'arrangement'] : ['example'];
        suite.refs.push(
          ...assets.filter((a) => a.owner === owner && kinds.includes(a.kind)).map((a) => a.id),
        );
      }
      if (!owner && layer === 'elements')
        warnings.push(`${suite.name}: 未找到原语层或 compose 来源`);
    }
    suite.refs = [...new Set(suite.refs)];
  }
  if (config.suite && !suites.some((s) => s.name === config.suite))
    throw new Error(`没有套件：${config.suite}`);
  const manifest = {
    schemaVersion: 3,
    library: {
      kernel,
      typePacks: suites.filter((s) => s.role === 'type').map((s) => s.name),
      initialSuite: config.suite || null,
    },
    buildId: '',
    generatedAt: '',
    sourceDigest: '',
    source: {
      kind:
        path.resolve(config.source) === path.resolve(showcaseDir, '../kits') ? 'master' : 'fixture',
      path: path.resolve(config.source),
    },
    runtime: {
      project: config.project,
      remotion: dependencies(config.project).req('remotion/package.json').version,
    },
    warnings: [...new Set(warnings)],
    notes: [...new Set(notes)],
    suites,
    assets,
  };
  return {manifest, runtime, program, ts, allFiles};
}
