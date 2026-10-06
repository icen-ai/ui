# @icen.ai/ui — Icen Design System

icen.ai 全生态的统一设计系统：**设计 tokens（6 色彩预设 × 明暗双模 × 3 风格 profile）+ 无框架组件 CSS（66 组件）+ 行为 JS（72 behaviors，含 i18n 文案注册表）+ 统一事件体系 + AI 原生组件族 + 知识库组件族 + 图表通用层 + AI 工具体系 + React/Vue 官方薄封装**。工程形态与 `@icen.ai/cli` 一致（Bun + TS + tsup + ESM + MIT）。

> **v0.10（2026-10-06）**：契约冻结。命名空间全量前缀化（`.icen-*` 类名 / `data-icen-*` 钩子 / `--icen-*` 变量十五族 / 主题层改 data 属性）+ 产物全部进 cascade layers——与任何第三方 CSS 共存零冲突。v0.x 迁移跑包内 codemod：`bunx @icen.ai/ui migrate src --write`。破坏性明细与理由见 [CHANGELOG](./CHANGELOG.md)。

- 色彩预设：`clay`（默认，陶土橙 × 纸白 = icen 品牌）/ `piano` / `art` / `vangogh` / `ink` / `retro`，各含 `[data-icen-theme="dark"]` 变体
- 风格配置：`[data-icen-style="modern"]` / `[data-icen-style="retro"]` / `[data-icen-style="terminal"]`（几何 / 密度 / 动效 / 字体 token，与色彩正交）
- 可选效果层：`retro-effects.css`（CRT 扫描线 / 颗粒 / 像素边框 / 打字机光标 —— 仅 `[data-icen-style="retro"]` 激活时生效，按需 import）
- 组件：btn / form / input / select / slider / switch / tag-input / upload / modal / popover / tooltip / menu（含 dropdown + context-menu）/ tabs / nav / sidebar / breadcrumb / pagination / steps / segmented / accordion / tree / carousel / charts / table / stat / card / panel / pill / tag / badge / empty / feedback / content / media / toolbar / split-pane / date-picker / command-palette / notification / copy / scroll-area / back-top / datatable / layout / form-validate（66 个组件 CSS：charts 基座 + 13 个细分图表 kit + kb.css 基座 + 7 个 kb 域文件 + 4 个 AI 族合并文件）；浮层尺寸统一 PanelSizing 契约（`data-icen-panel-width/-min/-max/-min-height/-max-height` 属性面 + 程序面对象，含视口夹取）
- 图表通用层（v0.8；v0.10 重度场景增强）：`renderChart(el, spec)` 统一入口——纯 JSON 规格（type 缺省自动推断；data[] + dims 任意维度透视）、多系列折线/分组堆叠柱、内置 tooltip、`icen:chart-hover/click/dblclick/contextmenu` 交互事件族、图例点击切换系列；贡献日历 renderCalendar + 散点气泡 renderScatter；**v0.10**：LTTB 降采样（`spec.downsample` + 抽样诚实提示）、缩放/刷选（`spec.zoom` + `icen:chart-zoom`）、标记线/点（`spec.marks` 纯 JSON）、流式追加（`handle.append`）、PNG 导出（`handle.toDataURL`）、加载骨架（`spec.loading`）
- AI 原生组件族（v0.7，14 个 slug）：ai-chat（会话容器）/ ai-message（消息行）/ ai-reasoning（推理块，流式展开完成后自动折叠一次）/ ai-composer（输入台）/ ai-tool-call（工具调用卡）/ ai-subagent（子智能体卡）/ ai-diff（差异审阅）/ ai-files（文件标签）/ ai-todo（任务清单）/ ai-context（上下文抽屉）/ ai-usage（用量条）/ ai-threads（会话线程树）/ ai-feedback（👍👎 + 理由）/ ai-branch（消息分支切换）——共享 7 态状态机与 kind 注册表，事件统一 `icen:ai-*` 前缀
- 知识库组件族（v0.9，32 个 slug，规格 `docs/spec/kb-family.md`）：**ai 族描述思考（过程），kb 族呈现证据（知识从哪来 / 可信吗 / 怎么用）；权限域呈现边界（谁能看到什么，以及为什么）**。七域——证据（kb-citation 角标三型定位 / kb-sources / kb-passage 高亮回看 / kb-conflict）、摄取（kb-pipeline / kb-chunks 分块审阅 / kb-segment / kb-connector 连接器健康 / kb-metadata / kb-qa 问答对）、检索（kb-retrieval playground / kb-filter → Mongo·OData 双 DSL / kb-rerank A/B 对比 / kb-hittest 召回测试）、问数（kb-sql / kb-answer / kb-clarify）、治理（kb-explain / kb-trace / kb-review / kb-gap / kb-eval 四级评测）、工作台（kb-canvas / kb-checkpoint 范围显式回滚 / kb-sandbox MCP 沙箱 / kb-chain）、**权限（kb-acl 继承四件套+双区 / kb-who-can view-as 原因链 / kb-access 九态申请流 / kb-audit 审计+异味 / kb-visibility admin 可见性对照器）**；契约层 `kb-core.ts`（60+ normalize，`evaluateAcl` 纯函数：先 deny→并集→默认拒绝；分数纪律与**安全呈现纪律**全族统一——对授权侧诚实、对受限侧沉默），事件统一 `icen:kb-*`
- 标准化内容模型 `AiContent`（v0.7.1，对标 AI SDK v5 parts / MCP / OpenAI / Anthropic，2026-10 调研）：一套 `AiContentPart[]`（text / image / audio / video / file / resource-link）表达任意输入——消息渲染（renderAiMessage 多模态 + 错误变体）、工具回执（MCP content 数组零改动进卡片）、传输层（parts → 两族 wire，含 anthropic `cache_control` 与 tool_result 回灌）全部只认这一套；`normalizeContentParts` 一函数归一四族来源，`estimateTokens` / `contextEstimate` 提供粗估与上下文口径
- ai-provider 适配层（v0.7.1 增强）：五家厂商注册表（含定价表，`estimateCost` 未命中不猜价）、chat + stream 双族线协议多模态传输、审计闭环（`createAiAuditor` 条目含 cost 定价估算与 ttftMs 首 token 延迟，`renderAiAudit` 面板 + `ai-context` 抽屉审计节）、请求收尾派 `icen:ai-done`（status/usage/cost/error/durationMs/ttftMs）
- 绑定层 `bindComposer`（v0.7.1，「零接线全链路」）：一行把 composer ↔ 消息区（renderAiMessage）↔ client（stream + 停止 + 排队续发 + 错误路径）↔ 上下文环（`usage.from: 'context'` 正确口径 / `'billing'` 计费口径 / auditor）接成闭环；不传 client 为纯状态绑定（渐进采用）；附件三入口（钮选 / 粘贴 / 拖放）
- AI 工具体系（v0.8，`ai-tools`；v0.10 深化）：UI 能力注册为模型可调用的工具（内置 `render_chart` 吃 ChartSpec 纯 JSON + `show_form` 渲染表单收输入）；`createAiToolArea` 挂载区三层控制（白名单 / max LRU / 运行时调节）；模型侧 `aiToolsToOpenAI()` / `aiToolsToMcp()` / `aiToolsToAnthropic()` / `aiToolsToAiSdk()` 四族导出 + `aiToolsManifest()` 贴 system prompt；参数校验 `validateToolArgs`（不支持的关键字进 unvalidated 清单，不猜不静默）；`requiresApproval` 审批流（`icen:ai-tool-approve/reject`）/ `timeoutMs` / `idempotent` 去重 / `ctx.icen-progress` 活动流；工具回执内嵌图（output 为 chart spec → 工具卡展开区直接渲染）
- **表单校验层（v0.10，`form-validate`）**：原生约束即 schema（required/type/min/max/pattern…零新词汇）+ `data-icen-validate` 扩展规则（`matches:` 跨字段 / `registerValidator` 具名异步）+ `data-icen-msg-*` / `setValidateMessages` i18n；submit 优先 → 出错即时复验 → blur 补验策略；`role="alert"` 错误节点 + aria 接线 + 可选汇总锚点；`icen:form-valid/form-invalid` 事件族
- **React/Vue 官方薄封装（v0.10）**：`@icen.ai/ui/react` 与 `@icen.ai/ui/vue`——`useIcenInit` / `useIcenEvent` 原语 + `createIcenComponent` / `createVueRenderer` 工厂 + `Chart` / `DataTable` / `AiComposer` / `AiMessage` 旗舰组件；只做生命周期接线与事件桥（零状态复制）；react/react-dom/vue 全为 optional peer；文档 <https://ui.icen.ai/frameworks/>
- **测试与守卫基座（v0.10）**：`bun run verify` = tsc + guard + test + build 四道门；588 测试（bun test + happy-dom）；8 项纪律守卫把 AGENTS.md 的约定变成 CI 红绿（CSS 纪律 / registry / 事件双向核对 / SSR 守卫 / 命名空间碰撞面 / 权限域诚实呈现扫描 / RTL 逻辑属性 / 类名同步）
- **RTL（从右到左）全面支持（v0.10）**：组件 CSS 全面迁移 CSS 逻辑属性（`margin/padding/border-inline-*`、`inset-inline-*`、`text-align: start/end`、逻辑角半径），消费方只需 `<html dir="rtl">`；方向性图标（轮播箭头 / 面包屑分隔符 / 折叠 chevron）在 `[dir="rtl"]` 下自动镜像；物理方向仅保留给真正的视口物理坐标（JS 浮层定位 / 图表坐标系 / 物理侧边变体），由守卫强制
- 事件体系（events）：`onIcen` 一个入口（类型化 `IcenEventMap` + 选择器委托 + `{ within, signal, once }`）+ `emitIcen` 唯一派生口 + `setEventPolicy` 手势默认行为 + `data-icen-gestures` 声明式手势（click/dblclick/contextmenu/longpress/text-select，位移守卫与消歧内建）
- 控件族（controls）：`initSwitch`（开关/三态勾选/单选组）/ `initStepper` / `initSegmented` / `initSteps` / `initRating` / `initPagination` / `initTableSort`——纯 CSS 控件的行为承载与 `icen:*-change` 事件
- **本地化 i18n（behaviors/i18n）**：全库行为层面向用户文案的唯一事实源——扁平 key 注册表（默认 zh-CN = 历史硬编码逐字迁移 + 完整 en-US）；`setIcenLocale(partial)` 合并覆盖不清表、`resetIcenLocale()` 回默认、切换后自 document 派 `icen:locale-change` 广播（detail `{ changed: string[] }`，组件监听重渲染）；渲染时 `t(key)` 取值（数组型 key 返回 `string[]`，插值 `t(key, { p0 })` 走 `{p0}` 占位符）
- 行为：theme / tabs / toast / copy / input / select / slider / tag-input / upload / modal / dropdown / popover / context-menu / accordion / tree / carousel / charts / nav / sidebar / datatable / notification / back-top / command-palette / date-picker / split-pane / events / controls / form-validate / i18n / ai-core / ai-chat / ai-composer / ai-tool / ai-provider / ai-diff / ai-panel / ai-tools / ai-threads / ai-feedback / ai-branch / kb-core + 31 个 kb-*（72 个，全部 SSR 守卫 + 幂等 init + 返回销毁函数 + textContent-only）

## 工程信任

生产环境依赖一个 0.x 库之前该问的问题，直接给证据：

- **[SECURITY.md](./SECURITY.md)**——支持版本矩阵与漏洞响应承诺（72h 内确认）；textContent-only 渲染、禁 innerHTML、权限域 fail-closed、OIDC provenance 发布链、零运行时依赖等安全设计要点逐条可验证。
- **[CONTRIBUTING.md](./CONTRIBUTING.md)**——四道门验证（`bun run verify`）、加组件完整仪式、6 项纪律守卫速查表；外部贡献者与维护者的验收标准一致。
- **[docs/versioning.md](./docs/versioning.md)**——0.x 破坏性变更纪律（只在 minor、必配 codemod + 迁移指南）与 1.0 冻结标准 checklist。
- **发布链一句话**：`git tag v<x.y.z>` → GitHub Actions 经 OIDC trusted publishing 发 npm（无长期 token，npm 侧「Require 2FA and disallow tokens」），每次发布带 provenance 可审计。
- **纪律是机器强制的**：8 项守卫 + 588 测试挂在每个 PR 的 CI 上（[ci.yml](./.github/workflows/ci.yml)），破纪无法合入。

## 使用

```bash
bun add @icen.ai/ui
```

```css
@import '@icen.ai/ui/tokens.css';
@import '@icen.ai/ui/ui.css';   /* tokens + base + 全部组件；也可按 ./components/btn.css 单引 */
/* 可选：仅 [data-icen-style="retro"] 下生效的像素效果层 */
@import '@icen.ai/ui/retro-effects.css';
```

```html
<html data-icen-preset="piano" data-icen-theme="dark">   <!-- 预设 + 可选明暗；clay 为 :root 默认 -->
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
setStyle('retro');                 // 切风格画像（modern/retro），与主题正交
registerThemePreset('brand');       // 登记自建预设（宿主 CSS 先写好 .brand/.brand[data-icen-theme="dark"] token 面）
listThemePresets();                // 枚举全部预设（含注册的），UI 切换器用
initTabs();                        // [data-icen-tabs] > [data-icen-tab] + [data-icen-tab-panel] 契约；切换派发 icen:tab-change
initCopy();                        // .icen-copy-btn[data-icen-copy] 委托
toast.ok('已保存');                // 或 toast.action('已删除', '撤销', undo)；类名 .icen-toast--success 等
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
  messages: chatEl.querySelector('.icen-ai-chat-scroll'),
  usage: { from: 'context' },   // 或 'billing' / auditor
});
```

## 文档站（已上线 <https://ui.icen.ai>）

`site/` 是公开文档站（首页 / 色彩预设色板 / 组件演示 / **[知识库工作台](https://ui.icen.ai/kb/)**——六标签全真接线的最佳实践成品页，导航栏实时换肤换明暗）。部署：

```bash
cd site && bun install && bun run build
bunx wrangler pages deploy dist --project-name=icen-ui   # 需 CLOUDFLARE_ACCOUNT_ID
```

Pages 项目 `icen-ui`（aidoll 账号），自定义域 `ui.icen.ai` → CNAME `icen-ui.pages.dev`。**已接 Git 自动部署**：push 到 `main` 即由 Cloudflare 构建（根目录 `site`，命令 `bun install && bun run build`，输出 `dist`），无需 wrangler 手动部署、无需任何 token/secret。

## 构建

```bash
bun install
bun run build   # tsup（behaviors → dist/*.mjs + .d.mts 类型面）+ scripts/dts-ext.mjs + scripts/build-css.ts（css → dist/）
```

产物：`dist/tokens.css`（colors + style-profiles + typography 拼合）、`dist/ui.css`（tokens+base+组件）、`dist/base.css`、`dist/retro-effects.css`（按需）、`dist/tokens/*`、`dist/components/*`、`dist/behaviors/*.mjs` + `.d.mts`（66 个声明，JSDoc 约束注释存活）、`dist/index.mjs`、`dist/registry.json`（含 tokens/tokensExtras/base/components/behaviors 清单）。

## DTCG 标准导出（设计 tokens 的互操作层）

`bun run dtcg` → `dist/tokens/dtcg.json`（npm 子路径 `@icen.ai/ui/tokens/dtcg.json`）。把 6 预设 × 明暗的全部 token 导出为 **W3C DTCG 经典版**（第二版编辑草案 2022-06-14——Style Dictionary / Tokens Studio / Figma 插件等生态实际部署的版本；TR 2025.10 是预览草案，官方标注 *Do not attempt to implement*，`--dtcg-version` 参数留作升级门）：

- **结构**：`{ $description, clay: { light: {…}, dark: {…} }, piano: {…}, … }`——每个 (预设, 明/暗) 是该组合下的**有效级联结果**（:root → [data-icen-theme="dark"]/.预设 → .预设[data-icen-theme="dark"]，按特异性分层、同层按源序）；子组按变量前缀划分并提升组级 `$type`（token 级 `$type` 恒最高优先）。
- **经典版标量**：颜色 `#rrggbb[aa]`（rgba 自动换算）、尺寸 `"1rem"`/`"36px"`、时长 `"150ms"`、字体栈 string[]、缓动四元数组、行高 number；`var()` 引用导出为规范别名 `{clay.light.token.icen-accent}`（引用目标保证在文件内，链式合法、无环）。
- **类型只从变量名语义映射**（规范禁止工具从值猜类型），每个 token 保留 `$extensions['ai.icen.raw']` = 原始 CSS 自定义属性名。
- **诚实失败**：`color-mix()` 派生色、box-shadow 值在经典版无对应标量，指向它们的桥接别名随之断链——一律**跳过并打印清单**（同时记录在顶层 `$extensions['ai.icen.skipped']`），不猜、不计算。`[data-icen-style="modern"]/[data-icen-preset="retro"]/.terminal` 是与预设正交的风格层，`retro-effects.css` 是按需 extras，均不在 预设×明暗 矩阵内（按设计排除）。
- **注意顺序**：tsup 会清空 dist，`dtcg` 必须在 `bun run build` **之后**运行（它不依赖 dist、只读 `src/tokens/`，但产物落在 dist 内）。脚本不并入默认 build，纯增量可选手动生成；若要随 npm 包分发，把 `bun run dtcg` 加进发布链（CI 或 prepublishOnly）即可。

## 设计工具导出（Tokens Studio / Figma Variables）

`bun run dtcg && bun run design-tokens` → 两个设计工具形态产物（`design-tokens` 只消费 `dtcg.json`，产物缺失时自动先自举 `dtcg`）：

- `dist/tokens/tokens-studio.json`——**Tokens Studio（Figma 插件）原生格式**：`$themes` 每 预设×明暗 一个 theme（12 组），每组合一个 token set 键 `"clay/light"`（直接映射 dtcg.json 的 `clay.light` 段：组层级、组级 `$type`、`$description`、`$extensions` 原样保留），`$metadata.tokenSetOrder` 为全量清单。在 Tokens Studio 里导入后按 theme 切换即可对齐 CSS 的 预设×明暗 矩阵。
- `dist/tokens/figma.variables.json`——**Figma Variables（REST/导入形态）**：`variableCollections` 每预设一个（`icen / <preset>`，`modes: light/dark`）。类型映射：颜色 `#rrggbb[aa]` → RGBA 对象（0-1 浮点）；dimension/number → FLOAT（**px 数值口径，rem 源值 ×16 换算**——Figma 无 rem 单位）；时长/缓动/字体栈 → STRING（`"150ms"` / `cubic-bezier(...)` / 逗号联接）。DTCG 别名 `{clay.light.font.body}` → Figma 引用 `{ type:'VARIABLE_ALIAS', id }`，id 为路径编码 `icen/<预设>/<组路径>`，文件内自洽。
- **诚实口径同 dtcg**：上游跳过的 color-mix/box-shadow 等不可表示项不进产物，脚本原样打印其清单；仅单一模式存在的 token（如 clay 的 dark-only 静音色）因 Figma 变量要求所有 mode 有值而跳过并打印。两个文件经 npm 子路径 `./tokens/*` 通配可达（`@icen.ai/ui/tokens/tokens-studio.json`、`@icen.ai/ui/tokens/figma.variables.json`）。

## 目录

```
src/tokens/colors.css          # 6 预设 × 明暗（clay 基值已校准到 accounts.icen.ai 视觉）
src/tokens/style-profiles.css  # density/motion/typography + [data-icen-style="modern"]/[data-icen-preset="retro"]/.terminal
                               #   retro 段选择器引用 base.css 的 .icen-pressable/.icen-control/.icen-lift
src/tokens/typography.css      # icen canonical 字体栈（IBM Plex Mono + CJK 宋体）
src/tokens/retro-effects.css   # 可选效果层：CRT/扫描线/像素工具类（不进 tokens.css 拼合）
src/base.css                   # 元素基线 + 滚动条 + z-index 标尺 + 6 个交互基元
                               #   .icen-pressable / .icen-control / .icen-field / .icen-lift / .icen-surface-elevated / .icen-focus-ring
                               #   + a11y 工具类 .icen-sr-only / .icen-skip-link + 工具类 .icen-mono/.icen-dim/.icen-faint/.icen-numeric
src/components/*.css           # 65 个无框架组件 CSS（4 个 AI 族合并文件 + kb.css 基座 + 7 个 kb 域文件 + chart-graph）
src/behaviors/*.ts            # 70 个 behaviors（AI 族 11 个 + kb 族 32 个）
docs/spec/kb-family.md        # 知识库族规格（顶层设计唯一事实源，§9 权限域）
docs/research/                # 两轮调研归档（组件选型 + 权限安全，100+ 来源查证）
scripts/build-css.ts           # CSS 产物构建（拼合 + registry.json）
scripts/dtcg.mjs               # DTCG 经典版导出（bun run dtcg → dist/tokens/dtcg.json）
scripts/design-tokens.mjs      # 设计工具导出（bun run design-tokens → dist/tokens/{tokens-studio,figma.variables}.json）
site/                          # 文档站骨架（ui.icen.ai，独立 Astro 应用，含 /kb 工作台）
```

## 消费方接入

`@icen.ai/ui` 已发布 npm（OIDC trusted publishing，打 `v*` tag 即自动发版）。两种消费方式均可：

- **包引入（推荐）**：`bun add @icen.ai/ui`，按 `./tokens.css` / `./ui.css` / `./kit/<slug>` 引入。
- **vendor 复制**：accounts 目前走这条路——`bun run sync:ui`（accounts 仓库内）把本仓库 `dist/` 复制到 `src/styles/vendor/icen/`，布局里 import 对应 CSS/JS。适合需要锁定版本或离线构建的场景。

给 AI 代理的文档层：npm 包内 `AGENTS.md`（消费方速查）+ `dist/**/*.d.mts`（类型真相）；站点 <https://ui.icen.ai/llms.txt>（索引）与 `/llms-full.txt`（全文 + 类型面快照）；场景配方 skill `icen-ui`（skill.icen.ai）。
