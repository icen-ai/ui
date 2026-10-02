# @icen.ai/ui — Icen Design System

icen.ai 全生态的统一设计系统：**设计 tokens（6 色彩预设 × 明暗双模 × 3 风格 profile）+ 无框架组件 CSS（55 组件）+ 行为 JS（31 behaviors）**。工程形态与 `@icen.ai/cli` 一致（Bun + TS + tsup + ESM + MIT）。

- 色彩预设：`clay`（默认，陶土橙 × 纸白 = icen 品牌）/ `piano` / `art` / `vangogh` / `ink` / `retro`，各含 `.dark` 变体
- 风格配置：`.style-modern` / `.style-retro` / `.style-terminal`（几何 / 密度 / 动效 / 字体 token，与色彩正交）
- 可选效果层：`retro-effects.css`（CRT 扫描线 / 颗粒 / 像素边框 / 打字机光标 —— 仅 `.style-retro` 激活时生效，按需 import）
- 组件：btn / form / input / select / slider / switch / tag-input / upload / modal / popover / tooltip / menu（含 dropdown + context-menu）/ tabs / nav / sidebar / breadcrumb / pagination / steps / segmented / accordion / tree / carousel / charts / table / stat / card / panel / pill / tag / badge / empty / feedback / content / media / toolbar / split-pane / date-picker / command-palette / notification / copy / scroll-area / back-top / datatable / layout（56 个组件 CSS，含 charts 基座 + 10 个细分图表）
- 图表通用层（v0.8）：`renderChart(el, spec)` 统一入口——纯 JSON 规格（type 缺省自动推断；data[] + dims 任意维度透视）、多系列折线/分组堆叠柱、内置 tooltip、`icen:chart-hover/click/dblclick/contextmenu` 交互事件族、图例点击切换系列；新增贡献日历 renderCalendar（GitHub 同款）与散点气泡 renderScatter
- AI 原生组件族（v0.7，11 个 slug）：ai-chat（会话容器）/ ai-message（消息行）/ ai-reasoning（推理块）/ ai-composer（输入台）/ ai-tool-call（工具调用卡）/ ai-subagent（子智能体卡）/ ai-diff（差异审阅）/ ai-files（文件标签）/ ai-todo（任务清单）/ ai-context（上下文抽屉）/ ai-usage（用量条）——共享 7 态状态机与 kind 注册表，事件统一 `icen:ai-*` 前缀
- 标准化内容模型 `AiContent`（v0.7.1，对标 AI SDK v5 parts / MCP / OpenAI / Anthropic，2026-10 调研）：一套 `AiContentPart[]`（text / image / audio / video / file / resource-link）表达任意输入——消息渲染（renderAiMessage 多模态 + 错误变体）、工具回执（MCP content 数组零改动进卡片）、传输层（parts → 两族 wire，含 anthropic `cache_control` 与 tool_result 回灌）全部只认这一套；`normalizeContentParts` 一函数归一四族来源，`estimateTokens` / `contextEstimate` 提供粗估与上下文口径
- ai-provider 适配层（v0.7.1 增强）：五家厂商注册表（含定价表，`estimateCost` 未命中不猜价）、chat + stream 双族线协议多模态传输、审计闭环（`createAiAuditor` 条目含 cost 定价估算与 ttftMs 首 token 延迟，`renderAiAudit` 面板 + `ai-context` 抽屉审计节）、请求收尾派 `icen:ai-done`（status/usage/cost/error/durationMs/ttftMs）
- 绑定层 `bindComposer`（v0.7.1，「零接线全链路」）：一行把 composer ↔ 消息区（renderAiMessage）↔ client（stream + 停止 + 排队续发 + 错误路径）↔ 上下文环（`usage.from: 'context'` 正确口径 / `'billing'` 计费口径 / auditor）接成闭环；不传 client 为纯状态绑定（渐进采用）；附件三入口（钮选 / 粘贴 / 拖放）
- 行为：theme / tabs / toast / copy / input / select / slider / tag-input / upload / modal / dropdown / popover / context-menu / accordion / tree / carousel / charts / nav / sidebar / datatable / notification / back-top / command-palette / date-picker / split-pane / ai-core / ai-chat / ai-composer / ai-tool / ai-diff / ai-panel（31 个，全部 SSR 守卫 + 幂等 init + textContent-only）

## 使用

```bash
bun add @icen.ai/ui
```

```css
@import '@icen.ai/ui/tokens.css';
@import '@icen.ai/ui/ui.css';   /* tokens + base + 全部组件；也可按 ./components/btn.css 单引 */
/* 可选：仅 .style-retro 下生效的像素效果层 */
@import '@icen.ai/ui/retro-effects.css';
```

```html
<html class="piano dark">       <!-- 预设类 + 可选 dark；clay 为 :root 默认 -->
```

```ts
import {
  initTheme, toggleDark, setTheme,
  initTabs, initCopy, initInput, initSelect, initSlider, initTagInput,
  initUpload, initModal, initDropdown, initContextMenu,
  initAccordion, initTree, initCarousel, initNav, initSidebar,
  openPopover, closePopover,
  renderLine, renderVBar,
  toast,
} from '@icen.ai/ui';

initTheme();                       // 尽早调用（或内联同步脚本防闪烁，见 accounts Base.astro）
initTabs();                        // [data-tabs] > [data-tab] + [data-tab-panel] 契约；切换派发 icen:tab-change
initCopy();                        // .copy-btn[data-copy] 委托
toast.ok('已保存');                // 或 toast.action('已删除', '撤销', undo)；类名 .toast--success 等
renderLine(el, { labels, series }); // 函数式组件（charts / datatable）：无 init，直接渲染
```

AI 全链路（零接线）：

```ts
import { initAiChat } from '@icen.ai/ui/kit/ai-chat';
import { initAiComposer, bindComposer } from '@icen.ai/ui/kit/ai-composer';
import { createAiClient, createAiAuditor } from '@icen.ai/ui';

initAiChat();
initAiComposer();
const auditor = createAiAuditor({ persist: 'my-audit' });
const client = createAiClient({ provider: 'kimi', apiKey, auditor });

// 一行接通：发送 → 消息渲染 → 流式追加 → 停止/排队续发/错误路径 → 上下文环（正确口径）
const binding = bindComposer(composer, {
  client,
  messages: chatEl.querySelector('.ai-chat-scroll'),
  usage: { from: 'context' },   // 或 'billing' / auditor
});
```

## 文档站（已上线 <https://ui.icen.ai>）

`site/` 是公开文档站（首页 / 色彩预设色板 / 组件演示，导航栏实时换肤换明暗）。部署：

```bash
cd site && bun install && bun run build
bunx wrangler pages deploy dist --project-name=icen-ui   # 需 CLOUDFLARE_ACCOUNT_ID
```

Pages 项目 `icen-ui`（aidoll 账号），自定义域 `ui.icen.ai` → CNAME `icen-ui.pages.dev`。**已接 Git 自动部署**：push 到 `main` 即由 Cloudflare 构建（根目录 `site`，命令 `bun install && bun run build`，输出 `dist`），无需 wrangler 手动部署、无需任何 token/secret。

## 构建

```bash
bun install
bun run build   # tsup（behaviors → dist/*.mjs）+ scripts/build-css.ts（css → dist/）
```

产物：`dist/tokens.css`（colors + style-profiles + typography 拼合）、`dist/ui.css`（tokens+base+组件）、`dist/base.css`、`dist/retro-effects.css`（按需）、`dist/tokens/*`、`dist/components/*`、`dist/behaviors/*.mjs`、`dist/index.mjs`、`dist/registry.json`（含 tokens/tokensExtras/base/components/behaviors 清单）。

## 目录

```
src/tokens/colors.css          # 6 预设 × 明暗（clay 基值已校准到 accounts.icen.ai 视觉）
src/tokens/style-profiles.css  # density/motion/typography + .style-modern/.retro/.terminal
                               #   retro 段选择器引用 base.css 的 .pressable/.control/.lift
src/tokens/typography.css      # icen canonical 字体栈（IBM Plex Mono + CJK 宋体）
src/tokens/retro-effects.css   # 可选效果层：CRT/扫描线/像素工具类（不进 tokens.css 拼合）
src/base.css                   # 元素基线 + 滚动条 + z-index 标尺 + 6 个交互基元
                               #   .pressable / .control / .field / .lift / .surface-elevated / .focus-ring
                               #   + a11y 工具类 .sr-only / .skip-link + 工具类 .mono/.dim/.faint/.numeric
src/components/*.css           # 55 个无框架组件 CSS（含 4 个 AI 族合并文件）
src/behaviors/*.ts             # 31 个 behaviors（含 6 个 AI 族）
scripts/build-css.ts           # CSS 产物构建（拼合 + registry.json）
site/                          # 文档站骨架（ui.icen.ai，独立 Astro 应用）
```

## 消费方接入

`@icen.ai/ui` 已发布 npm（OIDC trusted publishing，打 `v*` tag 即自动发版）。两种消费方式均可：

- **包引入（推荐）**：`bun add @icen.ai/ui`，按 `./tokens.css` / `./ui.css` / `./kit/<slug>` 引入。
- **vendor 复制**：accounts 目前走这条路——`bun run sync:ui`（accounts 仓库内）把本仓库 `dist/` 复制到 `src/styles/vendor/icen/`，布局里 import 对应 CSS/JS。适合需要锁定版本或离线构建的场景。
