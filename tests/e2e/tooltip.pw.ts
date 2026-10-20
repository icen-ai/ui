import {test, expect} from '@playwright/test';

test('Escape suppresses the CSS fallback and removes only the owned description after hover plus focus', async ({page}) => {
  await page.goto('/components/tooltip/');
  const trigger = page.locator('.demo-stage button[data-icen-tooltip="默认在上方"]');
  await trigger.evaluate(el => el.setAttribute('aria-describedby', 'original-help'));
  await trigger.hover();
  await expect(page.locator('.icen-tooltip')).toBeVisible();
  await trigger.focus();
  await trigger.evaluate(el => el.setAttribute('aria-describedby', el.getAttribute('aria-describedby') + ' live-help'));
  await page.keyboard.press('Escape');
  await expect(page.locator('.icen-tooltip')).toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-describedby', 'original-help live-help');
  await page.waitForTimeout(450);
  expect(await trigger.evaluate(el => getComputedStyle(el, '::after').content)).toBe('none');
  // Leave both input modalities before a fresh hover can open another tooltip.
  await trigger.blur(); await page.mouse.move(0, 800); await trigger.hover();
  await expect(page.locator('.icen-tooltip')).toBeVisible();
});

test('a reader can move across the gap onto a tooltip; keyboard focus keeps it open', async ({page}) => {
  await page.goto('/components/tooltip/');
  const trigger = page.locator('.demo-stage button[data-icen-tooltip-multiline="true"]');
  await trigger.hover();
  const tip = page.locator('.icen-tooltip');
  await expect(tip).toBeVisible();
  await tip.hover();
  await page.waitForTimeout(600);
  await expect(tip).toBeVisible();
  await page.mouse.move(0, 800);
  await expect(tip).toHaveCount(0);
  await trigger.focus();
  await expect(tip).toBeVisible();
  await trigger.hover(); await page.mouse.move(0, 800);
  await page.waitForTimeout(400);
  await expect(tip).toBeVisible();
});

test('clicking during the hover delay does not resurrect a CSS tooltip', async ({page}) => {
  await page.goto('/components/tooltip/');
  const trigger = page.locator('.demo-stage button[data-icen-tooltip="默认在上方"]');
  await trigger.hover(); await trigger.click();
  await page.waitForTimeout(500);
  await expect(page.locator('.icen-tooltip')).toHaveCount(0);
  expect(await trigger.evaluate(el => getComputedStyle(el, '::after').content)).toBe('none');
});

test('code block toolbar tooltip portals to body and stays fully visible above the block edge', async ({page}) => {
  await page.goto('/components/code-block/');
  const btn = page.locator('.icen-code-block [data-icen-code-block-copy]').first();
  const block = page.locator('.icen-code-block').first();
  await btn.hover();
  const tip = page.locator('.icen-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText('复制');
  // portal：气泡是 body 直接子级，不再是被 overflow:hidden 裁切的 ::after
  expect(await tip.evaluate(el => el.parentElement === document.body)).toBe(true);
  await expect(btn).toHaveAttribute('data-icen-tooltip-live');
  expect(await btn.evaluate(el => getComputedStyle(el, '::after').content)).toBe('none');
  const tipBox = (await tip.boundingBox())!;
  const btnBox = (await btn.boundingBox())!;
  // side=bottom：气泡完整落在按钮下方视口内，不被块顶缘裁掉
  expect(tipBox.y).toBeGreaterThanOrEqual(btnBox.y + btnBox.height - 1);
  expect(tipBox.y).toBeGreaterThanOrEqual(0);
  expect(tipBox.x).toBeGreaterThanOrEqual(0);
  expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(1440);
  // SSR 与 DOM 路径一致带 side=bottom
  await expect(page.locator('.icen-code-block [data-icen-code-block-wrap]').first()).toHaveAttribute('data-icen-tooltip-side', 'bottom');
  await expect(block).toBeVisible();
});

test('keyboard focus shows immediately, Escape closes and pointer click never flashes a tooltip', async ({page}) => {
  await page.goto('/components/tooltip/');
  const up = page.locator('.demo-stage button[data-icen-tooltip="默认在上方"]');
  await up.focus();
  await expect(page.locator('.icen-tooltip')).toBeVisible(); // focus-visible 无 400ms 延迟
  await page.keyboard.press('Escape');
  await expect(page.locator('.icen-tooltip')).toHaveCount(0);
  await up.click();
  await page.waitForTimeout(500);
  await expect(page.locator('.icen-tooltip')).toHaveCount(0); // 点击不闪提示
});

test('viewport edges flip and clamp; multiline wraps; motion honors reduced-motion', async ({page}) => {
  await page.goto('/components/tooltip/');
  const up = page.locator('.demo-stage button[data-icen-tooltip="默认在上方"]');
  // 模拟贴视口顶的锚点（如 sticky 工具栏）：顶侧放不下时下翻
  await up.evaluate(el => { const s = el.style; s.position = 'fixed'; s.top = '72px'; s.left = '120px'; s.zIndex = '900'; });
  await up.hover();
  const tip = page.locator('.icen-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toHaveAttribute('data-icen-side', 'bottom'); // 顶缘空间不足翻到下侧
  const box = (await tip.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);

  const multi = page.locator('.demo-stage button[data-icen-tooltip-multiline="true"]');
  await multi.hover();
  await expect(tip).toHaveClass(/is-multiline/);
  await multi.evaluate(el => (el as HTMLElement).blur());

  const reduced = await page.context().newPage();
  await reduced.emulateMedia({reducedMotion: 'reduce'});
  await reduced.goto('/components/tooltip/');
  await reduced.locator('.demo-stage button[data-icen-tooltip="默认在上方"]').focus();
  await expect(reduced.locator('.icen-tooltip')).toBeVisible();
  expect(await reduced.locator('.icen-tooltip').evaluate(el => getComputedStyle(el).translate)).toBe('none');
  await reduced.close();
});

test('mobile RTL tooltips stay inside the viewport and page swaps dispose the bubble', async ({browser}) => {
  const context = await browser.newContext({locale:'zh-CN',viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  try {
    const page = await context.newPage();
    await page.goto('/components/tooltip/');
    await page.locator('html').evaluate(el => { el.dir = 'rtl'; });
    const right = page.locator('.demo-stage button[data-icen-tooltip-side="right"]');
    await right.evaluate(el => el.dispatchEvent(new PointerEvent('pointerover', {bubbles: true, pointerType: 'mouse'})));
    const tip = page.locator('.icen-tooltip');
    await expect(tip).toBeVisible();
    const box = (await tip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    // 换页：触发器随旧文档移除，气泡立即摘除不残留
    await page.locator('.doc-pager-next').click();
    await expect(page.locator('.icen-tooltip')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
