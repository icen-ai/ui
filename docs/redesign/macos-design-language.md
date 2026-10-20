# ICEN UI · Native 桌面设计语言

> 本文件记录从桌面系统应用（Finder / System Settings / Safari / Notes / Mail / Xcode / Activity Monitor）提炼出的**可迁移设计规则**，是本次重构的判断依据。
> 事实源：`src/tokens/design.css`（tokens）、`src/components/material.css`（默认 modern 原语的表面物理）、各组件 CSS（结构与状态）。
> 证据等级：**[实测]** 在本仓库浏览器渲染中量测；**[参考]** 来自公开系统界面观察；**[推断]** 由统一规则推导，未逐点量测。

---

## 0. 设计立场

ICEN UI 不是 Apple 控件复刻，也不是把玻璃、圆角、阴影堆到组件上。目标是：

1. **功能语义优先**：先问「这个控件在桌面应用里承担什么任务」，再决定几何与材质。
2. **结构先于装饰**：控件必须有清楚的 frame / content inset / leading-trailing slot / focus boundary；没有结构的材质只是皮肤。
3. **层级靠表面，不靠阴影**：canvas → content → chrome → floating → modal 用明度、边界和模糊表达；阴影只回答「离表面多远」。
4. **状态各有语法**：hover 是提示，pressed 是位移/变深，selected 是持续底色，focus 是外环，disabled 是去权，error 是语义边 + 文案；同一片背景色不能同时承担多种状态。
5. **品牌身份不迁移**：六套配色保留各自的色相、明度与语义色；本语言只统一几何、排版、层级与反馈。

不属于本语言的东西：iOS 触屏超大控件、全站玻璃化、营销页巨型标题、为模仿窗口而破坏浏览器滚动/历史、无意义弹跳动画。

---

## 1. 控件几何

### 1.1 高度阶梯

| 规格 | 常规 | compact | comfortable | 用途 |
|---|---|---|---|---|
| sm | 28px | 28px | 30px | 工具栏、菜单行内操作、密集表单 |
| md | 34px | 28px | 38px | 默认按钮 / 输入 / 选择器 |
| lg | 42px | 36px | 46px | 主操作、营销页演示、触屏 |
| 触屏底线 | 44px | 44px | 46px | `@media (pointer: coarse)` 强制 |

依据：13px 中文在 34px 高度内获得 ~21px 行盒，上下各 6.5px 呼吸；低于 28px 会牺牲 CJK 可读性，高于 42px 失去桌面密度。**[实测 + 推断]**

### 1.2 圆角阶梯

| Token | 值 | 用途 |
|---|---|---|
| `--icen-radius-xs` | 3px | 复选框、菜单项、日期格、微表面 |
| `--icen-radius-sm` | 6px | 按钮、输入、选择器（`--icen-control-radius`） |
| `--icen-radius-md` | 8px | 卡片、面板、内嵌容器 |
| `--icen-radius-lg` | 12px | 菜单、浮层、弹窗、工具条容器 |
| `--icen-radius-xl` | 18px | 页面级展示容器 |
| `--icen-radius-full` | 999px | 只给胶囊语义件（开关、滑块、徽章） |

- 控件与容器**不同半径**：按钮 6px、菜单 12px、弹窗 12px、卡片 8px；大容器不套小控件半径。
- 嵌套同心：`R_inner = R_outer − gap`，结果 < 0 取 0。
- 不把 10px/16px 等「中间值」散落到组件里；所有圆角来自 token。**[实测]**

### 1.3 内距与槽位

| 场景 | 值 |
|---|---|
| 按钮水平内距 | 12px（sm 9 / lg 16） |
| 输入 / 选择器水平内距 | 9px（sm 8 / lg 16） |
| 控件图标槽 | 15px 图标 + 6px 间距 |
| 菜单项 | 4px 8px，最小高度 28px |
| 工具栏按钮 | 28×28，图标 15px |
| 分区标题 | 11–12px / 600，行高 1.3 |

文字、图标、容器不是「flex 居中就完事」：图标按视觉重量落在文字 x-height 中心，单行控件用 `line-height: 1` 或 1.4 的固定行盒，避免 CJK 字体 ascent 把内容顶偏。**[参考 + 实测]**

### 1.4 状态几何

- Focus ring：2px 背景隔断 + 2px accent 外环（`--icen-ring`），或表单内 `inset 1px field shadow + 3px 18% accent halo`。
- Pressed：背景降至 pressed fill，必要时补内影；默认不再整体缩放。`--icen-press-soft: none`。
- Selected：accent 12–14% 的持续底色 + 文本保持正文色；需要冗余编码时补勾选 glyph（菜单/选项）。
- Disabled：整体 45% 不透明度 + `cursor: not-allowed` + 禁指针；不改变布局尺寸。

---

## 2. 排版

| 角色 | 字号 / 字重 | 用途 |
|---|---|---|
| Application title | 19–22 / 600 | 页面主标题（文档站由站壳控制） |
| Section title | 15 / 600 | 面板、卡片组标题 |
| Control label | 13 / 500 | 按钮、菜单、字段标签 |
| Body | 13–14 / 400 | 正文、表单值 |
| Secondary | 12 / 400 | 说明、辅助行 |
| Caption / metadata | 11–12 / 400–500 | 分组标题、时间、快捷键 |
| Monospace | 12–12.5 / 400 | 代码、路径、数值 |

- 默认字号 13px（density md），中文下限 12px；正文阅读区允许业务侧提升到 15–16px。
- 字距：控件 `-.006em`，标题 `-.015em`，11px 元数据 `+.01em`；中英混排不额外拉字距。
- 行高：控件 1.35–1.4，正文 1.5，标题 1.25。
- 数字密集区（表格、指标、日期）统一 `font-variant-numeric: lining-nums tabular-nums`；正文不强制等宽。
- 不使用营销页大标题体系作为应用组件标题；文档站首页例外，走编辑式排版。

---

## 3. 表面层级

| 层级 | 语义 | 实现 |
|---|---|---|
| Canvas | 应用工作区底 | `--icen-token-canvas` |
| Content | 阅读、表格、表单 | `--icen-token-surface` |
| Chrome | 工具栏、侧栏、导航 | `--icen-token-surface-chrome/toolbar/sidebar`（canvas 与 surface 的混合） |
| Floating | 菜单、popover、tooltip | `--icen-token-surface` + 条件模糊 + elevated shadow |
| Modal | 对话框、命令面板 | 不透明表面 + overlay shadow + scrim |
| Selected | 选中行/项 | `--icen-token-fill-selected`（accent 13%） |

- 页面内静态卡片不投影或只给 contact shadow；浮层才用 elevated/overlay。
- 侧栏与内容之间优先用 1px separator 或留白，不画重边。
- 暗色不是亮色反转：表面用明度阶梯，阴影降低、边界提高，顶部高光减弱。
- 禁止「所有卡片白底 + 大阴影」；禁止给普通表格/正文面板加玻璃。

---

## 4. 材质

- 透明/模糊只给真正悬浮或 chrome 语义：菜单、popover、命令面板、顶栏、侧栏、toast。
- 模糊半径：chrome 18px，floating 28px，饱和度 1.4；默认表面保持不透明。
- 所有透明表面必须有：`backdrop-filter` 不支持时的 opaque fallback、`prefers-reduced-transparency`、`data-icen-transparency="reduced"`。
- 顶部高光只表达「受光边缘」，不制造塑料感；暗色下高光强度接近 0。
- 阴影三层同光源：contact（1px）、near-field（8–20px）、ambient（24–52px），负 spread 收紧轮廓。

---

## 5. 动效

| Token | 值 | 用途 |
|---|---|---|
| `--icen-duration-fast` | 110ms | hover、按压、颜色切换 |
| `--icen-duration-normal` | 180ms | 展开、选择、开关 |
| `--icen-duration-slow` | 260ms | 浮层入场、面板展开 |
| `--icen-ease-out` | `cubic-bezier(.22,.8,.24,1)` | 状态变化 |
| `--icen-ease-enter` | `cubic-bezier(.16,1,.3,1)` | 浮层/内容入场 |
| `--icen-ease-exit` | `cubic-bezier(.4,0,1,1)` | 退场 |

- 菜单 110ms fade + 2px 方向位移；popover 同类但按 side 反向；dialog 180ms fade + 1.5% scale；toast 从屏幕边缘滑入；不要所有浮层共用一个缩放入场。
- 不给普通按钮加 hover 放大；不给卡片加持续漂浮。
- `prefers-reduced-motion` 下所有动画压到 0.01ms，滚动行为回 auto。

---

## 6. 交互与可访问性

- 每个可聚焦元素必须有 `:focus-visible` 环；浮层焦点陷阱、Esc 关闭、焦点还原是底线。
- 状态不只靠颜色：选中项补勾选 glyph，错误补文案/图标，加载补 `aria-busy`。
- 触屏目标 ≥44px，桌面最小 24px（WCAG 2.5.8）；开关视觉尺寸不放大、命中区扩大。
- RTL：布局用逻辑属性；方向图标镜像；开关/滑块等物理隐喻控件保持物理方向（已有契约）。
- 对比度：正文/控件标签 ≥4.5:1；图形边界、焦点环 ≥3:1；不因“更淡更高级”牺牲可读性。
- forced-colors 下表面回 Canvas/CanvasText，焦点环换 Highlight。

---

## 7. 各原语的边界

| 原语 | 保留身份 | 本次只共享 |
|---|---|---|
| modern | 瓷面、冷调、精确几何 | 完整 native 语言 |
| chinese | 低曲率、宋体标题、纸面层次 | 结构/状态 token、可读性底线 |
| soviet | 方正体块、结构线、定向投影 | 结构/状态 token、可读性底线 |
| pixel | 整数网格、点阵、直角、阶梯影 | 结构/状态 token、可读性底线 |

默认 modern 的组件规则使用 `:root:where(:not([data-icen-style]),[data-icen-style="modern"])` 包裹；其他原语通过自己的 token 面与 material adapter 覆盖，不共享现代的表面物理。

---

## 8. 迁移判断表

| 桌面模式 | 迁移到 Web | 不迁移 |
|---|---|---|
| 窗口/工具栏/侧栏分区 | 文档站与业务页的 shell 分层 | 伪装成桌面窗口的交通灯按钮 |
| 菜单栏快捷键 | `kbd` 样式、命令面板 | 全局系统菜单拦截 |
| 列表选中行 | 侧栏/表格选中底色 + 勾选 | 双击重命名等桌面文件操作 |
| 浮层锚定与方向 | Popover API / 现有 PanelSizing | 原生窗口拖拽、多显示器定位 |
| 触控板手势 | 滑块/分栏拖拽的指针事件 | 三指/四指系统手势 |
| 声音/通知中心 | in-app toast/notification | 系统通知权限滥用 |
