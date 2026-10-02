/*
 * @icen.ai/ui — Behavior: ai-threads（AI 会话列表，与 components/ai-chat.css 的 .ai-threads 段配套）
 *
 * DOM 契约（类名固定，docs/spec/kb-family.md §5.27）：
 *   分组模式（model.groups 为 true 且项带 group 字段）：
 *   <div class="ai-threads">
 *     <div class="ai-threads-group" data-group="今天">          ← group 缺省的项平铺在最前（无组头）
 *       <button class="ai-threads-group-head" type="button" aria-expanded="true">今天</button>
 *       <div class="ai-threads-group-list">…ai-thread…</div>
 *     </div>…
 *     <div class="ai-threads-group" data-group="已归档">…</div>  ← archived 项沉底收进「已归档」组
 *   </div>
 *
 *   平铺模式（model.groups 缺省/false）：
 *   <div class="ai-threads">
 *     <div class="ai-thread [.is-active] [.is-archived]" role="button" tabindex="0" data-key="t1">
 *       <span class="ai-thread-icon">…svg…</span>               ← item.icon 给定时（svgIcon 消毒）
 *       <span class="ai-thread-label">会话标题</span>
 *       <button class="ai-thread-action" type="button" aria-label="会话操作">···</button>
 *     </div>…                                                    ← archived 项同样沉底（无组头）
 *   </div>
 *
 * 行为：
 *   renderAiThreads(el, model)   快照渲染（createElement/textContent，禁 innerHTML；SVG 过
 *                                svgIcon）；activeKey 命中项挂 .is-active；archived 项挂
 *                                .is-archived（降透明）并沉底（分组模式收进「已归档」组）。
 *                                返回挂载容器 el（render* 返回挂载元素约定，SSR 原样返回）。
 *   initAiThreads(root?)         幂等（__icenAiThreadsInit）+ 返回销毁函数；scope 级委托：
 *                                点 .ai-thread → icen:ai-thread-select {key}；
 *                                点 .ai-thread-action → icen:ai-thread-action {action:'rename', key}
 *                                （动作菜单本体由宿主实现——组件只给挂载点与事件，不绑死菜单）；
 *                                组头点击折叠/展开（aria-expanded + .is-collapsed）；
 *                                键盘 Enter/Space 等价选择（.ai-thread[role=button]）。
 *   setAiThreadsActive(el, key)  外部路由同步激活态：key 命中项挂 .is-active，其余摘除；
 *                                key 为空时清空全部激活（返回 el 自身）。
 *
 * SSR 下 render 原样返回挂载元素、init 为 no-op；文本一律 textContent。
 */

import { h, svgIcon } from './ai-core';
import { emitIcen, type IcenEventMap } from './events';

/* ── 模型 ── */

export interface AiThreadItem {
  /** 稳定标识（事件 detail 的 key） */
  key: string;
  /** 会话标题 */
  label: string;
  /** 分组名（如「今天」/「昨天」/「更早」）；groups 模式下生效 */
  group?: string;
  /** 内联 SVG 字符串（lucide 风格 24×24 stroke）；渲染时经 svgIcon() 消毒 */
  icon?: string;
  /** 已归档：.is-archived 降透明并沉底（分组模式收进「已归档」组） */
  archived?: boolean;
}

export interface AiThreadsModel {
  items: AiThreadItem[];
  /** 当前激活会话 key（路由同步） */
  activeKey?: string;
  /** 分组模式：true 时按 group 字段分组（组头可折叠）；缺省/false 平铺 */
  groups?: boolean;
}

/* 归档组名（分组模式下 archived 项的沉底容器） */
const ARCHIVED_GROUP = '已归档';

interface MarkedScope extends ParentNode {
  __icenAiThreadsInit?: boolean;
}

function dispatch<K extends keyof IcenEventMap>(node: Element, name: K, detail: IcenEventMap[K]): void {
  emitIcen(node, name, detail);
}

/* ── 单条会话行 ── */

function buildThread(item: AiThreadItem, activeKey?: string): HTMLElement {
  const row = h('div', 'ai-thread');
  if (item.key) row.dataset.key = item.key;
  if (item.archived) row.classList.add('is-archived');
  if (activeKey != null && item.key === activeKey) {
    row.classList.add('is-active');
    row.setAttribute('aria-current', 'true');
  }
  row.setAttribute('role', 'button');
  row.tabIndex = 0;

  if (item.icon) {
    const iconWrap = h('span', 'ai-thread-icon');
    const svg = svgIcon(item.icon);
    if (svg) iconWrap.appendChild(svg);
    row.appendChild(iconWrap);
  }
  row.appendChild(h('span', 'ai-thread-label', item.label));

  /* 动作钮：只做事件挂载点（菜单本体由宿主实现），不吞选择点击之外的语义 */
  const action = h('button', 'ai-thread-action', '···');
  action.type = 'button';
  action.setAttribute('aria-label', '会话操作');
  action.setAttribute('data-thread-action', 'rename');
  row.appendChild(action);
  return row;
}

/* ── 渲染 ── */

/**
 * 快照渲染会话列表：平铺或分组（model.groups）、activeKey 高亮、archived 沉底
 * （分组模式收进「已归档」组，组头可折叠）。返回挂载容器 el（SSR 原样返回）。
 */
export function renderAiThreads(el: HTMLElement, model: AiThreadsModel): HTMLElement {
  if (typeof document === 'undefined') return el;
  el.textContent = '';
  const root = h('div', 'ai-threads');
  const items = Array.isArray(model.items) ? model.items : [];
  const active = items.filter((it) => !it.archived);
  const archived = items.filter((it) => it.archived);

  if (model.groups) {
    /* 未分组（group 缺省）项平铺在最前，其次按首次出现顺序分组，归档组沉底 */
    const ungrouped = active.filter((it) => !(it.group ?? '').trim());
    for (const it of ungrouped) root.appendChild(buildThread(it, model.activeKey));

    const groups = new Map<string, AiThreadItem[]>();
    for (const it of active) {
      const label = (it.group ?? '').trim();
      if (!label) continue;
      const list = groups.get(label) ?? [];
      list.push(it);
      groups.set(label, list);
    }
    for (const [label, list] of groups) {
      const group = h('div', 'ai-threads-group');
      group.dataset.group = label;
      const head = h('button', 'ai-threads-group-head', label);
      head.type = 'button';
      head.setAttribute('aria-expanded', 'true');
      group.appendChild(head);
      const listEl = h('div', 'ai-threads-group-list');
      for (const it of list) listEl.appendChild(buildThread(it, model.activeKey));
      group.appendChild(listEl);
      root.appendChild(group);
    }

    if (archived.length > 0) {
      const group = h('div', 'ai-threads-group');
      group.dataset.group = ARCHIVED_GROUP;
      const head = h('button', 'ai-threads-group-head', ARCHIVED_GROUP);
      head.type = 'button';
      head.setAttribute('aria-expanded', 'true');
      group.appendChild(head);
      const listEl = h('div', 'ai-threads-group-list');
      for (const it of archived) listEl.appendChild(buildThread(it, model.activeKey));
      group.appendChild(listEl);
      root.appendChild(group);
    }
  } else {
    for (const it of active) root.appendChild(buildThread(it, model.activeKey));
    for (const it of archived) root.appendChild(buildThread(it, model.activeKey));
  }

  el.appendChild(root);
  return el;
}

/* ── 激活态同步 ── */

/**
 * 外部路由同步激活态：el 范围内 data-key === key 的 .ai-thread 挂 .is-active
 * （+aria-current），其余摘除；key 为空串/null/undefined 时清空全部激活。
 * 对静态手写 DOM 与 renderAiThreads 产物一视同仁。返回 el。
 */
export function setAiThreadsActive(el: HTMLElement, key: string | null | undefined): HTMLElement {
  const threads = Array.from(el.querySelectorAll<HTMLElement>('.ai-thread'));
  if (el instanceof HTMLElement && el.classList.contains('ai-thread')) threads.unshift(el);
  for (const t of threads) {
    const hit = key != null && key !== '' && t.dataset.key === key;
    t.classList.toggle('is-active', hit);
    if (hit) t.setAttribute('aria-current', 'true');
    else t.removeAttribute('aria-current');
  }
  return el;
}

/* ── 委托初始化 ── */

/**
 * 会话列表委托初始化：选择 / 动作挂载点 / 组头折叠。
 * 幂等（scope 挂 __icenAiThreadsInit）；返回销毁函数（解绑监听 + 复位标记，可重新 init）。
 * SSR 下为 no-op。
 */
export function initAiThreads(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as MarkedScope;
  if (marked.__icenAiThreadsInit) return () => undefined;
  marked.__icenAiThreadsInit = true;
  const target = scope as ParentNode & EventTarget;

  const selectThread = (thread: HTMLElement): void => {
    const key = thread.dataset.key ?? '';
    dispatch(thread, 'icen:ai-thread-select', { key });
  };

  const toggleGroup = (head: HTMLElement): void => {
    const group = head.closest<HTMLElement>('.ai-threads-group');
    if (!group) return;
    const open = head.getAttribute('aria-expanded') !== 'true';
    head.setAttribute('aria-expanded', String(open));
    group.classList.toggle('is-collapsed', !open);
  };

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    /* 动作钮优先：冒泡到 .ai-thread 前截住，不触发选择 */
    const action = t.closest<HTMLElement>('.ai-thread-action');
    if (action) {
      const thread = action.closest<HTMLElement>('.ai-thread');
      if (!thread) return;
      dispatch(thread, 'icen:ai-thread-action', { action: 'rename', key: thread.dataset.key ?? '' });
      return;
    }
    const head = t.closest<HTMLElement>('.ai-threads-group-head');
    if (head) {
      toggleGroup(head);
      return;
    }
    const thread = t.closest<HTMLElement>('.ai-thread');
    if (thread) selectThread(thread);
  };

  const onKeydown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const t = ke.target instanceof Element ? ke.target : null;
    const thread = t?.closest<HTMLElement>('.ai-thread');
    if (!thread || thread.getAttribute('role') !== 'button') return;
    ke.preventDefault();
    selectThread(thread);
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKeydown);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('keydown', onKeydown);
    marked.__icenAiThreadsInit = false;
  };
}
