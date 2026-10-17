/*
 * 级联选择（cascader）+ 树选择（tree-select）组件文档 —— 文档站组件页数据。
 * 导出名 CASCADER_TREESELECT_DOCS：ComponentDoc[]（两条；slug 各为其名，scripts/slugs.mjs 已登记），
 * group '表单'；导航注册由 site/src/lib/components.ts 统一做（主会话接线）。
 * 契约源：src/behaviors/cascader.ts / tree-select.ts（头注释）+ src/components/cascader.css /
 * tree-select.css（DOM 契约头注释）。
 * script 字段是纯 JS（new Function 执行，禁 TS 语法）；模块形参名 cascaderMod / treeSelectMod。
 */
import type { ComponentDoc } from './components';

export const CASCADER_TREESELECT_DOCS: ComponentDoc[] = [
  {
    slug: 'cascader',
    summary: '在省市区、目录或分类中逐级选择一条路径。支持跨级搜索和完整键盘操作。',
    name: '级联选择',
    group: '表单',
    desc: 'createCascader 装配级联选择：路径型选择（省/市/区、类目/子类目），值 = 路径值数组。多列面板逐级展开（当前路径高亮、有子级的项带 chevron、列宽不足横向滚动），点中间级只展开、叶子才定值（changeOnSelect: true 时任意级即定值）；searchable 面板内搜索跨级过滤，命中显示完整路径（面包屑式 muted 分隔符），无命中 empty 态（emptyLabel）。键盘 → 进子级 / ← 回上级（RTL 镜像）/ ↑↓ 移动 / Enter 定值 / Esc 关闭；trigger role=combobox，列 role=listbox、项 role=option。面板 portal 到 body，尺寸走全库 PanelSizing 契约（根挂 data-icen-panel-*）。事件 icen:cascader-change { value, path }（path = 各级 label，与 onChange 双通道）；clearable 清除、disabled 置灰、同 el 重复 create 先销毁旧实例。',
    demo: `<div id="demo-cascader" style="width:100%;max-width:340px"></div>
<p class="demo-label" id="cascader-log" style="margin-top:8px">逐级选择，或搜索「深圳」直接找到完整路径。方向键移动，Enter 选择。</p>`,
    usage: `import { createCascader } from '@icen.ai/ui/kit/cascader';

const handle = createCascader(el, {
  options: [                                  // CascaderOption 树
    { value: 'zj', label: '浙江', children: [
      { value: 'hz', label: '杭州' },
      { value: 'nb', label: '宁波', disabled: true },
    ] },
  ],
  value: ['zj', 'hz'],                        // 路径值数组（初值回填，无效路径忽略）
  searchable: true,                           // 跨级过滤，命中显示完整路径
  changeOnSelect: false,                      // true = 点中间级即定值；false = 必须选到叶子
  clearable: true,
  onChange: (value, path) => {},              // 与 icen:cascader-change { value, path } 双通道
});

handle.getValue();                            // ['zj', 'hz']
handle.getPath();                             // ['浙江', '杭州']（各级 label）
handle.setValue(['zj', 'hz']);                // 程序化回填（静默）
handle.clear(); handle.open(); handle.close(); handle.destroy();`,
    behaviors: ['cascader'],
    script: `var host = document.getElementById('demo-cascader');
var logEl = document.getElementById('cascader-log');
var logDefault = logEl ? logEl.textContent : '';
var logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2600);
}

var OPTIONS = [
  { value: 'zj', label: '浙江', children: [
    { value: 'hz', label: '杭州', children: [
      { value: 'xihu', label: '西湖区' },
      { value: 'binjiang', label: '滨江区' },
    ] },
    { value: 'nb', label: '宁波' },
  ] },
  { value: 'gd', label: '广东', children: [
    { value: 'gz', label: '广州' },
    { value: 'sz', label: '深圳', children: [
      { value: 'ns', label: '南山区' },
      { value: 'ft', label: '福田区' },
    ] },
  ] },
];

var handle = cascaderMod.createCascader(host, {
  options: OPTIONS,
  searchable: true,
  clearable: true,
  changeOnSelect: false,
  onChange: function (value, path) {
    log('icen:cascader-change · ' + JSON.stringify(value) + '（' + path.join(' / ') + '）');
  },
});
host.addEventListener('icen:cascader-change', function (e) {
  /* 事件通道与 onChange 双通道同 shape：{ value: string[]; path: string[] } */
  window.__cascaderLast = e.detail;
});
return function () { clearTimeout(logTimer); handle.destroy(); };`,
  },
  {
    slug: 'tree-select',
    summary: '从组织或分类树中选择一项或多项。支持父子联动、搜索与直接移除已选项。',
    name: '树选择',
    group: '表单',
    desc: 'createTreeSelect 装配树选择：组织架构 / 权限树这类层级多选或单选。面板内嵌树（平铺行 + --depth 缩进，--lined 连接线变体）：展开/折叠 chevron，单选任意级可选（leafOnly 仅叶子），多选 + checkable 三态勾选（父 = 子集并集，混合态诚实呈现，disabled 子不进值）；multiple trigger 显示 chips（超 3 个收 +N，单项 × 悬停移除）。searchable 过滤命中自动展开祖先、命中词 <mark> 高亮，无命中 empty 态。键盘 ↑↓ 移动 / → 展开进首子 / ← 折叠回父行 / Enter 激活 / Esc 关；trigger role=combobox，树 role=tree / 行 role=treeitem（aria-level/posinset/setsize、aria-expanded/selected/checked）。面板 portal + PanelSizing 契约同 cascader。事件 icen:tree-select-change { value, labels }（与 onChange 双通道）；handle.expandAll()/collapseAll()；同 el 重复 create 先销毁旧实例。',
    demo: `<div id="demo-tree-select" style="width:100%;max-width:340px"></div>
<p class="demo-label" id="tree-select-log" style="margin-top:8px">点父整树勾选（三态联动）· 搜索「DBA」看祖先自动展开 + 命中高亮 · chips 超 3 个收 +N</p>`,
    usage: `import { createTreeSelect } from '@icen.ai/ui/kit/tree-select';

const handle = createTreeSelect(el, {
  nodes: [                                    // TreeNode 树
    { value: 'rd', label: '研发', children: [
      { value: 'fe', label: '前端' },
      { value: 'be', label: '后端' },
    ] },
  ],
  multiple: true,
  checkable: true,                            // 三态勾选（父 = 子集并集，混合态）
  searchable: true,                           // 过滤命中自动展开祖先 + mark 高亮
  leafOnly: false,                            // 单选时仅叶子可定值（默认任意级可选）
  clearable: true,
  onChange: (value, labels) => {},            // 与 icen:tree-select-change { value, labels } 双通道
});

handle.getValue();                            // ['fe', 'be']（文档序）
handle.getLabels();
handle.setValue(['fe']);                      // 程序化回填（静默）
handle.open(); handle.close();                // close 后焦点回到触发器（焦点在面板内时）
handle.clear(); handle.expandAll(); handle.collapseAll(); handle.destroy();`,
    behaviors: ['tree-select'],
    script: `var host = document.getElementById('demo-tree-select');
var logEl = document.getElementById('tree-select-log');
var logDefault = logEl ? logEl.textContent : '';
var logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2600);
}

var NODES = [
  { value: 'ceo', label: '总经理办', children: [
    { value: 'rd', label: '研发中心', children: [
      { value: 'fe', label: '前端组' },
      { value: 'be', label: '后端组' },
      { value: 'qa', label: '测试组' },
    ] },
    { value: 'ops', label: '运维中心', children: [
      { value: 'sre', label: 'SRE 组', disabled: true },
      { value: 'dba', label: 'DBA 组' },
    ] },
  ] },
  { value: 'hr', label: '人力资源' },
];

var handle = treeSelectMod.createTreeSelect(host, {
  nodes: NODES,
  multiple: true,
  checkable: true,
  searchable: true,
  clearable: true,
  onChange: function (value, labels) {
    log('icen:tree-select-change · ' + JSON.stringify(value) + '（' + labels.join('、') + '）');
  },
});
handle.expandAll();
return function () { clearTimeout(logTimer); handle.destroy(); };`,
  },
];
