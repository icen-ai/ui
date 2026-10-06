// ai-tools 契约测试：工具注册表（register/unregister/get/list + 覆盖语义）、parseAiToolArgs
// 容错（JSON 串/对象/坏 JSON→{}）、模型侧三导出（OpenAI / MCP / manifest）输出形态快照。
// 语义源：src/behaviors/ai-tools.ts（spec §13）。
import { describe, expect, test } from 'bun:test';
import {
  aiToolsManifest,
  aiToolsToMcp,
  aiToolsToOpenAI,
  getAiTool,
  listAiTools,
  parseAiToolArgs,
  registerAiTool,
  unregisterAiTool,
} from '../../src/behaviors/ai-tools';

const CALC_DEF = {
  name: 'calc_bmi',
  description: '计算 BMI 指数，输入身高体重',
  inputSchema: {
    type: 'object',
    properties: { height: { type: 'number' }, weight: { type: 'number' } },
    required: ['height', 'weight'],
  },
  run: (input: unknown): unknown => {
    const { height, weight } = input as { height: number; weight: number };
    return weight / (height * height);
  },
};

describe('工具注册表（register / unregister / get / list）', () => {
  test('内置 render_chart 已注册（ChartSpec 纯 JSON 一个内置工具）', () => {
    const t = getAiTool('render_chart');
    expect(t).toBeDefined();
    expect(t?.description).toContain('图表');
    expect(t?.inputSchema).toMatchObject({ type: 'object' });
  });

  test('registerAiTool 注册后可按名取；listAiTools 快照含内置 + 自定义', () => {
    registerAiTool(CALC_DEF);
    expect(getAiTool('calc_bmi')).toBe(CALC_DEF);
    const names = listAiTools().map((t) => t.name);
    expect(names).toContain('render_chart');
    expect(names).toContain('calc_bmi');
  });

  test('同名注册覆盖；缺 name / 缺 run 的非法 def 被忽略', () => {
    registerAiTool(CALC_DEF);
    const v2 = { ...CALC_DEF, description: 'v2' };
    registerAiTool(v2);
    expect(getAiTool('calc_bmi')).toBe(v2);
    registerAiTool(CALC_DEF); /* 还原，避免污染后续导出快照 */

    const before = listAiTools().length;
    registerAiTool({ name: '', description: 'x', inputSchema: {}, run: () => 1 });
    registerAiTool({ name: 'no-run', description: 'x', inputSchema: {} } as never);
    expect(listAiTools()).toHaveLength(before);
  });

  test('unregisterAiTool 下架后 get 返回 undefined，list 同步收缩', () => {
    registerAiTool({ ...CALC_DEF, name: 'temp_tool' });
    expect(getAiTool('temp_tool')).toBeDefined();
    unregisterAiTool('temp_tool');
    expect(getAiTool('temp_tool')).toBeUndefined();
    expect(listAiTools().map((t) => t.name)).not.toContain('temp_tool');
  });
});

describe('parseAiToolArgs（模型回包解析容错）', () => {
  test('对象直给（非数组）原样返回', () => {
    const obj = { type: 'line', labels: ['a'] };
    expect(parseAiToolArgs(obj)).toBe(obj);
  });

  test('JSON 字符串解析为对象；数组形态的串落 {}', () => {
    expect(parseAiToolArgs('{"type":"donut"}')).toEqual({ type: 'donut' });
    expect(parseAiToolArgs('[1,2]')).toEqual({});
    expect(parseAiToolArgs('"just a string"')).toEqual({});
  });

  test('坏 JSON / null / undefined / 原始类型一律 {}（不抛异常）', () => {
    expect(parseAiToolArgs('{oops')).toEqual({});
    expect(parseAiToolArgs('')).toEqual({});
    expect(parseAiToolArgs(null)).toEqual({});
    expect(parseAiToolArgs(undefined)).toEqual({});
    expect(parseAiToolArgs(42)).toEqual({});
    expect(parseAiToolArgs([1, 2])).toEqual({});
  });
});

describe('模型侧导出（aiToolsToOpenAI / aiToolsToMcp / aiToolsManifest）', () => {
  test('aiToolsToOpenAI：function 定义形态（type/function.name/function.description/function.parameters）', () => {
    const out = aiToolsToOpenAI(['calc_bmi']);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      type: 'function',
      function: {
        name: 'calc_bmi',
        description: '计算 BMI 指数，输入身高体重',
        parameters: CALC_DEF.inputSchema,
      },
    });
  });

  test('aiToolsToOpenAI 过滤：精确名 + 前缀通配（前缀按字面匹配，chart-* 命中不了下划线名）；缺省 = 全部已注册', () => {
    registerAiTool({ ...CALC_DEF, name: 'chart_export' });
    expect(aiToolsToOpenAI(['render_chart']).map((t) => t.function.name)).toEqual(['render_chart']);
    expect(aiToolsToOpenAI(['calc_*']).map((t) => t.function.name)).toEqual(['calc_bmi']);
    expect(aiToolsToOpenAI(['chart-*']).length).toBe(0); /* 字面前缀：'chart_export' 第 6 位是 _ 不是 - */
    expect(aiToolsToOpenAI(['不存在']).length).toBe(0);
    expect(aiToolsToOpenAI().length).toBe(listAiTools().length);
  });

  test('aiToolsToMcp：name / description / inputSchema 三键形态', () => {
    const out = aiToolsToMcp(['render_chart']);
    expect(out).toHaveLength(1);
    const keys = Object.keys(out[0]!).sort();
    expect(keys).toEqual(['description', 'inputSchema', 'name']);
    expect(out[0]!.name).toBe('render_chart');
    expect(out[0]!.inputSchema).toMatchObject({ type: 'object' });
  });

  test('aiToolsManifest：清单头 + 每个工具一行 `- name：description`；过滤为空给「无已注册」文案', () => {
    const text = aiToolsManifest(['calc_bmi']);
    expect(text.startsWith('可用 UI 工具')).toBe(true);
    expect(text).toContain('- calc_bmi：计算 BMI 指数，输入身高体重');
    expect(aiToolsManifest(['nope-*'])).toBe('（无已注册的 UI 工具）');
  });
});
