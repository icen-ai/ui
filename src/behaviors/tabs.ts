/*
 * @icen.ai/ui — Behavior: tabs（分区切换，与 components/tabs.css 配套，data 属性驱动）
 *
 * DOM 契约：
 *   <div data-tabs data-tabs-hash data-tabs-activation="manual">
 *     <nav class="tabs" role="tablist" data-tabs-ink>
 *       <button class="page-tab" role="tab" id="tab-overview" aria-controls="panel-overview"
 *               data-tab="overview" tabindex="0">总览</button>
 *       <button class="page-tab" role="tab" data-tab="billing" tabindex="-1">订阅</button>
 *     </nav>
 *     <section data-tab-panel="overview" role="tabpanel" aria-labelledby="tab-overview">…</section>
 *     <section data-tab-panel="billing" hidden>…</section>
 *   </div>
 *
 * 行为：
 *   - 点击 / Enter / Space 激活 tab；激活 = .is-active 类 + aria-selected=true +
 *     各 panel hidden 切换 + aria-labelledby 同步，并派发 icen:tab-change
 *     （detail { tab, panel, index }，bubbles）
 *   - 激活模式 data-tabs-activation="auto|manual"（默认 manual，现状）：
 *     manual = ←/→/↑/↓/Home/End 只移动焦点不激活；auto = follow focus，方向键移动焦点即激活
 *   - 指示条：tablist（.tabs）挂 data-tabs-ink 时，行为层创建并移动 .tabs-ink 绝对定位条
 *     （宽 / translateX 内联定位属布局而非主题样式，同 popover 定位模式；
 *     高度 / 圆角 / 背景等视觉在 tabs.css 的 .tabs-ink 一节，transition 消费 --duration/--ease token；
 *     窗口 resize 后自动重对齐；销毁时随监听一并回收）
 *   - data-tabs-hash 容器与 location.hash 同步（history.replaceState 写，不堆历史；
 *     hashchange 跟随）；值 "push" 时改用 pushState（可回退），"false" 或未设 = 不启用
 *   - 同一容器重复 init 幂等；不可达 tab（disabled / aria-disabled）会被跳过
 *   - initTabs 返回销毁函数：移除容器监听、window hashchange/resize 与行为层创建的
 *     .tabs-ink（可重新 init）
 */

import { emitIcen } from './events';

interface MarkedElement extends Element {
  __icenTabsInit?: boolean;
  __icenTabsCleanup?: () => void;
}

function tabButtons(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-tab]'));
}

function tabNames(container: Element): string[] {
  return tabButtons(container)
    .map((t) => t.getAttribute('data-tab'))
    .filter((n): n is string => n !== null);
}

function currentHash(): string {
  return window.location.hash.replace(/^#/, '');
}

/**
 * data-tabs-hash 解析：未设或 "false" → 不启用（null）；
 * "push" → pushState（可回退）；其余任意值（含空串，现状用法）→ replaceState。
 */
function hashWriteMethod(container: Element): 'push' | 'replace' | null {
  const raw = container.getAttribute('data-tabs-hash');
  if (raw === null || raw === 'false') return null;
  return raw === 'push' ? 'push' : 'replace';
}

/**
 * 指示条对齐：把 tablist 内的 .tabs-ink 移到活动 tab 下方。
 * 定位（宽 / translateX）内联写入——布局定位而非主题样式，同 popover 模式。
 */
function syncInk(container: Element, name: string): void {
  const btn = tabButtons(container).find((b) => b.getAttribute('data-tab') === name);
  const tablist = btn?.parentElement;
  if (!btn || !tablist) return;
  const ink = tablist.querySelector<HTMLElement>(':scope > .tabs-ink');
  if (!ink) return;
  ink.style.width = `${btn.offsetWidth}px`;
  ink.style.transform = `translateX(${btn.offsetLeft}px)`;
}

function activate(container: Element, name: string, writeHash: boolean, emit = false): void {
  const buttons = tabButtons(container);
  let matched = false;

  buttons.forEach((t) => {
    const on = t.getAttribute('data-tab') === name;
    if (on) matched = true;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  if (!matched) return;

  let panel: HTMLElement | null = null;
  container.querySelectorAll<HTMLElement>('[data-tab-panel]').forEach((p) => {
    const isOn = p.getAttribute('data-tab-panel') === name;
    p.hidden = !isOn;
    if (isOn) {
      panel = p;
      if (!p.getAttribute('aria-labelledby')) {
        const btn = buttons.find((b) => b.getAttribute('data-tab') === name);
        if (btn?.id) p.setAttribute('aria-labelledby', btn.id);
      }
    }
  });

  if (writeHash && typeof window !== 'undefined') {
    const method = hashWriteMethod(container);
    if (method) window.history[method === 'push' ? 'pushState' : 'replaceState'](null, '', `#${name}`);
  }

  /* 指示条跟随活动 tab（存在时） */
  syncInk(container, name);

  /* 用户激活（点击/键盘/hash 跟随）才派发；初始化定位不派发 */
  if (emit) {
    const index = buttons.findIndex((b) => b.getAttribute('data-tab') === name);
    const tab = buttons[index] ?? null;
    emitIcen(container, 'icen:tab-change', { tab, panel, index });
  }
}

function isDisabled(btn: HTMLElement): boolean {
  return (
    btn.hasAttribute('disabled') ||
    btn.getAttribute('aria-disabled') === 'true' ||
    btn.classList.contains('is-disabled')
  );
}

function focusTab(container: Element, idx: number): void {
  const buttons = tabButtons(container);
  const target = buttons[idx];
  if (!target || isDisabled(target)) return;
  target.focus();
}

function nextEnabled(container: Element, from: number, dir: 1 | -1): number {
  const buttons = tabButtons(container);
  if (buttons.length === 0) return -1;
  let idx = from;
  for (let i = 0; i < buttons.length; i++) {
    idx = (idx + dir + buttons.length) % buttons.length;
    if (!isDisabled(buttons[idx])) return idx;
  }
  return -1;
}

function setup(container: Element): (() => void) | undefined {
  const el = container as MarkedElement;
  if (el.__icenTabsInit) return undefined;
  el.__icenTabsInit = true;

  const useHash = hashWriteMethod(container) !== null;
  /* 激活模式：默认 manual（方向键只移焦点）；auto = follow focus（移焦点即激活） */
  const autoActivate = container.getAttribute('data-tabs-activation') === 'auto';
  const names = tabNames(container);
  if (names.length === 0) return;

  /* 角色与 aria 默认值补齐 */
  const buttons = tabButtons(container);
  buttons.forEach((b) => {
    if (!b.getAttribute('role')) b.setAttribute('role', 'tab');
    if (!b.hasAttribute('aria-selected')) b.setAttribute('aria-selected', 'false');
  });
  const tablist = buttons[0]?.parentElement;
  if (tablist && !tablist.getAttribute('role')) tablist.setAttribute('role', 'tablist');

  /* 指示条：.tabs[data-tabs-ink] 时行为层创建 .tabs-ink（视觉规则在 tabs.css）。
     初次定位先写内联再插入，避免首帧从 0 宽度过渡跳变。 */
  let ink: HTMLElement | null = null;
  if (tablist instanceof HTMLElement && tablist.hasAttribute('data-tabs-ink')) {
    ink = document.createElement('div');
    ink.className = 'tabs-ink';
    ink.setAttribute('aria-hidden', 'true');
    const initialBtn =
      buttons.find((b) => b.classList.contains('is-active')) ??
      buttons.find((b) => b.getAttribute('data-tab') === names[0]);
    if (initialBtn) {
      ink.style.width = `${initialBtn.offsetWidth}px`;
      ink.style.transform = `translateX(${initialBtn.offsetLeft}px)`;
    }
    tablist.appendChild(ink);
  }

  const onClick = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('[data-tab]');
    if (!btn || btn.closest('[data-tabs]') !== container) return;
    if (btn instanceof HTMLElement && isDisabled(btn)) return;
    const name = btn.getAttribute('data-tab');
    if (name) activate(container, name, useHash, true);
  };

  /** 方向键/Home/End 移动焦点；auto 模式下焦点到哪激活到哪（follow focus）。 */
  const followFocus = (idx: number): void => {
    focusTab(container, idx);
    if (!autoActivate) return;
    const target = tabButtons(container)[idx];
    if (!target || isDisabled(target)) return;
    const name = target.getAttribute('data-tab');
    if (name) activate(container, name, useHash, true);
  };

  const onKeyDown = (ev: Event): void => {
    const kev = ev as KeyboardEvent;
    const target = kev.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('[data-tab]');
    if (!btn || btn.closest('[data-tabs]') !== container) return;

    const buttonsList = tabButtons(container);
    const currentIdx = buttonsList.indexOf(btn as HTMLElement);
    if (currentIdx === -1) return;

    switch (kev.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        kev.preventDefault();
        followFocus(nextEnabled(container, currentIdx, 1));
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        kev.preventDefault();
        followFocus(nextEnabled(container, currentIdx, -1));
        break;
      }
      case 'Home': {
        kev.preventDefault();
        /* 跳过 disabled：从「-1 的下一个」开始找首个可用 tab */
        followFocus(nextEnabled(container, -1, 1));
        break;
      }
      case 'End': {
        kev.preventDefault();
        followFocus(nextEnabled(container, buttonsList.length, -1));
        break;
      }
      case 'Enter':
      case ' ': {
        if (btn instanceof HTMLElement && !isDisabled(btn)) {
          kev.preventDefault();
          const name = btn.getAttribute('data-tab');
          if (name) activate(container, name, useHash, true);
        }
        break;
      }
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('keydown', onKeyDown);

  /* 初始定位：hash 容器按 hash（非法/空 → 第一个 tab）；
     普通容器尊重已有的 .is-active，否则第一个 tab。初始化不写 hash、不派发事件。 */
  let initial: string | undefined;
  if (useHash) {
    const h = currentHash();
    if (names.includes(h)) initial = h;
  } else {
    const n = container.querySelector('[data-tab].is-active')?.getAttribute('data-tab');
    if (n && names.includes(n)) initial = n;
  }
  activate(container, initial ?? names[0], false);

  /* hashchange 跟随；卸载时移除 */
  const onHash = (): void => {
    const h = currentHash();
    if (names.includes(h)) activate(container, h, false, true);
  };
  if (useHash && typeof window !== 'undefined') {
    window.addEventListener('hashchange', onHash);
  }

  /* 指示条随窗口 resize 重对齐（tab 换行 / 字号变化后宽度漂移） */
  const onResize = (): void => {
    const active = tabButtons(container).find((b) => b.classList.contains('is-active'));
    const name = active?.getAttribute('data-tab');
    if (name) syncInk(container, name);
  };
  if (ink && typeof window !== 'undefined') {
    window.addEventListener('resize', onResize, { passive: true });
  }

  const cleanup = (): void => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('hashchange', onHash);
    if (ink) {
      window.removeEventListener('resize', onResize);
      ink.remove(); /* 行为层创建的元素随销毁回收 */
      ink = null;
    }
    /* 复位幂等标记，销毁后可重新 init */
    el.__icenTabsInit = false;
  };
  el.__icenTabsCleanup = cleanup;
  return cleanup;
}

/**
 * 为 root 下每个 [data-tabs] 容器初始化（root 自身是 [data-tabs] 也算）。
 * 返回销毁函数：调用后移除所有容器监听、window hashchange/resize 监听与行为层创建的
 * .tabs-ink 元素，并复位幂等标记（销毁后的容器可被再次 initTabs 重新接管）。
 * SSR 下返回 no-op 函数。
 */
export function initTabs(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (typeof document !== 'undefined') {
    const scope = root ?? document;
    const containers: Element[] = [];
    if (scope instanceof Element && scope.matches('[data-tabs]')) containers.push(scope);
    containers.push(...Array.from(scope.querySelectorAll('[data-tabs]')));
    for (const c of containers) {
      const cleanup = setup(c);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
