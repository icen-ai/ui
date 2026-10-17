// autocomplete 行为验收：WAI combobox aria 全链 / 键盘导航循环 / 选中双事件 /
// freeSolo 两态（失焦回退 vs 落定）/ 异步竞态丢弃旧结果 / <mark> 高亮 / 空结果态 /
// Esc 还原 / open()·close()·setValue() 程序化面。
// 面板 portal 到 body，辅助函数一律按 input 的 aria-controls 反查（同用例多实例不串）。
// 语义源：src/behaviors/autocomplete.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';
import {
  createAutocomplete,
  type AutocompleteHandle,
  type AutocompleteItem,
} from '../../src/behaviors/autocomplete';

const FRUITS = ['apple', 'apricot', 'banana', 'cherry'];
const filterFruits = (q: string): AutocompleteItem[] =>
  FRUITS.filter((f) => f.toLowerCase().includes(q.toLowerCase()));

const handles: AutocompleteHandle[] = [];

function setup(opts?: Partial<Parameters<typeof createAutocomplete>[1]>) {
  const host = mount('<input class="icen-input" />');
  const input = host.querySelector<HTMLInputElement>('input')!;
  const handle = createAutocomplete(input, { source: filterFruits, debounceMs: 0, ...opts });
  handles.push(handle);
  return { host, input, handle };
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  fire(input, 'input');
}

function press(input: HTMLInputElement, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  input.dispatchEvent(ev);
  return ev;
}

const panelOf = (input: HTMLInputElement): HTMLElement =>
  document.getElementById(input.getAttribute('aria-controls')!)!.closest('.icen-autocomplete-panel') as HTMLElement;
const optionsOf = (input: HTMLInputElement): HTMLElement[] =>
  Array.from(panelOf(input).querySelectorAll<HTMLElement>('.icen-autocomplete-option'));
const emptyOf = (input: HTMLInputElement): HTMLElement =>
  panelOf(input).querySelector<HTMLElement>('.icen-autocomplete-empty')!;

afterEach(() => {
  while (handles.length) handles.pop()!.destroy();
  unmountAll();
});

describe('createAutocomplete', () => {
  test('combobox aria 全链：role/aria-autocomplete/expanded/controls/listbox/option/activedescendant', () => {
    const { input } = setup();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    const pid = input.getAttribute('aria-controls')!;
    expect(pid).toBeTruthy();
    type(input, 'ap');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(panelOf(input).hidden).toBe(false);
    expect(panelOf(input).querySelector('[role="listbox"]')?.id).toBe(pid);
    expect(panelOf(input).querySelector('[role="listbox"] [role="status"]')).toBeNull();
    expect(optionsOf(input).length).toBe(2);
    expect(optionsOf(input)[0]!.getAttribute('role')).toBe('option');
    /* 初始 active = 第一项，activedescendant 指认 */
    expect(input.getAttribute('aria-activedescendant')).toBe(optionsOf(input)[0]!.id);
    press(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(optionsOf(input)[1]!.id);
    expect(optionsOf(input)[1]!.classList.contains('is-active')).toBe(true);
    expect(optionsOf(input)[1]!.getAttribute('aria-selected')).toBe('true');
  });

  test('键盘循环：↑↓ 回卷（关闭时按 ↓ 先开层）', () => {
    const { input } = setup();
    press(input, 'ArrowDown'); /* 关层时 ↓ = 开层 */
    expect(panelOf(input).hidden).toBe(false);
    expect(optionsOf(input).length).toBe(4);
    press(input, 'ArrowUp'); /* 从首项回卷到末项 */
    expect(input.getAttribute('aria-activedescendant')).toBe(optionsOf(input)[3]!.id);
    press(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(optionsOf(input)[0]!.id);
  });

  test('Enter 选中：先派 icen:autocomplete-select 再派 change；getValue/setValue 语义', () => {
    const { input, handle } = setup();
    const selects: unknown[] = [];
    const changes: unknown[] = [];
    input.addEventListener('icen:autocomplete-select', (e) => selects.push((e as CustomEvent).detail));
    input.addEventListener('icen:autocomplete-change', (e) => changes.push((e as CustomEvent).detail));
    type(input, 'ap');
    expect(changes).toEqual([{ value: 'ap' }]); /* 输入变化即派 change */
    press(input, 'ArrowDown'); /* apricot */
    press(input, 'Enter');
    expect(selects).toEqual([{ value: 'apricot', label: 'apricot' }]);
    expect(changes.at(-1)).toEqual({ value: 'apricot' });
    expect(input.value).toBe('apricot');
    expect(handle.getValue()).toBe('apricot');
    expect(panelOf(input).hidden).toBe(true);
    handle.setValue('reset');
    expect(input.value).toBe('reset');
    expect(handle.getValue()).toBe('reset');
  });

  test('点击选中同样派双事件', () => {
    const { input } = setup();
    const selects: unknown[] = [];
    input.addEventListener('icen:autocomplete-select', (e) => selects.push((e as CustomEvent).detail));
    type(input, 'ban');
    optionsOf(input)[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    optionsOf(input)[0]!.click();
    expect(selects).toEqual([{ value: 'banana', label: 'banana' }]);
    expect(input.value).toBe('banana');
  });

  test('freeSolo=false（默认）：失焦无选中回退原值，回退不再派 change', () => {
    const { input, handle } = setup();
    const changes: unknown[] = [];
    input.addEventListener('icen:autocomplete-change', (e) => changes.push((e as CustomEvent).detail));
    type(input, 'xyz'); /* 无匹配 → 空结果态 */
    expect(emptyOf(input).hidden).toBe(false);
    fire(input, 'blur');
    expect(input.value).toBe(''); /* 回退到最近提交值（初始空） */
    expect(handle.getValue()).toBe('');
    expect(changes).toEqual([{ value: 'xyz' }]); /* 只有一次输入变化，blur 无选中不再派 */
  });

  test('freeSolo=true：任意输入成立，失焦落定再派一次 change', () => {
    const { input, handle } = setup({ freeSolo: true });
    const changes: unknown[] = [];
    input.addEventListener('icen:autocomplete-change', (e) => changes.push((e as CustomEvent).detail));
    type(input, 'xyz');
    fire(input, 'blur');
    expect(input.value).toBe('xyz');
    expect(handle.getValue()).toBe('xyz');
    expect(changes).toEqual([{ value: 'xyz' }, { value: 'xyz' }]); /* 输入 + 落定 */
  });

  test('Esc 关层并还原显示值；Tab 走默认', () => {
    const host = mount('<input class="icen-input" value="base" />');
    const input = host.querySelector<HTMLInputElement>('input')!;
    const handle = createAutocomplete(input, { source: filterFruits, debounceMs: 0 });
    handles.push(handle);
    type(input, 'basex');
    const tab = press(input, 'Tab');
    expect(tab.defaultPrevented).toBe(false); /* Tab 不拦截 */
    const esc = press(input, 'Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(input.value).toBe('base'); /* 还原到最近提交值 */
    expect(panelOf(input).hidden).toBe(true);
  });

  test('异步竞态守卫：只渲染最新 query 的结果', async () => {
    const resolvers: Array<{ q: string; res: (v: AutocompleteItem[]) => void }> = [];
    const { input } = setup({
      source: (q) => new Promise<AutocompleteItem[]>((res) => resolvers.push({ q, res })),
    });
    type(input, 'a');
    await nextTick();
    type(input, 'ab');
    await nextTick();
    expect(resolvers.map((r) => r.q)).toEqual(['a', 'ab']);
    resolvers[0]!.res(['stale-item']);
    await nextTick();
    expect(optionsOf(input).some((o) => o.textContent === 'stale-item')).toBe(false);
    resolvers[1]!.res(['fresh-item']);
    await nextTick();
    expect(optionsOf(input).length).toBe(1);
    expect(optionsOf(input)[0]!.textContent).toContain('fresh-item');
  });

  test('高亮：命中片段包 <mark>（大小写不敏感），未命中项纯文本', () => {
    const { input } = setup();
    type(input, 'AN');
    expect(optionsOf(input).length).toBe(1); /* banana（大小写不敏感命中） */
    const opt = optionsOf(input)[0]!;
    const mark = opt.querySelector('mark');
    expect(mark).not.toBe(null);
    expect(mark!.textContent).toBe('an'); /* 原文切片，保留大写 B */
    expect(opt.textContent).toBe('banana');
  });

  test('空结果态：默认「无匹配结果」，opts.noResultsLabel 可覆盖', () => {
    const { input } = setup();
    type(input, 'qq');
    expect(emptyOf(input).hidden).toBe(false);
    expect(emptyOf(input).textContent).toBe('无匹配结果');
    expect(optionsOf(input).length).toBe(0);
    const second = setup({ noResultsLabel: '没有哦' });
    type(second.input, 'qq');
    expect(emptyOf(second.input).textContent).toBe('没有哦');
    expect(optionsOf(input).length).toBe(0); /* 第一个实例不受影响 */
  });

  test('候选为 { value, label } 时选中提交 value、显示 label', () => {
    const { input, handle } = setup({
      source: (q) => [
        { value: 'CN', label: '中国 China' },
        { value: 'JP', label: '日本 Japan' },
      ].filter((it) => it.label.toLowerCase().includes(q.toLowerCase())),
    });
    type(input, '中国');
    press(input, 'Enter');
    expect(input.value).toBe('中国 China');
    expect(handle.getValue()).toBe('CN');
  });

  test('renderItem 自定义渲染（string 走 textContent / Node 直挂）', () => {
    const first = setup({ renderItem: (item) => `→ ${item.label}` });
    type(first.input, 'ap');
    expect(optionsOf(first.input)[0]!.textContent).toBe('→ apple');
    const second = setup({
      renderItem: (item) => {
        const b = document.createElement('b');
        b.textContent = item.value;
        return b;
      },
    });
    type(second.input, 'ch');
    expect(optionsOf(second.input)[0]!.querySelector('b')!.textContent).toBe('cherry');
  });

  test('open()/close() 程序化面（open 不受 minChars 限制）', () => {
    const { input, handle } = setup({ minChars: 3 });
    type(input, 'a');
    expect(panelOf(input).hidden).toBe(true); /* 不足 minChars */
    handle.open();
    expect(panelOf(input).hidden).toBe(false);
    expect(optionsOf(input).length).toBeGreaterThan(0);
    handle.close();
    expect(panelOf(input).hidden).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  test('IME 组合态挂起 + Enter 不拦截候选确认', () => {
    const { input } = setup();
    fire(input, 'compositionstart');
    type(input, 'xiang');
    expect(panelOf(input).hidden).toBe(true);
    const ev = press(input, 'Enter');
    expect(ev.defaultPrevented).toBe(false);
    fire(input, 'compositionend');
    /* 补检：xiang 无匹配 → 空结果态层（而非关层） */
    expect(panelOf(input).hidden).toBe(false);
    expect(emptyOf(input).hidden).toBe(false);
  });

  test('maxItems：面板最多显示条数', () => {
    const { input } = setup({ maxItems: 2 });
    type(input, 'a');
    expect(optionsOf(input).length).toBe(2);
  });

  test('destroy：摘面板/监听并还原 role 与 aria 属性', () => {
    const { input, handle } = setup();
    type(input, 'ap');
    handle.destroy();
    expect(document.querySelector('.icen-autocomplete-panel')).toBe(null);
    expect(input.getAttribute('role')).toBe(null);
    expect(input.getAttribute('aria-expanded')).toBe(null);
    expect(input.getAttribute('aria-controls')).toBe(null);
  });
});
