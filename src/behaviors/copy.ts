/*
 * @icen.ai/ui — Behavior: copy（复制按钮，事件委托）
 * 命中最近的 .icen-copy-btn[data-icen-copy] → navigator.clipboard.writeText，
 * 失败回退 textarea + execCommand；共用 feedback 的去重、等待与取消机制。
 * 原始节点包在 .icen-copy-content 中保留，独立 .icen-copy-result 显示成功 1.4s。
 * 图标按钮空槽自动补共享 SVG；失败显示相邻 .icen-copy-feedback，可点击原按钮重试。
 *
 * 事件（从命中按钮派发，bubbles）：
 *   icen:copy-success { text }            复制成功（含 execCommand 回退成功）
 *   icen:copy-error   { text, reason }    复制失败（reason 供宿主诊断，不直接展示）
 *
 * 同一 root 重复 init 返回同一销毁函数，嵌套委托只执行一次；卸载还原节点和宿主属性。
 * initCopy(root?, { write? }) 支持可取消的异步原生桥接或权限流程。
 * SSR 下返回 no-op。
 */

import { emitIcen } from './events';
import { t } from './i18n';
import { createIcon } from './icons';
import { runFeedbackAction, cancelFeedbackAction } from './feedback';

/** Each scope owns its listener and references to progressively enhanced slots. */
const scopes = new WeakMap<ParentNode, () => void>();
const handled = new WeakSet<Event>();
let statusSequence = 0;
interface CopyState {
  owners: Set<object>;
  content: HTMLSpanElement;
  result: HTMLSpanElement;
  status: HTMLSpanElement | null;
  generatedIcon: SVGSVGElement | null;
  label: string | null;
  describedBy: string | null;
  busy: string | null;
  timer: number;
  pending: boolean;
  actionOwner?: object;
}
const buttons = new WeakMap<HTMLButtonElement, CopyState>();

export interface CopyOptions {
  /** Optional native bridge or permission gate. Return false to show retry;
   * undefined/true mean success. Honor signal when work can be cancelled. */
  write?: (text: string, context: {signal: AbortSignal}) => void | boolean | Promise<void | boolean>;
}

function unavailable(button: HTMLButtonElement): boolean {
  if (button.matches(':disabled') || button.closest('[aria-disabled="true"]')) return true;
  for (let parent = button.parentElement; parent; parent = parent.parentElement) {
    if (parent.matches('fieldset[disabled]') && !parent.querySelector(':scope > legend')?.contains(button)) return true;
  }
  return false;
}

function legacyCopy(text: string): boolean {
  const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  const owned=document.activeElement === ta;ta.remove();
  if(owned && previous?.isConnected)previous.focus({preventScroll:true});
  return ok;
}

interface CopyOutcome {
  ok: boolean;
  /** 失败原因（ok=false 时必有；给 icen:copy-error 的 reason） */
  reason?: string;
}

/**
 * 写剪贴板（clipboard API 优先，execCommand 回退）；成功/失败带原因的结构化结果。
 * code-block 等组件复用同一回退链与文案。可选 signal 阻止取消后的回退复制。
 */
export async function copyText(text: string,options:{signal?:AbortSignal}={}): Promise<CopyOutcome> {
  if(typeof document === 'undefined' || typeof window === 'undefined')return {ok:false,reason:t('copy.unavailable')};
  if(options.signal?.aborted)return {ok:false,reason:'AbortError'};
  const hasApi = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
  if (hasApi) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (err) {
      if(options.signal?.aborted)return {ok:false,reason:'AbortError'};
      /* clipboard 被拒（权限/非安全上下文）→ 回落 execCommand */
      const fallbackOk = legacyCopy(text);
      if (fallbackOk) return { ok: true };
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: t('copy.denied', { p0: reason }) };
    }
  }
  if (legacyCopy(text)) return { ok: true };
  return { ok: false, reason: t('copy.unavailable') };
}

function restoreAttribute(button: HTMLElement, name: string, value: string | null): void {
  if (value == null) button.removeAttribute(name); else button.setAttribute(name, value);
}

function reset(button: HTMLButtonElement, state: CopyState): void {
  const active = state.actionOwner !== undefined;
  cancelFeedbackAction(button);
  window.clearTimeout(state.timer);
  state.timer = 0;
  state.pending = false;
  state.actionOwner = undefined;
  button.classList.remove('is-done', 'is-error');
  if (active) {
    state.content.removeAttribute('aria-hidden');
    restoreAttribute(button, 'aria-label', state.label);
    restoreAttribute(button, 'aria-describedby', state.describedBy);
    restoreAttribute(button, 'aria-busy', state.busy);
  }
  state.status?.remove();
  state.status = null;
}

function teardown(button: HTMLButtonElement, state: CopyState): void {
  reset(button, state);
  state.result.remove();
  state.generatedIcon?.remove();
  if (state.content.parentNode === button) state.content.replaceWith(...state.content.childNodes);
  if (buttons.get(button) === state) buttons.delete(button);
}

function prepare(button: HTMLButtonElement, owner: object): CopyState {
  let state = buttons.get(button);
  const owners = state?.owners ?? new Set<object>();
  // A host may replace all slot children while retaining the button itself.
  if (state && state.content.parentNode !== button) {
    teardown(button, state);
    state = undefined;
  }
  if (!state) {
    const content = document.createElement('span');
    content.className = 'icen-copy-content icen-feedback-action-label';
    while (button.firstChild) content.append(button.firstChild);
    const iconOnly = button.hasAttribute('data-icen-copy-icon');
    const generatedIcon = iconOnly && !content.querySelector('svg') ? createIcon('copy') : null;
    if (generatedIcon) content.append(generatedIcon);
    const result = document.createElement('span');
    result.className = 'icen-copy-result';
    result.setAttribute('aria-hidden', 'true');
    if (iconOnly) result.append(createIcon('check')!); else result.textContent = t('copy.copied');
    state = {owners, content, result, generatedIcon, status: null, label: button.getAttribute('aria-label'),
      describedBy: button.getAttribute('aria-describedby'), busy: button.getAttribute('aria-busy'), timer: 0, pending: false};
    button.append(content, result);
    buttons.set(button, state);
  }
  state.owners.add(owner);
  return state;
}

function perform(button: HTMLButtonElement, state: CopyState, owner: object, options: CopyOptions): void {
  if (state.pending) return;
  reset(button, state);
  // Capture current author attributes, rather than keeping a stale mount label.
  state.label = button.getAttribute('aria-label');
  state.describedBy = button.getAttribute('aria-describedby');
  state.busy = button.getAttribute('aria-busy');
  state.actionOwner = owner;
  const text = button.getAttribute('data-icen-copy') ?? '';
  let reason = t('copy.unknown');
  const feedback = (ok: boolean): void => {
    const status = document.createElement('span');
    status.className = 'icen-copy-feedback' + (ok ? ' is-success' : '');
    status.dir = 'auto';
    status.setAttribute('role', 'status');
    status.textContent = t(ok ? 'copy.copied' : 'copy.failed');
    do {status.id = 'icen-copy-status-' + ++statusSequence;} while (document.getElementById(status.id));
    button.after(status);
    state.status = status;
    button.classList.add(ok ? 'is-done' : 'is-error');
    if (ok) {
      state.content.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-label', t('copy.copied'));
      if (!button.hasAttribute('data-icen-copy-icon')) state.result.textContent = t('copy.copied');
      state.timer = window.setTimeout(() => reset(button, state), 1400);
      emitIcen(button, 'icen:copy-success', {text});
    } else {
      button.setAttribute('aria-describedby', [state.describedBy, status.id].filter(Boolean).join(' '));
      emitIcen(button, 'icen:copy-error', {text, reason});
    }
  };
  runFeedbackAction(button, button, async (signal) => {
    if (options.write) return (await options.write(text, {signal})) !== false;
    const outcome = await copyText(text, {signal});
    reason = outcome.reason ?? t('copy.unknown');
    return outcome.ok;
  }, {busy(value) {state.pending = value;}, complete: feedback, error(error) {
    reason = error instanceof Error ? error.message : String(error);
    feedback(false);
  }});
}

/**
 * 委托监听 click；同一 root（含默认的 document）重复调用幂等。
 * 返回销毁函数：移除委托监听并复位幂等标记（销毁后可重新 init）。SSR 下返回 no-op。
 */
export function initCopy(root?: ParentNode, options: CopyOptions = {}): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const scope = root ?? document;
  const existing = scopes.get(scope);
  if (existing) return existing;
  const owner = {}, owned = new Set<HTMLButtonElement>();
  let disposed = false;
  const contains = (button: HTMLButtonElement): boolean => (scope as Node).contains(button);
  const collect = (node: ParentNode): void => {
    const mount = (button: HTMLButtonElement): void => {if (contains(button)) {prepare(button, owner); owned.add(button);}};
    if (node instanceof HTMLButtonElement && node.matches('.icen-copy-btn[data-icen-copy]')) mount(node);
    node.querySelectorAll<HTMLButtonElement>('button.icen-copy-btn[data-icen-copy]').forEach(mount);
  };
  const release = (button: HTMLButtonElement): void => {
    const state = buttons.get(button);
    if (!state) return;
    state.owners.delete(owner);
    if (!state.owners.size) teardown(button, state);
    else if (state.actionOwner === owner) reset(button, state);
  };
  collect(scope);
  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof HTMLElement && ((scope as Node).contains(node) || node.contains(scope as Node))) collect(node);
    }
    for (const button of owned) {
      if (!contains(button) || !button.isConnected) {release(button); owned.delete(button);}
      else if (unavailable(button)) {
        const state = buttons.get(button);
        if (state?.actionOwner === owner) reset(button, state);
      }
    }
  });
  observer.observe(scope, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled']});
  // Scoped roots may be removed or disabled by an ancestor outside their subtree.
  if (scope !== document && scope !== document.documentElement) {
    observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled']});
  }
  const handler = (event: Event): void => {
    if (disposed || event.defaultPrevented || handled.has(event) || !(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button.icen-copy-btn[data-icen-copy]');
    if (!button || !contains(button)) return;
    if (unavailable(button)) {event.preventDefault(); return;}
    handled.add(event);
    event.preventDefault(); // A plain authored button must never submit its form.
    owned.add(button);
    perform(button, prepare(button, owner), owner, options);
  };
  (scope as EventTarget).addEventListener('click', handler);
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    (scope as EventTarget).removeEventListener('click', handler);
    observer.disconnect();
    owned.forEach(release);
    owned.clear();
    if (scopes.get(scope) === dispose) scopes.delete(scope);
  };
  scopes.set(scope, dispose);
  return dispose;
}
