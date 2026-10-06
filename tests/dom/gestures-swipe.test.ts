// swipe 手势 DOM 测试：四向派发（detail = 手势包络 + dx/dy）/ 位移不足不派 /
// 主轴不明确不派 / 垂直滚动脉络不派横滑且不吞事件 / pointercancel 中止 /
// 与 click 消歧共存（>5px 不派 click）。语义源：src/behaviors/events.ts 手势层词表。
import { afterEach, describe, expect, test } from 'bun:test';
import { destroyGestures, initGestures, onIcen } from '../../src/behaviors/events';
import { mount, unmountAll } from '../helpers/dom';

const offs: Array<() => void> = [];

function pointer(el: Element, type: string, x: number, y: number): PointerEvent {
  const ev = new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y });
  el.dispatchEvent(ev);
  return ev;
}

function zone(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.zone');
  if (!el) throw new Error('zone 未挂载');
  return el;
}

function btn(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.icen-btn');
  if (!el) throw new Error('btn 未挂载');
  return el;
}

afterEach(() => {
  for (const off of offs) off();
  offs.length = 0;
  unmountAll();
  destroyGestures();
});

describe('swipe 手势（data-icen-gestures="swipe"）', () => {
  test('四向各派一次：位移 ≥48px 且主轴明确；detail 带 dx/dy 与 source 宿主', () => {
    mount('<div class="zone" data-icen-gestures="swipe"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const seen: Array<{ type: string; detail: { dx: number; dy: number; source: HTMLElement } }> = [];
    for (const type of ['icen:swipe-left', 'icen:swipe-right', 'icen:swipe-up', 'icen:swipe-down'] as const) {
      offs.push(onIcen(type, (e) => seen.push({ type, detail: e.detail })));
    }
    /* 从深子节点按下（委托按 closest [data-icen-gestures] 宿主归源） */
    pointer(btn(), 'pointerdown', 80, 20);
    pointer(btn(), 'pointerup', 20, 22); /* dx=-60 dy=2 → left */
    pointer(btn(), 'pointerdown', 20, 20);
    pointer(btn(), 'pointerup', 80, 24); /* dx=60 → right */
    pointer(btn(), 'pointerdown', 40, 80);
    pointer(btn(), 'pointerup', 42, 20); /* dy=-60 → up */
    pointer(btn(), 'pointerdown', 40, 20);
    pointer(btn(), 'pointerup', 44, 80); /* dy=60 → down */

    expect(seen.map((s) => s.type)).toEqual([
      'icen:swipe-left', 'icen:swipe-right', 'icen:swipe-up', 'icen:swipe-down',
    ]);
    expect(seen[0]?.detail.dx).toBe(-60);
    expect(seen[0]?.detail.dy).toBe(2);
    expect(seen[0]?.detail.source).toBe(zone());
    expect(seen[2]?.detail.dy).toBe(-60);
  });

  test('位移不足 48px 不派；主轴不明确（次轴 ≥ 主轴 1/2）不派', () => {
    mount('<div class="zone" data-icen-gestures="swipe"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const seen: string[] = [];
    for (const type of ['icen:swipe-left', 'icen:swipe-right', 'icen:swipe-up', 'icen:swipe-down'] as const) {
      offs.push(onIcen(type, () => seen.push(type)));
    }
    pointer(btn(), 'pointerdown', 0, 0);
    pointer(btn(), 'pointerup', 30, 2); /* 30 < 48 */
    pointer(btn(), 'pointerdown', 0, 0);
    pointer(btn(), 'pointerup', 60, 40); /* 次轴 40 ≥ 主轴 60 的一半 */
    pointer(btn(), 'pointerdown', 0, 0);
    pointer(btn(), 'pointerup', 47, 0); /* 临界 47 < 48 */
    expect(seen).toEqual([]);
  });

  test('垂直滚动脉络不派横滑：move 期次轴先行标记，抬手抑制横向；事件不被吞', () => {
    mount('<div class="zone" data-icen-gestures="swipe"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const seen: string[] = [];
    for (const type of ['icen:swipe-left', 'icen:swipe-right', 'icen:swipe-up', 'icen:swipe-down'] as const) {
      offs.push(onIcen(type, () => seen.push(type)));
    }
    pointer(btn(), 'pointerdown', 100, 100);
    const mv1 = pointer(btn(), 'pointermove', 102, 124); /* dy=24 领先 dx=2：滚动标记 */
    const mv2 = pointer(btn(), 'pointermove', 104, 140);
    pointer(btn(), 'pointerup', 150, 120); /* dx=50 dy=20：无标记时会判 swipe-left */
    expect(seen).toEqual([]);
    expect(mv1.defaultPrevented).toBe(false); /* 不吞事件：原生滚动照常 */
    expect(mv2.defaultPrevented).toBe(false);
  });

  test('pointercancel 中止：取消后抬手不派', () => {
    mount('<div class="zone" data-icen-gestures="swipe"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const seen: string[] = [];
    offs.push(onIcen('icen:swipe-left', () => seen.push('left')));
    pointer(btn(), 'pointerdown', 100, 0);
    pointer(btn(), 'pointermove', 60, 0);
    pointer(btn(), 'pointercancel', 60, 0);
    pointer(btn(), 'pointerup', 0, 0); /* 净位移 100 也不派：已中止 */
    expect(seen).toEqual([]);
  });

  test('与 click 消歧共存：滑动不派 icen:click（>5px 纪律），轻点照常派', () => {
    mount('<div class="zone" data-icen-gestures="click swipe"><button type="button" class="icen-btn">b</button></div>');
    initGestures();
    const seen: string[] = [];
    offs.push(onIcen('icen:swipe-left', () => seen.push('swipe')));
    offs.push(onIcen('icen:click', () => seen.push('click')));

    pointer(btn(), 'pointerdown', 100, 0);
    pointer(btn(), 'pointerup', 20, 0); /* 滑动 80px */
    btn().dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 0 }));
    expect(seen).toEqual(['swipe']); /* click 被位移守卫压掉 */

    pointer(btn(), 'pointerdown', 0, 0);
    pointer(btn(), 'pointerup', 1, 1); /* 轻点 */
    btn().dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 1, clientY: 1 }));
    expect(seen).toEqual(['swipe', 'click']);
  });

  test('未挂 swipe 词位的容器不派（原生事件照走）', () => {
    mount('<button type="button" class="icen-btn">b</button>');
    initGestures();
    const seen: string[] = [];
    offs.push(onIcen('icen:swipe-right', () => seen.push('right')));
    pointer(btn(), 'pointerdown', 0, 0);
    pointer(btn(), 'pointerup', 100, 0);
    expect(seen).toEqual([]);
  });
});
