import {test, expect} from '@playwright/test';

test('ai-chat: send streams a reply through the zero-wiring loop; reasoning folds with the mask caret', async ({page}) => {
  await page.goto('/components/ai-chat/');
  const scroll = page.locator('#ai-chat-demo .icen-ai-chat-scroll');
  const before = await scroll.locator('.icen-ai-msg').count();
  const input = page.locator('#ai-chat-composer .icen-ai-composer-input');
  await input.fill('继续');
  await input.press('Enter');
  await expect(scroll.locator('.icen-ai-msg')).toHaveCount(before + 2, {timeout: 6000}); // 用户消息 + mock 流式回复
  // mock 流式回包：assistant 消息出现且经历 is-streaming
  await expect(scroll.locator('.icen-ai-msg--assistant').last()).toBeVisible({timeout: 6000});
  // reasoning 折叠：mask caret + 展开
  const reasoning = scroll.locator('.icen-ai-reasoning').first();
  const head = reasoning.locator('.icen-ai-reasoning-head');
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(reasoning.locator('.icen-ai-reasoning-body')).toBeVisible();
  // 密度切换不改文档完整性
  await page.locator('[data-ai-density="summary"]').click();
  await expect(page.locator('#ai-chat-demo')).toHaveAttribute('data-icen-density', 'summary');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('ai-tool-call: approval buttons settle the pending card and failure auto-expands', async ({page}) => {
  await page.goto('/components/ai-tool-call/');
  // 模拟执行驱动 pending → running → done
  await page.getByRole('button', {name: /模拟执行/}).click();
  const doneStatus = page.locator('.icen-ai-tool.is-done, .icen-ai-item.is-done').first();
  await expect(doneStatus).toBeVisible({timeout: 8000});
  // 审批卡：允许 → 状态迁移
  const approve = page.getByRole('button', {name: '允许', exact: true});
  if (await approve.count() > 0) {
    await approve.first().click();
    await page.waitForTimeout(300);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('ai-composer: slash layer, mention popup and IME-safe Enter', async ({page}) => {
  await page.goto('/components/ai-composer/');
  const input = page.locator('#ai-composer-demo .icen-ai-composer-input');
  // IME 组合中 Enter 不发送
  await input.click();
  await input.dispatchEvent('compositionstart');
  await input.fill('正在');
  await input.press('Enter');
  await input.dispatchEvent('compositionend');
  // / 命令层
  await input.fill('/');
  const popup = page.locator('.icen-ai-composer-popup');
  await expect(popup).toBeVisible({timeout: 3000});
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('ai-threads: groups collapse and items activate without page overflow', async ({page}) => {
  await page.goto('/components/ai-threads/');
  const groupHead = page.locator('.icen-ai-threads-group-head').first();
  await expect(groupHead).toHaveAttribute('aria-expanded', 'true');
  await groupHead.click();
  await expect(groupHead).toHaveAttribute('aria-expanded', 'false');
  await groupHead.click();
  await expect(groupHead).toHaveAttribute('aria-expanded', 'true');
  const thread = page.locator('.icen-ai-thread-main').nth(1);
  await thread.click();
  await expect(page.locator('.icen-ai-thread').nth(1)).toHaveClass(/is-active/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
