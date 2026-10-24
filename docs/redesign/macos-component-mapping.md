# ICEN UI · 组件功能参考与第二轮映射

> 范围：`scripts/slugs.mjs` 的 122 个 installable slug，加 7 个纯文档条目，共 129 行。
> 顺序采用当前 Registry 家族；表格独立成族，图谱与嵌入地图归入图表族。最后一列是第二轮实现/场景要求，不是完成声明。
> 功能参考用于判断任务、解剖和交互，不是截图复刻或视觉验收证据。没有直接对应物的 AI、KB、图表组件使用协议与系统设计依据，不虚构原生控件。

## 共同基线

- 几何只以 `macos-token-architecture.md` 为准：普通控件 normal sm/md/lg = 28/32/40px，compact = 24/28/36px，comfortable = 34/38/46px；粗指针目标至少 44px。组件特例不反推成全局阶梯。
- 圆角角色为控件 6px、content 8px、panel/floating 12px、modal 16px；modern 标准表面不透明、无 backdrop blur。局部旧固定值、模糊或负字距是迁移对象，不是设计依据。
- hover/pressed/selected 分别为中性 4%、中性 8%、accent 10%；键盘当前项与持久选中分离，checked 选项保留末端 glyph。disabled opacity 为 `.48`，press 不改变布局。
- 每行都要求可组合 slot/API、稳定 key/几何和完整场景。涉及异步时明确取消、乱序与销毁；涉及浮层时明确 owner、焦点与 portal 回收；涉及 AI/KB 时优先接真实模型、工具与证据，而非只换皮。
- “129 行齐全”只表示文档覆盖，不表示整个 Registry 已完成第二轮重构或通过测试/视觉评审。

### 基础（11）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `icon` | 界面图标 | 系统符号的光学网格；动作、状态与方向共用一套图形语言 | 统一 createIcon、SSR 与 CSS mask 的路径源；在按钮、菜单、AI/KB 行中验证尺寸槽、注册图标、RTL 镜像和可访问名称，不让 glyph 代替命中区。 |
| `theme-switcher` | 外观切换 | Settings › Appearance；配色、原语、明暗是独立设置轴 | inline 与 portal 共用真实主题状态；用可编辑 inspector 覆盖六套配色、四种原语、明暗和密度，保持品牌身份、选择 glyph、焦点归还及 portal 上下文。 |
| `btn` | 按钮 | Push button / SwiftUI Button；主要、次要、危险动作层级 | 保留 leading/label/trailing 槽与 sm/md/lg token；以真实保存任务展示 busy、失败、禁用和重试，加载时保留原文占位，press 不位移。 |
| `panel` | 可折叠面板 | Inspector / 设置分组；摘要与详情渐进披露 | 组合 head/body/actions，统一 init 与 setPanelExpanded 状态；做可编辑检查器，验证嵌套密度、键盘开合、动态内容和展开状态保持。 |
| `pill` | 状态 pill | 状态标签与简短分类；非动作型语义标识 | 只承载短状态，长文案可换行或截断并保留完整名称；在真实任务状态中检查语义文本、forced-colors 与不依赖颜色的表达。 |
| `tag` | 标签 | Finder 标签 / Mail token；可移除分类实体 | 区分只读与可移除形态，移除槽使用 24/44px affix；用长标签、批量编辑和键盘删除验证稳定布局、焦点落点及空态。 |
| `tabs` | 标签页 | Tab view；同级视图切换而非层级导航 | 保持 tab/panel 关联、roving focus 与 aria 状态；用真实视图切换、动态增删 tab 和溢出场景验证当前项、焦点及面板滚动不串。 |
| `stat` | 指标 | Activity Monitor 读数；值、单位、趋势与时间段组成指标 | 数字区使用 tabular numerals，趋势同时给文本方向；以真实数据更新验证值槽稳定、空/错误状态和 accessible summary，不给正文套数字字体。 |
| `toast` | 轻提示 | 应用内短暂反馈；可撤销且不打断当前任务 | modern 使用实面；覆盖连续多条、hover/focus 暂停、撤销动作、销毁计时器和 reduced-motion，错误不能只自动消失而无后续入口。 |
| `toolbar` | 工具条 | Toolbar；分组、分隔、弹性空间和溢出动作容器 | 使用 toolbar/control 角色而非固定窗口栏高度；组合搜索、选择、分段与菜单，验证换行/溢出、密集表格和 AI 工具条中的稳定槽位。 |
| `split-pane` | 分栏 | Split view；相邻工作区共享可用空间 | 指针与键盘共用尺寸状态并暴露 aria；在 AI/KB 工作台验证最小/最大约束、滚动归属、窄屏降级、销毁监听及刷新后的布局恢复。 |

### 表单（14）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `form` | 表单布局 | 设置表单；label、control、hint、error、actions 的纵向关系 | 用可组合字段与操作槽接真实提交；覆盖服务端错误、加载、草稿保留、水平/网格/inline 布局和重置，禁止只在文档里模拟成功。 |
| `input` | 输入框 | Text field；值编辑与 leading/trailing/affix 组合 | 统一 control 高度和字段内距；验证清除、密码显隐、计数、IME、长值、错误与 coarse 目标，所有附加操作有独立槽且不挤压文本。 |
| `select` | 选择器 | Pop-up button + listbox；值提交与当前导航分离 | 保持 clear 与 chevron 共存、chips 与 trigger 同层；覆盖单/多选、搜索、富选项、键盘、清除前后和 portal owner，持久选中保留 trailing check。 |
| `slider` | 滑块 | 连续数值输入；轨道、thumb、值输出组成同一控制 | 不对 focus 做放大；用真实检索阈值或参数场景验证键盘、双端、粗指针、边界值、禁用和 reduced-motion，值变化不造成布局跳动。 |
| `tag-input` | 多值输入 | Mail 收件人 token；文本输入与实体 chip 共存 | 通过 createTagInput 统一值与 DOM；覆盖粘贴、去重、非法项、Backspace、chip 移除、长列表和提交，焦点与输入草稿在更新后保留。 |
| `switch` | 开关与选择 | Toggle、checkbox、radio 是不同语义；原生表单与 button 模式分开 | 原生 checkbox 保持 appearance 和 mixed，button checkbox 用 check mask；用真实设置验证 accent-strong、键盘、44px 命中区和不变形的视觉几何。 |
| `segmented` | 分段与复合输入 | Segmented control；同族还含 toggle、stepper、OTP，不能混用语义 | 选中段保持中性表面；分别演示 radiogroup 键盘、stepper 边界、OTP 粘贴/IME，明确各 API 和 slot，不以一个 active class 代替全部状态。 |
| `upload` | 上传 | 文件拖放区 + 文件清单；File 对象、传输和结果是不同状态 | 选择、粘贴、拖放进入同一文件状态；接可取消上传适配，展示进度、失败、重试、移除和重复文件，未完成前不得伪报可下载地址。 |
| `date-picker` | 日期选择 | Date picker + calendar grid；触发值与日历导航分离 | 保留 grid 键盘、min/max、week-start、today/clear 与 RTL；在真实约束场景中检查 portal、月末/闰日、禁用日期、粗指针和焦点恢复。 |
| `form-validate` | 表单校验 | 内联校验与可执行 schema；错误归属于字段和提交动作 | 不支持的规则明确列出；接同步/异步校验并取消旧结果，覆盖错误摘要、焦点定位、保留输入、重试与成功，不用全局 toast 替代字段错误。 |
| `cascader` | 级联选择 | Column browser；层级路径与可搜索完整路径 | 删除 clear 时隐藏 chevron 的旧规则，迁移到共享 trailing/clear slot；覆盖多级、搜索、键盘左右、RTL、长路径和 PanelSizing，clear 与 disclosure 同时可用。 |
| `tree-select` | 树选择 | Outline/tree + popup；层级展开、单选、多选与 mixed 是不同状态 | 同样恢复 clear 与 disclosure 共存并统一槽位；用真实三态树验证 chips、叶子占位、键盘方向、RTL、搜索和移除，持久 checked 不只靠行底色。 |
| `mentions` | 提及输入 | 富文本原子实体 + combobox；实体对象而非文本猜测 | 复用可取消 suggestion controller；以乱序 source、错误重试、IME 和自定义实体验证 caret、原子删除、完整对象返回值、destroy 恢复 textarea。 |
| `autocomplete` | 自动补全 | Single-line combobox；异步建议、提交值和自由文本有明确边界 | source 必须消费 AbortSignal，旧 query 不得覆盖新输入；完整演示 loading/empty/error/retry、strict/freeSolo、键盘和 destroy，状态节点不作 option。 |

### 浮层（6）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `modal` | 对话框与 sheet | Modal dialog / edge sheet；强聚焦决策与焦点边界 | modern 实面、modal 16px、dialog 2px/.985、sheet 12px；用真实确认/表单任务验证 trap、Escape、滚动锁、异步提交、嵌套浮层和焦点还原。 |
| `dropdown` | 下拉菜单 | Menu；动作、勾选值、快捷键和危险项 | 保持 2px 无缩放入场与 checked glyph；通过 claimMenuFocus 管理嵌套 owner，演示真实动作、键盘当前项、持久选中、禁用与连续开关。 |
| `context-menu` | 上下文菜单 | 指向当前对象的 menu；虚拟锚点与视口边界 | 不拦截无关系统快捷键；在表格/图谱中接真实对象动作，覆盖危险确认、边缘定位、键盘、滚动、卸载和重复打开的所有权。 |
| `popover` | 锚定浮层 | Anchored inspector；header/body/footer 可组合且不打断主任务 | 保持 6px/.99、实面和 PanelSizing；做可编辑 inspector，覆盖四向翻侧、异步内容、内部滚动、嵌套 owner、关闭重开及焦点归还。 |
| `tooltip` | 提示 | 补充说明而非交互面板；短暂、可关闭、不可承载必需操作 | modern 使用不透明面；验证延迟、Escape、长文本、边缘定位、touch 替代与 reduced-motion，不把表单错误或核心证据只放在 tooltip。 |
| `command-palette` | 命令面板 | Command launcher；combobox、命令注册和真实执行 | scrim 与面板不模糊，dialog 类入场统一到 2px/.985；命令走可组合注册/过滤 API，键盘当前项用中性反馈，演示真实执行、空/错误、可选快捷键、focus trap 和异步反馈。 |

### 数据展示（15）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `card` | 卡片 | 内容分组；media/head/body/foot/action 的组合容器 | 统一 surface 角色并移除局部负标题字距；modern glass 变体也落回实面，验证可选槽、交互子元素、长内容和真实媒体，不让整卡点击与内部动作冲突。 |
| `empty` | 空状态 | Blank slate；解释缺席原因并给出下一步 | 区分无数据、无匹配、无权限与加载失败；动作必须接真实恢复流程，覆盖插图/标题/说明/action 槽和长文案，不用空态掩盖异步错误。 |
| `avatar` | 头像 | Contacts 身份标识；图像、首字母与状态属于不同槽 | 固定几何避免图片加载跳动；以中文/多字姓名、图片失败、组列表和加载态验证 alt/label、回退与状态文本，不只靠头像颜色区分人。 |
| `media-card` | 媒体卡 | Photos / Quick Look 网格项；媒体预览与元信息/操作组合 | modern 覆盖层不使用模糊；验证比例、媒体失败、键盘可达操作和非 hover 常显路径，操作槽在图片加载与标题变化时保持稳定。 |
| `rating` | 评分 | 星级/等级输入；可读值与可编辑值需要等价语义 | 用真实反馈表单验证键盘、半值策略（若支持）、只读、表单重置和提交错误；提供数值 accessible name，不只以填充颜色表达。 |
| `kbd` | 键盘提示 | 菜单快捷键；输入提示是文本语义而非动作本身 | 组合键与单个键保持紧凑基线；在命令面板和帮助中验证本地化、不同键盘说明和长组合，不因为展示 kbd 就注册全局拦截。 |
| `list` | 列表 | Source list；leading/content/trailing 的稳定行解剖 | 用稳定 key 更新真实集合，区分键盘当前和持久 selected；覆盖长标题、次行、空态、动态插入与行内动作，行高由共享角色而非截图值决定。 |
| `accordion` | 折叠面板 | Disclosure group；摘要控制详情显隐 | 保持 aria-expanded、hidden/until-found 与 grid 动效一致；以动态设置内容验证 single/multiple、焦点、展开状态、reduced-motion 和重挂载。 |
| `timeline` | 时间线 | 事件序列；时间、标题、描述与扩展内容组成一条记录 | 使用真实时间与稳定事件 ID；流式追加不重建历史，验证交替布局、长描述、extra 槽、时区/格式与末节点连接线。 |
| `desc` | 描述列表 | Get Info 字段表；definition term 与 description 的语义关系 | 保留 dt/dd 与响应式列；在真实元数据检查器中验证长值换行、跨列、复制反馈和空值，不用截断隐藏关键证据。 |
| `tree` | 树形 | Outline view；层级、叶子、展开与当前选择 | 叶子保留 toggle 占位；以懒加载树验证异步子节点、错误重试、键盘方向/RTL、稳定 key 和当前焦点，展开状态不因数据刷新丢失。 |
| `carousel` | 轮播 | 媒体浏览器；当前帧、前后导航和位置状态 | 使用真实媒体与可暂停自动播放（若启用）；验证键盘、触摸、加载失败、销毁计时器、固定媒体区和 reduced-motion，不让焦点随自动切换被抢走。 |
| `badge` | 徽标 | 计数与状态标记；依附宿主而非独立操作 | 用实时计数更新验证稳定占位、溢出策略和 accessible label；状态同时给文本/形状，物理角定位不随 RTL 错改。 |
| `scroll-area` | 滚动容器 | Scroll view；一个明确 scrollport 与内容尺寸边界 | 统一 gutter 与键盘滚动，避免双滚动所有权；在宽表、长对话和浮层内验证水平/垂直滚动、焦点显露和卸载，不用 fade 遮住操作。 |
| `code-block` | 代码块 | 源码阅读器；标题、gutter、代码与工具动作分区 | 代码始终走安全文本/高亮路径；以真实大文件验证复制、下载、折叠、diff、异步高亮失败和稳定高度，工具 tooltip 回收且不遮挡代码。 |

### 表格（2）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `table` | 语义表格 | Table view；原生行列、排序、选择与 sticky 结构 | 迁移到 data-row/surface 角色而非各自 padding 估值；用宽表和真实排序验证 aria-sort、选中行、sticky 不透明面、展开行、键盘与长单元格。 |
| `datatable` | 数据网格 | Data grid / Numbers；列模型、单元格编辑、虚拟化和服务器数据 | createTable 保持列/行 key 与编辑焦点；异步筛选排序分页只接收最新结果，覆盖虚拟滚动、冻结列、菜单 owner、空/错误及销毁，并迁移 data-row/toolbar 角色。 |

### 图表（20）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `charts` | 图表总览 | Activity Monitor / Instruments 的数据墨水原则；ChartSpec 是统一数据接口 | 用同一真实数据集组合 renderChart、update/on/append/destroy、图例、tooltip 与 a11y table；说明 graph/map 的专用句柄边界，不以静态 SVG 代表完整能力。 |
| `chart-line` | 折线图 | CPU/网络历史；时间或有序序列的趋势与异常 | 以真实多系列数据演示 downsample、zoom、marks、append、loading 和键盘/表格替代；更新保留交互状态，不虚构缺失点或静默换序。 |
| `chart-bar` | 柱状图 | 类目比较；vbar/hbar 共享类目语义但布局不同 | 覆盖分组/堆叠、长标签、负值或零值（按实际支持）、zoom/marks 与可访问表；明确 DOM 图型导出限制，不承诺所有图型同一光栅路径。 |
| `chart-pie` | 饼图/环形 | 组成占比；segments、图例和总计共同解释部分与整体 | 用真实占比和零总量场景验证小分段、图例切换、中心值与数据表；标签和百分比同源，不用视觉面积掩盖精度限制。 |
| `chart-radar` | 雷达图 | 多维 profile；只在轴口径可比较时使用 | 以少量同量纲指标验证刻度、长轴标签、系列开关和键盘替代；提供数值表与空值策略，不以大填充面积制造虚假优劣。 |
| `chart-heatmap` | 热力图 | 矩阵密度与强度图；格子、图例和提示共同编码 | 使用真实稀疏矩阵验证零/空值、长标签、键盘数据替代和色阶说明；forced-colors 下保留文本或边界，不只靠色阶。 |
| `chart-area` | 面积图 | 带宽/累计趋势；顶线和面积共同表达序列 | 明确基线、单位和是否堆叠；以真实流式序列验证 downsample、zoom、append、空点和 resize，面积透明度不得遮住关键差异。 |
| `chart-stack` | 堆叠条 | 组成与总量；分段值、总计和图例必须同源 | 区分绝对值与占比，覆盖段开关、零段、长图例和总计；不以视觉堆叠暗示不可加总的指标，提供可访问数值表。 |
| `chart-gauge` | 仪表盘 | 单值进度/容量读数；当前值必须依附定义域 | 以真实配额验证 min/max、阈值文本、超限和实时更新；accessible name 包含值与范围，不能只靠弧长或颜色判断状态。 |
| `chart-sparkline` | 迷你趋势 | 行内 KPI 趋势；牺牲轴细节换取紧凑上下文 | 在表格/指标中验证稳定高度、单点/空数据、更新和 tooltip；提供摘要或数据表，不让无轴图形成为唯一数值来源。 |
| `chart-scatter` | 散点/气泡 | Instruments 相关性视图；x/y/size 与异常点 | 用真实相关数据验证 outlier、同点重叠、downsample、tooltip 和键盘/表格替代；不要宣称支持仅 line/area/vbar 的 zoom 行为。 |
| `chart-calendar` | 贡献日历 | 日期密度；周/月标签与真实日期共同定位 | 以跨月/跨年时区数据验证真实日期、空白日、月份标签和键盘详情；不把格数写死成所有数据都适用的截图网格。 |
| `chart-graph` | 知识图谱 | GraphRAG 实体关系；确定性力导向布局与 datum 事件 | 保持同数据同布局，演示拖拽、簇过滤、节点到证据 inspector、更新/销毁和大型图降级；提供实体列表替代，不把视觉布局当证据本身。 |
| `chart-map` | 嵌入地图 | UMAP/t-SNE 预投影的 2D 散点；不是地理地图，也不由组件计算投影 | 用真实预投影点演示簇过滤与点选 chunk/证据，保留 datum.meta 边界；明确无 lasso 时不伪实现，受限点不得把原文带入 DOM。 |
| `charts-downsample` | 降采样（纯文档） | LTTB 视觉保形；渲染视图可抽样，源 spec 保持全量 | 只覆盖 line/area/scatter，展示 N→M 提示、端点/极值和阈值边界；用同一数据对比抽样前后及 zoom/append 联动，禁止静默丢数据。 |
| `charts-zoom` | 缩放/刷选（纯文档） | Instruments 区间检查；像素选区映射为含端点的类目索引 | 覆盖 x/brush、点击阈值、重置、双击、update 保持和 append 跟尾；仅演示支持的 line/area/vbar，tooltip、点击与图例仍需工作。 |
| `charts-marks` | 标记线/点（纯文档） | 阈值与事件注释；参考线、标记点和标签构成数据解释层 | 以真实告警阈值覆盖 axis/系列/无效项 warn、标签夹取和数据表；仅在支持的图型展示，标记不能遮住交互或冒充新数据。 |
| `charts-append` | 流式追加（纯文档） | 实时监控尾部窗口；append、淘汰、缩放和抽样共享当前 spec | 覆盖多系列、burst、maxPoints、zoom 与 downsample，明确窗口不是完整历史；演示停止/销毁后定时器不再写入，且更新不重建事件委托。 |
| `charts-todataurl` | 导出 PNG（纯文档） | SVG 光栅化；异步缓存与不支持的 DOM 图型要诚实 | 演示首次 undefined 后重取、scale 缓存、真实下载和失败提示；纯 DOM/无 canvas 分支不得生成假文件，导出内容应与当前视图一致。 |
| `charts-loading` | 加载态（纯文档） | 数据尚未就绪的骨架；loading 优先于 empty 且不做几何计算 | 固定外框并串联 slow request → loaded/empty/error；覆盖 update 切换、取消旧请求、reduced-motion 静态呈现，骨架不能无限掩盖失败。 |

### 反馈（7）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `alert` | 内联警示 | Inline banner；语义图标、文本与可选动作 | 按紧迫度使用 status/alert，保留内容/动作/关闭槽；用真实失败与恢复验证错误文本、重试、长文案和焦点，不只用色边或全局提示。 |
| `result` | 结果页 | 任务终态；结果、解释与后续动作组成完成页 | 让成功/失败来自真实工作流；提供可用下一步、错误明细与重试，覆盖 extra 列表和长描述，不把静态成功页当作流程完成。 |
| `progress` | 进度 | Progress indicator；确定值、未知值与标签共享语义 | 同步 progressbar aria 与可见文本；接真实上传/任务进度，覆盖 indeterminate、取消、完成、失败和 reduced-motion，宽度更新不推布局。 |
| `spinner` | 加载指示 | 短等待指示；动画只是辅助，aria-busy 与文案才是状态 | 用真实等待与超时演示尺寸、文本、错误退出和静态降级；全屏 overlay 需明确 owner 和焦点策略，不能无条件阻断应用。 |
| `skeleton` | 骨架屏 | 内容结构的临时占位；形状应预测真实内容几何 | 按真实卡片/表格/图表预留空间，串联 loading/loaded/empty/error；reduced-motion 停止 shimmer，失败时有出口而非永久骨架。 |
| `copy` | 复制动作 | 工具栏复制；动作结果需要短反馈且保留原布局 | 接真实 Clipboard 路径和失败回退，覆盖权限/安全上下文失败、重试、成功 glyph 与文案；按钮尺寸和相邻内容在状态切换时稳定。 |
| `notification` | 通知中心 | 持久通知、分组和已读/归档；比 toast 更需要所有权 | modern 实面，使用 center/update/push 等真实状态；覆盖分组计数、暂停、操作、归档、销毁与多实例隔离，不让旧定时器改新通知。 |

### 导航（7）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `nav` | 顶栏 | 全局 chrome；left/center/right/bottom 组成导航壳 | modern 各滚动状态均用实面而非玻璃；组合真实路由与搜索，验证当前项、响应式换行、滚动反应、键盘和 portal 菜单所有权。 |
| `sidebar` | 侧栏 | Finder/Settings source list；分组导航与当前位置 | 选中与键盘焦点分离，折叠组同步 aria；覆盖 mini 模式可访问名称、搜索过滤、长标签、移动呈现与真实路由，不用左条和底色重复抢强调。 |
| `breadcrumb` | 面包屑 | 路径栏；层级位置与可回溯导航 | 当前页使用 aria-current，折叠中段通过可访问菜单取回；以深层真实路径验证动态更新、长名称、RTL 和键盘，不只视觉截断。 |
| `pagination` | 分页 | 长列表页脚；页码、页面大小与数据请求是一体状态 | 异步换页只提交最新请求并保留可用旧数据/明确加载态；覆盖边界、省略、page-size、空/错误、未知总数与焦点，当前页不只靠颜色。 |
| `steps` | 步骤条 | 多步流程；完成、当前、未开始和失败必须可区分 | 用真实表单流程驱动步骤，不让用户越过未满足校验；覆盖回退、异步提交、失败恢复、移动端与 aria-current，进度不能只是装饰。 |
| `back-top` | 回到顶部 | 长页导航；依附实际 scrollport 的辅助动作 | 在页面与内部滚动容器验证显隐、焦点、键盘和清理；reduced-motion 下即时定位，返回后不丢失原阅读上下文或意外滚动其他容器。 |
| `layout` | 布局工具 | 应用 shell / split workspace；导航、内容、inspector 的区域关系 | 提供可组合区域 slot 与容器查询；用完整 AI/KB 工作台验证窄屏单栏、滚动归属、长内容、resize 和真实路由，不锁死视口高度。 |

### AI 原生（15）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `ai-overview` | AI 总览（纯文档） | AI SDK/MCP/agent loop + inspector；过程、工具、上下文与证据的组合，无单一控件对应 | 建成 scenario-led 工作台方向：真实 model → tool → result → model 回路、KB 证据和可编辑 inspector；明确传输是否模拟，不把静态目录页当交付。 |
| `ai-chat` | AI 会话 | 消息流 + turn controller；滚动跟随、停止、排队和重试属于会话生命周期 | 用 bindComposer/client 或可注入传输跑完整流式任务；稳定消息 key，覆盖上滚暂停、停止、排队、失败续写、迟到 chunk 和真实工具回灌。 |
| `ai-message` | AI 消息 | 标准化 AiContent parts；角色、正文、媒体、meta、actions 的组合 | renderAiMessage/stream 保持节点与正文列稳定；覆盖多模态、安全 URL、部分输出、错误和同答重试，文本追加不重建消息或执行不可信 HTML。 |
| `ai-reasoning` | 推理披露 | Provider reasoning/activity 的渐进披露；不是凭空生成隐藏思维 | 保留流式展开、完成计时和用户接管优先；验证手动展开后不被自动收起、取消/失败、计时器销毁和 reduced-motion，不伪造 provider 未给的推理。 |
| `ai-composer` | AI 输入台 | 连续 textarea + 独立请求快照 + 资源/命令/模型弹层；宿主拥有上传与授权 | 每份 send/queue 快照独立，prepareMessage 可取消；保留草稿/IME/选择，验证附件上传、引用、四类弹层 owner、停止续写和真实模型工具闭环。 |
| `ai-tool-call` | 工具调用 | AiToolCallModel/AiToolArea；结构化输入、审批、执行、结果和输出部件 | update 不替换所属卡片或丢失展开；接真实 register/area.call，覆盖 AbortSignal、progress、审批、超时、错误、结果回模型及迟到完成失效。 |
| `ai-subagent` | 子智能体 | 嵌套任务/活动流；子任务状态归属于父 turn | 递归活动以稳定 ID 更新，父子取消/失败语义一致；用真实子代理演示进度、迟到事件、结果摘要和递归销毁，不把静态嵌套卡当运行证据。 |
| `ai-diff` | 差异审阅 | Source control diff；文件/hunk/行与接受/拒绝决策 | 从真实 unified diff 渲染并保持长文件稳定；accept/reject 必须更新宿主审阅状态，明确尚未应用与已应用，覆盖多文件、错误和重挂载。 |
| `ai-files` | 文件与上下文 chips | 附件/变更文件集合；文件身份、状态和移除属于请求快照 | 复用 AiContent/file 与稳定 affix；覆盖长路径、类型、上传/解析状态、移除后快照同步和失败恢复，不能只留下视觉 chip 而实际仍发送。 |
| `ai-todo` | 任务清单 | Agent plan/todo；共享七态和可选只读/交互模式 | 以稳定任务 ID 更新状态与 activeForm，不整表跳动；连接真实计划工具、composer chip/popover、失败恢复和完成度，交互事件不得伪装后端已保存。 |
| `ai-context` | 上下文检查器 | Inspector；usage/files/MCP/skills/audit 的可组合分区 | inline 与 drawer 共用当前会话数据，明确 overlay/focus owner；覆盖资源增删、事件域隔离、审计更新、关闭销毁与窄屏，不能串用其他会话完成事件。 |
| `ai-usage` | 用量与审计 | Provider usage 归一；下一轮 context 估算与累计 billing 是不同口径 | 只消费本会话结果，未知价格保持未知；验证环/分段/TTFT/成本、popover owner、无上限与错误请求，提供文本等价且不混淆两种总量。 |
| `ai-threads` | 会话列表 | Mailbox/thread navigation；当前会话、分组和归档状态 | 稳定 key 与 active thread，动作菜单由宿主明确拥有；覆盖重命名/归档/切换，旧 turn 在切换时失效，迟到的消息和用量不得写入新会话。 |
| `ai-feedback` | 回答反馈 | 回答级评价与原因；反馈必须绑定具体 answer/trace | 以 answer ID 隔离状态，覆盖赞/踩、原因、提交中、失败重试和持久回显；真实写入宿主追踪后才显示完成，不只显示静态感谢。 |
| `ai-branch` | 回答分支 | 同一回答的版本导航；branch 归属于消息而非全局页码 | 每个回答独立保存分支与当前索引，切换不重建其他分支；用真实重生成验证取消、失败、保留草稿和 count≤1 隐藏，避免重复用户消息。 |

### 知识库（32）

| slug | 组件 | 功能参考 / 系统设计依据 | 第二轮实现 / 场景要求 |
| --- | --- | --- | --- |
| `kb` | 知识库总览 | 证据工作台：ai 描述过程，kb 解释来源/可信度/用法，权限域解释边界 | 共享 kb-core normalize 与七域配方；以摄取→检索→回答→原文→权限的真实数据流组织场景和 inspector，不把 umbrella 安装等同于全场景完成。 |
| `kb-citation` | 行内引用 | 证据角标 + hover 卡；引用编号必须解析到所属回答的白名单来源 | 保留就近 root pool，多个异步回答不得串源；覆盖无效/撤销/弹层 owner，非 readable 原文不得进入 DOM，blur 不能作为安全边界。 |
| `kb-sources` | 来源列表 | Source list；来源身份、使用次数、可信度与访问状态 | 与当前回答共用来源池并接真实打开动作；hidden 整行及标题不渲染，requestable 只显示授权元数据，验证长标题、onlyCited、撤销和布局稳定。 |
| `kb-passage` | 原文定位 | Preview/检查器；citation、文档位置、原文与上下文组成证据链 | open token 与异步取消共同防旧文档覆盖；按 answer 取文并定位，受限时只给无原文占位而非 blurred raw text，覆盖高亮、扩展和焦点归还。 |
| `kb-conflict` | 来源冲突 | 多来源版本对照；冲突是待判断证据，不是自动选定答案 | 用真实矛盾日期/数值连接各来源原文，保留 unresolved 和选择理由；覆盖官方/时效、长内容和异步更新，不把 current 样式误作事实裁决。 |
| `kb-pipeline` | 解析管线 | 文档摄取状态机；阶段、详情、错误和单文档重跑 | 接真实 job 状态与异步更新，稳定步骤节点；覆盖 queued/running/fail/cancel、单文档重试和详情，进度与计数必须来自任务而非计时器演出。 |
| `kb-chunks` | 分段编辑器 | 文档块资产；内容、关键词、位置和 available 状态可编辑 | 业务数据先 normalize，稳定 chunk ID 与草稿；覆盖编辑/新增/删除/搜索、保存失败和权限，受限 chunk 原文不进入 DOM 或隐藏属性。 |
| `kb-segment` | 分段策略 | 策略配置 + 真实切分预览；get/set/refresh 共用同一 config | 用 segmentText 展示真实块与统计，token 估算明确为估算；覆盖 auto/custom/parent-child、locked、非法参数、长文档和配置变更后的刷新。 |
| `kb-connector` | 数据源连接 | 账户/同步设置；enabled、健康、凭证和同步动作是不同维度 | 接真实同步/重授权/计划适配，凭证永不写入 DOM；覆盖 healthy/stale/failing/off、取消与重试，演示适配器须明确模拟而非声称已连接服务。 |
| `kb-metadata` | 元数据 | Get Info + schema 管理；字段定义和绑定值共享类型 | 内置字段只读，编辑走 normalize/validation；覆盖 string/number/time、增删绑定、长值和保存错误，字段变化要反映到真实过滤/检索场景。 |
| `kb-qa` | QA 对 |  curated question/answer 资产；成对编辑、导入和引用 | 覆盖行内编辑、增删、模板导入解析错误和引用链接；稳定行 key 并保留未保存草稿，以实际 QA 检索/命中验证用途而非静态表格。 |
| `kb-retrieval` | 检索调试台 | Search playground；query、身份、参数、候选和分数解释组成一次实验 | onRun 使用可取消且仅最新的控制器；固定身份、默认 pre-filter，覆盖 null score、空/错误、参数快照和安全计数，普通视图不得出现受限命中。 |
| `kb-filter` | 过滤构建器 | 条件树 + DSL；可视化编辑和序列化必须同源 | get/set/serialize 保持一致，无效规则不输出；以真实 pre-filter 查询验证嵌套组、字段类型、键盘编辑和错误，不能只生成看似正确的文本。 |
| `kb-rerank` | 重排对比 | Before/after 排名实验；稳定实体 key 连接两组结果 | 用同一授权集合演示真实 rerank 开关、位移和双分数，null 不画条；普通用户不显示受限排名差，提供模型/参数与结果解释。 |
| `kb-hittest` | 召回测试 | 固定测试集与运行快照；问题、期望命中、结果和统计组成评估 | 覆盖新增/pin/删除、逐题异步执行、失败解释和参数快照，旧运行不得覆盖新运行；null 统计保持未知，并展示可复查的失败案例。 |
| `kb-sql` | SQL 卡片 | 查询控制台；生成 SQL、编辑、错误、修复 diff 与重跑 | 接真实查询适配和取消，编辑/运行状态归属同一版本；覆盖高亮、错误、修复应用、截断与权限范围，未执行不得伪报结果。 |
| `kb-answer` | 问数答案 | Chat-with-Data 组合：正文、证据、澄清、解释、结果、图表和追问 | 统一 answer-scoped citation renderer 与各槽，销毁重建时释放 chart；真实异步查询可取消，导出/截断诚实，受限原文不在 DOM，禁止回退到全局最后来源池。 |
| `kb-clarify` | 澄清反问 | 歧义消解；问题、快捷选项与自由回答都属于当前 turn | 选择/手输后真正修正查询并回显解析结果；旧回答的澄清不得覆盖新 turn，覆盖已答、异步失败和非阻塞输入，不只用静态 chips。 |
| `kb-explain` | 口径解释 | 查询事实与指标词典；解释必须来自实际执行计划或资产 | tables/columns/filters/aggregates/metrics 与本次查询同源；覆盖折叠 aria、有效深链、verified/generated 差异和空事实，禁止编造口径。 |
| `kb-trace` | 调用链追踪 | Span tree / observability；父子、时长、IO 与检索证据共享 span ID | 用真实检索/工具轨迹更新稳定节点，覆盖嵌套折叠、异步完成和错误；guard 文案不含受限计数，IO 不携带未授权原文或秘密。 |
| `kb-review` | 标注队列 | 人工评审工作台；队列、rubric、分配与提交形成完整任务 | 保持队列/任务 key 与未提交评分，覆盖数字键、滑杆、分配、异步提交失败和前进；快捷键有帮助且不拦截文本编辑。 |
| `kb-gap` | 无答案分析 | 零结果/零点击分析；问题、趋势和补救动作组成闭环 | 用真实日志驱动建文档/加同义词并验证结果，普通用户不可由“无答案”推断权限差异；覆盖空数据、未知统计与行动失败，不伪造趋势。 |
| `kb-eval` | 评估对比 | Baseline/candidate 实验；指标 delta、文本 diff 与判级同源 | 选择真实 run 并计算 improvement/regression/tradeoff/tie，null 不归零；覆盖长 diff、指标缺失和运行切换，不预设候选一定更好。 |
| `kb-canvas` | 双栏工作台 | Editor + evidence inspector；chat/doc/diff/version 是可组合挂载区 | setChat/setDoc/addDiff/version 各自保持所有权；覆盖分栏、划词浮层、AI 改写、接受/拒绝、版本和异步取消，形成完整文档任务。 |
| `kb-checkpoint` | 检查点 | 可恢复快照；内容、对话或两者的恢复范围必须明确 | 菜单保留当前 scope check 与 overlay owner；接真实恢复和确认，默认只回滚内容并保留对话，旧异步结果不能污染恢复点，留下审计记录。 |
| `kb-sandbox` | 沙箱应用容器 | MCP Apps iframe + JSON-RPC；隔离、ready、call、timeout 和 destroy | 禁止 allow-same-origin，校验 source/origin；用真实子帧演示异步 resolve、双向调用、超时、重载和销毁，旧响应/加载不得生效，错误可见。 |
| `kb-chain` | 工具链摘要 | Workflow 阶段条；每步摘要与可展开的实际工具调用关联 | 步骤状态来自真实运行且 key 稳定，失败可定位到工具详情；覆盖运行、取消、重试、乱序完成和长链，不用固定进度动画冒充执行。 |
| `kb-acl` | 文档权限面板 | Sharing/ACL 管理；显式 deny、allow 并集、继承、到期和系统项 | 固定身份集并走 evaluateAcl/fail-closed；接真实授予/移除/继承变更与服务端确认，覆盖到期、deny 优先、系统项不可删和危险确认。 |
| `kb-who-can` | 有效权限检查 | Permission helper / view-as；结论和扁平原因链共同解释有效权限 | 只允许固定身份，覆盖组/继承/deny/到期与 now 注入；在授权管理场景展示原因，普通终端不以“未知/无权”差异泄露资源存在性。 |
| `kb-access` | 访问申请流 | Request/approver 双视角状态机；理由、路由、审批、到期和撤销 | requester/approver 共用真实申请状态，覆盖 idle→requested→granted/expiring/expired/revoked、异步失败和倒计时清理，只展示获准的资源元数据。 |
| `kb-audit` | 权限审计 | 安全审计时间线；不可变事件、通道过滤、导出和权限异味 | 真实权限动作生成记录，覆盖过滤、CSV 导出、break-glass 置顶与追加稳定性；敏感日志限授权视图，不伪造审计成功或泄露受限内容。 |
| `kb-visibility` | 可见性对照 | Admin-only 权限教学/审计；比较身份与过滤层会制造侧信道 | 常驻 admin 警示且不得嵌入普通视图；hidden 行及原文不占 DOM，覆盖 pre/post/none 教学、固定身份与安全计数，明确 post-filter 不是安全边界。 |

## 覆盖解释

- 文档行数：129；其中 installable 122、纯文档 7。验证只针对 slug 存在性与唯一性。
- 每行仍含第二轮工作，尤其是复合槽位、异步所有权、真实场景、AI 工具闭环和 KB 答案级证据；不得据此宣称 Registry 已整体重构或验收完成。
