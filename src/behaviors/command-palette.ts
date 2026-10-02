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
 * + Enter 执行（DOM 条目走自身 click；编程条目走 onSelect 回调）
 * + ESC 关闭 + 外点关闭 + 焦点陷阱。同时只开一个。
 * 命令项支持：data-command-palette-keyword 额外关键字、disabled / hidden 状态。
 * 点击 item 默认关闭面板，除非加 data-command-palette-keep-open。
 * backdrop 被外部移除时关闭路径仍复位状态/监听/滚动锁。SSR 下为 no-op。
 *
 * 事件：打开/关闭从 document 广播 icen:command-palette-open / -close
 * （detail 为空对象）；条目选中（点击或 Enter）派 icen:menu-select
 * { source: 面板, item, value, label }——与 dropdown / context-menu 同一契约。
 *
 * 编程条目：openCommandPalette(id, { items }) 传入时重建面板条目 DOM
 * （沿用现有条目类名/data 契约），条目 onSelect 在选中时调用（先派
 * menu-select 再执行 onSelect，与 DOM 条目自带的 click 路径并存）；
 * opts.filter 可覆盖默认 includes 过滤。
 */

/* 与 modal.ts 的 FOCUSABLE 同一选择器集合（焦点陷阱全库一致） */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"]), audio, video, details>summary';

import { applyPanelSizing, readPanelSizing } from './popover';
import { emitIcen } from './events';

/** 编程命令条目（openCommandPalette 的 opts.items 元素类型）。 */
export interface CommandPaletteCommand {
  /** 条目名（.command-palette-item-label，textContent 渲染） */
  label: string;
  /** 副标题（.command-palette-item-hint） */
  hint?: string;
  /** 额外搜索关键字（data-command-palette-keyword） */
  keyword?: string;
  /** 选中回调：先派 icen:menu-select，再执行本回调 */
  onSelect?: () => void;
  /** 选中后保持面板打开（data-command-palette-keep-open） */
  keepOpen?: boolean;
  /** 附加到条目元素的自定义属性（如 data-*） */
  attrs?: Record<string, string>;
}

export interface CommandPaletteOpenOptions {
  /** 编程条目：传入时重建面板条目 DOM（替换面板内全部 .command-palette-group） */
  items?: CommandPaletteCommand[];
  /** 覆盖默认 includes 过滤（query 为原始输入；空 query 仍视为匹配全部）。只作用于编程条目 */
  filter?: (query: string, item: CommandPaletteCommand) => boolean;
}

let openId: string | null = null;
let restoreFocusTo: HTMLElement | null = null;
let prevBodyOverflow = '';
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let globalKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let teardown: (() => void) | null = null;

/* 编程条目运行时登记：DOM → 命令定义（供自定义过滤）+ 防与 Enter/点击路径双派 menu-select */
const programmaticCommands = new WeakMap<HTMLElement, CommandPaletteCommand>();
let customFilter: ((query: string, item: CommandPaletteCommand) => boolean) | null = null;

/** 菜单选中统一事件（dropdown / context-menu / command-palette 同一契约）。 */
function emitMenuSelect(source: HTMLElement, item: HTMLElement): void {
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

/** 用编程条目重建面板条目 DOM（沿用现有类名/data 契约，纯 textContent 渲染）。 */
function buildCommandItems(panel: HTMLElement, commands: CommandPaletteCommand[]): void {
  const body = panel.querySelector<HTMLElement>('.command-palette-body');
  if (!body) return;
  body.querySelectorAll('.command-palette-group').forEach((g) => g.remove());

  const group = document.createElement('div');
  group.className = 'command-palette-group';
  for (const cmd of commands) group.appendChild(buildCommandItem(cmd));
  const empty = body.querySelector('.command-palette-empty');
  if (empty) body.insertBefore(group, empty);
  else body.appendChild(group);
}

function buildCommandItem(cmd: CommandPaletteCommand): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'command-palette-item';
  const label = document.createElement('span');
  label.className = 'command-palette-item-label';
  label.textContent = cmd.label;
  btn.appendChild(label);
  if (cmd.hint) {
    const hint = document.createElement('span');
    hint.className = 'command-palette-item-hint';
    hint.textContent = cmd.hint;
    btn.appendChild(hint);
  }
  if (cmd.keyword) btn.setAttribute('data-command-palette-keyword', cmd.keyword);
  if (cmd.keepOpen) btn.setAttribute('data-command-palette-keep-open', '');
  if (cmd.attrs) {
    for (const [name, value] of Object.entries(cmd.attrs)) btn.setAttribute(name, value);
  }
  programmaticCommands.set(btn, cmd);
  /* 选中路径统一收敛到 click（鼠标点击与 Enter 的 active.click() 都会到达）：
     先派 icen:menu-select，再执行 onSelect；关闭与否交给 init 的委托逻辑（keepOpen 契约） */
  btn.addEventListener('click', () => {
    emitMenuSelect(btn.closest<HTMLElement>('.command-palette') ?? btn, btn);
    cmd.onSelect?.();
  });
  return btn;
}

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
    const def = programmaticCommands.get(item);
    let match: boolean;
    if (def && customFilter) {
      /* 自定义过滤（仅编程条目）：空 query 仍视为匹配全部，保持「打开即见全量」语义 */
      match = !q || customFilter(query, def);
    } else {
      const label = (item.querySelector('.command-palette-item-label')?.textContent ?? '').toLowerCase();
      const hint = (item.querySelector('.command-palette-item-hint')?.textContent ?? '').toLowerCase();
      const keyword = (item.dataset.commandPaletteKeyword ?? '').toLowerCase();
      match = !q || label.includes(q) || hint.includes(q) || keyword.includes(q);
    }
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

/**
 * 打开指定 id 的命令面板。打开成功后从 document 广播 icen:command-palette-open。
 * opts.items 传入时重建面板条目 DOM（编程条目，onSelect 选中时调用）；
 * opts.filter 覆盖默认 includes 过滤（仅编程条目生效）；幂等不变（同 id 重复打开 no-op）。
 */
export function openCommandPalette(id: string, opts?: CommandPaletteOpenOptions): void {
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

  /* 面板尺寸契约（PanelSizing）：backdrop 上 data-panel-width / data-panel-max-height 覆盖 CSS 默认 */
  applyPanelSizing(panel, readPanelSizing(backdrop));

  /* 编程条目：每次打开重置过滤面（不传 items 则沿用面板现有 DOM） */
  customFilter = opts?.filter ?? null;
  if (opts?.items) buildCommandItems(panel, opts.items);

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
        /* 编程条目在自身 click 监听里派 menu-select + onSelect（active.click() 会触发），
           在此补派会双发；DOM 条目没有该监听，在此派 */
        if (!programmaticCommands.has(active)) emitMenuSelect(panel, active);
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

  emitIcen(document, 'icen:command-palette-open', {});
}

/**
 * 关闭指定 id 的命令面板（backdrop 已被外部移除时也照常复位状态/监听/滚动锁）。
 * 关闭已打开的面板后从 document 广播 icen:command-palette-close；
 * 关闭未被接管打开的面板（幂等空操作路径）不派发。
 */
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
  emitIcen(document, 'icen:command-palette-close', {});
}

/**
 * 初始化：委托监听触发器 / 搜索 / 外点 / 全局快捷键。
 * 返回销毁函数：摘除全部委托监听并复位幂等标记（销毁后可重新 init）；
 * 销毁时若有面板开着会顺带关闭（复位滚动锁/监听/焦点）。
 * 重复调用安全：已初始化时返回既有销毁函数（同一份，共享）。SSR 下返回 no-op。
 */
export function initCommandPalette(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => {};
  if (typeof window === 'undefined') return () => {};
  const scope = root ?? document;

  scope
    .querySelectorAll<HTMLElement>('[data-command-palette-open]')
    .forEach((el) => el.setAttribute('aria-haspopup', 'dialog'));

  if (teardown) return teardown;

  const onClick = (e: MouseEvent): void => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const opener = target.closest<HTMLElement>('[data-command-palette-open]');
    if (opener?.dataset.commandPaletteOpen) {
      openCommandPalette(opener.dataset.commandPaletteOpen);
      return;
    }

    // 点击命令项：DOM 条目在此派 menu-select（编程条目自带监听，跳过防双派）；默认关闭面板（除非 keep-open）
    const item = target.closest<HTMLElement>('.command-palette-item');
    if (item) {
      const backdrop = item.closest<HTMLElement>('[data-command-palette]');
      if (backdrop?.dataset.commandPalette) {
        const panelEl = item.closest<HTMLElement>('.command-palette');
        if (panelEl && !programmaticCommands.has(item)) emitMenuSelect(panelEl, item);
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
  };
  document.addEventListener('click', onClick);

  // 输入过滤（事件委托）
  const onInput = (e: Event): void => {
    if (!(e.target instanceof HTMLElement)) return;
    if (!e.target.matches('.command-palette-input')) return;
    const backdrop = e.target.closest<HTMLElement>('[data-command-palette]');
    const panel = backdrop?.querySelector<HTMLElement>('.command-palette');
    if (panel) filterPanel(panel, (e.target as HTMLInputElement).value);
  };
  document.addEventListener('input', onInput);

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

  teardown = (): void => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('input', onInput);
    if (globalKeyHandler) {
      window.removeEventListener('keydown', globalKeyHandler);
      globalKeyHandler = null;
    }
    if (openId) closeCommandPalette(openId);
    /* 复位幂等标记（teardown 本身即标记），销毁后可重新 init */
    teardown = null;
  };
  return teardown;
}
