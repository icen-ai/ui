# 组件交互与图标精修清单

基线：fa3e945，工作区干净；版本保持 0.10.0。目标覆盖全部 122 个组件、文档示例和消费者接入。此文件记录进度，不替代浏览器验收。

## 验收标准

- 操作、状态、方向符号使用一致的 SVG 几何，不用 Unicode 字形充当图标；内容和键盘键名保留真实文字。选中态按用户最新要求改为表面/几何，不使用勾号；弹出式触发器不展示上下箭头。
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
- [x] tag-input
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
- [x] popover
- [ ] tooltip
- [x] command-palette
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
- [x] carousel
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

### 第十一轮：建议查询、重试与多行提及

- 新增 suggestions 公共运行时：源接收 AbortSignal，新输入即失效旧代际（包含新一轮防抖等待）；关闭、失焦、setValue、禁用、节点移除与销毁取消旧工作，不允许旧 Promise 重新弹层。两个组件共用继承状态/尺寸/方向观察与安全的加载/失败展示。
- 加载/空结果/失败不再混淆。共享 20px 光学槽承载 SVG busy arc 与信息符号，错误有可点击、可 Tab 到达的重试；输入中 Enter 可重试，Shift+Tab/正向 Tab/Escape 在原字段与后续控件之间有明确衔接。取消失败态同样恢复严格输入的已提交显示值。
- 面板外壳与真实 listbox 分开；listbox 只含命名 option，状态与按钮是其兄弟。多行 textarea 保持原生 textbox，移除不被该角色支持的 aria-expanded；已有宿主 ARIA 在销毁后还原，重复创建替换旧 owner，旧句柄不影响新实例。
- 两类输入完整保护 IME 的方向键、Enter、Escape 与 keyCode 229；结束组合后的重复原生 input 去重。autocomplete 保留严格/自由输入与 getValue/显示 label 契约；开始新查询即撤去旧可提交候选。面板与输入外壳边缘对齐，长列表只滚自身，局部 RTL 传入门户。
- mentions 增加 close 与安全 renderItem，按实时光标 token 校验插入位置；插入派原生 input，track 只保留完整标签，不把 @alice2 当成 @alice，getMentions 返回当前文本对应的副本。caret 镜像同步方向/对齐/换行方式，键盘与点击移动光标会重新核对 token。
- 文档换成项目、负责人、分类、讨论成员和团队目录的真实示例；异步源可以显式模拟一次失败并重试。改用可见反馈，移除会自动消失的 JSON 事件日志；两页都返回 disposer，演示等待随 signal 取消，监听随页面卸载清理。
- 验证：verify 707 测试通过；新增 8 条生命周期专项（防抖竞态、旧结果、重试焦点、IME、宿主属性、提及与禁用），现有两族 32 条回归同样通过；64 条浏览器回归通过，137 页站点构建通过，129 页 × 两档宽度默认基础巡检 0 问题。最后的重试按钮 Escape 与完整标签边界已补单测，最终 5 条建议浏览器专项复查同样全部通过。
- 尚待：所有主题/密度/长内容与更多嵌套交互的完整矩阵、严格输入的更多原生表单接入组合。这一轮不将默认页无溢出等同于全页 a11y 通过，也不标记整个选择器组完成。
- 新的实际证据：在 autocomplete/mentions 文档整页 axe 中，代码区浅灰底上的 Shiki 注释约 3.81、部分语法约 4.22/4.48、折叠计数约 4.46，未达到正文 4.5；部分可横滚的 pre 也没有键盘入口。当前输入示例与弹层专项无严重问题，但文档代码块应作为下一轮共同基础修复，不能忽略或据此宣称全站可访问性完成。

### 第十二轮：代码阅读、静默工具栏与可取消复制

- 代码块的文件、终端、分支、行号、换行、折叠与复制统一使用共享 20px SVG 几何，固定光学槽；桌面工具栏随悬停/焦点显现，成功与错误状态保持可见，触屏动作至少 44px。文件名与源码保持 LTR 隔离，RTL 布局照常镜像工具栏。
- SSR 与浏览器渲染统一保留空行、移除一个末尾换行的策略；复制读取真实行文本，不依赖受换行/行号影响的 innerText。命名 pre 提供键盘滚动入口，行号、换行与折叠通过 aria-controls/pressed/expanded 同步关联。
- 折叠从当前实际高度续接，可反向打断；transitionend 只处理当前区域的 max-height，并有有界超时回收。减少动效直接落位。重复 init 返回真实 disposer，嵌套委托只响应一次，动态插入自动接入，移除/销毁回收动画和反馈。
- 复制复用公共异步动作：等待中去重且保留按钮尺寸，成功呈现共享 check 与读屏状态，失败显示简短可见文案并可原位重试。卸载后不再续接反馈或执行失败后的兼容复制；已交给系统剪贴板的写入无法撤回。兼容 textarea 复制后恢复原焦点。
- 代码纸面改为主题 surface，文档构建期对 Shiki 前景保留色相并校准六主题 × 明暗 × 高亮/增删底色对比度，语法文字目标至少 4.8。只调整真实 style 属性中的前景，不误改源码字符串或背景；npm 的任意可信高亮槽仍由调用方负责配色。强制色彩使用系统 Canvas/CanvasText。
- 修正示例中 initCopy 的错误导入，说明 scoped init、销毁和事件契约，移除未发布版本与“三例均为 Shiki”的不实说明。第十一轮记录的 autocomplete/mentions 整页代码对比度与不可聚焦滚动问题已修复；两页整页 axe 复查均无 serious/critical 项。
- 验证：verify 715 测试通过；代码相关 17 项定向复查通过，137 页站点构建通过。新增 8 条真实浏览器专项全部通过，覆盖六主题明暗代码区 axe、准确复制/失败重试、快速反向折叠、触屏/RTL/像素/减少动效与系统强制色彩；已检查桌面折叠与手机像素截图。129 页 × 两档宽度默认基础巡检 0 问题。
- 最终固定构建下的 72 条浏览器回归全部通过。此前回归与站点重建重叠，两个页面曾因加载中断超时；已先复查相关 8 条，再完整重跑确认。最终类型检查、全部守卫及 diff 空白检查通过。本轮保留未提交供预览，不升版、不发布。
- 尚待：通用 copy 组件自身仍有独立旧生命周期，不能以本轮 copyText 的增强视为全族完成；长页面尾部折叠焦点/滚动、所有密度和更多嵌套场景仍需验收。其余组件按完整目标继续，本轮不勾选整库完成。

### 第十三轮：通用复制的插槽、反馈与接入生命周期

- 上一轮已验证的代码块修改补提交为本地检查点 29524bd，保持 0.10.0，不推送、不发布；本轮继续处理 copy 全族的核心运行时与文档。
- 通用复制接入共享 feedback 异步动作：等待去重、共享 SVG spinner、可取消 UI 续接、成功与失败就地呈现。成功使用独立叠层，保留原始文本、SVG、节点身份与其监听；两层共占网格预留宽度，不再通过 textContent 破坏宿主插槽。空图标槽自动使用共享 copy/check。
- 同一 root 重复 init 返回真实 disposer，嵌套 root/document 委托只执行一次；按 owner 引用维护增强节点，旧 disposer 不影响新 owner。动态插入自动接入，整段宿主卸载、节点移除或禁用会取消等待；最终 owner 销毁还原原节点与 ARIA。原生字段集的首个 legend 例外、祖先 aria-disabled 和默认表单按钮都正确处理，复制不会意外提交表单。
- 失败显示安全的本地化文字，以 aria-describedby 关联原按钮并保留宿主原说明；点击原按钮即可重试。原始诊断只留在 icen:copy-error。成功读屏名称和状态同步，1.4s 后复位；失败提示不会被旧成功定时器清掉。反馈和中文文档段落采用自动方向，修复 RTL 标点倒置。
- initCopy(root?, { write? }) 是可选原生桥/权限流程入口，true/void 成功，false/抛错显示重试，context.signal 供宿主协作取消。默认仍走系统剪贴板和兼容回退；copyText(text, { signal }) 可独立使用，已交给系统的写入无法撤回。无额外依赖。
- 三档尺寸、透明与上下文 quiet 变体共用密度 token；只让明确包在 copy-scope 内的次要动作隐式显现，键盘焦点、等待、错误和成功保持可见，触屏始终显示且命中区域至少 44px。减少动效与 forced-colors 均保留状态辨识。
- 文档改用安装命令、作品链接、禁用与真实异步重试案例，首次明确模拟失败，随后尝试实际复制；换页清理监听和演示任务。去掉私有旧 SVG 与错误类名说明，补齐 scoped init、销毁、原生桥、事件及取消边界。发现行内代码在某些主题使用装饰强调色对比不足，改用 accent-text 文本 token。
- 验证：新增 9 条 DOM 用例；verify 724 项测试、全部守卫、类型与包构建通过，137 页站点构建通过。5 条浏览器专项通过，覆盖两原语明暗、六主题明暗代码及成功态 axe、稳定尺寸、失败/重试、准确写入、键盘焦点、触屏/RTL/强制色彩与跨页取消。桌面错误态、手机像素 RTL 截图已检查。
- 最终 77 条浏览器回归全部通过，129 页 × 两档宽度默认基础巡检 0 问题。保留 content.css 原有 CRLF，仅改一处文本 token；空白检查按该文件的现有行尾约定验证。完成后提交本地检查点，不升版、不推送、不发布。
- 下一项已有源码证据：tag-input 每次删除整体重建所有 chip，没有键盘删除后的焦点归还；移除动作只用 mousedown 防草稿失焦，需验证触屏；max 只在初始化读取，重复 init 也没有真实共享 disposer。继续从源码、文档与真实操作补齐，不能只检查已使用共享 close SVG。
- 尚待：copy 的所有密度/超长自定义插槽与更多嵌套宿主组合、宿主在反馈期间并发改写受管属性的完整矩阵；行内代码语义变体还需专门复核。其余标签、导航、表格/图表、AI 和知识库仍按原目标逐一处理，不将本轮通用运行时验收视为整库完成。

### 用户截图回归：安装命令复制位置

- 用户指出组件文档安装区复制按钮落到左下方。真实 Chromium 复现：按钮 position 为 relative，但仍继承旧站点 top/right 与 translateY；该回归来自复制组件新增反馈定位与旧安装区绝对定位约定冲突。此前默认页巡检没有测按钮相对命令的位置，绿色结果不足以发现它。
- 删除站点对所有 .icen-copy-btn--icon 的无作用域旧样式；安装区采用 minmax(0,1fr) + auto 两列网格，命令与按钮共享居中行，长命令只在自身滚动。失败提示独占下一行。RTL 按逻辑顺序镜像，触屏保持 44px。
- PmInstall 的终端与复制改用共享 20px SVG，空闲动作遵守上下文 hover/focus 与触屏规则；pre 增加命名键盘入口。首页 Base 显式引入 copy.css，避免依赖文档布局带来的样式。
- 验证：137 页构建通过；新增 5 条安装区浏览器回归，覆盖首页样式、四个管理器 × 两原语 × 明暗 × 1440/390 宽度、等待/成功/失败、常规代码块图标中心与手机 RTL。与原复制、代码块回归合计 18 条全部通过。已检查修正后的首页截图。
- 标签输入的重设计仍在工作区进行：9 条定向 DOM 用例通过，文档、视觉与完整状态矩阵尚未完成；不与本次截图修复一并视为已完成。

### 用户新规则：不带勾号的选中表面与无箭头触发器

- 用户明确要求所有选择组件去掉选中 ✓，下拉类入口去掉上下箭头，并避免用「已选」文字替换。规则写入 AGENTS.md，作为后续组件统一约束；完成/成功状态的语义图标与选择状态分别处理。
- material.css 提供共用的选中表面：低饱和底色、内描边与原有语义状态，不额外占图标槽。覆盖主题/原语/明暗选项、select、多级/树选择、菜单 checkbox/radio、AI 模型选择和知识库恢复范围菜单；强制色彩使用 double outline 保留非颜色辨识。
- SSR 与 DOM 的主题切换都不再生成箭头和 check 节点。select 清理旧触发箭头，cascader/tree-select 不再创建触发箭头；模型选择不再补 chevron、选项不再生成 check，菜单保留 aria-checked 和真实节点但移除旧 check 槽。文档里的下拉/筛选入口及 select 标记同步移除箭头。
- 清除按钮移到实际末端动作槽，单选与多选内容按真实动作宽度留白；触屏不再为旧箭头多预留一段空隙。既有键盘开合、焦点、清除与门户生命周期继续验证。
- 自定义复选框、树内三态复选框使用实心几何内核，半选是 CSS 短横；表格、表单和知识库清洗项的原生 checkbox 用 appearance:none 呈现同一形态，仍保留 checked、indeterminate、原生提交和键盘行为。知识库 chunk 开关继续使用已有滑块形态。
- 验证：verify 733 项测试通过（包含尚在开发的标签输入 9 项用例）、类型/守卫/包构建通过；站点 137 页构建通过。新增 5 条浏览器专项通过，覆盖六主题明暗面板 axe、两原语明暗选择器、无旧 glyph 槽、菜单与模型 ARIA、原生与自定义复选状态、手机 RTL 与 forced-colors；已检查主题面板截图。原菜单 SVG 断言改为无 check 槽且语义保留，RTL 静态断言改验实际末端动作的逻辑定位。
- 最终 87 条浏览器回归全部通过，含旧选择器/菜单/外观切换键盘与清除行为；129 页 × 两档宽度默认基础巡检 0 问题。已复查含顶部触发器的主题面板截图，箭头与选中 check 均已去掉。修改形成独立本地检查点，不升版、不推送。
- 标签输入的文档与完整视觉验收仍待接续，未因本轮选择规范修改而标记完成；其余组件的全面交互精修目标同样保留。

### 第十四轮：标签编辑的稳定节点、诚实草稿与原生表单

- 标签编辑不再整体重建 chip：增删保留未动节点身份与监听，键盘删除后焦点归还相邻动作或输入框，Escape 回到字段。
- 拒绝原因诚实可见：重复/超上限的草稿保留在字段中，相邻 role=status 说明原因；到达上限本身不再显示警告边框（is-max 仅是容量态）。
- 粘贴支持逗号/中文逗号/换行分隔；IME 组合与 keyCode 229 不提交不删除；触屏移除动作 44px 且不吞草稿。
- 原生表单契约：命名字段以重复表单项提交（草稿不进表单），form.reset 恢复初始标签并遵守取消重置；容器跨父移动会重绑表单归属与禁用祖先。
- 生命周期：createTagInput 显式句柄 + initTagInput 委托幂等 disposer；动态 data-icen-tags 支持 CSV 或 JSON 数组，setValue 可静默，update 支持只读/禁用/上限热更。
- 文档换真实示例：作品主题表单（提交/重置/结果反馈）、紧凑/大两档、只读切换编辑、禁用归档；示例脚本返回清理函数。
- 顺带修复站点结构债：`.demo-stage` 居中规则改直连子级——嵌套 demo 列的 auto 横向外边距会禁用 flex stretch，超长标签曾把文档撑出横向滚动。
- 验证：11 条 DOM 用例 + 10 条浏览器专项通过（两原语×明暗的编辑/键盘/焦点、六主题 axe、触屏 RTL 44px、forced-colors、长标签截断、换页清理）。提交 53a2bd5。

### 第十五轮：tooltip 入 portal 家族（体系级杜绝裁切）

- 用户副线：代码块悬停提示被 overflow:hidden 裁切。定位到体系漏洞——tooltip 是全库唯一不 portal 的浮层（纯 CSS ::after），z-index 标尺对裁切无解。
- 新增 behaviors/tooltip.ts：initTooltip() 委托增强，气泡 portal 到 body，computePopoverLayout 选侧/翻转/钳制；hover 400ms、focus-visible 立即、触屏不抢点按；Escape/点击/滚动/缩放/移除即关；全局至多一个气泡，可中断进退场从当前位置续接。
- 渐进增强契约：CSS ::after 回退保留给无 JS 场景，JS 接管期间触发器带 data-icen-tooltip-live 抑制回退（绝不双渲染）；气泡 role=tooltip 并合并/还原 aria-describedby；MutationObserver 跟随文案/side 变更与触发器移除。
- popover 引擎修正：left/right 侧翻转阈值改用调用方 minWidth（小气泡不再被默认 220 误判）。code-block SSR 渲染补齐 side=bottom（消除与 DOM 路径漂移）。material.css 像素材质早已认 .icen-tooltip，新气泡天然适配。
- AGENTS.md 浮层 portal 家族收录 tooltip；slugs.mjs 登记 SLUG_INIT，kit/tooltip 一行入口自动带 behavior。
- 顺带清账：首页文段链接补安静下划线（link-in-text-block 旧债）、hero 卡片说明文字对比度达标；a11y 扫描改在 reduced-motion 下进行（入场动画中间帧非稳定态，曾误报）；视觉基线按十五轮累计的合法变更重生成（侧栏新组件/顶栏无箭头/代码块工具栏/安装区/选中表面）。
- 验证：7 条 DOM 用例 + 4 条浏览器专项（代码块气泡完整可见不被裁、键盘即显、Escape/点击不闪、顶缘翻转、多行、reduced-motion 无位移、移动 RTL 不出视口、换页摘除）。全量：verify 742 测试、125 条浏览器回归、129 页×两档巡检 0 问题。提交 22df06c。
- 尚待：tooltip 在所有嵌套滚动容器/阴影宿主中的完整矩阵；CSS 回退的可访问名称会并入 ::after 文案（Chromium 计算规则），增强态下名称干净、描述走 describedby——后续可考虑初始化期即标记全部触发器消除名称状态翻转。

### 第十六轮：轮播的覆盖件语言与完整语义

- 修复真实缺陷：圆点在 accent 色幻灯上隐形（激活态吃主题 accent 与画面撞色）。圆点/箭头统一为覆盖件玻璃语言——亮玻璃 + 1px 分离环，激活实心长 pill 带卡片投影，任何深浅媒质可辨；不再依赖主题色。
- 触屏纪律补齐：箭头 32→44px（pointer: coarse），圆点保持 6px 视觉但挂隐形 44px 命中区；forced-colors 用 Canvas/Highlight 保留状态。
- 键盘 RTL 镜像：ArrowLeft/Right 按视觉方向（此前只镜像了图标）。
- 读屏语义：容器 aria-roledescription（作者声明优先）、slide 逐个 role=group + 序号标签、隐藏 role=status 行通报「第 i / n 张」；新增可选 .icen-carousel-index 槽位自动同步「i / n」。销毁摘除全部自有节点与属性，可重入。
- 文档示例升级为有标题/副题的内容页 + 索引槽 + 共享 SVG chevron（去掉手写 24px 内联）。
- 验证：4 条新 DOM 用例（RTL 键位/状态行/索引槽/语义还原重入）+ 既有 swipe 4 条；3 条浏览器专项（双原语×明暗圆点可读性+axe、RTL 键盘与索引/状态同源、触屏 44px 与 reduced-motion/换页销毁）；全量 verify 746 测试、126+1 条浏览器回归（menu-polish 一条为并行抖动，孤立复查通过）、129 页×两档巡检 0 问题。

### 第十七轮：浮层（popover）声明式接入与可中断退场

- 补上缺失的接入层：initPopover() 委托 `data-icen-popover-target` 触发器（CSS 头注释承诺已久但从未实现）——点击开合、面板内关闭钮（挂在 panel 自身，portal 后委托照样生效）、aria-haspopup/expanded/controls 同步、[data-icen-autofocus] 初始焦点、作用域幂等 disposer。
- closePopover 改为两段：焦点与 onClose 立即结算 → 视觉淡出（transition，可中断）→ finalize 还原门户；退场中重开复用原 OpenState 从当前位置续接，不重复插占位。closePopover(panel, { immediate }) 供卸载/销毁路径（换页不把面板留在 body）；theme-switcher destroy 与 initPopover dispose 走 immediate。
- 面板内 onClose 移除节点的既有模式兼容（onClose 先于 isConnected 判定执行）；嵌套场景 Escape 仍逐层（dialog-focus 专项更新到两阶段契约：焦点同步归还 + hidden 落定后还原）。
- 进场动效收敛到菜单同配方（scale(.985)±3px），修正 menu.css / base.css 的过时注释；portal 面板退场期不影响次个面板打开（design 专项选择器排除 closing 态）。
- 文档示例改声明式：筛选面板带标题/关闭/输入/取消/应用全插槽，应用回执 toast 含真实关键词；popover 入 SLUG_INIT（kit 一行入口带 initPopover）。
- 验证：5 条新 DOM 用例（委托开合/关闭钮/退场重入幂等/dispose 结算/立即与动画两路）+ 既有 dialog-focus/theme-switcher 适配后全过；3 条浏览器专项（声明式全流程 + 焦点归还 + 快速重开唯一性、双原语×明暗 axe、移动 RTL 视口钳制与换页清理）。全量：verify 751 测试、130 条浏览器回归、129 页×两档巡检 0 问题。

### 第十八轮：命令面板的 combobox 语义、选中表面与可中断淡出

- 语义补全：输入框成为真 combobox（role + aria-expanded + aria-controls 指向 listbox 化的结果区），条目自动获得稳定 id 与 role=option，activedescendant 随光标同步，aria-selected 镜像当前候选；新增 Home/End 跳首尾（↑↓ 回卷不变）。
- 选中候选改用共享选中表面（accent 微底 + 内描边），不再把文字刷成 accent 深色；图标着色保留。forced-colors 下 double outline 保底。
- 关闭两段式：焦点/滚动锁/事件立即结算，backdrop 淡出落定后才 hidden；淡出中重开从当前位置续接；`closeCommandPalette(id, { immediate })` 供销毁/换页；未接管的强制隐藏语义保留。
- 进场收敛（-6px / .985 / fast），exit 与 popover/menu 同语言；i18n 无关（无新文案）。
- 图标纪律：新增共享 home / settings（滑杆）两枚 20px 原创几何，演示面板的 24px 内联 SVG 全部迁到共享图标。
- 顺带清两颗定时炸弹：date-picker 的 .is-today 文字从 accent（4.06:1）改 accent-text（此前只在「今天=被点那天」时偶然通过 axe）；图表页视觉基线冻结时钟到基线日（贡献日历每天位移曾让基线隔夜即腐）。
- 验证：5 条新 DOM 用例（combobox 接线/activedescendant/Home/End 回卷/退场续接/immediate 与销毁释放滚动锁）+ 4 条浏览器专项（演示面板全流程、⌘K 落全站搜索面板、双原语×明暗 axe、软退出焦点归还、移动视口与外点）。全量：verify 756 测试、134 条浏览器回归、129 页×两档巡检 0 问题。

### 第十九轮：警示的隐式关闭与示例图标同源

- alert 关闭动作改为隐式：桌面静止时 opacity 0 安静待命（占位不塌），悬停/聚焦警示条或焦点落钮即现身；触屏常显并挂隐形 44px 命中区（inline 变体 -14px 补足）。示例的关闭移除带柔和退幕（160ms 淡出+轻位移，reduced-motion 立即），脚本可卸载。
- 示例图标同源：components.ts 的 13 个手写 24px 常量（svgX/svgEye/svgEyeOff/svgSearch/svgPlus/svgDown/svgUp/starSvg/chevronSvg/accChevron/infoSvg/checkSvg/warnSvg/xSvg/inboxSvg）全部改为共享 iconHTML/iconPath 重定义——调用点零改动，一次迁移约 30 处示例。共享图标集新增 star / eye / eye-off / inbox（20px 原创几何）。
- 守卫副线：CRLF 行尾曾让 css-discipline 的裸圆角放行规则失效（原因注释在上一行才认）；feedback.css spinner bars 的登记注释归位到行尾，全库文件维持 LF。
- 验证：3 条浏览器专项（隐式显隐与布局稳定、双模式 axe + 20px 几何、触屏 RTL 44px 与零横向溢出）全过；verify 756 测试、137 条浏览器回归、129 页×两档巡检 0 问题。
- 尚待：编辑器域图标族（bold/italic/underline/align-* 等，toolbar 示例在用 24px 手写件）需专门设计一批；其余约 22 处手写 SVG 散在 kb/ai 示例与首页（index.astro 自带常量）；alert 的 banner/inline 变体与 forced-colors 矩阵未全覆盖，alert/result 暂不勾选。

### 下一批待处理（保留完整目标）

- 选择器尚需完整触屏、forced-colors、跨页卸载与每种状态的视觉验收；基础键盘/搜索/动态数据/销毁与滚动专项已完成。
- Date picker / cascader / tree select / autocomplete / mentions：全部尺寸、搜索/空/加载/错误/禁用状态，完整键盘与两轴视觉矩阵。
- dropdown / context-menu / popover / modal / command-palette / notification：开关动效、焦点、触屏与所有文档示例。
- 标签、工具条、导航、分页、表格/图表、AI 与知识库逐一复核。大量原有 SVG 的 close/check/chevron 仍可进一步收敛到共享几何；不能把已迁移字符图标等同于完整图标审美验收。
- 文档 ClientRouter 下各 behavior/create 句柄的卸载和重入，以及真实 native 表单绑定的系统性巡检。
