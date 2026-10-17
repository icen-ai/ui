/*
 * @icen.ai/ui — Behavior: tree-select（树选择，与 components/tree-select.css 配套，函数式 API）
 *
 * 顶层设计：企业表单缺口件——组织架构 / 权限树 / 类目树这类「层级型」多选或单选。
 * 数据 = 嵌套 TreeNode 树；多选值 = value: string[]（文档序）。函数式 API（与 datatable
 * 同族）：
 *
 *   const t = createTreeSelect(el, {
 *     nodes: [{ value: 'rd', label: '研发', children: [{ value: 'fe', label: '前端' }] }],
 *     multiple: true, checkable: true,        // 三态勾选（父 = 子集并集，混合态）
 *     searchable: true,                       // 过滤命中节点自动展开祖先，命中词 <mark> 高亮
 *     onChange: (value, labels) => {},        // 与 icen:tree-select-change { value, labels } 双通道
 *   });
 *   t.getValue(); t.getLabels(); t.setValue(['fe']); t.clear();
 *   t.expandAll(); t.collapseAll(); t.destroy();
 *
 * DOM 契约（createTreeSelect 渲染进 el；SSR 下返回 no-op handle）：
 *   <div class="icen-tree-select [.is-open]" data-icen-tree-select [data-icen-disabled]
 *        [.icen-tree-select--lined]>
 *     <button class="icen-tree-select-trigger" role="combobox" aria-haspopup="tree"
 *             aria-expanded="false" aria-controls="<panelId>" [disabled]>
 *       <span class="icen-tree-select-value [.is-empty]">请选择</span>
 *       <svg class="icen-tree-select-chevron">…</svg>
 *     </button>
 *     <span class="icen-tree-select-chips" [hidden]>          ← behavior 生成，与 trigger 同级
 *       <span class="icen-tree-select-chip"><span>前端</span><button class="icen-tree-select-chip-x" type="button" aria-label="移除前端">…svg…</button></span>
 *     </span>
 *     <button class="icen-tree-select-clear" aria-label="清除" hidden>×</button>  ← clearable；
 *         与 trigger 同级（不能嵌套进 button），绝对定位叠进 trigger 行内末端侧
 *     <div class="icen-tree-select-panel" id="<panelId>" hidden>
 *       <div class="icen-tree-select-search">          ← opts.searchable 时渲染
 *         <input class="icen-tree-select-search-input" type="search" placeholder="搜索" />
 *       </div>
 *       <div class="icen-tree-select-tree" role="tree">
 *         <div class="icen-tree-select-row [.is-selected|.is-checked|.is-mixed|.is-disabled|.is-branch]"
 *              role="treeitem" tabindex="-1" data-icen-value="fe" style="--depth:1"
 *              aria-level="2" aria-posinset="1" aria-setsize="3"
 *              [aria-expanded="true"] [aria-selected="true"] [aria-checked="true|false|mixed"]>
 *           <span class="icen-tree-select-toggle"><svg>…</svg></span>  ← 分支；叶子为占位 span
 *           <span class="icen-tree-select-check"></span>                ← checkable 时
 *           <span class="icen-tree-select-label">前端</span>
 *         </div>
 *       </div>
 *       <div class="icen-tree-select-empty" hidden>无匹配</div>        ← opts.emptyLabel
 *     </div>
 *   </div>
 *
 * 交互：trigger 点击开关面板；面板打开时 portal 到 document.body，由 behavior 按 trigger
 *   rect 用 computePopoverLayout 定位（prefer 下方、不足翻上），inline 写 left/top/width/
 *   max-height + data-icen-side；面板尺寸走全库统一 PanelSizing 契约：根 el 挂
 *   data-icen-panel-width / -min / -max / -max-height（默认 280/无上限夹取以外的 CSS 默认）。
 *   window scroll（capture）/ resize 跟随重定位，trigger 离场则关闭；外点 / Esc 关闭
 *   （document 级单例委托，同时只开一个面板）。
 *   单选（multiple=false）：点任意级定值（opts.leafOnly = true 时仅叶子可定值），选中即关。
 *   多选 + checkable：三态勾选，父框 = 子集并集（点父整树切换，含混合态回写）。
 *   多选无 checkable：点行切选单个节点。trigger chips 超出 3 个收 +N（仅 pointer 通道移除）。
 *   搜索态：过滤命中节点自动展开祖先、命中词 <mark> 高亮，无命中显示 empty。
 *
 * 键盘（面板内）：↑↓ 行间移动 / → 展开（已展开进首子）/ ← 折叠（已折叠回父行）/ Enter 激活
 *   （单选定值并关；多选切选）/ Esc 关面板回 trigger。搜索态 Esc 先清词再关。
 *
 * 事件：icen:tree-select-change { value: string[]; labels: string[] }（labels 与 value
 *   同序），与 opts.onChange 双通道；clear 派发、setValue 静默。
 *   SSR 下 createTreeSelect 返回 no-op handle；渲染只写 textContent；同 el 重复 create
 *   先 destroy 旧实例（WeakMap 级幂等）；destroy 摘除 portal + 全部监听。
 */

import { enhanceSearchField } from './input';
import { createIcon } from './icons';
import { revealPopoverItem, computePopoverLayout, resolvePanelSizing } from './popover';
import { emitIcen } from './events';
import { t } from './i18n';

export interface TreeNode {
  value: string;
  label: string;
  children?: TreeNode[];
  disabled?: boolean;
}

export interface TreeSelectOptions {
  /** Accessible field name; defaults to placeholder. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  nodes: TreeNode[];
  /** 初值（多选数组；单选取首个有效值） */
  value?: string[];
  multiple?: boolean;
  /** 面板内搜索：过滤命中节点自动展开祖先，命中词 <mark> 高亮 */
  searchable?: boolean;
  /** 多选的三态勾选（父 = 子集并集，混合态）；隐含多值语义 */
  checkable?: boolean;
  /** 单选时仅叶子可定值（默认任意级可选） */
  leafOnly?: boolean;
  /** 默认「请选择」 */
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  /** 搜索无命中文案，默认「无匹配」 */
  emptyLabel?: string;
  /** 搜索框占位，默认「搜索」 */
  searchPlaceholder?: string;
  onChange?: (value: string[], labels: string[]) => void;
}

export interface TreeSelectHandle {
  getValue(): string[];
  getLabels(): string[];
  setValue(v: string[]): void;
  clear(): void;
  open(): void;
  close(): void;
  expandAll(): void;
  collapseAll(): void;
  destroy(): void;
}

/* ═══════════ 纯函数（拍平 / 过滤 / 三态求值；模块级导出供单测）═══════════ */

export interface FlatTreeEntry {
  node: TreeNode;
  depth: number;
  parents: TreeNode[];
}

/** 深度优先拍平（文档序）：节点 + 深度 + 父链（键盘导航 / chips 序 / 值序共用）。 */
export function flattenTreeNodes(nodes: TreeNode[]): FlatTreeEntry[] {
  const out: FlatTreeEntry[] = [];
  const walk = (list: TreeNode[], depth: number, parents: TreeNode[]): void => {
    for (const node of list) {
      out.push({ node, depth, parents });
      if (node.children?.length) walk(node.children, depth + 1, [...parents, node]);
    }
  };
  walk(nodes, 0, []);
  return out;
}

export interface TreeFilterResult {
  /** label 命中 query 的节点值集合（大小写不敏感） */
  matched: Set<string>;
  /** 需保留可见的节点值集合 = 命中 ∪ 祖先 ∪ 命中节点的子孙（上下文可见，不高亮） */
  keep: Set<string>;
  /** 命中节点祖先（搜索态自动展开的目标） */
  expand: Set<string>;
}

/** 搜索过滤：命中节点 + 其全部祖先 + 其子孙保留可见（子孙是命中上下文，不高亮）；
 *  祖先进 expand（搜索态自动展开的目标）。空 query 返回空集。 */
export function filterTreeNodes(nodes: TreeNode[], query: string): TreeFilterResult {
  const matched = new Set<string>();
  const keep = new Set<string>();
  const expand = new Set<string>();
  const q = query.trim().toLowerCase();
  if (q === '') return { matched, keep, expand };
  const walk = (list: TreeNode[], ancestors: TreeNode[]): void => {
    for (const node of list) {
      if (node.label.toLowerCase().includes(q)) {
        matched.add(node.value);
        keep.add(node.value);
        for (const a of ancestors) {
          keep.add(a.value);
          expand.add(a.value);
        }
        for (const d of flattenTreeNodes(node.children ?? [])) keep.add(d.node.value);
      }
      if (node.children?.length) walk(node.children, [...ancestors, node]);
    }
  };
  walk(nodes, []);
  return { matched, keep, expand };
}

export type TreeCheckState = 'checked' | 'unchecked' | 'mixed';

/**
 * 三态求值：checked 集合（全部选中节点值）下某节点的勾选态。
 * 自身 + 全部子孙都在集合 → checked；全不在 → unchecked；部分在 → mixed
 * （父不在集合但全部子孙在也呈 mixed——诚实呈现部分选择，由 toggle 逻辑保证一致）。
 */
export function treeNodeCheckState(node: TreeNode, checked: ReadonlySet<string>): TreeCheckState {
  const descendants = flattenTreeNodes(node.children ?? []).map((e) => e.node);
  const on = descendants.filter((d) => checked.has(d.value)).length;
  if (on === 0) return checked.has(node.value) ? 'checked' : 'unchecked';
  if (on === descendants.length && checked.has(node.value)) return 'checked';
  return 'mixed';
}

/** 无 DOM（SSR）时的 no-op handle。 */
function noopHandle(): TreeSelectHandle {
  const noop = (): void => undefined;
  return {
    getValue: () => [],
    getLabels: () => [],
    setValue: noop,
    clear: noop,
    open: noop,
    close: noop,
    expandAll: noop,
    collapseAll: noop,
    destroy: noop,
  };
}

/* ═══════════ 面板定位 / 单例（参照 behaviors/select.ts 同款骨架）═══════════ */

interface OpenTreeSelect {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  close: () => void;
  reposition: () => void;
}

let openTreeSelect: OpenTreeSelect | null = null;
let globalBound = false;
let uidSeq = 0;

/** 面板与 trigger 的垂直间距、面板最大高度上限。 */
const PANEL_OFFSET = 4;
const PANEL_MAX_HEIGHT = 280;

function onGlobalPointerDown(ev: Event): void {
  const cur = openTreeSelect;
  if (!cur) return;
  const t = ev.target;
  if (!(t instanceof Node)) return;
  if (cur.root.contains(t) || cur.panel.contains(t)) return;
  cur.close();
}

function onGlobalKeyDown(ev: KeyboardEvent): void {
  if (ev.key !== 'Escape' || ev.isComposing || ev.keyCode === 229) return;
  const cur = openTreeSelect;
  if (!cur) return;
  cur.close();
  cur.trigger.focus();
}

function onWindowChange(): void {
  const cur = openTreeSelect;
  if (!cur) return;
  if (!cur.trigger.isConnected) {
    cur.close();
    return;
  }
  cur.reposition();
}

function bindGlobalListeners(): void {
  if (globalBound) return;
  globalBound = true;
  document.addEventListener('pointerdown', onGlobalPointerDown);
  document.addEventListener('keydown', onGlobalKeyDown);
}

function bindOpenListeners(): void {
  window.addEventListener('scroll', onWindowChange, true);
  window.addEventListener('resize', onWindowChange);
}

function unbindOpenListeners(): void {
  window.removeEventListener('scroll', onWindowChange, true);
  window.removeEventListener('resize', onWindowChange);
}

/** 同 el 重复 create：先销毁旧实例再重建（WeakMap 级幂等，不占 el 属性命名空间）。 */
const instances = new WeakMap<HTMLElement, () => void>();

/** 右指 chevron（分支展开 toggle）。 */
function branchChevronSvg(): SVGSVGElement { return createIcon('chevron-down')!; }

export function createTreeSelect(el: HTMLElement, opts: TreeSelectOptions): TreeSelectHandle {
  if (typeof document === 'undefined') return noopHandle();
  /* 幂等 create：同 el 复 create 先 destroy 旧的 */
  instances.get(el)?.();

  const ac = new AbortController();
  const on = <T extends Event>(t: EventTarget, ev: string, fn: (e: T) => void): void => {
    const listener: EventListener = (evt) => fn(evt as T);
    t.addEventListener(ev, listener, { signal: ac.signal });
  };

  const placeholder = opts.placeholder ?? t('treeSelect.placeholder');
  const emptyLabel = opts.emptyLabel ?? t('treeSelect.noMatch');
  const multiple = opts.multiple === true;
  const checkable = opts.checkable === true;
  /** 值成员集合：多选 = 选中集；单选 = 最多一个 */
  const selected = new Set<string>();
  /** 分支展开值集合 */
  const expanded = new Set<string>();
  /** 初值回填（无效值剔除；单选取首） */
  const known = new Map(flattenTreeNodes(opts.nodes).map((e) => [e.node.value, e.node]));
  if (opts.value) {
    for (const v of opts.value) {
      if (known.has(v)) selected.add(v);
      if (!multiple) break;
    }
  }

  let searchQuery = '';
  let focusIdx = -1;
  let destroyed = false;

  /* ═══ DOM 骨架（全部 textContent，禁 innerHTML）═══ */
  el.textContent = '';
  const root = document.createElement('div');
  root.className = 'icen-tree-select';
  if (opts.size && opts.size !== 'md') root.classList.add('icen-tree-select--' + opts.size);
  root.setAttribute('data-icen-tree-select', '');
  if (opts.disabled) root.setAttribute('data-icen-disabled', '');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'icen-tree-select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'tree');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label',opts.label ?? placeholder);
  if (opts.disabled) trigger.disabled = true;

  const valueEl = document.createElement('span');
  valueEl.className = 'icen-tree-select-value';
  const chevron = createIcon('chevron-down')!;
  chevron.classList.add('icen-tree-select-chevron');
  trigger.appendChild(valueEl);
  trigger.appendChild(chevron);

  let clearBtn: HTMLButtonElement | null = null;
  if (opts.clearable) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.disabled = opts.disabled === true;
    clearBtn.className = 'icen-tree-select-clear';
    clearBtn.setAttribute('aria-label', '清除');
    clearBtn.hidden = true;
    clearBtn.append(createIcon('close')!);
    clearBtn.classList.add('icen-icon-action');
    clearBtn.setAttribute('data-icen-reveal','');
    root.appendChild(clearBtn);
  }

  const uid = ++uidSeq;
  const panel = document.createElement('div');
  panel.className = 'icen-tree-select-panel';
  panel.id = `icen-tree-select-panel-${uid}`;
  panel.hidden = true;
  trigger.setAttribute('aria-controls', panel.id);

  let searchInput: HTMLInputElement | null = null;
  if (opts.searchable) {
    const searchWrap = document.createElement('div');
    searchWrap.className = 'icen-tree-select-search';
    searchInput = document.createElement('input');
    searchInput.className = 'icen-tree-select-search-input';
    searchInput.type = 'search';
    searchInput.placeholder = opts.searchPlaceholder ?? t('treeSelect.search');
    searchInput.setAttribute('aria-label',searchInput.placeholder);
    searchWrap.appendChild(searchInput);
    panel.appendChild(searchWrap);
  }
  const searchField=searchInput ? enhanceSearchField(searchInput) : null;
  ac.signal.addEventListener('abort',()=>searchField?.destroy(),{once:true});


  const tree = document.createElement('div');
  tree.className = 'icen-tree-select-tree';
  tree.setAttribute('role', 'tree');
  tree.id = `icen-tree-select-tree-${uid}`;
  tree.setAttribute('aria-label',opts.label ?? placeholder);
  if(multiple)tree.setAttribute('aria-multiselectable','true');
  searchInput?.setAttribute('aria-controls',tree.id);
  panel.appendChild(tree);

  const emptyEl = document.createElement('div');
  emptyEl.className = 'icen-tree-select-empty';
  emptyEl.setAttribute('role','status');
  emptyEl.textContent = emptyLabel;
  emptyEl.hidden = true;
  panel.appendChild(emptyEl);

  root.insertBefore(trigger,clearBtn);
  root.appendChild(panel);
  el.appendChild(root);

  const panelSizing = resolvePanelSizing(el);

  function resolvedPanelWidth(triggerWidth: number): number {
    let w = triggerWidth;
    if (panelSizing.minWidth != null) w = Math.max(w, panelSizing.minWidth);
    if (panelSizing.maxWidth != null) w = Math.min(w, panelSizing.maxWidth);
    if (panelSizing.width != null) w = panelSizing.width;
    return w;
  }

  const isOpen = (): boolean => !panel.hidden;
  const searchMode = (): boolean => opts.searchable === true && searchQuery.trim() !== '';
  const checkedSet = (): ReadonlySet<string> => selected;

  /* ═══ 渲染 ═══ */

  function selectedNodesInOrder(): TreeNode[] {
    return flattenTreeNodes(opts.nodes)
      .map((e) => e.node)
      .filter((node) => selected.has(node.value));
  }

  function renderTrigger(): void {
    const nodes = selectedNodesInOrder();
    if (nodes.length === 0) {
      valueEl.textContent = placeholder;
      valueEl.classList.add('is-empty');
      valueEl.hidden = false;
      if (clearBtn) clearBtn.hidden = true;
      const chips = root.querySelector<HTMLElement>('.icen-tree-select-chips');
      if (chips) { chips.hidden = true; chips.replaceChildren(); }
      return;
    }
    if (!multiple) {
      valueEl.textContent = nodes[0]!.label;
      valueEl.classList.remove('is-empty');
      valueEl.hidden = false;
      if (clearBtn) clearBtn.hidden = false;
      const chips = root.querySelector<HTMLElement>('.icen-tree-select-chips');
      if (chips) { chips.hidden = true; chips.replaceChildren(); }
      return;
    }
    /* 多选：chips 接管显示（超过 3 个收 +N） */
    valueEl.classList.remove('is-empty');
    valueEl.hidden = true;
    if (clearBtn) clearBtn.hidden = false;
    let chipsEl = root.querySelector<HTMLElement>('.icen-tree-select-chips');
    if (!chipsEl) {
      chipsEl = document.createElement('span');
      chipsEl.className = 'icen-tree-select-chips';
      trigger.insertAdjacentElement('afterend',chipsEl);
      const chips = chipsEl;
      on(chips,'click',(event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.icen-tree-select-chip-x') : null;
        if (!target) { trigger.click(); return; }
        if (target.disabled) return;
        event.preventDefault();event.stopPropagation();
        const index = Array.from(chips.querySelectorAll('.icen-tree-select-chip-x')).indexOf(target);
        selected.delete(target.dataset.icenValue!);
        syncSelection();
        const remaining = root.querySelectorAll<HTMLButtonElement>('.icen-tree-select-chip-x');
        (remaining[Math.min(index,remaining.length-1)] ?? trigger).focus({preventScroll:true});
      });
    }
    chipsEl.hidden = false;
    chipsEl.textContent = '';
    const maxLabel = 3;
    const shown = nodes.slice(0, maxLabel);
    for (const node of shown) {
      const chip = document.createElement('span');
      chip.className = 'icen-tree-select-chip';
      const lb = document.createElement('span');
      lb.textContent = node.label;
      chip.appendChild(lb);
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'icen-tree-select-chip-x';
      x.dataset.icenValue = node.value;
      x.disabled = opts.disabled === true;
      x.setAttribute('aria-label', t('select.remove',{p0:node.label}));
      x.append(createIcon('close',{size:12})!);
      chip.appendChild(x);
      chipsEl.appendChild(chip);
    }
    const rest = nodes.length - shown.length;
    if (rest > 0) {
      const more = document.createElement('span');
      more.className = 'icen-tree-select-chip icen-tree-select-chip--more';
      more.textContent = `+${rest}`;
      chipsEl.appendChild(more);
    }
  }

  /** 带高亮的 label 渲染：搜索态命中词包 <mark>（textContent 切片组装，禁 innerHTML）。 */
  function renderLabel(row: HTMLElement, node: TreeNode, highlighted: boolean): void {
    const label = document.createElement('span');
    label.className = 'icen-tree-select-label';
    const q = searchQuery.trim().toLowerCase();
    const text = node.label;
    const idx = highlighted && q !== '' ? text.toLowerCase().indexOf(q) : -1;
    if (idx < 0) {
      label.textContent = text;
    } else {
      const before = document.createElement('span');
      before.textContent = text.slice(0, idx);
      const mark = document.createElement('mark');
      mark.textContent = text.slice(idx, idx + q.length);
      const after = document.createElement('span');
      after.textContent = text.slice(idx + q.length);
      label.appendChild(before);
      label.appendChild(mark);
      label.appendChild(after);
    }
    row.appendChild(label);
  }

  interface RowPlan {
    node: TreeNode;
    depth: number;
    parent: TreeNode | null;
    isBranch: boolean;
    isOpen: boolean;
    matched: boolean;
  }

  /** 可见行计划：常规态 = 祖先全展开；搜索态 = 命中 ∪ 祖先 ∪ 命中节点的子孙（上下文）。 */
  function planRows(): RowPlan[] {
    const rows: RowPlan[] = [];
    if (searchMode()) {
      const res = filterTreeNodes(opts.nodes, searchQuery);
      const walk = (list: TreeNode[], depth: number, parent: TreeNode | null): void => {
        for (const node of list) {
          if (!res.keep.has(node.value)) continue;
          const isBranch = (node.children?.length ?? 0) > 0;
          /* 展开态：祖先（expand）与命中节点自身（子孙是命中上下文）都展开 */
          const isOpen =
            isBranch && (res.expand.has(node.value) || res.matched.has(node.value));
          rows.push({
            node, depth, parent, isBranch,
            isOpen,
            matched: res.matched.has(node.value),
          });
          if (isBranch) walk(node.children!, depth + 1, node);
        }
      };
      walk(opts.nodes, 0, null);
      return rows;
    }
    const walk = (list: TreeNode[], depth: number, parent: TreeNode | null): void => {
      for (const node of list) {
        const isBranch = (node.children?.length ?? 0) > 0;
        rows.push({
          node, depth, parent, isBranch,
          isOpen: isBranch && expanded.has(node.value),
          matched: false,
        });
        if (isBranch && expanded.has(node.value)) walk(node.children!, depth + 1, node);
      }
    };
    walk(opts.nodes, 0, null);
    return rows;
  }

  function renderTree(): void {
    const focusedRow=document.activeElement instanceof HTMLElement && tree.contains(document.activeElement) ? document.activeElement.closest<HTMLElement>('.icen-tree-select-row')?.dataset.icenValue : undefined;
    searchField?.refresh();
    const rows = planRows();
    tree.textContent = '';
    /* aria-posinset / aria-setsize：同父可见兄弟内序号 */
    const sizes = new Map<TreeNode | null, number>();
    for (const r of rows) sizes.set(r.parent, (sizes.get(r.parent) ?? 0) + 1);
    const counters = new Map<TreeNode | null, number>();
    rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'icen-tree-select-row';
      row.setAttribute('role', 'treeitem');
      row.tabIndex = i === focusIdx ? 0 : -1;
      if (i === focusIdx) row.classList.add('is-focused');
      row.dataset.icenValue = r.node.value;
      row.style.setProperty('--depth', String(r.depth));
      row.setAttribute('aria-level', String(r.depth + 1));
      const pos = (counters.get(r.parent) ?? 0) + 1;
      counters.set(r.parent, pos);
      row.setAttribute('aria-posinset', String(pos));
      row.setAttribute('aria-setsize', String(sizes.get(r.parent) ?? 1));
      if (r.isBranch) row.classList.add('is-branch');
      if (r.isBranch) row.setAttribute('aria-expanded', r.isOpen ? 'true' : 'false');
      if (r.node.disabled) {
        row.classList.add('is-disabled');
        row.setAttribute('aria-disabled', 'true');
      }
      if (selected.has(r.node.value)) {
        row.classList.add('is-selected');
        row.setAttribute('aria-selected', 'true');
      } else {
        row.setAttribute('aria-selected', 'false');
      }
      if (checkable) {
        const state = treeNodeCheckState(r.node, checkedSet());
        row.classList.add(`is-${state === 'unchecked' ? 'unchecked' : state}`);
        /* aria-checked 三态值：true / false / mixed（区别于内部状态名） */
        row.setAttribute(
          'aria-checked',
          state === 'checked' ? 'true' : state === 'unchecked' ? 'false' : 'mixed',
        );
      }
      /* Row owns keyboard and ARIA expansion; chevron is a decorative pointer target. */
      const toggle = document.createElement('span');
      if (r.isBranch) {
        toggle.className = 'icen-tree-select-toggle';
        if (!r.isOpen) toggle.classList.add('is-collapsed');
        toggle.setAttribute('aria-hidden', 'true');
        toggle.appendChild(branchChevronSvg());
      } else {
        toggle.className = 'icen-tree-select-toggle is-leaf';
        toggle.setAttribute('aria-hidden', 'true');
      }
      row.appendChild(toggle);
      if (checkable) {
        const check = document.createElement('span');
        check.className = 'icen-tree-select-check';
        check.setAttribute('aria-hidden', 'true');
        row.appendChild(check);
      }
      renderLabel(row, r.node, searchMode() && r.matched);
      tree.appendChild(row);
    });
    emptyEl.hidden = rows.length > 0;
    tree.hidden = rows.length === 0;
    if (focusIdx >= rows.length) focusIdx = rows.length - 1;
    if(focusedRow != null) {
      const index=rowEls().findIndex((row)=>row.dataset.icenValue===focusedRow);
      if(index>=0)setFocus(index);
      else (searchInput ?? trigger).focus({preventScroll:true});
    }
    if(isOpen())positionPanel();
  }

  /* ═══ 定值 / 勾选 ═══ */

  function emitChange(): void {
    const nodes = selectedNodesInOrder();
    const value = nodes.map((n) => n.value);
    const labels = nodes.map((n) => n.label);
    emitIcen(root, 'icen:tree-select-change', { value, labels });
    opts.onChange?.(value, labels);
  }

  function syncSelection(emit = true): void {
    renderTrigger();
    renderTree();
    if (emit) emitChange();
  }

  /** 多选 + checkable：整树三态切换（disabled 节点不动）。 */
  function toggleCheckSubtree(node: TreeNode): void {
    if (node.disabled) return;
    const targets = [node, ...flattenTreeNodes(node.children ?? []).map((e) => e.node)]
      .filter((n) => !n.disabled);
    // Disabled descendants can truthfully keep the visual state mixed. Toggle
    // the eligible set, so a parent can still deselect everything it selected.
    const next = !targets.every((target)=>selected.has(target.value));
    for (const t of targets) {
      if (next) selected.add(t.value);
      else selected.delete(t.value);
    }
    syncSelection();
  }

  /** 多选无 checkable：单节点切选。 */
  function toggleSingleMembership(node: TreeNode): void {
    if (node.disabled) return;
    if (selected.has(node.value)) selected.delete(node.value);
    else selected.add(node.value);
    syncSelection();
  }

  /** 单选：定值并关面板。 */
  function chooseSingle(node: TreeNode): void {
    if (node.disabled) return;
    if (opts.leafOnly && (node.children?.length ?? 0) > 0) return;
    selected.clear();
    selected.add(node.value);
    syncSelection();
    closePanel();
    trigger.focus();
  }

  function activateRow(node: TreeNode): void {
    if (multiple) {
      if (checkable) toggleCheckSubtree(node);
      else toggleSingleMembership(node);
    } else {
      chooseSingle(node);
    }
  }

  function clear(): void {
    if (opts.disabled || destroyed) return;
    if (selected.size === 0) return;
    selected.clear();
    syncSelection();
  }

  /* ═══ 键盘导航 ═══ */

  function rowEls(): HTMLElement[] {
    return Array.from(tree.querySelectorAll<HTMLElement>('.icen-tree-select-row'));
  }

  function focusedNode(): TreeNode | null {
    const row = rowEls()[focusIdx];
    const v = row?.dataset.icenValue;
    return v != null ? (known.get(v) ?? null) : null;
  }

  function setFocus(idx: number): void {
    const rows = rowEls();
    if (rows.length === 0 || idx < 0) return;
    const nextIndex = Math.max(0, Math.min(idx, rows.length - 1));
    if(rows[nextIndex]!.classList.contains('is-disabled'))return;
    focusIdx=nextIndex;
    rows.forEach((r, i) => {
      r.tabIndex = i === focusIdx ? 0 : -1;
      r.classList.toggle('is-focused', i === focusIdx);
    });
    if (rows[focusIdx]) revealPopoverItem(rows[focusIdx],panel,{focus:true});
  }

  function moveFocus(delta: number): void {
    const rows = rowEls();
    if (rows.length === 0) return;
    let n = focusIdx < 0 ? (delta > 0 ? -1 : 0) : focusIdx;
    for (let guard = 0; guard < rows.length; guard++) {
      n = (n + delta + rows.length) % rows.length;
      if (!rows[n]!.classList.contains('is-disabled')) break;
    }
    if(!rows[n]!.classList.contains('is-disabled'))setFocus(n);
  }

  function toggleBranch(node: TreeNode): void {
    if ((node.children?.length ?? 0) === 0) return;
    if (expanded.has(node.value)) expanded.delete(node.value);
    else expanded.add(node.value);
    renderTree();
    /* 焦点留在当前行 */
    const idx = rowEls().findIndex((r) => r.dataset.icenValue === node.value);
    if (idx >= 0) setFocus(idx);
  }

  /* ═══ 面板开关 / 定位 ═══ */

  function positionPanel(): void {
    const rect = trigger.getBoundingClientRect();
    const panelWidth = resolvedPanelWidth(rect.width);
    const layout = computePopoverLayout(
      rect,
      { width: window.innerWidth, height: window.innerHeight },
      {
        side: 'bottom',
        align: 'stretch',
        offset: PANEL_OFFSET,
        minWidth: panelWidth,
        maxWidth: panelWidth,
        maxHeight: panelSizing.maxHeight ?? PANEL_MAX_HEIGHT,
      },
    );
    panel.style.left = `${layout.left + window.scrollX}px`;
    panel.style.top = `${layout.top + window.scrollY}px`;
    panel.style.minWidth = `${layout.width}px`;
    panel.style.width = `${layout.width}px`;
    panel.style.maxHeight = `${layout.maxHeight}px`;
    panel.dataset.icenSide = layout.side;
  }

  function openPanel(): void {
    if (isOpen() || opts.disabled || destroyed) return;
    openTreeSelect?.close();
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    if (panel.parentElement !== document.body) document.body.appendChild(panel);
    panel.hidden = false;
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    focusIdx = -1;
    renderTree();
    positionPanel();
    openTreeSelect = { root, trigger, panel, close: closePanel, reposition: positionPanel };
    bindGlobalListeners();
    bindOpenListeners();
    if (searchInput) searchInput.focus();
    else {
      /* 焦点落到首个可选行（或已选中行） */
      const rows = rowEls();
      const selIdx = rows.findIndex((r) => r.classList.contains('is-selected') && !r.classList.contains('is-disabled'));
      setFocus(selIdx >= 0 ? selIdx : rows.findIndex((r)=>!r.classList.contains('is-disabled')));
    }
  }

  function closePanel(): void {
    if (!isOpen()) return;
    panel.hidden = true;
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (openTreeSelect?.panel === panel) openTreeSelect = null;
    unbindOpenListeners();
  }

  /* ═══ 事件接线 ═══ */

  on(trigger, 'click', () => (isOpen() ? closePanel() : openPanel()));

  on(trigger, 'keydown', (ev: KeyboardEvent) => {
    if(ev.isComposing || ev.keyCode === 229)return;
    if (!isOpen()) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault(); // 阻止 button 原生 click 激活，避免双 toggle
        openPanel();
      }
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      closePanel();
      trigger.focus();
    }
  });

  on(tree, 'click', (ev: MouseEvent) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const row = t.closest('.icen-tree-select-row');
    if (!(row instanceof HTMLElement) || !tree.contains(row)) return;
    const node = known.get(row.dataset.icenValue ?? '');
    if (!node) return;
    if (t.closest('.icen-tree-select-toggle') && row.classList.contains('is-branch')) {
      toggleBranch(node);
      return;
    }
    activateRow(node);
  });

  on(tree, 'keydown', (ev: KeyboardEvent) => {
    if (opts.disabled) return;
    if(ev.isComposing || ev.keyCode === 229)return;
    const rtl=getComputedStyle(root).direction === 'rtl';
    const key=rtl ? ev.key === 'ArrowLeft' ? 'ArrowRight' : ev.key === 'ArrowRight' ? 'ArrowLeft' : ev.key : ev.key;
    switch (key) {
      case 'Home':
      case 'End': {
        ev.preventDefault();
        const rows=rowEls();
        const row=(key === 'Home' ? rows : [...rows].reverse()).find((row)=>!row.classList.contains('is-disabled'));
        if(row)setFocus(rows.indexOf(row));
        break;
      }
      case 'ArrowDown':
        ev.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        ev.preventDefault();
        moveFocus(-1);
        break;
      case 'ArrowRight': {
        ev.preventDefault();
        const node = focusedNode();
        if (!node) return;
        const isBranch = (node.children?.length ?? 0) > 0;
        if (!isBranch) return;
        if (!expanded.has(node.value)) toggleBranch(node);
        else {
          /* 已展开：焦点进首子行 */
          const idx = rowEls().findIndex((r) => r.dataset.icenValue === node.value);
          const rows=rowEls(),level=Number(rows[idx]?.getAttribute('aria-level'));
          for(let next=idx+1;next<rows.length && Number(rows[next]!.getAttribute('aria-level'))>level;next++) {
            if(!rows[next]!.classList.contains('is-disabled')) {setFocus(next);break;}
          }
        }
        break;
      }
      case 'ArrowLeft': {
        ev.preventDefault();
        const node = focusedNode();
        if (!node) return;
        const isBranch = (node.children?.length ?? 0) > 0;
        if (isBranch && expanded.has(node.value)) {
          toggleBranch(node);
        } else {
          /* 已折叠 / 叶子：焦点回父行 */
          const parent = flattenTreeNodes(opts.nodes).find(
            (e) => e.node.children?.some((c) => c.value === node.value),
          )?.node;
          if (parent) {
            const idx = rowEls().findIndex((r) => r.dataset.icenValue === parent.value);
            if (idx >= 0) setFocus(idx);
          }
        }
        break;
      }
      case 'Enter':
      case ' ': {
        ev.preventDefault();
        const node = focusedNode();
        if (node) activateRow(node);
        break;
      }
    }
  });

  on(panel,'keydown',(ev:KeyboardEvent)=>{
    if(ev.key !== 'Tab' || ev.isComposing)return;
    const clear=panel.querySelector<HTMLButtonElement>('.icen-search-clear');
    if(ev.target === searchInput && !ev.shiftKey && clear?.hidden === false)return;
    if(ev.target === clear && ev.shiftKey)return;
    closePanel();trigger.focus({preventScroll:true});
  });

  if (searchInput) {
    const filterSearch = () => {
      searchQuery = searchInput!.value;
      focusIdx = -1;
      renderTree();
      /* 命中行渲染后同步 is-focused 态 */
      rowEls().forEach((r, i) => r.classList.toggle('is-focused', i === focusIdx));
    };
    on(searchInput,'input',(ev:InputEvent)=>{if(!ev.isComposing)filterSearch();});
    on(searchInput,'compositionend',filterSearch);
    on(searchInput, 'keydown', (ev: KeyboardEvent) => {
      if(ev.isComposing || ev.keyCode === 229)return;
      if (ev.key === 'Escape') {
        /* 先清搜索词，再关面板 */
        ev.stopPropagation();
        ev.preventDefault();
        if (searchQuery.trim() !== '') {
          searchQuery = '';
          searchInput!.value = '';
          focusIdx = -1;
          renderTree();
        } else {
          closePanel();
          trigger.focus();
        }
        return;
      }
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        /* 搜索态：焦点移进树行导航（is-disabled 行跳过） */
        if (document.activeElement === searchInput && rowEls().length > 0) {
          ev.preventDefault();
          moveFocus(ev.key === 'ArrowDown' ? 1 : -1);
        }
      }
    });
  }

  if (clearBtn) {
    on(clearBtn, 'pointerdown', (ev: PointerEvent) => ev.stopPropagation());
    on(clearBtn, 'click', (ev: MouseEvent) => {
      ev.stopPropagation();
      clear();
    });
  }

  /* 初始化回填 */
  renderTrigger();

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (openTreeSelect?.panel === panel) closePanel();
    ac.abort();
    panel.remove();
    root.remove();
    el.textContent = '';
    if (instances.get(el) === destroy) instances.delete(el);
  }

  instances.set(el, destroy);

  return {
    getValue: () => selectedNodesInOrder().map((n) => n.value),
    getLabels: () => selectedNodesInOrder().map((n) => n.label),
    setValue(v) {
      if(destroyed)return;
      selected.clear();
      for (const val of v) {
        if (known.has(val)) selected.add(val);
        if (!multiple) break;
      }
      renderTrigger();
      renderTree();
    },
    clear,
    open: openPanel,
    close() {
      if(panel.contains(document.activeElement))trigger.focus({preventScroll:true});
      closePanel();
    },
    expandAll() {
      if(destroyed)return;
      for (const e of flattenTreeNodes(opts.nodes)) {
        if (e.node.children?.length) expanded.add(e.node.value);
      }
      if (isOpen()) renderTree();
    },
    collapseAll() {
      if(destroyed)return;
      expanded.clear();
      if (isOpen()) renderTree();
    },
    destroy,
  };
}
