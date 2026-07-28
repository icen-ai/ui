/*
 * @icen.ai/ui — Behavior: datatable（数据表格，与 components/datatable.css 配套）
 *
 * 函数式 API（与 charts 同族）：createTable(el, opts) → handle。零依赖，纯 DOM 渲染，
 * 文本一律 textContent（columns.render 返回 Node 时可嵌任意组件 HTML——pill / btn / avatar）。
 * 右键菜单复用 behaviors/context-menu 的 openContextMenu（菜单样式来自 menu.css，
 * kit 入口已自动带上）。SSR 下 createTable 返回 no-op handle。
 *
 * 能力：
 *   - 内置搜索（searchable，160ms 防抖，跨列大小写不敏感）
 *   - 列排序（sortable，点表头 升→降→取消，数字感知；sortFn 可自定义）
 *   - 列筛选（filterable，表头漏斗面板，去重值多选，即时生效）
 *   - 多选（selectable，rowKey 跨页保持，表头三态，onSelectionChange）
 *   - 分页（pagination，页大小切换 + 页码窗口 ±2 + 总数/已选统计）
 *   - 虚拟滚动（virtual: true，固定行高窗口化渲染，万级行流畅；与分页二选一）
 *   - 行展开（expandable，chevron 展开嵌套任意 Node；虚拟模式下不可用）
 *   - 行右键（contextMenu(row) → ContextMenuItem[]，复用 context-menu 浮层）
 *   - 斑马纹（striped）、空态（emptyLabel）、加载骨架（loading）
 *
 *   const table = createTable(el, {
 *     columns: [
 *       { key: 'name', title: '名称', sortable: true },
 *       { key: 'status', title: '状态', filterable: true,
 *         render: (v) => pillNode(String(v)) },   // 返回 Node = 嵌套组件
 *     ],
 *     data: rows, rowKey: 'id',
 *     searchable: true, selectable: true, pagination: true,
 *     contextMenu: (row) => [{ label: '重命名', onClick: () => … }],
 *   });
 *   table.setData(next); table.getSelected(); table.destroy();
 */

import { openContextMenu, type ContextMenuItem } from './context-menu';

export interface TableColumn<Row = Record<string, unknown>> {
  key: string;
  title: string;
  /** CSS 宽度：'72px' / '120px' / '2fr'；缺省 minmax(0,1fr) */
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** 自定义比较（默认：数字感知的 localeCompare） */
  sortFn?: (a: Row, b: Row) => number;
  filterable?: boolean;
  /** 返回 Node 可嵌套任意组件；返回 string/number 走 textContent（安全） */
  render?: (value: unknown, row: Row, rowIndex: number) => Node | string | number | null;
  hidden?: boolean;
}

export interface TableOptions<Row = Record<string, unknown>> {
  columns: TableColumn<Row>[];
  data: Row[];
  /** 行唯一键：字段名或函数（多选/展开跨页保持的依据），缺省用行索引 */
  rowKey?: keyof Row | ((row: Row) => string);
  searchable?: boolean;
  searchPlaceholder?: string;
  selectable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  pageSizes?: number[];
  /** 虚拟滚动（大数据量；与 pagination 互斥，virtual 优先） */
  virtual?: boolean;
  /** 虚拟行高 px（默认 44）与窗口高度（默认 '420px'） */
  rowHeight?: number;
  height?: string;
  /** 行展开内容（虚拟模式下忽略） */
  expandable?: (row: Row) => Node | string;
  /** 行右键菜单（复用 context-menu；需 menu.css，kit 入口已带） */
  contextMenu?: (row: Row) => ContextMenuItem[];
  striped?: boolean;
  emptyLabel?: string;
  loading?: boolean;
  onSelectionChange?: (rows: Row[]) => void;
  onRowClick?: (row: Row) => void;
}

export interface TableHandle<Row = Record<string, unknown>> {
  setData(data: Row[]): void;
  getSelected(): Row[];
  clearSelection(): void;
  setSearch(query: string): void;
  /** values=null 清除该列筛选 */
  setFilter(key: string, values: string[] | null): void;
  setSort(key: string | null, dir?: 'asc' | 'desc'): void;
  /** 数据被外部原地修改后重渲 */
  refresh(): void;
  destroy(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgIcon(d: string, size = 12): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  return svg;
}

const ICON_SEARCH = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3';
const ICON_FUNNEL = 'M22 3H2l8 9.46V19l4 2v-8.54L22 3Z';
const ICON_CHEVRON = 'm6 9 6 6 6-6';

function defaultCompare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN', { numeric: true });
}

/** 无 DOM（SSR）时的 no-op handle */
function noopHandle<Row>(): TableHandle<Row> {
  const noop = (): void => undefined;
  return {
    setData: noop, getSelected: () => [], clearSelection: noop,
    setSearch: noop, setFilter: noop, setSort: noop, refresh: noop, destroy: noop,
  };
}

export function createTable<Row = Record<string, unknown>>(
  el: HTMLElement,
  opts: TableOptions<Row>,
): TableHandle<Row> {
  if (typeof document === 'undefined') return noopHandle<Row>();

  /* ── 状态 ── */
  let data = opts.data;
  let search = '';
  let page = 1;
  let pageSize = opts.pageSize ?? 10;
  let sortKey: string | null = null;
  let sortDir: 'asc' | 'desc' = 'asc';
  let scrollTop = 0;
  const filters = new Map<string, Set<string>>();
  const selected = new Set<string>();
  const expanded = new Set<string>();
  let destroyed = false;

  const virtual = opts.virtual === true;
  const rowH = opts.rowHeight ?? 44;
  const pageSizes = opts.pageSizes ?? [10, 20, 50];
  const selectable = opts.selectable === true;
  const expandable = !virtual ? opts.expandable : undefined;

  const cols = (): TableColumn<Row>[] => opts.columns.filter((c) => !c.hidden);

  const keyOf = (row: Row, index: number): string => {
    if (typeof opts.rowKey === 'function') return opts.rowKey(row);
    if (typeof opts.rowKey === 'string') return String(row[opts.rowKey]);
    return String(index);
  };

  /* 行 key 缓存：以 data 数组索引为基准算一次，筛选/排序后仍稳定（无 rowKey 时的兜底） */
  let keyCache = new WeakMap<object, string>();
  const keyOfRow = (row: Row): string =>
    keyCache.get(row as object) ?? keyOf(row, (data as Row[]).indexOf(row));
  function rekey(): void {
    keyCache = new WeakMap<object, string>();
    data.forEach((r, i) => keyCache.set(r as object, keyOf(r, i)));
  }

  /* ── 数据管线：搜索 → 筛选 → 排序 ── */
  function pipeline(): Row[] {
    let rows = data;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        cols().some((c) => String(row[c.key as keyof Row] ?? '').toLowerCase().includes(q)),
      );
    }
    if (filters.size > 0) {
      rows = rows.filter((row) => {
        for (const [key, allowed] of filters) {
          if (!allowed.has(String(row[key as keyof Row] ?? ''))) return false;
        }
        return true;
      });
    }
    if (sortKey) {
      const col = opts.columns.find((c) => c.key === sortKey);
      const cmp = col?.sortFn
        ? (a: Row, b: Row) => col.sortFn!(a, b)
        : (a: Row, b: Row) => defaultCompare(a[sortKey as keyof Row], b[sortKey as keyof Row]);
      rows = [...rows].sort((a, b) => (sortDir === 'asc' ? cmp(a, b) : -cmp(a, b)));
    }
    return rows;
  }

  /* ── DOM 骨架 ── */
  el.textContent = '';
  const root = document.createElement('div');
  root.className = 'datatable';
  if (opts.striped) root.classList.add('datatable--striped');
  if (virtual) root.classList.add('datatable--virtual');

  /* 工具栏（搜索） */
  let searchInput: HTMLInputElement | null = null;
  if (opts.searchable) {
    const bar = document.createElement('div');
    bar.className = 'dt-toolbar';
    const box = document.createElement('div');
    box.className = 'dt-search';
    box.appendChild(svgIcon(ICON_SEARCH, 14));
    searchInput = document.createElement('input');
    searchInput.className = 'dt-search-input';
    searchInput.type = 'search';
    searchInput.placeholder = opts.searchPlaceholder ?? '搜索…';
    searchInput.setAttribute('aria-label', '搜索表格');
    box.appendChild(searchInput);
    bar.appendChild(box);
    root.appendChild(bar);
  }

  /* 表头 + 表体滚动容器 */
  const scroll = document.createElement('div');
  scroll.className = 'dt-scroll';
  if (virtual) scroll.style.maxHeight = opts.height ?? '420px';

  const canvas = document.createElement('div');
  canvas.className = 'dt-canvas';
  canvas.setAttribute('role', 'grid');

  const head = document.createElement('div');
  head.className = 'dt-head';
  head.setAttribute('role', 'rowgroup');
  const headRow = document.createElement('div');
  headRow.className = 'dt-row dt-row--head';
  headRow.setAttribute('role', 'row');
  head.appendChild(headRow);

  const body = document.createElement('div');
  body.className = 'dt-body';
  body.setAttribute('role', 'rowgroup');

  canvas.append(head, body);
  scroll.appendChild(canvas);
  root.appendChild(scroll);

  /* 底部（分页 / 统计） */
  const foot = document.createElement('div');
  foot.className = 'dt-foot';
  root.appendChild(foot);
  el.appendChild(root);

  /* ── 列模板 ── */
  function template(): string {
    const parts: string[] = [];
    if (selectable) parts.push('40px');
    if (expandable) parts.push('34px');
    for (const c of cols()) parts.push(c.width ?? 'minmax(0,1fr)');
    return parts.join(' ');
  }

  /* ── 单元格内容 ── */
  function fillCell(cell: HTMLElement, col: TableColumn<Row>, row: Row, rowIndex: number): void {
    const value = row[col.key as keyof Row];
    if (col.render) {
      const out = col.render(value, row, rowIndex);
      if (out instanceof Node) cell.appendChild(out);
      else if (out !== null && out !== undefined) cell.textContent = String(out);
    } else {
      cell.textContent = String(value ?? '');
    }
  }

  function makeCheck(checked: boolean, label: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'dt-check';
    input.checked = checked;
    input.setAttribute('aria-label', label);
    return input;
  }

  /* ── 表头渲染（排序/筛选状态跟随） ── */
  /* 筛选面板 portal 到 body（.dt-scroll 有 overflow，绝对定位会被裁切） */
  let openPanel: { key: string; el: HTMLElement } | null = null;

  function onPanelScroll(ev: Event): void {
    if (openPanel && ev.target instanceof Node && openPanel.el.contains(ev.target)) return;
    closeFilterPanel();
  }

  function closeFilterPanel(): void {
    if (!openPanel) return;
    openPanel.el.remove();
    openPanel = null;
    headRow.querySelectorAll('.dt-filter-btn').forEach((b) => b.classList.remove('is-open'));
    window.removeEventListener('scroll', onPanelScroll, true);
    window.removeEventListener('resize', onPanelScroll);
  }

  function openFilterPanel(col: TableColumn<Row>, btn: HTMLElement): void {
    const panel = buildFilterPanel(col);
    document.body.appendChild(panel);
    openPanel = { key: col.key, el: panel };
    btn.classList.add('is-open');

    const rect = btn.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    let x = rect.right - pr.width;
    let y = rect.bottom + 4;
    if (x < 8) x = 8;
    if (y + pr.height > window.innerHeight - 8) y = rect.top - pr.height - 4;
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.hidden = false;

    window.addEventListener('scroll', onPanelScroll, true);
    window.addEventListener('resize', onPanelScroll);
  }

  function renderHead(): void {
    closeFilterPanel();
    headRow.textContent = '';
    headRow.style.gridTemplateColumns = template();

    if (selectable) {
      const cell = document.createElement('div');
      cell.className = 'dt-cell dt-cell--check';
      const rows = pipeline();
      const allKeys = rows.map((r) => keyOfRow(r));
      const selCount = allKeys.filter((k) => selected.has(k)).length;
      const box = makeCheck(selCount > 0 && selCount === allKeys.length, '全选');
      box.indeterminate = selCount > 0 && selCount < allKeys.length;
      box.addEventListener('change', () => {
        if (box.checked) allKeys.forEach((k) => selected.add(k));
        else allKeys.forEach((k) => selected.delete(k));
        emitSelection();
        renderBody();
        renderHead();
      });
      cell.appendChild(box);
      headRow.appendChild(cell);
    }
    if (expandable) {
      const cell = document.createElement('div');
      cell.className = 'dt-cell dt-cell--expand';
      headRow.appendChild(cell);
    }

    for (const col of cols()) {
      const cell = document.createElement('div');
      cell.className = 'dt-cell dt-cell--head';
      if (col.align) cell.dataset.align = col.align;

      const title = document.createElement('span');
      title.className = 'dt-head-title';
      title.textContent = col.title;
      cell.appendChild(title);

      if (col.sortable) {
        cell.classList.add('is-sortable');
        cell.setAttribute('role', 'columnheader');
        cell.tabIndex = 0;
        const active = sortKey === col.key;
        cell.setAttribute('aria-sort', active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
        const arrow = document.createElement('span');
        arrow.className = 'dt-sort';
        arrow.textContent = active ? (sortDir === 'asc' ? '↑' : '↓') : '↕';
        if (active) arrow.classList.add('is-active');
        cell.appendChild(arrow);
        const toggleSort = (): void => {
          if (sortKey !== col.key) { sortKey = col.key; sortDir = 'asc'; }
          else if (sortDir === 'asc') sortDir = 'desc';
          else sortKey = null;
          renderAll();
        };
        cell.addEventListener('click', (ev) => {
          if ((ev.target as Element).closest('.dt-filter-btn')) return;
          toggleSort();
        });
        cell.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleSort(); }
        });
      }

      if (col.filterable) {
        const hasFilter = filters.has(col.key);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dt-filter-btn';
        if (hasFilter) btn.classList.add('is-active');
        btn.setAttribute('aria-label', `筛选「${col.title}」`);
        btn.appendChild(svgIcon(ICON_FUNNEL, 12));
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (openPanel?.key === col.key) closeFilterPanel();
          else {
            closeFilterPanel();
            openFilterPanel(col, btn);
          }
        });
        cell.appendChild(btn);
      }

      headRow.appendChild(cell);
    }
  }

  /* ── 筛选面板（去重值多选，即时生效） ── */
  function buildFilterPanel(col: TableColumn<Row>): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'dt-filter-panel';
    panel.hidden = true;
    panel.addEventListener('click', (ev) => ev.stopPropagation());

    const list = document.createElement('div');
    list.className = 'dt-filter-list';

    const values = Array.from(new Set(data.map((r) => String(r[col.key as keyof Row] ?? ''))))
      .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));

    for (const v of values) {
      const row = document.createElement('label');
      row.className = 'dt-filter-item';
      const box = makeCheck(filters.get(col.key)?.has(v) ?? true, v);
      box.addEventListener('change', () => {
        const cur = new Set(filters.get(col.key) ?? values);
        if (box.checked) cur.add(v);
        else cur.delete(v);
        if (cur.size === values.length) filters.delete(col.key);
        else filters.set(col.key, cur);
        page = 1;
        renderAll();
      });
      const text = document.createElement('span');
      text.textContent = v === '' ? '（空）' : v;
      row.append(box, text);
      list.appendChild(row);
    }

    const footRow = document.createElement('div');
    footRow.className = 'dt-filter-foot';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'dt-filter-reset';
    reset.textContent = '重置';
    reset.addEventListener('click', () => {
      filters.delete(col.key);
      page = 1;
      closeFilterPanel();
      renderAll();
    });
    footRow.appendChild(reset);
    panel.append(list, footRow);
    return panel;
  }

  /* ── 行渲染 ── */
  function makeRow(row: Row, rowIndex: number, key: string): HTMLElement {
    const tr = document.createElement('div');
    tr.className = 'dt-row';
    tr.setAttribute('role', 'row');
    tr.style.gridTemplateColumns = template();
    if (virtual) tr.style.height = `${rowH}px`;
    if (selected.has(key)) tr.classList.add('is-selected');

    if (selectable) {
      const cell = document.createElement('div');
      cell.className = 'dt-cell dt-cell--check';
      const box = makeCheck(selected.has(key), '选择该行');
      box.addEventListener('click', (ev) => ev.stopPropagation());
      box.addEventListener('change', () => {
        if (box.checked) selected.add(key);
        else selected.delete(key);
        tr.classList.toggle('is-selected', box.checked);
        emitSelection();
        renderHead();
        renderFoot(pipeline().length);
      });
      cell.appendChild(box);
      tr.appendChild(cell);
    }
    if (expandable) {
      const cell = document.createElement('div');
      cell.className = 'dt-cell dt-cell--expand';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dt-expand-btn';
      btn.setAttribute('aria-label', '展开行');
      btn.setAttribute('aria-expanded', String(expanded.has(key)));
      btn.appendChild(svgIcon(ICON_CHEVRON, 14));
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (expanded.has(key)) expanded.delete(key);
        else expanded.add(key);
        renderBody();
      });
      cell.appendChild(btn);
      tr.appendChild(cell);
    }

    for (const col of cols()) {
      const cell = document.createElement('div');
      cell.className = 'dt-cell';
      if (col.align) cell.dataset.align = col.align;
      fillCell(cell, col, row, rowIndex);
      tr.appendChild(cell);
    }

    if (opts.onRowClick) {
      tr.classList.add('is-clickable');
      tr.addEventListener('click', () => opts.onRowClick!(row));
    }
    if (opts.contextMenu) {
      tr.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openContextMenu(ev.clientX, ev.clientY, opts.contextMenu!(row));
      });
    }
    return tr;
  }

  function makeExpandRow(row: Row): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'dt-expand-row';
    const out = expandable!(row);
    if (out instanceof Node) wrap.appendChild(out);
    else wrap.textContent = String(out);
    return wrap;
  }

  /* ── 表体渲染（分页切片 / 虚拟窗口） ── */
  function visibleRange(total: number): [number, number] {
    if (!virtual) {
      if (opts.pagination === false) return [0, total];
      const start = (page - 1) * pageSize;
      return [start, Math.min(total, start + pageSize)];
    }
    const viewH = scroll.clientHeight || 420;
    const overscan = 6;
    const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
    const end = Math.min(total, Math.ceil((scrollTop + viewH) / rowH) + overscan);
    return [start, end];
  }

  function renderBody(): void {
    const rows = pipeline();
    const total = rows.length;
    /* 虚拟模式：清空 body 会塌掉 scrollHeight 导致 scrollTop 被浏览器夹回 0，
       先记下滚动位置，重渲后恢复（恢复为同值不会再触发 scroll） */
    const keepTop = virtual ? scroll.scrollTop : 0;
    body.textContent = '';

    if (opts.loading) {
      for (let i = 0; i < Math.min(pageSize, 8); i++) {
        const sk = document.createElement('div');
        sk.className = 'dt-skeleton-row';
        const bar = document.createElement('div');
        bar.className = 'skeleton';
        bar.style.height = '14px';
        bar.style.width = `${88 - (i % 3) * 14}%`;
        sk.appendChild(bar);
        body.appendChild(sk);
      }
      renderFoot(total);
      return;
    }

    if (total === 0) {
      const empty = document.createElement('div');
      empty.className = 'dt-empty';
      empty.textContent = opts.emptyLabel ?? '暂无数据';
      body.appendChild(empty);
      renderFoot(total);
      return;
    }

    const [start, end] = visibleRange(total);
    const frag = document.createDocumentFragment();
    if (virtual && start > 0) {
      const top = document.createElement('div');
      top.style.height = `${start * rowH}px`;
      frag.appendChild(top);
    }
    for (let i = start; i < end; i++) {
      const row = rows[i]!;
      const key = keyOfRow(row);
      frag.appendChild(makeRow(row, i, key));
      if (expandable && expanded.has(key)) frag.appendChild(makeExpandRow(row));
    }
    if (virtual && end < total) {
      const bottom = document.createElement('div');
      bottom.style.height = `${(total - end) * rowH}px`;
      frag.appendChild(bottom);
    }
    body.appendChild(frag);
    if (virtual) scroll.scrollTop = keepTop;
    renderFoot(total);
  }

  /* ── 底部（统计 + 分页） ── */
  function renderFoot(total: number): void {
    foot.textContent = '';

    const stat = document.createElement('span');
    stat.className = 'dt-stat';
    stat.textContent = `共 ${total} 条`;
    foot.appendChild(stat);

    if (selectable && selected.size > 0) {
      const sel = document.createElement('span');
      sel.className = 'dt-stat dt-stat--sel';
      sel.textContent = `已选 ${selected.size} 项`;
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'dt-clear-sel';
      clear.textContent = '清空';
      clear.addEventListener('click', () => {
        selected.clear();
        emitSelection();
        renderAll();
      });
      sel.appendChild(clear);
      foot.appendChild(sel);
    }

    if (virtual || opts.pagination === false || total <= pageSize) return;

    const pages = Math.ceil(total / pageSize);
    const pager = document.createElement('nav');
    pager.className = 'dt-pager';
    pager.setAttribute('aria-label', '分页');

    const sizeSel = document.createElement('select');
    sizeSel.className = 'dt-page-size';
    sizeSel.setAttribute('aria-label', '每页条数');
    for (const s of pageSizes) {
      const o = document.createElement('option');
      o.value = String(s);
      o.textContent = `${s} 条/页`;
      if (s === pageSize) o.selected = true;
      sizeSel.appendChild(o);
    }
    sizeSel.addEventListener('change', () => {
      pageSize = Number(sizeSel.value);
      page = 1;
      renderAll();
    });
    pager.appendChild(sizeSel);

    const pageBtn = (label: string, target: number, opts2: { disabled?: boolean; active?: boolean; aria?: string } = {}): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dt-page-btn';
      if (opts2.active) b.classList.add('is-active');
      b.disabled = opts2.disabled === true;
      b.textContent = label;
      if (opts2.aria) b.setAttribute('aria-label', opts2.aria);
      b.addEventListener('click', () => { page = target; renderAll(); });
      return b;
    };

    pager.appendChild(pageBtn('‹', page - 1, { disabled: page <= 1, aria: '上一页' }));
    const win: number[] = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 2) win.push(p);
    }
    let last = 0;
    for (const p of win) {
      if (p - last > 1) {
        const dots = document.createElement('span');
        dots.className = 'dt-page-dots';
        dots.textContent = '…';
        pager.appendChild(dots);
      }
      pager.appendChild(pageBtn(String(p), p, { active: p === page }));
      last = p;
    }
    pager.appendChild(pageBtn('›', page + 1, { disabled: page >= pages, aria: '下一页' }));

    foot.appendChild(pager);
  }

  /* ── 事件与生命周期 ── */
  let searchTimer = 0;
  function onSearch(): void {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      search = searchInput?.value.trim() ?? '';
      page = 1;
      renderAll();
    }, 160);
  }
  searchInput?.addEventListener('input', onSearch);

  function onScroll(): void {
    scrollTop = scroll.scrollTop;
    renderBody();
  }
  if (virtual) scroll.addEventListener('scroll', onScroll, { passive: true });

  function onDocPointerDown(ev: Event): void {
    if (!openPanel) return;
    const t = ev.target;
    if (t instanceof Node && (openPanel.el.contains(t) || headRow.contains(t))) return;
    closeFilterPanel();
  }
  document.addEventListener('pointerdown', onDocPointerDown, true);

  function onDocKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') closeFilterPanel();
  }
  document.addEventListener('keydown', onDocKeydown);

  function emitSelection(): void {
    if (!opts.onSelectionChange) return;
    const rows = data.filter((r) => selected.has(keyOfRow(r)));
    opts.onSelectionChange(rows);
  }

  function renderAll(): void {
    if (destroyed) return;
    renderHead();
    renderBody();
  }

  rekey();
  renderAll();

  return {
    setData(next) { data = next; rekey(); page = 1; renderAll(); },
    getSelected() { return data.filter((r) => selected.has(keyOfRow(r))); },
    clearSelection() { selected.clear(); emitSelection(); renderAll(); },
    setSearch(q) { search = q; if (searchInput) searchInput.value = q; page = 1; renderAll(); },
    setFilter(key, values) {
      if (values === null) filters.delete(key);
      else filters.set(key, new Set(values));
      page = 1;
      renderAll();
    },
    setSort(key, dir = 'asc') { sortKey = key; sortDir = dir; renderAll(); },
    refresh() { renderAll(); },
    destroy() {
      destroyed = true;
      window.clearTimeout(searchTimer);
      closeFilterPanel();
      searchInput?.removeEventListener('input', onSearch);
      if (virtual) scroll.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onDocKeydown);
      el.textContent = '';
    },
  };
}
