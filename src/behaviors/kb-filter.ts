/*
 * @icen.ai/ui — Behavior: kb-filter（过滤器构建器，与 components/kb-search.css 配套）
 *
 * DOM 契约（create 装配，规格 docs/spec/kb-family.md §5.12）：
 *   <div class="kb-filter" data-kb-filter>
 *     <div class="kb-filter-tree">
 *       <div class="kb-filter-group" data-depth="0">
 *         <div class="kb-filter-head">
 *           <button class="kb-filter-op-toggle [.is-or]" data-op="and|or">AND</button>
 *           <button class="kb-filter-act" data-act="add-rule">+ 规则</button>
 *           <button class="kb-filter-act" data-act="add-group" [disabled]>+ 组</button>
 *           [<button class="kb-filter-act is-danger" data-act="del-group">删除组</button>]  ← 仅嵌套组
 *         </div>
 *         <div class="kb-filter-body">
 *           <div class="kb-filter-rule">
 *             <input class="kb-filter-field" list="…" placeholder="字段" />
 *             <select class="kb-filter-op">等于/不等于/大于/大于等于/小于/小于等于/属于/包含/存在</select>
 *             <input class="kb-filter-value" placeholder="值（属于用逗号分隔）" [disabled] />
 *             <button class="kb-filter-act is-danger" data-act="del-rule">×</button>
 *           </div>…
 *           [<div class="kb-filter-group" data-depth="1|2">…递归…</div>]…
 *         </div>
 *       </div>
 *     </div>
 *     <div class="kb-filter-dsl">
 *       <div class="kb-filter-dsl-bar">
 *         <button class="kb-filter-dsl-tab [.is-active]" data-dsl="mongo">Mongo</button>
 *         <button class="kb-filter-dsl-tab" data-dsl="odata">OData</button>
 *         <button class="kb-filter-act kb-filter-dsl-copy">复制</button>
 *       </div>
 *       <code class="kb-filter-dsl-text kb-meta">…序列化镜像（可复制）…</code>
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
  eq: '等于', ne: '不等于', gt: '大于', gte: '大于等于', lt: '小于', lte: '小于等于',
  in: '属于', contains: '包含', exists: '存在',
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

  el.classList.add('kb-filter');
  el.dataset.kbFilter = '';
  el.textContent = '';

  /* 字段建议 datalist（自由输入不受限） */
  const datalistId = `kb-filter-fields-${++fieldListSeq}`;
  const datalist = h('datalist');
  datalist.id = datalistId;
  for (const f of opts.fields ?? []) datalist.appendChild(h('option', undefined, f));

  const treeBox = h('div', 'kb-filter-tree');

  /* DSL 镜像行 */
  const dslText = h('code', 'kb-filter-dsl-text kb-meta');
  const tabMongo = h('button', 'kb-filter-dsl-tab is-active', 'Mongo');
  tabMongo.type = 'button';
  tabMongo.dataset.dsl = 'mongo';
  const tabOdata = h('button', 'kb-filter-dsl-tab', 'OData');
  tabOdata.type = 'button';
  tabOdata.dataset.dsl = 'odata';
  const dslCopy = h('button', 'kb-filter-act kb-filter-dsl-copy', '复制');
  dslCopy.type = 'button';
  dslCopy.title = '复制 DSL';
  const dslBar = h('div', 'kb-filter-dsl-bar');
  dslBar.append(tabMongo, tabOdata, dslCopy);
  const dslBox = h('div', 'kb-filter-dsl');
  dslBox.append(dslBar, dslText);

  el.append(treeBox, dslBox, datalist);

  /* ── 行构件 ── */

  function buildRuleRow(rule: Extract<KbFilterNode, { type: 'rule' }>): HTMLElement {
    const row = h('div', 'kb-filter-rule');
    const field = h('input', 'kb-filter-field') as HTMLInputElement;
    field.type = 'text';
    field.value = rule.field;
    field.placeholder = '字段';
    field.setAttribute('list', datalistId);
    field.setAttribute('aria-label', '过滤字段');
    const opSel = h('select', 'kb-filter-op') as HTMLSelectElement;
    opSel.setAttribute('aria-label', '操作符');
    for (const op of KB_FILTER_OPS) {
      const option = h('option', undefined, OP_LABELS[op]);
      option.value = op;
      opSel.appendChild(option);
    }
    opSel.value = rule.op;
    const value = h('input', 'kb-filter-value') as HTMLInputElement;
    value.type = 'text';
    value.value = formatValue(rule.value);
    value.placeholder = rule.op === 'in' ? '值 1, 值 2（逗号分隔）' : '值';
    value.setAttribute('aria-label', '过滤值');
    if (rule.op === 'exists') value.disabled = true;
    const del = h('button', 'kb-filter-act is-danger', '×');
    del.type = 'button';
    del.dataset.act = 'del-rule';
    del.title = '删除规则';
    del.setAttribute('aria-label', '删除规则');
    row.append(field, opSel, value, del);
    return row;
  }

  function buildGroup(node: Extract<KbFilterNode, { type: 'group' }>, depth: number): HTMLElement {
    const box = h('div', 'kb-filter-group');
    box.dataset.depth = String(depth);
    const head = h('div', 'kb-filter-head');
    const opBtn = h('button', 'kb-filter-op-toggle', node.op === 'or' ? 'OR' : 'AND');
    opBtn.type = 'button';
    opBtn.dataset.op = node.op;
    opBtn.classList.toggle('is-or', node.op === 'or');
    opBtn.title = '切换 AND / OR';
    opBtn.setAttribute('aria-label', `组合方式 ${node.op === 'or' ? '或' : '且'}`);
    const addRule = h('button', 'kb-filter-act', '+ 规则');
    addRule.type = 'button';
    addRule.dataset.act = 'add-rule';
    const addGroup = h('button', 'kb-filter-act', '+ 组');
    addGroup.type = 'button';
    addGroup.dataset.act = 'add-group';
    if (depth >= MAX_GROUP_DEPTH) addGroup.disabled = true;
    head.append(opBtn, addRule, addGroup);
    if (depth > 0) {
      const delGroup = h('button', 'kb-filter-act is-danger', '删除组');
      delGroup.type = 'button';
      delGroup.dataset.act = 'del-group';
      head.appendChild(delGroup);
    }
    const body = h('div', 'kb-filter-body');
    for (const child of node.children) {
      body.appendChild(child.type === 'rule' ? buildRuleRow(child) : buildGroup(child, depth + 1));
    }
    box.append(head, body);
    return box;
  }

  /* ── DOM → AST 解析 ── */

  function readGroup(groupEl: HTMLElement): { type: 'group'; op: 'and' | 'or'; children: KbFilterNode[] } {
    const opBtn = groupEl.querySelector(':scope > .kb-filter-head > .kb-filter-op-toggle');
    const op = opBtn instanceof HTMLElement && opBtn.dataset.op === 'or' ? 'or' : 'and';
    const children: KbFilterNode[] = [];
    const body = groupEl.querySelector(':scope > .kb-filter-body');
    if (body) {
      for (const child of Array.from(body.children)) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.classList.contains('kb-filter-rule')) {
          const fieldEl = child.querySelector(':scope > .kb-filter-field');
          const opEl = child.querySelector(':scope > .kb-filter-op');
          const valueEl = child.querySelector(':scope > .kb-filter-value');
          const field = fieldEl instanceof HTMLInputElement ? fieldEl.value.trim() : '';
          const op = opEl instanceof HTMLSelectElement && KB_FILTER_OPS.includes(opEl.value as KbFilterOp)
            ? opEl.value as KbFilterOp
            : 'eq';
          const rawValue = valueEl instanceof HTMLInputElement ? valueEl.value : '';
          children.push({ type: 'rule', field, op, value: parseValue(rawValue, op) });
        } else if (child.classList.contains('kb-filter-group')) {
          children.push(readGroup(child));
        }
      }
    }
    return { type: 'group', op, children };
  }

  function rootNode(): { type: 'group'; op: 'and' | 'or'; children: KbFilterNode[] } {
    const rootEl = treeBox.querySelector(':scope > .kb-filter-group');
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
    dslText.textContent = serializeOf(currentNode(), dslKind) || '（无过滤）';
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

    const tab = target.closest('.kb-filter-dsl-tab');
    if (tab instanceof HTMLElement) {
      const kind = tab.dataset.dsl === 'odata' ? 'odata' : 'mongo';
      if (kind !== dslKind) {
        dslKind = kind;
        syncDsl();
      }
      return;
    }

    if (target.closest('.kb-filter-dsl-copy')) {
      if (!destroyed && copyText(dslText.textContent === '（无过滤）' ? '' : dslText.textContent ?? '')) {
        dslCopy.classList.add('is-copied');
        dslCopy.textContent = '已复制';
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          if (destroyed) return;
          dslCopy.classList.remove('is-copied');
          dslCopy.textContent = '复制';
        }, 1200);
      }
      return;
    }

    const actBtn = target.closest('.kb-filter-act');
    if (!(actBtn instanceof HTMLButtonElement) || actBtn.disabled) return;
    const act = actBtn.dataset.act;
    if (!act) return;

    if (act === 'add-rule' || act === 'add-group') {
      const groupEl = actBtn.closest('.kb-filter-group');
      if (!(groupEl instanceof HTMLElement)) return;
      const body = groupEl.querySelector(':scope > .kb-filter-body');
      if (!body) return;
      if (act === 'add-rule') {
        body.appendChild(buildRuleRow({ type: 'rule', field: '', op: 'eq', value: undefined }));
      } else {
        const depth = Number(groupEl.dataset.depth) || 0;
        body.appendChild(buildGroup({ type: 'group', op: 'and', children: [] }, depth + 1));
      }
      notify();
      return;
    }

    if (act === 'del-rule') {
      const row = actBtn.closest('.kb-filter-rule');
      row?.remove();
      notify();
      return;
    }

    if (act === 'del-group') {
      const groupEl = actBtn.closest('.kb-filter-group');
      if (groupEl instanceof HTMLElement && (Number(groupEl.dataset.depth) || 0) > 0) {
        groupEl.remove();
        notify();
      }
      return;
    }
  });

  /* AND/OR 切换（独立委托：op-toggle 不带 data-act） */
  listen('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const opBtn = target.closest('.kb-filter-op-toggle');
    if (!(opBtn instanceof HTMLButtonElement)) return;
    const nowOr = opBtn.dataset.op !== 'or';
    opBtn.dataset.op = nowOr ? 'or' : 'and';
    opBtn.textContent = nowOr ? 'OR' : 'AND';
    opBtn.classList.toggle('is-or', nowOr);
    opBtn.setAttribute('aria-label', `组合方式 ${nowOr ? '或' : '且'}`);
    notify();
  });

  /* 输入变更：只更新当前行视觉（placeholder/禁用态），AST 在 notify 时即时解析 */
  listen('input', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.classList.contains('kb-filter-field') || target.classList.contains('kb-filter-value')) {
      notify();
    }
  });

  listen('change', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLSelectElement) || !target.classList.contains('kb-filter-op')) return;
    const row = target.closest('.kb-filter-rule');
    const valueEl = row?.querySelector(':scope > .kb-filter-value');
    if (!(valueEl instanceof HTMLInputElement)) return;
    const op = KB_FILTER_OPS.includes(target.value as KbFilterOp) ? target.value as KbFilterOp : 'eq';
    valueEl.disabled = op === 'exists';
    valueEl.placeholder = op === 'in' ? '值 1, 值 2（逗号分隔）' : op === 'exists' ? '（无需值）' : '值';
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
      el.classList.remove('kb-filter');
      delete el.dataset.kbFilter;
      el.textContent = '';
      delete (el as MarkedFilterEl).__icenKbFilter;
    },
  };

  marked.__icenKbFilter = handle;
  return handle;
}
