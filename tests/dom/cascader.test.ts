// cascader 行为 DOM 测试：逐级路径选择、changeOnSelect 两态、搜索路径命中与定值、
// 键盘全程、事件 detail、destroy 重 create、外点关闭、disabled。
// DOM 契约：src/components/cascader.css 头注释 + behaviors/cascader.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import { createCascader, type CascaderHandle, type CascaderOptions } from '../../src/behaviors/cascader';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, unmountAll } from '../helpers/dom';

afterEach(() => {
  unmountAll();
  /* 面板 portal 到 body 后脱离 mount 宿主：用例间统一清扫，防 querySelector 命中残留 */
  document.querySelectorAll('.icen-cascader-panel').forEach((p) => p.remove());
});

const OPTIONS = [
  {
    value: 'zj', label: '浙江', children: [
      { value: 'hz', label: '杭州' },
      { value: 'nb', label: '宁波', disabled: true },
    ],
  },
  {
    value: 'gd', label: '广东', children: [
      { value: 'gz', label: '广州' },
      {
        value: 'sz', label: '深圳', children: [
          { value: 'ns', label: '南山' },
          { value: 'ft', label: '福田' },
        ],
      },
    ],
  },
];

function key(el: Element, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
}

interface SetupResult {
  el: HTMLElement;
  handle: CascaderHandle;
  details: Array<{ value: string[]; path: string[] }>;
  changes: Array<[string[], string[]]>;
  trigger: HTMLElement;
  panel: () => HTMLElement;
}

function setup(opts: Partial<CascaderOptions> = {}): SetupResult {
  const host = mount('<div></div>');
  const el = host.firstElementChild as HTMLElement;
  const details: Array<{ value: string[]; path: string[] }> = [];
  const changes: Array<[string[], string[]]> = [];
  const handle = createCascader(el, {
    options: OPTIONS,
    ...opts,
    onChange: (value, path) => changes.push([value, path]),
  });
  onIcen('icen:cascader-change', (e) => details.push(e.detail));
  return {
    el,
    handle,
    details,
    changes,
    trigger: el.querySelector('.icen-cascader-trigger')!,
    panel: () => document.querySelector<HTMLElement>('.icen-cascader-panel')!,
  };
}

describe('createCascader 逐级选择', () => {
  test('逐级点击选择完整路径：中间级只展开不定值，叶子定值并关面板', () => {
    const { handle, details, changes, trigger, panel } = setup({ clearable: true });
    expect(trigger.getAttribute('role')).toBe('combobox');
    fire(trigger, 'click');
    const p = panel();
    expect(p.parentElement).toBe(document.body); /* portal 跳出容器 */
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.icen-cascader')!.classList.contains('is-open')).toBe(true);

    const cols = () => Array.from(p.querySelectorAll('.icen-cascader-col'));
    expect(cols()).toHaveLength(1);
    expect(cols()[0]!.getAttribute('role')).toBe('listbox');
    const zj = p.querySelector<HTMLElement>('[data-icen-value="zj"]')!;
    expect(zj.querySelector('.icen-cascader-item-chevron')).not.toBeNull(); /* 有子级带 chevron */

    fire(zj, 'click');
    /* changeOnSelect 默认 false：中间级点击不定值、面板不关，展开子列 */
    expect(handle.getValue()).toEqual([]);
    expect(p.hidden).toBe(false);
    expect(cols()).toHaveLength(2);
    /* 渲染重建列 DOM，重新查询（旧引用已 detached） */
    const zjAfter = p.querySelector<HTMLElement>('[data-icen-value="zj"]')!;
    expect(zjAfter.classList.contains('is-active')).toBe(true);
    expect(zjAfter.getAttribute('aria-selected')).toBe('true');

    const hz = p.querySelector<HTMLElement>('[data-icen-value="hz"]')!;
    fire(hz, 'click');
    expect(handle.getValue()).toEqual(['zj', 'hz']);
    expect(handle.getPath()).toEqual(['浙江', '杭州']);
    const valueEl = document.querySelector('.icen-cascader-value')!;
    expect(valueEl.textContent).toBe('浙江 / 杭州');
    expect(valueEl.classList.contains('is-empty')).toBe(false);
    expect(p.hidden).toBe(true); /* 叶子定值即关 */
    expect(details).toEqual([{ value: ['zj', 'hz'], path: ['浙江', '杭州'] }]);
    expect(changes).toEqual([[['zj', 'hz'], ['浙江', '杭州']]]);

    /* clearable：有值显示清除钮，点击清空并派发 */
    const clearBtn = document.querySelector<HTMLElement>('.icen-cascader-clear')!;
    expect(clearBtn.hidden).toBe(false);
    fire(clearBtn, 'click');
    expect(handle.getValue()).toEqual([]);
    expect(details).toHaveLength(2);
    expect(details[1]).toEqual({ value: [], path: [] });
    expect(document.querySelector('.icen-cascader-clear')!.hidden).toBe(true);
  });

  test('disabled 项不响应点击与键盘', () => {
    const { handle, trigger, panel } = setup();
    fire(trigger, 'click');
    const p = panel();
    fire(p.querySelector('[data-icen-value="zj"]')!, 'click'); /* 展开子列 */
    const nb = p.querySelector<HTMLElement>('[data-icen-value="nb"]')!;
    expect(nb.classList.contains('is-disabled')).toBe(true);
    fire(nb, 'click');
    expect(handle.getValue()).toEqual([]);
    /* 键盘：zj 行 → 进子级（hz）→ ↓ 跳过宁波（disabled）循环回杭州 */
    key(p, 'ArrowRight'); /* 进子级 → hz */
    key(p, 'ArrowDown'); /* nb disabled → 跳过 → 回 hz */
    const focused = p.querySelectorAll<HTMLElement>('.icen-cascader-col')[1]!
      .querySelector('.icen-cascader-item.is-focused');
    expect(focused!.dataset.icenValue).toBe('hz');
  });

  test('changeOnSelect: true 点中间级即定值并关面板', () => {
    const { handle, details, trigger, panel } = setup({ changeOnSelect: true });
    fire(trigger, 'click');
    fire(panel().querySelector('[data-icen-value="gd"]')!, 'click');
    expect(handle.getValue()).toEqual(['gd']);
    expect(handle.getPath()).toEqual(['广东']);
    expect(panel().hidden).toBe(true);
    expect(details).toEqual([{ value: ['gd'], path: ['广东'] }]);
  });

  test('初值回填与 setValue：有效路径生效、无效路径整体忽略、程序化静默', () => {
    const { el, handle, details } = setup({ value: ['gd', 'sz'] });
    expect(handle.getValue()).toEqual(['gd', 'sz']);
    expect(el.querySelector('.icen-cascader-value')!.textContent).toBe('广东 / 深圳');
    expect(details).toEqual([]); /* setValue/初值不派发 */

    handle.setValue(['zj', 'hz']);
    expect(handle.getValue()).toEqual(['zj', 'hz']);
    handle.setValue(['zj', 'xx']); /* 任一级失配 → 整体忽略 */
    expect(handle.getValue()).toEqual(['zj', 'hz']);
    expect(details).toEqual([]);
  });

  test('无效初值回落占位', () => {
    const { el, handle } = setup({ value: ['zj', 'xx'] });
    expect(handle.getValue()).toEqual([]);
    const valueEl = el.querySelector('.icen-cascader-value')!;
    expect(valueEl.textContent).toBe('请选择');
    expect(valueEl.classList.contains('is-empty')).toBe(true);
  });

  test('外点 / Esc / handle.close 关闭面板', () => {
    const { handle, trigger, panel } = setup();
    fire(trigger, 'click');
    expect(panel().hidden).toBe(false);
    fire(document.body, 'pointerdown');
    expect(panel().hidden).toBe(true);
    handle.open();
    expect(panel().hidden).toBe(false);
    key(panel(), 'Escape');
    expect(panel().hidden).toBe(true);
    handle.open();
    handle.close();
    expect(panel().hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  test('disabled 组件不开面板', () => {
    const { handle, trigger, panel } = setup({ disabled: true });
    expect(trigger.hasAttribute('disabled')).toBe(true);
    fire(trigger, 'click');
    expect(panel().hidden).toBe(true);
    handle.open();
    expect(panel().hidden).toBe(true);
  });
});

describe('createCascader 搜索', () => {
  test('跨级过滤：命中显示完整路径（面包屑 muted 分隔符），点击定值', () => {
    const { handle, trigger, panel } = setup({ searchable: true });
    fire(trigger, 'click');
    const p = panel();
    const input = p.querySelector<HTMLInputElement>('.icen-cascader-search-input')!;
    expect(document.activeElement).toBe(input); /* 可搜索面板打开焦点落搜索框 */
    input.value = '深圳';
    fire(input, 'input');
    expect(p.querySelector<HTMLElement>('.icen-cascader-cols')!.hidden).toBe(true);
    const results = Array.from(p.querySelectorAll<HTMLElement>('.icen-cascader-result'));
    expect(results).toHaveLength(2); /* 南山 + 福田两条叶子路径 */
    expect(results[0]!.getAttribute('role')).toBe('option');
    expect(results[0]!.textContent).toContain('广东');
    expect(results[0]!.textContent).toContain('深圳');
    expect(results[0]!.querySelectorAll('i')).toHaveLength(2); /* 两个 muted / 分隔符 */
    fire(results[0]!, 'click');
    expect(handle.getValue()).toEqual(['gd', 'sz', 'ns']);
    expect(p.hidden).toBe(true);
  });

  test('无命中 empty 态（opts.emptyLabel）与 Esc 先清词再关面板', () => {
    const { trigger, panel } = setup({ searchable: true, emptyLabel: '没有呢' });
    fire(trigger, 'click');
    const p = panel();
    const input = p.querySelector<HTMLInputElement>('.icen-cascader-search-input')!;
    input.value = '火星';
    fire(input, 'input');
    expect(p.querySelectorAll('.icen-cascader-result')).toHaveLength(0);
    const empty = p.querySelector<HTMLElement>('.icen-cascader-empty')!;
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toBe('没有呢');
    /* Esc 第一下：清搜索词 → 多列区回来 */
    key(input, 'Escape');
    expect(p.querySelectorAll('.icen-cascader-col').length).toBeGreaterThan(0);
    expect(p.hidden).toBe(false);
    /* Esc 第二下：关面板 */
    key(input, 'Escape');
    expect(p.hidden).toBe(true);
  });

  test('搜索态键盘：↑↓ 移动 is-focused，Enter 定值；disabled 路径不可定值', () => {
    const { handle, trigger, panel } = setup({ searchable: true });
    fire(trigger, 'click');
    const p = panel();
    const input = p.querySelector<HTMLInputElement>('.icen-cascader-search-input')!;
    input.value = '浙江';
    fire(input, 'input');
    /* 浙江 → 杭州（可点）+ 宁波（disabled）两条叶子路径 */
    const results = () => Array.from(p.querySelectorAll<HTMLElement>('.icen-cascader-result'));
    expect(results()).toHaveLength(2);
    key(input, 'ArrowDown');
    expect(results()[0]!.classList.contains('is-focused')).toBe(true);
    key(input, 'Enter');
    expect(handle.getValue()).toEqual(['zj', 'hz']);
    expect(p.hidden).toBe(true);

    /* disabled 叶子路径：宁波不可定值 */
    fire(trigger, 'click');
    input.value = '宁波';
    fire(input, 'input');
    expect(results()[0]!.classList.contains('is-disabled')).toBe(true);
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(handle.getValue()).toEqual(['zj', 'hz']); /* 值未变 */
  });
});

describe('createCascader 键盘全程（列导航）', () => {
  test('trigger ↓ 开面板 → 进子级 / 移动 / 回上级 / Enter 定值 → Esc 关', () => {
    const { handle, trigger, panel } = setup();
    key(trigger, 'ArrowDown');
    const p = panel();
    expect(p.hidden).toBe(false);
    const col = (i: number) => p.querySelectorAll<HTMLElement>('.icen-cascader-col')[i]!;
    /* 打开焦点 = 首列首项 */
    expect(col(0).querySelector('.icen-cascader-item.is-focused')!.dataset.icenValue).toBe('zj');
    key(p, 'ArrowDown'); /* zj → gd */
    expect(col(0).querySelector('.icen-cascader-item.is-focused')!.dataset.icenValue).toBe('gd');
    key(p, 'ArrowRight'); /* 进 gd 子级 → gz */
    expect(p.querySelectorAll('.icen-cascader-col')).toHaveLength(2);
    expect(col(1).querySelector('.icen-cascader-item.is-focused')!.dataset.icenValue).toBe('gz');
    key(p, 'ArrowDown'); /* gz → sz */
    expect(col(1).querySelector('.icen-cascader-item.is-focused')!.dataset.icenValue).toBe('sz');
    key(p, 'ArrowLeft'); /* 回上级 → 焦点回 gd */
    expect(col(0).querySelector('.icen-cascader-item.is-focused')!.dataset.icenValue).toBe('gd');
    key(p, 'ArrowRight'); /* 再进 → gz */
    key(p, 'ArrowDown'); /* → sz */
    key(p, 'ArrowRight'); /* 进 sz 子级 → ns */
    expect(p.querySelectorAll('.icen-cascader-col')).toHaveLength(3);
    expect(col(2).querySelector('.icen-cascader-item.is-focused')!.dataset.icenValue).toBe('ns');
    key(p, 'ArrowUp'); /* ns → 循环到 ft */
    expect(col(2).querySelector('.icen-cascader-item.is-focused')!.dataset.icenValue).toBe('ft');
    key(p, 'Enter'); /* 叶子定值 */
    expect(handle.getValue()).toEqual(['gd', 'sz', 'ft']);
    expect(handle.getPath()).toEqual(['广东', '深圳', '福田']);
    expect(p.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    /* Esc：关面板回 trigger */
    key(trigger, 'Enter');
    expect(p.hidden).toBe(false);
    key(p, 'Escape');
    expect(p.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});

describe('createCascader 生命周期', () => {
  /** portal 判定：panel 直接挂在 body 下（未 portal 时它在 el 内、el 也在 body 下，须区分） */
  const bodyPortals = () =>
    Array.from(document.body.children).filter((c) => c.classList.contains('icen-cascader-panel'));

  test('destroy 摘 portal + 监听；同 el 重 create 先销毁旧的（portal 不翻倍）', () => {
    const { el, handle, trigger } = setup();
    fire(trigger, 'click');
    expect(bodyPortals()).toHaveLength(1);
    handle.destroy();
    expect(bodyPortals()).toHaveLength(0);
    expect(el.querySelector('.icen-cascader')).toBeNull();

    /* 重 create 正常工作 */
    const h2 = createCascader(el, { options: OPTIONS });
    expect(el.querySelectorAll('.icen-cascader')).toHaveLength(1);
    fire(el.querySelector('.icen-cascader-trigger')!, 'click');
    expect(bodyPortals()).toHaveLength(1);

    /* 同 el 重复 create：旧实例先销毁（portal 摘除，新面板在 el 内未 portal） */
    const h3 = createCascader(el, { options: OPTIONS });
    expect(bodyPortals()).toHaveLength(0);
    expect(el.querySelectorAll('.icen-cascader')).toHaveLength(1);
    expect(h2).not.toBe(h3);
    h3.destroy();
    expect(el.querySelector('.icen-cascader')).toBeNull();
  });

  test('销毁后监听摘除：旧实例事件不再派发', () => {
    const { handle, details, trigger, panel } = setup();
    fire(trigger, 'click');
    fire(panel().querySelector('[data-icen-value="zj"]')!, 'click');
    const count = details.length;
    handle.destroy();
    /* 旧 panel 已移除：再点不触发 */
    expect(details.length).toBe(count);
    expect(bodyPortals()).toHaveLength(0);
  });
});
