import { createFeedbackClock, runFeedbackAction, cancelFeedbackAction, setFeedbackError, setFeedbackText, rememberFeedbackOrigin, restoreFeedbackFocus, type FeedbackAction, type FeedbackClock } from './feedback';
import { createIcon, type IconName } from './icons';
import { t } from './i18n';
import { parseSvg } from './svg-parse';
/*
 * @icen.ai/ui — Behavior: toast（轻提示，与 components/toast.css 配套）
 *
 * 容器固定在右下角（.icen-toast-container，body 末尾唯一，自动 aria-live=polite）；
 * 语义类：.icen-toast--success / .icen-toast--error / .icen-toast--warning / .icen-toast--info；退场类 .is-leaving。
 * 文本一律 textContent 赋值，禁 innerHTML；用户传入的 SVG 图标字符串经 DOMParser
 * 消毒（同 icen-notification.ts 模式：仅接纳 <svg> 根，剥 on* 属性与 script/foreignObject）。
 * SSR 下为 no-op（返回 dismiss 为 no-op 的哑句柄）。
 *
 * 完整 API（show 系全部返回单条句柄 { dismiss() }，可提前关闭本条）：
 *   toast('已保存')                          默认 info
 *   toast.success('已保存')                   success（规范词表）
 *   toast.error('提交失败')                   error（规范词表）
 *   toast.warn('额度告警')                    warning
 *   toast.info('提示')                        info
 *   toast.action('已删除', '撤销', () => …)   带 action 按钮，6s 后自动消失
 *   toast('已保存', 'success', { icon: SVG, closable: true, progress: true })
 *   toast.dismiss()                           清空所有
 *
 * 插槽 opts（默认全关）：
 *   icon      内联 SVG 字符串 → .icen-toast-icon（消毒后渲染；非法 SVG 静默忽略）
 *   closable  右上角关闭钮 .icen-toast-close（点击即 dismiss）
 *   progress  底部超时进度条 .icen-toast-progress（时长 = 本条实际保留时长）
 *
 * 同屏最多 5 条（默认），超出移除最早的；可通过 toast.config({ maxStack }) 调整。
 */

export type ToastKind = 'warn' | 'info' | 'success' | 'error';

export interface ToastOptions {
  /** 保留时长（毫秒），默认 2600；action 默认 6000；0 常驻。焦点/hover/后台/忙碌时暂停。 */
  ms?: number;
  /** 配合 action：可撤销 / 重试 / 查看等 */
  actionLabel?: string;
  /** 等待同步/异步操作；false 保持打开，reject 保留重试反馈。关闭会 abort 传入的 signal。 */
  onAction?: FeedbackAction;
  /** Inline retry feedback on thrown/rejected actions; defaults to localized text. */
  actionError?: string;
  /** 内联 SVG 字符串图标（消毒后渲染为 .icen-toast-icon）；非 <svg> 开头或解析失败静默忽略 */
  icon?: string;
  iconName?: IconName;
  /** 显示右上角关闭按钮（.icen-toast-close，点击即关闭本条），默认 false */
  closable?: boolean;
  /** 显示底部超时进度条（.icen-toast-progress，动画时长 = 本条保留时长），默认 false */
  progress?: boolean;
}

/** 单条 toast 句柄：dismiss() 立即关闭本条（幂等，可重复调用）。 */
export interface ToastHandle {
  dismiss(): void;
  pause(): void;
  resume(): void;
}

export interface ToastConfig {
  /** 同屏最大堆叠，默认 5；超出从最早的开始移除 */
  maxStack?: number;
}

type ToastTiming = number | ToastOptions;
const timingOptions = (value?: ToastTiming): ToastOptions => typeof value === 'number' ? { ms: value } : value ?? {};
interface ToastFn {
  (message: string, kind?: ToastKind, ms?: ToastTiming): ToastHandle;
  /** success 语义（.icen-toast--success） */
  success(message: string, ms?: ToastTiming): ToastHandle;
  /** error 语义（.icen-toast--error） */
  error(message: string, ms?: ToastTiming): ToastHandle;
  warn(message: string, ms?: ToastTiming): ToastHandle;
  info(message: string, ms?: ToastTiming): ToastHandle;
  action(message: string, actionLabel: string, onAction: FeedbackAction, ms?: ToastTiming): ToastHandle;
  dismiss(): void;
  config(opts: ToastConfig): void;
}

const DEFAULT_MS = 2600;
const ACTION_MS = 6000;
let maxStack = 5;
const activeToasts=new Map<HTMLElement,{dismiss():void;dispose():void}>();

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

function ensureContainer(): HTMLElement {
  const existing = document.body.querySelector<HTMLElement>('.icen-toast-container');
  if (existing) return existing;
  const el = document.createElement('div');
  el.className = 'icen-toast-container';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'false');
  document.body.appendChild(el);
  return el;
}

/** kind → 语义类名。 */
const KIND_CLASS: Record<ToastKind, string> = {
  success: 'icen-toast--success',
  error: 'icen-toast--error',
  warn: 'icen-toast--warning',
  info: 'icen-toast--info',
};

/** 加退场类并调度移除（transitionend 或 400ms 兜底，只生效一次）。 */
function scheduleRemove(el: HTMLElement): void {
  el.classList.add('is-leaving');
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    el.removeEventListener('transitionend',onTransition);window.clearTimeout(fallback);
    el.remove();
  };
  const onTransition=(event:TransitionEvent)=>{if(event.target === el)finish();};
  el.addEventListener('transitionend',onTransition);
  const fallback=window.setTimeout(finish,400);
}

function trimStack(container: HTMLElement): void {
  const rows=Array.from(container.querySelectorAll<HTMLElement>(':scope > .icen-toast:not(.is-leaving)'));
  while(rows.length>maxStack){const oldest=rows.shift()!;const handle=activeToasts.get(oldest);if(handle)handle.dismiss();else oldest.remove();}
}

function show(message: string, kind: ToastKind = 'info', opts: ToastOptions = {}): ToastHandle {
  if (!isBrowser()) return { dismiss(){}, pause(){}, resume(){} };

  const { ms, actionLabel, onAction, icon, closable, progress } = opts;
  const container = ensureContainer();


  const el = document.createElement('div');
  el.className = `icen-toast ${KIND_CLASS[kind]}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  rememberFeedbackOrigin(el);

  /* 可选前置图标（消毒后的内联 SVG） */
  if (icon || opts.iconName) {
    const svg = opts.iconName ? createIcon(opts.iconName) : parseSvg(icon!);
    if (svg) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'icen-toast-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(svg);
      el.appendChild(iconWrap);
    }
  }

  /* 文本节点（必须用 textContent） */
  const msgNode = document.createElement('span');
  msgNode.className = 'icen-toast-msg';
  setFeedbackText(msgNode,message);
  const content=document.createElement('span');content.className='icen-toast-content';content.append(msgNode);el.append(content);

  /* 可选 action 按钮 */
  let actionBtn: HTMLButtonElement | null = null;
  if (actionLabel) {
    actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'icen-toast-action';
    setFeedbackText(actionBtn,actionLabel);
    el.appendChild(actionBtn);
  }

  const duration = ms ?? (actionLabel ? ACTION_MS : DEFAULT_MS);

  /* 关闭计时（先建 remove，关闭钮 / action / 超时 / 句柄共用） */
  let removed=false;
  let clock:FeedbackClock;
  const dispose=()=>{
    if(removed && !el.isConnected)return;
    removed=true;clock?.destroy();cancelFeedbackAction(el);restoreFeedbackFocus(el);activeToasts.delete(el);el.remove();
  };
  const remove=()=>{
    if(removed)return;
    removed=true;clock?.destroy();cancelFeedbackAction(el);restoreFeedbackFocus(el);activeToasts.delete(el);
    el.inert=true;el.setAttribute('aria-hidden','true');scheduleRemove(el);
  };

  /* 可选关闭按钮 */
  if (closable) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'icen-toast-close icen-icon-action';
    closeBtn.setAttribute('data-icen-reveal','');
    closeBtn.setAttribute('aria-label', t('common.close'));
    const svg = createIcon('close');
    if (svg) closeBtn.appendChild(svg);
    closeBtn.addEventListener('click', remove);
    el.appendChild(closeBtn);
  }

  /* 可选超时进度条（animation-duration 内联 = 布局时序而非主题样式，同 notification 倒计时） */
  if (progress && duration>0) {
    const bar = document.createElement('div');
    bar.className = 'icen-toast-progress';
    bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('div');
    fill.className = 'icen-toast-progress-fill';
    fill.style.animationDuration = `${duration}ms`;
    bar.appendChild(fill);
    el.appendChild(bar);
  }

  container.appendChild(el);
  const state={duration,remaining:duration,paused:false,timer:0,startedAt:0};
  clock=createFeedbackClock(el,state,remove,'.icen-toast-progress-fill');
  activeToasts.set(el,{dismiss:remove,dispose});trimStack(container);
  if(actionBtn && onAction)actionBtn.addEventListener('click',()=>{
    setFeedbackError(content);
    runFeedbackAction(el,actionBtn!,onAction,{
      busy(value){if(value){clock.pause('action');clock.resume('failure');}else clock.resume('action');},
      complete(accepted){if(accepted)remove();else clock.pause('failure');},
      error(){clock.pause('failure');setFeedbackError(content,opts.actionError ?? t('common.actionFailed'));},
    });
  });

  return { dismiss:remove, pause:()=>clock.pause(), resume:()=>{clock.resume('failure');clock.resume();} };
}

export const toast: ToastFn = Object.assign(
  (message: string, kind: ToastKind = 'info', ms?: ToastTiming) => show(message, kind, timingOptions(ms)),
  {
    success: (message: string, ms?: ToastTiming): ToastHandle => show(message, 'success', timingOptions(ms)),
    error: (message: string, ms?: ToastTiming): ToastHandle => show(message, 'error', timingOptions(ms)),
    warn: (message: string, ms?: ToastTiming): ToastHandle => show(message, 'warn', timingOptions(ms)),
    info: (message: string, ms?: ToastTiming): ToastHandle => show(message, 'info', timingOptions(ms)),
    action: (message: string, actionLabel: string, onAction: FeedbackAction, ms?: ToastTiming): ToastHandle =>
      show(message, 'info', { ...timingOptions(ms), actionLabel, onAction }),
    dismiss: (): void => {
      if (!isBrowser()) return;
      const c = document.body.querySelector('.icen-toast-container');
      if (!c) return;
      activeToasts.forEach((handle)=>handle.dispose());
      c.querySelectorAll('.icen-toast').forEach((t) => t.remove());
    },
    config: (opts: ToastConfig): void => {
      if(!isBrowser())return;
      if (typeof opts.maxStack === 'number' && Number.isFinite(opts.maxStack) && opts.maxStack >= 1) {maxStack=Math.floor(opts.maxStack);const container=document.querySelector<HTMLElement>('.icen-toast-container');if(container)trimStack(container);}
    },
  },
);
