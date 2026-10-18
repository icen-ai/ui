/*
 * @icen.ai/ui — Behavior: kb-checkpoint（Agent 检查点时间轴 + 恢复菜单，与 kb-agent.css 配套）
 *
 * DOM 契约（renderKbCheckpoints 构建，规格 docs/spec/kb-family.md §5.24）：
 *   <div class="icen-kb-checkpoints">
 *     <button class="icen-kb-checkpoint" type="button"
 *             data-icen-checkpoint-id="cp-3" data-icen-label="批量改写前"
 *             data-icen-scope-options="content,both"（scopeOptions 缺省时不写 = 三项全开）
 *             title="批量改写前 · 每页重切前自动保存">
 *       <span class="icen-kb-checkpoint-icon">…时钟 svg…</span>
 *       <span class="icen-kb-checkpoint-time icen-kb-num">14:32（relativeTime）</span>
 *       <span class="icen-kb-checkpoint-label">批量改写前</span>
 *     </button>…
 *   </div>
 *
 * 恢复菜单（initKbCheckpoint 点击弹出，自渲染浮层 .icen-kb-checkpoint-menu，挂 body、fixed 定位）：
 *   <div class="icen-kb-checkpoint-menu" role="menu">
 *     <div class="icen-kb-checkpoint-menu-title">恢复检查点</div>
 *     <button class="icen-kb-checkpoint-menu-item is-checked" role="menuitemradio"
 *             aria-checked="true" data-icen-scope="content">
 *       <span class="icen-kb-checkpoint-menu-main">
 *         <span class="kb-checkpoint-menu-label">仅内容（保留对话）</span>
 *         <span class="icen-kb-checkpoint-menu-note">讨论历史有审计价值</span>
 *       </span>
 *     </button>
 *     <button … data-icen-scope="conversation">仅对话</button>
 *     <button … data-icen-scope="both">内容与对话</button>
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
import { t } from './i18n';
import {applyPanelSizing, resolvePanelSizing, computePopoverLayout, revealPopoverItem, claimMenuFocus} from './popover';

const CLOCK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

const ALL_SCOPES: ReadonlyArray<{ scope: KbCheckpointScope; label: string }> = [
  { scope: 'content', label: t('kbCheckpoint.scopeContent') },
  { scope: 'conversation', label: t('kbCheckpoint.scopeChat') },
  { scope: 'both', label: t('kbCheckpoint.scopeBoth') },
];

/**
 * 渲染检查点时间轴（时钟 icon + relativeTime + label/reason，reason 缺 label 时顶替）。
 * 重复调用整段重建（数据快照切换语义）；返回挂载元素 el。
 */
export function renderKbCheckpoints(el: HTMLElement, items: KbCheckpoint[]): HTMLElement {
  if (typeof document === 'undefined') return el; /* SSR：原样返回挂载元素 */
  el.textContent = '';
  const root = h('div', 'icen-kb-checkpoints');

  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id ?? '');
    if (!id) continue;
    const label = item.label ?? item.reason ?? t('kbCheckpoint.label');
    const btn = h('button', 'icen-kb-checkpoint');
    btn.type = 'button';
    btn.dataset.icenCheckpointId = id;
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    if (item.label) btn.dataset.icenLabel = item.label;
    /* scopeOptions 序列化进 dataset，供 init 委托打开菜单时判定禁用项；缺省 = 三项全开 */
    if (Array.isArray(item.scopeOptions)) {
      btn.dataset.icenScopeOptions = item.scopeOptions.join(',');
    }

    const icon = h('span', 'icen-kb-checkpoint-icon');
    const clock = svgIcon(CLOCK_SVG);
    if (clock) icon.appendChild(clock);
    btn.appendChild(icon);
    btn.appendChild(h('span', 'icen-kb-checkpoint-time icen-kb-num', relativeTime(item.at)));
    btn.appendChild(h('span', 'icen-kb-checkpoint-label', label));

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
  anchor: HTMLElement;
  owner: ParentNode;
  close: (restore?: boolean) => void;
}

let openMenu: OpenMenu | null = null;

function closeCheckpointMenu(restore = true): void {
  if (!openMenu) return;
  openMenu.close(restore);
  openMenu = null;
}

function openCheckpointMenu(btn: HTMLElement, owner: ParentNode, last = false): void {
  if (openMenu?.anchor === btn) { closeCheckpointMenu(); return; }
  closeCheckpointMenu(false);
  const checkpointId = btn.dataset.icenCheckpointId ?? '';
  const hasScopes = btn.hasAttribute('data-icen-scope-options');
  const allowed = (btn.dataset.icenScopeOptions ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const has = (s: KbCheckpointScope): boolean => !hasScopes || allowed.includes(s);

  const menu = h('div', 'icen-kb-checkpoint-menu');
  menu.dataset.icenMaterial = 'floating';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', t('kbCheckpoint.restore'));
  menu.tabIndex = -1;
  const selected = has('content') ? 'content' : ALL_SCOPES.find(item => has(item.scope))?.scope;
  menu.appendChild(h('div', 'icen-kb-checkpoint-menu-title', t('kbCheckpoint.restore')));

  for (const { scope, label } of ALL_SCOPES) {
    const item = h('button', 'icen-kb-checkpoint-menu-item');
    item.type = 'button';
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(scope === selected));
    item.tabIndex = -1;
    if (scope === selected) item.classList.add('is-checked');
    item.dataset.icenScope = scope;
    if (!has(scope)) {
      item.disabled = true;
      item.classList.add('is-disabled');
      item.title = t('kbCheckpoint.scopeMissing');
    }

    const main = h('span', 'icen-kb-checkpoint-menu-main');
    main.appendChild(h('span', 'kb-checkpoint-menu-label', label));
    if (scope === 'content') {
      main.appendChild(h('span', 'icen-kb-checkpoint-menu-note', t('kbCheckpoint.chatAuditNote')));
    }
    item.appendChild(main);
    menu.appendChild(item);
  }

  const ac = new AbortController();
  const { signal } = ac;
  const scopesAtOpen = btn.getAttribute('data-icen-scope-options');
  const observer = new MutationObserver(() => {
    if (!btn.isConnected || btn.matches(':disabled,[aria-disabled="true"]') || btn.getAttribute('data-icen-scope-options') !== scopesAtOpen) closeCheckpointMenu(false);
  });
  observer.observe(document.documentElement, {subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-disabled','data-icen-scope-options']});
  signal.addEventListener('abort',()=>observer.disconnect(),{once:true});
  const available = Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const focus = (index: number): void => {
    available.forEach((item,i)=>item.tabIndex=i===index?0:-1);
    if (available[index]) revealPopoverItem(available[index]!, menu, {focus:true});
    else menu.focus({preventScroll:true});
  };
  menu.addEventListener('keydown', (event: KeyboardEvent) => {
    const index = available.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (!available.length) return;
      focus(event.key==='Home'?0:event.key==='End'?available.length-1:(index+(event.key==='ArrowDown'?1:-1)+available.length)%available.length);
    } else if (event.key==='Tab') closeCheckpointMenu();
  }, {signal});

  menu.addEventListener(
    'click',
    (e: Event) => {
      const t = e.target instanceof Element ? e.target : null;
      const item = t?.closest<HTMLButtonElement>('.icen-kb-checkpoint-menu-item');
      if (!item || item.disabled) return;
      const scope = item.dataset.icenScope as KbCheckpointScope;
      closeCheckpointMenu();
      if (checkpointId) emitIcen(btn, 'icen:kb-checkpoint-restore', { checkpointId, scope });
    },
    { signal },
  );
  document.addEventListener('pointerdown', outsideClose, { signal });
  document.addEventListener('keydown', escClose, { signal });
  const onViewportChange = (event: Event): void => {
    if (event.type === 'scroll' && event.target instanceof Node && menu.contains(event.target)) return;
    closeCheckpointMenu();
  };
  window.addEventListener('resize', onViewportChange, { signal });
  /* 捕获阶段收滚动（含容器内滚动）：浮层锚点已移位，直接关闭 */
  window.addEventListener('scroll', onViewportChange, { capture: true, passive: true, signal });

  function outsideClose(e: Event): void {
    const t = e.target;
    if (t instanceof Node && menu.contains(t)) return;
    if (t instanceof Node && btn.contains(t)) return; /* 点回锚点：交给 click 重新打开 */
    closeCheckpointMenu(false);
  }
  function escClose(e: Event): void {
    if ((e as KeyboardEvent).key === 'Escape') {e.preventDefault(); e.stopPropagation(); closeCheckpointMenu();}
  }

  document.body.appendChild(menu);
  const host = btn.closest('.icen-kb-checkpoints')?.parentElement ?? btn;
  const sizing = resolvePanelSizing(host, resolvePanelSizing(btn));
  applyPanelSizing(menu, sizing);
  if (sizing.width != null) menu.style.minInlineSize = '0';
  /* 先挂载量尺寸，再视口夹取定位（锚点下方优先，放不下翻到上方） */
  const rect = btn.getBoundingClientRect();
  const mw = menu.offsetWidth || 240;
  const mh = menu.offsetHeight || 120;
  const vw = window.innerWidth || mw;
  const vh = window.innerHeight || mh;
  const layout = computePopoverLayout(rect, {width:vw,height:vh}, {side:'bottom',align:getComputedStyle(btn).direction==='rtl'?'end':'start',offset:4,margin:8,minWidth:mw,maxWidth:mw,minHeight:0,maxHeight:sizing.maxHeight ?? vh-16,contentHeightHint:mh});
  menu.style.top = `${Math.round(layout.top)}px`;
  menu.style.left = `${Math.round(layout.left)}px`;
  menu.style.maxHeight = `${layout.maxHeight}px`;
  const release = claimMenuFocus(()=>closeCheckpointMenu(false));
  btn.setAttribute('aria-expanded','true');

  openMenu = {
    el: menu,
    anchor: btn,
    owner,
    close: (restore = true) => {
      const ownsFocus = menu.contains(document.activeElement);
      release();
      ac.abort();
      btn.setAttribute('aria-expanded','false');
      menu.remove();
      if (restore && ownsFocus && btn.isConnected) btn.focus({preventScroll:true});
    },
  };
  focus(last?available.length-1:Math.max(0,available.findIndex(item=>item.dataset.icenScope===selected)));
}

interface MarkedCheckpointScope extends ParentNode {
  __icenKbCheckpointInit?: boolean;
}

const noopDestroy = (): void => undefined;
const handledCheckpointEvents = new WeakSet<Event>();

/**
 * 委托初始化：点击 .icen-kb-checkpoint 弹恢复菜单（scope 三选，默认预选「仅内容」），
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
    if (handledCheckpointEvents.has(e)) return;
    const t = e.target instanceof Element ? e.target : null;
    const btn = t?.closest<HTMLElement>('.icen-kb-checkpoint');
    if (!btn || !btn.dataset.icenCheckpointId) return;
    if (btn.matches(':disabled,[aria-disabled="true"]')) return;
    handledCheckpointEvents.add(e);
    openCheckpointMenu(btn, scope);
  };

  const target = scope as ParentNode & EventTarget;
  target.addEventListener('click', onClick);
  const onKeydown = (event: Event): void => {
    const key = event as KeyboardEvent;
    if (!['ArrowDown','ArrowUp'].includes(key.key) || handledCheckpointEvents.has(event)) return;
    const btn = key.target instanceof Element ? key.target.closest<HTMLElement>('.icen-kb-checkpoint') : null;
    if (!btn || btn.matches(':disabled,[aria-disabled="true"]')) return;
    key.preventDefault(); handledCheckpointEvents.add(event); openCheckpointMenu(btn,scope,key.key==='ArrowUp');
  };
  target.addEventListener('keydown', onKeydown);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('keydown', onKeydown);
    if (openMenu && (openMenu.owner === scope || scope instanceof Node && (scope === openMenu.anchor || scope.contains(openMenu.anchor)))) closeCheckpointMenu(false);
    marked.__icenKbCheckpointInit = false;
  };
}
