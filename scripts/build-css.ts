// 构建 CSS 产物：拷贝 src 的 css 到 dist，拼合 tokens.css / ui.css，生成 registry.json
// 另生成：kit 一行入口 dist/components/<slug>.mjs（import css + re-export behavior）与 CLI（dist/cli.mjs）
// 全部产物包进 cascade layers（@layer icen.tokens/base/components）——消费方无层样式
// 永远赢库样式（可覆盖性保证），库内部不再有优先级战争；层序由 tokens.css 顶部声明锚定。
// 运行：bun scripts/build-css.ts（在 tsup 之后执行）
import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUGS, SLUG_INIT, SLUG_EXPORTS, SLUG_BEHAVIOR, EXTRA_CSS, cssOf } from './slugs.mjs';
import { slugApi } from './slug-api.mjs';
import { generateIconMasks } from './icon-masks';
import { generateThemeColors } from './theme-colors.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

// 进 tokens.css 拼合的核心 token 文件（按此顺序串接）
const TOKEN_ORDER = ['colors.css', 'style-profiles.css', 'typography.css', 'design.css', 'chinese.css', 'soviet.css', 'pixel.css', 'icon-masks.css'];
// 可选 token 文件：单独拷贝、暴露 exports，但不进 tokens.css / ui.css 默认拼合
const TOKEN_EXTRAS: string[] = [];

/* cascade layer 契约：层序声明必须出现在任何样式之前（tokens.css/ui.css 顶部） */
const LAYER_ORDER = '@layer icen.tokens, icen.base, icen.components;';
const inLayer = (layer: string, css: string) => `@layer ${layer} {\n${css}\n}\n`;

async function readSrc(p: string) {
  return readFile(join(SRC, p), 'utf8');
}

await mkdir(join(DIST, 'tokens'), { recursive: true });
await mkdir(join(DIST, 'components'), { recursive: true });
await generateThemeColors();
await generateIconMasks();
await writeFile(join(DIST,'tokens','themes.json'),await readSrc('tokens/themes.json'));

// 1. tokens：按固定顺序拼合 + 单独拷贝
let tokensBody = '';
for (const f of TOKEN_ORDER) {
  const css = await readSrc(join('tokens', f));
  await writeFile(join(DIST, 'tokens', f), inLayer('icen.tokens', css));
  tokensBody += `\n/* ── tokens/${f} ── */\n${css}\n`;
}
// Opt-in material adapters accompany tokens even for individual kit imports.
// Input is a foundation, including fields composed inside portalled components.
// Shipping the same CSS here prevents kit-only consumers from getting naked inner inputs.
const materialCss = (await Promise.all(['material.css', 'material-chinese.css', 'material-soviet.css', 'icon.css', 'input.css'].map(f => readSrc(`components/${f}`)))).join('\n');
const tokensOut = `/* @icen.ai/ui — tokens + opt-in design materials */\n${LAYER_ORDER}\n${inLayer('icen.tokens', tokensBody)}\n${inLayer('icen.components', materialCss)}`;
const bundledTokens = tokensOut.replaceAll("url('../fonts/", "url('./fonts/");
await writeFile(join(DIST, 'tokens.css'), bundledTokens);
// Self-hosted, licensed font. Preserve the URL both in tokens/*.css and the bundle.
async function copyFontTree(source: string, target: string): Promise<void> {
  await mkdir(target, {recursive:true});
  for (const entry of await readdir(source,{withFileTypes:true})) {
    const from=join(source,entry.name), to=join(target,entry.name);
    if(entry.isDirectory()) await copyFontTree(from,to);
    else await writeFile(to,await readFile(from));
  }
}
await copyFontTree(join(SRC,'fonts'),join(DIST,'fonts'));

// 1b. token extras：按需引入的独立 token 层
for (const f of TOKEN_EXTRAS) {
  const css = await readSrc(join('tokens', f));
  await writeFile(join(DIST, 'tokens', f), inLayer('icen.components', css));
  // 同时暴露到 dist 根，便于 `import '@icen.ai/ui/retro-effects.css'`
  await writeFile(join(DIST, f), inLayer('icen.components', css));
}

// 2. base
const base = await readSrc('base.css');
await writeFile(join(DIST, 'base.css'), inLayer('icen.base', base));

// 3. components：逐个拷贝 + 全部拼进 ui.css
const compFiles = (await readdir(join(SRC, 'components'))).filter(f => f.endsWith('.css')).sort();
let compBody = '';
const components: string[] = [];
for (const f of compFiles) {
  const css = await readSrc(join('components', f));
  await writeFile(join(DIST, 'components', f), inLayer('icen.components', css));
  compBody += `\n/* ── components/${f} ── */\n${css}\n`;
  components.push(f.replace(/\.css$/, ''));
}
const uiOut = `/* @icen.ai/ui — 全量（tokens + base + components） */\n${LAYER_ORDER}\n`
  + inLayer('icen.tokens', tokensBody)
  + inLayer('icen.base', `\n/* ── base.css ── */\n${base}\n`)
  + inLayer('icen.components', compBody);
await writeFile(join(DIST, 'ui.css'), uiOut.replaceAll("url('../fonts/", "url('./fonts/"));

// 3b. kit 一行入口：dist/components/<slug>.mjs = import css + re-export behavior（有的话）
//     消费侧 `import '@icen.ai/ui/kit/<slug>'` 即可，无需知道内部 CSS 合并文件名。
//     图表细分类型（chart-line 等）behavior 模块为 charts.ts，仅导出该类型的渲染函数。
const behaviorSet = new Set(
  (await readdir(join(SRC, 'behaviors'))).filter(f => f.endsWith('.ts')).map(f => f.replace(/\.ts$/, '')),
);
// 存在性防御：kit 入口 import 的文件必须真实存在，否则 throw（chart-calendar 曾静默指向不存在的 css）
async function assertSrc(rel: string, what: string) {
  try {
    await access(join(SRC, rel));
  } catch {
    throw new Error(`build-css: ${what} 不存在 → src/${rel}（检查 scripts/slugs.mjs 的映射，勿产出坏 kit 入口）`);
  }
}
const slugsRegistry: Record<string, { css: string; extraCss?: string[]; behavior?: string; init?: string; exports?: string[]; events?: string[] }> = {};
for (const slug of SLUGS) {
  const css = cssOf(slug);
  const extra = EXTRA_CSS[slug] ?? [];
  await assertSrc(join('components', css), `kit/${slug} 的主 CSS`);
  for (const e of extra) await assertSrc(join('components', e), `kit/${slug} 的附加 CSS`);
  const behaviorMod = SLUG_BEHAVIOR?.[slug] ?? null;
  const ownBehavior = !behaviorMod && behaviorSet.has(slug);
  if (behaviorMod) await assertSrc(join('behaviors', `${behaviorMod}.ts`), `kit/${slug} 的 behavior 模块`);
  const init = SLUG_INIT[slug];
  const explicitExports = behaviorMod ? SLUG_EXPORTS[slug] : null;
  const lines = [`// @icen.ai/ui — kit: ${slug}（CSS + behavior 一行入口；构建产物，勿手改）`, `import './${css}';`];
  for (const e of extra) lines.push(`import './${e}';`);
  if (behaviorMod && explicitExports) {
    lines.push(`export { ${explicitExports.join(', ')} } from '../behaviors/${behaviorMod}.mjs';`);
  } else if (ownBehavior) {
    lines.push(`export * from '../behaviors/${slug}.mjs';`);
  }
  await writeFile(join(DIST, 'components', `${slug}.mjs`), lines.join('\n') + '\n');
  // kit 的类型面：与运行时同形态的 .d.mts（无类型的子路径引入是包面漏洞）。
  // .d.mts 内不引 CSS（副作用样式导入不属于类型契约；消费方打包器处理运行时 .mjs 即可）。
  const dts = behaviorMod && explicitExports
    ? `export { ${explicitExports.join(', ')} } from '../behaviors/${behaviorMod}.mjs';\n`
    : ownBehavior
      ? `export * from '../behaviors/${slug}.mjs';\n`
      : 'export {};\n';
  await writeFile(join(DIST, 'components', `${slug}.d.mts`), `// kit: ${slug} 类型面（构建产物，勿手改）\n${dts}`);
  const api = slugApi(slug);
  slugsRegistry[slug] = {
    css,
    ...(extra.length ? { extraCss: extra } : {}),
    ...(behaviorMod ? { behavior: behaviorMod } : ownBehavior ? { behavior: slug } : {}),
    ...(init ? { init } : {}),
    ...(api.exports.length ? { exports: api.exports } : {}),
    ...(api.events.length ? { events: api.events } : {}),
  };
}

// 4. registry.json（cli / 文档站消费）
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const behaviorFiles = (await readdir(join(SRC, 'behaviors'))).filter(f => f.endsWith('.ts')).sort();
// 稳定性分层（docs/versioning.md）：tier 事实源在 docs/contracts/tiers.json，
// 守卫（guard/registry.ts）同源校验覆盖；此处转为 module→tier 映射进 registry 供消费方使用
const tiersRaw = JSON.parse(await readFile(join(ROOT, 'docs', 'contracts', 'tiers.json'), 'utf8')) as Record<string, string[]>;
const tiers: Record<string, string> = {};
for (const [tier, mods] of Object.entries(tiersRaw)) {
  for (const m of mods) {
    if (tiers[m]) throw new Error(`build-css: tiers.json 中 ${m} 同时归属 ${tiers[m]} 与 ${tier}`);
    tiers[m] = tier;
  }
}
for (const c of components) {
  if (!tiers[c]) throw new Error(`build-css: 组件 src/components/${c}.css 未在 docs/contracts/tiers.json 标注 tier（core / beta / lab）`);
}
await writeFile(join(DIST, 'registry.json'), JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  tokens: TOKEN_ORDER,
  tokensExtras: TOKEN_EXTRAS,
  base: 'base.css',
  components,
  tiers,
  behaviors: behaviorFiles.map(f => f.replace(/\.ts$/, '')),
  slugs: slugsRegistry,
}, null, 2) + '\n');

// 5. CLI（bunx @icen.ai/ui add <slug>）：纯 node 标准库，直接拷贝
await writeFile(join(DIST, 'cli.mjs'), await readFile(join(ROOT, 'scripts', 'cli.mjs'), 'utf8'));

console.log(
  `build-css: ${TOKEN_ORDER.length} tokens + ${TOKEN_EXTRAS.length} extras + base + ${components.length} components + ${SLUGS.length} kit 入口 → dist/`,
);

