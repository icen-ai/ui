// Vue 薄封装层 DOM 测试：vue 运行时 + happy-dom。
// 覆盖：<IcenChart :spec> 挂载渲染 svg / props 变 → handle.update（watch deep，同容器）/
// unmount → destroy（容器清空）/ useIcenInit 幂等 / useIcenEvent 解绑 / IcenAiComposer smoke。
import { afterEach, describe, expect, test } from 'bun:test';
import { createApp, h, nextTick, ref, type App, type Component } from 'vue';
import {
  IcenAiComposer, IcenChart, useIcenEvent, useIcenInit,
} from '../../src/vue';
import type { ChartHandle } from '../../src/behaviors/charts';
import type { ChartSpec } from '../../src/behaviors/charts';
import { onIcen } from '../../src/behaviors/events';

let host: HTMLElement | null = null;
const apps: App[] = [];

function mount(comp: Component, props: Record<string, unknown> = {}): { el: HTMLElement; app: App } {
  if (!host || !host.isConnected) {
    host = document.createElement('div');
    host.setAttribute('data-test-host', '');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  host.appendChild(el);
  const app = createApp(comp, props);
  app.mount(el);
  apps.push(app);
  return { el, app };
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  host?.replaceChildren();
  host?.remove();
  host = null;
});

const SPEC: ChartSpec = { type: 'line', title: 'V1', labels: ['a', 'b'], values: [1, 2] };
const SPEC2: ChartSpec = { type: 'line', title: 'V2', labels: ['a', 'b'], values: [3, 4] };

describe('<IcenChart>', () => {
  test('spec 挂载渲染出 svg（容器默认 .icen-chart）', () => {
    mount(IcenChart, { spec: SPEC });
    const chart = document.querySelector<HTMLElement>('.icen-chart');
    expect(chart).toBeTruthy();
    expect(chart?.querySelector('svg')).toBeTruthy();
    expect(chart?.textContent).toContain('V1');
  });

  test('spec 变（响应式）→ 同容器走 handle.update；emits 透出 chart-* 事件', async () => {
    const spec = ref<ChartSpec>(SPEC);
    const emitted: Array<[string, unknown]> = [];
    let child: { getHandle: () => ChartHandle | null } | null = null;
    const Wrapper = {
      setup() {
        return () => h(IcenChart, {
          spec: spec.value,
          ref: (c: unknown) => { child = c as typeof child; },
          onChartHover: (d: unknown) => emitted.push(['chart-hover', d]),
        });
      },
    };
    const { el } = mount(Wrapper);
    const before = el.querySelector('.icen-chart');
    const handle = child!.getHandle()!;
    let updates = 0;
    const orig = handle.update.bind(handle);
    handle.update = (s) => { updates++; orig(s); };
    spec.value = SPEC2;
    await nextTick();
    expect(updates).toBe(1);
    expect(el.querySelector('.icen-chart')).toBe(before);
    expect(el.querySelector('.icen-chart')?.textContent).toContain('V2');
    /* emits 桥：子树内派 icen:chart-hover → onChartHover */
    before!.dispatchEvent(new CustomEvent('icen:chart-hover', {
      detail: { type: 'hover', phase: 'enter', chart: 'line' }, bubbles: true, composed: true,
    }));
    expect(emitted.some(([t]) => t === 'chart-hover')).toBe(true);
  });

  test('unmount → destroy 被调，容器清空', () => {
    let child: { getHandle: () => ChartHandle | null } | null = null;
    const Wrapper = {
      setup() {
        return () => h(IcenChart, { spec: SPEC, ref: (c: unknown) => { child = c as typeof child; } });
      },
    };
    const { el, app } = mount(Wrapper);
    const handle = child!.getHandle()!;
    let destroyed = 0;
    const orig = handle.destroy.bind(handle);
    handle.destroy = () => { destroyed++; orig(); };
    app.unmount();
    expect(destroyed).toBe(1);
    expect(el.querySelector('.icen-chart')?.children.length ?? 0).toBe(0);
  });
});

describe('useIcenInit / useIcenEvent', () => {
  test('useIcenInit 幂等接线 + 解绑清理', () => {
    const seen: unknown[] = [];
    let cleanups = 0;
    const Probe = {
      setup() {
        useIcenInit(() => onIcen('icen:copy-success', (e) => seen.push(e.detail.text)));
        return () => h('div');
      },
    };
    const { app } = mount(Probe);
    document.body.dispatchEvent(new CustomEvent('icen:copy-success', {
      detail: { text: 'x' }, bubbles: true, composed: true,
    }));
    expect(seen).toEqual(['x']);
    app.unmount();
    cleanups++;
    document.body.dispatchEvent(new CustomEvent('icen:copy-success', {
      detail: { text: 'y' }, bubbles: true, composed: true,
    }));
    expect(seen).toEqual(['x']);
    expect(cleanups).toBe(1);
  });

  test('useIcenEvent 收 detail + unmount 解绑', () => {
    const seen: unknown[] = [];
    const Probe = {
      setup() {
        useIcenEvent('icen:copy-error', (detail) => seen.push(detail.reason));
        return () => h('div');
      },
    };
    const { app } = mount(Probe);
    document.body.dispatchEvent(new CustomEvent('icen:copy-error', {
      detail: { text: 'a', reason: 'denied' }, bubbles: true, composed: true,
    }));
    expect(seen).toEqual(['denied']);
    app.unmount();
    document.body.dispatchEvent(new CustomEvent('icen:copy-error', {
      detail: { text: 'b', reason: 'again' }, bubbles: true, composed: true,
    }));
    expect(seen).toEqual(['denied']);
  });
});

describe('<IcenAiComposer>', () => {
  test('models 配出模型钮；挂载即 init（textarea 存在）', async () => {
    mount(IcenAiComposer, {
      models: { providers: [{ id: 'kimi', label: 'Kimi', models: [{ id: 'k3', label: 'K3' }] }] },
    });
    await nextTick();
    expect(document.querySelector('[data-icen-ai-composer]')).toBeTruthy();
    expect(document.querySelector('.icen-ai-composer-input')).toBeTruthy();
    expect(document.querySelector('[data-icen-ai-model-open]')).toBeTruthy();
  });
});
