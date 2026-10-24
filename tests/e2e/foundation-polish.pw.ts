import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const MARKUP = `
  <button id="control-md" class="icen-btn">保存</button>
  <button id="control-sm" class="icen-btn icen-btn-sm">小</button>
  <button id="control-lg" class="icen-btn icen-btn-lg">大</button>
  <div data-icen-density="compact" id="compact"><button class="icen-btn">紧凑</button><button class="icen-btn icen-btn-sm">紧凑小</button><button class="icen-btn icen-btn-lg">紧凑大</button>
    <div data-icen-density="comfortable" id="comfortable"><button class="icen-btn">宽松</button><button class="icen-btn icen-btn-sm">宽松小</button><button class="icen-btn icen-btn-lg">宽松大</button></div>
  </div>
  <div class="icen-toggle-group"><button class="icen-toggle-item is-active" aria-checked="true">列表</button><button class="icen-toggle-item" aria-checked="false">网格</button></div>
  <div class="icen-select" style="inline-size:230px">
    <button class="icen-select-trigger"><span class="icen-select-value">一个会被截断但不会覆盖操作槽的长选项名称</span></button>
    <span class="icen-select-chevron"></span>
    <button class="icen-select-clear" aria-label="清除">×</button>
  </div>
  <input class="icen-choice-box" type="checkbox" checked aria-label="原生选择" />
  <article class="icen-card">内容</article><div class="icen-modal"></div>
`;

async function mount(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/modern/');
  await page.setContent(`<html><body>${MARKUP}</body></html>`);
  await page.addStyleTag({ content: readFileSync('dist/ui.css', 'utf8') });
}

test('control roles, nested density and surface geometry stay coherent', async ({ page }) => {
  await mount(page);
  await expect(page.locator('#control-md')).toHaveCSS('height', '32px');
  await expect(page.locator('#control-sm')).toHaveCSS('height', '28px');
  await expect(page.locator('#control-lg')).toHaveCSS('height', '40px');
  await expect(page.locator('#control-md')).toHaveCSS('border-radius', '6px');
  await expect(page.locator('.icen-card')).toHaveCSS('border-radius', '12px');
  await expect(page.locator('.icen-modal')).toHaveCSS('border-radius', '16px');
  const compact = page.locator('#compact > .icen-btn');
  await expect(compact.nth(0)).toHaveCSS('height', '28px');
  await expect(compact.nth(1)).toHaveCSS('height', '24px');
  await expect(compact.nth(2)).toHaveCSS('height', '36px');
  const comfortable = page.locator('#comfortable > .icen-btn');
  await expect(comfortable.nth(0)).toHaveCSS('height', '38px');
  await expect(comfortable.nth(1)).toHaveCSS('height', '34px');
  await expect(comfortable.nth(2)).toHaveCSS('height', '46px');
  await expect(page.locator('.icen-toggle-item.is-active')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.icen-choice-box')).toHaveCSS('appearance', 'auto');
  await expect(page.locator('.icen-choice-box')).toHaveCSS('inline-size', '16px');
  await page.screenshot({ path: '.ui-audit/pref-design/foundation-controls.png', fullPage: true });
});

test('select reserves separate value, clear and disclosure slots at every size', async ({ page }) => {
  await mount(page);
  const metrics = await page.locator('.icen-select').evaluate(root => {
    const box = (selector: string) => root.querySelector(selector)!.getBoundingClientRect();
    const trigger = box('.icen-select-trigger');
    const value = box('.icen-select-value');
    const clear = box('.icen-select-clear');
    const chevron = box('.icen-select-chevron');
    return { triggerRight: trigger.right, valueRight: value.right, clearRight: clear.right, clearWidth: clear.width, chevronLeft: chevron.left };
  });
  expect(metrics.valueRight).toBeLessThanOrEqual(metrics.clearRight);
  expect(metrics.clearRight).toBeLessThan(metrics.chevronLeft);
  expect(metrics.chevronLeft).toBeLessThan(metrics.triggerRight);
  expect(metrics.clearWidth).toBe(24);
  await expect(page.locator('.icen-select-trigger')).toHaveCSS('padding-right', '55px');
  for (const size of ['sm', 'lg']) {
    await page.locator('.icen-select-trigger').evaluate((el, size) => el.classList.add(`icen-select-trigger--${size}`), size);
    await expect(page.locator('.icen-select-trigger')).toHaveCSS('padding-right', '55px');
    await page.locator('.icen-select-trigger').evaluate((el, size) => el.classList.remove(`icen-select-trigger--${size}`), size);
  }
});

test('coarse pointers expand the clear target and its reserved slot together', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/modern/');
    await page.setContent(`<html><body>${MARKUP}</body></html>`);
    await page.addStyleTag({ content: readFileSync('dist/ui.css', 'utf8') });
    await expect(page.locator('.icen-select-clear')).toHaveCSS('inline-size', '44px');
    await expect(page.locator('.icen-select-clear')).toHaveCSS('block-size', '44px');
    await expect(page.locator('.icen-select-trigger')).toHaveCSS('padding-right', '75px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
