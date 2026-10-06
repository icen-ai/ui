// scripts/design-tokens.mjs — 把 dist/tokens/dtcg.json（bun run dtcg 的产物）再导出为
// 设计工具形态，补设计-开发闭环的最后一公里。运行：bun run design-tokens
//   → dist/tokens/tokens-studio.json   Tokens Studio（Figma 插件）原生格式
//   → dist/tokens/figma.variables.json Figma Variables（REST/导入形态）
//
// 只消费 dtcg.mjs 的产物（不回头解析 CSS、不改其导出语义）；产物缺失时先自举 bun run dtcg。
// 诚实纪律与 dtcg.mjs 一致：不可表示/无映射/断链项一律跳过并打印，不猜、不进产物。
//
// tokens-studio.json：$themes（每 预设×明暗 一个 theme）+ 每组合一个 token set 键
//   "clay/light"（直接映射 dtcg.json 的 clay.light 段：组层级/组级 $type/$description/$extensions 原样保留）
//   + $metadata.tokenSetOrder。
//
// figma.variables.json：variableCollections 每预设一个（modes: light/dark），variable 携带
//   valuesByMode（按 mode 名键控）。类型映射：color→COLOR（#rrggbb[aa] → {r,g,b,a} 0-1 浮点）、
//   dimension/number→FLOAT（dimension 以 px 为数值口径，rem 源值 ×16 换算并注明）、
//   duration/cubicBezier/fontFamily→STRING（时长原样、缓动 cubic-bezier(x1,y1,x2,y2)、字体栈逗号联接）。
//   别名 {preset.mode.group.token} → { type:'VARIABLE_ALIAS', id }，id 为路径编码
//   `icen/<preset>/<组路径>`，文件内自洽。
//
// Figma 变量要求 collection 内每个 mode 都有值：只在单一模式存在的 token（如 clay 的
// dark-only 静音色）无法表示 → 跳过并打印（连带其别名引用一并检查）。

import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DTCG_PATH = join(ROOT, 'dist', 'tokens', 'dtcg.json');
const OUT_DIR = join(ROOT, 'dist', 'tokens');

const PRESETS = ['clay', 'piano', 'art', 'vangogh', 'ink', 'retro'];
const MODES = ['light', 'dark'];

// ── 0. 自举：dtcg 产物不存在则先生成（只读 src/tokens/，与 dist 构建无依赖） ──
try {
  await access(DTCG_PATH);
} catch {
  console.log('design-tokens: 未找到 dist/tokens/dtcg.json，先自举 bun scripts/dtcg.mjs …');
  const r = spawnSync('bun', ['scripts/dtcg.mjs'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('design-tokens: dtcg 自举失败，终止。');
    process.exit(r.status ?? 1);
  }
}
const dtcg = JSON.parse(await readFile(DTCG_PATH, 'utf8'));

// ── 1. tokens-studio.json：$themes + token set 直映射 + $metadata ──
const tokenSetOrder = [];
const tokensStudio = { $themes: [] };
for (const preset of PRESETS) {
  for (const mode of MODES) {
    const setName = `${preset}/${mode}`;
    tokenSetOrder.push(setName);
    tokensStudio.$themes.push({
      id: `icen.${preset}.${mode}`,
      name: `${preset} / ${mode}`,
      selectedTokenSets: { [setName]: 'enabled' },
    });
    tokensStudio[setName] = dtcg[preset][mode]; // 组层级/组级 $type/$description/$extensions 原样保留
  }
}
tokensStudio.$metadata = { tokenSetOrder };

// ── 2. figma.variables.json ──
const FIGMA_TYPE = {
  color: 'COLOR',
  dimension: 'FLOAT',
  number: 'FLOAT',
  duration: 'STRING',
  cubicBezier: 'STRING',
  fontFamily: 'STRING',
};

/** 展平一个 dtcg 模式段 → Map<path('group/token'), { $value, type, raw }>（$type 沿组层级继承） */
function flattenMode(modeSeg) {
  const map = new Map();
  const walk = (node, path, inheritedType) => {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$') || !child || typeof child !== 'object') continue;
      const type = child.$type ?? inheritedType;
      if ('$value' in child) {
        map.set(path.concat(key).join('/'), { value: child.$value, type, raw: child.$extensions?.['ai.icen.raw'] });
      } else {
        walk(child, path.concat(key), type);
      }
    }
  };
  walk(modeSeg, [], undefined);
  return map;
}

function colorToRgba(hex) {
  const h = hex.slice(1);
  const n = (s) => parseInt(s, 16) / 255;
  const r = n(h.slice(0, 2));
  const g = n(h.slice(2, 4));
  const b = n(h.slice(4, 6));
  const a = h.length === 8 ? n(h.slice(6, 8)) : 1;
  const round = (x) => Math.round(x * 10000) / 10000;
  return { r: round(r), g: round(g), b: round(b), a: round(a) };
}

function dimensionToFloat(dimension) {
  const m = String(dimension).match(/^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'rem' ? Math.round(n * 16 * 10000) / 10000 : n;
}

/** dtcg 标量 → Figma 模式值；返回 null = 不可表示（诚实失败） */
function scalarToFigma(value, type) {
  switch (type) {
    case 'color':
      return typeof value === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(value) ? colorToRgba(value) : null;
    case 'dimension':
      return dimensionToFloat(value);
    case 'number':
      return typeof value === 'number' ? value : null;
    case 'duration':
      return typeof value === 'string' ? value : null;
    case 'cubicBezier':
      return Array.isArray(value) && value.length === 4 ? `cubic-bezier(${value.join(', ')})` : null;
    case 'fontFamily':
      return Array.isArray(value) && value.length ? value.join(', ') : null;
    default:
      return null;
  }
}

const figma = {
  $description: 'icen design tokens — Figma Variables 形态（由 dist/tokens/dtcg.json 经 scripts/design-tokens.mjs 生成）',
  $extensions: {
    'ai.icen.format': {
      generatedBy: 'scripts/design-tokens.mjs（bun run design-tokens，消费 bun run dtcg 的产物）',
      'type-mapping': 'color→COLOR（{r,g,b,a} 0-1 浮点）、dimension/number→FLOAT、duration/cubicBezier/fontFamily→STRING',
      'dimension-unit': 'FLOAT 数值一律为 px 口径；源值为 rem 的 dimension 按 1rem = 16px 换算（Figma 无 rem 单位）',
      'alias-encoding': 'DTCG 别名 {preset.mode.group.token} → { type: VARIABLE_ALIAS, id }；id 为路径编码 icen/<preset>/<组路径>，文件内自洽',
      'single-mode-tokens': 'Figma 变量要求 collection 内每个 mode 均有值；仅存在于单一模式的 token 跳过并打印（不进产物）',
      skipped: '上游不可表示项（color-mix/box-shadow 等）与断链别名已由 dtcg.mjs 跳过；此处不重复进产物，仅在控制台打印清单',
    },
  },
  variableCollections: [],
};

const stats = [];
const skippedSingleMode = []; // [{ preset, token, modes }]——单模式 token，不进产物
const skippedUnresolved = []; // [{ preset, token, mode, reason }]——别名/值无法解析，不进产物

for (const preset of PRESETS) {
  const byMode = {};
  for (const mode of MODES) byMode[mode] = flattenMode(dtcg[preset][mode]);

  // Figma 变量要求每个 mode 有值：只取 light/dark 同时存在的 token
  const paths = [...byMode.light.keys()].filter((p) => byMode.dark.has(p)).sort();
  for (const mode of MODES) {
    for (const p of byMode[mode].keys()) {
      if (!byMode[mode === 'light' ? 'dark' : 'light'].has(p)) {
        skippedSingleMode.push({ preset, token: p, present: mode });
      }
    }
  }

  const variables = [];
  const idByPath = new Map(paths.map((p) => [p, `icen/${preset}/${p}`]));
  for (const path of paths) {
    const valuesByMode = {};
    let failed = null;
    for (const mode of MODES) {
      const { value, type } = byMode[mode].get(path);
      if (typeof value === 'string' && /^\{.*\}$/.test(value)) {
        // 别名：{preset.mode.group.token} → 同 collection 变量引用（剥掉 preset/mode 两段）
        const segs = value.slice(1, -1).split('.');
        const targetPreset = segs[0];
        const targetPath = segs.slice(2).join('/');
        const targetId = targetPreset === preset ? idByPath.get(targetPath) : undefined;
        if (!targetId) {
          failed = `别名 ${value} 在本 collection 内不可解析（目标 ${targetPath} 不存在或跨预设）`;
          break;
        }
        valuesByMode[mode] = { type: 'VARIABLE_ALIAS', id: targetId };
      } else {
        const v = scalarToFigma(value, type);
        if (v === null) { failed = `值 ${JSON.stringify(value)}（$type=${type}）无法表示为 ${FIGMA_TYPE[type] ?? type}`; break; }
        valuesByMode[mode] = v;
      }
    }
    if (failed) {
      skippedUnresolved.push({ preset, token: path, reason: failed });
      continue;
    }
    variables.push({ id: idByPath.get(path), name: path, type: FIGMA_TYPE[byMode.light.get(path).type] ?? 'STRING', valuesByMode });
  }

  figma.variableCollections.push({
    name: `icen / ${preset}`,
    modes: MODES.map((m) => ({ name: m })),
    variables,
  });
  stats.push({ preset, variables: variables.length, skippedSingle: skippedSingleMode.filter((s) => s.preset === preset).length });
}

// ── 3. 写产物 + 诚实报告 ──
await mkdir(OUT_DIR, { recursive: true });
const TS_OUT = join(OUT_DIR, 'tokens-studio.json');
const FIGMA_OUT = join(OUT_DIR, 'figma.variables.json');
await writeFile(TS_OUT, JSON.stringify(tokensStudio, null, 2) + '\n', 'utf8');
await writeFile(FIGMA_OUT, JSON.stringify(figma, null, 2) + '\n', 'utf8');

for (const s of stats) {
  console.log(`design-tokens: icen / ${s.preset.padEnd(8)} 变量 ${String(s.variables).padStart(3)}（跳过：单模式 ${s.skippedSingle}）`);
}
console.log(`design-tokens: tokens-studio  ${tokenSetOrder.length} 个 token set（${tokensStudio.$themes.length} 个 theme）→ ${TS_OUT.replace(ROOT + '/', '')}`);
console.log(`design-tokens: figma variables ${figma.variableCollections.length} 个 collection → ${FIGMA_OUT.replace(ROOT + '/', '')}`);

const dtcgSkipped = dtcg.$extensions?.['ai.icen.skipped'] ?? {};
const dtcgSkippedCount = Object.values(dtcgSkipped).reduce((n, list) => n + list.length, 0);
if (dtcgSkippedCount > 0) {
  console.log(`design-tokens: 上游 dtcg 跳过 ${dtcgSkippedCount} 项（color-mix/box-shadow 等不可表示 + 断链别名，均不进本产物）：`);
  for (const [key, list] of Object.entries(dtcgSkipped)) {
    for (const s of list) console.log(`  [${key}] ${s.name} — ${s.reason}`);
  }
}
if (skippedSingleMode.length > 0) {
  console.log(`design-tokens: 单模式 token ${skippedSingleMode.length} 项（Figma 变量要求所有 mode 有值，跳过不进产物）：`);
  for (const s of skippedSingleMode) console.log(`  [icen / ${s.preset}] ${s.token} — 仅存在于 ${s.present} 模式`);
}
if (skippedUnresolved.length > 0) {
  console.log(`design-tokens: 不可解析 ${skippedUnresolved.length} 项（跳过不进产物）：`);
  for (const s of skippedUnresolved) console.log(`  [icen / ${s.preset}] ${s.token} — ${s.reason}`);
}
