/*
 * @icen.ai/ui — Behavior: ai-chat（AI 对话容器，与 components/ai-chat.css 配套）
 *
 * DOM 契约：
 *   <div class="icen-ai-chat" data-icen-density="normal">
 *     <div class="icen-ai-chat-scroll">
 *       <div class="icen-ai-msg icen-ai-msg--user|icen-ai-msg--assistant|icen-ai-msg--system|icen-ai-msg--tool">
 *         <span class="icen-ai-msg-avatar"></span>
 *         <div class="icen-ai-msg-body">…消费方自行渲染 markdown…</div>
 *         <div class="icen-ai-msg-actions"><button data-icen-ai-msg-action="copy">…</button>…</div>
 *         <div class="icen-ai-msg-meta">12:04 · 1.2k tok</div>
 *       </div>
 *     </div>
 *     <button class="icen-ai-chat-jump" hidden>回到底部 · 3 条新消息</button>
 *   </div>
 *   （各子节点 append 顺序不敏感，示例仅示意；实际顺序以 renderAiMessage 实现为准）
 *
 * 行为：
 *   initAiChat(root?)   幂等（__icenAiChatInit）；滚动钉底——贴底自动跟随新内容
 *                       （ResizeObserver 监听内容尺寸），用户上滚暂停跟随并显示
 *                       .icen-ai-chat-jump（带未读计数），点击回底恢复跟随。
 *                       消息动作委托：copy → 复制正文 + 派 icen:ai-copy {el}；
 *                       retry → 派 icen:ai-retry {el}。
 *                       reasoning 折叠委托：.icen-ai-reasoning-head 点击切换（aria-expanded），
 *                       同时派 icen:ai-toggle {el, open}；真实用户 toggle 置
 *                       __icenReasonUserTouched，此后 createAiStream 永不自动收起该块。
 *                       返回销毁函数（复刻 initBackTop 约定）。
 *   createAiStream(el)  → { append(text), done(), cancel(), fail() }：textContent 级追加（不解析
 *                       HTML），追加期间宿主挂 .is-streaming + aria-busy，done/cancel 移除；
 *                       fail() 终止追加并挂 .is-error（错误路径）。
 *                       reasoning 折叠契约（§5.27，AI Elements 四条规则）：流式态默认展开；
 *                       done/fail 后延迟 1000ms 自动收起一次且仅一次（元素挂
 *                       __icenReasonAutoClosed 标记）；用户手动 toggle 后永不自动收起；
 *                       计时文案「思考 Ns」自折叠头 data-icen-reasoning-start 起算。
 *                       aborted 半成品（§5.27）：fail/cancel 保留已生成内容并在消息尾补
 *                       .icen-ai-msg-continue「继续生成」槽（→ icen:ai-retry {el}）；cancel 不显示
 *                       错误（aborted ≠ error 纪律），fail 的错误展示仍归消费方。
 *                       Markdown 重渲染是消费方职责，本模块不碰。
 *   renderAiMessage(scrollEl, model) → { el, body, setMeta, setError, stream() }：
 *                       DOM API 渲染一条消息（多角色变体 + 多模态部件（spec §10：
 *                       文字/图片/音频/视频/文件/资源链接）+ copy/retry 动作钮（委托归
 *                       initAiChat）+ meta/model 标签 + .icen-ai-msg--error 错误变体）。
 *                       stream() 在正文末开流式文本节点返回 createAiStream 句柄。
 *
 * SSR 下为 no-op；文本一律 textContent，禁 innerHTML。
 */

import { aiContentUrl, formatDuration, h, svgIcon, type AiContent, type AiContentPart, type AiTextPart } from './ai-core';
import { emitIcen, type IcenEventMap } from './events';
import { t } from './i18n';
import { iconHTML } from './icons';

/* Message actions share the same optical geometry as the input and tools. */
const ICON_COPY = iconHTML('copy');
const ICON_RETRY = iconHTML('refresh');

interface MarkedElement extends HTMLElement {
  __icenAiChatInit?: boolean;
}

/* §5.27 reasoning 自动收起契约的元素级标记（挂在 .icen-ai-reasoning 根上） */
interface ReasoningMarked extends HTMLElement {
  /** 用户手动 toggle 过：此后永不自动收起 */
  __icenReasonUserTouched?: boolean;
  /** 已自动收起过一次：同一元素不再重复自动收起（「一次且仅一次」） */
  __icenReasonAutoClosed?: boolean;
}

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function emit<K extends keyof IcenEventMap>(target: HTMLElement, name: K, detail: IcenEventMap[K]): void {
  emitIcen(target, name, detail);
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

/* ── 单个 .icen-ai-chat 的滚动钉底 + 委托 ── */

function setupChat(chat: HTMLElement): (() => void) | undefined {
  const el = chat as MarkedElement;
  if (el.__icenAiChatInit) return undefined;
  el.__icenAiChatInit = true;

  const scrollEl = chat.querySelector<HTMLElement>('.icen-ai-chat-scroll');
  /* 浮动钮：优先用契约 DOM 里的 .icen-ai-chat-jump，缺失时按需补建（仅当有滚动容器才有意义） */
  let jump = chat.querySelector<HTMLButtonElement>('.icen-ai-chat-jump') ?? null;

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
    jump.textContent = unread > 0 ? t('aiChat.backToBottomCount', { p0: unread }) : t('aiChat.backToBottom');
    jump.hidden = false;
  };

  const scrollToBottom = (smooth: boolean): void => {
    if (!scrollEl) return;
    const behavior: ScrollBehavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
    /* 600ms ≈ smooth 滚动到位的时间上限；100ms 掩盖 instant/auto 滚动自身触发的 scroll 事件 */
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
      const count = scrollEl.querySelectorAll('.icen-ai-msg').length;
      if (count >= lastMsgCount) {
        unread += count - lastMsgCount;
      } else {
        unread = 0; // 消息被清空/替换
      }
      lastMsgCount = count; // 无条件同步基线：清空后重建时计数必须能下降，否则新增消息永远不算未读
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

    const actionBtn = target.closest<HTMLElement>('[data-icen-ai-msg-action]');
    if (actionBtn) {
      const msg = actionBtn.closest<HTMLElement>('.icen-ai-msg');
      if (!msg) return;
      const action = actionBtn.dataset.icenAiMsgAction;
      if (action === 'copy') {
        /* 模型名 chip 挂在 body 内（视觉随正文走），复制需剔除：克隆后移除再取文本，不动原 DOM */
        const bodyEl = msg.querySelector('.icen-ai-msg-body');
        const clone = bodyEl?.cloneNode(true);
        if (clone instanceof HTMLElement) {
          clone.querySelectorAll('.icen-ai-msg-model').forEach((chip) => chip.remove());
          copyText(clone.textContent ?? '');
        } else {
          copyText('');
        }
        emit(msg, 'icen:ai-copy', { el: msg });
      } else if (action === 'retry') {
        emit(msg, 'icen:ai-retry', { el: msg });
      }
      return;
    }

    const head = target.closest<HTMLElement>('.icen-ai-reasoning-head');
    if (head) {
      const reasoning = head.closest<HTMLElement>('.icen-ai-reasoning');
      if (!reasoning) return;
      const body = reasoning.querySelector<HTMLElement>('.icen-ai-reasoning-body');
      const open = head.getAttribute('aria-expanded') !== 'true';
      head.setAttribute('aria-expanded', String(open));
      reasoning.classList.toggle('is-open', open);
      if (body) body.hidden = !open;
      /* §5.27：本委托只由真实点击触达——手动 toggle 即接管，此后流结束也不自动收起 */
      (reasoning as ReasoningMarked).__icenReasonUserTouched = true;
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
      jump.className = 'icen-ai-chat-jump';
      jump.hidden = true;
      chat.appendChild(jump);
    }
    lastMsgCount = scrollEl.querySelectorAll('.icen-ai-msg').length;
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
 * 初始化 root 下的全部 .icen-ai-chat（root 自身匹配时包含自身）。
 * 幂等；返回销毁函数：移除监听、断开观察器并复位幂等标记（可重新 init）。
 */
export function initAiChat(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (isBrowser()) {
    const scope = root ?? document;
    const candidates: HTMLElement[] = [];
    if (scope instanceof Element && scope.matches('.icen-ai-chat')) {
      candidates.push(scope as HTMLElement);
    }
    candidates.push(...Array.from(scope.querySelectorAll<HTMLElement>('.icen-ai-chat')));
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
  /** 流正常结束：移除 .is-streaming / aria-busy；reasoning 回填「思考 Ns」并延迟 1s 自动收起一次（§5.27） */
  done(): void;
  /** 流被取消：保留已生成内容，补「继续生成」槽；不折叠 reasoning、不计耗时（aborted ≠ error） */
  cancel(): void;
  /** 流失败：终止追加并挂 .is-error（错误文本展示由消费方/renderAiMessage.setError 负责）；reasoning 同 done 收起 + 补「继续生成」槽 */
  fail(): void;
}

/** §5.27：流结束后 reasoning 自动收起的延迟 */
const REASONING_AUTO_CLOSE_MS = 1000;

/** 展开/折叠 reasoning（与 initAiChat 的 head 委托同一套 aria-expanded / .is-open / hidden 三件套） */
function setReasoningOpen(reasoning: HTMLElement, open: boolean): void {
  const head = reasoning.querySelector<HTMLElement>('.icen-ai-reasoning-head');
  const body = reasoning.querySelector<HTMLElement>('.icen-ai-reasoning-body');
  head?.setAttribute('aria-expanded', String(open));
  reasoning.classList.toggle('is-open', open);
  if (body) body.hidden = !open;
}

/** 新流开启时清掉上一条半成品留下的「继续生成」槽（宿主重试/续写复用同一消息时） */
function clearContinueSlot(scope: HTMLElement | null): void {
  scope?.querySelectorAll('.icen-ai-msg-continue').forEach((n) => n.remove());
}

/**
 * 创建流式追加句柄：追加期间宿主挂 .is-streaming（aria-busy=true），完成/取消移除。
 * 宿主在 .icen-ai-reasoning 内时同步驱动 reasoning 折叠契约（§5.27）：流式态默认展开；
 * done/fail 移除 .is-streaming、回填「思考 Ns」（自折叠头 data-icen-reasoning-start 起算）并
 * 延迟 1s 自动收起一次（用户手动 toggle 过则永不自动收）；fail/cancel 保留已生成内容
 * 并在消息尾补 .icen-ai-msg-continue「继续生成」槽（cancel 不显示错误——aborted ≠ error）。
 */
export function createAiStream(el: HTMLElement): AiStreamHandle {
  const reasoning = el.closest<HTMLElement>('.icen-ai-reasoning');
  const msgBody = el.closest<HTMLElement>('.icen-ai-msg-body');
  const msg = el.closest<HTMLElement>('.icen-ai-msg');
  const startedAt = Date.now();
  let state: 'streaming' | 'done' | 'cancelled' | 'error' = 'streaming';

  el.classList.add('is-streaming');
  el.setAttribute('aria-busy', 'true');
  if (reasoning) {
    reasoning.classList.add('is-streaming');
    /* §5.27 规则一：流式态默认展开；计时基准写折叠头 data-icen-reasoning-start（宿主可提前埋点） */
    setReasoningOpen(reasoning, true);
    const head = reasoning.querySelector<HTMLElement>('.icen-ai-reasoning-head');
    if (head && head.dataset.icenReasoningStart == null) head.dataset.icenReasoningStart = String(startedAt);
  }
  clearContinueSlot(msg ?? msgBody ?? el);

  /* 计时文案「思考 Ns」：duration 自折叠头 data-icen-reasoning-start 起算 */
  const fillReasoningTime = (): void => {
    if (!reasoning) return;
    const time = reasoning.querySelector<HTMLElement>('.icen-ai-reasoning-time');
    if (!time) return;
    const head = reasoning.querySelector<HTMLElement>('.icen-ai-reasoning-head');
    const raw = Number(head?.dataset.icenReasoningStart ?? '');
    const t0 = Number.isFinite(raw) && raw > 0 ? raw : startedAt;
    time.textContent = t('aiChat.thinking', { p0: formatDuration(Math.max(0, Date.now() - t0)) });
  };

  /* §5.27 规则二/三：延迟 1000ms 自动收起一次且仅一次；用户手动 toggle 过则永不自动收 */
  const scheduleReasoningAutoClose = (): void => {
    if (!reasoning) return;
    const r = reasoning as ReasoningMarked;
    if (r.__icenReasonUserTouched || r.__icenReasonAutoClosed) return;
    const close = (): void => {
      if (r.__icenReasonUserTouched || r.__icenReasonAutoClosed) return; // 到点复核（1s 窗口内的手动接管）
      r.__icenReasonAutoClosed = true;
      setReasoningOpen(r, false);
    };
    if (typeof window === 'undefined') {
      close(); // SSR/无计时器环境退化为立即收起（旧契约行为）
      return;
    }
    window.setTimeout(close, REASONING_AUTO_CLOSE_MS);
  };

  /* §5.27 aborted 半成品：保留已生成内容，消息尾补「继续生成」槽（→ icen:ai-retry） */
  const appendContinueSlot = (): void => {
    if (typeof document === 'undefined') return;
    const mount = msgBody ?? msg ?? (el.parentElement instanceof HTMLElement ? el.parentElement : null);
    if (!mount || mount.querySelector(':scope > .icen-ai-msg-continue')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icen-ai-msg-continue';
    btn.textContent = t('aiChat.continue');
    btn.addEventListener('click', () => {
      const target = msg ?? btn;
      emit(target, 'icen:ai-retry', { el: target });
    });
    mount.appendChild(btn);
  };

  const settle = (finished: boolean): void => {
    if (state !== 'streaming') return;
    state = finished ? 'done' : 'cancelled';
    el.classList.remove('is-streaming');
    el.removeAttribute('aria-busy');
    if (!reasoning) return;
    reasoning.classList.remove('is-streaming');
    if (!finished) return; // cancel：不折叠、不计耗时（既有语义）
    fillReasoningTime();
    scheduleReasoningAutoClose();
  };

  return {
    append(text) {
      if (state !== 'streaming' || !text) return;
      el.textContent += text;
    },
    done() {
      settle(true);
    },
    cancel() {
      settle(false);
      appendContinueSlot(); // aborted：只给继续钮，不显示错误
    },
    fail() {
      if (state !== 'streaming') return;
      state = 'error';
      el.classList.remove('is-streaming');
      el.removeAttribute('aria-busy');
      el.classList.add('is-error');
      if (reasoning) {
        reasoning.classList.remove('is-streaming');
        fillReasoningTime();
        scheduleReasoningAutoClose(); // fail 同样延迟自动收起
      }
      appendContinueSlot(); // 错误展示归消费方（.is-error / setError），另附继续钮
    },
  };
}

/* ── renderAiMessage：消息渲染原语（spec §4.1；多模态部件见 §10）── */

export interface AiMessageModel {
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** 标准化内容：字符串（纯文本）或部件数组（文字/图片/音频/视频/文件/资源链接） */
  content: AiContent;
  /** 元信息行（"12:04 · 1.2k tok"） */
  meta?: string;
  /** assistant 消息的模型名标签 */
  model?: string;
  /** 错误态：消息挂 .icen-ai-msg--error + 错误文本行 */
  error?: string;
  /** 初始即流式态（正文末文本 span 挂 .is-streaming） */
  streaming?: boolean;
}

export interface AiMessageHandle {
  /** 消息行元素（.icen-ai-msg） */
  el: HTMLElement;
  /** 正文容器（.icen-ai-msg-body）：消费方追加自定义内容的挂载点 */
  body: HTMLElement;
  setMeta(meta: string): void;
  setError(message: string): void;
  /** 在正文末开一个流式文本节点，返回 createAiStream 句柄 */
  stream(): AiStreamHandle;
}

const ROLE_AVATAR: Record<AiMessageModel['role'], string> = {
  user: t('aiChat.roleUser'),
  assistant: 'AI',
  system: t('aiChat.roleSystem'),
  tool: t('aiChat.roleTool'),
};

/** 链接 href 白名单式守卫：放行常规 scheme，拦 javascript: / data:text/html */
function safeHref(uri: string): string | undefined {
  const s = uri.trim().toLowerCase();
  if (s.startsWith('javascript:') || s.startsWith('data:text/html')) return undefined;
  return uri;
}

/** 单个内容部件 → DOM 节点（文本一律 textContent；媒体 src 走 aiContentUrl 归一）。
 *  导出供 ai-tool 的 IO 区复用（MCP 多模态回执；类名 .ai-msg-* 语义即「消息部件」，全局生效）。
 *  前置条件：浏览器环境——本函数无 SSR 守卫，SSR 由调用方守卫覆盖（renderAiMessage /
 *  renderAiToolCall 头部守卫后才会触达此处）。 */
export function renderAiContentPart(part: AiContentPart): HTMLElement | undefined {
  if (part.type === 'text') {
    const span = h('span', 'icen-ai-msg-text');
    span.textContent = part.text;
    if (part.state === 'streaming') span.classList.add('is-streaming');
    return span;
  }
  if (part.type === 'image') {
    const src = aiContentUrl(part);
    if (!src) return undefined;
    const img = document.createElement('img');
    img.className = 'icen-ai-msg-media icen-ai-msg-media--image';
    img.alt = part.alt ?? '';
    img.setAttribute('loading', 'lazy');
    img.setAttribute('src', src);
    return img;
  }
  if (part.type === 'audio') {
    const src = aiContentUrl(part);
    if (!src) return undefined;
    const audio = document.createElement('audio');
    audio.className = 'icen-ai-msg-media icen-ai-msg-media--audio';
    audio.controls = true;
    audio.setAttribute('src', src);
    return audio;
  }
  if (part.type === 'video') {
    const src = aiContentUrl(part);
    if (!src) return undefined;
    const video = document.createElement('video');
    video.className = 'icen-ai-msg-media icen-ai-msg-media--video';
    video.controls = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('src', src);
    return video;
  }
  if (part.type === 'file') {
    const chip = h('span', 'icen-ai-msg-file');
    chip.appendChild(h('span', 'ai-msg-file-name', part.filename ?? t('aiChat.file')));
    /* url 槽可能是 http(s)/data 地址（可下载）或 Files API file_id（不可链） */
    const href = part.url ? safeHref(part.url) : undefined;
    if (href && /^(https?:|data:)/i.test(href)) {
      const a = document.createElement('a');
      a.className = 'icen-ai-msg-file-link';
      a.href = href;
      a.download = part.filename ?? '';
      a.textContent = t('aiChat.download');
      chip.appendChild(a);
    }
    return chip;
  }
  /* resource-link */
  const a = document.createElement('a');
  a.className = 'icen-ai-msg-link';
  const href = safeHref(part.uri);
  if (href) a.href = href;
  a.textContent = part.name ?? part.uri;
  a.title = part.uri;
  return a;
}

/**
 * DOM API 渲染一条消息（append 到容器末尾）：多角色变体 + 多模态部件 + copy/retry
 * 动作钮（委托归 initAiChat）+ meta/model 标签 + 错误变体。返回句柄可继续
 * setMeta / setError / stream()。滚动跟随由 initAiChat 的钉底机制自动处理。
 */
export function renderAiMessage(scrollEl: HTMLElement, model: AiMessageModel): AiMessageHandle {
  /* SSR no-op：不触碰 document，句柄退化为入参引用 + no-op 槽（口径同 renderAiTodo /
   *  renderAiToolCall 的 SSR 分支：原样返回挂载元素、操作静默） */
  if (typeof document === 'undefined') {
    return {
      el: scrollEl,
      body: scrollEl,
      setMeta: () => undefined,
      setError: () => undefined,
      stream: () => createAiStream(scrollEl),
    };
  }
  const row = h('div', `icen-ai-msg icen-ai-msg--${model.role}`);
  const avatar = h('span', 'icen-ai-msg-avatar', ROLE_AVATAR[model.role] ?? '');
  const body = h('div', 'icen-ai-msg-body');
  row.appendChild(avatar);
  row.appendChild(body);

  /* 正文：字符串捷径 / 部件数组 */
  const parts: AiContentPart[] =
    typeof model.content === 'string'
      ? [{ type: 'text', text: model.content } satisfies AiTextPart]
      : model.content;
  for (const part of parts) {
    const node = renderAiContentPart(part);
    if (node) body.appendChild(node);
  }

  /* 模型名标签（assistant）与元信息行 */
  if (model.model) body.appendChild(h('span', 'icen-ai-msg-model', model.model));
  const metaEl = h('div', 'icen-ai-msg-meta');
  if (model.meta != null) metaEl.textContent = model.meta;
  row.appendChild(metaEl);

  /* 动作钮（copy/retry 事件由 initAiChat 委托；CSS 为 22px 方形图标钮——放图标不放文字） */
  const actions = h('div', 'icen-ai-msg-actions');
  const copyBtn = h('button', 'ai-msg-action');
  copyBtn.type = 'button';
  copyBtn.setAttribute('data-icen-ai-msg-action', 'copy');
  copyBtn.setAttribute('aria-label', t('common.copy'));
  const copyIcon = svgIcon(ICON_COPY);
  if (copyIcon) copyBtn.appendChild(copyIcon);
  const retryBtn = h('button', 'ai-msg-action');
  retryBtn.type = 'button';
  retryBtn.setAttribute('data-icen-ai-msg-action', 'retry');
  retryBtn.setAttribute('aria-label', t('common.retry'));
  const retryIcon = svgIcon(ICON_RETRY);
  if (retryIcon) retryBtn.appendChild(retryIcon);
  actions.append(copyBtn, retryBtn);
  row.appendChild(actions);

  const handle: AiMessageHandle = {
    el: row,
    body,
    setMeta(meta: string): void {
      metaEl.textContent = meta;
    },
    setError(message: string): void {
      row.classList.add('icen-ai-msg--error');
      let errEl = row.querySelector<HTMLElement>('.icen-ai-msg-error-text');
      if (!errEl) {
        errEl = h('div', 'icen-ai-msg-error-text');
        errEl.setAttribute('role', 'status');
        body.appendChild(errEl);
      }
      errEl.textContent = message;
    },
    stream(): AiStreamHandle {
      const span = h('span', 'ai-msg-stream-text');
      body.appendChild(span);
      return createAiStream(span);
    },
  };

  if (model.error != null) handle.setError(model.error);
  if (model.streaming) row.classList.add('is-streaming');
  scrollEl.appendChild(row);
  return handle;
}
