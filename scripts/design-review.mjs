/** Reproducible visual inventory. Build site first; serve it with serve-static.mjs. */
import { chromium } from '@playwright/test';
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { SLUGS } from './slugs.mjs';

const baseURL = process.env.DESIGN_REVIEW_URL || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.DESIGN_REVIEW_OUTPUT || '.ui-audit/design-review');
const themes = JSON.parse(await readFile('src/tokens/themes.json', 'utf8')).map(t => t.id);
const slugs = (await readdir('site/dist/components', { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort();
const missing = SLUGS.filter(slug => !slugs.includes(slug));
if (missing.length) throw Error(`Missing Registry documentation: ${missing.join(', ')}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const jobs = slugs.map(slug => ({ group: 'registry', name: slug, url: `/components/${slug}/` }));
for (const preset of themes) for (const dark of [false, true]) for (const slug of ['btn', 'table', 'ai-composer', 'kb-retrieval'])
  jobs.push({ group: 'palettes', name: `${preset}-${dark ? 'dark' : 'light'}-${slug}`, url: `/components/${slug}/`, preset, dark });
for (const style of ['modern', 'chinese', 'soviet', 'pixel']) for (const dark of [false, true]) for (const slug of ['btn', 'modal', 'kb-retrieval'])
  jobs.push({ group: 'primitives', name: `${style}-${dark ? 'dark' : 'light'}-${slug}`, url: `/components/${slug}/`, style, dark });
for (const density of ['compact', 'normal', 'comfortable']) for (const slug of ['btn', 'kb-retrieval', 'ai-composer'])
  jobs.push({ group: 'density', name: `${density}-${slug}`, url: `/components/${slug}/`, density });
for (const dark of [false, true]) for (const mobile of [false, true])
  jobs.push({ group: 'workspace', name: `${dark ? 'dark' : 'light'}-${mobile ? 'mobile' : 'desktop'}`, url: '/apps/', dark, mobile, fullPage: true });
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const context = await browser.newContext({ locale: 'zh-CN', viewport: job.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: !!job.mobile, isMobile: !!job.mobile });
    await context.addInitScript(({ preset, style, dark }) => {
      try { localStorage.setItem('icen.ui.theme', JSON.stringify({ preset: preset || 'modern', style: style || 'modern', dark: !!dark })); }
      catch { /* Sandboxed evidence frames intentionally have no storage access. */ }
    }, job);
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      const response = await page.goto(new URL(job.url, baseURL).href, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw Error(`HTTP ${response?.status()}`);
      if (job.url.startsWith('/components/')) await page.locator('[data-icen-demo-ready]').waitFor();
      await page.evaluate(async density => { await document.fonts.ready; if (density) document.documentElement.dataset.icenDensity = density; }, job.density);
      const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, theme: document.documentElement.dataset.icenPreset, style: document.documentElement.dataset.icenStyle, motion: getComputedStyle(document.documentElement).getPropertyValue('--icen-design-motion') }));
      const file = `${job.group}/${job.name}.png`; await mkdir(path.join(output, job.group), { recursive: true });
      await page.screenshot({ path: path.join(output, file), fullPage: !!job.fullPage, animations: 'disabled' });
      results.push({ ...job, file, ...metrics, errors });
      process.stdout.write(`${results.length}/${jobs.length} ${job.group}/${job.name}${metrics.overflow ? ' OVERFLOW' : ''}${errors.length ? ' SCRIPT ERROR' : ''}\n`);
    } catch (error) { results.push({ ...job, error: String(error), errors }); }
    finally { await context.close(); }
  }
}
try { await Promise.all(Array.from({ length: 3 }, worker)); }
finally {
  await browser.close();
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ date: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), scope: 'Viewport inventory of every built component page; representative orthogonal matrices. Not a claim of full state or cross-browser coverage.', results }, null, 2));
}
const failures = results.filter(r => r.error || r.errors.length || r.overflow);
console.log(`${results.length} captures; ${failures.length} failures. ${output}`);
if (failures.length) process.exitCode = 1;
