// datatable v2 DOM 测试：多列排序 / 列重排 / 右冻结 / 行分组聚合 / 单元格编辑 /
// 汇总行 / 键盘导航复制 / 列宽事件 / destroy 无泄漏。
// DOM 契约：src/components/datatable.css 头注释 + behaviors/datatable.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  createTable,
  type TableColumn, type TableHandle, type TableOptions,
} from '../../src/behaviors/datatable';
import { onIcen } from '../../src/behaviors/events';
import { mount, unmountAll, fire } from '../helpers/dom';

interface Row {
  id: string;
  name: string;
  dept: string;
  amount: number;
  status: string;
}

const DATA: Row[] = [
  { id: '1', name: 'alpha', dept: 'A', amount: 10, status: 'todo' },
  { id: '2', name: 'beta', dept: 'A', amount: 20, status: 'done' },
  { id: '3', name: 'gamma', dept: 'B', amount: 30, status: 'todo' },
  { id: '4', name: 'delta', dept: 'B', amount: 40, status: 'done' },
  { id: '5', name: 'epsilon', dept: 'A', amount: 50, status: 'doing' },
];

const COLUMNS: Array<TableColumn<Row>> = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'dept', title: '部门', sortable: true },
  { key: 'amount', title: '金额', sortable: true, editable: 'number', aggregate: 'sum' },
  { key: 'status', title: '状态', editable: 'select', editOptions: ['todo', 'doing', 'done'] },
];

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  unmountAll();
});

type Detail = Record<string, unknown>;

/** 监听全部 datatable 领域事件（用例断言 events 数组）。 */
function watch(events: Array<{ type: string; detail: Detail }>): void {
  const types = [
    'icen:table-sort-change', 'icen:table-column-reorder', 'icen:table-group-toggle',
    'icen:table-cell-edit', 'icen:table-column-resize', 'icen:table-selection-change',
    'icen:table-row-click', 'icen:table-page-change', 'icen:table-search-change',
  ] as const;
  for (const t of types) {
    cleanups.push(onIcen(t, (e) => events.push({ type: t, detail: e.detail as Detail })));
  }
}

function setup(
  opts: Partial<TableOptions<Row>> = {},
  data: Row[] = DATA,
): { host: HTMLElement; handle: TableHandle<Row>; events: Array<{ type: string; detail: Detail }> } {
  const host = mount('<div id="dt-host"></div>').querySelector<HTMLElement>('#dt-host')!;
  const events: Array<{ type: string; detail: Detail }> = [];
  watch(events);
  const handle = createTable<Row>(host, {
    columns: COLUMNS.map((c) => ({ ...c })),
    /* 行拷贝：updateCell 会原地写回 data，隔离用例间污染 */
    data: data.map((r) => ({ ...r })),
    rowKey: 'id',
    ...opts,
  });
  return { host, handle, events };
}

/* ── 查询与事件工具 ── */
const heads = (host: HTMLElement): HTMLElement[] =>
  Array.from(host.querySelectorAll<HTMLElement>('.icen-dt-cell--head'));
const dataRows = (host: HTMLElement): HTMLElement[] =>
  Array.from(host.querySelectorAll<HTMLElement>('.icen-dt-body .icen-dt-row:not(.icen-dt-row--group)'));
const groupRows = (host: HTMLElement): HTMLElement[] =>
  Array.from(host.querySelectorAll<HTMLElement>('.icen-dt-row--group'));
const summaryRow = (host: HTMLElement): HTMLElement | null =>
  host.querySelector<HTMLElement>('.icen-dt-row--summary');
const cellOf = (host: HTMLElement, rowKey: string, colKey: string): HTMLElement =>
  host.querySelector<HTMLElement>(
    `.icen-dt-body .icen-dt-row[data-icen-key="${rowKey}"] .icen-dt-cell[data-icen-col-key="${colKey}"]`,
  )!;
const headOf = (host: HTMLElement, colKey: string): HTMLElement =>
  host.querySelector<HTMLElement>(`.icen-dt-cell--head[data-icen-col-key="${colKey}"]`)!;

function click(el: Element, init: MouseEventInit = {}): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
}
function keydown(el: Element, key: string, init: KeyboardEventInit = {}): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init }));
}
/** 指针事件：happy-dom 无 PointerEvent 构造齐全，手工补坐标/按键字段。 */
function pointer(target: EventTarget, type: string, x: number, y = 0): void {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  target.dispatchEvent(ev);
}
/** 模拟表头列宽（拖拽落点判定吃 getBoundingClientRect）。 */
function mockHeadRects(host: HTMLElement, width = 100): void {
  heads(host).forEach((c, i) => {
    c.getBoundingClientRect = (() =>
      ({ left: i * width, right: (i + 1) * width, top: 0, bottom: 40, width, height: 40, x: i * width, y: 0, toJSON: () => ({}) })) as typeof c.getBoundingClientRect;
  });
}

/* ══════════ 1. 多列排序 ══════════ */

describe('多列排序（multiSort）', () => {
  test('Shift+点击追加次级排序：徽标显示优先级序号，getSorts 反映排序栈', () => {
    const { host, handle } = setup({ multiSort: true });
    click(headOf(host, 'dept'));
    expect(handle.getSorts()).toEqual([{ key: 'dept', dir: 'asc' }]);
    expect(headOf(host, 'dept').querySelector('.icen-dt-sort-badge')).toBeNull();

    click(headOf(host, 'amount'), { shiftKey: true });
    expect(handle.getSorts()).toEqual([{ key: 'dept', dir: 'asc' }, { key: 'amount', dir: 'asc' }]);
    expect(headOf(host, 'dept').querySelector('.icen-dt-sort-badge')?.textContent).toBe('1');
    expect(headOf(host, 'amount').querySelector('.icen-dt-sort-badge')?.textContent).toBe('2');
    /* 主排序优先，同组内按次级的 amount 升序 */
    expect(dataRows(host).map((r) => r.dataset.icenKey)).toEqual(['1', '2', '5', '3', '4']);
  });

  test('主/次级优先级生效：dept 升序 + amount 降序 → 组内 50/20/10', () => {
    const { host, handle } = setup({ multiSort: true });
    handle.setSorts([{ key: 'dept', dir: 'asc' }, { key: 'amount', dir: 'desc' }]);
    expect(dataRows(host).map((r) => r.dataset.icenKey)).toEqual(['5', '2', '1', '4', '3']);
  });

  test('Shift+点击已排序列循环 升→降→移除，其它列优先级不动', () => {
    const { host, handle } = setup({ multiSort: true });
    handle.setSorts([{ key: 'dept', dir: 'asc' }, { key: 'amount', dir: 'asc' }]);
    click(headOf(host, 'dept'), { shiftKey: true }); /* dept → desc，仍优先 */
    expect(handle.getSorts()).toEqual([{ key: 'dept', dir: 'desc' }, { key: 'amount', dir: 'asc' }]);
    expect(dataRows(host).map((r) => r.dataset.icenKey)).toEqual(['3', '4', '1', '2', '5']);
    click(headOf(host, 'dept'), { shiftKey: true }); /* dept 移除，amount 升为主 */
    expect(handle.getSorts()).toEqual([{ key: 'amount', dir: 'asc' }]);
    expect(headOf(host, 'amount').querySelector('.icen-dt-sort-badge')).toBeNull();
    expect(headOf(host, 'amount').getAttribute('aria-sort')).toBe('ascending');
  });

  test('setSorts 整体替换：应用排序、回调 onSortChange、不派 sort-change（与 setSort 同纪律）', () => {
    const onSortChangeLog: Array<[string | null, string]> = [];
    const { host, handle, events } = setup({
      multiSort: true,
      onSortChange: (key, dir) => onSortChangeLog.push([key, dir]),
    });
    handle.setSorts([{ key: 'amount', dir: 'desc' }, { key: 'name', dir: 'asc' }]);
    expect(events.filter((e) => e.type === 'icen:table-sort-change')).toHaveLength(0);
    expect(onSortChangeLog).toEqual([['amount', 'desc']]);
    expect(dataRows(host).map((r) => r.dataset.icenKey)).toEqual(['5', '4', '3', '2', '1']);
    /* getSorts 返回副本：外部改数组不影响内部状态 */
    const copy = handle.getSorts();
    copy.push({ key: 'dept', dir: 'asc' });
    expect(handle.getSorts()).toHaveLength(2);
  });

  test('单排序兼容：multiSort 关闭时 Shift 无效；点击循环 升→降→取消（取消回调旧口径 (null, desc)）', () => {
    const onSortChangeLog: Array<[string | null, string]> = [];
    const { host, handle, events } = setup({
      onSortChange: (key, dir) => onSortChangeLog.push([key, dir]),
    });
    click(headOf(host, 'amount'));
    expect(handle.getSorts()).toEqual([{ key: 'amount', dir: 'asc' }]);
    click(headOf(host, 'amount'), { shiftKey: true }); /* Shift 无效 */
    expect(handle.getSorts()).toEqual([{ key: 'amount', dir: 'desc' }]);
    click(headOf(host, 'amount')); /* 第三次取消 */
    expect(handle.getSorts()).toEqual([]);
    expect(onSortChangeLog).toEqual([
      ['amount', 'asc'],
      ['amount', 'desc'],
      [null, 'desc'], /* 旧口径：取消时保留上一方向 */
    ]);
    const sortEvents = events.filter((e) => e.type === 'icen:table-sort-change');
    expect(sortEvents.map((e) => e.detail)).toEqual([
      { key: 'amount', dir: 'asc' },
      { key: 'amount', dir: 'desc' },
    ]); /* 取消时不派（旧口径） */
  });

  test('排序事件只报主排序（Shift 追加不改变主键时事件重复主键）', () => {
    const { host, events } = setup({ multiSort: true });
    click(headOf(host, 'dept'));
    click(headOf(host, 'amount'), { shiftKey: true });
    const sortEvents = events.filter((e) => e.type === 'icen:table-sort-change');
    expect(sortEvents.map((e) => e.detail)).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'dept', dir: 'asc' },
    ]);
  });
});

/* ══════════ 2. 列重排 ══════════ */

describe('列重排（reorderable）', () => {
  const RCOLUMNS: Array<TableColumn<Row>> = [
    { key: 'id', title: 'ID', frozen: true, width: '80px', sortable: true },
    { key: 'name', title: '名称', sortable: true },
    { key: 'dept', title: '部门' },
    { key: 'status', title: '状态', frozen: 'right', width: '90px' },
  ];

  test('handle.moveColumn 换位并派 icen:table-column-reorder（fromIndex/toIndex）', () => {
    const { host, handle, events } = setup({ reorderable: true, columns: RCOLUMNS });
    handle.moveColumn('name', 2);
    expect(events.filter((e) => e.type === 'icen:table-column-reorder').map((e) => e.detail)).toEqual([
      { key: 'name', fromIndex: 1, toIndex: 2 },
    ]);
    expect(heads(host).map((c) => c.dataset.icenColKey)).toEqual(['id', 'dept', 'name', 'status']);
  });

  test('冻结分区互不跨越：左冻结/右冻结/自由块各自界内夹取，无变化不派事件', () => {
    const { host, handle, events } = setup({ reorderable: true, columns: RCOLUMNS });
    handle.moveColumn('id', 3);   /* 左冻结列想跳出左块 → 夹回 0，原位不动 */
    handle.moveColumn('status', 0); /* 右冻结列想跳出右块 → 夹回 3，原位不动 */
    handle.moveColumn('dept', 0);   /* 自由列想进左冻结块 → 夹到 1 */
    expect(heads(host).map((c) => c.dataset.icenColKey)).toEqual(['id', 'dept', 'name', 'status']);
    const reorders = events.filter((e) => e.type === 'icen:table-column-reorder');
    expect(reorders).toHaveLength(1);
    expect(reorders[0]!.detail).toEqual({ key: 'dept', fromIndex: 2, toIndex: 1 });
  });

  test('表头拖拽：影子 + 插入指示线出现，pointerup 完成换位并派事件', () => {
    const { host, events } = setup({ reorderable: true, columns: RCOLUMNS });
    mockHeadRects(host, 100);
    const nameHead = headOf(host, 'name');
    pointer(nameHead, 'pointerdown', 120, 10);
    pointer(document, 'pointermove', 260, 10); /* 位移 >5px：进入拖拽 */
    expect(document.body.querySelector('.icen-dt-col-ghost')).not.toBeNull();
    expect(document.body.querySelector('.icen-dt-col-indicator')).not.toBeNull();
    expect(nameHead.classList.contains('is-drag-source')).toBe(true);
    pointer(document, 'pointerup', 260, 10);
    expect(document.body.querySelector('.icen-dt-col-ghost')).toBeNull();
    expect(document.body.querySelector('.icen-dt-col-indicator')).toBeNull();
    expect(heads(host).map((c) => c.dataset.icenColKey)).toEqual(['id', 'dept', 'name', 'status']);
    expect(events.filter((e) => e.type === 'icen:table-column-reorder').map((e) => e.detail)).toEqual([
      { key: 'name', fromIndex: 1, toIndex: 2 },
    ]);
  });

  test('拖拽的尾随 click 被抑制，不触发排序', () => {
    const { host, events } = setup({ reorderable: true, columns: RCOLUMNS });
    mockHeadRects(host, 100);
    const nameHead = headOf(host, 'name');
    pointer(nameHead, 'pointerdown', 120, 10);
    pointer(document, 'pointermove', 260, 10);
    pointer(document, 'pointerup', 260, 10);
    click(headOf(host, 'name')); /* 紧跟着的 click：拖拽刚结束，不排序 */
    expect(events.filter((e) => e.type === 'icen:table-sort-change')).toHaveLength(0);
  });
});

/* ══════════ 3. 右侧冻结 ══════════ */

describe('右侧冻结（frozen: right）', () => {
  test('右冻结列：sticky 类 + 右侧偏移按列宽从行尾累计测量（表头 + 表体一致）', () => {
    const { host } = setup({
      columns: [
        { key: 'name', title: '名称' },
        { key: 'dept', title: '部门', frozen: 'right', width: '80px' },
        { key: 'status', title: '状态', frozen: 'right', width: '60px' },
      ],
    });
    const deptBody = cellOf(host, '1', 'dept');
    const statusBody = cellOf(host, '1', 'status');
    expect(deptBody.classList.contains('icen-dt-cell--frozen-right')).toBe(true);
    expect(deptBody.style.right).toBe('60px'); /* 右侧还有 status 60px */
    expect(statusBody.classList.contains('icen-dt-cell--frozen-right')).toBe(true);
    expect(statusBody.style.right).toBe('0px');
    expect(headOf(host, 'dept').classList.contains('icen-dt-cell--frozen-right')).toBe(true);
    expect(headOf(host, 'dept').style.right).toBe('60px');
  });

  test('frozen: true 兼容旧语义 = 左冻结；选择列前导 40px 计入左偏移', () => {
    const { host } = setup({
      selectable: true,
      columns: [
        { key: 'name', title: '名称', frozen: true, width: '100px' },
        { key: 'dept', title: '部门' },
      ],
    });
    const nameCell = cellOf(host, '1', 'name');
    expect(nameCell.classList.contains('icen-dt-cell--frozen')).toBe(true);
    expect(nameCell.classList.contains('icen-dt-cell--frozen-right')).toBe(false);
    expect(nameCell.style.left).toBe('40px'); /* 选择列 40px 前导 */
  });
});

/* ══════════ 4. 行分组 + 聚合 ══════════ */

describe('行分组 + 聚合（groupBy + column.aggregate）', () => {
  test('组头行 = 组名 + 计数 + 各聚合列摘要 chip，值正确', () => {
    const { host } = setup({ groupBy: 'dept' });
    const groups = groupRows(host);
    expect(groups).toHaveLength(2);
    /* 首现行顺序：A 先出现 */
    expect(groups[0]!.classList.contains('is-collapsed')).toBe(false);
    expect(groups[0]!.querySelector('.icen-dt-group-label')?.textContent).toBe('A');
    expect(groups[0]!.querySelector('.icen-dt-group-count')?.textContent).toBe('3 条');
    expect(groups[0]!.querySelector('.icen-dt-group-agg')?.textContent).toBe('金额 80'); /* 10+20+50 */
    expect(groups[1]!.querySelector('.icen-dt-group-agg')?.textContent).toBe('金额 70'); /* 30+40 */
    /* 组间行数 = 组头 + 数据行 */
    expect(dataRows(host)).toHaveLength(5);
  });

  test('点击组头折叠：派 icen:table-group-toggle，组内行隐藏；再点展开', () => {
    const { host, events } = setup({ groupBy: 'dept' });
    click(groupRows(host)[0]!); /* 折叠 A */
    expect(events.filter((e) => e.type === 'icen:table-group-toggle').map((e) => e.detail)).toEqual([
      { key: 'A', collapsed: true },
    ]);
    expect(groupRows(host)[0]!.classList.contains('is-collapsed')).toBe(true);
    expect(groupRows(host)[0]!.querySelector<HTMLElement>('.icen-dt-group-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(dataRows(host)).toHaveLength(2); /* 只剩 B 组两行 */
    click(groupRows(host)[0]!); /* 展开 A */
    expect(events.filter((e) => e.type === 'icen:table-group-toggle').map((e) => e.detail)).toEqual([
      { key: 'A', collapsed: true },
      { key: 'A', collapsed: false },
    ]);
    expect(dataRows(host)).toHaveLength(5);
  });

  test('组折叠状态跨 setData 保持（Map by key）', () => {
    const { host, handle } = setup({ groupBy: 'dept' });
    click(groupRows(host)[0]!); /* 折叠 A */
    handle.setData(DATA.map((r) => ({ ...r, amount: r.amount + 1 })));
    const groups = groupRows(host);
    expect(groups[0]!.classList.contains('is-collapsed')).toBe(true);
    expect(dataRows(host)).toHaveLength(2);
  });

  test('groupBy 函数形式：按返回值分组', () => {
    const { host } = setup({ groupBy: (row: Row) => row.status });
    expect(groupRows(host).map((g) => g.querySelector('.icen-dt-group-label')?.textContent)).toEqual([
      'todo', 'done', 'doing',
    ]);
  });

  test('虚拟滚动兼容：分组拍平后窗口化，组头行参与行高计算', () => {
    const big = Array.from({ length: 100 }, (_, i) => ({
      id: String(i), name: `n${i}`, dept: `G${i % 10}`, amount: i, status: 'todo',
    }));
    const { host } = setup({ virtual: true, rowHeight: 44, height: '420px', groupBy: 'dept' }, big);
    /* flat = 10 组头 + 100 行 = 110；视口 420/44 ≈ 10 行 + 上下 overscan 6 */
    const firstWindow = Array.from(host.querySelectorAll<HTMLElement>('.icen-dt-body .icen-dt-row'));
    expect(firstWindow[0]!.classList.contains('icen-dt-row--group')).toBe(true);
    expect(firstWindow[0]!.querySelector('.icen-dt-group-label')?.textContent).toBe('G0');
    /* 滚到中部：组头 G4 落在窗口首（组头每 11 个条目一个：G_k 在 flat 索引 11k） */
    const scrollEl = host.querySelector<HTMLElement>('.icen-dt-scroll')!;
    scrollEl.scrollTop = 44 * 50;
    fire(scrollEl, 'scroll');
    /* 窗口 [44, 66)：G4 组头 + G4 十行 + G5 组头 + G5 前 10 行 */
    const renderedGroups = Array.from(host.querySelectorAll<HTMLElement>('.icen-dt-row--group'))
      .map((g) => g.querySelector('.icen-dt-group-label')?.textContent);
    expect(renderedGroups).toEqual(['G4', 'G5']);
    const first = host.querySelector<HTMLElement>('.icen-dt-body .icen-dt-row');
    expect(first!.classList.contains('icen-dt-row--group')).toBe(true);
    expect(first!.querySelector('.icen-dt-group-label')?.textContent).toBe('G4');
  });
});

/* ══════════ 5. 单元格编辑 ══════════ */

describe('单元格编辑（column.editable）', () => {
  test('双击进入编辑（input 替换内容），Enter 提交派 icen:table-cell-edit + onCellEdit；宿主不采纳则数据不变，updateCell 后生效', () => {
    const edits: Array<[string, string, unknown]> = [];
    const { host, handle, events } = setup({
      onCellEdit: (rowKey, field, value) => edits.push([rowKey, field, value]),
    });
    const amountCell = cellOf(host, '1', 'amount');
    fire(amountCell, 'dblclick');
    const editor = amountCell.querySelector<HTMLInputElement>('.icen-dt-editor');
    expect(editor).not.toBeNull();
    expect(amountCell.classList.contains('is-editing')).toBe(true);
    editor!.value = '77';
    keydown(editor!, 'Enter');
    expect(events.filter((e) => e.type === 'icen:table-cell-edit').map((e) => e.detail)).toEqual([
      { rowKey: '1', field: 'amount', value: 77, row: { ...DATA[0] } },
    ]);
    expect(edits).toEqual([['1', 'amount', 77]]);
    /* 宿主未采纳：单元格仍显示旧值 */
    expect(cellOf(host, '1', 'amount').textContent).toBe('10');
    handle.updateCell('1', 'amount', 77);
    expect(cellOf(host, '1', 'amount').textContent).toBe('77');
  });

  test('文本编辑以 string 提交；Esc 取消不派事件、值不变', () => {
    const { host, events } = setup({
      columns: [
        { key: 'name', title: '名称', editable: 'text' },
        { key: 'dept', title: '部门' },
      ],
    });
    const cell = cellOf(host, '1', 'name');
    fire(cell, 'dblclick');
    const editor = cell.querySelector<HTMLInputElement>('.icen-dt-editor')!;
    editor.value = 'renamed';
    keydown(editor, 'Escape');
    expect(events.filter((e) => e.type === 'icen:table-cell-edit')).toHaveLength(0);
    expect(cellOf(host, '1', 'name').textContent).toBe('alpha');
    /* 再次进入提交 */
    fire(cellOf(host, '1', 'name'), 'dblclick');
    const editor2 = cellOf(host, '1', 'name').querySelector<HTMLInputElement>('.icen-dt-editor')!;
    editor2.value = 'renamed';
    keydown(editor2, 'Enter');
    expect(events.filter((e) => e.type === 'icen:table-cell-edit').map((e) => (e.detail as { value: unknown }).value)).toEqual(['renamed']);
  });

  test('number 编辑器：非法值 is-invalid 抖动且不提交（也不退出编辑）；合法数字以 number 提交', () => {
    const { host, events } = setup();
    fire(cellOf(host, '2', 'amount'), 'dblclick');
    const editor = cellOf(host, '2', 'amount').querySelector<HTMLInputElement>('.icen-dt-editor')!;
    editor.value = 'abc';
    keydown(editor, 'Enter');
    expect(events.filter((e) => e.type === 'icen:table-cell-edit')).toHaveLength(0);
    expect(host.querySelector('.icen-dt-editor')!.classList.contains('is-invalid')).toBe(true);
    editor.value = ''; /* 空串同样非法 */
    keydown(editor, 'Enter');
    expect(events.filter((e) => e.type === 'icen:table-cell-edit')).toHaveLength(0);
    editor.value = '12.5';
    keydown(editor, 'Enter');
    expect(events.filter((e) => e.type === 'icen:table-cell-edit').map((e) => (e.detail as { value: unknown }).value)).toEqual([12.5]);
  });

  test('select 编辑器：editOptions 渲染选项，change 提交所选值', () => {
    const { host, events } = setup();
    fire(cellOf(host, '1', 'status'), 'dblclick');
    const sel = cellOf(host, '1', 'status').querySelector<HTMLSelectElement>('.icen-dt-editor--select')!;
    expect(Array.from(sel.querySelectorAll('option')).map((o) => o.value)).toEqual(['todo', 'doing', 'done']);
    sel.value = 'done';
    fire(sel, 'change');
    expect(events.filter((e) => e.type === 'icen:table-cell-edit').map((e) => e.detail)).toEqual([
      { rowKey: '1', field: 'status', value: 'done', row: { ...DATA[0] } },
    ]);
  });

  test('键盘 Enter 进入编辑（roving tabindex 路径）', () => {
    const { host } = setup();
    const amountCell = cellOf(host, '1', 'amount');
    amountCell.focus();
    keydown(amountCell, 'Enter');
    expect(amountCell.classList.contains('is-editing')).toBe(true);
    keydown(amountCell.querySelector('.icen-dt-editor')!, 'Escape');
    expect(cellOf(host, '1', 'amount').classList.contains('is-editing')).toBe(false);
  });

  test('编辑中的行滚出视口 = 取消（虚拟滚动，无提交事件）', () => {
    const big = Array.from({ length: 200 }, (_, i) => ({
      id: String(i), name: `n${i}`, dept: 'G', amount: i, status: 'todo',
    }));
    const { host, events } = setup(
      { virtual: true, rowHeight: 44, height: '420px', columns: [
        { key: 'name', title: '名称' },
        { key: 'amount', title: '金额', editable: 'number' },
      ] },
      big,
    );
    fire(cellOf(host, '0', 'amount'), 'dblclick');
    expect(host.querySelector('.icen-dt-editor')).not.toBeNull();
    const scrollEl = host.querySelector<HTMLElement>('.icen-dt-scroll')!;
    scrollEl.scrollTop = 44 * 100;
    fire(scrollEl, 'scroll');
    expect(host.querySelector('.icen-dt-editor')).toBeNull();
    expect(events.filter((e) => e.type === 'icen:table-cell-edit')).toHaveLength(0);
  });
});

/* ══════════ 6. 汇总行 ══════════ */

describe('汇总行（summaryRow）', () => {
  test('对象形态：label 列显示「合计」，聚合列按当前管线（筛选后）数据计算', () => {
    const { host, handle } = setup({
      summaryRow: { name: 'label', amount: 'sum', status: 'count' },
    });
    let cells = Array.from(summaryRow(host)!.querySelectorAll<HTMLElement>('.icen-dt-cell--summary'));
    expect(cells.map((c) => c.textContent)).toEqual(['合计', '', '150', '5']);
    handle.setFilter('dept', ['A']); /* 只留 A 组：10+20+50 = 80 */
    cells = Array.from(summaryRow(host)!.querySelectorAll<HTMLElement>('.icen-dt-cell--summary'));
    expect(cells.map((c) => c.textContent)).toEqual(['合计', '', '80', '3']);
  });

  test('true 形态：复用各列 aggregate；搜索后口径同步收窄', () => {
    const { host, handle } = setup({ searchable: true, summaryRow: true });
    const amountSummary = (): string =>
      Array.from(summaryRow(host)!.querySelectorAll<HTMLElement>('.icen-dt-cell--summary'))[2]!.textContent!;
    expect(amountSummary()).toBe('150');
    handle.setSearch('alpha'); /* 只命中 row 1 */
    expect(amountSummary()).toBe('10');
  });

  test('空数据不渲染汇总行（元素保留但 hidden）', () => {
    const { handle, host } = setup({ summaryRow: true }, []);
    expect(summaryRow(host)!.hidden).toBe(true);
    handle.setData(DATA);
    expect(summaryRow(host)!.hidden).toBe(false);
  });
});

/* ══════════ 7. 键盘导航 + 复制 ══════════ */

describe('键盘导航 + 复制（roving tabindex）', () => {
  test('初始焦点格 = 首行首格（tabIndex 0，其余 -1）', () => {
    const { host } = setup();
    const first = cellOf(host, '1', 'name');
    expect(first.tabIndex).toBe(0);
    expect(cellOf(host, '1', 'dept').tabIndex).toBe(-1);
  });

  test('方向键移动焦点格；Home/End 行首末格', () => {
    const { host } = setup();
    const first = cellOf(host, '1', 'name');
    first.focus();
    keydown(first, 'ArrowDown');
    expect(document.activeElement).toBe(cellOf(host, '2', 'name'));
    keydown(document.activeElement!, 'ArrowRight');
    expect(document.activeElement).toBe(cellOf(host, '2', 'dept'));
    keydown(document.activeElement!, 'End');
    expect(document.activeElement).toBe(cellOf(host, '2', 'status'));
    keydown(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(cellOf(host, '2', 'name'));
    keydown(document.activeElement!, 'ArrowUp');
    expect(document.activeElement).toBe(cellOf(host, '1', 'name'));
    /* roving tabindex 跟随焦点 */
    expect((document.activeElement as HTMLElement).tabIndex).toBe(0);
    expect(cellOf(host, '2', 'name').tabIndex).toBe(-1);
  });

  test('边界夹取：首行按上/左停在原地', () => {
    const { host } = setup();
    const first = cellOf(host, '1', 'name');
    first.focus();
    keydown(first, 'ArrowUp');
    expect(document.activeElement).toBe(first);
    keydown(first, 'ArrowLeft');
    expect(document.activeElement).toBe(first);
  });

  test('PageDown/PageUp 按页移动并夹取', () => {
    const big = Array.from({ length: 30 }, (_, i) => ({
      id: String(i), name: `n${i}`, dept: 'G', amount: i, status: 'todo',
    }));
    const { host } = setup({}, big);
    cellOf(host, '0', 'name').focus();
    keydown(document.activeElement!, 'PageDown');
    expect((document.activeElement as HTMLElement).closest('.icen-dt-row')!.dataset.icenKey).toBe('10');
    keydown(document.activeElement!, 'PageDown');
    expect((document.activeElement as HTMLElement).closest('.icen-dt-row')!.dataset.icenKey).toBe('20');
    keydown(document.activeElement!, 'PageDown'); /* 夹到末行 */
    expect((document.activeElement as HTMLElement).closest('.icen-dt-row')!.dataset.icenKey).toBe('29');
    keydown(document.activeElement!, 'PageUp');
    expect((document.activeElement as HTMLElement).closest('.icen-dt-row')!.dataset.icenKey).toBe('19');
  });

  test('Ctrl/Cmd+C 复制当前格文本（clipboard.writeText）', async () => {
    const writes: string[] = [];
    const nav = navigator as Navigator & { clipboard?: { writeText: (t: string) => Promise<void> } };
    const original = nav.clipboard;
    Object.defineProperty(nav, 'clipboard', {
      configurable: true,
      value: { writeText: (t: string) => { writes.push(t); return Promise.resolve(); } },
    });
    try {
      const { host } = setup();
      const cell = cellOf(host, '2', 'name');
      cell.focus();
      keydown(cell, 'c', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 0));
      expect(writes).toEqual(['beta']);
    } finally {
      Object.defineProperty(nav, 'clipboard', { configurable: true, value: original });
    }
  });

  test('有选中行时 Ctrl+C 复制选中行集 TSV（当前可见列）', async () => {
    const writes: string[] = [];
    const nav = navigator as Navigator & { clipboard?: { writeText: (t: string) => Promise<void> } };
    const original = nav.clipboard;
    Object.defineProperty(nav, 'clipboard', {
      configurable: true,
      value: { writeText: (t: string) => { writes.push(t); return Promise.resolve(); } },
    });
    try {
      const { host } = setup({ selectable: true });
      /* 勾选 row 1 与 row 3 */
      for (const key of ['1', '3']) {
        const box = host.querySelector<HTMLInputElement>(
          `.icen-dt-body .icen-dt-row[data-icen-key="${key}"] .icen-dt-cell--check .icen-dt-check`,
        )!;
        box.checked = true;
        fire(box, 'change');
      }
      cellOf(host, '2', 'name').focus();
      keydown(document.activeElement!, 'c', { metaKey: true }); /* Cmd+C 同效 */
      await new Promise((r) => setTimeout(r, 0));
      expect(writes).toHaveLength(1);
      const lines = writes[0]!.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]!.split('\t')).toEqual(['alpha', 'A', '10', 'todo']);
      expect(lines[1]!.split('\t')).toEqual(['gamma', 'B', '30', 'todo']);
    } finally {
      Object.defineProperty(nav, 'clipboard', { configurable: true, value: original });
    }
  });
});

/* ══════════ 8. 列宽拖拽事件 ══════════ */

describe('列宽拖拽事件', () => {
  test('只在拖拽结束时派一次 icen:table-column-resize（过程不派）', () => {
    const { host, events } = setup();
    const handle = host.querySelector<HTMLElement>('.icen-dt-resize')!;
    const cell = handle.closest<HTMLElement>('.icen-dt-cell')!;
    cell.getBoundingClientRect = (() =>
      ({ left: 0, right: 120, top: 0, bottom: 40, width: 120, height: 40, x: 0, y: 0, toJSON: () => ({}) })) as typeof cell.getBoundingClientRect;
    pointer(handle, 'pointerdown', 120, 10);
    pointer(handle, 'pointermove', 150, 10);
    pointer(handle, 'pointermove', 180, 10);
    expect(events.filter((e) => e.type === 'icen:table-column-resize')).toHaveLength(0);
    pointer(handle, 'pointerup', 180, 10);
    expect(events.filter((e) => e.type === 'icen:table-column-resize').map((e) => e.detail)).toEqual([
      { key: 'name', width: '180px' },
    ]);
  });
});

/* ══════════ 9. 销毁无泄漏 ══════════ */

describe('销毁（destroy）', () => {
  test('destroy 清空 DOM、摘除监听：后续交互不派事件、不抛错，且可重新创建', () => {
    const { host, handle, events } = setup({ searchable: true, reorderable: true });
    expect(host.querySelector('.icen-datatable')).not.toBeNull();
    handle.destroy();
    expect(host.textContent).toBe('');
    /* document 级监听已摘除：pointerdown / Escape 不再触发面板逻辑 */
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    /* 残留 body 引用上按键也不导航、不派事件 */
    const staleBody = document.createElement('div');
    staleBody.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(events).toHaveLength(0);
    /* 同宿主可重新创建 */
    const handle2 = createTable<Row>(host, { columns: COLUMNS.map((c) => ({ ...c })), data: DATA, rowKey: 'id' });
    expect(host.querySelector('.icen-datatable')).not.toBeNull();
    expect(dataRows(host)).toHaveLength(5);
    handle2.destroy();
  });

  test('拖拽中途 destroy：影子/指示线清除，document 监听摘除', () => {
    const { host, handle } = setup({
      reorderable: true,
      columns: [
        { key: 'name', title: '名称' },
        { key: 'dept', title: '部门' },
      ],
    });
    mockHeadRects(host, 100);
    pointer(headOf(host, 'name'), 'pointerdown', 20, 5);
    pointer(document, 'pointermove', 90, 5);
    expect(document.body.querySelector('.icen-dt-col-ghost')).not.toBeNull();
    handle.destroy();
    expect(document.body.querySelector('.icen-dt-col-ghost')).toBeNull();
    expect(document.body.querySelector('.icen-dt-col-indicator')).toBeNull();
    /* document 上的 pointerup 不再触发表格逻辑（不抛错即通过） */
    pointer(document, 'pointerup', 90, 5);
  });
});
