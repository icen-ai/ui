# kb 族规格 —— 企业级 AI 知识库组件族（顶层设计）

> 单一事实源。实现与文档演示以本文 + `src/behaviors/kb-core.ts`（数据契约）+ `src/components/kb.css`（共享视觉基座）为准。
> 调研底座：`docs/research/2026-10-03-ai-kb-components.md`（业界最佳示例与市场空白）。

## 0. 定位与心智模型

```
通用原语（.btn/.table…）  →  造任何界面
ai-*（.ai-chat/.ai-tool…） →  AI 的过程：「AI 在做什么」（消息/思考/工具/用量）
kb-*（.kb-citation…）     →  知识的证据与资产：「知识从哪来、可信吗、怎么用」
chart-*                    →  图形层（ChartSpec 纯 JSON）
```

一句话：**ai 族描述思考，kb 族呈现证据。** 引用角标、解析管线、chunk、检索分数、SQL、trace——全部是「让知识工作可验证」的界面。

## 1. 设计原则（Apple 式直觉 → 本库落地）

1. **一屏一个主行动**：每个视图只有一个 accent 级操作（检索 playground 的「运行」、chunk 编辑器的「保存」）；其余动作沉为 ghost/图标钮。accent 是稀缺资源。
2. **证据是一等视觉元素**：数字一律等宽字体（`.kb-num`，tabular-nums）；引文一律引用体（`.kb-quote`，左侧 2px 证据线）；来源/分数/日期永不用装饰色——只用语义色与层级色（text / muted / faint）。
3. **渐进披露**：一切次要细节走「摘要行（状态徽章 + 时长/计数）+ muted 折叠体」两段式；摘要行承担状态机可视化；流式时展开、完成即折叠、用户展开过则不再自动收（与 ai-reasoning 同契约）。
4. **状态机先于样式**：每个组件先枚举状态（`.is-*` + `data-state`），UI 只是 state→(图标, 标签, 色阶, 动效) 的映射表。与 AI 族七态同构处直接复用语义。
5. **材料层级只用三档**：`--token-bg`（页面）→ `--token-bg-soft`（卡/行）→ 浮层（复用 popover/modal 的 portal 与 z 尺）。kb 族不自造阴影层级。
6. **直接操纵**：能拖就拖（分段边界、双栏比例）、能行内编辑就行内编辑（chunk/SQL/过滤值）、能悬停预览就悬停（引用卡 300ms 防抖）。点击做深度验证，悬停做即时判读。
7. **无死路**：每个失败态带重试（管线单文档重跑、SQL 一键修复）、每个空态带行动（无答案→建文档/加同义词、passages 空态→「引用段落将出现在这里」）。
8. **诚实呈现边界**：截断声明（结果表 LIMIT）、无分命中（score null → 「—」）、权限受限（chunk 打码 + 申请访问）、不可逆操作前置警告（换 embedding 需重建索引）。

## 2. 视觉音调（跨域一致性的硬约束）

- 尺寸节奏：行高 28px（.kb-row 默认）、区块间距 16px、组内 8px；密度 `data-density="compact|normal"`（compact 行高 24px）。
- 圆角：容器 `--radius-md`、行内元素（角标/chip）`--radius-sm` 或全圆。
- 字号：标题 13px/600、正文 13px、元信息 11.5px、徽标 10.5px；数字全部 `.kb-num`。
- 色彩角色（族内纪律）：
  - 证据域（ground）＝accent（引用是主角，但角标默认弱化为 faint，hover/激活才点亮）；
  - 过程域（ingest/search）＝中性行 + 状态色只给状态点与徽标；
  - 数字域（data）＝success 只表达「可信资产」（认证答案徽章），数字本身永远中性；
  - 治理域（ops）＝整体 muted，告警才 warning/error；
  - 工作台域（agent）＝运动感来自动效（120–240ms），不来自颜色。
- 动效：展开/折叠 160ms ease-out；流式脉冲 1.6s；`prefers-reduced-motion` 下全部退化为瞬时（走全局既有规则）。
- 图标：单色 stroke 1.5px 线性图标，尺寸 14px（行内）/16px（标题），一律经 `svgIcon()` 消毒。

## 3. 文件布局（镜像 ai 族/charts 族模式）

| 域 | CSS（自持） | behavior |
|---|---|---|
| 共享基座 | `components/kb.css`（.kb-row/.kb-num/.kb-score/.kb-quote/.kb-chip/徽标等，全部 kb slug 经 EXTRA_CSS 引入） | `behaviors/kb-core.ts`（类型 + 纯函数 + 注册表，无 UI 无副作用） |
| 证据 ground | `components/kb-ground.css` | kb-citation.ts / kb-sources.ts / kb-passage.ts / kb-conflict.ts |
| 摄取 ingest | `components/kb-ingest.css` | kb-pipeline.ts / kb-chunks.ts / kb-segment.ts / kb-connector.ts / kb-metadata.ts / kb-qa.ts |
| 检索 search | `components/kb-search.css` | kb-retrieval.ts / kb-filter.ts / kb-rerank.ts / kb-hittest.ts |
| 问数 data | `components/kb-data.css` | kb-sql.ts / kb-answer.ts / kb-clarify.ts / kb-explain.ts |
| 治理 ops | `components/kb-ops.css` | kb-trace.ts / kb-review.ts / kb-gap.ts / kb-eval.ts |
| 工作台 agent | `components/kb-agent.css` | kb-canvas.ts / kb-checkpoint.ts / kb-sandbox.ts / kb-chain.ts |
| AI 族增强 | ai-chat.css（追加）/ ai-panel.css（追加） | ai-threads.ts / ai-feedback.ts / ai-branch.ts + ai-chat.ts、ai-panel.ts 增强 |
| 图谱 | charts.css（追加）+ chart-graph.css | charts.ts 追加 renderGraph / renderMap |

## 4. slug 总表（kit/CLI 层）

`kb`（umbrella，= kb.css + 六域 css）、`kb-citation`、`kb-sources`、`kb-passage`、`kb-conflict`、`kb-pipeline`、`kb-chunks`、`kb-segment`、`kb-connector`、`kb-metadata`、`kb-qa`、`kb-retrieval`、`kb-filter`、`kb-rerank`、`kb-hittest`、`kb-sql`、`kb-answer`、`kb-clarify`、`kb-explain`、`kb-trace`、`kb-review`、`kb-gap`、`kb-eval`、`kb-canvas`、`kb-checkpoint`、`kb-sandbox`、`kb-chain`、`ai-threads`、`ai-feedback`、`ai-branch`、`chart-graph`。
全部 kb-* slug 的 EXTRA_CSS 含 `kb.css`；文档站新增分组「知识库」。

## 5. 组件契约（DOM 骨架 + API + 事件；函数名冻结）

约定：`render*` 快照渲染返回挂载容器；`create*` 返回带方法/销毁的句柄；`init*` 幂等标记驱动 + 返回销毁函数；渲染只写 textContent，SVG 过 svgIcon；事件走 emitIcen（契约登记 IcenEventMap），handle 回调与事件双通道。共享类型全部 import 自 `kb-core`（不重复定义）。

### 5.1 kb-citation 行内引用角标
```
<button class="kb-citation" data-cite="3" aria-describedby?>3</button>
```
- `parseInlineCitations(text)`（kb-core）把 `[3]` 文本切成段落流；`renderCitationMark(n)` 造角标。
- `initKbCitation(root?)`：委托 click → `icen:kb-citation-open {citation}`；hover ≥300ms 且配置了 `getCard`/sources 时经 popover portal 浮 `.kb-citation-card`（favicon/标题/域名/citedText≤150 字/日期/徽标/受限打码）。
- 无效编号（>来源数）降级为纯文本角标（`.is-dead`，不可点）——「不信任模型生成编号」纪律。

### 5.2 kb-sources 来源列表
```
<div class="kb-sources kb-sources--row|-rail">
  <button class="kb-source" data-kb-source-id>
    <span class="kb-source-icon">…svg…</span>
    <span class="kb-source-main"><span class="kb-source-title">…</span><span class="kb-source-sub">域名/类型 · 日期</span></span>
    <span class="kb-source-side">徽标组 + 被引 ×2</span>
  </button>…
</div>
```
- `renderKbSources(el, sources, opts?)`：useCount 排序、`onlyCited` 过滤、空态文案（passages 随流填充模式）。
- 徽标：official（accent 线框）/ fresh|stale（相对时间，stale 加 warning 点）/ restricted（锁 + 申请入口）。
- 事件：`icen:kb-source-open {source}`。

### 5.3 kb-passage 原文定位查看器
```
<aside class="kb-passage" hidden>
  <div class="kb-passage-head">标题 · 页码/位置 · <button data-kb-passage-close>×</button></div>
  <div class="kb-passage-body">原文…<mark class="kb-passage-hit">命中</mark>…<button data-kb-passage-expand>展开上下文</button></div>
</aside>
```
- `createKbPassage(el, opts)` → `{ open(citation|source), close(), highlight(terms), expand() }`。
- 定位按 kb-core `KbLocation` 三分型（char/page/block）；侧栏打开不打断对话；多命中分色（`data-hit="0|1|2"`）。
- 事件：`icen:kb-passage-jump {citation}`、`icen:kb-passage-close {}`。

### 5.4 kb-conflict 来源冲突组
```
<div class="kb-conflict"><div class="kb-conflict-claim">同一主张…</div>
  <div class="kb-conflict-versions"><div class="kb-conflict-ver [is-current|is-older]">版本卡（日期/来源/official）</div>…</div></div>
```
- `renderKbConflict(el, groups)`；`is-current` 高亮最新/官方，其余 faded + stale 徽标。市场空白组件。

### 5.5 kb-pipeline 解析管线时间线
```
<div class="kb-pipeline" data-document-id>
  <div class="kb-pipeline-head">标题 · <span class="kb-pipeline-state is-done|is-running|is-fail">…</span> · N chunks · <button data-kb-pipeline-rerun>重跑</button></div>
  <ol class="kb-pipeline-steps">
    <li class="kb-pipeline-step is-done|is-running|is-fail|is-queued">icon · 解析 · 12s · <span class="kb-step-detail">3 页/2 表</span></li>…
  </ol>
  <div class="kb-pipeline-error">阶段定位 + 原因</div>
</div>
```
- `renderKbPipeline(el, run|runs)`；`initKbPipeline(root?)` 委托展开（steps 折叠为摘要行）+ 重跑。
- 状态机：`unstart|queued|running|cancel|done|fail`（kb-core）；失败重跑粒度=单文档。
- 事件：`icen:kb-pipeline-toggle {el, open}`、`icen:kb-pipeline-rerun {documentId}`。

### 5.6 kb-chunks chunk 编辑器
```
<div class="kb-chunks">
  <div class="kb-chunks-bar">搜索（全文|语义 segmented）+ 新增</div>
  <div class="kb-chunk [is-off]">
    <label class="kb-chunk-switch"><input type="checkbox">启用</label>
    <div class="kb-chunk-content" contenteditable>…</div>
    <div class="kb-chunk-keywords">tag-input 式 chips</div>
    <div class="kb-chunk-meta">#3 · 第 2 页 · 向量就绪</div>
    <div class="kb-chunk-actions">删除</div>
  </div>…
</div>
```
- `renderKbChunks(el, chunks, opts?)`；`initKbChunks(root?)`：行内编辑、available 开关、删除、新增、双通道搜索。
- 事件：`icen:kb-chunk-toggle {chunkId, available}`、`icen:kb-chunk-edit {chunkId}`、`icen:kb-chunk-remove {chunkId}`、`icen:kb-chunk-add {documentId}`、`icen:kb-chunk-search {mode, query}`。

### 5.7 kb-segment 分段策略 + 实时预览
```
<div class="kb-segment">
  <div class="kb-segment-form">模式（auto/custom/parent-child）· 分隔符 · 最大长度 · 重叠 · 清洗勾选 · locked 警示</div>
  <div class="kb-segment-preview"><div class="kb-segment-stats">N 段 · 均长 x · ≈y tokens</div><div class="kb-segment-block">…</div>…</div>
</div>
```
- `createKbSegment(el, { config, sample, onChange })` → `{ getConfig(), setConfig(), refresh(sample?) }`；预览走 kb-core `segmentText` 纯函数（真实切分非估算）；模式锁定（locked）时表单禁用 + 提示。
- 事件：`icen:kb-segment-change {config}`。

### 5.8 kb-connector 连接器卡
```
<div class="kb-connector is-healthy|is-stale|is-failing|is-off">
  头：图标 · 名称 · scope · 同步计划
  信号行（4 离散信号）：状态点 · 已同步 N · 抓取率 · 变更率 · 凭证
  操作：立即同步 · 重新授权 · 编辑计划
</div>
```
- `renderKbConnectors(el, connectors)`；`initKbConnectors(root?)`。
- 健康判定用 kb-core `connectorHealth`（Glean 模型：enabled≠健康，24h 停滞=stale，抓取失败/凭证过期=failing）。
- 事件：`icen:kb-connector-sync {connectorId}`、`icen:kb-connector-reauth {connectorId}`、`icen:kb-connector-schedule {connectorId, schedule}`。

### 5.9 kb-metadata 元数据管理
- `renderKbMetadata(el, { fields, values })`：字段定义表（类型徽标 string/number/time）+ 绑定值编辑 + 内置字段只读。
- 事件：`icen:kb-metadata-change {action: 'define'|'bind'|'remove', key}`。

### 5.10 kb-qa QA 对编辑器
- `renderKbQa(el, rows, opts?)`：Q/A 两列表格 + 行内编辑 + 模板导入入口。
- 事件：`icen:kb-qa-change {op: 'add'|'edit'|'remove', index}`、`icen:kb-qa-import {source}`。

### 5.11 kb-retrieval 检索 playground
```
<div class="kb-retrieval">
  <div class="kb-retrieval-bar">query 输入 · 模式 segmented（向量|关键词|混合）· topK stepper · alpha 滑杆 · rerank 开关 · 运行(btn-primary)</div>
  <div class="kb-retrieval-params-text">可复制参数 JSON（DSL 双表示纪律）</div>
  <div class="kb-hit"><div class="kb-hit-rank">1</div><div class="kb-hit-main">标题 · <mark>命中</mark>…</div>
    <div class="kb-hit-score">score bar + 值 + explain</div></div>…
</div>
```
- `createKbRetrieval(el, { params, onRun })` → `{ getParams(), setParams(), renderHits(hits), setBusy() }`。
- 分数纪律（kb-core）：score 可 null →「—」；必须带 scoreKind；l2 反向；explain 有则显示拆解（向量分/关键词分）。
- 阈值滑杆联动「存活 N 条」；混合权重双端文案（语义：跨语言/无精确词 ↔ 关键词：大库快速精确）。
- 事件：`icen:kb-retrieval-run {query: KbRetrievalQuery}`。

### 5.12 kb-filter 过滤器构建器
- `createKbFilter(el, { node, onChange })` → `{ get(), set(), serialize() }`；行式 rule（字段/操作符/值）+ AND/OR 组嵌套（≤2 层）+ DSL 文本镜像（可复制，mono）。
- 序列化走 kb-core `filterToMongo` / `filterToOData`。
- 事件：`icen:kb-filter-change {valid}`。

### 5.13 kb-rerank rerank A/B 对比（市场空白）
```
<div class="kb-rerank">
  <div class="kb-rerank-col">before 列表</div><div class="kb-rerank-col">after 列表</div>
  每行：rank + ↑3/↓2/—（kb-rerank-delta is-up|is-down）+ 双分数
</div>
```
- `renderKbRerankCompare(el, { before, after, model? })`；稳定 key join。
- 事件：`icen:kb-rerank-toggle {enabled}`。

### 5.14 kb-hittest 召回测试集
- `createKbHitTest(el, { cases, onRun })`：问题列表（新增/固定 pin/删除）+ 逐题命中 ✓/✗ + 命中率/均分统计（`renderKbHitStats`）+ 参数快照徽标「仅本次会话生效」。
- 事件：`icen:kb-hittest-add {question}`、`icen:kb-hittest-run {}`。

### 5.15 kb-sql 生成 SQL 卡片
```
<div class="kb-sql">
  <div class="kb-sql-head">标题 · 可见性徽章（admin）· 引用表 chips · 复制/编辑重跑</div>
  <pre class="kb-sql-code">…highlightSql 生成的着色 token…</pre>
  <div class="kb-sql-fix">v1↔v2 diff（复用 parseUnifiedDiff）+ 一键应用</div>
</div>
```
- `renderKbSql(el, query, opts?)`；`initKbSql(root?)`；导出纯函数 `highlightSql(sql): Node`（零依赖关键词/字符串/注释着色）。
- 修正 diff：`prevSql` 存在且报错时展示修复建议（「修复已就绪」心智）；编辑态切 textarea。
- 事件：`icen:kb-sql-edit {sql}`、`icen:kb-sql-rerun {sql}`。

### 5.16 kb-answer 问数答案容器
```
<article class="kb-answer">
  <div class="kb-answer-badges">认证徽章（trusted，命中资产说明 + 参数可改重跑）/ 权限提示</div>
  <div class="kb-answer-body">答案（可含 kb-citation 角标）…</div>
  <div class="kb-answer-clarify">…kb-clarify…</div>
  <div class="kb-answer-explain">…kb-explain 折叠…</div>
  <div class="kb-answer-results">结果表（datatable）+ 截断声明 + 导出</div>
  <div class="kb-answer-chart">图表 + 类型切换 + 追问改图</div>
</article>
```
- `renderKbAnswer(el, model)` 组合渲染；认证优先于生成的徽章逻辑；`permissionNotice` 行级/脱敏提示。
- 事件：`icen:kb-verified-open {assetId}`。

### 5.17 kb-clarify 澄清反问卡
- `renderKbClarify(el, clarification)`：问题 + 选项 chips（点选非打字）+ reason 弱化说明；回答后回显「已解析：含税口径」。
- 事件：`icen:kb-clarify-answer {id, value, label}`。

### 5.18 kb-explain 口径解释面板
- `renderKbExplain(el, model)`：实际查询要素（表/列/筛选/聚合 chips）+ 指标口径深链 + 摘要指令说明；折叠式。
- 事件：`icen:kb-explain-toggle {el, open}`。

### 5.19 kb-trace trace 树
```
<div class="kb-trace"><div class="kb-span is-<kind> [is-open]" data-span-id style="--depth:1">
  <span class="kb-span-caret"></span><span class="kb-span-kind">检索</span><span class="kb-span-name">hybrid search</span>
  <i class="kb-span-bar" style="width:34%"></i><span class="kb-num">212ms</span></div>…</div>
```
- `renderKbTrace(el, spans)`；`initKbTrace(root?)`：嵌套缩进（--depth）、时长条按兄弟占比、retrieval span 内嵌 hits 迷你列表（复用 .kb-hit）、io 折叠。
- 事件：`icen:kb-trace-select {spanId}`、`icen:kb-trace-toggle {spanId, open}`。

### 5.20 kb-review 标注队列
- `createKbReview(el, { queue, configs })`：队列列表（分配人/状态）+ 逐条审查卡（rubric 行，categorical 1-9 数字键、numeric 0-100 滑杆）+ 全键盘流（←→ 切条目、Cmd/Ctrl+Enter 完成前进、? 快捷键提示）。
- 事件：`icen:kb-review-score {taskId, name, value}`、`icen:kb-review-submit {taskId}`、`icen:kb-review-assign {taskId, assignee}`。

### 5.21 kb-gap 无答案分析
- `renderKbGap(el, model)`：零结果 Top 表（次数/占比/零点击交叉）+ 每行行动（建文档/加同义词）+ 趋势 sparkline 位。
- 事件：`icen:kb-gap-action {query, action: 'create-doc'|'add-synonym'}`。

### 5.22 kb-eval 评估对比表
- `renderKbEvalCompare(el, { rows, runs })`：delta 列（is-up 绿/is-down 红）、字符级 diff（内联）、Summary 判级徽章（improvement/regression/tradeoff/tie，kb-core `evalGrade`）。
- 事件：`icen:kb-eval-compare {runA, runB}`。

### 5.23 kb-canvas 双栏工作台（P2）
- `createKbCanvas(el, opts)` → `{ setChat(el), setDoc(el), addDiff(files), addVersion(v), destroy() }`：左右双栏（比例拖拽复用 split-pane 心智）+ 内联 diff 挂载（ai-diff 复用）+ 版本时间轴 + 划词工具条（选中文本 → icen:text-select 手势 → 弹 AI 操作菜单：改写/补引用/总结）。
- 事件：`icen:kb-canvas-ai {instruction, selection?}`、`icen:kb-canvas-version {versionId}`。

### 5.24 kb-checkpoint 检查点（P2）
```
<button class="kb-checkpoint" data-checkpoint-id>时钟icon · 14:32 · 批量改写前</button>
```
- `renderKbCheckpoints(el, items)`；`initKbCheckpoint(root?)`：点击弹恢复菜单，scope 三选（内容/对话/两者）——默认「只回滚内容、保留对话」（Cursor 语义，审计友好）。
- 事件：`icen:kb-checkpoint-restore {checkpointId, scope}`。

### 5.25 kb-sandbox 沙箱工具容器（MCP Apps 对齐，P2）
- `createKbSandbox(el, opts)` → `{ load(uri|html), call(name, args): Promise, destroy() }`：`<iframe sandbox="allow-scripts" class="kb-sandbox-frame">` + postMessage JSON-RPC 2.0 双向桥（`app.callServerTool` / `app.updateModelContext` 语义）；loading/err 态；通信可记录（onMessage 回调）。
- 事件：`icen:kb-sandbox-message {channel, payload}`。

### 5.26 kb-chain 工具链条
```
<div class="kb-chain"><span class="kb-chain-step is-done">检索</span><i class="kb-chain-link"></i><span class="kb-chain-step is-running">重排</span>…</div>
```
- `renderKbChain(el, steps)`；横向摘要条（与 ai-tool-call 单卡互补）；点击 step → `icen:kb-chain-step {index, step}`。

### 5.27 AI 族增强（不新增视觉域，挂 ai-chat.css / ai-panel.css）
- `ai-threads`：`renderAiThreads(el, {items, activeKey, groupable})` + `initAiThreads` —— 会话列表（时间分组可折叠、激活高亮、归档、每项动作菜单挂载点）。事件：`icen:ai-thread-select {key}`、`icen:ai-thread-action {action, key}`。
- `ai-feedback`：`renderAiFeedback(el, {reasons})` + `initAiFeedback` —— 👍/👎 + 踩后原因枚举 chips + 已提交态。事件：`icen:ai-feedback {value: 1|-1|0, reason?}`。
- `ai-branch`：`renderAiBranch(el, {index, count})` + `initAiBranch` —— ‹ 2/3 › 分支切换。事件：`icen:ai-branch-change {index, count}`。
- ai-chat.ts 增强：reasoning 自动收起契约（流式展开 → done 1s 后收起一次，用户手动展开过不再自动收）；aborted 保留部分内容 + 「继续生成」槽。
- ai-panel.ts 增强：usage 明细补 ttftMs/tokensPerSec/finishReason；todo 项补 plan 状态语义（pending 空心/running 脉冲/done 描边勾已有七态，补 SVG 描边勾动画类）。

### 5.28 chart-graph / renderMap（P2）
- `renderGraph(el, spec)`：力导向 node-link（Leiden 簇着色、度中心性定尺寸 10–150→收敛为 8–36px、拖拽、点击节点返回实体卡数据）、`ChartSpec {type:'graph', nodes[], edges[], clusters?}`；`renderMap(el, spec)`：embedding 2D 散点（簇色、点选回 chunk、复用 scatter 交互）挂 chart-scatter 导出。

## 6. 事件登记（IcenEventMap，全部 `icen:kb-*` / 新增 `icen:ai-*`）

见 `src/behaviors/events.ts` 的「知识库族」段（detail 契约与上表一一对应；kb-core 类型为源）。

## 7. 性能与自定义纪律

- 渲染：textContent-only；SVG 过 svgIcon；流式路径 append-only（不整树重建）；数据快照切换才允许整段重建。
- 交互：init* 幂等 + 销毁函数；document 级委托；滚动/指针监听 passive；拖拽 rAF 批处理。
- CSS：无 JS 依赖的纯样式状态优先（.is-* 驱动）；动效 ≤240ms；不引第三方字体/图标。
- 自定义：`registerKbSourceType(kind, {label, icon})`（来源类型开放注册，镜像 registerAiKind）；每组件暴露 `--kb-*` 微调变量与 `data-density`；渲染槽位（opts.renderCard / renderHit 等）+ 事件/handle 双通道；浮层一律走 popover 的 PanelSizing。
- kit：`bunx @icen.ai/ui add kb` 一条拿到全家；域级 slug 自持（EXTRA_CSS 只补 kb.css）。

## 8. 验收

- `bun run build` 绿（tsc + tsup + dts-ext + build-css assertSrc）；`kit/kb-citation` 等 27 个新 kit 入口可独立安装。
- 文档站：新增「知识库」分组（每组件 API + demo 页）+ `/kb` 最佳实践工作台页（问答+引用溯源 / 摄取管线 / 检索调试 / 问数 / 观测 / Agent 工作台 全流程演示）。
- AGENTS.md / README / CHANGELOG 同步。
