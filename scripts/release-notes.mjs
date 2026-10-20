// 从 CHANGELOG.md 抽出指定版本的小节，供 publish.yml 建 GitHub Release 时作 notes。
// 小节缺失时兜底输出一行通用说明（不阻断发布）。
// 运行：bun scripts/release-notes.mjs [version]（缺省取 package.json version）
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = process.argv[2] ?? pkg.version;
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

const lines = changelog.split(/\r?\n/);
const head = new RegExp(`^## \\[?${version.replaceAll('.', '\\.')}\\]?`);
const start = lines.findIndex((l) => head.test(l));
if (start === -1) {
  console.log(`v${version} 发布。详见 CHANGELOG.md 与契约快照 docs/contracts/snapshot.json。`);
} else {
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end === -1) end = lines.length;
  console.log(lines.slice(start + 1, end).join('\n').trim());
}
