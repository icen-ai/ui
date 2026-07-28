/*
 * @icen.ai/ui — 包入口：版本号 + 全部行为 JS（无框架、无依赖、浏览器环境）
 * 版本号构建期从 package.json 内联（单一事实源，发布指南纪律）
 */

import pkg from '../package.json' with { type: 'json' };

export const VERSION = pkg.version;

export * from './behaviors/theme';
export * from './behaviors/toast';
export * from './behaviors/tabs';
export * from './behaviors/copy';
