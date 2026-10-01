/*
 * @icen.ai/ui — Behavior: command-palette（命令面板，与 components/command-palette.css 配套）
 *
 * 契约：
 *   <div class="command-palette-backdrop" data-command-palette="id" hidden>
 *     <div class="command-palette">
 *       <div class="command-palette-search">
 *         <span class="command-palette-search-icon">…svg…</span>
 *         <input class="command-palette-input" placeholder="搜索命令…" />
 *         <kbd class="command-palette-esc">ESC</kbd>
 *       </div>
 *       <div class="command-palette-body">
 *         <div class="command-palette-group">
 *           <p class="command-palette-group-label">分组</p>
 *           <button class="command-palette-item" type="button" data-command-palette-keyword="别名 关键词">
 *             …
 *           </button>
 *         </div>
 *         <div class="command-palette-empty" hidden>无匹配命令</div>
 *       </div>
 *       <div class="command-palette-foot">…</div>
 *     </div>
 *   </div>
 *
 *   触发器（任选其一）：
 *   <button data-command-palette-open="id">打开</button>
 *   全局快捷键 ⌘K / Ctrl+K → 打开键位匹配的面板（按文档序取第一个匹配者）。
 *   backdrop 上加 data-command-palette-key="p" 可覆盖默认键 k（修饰键仍为
 *   ⌘/Ctrl），多个面板各自注册、互不冲突。
 *
 * 功能：搜索过滤 + ↑↓ 导航（跳过 disabled / aria-disabled / hidden 项）
 * + Enter 执行（点击或回调 data-command-palette-action id）
 * + ESC 关闭 + 外点关闭 + 焦点陷阱。同时只开一个。
 * 命令项支持：data-command-palette-keyword 额外关键字、disabled / hidden 状态。
 * 点击 item 默认关闭面板，除非加 data-command-palette-keep-open。
 * backdrop 被外部移除时关闭路径仍复位状态/监听/滚动锁。SSR 下为 no-op。
 */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openId: string | null = null;
let restoreFocusTo: HTMLElement | null = null;
let prevBodyOverflow = '';
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let globalKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let initialized = false;

function findBackdrop(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.command-palette-backdrop[data-command-palette="${CSS.escape(id)}"]`,
  );
}

function getVisibleItems(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      '.command-palette-item:not([hidden]):not([disabled]):not([aria-disabled="true"])',
    ),
  ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
}

function isDisabledItem(el: HTMLElement): boolean {
  return (
    el.hasAttribute('disabled') ||
    el.getAttribute('aria-disabled') === 'true'
  );
}

function setActive(panel: HTMLElement, idx: number): void {
  const items = getVisibleItems(panel);
  items.forEach((el, i) => el.classList.toggle('is-active', i === idx));
  const active = items[idx];
  if (active && typeof active.scrollIntoView === 'function') {
    active.scrollIntoView({ block: 'nearest' });
  }
}

function filterPanel(panel: HTMLElement, query: string): void {
  const q = query.trim().toLowerCase();
  let visibleCount = 0;
  panel.querySelectorAll<HTMLElement>('.command-palette-item').forEach((item) => {
    if (isDisabledItem(item)) return;
    const label = (item.querySelector('.command-palette-item-label')?.textContent ?? '').toLowerCase();
    const hint = (item.querySelector('.command-palette-item-hint')?.textContent ?? '').toLowerCase();
    const keyword = (item.dataset.commandPaletteKeyword ?? '').toLowerCase();
    const match = !q || label.includes(q) || hint.includes(q) || keyword.includes(q);
    item.hidden = !match;
    item.classList.remove('is-active');
    if (match) visibleCount++;
  });
  // 隐藏空分组
  panel.querySelectorAll<HTMLElement>('.command-palette-group').forEach((group) => {
    const hasVisible = Array.from(group.querySelectorAll<HTMLElement>('.command-palette-item')).some(
      (it) => !it.hidden,
    );
    group.hidden = !hasVisible;
  });
  const empty = panel.querySelector<HTMLElement>('.command-palette-empty');
  if (empty) empty.hidden = visibleCount !== 0;
  if (visibleCount > 0) setActive(panel, 0);
}

/** 打开指定 id 的命令面板。 */
export function openCommandPalette(id: string): void {
  if (typeof document === 'undefined') return;
  if (openId === id) return;
  if (openId) closeCommandPalette(openId);

  const backdrop = findBackdrop(id);
  if (!backdrop) {
    console.warn(`[@icen.ai/ui] command-palette: 未找到 data-command-palette="${id}" 的 .command-palette-backdrop，已跳过打开`);
    return;
  }
  const panel = backdrop.querySelector<HTMLElement>('.command-palette');
  if (!panel) return;

  if (backdrop.parentElement !== document.body) document.body.appendChild(backdrop);

  restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  openId = id;
  backdrop.hidden = false;

  prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const input = panel.querySelector<HTMLInputElement>('.command-palette-input');
  if (input) {
    input.value = '';
    input.focus();
  } else {
    panel.focus();
  }

  filterPanel(panel, '');

  keyHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette(id);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = getVisibleItems(panel);
      if (items.length === 0) return;
      const cur = items.findIndex((el) => el.classList.contains('is-active'));
      const next = e.key === 'ArrowDown'
        ? (cur + 1) % items.length
        : (cur - 1 + items.length) % items.length;
      setActive(panel, next);
      return;
    }
    if (e.key === 'Enter') {
      const active = panel.querySelector<HTMLElement>('.command-palette-item.is-active');
      // isDisabledItem 兜底拦截（getVisibleItems 已排除 disabled / aria-disabled）
      if (active && !isDisabledItem(active)) {
        e.preventDefault();
        active.click();
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hidden && el.offsetParent !== null,
      );
      if (els.length === 0) return;
      const cur = els.findIndex((el) => el === document.activeElement);
      const next = e.shiftKey
        ? (cur - 1 + els.length) % els.length
        : (cur + 1) % els.length;
      els[next]?.focus();
    }
  };
  window.addEventListener('keydown', keyHandler);
}

/** 关闭指定 id 的命令面板（backdrop 已被外部移除时也照常复位状态/监听/滚动锁）。 */
export function closeCommandPalette(id: string): void {
  if (typeof document === 'undefined') return;
  const backdrop = findBackdrop(id);
  if (backdrop) backdrop.hidden = true;
  if (openId !== id) return;
  openId = null;
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  document.body.style.overflow = prevBodyOverflow;
  if (restoreFocusTo && restoreFocusTo.isConnected) restoreFocusTo.focus();
  restoreFocusTo = null;
}

/** 初始化：委托监听触发器 / 搜索 / 外点 / 全局快捷键。 */
export function initCommandPalette(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  if (typeof window === 'undefined') return;
  const scope = root ?? document;

  scope
    .querySelectorAll<HTMLElement>('[data-command-palette-open]')
    .forEach((el) => el.setAttribute('aria-haspopup', 'dialog'));

  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const opener = target.closest<HTMLElement>('[data-command-palette-open]');
    if (opener?.dataset.commandPaletteOpen) {
      openCommandPalette(opener.dataset.commandPaletteOpen);
      return;
    }

    // 点击命令项：默认关闭面板（除非 keep-open）
    const item = target.closest<HTMLElement>('.command-palette-item');
    if (item) {
      const backdrop = item.closest<HTMLElement>('[data-command-palette]');
      if (backdrop?.dataset.commandPalette) {
        if (!item.hasAttribute('data-command-palette-keep-open')) {
          closeCommandPalette(backdrop.dataset.commandPalette);
        }
      }
      return;
    }

    // 外点 / backdrop 点击
    if (
      target instanceof HTMLElement &&
      target.classList.contains('command-palette-backdrop') &&
      target.dataset.commandPalette
    ) {
      closeCommandPalette(target.dataset.commandPalette);
    }
  });

  // 输入过滤（事件委托）
  document.addEventListener('input', (e) => {
    if (!(e.target instanceof HTMLElement)) return;
    if (!e.target.matches('.command-palette-input')) return;
    const backdrop = e.target.closest<HTMLElement>('[data-command-palette]');
    const panel = backdrop?.querySelector<HTMLElement>('.command-palette');
    if (panel) filterPanel(panel, (e.target as HTMLInputElement).value);
  });

  // 全局快捷键：默认 ⌘K / Ctrl+K；backdrop 的 data-command-palette-key 覆盖键位
  globalKeyHandler = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    const palettes = document.querySelectorAll<HTMLElement>(
      '.command-palette-backdrop[data-command-palette]',
    );
    for (const backdrop of Array.from(palettes)) {
      const paletteKey = (backdrop.dataset.commandPaletteKey ?? 'k').toLowerCase();
      if (paletteKey !== key) continue;
      const id = backdrop.dataset.commandPalette;
      if (!id) continue;
      e.preventDefault();
      if (openId === id) closeCommandPalette(id);
      else openCommandPalette(id);
      return;
    }
  };
  window.addEventListener('keydown', globalKeyHandler);
}
