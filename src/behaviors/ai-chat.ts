/*
 * @icen.ai/ui — Behavior: ai-chat（AI 对话容器，与 components/ai-chat.css 配套）
 *
 * DOM 契约：
 *   <div class="ai-chat" data-density="normal">
 *     <div class="ai-chat-scroll">
 *       <div class="ai-msg ai-msg--user|ai-msg--assistant|ai-msg--system|ai-msg--tool">
 *         <span class="ai-msg-avatar"></span>
 *         <div class="ai-msg-body">…消费方自行渲染 markdown…</div>
 *         <div class="ai-msg-actions"><button data-ai-msg-action="copy">…</button>…</div>
 *         <div class="ai-msg-meta">12:04 · 1.2k tok</div>
 *       </div>
 *     </div>
 *     <button class="ai-chat-jump" hidden>回到底部 · 3 条新消息</button>
 *   </div>
 *
 * 行为：
 *   initAiChat(root?)   幂等（__icenAiChatInit）；滚动钉底——贴底自动跟随新内容
 *                       （ResizeObserver 监听内容尺寸），用户上滚暂停跟随并显示
 *                       .ai-chat-jump（带未读计数），点击回底恢复跟随。
 *                       消息动作委托：copy → 复制正文 + 派 icen:ai-copy {el}；
 *                       retry → 派 icen:ai-retry {el}。
 *                       reasoning 折叠委托：.ai-reasoning-head 点击切换（aria-expanded），
 *                       同时派 icen:ai-toggle {el, open}。
 *                       返回销毁函数（复刻 initBackTop 约定）。
 *   createAiStream(el)  → { append(text), done(), cancel() }：textContent 级追加（不解析
 *                       HTML），追加期间宿主挂 .is-streaming + aria-busy，done/cancel 移除；
 *                       若宿主在 .ai-reasoning 内，完成时自动折叠并回填 .ai-reasoning-time 耗时。
 *                       Markdown 重渲染是消费方职责，本模块不碰。
 *
 * SSR 下为 no-op；文本一律 textContent，禁 innerHTML。
 */

import { formatDuration } from './ai-core';

interface MarkedElement extends HTMLElement {
  __icenAiChatInit?: boolean;
}

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function emit(target: HTMLElement, name: string, detail: unknown): void {
  target.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}

function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* 剪贴板不可用时静默（icen:ai-copy 事件已派，消费方可自行处理） */
  }
  ta.remove();
}

function copyText(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

/* ── 单个 .ai-chat 的滚动钉底 + 委托 ── */

function setupChat(chat: HTMLElement): (() => void) | undefined {
  const el = chat as MarkedElement;
  if (el.__icenAiChatInit) return undefined;
  el.__icenAiChatInit = true;

  const scrollEl = chat.querySelector<HTMLElement>('.ai-chat-scroll');
  /* 浮动钮：优先用契约 DOM 里的 .ai-chat-jump，缺失时按需补建（仅当有滚动容器才有意义） */
  let jump = chat.querySelector<HTMLButtonElement>('.ai-chat-jump') ?? null;

  /* 钉底状态：贴底时跟随；上滚暂停并累计未读 */
  let pinned = true;
  let unread = 0;
  let lastMsgCount = 0;
  let suppressUntil = 0;
  let rafPending = false;

  const NEAR_BOTTOM_PX = 32;

  const isAtBottom = (): boolean =>
    scrollEl
      ? scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < NEAR_BOTTOM_PX
      : true;

  const updateJump = (): void => {
    if (!jump) return;
    if (pinned) {
      jump.hidden = true;
      return;
    }
    jump.textContent = unread > 0 ? `回到底部 · ${unread} 条新消息` : '回到底部';
    jump.hidden = false;
  };

  const scrollToBottom = (smooth: boolean): void => {
    if (!scrollEl) return;
    const behavior: ScrollBehavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
    suppressUntil = Date.now() + (behavior === 'smooth' ? 600 : 100);
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior });
  };

  /* 内容变化（新消息 / 流式增长）：钉底跟随，否则累计未读 */
  const onContentChange = (): void => {
    rafPending = false;
    if (!scrollEl) return;
    if (pinned) {
      scrollToBottom(false);
    } else {
      const count = scrollEl.querySelectorAll('.ai-msg').length;
      if (count >= lastMsgCount) {
        unread += count - lastMsgCount;
      } else {
        unread = 0; // 消息被清空/替换
      }
      lastMsgCount = Math.max(lastMsgCount, count);
      updateJump();
    }
  };

  const scheduleContentCheck = (): void => {
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(onContentChange);
  };

  const onScroll = (): void => {
    if (Date.now() < suppressUntil) return; // 程序滚动（回底/跟随）不翻转状态
    const atBottom = isAtBottom();
    if (atBottom && !pinned) {
      pinned = true;
      unread = 0;
      updateJump();
    } else if (!atBottom && pinned) {
      pinned = false;
      updateJump();
    }
  };

  const onJumpClick = (): void => {
    pinned = true;
    unread = 0;
    updateJump();
    scrollToBottom(true);
  };

  /* 消息动作 + reasoning 折叠委托 */
  const onClick = (e: MouseEvent): void => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const actionBtn = target.closest<HTMLElement>('[data-ai-msg-action]');
    if (actionBtn) {
      const msg = actionBtn.closest<HTMLElement>('.ai-msg');
      if (!msg) return;
      const action = actionBtn.dataset.aiMsgAction;
      if (action === 'copy') {
        copyText(msg.querySelector('.ai-msg-body')?.textContent ?? '');
        emit(msg, 'icen:ai-copy', { el: msg });
      } else if (action === 'retry') {
        emit(msg, 'icen:ai-retry', { el: msg });
      }
      return;
    }

    const head = target.closest<HTMLElement>('.ai-reasoning-head');
    if (head) {
      const reasoning = head.closest<HTMLElement>('.ai-reasoning');
      if (!reasoning) return;
      const body = reasoning.querySelector<HTMLElement>('.ai-reasoning-body');
      const open = head.getAttribute('aria-expanded') !== 'true';
      head.setAttribute('aria-expanded', String(open));
      reasoning.classList.toggle('is-open', open);
      if (body) body.hidden = !open;
      emit(reasoning, 'icen:ai-toggle', { el: reasoning, open });
    }
  };

  /* 监听装配 */
  const disposers: Array<() => void> = [];
  let resizeObs: ResizeObserver | undefined;
  let mutationObs: MutationObserver | undefined;

  if (scrollEl) {
    if (!jump) {
      jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'ai-chat-jump';
      jump.hidden = true;
      chat.appendChild(jump);
    }
    lastMsgCount = scrollEl.querySelectorAll('.ai-msg').length;
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    jump.addEventListener('click', onJumpClick);
    const jumpBtn = jump;
    disposers.push(() => {
      scrollEl.removeEventListener('scroll', onScroll);
      jumpBtn.removeEventListener('click', onJumpClick);
    });

    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(scheduleContentCheck);
      resizeObs.observe(scrollEl);
      for (const child of Array.from(scrollEl.children)) resizeObs.observe(child);
      disposers.push(() => resizeObs?.disconnect());
    }
    if (typeof MutationObserver !== 'undefined') {
      mutationObs = new MutationObserver((records) => {
        if (resizeObs) {
          for (const rec of records) {
            for (const node of Array.from(rec.addedNodes)) {
              if (node instanceof Element) resizeObs.observe(node);
            }
          }
        }
        scheduleContentCheck();
      });
      mutationObs.observe(scrollEl, { childList: true, subtree: true, characterData: true });
      disposers.push(() => mutationObs?.disconnect());
    }

    /* 初始钉底（历史消息场景直接停在最底部） */
    scrollToBottom(false);
  }

  chat.addEventListener('click', onClick);
  disposers.push(() => chat.removeEventListener('click', onClick));

  return () => {
    for (const dispose of disposers) dispose();
    el.__icenAiChatInit = false;
  };
}

/**
 * 初始化 root 下的全部 .ai-chat（root 自身匹配时包含自身）。
 * 幂等；返回销毁函数：移除监听、断开观察器并复位幂等标记（可重新 init）。
 */
export function initAiChat(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (isBrowser()) {
    const scope = root ?? document;
    const candidates: HTMLElement[] = [];
    if (scope instanceof Element && scope.matches('.ai-chat')) {
      candidates.push(scope as HTMLElement);
    }
    candidates.push(...Array.from(scope.querySelectorAll<HTMLElement>('.ai-chat')));
    for (const chat of candidates) {
      const cleanup = setupChat(chat);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}

/* ── 流式追加句柄 ── */

export interface AiStreamHandle {
  /** textContent 级追加一段文本（不解析 HTML） */
  append(text: string): void;
  /** 流正常结束：移除 .is-streaming / aria-busy；reasoning 自动折叠 + 回填耗时 */
  done(): void;
  /** 流被取消：同 done，但不折叠 reasoning、不计耗时 */
  cancel(): void;
}

/**
 * 创建流式追加句柄：追加期间宿主挂 .is-streaming（aria-busy=true），
 * 完成/取消移除。宿主在 .ai-reasoning 内时同步驱动 reasoning 状态：
 * 流式中根挂 .is-streaming（CSS shimmer），done() 自动折叠并显示耗时。
 */
export function createAiStream(el: HTMLElement): AiStreamHandle {
  const reasoning = el.closest<HTMLElement>('.ai-reasoning');
  const startedAt = Date.now();
  let state: 'streaming' | 'done' | 'cancelled' = 'streaming';

  el.classList.add('is-streaming');
  el.setAttribute('aria-busy', 'true');
  reasoning?.classList.add('is-streaming');

  const settle = (finished: boolean): void => {
    if (state !== 'streaming') return;
    state = finished ? 'done' : 'cancelled';
    el.classList.remove('is-streaming');
    el.removeAttribute('aria-busy');
    if (!reasoning) return;
    reasoning.classList.remove('is-streaming');
    if (!finished) return;
    /* §4.2：完成自动折叠 + 显示耗时 */
    const head = reasoning.querySelector<HTMLElement>('.ai-reasoning-head');
    const body = reasoning.querySelector<HTMLElement>('.ai-reasoning-body');
    head?.setAttribute('aria-expanded', 'false');
    if (body) body.hidden = true;
    const time = reasoning.querySelector<HTMLElement>('.ai-reasoning-time');
    if (time) time.textContent = formatDuration(Date.now() - startedAt);
  };

  return {
    append(text: string) {
      if (state !== 'streaming' || !text) return;
      el.textContent += text;
    },
    done() {
      settle(true);
    },
    cancel() {
      settle(false);
    },
  };
}
