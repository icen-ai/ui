export type IcenOperationStatus = 'pending' | 'running' | 'streaming' | 'approval' | 'done' | 'error' | 'cancelled';

export interface IcenOperationSnapshot<T extends object, R> {
  id: string;
  status: IcenOperationStatus;
  value: T | undefined;
  result: R | undefined;
  error: unknown;
  settled: boolean;
  signal: AbortSignal;
}

export interface IcenOperation<T extends object, R = unknown> {
  readonly id: string;
  readonly status: IcenOperationStatus;
  readonly value: T | undefined;
  readonly result: R | undefined;
  readonly error: unknown;
  readonly settled: boolean;
  readonly signal: AbortSignal;
  snapshot(): IcenOperationSnapshot<T, R>;
  update(patch: Partial<T>): boolean;
  transition(status: 'running' | 'streaming' | 'approval'): boolean;
  succeed(result?: R): boolean;
  fail(error: unknown): boolean;
  cancel(): boolean;
  onChange(listener: (snapshot: IcenOperationSnapshot<T, R>) => void): () => void;
  destroy(): void;
}

export interface IcenOperationOptions<T extends object> {
  id?: string;
  value?: T;
  status?: IcenOperationStatus;
}

const transitions: Record<IcenOperationStatus, ReadonlySet<IcenOperationStatus>> = {
  pending: new Set(['running', 'streaming', 'approval']),
  running: new Set(['running', 'streaming', 'approval']),
  streaming: new Set(['running', 'streaming', 'approval']),
  approval: new Set(['running', 'streaming', 'approval']),
  done: new Set(),
  error: new Set(),
  cancelled: new Set(),
};

let sequence = 0;

/** One cancellable lifecycle for requests, streaming, approvals and late-result guards. */
export function createOperation<T extends object, R = unknown>(options: IcenOperationOptions<T> = {}): IcenOperation<T, R> {
  const id = options.id?.trim() || `operation-${++sequence}`;
  const controller = new AbortController();
  const listeners = new Set<(snapshot: IcenOperationSnapshot<T, R>) => void>();
  let status: IcenOperationStatus = options.status ?? 'pending';
  let value = options.value ? { ...options.value } as T : undefined;
  let result: R | undefined;
  let error: unknown;
  let settled = status === 'done' || status === 'error' || status === 'cancelled';
  let destroyed = false;

  const snapshot = (): IcenOperationSnapshot<T, R> => Object.freeze({
    id, status, value, result, error, settled, signal: controller.signal,
  });
  const notify = (): void => {
    const current = snapshot();
    for (const listener of [...listeners]) listener(current);
  };
  const finish = (next: 'done' | 'error' | 'cancelled', outcome?: R | unknown): boolean => {
    if (settled || destroyed) return false;
    settled = true;
    status = next;
    if (next === 'done') result = outcome as R;
    if (next === 'error') error = outcome;
    if (next === 'cancelled') controller.abort();
    notify();
    return true;
  };

  return {
    get id() { return id; },
    get status() { return status; },
    get value() { return value; },
    get result() { return result; },
    get error() { return error; },
    get settled() { return settled; },
    get signal() { return controller.signal; },
    snapshot,
    update(patch) {
      if (settled || destroyed) return false;
      value = { ...value, ...patch } as T;
      notify();
      return true;
    },
    transition(next) {
      if (settled || destroyed || next === status || !transitions[status].has(next)) return false;
      status = next;
      notify();
      return true;
    },
    succeed(outcome) { return finish('done', outcome); },
    fail(outcome) { return finish('error', outcome); },
    cancel() { return finish('cancelled'); },
    onChange(listener) {
      if (destroyed) return () => undefined;
      listeners.add(listener);
      listener(snapshot());
      return () => { listeners.delete(listener); };
    },
    destroy() {
      if (destroyed) return;
      finish('cancelled');
      destroyed = true;
      listeners.clear();
    },
  };
}
