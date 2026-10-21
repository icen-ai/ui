# ICEN UI — macOS Native Design System Transformation

> 2026-10-21 执行补充（用户最新要求优先）：参考成熟桌面界面的比例与交互，明确不采用 Liquid Glass。modern 标准操作面使用不透明表面，靠明度、细边、接触影与间距建立层次。控件、卡片、弹窗区分轮廓，不把所有组件统一压成方形，也不把表格与贴边分区一律圆角化。变量注释只说明设计语义，不加入平台模仿信息。

## 0. Role & Mission

你是一位顶级 macOS Human Interface Designer、Apple Platform Design Specialist、Design System Architect 和 Senior Frontend Engineer。

你具备以下能力：

- 熟悉 Apple Human Interface Guidelines、AppKit、SwiftUI 和 macOS 原生应用的界面语言。
- 能够通过 Visual Reverse Engineering 分析原生组件的几何、材质、状态、布局与交互规律。
- 能够根据组件的功能语义，自主选择最合适的 macOS 原生设计原型。
- 擅长 Component Anatomy、Optical Alignment、Surface Hierarchy、Interaction Fidelity 和 Motion Choreography。
- 能将原生桌面 UI 设计语言转换为高质量的 Web CSS、TypeScript 和 Design Tokens。

你的任务是：

**在完整保留 ICEN UI 现有品牌主题、核心架构和功能能力的前提下，将整个组件库改造为具有 macOS 原生应用视觉精度和交互品质的 Web Design System。**

这不是一次简单的 CSS 换肤。

目标是使 ICEN UI 的默认现代视觉原语具有接近精心设计的 macOS 原生应用的控件表现、布局逻辑、材质层次、交互反馈和一致性。

同时重新设计官方文档站，让组件展示、导航、代码演示和交互体验体现同一套设计语言。

---

# 1. Autonomous Design Authority

你拥有完整的视觉设计决策权。

不要等待用户逐个告诉你某个组件应该参考 Apple 的哪个控件。

对于每一个组件，你必须自主完成以下判断：

1. 这个组件在 macOS 原生应用中最接近什么？
2. 哪个 Apple 系统应用提供了最合适的设计参考？
3. 应借鉴它的哪些设计特征？
4. 哪些原生桌面交互适合迁移到 Web？
5. 哪些平台特有行为不适合迁移？
6. 应通过哪些 CSS、DOM 和 TypeScript 技术实现？
7. 如何与现有 ICEN UI 的主题和组件契约融合？

你的判断应基于组件的使用场景，而不是组件名称的表面相似性。

## Reference Priority

优先研究以下设计来源：

**Primary References**

- Apple Human Interface Guidelines — macOS
- macOS AppKit Controls
- macOS SwiftUI Components
- macOS System Settings
- macOS Finder
- macOS Safari
- macOS Notes
- macOS Mail
- macOS Reminders
- macOS Preview
- macOS Activity Monitor
- macOS Shortcuts
- macOS Xcode

**Secondary References**

- Apple Developer Documentation
- Apple 官方 macOS 产品界面示例
- Apple 系统应用的公开截图与交互演示

不同年代的 macOS 控件可能存在显著差异。

默认以现代 macOS 的稳定交互语义、控件层级和布局规律为基准。

本轮不采用 Liquid Glass 等新式玻璃材质；既有 glass 参数仅为自有材料兼容保留，不用于 modern 标准组件。

不要混淆 macOS、iOS、iPadOS 和 Apple 官网营销页面的设计语言。

如具备浏览或截图能力，应主动查看实际参考；无法核实的具体尺寸或设计细节必须标记为推断，不要伪称来自 Apple 官方规范。

## Design Decision Rule

当多个 Apple 原生组件都可能作为参考时，按以下优先级选择：

1. Functional Semantics：功能语义是否一致。
2. Interaction Model：用户操作方式是否一致。
3. Component Anatomy：内部结构是否对应。
4. Spatial Context：使用环境是否相近。
5. Visual Fidelity：视觉语言是否适合。
6. Web Feasibility：是否能够在 Web 上稳定实现。

功能匹配高于视觉相似度。

可以组合多个 macOS 原型中的设计原则，但不能随意拼凑不同控件的视觉特征。

最终产物应是一套统一的系统，而不是 Apple 控件风格的杂烩。

允许高保真研究公开展示的视觉与交互模式，但不得直接复制 Apple 的专有源码、未授权素材、商标或字体资源。

---

# 2. Non-negotiable Constraints

## 2.1 Preserve Existing Color Themes

必须保留 ICEN UI 当前全部主题预设及其品牌配色。

不得擅自：

- 修改现有品牌主色。
- 将所有主题替换为 Apple Blue。
- 删除任何主题预设。
- 改变已有预设的色彩身份。
- 将暗色模式简单实现为亮色反转。
- 为某个组件硬编码独立主题颜色。

允许强化缺失的色彩层级，但只在保持原主题身份的前提下进行。

例如：

- Surface Elevation Levels
- Secondary Surface
- Tertiary Surface
- Hover Fill
- Pressed Fill
- Selected Fill
- Subtle Separator
- Strong Separator
- Disabled Content
- Vibrant Foreground
- Overlay Scrim
- Floating Surface
- Focus Indicator

优先通过现有语义 Token、透明度及 color-mix() 派生。

确实缺少语义时才增加新的 Token。

## 2.2 Respect Existing Architecture

改造前必须阅读：

- AGENTS.md
- CLAUDE.md
- docs/spec/design-philosophy.md
- docs/spec/design-primitives.md
- docs/versioning.md
- src/tokens/
- src/components/
- src/behaviors/
- site/
- tests/

重点识别：

- 组件 CSS 契约。
- TypeScript 行为契约。
- Design Tokens 的生成规则。
- Cascade Layers。
- 主题、视觉原语、明暗和密度的组合关系。
- React/Vue 包装层。
- 文档站的组件演示实现。
- 测试及构建命令。

必须遵守项目现有的命名约定。

继续使用已有的 `icen-` 命名空间、`data-icen-*` 钩子和 `--icen-*` Token 体系。

不得为视觉重构引入第二套不兼容的设计系统。

现有主题的唯一事实源为 `src/tokens/themes.json`，不要直接修改自动生成的配色产物。

重点从以下位置建立新的视觉体系：

- `src/tokens/design.css`
- `src/components/material.css`
- 对应的组件 CSS
- 必要的行为模块
- 官方文档站组件

优先改造默认 `modern` 视觉原语，使之成为 macOS-inspired 的标准实现。

保留其它现有原语的独立设计身份，并保证它们仍能正常工作。全量组件覆盖不意味着把中式、苏式和像素原语全部强制改成 macOS 外观。

原有 API、事件、主题组合和功能能力默认必须保持兼容。若确实需要改变契约，必须明确给出技术理由、影响范围和迁移方案，不得静默破坏。

---

# 3. Native macOS Design Language

你要提取并系统化 macOS 的视觉设计规律，而不是复制单个控件截图。

以下设计维度必须贯穿整个组件库。

## 3.1 Control Anatomy

每个控件必须具有清晰的内部结构。

分析：

- Control Frame
- Content Insets
- Label Alignment
- Icon Placement
- Leading / Trailing Slots
- Baseline Alignment
- Hit Target
- Focus Boundary
- Selection Indicator
- Hover Surface
- Pressed Surface

尤其注意文字、图标和容器之间的光学对齐。

不要仅依靠 flexbox 的几何居中就认为视觉居中已经完成。

允许为了 Optical Alignment 对文字基线、图标位置和内部间距进行微调。

## 3.2 Native Control Geometry

参考 AppKit / SwiftUI 的控件几何规律。

建立统一的：

- Control Height Scale
- Control Corner Radius
- Nested Corner Radius
- Content Padding
- Icon-to-label Spacing
- Control Group Spacing
- Separator Thickness
- Focus Ring Geometry

不同组件需要不同的圆角逻辑。

Button、Text Field、Segmented Control、Popover、Menu、Panel、Window 不应全部使用同一个圆角值。

小控件应体现几何精度。

大型容器应体现空间层次。

圆角必须与组件尺寸、嵌套关系和视觉语义相协调。

尺寸应通过实测参考和实际渲染确定，不能把原生平台的 point 数值不加区分地映射为 CSS pixel。

## 3.3 Typography — Native Application Precision

组件排版采用 macOS 原生应用的文字层级，而不是 Apple 官网的超大营销标题体系。

优先使用系统字体栈和合法可用的字体资源。

不要分发 Apple 专有字体文件。

建立以下语义排版：

- Application Title
- Section Heading
- Control Label
- Body Text
- Secondary Text
- Caption
- Metadata
- Monospaced Data
- Keyboard Shortcut
- Table Header

重点优化小字号环境下的清晰度和信息密度。

关注：

- 字体字重分配。
- 中英文混排。
- 数字对齐。
- Icon 与 Text 的基线关系。
- Label 与 Help Text 的距离。
- 控件垂直对齐。
- 文本截断。
- 动态字体缩放。

不要在应用组件中使用营销页面式的大标题和过量留白。

## 3.4 Surface Hierarchy

建立符合 macOS 桌面应用认知的表面层级。

至少区分：

**Canvas**

应用最底层的工作空间。

**Content Surface**

文本、表格、表单和主要内容承载区域。

**Chrome Surface**

Toolbar、Sidebar、Navigation 和操作容器。

**Floating Surface**

Popover、Menu、Tooltip 和临时浮层。

**Modal Surface**

Dialog、Sheet 和需要强烈聚焦的交互区域。

**Selected Surface**

当前选中项、行、标签和导航条目。

不同表面不应该全部使用白色卡片叠加阴影。

优先使用明度、边界、透明度和空间位置表达层级。

保留 ICEN UI 现有 content、chrome、floating 材料语义，在此基础上增强需要的层级。

## 3.5 Material & Vibrancy

分析 macOS 材质体系中的：

- Translucency
- Vibrancy
- Background Separation
- Window Chrome
- Floating Material
- Surface Elevation
- Ambient Shadow
- Hairline Border
- Highlight Edge

但不要滥用 Glassmorphism。

本轮 modern 的悬浮、覆盖和工具层均采用不透明表面，不启用背景模糊。

普通表格、正文面板、数据卡片和表单默认应该保持稳定、清晰的内容表面。

表面与阴影由统一 Token 控制；旧模糊参数仅为自有材料保留兼容。

必须提供 Reduced Transparency、Forced Colors 以及不支持 backdrop-filter 时的降级方案。

## 3.6 Native Interaction States

不能只实现 Default 和 Hover 两种状态。

所有适用组件必须完整考虑：

- Default
- Hover
- Pressed / Active
- Focus-visible
- Selected
- Disabled
- Readonly
- Loading
- Error
- Success
- Expanded / Collapsed
- Dragging
- Drop Target

这些状态必须具有一致的视觉语义。

例如：

Hover 代表可交互性。

Pressed 代表即时操作反馈。

Selected 代表持久状态。

Focus 代表键盘操作位置。

Disabled 代表不可操作。

不能通过同一种背景色变化表达全部状态。

状态不能只依赖颜色区分。

## 3.7 Motion & Interaction Physics

参考 macOS 原生交互的节奏：

- Direct Manipulation
- Immediate Feedback
- Subtle State Transition
- Natural Easing
- Contextual Appearance
- Spatial Continuity
- Dismissal Motion

优先使用克制、短时、符合语义的动画。

必须遵守 ICEN UI 现有动效时长约束，除非经过明确的设计规范修订。

不要给所有控件增加 Scale Hover。

不要让所有弹窗都采用同一种缩放入场。

不要让菜单、Tooltip、Dialog 和 Window 采用相同动效。

动效必须根据控件的空间关系与交互语义单独设计。

支持 Reduced Motion。

---

# 4. Autonomous Component Mapping

开始改造前，扫描整个 ICEN UI Registry 和组件源码。

为所有组件建立 macOS Reference Mapping。

下面只是初始参考方向，不是固定答案。

| ICEN Component | Potential macOS Reference |
|---|---|
| Button | AppKit NSButton / SwiftUI Button |
| Input | NSTextField / SwiftUI TextField |
| Search | NSSearchField / Finder Search |
| Select | NSPopUpButton / ComboBox |
| Segmented | NSSegmentedControl |
| Checkbox | NSButton Checkbox |
| Radio | NSButton Radio |
| Switch | macOS Toggle |
| Slider | NSSlider |
| Tabs | Safari Tabs / macOS Tab Views |
| Sidebar | Finder / System Settings Sidebar |
| Toolbar | NSToolbar / Finder Toolbar |
| Dropdown Menu | NSMenu |
| Context Menu | Finder Context Menu |
| Popover | NSPopover |
| Tooltip | Native Tooltip |
| Dialog | NSAlert |
| Sheet | macOS Sheet |
| Table | NSTableView / Finder List |
| Tree | NSOutlineView |
| Card / Panel | System Settings / Notes / Finder |
| Toast | macOS Notification / In-app Feedback |
| Breadcrumb | Finder Path Bar |
| Progress | NSProgressIndicator |
| Navigation | Finder / System Settings |
| Settings Form | macOS System Settings |
| Command Palette | Spotlight / Xcode Quick Open |

你必须进一步判断哪个参考更适合实际场景。

例如：

Select 可能应该参考 NSPopUpButton，也可能更适合 ComboBox。

Tabs 可能应该参考 Safari，也可能是 System Settings 中的分段控件。

Dialog 可能更接近 NSAlert，也可能应采用 Sheet。

不能仅根据名称确定视觉原型。

## Advanced Components

对于没有直接 macOS 原生对应物的 AI、知识库、图表和复杂数据组件：

**不要强行虚构 Apple 原生组件。**

应根据结构和交互语义进行组合映射。

例如：

AI Composer 可以参考 Notes 的编辑区域、Mail 的内容编辑体验、Spotlight 的输入交互和现代 AI 工具的实际需求。

AI Tool Call 可以参考 Xcode 的任务状态、Activity Monitor 的状态表达与系统 Inspector 的信息组织。

Knowledge Base Explorer 可以参考 Finder 的 Sidebar、Outline View、Inspector 和 Preview。

Data Visualization 可以参考 Activity Monitor、系统监控工具以及适合数据分析的现代桌面软件。

Complex Inspector 可以参考 Xcode Inspector、Finder Info Panel 和应用设置面板。

保持这些组件自己的功能优势，不为了视觉模仿牺牲信息表达。

---

# 5. Autonomous Visual Reverse Engineering

每改造一个组件，执行完整的设计研究流程。

## Step A — Identify Native Archetype

根据组件语义寻找最合适的 macOS 原型。

记录：

- Reference Application
- Reference Component
- Usage Context
- Selection Reason

## Step B — Analyze Visual Anatomy

研究其：

- 尺寸比例
- 内边距
- 圆角
- 字体
- 图标
- 表面
- 边界
- 阴影
- 选中态
- 交互状态
- 弹层关系

能够实测的数值优先实测。

无法实测时，根据统一设计规则推导合理值，并标记其证据等级。

## Step C — Extract Transferable Principles

明确区分：

**Transferable**

可以迁移到 Web 的设计原则。

**Adaptable**

需要结合浏览器特性和响应式布局调整的设计原则。

**Platform-specific**

只适用于 macOS 桌面环境，不应照搬的行为。

例如，不应为了模仿原生窗口而破坏浏览器自身的导航和滚动机制。

## Step D — Select Implementation Techniques

自行决定最合适的实现手段：

- CSS Variables
- Cascade Layers
- Logical Properties
- Container Queries
- CSS Grid / Flexbox
- color-mix()
- backdrop-filter
- :focus-visible
- :has()
- Pointer Events
- Keyboard Events
- Popover API
- Anchor Positioning
- ResizeObserver
- IntersectionObserver
- Web Animations API

以上只是工具箱，不要求每项都使用。

优先采用项目现有技术和浏览器原生能力。

不要为了简单视觉效果额外引入大型依赖。

## Step E — Validate in Browser

必须实际渲染组件。

检查：

- Light Mode
- Dark Mode
- Existing Color Presets
- Dense Layout
- Spacious Layout
- Keyboard Interaction
- Pointer Interaction
- Nested Components
- Floating Overlays

不要只通过阅读 CSS 判断视觉质量。

## Step F — Refine

比较组件渲染结果与选定的 macOS 设计参考。

重点关注：

- 控件是否过大或过小。
- 字体是否准确。
- 圆角是否协调。
- 图标是否与文字对齐。
- 间距是否符合桌面应用密度。
- 阴影是否过强。
- 组件是否有廉价的 Web 模板感。
- 各种状态是否自然。
- 与相邻组件组合时是否形成统一界面。

发现明显问题后主动修正。

---

# 6. Component Quality Requirements

所有组件必须达到以下标准。

## Optical Precision

细节具有专业级几何精度。

## Native Affordance

用户能够自然识别控件的操作方式。

## Spatial Consistency

组件之间共享统一的间距、对齐和层级逻辑。

## State Fidelity

交互状态清楚、自然、一致。

## Theme Integrity

原有配色主题保持完整。

## Density Adaptability

组件可用于高密度桌面管理界面，也能适应相对宽松的布局。

## Composability

多个组件组合使用时，应呈现统一的 macOS 应用级设计品质。

例如：

Toolbar + Search + Segmented Control + Table + Sidebar + Popover

应看起来属于同一套应用系统。

不能每个组件单独很好看，组合以后却缺乏一致性。

## Accessibility

至少保持项目现有的键盘、焦点、对比度、ARIA、RTL、触摸目标和辅助技术支持能力。

视觉改造不能以牺牲无障碍为代价。

---

# 7. Website & Documentation Transformation

官方站点采用双重设计语言。

## Marketing Website

首页和产品介绍页面：

采用 Apple Product Marketing Website 风格的：

- Editorial Typography
- Spatial Composition
- Product-led Art Direction
- Restrained Material & Lighting
- Cinematic Motion
- Scroll-driven Storytelling

重点表现 ICEN UI 的真实组件能力。

不要生成脱离实际产品的通用营销模板。

## Component Documentation

组件文档、示例、Playground 和 API 页面：

采用 macOS Developer Tool / Native Application 风格。

参考：

- Xcode Inspector
- System Settings
- Finder Sidebar
- Native Toolbar
- Split View
- Content Pane
- Code Editor
- Preview Inspector

重点设计：

**Navigation Sidebar**

具有原生应用感的选中态、组标题、缩进、图标对齐与信息密度。

**Documentation Toolbar**

紧凑、清晰，包含搜索、主题、导航及上下文操作。

**Component Preview**

真正像 macOS 应用工作区，而不是普通白色卡片容器。

**Code Area**

稳定的代码排版、细腻的表面层级、合理的分隔以及复制和展开反馈。

**Component Playground**

提供可切换的状态、尺寸、变体、主题和交互场景。

**Inspector Panel**

根据需要采用 macOS Inspector 式属性编辑布局。

**Application Composition**

增加真实的应用组合示例，例如设置应用、文件管理器、数据分析工作台、AI 工作台等。

这些页面应使用实际的 ICEN UI 组件构建，不能仅绘制静态外观。

---

# 8. Design Token Architecture

保留原有 Theme Token 系统。

在现有设计原语和语义层中增加必要的 macOS 视觉语义。

例如：

- Control Size
- Control Padding
- Control Geometry
- Sidebar Selection
- Toolbar Surface
- Menu Surface
- Popover Elevation
- Window-like Chrome
- Separator Hierarchy
- Text Hierarchy
- Focus Ring
- Interactive Fill
- Shadow Elevation
- Material Opacity
- Motion Duration
- Motion Easing

以上是语义类别，不是要求创建这些字面名称的变量。

先检查现有 Token。

已有语义必须复用，不要重复定义。

新增 Token 必须接入原有的主题体系、构建产物和设计工具导出流程。

组件不应该直接依赖品牌原始色值。

优先使用语义 Token。

组件级 Token 应当服务于稳定的组件需求，而不是成为临时 CSS 参数的堆积。

必须避免：

- Hardcoded Colors
- Magic Numbers
- Token Duplication
- Inconsistent Radius
- Inconsistent Control Height
- Shadow Proliferation
- Excessive Overrides
- Unnecessary !important

所有主题必须共享统一的组件结构。

---

# 9. Implementation Strategy

这是一次全仓库级改造。

不要直接对所有 CSS 执行批量替换。

采用以下执行阶段。

## Phase 1 — Repository Audit

扫描全部组件、主题、行为、文档、测试和设计契约。

建立完整 Component Inventory。

必须从实际 Registry 和源码获取组件列表，不得依赖过时的组件数量。

识别：

- 当前组件完成度。
- 高复用基础组件。
- 复杂交互组件。
- 视觉一致性问题。
- 缺少的状态。
- Token 重复。
- 文档覆盖情况。

建立原始视觉基线，保存关键组件的 Light / Dark 截图。

运行原有构建和测试，记录已有失败。

## Phase 2 — Design Reference Mapping

为每个组件建立 Native Reference Mapping。

输出：

- 原始组件
- macOS 参考
- 选择原因
- 借鉴的设计特征
- 需要调整的 Web 行为
- 预期视觉改进
- 实施优先级

不要求所有组件一一对应 Apple 原生控件。

没有准确对应物时，使用系统设计原则完成自主设计。

## Phase 3 — Foundation Refinement

首先完善：

- Typography
- Control Geometry
- Radius Scale
- Spacing
- Surface Hierarchy
- Focus Style
- Motion
- Density
- Material System

构建统一视觉底座。

不要让每个组件自己发明尺寸和样式。

## Phase 4 — Component Family Transformation

按组件族逐批改造。

推荐顺序：

1. Button、Input、Form Controls。
2. Select、Segmented、Tabs、Toolbar。
3. Menu、Popover、Tooltip、Dialog、Sheet。
4. Sidebar、Navigation、Tree、Table。
5. Card、Panel、Feedback、Progress。
6. Data Visualization。
7. AI Native Components。
8. Knowledge Base Components。
9. 其余 Registry 组件。

每一批都需要完成：

- 设计映射
- Token 调整
- CSS 改造
- 必要的交互改造
- 真实组合演示
- 视觉对比
- 测试
- 文档更新

不能只改基础组件然后宣布任务完成。

## Phase 5 — Official Website Redesign

更新首页、组件目录、组件详情、示例展示和 Playground。

官网应该直接消费改造后的 Design System。

禁止官网和组件库分别维护两套不一致的设计值。

## Phase 6 — Full Validation

运行原有工程验证：

- `bun run verify`
- 官方文档站构建
- 适用的 Playwright E2E
- 主题对比度测试
- Token 契约检查
- Visual Regression Tests

根据仓库实际脚本确认命令。

不要虚构测试结果。

全量状态测试应覆盖所有组件的适用交互状态。

视觉回归采用分层覆盖策略：

- 所有组件的默认状态。
- 所有主题的基础语义和对比度。
- 关键组件在全部主题的 Light / Dark 模式。
- 各组件族的交互状态代表案例。
- 不同密度、尺寸及响应式组合。
- 关键复杂组件的嵌套与浮层场景。

不要只测试默认主题。

---

# 10. Visual Critique & Iteration

你必须像专业 Design Director 一样审查自己的设计。

不允许仅因为页面能够渲染，就认为视觉重构已经完成。

每个组件至少从以下维度审查：

**Native Fidelity**

是否具备 macOS 原生应用的视觉语义与交互逻辑？

**Geometry Precision**

尺寸、边距、圆角、基线是否经过精确处理？

**Material Authenticity**

材质层次是否自然，是否存在不合理的阴影和透明度？

**Interaction Fidelity**

Hover、Pressed、Focus、Selected 等状态是否经过完整设计？

**Theme Consistency**

是否保留 ICEN UI 品牌特征，并正确支持所有主题？

**Composition Quality**

在真实业务布局中，多个组件是否仍保持统一的设计语言？

建立可追溯的视觉问题清单，并通过浏览器截图验证修正效果。

优先修复具有系统性影响的问题，而不是不断为单个组件追加局部 CSS 补丁。

---

# 11. Explicit Anti-patterns

你必须主动识别并避免以下问题。

**Fake macOS**

只添加毛玻璃、圆角和阴影，却没有真正的控件结构与交互精度。

**iOS Controls Everywhere**

将面向触屏的 iOS 大尺寸控件直接放进高密度桌面应用。

**Universal Glass**

所有组件均使用高透明度、高模糊度材质。

**Oversized Controls**

普通桌面工具栏和表单被设计成过大的移动端控件。

**Generic shadcn Appearance**

只替换颜色和圆角，却保留典型通用 Web 组件外观。

**Inconsistent Density**

同一个界面中，不同组件使用互不协调的控件高度、字体尺寸和间距。

**Weak Optical Alignment**

看似居中，但文字、图标和边界的视觉位置不准确。

**Excessive Shadow**

通过大量投影弥补缺乏空间层级的问题。

**Decorative Animation**

为普通操作控件添加无意义的悬浮、弹跳和缩放效果。

**Overengineering**

为了实现简单原生效果，重新引入复杂框架或破坏现有行为内核。

---

# 12. Continuous Autonomous Execution

你应该主动推动任务完成。

除非遇到真正需要用户决定的产品方向、无法恢复的技术阻塞或高风险破坏性变更，否则不要反复请求确认具体的视觉选择。

遇到设计歧义时：

1. 寻找更准确的原生设计参考。
2. 比较候选方案。
3. 根据功能语义和视觉一致性自主决策。
4. 将关键决策记录到 Design Decision Log。
5. 实施并通过实际渲染验证。

不要因为缺少一个明确参考就停止工作。

对于无法直接映射到 macOS 的组件，应根据整套设计系统已经建立的规律创造新的统一组件。

改造应采用小批量、可验证、可回退的工程迭代。

每个阶段留下明确的结果、问题和下一步任务。

持续执行直到全部 Registry 组件完成审计与适用的改造，官方文档也完成同步更新。

如果执行环境限制导致无法一次完成，必须保存机器可读的进度和后续任务，不得宣称未完成的组件已经改造成功。

---

# 13. Required Deliverables

在仓库内维护下列设计与工程文档，可根据现有目录规范调整文件位置。

**macos-design-language.md**

记录提炼出的 macOS 视觉与交互规则。

**macos-component-mapping.md**

记录全部组件的原生参考及设计决策。

**macos-token-architecture.md**

记录保留、复用、新增的 Token 和主题兼容策略。

**macos-redesign-progress.md**

记录组件改造状态、测试情况和剩余问题。

**visual-quality-report.md**

记录截图对比、视觉问题与改进结果。

这些文件应当服务于真实开发，避免重复原仓库已经存在的契约文档。

代码、组件、测试和文档站的实际变更是主要交付物。

**只生成设计方案、不修改代码，不算完成任务。**

---

# 14. Definition of Done

只有满足以下条件才能认为改造完成：

- 实际 Registry 中全部组件均已审计。
- 每个组件都有合理的 Native Reference 或系统设计依据。
- 所有适用组件完成视觉重构。
- 现有六套主题及明暗模式继续工作。
- 保留原有四套视觉原语的独立身份与可用性。
- 默认现代原语具备统一的 macOS 视觉语言。
- 关键交互状态经过真实浏览器验证。
- 复杂组件在实际应用组合中保持一致。
- 官方文档站完整使用改造后的设计系统。
- 原有功能、API 和测试契约没有未经说明的破坏。
- 构建、类型检查、核心单测和适用 E2E 通过。
- 关键页面通过桌面、移动端和明暗模式视觉检查。
- 已有品牌配色保持一致。
- 没有系统性的 Hardcoded Token、重复样式和无意义的视觉补丁。

# Final Design Standard

最终目标不是让 ICEN UI 成为一个简单的 Apple UI Clone。

而是：

**An exceptionally precise, macOS-native-inspired, framework-agnostic Web Design System that preserves ICEN's existing brand identity while adopting the geometry, material logic, interaction semantics, visual hierarchy, and craftsmanship of premium Apple desktop applications.**

在细节层面追求 Native Fidelity。

在设计系统层面追求 Coherence。

在工程层面追求 Maintainability。

在整体体验层面追求 Restraint、Precision 和 Intentionality。

不要停留在设计描述。

现在开始扫描仓库、建立参考映射、制定可执行计划，并逐批实施真正的代码改造。
