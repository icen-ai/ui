export type IcenSlotContent = string | Node | null | undefined | false;

export interface IcenSlotResult {
  node: Node;
  destroy?: () => void;
}

export type IcenSlotRenderer<T> = (context: T) => IcenSlotContent | IcenSlotResult;
export type IcenSlot<T = void> = IcenSlotContent | IcenSlotResult | IcenSlotRenderer<T>;

interface SlotRecord {
  nodes: Node[];
  destroy?: () => void;
}

const records = new WeakMap<HTMLElement, SlotRecord>();

function isNode(value: unknown): value is Node {
  return typeof Node !== 'undefined' && value instanceof Node;
}

function isSlotResult(value: unknown): value is IcenSlotResult {
  return !!value && typeof value === 'object' && 'node' in value && isNode((value as IcenSlotResult).node);
}

function dispose(host: HTMLElement, record: SlotRecord): void {
  if (records.get(host) !== record) return;
  records.delete(host);
  for (const node of record.nodes) if (node.parentNode === host) host.removeChild(node);
  record.destroy?.();
}

/**
 * Mount optional content into a dedicated slot without parsing HTML or changing
 * host classes. Reusing the same node preserves its focus and internal state.
 * The returned disposer only affects that rendering generation.
 */
export function mountIcenSlot<T = void>(host: HTMLElement, slot: IcenSlot<T>, context?: T): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const rendered = typeof slot === 'function' ? (slot as IcenSlotRenderer<T>)(context as T) : slot;
  const result = isSlotResult(rendered) ? rendered : null;
  const node = result ? result.node : typeof rendered === 'string' ? document.createTextNode(rendered) : isNode(rendered) ? rendered : null;
  const previous = records.get(host);

  if (previous && previous.nodes.length === (node ? 1 : 0) && (!node || (previous.nodes[0] === node && node.parentNode === host))) {
    if (previous.destroy !== result?.destroy) {
      previous.destroy?.();
      previous.destroy = result?.destroy;
    }
    return () => dispose(host, previous);
  }

  if (previous) dispose(host, previous);
  else host.textContent = '';

  const record: SlotRecord = { nodes: node ? [node] : [], destroy: result?.destroy };
  if (node) host.appendChild(node);
  records.set(host, record);
  return () => dispose(host, record);
}

export function clearIcenSlot(host: HTMLElement): void {
  const record = records.get(host);
  if (record) dispose(host, record);
}
