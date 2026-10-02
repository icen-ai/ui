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
 *
 * 菜单项选中（点击或 Enter）统一派发 icen:menu-select
 * { source: 面板, item, value: item.dataset.value ?? '', label: textContent 前 80 字 }
 * ——与 context-menu / command-palette 共用同一事件（统一菜单选中流）。
 *
 * 面板尺寸走全库统一 PanelSizing 契约（见 behaviors/popover.ts）：
 * 根上 data-panel-width（固定）/ data-panel-min / data-panel-max /
 * data-panel-max-height → 创建面板时内联应用（宽度默认内容驱动，CSS min 180/max 320）。
 */

import { applyPanelSizing, computePopoverLayout, readPanelSizing } from './popover';
/* emitMenuSelect（菜单选中统一事件）收敛自 context-menu（唯一定义点，消除逐字拷贝）；
   本模块不再直接用 emitIcen，events 导入随之移除 */
import { emitMenuSelect } from './context-menu';

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

function menuItems(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>('.menu-item:not(.is-disabled):not(:disabled)'));
}

function setHighlight(next: number): void {
  if (!active) return;
  active.items.forEach((el, i) => el.classList.toggle('is-highlighted', i === next));
  active.highlight = next;
}

/* 布局统一走 computePopoverLayout（与 select 同一引擎）：prefer 下方、空间不足翻上、
   视口 margin 内 clamp；fixed 定位直接用视口坐标，不加 scrollX/Y。
   宽度不传 opts——面板宽仍内容驱动（CSS min 180 / max 320），引擎默认宽仅参与
   left 的视口钳制；side 写回 dataset 供 CSS 进场动画分方向 */
function place(): void {
  if (!active) return;
  const { trigger, panel } = active;
  const rect = trigger.getBoundingClientRect();
  const layout = computePopoverLayout(
    rect,
    { width: window.innerWidth, height: window.innerHeight },
    { side: 'bottom', offset: SIDE_OFFSET, margin: VIEWPORT_MARGIN },
  );
  panel.style.left = `${layout.left}px`;
  panel.style.top = `${layout.top}px`;
  panel.dataset.side = layout.side;
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
  applyPanelSizing(panel, readPanelSizing(root));
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

function onScroll(e: Event): void {
  if (!active) return;
  /* 滚动发生在面板内部（长菜单自身滚动）时不关闭 */
  const target = e.target;
  if (target instanceof Node && active.panel.contains(target)) return;
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
    /* 面板尚在文档内先派 menu-select（关闭后 item 已脱文档，冒泡不可达 document） */
    emitMenuSelect(active.panel, item);
    closeDropdown(true);
    item.click();
  }
}

/**
 * 绑定全部 [data-dropdown-trigger]（document 级委托，重复调用安全）。
 * 返回销毁函数：摘除 document 委托并复位幂等标记（销毁后可重新 init）；
 * 销毁时若有面板开着会顺带收起。SSR 下返回 no-op。
 */
export function initDropdown(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;

  scope
    .querySelectorAll<HTMLElement>('[data-dropdown-trigger]')
    .forEach((el) => el.setAttribute('aria-expanded', 'false'));

  if (initialized) return () => {};
  initialized = true;

  const onClick = (e: MouseEvent): void => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    // 面板内点击菜单项：派 menu-select 后关闭（item 自身的 click 监听照常执行）
    if (active && target.closest('.menu-item') && active.panel.contains(target)) {
      const item = target.closest<HTMLElement>('.menu-item');
      if (item) {
        /* 与 Enter 路径一致：不可选项（.is-disabled/:disabled）不派选中事件 */
        if (!item.matches('.is-disabled') && !item.matches(':disabled')) {
          emitMenuSelect(active.panel, item);
        }
        closeDropdown();
        return;
      }
    }

    const trigger = target.closest<HTMLElement>('[data-dropdown-trigger]');
    if (!trigger) return;
    if (active && active.trigger === trigger) closeDropdown();
    else openDropdown(trigger);
  };
  document.addEventListener('click', onClick);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown') return;
    if (active) return;
    const target = e.target instanceof Element ? e.target : null;
    const trigger = target?.closest<HTMLElement>('[data-dropdown-trigger]');
    if (!trigger) return;
    e.preventDefault();
    openDropdown(trigger, true);
  };
  document.addEventListener('keydown', onKeyDown);

  const destroy = (): void => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeyDown);
    closeDropdown();
    /* 复位幂等标记，销毁后可重新 init */
    initialized = false;
  };
  return destroy;
}
