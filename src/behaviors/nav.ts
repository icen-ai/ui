/*
 * @icen.ai/ui — Behavior: nav（scroll 收缩，与 components/nav.css 配套）
 *
 * DOM 契约：
 *   <nav class="nav nav--sticky" data-scroll-reactive>…</nav>
 *
 * 监听 window scroll（passive 监听 + rAF 节流），scrollY > 12 时切 .is-scrolled：
 * 与 nav.css 的 :not(.is-scrolled) 透明态 / .is-scrolled 实色态联动。
 * 初始化时同步一次当前状态；同一元素重复 init 幂等。
 */

interface MarkedNav extends HTMLElement {
  __icenNavInit?: boolean;
}

function setup(nav: HTMLElement): void {
  const el = nav as MarkedNav;
  if (el.__icenNavInit) return;
  el.__icenNavInit = true;

  let ticking = false;
  const update = (): void => {
    ticking = false;
    el.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  update();
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
