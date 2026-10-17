// tree-select 行为 DOM 测试：多选 chips + 三态父子联动、搜索展开祖先 + 高亮、
// leafOnly、clear、键盘、事件 detail、expandAll/collapseAll、destroy 重 create。
// DOM 契约：src/components/tree-select.css 头注释 + behaviors/tree-select.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  createTreeSelect,
  type TreeNode,
  type TreeSelectHandle,
  type TreeSelectOptions,
} from '../../src/behaviors/tree-select';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, unmountAll } from '../helpers/dom';

afterEach(() => {
  unmountAll();
  /* 面板 portal 到 body 后脱离 mount 宿主：用例间统一清扫，防 querySelector 命中残留 */
  document.querySelectorAll('.icen-tree-select-panel').forEach((p) => p.remove());
});

const NODES: TreeNode[] = [
  {
    value: 'rd', label: '研发', children: [
      { value: 'fe', label: '前端' },
      { value: 'be', label: '后端' },
    ],
  },
  {
    value: 'ops', label: '运维', children: [
      { value: 'sre', label: 'SRE', disabled: true },
      { value: 'dba', label: 'DBA' },
    ],
  },
  { value: 'hr', label: '人事' },
];

function key(el: Element, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
}

interface SetupResult {
  el: HTMLElement;
  handle: TreeSelectHandle;
  details: Array<{ value: string[]; labels: string[] }>;
  changes: Array<[string[], string[]]>;
  trigger: HTMLElement;
  panel: () => HTMLElement;
  row: (value: string) => HTMLElement;
}

function setup(opts: Partial<TreeSelectOptions> = {}): SetupResult {
  const host = mount('<div></div>');
  const el = host.firstElementChild as HTMLElement;
  const details: Array<{ value: string[]; labels: string[] }> = [];
  const changes: Array<[string[], string[]]> = [];
  const handle = createTreeSelect(el, {
    nodes: NODES,
    ...opts,
    onChange: (value, labels) => changes.push([value, labels]),
  });
  onIcen('icen:tree-select-change', (e) => details.push(e.detail));
  return {
    el,
    handle,
    details,
    changes,
    trigger: el.querySelector('.icen-tree-select-trigger')!,
    panel: () => document.querySelector<HTMLElement>('.icen-tree-select-panel')!,
    row: (value) => document.querySelector<HTMLElement>(
      `.icen-tree-select-panel [data-icen-value="${value}"]`,
    )!,
  };
}

describe('createTreeSelect 单选', () => {
  test('默认任意级可选：点分支定值并关面板；事件 detail 形状', () => {
    const { handle, details, changes, trigger, panel } = setup();
    expect(trigger.getAttribute('role')).toBe('combobox');
    fire(trigger, 'click');
    const p = panel();
    expect(p.parentElement).toBe(document.body); /* portal */
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const tree = p.querySelector<HTMLElement>('.icen-tree-select-tree')!;
    expect(tree.getAttribute('role')).toBe('tree');

    fire(p.querySelector('[data-icen-value="rd"]')!, 'click');
    expect(handle.getValue()).toEqual(['rd']);
    expect(handle.getLabels()).toEqual(['研发']);
    expect(p.hidden).toBe(true);
    expect(details).toEqual([{ value: ['rd'], labels: ['研发'] }]);
    expect(changes).toEqual([[['rd'], ['研发']]]);
    expect(document.querySelector('.icen-tree-select-value')!.textContent).toBe('研发');
  });

  test('leafOnly：仅叶子可定值，点分支忽略', () => {
    const { handle, trigger, panel } = setup({ leafOnly: true });
    fire(trigger, 'click');
    const p = panel();
    fire(p.querySelector('[data-icen-value="rd"]')!, 'click');
    expect(handle.getValue()).toEqual([]);
    expect(p.hidden).toBe(false); /* 面板不关 */
    fire(p.querySelector('[data-icen-value="rd"] .icen-tree-select-toggle')!, 'click');
    fire(p.querySelector('[data-icen-value="fe"]')!, 'click');
    expect(handle.getValue()).toEqual(['fe']);
    expect(p.hidden).toBe(true);
  });

  test('disabled 行不可选（单选模式点击忽略）', () => {
    const { handle, trigger, panel, row } = setup();
    fire(trigger, 'click');
    fire(panel().querySelector('[data-icen-value="ops"] .icen-tree-select-toggle')!, 'click');
    fire(row('sre'), 'click');
    expect(handle.getValue()).toEqual([]);
  });

  test('disabled 行：整树勾选时不进值', () => {
    const { handle, trigger, row } = setup({ multiple: true, checkable: true });
    fire(trigger, 'click');
    fire(row('ops'), 'click');
    expect(handle.getValue()).toEqual(['ops', 'dba']);
    expect(handle.getValue()).not.toContain('sre');
    /* 全选状态：ops 自身 + dba 在集合，sre 不在 → mixed 诚实呈现 */
    expect(row('ops').getAttribute('aria-checked')).toBe('mixed');
  });
});

describe('createTreeSelect 多选 + checkable 三态', () => {
  test('父子联动：点父整树选，反选子变混合态，补齐回全选；disabled 子不进值', () => {
    const { handle, details, trigger, panel, row } = setup({ multiple: true, checkable: true });
    fire(trigger, 'click');
    const p = panel();
    fire(row('rd'), 'click');
    expect(handle.getValue()).toEqual(['rd', 'fe', 'be']); /* 文档序 */
    expect(handle.getLabels()).toEqual(['研发', '前端', '后端']);
    expect(row('rd').classList.contains('is-checked')).toBe(true);
    expect(row('rd').getAttribute('aria-checked')).toBe('true');
    expect(details).toEqual([{ value: ['rd', 'fe', 'be'], labels: ['研发', '前端', '后端'] }]);

    /* 展开研发，反选前端 → 研发变 mixed */
    fire(row('rd').querySelector('.icen-tree-select-toggle')!, 'click');
    fire(row('fe'), 'click');
    expect(handle.getValue()).toEqual(['rd', 'be']);
    expect(row('rd').classList.contains('is-mixed')).toBe(true);
    expect(row('rd').getAttribute('aria-checked')).toBe('mixed');

    /* 再选回前端 → 全选 */
    fire(row('fe'), 'click');
    expect(row('rd').classList.contains('is-checked')).toBe(true);

    /* 点运维整树：SRE disabled 不进值 */
    fire(row('ops'), 'click');
    expect(handle.getValue()).toEqual(['rd', 'fe', 'be', 'ops', 'dba']);
    expect(handle.getValue()).not.toContain('sre');

    /* 面板保持打开（多选不关） */
    expect(p.hidden).toBe(false);
  });

  test('trigger chips：多选显示 chips，超出 3 个收 +N，单项 × 移除', () => {
    const { handle, el, trigger, row } = setup({ multiple: true, checkable: true });
    fire(trigger, 'click');
    fire(row('rd'), 'click'); /* rd fe be */
    fire(row('ops'), 'click'); /* + ops dba = 5 个 */
    const chips = () => Array.from(el.querySelectorAll<HTMLElement>('.icen-tree-select-chip'));
    expect(chips()).toHaveLength(4); /* 3 个 + +2 */
    expect(el.querySelector('.icen-tree-select-chip--more')!.textContent).toBe('+2');
    expect(el.querySelector('.icen-tree-select-value')!.hidden).toBe(true); /* chips 接管 */

    /* × 移除「前端」 */
    const x = Array.from(el.querySelectorAll<HTMLElement>('.icen-tree-select-chip-x'));
    fire(x[1]!, 'click'); /* 前端 */
    expect(handle.getValue()).toEqual(['rd', 'be', 'ops', 'dba']);
  });

  test('clearable 清除钮与 handle.clear', () => {
    const { handle, el, trigger, row } = setup({ multiple: true, checkable: true, clearable: true });
    fire(trigger, 'click');
    fire(row('hr'), 'click');
    const clearBtn = el.querySelector<HTMLElement>('.icen-tree-select-clear')!;
    expect(clearBtn.hidden).toBe(false);
    fire(clearBtn, 'click');
    expect(handle.getValue()).toEqual([]);
    expect(clearBtn.hidden).toBe(true);
    expect(el.querySelector('.icen-tree-select-value')!.textContent).toBe('请选择');
    expect(el.querySelectorAll('.icen-tree-select-chip')).toHaveLength(0);
  });

  test('多选无 checkable：点行切选单个节点（无三态）', () => {
    const { handle, trigger, panel, row } = setup({ multiple: true });
    fire(trigger, 'click');
    fire(row('rd').querySelector('.icen-tree-select-toggle')!, 'click'); /* 展开研发 */
    fire(row('fe'), 'click');
    fire(row('be'), 'click');
    expect(handle.getValue()).toEqual(['fe', 'be']);
    expect(row('rd').classList.contains('is-selected')).toBe(false); /* 父不联动 */
    fire(row('fe'), 'click');
    expect(handle.getValue()).toEqual(['be']);
    expect(panel().hidden).toBe(false); /* 多选不关面板 */
  });

  test('初值回填与 setValue（静默）', () => {
    const { handle, details } = setup({ multiple: true, checkable: true, value: ['fe', 'be'] });
    expect(handle.getValue()).toEqual(['fe', 'be']);
    expect(details).toEqual([]);
    handle.setValue(['hr']);
    expect(handle.getValue()).toEqual(['hr']);
    expect(handle.getLabels()).toEqual(['人事']);
    handle.setValue(['nope']); /* 无效值全部剔除 */
    expect(handle.getValue()).toEqual([]);
  });
});

describe('createTreeSelect 搜索', () => {
  test('过滤命中自动展开祖先 + 命中词 <mark> 高亮；无命中 empty 态', () => {
    const { trigger, panel } = setup({ searchable: true, emptyLabel: '没搜到' });
    fire(trigger, 'click');
    const p = panel();
    const input = p.querySelector<HTMLInputElement>('.icen-tree-select-search-input')!;
    expect(document.activeElement).toBe(input);
    const rows = () => Array.from(p.querySelectorAll<HTMLElement>('.icen-tree-select-row'));
    expect(rows()).toHaveLength(3); /* 常规态只渲染根（全折叠） */

    input.value = 'dba';
    fire(input, 'input');
    expect(rows()).toHaveLength(2); /* 运维（祖先）+ DBA */
    expect(rows()[0]!.dataset.icenValue).toBe('ops');
    expect(rows()[0]!.getAttribute('aria-expanded')).toBe('true'); /* 祖先自动展开 */
    const mark = p.querySelector<HTMLElement>('[data-icen-value="dba"] mark')!;
    expect(mark.textContent).toBe('DBA'); /* 命中词保留原文大小写 */
    expect(mark.parentElement!.classList.contains('icen-tree-select-label')).toBe(true);

    input.value = '火星';
    fire(input, 'input');
    expect(rows()).toHaveLength(0);
    const empty = p.querySelector<HTMLElement>('.icen-tree-select-empty')!;
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toBe('没搜到');
    expect(p.querySelector<HTMLElement>('.icen-tree-select-tree')!.hidden).toBe(true);
  });

  test('搜索命中中间级：其子孙路径全部保留可见', () => {
    const { trigger, panel } = setup({ searchable: true });
    fire(trigger, 'click');
    const p = panel();
    const input = p.querySelector<HTMLInputElement>('.icen-tree-select-search-input')!;
    input.value = '研发';
    fire(input, 'input');
    const rows = Array.from(p.querySelectorAll<HTMLElement>('.icen-tree-select-row'));
    /* 研发（命中）+ 前端 + 后端（子孙保留） */
    expect(rows.map((r) => r.dataset.icenValue)).toEqual(['rd', 'fe', 'be']);
    /* 命中词高亮在「研发」行 */
    expect(p.querySelector('[data-icen-value="rd"] mark')!.textContent).toBe('研发');
  });
});

describe('createTreeSelect 键盘 / 展开控制', () => {
  test('↑↓ 移动、→ 展开进首子、← 折叠回父行、Enter 激活、Esc 关', () => {
    const { handle, trigger, panel } = setup({ multiple: true, checkable: true });
    key(trigger, 'ArrowDown'); /* 打开，焦点首行 */
    const p = panel();
    expect(p.hidden).toBe(false);
    const rows = () => Array.from(p.querySelectorAll<HTMLElement>('.icen-tree-select-row'));
    /* 键盘事件派发到焦点行（真实按键路径：行 → tree 冒泡） */
    const nav = (k: string) =>
      key(p.querySelector<HTMLElement>('.icen-tree-select-row.is-focused')!, k);
    expect(rows()[0]!.classList.contains('is-focused')).toBe(true);
    nav('ArrowDown'); /* → 运维 */
    expect(rows()[1]!.classList.contains('is-focused')).toBe(true);
    nav('ArrowRight'); /* 展开运维 */
    expect(rows()[1]!.getAttribute('aria-expanded')).toBe('true');
    expect(rows()).toHaveLength(5); /* +SRE +DBA */
    nav('ArrowRight'); /* 已展开 → 跳过禁用的 SRE，进入 DBA */
    expect(rows()[3]!.classList.contains('is-focused')).toBe(true);
    expect(document.activeElement).toBe(rows()[3]);
    nav('ArrowLeft'); /* DBA 叶子 → 回父行运维 */
    expect(rows()[1]!.classList.contains('is-focused')).toBe(true);
    nav('ArrowLeft'); /* 运维已展开 → 折叠 */
    expect(rows()[1]!.getAttribute('aria-expanded')).toBe('false');
    expect(rows()).toHaveLength(3);
    nav('Enter'); /* 激活运维 → 整树勾选 */
    expect(handle.getValue()).toEqual(['ops', 'dba']);
    expect(document.activeElement).toBe(rows()[1]);
    expect(p.hidden).toBe(false); /* 多选不关面板 */
    nav('Escape');
    expect(p.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  test('expandAll / collapseAll', () => {
    const { handle, trigger, panel } = setup({ multiple: true });
    handle.expandAll();
    fire(trigger, 'click');
    expect(panel().querySelectorAll('.icen-tree-select-row')).toHaveLength(7); /* 全部节点 */
    handle.collapseAll(); /* 打开态即时生效 */
    expect(panel().querySelectorAll('.icen-tree-select-row')).toHaveLength(3);
    handle.expandAll();
    expect(panel().querySelectorAll('.icen-tree-select-row')).toHaveLength(7);
    fire(trigger, 'click'); /* 关面板 */
    handle.collapseAll(); /* 关闭态：下次打开生效 */
    fire(trigger, 'click');
    expect(panel().querySelectorAll('.icen-tree-select-row')).toHaveLength(3);
  });

  test('aria 面：treeitem 角色 / aria-level / aria-posinset / aria-setsize', () => {
    const { trigger, panel } = setup();
    fire(trigger, 'click');
    const p = panel();
    fire(p.querySelector('[data-icen-value="rd"] .icen-tree-select-toggle')!, 'click');
    const fe = p.querySelector<HTMLElement>('[data-icen-value="fe"]')!;
    expect(fe.getAttribute('role')).toBe('treeitem');
    expect(fe.getAttribute('aria-level')).toBe('2');
    expect(fe.getAttribute('aria-posinset')).toBe('1');
    expect(fe.getAttribute('aria-setsize')).toBe('2'); /* 前端 + 后端 */
    expect(fe.getAttribute('aria-expanded')).toBeNull(); /* 叶子无 aria-expanded */
  });
});

describe('createTreeSelect 生命周期', () => {
  /** portal 判定：panel 直接挂在 body 下（未 portal 时它在 el 内、el 也在 body 下，须区分） */
  const bodyPortals = () =>
    Array.from(document.body.children).filter((c) => c.classList.contains('icen-tree-select-panel'));

  test('destroy 摘 portal + 监听；同 el 重 create 先销毁旧的（portal 不翻倍）', () => {
    const { el, handle, trigger } = setup({ multiple: true });
    fire(trigger, 'click');
    expect(bodyPortals()).toHaveLength(1);
    handle.destroy();
    expect(bodyPortals()).toHaveLength(0);
    expect(el.querySelector('.icen-tree-select')).toBeNull();

    const h2 = createTreeSelect(el, { nodes: NODES });
    expect(el.querySelectorAll('.icen-tree-select')).toHaveLength(1);
    fire(el.querySelector('.icen-tree-select-trigger')!, 'click');
    expect(bodyPortals()).toHaveLength(1);

    const h3 = createTreeSelect(el, { nodes: NODES });
    expect(bodyPortals()).toHaveLength(0);
    expect(el.querySelectorAll('.icen-tree-select')).toHaveLength(1);
    expect(h2).not.toBe(h3);
    h3.destroy();
    expect(el.querySelector('.icen-tree-select')).toBeNull();
  });
});
