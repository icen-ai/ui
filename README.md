# @icen.ai/ui

[![npm](https://img.shields.io/npm/v/@icen.ai/ui)](https://www.npmjs.com/package/@icen.ai/ui)
[![CI](https://github.com/icen-ai/ui/actions/workflows/ci.yml/badge.svg)](https://github.com/icen-ai/ui/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

icen.ai 的设计系统：<!-- meta:components -->122<!-- /meta:components --> 个组件入口、<!-- meta:charts.total -->14<!-- /meta:charts.total --> 种图表与 AI 原生组件族共用一套设计令牌——换肤不改代码，UI 可直接交给模型调用。无框架、零运行时依赖（`dependencies` 为空，可验证）、SSR 安全，MIT。

- 文档与实时演示：<https://ui.icen.ai>
- 安装：`bun add @icen.ai/ui`（或 `npm i`）

## 快速开始

```css
/* 全量一行（ui.css 已含 tokens + base + 全部组件） */
@import '@icen.ai/ui/ui.css';

/* 或按需：tokens 底座 + 单引组件 CSS
@import '@icen.ai/ui/tokens.css';
@import '@icen.ai/ui/components/btn.css'; */
```

```html
<html data-icen-preset="piano" data-icen-theme="dark">
<!-- 明暗是二态契约：暗色 = 写 data-icen-theme="dark"；亮色 = 移除该属性（没有 "light" 值） -->
```

```ts
import { initTheme, initTabs, toast, renderLine } from '@icen.ai/ui';

initTheme();                        // 尽早调用，跟随系统偏好
initTabs();                         // [data-icen-tabs] 契约自动生效
toast.success('已保存');
renderLine(el, { labels, series }); // 函数式组件：无 init，直接渲染
```

纯静态页面走 `<link rel="stylesheet" href="./node_modules/@icen.ai/ui/ui.css">`；ES module 直引需经静态服务器（`file://` 直开会被浏览器 CORS 拦截）。更多入坑答案见 [docs/faq.md](docs/faq.md)。

## 里面有什么

- **组件**：无框架组件库（表单 / 浮层 / 导航 / 数据展示 / 反馈），纯 CSS 契约 + 按需行为 JS。类名 `icen-*`、钩子 `data-icen-*`、变量 `--icen-*`，产物全部进 cascade layers，与任何第三方 CSS 共存零冲突。
- **图表**：一份 JSON <!-- meta:charts.total -->14<!-- /meta:charts.total --> 种图，悬停/点击/图例开关内建，不依赖图表库。
- **AI 界面**：对话 / 推理 / 工具调用 / 审批 / 输入台 / 用量审计；兼容 OpenAI / Anthropic / MCP / AI SDK 协议；UI 能力可注册成模型直接调用的工具。
- **知识库**：覆盖 RAG 全链路的组件族（摄取 / 检索 / 问数 / 治理 / 权限），权限域 fail-closed。
- **主题**：色彩预设 × 设计原语 × 明暗，全部挂在 `<html>` data 属性上；自建品牌只需在自家 CSS 写一块 token 面。
- **React / Vue 官方薄封装**：`@icen.ai/ui/react`、`/vue`，只做生命周期接线与事件桥；兼容契约见 [docs/frameworks.md](docs/frameworks.md)。
- **RTL 全面支持**（逻辑属性 + 方向图标自动镜像）、**i18n 文案注册表**（中英双语，`setIcenLocale` 切换）、统一事件体系（`onIcen` 一个入口）。

## 工程信任

生产环境依赖一个 0.x 库之前该问的问题，直接给证据：

- **全部测试与纪律守卫挂在每个 PR 的 CI 上**，本地 `bun run verify` 同口径；覆盖率地板与体积预算以棘轮文件锁在 [docs/contracts/](docs/contracts/)。
- **稳定性分层**：Core 走 1.0 冻结轨道，图表 / AI / KB 标 Beta 随 minor 演进；事实源 `docs/contracts/tiers.json`，组件页徽标同源。
- **公共契约机器快照**：`docs/contracts/snapshot.json` 六个面（类名 / 属性 / 变量 / 事件 / 导出 / 类型签名），`bun run contracts:diff` 做 tag 间对比；破坏性变更只进 minor 且 CHANGELOG 逐条公告（CI 强制联动）。
- [SECURITY.md](SECURITY.md)：支持矩阵与漏洞响应承诺；textContent-only 渲染、权限域 fail-closed、URL 协议守卫，逐条有测试或守卫背书。
- [CONTRIBUTING.md](CONTRIBUTING.md)：加组件的仪式与 PR 规范。
- [docs/versioning.md](docs/versioning.md)：版本与稳定性政策（分层 / 0.x 纪律 / 弃用 / 主题预算 / 1.0 门槛 / 支持周期）。
- [docs/roadmap.md](docs/roadmap.md)：0.11 → 0.13 → 1.0 收敛线与外部验收门槛；[docs/acceptance.md](docs/acceptance.md)：AI/KB 验收矩阵；[docs/dogfood.md](docs/dogfood.md)：陌生人验收记录。
- **发布链**：`git tag v<x.y.z>` → CI 全门 → OIDC trusted publishing 发 npm（provenance，无长期 token）→ 自动建 GitHub Release。

## 消费方接入

- **包引入（推荐）**：`bun add @icen.ai/ui`。CSS 全量一行 `./ui.css`，或按需 `./tokens.css` + `./components/<name>.css`；行为走 `./kit/<slug>` 一行入口。
- **vendor 复制**：锁定版本或离线构建场景，把 `dist/` 复制进自家仓库。
- **给 AI 代理**：包内 `AGENTS.md` + `dist/**/*.d.mts`；站点 <https://ui.icen.ai/llms.txt>（索引）与 `/llms-full.txt`（全文 + 类型面）。

## 构建与验证

```bash
bun install
bun run verify   # tsc + 守卫 + 测试 + 构建 + 体积预算（CI 另跑覆盖率、包面检查与 e2e）
```

产物：`dist/`（ui.css / tokens.css / base.css / components/ / behaviors/ + .d.mts / registry.json / CLI）。
设计 token 另导出 DTCG / Tokens Studio / Figma Variables 三格式（`dist/tokens/`）；规范无法表示的值明示跳过，不猜不静默。

## 目录

```
src/tokens/       # 设计令牌（单一事实源 themes.json，改动后 bun run colors）
src/base.css      # 元素基线 + 交互基元 + a11y 工具类
src/components/   # 组件 CSS（每文件头注释 = DOM 契约）
src/behaviors/    # 行为模块（SSR 守卫 + 幂等 init + 返回销毁函数）
docs/             # 治理文档（versioning / contracts / testing / roadmap…）与 spec
site/             # 文档站（独立 Astro 应用）
scripts/          # 构建、守卫与契约工具
```
