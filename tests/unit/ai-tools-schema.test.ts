// AI 工具体系单测：模型侧导出四族（OpenAI / Anthropic / MCP / Vercel AI SDK，共享归一管线）
// + validateToolArgs 全规则矩阵（含 unvalidated 诚实清单）+ parseAiToolArgs 容错。
import { afterAll, describe, expect, test } from 'bun:test';
import {
  aiToolsToAiSdk, aiToolsToAnthropic, aiToolsToMcp, aiToolsToOpenAI, aiToolsManifest,
  parseAiToolArgs, registerAiTool, unregisterAiTool, validateToolArgs,
} from '../../src/behaviors/ai-tools';

/* 固定测试工具（glob 'unit_*' 隔离内置 render_chart）；模块级注册、文件收尾下架 */
const UNIT_TOOLS = [
  {
    name: 'unit_echo',
    description: '回声工具：返回输入（单测用）',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '任意文本' },
        loud: { type: 'boolean' },
      },
    },
    run: (input: unknown) => input,
  },
  {
    name: 'unit_fetch_rows',
    description: '拉取表格行（单测用）',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: ['users', 'orders'] },
        limit: { type: 'number', minimum: 1, maximum: 500 },
      },
      required: ['table'],
    },
    run: () => ({ rows: [] }),
  },
] as const;

for (const def of UNIT_TOOLS) registerAiTool(def as never);
afterAll(() => {
  for (const def of UNIT_TOOLS) unregisterAiTool(def.name);
});

describe('模型侧导出（四族共享同一归一管线）', () => {
  test('OpenAI：function.parameters 形态', () => {
    expect(aiToolsToOpenAI(['unit_*'])).toMatchSnapshot();
  });

  test('Anthropic：input_schema 形态', () => {
    expect(aiToolsToAnthropic(['unit_*'])).toMatchSnapshot();
  });

  test('MCP：inputSchema 形态', () => {
    expect(aiToolsToMcp(['unit_*'])).toMatchSnapshot();
  });

  test('Vercel AI SDK：name → { description, inputSchema } 描述表，不携带 execute', () => {
    const sdk = aiToolsToAiSdk(['unit_*']);
    expect(sdk).toMatchSnapshot();
    for (const desc of Object.values(sdk)) {
      expect(Object.keys(desc).sort()).toEqual(['description', 'inputSchema']);
    }
  });

  test('四族的 name/description/schema 内容严格一致（同一管线）', () => {
    const openai = aiToolsToOpenAI(['unit_*']);
    const anthropic = aiToolsToAnthropic(['unit_*']);
    const mcp = aiToolsToMcp(['unit_*']);
    const sdk = aiToolsToAiSdk(['unit_*']);
    const names = openai.map((t) => t.function.name);
    expect(anthropic.map((t) => t.name)).toEqual(names);
    expect(mcp.map((t) => t.name)).toEqual(names);
    expect(Object.keys(sdk).sort()).toEqual([...names].sort());
    for (let i = 0; i < openai.length; i++) {
      const schema = openai[i]!.function.parameters;
      expect(anthropic[i]!.input_schema).toBe(schema);
      expect(mcp[i]!.inputSchema).toBe(schema);
      expect(sdk[openai[i]!.function.name]!.inputSchema).toBe(schema);
    }
  });

  test('names 过滤：通配命中子集；未命中 → 空数组 / 空表 / 空清单文案', () => {
    expect(aiToolsToOpenAI(['unit_echo']).map((t) => t.function.name)).toEqual(['unit_echo']);
    expect(aiToolsToAnthropic(['nope'])).toEqual([]);
    expect(aiToolsToMcp(['nope'])).toEqual([]);
    expect(aiToolsToAiSdk(['nope'])).toEqual({});
    expect(aiToolsManifest(['nope'])).toBe('（无已注册的 UI 工具）');
  });

  test('缺省 names = 全部已注册（含内置 render_chart）', () => {
    const names = aiToolsToMcp().map((t) => t.name);
    expect(names).toContain('render_chart');
    expect(names).toContain('unit_echo');
  });

  test('manifest：清单文本含全部工具名', () => {
    const text = aiToolsManifest(['unit_*']);
    expect(text).toContain('unit_echo');
    expect(text).toContain('unit_fetch_rows');
  });
});

describe('validateToolArgs：type 矩阵', () => {
  test.each([
    ['object', { a: 1 }, true],
    ['object', [1, 2], false],
    ['object', null, false],
    ['array', [1], true],
    ['array', 'x', false],
    ['string', 'x', true],
    ['string', 1, false],
    ['number', 1.5, true],
    ['number', '1', false],
    ['number', Number.NaN, false],
    ['integer', 2, true],
    ['integer', 2.5, false],
    ['boolean', true, true],
    ['boolean', 0, false],
    ['null', null, true],
    ['null', 0, false],
  ])('type %s × %j → ok=%s', (type, value, ok) => {
    const r = validateToolArgs({ type }, value);
    expect(r.ok).toBe(ok);
    if (!ok) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]!.path).toBe('$');
    }
  });

  test('未知类型名不猜：放行并记 unvalidated', () => {
    const r = validateToolArgs({ type: 'funky' }, 42);
    expect(r.ok).toBe(true);
    expect(r.unvalidated).toContain('$.type');
  });

  test('联合类型（type 数组）不猜：放行并记 unvalidated', () => {
    const r = validateToolArgs({ type: ['string', 'null'] }, 'x');
    expect(r.ok).toBe(true);
    expect(r.unvalidated).toContain('$.type');
  });
});

describe('validateToolArgs：required / properties / 路径', () => {
  const SCHEMA = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['name'],
  } as const;

  test('缺必填字段：path 指向缺失字段', () => {
    const r = validateToolArgs(SCHEMA as never, { tags: [] });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([{ path: '$.name', message: '缺少必填字段' }]);
  });

  test('嵌套路径：$.tags[1]', () => {
    const r = validateToolArgs(SCHEMA as never, { name: 'a', tags: ['ok', 7] });
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.path).toBe('$.tags[1]');
    expect(r.errors[0]!.message).toContain('期望 string');
  });

  test('可选字段缺省不做任何断言', () => {
    const r = validateToolArgs(SCHEMA as never, { name: 'a' });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('series[2].name 深层路径', () => {
    const r = validateToolArgs(
      {
        type: 'object',
        properties: {
          series: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
      { series: [{ name: 'a' }, { name: 'b' }, { values: [] }] },
    );
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.path).toBe('$.series[2].name');
  });
});

describe('validateToolArgs：enum / 数值界 / 字符串界', () => {
  test('enum 违反列出允许取值；字符串枚举不带引号', () => {
    const r = validateToolArgs(
      { type: 'object', properties: { role: { type: 'string', enum: ['admin', 'viewer'] } } },
      { role: 'root' },
    );
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.path).toBe('$.role');
    expect(r.errors[0]!.message).toContain('admin / viewer');
  });

  test('minimum / maximum（含端点通过）', () => {
    const schema = { type: 'object', properties: { n: { type: 'number', minimum: 1, maximum: 10 } } };
    expect(validateToolArgs(schema, { n: 1 }).ok).toBe(true);
    expect(validateToolArgs(schema, { n: 10 }).ok).toBe(true);
    const lo = validateToolArgs(schema, { n: 0 });
    expect(lo.ok).toBe(false);
    expect(lo.errors[0]!.message).toContain('小于最小值 1');
    const hi = validateToolArgs(schema, { n: 11 });
    expect(hi.errors[0]!.message).toContain('大于最大值 10');
  });

  test('minLength / maxLength', () => {
    const schema = { type: 'object', properties: { s: { type: 'string', minLength: 2, maxLength: 4 } } };
    expect(validateToolArgs(schema, { s: 'ab' }).ok).toBe(true);
    const short = validateToolArgs(schema, { s: 'a' });
    expect(short.errors[0]!.message).toContain('长度 1 小于下限 2');
    const long = validateToolArgs(schema, { s: 'abcde' });
    expect(long.errors[0]!.message).toContain('长度 5 超过上限 4');
  });

  test('多错误并列收集（不短路）', () => {
    const r = validateToolArgs(
      { type: 'object', properties: { a: { type: 'number' }, b: { type: 'string' } }, required: ['a', 'b', 'c'] },
      { a: 'x', b: 2 },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.path).sort()).toEqual(['$.a', '$.b', '$.c']);
  });
});

describe('validateToolArgs：items 一层规则（诚实纪律）', () => {
  test('一层 items 逐元素校验；二层数组不展开、记 unvalidated', () => {
    const schema = {
      type: 'object',
      properties: {
        matrix: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
      },
    };
    /* 二层元素是字符串但 schema 要求 number：一层规则不展开 → 不报错，诚实标注 */
    const r = validateToolArgs(schema, { matrix: [[1, 'x']] });
    expect(r.ok).toBe(true);
    expect(r.unvalidated).toContain('$.properties.matrix.items.items');
  });

  test('一层内对象元素的 properties 仍生效', () => {
    const schema = {
      type: 'object',
      properties: {
        rows: { type: 'array', items: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } },
      },
    };
    const r = validateToolArgs(schema, { rows: [{ id: 1 }, { name: 'x' }] });
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.path).toBe('$.rows[1].id');
  });
});

describe('validateToolArgs：unvalidated 诚实清单', () => {
  test('oneOf / anyOf / $ref / format / pattern / additionalProperties 全部入清单且不执行', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        mode: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        ref: { $ref: '#/$defs/x' },
        code: { type: 'string', pattern: '^[a-z]+$' },
      },
      additionalProperties: false,
    };
    /* format/oneOf/$ref/pattern/additionalProperties 全部未生效但不猜：坏值也判 ok */
    const r = validateToolArgs(schema, { email: 'not-an-email', mode: true, ref: 42, code: 'ABC', extra: 1 });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.unvalidated).toContain('$.properties.email.format');
    expect(r.unvalidated).toContain('$.properties.mode.oneOf');
    expect(r.unvalidated).toContain('$.properties.ref.$ref');
    expect(r.unvalidated).toContain('$.properties.code.pattern');
    expect(r.unvalidated).toContain('$.additionalProperties');
  });

  test('annotation 关键字（description/title/default）静默跳过、不进清单', () => {
    const r = validateToolArgs(
      { type: 'object', description: 'x', title: 'y', default: {}, properties: { a: { type: 'string', description: 'd' } } },
      { a: 'ok' },
    );
    expect(r.ok).toBe(true);
    expect(r.unvalidated).toEqual([]);
  });

  test('未访问节点的关键字不进清单（清单只对实际校验负责）', () => {
    const schema = {
      type: 'object',
      properties: { unused: { type: 'string', format: 'email' } },
    };
    const r = validateToolArgs(schema, {});
    expect(r.unvalidated).toEqual([]);
  });

  test('schema 本身不是对象：整体记 unvalidated', () => {
    const r = validateToolArgs('not-a-schema' as never, { a: 1 });
    expect(r.ok).toBe(true);
    expect(r.unvalidated).toEqual(['$']);
  });
});

describe('parseAiToolArgs（保持现状：容错 → {}）', () => {
  test('对象直给 / JSON 字符串 / 坏 JSON / 数组 / 原始值', () => {
    expect(parseAiToolArgs({ a: 1 })).toEqual({ a: 1 });
    expect(parseAiToolArgs('{"a":1}')).toEqual({ a: 1 });
    expect(parseAiToolArgs('{oops')).toEqual({});
    expect(parseAiToolArgs('[1,2]')).toEqual({});
    expect(parseAiToolArgs(42)).toEqual({});
    expect(parseAiToolArgs(null)).toEqual({});
  });
});
