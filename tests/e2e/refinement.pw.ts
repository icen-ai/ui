import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('application preferences are real, persisted, keyboard-operable and reversible', async ({ page }) => {
  await page.goto('/apps/');
  const sw = page.getByRole('switch', { name: '降低透明度' });
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-icen-transparency', 'reduced');
  await page.locator('#app-density').click();
  await page.getByRole('option', { name: '紧凑', exact: true }).click();
  await expect(page.locator('#apps-workspace')).toHaveAttribute('data-icen-density', 'compact');
  await page.locator('#app-appearance').getByRole('radio', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-icen-theme', 'dark');
  await page.locator('#app-motion').fill('0');
  await page.locator('#app-motion').dispatchEvent('change');
  await expect(page.locator('html')).toHaveCSS('--icen-design-motion', '0');
  await page.reload();
  await expect(page.locator('#apps-workspace')).toHaveAttribute('data-icen-density', 'compact');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '恢复默认', exact: true }).click();
  await expect(page.locator('#apps-workspace')).toHaveAttribute('data-icen-density', 'normal');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('#app-settings-status')).toContainText('设置已完成');
});

test('file workspace filters, paginates, inspects and imports real local selections', async ({ page }) => {
  await page.goto('/apps/');
  await page.getByRole('button', { name: '第 2 页', exact: true }).click();
  await expect(page.getByRole('button', { name: '打开 事件接口', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '打开 事件接口', exact: true }).click();
  await expect(page.locator('#files .app-inspector-title')).toHaveText('事件接口');
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索资料', exact: true }).fill('权限');
  await expect(page.locator('#files tbody tr')).toHaveCount(1);
  await expect(page.locator('#files tbody')).toContainText('权限模型');
  await page.getByRole('searchbox', { name: '搜索资料', exact: true }).fill('没有此资料');
  await expect(page.locator('#files tbody')).toContainText('没有匹配资料');
  await page.locator('#app-file-upload').setInputFiles({ name: '本机验证.txt', mimeType: 'text/plain', buffer: Buffer.from('本地资料') });
  await expect(page.getByRole('button', { name: '打开 本机验证.txt', exact: true })).toBeVisible();
  await expect(page.locator('#app-file-status')).toContainText('已添加 1 个本机来源');
  await page.locator('#files .app-side').getByRole('link', { name: '接口文档', exact: true }).click();
  await expect(page.locator('#files tbody tr')).toHaveCount(2);
});

test('AI composition streams locally, stops and survives client navigation without duplicate replies', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const external: string[] = [];
  page.on('request', request => { if (/api\.(openai|anthropic)/.test(request.url())) external.push(request.url()); });
  await page.goto('/apps/');
  await page.locator('#ai .icen-ai-tool-head').click();
  await expect(page.locator('#ai .icen-ai-tool-body')).toBeVisible();
  const composer = page.locator('#app-composer');
  await composer.getByRole('textbox', { name: '输入消息' }).fill('检索权限');
  await composer.locator('[data-icen-ai-send]').click();
  await expect(page.locator('#app-messages')).toContainText('本地演示：');
  await expect(composer.locator('.is-stop')).toBeVisible();
  await composer.locator('.is-stop').click();
  await expect(composer.locator('.is-stop')).toHaveCount(0);
  await composer.getByRole('textbox', { name: '输入消息' }).fill('继续验证');
  await composer.locator('[data-icen-ai-send]').click();
  await expect(page.locator('#app-messages')).toContainText('消息与附件均不上传');
  await expect(composer.locator('.is-stop')).toHaveCount(0);
  await page.locator('.docs-group-links').getByRole('link', { name: '全部组件', exact: true }).click();
  await page.locator('.docs-group-links').getByRole('link', { name: '应用组合', exact: true }).click();
  await expect(page.locator('#app-composer')).toBeVisible();
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('analytics range changes both the real chart and the summary values', async ({ page }) => {
  await page.goto('/apps/');
  await page.locator('#app-period').getByRole('radio', { name: '24h', exact: true }).click();
  await expect(page.locator('#analytics .icen-stat-num').first()).toHaveText('96.0%');
  await expect(page.locator('#app-analytics-chart circle[data-icen-chart-mark]:not([data-icen-chart-hit])')).toHaveCount(6);
  await page.locator('#app-period').getByRole('radio', { name: '24h', exact: true }).press('End');
  await expect(page.locator('#analytics .icen-stat-num').first()).toHaveText('91.4%');
  await expect(page.locator('#analytics .app-chart-meta')).toContainText('30d');
});

test('published CSS has working motion, distinct contours, opaque planes and nested density', async ({ page }) => {
  await page.goto('/apps/');
  await page.setContent('<html><body><button class="icen-btn is-loading">保存</button><article class="icen-card">内容</article><div class="icen-modal"></div><div class="icen-modal-backdrop"></div><div class="icen-popover"></div><nav class="icen-nav is-scrolled"></nav><div class="icen-chart-vbar-bar"></div><div data-icen-density="compact"><button class="icen-kb-run">运行</button><div data-icen-density="comfortable"><button class="icen-kb-run">运行</button></div></div></body></html>');
  await page.addStyleTag({ content: readFileSync('dist/ui.css', 'utf8') });
  await expect(page.locator('.icen-btn')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('.icen-card')).toHaveCSS('border-radius', '14px');
  await expect(page.locator('.icen-modal')).toHaveCSS('border-radius', '20px');
  await expect(page.locator('.icen-chart-vbar-bar')).toHaveCSS('transition-duration', '0.26s, 0.11s');
  expect(await page.locator('.icen-popover').evaluate(el => getComputedStyle(el).animationDuration)).toBe('0.11s');
  await expect(page.locator('.icen-popover')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.icen-modal-backdrop')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.icen-nav')).toHaveCSS('backdrop-filter', 'none');
  expect(await page.locator('.icen-nav').evaluate(el => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.fillStyle = getComputedStyle(el).backgroundColor; context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[3];
  })).toBe(255);
  await expect(page.locator('.icen-kb-run').first()).toHaveCSS('height', '24px');
  await expect(page.locator('.icen-kb-run').last()).toHaveCSS('height', '32px');
  await page.locator('html').evaluate(el => el.style.setProperty('--icen-design-font-size', '17px'));
  await expect(page.locator('.icen-kb-run').last()).toHaveCSS('font-size', '17px');
  const spinner = await page.locator('.icen-btn').evaluate(el => getComputedStyle(el, '::after').borderTopColor);
  expect(spinner).not.toBe('rgba(0, 0, 0, 0)');
});

test('workspace stays accessible in light/dark and at touch widths with no glass', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(); await page.goto('/apps/');
    await page.addScriptTag({ path: require.resolve('axe-core') });
    for (const dark of [false, true]) {
      await page.locator('html').evaluate((el, dark) => dark ? el.setAttribute('data-icen-theme', 'dark') : el.removeAttribute('data-icen-theme'), dark);
      const issues = await page.locator('#apps-workspace').evaluate(async root => (await (window as any).axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map((v: any) => ({ id: v.id, targets: v.nodes.map((n: any) => n.target) })));
      expect(issues).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('#app-save')).toHaveCSS('height', '44px');
      const columns = await page.locator('#analytics .icen-stat-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(2);
      await expect(page.locator('#files .app-side').getByRole('link', { name: '接口文档', exact: true })).toBeVisible();
    }
  } finally { await context.close(); }
});
