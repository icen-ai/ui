// 零依赖静态服务器（node:http + node:fs）——Playwright e2e 的 webServer 底座。
// 用法：bun scripts/serve-static.mjs <dir> [port]   （默认 site/dist，端口 4173）
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'site/dist');
const port = Number(process.argv[3] ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((req, res) => {
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'cache-control': 'no-store', ...headers });
    res.end(body);
  };
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // 防目录穿越：归一化后必须仍落在 root 内
    let file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + sep)) return send(403, 'Forbidden');

    let stat = existsSync(file) ? statSync(file) : null;
    if (stat?.isDirectory()) {
      // 目录 → index.html；/path → 301 到 /path/（保证相对资源解析一致）
      if (!pathname.endsWith('/')) {
        return send(301, `Redirecting to ${pathname}/`, { location: pathname + '/' });
      }
      file = join(file, 'index.html');
      stat = existsSync(file) ? statSync(file) : null;
    }
    if (!stat?.isFile()) return send(404, 'Not Found');

    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-store',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch {
    send(500, 'Internal Server Error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[serve-static] ${root} → http://127.0.0.1:${port}/`);
});
