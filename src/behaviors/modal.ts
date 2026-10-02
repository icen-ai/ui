/*
 * @icen.ai/ui — Behavior: modal（对话框/Sheet，与 components/modal.css 配套）
 *
 * 契约：
 *   <div class="modal-backdrop" data-modal="id" hidden>
 *     <div class="modal">…<button data-modal-close>×</button>…</div>
 *   </div>
 *   <button data-modal-open="id">打开</button>
 *
 * 功能：hidden 切换 + body 滚动锁（恢复旧值）+ 焦点陷阱（Tab 循环，
 * 跳过不可见元素）+ 打开聚焦第一个可聚焦元素 + 关闭焦点还原 +
 * Esc/backdrop 点击关闭（data-close-on-escape="false" /
 * data-close-on-overlay="false" 可禁用）。同时只开一个；打开时 backdrop
 * 被 portal 到 document.body。backdrop 被外部移除时关闭路径仍复位
 * 滚动锁/监听/焦点。SSR 下为 no-op。
 */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openId: string | null = null;
let restoreFocusTo: HTMLElement | null = null;
let prevBodyOverflow = '';
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let initialized = false;

import { applyPanelSizing, readPanelSizing } from './popover';

function findBackdrop(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.modal-backdrop[data-modal="${CSS.escape(id)}"]`);
}

function portal(backdrop: HTMLElement): void {
  // 跳出祖先 stacking context（transform/filter 会让 fixed 失效）
  if (backdrop.parentElement !== document.body) document.body.appendChild(backdrop);
}

/** 打开指定 id 的 modal；已有其他 modal 打开时先关闭它。 */
export function openModal(id: string): void {
  if (typeof document === 'undefined') return;
  if (openId === id) return;
  if (openId) closeModal(openId);

  const backdrop = findBackdrop(id);
  if (!backdrop) {
    console.warn(`[@icen.ai/ui] modal: 未找到 data-modal="${id}" 的 .modal-backdrop，已跳过打开`);
    return;
  }
  const panel = backdrop.querySelector<HTMLElement>('.modal');
  if (!panel) return;

  /* 面板尺寸契约（PanelSizing）：backdrop 上 data-panel-width / -max-height 等覆盖 CSS 类修饰 */
  applyPanelSizing(panel, readPanelSizing(backdrop));

  portal(backdrop);

  restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  openId = id;
  backdrop.hidden = false;

  prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;

  /* 自动 aria-labelledby：若面板内有 .modal-title 且未显式声明，绑定过去 */
  if (!panel.hasAttribute('aria-labelledby')) {
    const title = panel.querySelector<HTMLElement>('.modal-title');
    if (title) {
      if (!title.id) title.id = `modal-title-${CSS.escape(id)}`;
      panel.setAttribute('aria-labelledby', title.id);
    }
  }
  if (!panel.hasAttribute('aria-describedby')) {
    const desc = panel.querySelector<HTMLElement>('.modal-description');
    if (desc) {
      if (!desc.id) desc.id = `modal-desc-${CSS.escape(id)}`;
      panel.setAttribute('aria-describedby', desc.id);
    }
  }

  const closeOnEscape = backdrop.dataset.closeOnEscape !== 'false';
  keyHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (closeOnEscape) {
        e.preventDefault();
        closeModal(id);
      }
      return;
    }
    if (e.key !== 'Tab') return;
    // 过滤不可见元素（与 command-palette 的 Tab 陷阱实现保持一致）
    const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hidden && el.offsetParent !== null,
    );
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

  const focusable = panel.querySelector<HTMLElement>(FOCUSABLE);
  (focusable ?? panel).focus();
}

/** 关闭指定 id 的 modal（backdrop 已被外部移除时也照常复位状态/监听/滚动锁）。 */
export function closeModal(id: string): void {
  if (typeof document === 'undefined') return;
  const backdrop = findBackdrop(id);
  if (backdrop) backdrop.hidden = true;
  if (openId !== id) return;

  openId = null;
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  document.body.style.overflow = prevBodyOverflow;
  if (restoreFocusTo && restoreFocusTo.isConnected) restoreFocusTo.focus();
  restoreFocusTo = null;
}

/**
 * 绑定触发器/关闭钮/backdrop 点击（document 级事件委托，重复调用安全）。
 * root 用于扫描 [data-modal-open] 补 aria-haspopup=dialog。
 */
export function initModal(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;

  scope
    .querySelectorAll<HTMLElement>('[data-modal-open]')
    .forEach((el) => el.setAttribute('aria-haspopup', 'dialog'));

  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const opener = target.closest<HTMLElement>('[data-modal-open]');
    if (opener?.dataset.modalOpen) {
      opener.setAttribute('aria-haspopup', 'dialog');
      openModal(opener.dataset.modalOpen);
      return;
    }

    const closer = target.closest<HTMLElement>('[data-modal-close]');
    if (closer) {
      const backdrop = closer.closest<HTMLElement>('[data-modal]');
      if (backdrop?.dataset.modal) closeModal(backdrop.dataset.modal);
      return;
    }

    // backdrop 点击：仅当点中的就是 backdrop 本身（而非面板内部）
    if (
      target instanceof HTMLElement &&
      target.classList.contains('modal-backdrop') &&
      target.dataset.modal &&
      target.dataset.closeOnOverlay !== 'false'
    ) {
      closeModal(target.dataset.modal);
    }
  });
}
