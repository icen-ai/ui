import {afterEach, expect, test} from 'bun:test';
import {initCommandPalette, openCommandPalette, closeCommandPalette} from '../../src/behaviors/command-palette';

const cleanup: (() => void)[] = [];
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function fixture() {
  const backdrop = document.createElement('div');
  backdrop.className = 'icen-command-palette-backdrop';
  backdrop.setAttribute('data-icen-command-palette', 'demo');
  backdrop.hidden = true;
  backdrop.innerHTML = `<div class="icen-command-palette">
    <div class="icen-command-palette-search"><input class="icen-command-palette-input" placeholder="搜索命令" /></div>
    <div class="icen-command-palette-body">
      <div class="icen-command-palette-group">
        <button class="icen-command-palette-item" type="button"><span class="icen-command-palette-item-label">新建文件</span></button>
        <button class="icen-command-palette-item" type="button"><span class="icen-command-palette-item-label">打开设置</span></button>
        <button class="icen-command-palette-item" type="button" disabled><span class="icen-command-palette-item-label">不可用项</span></button>
        <button class="icen-command-palette-item" type="button"><span class="icen-command-palette-item-label">导出文档</span></button>
      </div>
      <div class="icen-command-palette-empty" hidden>无匹配命令</div>
    </div>
  </div>`;
  document.body.append(backdrop);
  cleanup.push(() => { closeCommandPalette('demo', { immediate: true }); backdrop.remove(); });
  return { backdrop, input: backdrop.querySelector<HTMLInputElement>('.icen-command-palette-input')! };
}
const items = (b: HTMLElement) => [...b.querySelectorAll<HTMLElement>('.icen-command-palette-item:not([hidden]):not([disabled]):not([aria-disabled="true"])')];
const key = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren(); });

test('input is a combobox wired to a listbox with option ids and activedescendant tracking', () => {
  const { backdrop, input } = fixture();
  cleanup.push(initCommandPalette()); // 过滤走 init 的输入委托
  openCommandPalette('demo');
  const body = backdrop.querySelector('.icen-command-palette-body')!;
  expect(input.getAttribute('role')).toBe('combobox');
  expect(input.getAttribute('aria-expanded')).toBe('true');
  expect(input.getAttribute('aria-controls')).toBe(body.id);
  expect(body.getAttribute('role')).toBe('listbox');
  const list = items(backdrop);
  expect(list.every(i => i.getAttribute('role') === 'option' && i.id)).toBe(true);
  // 过滤后首项激活并同步 activedescendant；禁用项被跳过
  input.value = '档';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const active = backdrop.querySelector('.icen-command-palette-item.is-active')!;
  expect(active.textContent).toContain('导出文档');
  expect(input.getAttribute('aria-activedescendant')).toBe(active.id);
  expect(active.getAttribute('aria-selected')).toBe('true');
});

test('Home/End jump to edges and arrow navigation wraps, skipping disabled items', () => {
  const { backdrop } = fixture();
  openCommandPalette('demo');
  const list = items(backdrop); // 3 可用（1 禁用）
  expect(list).toHaveLength(3);
  key('End');
  expect(backdrop.querySelector('.is-active')!.textContent).toContain('导出文档');
  key('ArrowDown'); // 回卷到首项
  expect(backdrop.querySelector('.is-active')!.textContent).toContain('新建文件');
  key('ArrowUp'); // 回卷到末项
  expect(backdrop.querySelector('.is-active')!.textContent).toContain('导出文档');
  key('Home');
  expect(backdrop.querySelector('.is-active')!.textContent).toContain('新建文件');
});

test('close has a closing phase; reopening continues from it without duplicate state', async () => {
  const { backdrop } = fixture();
  openCommandPalette('demo');
  closeCommandPalette('demo');
  expect(backdrop.dataset.icenState).toBe('closing');
  expect(backdrop.hidden).toBe(false); // 淡出中仍可见
  openCommandPalette('demo'); // 中断退场
  expect(backdrop.dataset.icenState).toBeUndefined();
  expect(backdrop.hidden).toBe(false);
  await wait(300);
  expect(backdrop.hidden).toBe(false); // 不会再被旧定时器关掉
  closeCommandPalette('demo');
  await wait(300);
  expect(backdrop.hidden).toBe(true);
  expect(backdrop.dataset.icenState).toBeUndefined();
});

test('immediate close and teardown skip the exit and release the scroll lock', () => {
  const { backdrop } = fixture();
  openCommandPalette('demo');
  expect(document.body.style.overflow).toBe('hidden');
  closeCommandPalette('demo', { immediate: true });
  expect(backdrop.hidden).toBe(true);
  expect(document.body.style.overflow).toBe('');
});

test('global hotkey toggles and dispose closes an open palette', () => {
  const { backdrop } = fixture();
  const dispose = initCommandPalette();
  cleanup.push(dispose);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  expect(backdrop.hidden).toBe(false);
  dispose();
  expect(backdrop.hidden).toBe(true);
});
