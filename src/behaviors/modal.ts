/*
 * @icen.ai/ui — Behavior: modal（对话框/Sheet，与 components/modal.css 配套）
 *
 * 契约：
 *   <div class="icen-modal-backdrop" data-icen-modal="id" hidden>
 *     <div class="icen-modal">…<button data-icen-modal-close>×</button>…</div>
 *   </div>
 *   <button data-icen-modal-open="id">打开</button>
 *
 * 功能：hidden 切换 + body 滚动锁（恢复旧值）+ 焦点陷阱（Tab 循环，
 * 跳过不可见元素）+ 打开聚焦第一个可聚焦元素 + 关闭焦点还原 +
 * Esc/backdrop 点击关闭（data-icen-close-on-escape="false" /
 * data-icen-close-on-overlay="false" 可禁用）。同时只开一个；打开时 backdrop
 * 被 portal 到 document.body。backdrop 被外部移除时关闭路径仍复位
 * 滚动锁/监听/焦点。SSR 下为 no-op。
 * 事件：打开成功派 icen:modal-open { id }、关闭派 icen:modal-close { id }
 * （均从 document 广播，onIcen 全局/within 均可收）。
 */

import { applyPanelSizing, readPanelSizing } from './popover';
import { emitIcen } from './events';
import { createIcon } from './icons';
import { t } from './i18n';
import { focusableWithin, isAvailableForFocus } from './focus';
export { FOCUSABLE, focusableWithin } from './focus';

/** 焦点陷阱的可聚焦元素选择器（modal / command-palette 焦点陷阱全库共用）。 */

/** openModal 可选项。 */
export interface ModalOpenOptions {
  /**
   * 初始焦点：缺省 = 聚焦面板内第一个可聚焦元素（无则面板自身）；
   * 传 HTMLElement = 聚焦该元素；'none' = 不动焦点（调用方自管，焦点陷阱仍生效）。
   */
  initialFocus?: HTMLElement | 'none';
}

let openId: string | null = null;
let restoreFocusTo: HTMLElement | null = null;
let prevBodyOverflow = '';
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let initialized = false;
let disposeInit: (()=>void) | null = null;
let activeBackdrop: HTMLElement | null = null;
let removalObserver: MutationObserver | null = null;
const portals=new Map<HTMLElement,Comment>();
const restoreTimers=new Map<HTMLElement,ReturnType<typeof setTimeout>>();

function normalizeControls(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('button[data-icen-modal-open],button[data-icen-modal-close],button.icen-modal-close').forEach((button)=>{
    if(!button.hasAttribute('type'))button.type='button';
    if(button.classList.contains('icen-modal-close')) {
      button.setAttribute('data-icen-modal-close','');
      button.replaceChildren(createIcon('close')!);
      if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',t('common.close'));
    }
  });
}
function restorePortal(backdrop: HTMLElement): void {
  clearTimeout(restoreTimers.get(backdrop));restoreTimers.delete(backdrop);
  const marker=portals.get(backdrop);if(!marker)return;
  if(backdrop.isConnected && marker.isConnected)marker.replaceWith(backdrop);
  else {marker.remove();backdrop.remove();}
  portals.delete(backdrop);
}

function findBackdrop(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.icen-modal-backdrop[data-icen-modal="${CSS.escape(id)}"]`);
}

function portal(backdrop: HTMLElement): void {
  // 跳出祖先 stacking context（transform/filter 会让 fixed 失效）
  clearTimeout(restoreTimers.get(backdrop));restoreTimers.delete(backdrop);
  if (backdrop.parentElement !== document.body) {
    const marker=document.createComment('icen-modal-anchor');backdrop.before(marker);portals.set(backdrop,marker);
    document.body.appendChild(backdrop);
  }
}

/**
 * 打开指定 id 的 modal；已有其他 modal 打开时先关闭它。
 * 打开成功后从 document 派发 icen:modal-open { id }（广播）。
 */
export function openModal(id: string, opts?: ModalOpenOptions): void {
  if (typeof document === 'undefined') return;
  if (openId === id) return;

  const backdrop = findBackdrop(id);
  if (!backdrop) {
    console.warn(`[@icen.ai/ui] modal: 未找到 data-icen-modal="${id}" 的 .modal-backdrop，已跳过打开`);
    return;
  }
  const panel = backdrop.querySelector<HTMLElement>('.icen-modal');
  if (!panel) return;
  if (openId) closeModal(openId);
  normalizeControls(backdrop);

  /* 面板尺寸契约（PanelSizing）：backdrop 上 data-icen-panel-width / -max-height 等覆盖 CSS 类修饰 */
  applyPanelSizing(panel, readPanelSizing(backdrop));

  portal(backdrop);

  restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  openId = id;
  activeBackdrop=backdrop;
  backdrop.inert=false;backdrop.removeAttribute('aria-hidden');
  backdrop.hidden = false;

  prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;

  /* 自动 aria-labelledby：若面板内有 .icen-modal-title 且未显式声明，绑定过去。
     id 铸造用去非法字符而非 CSS.escape（escape 会产出含反斜杠的串，如 "a.b"→"a\.b"，
     作为 id 值非法）；下方 findBackdrop 的 CSS.escape 是选择器转义，属正确用途，保留 */
  if (!panel.hasAttribute('aria-labelledby')) {
    const title = panel.querySelector<HTMLElement>('.icen-modal-title');
    if (title) {
      if (!title.id) title.id = `modal-title-${id.replace(/[^\w-]/g, '-')}`;
      panel.setAttribute('aria-labelledby', title.id);
    }
  }
  if (!panel.hasAttribute('aria-describedby')) {
    const desc = panel.querySelector<HTMLElement>('.icen-modal-description');
    if (desc) {
      if (!desc.id) desc.id = `modal-desc-${id.replace(/[^\w-]/g, '-')}`;
      panel.setAttribute('aria-describedby', desc.id);
    }
  }

  const closeOnEscape = backdrop.dataset.icenCloseOnEscape !== 'false';
  keyHandler = (e: KeyboardEvent): void => {
    if(e.defaultPrevented || e.isComposing || e.keyCode === 229)return;
    if (e.key === 'Escape') {
      if (closeOnEscape) {
        e.preventDefault();
        e.stopPropagation();
        closeModal(id);
      }
      return;
    }
    if (e.key !== 'Tab') return;
    // 过滤不可见元素（与 command-palette 的 Tab 陷阱实现保持一致）
    const els = focusableWithin(panel);
    if (els.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !panel.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !panel.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  };
  window.addEventListener('keydown', keyHandler);

  /* 初始焦点：默认第一个可聚焦（无则面板自身）；元素 = 聚焦它；'none' = 不动 */
  if (opts?.initialFocus === 'none') {
    /* 调用方自管焦点；Tab 焦点陷阱仍生效 */
  } else if (opts?.initialFocus instanceof HTMLElement && panel.contains(opts.initialFocus) && isAvailableForFocus(opts.initialFocus)) {
    opts.initialFocus.focus();
  } else {
    const preferred=panel.querySelector<HTMLElement>('[autofocus]');
    const focusable = preferred && isAvailableForFocus(preferred) ? preferred : focusableWithin(panel)[0];
    (focusable ?? panel).focus();
  }
  removalObserver=new MutationObserver(()=>{if(openId === id && !backdrop.isConnected)closeModal(id);});
  removalObserver.observe(document.body,{childList:true,subtree:true});

  emitIcen(document, 'icen:modal-open', { id });
}

/**
 * 关闭指定 id 的 modal（backdrop 已被外部移除时也照常复位状态/监听/滚动锁）。
 * 关闭已打开的 modal 后从 document 派发 icen:modal-close { id }（广播）；
 * 关闭未被接管打开的 modal（幂等空操作路径）不派发。
 */
export function closeModal(id: string): void {
  if (typeof document === 'undefined') return;
  const backdrop = findBackdrop(id) ?? (openId === id ? activeBackdrop : null);
  if (backdrop) {backdrop.hidden = true;backdrop.inert=true;backdrop.setAttribute('aria-hidden','true');}
  if (openId !== id) return;

  openId = null;
  activeBackdrop=null;removalObserver?.disconnect();removalObserver=null;
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  document.body.style.overflow = prevBodyOverflow;
  if (restoreFocusTo && restoreFocusTo.isConnected) restoreFocusTo.focus({preventScroll:true});
  restoreFocusTo = null;
  if(backdrop) {
    const duration=getComputedStyle(backdrop).transitionDuration.split(',').map((part)=>parseFloat(part)*(part.trim().endsWith('ms') ? 1 : 1000));
    const ms=Math.max(0,...duration.filter(Number.isFinite));
    if(ms>0 && backdrop.isConnected)restoreTimers.set(backdrop,setTimeout(()=>{if(backdrop.hidden)restorePortal(backdrop);},ms+34));
    else restorePortal(backdrop);
  }
  emitIcen(document, 'icen:modal-close', { id });
}

/**
 * 绑定触发器/关闭钮/backdrop 点击（document 级事件委托，重复调用安全）。
 * root 用于扫描 [data-icen-modal-open] 补 aria-haspopup=dialog。
 * 返回销毁函数：摘除 document 委托并复位幂等标记（销毁后可重新 init）；
 * 销毁时若有 modal 开着会顺带关闭（复位滚动锁/监听/焦点）。SSR 下返回 no-op。
 */
export function initModal(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;
  normalizeControls(scope);

  scope
    .querySelectorAll<HTMLElement>('[data-icen-modal-open]')
    .forEach((el) => el.setAttribute('aria-haspopup', 'dialog'));

  if (initialized) return disposeInit!;
  initialized = true;

  const onClick = (e: MouseEvent): void => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const opener = target.closest<HTMLElement>('[data-icen-modal-open]');
    if (opener?.dataset.icenModalOpen) {
      e.preventDefault();
      if(opener.matches(':disabled,[aria-disabled="true"],.is-disabled') || opener.closest('[inert],[data-icen-disabled]'))return;
      opener.setAttribute('aria-haspopup', 'dialog');
      openModal(opener.dataset.icenModalOpen);
      return;
    }

    const closer = target.closest<HTMLElement>('[data-icen-modal-close]');
    if (closer) {
      const backdrop = closer.closest<HTMLElement>('[data-icen-modal]');
      if (backdrop?.dataset.icenModal) closeModal(backdrop.dataset.icenModal);
      return;
    }

    // backdrop 点击：仅当点中的就是 backdrop 本身（而非面板内部）
    if (
      target instanceof HTMLElement &&
      target.classList.contains('icen-modal-backdrop') &&
      target.dataset.icenModal &&
      target.dataset.icenCloseOnOverlay !== 'false'
    ) {
      closeModal(target.dataset.icenModal);
    }
  };
  document.addEventListener('click', onClick);

  const destroy = (): void => {
    if(disposeInit !== destroy)return;
    document.removeEventListener('click', onClick);
    if (openId) closeModal(openId);
    for(const backdrop of portals.keys())restorePortal(backdrop);
    /* 复位幂等标记，销毁后可重新 init */
    initialized = false;
    disposeInit=null;
  };
  disposeInit=destroy;
  return destroy;
}
