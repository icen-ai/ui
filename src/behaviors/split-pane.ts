/*
 * @icen.ai/ui — Behavior: split-pane（分栏拖拽，与 components/split-pane.css 配套）
 *
 * 契约：
 *   <div class="split-pane [--vertical]" data-split-pane style="--split: 50%">
 *     <div class="split-pane-first">…</div>
 *     <div class="split-pane-divider" role="separator"></div>
 *     <div class="split-pane-second">…</div>
 *   </div>
 *
 * 功能：
 *   - pointer 拖拽 .split-pane-divider 更新容器 --split 变量（百分比，范围 10–90）
 *   - 双击分隔条复位到 50%
 *   - 键盘：←/→ 或 ↑/↓ 调整 2%；Home/End 复位极值
 *   - aria-valuenow / aria-valuemin / aria-valuemax 同步更新
 *
 * 可选 data-*：
 *   data-split-min="15"  最小百分比（默认 10）
 *   data-split-max="85"  最大百分比（默认 90）
 *   data-split-step="2"  键盘步长（默认 2）
 *
 * 同一元素重复 init 幂等；SSR 下为 no-op。
 */

interface MarkedPane extends HTMLElement {
  __icenSplitPaneInit?: boolean;
}

const initialized = new WeakSet<HTMLElement>();

function pct(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function setup(container: HTMLElement): void {
  const el = container as MarkedPane;
  if (el.__icenSplitPaneInit) return;
  el.__icenSplitPaneInit = true;

  const dividerQuery = el.querySelector<HTMLElement>('.split-pane-divider');
  if (!dividerQuery) return;
  const divider: HTMLElement = dividerQuery;

  const min = Number(el.dataset.splitMin ?? '10') || 10;
  const max = Number(el.dataset.splitMax ?? '90') || 90;
  const step = Number(el.dataset.splitStep ?? '2') || 2;
  const vertical = el.classList.contains('split-pane--vertical');

  const orientation = vertical ? 'vertical' : 'horizontal';
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', orientation === 'vertical' ? 'horizontal' : 'vertical');
  divider.setAttribute('aria-valuemin', String(min));
  divider.setAttribute('aria-valuemax', String(max));
  divider.tabIndex = 0;

  function readCurrent(): number {
    const v = parseFloat(getComputedStyle(el).getPropertyValue('--split'));
    return Number.isFinite(v) ? v : 50;
  }
  function write(p: number): void {
    const v = pct(p, min, max);
    el.style.setProperty('--split', v + '%');
    divider.setAttribute('aria-valuenow', String(Math.round(v)));
  }

  // 初始值兜底
  if (!el.style.getPropertyValue('--split')) write(50);
  divider.setAttribute('aria-valuenow', String(Math.round(readCurrent())));

  // ── 指针拖拽 ──
  let dragging = false;
  divider.addEventListener('pointerdown', (ev) => {
    dragging = true;
    divider.classList.add('is-dragging');
    divider.setPointerCapture(ev.pointerId);
    el.style.userSelect = 'none';
  });
  const onUp = (ev: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('is-dragging');
    try { divider.releasePointerCapture(ev.pointerId); } catch { /* noop */ }
    el.style.userSelect = '';
  };
  divider.addEventListener('pointerup', onUp);
  divider.addEventListener('pointercancel', () => {
    dragging = false;
    divider.classList.remove('is-dragging');
    el.style.userSelect = '';
  });
  divider.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const rect = el.getBoundingClientRect();
    if (vertical) {
      if (rect.height <= 0) return;
      const p = ((ev.clientY - rect.top) / rect.height) * 100;
      write(p);
    } else {
      if (rect.width <= 0) return;
      const p = ((ev.clientX - rect.left) / rect.width) * 100;
      write(p);
    }
  });

  // 双击复位
  divider.addEventListener('dblclick', () => write(50));

  // 键盘
  divider.addEventListener('keydown', (ev) => {
    const current = readCurrent();
    let next: number | null = null;
    if (vertical) {
      if (ev.key === 'ArrowUp') next = current - step;
      else if (ev.key === 'ArrowDown') next = current + step;
    } else {
      if (ev.key === 'ArrowLeft') next = current - step;
      else if (ev.key === 'ArrowRight') next = current + step;
    }
    if (ev.key === 'Home') next = min;
    else if (ev.key === 'End') next = max;
    if (next === null) return;
    ev.preventDefault();
    write(next);
  });
}

/** 为 root 下每个 .split-pane[data-split-pane] 初始化（root 自身匹配也算）。 */
export function initSplitPane(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const panes: Element[] = [];
  if (root instanceof Element && root.matches('.split-pane[data-split-pane]')) panes.push(root);
  panes.push(...Array.from(root.querySelectorAll('.split-pane[data-split-pane]')));
  for (const p of panes) {
    const el = p as HTMLElement;
    if (initialized.has(el)) continue;
    initialized.add(el);
    setup(el);
  }
}
