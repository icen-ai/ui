/*
 * @icen.ai/ui — Behavior: kb-filter（过滤器构建器，与 components/kb-search.css 配套）
 *
 * DOM 契约（create 装配，规格 docs/spec/kb-family.md §5.12）：
 *   <div class="icen-kb-filter" data-icen-kb-filter>
 *     <div class="kb-filter-tree">
 *       <div class="icen-kb-filter-group" data-icen-depth="0">
 *         <div class="icen-kb-filter-head">
 *           <button class="icen-kb-filter-op-toggle [.is-or]" data-icen-op="and|or">AND</button>
 *           <button class="icen-kb-filter-act" data-icen-act="add-rule">+ 规则</button>
 *           <button class="icen-kb-filter-act" data-icen-act="add-group" [disabled]>+ 组</button>
 *           [<button class="icen-kb-filter-act is-danger" data-icen-act="del-group">删除组</button>]  ← 仅嵌套组
 *         </div>
 *         <div class="icen-kb-filter-body">
 *           <div class="icen-kb-filter-rule">
 *             <icen-input class="icen-kb-filter-field" icen-list="…" placeholder="字段" />
 *             <icen-select class="icen-kb-filter-op">等于/不等于/大于/大于等于/小于/小于等于/属于/包含/存在</icen-select>
 *             <icen-input class="icen-kb-filter-value" placeholder="值（属于用逗号分隔）" [disabled] />
 *             <button class="icen-kb-filter-act is-danger" data-icen-act="del-rule">×</button>
 *           </div>…
 *           [<div class="icen-kb-filter-group" data-icen-depth="1|2">…递归…</div>]…
 *         </div>
 *       </div>
 *     </div>
 *     <div class="icen-kb-filter-dsl">
 *       <div class="icen-kb-filter-dsl-bar">
 *         <button class="icen-kb-filter-dsl-tab [.is-active]" data-icen-dsl="mongo">Mongo</button>
 *         <button class="icen-kb-filter-dsl-tab" data-icen-dsl="odata">OData</button>
 *         <button class="icen-kb-filter-act icen-kb-filter-dsl-copy">复制</button>
 *       </div>
 *       <code class="icen-kb-filter-dsl-text icen-kb-meta">…序列化镜像（可复制）…</code>
 *     </div>
 *   </div>
 *
 * 行为：
 *   - DOM 即状态：rule 行（字段/操作符/值）与组行（AND/OR）的全部编辑直接落在输入控件上，
 *     get()/serialize()/事件负载随时从 DOM 树解析（KbFilterNode），无并行状态漂移。
 *   - 组嵌套 ≤2 层（根组 depth 0 → 1 → 2；depth 2 的「+ 组」禁用——超出禁用增钮不隐藏）。
 *   - DSL 镜像：filterToMongo 的 JSON 与 filterToOData 字符串 tab 切换，mono 可复制。
 *   - 任意变更（增删/切换/输入）→ 派 icen:kb-filter-change {node, valid} 并回调
 *     opts.onChange；valid = 全部 rule 字段非空（空构建器 = 无过滤 = valid）。
 *     node 为有效投影（空字段 rule 在 normalizeFilterNode 中被丢弃——DSL 只镜像可发送的规则）。
 *   - 值解析：属于（in）按逗号拆分为数组；纯数字串解析为 number；存在（exists）值输入禁用。
 *   - SSR 下 no-op（stub 句柄）；同元素重复 create 幂等；destroy 摘监听并清空。
 * 渲染纪律：只写 textContent/createElement，禁 innerHTML；SVG 经 kb-core svgIcon 消毒。
 */

import { h, normalizeFilterNode, filterToMongo, filterToOData, KB_FILTER_OPS, type KbFilterNode, type KbFilterOp } from './kb-core';
import { emitIcen } from './events';
import { t } from './i18n';

/* ══════════════ 类型 ══════════════ */

/** createKbFilter 配置项 */
export interface KbFilterOpts {
  /** 初始过滤树（null/空 = 无过滤；裸 rule 会被包进根组） */
  node?: KbFilterNode | null;
  /** 变更回调（与 icen:kb-filter-change 双通道） */
  onChange?: (node: KbFilterNode | null, valid: boolean) => void;
  /** 字段建议列表（渲染为 datalist；仍可自由输入） */
  fields?: string[];
}

/** createKbFilter 返回的可操作句柄 */
export interface KbFilterHandle {
  /** 当前过滤树（有效投影；空构建器返回 null） */
  get(): KbFilterNode | null;
  /** 整体重设（快照重建 DOM 树） */
  set(node: KbFilterNode | null): void;
  /** 序列化：mongo → JSON 字符串；odata → OData $filter 字符串 */
  serialize(kind: 'mongo' | 'odata'): string;
  /** 销毁：摘除监听、清空装配内容、复位幂等标记 */
  destroy(): void;
}

interface MarkedFilterEl extends HTMLElement {
  __icenKbFilter?: KbFilterHandle;
}

/* ══════════════ 常量 ══════════════ */

/** 组嵌套深度上限（根组 depth 0；depth≥2 不再允许加子组） */
const MAX_GROUP_DEPTH = 2;

const OP_LABELS: Record<KbFilterOp, string> = {
  eq: t('kbFilter.opEq'), ne: t('kbFilter.opNe'), gt: t('kbFilter.opGt'), gte: t('kbFilter.opGte'), lt: t('kbFilter.opLt'), lte: t('kbFilter.opLte'),
  in: t('kbFilter.opIn'), contains: t('kbFilter.opContains'), exists: t('kbFilter.opExists'),
};

let fieldListSeq = 0;

/* ══════════════ 工具 ══════════════ */

function numOrStr(s: string): string | number {
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
}

/** 值输入 → AST 值（in 拆数组；exists 恒 true；纯数字转 number；空 → undefined） */
function parseValue(raw: string, op: KbFilterOp): string | number | boolean | Array<string | number> | undefined {
  if (op === 'exists') return true;
  const t = raw.trim();
  if (!t) return undefined;
  if (op === 'in') {
    const list = t.split(/[,，]/).map((s) => s.trim()).filter(Boolean).map(numOrStr);
    return list.length ? list : undefined;
  }
  return numOrStr(t);
}

/** AST 值 → 输入框回显文本 */
function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (value == null) return '';
  if (typeof value === 'boolean') return '';
  return String(value);
}

function copyText(text: string): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ══════════════ 工厂 ══════════════ */

/**
 * 装配行式过滤器构建器：rule 行（字段/操作符/值）+ AND/OR 组嵌套（≤2 层）+ DSL
 * 双表示镜像（Mongo JSON / OData 字符串，可复制）。变更派 icen:kb-filter-change
 * {node, valid}（onChange 双通道）。幂等；SSR 返回 stub；destroy 摘监听并清空。
 */
export function createKbFilter(el: HTMLElement, opts: KbFilterOpts = {}): KbFilterHandle {
  if (typeof document === 'undefined' || !el) {
    const stub: KbFilterHandle = {
      get: () => null, set: () => {}, serialize: () => '', destroy: () => {},
    };
    return stub;
  }
  const marked = el as MarkedFilterEl;
  if (marked.__icenKbFilter) return marked.__icenKbFilter;

  const ctrl = new AbortController();
  const listen = (type: string, fn: EventListener): void => {
    el.addEventListener(type, fn, { signal: ctrl.signal });
  };

  let dslKind: 'mongo' | 'odata' = 'mongo';
  let destroyed = false;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  el.classList.add('icen-kb-filter');
  el.dataset.icenKbFilter = '';
  el.textContent = '';

  /* 字段建议 datalist（自由输入不受限） */
  const datalistId = `kb-filter-fields-${++fieldListSeq}`;
  const datalist = h('datalist');
  datalist.id = datalistId;
  for (const f of opts.fields ?? []) datalist.appendChild(h('option', undefined, f));

  const treeBox = h('div', 'kb-filter-tree');

  /* DSL 镜像行 */
  const dslText = h('code', 'icen-kb-filter-dsl-text icen-kb-meta');
  const tabMongo = h('button', 'icen-kb-filter-dsl-tab is-active', 'Mongo');
  tabMongo.type = 'button';
  tabMongo.dataset.icenDsl = 'mongo';
  const tabOdata = h('button', 'icen-kb-filter-dsl-tab', 'OData');
  tabOdata.type = 'button';
  tabOdata.dataset.icenDsl = 'odata';
  const dslCopy = h('button', 'icen-kb-filter-act icen-kb-filter-dsl-copy', t('common.copy'));
  dslCopy.type = 'button';
  dslCopy.title = t('kbFilter.copyDsl');
  const dslBar = h('div', 'icen-kb-filter-dsl-bar');
  dslBar.append(tabMongo, tabOdata, dslCopy);
  const dslBox = h('div', 'icen-kb-filter-dsl');
  dslBox.append(dslBar, dslText);

  el.append(treeBox, dslBox, datalist);

  /* ── 行构件 ── */

  function buildRuleRow(rule: Extract<KbFilterNode, { type: 'rule' }>): HTMLElement {
    const row = h('div', 'icen-kb-filter-rule');
    const field = h('input', 'icen-kb-filter-field') as HTMLInputElement;
    field.type = 'text';
    field.value = rule.field;
    field.placeholder = t('kbFilter.fieldLabel');
    field.setAttribute('list', datalistId);
    field.setAttribute('aria-label', t('kbFilter.fieldPlaceholder'));
    const opSel = h('select', 'icen-kb-filter-op') as HTMLSelectElement;
    opSel.setAttribute('aria-label', t('kbFilter.operatorLabel'));
    for (const op of KB_FILTER_OPS) {
      const option = h('option', undefined, OP_LABELS[op]);
      option.value = op;
      opSel.appendChild(option);
    }
    opSel.value = rule.op;
    const value = h('input', 'icen-kb-filter-value') as HTMLInputElement;
    value.type = 'text';
    value.value = formatValue(rule.value);
    value.placeholder = rule.op === 'in' ? t('kbFilter.valuePlaceholder') : t('kbFilter.valueLabel');
    value.setAttribute('aria-label', t('kbFilter.valueAria'));
    if (rule.op === 'exists') value.disabled = true;
    const del = h('button', 'icen-kb-filter-act is-danger', '×');
    del.type = 'button';
    del.dataset.icenAct = 'del-rule';
    del.title = t('kbFilter.deleteRule');
    del.setAttribute('aria-label', t('kbFilter.deleteRule'));
    row.append(field, opSel, value, del);
    return row;
  }

  function buildGroup(node: Extract<KbFilterNode, { type: 'group' }>, depth: number): HTMLElement {
    const box = h('div', 'icen-kb-filter-group');
    box.dataset.icenDepth = String(depth);
    const head = h('div', 'icen-kb-filter-head');
    const opBtn = h('button', 'icen-kb-filter-op-toggle', node.op === 'or' ? 'OR' : 'AND');
    opBtn.type = 'button';
    opBtn.dataset.icenOp = node.op;
    opBtn.classList.toggle('is-or', node.op === 'or');
    opBtn.title = t('kbFilter.toggleAndOr');
    opBtn.setAttribute('aria-label', t('kbFilter.combineMode', { p0: node.op === 'or' ? t('kbFilter.or') : t('kbFilter.and') }));
    const addRule = h('button', 'icen-kb-filter-act', t('kbFilter.addRule'));
    addRule.type = 'button';
    addRule.dataset.icenAct = 'add-rule';
    const addGroup = h('button', 'icen-kb-filter-act', t('kbFilter.addGroup'));
    addGroup.type = 'button';
    addGroup.dataset.icenAct = 'add-group';
    if (depth >= MAX_GROUP_DEPTH) addGroup.disabled = true;
    head.append(opBtn, addRule, addGroup);
    if (depth > 0) {
      const delGroup = h('button', 'icen-kb-filter-act is-danger', t('kbFilter.deleteGroup'));
      delGroup.type = 'button';
      delGroup.dataset.icenAct = 'del-group';
      head.appendChild(delGroup);
    }
    const body = h('div', 'icen-kb-filter-body');
    for (const child of node.children) {
      body.appendChild(child.type === 'rule' ? buildRuleRow(child) : buildGroup(child, depth + 1));
    }
    box.append(head, body);
    return box;
  }

  /* ── DOM → AST 解析 ── */

  function readGroup(groupEl: HTMLElement): { type: 'group'; op: 'and' | 'or'; children: KbFilterNode[] } {
    const opBtn = groupEl.querySelector(':scope > .icen-kb-filter-head > .icen-kb-filter-op-toggle');
    const op = opBtn instanceof HTMLElement && opBtn.dataset.icenOp === 'or' ? 'or' : 'and';
    const children: KbFilterNode[] = [];
    const body = groupEl.querySelector(':scope > .icen-kb-filter-body');
    if (body) {
      for (const child of Array.from(body.children)) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.classList.contains('icen-kb-filter-rule')) {
          const fieldEl = child.querySelector(':scope > .icen-kb-filter-field');
          const opEl = child.querySelector(':scope > .icen-kb-filter-op');
          const valueEl = child.querySelector(':scope > .icen-kb-filter-value');
          const field = fieldEl instanceof HTMLInputElement ? fieldEl.value.trim() : '';
          const op = opEl instanceof HTMLSelectElement && KB_FILTER_OPS.includes(opEl.value as KbFilterOp)
            ? opEl.value as KbFilterOp
            : 'eq';
          const rawValue = valueEl instanceof HTMLInputElement ? valueEl.value : '';
          children.push({ type: 'rule', field, op, value: parseValue(rawValue, op) });
        } else if (child.classList.contains('icen-kb-filter-group')) {
          children.push(readGroup(child));
        }
      }
    }
    return { type: 'group', op, children };
  }

  function rootNode(): { type: 'group'; op: 'and' | 'or'; children: KbFilterNode[] } {
    const rootEl = treeBox.querySelector(':scope > .icen-kb-filter-group');
    return rootEl instanceof HTMLElement ? readGroup(rootEl) : { type: 'group', op: 'and', children: [] };
  }

  function collectFields(node: KbFilterNode, out: { empty: boolean }): void {
    if (node.type === 'rule') {
      if (!node.field) out.empty = true;
      return;
    }
    for (const c of node.children) collectFields(c, out);
  }

  function currentNode(): KbFilterNode | null {
    return normalizeFilterNode(rootNode());
  }

  function currentValid(node: { type: 'group'; op: 'and' | 'or'; children: KbFilterNode[] }): boolean {
    const flag = { empty: false };
    collectFields(node, flag);
    return !flag.empty;
  }

  /* ── 镜像与通知 ── */

  function serializeOf(node: KbFilterNode | null, kind: 'mongo' | 'odata'): string {
    if (kind === 'odata') return filterToOData(node);
    return JSON.stringify(filterToMongo(node));
  }

  function syncDsl(): void {
    tabMongo.classList.toggle('is-active', dslKind === 'mongo');
    tabOdata.classList.toggle('is-active', dslKind === 'odata');
    dslText.textContent = serializeOf(currentNode(), dslKind) || t('kbFilter.none');
  }

  function notify(): void {
    const raw = rootNode();
    const valid = currentValid(raw);
    const node = normalizeFilterNode(raw);
    syncDsl();
    if (destroyed) return;
    emitIcen(el, 'icen:kb-filter-change', { node, valid });
    opts.onChange?.(node, valid);
  }

  /* ── 初始树 ── */

  function applyNode(node: KbFilterNode | null): void {
    const norm = normalizeFilterNode(node);
    treeBox.textContent = '';
    if (!norm) {
      treeBox.appendChild(buildGroup({ type: 'group', op: 'and', children: [] }, 0));
      return;
    }
    if (norm.type === 'rule') {
      treeBox.appendChild(buildGroup({ type: 'group', op: 'and', children: [norm] }, 0));
      return;
    }
    treeBox.appendChild(buildGroup(norm, 0));
  }

  applyNode(opts.node ?? null);

  /* ── 委托交互（结构变更重建局部，输入变更只改自身行） ── */

  listen('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;

    const tab = target.closest('.icen-kb-filter-dsl-tab');
    if (tab instanceof HTMLElement) {
      const kind = tab.dataset.icenDsl === 'odata' ? 'odata' : 'mongo';
      if (kind !== dslKind) {
        dslKind = kind;
        syncDsl();
      }
      return;
    }

    if (target.closest('.icen-kb-filter-dsl-copy')) {
      if (!destroyed && copyText(dslText.textContent === t('kbFilter.none') ? '' : dslText.textContent ?? '')) {
        dslCopy.classList.add('is-copied');
        dslCopy.textContent = t('common.copied');
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          if (destroyed) return;
          dslCopy.classList.remove('is-copied');
          dslCopy.textContent = t('common.copy');
        }, 1200);
      }
      return;
    }

    const actBtn = target.closest('.icen-kb-filter-act');
    if (!(actBtn instanceof HTMLButtonElement) || actBtn.disabled) return;
    const act = actBtn.dataset.icenAct;
    if (!act) return;

    if (act === 'add-rule' || act === 'add-group') {
      const groupEl = actBtn.closest('.icen-kb-filter-group');
      if (!(groupEl instanceof HTMLElement)) return;
      const body = groupEl.querySelector(':scope > .icen-kb-filter-body');
      if (!body) return;
      if (act === 'add-rule') {
        body.appendChild(buildRuleRow({ type: 'rule', field: '', op: 'eq', value: undefined }));
      } else {
        const depth = Number(groupEl.dataset.icenDepth) || 0;
        body.appendChild(buildGroup({ type: 'group', op: 'and', children: [] }, depth + 1));
      }
      notify();
      return;
    }

    if (act === 'del-rule') {
      const row = actBtn.closest('.icen-kb-filter-rule');
      row?.remove();
      notify();
      return;
    }

    if (act === 'del-group') {
      const groupEl = actBtn.closest('.icen-kb-filter-group');
      if (groupEl instanceof HTMLElement && (Number(groupEl.dataset.icenDepth) || 0) > 0) {
        groupEl.remove();
        notify();
      }
      return;
    }
  });

  /* AND/OR 切换（独立委托：op-toggle 不带 data-icen-act） */
  listen('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const opBtn = target.closest('.icen-kb-filter-op-toggle');
    if (!(opBtn instanceof HTMLButtonElement)) return;
    const nowOr = opBtn.dataset.icenOp !== 'or';
    opBtn.dataset.icenOp = nowOr ? 'or' : 'and';
    opBtn.textContent = nowOr ? 'OR' : 'AND';
    opBtn.classList.toggle('is-or', nowOr);
    opBtn.setAttribute('aria-label', t('kbFilter.combineMode', { p0: nowOr ? t('kbFilter.or') : t('kbFilter.and') }));
    notify();
  });

  /* 输入变更：只更新当前行视觉（placeholder/禁用态），AST 在 notify 时即时解析 */
  listen('input', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.classList.contains('icen-kb-filter-field') || target.classList.contains('icen-kb-filter-value')) {
      notify();
    }
  });

  listen('change', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLSelectElement) || !target.classList.contains('icen-kb-filter-op')) return;
    const row = target.closest('.icen-kb-filter-rule');
    const valueEl = row?.querySelector(':scope > .icen-kb-filter-value');
    if (!(valueEl instanceof HTMLInputElement)) return;
    const op = KB_FILTER_OPS.includes(target.value as KbFilterOp) ? target.value as KbFilterOp : 'eq';
    valueEl.disabled = op === 'exists';
    valueEl.placeholder = op === 'in' ? t('kbFilter.valuePlaceholder') : op === 'exists' ? t('kbFilter.noValueNeeded') : t('kbFilter.valueLabel');
    notify();
  });

  syncDsl();

  /* ── 句柄 ── */

  const handle: KbFilterHandle = {
    get(): KbFilterNode | null {
      return currentNode();
    },
    set(node: KbFilterNode | null): void {
      applyNode(node);
      notify();
    },
    serialize(kind: 'mongo' | 'odata'): string {
      return serializeOf(currentNode(), kind);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      ctrl.abort();
      if (copyTimer) clearTimeout(copyTimer);
      el.classList.remove('icen-kb-filter');
      delete el.dataset.icenKbFilter;
      el.textContent = '';
      delete (el as MarkedFilterEl).__icenKbFilter;
    },
  };

  marked.__icenKbFilter = handle;
  return handle;
}
