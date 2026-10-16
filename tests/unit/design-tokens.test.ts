// scripts/design-tokens.mjs 产物契约测试：先 bun run dtcg 再跑 design-tokens（脚本自身
// 也会自举，测试按任务约定显式先跑 dtcg）。断言：
//   tokens-studio —— $themes 恰 12 组（6 预设 × 明暗）、每 theme 只 enable 自己的 set、
//     tokenSetOrder 与 set 键一致、set 结构含组级 $type 且 token 均带 $value。
//   figma.variables —— 6 个 collection（每预设一个）× 每 collection 恰 light/dark 两面
//     （共 12 个变量面）；每变量 valuesByMode 恰好两 mode；COLOR 各分量在 [0,1]、
//     FLOAT 为 number、STRING 为 string；别名 {VARIABLE_ALIAS} 全部指向本 collection
//     内存在的变量 id。
//   诚实跳过 —— 上游 dtcg 跳过清单非空时脚本必须打印（stdout 含条目），且被跳过项
//     （如 box-shadow 的 --icen-token-shadow-card）不出现在两个产物里。
import { beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const PRESETS = ['benzhen', 'clay', 'piano', 'art', 'vangogh', 'ink'];

type TokensStudio = {
  $themes: { id: string; name: string; selectedTokenSets: Record<string, string> }[];
  $metadata: { tokenSetOrder: string[] };
  [setName: string]: unknown;
};

type FigmaValue =
  | { r: number; g: number; b: number; a: number }
  | { type: 'VARIABLE_ALIAS'; id: string }
  | number
  | string;

type FigmaVariable = {
  id: string;
  name: string;
  type: 'COLOR' | 'FLOAT' | 'STRING';
  valuesByMode: Record<string, FigmaValue>;
};

type FigmaVariables = {
  variableCollections: { name: string; modes: { name: string }[]; variables: FigmaVariable[] }[];
};

let ts: TokensStudio;
let fv: FigmaVariables;
let dtcgRaw: string;
let runLog: string;

beforeAll(() => {
  const dtcgRun = spawnSync('bun', ['run', 'dtcg'], { cwd: ROOT, encoding: 'utf8' });
  expect(dtcgRun.status).toBe(0);
  const run = spawnSync('bun', ['scripts/design-tokens.mjs'], { cwd: ROOT, encoding: 'utf8' });
  expect(run.status).toBe(0);
  runLog = `${run.stdout}\n${run.stderr}`;
  ts = JSON.parse(readFileSync(join(ROOT, 'dist', 'tokens', 'tokens-studio.json'), 'utf8'));
  fv = JSON.parse(readFileSync(join(ROOT, 'dist', 'tokens', 'figma.variables.json'), 'utf8'));
  dtcgRaw = readFileSync(join(ROOT, 'dist', 'tokens', 'dtcg.json'), 'utf8');
}, 120_000);

describe('tokens-studio.json', () => {
  test('$themes 恰 12 组（6 预设 × 明暗），命名与 set 键一一对应', () => {
    expect(ts.$themes).toHaveLength(12);
    const expected = PRESETS.flatMap((p) => [`${p} / light`, `${p} / dark`]);
    expect(ts.$themes.map((t) => t.name)).toEqual(expected);
    for (const t of ts.$themes) {
      const setName = t.name.replace(' / ', '/');
      expect(t.selectedTokenSets).toEqual({ [setName]: 'enabled' });
    }
  });

  test('$metadata.tokenSetOrder 与产物内 set 键完全一致', () => {
    const sets = Object.keys(ts).filter((k) => !k.startsWith('$'));
    expect(ts.$metadata.tokenSetOrder).toEqual(sets);
    expect(sets).toHaveLength(12);
  });

  test('set 结构保留组层级与组级 $type，token 均带 $value', () => {
    for (const setName of ts.$metadata.tokenSetOrder) {
      const set = ts[setName] as Record<string, any>;
      const groups = Object.entries(set).filter(([k, v]) => !k.startsWith('$') && v && typeof v === 'object');
      expect(groups.length).toBeGreaterThan(0);
      for (const [gname, group] of groups) {
        expect(group.$type, `${setName}.${gname} 应有组级 $type`).toBeTruthy();
        const tokens = Object.entries(group).filter(([k, v]) => !k.startsWith('$') && v && typeof v === 'object' && '$value' in v);
        expect(tokens.length, `${setName}.${gname} 不应为空组`).toBeGreaterThan(0);
        for (const [tname, token] of tokens) {
          expect(token.$value, `${setName}.${gname}.${tname} 应带 $value`).toBeDefined();
        }
      }
    }
    // 抽查：组级 $type 与别名形态与上游 dtcg 一致（直映射语义）
    const clayLight = ts['clay/light'] as Record<string, any>;
    expect(clayLight.token.$type).toBe('color');
    expect(clayLight.radius.$type).toBe('dimension');
    expect(clayLight.design.canvas.$value).toBe('#faf7f2');
    expect(clayLight.token.bg.$value).toBe('{clay.light.design.canvas}');
    expect(clayLight.token.canvas.$value).toBe('{clay.light.token.bg}');
    expect(clayLight.token.accent.$extensions['ai.icen.raw']).toBe('--icen-token-accent');
  });
});

describe('figma.variables.json', () => {
  test('6 个 collection（每预设一个），各含 light/dark 两面（合计 12 个变量面）', () => {
    expect(fv.variableCollections).toHaveLength(6);
    expect(fv.variableCollections.map((c) => c.name)).toEqual(PRESETS.map((p) => `icen / ${p}`));
    for (const col of fv.variableCollections) {
      expect(col.modes).toEqual([{ name: 'light' }, { name: 'dark' }]);
    }
  });

  test('每变量 valuesByMode 恰好覆盖 light/dark 两面，id 与 name 路径编码稳定', () => {
    let total = 0;
    for (const col of fv.variableCollections) {
      const preset = col.name.replace('icen / ', '');
      const ids = new Set<string>();
      for (const v of col.variables) {
        total++;
        expect(Object.keys(v.valuesByMode).sort()).toEqual(['dark', 'light']);
        expect(v.id).toBe(`icen/${preset}/${v.name}`);
        expect(ids.has(v.id)).toBe(false);
        ids.add(v.id);
      }
      // Require the actual exported contract rather than an incidental token count.
      for (const required of ['token/bg','token/text','token/accent','font/body','design/space']) {
        expect(col.variables.some((v)=>v.name===required),`${preset} must export ${required}`).toBe(true);
      }
    }
  });

  test('COLOR 值 {r,g,b,a} 全部在 [0,1]；FLOAT 为 number；STRING 为 string', () => {
    let colorCount = 0;
    let floatCount = 0;
    let stringCount = 0;
    for (const col of fv.variableCollections) {
      for (const v of col.variables) {
        for (const val of Object.values(v.valuesByMode)) {
          if (val && typeof val === 'object' && 'type' in val && val.type === 'VARIABLE_ALIAS') continue; // 别名由独立用例校验
          if (v.type === 'COLOR') {
            colorCount++;
            const c = val as { r: number; g: number; b: number; a: number };
            expect(typeof c.r).toBe('number');
            for (const comp of [c.r, c.g, c.b, c.a]) {
              expect(comp).toBeGreaterThanOrEqual(0);
              expect(comp).toBeLessThanOrEqual(1);
            }
          } else if (v.type === 'FLOAT') {
            floatCount++;
            expect(typeof val).toBe('number');
          } else {
            stringCount++;
            expect(typeof val).toBe('string');
          }
        }
      }
    }
    expect(colorCount).toBeGreaterThan(0);
    expect(floatCount).toBeGreaterThan(0);
    expect(stringCount).toBeGreaterThan(0);
  });

  test('dimension 保留原语空间种子 4px；计算式密度按诚实跳过规则处理', () => {
    const clay = fv.variableCollections[0];
    const spaceXs = clay.variables.find((v) => v.name === 'design/space');
    expect(spaceXs?.type).toBe('FLOAT');
    expect(spaceXs?.valuesByMode.light).toBe(4);
  });

  test('别名引用（VARIABLE_ALIAS）全部指向本 collection 内存在的变量 id', () => {
    let aliasCount = 0;
    for (const col of fv.variableCollections) {
      const ids = new Set(col.variables.map((v) => v.id));
      for (const v of col.variables) {
        for (const val of Object.values(v.valuesByMode)) {
          if (val && typeof val === 'object' && 'type' in val && val.type === 'VARIABLE_ALIAS') {
            aliasCount++;
            expect(ids.has(val.id), `${col.name}/${v.name} 别名指向 ${val.id} 应存在`).toBe(true);
          }
        }
      }
    }
    expect(aliasCount).toBeGreaterThan(0);
  });
});

describe('诚实跳过', () => {
  test('上游 dtcg 跳过清单非空 → 脚本打印清单', () => {
    const dtcg = JSON.parse(dtcgRaw);
    const skipped = dtcg.$extensions?.['ai.icen.skipped'] ?? {};
    const entries = Object.entries(skipped) as [string, { name: string; reason: string }[]][];
    expect(entries.length).toBeGreaterThan(0); // 前提：上游确有跳过（color-mix/box-shadow 等）
    expect(runLog).toContain('上游 dtcg 跳过');
    for (const [, list] of entries.slice(0, 3)) {
      expect(runLog).toContain(list[0].name);
    }
  });

  test('被跳过项不进产物（box-shadow 与 color-mix 派生色缺席）', () => {
    // --icen-token-shadow-card 是 box-shadow 值，上游必被跳过
    expect(dtcgRaw).toContain('--icen-token-shadow-card');
    expect(runLog).toContain('--icen-token-shadow-card');
    const tsRaw = JSON.stringify(ts);
    const fvRaw = JSON.stringify(fv);
    expect(tsRaw).not.toContain('--icen-token-shadow-card');
    expect(fvRaw).not.toContain('shadow-card');
    expect(fvRaw).not.toContain('shadow-overlay');
    // 派生色别名 --icen-bg-hover 断链于 color-mix 目标 → 同样不进产物
    expect(runLog).toContain('--icen-bg-hover');
    expect(tsRaw).not.toContain('--icen-bg-hover');
    expect(fvRaw).not.toContain('bg/hover');
  });

  test('derived semantic fills are consistently skipped in both modes', () => {
    expect(runLog).toContain('--icen-token-success-muted');
    expect(runLog).toContain('--icen-token-error-muted');
    const clay = fv.variableCollections.find((c) => c.name === 'icen / clay');
    const clayNames = new Set(clay?.variables.map((v) => v.name));
    expect(clayNames.has('token/success-muted')).toBe(false);
    expect(clayNames.has('token/error-muted')).toBe(false);
    expect(clayNames.has('color/success-bg')).toBe(false);
    expect(clayNames.has('color/error-bg')).toBe(false);
  });
});
