import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {showcaseDir, digest, exists} from './source.mjs';
import {current} from './build.mjs';

// 重建在独立 Node 进程中执行：状态服务不会被 TS 检查阻塞，工具代码也会重新载入。
function rebuild(config) {
  return new Promise((resolve, reject) => {
    const args = [
      path.join(showcaseDir, 'build.mjs'),
      '--project',
      config.project,
      '--out',
      config.out,
      '--scale',
      String(config.scale),
    ];
    if (!config.sourceDefault) args.push('--fixture-source', config.source);
    if (config.suite) args.push('--suite', config.suite);
    if (config.kernel) args.push('--kernel', config.kernel);
    if (config.images) args.push('--images');
    const child = spawn(process.execPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errors = '';
    child.stdout.on('data', (data) => process.stdout.write(data));
    child.stderr.on('data', (data) => {
      errors = (errors + data).slice(-16000);
      process.stderr.write(data);
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(errors || '展示构建失败，退出码 ' + code)),
    );
  });
}
export async function serve(config) {
  const state = {
      phase: 'starting',
      buildId: null,
      lastSuccess: null,
      source: config.source,
      error: null,
      pending: false,
    },
    published = await current(config.out);
  if (published) {
    state.buildId = published.buildId;
    state.lastSuccess = published.generatedAt;
  }
  let busy = false,
    dirty = false,
    timer,
    stopped = false,
    lastDigest = null,
    sourceWatcher;
  const listeners = [];
  async function run() {
    if (stopped) return;
    clearTimeout(timer);
    if (busy) {
      dirty = true;
      state.pending = true;
      return;
    }
    busy = true;
    dirty = false;
    state.pending = false;
    const snapshot = {...config};
    let attemptedDigest = null;
    try {
      // 保存可能通知多次，也可能只是写回原字节；每轮先确认内容确实有变化。
      attemptedDigest = await digest(snapshot);
      if (attemptedDigest === lastDigest) return;
      state.phase = 'building';
      state.error = null;
      await rebuild(snapshot);
      const manifest = await current(snapshot.out);
      state.buildId = manifest.buildId;
      state.lastSuccess = manifest.generatedAt;
      state.phase = 'ready';
      lastDigest = manifest.sourceDigest;
    } catch (error) {
      state.phase = 'failed';
      state.error = error.message;
      // 只记本轮尝试的输入。失败时读取「最新」摘要会把期间的新修改吞掉。
      lastDigest = attemptedDigest;
    } finally {
      try {
        if ((await digest(config)) !== lastDigest) dirty = true;
      } catch {
        // 文件可能正在重命名；下一次事件或轮询会继续检查。
      }
      busy = false;
      state.pending = dirty && !stopped;
      if (state.pending) {
        clearTimeout(timer);
        timer = setTimeout(run, 250);
      }
    }
  }
  function queue() {
    if (stopped) return;
    dirty = true;
    state.pending = true;
    clearTimeout(timer);
    timer = setTimeout(run, 400);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/__showcase_doc') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const origin = params.get('source') === config.source ? config.source : null;
        const pack = params.get('pack') ?? '';
        if (!origin || !pack || ['.', '..'].includes(pack) || path.basename(pack) !== pack) {
          res.writeHead(400);
          res.end('未声明的说明来源');
          return;
        }
        const file = path.resolve(origin, pack, 'kit.md');
        if (!file.startsWith(path.resolve(origin) + path.sep)) {
          res.writeHead(403);
          res.end();
          return;
        }
        if (!(await exists(file))) {
          res.writeHead(404);
          res.end('本包没有使用说明');
          return;
        }
        const bytes = await fsp.readFile(file);
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(bytes);
        return;
      }
      if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (pathname === '/__showcase_status') {
        res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
        res.end(JSON.stringify(state));
        return;
      }
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1),
        file = path.resolve(config.out, relative);
      if (!file.startsWith(path.resolve(config.out) + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!(await exists(file))) {
        if (pathname !== '/') {
          res.writeHead(404);
          res.end('没有这个展示资源');
          return;
        }
        res.writeHead(503, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(
          '<h1>展示尚未发布</h1><p>请修正来源错误，监听会继续构建。</p><script>setInterval(async()=>{try{if((await(await fetch("/__showcase_status")).json()).buildId)location.reload()}catch{}},1500)</script>',
        );
        return;
      }
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.mp4': 'video/mp4',
      };
      const bytes = await fsp.readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': pathname === '/' ? 'no-store' : 'public, max-age=31536000, immutable',
      });
      res.end(bytes);
    } catch (error) {
      res.writeHead(500);
      res.end('无法处理展示请求：' + error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '127.0.0.1', resolve);
  });
  console.log('SHOWCASE_URL=http://127.0.0.1:' + server.address().port + '/');
  console.log('SHOWCASE_PID=' + process.pid);
  sourceWatcher = fs.watch(config.source, {recursive: true}, queue);
  for (const root of [path.join(showcaseDir, 'gallery'), path.join(showcaseDir, 'lib')])
    listeners.push(fs.watch(root, {recursive: true}, queue));
  const interval = setInterval(async () => {
    if (busy || stopped) return;
    const snapshot = {...config};
    try {
      const next = await digest(snapshot);
      // digest 的 await 期间可能已开始构建，不能排入过时的检查结果。
      if (!busy && !stopped && next !== lastDigest) queue();
    } catch (error) {
      state.phase = 'failed';
      state.error = error.message;
    }
  }, 1800);
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    clearInterval(interval);
    sourceWatcher?.close();
    for (const listener of listeners) listener.close();
    server.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await run();
  return {server, state, stop};
}
