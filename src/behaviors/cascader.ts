/*
 * @icen.ai/ui — Behavior: cascader（级联选择，与 components/cascader.css 配套，函数式 API）
 *
 * 顶层设计：企业表单缺口件——省/市/区、类目/子类目这类「路径型」选择。
 * 数据 = 嵌套 CascaderOption 树；值 = 路径值数组（value: string[]），
 * 展示 = 路径 label join ' / '。函数式 API（与 datatable 同族）：
 *
 *   const c = createCascader(el, {
 *     options: [{ value: 'zj', label: '浙江', children: [{ value: 'hz', label: '杭州' }] }],
 *     changeOnSelect: false,           // false = 必须选到叶子才定值
 *     searchable: true,                // 面板内搜索：跨级过滤，命中显示完整路径（面包屑式）
 *     onChange: (value, path) => {},   // 与 icen:cascader-change { value, path } 双通道
 *   });
 *   c.getValue(); c.getPath(); c.setValue(['zj', 'hz']); c.clear(); c.open(); c.close(); c.destroy();
 *
 * DOM 契约（createCascader 渲染进 el； SSR 下返回 no-op handle）：
 *   <div class="icen-cascader [.is-open]" data-icen-cascader [data-icen-disabled]>
 *     <button class="icen-cascader-trigger icen-pressable icen-focus-ring" role="combobox"
 *             aria-haspopup="listbox" aria-expanded="false" aria-controls="<panelId>" [disabled]>
 *       <span class="icen-cascader-value [.is-empty]">请选择 / 浙江 / 杭州</span>
 *     </button>
 *     <button class="icen-cascader-clear" aria-label="清除" hidden>×</button>  ← clearable；与
 *         trigger 同级（不能嵌套进 button），绝对定位叠进 trigger 行内末端侧、chevron 内侧
 *     <div class="icen-cascader-panel" id="<panelId>" hidden>
 *       <div class="icen-cascader-search">            ← searchable 时渲染
 *         <input class="icen-cascader-search-input" type="search" placeholder="搜索" />
 *       </div>
 *       <div class="icen-cascader-cols">              ← 多列区（搜索态隐藏）；列宽不足时横向滚动
 *         <ul class="icen-cascader-col" role="listbox" data-icen-level="0">
 *           <li class="icen-cascader-item [.is-active|.is-focused|.is-selected|.is-disabled]"
 *               role="option" aria-selected="false" tabindex="-1" data-icen-value="zj">
 *             <span class="icen-cascader-item-label">浙江</span>
 *             <svg class="icen-cascader-item-chevron">…</svg>   ← 有子级的项
 *           </li>
 *         </ul>
 *       </div>
 *       <ul class="icen-cascader-results" role="listbox" hidden>  ← 搜索态单列表（多列区隐藏）
 *         <li class="icen-cascader-result [.is-focused|.is-disabled]" role="option" tabindex="-1"
 *             data-icen-index="0">
 *           <span class="icen-cascader-result-part">浙江</span><i>/</i>
 *           <span class="icen-cascader-result-label">杭州</span>   ← 面包屑式完整路径，分隔符 muted
 *         </li>
 *       </ul>
 *       <div class="icen-cascader-empty" hidden>无匹配</div>      ← opts.emptyLabel
 *     </div>
 *   </div>
 *
 * 交互：trigger 点击开关面板；面板打开时 portal 到 document.body（跳出祖先 overflow
 *   裁切与 stacking context），由 behavior 按 trigger rect 用 computePopoverLayout 定位
 *   （prefer 下方、不足翻上），inline 写 left/top/width/max-height + data-icen-side；
 *   面板尺寸走全库统一 PanelSizing 契约：根 el 挂 data-icen-panel-width / -min /
 *   -max / -max-height（默认 240）。window scroll（capture）/ resize 跟随重定位，
 *   trigger 离场则关闭；外点 / Esc 关闭（document 级单例委托，同时只开一个面板）。
 *   点中间级 = 展开子列；changeOnSelect = true 时任意级点击/Enter 即定值并关面板，
 *   false（默认）= 必须选到叶子。clearable 清除钮有值才显示。
 *
 * 键盘（面板内）：→ 进子级（有子级的项）/ ← 回上级 / ↑↓ 在列内移动（跳过 disabled）/
 *   Enter 定值（叶子或 changeOnSelect）或进子级 / Esc 关面板回 trigger。
 *   搜索态：↑↓ 移动结果 .is-focused，Enter / 点击定值，Esc 先清搜索词再关面板。
 *
 * 事件：icen:cascader-change { value: string[]; path: string[] }（path = 各级 label），
 *   与 opts.onChange 双通道；setValue/clear 程序化通道中 clear 派发、setValue 静默。
 *   SSR 下 createCascader 返回 no-op handle；渲染只写 textContent；同 el 重复 create
 *   先 destroy 旧实例（WeakMap 级幂等）；destroy 摘除 portal + 全部监听。
 */

import { enhanceSearchField } from './input';
import { createIcon } from './icons';
import { revealPopoverItem, computePopoverLayout, resolvePanelSizing } from './popover';
import { emitIcen } from './events';
import { t } from './i18n';

export interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
  disabled?: boolean;
}

export interface CascaderOptions {
  /** Accessible field name; defaults to placeholder. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  options: CascaderOption[];
  /** 初值 = 路径值数组（任一级失配则忽略） */
  value?: string[];
  /** 默认「请选择」 */
  placeholder?: string;
  /** 面板内搜索框：跨级过滤，命中显示完整路径（面包屑式） */
  searchable?: boolean;
  /** true = 点中间级即定值；false（默认）= 必须选到叶子 */
  changeOnSelect?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  /** 搜索无命中文案，默认「无匹配」 */
  emptyLabel?: string;
  /** 搜索框占位，默认「搜索」 */
  searchPlaceholder?: string;
  onChange?: (value: string[], path: string[]) => void;
}

export interface CascaderHandle {
  getValue(): string[];
  /** 当前值的路径 label 数组 */
  getPath(): string[];
  setValue(v: string[]): void;
  clear(): void;
  open(): void;
  close(): void;
  destroy(): void;
}

/* ═══════════ 纯函数（路径求值 / 搜索拍平；模块级导出供单测）═══════════ */

/** 按值路径在选项树中逐级查找，返回命中的节点链（含各层节点）；任一级失配返回 null。 */
export function findCascaderPath(options: CascaderOption[], value: string[]): CascaderOption[] | null {
  let level = options;
  const chain: CascaderOption[] = [];
  for (const v of value) {
    const node = level.find((o) => o.value === v);
    if (!node) return null;
    chain.push(node);
    level = node.children ?? [];
  }
  return chain;
}

/** 拍平全部「根 → 叶子」路径（搜索态数据源；含 disabled 节点的路径也返回，定值时单独判）。 */
export function collectCascaderLeafPaths(options: CascaderOption[]): CascaderOption[][] {
  const out: CascaderOption[][] = [];
  const walk = (nodes: CascaderOption[], prefix: CascaderOption[]): void => {
    for (const node of nodes) {
      const path = [...prefix, node];
      if (node.children && node.children.length > 0) walk(node.children, path);
      else out.push(path);
    }
  };
  walk(options, []);
  return out;
}

/** 跨级过滤：路径上任一节点 label 含 query（大小写不敏感）即保留整条叶子路径。 */
export function filterCascaderPaths(paths: CascaderOption[][], query: string): CascaderOption[][] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return paths.filter((path) =>
    path.some((node) => node.label.toLowerCase().includes(q)),
  );
}

/** 节点链 → label 数组（事件 path / trigger 展示共用）。 */
export function cascaderPathLabels(path: CascaderOption[]): string[] {
  return path.map((node) => node.label);
}

/** 无 DOM（SSR）时的 no-op handle。 */
function noopHandle(): CascaderHandle {
  const noop = (): void => undefined;
  return {
    getValue: () => [],
    getPath: () => [],
    setValue: noop,
    clear: noop,
    open: noop,
    close: noop,
    destroy: noop,
  };
}

/* ═══════════ 面板定位 / 单例（参照 behaviors/select.ts 同款骨架）═══════════ */

/** 当前打开的 cascader（模块级单例，同时只开一个）。 */
interface OpenCascader {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  close: () => void;
  reposition: () => void;
}

let openCascader: OpenCascader | null = null;
let globalBound = false;
let uidSeq = 0;

/** 面板与 trigger 的垂直间距、面板最大高度上限（与 select.css 的 max-height 对齐）。 */
const PANEL_OFFSET = 4;
const PANEL_MAX_HEIGHT = 240;

function onGlobalPointerDown(ev: Event): void {
  const cur = openCascader;
  if (!cur) return;
  const t = ev.target;
  if (!(t instanceof Node)) return;
  // panel 已 portal 到 body，不再是 root 的后代，需单独判断
  if (cur.root.contains(t) || cur.panel.contains(t)) return;
  cur.close();
}

function onGlobalKeyDown(ev: KeyboardEvent): void {
  if (ev.key !== 'Escape' || ev.isComposing || ev.keyCode === 229) return;
  const cur = openCascader;
  if (!cur) return;
  cur.close();
  cur.trigger.focus();
}

/** scroll（capture，含内层滚动容器）/ resize 时跟随 trigger 重定位；trigger 离场则关闭。 */
function onWindowChange(): void {
  const cur = openCascader;
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

/** 活跃实例登记：最后一个销毁时连带摘除全局委托（对齐 select.ts 的 activeSetups）。 */
const activeSetups = new Set<() => void>();

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

/** 右指 chevron（SVG，currentColor 随 token 走）。 */
function chevronSvg(): SVGSVGElement { return createIcon('chevron-right')!; }

export function createCascader(el: HTMLElement, opts: CascaderOptions): CascaderHandle {
  if (typeof document === 'undefined') return noopHandle();
  /* 幂等 create：同 el 复 create 先 destroy 旧的 */
  instances.get(el)?.();

  /* 本实例全部监听挂同一 AbortSignal：destroy 一次摘净 */
  const ac = new AbortController();
  const on = <T extends Event>(t: EventTarget, ev: string, fn: (e: T) => void): void => {
    const listener: EventListener = (evt) => fn(evt as T);
    t.addEventListener(ev, listener, { signal: ac.signal });
  };

  const placeholder = opts.placeholder ?? t('cascader.placeholder');
  const emptyLabel = opts.emptyLabel ?? t('cascader.noMatch');

  /* ═══ 状态 ═══ */
  let value: string[] =
    opts.value && opts.value.length > 0 && findCascaderPath(opts.options, opts.value)
      ? [...opts.value]
      : [];
  /** 面板打开期间的高亮路径（决定渲染哪些列 + 各级 is-active） */
  let activePath: string[] = [...value];
  /** 键盘焦点位：列号 + 列内索引（含 disabled 的全量索引） */
  let focus: { col: number; idx: number } = { col: 0, idx: 0 };
  let searchQuery = '';
  let resultFocus = -1;
  let searchHits: CascaderOption[][] = [];
  let destroyed = false;

  /* ═══ DOM 骨架（全部 textContent，禁 innerHTML）═══ */
  el.textContent = '';
  const root = document.createElement('div');
  root.className = 'icen-cascader';
  if (opts.size && opts.size !== 'md') root.classList.add('icen-cascader--' + opts.size);
  root.setAttribute('data-icen-cascader', '');
  if (opts.disabled) root.setAttribute('data-icen-disabled', '');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'icen-cascader-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label',opts.label ?? placeholder);
  if (opts.disabled) trigger.disabled = true;

  const valueEl = document.createElement('span');
  valueEl.className = 'icen-cascader-value';
  trigger.appendChild(valueEl);
  const triggerChevron = createIcon('chevron-down', { size: 12, className: 'icen-cascader-chevron' });
  if (triggerChevron) {
    triggerChevron.setAttribute('aria-hidden', 'true');
    trigger.appendChild(triggerChevron);
  }

  let clearBtn: HTMLButtonElement | null = null;
  if (opts.clearable) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.disabled = opts.disabled === true;
    clearBtn.className = 'icen-cascader-clear';
    clearBtn.setAttribute('aria-label', '清除');
    clearBtn.hidden = true;
    clearBtn.append(createIcon('close')!);
    clearBtn.classList.add('icen-icon-action');
    clearBtn.setAttribute('data-icen-reveal','');
    root.appendChild(clearBtn);
  }

  const uid = ++uidSeq;
  const panel = document.createElement('div');
  panel.className = 'icen-cascader-panel';
  panel.id = `icen-cascader-panel-${uid}`;
  panel.hidden = true;
  trigger.setAttribute('aria-controls', panel.id);

  let searchInput: HTMLInputElement | null = null;
  if (opts.searchable) {
    const searchWrap = document.createElement('div');
    searchWrap.className = 'icen-cascader-search';
    searchInput = document.createElement('input');
    searchInput.className = 'icen-cascader-search-input';
    searchInput.type = 'search';
    searchInput.placeholder = opts.searchPlaceholder ?? t('cascader.search');
    searchInput.setAttribute('aria-label',searchInput.placeholder);
    searchWrap.appendChild(searchInput);
    panel.appendChild(searchWrap);
  }
  const searchField=searchInput ? enhanceSearchField(searchInput) : null;
  ac.signal.addEventListener('abort',()=>searchField?.destroy(),{once:true});


  const cols = document.createElement('div');
  cols.className = 'icen-cascader-cols';
  panel.appendChild(cols);

  const results = document.createElement('ul');
  results.className = 'icen-cascader-results';
  results.id = `icen-cascader-results-${uid}`;
  results.setAttribute('role', 'listbox');
  results.setAttribute('aria-label',opts.label ?? placeholder);
  if(searchInput) {
    searchInput.setAttribute('role','combobox');
    searchInput.setAttribute('aria-autocomplete','list');
    searchInput.setAttribute('aria-controls',results.id);
    searchInput.setAttribute('aria-expanded','false');
  }
  results.hidden = true;
  panel.appendChild(results);

  const emptyEl = document.createElement('div');
  emptyEl.className = 'icen-cascader-empty';
  emptyEl.setAttribute('role','status');
  emptyEl.textContent = emptyLabel;
  emptyEl.hidden = true;
  panel.appendChild(emptyEl);

  root.insertBefore(trigger,clearBtn);
  root.appendChild(panel);
  el.appendChild(root);

  /* 面板尺寸：统一 PanelSizing 契约（data-icen-panel-width / -min / -max / -max-height 挂根 el） */
  const panelSizing = resolvePanelSizing(el);

  /** 面板宽：固定 > max 收窄 > min 放宽 > trigger 宽（与 select 同规则）。 */
  function resolvedPanelWidth(triggerWidth: number): number {
    let w = Math.max(triggerWidth, cols.children.length * 160 + 16);
    if (panelSizing.minWidth != null) w = Math.max(w, panelSizing.minWidth);
    if (panelSizing.maxWidth != null) w = Math.min(w, panelSizing.maxWidth);
    if (panelSizing.width != null) w = panelSizing.width;
    return w;
  }

  const isOpen = (): boolean => !panel.hidden;
  const searchMode = (): boolean => opts.searchable === true && searchQuery.trim() !== '';

  /** RTL：子列生长方向随书写方向镜像，←/→ 键语义同步翻转。 */
  const isRtl = (): boolean => {
    const dir = root.closest('[dir]')?.getAttribute('dir');
    return dir === 'rtl';
  };

  /** activePath 前 col 级解析出的子级列表（第 col 列的选项源）。 */
  function optionsAt(col: number): CascaderOption[] {
    let level = opts.options;
    for (let i = 0; i < col; i++) {
      const node = level.find((o) => o.value === activePath[i]);
      if (!node?.children) return [];
      level = node.children;
    }
    return level;
  }

  /** activePath 的可解析深度（失配即停；叶子不加列）。 */
  function activeDepth(): number {
    let level = opts.options;
    let depth = 0;
    for (const v of activePath) {
      const node = level.find((o) => o.value === v);
      if (!node) break;
      depth++;
      level = node.children ?? [];
    }
    return depth;
  }

  /** activePath.slice(0, col) + val 的节点链；失配 null。 */
  function chainTo(col: number, val: string): CascaderOption[] | null {
    return findCascaderPath(opts.options, [...activePath.slice(0, col), val]);
  }

  /** 第 col 列内 data-icen-value=val 的全量索引（含 disabled；未找到 -1）。 */
  function indexInColumn(col: number, val: string): number {
    const colEl = cols.children[col];
    if (!colEl) return -1;
    const items = Array.from(colEl.querySelectorAll<HTMLElement>('.icen-cascader-item'));
    return items.findIndex((it) => it.dataset.icenValue === val);
  }

  /* ═══ 渲染 ═══ */

  function renderTrigger(): void {
    const chain = findCascaderPath(opts.options, value);
    if (!chain || chain.length === 0) {
      valueEl.textContent = placeholder;
      valueEl.classList.add('is-empty');
    } else {
      valueEl.textContent = cascaderPathLabels(chain).join(' / ');
      valueEl.classList.remove('is-empty');
    }
    if (clearBtn) clearBtn.hidden = !(chain && chain.length > 0);
  }

  function renderColumns(): void {
    cols.textContent = '';
    const depth = activeDepth();
    const colCount = Math.max(1, depth + 1);
    for (let i = 0; i < colCount; i++) {
      const level = optionsAt(i);
      if (level.length === 0) break;
      const ul = document.createElement('ul');
      ul.className = 'icen-cascader-col';
      ul.setAttribute('role', 'listbox');
      ul.setAttribute('aria-label',i === 0 ? (opts.label ?? placeholder) : optionsAt(i-1).find((node)=>node.value===activePath[i-1])?.label ?? placeholder);
      ul.dataset.icenLevel = String(i);
      level.forEach((opt, idx) => {
        const li = document.createElement('li');
        li.className = 'icen-cascader-item';
        li.setAttribute('role', 'option');
        li.tabIndex = -1;
        li.dataset.icenValue = opt.value;
        if (opt.disabled) li.classList.add('is-disabled');
        if (opt.disabled) li.setAttribute('aria-disabled','true');
        const itemPathVals = [...activePath.slice(0, i), opt.value];
        const isActive = activePath[i] === opt.value;
        /* 已提交值的路径经过此项 → is-selected（含祖先级） */
        const isSelected =
          value.length >= itemPathVals.length &&
          itemPathVals.every((v, k) => value[k] === v);
        if (isActive) {
          li.classList.add('is-active');
          li.setAttribute('aria-selected', 'true');
        } else {
          li.setAttribute('aria-selected', 'false');
        }
        if (isSelected) li.classList.add('is-selected');
        if (i === focus.col && idx === focus.idx) li.classList.add('is-focused');
        const label = document.createElement('span');
        label.className = 'icen-cascader-item-label';
        label.textContent = opt.label;
        li.appendChild(label);
        if (opt.children && opt.children.length > 0) {
          const ic = chevronSvg();
          ic.classList.add('icen-cascader-item-chevron');
          li.appendChild(ic);
        }
        ul.appendChild(li);
      });
      cols.appendChild(ul);
    }
    /* 焦点位夹取到真实列/项范围 */
    const rendered = cols.children.length;
    focus.col = Math.max(0, Math.min(focus.col, rendered - 1));
    const colEl = cols.children[focus.col];
    const count = colEl ? colEl.querySelectorAll('.icen-cascader-item').length : 0;
    focus.idx = Math.max(0, Math.min(focus.idx, Math.max(0, count - 1)));
    if (isOpen()) positionPanel();
  }

  function renderResults(): void {
    searchField?.refresh();
    const searching = searchMode();
    searchInput?.setAttribute('aria-expanded',String(searching && isOpen()));
    searchInput?.removeAttribute('aria-activedescendant');
    cols.hidden = searching;
    results.hidden = !searching;
    if (!searching) {
      emptyEl.hidden = opts.options.length > 0;
      return;
    }
    searchHits = filterCascaderPaths(collectCascaderLeafPaths(opts.options), searchQuery);
    results.textContent = '';
    searchHits.forEach((path, i) => {
      const leaf = path[path.length - 1]!;
      const li = document.createElement('li');
      li.className = 'icen-cascader-result';
      li.id = `icen-cascader-result-${uid}-${i}`;
      li.setAttribute('role', 'option');
      li.tabIndex = -1;
      li.dataset.icenIndex = String(i);
      if (path.some((node) => node.disabled)) li.classList.add('is-disabled');
      li.setAttribute('aria-disabled',String(path.some((node)=>node.disabled)));
      li.setAttribute('aria-selected',String(path.length === value.length && path.every((node,k)=>node.value === value[k])));
      path.forEach((node, k) => {
        if (k > 0) {
          const sep = document.createElement('i');
          sep.textContent = '/';
          li.appendChild(sep);
        }
        const sp = document.createElement('span');
        sp.className = k === path.length - 1 ? 'icen-cascader-result-label' : 'icen-cascader-result-part';
        sp.textContent = node.label;
        li.appendChild(sp);
      });
      if (i === resultFocus) li.classList.add('is-focused');
      results.appendChild(li);
    });
    emptyEl.hidden = searchHits.length > 0;
    if (resultFocus >= searchHits.length) resultFocus = searchHits.length - 1;
    syncResultFocus();
  }

  /* ═══ 定值 / 清除 ═══ */

  function commit(chain: CascaderOption[]): void {
    value = chain.map((node) => node.value);
    renderTrigger();
    const labels = cascaderPathLabels(chain);
    emitIcen(root, 'icen:cascader-change', { value: [...value], path: labels });
    opts.onChange?.([...value], labels);
  }

  function clear(): void {
    if (opts.disabled || destroyed) return;
    value = [];
    activePath = [];
    renderTrigger();
    renderColumns();
    renderResults();
    emitIcen(root, 'icen:cascader-change', { value: [], path: [] });
    opts.onChange?.([], []);
  }

  /* ═══ 键盘导航 ═══ */

  function focusActiveItem(): void {
    const colEl = cols.children[focus.col];
    if (!colEl) return;
    const items = Array.from(colEl.querySelectorAll<HTMLElement>('.icen-cascader-item'));
    if(items[focus.idx]?.classList.contains('is-disabled'))focus.idx=items.findIndex((item)=>!item.classList.contains('is-disabled'));
    items.forEach((item,index)=>item.classList.toggle('is-focused',index===focus.idx));
    const item = items[focus.idx];
    if (!item) return;
    revealPopoverItem(item,panel,{focus:true});
    revealPopoverItem(colEl as HTMLElement,cols,{axis:'inline'});
  }

  function moveVertical(delta: number): void {
    const colEl = cols.children[focus.col];
    if (!colEl) return;
    const items = Array.from(colEl.querySelectorAll<HTMLElement>('.icen-cascader-item'));
    if (items.length === 0) return;
    let n = focus.idx;
    for (let guard = 0; guard < items.length; guard++) {
      n = (n + delta + items.length) % items.length;
      if (!items[n]!.classList.contains('is-disabled')) break;
    }
    if(items[n]!.classList.contains('is-disabled'))return;
    focus.idx = n;
    activePath = [...activePath.slice(0, focus.col), items[n]!.dataset.icenValue ?? ''];
    renderColumns();
    focusActiveItem();
  }

  function drillIn(): void {
    const colEl = cols.children[focus.col];
    const item = colEl?.querySelectorAll<HTMLElement>('.icen-cascader-item')[focus.idx];
    if (!item || item.classList.contains('is-disabled')) return;
    const chain = chainTo(focus.col, item.dataset.icenValue ?? '');
    const node = chain?.[chain.length - 1];
    if (!chain || !node?.children?.length) return;
    activePath = chain.map((c) => c.value);
    focus = { col: focus.col + 1, idx: 0 };
    renderColumns();
    focusActiveItem();
  }

  function goParent(): void {
    if (focus.col <= 0) return;
    focus.col -= 1;
    const activeVal = activePath[focus.col];
    activePath = activePath.slice(0, focus.col + 1);
    renderColumns();
    const idx = activeVal != null ? indexInColumn(focus.col, activeVal) : -1;
    if (idx >= 0 && idx !== focus.idx) {
      focus.idx = idx;
      renderColumns();
    }
    focusActiveItem();
  }

  function enterActive(): void {
    const colEl = cols.children[focus.col];
    const item = colEl?.querySelectorAll<HTMLElement>('.icen-cascader-item')[focus.idx];
    if (!item || item.classList.contains('is-disabled')) return;
    const chain = chainTo(focus.col, item.dataset.icenValue ?? '');
    if (!chain) return;
    const node = chain[chain.length - 1]!;
    if (!node.children?.length || opts.changeOnSelect) {
      commit(chain);
      closePanel();
      trigger.focus();
    } else {
      drillIn();
    }
  }

  function resultItems(): HTMLElement[] {
    return Array.from(results.querySelectorAll<HTMLElement>('.icen-cascader-result'));
  }

  function syncResultFocus(): void {
    const items=resultItems();
    items.forEach((item,index)=>item.classList.toggle('is-focused',index===resultFocus));
    const item=items[resultFocus];
    if(item && !item.classList.contains('is-disabled')) {
      searchInput?.setAttribute('aria-activedescendant',item.id);
      revealPopoverItem(item,panel);
    } else searchInput?.removeAttribute('aria-activedescendant');
  }

  function moveResultFocus(delta: number): void {
    const items=resultItems();
    let index=resultFocus < 0 ? (delta>0 ? -1 : 0) : resultFocus;
    for(let step=0;step<items.length;step++) {
      index=(index+delta+items.length)%items.length;
      if(!items[index]!.classList.contains('is-disabled')) {resultFocus=index;syncResultFocus();return;}
    }
    resultFocus=-1;syncResultFocus();
  }

  function chooseResult(index: number): void {
    const hit = searchHits[index];
    const leaf = hit?.[hit.length - 1];
    if (!hit || !leaf || hit.some((node) => node.disabled)) return;
    commit(hit);
    closePanel();
    trigger.focus();
  }

  /* ═══ 面板开关 / 定位（portal 到 body，与 select 同款）═══ */

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
        contentHeightHint: panel.scrollHeight,
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
    openCascader?.close();
    activePath = [...value];
    focus = { col: Math.max(0, activePath.length), idx: 0 };
    searchQuery = '';
    resultFocus = -1;
    if (searchInput) searchInput.value = '';
    /* portal：跳出祖先 overflow 裁切与 stacking context；只移一次，关闭不移回 */
    if (panel.parentElement !== document.body) document.body.appendChild(panel);
    panel.hidden = false;
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    renderColumns();
    /* 焦点落到已提交路径的最深层项（renderColumns 已夹取 focus.col） */
    const activeVal = activePath[focus.col];
    if (activeVal != null) {
      const idx = indexInColumn(focus.col, activeVal);
      if (idx >= 0 && idx !== focus.idx) {
        focus.idx = idx;
        renderColumns();
      }
    }
    renderResults();
    positionPanel();
    openCascader = { root, trigger, panel, close: closePanel, reposition: positionPanel };
    bindGlobalListeners();
    bindOpenListeners();
    if (searchInput) searchInput.focus();
    else focusActiveItem();
  }

  function closePanel(): void {
    if (!isOpen()) return;
    panel.hidden = true;
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    searchInput?.setAttribute('aria-expanded','false');
    searchInput?.removeAttribute('aria-activedescendant');
    if (openCascader?.panel === panel) openCascader = null;
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

  on(cols, 'click', (ev: MouseEvent) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const item = t.closest('.icen-cascader-item');
    if (!(item instanceof HTMLElement) || !cols.contains(item)) return;
    if (item.classList.contains('is-disabled')) return;
    const colEl = item.closest('.icen-cascader-col');
    const col = colEl ? Array.from(cols.children).indexOf(colEl) : 0;
    const val = item.dataset.icenValue ?? '';
    const chain = chainTo(col, val);
    if (!chain) return;
    const node = chain[chain.length - 1]!;
    activePath = chain.map((c) => c.value);
    focus = { col, idx: Math.max(0, indexInColumn(col, val)) };
    if (!node.children?.length || opts.changeOnSelect) {
      commit(chain);
      closePanel();
      trigger.focus();
    } else {
      renderColumns();
      focusActiveItem();
    }
  });

  on(results, 'click', (ev: MouseEvent) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const item = t.closest('.icen-cascader-result');
    if (!(item instanceof HTMLElement) || !results.contains(item)) return;
    chooseResult(Number(item.dataset.icenIndex ?? -1));
  });

  on(results, 'mouseover', (ev: MouseEvent) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const item = t.closest('.icen-cascader-result');
    if (!(item instanceof HTMLElement)) return;
    const idx = resultItems().indexOf(item);
    if (idx >= 0 && !item.classList.contains('is-disabled')) {
      resultFocus = idx;
      syncResultFocus();
    }
  });

  on(panel, 'keydown', (ev: KeyboardEvent) => {
    if (opts.disabled) return;
    if(ev.isComposing || ev.keyCode === 229)return;
    if(ev.key === 'Tab') {
      const clear=panel.querySelector<HTMLButtonElement>('.icen-search-clear');
      if(ev.target === searchInput && !ev.shiftKey && clear?.hidden === false)return;
      if(ev.target === clear && ev.shiftKey)return;
      closePanel();trigger.focus({preventScroll:true});return;
    }
    if(ev.target instanceof Element && ev.target.closest('.icen-search-clear'))return;
    if (searchMode()) {
      const items = resultItems();
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (items.length === 0) return;
        moveResultFocus(ev.key === 'ArrowDown' ? 1 : -1);
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        if(resultFocus < 0)moveResultFocus(1);
        if (resultFocus >= 0) chooseResult(resultFocus);
      }
      return;
    }
    if(ev.target === searchInput && !['ArrowDown','ArrowUp'].includes(ev.key))return;
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        if(ev.target === searchInput)focus.idx=-1;
        moveVertical(1);
        break;
      case 'ArrowUp':
        ev.preventDefault();
        if(ev.target === searchInput)focus.idx=0;
        moveVertical(-1);
        break;
      case 'Home':
      case 'End': {
        ev.preventDefault();
        focus.idx=ev.key === 'Home' ? -1 : 0;
        moveVertical(ev.key === 'Home' ? 1 : -1);
        break;
      }
      case 'ArrowRight':
        ev.preventDefault();
        if (isRtl()) goParent();
        else drillIn();
        break;
      case 'ArrowLeft':
        ev.preventDefault();
        if (isRtl()) drillIn();
        else goParent();
        break;
      case 'Enter':
        ev.preventDefault();
        enterActive();
        break;
    }
  });

  if (searchInput) {
    const filterSearch = () => {
      searchQuery = searchInput!.value;
      resultFocus = -1;
      renderResults();
    };
    on(searchInput, 'input', (ev:InputEvent) => {if(!ev.isComposing)filterSearch();});
    on(searchInput, 'compositionend',filterSearch);
    on(searchInput, 'keydown', (ev: KeyboardEvent) => {
      if(ev.isComposing || ev.keyCode === 229)return;
      if (ev.key !== 'Escape') return;
      /* 阻止冒泡到 document 级 Esc 委托：先清搜索词，再关面板 */
      ev.stopPropagation();
      ev.preventDefault();
      if (searchQuery.trim() !== '') {
        searchQuery = '';
        searchInput!.value = '';
        resultFocus = -1;
        renderResults();
      } else {
        closePanel();
        trigger.focus();
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
    /* 打开状态下销毁：先收浮层（隐藏面板 + 摘 window 监听 + 清单例），防泄漏 */
    if (openCascader?.panel === panel) closePanel();
    ac.abort();
    /* panel 已 portal 到 body：自建节点直接移除；root 随 el 清理一并摘除 */
    panel.remove();
    root.remove();
    el.textContent = '';
    if (instances.get(el) === destroy) instances.delete(el);
    /* 最后一个实例销毁时摘除全局委托（同 select.ts 口径），SPA 反复挂载不再累积 */
    activeSetups.delete(destroy);
    if (!activeSetups.size && globalBound) {
      document.removeEventListener('pointerdown', onGlobalPointerDown);
      document.removeEventListener('keydown', onGlobalKeyDown);
      globalBound = false;
    }
  }

  instances.set(el, destroy);
  activeSetups.add(destroy);

  return {
    getValue: () => [...value],
    getPath: () => {
      const chain = findCascaderPath(opts.options, value);
      return chain ? cascaderPathLabels(chain) : [];
    },
    setValue(v) {
      if(destroyed)return;
      const chain = findCascaderPath(opts.options, v);
      if (!chain) return;
      value = [...v];
      activePath = [...v];
      renderTrigger();
      renderColumns();
    },
    clear,
    open: openPanel,
    close() {
      if(panel.contains(document.activeElement))trigger.focus({preventScroll:true});
      closePanel();
    },
    destroy,
  };
}
