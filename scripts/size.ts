// 产物体积预算：dist 关键产物字节数对照 docs/contracts/size-budget.json，超预算 exit(1)。
// 预算即合同——确需扩面时随 PR 提高预算值，diff 可见即评审点。
// 运行：bun run size（须在 bun run build 之后）。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const budget = JSON.parse(readFileSync(join(ROOT, 'docs', 'contracts', 'size-budget.json'), 'utf8')) as { budgets: Record<string, number> };

const fmt = (n: number) => `${(n / 1024).toFixed(1)}KB`;
let failed = false;
const rows = [];

for (const [pattern, limit] of Object.entries(budget.budgets)) {
  /* 通配键必须形如 <dir>/*<ext>（恰好一层）；其余形态一律报错，绝不静默跳过 */
  const globMatch = pattern.includes('*') ? /^([\w-]+)\/(\*[\w.-]+)$/.exec(pattern) : null;
  if (pattern.includes('*') && !globMatch) {
    console.error(`✗ 非法预算键「${pattern}」：通配只支持 <dir>/*<ext>（如 components/*.css）`);
    process.exit(1);
  }
  const files = globMatch
    ? (() => {
        const [, dir, mask] = globMatch;
        const ext = mask.slice(1); // '*<ext>'
        return readdirSync(join(DIST, dir))
          .filter((f) => f.endsWith(ext))
          .map((f) => `${dir}/${f}`);
      })()
    : [pattern];
  for (const rel of files) {
    const p = join(DIST, rel);
    if (!existsSync(p)) {
      rows.push(`✗ ${rel} — 产物缺失`);
      failed = true;
      continue;
    }
    const size = statSync(p).size;
    const over = size > limit;
    if (over) failed = true;
    rows.push(`${over ? '✗' : '✓'} ${rel} — ${fmt(size)} / 预算 ${fmt(limit)}${over ? '（超支）' : ''}`);
  }
}

// 精确预算行全量打印；通配行只打印最大者与超支者，避免 200 行噪音
const exact = rows.filter((r) => !r.includes('components/') && !r.includes('behaviors/'));
const wild = rows.filter((r) => r.includes('components/') || r.includes('behaviors/'));
const wildBad = wild.filter((r) => r.startsWith('✗'));
for (const r of [...exact, ...wildBad]) console.log(r);
console.log(`通配面（components/*.css、behaviors/*.mjs 共 ${wild.length} 个产物）：${wildBad.length ? `${wildBad.length} 个超支` : '全部在预算内'}`);

if (failed) {
  console.error('✗ 体积预算超支：压缩产物，或随 PR 提高 docs/contracts/size-budget.json 并写明理由');
  process.exit(1);
}
console.log('✓ 体积预算全部达标');
