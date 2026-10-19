// React 薄封装契约测试：StrictMode 双挂载 / 卸载清理 / opts 更新路径 / handleRef / 事件桥解绑。
// 对应 docs/frameworks.md「React 兼容矩阵」的行为级证据——矩阵声明在此锁定，不靠自觉。
import { describe, expect, test } from 'bun:test';
import React, { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createIcenComponent, useIcenEvent } from '../../src/react';

/* React 19：act 环境旗标（bun + happy-dom 下显式声明） */
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

interface ProbeHandle { tag: string }
type ProbeOpts = { n: number };

function makeProbe() {
  const calls: string[] = [];
  const Comp = createIcenComponent<ProbeOpts, ProbeHandle>({
    create: (_el, opts) => { calls.push(`create:${opts.n}`); return { tag: `h${opts.n}` }; },
    update: (h, opts) => { calls.push(`update:${h.tag}->${opts.n}`); h.tag = `h${opts.n}`; },
    destroy: (h) => { calls.push(`destroy:${h.tag}`); },
  });
  return { Comp, calls };
}

function mount(node: React.ReactElement): { root: Root; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { root, container };
}

describe('createIcenComponent（React 工厂契约）', () => {
  test('StrictMode 双挂载：effect setup→cleanup→setup，create×2/destroy×1 后句柄存活', () => {
    const { Comp, calls } = makeProbe();
    const handleRef = React.createRef<ProbeHandle | null>();
    const { root, container } = mount(<StrictMode><Comp opts={{ n: 1 }} handleRef={handleRef} /></StrictMode>);
    expect(calls.filter((c) => c.startsWith('create')).length).toBe(2); /* 双挂载 */
    expect(calls.filter((c) => c.startsWith('destroy')).length).toBe(1); /* 只清掉第一次的实例 */
    expect(handleRef.current?.tag).toBe('h1'); /* 存活句柄仍可用 */
    act(() => root.unmount());
    container.remove();
    expect(handleRef.current).toBeNull(); /* 卸载后句柄归 null（消费方拿不到死句柄） */
    expect(calls.filter((c) => c.startsWith('create')).length)
      .toBe(calls.filter((c) => c.startsWith('destroy')).length); /* create/destroy 严格配对，零泄漏 */
  });

  test('opts 变化走 update 路径（同句柄原地更新，不销毁重建）', () => {
    const { Comp, calls } = makeProbe();
    const handleRef = React.createRef<ProbeHandle | null>();
    const { root, container } = mount(<Comp opts={{ n: 1 }} handleRef={handleRef} />);
    act(() => root.render(<Comp opts={{ n: 2 }} handleRef={handleRef} />));
    expect(calls).toContain('update:h1->2');
    expect(calls.filter((c) => c.startsWith('create')).length).toBe(1); /* 未重建 */
    expect(handleRef.current?.tag).toBe('h2');
    act(() => root.unmount());
    container.remove();
  });

  test('无 update 的工厂：opts 变化 = destroy + 同容器重建', () => {
    const calls: string[] = [];
    const Comp = createIcenComponent<ProbeOpts, ProbeHandle>({
      create: (_el, opts) => { calls.push(`create:${opts.n}`); return { tag: `h${opts.n}` }; },
      destroy: (h) => { calls.push(`destroy:${h.tag}`); },
    });
    const { root, container } = mount(<Comp opts={{ n: 1 }} />);
    act(() => root.render(<Comp opts={{ n: 2 }} />));
    expect(calls.join(',')).toBe('create:1,destroy:h1,create:2');
    act(() => root.unmount());
    container.remove();
  });

  test('事件桥（eventRoot）随卸载解绑：unmount 后子树事件不再透出', () => {
    const seen: Array<[string, unknown]> = [];
    const Outer = createIcenComponent<ProbeOpts, ProbeHandle>({
      create: (el) => { el.className = 'outer'; return { tag: 'outer' }; },
      destroy: () => {},
      eventRoot: true,
    });
    const { root, container } = mount(
      <Outer opts={{ n: 0 }} onEvent={(type, detail) => seen.push([type, detail])} />,
    );
    /* 桥在 create 之后装配（工厂既有顺序）：挂载完成后子树事件即可透出 */
    act(() => {
      container.querySelector('.outer')?.dispatchEvent(
        new CustomEvent('icen:ai-send', { bubbles: true, detail: { text: 'y' } }),
      );
    });
    expect(seen.length).toBe(1);
    act(() => root.unmount());
    container.remove();
    /* 卸载后再派同款事件：桥已摘，不再累计 */
    document.body.dispatchEvent(new CustomEvent('icen:ai-send', { bubbles: true, detail: { text: 'z' } }));
    expect(seen.length).toBe(1);
  });
});

describe('useIcenEvent（React 事件原语契约）', () => {
  test('挂载收事件、卸载即解绑（AbortController 路径）', async () => {
    const got: string[] = [];
    function Probe(): React.ReactElement {
      useIcenEvent('icen:ai-send', (d) => { got.push(d.text); });
      return <div />;
    }
    const { root, container } = mount(<Probe />);
    expect(got).toEqual([]);
    act(() => {
      document.dispatchEvent(new CustomEvent('icen:ai-send', { detail: { text: 'a' } }));
    });
    expect(got).toEqual(['a']);
    act(() => root.unmount());
    container.remove();
    act(() => {
      document.dispatchEvent(new CustomEvent('icen:ai-send', { detail: { text: 'b' } }));
    });
    expect(got).toEqual(['a']); /* 解绑后静默 */
  });
});
