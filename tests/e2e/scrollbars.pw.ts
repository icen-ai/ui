import { test, expect } from '@playwright/test';

test('native bars remove arrows, reveal per scroller, hide at idle and retain keyboard access', async ({ page }) => {
  await page.goto('/components/scroll-area/');
  await expect(page.locator('html')).toHaveAttribute('data-icen-scrollbars-ready', '');
  const scroller = page.locator('.icen-scroll-area').nth(1);
  // Use the real demo, actual overflow and native keyboard scrolling.
  await scroller.evaluate(el => {
    el.removeAttribute('data-icen-scrollbars'); // verify inherited global scroll default
    el.setAttribute('data-icen-scrollbar-delay', '600');
    (el as HTMLElement).style.scrollBehavior = 'auto';
  });
  await page.mouse.move(0, 0);
  const thumb = () => scroller.evaluate(el => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.fillStyle = getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  });
  await expect.poll(thumb).toBe(0);
  await page.screenshot({ path: '.ui-audit/scrollbars/idle-hidden.png' });
  const geometry = await scroller.evaluate(el => ({ width: getComputedStyle(el).scrollbarWidth, button: getComputedStyle(el, '::-webkit-scrollbar-button').display, size: getComputedStyle(el, '::-webkit-scrollbar').width, client: el.clientWidth }));
  expect(geometry).toMatchObject({ width: 'auto', button: 'none', size: '6px' });
  await scroller.hover();
  await expect.poll(thumb).toBe(0); // scroll mode ignores hover
  await scroller.evaluate(el => { el.scrollTop = 60; });
  await expect(scroller).toHaveAttribute('data-icen-scroll-active', '');
  await expect.poll(thumb).toBeGreaterThan(0);
  await page.screenshot({ path: '.ui-audit/scrollbars/scroll-active.png' });
  await expect(scroller).not.toHaveAttribute('data-icen-scroll-active');
  await expect.poll(thumb).toBe(0);
  expect(await scroller.evaluate(el => el.clientWidth)).toBe(geometry.client);
  await scroller.evaluate(el => el.setAttribute('data-icen-scrollbars', 'auto'));
  await scroller.hover(); // explicit auto mode adds hover visibility
  await expect.poll(thumb).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  await expect.poll(thumb).toBe(0);
  await scroller.evaluate(el => { el.scrollTop = 80; });
  await expect(scroller).toHaveAttribute('data-icen-scroll-active', '');
  await expect.poll(thumb).toBeGreaterThan(0);
  await expect(scroller).not.toHaveAttribute('data-icen-scroll-active');
  await expect.poll(thumb).toBe(0);
  await scroller.focus();
  await expect.poll(thumb).toBeGreaterThan(0);
  const top = await scroller.evaluate(el => el.scrollTop);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(top);
  await page.screenshot({ path: '.ui-audit/scrollbars/keyboard-visible.png' });
});

test('local policies and slots override scopes; forced colors remain usable; navigation reinstalls tracking', async ({ page }) => {
  await page.goto('/components/scroll-area/');
  const area = page.locator('.icen-scroll-area').first();
  await page.mouse.move(0, 0);
  await area.evaluate(el => {
    el.setAttribute('data-icen-scrollbars', 'visible');
    el.setAttribute('data-icen-scrollbar-gutter', 'both-edges');
    (el as HTMLElement).style.setProperty('--icen-token-scrollbar-size', '10px');
  });
  expect(await area.evaluate(el => ({ thumb: getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor, size: getComputedStyle(el, '::-webkit-scrollbar').width, gutter: getComputedStyle(el).scrollbarGutter }))).toMatchObject({ size: '10px', gutter: 'stable both-edges' });
  expect(await area.evaluate(el => getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await area.evaluate(el => el.setAttribute('data-icen-scrollbars', 'hidden'));
  expect(await area.evaluate(el => getComputedStyle(el, '::-webkit-scrollbar').display)).toBe('none');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  expect(await area.evaluate(el => getComputedStyle(el, '::-webkit-scrollbar').display)).toBe('block');
  expect(await area.evaluate(el => getComputedStyle(el, '::-webkit-scrollbar-thumb').transitionDuration)).toBe('0s');
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
  const group = page.locator('.docs-group').filter({ has: page.locator('a[href="/components/btn/"]') });
  if (await group.getAttribute('open') === null) await group.locator('summary').click();
  await page.locator('.docs-side a[href="/components/btn/"]').click();
  await expect(page).toHaveURL(/\/components\/btn\//);
  await expect(page.locator('html')).toHaveAttribute('data-icen-scrollbars-ready', '');
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator('html')).toHaveAttribute('data-icen-scroll-active', '');
});

test('CSS-only consumers keep visible bars and nested explicit policies win', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/components/scroll-area/');
    const area = page.locator('.icen-scroll-area').first();
    await expect(page.locator('html')).not.toHaveAttribute('data-icen-scrollbars-ready');
    expect(await area.evaluate(el => getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await area.evaluate(el => {
      el.parentElement!.setAttribute('data-icen-scrollbars', 'hidden');
      el.setAttribute('data-icen-scrollbars', 'visible');
    });
    expect(await area.evaluate(el => getComputedStyle(el, '::-webkit-scrollbar').display)).toBe('block');
  } finally { await context.close(); }
});
