/*
 * @icen.ai/ui — Behavior: context-menu（右键菜单，与 components/menu.css 配套）
 *
 * 全局单例：监听 document contextmenu，命中最近的 [data-context-menu]（值=菜单 id），
 * 用 registerContextMenu(id, items) 注册的 items 渲染；未注册/未命中时用默认菜单
 * （后退/前进/刷新/复制页面链接）。initContextMenu({ items }) 可替换默认菜单。
 * 触屏：长按 520ms 打开，移动容差 12px。面板为 body 下的 .menu.menu--context，
 * fixed 定位鼠标点，量尺寸后翻转并 clamp ≥8px，z-index 9999（见 menu.css）。
 * 文本一律 textContent 赋值（icon 为调用方提供的可信 svg 字符串）。SSR 下为 no-op。
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

const LONG_PRESS_DELAY = 520;
const LONG_PRESS_MOVE_LIMIT = 12;
const FLIP_MARGIN = 10;
const CLAMP_MARGIN = 8;

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

function buildItem(item: ContextMenuItem): HTMLElement {
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
    entry.onClick?.();
    closeMenu();
  });
  return btn;
}

/** 在 (x, y) 打开右键菜单（视口边缘自动翻转并 clamp）。 */
export function openContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
  if (typeof document === 'undefined') return;
  closeMenu();

  panel = document.createElement('div');
  panel.className = 'menu menu--context';
  panel.setAttribute('role', 'menu');
  panel.style.visibility = 'hidden';

  for (const item of items) panel.appendChild(buildItem(item));
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
export function closeMenu(): void {
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

function setFocused(next: number): void {
  if (!panel || focusableItems.length === 0) return;
  focusedIndex = ((next % focusableItems.length) + focusableItems.length) % focusableItems.length;
  focusableItems[focusedIndex].focus();
}

function onOutsidePointerDown(e: Event): void {
  if (!panel) return;
  const target = e.target;
  if (!(target instanceof Node) || !panel.contains(target)) closeMenu();
}

function onScrollSignal(e: Event): void {
  /* 滚动发生在面板内部（菜单自身滚动）时不关闭 */
  if (panel && e.target instanceof Node && panel.contains(e.target)) return;
  closeMenu();
}

function onCloseSignal(): void {
  closeMenu();
}

function onKeyDown(e: KeyboardEvent): void {
  if (!panel) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu();
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
  openContextMenu(x, y, resolveItems(target));
}

/**
 * 启动全局右键菜单（重复调用安全）。
 * opts.items 提供时替换内置默认菜单。
 */
export function initContextMenu(opts: ContextMenuOptions = {}): void {
  if (typeof document === 'undefined') return;
  if (opts.items) fallbackItems = opts.items;
  if (initialized) return;
  initialized = true;

  // 输入框/可编辑区域保留原生菜单
  document.addEventListener('contextmenu', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (isEditable(target)) return;
    e.preventDefault();
    openForTarget(target, e.clientX, e.clientY);
  });

  // 触屏长按（520ms，移动超过 12px 取消）
  document.addEventListener('pointerdown', (e) => {
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
  });
  document.addEventListener('pointermove', (e) => {
    if (!longPress) return;
    if (Math.hypot(e.clientX - longPress.x, e.clientY - longPress.y) > LONG_PRESS_MOVE_LIMIT) {
      clearLongPress();
    }
  });
  document.addEventListener('pointerup', clearLongPress);
  document.addEventListener('pointercancel', clearLongPress);
}
