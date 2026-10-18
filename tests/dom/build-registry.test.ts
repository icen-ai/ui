// 构建产物契约测试：dist/registry.json 与 scripts/slugs.mjs 对齐（slug 数 / kit 入口文件存在）、
// dist/tokens.css 顶部层序声明。
// dist 缺失或 slug 数失配时先用 bun scripts/build-css.ts 自举再断言。
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error slugs.mjs 无类型声明（scripts/ 下纯数据模块）
import { SLUGS } from '../../scripts/slugs.mjs';

const ROOT = join(import.meta.dir, '..', '..');
const REG_PATH = join(ROOT, 'dist', 'registry.json');

interface Registry {
  name: string;
  slugs: Record<string, { css: string }>;
}

function loadRegistry(): Registry | null {
  let reg = readRegistry();
  if (reg && Object.keys(reg.slugs).length === (SLUGS as string[]).length) return reg;
  /* dist 缺失或 slug 数失配：先自举重建再读 */
  spawnSync('bun', ['scripts/build-css.ts'], { cwd: ROOT, stdio: 'ignore' });
  reg = readRegistry();
  return reg;
}

function readRegistry(): Registry | null {
  if (!existsSync(REG_PATH)) return null;
  return JSON.parse(readFileSync(REG_PATH, 'utf8')) as Registry;
}

const registry = loadRegistry();

describe('dist/registry.json（与 slugs.mjs 对齐）', () => {
  test('registry 存在且为 @icen.ai/ui 的 slug 登记面', () => {
    expect(registry).not.toBeNull();
    expect(registry!.name).toBe('@icen.ai/ui');
    expect(Object.keys(registry!.slugs).length).toBeGreaterThan(0);
  });

  test('registry 的 slug 集合是 slugs.mjs SLUGS 的子集（无孤儿登记）', () => {
    const src = new Set(SLUGS as string[]);
    const orphans = Object.keys(registry!.slugs).filter((s) => !src.has(s));
    expect(orphans).toEqual([]);
  });

  test('slug 数 = slugs.mjs 的 SLUGS 数（全量对齐）', () => {
    expect(Object.keys(registry!.slugs).length).toBe((SLUGS as string[]).length);
  });

  test('每个已登记 slug 的 kit 入口文件 dist/components/<slug>.mjs 存在', () => {
    for (const slug of Object.keys(registry!.slugs)) {
      expect(existsSync(join(ROOT, 'dist', 'components', `${slug}.mjs`)), `kit/${slug}`).toBe(true);
    }
  });

  test('每个已登记 slug 声明的 css 产物 dist/components/<css> 存在', () => {
    for (const [slug, meta] of Object.entries(registry!.slugs)) {
      expect(existsSync(join(ROOT, 'dist', 'components', meta.css)), `${slug} → ${meta.css}`).toBe(true);
    }
  });
});

describe('dist 产物形态', () => {
  test('dist/tokens.css 顶部含 cascade layer 锚定声明（层序唯一事实源）', () => {
    const head = readFileSync(join(ROOT, 'dist', 'tokens.css'), 'utf8').slice(0, 200);
    expect(head).toContain('@layer icen.tokens, icen.base, icen.components;');
  });

});
