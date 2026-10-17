/*
 * @icen.ai/ui — Behavior: autocomplete（自动补全输入，与 components/autocomplete.css 配套）
 *
 * createAutocomplete(el, opts) → AutocompleteHandle：
 *   el 传 input.icen-input（行为直接挂在这个输入框上）。
 *
 * WAI combobox 完整模式：
 *   - input 挂 role="combobox" + aria-autocomplete="list" + aria-expanded +
 *     aria-controls（面板 id）+ aria-activedescendant（键盘 active 指认）；
 *   - 面板 role="listbox"（portal 到 body），选项 role="option" + aria-selected。
 *
 * 交互：
 *   - 输入变化（IME 组合态挂起，compositionend 后补一次）→ 派
 *     icen:autocomplete-change { value }；字符数 ≥ minChars 时防抖调 source。
 *   - source(query) 负责过滤（同步数组或 Promise）；结果截断到 maxItems；
 *     命中片段以 <mark> 高亮（大小写不敏感）；异步竞态守卫——只渲染最新 query 的结果，
 *     加载期间保留旧列表（诚实呈现上一次已知命中）。
 *   - 键盘：↑↓ 循环移动 active（关闭时按 ↓ 先开层）、Enter 选中（IME 组合态不拦截）、
 *     Esc 关层并还原显示值为最近提交值、Tab 走默认（blur 路径收尾）。
 *   - 失焦：freeSolo=true → 任意输入成立（committed = 当前文本，落定再派一次 change）；
 *     freeSolo=false（默认）→ 失焦无选中则回退显示值为最近提交值。
 *   - 空结果显示 .icen-autocomplete-empty（文案 = opts.noResultsLabel）。
 *   - renderItem(item, query) 可定制选项渲染：返回 Node 直接挂载，string 走 textContent
 *     （自定义渲染时不做 <mark> 高亮）。
 *
 * 面板尺寸契约（PanelSizing）：input 可挂 data-icen-panel-width / -min / -max /
 *   -max-height；面板默认与输入框同宽（align stretch），不足/溢出按视口夹取。
 *
 * 事件（bubbles + composed + cancelable，detail 契约见 events.ts IcenEventMap）：
 *   输入/落定/选中 → icen:autocomplete-change { value }
 *   选中（Enter / 点击）→ icen:autocomplete-select { value, label }（先于 change 派发）
 *
 * SSR 安全（window 未定义静默返回 noop handle）；渲染只写 textContent（禁 innerHTML）；
 * destroy() 摘除监听/面板并还原 input 的 role/aria 属性。
 */

import { emitIcen } from './events';
import { t } from './i18n';
import { revealPopoverItem, computePopoverLayout, resolvePanelSizing, sizingToLayout, type PopoverLayoutOptions } from './popover';

/** 候选项：裸字符串或 { value, label } 对（value 是提交值，label 是展示名）。 */
export type AutocompleteItem = string | { value: string; label: string };

/** 归一后的候选项（renderItem 收到的也是这个形态）。 */
export interface AutocompleteOption {
  value: string;
  label: string;
}

export interface AutocompleteOptions {
  /** 查询过滤源：按 query 返回候选（同步数组或 Promise） */
  source: (query: string) => AutocompleteItem[] | Promise<AutocompleteItem[]>;
  /** 触发查询的最少字符数（默认 1） */
  minChars?: number;
  /** source 调用防抖（默认 160ms；0 = 同步立即调） */
  debounceMs?: number;
  /** 面板最多显示条数（默认 8） */
  maxItems?: number;
  /** true = 允许不在清单的任意输入（失焦落定，只派 change）；false（默认）= 失焦无选中回退原值 */
  freeSolo?: boolean;
  /** 自定义选项渲染：Node 直接挂载 / string 走 textContent（此时不做 <mark> 高亮） */
  renderItem?: (item: AutocompleteOption, query: string) => Node | string;
  /** 空结果态文案（默认取 i18n autocomplete.icen-empty，可被 opts 覆盖） */
  noResultsLabel?: string;
}

export interface AutocompleteHandle {
  /** 最近提交值（选中值 / freeSolo 落定值 / 初始值） */
  getValue(): string;
  /** 设置值（同时更新显示值；不派事件、不开层） */
  setValue(v: string): void;
  /** 程序化开层（按当前输入值拉取并渲染，不受 minChars 限制） */
  open(): void;
  /** 关层（不动显示值） */
  close(): void;
  /** 摘除全部监听/计时器/面板，还原 input role/aria 属性 */
  destroy(): void;
}

let panelSeq = 0;

/** 归一候选项：裸 string → { value, label } 同值；对象必带 string value，label 缺省回退 value。 */
function normalizeItems(raw: unknown): AutocompleteOption[] {
  if (!Array.isArray(raw)) return [];
  const out: AutocompleteOption[] = [];
  for (const it of raw) {
    if (typeof it === 'string') {
      out.push({ value: it, label: it });
    } else if (it && typeof it === 'object' && !Array.isArray(it)) {
      const o = it as Record<string, unknown>;
      if (typeof o.value !== 'string') continue;
      out.push({ value: o.value, label: typeof o.label === 'string' ? o.label : o.value });
    }
  }
  return out;
}

/** 命中片段 <mark> 高亮（大小写不敏感，全部命中包裹；渲染只走 textContent/createElement）。 */
function renderHighlighted(el: HTMLElement, label: string, query: string): void {
  const q = query.trim();
  const hit = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (hit < 0) {
    el.textContent = label;
    return;
  }
  const lower = label.toLowerCase();
  const ql = q.toLowerCase();
  let idx = 0;
  let at = hit;
  while (at >= 0) {
    if (at > idx) el.appendChild(document.createTextNode(label.slice(idx, at)));
    const mark = document.createElement('mark');
    mark.textContent = label.slice(at, at + q.length);
    el.appendChild(mark);
    idx = at + q.length;
    at = lower.indexOf(ql, idx);
  }
  if (idx < label.length) el.appendChild(document.createTextNode(label.slice(idx)));
}

export function createAutocomplete(el: HTMLInputElement, opts: AutocompleteOptions): AutocompleteHandle {
  /* SSR 守卫：window/document 未定义时静默返回 noop handle */
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    const dead: AutocompleteHandle = { getValue: () => '', setValue: () => undefined, open: () => undefined, close: () => undefined, destroy: () => undefined };
    return dead;
  }
  if (!opts || typeof opts.source !== 'function') {
    const dead: AutocompleteHandle = { getValue: () => '', setValue: () => undefined, open: () => undefined, close: () => undefined, destroy: () => undefined };
    return dead;
  }
  const input = el;
  const minChars = Math.max(0, opts.minChars ?? 1);
  const debounceMs = Math.max(0, opts.debounceMs ?? 160);
  const maxItems = Math.max(1, opts.maxItems ?? 8);
  const freeSolo = opts.freeSolo === true;
  const noResultsLabel = opts.noResultsLabel ?? t('autocomplete.empty');

  /* ── 状态 ── */
  let committed = input.value;
  let committedDisplay = input.value;
  let items: AutocompleteOption[] = [];
  let activeIndex = -1;
  let currentQuery = '';
  let open = false;
  let composing = false;
  /** 异步竞态守卫：seq 单调递增，渲染时比对，晚到的结果丢弃 */
  let seq = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  /* ── 面板（portal 到 body）── */
  const panelId = `icen-autocomplete-panel-${++panelSeq}`;
  const panel = document.createElement('div');
  panel.className = 'icen-autocomplete-panel';
  panel.id = panelId;
  panel.hidden = true;
  panel.setAttribute('role', 'listbox');
  document.body.appendChild(panel);

  const empty = document.createElement('div');
  empty.className = 'icen-autocomplete-empty';
  empty.hidden = true;
  empty.textContent = noResultsLabel;
  panel.appendChild(empty);

  /* ── 面板定位：锚定输入框，默认与输入框同宽（align stretch）── */
  function position(): void {
    const rect = input.getBoundingClientRect();
    const anchor = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
    const layoutOpts: PopoverLayoutOptions = {
      side: 'bottom',
      align: 'stretch',
      offset: 4,
      contentHeightHint: items.length * 36 + 16,
    };
    const layout = computePopoverLayout(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      sizingToLayout(resolvePanelSizing(input), layoutOpts),
    );
    panel.style.left = `${layout.left}px`;
    panel.style.top = `${layout.top}px`;
    panel.style.width = `${layout.width}px`;
    panel.style.maxHeight = `${layout.maxHeight}px`;
    panel.dataset.icenSide = layout.side;
  }

  function onWindowChange(): void {
    if (open) position();
  }
  function onDocPointerDown(e: Event): void {
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (panel.contains(target) || input.contains(target)) return;
    setOpen(false);
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    panel.hidden = !next;
    input.setAttribute('aria-expanded', String(next));
    if (next) {
      window.addEventListener('resize', onWindowChange);
      window.addEventListener('scroll', onWindowChange, true);
      document.addEventListener('pointerdown', onDocPointerDown, true);
      position();
      syncActive(); /* 打开后重指 active（渲染时面板尚闭，activedescendant 需补挂） */
    } else {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      input.removeAttribute('aria-activedescendant');
    }
  }

  /** active 项视觉 + aria-activedescendant 同步。 */
  function syncActive(): void {
    Array.from(panel.querySelectorAll<HTMLElement>('.icen-autocomplete-option')).forEach((optEl, i) => {
      const active = i === activeIndex;
      optEl.classList.toggle('is-active', active);
      if (active) optEl.setAttribute('aria-selected', 'true');
      else optEl.removeAttribute('aria-selected');
    });
    if (open && activeIndex >= 0 && items[activeIndex]) {
      input.setAttribute('aria-activedescendant', `${panelId}-opt-${activeIndex}`);
      const active=panel.querySelector<HTMLElement>('.icen-autocomplete-option.is-active');
      if (active) revealPopoverItem(active,panel);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function renderItems(list: AutocompleteOption[]): void {
    panel.querySelectorAll('.icen-autocomplete-option').forEach((n) => n.remove());
    items = list.slice(0, maxItems);
    items.forEach((item, i) => {
      const opt = document.createElement('div');
      opt.className = 'icen-autocomplete-option';
      opt.id = `${panelId}-opt-${i}`;
      opt.setAttribute('role', 'option');
      if (opts.renderItem) {
        const out = opts.renderItem(item, currentQuery);
        if (typeof out === 'string') opt.textContent = out;
        else opt.appendChild(out);
      } else {
        renderHighlighted(opt, item.label, currentQuery);
      }
      /* mousedown preventDefault：保住 input 焦点（click 仍触发选中） */
      opt.addEventListener('mousedown', (e) => e.preventDefault());
      opt.addEventListener('click', () => select(item));
      panel.appendChild(opt);
    });
    empty.hidden = items.length > 0;
    activeIndex = items.length > 0 ? 0 : -1;
    syncActive();
  }

  function moveActive(dir: 1 | -1): void {
    if (items.length === 0) return;
    activeIndex = activeIndex < 0
      ? (dir === 1 ? 0 : items.length - 1)
      : (activeIndex + dir + items.length) % items.length;
    syncActive();
  }

  /** 选中：committed = value、显示 label；先派 select 再派 change。 */
  function select(item: AutocompleteOption): void {
    committed = item.value;
    committedDisplay = item.label;
    input.value = item.label;
    setOpen(false);
    input.focus();
    emitIcen(input, 'icen:autocomplete-select', { value: item.value, label: item.label });
    emitIcen(input, 'icen:autocomplete-change', { value: item.value });
  }

  /** 失焦/Esc 还原：显示值回退到最近提交值（freeSolo 之外的红线行为）。 */
  function revertDisplay(): void {
    if (input.value !== committedDisplay) input.value = committedDisplay;
  }

  /* ── 查询调度：防抖 + 竞态守卫 ── */
  function runSource(query: string): void {
    const mySeq = ++seq;
    let result: ReturnType<AutocompleteOptions['source']>;
    try {
      result = opts.source(query);
    } catch {
      renderItems([]);
      if (!open) setOpen(true);
      return;
    }
    const thenable =
      result !== null && (typeof result === 'object' || typeof result === 'function')
        ? (result as { then?: unknown }).then
        : undefined;
    const apply = (raw: unknown): void => {
      if (destroyed || mySeq !== seq) return; /* 晚到丢弃：只渲染最新 query */
      renderItems(normalizeItems(raw));
      if (!open) setOpen(true);
      else {
        empty.hidden = items.length > 0;
        position();
      }
    };
    if (typeof thenable === 'function') {
      Promise.resolve(result as PromiseLike<unknown>).then(apply, () => {
        if (destroyed || mySeq !== seq) return;
        renderItems([]); /* 源失败：诚实呈空态，不编造候选 */
        if (!open) setOpen(true);
      });
    } else {
      apply(result);
    }
  }

  function schedule(query: string): void {
    currentQuery = query;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (debounceMs > 0) {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runSource(query);
      }, debounceMs);
    } else {
      runSource(query);
    }
  }

  /* ── 事件接线 ── */
  const onInput = (): void => {
    if (composing) return; /* IME 组合态挂起（compositionend 后补一次） */
    const value = input.value;
    emitIcen(input, 'icen:autocomplete-change', { value });
    if (value.length < minChars) {
      seq++;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      setOpen(false);
      return;
    }
    schedule(value);
  };
  const onCompositionStart = (): void => {
    composing = true;
  };
  const onCompositionEnd = (): void => {
    composing = false;
    onInput();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openPanel();
        return;
      }
      moveActive(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter') {
      /* IME 组合态期间 Enter 是确认候选词，绝不拦截 */
      if (composing || e.isComposing) return;
      if (open && activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        select(items[activeIndex]!);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        revertDisplay(); /* Esc 关层并还原 */
        setOpen(false);
      }
      return;
    }
    /* Tab 走默认：blur 路径负责回退/落定 */
  };
  const onBlur = (): void => {
    if (freeSolo) {
      committed = input.value;
      committedDisplay = input.value;
      emitIcen(input, 'icen:autocomplete-change', { value: committed }); /* freeSolo 落定 */
    } else {
      revertDisplay(); /* 失焦无选中回退原值 */
    }
    setOpen(false);
  };

  function openPanel(): void {
    if (open) return;
    runSource(input.value); /* 程序化开层不受 minChars 限制 */
  }

  input.addEventListener('input', onInput);
  input.addEventListener('compositionstart', onCompositionStart);
  input.addEventListener('compositionend', onCompositionEnd);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('blur', onBlur);

  /* a11y 接线（destroy 时还原） */
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', panelId);

  return {
    getValue(): string {
      return committed;
    },
    setValue(v: string): void {
      committed = v;
      committedDisplay = v;
      input.value = v;
      setOpen(false);
    },
    open(): void {
      openPanel();
    },
    close(): void {
      setOpen(false);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      seq++;
      if (debounceTimer) clearTimeout(debounceTimer);
      setOpen(false);
      panel.remove();
      input.removeEventListener('input', onInput);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('blur', onBlur);
      input.removeAttribute('role');
      input.removeAttribute('aria-autocomplete');
      input.removeAttribute('aria-expanded');
      input.removeAttribute('aria-controls');
      input.removeAttribute('aria-activedescendant');
    },
  };
}
