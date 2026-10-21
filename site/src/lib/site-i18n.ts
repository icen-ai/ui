import {
  ICEN_LOCALE_EN_US,
  ICEN_LOCALE_ZH_CN,
  setIcenLocale,
  type IcenLocale,
} from '../../../src/behaviors/i18n';
import { refreshSelect } from '../../../src/behaviors/select';
import { copyEn } from './site-i18n-en';
import { META } from './meta';

export type SiteLanguage = 'zh-CN' | 'en-US';

/** Page copy lives beside the site, while interactive library components use the same locale registry.
 *  全量词典（site-i18n-en.ts）垫底，手写条目在后展开——同键时手写优先。 */
const copy: Record<string, string> = {
  ...copyEn,
  /* JS 运行时才渲染的文案（不在服务端 HTML，词典普查抓不到）+ 词典误译纠正——苏式是苏联构成主义，不是苏州 */
  '苏式': 'Soviet',
  '无匹配项': 'No matches',
  '冰点组件设计系统': 'ICEN UI',
  /* kb 管线与标签短词（曾被子串误判为已收录） */
  '检索': 'Retrieve', '重排': 'Rerank', '生成': 'Generate', '来源': 'Sources', '手动': 'Manual',
  /* kb 沙箱日志模板（组装点 siteT 即时取译） */
  '← app.ready（沙箱就绪）': '← app.ready (sandbox ready)',
  '→ call echo {text:"来自宿主的调用"}': '→ call echo {text:"from host"}',
  /* 稳定性分层徽标（[slug].astro，数据源 docs/contracts/tiers.json） */
  'Core · 稳定': 'Core · Stable',
  'Beta · 演进中': 'Beta · Evolving',
  '稳定层：1.0 冻结轨道，破坏性变更须公告': 'Stable tier: on the 1.0 freeze track; breaking changes must be announced',
  '演进层：随 minor 快速迭代，0.x 期间不保兼容': 'Evolving tier: iterates with minors; no compatibility promise during 0.x',
  '← 回包': '← reply',
  '← 调用失败：': '← call failed: ',
  '来自宿主的调用': 'a call from the host',
  /* 演示文件名英化（混排句里保留中文文件名会残留 CJK） */
  '将「设计规范.md」移到回收站，不会影响已分享的副本。': 'Moving design-spec.md to trash will not affect any shared copies.',
  '「设计规范.md」已移到回收站': 'design-spec.md moved to trash',
  '已恢复「设计规范.md」': 'design-spec.md restored',
  /* 终扫补漏：问答演示数据与提示词版本标签 */
  '用户要': 'User asks', '已渲': 'Rendered',
  '提示词 v3': 'Prompt v3', '提示词 v4': 'Prompt v4',
  'Output 提示词 v3': 'Output Prompt v3', 'Output 提示词 v4': 'Output Prompt v4',
  '报销上限为 5000 元，超标需提前审批。': 'The expense cap is ¥5,000; anything above needs prior approval.',
  '国内差旅单笔报销上限 5000 元，超标需部门主管在 OA 事前审批并附说明。': 'Domestic travel reimbursement is capped at ¥5,000 per claim. Above that, your department head must pre-approve it in OA with a note.',
  '单笔 5000 元；超标需事前审批': '¥5,000 per claim; prior approval above the cap',
  '供应商准入要几个工作日？': 'How many business days does supplier onboarding take?',
  '5 个工作日。': 'Five business days.',
  '自材料齐全起 5 个工作日完成准入。': 'Onboarding completes within 5 business days once the documents are complete.',
  '5 个工作日': '5 business days',
  '社保断缴影响公积金贷款吗？': 'Does a break in social insurance affect my housing fund loan?',
  '断缴满 3 个月影响贷款额度，需补缴后恢复。': 'A break of 3+ months lowers your loan limit; back payments restore it.',
  '断缴会导致公积金贷款受阻，建议尽快处理以免影响买房。': 'A lapse can stall your housing fund loan — sort it out before it bites into your home purchase.',
  '连续缴存 6 个月方可申请；断缴重新计算缴存月': 'Apply after 6 consecutive months of payments; a break resets the clock',
  '年会当天请假怎么走流程？': "What's the leave process for the annual party day?",
  '找行政登记即可。': 'Just register with Admin.',
  '在 OA 提交「年会请假」流程并抄送直属主管，当天免审批。': 'File the "Annual party leave" workflow in OA and CC your manager — no approval needed that day.',
  'OA 流程 + 抄送主管': 'OA workflow + CC your manager',
  '让内容清楚，\n让操作轻盈。': 'Make the content clear,\nand the touch light.',
  '浅色模式': 'Light mode',
  '已保存到本次预览。': 'Saved to this preview session.',
  '留白有意，\n落笔有度。': 'Purposeful whitespace,\ndeliberate strokes.',
  '书页的呼吸，器物的温润，印记的分寸。让东方的从容，成为日常的使用感受。': 'The rhythm of book pages, the warmth of hand-finished objects, the poise of a seal stamp. Eastern composure as an everyday feel.',
  '疏密之间，自见风骨。': 'Character lives between dense and sparse.',
  '以结构，\n承托每一次行动。': 'Structure that\ncarries every action.',
  '坚实的体块，明确的轴线，果断的字形。把纪念性建筑的力量，收进清楚好用的界面。': 'Solid masses, clear axes, decisive letterforms. The strength of monumental architecture, packed into a plainly usable interface.',
  '秩序，拥有自己的力量。': 'Order has a strength of its own.',
  '每一格，\n都有自己的位置。': 'Every cell\nknows its place.',
  '整齐的网格、清晰的点阵与利落的按压。用最少的像素，表达完整的秩序。': 'Tidy grids, crisp dot matrices, snappy presses. Complete order from the fewest pixels.',
  '小小方寸，自有秩序。': 'Small squares, full of order.',
  '现代 / 实时预览': 'Modern / live preview',
  '中式 / 实时预览': 'Chinese / live preview',
  '苏式 / 实时预览': 'Soviet / live preview',
  '像素 / 实时预览': 'Pixel / live preview',
  '留下一点想法': 'Jot something down',
  '组件': 'Components', '色彩': 'Color', '原语': 'Primitives', '框架': 'Frameworks', '定制': 'Customize',
  'AI 原生': 'AI', '知识库': 'Knowledge', '数据图表': 'Charts', '首页 · 介绍': 'Home · Introduction',
  '组件总览': 'All components', '原语 · 交互基元': 'Primitives · Interaction patterns', '主题': 'Themes',
  '搜索组件（⌘K）': 'Search components (⌘K)', '搜索组件或页面…': 'Search components or pages…',
  '页面': 'Pages', '无匹配结果': 'No results found', '导航': 'Navigate', '打开': 'Open', '关闭': 'Close',
  '主导航': 'Main navigation', '文档导航': 'Documentation', '开始': 'Get started', '介绍': 'Introduction',
  '框架接入': 'Frameworks', '色彩 Tokens': 'Color tokens', '复制当前页': 'Copy page link',
  '特性': 'Features', '行为与接口说明': 'Behavior and API', '安装': 'Installation', '用法': 'Usage',
  '上一个': 'Previous', '下一个': 'Next', '没有上一个': 'No previous page', '复制安装命令': 'Copy install command',
  '复制': 'Copy', '已复制': 'Copied', 'GitHub 仓库': 'GitHub repository', '主题切换': 'Theme switcher',
  '组件 · ICEN UI': 'Components · ICEN UI',
  '个无框架组件，': ' framework-agnostic components across ', '个分组。全部消费同一套设计令牌——切换右上角的预设、明暗与风格，每张卡片即刻换装。': ' groups, all powered by the same design tokens. Change the preset, color mode, or style above to restyle every component.',
  '简洁留给用户，复杂留给代码': 'Keep the interface simple. Put the complexity in the code.',
  '同一套契约，四层能力': 'One contract, four layers of capability',
  'AI 界面、图表、主题与封装，各自独立可用，共用同一套设计令牌。': 'AI interfaces, charts, theming, and wrappers — each usable on its own, all sharing one design-token system.',
  'AI 原生组件族 · 图表通用层已发布': 'AI components · Universal chart layer now available',
  '组件入口': 'Components', '行为模块': 'Behavior modules', '图表类型': 'Chart types', '运行时依赖': 'Runtime dependencies',
  '设计哲学': 'Design principles', 'AI 原生族': 'AI-native components', '图表通用层': 'Universal chart layer',
  '三层正交': 'Three independent layers', '零依赖无框架': 'Framework-agnostic, zero dependencies',
  '组件、图表和 AI 界面，共用一套设计令牌。 换肤不用改代码，UI 也能直接交给模型调用。': 'Components, charts, and AI interfaces share one design-token system. Restyle without code changes, and let models call UI capabilities directly.',
  [`${META.aiComponents} 个组件：对话、推理、工具调用、审批、输入台、用量审计。兼容 OpenAI / Anthropic / MCP / AI SDK 协议，token 与成本自动记账。`]: `${META.aiComponents} components: chat, reasoning, tool calls, approvals, composer, and usage auditing. Works with OpenAI / Anthropic / MCP / AI SDK protocols, with automatic token and cost accounting.`,
  [`一份 JSON，${META.charts.total} 种图。悬停、点击、右键与图例开关全部内建，不依赖任何图表库。`]: `One JSON spec, ${META.charts.total} chart types. Hover, click, context-menu, and legend interactions are built in, with no charting dependency.`,
  '色彩、质感、明暗三层分开调，互不影响。': 'Color, material, and light mode are independent layers.',
  '零运行时依赖（package.json 的 dependencies 为空）。React / Vue / 原生 JS 均可，SSR 安全。': 'Zero runtime dependencies — the dependencies field in package.json is empty and verifiable. Works with React, Vue, or plain JS; SSR-safe.',
  [`${META.presets} 套预设，明暗各一套`]: `${META.presets} presets, each in light and dark`,
  '现代、东韵、巨构、钢琴、莫奈、梵高，各带明暗双模。点一张色卡，整站即刻换装。': 'Six palettes, each with light and dark modes. Pick a swatch to restyle the entire site instantly.',
  '下面都是实时渲染，不妨试试——悬停卡片看名字。': 'These are live components. Explore them, or hover over a card to see its name.',
  '简洁留给用户，复杂留给代码。': 'Keep the interface simple. Put the complexity in the code.',
  '立即开始': 'Get started', '快速开始': 'Quick start', '组件预览': 'Component preview', '色彩预设': 'Color presets',
  '工具条': 'Toolbar',
  '按钮': 'Button', '面板': 'Panel', '徽章': 'Badge', '标签': 'Tag', '标签页': 'Tabs', '指标卡': 'Stat card',
  '轻提示': 'Toast', '分栏拖拽': 'Split pane', '表单布局': 'Form layout', '输入框': 'Input', '选择器': 'Select',
  '滑块': 'Slider', '标签输入': 'Tag input', '开关与选择': 'Switches and choices', '分段选择': 'Segmented control',
  '上传': 'Upload', '日期选择': 'Date picker', '对话框': 'Dialog', '下拉菜单': 'Dropdown menu', '右键菜单': 'Context menu',
  '提示': 'Tooltip', '命令面板': 'Command palette', '卡片': 'Card', '空状态': 'Empty state',
  '警示': 'Alert', '基础': 'Basics', '表单': 'Forms', '数据展示': 'Data display', '浮层': 'Overlays',
  '反馈': 'Feedback', '图表': 'Charts',
  '个人': 'Profile', '仪表盘': 'Dashboard', '侧栏': 'Sidebar', '分页': 'Pagination', '列表': 'List', '加载指示': 'Spinner',
  '图表总览': 'Chart overview', '堆叠条': 'Stacked bar', '复制按钮': 'Copy button', '头像': 'Avatar',
  '媒体卡': 'Media card', '布局工具': 'Layout utilities', '折叠面板': 'Accordion', '折线图': 'Line chart', '描述列表': 'Description list',
  '散点气泡': 'Scatter plot', '数据表格': 'Data table', '时间线': 'Timeline', '柱状图': 'Bar chart', '树形': 'Tree', '步骤条': 'Stepper',
  '结果页': 'Result page', '表格': 'Table', '评分': 'Rating', '贡献日历': 'Contribution calendar', '轮播': 'Carousel',
  '进度条': 'Progress bar', '迷你趋势': 'Sparkline', '通知栈': 'Notifications', '键盘键': 'Keyboard key', '雷达图': 'Radar chart',
  '面包屑': 'Breadcrumbs', '面积图': 'Area chart', '顶栏': 'Top navigation', '饼图': 'Pie chart', '骨架屏': 'Skeleton',
  'AI 上下文面板': 'AI context panel', 'AI 任务清单': 'AI task list', 'AI 会话': 'AI threads', 'AI 子智能体': 'AI subagent',
  'AI 工具调用': 'AI tool call', 'AI 差异审阅': 'AI diff review', 'AI 总览': 'AI overview', 'AI 推理': 'AI reasoning',
  'AI 文件标签': 'AI file attachments', 'AI 消息': 'AI message', 'AI 用量条': 'AI usage meter', 'AI 输入台': 'AI composer',
  '一行引入该组件（CSS 与 behavior 自动带上，无需关心内部 CSS 文件名）：': 'Import the component in one line. Its CSS and behavior are included automatically:',
  '也可以用脚手架直接打印引入行：': 'Or print the import line with the CLI:',
  'Astro 项目注意：kit 入口里的 CSS import 在页面': 'Astro note: CSS imports in kit entry points are removed from the client bundle. Import CSS in the layout frontmatter instead:',
  'React / Vue 接入（薄封装层）': 'React and Vue integration (lightweight adapters)', '生命周期接线': 'Lifecycle wiring', '类型面 re-export': 'Re-exported types',
  '生命周期与 SSR 注意': 'Lifecycle and SSR notes', '何时直接用行为层': 'When to use the behavior API directly',
  '事件桥': 'Event bridge',
  '调旋钮，看预览，拿走 CSS。': 'Tune the controls, preview the result, and take the CSS with you.', '主题工作台': 'Theme studio',
  '品牌色': 'Brand color', '应用到全站': 'Apply site-wide', '随机搭配': 'Randomize', '订单总览': 'Order overview',
  '待办': 'To do', '概览': 'Overview', '明细': 'Details', '已支付': 'Paid', '待审核': 'Pending review', '已逾期': 'Overdue',
  '主要操作': 'Primary action', '次要': 'Secondary', '幽灵': 'Ghost', '覆盖 CSS（含实测对比度）': 'Override CSS (with measured contrast)',
  '挂载与运行时': 'Setup and runtime', '级联层': 'Cascade layers', '国际化': 'Internationalization', '设计工具导出': 'Design-tool exports',
  '色彩 Tokens 页': 'Color tokens page', '四种原语，即刻体验': 'Explore four primitives', '真实组件': 'Real components',
  '日常，自有分寸。': 'Thoughtful by default.', '瓷白与柔光，轻盈的操作层。': 'Porcelain surfaces, soft light, and a light touch for controls.',
  '为这一刻命名': 'Name this moment', '保存灵感': 'Save idea', '在此输入，感受同一套组件的不同表达。': 'Type here to see how the same components adapt to a different style.',
  '组件契约': 'Component contract', '状态命名': 'State names', '颜色纪律': 'Color rules', '间距 / 字号 / 控件高度': 'Spacing / type / control height',
  '圆角 / 阴影': 'Corners / shadows', '事件体系': 'Event system', '手势 × 协议 × 策略': 'Gestures × protocol × policy',
  '手势层': 'Gesture layer', '协议层': 'Protocol layer', '策略层': 'Policy layer', '等待手势…': 'Waiting for a gesture…',
  'ICEN DESIGN PRIMITIVES': 'ICEN DESIGN PRIMITIVES', '让内容清楚，': 'Make content clear,', '色彩主题': 'Color theme',
  '品牌强调色': 'Brand accent', '控件圆角': 'Control radius', '操作层透光': 'Control translucency', '布局密度': 'Layout density',
  '标准 · 从容清晰': 'Standard · room to breathe', '紧凑 · 更多信息': 'Compact · more information', '宽松 · 更多留白': 'Relaxed · more space',
  '恢复现代': 'Reset to Modern', '调节会同时作用于页面、菜单与弹窗。': 'Changes apply to the page, menus, and dialogs.',
  '在真实界面中感受': 'Experience it in a real interface', '安静，也有分寸。': 'Quiet, with a sense of proportion.',
  '内容': 'Content', '操作': 'Controls', '账户设置': 'Account settings', '知识工作台': 'Knowledge workspace',
  '个人资料': 'Profile', '显示名称': 'Display name', '电子邮箱': 'Email address', '产品动态': 'Product updates',
  '保存更改': 'Save changes', '团队知识库': 'Team knowledge base', '新建笔记': 'New note', '已同步': 'Synced', '草稿': 'Draft',
  '一起，把想法变清楚。': 'Make ideas clearer, together.', '新的对话': 'New conversation', '继续对话': 'Continue conversation', '发送': 'Send',
  '光': 'Light', '形': 'Form', '字': 'Type', '知识库工作台': 'Knowledge-base workspace',
  '问答': 'Q&A', '摄取': 'Ingestion', '检索': 'Retrieval', '问数': 'Ask data', '观测': 'Observability',
  '运行': 'Run', '查看分段': 'View chunks', '过滤器': 'Filters', '重排对比': 'Reranking comparison', '召回测试': 'Recall test',
  '问题': 'Question', '重新生成': 'Regenerate', '生成 SQL': 'Generate SQL', '调用链': 'Trace', '标注队列': 'Review queue',
  '无答案治理': 'No-answer governance', '审计时间线': 'Audit timeline', '文档权限面板': 'Document permissions',
  '有效权限检查器': 'Effective permissions checker', '访问申请流': 'Access request flow', '双栏画布': 'Split canvas',
  '流式链路': 'Streaming workflow', '运行链路': 'Run workflow', '检查点': 'Checkpoint', 'MCP 沙箱': 'MCP sandbox', '知识结构视图': 'Knowledge graph',
  '提交申请 →': 'Submit request →', '批准 →': 'Approve →', '30 天后 →': '30 days later →',
  '6 个交互基元 class': 'Six interaction primitives', '用法（任选其一）：': 'Choose either approach:',
  '密度': 'Density', '明暗': 'Color mode', '浅色': 'Light', '深色': 'Dark', '还原': 'Reset', '首页': 'Home',
  '选择语言 / Choose language': 'Choose language',
  '与': 'and',
  '是官方薄封装层：': ' provide official lightweight adapters:',
  '——\n    不复制状态、不重新实现组件逻辑，底下仍是同一个命令式行为内核。': '—they do not duplicate state or reimplement components. Both use the same imperative behavior core.',
  '封装层只做三件事：': 'The adapters do three things: ',
  '（mount → create / props 变 → update / unmount → destroy）、': '(mount → create / props change → update / unmount → destroy), ',
  '（onIcen ↔ 回调，卸载自动清理）、': '(onIcen ↔ callbacks, with automatic cleanup on unmount), and ',
  '。\n    行为层文档与事件契约对两个框架完全适用。': '. The behavior API docs and event contracts apply to both frameworks.',
  'react / react-dom / vue 都是': 'react, react-dom, and vue are ',
  'peerDependencies（>=18 / >=3.3）——\n        只装你用的框架即可。CSS 不在封装层引入，照常先引 tokens 再引组件 CSS。': 'peer dependencies (React >=18, Vue >=3.3). Install only the framework you use. The adapters do not import CSS: load tokens first, then component CSS as usual.',
  '需要命令式句柄（': 'Need an imperative handle (',
  '…）时传': '…) ? Pass ',
  '拿到 ChartHandle / TableHandle / AiToolCallHandle。': ' to receive a ChartHandle, TableHandle, or AiToolCallHandle.',
  '指令已在入口 banner 打好——RSC 里直接 import 即落在客户端边界内。': ' is already included in the entry banner, so importing it in an RSC places it inside the client boundary.',
  '组合式 API 对应物：': 'Composition API equivalents: ',
  '（onUnmounted 自动清理）。组件 expose': ' (automatically cleaned up on unmount). Components expose ',
  '取命令式句柄。': ' to retrieve the imperative handle.',
  '封装层覆盖「声明式 props + 生命周期」主路径；以下场景请直接 import 行为模块\n        （': 'The adapters cover the standard declarative-props and lifecycle workflow. Import behavior modules directly for cases such as ',
  '，在框架的 effect / onMounted 里手动调用）：': ' and call them from your framework’s effect or onMounted hook:',
  '薄如蝉翼': 'A deliberately thin layer',
  '按钮 · ICEN UI': 'Button · ICEN UI',
  '基础 / 基本': 'Basics',
  '界面图标': 'Interface icons', '外观切换': 'Appearance switcher', '会话列表': 'Conversation list', '回答反馈': 'Answer feedback',
  '分支切换': 'Branch switching', '知识库总览': 'Knowledge-base overview', '行内引用': 'Inline citations', '来源列表': 'Source list',
  '原文定位': 'Source passage', '来源冲突': 'Source conflicts', '解析管线': 'Parsing pipeline', '分段编辑器': 'Chunk editor',
  '分段策略': 'Chunking strategy', '数据源连接': 'Data connectors', '元数据': 'Metadata', 'QA 对': 'Q&A pairs',
  '检索调试台': 'Retrieval workbench', '过滤构建器': 'Filter builder',
};
const originalText = new WeakMap<Text, string>();
const originalAttribute = new WeakMap<Element, Map<string, string>>();
const originalHeadContent = new WeakMap<Element, string>();

export function detectSiteLanguage(): SiteLanguage {
  try {
    const saved = localStorage.getItem('icen.ui.language');
    if (saved === 'zh-CN' || saved === 'en-US') return saved;
  } catch { /* storage may be disabled */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((lang) => /^zh(?:-|$)/i.test(lang)) ? 'zh-CN' : 'en-US';
}

const translateText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = copy[trimmed];
  if (translated) return value.replace(trimmed, translated);
  // 前缀回退：运行时组装的「标题 数值」节点（如分组表头「金额 64809.85」）——
  // 整串无词条时，把开头连续中文段（含全角标点）按词表替换，保留数值尾部
  const prefix = trimmed.match(/^[\u4e00-\u9fff\uff00-\uffef·]+(?=\s)/);
  if (prefix && copy[prefix[0]]) return value.replace(prefix[0], copy[prefix[0]]);
  // Retain component counts while localizing the surrounding overview sentence.
  const match = trimmed.match(/^(\d+) 个无框架组件，(\d+) 个分组。全部消费同一套设计令牌——切换右上角的预设、明暗与风格，每张卡片即刻换装。$/);
  if (match) return `${match[1]} framework-agnostic components across ${match[2]} groups, all powered by the same design tokens. Change the preset, color mode, or style above to restyle every component.`;
  return value;
};

function applySiteCopy(language: SiteLanguage): void {
  document.documentElement.lang = language;
  document.documentElement.dataset.iceLanguage = language;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,code,pre,[data-i18n-skip]')) continue;
    if (!originalText.has(node as Text)) originalText.set(node as Text, node.nodeValue ?? '');
    const source = originalText.get(node as Text) ?? '';
    const next = language === 'zh-CN' ? source : translateText(source);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  document.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((el) => {
    /* 代码区 landmark 的 aria-label 由 code-block 行为按页去重（同页多块 html/js），
       这里不能再按原文回写，否则唯一名会被抹掉。 */
    if (el.tagName === 'PRE' && el.getAttribute('role') === 'region') return;
    for (const attr of ['aria-label', 'title', 'placeholder']) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      let values = originalAttribute.get(el);
      if (!values) { values = new Map(); originalAttribute.set(el, values); }
      if (!values.has(attr)) values.set(attr, value);
      const source = values.get(attr) ?? value;
      el.setAttribute(attr, language === 'zh-CN' ? source : translateText(source));
    }
  });
  const title = document.querySelector('title');
  if (title) {
    if (!originalHeadContent.has(title)) originalHeadContent.set(title, title.textContent ?? '');
    const source = originalHeadContent.get(title) ?? '';
    title.textContent = language === 'zh-CN' ? source : source.split(' · ').map((part) => copy[part] ?? part).join(' · ');
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="description"],meta[property="og:description"]').forEach((meta) => {
    if (!originalHeadContent.has(meta)) originalHeadContent.set(meta, meta.content);
    const source = originalHeadContent.get(meta) ?? '';
    meta.content = language === 'zh-CN' ? source : translateText(source);
  });
  document.querySelectorAll<HTMLElement>('[data-icen-group]').forEach((el) => {
    let values = originalAttribute.get(el);
    if (!values) { values = new Map(); originalAttribute.set(el, values); }
    if (!values.has('data-icen-group')) values.set('data-icen-group', el.dataset.icenGroup ?? '');
    const value = values.get('data-icen-group') ?? '';
    el.dataset.icenGroup = language === 'zh-CN' ? value : copy[value] ?? value;
  });
  const registry: IcenLocale = language === 'en-US' ? ICEN_LOCALE_EN_US : ICEN_LOCALE_ZH_CN;
  setIcenLocale(registry);
  document.dispatchEvent(new CustomEvent('icen:site-locale-change', { detail: { language } }));
}

/** 顶导语言切换器走 icen-select 契约：改 .is-selected 类后 refreshSelect 同步文案与 aria（不发用户事件）。 */
function syncLanguageControl(language: SiteLanguage): void {
  const control = document.querySelector<HTMLElement>('[data-site-language]');
  if (!control) return;
  control.querySelectorAll('.icen-select-option').forEach((option) => {
    option.classList.toggle('is-selected', option.getAttribute('data-icen-value') === language);
  });
  refreshSelect(control);
}

/** JS 重渲染的中文（主题面板选项、工作台控件、toast 等运行时文案）自动补翻：
    body 文本变动去抖后重扫。translateText 确定性幂等——译文落定后不再改动节点，
    观察器两轮内自然收敛，不会自激。 */
let autoRetranslateBound = false;
function bindAutoRetranslate(): void {
  if (autoRetranslateBound || typeof MutationObserver === 'undefined') return;
  autoRetranslateBound = true;
  let timer = 0;
  let applying = false;
  new MutationObserver(() => {
    if (applying) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      applying = true;
      try { applySiteCopy(detectSiteLanguage()); } finally { applying = false; }
    }, 150);
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
}

/** 页面脚本组装运行时文案时的即时取译：英文态返回译文（词表查不到则原样），中文态原样返回。
 *  适用于嵌入动态内容（JSON 回包等）无法等 DOM 落定再翻的组装点。 */
export function siteT(text: string): string {
  return detectSiteLanguage() === 'en-US' ? translateText(text) : text;
}

export function initSiteI18n(): void {
  const language = detectSiteLanguage();
  applySiteCopy(language);
  syncLanguageControl(language);
  bindAutoRetranslate();
}

export function setSiteLanguage(language: SiteLanguage): void {
  try { localStorage.setItem('icen.ui.language', language); } catch { /* storage may be disabled */ }
  applySiteCopy(language);
}

