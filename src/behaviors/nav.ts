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
 * 同一元素重复 init 幂等；元素从 DOM 移除后监听器随 element 一起回收（
 * 直接 addEventListener 不易泄漏，因为目标元素持有引用）。SSR 下为 no-op。
 * prefers-reduced-motion: reduce 时仍同步状态但不依赖动画过渡（视觉上瞬切）。
 */

interface MarkedNav extends HTMLElement {
  __icenNavInit?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setup(nav: HTMLElement): void {
  const el = nav as MarkedNav;
  if (el.__icenNavInit) return;
  el.__icenNavInit = true;

  const threshold = Number(nav.dataset.navThreshold ?? '12') || 12;
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
}

/** 为 root 下每个 .nav[data-scroll-reactive] 初始化（root 自身匹配也算）。 */
export function initNav(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  if (typeof window === 'undefined') return;
  const navs: Element[] = [];
  if (root instanceof Element && root.matches('.nav[data-scroll-reactive]')) navs.push(root);
  navs.push(...Array.from(root.querySelectorAll('.nav[data-scroll-reactive]')));
  for (const n of navs) setup(n as HTMLElement);
}
