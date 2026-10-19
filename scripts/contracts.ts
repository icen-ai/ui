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
 * 类名 / data 属性 / CSS 变量 / 事件名 / JS 导出钉成可 diff 的清单——
 * 移除或改名 = 破坏性变更，必须在 minor 里逐条公告；新增也要在此留痕。
 * 注：快照记录「存在面」，不预判语义；语义变化的公告仍归 CHANGELOG 纪律。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SRC, stripComments } from './guard/shared';

type Surface = 'classes' | 'dataAttributes' | 'cssVariables' | 'events' | 'jsExports';
const SURFACES: Surface[] = ['classes', 'dataAttributes', 'cssVariables', 'events', 'jsExports'];

interface Snapshot {
  version: string;
  note: string;
  surfaces: Record<Surface, string[]>;
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

  /* JS 导出面：直接 import 包入口取运行时导出名（含 VERSION）；类型导出不在此面 */
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

export function surfaceCounts(surfaces: Record<Surface, string[]>): string {
  return SURFACES.map((s) => `${s}=${surfaces[s].length}`).join(' ');
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
  const pkg = JSON.parse(await readFile(join(SRC, '..', 'package.json'), 'utf8'));
  const snap: Snapshot = {
    version: pkg.version,
    note: '公共契约面快照：bun run contracts:update 重新生成，随变更同 PR 提交；移除/改名=破坏性变更须按 docs/versioning.md 公告。',
    surfaces,
  };
  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snap, null, 2)}\n`, 'utf8');
  return surfaceCounts(surfaces);
}

/** 对比快照；返回漂移明细（空数组 = 无漂移），供守卫与 CLI 共用。 */
export async function checkDrift(): Promise<string[]> {
  const surfaces = await extractSurfaces();
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
    console.log(`✓ 契约快照无漂移（${surfaceCounts(await extractSurfaces())}）`);
  }
}
