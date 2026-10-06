/* Audit C 交互巡检：对用户点名 + 高风险组件做真实点击/输入断言
 * 用法：node scripts/audit-interact.mjs（目标 = 4573 当前站 preview） */
import { chromium } from '@playwright/test';

const BASE = process.env.NEW ?? 'http://127.0.0.1:4573';

const scenarios = [
  ['select', '/components/select/', async (page, fail) => {
    const t = page.locator('.icen-select-trigger').first();
    await t.click();
    await page.waitForTimeout(300);
    const panel = page.locator('.icen-select-panel:not([hidden])');
    if (!(await panel.count())) { fail.push('点击 trigger 后面板未开'); return; }
    const opt = panel.locator('.icen-select-option').nth(1);
    if (!(await opt.count())) { fail.push('面板内无选项'); return; }
    const label = await opt.textContent();
    await opt.click();
    await page.waitForTimeout(200);
    if (await page.locator('.icen-select-panel:not([hidden])').count()) fail.push('选后面板未关');
    const val = await page.locator('.icen-select-value').first().textContent();
    if (!val || !label || !val.includes(label.trim().slice(0, 2))) fail.push('选中未回显 trigger');
  }],
  ['cascader', '/components/cascader/', async (page, fail) => {
    await page.locator('.icen-cascader-trigger').first().click();
    await page.waitForTimeout(300);
    const panel = page.locator('.icen-cascader-panel:not([hidden])');
    if (!(await panel.count())) { fail.push('面板未开'); return; }
    await panel.locator('.icen-cascader-col').first().locator('.icen-cascader-item').first().click();
    await page.waitForTimeout(300);
    if ((await panel.locator('.icen-cascader-col').count()) < 2) { fail.push('点父项未出次列'); return; }
    /* 逐级钻到叶子定值：浙江 → 杭州 → 西湖区 */
    await panel.locator('.icen-cascader-col').nth(1).locator('.icen-cascader-item').first().click();
    await page.waitForTimeout(250);
    await panel.locator('.icen-cascader-col').nth(2).locator('.icen-cascader-item').first().click();
    await page.waitForTimeout(300);
    const v = await page.locator('.icen-cascader-trigger').first().textContent();
    if (!v || !v.includes('西湖')) fail.push('叶子定值后 trigger 无路径回显');
  }],
  ['tree-select', '/components/tree-select/', async (page, fail) => {
    await page.locator('.icen-tree-select-trigger').first().click();
    await page.waitForTimeout(300);
    const panel = page.locator('.icen-tree-select-panel:not([hidden])');
    if (!(await panel.count())) { fail.push('面板未开'); return; }
    await panel.locator('[role="treeitem"]', { hasText: '研发中心' }).first().click(); /* 多选 checkable：点父行 = 整树勾选 */
    await page.waitForTimeout(300);
    if (!(await page.locator('.icen-tree-select-chip').count())) fail.push('勾选后 trigger 无 chips 回显');
  }],
  ['mentions', '/components/mentions/', async (page, fail) => {
    const ta = page.locator('.icen-mentions textarea, [data-icen-mentions] textarea').first();
    await ta.click();
    await ta.pressSequentially('@', { delay: 60 });
    await page.waitForTimeout(400);
    if (!(await page.locator('.icen-mentions-panel:not([hidden])').count())) fail.push('@ 后面板未出');
  }],
  ['autocomplete', '/components/autocomplete/', async (page, fail) => {
    const inp = page.locator('#demo-autocomplete-input');
    await inp.click();
    await inp.pressSequentially('ap', { delay: 60 });
    await page.waitForTimeout(400);
    const panel = page.locator('.icen-autocomplete-panel:not([hidden])');
    if (!(await panel.count())) { fail.push('输入后建议未出'); return; }
    if (!(await panel.locator('.icen-autocomplete-option').count())) fail.push('面板无候选');
  }],
  ['progress', '/components/progress/', async (page, fail) => {
    const bars = page.locator('.icen-progress-bar');
    const n = await bars.count();
    if (!n) { fail.push('无进度条'); return; }
    let any = 0;
    for (let i = 0; i < n; i++) {
      const w = await bars.nth(i).evaluate((el) => el.getBoundingClientRect().width);
      if (w > 4) any++;
    }
    if (!any) fail.push('全部进度条零宽');
    for (let i = 0; i < await page.locator('.icen-progress-ring-fill').count(); i++) {
      const c = page.locator('.icen-progress-ring-fill').nth(i);
      const stroke = await c.evaluate((el) => getComputedStyle(el).stroke);
      if (!stroke || stroke === 'none') fail.push(`环#${i} 无 stroke（黑盘回归）`);
    }
  }],
  ['tabs', '/components/tabs/', async (page, fail) => {
    const tabs = page.locator('.icen-tabs [role="tab"], .icen-tabs .icen-page-tab').first().locator('..').locator('[role="tab"], .icen-page-tab');
    const n = await tabs.count();
    if (n < 2) { fail.push('tab 不足两个'); return; }
    await tabs.nth(1).click();
    await page.waitForTimeout(200);
    const sel = await tabs.nth(1).evaluate((el) => el.classList.contains('is-active') || el.getAttribute('aria-selected') === 'true');
    if (!sel) fail.push('点击未激活');
  }],
  ['modal', '/components/modal/', async (page, fail) => {
    const btn = page.locator('[data-icen-modal-open], .demo-stage button').first();
    await btn.click();
    await page.waitForTimeout(350);
    if (!(await page.locator('.icen-modal[open], .icen-modal-overlay:not([hidden]), [role="dialog"]:visible').count())) fail.push('弹层未开');
    else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      if (await page.locator('[role="dialog"]:visible').count()) fail.push('ESC 未关');
    }
  }],
  ['date-picker', '/components/date-picker/', async (page, fail) => {
    const t = page.locator('[data-icen-date-picker]').first();
    await t.click();
    await page.waitForTimeout(350);
    if (!(await page.locator('.icen-date-picker-panel:not([hidden])').count())) fail.push('日期面板未开');
  }],
  ['charts-hover', '/components/chart-line/', async (page, fail) => {
    const svg = page.locator('.icen-chart svg').first();
    if (!(await svg.count())) { fail.push('无图表 svg'); return; }
    const mark = page.locator('.icen-chart [data-icen-chart-mark]').first();
    if (!(await mark.count())) { fail.push('无命中标记 data-icen-chart-mark'); return; }
    await mark.hover({ force: true });
    await page.waitForTimeout(300);
    const tip = page.locator('.icen-chart-tooltip');
    if (!(await tip.count()) || (await tip.first().evaluate((el) => el.hidden))) fail.push('hover 标记无 tooltip');
  }],
  ['ai-tool-call', '/components/ai-tool-call/', async (page, fail) => {
    /* 图表回执必须内嵌渲染而非裸 JSON */
    const raw = await page.locator('.icen-ai-tool pre', { hasText: '"type"' }).count();
    const embedded = await page.locator('.icen-ai-tool-io-chart svg, .icen-ai-tool .icen-chart svg').count();
    if (!embedded && raw) fail.push('图表回执裸 JSON（嵌入渲染未生效）');
    const heads = page.locator('.icen-ai-tool .icen-ai-tool-head, .icen-ai-tool-head');
    if (!(await heads.count())) fail.push('无工具卡');
  }],
  ['ai-composer', '/components/ai-composer/', async (page, fail) => {
    const ring = page.locator('.icen-ai-usage-ring-fill');
    if (await ring.count()) {
      const stroke = await ring.first().evaluate((el) => getComputedStyle(el).stroke);
      if (!stroke || stroke === 'none') fail.push('用量环 fill 无 stroke（黑盘回归）');
    }
    const ta = page.locator('.icen-ai-composer textarea').first();
    await ta.click();
    await ta.pressSequentially('/', { delay: 60 });
    await page.waitForTimeout(400);
    if (!(await page.locator('.icen-ai-composer-popup:not([hidden])').count())) fail.push('/ 命令弹层未出');
  }],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let pass = 0;
const failures = [];
for (const [name, url, fn] of scenarios) {
  const fail = [];
  try {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(600);
    await fn(page, fail);
  } catch (e) {
    fail.push('异常 ' + String(e).slice(0, 160));
  }
  if (fail.length) { failures.push({ name, url, fail }); console.log(`✗ ${name}  →  ${fail.join('；')}`); }
  else { pass++; console.log(`✓ ${name}`); }
}
console.log(`\n══ 交互巡检：${pass}/${scenarios.length} 过 ══`);
await browser.close();
process.exit(failures.length ? 1 : 0);
