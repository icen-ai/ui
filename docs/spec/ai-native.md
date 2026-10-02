# AI 原生组件族 · 设计规格（v0.6.x 新增）

> 唯一事实源。施工代理按此文件执行，不得偏离契约（类名 / 导出签名 / 事件名）。
> 设计调研依据：AG-UI 协议、Vercel AI SDK UIMessage parts、OpenAI/Anthropic wire 格式、
> MCP tools schema、A2A Task 状态；产品侧 Claude Code / Kimi Code / Cursor / Copilot / Codex 的已标准化模式。

## 0. 设计原则

1. **继承用 CSS 变量级联实现**：`.ai-item` 基元定义 `--ai-item-*` 局部变量，kind/变体只覆盖变量不改结构（btn.css 的 `--btn-*` 模式的推广）。
2. **多态用 kind 注册表**：MCP、skill 不是独立组件，是 tool-call 的 kind。`registerAiKind()` 开放第三方扩展。
3. **组件只消费归一化模型**：业界格式（OpenAI / Anthropic / AI SDK / 素朴）由适配层统一翻译，组件不认识任何 provider。
4. **状态机是唯一语言**：所有 AI 条目共享 7 态，语义色与动画全库一致。
5. 遵守库全部既有纪律：token 消费 / `.is-*` 状态 / aria 等价 / SSR 守卫 / 幂等 init / 禁 innerHTML（SVG 走 `svgIcon()` 消毒解析）/ 事件 `icen:ai-*` 前缀 / 浮层 z 标尺。

## 1. 状态机（一切 AI 条目共享）

```
pending → running → streaming → done
   │          │          │
   └→ approval（待人确认，HITL）   ├→ error
   └→ cancelled ←──────────┘
```

| 状态 | 类 | 视觉 |
|---|---|---|
| 等待 | `.is-pending` | faint 空心点 |
| 执行中 | `.is-running` | accent 脉冲点 |
| 流式中 | `.is-streaming` | 流式光标（▍闪烁，`animate-blink` 复用） |
| 待人确认 | `.is-approval` | warning 色 + 内联 允许/拒绝 按钮 |
| 完成 | `.is-done` | success 对勾 |
| 失败 | `.is-error` | error 色，失败条目**自动展开**（Copilot 模式） |
| 已取消 | `.is-cancelled` | faint + 删除线标题 |

协议映射：AI SDK `input-streaming/input-available`→pending、`approval-requested`→approval、`output-available`→done、`output-error`→error；AG-UI `TOOL_CALL_RESULT`→done、`outcome.interrupt`→approval；A2A `INPUT_REQUIRED/AUTH_REQUIRED`→approval、`WORKING`→running、终态→done/error/cancelled。

## 2. 条目基元 `.ai-item`（CSS 骨架，所有行式条目的"基类"）

```html
<div class="ai-item is-running" style="--ai-item-tint: var(--token-accent)">
  <span class="ai-item-icon"><!-- svg --></span>
  <div class="ai-item-main">
    <div class="ai-item-title">一行摘要</div>
    <div class="ai-item-sub">次要信息（路径/参数）</div>
  </div>
  <div class="ai-item-side">
    <span class="ai-item-status"></span>   <!-- 状态点，纯 CSS 由 .is-* 驱动 -->
    <span class="ai-item-meta">1.2s</span>
  </div>
  <div class="ai-item-detail" hidden>展开详情</div>
</div>
```

局部变量：`--ai-item-tint`（图标/状态点着色槽，默认 accent）。状态点 `.ai-item-status` 是纯 CSS 圆点，由 `.is-*` 决定颜色与动效（running 脉冲用 `--pill-pulse-duration` 同款变量化时长）。

## 3. 文件与 slug 组织

### CSS（4 个文件，MERGED_CSS 登记）

| 文件 | 服务 slug |
|---|---|
| `src/components/ai-chat.css` | `ai-chat` `ai-message` `ai-reasoning` `ai-composer` |
| `src/components/ai-tool.css` | `ai-tool-call` `ai-subagent` |
| `src/components/ai-diff.css` | `ai-diff` `ai-files` |
| `src/components/ai-panel.css` | `ai-todo` `ai-context` `ai-usage` |

### Behaviors（6 个文件，index.ts 全部 `export *`）

| 文件 | 导出 |
|---|---|
| `src/behaviors/ai-core.ts` | 状态机 / 注册表 / 适配器 / 格式化 / svgIcon（见 §6） |
| `src/behaviors/ai-chat.ts` | `initAiChat` `createAiStream` |
| `src/behaviors/ai-composer.ts` | `initAiComposer` |
| `src/behaviors/ai-tool.ts` | `initAiTool` `initAiSubagent` `renderAiToolCall` `renderAiSubagent` |
| `src/behaviors/ai-diff.ts` | `initAiDiff` `renderAiDiff` `parseUnifiedDiff` |
| `src/behaviors/ai-panel.ts` | `initAiTodo` `renderAiTodo` `initAiContext` `renderAiContext` `renderAiUsage` |

### slugs.mjs 登记（S4 执行）

- SLUGS 追加 11 个（新分组「AI」）：`ai-chat, ai-message, ai-reasoning, ai-composer, ai-tool-call, ai-subagent, ai-diff, ai-files, ai-todo, ai-context, ai-usage`
- MERGED_CSS：ai-message/ai-reasoning/ai-composer→`ai-chat.css`；ai-subagent→`ai-tool.css`；ai-files→`ai-diff.css`；ai-todo/ai-context/ai-usage→`ai-panel.css`
- SLUG_INIT：ai-chat→initAiChat, ai-composer→initAiComposer, ai-tool-call→initAiTool, ai-subagent→initAiSubagent, ai-diff→initAiDiff, ai-todo→initAiTodo, ai-context→initAiContext
- SLUG_BEHAVIOR：ai-message→ai-chat, ai-reasoning→ai-chat, ai-files→ai-diff, ai-usage→ai-panel（纯渲染/函数式的挂对应模块）
- SLUG_EXPORTS：ai-message/ai-reasoning→['createAiStream'] 等按实际补；函数式 slug 给渲染函数提示

## 4. 组件契约（类名固定，施工中不得改名）

### 4.1 ai-chat（ai-chat.css + ai-chat.ts）

```html
<div class="ai-chat" data-density="normal">   <!-- verbose|normal|summary 透明度三档 -->
  <div class="ai-chat-scroll">
    <div class="ai-msg ai-msg--user | ai-msg--assistant | ai-msg--system | ai-msg--tool">
      <span class="ai-msg-avatar"></span>
      <div class="ai-msg-body">…内容（消费方可自行渲染 markdown）…</div>
      <div class="ai-msg-actions"><button data-ai-msg-action="copy">…<button data-ai-msg-action="retry">…</div>
      <div class="ai-msg-meta">12:04 · 1.2k tok</div>
    </div>
  </div>
  <button class="ai-chat-jump" hidden>回到底部 · 3 条新消息</button>
</div>
```

- `initAiChat(root?)`：幂等（`__icenAiChatInit`）。滚动钉底：scroll 监听，贴底时自动跟随新内容（监听 scroll 容器尺寸变化用 ResizeObserver）；用户上滚暂停跟随并显示 `.ai-chat-jump`（带未读计数），点击回底恢复。消息动作委托：copy→复制正文+派 `icen:ai-copy`；retry→派 `icen:ai-retry`（detail 含消息元素）。reasoning 折叠委托也在这里（`.ai-reasoning-head` 点击切换）。
- `createAiStream(el)` → `{ append(text), done(), cancel(), fail(message?) }`：textContent 级追加（不解析 HTML），追加期间宿主挂 `.is-streaming`，done/cancel 移除；`fail()` 终止流并给宿主挂 `.is-error`（错误路径，append 之后失效）。Markdown 重渲染是消费方职责（文档里写明）。
- `renderAiMessage(scrollEl, model)` → `{ el, body, setMeta, setError, stream() }`：DOM API 构建整条消息（含多模态部件渲染，见 §10），返回句柄；`stream()` 在正文末尾开 `createAiStream`。model：

```ts
interface AiMessageModel {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: AiContent;            // string | AiContentPart[]（§10）
  meta?: string;                 // "12:04 · 1.2k tok"
  model?: string;                // assistant 消息的模型名标签
  error?: string;                // → .ai-msg--error + 错误文本行
  streaming?: boolean;           // 初始即流式态
}
```

### 4.2 ai-message / ai-reasoning（ai-chat.css 一族）

```html
<div class="ai-reasoning is-done">
  <button class="ai-reasoning-head" aria-expanded="false">
    <span class="ai-reasoning-label">思考过程</span><span class="ai-reasoning-time">3s</span>
  </button>
  <div class="ai-reasoning-body" hidden>…</div>
</div>
```

流式中 `.is-streaming`：head 显示 shimmer「正在思考…」（动画时长走 `--ai-shimmer-duration` 局部变量）；完成自动折叠并显示耗时。**新 behavior 复用 ai-chat 的委托，不独立 init。**

### 4.3 ai-composer（ai-chat.css + ai-composer.ts）

```html
<div class="ai-composer" data-ai-composer>
  <div class="ai-composer-queue" hidden><!-- 排队消息 chips，可逐个 × --></div>
  <div class="ai-composer-attach" hidden><!-- 附件 chips --></div>
  <div class="ai-composer-box control">
    <textarea class="ai-composer-input" rows="1" placeholder="…"></textarea>
    <div class="ai-composer-actions">
      <button class="ai-composer-btn" data-ai-attach aria-label="附件"></button>
      <button class="ai-composer-send" data-ai-send></button>  <!-- 运行态变 .is-stop 停止钮 -->
    </div>
  </div>
</div>
```

- `initAiComposer(root?)`：autosize（上限 ~8 行后内滚）；Enter 发送 / Shift+Enter 换行 / IME 组合态安全（复用 input.ts 模式）；发送派 `icen:ai-send {text}` 并清空。
- **运行/停止态**：`setComposerRunning(el, bool)` 导出——运行中发送钮变停止钮（点击派 `icen:ai-stop`），此时输入不丢：回车转为入队（queue chip）并派 `icen:ai-queue {text}`；chip × 移除派 `icen:ai-dequeue {index}`。（queue / steer / stop 三动词分化，对齐 Cursor/Copilot 2026 模式）
- 附件钮打开 file input，选中文件生成 chip，派 `icen:ai-attach {files}`。

### 4.4 ai-tool-call（ai-tool.css + ai-tool.ts）

```html
<div class="ai-tool ai-tool--shell is-done">   <!-- kind 修饰类：--shell/--read/--edit/… -->
  <button class="ai-tool-head" aria-expanded="false">
    <span class="ai-item-icon"></span>
    <span class="ai-item-main"><span class="ai-item-title">Read</span>
      <span class="ai-item-sub">src/foo.ts:1-50</span></span>
    <span class="ai-item-status"></span>
    <span class="ai-item-meta">0.4s</span>
  </button>
  <div class="ai-tool-body" hidden>
    <div class="ai-tool-io"><div class="ai-tool-io-label">输入</div><pre class="ai-tool-io-content">…</pre></div>
    <div class="ai-tool-io"><div class="ai-tool-io-label">输出</div><pre class="ai-tool-io-content">…</pre></div>
    <div class="ai-tool-approval">   <!-- 仅 .is-approval 显示 -->
      <button class="btn btn-sm btn-primary" data-ai-approve>允许</button>
      <button class="btn btn-sm" data-ai-reject>拒绝</button>
    </div>
  </div>
</div>
```

- `initAiTool(root?)`：委托展开/折叠（head click + 键盘）；`.is-error` 条目首次渲染自动展开；approval 按钮派 `icen:ai-approve` / `icen:ai-reject`（detail `{id, kind}`）。
- `renderAiToolCall(el, model: AiToolCallModel)`：DOM API 构建整卡（流式场景用），返回 `{ el, update(patch) }`。
- kind 视觉：`ai-tool--<kind>` 覆盖 `--ai-item-tint` 与图标（注册表驱动）。内置 kinds：`shell read edit write rm grep glob browser search fetch mcp skill todo plan subagent note`。
- 展开动画：grid-template-rows 0fr→1fr 或 max-height 之外，用 `hidden` + 入场 `icen-pop-in`（简单可靠）。

### 4.5 ai-subagent（ai-tool.css + ai-tool.ts）

```html
<div class="ai-subagent is-running">
  <button class="ai-subagent-head" aria-expanded="false">
    <span class="ai-item-icon"></span>
    <span class="ai-item-main"><span class="ai-item-title">explore</span>
      <span class="ai-item-sub">搜索 auth 模块的所有入口</span></span>
    <span class="ai-item-status"></span>
    <span class="ai-item-meta">12.3s · 4 步</span>
  </button>
  <div class="ai-subagent-body" hidden>
    <div class="ai-subagent-stream"><!-- 嵌套 .ai-item / .ai-tool / .ai-reasoning 活动流 --></div>
    <div class="ai-subagent-result">完成回执摘要</div>
  </div>
</div>
```

- 嵌套流用**缩进 + 左侧引导线**表达层级（CSS 伪元素），可再嵌套子代理（递归）。
- `renderAiSubagent(el, model)`：model 含 `activities: AiToolCallModel[]`（复用 renderAiToolCall 渲染嵌套项——递归复用即"继承"）。
- 交互：点击 head 展开看细节（**用户明确要求比 kimi/codex 更优雅**——展开时活动项逐条 `icen-pop-in` 渐入）。

### 4.6 ai-diff（ai-diff.css + ai-diff.ts）

```html
<div class="ai-diff">
  <div class="ai-diff-file is-modified">   <!-- is-added/is-modified/is-deleted/is-renamed -->
    <div class="ai-diff-head">
      <span class="ai-diff-path">src/foo.ts</span>
      <span class="ai-diff-stat"><b class="ai-diff-add">+12</b> <b class="ai-diff-del">−4</b></span>
      <span class="ai-diff-actions">
        <button data-ai-diff-accept>接受</button><button data-ai-diff-reject>拒绝</button>
      </span>
    </div>
    <div class="ai-diff-body" hidden>
      <table class="ai-diff-table">
        <tr class="ai-diff-line--hunk"><td colspan="3">@@ -10,6 +10,8 @@</td></tr>
        <tr class="ai-diff-line--ctx"><td class="ai-diff-ln">10</td><td class="ai-diff-ln">10</td><td class="ai-diff-code">…</td></tr>
        <tr class="ai-diff-line--add">…</tr>
        <tr class="ai-diff-line--del">…</tr>
      </table>
    </div>
  </div>
</div>
```

- `parseUnifiedDiff(text)` → 结构化 hunks（纯函数，SSR 安全）；`renderAiDiff(el, {files})` DOM API 渲染（文本全 textContent）。
- `initAiDiff(root?)`：文件展开/折叠委托；accept/reject 派 `icen:ai-diff-accept` / `icen:ai-diff-reject`（detail `{path}`），点击后该文件标记 `.is-accepted` / `.is-rejected`。
- 长 diff 默认折叠只露 head；`.ai-diff--inline` 变体支持内联并排？——不做并排，保持 unified 单栏（范围控制）。

### 4.7 ai-files（ai-diff.css 一族，纯 CSS）

```html
<div class="ai-files">
  <span class="ai-file-chip is-added"><span class="ai-file-icon"></span>src/foo.ts</span>
</div>
```

chip 态：`is-added/is-modified/is-deleted` + hover 操作（可选）。无 behavior（文档说明）。

### 4.8 ai-todo（ai-panel.css + ai-panel.ts）

```html
<div class="ai-todo">
  <div class="ai-todo-head"><span class="ai-todo-progress">2/5</span><div class="ai-todo-bar"><i style="width:40%"></i></div></div>
  <div class="ai-todo-item is-running">
    <span class="ai-item-status"></span>
    <span class="ai-todo-text">实现登录页</span>
    <span class="ai-todo-active">正在实现登录页…</span>  <!-- activeForm：运行中替换文案（Claude Code 模式） -->
  </div>
</div>
```

- `renderAiTodo(el, items)`：`items: {content, status: AiStatus, activeForm?}[]`；`initAiTodo(root?)`：`data-ai-todo-interactive` 时可点击循环状态并派 `icen:ai-todo-toggle {index, status}`；默认只读。
- 进度条用 feedback 的 progress 视觉（token 消费）。

### 4.9 ai-usage（ai-panel.css + ai-panel.ts）

```html
<div class="ai-usage">
  <div class="ai-usage-bar">
    <i class="ai-usage-seg ai-usage-seg--input" style="width:35%"></i>
    <i class="ai-usage-seg ai-usage-seg--cache-read" style="width:20%"></i>
    <i class="ai-usage-seg ai-usage-seg--cache-write" style="width:5%"></i>
    <i class="ai-usage-seg ai-usage-seg--reasoning" style="width:10%"></i>
    <i class="ai-usage-seg ai-usage-seg--output" style="width:12%"></i>
  </div>
  <div class="ai-usage-legend"><!-- 各段色点+数值；缓存分列（计费诚实） --></div>
  <div class="ai-usage-total">82k / 200k · 41%</div>
</div>
```

- `renderAiUsage(el, usage: AiUsage, opts?: { total?: number; cost?: number })`：分段条 + 图例 + 占比；`normalizeUsage` 在 ai-core。
- 配色：input=accent、output=success、cacheRead=info、cacheWrite=warning、reasoning=faint——语义 token。
- **环形形态 `renderAiUsageRing`**（Claude Desktop 式上下文窗口指示器）：紧凑圆环（SVG dasharray，`viewBox 36 / r 15.9155` → 周长恰为 100），中心百分比；点击弹出完整分段分解（弹层为一次性动态 `.popover.ai-usage-popover`，复用 `openPopover`/`closePopover`，anchor 豁免外点关闭，Esc/外点/再点关闭即移除）。状态档：<60% is-ok（accent）/ 60–85% is-warn / >85% is-hot（error + 脉冲）。`--lg` 大号变体。

### 4.10 ai-context（ai-panel.css + ai-panel.ts）—— 右上角资源抽屉

```html
<aside class="ai-context" hidden>
  <div class="ai-context-head"><span>上下文</span><button data-ai-context-close>×</button></div>
  <section class="ai-context-section"><h3>用量</h3><!-- ai-usage --></section>
  <section class="ai-context-section"><h3>文件 (3)</h3><!-- ai-files chips --></section>
  <section class="ai-context-section"><h3>MCP (2)</h3><!-- server 行：名称+状态点+工具数 --></section>
  <section class="ai-context-section"><h3>Skills</h3><!-- skill chip 列表 --></section>
</aside>
```

- `initAiContext(root?)`：触发器 `[data-ai-context-open]` 全局委托开合；抽屉 fixed 右侧滑入（`--z-chrome`），Esc/外点关闭；`.ai-context--inline` 变体为页面流内嵌（不做 fixed）。
- `renderAiContext(el, { usage?, files?, mcpServers?, skills? })`：组合渲染（内部复用 renderAiUsage / ai-files chip / ai-item 行）。
- MCP server 行：`.ai-item` 基元 + `is-done`（已连接）/`is-error`（断开）。

## 5. 事件汇总（全部 bubbles）

| 事件 | detail | 来源 |
|---|---|---|
| `icen:ai-send` | `{text}` | composer 发送 |
| `icen:ai-stop` | `{}` | composer 停止 |
| `icen:ai-queue` / `icen:ai-dequeue` | `{text}` / `{index}` | 排队消息 |
| `icen:ai-attach` | `{files}` | 附件（钮选 / 粘贴 / 拖放共用） |
| `icen:ai-copy` / `icen:ai-retry` | `{el}` | 消息操作 |
| `icen:ai-approve` / `icen:ai-reject` | `{id, kind}` | 工具审批 |
| `icen:ai-diff-accept` / `icen:ai-diff-reject` | `{path}` | diff 审阅 |
| `icen:ai-todo-toggle` | `{index, status}` | 交互 todo |
| `icen:ai-toggle` | `{el, open}` | 通用条目展开/折叠 |
| `icen:ai-model-change` | `{provider, model, label, context}` | 模型切换（§8） |
| `icen:ai-command` | `{name, args}` | 斜杠命令（§8） |
| `icen:ai-ref` | `{action:'add'\|'remove', ref}` | @ 引用（§8） |
| `icen:ai-usage` | `AiUsage`（本次请求归一） | client 每次请求完成（§9） |
| `icen:ai-done` | `{status:'ok'\|'error'\|'cancelled', provider, model, stream, usage?, cost?, error?, durationMs, ttftMs?}` | client 每次请求收尾（chat 与 stream 的 finally；绑定层的驱动事件，§11） |
| `icen:ai-audit-clear` | `{}` | renderAiAudit 清除钮（§12） |

## 6. ai-core.ts 契约（S1 实现，其余 slice 消费）

```ts
export type AiStatus = 'pending'|'running'|'streaming'|'approval'|'done'|'error'|'cancelled';
export interface AiUsage { input?; output?; cacheRead?; cacheWrite?; reasoning?; total?; }
export interface AiKindDef { label: string; icon: string; tint?: 'accent'|'success'|'warning'|'error'|'info'|'muted'; summarize?: (input: unknown) => string; }
export interface AiToolCallModel {
  id: string; name: string; kind: string; status: AiStatus;
  input?: unknown; output?: unknown; errorText?: string;
  approval?: { reason?: string }; durationMs?: number; usage?: AiUsage;
  activities?: AiToolCallModel[];   // subagent 嵌套
}
export function aiStatusLabel(s: AiStatus): string;   // 中文：等待/执行中/流式中/待确认/完成/失败/已取消
export function registerAiKind(name: string, def: AiKindDef): void;
export function getAiKind(name: string): AiKindDef;   // 未注册回退 'note'
export function inferKind(toolName: string): string;  // Bash/Shell→shell, Read→read, mcp__*→mcp, 等
export function normalizeToolCall(raw: unknown): AiToolCallModel;  // OpenAI tool_calls 项 / Anthropic tool_use|tool_result block / AI SDK tool-* part / 素朴
export function normalizeUsage(raw: unknown): AiUsage;             // OpenAI usage / Anthropic usage / Gemini usageMetadata / 素朴
export function formatTokens(n: number): string;    // 1234 → "1.2k"
export function formatDuration(ms: number): string; // 1234 → "1.2s"
export function svgIcon(svg: string): SVGElement | null;  // DOMParser 消毒（剥 on* 属性与 script/foreignObject），SSR 返回 null
```

内置 kind 图标：内联 SVG 字符串常量（lucide 风格 24×24 stroke 图标，手写最简路径；terminal/file/file-pen/file-plus/file-trash/search/folder-search/globe/brain/list/bot 等）。

## 7. 施工分工（文件互斥，严禁越界改别的文件）

- **S1**：`src/behaviors/ai-core.ts` `src/behaviors/ai-chat.ts` `src/behaviors/ai-composer.ts` `src/components/ai-chat.css` `src/index.ts`（追加 6 个 ai 行为导出）
- **S2**：`src/behaviors/ai-tool.ts` `src/components/ai-tool.css`
- **S3**：`src/behaviors/ai-diff.ts` `src/behaviors/ai-panel.ts` `src/components/ai-diff.css` `src/components/ai-panel.css`
- **S4**（S1-S3 完成后）：`scripts/slugs.mjs` `site/src/lib/components.ts`（新分组「AI」+ 11 个交互 demo 条目）`AGENTS.md`（追加 AI 组件族约定）`README.md`（组件统计更新）

验证：各自 `bunx tsc --noEmit`（ui/ 根目录；node 需 `export PATH="/e/Env/Node/fnm/node-versions/v22.22.3/installation:$PATH"`）；不跑 `bun run build`（dist 冲突），统一由主代理构建。

---

## 8. ai-composer v2（输入台重做，2026 业界集大成）

结构（自底向上工具条，业界主流形态）：

```html
<div class="ai-composer" data-ai-composer>
  <div class="ai-composer-queue" hidden></div>   <!-- 排队 chips（v1 已有） -->
  <div class="ai-composer-refs" hidden></div>    <!-- @ 引用 chips（分离渲染：textarea 不嵌 chip） -->
  <div class="ai-composer-attach" hidden></div>  <!-- 附件 chips（v1 已有） -->
  <div class="ai-composer-box control">
    <textarea class="ai-composer-input" rows="1"></textarea>
    <div class="ai-composer-toolbar">
      <button class="ai-composer-model" data-ai-model-open>  <!-- 模型切换：provider 图标 + 模型名 + chevron -->
      <span class="ai-composer-spacer"></span>
      <span class="ai-composer-usage" data-ai-usage></span>   <!-- 上下文环挂载点 -->
      <button class="ai-composer-btn" data-ai-attach></button>
      <button class="ai-composer-send" data-ai-send></button>
    </div>
  </div>
</div>
```

新 API（全部可选配置，向后兼容 v1 契约）：

- `setComposerModels(el, providers: AiProviderOption[], current?: {provider, model})`：
  `AiProviderOption = { id, label, icon?, models: { id, label, context? }[] }`。
  工具条出现模型钮；点击开 `.ai-composer-popup`（portal body，`computePopoverLayout` side:top）——
  按 provider 分组（图标+名）+ 模型行（label + 上下文窗口如 `1M`）+ 搜索过滤 + 当前勾选。
  选择派 `icen:ai-model-change { provider, model, label, context }`；
  **切换时若 cacheRead 占比高则弹层内提示"换模型会使 prompt 缓存失效"**（Kimi Code 细节）。
  选中模型的 `context` 自动作为 `setComposerUsage` 的 total 默认值（闭环）。
- `setComposerCommands(el, commands: { name, description?, argsHint? }[])`：
  输入开头为 `/` 时弹层过滤；↑↓ 导航、Enter/Tab 选中、Esc 关；选中派 `icen:ai-command { name, args }`
  并清空输入（命令被拦截执行、不进消息流——业界共识）。
- `setComposerRefs(el, sources: { kind: 'file'|'folder'|'doc'|'agent', id, label, sub? }[])`：
  任意位置输入 `@` 触发弹层（分组按 kind + 图标）；选中后文本插入 `@label ` 且 refs chip 行 +1，
  派 `icen:ai-ref { action: 'add', ref }`；chip × 移除（同时删文本里首个 `@label`）派 `{ action: 'remove' }`。
- `setComposerUsage(el, usage, opts)`：工具条右侧挂 `renderAiUsageRing`。
- 历史：输入为空时按 `↑` 取回上一条已发送文本（会话内历史数组，每 composer 独立）。
- 运行态（v1 已有 queue/stop）补充：运行中按 `↑` 把最后一条排队消息取回输入框重新编辑（Claude Code 模式）。
- 弹层接管时键盘事件 preventDefault；IME 组合态安全（沿用 v1）。
- 图标对齐修复：工具条按钮统一 28px 方形、svg 14px 居中、gap 走 density token。

事件新增：`icen:ai-model-change` / `icen:ai-command` / `icen:ai-ref`（全 bubbles）。

## 9. ai-provider（provider 适配层：填入 key 即工作）

新文件 `src/behaviors/ai-provider.ts`（index.ts export）。调研依据：五家官方文档 + Vercel AI SDK openai-compatible 架构 + LiteLLM 映射思路。

### 9.1 注册表

```ts
export interface AiProviderModel { id: string; label: string; context?: number; outputLimit?: number; }
export interface AiProviderDef {
  id: string; label: string; icon: string;       // icon: 单色 svg 字母章（svgIcon 消毒）
  baseURL: string;                                // 默认，可覆盖（自定义 BaseURL 是一等公民）
  chatPath: string;                               // /chat/completions | /messages
  wire: 'openai' | 'anthropic';
  auth: 'bearer' | 'x-api-key';
  extraHeaders?: Record<string, string>;          // 如 anthropic-version / dangerous-direct-browser-access
  models: AiProviderModel[];
  /** 浏览器直连 CORS：'yes'（Anthropic 官方支持）/ 'no'（OpenAI 官方禁止）/ 'unknown'（DeepSeek/GLM/Kimi 无承诺，建议代理） */
  browserDirect: 'yes' | 'no' | 'unknown';
}
export function registerAiProvider(def: AiProviderDef): void;   // 第三方/自建网关注册入口
export function getAiProvider(id: string): AiProviderDef | undefined;
export function listAiProviders(): AiProviderDef[];
```

内置五家（2026-10 调研值）：
- openai：`https://api.openai.com/v1`，wire openai，browserDirect 'no'；模型 gpt-5 / gpt-5-mini / gpt-5.1 / gpt-5.5 等
- claude：`https://api.anthropic.com/v1`，wire anthropic，browserDirect 'yes'（自动带 anthropic-version + anthropic-dangerous-direct-browser-access）；claude-opus-5-5 / claude-sonnet-5-5 / claude-fable-5-1 / claude-haiku-4-5
- deepseek：`https://api.deepseek.com/v1`，wire openai，'unknown'；deepseek-flash / deepseek-v4-pro（1M ctx）
- glm：`https://open.bigmodel.cn/api/paas/v4`，wire openai，'unknown'（API key 直接当 Bearer；JWT 可选不做）；glm-5.3 / glm-5.3-flash / glm-5.2 / glm-4.6
- kimi：`https://api.moonshot.cn/v1`，wire openai，'unknown'；kimi-k3（1M）/ kimi-k2.7-code / kimi-k2.6

### 9.2 客户端

```ts
createAiClient({
  provider: string,          // 注册表 id
  apiKey: string,
  baseURL?: string,          // 覆盖默认（自定义网关/代理）
  model?: string,            // 默认取 provider.models[0]
  onAudit?: (entry: AiAuditEntry) => void,
  auditor?: AiAuditor,       // 传实例则每次请求自动 log（entry 含 cost/ttftMs，§12）
  fetch?: typeof fetch,      // mock 注入（AI SDK 同款）
}) → {
  chat(req: AiChatRequest): Promise<AiChatResult>;
  stream(req: AiChatRequest): AiStreamSession;   // AsyncIterable<AiStreamChunk> + cancel() + done
  config: 只读当前配置（provider/baseURL/model）
}

AiChatRequest = { messages: AiChatMessage[], model?, temperature?, maxTokens?, signal? }
AiChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | AiContentPart[];   // §10 标准化内容（多模态）
  toolCallId?: string;                 // role 'tool' 时：openai 族映射 tool_call_id；
                                       //   anthropic 族映射为 user 消息的 tool_result block（真回灌）
  cacheControl?: boolean;              // anthropic 族：该消息末块打 cache_control 断点（prompt 缓存
                                       //   一等公民）；openai 族自动缓存，字段忽略
}
AiChatResult  = { text, usage: AiUsage（normalizeUsage 归一）, cost?: number（定价表命中时）, finishReason?, raw? }
AiStreamChunk = { type:'text', delta } | { type:'done' } | { type:'error', message }
```

**多模态传输映射（parts → wire）**：
- openai 族：text → `{type:'text'}`；image → `{type:'image_url',image_url:{url}}`（data 拼回 data URI）；audio → `{type:'input_audio',input_audio:{data,format: mimeType 后缀}}`；file（url 为 file_id 时）→ `{type:'file',file:{file_id}}`；**video → 诚实抛 `AiProviderError{type:'unsupported'}`**（无主流 API 支持）；resource-link → text 部件降级。
- anthropic 族：text → `{type:'text'}`；image → `{type:'image',source}`（url 或 base64）；audio → `{type:'audio',source:{type:'base64'}}`（仅音频模型，官方口径）；file（pdf 等）→ `{type:'document',source}`；video → unsupported；resource-link → text 降级。
- 响应侧 `chat()` 的 content parts 数组（assistant 回图等）→ `result.parts?: AiContentPart[]`（normalizeContentParts 归一），`text` 仍为拼接文本。

- **两族线协议**：openai 族 POST chat/completions（bearer；`stream_options.include_usage` 自动注入——AI SDK 同款）；anthropic 族 POST /messages（x-api-key + 版本头 + 浏览器直连头；`max_tokens` 必填——缺省 4096；system 顶层参数转换）。
- **SSE 解析器两套**：openai 族按空行分隔的 `data:` 帧 + `[DONE]`；anthropic 族 `event:` 分派（text_delta 出文本；usage 取 message_start 的 input + message_delta 的 output，**不 += 累加**）。缓冲按空行切，不按 read 边界。
- **usage 归一**：走 ai-core `normalizeUsage`（已含 OpenAI/Anthropic/GLM details 路径）；本次给 ai-core 补 DeepSeek 顶层 `prompt_cache_hit_tokens`→cacheRead、Kimi 顶层 `cached_tokens`→cacheRead 与 `prompt_tokens_details.cache_write_tokens`→cacheWrite。
- **错误归一**：OpenAI/DeepSeek 同构 `error.{message,type}`；Kimi 无 param/code 自有枚举；GLM 业务码信封；Anthropic 多一层 `type:"error"` 包装——统一抛 `AiProviderError { provider, status, type, message, raw }`。
- **CORS 诚实**：browserDirect 'no'/'unknown' 的 provider 在浏览器直连失败时，错误信息里建议走代理（文档写明，不静默）。

### 9.3 审计（"完美进入 AI 体系"的闭环）

```ts
createAiAuditor({ persist?: string（localStorage key）, max?: number（默认 100，环形） }) → {
  log(entry): void; list(): AiAuditEntry[]; clear(): void;
  summary(): AiUsage;        // 全量聚合 → 直接喂 renderAiUsage / renderAiUsageRing
  byModel(): Record<string, AiUsage>;
}
AiAuditEntry = { id, ts, provider, model, baseURL, stream, status: 'ok'|'error', durationMs, usage?, error? }
```

client 每次请求自动产审计记录（onAudit 回调 + 若传了 auditor 实例则自动 log）。usage 增量事件派 `icen:ai-usage`（detail AiUsage，bubbles，挂 document）——上下文环/用量面板监听即实时更新。

### 9.4 可测试性（补）

`createAiClient` 接受 `fetch?: typeof fetch` 注入（AI SDK 同款）——单测与文档站 demo 用 mock fetch 返回预制 SSE 流，离线可演示全链路（流式文本 + usage + 审计）。

---

## 10. 标准化内容模型 `AiContent`（v0.7.1 新增，ai-core）

> 调研依据（2026-10）：Vercel AI SDK v5 UIMessage parts（text / reasoning / tool-\<name\> 六态 / file{mediaType,url} / source-url / source-document / data-*）、
> MCP 内容类型（TextContent / ImageContent / AudioContent / ResourceLink / EmbeddedResource + structuredContent，全部带 annotations）、
> OpenAI content parts（text / image_url / input_audio / file）、Anthropic content blocks（text / image / document / audio / tool_use / tool_result）。
> 设计目标：**消费方用一套 parts 表达任意输入；渲染组件、估算器、传输层全部只认这一套。**

### 10.1 类型

```ts
export type AiContent = string | AiContentPart[];

export type AiContentPart =
  | { type: 'text'; text: string; state?: 'streaming' | 'done' }   // AI SDK TextUIPart 对齐
  | { type: 'image'; url?: string; data?: string; mimeType?: string; alt?: string }
  | { type: 'audio'; url?: string; data?: string; mimeType?: string }
  | { type: 'video'; url?: string; data?: string; mimeType?: string }
  | { type: 'file';   url?: string; data?: string; mimeType?: string; filename?: string }
  | { type: 'resource-link'; uri: string; name?: string; mimeType?: string }; // MCP ResourceLink
```

约定：`url` 与 `data` 二选一——`data` 为**无前缀 base64** 且必须伴随 `mimeType`；渲染用 `aiContentUrl(part)` 归一（data → `data:<mime>;base64,<data>`）。
video 当前无主流 chat API 支持，属 UI 前瞻位（渲染与估算齐备，传输层诚实报不支持）。

### 10.2 归一化（业界 wire → parts）

```ts
export function normalizeContentParts(raw: unknown): AiContentPart[];
```

一函数覆盖四族来源（逐项探测，非本届即跳过）：
- **OpenAI**：`{type:'text'}` / `{type:'image_url',image_url:{url}}`（data URI 自动拆 data+mimeType）/ `{type:'input_audio',input_audio:{data,format}}` / `{type:'file',file:{file_id}}`（→ file 部件，url 放 file_id）
- **Anthropic**：`{type:'text'}` / `{type:'image'|'document'|'audio', source:{type:'base64',media_type,data} | {type:'url',url}}`（document → file 部件）
- **MCP**：`{type:'text'}` / `{type:'image'|'audio', data, mimeType}` / `{type:'resource_link', uri, name}` / `{type:'resource', resource:{uri, mimeType, blob|text}}`（blob → 对应媒体部件、text → text 部件）
- **素朴**：已是本类型族的原样通过；字符串 → 单 text 部件；未知 type 剔除

`normalizeMcpContent(raw)` 为 MCP 场景别名（同实现，可发现性）；MCP `structuredContent`（JSON）由消费方自行决定序列化为 text 部件。

### 10.3 工具与文本

```ts
export function isAiContentPartArray(v: unknown): v is AiContentPart[];   // 守卫（tool output 多模态探测）
export function contentToText(content: AiContent): string;                // 拼接全部 text 部件（复制/降级传输用）
export function aiContentUrl(part: AiContentPart): string | undefined;    // url 或 data URI（渲染 src）
```

`AiToolCallModel.output` 保持 `unknown`；`renderAiToolCall` 内部用 `isAiContentPartArray` 探测——数组部件渲染媒体/链接，其余保持 JSON `<pre>`（**MCP 回执的多模态呈现零改动打通**）。

### 10.4 估算器

```ts
export function estimateTokens(content: AiContent | AiUsage): number;
```
- 内容启发式（无依赖，业界粗估惯例）：CJK 字符 ×0.6 + 其余字符 ÷4；文件/图片部件按 mimeType 给经验值（image ≈ 1000、audio ≈ 25/秒无时长信息时 1500、video ≈ 300/秒缺省 6000、file 文本类 ≈ 内容未知给 500）。
- 传 `AiUsage` 时直接返回归一 total。

```ts
export function contextEstimate(usage: AiUsage): number;
```
**下一轮上下文估算**（上下文环的正确口径）：`(input??0)+(cacheRead??0)+(cacheWrite??0)+(output??0)`——本次输出会进入下轮输入；reasoning 已计入 output（OpenAI）或单列（Anthropic 计费口径），单列时也加上。**与 `auditor.summary()`（累计计费口径）语义不同，二者不可混喂同一个环**——绑定层（§11）负责选对口径。

---

## 11. 绑定层 `bindComposer`（v0.7.1 新增，ai-composer.ts）

「零接线全链路」的胶水：**事件驱动、消费方拥有传输会话的所有权不变**。绑定层监听 §5 的 `icen:ai-*` 事件把 composer ↔ 消息区 ↔ client ↔ 用量环接成闭环。

```ts
export interface AiComposerBindOpts {
  client?: AiClient;          // 传入即托管对话：send → 用户消息渲染 + running + client.stream
                              //   → assistant 消息 + createAiStream 逐 chunk 追加 → done 收尾
                              //   （错误 → fail + setError；stop → session.cancel；排队消息在
                              //    每轮完成后自动发送下一条）
  messages?: HTMLElement;     // .ai-chat-scroll 或任意消息容器：renderAiMessage 的挂载点（client 模式必填）
  usage?: { from: 'context' | 'billing' | AiAuditor; total?: number };
                              // 环口径：'context'（默认，icen:ai-done 的 contextEstimate——环语义正确）
                              //   | 'billing'（icen:ai-done 的请求 usage 累加——计费视角）
                              //   | 传 auditor 实例则用其 summary()
  running?: boolean;          // 运行态自动管理（默认 true）：icen:ai-send → running；icen:ai-done → 解除
}
export interface AiComposerBinding { unbind(): void }
export function bindComposer(el: HTMLElement, opts?: AiComposerBindOpts): AiComposerBinding;
```

- **client 模式**下 stop 钮绑定 `session.cancel()`；`icen:ai-done` 的 `cost` 自动进环的 `opts.cost` 累计；assistant 消息 meta 自动填 token 数与模型名。
- 不传 client 时是纯状态绑定（send→running、done→解除、环更新），传输仍归消费方——**渐进采用**。
- composer 同时新增：粘贴文件与拖放文件落附件（`icen:ai-attach` 同事件）；`MODEL_CTX` 在选中模型无 `context` 时显式清除（环回退无上限形态）。

---

## 12. 定价与审计闭环（v0.7.1 新增，ai-provider.ts + ai-panel.ts）

### 12.1 定价表（注册表内联，USD / MTok，2026-10 调研近似值）

```ts
export interface AiPricing { input: number; output: number; cacheRead?: number; cacheWrite?: number }
// AiProviderModel 增：pricing?: AiPricing
export function estimateCost(usage: AiUsage, provider: string, model: string): number | undefined;
```

内置值（锚点：Anthropic Opus 5.5 $4/$20、Sonnet 5 $2/$10、Haiku 4.5 $1/$5、Fable $10/$50、缓存读 ~10% 输入价；
GPT-5 $1.25/$10、mini $0.25/$2；DeepSeek V4 Pro ~$0.55/$1.1（峰谷取中）、Flash ~$0.14/$0.28；
GLM-5.x ~$0.5/$3 档；Kimi K3 $3/$15、缓存读 ~$0.3，K2.6 ~$0.95/$3）。cacheWrite 缺省按 input 的 1.25 倍
（Anthropic 5-minute cache write 口径）。**第三方网关注册时自带来价，estimateCost 未命中定价返回 undefined（不猜价）。**

### 12.2 审计增强

- `AiAuditEntry` 增 `ttftMs?: number`（首 token 延迟——stream 在首个 text chunk 记时）与 `cost?: number`（按定价表算出，未命中缺省）。
- `AiAuditor` 增 `totals(): { usage: AiUsage; cost: number; requests: number; errors: number; avgTtftMs?: number }`
  （`summary()` 保留为 usage-only 别名，喂 renderAiUsage 不变）。
- **`renderAiAudit(elm, source, opts?)`**（ai-panel.ts，source 为 `AiAuditor | AiAuditEntry[]`）：
  totals 行（请求数 ok/error · 累计 tokens · 累计成本 · 平均 TTFT）+ byModel 分组行 + 最近请求列表
  （limit 默认 10：状态点 · provider/model · 时长 · TTFT · tokens · 错误行）。清除钮派 `icen:ai-audit-clear`
  （消费方调 `auditor.clear()` 后重渲染）；`opts.onClear` 可替代事件。
- `AiContextModel` 增 `audit?: AiAuditor | AiAuditEntry[]`：上下文抽屉自动出现「审计」节（复用 renderAiAudit 内部件，无清除钮）。
- localStorage 持久化审计在多 tab 下为 last-write-wins：绑定层不自动同步，文档写明（审计以单 tab 会话为准）。

---

## 13. AI 工具体系（v0.8，`src/behaviors/ai-tools.ts`）

> 任何 UI 能力（图表渲染、未来的 diff 应用 / todo 写入……）注册为 **AiToolDef**，
> 模型侧可调用、宿主侧全控。库内置 `render_chart` 一个工具（吃 ChartSpec 纯 JSON）。

### 13.1 注册表

```ts
export interface AiToolDef<TInput = unknown> {
  name: string;                    // 模型侧 function name（snake_case）
  description: string;             // 给模型看的说明
  inputSchema: Record<string, unknown>;  // OpenAI parameters / MCP inputSchema 兼容
  run: (input: TInput, mount: HTMLElement) => unknown;  // 在挂载点上渲染，返回值即工具结果
  present?: 'mount' | 'data';
}
registerAiTool(def) / unregisterAiTool(name) / getAiTool(name) / listAiTools()
```

### 13.2 挂载区（挂不挂 / 挂哪些 / 挂几个——宿主三层控制）

```ts
createAiToolArea(el, { tools?: string[]; max?: number; itemMinHeight?: number }) → AiToolArea
// tools 白名单支持通配 'chart-*'；max 超出 LRU 淘汰最旧挂载
// AiToolArea: { el, count, call(name, input), can(name), setTools, setMax, clear, onChange(fn) }
```

- 三层控制：① 不 import 本模块 = 生态无工具体系（tree-shake）；② area 白名单 + max；
  ③ 运行时 setTools/setMax/clear + unregisterAiTool 全局下架。
- 挂载项结构：`.ai-tools-mount > .ai-tools-item > head（工具名/时间/×）+ body（工具自渲染）`。
- 事件（bubbles）：`icen:ai-tool-call {name, input, el}` / `icen:ai-tool-result {name, ok, el, error?, count}`
  / `icen:ai-tool-evict {name, el}`。

### 13.3 模型侧导出（agent loop 直接消费）

```ts
aiToolsToOpenAI(names?)   // → chat.completions tools 参数格式
aiToolsToMcp(names?)      // → MCP tools 格式（name/description/inputSchema）
aiToolsManifest(names?)   // → system prompt 能力清单文本
parseAiToolArgs(raw)      // tool_call 参数容错解析（JSON 字符串/对象/坏 JSON→{}）
```

宿主 agent loop 接线：模型回 `render_chart` tool_call → `area.call('render_chart', parseAiToolArgs(args))`。

### 13.4 图表与 AI 族的接缝

- `render_chart` 工具：inputSchema = ChartSpec JSON Schema；run = renderChart（自动选型 /
  容错归一 / 交互事件族 / 可隐藏图例全数继承）。
- **工具回执内嵌图**：`renderAiToolCall` 的 output 为 `{type:'chart', spec}` 信封或裸
  ChartSpec 时，IO 区直接渲染小图（`chartSpecOf` 探测，`.ai-tool-io-chart` 容器）。
- **kind**：ai-core 内置 `chart` kind（折线图标，info tint，summarize 取 title）；
  `inferKind`：工具名含 chart/plot/visualize → 'chart'。
