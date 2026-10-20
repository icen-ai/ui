/*
 * 公共契约快照（contracts snapshot）：从源码抽取库的公共 API 面，写入
 * docs/contracts/snapshot.json；--check 模式对比快照报告漂移（守卫同口径消费）。
 *
 * 运行：
 *   bun run contracts          # --check：对比快照，漂移即 exit(1)
 *   bun run contracts:update   # --write：重新生成快照（随变更同 PR 提交）
 *
 * 为什么需要它（docs/versioning.md 1.0 checklist 的机器可查版）：
 * 「API 稳定两个 minor」此前只能靠人工记忆与 CHANGELOG 自述；快照把
 * 类名 / data 属性 / CSS 变量 / 事件名 / JS 导出钉成可 diff 的清单，
 * 并以 TS 编译器 API 从 src/index.ts 导出面生成确定性类型签名报告（types 面，
 * 不依赖 dist 产物——守卫在 build 前运行）——移除或改名 = 破坏性变更，
 * 类型签名变化同样按破坏性分类（成对展示 旧 → 新），新增 = additive。
 * 破坏性条目必须在 minor 里逐条公告；新增也要在此留痕。
 * 注：快照记录「存在面」与「签名面」，不预判语义；语义变化的公告仍归 CHANGELOG 纪律。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import ts from 'typescript';
import { SRC, stripComments } from './guard/shared';

type Surface = 'classes' | 'dataAttributes' | 'cssVariables' | 'events' | 'jsExports';
const SURFACES: Surface[] = ['classes', 'dataAttributes', 'cssVariables', 'events', 'jsExports'];

interface Snapshot {
  version: string;
  note: string;
  surfaces: Record<Surface, string[]>;
  /** 类型面：导出名 → 规范化签名字符串（TS 编译器 API 生成，确定性排序） */
  types: Record<string, string>;
  /** 分层盖章：`<face>:<entry>` → core/beta/lab（生成快照时按当时 tiers.json 盘点；
      tag 间 diff 优先读盖章，历史独有条目不再退化为 unknown） */
  tiers?: Record<string, string>;
}

export const SNAPSHOT_PATH = join(SRC, '..', 'docs', 'contracts', 'snapshot.json');

/** 递归收集 src 下指定后缀的文件（相对路径升序，扫描面稳定）。 */
async function collect(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...(await collect(p, exts)));
    else if (exts.some((e) => name.name.endsWith(e))) out.push(p);
  }
  return out.sort();
}

/** 文件 → 去注释行（契约示例常写在注释里，只认真实代码）。 */
async function codeLines(file: string): Promise<string[]> {
  return stripComments((await readFile(file, 'utf8')).split(/\r?\n/));
}

function uniqSorted(set: Set<string>): string[] {
  return Array.from(set).sort();
}

export async function extractSurfaces(): Promise<Record<Surface, string[]>> {
  const classes = new Set<string>();
  const dataAttributes = new Set<string>();
  const cssVariables = new Set<string>();
  const events = new Set<string>();

  const cssFiles = await collect(SRC, ['.css']);
  const tsFiles = await collect(SRC, ['.ts', '.tsx']);

  for (const f of cssFiles) {
    const text = (await codeLines(f)).join('\n');
    for (const m of text.matchAll(/\.icen-[a-zA-Z0-9_-]+/g)) classes.add(m[0].slice(1));
    for (const m of text.matchAll(/data-icen-[a-z0-9-]+/g)) dataAttributes.add(m[0]);
    for (const m of text.matchAll(/--icen-[a-zA-Z0-9_-]+/g)) cssVariables.add(m[0]);
  }
  for (const f of tsFiles) {
    const text = (await codeLines(f)).join('\n');
    for (const m of text.matchAll(/data-icen-[a-z0-9-]+/g)) dataAttributes.add(m[0]);
    for (const m of text.matchAll(/--icen-[a-zA-Z0-9_-]+/g)) cssVariables.add(m[0]);
    /* 事件名只认带引号的字面量（emitIcen(el, 'icen:xxx') 等）；裸串误报率高 */
    for (const m of text.matchAll(/['"`]icen:[a-z0-9-]+['"`]/g)) events.add(m[0].slice(1, -1));
  }

  /* JS 导出面：直接 import 包入口取运行时导出名（含 VERSION）；类型签名走 types 面 */
  const entry = await import(join(SRC, 'index.ts'));
  const jsExports = uniqSorted(new Set(Object.keys(entry)));

  return {
    classes: uniqSorted(classes),
    dataAttributes: uniqSorted(dataAttributes),
    cssVariables: uniqSorted(cssVariables),
    events: uniqSorted(events),
    jsExports,
  };
}

export function surfaceCounts(surfaces: Record<Surface, string[]>, types?: Record<string, string>): string {
  const base = SURFACES.map((s) => `${s}=${surfaces[s].length}`).join(' ');
  return types ? `${base} types=${Object.keys(types).length}` : base;
}

/* ── types 面：TS 编译器 API 从 src/index.ts 导出面生成确定性签名 ── */

const TYPE_FLAGS = ts.TypeFormatFlags.NoTruncation;
let typesCache: Record<string, string> | null = null;

/** 签名规范化：折叠空白，保证跨平台逐字节稳定。 */
function normalizeSig(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function byName(a: ts.Symbol, b: ts.Symbol): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function typeParamsOf(checker: ts.TypeChecker, decl: ts.Declaration): string {
  const tps = (decl as ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeAliasDeclaration | ts.FunctionDeclaration)
    .typeParameters;
  if (!tps?.length) return '';
  return `<${tps
    .map((tp) => {
      let s = tp.name.getText();
      if (tp.constraint) s += ` extends ${checker.typeToString(checker.getTypeFromTypeNode(tp.constraint), undefined, TYPE_FLAGS)}`;
      if (tp.default) s += ` = ${checker.typeToString(checker.getTypeFromTypeNode(tp.default), undefined, TYPE_FLAGS)}`;
      return s;
    })
    .join(', ')}>`;
}

function propLine(checker: ts.TypeChecker, p: ts.Symbol): string {
  const opt = p.flags & ts.SymbolFlags.Optional ? '?' : '';
  const ro = (p.declarations ?? []).some(
    (d) => ts.canHaveModifiers(d) && (ts.getModifiers(d) ?? []).some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword),
  )
    ? 'readonly '
    : '';
  return `${ro}${p.name}${opt}: ${checker.typeToString(checker.getTypeOfSymbol(p), undefined, TYPE_FLAGS)}`;
}

/** 对象成员面：属性按名排序 + 索引签名 + 调用/构造签名（接口与类实例共用）。 */
function objectBody(checker: ts.TypeChecker, type: ts.Type): string {
  const parts = type.getProperties().sort(byName).map((p) => propLine(checker, p));
  const strIdx = type.getStringIndexType();
  if (strIdx) parts.push(`[key: string]: ${checker.typeToString(strIdx, undefined, TYPE_FLAGS)}`);
  const numIdx = type.getNumberIndexType();
  if (numIdx) parts.push(`[key: number]: ${checker.typeToString(numIdx, undefined, TYPE_FLAGS)}`);
  for (const s of type.getConstructSignatures()) parts.push(`new ${checker.signatureToString(s, undefined, TYPE_FLAGS)}`);
  for (const s of type.getCallSignatures()) parts.push(checker.signatureToString(s, undefined, TYPE_FLAGS));
  return `{ ${parts.join('; ')} }`;
}

/** 类型别名展开：typeToString 偏爱别名本名（`type X = X`），union/交集/匿名对象手动展开。 */
function expandAlias(checker: ts.TypeChecker, name: string, t: ts.Type): string {
  const printed = checker.typeToString(t, undefined, TYPE_FLAGS);
  if (printed !== name && !printed.startsWith(`${name}<`)) return printed;
  if (t.isUnion()) return t.types.map((m) => checker.typeToString(m, undefined, TYPE_FLAGS)).join(' | ');
  if (t.isIntersection()) return t.types.map((m) => checker.typeToString(m, undefined, TYPE_FLAGS)).join(' & ');
  if (t.flags & ts.TypeFlags.Object && (t as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous) {
    return objectBody(checker, t);
  }
  return printed;
}

/** 单个导出符号 → 规范化签名（覆盖 函数 / 接口 / 类型别名展开 / 类成员 / 常量 / 枚举）。 */
function signatureOf(checker: ts.TypeChecker, sym: ts.Symbol): string {
  const target = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
  const decl = target.declarations?.[0];
  const name = target.name;
  if (decl) {
    if (ts.isEnumDeclaration(decl)) {
      const members = decl.members
        .map((m) => {
          const v = checker.getConstantValue(m);
          return `${m.name.getText()}${v !== undefined ? ` = ${JSON.stringify(v)}` : ''}`;
        })
        .sort();
      return normalizeSig(`enum ${name} { ${members.join('; ')} }`);
    }
    if (ts.isClassDeclaration(decl)) {
      const ctorType = checker.getTypeOfSymbol(target);
      const instance = checker.getDeclaredTypeOfSymbol(target);
      const parts = ctorType.getConstructSignatures()
        .map((s) => `constructor${checker.signatureToString(s, undefined, TYPE_FLAGS)}`);
      for (const p of ctorType.getProperties().sort(byName)) {
        if (p.name === 'prototype') continue;
        parts.push(`static ${propLine(checker, p)}`);
      }
      for (const p of instance.getProperties().sort(byName)) parts.push(propLine(checker, p));
      return normalizeSig(`class ${name}${typeParamsOf(checker, decl)} { ${parts.join('; ')} }`);
    }
    if (ts.isInterfaceDeclaration(decl)) {
      return normalizeSig(
        `interface ${name}${typeParamsOf(checker, decl)} ${objectBody(checker, checker.getDeclaredTypeOfSymbol(target))}`,
      );
    }
    if (ts.isTypeAliasDeclaration(decl)) {
      const t = checker.getDeclaredTypeOfSymbol(target);
      return normalizeSig(`type ${name}${typeParamsOf(checker, decl)} = ${expandAlias(checker, name, t)}`);
    }
    if (ts.isFunctionDeclaration(decl)) {
      const sigs = checker.getTypeOfSymbol(target).getCallSignatures()
        .map((s) => checker.signatureToString(s, undefined, TYPE_FLAGS));
      return normalizeSig(`function ${name}: ${sigs.join(' | ')}`);
    }
  }
  return normalizeSig(`const ${name}: ${checker.typeToString(checker.getTypeOfSymbol(target), undefined, TYPE_FLAGS)}`);
}

/** 类型面抽取：符号名 → 规范化签名，按名字稳定排序。 */
export async function extractTypes(): Promise<Record<string, string>> {
  if (typesCache) return typesCache;
  const root = join(SRC, '..');
  const entry = join(SRC, 'index.ts');
  const cfg = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config ?? {}, ts.sys, root);
  const program = ts.createProgram([entry], { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(entry);
  if (!sf) throw new Error(`无法加载入口文件 ${entry}`);
  const moduleSym = checker.getSymbolAtLocation(sf);
  if (!moduleSym) throw new Error('无法解析 src/index.ts 的模块符号');
  const out: Record<string, string> = {};
  for (const sym of checker.getExportsOfModule(moduleSym).sort(byName)) {
    out[sym.name] = signatureOf(checker, sym);
  }
  typesCache = out;
  return out;
}

function diff(oldList: string[], newList: string[]): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldList);
  const newSet = new Set(newList);
  return {
    added: newList.filter((x) => !oldSet.has(x)),
    removed: oldList.filter((x) => !newSet.has(x)),
  };
}

/** 生成并写入快照；返回摘要行。 */
export async function writeSnapshot(): Promise<string> {
  const surfaces = await extractSurfaces();
  const types = await extractTypes();
  const pkg = JSON.parse(await readFile(join(SRC, '..', 'package.json'), 'utf8'));
  /* 分层盖章：现在就把每条目的 tier 盘下来，tag 间 diff 不再靠未来（移动中的）src 反推 */
  const tiers: Record<string, string> = {};
  for (const s of SURFACES) for (const e of surfaces[s]) tiers[`${s}:${e}`] = await tierOfEntry(s, e);
  for (const k of Object.keys(types)) tiers[`types:${k}`] = await tierOfEntry('types', k);
  const snap: Snapshot = {
    version: pkg.version,
    note: '公共契约面快照：bun run contracts:update 重新生成，随变更同 PR 提交；移除/改名/签名变化=破坏性变更须按 docs/versioning.md 公告。tiers 为分层盖章（tag 间 diff 直接读，不再反推）。',
    surfaces,
    types,
    tiers,
  };
  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snap, null, 2)}\n`, 'utf8');
  return surfaceCounts(surfaces, types);
}

/** 对比快照；返回漂移明细（空数组 = 无漂移），供守卫与 CLI 共用。 */
export async function checkDrift(): Promise<string[]> {
  const surfaces = await extractSurfaces();
  const types = await extractTypes();
  let snap: Snapshot;
  try {
    snap = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
  } catch {
    return ['未找到 docs/contracts/snapshot.json——先运行 bun run contracts:update 生成基线'];
  }
  const violations: string[] = [];
  for (const s of SURFACES) {
    const { added, removed } = diff(snap.surfaces[s] ?? [], surfaces[s]);
    if (removed.length) {
      violations.push(
        `${s}：移除 ${removed.length} 项（破坏性变更！须按 docs/versioning.md 在 minor 公告并给迁移说明）：${removed.slice(0, 8).join(', ')}${removed.length > 8 ? ' …' : ''}`,
      );
    }
    if (added.length) {
      violations.push(
        `${s}：新增 ${added.length} 项（确认有意扩面后 bun run contracts:update 并随本 PR 提交）：${added.slice(0, 8).join(', ')}${added.length > 8 ? ' …' : ''}`,
      );
    }
  }

  /* types 面：消失或签名变化 = 破坏性（breaking），签名变化成对展示 旧 → 新；新增 = additive */
  const oldTypes = snap.types ?? {};
  const removedTypes = Object.keys(oldTypes).filter((k) => !(k in types));
  const addedTypes = Object.keys(types).filter((k) => !(k in oldTypes));
  const changedTypes = Object.keys(types).filter((k) => k in oldTypes && oldTypes[k] !== types[k]);
  if (removedTypes.length) {
    violations.push(
      `types：移除 ${removedTypes.length} 项（破坏性 breaking！须按 docs/versioning.md 在 minor 公告并给迁移说明）：${removedTypes.slice(0, 8).join(', ')}${removedTypes.length > 8 ? ' …' : ''}`,
    );
  }
  if (changedTypes.length) {
    const pairs = changedTypes.slice(0, 4).map((k) => `${k}：${oldTypes[k]} → ${types[k]}`);
    violations.push(
      `types：签名变化 ${changedTypes.length} 项（破坏性 breaking！须按 docs/versioning.md 在 minor 公告并给迁移说明）：${pairs.join('；')}${changedTypes.length > 4 ? ' …' : ''}`,
    );
  }
  if (addedTypes.length) {
    violations.push(
      `types：新增 ${addedTypes.length} 项（additive，确认有意扩面后 bun run contracts:update 并随本 PR 提交）：${addedTypes.slice(0, 8).join(', ')}${addedTypes.length > 8 ? ' …' : ''}`,
    );
  }
  return violations;
}

/* ── tag 间 diff 模式（1.0 判定第一条与未来迁移页骨架共用同一工具）──
   bun scripts/contracts.ts --diff <refA> [refB] [--gate core]
   refB 缺省 = 工作树 snapshot.json；--gate core 时 Core 面有破坏性条目即 exit(1)。 */

import { execFileSync } from 'node:child_process';

type Tier = 'core' | 'beta' | 'lab' | 'unknown';

/** 从 git 引用读快照（ref 为 '-' 时读工作树快照文件）。 */
export async function snapshotAt(ref: string): Promise<Snapshot> {
  let snap: Snapshot;
  try {
    const text = ref === '-'
      ? await readFile(SNAPSHOT_PATH, 'utf8')
      : execFileSync('git', ['show', `${ref}:docs/contracts/snapshot.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    snap = JSON.parse(text) as Snapshot;
  } catch {
    throw new Error(`ref ${ref} 处读不到 docs/contracts/snapshot.json（快照机制在 v0.10.0 tag 之后引入，首个可作 diff 基线的发布 tag 是 v0.11.0）`);
  }
  if (!snap.surfaces || !snap.types) throw new Error(`ref ${ref} 的 snapshot.json 形态不符（缺 surfaces/types 面）`);
  return snap;
}

/* 分层归类：条目 → tier。映射面从当前 src 一次性构建（类名→CSS 模块、导出→行为模块），
   历史独有条目走族前缀推断（ai-/kb-/chart- → beta），仍不中 = unknown（gate 时按 core 从严）。 */
let tierCtx: {
  tiers: Record<string, string>;
  classModule: Map<string, string>;
  exportModule: Map<string, string>;
} | null = null;

async function tierContext() {
  if (tierCtx) return tierCtx;
  const tiersRaw = JSON.parse(await readFile(join(SRC, '..', 'docs', 'contracts', 'tiers.json'), 'utf8')) as Record<string, string[]>;
  const tiers: Record<string, string> = {};
  for (const [tier, mods] of Object.entries(tiersRaw)) for (const m of mods) tiers[m] = tier;

  const classModule = new Map<string, string>();
  const putAll = (mod: string, text: string) => {
    for (const m of text.matchAll(/\.icen-[a-zA-Z0-9_-]+/g)) if (!classModule.has(m[0].slice(1))) classModule.set(m[0].slice(1), mod);
  };
  for (const f of await collect(join(SRC, 'components'), ['.css'])) {
    putAll(basename(f).replace(/\.css$/, ''), (await codeLines(f)).join('\n'));
  }
  for (const f of await collect(join(SRC, 'tokens'), ['.css'])) putAll('tokens', (await codeLines(f)).join('\n'));
  putAll('base', (await codeLines(join(SRC, 'base.css'))).join('\n'));

  const exportModule = new Map<string, string>();
  for (const f of await collect(join(SRC, 'behaviors'), ['.ts'])) {
    const mod = basename(f).replace(/\.ts$/, '');
    for (const line of await codeLines(f)) {
      for (const m of line.matchAll(/export\s+(?:async\s+)?(?:function|const|class|let|type|interface|enum)\s+(\w+)/g)) {
        if (!exportModule.has(m[1])) exportModule.set(m[1], mod);
      }
    }
  }
  tierCtx = { tiers, classModule, exportModule };
  return tierCtx;
}

function familyOf(name: string): Tier | null {
  return /(^|[-:])(ai|kb|chart)-/.test(name) ? 'beta' : null;
}

/** 导出名族前缀（PascalCase 与已知 Beta 专名）：现有 src 映射不中时的回退信号。 */
function exportFamily(name: string): Tier | null {
  return /(Ai|Kb|Chart|Graph)/.test(name) || /^(lttb|chart)/.test(name) ? 'beta' : null;
}

async function tierOfEntry(face: string, entry: string): Promise<Tier> {
  const ctx = await tierContext();
  const ofModule = (mod: string | undefined): Tier | null =>
    mod == null ? null : mod === 'tokens' || mod === 'base' ? 'core' : ((ctx.tiers[mod] as Tier | undefined) ?? familyOf(mod) ?? 'core');
  switch (face) {
    case 'classes':
      return ofModule(ctx.classModule.get(entry)) ?? familyOf(entry) ?? 'unknown';
    case 'jsExports':
    case 'types':
      return ofModule(ctx.exportModule.get(entry)) ?? exportFamily(entry) ?? 'unknown';
    case 'events':
    case 'dataAttributes':
      return familyOf(entry) ?? 'core';
    default:
      return 'core'; // cssVariables：token 面全属 Core（beta 组件不定义自有变量，仅引用）
  }
}

interface DiffRow { face: string; kind: 'removed' | 'changed' | 'added'; entry: string; tier: Tier }

/** 两份快照的全面对比（六个面），每条差异带分层归类：优先读快照盖章，历史快照无盖章才现算。 */
export async function diffSnapshots(oldSnap: Snapshot, newSnap: Snapshot): Promise<DiffRow[]> {
  const rows: DiffRow[] = [];
  const stamped = (face: string, entry: string): Tier | undefined =>
    (oldSnap.tiers?.[`${face}:${entry}`] ?? newSnap.tiers?.[`${face}:${entry}`]) as Tier | undefined;
  const tier = async (face: string, entry: string): Promise<Tier> => stamped(face, entry) ?? tierOfEntry(face, entry);
  for (const s of SURFACES) {
    const { added, removed } = diff(oldSnap.surfaces[s] ?? [], newSnap.surfaces[s] ?? []);
    for (const e of removed) rows.push({ face: s, kind: 'removed', entry: e, tier: await tier(s, e) });
    for (const e of added) rows.push({ face: s, kind: 'added', entry: e, tier: await tier(s, e) });
  }
  const oldT = oldSnap.types ?? {};
  const newT = newSnap.types ?? {};
  for (const k of Object.keys(oldT).filter((k) => !(k in newT))) rows.push({ face: 'types', kind: 'removed', entry: k, tier: await tier('types', k) });
  for (const k of Object.keys(newT).filter((k) => !(k in oldT))) rows.push({ face: 'types', kind: 'added', entry: k, tier: await tier('types', k) });
  for (const k of Object.keys(newT).filter((k) => k in oldT && oldT[k] !== newT[k])) rows.push({ face: 'types', kind: 'changed', entry: k, tier: await tier('types', k) });
  return rows;
}

/* ── CLI 入口（bun scripts/contracts.ts [--write|--check|--diff]）──
   以 argv[0] 脚本路径判定直接执行（guard 经模块导入复用，不触发 CLI） */
const invokedAsCli = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/contracts.ts');
if (invokedAsCli) {
  const argv = process.argv.slice(2);
  const diffIdx = argv.indexOf('--diff');
  if (diffIdx !== -1) {
    const refA = argv[diffIdx + 1];
    if (!refA || refA.startsWith('--')) {
      console.error('用法：bun scripts/contracts.ts --diff <refA> [refB|-] [--gate core]');
      process.exit(2);
    }
    const refB = argv[diffIdx + 2] && !argv[diffIdx + 2].startsWith('--') ? argv[diffIdx + 2] : '-';
    const gateIdx = argv.indexOf('--gate');
    let gate: string | null = null;
    if (gateIdx !== -1) {
      gate = argv[gateIdx + 1] ?? null;
      if (!gate || gate.startsWith('--')) {
        console.error('✗ --gate 需要取值（如 --gate core）——门禁不会静默关闭，请补全参数');
        process.exit(2);
      }
    }
    let rows: DiffRow[];
    try {
      rows = await diffSnapshots(await snapshotAt(refA), await snapshotAt(refB));
    } catch (error) {
      console.error(`✗ ${(error as Error).message}`);
      process.exit(2);
    }
    const breaking = rows.filter((r) => r.kind !== 'added');
    const added = rows.filter((r) => r.kind === 'added');
    console.log(`── 契约 diff ${refA} → ${refB === '-' ? '工作树' : refB} ──`);
    if (!rows.length) console.log('✓ 零漂移');
    for (const r of [...breaking, ...added]) {
      const mark = r.kind === 'added' ? '+' : r.kind === 'removed' ? '-' : '~';
      console.log(`${mark} [${r.tier}] ${r.face}: ${r.entry}`);
    }
    console.log(`── 合计：破坏性 ${breaking.length}（core ${breaking.filter((r) => r.tier !== 'beta' && r.tier !== 'lab').length} / beta ${breaking.filter((r) => r.tier === 'beta').length}），新增 ${added.length} ──`);
    if (gate === 'core') {
      const coreBreaking = breaking.filter((r) => r.tier !== 'beta' && r.tier !== 'lab'); // unknown 从严按 core
      if (coreBreaking.length) {
        console.error(`✗ Core 面存在 ${coreBreaking.length} 项破坏性变化——1.0 判定不满足`);
        process.exit(1);
      }
      console.log('✓ Core 面零破坏（1.0 判定第一条满足）');
    }
  } else {
    const mode = argv.includes('--write') ? 'write' : 'check';
    if (mode === 'write') {
      console.log(`✓ 契约快照已写入 docs/contracts/snapshot.json（${await writeSnapshot()}）`);
    } else {
      const violations = await checkDrift();
      if (violations.length) {
        for (const v of violations) console.error(`✗ ${v}`);
        process.exit(1);
      }
      console.log(`✓ 契约快照无漂移（${surfaceCounts(await extractSurfaces(), await extractTypes())}）`);
    }
  }
}
