import { afterEach, expect, test } from 'bun:test';
import { initScrollArea } from '../../src/behaviors/scroll-area';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';

const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).reverse().forEach(fn => fn()); unmountAll(); });

test('delegates non-bubbling scroll to future descendants and hides after local idle delay', async () => {
  const root = mount('<div data-icen-scrollbar-delay="0"></div>');
  disposers.push(initScrollArea({ root, idleDelay: 60000 }));
  const el = document.createElement('div');
  root.firstElementChild!.append(el);
  fire(el, 'scroll', { bubbles: false });
  expect(el.hasAttribute('data-icen-scroll-active')).toBe(true);
  await nextTick(15);
  expect(el.hasAttribute('data-icen-scroll-active')).toBe(false);
});

test('cleanup is idempotent, cancels pending timers, restores authored attributes and allows remount', async () => {
  const root = mount('<div data-icen-scroll-active="authored"></div>');
  root.setAttribute('data-icen-scrollbars-ready', 'authored');
  const el = root.firstElementChild as HTMLElement;
  const dispose = initScrollArea({ root, idleDelay: 0 });
  initScrollArea({ root })(); // duplicate owns nothing
  fire(el, 'scroll');
  dispose(); dispose();
  expect(root.getAttribute('data-icen-scrollbars-ready')).toBe('authored');
  expect(el.getAttribute('data-icen-scroll-active')).toBe('authored');
  await nextTick(15);
  expect(el.getAttribute('data-icen-scroll-active')).toBe('authored');
  el.removeAttribute('data-icen-scroll-active');
  fire(el, 'scroll');
  expect(el.hasAttribute('data-icen-scroll-active')).toBe(false);
  disposers.push(initScrollArea({ root }));
  fire(el, 'scroll');
  expect(el.hasAttribute('data-icen-scroll-active')).toBe(true);
});

test('an inner scope owns its delay independently from document delegation', async () => {
  const root = mount('<div></div>');
  const el = root.firstElementChild as HTMLElement;
  disposers.push(initScrollArea({ idleDelay: 60000 }));
  const disposeInner = initScrollArea({ root, idleDelay: 0 });
  disposers.push(disposeInner);
  fire(el, 'scroll', { bubbles: false });
  await nextTick(15);
  expect(el.hasAttribute('data-icen-scroll-active')).toBe(false);
  disposeInner();
  fire(el, 'scroll', { bubbles: false });
  await nextTick(15);
  expect(el.hasAttribute('data-icen-scroll-active')).toBe(true);
});
