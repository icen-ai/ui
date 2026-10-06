# 更新日志

## 0.10.0 - 2026-10-06

> **v0.10 = 全面工程跃迁**（1.0 契约冻结点由维护者后续拍板）。命名空间全量前缀化（类名防冲突终态）+ cascade layers、测试基座（588 测试 + 8 项纪律守卫 + 浏览器验收舱 CI）、i18n 注册表（683 key 双语）+ RTL 逻辑属性全量迁移 + 移动触屏层、表单校验层 + 表单族四缺口组件、UI-as-tool 深化、React/Vue 官方薄封装、datatable/charts 重度数据场景、权限/诚实纪律测试化、设计工具导出（Tokens Studio / Figma Variables）、信任文档（SECURITY/CONTRIBUTING/versioning）。**含破坏性变更**（类名/data 属性/CSS 变量/主题类全面改名），自带 codemod：`bunx @icen.ai/ui migrate src --write`。

### 破坏性变更（v0.9 → v0.10，codemod 全自动）

- **类名一律 `icen-` 前缀**：`.btn` → `.icen-btn`、`.kb-citation` → `.icen-kb-citation`（1675 个类全量）；唯一例外 `.is-*` 状态类（纪律：永不单独出现，永远与根类复合，天然隔离）
- **主题层从类改为 data 属性**：`<html class="piano dark">` → `<html data-icen-preset="piano" data-icen-theme="dark">`；风格 profile 同理 `data-icen-style="retro"`；密度 `data-icen-density`（`.dark` 是全业界最危险的类名，类形态废弃）
- **库 data 钩子一律 `data-icen-*`**（236 个全量： `[data-tabs]` → `[data-icen-tabs]` 等）；**全局 CSS 变量十五族一律 `--icen-*`**（`--token-*` → `--icen-token-*`、 `--density-*` / `--radius-*` / `--duration-*` / `--ease-*` / `--z-*` / `--font-*` / `--accent-*` / `--bg-*` / `--text-*` / `--border-*` / `--color-*` / `--shadow-*` / `--line-height-*` / `--letter-spacing-*`）；组件作用域变量（`--btn-*` 等）不前缀（继承链随根类已隔离）
- **领域值与协议键保持不动**（迁移期误伤已全量回正并锁防）：排序方向 `'asc'|'desc'`；ARIA role 值（switch/checkbox/menu/tree/alert 等 WAI 标准）；`input type=checkbox`；AI kind/tint 域（'chart'/'accent'）与图表 tone/type 域（'accent'/'stack'）；swipe 方向 `'up'|'down'`；JSON-RPC `result` 键；过滤器 `'numeric'` 型；SQL 高亮 `'num'` 型；兼容事件 `otp:complete`；元素选择器（'input[type=file]' 等）；原生事件名（'input'）；模块/slug/kit 路径
- **BEM 修饰族 JS 模板与 CSS 同形态**：`icen-ai-msg--*`/`icen-ai-diff-line--*`/`icen-ai-tool--*`/`icen-notification--*`/`icen-ai-usage-ring-*` 等九族修饰模板已对齐；新增**第 8 项守卫「类名同步」**（JS 引用未前缀类 ∩ CSS 仅前缀族 → CI 红）永久防复发
- slug / kit 路径 / 包导出路径全部不变（`@icen.ai/ui/kit/btn` 照旧）

### 品牌级 AA 收口（accent 明度分档）

- 新增 `--icen-token-accent-strong`（12 面）：**承文本填充档**——实心主按钮/选中态/徽标等「accent 底 + on-accent 字」的面全部切到 strong，六预设 × 明暗实测对比度 4.79–10.84 全部过 WCAG AA（clay 白字橙钮 2.96→5.16）。`accent` 亮档保留给图标/边框/数据可视化等纯图形面
- 修正 `--icen-token-on-accent` 两面：clay dark 白→深棕黑（6.87）、vangogh light 米白→深靛（5.90）；piano 维持「金底乌木字」既有 AA 设计
- 站壳次级文字 `text-faint` 与 `accent-text` 再提一档过纸白 AA；表单 valid 标签新增 `--icen-token-success-text` 文本安全绿

### 修复（0.10.0 全量审计收口）

- 站点：文档站 Docs 布局组件 CSS 改 glob 全量引入（修 v0.10 五件漏引裸奔）；demo 宿主 shrink-wrap 宽度契约补齐；输入壳高度契约（多行 textarea 不套单行固定高壳）
- 组件：accordion 收起态块距动画化（修 0fr 轨道 padding 泄露首行）；media-card hover overlay 自带下圆角（backdrop-filter 不被祖先圆角裁切的浏览器行为免疫）；ai-usage 环 svg 固有尺寸兜底；kb-access 锁图标尺寸契约；kb-meta nowrap 补省略截断（修长文本横向盖邻列）
- 巡检工具固化：`scripts/audit-visual.mjs`（双站像素对拍 + 页内断言：巨型/隐身 svg 64px 阈值、文本硬裁切、空色板、黑盘、裸 JSON、JS 错误）+ `scripts/audit-interact.mjs`（12 组件真实交互巡检）

### 新功能

- **cascade layers**：全部产物 CSS 包进 `@layer icen.tokens / icen.base / icen.components`——消费方无层样式永远赢库样式（放心覆盖），层序由 tokens.css 顶部声明锚定
- **命名空间迁移 codemod 随包发布**：`bunx @icen.ai/ui migrate <paths...> [--write]`（API 感知 tokenizer：createElement/选择器/classList/属性名语义分流，歧义 token（类名∩标签名∩领域词）保守跳过并给人工清单；映射冻结于 `migrate-map.json`）
- **测试基座**：bun test + happy-dom；`bun run verify` = tsc + guard + test + build；CI 四道门（`.github/workflows/ci.yml`）+ 浏览器验收舱 e2e（Playwright 真实 Chromium：视觉回归基线 + axe-core a11y 扫描，`.github/workflows/e2e.yml`）
- **纪律守卫 `bun run guard`**（8 项）：CSS 纪律（hex/z-index/keyframes/滚动条/!important/头注释契约）· registry 一致性（slug×css×behavior×init×exports）· 事件纪律（emitIcen 字面量 × IcenEventMap 双向核对，禁裸 CustomEvent）· 行为模块纪律（SSR 守卫/innerHTML 禁令）· 命名空间（icen- 前缀 + 业界碰撞面 59 类基准恒零）· 权限域诚实呈现（泄露文案模式扫描 + evaluateAcl 纯函数形态钉死）· RTL 逻辑属性（流向物理属性禁令 + 豁免登记）· 类名同步（JS 模板/选择器引用的类与 CSS 定义同形态——v0.10 迁移期 BEM 修饰族错位事故的永久防线）

**设计哲学与统一覆盖（docs/spec/design-philosophy.md + 主题工作台）**

- 新增设计哲学规范：八条元原则 + 十维细则（色彩/几何/深度/动效/排印/密度/图标/材质/明暗/正交轴）+ 六预设人格 + 业界对标矩阵（Apple 同心圆/Primer 语义色/Fluent 海拔/Carbon 密度/Polaris 无障碍…）+ 统一覆盖三层架构 + 十条红线
- **圆角几何契约**：同心圆法则（R内=R外−间距，calc 表达）、胶囊 full 与正圆 50% 语义分家、容器禁跑道形；守卫新增「圆角纪律」（禁裸 999px/撞档裸值，微构件登记制，29 处存量已登记）
- 文档站「定制」页新增**主题工作台**：预设/明暗/风格/密度/accent/圆角基准六旋钮实时预览（全用本库组件搭建），accent 明度三档对比度实时验算并诚实展示达标与否，一键复制生成的覆盖 CSS 片段

**i18n 本地化层（新模块 `i18n.ts`）**

- `IcenLocale` 683 key 全量注册表（行为层每一句面向用户的文案——AI 族/kb 族/charts/datatable/表单族/控件族全覆盖）；`setIcenLocale(patch)` 合并 + `icen:locale-change` 广播（changed keys 精确）+ `resetIcenLocale()`；内置 `ICEN_LOCALE_ZH_CN`（默认）与 `ICEN_LOCALE_EN_US` 完整双语
- 行为级验收：切 en 后代表性组件 DOM **零 CJK 字符**（tests/dom/i18n.test.ts）

**RTL 与逻辑属性（51 个 CSS 文件审计迁移）**

- 292 处流向属性改逻辑属性（margin/padding/border/inset-inline-* 等）+ 37 处 text-align start/end；16 条 `[dir="rtl"]` 镜像规则（方向性 chevron/箭头/抽屉滑向）
- 物理坐标豁免纪律：浮层 JS 坐标/图表坐标系/物理隐喻控件（switch 拇指）/数字列——96 处行内豁免带理由 + 图表/diff/tooltip 文件级豁免；新增 guard 第 7 项强制新代码不再引入流向物理属性
- 消费方零接线：`<html dir="rtl">` 即生效

**移动/触屏层**

- 手势层加 `swipe`：`data-icen-gestures="swipe"` → `icen:swipe-left/right/up/down`（48px 阈值 + 主轴判定 + 垂直滚动脉络不吞事件 + click 消歧共存）；carousel 在 `pointer: coarse` 下自动开滑动翻页
- 触屏目标尺寸底线：pointer:coarse 下交互基元 ≥40px（WCAG 2.5.5 工程折中，`max(var(--icen-density-input-height-md), 40px)` 逻辑属性形态）；hover 守卫全库审计（10 处裸抬升修复进 `@media (hover:hover) and (pointer:fine)`）

**设计工具导出（设计-开发闭环）**

- `bun run design-tokens` → `dist/tokens/tokens-studio.json`（Tokens Studio：12 组 theme 直映射 DTCG）+ `dist/tokens/figma.variables.json`（Figma Variables：6 collection × light/dark，RGBA 浮点 + rem×16 换算 + 别名解析，不可表示项诚实跳过并打印）

**表单族四缺口组件（新 slug）**

- `cascader` 级联选择：多列面板 + 跨级搜索（命中显示面包屑路径）+ changeOnSelect + 全键盘 + combobox/listbox aria 完整
- `tree-select` 树选择：多选 chips / 三态勾选（父=子孙并集，mixed 诚实）/ 搜索自动展开祖先 + 高亮 / RTL 镜像方向键
- `mentions` 提及：`@query` 触发（行首/空白边界，email 不误触）+ 镜像 div caret 定位 + 异步源竞态守卫 + 删除同步摘除（诚实一致性）+ IME 挂起
- `autocomplete` 自动补全：WAI combobox 完整模式 + freeSolo 两态 + 命中 `<mark>` 高亮 + 异步竞态
- AI 工具内置 +1：`render_datatable`（columns/rows 纯 JSON → createTable 挂载，搜索/分页/CSV 默认开）

**信任基础设施文档**

- `SECURITY.md`（版本支持表/私密报告渠道/响应承诺/安全设计要点对应可验证机制）· `CONTRIBUTING.md`（四道门/加组件六步仪式/guard 速查表）· `docs/versioning.md`（0.x 纪律：breaking 只在 minor 且必配 codemod；1.0 冻结 checklist）· GitHub issue 表单 ×2

**表单校验层（新 slug `form-validate`）**

- 原生约束即 schema（required/type=email/minlength/pattern/min/max/step 零新词汇）+ `data-icen-validate` 承载额外规则（`matches:字段` 跨字段、`registerValidator` 具名异步校验）+ `data-icen-msg-<rule>` 与 `setValidateMessages` i18n
- UX 策略 = 业界最佳形态：submit 优先 → 出错字段 input 即时复验 → 未触碰字段 blur 补验；`.is-error` + 自动 `role="alert"` 错误节点 + aria-invalid/describedby 接线；可选顶部错误汇总锚点；异步 `.is-validating` + 序号竞态守卫；IME 组合态挂起
- `createFormValidator` 程序面 + `initFormValidate` 委托面 + `icen:form-field-validate/form-valid/form-invalid` 事件族

**UI-as-tool 深化（ai-tools）**

- 四族模型侧导出：`aiToolsToOpenAI` / `aiToolsToMcp` / **`aiToolsToAnthropic`** / **`aiToolsToAiSdk`**（共享同一归一管线）
- 参数校验 `validateToolArgs`：JSON-schema-lite（type/required/properties/enum/items/min/max…），**不支持的关键字不猜不静默**——进 `unvalidated` 清单；校验失败挂错误态卡不执行
- 执行契约：`run` 允许返回 Promise（area await 落定结果）；`timeoutMs` 超时信封；`requiresApproval` 审批流（挂载卡批准/拒绝，`icen:ai-tool-approve/reject`）；`idempotent` 在途去重；`ctx.signal` + `ctx.progress` 活动流
- 内置工具 +1：`show_form`（模型渲染结构化表单收集输入，提交 resolve 值/取消 resolve `{cancelled:true}`，走 form-validate 校验层）

**React/Vue 官方薄封装（`@icen.ai/ui/react` · `@icen.ai/ui/vue`）**

- 原语 `useIcenInit` / `useIcenEvent` + 工厂 `createIcenComponent` / `createVueRenderer` + 旗舰组件 `Chart` / `DataTable` / `AiComposer` / `AiMessage` / `AiToolCall`（React）与 `IcenChart` / `IcenDataTable` / `IcenAiComposer` / `IcenAiMessage`（Vue）
- 只做生命周期接线（mount→create、props 变→update、unmount→destroy）与事件桥（onIcen + AbortController）；零状态复制；react/react-dom/vue 全为 optional peer；React 入口自动打 `'use client'`
- 文档站新页 [/frameworks](https://ui.icen.ai/frameworks/)（两框架最小接入示例 + SSR 注意事项）

**datatable 重度数据场景（v2 增强）**

- 多列排序（Shift+点击，徽标优先级）/ 列拖拽重排（冻结分区互不跨越）/ **右冻结**（`frozen: 'left'|'right'`）/ **行分组 + 聚合**（组头折叠跨 setData 保持，`computeAggregates` 纯函数）/ **单元格编辑**（text/number/select，事件+回调双通道，宿主决定采纳）/ **汇总行**（sticky 表尾，按筛选后数据实时重算）/ 键盘导航（roving tabindex + PageUp/Down 跨页）+ TSV 复制
- 新事件：`icen:table-cell-edit` / `table-column-reorder` / `table-group-toggle` / `table-column-resize`（拖拽结束才派）

**charts 重度数据场景**

- **LTTB 降采样**（`spec.downsample`，导出纯函数 `lttb`；抽样时头部诚实提示「已抽样 N→M 点」）；**缩放/刷选**（`spec.zoom: 'x'|'brush'`，`icen:chart-zoom` 事件，位移 <5px 不拦截点击）；**标记线/标记点**（`spec.marks` 纯 JSON，无效项 warn 不炸）；**流式追加**（`handle.append(label, values, { maxPoints })`，缩放窗跟尾）；**导出**（`handle.toDataURL`，SVG→canvas 光栅化，SSR/无 canvas 诚实返回 undefined）；**加载态**（`spec.loading` 骨架 shimmer，优先于空态）

**权限/诚实呈现纪律：从文档纪律升级为测试强制执行的工程契约**

- 一致性测试套件 `tests/kb-conformance.test.ts`：spec §9.0 八条安全纪律逐条自动化证明（受限标题不出现 DOM / 分数 null→「—」/ 轨道定宽 / revoked 引用中性 / 截断声明 / DSL 无效规则不镜像 / admin 对照警示常驻）
- `evaluateAcl` 补 **expiresAt 求值语义**（过期条目不计入、全过期 fail-closed、decision 带最近将来到期；第 4 参 `now` 可注入——守卫钉死纯函数形态）
- 修复现行违规：kb-trace null 分数假条（0% 宽度）、kb-ops trace 轨道伸缩

### 修复

- **initSwitch 开关/复选整体失效**（委托与分流的 role 匹配不一致——迁移期捕获，测试锁定）
- **ai-provider 审计聚合恒为空**（`addUsage` 非破坏性返回值被丢弃——summary/totals/byModel 三处）
- **select destroy 后永久无法再 init**（面板 portal 到 body 未归位；销毁时归位，Astro 换页场景修复）
- **inferKind('render_chart') 误推未注册 kind**（codemod 残留）
- **ChartHandle.spec 快照名不副实**（改 getter，update/append 后读到最新）
- **charts 单系列 pivot 数据丢失**（无 series 字段时矩阵为空——Phase A 测试当场抓获）
- CSV 导出 BOM 字面量转义歧义

### a11y 既有债清偿（浏览器验收舱 axe 扫描驱动）

- **datatable 网格角色链补全**（critical）：`role="grid"` 下表头一律 `columnheader`、正文/汇总/分组格一律 `gridcell`
- **图表 SVG 一律 `aria-label`**（标题 + 图型；渲染管线单点注入，axe svg-img-alt/role-img-alt 清零）
- **datatable 可编辑格可访问名含当前值**（label-content-name-mismatch：`{值}（双击或按 Enter 编辑「{列}」）`，i18n key `datatable.editHintWithValue`）
- **全预设 `--icen-token-text-faint` 对比度提到 WCAG AA ≥4.5:1**（12 面逐一按各自背景计算，只动 faint 这一装饰层级；muted 原本已 ≥6:1）——品牌级变更，视觉差异极小
- **新增 `--icen-token-accent-text`**（12 面逐一计算，文本级 accent 全过 AA；`.icen-btn-link` 等小字号文本 accent 场景改用）——品牌填充色 `--icen-token-accent` 不动；**注**：`.icen-btn-primary`（白字 × accent 填充 = 2.96:1）是既有品牌级取舍，锁存在 a11y 基线在案，若要走 AA 可把主按钮底色切到 `#a84e2e` 系或改深字，由维护者定夺
- 文档站：代码块 `pre` 可滚动区加 `tabindex="0"`（键盘可达）；SiteHeader 品牌版本号 aria-hidden + 两个 select 触发器改 aria-labelledby（可访问名含可见文本）
- 残余债务锁存进 `tests/e2e/a11y-baseline.json`（**只许减不许增**门禁：修复即核销，新增即 CI 红）——站壳次级文字与 clay accent 品牌色的对比度属遗留设计决策，文档化在案

### 迁移指南

```bash
bun update @icen.ai/ui          # 升到 0.10.0
bunx @icen.ai/ui migrate src --write   # 官方 codemod（dry-run 先看不加 --write）
# 主题层若手写过 classList.add('dark') 等：改为 data-icen-theme="dark" / setTheme()（codemod 会给出人工清单）
```

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
