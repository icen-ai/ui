import {test, expect} from '@playwright/test';

test('homepage installation loads the shared copy layers and keeps its icon on the command row', async ({page}) => {
  await page.goto('/'); const panel = page.locator('.pm-panel:visible'), button = panel.locator('.pm-copy');
  await expect(button.locator('.icen-copy-result')).toHaveCSS('visibility', 'hidden');
  const a = (await button.boundingBox())!, b = (await panel.locator('pre').boundingBox())!;
  expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThan(1);
  expect(a.x).toBeGreaterThanOrEqual(b.x + b.width);
  await page.locator('.pm-install').hover();
  await page.locator('.pm-install').screenshot({path: '.ui-audit/install-copy-home.png', animations: 'disabled'});
});

test('installation copy shares a centered row with every package command at both viewport sizes', async ({page}) => {
  await page.goto('/components/copy/');
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 900});
    for (const primitive of ['benzhen', 'pixel']) for (const dark of [false, true]) {
      await page.locator('html').evaluate((el, {primitive, dark}) => {el.dataset.icenStyle = primitive; el.dataset.icenTheme = dark ? 'dark' : 'light';}, {primitive, dark});
      for (const manager of ['bun', 'pnpm', 'npm', 'yarn']) {
        await page.locator('.pm-tab').getByText(manager, {exact: true}).click();
        const panel = page.locator('.pm-panel:visible'); await expect(panel).toHaveCount(1);
        const pre = (await panel.locator('pre').boundingBox())!, button = (await panel.locator('.pm-copy').boundingBox())!, bounds = (await panel.boundingBox())!;
        expect(Math.abs(pre.y + pre.height / 2 - button.y - button.height / 2)).toBeLessThan(1);
        expect(button.x).toBeGreaterThanOrEqual(pre.x + pre.width);
        expect(button.x + button.width).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(button.y).toBeGreaterThanOrEqual(bounds.y);
        await expect(panel.locator('.pm-copy svg').first()).toHaveAttribute('viewBox', '0 0 20 20');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('installation copy retains its position while pending, completed or showing a visible failure', async ({page}) => {
  await page.addInitScript(() => {
    (window as any).finishCopy = null;
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: () => new Promise<void>((resolve, reject) => {(window as any).finishCopy = {resolve, reject};})}});
    document.execCommand = () => false;
  });
  await page.goto('/components/copy/'); const install = page.locator('.pm-install'); await install.hover();
  const panel = page.locator('.pm-panel:visible'), button = panel.locator('.pm-copy'); const before = (await button.boundingBox())!;
  await button.click(); await expect(button).toHaveAttribute('aria-busy', 'true');
  expect((await button.boundingBox())!.x).toBeCloseTo(before.x, 1);
  await page.evaluate(() => (window as any).finishCopy.resolve()); await expect(button).toHaveClass(/is-done/);
  expect((await button.boundingBox())!.y).toBeCloseTo(before.y, 1);
  await button.click(); await page.evaluate(() => (window as any).finishCopy.reject(new Error('denied')));
  await expect(panel.locator('.icen-copy-feedback')).toHaveText('未能复制，请重试。');
  const pre = (await panel.locator('pre').boundingBox())!, box = (await button.boundingBox())!;
  expect(Math.abs(pre.y + pre.height / 2 - box.y - box.height / 2)).toBeLessThan(1);
  await page.screenshot({path: '.ui-audit/install-copy-page.png', animations: 'disabled'});
  await install.screenshot({path: '.ui-audit/install-copy-fixed.png', animations: 'disabled'});
});

test('ordinary code-block copy geometry is centered and generic icon buttons remain in normal flow', async ({page}) => {
  await page.goto('/components/code-block/');
  const block = page.locator('.demo-stage .icen-code-block').first(); await block.hover();
  const button = block.locator('[data-icen-code-block-copy]'), box = (await button.boundingBox())!, svg = (await button.locator('.icen-code-block-btn-icon svg').boundingBox())!;
  expect(Math.abs(svg.x + svg.width / 2 - box.x - box.width / 2)).toBeLessThan(1);
  expect(Math.abs(svg.y + svg.height / 2 - box.y - box.height / 2)).toBeLessThan(1);
  await page.goto('/components/copy/'); await expect(page.locator('.demo-stage .icen-copy-btn--icon')).toHaveCSS('position', 'relative');
});

test('touch RTL installation keeps commands readable and its 44px copy at the logical end', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  try {
    const page = await context.newPage(); await page.goto('/components/copy/'); await page.locator('html').evaluate(el => el.dir = 'rtl');
    const panel = page.locator('.pm-panel:visible'), button = panel.locator('.pm-copy'), pre = panel.locator('pre');
    const a = (await button.boundingBox())!, b = (await pre.boundingBox())!;
    expect(a.width).toBeGreaterThanOrEqual(44); expect(a.height).toBeGreaterThanOrEqual(44); expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    await expect(button).toHaveCSS('opacity', '1'); await expect(pre).toHaveCSS('direction', 'ltr'); await pre.focus(); await expect(pre).toBeFocused();
    await page.locator('.pm-install').screenshot({path: '.ui-audit/install-copy-mobile-rtl.png', animations: 'disabled'});
  } finally {await context.close();}
});
