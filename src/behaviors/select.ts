/*
 * @icen.ai/ui — Behavior: select（弹层选择器，与 components/select.css 配套，data 属性驱动）
 *
 * DOM 契约：
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
 * 交互：trigger 点击开关面板（CSS 定位：trigger 下方 4px、min-width = trigger 宽度）；
 * 选项点击 → .is-selected、.select-value 文本更新（textContent）、隐藏 input 同步、
 * 容器 data-value 同步；Esc / 外点关闭；↑↓ 移动 .is-focused（跳过 .is-disabled）、
 * Enter/Space 选中；面板打开时焦点落在已选项上。同一容器重复 init 幂等。
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

  const options = (): HTMLButtonElement[] =>
    Array.from(panel.querySelectorAll<HTMLButtonElement>('.select-option'));
  const isOpen = (): boolean => !panel.hidden;
  let focusIdx = -1;

  function setFocus(idx: number): void {
    const opts = options();
    focusIdx = Math.max(-1, Math.min(idx, opts.length - 1));
    opts.forEach((o, i) => o.classList.toggle('is-focused', i === focusIdx));
    const cur = focusIdx >= 0 ? opts[focusIdx] : undefined;
    cur?.scrollIntoView({ block: 'nearest' });
  }

  function firstEnabled(): number {
    return options().findIndex((o) => !o.classList.contains('is-disabled'));
  }

  function moveFocus(delta: number): void {
    const opts = options();
    if (opts.length === 0) return;
    let n = focusIdx;
    for (let guard = 0; guard < opts.length; guard++) {
      n = (n + delta + opts.length) % opts.length;
      const opt = opts[n];
      if (opt && !opt.classList.contains('is-disabled')) break;
    }
    setFocus(n);
  }

  function openPanel(): void {
    if (isOpen()) return;
    panel.hidden = false;
    container.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    const sel = options().findIndex((o) => o.classList.contains('is-selected'));
    setFocus(sel >= 0 ? sel : firstEnabled());
  }

  function closePanel(): void {
    if (!isOpen()) return;
    panel.hidden = true;
    container.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    setFocus(-1);
  }

  function choose(opt: HTMLButtonElement): void {
    if (opt.classList.contains('is-disabled')) return;
    options().forEach((o) => o.classList.toggle('is-selected', o === opt));
    if (valueEl) {
      // ✓ 是 ::after 伪元素，textContent 天然不含它
      valueEl.textContent = opt.textContent ?? '';
      valueEl.classList.remove('is-empty');
    }
    const v = opt.getAttribute('data-value') ?? '';
    container.setAttribute('data-value', v);
    if (hiddenInput) {
      hiddenInput.value = v;
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closePanel();
    trigger.focus();
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
        const opt = options()[focusIdx];
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
    if (!opt) return;
    const idx = options().indexOf(opt as HTMLButtonElement);
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
}

/** 为 root 下每个 [data-select] 容器初始化（root 自身是 [data-select] 也算）。 */
export function initSelect(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const containers: Element[] = [];
  if (root instanceof Element && root.matches('[data-select]')) containers.push(root);
  containers.push(...Array.from(root.querySelectorAll('[data-select]')));
  for (const c of containers) setup(c);
}
