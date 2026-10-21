// meta.json 的单一事实源：从源码扫描统计，任何数字不得手写。
// 被三处消费：scripts/meta.mjs（CLI，写 meta.json / 同步 README 标记）、
//             scripts/guard/meta.ts（CI 守卫，--check 口径）、
//             site（经 site/src/lib/meta.ts 直接 import 根 meta.json）。
// 统计口径全部写在本文件注释里——数字可复算，口径可评审。
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { SLUGS, EXTRA_CSS } from './slugs.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const read = (root, rel) => readFileSync(join(root, rel), 'utf8');
const listDir = (root, rel, match) =>
  readdirSync(join(root, rel)).filter((f) => match.test(f)).sort();

/** 从 charts.ts 抽取已发布 ChartType 联合 + graph/map 扩展（断言登记的两种）。 */
export function extractChartTypes(root = ROOT) {
  const src = read(root, 'src/behaviors/charts.ts');
  const union = /export type ChartType =([\s\S]*?);/.exec(src);
  if (!union) throw new Error('charts.ts 中未找到 ChartType 联合');
  const published = [...union[1].matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
  const extensions = [];
  for (const id of ['GRAPH', 'MAP']) {
    const m = new RegExp(`const ${id}_CHART_TYPE = '([\\w-]+)'`).exec(src);
    if (m) extensions.push(m[1]);
  }
  return { published, extensions };
}

/** 原语集合：tokens 目录里 data-icen-style="x" 去重 + modern 缺省（design.ts 回退值）。 */
export function extractPrimitives(root = ROOT) {
  const styles = new Set(['modern']);
  for (const f of listDir(root, 'src/tokens', /\.css$/)) {
    for (const m of read(root, `src/tokens/${f}`).matchAll(/data-icen-style="([\w-]+)"/g)) styles.add(m[1]);
  }
  return [...styles].sort();
}

/** 测试统计口径：静态扫描 *.test.ts(x) / *.pw.ts 文件数 + test(/it( 调用点数。
    与 `bun test` 实跑数会有差（跳过/参数化用例），故记录 method 字段供核验。 */
export function collectTests(root = ROOT) {
  const caseCount = (files) =>
    files.reduce((n, rel) => n + (read(root, rel).match(/(?:^|[\s;])(?:test|it)\s*\(/gm) ?? []).length, 0);
  const unit = listDir(root, 'tests/unit', /\.test\.ts$/).map((f) => `tests/unit/${f}`);
  const dom = listDir(root, 'tests/dom', /\.test\.tsx?$/).map((f) => `tests/dom/${f}`);
  const conformance = listDir(root, 'tests/conformance', /\.test\.ts$/).map((f) => `tests/conformance/${f}`);
  const rootTests = listDir(root, 'tests', /\.test\.ts$/).map((f) => `tests/${f}`);
  const e2e = listDir(root, 'tests/e2e', /\.pw\.ts$/).map((f) => `tests/e2e/${f}`);
  return {
    method: 'static-scan(test/it call sites; runner 实跑数以 bun test / playwright 输出为准)',
    files: { unit: unit.length, dom: dom.length, conformance: conformance.length, root: rootTests.length, e2e: e2e.length },
    cases: { bun: caseCount([...unit, ...dom, ...conformance, ...rootTests]), e2e: caseCount(e2e) },
  };
}

/** 令牌口径：src/tokens/*.css + src/base.css 中 `--icen-*:` 定义数（含各预设/原语的重定义块）。 */
export function countTokens(root = ROOT) {
  const files = [...listDir(root, 'src/tokens', /\.css$/).map((f) => `src/tokens/${f}`), 'src/base.css'];
  return files.reduce((n, rel) => n + (read(root, rel).match(/^\s*--icen-[\w-]+\s*:/gm) ?? []).length, 0);
}

const gz = (buf) => gzipSync(buf).length;

/** 关键产物体积（原始 + gzip 字节）；dist 不存在时返回 null（check 模式跳过该段比对）。 */
export function collectSize(root = ROOT) {
  const dist = join(root, 'dist');
  if (!existsSync(dist)) return null;
  const out = {};
  for (const rel of ['ui.css', 'tokens.css', 'base.css', 'index.mjs', 'react.mjs', 'vue.mjs']) {
    const p = join(dist, rel);
    if (!existsSync(p)) continue;
    const buf = readFileSync(p);
    out[rel.replace(/\.(css|mjs)$/, '')] = { raw: statSync(p).size, gzip: gz(buf) };
  }
  return Object.keys(out).length ? out : null;
}

/** 全量统计。withSize=false 用于 CI 守卫（构建前无 dist，保证确定性）。 */
export function collectMeta(root = ROOT, { withSize = true } = {}) {
  const pkg = JSON.parse(read(root, 'package.json'));
  const charts = extractChartTypes(root);
  const kbDomains = new Set(
    Object.values(EXTRA_CSS).flat().filter((f) => /^kb-.+\.css$/.test(f)),
  );
  const meta = {
    version: pkg.version,
    components: SLUGS.length,
    componentCss: listDir(root, 'src/components', /\.css$/).length,
    behaviors: listDir(root, 'src/behaviors', /\.ts$/).length,
    charts: {
      published: charts.published.length,
      extensions: charts.extensions.length,
      total: charts.published.length + charts.extensions.length,
      types: [...charts.published, ...charts.extensions],
    },
    presets: JSON.parse(read(root, 'src/tokens/themes.json')).length,
    primitives: extractPrimitives(root).length,
    tokens: countTokens(root),
    kb: { domains: kbDomains.size, components: SLUGS.filter((s) => s.startsWith('kb-')).length },
    aiComponents: SLUGS.filter((s) => s.startsWith('ai-')).length,
    tests: collectTests(root),
  };
  if (withSize) {
    const size = collectSize(root);
    if (size) meta.size = size;
  }
  return meta;
}

// ─── 标记同步：<!-- meta:key -->值<!-- /meta:key --> ───

export function resolveKey(meta, key) {
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), meta);
}

/** 替换文本中全部 meta 标记的 innerText；返回 { text, changed: string[] }。 */
export function syncMarkers(text, meta) {
  const changed = [];
  const out = text.replace(
    /<!--\s*meta:([\w.]+)\s*-->([\s\S]*?)<!--\s*\/meta:\1\s*-->/g,
    (whole, key, inner) => {
      const v = resolveKey(meta, key);
      if (v == null) throw new Error(`未知 meta 标记：${key}`);
      const next = String(v);
      if (inner !== next) changed.push(`${key}: ${inner} → ${next}`);
      return `<!-- meta:${key} -->${next}<!-- /meta:${key} -->`;
    },
  );
  return { text: out, changed };
}

// ─── 硬编码数字守卫口径 ───

/** 受扫文件（README + 站点文案层；demo 叙事用 meta-ok 行内豁免）。 */
export const CLAIM_SCAN_FILES = [
  'README.md',
  'site/src/lib/site-i18n.ts',
  'site/src/lib/site-i18n-en.ts',
  'site/src/lib/components.ts',
  'site/src/lib/kb-docs-ground-ingest.ts',
  'site/src/lib/kb-docs-ops-agent.ts',
  'site/src/lib/kb-docs-perm.ts',
  'site/src/lib/kb-docs-search-data.ts',
  'site/src/pages/customize.astro',
  'site/src/pages/index.astro',
];

/**
 * 硬编码数量主张的模式。命中即违规，除非该行满足任一豁免：
 *  - 含 `meta-ok`（历史叙事/demo 文案，需注明原因）
 *  - 含 `<!-- meta:`（README 标记，值由 syncMarkers 保证）
 *  - 含 `${META`（站点构建期插值）
 *  - 含 `v0.` 版本号或 `版本 0.`（历史时间线 / demo 发版叙事）
 */
export const CLAIM_PATTERNS = [
  /\d+\s*个组件/,
  /[一二三四五六七八九十]+\s*域\s*\d+\s*个组件/,
  /(\d+|十[一二三四五六七八九]?)\s*种图(型)?/,
  /[一二三四五六七八九十]+\s*套(主题|预设)/,
  /\d+\s*chart types/i,
];

export const CLAIM_ESCAPES = [/meta-ok/, /<!--\s*meta:/, /\$\{META\./, /v0\.\d/, /版本 0\.\d/];

/** 扫描硬编码主张，返回违规行描述数组（空 = 通过）。 */
export function scanClaims(root = ROOT) {
  const violations = [];
  for (const rel of CLAIM_SCAN_FILES) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    read(root, rel).split('\n').forEach((line, i) => {
      if (!CLAIM_PATTERNS.some((re) => re.test(line))) return;
      if (CLAIM_ESCAPES.some((re) => re.test(line))) return;
      violations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  return violations;
}

/** package.json description 中的「N 主题 × M 原语」必须与统计一致。 */
export function checkPkgDescription(root = ROOT, meta) {
  const pkg = JSON.parse(read(root, 'package.json'));
  const m = /(\d+)\s*主题\s*×\s*(\d+)\s*原语/.exec(pkg.description ?? '');
  if (!m) return [];
  const bad = [];
  if (Number(m[1]) !== meta.presets) bad.push(`package.json description 主题数 ${m[1]} ≠ 实测 ${meta.presets}`);
  if (Number(m[2]) !== meta.primitives) bad.push(`package.json description 原语数 ${m[2]} ≠ 实测 ${meta.primitives}`);
  return bad;
}
