# 更新日志

## 0.8.0 - 2026-10-02

> 本次发布横跨内部 0.6 / 0.7 / 0.8 三个迭代（自 0.5.0 之后首次发版），0.6 的类名规范收敛含破坏性变更，升级请先读该节。

### 破坏性变更（0.6 规范收敛）

- 语义修饰符统一 `--success/--warning/--error/--info`：pill `.ok/.warn/.bad/.accent` → `.pill--success/--warning/--error/--accent`；toast `.ok/.err/.warn` → `.toast--success/--error/--warning`（JS 方法 `toast.ok()` 等不变）+ 新增 `.toast--info`；notification `.notif--*` → `.notification--*`；stat `.icon--ok/.warn/.bad` → `.icon--success/--warning/--error`，`.stat-num.accent/.warn/.bad/.info` → `.stat-num--accent/--warning/--error/--info`
- 状态类一律 `.is-*`：`.page-tab.active` → `.is-active`、`.carousel-dot.active` → `.is-active`、`.leaving` → `.is-leaving`、`.copy-btn.done` → `.is-done`
- 根类去前缀：`.panel-block` → `.panel`、`.admin-table` → `.table`、`.page-tabs/.admin-tabs` → `.tabs`
- tabs 的 `--scroll` 变体删除（tab 条永不滚动纪律）

### 新功能

**0.6 · 全量工程级收敛（56 组件 CSS / 33 behaviors）**
- select 搜索过滤（`data-select-search` + `data-keywords`）/ 多选 chips（`data-select-multiple` + `data-select-max`）/ 分组 / 空态
- input 掩码（`data-mask`）/ 字符计数（`data-count`）/ `data-trim` / 全局 IME 组合态安全
- upload 文件列表（缩略图/大小/移除）+ `data-max-size` / `data-max-files` / accept 校验 + `icen:upload*` 事件
- table 斑马纹/粘滞首列/展开行/行状态色；stat 横向布局/SVG 环/骨架；empty 类型预设；panel 折叠；slider 刻度/气泡/渐变；card 变体族；feedback 环形进度/条纹/点阵 spinner/shimmer；switch 变体/单选卡片
- 新增 copy / tag / badge / scroll-area / notification（持久通知栈）/ back-top / command-palette / date-picker / toolbar / split-pane

**0.7 · AI 原生组件族（11 slug，7 态状态机）**
- ai-chat（滚动钉底 + 回到底部）/ ai-message（user/assistant/system/tool 四角色 + 多模态）/ ai-reasoning（折叠 + 耗时回填）/ ai-composer v2（模型选择/命令/引用/附件三入口/排队/用量环）/ ai-tool-call（kind 注册表 + 输入折叠/输出按型展开）/ ai-subagent（嵌套活动流）/ ai-diff（差异审阅 accept/reject）/ ai-files / ai-todo / ai-context（上下文抽屉：用量/文件/MCP/Skills/审计）/ ai-usage（含上下文窗口环形 `renderAiUsageRing`）
- 状态机 `pending|running|streaming|approval|done|error|cancelled`；事件统一 `icen:ai-*`

**0.7.1 · AI 一体化（对标 2026-10 业界标准：AI SDK v5 parts / MCP / OpenAI / Anthropic）**
- 标准化内容模型 `AiContentPart[]`（text / image / audio / video / file / resource-link）：消息渲染、工具回执、传输层全部只认这一套；`normalizeContentParts` 一函数归一四族来源
- ai-provider 适配层：五家厂商注册表（含定价表，`estimateCost` 未命中不猜价）、chat + stream 双协议多模态传输（`toOpenAiContent` / `toAnthropicBlocks`，含 `cache_control` 与 tool_result 回灌）、fetch 可注入
- 审计闭环：`createAiAuditor`（cost 定价估算 + ttftMs）+ `renderAiAudit` + `ai-context` 审计节 + `icen:ai-done` 收尾事件
- 绑定层 `bindComposer`：一行接通 composer ↔ 消息渲染 ↔ client（流式/停止/排队续发/错误）↔ 用量环（`usage.from: 'context'|'billing'|auditor` 双口径）
- 上下文估算 `contextEstimate` 与计费口径显式分离

**0.8 · 图表通用层 + AI 工具体系**
- `renderChart(el, ChartSpec)` 统一入口：纯 JSON 规格、`inferChartType` 自动选型（时序/版本序列/年份→折线）、`normalizeChartSpec` 别名归一、`format` 描述符、多系列折线/分组/堆叠柱、内置 tooltip 门户、`icen:chart-{move,out,click,dblclick,contextmenu}` 交互事件族（detail 含系列/指针坐标）
- 图例统一 chrome：图表头（标题 + 小眼睛）控制全部图型图例可见性（`data-legend-hidden` 容器级），全部渲染器共享
- 新增贡献日历 `renderCalendar`（GitHub 同款）与散点 `renderScatter`（x/y/size），合计 12 种图
- ai-tools 工具体系：UI 能力注册为模型可调用工具（内置 `render_chart` 吃 ChartSpec）；`createAiToolArea` 挂载区三层控制（白名单 glob / max LRU / 运行时 setTools·setMax）；模型侧 `aiToolsToOpenAI / aiToolsToMcp / aiToolsManifest` 三出口 + `parseAiToolArgs` 回包解析
- 待办业界模式：TodoWrite 折叠卡（对话流）+ `setComposerTodo` 输入区实时 chip（x/y、is-done/is-error、点击弹层）三处同源
- AI 渲染折叠策略：机器可读 IO 默认折叠，chart / error / 审批 / 多模态输出默认展开

**文档与 AI 可发现性**
- 类型面随包发布：tsup dts 全量 `.d.mts`（34 个声明，JSDoc 约束注释存活）
- `AGENTS.md` 双段（消费方速查随 npm 发布 + 仓库开发约定）；站点 `llms.txt` / `llms-full.txt`（全文 + 类型面构建期快照，单一事实源生成永不漂移）
- skill `icen-ui` 源入仓（`skill/icen-ui/`，单向同步到 skill.icen.ai 注册表）
- 文档站：AI 总览页《分析 AI 迭代历史》可播放全流程演示；侧栏分组折叠（多开/首访全开/记忆/深链兜底）；分组重整（AI 原生上移第二位，表格并入数据展示）

### 修复

- 版本序列标签（v0.1…v0.8）图表推断为折线而非柱状
- 待办工具卡即时结算（done 态 + 耗时 + 摘要 x/y 与 chip/弹层三处同源）
- AI 组件宽度自稳定契约（长内容不撑破布局）
- 消息操作钮图标化（复制/重试不再挤压文字）
- 文档站移动端横向溢出、侧栏滚动位置跨页保持
- 总览演示审批 12s 倒计时自动允许（原 60s 静默等待）
