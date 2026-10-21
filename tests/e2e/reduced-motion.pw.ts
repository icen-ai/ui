import { test, expect } from '@playwright/test';

// reduced-motion 降级链（docs/spec/motion-typography.md §2）：
// 系统 reduce → 时长令牌归零；data-icen-motion="full" 恢复；手动 reduce 无需系统设置。
test('reduced-motion cascade: system reduce zeroes durations, full override restores, manual reduce works without OS setting', async ({ page }) => {
  await page.goto('/components/btn/');
  const durationFast = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--icen-duration-fast').trim());
  const easeStandard = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--icen-motion-ease-standard').trim());

  // 默认（系统无偏好）：时长为令牌基值
  await expect.poll(durationFast).toBe('110ms');
  await expect.poll(easeStandard).toBe('cubic-bezier(0.45, 0, 0.25, 1)');

  // 系统 reduce：时长归零（降级而非移除——状态变化仍瞬时完成）
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(durationFast).toBe('0ms');

  // full 手动覆盖：系统 reduce 下显式恢复
  await page.evaluate(() => document.documentElement.setAttribute('data-icen-motion', 'full'));
  await expect.poll(durationFast).toBe('110ms');

  // 手动 reduce：无需系统设置即降级（先清掉系统 reduce 再验证）
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.documentElement.setAttribute('data-icen-motion', 'reduce'));
  await expect.poll(durationFast).toBe('0ms');

  // 清除覆盖回到系统口径
  await page.evaluate(() => document.documentElement.removeAttribute('data-icen-motion'));
  await expect.poll(durationFast).toBe('110ms');
});
