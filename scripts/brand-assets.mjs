import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// UI 站的 favicon.svg 是品牌几何与明暗颜色的事实源。独立站点各自携带资产，
// 构建和部署无需访问兄弟仓库；显式 --accounts 时同步账户站。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'site/public');
const source = await readFile(join(publicDir, 'favicon.svg'), 'utf8');
const targets = [{ path: publicDir, name: 'ICEN UI', short: 'ICEN UI' }];
const accountArg = process.argv.indexOf('--accounts');
if (accountArg !== -1) {
  if (!process.argv[accountArg + 1]) throw new Error('--accounts requires an accounts repository path');
  targets.push({ path: resolve(process.argv[accountArg + 1], 'public'), name: 'ICEN Accounts · 冰点账户', short: '冰点账户' });
}
const executablePath = [process.env.BROWSER_EXECUTABLE,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', chromium.executablePath(),
].find(path => path && existsSync(path));
if (!executablePath) throw new Error('Set BROWSER_EXECUTABLE to a local Chromium browser.');
const browser = await chromium.launch({ executablePath, headless: true });
const images = new Map();
try {
  for (const size of [16, 32, 48, 180, 192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1, colorScheme: 'light' });
    const appIcon = size >= 180;
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%}body{display:grid;place-items:center;background:${appIcon ? '#f7f7f4' : 'transparent'}}svg{display:block;width:${appIcon ? '72%' : '100%'};height:auto}</style></head><body>${source}</body></html>`);
    images.set(size, await page.screenshot({ omitBackground: !appIcon }));
    await page.close();
  }
} finally { await browser.close(); }
// ICO 的每个目录项内嵌 PNG；16/32/48px 由同一矢量分别栅格化。
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, index) => {
  const at = 6 + index * 16; const png = images.get(size);
  header[at] = size; header[at + 1] = size;
  header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8); header.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
const ico = Buffer.concat([header, ...sizes.map(size => images.get(size))]);
for (const target of targets) {
  await mkdir(target.path, { recursive: true });
  await writeFile(join(target.path, 'favicon.svg'), source);
  await writeFile(join(target.path, 'favicon.ico'), ico);
  for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    await writeFile(join(target.path, name), images.get(size));
  }
  await writeFile(join(target.path, 'site.webmanifest'), JSON.stringify({
    name: target.name, short_name: target.short, lang: 'zh-CN', start_url: '/', display: 'browser',
    background_color: '#f7f7f4', icons: [192, 512].map(size => ({
      src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any maskable',
    })),
  }, null, 2) + '\n');
}
console.log(`Generated ICEN brand icons for ${targets.length} site(s).`);
