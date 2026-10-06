// carousel 触屏滑动翻页 DOM 测试：pointer: coarse 下自动开 data-icen-gestures="swipe"，
// swipe-left → 下一张 / swipe-right → 上一张（与箭头/dots/键盘同一 go() 通道，同样派
// icen:carousel-change）；非触屏不开 swipe 词位；销毁还原词位并摘监听。
import { afterEach, describe, expect, test } from 'bun:test';
import { initCarousel } from '../../src/behaviors/carousel';
import { destroyGestures, initGestures, onIcen } from '../../src/behaviors/events';
import { mount, unmountAll } from '../helpers/dom';

const CAROUSEL_HTML = `
  <div class="icen-carousel">
    <div class="icen-carousel-track">
      <div class="icen-carousel-slide">s1</div>
      <div class="icen-carousel-slide">s2</div>
      <div class="icen-carousel-slide">s3</div>
    </div>
    <button class="icen-carousel-arrow icen-carousel-arrow--prev" type="button">prev</button>
    <button class="icen-carousel-arrow icen-carousel-arrow--next" type="button">next</button>
    <div class="icen-carousel-dots"></div>
  </div>`;

const offs: Array<() => void> = [];
let originalMatchMedia: typeof window.matchMedia | null = null;

function stubMatchMedia(matches: boolean): void {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function carousel(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.icen-carousel');
  if (!el) throw new Error('carousel 未挂载');
  return el;
}

function track(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.icen-carousel-track');
  if (!el) throw new Error('track 未挂载');
  return el;
}

/** 在轮播上走完一次水平滑动（深子节点 dispatch，验证委托归源）。 */
function swipe(fromX: number, toX: number): void {
  const target = carousel();
  const down = new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: fromX, clientY: 50 });
  target.dispatchEvent(down);
  const up = new PointerEvent('pointerup', { bubbles: true, composed: true, clientX: toX, clientY: 52 });
  target.dispatchEvent(up);
}

afterEach(() => {
  for (const off of offs) off();
  offs.length = 0;
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
    originalMatchMedia = null;
  }
  unmountAll();
  destroyGestures();
});

describe('carousel 触屏滑动（pointer: coarse 自动开 swipe）', () => {
  test('coarse：自动挂 swipe 词位；swipe-left 下一张 / swipe-right 上一张，同通道派 change', () => {
    stubMatchMedia(true);
    mount(CAROUSEL_HTML);
    initGestures();
    const destroy = initCarousel();

    expect(carousel().getAttribute('data-icen-gestures')).toBe('swipe');

    const changes: Array<{ index: number; count: number }> = [];
    offs.push(onIcen('icen:carousel-change', (e) => changes.push(e.detail)));

    swipe(200, 120); /* dx=-80 → swipe-left → 第 2 张 */
    expect(track().style.transform).toBe('translateX(-100%)');
    swipe(200, 120); /* → 第 3 张 */
    expect(track().style.transform).toBe('translateX(-200%)');
    swipe(0, 90); /* dx=90 → swipe-right → 回到第 2 张 */
    expect(track().style.transform).toBe('translateX(-100%)');

    expect(changes).toEqual([
      { index: 1, count: 3 },
      { index: 2, count: 3 },
      { index: 1, count: 3 },
    ]);
    destroy();
  });

  test('fine 指针：不开 swipe 词位，指针序列不切页', () => {
    stubMatchMedia(false);
    mount(CAROUSEL_HTML);
    initGestures();
    const destroy = initCarousel();

    expect(carousel().hasAttribute('data-icen-gestures')).toBe(false);

    const changes: unknown[] = [];
    offs.push(onIcen('icen:carousel-change', (e) => changes.push(e.detail)));
    swipe(200, 120);
    expect(track().style.transform).toBe('translateX(0%)');
    expect(changes).toEqual([]);
    destroy();
  });

  test('销毁：还原 swipe 词位并摘监听，销毁后的滑动不再切页', () => {
    stubMatchMedia(true);
    mount(CAROUSEL_HTML);
    initGestures();
    const destroy = initCarousel();
    expect(carousel().getAttribute('data-icen-gestures')).toBe('swipe');

    const changes: unknown[] = [];
    offs.push(onIcen('icen:carousel-change', (e) => changes.push(e.detail)));

    destroy();
    expect(carousel().hasAttribute('data-icen-gestures')).toBe(false);

    swipe(200, 120);
    expect(track().style.transform).toBe('translateX(0%)');
    expect(changes).toEqual([]);

    /* 可重新 init（幂等标记已复位） */
    initCarousel();
    expect(carousel().getAttribute('data-icen-gestures')).toBe('swipe');
  });

  test('宿主已有其它手势词时追加 swipe，销毁只还原 swipe 词位', () => {
    stubMatchMedia(true);
    mount(CAROUSEL_HTML.replace('<div class="icen-carousel">', '<div class="icen-carousel" data-icen-gestures="click">'));
    initGestures();
    const destroy = initCarousel();
    expect(carousel().getAttribute('data-icen-gestures')).toBe('click swipe');
    destroy();
    expect(carousel().getAttribute('data-icen-gestures')).toBe('click');
  });
});
