/** Reusable global appearance control. SSR markup, DOM renderer and declarative init
 * share one tree; all instances consume theme.ts and never keep private theme state. */
import themes from '../tokens/themes.json';
import { iconAttributes, iconPath, type IconName } from './icons';
import { getCurrentTheme, initTheme, listPrimitives, listThemePresets, setTheme, toggleDark, type ThemeState } from './theme';
import { openPopover, closePopover, readPanelSizing, type PanelSizing } from './popover';
import { t } from './i18n';

export interface ThemeSwitcherOptions {
  /** all = one appearance menu; individual axes can be composed freely. */
  kind?: 'all' | 'theme' | 'primitive' | 'mode';
  display?: 'icon' | 'color' | 'color-name' | 'name' | 'swatch' | 'swatch-name';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  layout?: 'menu' | 'inline';
  /** Override built-in names or name registered custom themes/primitives. Plain text. */
  labels?: Record<string, string>;
  sizing?: PanelSizing;
}
export interface ThemeSwitcherHandle { destroy(): void; }
type Tree = { tag: string; attrs?: Record<string, string>; children?: (Tree | string)[] };
const node = (tag: string, attrs: Record<string, string> = {}, ...children: (Tree | string)[]): Tree => ({ tag, attrs, children });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function serialize(tree: Tree): string {
  return `<${tree.tag}${Object.entries(tree.attrs ?? {}).map(([k,v]) => ` ${k}="${esc(v)}"`).join('')}>${(tree.children ?? []).map((c) => typeof c === 'string' ? esc(c) : serialize(c)).join('')}</${tree.tag}>`;
}
function materialize(tree: Tree): HTMLElement | SVGElement {
  const el = ['svg','path'].includes(tree.tag) ? document.createElementNS('http://www.w3.org/2000/svg',tree.tag) : document.createElement(tree.tag);
  for (const [k,v] of Object.entries(tree.attrs ?? {})) el.setAttribute(k,v);
  for (const child of tree.children ?? []) el.append(typeof child === 'string' ? document.createTextNode(child) : materialize(child));
  return el;
}
function options(o: ThemeSwitcherOptions): Required<Pick<ThemeSwitcherOptions, 'kind' | 'display' | 'size' | 'layout'>> & ThemeSwitcherOptions {
  return { ...o, kind: o.kind ?? 'all', display: o.display ?? 'swatch-name', size: o.size ?? 'md', layout: o.layout ?? 'menu' };
}
function name(id: string, o: ThemeSwitcherOptions): string {
  return o.labels?.[id] ?? (themes.some((theme) => theme.id === id) || id === 'pixel' ? t(`themeSwitcher.${id}` as 'themeSwitcher.benzhen') : id);
}
function axisName(kind: string): string {
  return kind === 'theme' ? t('themeSwitcher.theme') : kind === 'primitive' ? t('themeSwitcher.primitive') : kind === 'mode' ? t('themeSwitcher.mode') : t('themeSwitcher.appearance');
}
function sample(id: string, dark: boolean): Tree {
  const theme = themes.find((theme) => theme.id === id);
  const palette = theme?.[dark ? 'dark' : 'light'];
  return node('span', { class: 'icen-theme-switcher-sample', 'aria-hidden': 'true' },
    ...[palette?.bg ?? 'var(--icen-token-bg)', palette?.accent ?? 'var(--icen-token-accent)', palette?.cold ?? 'var(--icen-token-cold)'].map((color) => node('i', { style: `background:${color}` })));
}
function symbol(name: IconName, className: string): Tree {
  return node('svg',iconAttributes({className}),node('path',{d:iconPath(name)!}));
}
function triggerChildren(o: ThemeSwitcherOptions, state: ThemeState): Tree[] {
  const kind = o.kind ?? 'all';
  const label = kind === 'primitive' ? name(state.style,o) : kind === 'mode' ? t(state.dark ? 'themeSwitcher.dark' : 'themeSwitcher.light') : name(state.preset,o);
  return [
    kind === 'primitive' ? symbol(state.style === 'pixel' ? 'pixel' : 'benzhen','icen-theme-switcher-symbol') : kind === 'mode' ? symbol(state.dark ? 'moon' : 'sun','icen-theme-switcher-symbol') : sample(state.preset,state.dark),
    node('span', { class: 'icen-theme-switcher-name' }, label),
  ];
}
function section(kind: 'theme' | 'primitive' | 'mode', o: ThemeSwitcherOptions, state: ThemeState): Tree {
  const ids = kind === 'theme' ? listThemePresets() : kind === 'primitive' ? listPrimitives() : ['light','dark'];
  const active = kind === 'theme' ? state.preset : kind === 'primitive' ? state.style : state.dark ? 'dark' : 'light';
  return node('section', { class: 'icen-theme-switcher-section' },
    node('p', { class: 'icen-theme-switcher-heading' }, axisName(kind)),
    node('div', { class: `icen-theme-switcher-options icen-theme-switcher-options--${kind}`, role: 'group', 'aria-label': axisName(kind) },
      ...ids.map((id) => node('button', { type: 'button', class: 'icen-theme-switcher-option', 'data-icen-axis': kind, 'data-icen-value': id, 'aria-pressed': String(id === active) },
        ...(kind === 'theme' ? [sample(id,state.dark)] : [symbol(kind === 'primitive' ? id === 'pixel' ? 'pixel' : 'benzhen' : id === 'dark' ? 'moon' : 'sun','icen-theme-switcher-symbol')]),
        node('span', {class:'icen-theme-switcher-option-name'}, kind === 'mode' ? t(id === 'dark' ? 'themeSwitcher.dark' : 'themeSwitcher.light') : name(id,o)),
      )),
    ),
  );
}
function tree(input: ThemeSwitcherOptions, state: ThemeState): Tree {
  const o = options(input);
  const inline = o.layout === 'inline' && o.kind !== 'mode';
  return node('div', { class: `icen-theme-switcher icen-theme-switcher--${o.size}`, 'data-icen-theme-switcher': '', 'data-icen-kind': o.kind, 'data-icen-display': o.display, 'data-icen-size':o.size, 'data-icen-layout': inline ? 'inline' : 'menu', ...(o.labels ? {'data-icen-labels':JSON.stringify(o.labels)} : {}), ...Object.fromEntries(Object.entries(o.sizing ?? {}).map(([key,value]) => [`data-icen-panel-${({minWidth:'min',maxWidth:'max',minHeight:'min-height',maxHeight:'max-height'} as Record<string,string>)[key] ?? key}`,String(value)])) },
    ...(!inline ? [node('button', { class: 'icen-theme-switcher-trigger', type: 'button', 'aria-label': axisName(o.kind), ...(o.kind === 'mode' ? { 'aria-pressed': String(state.dark) } : { 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }) }, ...triggerChildren(o,state))] : []),
    ...(o.kind !== 'mode' ? [node('div', { class: 'icen-theme-switcher-panel', 'data-icen-material': 'floating', ...(!inline ? { hidden: '', role: 'dialog', 'aria-label': axisName(o.kind) } : {}) },
      ...(o.kind === 'all' ? (['mode','theme','primitive'] as const) : [o.kind]).map((axis) => section(axis,o,state)),
    )] : []),
  );
}
/** Framework-free SSR markup; hydrate with initThemeSwitcher(). Escapes all caller labels. */
export function themeSwitcherHTML(o: ThemeSwitcherOptions = {}, state: ThemeState = {preset:'benzhen',dark:false,style:'benzhen'}): string {
  return serialize(tree(o,state));
}

const handles = new WeakMap<HTMLElement, ThemeSwitcherHandle>();
const activeRoots = new Set<HTMLElement>();
let serial = 0;
function bind(root: HTMLElement, o: ThemeSwitcherOptions): ThemeSwitcherHandle {
  const previous = handles.get(root); if (previous) return previous;
  const trigger = root.querySelector<HTMLButtonElement>('.icen-theme-switcher-trigger');
  const panel = root.querySelector<HTMLElement>('.icen-theme-switcher-panel');
  const inline = o.layout === 'inline';
  let opened = false;
  if (panel && trigger) { panel.id ||= `icen-appearance-${++serial}`; trigger.setAttribute('aria-controls', panel.id); }
  const reflect = () => {
    const state = getCurrentTheme();
    if (trigger) {
      trigger.replaceChildren(...triggerChildren(o,state).map(materialize));
      trigger.setAttribute('aria-label', `${axisName(o.kind ?? 'all')}：${o.kind === 'primitive' ? name(state.style,o) : o.kind === 'mode' ? t(state.dark ? 'themeSwitcher.dark' : 'themeSwitcher.light') : name(state.preset,o)}`);
      if (o.kind === 'mode') trigger.setAttribute('aria-pressed',String(state.dark));
    }
    panel?.querySelectorAll<HTMLButtonElement>('[data-icen-axis]').forEach((button) => {
      const axis = button.dataset.icenAxis;
      const value = button.dataset.icenValue!;
      const text = button.querySelector('.icen-theme-switcher-option-name');
      if (text) text.textContent = axis === 'mode' ? t(value === 'dark' ? 'themeSwitcher.dark' : 'themeSwitcher.light') : name(value,o);
      button.setAttribute('aria-pressed',String(value === (axis === 'theme' ? state.preset : axis === 'primitive' ? state.style : state.dark ? 'dark' : 'light')));
      if (axis === 'theme') button.querySelector('.icen-theme-switcher-sample')?.replaceWith(materialize(sample(value,state.dark)));
    });
    panel?.querySelectorAll<HTMLElement>('.icen-theme-switcher-section').forEach((section) => {
      const group = section.querySelector<HTMLElement>('[role="group"]');
      const axis = group?.querySelector<HTMLElement>('[data-icen-axis]')?.dataset.icenAxis;
      if (!axis) return;
      const heading = section.querySelector('.icen-theme-switcher-heading');
      if (heading) heading.textContent = axisName(axis);
      group?.setAttribute('aria-label',axisName(axis));
    });
    if (panel && !inline) panel.setAttribute('aria-label',axisName(o.kind ?? 'all'));
  };
  const close = () => { if (panel && opened) closePopover(panel); };
  const open = () => {
    if (!panel || !trigger) return;
    if (opened) { close(); return; }
    opened = true; trigger.setAttribute('aria-expanded','true');
    openPopover(panel, { anchor: trigger, align: 'end', minWidth: 260, maxWidth: 320, maxHeight: 560, contentHeightHint: o.kind === 'all' ? 480 : panel.scrollHeight, sizing: o.sizing, onClose: () => { opened = false; trigger.setAttribute('aria-expanded','false'); } });
    (panel.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? panel.querySelector<HTMLButtonElement>('button'))?.focus();
  };
  const triggerClick = () => { if (o.kind === 'mode') toggleDark(); else open(); };
  const choose = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-icen-axis]');
    if (!button || !panel?.contains(button)) return;
    const axis = button.dataset.icenAxis, value = button.dataset.icenValue!;
    setTheme(axis === 'theme' ? {preset:value} : axis === 'primitive' ? {style:value} : {dark:value === 'dark'});
    if (!inline && o.kind !== 'all') { close(); trigger?.focus(); }
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopPropagation(); close(); trigger?.focus(); return; }
    if (event.target === trigger && ['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); if (!opened) open(); return; }
    if (!panel?.contains(event.target as Node)) return;
    const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (opened && event.key === 'Tab' && ((event.shiftKey && index === 0) || (!event.shiftKey && index === buttons.length-1))) {
      event.preventDefault(); buttons[event.shiftKey ? buttons.length-1 : 0]?.focus(); return;
    }
    const rtl = getComputedStyle(root).direction === 'rtl';
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'ArrowRight' ? (rtl ? -1 : 1) : event.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0;
    if (delta || event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index+delta+buttons.length)%buttons.length]?.focus();
    }
  };
  /* 焦点转出即关。 Chromium 指针改焦期间 document.activeElement 短暂落在 body，
     必须以 relatedTarget（焦点的去处）判断；为 null 时才退到 microtask 复查。 */
  const focusout = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (panel?.contains(next) || next === trigger)) return;
    queueMicrotask(() => { if (opened && !panel?.contains(document.activeElement) && document.activeElement !== trigger) close(); });
  };
  trigger?.addEventListener('click',triggerClick);
  trigger?.addEventListener('keydown',keydown);
  panel?.addEventListener('click',choose);
  panel?.addEventListener('keydown',keydown);
  panel?.addEventListener('focusout',focusout);
  document.addEventListener('icen:theme-change',reflect);
  document.addEventListener('icen:locale-change',reflect);
  // Root attributes are also observed: manual host writes and ClientRouter swaps stay in sync.
  const observer = new MutationObserver(reflect);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-icen-preset','data-icen-theme','data-icen-style']});
  reflect();
  const handle = { destroy() {
    close(); observer.disconnect();
    trigger?.removeEventListener('click',triggerClick); trigger?.removeEventListener('keydown',keydown);
    panel?.removeEventListener('click',choose); panel?.removeEventListener('keydown',keydown); panel?.removeEventListener('focusout',focusout);
    document.removeEventListener('icen:theme-change',reflect); document.removeEventListener('icen:locale-change',reflect);
    /* 只清理 portal 到 root 之外的面板；inline 面板是 root 的子节点，随 root 回收——
       路由缓存（ClientRouter 换页暂存 DOM）复用旧节点时不能把面板摘掉。 */
    if (!root.isConnected && panel && !root.contains(panel)) panel.remove();
    handles.delete(root); activeRoots.delete(root);
  } };
  handles.set(root,handle); activeRoots.add(root); return handle;
}
/** Mount a complete control without hand-writing markup. Repeated calls replace and dispose safely. */
export function createThemeSwitcher(el: HTMLElement, o: ThemeSwitcherOptions = {}): ThemeSwitcherHandle {
  if (typeof document === 'undefined') return {destroy() {}};
  el.querySelectorAll<HTMLElement>('[data-icen-theme-switcher]').forEach((root) => handles.get(root)?.destroy());
  if (!document.documentElement.hasAttribute('data-icen-style')) initTheme();
  const root = materialize(tree(o,getCurrentTheme())) as HTMLElement; el.replaceChildren(root);
  const handle = bind(root,options(o));
  return { destroy() { handle.destroy(); root.remove(); } };
}
/** Hydrate SSR controls or empty declarative mounts; repeated calls are idempotent. */
export function initThemeSwitcher(scope?: ParentNode): void {
  if (typeof document === 'undefined') return;
  for (const root of activeRoots) if (!root.isConnected) handles.get(root)?.destroy();
  if (!document.documentElement.hasAttribute('data-icen-style')) initTheme();
  const parent = scope ?? document;
  const roots = [...(parent instanceof HTMLElement && parent.matches('[data-icen-theme-switcher]') ? [parent] : []), ...parent.querySelectorAll<HTMLElement>('[data-icen-theme-switcher]')];
  for (const root of roots) {
    if (handles.has(root)) continue;
    let labels: Record<string,string> | undefined;
    try { const parsed = JSON.parse(root.dataset.icenLabels ?? '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) labels = Object.fromEntries(Object.entries(parsed).filter(([,v]) => typeof v === 'string')) as Record<string,string>; } catch { /* Invalid optional labels use catalogue names. */ }
    const o = options({kind:root.dataset.icenKind as ThemeSwitcherOptions['kind'],display:root.dataset.icenDisplay as ThemeSwitcherOptions['display'],size:root.dataset.icenSize as ThemeSwitcherOptions['size'],layout:root.dataset.icenLayout as ThemeSwitcherOptions['layout'],labels,sizing:readPanelSizing(root)});
    if (!root.firstElementChild) { root.removeAttribute('data-icen-theme-switcher'); createThemeSwitcher(root,o); continue; }
    bind(root,o);
  }
}
