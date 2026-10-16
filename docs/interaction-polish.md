# 组件交互与图标精修清单

基线：fa3e945，工作区干净；版本保持 0.10.0。目标覆盖全部 121 个组件、文档示例和消费者接入。此文件记录进度，不替代浏览器验收。

## 验收标准

- 所有操作、状态、方向图形使用一致的 SVG 几何，不用 Unicode 字形充当图标；内容和键盘键名保留真实文字。
- 控件尾部使用固定槽位，选中、清除、展开不挤压或错位；RTL 和多尺寸成立。
- 次要操作默认安静，hover / focus-within 出现；触屏保持可发现、可点按；不隐藏主要入口或重要状态。
- 动效可中断且尊重 reduced-motion，焦点/禁用/加载/错误/空态完整。
- 所有文档示例可用，无示例脚本异常，菜单不裁切，移动端无溢出；浅深色与两套原语都检查。
- 接入保持框架无关、SSR 安全、幂等销毁、插槽/参数/事件/尺寸契约统一。

## 阶段

- [x] 共享 SVG 图标 API（SSR + DOM + 自定义）、静态图形与隐式动作槽位
- [ ] 级联、下拉选择、树选择、日期及自动完成的触发器和面板
- [ ] 外观切换全部形态、尺寸、全局同步
- [ ] 标签/输入附件/面包屑/分页/步骤/工具条/导航
- [ ] 模态/下拉/菜单/通知/告警/折叠及面板
- [ ] 数据表与图表、AI 与知识库全部交互
- [ ] 全站示例与用法同步、全部组件矩阵浏览器验收
- [ ] 完整 verify、站点 build、交互与 a11y、提交清空工作区（不升版、不发布）

## 逐组件复核

每项完成需包括：源码、示例与用法、真实浏览器交互、浅/深色与本真/像素、键盘/触屏/RTL。

- [ ] theme-switcher
- [ ] icon
- [ ] btn
- [ ] panel
- [ ] pill
- [ ] tag
- [ ] tabs
- [ ] stat
- [ ] toast
- [ ] toolbar
- [ ] split-pane
- [ ] form
- [ ] input
- [ ] select
- [ ] slider
- [ ] tag-input
- [ ] switch
- [ ] segmented
- [ ] upload
- [ ] date-picker
- [ ] form-validate
- [ ] cascader
- [ ] tree-select
- [ ] mentions
- [ ] autocomplete
- [ ] modal
- [ ] dropdown
- [ ] context-menu
- [ ] popover
- [ ] tooltip
- [ ] command-palette
- [ ] card
- [ ] empty
- [ ] avatar
- [ ] media-card
- [ ] rating
- [ ] kbd
- [ ] list
- [ ] accordion
- [ ] timeline
- [ ] desc
- [ ] tree
- [ ] carousel
- [ ] badge
- [ ] scroll-area
- [ ] code-block
- [ ] table
- [ ] datatable
- [ ] charts
- [ ] chart-line
- [ ] chart-bar
- [ ] chart-pie
- [ ] chart-radar
- [ ] chart-heatmap
- [ ] chart-area
- [ ] chart-stack
- [ ] chart-gauge
- [ ] chart-sparkline
- [ ] chart-scatter
- [ ] chart-calendar
- [ ] alert
- [ ] result
- [ ] progress
- [ ] spinner
- [ ] skeleton
- [ ] copy
- [ ] notification
- [ ] nav
- [ ] sidebar
- [ ] breadcrumb
- [ ] pagination
- [ ] steps
- [ ] back-top
- [ ] layout
- [ ] ai-chat
- [ ] ai-message
- [ ] ai-reasoning
- [ ] ai-composer
- [ ] ai-tool-call
- [ ] ai-subagent
- [ ] ai-diff
- [ ] ai-files
- [ ] ai-todo
- [ ] ai-context
- [ ] ai-usage
- [ ] ai-threads
- [ ] ai-feedback
- [ ] ai-branch
- [ ] kb
- [ ] kb-citation
- [ ] kb-sources
- [ ] kb-passage
- [ ] kb-conflict
- [ ] kb-pipeline
- [ ] kb-chunks
- [ ] kb-segment
- [ ] kb-connector
- [ ] kb-metadata
- [ ] kb-qa
- [ ] kb-retrieval
- [ ] kb-filter
- [ ] kb-rerank
- [ ] kb-hittest
- [ ] kb-sql
- [ ] kb-answer
- [ ] kb-clarify
- [ ] kb-explain
- [ ] kb-trace
- [ ] kb-review
- [ ] kb-gap
- [ ] kb-eval
- [ ] kb-canvas
- [ ] kb-checkpoint
- [ ] kb-sandbox
- [ ] kb-chain
- [ ] kb-acl
- [ ] kb-who-can
- [ ] kb-access
- [ ] kb-audit
- [ ] kb-visibility
- [ ] chart-graph
- [ ] chart-map

## 本轮记录

- 已定位级联的错位：trigger 的额外末端 padding 把 chevron 推入文本区，而同级 clear 又独立绝对定位。
- 已定位多处 Unicode 图标来源：behavior 的 textContent、静态 demo、CSS content。不能仅通过全局 CSS 掩盖。

### 首轮验证记录

- 新增共享 icon 模块（DOM / SSR / CSS mask），迁移操作型字符；图标纪律加入 guard 防回退。
- 级联、树选择、select 的展开与清除独立槽位已修正；级联按列扩宽并约束视口。修正层级点击导致背景文档滚动及清除按钮被触发器挡住。
- 外观控制使用真实 SVG、稳定选中槽位；合并菜单明暗放在顶部，低视口仍可发现。
- native input 清除/密码切换与默认 document 范围内的计数、掩码、trim 已恢复；修正粘贴未格式化数字时丢字符。
- 新增 panel 内置行为与类型化事件，修正文档里图标按钮没有动作。
- 129 个已构建文档页 × 1440/390 两档宽度：脚本异常、页面横向溢出、按钮文字图标、空名称按钮均为 0。报告在 .ui-audit/report.json（忽略产物）。这只是默认状态基础巡检，不代表全部状态已经视觉验收。
- verify：640 测试通过；19 条浏览器测试通过；站点构建 137 页。
- 仍待：全组件展开/关闭/hover/focus/错误/空态/加载态，以及本真/像素 × 浅/深色的完整视觉和交互矩阵。逐项清单保持未勾选，不能以本轮基础扫描替代最终验收。
