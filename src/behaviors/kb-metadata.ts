/*
 * @icen.ai/ui — Behavior: kb-metadata（元数据管理：字段定义 + 值绑定，与 components/kb-ingest.css 配套）
 *
 * DOM 契约（docs/spec/kb-family.md §5.9）：
 *   <div class="kb-metadata">
 *     <table class="kb-metadata-table">
 *       <thead><tr><th>字段</th><th>类型</th><th>值</th><th></th></tr></thead>
 *       <tbody>
 *         <tr class="kb-metadata-row [is-builtin]" data-key="title">
 *           <td class="kb-metadata-key">title <span class="kb-metadata-builtin-flag">内置</span></td>
 *           <td><span class="kb-badge kb-metadata-type">string</span></td>
 *           <td class="kb-metadata-value">
 *             builtin → 只读 span；自定义 → <input class="kb-input" data-kb-metadata-bind value="…">
 *           </td>
 *           <td class="kb-metadata-ops">
 *             <button class="kb-btn" data-kb-metadata-remove>移除</button>   <!-- builtin 行不渲染 -->
 *           </td>
 *         </tr>…
 *       </tbody>
 *     </table>
 *     <div class="kb-metadata-new">
 *       <input class="kb-input kb-input--mono kb-metadata-new-key" placeholder="字段名，如 department">
 *       <div class="kb-seg kb-metadata-type-pick" role="radiogroup">       ← kb 域自持 segmented
 *         <button class="kb-seg-item [is-active]" role="radio" data-value="string">string</button>
 *         <button class="kb-seg-item" role="radio" data-value="number">number</button>
 *         <button class="kb-seg-item" role="radio" data-value="time">time</button>
 *       </div>
 *       <button class="kb-btn" data-kb-metadata-define>新增字段</button>
 *     </div>
 *   </div>
 *
 * 行为：
 *   - renderKbMetadata(el, { fields, values })：快照渲染，返回挂载容器 el（SSR 原样返回）。
 *     字段定义表带类型徽标（string/number/time）；builtin 字段的值只读、不可移除。
 *   - initKbMetadata(root?)：幂等（scope.__icenKbMetadataInit）+ 返回销毁函数，
 *     root 缺省 document 级委托，三类动作全部派 icen:kb-metadata-change { action, key }：
 *     · 值绑定（input change）       → action='bind'
 *     · 新增字段（key 非空才生效：本地追加行 + 清空输入；空 key 标 aria-invalid）→ action='define'
 *     · 移除字段（本地删行）         → action='remove'
 *   - 渲染只写 textContent / createElement；无 SVG 无图标，纯结构。
 */

import { h } from './kb-core';
import { emitIcen } from './events';

/** 字段类型（徽标呈现；time = 日期时间口径） */
export type KbMetadataType = 'string' | 'number' | 'time';

/** 字段定义（builtin = 系统内置字段：值只读、不可移除） */
export interface KbMetadataField {
  key: string;
  type: KbMetadataType;
  builtin?: boolean;
  /** 展示名（缺省用 key） */
  label?: string;
}

/** renderKbMetadata 数据模型 */
export interface KbMetadataModel {
  fields: KbMetadataField[];
  values: Record<string, string | number>;
}

const TYPES: KbMetadataType[] = ['string', 'number', 'time'];

/* ── 构建 ── */

function buildRow(field: KbMetadataField, value: string | number | undefined): HTMLElement {
  const row = h('tr', `kb-metadata-row${field.builtin ? ' is-builtin' : ''}`);
  row.dataset.key = field.key;

  const keyTd = h('td', 'kb-metadata-key');
  keyTd.textContent = field.key;
  if (field.label && field.label !== field.key) {
    keyTd.appendChild(document.createTextNode(' '));
    keyTd.appendChild(h('span', 'kb-metadata-key-label', field.label));
  }
  if (field.builtin) keyTd.appendChild(h('span', 'kb-metadata-builtin-flag', '内置'));
  row.appendChild(keyTd);

  const typeTd = h('td');
  typeTd.appendChild(h('span', `kb-badge kb-metadata-type is-${field.type}`, field.type));
  row.appendChild(typeTd);

  const valueTd = h('td', 'kb-metadata-value');
  if (field.builtin) {
    valueTd.appendChild(h('span', 'kb-metadata-readonly', value != null ? String(value) : '—'));
  } else {
    const input = h('input', 'kb-input kb-metadata-bind');
    input.type = field.type === 'number' ? 'number' : 'text';
    input.value = value != null ? String(value) : '';
    input.dataset.kbMetadataBind = '';
    input.setAttribute('aria-label', `${field.key} 的值`);
    valueTd.appendChild(input);
  }
  row.appendChild(valueTd);

  const opsTd = h('td', 'kb-metadata-ops');
  if (!field.builtin) {
    const rm = h('button', 'kb-btn');
    rm.type = 'button';
    rm.dataset.kbMetadataRemove = '';
    rm.textContent = '移除';
    rm.setAttribute('aria-label', `移除字段 ${field.key}`);
    opsTd.appendChild(rm);
  }
  row.appendChild(opsTd);
  return row;
}

function buildNewRow(): HTMLElement {
  const bar = h('div', 'kb-metadata-new');
  const keyInput = h('input', 'kb-input kb-input--mono kb-metadata-new-key');
  keyInput.type = 'text';
  keyInput.placeholder = '字段名，如 department';
  keyInput.dataset.kbMetadataNewKey = '';
  keyInput.setAttribute('aria-label', '新字段名');
  bar.appendChild(keyInput);

  const pick = h('div', 'kb-seg kb-metadata-type-pick');
  pick.setAttribute('role', 'radiogroup');
  pick.setAttribute('aria-label', '新字段类型');
  TYPES.forEach((t, i) => {
    const item = h('button', `kb-seg-item kb-metadata-type-item${i === 0 ? ' is-active' : ''}`);
    item.type = 'button';
    item.setAttribute('role', 'radio');
    item.setAttribute('aria-checked', String(i === 0));
    item.dataset.value = t;
    item.textContent = t;
    pick.appendChild(item);
  });
  bar.appendChild(pick);

  const define = h('button', 'kb-btn');
  define.type = 'button';
  define.dataset.kbMetadataDefine = '';
  define.textContent = '新增字段';
  bar.appendChild(define);
  return bar;
}

/* ── 渲染 ── */

/**
 * 渲染元数据字段定义表 + 新增行（快照：整树重建后返回挂载容器 el）。
 * builtin 字段值只读；自定义字段值为可编辑 input。SSR（无 document）下原样返回 el。
 */
export function renderKbMetadata(el: HTMLElement, model: KbMetadataModel): HTMLElement {
  if (typeof document === 'undefined') return el;
  const fields = Array.isArray(model?.fields) ? model.fields : [];
  const values = model?.values ?? {};
  el.textContent = '';

  const root = h('div', 'kb-metadata');
  const table = document.createElement('table');
  table.className = 'kb-metadata-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['字段', '类型', '值', ''].forEach((label) => headRow.appendChild(h('th', 'kb-metadata-th', label)));
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  if (!fields.length) {
    const emptyRow = h('tr', 'kb-metadata-empty-row');
    const td = h('td', 'kb-metadata-empty', '暂无元数据字段');
    td.colSpan = 4;
    emptyRow.appendChild(td);
    tbody.appendChild(emptyRow);
  } else {
    fields.forEach((f) => tbody.appendChild(buildRow(f, values[f.key])));
  }
  table.appendChild(tbody);
  root.appendChild(table);
  root.appendChild(buildNewRow());
  el.appendChild(root);
  return el;
}

/* ── 交互 ── */

interface MetadataScope extends ParentNode {
  __icenKbMetadataInit?: boolean;
}

/** 新增字段后本地追加的空值行（与 buildRow 同构；type 从选中项读） */
function appendDefinedRow(root: HTMLElement, key: string, type: KbMetadataType): void {
  const tbody = root.querySelector('tbody');
  if (!tbody) return;
  const empty = tbody.querySelector<HTMLElement>('.kb-metadata-empty-row');
  if (empty) empty.remove();
  tbody.appendChild(buildRow({ key, type }, ''));
}

/**
 * 接线元数据编辑（scope 级事件委托，重复调用幂等）。
 * 值绑定 / 新增字段 / 移除字段统一派 icen:kb-metadata-change { action, key }；
 * define/remove 同时做本地 DOM 更新（直接操纵纪律），消费方可凭事件重渲染纠偏。
 * root 缺省 document。返回销毁函数（复位幂等标记，可重新 init）。SSR 下 no-op。
 */
export function initKbMetadata(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as MetadataScope;
  if (marked.__icenKbMetadataInit) return () => undefined;
  marked.__icenKbMetadataInit = true;
  const target = scope as ParentNode & EventTarget;

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;

    /* 移除字段：先派事件（行仍在树上可冒泡）再本地删行；builtin 行无按钮天然不可达 */
    const rm = t.closest<HTMLElement>('[data-kb-metadata-remove]');
    if (rm) {
      const row = rm.closest<HTMLElement>('.kb-metadata-row[data-key]');
      if (!row) return;
      const key = row.dataset.key ?? '';
      emitIcen(row, 'icen:kb-metadata-change', { action: 'remove', key });
      row.remove();
      return;
    }

    /* 新增字段：空 key 标 aria-invalid 不动作；成功则本地追加行 + 清空输入 */
    const define = t.closest<HTMLElement>('[data-kb-metadata-define]');
    if (define) {
      const root2 = define.closest<HTMLElement>('.kb-metadata');
      const keyInput = root2?.querySelector<HTMLInputElement>('[data-kb-metadata-new-key]');
      if (!root2 || !keyInput) return;
      const key = keyInput.value.trim();
      if (!key) {
        keyInput.setAttribute('aria-invalid', 'true');
        return;
      }
      keyInput.removeAttribute('aria-invalid');
      const active = root2.querySelector<HTMLElement>('.kb-metadata-type-item.is-active');
      const type = (TYPES as string[]).includes(active?.dataset.value ?? '')
        ? active?.dataset.value as KbMetadataType
        : 'string';
      appendDefinedRow(root2, key, type);
      keyInput.value = '';
      emitIcen(root2, 'icen:kb-metadata-change', { action: 'define', key });
      return;
    }

    /* 新字段类型切换（kb 域自持 segmented 互斥） */
    const typeItem = t.closest<HTMLElement>('.kb-metadata-type-item');
    if (typeItem) {
      const seg = typeItem.closest<HTMLElement>('.kb-metadata-type-pick');
      if (!seg || typeItem.classList.contains('is-active')) return;
      seg.querySelectorAll<HTMLElement>('.kb-metadata-type-item').forEach((it) => {
        const on = it === typeItem;
        it.classList.toggle('is-active', on);
        it.setAttribute('aria-checked', String(on));
      });
    }
  };

  /* 值绑定：input change（blur/Enter 均触发 change） */
  const onChange = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.hasAttribute('data-kb-metadata-bind')) return;
    const row = t.closest<HTMLElement>('.kb-metadata-row[data-key]');
    if (row) emitIcen(row, 'icen:kb-metadata-change', { action: 'bind', key: row.dataset.key ?? '' });
  };

  target.addEventListener('click', onClick);
  target.addEventListener('change', onChange);
  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('change', onChange);
    marked.__icenKbMetadataInit = false;
  };
}
