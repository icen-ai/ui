# AGENTS.md — @icen.ai/ui

本文件面向 AI 编程助手，分两段：**第一段 = 消费方速查**（在用户项目里使用本包的 AI 先读这段，随 npm 发布于 `node_modules/@icen.ai/ui/AGENTS.md`）；**第二段 = 本仓库开发约定**（给在本仓库内写代码的 AI）。

---

# 第一段 · 消费方速查（在用户项目里用 @icen.ai/ui）

完整类型签名看包内 `dist/*.d.ts`；交互式文档 <https://ui.icen.ai>；AI 能力规格 `docs/spec/ai-native.md`；知识库族规格 `docs/spec/kb-family.md`；最佳实践成品页 <https://ui.icen.ai/kb/>；文档全文（喂模型）<https://ui.icen.ai/llms-full.txt>。

## 形态约束（先读，避免生成跑不通的代码）

- 零依赖纯 ESM + TypeScript；组件 = CSS + 行为 JS，**不绑定框架**（React/Vue 在 effect/mounted 里调行为函数即可）。
- 先引 tokens 再引组件：`@import '@icen.ai/ui/tokens.css';`（组件 CSS 全部消费 `--icen-token-*` 变量）。
- **Astro 陷阱**：kit 入口的 css import 在页面 `<script>`（client bundle）里会被摇掉——Astro 项目必须在布局 frontmatter 引组件 CSS；Vite SPA / webpack 无此问题。
- 行为函数全部**幂等**且 **SSR 安全**（`window` 未定义静默返回）；渲染只写 `textContent`，绝不 innerHTML。
- 自定义事件统一 `icen:` 前缀（图表 `icen:chart-*`，AI 族 `icen:ai-*`）。明暗 = html `data-icen-theme="dark"`；密度 = 容器 `data-icen-density`。

## v0.10 命名空间契约（类名防冲突——与任何第三方 CSS 共存零冲突）

- **类名一律 `icen-` 前缀**（`.icen-btn` / `.icen-modal` / `.icen-kb-citation`…）；唯一例外是状态类 `.is-*`——纪律是 `.is-*` 永不单独出现在选择器里，永远与根类复合（`.icen-tab.is-active`），因此天然隔离。
- **主题层是 data 属性，不是类**：`<html data-icen-preset="piano" data-icen-theme="dark" data-icen-style="pixel">`（旧 `[data-icen-preset="piano"]`/`[data-icen-theme="dark"]`/`.style-*` 类形态已废弃——`[data-icen-theme="dark"]` 是全业界最危险的类名）。自建第 7 套预设 = 写 `[data-icen-preset="<name>"]` 与 `[data-icen-preset="<name>"][data-icen-theme="dark"]` 两块完整 token 面。
- **库 data 钩子一律 `data-icen-*`**（`[data-icen-tabs]`、`data-icen-copy`、`data-icen-panel-width`…235 个全量）；**全局 CSS 变量七族一律 `--icen-*`**（`--icen-token-*/--icen-density-*/--icen-radius-*/--icen-duration-*/--icen-ease-*/--icen-z-*/--icen-font-*`）；组件作用域变量（`--btn-*`/`--ai-*`/`--kb-*`）不前缀——它们只随根类作用于子树，根类已前缀即继承链已隔离。
- **cascade layers**：全部产物 CSS 包在 `@layer icen.tokens / icen.base / icen.components`——消费方自己的无层样式永远赢库样式（放心覆盖）；层序由 tokens.css 顶部声明锚定。
- **v0.9 → v0.10 迁移**：消费方跑 `bunx @icen.ai/ui migrate src --write`（包内自带 codemod，读 dist/migrate-map.json；歧义 token 保守跳过并给人工清单）。

## RTL 与逻辑属性

- **消费方零成本**：全套组件已迁移 CSS 逻辑属性（`margin/padding/border-inline-*`、`inset-inline-*`、`text-align: start/end`、逻辑角半径），`<html dir="rtl">` 即整体镜像；方向性图标（轮播箭头 / 面包屑分隔符 › → / 折叠 chevron / kb caret / 抽屉滑出）在 `[dir="rtl"]` 下自动翻转。
- **新增组件的 RTL 纪律**（`bun run guard` 第 7 项强制）：流向布局一律逻辑属性优先；物理方向只允许给真正的视口物理坐标——JS 计算的浮层定位（popover/tooltip/select panel）、图表坐标系（chart-*.css）、物理侧边变体名（`--sheet-left` / `data-icen-side='left'` / `--right` 时间线）、开关类物理隐喻控件（Material 惯例不镜像）、数字列物理对齐（Excel 惯例）；以上物理保留必须行尾 `/* guard:allow-physical 理由 */` 或进 `scripts/guard/rtl.ts` 的 PHYSICAL_FILES 文件级白名单（理由同步写进文件头注释）。

## 安装颗粒度

```bash
bun add @icen.ai/ui               # 或 npm i
bunx @icen.ai/ui list             # 全部 slug
bunx @icen.ai/ui add btn toast    # 按 slug 打印引入行
```

```css
@import '@icen.ai/ui/tokens.css';
@import '@icen.ai/ui/ui.css';     /* 全量；或单引 @icen.ai/ui/components/btn.css */
```

- **kit 一行入口**（CSS + behavior 一起）：`import '@icen.ai/ui/kit/btn';`
- **只取行为 JS**：`import { renderChart } from '@icen.ai/ui/behaviors/charts';`
- slug 清单机器可读：`@icen.ai/ui/registry.json`。

## 图表通用层（behaviors/charts）— ChartSpec 纯 JSON，天然可被模型调用

```ts
import { renderChart } from '@icen.ai/ui/behaviors/charts';
const c = renderChart(el, {
  type: 'line',                  // line|area|vbar|hbar|stack|donut|radar|heatmap|calendar|sparkline|gauge|scatter
  title: '各版本能力数',
  labels: ['v0.1','v0.2','v0.3'],
  series: [{ name: '组件', values: [31,41,43] }, { name: 'AI 专属', values: [0,0,0] }],
  format: { unit: ' 个', places: 0 },  // 值格式化描述符（chartFormatValue）
});
c.update(newSpec);
c.on('click', (e) => e.detail);   // { index, seriesIndex, seriesName, label, value, pointerX, pointerY }
c.destroy();
```

- 省略 `type` 时 `inferChartType` 自动选型（ISO 日期/年月/周几/版本号 v0.8/纯年份等时序标签 → line）。
- 事件：`icen:chart-hover`（detail.phase ∈ enter/move/leave）/ `-click / -dblclick / -contextmenu / -legend-toggle / -legend-visibility`；内置 tooltip 门户（`tooltip:false` 关闭只派事件），tooltip 最大宽吃图表根 `data-icen-panel-max`；图表头统一带**图例眼睛**（隐藏/显示全部指标）。直调底层渲染器同样有交互委托（`bindChartEvents`）。
- 底层渲染器（同 chrome，非 AI 场景直用）：`renderVBar/renderHBar/renderStack/renderDonut/renderLine/renderArea/renderRadar/renderHeatmap/renderCalendar/renderSparkline/renderGauge/renderScatter`。

## AI 原生族 — 7 态状态机 + kind 注册表

状态：`pending | running | streaming | approval | done | error | cancelled`。

```ts
import { renderAiMessage, createAiStream } from '@icen.ai/ui/behaviors/ai-chat';
import { renderAiToolCall, renderAiSubagent, initAiTool, initAiSubagent } from '@icen.ai/ui/behaviors/ai-tool';

renderAiMessage(el, {
  role: 'assistant', model: 'kimi-k3',
  content: [                        // 多模态 parts（纯 string 也可）
    { type: 'text', text: '结论如下' },
    { type: 'image', url, alt },    // 另有 audio / video / file{mimeType,filename} / resource_link
  ],
  meta: '刚刚 · 1.1k tok',
});

const t = renderAiToolCall(el, { id, name: 'WebSearch', kind: 'browser', status: 'running', input: { query } });
t.update({ status: 'done', output: '命中 24 条', durationMs: 1800 });
// 审批态：status:'approval' + approval:{reason} → 卡上按钮派 icen:ai-approve / icen:ai-reject
renderAiSubagent(el, { name: 'verify', input: { task }, activities: [/* 同工具卡 */] });
initAiTool(); initAiSubagent();      // 事件委托，页面级一次
```

- 线格式归一 `normalizeContentParts`（OpenAI/Anthropic/MCP 通吃）；取纯文本 `contentToText`；资源 URL `aiContentUrl`。
- kind 可扩展：`registerAiKind({ label, icon, tint, summarize })`；工具卡输入 JSON 默认折叠，`chart`/`error`/`approval`/多模态输出默认展开。
- 推理块 `.icen-ai-reasoning` + `createAiStream(host)` 流入（host 在 `.icen-ai-reasoning` 内时完成自动折叠并回填耗时）。
- 面板：`renderAiTodo/renderAiUsage/renderAiContext/renderAiAudit`（ai-panel）、`parseUnifiedDiff/renderAiDiff`（ai-diff）。

## 输入台 + 零接线绑定

```ts
import { initAiComposer, bindComposer, setComposerTodo, setComposerModels } from '@icen.ai/ui/behaviors/ai-composer';

initAiComposer(el);
setComposerModels(el, listAiProviders(), { provider: 'kimi', model: 'kimi-k3' });
bindComposer(el, { client, messages: chatEl });  // 一行接通发送→流式→停止→排队→错误→用量环
setComposerTodo(el, [                           // 业界模式：plan 是工具调用，实时状态挂输入框
  { content: '搜集资料', status: 'done' },
  { content: '渲染图表', status: 'running', activeForm: '正在渲染图表' },
]);  // chip 显示 x/y；全 done → is-done；有 error/cancelled → is-error；点开弹层看清单
```

## Provider 层（behaviors/ai-provider）

```ts
import { createAiClient, createAiAuditor, estimateCost } from '@icen.ai/ui/behaviors/ai-provider';

const client = createAiClient({ provider: 'kimi', model: 'kimi-k3', apiKey });
await client.chat({ messages });       // 或 client.stream(...)（SSE 逐 chunk）
const auditor = createAiAuditor();     // log() 条目含 cost（定价表估算）与 ttftMs
// 每次请求收尾派 icen:ai-done（detail: status/usage/cost/error/durationMs/ttftMs）
```

- 多模态出线：`toOpenAiContent/toAnthropicBlocks`（含 cache_control 与 tool_result 回传）。
- 用量双口径：`contextEstimate(history)` = 上下文估算（输入框用量环）；计费走 `normalizeUsage` + `estimateCost`（定价表未命中不猜价）。别混用。

## 工具体系（behaviors/ai-tools）— 把 UI 能力注册成模型可调用工具

```ts
import { createAiToolArea, aiToolsToOpenAI, aiToolsToAnthropic, aiToolsToMcp, aiToolsToAiSdk, aiToolsManifest, parseAiToolArgs, validateToolArgs }
  from '@icen.ai/ui/behaviors/ai-tools';

const area = createAiToolArea(mountEl, {
  tools: ['render_chart', 'chart-*'],  // 白名单支持 glob；缺省 = 全部已注册
  max: 4,                              // 挂载上限，LRU 淘汰
});
area.call('render_chart', { type: 'line', labels, series });  // 宿主手动/模型触发
area.call('risky_tool', args, { validate: false });           // call opts：校验默认开，可关
area.setTools(['render_chart']);  area.setMax(2);  area.onChange(cb);

aiToolsToOpenAI();    // → OpenAI tools 数组（function.parameters）
aiToolsToAnthropic(); // → Anthropic tools 数组（input_schema）
aiToolsToMcp();       // → MCP tools/list 形态
aiToolsToAiSdk();     // → Vercel AI SDK v5 tool() 描述表（不 execute，宿主侧挂载执行）
aiToolsManifest();    // → 自描述 manifest
parseAiToolArgs(raw);   // 模型回包解析（容错 JSON 字符串/对象，坏 JSON→{}）
validateToolArgs(schema, args);         // 参数校验：不支持的关键字进 unvalidated 清单，不猜
```

自定义工具：`registerAiTool({ name, description, inputSchema, run, present?, timeoutMs?, requiresApproval?, idempotent? })`；
`run(input, mount, ctx)` 第三参 `ctx: { signal: AbortSignal, progress(line) }`，允许返回
Promise（落定后写结果）；`timeoutMs` 超时 → `{ ok:false, error:{ code:'timeout' } }`；
`requiresApproval` → 挂载卡先呈审批区（批准派 `icen:ai-tool-approve` 才执行，拒绝派
`icen:ai-tool-reject` 置 `.is-cancelled`）；`idempotent` → 同名同输入在途调用复用同一条
记录。内置 `render_chart` 与 `render_datatable`。挂载区条目可折叠/移除，超限 LRU 自动回收。

## i18n 本地化（behaviors/i18n）

- 全库行为层面向用户文案的唯一事实源：扁平 key 注册表（默认 zh-CN = 历史硬编码逐字迁移，附完整 en-US）。组件渲染时经 `t(key)` 取值——`setIcenLocale(ICEN_LOCALE_EN_US)` 一键切英文，或传 `Partial<IcenLocale>` 逐 key 合并覆盖（不清表），`resetIcenLocale()` 回默认。
- 切换后自 document 派 `icen:locale-change` 广播（detail `{ changed: string[] }`，见 events.ts 广播约定）——组件监听后可重渲染；`getIcenLocale()` 返回冻结浅快照（改它不影响内部）。
- 数组型 key（`datePicker.weekdays`）`t()` 返回 `string[]`；插值 `t(key, { p0 })` 以 `{p0}` 占位符替换；模块级注册表（kind 标签/工具 schema）在导入时按当时语言快照。

## 知识库族（kb-*）— 证据层组件

**ai 族描述思考（过程），kb 族呈现证据（知识从哪来 / 可信吗 / 怎么用）；权限域呈现边界（谁能看到什么，以及为什么）**。32 个 slug 七域，CSS 根类 `.kb-*`，事件统一 `icen:kb-*`（56 个全类型登记）。规格唯一事实源 `docs/spec/kb-family.md`（§9 为权限域）；最佳实践成品页 <https://ui.icen.ai/kb/>（八标签工作台 + 参考文献锚点）。

```ts
import { renderCitationText, initKbCitation } from '@icen.ai/ui/behaviors/kb-citation';
import { createKbRetrieval, scorePercent } from '@icen.ai/ui/behaviors/kb-retrieval';
import { createKbFilter } from '@icen.ai/ui/behaviors/kb-filter';
import { parseInlineCitations } from '@icen.ai/ui/behaviors/kb-core';

// 角标：文本里的 [1][2] → renderCitationText(el, text, sources)（initKbCitation() 页面级事件委托）
// 引用三型定位（Anthropic 同款）：location: {type:'char',start,end,unit:'char'} | {type:'page',page} | {type:'block',blockId}——unit 写死不猜
// 检索 playground：混合权重 / 阈值 / topK 即调即得，事件 icen:kb-retrieval-run
// 过滤器：树形规则 → serialize('mongo'|'odata') 双 DSL；无效规则不镜像（诚实纪律）
const filter = createKbFilter(el, { node, fields, onChange: (node, valid) => {...} });
```

- **分数纪律（全族统一）**：score 必带 metric 与 higherIsBetter（l2 距离自动反转）；null / 缺失渲染「—」不猜；条形轨道定宽，长度严格按 scorePercent 比例。
- **诚实呈现**：行数截断要声明、权限缺失打码并给「申请访问」、重排关闭后列压淡不隐藏、检查点回滚范围显式（只回滚文件保留对话）。
- 契约层 `kb-core.ts`（`import ... from '@icen.ai/ui/behaviors/kb-core'`）：KbCitation / KbChunk / KbRunStatus / KbConnector / KbRetrievalParams / KbFilterNode / KbEvalRow 等 40+ normalize 与格式化函数，业务数据一律先过 normalize 再喂组件。
- 域文件映射：证据 kb-citation·kb-sources·kb-passage·kb-conflict → kb-ground.css；摄取 kb-pipeline·kb-chunks·kb-segment·kb-connector·kb-metadata·kb-qa → kb-ingest.css；检索 kb-retrieval·kb-filter·kb-rerank·kb-hittest → kb-search.css；问数 kb-sql·kb-answer·kb-clarify → kb-data.css；治理 kb-explain·kb-trace·kb-review·kb-gap·kb-eval → kb-ops.css；工作台 kb-canvas·kb-checkpoint·kb-sandbox·kb-chain → kb-agent.css；**权限 kb-acl·kb-who-can·kb-access·kb-audit·kb-visibility → kb-perm.css**；全部组件 kit 自动带 kb.css 基座。

**权限域安全纪律（spec §9.0，评审必查）**：

- 检索期隔离唯一安全基线 = **query-time pre-filter**（ANN 与 BM25 两侧）；post-filter / generation / presentation 都不是边界。
- **对授权侧诚实，对受限侧沉默**：被裁条数 / 标题 / 分数 / 「若权限不同」对照不出现在普通用户视图（kb-visibility 的 admin 对照是唯一例外，组件自带警示条）。
- 「不知道」与「不能说」不可区分：无权限文档在检索/列表/计数/引用中 = 不存在；唯一允许的裁剪提示是与命中无关的恒定文案。
- 求值语义：`evaluateAcl(entries, identity)` 纯函数 = **先显式 deny → allow 并集 → 默认拒绝（fail-closed）**；身份来自服务端固定身份集，不接受自由输入。
- 引用白名单：citation 只能生成自过滤后集合；revoked 历史引用呈中性 `.is-revoked`；每条 grant 可带 `expiresAt`（到期三态：永不过期 / 倒计时+续期 / 已过期+重交）。
- 组件速用：`renderKbAcl(el, model)`（继承四件套 + Direct/Links 双区 + deny 置顶）；`renderKbWhoCan(el, {identities, entries})`（view-as 原因链，业界唯一全实现是 SharePoint Check Permissions——差异化件）；`createKbAccess(el, {request, mode})`（被拒五件套 + 九态状态机 + 路由明示）；`renderKbAudit(el, {entries, hygiene})` + `initKbAudit()`（三通道 + break-glass 警示 + 六类异味）；`renderKbVisibility(el, opts)`（admin 对照器 + 过滤层三态徽标 `.icen-kb-layer-chip` pre✓/post⚠/none✕）。

## 深挖索引（复杂模块不设单独 AGENTS.md，类型真相在 .d.mts）

每个 behavior 的完整接口/类型/字段约束都随包发布在 `dist/behaviors/<模块>.d.mts`（JSDoc 注释含行为约束，如「el 传容器或内部任意元素，就近解析 `[data-icen-ai-composer]`」）。**不建议也不需要按组件再写深层 AGENTS.md**——复制必漂移；读类型面即读文档：

| 深挖什么 | 去哪读 |
| --- | --- |
| AI 族全部签名与字段约束 | 包内 `dist/behaviors/ai-{core,chat,composer,tool,panel,diff,provider,tools,threads,feedback,branch}.d.mts` |
| 知识库族全部签名与字段约束 | 包内 `dist/behaviors/kb-*.d.mts`（契约层 `kb-core.d.mts`） |
| 图表 ChartSpec 全字段 + 各类型 options | `dist/behaviors/charts.d.mts` |
| 上述类型面 + JSDoc 的纯文本快照 | <https://ui.icen.ai/llms-full.txt>（「API 类型面」节，构建期自动内嵌） |
| 设计动机 / 状态机语义 / 口径取舍 | `docs/spec/ai-native.md`（包内随发） |
| **设计哲学全文（几何/色彩/动效/密度/预设人格/对标矩阵/覆盖架构/红线）** | `docs/spec/design-philosophy.md` |
| DOM 契约 / CSS 类名 | 各组件文档页 <https://ui.icen.ai/components/<slug>/，kit 入口同款 CSS 头注释 |
| 场景配方（选图决策树 / 聊天五步 / 主题切换） | skill `icen-ui`（skill.icen.ai，`curl -sL https://skill.icen.ai/install/ui.sh \| bash`）——按需触发的流程层，与本手册（事实层）互补 |

---

# 第二段 · 本仓库开发约定

## 完整设计原语（本真 / Benzhen）

- 默认主题与默认原语均为本真。主题走 `data-icen-preset`（本真＋另外五个主题）；原语走 `data-icen-style`（本真／像素）。两轴独立；旧 modern/retro/terminal 偏好迁移到本真，保留配色与明暗。没有第四条 design 轴。
- 配色目录唯一事实源：`src/tokens/themes.json`；colors.css 由 `bun run colors`（scripts/theme-colors.mjs）生成，禁止手改。六套主题：本真／陶土／钢琴／艺术／梵高／墨。运行时、文档站、导出均直接消费目录。
- 单一事实源：`src/tokens/design.css`（作者种子→旧语义角色映射），`src/components/material.css`（三类材料与组件适配），`src/behaviors/design.ts`（可选 `createDesign/mountDesign/setDesign`）。材料适配随 tokens.css 分发，kit 单独引入同样成立。
- 品牌作者优先修改 `--icen-design-*` 少量种子，避免复制组件 CSS。完整规则与明暗品牌示例见 `docs/spec/design-primitives.md`；交互工作室 `/benzhen/`。
- 材料 API：`data-icen-material="content|chrome|floating"`。内容面不透明；操作/临时面条件启用磨砂，提供 reduced-transparency 与 forced-colors 降级。密度变化不缩小文字，触摸目标至少 44px。
- 验证原语变更：`bun run verify` + 文档站构建 + `bunx playwright test tests/e2e/design.pw.ts`（真实产物、定制、portal、明暗、移动与 axe）。

## 项目概览

`@icen.ai/ui` = Icen Design System 的单一事实源：设计 tokens + 无框架组件 CSS + 行为 JS。生态内所有前端（accounts / skill / editor / 未来 `*.icen.ai`）从这里取设计资产，**不允许在消费项目里另起一套样式**。

三层正交架构（移植自 opengal，见其 `docs/spec/theme-system.md`）：
- **色彩预设**（`src/tokens/colors.css`）：`benzhen`（默认）/ `clay`/ `piano` / `art` / `vangogh` / `ink`，各含 `[data-icen-theme="dark"]`；以 `data-icen-preset` 挂在 `<html>` 上，本真是默认
- **原语**（`src/tokens/design.css` / `pixel.css`）：本真 benzhen（默认）与像素 pixel，控制几何、字体、材料、节奏与反馈；不覆盖选中的配色主题。
- **明暗**：`[data-icen-theme="dark"]` 类，与预设组合（`class="piano dark"`）

icen 默认：本真主题（瓷白＋冷蓝）＋本真原语。陶土仍作为独立配色主题保留，不是本真主题的来源。

**accent 明度三档契约（v0.10 收口，WCAG AA 硬达标）**：`--icen-token-accent`（亮档，品牌色——图标/边框/数据可视化等纯图形面）/ `--icen-token-accent-strong`（**承文本填充档**——实心按钮/选中态/徽标等 accent 底承 on-accent 文字的面一律用它，12 面实测 4.79–10.84 全过 AA）/ `--icen-token-accent-text`（浅底上的文字橙——链接/弱强调文本）。`--icen-token-on-accent` 是 accent 填充上的文字色：亮底深字（clay dark/vangogh/piano 的「亮填充+深字」Material You 惯例）或深底白字。新增承文本填充面禁止直接消费 accent 亮档。

## 构建

```bash
bun install
bun run build     # tsup（src/behaviors/*.ts + src/react/index.tsx + src/vue/index.ts → dist/*.mjs
                  # + dist/behaviors/*.mjs + .d.mts 类型面；react/react-dom/vue 为 external peer）
                  # + bun scripts/react-use-client.mjs（dist/react.mjs 补 'use client' banner）
                  # + bun scripts/dts-ext.mjs（.d.ts 改名 .d.mts：.mjs 的声明必须同名 .d.mts）
                  # + bun scripts/build-css.ts（css → dist/：tokens.css/ui.css/base.css/
                  #   retro-effects.css/tokens/*/components/*/registry.json）
```

测试基座 = bun test + happy-dom（`tests/setup.ts` preload 注册 DOM 全局；`tests/helpers/dom.ts` 提供 mount/nextTick/fire；kb 族诚实呈现一致性套件 `tests/kb-conformance.test.ts` + 求值语义 `tests/unit/kb-acl.test.ts`，映射表见 spec §9.9）。验证 = `bunx tsc --noEmit` + `bun run guard` + `bun test` 全绿 + `bun run build` 通过 + `site/` 文档站目视（`cd site && bun install && bun run build`）。

## 规模

- **69 个组件 CSS**（charts 基座 + 13 个细分图表 CSS（+v0.9 chart-graph/map）+ 10 个 v0.5 新增：copy/tag/badge/scroll-area/notification/back-top/command-palette/date-picker/toolbar/split-pane + 4 个 v0.7 AI 族合并文件：ai-chat/ai-tool/ai-diff/ai-panel + v0.9：kb.css 基座 + 7 个 kb 域文件（ground/ingest/search/data/ops/agent/perm）+ v0.10：form-validate.css 校验层 + mentions/autocomplete.css + theme-switcher.css 外观切换）
- **83 个 behaviors TS**（v0.9：+ai-threads/ai-feedback/ai-branch +kb-core 契约层 +31 个 kb-*——含权限域 kb-acl/kb-who-can/kb-access/kb-audit/kb-visibility；v0.10：+form-validate 校验层 +mentions/autocomplete +i18n 文案注册表；+theme-switcher 外观切换、icons 共享图形、focus 原生焦点契约等基础模块）
- **122 个组件 slug**（kit 一行入口 / CLI / 文档站侧栏共用 SLUGS 清单；v0.9 新增 37：kb 总集 + 31 kb-* + ai-threads/ai-feedback/ai-branch + chart-graph/chart-map；v0.10 新增 3：form-validate + mentions/autocomplete；+theme-switcher）
- **测试与守卫**：`bun run verify` = tsc + guard + test + build；500+ 测试（bun test + happy-dom，tests/unit 纯契约 + tests/dom 委托行为 + tests/kb-conformance 权限诚实呈现 + tests/{unit,dom}/i18n 本地化契约与零 CJK 渲染验收）；9 项纪律守卫（CSS/registry/事件/行为/命名空间/权限域/RTL 逻辑属性/类名同步/操作图标），CI 全挂
- **6 个 token 文件**：colors.css、style-profiles.css（公共兜底）、typography.css、design.css（本真与共享配方）、pixel.css（像素）、icon-masks.css（共享 SVG 路径生成的静态图形）。旧 retro-effects 已删除。

## 发布（OIDC Trusted Publishing，已配好）

- 全自动：改 `package.json` 的 version → commit + push main → `git tag v<x.y.z> && git push origin v<x.y.z>` → `.github/workflows/publish.yml` 自动构建并发 npm（带 provenance，**不要设 NODE_AUTH_TOKEN**）。publish.yml 只挂 tag push——不要再加 release 触发器，否则对同一 tag 发 Release 会起两次 run 抢 publish。
- npm 包设置已是「Require 2FA and disallow tokens」：token 一律拒发，只有这条 CI 能发。
- 手动首发/排障流程见 cli 仓库 `docs/publish-npm.md`（EOTP 安全密钥流程、镜像源 registry 坑、422 repository 字段坑）。

## 约定

- **组件只消费 `--icen-token-*`，不写死颜色/圆角/阴影/字体/时长/间距**（radius 用 `--icen-radius-*`、阴影用 `--icen-token-shadow-*`、动效用 `--icen-duration-*`/`--icen-ease-*`、间距用 `--icen-density-*`、字号用 `--icen-density-font-size-*`、控件高度用 `--icen-density-input-height-*`）。
- **圆角几何契约（guard 第 1 项强制，哲学全文在 `docs/spec/design-philosophy.md` §2）**：六档职责 xs 微件内角 / sm 控件 / md 默认容器 / lg 卡片面板 / xl 页面级 / full 胶囊。**同心圆法则**：嵌套圆角共圆心，`R_inner = R_outer − gap`，写 `calc(var(--icen-radius-<外档>) - <间距>)`；同心结果 <0 时内层直角，禁止 1–3px 近似圆角差。**`full`（跑道形）只给胶囊语义件**（pill/badge/chip/switch/进度轨道），容器永不用 full；**`50%` 只给几何正圆**（avatar/状态点/图标底）。禁裸 999px、禁撞档裸值 6/8/10/12/16px；bar/dot/track 等图形级微构件的 1–5px 裸值须行尾 `/* guard:allow-radius 理由 */` 登记。像素原语把六档归零——正交归零依赖组件零物理值。
- 语义色纪律：仅绿 `--icen-token-success` / 黄 `--icen-token-warning` / 红 `--icen-token-error` / 信息 `--icen-token-info` + 品牌 `--icen-token-accent`。
- **类名规范（0.6.0 收敛，breaking；下列旧名映射为历史记录，v0.10 起全部类名再统一加 `icen-` 前缀——见第一段「v0.10 命名空间契约」）**：
  - 语义修饰符只认 `--success/--warning/--error/--info`：pill `.ok/.warn/.bad/.icen-accent` → `.icen-pill--success/.icen-pill--warning/.icen-pill--error/.icen-pill--accent`；toast 类 `.ok/.err/.warn` → `.icen-toast--success/.icen-toast--error/.icen-toast--warning`（JS 方法 `toast.ok()` 等不变）+ 新增 `.icen-toast--info`；notification `.notif--*` → `.notification--*`；stat `.icon--ok/.icon--warn/.icon--bad` → `.icen-icon--success/.icen-icon--warning/.icen-icon--error`，`.icen-stat-num.icen-accent/.warn/.bad/.info` → `.icen-stat-num--accent/--warning/--error/--info`。
  - 状态类一律 `.is-*`：`.icen-page-tab.active` → `.is-active`、`.icen-carousel-dot.active` → `.is-active`、`.leaving` → `.is-leaving`（toast/notification）、`.icen-copy-btn.done` → `.is-done`。
  - 根类去前缀：`.panel-block` → `.icen-panel`、`.admin-table` → `.icen-table`、`.page-tabs/.admin-tabs` → `.icen-tabs`。
  - tabs.css 的 `--scroll` 变体已删除（违反「tab 条永不滚动」纪律）。
- 滚动条纪律：全局细薄无上下箭头（`base.css` 统一负责，组件不再写滚动条样式）；tab 条类组件**永不滚动**（`flex-wrap: wrap`）。
- **交互基元**：`base.css` 提供 6 个组件地基 `.icen-pressable` / `.icen-control` / `.icen-field` / `.icen-lift` / `.icen-surface-elevated` / `.icen-focus-ring`。原语适配集中在 material.css，像素参数集中在 pixel.css。共享 keyframes（`icen-pop-in` / `icen-spin` / `icen-skeleton-pulse`）也在 base.css，组件动画复用、不各自重定义。
- **z-index 标尺**：浮层一律 portal 到 body，z-index 取 `--icen-z-base/raised/sticky/chrome/toast/banner/dialog/popover/tooltip/fx`（0.6.0 新增 `--icen-z-fx`，retro-effects 特效层用）。
- **浮层 portal 家族**：popover / dropdown / context-menu / command-palette / date-picker / **select**（0.6.0 起 panel 也 portal 到 body，与 popover 共用定位模式）。
- **凹槽 × 尺寸 × 事件三契约（全库统一心智模型，v0.8 收敛）**：
  - **凹槽（内容）**：标记驱动组件 = 任意 HTML 凹槽（契约在各组件 CSS 头注释，如 modal 的 `.icen-modal-body`、select 的 `.icen-select-option` 内可写色卡/图标/多行）；函数渲染组件 = 类型化 model（一律 `textContent` 防 XSS）+ 指定挂载点（`renderAiMessage` 的 `handle.body`、datatable 的 `columns.render → Node`）。toast / notification 保持纯文本是安全纪律，不开 HTML 口子。
  - **尺寸（PanelSizing）**：所有浮层面板共享 `behaviors/popover.ts` 的 `PanelSizing` 类型（`width 固定（最高优先）/ minWidth / maxWidth / maxHeight`）与同名 data 属性 `data-icen-panel-width / data-icen-panel-min / data-icen-panel-max / data-icen-panel-max-height`（挂组件根；context-menu 等无宿主面板的走 `opts.sizing` 程序面，datatable 右键自动从宿主读）。共享解析 `readPanelSizing(el)` / `resolvePanelSizing(el, overrides)`（程序面 > 属性面）+ `sizingToLayout`（锚定布局）/ `applyPanelSizing(panel, sizing | null)`（自建面板内联；固定宽连带盖掉 CSS 侧 max-width；**带视口夹取**——宽一律夹到视口 −24px；**传 null 复位全部内联尺寸**，单例面板跨实例复用防串味，date-picker 即此用法）。布局侧 `side` 支持 `top/bottom/left/right`（左右侧自动翻转）。已接入：select / popover(openPopover) / dropdown / context-menu / date-picker / command-palette / modal / ai-composer 三弹层（`popoverSizing` opts > composer 根 data-panel-* > 内置默认）/ datatable 筛选与列显隐面板。新增浮层组件必须走此契约，禁止再写死宽高。
  - **事件（三层体系，`behaviors/events.ts`）**：①手势层——任意容器挂 `data-icen-gestures="click dblclick contextmenu longpress text-select swipe"`（空格分隔）即开通归一化 `icen:` 手势事件（click 与 dblclick 同开时单击延迟 220ms，双击到达即取消；位移 >5px 视为拖拽不派发；`swipe` = 滑动：icen-down→icen-up 位移 ≥48px 且主轴明确〔次轴 < 主轴 1/2〕派 `icen:swipe-left/right/up/down`，detail = 手势包络 + `{dx,dy}`，move 期判垂直滚动脉络〔次轴先行 12px〕则抬手不派横向，全程不 preventDefault，`pointercancel` 中止）；②协议层——全部 CustomEvent，`bubbles + composed + cancelable`；detail 契约全量登记在 `IcenEventMap`（onIcen 推断 / emitIcen 校验双侧同表，新增事件必须登记，拼错或 detail 不符编译期报错）；从 document 派发（如 `icen:ai-done`/`icen:ai-usage`）= 全局广播——传播路径只经 [document, window]，只有全局形态能收到（`within` 为普通元素时路径不经过它，收不到，要收广播用全局形态）；③策略层——`setEventPolicy(type, fn|null)` 只收五种手势事件（编译期收死），给事件注册全站默认行为，一处赋予/覆盖/禁用，`getEventPolicy`/`resetEventPolicies` 为对称读取/清空口（调试与热重载）。绑定层 `onIcen`：类型推断 + 选择器委托 + `{ within, signal, once }`，返回解绑函数；派生口 `emitIcen`（勿裸写 new CustomEvent）；`initGestures()` 幂等并返回销毁函数（`destroyGestures()` 同效），组件作者派发领域事件同样必须先在 `IcenEventMap` 登记。拖拽不在手势层（文件走 upload，排序/分割走组件自带）。
- **控件族（`behaviors/controls.ts`）**：纯 CSS 控件的行为承载统一在此（switch/checkbox/radio 三态、stepper、segmented、steps、rating、pagination、静态表 th[data-icen-sort] 排序），七 init 全部「document 委托 + 幂等 + 返回销毁」同款骨架；事件 `icen:switch-change / check-change / stepper-change / segmented-change / step-change / rating-change / page-change / sort-change`。slugs 映射走 SLUG_BEHAVIOR（segmented 同时带 input 的 initInput，kit 由 SLUG_EXPORTS 三项并存解决；controls 内转发 initInput 仅为 kit 服务，**根入口 index.ts 对 controls 用具名导出**——export * 会与 input 的 initInput 构成 ESM 歧义名被静默剔除）。
- **事件前缀纪律**：behavior 派发的自定义事件统一 `icen:` 前缀（如 tabs 的 `icen:tab-change`、upload 的 `icen:upload`）。otp 为兼容双发 `icen:otp-complete`（新）与 `otp:complete`（deprecated，下个大版本删）。
- **a11y**：所有可聚焦元素必须有 `:focus-visible` 环；状态变化必须同步 `aria-*`；modal/dialog 必须有 focus trap + ESC 关闭 + 焦点还原。
- **动效守卫**：所有动画/过渡在 `@media (prefers-reduced-motion: reduce)` 下压缩为 ~0ms；触屏（`pointer: coarse`）关闭 `:hover` 抬升；高对比度模式（`forced-colors: active`）保留焦点环。
- 新组件 = `src/components/<name>.css` 一个文件 + 文档站 components 页加一节；交互行为放 `src/behaviors/<name>.ts` 并配套 CSS 类契约。每个 CSS 头注释必须列出完整 DOM 契约。**新类名一律 `icen-` 前缀、新 data 钩子一律 `data-icen-*`、新事件一律 `icen:*` 并登记 IcenEventMap**——命名空间/事件/CSS 纪律由 `bun run guard` 强制（CI 红绿），新增违规无法合入。
- behaviors 全部 SSR 守卫（`typeof document === 'undefined'`），文本赋值用 `textContent`（禁 innerHTML），init 函数全部幂等（重复调用安全，通过 WeakSet/MarkedElement.__icen*Init 标记）。initTabs/initNav/initBackTop 等返回**销毁函数**（移除监听 + 复位幂等标记，销毁后可重新 init）。
- 函数式组件族（charts / datatable / ai 族 render*）：不写类契约，导出 `createX(el, opts) → handle`；render* 一律返回挂载元素（有生命周期的图表返回 ChartHandle）——「有生命周期返 handle、静态返容器元素」，写文档示例时勿再写 void。同样一文件 CSS + 文档页一节 + slugs.mjs 登记。datatable 右键菜单复用 context-menu，其依赖的额外 CSS 走 slugs.mjs 的 EXTRA_CSS（kit 入口自动带上）。
- **图表按需安装**：charts 细分为 11 个独立可安装的 kit 入口（`chart-line` / `chart-bar` / `chart-pie` / `chart-radar` / `chart-heatmap` / `chart-area` / `chart-stack` / `chart-gauge` / `chart-sparkline` / `chart-scatter` / `chart-calendar`）+ umbrella `charts`（一条 import 全拿）。**通用层（v0.8）**：`renderChart(el, spec)` 单一入口吃纯 JSON ChartSpec（type 别名归一 `normalizeChartSpec` / 自动选型 `inferChartType` / `data[]+dims` 任意维度 pivot / `format` 描述符替代回调——AI 调用层的直接底座）；交互委托 `icen:chart-hover（enter/move/leave）/click/dblclick/contextmenu`（detail 含 index/seriesIndex/seriesName/label/value/指针坐标，右键默认 preventDefault）+ 内置 tooltip（portal，`tooltip:false` 关）+ 图例点击切换系列（`icen:chart-legend-toggle`）；图例可见性统一由 renderChart 头部行（.icen-chart-head = 标题 + 小眼睛）控制——根 `data-icen-legend-hidden` 容器级 CSS 隐藏全部图型图例（`spec.legend=false` 定初值，事件 `icen:chart-legend-visibility`），图表体渲染进内层 .chart-body（底层渲染器按契约清空传入 el，头部不能同层）；多系列 line（调色盘）/ vbar（分组 `stacked` 堆叠）已内建，标记统一 `data-icen-chart-mark` + `data-icen-chart-*` 数据位。共享基座在 `charts.css`（.icen-chart / .icen-chart-legend / .icen-chart-labels / 调色盘），各类型专属样式在独立 `chart-<type>.css`；所有渲染函数仍在 `behaviors/charts.ts` 一个文件（tree-shake 友好）；调色盘扩展口 `registerChartTone(name, cssVar)`（注册第 7+ 档自定义 tone，主题层/消费方用，内置六档之外时必走它）。子类型 slug → charts 行为模块的映射走 slugs.mjs 的 **`SLUG_BEHAVIOR`**（key=子类型 slug，value='charts'），kit 入口按 `SLUG_EXPORTS` 只 re-export 该类型的渲染函数。
- 组件 slug 映射（css 合并文件 / init 函数名 / behavior 模块名）的单一事实源是 `scripts/slugs.mjs`——新组件必须在此登记；`scripts/build-css.ts` 据此生成 kit 一行入口（`dist/components/<slug>.mjs` = import css + re-export behavior，消费侧 `@icen.ai/ui/kit/<slug>`）与 registry.json 的 slugs 面，CLI（`dist/cli.mjs`，`bunx @icen.ai/ui add <slug>` 打印引入行，不拷贝源码）与文档站都消费它。`slugs.mjs` 的类型声明在 `slugs.d.mts`，加导出成员时两处同步改。behavior 与 slug 不同名的（如 segmented 的 OTP 由 input.ts 的 initInput 提供）在 `SLUG_BEHAVIOR` 登记映射、在 `SLUG_EXPORTS` 登记 re-export，kit 入口才能正确带出。
- **kit 的 Astro 陷阱**：kit 入口里的 css import 在 Astro 页面 `<script>`（client bundle）里会被摇掉——Astro 项目必须在布局 frontmatter 里引组件 CSS（accounts 已踩过）；Vite SPA / webpack 无此问题。文档站安装段已带此提示。
- **文档站客户端换页（ClientRouter）**：Docs 布局挂 `<ClientRouter prefetch />`，组件↔原语↔色彩↔各组件页之间为客户端换页（首页走 Base 布局，进出仍整页加载）。两条硬约定：① 页头/页脚 `transition:persist` 常驻，页头脚本经 `astro:after-swap` 对齐新页 active 并滑移导航墨条；② **页面级模块脚本（同 src 只评估一次）一律 `astro:page-load` 驱动**（首载 + 每次换页都触发），全局监听（onIcen 等）重入前先退订上一代；Docs 侧栏内联脚本用 `data-astro-rerun` 强制重跑（组开合记忆存 window 内存——客户端换页保留手动展开、真刷新归零回「全收 + 深链开组」）。新增页面脚本必须遵守，否则换页后接线断线。
- 文档站（`site/`）：站壳/代码块样式集中在 `site/src/styles/site.css`；可复用展示件在 `site/src/components/`（SiteHeader / SiteFooter / CodeBlock / PmInstall / ThemeRestore 防闪烁）；轻量语法高亮在 `site/src/lib/highlight.ts`（单行 token 化，`.tok-*` 颜色消费语义 token）。站顶 ⌘K 全站搜索 = 自家 command-palette 组件直出（条目由 `COMPONENTS` 生成），既是功能也是门面条 demo。
- **skill `icen-ui` 源在本仓库**（`skill/icen-ui/`，SKILL.md + 中英产品页）：只写 WHEN/WHICH 场景配方，不抄 API 签名（事实层在 AGENTS.md/.d.mts）。改完跑 `bun scripts/sync-skill.mjs` 单向同步到兄弟仓库 `../skill/skills/icen-ui/`（skill 仓库那份是产物，勿手改），在该仓库提交 push 后 CI 自动上 skill.icen.ai；`--check` 可挂 CI 防漂移。
- 文档站字体体系（site.css 顶部）：prose/站壳 = `--site-font-sans`（系统无衬线），demo 区 = `--site-font-mono`（Plex Mono + CJK 无衬线回退），展示级大标题才用 `--icen-font-heading` 宋体——小字号中文一律不走宋体/通用 monospace 回退。
- CSS 产物由 `scripts/build-css.ts` 生成，**不要手改 dist/**。`tokensExtras`（如 retro-effects.css）单独拷贝、暴露 exports，**不**进 `tokens.css`/`ui.css` 默认拼合。
- clay 的 12 基值 token 改动属于品牌级变更；新增内置主题 = 编辑 themes.json，再运行 bun run colors；运行时和站点自动读取目录，不维护重复名单。外部品牌仍可通过 createDesign 编译 CSS 或覆盖语义 token。
- 文档分组（`site/src/lib/components.ts` 的 `GROUPS`）= 侧栏顺序 = 索引页分组顺序：基础 / AI 原生 / 知识库 / 表单 / 数据展示 / 图表 / 浮层 / 反馈 / 导航（v0.9 调整：知识库上移第三位；v0.8：AI 上移第二位做拉新门面；「表格」并入数据展示；AI 组更名「AI 原生」）。侧栏分组为 `<details>` 折叠（可多开，首访全开，localStorage `icen.docs.icen-nav.groups` 记忆，深链自动展开当前组）。kb 族文档数据在 `site/src/lib/kb-docs-{ground-ingest,search-data,ops-agent,perm}.ts` 四片段（避免巨文件冲突），`components.ts` 统一 push 进 COMPONENTS；`/kb` 的参考标签数据在 `site/src/lib/kb-references.ts`（32 条文献锚点 + 发表时间——设计决策可回溯，升级时先回源头）。
- **反馈三件正交**：`toast`（瞬时 2.6s 右下角）/ `alert`（内嵌页面流）/ `notification`（持久右上角栈，工程级——进度通知/confirm Promise/多按钮/hover 暂停/倒计时/优先级置顶/已读未读/持久化/多容器 createNotificationCenter）——三者各司其职不互相替代；`copy` 是原地按钮反馈（区别于 toast 的全局通知）。JS 词表已统一为 `toast.success/error`（ok/err 为 deprecated 别名，下大版本删）
- **徽章三件正交**：`pill`（行内状态徽章，语义色）/ `tag`（中性展示标签，可选关闭按钮与选中态）/ `badge`（角标式数字/圆点，挂外层元素角上，外层需 `position: relative`）。
- **组件 v2 增强（0.5.0 全量升级）**：所有基础组件已达到工程级深度——
  - **select**：`data-icen-select-search` 可搜索过滤（支持 `data-icen-keywords` 辅助关键字 + 分组自动隐藏）、`data-icen-select-multiple` 多选（chips 显示 + `data-icen-select-max` 上限 + `.icen-select-clear` 清除钮）、`.icen-select-group` / `.icen-select-group-label` 分组、`.icen-select-empty` 无结果态。
  - **input**：`maxlength`/`data-icen-count` 字符计数器（接近上限转 warn、到顶转 error）、`data-icen-mask="###-####-####"` 输入掩码（`#` 数字 / `A` 字母 / `*` 任意，原始值存 `data-icen-raw-value`）、`data-icen-trim` blur 去空白、全局 IME 组合态安全（compositionstart/end 挂起处理）。OTP 单元格（segmented 族）的跳格/粘贴分摊也由 initInput 接管。
  - **upload**：`data-icen-upload-list` 开启文件列表（图片自动缩略图、大小格式化、单文件 × 移除）、`data-icen-max-size` / `data-icen-max-files` 校验、accept 类型校验、事件 `icen:upload` / `icen:upload-error` / `icen:upload-remove`。
  - **table**（静态表）：`--zebra` 斑马纹、`caption` 标题、`--sticky-col` + `.icen-col-fixed` 首列粘滞、`.icen-row-expand` 展开行、行状态色（`row-success` / `row-warning` / `row-error`）、列宽工具类（`.icen-col-narrow` / `.icen-col-wide` / `.icen-col-action`）。
  - **stat**：横向布局（`--horizontal`）、迷你 sparkline 槽（`.icen-stat-spark`）、SVG 进度环（`.icen-stat-ring`）、加载骨架态（`.is-loading`）、图标语义色变体（`.icen-icon--success/warning/error/info`）。
  - **empty**：类型预设（`--error` / `--404` / `--search` / `--maintenance` / `--network`）、`--illustrated` 渐变背景、`--inline` 内嵌模式。
  - **panel**：可折叠（`--collapsible` + `.is-collapsed`）、副标题（`.icen-panel-subtitle`）、平面变体（`--flat`）、强调变体（`--accent`）。
  - **slider**：带标签刻度（`.icen-slider-marks` + `.icen-slider-mark`）、拖拽值提示气泡（`.icen-slider-tooltip`）、渐变填充（`--gradient`）。
  - **card**：封面比例变体（`.icen-card-media--square/tall/wide`）、卡片网格（`.icen-card-group`）、卡片列表（`.icen-card-list`）、状态色边（`--success/warning/error`）、角标位（`.icen-card-badge`）。
  - **feedback**：环形进度（`.icen-progress-ring`）、条纹/渐变进度条（`--striped` / `--gradient`）、点阵/条形 spinner（`--dots` / `--bars`）、全屏遮罩（`.icen-spinner-overlay`）、骨架组合体（`.icen-skeleton-text-group` / `.icen-skeleton-media` / `.icen-skeleton-table`）、shimmer 波纹（`--shimmer`）、alert 增强（`.icen-alert-actions` / `--banner` / `--inline`）。
  - **switch**：色彩变体（`--success/warning/danger`）、带文字开关（`--text`）、开关行（`.icen-switch-row`）、单选卡片（`.icen-radio-card` + `.icen-radio-card-grid`）、复选网格（`.icen-checkbox-grid`）。
  - **tabs**：可关闭 tab（`.icen-page-tab-close`）、徽标（`.icen-page-tab-badge`）、图标（`.icen-page-tab-icon`）、分段式（`--segment`）、垂直（`--vertical`）、尺寸（`--sm/lg`）。
  - **nav**：搜索槽（`.icen-nav-search`）、通知徽标（`.icen-nav-btn-badge`）、链接式（`.icen-nav-link`）、用户区（`.icen-nav-user`）。
  - **sidebar**：头部/底部槽（`.icen-sidebar-header` / `.icen-sidebar-footer`）、折叠/轨道模式（`--collapsed`）、激活指示条、分隔线、徽章变体色。
  - **content**：列表增强（`.icen-list-item-leading/meta/trailing` + 选中/斑马）、时间线变体（右侧/交替/自定义尺寸/扩展内容槽）、描述列表变体（行内/垂直/可复制）、树增强（连接线 `.icen-tree--lined` + 搜索高亮）、代码块（`.icen-code-block`）、kbd 大号/按下态。
  - **media**：头像变体（语义色/渐变/方形/通知环）、头像组溢出计数、评分只读/清除/计数/摘要、轮播缩略图/索引/渐入。
  - **toast**：语义图标、关闭钮、富内容（标题+正文）、超时进度条、6 种容器定位。
  - **pill**：可关闭（`.icen-pill-close`）、图标、实时脉冲（`--live`）、纯数字（`--count`）、渐变（`--gradient`）。
  - **form**：水平字段布局（`--horizontal`）、表单区块（`.icen-form-section`）、操作区（`.icen-form-actions`）、行内表单（`--inline`）、字段网格（`.icen-form-grid`）、加载遮罩（`.icen-form-loading`）、label 帮助图标 / 可选标记。
- layout.css 已 token 化（0.6.0）：stack / divider / surface / grid 等布局工具类的间距全部消费 `--icen-density-space-*`，无写死 px。

## AI 组件族（v0.7 新增）

规格唯一事实源：`docs/spec/ai-native.md`（类名 / 导出签名 / 事件名以它为准）。11 个 slug 在文档站侧栏单列「AI」分组，排在导航之后：

- **清单与 CSS 合并**：ai-chat / ai-message / ai-reasoning / ai-composer → `ai-chat.css`；ai-tool-call / ai-subagent → `ai-tool.css`；ai-diff / ai-files → `ai-diff.css`；ai-todo / ai-context / ai-usage → `ai-panel.css`。6 个 behavior：ai-core（状态机 / 注册表 / 适配器 / 格式化 / svgIcon）、ai-chat、ai-composer、ai-tool、ai-diff、ai-panel，全部经 `src/index.ts` `export *`。
- **`.icen-ai-item` 基元**：行式 AI 条目的"基类"（icon / main / side 状态点+meta / detail），kind 与变体只覆盖局部变量 `--ai-item-tint` 等槽位、不改结构（`--btn-*` 继承模式的推广）；第三方 kind 的 tint 由 behavior 内联 `--ai-item-tint: var(--icen-token-<tint>)` 兜底。
- **7 态状态机**（一切 AI 条目共享，语义色与动画全库一致）：`.is-pending / running / streaming / approval / done / error / cancelled`；状态点 `.icen-ai-item-status` 纯 CSS 由 `.is-*` 驱动；**默认展开集**：chart kind / error / approval / 多模态回执首渲染自动展开，其余 kind 默认折叠（用户手动切换后策略不干预，data-ai-user-toggled）。
- **kind 注册表与 normalize 适配层**：组件只消费归一化 `AiToolCallModel` / `AiUsage` / `AiContentPart`，业界格式（OpenAI / Anthropic / AI SDK / AG-UI / MCP / 素朴）由 `normalizeToolCall` / `normalizeUsage` / `normalizeContentParts` 翻译；内置 kinds（shell/read/edit/write/rm/grep/glob/browser/search/fetch/mcp/skill/todo/plan/subagent/note），第三方 `registerAiKind()` 扩展；`inferKind` 从工具名推断。
- **标准化内容模型 `AiContent`**（v0.7.1，spec §10）：`string | AiContentPart[]`，部件族 text / image / audio / video / file / resource-link（url XOR data+base64 约定）；一套 parts 三处共用——renderAiMessage 消息渲染（多模态 + `.icen-ai-msg--error` 错误变体 + `stream()` 流式节点）、ai-tool 的 IO 区（MCP content 数组零改动进卡片，`normalizeContentParts` 兼容 MCP 的 `resource_link` 下划线形态）、ai-provider 传输（两族 wire 映射 + anthropic `cache_control` + role 'tool' 回灌）。估算器 `estimateTokens`（CJK ×0.6 + 其余 ÷4 + 媒体经验值）与 `contextEstimate`（下一轮上下文口径）在 ai-core；**`contextEstimate`（环口径）与 `auditor.summary()`（累计计费口径）语义不同，禁止混喂同一个环**。
- **事件族 `icen:ai-*`**（全部 bubbles）：send / stop / queue / dequeue / attach（钮选/粘贴/拖放三入口）/ copy / retry / approve / reject / diff-accept / diff-reject / todo-toggle / toggle / model-change / command / ref / usage（请求归一 usage）/ done（请求收尾：status/provider/model/usage/cost/error/durationMs/ttftMs——绑定层驱动事件）/ audit-clear；detail 见规格 §5。
- **`data-icen-density` 三档**：verbose / normal / summary（summary 隐藏 meta、默认折叠 reasoning、压淡 tool/system 消息，纯 CSS）。
- **ai-usage 双形态**：分段条 `renderAiUsage` + 上下文窗口环形指示器 `renderAiUsageRing`（点击弹出完整分解，弹层复用 icen-popover；状态档 <60% icen-accent / 60–85% warning / >85% error+脉冲）。配套 `renderAiAudit` 审计面板（totals + byModel + 最近条目，清除钮派 `icen:ai-audit-clear`）；`ai-context` 抽屉的 `model.audit` 自动渲染审计节（紧凑形态）。
- **ai-composer v2**（业界集大成）：底部工具条 = 模型切换（多 provider 分组 + 搜索 + 缓存失效提示，选中模型 context 自动喂给环的 total；无 context 显式清除不留陈旧值）+ 上下文环挂载点 + 附件 + 发送/停止；`/` 命令弹层（拦截执行不进消息流）；`@` 引用弹层（chip 分离渲染，textarea 不嵌 chip）；空输入 `↑` 取回历史，运行中 `↑` 取回排队消息。附件三入口：钮选 / textarea 粘贴文件 / box 拖放（`.is-dragover` 高亮）。API：setComposerModels / setComposerCommands / setComposerRefs / setComposerUsage / bindComposer。
- **绑定层 `bindComposer`**（v0.7.1，spec §11，「零接线全链路」）：事件驱动把 composer ↔ 消息区（renderAiMessage）↔ client（stream + 停止 + 排队自动续发 + 错误 → setError/fail）↔ 用量环（`usage.from: 'context'` 默认正确口径 | `'billing'` | AiAuditor）接成闭环；运行态自动管理（send→running / icen:ai-done→解除）；不传 client 为纯状态绑定（渐进采用）；重复绑定 WeakSet 防护，unbind 解绑。
- **ai-provider 适配层**（`src/behaviors/ai-provider.ts`，无 UI 不占 slug）：注册表内置 openai/claude/deepseek/glm/kimi 五家（`registerAiProvider`/`getAiProvider` 注册与读取第三方/自建网关；baseURL 可自定义，models 携带定价表——`estimateCost` 未命中返回 undefined 不猜价），`createAiClient` 填 key 即用（chat + stream 双族线协议，多模态 parts 传输：openai 族 image_url/input_audio/file_id、anthropic 族 image/audio/document(pdf) + `cacheControl` 断点 + role 'tool' 的 tool_result 回灌；video 两族诚实报 unsupported），usage 走 normalizeUsage 归一（含各家缓存字段），`createAiAuditor` 环形审计（条目含 cost 定价估算 + ttftMs 首 token 延迟；`summary()` 喂环 / `totals()` 喂审计面板 / `byModel()` 分组），每次请求派 `icen:ai-usage` 与 `icen:ai-done` 事件。浏览器直连：claude 官方支持（自动带直连头），openai 官方禁止，其余三家建议代理（browserDirect 字段诚实标注）。
- **AI 工具体系（v0.8，`src/behaviors/ai-tools.ts`，不绑定 slug）**：UI 能力注册为模型可调用的 AiToolDef（内置 render_chart（inputSchema=ChartSpec）与 render_datatable（columns+rows → createTable 可搜索/分页/可导出））；createAiToolArea 挂载区三层控制（不 import=无 / 白名单+max LRU 淘汰最旧挂载 / 运行时 setTools·setMax·clear）；`AiToolDef.present: 'mount'|'data'`（data=不占挂载位，记录与事件照常，run 返回值即结果）；执行契约 `run(input, mount, ctx)`：`ctx:{signal,progress(line)}`、允许 Promise 结果、`timeoutMs`（超时→`{ok:false,error:{code:'timeout'}}`，只作用 Promise 型 run）、`requiresApproval`（审批区→icen:ai-tool-approve 才执行 / -reject 置 .is-cancelled）、`idempotent`（同名同输入在途复用同一记录）；`validateToolArgs` 诚实校验（不支持的关键字进 unvalidated 清单，不猜不静默），area.call 的 `validate` 默认开；注册面 `registerAiTool`·`unregisterAiTool`（联动摘除各区域已挂载卡）·`getAiTool`·`listAiTools`；模型侧导出四族共享归一管线 aiToolsToOpenAI/aiToolsToAnthropic/aiToolsToMcp/aiToolsToAiSdk（不 execute，宿主侧挂载）+ aiToolsManifest + parseAiToolArgs；失败统一信封 `record.icen-result={ok:false,error:{code}}`，事件 error 字段保持 string 契约；工具回执内嵌图（**仅 output**；input 是机器参数保持 JSON）→ renderAiToolCall IO 区直接 renderChart；待办业界模式：TodoWrite 折叠卡（todo kind summarize x/y）+ `setComposerTodo` 输入区实时 chip（全完成/有失败图标反馈，点击弹层看清单）；事件 icen:ai-tool-call/-result/-evict/-approve/-reject。规格 §13。
- **ai-core 不绑定任何 slug**：demo/消费方要用 `normalizeToolCall` 等时，在该页 behaviors 数组里显式加 `'ai-core'`（boot 的 glob 会加载并注入 `aiCoreMod` 参数）。
- **宽度自稳定契约**：所有 AI 输出容器根（`.icen-ai-chat/.icen-ai-reasoning/.icen-ai-composer/.icen-ai-item/.icen-ai-tool/.icen-ai-subagent/.icen-ai-diff/.icen-ai-files/.icen-ai-todo/.icen-ai-usage`）声明 `align-self: stretch`——在 flex/grid 居中宿主（shrink-wrap 上下文，如文档站 `.demo-stage`）里不随内容多少改变宽度，流式内容只允许纵向生长。**禁用 `width: 100%`** 做这件事（在 shrink-wrap 父级下会塌成 min-content）。消费方给组件包一层自己的布局 wrapper 时，wrapper 的宽度由消费方负责（demo 里直接 `style="width:100%"`）。

## 知识库族（v0.9 新增）

规格唯一事实源：`docs/spec/kb-family.md`（顶层设计 / 类名 / 导出签名 / 事件名以它为准；调研底稿 `docs/research/2026-10-03-ai-kb-components.md` + `2026-10-03-kb-permissions.md`）。32 个 slug 在文档站侧栏「知识库」分组（第三位）；旗舰成品页 `/kb`（八标签工作台全真接线 + 参考文献锚点）。

- **心法**：ai 族描述思考（过程），kb 族呈现证据（知识从哪来 / 可信吗 / 怎么用）。CSS 根类 `.kb-*`，行为文件 `kb-*.ts`，事件 `icen:kb-*`（45 个全量登记 `IcenEventMap`，detail 契约编译期校验）。
- **契约层 `kb-core.ts`（无 UI 不占 slug）**：KbCitation（三型定位 char/page/block，unit 写死）/ KB_SCORE_KINDS + scoreHigherIsBetter + scorePercent（l2 自动反转，null→「—」）/ KbChunk / KbRunStatus 管线五态 / normalizeConnector + connectorHealth（4 离散信号，enabled≠healthy）/ segmentText + segmentStats / normalizeRetrievalParams / KbFilterNode + filterToMongo/filterToOData / KbEvalRow + evalGrade（improvement/regression/tradeoff/tie）/ KbCheckpoint + scope / KbSandboxMessage 等 40+ normalize 与格式化函数。**业务数据一律先过 normalize 再喂组件**；demo / 消费方要用契约时在该页 behaviors 数组显式加 `'kb-core'`。
- **CSS 布局**：共享基座 `kb.css`（.icen-kb-row 28/24 双密度、.icen-kb-num/.icen-kb-meta、.icen-kb-dot 四态、.icen-kb-score bar、.icen-kb-quote 证据线 + mark 分色 data-icen-hit 0/1/2、.icen-kb-badge 族、.icen-kb-chip、.kb-fold、.icen-kb-key、.icen-kb-empty、.icen-kb-notice、.icen-kb-layer-chip 过滤层徽标三态）+ 七域文件 kb-{ground,ingest,search,data,ops,agent,perm}.css。slugs.mjs 的 EXTRA_CSS 把每个 kb-* slug 映射到 `['kb.css', '<域>.css']`（kit 入口自动带上）；`kb` 总集 slug 带全部七域。新组件先进规格冻结 DOM 骨架再动手（权限域冻结在 §9）。
- **诚实呈现纪律（kb 族特有，评审必查，已由测试+守卫强制执行——spec §9.9 映射表）**：分数 null →「—」不猜；行数截断必须声明（「前 200 行」）；权限缺失打码 + 「申请访问」入口；重排关闭后列压淡不隐藏（显式禁用 > 静默消失）；检查点回滚范围显式（只回滚文件保留对话）；DSL 镜像只镜像可发送规则（无效规则不进 DSL）；`仅本次会话生效 / 入库` 二选一显式承诺。改行为先改 `tests/kb-conformance.test.ts` 预期；泄露文案模式由 `scripts/guard/kb-honesty.ts` 扫 `kb-*.ts` + `site/src/lib/kb-*.ts`（豁免：行尾 `guard:allow-honesty 理由`）。
- **分数条纪律**：`.icen-kb-score-bar` 是定宽轨道（域 CSS 内 `flex: 0 0 64px` 量级）+ `i` inline width 百分比——禁止让轨道随数值文本伸缩（曾导致 0.49 与 0.13 等长的失真）。
- **DOM 骨架与事件**：每个组件的冻结骨架与函数名在规格 §4/§5；`createX(el, opts) → handle`（含 destroy）、`renderX(el, data)` 快照渲染、`initX(root?)` document 委托幂等——与全库三契约（凹槽/尺寸/事件）同一心智。
- **/kb 工作台**（`site/src/pages/kb.astro` + `site/src/lib/kb-showcase.ts`）：mock 数据与接线全在 showcase 模块；八标签 = 问答 / 摄取 / 检索 / 问数 / 观测 / 权限 / Agent / 参考（参考为静态 SSR，数据在 kb-references.ts）。改 mock 数据只动 kb-showcase.ts；页面脚本遵守 `astro:page-load` 驱动约定。

## 图标与次要操作

- `behaviors/icons.ts` 是界面操作符号的唯一几何源：`createIcon` 返回真实 SVG DOM，`iconHTML` 输出安全 SSR 标记；消费方一行入口 `kit/icon`，不使用图标字体或 Unicode 字形代替操作图标。CSS 指示器用 `--icen-token-icon-*` masks，由 `scripts/icon-masks.ts` 同源生成，构建会重算。
- 所有图形采用 20×20 光学网格、1.6 线宽；图标默认 decorative，独立图标传 label。方向镜像由具体组件决定。自定义路径走 registerIcon，不允许覆盖内置符号。
- 次要操作可用 `.icen-icon-action[data-icen-reveal]`：固定槽位，父级 hover/focus-within 显现，触屏常显。不要隐藏主入口或重要状态；避免用宽度从 0 展开挤动正文。
- 可折叠面板用 `initPanel`，程序化更新用 `setPanelExpanded`；用户操作派 `icen:panel-toggle`。标题区保留真正的原生 button，其他标题操作不触发折叠。
- 全组件精修进度与尚待验证的矩阵见 `docs/interaction-polish.md`。全站文档基础巡检：build 后运行 `node scripts/audit-ui.mjs`，报告到忽略目录 `.ui-audit/`；它只提供基础证据，不替代展开状态的交互验收。
