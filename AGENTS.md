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
                  #   tokens/*/components/*/registry.json）
```

无测试框架。验证 = `bunx tsc --noEmit` + `bun run build` 通过 + `site/` 文档站目视（`cd site && bun install && bun run build`）。

## 发布（OIDC Trusted Publishing，已配好）

- 全自动：改 `package.json` 的 version → commit + push main → `git tag v<x.y.z> && git push origin v<x.y.z>` → `.github/workflows/publish.yml` 自动构建并发 npm（带 provenance，**不要设 NODE_AUTH_TOKEN**）。
- npm 包设置已是「Require 2FA and disallow tokens」：token 一律拒发，只有这条 CI 能发。
- 手动首发/排障流程见 cli 仓库 `docs/publish-npm.md`（EOTP 安全密钥流程、镜像源 registry 坑、422 repository 字段坑）。

## 约定

- **组件只消费 `--token-*`，不写死颜色/圆角/阴影/字体/时长**（radius 用 `--radius-*`、阴影用 `--token-shadow-*`、动效用 `--duration-*`/`--ease-*`）。
- 语义色纪律：仅绿 `--token-success` / 黄 `--token-warning` / 红 `--token-error` + 品牌 `--token-accent`。
- 滚动条纪律：全局细薄无上下箭头（`base.css` 统一负责，组件不再写滚动条样式）；tab 条类组件**永不滚动**（`flex-wrap: wrap`）。
- 新组件 = `src/components/<name>.css` 一个文件 + 文档站 components 页加一节；交互行为放 `src/behaviors/<name>.ts` 并配套 CSS 类契约。
- 函数式组件族（charts / datatable）：不写类契约，导出 `createX(el, opts) → handle`（charts 是 renderX）；同样一文件 CSS + 文档页一节 + slugs.mjs 登记。datatable 右键菜单复用 context-menu，其依赖的额外 CSS 走 slugs.mjs 的 EXTRA_CSS（kit 入口自动带上）。
- 组件 slug 映射（css 合并文件 / init 函数名）的单一事实源是 `scripts/slugs.mjs`——新组件必须在此登记；`scripts/build-css.ts` 据此生成 kit 一行入口（`dist/components/<slug>.mjs` = import css + re-export behavior，消费侧 `@icen.ai/ui/kit/<slug>`）与 registry.json 的 slugs 面，CLI（`dist/cli.mjs`，`bunx @icen.ai/ui add <slug>` 打印引入行，不拷贝源码）与文档站都消费它。
- **kit 的 Astro 陷阱**：kit 入口里的 css import 在 Astro 页面 `<script>`（client bundle）里会被摇掉——Astro 项目必须在布局 frontmatter 里引组件 CSS（accounts 已踩过）；Vite SPA / webpack 无此问题。文档站安装段已带此提示。
- 文档站（`site/`）：站壳/代码块样式集中在 `site/src/styles/site.css`；可复用展示件在 `site/src/components/`（SiteHeader / SiteFooter / CodeBlock / PmInstall）；轻量语法高亮在 `site/src/lib/highlight.ts`（单行 token 化，`.tok-*` 颜色消费语义 token）。
- 文档站字体体系（site.css 顶部）：prose/站壳 = `--site-font-sans`（系统无衬线），demo 区 = `--site-font-mono`（Plex Mono + CJK 无衬线回退），展示级大标题才用 `--font-heading` 宋体——小字号中文一律不走宋体/通用 monospace 回退。
- behaviors 全部 SSR 守卫（`typeof document === 'undefined'`），文本赋值用 `textContent`（禁 innerHTML）。
- CSS 产物由 `scripts/build-css.ts` 生成，**不要手改 dist/**。
- clay 的 12 基值 token 改动属于品牌级变更；新增色彩预设 = 在 colors.css 加 `.<name>` + `.<name>.dark` 两块完整 token 面（仿照现有 6 套），并注册到 `src/behaviors/theme.ts` 的 PRESETS 与文档站。
