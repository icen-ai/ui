import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('segmented radiogroup supports full arrow/Home/End navigation with selection following focus', async ({page}) => {
  await page.goto('/components/segmented/');
  const group = page.locator('.icen-segmented[role="radiogroup"]').first();
  const items = group.locator('.icen-segmented-item');
  await items.nth(1).click();
  await expect(items.nth(1)).toHaveAttribute('aria-checked', 'true');
  await items.nth(1).press('ArrowRight');
  await expect(items.nth(2)).toBeFocused();
  await expect(items.nth(2)).toHaveAttribute('aria-checked', 'true'); // 选中跟随焦点
  await items.nth(2).press('ArrowRight'); // 回卷到首项
  await expect(items.nth(0)).toHaveAttribute('aria-checked', 'true');
  await items.nth(0).press('End');
  await expect(items.nth(2)).toHaveAttribute('aria-checked', 'true');
  await items.nth(2).press('Home');
  await expect(items.nth(0)).toHaveAttribute('aria-checked', 'true');
  // RTL：左键视觉前进
  await page.locator('html').evaluate(el => { el.dir = 'rtl'; });
  await items.nth(0).press('ArrowLeft');
  await expect(items.nth(1)).toHaveAttribute('aria-checked', 'true');
  // axe
  await page.addScriptTag({path: require.resolve('axe-core')});
  const issues = await page.locator('.demo-stage').evaluate(async root => {
    const r = await (window as any).axe.run(root, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa']}});
    return r.violations.filter((v: any) => ['serious','critical'].includes(v.impact)).map((v: any) => v.id);
  });
  expect(issues).toEqual([]);
});

test('stepper buttons use honest minus/plus geometry and clamp at the bounds', async ({page}) => {
  await page.goto('/components/segmented/');
  const stepper = page.locator('.icen-stepper').first();
  const dec = stepper.locator('[data-icen-step="-1"]');
  const inc = stepper.locator('[data-icen-step="1"]');
  await expect(dec.locator('svg')).toHaveAttribute('viewBox', '0 0 20 20');
  await expect(inc.locator('svg')).toHaveAttribute('viewBox', '0 0 20 20');
  const input = stepper.locator('.icen-stepper-input');
  await expect(input).toHaveValue('3');
  await inc.click();
  await expect(input).toHaveValue('4');
  // 触顶 clamp：连点不超过 max=10
  for (let i = 0; i < 12; i++) await inc.click();
  await expect(input).toHaveValue('10');
});
