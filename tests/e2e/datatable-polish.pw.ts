import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('datatable demo renders status pills, quiet row actions and shared icon geometry', async ({page}) => {
  await page.goto('/components/datatable/');
  const table = page.locator('#dtv-multisort');
  await expect(table.locator('.icen-datatable')).toBeVisible();
  // 状态列是语义胶囊而不是裸枚举文本
  const pills = table.locator('.icen-dt-body .icen-pill');
  await expect(pills.first()).toBeVisible();
  await expect(table.locator('.icen-dt-body').first()).not.toContainText('todo');
  // 表头排序/筛选、分页方向、工具钮全部共享 20px 几何
  await expect(table.locator('.icen-dt-sort svg').first()).toHaveAttribute('viewBox', '0 0 20 20');
  await expect(table.locator('.icen-dt-page-btn svg').first()).toHaveAttribute('viewBox', '0 0 20 20');
  // 行悬停显现隐式动作；点击给真实回执
  const row = table.locator('.icen-dt-body .icen-dt-row').first();
  const actions = row.locator('.icen-dt-actions');
  await expect(actions).toHaveCSS('opacity', '0');
  await row.hover();
  await expect(actions).toHaveCSS('opacity', '1');
  const eye = row.locator('.icen-dt-action').first();
  await eye.hover(); // 移到动作上：tooltip（全局 initTooltip）portal 呈现
  await expect(page.locator('.icen-tooltip')).toBeVisible();
  await eye.click();
  await expect(page.locator('.icen-toast').first()).toContainText('查看：');
});

test('datatable demo stays accessible and touch actions keep 44px without page overflow', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  try {
    const page = await context.newPage();
    await page.goto('/components/datatable/');
    await page.addScriptTag({path: require.resolve('axe-core')});
    const table = page.locator('#dtv-multisort');
    await expect(table.locator('.icen-datatable')).toBeVisible();
    // 触屏动作常显 + 隐形 44px 命中（透明 border + 负 margin，不与 tooltip 伪元素争用）
    const action = table.locator('.icen-dt-action').first();
    await expect(action).toHaveCSS('opacity', '1');
    expect(await action.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('9px');
    expect(await action.evaluate(el => getComputedStyle(el).marginTop)).toBe('-9px');
    // 页面不横向溢出（表格内部自滚）
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const issues = await table.evaluate(async el => {
      const r = await (window as any).axe.run(el, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa']}});
      return r.violations.filter((v: any) => ['serious','critical'].includes(v.impact)).map((v: any) => ({ id: v.id, targets: v.nodes.map((n: any) => n.target) }));
    });
    expect(issues).toEqual([]);
  } finally { await context.close(); }
});
