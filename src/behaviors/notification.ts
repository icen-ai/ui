/*
 * @icen.ai/ui — Behavior: notification（通知栈，与 components/notification.css 配套）
 *
 * 与 toast / alert 的差异：
 *   - toast     = 瞬时轻提示（2.6s 自动消失），右下角
 *   - alert     = 内嵌警示条（页面流内，非浮层）
 *   - notification = 持久通知栈（右上角，默认不自动关闭，需手动关闭或 duration 定时）
 *
 * 完整 API：
 *   notify('标题')                                       默认 info，不自动关闭
 *   notify.success('已发布', { description, duration })
 *   notify.warn('配额将尽', { description, duration })
 *   notify.error('发布失败', { description, duration })
 *   notify.info('提示', { description, duration })
 *   notify.dismiss(id?)                                  关闭单条（id 缺省=全部）
 *   notify.config({ position, maxStack })                全局配置
 *
 * 返回值：notify.* 返回 string | null = 该条 id（可用于 dismiss(id) 定向关闭）
 * SSR 下为 no-op。
 */

export type NotificationKind = 'success' | 'warning' | 'error' | 'info';

export interface NotificationOptions {
  /** 副标题（正文） */
  description?: string;
  /** 自动关闭延时（毫秒），默认 0 = 不自动关闭 */
  duration?: number;
  /** 动作按钮 */
  actionLabel?: string;
  /** 动作回调；返回 false 阻止关闭 */
  onAction?: () => void | Promise<void> | boolean;
}

export interface NotificationConfig {
  /** 位置：top-right（默认）/ top-left / bottom-left / bottom-right */
  position?: 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right';
  /** 同屏最大堆叠，默认 4；超出从最早的开始移除 */
  maxStack?: number;
}

interface NotifyFn {
  (title: string, opts?: NotificationOptions): string | null;
  success(title: string, opts?: NotificationOptions): string | null;
  warn(title: string, opts?: NotificationOptions): string | null;
  error(title: string, opts?: NotificationOptions): string | null;
  info(title: string, opts?: NotificationOptions): string | null;
  dismiss(id?: string): void;
  config(opts: NotificationConfig): void;
}

let cfg: Required<NotificationConfig> = {
  position: 'top-right',
  maxStack: 4,
};

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

const ICONS: Record<NotificationKind, string> = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
};

const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

function ensureContainer(): HTMLElement {
  const existing = document.body.querySelector<HTMLElement>('.notification-container');
  if (existing) {
    if (existing.dataset.position !== cfg.position) {
      existing.dataset.position = cfg.position;
    }
    return existing;
  }
  const el = document.createElement('div');
  el.className = 'notification-container';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', '通知');
  el.dataset.position = cfg.position;
  document.body.appendChild(el);
  return el;
}

function trimStack(container: HTMLElement): void {
  for (;;) {
    const items = Array.from(container.querySelectorAll<HTMLElement>(':scope > .notification'));
    if (items.length <= cfg.maxStack) return;
    removeOne(items[0]);
  }
}

function removeOne(el: HTMLElement): void {
  if (el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    el.remove();
  };
  el.addEventListener('transitionend', finish, { once: true });
  window.setTimeout(finish, 360);
}

function genId(): string {
  return 'notif-' + Math.random().toString(36).slice(2, 10);
}

function show(title: string, kind: NotificationKind, opts: NotificationOptions = {}): string | null {
  if (!isBrowser()) return null;

  const container = ensureContainer();
  const id = genId();

  const el = document.createElement('div');
  el.className = kind === 'info' ? 'notification' : `notification notif--${kind}`;
  el.id = id;
  el.setAttribute('role', 'alert');

  const icon = document.createElement('span');
  icon.className = 'notification-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = ICONS[kind];
  el.appendChild(icon);

  const content = document.createElement('div');
  content.className = 'notification-content';

  const titleEl = document.createElement('p');
  titleEl.className = 'notification-title';
  titleEl.textContent = title;
  content.appendChild(titleEl);

  if (opts.description) {
    const msg = document.createElement('p');
    msg.className = 'notification-message';
    msg.textContent = opts.description;
    content.appendChild(msg);
  }

  let actionBtn: HTMLButtonElement | null = null;
  let timer = 0;
  if (opts.actionLabel) {
    const actions = document.createElement('div');
    actions.className = 'notification-actions';
    actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'notification-action';
    actionBtn.textContent = opts.actionLabel;
    actions.appendChild(actionBtn);
    content.appendChild(actions);
  }

  el.appendChild(content);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'notification-close';
  closeBtn.setAttribute('aria-label', '关闭');
  closeBtn.innerHTML = CLOSE_SVG;
  el.appendChild(closeBtn);

  container.appendChild(el);
  trimStack(container);

  const dismiss = (): void => removeOne(el);

  closeBtn.addEventListener('click', dismiss);

  if (opts.duration && opts.duration > 0) {
    timer = window.setTimeout(dismiss, opts.duration);
  }

  if (actionBtn && opts.onAction) {
    actionBtn.addEventListener('click', () => {
      if (timer) window.clearTimeout(timer);
      const ret = opts.onAction!();
      if (ret === false) return;
      dismiss();
    });
  }

  return id;
}

export const notify: NotifyFn = Object.assign(
  (title: string, opts?: NotificationOptions) => show(title, 'info', opts),
  {
    success: (title: string, opts?: NotificationOptions) => show(title, 'success', opts),
    warn: (title: string, opts?: NotificationOptions) => show(title, 'warning', opts),
    error: (title: string, opts?: NotificationOptions) => show(title, 'error', opts),
    info: (title: string, opts?: NotificationOptions) => show(title, 'info', opts),
    dismiss: (id?: string) => {
      if (!isBrowser()) return;
      if (id) {
        const el = document.getElementById(id);
        if (el && el.classList.contains('notification')) removeOne(el);
        return;
      }
      const container = document.body.querySelector('.notification-container');
      if (!container) return;
      container.querySelectorAll<HTMLElement>('.notification').forEach(removeOne);
    },
    config: (opts: NotificationConfig) => {
      if (opts.position) {
        cfg.position = opts.position;
        const c = document.body.querySelector<HTMLElement>('.notification-container');
        if (c) c.dataset.position = opts.position;
      }
      if (typeof opts.maxStack === 'number' && opts.maxStack > 0) cfg.maxStack = opts.maxStack;
    },
  },
);

/** 委托初始化（无副作用，notify.* 可直接调用；保留 init 与项目约定一致）。 */
export function initNotification(): void {
  if (!isBrowser()) return;
  ensureContainer();
}
