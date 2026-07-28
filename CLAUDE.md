# AGENTS.md — @icen.ai/ui

本文件面向 AI 编程助手，介绍本仓库的结构、构建流程与开发约定。

## 项目概览

`@icen.ai/ui` = Icen Design System 的单一事实源：设计 tokens + 无框架组件 CSS + 行为 JS。生态内所有前端（accounts / skill / editor / 未来 `*.icen.ai`）从这里取设计资产，**不允许在消费项目里另起一套样式**。

三层正交架构（移植自 opengal，见其 `docs/spec/theme-system.md`）：
- **色彩预设**（`src/tokens/colors.css`）：`clay`（默认）/ `piano` / `art` / `vangogh` / `ink` / `retro`，各含 `.dark`；挂在 `<html>` 类上，clay 是 `:root` 默认
- **风格配置**（`src/tokens/style-profiles.css`）：`.style-modern` / `.style-retro` / `.style-terminal`；density / motion / typography / radius 全 token 化，与色彩正交
- **明暗**：`.dark` 类，与预设组合（`class="piano dark"`）

icen canonical：`clay` 亮色 + IBM Plex Mono/CJK 宋体（`src/tokens/typography.css`）。**clay 基值已原地校准为 accounts.icen.ai 线上视觉**（纸白底 #faf9f5、半透明线条、绿 #3d8a5a/黄 #b8860b/红 #c0392b）——改它 = 改全生态的品牌脸，慎重。

## 构建

```bash
bun install
bun run build     # tsup（src/behaviors/*.ts → dist/behaviors/*.mjs + index.mjs）
                  # + bun scripts/build-css.ts（css → dist/：tokens.css/ui.css/base.css/
                  #   retro-effects.css/tokens/*/components/*/registry.json）
```

无测试框架。验证 = `bunx tsc --noEmit` + `bun run build` 通过 + `site/` 文档站目视（`cd site && bun install && bun run build`）。

## 规模

- **41 个组件 CSS**（含 charts 基座 + 9 个细分图表 CSS：chart-line/bar/pie/radar/heatmap/area/stack/gauge/sparkline）
- **20 个 behaviors TS**（theme/tabs/toast/copy/input/select/slider/tag-input/upload/modal/dropdown/popover/context-menu/accordion/tree/carousel/charts[10 种图]/nav/sidebar/datatable）
- **4 个 token 文件**：colors.css（6 预设 × 明暗）、style-profiles.css（modern/retro/terminal）、typography.css、retro-effects.css（可选）

## 发布（OIDC Trusted Publishing，已配好）

- 全自动：改 `package.json` 的 version → commit + push main → `git tag v<x.y.z> && git push origin v<x.y.z>` → `.github/workflows/publish.yml` 自动构建并发 npm（带 provenance，**不要设 NODE_AUTH_TOKEN**）。
- npm 包设置已是「Require 2FA and disallow tokens」：token 一律拒发，只有这条 CI 能发。
- 手动首发/排障流程见 cli 仓库 `docs/publish-npm.md`（EOTP 安全密钥流程、镜像源 registry 坑、422 repository 字段坑）。

## 约定

- **组件只消费 `--token-*`，不写死颜色/圆角/阴影/字体/时长**（radius 用 `--radius-*`、阴影用 `--token-shadow-*`、动效用 `--duration-*`/`--ease-*`、间距用 `--density-*`、字号用 `--density-font-size-*`、控件高度用 `--density-input-height-*`）。
- 语义色纪律：仅绿 `--token-success` / 黄 `--token-warning` / 红 `--token-error` / 信息 `--token-info` + 品牌 `--token-accent`。
- 滚动条纪律：全局细薄无上下箭头（`base.css` 统一负责，组件不再写滚动条样式）；tab 条类组件**永不滚动**（`flex-wrap: wrap`）。
- **交互基元**：`base.css` 提供 6 个组件地基 `.pressable` / `.control` / `.field` / `.lift` / `.surface-elevated` / `.focus-ring`。`style-profiles.css` 的 `.style-retro` 段选择器引用这 6 个类名——改名必须同步修 style-profiles.css，否则 retro 风格失效。
- **z-index 标尺**：浮层一律 portal 到 body，z-index 取 `--z-base/raised/sticky/chrome/toast/banner/dialog/popover/tooltip`。
- **a11y**：所有可聚焦元素必须有 `:focus-visible` 环；状态变化必须同步 `aria-*`；modal/dialog 必须有 focus trap + ESC 关闭 + 焦点还原。
- **动效守卫**：所有动画/过渡在 `@media (prefers-reduced-motion: reduce)` 下压缩为 ~0ms；触屏（`pointer: coarse`）关闭 `:hover` 抬升；高对比度模式（`forced-colors: active`）保留焦点环。
- 新组件 = `src/components/<name>.css` 一个文件 + 文档站 components 页加一节；交互行为放 `src/behaviors/<name>.ts` 并配套 CSS 类契约。每个 CSS 头注释必须列出完整 DOM 契约。
- **图表按需安装**：charts 细分为 9 个独立 kit 入口（chart-line/bar/pie/radar/heatmap/area/stack/gauge/sparkline）+ umbrella `charts`。共享基座 `charts.css`，各类型专属样式 `chart-<type>.css`；渲染函数全在 `behaviors/charts.ts`。子类型 slug→charts 模块映射走 slugs.mjs 的 `SLUG_BEHAVIOR`，`slugs.d.mts` 是其类型声明（两处同步改）。
- 函数式组件族（charts / datatable）：不写类契约，导出 `createX(el, opts) → handle`（charts 是 renderX）；datatable 依赖的额外 CSS（如 menu.css）走 slugs.mjs 的 EXTRA_CSS。
- behaviors 全部 SSR 守卫（`typeof document === 'undefined'`），文本赋值用 `textContent`（禁 innerHTML），init 函数全部幂等（重复调用安全，通过 WeakSet/MarkedElement.__icen*Init 标记）。
- CSS 产物由 `scripts/build-css.ts` 生成，**不要手改 dist/**。`tokensExtras`（如 retro-effects.css）单独拷贝、暴露 exports，**不**进 `tokens.css`/`ui.css` 默认拼合。
- clay 的 12 基值 token 改动属于品牌级变更；新增色彩预设 = 在 colors.css 加 `.<name>` + `.<name>.dark` 两块完整 token 面（仿照现有 6 套），并注册到 `src/behaviors/theme.ts` 的 PRESETS 与文档站。
