# 更新日志

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [SemVer](https://semver.org/lang/zh-CN/)；
0.x 纪律（破坏只进 minor、逐条公告、收敛期不留兼容层）见 [docs/versioning.md](docs/versioning.md)。
契约面变化以 [docs/contracts/snapshot.json](docs/contracts/snapshot.json) 的机器 diff 为准
（`bun run contracts:diff <tagA> <tagB>`，CI 强制破坏性条目必须在本文件留痕）。

## [Unreleased] — 目标 0.11.0（含破坏性变更）

### 安全性

- **修复两个真实 XSS 绕过**（kb-explain 链接守卫：内嵌控制字符 `java\tscript:` 与 C0 控制符前缀），新增 `safeUrl` 协议守卫唯一事实源 + 74 条对抗语料与槽位断言；补齐裸奔槽位（notification 的 link/avatar、ai-chat 媒体 src）
- 全组件精修：7 项 P0 与 27 项逻辑缺陷修复（XSS、焦点、对比度、触达面）

### 破坏性变更（Core）

- 内置 AI 工具 `show_form` 的注册从 `form-validate`（Core）移至 `ai-tools`（Beta）：`import 'form-validate'` 不再有注册副作用，改用工具系统请引 `behaviors/ai-tools`；`form-validate` 新增导出 `runShowForm` / `SHOW_FORM_SCHEMA`（additive）

### 设计（macOS-inspired 全仓库重构）

- 全局原生滚动条统一无箭头路径，修复标准 scrollbar 属性覆盖伪元素皮肤；新增 `initScrollArea` 委托活动跟踪与 auto/scroll/visible/hidden 子树策略，支持尺寸、内距、轨道、滑块、留槽、闲置延时及过渡控制。键盘聚焦与强制颜色保留可见性，无脚本时保持可见；文档侧栏和 Inspector 统一接入，设置中的稳定宽度与显示策略解耦。规格见 `docs/spec/scrollbars.md`。

- 默认 modern 原语升级为桌面精度体系：控件 28/34/42px、界面字号 13px、圆角 5/8/10/14/20px、表面层级 canvas→content→chrome→floating→modal、状态填充 hover/pressed/selected 分离、动效 110/180/260ms 与四种缓动；六套配色与中式/苏式/像素原语保持独立身份，全部经 token 覆盖继续工作
- 组件覆盖：按钮/输入/选择/菜单/分段/开关/复选框/滑块/日期/级联/树选择/上传/标签输入/提及/自动补全；顶栏/侧栏/工具条/标签页/面包屑/分页/步骤/表格/DataTable/列表/树/折叠/时间线/描述/卡片/面板/指标/空态/徽标/键盘键；弹窗/菜单/popover/tooltip/命令面板/toast/通知/警示/进度/加载/骨架/复制；图表基座与 AI/KB 族表面语法。全部组件登记于 `docs/redesign/macos-component-mapping.md`
- 行为增强：`select` / `tree-select` / `cascader` 不再移除作者提供的 chevron（弹出方向暗示恢复）；`checkbox` 选中改用勾选 glyph；`slider` 轨道/拇指桌面比例；`switch` 38×22；`modal` 表面/底栏/关闭钮收口
- 文档站改为原生应用式 shell：52px 工具栏、源列表侧栏（分组图标/计数/整行选中）、44px 内容工具栏、组件页 Preview 工具栏 + 右侧 Inspector、代码区 34px chrome 头 + 12px mono；新增 `/apps/` 四个真实应用组合（系统设置 / 文件与知识库 / AI 工作台 / 数据工作台）
- 新增设计交付文档：`docs/redesign/macos-design-language.md`、`macos-component-mapping.md`、`macos-token-architecture.md`、`macos-redesign-progress.md`、`visual-quality-report.md`、`progress.json`
- 设计规范同步：`docs/spec/design-philosophy.md` 圆角表与 `docs/spec/design-primitives.md` 作者旋钮改为 10px 基准 / 34px 控件 / 13px 界面字 / modern 实面材料；契约快照随新增 token 更新
- 收尾补齐（原「继承基座」项全部落为逐文件精修）：13 种图表统一网格/基线/轴标/数据点/图例墨色，折线与面积图数据点可悬停放大，面积图补齐可交互数据点与命中圆，环图间隙按弧长封顶，保留极小非零值，柱图轨道内置网格、堆叠段留面色缝，热力格 3px 圆角 + 色环 hover，日历月份/星期标签 10px，雷达蛛网改实线发丝，散点补坐标轴类，图谱边与节点 hover/drag 分层；KB 7 域逐文件统一可缩放的密度控件、中文下限 12px 字阶、`--icen-ring` 焦点、`fill-hover/pressed` 成对、整行选中替代左侧竖条，并补 compact 密度档
- 无障碍矩阵：高对比模式补全开关/勾选/单选/分段/表格选中行/选择器选中项/侧栏当前项/图表与 KB 状态件，全局补 `:focus-visible` 系统焦点兜底（强制颜色会丢弃 box-shadow）；`prefers-reduced-transparency` 下浮层回落实面；200% 缩放（720px CSS 视口）全站无横向溢出

### 修复

- modern 操作面使用不透明表面，控件／卡片／弹窗采用 8/14/20px 的语义轮廓；补齐嵌套密度字号与 `--icen-density-item-height`
- 修复重复缓动导致浏览器忽略动效、环图微小正值消失、加载按钮指示器透明；CSS 守卫防止重复缓动回归
- 修正 controls 初始化函数的返回类型为销毁函数（运行时行为不变），支持框架生命周期正确清理
- 应用组合页接通设置持久化、资料筛选/分页/本机导入、AI 本机流式发送/停止、真实图表切换；修正权限样例；文档换页销毁演示行为监听
- 新增可重跑的全 Registry 截图清单与六配色、四原语、密度矩阵脚本 `scripts/design-review.mjs`
- 设计工具导出修复：解析有限的带单位计算表达式；默认桌面矩阵排除媒体条件误覆盖；补全控件/字段/字号/字重分组，保留未知表达式的明确跳过记录
- 站点语言自动检测（`navigator.languages`）使 e2e 在英文 locale 下全站变英文、中文断言全红——playwright 配置钉死 `locale: zh-CN`，验收舱与环境 locale 解耦
- SiteHeader 语言切换器可访问名不含可见文本（axe `label-content-name-mismatch`）——改 `aria-labelledby` 复合命名
- 六处展开态 axe 对比度违规修复：avatar 首字母与用户消息头像改用承文本档 `accent-text`（accent 亮档只做图形）、kb-pipeline 错误正文与站点 demo 色块由 muted 提为正文色、notification 操作钮去 muted 化
- e2e 测试代码漂移清偿：顶导外观控件统一为 `#appearance-select`（预设/原语二选一并入三轴面板）、明暗二态契约在测试侧对齐（禁写 `"light"` 值）、tabs roving tabindex 断言对齐 APG 焦点跟随契约、首页复制钮 `.install-copy` → `.pm-copy`、mentions 异步目录等待条件加固
- 文档站组件页新增「接口」区块（导出 / 事件 / 类型指针），由 slugs 登记表与行为源码构建期自动生成，不手填不漂移

### 新增（工程基座）

- 稳定性分层落地：Core（1.0 冻结轨道）/ Beta（图表、AI、KB 三族），事实源 `docs/contracts/tiers.json`，构建期盖章 `registry.json`，文档站组件页徽标同源；新守卫 `tier-direction`——Core 运行时 import Beta 即 CI 红
- 公共契约快照新增 `types` 面（TS 编译器 API 抽取导出面规范化签名）；新增 `bun run contracts:diff <refA> [refB] [--gate core]`——tag 间契约 diff + 分层过滤（1.0 判定与未来迁移页骨架共用）
- 行为 conformance 套件 `tests/conformance/`（26 个 Core 组件的 init 幂等 / destroy 清理 / 事件契约 / 键盘焦点 / XSS 文本纪律，125 用例）；抓出并修复两个真实 bug（command-palette Enter 双派事件、tree toggle 事件语义相反）
- 封装兼容矩阵 CI：React 18/19 × Vue 3.3/3.5 四条版本线实跑封装契约测试
- 弃用纪律机器化：`@deprecated 用 X 替代（<次版本> 移除）` 约定 + 守卫（无移除版本 / 公告期不足一个 minor / 到期未删 = CI 红）
- 体积预算（`docs/contracts/size-budget.json`）与覆盖率棘轮（`docs/contracts/coverage-floor.json`，lcov 口径）进 CI
- 包面检查 `bun run check:pkg`（publint + attw）；kit 子路径补齐类型面（`dist/components/<slug>.d.mts`）；修复声明文件 specifier 指向 `.js` 导致 node16 类型解析失败的缺陷
- 发布链：publish.yml 发版前跑全部门（tsc + guard + test + build + size + check:pkg）+ 校验 tag 与版本一致 + 发布成功自动建 GitHub Release
- CI 联动检查：契约快照含破坏性条目时 CHANGELOG 必须同 PR 改动
- dependabot（bun × 2 + github-actions）、PR 模板、issue 入口配置、CODE_OF_CONDUCT、LICENSE、.editorconfig
- 陌生人 dogfood 首轮验收：26/26 通过；3 处修库（form-validate 复验位移吃点击、datatable pageSize 回显、空 summaryRow）+ 5 处修文档，清单见 [docs/dogfood.md](docs/dogfood.md)
- 文档站：全站中英双语（4034 条词典）、hero 品牌化

## [0.10.0] — 2026-10-19

0.x 收敛线的起点：主题×原语矩阵、对象化提及输入、契约治理基座引入前的最后形态。

- 设计令牌：6 套色彩主题 × 4 套设计原语 × 明暗双模，全部挂在 `<html>` data 属性；配色单一事实源 `src/tokens/themes.json`
- 组件：122 个可安装 slug（CSS 契约 + 按需行为 JS）；类名 `icen-` / 钩子 `data-icen-*` / 变量 `--icen-*`；产物全部进 cascade layers
- AI 原生族：7 态状态机 + 多模态内容模型 + provider 适配层 + UI-as-tool 工具体系
- 知识库族：32 个组件覆盖 RAG 全链路，权限域 fail-closed 语义由测试强制
- 图表：ChartSpec 纯 JSON 通用层，13 种图，交互与 tooltip 内建
- 发布链：git tag → GitHub Actions OIDC trusted publishing → npm（provenance，无长期 token）

## 历史版本（0.1.0 – 0.9.0）

早期快速迭代期未逐条记录 changelog（npm 与 tag 可考）。要点：

- **0.9.0**（2026-10-03）：kb 族权限域（kb-perm）五件套 + `/kb` 八标签工作台
- **0.8.x**（2026-10-02）：AI 原生组件族与知识库族主体落地
- **0.5.0**（2026-07-29）：全量组件工程级强化
- **0.4.0**（2026-07-29）：图表细分类型 + 表格强化
- **0.3.0**（2026-07-29）：datatable（搜索/排序/筛选/分页/虚拟滚动）+ kit 一行入口与 CLI
- **0.2.x**（2026-07-28）：组件体系大扩编（31 组件 + 19 behaviors，复刻 opengal 体系）
- **0.1.x**（2026-07-28）：首个 npm 发布（tokens + 基础组件）

（0.6 / 0.7 未发布；0.1.0 无对应 git tag。）
