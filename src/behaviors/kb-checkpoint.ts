/*
 * @icen.ai/ui — Behavior: kb-checkpoint（Agent 检查点时间轴 + 恢复菜单，与 kb-agent.css 配套）
 *
 * DOM 契约（renderKbCheckpoints 构建，规格 docs/spec/kb-family.md §5.24）：
 *   <div class="kb-checkpoints">
 *     <button class="kb-checkpoint" type="button"
 *             data-checkpoint-id="cp-3" data-label="批量改写前"
 *             data-scope-options="content,both"（scopeOptions 缺省时不写 = 三项全开）
 *             title="批量改写前 · 每页重切前自动保存">
 *       <span class="kb-checkpoint-icon">…时钟 svg…</span>
 *       <span class="kb-checkpoint-time kb-num">14:32（relativeTime）</span>
 *       <span class="kb-checkpoint-label">批量改写前</span>
 *     </button>…
 *   </div>
 *
 * 恢复菜单（initKbCheckpoint 点击弹出，自渲染浮层 .kb-checkpoint-menu，挂 body、fixed 定位）：
 *   <div class="kb-checkpoint-menu" role="menu">
 *     <div class="kb-checkpoint-menu-title">恢复检查点</div>
 *     <button class="kb-checkpoint-menu-item is-checked" role="menuitemradio"
 *             aria-checked="true" data-scope="content">
 *       <span class="kb-checkpoint-menu-check"></span>
 *       <span class="kb-checkpoint-menu-main">
 *         <span class="kb-checkpoint-menu-label">仅内容（保留对话）</span>
 *         <span class="kb-checkpoint-menu-note">讨论历史有审计价值</span>
 *       </span>
 *     </button>
 *     <button … data-scope="conversation">仅对话</button>
 *     <button … data-scope="both">内容与对话</button>
 *   </div>
 *
 * Cursor 语义（默认预选「仅内容」）：回滚产物内容、保留讨论过程——审计与复盘友好。
 * scopeOptions 未提供的恢复范围禁用（.is-disabled + disabled）；Esc / 外点 / 滚动关闭。
 * 选择 → icen:kb-checkpoint-restore {checkpointId, scope}。
 * SSR 安全（无 document 时 render 原样返回、init 返回 no-op）。
 */

import { h, svgIcon } from './kb-core';
import type { KbCheckpoint, KbCheckpointScope } from './kb-core';
import { relativeTime } from './kb-core';
import { emitIcen } from './events';

const CLOCK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

const ALL_SCOPES: ReadonlyArray<{ scope: KbCheckpointScope; label: string }> = [
  { scope: 'content', label: '仅内容（保留对话）' },
  { scope: 'conversation', label: '仅对话' },
  { scope: 'both', label: '内容与对话' },
];

/**
 * 渲染检查点时间轴（时钟 icon + relativeTime + label/reason，reason 缺 label 时顶替）。
 * 重复调用整段重建（数据快照切换语义）；返回挂载元素 el。
 */
export function renderKbCheckpoints(el: HTMLElement, items: KbCheckpoint[]): HTMLElement {
  if (typeof document === 'undefined') return el; /* SSR：原样返回挂载元素 */
  el.textContent = '';
  const root = h('div', 'kb-checkpoints');

  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id ?? '');
    if (!id) continue;
    const label = item.label ?? item.reason ?? '检查点';
    const btn = h('button', 'kb-checkpoint');
    btn.type = 'button';
    btn.dataset.checkpointId = id;
    if (item.label) btn.dataset.label = item.label;
    /* scopeOptions 序列化进 dataset，供 init 委托打开菜单时判定禁用项；缺省 = 三项全开 */
    if (Array.isArray(item.scopeOptions) && item.scopeOptions.length) {
      btn.dataset.scopeOptions = item.scopeOptions.join(',');
    }

    const icon = h('span', 'kb-checkpoint-icon');
    const clock = svgIcon(CLOCK_SVG);
    if (clock) icon.appendChild(clock);
    btn.appendChild(icon);
    btn.appendChild(h('span', 'kb-checkpoint-time kb-num', relativeTime(item.at)));
    btn.appendChild(h('span', 'kb-checkpoint-label', label));

    const title = [item.label, item.reason].filter(Boolean).join(' · ');
    if (title) btn.title = title;
    root.appendChild(btn);
  }

  el.appendChild(root);
  return el;
}

/* ── 恢复菜单（模块级单例：同屏至多一个） ── */

interface OpenMenu {
  el: HTMLElement;
  close: () => void;
}

let openMenu: OpenMenu | null = null;

function closeCheckpointMenu(): void {
  if (!openMenu) return;
  openMenu.close();
  openMenu = null;
}

function openCheckpointMenu(btn: HTMLElement): void {
  closeCheckpointMenu();
  const checkpointId = btn.dataset.checkpointId ?? '';
  const allowed = (btn.dataset.scopeOptions ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const has = (s: KbCheckpointScope): boolean => allowed.length === 0 || allowed.includes(s);

  const menu = h('div', 'kb-checkpoint-menu');
  menu.setAttribute('role', 'menu');
  menu.appendChild(h('div', 'kb-checkpoint-menu-title', '恢复检查点'));

  for (const { scope, label } of ALL_SCOPES) {
    const item = h('button', 'kb-checkpoint-menu-item');
    item.type = 'button';
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', scope === 'content' ? 'true' : 'false');
    if (scope === 'content') item.classList.add('is-checked'); /* 默认预选：仅内容（保留对话） */
    item.dataset.scope = scope;
    if (!has(scope)) {
      item.disabled = true;
      item.classList.add('is-disabled');
      item.title = '该检查点未包含此恢复范围';
    }

    item.appendChild(h('span', 'kb-checkpoint-menu-check'));
    const main = h('span', 'kb-checkpoint-menu-main');
    main.appendChild(h('span', 'kb-checkpoint-menu-label', label));
    if (scope === 'content') {
      main.appendChild(h('span', 'kb-checkpoint-menu-note', '讨论历史有审计价值'));
    }
    item.appendChild(main);
    menu.appendChild(item);
  }

  const ac = new AbortController();
  const { signal } = ac;

  menu.addEventListener(
    'click',
    (e: Event) => {
      const t = e.target instanceof Element ? e.target : null;
      const item = t?.closest<HTMLButtonElement>('.kb-checkpoint-menu-item');
      if (!item || item.disabled) return;
      const scope = item.dataset.scope as KbCheckpointScope;
      closeCheckpointMenu();
      if (checkpointId) emitIcen(btn, 'icen:kb-checkpoint-restore', { checkpointId, scope });
    },
    { signal },
  );
  document.addEventListener('pointerdown', outsideClose, { signal });
  document.addEventListener('keydown', escClose, { signal });
  window.addEventListener('resize', closeCheckpointMenu, { signal });
  /* 捕获阶段收滚动（含容器内滚动）：浮层锚点已移位，直接关闭 */
  window.addEventListener('scroll', closeCheckpointMenu, { capture: true, passive: true, signal });

  function outsideClose(e: Event): void {
    const t = e.target;
    if (t instanceof Node && menu.contains(t)) return;
    if (t instanceof Node && btn.contains(t)) return; /* 点回锚点：交给 click 重新打开 */
    closeCheckpointMenu();
  }
  function escClose(e: Event): void {
    if ((e as KeyboardEvent).key === 'Escape') closeCheckpointMenu();
  }

  document.body.appendChild(menu);
  /* 先挂载量尺寸，再视口夹取定位（锚点下方优先，放不下翻到上方） */
  const rect = btn.getBoundingClientRect();
  const mw = menu.offsetWidth || 240;
  const mh = menu.offsetHeight || 120;
  const vw = window.innerWidth || mw;
  const vh = window.innerHeight || mh;
  let top = rect.bottom + 4;
  let left = Math.min(Math.max(8, rect.left), vw - mw - 8);
  if (top + mh > vh - 8) top = Math.max(8, rect.top - mh - 4);
  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(Math.max(8, left))}px`;

  openMenu = {
    el: menu,
    close: () => {
      ac.abort();
      menu.remove();
    },
  };
}

interface MarkedCheckpointScope extends ParentNode {
  __icenKbCheckpointInit?: boolean;
}

const noopDestroy = (): void => undefined;

/**
 * 委托初始化：点击 .kb-checkpoint 弹恢复菜单（scope 三选，默认预选「仅内容」），
 * 选择 → icen:kb-checkpoint-restore {checkpointId, scope}。幂等（重复调用安全）；
 * 返回销毁函数（移除监听、关闭菜单并复位标记，可重新 init）。SSR 下 no-op。
 */
export function initKbCheckpoint(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return noopDestroy;
  const scope = root ?? document;
  const marked = scope as MarkedCheckpointScope;
  if (marked.__icenKbCheckpointInit) return noopDestroy;
  marked.__icenKbCheckpointInit = true;

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    const btn = t?.closest<HTMLElement>('.kb-checkpoint');
    if (!btn || !btn.dataset.checkpointId) return;
    openCheckpointMenu(btn);
  };

  const target = scope as ParentNode & EventTarget;
  target.addEventListener('click', onClick);

  return () => {
    target.removeEventListener('click', onClick);
    closeCheckpointMenu();
    marked.__icenKbCheckpointInit = false;
  };
}
