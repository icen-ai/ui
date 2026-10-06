// SSR 守卫静态冒烟：每个 behavior 模块要么含 typeof document/window 守卫，要么完全不触碰
// DOM API（纯函数层）——锁定「全部 SSR 安全」的仓库纪律（AGENTS.md：window 未定义静默返回）。
// 静态检查（读文件文本），不做运行时 SSR（happy-dom 已全局注册 document）。
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const BEHAVIORS_DIR = join(ROOT, 'src', 'behaviors');

const files = readdirSync(BEHAVIORS_DIR).filter((f) => f.endsWith('.ts')).sort();

describe('behavior 模块 SSR 守卫（70 个模块全量静态扫描）', () => {
  test('模块清单非空且规模不小于 70（库规模下限，新增模块自动包容）', () => {
    expect(files.length).toBeGreaterThanOrEqual(70);
  });

  test('每个模块：含 typeof document/window 守卫，或零 DOM API 引用（纯函数豁免）', () => {
    const violations: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(BEHAVIORS_DIR, f), 'utf8');
      const hasGuard = src.includes('typeof document') || src.includes('typeof window');
      const touchesDom = /(?:\bdocument\.|\bwindow\.|(?:\bnew\s+DOMParser\b)|\blocalStorage\b|\brequestAnimationFrame\b)/.test(src);
      if (!hasGuard && touchesDom) {
        violations.push(`${f}：无守卫且引用 DOM API`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('纯函数层 kb-core.ts 是契约层（无 DOM 引用，豁免守卫）', () => {
    const src = readFileSync(join(BEHAVIORS_DIR, 'kb-core.ts'), 'utf8');
    expect(src.includes('typeof document')).toBe(false);
    expect(/\bdocument\.|\bwindow\./.test(src)).toBe(false);
  });

  test('守卫形态 sanity：typeof document === 未定义静默返回的骨架在关键模块中存在', () => {
    for (const f of ['modal.ts', 'select.ts', 'theme.ts', 'toast.ts', 'datatable.ts', 'popover.ts']) {
      const src = readFileSync(join(BEHAVIORS_DIR, f), 'utf8');
      expect(src.includes('typeof document')).toBe(true);
    }
  });
});
