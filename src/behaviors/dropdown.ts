/*
 * @icen.ai/ui — Behavior: dropdown（下拉菜单，与 components/menu.css 配套）
 *
 * 契约：
 *   <div class="dropdown" data-dropdown>
 *     <button class="dropdown-trigger" data-dropdown-trigger aria-haspopup="menu">操作 ▾</button>
 *     <div data-dropdown-menu hidden>
 *       <button class="menu-item">…</button>   <!-- 模板节点，children 会被移入面板 -->
 *     </div>
 *   </div>
 *
 * 面板为 JS 在 document.body 创建的 .menu（fixed 定位：trigger 下方 offset 4px，
 * 视口 12px margin 内 clamp，下方空间不足翻上）。trigger click/ArrowDown 打开；
 * ↑↓ 循环高亮（跳过 disabled/separator）、Enter 激活并关闭、Esc 关闭还原焦点、
 * 外点/滚动（捕获）关闭；trigger aria-expanded 同步。SSR 下为 no-op。
 */

const VIEWPORT_MARGIN = 12;
const SIDE_OFFSET = 4;

interface ActiveDropdown {
  trigger: HTMLElement;
  template: HTMLElement;
  panel: HTMLElement;
  items: HTMLElement[];
  highlight: number;
}

let active: ActiveDropdown | null = null;
let initialized = false;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function menuItems(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>('.menu-item:not(.is-disabled):not(:disabled)'));
}

function setHighlight(next: number): void {
  if (!active) return;
  active.items.forEach((el, i) => el.classList.toggle('is-highlighted', i === next));
  active.highlight = next;
}

function place(): void {
  if (!active) return;
  const { trigger, panel } = active;
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;

  const left = clamp(rect.left, VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - pw);
  let top = rect.bottom + SIDE_OFFSET;
  let side: 'bottom' | 'top' = 'bottom';
  if (top + ph > vh - VIEWPORT_MARGIN && rect.top - SIDE_OFFSET - ph >= VIEWPORT_MARGIN) {
    top = rect.top - SIDE_OFFSET - ph;
    side = 'top';
  }
  top = clamp(top, VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - ph);

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.dataset.side = side;
}

function openDropdown(trigger: HTMLElement, highlightFirst = false): void {
  closeDropdown();

  const root = trigger.closest<HTMLElement>('[data-dropdown]');
  const template = root?.querySelector<HTMLElement>('[data-dropdown-menu]');
  if (!root || !template) return;

  const panel = document.createElement('div');
  panel.className = 'menu';
  panel.setAttribute('role', 'menu');
  panel.style.visibility = 'hidden';
  while (template.firstChild) panel.appendChild(template.firstChild);
  panel
    .querySelectorAll<HTMLElement>('.menu-item')
    .forEach((el) => el.setAttribute('role', 'menuitem'));
  document.body.appendChild(panel);

  active = { trigger, template, panel, items: menuItems(panel), highlight: -1 };
  trigger.setAttribute('aria-expanded', 'true');

  place();
  panel.style.visibility = '';
  if (highlightFirst && active.items.length > 0) setHighlight(0);

  document.addEventListener('pointerdown', onOutsidePointerDown, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('keydown', onKeyDown);
}

function closeDropdown(restoreFocus = false): void {
  if (!active) return;
  const { trigger, template, panel } = active;
  active = null;

  trigger.setAttribute('aria-expanded', 'false');
  while (panel.firstChild) template.appendChild(panel.firstChild);
  panel.remove();

  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  document.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('keydown', onKeyDown);

  if (restoreFocus) trigger.focus();
}

function onOutsidePointerDown(e: Event): void {
  if (!active) return;
  const target = e.target;
  if (!(target instanceof Node)) return;
  if (active.panel.contains(target) || active.trigger.contains(target)) return;
  closeDropdown();
}

function onScroll(): void {
  closeDropdown();
}

function onKeyDown(e: KeyboardEvent): void {
  if (!active) return;
  const { items } = active;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeDropdown(true);
    return;
  }
  if (items.length === 0) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const offset = e.key === 'ArrowDown' ? 1 : -1;
    const next =
      active.highlight < 0
        ? offset > 0
          ? 0
          : items.length - 1
        : (active.highlight + offset + items.length) % items.length;
    setHighlight(next);
    return;
  }
  if (e.key === 'Enter' && active.highlight >= 0) {
    e.preventDefault();
    const item = items[active.highlight];
    closeDropdown(true);
    item.click();
  }
}

/** 绑定全部 [data-dropdown-trigger]（document 级委托，重复调用安全）。 */
export function initDropdown(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;

  root
    .querySelectorAll<HTMLElement>('[data-dropdown-trigger]')
    .forEach((el) => el.setAttribute('aria-expanded', 'false'));

  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    // 面板内点击菜单项：激活后关闭（item 自身的 click 监听照常执行）
    if (active && target.closest('.menu-item') && active.panel.contains(target)) {
      const item = target.closest('.menu-item');
      if (item) {
        closeDropdown();
        return;
      }
    }

    const trigger = target.closest<HTMLElement>('[data-dropdown-trigger]');
    if (!trigger) return;
    if (active && active.trigger === trigger) closeDropdown();
    else openDropdown(trigger);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown') return;
    if (active) return;
    const target = e.target instanceof Element ? e.target : null;
    const trigger = target?.closest<HTMLElement>('[data-dropdown-trigger]');
    if (!trigger) return;
    e.preventDefault();
    openDropdown(trigger, true);
  });
}
