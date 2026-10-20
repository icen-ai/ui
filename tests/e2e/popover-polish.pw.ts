import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('declarative popover opens with focus, syncs the trigger and retires with a soft exit', async ({page}) => {
  await page.goto('/components/popover/');
  const trigger = page.getByRole('button', {name: '筛选', exact: true});
  const panel = page.locator('#popover-demo-panel');
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAttribute('aria-controls', 'popover-demo-panel');
  await expect(panel.locator('#popover-demo-input')).toBeFocused(); // data-icen-autofocus
  // 面板贴触发器下缘且不岀视口
  const t = (await trigger.boundingBox())!, p = (await panel.boundingBox())!;
  expect(p.y).toBeGreaterThanOrEqual(t.y + t.height);
  expect(p.x).toBeGreaterThanOrEqual(0);
  expect(p.x + p.width).toBeLessThanOrEqual(1440);

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused(); // 焦点归还触发器
  await expect(panel).toBeHidden({timeout: 2000}); // 退场后还原 hidden

  // 快速重开：退场中断续接，面板始终唯一且仍可交互
  await trigger.click();
  await page.keyboard.press('Escape');
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(page.locator('#popover-demo-panel')).toHaveCount(1);
  await panel.locator('#popover-demo-input').fill('overlay');
  await page.getByRole('button', {name: '应用', exact: true}).click();
  await expect(panel).toBeHidden({timeout: 2000});
  await expect(page.locator('.icen-toast').first()).toContainText('已应用筛选：overlay');
});

test('header close button works in both primitives and modes with clean a11y', async ({page}) => {
  await page.goto('/components/popover/');
  await page.addScriptTag({path: require.resolve('axe-core')});
  for (const primitive of ['modern','pixel']) for (const dark of [false,true]) {
    await page.locator('html').evaluate((el,{primitive,dark}) => {el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme');},{primitive,dark});
    const trigger = page.getByRole('button', {name: '筛选', exact: true});
    await trigger.click();
    const panel = page.locator('#popover-demo-panel');
    await expect(panel).toBeVisible();
    const issues = await panel.evaluate(async el => {
      // Scan the settled panel, not the first transparent frame of its entrance.
      await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
      const r = await (window as any).axe.run(el, {runOnly:{type:'tag',values:['wcag2a','wcag2aa']}});
      return r.violations.filter((v:any) => ['serious','critical'].includes(v.impact)).map((v:any) => v.id);
    });
    expect(issues).toEqual([]);
    await panel.getByRole('button', {name: '关闭筛选'}).click();
    await expect(panel).toBeHidden({timeout: 2000});
  }
});

test('mobile RTL popover clamps inside the viewport and page swaps dispose cleanly', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  try {
    const page = await context.newPage();
    await page.goto('/components/popover/');
    await page.locator('html').evaluate(el => { el.dir = 'rtl'; el.dataset.icenTheme = 'dark'; });
    const trigger = page.getByRole('button', {name: '筛选', exact: true});
    await trigger.tap();
    const panel = page.locator('#popover-demo-panel');
    await expect(panel).toBeVisible();
    const p = (await panel.boundingBox())!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.demo-stage').screenshot({path: '.ui-audit/popover-mobile-rtl.png', animations: 'disabled'});
    await page.locator('.doc-pager-next').click();
    await expect(page.locator('#popover-demo-panel')).toHaveCount(0); // 换页不残留 portal 面板（归还后随旧文档移除）
  } finally { await context.close(); }
});
