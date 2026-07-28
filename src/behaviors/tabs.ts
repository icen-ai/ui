/*
 * @icen.ai/ui — Behavior: tabs（分区切换，与 components/tabs.css 配套，data 属性驱动）
 *
 * DOM 契约：
 *   <div data-tabs data-tabs-hash>
 *     <nav class="page-tabs">
 *       <button class="page-tab" data-tab="overview">总览</button>
 *     </nav>
 *     <section data-tab-panel="overview">…</section>
 *     <section data-tab-panel="billing" hidden>…</section>
 *   </div>
 *
 * 激活 = .active 类 + 各 panel hidden 切换；data-tabs-hash 容器与 location.hash 同步
 * （history.replaceState 写，不堆历史；hashchange 时跟随）。同一容器重复 init 幂等。
 */

interface MarkedElement extends Element {
  __icenTabsInit?: boolean;
}

function tabNames(container: Element): string[] {
  return Array.from(container.querySelectorAll('[data-tab]'))
    .map((t) => t.getAttribute('data-tab'))
    .filter((n): n is string => n !== null);
}

function currentHash(): string {
  return window.location.hash.replace(/^#/, '');
}

function activate(container: Element, name: string, writeHash: boolean): void {
  let matched = false;
  container.querySelectorAll('[data-tab]').forEach((t) => {
    const on = t.getAttribute('data-tab') === name;
    if (on) matched = true;
    t.classList.toggle('active', on);
  });
  if (!matched) return; // 非法 tab 名：不动现状
  container.querySelectorAll<HTMLElement>('[data-tab-panel]').forEach((p) => {
    p.hidden = p.getAttribute('data-tab-panel') !== name;
  });
  if (writeHash && typeof window !== 'undefined') {
    window.history.replaceState(null, '', `#${name}`);
  }
}

function setup(container: Element): void {
  const el = container as MarkedElement;
  if (el.__icenTabsInit) return;
  el.__icenTabsInit = true;

  const useHash = container.hasAttribute('data-tabs-hash');
  const names = tabNames(container);
  if (names.length === 0) return;

  container.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('[data-tab]');
    // 嵌套 [data-tabs] 时只处理直接属于本容器的 tab
    if (!btn || btn.closest('[data-tabs]') !== container) return;
    const name = btn.getAttribute('data-tab');
    if (name) activate(container, name, useHash);
  });

  // 初始定位：hash 容器按 hash（非法/空 → 第一个 tab）；
  // 普通容器尊重已有的 .active，否则第一个 tab。初始化不写 hash。
  let initial: string | undefined;
  if (useHash) {
    const h = currentHash();
    if (names.includes(h)) initial = h;
  } else {
    const n = container.querySelector('[data-tab].active')?.getAttribute('data-tab');
    if (n && names.includes(n)) initial = n;
  }
  activate(container, initial ?? names[0], false);

  if (useHash && typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
      const h = currentHash();
      if (names.includes(h)) activate(container, h, false);
    });
  }
}

/** 为 root 下每个 [data-tabs] 容器初始化（root 自身是 [data-tabs] 也算）。 */
export function initTabs(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const containers: Element[] = [];
  if (root instanceof Element && root.matches('[data-tabs]')) containers.push(root);
  containers.push(...Array.from(root.querySelectorAll('[data-tabs]')));
  for (const c of containers) setup(c);
}
