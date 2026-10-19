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
import { join } from 'node:path';
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
  const snap: Snapshot = {
    version: pkg.version,
    note: '公共契约面快照：bun run contracts:update 重新生成，随变更同 PR 提交；移除/改名/签名变化=破坏性变更须按 docs/versioning.md 公告。',
    surfaces,
    types,
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

/* ── CLI 入口（bun scripts/contracts.ts [--write|--check]）──
   以 argv[0] 脚本路径判定直接执行（guard 经模块导入复用，不触发 CLI） */
const invokedAsCli = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/contracts.ts');
if (invokedAsCli) {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
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
