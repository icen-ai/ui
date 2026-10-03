# 更新日志

## 0.9.0 - 2026-10-03

> 知识库（kb）组件族全量落地：32 个新 slug（`kb` 总集 + 31 个组件，七域 + kb.css 基座 + kb-core 契约层），AI 族增强 3 件，图表 +2（图谱 / 地图）。业界模式逐条落地（Anthropic 引用三型 / Glean 连接器健康 / RAGFlow 分块审阅 / Cursor 检查点语义 / MCP Apps 沙箱 / Braintrust 评测分级 / Zanzibar 求值语义 / OWASP 检索前过滤铁律）。无破坏性变更。

### 新功能

**知识库组件族（32 slug · 七域）**——ai 族描述思考（过程），kb 族呈现证据（知识从哪来 / 可信吗 / 怎么用）

- **证据域**：kb-citation（行内角标 [n] + 三型定位 char/page/block，单位写死不猜）；kb-sources（来源清单 + rail 侧栏变体 + 权限打码与「申请访问」）；kb-passage（原文回看，命中高亮按命中级别分色）；kb-conflict（多源冲突并排声明）
- **摄取域**：kb-pipeline（解析管线五态 + 步骤耗时 + 重跑）；kb-chunks（分块审阅 + 手工补块，分块是一等公民）；kb-segment（分段配置器 + 实时预览与统计）；kb-connector（数据源连接器卡：4 离散信号 + cron/人类排程 + 凭证态，enabled≠healthy）；kb-metadata（抽取字段审阅）；kb-qa（问答对管理，改动显式「仅本次会话生效 / 入库」）
- **检索域**：kb-retrieval（playground：混合权重 α / 阈值 / topK + 存活计数随动）；kb-filter（过滤器构建器 → Mongo / OData 双 DSL 镜像，无效规则不镜像）；kb-rerank（A/B 重排对比 + Δ 箭头，关闭重排列压淡不隐藏）；kb-hittest（召回测试集 + 命中统计）
- **问数域**：kb-sql（NL→SQL 编辑 / 回滚 / 重跑 + 只读声明）；kb-answer（查询结果 + 行数截断诚实声明）；kb-clarify（澄清追问，选择即消歧）
- **治理域**：kb-explain（事实解释：命中原文 + 分数贡献，score null →「—」）；kb-trace（检索链路追踪，span 三态）；kb-review（人工评分任务流）；kb-gap（知识缺口队列，缺口可行动）；kb-eval（评测对比，improvement / regression / tradeoff / tie 四级）
- **工作台域**：kb-canvas（可编辑画布 + AI 助手 + 版本栈）；kb-checkpoint（检查点回滚，范围显式——只回滚文件保留对话）；kb-sandbox（MCP Apps 沙箱：iframe `allow-scripts` 无 same-origin + postMessage JSON-RPC 2.0 + `ui://` 资源）；kb-chain（能力链路图）
- **权限域（kb-perm，第二轮调研落地）**：kb-acl（文档权限面板：继承四件套 / Direct 与 Links 双区 / deny 置顶 / 系统态不可删 / 对 N 人可见警示）；kb-who-can（有效权限检查器：view-as + 扁平原因链——SharePoint Check Permissions 是业界唯一全实现，此为差异化件）；kb-access（访问申请流：被拒五件套 + 9 态状态机 + 路由明示 + denied 中性呈现 + 到期倒计时/续期/重交）；kb-audit（权限审计时间线：三通道过滤 + actor 三态 + break-glass 警示行 + 6 类权限异味）；kb-visibility（检索可见性对照器：admin 专用——同查询多身份命中差异 + 过滤层三态徽标 pre✓/post⚠/none✕ + 安全计数 + 泄露教学段）
- **权限安全纪律（spec §9.0，全族评审必查）**：检索期隔离唯一安全基线 = query-time pre-filter；**对授权侧诚实、对受限侧沉默**（被裁条数/标题/分数/「若权限不同」对照不出现在普通用户视图）；「不知道」与「不能说」不可区分；求值 = 先显式 deny → allow 并集 → 默认拒绝（fail-closed）；唯一允许的裁剪提示是与命中无关的恒定文案；引用只能生成自过滤后集合（revoked 历史引用呈中性「来源已不可用」）；每条 grant 可带 expiresAt；身份来自服务端固定身份集（不接受自由输入——Kendra 自报身份教训）
- **契约层 `kb-core.ts`**（无 UI 不占 slug）：引用 / 分数 / 分块 / 管线 / 连接器 / 分段 / 检索参数 / 过滤树 / 评测 + 权限域（KbRole 四档 / KbVisibility 五级 / KbAclEntry / KbIdentity / `evaluateAcl` 纯函数 / KbAccessRequest 九态 / KbAuditEntry / KbHygieneIssue 六类异味）等 60+ normalize 与格式化函数——分数纪律（metric + higherIsBetter + l2 反转 + null→「—」）与求值语义全族统一；`IcenEventMap` 新登记 45+11 个 `icen:kb-*` 事件
- 规格：`docs/spec/kb-family.md`（顶层设计唯一事实源，类名 / 签名 / 事件以它为准）；调研底稿 `docs/research/2026-10-03-ai-kb-components.md` + `2026-10-03-kb-permissions.md`（五路并发查证 100+ 来源，含事实更正记录）

**AI 族增强（3 新 slug + 2 存量）**

- 新增 ai-threads（会话线程树）/ ai-feedback（👍👎 + 理由弹层，事件带 el 定位）/ ai-branch（消息分支切换）
- ai-chat：推理块流式展开 → 完成后 1s 自动折叠一次（用户手动展开过则不再折）；中止 / 取消出「继续」钮（`icen:ai-retry`）
- ai-panel：AiUsageMetrics 指标行（TTFT / tokens-per-sec / finishReason）；todo 勾选描边动画

**图表 +2**

- chart-graph 关系图谱（`renderGraph` / `layoutGraph` 确定性布局，drag 局部松弛）与 chart-map 地理填色（`renderMap`）；charts 通用层增加 datum 明细（`ChartDatumDetail`）与聚类配色

### 存量增强与修正（权限安全化）

- kb-retrieval：参数栏新增「检索身份」（固定身份集）+ 过滤层徽标三态（pre ✓ 默认 / post ⚠「分数已可观察——缺陷层」/ none ✕「fail-open 危险」可切换教学）；存活计数去掉泄露分母（「存活 3」而非「3/6」）；admin 模式命中行附 ACL 可见性徽标
- kb-sources：`permission==='hidden'` 的来源不渲染行（检索层不可见 = UI 不存在）；三级 permission 与五级 visibility 映射成文
- kb-citation：引用白名单纪律入注；新增 `.is-revoked` 中性态（权限收回后的历史引用呈「来源已不可用」，faint 非红）
- **泄露式文案修正**：trace 的 guard span「1 条 L4 块已剔除」→「pre-filter 已按检索身份裁剪候选集」（恒定事实）；「命中 5 块（4 有分 + 1 受限无分）」→「授权集合内命中 5 块」——差值计数即 volume leakage，全部清除

### 文档站

- 新分组「知识库」（第三位，37 张新组件页，demo / 用法 / kit 三段齐全；文档数据在 `site/src/lib/kb-docs-*.ts` 四片段）
- 旗舰页 **/kb 知识库工作台**：八标签全真接线——问答（mock 打分器全流程：链路 → 流式答案 → 角标 → 来源 → 反馈，首屏自动演示）/ 摄取（连接器「治疗」闭环：重授权 → 恢复健康）/ 检索（playground + 过滤器 + 重排 + 召回测试 + 身份/过滤层徽标）/ 问数 / 观测 / **权限**（可见性对照 + ACL 面板 + who-can 原因链 + 申请流状态机走查 + 审计时间线含 break-glass）/ Agent（画布选区 → 对话 → 版本栈；MCP 沙箱 echo 往返）/ **参考**（32 条文献锚点：官方规范/论文/旗舰文档 + 发表时间 + 「本库采纳了它的什么决策」，升级抉择的回归点）
- 视觉 QA 收敛：连接器 cron 裸串破版（→ mono chip / 人类可读排程）、指标两列网格对齐、来源卡标题挤压、检索分数条失真（flex 伸缩 → 定宽轨道）、滑杆数值回显、DSL 断词（`2026-07-0 1`）、重排表窄栏截断、过滤器日期值截字、凭证呈现混排、问答首屏空态

## 0.8.1 - 2026-10-03

> 以重构与文档站为主：全仓库优雅轮（死代码 / 重复 / 契约漂移清扫）+ 文档站四件重设计与客户端换页，另含少量行为修复。无破坏性变更。

### 修复

- **kit 坏产物**：`kit/chart-calendar` 与 `kit/ai-tool-call` 两条入口 import 不存在的 CSS（消费方解析失败）；`build-css` 增加存在性守卫，坏登记即刻报错不再静默产出
- upload 列表模式下 Enter/Space 被区域级 keydown 吞掉（键盘用户无法移除文件）
- ai-chat 未读计数只增不减（消息清空后新增消息永远不计）；`renderAiMessage` 补 SSR 守卫；模型名 chip 不再混入复制文本
- date-picker 双幂等标记冲突（销毁后容器永不再接线）；select / date-picker 销毁时收浮层（监听不再泄漏）
- input / slider / split-pane / tabs / carousel / upload 六处「标记先于校验」——结构不完整的容器被永久标记，补全 DOM 后 init 不再接管
- steps 圆点变体的连线校准 20px → 5px
- tag-input 重复值 `.is-shake` 抖动反馈接线（CSS 承诺从未生效）；OTP 完成时挂 `.is-complete`
- ai-tools：`present: 'data'` 模式落地（此前仅有类型承诺）；`unregisterAiTool` / `getAiTool` 接线，`call()` / `can()` 改走注册表，全局下架联动摘除已挂载卡
- `renderAiDiff` 返回挂载元素（render* 全库约定统一）
- notification 全局 / 多容器双实现收敛为单一流水线（逐字段行为等价）；散点图 `formatValue` 真正生效

### 重构（库内，行为不变）

- AI 集群四处 `h()` / `AI_STATUSES` / `addUsage` 收敛至 ai-core 单一定义点；composer 三份过滤 / 空态装配合一；dropdown 手写定位统一进 `computePopoverLayout`；`emitMenuSelect` / `FOCUSABLE` 三份逐字拷贝收敛
- 删除死代码：`isAiContentPartArray`、`prevStatus`、`__icenTabsCleanup`、`ChartLegendState` 导出与 96 行无引用 CSS（tree 拖拽态 / upload 进度条 / donut 中心 / breadcrumb 下拉 / 死 keyframes 等）
- 注释诚实化：events 广播语义四处改准（`within` 收不到自 document 派发的广播）、PanelSizing 文档去除未实现字段等；AGENTS / README / spec 与实现逐条同步

### 文档站

- 页头重设计：滚动感应 hairline（顶端无界悬浮）、导航墨条（hover 滑移预览）、版本徽章替代口号标签、预设触发器改纯三色点
- 页脚重设计：六预设色尺（即主题切换器，与墨条 / 选择器经 `icen:theme-change` 双向联动）+ 可复制安装芯片 + 两行对称布局
- 文档侧栏：默认全收 + 深链开组、滚动条隐藏、scroll-timeline 上下渐隐（方向感知）、组开合记忆（客户端换页保留手动展开 / 真刷新归零）
- 文档域客户端换页：ClientRouter + 页头页尾 `transition:persist` 常驻，hover 预取，导航墨条跨页滑移
- 站点修复：switch 页悬空 `});` 致整页接线失效、upload / date-picker 演示脚本 TS 语法泄漏进 `new Function`、primitives 未闭合 section、Docs 布局缺 chart-scatter.css（散点 demo 裸奔）、首页 kit 统计口径（77）

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
