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
 */

interface MarkedSelect extends Element {
  __icenSelectInit?: boolean;
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
    // 阻止搜索框的按键冒泡到 trigger 的 keydown 处理
    searchInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        searchInput!.value = '';
        filterOptions('');
        searchInput!.focus();
      }
    });
  }

  function openPanel(): void {
    if (isOpen()) return;
    panel.hidden = false;
    container.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
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
    // 面板打开时，若搜索框存在则箭头键由搜索框接管
    if (searchInput && document.activeElement === searchInput) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); moveFocus(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveFocus(-1); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        const opt = visibleOptions()[focusIdx];
        if (opt) choose(opt);
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

  document.addEventListener('pointerdown', (ev) => {
    if (isOpen() && ev.target instanceof Node && !container.contains(ev.target)) closePanel();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && isOpen()) {
      closePanel();
      trigger.focus();
    }
  });

  // 初始化：多选 trigger 回填
  if (isMultiple) updateMultiTrigger();
}

/** 为 root 下每个 [data-select] 容器初始化（root 自身是 [data-select] 也算）。 */
export function initSelect(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const containers: Element[] = [];
  if (root instanceof Element && root.matches('[data-select]')) containers.push(root);
  containers.push(...Array.from(root.querySelectorAll('[data-select]')));
  for (const c of containers) setup(c);
}
