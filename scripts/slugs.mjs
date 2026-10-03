// 组件 slug → CSS 文件 / behavior init 映射 —— kit 入口与 CLI 的单一事实源。
// 被三处消费：scripts/build-css.ts（生成 dist/components/<slug>.mjs 与 registry.json）、
//             scripts/cli.mjs（bunx @icen.ai/ui add <slug>）、文档站 site/src/lib/components.ts。
// 新增组件时在此登记 slug；CSS 合并文件（content/feedback/media/menu）在 MERGED_CSS 维护。

/** 全部组件 slug（顺序即文档站侧栏顺序，仅供 CLI list 展示）。 */
export const SLUGS = [
  // 基础
  'btn', 'panel', 'pill', 'tag', 'tabs', 'stat', 'toast', 'toolbar', 'split-pane',
  // 表单
  'form', 'input', 'select', 'slider', 'tag-input', 'switch', 'segmented', 'upload', 'date-picker',
  // 浮层
  'modal', 'dropdown', 'context-menu', 'popover', 'tooltip', 'command-palette',
  // 数据展示
  'card', 'empty', 'avatar', 'media-card', 'rating', 'kbd', 'list', 'accordion',
  'timeline', 'desc', 'tree', 'carousel', 'badge', 'scroll-area',
  // 表格
  'table', 'datatable',
  // 图表（umbrella + 细分类型，按需安装）
  'charts',
  'chart-line', 'chart-bar', 'chart-pie', 'chart-radar', 'chart-heatmap',
  'chart-area', 'chart-stack', 'chart-gauge', 'chart-sparkline',
  'chart-scatter', 'chart-calendar',
  // 反馈
  'alert', 'result', 'progress', 'spinner', 'skeleton', 'copy', 'notification',
  // 导航
  'nav', 'sidebar', 'breadcrumb', 'pagination', 'steps', 'back-top', 'layout',
  // AI 原生组件族（ai-*；CSS 合并为 4 文件，见 MERGED_CSS）
  'ai-chat', 'ai-message', 'ai-reasoning', 'ai-composer', 'ai-tool-call', 'ai-subagent', 'ai-diff', 'ai-files', 'ai-todo', 'ai-context', 'ai-usage',
  'ai-threads', 'ai-feedback', 'ai-branch',
  // 知识库族（kb-*；共享基座 kb.css + 六域合并文件，见 MERGED_CSS/EXTRA_CSS；规格 docs/spec/kb-family.md）
  'kb',
  'kb-citation', 'kb-sources', 'kb-passage', 'kb-conflict',
  'kb-pipeline', 'kb-chunks', 'kb-segment', 'kb-connector', 'kb-metadata', 'kb-qa',
  'kb-retrieval', 'kb-filter', 'kb-rerank', 'kb-hittest',
  'kb-sql', 'kb-answer', 'kb-clarify', 'kb-explain',
  'kb-trace', 'kb-review', 'kb-gap', 'kb-eval',
  'kb-canvas', 'kb-checkpoint', 'kb-sandbox', 'kb-chain',
  // 权限域 kb-perm（v0.9.1；spec §9；安全纪律：调研 2026-10-03-kb-permissions）
  'kb-acl', 'kb-who-can', 'kb-access', 'kb-audit', 'kb-visibility',
  'chart-graph', 'chart-map',
];

/** slug → css 文件名：多数同名，以下为合并文件的例外。 */
export const MERGED_CSS = {
  desc: 'content.css',
  timeline: 'content.css',
  tree: 'content.css',
  accordion: 'content.css',
  list: 'content.css',
  kbd: 'content.css',
  alert: 'feedback.css',
  result: 'feedback.css',
  progress: 'feedback.css',
  spinner: 'feedback.css',
  skeleton: 'feedback.css',
  avatar: 'media.css',
  'media-card': 'media.css',
  rating: 'media.css',
  carousel: 'media.css',
  dropdown: 'menu.css',
  'context-menu': 'menu.css',
  // chart-calendar 无独立 css，样式并入 chart-heatmap.css（.chart-calendar* 规则）
  'chart-calendar': 'chart-heatmap.css',
  // AI 族合并文件：ai-chat.css / ai-tool.css / ai-diff.css / ai-panel.css
  'ai-message': 'ai-chat.css',
  'ai-reasoning': 'ai-chat.css',
  'ai-composer': 'ai-chat.css',
  'ai-subagent': 'ai-tool.css',
  'ai-tool-call': 'ai-tool.css',
  'ai-files': 'ai-diff.css',
  'ai-todo': 'ai-panel.css',
  'ai-context': 'ai-panel.css',
  'ai-usage': 'ai-panel.css',
  // AI 族扩展：threads/branch 并入 ai-chat.css，feedback 并入 ai-panel.css（追加式）
  'ai-threads': 'ai-chat.css',
  'ai-branch': 'ai-chat.css',
  'ai-feedback': 'ai-panel.css',
  // 知识库族六域合并文件（共享基座 kb.css 由 EXTRA_CSS 附加引入；kb umbrella 主 css 即 kb.css）
  'kb-citation': 'kb-ground.css',
  'kb-sources': 'kb-ground.css',
  'kb-passage': 'kb-ground.css',
  'kb-conflict': 'kb-ground.css',
  'kb-pipeline': 'kb-ingest.css',
  'kb-chunks': 'kb-ingest.css',
  'kb-segment': 'kb-ingest.css',
  'kb-connector': 'kb-ingest.css',
  'kb-metadata': 'kb-ingest.css',
  'kb-qa': 'kb-ingest.css',
  'kb-retrieval': 'kb-search.css',
  'kb-filter': 'kb-search.css',
  'kb-rerank': 'kb-search.css',
  'kb-hittest': 'kb-search.css',
  'kb-sql': 'kb-data.css',
  'kb-answer': 'kb-data.css',
  'kb-clarify': 'kb-data.css',
  'kb-explain': 'kb-data.css',
  'kb-trace': 'kb-ops.css',
  'kb-review': 'kb-ops.css',
  'kb-gap': 'kb-ops.css',
  'kb-eval': 'kb-ops.css',
  'kb-canvas': 'kb-agent.css',
  'kb-checkpoint': 'kb-agent.css',
  'kb-sandbox': 'kb-agent.css',
  'kb-chain': 'kb-agent.css',
  // 权限域（第七域；共享基座 kb.css 由 EXTRA_CSS 附加引入）
  'kb-acl': 'kb-perm.css',
  'kb-who-can': 'kb-perm.css',
  'kb-access': 'kb-perm.css',
  'kb-audit': 'kb-perm.css',
  'kb-visibility': 'kb-perm.css',
  // chart-map 无独立 css，样式并入 charts.css 基座（.chart-map 变体）
  'chart-map': 'charts.css',
};

/** slug → behavior 的 init 函数名（有 init 契约的组件）。 */
export const SLUG_INIT = {
  accordion: 'initAccordion',
  'ai-chat': 'initAiChat',
  'ai-composer': 'initAiComposer',
  'ai-context': 'initAiContext',
  'ai-diff': 'initAiDiff',
  'ai-subagent': 'initAiSubagent',
  'ai-todo': 'initAiTodo',
  'ai-tool-call': 'initAiTool',
  carousel: 'initCarousel',
  'context-menu': 'initContextMenu',
  copy: 'initCopy',
  'command-palette': 'initCommandPalette',
  'date-picker': 'initDatePicker',
  dropdown: 'initDropdown',
  input: 'initInput',
  modal: 'initModal',
  nav: 'initNav',
  notification: 'initNotification',
  pagination: 'initPagination',
  rating: 'initRating',
  select: 'initSelect',
  sidebar: 'initSidebar',
  slider: 'initSlider',
  'split-pane': 'initSplitPane',
  steps: 'initSteps',
  switch: 'initSwitch',
  'back-top': 'initBackTop',
  table: 'initTableSort',
  tabs: 'initTabs',
  'tag-input': 'initTagInput',
  tree: 'initTree',
  upload: 'initUpload',
  // AI 族扩展
  'ai-threads': 'initAiThreads',
  'ai-feedback': 'initAiFeedback',
  'ai-branch': 'initAiBranch',
  // 知识库族
  'kb-citation': 'initKbCitation',
  'kb-sources': 'initKbSources',
  'kb-pipeline': 'initKbPipeline',
  'kb-chunks': 'initKbChunks',
  'kb-connector': 'initKbConnectors',
  'kb-metadata': 'initKbMetadata',
  'kb-qa': 'initKbQa',
  'kb-sql': 'initKbSql',
  'kb-trace': 'initKbTrace',
  'kb-gap': 'initKbGap',
  'kb-checkpoint': 'initKbCheckpoint',
  'kb-chain': 'initKbChain',
  'kb-audit': 'initKbAudit',
  'kb-acl': 'initKbAcl',
};

/** 有 behavior 但无 init（函数式 API）的 slug → 导出函数提示（CLI 输出用）。 */
export const SLUG_EXPORTS = {
  notification: ['notify'],
  toast: ['toast'],
  // ── 表单/导航控件族：交互在 controls.ts（behavior 映射见 SLUG_BEHAVIOR）──
  // segmented 的 OTP 仍由 input.ts 的 initInput 提供，kit 入口从 controls re-export，
  // 故此处三项并存（追加而非替换 initInput，保持 kit/segmented 兼容）
  segmented: ['initInput', 'initSegmented', 'initStepper'],
  switch: ['initSwitch'],
  steps: ['initSteps'],
  rating: ['initRating'],
  pagination: ['initPagination'],
  table: ['initTableSort'],
  popover: ['openPopover', 'closePopover', 'computePopoverLayout'],
  charts: [
    'renderVBar', 'renderHBar', 'renderStack', 'renderDonut', 'renderLine',
    'renderArea', 'renderRadar', 'renderHeatmap', 'renderSparkline', 'renderGauge',
    'renderCalendar', 'renderScatter', 'renderChart', 'normalizeChartSpec',
    'inferChartType', 'chartFormatValue', 'registerChartTone',
  ],
  datatable: ['createTable'],
  // ── 图表细分类型：仅导出该类型的渲染函数 ──
  'chart-line': ['renderLine'],
  'chart-bar': ['renderVBar', 'renderHBar'],
  'chart-pie': ['renderDonut'],
  'chart-radar': ['renderRadar'],
  'chart-heatmap': ['renderHeatmap'],
  'chart-area': ['renderArea'],
  'chart-stack': ['renderStack'],
  'chart-gauge': ['renderGauge'],
  'chart-sparkline': ['renderSparkline'],
  'chart-scatter': ['renderScatter', 'renderMap'],
  'chart-calendar': ['renderCalendar'],
  // ── 图谱（GraphRAG 实体关系 + 嵌入地图，behavior 在 charts.ts）──
  'chart-graph': ['renderGraph', 'layoutGraph'],
  'chart-map': ['renderMap'],
  // ── AI 族：behavior 挂到别模块的 slug，kit 入口按此 re-export ──
  'ai-message': ['renderAiMessage', 'createAiStream', 'initAiChat'],
  'ai-reasoning': ['createAiStream', 'initAiChat'],
  'ai-files': ['renderAiDiff'],
  'ai-usage': ['renderAiUsage', 'renderAiUsageRing', 'renderAiAudit'],
};

/** slug → 对应组件 CSS 文件名。 */
export function cssOf(slug) {
  return MERGED_CSS[slug] ?? `${slug}.css`;
}

/**
 * slug → behavior 模块名（缺省同 slug）。
 * charts 细分类型的 behavior 统一在 charts.ts，slug 与文件名不同。
 */
export const SLUG_BEHAVIOR = {
  // ── 表单/导航控件族：交互在 controls.ts ──
  // segmented 无独立 behavior 文件：分段/步进在 controls.ts，OTP 仍在 input.ts
  // （controls.ts re-export initInput，kit/segmented 经 SLUG_EXPORTS 一并带出）
  segmented: 'controls',
  switch: 'controls',
  steps: 'controls',
  rating: 'controls',
  pagination: 'controls',
  table: 'controls',
  // AI 族：message/reasoning 复用 ai-chat、files 复用 ai-diff、usage 复用 ai-panel
  'ai-message': 'ai-chat',
  'ai-reasoning': 'ai-chat',
  'ai-files': 'ai-diff',
  'ai-usage': 'ai-panel',
  'chart-line': 'charts',
  'chart-bar': 'charts',
  'chart-pie': 'charts',
  'chart-radar': 'charts',
  'chart-heatmap': 'charts',
  'chart-area': 'charts',
  'chart-stack': 'charts',
  'chart-gauge': 'charts',
  'chart-sparkline': 'charts',
  'chart-scatter': 'charts',
  'chart-calendar': 'charts',
  'chart-graph': 'charts',
  'chart-map': 'charts',
};

/** slug → kit 入口需附加引入的其他 CSS（如 datatable 右键菜单依赖 menu.css）。 */
export const EXTRA_CSS = {
  datatable: ['menu.css'],
  // charts umbrella：引入全部细分类型 CSS，一条 import 拿到所有图表样式
  charts: [
    'chart-line.css', 'chart-bar.css', 'chart-pie.css', 'chart-radar.css',
    'chart-heatmap.css', 'chart-area.css', 'chart-stack.css',
    'chart-gauge.css', 'chart-sparkline.css', 'chart-scatter.css', 'chart-graph.css',
  ],
  // 图表细分类型依赖共享基座 charts.css
  'chart-line': ['charts.css'],
  'chart-bar': ['charts.css'],
  'chart-pie': ['charts.css'],
  'chart-radar': ['charts.css'],
  'chart-heatmap': ['charts.css'],
  'chart-area': ['charts.css'],
  'chart-stack': ['charts.css'],
  'chart-gauge': ['charts.css'],
  'chart-sparkline': ['charts.css'],
  'chart-scatter': ['charts.css'],
  // 图表细分类型依赖共享基座 charts.css（calendar 主 css 已由 MERGED_CSS 指向 chart-heatmap.css）
  'chart-calendar': ['charts.css'],
  'chart-graph': ['charts.css'],
  // kb umbrella：一条 import 拿到知识库全家（基座 kb.css + 七域）
  kb: ['kb-ground.css', 'kb-ingest.css', 'kb-search.css', 'kb-data.css', 'kb-ops.css', 'kb-agent.css', 'kb-perm.css'],
  // kb 域组件全部依赖共享基座 kb.css（.kb-row/.kb-num/.kb-quote 等原语）
  'kb-citation': ['kb.css'],
  'kb-sources': ['kb.css'],
  'kb-passage': ['kb.css'],
  'kb-conflict': ['kb.css'],
  'kb-pipeline': ['kb.css'],
  'kb-chunks': ['kb.css'],
  'kb-segment': ['kb.css'],
  'kb-connector': ['kb.css'],
  'kb-metadata': ['kb.css'],
  'kb-qa': ['kb.css'],
  'kb-retrieval': ['kb.css'],
  'kb-filter': ['kb.css'],
  'kb-rerank': ['kb.css'],
  'kb-hittest': ['kb.css'],
  'kb-sql': ['kb.css'],
  'kb-answer': ['kb.css'],
  'kb-clarify': ['kb.css'],
  'kb-explain': ['kb.css'],
  'kb-trace': ['kb.css'],
  'kb-review': ['kb.css'],
  'kb-gap': ['kb.css'],
  'kb-eval': ['kb.css'],
  'kb-canvas': ['kb.css'],
  'kb-checkpoint': ['kb.css'],
  'kb-sandbox': ['kb.css'],
  'kb-chain': ['kb.css'],
  // 权限域组件同样依赖基座 kb.css
  'kb-acl': ['kb.css'],
  'kb-who-can': ['kb.css'],
  'kb-access': ['kb.css'],
  'kb-audit': ['kb.css'],
  'kb-visibility': ['kb.css'],
};
