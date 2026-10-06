// React 薄封装层 DOM 测试：happy-dom + react-dom/client（react 19 的 act 从 'react' 导出）。
// 覆盖：<Chart> 渲染 svg / spec 变 → 同一容器 update（handle.update 被调）/ unmount → destroy；
// createIcenComponent 工厂生命周期调用序（mock 内核）；useIcenInit 的 StrictMode 双调用幂等；
// useIcenEvent 事件桥；AiComposer 模型配置 + onSend。
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { StrictMode, createRef, act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  AiComposer, Chart, DataTable, AiMessage, AiToolCall,
  createIcenComponent, useIcenEvent, useIcenInit,
  type ChartHandle,
} from '../../src/react';
import type { ChartSpec } from '../../src/behaviors/charts';
import { onIcen } from '../../src/behaviors/events';

beforeAll(() => {
  (globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLElement | null = null;
const roots: Root[] = [];

function renderEl(el: ReactElement): { container: HTMLElement; root: Root } {
  if (!host || !host.isConnected) {
    host = document.createElement('div');
    host.setAttribute('data-test-host', '');
    document.body.appendChild(host);
  }
  const container = document.createElement('div');
  host.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(el));
  roots.push(root);
  return { container, root };
}

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  host?.replaceChildren();
  host?.remove();
  host = null;
});

const SPEC: ChartSpec = { type: 'line', title: 'T1', labels: ['a', 'b'], values: [1, 2] };
const SPEC2: ChartSpec = { type: 'line', title: 'T2', labels: ['a', 'b'], values: [3, 4] };

describe('<Chart>', () => {
  test('opts.spec 渲染出 svg（容器默认 .icen-chart）', () => {
    renderEl(<Chart opts={SPEC} />);
    const chart = document.querySelector<HTMLElement>('.icen-chart');
    expect(chart).toBeTruthy();
    expect(chart?.querySelector('svg')).toBeTruthy();
    expect(chart?.textContent).toContain('T1');
  });

  test('spec 变（同 root 重渲）→ update 被调 + 容器元素不变', () => {
    const handleRef = createRef<ChartHandle | null>();
    const el = (
      <Chart opts={SPEC} handleRef={handleRef} />
    );
    const { container, root } = renderEl(el);
    const before = container.querySelector('.icen-chart');
    const handle = handleRef.current!;
    let updates = 0;
    const orig = handle.update.bind(handle);
    handle.update = (next) => { updates++; orig(next); };
    act(() => root.render(<Chart opts={SPEC2} handleRef={handleRef} />));
    expect(updates).toBe(1);
    expect(container.querySelector('.icen-chart')).toBe(before);
    expect(container.querySelector('.icen-chart')?.textContent).toContain('T2');
  });

  test('unmount → destroy 被调（命令式内核收尾）', () => {
    const handleRef = createRef<ChartHandle | null>();
    const { root } = renderEl(<Chart opts={SPEC} handleRef={handleRef} />);
    const handle = handleRef.current!;
    let destroyed = 0;
    const orig = handle.destroy.bind(handle);
    handle.destroy = () => { destroyed++; orig(); };
    act(() => root.unmount());
    expect(destroyed).toBe(1);
    expect(handleRef.current).toBeNull();
  });

  test('onEvent 透出子树 icen 事件（chart-hover）', () => {
    const seen: Array<[string, unknown]> = [];
    const { container } = renderEl(<Chart opts={SPEC} onEvent={(t, d) => seen.push([t, d])} />);
    const mark = container.querySelector('[data-icen-chart-index]');
    expect(mark).toBeTruthy();
    mark!.dispatchEvent(new CustomEvent('icen:chart-hover', {
      detail: { type: 'hover', phase: 'enter', chart: 'line' }, bubbles: true, composed: true,
    }));
    expect(seen.some(([t]) => t === 'icen:chart-hover')).toBe(true);
  });
});

describe('createIcenComponent 工厂（mock 内核，生命周期调用序）', () => {
  test('mount→create / 无 update 时 opts 变→destroy+create / unmount→destroy', () => {
    const calls: string[] = [];
    const Probe = createIcenComponent<{ v: number }, string>({
      create: (el, opts) => { calls.push(`create:${opts.v}`); el.dataset.v = String(opts.v); return `h${opts.v}`; },
      destroy: (h) => { calls.push(`destroy:${h}`); },
    });
    const { container, root } = renderEl(<Probe opts={{ v: 1 }} />);
    const el = container.querySelector('div')!;
    expect(el.dataset.v).toBe('1');
    act(() => root.render(<Probe opts={{ v: 2 }} />));
    expect(el.dataset.v).toBe('2'); /* 同一容器元素 */
    expect(calls).toEqual(['create:1', 'destroy:h1', 'create:2']);
    act(() => root.unmount());
    expect(calls).toEqual(['create:1', 'destroy:h1', 'create:2', 'destroy:h2']);
  });

  test('有 update 时 opts 变→update 而非重建', () => {
    const calls: string[] = [];
    const Probe = createIcenComponent<{ v: number }, { v: number }>({
      create: (el, opts) => { calls.push(`create:${opts.v}`); return { v: opts.v }; },
      update: (h, opts) => { calls.push(`update:${h.v}->${opts.v}`); h.v = opts.v; },
      destroy: (h) => { calls.push(`destroy:${h.v}`); },
    });
    const { root } = renderEl(<Probe opts={{ v: 1 }} />);
    act(() => root.render(<Probe opts={{ v: 2 }} />));
    expect(calls).toEqual(['create:1', 'update:1->2']);
  });
});

describe('useIcenInit / useIcenEvent', () => {
  test('StrictMode 双调用下幂等：init/cleanup 各跑两遍但内核实例唯一（事件不重复）', () => {
    const events: unknown[] = [];
    let inits = 0;
    const Probe = () => {
      useIcenInit(() => {
        inits++;
        return onIcen('icen:tab-change', (e) => events.push(e.detail));
      });
      return null;
    };
    renderEl(<StrictMode><Probe /></StrictMode>);
    expect(inits).toBe(2); /* StrictMode setup→cleanup→setup */
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    onIcen('icen:tab-change', (e) => events.push(e.detail)); /* 参照：全局一条 */
    document.body.dispatchEvent(new CustomEvent('icen:tab-change', {
      detail: { tab: null, panel: null, index: 0 }, bubbles: true, composed: true,
    }));
    /* 事件从 body 派发：全局监听收 1 次；StrictMode 清理后只剩最后一个订阅也收 1 次 → 共 2 */
    expect(events).toHaveLength(2);
    btn.remove();
  });

  test('useIcenEvent 收 detail + event，unmount 后解绑', () => {
    const seen: unknown[] = [];
    const Probe = () => {
      useIcenEvent('icen:copy-success', (detail) => seen.push(detail.text));
      return null;
    };
    const { root } = renderEl(<Probe />);
    document.body.dispatchEvent(new CustomEvent('icen:copy-success', {
      detail: { text: 'hi' }, bubbles: true, composed: true,
    }));
    expect(seen).toEqual(['hi']);
    act(() => root.unmount());
    document.body.dispatchEvent(new CustomEvent('icen:copy-success', {
      detail: { text: 'again' }, bubbles: true, composed: true,
    }));
    expect(seen).toEqual(['hi']);
  });
});

describe('其余旗舰组件', () => {
  test('<DataTable> 渲染行；<AiMessage> 快照渲染；<AiToolCall> 整卡渲染', () => {
    renderEl(<DataTable opts={{
      columns: [{ key: 'name', title: '名称' }],
      data: [{ name: '甲' }, { name: '乙' }],
      pagination: false,
    }} />);
    expect(document.querySelector('.icen-dt-canvas')?.textContent).toContain('甲');
    renderEl(<AiMessage opts={{ role: 'assistant', content: '你好' }} />);
    expect(document.querySelector('.icen-ai-msg')?.textContent).toContain('你好');
    renderEl(<AiToolCall opts={{ id: '1', name: 'WebSearch', kind: 'search', status: 'done', input: { q: 1 } }} />);
    expect(document.querySelector('.icen-ai-tool')).toBeTruthy();
  });

  test('<AiComposer> models 配出模型钮；Enter 发送 → onSend', () => {
    const sent: string[] = [];
    renderEl(<AiComposer
      models={{ providers: [{ id: 'kimi', label: 'Kimi', models: [{ id: 'kimi-k3', label: 'K3', context: 128000 }] }] }}
      onSend={(t) => sent.push(t)}
    />);
    expect(document.querySelector('[data-icen-ai-model-open]')).toBeTruthy();
    const ta = document.querySelector<HTMLTextAreaElement>('.icen-ai-composer-input')!;
    ta.value = 'hello';
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(sent).toEqual(['hello']);
  });
});
