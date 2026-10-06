/* 视觉冒烟：全组件 demo 页的图标尺寸与图表渲染断言（排障/回归工具） */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

/* 页面清单 = 文档站组件索引的全量链接 + 关键页 */
const idx = readFileSync('site/dist/components/index.html', 'utf8');
const links = [...new Set([...idx.matchAll(/href="\/components\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))];
const pages = ['/', '/kb/', '/primitives/', '/customize/', '/frameworks/', '/tokens/', ...links.map((s) => `/components/${s}/`)];

const browser = await chromium.launch();
const page = await browser.newPage();
let bad = 0;
for (const p of pages) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.goto('http://localhost:4321' + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const giant = await page.evaluate(() => {
    const out = [];
    for (const svg of document.querySelectorAll('svg')) {
      if (svg.closest('.icen-chart, .icen-chart-body, .icen-kb-canvas')) continue; // 图表/画布区全宽属正常
      const r = svg.getBoundingClientRect();
      if (r.width > 64 || r.height > 64) {
        out.push(`${(svg.getAttribute('class') || 'svg').slice(0, 40)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  });
  const zeroCharts = await page.evaluate(() => {
    const charts = document.querySelectorAll('.icen-chart');
    let empty = 0;
    for (const c of charts) {
      /* DOM 型图表（vbar/hbar/stack）无 svg——以渲染标记/条元素为准 */
      if (!c.querySelector('svg, canvas, [data-icen-chart-mark], .icen-chart-vbar-bar, .icen-chart-hbar-row, .icen-chart-empty')) empty++;
    }
    return { total: charts.length, empty };
  });
  if (giant.length || errors.length || zeroCharts.empty > 0) {
    bad++;
    console.log(`✗ ${p}`);
    if (giant.length) console.log('  巨型图标:', giant.slice(0, 5));
    if (errors.length) console.log('  JS 错误:', errors.slice(0, 3));
    if (zeroCharts.empty) console.log(`  空图表: ${zeroCharts.empty}/${zeroCharts.total}`);
  }
}
await browser.close();
console.log(bad === 0 ? `✓ 全部 ${pages.length} 页视觉健康` : `✗ ${bad} 页仍有问题`);
process.exit(bad === 0 ? 0 : 1);
