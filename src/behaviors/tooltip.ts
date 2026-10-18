/*
 * @icen.ai/ui — Behavior: tooltip（气泡提示，portal 增强；与 components/tooltip.css 配套）
 *
 * tooltip 是全库统一的浮层纪律成员：initTooltip() 后，[data-icen-tooltip] 触发器的
 * 气泡由 JS portal 到 document.body，经 computePopoverLayout 选侧/翻转/钳制——
 * 任何祖先的 overflow / stacking context 都不再裁切气泡（z-index 对裁切无解，portal 才是）。
 * 无 JS 时 CSS ::after 回退照常工作；JS 接管期间触发器带 data-icen-tooltip-live 抑制回退。
 *
 * 触发约定（与 CSS 回退一致）：鼠标/笔 hover 延迟 400ms，键盘 :focus-visible 立即；
 * 触屏不抢首次点按；指针可跨过间隙停留在气泡上阅读，键盘焦点保持提示。
 * 点击、Escape、滚动/缩放会关闭，并抑制 CSS 回退直到离开/失焦。
 * 打开期间触发器 aria-describedby 指向气泡（role=tooltip，纯文本 textContent），
 * data-icen-tooltip / side / align / multiline 变更实时同步；全局至多一个气泡。
 *
 * 同一 root 重复 init 返回同一销毁函数，嵌套委托只执行一次；SSR 下返回 no-op。
 * 销毁：移除监听、取消待显、归还触发器属性并立即摘除气泡。
 */

import { computePopoverLayout, type PopoverAlign, type PopoverSide } from './popover';

const HOVER_DELAY_MS = 400;
const LEAVE_TIMEOUT_MS = 240;
const POINTER_LEAVE_DELAY_MS = 80;
const OFFSET_PX = 6;
const VIEWPORT_MARGIN_PX = 8;
const WATCHED_ATTRS = ['data-icen-tooltip', 'data-icen-tooltip-side', 'data-icen-tooltip-align', 'data-icen-tooltip-multiline'];

const scopes = new WeakMap<ParentNode, () => void>();
const handled = new WeakSet<Event>();

let bubble: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
const dismissed = new Set<HTMLElement>();
const triggerOwners = new WeakMap<HTMLElement, ParentNode>();
let closeTimer: number | null = null;
let pending: { trigger: HTMLElement; timer: number } | null = null;
let leaving: { node: HTMLDivElement; timer: number } | null = null;
let observer: MutationObserver | null = null;
let sequence = 0;

function textOf(trigger: HTMLElement): string {
  return trigger.getAttribute('data-icen-tooltip')?.trim() ?? '';
}

function sideOf(trigger: HTMLElement): PopoverSide {
  const side = trigger.getAttribute('data-icen-tooltip-side');
  return side === 'bottom' || side === 'left' || side === 'right' ? side : 'top';
}

function alignOf(trigger: HTMLElement): PopoverAlign {
  const align = trigger.getAttribute('data-icen-tooltip-align');
  return align === 'start' || align === 'end' ? align : 'center';
}

function focusVisible(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

function triggerFrom(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-icen-tooltip]') : null;
}

function cancelPending(): void {
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pending.trigger.removeAttribute('data-icen-tooltip-live');
  pending = null;
}

/* 接管正在退场的气泡：从当前动画位置续接，不闪断 */
function cancelLeaving(): void {
  if (!leaving) return;
  window.clearTimeout(leaving.timer);
  leaving.node.classList.add('is-open');
  leaving = null;
}

function release(trigger: HTMLElement): void {
  trigger.removeAttribute('data-icen-tooltip-live');
  // Remove only our token; preserve descriptions added by the host while open.
  const tokens = (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== bubble?.id);
  if (tokens.length) trigger.setAttribute('aria-describedby', tokens.join(' '));
  else trigger.removeAttribute('aria-describedby');
}

function cancelClose(): void {
  if (closeTimer !== null) window.clearTimeout(closeTimer);
  closeTimer = null;
}

function clearDismissed(trigger: HTMLElement): void {
  if (!dismissed.delete(trigger)) return;
  if (current !== trigger && pending?.trigger !== trigger) trigger.removeAttribute('data-icen-tooltip-live');
}

function scheduleClose(): void {
  cancelClose();
  closeTimer = window.setTimeout(() => {
    closeTimer = null;
    if (current && document.activeElement !== current) hide(current);
  }, POINTER_LEAVE_DELAY_MS);
}

function unwatch(): void {
  window.removeEventListener('scroll', onViewportScroll, true);
  window.removeEventListener('resize', onViewportResize);
  observer?.disconnect();
  observer = null;
}

function removeBubble(node: HTMLDivElement): void {
  node.remove();
  if (bubble === node) bubble = null;
}

function hide(trigger: HTMLElement | null, opts?: { instant?: boolean; suppressFallback?: boolean }): void {
  cancelClose();
  const waiting = pending?.trigger;
  cancelPending();
  if (waiting && opts?.suppressFallback) {
    dismissed.add(waiting);
    waiting.setAttribute('data-icen-tooltip-live', '');
  }
  const active = current;
  if (!active || (trigger && active !== trigger)) return;
  current = null;
  release(active);
  if (opts?.suppressFallback) {
    dismissed.add(active);
    active.setAttribute('data-icen-tooltip-live', '');
  }
  unwatch();
  if (!bubble) return;
  const node = bubble;
  if (opts?.instant) {
    cancelLeaving();
    removeBubble(node);
    return;
  }
  node.classList.remove('is-open');
  leaving = {
    node,
    timer: window.setTimeout(() => {
      if (leaving?.node === node) leaving = null;
      removeBubble(node);
    }, LEAVE_TIMEOUT_MS),
  };
}

function layout(): void {
  if (!current || !bubble) return;
  const anchor = current.getBoundingClientRect();
  const width = bubble.offsetWidth;
  const height = bubble.offsetHeight;
  const out = computePopoverLayout(anchor, { width: window.innerWidth, height: window.innerHeight }, {
    side: sideOf(current),
    align: alignOf(current),
    offset: OFFSET_PX,
    margin: VIEWPORT_MARGIN_PX,
    minWidth: width,
    maxWidth: width,
    minHeight: height,
    maxHeight: height,
    contentHeightHint: height,
  });
  bubble.style.left = `${out.left}px`;
  bubble.style.top = `${out.top}px`;
  bubble.dataset.icenSide = out.side;
  bubble.style.visibility = '';
  const node = bubble, trigger = current;
  requestAnimationFrame(() => {
    if (bubble === node && current === trigger) node.classList.add('is-open');
  });
}

function watch(): void {
  unwatch();
  window.addEventListener('scroll', onViewportScroll, { capture: true, passive: true });
  window.addEventListener('resize', onViewportResize, { passive: true });
  observer = new MutationObserver(() => {
    if (!current) return;
    const text = textOf(current);
    if (!current.isConnected || !text) {
      hide(null, { instant: true });
      return;
    }
    if (bubble) {
      if (bubble.textContent !== text) bubble.textContent = text;
      bubble.classList.toggle('is-multiline', current.getAttribute('data-icen-tooltip-multiline') === 'true');
    }
    layout();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: WATCHED_ATTRS,
  });
}

function onViewportScroll(): void {
  hide(null, { instant: true, suppressFallback: true });
}

function onViewportResize(): void {
  hide(null, { instant: true, suppressFallback: true });
}

function show(trigger: HTMLElement): void {
  if (!trigger.isConnected) return;
  const text = textOf(trigger);
  if (!text) return;
  cancelPending();
  cancelClose();
  cancelLeaving();
  if (current && current !== trigger) release(current);
  current = trigger;
  trigger.setAttribute('data-icen-tooltip-live', '');

  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'icen-tooltip';
    bubble.setAttribute('role', 'tooltip');
    bubble.id = `icen-tooltip-${++sequence}`;
    bubble.addEventListener('pointerenter', cancelClose);
    bubble.addEventListener('pointerleave', event => {
      if (current && event.relatedTarget instanceof Node && current.contains(event.relatedTarget)) return;
      scheduleClose();
    });
  }
  bubble.textContent = text;
  bubble.classList.toggle('is-multiline', trigger.getAttribute('data-icen-tooltip-multiline') === 'true');
  if (!bubble.isConnected) {
    bubble.style.visibility = 'hidden';
    document.body.appendChild(bubble);
  }

  const tokens = new Set((trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
  tokens.add(bubble.id);
  trigger.setAttribute('aria-describedby', [...tokens].join(' '));

  layout();
  watch();
}

function markPending(trigger: HTMLElement): void {
  for (const stale of dismissed) if (!stale.isConnected) clearDismissed(stale);
  cancelClose(); // An old trigger's leave timer must not cancel this new intent.
  cancelPending();
  if (current === trigger) return;
  /* 悬停意图一确定即接管（抑制 CSS 回退），避免 400ms 处双气泡 */
  trigger.setAttribute('data-icen-tooltip-live', '');
  pending = {
    trigger,
    timer: window.setTimeout(() => {
      pending = null;
      show(trigger);
    }, HOVER_DELAY_MS),
  };
}

function owns(trigger: HTMLElement | null, scope: ParentNode): boolean {
  if (!trigger) return false;
  return scope instanceof Node ? scope.contains(trigger) || scope === trigger : false;
}

/** 事件委托接入一个作用域（缺省 document，动态插入同样生效）。 */
export function initTooltip(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;
  const existing = scopes.get(scope);
  if (existing) return existing;

  const onPointerOver = (event: Event): void => {
    if (handled.has(event)) return;
    handled.add(event);
    const pointer = event as PointerEvent;
    if (pointer.pointerType === 'touch') return;
    const trigger = triggerFrom(pointer.target);
    if (!trigger) return;
    if (pointer.relatedTarget instanceof Node && trigger.contains(pointer.relatedTarget)) return;
    if (dismissed.has(trigger)) return;
    if (current === trigger) { cancelClose(); return; }
    if (pending?.trigger === trigger) return;
    triggerOwners.set(trigger, scope);
    markPending(trigger);
  };
  const onPointerOut = (event: Event): void => {
    const pointer = event as PointerEvent;
    const trigger = triggerFrom(pointer.target);
    if (!trigger) return;
    if (pointer.relatedTarget instanceof Node && trigger.contains(pointer.relatedTarget)) return;
    if (document.activeElement !== trigger) clearDismissed(trigger);
    if (pending?.trigger === trigger) cancelPending();
    if (current === trigger && !(pointer.relatedTarget instanceof Node && bubble?.contains(pointer.relatedTarget))) scheduleClose();
  };
  const onFocusIn = (event: Event): void => {
    if (handled.has(event)) return;
    handled.add(event);
    const trigger = triggerFrom(event.target);
    if (!trigger || !focusVisible(trigger) || dismissed.has(trigger)) return;
    triggerOwners.set(trigger, scope);
    show(trigger);
  };
  const onFocusOut = (event: Event): void => {
    const trigger = triggerFrom(event.target);
    if (!trigger) return;
    if (!trigger.matches(':hover')) clearDismissed(trigger);
    if (pending?.trigger === trigger) cancelPending();
    if (current === trigger && !trigger.matches(':hover')) hide(trigger);
  };
  const onPointerDown = (): void => {
    hide(null, { suppressFallback: true });
  };
  const onKeyDown = (event: Event): void => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    hide(null, { suppressFallback: true });
  };

  scope.addEventListener('pointerover', onPointerOver);
  scope.addEventListener('pointerout', onPointerOut);
  scope.addEventListener('focusin', onFocusIn);
  scope.addEventListener('focusout', onFocusOut);
  scope.addEventListener('pointerdown', onPointerDown, true);
  scope.addEventListener('keydown', onKeyDown, true);

  const dispose = (): void => {
    scope.removeEventListener('pointerover', onPointerOver);
    scope.removeEventListener('pointerout', onPointerOut);
    scope.removeEventListener('focusin', onFocusIn);
    scope.removeEventListener('focusout', onFocusOut);
    scope.removeEventListener('pointerdown', onPointerDown, true);
    scope.removeEventListener('keydown', onKeyDown, true);
    if (owns(pending?.trigger ?? null, scope)) cancelPending();
    if (owns(current, scope)) hide(null, { instant: true });
    for (const trigger of dismissed) {
      if (scope === document || triggerOwners.get(trigger) === scope || owns(trigger, scope)) clearDismissed(trigger);
    }
    scopes.delete(scope);
  };
  scopes.set(scope, dispose);
  return dispose;
}
