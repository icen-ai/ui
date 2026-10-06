/* Audit B/C：双站全页像素对比 + 深度断言爬行器
 * 用法：bun audit-visual.mjs [--only=<substr>] [--write-report]
 * 旧站 4572（HEAD 基线） vs 新站 4573（当前）。输出 shots/{old,new,diff}/<page>.png + report.json */
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = 'C:/Users/thatc/.workspace/icen/icen.ai/.parity';
const UIROOT = 'C:/Users/thatc/.workspace/icen/icen.ai/ui';
const OLD = process.env.OLD ?? 'http://127.0.0.1:4572';
const NEW = process.env.NEW ?? 'http://127.0.0.1:4573';
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7);

/* 页面清单：当前站 dist 的真实构建产物 */
const distDir = join(UIROOT, 'site/dist');
function* walkHtml(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkHtml(p);
    else if (e.name === 'index.html') yield p;
  }
}
const pages = [...walkHtml(distDir)]
  .map((p) => p.slice(distDir.length).replace(/\\/g, '/').replace(/\/index\.html$/, '/'))
  .filter((u) => !ONLY || u.includes(ONLY))
  .sort();
console.log(`共 ${pages.length} 页待检`);

mkdirSync(join(HERE, 'shots/old'), { recursive: true });
mkdirSync(join(HERE, 'shots/new'), { recursive: true });
mkdirSync(join(HERE, 'shots/diff'), { recursive: true });

const name = (u) => (u === '/' ? 'index' : u.replace(/\//g, '_').replace(/^_|_$/g, ''));

const ASSERT_JS = `(() => {
  const out = { giantSvg: [], clip: [], emptySwatch: 0, blackDisc: [], emptyChart: 0, rawJsonChart: 0 };
  const SKIP_SCROLL = /scroll|pre|code|kb-sandbox|select-native|textarea|demo-stage|hl-/i;
  for (const svg of document.querySelectorAll('svg')) {
    if (svg.closest('.icen-chart, [class*="icen-chart-"], .icen-kb-chart-mount')) continue; /* 图表 svg 合法大尺寸 */
    const r = svg.getBoundingClientRect();
    /* 图标语境失控阈值 64px：无固有尺寸的 svg 超出即失控（库纪律：图标 svg 必有 width/height 属性或 CSS 尺寸） */
    if ((r.width > 64 || r.height > 64) && !svg.getAttribute('width') && !svg.getAttribute('height'))
      out.giantSvg.push((svg.getAttribute('class') || '(no-class)') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' @' + (svg.closest('[class*="icen-"]')?.className || 'body').toString().split(' ')[0]);
    /* 隐身图标检测：有 path 子节点但零尺寸渲染，且自身/祖先无 hidden（svgIcon xmlns 事故的永久哨兵） */
    if (r.width < 2 && r.height < 2 && svg.querySelector('path, circle, rect') && !svg.closest('[hidden], template') && !svg.hidden)
      out.invisSvg = (out.invisSvg || []).slice(0, 6).concat([(svg.getAttribute('class') || '(no-class)') + ' @' + (svg.closest('[class*="icen-"]')?.className || 'body').toString().split(' ')[0]]);
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement)) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowY !== 'hidden') continue;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue; /* 设计性截断（省略号） */
    if (/(^|\s)(icen-)?(sr-only|visually-hidden)(\s|$)/.test(el.className)) continue; /* 视觉隐藏是 1px 裁剪设计 */
    const dh = el.scrollHeight - el.clientHeight;
    if (dh <= 6) continue;
    if (SKIP_SCROLL.test(el.className + ' ' + el.tagName)) continue;
    if (el.closest('pre, code, [data-icen-scroll-area], .demo-stage')) continue;
    let directText = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { directText = true; break; }
    if (!directText) continue;
    out.clip.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 2).join('.') + ' 溢出' + dh + 'px “' + (el.textContent || '').trim().slice(0, 30) + '”');
  }
  for (const s of document.querySelectorAll('.swatch-color')) {
    const bg = getComputedStyle(s).backgroundColor;
    if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') out.emptySwatch++;
  }
  for (const c of document.querySelectorAll('svg circle')) {
    if (Number(c.getAttribute('r') || 0) < 3) continue;
    if (getComputedStyle(c).fill === 'rgb(0, 0, 0)') out.blackDisc.push((c.getAttribute('class') || '(no-class)'));
  }
  for (const ch of document.querySelectorAll('.icen-chart')) {
    const body = ch.querySelector('.icen-chart-body') || ch;
    if (!body.querySelector('svg, canvas') && body.childElementCount === 0) out.emptyChart++;
  }
  for (const pre of document.querySelectorAll('.icen-ai-tool pre')) {
    const t = (pre.textContent || '').trim();
    if (/^\\{\\s*"type"\\s*:\\s*"chart"/.test(t)) out.rawJsonChart++;
  }
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = out[k].slice(0, 6);
  return out;
})()`;

async function settle(page) {
  for (let i = 0; i < 4; i++) {
    const a = await page.evaluate(() => document.body.innerText.length + '|' + document.body.innerHTML.length);
    await page.waitForTimeout(350);
    const b = await page.evaluate(() => document.body.innerText.length + '|' + document.body.innerHTML.length);
    if (a === b) break;
  }
}

async function shoot(browser, base, url, dir, consoleErrs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)));
  let status = 0;
  try {
    const resp = await page.goto(base + url, { waitUntil: 'networkidle', timeout: 30000 });
    status = resp ? resp.status() : 0;
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    if (url.includes('ai-overview')) {
      const btn = page.locator('#ai-ov-play');
      if (await btn.count()) { await btn.click(); await page.waitForTimeout(38000); }
    }
    await settle(page);
    await page.screenshot({ path: join(dir, name(url) + '.png'), fullPage: true });
  } catch (e) {
    errs.push('GOTO ' + String(e).slice(0, 160));
  }
  let assertions = null;
  if (dir.includes('new')) {
    try { assertions = await page.evaluate(ASSERT_JS); } catch { /* nav race */ }
  }
  consoleErrs[url] = errs;
  await page.close();
  return { status, assertions };
}

function padWhite(png, w, h) {
  if (png.width === w && png.height === h) return png;
  const out = new PNG({ width: w, height: h, fill: 0xffffffff });
  out.data.fill(255);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

const browser = await chromium.launch();
const consoleErrs = {};
const report = [];
for (const url of pages) {
  const oldR = await shoot(browser, OLD, url, join(HERE, 'shots/old'), {});
  const errs = [];
  const newR = await shoot(browser, NEW, url, join(HERE, 'shots/new'), consoleErrs);
  errs.push(...(consoleErrs[url] ?? []));
  let diff = { ratio: null, pixels: 0, note: '' };
  if (oldR.status === 404) diff.note = 'NEW-ONLY';
  else if (newR.status === 404) diff.note = 'NEW-404!';
  else {
    try {
      const a = PNG.sync.read(readFileSync(join(HERE, 'shots/old', name(url) + '.png')));
      const b = PNG.sync.read(readFileSync(join(HERE, 'shots/new', name(url) + '.png')));
      const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
      const pa = padWhite(a, w, h), pb = padWhite(b, w, h);
      const d = new PNG({ width: w, height: h });
      const pixels = pixelmatch(pa.data, pb.data, d.data, w, h, { threshold: 0.12 });
      diff = { ratio: +(pixels / (w * h) * 100).toFixed(3), pixels };
      if (pixels > 0) writeFileSync(join(HERE, 'shots/diff', name(url) + '.png'), PNG.sync.write(d));
    } catch (e) { diff.note = 'DIFF-ERR ' + String(e).slice(0, 80); }
  }
  const flags = [];
  if (diff.note) flags.push(diff.note);
  if (diff.ratio !== null && diff.ratio > 0.15) flags.push('PIX ' + diff.ratio + '%');
  if (errs.length) flags.push('JS ' + errs.length);
  const a = newR.assertions;
  if (a) {
    if (a.giantSvg.length) flags.push('GIANT ' + a.giantSvg.join(','));
    if (a.clip.length) flags.push('CLIP ' + a.clip.join(' | '));
    if (a.emptySwatch) flags.push('SWATCH×' + a.emptySwatch);
    if (a.blackDisc.length) flags.push('DISC ' + a.blackDisc.join(','));
    if (a.emptyChart) flags.push('EMPTYCHART×' + a.emptyChart);
    if (a.rawJsonChart) flags.push('RAWJSON×' + a.rawJsonChart);
  }
  report.push({ url, diffRatio: diff.ratio, flags, errs: errs.slice(0, 4), assertions: a });
  console.log(`${flags.length ? '✗' : '✓'} ${url}${flags.length ? '  → ' + flags.join(' ;; ') : ''}`);
}
writeFileSync(join(HERE, 'report.json'), JSON.stringify(report, null, 2));
const flagged = report.filter((r) => r.flags.length);
console.log(`\n══ 完毕：${report.length} 页，${flagged.length} 页有旗标 ══`);
await browser.close();
