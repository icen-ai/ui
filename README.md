# @icen.ai/ui

icen.ai 的设计系统。组件、图表和 AI 界面，共用一套设计令牌——换肤不用改代码，UI 也能直接交给模型调用。无框架，零运行时依赖，MIT。

- 文档与实时演示：<https://ui.icen.ai>
- 安装：`bun add @icen.ai/ui`

## 快速开始

```css
@import '@icen.ai/ui/tokens.css';   /* 设计令牌：预设 + 明暗 + 原语 */
@import '@icen.ai/ui/ui.css';       /* 全部组件；也可只引 ./components/btn.css */
```

```html
<html data-icen-preset="piano" data-icen-theme="dark">
```

```ts
import { initTheme, initTabs, toast, renderLine } from '@icen.ai/ui';

initTheme();                        // 尽早调用，跟随系统偏好
initTabs();                         // [data-icen-tabs] 契约自动生效
toast.success('已保存');
renderLine(el, { labels, series }); // 函数式组件：无 init，直接渲染
```

每个组件一页文档，页面里就是可点的真实组件：<https://ui.icen.ai/components/>

## 里面有什么

**稳定性分层。** Core（52 个基础模块：表单 / 浮层 / 导航 / 数据展示 / 反馈 / 主题 / i18n）走 1.0 冻结轨道；图表 / AI / 知识库三族标 **Beta**，随 minor 快速演进。分层事实源 [`docs/contracts/tiers.json`](docs/contracts/tiers.json)，构建期盖章进 `registry.json`，守卫强制每个模块显式归类，文档站组件页徽标同源。0.x 收敛期没有外部用户：破坏性变更不留兼容层、不写迁移指南（见 [docs/versioning.md](docs/versioning.md)）；迁移设计从 1.0 起才成为义务。

**组件。** 129 个无框架组件——表单、浮层、导航、数据展示、反馈。纯 CSS 契约加按需行为 JS：类名统一 `.icen-*`，钩子统一 `data-icen-*`，变量统一 `--icen-*`，产物全部进 cascade layers，与任何第三方 CSS 共存零冲突。

**图表。** 一份 JSON，十三种图。悬停、点击、右键、图例开关全部内建，不依赖任何图表库。缩放、降采样、标记线、流式追加、PNG 导出都写在规格里。

**AI 界面。** 做 AI 产品要用的零件都在：对话、推理、工具调用、审批、任务清单、用量与审计。兼容 OpenAI / Anthropic / MCP / AI SDK 四家协议，token 和成本自动记账。一行 `bindComposer` 接通输入台、流式渲染与上下文环；UI 能力可以注册成模型直接调用的工具。

**知识库。** 32 个组件覆盖 RAG 全链路：摄取、检索、问数、治理、权限。引用可溯源，过程可观测，答案可验证；权限域对授权侧诚实、对受限侧沉默。

**主题。** 六套预设，明暗双模，现代、中式、苏式与像素四种原语，全部挂在 `<html>` 的 data 属性上。配色与原语独立：中式推荐「东韵」，苏式推荐「巨构」，也可自由组合其它主题。自建品牌只需在自家 CSS 写一块 token 面，组件代码一行不动。

**React / Vue。** 官方薄封装 `@icen.ai/ui/react`、`@icen.ai/ui/vue`：只做生命周期接线和事件桥，底下是同一个命令式内核。详见 <https://ui.icen.ai/frameworks/>

还内建：RTL 全面支持（逻辑属性 + 方向图标自动镜像，`<html dir="rtl">` 即生效）、i18n 文案注册表（683 个 key，中英双语，`setIcenLocale` 一句切换）、统一事件体系（`onIcen` 一个入口：类型化、选择器委托、策略层）、表单校验（原生约束即 schema，零新词汇）。

## 工程信任

生产环境依赖一个 0.x 库之前该问的问题，直接给证据：

- **800+ 个测试 + 10 项纪律守卫**挂在每个 PR 的 CI 上，本地 `bun run verify` 同口径。
- **[SECURITY.md](https://github.com/icen-ai/ui/blob/main/SECURITY.md)**：支持版本矩阵与漏洞响应承诺；textContent-only 渲染、权限域 fail-closed、OIDC provenance 发布链，逐条可验证。
- **[CONTRIBUTING.md](https://github.com/icen-ai/ui/blob/main/CONTRIBUTING.md)**：加组件的完整仪式与守卫速查表。
- **[docs/versioning.md](https://github.com/icen-ai/ui/blob/main/docs/versioning.md)**：0.x 破坏性变更纪律——只在 minor 发生，CHANGELOG 逐条写明契约变化。
- **发布链**：`git tag v<x.y.z>` → GitHub Actions 经 OIDC trusted publishing 发 npm，无长期 token，每次发布带 provenance 可审计。

## 文档站

`site/` 是公开文档站：首页、色彩色板、129 个组件页、[知识库工作台](https://ui.icen.ai/kb/)（全真接线的成品页，导航栏实时换肤换明暗）。push 到 `main` 即由 Cloudflare Pages 自动构建（根目录 `site`，命令 `bun install && bun run build`，输出 `dist`），无需手动部署。

## 构建

```bash
bun install
bun run build    # tsup + CSS 拼合 + 设计 token 导出 → dist/
bun run verify   # tsc + 守卫 + 800+ 测试 + 构建，四道门
```

产物：`dist/tokens.css`、`dist/ui.css`、`dist/base.css`、`dist/components/*`、`dist/behaviors/*.mjs` + `.d.mts`、`dist/registry.json`、`dist/index.mjs`。

## 设计 token 导出

构建链末尾自动导出设计工具格式（`scripts/dtcg.mjs` + `scripts/design-tokens.mjs`）；设计侧改 token 可走插件回灌，闭环到 `src/tokens/`：

- `dist/tokens/dtcg.json`：W3C DTCG 经典版，每个预设的明暗两态各一份有效级联结果；`var()` 引用转为规范别名，文件内自洽、无环。
- `dist/tokens/tokens-studio.json`：Tokens Studio 的 `$themes` 覆盖全部预设的明暗矩阵，导入后按 theme 切换即对齐 CSS。
- `dist/tokens/figma.variables.json`：Figma Variables，每预设一个 collection，light / dark 双 mode；rem 按 ×16 记 px。
- **诚实口径**：color-mix、box-shadow 等规范无法表示的值一律跳过并打印清单，不猜、不静默。

## 目录

```
src/tokens/       # 设计令牌：色彩、原语、字体（单一事实源 themes.json，改动后 bun run colors）
src/base.css      # 元素基线 + 6 个交互基元 + a11y 工具类
src/components/   # 74 个组件 CSS
src/behaviors/    # 86 个行为模块（全部 SSR 守卫 + 幂等 init + 返回销毁函数）
docs/spec/        # 族规格（知识库族、设计原语…）
site/             # 文档站（独立 Astro 应用）
scripts/          # 构建与导出脚本
```

## 消费方接入

- **包引入（推荐）**：`bun add @icen.ai/ui`，按 `./tokens.css` / `./ui.css` / `./kit/<slug>` 引入。
- **vendor 复制**：锁定版本或离线构建场景，把 `dist/` 复制进自家仓库（accounts 走这条路，`bun run sync:ui`）。
- **给 AI 代理**：包内 `AGENTS.md` + `dist/**/*.d.mts`；站点 <https://ui.icen.ai/llms.txt>（索引）与 `/llms-full.txt`（全文 + 类型面）；场景配方 skill `icen-ui`（skill.icen.ai）。

## 现代原语

默认原语「现代」：瓷白内容面、轻盈磨砂操作层、系统排版、统一的几何节奏。想调成自己的品牌，改 `--icen-design-*` 种子即可，`createDesign` 会编译出带明暗与对比度验证的完整配方——本地文档站 `/modern/` 有实时工作台。规范与接入见 [设计原语](docs/spec/design-primitives.md)。
