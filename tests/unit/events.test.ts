// events 统一事件体系测试：onIcen 四形态（全局/选择器委托/within/signal+once）与解绑、
// emitIcen 三标志（bubbles/composed/cancelable）与 preventDefault 回执、策略层
// setEventPolicy 只在未拦截时触发 + resetEventPolicies 对称清空、initGestures 幂等 +
// data-icen-gestures="click" 派发 icen:click + 位移 >5px 不派发。
// 语义源：src/behaviors/events.ts（手势 × 协议 × 策略 三层）。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  destroyGestures,
  emitIcen,
  initGestures,
  onIcen,
  resetEventPolicies,
  setEventPolicy,
  type IcenGestureDetail,
} from '../../src/behaviors/events';
import { mount, unmountAll } from '../helpers/dom';

afterEach(() => {
  unmountAll();
  resetEventPolicies();
  destroyGestures();
});

function clickAt(el: Element, x: number, y: number): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
}

function pointerDownAt(el: Element, x: number, y: number): void {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
}

describe('onIcen（类型化绑定 / 选择器委托 / within / once / signal）', () => {
  test('全局形态：document 上的监听收冒泡事件，detail 原样', () => {
    const seen: unknown[] = [];
    mount('<button class="icen-x" type="button">b</button>');
    onIcen('icen:tab-change', (e) => seen.push(e.detail));
    const btn = document.querySelector('.icen-x')!;
    emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 2 });
    expect(seen).toEqual([{ tab: null, panel: null, index: 2 }]);
  });

  test('选择器委托：只收 detail.source 命中选择器的事件，解绑函数摘除', () => {
    const seen: string[] = [];
    mount(`
      <div class="zone-a" data-icen-gestures="click"><span class="deep">A</span></div>
      <div class="zone-b" data-icen-gestures="click"><span class="deep">B</span></div>
    `);
    initGestures();
    const off = onIcen('icen:click', '.zone-a', (e) => seen.push((e.detail.source as HTMLElement).className));
    const deepA = document.querySelector('.zone-a .deep')!;
    clickAt(deepA, 1, 1); /* 深子节点命中，委托按 detail.source 匹配 */
    clickAt(document.querySelector('.zone-b .deep')!, 1, 1);
    expect(seen).toEqual(['zone-a']);

    off();
    clickAt(deepA, 1, 1);
    expect(seen).toHaveLength(1);
  });

  test('within 子树限定：只收子树内冒泡；广播事件（document 派发）within 元素收不到', () => {
    const inside: number[] = [];
    const outside: number[] = [];
    mount('<div class="host"><button class="icen-x" type="button">b</button></div><div class="other"></div>');
    const host = document.querySelector('.host')!;
    const other = document.querySelector('.other')!;
    onIcen('icen:tab-change', (e) => inside.push(e.detail.index), { within: host });
    onIcen('icen:tab-change', (e) => outside.push(e.detail.index), { within: other });
    const btn = document.querySelector('.icen-x')!;
    emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 1 });
    expect(inside).toEqual([1]);
    expect(outside).toEqual([]);

    /* 广播：自 document 派发，传播只经 [document, window]——Element within 不在路径上 */
    const broadcast: number[] = [];
    onIcen('icen:tab-change', (e) => broadcast.push(e.detail.index), { within: host });
    emitIcen(document, 'icen:tab-change', { tab: null, panel: null, index: 9 });
    expect(broadcast).toEqual([]);
  });

  test('once：只触发一次后自动解绑；signal：abort 即解绑（含已 abort 的 signal）', () => {
    const onceSeen: number[] = [];
    const sigSeen: number[] = [];
    mount('<button class="icen-x" type="button">b</button>');
    const btn = document.querySelector('.icen-x')!;
    onIcen('icen:tab-change', (e) => onceSeen.push(e.detail.index), { once: true });

    const ac = new AbortController();
    onIcen('icen:tab-change', (e) => sigSeen.push(e.detail.index), { signal: ac.signal });
    emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 1 });
    emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 2 });
    expect(onceSeen).toEqual([1]);
    expect(sigSeen).toEqual([1, 2]);

    ac.abort();
    emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 3 });
    expect(sigSeen).toEqual([1, 2]);

    const ac2 = new AbortController();
    ac2.abort(); /* 已 abort 的 signal：注册即解绑 */
    const late: number[] = [];
    onIcen('icen:tab-change', (e) => late.push(e.detail.index), { signal: ac2.signal });
    emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 4 });
    expect(late).toEqual([]);
  });
});

describe('emitIcen（协议层：三标志 + preventDefault 回执）', () => {
  test('CustomEvent bubbles + composed + cancelable 三标志齐', () => {
    mount('<button class="icen-x" type="button">b</button>');
    const btn = document.querySelector('.icen-x')!;
    let observed: Event | null = null;
    document.addEventListener('icen:tab-change', (e) => { observed = e; });
    emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 0 });
    expect(observed).not.toBeNull();
    expect((observed as Event).bubbles).toBe(true);
    expect((observed as Event).composed).toBe(true);
    expect((observed as Event).cancelable).toBe(true);
  });

  test('返回 false = 被 preventDefault；无拦截返回 true', () => {
    mount('<button class="icen-x" type="button">b</button>');
    const btn = document.querySelector('.icen-x')!;
    expect(emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 0 })).toBe(true);
    const off = onIcen('icen:tab-change', (e) => e.preventDefault());
    expect(emitIcen(btn, 'icen:tab-change', { tab: null, panel: null, index: 0 })).toBe(false);
    off();
  });
});

describe('策略层（setEventPolicy：只在未 preventDefault 时触发；resetEventPolicies 清空）', () => {
  test('未拦截时策略执行；监听方 preventDefault 后策略不执行', () => {
    mount('<div data-icen-gestures="click"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const calls: string[] = [];
    setEventPolicy('icen:click', () => calls.push('policy'));

    const btn = document.querySelector('.icen-btn')!;
    clickAt(btn, 1, 1);
    expect(calls).toEqual(['policy']);

    const off = onIcen('icen:click', (e) => e.preventDefault());
    clickAt(btn, 1, 1);
    expect(calls).toEqual(['policy']); /* 被拦截：策略不追加 */
    off();
  });

  test('setEventPolicy(type, null) 单点移除；resetEventPolicies 全清', () => {
    mount('<div data-icen-gestures="click"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const calls: string[] = [];
    setEventPolicy('icen:click', () => calls.push('a'));
    setEventPolicy('icen:dblclick', () => calls.push('b'));
    setEventPolicy('icen:click', null); /* 移除 click 策略 */
    const btn = document.querySelector('.icen-btn')!;
    clickAt(btn, 1, 1);
    expect(calls).toEqual([]);

    setEventPolicy('icen:click', () => calls.push('a'));
    resetEventPolicies();
    clickAt(btn, 1, 1);
    expect(calls).toEqual([]);
  });

  test('策略 detail 为手势包络（source / originalEvent / x / y）', () => {
    mount('<div data-icen-gestures="click"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    let detail: IcenGestureDetail | null = null;
    setEventPolicy('icen:click', (e) => { detail = e.detail; });
    clickAt(document.querySelector('.icen-btn')!, 7, 9);
    expect(detail).toMatchObject({ source: document.querySelector('[data-icen-gestures]'), x: 7, y: 9 });
    expect(detail!.originalEvent.type).toBe('click');
  });
});

describe('initGestures（幂等 + click 派发 + 位移守卫 + 销毁重 init）', () => {
  test('幂等：重复 init 不重复派发；销毁后 icen:click 停发；可重新 init', () => {
    mount('<div data-icen-gestures="click"><button type="button" class="icen-btn">b</button></div>');
    const seen: string[] = [];
    onIcen('icen:click', (e) => seen.push(e.type));
    initGestures();
    initGestures();
    const btn = document.querySelector('.icen-btn')!;
    pointerDownAt(btn, 0, 0);
    clickAt(btn, 0, 0);
    expect(seen).toHaveLength(1); /* 重复 init 仍只派一次 */

    destroyGestures();
    clickAt(btn, 0, 0);
    expect(seen).toHaveLength(1);

    initGestures();
    pointerDownAt(btn, 0, 0);
    clickAt(btn, 0, 0);
    expect(seen).toHaveLength(2);
  });

  test('未挂 data-icen-gestures 的容器不派发 icen:click（原生 click 照走）', () => {
    mount('<button type="button" class="plain">b</button>');
    initGestures();
    const seen: string[] = [];
    onIcen('icen:click', (e) => seen.push(e.type));
    const btn = document.querySelector('.plain')!;
    let native = 0;
    btn.addEventListener('click', () => native++);
    clickAt(btn, 0, 0);
    expect(native).toBe(1);
    expect(seen).toHaveLength(0);
  });

  test('位移守卫：按下→松开 >5px 视为拖拽不派发；≤5px 正常派发', () => {
    mount('<div data-icen-gestures="click"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const seen: string[] = [];
    onIcen('icen:click', (e) => seen.push(e.type));
    const btn = document.querySelector('.icen-btn')!;

    pointerDownAt(btn, 0, 0);
    clickAt(btn, 4, 3); /* hypot=5，不超阈值 */
    expect(seen).toHaveLength(1);

    pointerDownAt(btn, 0, 0);
    clickAt(btn, 10, 0); /* 10px > 5px：拖拽，不派发 */
    expect(seen).toHaveLength(1);
  });

  test('同开 dblclick：单击延迟 220ms，双击到达即取消单击，只派 icen:dblclick', async () => {
    mount('<div data-icen-gestures="click dblclick"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const clicks: string[] = [];
    onIcen('icen:click', () => clicks.push('click'));
    onIcen('icen:dblclick', () => clicks.push('dblclick'));
    const btn = document.querySelector('.icen-btn')!;
    pointerDownAt(btn, 0, 0);
    clickAt(btn, 0, 0);
    clickAt(btn, 0, 0); /* 第二击：双击识别窗口内 */
    btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(clicks).toEqual(['dblclick']); /* 双击到达，pending 单击被取消 */
    await new Promise((r) => setTimeout(r, 260));
    expect(clicks).toEqual(['dblclick']);
  });
});
