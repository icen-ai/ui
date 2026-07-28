/*
 * @icen.ai/ui — Behavior: toast（轻提示，与 components/toast.css 配套）
 * 容器固定在右下角（.toast-container，body 末尾唯一）；info 不挂语义类，
 * ok/err/warn 分别挂同名类（CSS 中只有这三条语义色条规则）。
 * 文本一律 textContent 赋值，禁 innerHTML。SSR 下为 no-op。
 */

export type ToastKind = 'ok' | 'err' | 'warn' | 'info';

export interface ToastFn {
  (message: string, kind?: ToastKind, ms?: number): void;
  ok(message: string, ms?: number): void;
  err(message: string, ms?: number): void;
  warn(message: string, ms?: number): void;
}

function ensureContainer(): HTMLElement {
  const existing = document.body.querySelector<HTMLElement>('.toast-container');
  if (existing) return existing;
  const el = document.createElement('div');
  el.className = 'toast-container';
  document.body.appendChild(el);
  return el;
}

function show(message: string, kind: ToastKind = 'info', ms = 2600): void {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.className = kind === 'info' ? 'toast' : `toast ${kind}`;
  el.textContent = message;
  ensureContainer().appendChild(el);

  let removed = false;
  const remove = (): void => {
    if (removed) return;
    removed = true;
    el.remove();
  };
  window.setTimeout(() => {
    el.classList.add('leaving');
    // 退场过渡结束后移除；400ms 兜底（无过渡/过渡被打断时 transitionend 可能不触发）
    el.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 400);
  }, ms);
}

/** 轻提示：toast('已保存') / toast('失败', 'err') / toast.ok('已保存') */
export const toast: ToastFn = Object.assign(show, {
  ok: (message: string, ms?: number): void => show(message, 'ok', ms),
  err: (message: string, ms?: number): void => show(message, 'err', ms),
  warn: (message: string, ms?: number): void => show(message, 'warn', ms),
});
