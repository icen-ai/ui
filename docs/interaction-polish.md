# 组件交互与图标精修清单

基线：fa3e945，工作区干净；版本保持 0.10.0。目标覆盖全部 122 个组件、文档示例和消费者接入。此文件记录进度，不替代浏览器验收。

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

### 第二轮：多选动作与示例文档

- select / tree-select 的 chips 已移到 trigger 同级，移除用原生 button；支持 Tab、Enter、Space，移除后焦点进入下一项或回到 trigger。旧的 trigger 内 chips 标记会自动迁移。
- 次要移除动作固定槽位，通过 opacity 显隐，不挤压正文；触屏常显并放大命中区域。补齐 select 的 listbox/option、多选与选中/禁用 ARIA 状态。达到选择上限时保留作者原有禁用选项。
- 新增 revealPopoverItem，只滚指定菜单内部；select / tree-select 已使用。
- 多选领域事件在 native hidden input 更新之后派发，清空后的焦点回到触发器。修复数字步进器及日期选择器查错原生 input 标签的问题。
- 组件页提供简短说明与可展开的完整行为细节；窄屏侧栏折叠为原生文档导航，首屏优先呈现真实组件。移动顶栏的外观入口包含三个轴。
- 真实 SVG 已覆盖文档导航、复制/完成、前后页图形；丰富选项色样的 CSS 随 select 分发，示例颜色直接来自主题目录。图标示例支持真实移除与撤销。
- 第二轮验证：verify 645 测试通过；24 条 Playwright 浏览器回归通过；137 页站点构建通过；全站默认状态基础巡检仍为 129 页 × 两档宽度、0 问题。
- 首批基础提交：715ba1d。第二批提交覆盖多选动作、文档首屏、移动导航和额外 native 表单绑定；版本保持 0.10.0，不发布。

### 第三轮：真实搜索、键盘与生命周期

- 修复组件 display:flex/grid 覆盖原生 hidden 的问题；规则仅覆盖 icen 类，保留 hidden="until-found" 的浏览器查找语义。
- select 搜索框移出实际 listbox，使用 combobox + active-descendant，保留输入光标；支持 IME、先清搜索再关闭的 Escape、Home/End、首字定位、跳过禁用项、Tab 按逻辑表单顺序退出。
- 动态增加选项/分组、文字与原生 disabled 自动同步；新增 refreshSelect 用于作者主动修改选中类。初始化静默读取原生值；销毁还原门户与临时限额状态，重复 init 不重绑。
- 搜索清空使用共享 SVG 与真实 button；鼠标或 Tab/Enter 清空后回到输入焦点。enhanceSearchField 提供 refresh/destroy，disabled/readonly 自动同步，销毁幂等。公共 CSS 随 tokens 分发，单引 select/tree-select/cascader 无新增 CSS 依赖。
- select/tree-select 小中大尺寸保持各自 token 高度，chips 不再把小号撑成中号。吸顶搜索栏留出滚动安全区；级联、自动完成、提及、命令面板、AI 输入台改为仅滚菜单内容。
- 第三轮验证：verify 651 测试通过；29 条浏览器回归通过；137 页站点构建通过；129 页 × 两档宽度基础巡检 0 问题。实际检查了搜索展开截图，已去掉浏览器蓝色清空图形。
- 尚未以这一批替代逐组件最终验收，完整交互/视觉矩阵仍待推进。

### 第四轮：层级搜索与连续操作

- 级联搜索补齐 active-descendant、真实选中/禁用状态和具名列表；结果导航跳过禁用路径，IME 不触发过滤或提交，空查询时左右键保留编辑光标。
- 树选择从搜索进入首/末可用行，Home/End 与 RTL 分支方向一致；多选重绘保留当前行焦点，触发器变高后面板跟随，空树有真实状态提示。
- 修正树分支 SVG 的基础朝向与 CSS 旋转不一致：展开朝下，收起朝书写方向。装饰性 chevron 不再伪装成缺少独立键盘行为的嵌套 button。
- 含 disabled 子节点的树仍诚实呈 mixed，但现在可以再次取消全部可选节点，不再卡在只能选不能取消的状态。
- select 的触发器、选项、清空动作在作者未声明 type 时设为 button，避免表单意外提交；增加真实表单验证。
- tree-select 补齐与 cascader 对称的 open/close（含 SSR no-op）；关闭时只恢复仍在面板内的焦点，销毁后不能用旧句柄重新挂回浮层。
- 文档 boot 支持 script 返回 cleanup，并用代际标记阻断异步旧页初始化；级联/树选择示例已接入销毁与定时器回收。其他例子/behavior init 仍需逐一接入，不能视作全站生命周期完工。
- 新增真实浏览器专项覆盖两套原语 × 明暗、RTL、触屏 44px 搜索动作、reduced-motion、空查询键盘、焦点连续性、展开状态几何、a11y 与换页门户回收。验证：verify 656 测试通过，站点 137 页构建通过，129 页 × 两档宽度基础巡检 0 问题。34 条浏览器回归覆盖原有外观联动与新增层级选择、表单防意外提交。

### 第五轮：动作菜单、图标槽位与焦点协调

- 重做 dropdown 的真实焦点与 roving tabindex：鼠标/触屏/键盘开关，ArrowUp/Down、Home/End、首字定位、Enter/Space、IME、Tab 正常退出；跳过原生、ARIA、类状态及隐藏/不可交互祖先中的项。
- 布局改用实际宽高，固定宽不再按默认 420px 错算位置；窄屏、RTL、长列表与视口底部翻转统一走既有布局引擎，键盘只滚菜单内部。
- 图标独占 20px 光学槽，选中标记移到尾部固定槽；混合有/无图标的行仍然文字对齐。补齐 edit/link/trash 共享 SVG 与 mask；右键菜单可用 iconName，不再要求手写 SVG。
- 选中项支持 menuitemcheckbox/radio 与业务管理的 aria-checked；data-icen-menu-keep-open 允许连续操作。禁用点击在捕获阶段拦截，不再触发宿主回调或关闭菜单；原始节点和监听随门户来回移动。
- 菜单进场收敛为 3px/1.5% 的轻位移/缩放，退出 90ms 内完成，并从当前动画位置续接。退出立即 inert + aria-hidden，重开/销毁可打断；时长随设计种子、reduced-motion 和像素 steps 变化。
- Context menu 补齐 Shift+F10/ContextMenu 键入口、Home/End/首字定位、Space 激活、Escape/Tab 焦点归还、内部滚动。unregisterContextMenu 与幂等 init disposer 让注册和生命周期可回收。
- 两类动作菜单共用焦点所有权，互相打开时旧菜单退出；捕获 Escape 只关闭最上层菜单，避免顺带关闭外层 popover。测试覆盖此嵌套关系。
- dropdown/context-menu 文档接入示例卸载，新增真实 checkbox、SVG、禁用项、键盘/触屏说明和更简短的首屏描述。source、kit 与注册表 API 一致。
- 验证：verify 662 测试通过，137 页站点构建通过。菜单专项覆盖两原语 × 明暗、触屏 44px、RTL/窄屏翻转、长列表滚动、换页/a11y、单次事件与表单防提交；既有全站 129 页 × 两档宽度基础巡检 0 问题。最终 39 条浏览器回归全部通过。
- 仍待：菜单混合选中态、全部尺寸/极端内容与完整 forced-colors 审美矩阵；popover/modal/command palette/通知及其余组件继续逐项。上述进度不代表全库交付完成。

### 第六轮：对话框、交互浮层与关闭动作

- 新增 focus 共用契约，modal / command palette 共用同一可聚焦列表；跳过隐藏祖先、inert、禁用、负 tabindex 与关闭 details 的内容，同时保留 fixed 控件与显式程序焦点。
- modal 修复默认初始焦点（尊重 autofocus）、幂等 disposer、无效目标不打断现有对话框；移除打开中的节点会自动释放滚动锁。关闭后归还原门户位置，重复打开可中断回收，换页 disposer 可立即清理。
- 对话框改为原生 display/opacity/transform 过渡，3D/大幅缩放不参与；普通面板 6px/1.5%，Sheet 16px。支持反向重开、reduced-motion 与不支持离散过渡的立即隐藏降级；大号 Sheet 不超出移动视口。
- interactive popover 支持 initialFocus / restoreFocus，关闭时仅在仍持有焦点的情况下归还。Escape 捕获优先关闭顶层 popover，menu 保持更高优先级，避免穿透关闭外层 modal；IME 不触发关闭。
- 对话框、toast、notification 的关闭图形使用共享 20px SVG。提示与通知复用 quiet action 槽位，hover/focus 显示，触屏命中区不小于 44px；键盘关闭后归还触发位置。
- 去掉 toast / notification 的重复 SVG 解析逻辑，统一 parseSvg；Toast 原先不可达的选项对象已接通 callable/语义方法/action，保留数字时长兼容。
- 文档对话框采用可操作的回收、工作区保存、预览、文档详情；输入框有 autofocus、命名反馈与空值校验。modal / popover / toast / notification 示例接入换页销毁，通知演示统一回收轮询、进度与延时任务，异步 confirm 不跨页弹旧结果。
- 验证：verify 668 测试通过；137 页站点构建通过；45 条浏览器回归通过，覆盖两原语 × 明暗、三尺寸焦点循环、原生关闭过渡与快速反向、移动 Sheet / 44px、保存反馈、popover 焦点、a11y、关闭图标、换页回收。129 页 × 两档宽度基础巡检 0 问题。追加的通知运行中换页回收专项同样通过。
- 尚待：popover 完整布局/嵌套/空/加载动效与所有插槽状态；Toast / notification 异步 action、倒计时暂停/恢复、堆栈更新/持久化的完整 UX 审计；更多通知图形仍待统一。不能以本轮焦点和关闭动作验收代替整族最终完成。

### 第七轮：反馈时序、可取消操作与语义图形

- 新增 feedback 共用运行时：hover、focus、后台、手动与异步操作分别占有暂停原因，解除一项不会错误恢复另一项。Toast 支持 0 常驻及 pause/resume；通知更新 duration 保留已有暂停原因，CSS 进度与真实剩余时长同步。
- Toast/notification 等待同步或异步回调完成后再关闭；Promise/同步 false 保持打开，拒绝或抛错展示可本地化的行内重试反馈并暂停超时。AbortSignal 传给业务操作，关闭、替换或销毁时取消旧 UI 续接；重复操作每卡只运行一个。
- 忙碌按钮保留原标签尺寸和键盘焦点，使用共享 SVG 进度圈覆盖标签。关闭仍可访问，触屏动作命中区两个方向均不小于 44px；像素原语使用分步转动，reduced-motion 保留静态忙碌形状。
- 成功/警告/错误/信息统一为原创 20px 几何；进行中的进度通知为 busy arc，完成后变为检查图形与成功色。iconName 可直接选择共享符号，非法 SVG 不再降级成文字图标。
- 同 id 替换立即退役旧 DOM 和运行时；旧 handle 不能修改新记录。actions/link/icon/avatar/priority 等更新真实反映到 DOM；actions 空数组可清空旧单动作，焦点不掉出卡片。
- 堆栈缩限一次处理全部超限记录，优先退役已读 normal 通知；淘汰/销毁也执行关闭回调，confirm 不再因淘汰悬空。所有权释放取消计时监听和旧操作；退场只听自身过渡，子按钮不会提前结束整卡动画。
- 可点击通知改为原生标题入口，移除父 role=button 与子按钮冲突，Enter 不再拦截兄弟动作。跨反馈卡片归还焦点时保留可用的原触发点，并在旧卡片退役后回退到外层入口。
- 调用方反馈文本与错误内容采用 bidi 隔离，RTL 布局不再把中文句末标点挤到句首。文档 lead、示例注释和计数也同步处理。
- 文档新增有说明的异步失败/重试示例，首轮模拟失败、第二轮成功；关闭或换页会取消演示定时任务。链接示例指向真实本真工作室，移除无意义的 # 跳转。注册表补齐 createNotificationCenter。
- 验证：verify 678 测试通过，137 页站点构建通过；51 条浏览器回归全部通过；129 页 × 两档宽度默认页基础巡检 0 问题。专项覆盖两原语 × 明暗、异步等待/重试/取消、稳定按钮尺寸、触屏/RTL/a11y、语义 SVG、进度完成态和独立键盘入口。
- 尚待：持久化跨容器/卸载与重新挂载、tag 聚合/优先级的完整状态模型、通知所有极端内容/尺寸/强制色彩矩阵；其余组件仍按原目标继续。不要将本轮公共运行时的验证等同于整库完成。

### 第八轮：通知存档与挂载边界

- 修复已卸载中心的存档被其他中心保存时清空：按记录合并快照，明确卸载保留、dismiss/clear 删除。共享 key 的活跃记录不重复恢复，退场同 id DOM 不会与恢复节点并存。
- 中心已读操作经统一更新链路保存；常驻通知改为计时通知时删除存档，恢复常驻可重新保存；堆栈淘汰删除对应存档。切换 key 迁移当前所属记录，关闭持久化保留旧存档，销毁后的配置不再生效。
- 恢复时校验记录形态、语义种类、文本与有限数值，去重 id 并限制进度范围；损坏 JSON 跳过，恢复栈也遵守 maxStack。每个 key 独立处理存储异常，避免一个中心阻塞其他中心。
- 文档新增保存/卸载/恢复/清除存档的真实例子；换页先卸载独立中心再清理全局反馈，存档可跨组件页面与刷新恢复。接入说明明确函数回调不序列化，恢复后由宿主重新接入 actions。
- 验证：verify 683 测试通过，137 页站点构建通过；新增 5 条持久化 DOM 用例，真实浏览器跨页与刷新恢复专项通过。7 条反馈浏览器回归全部通过；129 页 × 两档宽度默认页基础巡检 0 问题。
- 尚待：tag 当前仅存储与更新字段，没有实际分组展示；不能将原有的分组说明视为功能证据。还需完成分组视觉/键盘/计数语义，以及极端内容、尺寸、forced-colors 的完整验收。通知全族尚不标记完成。

### 第九轮：真实通知分组与连续操作

- tag 落实为容器内的真实折叠组：保留原始卡片、动作、进度和记录身份，默认呈现最新收到的通知，高优先级成员优先。数量/未读数可见，展开/收起为原生按钮，aria-controls 关联原卡片。
- 分组入口使用共享 20px 几何与固定尾部槽位；展开沿用公共轻淡入，像素原语分步呈现，reduced-motion 无动画。触屏入口不小于 44px，RTL 图文槽位自动镜像。
- 折叠成员同时退出布局与焦点序列，并按独立 group 原因暂停倒计时；展开只释放这一项，不覆盖 hover/focus/手动暂停。原始 actions 保持同一 DOM 与回调，不因折叠复制或丢失。
- 焦点所在卡片或进行中的操作不被新通知隐藏；忙碌期间组保持展开，并说明暂时不可收起的原因。新的汇总接替旧汇总时迁移展开按钮焦点；改组后入口消失时归还卡内动作或原触发点。
- 支持 tag/priority/unread 动态更新、组解散、关闭汇总代表接替、容器隔离及存档重挂载。maxStack 继续按原始记录数计算，用法已明确，避免将折叠误解为无限历史中心。
- 文档新增团队审阅的三条同组消息，可展开后分别查看批注；接入只需 tag，无额外包装器或宿主拼装。展开按钮直接以可见文字命名，读屏名称与界面一致。
- 验证：690 项测试与 137 页站点构建通过；新增 7 条 DOM 回归及 2 条浏览器专项，既有 54 条浏览器回归全部通过，覆盖两原语 × 明暗、键盘、触屏/RTL/reduced-motion/a11y、真实批注动作、未读与关闭接替；129 页 × 两档宽度默认页基础巡检 0 问题。最终名称简化后，两条分组专项复查同样通过。
- 第八轮记录的 tag 仅有字段问题已解决。通知全族仍需极端内容/尺寸/forced-colors/长栈可达性验收；日期选择、自动完成及其余组件按完整目标继续，不能以本轮分组验收替代全库完成。

### 第十轮：日期网格、范围与表单连续性

- 重整日期选择运行时：严格解析 ISO 日期，不将 2 月 31 日自动滚到 3 月；保留早期年份与真实闰日。已有非法/超范围值诚实标记 aria-invalid，日历选择、今日、翻月及键盘候选统一遵守范围，矛盾范围呈现明确空态。
- 日期网格采用真实 row/gridcell 与 roving 日期按钮，只让一个日期进入 Tab 顺序。支持视觉方向的左右键、上下周、Home/End、PageUp/Down 与 Shift 翻年；跨月保留日期意图，月底向短月移动正确夹取。翻月后焦点落回新的同名动作，Escape 只关当前日历并归还触发器。
- 与共享浮层焦点所有权协调，测量实际日历高度后翻转/钳制；短视口只滚动日历内部以保持活动日期可见，Tab 在首尾与原字段后续控件衔接。局部 RTL 方向传入门户，不能只依赖 html 的方向。
- 原生日历值、隐藏输入 change、领域事件、动态约束/格式/尺寸、禁用与字段集禁用一致。组件记住初始隐藏值以实现有效 form.reset，遵守取消重置；重复 init disposer、销毁重入、触发节点移除和换页均回收门户与监听。
- 新增共享 20px calendar SVG；触发器尾部固定光学槽，翻月按钮为统一 chevron。触屏日期/翻月/底部动作与触发器保持至少 44px，邻月与今日文字修复对比度；强制色彩保留选中态，沿用统一磨砂/减少透明度/像素材质。
- 文档用发布日期、十一月排期、复盘和锁定排期覆盖三尺寸/空值/范围/禁用，并提供真实变化反馈和恢复初始日期；不再只向 console 写结果。示例卸载接入真实 disposer，去掉从未实现的直接 icen-input 包裹说明。
- 验证：新增 9 条 DOM 回归和 5 条真实浏览器专项；此前 59 条浏览器回归通过，129 页 × 两档宽度默认页基础巡检 0 问题。最终动态尺寸与方向补充后，verify 699 测试通过，5 条日期浏览器专项复查全部通过；站点 137 页构建通过。截图在淡入完成后检查，避免将中间帧误判为材质缺失。
- 尚待：所有主题/尺寸的长文本与更多门户嵌套组合仍需完整矩阵；日期的核心重设计不能代表整组选择器最终验收。下一项 autocomplete 已确认 source 失败混为空态、关闭未取消异步续接、IME 方向键未完整保护，继续针对源码与文档解决；mentions 随后。

### 下一批待处理（保留完整目标）

- 选择器尚需完整触屏、forced-colors、跨页卸载与每种状态的视觉验收；基础键盘/搜索/动态数据/销毁与滚动专项已完成。
- Date picker / cascader / tree select / autocomplete / mentions：全部尺寸、搜索/空/加载/错误/禁用状态，完整键盘与两轴视觉矩阵。
- dropdown / context-menu / popover / modal / command-palette / notification：开关动效、焦点、触屏与所有文档示例。
- 标签、工具条、导航、分页、表格/图表、AI 与知识库逐一复核。大量原有 SVG 的 close/check/chevron 仍可进一步收敛到共享几何；不能把已迁移字符图标等同于完整图标审美验收。
- 文档 ClientRouter 下各 behavior/create 句柄的卸载和重入，以及真实 native 表单绑定的系统性巡检。
