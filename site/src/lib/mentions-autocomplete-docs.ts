/*
 * mentions / autocomplete 组件文档分片 —— 表单族两个 create 型输入增强。
 * 导出名与签名对照 src/behaviors/{mentions,autocomplete}.ts；
 * 事件 icen:mention-select / icen:autocomplete-select / icen:autocomplete-change
 * 已登记 events.ts IcenEventMap。导航/侧栏注册由 components.ts 统一处理（本文件仅数据）。
 */
import type { ComponentDoc } from './components';

export const MENTIONS_AUTOCOMPLETE_DOCS: ComponentDoc[] = [
  {
    slug: 'mentions',
    name: '提及输入',
    group: '表单',
    desc: 'createMentions(el, opts)：textarea 输入 @query（行首/空白后触发，中文 IME 组合态安全——composition 期间挂起检测）弹出候选面板；↑↓ 循环（跳过 disabled）、Enter 选中、Esc 关层。选中把 @query 替换为 @label（尾随空格）并 track 进 mentions 数组，文本里消失的标签自动摘除（诚实一致性）。source 同步/异步皆可（过滤在 source 侧），异步带加载占位（opts.loadingLabel）+ 竞态守卫只渲染最新 query。面板 portal 到 body，尺寸走 PanelSizing（data-icen-panel-*），选中派 icen:mention-select { id, label, query }。',
    demo: `<div class="demo-col" style="width:100%">
  <div class="icen-mentions" id="demo-mentions" style="width:100%">
    <textarea class="icen-input" rows="3" placeholder="输入 @ 提及成员，试试 @ali 或 @小明"></textarea>
  </div>
  <p class="demo-label" id="mentions-log" style="margin-top:8px">选中提及 → 事件回显；删掉文本里的标签，track 数组同步摘除</p>
</div>`,
    usage: `import { createMentions } from '@icen.ai/ui/kit/mentions';

const handle = createMentions(el, {          // el = 包装容器（内含 textarea.icen-input）或 textarea 直元素
  source: (query) => searchMembers(query),   // 过滤在 source 侧；同步数组或 Promise
  trigger: '@',      // 触发字符（默认 '@'）
  max: 8,            // 面板最多条数
  minChars: 0,       // 触发所需最少查询字符（0 = 输入 @ 即出）
  debounceMs: 160,
  loadingLabel: '加载中…',
  onSelect: (item) => console.log(item.id, item.label),
});
// 事件通道（textarea 上）：icen:mention-select { id, label, query }

handle.getMentions();  // 当前 track 的提及（随文本实时摘除失效项）
handle.destroy();`,
    behaviors: ['mentions'],
    script: `var host = document.getElementById('demo-mentions');
var logEl = document.getElementById('mentions-log');
var logDefault = logEl ? logEl.textContent : '';
var logTimer = null;
function logMsg(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2600);
}
var MEMBERS = [
  { id: 'u1', label: 'alice', keywords: 'ali 艾丽丝' },
  { id: 'u2', label: 'alina' },
  { id: 'u3', label: 'bob' },
  { id: 'u4', label: 'carol', disabled: true },
  { id: 'u5', label: '小明', keywords: 'xiaoming' },
];
mentionsMod.createMentions(host, {
  source: function (q) {
    var query = q.toLowerCase();
    return MEMBERS.filter(function (m) {
      return m.label.toLowerCase().indexOf(query) >= 0 || (m.keywords || '').toLowerCase().indexOf(query) >= 0;
    });
  },
  onSelect: function (item) { logMsg('onSelect → @' + item.label + '（id=' + item.id + '）'); },
});
host.querySelector('textarea').addEventListener('icen:mention-select', function (e) {
  logMsg('icen:mention-select → ' + JSON.stringify(e.detail));
});`,
  },
  {
    slug: 'autocomplete',
    name: '自动补全',
    group: '表单',
    desc: 'createAutocomplete(el, opts)：WAI combobox 完整模式（input role=combobox + aria-expanded/controls/activedescendant，面板 role=listbox）；↑↓ 循环、Enter 选中（先派 icen:autocomplete-select { value, label } 再派 change）、Esc 关层还原、Tab 走默认。命中片段 <mark> 高亮；异步竞态守卫只渲染最新 query（加载期保留旧列表）；空结果态（opts.noResultsLabel）。freeSolo=true 失焦落定任意输入（只派 change），false（默认）失焦无选中回退原值。候选 = string 或 { value, label }，renderItem 可定制渲染。面板与输入框同宽，尺寸走 PanelSizing。',
    demo: `<div class="demo-col" style="width:100%">
  <div class="icen-input-wrap icen-control" style="width:100%"><input class="icen-input" id="demo-autocomplete-input" placeholder="输入水果名，试试 ap 或 AN" /></div>
  <p class="demo-label" id="autocomplete-log" style="margin-top:8px">↑↓ 选择 · Enter 选中（select + change 双事件）· Esc 还原 · 失焦无选中回退</p>
</div>`,
    usage: `import { createAutocomplete } from '@icen.ai/ui/kit/autocomplete';

const handle = createAutocomplete(input, {   // input.icen-input
  source: (query) => fetchSuggestions(query), // string[] 或 { value, label }[]；同步/Promise
  minChars: 1, debounceMs: 160, maxItems: 8,
  freeSolo: false,   // true = 失焦落定任意输入（只派 change）；false = 失焦无选中回退原值
  // renderItem: (item, query) => Node | string,
  // noResultsLabel: '无匹配结果',
});
input.addEventListener('icen:autocomplete-select', (e) => e.detail); // { value, label }
input.addEventListener('icen:autocomplete-change', (e) => e.detail); // { value }

handle.getValue(); handle.setValue('v'); handle.open(); handle.close(); handle.destroy();`,
    behaviors: ['autocomplete'],
    script: `var input = document.getElementById('demo-autocomplete-input');
var logEl = document.getElementById('autocomplete-log');
var logDefault = logEl ? logEl.textContent : '';
var logTimer = null;
function logMsg(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2600);
}
var FRUITS = ['apple 苹果', 'apricot 杏子', 'banana 香蕉', 'blueberry 蓝莓', 'cherry 樱桃'];
autocompleteMod.createAutocomplete(input, {
  source: function (q) {
    var query = q.toLowerCase();
    return FRUITS.filter(function (f) { return f.toLowerCase().indexOf(query) >= 0; });
  },
});
input.addEventListener('icen:autocomplete-select', function (e) {
  logMsg('select → ' + JSON.stringify(e.detail));
});
input.addEventListener('icen:autocomplete-change', function (e) {
  logMsg('change → ' + JSON.stringify(e.detail));
});`,
  },
];
