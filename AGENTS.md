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
- **图表按需安装**：charts 细分为 9 个独立可安装的 kit 入口（`chart-line` / `chart-bar` / `chart-pie` / `chart-radar` / `chart-heatmap` / `chart-area` / `chart-stack` / `chart-gauge` / `chart-sparkline`）+ umbrella `charts`（一条 import 全拿）。共享基座在 `charts.css`（.chart / .chart-legend / .chart-labels / 调色盘），各类型专属样式在独立 `chart-<type>.css`；所有渲染函数仍在 `behaviors/charts.ts` 一个文件（tree-shake 友好）。子类型 slug → charts 行为模块的映射走 slugs.mjs 的 **`SLUG_BEHAVIOR`**（key=子类型 slug，value='charts'），kit 入口按 `SLUG_EXPORTS` 只 re-export 该类型的渲染函数。
- 组件 slug 映射（css 合并文件 / init 函数名 / behavior 模块名）的单一事实源是 `scripts/slugs.mjs`——新组件必须在此登记；`scripts/build-css.ts` 据此生成 kit 一行入口（`dist/components/<slug>.mjs` = import css + re-export behavior，消费侧 `@icen.ai/ui/kit/<slug>`）与 registry.json 的 slugs 面，CLI（`dist/cli.mjs`，`bunx @icen.ai/ui add <slug>` 打印引入行，不拷贝源码）与文档站都消费它。`slugs.mjs` 的类型声明在 `slugs.d.mts`，加导出成员时两处同步改。
- **kit 的 Astro 陷阱**：kit 入口里的 css import 在 Astro 页面 `<script>`（client bundle）里会被摇掉——Astro 项目必须在布局 frontmatter 里引组件 CSS（accounts 已踩过）；Vite SPA / webpack 无此问题。文档站安装段已带此提示。
- 文档站（`site/`）：站壳/代码块样式集中在 `site/src/styles/site.css`；可复用展示件在 `site/src/components/`（SiteHeader / SiteFooter / CodeBlock / PmInstall）；轻量语法高亮在 `site/src/lib/highlight.ts`（单行 token 化，`.tok-*` 颜色消费语义 token）。
- 文档站字体体系（site.css 顶部）：prose/站壳 = `--site-font-sans`（系统无衬线），demo 区 = `--site-font-mono`（Plex Mono + CJK 无衬线回退），展示级大标题才用 `--font-heading` 宋体——小字号中文一律不走宋体/通用 monospace 回退。
- behaviors 全部 SSR 守卫（`typeof document === 'undefined'`），文本赋值用 `textContent`（禁 innerHTML）。
- CSS 产物由 `scripts/build-css.ts` 生成，**不要手改 dist/**。
- clay 的 12 基值 token 改动属于品牌级变更；新增色彩预设 = 在 colors.css 加 `.<name>` + `.<name>.dark` 两块完整 token 面（仿照现有 6 套），并注册到 `src/behaviors/theme.ts` 的 PRESETS 与文档站。
- 文档分组（`site/src/lib/components.ts` 的 `GROUPS`）= 侧栏顺序 = 索引页分组顺序：基础 / 表单 / 浮层 / 数据展示 / 表格 / 图表 / 反馈 / 导航。原「数据」已按职能拆为数据展示 + 表格 + 图表 + 反馈四组。
- **反馈三件正交**：`toast`（瞬时 2.6s 右下角）/ `alert`（内嵌页面流）/ `notification`（持久右上角栈，工程级——进度通知/confirm Promise/多按钮/hover 暂停/倒计时/优先级置顶/已读未读/持久化/多容器 createNotificationCenter）——三者各司其职不互相替代；`copy` 是原地按钮反馈（区别于 toast 的全局通知）。
- **徽章三件正交**：`pill`（行内状态徽章，语义色）/ `tag`（中性展示标签，可选关闭按钮与选中态）/ `badge`（角标式数字/圆点，挂外层元素角上，外层需 `position: relative`）。
- **浮层 portal 模式**：command-palette / date-picker 的面板 portal 到 body，定位由 behavior 计算 trigger rect；与 popover 共用模式。
- **组件 v2 增强（0.5.0 全量升级）**：所有基础组件已达到工程级深度——
  - **select**：`data-select-search` 可搜索过滤（支持 `data-keywords` 辅助关键字 + 分组自动隐藏）、`data-select-multiple` 多选（chips 显示 + `data-select-max` 上限 + `.select-clear` 清除钮）、`.select-group` / `.select-group-label` 分组、`.select-empty` 无结果态。
  - **input**：`maxlength`/`data-count` 字符计数器（接近上限转 warn、到顶转 error）、`data-mask="###-####-####"` 输入掩码（`#` 数字 / `A` 字母 / `*` 任意，原始值存 `data-raw-value`）、`data-trim` blur 去空白、全局 IME 组合态安全（compositionstart/end 挂起处理）。
  - **upload**：`data-upload-list` 开启文件列表（图片自动缩略图、大小格式化、单文件 × 移除）、`data-max-size` / `data-max-files` 校验、accept 类型校验、事件 `icen:upload` / `icen:upload-error` / `icen:upload-remove`。
  - **table**（静态表）：`--zebra` 斑马纹、`caption` 标题、`--sticky-col` + `.col-fixed` 首列粘滞、`.row-expand` 展开行、行状态色（`row-success` / `row-warning` / `row-error`）、列宽工具类（`.col-narrow` / `.col-wide` / `.col-action`）。
  - **stat**：横向布局（`--horizontal`）、迷你 sparkline 槽（`.stat-spark`）、SVG 进度环（`.stat-ring`）、加载骨架态（`.is-loading`）、图标语义色变体（`.icon--ok/warn/bad/info`）。
  - **empty**：类型预设（`--error` / `--404` / `--search` / `--maintenance` / `--network`）、`--illustrated` 渐变背景、`--inline` 内嵌模式。
  - **panel**：可折叠（`--collapsible` + `.is-collapsed`）、副标题（`.panel-subtitle`）、平面变体（`--flat`）、强调变体（`--accent`）。
  - **slider**：带标签刻度（`.slider-marks` + `.slider-mark`）、拖拽值提示气泡（`.slider-tooltip`）、渐变填充（`--gradient`）。
  - **card**：封面比例变体（`.card-media--square/tall/wide`）、卡片网格（`.card-group`）、卡片列表（`.card-list`）、状态色边（`--success/warning/error`）、角标位（`.card-badge`）。
  - **feedback**：环形进度（`.progress-ring`）、条纹/渐变进度条（`--striped` / `--gradient`）、点阵/条形 spinner（`--dots` / `--bars`）、全屏遮罩（`.spinner-overlay`）、骨架组合体（`.skeleton-text-group` / `.skeleton-media` / `.skeleton-table`）、shimmer 波纹（`--shimmer`）、alert 增强（`.alert-actions` / `--banner` / `--inline`）。
  - **switch**：色彩变体（`--success/warning/danger`）、带文字开关（`--text`）、开关行（`.switch-row`）、单选卡片（`.radio-card` + `.radio-card-grid`）、复选网格（`.checkbox-grid`）。
  - **tabs**：可关闭 tab（`.page-tab-close`）、徽标（`.page-tab-badge`）、图标（`.page-tab-icon`）、分段式（`--segment`）、垂直（`--vertical`）、尺寸（`--sm/lg`）。
  - **nav**：搜索槽（`.nav-search`）、通知徽标（`.nav-btn-badge`）、链接式（`.nav-link`）、用户区（`.nav-user`）。
  - **sidebar**：头部/底部槽（`.sidebar-header` / `.sidebar-footer`）、折叠/轨道模式（`--collapsed`）、激活指示条、分隔线、徽章变体色。
  - **content**：列表增强（`.list-item-leading/meta/trailing` + 选中/斑马）、时间线变体（右侧/交替/自定义尺寸/扩展内容槽）、描述列表变体（行内/垂直/可复制）、树增强（连接线 `.tree--lined` + 拖拽态 + 搜索高亮）、代码块（`.code-block`）、kbd 大号/按下态。
  - **media**：头像变体（语义色/渐变/方形/通知环）、头像组溢出计数、评分只读/清除/计数/摘要、轮播缩略图/索引/渐入。
  - **toast**：语义图标、关闭钮、富内容（标题+正文）、超时进度条、6 种容器定位。
  - **pill**：可关闭（`.pill-close`）、图标、实时脉冲（`--live`）、纯数字（`--count`）、渐变（`--gradient`）。
  - **form**：水平字段布局（`--horizontal`）、表单区块（`.form-section`）、操作区（`.form-actions`）、行内表单（`--inline`）、字段网格（`.form-grid`）、加载遮罩（`.form-loading`）、label 帮助图标 / 可选标记。
