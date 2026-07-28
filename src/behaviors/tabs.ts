/*
 * @icen.ai/ui — Behavior: tabs（分区切换，与 components/tabs.css 配套，data 属性驱动）
 *
 * DOM 契约：
 *   <div data-tabs data-tabs-hash>
 *     <nav class="page-tabs" role="tablist">
 *       <button class="page-tab" role="tab" id="tab-overview" aria-controls="panel-overview"
 *               data-tab="overview" tabindex="0">总览</button>
 *       <button class="page-tab" role="tab" data-tab="billing" tabindex="-1">订阅</button>
 *     </nav>
 *     <section data-tab-panel="overview" role="tabpanel" aria-labelledby="tab-overview">…</section>
 *     <section data-tab-panel="billing" hidden>…</section>
 *   </div>
 *
 * 行为：
 *   - 点击 / ←/→/Home/End 切换 tab；roving tabindex（仅 active tab tabindex=0）
 *   - 激活 = .active 类 + aria-selected=true + 各 panel hidden 切换 + aria-labelledby 同步
 *   - data-tabs-hash 容器与 location.hash 同步（history.replaceState 写，不堆历史；hashchange 跟随）
 *   - 同一容器重复 init 幂等；不可达 tab（disabled / aria-disabled）会被跳过
 */

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

function activate(container: Element, name: string, writeHash: boolean): void {
  const buttons = tabButtons(container);
  let matched = false;

  buttons.forEach((t) => {
    const on = t.getAttribute('data-tab') === name;
    if (on) matched = true;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  if (!matched) return;

  container.querySelectorAll<HTMLElement>('[data-tab-panel]').forEach((p) => {
    const isOn = p.getAttribute('data-tab-panel') === name;
    p.hidden = !isOn;
    if (isOn && !p.getAttribute('aria-labelledby')) {
      const btn = buttons.find((b) => b.getAttribute('data-tab') === name);
      if (btn?.id) p.setAttribute('aria-labelledby', btn.id);
    }
  });

  if (writeHash && typeof window !== 'undefined') {
    window.history.replaceState(null, '', `#${name}`);
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

function setup(container: Element): void {
  const el = container as MarkedElement;
  if (el.__icenTabsInit) return;
  el.__icenTabsInit = true;

  const useHash = container.hasAttribute('data-tabs-hash');
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

  const onClick = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('[data-tab]');
    if (!btn || btn.closest('[data-tabs]') !== container) return;
    if (btn instanceof HTMLElement && isDisabled(btn)) return;
    const name = btn.getAttribute('data-tab');
    if (name) activate(container, name, useHash);
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
        const next = nextEnabled(container, currentIdx, 1);
        if (next >= 0) focusTab(container, next);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        kev.preventDefault();
        const prev = nextEnabled(container, currentIdx, -1);
        if (prev >= 0) focusTab(container, prev);
        break;
      }
      case 'Home': {
        kev.preventDefault();
        focusTab(container, 0);
        break;
      }
      case 'End': {
        kev.preventDefault();
        focusTab(container, buttonsList.length - 1);
        break;
      }
      case 'Enter':
      case ' ': {
        if (btn instanceof HTMLElement && !isDisabled(btn)) {
          kev.preventDefault();
          const name = btn.getAttribute('data-tab');
          if (name) activate(container, name, useHash);
        }
        break;
      }
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('keydown', onKeyDown);

  /* 初始定位：hash 容器按 hash（非法/空 → 第一个 tab）；
     普通容器尊重已有的 .active，否则第一个 tab。初始化不写 hash。 */
  let initial: string | undefined;
  if (useHash) {
    const h = currentHash();
    if (names.includes(h)) initial = h;
  } else {
    const n = container.querySelector('[data-tab].active')?.getAttribute('data-tab');
    if (n && names.includes(n)) initial = n;
  }
  activate(container, initial ?? names[0], false);

  /* hashchange 跟随；卸载时移除 */
  const onHash = (): void => {
    const h = currentHash();
    if (names.includes(h)) activate(container, h, false);
  };
  if (useHash && typeof window !== 'undefined') {
    window.addEventListener('hashchange', onHash);
  }

  el.__icenTabsCleanup = (): void => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('hashchange', onHash);
  };
}

/** 为 root 下每个 [data-tabs] 容器初始化（root 自身是 [data-tabs] 也算）。 */
export function initTabs(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const containers: Element[] = [];
  if (root instanceof Element && root.matches('[data-tabs]')) containers.push(root);
  containers.push(...Array.from(root.querySelectorAll('[data-tabs]')));
  for (const c of containers) setup(c);
}
