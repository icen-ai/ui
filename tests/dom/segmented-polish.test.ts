import {afterEach, expect, test} from 'bun:test';
import {initSegmented} from '../../src/behaviors/controls';

const cleanup: (() => void)[] = [];

function fixture(opts: { disabledIndex?: number } = {}) {
  const root = document.createElement('div');
  root.className = 'icen-segmented';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', '视图');
  ['日', '周', '月'].forEach((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icen-segmented-item' + (i === 1 ? ' is-active' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === 1));
    b.setAttribute('data-icen-value', ['day', 'week', 'month'][i]);
    b.textContent = label;
    if (i === opts.disabledIndex) b.setAttribute('disabled', '');
    root.append(b);
  });
  document.body.append(root);
  return { root, items: [...root.querySelectorAll<HTMLButtonElement>('.icen-segmented-item')] };
}
function key(el: HTMLElement, name: string) { el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })); }

afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren(); });

test('arrow keys move selection with focus following, wrap at edges and sync aria-checked', () => {
  const { root, items } = fixture();
  cleanup.push(initSegmented());
  const seen: string[] = [];
  root.addEventListener('icen:segmented-change', (e) => seen.push((e as CustomEvent).detail.value));

  items[1].focus();
  key(items[1], 'ArrowRight');
  expect(document.activeElement).toBe(items[2]);
  expect(items[2].getAttribute('aria-checked')).toBe('true');
  expect(items[1].getAttribute('aria-checked')).toBe('false');
  expect(seen).toEqual(['month']);

  key(items[2], 'ArrowRight'); // 末项回卷到首项
  expect(document.activeElement).toBe(items[0]);
  expect(seen).toEqual(['month', 'day']);

  key(items[0], 'ArrowLeft'); // 首项左移回卷到末项
  expect(document.activeElement).toBe(items[2]);
});

test('Home/End jump to edges; disabled items are skipped; RTL mirrors visual direction', () => {
  const { root, items } = fixture({ disabledIndex: 2 });
  cleanup.push(initSegmented());
  items[0].focus();
  key(items[0], 'End'); // 末位是禁用项 → 落到最后的可用项
  expect(document.activeElement).toBe(items[1]);
  key(items[1], 'ArrowRight'); // 越过禁用回卷到首项
  expect(document.activeElement).toBe(items[0]);
  key(items[0], 'Home');
  expect(document.activeElement).toBe(items[0]);

  root.style.direction = 'rtl';
  key(items[0], 'ArrowLeft'); // RTL：左键 = 视觉前进
  expect(document.activeElement).toBe(items[1]);
});

test('clicking the active item is a no-op and Space/Enter keep native button semantics', () => {
  const { root, items } = fixture();
  cleanup.push(initSegmented());
  let count = 0;
  root.addEventListener('icen:segmented-change', () => count++);
  items[1].click(); // 已激活：不重复派发
  expect(count).toBe(0);
  items[0].click();
  expect(count).toBe(1);
  expect(items[0].classList.contains('is-active')).toBe(true);
});
