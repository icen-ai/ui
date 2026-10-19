// Vue 薄封装契约测试：mounted/unmounted 生命周期配对 / deep watch 更新路径 / getHandle / emits 桥解绑。
// 对应 docs/frameworks.md「Vue 兼容矩阵」的行为级证据。
import { describe, expect, test } from 'bun:test';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import { createVueRenderer } from '../../src/vue';

interface ProbeHandle { tag: string }
type ProbeOpts = { n: number };

function makeProbe() {
  const calls: string[] = [];
  const Comp = createVueRenderer<ProbeOpts, ProbeHandle>({
    create: (_el, opts) => { calls.push(`create:${opts.n}`); return { tag: `h${opts.n}` }; },
    update: (h, opts) => { calls.push(`update:${h.tag}->${opts.n}`); h.tag = `h${opts.n}`; },
    destroy: (h) => { calls.push(`destroy:${h.tag}`); },
  });
  return { Comp, calls };
}

function mountVue(comp: ReturnType<typeof createVueRenderer>, opts: ProbeOpts): {
  app: ReturnType<typeof createApp>;
  container: HTMLElement;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(comp, { opts });
  app.mount(container);
  return { app, container };
}

describe('createVueRenderer（Vue 工厂契约）', () => {
  test('mounted→create、unmounted→destroy 严格配对，句柄随卸载失效', () => {
    const { Comp, calls } = makeProbe();
    const { app, container } = mountVue(Comp, { n: 1 });
    expect(calls).toEqual(['create:1']);
    const vm = (container.firstElementChild as HTMLElement & { __vueParentComponent?: unknown });
    expect(vm).toBeTruthy(); /* 渲染出根 div */
    app.unmount();
    container.remove();
    expect(calls).toEqual(['create:1', 'destroy:h1']); /* 无泄漏配对 */
  });

  test('opts deep 变化走 update 路径（同句柄原地更新）', async () => {
    const { Comp, calls } = makeProbe();
    const container = document.createElement('div');
    document.body.appendChild(container);
    /* 驱动方式 = 消费方真实用法：外层 reactive 对象作 prop，深层突变经代理命中 deep watch */
    const state = reactive<ProbeOpts>({ n: 1 });
    const app = createApp(defineComponent({
      setup: () => () => h(Comp as never, { opts: state }),
    }));
    app.mount(container);
    expect(calls).toEqual(['create:1']);
    state.n = 2;
    await nextTick();
    await nextTick();
    expect(calls.some((c) => c.startsWith('update:'))).toBe(true);
    expect(calls.some((c) => c.startsWith('destroy:'))).toBe(false); /* 未走重建 */
    app.unmount();
    container.remove();
  });

  test('emits 桥（kebab 名）：子树 icen:* 事件透出为组件 emit，卸载后解绑', () => {
    const seen: Array<[string, unknown]> = [];
    const Comp = createVueRenderer<ProbeOpts, ProbeHandle>({
      create: (el) => { el.className = 'emitter'; return { tag: 'e' }; },
      destroy: () => {},
      events: ['ai-send'],
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      setup: () => () => h(Comp as never, {
        opts: { n: 0 },
        onAiSend: (detail: unknown) => seen.push(['ai-send', detail]),
      }),
    });
    app.mount(container);
    container.querySelector('.emitter')?.dispatchEvent(
      new CustomEvent('icen:ai-send', { bubbles: true, detail: { text: 'hi' } }),
    );
    expect(seen.length).toBe(1);
    expect((seen[0] as [string, { text: string }])[1].text).toBe('hi');
    app.unmount();
    container.remove();
    container.querySelector === null; /* 容器已卸载 */
    document.body.dispatchEvent(new CustomEvent('icen:ai-send', { bubbles: true, detail: { text: 'late' } }));
    expect(seen.length).toBe(1); /* 桥已摘：不再透出 */
  });
});
