/*
 * @icen.ai/ui — Behavior: nav（scroll 收缩，与 components/nav.css 配套）
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
 * 同一元素重复 init 幂等。监听器挂在 window 上，元素从 DOM 移除后**不会**自动回收
 * （window 持有 listener 引用，元素无法随之 GC）——initNav 返回销毁函数，
 * 元素卸载/页面析构时应调用它移除 window scroll/resize 监听。SSR 下为 no-op。
 * prefers-reduced-motion: reduce 时仍同步状态但不依赖动画过渡（视觉上瞬切）。
 */

interface MarkedNav extends HTMLElement {
  __icenNavInit?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  const onResize = (): void => {
    /* 视口尺寸变化时刷新一次状态（防止 sticky 计算陈旧） */
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  apply();

  /* 销毁：移除 window 级监听并复位幂等标记（可重新 init） */
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    el.__icenNavInit = false;
  };
}

/**
 * 为 root 下每个 .nav[data-scroll-reactive] 初始化（root 自身匹配也算）。
 * 返回销毁函数：移除本次初始化挂上的全部 window scroll/resize 监听。
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
