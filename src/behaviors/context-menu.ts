/*
 * @icen.ai/ui — Behavior: context-menu（右键菜单，与 components/menu.css 配套）
 *
 * 全局单例：监听 document contextmenu，命中最近的 [data-context-menu]（值=菜单 id），
 * 用 registerContextMenu(id, items) 注册的 items 渲染；未注册/未命中时用默认菜单
 * （后退/前进/刷新/复制页面链接）。initContextMenu({ items }) 可替换默认菜单。
 * 触屏：长按 520ms 打开，移动容差 12px。面板为 body 下的 .menu.menu--context，
 * fixed 定位鼠标点，量尺寸后翻转并 clamp ≥8px，z-index 9999（见 menu.css）。
 * 文本一律 textContent 赋值（icon 为调用方提供的可信 svg 字符串）。SSR 下为 no-op。
 *
 * 条目选中（点击或 Enter）统一派发 icen:menu-select
 * { source: 面板, item, value: item.dataset.value ?? '', label: textContent 前 80 字 }
 * ——与 dropdown / command-palette 共用同一事件（统一菜单选中流）。
 */

export interface ContextMenuEntry {
  label: string;
  subLabel?: string;
  /** 可信 svg 字符串（唯一走 innerHTML 的字段） */
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface ContextMenuSeparator {
  type: 'separator';
}

export interface ContextMenuHeader {
  type: 'header';
  label: string;
  description?: string;
}

export type ContextMenuItem = ContextMenuEntry | ContextMenuSeparator | ContextMenuHeader;

export interface ContextMenuOptions {
  /** 替换内置默认菜单（未命中任何注册 id 时使用） */
  items?: ContextMenuItem[];
}

import { applyPanelSizing, readPanelSizing, type PanelSizing } from './popover';
import { emitIcen } from './events';

/* 触屏长按阈值/移动容差：与 events.ts 的 LONGPRESS_MS / LONGPRESS_MOVE 同值——
   右键菜单的触屏长按自带（不经 data-gestures 授权），故独立命名、各自演化 */
const LONG_PRESS_DELAY = 520;
const LONG_PRESS_MOVE_LIMIT = 12;
const FLIP_MARGIN = 10;
const CLAMP_MARGIN = 8;

/** 菜单选中统一事件（dropdown / context-menu / command-palette 同一契约）。
 *  本模块为唯一定义点，dropdown / command-palette 改为 import 复用（收敛三份逐字拷贝）。 */
export function emitMenuSelect(source: HTMLElement, item: HTMLElement): void {
  emitIcen(item, 'icen:menu-select', {
    source,
    item,
    value: item.dataset.value ?? '',
    /* 优先专用 label 子元素（避开快捷键/图标文本混入），无则退整项文本 */
    label: (item.querySelector('.menu-item-label, .command-item-label')?.textContent ?? item.textContent ?? '')
      .trim()
      .slice(0, 80),
  });
}

const registry = new Map<string, ContextMenuItem[]>();
let fallbackItems: ContextMenuItem[] | null = null;
let initialized = false;

let panel: HTMLElement | null = null;
let focusableItems: HTMLElement[] = [];
let focusedIndex = -1;
let longPress: { timer: number; x: number; y: number; target: Element | null } | null = null;

/** 注册指定 id 的右键菜单项（对应 DOM 中的 [data-context-menu="id"]）。 */
export function registerContextMenu(id: string, items: ContextMenuItem[]): void {
  registry.set(id, items);
}

function defaultItems(): ContextMenuItem[] {
  return [
    {
      label: '后退',
      shortcut: 'Alt ←',
      disabled: window.history.length <= 1,
      onClick: () => window.history.back(),
    },
    { label: '前进', shortcut: 'Alt →', onClick: () => window.history.forward() },
    { type: 'separator' },
    { label: '刷新', shortcut: 'Ctrl R', onClick: () => window.location.reload() },
    {
      label: '复制页面链接',
      onClick: () => {
        void navigator.clipboard?.writeText(window.location.href);
      },
    },
  ];
}

function resolveItems(target: Element | null): ContextMenuItem[] {
  const host = target?.closest<HTMLElement>('[data-context-menu]');
  const id = host?.dataset.contextMenu;
  if (id) {
    const items = registry.get(id);
    if (items) return items;
  }
  return fallbackItems ?? defaultItems();
}

function isEditable(target: Element | null): boolean {
  return Boolean(target?.closest('input, textarea, [contenteditable="true"]'));
}

function buildItem(item: ContextMenuItem, menuPanel: HTMLElement): HTMLElement {
  if ('type' in item && item.type === 'separator') {
    const sep = document.createElement('div');
    sep.className = 'menu-separator';
    sep.setAttribute('role', 'separator');
    return sep;
  }
  if ('type' in item && item.type === 'header') {
    const header = document.createElement('div');
    header.className = 'menu-header';
    const label = document.createElement('span');
    label.className = 'menu-header-label';
    label.textContent = item.label;
    header.appendChild(label);
    if (item.description) {
      const desc = document.createElement('span');
      desc.className = 'menu-header-desc';
      desc.textContent = item.description;
      header.appendChild(desc);
    }
    return header;
  }

  const entry = item;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = entry.danger ? 'menu-item pressable menu-item--danger' : 'menu-item pressable';
  if (entry.disabled) btn.disabled = true;
  btn.setAttribute('role', 'menuitem');
  btn.tabIndex = -1;

  const icon = document.createElement('span');
  icon.className = 'menu-item-icon';
  if (entry.icon) icon.innerHTML = entry.icon;
  btn.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'menu-item-label';
  label.textContent = entry.label;
  if (entry.subLabel) {
    const sub = document.createElement('span');
    sub.className = 'menu-item-sub';
    sub.textContent = entry.subLabel;
    label.appendChild(sub);
  }
  btn.appendChild(label);

  if (entry.shortcut) {
    const shortcut = document.createElement('span');
    shortcut.className = 'menu-item-shortcut';
    shortcut.textContent = entry.shortcut;
    btn.appendChild(shortcut);
  }

  btn.addEventListener('click', () => {
    /* 先派菜单选中统一事件，再执行条目回调（Enter 路径经 click() 同样到达） */
    emitMenuSelect(menuPanel, btn);
    entry.onClick?.();
    closeContextMenu();
  });
  return btn;
}

/** 在 (x, y) 打开右键菜单（视口边缘自动翻转并 clamp）。
    尺寸走全库统一 PanelSizing 契约：opts.sizing 直接传入（面板无固定宿主元素，
    由调用方从其根元素 readPanelSizing 读入，如 datatable 行右键）。 */
export function openContextMenu(
  x: number,
  y: number,
  items: ContextMenuItem[],
  opts?: { sizing?: PanelSizing },
): void {
  if (typeof document === 'undefined') return;
  closeContextMenu();

  panel = document.createElement('div');
  panel.className = 'menu menu--context';
  panel.setAttribute('role', 'menu');
  panel.style.visibility = 'hidden';
  applyPanelSizing(panel, opts?.sizing ?? {});

  for (const item of items) panel.appendChild(buildItem(item, panel));
  document.body.appendChild(panel);

  // 量尺寸后翻转：越右/下边缘就往左/上翻，最后 clamp ≥ 8px
  const rect = panel.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let nx = x;
  let ny = y;
  if (x + rect.width > vw - FLIP_MARGIN) nx = x - rect.width;
  if (y + rect.height > vh - FLIP_MARGIN) ny = y - rect.height;
  if (nx < CLAMP_MARGIN) nx = CLAMP_MARGIN;
  if (ny < CLAMP_MARGIN) ny = CLAMP_MARGIN;
  /* data-side 写回（与 dropdown/select 同契约）：CSS 进场动画按方向区分 */
  panel.dataset.side = ny < y ? 'top' : 'bottom';
  panel.style.left = `${nx}px`;
  panel.style.top = `${ny}px`;
  panel.style.visibility = '';

  focusableItems = Array.from(panel.querySelectorAll<HTMLElement>('.menu-item:not(:disabled)'));
  focusedIndex = -1;
  // rAF 聚焦首个非 disabled 项
  requestAnimationFrame(() => {
    if (!panel || focusableItems.length === 0) return;
    setFocused(0);
  });

  document.addEventListener('pointerdown', onOutsidePointerDown, true);
  document.addEventListener('scroll', onScrollSignal, true);
  window.addEventListener('resize', onCloseSignal);
  window.addEventListener('keydown', onKeyDown);
}

/** 关闭当前右键菜单（未打开时为 no-op）。 */
export function closeContextMenu(): void {
  if (!panel) return;
  panel.remove();
  panel = null;
  focusableItems = [];
  focusedIndex = -1;
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  document.removeEventListener('scroll', onScrollSignal, true);
  window.removeEventListener('resize', onCloseSignal);
  window.removeEventListener('keydown', onKeyDown);
}

/**
 * @deprecated 已更名 closeContextMenu（与全库浮层 close* 命名对齐）；
 * 本别名仅为兼容保留，下个大版本删除。
 */
export function closeMenu(): void {
  closeContextMenu();
}

function setFocused(next: number): void {
  if (!panel || focusableItems.length === 0) return;
  focusedIndex = ((next % focusableItems.length) + focusableItems.length) % focusableItems.length;
  focusableItems[focusedIndex].focus();
}

function onOutsidePointerDown(e: Event): void {
  if (!panel) return;
  const target = e.target;
  if (!(target instanceof Node) || !panel.contains(target)) closeContextMenu();
}

function onScrollSignal(e: Event): void {
  /* 滚动发生在面板内部（菜单自身滚动）时不关闭 */
  if (panel && e.target instanceof Node && panel.contains(e.target)) return;
  closeContextMenu();
}

function onCloseSignal(): void {
  closeContextMenu();
}

function onKeyDown(e: KeyboardEvent): void {
  if (!panel) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeContextMenu();
    return;
  }
  if (focusableItems.length === 0) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setFocused(focusedIndex + 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setFocused(focusedIndex - 1);
  } else if (e.key === 'Enter' && focusedIndex >= 0) {
    e.preventDefault();
    focusableItems[focusedIndex].click();
  }
}

function clearLongPress(): void {
  if (!longPress) return;
  window.clearTimeout(longPress.timer);
  longPress = null;
}

function openForTarget(target: Element | null, x: number, y: number): void {
  /* 声明式区域的 data-panel-* 尺寸契约随区域元素读入。
     target 是右键命中的最深子元素，data-panel-* 挂在 [data-context-menu] 区域根上——
     直接读 target 会读空，需上溯到区域根；非 Element（null）或无区域根时退 target 本身 */
  openContextMenu(
    x,
    y,
    resolveItems(target),
    { sizing: readPanelSizing(target instanceof Element ? (target.closest('[data-context-menu]') ?? target) : target) },
  );
}

// 输入框/可编辑区域保留原生菜单
function onContextMenu(e: MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  if (isEditable(target)) return;
  e.preventDefault();
  openForTarget(target, e.clientX, e.clientY);
}

// 触屏长按起点（520ms 后打开，移动超过 12px 取消）
function onLongPressStart(e: PointerEvent): void {
  if (e.pointerType !== 'touch') return;
  const target = e.target instanceof Element ? e.target : null;
  if (!target || isEditable(target)) return;
  clearLongPress();
  const startX = e.clientX;
  const startY = e.clientY;
  const timer = window.setTimeout(() => {
    longPress = null;
    openForTarget(target, startX, startY);
  }, LONG_PRESS_DELAY);
  longPress = { timer, x: startX, y: startY, target };
}

function onLongPressMove(e: PointerEvent): void {
  if (!longPress) return;
  if (Math.hypot(e.clientX - longPress.x, e.clientY - longPress.y) > LONG_PRESS_MOVE_LIMIT) {
    clearLongPress();
  }
}

/**
 * 启动全局右键菜单（重复调用安全）。
 * opts.items 提供时替换内置默认菜单。
 * 返回销毁函数：摘除 init 注册的全部 document 监听并复位幂等标记（销毁后可重新
 * init）；销毁时若有菜单开着会顺带关闭（摘净 openContextMenu 挂的浮层监听）。
 */
export function initContextMenu(opts: ContextMenuOptions = {}): () => void {
  if (typeof document === 'undefined') return () => {};
  if (opts.items) fallbackItems = opts.items;
  if (initialized) return () => {};
  initialized = true;

  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('pointerdown', onLongPressStart);
  document.addEventListener('pointermove', onLongPressMove);
  document.addEventListener('pointerup', clearLongPress);
  document.addEventListener('pointercancel', clearLongPress);

  return (): void => {
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('pointerdown', onLongPressStart);
    document.removeEventListener('pointermove', onLongPressMove);
    document.removeEventListener('pointerup', clearLongPress);
    document.removeEventListener('pointercancel', clearLongPress);
    closeContextMenu();
    /* 复位幂等标记，销毁后可重新 init */
    initialized = false;
  };
}
