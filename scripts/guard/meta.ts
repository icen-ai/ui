// meta 一致性守卫：数字与版本只能来自构建产物 meta.json（scripts/meta-core.mjs 扫描生成）。
// 检查四面：meta.json 新鲜度（确定性字段）/ package.json 版本与描述 / README 标记同步 / 站点硬编码数量主张。
// 口径与豁免（meta-ok / v0.x 历史叙事 / ${META} 插值）见 meta-core.mjs。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error 纯 JS 模块（.mjs），bun 直跑无类型
import { collectMeta, syncMarkers, scanClaims, checkPkgDescription, ROOT } from '../meta-core.mjs';
import type { GuardResult } from './shared';

interface MetaShape {
  version: string;
  components: number;
  charts: Record<string, number>;
  kb: Record<string, number>;
  tests: { files: Record<string, number>; cases: Record<string, number> };
  size?: unknown;
  [k: string]: unknown;
}

export async function checkMeta(): Promise<GuardResult> {
  const violations: string[] = [];
  const meta = collectMeta(ROOT, { withSize: true }) as MetaShape;

  const metaPath = join(ROOT, 'meta.json');
  if (!existsSync(metaPath)) {
    violations.push('meta.json 不存在——运行 bun scripts/meta.mjs 生成并提交');
  } else {
    const committed = JSON.parse(readFileSync(metaPath, 'utf8')) as MetaShape;
    for (const key of ['version', 'components', 'componentCss', 'behaviors', 'presets', 'primitives', 'tokens', 'aiComponents']) {
      if (committed[key] !== meta[key]) violations.push(`meta.json ${key} = ${committed[key]}，实测 ${meta[key]}（运行 bun scripts/meta.mjs 更新）`);
    }
    for (const key of ['published', 'extensions', 'total']) {
      if (committed.charts?.[key] !== meta.charts[key]) violations.push(`meta.json charts.${key} 与实测 ${meta.charts[key]} 不一致`);
    }
    for (const key of ['domains', 'components']) {
      if (committed.kb?.[key] !== meta.kb[key]) violations.push(`meta.json kb.${key} 与实测 ${meta.kb[key]} 不一致`);
    }
    if (JSON.stringify(committed.tests?.files) !== JSON.stringify(meta.tests.files)) violations.push('meta.json tests.files 与实测不一致');
    if (JSON.stringify(committed.tests?.cases) !== JSON.stringify(meta.tests.cases)) violations.push('meta.json tests.cases 与静态扫描口径不一致');
    if (committed.size && meta.size && JSON.stringify(committed.size) !== JSON.stringify(meta.size)) {
      violations.push('meta.json size 与当前 dist 产物不一致——重新构建后运行 bun scripts/meta.mjs');
    }
  }

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
  if (pkg.version !== meta.version) violations.push(`package.json version ${pkg.version} ≠ meta.json ${meta.version}`);

  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const synced = syncMarkers(readme, meta);
  for (const c of synced.changed) violations.push(`README 标记未同步：${c}（运行 bun scripts/meta.mjs）`);

  for (const v of scanClaims(ROOT)) violations.push(`硬编码数量主张：${v}`);
  for (const v of checkPkgDescription(ROOT, meta)) violations.push(v);

  return { title: 'meta 一致性（数字/版本产物）', violations };
}
