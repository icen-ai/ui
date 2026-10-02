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
 *   - 值生效路径（拖拽结束 / 键盘 / 双击复位）派发 icen:split-change
 *     { value }（百分比数值，保留 1 位小数内的 number；拖拽过程中不派发）
 *
 * 可选 data-*：
 *   data-split-min="15"  最小百分比（默认 10）
 *   data-split-max="85"  最大百分比（默认 90）
 *   data-split-step="2"  键盘步长（默认 2）
 *
 * 同一元素重复 init 幂等；initSplitPane 返回销毁函数（移除 divider 全部监听并
 * 复位幂等标记，销毁后可重新 init）。SSR 下返回 no-op。
 */

import { emitIcen } from './events';

interface MarkedPane extends HTMLElement {
  __icenSplitPaneInit?: boolean;
}

/* 数字配置解析：undefined / 空串 / 非有限数回退默认值（0 是合法配置，不能用 || 兜底） */
function numOr(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function setup(container: HTMLElement): (() => void) | undefined {
  const el = container as MarkedPane;
  if (el.__icenSplitPaneInit) return undefined;

  const divider = el.querySelector<HTMLElement>('.split-pane-divider');
  // 校验通过后再置位：无 divider 早退不置位，以便补上 divider 后重新 init 可重试
  if (!divider) return undefined;
  el.__icenSplitPaneInit = true;

  const min = numOr(el.dataset.splitMin, 10);
  const max = numOr(el.dataset.splitMax, 90);
  const step = numOr(el.dataset.splitStep, 2);
  const vertical = el.classList.contains('split-pane--vertical');

  const orientation = vertical ? 'vertical' : 'horizontal';
  divider.setAttribute('role', 'separator');
  /* ARIA separator 的 orientation 描述分隔条自身方向，与 pane 分割轴垂直：
     纵向布局（上下 pane）的分隔条是横条 → 'horizontal'，反之亦然——反向映射是正确的，别当 bug 改 */
  divider.setAttribute('aria-orientation', orientation === 'vertical' ? 'horizontal' : 'vertical');
  divider.setAttribute('aria-valuemin', String(min));
  divider.setAttribute('aria-valuemax', String(max));
  divider.tabIndex = 0;

  function readCurrent(): number {
    const v = parseFloat(getComputedStyle(el).getPropertyValue('--split'));
    return Number.isFinite(v) ? v : 50;
  }

  /* 最近一次 write 生效的钳制后百分比（拖拽结束派发取值用；初始同步不派发） */
  let cur = readCurrent();

  /* 箭头 const（非提升的 function 声明）：守卫建立的 const 窄化才能保留进闭包体 */
  const write = (p: number): void => {
    const v = pct(p, min, max);
    cur = v;
    el.style.setProperty('--split', v + '%');
    divider.setAttribute('aria-valuenow', String(Math.round(v)));
  }

  /** 值生效后派发（value 收敛到 1 位小数内的 number）。 */
  function emitChange(): void {
    emitIcen(el, 'icen:split-change', { value: Math.round(cur * 10) / 10 });
  }

  // 初始值兜底
  if (!el.style.getPropertyValue('--split')) write(50);
  divider.setAttribute('aria-valuenow', String(Math.round(readCurrent())));

  // ── 指针拖拽（拖动过程只写不派发；结束时派发一次终值） ──
  let dragging = false;
  const onDown = (ev: PointerEvent): void => {
    dragging = true;
    divider.classList.add('is-dragging');
    divider.setPointerCapture(ev.pointerId);
    el.style.userSelect = 'none';
  };
  const onUp = (ev: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('is-dragging');
    try { divider.releasePointerCapture(ev.pointerId); } catch { /* noop */ }
    el.style.userSelect = '';
    emitChange();
  };
  const onCancel = (): void => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('is-dragging');
    el.style.userSelect = '';
    emitChange();
  };
  const onMove = (ev: PointerEvent): void => {
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
  };

  // 双击复位
  const onDblClick = (): void => {
    write(50);
    emitChange();
  };

  // 键盘
  const onKeyDown = (ev: KeyboardEvent): void => {
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
    emitChange();
  };

  divider.addEventListener('pointerdown', onDown);
  divider.addEventListener('pointerup', onUp);
  divider.addEventListener('pointercancel', onCancel);
  divider.addEventListener('pointermove', onMove);
  divider.addEventListener('dblclick', onDblClick);
  divider.addEventListener('keydown', onKeyDown);

  /* 销毁：移除 divider 全部监听并复位幂等标记（可重新 init） */
  return () => {
    divider.removeEventListener('pointerdown', onDown);
    divider.removeEventListener('pointerup', onUp);
    divider.removeEventListener('pointercancel', onCancel);
    divider.removeEventListener('pointermove', onMove);
    divider.removeEventListener('dblclick', onDblClick);
    divider.removeEventListener('keydown', onKeyDown);
    el.__icenSplitPaneInit = false;
  };
}

/**
 * 为 root 下每个 .split-pane[data-split-pane] 初始化（root 自身匹配也算）。
 * 返回销毁函数：移除本次初始化挂上的全部监听并复位幂等标记（销毁后可重新 init）。
 * SSR 下返回 no-op。
 */
export function initSplitPane(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (typeof document !== 'undefined') {
    const scope = root ?? document;
    const panes: Element[] = [];
    if (scope instanceof Element && scope.matches('.split-pane[data-split-pane]')) panes.push(scope);
    panes.push(...Array.from(scope.querySelectorAll('.split-pane[data-split-pane]')));
    for (const p of panes) {
      const cleanup = setup(p as HTMLElement);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
