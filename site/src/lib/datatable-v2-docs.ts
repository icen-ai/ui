/*
 * datatable v2 重度数据场景文档片段 —— 对齐 AG Grid 社区版核心心智（框架无关版）。
 * 覆盖六节：多列排序（multiSort + 列重排）/ 行分组聚合 / 单元格编辑 /
 * 右冻结 / 汇总行 / 键盘导航复制，各节带 demo 数据契约（mock 数据 + 接线全在本文件 script）。
 *
 * 注册方式（导航/侧栏由主会话统一处理）：本片段是 slug 'datatable' 的整页替换条目 —
 * COMPONENTS 中按 slug 找到原 datatable 条目，用 DATATABLE_V2_DOCS[0] 原地替换
 * （desc/demo/usage/behaviors/script 全量覆盖；条目形态与 kb-docs-*.ts 分片一致）。
 */
import type { ComponentDoc } from './components';

export const DATATABLE_V2_DOCS: ComponentDoc[] = [
  {
    slug: 'datatable',
    name: '数据表格',
    group: '数据展示',
    desc: '`createTable` 重度数据表格：对齐 AG Grid 社区版核心心智，零依赖函数式 API。',
    detail: {
      features: [
        '**排序**：单列 / 多列排序——Shift+点击追加次级，徽标显示优先级',
        '**列**：拖拽重排（冻结分区互不跨越）、显隐、列宽拖拽、左 / 右冻结',
        '**数据**：搜索 / 筛选 / 多选 / 分页 / 虚拟滚动 / 行展开 / 行右键 / CSV 导出',
        '**分组**：`groupBy` 行分组聚合，组头可折叠，状态跨 `setData` 保持',
        '**编辑**：`text` / `number` / `select` 单元格编辑，事件 + 回调双通道',
        '**汇总**：`summaryRow` 按筛选后数据实时重算（`sum` / `avg` / `count` 等）',
        '**键盘**：roving tabindex 方向键导航，Ctrl/Cmd+C 复制当前格或选中行（TSV）',
      ],
      notes: ['编辑提交派 `icen:table-cell-edit`，宿主调 `updateCell` 采纳或 `setData` 整体替换；管线缓存，零依赖。'],
    },
    demo: `<div class="demo-col-wide" style="width:100%">
  <p class="chart-cap">多列排序 + 列重排：Shift+点击表头追加次级排序（徽标 = 优先级序号）；拖表头换位（影子 + 插入指示线），完成派 icen:table-column-reorder</p>
  <div id="dtv-multisort"></div>
  <p class="chart-cap">行分组 + 聚合：按部门分组（组名 + 计数 + 聚合 chip），点击组头折叠派 icen:table-group-toggle，状态跨 setData 保持</p>
  <div id="dtv-group"></div>
  <p class="chart-cap">单元格编辑：双击或 Enter 进入编辑——金额列数字校验（非法值抖动不提交），状态列下拉选择；提交派 icen:table-cell-edit，宿主调 updateCell 采纳</p>
  <div id="dtv-edit"></div>
  <p class="chart-cap">右冻结 + 汇总行：操作列右固定（sticky 偏移按列宽累计）；表尾合计行钉住不滚动，按筛选后数据实时重算</p>
  <div id="dtv-frozen"></div>
  <p class="chart-cap">汇总行：summaryRow 逐列规格（sum/avg/count/min/max/label），true = 复用列 aggregate</p>
  <div id="dtv-summary"></div>
  <p class="chart-cap">键盘导航 + 复制：方向键移动焦点格（Home/End 行首末、PageUp/Down 翻屏跨页），Ctrl/Cmd+C 复制当前格或选中行集（TSV）</p>
  <div id="dtv-keys"></div>
</div>`,
    usage: `import { createTable } from '@icen.ai/ui/kit/datatable';

const table = createTable(el, {
  columns: [
    { key: 'name', title: '名称', sortable: true },
    { key: 'dept', title: '部门', sortable: true, filterable: true },
    { key: 'amount', title: '金额', sortable: true, editable: 'number', aggregate: 'sum' },
    { key: 'status', title: '状态', editable: 'select',
      editOptions: ['todo', 'doing', 'done'] },
    { key: 'ops', title: '操作', frozen: 'right', width: '120px' },  // 右冻结
  ],
  data: rows,
  rowKey: 'id',
  multiSort: true,          // Shift+点击追加次级排序；handle.getSorts()/setSorts()
  reorderable: true,        // 表头拖拽换位（冻结分区互不跨越）；handle.moveColumn(key, toIndex)
  groupBy: 'dept',          // 或 (row) => row.dept；组头聚合 chip 来自 column.aggregate
  summaryRow: { name: 'label', amount: 'sum', status: 'count' },  // 或 true
  selectable: true, searchable: true, columnVisibility: true,
  onCellEdit: (rowKey, field, value, row) => {
    // 与 icen:table-cell-edit 双通道；宿主决定是否采纳：
    table.updateCell(rowKey, field, value);   // 或整体 table.setData(next)
  },
});

table.getSorts();                        // [{ key, dir }][]——[0] 是主排序
table.setSorts([{ key: 'amount', dir: 'desc' }, { key: 'name', dir: 'asc' }]);
table.moveColumn('dept', 0);             // 列重排（含冻结分区约束）
table.updateCell('42', 'amount', 77.5);  // 采纳编辑值
table.setData(next);                     // 组折叠状态按组 key 保持

// 行内次要动作：columns.render 返回 .icen-dt-actions 包裹的 .icen-dt-action 按钮，
// 自动获得隐式显现（行悬停/聚焦）与触屏 44px 命中；可直接挂 data-icen-tooltip。`,
    behaviors: ['datatable', 'toast', 'icons'],
    script: `const createTable = datatableMod.createTable;

/* ── mock 数据契约：销售流水（跨六节复用；金额数字、状态枚举、部门分组） ── */
function makeRows() {
  const depts = ['华东', '华南', '华北'];
  const people = ['陈曦', '刘一舟', '赵之桃', '孙牧', '李蔚然', '周其', '吴越', '郑北'];
  const statuses = ['todo', 'doing', 'done'];
  const rows = [];
  for (let i = 1; i <= 36; i++) {
    rows.push({
      id: String(i),
      name: people[i % people.length],
      dept: depts[i % depts.length],
      amount: Math.round((Math.random() * 9000 + 500) * 100) / 100,
      status: statuses[i % statuses.length],
    });
  }
  return rows;
}

/* 状态列：枚举 → 语义胶囊；操作列：隐式行内动作（查看/编辑），派发事件由宿主裁决 */
const STATUS_META = {
  todo: ['待启动', ''],
  doing: ['进行中', 'icen-pill--info'],
  done: ['已完成', 'icen-pill--success'],
};
const statusCell = function (value) {
  const meta = STATUS_META[value] || [String(value ?? ''), ''];
  const pill = document.createElement('span');
  pill.className = ('icen-pill icen-pill--sm ' + meta[1]).trim();
  pill.textContent = meta[0];
  return pill;
};
const opsCell = function (value, row) {
  const wrap = document.createElement('div');
  wrap.className = 'icen-dt-actions';
  [['eye', '查看'], ['edit', '编辑']].forEach(function (pair) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icen-dt-action';
    btn.setAttribute('aria-label', pair[1] + ' ' + row.name);
    btn.setAttribute('data-icen-tooltip', pair[1]);
    btn.appendChild(iconsMod.createIcon(pair[0], { size: 14 }));
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      toastMod.toast.success(pair[1] + '：' + row.name + ' · ' + row.dept);
    });
    wrap.appendChild(btn);
  });
  return wrap;
};

const COLS = [
  { key: 'name', title: '负责人', sortable: true, width: '120px', frozen: true },
  { key: 'dept', title: '大区', sortable: true, filterable: true, width: '120px' },
  { key: 'amount', title: '金额', sortable: true, editable: 'number', aggregate: 'sum', width: '120px', align: 'right' },
  { key: 'status', title: '状态', editable: 'select', editOptions: ['todo', 'doing', 'done'], width: '120px', render: statusCell },
  { key: 'ops', title: '操作', frozen: 'right', width: '96px', render: opsCell },
];

/* ① 多列排序 + 列重排 */
const msEl = document.getElementById('dtv-multisort');
if (msEl) {
  createTable(msEl, {
    columns: COLS.map(function (c) { return Object.assign({}, c); }),
    data: makeRows(),
    rowKey: 'id',
    multiSort: true,
    reorderable: true,
    pageSize: 8,
    onSortChange: function (key, dir) { console.log('[multisort]', key, dir); },
  });
}

/* ② 行分组 + 聚合（组头金额 = 组内 sum；折叠状态跨 setData 保持） */
const gEl = document.getElementById('dtv-group');
if (gEl) {
  const g = createTable(gEl, {
    columns: [
      { key: 'name', title: '负责人', width: '120px' },
      { key: 'dept', title: '大区', width: '120px' },
      { key: 'amount', title: '金额', aggregate: 'sum', width: '120px', align: 'right' },
      { key: 'status', title: '状态', width: '120px', render: statusCell },
    ],
    data: makeRows(),
    rowKey: 'id',
    groupBy: 'dept',
    pageSize: 8,
  });
  window.__dtvGroup = g; /* 控制台可玩：g.setData(makeRows()) 看组折叠状态保持 */
}

/* ③ 单元格编辑：提交经 icen:table-cell-edit + onCellEdit 双通道，宿主调 updateCell 采纳 */
const eEl = document.getElementById('dtv-edit');
if (eEl) {
  const et = createTable(eEl, {
    columns: COLS.map(function (c) { return Object.assign({}, c); }),
    data: makeRows(),
    rowKey: 'id',
    pageSize: 8,
    onCellEdit: function (rowKey, field, value, row) {
      console.log('[cell-edit]', rowKey, field, value, row.name);
      et.updateCell(rowKey, field, value);   /* 宿主裁决：采纳（或拒绝不调用） */
    },
  });
}

/* ④ 右冻结 + 汇总行（筛选/搜索后口径实时重算；'label' 列显示「合计」） */
const fEl = document.getElementById('dtv-frozen');
if (fEl) {
  createTable(fEl, {
    columns: COLS.map(function (c) { return Object.assign({}, c); }),
    data: makeRows(),
    rowKey: 'id',
    searchable: true,
    columnVisibility: true,
    summaryRow: { name: 'label', amount: 'sum', status: 'count' },
    pageSize: 8,
  });
}

/* ⑤ 汇总行：summaryRow: true 复用列 aggregate（金额 sum / 状态 count） */
const sEl = document.getElementById('dtv-summary');
if (sEl) {
  createTable(sEl, {
    columns: [
      { key: 'name', title: '负责人', width: '120px' },
      { key: 'dept', title: '大区', width: '120px' },
      { key: 'amount', title: '金额', sortable: true, aggregate: 'sum', width: '120px', align: 'right' },
      { key: 'status', title: '状态', aggregate: 'count', width: '120px', render: statusCell },
    ],
    data: makeRows(),
    rowKey: 'id',
    summaryRow: true,
    pageSize: 8,
  });
}

/* ⑥ 键盘导航 + 复制：点任意数据格后方向键走动；Ctrl/Cmd+C 复制（有勾选时复制行集 TSV） */
const kEl = document.getElementById('dtv-keys');
if (kEl) {
  createTable(kEl, {
    columns: COLS.map(function (c) { return Object.assign({}, c); }),
    data: makeRows(),
    rowKey: 'id',
    selectable: true,
    pageSize: 8,
  });
}`,
  },
];
