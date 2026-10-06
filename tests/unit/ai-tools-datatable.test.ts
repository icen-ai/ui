// ai-tools 内置 render_datatable 契约测试：注册面 / inputSchema 形态 / validateToolArgs 校验 /
// run 归一容错 + createTable 实际渲染行数（happy-dom mount div）。
// 语义源：src/behaviors/ai-tools.ts（内置工具，随模块 import 注册）。
import { describe, expect, test } from 'bun:test';
import {
  aiToolsToAnthropic,
  aiToolsToOpenAI,
  getAiTool,
  validateToolArgs,
  type AiToolDef,
} from '../../src/behaviors/ai-tools';

const def = (): AiToolDef => {
  const d = getAiTool('render_datatable');
  if (!d) throw new Error('render_datatable 未注册');
  return d;
};

const schema = (): Record<string, unknown> => def().inputSchema;

const runTool = (input: unknown): { mount: HTMLElement; out: unknown } => {
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const ctx = { signal: new AbortController().signal, progress: () => undefined };
  const out = def().run(input, mount, ctx);
  return { mount, out };
};

describe('内置工具 render_datatable', () => {
  test('已注册：name/description/inputSchema 齐备', () => {
    const d = def();
    expect(d.name).toBe('render_datatable');
    expect(d.description.length).toBeGreaterThan(0);
    expect(d.inputSchema.type).toBe('object');
  });

  test('schema 形态：columns 元素 required [key,title]，整体 required [columns,rows]', () => {
    const s = schema() as {
      required: string[];
      properties: Record<string, { type: string; items?: { type: string; required?: string[] } }>;
    };
    expect(s.required).toEqual(['columns', 'rows']);
    expect(s.properties.columns.type).toBe('array');
    expect(s.properties.columns.items?.type).toBe('object');
    expect(s.properties.columns.items?.required).toEqual(['key', 'title']);
    expect(s.properties.rows.type).toBe('array');
    expect(s.properties.title.type).toBe('string');
  });

  test('validateToolArgs：合法输入通过，缺 columns / 列缺 title 失败', () => {
    expect(
      validateToolArgs(schema(), {
        title: 'T',
        columns: [{ key: 'name', title: '名称', sortable: true, filterable: false }],
        rows: [{ name: 'x' }],
      }).ok,
    ).toBe(true);
    expect(validateToolArgs(schema(), { rows: [{ name: 'x' }] }).ok).toBe(false);
    expect(validateToolArgs(schema(), { columns: [{ key: 'name' }], rows: [] }).ok).toBe(false);
  });

  test('模型侧导出四族管线含 render_datatable', () => {
    expect(aiToolsToOpenAI(['render_datatable']).map((t) => t.function.name)).toEqual(['render_datatable']);
    expect(aiToolsToAnthropic(['render_datatable']).map((t) => t.name)).toEqual(['render_datatable']);
  });

  test('run：createTable 渲染行数，返回 { title, rows } 摘要', () => {
    const { mount, out } = runTool({
      title: '成员表',
      columns: [
        { key: 'name', title: '名称', sortable: true },
        { key: 'role', title: '角色', filterable: true },
      ],
      rows: [
        { name: 'alice', role: 'admin' },
        { name: 'bob', role: 'member' },
        { name: 'carol', role: 'guest' },
      ],
    });
    expect(out).toEqual({ title: '成员表', rows: 3 });
    /* createTable 真实渲染：体行 .icen-dt-row[data-icen-row]，表头行不混入 */
    expect(mount.querySelectorAll('.icen-dt-row[data-icen-row]').length).toBe(3);
    expect(mount.querySelector('.icen-datatable') !== null).toBe(true);
    mount.remove();
  });

  test('run：行/列归一容错——坏行丢弃、缺 title 回退 key、非数组输入归零', () => {
    const { mount, out } = runTool({
      columns: [{ key: 'name' }, { nope: true }, 'junk'],
      rows: [{ name: 'a' }, 'junk', null, [1]],
    });
    expect(out).toEqual({ title: undefined, rows: 1 });
    expect(mount.querySelectorAll('.icen-dt-row[data-icen-row]').length).toBe(1);
    mount.remove();
  });
});
