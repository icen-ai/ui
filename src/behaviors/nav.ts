/*
 * @icen.ai/ui — Behavior: nav（scroll 收缩 + 导航项选中，与 components/nav.css 配套）
 *
 * DOM 契约：
 *   <nav class="nav nav--sticky" data-scroll-reactive>…</nav>
 *
 * 监听 window scroll（passive + rAF 节流），scrollY > 12 时切 .is-scrolled：
 * 与 nav.css 的 :not(.is-scrolled) 透明态 / .is-scrolled 实色态联动。
 *
 * 可选：
 *   data-nav-hide-on-scroll  → 滚动方向感知（向下滚隐藏、向上/静止恢复）
 *   data-nav-threshold="40"  → 自定义触发阈值（默认 12px）
 *
 * 导航项选中（nav.css 契约的项类为 .nav-btn / .nav-link，二者同权）：
 * 点击项 → 同 nav 内其余项互斥摘除 .is-active / aria-current，当前项挂上
 * .is-active + aria-current="page"，并派发 icen:nav-select { item, index }
 * （index 为项在本 nav 全部 .nav-btn/.nav-link 中的序号；禁用项不响应）。
 *
 * 同一元素重复 init 幂等。监听器挂在 window 上，元素从 DOM 移除后**不会**自动回收
 * （window 持有 listener 引用，元素无法随之 GC）——initNav 返回销毁函数，
 * 元素卸载/页面析构时应调用它移除 window scroll/resize 与 nav click 监听。SSR 下为 no-op。
 * prefers-reduced-motion: reduce 时仍同步 .is-scrolled，但禁用滚动隐藏（防晕动）。
 */

import { emitIcen } from './events';

interface MarkedNav extends HTMLElement {
  __icenNavInit?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** nav.css 契约的导航项选择器（按钮式 .nav-btn 与链接式 .nav-link）。 */
const NAV_ITEM_SELECTOR = '.nav-btn, .nav-link';

function isNavItemDisabled(item: HTMLElement): boolean {
  return (
    item.classList.contains('is-disabled') ||
    item.getAttribute('aria-disabled') === 'true' ||
    (item instanceof HTMLButtonElement && item.disabled)
  );
}

function setup(nav: HTMLElement): (() => void) | undefined {
  const el = nav as MarkedNav;
  if (el.__icenNavInit) return undefined;
  el.__icenNavInit = true;

  const rawThreshold = nav.dataset.navThreshold;
  const parsedThreshold = rawThreshold === undefined || rawThreshold === '' ? NaN : Number(rawThreshold);
  const threshold = Number.isFinite(parsedThreshold) ? parsedThreshold : 12;
  const hideOnScroll = nav.hasAttribute('data-nav-hide-on-scroll');

  let ticking = false;
  let lastY = window.scrollY;
  let hidden = false;

  const apply = (): void => {
    ticking = false;
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > threshold);

    if (hideOnScroll && !prefersReducedMotion()) {
      const dy = y - lastY;
      /* 顶部 8px 内强制显示；超过阈值才算方向 */
      if (y < 8) {
        hidden = false;
      } else if (dy > 6 && !hidden) {
        hidden = true;
      } else if (dy < -6 && hidden) {
        hidden = false;
      }
      nav.classList.toggle('is-nav-hidden', hidden);
    }
    lastY = y;
  };

  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  };

  /* resize 复用 onScroll：两者函数体相同（rAF 节流跑一次 apply），不再单开函数 */
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  apply();

  /* 导航项选中：.nav-btn / .nav-link 同 nav 互斥 is-active + aria-current="page" */
  const onSelect = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const item = target.closest<HTMLElement>(NAV_ITEM_SELECTOR);
    if (!item || item.closest('.nav') !== nav) return;
    if (isNavItemDisabled(item)) return;

    const items = Array.from(nav.querySelectorAll<HTMLElement>(NAV_ITEM_SELECTOR));
    const index = items.indexOf(item);
    if (index === -1) return;

    items.forEach((it) => {
      if (it === item) return;
      it.classList.remove('is-active');
      if (it.getAttribute('aria-current') === 'page') it.removeAttribute('aria-current');
    });
    item.classList.add('is-active');
    item.setAttribute('aria-current', 'page');
    emitIcen(item, 'icen:nav-select', { item, index });
  };
  nav.addEventListener('click', onSelect);

  /* 销毁：移除 window 级监听与 nav 项委托，复位幂等标记（可重新 init） */
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    nav.removeEventListener('click', onSelect);
    el.__icenNavInit = false;
  };
}

/**
 * 为 root 下每个 .nav[data-scroll-reactive] 初始化（root 自身匹配也算）。
 * 返回销毁函数：移除本次初始化挂上的全部 window scroll/resize 与 nav click 监听。
 */
export function initNav(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const scope = root ?? document;
    const navs: Element[] = [];
    if (scope instanceof Element && scope.matches('.nav[data-scroll-reactive]')) navs.push(scope);
    navs.push(...Array.from(scope.querySelectorAll('.nav[data-scroll-reactive]')));
    for (const n of navs) {
      const cleanup = setup(n as HTMLElement);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
