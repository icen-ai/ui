import { createIcon } from './icons';
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
 *   - 多列排序（multiSort：Shift+点击追加次级排序，徽标显示优先级；getSorts/setSorts）
 *   - 列重排（reorderable：表头拖拽换位，影子 + 插入指示线；冻结/非冻结分区互不跨越；
 *     完成派 icen:table-column-reorder；moveColumn(key, toIndex)）
 *   - 列筛选（filterable，表头漏斗面板，去重值多选，即时生效）
 *   - 多选（selectable，rowKey 跨页保持，表头三态，Shift+点击范围选，onSelectionChange）
 *   - 分页（pagination 默认开启、10 条/页；pagination: false 关闭——页大小切换 + 页码窗口 ±2 + 总数/已选统计）
 *   - 虚拟滚动（virtual: true，固定行高窗口化渲染，万级行流畅；与分页二选一）
 *   - 行分组 + 聚合（groupBy 字段/函数；column.aggregate 组头摘要 chip；点击折叠派
 *     icen:table-group-toggle，状态跨 setData 保持；管线末拍平 flatRows，虚拟滚动兼容）
 *   - 行展开（expandable，chevron 展开嵌套任意 Node；虚拟模式下不可用）
 *   - 单元格编辑（column.editable: text/number/select；双击或 Enter 进入，Enter/失焦提交、Esc 取消；
 *     提交派 icen:table-cell-edit + onCellEdit，宿主调 updateCell/setData 采纳；number 非法值抖动不提交）
 *   - 汇总行（summaryRow：表尾 sticky 一行，按当前管线（搜索/筛选后）数据聚合；'label' 列显示「合计」）
 *   - 键盘导航 + 复制（tbody roving tabindex：方向键/Home/End/PageUp/Down；Enter 进编辑；
 *     Ctrl/Cmd+C 复制当前格或选中行集（TSV，clipboard + execCommand 回退））
 *   - 行右键（contextMenu(row) → ContextMenuItem[]，复用 context-menu 浮层）
 *   - 列宽拖拽（resizable，拖表头边界改列宽；结束派 icen:table-column-resize，过程不派）
 *   - 列显隐（columnVisibility，工具栏齿轮开关）
 *   - 冻结列（column.frozen：true/'left' 左固定 | 'right' 右固定，sticky 偏移按列宽累计测量）
 *   - CSV 导出（exportable，工具栏按钮，导出当前管线数据）
 *   - 行自定义 class（rowClassName，条件着色）
 *   - 管线缓存（pipeline memoization：缓存键含 search/filters/sorts/group 状态，同帧多次读不重算）
 *   - 斑马纹（striped）、空态（emptyLabel）、加载骨架（loading）
 *   - 紧凑密度（density: 'compact'，32px 行高）
 *
 *   const table = createTable(el, {
 *     columns: [
 *       { key: 'name', title: '名称', sortable: true },
 *       { key: 'status', title: '状态', filterable: true,
 *         render: (v) => pillNode(String(v)) },   // 返回 Node = 嵌套组件
 *       { key: 'amount', title: '金额', sortable: true, editable: 'number', aggregate: 'sum' },
 *     ],
 *     data: rows, rowKey: 'id',
 *     searchable: true, selectable: true,   // pagination 默认开启（10 条/页），false 关闭
 *     multiSort: true, reorderable: true,
 *     groupBy: 'dept', summaryRow: { name: 'label', amount: 'sum' },
 *     contextMenu: (row) => [{ label: '重命名', onClick: () => … }],
 *   });
 *   table.setData(next); table.getSelected(); table.destroy();
 */

import { openContextMenu, type ContextMenuItem } from './context-menu';
import { emitIcen } from './events';
import { applyPanelSizing, computePopoverLayout, readPanelSizing, resolvePanelSizing } from './popover';
import { t } from './i18n';

export type TableFrozenSide = 'left' | 'right';

/** 行分组聚合器：内置五种 + 自定义函数（收数字数组，返回展示串） */
export type TableAggregate = 'sum' | 'avg' | 'count' | 'min' | 'max' | ((values: number[]) => string);

/** 单元格编辑类型：true = 'text' */
export type TableCellEditable = boolean | 'text' | 'number' | 'select';

/** select 编辑器选项（纯字符串或 value/label 对） */
export type TableEditOption = string | { value: string; label: string };

/** 排序栈条目（sorts[0] = 主排序） */
export interface TableSortEntry {
  key: string;
  dir: 'asc' | 'desc';
}

/** 汇总行逐列规格；'label' = 显示「合计」 */
export type TableSummarySpec = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'label';

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
  /** 冻结列：true/'left' 左固定（默认），'right' 右固定（横向滚动不跟随） */
  frozen?: boolean | TableFrozenSide;
  /** 行分组聚合器（groupBy 开启时组头摘要 chip；summaryRow: true 时同名复用） */
  aggregate?: TableAggregate;
  /** 单元格编辑：true/'text' 文本；'number' 数字（非法值抖动不提交）；'select' 需 editOptions */
  editable?: TableCellEditable;
  /** select 编辑器选项 */
  editOptions?: TableEditOption[];
}

export interface TableOptions<Row = Record<string, unknown>> {
  columns: TableColumn<Row>[];
  data: Row[];
  /** 行唯一键：字段名或函数（多选/展开跨页保持的依据），缺省用行索引 */
  rowKey?: keyof Row | ((row: Row) => string);
  searchable?: boolean;
  searchPlaceholder?: string;
  selectable?: boolean;
  /** 分页（默认开启，pageSize 默认 10 条/页；传 false 关闭；virtual 时忽略） */
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
  /** 密度：normal 默认 44px 行高 / compact 紧凑 32px */
  density?: 'normal' | 'compact';
  /** 列宽可拖拽调整（默认 true） */
  resizable?: boolean;
  /** 工具栏列显隐开关（默认 false） */
  columnVisibility?: boolean;
  /** 导出 CSV 按钮显示在工具栏（默认 false） */
  exportable?: boolean;
  /** 多列排序：Shift+点击表头追加次级排序，徽标显示优先级（单点击行为与单排序完全一致） */
  multiSort?: boolean;
  /** 表头拖拽列重排（冻结/非冻结分区互不跨越；完成派 icen:table-column-reorder） */
  reorderable?: boolean;
  /** 行分组：字段名或函数 → 组头行（组名 + 计数 + 聚合 chip，点击折叠，状态跨 setData 保持） */
  groupBy?: keyof Row | ((row: Row) => string);
  /** 汇总行：true 按各列 aggregate 汇总；或逐列规格（'label' 列显示「合计」）。
   *  数据口径 = 当前管线（搜索/筛选后、分页前）。 */
  summaryRow?: boolean | Record<string, TableSummarySpec>;
  /** 行自定义 class（条件着色 / 状态行） */
  rowClassName?: (row: Row, index: number) => string;
  onSelectionChange?: (rows: Row[]) => void;
  onRowClick?: (row: Row) => void;
  onSortChange?: (key: string | null, dir: 'asc' | 'desc') => void;
  /** 单元格编辑提交（与 icen:table-cell-edit 双通道；宿主决定是否采纳：调 handle.updateCell 或 setData） */
  onCellEdit?: (rowKey: string, field: string, value: unknown, row: Row) => void;
  /** 搜索谓词（默认跨列 String includes；自定义拼音/高亮/索引匹配） */
  searchFn?: (query: string, row: Row) => boolean;
  /** 服务端/受控分页：开启后翻页只派事件与回调，不再本地切片（配 totalCount + setData/setPage 喂数） */
  remote?: boolean;
  /** remote 模式总条数（缺省 data.length） */
  totalCount?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export interface TableHandle<Row = Record<string, unknown>> {
  setData(data: Row[]): void;
  getSelected(): Row[];
  clearSelection(): void;
  setSearch(query: string): void;
  /** values=null 清除该列筛选 */
  setFilter(key: string, values: string[] | null): void;
  setSort(key: string | null, dir?: 'asc' | 'desc'): void;
  /** 当前排序栈（[0] = 主排序）；返回副本，改之不影响内部状态 */
  getSorts(): TableSortEntry[];
  /** 整体替换排序栈（与 setSort 同纪律：不派 icen:table-sort-change，只回调 onSortChange） */
  setSorts(sorts: TableSortEntry[]): void;
  /** 列重排：把 key 移到当前可见列序的 toIndex（冻结分区约束内自动夹取；派 icen:table-column-reorder） */
  moveColumn(key: string, toIndex: number): void;
  /** 采纳编辑值：按行键写回 data 并重渲（宿主在 onCellEdit / icen:table-cell-edit 里调用） */
  updateCell(rowKey: string, field: string, value: unknown): void;
  /** 获取当前管线（搜索→筛选→排序）后的数据 */
  getData(): Row[];
  /** 导出当前管线数据为 CSV 并触发下载 */
  exportCSV(filename?: string): void;
  /** 显示/隐藏列 */
  showColumn(key: string): void;
  /** 外部驱动页码（remote 模式与服务端同步） */
  setPage(page: number): void;
  setPageSize(size: number): void;
  hideColumn(key: string): void;
  /** 数据被外部原地修改后重渲 */
  refresh(): void;
  destroy(): void;
}


function defaultCompare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    /* NaN 参与时 a-b 为 NaN，sort 视作 0 → 列「排了但没排」；统一把 NaN 排在有限数之后 */
    if (Number.isNaN(a) || Number.isNaN(b)) {
      if (Number.isNaN(a) && Number.isNaN(b)) return 0;
      return Number.isNaN(a) ? 1 : -1;
    }
    return a - b;
  }
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN', { numeric: true });
}

/* ═══ 聚合纯函数（模块级，可单测）：分组头摘要 / 汇总行共用同一口径 ═══ */

/** 数字值抽取：数字直取；非空字符串尝试 Number；其余（null/undefined/''/NaN）返回 null（不进聚合） */
function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** 聚合数格式化：整数原样，小数四舍五入到 2 位（去尾零），非有限值「—」不猜 */
function formatAggNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 100) / 100;
  return String(r);
}

/**
 * 计算各聚合列的展示值（纯函数）。
 * - sum/avg/min/max：只统计可转数字的值（字符串数字计入；空/非数字跳过），无有效值 → '—'
 * - count：非空值计数（null/undefined/'' 跳过），与类型无关
 * - 自定义函数：收数字数组（同一口径过滤后），返回串由宿主决定
 */
export function computeAggregates<Row = Record<string, unknown>>(
  rows: Row[],
  columns: Array<TableColumn<Row>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns) {
    const agg = col.aggregate;
    if (!agg) continue;
    if (typeof agg === 'function') {
      const vals: number[] = [];
      for (const row of rows) {
        const n = toNum(row[col.key as keyof Row]);
        if (n != null) vals.push(n);
      }
      out[col.key] = agg(vals);
      continue;
    }
    if (agg === 'count') {
      let c = 0;
      for (const row of rows) {
        const v = row[col.key as keyof Row];
        if (v !== null && v !== undefined && v !== '') c++;
      }
      out[col.key] = String(c);
      continue;
    }
    let acc = 0;
    let cnt = 0;
    let extreme = 0;
    for (const row of rows) {
      const n = toNum(row[col.key as keyof Row]);
      if (n == null) continue;
      if (cnt === 0) extreme = n;
      else if (agg === 'min') extreme = Math.min(extreme, n);
      else if (agg === 'max') extreme = Math.max(extreme, n);
      acc += n;
      cnt++;
    }
    if (cnt === 0) {
      out[col.key] = '—';
    } else if (agg === 'sum') {
      out[col.key] = formatAggNumber(acc);
    } else if (agg === 'avg') {
      out[col.key] = formatAggNumber(acc / cnt);
    } else {
      out[col.key] = formatAggNumber(extreme);
    }
  }
  return out;
}

/** 无 DOM（SSR）时的 no-op handle */
function noopHandle<Row>(): TableHandle<Row> {
  const noop = (): void => undefined;
  return {
    setData: noop, getSelected: () => [], clearSelection: noop,
    setSearch: noop, setFilter: noop, setSort: noop, refresh: noop, destroy: noop,
    getSorts: () => [], setSorts: noop, moveColumn: noop, updateCell: noop,
    getData: () => [], exportCSV: noop, showColumn: noop, hideColumn: noop,
    setPage: noop, setPageSize: noop,
  };
}

export function createTable<Row = Record<string, unknown>>(
  el: HTMLElement,
  opts: TableOptions<Row>,
): TableHandle<Row> {
  if (typeof document === 'undefined') return noopHandle<Row>();

  /* ═══ 状态 ═══ */
  let data = opts.data;
  let search = '';
  let page = 1;
  let pageSize = opts.pageSize ?? 10;
  /** 排序栈：[0] = 主排序（单排序 = 长度为 1 的退化形态） */
  let sorts: TableSortEntry[] = [];
  let scrollTop = 0;
  const filters = new Map<string, Set<string>>();
  const selected = new Set<string>();
  const expanded = new Set<string>();
  /** 列宽覆盖（拖拽 resize 后写入）：key → CSS 宽度 */
  const colWidths = new Map<string, string>();
  /** 列动态 hidden（工具栏开关写入） */
  const colHidden = new Map<string, boolean>();
  /** 列重排顺序（全部列 key 的排列；null = 未重排过，跟随 opts.columns 声明序） */
  let colOrder: string[] | null = null;
  /** 分组折叠状态：组 key → collapsed（Map by key，跨 setData 保持） */
  const groupState = new Map<string, boolean>();
  /** 当前编辑会话（单元格编辑） */
  let editing: EditSession | null = null;
  /** 列重排拖拽会话 */
  let drag: DragSession | null = null;
  /** 拖拽刚结束的时间戳：抑制尾随 click 触发排序 */
  let lastDragEndAt = 0;
  /** 当前渲染的导航总行数（flatRows 长度或数据行数；键盘导航/PageUp/Down 用） */
  let navTotal = 0;
  /** roving tabindex 焦点位（行 key + 列 key），重渲后恢复 */
  let focusPos: { key: string; col: string } | null = null;
  /** 上次点击的行索引（Shift+点击范围选起点） */
  let lastClickedIndex = -1;
  let destroyed = false;

  const virtual = opts.virtual === true;
  const compact = opts.density === 'compact';
  const rowH = opts.rowHeight ?? (compact ? 32 : 44);
  const pageSizes = opts.pageSizes ?? [10, 20, 50];
  const selectable = opts.selectable === true;
  const expandable = !virtual ? opts.expandable : undefined;
  const resizable = opts.resizable !== false; // 默认开启
  const multiSort = opts.multiSort === true;
  const reorderable = opts.reorderable === true;

  /** 分组函数（字段名或宿主函数；null = 不分组） */
  const groupFn: ((row: Row) => string) | null = opts.groupBy
    ? typeof opts.groupBy === 'function'
      ? opts.groupBy
      : (row: Row) => String(row[opts.groupBy as keyof Row] ?? '')
    : null;

  const frozenSide = (c: TableColumn<Row>): TableFrozenSide | null =>
    c.frozen === true ? 'left' : c.frozen === 'left' || c.frozen === 'right' ? c.frozen : null;

  const isEditable = (c: TableColumn<Row>): boolean => c.editable === true || typeof c.editable === 'string';
  const editKind = (c: TableColumn<Row>): 'text' | 'number' | 'select' =>
    c.editable === 'number' || c.editable === 'select' ? c.editable : 'text';

  /** 当前列序（colOrder 含全部列；此处滤 hidden——静态 hidden 与动态 colHidden 合并） */
  function cols(): TableColumn<Row>[] {
    const order = colOrder ?? opts.columns.map((c) => c.key);
    const byKey = new Map(opts.columns.map((c) => [c.key, c]));
    const out: TableColumn<Row>[] = [];
    for (const k of order) {
      const c = byKey.get(k);
      if (c && !(c.hidden || colHidden.get(k))) out.push(c);
    }
    return out;
  }

  const colByKey = (key: string): TableColumn<Row> | undefined => opts.columns.find((c) => c.key === key);

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

  /* ═══ 数据管线：搜索 → 筛选 → 排序（记忆化：缓存键含 search/filters/sorts 状态，
         任一变化走 invalidate() 清空，同帧多次读不重算）═══ */
  let pipelineCache: Row[] | null = null;
  function invalidate(): void {
    pipelineCache = null;
    flatCache = null;
  }
  function pipeline(): Row[] {
    if (pipelineCache) return pipelineCache;
    let rows = data;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        opts.searchFn
          ? opts.searchFn(search, row)
          : cols().some((c) => String(row[c.key as keyof Row] ?? '').toLowerCase().includes(q)),
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
    if (sorts.length > 0) {
      /* 多列排序：单趟比较按排序栈优先级短路（sorts[0] 主排序优先），稳定排序保留原序 */
      rows = [...rows].sort((a, b) => {
        for (const s of sorts) {
          const col = colByKey(s.key);
          const cmp = col?.sortFn
            ? col.sortFn(a, b)
            : defaultCompare(a[s.key as keyof Row], b[s.key as keyof Row]);
          if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }
    pipelineCache = rows;
    return rows;
  }

  /* ═══ 行分组：管线末一步把（组头 + 行）拍平成 flatRows——虚拟滚动/分页/键盘导航
         全部只在 flatRows 上做（组头行高同 data 行）。缓存键 = 管线数组引用 +
         groupState（折叠变化走 invalidate 清空）。═══ */
  type FlatEntry =
    | { kind: 'group'; gkey: string; label: string; count: number; aggs: Record<string, string>; collapsed: boolean }
    | { kind: 'data'; row: Row; pipeIndex: number };

  let flatCache: { base: Row[]; entries: FlatEntry[] } | null = null;
  function flatEntries(): FlatEntry[] {
    const rows = pipeline();
    if (flatCache && flatCache.base === rows) return flatCache.entries;
    const entries: FlatEntry[] = [];
    if (groupFn) {
      /* 组顺序 = 排序后首现行顺序（与 AG Grid 一致，不额外按组名排序） */
      const groups: Array<{ label: string; items: Array<{ row: Row; i: number }> }> = [];
      const byKey = new Map<string, { label: string; items: Array<{ row: Row; i: number }> }>();
      rows.forEach((row, i) => {
        const label = groupFn(row);
        let g = byKey.get(label);
        if (!g) {
          g = { label, items: [] };
          byKey.set(label, g);
          groups.push(g);
        }
        g.items.push({ row, i });
      });
      for (const g of groups) {
        const collapsed = groupState.get(g.label) === true;
        const gRows = g.items.map((it) => it.row);
        entries.push({
          kind: 'group',
          gkey: g.label,
          label: g.label,
          count: g.items.length,
          aggs: computeAggregates(gRows, opts.columns),
          collapsed,
        });
        if (!collapsed) {
          for (const it of g.items) entries.push({ kind: 'data', row: it.row, pipeIndex: it.i });
        }
      }
    } else {
      rows.forEach((row, i) => entries.push({ kind: 'data', row, pipeIndex: i }));
    }
    flatCache = { base: rows, entries };
    return entries;
  }

  /* ═══ DOM 骨架 ═══ */
  el.textContent = '';
  const root = document.createElement('div');
  root.className = 'icen-datatable';
  if (opts.striped) root.classList.add('icen-datatable--striped');
  if (virtual) root.classList.add('icen-datatable--virtual');
  if (compact) root.classList.add('icen-datatable--compact');
  if (opts.columns.some((c) => c.frozen)) root.classList.add('icen-datatable--frozen');
  if (reorderable) root.classList.add('icen-datatable--reorderable');

  /* 工具栏（搜索 + 列开关 + 导出） */
  let searchInput: HTMLInputElement | null = null;
  const needsToolbar = opts.searchable || opts.columnVisibility || opts.exportable;
  let toolbar: HTMLElement | null = null;
  if (needsToolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'icen-dt-toolbar';
    if (opts.searchable) {
      const box = document.createElement('div');
      box.className = 'icen-dt-search';
      box.appendChild(createIcon('search', { size: 14 })!);
      searchInput = document.createElement('input');
      searchInput.className = 'icen-dt-search-input';
      searchInput.type = 'search';
      searchInput.placeholder = opts.searchPlaceholder ?? t('datatable.searchPlaceholder');
      searchInput.setAttribute('aria-label', t('datatable.searchAria'));
      box.appendChild(searchInput);
      toolbar.appendChild(box);
    }
    // 右侧操作按钮组
    const actions = document.createElement('div');
    actions.className = 'icen-dt-toolbar-actions';
    if (opts.columnVisibility) {
      const colBtn = document.createElement('button');
      colBtn.type = 'button';
      colBtn.className = 'icen-dt-tool-btn';
      colBtn.setAttribute('aria-label', t('datatable.columnSettingsAria'));
      colBtn.appendChild(createIcon('columns', { size: 14 })!);
      colBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (openPanel?.key === '__cols') closeFilterPanel();
        else { closeFilterPanel(); openColumnPanel(colBtn); }
      });
      actions.appendChild(colBtn);
    }
    if (opts.exportable) {
      const expBtn = document.createElement('button');
      expBtn.type = 'button';
      expBtn.className = 'icen-dt-tool-btn';
      expBtn.setAttribute('aria-label', t('common.exportCsv'));
      expBtn.appendChild(createIcon('download', { size: 14 })!);
      expBtn.addEventListener('click', () => exportCSV());
      actions.appendChild(expBtn);
    }
    if (actions.children.length > 0) toolbar.appendChild(actions);
    root.appendChild(toolbar);
  }

  /* 表头 + 表体滚动容器 */
  const scroll = document.createElement('div');
  scroll.className = 'icen-dt-scroll';
  if (virtual) scroll.style.maxHeight = opts.height ?? '420px';

  const canvas = document.createElement('div');
  canvas.className = 'icen-dt-canvas';
  canvas.setAttribute('role', 'grid');

  const head = document.createElement('div');
  head.className = 'icen-dt-head';
  head.setAttribute('role', 'rowgroup');
  const headRow = document.createElement('div');
  headRow.className = 'icen-dt-row icen-dt-row--head';
  headRow.setAttribute('role', 'row');
  head.appendChild(headRow);

  const body = document.createElement('div');
  body.className = 'icen-dt-body';
  body.setAttribute('role', 'rowgroup');

  /* 汇总行：挂在 canvas 内（随横向滚动对齐列），sticky bottom 钉在视口底 */
  const summaryEl = document.createElement('div');
  summaryEl.className = 'icen-dt-row icen-dt-row--summary';
  summaryEl.setAttribute('role', 'row');
  summaryEl.hidden = true;

  canvas.append(head, body, summaryEl);
  scroll.appendChild(canvas);
  root.appendChild(scroll);

  /* 底部（分页 / 统计） */
  const foot = document.createElement('div');
  foot.className = 'icen-dt-foot';
  root.appendChild(foot);
  el.appendChild(root);

  /* ═══ 列模板（合并拖拽覆盖宽度 + 冻结偏移计算）═══ */
  function parsePx(w: string): number {
    const m = /^(\d+(?:\.\d+)?)px/.exec(w);
    return m ? Number(m[1]) : 0;
  }
  /** 冻结偏移：左冻结从行首累计（含前导选择/展开列宽），右冻结从行尾倒序累计——
      与列宽拖拽同法，只吃 colWidths 覆盖值与列声明 px 宽（fr 视为 0，同左冻结口径） */
  function frozenOffsets(): { left: Map<string, number>; right: Map<string, number> } {
    const left = new Map<string, number>();
    const right = new Map<string, number>();
    const visible = cols();
    if (!visible.some((c) => c.frozen)) return { left, right };
    let acc = 0;
    if (selectable) acc += 40;
    if (expandable) acc += 34;
    for (const c of visible) {
      if (frozenSide(c) === 'left') left.set(c.key, acc);
      acc += parsePx(colWidths.get(c.key) ?? c.width ?? 'minmax(0,1fr)');
    }
    let accR = 0;
    for (let i = visible.length - 1; i >= 0; i--) {
      const c = visible[i]!;
      if (frozenSide(c) === 'right') right.set(c.key, accR);
      accR += parsePx(colWidths.get(c.key) ?? c.width ?? 'minmax(0,1fr)');
    }
    return { left, right };
  }
  function applyFrozen(cell: HTMLElement, col: TableColumn<Row>, frz: { left: Map<string, number>; right: Map<string, number> }): void {
    const side = frozenSide(col);
    if (side === 'left') {
      cell.classList.add('icen-dt-cell--frozen');
      const off = frz.left.get(col.key);
      if (off != null) cell.style.left = `${off}px`;
    } else if (side === 'right') {
      cell.classList.add('icen-dt-cell--frozen-right');
      const off = frz.right.get(col.key);
      if (off != null) cell.style.right = `${off}px`;
    }
  }
  function template(): string {
    const parts: string[] = [];
    if (selectable) parts.push('40px');
    if (expandable) parts.push('34px');
    for (const c of cols()) parts.push(colWidths.get(c.key) ?? c.width ?? 'minmax(0,1fr)');
    return parts.join(' ');
  }

  /* ═══ 单元格内容 ═══ */
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
    input.className = 'icen-dt-check';
    input.checked = checked;
    input.setAttribute('aria-label', label);
    return input;
  }

  /* ═══ 排序内核（单排序 = 单元素栈）═══ */
  /** 应用新排序栈：emit 只派主排序，onSortChange 收主键或 null */
  function applySorts(next: TableSortEntry[], nullDir: 'asc' | 'desc' = 'asc', emit = true): void {
    sorts = next;
    invalidate();
    const primary = sorts[0];
    if (primary && emit) emitIcen(root, 'icen:table-sort-change', { key: primary.key, dir: primary.dir });
    opts.onSortChange?.(primary?.key ?? null, primary?.dir ?? nullDir);
    renderAll();
  }

  function toggleSort(key: string, append: boolean): void {
    const cur = sorts.find((s) => s.key === key);
    if (!multiSort || !append) {
      /* 单排序路径：他列 → 升序；本列 → 升→降→取消 */
      if (!cur) applySorts([{ key, dir: 'asc' }]);
      else if (cur.dir === 'asc') applySorts([{ key, dir: 'desc' }]);
      else applySorts([], cur.dir);
      return;
    }
    /* Shift+点击：追加/循环/移除该列自身，不动其它列的相对优先级 */
    if (!cur) applySorts([...sorts, { key, dir: 'asc' }]);
    else if (cur.dir === 'asc') applySorts(sorts.map((s) => (s.key === key ? { key, dir: 'desc' as const } : s)));
    else applySorts(sorts.filter((s) => s.key !== key), cur.dir);
  }

  function sanitizeSorts(arr: TableSortEntry[]): TableSortEntry[] {
    const out: TableSortEntry[] = [];
    for (const s of arr ?? []) {
      if (!s || typeof s.key !== 'string' || !colByKey(s.key)) continue;
      const dir: 'asc' | 'desc' = s.dir === 'desc' ? 'desc' : 'asc';
      if (!out.some((o) => o.key === s.key)) out.push({ key: s.key, dir });
    }
    return out;
  }

  /* ═══ 表头渲染（排序/筛选状态跟随）═══ */
  /* 筛选面板 portal 到 body（.icen-dt-scroll 有 overflow，绝对定位会被裁切） */
  let openPanel: { key: string; el: HTMLElement } | null = null;

  /** 浮层面板定位走全库 PanelSizing 契约：根 data-panel-* 可覆盖宽/高度上限，
      视口翻转/夹取复用 computePopoverLayout（与 popover 家族同一布局纪律）。 */
  function positionDropdownPanel(panel: HTMLElement, btn: HTMLElement): void {
    panel.hidden = false;
    /* data-panel-* 须从用户可见根 el 读：root 是 createTable 内部 div，用户无法在其上挂覆盖 */
    const sizing = resolvePanelSizing(el);
    applyPanelSizing(panel, sizing);
    const rect = btn.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    /* 宽度锁死（min=max）：勾选项增减不引起面板横向伸缩；180 为最小可读宽 */
    const layout = computePopoverLayout(
      { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
      { side: 'bottom', align: 'end', offset: 4, margin: 8, minWidth: Math.max(pr.width, 180), maxWidth: Math.max(pr.width, 180), contentHeightHint: pr.height, maxHeight: sizing.maxHeight },
    );
    panel.style.left = `${layout.left}px`;
    panel.style.top = `${layout.top}px`;
  }

  function onPanelScroll(ev: Event): void {
    if (openPanel && ev.target instanceof Node && openPanel.el.contains(ev.target)) return;
    closeFilterPanel();
  }

  function closeFilterPanel(): void {
    if (!openPanel) return;
    openPanel.el.remove();
    openPanel = null;
    headRow.querySelectorAll('.icen-dt-filter-btn').forEach((b) => b.classList.remove('is-open'));
    window.removeEventListener('scroll', onPanelScroll, true);
    window.removeEventListener('resize', onPanelScroll);
  }

  function openFilterPanel(col: TableColumn<Row>, btn: HTMLElement): void {
    const panel = buildFilterPanel(col);
    document.body.appendChild(panel);
    openPanel = { key: col.key, el: panel };
    btn.classList.add('is-open');

    positionDropdownPanel(panel, btn);

    window.addEventListener('scroll', onPanelScroll, true);
    window.addEventListener('resize', onPanelScroll);
  }

  function renderHead(): void {
    closeFilterPanel();
    headRow.textContent = '';
    headRow.style.gridTemplateColumns = template();
    const frz = frozenOffsets();

    if (selectable) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell icen-dt-cell--check';
      cell.setAttribute('role', 'columnheader');
      const rows = pipeline();
      const allKeys = rows.map((r) => keyOfRow(r));
      const selCount = allKeys.filter((k) => selected.has(k)).length;
      const box = makeCheck(selCount > 0 && selCount === allKeys.length, t('datatable.selectAll'));
      box.indeterminate = selCount > 0 && selCount < allKeys.length;
      box.addEventListener('change', () => {
        if (box.checked) allKeys.forEach((k) => selected.add(k));
        else allKeys.forEach((k) => selected.delete(k));
        emitSelection();
        renderBody();
        syncHeadState();
      });
      cell.appendChild(box);
      headRow.appendChild(cell);
    }
    if (expandable) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell icen-dt-cell--expand';
      cell.setAttribute('role', 'columnheader');
      headRow.appendChild(cell);
    }

    for (const col of cols()) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell icen-dt-cell--head';
      cell.setAttribute('role', 'columnheader');
      if (col.align) cell.dataset.icenAlign = col.align;
      cell.dataset.icenColKey = col.key;
      applyFrozen(cell, col, frz);

      const title = document.createElement('span');
      title.className = 'icen-dt-head-title';
      title.textContent = col.title;
      cell.appendChild(title);

      if (col.sortable) {
        cell.classList.add('is-sortable');
        cell.setAttribute('role', 'columnheader');
        cell.tabIndex = 0;
        const si = sorts.findIndex((s) => s.key === col.key);
        const active = si >= 0;
        cell.setAttribute('aria-sort', active ? (sorts[si]!.dir === 'asc' ? 'ascending' : 'descending') : 'none');
        const arrow = document.createElement('span');
        arrow.className = 'icen-dt-sort';
        arrow.append(createIcon(active ? (sorts[si]!.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort',{size:14})!);
        if (active) arrow.classList.add('is-active');
        cell.appendChild(arrow);
        if (active && sorts.length > 1) {
          /* 多列排序：徽标显示优先级序号（1 = 主排序） */
          const badge = document.createElement('span');
          badge.className = 'icen-dt-sort-badge';
          badge.textContent = String(si + 1);
          cell.appendChild(badge);
        }
        cell.addEventListener('click', (ev) => {
          if ((ev.target as Element).closest('.icen-dt-filter-btn, .icen-dt-resize')) return;
          if (Date.now() - lastDragEndAt < 200) return; /* 列重排拖拽的尾随 click 不触发排序 */
          toggleSort(col.key, ev.shiftKey);
        });
        cell.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleSort(col.key, ev.shiftKey); }
        });
      }

      if (col.filterable) {
        const hasFilter = filters.has(col.key);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icen-dt-filter-btn';
        btn.dataset.colKey = col.key;
        if (hasFilter) btn.classList.add('is-active');
        btn.setAttribute('aria-label', t('datatable.filterChipAria', { p0: col.title }));
        btn.appendChild(createIcon('filter', { size: 12 })!);
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

      /* 列宽拖拽手柄（最后一列不加：它需要弹性伸展） */
      if (resizable && col !== cols()[cols().length - 1]) {
        const handle = document.createElement('div');
        handle.className = 'icen-dt-resize';
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', t('datatable.resizeAria', { p0: col.title }));
        attachResize(handle, col);
        cell.appendChild(handle);
      }

      /* 列重排拖拽（复用列宽拖拽的指针基础设施：位移阈值触发，rAF 批处理影子/指示线） */
      if (reorderable) attachReorderDrag(cell, col);

      headRow.appendChild(cell);
    }
  }

  /* 只同步表头状态（全选三态 / 筛选钮激活徽标），不重建表头——
     筛选/列显隐面板在勾选变更期间必须存活，重建表头会 closeFilterPanel() */
  function syncHeadState(): void {
    const headBox = headRow.querySelector<HTMLInputElement>('.icen-dt-cell--check .icen-dt-check');
    if (headBox) {
      const allKeys = pipeline().map((r) => keyOfRow(r));
      const selCount = allKeys.filter((k) => selected.has(k)).length;
      headBox.checked = selCount > 0 && selCount === allKeys.length;
      headBox.indeterminate = selCount > 0 && selCount < allKeys.length;
    }
    headRow.querySelectorAll<HTMLElement>('.icen-dt-filter-btn').forEach((b) => {
      const key = b.dataset.colKey;
      if (key) b.classList.toggle('is-active', filters.has(key));
    });
  }

  /* 重建表头但保住当前打开的面板：列显隐变化必须重建表头（增删列），
     直接 renderAll 会经 renderHead 内的 closeFilterPanel 把面板关掉 */
  function renderHeadKeepPanel(): void {
    const keep = openPanel;
    renderHead();
    if (!keep) return;
    openPanel = keep;
    document.body.appendChild(keep.el);
    window.addEventListener('scroll', onPanelScroll, true);
    window.addEventListener('resize', onPanelScroll);
    /* 筛选面板的触发钮在重建后的表头里，补回 is-open（列显隐面板的钮在工具栏，不受影响） */
    if (keep.key !== '__cols') {
      headRow.querySelectorAll<HTMLElement>('.icen-dt-filter-btn').forEach((b) => {
        if (b.dataset.colKey === keep.key) b.classList.add('is-open');
      });
    }
  }

  /* ═══ 列宽拖拽：pointer capture + 写入 colWidths → 重算模板；
         只在拖拽结束时派一次 icen:table-column-resize（过程不派，防事件洪泛）═══ */
  function attachResize(handle: HTMLElement, col: TableColumn<Row>): void {
    handle.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const startX = ev.clientX;
      const startW = handle.closest('.icen-dt-cell')!.getBoundingClientRect().width;
      try { handle.setPointerCapture(ev.pointerId); } catch { /* 部分环境（测试 DOM 等）无 pointer capture */ }
      const onMove = (e: PointerEvent): void => {
        const delta = e.clientX - startX;
        const next = Math.max(48, Math.round(startW + delta)); /* 48：最小可读列宽，拖拽不至把列挤没 */
        colWidths.set(col.key, `${next}px`);
        headRow.style.gridTemplateColumns = template();
        body.querySelectorAll<HTMLElement>('.icen-dt-row').forEach((r) => {
          r.style.gridTemplateColumns = template();
        });
      };
      const onUp = (e: PointerEvent): void => {
        try { handle.releasePointerCapture(e.pointerId); } catch { /* capture 可能已被浏览器释放 */ }
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        const width = colWidths.get(col.key);
        if (width) emitIcen(root, 'icen:table-column-resize', { key: col.key, width });
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  }

  /* ═══ 列重排 ═══
     冻结/非冻结分区互不跨越：左冻结块 [0, L)、自由块 [L, n-R)、右冻结块 [n-R, n)。
     toIndex 语义 = 拖出该列后可见列序中的落点（与拖拽指示线同一口径）。 */
  const clampN = (v: number, lo: number, hi: number): number =>
    hi < lo ? lo : Math.min(hi, Math.max(lo, v));

  function reorderBounds(key: string): [number, number] {
    const vis = cols();
    const leftCount = vis.filter((c) => frozenSide(c) === 'left').length;
    const rightCount = vis.filter((c) => frozenSide(c) === 'right').length;
    const col = colByKey(key);
    if (!col) return [0, vis.length - 1];
    const side = frozenSide(col);
    if (side === 'left') return [0, leftCount - 1];
    if (side === 'right') return [vis.length - rightCount, vis.length - 1];
    return [leftCount, vis.length - rightCount - 1];
  }

  function moveColumn(key: string, toIndex: number): void {
    if (!colByKey(key) || !Number.isFinite(toIndex)) return;
    if (!colOrder) colOrder = opts.columns.map((c) => c.key);
    const hiddenSet = new Set(opts.columns.filter((c) => c.hidden || colHidden.get(c.key)).map((c) => c.key));
    const vis = colOrder.filter((k) => !hiddenSet.has(k));
    const from = vis.indexOf(key);
    if (from < 0) return;
    const [lo, hi] = reorderBounds(key);
    const target = clampN(Math.round(toIndex), lo, hi);
    if (target === from) return;
    vis.splice(from, 1);
    vis.splice(target, 0, key);
    /* 合回全量顺序：隐藏列槽位不动，可见槽位按新可见序填入 */
    const newOrder: string[] = [];
    let vi = 0;
    for (const k of colOrder) {
      newOrder.push(hiddenSet.has(k) ? k : vis[vi++]!);
    }
    colOrder = newOrder;
    invalidate();
    emitIcen(root, 'icen:table-column-reorder', { key, fromIndex: from, toIndex: target });
    renderAll();
  }

  interface DragSession {
    key: string;
    ghost: HTMLElement;
    indicator: HTMLElement;
    off: () => void;
  }

  function attachReorderDrag(cell: HTMLElement, col: TableColumn<Row>): void {
    cell.addEventListener('pointerdown', (ev) => {
      if (destroyed || ev.button !== 0) return;
      const t = ev.target;
      /* 把手/按钮/表单控件上的按下不算拖拽起手（与排序 click 判定同口径） */
      if (t instanceof Element && t.closest('.icen-dt-resize, .icen-dt-filter-btn, button, input, select, textarea, a')) return;
      const startX = ev.clientX;
      const startY = ev.clientY;
      let started = false;
      let latestX = startX;
      let latestY = startY;
      let raf = 0;

      const headCellsExcl = (): HTMLElement[] =>
        Array.from(headRow.querySelectorAll<HTMLElement>('.icen-dt-cell--head'))
          .filter((c) => c.dataset.icenColKey !== col.key);

      const targetFromX = (x: number): number => {
        const cells = headCellsExcl();
        let target = cells.length;
        for (let i = 0; i < cells.length; i++) {
          const r = cells[i]!.getBoundingClientRect();
          if (x < r.left + r.width / 2) { target = i; break; }
        }
        const [lo, hi] = reorderBounds(col.key);
        return clampN(target, lo, hi);
      };

      const placeIndicator = (target: number): void => {
        if (!drag) return;
        const cells = headCellsExcl();
        const scrollRect = scroll.getBoundingClientRect();
        let x: number;
        if (cells.length === 0) x = scrollRect.left;
        else if (target >= cells.length) x = cells[cells.length - 1]!.getBoundingClientRect().right;
        else x = cells[target]!.getBoundingClientRect().left;
        drag.indicator.style.left = `${Math.max(0, x - 1)}px`;
        drag.indicator.style.top = `${scrollRect.top}px`;
        drag.indicator.style.height = `${scrollRect.height}px`;
      };

      const paint = (): void => {
        raf = 0;
        if (!drag || !started) return;
        drag.ghost.style.left = `${latestX + 12}px`;
        drag.ghost.style.top = `${latestY + 10}px`;
        placeIndicator(targetFromX(latestX));
      };

      const onMove = (e: PointerEvent): void => {
        if (!started && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
          started = true;
          const ghost = document.createElement('div');
          ghost.className = 'icen-dt-col-ghost';
          ghost.textContent = col.title;
          const indicator = document.createElement('div');
          indicator.className = 'icen-dt-col-indicator';
          document.body.append(ghost, indicator);
          cell.classList.add('is-drag-source');
          drag = { key: col.key, ghost, indicator, off: cleanup };
        }
        latestX = e.clientX;
        latestY = e.clientY;
        if (started && !raf) raf = requestAnimationFrame(paint);
      };

      const cleanup = (): void => {
        window.cancelAnimationFrame(raf);
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        document.removeEventListener('pointercancel', onUp, true);
        if (drag) {
          drag.ghost.remove();
          drag.indicator.remove();
          drag = null;
        }
        cell.classList.remove('is-drag-source');
      };

      const onUp = (e: PointerEvent): void => {
        const wasDrag = started;
        const target = wasDrag ? targetFromX(e.clientX) : -1;
        cleanup();
        if (wasDrag) {
          lastDragEndAt = Date.now();
          moveColumn(col.key, target);
        }
      };

      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onUp, true);
    });
  }

  /* ═══ 列显隐面板 ═══ */
  function openColumnPanel(btn: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'icen-dt-filter-panel dt-col-panel';
    panel.hidden = true;
    panel.addEventListener('click', (ev) => ev.stopPropagation());

    const list = document.createElement('div');
    list.className = 'icen-dt-filter-list';
    for (const col of opts.columns) {
      if (col.key === '__select' || col.key === '__expand') continue;
      const row = document.createElement('label');
      row.className = 'icen-dt-filter-item';
      const isHidden = colHidden.get(col.key) ?? col.hidden ?? false;
      const box = makeCheck(!isHidden, col.title);
      box.addEventListener('change', () => {
        if (box.checked) colHidden.delete(col.key);
        else colHidden.set(col.key, true);
        emitIcen(root, 'icen:table-columns-change', { hidden: Array.from(colHidden.keys()) });
        invalidate();
        /* 列增删要重建表头，但面板保持打开（与筛选面板同纪律） */
        renderBody();
        renderHeadKeepPanel();
      });
      const text = document.createElement('span');
      text.textContent = col.title;
      row.append(box, text);
      list.appendChild(row);
    }
    panel.appendChild(list);
    document.body.appendChild(panel);
    openPanel = { key: '__cols', el: panel };

    positionDropdownPanel(panel, btn);
    window.addEventListener('scroll', onPanelScroll, true);
    window.addEventListener('resize', onPanelScroll);
  }

  /* ═══ CSV 导出（当前管线数据）═══ */
  function exportCSV(filename?: string): void {
    const rows = pipeline();
    emitIcen(root, 'icen:table-export', { count: rows.length });
    const visible = cols();
    const header = visible.map((c) => csvEscape(c.title)).join(',');
    const lines = rows.map((row) =>
      visible.map((c) => csvEscape(String(row[c.key as keyof Row] ?? ''))).join(','),
    );
    /* UTF-8 BOM：Excel 识别 UTF-8 CSV 用（fromCharCode 避开转义字面量歧义） */
    const csv = String.fromCharCode(0xfeff) + [header, ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? 'export.csv';
    a.click();
    /* 同步 revoke 会截断尚未开始的下载，延迟到下载启动后回收 */
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function csvEscape(s: string): string {
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /* ═══ 筛选面板（去重值多选，即时生效）═══ */
  function buildFilterPanel(col: TableColumn<Row>): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'icen-dt-filter-panel';
    panel.hidden = true;
    panel.addEventListener('click', (ev) => ev.stopPropagation());

    const list = document.createElement('div');
    list.className = 'icen-dt-filter-list';

    const values = Array.from(new Set(data.map((r) => String(r[col.key as keyof Row] ?? ''))))
      .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));

    for (const v of values) {
      const row = document.createElement('label');
      row.className = 'icen-dt-filter-item';
      const box = makeCheck(filters.get(col.key)?.has(v) ?? true, v);
      box.addEventListener('change', () => {
        const cur = new Set(filters.get(col.key) ?? values);
        if (box.checked) cur.add(v);
        else cur.delete(v);
        if (cur.size === values.length) filters.delete(col.key);
        else filters.set(col.key, cur);
        emitIcen(root, 'icen:table-filter-change', { key: col.key, values: Array.from(filters.get(col.key) ?? []) });
        invalidate();
        page = 1;
        /* 只重渲表体/底部 + 同步表头徽标，不重建表头（renderHead 会关掉本面板） */
        renderBody();
        syncHeadState();
      });
      const text = document.createElement('span');
      text.textContent = v === '' ? t('datatable.emptyValue') : v;
      row.append(box, text);
      list.appendChild(row);
    }

    const footRow = document.createElement('div');
    footRow.className = 'icen-dt-filter-foot';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'icen-dt-filter-reset';
    reset.textContent = t('datatable.reset');
    reset.addEventListener('click', () => {
      filters.delete(col.key);
      invalidate();
      page = 1;
      /* 重置后所有去重值恢复勾选，面板保持打开 */
      list.querySelectorAll<HTMLInputElement>('.icen-dt-check').forEach((b) => { b.checked = true; });
      renderBody();
      syncHeadState();
    });
    footRow.appendChild(reset);
    panel.append(list, footRow);
    return panel;
  }

  /* ═══ 单元格编辑 ═══
     双击或 Enter 进入（行内 input/select 替换单元格内容）；Enter/失焦提交、Esc 取消。
     提交派 icen:table-cell-edit + onCellEdit——本地数据不自动改，宿主决定是否采纳
     （调 handle.updateCell(rowKey, field, value) 或 setData）。
     number 编辑器校验数字：非法值 .is-invalid 抖动 + 不提交。编辑中的行滚出视口 = 取消
     （renderBody 重建 DOM 前静默取消，虚拟滚动与分页模式下同此纪律）。 */
  interface EditSession {
    rowKey: string;
    col: TableColumn<Row>;
    row: Row;
    cell: HTMLElement;
    editor: HTMLInputElement | HTMLSelectElement;
    onKey: (ev: Event) => void;
    onBlur: () => void;
    onChange: () => void;
  }

  function startEdit(cell: HTMLElement, row: Row, col: TableColumn<Row>, rowKey: string): void {
    if (!isEditable(col) || editing) return;
    const kind = editKind(col);
    let editor: HTMLInputElement | HTMLSelectElement;
    if (kind === 'select') {
      const sel = document.createElement('select');
      sel.className = 'icen-dt-editor icen-dt-editor--select';
      const cur = String(row[col.key as keyof Row] ?? '');
      for (const opt of col.editOptions ?? []) {
        const o = document.createElement('option');
        o.value = typeof opt === 'string' ? opt : opt.value;
        o.textContent = typeof opt === 'string' ? opt : opt.label;
        if (o.value === cur) o.selected = true;
        sel.appendChild(o);
      }
      editor = sel;
    } else {
      const inp = document.createElement('input');
      inp.className = 'icen-dt-editor';
      if (kind === 'number') {
        /* type=text + inputMode：非法输入可达（由校验拦截），type=number 会吞掉非法值无法反馈 */
        inp.type = 'text';
        inp.inputMode = 'decimal';
      } else {
        inp.type = 'text';
      }
      inp.value = String(row[col.key as keyof Row] ?? '');
      editor = inp;
    }
    const session: EditSession = {
      rowKey,
      col,
      row,
      cell,
      editor,
      onKey: (ev) => {
        const ke = ev as KeyboardEvent;
        if (ke.key === 'Enter') {
          ke.preventDefault();
          ke.stopPropagation();
          commitEdit();
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          ke.stopPropagation();
          cancelEdit();
        }
      },
      /* 失焦提交（点击表外/切格）；值非法时 markInvalid 内会夺回焦点 */
      onBlur: () => { commitEdit(); },
      onChange: () => {
        if (editing?.editor instanceof HTMLSelectElement) commitEdit();
      },
    };
    editing = session;
    cell.classList.add('is-editing');
    cell.textContent = '';
    cell.appendChild(editor);
    editor.addEventListener('keydown', session.onKey);
    editor.addEventListener('blur', session.onBlur);
    if (editor instanceof HTMLSelectElement) editor.addEventListener('change', session.onChange);
    editor.addEventListener('input', () => editor.classList.remove('is-invalid'));
    editor.focus();
    if (editor instanceof HTMLInputElement) editor.select();
  }

  function markInvalid(s: EditSession): void {
    s.editor.classList.add('is-invalid');
    s.editor.focus();
  }

  function commitEdit(): void {
    const s = editing;
    if (!s) return;
    let value: unknown;
    if (s.editor instanceof HTMLSelectElement) {
      value = s.editor.value;
    } else if (editKind(s.col) === 'number') {
      const raw = s.editor.value.trim();
      const n = raw === '' ? NaN : Number(raw);
      if (Number.isNaN(n)) { markInvalid(s); return; }
      value = n;
    } else {
      value = s.editor.value;
    }
    /* 先摘会话再派事件：宿主在回调里调 updateCell/setData 会触发重渲，blur 尾随不重复提交 */
    editing = null;
    s.editor.removeEventListener('keydown', s.onKey);
    s.editor.removeEventListener('blur', s.onBlur);
    s.editor.removeEventListener('change', s.onChange);
    emitIcen(root, 'icen:table-cell-edit', { rowKey: s.rowKey, field: s.col.key, value, row: s.row });
    opts.onCellEdit?.(s.rowKey, s.col.key, value, s.row);
    renderBody();
    refocusCell(s.rowKey, s.col.key);
  }

  function cancelEdit(silent = false): void {
    const s = editing;
    if (!s) return;
    editing = null;
    s.editor.removeEventListener('keydown', s.onKey);
    s.editor.removeEventListener('blur', s.onBlur);
    s.editor.removeEventListener('change', s.onChange);
    if (!silent) {
      renderBody();
      refocusCell(s.rowKey, s.col.key);
    }
  }

  function refocusCell(rowKey: string, colKey: string): void {
    const rowEl = Array.from(body.querySelectorAll<HTMLElement>('.icen-dt-row[data-icen-key]'))
      .find((r) => r.dataset.icenKey === rowKey);
    const cell = rowEl
      ? Array.from(rowEl.querySelectorAll<HTMLElement>('.icen-dt-cell[data-icen-col-key]'))
          .find((c) => c.dataset.icenColKey === colKey)
      : null;
    if (cell) {
      focusPos = { key: rowKey, col: colKey };
      cell.focus();
    }
  }

  function updateCell(rowKey: string, field: string, value: unknown): void {
    const row = data.find((r) => keyOfRow(r) === rowKey);
    if (!row) return;
    (row as unknown as Record<string, unknown>)[field] = value;
    invalidate();
    renderAll();
  }

  /* ═══ 行分组：组头行渲染 + 折叠（状态跨 setData 保持）═══ */
  function toggleGroup(label: string, collapsed?: boolean): void {
    const next = collapsed ?? groupState.get(label) !== true;
    groupState.set(label, next);
    emitIcen(root, 'icen:table-group-toggle', { key: label, collapsed: next });
    invalidate();
    renderBody();
  }

  function makeGroupRow(entry: Extract<FlatEntry, { kind: 'group' }>): HTMLElement {
    const tr = document.createElement('div');
    tr.className = 'icen-dt-row icen-dt-row--group';
    if (entry.collapsed) tr.classList.add('is-collapsed');
    tr.setAttribute('role', 'row');
    tr.style.gridTemplateColumns = template();
    if (virtual) tr.style.height = `${rowH}px`;

    const cell = document.createElement('div');
    cell.className = 'icen-dt-cell icen-dt-cell--group';
    cell.setAttribute('role', 'gridcell');
    cell.style.gridColumn = '1 / -1';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icen-dt-group-toggle';
    btn.setAttribute('aria-expanded', String(!entry.collapsed));
    btn.setAttribute('aria-label', entry.collapsed ? t('datatable.expandGroup', { p0: entry.label }) : t('datatable.collapseGroup', { p0: entry.label }));
    btn.appendChild(createIcon('chevron-down', { size: 14 })!);

    const label = document.createElement('span');
    label.className = 'icen-dt-group-label';
    label.textContent = entry.label;

    const count = document.createElement('span');
    count.className = 'icen-dt-group-count';
    count.textContent = t('datatable.countUnit', { p0: entry.count });

    cell.append(btn, label, count);

    const aggKeys = Object.keys(entry.aggs);
    if (aggKeys.length > 0) {
      const aggs = document.createElement('span');
      aggs.className = 'icen-dt-group-aggs';
      for (const k of aggKeys) {
        const chip = document.createElement('span');
        chip.className = 'icen-dt-group-agg';
        chip.textContent = `${colByKey(k)?.title ?? k} ${entry.aggs[k]}`;
        aggs.appendChild(chip);
      }
      cell.appendChild(aggs);
    }

    tr.appendChild(cell);
    /* 整行点击折叠/展开（button 冒泡到此，单一处理器不会双触发） */
    tr.addEventListener('click', () => toggleGroup(entry.label));
    return tr;
  }

  /* ═══ 行渲染 ═══ */
  /* offsets 由 renderBody 算一次传入：frozenOffsets 全列重扫，每行重算是 O(行×列) 放大 */
  function makeRow(row: Row, flatIndex: number, pipeIndex: number, key: string, offsets: { left: Map<string, number>; right: Map<string, number> }): HTMLElement {
    const tr = document.createElement('div');
    tr.className = 'icen-dt-row';
    tr.setAttribute('role', 'row');
    tr.style.gridTemplateColumns = template();
    if (virtual) tr.style.height = `${rowH}px`;
    tr.dataset.icenRow = String(flatIndex);
    tr.dataset.icenKey = key;
    if (selected.has(key)) tr.classList.add('is-selected');
    if (opts.rowClassName) {
      const extra = opts.rowClassName(row, pipeIndex);
      if (extra) tr.classList.add(...extra.split(/\s+/).filter(Boolean));
    }

    if (selectable) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell icen-dt-cell--check';
      cell.setAttribute('role', 'gridcell');
      if (offsets.left.size > 0 || offsets.right.size > 0) {
        /* 选择列也冻结 */
        cell.classList.add('icen-dt-cell--frozen');
        cell.style.left = '0px';
      }
      const box = makeCheck(selected.has(key), t('datatable.selectRow'));
      /* click 先于 change 触发：shiftKey 经闭包变量中转（不往 DOM 元素上挂私有属性） */
      let shiftClicked = false;
      box.addEventListener('click', (ev) => {
        shiftClicked = ev.shiftKey;
        ev.stopPropagation();
      });
      box.addEventListener('change', () => {
        const shift = shiftClicked;
        shiftClicked = false;
        if (shift && lastClickedIndex >= 0 && lastClickedIndex !== flatIndex) {
          /* Shift+点击：范围选（统一按 flatRows 区间取数据行，组头自然跳过；
             无分组时 flatRows 与管线序一一对应） */
          const entries = flatEntries();
          const [lo, hi] = lastClickedIndex < flatIndex
            ? [lastClickedIndex, flatIndex]
            : [flatIndex, lastClickedIndex];
          const willSelect = box.checked;
          for (let i = lo; i <= hi; i++) {
            const entry = entries[i];
            if (!entry || entry.kind !== 'data') continue;
            const k = keyOfRow(entry.row);
            if (willSelect) selected.add(k);
            else selected.delete(k);
          }
          renderBody();
        } else {
          if (box.checked) selected.add(key);
          else selected.delete(key);
          tr.classList.toggle('is-selected', box.checked);
        }
        lastClickedIndex = flatIndex;
        emitSelection();
        syncHeadState();
        renderFoot(currentTotal, pipeline().length);
      });
      cell.appendChild(box);
      tr.appendChild(cell);
    }
    if (expandable) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell icen-dt-cell--expand';
      cell.setAttribute('role', 'gridcell');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icen-dt-expand-btn';
      btn.setAttribute('aria-label', t('datatable.expandRow'));
      btn.setAttribute('aria-expanded', String(expanded.has(key)));
      btn.appendChild(createIcon('chevron-down', { size: 14 })!);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (expanded.has(key)) expanded.delete(key);
        else expanded.add(key);
        emitIcen(root, 'icen:table-row-toggle', { row, index: pipeIndex, expanded: expanded.has(key) });
        renderBody();
      });
      cell.appendChild(btn);
      tr.appendChild(cell);
    }

    let ci = 0;
    for (const col of cols()) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell';
      cell.setAttribute('role', 'gridcell');
      if (col.align) cell.dataset.icenAlign = col.align;
      cell.dataset.icenCol = String(ci);
      cell.dataset.icenColKey = col.key;
      cell.tabIndex = -1; /* roving tabindex：body 级键盘导航 */
      applyFrozen(cell, col, offsets);
      fillCell(cell, col, row, pipeIndex);
      if (isEditable(col)) {
        cell.classList.add('is-editable');
        cell.setAttribute('aria-label', t('datatable.editHintWithValue', { p0: cell.textContent ?? '', p1: col.title }));
        cell.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          startEdit(cell, row, col, key);
        });
      }
      tr.appendChild(cell);
      ci++;
    }

    if (opts.onRowClick) {
      tr.classList.add('is-clickable');
      tr.addEventListener('click', () => opts.onRowClick!(row));
    }
    tr.addEventListener('click', () => {
      emitIcen(root, 'icen:table-row-click', { row, index: pipeIndex });
    });
    if (opts.contextMenu) {
      tr.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openContextMenu(ev.clientX, ev.clientY, opts.contextMenu!(row), {
          sizing: readPanelSizing(el),
        });
      });
    }
    return tr;
  }

  function makeExpandRow(row: Row): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'icen-dt-expand-row';
    const out = expandable!(row);
    if (out instanceof Node) wrap.appendChild(out);
    else wrap.textContent = String(out);
    return wrap;
  }

  /* ═══ 汇总行：表尾 sticky 一行，按当前管线（搜索/筛选后、分页前）数据聚合 ═══ */
  function renderSummary(): void {
    summaryEl.textContent = '';
    summaryEl.hidden = true;
    const cfg = opts.summaryRow;
    if (!cfg) return;
    const rows = pipeline();
    if (rows.length === 0) return;
    /* true = 按各列 aggregate（仅内置五种；自定义函数无对应 summary 规格）；
       对象形态 = 逐列规格，'label' 列显示「合计」 */
    const spec: Record<string, TableSummarySpec> =
      cfg === true
        ? Object.fromEntries(
            opts.columns
              .filter((c) => typeof c.aggregate === 'string')
              .map((c) => [c.key, c.aggregate as TableSummarySpec]),
          )
        : cfg;
    if (Object.keys(spec).length === 0) return;
    summaryEl.hidden = false;
    summaryEl.style.gridTemplateColumns = template();
    const frz = frozenOffsets();

    if (selectable) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell icen-dt-cell--check';
      cell.setAttribute('role', 'gridcell');
      summaryEl.appendChild(cell);
    }
    if (expandable) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell icen-dt-cell--expand';
      cell.setAttribute('role', 'gridcell');
      summaryEl.appendChild(cell);
    }
    for (const col of cols()) {
      const cell = document.createElement('div');
      cell.className = 'icen-dt-cell icen-dt-cell--summary';
      cell.setAttribute('role', 'gridcell');
      if (col.align) cell.dataset.icenAlign = col.align;
      applyFrozen(cell, col, frz);
      const s = spec[col.key];
      if (s === 'label') cell.textContent = t('datatable.totalLabel');
      else if (s) cell.textContent = computeAggregates(rows, [{ ...col, aggregate: s }])[col.key] ?? '';
      summaryEl.appendChild(cell);
    }
  }

  /* ═══ 键盘导航 + 复制（tbody roving tabindex）═══ */
  function onBodyFocusIn(ev: FocusEvent): void {
    const cell = (ev.target as Element).closest<HTMLElement>('.icen-dt-cell');
    if (!cell || !body.contains(cell) || cell.dataset.icenCol == null) return;
    if (cell.classList.contains('is-editing')) return;
    const tr = cell.parentElement;
    focusPos = { key: tr?.dataset.icenKey ?? '', col: cell.dataset.icenColKey ?? '' };
    body.querySelectorAll<HTMLElement>('.icen-dt-cell[data-icen-col]').forEach((c) => {
      c.tabIndex = c === cell ? 0 : -1;
    });
  }

  /** 重渲后恢复 roving tabindex：回到焦点位（若该行仍渲染），否则落到首个数据格 */
  function syncNavFocus(): void {
    const cells = body.querySelectorAll<HTMLElement>('.icen-dt-cell[data-icen-col]');
    let marked = false;
    cells.forEach((c) => {
      const tr = c.parentElement;
      const match =
        focusPos != null && tr?.dataset.icenKey === focusPos.key && c.dataset.icenColKey === focusPos.col;
      c.tabIndex = match ? 0 : -1;
      if (match) marked = true;
    });
    if (!marked) {
      const first = body.querySelector<HTMLElement>('.icen-dt-cell[data-icen-col]');
      if (first) first.tabIndex = 0;
    }
  }

  function navStep(): number {
    if (virtual) return Math.max(1, Math.floor((scroll.clientHeight || rowH * 10) / rowH));
    return Math.max(1, pageSize);
  }

  function findNavCell(r: number, c: number, dir: 0 | 1 | -1): HTMLElement | null {
    let nr = r;
    while (nr >= 0 && nr < navTotal) {
      const el = body.querySelector<HTMLElement>(
        `.icen-dt-row[data-icen-row="${nr}"] .icen-dt-cell[data-icen-col="${c}"]`,
      );
      if (el) return el;
      /* 组头行没有数据格：沿移动方向越过 */
      if (dir === 0) return null;
      nr += dir;
    }
    return null;
  }

  function onBodyKeydown(ev: KeyboardEvent): void {
    if (editing) return; /* 编辑器自管 Enter/Esc，不触发导航 */
    const t = ev.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
    const cell = t instanceof Element ? t.closest<HTMLElement>('.icen-dt-cell') : null;
    if (!cell || cell.dataset.icenCol == null) return;

    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'c' || ev.key === 'C')) {
      copyFocusedCell(cell);
      return;
    }

    const rowEl = cell.parentElement as HTMLElement | null;
    const r = Number(rowEl?.dataset.icenRow ?? -1);
    const c = Number(cell.dataset.icenCol);
    const colCount = cols().length;
    let nr = r;
    let nc = c;
    let dir: 0 | 1 | -1 = 0;
    switch (ev.key) {
      case 'ArrowLeft': nc = c - 1; break;
      case 'ArrowRight': nc = c + 1; break;
      case 'ArrowUp': nr = r - 1; dir = -1; break;
      case 'ArrowDown': nr = r + 1; dir = 1; break;
      case 'Home': nc = 0; break;
      case 'End': nc = colCount - 1; break;
      case 'PageUp': nr = r - navStep(); dir = -1; break;
      case 'PageDown': nr = r + navStep(); dir = 1; break;
      case 'Enter': {
        const key = rowEl?.dataset.icenKey ?? '';
        const row = data.find((rr) => keyOfRow(rr) === key);
        const col = cols()[c];
        if (row && col && isEditable(col)) {
          ev.preventDefault();
          startEdit(cell, row, col, key);
        }
        return;
      }
      default: return;
    }
    ev.preventDefault();
    if (nc < 0) nc = 0;
    if (nc >= colCount) nc = colCount - 1;
    if (nr < 0) nr = 0;
    const maxRow = navTotal - 1;
    if (nr > maxRow) nr = maxRow;
    let target = findNavCell(nr, nc, dir);
    if (!target && virtual) {
      /* 目标行在窗口外：先把视口滚过去（onScroll 同步重渲）再取 */
      scroll.scrollTop = Math.max(0, Math.min(nr, maxRow)) * rowH;
      onScroll();
      target = findNavCell(nr, nc, dir);
    } else if (!target && opts.pagination !== false && !opts.remote) {
      /* 分页模式跨页导航：翻到目标页（派 page-change，与点击页码同纪律）再定位 */
      const pages = Math.max(1, Math.ceil(navTotal / pageSize));
      const want = clampN(Math.floor(nr / pageSize) + 1, 1, pages);
      if (want !== page) {
        page = want;
        emitIcen(root, 'icen:table-page-change', { page, pageSize });
        opts.onPageChange?.(page, pageSize);
        renderBody();
        target = findNavCell(nr, nc, 0);
      }
    }
    target?.focus();
  }

  /** Ctrl/Cmd+C：有选中行集时复制选中行（当前可见列）TSV；否则复制当前格文本 */
  function copyFocusedCell(cell: HTMLElement): void {
    let text: string;
    if (selectable && selected.size > 0) {
      const vis = cols();
      const rows = data.filter((r) => selected.has(keyOfRow(r)));
      text = rows
        .map((row) => vis.map((col) => tsvSafe(String(row[col.key as keyof Row] ?? ''))).join('\t'))
        .join('\n');
    } else {
      text = tsvSafe(cell.textContent ?? '');
    }
    void writeClipboard(text);
  }

  function tsvSafe(s: string): string {
    return s.replace(/[\t\r\n]+/g, ' ');
  }

  function writeClipboard(text: string): void {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
      nav.clipboard.writeText(text).catch(() => fallbackCopy(text));
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text: string): void {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch {
      /* 剪贴板不可用（非安全上下文等）：复制为尽力而为，静默放弃 */
    }
  }

  /* ═══ 表体渲染（分页切片 / 虚拟窗口；分组模式在 flatRows 上做窗口化）═══ */
  let currentTotal = 0;

  function visibleRange(total: number, avail: number): [number, number] {
    if (!virtual) {
      /* remote：total 为服务端总数，本地只有当前页切片——窗口不得超过切片长度，
         否则按 totalCount 循环取 rows[i] 直接越界（首渲即抛错） */
      if (opts.remote || opts.pagination === false) return [0, Math.min(total, avail)];
      const start = (page - 1) * pageSize;
      return [start, Math.min(total, start + pageSize)];
    }
    const viewH = scroll.clientHeight || 420;
    const overscan = 6; /* 视口上下各预渲 6 行：快速滚动不露白 */
    const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
    const end = Math.min(total, Math.ceil((scrollTop + viewH) / rowH) + overscan);
    return [start, end];
  }

  function renderBody(): void {
    /* 重建 DOM 前静默取消编辑（编辑中的行滚出视口 = 取消；提交路径自己会先摘会话） */
    if (editing) cancelEdit(true);
    const rows = pipeline();
    const entries = groupFn ? flatEntries() : null;
    /* 分组/分页/虚拟的切片单位 = flat 条目（组头行高同 data 行）；统计条数用语义上的数据行数 */
    const total = entries ? entries.length : opts.remote ? (opts.totalCount ?? data.length) : rows.length;
    /* 本地分页页码越界（setPage 超尾页 / 数据被删后只 refresh）：夹回最后一页，避免空表体 */
    if (!opts.remote && opts.pagination !== false) {
      const pages = Math.max(1, Math.ceil(total / pageSize));
      if (page > pages) page = pages;
    }
    navTotal = entries ? entries.length : rows.length;
    currentTotal = total;
    /* 虚拟模式：清空 body 会塌掉 scrollHeight 导致 scrollTop 被浏览器夹回 0，
       先记下滚动位置，重渲后恢复（恢复为同值不会再触发 scroll） */
    const keepTop = virtual ? scroll.scrollTop : 0;
    body.textContent = '';

    if (opts.loading) {
      for (let i = 0; i < Math.min(pageSize, 8); i++) {
        const sk = document.createElement('div');
        sk.className = 'icen-dt-skeleton-row';
        const bar = document.createElement('div');
        bar.className = 'icen-skeleton';
        bar.style.height = '14px';
        bar.style.width = `${88 - (i % 3) * 14}%`; /* 88/14：三档错落的伪内容宽度节奏，避免骨架齐刷刷一列 */
        sk.appendChild(bar);
        body.appendChild(sk);
      }
      renderFoot(total, rows.length);
      renderSummary();
      return;
    }

    if (total === 0) {
      const empty = document.createElement('div');
      empty.className = 'icen-dt-empty';
      empty.textContent = opts.emptyLabel ?? t('datatable.empty');
      body.appendChild(empty);
      renderFoot(total, rows.length);
      renderSummary();
      return;
    }

    const [start, end] = visibleRange(total, rows.length);
    const frag = document.createDocumentFragment();
    const offsets = frozenOffsets();
    if (virtual && start > 0) {
      const top = document.createElement('div');
      top.style.height = `${start * rowH}px`;
      frag.appendChild(top);
    }
    for (let i = start; i < end; i++) {
      if (entries) {
        const entry = entries[i]!;
        if (entry.kind === 'group') {
          frag.appendChild(makeGroupRow(entry));
          continue;
        }
        const key = keyOfRow(entry.row);
        frag.appendChild(makeRow(entry.row, i, entry.pipeIndex, key, offsets));
        if (expandable && expanded.has(key)) frag.appendChild(makeExpandRow(entry.row));
      } else {
        const row = rows[i]!;
        const key = keyOfRow(row);
        frag.appendChild(makeRow(row, i, i, key, offsets));
        if (expandable && expanded.has(key)) frag.appendChild(makeExpandRow(row));
      }
    }
    if (virtual && end < total) {
      const bottom = document.createElement('div');
      bottom.style.height = `${(total - end) * rowH}px`;
      frag.appendChild(bottom);
    }
    body.appendChild(frag);
    if (virtual) scroll.scrollTop = keepTop;
    syncNavFocus();
    renderFoot(total, rows.length);
    renderSummary();
  }

  /* ═══ 底部（统计 + 分页）═══ */
  function renderFoot(total: number, dataCount = total): void {
    foot.textContent = '';

    const stat = document.createElement('span');
    stat.className = 'icen-dt-stat';
    stat.textContent = t('datatable.totalCount', { p0: dataCount });
    foot.appendChild(stat);

    if (selectable && selected.size > 0) {
      const sel = document.createElement('span');
      sel.className = 'icen-dt-stat icen-dt-stat--sel';
      sel.textContent = t('datatable.selectedCount', { p0: selected.size });
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'icen-dt-clear-sel';
      clear.textContent = t('datatable.clear');
      clear.addEventListener('click', () => {
        selected.clear();
        emitSelection();
        renderBody();
        syncHeadState();
      });
      sel.appendChild(clear);
      foot.appendChild(sel);
    }

    if (virtual || opts.pagination === false || total <= pageSize) return;

    const pages = Math.ceil(total / pageSize);
    const pager = document.createElement('nav');
    pager.className = 'icen-dt-pager';
    pager.setAttribute('aria-label', t('datatable.paginationAria'));

    const sizeSel = document.createElement('select');
    sizeSel.className = 'icen-dt-page-size';
    sizeSel.setAttribute('aria-label', t('datatable.pageSizeAria'));
    for (const s of pageSizes) {
      const o = document.createElement('option');
      o.value = String(s);
      o.textContent = t('pagination.pageSize', { p0: s });
      if (s === pageSize) o.selected = true;
      sizeSel.appendChild(o);
    }
    sizeSel.addEventListener('change', () => {
      pageSize = Number(sizeSel.value);
      page = 1;
      emitIcen(root, 'icen:table-page-size-change', { pageSize });
      emitIcen(root, 'icen:table-page-change', { page, pageSize });
      opts.onPageSizeChange?.(pageSize);
      opts.onPageChange?.(page, pageSize);
      renderAll();
    });
    pager.appendChild(sizeSel);

    const pageBtn = (label: string, target: number, opts2: { disabled?: boolean; active?: boolean; aria?: string; icon?: string } = {}): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'icen-dt-page-btn';
      if (opts2.active) b.classList.add('is-active');
      b.disabled = opts2.disabled === true;
      if (opts2.icon) b.append(createIcon(opts2.icon)!);
      else b.textContent = label;
      if (opts2.aria) b.setAttribute('aria-label', opts2.aria);
      b.addEventListener('click', () => {
        page = target;
        emitIcen(root, 'icen:table-page-change', { page, pageSize });
        opts.onPageChange?.(page, pageSize);
        renderAll();
      });
      return b;
    };

    pager.appendChild(pageBtn('', page - 1, { icon: 'chevron-left', disabled: page <= 1, aria: t('pagination.prev') }));
    const win: number[] = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 2) win.push(p);
    }
    let last = 0;
    for (const p of win) {
      if (p - last > 1) {
        const dots = document.createElement('span');
        dots.className = 'icen-dt-page-dots';
        dots.textContent = '…';
        pager.appendChild(dots);
      }
      pager.appendChild(pageBtn(String(p), p, { active: p === page }));
      last = p;
    }
    pager.appendChild(pageBtn('', page + 1, { icon: 'chevron-right', disabled: page >= pages, aria: t('pagination.next') }));

    foot.appendChild(pager);
  }

  /* ═══ 事件与生命周期 ═══ */
  let searchTimer = 0;
  function onSearch(): void {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      search = searchInput?.value.trim() ?? '';
      emitIcen(root, 'icen:table-search-change', { query: search });
      invalidate();
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

  body.addEventListener('keydown', onBodyKeydown);
  body.addEventListener('focusin', onBodyFocusIn);

  function onDocPointerDown(ev: Event): void {
    if (!openPanel) return;
    const t = ev.target;
    if (t instanceof Node && (openPanel.el.contains(t) || headRow.contains(t) || toolbar?.contains(t))) return;
    closeFilterPanel();
  }
  document.addEventListener('pointerdown', onDocPointerDown, true);

  function onDocKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') closeFilterPanel();
  }
  document.addEventListener('keydown', onDocKeydown);

  function emitSelection(): void {
    const rows = data.filter((r) => selected.has(keyOfRow(r)));
    emitIcen(root, 'icen:table-selection-change', { selected: rows });
    opts.onSelectionChange?.(rows);
  }

  function renderAll(): void {
    if (destroyed) return;
    renderHead();
    renderBody();
    syncFrozenWidths();
  }

  rekey();
  renderAll();

  /** 外部驱动页码（remote 模式与服务端同步；本地模式也可用于「跳到第 N 页」） */
  function setPage(n: number): void {
    if (!Number.isFinite(n) || n < 1) return;
    page = Math.round(n);
    emitIcen(root, 'icen:table-page-change', { page, pageSize });
    opts.onPageChange?.(page, pageSize);
    renderAll();
  }
  function setPageSize(n: number): void {
    if (!Number.isFinite(n) || n <= 0) return;
    pageSize = Math.round(n);
    page = 1;
    emitIcen(root, 'icen:table-page-size-change', { pageSize });
    emitIcen(root, 'icen:table-page-change', { page, pageSize });
    opts.onPageSizeChange?.(pageSize);
    opts.onPageChange?.(page, pageSize);
    renderAll();
  }

  /** fr 宽（无 px 声明）冻结列的实测兜底：parsePx 对 fr 记 0，两个以上左/右冻结列
      会全部叠在 left/right:0 互相压盖。渲染入文档后实测表头格宽重算偏移并回写
      head/body/汇总行的冻结格；px 声明齐全（绝大多数用法）时零开销跳过。 */
  function hasFluidFrozen(): boolean {
    return cols().some((c) => frozenSide(c) != null
      && !/^(\d+(?:\.\d+)?)px/.test(colWidths.get(c.key) ?? c.width ?? ''));
  }
  function syncFrozenWidths(): void {
    if (!hasFluidFrozen()) return;
    const visible = cols();
    const headCells = Array.from(headRow.children) as HTMLElement[];
    const lead = headCells.length - visible.length; /* 前导选择/展开列 */
    const left = new Map<string, number>();
    const right = new Map<string, number>();
    let acc = headCells.slice(0, lead).reduce((s, c) => s + c.offsetWidth, 0);
    for (let i = 0; i < visible.length; i++) {
      const c = visible[i]!;
      if (frozenSide(c) === 'left') left.set(c.key, acc);
      acc += headCells[lead + i]?.offsetWidth ?? 0;
    }
    let accR = 0;
    for (let i = visible.length - 1; i >= 0; i--) {
      const c = visible[i]!;
      if (frozenSide(c) === 'right') right.set(c.key, accR);
      accR += headCells[lead + i]?.offsetWidth ?? 0;
    }
    const rows = [headRow, summaryEl, ...Array.from(body.querySelectorAll<HTMLElement>('.icen-dt-row'))];
    for (const row of rows) {
      const cells = Array.from(row.children) as HTMLElement[];
      if (cells.length !== headCells.length) continue; /* 分组行/展开详情行结构不同，天然无冻结格 */
      cells.forEach((cell, i) => {
        const col = i >= lead ? visible[i - lead] : undefined;
        if (!col) return;
        const l = left.get(col.key);
        if (l != null && cell.classList.contains('icen-dt-cell--frozen')) cell.style.left = `${l}px`;
        const r = right.get(col.key);
        if (r != null && cell.classList.contains('icen-dt-cell--frozen-right')) cell.style.right = `${r}px`;
      });
    }
  }

  return {
    setPage,
    setPageSize,
    setData(next) {
      if (editing) cancelEdit(true);
      data = next;
      /* 无 rowKey 时行 key = 数组下标：沿用旧 selected 等于让「下标相同的新行」凭空选中 */
      if (typeof opts.rowKey !== 'function' && typeof opts.rowKey !== 'string' && selected.size > 0) {
        selected.clear();
        emitSelection();
      }
      rekey();
      invalidate();
      page = 1;
      renderAll();
    },
    getSelected() { return data.filter((r) => selected.has(keyOfRow(r))); },
    clearSelection() { selected.clear(); emitSelection(); renderAll(); },
    setSearch(q) { search = q; if (searchInput) searchInput.value = q; invalidate(); page = 1; renderAll(); },
    setFilter(key, values) {
      if (values === null) filters.delete(key);
      else filters.set(key, new Set(values));
      invalidate();
      page = 1;
      renderAll();
    },
    setSort(key, dir = 'asc') {
      /* 单排序口径：不派 icen:table-sort-change，只回调 onSortChange */
      applySorts(key ? sanitizeSorts([{ key, dir }]) : [], dir, false);
    },
    getSorts() { return sorts.map((s) => ({ ...s })); },
    setSorts(next) { applySorts(sanitizeSorts(next ?? []), 'asc', false); },
    moveColumn,
    updateCell,
    getData() { return pipeline(); },
    exportCSV,
    showColumn(key) {
      colHidden.delete(key);
      /* show/hide 不对称是明示设计：show 需翻静态 hidden（作者预隐藏列首次显示），hide 走动态 colHidden 即可 */
      const col = opts.columns.find((c) => c.key === key);
      if (col) col.hidden = false;
      invalidate();
      renderAll();
    },
    hideColumn(key) { colHidden.set(key, true); invalidate(); renderAll(); },
    refresh() { invalidate(); renderAll(); },
    destroy() {
      destroyed = true;
      window.clearTimeout(searchTimer);
      closeFilterPanel();
      if (editing) cancelEdit(true);
      if (drag) {
        drag.off();
        drag = null;
      }
      searchInput?.removeEventListener('input', onSearch);
      if (virtual) scroll.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onDocKeydown);
      el.textContent = '';
    },
  };
}
