// ai-core 契约层语义测试：六族 wire 格式 → 归一模型（normalizeToolCall / normalizeUsage /
// normalizeContentParts）、估算器口径（CJK ×0.6）、kind 注册表与 inferKind 推断矩阵。
// 语义源：src/behaviors/ai-core.ts（spec §1 状态机 / §4.4 kind 清单 / §10 内容模型）。
import { describe, expect, test } from 'bun:test';
import {
  aiContentUrl,
  contentToText,
  contextEstimate,
  estimateTokens,
  getAiKind,
  inferKind,
  normalizeContentParts,
  normalizeToolCall,
  normalizeUsage,
  registerAiKind,
} from '../../src/behaviors/ai-core';

describe('normalizeToolCall（OpenAI / Anthropic / AI SDK / AG-UI / 素朴 六族线格式归一）', () => {
  test('OpenAI tool_calls 项：function.arguments JSON 串解析为 input，无输出时 pending', () => {
    const m = normalizeToolCall({
      id: 'call_1',
      type: 'function',
      function: { name: 'Bash', arguments: '{"command":"ls -la"}' },
    });
    expect(m).toMatchObject({
      id: 'call_1',
      name: 'Bash',
      kind: 'shell',
      status: 'pending',
      input: { command: 'ls -la' },
    });
  });

  test('Anthropic tool_use block：type 优先定 pending；input 对象直取', () => {
    const m = normalizeToolCall({ type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: 'a.ts' } });
    expect(m.status).toBe('pending');
    expect(m.input).toEqual({ file_path: 'a.ts' });
  });

  test('Anthropic tool_result：content 落 output；is_error 定 error 并回填 errorText', () => {
    const ok = normalizeToolCall({ type: 'tool_result', tool_use_id: 'tu_1', content: '读取完成' });
    expect(ok.status).toBe('done');
    expect(ok.output).toBe('读取完成');

    const bad = normalizeToolCall({ type: 'tool_result', tool_use_id: 'tu_1', content: 'boom', is_error: true });
    expect(bad.status).toBe('error');
    expect(bad.errorText).toBe('boom');
  });

  test('AI SDK tool-* part：tool-input-streaming=pending / tool-output-available=done / tool-output-error=error / approval-requested=approval', () => {
    expect(normalizeToolCall({ type: 'tool-input-streaming', toolCallId: 't', toolName: 'Bash', input: {} }).status).toBe('pending');
    const done = normalizeToolCall({ type: 'tool-output-available', toolCallId: 't', toolName: 'Bash', input: {}, output: 'ok' });
    expect(done.status).toBe('done');
    expect(done.output).toBe('ok');
    expect(normalizeToolCall({ type: 'tool-output-error', toolCallId: 't', toolName: 'Bash', input: {} }).status).toBe('error');
    const approval = normalizeToolCall({ type: 'approval-requested', toolCallId: 't', toolName: 'Bash', input: {} });
    expect(approval.status).toBe('approval');
  });

  test('AG-UI tool_call_result 事件名映射为 done', () => {
    const m = normalizeToolCall({ type: 'tool_call_result', toolCallId: 't', toolName: 'Bash', output: 'icen-result' });
    expect(m.status).toBe('done');
  });

  test('素朴对象：显式 status 收死七态；arguments 串同 OpenAI 解析；嵌套 activities 递归归一', () => {
    const m = normalizeToolCall({
      id: 'x',
      name: 'Subagent',
      status: 'streaming',
      arguments: '{"task":"verify"}',
      activities: [{ name: 'Bash', status: 'done', output: 'ok' }],
    });
    expect(m.status).toBe('streaming');
    expect(m.input).toEqual({ task: 'verify' });
    expect(m.activities).toHaveLength(1);
    expect(m.activities?.[0]).toMatchObject({ name: 'Bash', status: 'done', output: 'ok' });
  });

  test('字符串视为工具名；坏 JSON arguments 保留原文不抛异常', () => {
    expect(normalizeToolCall('Bash')).toMatchObject({ name: 'Bash', kind: 'shell', status: 'pending' });
    const m = normalizeToolCall({ name: 'Bash', arguments: '{oops' });
    expect(m.input).toBe('{oops');
  });

  test('状态推断兜底：errorText 在 > output 在 > pending；duration/usage 槽位透传', () => {
    expect(normalizeToolCall({ name: 'A', errorText: 'x' }).status).toBe('error');
    expect(normalizeToolCall({ name: 'A', output: 'y' }).status).toBe('done');
    expect(normalizeToolCall({ name: 'A' }).status).toBe('pending');
    const m = normalizeToolCall({ name: 'A', durationMs: 12, usage: { input_tokens: 3 } });
    expect(m.durationMs).toBe(12);
    expect(m.usage).toEqual({ input: 3, total: 3 });
  });
});

describe('normalizeUsage（各家缓存字段归一）', () => {
  test('OpenAI：prompt/completion + cached_tokens 进 cacheRead + reasoning_tokens 进 reasoning + total 直取', () => {
    const u = normalizeUsage({
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      prompt_tokens_details: { cached_tokens: 40 },
      completion_tokens_details: { reasoning_tokens: 5 },
    });
    expect(u).toEqual({ input: 100, output: 20, cacheRead: 40, reasoning: 5, total: 120 });
  });

  test('Anthropic：cache_read/creation 分列；input 不含缓存，total 缺省自动加回（口径注释）', () => {
    const u = normalizeUsage({ input_tokens: 50, output_tokens: 10, cache_read_input_tokens: 30, cache_creation_input_tokens: 8 });
    expect(u).toEqual({ input: 50, output: 10, cacheRead: 30, cacheWrite: 8, total: 98 });
  });

  test('DeepSeek prompt_cache_hit_tokens 与 Kimi cached_tokens + cache_write_tokens 归一', () => {
    expect(normalizeUsage({ prompt_cache_hit_tokens: 7 }).cacheRead).toBe(7);
    expect(normalizeUsage({ cached_tokens: 9, prompt_tokens_details: { cache_write_tokens: 4 } })).toMatchObject({
      cacheRead: 9,
      cacheWrite: 4,
    });
  });

  test('Gemini usageMetadata 映射；素朴键原样通过', () => {
    const g = normalizeUsage({ promptTokenCount: 11, candidatesTokenCount: 22, cachedContentTokenCount: 33, thoughtsTokenCount: 44, totalTokenCount: 110 });
    expect(g).toEqual({ input: 11, output: 22, cacheRead: 33, reasoning: 44, total: 110 });
    expect(normalizeUsage({ input: 1, cacheRead: 2, cacheWrite: 3, reasoning: 4, output: 5, total: 15 })).toEqual({
      input: 1, output: 5, cacheRead: 2, cacheWrite: 3, reasoning: 4, total: 15,
    });
  });

  test('非法输入返回空对象（诚实，不猜）', () => {
    expect(normalizeUsage(null)).toEqual({});
    expect(normalizeUsage('x')).toEqual({});
    expect(normalizeUsage(42)).toEqual({});
  });
});

describe('normalizeContentParts（string / parts / MCP resource_link 下划线形态）', () => {
  test('字符串捷径 → 单 text 部件；空串 → 空数组', () => {
    expect(normalizeContentParts('你好')).toEqual([{ type: 'text', text: '你好' }]);
    expect(normalizeContentParts('')).toEqual([]);
    expect(normalizeContentParts(undefined)).toEqual([]);
  });

  test('OpenAI parts：text / image_url（外链 + data URI 拆 base64）/ input_audio / file file_id', () => {
    expect(normalizeContentParts([{ type: 'text', text: 'a' }])).toEqual([{ type: 'text', text: 'a' }]);
    expect(normalizeContentParts([{ type: 'image_url', image_url: { url: 'https://x/y.png' } }])).toEqual([
      { type: 'image', url: 'https://x/y.png' },
    ]);
    expect(normalizeContentParts([{ type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }])).toEqual([
      { type: 'image', data: 'QUJD', mimeType: 'image/png' },
    ]);
    expect(normalizeContentParts([{ type: 'input_audio', input_audio: { data: 'UUU', format: 'mp3' } }])).toEqual([
      { type: 'audio', data: 'UUU', mimeType: 'audio/mp3' },
    ]);
    expect(normalizeContentParts([{ type: 'file', file: { file_id: 'file-1' } }])).toEqual([
      { type: 'file', url: 'file-1', filename: undefined },
    ]);
  });

  test('Anthropic blocks：text / image（base64 与 url 两形态）/ document → file(pdf)', () => {
    expect(normalizeContentParts([{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } }])).toEqual([
      { type: 'image', data: 'QUJD', mimeType: 'image/jpeg' },
    ]);
    expect(normalizeContentParts([{ type: 'image', source: { type: 'url', url: 'https://x/y.jpg' } }])).toEqual([
      { type: 'image', url: 'https://x/y.jpg' },
    ]);
    expect(normalizeContentParts([{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } }])).toEqual([
      { type: 'file', data: 'QUJD', mimeType: 'application/pdf' },
    ]);
  });

  test('MCP：text / image / audio / resource_link（下划线形态）/ EmbeddedResource 文本与 blob', () => {
    expect(normalizeContentParts([{ type: 'resource_link', uri: 'kb://doc/1', name: '文档一', mimeType: 'text/plain' }])).toEqual([
      { type: 'resource-link', uri: 'kb://doc/1', name: '文档一', mimeType: 'text/plain' },
    ]);
    expect(normalizeContentParts([{ type: 'resource', resource: { uri: 'kb://doc/2', text: '正文' } }])).toEqual([
      { type: 'text', text: '正文' },
    ]);
    expect(normalizeContentParts([{ type: 'resource', resource: { uri: 'kb://img/1', mimeType: 'image/png', blob: 'QUJD' } }])).toEqual([
      { type: 'image', data: 'QUJD', mimeType: 'image/png' },
    ]);
  });

  test('素朴本族 parts 原样通过；未知形态剔除', () => {
    const plain = [{ type: 'text', text: 'a' }, { type: 'video', url: 'https://x/v.mp4' }];
    expect(normalizeContentParts(plain)).toEqual(plain);
    expect(normalizeContentParts([{ type: 'mystery' }, 42, null, { type: 'image' }])).toEqual([]);
  });

  test('contentToText 只拼 text 部件；aiContentUrl 的 url / data URI 两形态', () => {
    expect(contentToText([{ type: 'text', text: 'a' }, { type: 'image', url: 'u' }, { type: 'text', text: 'b' }])).toBe('ab');
    expect(contentToText('plain')).toBe('plain');
    expect(aiContentUrl({ type: 'image', url: 'https://x' })).toBe('https://x');
    expect(aiContentUrl({ type: 'image', data: 'QUJD', mimeType: 'image/png' })).toBe('data:image/png;base64,QUJD');
    expect(aiContentUrl({ type: 'text', text: 'x' })).toBeUndefined();
  });
});

describe('estimateTokens / contextEstimate（估算口径）', () => {
  test('CJK ×0.6 + 其余 ÷4，单字符保底 1', () => {
    expect(estimateTokens('汉字')).toBe(1); /* 2 × 0.6 = 1.2 → round 1 */
    expect(estimateTokens('abcd')).toBe(1); /* 4 ÷ 4 = 1 */
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a汉'.repeat(4))).toBe(Math.round(4 * 0.6 + 4 / 4)); /* 混排同式 */
  });

  test('部件数组按族给经验值（image 1000 / audio 1500 / video 6000 / file 500）', () => {
    expect(estimateTokens([{ type: 'image', url: 'u' }])).toBe(1000);
    expect(estimateTokens([{ type: 'audio', url: 'u' }])).toBe(1500);
    expect(estimateTokens([{ type: 'video', url: 'u' }])).toBe(6000);
    expect(estimateTokens([{ type: 'file', url: 'u' }])).toBe(500);
    expect(estimateTokens([{ type: 'text', text: 'abcd' }, { type: 'image', url: 'u' }])).toBe(1001);
  });

  test('传 AiUsage 直接取归一 total（无 total 时六段求和）', () => {
    expect(estimateTokens({ input: 10, output: 5 })).toBe(15);
    expect(estimateTokens({ total_tokens: 42 })).toBe(42);
  });

  test('contextEstimate 环口径：input + cacheRead + cacheWrite + output（+ reasoning），与计费口径不同', () => {
    expect(contextEstimate({ input: 100, output: 50, cacheRead: 10, cacheWrite: 5, reasoning: 7 })).toBe(172);
    expect(contextEstimate({ prompt_tokens: 8, completion_tokens: 2 })).toBe(10);
    expect(contextEstimate({})).toBe(0);
  });
});

describe('inferKind / registerAiKind（kind 注册表）', () => {
  test('命名推断矩阵：Bash→shell / mcp__*→mcp / Read→read / Grep→grep / TodoWrite→todo / 未知→note', () => {
    expect(inferKind('Bash')).toBe('shell');
    expect(inferKind('mcp__fs__read')).toBe('mcp');
    expect(inferKind('Read')).toBe('read');
    expect(inferKind('Grep')).toBe('grep');
    expect(inferKind('TodoWrite')).toBe('todo');
    expect(inferKind('SubAgent')).toBe('subagent');
    expect(inferKind('完全未知的工具')).toBe('note');
    expect(inferKind('')).toBe('note');
  });

  test('大小写不敏感；空白名回退 note', () => {
    expect(inferKind('  BASH  ')).toBe('shell');
    expect(inferKind('   ')).toBe('note');
  });

  test('render_chart 推断为 chart（kind 注册表内置 chart kind；v0.10 修正 codemod 误伤的 icen-chart）', () => {
    expect(inferKind('render_chart')).toBe('chart');
    expect(inferKind('ChartTool')).toBe('chart');
  });

  test('内置 kind 全量就位（spec §4.4 清单 17 个，各自中文标签）', () => {
    const expected: Record<string, string> = {
      shell: '命令', read: '读取', edit: '编辑', write: '写入', rm: '删除', grep: '搜索', glob: '匹配',
      browser: '浏览', search: '检索', fetch: '请求', mcp: 'MCP', skill: '技能', todo: '待办',
      plan: '计划', subagent: '子代理', note: '笔记', chart: '图表',
    };
    for (const [k, label] of Object.entries(expected)) {
      expect(getAiKind(k).label).toBe(label);
    }
  });

  test('registerAiKind：第三方 kind 注册后按名可取（大小写不敏感），未知 kind 回退 note', () => {
    registerAiKind('DockerPs', { label: '容器', icon: '<svg></svg>', tint: 'info', summarize: () => 'ps' });
    expect(getAiKind('dockerps').label).toBe('容器');
    expect(getAiKind('DOCKERPS').summarize?.({})).toBe('ps');
    expect(getAiKind('不存在').label).toBe('笔记'); /* 回退内置 note */
  });

  test('内置 summarize 行为锁定：shell 取 command 首行 / read 带偏移 / todo x/y', () => {
    expect(getAiKind('shell').summarize?.({ command: 'ls -la\npwd' })).toBe('ls -la');
    expect(getAiKind('read').summarize?.({ file_path: 'a.ts', offset: 3, limit: 10 })).toBe('a.ts:3-13');
    expect(getAiKind('todo').summarize?.({ items: [{ status: 'done' }, { status: 'running' }] })).toBe('1/2 完成');
    expect(getAiKind('plan').summarize).toBeUndefined(); /* plan 未配 summarize（契约如此） */
  });
});

describe('svgIcon（svg-parse 单点：xmlns 归一 + 消毒）', () => {
  test('缺 xmlns 的 <svg> 自动补命名空间（XML 严格解析落空命名空间则不渲染——回归锁）', async () => {
    const { svgIcon } = await import('../../src/behaviors/ai-core');
    const el = svgIcon('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>')!;
    expect(el).not.toBeNull();
    /* 字符串层归一：outerHTML 必带 xmlns（命名空间语义的载体） */
    expect(el.outerHTML).toContain('xmlns="http://www.w3.org/2000/svg"');
    /* 已带 xmlns 的原样保留（不重复注入） */
    const el2 = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>')!;
    expect(el2.outerHTML.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g)).toHaveLength(1);
  });
  test('消毒纪律不变：on* 属性 / script 子树 / javascript: href 全剥', async () => {
    const { svgIcon } = await import('../../src/behaviors/ai-core');
    const el = svgIcon('<svg viewBox="0 0 24 24" onclick="x()"><script>alert(1)</script><a href="javascript:evil()"><circle r="9"/></a></svg>')!;
    expect(el.outerHTML).not.toContain('onclick');
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('a')?.getAttribute('href')).toBeNull();
  });
});
