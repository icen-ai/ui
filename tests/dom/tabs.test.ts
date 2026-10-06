// tabs 行为 DOM 测试：initTabs 幂等 / 点击切换 + icen:tab-change / 销毁后可重新 init。
// DOM 契约：src/components/tabs.css 头注释 + behaviors/tabs.ts（[data-icen-tabs] > [data-icen-tab] + [data-icen-tab-panel]）。
import { afterEach, describe, expect, test } from 'bun:test';
import { initTabs } from '../../src/behaviors/tabs';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, unmountAll } from '../helpers/dom';

const TABS_HTML = `
  <div data-icen-tabs>
    <nav class="icen-tabs" role="tablist">
      <button class="icen-page-tab is-active" data-icen-tab="overview">总览</button>
      <button class="icen-page-tab" data-icen-tab="billing">订阅</button>
      <button class="icen-page-tab" data-icen-tab="audit">审计</button>
    </nav>
    <section data-icen-tab-panel="overview">概览内容</section>
    <section data-icen-tab-panel="billing" hidden>账单内容</section>
    <section data-icen-tab-panel="audit" hidden>审计内容</section>
  </div>
`;

function tab(name: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-icen-tab="${name}"]`);
  if (!el) throw new Error(`tab ${name} 未挂载`);
  return el;
}

afterEach(() => unmountAll());

describe('initTabs', () => {
  test('初始化定位第一个 tab：is-active + aria-selected + 面板 hidden 同步（不派发事件）', () => {
    const events: unknown[] = [];
    onIcen('icen:tab-change', (e) => events.push(e.detail));
    mount(TABS_HTML);
    initTabs();
    expect(tab('overview').classList.contains('is-active')).toBe(true);
    expect(tab('overview').getAttribute('aria-selected')).toBe('true');
    expect(tab('billing').getAttribute('aria-selected')).toBe('false');
    expect(document.querySelector('[data-icen-tab-panel="overview"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-icen-tab-panel="billing"]')?.hasAttribute('hidden')).toBe(true);
    expect(events).toHaveLength(0); /* 初始定位不派发（emit=false 口径） */
  });

  test('幂等：重复 init 不重复绑定，点击只派一次 icen:tab-change', () => {
    const details: Array<{ index: number; tab: HTMLElement | null; panel: HTMLElement | null }> = [];
    onIcen('icen:tab-change', (e) => details.push(e.detail));
    mount(TABS_HTML);
    initTabs();
    initTabs(); /* 第二次：__icenTabsInit 已置位，setup 早退 */
    fire(tab('billing'), 'click');
    expect(details).toHaveLength(1);
    expect(details[0]?.index).toBe(1);
    expect(details[0]?.tab).toBe(tab('billing'));
    expect(details[0]?.panel).toBe(document.querySelector('[data-icen-tab-panel="billing"]'));
  });

  test('点击切换：is-active 迁移、aria-selected 同步、面板 hidden 翻转', () => {
    mount(TABS_HTML);
    initTabs();
    fire(tab('audit'), 'click');
    expect(tab('audit').classList.contains('is-active')).toBe(true);
    expect(tab('overview').classList.contains('is-active')).toBe(false);
    expect(tab('audit').tabIndex).toBe(0);
    expect(tab('overview').tabIndex).toBe(-1);
    expect(document.querySelector('[data-icen-tab-panel="audit"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-icen-tab-panel="overview"]')?.hasAttribute('hidden')).toBe(true);
  });

  test('icen:tab-change 是真实 DOM 自定义事件（原生 addEventListener 同样可收）', () => {
    const seen: string[] = [];
    mount(TABS_HTML);
    document.addEventListener('icen:tab-change', (e) => {
      seen.push((e as CustomEvent).detail.tab?.getAttribute('data-icen-tab') ?? '');
    });
    initTabs();
    fire(tab('billing'), 'click');
    expect(seen).toEqual(['billing']);
  });

  test('销毁函数移除监听后可重新 init（复位幂等标记）', () => {
    const details: unknown[] = [];
    onIcen('icen:tab-change', (e) => details.push(e.detail));
    mount(TABS_HTML);
    const destroy = initTabs();
    initTabs(); /* 早退的一次返回 no-op 销毁，同样可调 */
    fire(tab('billing'), 'click');
    expect(details).toHaveLength(1);

    destroy();
    fire(tab('audit'), 'click'); /* 已注销：不切换也不派发 */
    expect(details).toHaveLength(1);
    expect(tab('billing').classList.contains('is-active')).toBe(true);

    initTabs(); /* 重新接管 */
    fire(tab('audit'), 'click');
    expect(details).toHaveLength(2);
    expect(tab('audit').classList.contains('is-active')).toBe(true);
  });

  test('root 传容器本身也生效（scope instanceof Element 分支）', () => {
    mount(TABS_HTML);
    const container = document.querySelector('[data-icen-tabs]');
    if (!(container instanceof HTMLElement)) throw new Error('容器缺失');
    const destroy = initTabs(container);
    fire(tab('billing'), 'click');
    expect(tab('billing').classList.contains('is-active')).toBe(true);
    destroy();
  });
});
