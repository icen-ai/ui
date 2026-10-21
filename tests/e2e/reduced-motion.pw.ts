import { test, expect } from '@playwright/test';

// reduced-motion 降级链（docs/spec/motion-typography.md §2）。
// 断言口径说明（实测验证）：
// - Playwright 的 reducedMotion 仿真会把所有 transition-duration 钳制为 0.01ms（浏览器级，与 CSS 无关），
//   因此仿真路径只断言令牌开关（--icen-design-motion / calc 文本）；
// - 手动 data-icen-motion 路径不受仿真钳制，可断言真实 0s / 0.11s。
test('reduced-motion cascade: system reduce zeroes the token, full override restores, manual reduce gives real zero without OS setting', async ({ page }) => {
  await page.goto('/components/btn/');
  const motionFlag = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--icen-design-motion').trim());
  const durationCalc = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--icen-duration-fast').trim());
  const probeDuration = () => page.evaluate(() => {
    const el = document.createElement('div');
    el.style.transitionDuration = 'var(--icen-duration-fast)';
    document.body.appendChild(el);
    const v = getComputedStyle(el).transitionDuration;
    el.remove();
    return v;
  });

  // 默认：乘数 1，探针实测 110ms
  await expect.poll(motionFlag).toBe('1');
  await expect.poll(durationCalc).toBe('calc(.11s * 1)');
  await expect.poll(probeDuration).toBe('0.11s');

  // 系统 reduce（仿真）：令牌归零
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(motionFlag).toBe('0');
  await expect.poll(durationCalc).toBe('calc(.11s * 0)');

  // full 手动覆盖：系统 reduce 下令牌恢复
  await page.evaluate(() => document.documentElement.setAttribute('data-icen-motion', 'full'));
  await expect.poll(motionFlag).toBe('1');
  await expect.poll(durationCalc).toBe('calc(.11s * 1)');

  // 手动 reduce：无需系统设置即降级，且探针实测真实 0s（无仿真钳制）
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.documentElement.setAttribute('data-icen-motion', 'reduce'));
  await expect.poll(motionFlag).toBe('0');
  await expect.poll(probeDuration).toBe('0s');

  // 清除覆盖回到系统口径
  await page.evaluate(() => document.documentElement.removeAttribute('data-icen-motion'));
  await expect.poll(motionFlag).toBe('1');
  await expect.poll(probeDuration).toBe('0.11s');
});
