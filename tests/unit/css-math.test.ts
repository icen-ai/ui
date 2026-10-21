import { describe, expect, test } from 'bun:test';
import { resolveCssMath } from '../../scripts/css-math.mjs';

describe('design export scalar math', () => {
  test('resolves radius, nested density and durations with units intact', () => {
    const vars = new Map([['--radius', '10px'], ['--height', '34px'], ['--offset', '-6px'], ['--motion', '.5']]);
    expect(resolveCssMath('max(0px, calc(var(--radius) - 2px))', vars)).toEqual({ number: 8, unit: 'px' });
    expect(resolveCssMath('max(24px, calc(var(--height) + var(--offset) - 6px))', vars)).toEqual({ number: 24, unit: 'px' });
    expect(resolveCssMath('calc(.11s * var(--motion))', vars)).toEqual({ number: 55, unit: 'ms' });
    expect(resolveCssMath('clamp(8px, calc(4px * 3), 20px)')).toEqual({ number: 12, unit: 'px' });
    expect(resolveCssMath('calc((12px + 4px) / 2)')).toEqual({ number: 8, unit: 'px' });
  });
  test('rejects unresolved, cyclic, incompatible and non-scalar values', () => {
    const vars = new Map([['--a', 'var(--b)'], ['--b', 'var(--a)']]);
    for (const source of ['var(--missing)', 'var(--a)', 'calc(1px + 1rem)', 'calc(1px * 2px)', 'calc(1px / 0)', 'calc(1px / 1px)', 'max(1px, 2)', 'clamp(1px, 2px)', 'url(secret)', '1px; color:red', 'Infinity', 'calc(1em + 2em)'])
      expect(resolveCssMath(source, vars), source).toBeNull();
  });
});
