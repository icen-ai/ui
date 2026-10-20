// 从 CHANGELOG.md 抽出指定版本的小节，供 publish.yml 建 GitHub Release 时作 notes。
// 小节缺失：默认输出兜底行（不阻断发布）；--strict 时 exit(1)（发版前校验用，
// 逼出「把 [Unreleased] 改名为 [x.y.z]」这一步，避免 Release notes 静默退化）。
// 运行：bun scripts/release-notes.mjs [version] [--strict]（version 缺省取 package.json）
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const version = args.find((a) => !a.startsWith('--')) ?? pkg.version;
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

const lines = changelog.split(/\r?\n/);
// 版本号按字面量匹配：全部正则元字符转义 + 尾部边界（防 0.1.0 命中 0.10.0、0.10.0+build 失配）
const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const head = new RegExp(`^## \\[?v?${esc}\\]?(?=\\s|$)`);
const start = lines.findIndex((l) => head.test(l));
if (start === -1) {
  if (strict) {
    console.error(`✗ CHANGELOG.md 缺少「## [${version}]」小节——发版前请把 [Unreleased] 改名为 [${version}] 并补日期`);
    process.exit(1);
  }
  console.log(`v${version} 发布。详见 CHANGELOG.md 与契约快照 docs/contracts/snapshot.json。`);
} else {
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end === -1) end = lines.length;
  console.log(lines.slice(start + 1, end).join('\n').trim());
}
