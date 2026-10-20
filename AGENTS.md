# AGENTS.md — @icen.ai/ui

面向 AI 编程助手。**第一段 = 消费方速查**（随 npm 发布，在用户项目里用本包先读这段）；**第二段 = 本仓库开发约定**。
完整类型签名看包内 `dist/**/*.d.mts`；交互式文档 <https://ui.icen.ai>；喂模型全文 <https://ui.icen.ai/llms-full.txt>；设计规格 `docs/spec/`（随包发布）。

---

# 第一段 · 消费方速查

## 形态约束（先读，避免生成跑不通的代码）

- 零依赖纯 ESM；组件 = CSS + 行为 JS，**不绑定框架**（React/Vue 在 effect/mounted 里调行为函数，或直接用官方薄封装 `@icen.ai/ui/react`、`/vue`）。
- CSS 两种引法二选一：**全量** `@import '@icen.ai/ui/ui.css';`（含 tokens + base + 全部组件，自洽单文件）；**按需** `@import '@icen.ai/ui/tokens.css';` 底座 + `@import '@icen.ai/ui/components/<name>.css';`。
- **Astro 陷阱**：kit 入口的 css import 在页面 `<script>` 里会被摇掉——Astro 项目必须在布局 frontmatter 引组件 CSS；Vite/webpack 无此问题。
- 行为函数全部**幂等**、**SSR 安全**、返回**销毁函数**；渲染只写 `textContent`。
- **明暗二态契约**：暗色 = `<html data-icen-theme="dark">`；亮色 = **移除该属性**（没有 `"light"` 值）。密度 = `data-icen-density`。

## 命名空间契约（与任何第三方 CSS 共存零冲突）

- 类名一律 `icen-` 前缀；状态类 `.is-*` 永不单独出现，永远与根类复合（`.icen-tab.is-active`）。
- 主题层是 data 属性不是类：`data-icen-preset`（配色）/ `data-icen-style`（原语）/ `data-icen-theme`（明暗）/ `data-icen-density`。
- data 钩子一律 `data-icen-*`；全局 CSS 变量一律 `--icen-*`；组件作用域变量（`--btn-*` 等）不前缀——根类已隔离继承链。
- 全部产物包在 `@layer icen.tokens / icen.base / icen.components`——消费方无层样式永远赢库样式，放心覆盖。

## 安装颗粒度

```bash
bun add @icen.ai/ui               # 或 npm i
bunx @icen.ai/ui list             # 全部 slug
bunx @icen.ai/ui add btn toast    # 打印正确的一行引入
```

- **kit 一行入口**（CSS + behavior 一起）：`import '@icen.ai/ui/kit/btn';`
- **只取行为**：`import { renderChart } from '@icen.ai/ui/behaviors/charts';`
- slug 与分层机器可读：`@icen.ai/ui/registry.json`。

## 主题与原语

配色预设与原语两轴独立，全部挂在 `<html>` data 属性上；默认 = 现代配色 + 现代原语。自建品牌 = 在自家 CSS 写一块 `[data-icen-preset="<name>"]` token 面（明暗两块），组件代码一行不动；或用 `createDesign` 编译完整配方（文档站 `/customize/` 有实时工作台）。配色目录事实源 `src/tokens/themes.json`。

## 事件体系（behaviors/events.ts）

- 全部自定义事件 `icen:` 前缀，`bubbles + composed + cancelable`；detail 契约全量登记 `IcenEventMap`（拼错编译期报错）。
- 绑定用 `onIcen(el, type, handler, { within, signal, once })`（类型推断 + 选择器委托，返回解绑函数）；派发用 `emitIcen`（勿裸写 `new CustomEvent`）。
- 从 document 派发的是**全局广播**（如 `icen:ai-done`）：传播路径只经 [document, window]，要收广播就用全局形态。
- 手势层：容器挂 `data-icen-gestures="click dblclick longpress swipe …"` 即开通归一化手势事件；策略层 `setEventPolicy(type, fn)` 注册全站默认行为。

## 图表（behaviors/charts）

`renderChart(el, spec)` 吃纯 JSON ChartSpec（13 种 type；省略时 `inferChartType` 自动选型），返回带 `update/on/destroy` 的句柄；事件 `icen:chart-hover/-click/-legend-toggle/…`，tooltip 与图例内建。按需安装：`kit/chart-line` 等细分 slug，或 umbrella `kit/charts` 全量。ChartSpec 全字段见 `dist/behaviors/charts.d.mts`。

## AI 原生族

7 态状态机 `pending | running | streaming | approval | done | error | cancelled`；内容模型 `AiContent = string | AiContentPart[]`（text/image/audio/video/file/resource_link）。

```ts
import { renderAiMessage, initAiComposer, bindComposer } from '@icen.ai/ui/behaviors/ai-chat'; // 与 ai-composer
bindComposer(el, { client, messages: chatEl });  // 一行接通 输入台→流式→停止→排队→错误→用量环
```

- Provider 层 `createAiClient({ provider, model, apiKey })`：OpenAI / Anthropic / MCP / AI SDK 协议归一，用量与成本自动记账（`createAiAuditor`）。
- 工具体系 `behaviors/ai-tools`：把 UI 能力注册成模型可调用工具（`registerAiTool`），四族协议导出（`aiToolsToOpenAI/Anthropic/Mcp/AiSdk`）。
- 签名与字段约束见 `dist/behaviors/ai-*.d.mts` 与 `docs/spec/ai-native.md`。

## 知识库族（kb-*）

**ai 族描述思考（过程），kb 族呈现证据（从哪来 / 可信吗 / 怎么用）；权限域呈现边界（谁能看什么、为什么）**。业务数据一律先过 `behaviors/kb-core` 的 normalize 再喂组件。权限域安全纪律（评审必查，测试与守卫强制执行）：检索期隔离唯一基线 = query-time pre-filter；对授权侧诚实、对受限侧沉默；「不知道」与「不能说」不可区分；`evaluateAcl` 纯函数 fail-closed。规格 `docs/spec/kb-family.md`，成品页 <https://ui.icen.ai/kb/>。

## i18n 与 RTL

- `setIcenLocale(ICEN_LOCALE_EN_US)` 一键切英文，或传 `Partial<IcenLocale>` 逐 key 覆盖；切换派 `icen:locale-change` 广播。
- `<html dir="rtl">` 即整体镜像（全库逻辑属性 + 方向图标自动翻转），消费方零成本。

## 深挖索引（不设组件级 AGENTS.md——复制必漂移，读类型面即读文档）

| 深挖什么 | 去哪读 |
| --- | --- |
| 任意模块的签名与字段约束 | 包内 `dist/behaviors/<模块>.d.mts`（JSDoc 含行为约束） |
| 类型面 + 文档全文的纯文本快照 | <https://ui.icen.ai/llms-full.txt>（构建期生成，不漂移） |
| DOM 契约 / 类名 / 接口表 | 组件文档页 <https://ui.icen.ai/components/<slug>/>（kit 入口同款 CSS 头注释） |
| 设计动机与口径取舍 | `docs/spec/`（ai-native / kb-family / design-philosophy / design-primitives / ai-input-experience） |
| 场景配方（选图决策树等流程层） | skill `icen-ui`（skill.icen.ai） |

---

# 第二段 · 本仓库开发约定

## 架构与事实源

三层正交：配色预设 × 原语 × 明暗，全部 data 属性挂 `<html>`。单一事实源：

| 事实 | 在哪 |
| --- | --- |
| 配色目录 | `src/tokens/themes.json`（`bun run colors` 生成 colors.css，禁手改） |
| 组件 slug 与 kit 映射 | `scripts/slugs.mjs` |
| 稳定性分层 | `docs/contracts/tiers.json` |
| 公共契约面 | `docs/contracts/snapshot.json`（`bun run contracts` 检查） |
| 事件契约 | `src/behaviors/events.ts` 的 `IcenEventMap` |
| 体积预算 / 覆盖率地板 | `docs/contracts/size-budget.json` / `coverage-floor.json`（棘轮文件，diff 即评审点） |

## 铁律五条（其余细则由守卫报错现场告知）

1. **行为模块**：幂等 init + 返回销毁函数 + SSR 守卫 + 文本只写 `textContent`。
2. **公共面先登记后使用**：slug 进 `slugs.mjs`、事件进 `IcenEventMap`、组件进 `tiers.json`、契约变化跑 `contracts:update`——缺哪步都有守卫拦。
3. **分层方向**：Core 不运行时依赖 Beta。
4. **CSS 不出层**：产物全部在 `@layer icen.*` 内；组件只消费 `--icen-token-*`，不写死颜色/圆角/z-index/时长。
5. **安全红线**：禁 `innerHTML =`（清空除外）；不可信 URL 过 `safeUrl`。

## 构建与验证

```bash
bun run verify   # 本地快门：tsc + guard + bun test + build + size
```

CI 在其上加三道慢门（并行 job）：覆盖率棘轮（`bun run test:coverage`）、包面检查（`bun run check:pkg`：publint + attw）、契约-CHANGELOG 联动（PR）。浏览器验收舱 `bun run test:e2e`（视觉基线 + axe，见 docs/testing.md）独立 workflow。文档站构建冒烟在 CI（`cd site && bun run build`）。

## 发布

改 `package.json` version → push main → `git tag v<x.y.z> && git push origin v<x.y.z>` → CI 全门 → OIDC 发 npm（provenance，无长期 token，npm 侧已设 2FA-only）→ 自动建 GitHub Release。政策全文 [docs/versioning.md](https://github.com/icen-ai/ui/blob/main/docs/versioning.md)（不随包发布，仓库内阅读）。

## 文档站约定（site/）

- 组件文档数据在 `site/src/lib/components.ts` + `kb-docs-*.ts` 片段；组件页徽标（tiers.json）与「接口」区块（slugs.mjs + 行为源码）自动生成，勿手填。
- 客户端换页（ClientRouter）：页面级模块脚本一律 `astro:page-load` 驱动，全局监听重入前先退订。
- 站壳样式集中在 `site/src/styles/site.css`；demo 必须全真接线（假交互曾是最多的回归源）。
- `bun run build` 前置生成 `llms.txt / llms-full.txt`（scripts/llms.mjs）。

## 其它

- skill `icen-ui` 源在本仓库 `skill/icen-ui/`（只写 WHEN/WHICH 场景配方，不抄签名）；改完 `bun scripts/sync-skill.mjs` 单向同步到 skill 仓库。
- 不要手改 `dist/`；新增内置主题 = 改 themes.json + `bun run colors`。
