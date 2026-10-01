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
  // 反馈
  'alert', 'result', 'progress', 'spinner', 'skeleton', 'copy', 'notification',
  // 导航
  'nav', 'sidebar', 'breadcrumb', 'pagination', 'steps', 'back-top', 'layout',
  // AI 原生组件族（ai-*；CSS 合并为 4 文件，见 MERGED_CSS）
  'ai-chat', 'ai-message', 'ai-reasoning', 'ai-composer', 'ai-tool-call', 'ai-subagent', 'ai-diff', 'ai-files', 'ai-todo', 'ai-context', 'ai-usage',
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
  // AI 族合并文件：ai-chat.css / ai-tool.css / ai-diff.css / ai-panel.css
  'ai-message': 'ai-chat.css',
  'ai-reasoning': 'ai-chat.css',
  'ai-composer': 'ai-chat.css',
  'ai-subagent': 'ai-tool.css',
  'ai-files': 'ai-diff.css',
  'ai-todo': 'ai-panel.css',
  'ai-context': 'ai-panel.css',
  'ai-usage': 'ai-panel.css',
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
  select: 'initSelect',
  sidebar: 'initSidebar',
  slider: 'initSlider',
  'split-pane': 'initSplitPane',
  'back-top': 'initBackTop',
  tabs: 'initTabs',
  'tag-input': 'initTagInput',
  tree: 'initTree',
  upload: 'initUpload',
};

/** 有 behavior 但无 init（函数式 API）的 slug → 导出函数提示（CLI 输出用）。 */
export const SLUG_EXPORTS = {
  notification: ['notify'],
  toast: ['toast'],
  // segmented 的 OTP 行为由 input.ts 的 initInput 提供，kit 入口需 re-export
  segmented: ['initInput'],
  popover: ['openPopover', 'closePopover', 'computePopoverLayout'],
  charts: [
    'renderVBar', 'renderHBar', 'renderStack', 'renderDonut', 'renderLine',
    'renderArea', 'renderRadar', 'renderHeatmap', 'renderSparkline', 'renderGauge',
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
  // ── AI 族：behavior 挂到别模块的 slug，kit 入口按此 re-export ──
  'ai-message': ['createAiStream', 'initAiChat'],
  'ai-reasoning': ['createAiStream', 'initAiChat'],
  'ai-files': ['renderAiDiff'],
  'ai-usage': ['renderAiUsage'],
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
  // segmented 无独立 behavior 文件：OTP 等行为在 input.ts
  segmented: 'input',
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
};

/** slug → kit 入口需附加引入的其他 CSS（如 datatable 右键菜单依赖 menu.css）。 */
export const EXTRA_CSS = {
  datatable: ['menu.css'],
  // charts umbrella：引入全部细分类型 CSS，一条 import 拿到所有图表样式
  charts: [
    'chart-line.css', 'chart-bar.css', 'chart-pie.css', 'chart-radar.css',
    'chart-heatmap.css', 'chart-area.css', 'chart-stack.css',
    'chart-gauge.css', 'chart-sparkline.css',
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
};
