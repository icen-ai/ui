// registry 一致性守卫：scripts/slugs.mjs（kit 入口 / CLI / 文档站的事实源）与 src/ 实物对齐。
// 与 scripts/build-css.ts 的 assertSrc 存在性防御对齐，并额外校验 kit 会 re-export 的
// init 函数名 / 导出函数名真实存在（拼错不会编译期报错，只会产出坏 kit 入口）。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EXTRA_CSS, SLUGS, SLUG_BEHAVIOR, SLUG_EXPORTS, SLUG_INIT, cssOf } from '../slugs.mjs';
import { SRC, listFiles, type GuardResult } from './shared';

/** 在 behavior 模块源码里确认导出名（函数/常量声明或 {} re-export 均可）。 */
function exportsName(src: string, name: string): boolean {
  const decl = new RegExp(`\\bexport\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+${name}\\b`);
  const reExport = new RegExp(`\\bexport\\s*\\{[^}]*\\b${name}\\b`);
  return decl.test(src) || reExport.test(src);
}

/** SLUG_INIT 映射缺口豁免（slug → init 函数真实所在模块）。
 *  slugs.mjs 的 SLUG_BEHAVIOR 已登记跨模块映射（ai-tool-call/ai-subagent→ai-tool、
 *  ai-todo/ai-context→ai-panel），本表清空仅留结构——新增豁免须附原因注释。 */
const INIT_MODULE_DRIFT: Record<string, string> = {};

export async function checkRegistry(): Promise<GuardResult> {
  const violations: string[] = [];
  const behaviorFiles = new Set(await listFiles(join(SRC, 'behaviors'), '.ts'));
  const compFiles = new Set(await listFiles(join(SRC, 'components'), '.css'));

  for (const slug of SLUGS) {
    /* 主 CSS（MERGED_CSS 经 cssOf 归一）与 EXTRA_CSS 附加 CSS 必须存在（对齐 assertSrc） */
    const css = cssOf(slug);
    if (!compFiles.has(css)) violations.push(`kit/${slug}: 主 CSS src/components/${css} 不存在`);
    for (const extra of EXTRA_CSS[slug] ?? []) {
      if (!compFiles.has(extra)) violations.push(`kit/${slug}: 附加 CSS src/components/${extra} 不存在`);
    }

    /* behavior 模块存在性（SLUG_BEHAVIOR 显式映射优先，缺省与 slug 同名） */
    const behaviorMod = SLUG_BEHAVIOR[slug] ?? null;
    const ownBehavior = !behaviorMod && behaviorFiles.has(`${slug}.ts`);
    if (behaviorMod && !behaviorFiles.has(`${behaviorMod}.ts`)) {
      violations.push(`kit/${slug}: behavior 模块 src/behaviors/${behaviorMod}.ts 不存在`);
    }

    /* SLUG_INIT 的 init 函数必须真的从对应 behavior 模块导出 */
    const init = SLUG_INIT[slug];
    if (init) {
      const mod = behaviorMod ?? (ownBehavior ? slug : INIT_MODULE_DRIFT[slug] ?? null);
      if (!mod) {
        violations.push(`kit/${slug}: SLUG_INIT=${init} 但没有可承载的 behavior 模块`);
      } else if (!behaviorFiles.has(`${mod}.ts`)) {
        violations.push(`kit/${slug}: init 函数 ${init} 的 behavior 模块 src/behaviors/${mod}.ts 不存在`);
      } else {
        const src = await readFile(join(SRC, 'behaviors', `${mod}.ts`), 'utf8');
        if (!exportsName(src, init)) {
          violations.push(`kit/${slug}: init 函数 ${init} 未从 src/behaviors/${mod}.ts 导出`);
        }
      }
    }

    /* SLUG_EXPORTS 的 re-export 名单必须真实存在（kit 入口直接 re-export 这些名字） */
    const exports = SLUG_EXPORTS[slug];
    if (exports) {
      const mod = behaviorMod ?? (ownBehavior ? slug : INIT_MODULE_DRIFT[slug] ?? null);
      if (!mod) {
        violations.push(`kit/${slug}: SLUG_EXPORTS 有 ${exports.length} 个名字但没有 behavior 模块可导出`);
      } else if (!behaviorFiles.has(`${mod}.ts`)) {
        violations.push(`kit/${slug}: SLUG_EXPORTS 的 behavior 模块 src/behaviors/${mod}.ts 不存在`);
      } else {
        const src = await readFile(join(SRC, 'behaviors', `${mod}.ts`), 'utf8');
        for (const name of exports) {
          if (!exportsName(src, name)) {
            violations.push(`kit/${slug}: re-export ${name} 未从 src/behaviors/${mod}.ts 导出`);
          }
        }
      }
    }
  }

  return { title: `registry 一致性（${SLUGS.length} 个 slug × css / behavior / init / exports）`, violations };
}
