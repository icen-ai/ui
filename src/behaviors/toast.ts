/*
 * @icen.ai/ui — Behavior: toast（轻提示，与 components/toast.css 配套）
 *
 * 容器固定在右下角（.toast-container，body 末尾唯一，自动 aria-live=polite）；
 * info 不挂语义类，ok/err/warn 分别挂同名类（CSS 三条语义色规则）。
 * 文本一律 textContent 赋值，禁 innerHTML。SSR 下为 no-op。
 *
 * 完整 API：
 *   toast('已保存')                          默认 info
 *   toast.ok('已保存')                       success
 *   toast.err('提交失败')                    error
 *   toast.warn('额度告警')                   warning
 *   toast.action('已删除', '撤销', () => …)  带 action 按钮，6s 后自动消失
 *   toast.dismiss()                          清空所有
 *
 * 同屏最多 5 条（默认），超出移除最早的；可通过 toast.config({ maxStack }) 调整。
 */

export type ToastKind = 'ok' | 'err' | 'warn' | 'info';

export interface ToastOptions {
  /** 保留时长（毫秒），默认 2600；带 action 时默认 6000 */
  ms?: number;
  /** 配合 action：可撤销 / 重试 / 查看等 */
  actionLabel?: string;
  /** action 触发回调；返回 false 阻止 toast 关闭 */
  onAction?: () => void | Promise<void> | boolean;
}

export interface ToastConfig {
  /** 同屏最大堆叠，默认 5；超出从最早的开始移除 */
  maxStack?: number;
}

interface ToastFn {
  (message: string, kind?: ToastKind, ms?: number): void;
  ok(message: string, ms?: number): void;
  err(message: string, ms?: number): void;
  warn(message: string, ms?: number): void;
  info(message: string, ms?: number): void;
  action(message: string, actionLabel: string, onAction: () => void, ms?: number): void;
  dismiss(): void;
  config(opts: ToastConfig): void;
}

const DEFAULT_MS = 2600;
const ACTION_MS = 6000;
let maxStack = 5;

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

function ensureContainer(): HTMLElement {
  const existing = document.body.querySelector<HTMLElement>('.toast-container');
  if (existing) return existing;
  const el = document.createElement('div');
  el.className = 'toast-container';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'false');
  document.body.appendChild(el);
  return el;
}

function trimStack(container: HTMLElement): void {
  /* 重读真实 DOM 直到堆栈内不超 maxStack；NodeList 不可写，用循环重读 */
  for (;;) {
    const items = Array.from(container.querySelectorAll<HTMLElement>(':scope > .toast'));
    if (items.length <= maxStack) return;
    const oldest = items[0];
    if (!oldest) return;
    oldest.classList.add('leaving');
    /* 退场动画后移除；fallback 400ms 兜底 */
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      oldest.remove();
    };
    oldest.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 400);
  }
}

function show(message: string, kind: ToastKind = 'info', opts: ToastOptions = {}): void {
  if (!isBrowser()) return;

  const { ms, actionLabel, onAction } = opts;
  const container = ensureContainer();

  const el = document.createElement('div');
  el.className = kind === 'info' ? 'toast' : `toast ${kind}`;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');

  /* 文本节点（必须用 textContent） */
  const msgNode = document.createElement('span');
  msgNode.className = 'toast-msg';
  msgNode.textContent = message;
  el.appendChild(msgNode);

  /* 可选 action 按钮 */
  let actionBtn: HTMLButtonElement | null = null;
  if (actionLabel) {
    actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action';
    actionBtn.textContent = actionLabel;
    el.appendChild(actionBtn);
  }

  container.appendChild(el);
  trimStack(container);

  let removed = false;
  const remove = (): void => {
    if (removed) return;
    removed = true;
    el.classList.add('leaving');
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      el.remove();
    };
    el.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 400);
  };

  const duration = ms ?? (actionLabel ? ACTION_MS : DEFAULT_MS);
  const timer = window.setTimeout(remove, duration);

  if (actionBtn && onAction) {
    actionBtn.addEventListener('click', () => {
      window.clearTimeout(timer);
      const ret = onAction();
      if (ret === false) return; // 显式拒绝关闭
      remove();
    });
  }
}

export const toast: ToastFn = Object.assign(
  (message: string, kind: ToastKind = 'info', ms?: number) => show(message, kind, { ms }),
  {
    ok: (message: string, ms?: number) => show(message, 'ok', { ms }),
    err: (message: string, ms?: number) => show(message, 'err', { ms }),
    warn: (message: string, ms?: number) => show(message, 'warn', { ms }),
    info: (message: string, ms?: number) => show(message, 'info', { ms }),
    action: (message: string, actionLabel: string, onAction: () => void, ms?: number) =>
      show(message, 'info', { actionLabel, onAction, ms }),
    dismiss: () => {
      if (!isBrowser()) return;
      const c = document.body.querySelector('.toast-container');
      if (!c) return;
      c.querySelectorAll('.toast').forEach((t) => t.remove());
    },
    config: (opts: ToastConfig) => {
      if (typeof opts.maxStack === 'number' && opts.maxStack > 0) maxStack = opts.maxStack;
    },
  },
);
