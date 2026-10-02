/*
 * @icen.ai/ui — Behavior: kb-qa（认证问答对编辑器：两列表格行内编辑，与 components/kb-ingest.css 配套）
 *
 * DOM 契约（docs/spec/kb-family.md §5.10）：
 *   <div class="kb-qa">
 *     <div class="kb-qa-bar">
 *       <span class="kb-qa-hint kb-meta">CSV 模板：question,answer（每行一对，UTF-8）</span>
 *       <button type="button" class="kb-btn" data-kb-qa-import>导入 CSV</button>
 *       <button type="button" class="kb-btn" data-kb-qa-add>+ 新增</button>
 *     </div>
 *     <table class="kb-qa-table">
 *       <thead><tr><th>问题</th><th>答案</th><th></th></tr></thead>
 *       <tbody>
 *         <tr class="kb-qa-row" data-index="0">
 *           <td class="kb-qa-q" contenteditable="true" data-kb-qa-field="question" data-original="…">…</td>
 *           <td class="kb-qa-a" contenteditable="true" data-kb-qa-field="answer" data-original="…">…</td>
 *           <td class="kb-qa-ops"><button class="kb-btn" data-kb-qa-remove>删除</button></td>
 *         </tr>…
 *         [空态行 .kb-qa-empty（colSpan 3）]
 *       </tbody>
 *     </table>
 *   </div>
 *
 * 行为：
 *   - renderKbQa(el, rows, opts?)：快照渲染，返回挂载容器 el（SSR 原样返回）。
 *     opts.importSource 覆盖导入事件 detail 的 source（缺省 'csv'）。
 *   - initKbQa(root?)：幂等（scope.__icenKbQaInit）+ 返回销毁函数，root 缺省 document 级委托：
 *     · 单元格 contenteditable 行内编辑（focusout 且内容变化才提交）
 *       → icen:kb-qa-change { op:'edit', index }（index = 行 data-index）
 *     · 新增（本地追加空行并聚焦问题格）→ icen:kb-qa-change { op:'add', index }
 *     · 删除（先派事件再本地删行，其后行 data-index 顺位重排）
 *       → icen:kb-qa-change { op:'remove', index }（index = 被删行原序号）
 *     · 导入 → icen:kb-qa-import { source }（CSV 模板示意由 hint 行承担）
 *   - 渲染只写 textContent / createElement；SVG 过 kb-core svgIcon() 消毒。
 */

import { h, svgIcon } from './kb-core';
import { emitIcen } from './events';

/* ── 域内小工具 ── */

const svg = (d: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON_IMPORT = svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>');
const ICON_PLUS = svg('<path d="M5 12h14"/><path d="M12 5v14"/>');

function icon(parent: HTMLElement, svgStr: string): void {
  const node = svgIcon(svgStr);
  if (node) parent.appendChild(node);
}

/** QA 对（认证问答资产：数据域 success 语义的最小单元） */
export interface KbQaRow {
  question: string;
  answer: string;
}

/** renderKbQa 选项 */
export interface KbQaOpts {
  /** 导入事件 detail.source（缺省 'csv'） */
  importSource?: string;
  /** 空态文案 */
  emptyText?: string;
}

/* ── 构建 ── */

function buildQaCell(field: 'question' | 'answer', text: string): HTMLElement {
  const td = h('td', field === 'question' ? 'kb-qa-q' : 'kb-qa-a', text);
  td.contentEditable = 'true';
  td.dataset.kbQaField = field;
  td.dataset.original = text;
  td.setAttribute('role', 'textbox');
  td.setAttribute('aria-label', field === 'question' ? '问题' : '答案');
  return td;
}

function buildQaRow(row: KbQaRow, index: number): HTMLElement {
  const tr = h('tr', 'kb-qa-row');
  tr.dataset.index = String(index);
  tr.appendChild(buildQaCell('question', row?.question ?? ''));
  tr.appendChild(buildQaCell('answer', row?.answer ?? ''));
  const ops = h('td', 'kb-qa-ops');
  const rm = h('button', 'kb-btn');
  rm.type = 'button';
  rm.dataset.kbQaRemove = '';
  rm.textContent = '删除';
  rm.setAttribute('aria-label', `删除第 ${index + 1} 行`);
  ops.appendChild(rm);
  tr.appendChild(ops);
  return tr;
}

/* ── 渲染 ── */

/**
 * 渲染 QA 对两列表格（快照：整树重建后返回挂载容器 el）。
 * 行内 contenteditable 编辑由 initKbQa 接线；空数组给空态行（新增钮仍在）。
 * SSR（无 document）下原样返回 el。
 */
export function renderKbQa(el: HTMLElement, rows: KbQaRow[], opts?: KbQaOpts): HTMLElement {
  if (typeof document === 'undefined') return el;
  const o = opts ?? {};
  const list = Array.isArray(rows) ? rows : [];
  el.textContent = '';

  const root = h('div', 'kb-qa');
  const bar = h('div', 'kb-qa-bar');
  bar.appendChild(h('span', 'kb-qa-hint kb-meta', 'CSV 模板：question,answer（每行一对，UTF-8）'));
  const importBtn = h('button', 'kb-btn');
  importBtn.type = 'button';
  importBtn.dataset.kbQaImport = '';
  icon(importBtn, ICON_IMPORT);
  importBtn.appendChild(document.createTextNode('导入 CSV'));
  importBtn.dataset.importSource = o.importSource ?? 'csv';
  bar.appendChild(importBtn);
  const addBtn = h('button', 'kb-btn');
  addBtn.type = 'button';
  addBtn.dataset.kbQaAdd = '';
  icon(addBtn, ICON_PLUS);
  addBtn.appendChild(document.createTextNode('新增'));
  bar.appendChild(addBtn);
  root.appendChild(bar);

  const table = document.createElement('table');
  table.className = 'kb-qa-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['问题', '答案', ''].forEach((label) => headRow.appendChild(h('th', 'kb-qa-th', label)));
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  if (!list.length) {
    const tr = h('tr', 'kb-qa-empty-row');
    const td = h('td', 'kb-qa-empty', o.emptyText ?? '暂无认证问答对');
    td.colSpan = 3;
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    list.forEach((r, i) => tbody.appendChild(buildQaRow(r, i)));
  }
  table.appendChild(tbody);
  root.appendChild(table);
  el.appendChild(root);
  return el;
}

/* ── 交互 ── */

interface QaScope extends ParentNode {
  __icenKbQaInit?: boolean;
}

/** 删除后顺位重排（保持 data-index 与可视序一致，后续 edit/remove 事件索引稳定） */
function renumberRows(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.kb-qa-row[data-index]').forEach((row, i) => {
    row.dataset.index = String(i);
  });
}

/**
 * 接线 QA 对行内编辑 / 增删行 / 导入（scope 级事件委托，重复调用幂等）。
 * root 缺省 document：页面一次 init 即接管后续插入的 QA 表。
 * 返回销毁函数：摘除委托并复位幂等标记，销毁后可重新 initKbQa。SSR 下 no-op。
 */
export function initKbQa(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as QaScope;
  if (marked.__icenKbQaInit) return () => undefined;
  marked.__icenKbQaInit = true;
  const target = scope as ParentNode & EventTarget;

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;

    /* 导入（source 透传 detail） */
    const importBtn = t.closest<HTMLElement>('[data-kb-qa-import]');
    if (importBtn) {
      emitIcen(importBtn, 'icen:kb-qa-import', { source: importBtn.dataset.importSource ?? 'csv' });
      return;
    }

    /* 新增：本地追加空行 + 聚焦问题格 */
    const addBtn = t.closest<HTMLElement>('[data-kb-qa-add]');
    if (addBtn) {
      const rootEl = addBtn.closest<HTMLElement>('.kb-qa');
      const tbody = rootEl?.querySelector('tbody');
      if (!rootEl || !tbody) return;
      const empty = tbody.querySelector<HTMLElement>('.kb-qa-empty-row');
      if (empty) empty.remove();
      const rows = tbody.querySelectorAll<HTMLElement>('.kb-qa-row').length;
      const tr = buildQaRow({ question: '', answer: '' }, rows);
      tbody.appendChild(tr);
      tr.querySelector<HTMLElement>('.kb-qa-q')?.focus();
      emitIcen(rootEl, 'icen:kb-qa-change', { op: 'add', index: rows });
      return;
    }

    /* 删除：先派事件（带原序号）再删行 + 重排 */
    const rm = t.closest<HTMLElement>('[data-kb-qa-remove]');
    if (rm) {
      const row = rm.closest<HTMLElement>('.kb-qa-row[data-index]');
      const rootEl = rm.closest<HTMLElement>('.kb-qa');
      if (!row || !rootEl) return;
      const index = Number(row.dataset.index ?? '0');
      emitIcen(row, 'icen:kb-qa-change', { op: 'remove', index });
      row.remove();
      renumberRows(rootEl);
    }
  };

  /* 行内编辑提交（focusout 且内容变化） */
  const onFocusOut = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.hasAttribute('data-kb-qa-field')) return;
    const row = t.closest<HTMLElement>('.kb-qa-row[data-index]');
    if (!row) return;
    const next = t.textContent ?? '';
    if (next === (t.dataset.original ?? '')) return;
    t.dataset.original = next;
    emitIcen(row, 'icen:kb-qa-change', { op: 'edit', index: Number(row.dataset.index ?? '0') });
  };

  target.addEventListener('click', onClick);
  target.addEventListener('focusout', onFocusOut);
  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('focusout', onFocusOut);
    marked.__icenKbQaInit = false;
  };
}
