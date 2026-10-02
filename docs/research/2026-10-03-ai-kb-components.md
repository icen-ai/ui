# AI 知识库组件调研 → 组件需求报告

调研日期：2026-10-03。方法：11 路并发调研（对话流 / 引用溯源 / 摄取解析 / 问数 / 向量检索调试 / 工作流编排 / 观测评估 / 企业管理面 / 现有组件库盘点 / 前沿 Agent UX / 本地库盘点），核实约 130 个来源（官方文档为主）。

本报告目的：为「全力打造服务 AI 为主的 UI 库（企业级 AI 知识库方向）」给出组件需求清单 + 每个组件的业界最佳设计示例，供设计决策参考。

---

## 一页结论

1. **市场格局**：通用聊天组件赛道已收敛（shadcn-chat 官方停维护并指路 Vercel AI Elements / assistant-ui；Ant Design X 组件最全但绑死 React）。协议层（AG-UI、A2UI、MCP Apps 2026-01）只定义传输、不提供组件实现。**「企业知识库垂直 × 零依赖框架无关」这个交叉位没有任何竞争者**。
2. **我们的现状**（v0.8.1 本地盘点）：通用域已是第一梯队——ai-tool-call（7 态 + 审批）、ai-usage/ai-context/ai-audit（usage-chip 这个市场空白我们已占位）、ai-composer（@ 引用底座）、ai-diff、charts 12 型、datatable 等。**知识库身份域全部空白**：引用溯源、文档摄取管线、检索调试、问数——这四族是「知识库 ≠ 聊天应用」的差异所在。
3. **建议的 P0**（13 个新组件）：引用溯源 4 件、摄取管线 3 件、检索调试 2 件、问数 4 件。全部命中市场空白且是企业知识库采购决策级组件。

---

## 竞品格局速览

| 竞品 | 形态 | 知识库覆盖 | 关键限制 |
|---|---|---|---|
| Ant Design X | React 组件库（Bubble/Sender/Conversations/ThoughtChain/Think/Sources/Attachments…） | 组件层最接近：Sources/FileCard/Folder 有，但都是静态卡片 | React + AntD 强绑定；无检索过程、无 chunk 定位 |
| Vercel AI Elements | shadcn 式复制源码（47 个：reasoning/tool/sources/inline-citation/artifact…） | 引用组件全场最全（sources/inline-citation/docs-context） | React 19 + Next.js + Tailwind 强绑定 |
| assistant-ui | headless primitives + shadcn 样式包 | 无 citations 组件 | React |
| CopilotKit / llm-ui / LlamaIndex chat-ui | React 全家桶 / 流式 markdown hook / shadcn 组件 | 无 | React |
| Chainlit / Gradio / Streamlit | Python 驱动内置前端 | Chainlit 阅读体验最完整（引用跳转 + side panel + PDF viewer） | UI 绑定 Python 后端不可复用 |
| Open WebUI / LibreChat | 终态应用 | 功能面第一（RAG/文档管理/引用/权限） | 应用，组件不可拆 |
| 协议层 AG-UI / A2UI / MCP Apps | 事件与 UI 协议标准 | 只定义传输不提供组件 | — |

**信号**：通用 bubble/input 已饱和收敛为 2-3 家 React 方案；垂直化（知识库）+ 框架无关是仅存的结构性空位。

---

## 我们手里的牌（复用底座，不重复造）

- **对话主线**：ai-chat（消息流/流式/钉底/多模态/reasoning 折叠）、ai-composer（模型切换//命令/@ 引用/附件/排队/bindComposer 零接线）、ai-provider（五家 LLM 直连 + 审计 + 全局 usage 广播）
- **过程可视化**：ai-tool-call（7 态 + 16 内置 kind + 审批区 + kind 注册表）、ai-subagent、ai-todo、ai-usage 环、ai-context、renderAiAudit
- **变更审阅**：ai-diff（unified diff 解析 + 渲染 + 接受/拒绝）
- **数据面**：datatable（虚拟滚动/多选/列显隐/CSV）、tree、table、charts 12 型（ChartSpec 纯 JSON 可序列化——问数改图的天然底座）
- **管理面原语**：upload、steps（向导）、modal+Sheet、tabs、timeline、tag/tag-input/pill、desc、empty/skeleton/progress、command-palette、notification、sidebar/breadcrumb

---

# 组件需求清单

优先级：**P0** = 知识库身份组件 / 采购决策级；**P1** = 企业落地刚需、可由底座扩展；**P2** = 前沿占位与深度工具。
每项：职责 → 关键状态 → **业界最佳示例（它做对了什么）** → 数据契约要点 → 底座。

---

## 域 1 · 问答对话（补齐已有主线）

### R1.1 【P1】会话列表 conversations
多会话侧栏：分组（按时间/项目）、激活高亮、归档语义、每项更多菜单（重命名/置顶/删除）。
- 最佳：Ant Design X Conversations（https://x.ant.design/components/conversations-cn）— groupable 按时间分组可折叠、Alt+数字快捷切换、creation 专属 token。**它没内置重命名/置顶——这是普遍空白，我们做了就是超越**。次选 assistant-ui ThreadList（多一个 archive 语义）。
- 契约：`items[{key,label,group,icon}]`、`groupable{label,collapsible,expandedKeys}`、`activeKey/onActiveChange`。
- 底座：sidebar + list，全新组合范式。

### R1.2 【P1】消息反馈 feedback
👍/👎 + **踩后追问原因枚举**（幻觉/过时/无引用/越权）+ 与 traceId 关联入库。
- 最佳：Open WebUI（反馈带完整消息上下文持久化，直接当微调/评估数据）；LangSmith（反馈三型 categorical/numeric/comment，审查者互看不见彼此评分但 comment 公开）。
- 契约：`onFeedback(value: 1|-1|0, reason?)`，reason 为可配置枚举。
- 底座：ai-msg-actions 已有 copy/retry 槽位。

### R1.3 【P1】reasoning 折叠契约对齐
现有 ai-reasoning 补齐已收敛的交互契约：流式自动展开 → 完成 1 秒后自动收起 → **只收一次**（用户手动展开过则不再自动收）→ 时长自算「思考 N 秒」。
- 最佳：Vercel AI Elements Reasoning（https://elements.ai-sdk.dev）— `defaultOpen = isStreaming`、AUTO_CLOSE_DELAY=1000ms、hasAutoClosed 防抖、`getThinkingMessage(isStreaming, duration)` 三态文案（Thinking… / Thought for a few seconds / Thought for N seconds）。Claude 「ctrl+o 展开」键盘快捷键；「Thought for N seconds」已成全行业事实标准文案。
- 底座：ai-reasoning 已有折叠/计时骨架，纯增强。

### R1.4 【P1】usage 芯片补指标
ai-usage 已领先市场（**无任何主流库有标准化 usage 组件**），补齐指标字段即形成标准：TTFT、tokens/s、cache-hit、finishReason、cancellation rate。
- 最佳：Vercel ai-chatbot 每条消息渲染 tokens/成本；LLM 指标清单参考 https://www.cesun.life（queue time/TTFT/tokens/s/context size/cache-hit/finish reason）。
- 契约：`{inputTokens, outputTokens, cachedTokens?, costUsd?, ttftMs?, tokensPerSec?, finishReason?, model}`。TTFT = completionStartTime − startTime（Langfuse 字段设计）。

### R1.5 【P1】流式 markdown / 代码块行为
ai-chat 声明「markdown 是消费方职责」，但知识库正文是文档式排版（业界已从气泡转向全宽文档流），需要官方容器方案：流式安全的 markdown + 代码高亮行为 + incomplete markdown 修复。
- 最佳：llm-ui（https://llm-ui.com）— incomplete markdown 修复 + 块级 throttle 平滑 + 原生帧率渲染，流式渲染唯一专业户。AntD X 已内置 Markdown/Mermaid/CodeHighlighter（React）。
- 底座：`.code-block` 静态样式已有，缺高亮行为与流式容器规范（零依赖方案：推荐消费方接 marked/markdown-it + 我们提供容器样式契约与锚点协议）。

### R1.6 【P2】消息分支 branch-picker
同一消息位点多候选导航 ‹ 2/3 ›（编辑/重生成产生分支）。
- 最佳：AI Elements MessageBranch（Selector/Previous/Next/Page 三件可拆）。**LibreChat issue #4187 悬而未决多级分支导航是痛点——树状分支可视化没人做好，做了就是超越**。

### R1.7 【P2】断流续传提示条
刷新后 resume 恢复流的「从断点继续」提示条 + aborted 保留部分内容 + 继续生成按钮。
- 最佳：Vercel ai-chatbot（"Resuming after a Refresh"）；AntD X 把「停止不是错误」（aborted ≠ error）做进状态机。

---

## 域 2 · 引用与溯源（P0 核心 · 全空白 · 市场也空白）

> 市场证据：AI Elements 的 sources/inline-citation 绑 React+Tailwind；AntD X Sources 是静态卡片；Chainlit 绑 Python；**框架无关的 citation 组件全行业为零**。scrimui 宣言：「每条主张都带一个你能打开的引用——是它来自的段落，而非一串文件名」。

### R2.1 【P0】行内引用角标 inline-citation
答案句后的 `[1]` 编号：hover 预览 / 点击跳转 / 已访问态；**流式 delta 切断标记的整体解析；无效编号降级为纯数字而非死链**。
- 最佳：Perplexity（https://docs.perplexity.ai streaming-citations cookbook）— 契约写得最清楚：`search_results[{id,title,url,snippet,date}]`、正文 `[N]` 映射 id、**绝不让模型生成 URL**、未匹配 `[N]` 保留编号不加链接。预算参考 Copilot Studio（Teams 渠道：≤20 引用、标题 ~80 字符、摘要 ~480 字符）。
- 契约：marker ↔ source.id 映射 + 渲染端标记校验（有效/无效/已访问三态）。

### R2.2 【P0】引用悬停卡 citation-card
hover 角标浮出：favicon + 标题 + 域名 + **检索命中的原文 chunk**（非摘要句）+「打开原文」。
- 最佳：Perplexity（域名+favicon+片段「credibility reads instantly」）；Microsoft Copilot citation chip（桌面 hover / 移动 tap 双形态）。cited_text 长度锚点：Anthropic 150 字符、Teams 480 字符。
- 契约：`{title, url, favicon, cited_text, date}`；hover ~300ms 防抖。

### R2.3 【P0】来源列表 sources-list
答案上方的编号来源卡排 / 侧栏 passages panel（**随流式逐步填充**，空态文案「下一条答案引用的段落将出现在这里」）。
- 最佳：Perplexity（来源行在答案**上方**——先看来源再读答案）；scrimui passages panel（https://scrimui.dev，侧栏与生成过程同构）；Google AI Overviews 桌面端右侧链接面板（官方数据：AI Overviews 中的链接比自然结果获更多点击）。
- 契约：source + `useCount`（被引次数排序）+ 分组维度 + 「仅显示被引用的」过滤。

### R2.4 【P0】原文定位查看器 passage-viewer + citation-jump
点击角标 → 侧栏打开原文（不打断对话）→ 滚动到 chunk → 精确高亮 span；命中词高亮、前后文展开窗口。
- 最佳：**NotebookLM（业界标杆）**——行内编号 → 侧栏源文档 → 自动滚动并高亮**确切段落**；答案只由上传源生成，每个角标真实可跳。定位契约按 **Anthropic Citations 三分型**：纯文本 `char_location{start,end}` / PDF `page_location{start,end}` / chunk `content_block_location`（https://platform.claude.com/docs/en/docs/build-with-claude/citations）——且 span 单位（字符 vs 字节）必须写死否则高亮必错位（Gemini 的 segment 是字节，教训在案）。
- 契约：`cited_text + context_before/after + highlightTerms[] + 定位三元组`。

### R2.5 【P1】来源徽标组 source-badges
相似度分 / 新鲜度（`last_verified` 超阈值警示徽标 + 链接失效仍显示缓存摘录）/ 来源类型 / 官方源标识 / 权限受限。
- 最佳：Copilot Studio「Official source」——管理员标记官方知识源，使用官方源的回答**以独特标识开头**（徽标从装饰升级为回答级信任信号）；Gemini `confidenceScores` 每条支撑带分。
- 企业降级态：Glean/Microsoft 都在检索期按 ACL 过滤（「permission-aware answers」），**渲染期降级（答案可见但 chunk 打码 + 申请访问按钮）没人做好——差异化点**。

### R2.6 【P1】有据/无据区分 grounded-span
段落级 `hasCitations` 视觉区分 + strict 模式槽（无引用不给答案）。
- 最佳：Copilot Studio「Allow ungrounded responses」开关——无引用是**产品策略**而非样式问题；文档还诚实记录了代价：模型偶发「答对但不引用」会被扣下导致间歇性无答案。

### R2.7 【P2】来源冲突 conflict-cards
同一主张下新旧/矛盾来源按版本日期并排 + 官方徽标辅助裁决。**全行业无成熟组件**（Glean 评测「过期的 Confluence 页面依然被自信引用」是最接近的痛点证据）。
- 契约：`conflictGroup`（同一主张的来源簇）+ 每源立场/版本/日期。

---

## 域 3 · 文档摄取与解析管线（P0 · 知识库区别于聊天的核心 · 组件层全空白）

> 市场证据：知识库特有的「上传→解析→分块→向量化→就绪」多阶段状态在所有组件库中不存在（最近似物 Chainlit TaskList / AI Elements todo-list 都是 agent 任务语义，非文档处理语义）。

### R3.1 【P0】解析管线时间线 pipeline-timeline
单文档阶段化进度：排队→解析→切片→向量化→可用；每步可展开日志/耗时；失败给阶段定位 + **单文档重跑**；完成后显示 chunk 数。
- 最佳：RAGFlow（https://ragflow.io/docs/dev/configure_knowledge_base）— run 状态机 UNSTART/RUNNING/CANCEL/DONE/FAIL，解析完成文档行直接显示可用 chunk 数，失败落在文档粒度单点重跑。管线对象化最成熟：Azure AI Search 把管线拆成 Data source / Skillset / Indexer / Index 四个可独立查看执行历史的对象。
- 契约：`run{status: unstart|running|cancel|done|fail, progress, chunkCount, elapsed}`；job 计数 `{added, updated, deleted, failed}`（Kendra 同步史标准）。

### R3.2 【P0】chunk 编辑器 chunk-editor
chunk 一等公民化：列表 + 行内编辑 content/keywords + **available 启用开关**（不删除但排除出检索）+ 删除 + 手动新增 + 全文/语义双通道定位。
- 最佳：RAGFlow chunks 页（https://ragflow.io/docs/dev/chunk）— **业界最完整**：改 keywords 直接提升召回权重；手动新增 chunk 注入领域知识；`search`（全文）与 `search_vector`（语义）双通道。反例约束参考 Dify：父子模式的父分段建后不可编辑（锁与不锁的边界要显式）。
- 契约：chunk = `{id, document_id, content, keywords[], available, positions, image_id?}`；编辑需保留向量失效/重建语义。

### R3.3 【P0】分段策略配置 + 实时预览 chunk-config
分隔符/最大长度/重叠/清洗勾选 + **预览按钮消费真实解析结果**（多文件切换、有限条数）+ 父子双层分段（子匹配、父供上下文）。
- 最佳：Dify（https://docs.dify.ai/zh/cloud/use-dify/knowledge/create-knowledge/chunking-and-cleaning-text）— 三块结构最完整，且给出配置反例提示（父子分隔符互为子集的 `??` vs `##`）；「分段模式创建后不可改、参数可随时调」的边界显式化。反例：Azure 内置固定 2000/500 不可配——证明此步必须开放配置+预览。
- 契约：`{delimiter, maxChunkLength, overlap, preprocessing[]}`；父子 `{parentMode, parentConfig, childConfig}`。

### R3.4 【P1】解析模板选择 parse-mode-selector
按文档形态选模板（通用/QA/论文/手册/法规/表格/图片/音频/知识图谱…），每模板独立参数表单。
- 最佳：RAGFlow chunk method（13+ 模板：General/Q&A/Paper/Manual/Laws/Table/Picture/One/Audio/Email/Tag/KnowledgeGraph，API `chunk_method` 枚举）。另一种范式：LlamaParse 用自然语言 preset 指令 + 按 tier 分页路由成本 + `page_range`（https://developers.llamaindex.ai/llamaparse/parse/）。

### R3.5 【P1】连接器卡 + 同步健康 connector-card
第三方源接入卡：OAuth scopes / 爬取范围 / 同步计划 / 健康信号。
- 最佳：Amazon Bedrock 连接器（S3/Confluence/SharePoint/Salesforce/Web Crawler/Custom 每类专属配置页 + RETAIN/DELETE 向量删除策略）。**健康模型学金子：Glean 明确「Active ≠ 最近抓取成功」——健康 = 4 离散信号（状态/条目增速/抓取率/变更率）+ 阈值（24h 无增长判停摆、变更率归零=webhook 失效）+ 不可关闭告警**（https://docs.glean.com/connectors/monitoring）。
- 契约：`connector{enabled, lastSyncAt, lastCrawlStatus, itemsSynced, crawlRate, changeRate, credentialState, schedule}`。

### R3.6 【P1】表格抽取预览 table-extract-preview
解析出的表格以表格形态渲染核对；Excel 整表 HTML ↔ 逐行键值两种互斥产物。
- 最佳：RAGFlow Table（整表转 HTML 作单一 chunk 参与检索，LLM 看到还原后的表格而非碎片）；LlamaParse layout-aware 表格转 markdown。

### R3.7 【P1】元数据管理 metadata-manager
库级字段定义（string/number/time + 内置字段）→ 文档绑定 → 检索过滤条件。
- 最佳：Dify v1.1（字段先定义后绑定、类型受控；召回测试与知识检索节点按元数据过滤——官方定位「企业文档权限分级」的基础设施）。

### R3.8 【P1】网页抓取配置 crawler-config
URL 种子/层级（0-3）/窗口/包含排除 pattern/定时更新（1h~1 月）。
- 最佳：Coze 网页知识库（层级与窗口防失控约束）；Bedrock Web Crawler 连接器（inclusion/exclusion patterns）。

### R3.9 【P1】QA 对编辑 qa-pairs-editor
问答对作为知识形态的表格化管理：四来源导入（本地/API/飞书/自定义）、行级编辑、结构化上限（2 万行）。
- 最佳：Coze 表格知识库（明确区分「文档型/表格型/网页型」三种知识库类型）；RAGFlow Q&A 方法（question/answer 列各成 chunk）。

### R3.10 【P2】版面叠加预览 + 重解析 diff（市场空白 × 2）
- 版面叠加：LlamaParse 有 bounding-box JSON、RAGFlow 有 positions 坐标，但**没有产品做出「原文缩略图上直接拖 chunk 边界/合并/拆分」**——交互空白。
- 重解析 diff：重新解析后哪些 chunk 新增/变更/失效，无产品可视化——「更新文档后召回变化」无解释面，运营最痛。
- 解析成本面板（按文档展示耗时/成本/页数帮选档位）同样空白。

---

## 域 4 · 检索调试（P0 管理员工具 · 多数市场空白）

### R4.1 【P0】检索 playground retrieval-playground
输入 query → top-k 结果：分数条 + chunk 原文高亮 + 元数据展开 + 过滤 + top-k 步进；**与生产共用同一查询端点**。
- 最佳：Azure AI Search explorer（https://learn.microsoft.com/en-us/azure/search/search-explorer）— 三视图（Query/Image 拖图向查/JSON 全参数 + intellisense 补全）；诚实呈现边界（空查询所有 score=1 无排序）。次选 Qdrant Dashboard（Neural/Recommend/Discovery/Hybrid 模式切换 + Console 原始 REST 同屏互证）。
- 契约：`{query, topK, filter?} → matches[{id, score, fields}]`；**score 可为 null 必须处理**（Pinecone 稠密幅值过大时分数非有限）。

### R4.2 【P0】分数可视化 + 阈值 score-bar
分数条带 metric 语义 + 阈值滑杆联动「存活条数」+ 分数解释。
- 最佳：**Weaviate `_additional` 四字段是黄金标准**（https://docs.weaviate.io/weaviate/api/graphql/additional-properties）：`distance`（原始距离）+ `certainty`（0-1 归一）+ `score`（BM25/融合分）+ **`explainScore`（分数拆解为向量分+关键词分）**。警示牌：Cohere 明确「0.9 不等于比 0.45 相关 2 倍」——序数呈现而非基数解读；Dify 未启用 rerank 时阈值显示 N/A（不可用态显式禁用而非隐藏）。
- 契约：分数必须带 `metric`（cosine/dot/ip/l2/bm25/rrf）+ `higherIsBetter`，否则跨模型不可比。

### R4.3 【P1】混合权重 mixer
语义↔关键词双端滑杆（或 alpha 单杆）+ 融合策略选择（加权/RRF/DBSF）+ 即时重查。
- 最佳：Dify（两种互斥路径：权重滑杆（无外部依赖，两端各带适用场景文案）vs Rerank 模型（消耗 token）——**成本/能力权衡写在控件旁边**）；Qdrant 给出决策树（有评测集→调参 RRF / 信任原始分数→DBSF / 都没有→RRF，k=60 默认）。

### R4.4 【P1】rerank A/B 对比 rerank-compare
开关 rerank 后双列并排：排名变化箭头（↑3 ↓2 —）+ 双分数体系（检索分 vs relevance_score）。
- **市场全空白**（Cohere playground 也只显示重排结果）。Cohere 契约天然适配：响应只有 `{index, relevance_score}`，前端 diff 即得排名变化（https://docs.cohere.com/reference/rerank）。对比需稳定 key（chunk id）join。

### R4.5 【P1】召回测试集 hit-testing
保存的测试问题 + 逐题命中 + 命中率统计 + 参数快照；**临时参数「仅本次会话生效」**。
- 最佳：Dify 召回测试（https://docs.dify.ai/en/cloud/use-dify/knowledge/test-retrieval）三个设计：侧栏一等入口 / 试参数不污染生产配置 / Records 区沉淀全部召回事件（测试与生产共用 API）。测试集冷启动：GraphRAG 用图谱结构自动生成候选测试问题。
- 契约：`testCase{question, expectedChunkIds?}` + `run{paramsSnapshot, hits[{chunkId, score, rank}]}` + `stats{hitRate, avgScore}`——**参数快照必须随 run 存档**。

### R4.6 【P1】过滤器构建器 filter-builder
字段/操作符/值条件组合（AND/OR）+ **可视化 ↔ DSL 文本互转**。
- 最佳：Azure（OData + intellisense 的「文本 DSL 优先 + 补全」路线）；Qdrant prefetch JSON。UI 存结构化 AST 而非字符串，序列化到任一后端（Mongo 风格 vs OData 两大家）。

### R4.7 【P1】chunk 检查器 chunk-inspector
单 chunk 详情抽屉：来源文档 + 跳原文锚点 + 向量前 N 维预览 + 以此 chunk 为 query 的近邻列表（query-by-id）。
- 最佳：Pinecone（API 原生支持按记录 ID 查询——零成本实现邻域视图）；Langfuse retriever 观察（每条命中可展开穿透）。

### R4.8 【P2】检索指标仪表 + embedding map + GraphRAG explorer
- 指标：RAGAS 四件套是事实标准且应**分两组呈现**（检索质量：Context Precision/Recall/Noise Sensitivity；生成质量：Faithfulness/Answer Relevancy）；指标必须绑定 k 与测试集版本否则无意义。
- embedding map：Nomic Atlas（点云巡检/框选打标/清脏簇——语料治理的一等公民形态）。
- GraphRAG：Microsoft GraphRAG 产物契约（communities 层级/community_reports{title,summary,findings[]}/entities{degree}/relationships{weight}）+ 官方可视化配方（Leiden 着色 + 度中心性 10-150 尺寸）；localSearch/globalSearch 应分标签。

---

## 域 5 · 问数 Chat-with-Data（P0 · 中文企业刚需）

### R5.1 【P0】生成 SQL 卡片 sql-card
语法高亮、折叠、复制、**按角色显隐（visibility 是权限问题而非展示问题）**、编辑后重跑。
- 最佳：Vanna 2.0（https://github.com/vanna-ai/vanna）— `vn.ask()` 一次返回 SQL→表→图三联；SQL 可见性按角色分层（默认仅 admin）；流式返回顺序：进度→SQL→交互表→图→摘要。Genie 只让 CAN EDIT 者看查询；SQL 函数型资产逻辑不可见。
- 契约：`generatedQuery{sql, dialect, referencedTables[], editable, visibility: 'all'|'admin'}`。
- 底座：`.code-block` 静态样式已有，需补高亮行为。

### R5.2 【P0】SQL 修正循环 diff sql-fix-diff
报错时 v1 vs v2 diff + 逐行解释改了什么 + 一键应用重跑。**市场空白**（Hex 在 cell 级做到，对话式产品全无）。
- 最佳：Hex Magic Fix——「错误发生时修复已在后台准备，用户看到的是修复建议就绪而非裸错误」（修正循环的延迟被隐藏）。
- 底座：**ai-diff 直接复用**（unified diff 解析器现成，加 SQL 语境的行解释槽）。

### R5.3 【P0】结果表格 result-table
截断声明（LIMIT 是契约不是 bug）/ 导出（CSV/XLSX）/ 透视下钻 / 值列可编辑下拉过滤。
- 最佳：WrenAI（dry-plan 预验证 + row limit 治理原语 + 结构化错误带修复提示）；Vanna 2.0（交互表是流式中的独立消息类型，与 SQL/图/摘要并列）；ThoughtSpot（导出是答案级一等操作：XLSX/PDF/CSV/PNG）。
- 契约：`queryResult{columns[], rows, totalRows, truncated, limit, rowCount, durationMs, exportFormats[]}`。
- 底座：**datatable 现成**（虚拟滚动/导出/列操作全有），加截断横幅与答案级导出槽。

### R5.4 【P0】自动图表 + 追问改图 auto-chart
AI 按数据形态选图 + 用户自然语言改图（「换成按月」）+ 图/表双视图切换。
- 最佳：Julius AI（三区同屏，追问即时更新图表，底层代码可选查看）；Vanna（Plotly 图对象可编程改）。关键：**chartSpec 独立于渲染层可序列化，改图只改 spec 不重查**。
- 契约：`chartSpec{type, x, y[], series[], aggFn, granularity}`。
- 底座：**charts + ChartSpec 现成**（format 描述符可序列化、AI 可给——我们的架构本来就是为这个设计的），补「图表类型切换器 + 追问改图」交互层。

### R5.5 【P1】澄清反问卡 clarify-card
歧义时结构化选项反问（点选而非打字），回答回填约束并回显。
- 最佳：Databricks Genie（澄清指令官方模板：**触发条件+缺失信息+必须提问+示例问法**，做成语义层可配置策略而非模型随机行为）；Snowflake（追问自动改写省略主语「北美呢？」）。
- 契约：`clarification{question, options[{label,value}], reason}` → `resolvedConstraints[]` 回显。

### R5.6 【P1】认证答案 verified-answer
命中人工验证查询时带 Trusted 徽章 + 说明命中哪条资产 + 参数可改重跑；认证优先于生成。
- 最佳：Genie trusted assets 三形态（参数化示例 SQL / 标量函数 / 表值函数，函数内部 SQL 不可见）；Power BI App 级 verified answers（作者预置，Copilot 优先返回）。
- 契约：`answer{type: 'verified'|'generated', verifiedVia{assetId, assetType}, badge}`。

### R5.7 【P1】口径解释面板 explain-panel
「这个数字怎么算出来的」：实际运行的查询要素（表/列/筛选/聚合）+ 指标口径深链语义层 + **多轮之间解读变化的可视化**。
- 最佳：ThoughtSpot Spotter Explain（展示实际查询要素；且可查看「Spotter 对问题的解读在多轮间如何变化」——独有设计）。

### R5.8 【P1】权限与脱敏提示 permission-notice
结果旁注明 RLS 影响范围（「仅含你有权限的区域」）+ 脱敏列标识。
- 最佳：Genie（权限渗透进语义采集：带行过滤器的表自动退出 entity matching，列掩码仅排除掩码列——「这个示例值是谁的权限看到的」每个预览值都要能回答）；Vanna 2.0（UserResolver 按用户身份解析执行）。
- 契约：`queryContext{userId, groups[], rowLevelPolicyApplied, maskedColumns[]}` + 结果带 `permissionNotice`。

### R5.9 【P2】语义层管理器 semantic-model-manager
指标/维度/同义词/join 的策展台。
- 最佳：Genie knowledge store（策展优先级明确：**SQL 表达式 > 示例 SQL > 纯文本指令**；200 条片段/100 指令容量契约；Knowledge mining 从点赞查询自动建议新指标）；Snowflake Semantic Views（schema 级对象 + RBAC）。

### R5.10 【P1】多轮上下文契约
省略主语改写 + 明确的局限声明 + 重置入口。
- 最佳：Snowflake Cortex Analyst 把多轮局限写成文档契约：每请求带全历史（成本递增）/ **无法访问先前查询结果**（「第二个产品的收入」会失败）/ 不支持宽泛洞察 / 长对话需重置——这四条就是组件需求边界。Power BI clear chat 明确解释为什么切话题必须重置。

---

## 域 6 · 观测与评估（P1-P2 · 企业上线后）

### R6.1 【P1】trace 树 + span 详情 trace-tree
类型化 span（不用通用 span 一把梭）+ 时间条 + prompt/completion 对照 + TTFT 拆解。
- 最佳：Langfuse **10 种语义类型**（event/span/generation/agent/tool/chain/retriever/evaluator/embedding/guardrail，https://langfuse.com/docs/observability/features/observation-types）；TTFT = completionStartTime − startTime、TPS = outputTokens ÷ (endTime − completionStartTime)（派生指标 UI 层算不落库）。
- 底座：ai-audit + ai-usage 是雏形，可长成完整 trace 视图。**检索 span 呈现全行业薄弱**（Phoenix 仅到 UI 打 ground truth）——知识库场景可做出核心差异化。

### R6.2 【P1】标注队列 annotation-queue
badcase 人工复核：rubric + 分配锁定 + **全键盘流** + 自动入队规则 + pairwise 对比。
- 最佳：LangSmith（Reservations 锁定防重复审查/过期自动释放；状态流转 Needs Review→Needs Others' Review→Completed；**自动化规则按错误/低分入队**；Pairwise 快捷键 A/B/E）；Langfuse（1-9 打分/箭头切换/Cmd+Enter 完成前进）。
- 契约：`queue{id, scoreConfigs[], assignees[]}` + `task{targetType, targetId, status: open|completed, reservation{userId, expiresAt}}`。

### R6.3 【P1】无答案分析 no-answer-analytics
Top 零结果查询 + 交叉解读（零点击 ≠ 失败，可能是 FAQ 直接答了）+ **从失败查询直接创建内容/加同义词的动作闭环**。
- 最佳：Amazon Kendra 10 标准指标（CTR/零点击率/零结果率/即时回答率/Top 查询…每个都给控制台入口 + API metricType）+ 专门的「从指标到可执行洞察」章节；Guru（最高浏览 × 未验证 = 最急需补的联动清单）。
- 契约：`noAnswerQuery{text, count, shareOfAllQueries, zeroClickRate}` + 闭环动作 `contentGapAction{query, action: createDoc|addSynonym, assignee}`。**无一家做成端到端工作流（无答案→指派专家→产出→回验命中率）——空白**。

### R6.4 【P2】评估对比表 eval-diff-table
实验对比：delta 列（绿=改进/红=回归）+ 字符级 diff（内联/并排可切）+ 回归排序 + Summary 判级。
- 最佳：Braintrust（https://braintrust.dev/docs/evaluate/compare-experiments）— Comparison grade：Improvement/Regression/**Tradeoff**/Tie；baseline 自动选同 git 分支最近实验；同输入多 trial 可 Group by Input 看方差；实验是不可变快照。

### R6.5 【P2】提示词版本 + 告警
- 版本：Langfuse label 语义（不指定默认 production；**请求 staging 不存在返回 404 绝不静默回退**——防事故设计守则；label/version 互斥）。
- 告警：质量回退阈值告警全行业仅 Langfuse 一家有——空白。

---

## 域 7 · Agent 过程与前沿占位（P1/P2）

### R7.1 【P1】计划清单状态机 plan-checklist
灰空心圆 → 蓝脉冲（进行中）→ 绿描边勾（SVG stroke 动画）；整块可折叠；已完成保留不删除（Mask, Don't Remove）。
- 最佳：Manus（https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus）— todo.md 由模型随任务重写 = 「把目标背诵进上下文末端」；失败动作保留在时间线（Keep the Wrong Stuff In——透明性即信任）。
- 底座：ai-todo 已有骨架，补状态机语义与描边动画。

### R7.2 【P1】事件流 event-stream
带动词图标的事件行（放大镜=搜索/地球=浏览/文档=读文件/铅笔=写）+ 可折叠 + 错误保留。
- 最佳：Manus 活动日志图标语言；Devin 旁路提问 **Side Chats（/btw）**——从任意消息旁开只读侧问（带该时间点之前的上下文，不干扰主任务），对知识库长报告阅读极贴合。

### R7.3 【P1】工具链条 tool-chain-strip
多工具调用横向串联成排小卡（与单个 ai-tool-call 卡互补）。
- 最佳：ChatGPT agent（narration + terminal + browser 三栏；工具步骤横排小卡）。

### R7.4 【P2】沙箱工具容器（对齐 MCP Apps）——**赌协议，杠杆最大**
iframe 沙箱 + postMessage JSON-RPC 双向通道 + `ui://` 资源声明。MCP Apps 已成正式 MCP 扩展（2026-01，Slack/Figma/Asana 交互组件已进 Claude）；现在实现通用沙箱容器 = 免费获得整个未来 MCP Apps 生态。
- 规范：https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/（`app.callServerTool()` UI 反调工具、`app.updateModelContext()` 把用户操作写回模型上下文）。

### R7.5 【P2】检查点 checkpoint-timeline
聊天流内联检查点节点（时间+原因+点击看 diff+选择性恢复）；**语义开关：恢复内容 / 恢复对话 / 两者**。
- 最佳：Cursor（**只回滚文件、不删对话消息**——对企业合规是正确选择：讨论历史有审计价值）；Claude Code rewind（二者可选）。

### R7.6 【P2】双栏画布 + 划词工具条
左对话右文档的双栏工作区（AI 起草 → 人划词局部精修 → diff 逐条接受 → 版本留痕）。
- 最佳：ChatGPT Canvas（内联 diff + 右下角悬浮 Accept/Reject + 选中弹快捷操作 + Ctrl+[ ] 切换）；Claude Artifacts（阈值触发：≥15 行文档/代码才弹侧栏 + 版本树）。
- 底座：split-pane + ai-diff 现成，补 SelectionToolbar（划词 AI 菜单）与版本时间轴。

### R7.7 【P2】ChatPart JSON 渲染协议
消息 = `parts[]`（text/reasoning/tool-call/card.*），每 part 带 `state: input-available|output-available|output-error`；注册表分发渲染。
- 依据：Vercel 已把消息标准化为 parts 模型；生成式 UI 的零依赖解法 = **只承诺 JSON 契约不绑框架**（先占协议位，比绑死任何框架长寿）。命中统计卡/来源卡/对比卡/时间线卡是知识库的第一批 part 类型。

### R7.8 【P2】会话内接管与排队
TakeoverBanner（暂停横幅+恢复）+ MessageQueue（排队指令拖拽重排+插队发送——「AI 正在改我的文档我想插一句话」的企业场景）。
- 最佳：ChatGPT agent（take over 期间不截屏，密码不进上下文）；Cursor（Enter 入队/Cmd+Enter 插队/在工具调用边界介入）。

---

## 跨域设计原则（调研反复出现的共性）

1. **折叠 + 弱化色的渐进披露是 2024-2026 核心新语法**：思考块/工具卡/来源卡全是「默认折叠摘要行（状态徽章+时长）+ muted 内容区」；摘要行承担状态机可视化。
2. **状态机先于样式**：消息 6 态、工具 7 态、思考 3 态、run 5 态——UI 只是 state→(图标,标签,色阶,动效) 映射表。我们的 `.is-*` 约定与此天然一致。
3. **引用永远来自检索层，不信任模型生成的 URL/编号**：marker↔source 校验、无效 `[n]` 降级渲染、编造编号拦截。
4. **定位信息分载体类型**（char/page/block 三分型）且 span 单位写死，否则高亮必错位。
5. **chunk 是一等公民对象**：可列表/编辑/禁用/新增/加关键词（RAGFlow 契约）。
6. **配置必须配真实预览**；「模式锁定/参数可调」「仅本次会话生效」的作用域边界显式化；不可逆操作前置警告。
7. **发送/停止是同一控件的状态切换**；aborted ≠ error（停止保留部分内容+继续生成）。
8. **审计与分析分家**：管理员动作走审计（AI 事件也要入审计——Notion 9 大类含 MCP/agent 事件），用户行为走分析；两者口径透明（活跃定义/记录边界 notRecorded/保留期）。
9. **「启用 ≠ 健康」**：连接器健康 = 多离散信号 + 停滞阈值 + 不可关闭告警（Glean 模型）。
10. **对话历史有审计价值**：回滚文件但保留对话（Cursor 语义）。

---

## 市场空白总表（按杠杆排序的差异化机会）

1. **框架无关引用溯源族**（R2.1-R2.4）——全行业为零，企业前端栈五花八门是真痛点
2. **摄取管线状态组件**（R3.1-R3.3）——知识库独有语义，所有组件库不存在
3. **问数 SQL 修正 diff**（R5.2）——对话式产品全无，我们 ai-diff 白捡
4. **rerank A/B 对比**（R4.4）——含 Cohere 自家 playground 都没做
5. **权限降级态引用**（R2.5）——头部厂商都在检索期过滤，渲染期降级没人做
6. **usage 芯片**——无主流库标准化，**我们已占位**（补指标即成标准）
7. **MCP Apps 沙箱容器**（R7.4）——赌协议，一次实现对齐整个生态
8. **来源冲突卡**（R2.7）/ **重解析 diff**（R3.10）/ **无答案闭环工作流**（R6.3）/ **质量告警配置**（R6.5）——全行业空白的长尾
9. **多级分支导航**（R1.6）——LibreChat 悬置 issue，树状分支回溯没人做好

---

## 建议构建顺序

**第一波 P0（知识库身份，~13 件新组件）**：
引用 4 件（inline-citation / citation-card / sources-list / passage-viewer+jump）→ 管线 3 件（pipeline-timeline / chunk-editor / chunk-config+预览）→ 检索 2 件（retrieval-playground / score-bar+阈值）→ 问数 4 件（sql-card / sql-fix-diff / result-table 增强 / auto-chart 切换器）。
理由：这四族让库从「AI 聊天组件库」变成「AI 知识库组件库」，且全部踩在市场空白上。

**第二波 P1（企业落地，~20 件，多为底座扩展）**：
连接器健康 / 解析模板 / 元数据 / 抓取配置 / QA 编辑 / 混合权重 / rerank A/B / 召回测试 / 过滤构建器 / chunk 检查器 / 澄清卡 / 认证答案 / 口径解释 / 权限提示 / 多轮契约 / trace 树 / 标注队列 / 无答案分析 / 会话列表 / 反馈 / reasoning 契约对齐 / event-stream / tool-chain / plan 状态机。

**第三波 P2（前沿占位）**：
MCP 沙箱容器 / checkpoint / canvas 双栏 / ChatPart 协议 / graph & embedding map / eval 对比表 / 冲突卡 / 告警 / 版面叠加编辑 / 分支树。

---

## 来源总览（按域）

- 对话流：x.ant.design、assistant-ui.com、elements.ai-sdk.dev、llm-ui.com、docs.openwebui.com、github.com/danny-avila/LibreChat、github.com/vercel/ai-chatbot
- 引用溯源：docs.perplexity.ai（streaming citations cookbook）、platform.claude.com（Citations API）、learn.microsoft.com（Copilot Studio knowledge）、ai.google.dev（grounding）、developers.glean.com（Chat API fragment citations）、scrimui.dev、blog.google
- 摄取解析：ragflow.io/docs、docs.dify.ai（chunking/metadata）、www.coze.cn（knowledge）、docs.openwebui.com（workspace/knowledge）、docs.aws.amazon.com（bedrock connectors / kendra）、learn.microsoft.com（search import vectors）、developers.llamaindex.ai（LlamaParse）
- 问数：learn.microsoft.com（Genie tune-quality、Power BI Copilot）、docs.databricks.com（genie best-practices）、docs.snowflake.com（Cortex Analyst）、github.com/vanna-ai/vanna、github.com/Canner/WrenAI、learn.hex.tech（AI overview、Magic Fix）、julius.ai、help.tableau.com（Pulse）、docs.thoughtspot.com
- 检索调试：learn.microsoft.com（search-explorer）、qdrant.tech（web-ui、hybrid-queries）、docs.weaviate.io（additional-properties）、docs.pinecone.io、docs.cohere.com（rerank）、docs.dify.ai（test-retrieval、indexing-methods）、docs.ragas.io、atlas.nomic.ai、github.com/microsoft/graphrag、github.com/zilliztech/attu
- 编排：docs.dify.ai（nodes、debug、version-control）、x.ant.design（thought-chain）、docs.flowiseai.com、docs.langflow.org、docs.n8n.io、github.com/coze-dev/coze-studio、github.com/bytedance/flowgram.ai、manus.im/blog
- 观测评估：langfuse.com/docs（tracing/datasets/annotation-queues/prompt-version-control/sessions/metrics）、docs.langchain.com（annotation-queues）、braintrust.dev（compare-experiments）、arize.com/docs/phoenix、docs.wandb.ai、docs.helicone.ai、docs.ragas.io
- 管理面：docs.glean.com（connectors/monitoring、insights、audit-logs、access-verification、protect）、help.getguru.com（verification、card-manager、analytics）、support.atlassian.com（Teamwork Graph connectors）、notion.com/help/audit-log、elastic.co（workplace-search permissions）、learn.microsoft.com（agent-builder-add-knowledge、agent-builder-monitor、agent-settings）、docs.aws.amazon.com（kendra search-analytics）
- 组件库盘点：x.ant.design/components/overview-cn、assistant-ui.com/docs/primitives、elements.ai-sdk.dev/llms.txt、github.com/CopilotKit、llm-ui.com、ui.shadcn.com/blocks、github.com/jakobhoeg/shadcn-chat（停维护声明）、docs.chainlit.io、gradio.app/docs/gradio/chatbot、docs.streamlit.io、github.com/open-webui、github.com/run-llama/chat-ui、blocknotejs.org/docs/ai、hia2ui.com
- 前沿 UX：anthropic.com（artifacts、claude-3-7-sonnet）、openai.com（canvas、chatgpt-agent）、help.openai.com（tasks、agent）、docs.devin.ai、gist.github.com/shrisukhani/8be582bd（Manus UI 拆解）、blog.modelcontextprotocol.io（MCP Apps）、ai-sdk.dev（generative-ui）、cursor.com（agent、inline-edit、tab）、github.com/anthropics/claude-code（checkpoints changelog）、support.google.com（Deep Research）
