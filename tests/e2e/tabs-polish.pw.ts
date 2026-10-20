import {test, expect} from '@playwright/test';

test('tabs: ink bar slides between tabs, keyboard roves and hash syncs', async ({page}) => {
  await page.goto('/components/tabs/');
  const nav = page.locator('.icen-tabs[data-icen-tabs-ink]').first();
  const ink = nav.locator('.icen-tabs-ink');
  await expect(ink).toBeVisible();
  const tabs = nav.locator('.icen-page-tab');
  // 墨水条初始宽度落在活动 tab 上
  const inkW = await ink.evaluate(el => el.style.width);
  const tabW = await tabs.first().evaluate(el => el.getBoundingClientRect().width);
  expect(Math.abs(parseFloat(inkW) - tabW)).toBeLessThan(2);

  // 点击切页：墨水条位移 + 面板切换 + hash 同步（replace）
  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveClass(/is-active/);
  await expect(page.locator('[data-icen-tab-panel="rollback"]')).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe('#rollback');
  // 墨水条位置跟随（x 移动）
  const inkTransform = await ink.evaluate(el => el.style.transform);
  expect(inkTransform).toContain('translateX');

  // 键盘：manual 模式方向键移焦点不激活，Enter 激活
  await tabs.nth(2).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(2)).toHaveClass(/is-active/); // 焦点移动不改变激活
  await page.keyboard.press('Enter');
  await expect(tabs.nth(1)).toHaveClass(/is-active/);
  await expect(page.locator('[data-icen-tab-panel="checks"]')).toBeVisible();

  // Home/End + roving tabindex（tabindex=0 跟焦点走；激活与焦点分离是 manual 模式的本义）
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  expect(await tabs.first().getAttribute('tabindex')).toBe('0'); // 焦点项入 Tab 序
  expect(await tabs.nth(1).getAttribute('tabindex')).toBe('-1'); // 激活但未聚焦则让位
});

test('tabs ink has no double underline and the page stays clean in dark + RTL', async ({page}) => {
  await page.goto('/components/tabs/');
  await page.locator('html').evaluate(el => { el.dir = 'rtl'; el.dataset.icenTheme = 'dark'; });
  const active = page.locator('.icen-tabs[data-icen-tabs-ink] .icen-page-tab.is-active').first();
  expect(await active.evaluate(el => getComputedStyle(el).borderBottomColor)).toBe('rgba(0, 0, 0, 0)'); // 墨水条接管，不双画
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
