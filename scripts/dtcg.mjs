// scripts/dtcg.mjs — 把设计 tokens 导出为 W3C DTCG **经典版**（第二版编辑草案 2022-06-14，生态实际部署版本）
// 运行：bun run dtcg（或 node scripts/dtcg.mjs）→ dist/tokens/dtcg.json
//
// 解析来源：src/tokens/{colors,style-profiles,typography}.css（与 scripts/build-css.ts 的 TOKEN_ORDER
// 同序拼接）——选源文件而非 dist/tokens.css：不依赖先跑 build，且 build 对这三份文件是原样拷贝，内容等价。
// retro-effects.css 是按需 extras 层（不进 tokens.css 拼合），不在导出范围。
//
// 结构：{ $description, $extensions, clay: { light: {…}, dark: {…} }, piano: {…}, … }
//   - 每个 (预设, 明/暗) 是「有效级联结果」：:root → [data-icen-theme="dark"] / .预设 → .预设[data-icen-theme="dark"]（按特异性分层、同层按源序）
//   - 组内按变量前缀分子组并提升组级 $type（token 级 $type 恒最高优先，仅例外 token 携带）
//   - $value 用经典版标量：颜色 #rrggbb[aa]、尺寸 "8px"/"0.25rem"（仅 px/rem）、时长 "150ms"、
//     fontFamily 字符串数组、cubicBezier 四元数组、number 为 JSON number
//   - var(--x) 引用 → DTCG 别名 "{preset.mode.group.name}"（花括号路径，经典版 §8；引用目标必须已在文件内）
//   - $extensions 键统一反域名命名空间 ai.icen.*；每个 token 保留 ai.icen.raw = 原始 CSS 自定义属性名
//
// 诚实失败（不猜）：color-mix()/box-shadow 等经典版无法表示的值、指向未导出 token 的别名、
// 无 $type 语义映射规则的变量名 → 一律跳过并打印清单（也记录在 $extensions['ai.icen.skipped']）。
// 类型只从变量名语义映射（规范禁止工具从值内容猜类型）。
//
// 版本门：--dtcg-version 目前仅接受 classic；TR 2025.10 是预览草案（官方标注 Do not attempt to implement），
// 留此参数作为未来升级入口，不实现其对象值语法/$ref/$deprecated。

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// ── 与 build-css.ts 的 TOKEN_ORDER 保持一致 ──
const TOKEN_ORDER = ['colors.css', 'style-profiles.css', 'typography.css'];
const PRESETS = ['clay', 'piano', 'art', 'vangogh', 'ink', 'retro'];

// 变量名前缀 → (子组, $type)。类型来自命名语义，不从值猜。
const GROUP_RULES = [
  ['icen-token-', 'token', 'color'],
  ['icen-accent-', 'accent', 'color'],
  ['icen-bg-', 'bg', 'color'],
  ['icen-text-', 'text', 'color'],
  ['icen-border-', 'border', 'color'],
  ['icen-color-', 'color', 'color'],
  ['icen-radius-', 'radius', 'dimension'],
  ['icen-density-', 'density', 'dimension'],
  ['icen-duration-', 'duration', 'duration'],
  ['icen-ease-', 'ease', 'cubicBezier'],
  ['icen-font-', 'font', 'fontFamily'],
  ['icen-line-height-', 'line-height', 'number'],
  ['icen-letter-spacing-', 'letter-spacing', 'dimension'],
];
// 组级 $type 的例外（token 级 $type 覆盖组级——规范允许且优先级最高）
const TYPE_OVERRIDES = { '--icen-token-scrollbar-size': 'dimension' };

const GROUP_DESCRIPTIONS = {
  token: '语义色彩系统（--icen-token-*）',
  accent: '主色桥接（--icen-accent-*）',
  bg: '背景桥接（--icen-bg-*）',
  text: '文字桥接（--icen-text-*）',
  border: '边框桥接（--icen-border-*）',
  color: '语义色桥接（--icen-color-*）',
  radius: '圆角（--icen-radius-*）',
  density: '间距/字号/控件高度标尺（--icen-density-*）',
  duration: '动效时长（--icen-duration-*）',
  ease: '缓动曲线（--icen-ease-*）',
  font: '字体栈（--icen-font-*）',
  'line-height': '行高（--icen-line-height-*，无单位 number）',
  'letter-spacing': '字距（--icen-letter-spacing-*）',
};

const REASONS = {
  shadow: 'CSS box-shadow 值：经典版 shadow 复合类型为草案状态，且此处值含多层/inset 形态，不可表示',
  color: 'color-mix() 等非十六进制颜色语法：经典版 color 值仅支持 #rrggbb[aa]，不猜、不计算',
  nomap: '变量名无 $type 语义映射规则（不从值猜类型）',
  unparseable: (t) => `值无法解析为 ${t}`,
};

// ── CLI（版本门） ──
const args = process.argv.slice(2);
const version = args.find((a) => a.startsWith('--dtcg-version='))?.slice('--dtcg-version='.length) ?? 'classic';
if (version !== 'classic') {
  console.error(`dtcg: 不支持的 --dtcg-version=${version}。当前仅实现 classic（第二版编辑草案 2022-06-14）；` +
    'TR 2025.10 为预览草案，官方标注 *Do not attempt to implement*，留作未来升级入口。');
  process.exit(1);
}

// ── 1. 解析 CSS：剥注释 → 平坦块扫描 → 声明序列（保留全局源序） ──
let css = '';
for (const f of TOKEN_ORDER) css += `\n/* ═ src/tokens/${f} ═ */\n` + await readFile(join(ROOT, 'src', 'tokens', f), 'utf8');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** @type {{idx:number, tier:number, kind:string, preset?:string, mode?:string, decls:Map<string,string>}[]} */
const blocks = [];
const ignoredDecls = new Map(); // 矩阵外选择器（.style-* 等）携带的声明数——按设计排除，非失败
let blockIdx = 0;
for (const m of noComments.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
  const selector = m[1].replace(/\s+/g, ' ').trim();
  const body = m[2];
  const decls = new Map();
  for (const d of body.matchAll(/--([A-Za-z][\w-]*)\s*:\s*([^;]+);/g)) decls.set('--' + d[1], d[2].trim());
  if (decls.size === 0) continue;

  // 选择器分类：仅接受单选择器块的 :root / [data-icen-theme="dark"] /
  // [data-icen-preset="<预设>"] / [data-icen-preset="<预设>"][data-icen-theme="dark"]（两段复合任意顺序）
  const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
  let role = null;
  if (parts.length === 1) {
    const p = parts[0];
    if (p === ':root') role = { tier: 0, kind: 'root' };
    else {
      const presetM = p.match(/\[data-icen-preset="([a-z][\w-]*)"\]/);
      const darkM = /\[data-icen-theme="dark"\]/.test(p);
      const isPresetForm = /^\[data-icen-(preset="[a-z][\w-]*"|theme="dark")\](\[data-icen-(preset="[a-z][\w-]*"|theme="dark")\])?$/.test(p);
      if (isPresetForm) {
        if (presetM && darkM) {
          if (PRESETS.includes(presetM[1])) role = { tier: 2, kind: 'preset-dark', preset: presetM[1], mode: 'dark' };
        } else if (presetM) {
          if (PRESETS.includes(presetM[1])) role = { tier: 1, kind: 'preset', preset: presetM[1] };
        } else if (darkM) {
          role = { tier: 1, kind: 'dark' };
        }
      }
    }
  }
  if (!role) {
    ignoredDecls.set(selector, (ignoredDecls.get(selector) ?? 0) + decls.size);
    continue;
  }
  blocks.push({ idx: blockIdx++, ...role, decls });
}

/** (预设, 模式) 的有效级联：收集适用块 → 按 (特异性层, 源序) 应用，后者覆盖前者 */
function effective(preset, mode) {
  const apply = blocks
    .filter((b) =>
      b.kind === 'root' ||
      (b.kind === 'dark' && mode === 'dark') ||
      (b.kind === 'preset' && b.preset === preset) ||
      (b.kind === 'preset-dark' && b.preset === preset && mode === 'dark'))
    .sort((a, b) => a.tier - b.tier || a.idx - b.idx);
  /** @type {Map<string,string>} */
  const eff = new Map();
  for (const b of apply) for (const [n, v] of b.decls) eff.set(n, v);
  return eff;
}

// ── 2. 值转换器（经典版标量语法；返回 null = 该值不可表示） ──
function parseColor(v) {
  const s = v.trim();
  if (s === 'transparent') return '#00000000'; // CSS transparent === rgba(0,0,0,0)
  let m = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (m) {
    const h = m[1].toLowerCase();
    if (h.length === 3) return '#' + [...h].map((c) => c + c).join('');
    return '#' + h;
  }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    const [r, g, b] = [1, 2, 3].map((i) => Math.round(parseFloat(m[i])).toString(16).padStart(2, '0'));
    const a = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255;
    return a >= 255 ? `#${r}${g}${b}` : `#${r}${g}${b}${a.toString(16).padStart(2, '0')}`;
  }
  return null; // color-mix() / 具名色 / 其它函数
}

function parseDimension(v) {
  const s = v.trim();
  if (s === '0') return '0px'; // 无单位 0 等价 0px（dimension 要求带单位）
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:px|rem)$/.test(s) ? s : null; // 经典版 dimension 仅 px/rem
}

function parseDuration(v) {
  const s = v.trim();
  return /^\d+\.?\d*ms$/.test(s) ? s : null; // 经典版 duration = 数字 + ms
}

function parseCubicBezier(v) {
  const s = v.trim();
  if (s === 'linear') return [0, 0, 1, 1]; // linear 恒等曲线 = cubic-bezier(0,0,1,1)
  const m = s.match(/^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/);
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  if (!(x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1)) return null; // 规范：x 约束在 [0,1]
  return [x1, y1, x2, y2];
}

function parseFontFamily(v) {
  // 逗号切分（不在引号内的逗号），去引号 → 经典版 fontFamily 字符串数组
  const s = v.trim();
  const parts = [];
  let cur = '', quote = null;
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
    else if (ch === ',') { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  const list = parts.map((p) => p.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  return list.length ? list : null;
}

const CONVERTERS = { color: parseColor, dimension: parseDimension, duration: parseDuration, cubicBezier: parseCubicBezier, fontFamily: parseFontFamily };
function parseNumber(v) {
  const s = v.trim();
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}

function ruleFor(name) {
  // 名字里带 shadow 的（token-shadow-* / shadow-*）一律按 box-shadow 处理 → 不可表示
  if (name.includes('shadow')) return { group: 'shadow', type: 'shadow' };
  for (const [prefix, group, type] of GROUP_RULES) {
    if (name.startsWith('--' + prefix)) return { group, type, token: name.slice(2 + prefix.length) };
  }
  return null;
}

// ── 3. 逐 (预设, 模式)：分类值 → 别名链校验 → 组装 DTCG 组 ──
const MODE_LABEL = { light: 'Light（无 data-icen-theme）', dark: 'Dark（data-icen-theme="dark"）' };
const out = {
  $description: 'icen design tokens (DTCG classic format)',
  $extensions: {
    'ai.icen.format': {
      dtcg: 'classic',
      spec: 'DTCG 第二版编辑草案（2022-06-14）——Style Dictionary / Tokens Studio / Figma 插件等生态实际部署的经典版',
      'value-syntax': '经典版标量：color=#rrggbb[aa]、dimension="1rem"(px|rem)、duration="150ms"、fontFamily=string[]、cubicBezier=[x1,y1,x2,y2]、number；var() 引用导出为 {path.to.token} 别名',
      'type-inheritance': '组级 $type 下沉；token 级 $type 优先；别名类型随引用目标解析',
      generatedBy: 'scripts/dtcg.mjs（bun run dtcg）',
      source: 'src/tokens/{colors,style-profiles,typography}.css（同 build-css.ts 的 TOKEN_ORDER）',
      exclusions: [
        'box-shadow 值与 color-mix() 派生色不可表示为经典版标量 → 跳过（见 ai.icen.skipped）',
        '.style-modern/.style-retro/.style-terminal 是与预设正交的风格层，不在 预设×明暗 矩阵内',
        'src/tokens/retro-effects.css 为按需 extras 层（不进 tokens.css），不在导出范围',
      ],
    },
    'ai.icen.skipped': {},
  },
};

const stats = [];
let totalExported = 0, totalSkipped = 0, totalAliases = 0;

for (const preset of PRESETS) {
  out[preset] = {
    $description: `${preset} 预设（${preset === 'clay' ? '默认主题，:root 基值' : `[data-icen-preset="${preset}"]` }）——每个模式为该组合下的有效级联结果`,
  };
  for (const mode of ['light', 'dark']) {
    const eff = effective(preset, mode);

    // 3a. 逐变量分类：别名 / 标量值 / 跳过
    /** @type {Map<string, {kind:'alias',target:string}|{kind:'value',value:unknown,type:string}|{kind:'skip',reason:string}>} */
    const status = new Map();
    for (const [name, raw] of eff) {
      const rule = ruleFor(name);
      if (!rule) { status.set(name, { kind: 'skip', reason: REASONS.nomap }); continue; }
      const am = raw.match(/^var\(\s*(--[A-Za-z][\w-]*)\s*\)$/);
      if (am) { status.set(name, { kind: 'alias', target: am[1] }); continue; }
      if (rule.type === 'shadow') { status.set(name, { kind: 'skip', reason: REASONS.shadow }); continue; }
      const type = TYPE_OVERRIDES[name] ?? rule.type;
      const conv = type === 'number' ? parseNumber(raw) : CONVERTERS[type]?.(raw);
      if (conv === null || conv === undefined) {
        status.set(name, { kind: 'skip', reason: type === 'color' && !ruleFor(name).type.startsWith('shadow') ? REASONS.color : REASONS.unparseable(type) });
      } else {
        status.set(name, { kind: 'value', value: conv, type });
      }
    }

    // 3b. 别名链校验：必须抵达一个已导出的标量 token；断链/环 → 跳过（经典版引用只能指向文件内完整 token）
    for (const [name, st] of status) {
      if (st.kind !== 'alias') continue;
      const seen = new Set([name]);
      let cur = st.target, dead = null;
      while (true) {
        const s = status.get(cur);
        if (!s) { dead = `别名目标 ${cur} 不在本模式变量集中`; break; }
        if (s.kind === 'skip') { dead = `别名目标 ${cur} 未导出（${s.reason}）`; break; }
        if (s.kind === 'alias') {
          if (seen.has(cur)) { dead = `别名链成环（${cur}）`; break; }
          seen.add(cur); cur = s.target; continue;
        }
        break; // 抵达标量 → 链有效
      }
      if (dead) status.set(name, { kind: 'skip', reason: dead });
    }

    // 3c. 组装：子组（组级 $type 提升）→ token 对象
    /** @type {Record<string, any>} */
    const modeGroup = { $description: `${MODE_LABEL[mode]}——有效级联：:root${mode === 'dark' ? ' + [data-icen-theme="dark"]' : ''}${preset !== 'clay' ? ` + [data-icen-preset="${preset}"]` : ''}` };
    const groups = new Map(); // group -> { $type, tokens: [[name, tokenObj]] }
    const skips = [];
    let exported = 0, aliases = 0;
    for (const [name, st] of status) {
      const rule = ruleFor(name);
      if (st.kind === 'skip') { skips.push({ name, reason: st.reason }); continue; }
      if (!groups.has(rule.group)) {
        groups.set(rule.group, { $type: GROUP_RULES.find(([, g]) => g === rule.group)?.[2] ?? 'color', tokens: [] });
      }
      const g = groups.get(rule.group);
      const tokenName = rule.token ?? name.slice(2);
      const token = { $extensions: { 'ai.icen.raw': name } };
      if (st.kind === 'alias') {
        const t = ruleFor(st.target);
        token.$value = `{${preset}.${mode}.${t.group}.${t.token ?? st.target.slice(2)}}`;
        aliases++;
      } else {
        token.$value = st.value;
        if (st.type !== g.$type) token.$type = st.type; // 仅例外 token 携带 token 级 $type
      }
      g.tokens.push([tokenName, token]);
      exported++;
    }
    // 空组不产出（如 shadow：全部跳过）
    for (const [gname, g] of groups) {
      if (g.tokens.length === 0) continue;
      const grp = {};
      if (GROUP_DESCRIPTIONS[gname]) grp.$description = GROUP_DESCRIPTIONS[gname];
      grp.$type = g.$type;
      for (const [n, t] of g.tokens) grp[n] = t;
      modeGroup[gname] = grp;
    }
    out[preset][mode] = modeGroup;
    if (skips.length) out.$extensions['ai.icen.skipped'][`${preset}.${mode}`] = skips;
    stats.push({ key: `${preset}.${mode}`, exported, aliases, skipped: skips.length, effVars: eff.size });
    totalExported += exported; totalAliases += aliases; totalSkipped += skips.length;
  }
}

// ── 4. 自校验（规范符合性）：token/group 判定、名字约束、别名可解析（含环检测） ──
const NAME_RE = /^[^{}$.]/; // 不得以 $ 开头，不得含 { } .
function validate(node, path, seenPath) {
  if (node && typeof node === 'object' && !Array.isArray(node) && !(node instanceof Map)) {
    if ('$value' in node) {
      const keys = Object.keys(node).filter((k) => !k.startsWith('$'));
      if (keys.length > 0) throw new Error(`规范违规：${path} 同时含 $value 与子组`);
      const v = node.$value;
      if (typeof v === 'string' && /^\{.*\}$/.test(v)) {
        // 别名解析：导航到目标 token，验 $value，环检测
        const chain = [];
        let cur = path, ref = v;
        while (true) {
          if (chain.includes(ref)) throw new Error(`别名成环：${path} → ${ref}`);
          chain.push(ref);
          const segs = ref.slice(1, -1).split('.');
          let target = out;
          for (const s of segs) { target = target?.[s]; if (target === undefined) throw new Error(`别名断链：${path} → ${ref}`); }
          if (!('$value' in target)) throw new Error(`别名目标非 token：${path} → ${ref}`);
          if (typeof target.$value !== 'string' || !/^\{.*\}$/.test(target.$value)) break;
          ref = target.$value;
        }
      }
      return;
    }
    for (const [k, child] of Object.entries(node)) {
      if (!k.startsWith('$') && !NAME_RE.test(k)) throw new Error(`非法名字：${path}.${k}`);
      if (!k.startsWith('$')) validate(child, `${path}.${k}`, seenPath);
    }
  }
}
validate(out, '', new Set());

// ── 5. 写产物 + 报告 ──
const OUT = join(ROOT, 'dist', 'tokens', 'dtcg.json');
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

const W = Math.max(...stats.map((s) => s.key.length));
for (const s of stats) {
  console.log(`dtcg: ${s.key.padEnd(W)}  导出 ${String(s.exported).padStart(3)}（别名 ${String(s.aliases).padStart(2)}）  跳过 ${String(s.skipped).padStart(2)}  / 级联变量 ${s.effVars}`);
}
console.log(`dtcg: 合计 导出 ${totalExported}（别名 ${totalAliases}）跳过 ${totalSkipped} → ${OUT.replace(ROOT + '/', '')}`);

if (totalSkipped > 0) {
  console.log('dtcg: 跳过清单（诚实失败——不可表示/无映射/断链，均不计入产物）：');
  for (const [key, list] of Object.entries(out.$extensions['ai.icen.skipped'])) {
    for (const s of list) console.log(`  [${key}] ${s.name} — ${s.reason}`);
  }
}
if (ignoredDecls.size > 0) {
  const sum = [...ignoredDecls.values()].reduce((a, b) => a + b, 0);
  console.log(`dtcg: 矩阵外声明 ${sum} 条按设计排除（正交风格层/非矩阵选择器）：${[...ignoredDecls.keys()].map((s) => `${s}(${ignoredDecls.get(s)})`).join(', ')}`);
}
