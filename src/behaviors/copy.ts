/*
 * @icen.ai/ui — Behavior: copy（复制按钮，事件委托）
 * 命中最近的 .copy-btn[data-copy] → navigator.clipboard.writeText，
 * 失败回退 textarea + execCommand；成功后按钮文本变「已复制」加 .is-done 类，1.4s 还原。
 * 图标按钮：按钮带 data-copy-icon 属性时不改文本，只加 .is-done 类（由 CSS 切换图标，如剪贴板→对勾）。
 *
 * 事件（从命中按钮派发，bubbles）：
 *   icen:copy-success { text }            复制成功（含 execCommand 回退成功）
 *   icen:copy-error   { text, reason }    复制失败（此前静默；reason 为失败原因描述）
 *
 * 同一 root 重复 init 幂等；initCopy 返回销毁函数（移除委托监听并复位幂等标记，可重新 init）。
 * SSR 下返回 no-op。
 */

import { emitIcen } from './events';

/** root → 已挂的委托处理器（销毁时摘除用；存在性即幂等标记） */
const handlers = new WeakMap<ParentNode, (ev: Event) => void>();
const flashing = new WeakMap<HTMLElement, { original: string | null; timer: number }>();

function legacyCopy(text: string): boolean {
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
  ta.remove();
  return ok;
}

interface CopyOutcome {
  ok: boolean;
  /** 失败原因（ok=false 时必有；给 icen:copy-error 的 reason） */
  reason?: string;
}

async function copyText(text: string): Promise<CopyOutcome> {
  const hasApi = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
  if (hasApi) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (err) {
      /* clipboard 被拒（权限/非安全上下文）→ 回落 execCommand */
      const fallbackOk = legacyCopy(text);
      if (fallbackOk) return { ok: true };
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `clipboard API 被拒（${reason}）且回退 execCommand 失败` };
    }
  }
  if (legacyCopy(text)) return { ok: true };
  return { ok: false, reason: '剪贴板不可用（无 clipboard API 且 execCommand 回退失败）' };
}

function flashDone(btn: HTMLElement): void {
  const prev = flashing.get(btn);
  if (prev) window.clearTimeout(prev.timer);
  const iconOnly = btn.hasAttribute('data-copy-icon');
  const original = prev ? prev.original : iconOnly ? null : btn.textContent;
  if (!iconOnly) btn.textContent = '已复制';
  btn.classList.add('is-done');
  const timer = window.setTimeout(() => {
    if (!iconOnly) btn.textContent = original;
    btn.classList.remove('is-done');
    flashing.delete(btn);
  }, 1400);
  flashing.set(btn, { original, timer });
}

function onClick(root: ParentNode, ev: Event): void {
  const target = ev.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest('.copy-btn[data-copy]');
  // root 为 Element 时，closest 可能爬到 root 之外，需要兜住
  if (!btn || !(root as Node).contains(btn)) return;
  const text = btn.getAttribute('data-copy') ?? '';
  void copyText(text).then((outcome) => {
    if (outcome.ok) {
      flashDone(btn as HTMLElement);
      emitIcen(btn, 'icen:copy-success', { text });
    } else {
      emitIcen(btn, 'icen:copy-error', { text, reason: outcome.reason ?? '未知错误' });
    }
  });
}

/**
 * 委托监听 click；同一 root（含默认的 document）重复调用幂等。
 * 返回销毁函数：移除委托监听并复位幂等标记（销毁后可重新 init）。SSR 下返回 no-op。
 */
export function initCopy(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;
  if (handlers.has(scope)) return () => {};
  const handler = (ev: Event): void => onClick(scope, ev);
  handlers.set(scope, handler);
  (scope as EventTarget).addEventListener('click', handler);
  return () => {
    (scope as EventTarget).removeEventListener('click', handler);
    handlers.delete(scope);
  };
}
