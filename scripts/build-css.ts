// 构建 CSS 产物：拷贝 src 的 css 到 dist，拼合 tokens.css / ui.css，生成 registry.json
// 另生成：kit 一行入口 dist/components/<slug>.mjs（import css + re-export behavior）与 CLI（dist/cli.mjs）
// 运行：bun scripts/build-css.ts（在 tsup 之后执行）
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUGS, SLUG_INIT, SLUG_EXPORTS, EXTRA_CSS, cssOf } from './slugs.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

// 进 tokens.css 拼合的核心 token 文件（按此顺序串接）
const TOKEN_ORDER = ['colors.css', 'style-profiles.css', 'typography.css'];
// 可选 token 文件：单独拷贝、暴露 exports，但不进 tokens.css / ui.css 默认拼合
const TOKEN_EXTRAS = ['retro-effects.css'];

async function readSrc(p: string) {
  return readFile(join(SRC, p), 'utf8');
}

await mkdir(join(DIST, 'tokens'), { recursive: true });
await mkdir(join(DIST, 'components'), { recursive: true });

// 1. tokens：按固定顺序拼合 + 单独拷贝
let tokensOut = '/* @icen.ai/ui — tokens（colors + style-profiles + typography） */\n';
for (const f of TOKEN_ORDER) {
  const css = await readSrc(join('tokens', f));
  await writeFile(join(DIST, 'tokens', f), css);
  tokensOut += `\n/* ── tokens/${f} ── */\n${css}\n`;
}
await writeFile(join(DIST, 'tokens.css'), tokensOut);

// 1b. token extras：按需引入的独立 token 层（如 retro-effects.css）
for (const f of TOKEN_EXTRAS) {
  const css = await readSrc(join('tokens', f));
  await writeFile(join(DIST, 'tokens', f), css);
  // 同时暴露到 dist 根，便于 `import '@icen.ai/ui/retro-effects.css'`
  await writeFile(join(DIST, f), css);
}

// 2. base
const base = await readSrc('base.css');
await writeFile(join(DIST, 'base.css'), base);

// 3. components：逐个拷贝 + 全部拼进 ui.css
const compFiles = (await readdir(join(SRC, 'components'))).filter(f => f.endsWith('.css')).sort();
let uiOut = tokensOut + '\n/* ── base.css ── */\n' + base + '\n';
const components: string[] = [];
for (const f of compFiles) {
  const css = await readSrc(join('components', f));
  await writeFile(join(DIST, 'components', f), css);
  uiOut += `\n/* ── components/${f} ── */\n${css}\n`;
  components.push(f.replace(/\.css$/, ''));
}
await writeFile(join(DIST, 'ui.css'), uiOut);

// 3b. kit 一行入口：dist/components/<slug>.mjs = import css + re-export behavior（有的话）
//     消费侧 `import '@icen.ai/ui/kit/<slug>'` 即可，无需知道内部 CSS 合并文件名。
const behaviorSet = new Set(
  (await readdir(join(SRC, 'behaviors'))).filter(f => f.endsWith('.ts')).map(f => f.replace(/\.ts$/, '')),
);
const slugsRegistry: Record<string, { css: string; extraCss?: string[]; behavior?: string; init?: string; exports?: string[] }> = {};
for (const slug of SLUGS) {
  const css = cssOf(slug);
  const extra = EXTRA_CSS[slug] ?? [];
  const hasBehavior = behaviorSet.has(slug);
  const init = SLUG_INIT[slug];
  const lines = [`// @icen.ai/ui — kit: ${slug}（CSS + behavior 一行入口；构建产物，勿手改）`, `import './${css}';`];
  for (const e of extra) lines.push(`import './${e}';`);
  if (hasBehavior) lines.push(`export * from '../behaviors/${slug}.mjs';`);
  await writeFile(join(DIST, 'components', `${slug}.mjs`), lines.join('\n') + '\n');
  slugsRegistry[slug] = {
    css,
    ...(extra.length ? { extraCss: extra } : {}),
    ...(hasBehavior ? { behavior: slug } : {}),
    ...(init ? { init } : {}),
    ...(SLUG_EXPORTS[slug] ? { exports: SLUG_EXPORTS[slug] } : {}),
  };
}

// 4. registry.json（cli / 文档站消费）
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const behaviorFiles = (await readdir(join(SRC, 'behaviors'))).filter(f => f.endsWith('.ts')).sort();
await writeFile(join(DIST, 'registry.json'), JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  tokens: TOKEN_ORDER,
  tokensExtras: TOKEN_EXTRAS,
  base: 'base.css',
  components,
  behaviors: behaviorFiles.map(f => f.replace(/\.ts$/, '')),
  slugs: slugsRegistry,
}, null, 2) + '\n');

// 5. CLI（bunx @icen.ai/ui add <slug>）：纯 node 标准库，直接拷贝
await writeFile(join(DIST, 'cli.mjs'), await readFile(join(ROOT, 'scripts', 'cli.mjs'), 'utf8'));

console.log(
  `build-css: ${TOKEN_ORDER.length} tokens + ${TOKEN_EXTRAS.length} extras + base + ${components.length} components + ${SLUGS.length} kit 入口 → dist/`,
);

