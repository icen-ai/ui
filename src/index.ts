/*
 * @icen.ai/ui — 包入口：版本号 + 全部行为 JS（无框架、无依赖、浏览器环境）
 * 版本号构建期从 package.json 内联（单一事实源，发布指南纪律）
 */

import pkg from '../package.json' with { type: 'json' };

export const VERSION = pkg.version;

export * from './behaviors/theme';
export * from './behaviors/events';
export * from './behaviors/toast';
export * from './behaviors/tabs';
export * from './behaviors/copy';
export * from './behaviors/input';
/* controls 具名导出：模块内为 kit/segmented 转发的 initInput 若走 export * 会与
   input 的同名导出构成 ESM 歧义名（被静默剔除），故逐个具名带出 */
export {
  initSwitch, initStepper, initSegmented, initSteps, initRating, initPagination, initTableSort,
} from './behaviors/controls';
export * from './behaviors/select';
export * from './behaviors/slider';
export * from './behaviors/tag-input';
export * from './behaviors/upload';
export * from './behaviors/modal';
export * from './behaviors/dropdown';
export * from './behaviors/context-menu';
export * from './behaviors/popover';
export * from './behaviors/accordion';
export * from './behaviors/tree';
export * from './behaviors/carousel';
export * from './behaviors/charts';
export * from './behaviors/nav';
export * from './behaviors/sidebar';
export * from './behaviors/notification';
export * from './behaviors/back-top';
export * from './behaviors/command-palette';
export * from './behaviors/date-picker';
export * from './behaviors/split-pane';
export * from './behaviors/datatable';
export * from './behaviors/ai-core';
export * from './behaviors/ai-chat';
export * from './behaviors/ai-composer';
export * from './behaviors/ai-tool';
export * from './behaviors/ai-diff';
export * from './behaviors/ai-panel';
export * from './behaviors/ai-provider';
export * from './behaviors/ai-tools';
