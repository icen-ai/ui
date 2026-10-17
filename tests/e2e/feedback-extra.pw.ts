import {test, expect} from '@playwright/test';

test('back-top auto button uses the shared chevron with a tooltip, and appears past the threshold', async ({page}) => {
  await page.goto('/components/back-top/');
  // 初始隐藏（opacity 0，不佔位不收焦），滚过阈值现身
  const btn = page.locator('.icen-back-top[data-icen-back-top-auto]');
  await expect(btn).toHaveCount(1);
  await expect(btn).toHaveCSS('opacity', '0');
  await page.evaluate(() => window.scrollTo({ top: 400 }));
  await expect(btn).toHaveCSS('opacity', '1', {timeout: 3000});
  await expect(btn.locator('svg')).toHaveAttribute('viewBox', '0 0 20 20');
  await btn.hover();
  await expect(page.locator('.icen-tooltip')).toHaveText('回到顶部');
  await btn.click();
  await page.waitForFunction(() => window.scrollY === 0, { timeout: 3000 });
});

test('progress demo animates with aria-valuenow in sync and resets cleanly', async ({page}) => {
  await page.goto('/components/progress/');
  const bar = page.locator('#demo-progress-bar');
  const region = page.locator('#demo-progress');
  await expect(region).toHaveAttribute('role', 'progressbar');
  await expect(region).toHaveAttribute('aria-valuenow', '24');
  await page.getByRole('button', {name: '构建一次'}).click();
  await expect(region).not.toHaveAttribute('aria-valuenow', '24', {timeout: 3000});
  await expect(region).toHaveAttribute('aria-valuenow', '100', {timeout: 8000});
  await expect(page.locator('#demo-progress-label')).toHaveText('100%');
  await page.getByRole('button', {name: '重置'}).click();
  await expect(page.locator('#demo-progress-label')).toHaveText('24%');
});
