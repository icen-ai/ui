# ICEN UI · 应用设计语言与第二轮重构契约

> 目标：用稳定几何、可组合 API 和可验证的真实场景统一组件，而不是给现有界面再叠一层皮肤。
> 本文的“参考”只提供功能判断依据；实现事实以当前源码为准。变量细节见 `macos-token-architecture.md`，逐组件要求见 `macos-component-mapping.md`。

## 1. 证据等级与当前边界

| 标记 | 含义 |
| --- | --- |
| **源码实现** | 已在当前 token、CSS 或 behavior 中找到实现路径；只证明代码契约存在 |
| **第二轮要求** | 本轮确定的实现/演示目标，不能当成已经完成 |
| **待视觉核验** | 需在浏览器中用真实内容检查几何、阅读、焦点、溢出、交互和材料表现 |
| **文档方向** | 官方文档计划演进的方向，不表示工作台或真实应用已经交付 |

当前结论：

- 默认几何、圆角、表面、反馈、焦点和动效变量为**源码实现**；基础批已完成 1060 项工程测试、27 项专项浏览器场景、19 项视觉基线与 214 张代表巡检。六套配色和四种原语的完整组件状态仍逐批核验，不从代表矩阵外推完成。
- `select` 的清除/披露独立槽、异步建议的取消与竞态守卫、popover 布局/焦点回收、AI turn 失效守卫、引用按渲染根登记为**源码实现**。这些能力在完整业务后端与多实例页面中的表现为**待场景核验**。
- `cascader`、`tree-select` 仍有清除时隐藏披露图标的旧规则；共享 data-row 角色尚未被 table/datatable 全面消费；部分组件仍保留局部固定高度、模糊或负字距。这些是**第二轮迁移项**，不是新的设计许可。
- `kb-citation`、`kb-passage` 当前仍可能把非 readable 的 citedText/snippet 以 blur 形式写进 DOM；`kb-answer` 仍使用未接入就近来源池的简化引用渲染。它们与第二轮“受限原文不占 DOM”和 answer-scoped evidence 要求冲突，必须迁移，不能视为已完成。
- 基础批结果不代表全 Registry、真实模型服务或全部视觉场景已验收。后续状态以 `macos-redesign-progress.md` 和 `visual-quality-report.md` 为准。

## 2. 设计立场

1. **任务先于外观**：先说明组件帮助用户完成什么，再选择功能参考与解剖结构。参考不等于复刻，也不为 AI/KB 虚构现成系统控件。
2. **稳定先于动画**：外框、文本槽、操作槽、焦点边界与滚动归属先稳定；状态变化不得把内容挤走。
3. **组合先于定制页**：优先使用已有按钮、字段、菜单、popover、表格、图表、AI/KB 部件，通过明确 slot、句柄和事件组成应用。
4. **证据与过程并重**：AI 呈现任务过程，KB 呈现证据与权限边界；真实场景必须能从问题追到工具、来源、原文和最终结果。
5. **品牌不被抹平**：配色、字体和其他原语保留独立身份。共享的是结构语义与可访问性底线，不是同一种表面效果。
6. **完整场景才算演示**：只有成功静态截图不算完成；加载、空、错误、取消、重试、长文本、权限和销毁路径都要可到达。

## 3. 稳定几何

### 3.1 高度、密度与阅读

默认原语的普通控件高度如下；`item-height` 跟随 sm：

| 密度 | sm | md | lg | item-height |
| --- | ---: | ---: | ---: | ---: |
| normal | 28px | 32px | 40px | 28px |
| compact | 24px | 28px | 36px | 24px |
| comfortable | 34px | 38px | 46px | 34px |

- density offset 为 compact `-4px`、comfortable `+6px`；间距 scale 为 `.75/1/1.25`（compact/normal/comfortable）。
- compact 不缩小阅读文字。默认界面基准 13px，caption/sm 不小于 12px；业务长文可提高正文尺寸，不拿控件密度压缩长文。
- 粗指针的控件与行目标至少 44px。小图形可保持原视觉尺寸，用真实或透明命中区扩展；不得把 44px 误写成所有 glyph 的尺寸。
- toolbar、option、choice、data-row 分别消费自己的角色，不把某一种行高套给所有容器。

### 3.2 圆角角色

| 角色 | 默认值 | 用途 |
| --- | ---: | --- |
| xs / sm / md / lg / xl | 4 / 6 / 8 / 12 / 16px | 从 `design-radius: 8px` 推导 |
| 常规控件 | 6px | 按钮、输入、选择触发器；大控件角色为 8px |
| content | 8px | 内容型表面 |
| panel / floating | 12px | 面板、菜单、popover |
| modal | 16px | 对话框；贴边 sheet 只保留非贴边侧轮廓 |

嵌套轮廓按实际间距与边框做同心扣减；独立控件不因为放进大容器就被改成同一个半径。其他原语可覆盖这些角色以保留自己的身份。

### 3.3 槽位不重叠

常规字段末端槽：

- disclosure：字段 inset 9px + chevron 12px + gap 6px，预留 27px。
- clear：在 disclosure 之外再增加 affix 24px + gap 4px，共预留 55px；粗指针 affix 为 44px，因此预留 75px。
- 清除与披露必须共存。清除是值操作，披露是面板操作，不能互相替代；clear 与 trigger 不得形成嵌套 button。
- leading、value/chips、clear、disclosure、trailing meta 各有位置。隐藏次要动作只能改变透明度/可见性，不能改变外框或推动邻列；键盘 `focus-within` 与 hover 等价，触屏无 hover 时动作持续可达。
- 多行输入、chip 汇总和长值允许纵向生长；单行值使用 `min-width: 0` 与截断，完整值应可由 title、详情或可访问名称获得。

**第二轮要求**：把 `cascader`、`tree-select` 及其他复合触发器迁到同一槽位契约，删除“clear 出现时隐藏 chevron”和各自发明的末端 padding；同时检查 sm/lg、多选、RTL 与粗指针。

### 3.4 AI 与数据条目的稳定性

- AI 输出根使用 `align-self: stretch`，不靠 `width: 100%` 在 shrink-wrap 宿主中猜宽；流式内容以纵向生长为主。
- 消息、工具、todo、线程、检索结果和图表更新必须有稳定 key/节点归属。流式 delta 追加到所属文本节点，不整块重建消息列表。
- 状态更新保留用户展开/折叠、焦点、选区、滚动位置与草稿；异步结果只能提交给仍有效的 turn/query/mount。
- skeleton/empty/error/loaded 的容器保持明确最小几何；加载结束不应造成无意义的宽度跳动。

## 4. 排版与数字

| 角色 | 当前口径 |
| --- | --- |
| 页面/卡片标题角色 | title = density lg，默认 15px / 600；heading 行高 1.25、字距 0 |
| Section / control | 默认 13px；control 字重 500、字距 0 |
| Body | 默认 13px / 400，行高 1.55；阅读场景可由业务提高 |
| Caption / metadata | 默认 12px；caption 字距 `.01em`，不为所有小字统一拉字距 |
| Code / path | 独立 mono 栈；不为正文强制等宽 |
| 数据 | 仅 `.icen-numeric`、表格、指标和明确数据区使用 lining/tabular numerals；body 保持 normal |

**第二轮要求**：删除仍存在的局部负标题字距和重复固定字号，改用角色变量。不要为了“紧凑”把 CJK 正文压到 12px 以下，也不要给整段正文启用数字字体。

## 5. 表面、材料与层级

| 层级 | 任务 | 当前配方 |
| --- | --- | --- |
| canvas | 应用工作区底 | 主题 canvas，不承担每张卡片的阴影 |
| content | 阅读、编辑、表格 | 不透明 content 面，细边界；静态时通常不投影 |
| chrome | 工具条、导航、侧栏 | 由 canvas 与 surface 混合的 chrome/toolbar/sidebar 角色 |
| floating | 菜单、popover、tooltip、临时检查器 | 不透明 surface、细边与 elevated/material-light |
| modal | 强聚焦决策 | 不透明 surface、overlay shadow 与 scrim；modal 圆角角色 |
| selected | 持久值/当前位置 | accent 10% 填充，不作为另一种浮层 |

- 默认 modern 的内容、菜单、popover、选择面板、命令面板、toast、通知和图表 tooltip 使用稳定实面，**不启用 backdrop blur**。
- 阴影只辅助说明接触与层级，已简化为少量 contact/ambient 组合；静态卡片不堆大阴影，floating/modal 才使用更高层级。
- glass 参数和其他原语的透明配方保留；它们不是默认 modern 标准组件的新许可。减少透明偏好与 `data-icen-transparency="reduced"` 提供实面降级。
- chinese、soviet、pixel 继续保留自己的字体、轮廓、结构线、点阵与光影。共享 token 不等于共享 modern 的表面物理。

**待视觉核验**：亮暗主题下边界/阴影是否足够分离，复杂背景上实面是否清楚，非默认原语是否被现代适配意外覆盖。

## 6. 交互状态各有语法

| 状态 | 当前规则 | 不得混淆 |
| --- | --- | --- |
| hover | 中性 ink 4% 填充；可加强控件边界 | 不等于 selected，不做布局位移 |
| pressed | 中性 ink 8% 填充，可用内影 | `press/press-soft: none`，不缩放、不改占位 |
| keyboard current | 中性当前行填充 + 明确的 focus-visible 边界 | 是导航位置，不是已提交值 |
| persistent selected | accent 10% 填充，正文色保持可读 | 键盘当前项移到别处后，已选值仍保留 |
| checked option | 保留末端 check glyph；字重可提升 | 不只靠当前行底色 |
| focus | accent 78% 与 surface 混合的不透明指示；2px surface + 4px indicator 外环 | 不以浅色光晕替代清晰边界 |
| disabled | opacity `.48`，禁用相应事件，尺寸不变 | 不用降低布局或隐藏值表达 |
| error / loading | error 边界与具体文案；`aria-busy` 和可恢复动作 | 不只靠红色或旋转图形 |

原生 checkbox 保留原生 appearance、表单值、mixed 与键盘行为，accent 使用 `accent-strong`；button checkbox 使用共享 check mask。forced-colors 使用系统 Highlight/Canvas 等颜色与轮廓补充状态，不要求阴影可用。

## 7. 动效：说明方向，不制造重排

绝对时长基值为 fast 110ms、base 180ms、slow 260ms、deliberate 420ms；组件语义时长由 `design.css` 乘 `design-motion` 后提供，不把基值当成每个组件的固定动画。

| 浮层 | 当前入场几何 |
| --- | --- |
| menu | fade + 2px 按 side 位移；不缩放 |
| popover | fade + 6px 按 side 位移 + scale `.99` |
| dialog | fade + 2px 位移 + scale `.985` |
| sheet | fade + 12px 贴边方向位移；不缩放 |

- 动画只解释来源、状态或层级，不给普通按钮 hover 放大，不让卡片持续漂浮，不让多个浮层共享一种夸张缩放。
- 测量使用未形变布局；popovers 在真实内容高度确定后选侧，保留内部滚动位置。press 与加载状态不改变控件布局。
- `prefers-reduced-motion: reduce` 时语义时长归零，循环动画瞬时结束一次，平滑滚动回 auto；`data-icen-motion="reduce"` 可主动降级，`"full"` 可在系统降级时恢复完整动效。
- 状态在减少动态后仍可辨认；减少动画不等于删除加载、选中或错误信息。

**待视觉核验**：四向翻侧、连续开关、嵌套浮层、低速设备、减少动态和手动 full 下的焦点/隐藏结算。

## 8. 可组合 API 与所有权

### 8.1 三种组合面

1. **Markup slots**：head/body/foot、leading/value/trailing、actions/meta、mount 点采用稳定类名和顺序；可选槽缺省不硬造内容。交互子元素不得嵌套交互元素。
2. **行为句柄**：`render*` 返回元素或稳定更新句柄，`create*` 暴露 get/set/update/open/close/destroy 等所需方法，`init*` 幂等并返回 disposer。事件与回调可并存，但不能各自维护一份状态。
3. **局部变量与数据属性**：变体覆盖组件局部装配槽；主题、密度、材料、尺寸通过 `data-icen-*` 组合，避免为一个场景复制整份 CSS。

### 8.2 异步控制器

- 查询输入时立即使旧 query 失效；debounce、同步异常、Promise 成功/失败都检查同一序号与 AbortSignal。close、替换值、禁用、卸载和 destroy 均取消旧 continuation。
- `createSuggestionQuery` 已为 autocomplete/mentions 提供此基线，source 接收 `{signal}`；loading/empty/error/retry 是 listbox 的兄弟，不冒充 option。
- AI 的 prepare/upload/stream、KB 文档加载、sandbox RPC 和工具执行各自拥有取消与销毁路径。新 turn 开始前使旧 turn 失效，再 abort；迟到 chunk/result 不得覆盖新状态。
- 超时只能承诺可中断的异步工作；同步函数不能因设置 timeout 就被宣称可取消。

### 8.3 浮层所有权

- 新浮层使用 `behaviors/popover.ts` 的 PanelSizing、视口选侧、portal 和 z 标尺；不在域组件里写死另一套定位宽高。
- 每次打开都有明确 anchor、panel、returnFocus 与关闭 owner。嵌套时 Escape 只退最上层；旧 owner 的 release 不得关闭新 owner。
- 关闭/销毁回收 observer、监听器、计时器与 portal；只有浮层拥有焦点时才还原焦点，避免抢走用户已移到别处的焦点。
- 内部滚动不触发自身重定位；外部 scroll/resize 与内容尺寸变化才重新测量，并保留滚动位置。

### 8.4 AI/KB 的证据与安全边界

- 每次回答持有自己的来源池、引用编号、工具调用与异步 turn；就近渲染根优先于模块级兜底，多个回答同页不能读到“最后渲染者”的来源。
- 真实 agent 场景形成 model → tool call → host execution → tool result → model 的闭环。静态工具卡或预设回答不证明此闭环存在。
- 引用只能来自该回答经过权限过滤的候选集；无效编号降级，权限撤销使用中性不可用态。
- `hidden` 权限意味着不渲染，也意味着标题、摘要、分数、原文等受限内容不进入 DOM、可访问名称、链接或隐藏属性。CSS blur、遮罩、`aria-hidden` 都不是数据安全边界。
- 检索安全依赖 query-time pre-filter 与服务端身份，不能靠生成后或呈现后过滤。普通用户视图保持“未知/不可说”不可区分；差异对照只出现在明确 admin 审计场景。

## 9. 可访问性底线

- 可聚焦元素有 `:focus-visible`；composite widget 使用对应 APG 模式、roving tabindex 或 `aria-activedescendant`，状态同步 `aria-expanded/selected/checked/busy`。
- modal 有 focus trap、Escape、焦点还原和滚动归属；非 modal 抽屉不得冒充 modal。原生 `[hidden]` 与 `until-found` 不被组件 display 规则意外覆盖。
- 错误有文本与关联，加载有状态，选中/勾选不只靠颜色，图标按钮有可访问名称。
- 粗指针目标至少 44px；输入避免触发不必要的页面缩放。RTL 使用逻辑属性，只有明确物理语义的图形/坐标不镜像。
- forced-colors 下焦点和选择仍有轮廓；减少动态/减少透明后功能不消失。正文与控件标签以至少 4.5:1 为目标，关键边界和焦点以至少 3:1 为目标，并在实际配色组合中核验。

## 10. 真实场景与文档方向

### 10.1 第二轮演示的最低完整性

每个组件页不再以孤立成功态为唯一主角，而是提供一个能完成任务的场景：

- 有真实数据模型、明确输入/输出和可组合 API；可复制示例不依赖文档站私有全局状态。
- 覆盖默认、长内容、空、加载、错误、禁用与销毁/重挂载；涉及异步时再覆盖乱序、取消、重试与迟到结果。
- 涉及浮层时覆盖嵌套 owner、viewport 边缘、内部滚动、Escape、焦点还原和 RTL。
- AI 优先覆盖真实流式、停止、排队、续写、工具审批、工具结果回灌、用量与错误；可用注入 fetch 做可重复演示，但必须执行真实代码路径并明确是否为模拟传输。
- KB 优先覆盖检索身份、pre-filter、答案级证据、原文定位、冲突、无答案、权限申请与撤销；同页多个答案不得串来源。
- 图表覆盖大数据、缩放/追加/导出/加载联动、可访问数据替代和 destroy；不只展示一张静态 SVG。

### 10.2 官方文档的演进方向

**文档方向，而非已完成事实**：官方文档将逐步转向 scenario-led workbench，以任务场景组织组件；提供可编辑 inspector 调整输入、状态、主题、密度和 slot；最终用真实应用串起 AI、KB、图表和通用组件。inspector 应修改真实组件状态，场景应运行真实 behavior，而不是生成一张貌似可交互的图片。

### 10.3 第二轮验收证据

| 层级 | 可接受的证据 | 当前状态 |
| --- | --- | --- |
| 契约 | 源码路径、变量公式、API/DOM/事件归属、registry 覆盖脚本 | 本文只记录已核对部分 |
| 场景 | 真实行为驱动的端到端任务，含失败/取消/权限路径 | **第二轮要求**，不宣称完成 |
| 视觉 | 浏览器截图/量测、键鼠与触屏检查、长文本与多主题组合 | **待视觉核验** |
| 系统 | 真实 provider、上传、检索、权限服务和工具后端 | 由具体应用补足，不由静态 demo 冒充 |

## 11. 有目的的参考

- [Apple HIG · Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)：用于检查不同尺寸下动作层级和控件解剖的一致性；不提供本库尺寸或完成证据。
- [Apple HIG · Materials](https://developer.apple.com/design/human-interface-guidelines/materials)：用于区分内容、操作与临时层级；不据此要求默认 modern 使用模糊。
- [WAI-ARIA APG · Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) 与 [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)：用于键盘、焦点和弹层语义校核。
- [WCAG 2.2 · Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)：用于目标尺寸判断；粗指针产品策略采用 44px 下限。
