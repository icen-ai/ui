// 视觉回归：对文档站静态产物全页截图，与提交在 __screenshots__/ 的基线比对。
// 基线更新：bunx playwright test --update-snapshots（改动视觉的 PR 必须随 PR 更新基线）。
// 注意：基线对 OS/字体敏感（本仓库基线在 Windows 生成，详见 docs/testing.md）。
import { test, expect, type Browser } from '@playwright/test';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'icen-btn', path: '/components/btn/' },
  { name: 'icen-datatable', path: '/components/datatable/' },
  { name: 'form-validate', path: '/components/form-validate/' },
  { name: 'charts', path: '/components/charts/' },
  { name: 'icen-modal', path: '/components/modal/' },
  { name: 'kb', path: '/kb/' },
  { name: 'frameworks', path: '/frameworks/' },
  { name: 'apps', path: '/apps/' },
];

// 主题变体只打两张：首页 + 组件页代表（btn 覆盖密度/语义色最全的按钮矩阵）
const THEME_VARIANT_PAGES = [
  { name: 'home', path: '/' },
  { name: 'icen-btn', path: '/components/btn/' },
  { name: 'apps', path: '/apps/' },
];

async function shoot(browser: Browser, name: string, path: string, init?: (() => void) | string) {
  const context = await browser.newContext({locale:'zh-CN'});
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(path, { waitUntil: 'networkidle' });
  await settle(page, path);
  // 等字体全部落地再截，避免 Plex Mono/宋体异步加载造成首跑抖动
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled', // 交互动画（图表入场/modal 过渡/墨条滑移）定格，防抖动
  });
  await context.close();
}

// /kb/ 工作台首屏有定时模拟流（600ms 自动问答 + 分阶段 sleep）——等其落定再截/扫，防时序抖动
async function settle(page: import('@playwright/test').Page, path: string) {
  if (!path.startsWith('/kb')) return;
  await page.locator('.icen-kb-chain-label').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(3000);
}

// 贡献日历随真实日期每天位移——图表页冻结时钟到基线日，视觉基线才可重复
const FREEZE_DATE = `(() => { const RealDate = Date; const fixed = new RealDate('2026-10-17T12:00:00');
  class FrozenDate extends RealDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed.getTime(); } }
  Object.defineProperty(window, 'Date', { value: FrozenDate }); })();`;

for (const p of PAGES) {
  test(`light: ${p.path}`, async ({ browser }) => {
    await shoot(browser, p.name, p.path, p.name === 'charts' ? FREEZE_DATE : undefined);
  });
}

test('touch: /apps/', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto('/apps/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('apps-touch.png', { fullPage: true, animations: 'disabled' });
  } finally { await context.close(); }
});

for (const dark of [false, true]) {
  test(`modal open: ${dark ? 'dark' : 'light'}`, async ({ browser }) => {
    const context = await browser.newContext({ locale: 'zh-CN' });
    try {
      await context.addInitScript(dark => localStorage.setItem('icen.ui.theme', JSON.stringify({ preset: 'modern', style: 'modern', dark })), dark);
      const page = await context.newPage();
      await page.goto('/components/modal/', { waitUntil: 'networkidle' });
      await page.locator('[data-icen-modal-open="demo-modal-md"]').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`modal-open-${dark ? 'dark' : 'light'}.png`, { animations: 'disabled' });
    } finally { await context.close(); }
  });
}

test('touch code paper: pixel RTL dark', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(() => {
      localStorage.setItem('icen.ui.theme', JSON.stringify({ preset: 'modern', style: 'pixel', dark: true }));
      document.addEventListener('DOMContentLoaded', () => { document.documentElement.dir = 'rtl'; });
    });
    const page = await context.newPage(); await page.goto('/components/code-block/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.demo-stage .icen-code-block').first()).toHaveScreenshot('code-paper-touch-pixel-rtl.png', { animations: 'disabled' });
  } finally { await context.close(); }
});

for (const p of THEME_VARIANT_PAGES) {
  test(`dark: ${p.path}`, async ({ browser }) => {
    await shoot(browser, `${p.name}-dark`, p.path, () => {
      // 契约同 src/behaviors/theme.ts + site ThemeRestore：首帧渲染前写入，防闪烁
      localStorage.setItem('icen.ui.theme', '{"preset":"dongyun","dark":true,"style":"modern"}');
    });
  });

  test(`rtl: ${p.path}`, async ({ browser }) => {
    await shoot(browser, `${p.name}-rtl`, p.path, () => {
      // init script 触发时 documentElement 尚不存在（实测为 null）——轮询到 <html> 出现再设，
      // 仍在首帧绘制前生效，避免 LTR 闪烁；全库 CSS 逻辑属性已就绪：dir=rtl 即整体镜像
      const apply = (): void => {
        if (document.documentElement) document.documentElement.dir = 'rtl';
        else setTimeout(apply, 0);
      };
      apply();
    });
  });
}
