/*
 * @icen.ai/ui — Behavior: sidebar（分组折叠 + 整栏折叠，与 components/sidebar.css 配套）
 *
 * DOM 契约：
 *   <aside class="sidebar">
 *     <button data-sidebar-collapse aria-expanded="true">…</button>   ← 可选整栏折叠钮
 *     <div class="sidebar-group is-open">
 *       <button class="sidebar-group-title" aria-expanded="true">分组</button>
 *       <div class="sidebar-group-panel"><div class="sidebar-group-panel-inner">…</div></div>
 *     </div>
 *   </aside>
 *
 * 点击 .sidebar-group-title 切父 .sidebar-group 的 .is-open 并同步 aria-expanded，
 * 派发 icen:sidebar-toggle { group, open }；
 * 点击 [data-sidebar-collapse] 切最近 .sidebar 的 .sidebar--collapsed（CSS 已有 :255 起的
 * icon-only 折叠态），按钮 aria-expanded 同步（栏展开 = true），派发 icen:sidebar-collapse
 * { collapsed }。展开动画走 CSS grid-template-rows 0fr↔1fr（同 accordion 约定），JS 不碰样式。
 * 同一 .sidebar 元素重复 init 幂等；嵌套 sidebar 只处理各自直属的 title；
 * initSidebar 返回销毁函数（移除监听并复位幂等标记，可重新 init）。SSR 下返回 no-op。
 */

import { emitIcen } from './events';

interface MarkedSidebar extends HTMLElement {
  __icenSidebarInit?: boolean;
}

function setup(sidebar: HTMLElement): (() => void) | undefined {
  const el = sidebar as MarkedSidebar;
  if (el.__icenSidebarInit) return undefined;
  el.__icenSidebarInit = true;

  /* 自动 aria-controls 绑定：title → 对应 panel（同 group） */
  sidebar.querySelectorAll<HTMLElement>('.sidebar-group-title').forEach((title) => {
    const group = title.closest<HTMLElement>('.sidebar-group');
    const panel = group?.querySelector<HTMLElement>('.sidebar-group-panel');
    if (panel && !title.hasAttribute('aria-controls')) {
      if (!panel.id) panel.id = `sb-panel-${Math.random().toString(36).slice(2, 9)}`;
      title.setAttribute('aria-controls', panel.id);
    }
  });

  /* 折叠钮 aria-expanded 初始化（未写时按当前 .sidebar--collapsed 状态补齐） */
  sidebar.querySelectorAll<HTMLElement>('[data-sidebar-collapse]').forEach((btn) => {
    if (!btn.hasAttribute('aria-expanded')) {
      btn.setAttribute('aria-expanded', String(!sidebar.classList.contains('sidebar--collapsed')));
    }
  });

  const onClick = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;

    /* 整栏折叠：[data-sidebar-collapse] → 最近 .sidebar 切 .sidebar--collapsed */
    const collapseBtn = target.closest<HTMLElement>('[data-sidebar-collapse]');
    if (collapseBtn && collapseBtn.closest('.sidebar') === el) {
      const collapsed = el.classList.toggle('sidebar--collapsed');
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      emitIcen(el, 'icen:sidebar-collapse', { collapsed });
      return;
    }

    /* 分组折叠 */
    const title = target.closest('.sidebar-group-title');
    if (!(title instanceof HTMLElement)) return;
    if (title.closest('.sidebar') !== el) return;
    const group = title.closest<HTMLElement>('.sidebar-group');
    if (!group) return;
    const open = group.classList.toggle('is-open');
    title.setAttribute('aria-expanded', String(open));
    emitIcen(sidebar, 'icen:sidebar-toggle', { group, open });
  };

  el.addEventListener('click', onClick);

  /* 销毁：移除容器监听并复位幂等标记（可重新 init） */
  return () => {
    el.removeEventListener('click', onClick);
    el.__icenSidebarInit = false;
  };
}

/**
 * 为 root 下每个 .sidebar 初始化（root 自身是 .sidebar 也算）。
 * 返回销毁函数：移除本次挂上的容器监听并复位幂等标记（销毁后可重新 init）。SSR 下返回 no-op。
 */
export function initSidebar(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (typeof document !== 'undefined') {
    const scope = root ?? document;
    const sidebars: Element[] = [];
    if (scope instanceof Element && scope.matches('.sidebar')) sidebars.push(scope);
    sidebars.push(...Array.from(scope.querySelectorAll('.sidebar')));
    for (const s of sidebars) {
      const cleanup = setup(s as HTMLElement);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
