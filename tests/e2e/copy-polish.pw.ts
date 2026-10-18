import {test, expect, type Page} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
async function clipboard(page: Page) {
  await page.addInitScript(() => {
    (window as any).writes = [];
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async (text: string) => {(window as any).writes.push(text);}}});
  });
}

test('copy retains stable slots and keyboard feedback across both primitives and modes', async ({page}) => {
  await clipboard(page);
  for (const primitive of ['modern', 'pixel']) for (const dark of [false, true]) {
    await page.goto('/components/copy/');
    await page.locator('html').evaluate((el, {primitive, dark}) => {el.dataset.icenStyle = primitive; el.dataset.icenTheme = dark ? 'dark' : 'light';}, {primitive, dark});
    const button = page.locator('.demo-stage .icen-copy-btn').first();
    const before = (await button.boundingBox())!;
    await button.focus(); await page.keyboard.press('Enter');
    await expect(button).toHaveClass(/is-done/);
    expect((await button.boundingBox())!.width).toBeCloseTo(before.width, 1);
    await expect(button.locator('.icen-copy-content')).toHaveText('复制安装命令');
    await expect(button).toHaveAttribute('aria-label', '已复制');
    expect(await page.evaluate(() => (window as any).writes)).toEqual(['bun add @icen.ai/ui']);
    await expect(button).not.toHaveClass(/is-done/); await expect(button).not.toHaveAttribute('aria-label');
    await expect(button).toBeFocused();
  }
});

test('copy exposes pending, visible failure and retry without duplicate work or stale descriptions', async ({page}) => {
  await clipboard(page); await page.goto('/components/copy/');
  const host = page.locator('#copy-retry-demo'), button = host.locator('button');
  const before = (await button.boundingBox())!;
  await button.click(); await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('.icen-feedback-action-spinner svg')).toHaveAttribute('viewBox', '0 0 20 20');
  expect((await button.boundingBox())!.width).toBeCloseTo(before.width, 1); await button.click();
  const failure = host.locator('.icen-copy-feedback'); await expect(failure).toHaveText('未能复制，请重试。');
  await expect(button).toHaveAttribute('aria-describedby', await failure.getAttribute('id') as string);
  await host.screenshot({path: '.ui-audit/copy-retry.png', animations: 'disabled'});
  expect(await page.evaluate(() => (window as any).writes.length)).toBe(0);
  await button.press('Enter'); await expect(button).toHaveClass(/is-done/);
  await expect(button).not.toHaveAttribute('aria-describedby');
  expect(await page.evaluate(() => (window as any).writes)).toEqual(['https://ui.icen.ai/modern/']);
  await expect(host.locator('.icen-copy-feedback')).toHaveCount(1);
});

test('copy feedback is readable in every palette and quiet actions reveal on keyboard focus', async ({page}) => {
  await clipboard(page); await page.goto('/components/copy/'); await page.addScriptTag({path: require.resolve('axe-core')});
  const button = page.locator('.demo-stage .icen-copy-btn').first(), icon = page.locator('.demo-stage .icen-copy-btn--quiet');
  await page.mouse.move(0, 0); await expect(icon).toHaveCSS('opacity', '0'); await icon.focus(); await expect(icon).toHaveCSS('opacity', '1');
  await expect(icon.locator('svg').first()).toHaveAttribute('viewBox', '0 0 20 20');
  for (const preset of ['modern', 'dongyun', 'jugou', 'piano', 'monet', 'vangogh']) for (const dark of [false, true]) {
    await page.locator('html').evaluate((el, {preset, dark}) => {el.dataset.icenPreset = preset; el.dataset.icenTheme = dark ? 'dark' : 'light';}, {preset, dark});
    await button.click(); await page.waitForTimeout(400);
    const issues = await page.locator('.demo-stage').evaluate(async root => {
      const result = await (window as any).axe.run(root, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}});
      return result.violations.filter((v: any) => ['serious', 'critical'].includes(v.impact)).map((v: any) => ({id: v.id, targets: v.nodes.map((n: any) => n.target)}));
    }); expect(issues).toEqual([]);
  }
});

test('touch RTL copy remains discoverable, respects reduced motion and keeps generous hit areas', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, reducedMotion: 'reduce'});
  try {
    const page = await context.newPage(); await clipboard(page); await page.goto('/components/copy/');
    await page.locator('html').evaluate(el => {el.dir = 'rtl'; el.dataset.icenStyle = 'pixel'; el.dataset.icenTheme = 'dark';});
    for (const button of await page.locator('.demo-stage .icen-copy-btn').all()) {
      const box = (await button.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
    }
    const icon = page.locator('.demo-stage .icen-copy-btn--quiet'); await expect(icon).toHaveCSS('opacity', '1'); await icon.tap();
    await expect(icon).toHaveClass(/is-done/); await expect(icon.locator('.icen-copy-result svg')).toHaveAttribute('viewBox', '0 0 20 20');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.demo-stage').screenshot({path: '.ui-audit/copy-mobile-rtl.png', animations: 'disabled'});
    await page.emulateMedia({forcedColors: 'active'}); await expect(icon).toHaveCSS('outline-style', 'solid');
  } finally {await context.close();}
});

test('SPA navigation aborts pending copy and returns with one set of live slots', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await clipboard(page);
  await page.goto('/components/copy/'); const button = page.locator('#copy-retry-demo button');
  await button.click(); await expect(button).toHaveAttribute('aria-busy', 'true');
  await page.locator('.doc-pager-next').click(); await expect(page.locator('#copy-retry-demo')).toHaveCount(0);
  await page.waitForTimeout(800); await expect(page.locator('.icen-copy-feedback')).toHaveCount(0);
  await page.locator('a[href="/components/copy/"]:visible').first().click();
  await expect(page.locator('.demo-stage .icen-copy-content')).toHaveCount(5);
  await page.locator('.demo-stage .icen-copy-btn').first().click(); await expect(page.locator('#copy-demo-log')).toHaveText('已复制，可以粘贴到需要的地方。');
  expect(errors).toEqual([]);
});
