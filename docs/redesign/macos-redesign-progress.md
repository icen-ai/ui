# ICEN UI · macOS-inspired 重构进度

> 机器可读进度：`docs/redesign/progress.json`。本文件是给人看的滚动记录。
> 当前分支：`pref/design`。批次原则：小批量、可验证、可回退；每批跑 `bun run verify` + 站点构建 + 截图对比。

---

## 0. 基线（2026-10-20）

| 项目 | 结果 |
|---|---|
| `bun run verify` | 通过（tsc / guard / bun test / build / size） |
| 文档站构建 | 通过，137 页 |
| 基线截图 | `.ui-audit/baseline/`（14 页 × modern light/dark + 东韵 + 像素） |
| Registry | 122 slug / 76 个组件 CSS / 129 个文档条目 / 90 behavior 模块 |
| 分层 | core 52 / beta 24 / lab 0（模块文件数） |

### 基线审计结论（问题清单）

**系统性问题**

1. 控件密度偏移动端：默认 40px 高、16px 大圆角、按钮/输入/分段偏大；桌面管理界面显得松散。
2. 表面层级单一：卡片、面板、菜单、工具栏都接近同一张白色平面，靠边框和阴影硬撑。
3. 选中态语法不统一：有的用 accent 实心，有的用浅底，有的只改文字色。
4. 原生 affordance 缺失：select 的 chevron 被 behavior 主动删除；tree-select 同样隐藏；checkbox 选中是一个方块而非勾。
5. 菜单/选项行高 6px padding + 20px 图标，密度接近移动端；快捷键与分组标题层级弱。
6. 分段控件选中态是品牌实心（部分原语），与桌面分段“白面浮起”语义不同。
7. 文档站仍是通用 Web 文档模板：侧栏是链接列表，预览区是白卡，代码块与组件演示没有“应用工作区”感。
8. Token 面缺少 surface/chrome、hover/pressed/selected fill、focus indicator 等语义层，组件各自推导。

**组件级问题（首批）**

| 组件 | 问题 | 处理 |
|---|---|---|
| btn | 40px 高、4px 字距、primary hover 抬阴影、按下缩放 | 34px / 6px 角 / 顶部高光 / 按下变深 / 不再缩放 |
| input | 40px、8px 内距、inset 阴影过重 | 34px / 9px 内距 / 1px field shadow / focus 外环 |
| select | chevron 被删除、面板 10px 角、选项 6px 内距 | 恢复 chevron、12px 面板、28px 行、选中勾选 |
| menu | 24px 模糊 + 大 padding、行高偏松 | 28px 模糊、4px 内距、28px 行、12px 角 |
| segmented | 2px 轨道内距、选中实心、字 12px | 3px / 选中白面 + hairline / 13px |
| switch | 44×24（偏 iOS）、thumb 双色硬切 | 38×22、18px 白 thumb、accent-strong 开态 |
| checkbox | 选中方块、16px | 15px、勾选 mask、3px 角 |
| slider | 6px 轨、2px accent 边 thumb、放大 1.25 | 4px 轨、白 thumb + hairline、1.08 focus |
| date-picker | 30px 导航钮、日历格 34px、今天带边框 | 28px / 30px / 今天 accent 文字、选中实心 |
| tree-select | chevron 隐藏、面板 8px 内距 | 恢复 chevron、28px 行、菜单材质 |

---

## 1. 批次状态

| 批次 | 范围 | 状态 | 验证 |
|---|---|---|---|
| F0 | 设计语言 / 映射 / Token 架构 / 基线 | ✅ 完成 | 文档 + 基线截图 |
| F1 | Design Tokens + 控件物理（modern） | ✅ 完成 | verify + after1 |
| F2 | 表单族：btn/input/select/menu/segmented/switch/slider/form/date-picker/tree-select/tag-input/mentions/autocomplete/cascader/upload | ✅ 完成 | verify + 截图 |
| F3 | 导航与数据：tabs/toolbar/nav/sidebar/breadcrumb/pagination/steps/table/datatable/list/tree/accordion/timeline/desc/card/panel/stat/empty/pill | ✅ 完成 | verify + after2 |
| F4 | 浮层与反馈：modal/popover/tooltip/dropdown/context-menu/command-palette/toast/notification/alert/progress/spinner | ✅ 完成 | verify + after2 |
| F5 | 图表族：charts 基座 + 13 种图 | ✅ 完成（13 种逐个精修 CSS + 几何增强） | 26 张明暗细图截图 |
| F6 | AI 原生族：ai-chat/composer/tool/panel/diff/threads/feedback/branch | ✅ 完成 | 截图 + token 审查 |
| F7 | 知识库族：kb 基座 + 7 域 32 组件 | ✅ 完成（7 域逐文件精修） | 14 张明暗截图 + token 审查 |
| F8 | 官方文档站：shell / 组件页 / 首页 / 应用组合 | ✅ 完成 | 138 页构建 |
| F9 | 全量验证：六主题 × 明暗 × 四原语 × 密度 / a11y / 视觉回归 | ✅ 完成 | verify / axe 11/11 / 72 张矩阵 + 42 张 a11y 矩阵 |

### 1b. 收尾批次（2026-10-21）

针对首轮报告中「图表细分与 KB 域继承基座、未逐文件重写」的缺口，做了一次完整收口：

- **13 种图表**：基座统一图例/轴标/tooltip 材质；折线/面积补网格与基线分色、数据点白芯色环与 hover 放大（面积图新增可交互点与 9px 命中圆）；柱图轨道内置四档网格、堆叠段 2px 面色缝；环图多段留 2.5 单位白隙；雷达改实线蛛网；热力格 3px 角 + 色环 hover；日历月份/星期标签 10px；散点补横实纵虚网格与轴线；图谱边线提升、节点 hover/drag 分层；嵌入地图点 hover 放大。
- **KB 7 域**：ground/ingest/search/data/ops/agent/perm 与共享基座逐文件精修——28px 控件、6px 控件圆角、13/12/11 字阶、`--icen-ring` 焦点、`fill-hover/pressed` 成对、浮层 raised + elevated、整行选中替代左侧竖条、compact 密度档、forced-colors 状态件；权限域的 deny/break-glass/受限列诚实呈现未改。
- **残余组件**：back-top 36px 玻璃浮钮、icon 焦点与按压、form-validate 汇总卡、中式/苏式材料层的 reduced-transparency 回退。
- **无障碍矩阵**：14 页 × forced-colors / reduced-transparency / 200% zoom；强制颜色下全局焦点框兜底、开关/勾选/单选/分段/表格/选择器/侧栏选中态、代码区与多表分页的 landmark 唯一名；720px 视口 0 横向溢出。

---

## 2. 已完成的设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 默认控制高度 | 34px | 13px 中文可读与桌面密度的平衡；compact 28 / comfortable 38 |
| 默认字号 | 13px | 桌面应用正文尺度；CJK 下限 12px；营销页由站壳另行放大 |
| 圆角 | 3/6/8/12/18 | 控件与容器分层，禁止中间值散落 |
| 按钮按下 | 变深 + 内影，不缩放 | 物理按钮隐喻；避免整页“跳动” |
| 分段选中 | 白面 + hairline + contact 影 | 桌面分段控件语义；品牌色只做文字/图标强调 |
| 开关 | 38×22 / 18 thumb | 桌面比例；命中区另扩 44px |
| select chevron | 恢复显示 | 弹出式控件必须有方向暗示；清除钮出现时互斥 |
| checkbox | 勾选 mask | 方块不是“已选”的通用语言；勾选是 |
| 菜单材质 | 28px 模糊 + 94% 表面 | 悬浮语义才用材质；普通表格/正文不玻璃化 |
| 侧栏选中 | 整行 accent 12% 圆角底，无左缘指示条 | 源列表语义；指示条是 Web 标签页语言 |
| 数据行高 | 32px（compact 28） | 桌面管理密度；44px 属移动端 |
| 表头 | 11px/600 + chrome 底 + 1px 分隔 | 表头是结构标签，不是第二层卡片 |
| 工具栏 | 44px chrome + 28px 按钮 | 与窗口工具栏同一高度语法 |
| 浮层 | 12px 角 + 28px 模糊 + 2px 方向位移 | 与菜单同族；方向来自锚点 |
| 命令面板 | 48px 搜索、32px 结果、scrim 模糊 | Spotlight 的搜索优先，不是对话框 |
| Toast/通知 | 2px 语义边 + 20px 模糊 + 浮层影 | 悬浮但保持可读；语义边替代整块染色 |
| 动效 | 110/180/260ms + 四种缓动 | 状态变化短、入场有方向、退场更快 |
| 其他原语 | 保持独立 token/适配层 | 只共享结构语义，不共享现代表面物理 |

---

## 3. 剩余任务（按优先级）

收尾批次已把原先的「继承基座」项全部落地，当前无阻断项。剩余属于发布/运营动作，不属于设计缺口：

1. 合并 `pref/design` 到 main 前，按发布流程改版本号 + CHANGELOG 小节改名，并跑一次契约 diff。
2. 视觉回归基线随最终设计刷新（本次已重跑 Playwright 全量，快照更新）。
3. 主题级人工巡检（梵高亮色 / 钢琴深色）建议在合并前由人眼过一遍 `.ui-audit/matrix/`。
4. 首页 Hero 保留品牌艺术层，若品牌侧要统一到工作区语法，另开品牌页专项。
5. 图表 vbar/hbar 不显示数值纵轴刻度（类目图按设计省略）；若业务需要读数，走 tooltip 与图例。

---

## 4. 验收证据

| 证据 | 位置 / 结果 |
|---|---|
| 全量构建与单测 | `bun run verify` 通过（1033 tests + build + size） |
| 文档站 | 138 页构建通过 |
| 无障碍 | `bunx playwright test tests/e2e/a11y.pw.ts` 11/11 场景通过；color-contrast 既有债在基线中清零 |
| Playwright e2e | 308/308 用例通过（视觉快照已刷新） |
| 主题矩阵 | `.ui-audit/matrix/` 48 张（6 配色 × 明暗 × 4 页） |
| 原语矩阵 | `.ui-audit/primitives/` 24 张（4 原语 × 明暗 × 3 页） |
| a11y 矩阵 | `.ui-audit/a11y-matrix/` 42 张（14 页 × forced-colors / reduced-transparency / 200% zoom） |
| 图表截图 | `.ui-audit/charts-after/` 26 张（13 图 × 明暗） |
| KB 截图 | `.ui-audit/kb-after/` 14 张（工作台 + 6 个代表组件页 × 明暗） |
| 前后对比 | `docs/redesign/visuals/buttons-before-after.png`、`table-before-after.png` |
| 应用组合 | `docs/redesign/visuals/apps-workspace.png`、线上 `/apps/` |

---

## 5. 风险与待定

- **字号 13px** 会让部分既有演示看起来偏小；业务正文可在消费侧提升，组件内不再回退到 14。
- **六主题对比度**：新增的 fill/selected 透明度需要在每套主题的亮暗两态实测；特别是梵高亮色与钢琴深色。
- **其他原语**：chinese/soviet/pixel 的共享结构 token 可能改变其控件高度（pixel 仍 40、soviet 44、chinese 42，已由各自 token 覆盖）。
- **体积**：ui.css 余量约 120KB，但仍需控制新增 CSS；复杂组件优先改现有规则，不追加重复覆盖。
- **行为契约**：select 恢复 chevron 改变了 behavior 的 DOM 处理（不再删除作者节点），属于可见但兼容的增强；需在 CHANGELOG 记录。
