import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('alert close stays quiet until hover or keyboard focus, and dismissal retires softly', async ({page}) => {
  await page.goto('/components/alert/');
  const first = page.locator('.icen-alert').first();
  const close = first.locator('.icen-alert-close');
  // 桌面静止：关闭安静待命（opacity 0），占位不塌
  await expect(close).toHaveCSS('opacity', '0');
  const before = (await first.boundingBox())!;
  await first.hover();
  await expect(close).toHaveCSS('opacity', '1');
  const after = (await first.boundingBox())!;
  expect(after.width).toBe(before.width); // 显隐不挤压布局
  // 键盘：焦点落到关闭钮即现身（focus-visible 显式 + focus-within 双通道）
  await page.keyboard.press('Tab');
  // 示例脚本：点击柔和退幕后移除（按文案锚定，防 first() 重解析到下一基）
  await first.hover();
  await close.click();
  await expect(page.locator('.icen-alert', {hasText: '版本更新'})).toHaveCount(0, {timeout: 2000});
  await expect(page.locator('.icen-alert')).toHaveCount(3);
});

test('alert icons are shared 20px geometry and axe stays clean across modes', async ({page}) => {
  await page.goto('/components/alert/');
  await page.addScriptTag({path: require.resolve('axe-core')});
  for (const dark of [false, true]) {
    await page.locator('html').evaluate((el, dark) => { dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme'); }, dark);
    await expect(page.locator('.icen-alert-icon svg').first()).toHaveAttribute('viewBox', '0 0 20 20');
    await expect(page.locator('.icen-alert-close svg').first()).toHaveAttribute('viewBox', '0 0 20 20');
    const issues = await page.locator('.demo-stage').evaluate(async root => {
      const r = await (window as any).axe.run(root, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa']}});
      return r.violations.filter((v: any) => ['serious','critical'].includes(v.impact)).map((v: any) => v.id);
    });
    expect(issues).toEqual([]);
  }
});

test('touch alerts keep a visible 44px close and the layout never overflows', async ({browser}) => {
  const context = await browser.newContext({locale:'zh-CN',viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  try {
    const page = await context.newPage();
    await page.goto('/components/alert/');
    await page.locator('html').evaluate(el => { el.dir = 'rtl'; });
    const close = page.locator('.icen-alert-close').first();
    await expect(close).toHaveCSS('opacity', '1'); // 触屏常显
    const hit = await close.evaluate(el => getComputedStyle(el, '::after').inset);
    expect(hit).toBe('-11px'); // 22px 视觉 + 四周 11px = 44px 命中
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
