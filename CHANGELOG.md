# 更新日志

<!-- 记录纪律（docs/versioning.md）：破坏性变更只进 minor，且以契约快照
     （docs/contracts/snapshot.json，bun run contracts 守卫拦截未留痕增删）
     为准逐条写明；按层分节——Core 的破坏置顶逐条公告，Beta（图表/AI/KB）
     段落单列。0.x 收敛期无外部用户：不留兼容层、不写迁移指南；
     迁移设计从 1.0 起才成为义务。 -->

## 0.10.0（开发中，未发布）

首个版本。当前形态一览：

- **设计令牌**：6 套色彩主题（现代 / 东韵 / 巨构 / 钢琴 / 莫奈 / 梵高）× 4 套设计原语（现代 / 中式 / 苏式 / 像素）× 明暗双模，全部挂在 `<html>` 的 data 属性上；配色目录单一事实源 `src/tokens/themes.json`
- **组件**：122 个无框架组件 slug（CSS 契约 + 按需行为 JS）；类名统一 `icen-` 前缀、钩子统一 `data-icen-*`、变量统一 `--icen-*`，产物全部进 cascade layers
- **AI 原生族**：会话 / 推理 / 工具调用 / 审批 / 输入台 / 用量与审计，7 态状态机 + 多模态内容模型 + provider 适配层 + UI-as-tool 工具体系
- **知识库族**：32 个组件覆盖 RAG 全链路（证据 / 摄取 / 检索 / 问数 / 治理 / 工作台 / 权限），权限域 fail-closed 语义由测试强制执行
- **图表**：ChartSpec 纯 JSON 通用层，13 种图，交互与 tooltip 内建
- **工程基座**：bun test + 12 项纪律守卫 + Playwright 浏览器验收；i18n 双语注册表；RTL 逻辑属性；设计工具导出（DTCG / Tokens Studio / Figma Variables）
- **发布链**：git tag → GitHub Actions OIDC trusted publishing → npm（带 provenance，无长期 token）

### 分层与契约加固（1.0 门禁批次）

- **Core/Beta 边界钉死**：`docs/contracts/stability-tiers.md` 新增「边界规则」表（Beta 生产可用性 / 破坏随 minor / 弃用 ≥1 个 minor 公告期 / 晋升 Core 五条标准 / 聚合入口定级）；新增守卫 `tier-direction`——**Core 模块运行时 import Beta = CI 红**（类型级引用须 `guard:allow-beta-type` 登记、CSS 横切适配须 `guard:allow-beta-ref` 或文件级白名单）
- **解耦（契约面变化）**：内置 AI 工具 `show_form` 的注册从 `form-validate.ts`（Core）移至 `ai-tools.ts`（Beta → Core 方向）；`import 'form-validate'` 不再有注册副作用，改用工具系统请引 `behaviors/ai-tools`；`form-validate` 新增导出 `runShowForm` / `SHOW_FORM_SCHEMA`（additive）
- **类型契约进快照**：公共契约快照新增第六面 `types`（648 条类型签名：函数/接口字段/类型别名/类成员，TS 编译器 API 从 `src/index.ts` 导出面抽取）；签名变化与移除 = breaking、新增 = additive，`bun run contracts` 分类报告，类型破坏不再能静默通过 CI
- **行为 conformance 套件**：`tests/conformance/`（125 用例 / 710 断言）把 Core 组件行为语义固化为可执行契约——26 个组件的 init 幂等 / destroy 清理 / 事件登记与时机 / 键盘焦点 / XSS 文本纪律；期间修复两个真实 bug：**command-palette Enter 选中 DOM 条目双派 `icen:menu-select`**（收敛到 click 路径单派）、**tree 点击 toggle 的 `icen:tree-toggle` detail.open 与键盘路径语义相反**（统一为切换后状态）
- **安全回归语料**：新增 `src/behaviors/url-safety.ts`（`safeUrl` 协议守卫唯一事实源）+ `tests/unit/url-safety.test.ts`（51 条对抗语料 + 23 条槽位端到端断言）；**修复 kb-explain 链接守卫的两个真实 XSS 绕过**（内嵌控制字符 `java\tscript:`、C0 控制符前缀）；补齐裸奔槽位：notification 的 link/avatar、ai-chat 的媒体 src
- **封装版本矩阵 CI**：`wrapper-compat-react`（React 18/19）与 `wrapper-compat-vue`（Vue 3.3/3.5）两条 matrix 线进 `ci.yml`，四条线本地实测全绿——`react>=18` / `vue>=3.3` 的 peer 声明从此有机器背书（`docs/frameworks.md` 同步）
- **陌生人验收（dogfood）**：零上下文代理只凭 npm 产物 + llms-full.txt + 文档站完成真实页面（登录表单/数据表/筛选/弹窗/主题切换，Playwright 实测 26/26 通过），8 个卡点全部处置（`docs/dogfood.md` 有清单）——修库三处：**form-validate 复验位移吃掉提交点击**（指针按下期间推迟结构变更，抬手后补齐）、**datatable 自定义 pageSize 不回显分页下拉**（并入候选）、**未配 summaryRow 渲染空壳行**（不再渲染）；修文档五处：CSS 引入两形态口径（ui.css 全量单文件 / tokens.css 按需底座 + 纯静态 `<link>` 与 file:// 提示）、明暗二态契约（亮=移除属性，无 `"light"` 值）、select 事件 `icen:select-change` detail 形状进文档
