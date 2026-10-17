import {test, expect} from '@playwright/test';

test('required fields stay neutral at rest and only blame after interaction', async ({page}) => {
  await page.goto('/components/form-validate/');
  const pwd = page.locator('#demo-fv-pwd');
  // 静止态：required+空值不再是红边（:user-invalid 未交互不触发）
  const restBorder = await pwd.evaluate(el => getComputedStyle(el).borderColor);
  const errorColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--icen-token-error').trim());
  expect(restBorder).not.toBe(errorColor);
  // 直接提交 → 错误呈现；改对即时复验
  await page.getByRole('button', {name: '提交', exact: true}).click();
  await expect(page.locator('.icen-field.is-error').first()).toBeVisible();
  await expect(page.locator('.icen-field-error').first()).toBeVisible();
  await expect(pwd).toHaveAttribute('aria-invalid', 'true');
  // 用户名合规后即时复验摘错
  await page.locator('#demo-fv-user').fill('nova');
  await expect(page.locator('#demo-fv-user')).not.toHaveAttribute('aria-invalid', 'true', {timeout: 2000});
});

test('sliders fill their column instead of collapsing to content width', async ({page}) => {
  await page.goto('/components/slider/');
  const track = page.locator('.icen-slider').first();
  const box = (await track.boundingBox())!;
  expect(box.width).toBeGreaterThan(300);
  // 拖动原生 range 仍驱动填充
  const native = page.locator('#demo-slider');
  await native.fill('80');
  await expect(page.locator('#demo-slider-val')).toHaveText('80');
  const fill = await page.locator('.icen-slider-fill').first().evaluate(el => el.style.width);
  expect(fill).toBe('80%');
});
