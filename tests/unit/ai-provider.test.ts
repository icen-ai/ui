// ai-provider 契约测试：定价表命中/未命中（未命中 undefined 不猜价）、五家注册表 browserDirect
// 标注、环形审计器（log/summary/totals/byModel + localStorage 持久化）、createAiClient 注入
// mock fetch（不真实联网）验证 openai/anthropic 两族请求体多模态映射（含 cache_control）与
// icen:ai-done / icen:ai-usage 广播。
// 语义源：src/behaviors/ai-provider.ts（spec §9）。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  AiProviderError,
  createAiAuditor,
  createAiClient,
  estimateCost,
  getAiProvider,
  listAiProviders,
  registerAiProvider,
  type AiAuditEntry,
} from '../../src/behaviors/ai-provider';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, unmountAll } from '../helpers/dom';

afterEach(() => unmountAll());

function entry(partial: Partial<AiAuditEntry>): AiAuditEntry {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    provider: 'kimi',
    model: 'kimi-k3',
    baseURL: 'https://api.moonshot.cn/v1',
    stream: false,
    status: 'ok',
    durationMs: 100,
    ...partial,
  };
}

/** 捕获请求入参的 mock fetch；body() 返回解析后的 JSON body。 */
function mockFetch(json: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return {
    fn,
    calls,
    body: (i = 0): Record<string, unknown> => JSON.parse(String(calls[i]?.init.body)),
  };
}

const OPENAI_CHAT_JSON = {
  choices: [{ message: { role: 'assistant', content: '你好' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
};

const CLAUDE_CHAT_JSON = {
  content: [{ type: 'text', text: 'bonjour' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 30, output_tokens: 10 },
};

describe('estimateCost（USD / MTok；未命中返回 undefined，不猜价）', () => {
  test('命中定价表：input/output 段按模型价折算（kimi-k3 = 3 / 15）', () => {
    expect(estimateCost({ input: 1_000_000, output: 1_000_000 }, 'kimi', 'kimi-k3')).toBe(18);
    expect(estimateCost({ input: 500, output: 250 }, 'deepseek', 'deepseek-flash')).toBeCloseTo(0.00014, 8);
  });

  test('cacheWrite 缺省按 input × 1.25（缓存写溢价惯例）；cacheRead 缺省按 input 价', () => {
    expect(estimateCost({ cacheWrite: 1_000_000 }, 'kimi', 'kimi-k3')).toBe(3.75);
    expect(estimateCost({ cacheRead: 1_000_000 }, 'glm', 'glm-5.2')).toBe(0.05);
  });

  test('显式 cacheRead/cacheWrite 价优先于缺省（claude opus cacheRead 0.4 / cacheWrite 5）', () => {
    expect(estimateCost({ cacheRead: 1_000_000 }, 'claude', 'claude-opus-5-5')).toBe(0.4);
    expect(estimateCost({ cacheWrite: 1_000_000 }, 'claude', 'claude-opus-5-5')).toBe(5);
  });

  test('未命中：未知模型 / 未知 provider / 无用量均返回 undefined（诚实纪律锁定）', () => {
    expect(estimateCost({ input: 100 }, 'kimi', 'kimi-不存在')).toBeUndefined();
    expect(estimateCost({ input: 100 }, '不存在的厂商', 'x')).toBeUndefined();
    const p = registerAiProviderReturn('no-pricing-gw');
    expect(estimateCost({ input: 1_000_000 }, p, 'any')).toBeUndefined();
  });
});

function registerAiProviderReturn(id: string): string {
  registerAiProvider({
    id,
    label: '无价网关',
    icon: '<svg></svg>',
    baseURL: 'https://gw.example.com',
    chatPath: '/chat/completions',
    wire: 'openai',
    auth: 'bearer',
    browserDirect: 'unknown',
    models: [{ id: 'any', label: '任意' }], /* 无 pricing 字段 */
  });
  return id;
}

describe('provider 注册表（五家内置 + browserDirect 诚实标注）', () => {
  test('内置五家就位：openai / claude / deepseek / glm / kimi（其后为测试注册的第三方，顺序稳定）', () => {
    expect(listAiProviders().slice(0, 5).map((p) => p.id)).toEqual(['openai', 'claude', 'deepseek', 'glm', 'kimi']);
  });

  test('browserDirect 标注：claude=yes（官方 CORS 白名单）/ openai=no（官方禁止）/ 其余 unknown（建议代理）', () => {
    expect(getAiProvider('claude')?.browserDirect).toBe('yes');
    expect(getAiProvider('openai')?.browserDirect).toBe('no');
    expect(getAiProvider('deepseek')?.browserDirect).toBe('unknown');
    expect(getAiProvider('glm')?.browserDirect).toBe('unknown');
    expect(getAiProvider('kimi')?.browserDirect).toBe('unknown');
  });

  test('wire / auth / chatPath 五家分布正确；anthropic 族带直连头 extraHeaders', () => {
    expect(getAiProvider('openai')).toMatchObject({ wire: 'openai', auth: 'bearer', chatPath: '/chat/completions' });
    expect(getAiProvider('claude')).toMatchObject({ wire: 'anthropic', auth: 'x-api-key', chatPath: '/messages' });
    expect(getAiProvider('claude')?.extraHeaders).toMatchObject({
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
  });

  test('getAiProvider 未注册返回 undefined；registerAiProvider 同 id 覆盖', () => {
    expect(getAiProvider('nope')).toBeUndefined();
    registerAiProviderReturn('gw-override');
    registerAiProvider({
      id: 'gw-override',
      label: '覆盖后',
      icon: '<svg></svg>',
      baseURL: 'https://gw2.example.com',
      chatPath: '/v1/chat',
      wire: 'openai',
      auth: 'bearer',
      browserDirect: 'yes',
      models: [{ id: 'm', label: 'M', pricing: { input: 1, output: 2 } }],
    });
    expect(getAiProvider('gw-override')?.label).toBe('覆盖后');
    expect(getAiProvider('gw-override')?.baseURL).toBe('https://gw2.example.com');
  });
});

describe('createAiAuditor（环形审计：max 封顶 / summary / totals / byModel / persist）', () => {
  test('环形：max=2 时 log 第 3 条丢弃最旧，list 时间升序', () => {
    const a = createAiAuditor({ max: 2 });
    a.log(entry({ id: 'a1' }));
    a.log(entry({ id: 'a2' }));
    a.log(entry({ id: 'a3' }));
    expect(a.list().map((e) => e.id)).toEqual(['a2', 'a3']);
  });

  /* v0.10 已修复：addUsage 返回值重新接回（summary/totals/byModel 三处重赋值）。回归锁：
     诚实纪律——total 不由分件推算（cache 字段在不同厂商口径下与 input 有重叠/互斥差异，不猜） */
  test('summary 六段求和；byModel / totals 的 usage 聚合（addUsage 返回值接回）', () => {
    const a = createAiAuditor();
    a.log(entry({ usage: { input: 100, output: 50, cacheRead: 10 } }));
    a.log(entry({ usage: { input: 25, output: 25, reasoning: 5, total: 220 } }));
    expect(a.summary()).toEqual({ input: 125, output: 75, cacheRead: 10, reasoning: 5, total: 220 });
    expect(a.totals().usage).toEqual({ input: 125, output: 75, cacheRead: 10, reasoning: 5, total: 220 });
    expect(a.byModel()['kimi/kimi-k3']).toEqual({ input: 125, output: 75, cacheRead: 10, reasoning: 5, total: 220 });
  });

  test('totals 计数口径：requests / errors / cost 求和 / avgTtftMs 取均值（usage 聚合另见 todo）', () => {
    const a = createAiAuditor();
    a.log(entry({ usage: { input: 100 }, cost: 0.5, ttftMs: 100 }));
    a.log(entry({ usage: { input: 25 }, cost: 0.25, status: 'error', ttftMs: 300 }));
    const t = a.totals();
    expect(t.requests).toBe(2);
    expect(t.errors).toBe(1);
    expect(t.cost).toBe(0.75);
    expect(t.avgTtftMs).toBe(200);
  });

  test('byModel 分组键为 provider/model（值聚合见 todo）', () => {
    const a = createAiAuditor();
    a.log(entry({ usage: { input: 10 } }));
    a.log(entry({ provider: 'claude', model: 'claude-opus-5-5', usage: { input: 5 } }));
    expect(Object.keys(a.byModel()).sort()).toEqual(['claude/claude-opus-5-5', 'kimi/kimi-k3']);
  });

  test('persist：同 key 第二个审计器恢复持久化条目；clear 清空并写回', () => {
    const key = `ai-audit-test-${Math.random().toString(36).slice(2, 8)}`;
    const a = createAiAuditor({ persist: key });
    a.log(entry({ id: 'p1', usage: { input: 9 } }));
    const b = createAiAuditor({ persist: key });
    expect(b.list().map((e) => e.id)).toEqual(['p1']);
    expect(b.list()[0]?.usage).toEqual({ input: 9 }); /* 条目原样持久化/恢复（聚合见 todo） */
    b.clear();
    expect(b.list()).toHaveLength(0);
    expect(createAiAuditor({ persist: key }).list()).toHaveLength(0);
  });

  test('损坏的持久化数据静默丢弃（回退空环形，不抛）', () => {
    const key = `ai-audit-bad-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(key, '{not json');
    expect(createAiAuditor({ persist: key }).list()).toEqual([]);
    window.localStorage.setItem(key, JSON.stringify([{ bogus: true }]));
    expect(createAiAuditor({ persist: key }).list()).toEqual([]);
  });
});

describe('createAiClient（mock fetch 注入，不真实联网）', () => {
  test('openai 族 chat：URL/头/请求体组装，usage 归一 + cost 命中定价 + 广播 icen:ai-usage / icen:ai-done', async () => {
    const m = mockFetch(OPENAI_CHAT_JSON);
    const client = createAiClient({ provider: 'kimi', apiKey: 'sk-test', fetch: m.fn });
    expect(client.config).toEqual({ provider: 'kimi', baseURL: 'https://api.moonshot.cn/v1', model: 'kimi-k3' });

    const doneDetails: unknown[] = [];
    const usageDetails: unknown[] = [];
    onIcen('icen:ai-done', (e) => doneDetails.push(e.detail));
    onIcen('icen:ai-usage', (e) => usageDetails.push(e.detail));

    const r = await client.chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(m.calls[0]?.url).toBe('https://api.moonshot.cn/v1/chat/completions');
    expect((m.calls[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    expect(m.body()).toMatchObject({ model: 'kimi-k3', stream: false, messages: [{ role: 'user', content: 'hi' }] });
    expect(r.text).toBe('你好');
    expect(r.usage).toEqual({ input: 100, output: 20, total: 120 });
    expect(r.cost).toBeCloseTo(0.0006, 8); /* (100×3 + 20×15)/1e6 */
    expect(r.finishReason).toBe('stop');

    expect(usageDetails).toHaveLength(1);
    expect(doneDetails).toHaveLength(1);
    expect(doneDetails[0]).toMatchObject({ status: 'ok', provider: 'kimi', model: 'kimi-k3', stream: false });
    expect((doneDetails[0] as { cost: number }).cost).toBeCloseTo(0.0006, 8);
    expect((doneDetails[0] as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
  });

  test('openai 族多模态出线：text/image_url/input_audio/file(file_id)；resource-link 降级文本；video 诚实报 unsupported', async () => {
    const m = mockFetch(OPENAI_CHAT_JSON);
    const client = createAiClient({ provider: 'openai', apiKey: 'k', model: 'gpt-5', fetch: m.fn });
    await client.chat({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '看图' },
          { type: 'image', url: 'https://x/y.png' },
          { type: 'audio', data: 'UUU', mimeType: 'audio/wav' },
          { type: 'file', url: 'file-9' },
          { type: 'resource-link', uri: 'kb://d/1', name: '文档' },
        ],
      }],
    });
    const content = (m.body().messages as Array<{ content: unknown }>)[0]?.content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({ type: 'text', text: '看图' });
    expect(content[1]).toEqual({ type: 'image_url', image_url: { url: 'https://x/y.png' } });
    expect(content[2]).toEqual({ type: 'input_audio', input_audio: { data: 'UUU', format: 'wav' } });
    expect(content[3]).toEqual({ type: 'file', file: { file_id: 'file-9' } });
    expect(content[4]).toEqual({ type: 'text', text: '[资源] 文档 (kb://d/1)' });

    await expect(
      client.chat({ messages: [{ role: 'user', content: [{ type: 'video', url: 'u' }] }] }),
    ).rejects.toMatchObject({ type: 'unsupported' });
  });

  test('openai 族 role=tool 必须有 toolCallId；缺失报 unsupported', async () => {
    const m = mockFetch(OPENAI_CHAT_JSON);
    const client = createAiClient({ provider: 'openai', apiKey: 'k', model: 'gpt-5', fetch: m.fn });
    await client.chat({ messages: [{ role: 'tool', toolCallId: 'call_1', content: '结果' }] });
    expect((m.body().messages as Array<Record<string, unknown>>)[0]).toEqual({
      role: 'tool', content: '结果', tool_call_id: 'call_1',
    });
    await expect(client.chat({ messages: [{ role: 'tool', content: 'x' }] })).rejects.toMatchObject({ type: 'unsupported' });
  });

  test('anthropic 族：system 抽为顶层、cache_control 打末块、tool 回灌 tool_result、max_tokens 缺省 4096', async () => {
    const m = mockFetch(CLAUDE_CHAT_JSON);
    const client = createAiClient({ provider: 'claude', apiKey: 'sk-ant', fetch: m.fn });
    const r = await client.chat({
      messages: [
        { role: 'system', content: '你是助手' },
        { role: 'user', content: [{ type: 'text', text: '问题一' }, { type: 'image', url: 'https://x/y.png' }], cacheControl: true },
        { role: 'tool', toolCallId: 'tu_1', content: '工具结果' },
      ],
    });
    const b = m.body();
    expect(m.calls[0]?.url).toBe('https://api.anthropic.com/v1/messages');
    expect((m.calls[0]?.init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant');
    expect(b.max_tokens).toBe(4096);
    expect(b.system).toBe('你是助手');
    const msgs = b.messages as Array<Record<string, unknown>>;
    const userMsg = msgs[0] as { role: string; content: Array<Record<string, unknown>> };
    expect(userMsg.role).toBe('user');
    expect(userMsg.content[0]).toMatchObject({ type: 'text', text: '问题一' });
    expect(userMsg.content[1]).toMatchObject({ type: 'image', source: { type: 'url', url: 'https://x/y.png' }, cache_control: { type: 'ephemeral' } });
    const toolMsg = msgs[1] as { role: string; content: Array<Record<string, unknown>> };
    expect(toolMsg.role).toBe('user');
    expect(toolMsg.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu_1' });

    expect(r.text).toBe('bonjour');
    expect(r.usage).toEqual({ input: 30, output: 10, total: 40 });
    expect(r.parts).toEqual([{ type: 'text', text: 'bonjour' }]);
  });

  test('非 2xx 映射 AiProviderError（status/type/message）并派 icen:ai-done status=error', async () => {
    const m = mockFetch({ error: { message: '密钥无效', type: 'authentication_error' } }, 401);
    const client = createAiClient({ provider: 'kimi', apiKey: 'bad', fetch: m.fn });
    const doneDetails: unknown[] = [];
    onIcen('icen:ai-done', (e) => doneDetails.push(e.detail));
    try {
      await client.chat({ messages: [{ role: 'user', content: 'hi' }] });
      expect.unreachable('应抛 AiProviderError');
    } catch (e) {
      expect(e).toBeInstanceOf(AiProviderError);
      expect(e).toMatchObject({ provider: 'kimi', status: 401, type: 'authentication_error' });
      expect((e as Error).message).toContain('密钥无效');
    }
    expect(doneDetails[0]).toMatchObject({ status: 'error', error: expect.stringContaining('密钥无效') });
  });

  test('auditor / onAudit 双通道自动落账（条目含 cost 与归一 usage）', async () => {
    const m = mockFetch(OPENAI_CHAT_JSON);
    const auditor = createAiAuditor();
    const viaCallback: AiAuditEntry[] = [];
    const client = createAiClient({ provider: 'kimi', apiKey: 'k', fetch: m.fn, auditor, onAudit: (e) => viaCallback.push(e) });
    await client.chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(auditor.list()).toHaveLength(1);
    expect(auditor.list()[0]).toMatchObject({ provider: 'kimi', model: 'kimi-k3', status: 'ok', stream: false });
    expect(auditor.list()[0]?.cost).toBeGreaterThan(0);
    expect(auditor.list()[0]?.usage).toEqual({ input: 100, output: 20, total: 120 });
    expect(viaCallback).toHaveLength(1);
    expect(viaCallback[0]?.id).toBe(auditor.list()[0]?.id);
  });

  test('baseURL 自定义网关：去尾斜杠拼接 chatPath', async () => {
    const m = mockFetch(OPENAI_CHAT_JSON);
    const client = createAiClient({ provider: 'kimi', apiKey: 'k', baseURL: 'https://gw.example.com/proxy/', fetch: m.fn });
    await client.chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(m.calls[0]?.url).toBe('https://gw.example.com/proxy/chat/completions');
    expect(client.config.baseURL).toBe('https://gw.example.com/proxy');
  });

  test('未注册 provider 直接抛错（可用清单在消息里）', () => {
    expect(() => createAiClient({ provider: 'nope', apiKey: 'k' })).toThrow(/未注册的 provider/);
  });
});
