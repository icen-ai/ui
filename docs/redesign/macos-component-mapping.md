# ICEN UI · 组件 → 桌面原生参考映射

> 生成依据：`site/src/lib/components.ts` 的 129 个文档条目 × `docs/contracts/tiers.json` 的分层。
> 目标不是为每个组件找一张 Apple 截图，而是先锁定**功能语义**，再选择参考；没有直接对应物的 AI / KB / 图表组件按系统设计原则组合，不虚构原生控件。
> 证据等级：参考为公开系统界面观察；尺寸与间距以 `macos-design-language.md` 的统一规则为准，浏览器实测后再收敛。

## 选择规则

1. 功能语义是否一致（最重要）。
2. 交互模型是否一致（键盘、焦点、选择、取消）。
3. 组件解剖是否对应（frame / content / slots / footer）。
4. 使用环境是否相近（工具栏、侧栏、内容区、浮层）。
5. 视觉语言是否适合当前主题与原语。
6. Web 可实现性与可访问性是否达标。

### 基础（11）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `icon` | 界面图标 | 系统符号库 / SF Symbols 式光学网格 | 图标是操作语言，不是装饰 | 沿用 20px 原始路径 + 1.6 描边；16/15px 落在控件内，不随字号缩放 |
| `theme-switcher` | 外观切换 | System Settings › Appearance | 一组外观档位 + 实时预览 | 六主题保留品牌色；切换器收敛为分段/菜单 + 中性选中底 |
| `btn` | 按钮 | NSButton push button / SwiftUI Button | 按钮是最高频动作承载体 | 34px 高、6px 角、1px 边、顶部高光；按下变深不位移；primary 用 accent-strong |
| `panel` | 面板 | Xcode Inspector / System Settings 分组面板 | 可折叠信息容器 | 标题行 34px、hairline 分界、内容区不投影；折叠状态同步 aria-expanded |
| `pill` | 徽章 | Finder 标签 / 状态 chip | 轻量状态与分类 | 胶囊只给短标签；11–12px、600 字重、语义色底 12% |
| `tag` | 标签 | Finder 标签 / Mail token | 可移除的分类标记 | 同一胶囊语法；移除槽 24px 命中；只读态去交互 |
| `tabs` | 标签页 | Safari 标签页 / NSTabView | 同级视图切换 | 默认下划线 + 选中文字；cards/segment 变体保留，但统一 13px/32px 行高 |
| `stat` | 指标卡 | Activity Monitor 指标头 | 单值 + 趋势 + 单位 | 13px 标签 / 22px 数值 / 11px 单位；tabular-nums |
| `toast` | 轻提示 | in-app 通知 / 通知中心横幅 | 短暂、可撤销的反馈 | 浮层材质 + 左侧状态图标；从屏幕边缘滑入，自动消失可暂停 |
| `toolbar` | 工具条 | NSToolbar | 窗口级操作条 | 44px chrome、28px 按钮、hairline 下边；搜索/分段/菜单同排对齐 |
| `split-pane` | 分栏拖拽 | NSSplitView | 可拖拽双栏 | 分隔条 1px + 8px 命中区；键盘可调；不改变滚动归属 |

### AI 原生（15）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `ai-overview` | AI 总览 | Notes + Xcode Inspector + Spotlight 组合 | AI 能力总览无单一原生对应 | 以“输入台 → 会话 → 工具 → 上下文”四段式组织；不虚构系统控件 |
| `ai-chat` | AI 会话 | Messages 会话 / Notes 文档流 | 连续对话与消息流 | 消息间距 16px、正文 14px/1.65；工具/推理作为嵌套卡，不抢主对话 |
| `ai-message` | AI 消息 | Mail 正文 / Messages 气泡 | 角色化消息内容 | 角色标签 11px 元数据；正文不套气泡时用左侧细线/底色区分 |
| `ai-reasoning` | AI 推理 | Xcode 控制台折叠 / Activity Monitor 任务详情 | 过程性、可折叠 | 默认折叠；展开逐行 12px mono；运行中脉冲只给状态点 |
| `ai-composer` | AI 输入台 | Notes 编辑区 + Spotlight 输入 | 多模态输入与发送 | 大编辑面 + 底部操作条；焦点在内容而非边框；附件/上下文作为 token |
| `ai-tool-call` | AI 工具调用 | Xcode 任务状态 / Activity Monitor Inspector | 结构化调用与结果 | 卡片头 28px、状态点 + 名称 + 耗时；输入输出用 mono 折叠区 |
| `ai-subagent` | AI 子智能体 | Finder Get Info / Xcode Navigator | 子任务与归属 | 缩进 + 连接线表达层级；状态与父任务同语法 |
| `ai-diff` | AI 差异审阅 | Xcode Source Control diff / FileMerge | 逐行审阅 | 行号双栏、增删底色 12%、等宽 12px；不把 diff 做成营销卡片 |
| `ai-files` | AI 文件标签 | Finder 标签条 / Mail 附件 | 文件与上下文集合 | 横向 token 条；文件名截断、类型图标 15px、移除槽稳定 |
| `ai-todo` | AI 任务清单 | Reminders 清单 | 可勾选任务列表 | 28px 行高、圆形勾选、完成态删除线 + 去权；分组标题 11px |
| `ai-usage` | AI 用量条 | Activity Monitor 能耗/成本读数 | 用量与成本 | tabular-nums；进度环/条只表达比例；超限用 warning/error 语义 |
| `ai-context` | AI 上下文面板 | Xcode Inspector | 上下文与引用清单 | 右侧/抽屉式 inspector；分组 + 计数；空态说明如何添加 |
| `ai-threads` | 会话列表 | Mail 邮箱列表 | 会话列表 | 28–32px 行、标题 13px + 摘要 12px；选中底 accent 12%；未读点 6px |
| `ai-feedback` | 回答反馈 | App Store 评分 / Safari 反馈 | 轻量评价 | 拇指按钮 28px；选中态持久；可选原因以 popover/menu 呈现 |
| `ai-branch` | 分支切换 | Xcode Source Control 分支切换 | 分支/版本切换 | 下拉菜单 + 当前分支勾选；危险切换二次确认 |

### 知识库（32）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `kb` | 知识库总览 | Finder 浏览器 + Inspector + Preview | 证据工作台 | 三栏：来源/结果/证据；域组件共享 kb.css 基座，不各自发明表面 |
| `kb-citation` | 行内引用 | 行内脚注 / 来源徽标 | 可追溯引用 | 上标序号 11px accent；hover/focus 出现来源摘要；点击定位原文 |
| `kb-sources` | 来源列表 | Safari 阅读列表 / Finder 列表 | 来源清单 | 28px 行、域名 12px muted、可信度用徽标而非第六种色 |
| `kb-passage` | 原文定位 | Preview 原文 / Notes 引用块 | 原文片段 | 引用左边 2px accent、正文 13px/1.6；高亮命中用 mark 底 18% |
| `kb-conflict` | 来源冲突 | FileMerge 冲突视图 | 多来源矛盾 | 并列列 + 差异标记；不替用户下结论，保留“未决”状态 |
| `kb-pipeline` | 解析管线 | Xcode Build Pipeline | 阶段流水线 | 节点 24px + 连接线；运行/成功/失败/跳过四态；耗时右对齐 |
| `kb-chunks` | 分段编辑器 | Notes 文本块 / Preview 选择 | 分段查看与编辑 | 块间距 8px、边界 hairline；拖拽手柄 hover 显形 |
| `kb-segment` | 分段策略 | System Settings 列表 + 编辑器 | 分段策略配置 | 左列表右表单；策略变更即时预览 token/字符数 |
| `kb-connector` | 数据源连接 | System Settings › 账户/网络 | 数据源连接 | 44px 行、状态点、连接动作右对齐；密钥字段用密码输入 |
| `kb-metadata` | 元数据 | Finder Get Info | 键值元数据 | 两列 120px label + 值；12px；长值换行不截断 |
| `kb-qa` | QA 对 | Mail 会话 / 问答对 | 成对问答 | 问题 13px 600、回答 13px 400；引用角标与来源联动 |
| `kb-retrieval` | 检索调试台 | Spotlight 结果 / Xcode 搜索 | 检索调试 | 搜索框 34px + 结果列表 + 命中详情；密度 compact 可用 |
| `kb-filter` | 过滤构建器 | Finder 过滤条 | 条件构建器 | 条件行 28px、字段/运算符/值三段；AND/OR 用分段控件 |
| `kb-rerank` | 重排对比 | Activity Monitor 排序列表 | 重排对比 | 两列排名 + 位移箭头；数值 tabular；不堆色块 |
| `kb-hittest` | 召回测试 | Xcode 测试结果 | 召回测试 | 测试集行 + 通过/失败/耗时；失败原因展开为 mono 日志 |
| `kb-sql` | SQL 卡片 | Xcode 查询控制台 / Terminal | SQL 生成与结果 | 代码区 12px mono、结果表 30px 行；复制/运行按钮 28px |
| `kb-answer` | 问数答案 | Notes 回答 + 引用 | 带证据的答案 | 正文 14px/1.65；句末引用上标；底部来源条不抢正文 |
| `kb-clarify` | 澄清反问 | Spotlight/Siri 澄清对话 | 反问与补全 | 问题 + 2–3 个选项按钮；不阻塞用户手输 |
| `kb-explain` | 口径解释 | Dictionary/Glossary popover | 口径解释 | popover 材质、12px 正文、术语 600；锚定选中词 |
| `kb-trace` | 调用链追踪 | Activity Monitor 调用栈 | 调用链 | 缩进树 + 耗时条；关键路径 accent；折叠保留上下文 |
| `kb-review` | 标注队列 | Xcode 评审队列 / Photos Inspector | 标注队列 | 左队列右详情；键盘 J/K 导航可见提示；操作按钮 28px |
| `kb-gap` | 无答案分析 | Console 空日志 / Finder 空文件夹 | 无答案分析 | 空态给原因 + 下一步，不只画图标 |
| `kb-eval` | 评估对比 | Activity Monitor 对比视图 | 评估对比 | 并排指标 + 差值；差值用 +/- 与语义色双编码 |
| `kb-canvas` | 双栏工作台 | Xcode 工作区分栏 | 双栏工作台 | 可拖分栏；左证据右答案；窄屏折叠为单栏 |
| `kb-checkpoint` | 检查点 | Time Machine 恢复点 / Xcode 快照 | 检查点 | 时间线列表 + 当前点；恢复动作危险色 + 二次确认 |
| `kb-sandbox` | 沙箱工具容器 | Xcode 模拟器 / App Sandbox 设置 | 沙箱工具容器 | 容器 chrome 面板 + 工具行；状态与日志分区 |
| `kb-chain` | 工具链条 | Shortcuts 工作流 | 工具链编排 | 步骤卡 28px 头 + 连接箭头；失败步骤就地展开 |
| `kb-acl` | 文档权限面板 | System Settings › 隐私与安全 | 文档权限面板 | 主体/权限/范围三列；受限行打码但保留申请入口 |
| `kb-who-can` | 有效权限检查器 | Finder Get Info › 共享与权限 | 有效权限检查 | 用户搜索 + 结果权限档；未知与无权严格区分 |
| `kb-access` | 访问申请流 | 权限申请 sheet | 访问申请流 | 单字段 + 理由 + 提交；状态与 ACL 结果同源 |
| `kb-audit` | 权限审计时间线 | Console 审计日志 | 权限审计时间线 | 时间 12px mono、动作 13px；不可变事件用左侧时间线 |
| `kb-visibility` | 检索可见性对照器 | Preview 对照 / 可见性 Inspector | 检索可见性对照 | 左右对照同一 query；差异高亮；未知与不可见分开呈现 |

### 表单（14）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `form` | 表单布局 | System Settings 表单分组 | 标签/控件/帮助文本的纵向节奏 | 字段 gap 4px、组 gap 16px；label 12px、hint 11px；水平表单 label 120px 右对齐 |
| `input` | 输入框 | NSTextField | 单行文本输入 | 34px 高、9px 内距、6px 角；focus 外环 + accent 边；placeholder 用 muted |
| `select` | 选择器 | NSPopUpButton | 枚举选择 | 触发器 34px + chevron；菜单 12px 角、28px 行、选中勾选 |
| `slider` | 滑块 | NSSlider | 连续数值 | 4px 轨、18px 白 thumb、hairline 边；focus 轻微放大；双滑块同语法 |
| `tag-input` | 标签输入 | Mail 收件人 token 输入 | 多值输入 | token 胶囊 24px 高；输入区自动增高；删除槽稳定 24px |
| `switch` | 开关与选择 | macOS Toggle / System Settings 开关 | 二态设置 | 38×22 轨道、18px 白 thumb；开态 accent-strong；OFF 轨道 fill-2 |
| `segmented` | 分段选择 | NSSegmentedControl | 少量互斥视图 | 轨道 raised + 3px 内距；选中白面 + hairline + contact 影；行高 28px |
| `upload` | 上传 | Finder 拖放区 | 文件投放 | 虚线边、48px 图标、拖入高亮；文件行 32px + 进度/移除 |
| `date-picker` | 日期选择 | NSDatePicker | 日期选择 | 触发器同输入；日历 30px 格、选中实心、今天 accent 文字 |
| `form-validate` | 表单校验 | System Settings 内联校验 | 错误就地呈现 | 错误 11px + error 边 + aria-live；不弹全局 alert |
| `cascader` | 级联选择 | Finder 分栏视图 | 层级路径选择 | 列宽 160px + 分隔线；选中路径逐级高亮；键盘左右进出 |
| `tree-select` | 树选择 | NSOutlineView 下拉 | 层级多选 | 28px 行、14px 缩进、三态勾选；面板同菜单材质 |
| `mentions` | 提及输入 | Mail token + 建议列表 | 提及与对象插入 | 触发符 + 12px 面板；对象 chip 与 tag 同语法 |
| `autocomplete` | 自动补全 | NSSearchField 建议 / Spotlight | 输入补全 | 输入框 + 浮层列表；命中 mark 高亮；↑↓/Enter/Esc 完整键盘 |

### 数据展示（17）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `card` | 卡片 | Notes 卡片 / System Settings 分组 | 内容分组 | 8px 角、hairline 边、不默认投影；elevated 仅浮起时 |
| `empty` | 空状态 | Finder 空文件夹 | 空态 | 图标 40px + 标题 13px 600 + 说明 12px + 动作按钮 |
| `avatar` | 头像 | Contacts 头像 | 身份标识 | 正圆；尺寸 20/24/32/40；无图时首字母 600 |
| `media-card` | 媒体卡 | Photos 网格项 | 媒体缩略卡 | 媒体面 4:3 / 1:1；标题 13px；hover 才显操作 |
| `rating` | 评分 | App Store 星级 | 评分 | 星 16px；填充 accent-cold/警告色；只读态 aria-label |
| `kbd` | 键盘键 | 菜单快捷键 | 键盘提示 | 11px mono、1px 边、3px 角、底部 1px 阴影；不抢正文 |
| `code-block` | 代码块 | Xcode 源码编辑器 | 代码阅读/复制 | 12px mono、行高 1.55、gutter 弱化；头部 28px、按钮 24px |
| `list` | 列表 | Finder 列表 | 通用列表 | 行 28–32px、hairline 分隔、选中底 12%；不默认斑马纹 |
| `accordion` | 折叠面板 | System Settings 披露组 | 折叠分组 | summary 32px、chevron 旋转；内容区 12px 间距 |
| `timeline` | 时间线 | Console 时间线 | 事件序列 | 左侧 1px 线 + 8px 点；时间 11px mono；事件 13px |
| `desc` | 描述列表 | Finder Get Info 字段表 | 描述列表 | label 120px muted、值 13px；行 28px；长值换行 |
| `tree` | 树形 | NSOutlineView | 层级浏览 | 28px 行、14px 缩进、chevron 12px；选中/勾选同语法 |
| `carousel` | 轮播 | Photos 浏览器 / Quick Look | 媒体轮播 | 媒体面优先；箭头 28px 半透明；索引 11px mono |
| `badge` | 徽标 | Finder 标签 / 通知角标 | 计数与状态 | 11px 600、最小 16px；计数 >99 显示 99+ |
| `scroll-area` | 滚动容器 | NSScrollView | 滚动容器 | 细滚动条 8px；fade 边缘；不嵌套双滚动 |
| `table` | 表格 | NSTableView | 静态表格 | 30px 行、表头 11px 600、hairline；选中行 accent 12%；sticky 表头 |
| `datatable` | 数据表格 | Numbers / Finder 列表 + Inspector | 数据网格 | 同 table + 排序/筛选/列宽/行选择；工具条 36px；编辑格用输入框语法 |

### 图表（20）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `charts` | 图表总览 | Activity Monitor 图表区 | 数据可视化总览 | 统一 11px 轴标签、hairline 网格、accent 系列；图例 12px；tooltip 用浮层材质 |
| `chart-line` | 折线图 | Activity Monitor CPU 历史 | 时间序列 | 2px 线、点 3px hover 5px；面积 12% 渐变；轴不画满框 |
| `chart-bar` | 柱状图 | Activity Monitor 柱状 / 存储条 | 类目比较 | 柱宽 ≤24px、圆角 3px；网格仅水平；数值 tabular |
| `chart-pie` | 饼图 | 储存空间环形图 | 占比 | 环形 8px 厚；中心 22px 数值；图例 12px |
| `chart-radar` | 雷达图 | Activity Monitor 多指标 | 多维对比 | 3 层网格、系列 2px；轴标签 11px；避免大面积填充 |
| `chart-heatmap` | 热力图 | Calendar 年度热力 / Activity Monitor | 密度分布 | 格子 3px 角、accent 梯度 5 档；图例 11px |
| `chart-area` | 面积图 | Activity Monitor 带宽面积 | 累积趋势 | 面积 14% 渐变 + 2px 顶线；重叠系列用透明度 |
| `chart-stack` | 堆叠条 | 储存分类堆叠条 | 组成 | 段间 1px 表面色隔断；图例可切换；总计右对齐 |
| `chart-gauge` | 仪表盘 | 电池/用量仪表 | 单值进度 | 240° 弧、8px 轨；中心数值 22px；超限语义色 |
| `chart-sparkline` | 迷你趋势 | 菜单栏迷你趋势 | 极简趋势 | 1.5px 线、无轴、无点；高度 24–32px |
| `chart-scatter` | 散点气泡 | Instruments 散点 | 相关性 | 点 3px、hover 5px；轴 11px；网格 hairline |
| `chart-calendar` | 贡献日历 | Calendar 年视图 | 日期密度 | 7 列 × 53 行、3px 角；月份标签 11px |
| `chart-graph` | 知识图谱 | Xcode 依赖图 / GraphRAG | 关系网络 | 节点 24px、边 1px；拖拽/缩放；标签按缩放层级显隐 |
| `chart-map` | 嵌入地图 | Maps 嵌入地图 | 地理分布 | 地图底图降饱和；点 6px accent；不遮挡地图控件 |
| `charts-downsample` | 降采样（LTTB） | Instruments 采样 | 大数据降采样 | 头部追加“已抽样 N→M 点”说明；不静默丢数据 |
| `charts-zoom` | 缩放 / 刷选 | Instruments 时间轴缩放 | 刷选缩放 | 拖选 1px accent 框；双击/重置 chip 复原 |
| `charts-marks` | 标记线 / 标记点 | Activity Monitor 标记 | 阈值/事件标记 | 1px 虚线 + 11px 标签；不遮数据点 |
| `charts-append` | 流式追加 | Console 流式追加 | 实时数据 | 仅尾部追加；maxPoints 淘汰有提示；滚动跟随可暂停 |
| `charts-todataurl` | 导出 PNG | Preview 导出 | 图表导出 | 导出 PNG 用系统下载；失败可见 |
| `charts-loading` | 加载态 | 启动进度占位 | 加载态 | 骨架 shimmer 1.4s；保留图表外框高度避免跳动 |

### 浮层（6）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `modal` | 对话框 | NSAlert / macOS Sheet | 强聚焦决策 | 12px 角、520px 宽、标题 15px 600、按钮右对齐；焦点陷阱/Esc/还原 |
| `dropdown` | 下拉菜单 | NSMenu | 动作菜单 | 12px 角、4px 内距、28px 行、选中勾选；按方向 2px 入场 |
| `context-menu` | 右键菜单 | Finder 右键菜单 | 上下文动作 | 同 NSMenu，更窄；危险项 error 色；键盘可全操作 |
| `popover` | 浮层 | NSPopover | 锚定浮层 | 12px 角 + 浮层影 + 条件模糊；按 side 方向入场；焦点归还触发器 |
| `tooltip` | 提示 | 原生 tooltip | 补充说明 | 11–12px、4–6px 角、深色反转表面；延迟 400ms；Esc 可关 |
| `command-palette` | 命令面板 | Spotlight / Xcode Quick Open | 全局命令入口 | 顶部搜索 40px、结果 32px、分组 11px；⌘K 提示；背景 scrim + 模糊 |

### 反馈（7）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `alert` | 警示 | System Settings 警告横幅 | 页面内语义提示 | 左侧 2px 语义边 + 8% 底；图标 15px；标题 13px 600 |
| `result` | 结果页 | 安装助手结果页 | 任务结果 | 状态图标 40px + 标题 19px + 说明 13px + 主/次按钮 |
| `progress` | 进度条 | NSProgressIndicator | 进度 | 4px 轨、6px 圆角、accent 填充；不确定态用条纹动画；数值 tabular |
| `spinner` | 加载指示 | NSProgressIndicator spinner | 短等待 | 16px / 20px；1.5px 线；不只靠动画表达状态（aria-busy） |
| `skeleton` | 骨架屏 | 启动占位 | 内容加载 | 表面色块 + 1.4s shimmer；圆角随被替代内容 |
| `copy` | 复制按钮 | 工具栏复制动作 | 复制反馈 | 24/28px 按钮；成功态 check 图标 + 文案；失败可重试 |
| `notification` | 通知栈 | 通知中心 | 持久通知栈 | 12px 角 + 浮层影；分组/计数；操作按钮 28px；可暂停计时 |

### 导航（7）

| slug | 组件 | 原生参考 / 系统依据 | 选择理由 | 迁移与实现要点 |
|---|---|---|---|---|

| `nav` | 顶栏 | NSToolbar / Safari 顶栏 | 全局导航 | 44–52px chrome；当前项中性强调；滚动后 hairline 显形 |
| `sidebar` | 侧栏 | Finder / System Settings 侧栏 | 主分区导航 | 28px 行、16px 图标、分组 11px 600；选中底 accent 12% + 圆角 6px |
| `breadcrumb` | 面包屑 | Finder 路径栏 | 层级位置 | 13px、分隔 chevron 12px；末项正文色；可折叠中段 |
| `pagination` | 分页 | Finder 翻页 / 表格页脚 | 长列表分页 | 28px 按钮、当前页 accent 底；省略号保留；键盘可达 |
| `steps` | 步骤条 | 安装助手步骤 | 多步流程 | 24px 圆点 + 连接线；完成/当前/待办三态；当前项文字 600 |
| `back-top` | 回到顶部 | Preview 回到顶部 | 长页导航 | 32px 浮钮、浮层影；滚动 400px 后出现；尊重 reduced-motion |
| `layout` | 布局工具 | NSSplitView / 窗口布局 | 页面骨架 | 容器查询优先；侧栏 240–280px；不锁死视口高度 |

## 覆盖核对

- 文档条目：**129**（122 个 kit slug + 7 个纯文档聚合页）。
- 上表逐条覆盖，无遗漏；新增组件必须先在本表登记参考与判断依据，再动 CSS。
- 无直接原生对应物的组件（AI / KB / 图表族）以“系统设计原则 + 组合映射”登记，不强行命名一个不存在的系统控件。
