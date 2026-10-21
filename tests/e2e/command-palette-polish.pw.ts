import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

const demo = (page: import('@playwright/test').Page) => page.locator('.icen-command-palette-backdrop[data-icen-command-palette="demo-cp"]');

test('demo trigger opens a combobox palette; arrows, Home/End and Enter drive the cursor', async ({page}) => {
  await page.goto('/components/command-palette/');
  await page.locator('.demo-stage [data-icen-command-palette-open="demo-cp"]').click();
  const backdrop = demo(page);
  await expect(backdrop).toBeVisible();
  const input = backdrop.locator('.icen-command-palette-input');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('role', 'combobox');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  const body = backdrop.locator('.icen-command-palette-body');
  await expect(body).toHaveAttribute('role', 'listbox');
  await expect(input).toHaveAttribute('aria-controls', await body.getAttribute('id') ?? '');

  // 过滤后首项激活，activedescendant 同步；Home/End 与回卷
  await input.fill('设置');
  const active = backdrop.locator('.icen-command-palette-item.is-active');
  await expect(active).toBeVisible();
  await expect(input).toHaveAttribute('aria-activedescendant', await active.getAttribute('id') ?? '');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowDown'); // 回卷到首项
  const first = backdrop.locator('.icen-command-palette-item:not([hidden])').first();
  await expect(first).toHaveClass(/is-active/);

  // Enter 执行并关闭（退场有过渡，最终 hidden；焦点归还触发点区域）
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(backdrop).toBeHidden({timeout: 2000});

  // 全局快捷键落到文档序第一个匹配者：本站是全站搜索面板（真实产品行为）
  await page.keyboard.press('Control+k');
  const siteNav = page.locator('.icen-command-palette-backdrop[data-icen-command-palette="site-nav"]');
  await expect(siteNav).toBeVisible();
  await expect(siteNav.locator('.icen-command-palette-input')).toHaveAttribute('role', 'combobox');
  await page.keyboard.press('Escape');
  await expect(siteNav).toBeHidden({timeout: 2000});
});

test('Escape retires softly, restores focus and reopening continues seamlessly', async ({page}) => {
  await page.goto('/components/command-palette/');
  const opener = page.locator('.demo-stage [data-icen-command-palette-open]').first();
  await opener.click();
  const backdrop = demo(page);
  await expect(backdrop).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(backdrop).toHaveAttribute('data-icen-state', 'closing');
  await expect(opener).toBeFocused(); // 焦点立即归还
  await expect(backdrop).toBeHidden({timeout: 2000});
  // 快速重开不重复面板
  await opener.click();
  await page.keyboard.press('Escape');
  await opener.click();
  await expect(page.locator('.icen-command-palette-backdrop:visible')).toHaveCount(1);
  await expect(backdrop.locator('.icen-command-palette-input')).toBeFocused();
});

test('open palette is readable in both primitives and modes; mobile stays inside the viewport', async ({page}) => {
  await page.goto('/components/command-palette/');
  await page.addScriptTag({path: require.resolve('axe-core')});
  for (const primitive of ['modern','pixel']) for (const dark of [false,true]) {
    await page.locator('html').evaluate((el,{primitive,dark}) => {el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme');},{primitive,dark});
    await page.locator('.demo-stage [data-icen-command-palette-open="demo-cp"]').click();
    const backdrop = demo(page);
    await expect(backdrop).toBeVisible();
    // 等进场动画落定再扫描（半透明中间帧不是稳定态）
    await expect.poll(() => backdrop.evaluate(el => el.getAnimations({subtree: true}).filter(a => a.playState === 'running').length)).toBe(0);
    const issues = await backdrop.evaluate(async el => {
      const r = await (window as any).axe.run(el, {runOnly:{type:'tag',values:['wcag2a','wcag2aa']}});
      return r.violations.filter((v:any) => ['serious','critical'].includes(v.impact)).map((v:any) => ({id: v.id, targets: v.nodes.map((n:any) => n.target)}));
    });
    expect(issues).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(backdrop).toBeHidden({timeout: 2000});
  }
  if (true) {
    await page.locator('.demo-stage [data-icen-command-palette-open="demo-cp"]').click();
    await expect(demo(page)).toBeVisible();
    await page.screenshot({path: '.ui-audit/command-palette-open.png'});
  }
});

test('mobile touch targets and viewport fit', async ({browser}) => {
  const context = await browser.newContext({locale:'zh-CN',viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  try {
    const page = await context.newPage();
    await page.goto('/components/command-palette/');
    await page.locator('.demo-stage [data-icen-command-palette-open]').first().tap();
    const backdrop = demo(page);
    await expect(backdrop).toBeVisible();
    const p = (await backdrop.locator('.icen-command-palette').boundingBox())!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // 外点关闭
    await backdrop.tap({position: {x: 4, y: 4}});
    await expect(backdrop).toBeHidden({timeout: 2000});
  } finally { await context.close(); }
});
