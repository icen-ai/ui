// 生成 meta.json（数字与版本的单一产物）并同步 README 中的 <!-- meta:* --> 标记。
// 运行：bun scripts/meta.mjs           —— 重写 meta.json + 同步 README（构建/发布前执行）
//       bun scripts/meta.mjs --check  —— 只校验不写盘（CI 守卫同口径；dist 缺席时跳过 size 段）
// 口径与豁免规则见 scripts/meta-core.mjs 头注释。
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectMeta, syncMarkers, scanClaims, checkPkgDescription, ROOT } from './meta-core.mjs';

const CHECK = process.argv.includes('--check');
const meta = collectMeta(ROOT, { withSize: true });
const committed = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, 'meta.json'), 'utf8')); } catch { return null; }
})();
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const synced = syncMarkers(readme, meta);

if (!CHECK) {
  writeFileSync(join(ROOT, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  if (synced.changed.length) writeFileSync(join(ROOT, 'README.md'), synced.text);
  console.log(`✓ meta.json 已生成（v${meta.version}）：组件 ${meta.components} / 行为 ${meta.behaviors} / 图表 ${meta.charts.total}（发布 ${meta.charts.published} + 扩展 ${meta.charts.extensions}）/ 令牌 ${meta.tokens} / 测试 ${meta.tests.cases.bun}+${meta.tests.cases.e2e}e2e${meta.size ? ' / 含体积' : ' / 无 dist，跳过体积'}`);
  for (const c of synced.changed) console.log(`  README 标记已同步：${c}`);
  process.exit(0);
}

// --check：比对确定性字段（size 仅在两侧皆有 dist 数据时比对）
let failed = false;
const bad = (msg) => { failed = true; console.error(`  ✗ ${msg}`); };
if (!committed) bad('meta.json 不存在——运行 bun scripts/meta.mjs 生成并提交');
else {
  for (const key of ['version', 'components', 'componentCss', 'behaviors', 'presets', 'primitives', 'tokens', 'aiComponents']) {
    if (committed[key] !== meta[key]) bad(`meta.json ${key} = ${committed[key]}，实测 ${meta[key]}`);
  }
  for (const key of ['published', 'extensions', 'total']) {
    if (committed.charts?.[key] !== meta.charts[key]) bad(`meta.json charts.${key} = ${committed.charts?.[key]}，实测 ${meta.charts[key]}`);
  }
  for (const key of ['domains', 'components']) {
    if (committed.kb?.[key] !== meta.kb[key]) bad(`meta.json kb.${key} = ${committed.kb?.[key]}，实测 ${meta.kb[key]}`);
  }
  if (JSON.stringify(committed.tests?.files) !== JSON.stringify(meta.tests.files)) bad('meta.json tests.files 与实测不一致');
  if (JSON.stringify(committed.tests?.cases) !== JSON.stringify(meta.tests.cases)) bad('meta.json tests.cases 与实测不一致（静态扫描口径）');
  if (committed.size && meta.size && JSON.stringify(committed.size) !== JSON.stringify(meta.size)) bad('meta.json size 与当前 dist 产物不一致——重新构建后运行 bun scripts/meta.mjs');
}
if (synced.changed.length) for (const c of synced.changed) bad(`README 标记未同步：${c}（运行 bun scripts/meta.mjs）`);
for (const v of scanClaims(ROOT)) bad(`硬编码数量主张：${v}`);
for (const v of checkPkgDescription(ROOT, meta)) bad(v);

if (failed) {
  console.error('✗ meta 一致性检查未通过');
  process.exit(1);
}
console.log('✓ meta 一致性检查通过（meta.json / README 标记 / 站点数量主张 / package.json 版本描述）');
