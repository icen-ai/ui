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
];

// 主题变体只打两张：首页 + 组件页代表（btn 覆盖密度/语义色最全的按钮矩阵）
const THEME_VARIANT_PAGES = [
  { name: 'home', path: '/' },
  { name: 'icen-btn', path: '/components/btn/' },
];

async function shoot(browser: Browser, name: string, path: string, init?: () => void) {
  const context = await browser.newContext();
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

for (const p of PAGES) {
  test(`light: ${p.path}`, async ({ browser }) => {
    await shoot(browser, p.name, p.path);
  });
}

for (const p of THEME_VARIANT_PAGES) {
  test(`dark: ${p.path}`, async ({ browser }) => {
    await shoot(browser, `${p.name}-dark`, p.path, () => {
      // 契约同 src/behaviors/theme.ts + site ThemeRestore：首帧渲染前写入，防闪烁
      localStorage.setItem('icen.ui.theme', '{"preset":"clay","dark":true,"style":"modern"}');
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
