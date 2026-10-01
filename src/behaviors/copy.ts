/*
 * @icen.ai/ui — Behavior: copy（复制按钮，事件委托）
 * 命中最近的 .copy-btn[data-copy] → navigator.clipboard.writeText，
 * 失败回退 textarea + execCommand；成功后按钮文本变「已复制」加 .is-done 类，1.4s 还原。
 * 图标按钮：按钮带 data-copy-icon 属性时不改文本，只加 .is-done 类（由 CSS 切换图标，如剪贴板→对勾）。
 * 同一 root 重复 init 幂等。
 */

const initialized = new WeakSet<ParentNode>();
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

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* clipboard 被拒（权限/非安全上下文）→ 回落 execCommand */
  }
  return legacyCopy(text);
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
  void copyText(text).then((ok) => {
    if (ok) flashDone(btn as HTMLElement);
  });
}

/** 委托监听 click；同一 root（含默认的 document）重复调用幂等。 */
export function initCopy(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;
  if (initialized.has(scope)) return;
  initialized.add(scope);
  (scope as EventTarget).addEventListener('click', (ev) => onClick(scope, ev));
}
