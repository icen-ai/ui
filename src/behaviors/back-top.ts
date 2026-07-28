/*
 * @icen.ai/ui — Behavior: back-top（回到顶部，与 components/back-top.css 配套）
 *
 * 契约（两种用法）：
 *   1. 手写按钮 + init：
 *      <button class="back-top" data-back-top type="button" aria-label="回到顶部">…svg…</button>
 *      initBackTop();   // 给 .is-shown 切换 + 点击滚到顶
 *
 *   2. 全自动：传入 autoCreate，自动 portal 一个默认按钮到 body
 *      initBackTop({ autoCreate: true });
 *
 *   3. 已存在 [data-back-top-auto] 元素的扫描：
 *      initBackTop({ root: someRoot });
 *
 * 可选项（data-* 或 opts）：
 *   data-back-top-threshold="320"   显示阈值（默认 320px）
 *   data-back-top-target="selector" 滚动容器（默认 window）
 *   data-back-top-offset="0"        滚动到多少 px（默认 0）
 *
 * 同一元素重复 init 幂等；SSR 下为 no-op。
 */

interface MarkedBtn extends HTMLElement {
  __icenBackTopInit?: boolean;
}

interface BackTopOptions {
  /** 是否自动创建一个默认按钮（portal 到 body） */
  autoCreate?: boolean;
  /** 显示阈值（px），默认 320 */
  threshold?: number;
  /** 滚动容器选择器，默认 window */
  target?: string;
  /** 滚动到多少 px，默认 0 */
  offset?: number;
  /** 扫描根节点，默认 document */
  root?: ParentNode;
}

const AUTO_BTN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getScrollTarget(target?: string): { el: HTMLElement | null; isWindow: boolean } {
  if (!target) return { el: null, isWindow: true };
  const el = document.querySelector<HTMLElement>(target);
  return { el, isWindow: false };
}

function getScrollY(target?: string): number {
  if (!target) return window.scrollY;
  const el = document.querySelector<HTMLElement>(target);
  return el ? el.scrollTop : window.scrollY;
}

function scrollToTop(target?: string, offset = 0): void {
  const reduce = prefersReducedMotion();
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  if (!target) {
    window.scrollTo({ top: offset, behavior });
    return;
  }
  const el = document.querySelector<HTMLElement>(target);
  if (el) el.scrollTo({ top: offset, behavior });
}

function setup(btn: HTMLElement, opts: BackTopOptions = {}): void {
  const el = btn as MarkedBtn;
  if (el.__icenBackTopInit) return;
  el.__icenBackTopInit = true;

  const threshold = Number(btn.dataset.backTopThreshold ?? opts.threshold ?? 320) || 320;
  const target = btn.dataset.backTopTarget ?? opts.target;
  const offset = Number(btn.dataset.backTopOffset ?? opts.offset ?? 0) || 0;

  let ticking = false;

  const apply = (): void => {
    ticking = false;
    const y = getScrollY(target);
    btn.classList.toggle('is-shown', y > threshold);
  };

  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  };

  const { el: targetEl, isWindow } = getScrollTarget(target);
  if (isWindow) {
    window.addEventListener('scroll', onScroll, { passive: true });
  } else if (targetEl) {
    targetEl.addEventListener('scroll', onScroll, { passive: true });
  }
  window.addEventListener('resize', onScroll, { passive: true });

  btn.addEventListener('click', () => scrollToTop(target, offset));

  apply();
}

/**
 * 初始化：扫描 root 下的 .back-top[data-back-top] 与 [data-back-top-auto]。
 * 传 autoCreate 时自动创建一个默认按钮。
 */
export function initBackTop(opts: BackTopOptions = {}): void {
  if (typeof document === 'undefined') return;
  if (typeof window === 'undefined') return;

  const root = opts.root ?? document;

  if (opts.autoCreate) {
    let btn = document.body.querySelector<HTMLButtonElement>('.back-top[data-back-top-auto]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'back-top';
      btn.setAttribute('data-back-top', '');
      btn.setAttribute('data-back-top-auto', '');
      btn.setAttribute('aria-label', '回到顶部');
      btn.innerHTML = AUTO_BTN_SVG;
      document.body.appendChild(btn);
    }
    setup(btn, opts);
  }

  const candidates: Element[] = [];
  if (root instanceof Element && root.matches('.back-top[data-back-top]')) candidates.push(root);
  candidates.push(...Array.from(root.querySelectorAll('.back-top[data-back-top]')));
  for (const c of candidates) {
    const el = c as HTMLElement;
    if (el.hasAttribute('data-back-top-auto') && opts.autoCreate) continue;
    setup(el, opts);
  }
}
