/*
 * @icen.ai/ui — Behavior: sidebar（分组折叠，与 components/sidebar.css 配套）
 *
 * DOM 契约：
 *   <aside class="sidebar">
 *     <div class="sidebar-group is-open">
 *       <button class="sidebar-group-title" aria-expanded="true">分组</button>
 *       <div class="sidebar-group-panel"><div class="sidebar-group-panel-inner">…</div></div>
 *     </div>
 *   </aside>
 *
 * 点击 .sidebar-group-title 切父 .sidebar-group 的 .is-open 并同步 aria-expanded；
 * 展开动画走 CSS grid-template-rows 0fr↔1fr（同 accordion 约定），JS 不碰样式。
 * 同一 .sidebar 元素重复 init 幂等；嵌套 sidebar 只处理各自直属的 title。
 */

interface MarkedSidebar extends HTMLElement {
  __icenSidebarInit?: boolean;
}

function setup(sidebar: HTMLElement): void {
  const el = sidebar as MarkedSidebar;
  if (el.__icenSidebarInit) return;
  el.__icenSidebarInit = true;

  el.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const title = target.closest('.sidebar-group-title');
    if (!(title instanceof HTMLElement)) return;
    if (title.closest('.sidebar') !== el) return;
    const group = title.closest('.sidebar-group');
    if (!group) return;
    const open = group.classList.toggle('is-open');
    title.setAttribute('aria-expanded', String(open));
  });
}

/** 为 root 下每个 .sidebar 初始化（root 自身是 .sidebar 也算）。 */
export function initSidebar(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const sidebars: Element[] = [];
  if (root instanceof Element && root.matches('.sidebar')) sidebars.push(root);
  sidebars.push(...Array.from(root.querySelectorAll('.sidebar')));
  for (const s of sidebars) setup(s as HTMLElement);
}
