import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('dots stay readable over colored media in both primitives and modes', async ({page}) => {
  await page.goto('/components/carousel/');
  await page.addScriptTag({path: require.resolve('axe-core')});
  for (const primitive of ['modern','pixel']) for (const dark of [false,true]) {
    await page.locator('html').evaluate((el,{primitive,dark}) => {el.dataset.icenStyle=primitive;el.dataset.icenTheme=dark?'dark':'light';},{primitive,dark});
    const dots = page.locator('.icen-carousel-dot');
    await expect(dots).toHaveCount(3);
    // 非激活：亮玻璃 + 分离环；激活：实心 pill 拉长——不依赖主题 accent（在 accent 色幻灯上也可辨）
    const probe = await dots.nth(1).evaluate(el => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, shadow: cs.boxShadow, w: el.getBoundingClientRect().width };
    });
    expect(probe.bg).toContain('0.58'); // 亮玻璃透明度
    expect(probe.shadow).not.toBe('none');
    const active = await page.locator('.icen-carousel-dot.is-active').evaluate(el => ({
      bg: getComputedStyle(el).backgroundColor, w: el.getBoundingClientRect().width,
    }));
    expect(active.w).toBe(20); // 激活 pill 拉长
    expect(active.bg).not.toContain('0.58');
    const issues = await page.locator('.demo-stage').evaluate(async root => {
      const r = await (window as any).axe.run(root, {runOnly:{type:'tag',values:['wcag2a','wcag2aa']}});
      return r.violations.filter((v:any) => ['serious','critical'].includes(v.impact)).map((v:any) => v.id);
    });
    expect(issues).toEqual([]);
  }
  await page.locator('.demo-stage').screenshot({path: '.ui-audit/carousel-desktop.png', animations: 'disabled'});
});

test('keyboard mirrors RTL and the index slot and live status track navigation', async ({page}) => {
  await page.goto('/components/carousel/');
  const carousel = page.locator('.icen-carousel');
  const status = carousel.locator('.icen-carousel-status');
  const index = carousel.locator('.icen-carousel-index');
  await expect(status).toHaveText('第 1 / 3 张');
  await expect(index).toHaveText('1 / 3');
  await carousel.locator('.icen-carousel-arrow--next').focus();
  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('第 2 / 3 张');
  await expect(index).toHaveText('2 / 3');
  await page.keyboard.press('ArrowRight'); // 末张回卷到首张
  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('第 1 / 3 张');
  // RTL：左键 = 视觉前进
  await page.locator('html').evaluate(el => { el.dir = 'rtl'; });
  await page.keyboard.press('ArrowLeft');
  await expect(status).toHaveText('第 2 / 3 张');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // 读屏语义
  await expect(carousel).toHaveAttribute('aria-roledescription', '轮播');
  await expect(carousel.locator('.icen-carousel-slide').nth(1)).toHaveAttribute('aria-roledescription', '幻灯片');
});

test('touch arrows meet 44px, reduced-motion drops sliding, and page swaps dispose cleanly', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, reducedMotion: 'reduce'});
  try {
    const page = await context.newPage();
    await page.goto('/components/carousel/');
    const arrow = page.locator('.icen-carousel-arrow--next');
    const box = (await arrow.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    // dot 视觉 6px、命中 44px（取非激活的一枚）
    const dot = page.locator('.icen-carousel-dot').nth(1);
    const hit = await dot.evaluate(el => {
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, '::after');
      return { w: r.width, inset: after.inset };
    });
    expect(hit.w).toBe(6);
    expect(hit.inset).toBe('-19px');
    await expect(page.locator('.icen-carousel-track')).toHaveCSS('transition-property', 'none');
    await arrow.tap();
    await expect(page.locator('.icen-carousel-status')).toHaveText('第 2 / 3 张');
    await page.locator('.demo-stage').screenshot({path: '.ui-audit/carousel-mobile.png', animations: 'disabled'});
    // 换页：状态行/圆点/语义随行为销毁而清理
    await page.locator('.doc-pager-next').click();
    await expect(page.locator('.icen-carousel-status')).toHaveCount(0);
  } finally { await context.close(); }
});
