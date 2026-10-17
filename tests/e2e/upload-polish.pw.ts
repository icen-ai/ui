import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('seeded list renders real thumbnails and quiet removal, errors surface honestly', async ({page}) => {
  await page.goto('/components/upload/');
  const zone = page.locator('.icen-upload[data-icen-upload-list]');
  const rows = zone.locator('.icen-upload-list-item');
  await expect(rows).toHaveCount(2); // 预置 changelog.pdf + cover.png
  await expect(zone.locator('.icen-upload-list-item-thumb')).toHaveCount(1); // 图片得真缩略图
  await expect(zone.locator('.icen-upload-list-item-icon svg')).toHaveAttribute('viewBox', '0 0 20 20');
  await expect(rows.first().locator('.icen-upload-list-item-name')).toHaveText('changelog.pdf');

  // 隐式移除：静止 opacity 0，悬停现身；点击后行移除
  const x = rows.first().locator('.icen-upload-list-item-x');
  await expect(x).toHaveCSS('opacity', '0');
  await rows.first().hover();
  await expect(x).toHaveCSS('opacity', '1');
  await x.click();
  await expect(rows).toHaveCount(1);

  // 拖入类型不符的文件 → 错误条诚实呈现并自动隐去
  await zone.evaluate(el => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'evil.exe', { type: 'application/x-msdownload' }));
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  const msg = page.locator('#demo-upload-files');
  await expect(msg).toBeVisible();
  await expect(msg).toContainText('evil.exe');
  await expect(msg).toBeHidden({ timeout: 5000 });
});

test('upload zone is readable in both modes and touch removal stays at 44px', async ({page}) => {
  await page.goto('/components/upload/');
  await page.addScriptTag({path: require.resolve('axe-core')});
  await expect(page.locator('.icen-upload-list-item')).toHaveCount(2);
  const issues = await page.locator('.demo-stage').evaluate(async root => {
    const r = await (window as any).axe.run(root, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa']}});
    return r.violations.filter((v: any) => ['serious','critical'].includes(v.impact)).map((v: any) => ({ id: v.id, targets: v.nodes.map((n: any) => n.target) }));
  });
  expect(issues).toEqual([]);

  const context = await page.context().browser()!.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  try {
    const mobile = await context.newPage();
    await mobile.goto('/components/upload/');
    const x = mobile.locator('.icen-upload-list-item-x').first();
    await expect(x).toHaveCSS('opacity', '1'); // 触屏常显
    expect(await x.evaluate(el => getComputedStyle(el, '::after').inset)).toBe('-10px');
    expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
