// slug → 公共接口（exports / events）索引：事实源 = slugs.mjs 登记表 + 行为源码扫描。
// 被三处消费：build-css.ts（registry.json 的 api 面）、文档站（组件页「接口」区块）、contracts 分层 diff。
// 纯 node 标准库，无构建依赖——site（vite）与 scripts（bun）都可直引。
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUGS, SLUG_INIT, SLUG_EXPORTS, SLUG_BEHAVIOR } from './slugs.mjs';

/* 仓库根定位：脚本直跑时 import.meta.url 可靠；被 Astro/vite 打包后模块 URL 失真，
   退化为从 cwd 向上找「src/behaviors + scripts/slugs.mjs」标记。 */
function findRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, '..'), process.cwd(), join(process.cwd(), '..'), join(here, '..', '..')];
  for (const c of candidates) {
    if (existsSync(join(c, 'src', 'behaviors')) && existsSync(join(c, 'scripts', 'slugs.mjs'))) return c;
  }
  return join(here, '..');
}
const ROOT = findRoot();

/** 行为模块源码（带缓存；不存在返回 null——存在性由 registry 守卫另行把关）。 */
const modSrcCache = new Map();
function behaviorSrc(mod) {
  if (mod == null) return null;
  if (!modSrcCache.has(mod)) {
    const p = join(ROOT, 'src', 'behaviors', `${mod}.ts`);
    modSrcCache.set(mod, existsSync(p) ? readFileSync(p, 'utf8') : null);
  }
  return modSrcCache.get(mod);
}

/** 模块的运行时导出名（扫 export 声明；type/interface 是纯类型不进运行时面——类型真相在 d.mts）。 */
function moduleExports(mod) {
  const src = behaviorSrc(mod);
  if (!src) return [];
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|class|let|enum)\s+(\w+)/g)) names.add(m[1]);
  return [...names].sort();
}

/** 模块源码里带引号的 icen:* 事件字面量（emitIcen 派发面；登记完整性由事件守卫把关）。 */
function moduleEvents(mod) {
  const src = behaviorSrc(mod);
  if (!src) return [];
  return [...new Set([...src.matchAll(/['"`](icen:[a-z0-9-]+)['"`]/g)].map((m) => m[1]))].sort();
}

/** slug 的 behavior 模块名（SLUG_BEHAVIOR 映射优先，缺省与 slug 同名；无模块返回 null）。 */
export function behaviorOf(slug) {
  const mapped = SLUG_BEHAVIOR[slug];
  if (mapped) return mapped;
  return existsSync(join(ROOT, 'src', 'behaviors', `${slug}.ts`)) ? slug : null;
}

/** 一个模块被多少个 slug 共享（共享模块的事件清单带族内事件，站点展示时标注）。 */
const modUseCount = (() => {
  const counts = new Map();
  for (const s of SLUGS) {
    const m = behaviorOf(s);
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return counts;
})();

/**
 * slug → { behavior, init, exports, events, sharedModule }。
 * exports：SLUG_EXPORTS 显式清单优先；ownBehavior 且无显式清单时扫模块导出全量。
 */
export function slugApi(slug) {
  const behavior = behaviorOf(slug);
  const explicit = SLUG_EXPORTS[slug];
  return {
    behavior,
    init: SLUG_INIT[slug] ?? null,
    exports: explicit ?? (behavior ? moduleExports(behavior) : []),
    events: behavior ? moduleEvents(behavior) : [],
    sharedModule: behavior ? (modUseCount.get(behavior) ?? 0) > 1 : false,
  };
}

/** 全量索引（registry.json 与站点共用同一份）。 */
export function allSlugApi() {
  return Object.fromEntries(SLUGS.map((s) => [s, slugApi(s)]));
}
