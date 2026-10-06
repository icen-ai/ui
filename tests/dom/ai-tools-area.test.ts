// AI 工具挂载区 DOM 测试：call 挂载 / LRU 淘汰 / 审批流（approve→执行、reject→cancelled）/
// 超时 / 幂等复用 / progress 活动流 / Promise 结果契约 / 参数校验失败呈现 / ctx.signal 中止。
// DOM 契约：src/components/ai-tool.css 头注释（挂载区段）+ docs/spec/ai-native.md §13。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  createAiToolArea, registerAiTool, unregisterAiTool,
  type AiToolDef,
} from '../../src/behaviors/ai-tools';
import { onIcen } from '../../src/behaviors/events';
import { mount, nextTick, unmountAll } from '../helpers/dom';

let seq = 0;
const registered: string[] = [];
const offs: Array<() => void> = [];

/** 注册一个本次测试专用的工具（afterEach 统一下架，顺带 purge 各区域挂载卡）；runSpy() = run 调用次数。 */
function tool(partial: Partial<AiToolDef> & { name?: string }): AiToolDef & { runSpy: () => number } {
  let calls = 0;
  const base = partial.run ?? (() => ({ done: true }));
  const def: AiToolDef & { runSpy: () => number } = {
    name: partial.name ?? `dom_tool_${seq++}`,
    description: partial.description ?? 'DOM 测试工具',
    inputSchema: partial.inputSchema ?? { type: 'object' },
    present: partial.present,
    timeoutMs: partial.timeoutMs,
    requiresApproval: partial.requiresApproval,
    idempotent: partial.idempotent,
    runSpy: () => calls,
    run: (input, mnt, ctx) => {
      calls++;
      return base(input, mnt, ctx);
    },
  } as AiToolDef & { runSpy: () => number };
  registerAiTool(def);
  registered.push(def.name);
  return def;
}

function areaEl(): HTMLElement {
  return mount('<div></div>').querySelector('div') as HTMLElement;
}

function items(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.icen-ai-tools-item'));
}

/** 挂一个全局事件探针；返回收集到的 detail 列表。 */
function probe<K extends 'icen:ai-tool-call' | 'icen:ai-tool-result' | 'icen:ai-tool-evict' | 'icen:ai-tool-approve' | 'icen:ai-tool-reject'>(
  type: K,
): Array<Record<string, unknown>> {
  const bag: Array<Record<string, unknown>> = [];
  offs.push(onIcen(type, (e) => bag.push(e.detail as Record<string, unknown>)));
  return bag;
}

afterEach(() => {
  for (const off of offs.splice(0)) off();
  while (registered.length) unregisterAiTool(registered.pop()!);
  unmountAll();
});

describe('createAiToolArea：挂载与执行', () => {
  test('call 挂载卡：icen-ai-tools-item + call/result 事件 + is-done + record.result', () => {
    const def = tool({ name: 'dom_mount', run: () => ({ chart: 'line' }) });
    const calls = probe('icen:ai-tool-call');
    const results = probe('icen:ai-tool-result');
    const el = areaEl();
    const area = createAiToolArea(el);
    const rec = area.call(def.name, { type: 'line' })!;
    expect(rec).not.toBeNull();
    expect(area.count).toBe(1);
    expect(items(el)).toHaveLength(1);
    expect(items(el)[0]!.classList.contains('is-done')).toBe(true);
    expect(rec.result).toEqual({ chart: 'line' });
    expect(calls.map((d) => d.name)).toEqual([def.name]);
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(true);
    expect(results[0]!.el).toBe(items(el)[0]);
  });

  test('白名单外 / 未注册返回 null，不挂载', () => {
    const def = tool({ name: 'dom_blocked' });
    const el = areaEl();
    const area = createAiToolArea(el, { tools: ['other_tool'] });
    expect(area.call(def.name, {})).toBeNull();
    expect(area.call('not_registered', {})).toBeNull();
    expect(area.count).toBe(0);
    expect(area.can(def.name)).toBe(false);
  });

  test('超出 max：LRU 淘汰最旧挂载并派 icen:ai-tool-evict', () => {
    tool({ name: 'dom_lru_a' });
    tool({ name: 'dom_lru_b' });
    tool({ name: 'dom_lru_c' });
    const evicts = probe('icen:ai-tool-evict');
    const el = areaEl();
    const area = createAiToolArea(el, { max: 2 });
    area.call('dom_lru_a', {});
    area.call('dom_lru_b', {});
    area.call('dom_lru_c', {});
    expect(area.count).toBe(2);
    const names = items(el).map((i) => i.querySelector('.icen-ai-tools-item-name')!.textContent);
    expect(names).toEqual(['dom_lru_b', 'dom_lru_c']);
    expect(evicts).toHaveLength(1);
    expect(evicts[0]!.name).toBe('dom_lru_a');
  });

  test('setMax 收缩立即淘汰；clear 清空', () => {
    tool({ name: 'dom_max_a' });
    tool({ name: 'dom_max_b' });
    const el = areaEl();
    const area = createAiToolArea(el);
    area.call('dom_max_a', {});
    area.call('dom_max_b', {});
    area.setMax(1);
    expect(area.count).toBe(1);
    expect(items(el)).toHaveLength(1);
    area.clear();
    expect(area.count).toBe(0);
    expect(items(el)).toHaveLength(0);
  });
});

describe('Promise 结果契约 / progress / signal', () => {
  test('run 返回 Promise：落定后写 record.result 并补派 result（先 running 后 done）', async () => {
    const def = tool({
      name: 'dom_async',
      run: () => new Promise((resolve) => setTimeout(() => resolve({ rows: 42 }), 20)),
    });
    const results = probe('icen:ai-tool-result');
    const el = areaEl();
    const area = createAiToolArea(el);
    const rec = area.call(def.name, {})!;
    const card = items(el)[0]!;
    expect(card.classList.contains('is-running')).toBe(true);
    expect(results).toHaveLength(0); /* 落定前不派 result */
    await nextTick(60);
    expect(card.classList.contains('is-done')).toBe(true);
    expect(rec.result).toEqual({ rows: 42 });
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(true);
  });

  test('progress(line) 逐行追加进活动流区域（顺序保持）', () => {
    const def = tool({
      name: 'dom_progress',
      run: (_i, _m, ctx) => {
        ctx.progress('开始渲染');
        ctx.progress('完成 2/2');
        return 'ok';
      },
    });
    const el = areaEl();
    createAiToolArea(el).call(def.name, {});
    const lines = Array.from(items(el)[0]!.querySelectorAll('.icen-ai-tools-item-stream-line')).map((l) => l.textContent);
    expect(lines).toEqual(['开始渲染', '完成 2/2']);
  });

  test('ctx.signal：超时后 aborted（执行侧可联动取消）', async () => {
    let captured: AbortSignal | null = null;
    const def = tool({
      name: 'dom_signal',
      timeoutMs: 20,
      run: (_i, _m, ctx) => {
        captured = ctx.signal;
        return new Promise(() => undefined); /* 永不落定 */
      },
    });
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, {})!;
    await nextTick(80);
    expect(captured!.aborted).toBe(true);
    expect(rec.result).toMatchObject({ ok: false, error: { code: 'timeout' } });
  });
});

describe('timeoutMs', () => {
  test('Promise 超时：is-error + record.result code timeout + result 事件 ok:false', async () => {
    const def = tool({
      name: 'dom_timeout',
      timeoutMs: 20,
      run: () => new Promise(() => undefined),
    });
    const results = probe('icen:ai-tool-result');
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, {})!;
    expect(def.runSpy()).toBe(1);
    await nextTick(80);
    const card = items(el)[0]!;
    expect(card.classList.contains('is-error')).toBe(true);
    expect(card.querySelector('.icen-ai-tools-item-error')).not.toBeNull();
    expect(rec.result).toEqual({ ok: false, error: { code: 'timeout', timeoutMs: 20 } });
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.error).toContain('超时');
  });

  test('超时后晚到的兑现被丢弃（结果不被覆盖）', async () => {
    const def = tool({
      name: 'dom_timeout_late',
      timeoutMs: 20,
      run: () => new Promise((resolve) => setTimeout(() => resolve('late'), 60)),
    });
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, {})!;
    await nextTick(140);
    expect(rec.result).toMatchObject({ ok: false, error: { code: 'timeout' } });
  });

  test('run 抛异常：is-error + record.result code exec', () => {
    const def = tool({
      name: 'dom_throw',
      run: () => {
        throw new Error('boom');
      },
    });
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, {})!;
    const card = items(el)[0]!;
    expect(card.classList.contains('is-error')).toBe(true);
    expect(card.querySelector('.icen-ai-tools-item-error-line')!.textContent).toContain('boom');
    expect(rec.result).toMatchObject({ ok: false, error: { code: 'exec', message: 'boom' } });
  });
});

describe('requiresApproval 审批流', () => {
  test('call 先呈审批区（原因行 + 输入预览 + 批准/拒绝），不执行 run', () => {
    const def = tool({ name: 'dom_approval', requiresApproval: true, run: () => 'ran' });
    const el = areaEl();
    const area = createAiToolArea(el);
    const rec = area.call(def.name, { q: 1 })!;
    const card = items(el)[0]!;
    expect(card.classList.contains('is-approval')).toBe(true);
    expect(def.runSpy()).toBe(0);
    expect(rec.result).toBeUndefined();
    const approval = card.querySelector('.icen-ai-tools-item-approval')!;
    expect(approval.querySelector('.icen-ai-tools-item-approval-reason')!.textContent).toBe(def.description);
    expect(approval.querySelector('.icen-ai-tools-item-approval-preview')!.textContent).toBe('{"q":1}');
    expect(approval.querySelectorAll('button')).toHaveLength(2);
  });

  test('批准：派 icen:ai-tool-approve（name/input/el 契约）→ 执行 → is-done', () => {
    const def = tool({ name: 'dom_approve', requiresApproval: true, run: () => 'ran' });
    const approvals = probe('icen:ai-tool-approve');
    const results = probe('icen:ai-tool-result');
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, { q: 1 })!;
    const card = items(el)[0]!;
    const approveBtn = card.querySelector('.icen-ai-tools-item-approval .icen-btn-primary') as HTMLButtonElement;
    approveBtn.click();
    expect(approvals).toHaveLength(1);
    expect(approvals[0]!.name).toBe(def.name);
    expect(approvals[0]!.input).toEqual({ q: 1 });
    expect(approvals[0]!.el).toBe(card);
    expect(card.querySelector('.icen-ai-tools-item-approval')).toBeNull(); /* 审批区已移除 */
    expect(card.classList.contains('is-done')).toBe(true);
    expect(rec.result).toBe('ran');
    expect(results[0]!.ok).toBe(true);
  });

  test('拒绝：派 icen:ai-tool-reject → 卡片 is-cancelled + 结果 code rejected，不执行 run', () => {
    const def = tool({ name: 'dom_reject', requiresApproval: true, run: () => 'ran' });
    const rejects = probe('icen:ai-tool-reject');
    const results = probe('icen:ai-tool-result');
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, { q: 1 })!;
    const card = items(el)[0]!;
    const rejectBtn = Array.from(card.querySelectorAll<HTMLButtonElement>('.icen-ai-tools-item-approval button')).find(
      (b) => b.textContent === '拒绝',
    )!;
    rejectBtn.click();
    expect(rejects).toHaveLength(1);
    expect(rejects[0]!.name).toBe(def.name);
    expect(rejects[0]!.input).toEqual({ q: 1 });
    expect(rejects[0]!.el).toBe(card);
    expect(def.runSpy()).toBe(0);
    expect(card.classList.contains('is-cancelled')).toBe(true);
    expect(card.classList.contains('is-approval')).toBe(false);
    expect(rec.result).toEqual({ ok: false, error: { code: 'rejected' } });
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.error).toBe('rejected');
  });
});

describe('idempotent 幂等复用', () => {
  test('同名同输入在途调用复用同一条记录：不重复挂载、不重复执行', () => {
    const def = tool({
      name: 'dom_idem',
      idempotent: true,
      run: () => new Promise((resolve) => setTimeout(() => resolve('v'), 30)),
    });
    const el = areaEl();
    const area = createAiToolArea(el);
    const r1 = area.call(def.name, { a: 1 })!;
    const r2 = area.call(def.name, { a: 1 })!;
    expect(r2).toBe(r1); /* 同一记录引用 */
    expect(area.count).toBe(1);
    expect(items(el)).toHaveLength(1);
    expect(def.runSpy()).toBe(1);
  });

  test('JSON 字符串与对象同输入同键；不同输入不复用；落定后再调用重新执行', async () => {
    const def = tool({
      name: 'dom_idem_key',
      idempotent: true,
      run: () => new Promise((resolve) => setTimeout(() => resolve('v'), 20)),
    });
    const el = areaEl();
    const area = createAiToolArea(el);
    const r1 = area.call(def.name, { a: 1 })!;
    expect(area.call(def.name, '{"a":1}')).toBe(r1); /* 归一后同键 */
    expect(area.call(def.name, { a: 2 })).not.toBe(r1); /* 不同输入 */
    expect(def.runSpy()).toBe(2);
    await nextTick(60);
    expect(r1.result).toBe('v');
    const r3 = area.call(def.name, { a: 1 })!; /* 已落定，重新执行 */
    expect(r3).not.toBe(r1);
    expect(def.runSpy()).toBe(3);
  });
});

describe('参数校验（默认开，opts.validate 可关）', () => {
  test('校验失败：挂载卡错误态逐行列出 errors，不执行 run，result ok:false', () => {
    const def = tool({
      name: 'dom_vaild_gate',
      inputSchema: {
        type: 'object',
        properties: { n: { type: 'number', minimum: 1 }, s: { type: 'string' } },
        required: ['n'],
      },
      run: () => 'ran',
    });
    const calls = probe('icen:ai-tool-call');
    const results = probe('icen:ai-tool-result');
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, { n: 0 })!;
    const card = items(el)[0]!;
    expect(def.runSpy()).toBe(0);
    expect(card.classList.contains('is-error')).toBe(true);
    const lines = Array.from(card.querySelectorAll('.icen-ai-tools-item-error-line')).map((l) => l.textContent);
    expect(lines).toEqual(['$.n: 数值 0 小于最小值 1']);
    expect(rec.result).toMatchObject({ ok: false, error: { code: 'validation' } });
    expect(calls).toHaveLength(1); /* call + result 成对，审计可关联 */
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(false);
    expect(String(results[0]!.error)).toContain('参数校验失败');
  });

  test('缺必填 + 类型错并列收集', () => {
    const def = tool({
      name: 'dom_valid_multi',
      inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
    });
    const el = areaEl();
    createAiToolArea(el).call(def.name, {});
    const lines = Array.from(items(el)[0]!.querySelectorAll('.icen-ai-tools-item-error-line')).map((l) => l.textContent);
    expect(lines).toEqual(['$.n: 缺少必填字段']);
  });

  test('validate:false 关闭校验：坏输入照常执行', () => {
    const def = tool({
      name: 'dom_valid_off',
      inputSchema: { type: 'object', properties: { n: { type: 'number' } } },
      run: () => 'ran',
    });
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, { n: 'not-a-number' }, { validate: false })!;
    expect(def.runSpy()).toBe(1);
    expect(rec.result).toBe('ran');
    expect(items(el)[0]!.classList.contains('is-done')).toBe(true);
  });

  test('unvalidated 关键字不拦执行（format 未生效也不猜；清单契约见单测）', () => {
    const def = tool({
      name: 'dom_valid_unvalidated',
      inputSchema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } },
      run: () => 'ran',
    });
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, { email: 'not-an-email' })!;
    expect(def.runSpy()).toBe(1);
    expect(rec.result).toBe('ran');
    expect(items(el)[0]!.classList.contains('is-done')).toBe(true);
  });
});

describe('present: data（不占挂载位，校验/事件照常）', () => {
  test('data 工具：无挂载卡、不占 max、仍派 call/result', () => {
    const def = tool({ name: 'dom_data', present: 'data', run: () => ({ ok: 1 }) });
    const calls = probe('icen:ai-tool-call');
    const results = probe('icen:ai-tool-result');
    const el = areaEl();
    const area = createAiToolArea(el, { max: 0 });
    const rec = area.call(def.name, { x: 1 })!;
    expect(area.count).toBe(0);
    expect(items(el)).toHaveLength(0);
    expect(rec.el).toBeUndefined();
    expect(rec.result).toEqual({ ok: 1 });
    expect(calls[0]!.el).toBe(el); /* data 模式事件 el 退传区域元素 */
    expect(results[0]!.ok).toBe(true);
  });

  test('data 工具校验失败：无卡、result code validation、事件 ok:false', () => {
    const def = tool({
      name: 'dom_data_valid',
      present: 'data',
      inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
      run: () => 'ran',
    });
    const results = probe('icen:ai-tool-result');
    const el = areaEl();
    const rec = createAiToolArea(el).call(def.name, {})!;
    expect(def.runSpy()).toBe(0);
    expect(rec.result).toMatchObject({ ok: false, error: { code: 'validation' } });
    expect(results[0]!.ok).toBe(false);
  });
});
