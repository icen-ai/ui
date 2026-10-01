/*
 * @icen.ai/ui — Behavior: select（弹层选择器，与 components/select.css 配套，data 属性驱动）
 *
 * DOM 契约（基础单选）：
 *   <div class="select" data-select>
 *     <button class="select-trigger" aria-haspopup="listbox" aria-expanded="false">
 *       <span class="select-value is-empty">占位</span>
 *       <svg class="select-chevron">…</svg>
 *     </button>
 *     <div class="select-panel" hidden>
 *       <button class="select-option" data-value="x">…</button>
 *     </div>
 *     <input type="hidden" data-select-value />   可选：选中后同步 value 并派发 change
 *   </div>
 *
 * 增强模式：
 *   data-select-search          可搜索/过滤：面板顶部自动插入搜索输入框
 *   data-select-multiple        多选：点击切选（不关面板），trigger 显示计数/标签，hidden input 同步逗号分隔值
 *   data-select-max="3"         多选上限（配合 data-select-multiple），达到上限后其余选项 .is-disabled
 *   data-select-placeholder     自定义占位文案（也可直接写在 .select-value 内）
 *
 * 分组：面板内可用 .select-group > .select-group-label + .select-option 结构，
 *   搜索过滤时自动隐藏空分组。
 *
 * 交互：trigger 点击开关面板；选项点击 → .is-selected、.select-value 文本更新（单选）
 *   或切选（多选）；Esc / 外点关闭；↑↓ 移动 .is-focused（跳过 disabled / hidden）；
 *   Enter/Space 选中；搜索框输入实时过滤选项。同一容器重复 init 幂等。
 *
 * 浮层：面板首次打开时 portal 到 document.body（跳出祖先 overflow 裁切与
 *   stacking context），由 behavior 按 trigger rect 用 computePopoverLayout 计算
 *   定位（prefer 下方、空间不足翻上），inline 写入 left/top/min-width/width/max-height
 *   并同步 data-side；window scroll（capture）/ resize 时跟随重定位（trigger 离场则
 *   关闭）；关闭仅隐藏，不移回原位。外点 / Esc 用 document 级单例委托（参照
 *   dropdown.ts），同时只开一个 panel。
 */

import { computePopoverLayout } from './popover';

interface MarkedSelect extends Element {
  __icenSelectInit?: boolean;
}

/** 当前打开的 select（模块级单例，同时只开一个）。 */
interface OpenSelect {
  container: Element;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  close: () => void;
  reposition: () => void;
}

let openSelect: OpenSelect | null = null;
let globalBound = false;

/** 面板与 trigger 的垂直间距、面板最大高度上限（与 select.css 的 max-height 对齐）。 */
const PANEL_OFFSET = 4;
const PANEL_MAX_HEIGHT = 240;

function onGlobalPointerDown(ev: Event): void {
  const cur = openSelect;
  if (!cur) return;
  const t = ev.target;
  if (!(t instanceof Node)) return;
  // panel 已 portal 到 body，不再是 container 的后代，需单独判断
  if (cur.container.contains(t) || cur.panel.contains(t)) return;
  cur.close();
}

function onGlobalKeyDown(ev: KeyboardEvent): void {
  if (ev.key !== 'Escape') return;
  const cur = openSelect;
  if (!cur) return;
  cur.close();
  cur.trigger.focus();
}

/** scroll（capture，含内层滚动容器）/ resize 时跟随 trigger 重定位；trigger 离场则关闭。 */
function onWindowChange(): void {
  const cur = openSelect;
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

function setup(container: Element): void {
  const el = container as MarkedSelect;
  if (el.__icenSelectInit) return;
  el.__icenSelectInit = true;

  const triggerEl = container.querySelector<HTMLButtonElement>('.select-trigger');
  const panelEl = container.querySelector<HTMLElement>('.select-panel');
  const valueEl = container.querySelector<HTMLElement>('.select-value');
  const hiddenInput = container.querySelector<HTMLInputElement>('input[data-select-value]');
  if (!triggerEl || !panelEl) return;
  // 闭包内不保留 narrowing，转为非空常量
  const trigger = triggerEl;
  const panel = panelEl;

  const isMultiple = container.hasAttribute('data-select-multiple');
  const isSearchable = container.hasAttribute('data-select-search');
  const maxSelect = Number(container.getAttribute('data-select-max')) || 0;
  const placeholder =
    container.getAttribute('data-select-placeholder') ??
    (valueEl?.classList.contains('is-empty') ? (valueEl?.textContent ?? '') : '');

  // panel portal 到 body 后不再是 .select 的后代，把多选标记复制到 panel 上供 CSS 挂钩
  if (isMultiple) panel.setAttribute('data-select-multiple', '');

  let searchInput: HTMLInputElement | null = null;
  let focusIdx = -1;

  // ── 搜索框：自动插入（若面板内尚无 .select-search-input）──
  if (isSearchable && !panel.querySelector('.select-search-input')) {
    const searchWrap = document.createElement('div');
    searchWrap.className = 'select-search';
    const input = document.createElement('input');
    input.className = 'select-search-input';
    input.type = 'search';
    input.placeholder = '搜索…';
    searchWrap.appendChild(input);
    panel.insertBefore(searchWrap, panel.firstChild);
  }
  searchInput = panel.querySelector<HTMLInputElement>('.select-search-input');

  /** 获取所有选项按钮（不在分组容器内的也包含）。 */
  const allOptions = (): HTMLButtonElement[] =>
    Array.from(panel.querySelectorAll<HTMLButtonElement>('.select-option'));

  /** 获取当前可见（未被搜索过滤）的选项。 */
  const visibleOptions = (): HTMLButtonElement[] =>
    allOptions().filter((o) => !o.hidden);

  const isOpen = (): boolean => !panel.hidden;

  function setFocus(idx: number): void {
    const opts = visibleOptions();
    focusIdx = Math.max(-1, Math.min(idx, opts.length - 1));
    opts.forEach((o, i) => o.classList.toggle('is-focused', i === focusIdx));
    const cur = focusIdx >= 0 ? opts[focusIdx] : undefined;
    cur?.scrollIntoView({ block: 'nearest' });
  }

  function firstEnabled(): number {
    return visibleOptions().findIndex((o) => !o.classList.contains('is-disabled'));
  }

  function moveFocus(delta: number): void {
    const opts = visibleOptions();
    if (opts.length === 0) return;
    let n = focusIdx;
    for (let guard = 0; guard < opts.length; guard++) {
      n = (n + delta + opts.length) % opts.length;
      const opt = opts[n];
      if (opt && !opt.classList.contains('is-disabled')) break;
    }
    setFocus(n);
  }

  // ── 空状态元素（若面板内尚无 .select-empty 则自动创建）──
  let emptyEl = panel.querySelector<HTMLElement>('.select-empty');
  if (!emptyEl) {
    emptyEl = document.createElement('div');
    emptyEl.className = 'select-empty';
    emptyEl.textContent = '无匹配项';
    emptyEl.hidden = true;
    panel.appendChild(emptyEl);
  }

  function updateEmptyState(): void {
    const hasVisible = visibleOptions().length > 0;
    if (emptyEl) emptyEl.hidden = hasVisible;
  }

  // ── 搜索过滤 ──
  function filterOptions(query: string): void {
    const q = query.trim().toLowerCase();
    const groups = Array.from(panel.querySelectorAll<HTMLElement>('.select-group'));
    for (const opt of allOptions()) {
      const text = (opt.textContent ?? '').toLowerCase();
      const kw = (opt.getAttribute('data-keywords') ?? '').toLowerCase();
      opt.hidden = q !== '' && !text.includes(q) && !kw.includes(q);
    }
    // 隐藏所有选项都被过滤掉的分组
    for (const g of groups) {
      const hasVisible = Array.from(g.querySelectorAll<HTMLElement>('.select-option')).some((o) => !o.hidden);
      g.hidden = !hasVisible;
    }
    updateEmptyState();
    setFocus(firstEnabled());
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => filterOptions(searchInput!.value));
    // 阻止搜索框的按键冒泡到 document 级处理
    searchInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        searchInput!.value = '';
        filterOptions('');
        searchInput!.focus();
      }
    });
  }

  /** 按 trigger rect 计算面板定位（panel 在 body 下，left/top 换算为文档坐标）。 */
  function positionPanel(): void {
    const rect = trigger.getBoundingClientRect();
    const layout = computePopoverLayout(
      rect,
      { width: window.innerWidth, height: window.innerHeight },
      {
        side: 'bottom',
        align: 'stretch',
        offset: PANEL_OFFSET,
        minWidth: rect.width,
        maxWidth: rect.width,
        maxHeight: PANEL_MAX_HEIGHT,
      },
    );
    panel.style.left = `${layout.left + window.scrollX}px`;
    panel.style.top = `${layout.top + window.scrollY}px`;
    panel.style.minWidth = `${layout.width}px`;
    panel.style.width = `${layout.width}px`;
    panel.style.maxHeight = `${layout.maxHeight}px`;
    panel.dataset.side = layout.side;
  }

  function openPanel(): void {
    if (isOpen()) return;
    openSelect?.close();
    // portal：跳出祖先 overflow 裁切与 stacking context；只移一次，关闭不移回
    if (panel.parentElement !== document.body) document.body.appendChild(panel);
    panel.hidden = false;
    container.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    positionPanel();
    openSelect = { container, trigger, panel, close: closePanel, reposition: positionPanel };
    bindOpenListeners();
    if (searchInput) {
      searchInput.value = '';
      filterOptions('');
      // 可搜索面板打开时焦点落在搜索框
      setTimeout(() => searchInput?.focus(), 0);
    } else {
      const sel = allOptions().findIndex((o) => o.classList.contains('is-selected'));
      setFocus(sel >= 0 ? sel : firstEnabled());
    }
  }

  function closePanel(): void {
    if (!isOpen()) return;
    panel.hidden = true;
    container.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    setFocus(-1);
    if (openSelect?.panel === panel) openSelect = null;
    unbindOpenListeners();
  }

  /** 获取当前选中的值数组。 */
  function getSelectedValues(): string[] {
    return allOptions()
      .filter((o) => o.classList.contains('is-selected'))
      .map((o) => o.getAttribute('data-value') ?? '');
  }

  /** 多选：更新 trigger 显示（计数或前两项 + +N）。 */
  function updateMultiTrigger(): void {
    if (!valueEl) return;
    const selected = allOptions().filter((o) => o.classList.contains('is-selected'));
    if (selected.length === 0) {
      valueEl.textContent = placeholder;
      valueEl.classList.add('is-empty');
      container.removeAttribute('data-value');
    } else {
      valueEl.classList.remove('is-empty');
      const maxLabel = Number(container.getAttribute('data-select-max-label')) || 2;
      if (selected.length <= maxLabel) {
        valueEl.textContent = selected.map((o) => o.textContent ?? '').join('、');
      } else {
        valueEl.textContent = `已选 ${selected.length} 项`;
      }
    }
    // 多选上限约束
    if (maxSelect > 0) {
      const atMax = selected.length >= maxSelect;
      allOptions().forEach((o) => {
        if (!o.classList.contains('is-selected')) {
          o.classList.toggle('is-disabled', atMax);
        }
      });
    }
  }

  function syncHiddenInput(): void {
    if (!hiddenInput) return;
    const values = getSelectedValues();
    hiddenInput.value = isMultiple ? values.join(',') : (values[0] ?? '');
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function choose(opt: HTMLButtonElement): void {
    if (opt.classList.contains('is-disabled')) return;

    if (isMultiple) {
      opt.classList.toggle('is-selected');
      container.setAttribute(
        'data-value',
        getSelectedValues().join(','),
      );
      updateMultiTrigger();
      syncHiddenInput();
      // 多选不关面板，焦点留在选项上
      if (searchInput) searchInput.focus();
      else opt.focus();
    } else {
      allOptions().forEach((o) => o.classList.toggle('is-selected', o === opt));
      if (valueEl) {
        valueEl.textContent = opt.textContent ?? '';
        valueEl.classList.remove('is-empty');
      }
      const v = opt.getAttribute('data-value') ?? '';
      container.setAttribute('data-value', v);
      syncHiddenInput();
      closePanel();
      trigger.focus();
    }
  }

  // ── 清除按钮（多选时 trigger 内出现）──
  const clearBtn = container.querySelector<HTMLElement>('.select-clear');
  if (clearBtn && isMultiple) {
    clearBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      allOptions().forEach((o) => o.classList.remove('is-selected'));
      updateMultiTrigger();
      syncHiddenInput();
    });
    clearBtn.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  }

  trigger.addEventListener('click', () => (isOpen() ? closePanel() : openPanel()));

  trigger.addEventListener('keydown', (ev) => {
    if (!isOpen()) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault(); // 阻止 button 原生 click 激活，避免双 toggle
        openPanel();
      }
      return;
    }
    switch (ev.key) {
      case 'ArrowDown': ev.preventDefault(); moveFocus(1); break;
      case 'ArrowUp': ev.preventDefault(); moveFocus(-1); break;
      case 'Enter':
      case ' ': {
        ev.preventDefault();
        const opt = visibleOptions()[focusIdx];
        if (opt) choose(opt);
        break;
      }
      case 'Escape': ev.preventDefault(); closePanel(); break;
    }
  });

  panel.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const opt = t.closest('.select-option');
    if (opt instanceof HTMLButtonElement && panel.contains(opt)) choose(opt);
  });

  // 悬停同步键盘焦点态，鼠标与键盘看到同一个 is-focused
  panel.addEventListener('mouseover', (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const opt = t.closest('.select-option');
    if (!opt || (opt as HTMLElement).hidden) return;
    const idx = visibleOptions().indexOf(opt as HTMLButtonElement);
    if (idx >= 0 && !opt.classList.contains('is-disabled')) setFocus(idx);
  });

  // 初始化：多选 trigger 回填
  if (isMultiple) updateMultiTrigger();
}

/** 为 root 下每个 [data-select] 容器初始化（root 自身是 [data-select] 也算）。 */
export function initSelect(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;
  // 外点 / Esc 的 document 级单例委托，全库只挂一次
  bindGlobalListeners();
  const containers: Element[] = [];
  if (scope instanceof Element && scope.matches('[data-select]')) containers.push(scope);
  containers.push(...Array.from(scope.querySelectorAll('[data-select]')));
  for (const c of containers) setup(c);
}
