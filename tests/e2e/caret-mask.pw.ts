import {test, expect} from '@playwright/test';

test('reasoning caret is the shared chevron mask and rotates on toggle, mirrored in RTL', async ({page}) => {
  await page.goto('/components/ai-chat/');
  const head = page.locator('.icen-ai-reasoning-head').first();
  const caret = () => head.evaluate(el => {
    const cs = getComputedStyle(el, '::before');
    return { mask: cs.maskImage, transform: cs.transform };
  });
  let s = await caret();
  expect(s.mask).toContain('svg'); // mask 共享几何，不再是边框三角
  expect(s.transform).toBe('none'); // 收起朝右
  await head.click();
  await page.waitForTimeout(300);
  s = await caret();
  expect(s.transform).toContain('matrix'); // 展开旋转
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  // RTL 镜像
  await page.locator('html').evaluate(el => { el.dir = 'rtl'; });
  s = await caret();
  expect(s.transform).toContain('matrix'); // scaleX(-1) 参与
});

test('tool call done status uses the shared check mask; kb trace caret likewise', async ({page}) => {
  await page.goto('/components/ai-tool-call/');
  const doneMask = await page.locator('.icen-ai-tool.is-done, .icen-ai-item.is-done').first().evaluate(el => {
    const status = el.querySelector('.icen-ai-item-status');
    return status ? getComputedStyle(status, '::after').maskImage : 'no-status';
  });
  expect(doneMask).toContain('svg');
  await page.goto('/components/kb-trace/');
  const caret = page.locator('.icen-kb-span-caret').first();
  if (await caret.count() > 0) {
    const m = await caret.evaluate(el => getComputedStyle(el).maskImage);
    expect(m).toContain('svg');
  }
});
