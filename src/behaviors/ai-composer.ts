/*
 * @icen.ai/ui — Behavior: ai-composer（AI 输入台，与 components/ai-chat.css 配套）
 *
 * DOM 契约：
 *   <div class="ai-composer" data-ai-composer>
 *     <div class="ai-composer-queue" hidden><!-- 排队消息 chips --></div>
 *     <div class="ai-composer-attach" hidden><!-- 附件 chips --></div>
 *     <div class="ai-composer-box control">
 *       <textarea class="ai-composer-input" rows="1" placeholder="…"></textarea>
 *       <div class="ai-composer-actions">
 *         <button class="ai-composer-btn" data-ai-attach aria-label="附件"></button>
 *         <button class="ai-composer-send" data-ai-send></button>   ← 运行态变 .is-stop 停止钮
 *       </div>
 *     </div>
 *   </div>
 *
 * 行为（queue / steer / stop 三动词，对齐 Cursor / Copilot 2026 模式）：
 *   initAiComposer(root?)        幂等（__icenAiComposerInit）；autosize（默认上限 8 行后内滚）；
 *                                Enter 发送 / Shift+Enter 换行 / IME 组合态安全（compositionstart
 *                                …end 挂起，复用 input.ts 模式）。发送派 icen:ai-send {text} 并清空。
 *                                附件钮打开 file input，选中文件生成 chip，派 icen:ai-attach {files}。
 *                                返回销毁函数。
 *   setComposerRunning(el, bool) 运行态切换：发送钮变停止钮（.is-stop，点击派 icen:ai-stop {}），
 *                                此时回车不发送——转为入队：生成 queue chip + 派 icen:ai-queue {text}；
 *                                chip × 移除 + 派 icen:ai-dequeue {index}。输入不丢。
 *
 * 按钮图标：data-ai-send / data-ai-attach 为空时注入库内默认 SVG（经 ai-core svgIcon() 消毒）。
 * SSR 下为 no-op；文本一律 textContent，禁 innerHTML。
 */

import { svgIcon } from './ai-core';

interface MarkedComposer extends HTMLElement {
  __icenAiComposerInit?: boolean;
}

/* 运行态 / 排队内容跨 init 共享（setComposerRunning 可先于 init 调用） */
const RUNNING = new WeakMap<HTMLElement, boolean>();
const QUEUES = new WeakMap<HTMLElement, string[]>();

const MAX_ROWS_DEFAULT = 8;

const SEND_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>';
const STOP_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
const ATTACH_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function emit(target: HTMLElement, name: string, detail: unknown): void {
  target.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}

/** 注入默认图标（仅当按钮为空时）；返回 { send, stop } 图标节点便于状态切换。 */
function ensureIcons(
  composer: HTMLElement,
): { sendBtn: HTMLButtonElement | null; sendIcon: HTMLElement | null; stopIcon: HTMLElement | null } {
  const sendBtn = composer.querySelector<HTMLButtonElement>('[data-ai-send]');
  if (sendBtn && !sendBtn.hasChildNodes()) {
    const sendWrap = document.createElement('span');
    sendWrap.className = 'ai-composer-send-icon';
    sendWrap.dataset.aiSendIcon = 'send';
    const stopWrap = document.createElement('span');
    stopWrap.className = 'ai-composer-send-icon';
    stopWrap.dataset.aiSendIcon = 'stop';
    const sendSvg = svgIcon(SEND_ICON);
    const stopSvg = svgIcon(STOP_ICON);
    if (sendSvg) sendWrap.appendChild(sendSvg);
    if (stopSvg) stopWrap.appendChild(stopSvg);
    sendBtn.append(sendWrap, stopWrap);
  }
  const attachBtn = composer.querySelector<HTMLButtonElement>('[data-ai-attach]');
  if (attachBtn && !attachBtn.hasChildNodes()) {
    const icon = svgIcon(ATTACH_ICON);
    if (icon) attachBtn.appendChild(icon);
  }
  const sendIcon = sendBtn?.querySelector<HTMLElement>('[data-ai-send-icon="send"]') ?? null;
  const stopIcon = sendBtn?.querySelector<HTMLElement>('[data-ai-send-icon="stop"]') ?? null;
  return { sendBtn, sendIcon, stopIcon };
}

/**
 * 运行态切换（spec §4.3）：
 * el 传 composer 容器或其内部任意元素（含发送钮自身），就近解析 [data-ai-composer]。
 */
export function setComposerRunning(el: HTMLElement, running: boolean): void {
  const composer = el.closest<HTMLElement>('[data-ai-composer]');
  if (!composer) return;
  RUNNING.set(composer, running);
  composer.classList.toggle('is-running', running);
  if (running) {
    composer.setAttribute('aria-busy', 'true');
  } else {
    composer.removeAttribute('aria-busy');
  }
  const sendBtn = composer.querySelector<HTMLButtonElement>('[data-ai-send]');
  if (!sendBtn) return;
  sendBtn.classList.toggle('is-stop', running);
  sendBtn.setAttribute('aria-label', running ? '停止生成' : '发送');
  const sendIcon = sendBtn.querySelector<HTMLElement>('[data-ai-send-icon="send"]');
  const stopIcon = sendBtn.querySelector<HTMLElement>('[data-ai-send-icon="stop"]');
  if (sendIcon) sendIcon.hidden = running;
  if (stopIcon) stopIcon.hidden = !running;
}

/* ── chips（queue / attach 共用结构）── */

function makeChip(text: string, removable: boolean, ariaLabel: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'ai-composer-chip';
  const label = document.createElement('span');
  label.className = 'ai-composer-chip-text';
  label.textContent = text;
  chip.appendChild(label);
  if (removable) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ai-composer-chip-remove';
    remove.setAttribute('aria-label', ariaLabel);
    remove.textContent = '×';
    chip.appendChild(remove);
  }
  return chip;
}

/* ── 单个 composer 装配 ── */

function setupComposer(composer: HTMLElement): (() => void) | undefined {
  const el = composer as MarkedComposer;
  if (el.__icenAiComposerInit) return undefined;
  el.__icenAiComposerInit = true;

  const ta = composer.querySelector<HTMLTextAreaElement>('.ai-composer-input');
  if (!ta) {
    el.__icenAiComposerInit = false;
    return undefined;
  }
  const queueEl = composer.querySelector<HTMLElement>('.ai-composer-queue');
  const attachEl = composer.querySelector<HTMLElement>('.ai-composer-attach');
  const { sendBtn, sendIcon, stopIcon } = ensureIcons(composer);

  const maxRows = Number(composer.getAttribute('data-max-rows')) || MAX_ROWS_DEFAULT;

  /* ── autosize：rows(默认 1)…maxRows(默认 8)，超出后内滚 ── */
  const resize = (): void => {
    const cs = window.getComputedStyle(ta);
    const lineHeight = parseFloat(cs.lineHeight) || 20;
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const minRows = Number(ta.getAttribute('rows')) || 1;
    ta.style.height = 'auto';
    const minH = minRows * lineHeight + padY;
    const maxH = maxRows * lineHeight + padY;
    ta.style.height = `${Math.max(minH, Math.min(ta.scrollHeight, maxH))}px`;
  };

  /* ── 队列 chips 渲染 ── */
  const renderQueue = (): void => {
    if (!queueEl) return;
    const queue = QUEUES.get(composer) ?? [];
    queueEl.replaceChildren(...queue.map((text, i) => makeChip(text, true, `移除排队消息 ${i + 1}`)));
    queueEl.hidden = queue.length === 0;
  };

  const enqueue = (text: string): void => {
    const queue = QUEUES.get(composer) ?? [];
    queue.push(text);
    QUEUES.set(composer, queue);
    renderQueue();
  };

  /* ── 发送 / 排队 / 停止 ── */
  const isRunning = (): boolean => RUNNING.get(composer) ?? false;

  const submit = (): void => {
    const text = ta.value;
    if (!text.trim()) return;
    ta.value = '';
    resize();
    if (isRunning()) {
      enqueue(text);
      emit(composer, 'icen:ai-queue', { text });
    } else {
      emit(composer, 'icen:ai-send', { text });
    }
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey && !composing) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = (): void => resize();

  /* IME 组合态：compositionstart…end 期间挂发送（中文/日文输入法不打断组合字符） */
  let composing = false;
  const onCompositionStart = (): void => {
    composing = true;
  };
  const onCompositionEnd = (): void => {
    composing = false;
  };

  const onSendClick = (): void => {
    if (isRunning()) {
      emit(composer, 'icen:ai-stop', {});
    } else {
      submit();
    }
  };

  /* chip × 移除（queue 派 icen:ai-dequeue {index}；attach chip 纯视觉移除） */
  const onQueueClick = (e: MouseEvent): void => {
    const btn = e.target instanceof Element ? e.target.closest('.ai-composer-chip-remove') : null;
    if (!btn) return;
    const index = Array.from(queueEl?.querySelectorAll('.ai-composer-chip-remove') ?? []).indexOf(btn);
    const queue = QUEUES.get(composer) ?? [];
    if (index >= 0 && index < queue.length) {
      queue.splice(index, 1);
      QUEUES.set(composer, queue);
      renderQueue();
      emit(composer, 'icen:ai-dequeue', { index });
    }
  };

  /* ── 附件 ── */
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.hidden = true;
  fileInput.multiple = true;
  composer.appendChild(fileInput);

  const onAttachClick = (): void => {
    fileInput.click();
  };

  const onFileChange = (): void => {
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = '';
    if (files.length === 0) return;
    if (attachEl) {
      for (const f of files) {
        const chip = makeChip(f.name, true, `移除附件 ${f.name}`);
        const remove = chip.querySelector<HTMLButtonElement>('.ai-composer-chip-remove');
        remove?.addEventListener('click', () => chip.remove(), { once: true });
        attachEl.appendChild(chip);
      }
      attachEl.hidden = false;
    }
    emit(composer, 'icen:ai-attach', { files });
  };

  /* ── 监听装配 ── */
  ta.addEventListener('keydown', onKeydown);
  ta.addEventListener('input', onInput);
  ta.addEventListener('compositionstart', onCompositionStart);
  ta.addEventListener('compositionend', onCompositionEnd);
  sendBtn?.addEventListener('click', onSendClick);
  queueEl?.addEventListener('click', onQueueClick);
  composer.querySelector('[data-ai-attach]')?.addEventListener('click', onAttachClick);
  fileInput.addEventListener('change', onFileChange);

  /* 同步既有运行态（setComposerRunning 先于 init 调用时） */
  const initialRunning = RUNNING.get(composer) ?? composer.classList.contains('is-running');
  if (initialRunning) setComposerRunning(composer, true);
  else {
    if (sendIcon) sendIcon.hidden = false;
    if (stopIcon) stopIcon.hidden = true;
  }
  resize();
  renderQueue();

  return () => {
    ta.removeEventListener('keydown', onKeydown);
    ta.removeEventListener('input', onInput);
    ta.removeEventListener('compositionstart', onCompositionStart);
    ta.removeEventListener('compositionend', onCompositionEnd);
    sendBtn?.removeEventListener('click', onSendClick);
    queueEl?.removeEventListener('click', onQueueClick);
    composer.querySelector('[data-ai-attach]')?.removeEventListener('click', onAttachClick);
    fileInput.removeEventListener('change', onFileChange);
    fileInput.remove();
    el.__icenAiComposerInit = false;
  };
}

/**
 * 初始化 root 下的全部 [data-ai-composer]（root 自身匹配时包含自身）。
 * 幂等；返回销毁函数（复刻 initBackTop 约定）。
 */
export function initAiComposer(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (isBrowser()) {
    const scope = root ?? document;
    const candidates: HTMLElement[] = [];
    if (scope instanceof Element && scope.matches('[data-ai-composer]')) {
      candidates.push(scope as HTMLElement);
    }
    candidates.push(...Array.from(scope.querySelectorAll<HTMLElement>('[data-ai-composer]')));
    for (const composer of candidates) {
      const cleanup = setupComposer(composer);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
