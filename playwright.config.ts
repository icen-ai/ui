// 浏览器验收舱配置：真实 chromium 里跑视觉回归 + axe 无障碍扫描。
// 被测对象 = 文档站静态产物（site/dist），由 scripts/serve-static.mjs 零依赖伺服。
// 基线目录 = tests/e2e/__screenshots__（提交进 git，改动视觉须随 PR 更新基线）。
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // bun test 会按文件名扫描 *.spec.* / *.test.*（bun 1.3.5 的 bunfig 尚无生效的
  // discovery 排除项，已实测），因此 e2e 用例一律 .pw.ts 后缀 + 这里显式 testMatch，
  // 保证 `bun test` / `bun run verify` 永不触碰 e2e（红线）。
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  // 基线固定进 tests/e2e/__screenshots__（提交 git）；单项目单基线，名字不带平台后缀
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{projectName}/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    // 站点按 navigator.languages 自动切中英（默认中文文档站）——钉死 zh-CN 保证断言确定性，
    // 与浏览器语言环境解耦（CI/本地默认 locale 都是 en-US，不钉会全站变英文导致中文断言全红）
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  expect: {
    // 视觉基线容差：单像素差异比例 ≤ 1%（抗锯齿/字体渲染级噪音可过，布局漂移必拦）
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun scripts/serve-static.mjs site/dist 4173',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
