import fs from 'node:fs/promises';
import path from 'node:path';

function visit(ts, node, fn) {
  fn(node);
  ts.forEachChild(node, (n) => visit(ts, n, fn));
}
function calls(ts, source, tag) {
  const result = [];
  visit(ts, source, (n) => {
    if (
      (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) &&
      n.tagName.getText(source) === tag
    ) {
      result.push(
        new Set(n.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.text)),
      );
    }
  });
  return result;
}
function strings(ts, node, constants, seen = new Set()) {
  if (!node) return [];
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
    return strings(ts, node.expression, constants, seen);
  if (ts.isIdentifier(node) && constants.has(node.text) && !seen.has(node.text))
    return strings(ts, constants.get(node.text), constants, new Set([...seen, node.text]));
  if (ts.isArrayLiteralExpression(node))
    return node.elements.flatMap((n) => strings(ts, n, constants, seen));
  if (ts.isTemplateExpression(node)) {
    let values = [node.head.text];
    for (const span of node.templateSpans) {
      const parts = strings(ts, span.expression, constants, seen);
      if (!parts.length) return [];
      values = values.flatMap((value) => parts.map((part) => value + part + span.literal.text));
    }
    return values;
  }
  return [];
}

/** 覆盖提示只回答夹具演练过什么；不会把静态分析冒充画面验证。 */
export async function audit({
  ts,
  program,
  suite,
  facts,
  allFiles,
  publicProps,
  warnings,
  notes,
  controlProps,
}) {
  const sceneFile = path.join(suite.dir, 'templates/ShowcaseScenes.tsx'),
    sceneSource = program.getSourceFile(sceneFile),
    specs = facts.layouts?.LAYOUT_SPECS ?? {},
    knownTags = new Set();
  const constants = new Map();
  for (const source of program.getSourceFiles())
    visit(ts, source, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer)
        constants.set(n.name.text, n.initializer);
    });
  for (const spec of Object.values(specs)) {
    const tag =
      spec.name
        .split('-')
        .map((s) => s[0].toUpperCase() + s.slice(1))
        .join('') + 'Layout';
    knownTags.add(tag);
    const file = path.join(suite.dir, 'master/layouts', tag + '.tsx');
    if (!program.getSourceFile(file)) {
      warnings.push(`${suite.name}/${tag}: 版式登记没有同名导出文件`);
      continue;
    }
    const props = publicProps(ts, program, file, tag);
    if (!props) {
      warnings.push(`${suite.name}/${tag}: 公开 Props 无法解析`);
      continue;
    }
    for (const slot of spec.slots) {
      const p = props.find((p) => p.name === slot.name);
      if (!p) warnings.push(`${suite.name}/${tag}: 槽 ${slot.name} 不在公开 Props 中`);
    }
    const controls = new Set(controlProps);
    for (const p of props)
      if (!spec.slots.some((s) => s.name === p.name) && !controls.has(p.name))
        warnings.push(`${suite.name}/${tag}: 公开内容 prop ${p.name} 缺少槽声明`);
    const samples = sceneSource ? calls(ts, sceneSource, tag) : [];
    for (const slot of spec.slots.filter((s) => !s.required)) {
      if (!samples.some((s) => s.has(slot.name)))
        notes.push(`${suite.name}/${tag}: 可选槽 ${slot.name} 没有「给值」演示`);
      if (!samples.some((s) => !s.has(slot.name)))
        notes.push(`${suite.name}/${tag}: 可选槽 ${slot.name} 没有「省略」演示`);
    }
    for (const slot of spec.slots.filter((s) => s.kind === 'lines')) {
      const texts = [];
      if (sceneSource)
        visit(ts, sceneSource, (n) => {
          if (
            (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) &&
            n.tagName.getText(sceneSource) === tag
          ) {
            const attr = n.attributes.properties.find(
              (a) => ts.isJsxAttribute(a) && a.name.text === slot.name,
            );
            if (attr?.initializer && ts.isJsxExpression(attr.initializer))
              texts.push(...strings(ts, attr.initializer.expression, constants));
          }
        });
      if (!texts.some((t) => t.includes('\t')))
        notes.push(`${suite.name}/${tag}: ${slot.name} 没有「带主字段」演示`);
      if (!texts.some((t) => !t.includes('\t')))
        notes.push(`${suite.name}/${tag}: ${slot.name} 没有「不带主字段」演示`);
    }
  }
  for (const file of allFiles.filter(
    (p) => path.dirname(p) === path.join(suite.dir, 'master/layouts') && p.endsWith('.tsx'),
  ))
    if (!knownTags.has(path.basename(file, '.tsx')))
      warnings.push(`${suite.name}/master/layouts/${path.basename(file)}: 未进入版式登记`);
  const master = program.getSourceFile(path.join(suite.dir, 'master/MasterFrame.tsx'));
  for (const file of allFiles.filter(
    (p) => path.dirname(p) === path.join(suite.dir, 'master/furniture') && p.endsWith('.tsx'),
  )) {
    const tag = path.basename(file, '.tsx');
    if (master && !calls(ts, master, tag).length)
      warnings.push(`${suite.name}/${tag}: 家具没有母版消费者`);
  }
  const typeSource = program.getSourceFile(path.join(suite.dir, 'master/types.ts'));
  let furniture;
  if (typeSource)
    visit(ts, typeSource, (n) => {
      if (ts.isTypeAliasDeclaration(n) && n.name.text === 'FurnitureConfig') furniture = n;
    });
  if (furniture && sceneSource) {
    const keys = [];
    visit(ts, furniture.type, (n) => {
      if (ts.isPropertySignature(n) && n.questionToken && n.name)
        keys.push(n.name.getText(typeSource));
    });
    for (const key of keys) {
      let present = false;
      visit(ts, sceneSource, (n) => {
        if (ts.isPropertyAssignment(n) && n.name.getText(sceneSource) === key) present = true;
      });
      if (present)
        notes.push(`${suite.name}/FurnitureConfig: 家具字段 ${key} 在当前夹具中没有「省略」演示`);
    }
  }
  // 主题候选文件存在却没从注册入口引用，不能悄悄漏掉它。
  const entry = program.getSourceFile(path.join(suite.dir, 'theme/index.ts')),
    referenced = new Set();
  if (entry)
    for (const statement of entry.statements)
      if (
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      )
        referenced.add(statement.moduleSpecifier.text);
  for (const file of allFiles.filter(
    (p) =>
      path.dirname(p) === path.join(suite.dir, 'theme') &&
      p.endsWith('.ts') &&
      !['index.ts', 'types.ts'].includes(path.basename(p)),
  )) {
    const source = program.getSourceFile(file);
    let candidate = false;
    if (source)
      visit(ts, source, (n) => {
        if (ts.isVariableDeclaration(n) && n.type?.getText(source) === 'Theme') candidate = true;
      });
    if (candidate && !referenced.has('./' + path.basename(file, '.ts')))
      warnings.push(`${suite.name}/theme/${path.basename(file)}: 主题候选没有进入 theme/index.ts`);
  }
  for (const file of allFiles.filter((p) => /\.(tsx?|jsx?)\./.test(p) && !p.endsWith('.md')))
    notes.push(
      `${suite.name}: 忽略非源码文件 ${path.relative(suite.dir, file).replaceAll('\\', '/')}`,
    );
}
