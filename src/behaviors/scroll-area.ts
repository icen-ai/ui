/** Native scrolling with delegated activity tracking; no replacement tracks or wheel interception. */
export interface ScrollAreaOptions {
  /** Delegation scope. Defaults to document; includes future descendants. */
  root?: Document | HTMLElement;
  /** Idle delay in milliseconds. Local data-icen-scrollbar-delay wins; CSS token is the fallback. */
  idleDelay?: number;
}

const mounted = new WeakSet<Document | HTMLElement>();
const noop = (): void => {};
const isDocument = (node: EventTarget | null): node is Document => (node as Node | null)?.nodeType === 9;

/**
 * Enables idle hiding for every native scroller in a scope, including portalled
 * panels when mounted on document. Idempotent, SSR-safe, returns cleanup.
 * CSS-only use keeps scrollbars visible; enabled scopes default to scroll mode.
 * Local data-icen-scrollbars selects
 * auto (scroll/hover/focus), scroll (scroll/focus), visible, or hidden.
 */
export function initScrollArea(options: ScrollAreaOptions = {}): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return noop;
  const root = options.root ?? document;
  if (mounted.has(root)) return noop;
  mounted.add(root);
  const host = isDocument(root) ? root.documentElement : root;
  const previous = host.getAttribute('data-icen-scrollbars-ready');
  host.setAttribute('data-icen-scrollbars-ready', '');
  const pending = new Map<HTMLElement, { timer: ReturnType<typeof setTimeout>; previous: string | null }>();
  const restore = (el: HTMLElement, value: string | null): void => {
    if (value === null) el.removeAttribute('data-icen-scroll-active');
    else el.setAttribute('data-icen-scroll-active', value);
  };
  const onScroll = (event: Event): void => {
    const el = isDocument(event.target) ? event.target.documentElement : event.target;
    if (!(el instanceof HTMLElement)) return;
    // An explicitly mounted inner scope owns its timers and configuration.
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      if (!mounted.has(node)) continue;
      if (node !== root) return;
      break;
    }
    const old = pending.get(el);
    if (old) clearTimeout(old.timer);
    const before = old ? old.previous : el.getAttribute('data-icen-scroll-active');
    el.setAttribute('data-icen-scroll-active', '');
    const local = el.closest<HTMLElement>('[data-icen-scrollbar-delay]')?.dataset.icenScrollbarDelay;
    const token = getComputedStyle(el).getPropertyValue('--icen-token-scrollbar-idle-delay').trim();
    const parsed = local !== undefined ? Number(local) : options.idleDelay ?? (token ? Number.parseFloat(token) * (token.endsWith('ms') ? 1 : token.endsWith('s') ? 1000 : 1) : 900);
    const delay = Number.isFinite(parsed) ? Math.max(0, Math.min(60000, parsed)) : 900;
    const timer = setTimeout(() => { restore(el, before); pending.delete(el); }, delay);
    pending.set(el, { timer, previous: before });
  };
  root.addEventListener('scroll', onScroll, { capture: true, passive: true });
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    root.removeEventListener('scroll', onScroll, true);
    for (const [el, state] of pending) { clearTimeout(state.timer); restore(el, state.previous); }
    pending.clear();
    if (previous === null) host.removeAttribute('data-icen-scrollbars-ready');
    else host.setAttribute('data-icen-scrollbars-ready', previous);
    mounted.delete(root);
  };
}
