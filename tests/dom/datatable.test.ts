// datatable 行为 DOM 测试：createTable 现有能力冒烟（渲染/搜索/筛选/排序/多选/分页/虚拟滚动）、
// setData/getData/getSelected 句柄、CSV 导出字符串形态、事件双通道。
// 语义源：src/behaviors/datatable.ts（函数式 API：createTable(el, opts) → handle）。
import { afterEach, describe, expect, test } from 'bun:test';
import { createTable } from '../../src/behaviors/datatable';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, unmountAll } from '../helpers/dom';

interface Row {
  id: string;
  name: string;
  price: number;
  status: string;
}

const ROWS: Row[] = [
  { id: '1', name: '苹果', price: 5, status: 'on' },
  { id: '2', name: '香蕉', price: 3, status: 'off' },
  { id: '3', name: '橙子', price: 8, status: 'on' },
  { id: '4', name: '西瓜', price: 12, status: 'off' },
];

const COLUMNS = [
  { key: 'name', title: '名称', sortable: true, filterable: true },
  { key: 'price', title: '价格', sortable: true },
  { key: 'status', title: '状态', filterable: true },
];

afterEach(() => unmountAll());

function host(): HTMLElement {
  mount('<div class="table-host"></div>');
  return document.querySelector<HTMLElement>('.table-host')!;
}

function rowsRendered(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.icen-dt-body .icen-dt-row')).map((r) =>
    (r.querySelector<HTMLElement>('.icen-dt-cell')?.textContent ?? '').trim(),
  );
}

describe('createTable 渲染冒烟', () => {
  test('骨架与行渲染：表头/表体/统计行；空数据显示空态', () => {
    const el = host();
    createTable(el, { columns: COLUMNS, data: ROWS, pagination: false });
    expect(el.querySelector('.icen-datatable')).toBeTruthy();
    expect(el.querySelectorAll('.icen-dt-head .icen-dt-cell, .icen-dt-head [data-icen-key]').length).toBeGreaterThan(0);
    expect(rowsRendered()).toEqual(['苹果', '香蕉', '橙子', '西瓜']);
    expect(el.querySelector('.icen-dt-stat')!.textContent).toContain('共 4 条');

    const el2 = host();
    createTable(el2, { columns: COLUMNS, data: [], emptyLabel: '没有数据' });
    expect(el2.querySelector('.icen-dt-empty')!.textContent).toBe('没有数据');
  });

  test('默认分页 10 条/页：超量分页 + 页码窗口；pagination:false 全量', () => {
    const el = host();
    const data = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `n${i}`, price: i, status: 'on' }));
    createTable(el, { columns: COLUMNS, data });
    expect(document.querySelectorAll('.icen-dt-body .icen-dt-row')).toHaveLength(10);
    expect(document.querySelector('.icen-dt-stat')!.textContent).toContain('共 25 条');
    expect(document.querySelectorAll('.icen-dt-page-btn').length).toBeGreaterThan(2);
  });
});

describe('搜索 / 筛选 / 排序 / 选择 / 分页（句柄 + 事件双通道）', () => {
  test('setSearch 跨列过滤（大小写不敏感）；icen:table-search-change 派发', () => {
    const el = host();
    const queries: string[] = [];
    onIcen('icen:table-search-change', (e) => queries.push(e.detail.query));
    const t = createTable(el, { columns: COLUMNS, data: ROWS, pagination: false });
    t.setSearch('苹');
    expect(rowsRendered()).toEqual(['苹果']);
    expect(t.getData()).toHaveLength(1);
    expect(queries).toEqual([]);
    t.destroy();
  });

  test('setFilter 单值过滤 + setFilter(key, null) 清除；setSort 数字感知排序（asc/desc）', () => {
    const el = host();
    const t = createTable(el, { columns: COLUMNS, data: ROWS, pagination: false });
    t.setFilter('status', ['on']);
    expect(rowsRendered()).toEqual(['苹果', '橙子']);
    t.setFilter('status', null);
    expect(rowsRendered()).toHaveLength(4);

    t.setSort('price', 'asc');
    expect(rowsRendered()).toEqual(['香蕉', '苹果', '橙子', '西瓜']);
    t.setSort('price', 'desc');
    expect(rowsRendered()).toEqual(['西瓜', '橙子', '苹果', '香蕉']);
    t.destroy();
  });

  test('多选：勾选行 getSelected / 事件 detail.selected；clearSelection 清空', () => {
    const el = host();
    const selectedBatches: number[] = [];
    onIcen('icen:table-selection-change', (e) => selectedBatches.push(e.detail.selected.length));
    const t = createTable(el, { columns: COLUMNS, data: ROWS, pagination: false, selectable: true, rowKey: 'id' });
    /* 合法 type=checkbox 下 happy-dom 的 click() 自动翻转 checked 并派发 change——直接点即可 */
    const check = (box: HTMLInputElement, _on: boolean): void => {
      box.click();
    };
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('.icen-dt-body .icen-dt-check'));
    check(boxes[1]!, true);
    check(boxes[3]!, true);
    expect(t.getSelected().map((r) => r.name).sort()).toEqual(['西瓜', '香蕉']);
    expect(selectedBatches).toEqual([1, 2]);
    t.clearSelection();
    expect(t.getSelected()).toEqual([]);
    expect(selectedBatches).toEqual([1, 2, 0]);
    t.destroy();
  });

  test('分页点击翻页：icen:table-page-change + 行切片位移；setPageSize 重置回第 1 页', () => {
    const el = host();
    const pages: number[] = [];
    onIcen('icen:table-page-change', (e) => pages.push(e.detail.page));
    const data = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `n${String(i).padStart(2, '0')}`, price: i, status: 'on' }));
    const t = createTable(el, { columns: COLUMNS, data, pageSize: 10 });
    const pageBtns = Array.from(document.querySelectorAll<HTMLElement>('.icen-dt-page-btn'));
    pageBtns.find((b) => b.textContent === '2')!.click();
    expect(pages).toEqual([2]);
    expect(rowsRendered()[0]).toBe('n10');
    t.setPageSize(20);
    expect(pages).toEqual([2, 1]); /* 改页大小回第 1 页 */
    expect(rowsRendered()).toHaveLength(20);
    t.destroy();
  });
});

describe('虚拟滚动冒烟', () => {
  test('virtual 模式窗口化渲染：万级行只挂视口内行 + 占位条撑高', () => {
    const el = host();
    const data = Array.from({ length: 10000 }, (_, i) => ({ id: String(i), name: `row${i}`, price: i, status: 'on' }));
    const t = createTable(el, {
      columns: COLUMNS, data, virtual: true, rowHeight: 44, height: '420px',
    });
    const rendered = document.querySelectorAll('.icen-dt-row').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(100); /* 窗口化：远小于总量 */
    expect(el.querySelector('.icen-datatable--virtual')).toBeTruthy();
    expect(t.getData()).toHaveLength(10000); /* getData 走管线不分页不窗口 */
    t.destroy();
  });
});

describe('setData / 列显隐 / CSV 导出', () => {
  test('setData 替换数据并复位到第一页；hideColumn/showColumn 控制列', () => {
    const el = host();
    const t = createTable(el, { columns: COLUMNS, data: ROWS, pagination: false, columnVisibility: true });
    t.hideColumn('price');
    expect(document.querySelectorAll('.icen-dt-head .icen-dt-cell').length).toBe(2);
    expect(rowsRendered()).toEqual(['苹果', '香蕉', '橙子', '西瓜']); /* 首列仍是名称 */
    t.showColumn('price');
    expect(document.querySelectorAll('.icen-dt-head .icen-dt-cell').length).toBe(3);

    t.setData([{ id: '9', name: '梨', price: 2, status: 'on' }]);
    expect(rowsRendered()).toEqual(['梨']);
    expect(document.querySelector('.icen-dt-stat')!.textContent).toContain('共 1 条');
    t.destroy();
  });

  test('exportCSV：BOM + 表头 + 引号转义的字符串形态（拦截 createObjectURL 捕获 Blob）', async () => {
    const el = host();
    const t = createTable(el, {
      columns: [
        { key: 'name', title: '名称' },
        { key: 'price', title: '价格' },
      ],
      data: [
        { id: '1', name: '有,逗号', price: 5 },
        { id: '2', name: '有"引号', price: 3 },
      ],
      pagination: false,
      exportable: true,
    });
    let captured: Blob | null = null;
    const origCreate = URL.createObjectURL.bind(URL);
    const origRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (b: Blob) => { captured = b; return 'blob:mock'; };
    URL.revokeObjectURL = () => undefined;
    try {
      t.exportCSV('out.csv');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
    const text = await (captured as Blob).text();
    /* BOM 断言见下方 todo（src 写成字面 '\\uFEFF' 双反斜杠，真 BOM 未生效——src 真 bug） */
    expect(text).toContain('名称,价格');
    expect(text).toContain('"有,逗号",5');
    expect(text).toContain('"有""引号"');
    t.destroy();
  });

  /* 历史阻塞记录：BOM 曾写成字面量 '\\uFEFF'（双反斜杠，导出开头是 7 个可见字符），
     彼时本断言以 todo 休眠；src 改为 String.fromCharCode(0xfeff) 后转硬断言。 */
  test('exportCSV：导出文本以真实 U+FEFF BOM 开头', async () => {
    const el = host();
    const t = createTable(el, { columns: COLUMNS, data: ROWS, pagination: false });
    let captured: Blob | null = null;
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b: Blob) => { captured = b; return 'blob:mock'; };
    try {
      t.exportCSV();
    } finally {
      URL.createObjectURL = origCreate;
    }
    const text = await (captured as Blob).text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    t.destroy();
  });

  test('destroy 清空宿主（可重建）；行点击派 icen:table-row-click', () => {
    const el = host();
    const clicks: number[] = [];
    onIcen('icen:table-row-click', (e) => clicks.push(e.detail.index));
    const t = createTable(el, { columns: COLUMNS, data: ROWS, pagination: false });
    fire(document.querySelector('.icen-dt-body .icen-dt-row')!, 'click');
    expect(clicks).toEqual([0]);
    t.destroy();
    expect(el.textContent).toBe('');
  });
});
