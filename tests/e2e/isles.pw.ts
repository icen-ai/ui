import {test, expect} from '@playwright/test';

/* 小岛云巡审：12 格实景 + 悬停标签 + 呼吸 + 聊天不跳 */
test('isles showcase', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 980});
  await page.goto('/');
  await page.waitForTimeout(6500); // 聊天流式跑完一轮（meta 出现）
  const sec = page.locator('.stage-sec');
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // 12 格全在
  await expect(page.locator('.isle')).toHaveCount(12);

  // 悬停标签：内容为 attr(data-icen-label) 且非空（旧版读错属性名只剩空药丸）
  const firstIsle = page.locator('.isle').first();
  await firstIsle.hover();
  await page.waitForTimeout(350); // 标签过渡 ~150ms
  const label = await firstIsle.evaluate((el) => {
    const after = getComputedStyle(el, '::after');
    return { content: after.content, opacity: after.opacity };
  });
  expect(label.opacity).toBe('1');
  expect(label.content).toContain('stat');

  // 聊天格：meta 出现后正文列不得被挤压
  const cols = await page.locator('#mc-chat .icen-ai-msg--assistant').first().evaluate((el) => {
    const body = el.querySelector('.icen-ai-msg-body')!.getBoundingClientRect();
    const avatar = el.querySelector('.icen-ai-msg-avatar')!.getBoundingClientRect();
    return {bodyW: body.width, avatarW: avatar.width, bodyX: body.x, avatarX: avatar.x};
  });
  expect(cols.bodyW).toBeGreaterThan(cols.avatarW * 2);
  expect(cols.bodyX).toBeLessThan(cols.avatarX + 60);

  // 呼吸：任意格动画在跑（no-preference 下）
  const breathing = await page.locator('.isle-card').first().evaluate((el) => getComputedStyle(el).animationName);
  expect(breathing).toBe('isle-breathe');

  await sec.screenshot({path: '.ui-audit/isles-light.png'});
  await page.locator('html').evaluate((el) => { el.dataset.icenTheme = 'dark'; });
  await page.waitForTimeout(400);
  await sec.screenshot({path: '.ui-audit/isles-dark.png'});
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(400);
  await sec.screenshot({path: '.ui-audit/isles-mobile.png', fullPage: false});
});
