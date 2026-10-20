// 契约破坏 ⇒ CHANGELOG 联动（CI，仅 PR）：snapshot.json 出现破坏性条目（移除/签名变化）时，
// CHANGELOG.md 必须在同一 PR 有改动——把「破坏性变更逐条公告」从自觉变成机器检查。
// 运行：bun scripts/changelog-linkage.ts <baseRef>（如 origin/main）
import { execFileSync } from 'node:child_process';
import { diffSnapshots, snapshotAt } from './contracts';

const base = process.argv[2];
if (!base) {
  console.error('用法：bun scripts/changelog-linkage.ts <baseRef>');
  process.exit(2);
}

const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

let baseSha: string;
try {
  baseSha = git(['merge-base', base, 'HEAD']);
} catch {
  console.error(`✗ 找不到 ${base} 与 HEAD 的共同祖先——CI 需要 fetch-depth: 0`);
  process.exit(2);
}

const changed = git(['diff', '--name-only', `${baseSha}...HEAD`]).split('\n').filter(Boolean);
const snapTouched = changed.includes('docs/contracts/snapshot.json');
if (!snapTouched) {
  console.log('✓ 契约快照未变更，无需联动检查');
  process.exit(0);
}

const rows = await diffSnapshots(await snapshotAt(baseSha), await snapshotAt('HEAD'));
const breaking = rows.filter((r) => r.kind !== 'added');
if (!breaking.length) {
  console.log(`✓ 快照仅新增 ${rows.length} 项（additive 留痕于快照本身），无破坏性条目`);
  process.exit(0);
}
if (changed.includes('CHANGELOG.md')) {
  console.log(`✓ 快照含 ${breaking.length} 项破坏性条目，CHANGELOG.md 已同 PR 改动`);
  process.exit(0);
}
console.error(`✗ 契约快照含 ${breaking.length} 项破坏性条目（移除/签名变化），但 CHANGELOG.md 未随本 PR 改动`);
for (const r of breaking.slice(0, 10)) console.error(`    - [${r.tier}] ${r.face}: ${r.entry}`);
console.error('    按 docs/versioning.md：破坏性变更只进 minor，且在 CHANGELOG 逐条公告');
process.exit(1);
