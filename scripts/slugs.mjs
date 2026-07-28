// 组件 slug → CSS 文件 / behavior init 映射 —— kit 入口与 CLI 的单一事实源。
// 被三处消费：scripts/build-css.ts（生成 dist/components/<slug>.mjs 与 registry.json）、
//             scripts/cli.mjs（bunx @icen.ai/ui add <slug>）、文档站 site/src/lib/components.ts。
// 新增组件时在此登记 slug；CSS 合并文件（content/feedback/media/menu）在 MERGED_CSS 维护。

/** 全部组件 slug（顺序即文档站侧栏顺序，仅供 CLI list 展示）。 */
export const SLUGS = [
  // 基础
  'btn', 'panel', 'pill', 'tabs', 'stat', 'table', 'toast',
  // 表单
  'input', 'select', 'slider', 'tag-input', 'switch', 'segmented', 'upload',
  // 浮层
  'modal', 'dropdown', 'context-menu', 'popover', 'tooltip',
  // 数据
  'card', 'empty', 'alert', 'result', 'progress', 'spinner', 'skeleton',
  'avatar', 'media-card', 'rating', 'kbd', 'list', 'accordion',
  'timeline', 'desc', 'tree', 'carousel', 'charts', 'datatable',
  // 导航
  'nav', 'sidebar', 'breadcrumb', 'pagination', 'steps', 'layout',
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
};

/** slug → behavior 的 init 函数名（有 init 契约的组件）。 */
export const SLUG_INIT = {
  accordion: 'initAccordion',
  carousel: 'initCarousel',
  'context-menu': 'initContextMenu',
  dropdown: 'initDropdown',
  input: 'initInput',
  modal: 'initModal',
  nav: 'initNav',
  select: 'initSelect',
  sidebar: 'initSidebar',
  slider: 'initSlider',
  tabs: 'initTabs',
  'tag-input': 'initTagInput',
  tree: 'initTree',
  upload: 'initUpload',
};

/** 有 behavior 但无 init（函数式 API）的 slug → 导出函数提示（CLI 输出用）。 */
export const SLUG_EXPORTS = {
  toast: ['toast'],
  popover: ['openPopover', 'closePopover', 'computePopoverLayout'],
  charts: [
    'renderVBar', 'renderHBar', 'renderStack', 'renderDonut', 'renderLine',
    'renderHeatmap', 'renderSparkline', 'renderGauge',
  ],
  datatable: ['createTable'],
};

/** slug → 对应组件 CSS 文件名。 */
export function cssOf(slug) {
  return MERGED_CSS[slug] ?? `${slug}.css`;
}

/** slug → kit 入口需附加引入的其他 CSS（如 datatable 右键菜单依赖 menu.css）。 */
export const EXTRA_CSS = {
  datatable: ['menu.css'],
};
