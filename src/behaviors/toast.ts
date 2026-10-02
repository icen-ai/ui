/*
 * @icen.ai/ui — Behavior: toast（轻提示，与 components/toast.css 配套）
 *
 * 容器固定在右下角（.toast-container，body 末尾唯一，自动 aria-live=polite）；
 * 语义类：.toast--success / .toast--error / .toast--warning / .toast--info；退场类 .is-leaving。
 * 文本一律 textContent 赋值，禁 innerHTML；用户传入的 SVG 图标字符串经 DOMParser
 * 消毒（同 notification.ts 模式：仅接纳 <svg> 根，剥 on* 属性与 script/foreignObject）。
 * SSR 下为 no-op（返回 dismiss 为 no-op 的哑句柄）。
 *
 * 完整 API（show 系全部返回单条句柄 { dismiss() }，可提前关闭本条）：
 *   toast('已保存')                          默认 info
 *   toast.success('已保存')                   success（规范词表）
 *   toast.error('提交失败')                   error（规范词表）
 *   toast.warn('额度告警')                    warning
 *   toast.info('提示')                        info
 *   toast.ok('已保存')                        success（deprecated，见 JSDoc）
 *   toast.err('提交失败')                     error（deprecated，见 JSDoc）
 *   toast.action('已删除', '撤销', () => …)   带 action 按钮，6s 后自动消失
 *   toast('已保存', 'success', { icon: SVG, closable: true, progress: true })
 *   toast.dismiss()                           清空所有
 *
 * 插槽 opts（默认全关）：
 *   icon      内联 SVG 字符串 → .toast-icon（消毒后渲染；非法 SVG 静默忽略）
 *   closable  右上角关闭钮 .toast-close（点击即 dismiss）
 *   progress  底部超时进度条 .toast-progress（时长 = 本条实际保留时长）
 *
 * 同屏最多 5 条（默认），超出移除最早的；可通过 toast.config({ maxStack }) 调整。
 */

export type ToastKind = 'ok' | 'err' | 'warn' | 'info' | 'success' | 'error';

export interface ToastOptions {
  /** 保留时长（毫秒），默认 2600；带 action 时默认 6000 */
  ms?: number;
  /** 配合 action：可撤销 / 重试 / 查看等 */
  actionLabel?: string;
  /** action 触发回调；返回 false 阻止 toast 关闭 */
  onAction?: () => void | Promise<void> | boolean;
  /** 内联 SVG 字符串图标（消毒后渲染为 .toast-icon）；非 <svg> 开头或解析失败静默忽略 */
  icon?: string;
  /** 显示右上角关闭按钮（.toast-close，点击即关闭本条），默认 false */
  closable?: boolean;
  /** 显示底部超时进度条（.toast-progress，动画时长 = 本条保留时长），默认 false */
  progress?: boolean;
}

/** 单条 toast 句柄：dismiss() 立即关闭本条（幂等，可重复调用）。 */
export interface ToastHandle {
  dismiss(): void;
}

export interface ToastConfig {
  /** 同屏最大堆叠，默认 5；超出从最早的开始移除 */
  maxStack?: number;
}

interface ToastFn {
  (message: string, kind?: ToastKind, ms?: number): ToastHandle;
  /** success 语义（.toast--success），规范词表入口 */
  success(message: string, ms?: number): ToastHandle;
  /**
   * success 语义（.toast--success）。
   * @deprecated 词表统一：改用 toast.success()，本别名下个大版本删除。
   */
  ok(message: string, ms?: number): ToastHandle;
  /** error 语义（.toast--error），规范词表入口 */
  error(message: string, ms?: number): ToastHandle;
  /**
   * error 语义（.toast--error）。
   * @deprecated 词表统一：改用 toast.error()，本别名下个大版本删除。
   */
  err(message: string, ms?: number): ToastHandle;
  warn(message: string, ms?: number): ToastHandle;
  info(message: string, ms?: number): ToastHandle;
  action(message: string, actionLabel: string, onAction: () => void, ms?: number): ToastHandle;
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

/** kind → 语义类名（ok/err 为兼容别名，success/error 为规范词表；均映射到现有语义类）。 */
const KIND_CLASS: Record<ToastKind, string> = {
  ok: 'toast--success',
  success: 'toast--success',
  err: 'toast--error',
  error: 'toast--error',
  warn: 'toast--warning',
  info: 'toast--info',
};

/** 关闭钮图标（库内静态常量，经同一消毒入口构建以守「禁 innerHTML」约定）。 */
const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

/** 递归剔除 SVG 子树中的 on* 属性与 script/foreignObject 节点（同 notification.ts 消毒模式）。 */
function stripUnsafeSvg(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
  }
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'script' || tag === 'foreignobject') child.remove();
    else stripUnsafeSvg(child);
  }
}

/** 解析 SVG 字符串图标：仅接纳 <svg> 根元素，消毒后导入当前文档；其余返回 null。 */
function sanitizeSvgIcon(source: string): Element | null {
  if (!source.trimStart().startsWith('<svg')) return null;
  try {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.tagName.toLowerCase() !== 'svg') return null;
    stripUnsafeSvg(svg);
    return document.importNode(svg, true);
  } catch {
    return null;
  }
}

/** 加退场类并调度移除（transitionend 或 400ms 兜底，只生效一次）。 */
function scheduleRemove(el: HTMLElement): void {
  el.classList.add('is-leaving');
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    el.remove();
  };
  el.addEventListener('transitionend', finish, { once: true });
  window.setTimeout(finish, 400);
}

function trimStack(container: HTMLElement): void {
  /* 重读真实 DOM 直到堆栈内不超 maxStack；NodeList 不可写，用循环重读 */
  for (;;) {
    const items = Array.from(container.querySelectorAll<HTMLElement>(':scope > .toast'));
    if (items.length <= maxStack) return;
    const oldest = items[0];
    if (!oldest) return;
    if (oldest.classList.contains('is-leaving')) {
      // 已在退场中（动画尚未结束）：立即移除，保证循环必定推进
      oldest.remove();
      continue;
    }
    scheduleRemove(oldest);
    // 已调度退场，退出循环（动画期间允许短暂超限）
    return;
  }
}

function show(message: string, kind: ToastKind = 'info', opts: ToastOptions = {}): ToastHandle {
  if (!isBrowser()) return { dismiss(): void { /* SSR no-op */ } };

  const { ms, actionLabel, onAction, icon, closable, progress } = opts;
  const container = ensureContainer();

  const el = document.createElement('div');
  el.className = `toast ${KIND_CLASS[kind]}`;
  el.setAttribute('role', kind === 'err' || kind === 'error' ? 'alert' : 'status');

  /* 可选前置图标（消毒后的内联 SVG） */
  if (icon) {
    const svg = sanitizeSvgIcon(icon);
    if (svg) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'toast-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(svg);
      el.appendChild(iconWrap);
    }
  }

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

  const duration = ms ?? (actionLabel ? ACTION_MS : DEFAULT_MS);

  /* 关闭计时（先建 remove，关闭钮 / action / 超时 / 句柄共用） */
  let timer = 0;
  let removed = false;
  const remove = (): void => {
    if (removed) return;
    removed = true;
    if (timer) window.clearTimeout(timer);
    scheduleRemove(el);
  };

  /* 可选关闭按钮 */
  if (closable) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', '关闭');
    const closeSvg = sanitizeSvgIcon(CLOSE_SVG);
    if (closeSvg) closeBtn.appendChild(closeSvg);
    else closeBtn.textContent = '×';
    closeBtn.addEventListener('click', remove);
    el.appendChild(closeBtn);
  }

  /* 可选超时进度条（animation-duration 内联 = 布局时序而非主题样式，同 notification 倒计时） */
  if (progress) {
    const bar = document.createElement('div');
    bar.className = 'toast-progress';
    bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('div');
    fill.className = 'toast-progress-fill';
    fill.style.animationDuration = `${duration}ms`;
    bar.appendChild(fill);
    el.appendChild(bar);
  }

  container.appendChild(el);
  trimStack(container);

  timer = window.setTimeout(remove, duration);

  if (actionBtn && onAction) {
    actionBtn.addEventListener('click', () => {
      window.clearTimeout(timer);
      const ret = onAction();
      if (ret === false) return; // 显式拒绝关闭
      remove();
    });
  }

  return { dismiss: remove };
}

export const toast: ToastFn = Object.assign(
  (message: string, kind: ToastKind = 'info', ms?: number) => show(message, kind, { ms }),
  {
    success: (message: string, ms?: number): ToastHandle => show(message, 'success', { ms }),
    ok: (message: string, ms?: number): ToastHandle => show(message, 'ok', { ms }),
    error: (message: string, ms?: number): ToastHandle => show(message, 'error', { ms }),
    err: (message: string, ms?: number): ToastHandle => show(message, 'err', { ms }),
    warn: (message: string, ms?: number): ToastHandle => show(message, 'warn', { ms }),
    info: (message: string, ms?: number): ToastHandle => show(message, 'info', { ms }),
    action: (message: string, actionLabel: string, onAction: () => void, ms?: number): ToastHandle =>
      show(message, 'info', { actionLabel, onAction, ms }),
    dismiss: (): void => {
      if (!isBrowser()) return;
      const c = document.body.querySelector('.toast-container');
      if (!c) return;
      c.querySelectorAll('.toast').forEach((t) => t.remove());
    },
    config: (opts: ToastConfig): void => {
      if (typeof opts.maxStack === 'number' && opts.maxStack > 0) maxStack = opts.maxStack;
    },
  },
);
