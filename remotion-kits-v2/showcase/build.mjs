import path from 'node:path';
import {showcaseDir, discover} from './lib/source.mjs';
import {build, fresh} from './lib/build.mjs';
import {serve} from './lib/serve.mjs';
const args = process.argv.slice(2),
  options = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (!key.startsWith('--')) throw new Error('无法识别参数 ' + key);
  options[key.slice(2)] = ['--discover', '--check', '--watch', '--images'].includes(key)
    ? true
    : args[++i];
}
if (!options.project) throw new Error('必须指定 --project，作为依赖运行环境');
if (options.source) throw new Error('演示页固定读取套件母版；隔离验证使用 --fixture-source');
const config = {
  project: path.resolve(options.project),
  source: path.resolve(options['fixture-source'] ?? path.join(showcaseDir, '../kits')),
  sourceDefault: !options['fixture-source'],
  out: path.resolve(options.out ?? path.join(showcaseDir, 'dist')),
  suite: options.suite ?? '',
  kernel: options.kernel ?? '',
  images: !!options.images,
  scale: Number(options.scale ?? 0.5),
  port: Number(options.port ?? 18499),
};
try {
  if (options.discover) {
    const {manifest} = await discover(config);
    console.log(JSON.stringify(manifest, null, 2));
    process.exitCode = manifest.warnings.length ? 2 : 0;
  } else if (options.check) {
    const result = await fresh(config);
    console.log(
      JSON.stringify(
        {
          fresh: result.fresh,
          source: config.source,
          publishedBuild: result.published?.buildId ?? null,
          currentDigest: result.sourceDigest,
        },
        null,
        2,
      ),
    );
    process.exitCode = result.fresh ? 0 : 3;
  } else if (options.watch) await serve(config);
  else await build(config);
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
