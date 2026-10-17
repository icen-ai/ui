/*
 * @icen.ai/ui — Behavior: tooltip（气泡提示，portal 增强；与 components/tooltip.css 配套）
 *
 * tooltip 是全库统一的浮层纪律成员：initTooltip() 后，[data-icen-tooltip] 触发器的
 * 气泡由 JS portal 到 document.body，经 computePopoverLayout 选侧/翻转/钳制——
 * 任何祖先的 overflow / stacking context 都不再裁切气泡（z-index 对裁切无解，portal 才是）。
 * 无 JS 时 CSS ::after 回退照常工作；JS 接管期间触发器带 data-icen-tooltip-live 抑制回退。
 *
 * 触发约定（与 CSS 回退一致）：鼠标/笔 hover 延迟 400ms，键盘 :focus-visible 立即；
 * 触屏不抢首次点按。离开、点击、Escape、滚动/缩放、触发器移除或属性清空都会结束提示。
 * 打开期间触发器 aria-describedby 指向气泡（role=tooltip，纯文本 textContent），
 * data-icen-tooltip / side / align / multiline 变更实时同步；全局至多一个气泡。
 *
 * 同一 root 重复 init 返回同一销毁函数，嵌套委托只执行一次；SSR 下返回 no-op。
 * 销毁：移除监听、取消待显、归还触发器属性并立即摘除气泡。
 */

import { computePopoverLayout, type PopoverAlign, type PopoverSide } from './popover';

const HOVER_DELAY_MS = 400;
const LEAVE_TIMEOUT_MS = 240;
const OFFSET_PX = 6;
const VIEWPORT_MARGIN_PX = 8;
const WATCHED_ATTRS = ['data-icen-tooltip', 'data-icen-tooltip-side', 'data-icen-tooltip-align', 'data-icen-tooltip-multiline'];

const scopes = new WeakMap<ParentNode, () => void>();
const handled = new WeakSet<Event>();

let bubble: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let describedBy: string | null = null;
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
  if (describedBy === null) trigger.removeAttribute('aria-describedby');
  else trigger.setAttribute('aria-describedby', describedBy);
  describedBy = null;
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

function hide(trigger: HTMLElement | null, opts?: { instant?: boolean }): void {
  cancelPending();
  const active = current;
  if (!active || (trigger && active !== trigger)) return;
  current = null;
  release(active);
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
  requestAnimationFrame(() => bubble?.classList.add('is-open'));
}

function watch(): void {
  window.addEventListener('scroll', onViewportScroll, { capture: true, passive: true });
  window.addEventListener('resize', onViewportResize, { passive: true });
  observer = new MutationObserver(() => {
    if (!current) return;
    const text = textOf(current);
    if (!current.isConnected || !text) {
      hide(null, { instant: true });
      return;
    }
    if (bubble && bubble.textContent !== text) bubble.textContent = text;
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
  hide(null, { instant: true });
}

function onViewportResize(): void {
  hide(null, { instant: true });
}

function show(trigger: HTMLElement): void {
  if (!trigger.isConnected) return;
  const text = textOf(trigger);
  if (!text) return;
  cancelPending();
  cancelLeaving();
  if (current && current !== trigger) release(current);
  current = trigger;
  trigger.setAttribute('data-icen-tooltip-live', '');

  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'icen-tooltip';
    bubble.setAttribute('role', 'tooltip');
    bubble.id = `icen-tooltip-${++sequence}`;
  }
  bubble.textContent = text;
  bubble.classList.toggle('is-multiline', trigger.getAttribute('data-icen-tooltip-multiline') === 'true');
  if (!bubble.isConnected) {
    bubble.style.visibility = 'hidden';
    document.body.appendChild(bubble);
  }

  describedBy = trigger.getAttribute('aria-describedby');
  const tokens = new Set((describedBy ?? '').split(/\s+/).filter(Boolean));
  tokens.add(bubble.id);
  trigger.setAttribute('aria-describedby', [...tokens].join(' '));

  layout();
  watch();
}

function markPending(trigger: HTMLElement): void {
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
    if (current === trigger || pending?.trigger === trigger) return;
    markPending(trigger);
  };
  const onPointerOut = (event: Event): void => {
    const pointer = event as PointerEvent;
    const trigger = triggerFrom(pointer.target);
    if (!trigger) return;
    if (pointer.relatedTarget instanceof Node && trigger.contains(pointer.relatedTarget)) return;
    if (pending?.trigger === trigger) cancelPending();
    if (current === trigger) hide(trigger);
  };
  const onFocusIn = (event: Event): void => {
    if (handled.has(event)) return;
    handled.add(event);
    const trigger = triggerFrom(event.target);
    if (!trigger || !focusVisible(trigger)) return;
    show(trigger);
  };
  const onFocusOut = (event: Event): void => {
    const trigger = triggerFrom(event.target);
    if (!trigger) return;
    if (pending?.trigger === trigger) cancelPending();
    if (current === trigger) hide(trigger);
  };
  const onPointerDown = (event: Event): void => {
    const trigger = triggerFrom(event.target);
    if (trigger && pending?.trigger === trigger) cancelPending();
    if (current) hide(null);
  };
  const onKeyDown = (event: Event): void => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    if (pending) cancelPending();
    if (current) hide(null);
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
    scopes.delete(scope);
  };
  scopes.set(scope, dispose);
  return dispose;
}
