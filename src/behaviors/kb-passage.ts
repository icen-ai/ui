/*
 * @icen.ai/ui — Behavior: kb-passage（原文定位查看器：右侧抽屉，与 components/kb-ground.css 配套）
 *
 * DOM 契约（docs/spec/kb-family.md §5.3；createKbPassage 在挂载容器内搭出下列骨架）：
 *   <aside class="kb-passage" hidden role="dialog" aria-modal="false" aria-label="原文定位">
 *     <div class="kb-passage-head">
 *       <span class="kb-passage-icon">…svg…</span>
 *       <span class="kb-passage-titlewrap">
 *         <span class="kb-passage-title">来源标题</span>
 *         <span class="kb-passage-loc">第 3 页 · 块 12–18 · 字符 402–520（KbLocation 三分型位置徽标）</span>
 *       </span>
 *       <button class="kb-passage-close" data-kb-passage-close aria-label="关闭">×</button>
 *     </div>
 *     <div class="kb-passage-body">
 *       <div class="kb-passage-context is-before" hidden>上文…</div>
 *       <div class="kb-passage-text">原文…<mark class="kb-passage-hit" data-hit="0|1|2">命中</mark>…</div>
 *       <div class="kb-passage-context is-after" hidden>下文…</div>
 *       <button class="kb-passage-expand" data-kb-passage-expand hidden>展开上下文</button>
 *     </div>
 *     受限权限（permission ≠ readable）时正文替换为：
 *       <div class="kb-passage-masked">citedText（CSS blur 打码）</div>
 *       <button class="kb-passage-request" data-kb-passage-request>申请访问</button>
 *   </aside>
 *
 * 行为说明：
 *   - open(citation)：渲染标题 / 位置徽标（KbLocation 三分型 char|page|block）；
 *     opts.getDocument 异步或同步取 { content, loc?, contextBefore?, contextAfter? }，
 *     未提供/落空时回落 citedText → snippet；受限权限走打码 + 申请访问（点击派
 *     icen:kb-source-open { source }，宿主据此弹申请流程）；打开派 icen:kb-passage-jump
 *     { citation }；侧栏滑入不打断对话（焦点移入关闭钮，Esc/Tab 圈禁对齐 ai-context 抽屉）
 *   - highlight(terms)：对正文做纯文本遍历 <mark>，多词轮转 data-hit 0/1/2 分色（kb.css 配色）；
 *     open 后异步填充完成前调用会在填充后自动补染
 *   - expand(delta?)：显示 contextBefore/After（当前仅一层上下文，delta 为预留参数）
 *   - close()：滑出后恢复 hidden，派 icen:kb-passage-close {}，焦点还原触发前元素
 *   - 跳转锚定：opts.anchor（容器元素或取值函数）存在时，滚动到容器内 [data-kb-loc]
 *     精确匹配（值 = documentId / citation.id），无精确命中再按 loc.start 数值最近匹配，
 *     命中项加 .is-current（容器内其余项移除）
 *
 * SSR 安全：无 document 时各方法均为 no-op；渲染只写 textContent/createElement（禁 innerHTML），
 * SVG 一律经 kb-core 转发的 svgIcon() 消毒。
 */

import { h, normalizeCitation, svgIcon, getKbSourceType, type KbCitation, type KbLocation } from './kb-core';
import { emitIcen } from './events';
import { KB_ICON_LOCK } from './kb-citation';

/** getDocument 的返回契约：原文 + 定位 + 上下文（受限来源可只给 content 空串并依赖 citedText 回落） */
export interface KbPassageDoc {
  content: string;
  loc?: KbLocation;
  contextBefore?: string;
  contextAfter?: string;
}

/** createKbPassage 的配置项：原文取数 / 跳转锚定容器 / 开合回调 */
export interface KbPassageOptions {
  /** 原文取数（同步返回或 Promise；未提供 / 落空时回落 citation.citedText → snippet） */
  getDocument?: (citation: KbCitation) => KbPassageDoc | null | undefined | Promise<KbPassageDoc | null | undefined>;
  /** 跳转锚定容器（元素或惰性取值函数；提供后 open 时滚动定位 [data-kb-loc]） */
  anchor?: HTMLElement | (() => HTMLElement | null | undefined);
  /** 打开回调（与 icen:kb-passage-jump 事件双通道） */
  onJump?: (citation: KbCitation) => void;
  /** 关闭回调（与 icen:kb-passage-close 事件双通道） */
  onClose?: () => void;
}

/** kb-passage 句柄：open/close/highlight/expand/destroy（函数名冻结，规格 §5.3） */
export interface KbPassageHandle {
  /** 打开抽屉并渲染某条引用的原文定位 */
  open(citation: KbCitation): void;
  /** 关闭抽屉（派 icen:kb-passage-close，焦点还原） */
  close(): void;
  /** 高亮正文命中词（多词轮转 data-hit 0/1/2 分色） */
  highlight(terms: string | string[]): void;
  /** 展开上下文（当前仅一层；delta 预留） */
  expand(delta?: number): void;
  /** 销毁：解绑监听、静默关闭、清空挂载容器 */
  destroy(): void;
}

const CLOSE_FALLBACK_MS = 240;

/** KbLocation 三分型 → 位置徽标文案（span 单位在 kind 上写死，防字符/字节错位） */
function locLabel(loc: KbLocation | undefined): string {
  if (!loc) return '';
  if (loc.kind === 'page') {
    return loc.start === loc.end ? `第 ${loc.start} 页` : `第 ${loc.start}–${loc.end} 页`;
  }
  if (loc.kind === 'block') return `块 ${loc.start}–${loc.end}`;
  const unit = loc.unit === 'byte' ? '字节' : '字符';
  return `${unit} ${loc.start}–${loc.end}`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 是否 Promise 风格返回（getDocument 同异步双态判定） */
function isPromiseLike<T>(v: unknown): v is PromiseLike<T> {
  return !!v && typeof (v as PromiseLike<T>).then === 'function';
}

/**
 * 创建原文定位抽屉（挂载容器 el 内搭骨架，返回句柄）。
 * 句柄方法对无效状态（未打开 / 已销毁）安全 no-op。
 */
export function createKbPassage(el: HTMLElement, opts?: KbPassageOptions): KbPassageHandle {
  if (typeof document === 'undefined') {
    const noop = (): void => undefined;
    return { open: noop, close: noop, highlight: noop, expand: noop, destroy: noop };
  }
  const o = opts ?? {};

  /* ── 骨架（一次搭建，open 只更新内容） ── */
  el.textContent = '';
  const aside = h('aside', 'kb-passage');
  aside.hidden = true;
  aside.setAttribute('role', 'dialog');
  aside.setAttribute('aria-modal', 'false');
  aside.setAttribute('aria-label', '原文定位');

  const head = h('div', 'kb-passage-head');
  const headIcon = h('span', 'kb-passage-icon');
  const headSvg = svgIcon(getKbSourceType(undefined).icon);
  if (headSvg) headIcon.appendChild(headSvg);
  head.appendChild(headIcon);
  const titleWrap = h('span', 'kb-passage-titlewrap');
  const titleEl = h('span', 'kb-passage-title');
  const locEl = h('span', 'kb-passage-loc');
  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(locEl);
  head.appendChild(titleWrap);
  const closeBtn = h('button', 'kb-passage-close', '×');
  closeBtn.type = 'button';
  closeBtn.dataset.kbPassageClose = '';
  closeBtn.setAttribute('aria-label', '关闭原文');
  head.appendChild(closeBtn);
  aside.appendChild(head);

  const body = h('div', 'kb-passage-body');
  const ctxBefore = h('div', 'kb-passage-context is-before');
  ctxBefore.hidden = true;
  const textEl = h('div', 'kb-passage-text');
  const ctxAfter = h('div', 'kb-passage-context is-after');
  ctxAfter.hidden = true;
  const expandBtn = h('button', 'kb-passage-expand', '展开上下文');
  expandBtn.type = 'button';
  expandBtn.dataset.kbPassageExpand = '';
  expandBtn.hidden = true;
  body.appendChild(ctxBefore);
  body.appendChild(textEl);
  body.appendChild(ctxAfter);
  body.appendChild(expandBtn);
  aside.appendChild(body);
  el.appendChild(aside);

  /* ── 状态 ── */
  let destroyed = false;
  let openToken = 0;
  let current: KbCitation | null = null;
  let plainText = '';
  let pendingTerms: string[] | null = null;
  let lastFocus: HTMLElement | null = null;
  let lastLocLabel = '';

  /* ── 正文渲染（打码 / 明文两态） ── */

  function renderPlainText(): void {
    textEl.textContent = plainText;
    if (pendingTerms && pendingTerms.length) {
      applyHighlight(pendingTerms);
    }
  }

  function applyHighlight(terms: string[]): void {
    textEl.textContent = '';
    if (!terms.length || !plainText) {
      textEl.textContent = plainText;
      return;
    }
    /* 长词优先，防短词截断长词命中；组序 ↔ 原词序映射保证 data-hit 分色稳定 */
    const sorted = terms.map((t, i) => ({ re: escapeRe(t), i })).sort((a, b) => b.re.length - a.re.length);
    const re = new RegExp(`(${sorted.map((s) => s.re).join(')|(')})`, 'gi');
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plainText)) !== null) {
      if (m.index > last) textEl.appendChild(document.createTextNode(plainText.slice(last, m.index)));
      let hit = 0;
      for (let g = 1; g <= sorted.length; g++) {
        if (m[g] !== undefined) {
          hit = sorted[g - 1].i % 3;
          break;
        }
      }
      const mark = h('mark', 'kb-passage-hit', m[0]);
      mark.dataset.hit = String(hit);
      textEl.appendChild(mark);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < plainText.length) textEl.appendChild(document.createTextNode(plainText.slice(last)));
  }

  function fillBody(citation: KbCitation, resolved: KbPassageDoc | null | undefined): void {
    const restricted = citation.permission !== 'readable';
    textEl.textContent = '';
    ctxBefore.textContent = '';
    ctxAfter.textContent = '';
    ctxBefore.hidden = true;
    ctxAfter.hidden = true;
    expandBtn.hidden = true;

    if (restricted) {
      /* 受限：citedText 打码 + 申请访问（原文不下发到端侧，blur 只是视觉层） */
      const masked = h('div', 'kb-passage-masked', citation.citedText ?? citation.snippet ?? '内容受限');
      const request = h('button', 'kb-passage-request', '申请访问');
      request.type = 'button';
      request.dataset.kbPassageRequest = '';
      const lockSvg = svgIcon(KB_ICON_LOCK);
      if (lockSvg) request.prepend(lockSvg);
      request.addEventListener('click', () => {
        emitIcen(aside, 'icen:kb-source-open', { source: citation });
      });
      textEl.appendChild(masked);
      textEl.appendChild(request);
      plainText = '';
      pendingTerms = null;
      return;
    }

    plainText = resolved?.content ?? citation.citedText ?? citation.snippet ?? '（无原文）';
    renderPlainText();
    /* loc 徽标补全：citation.loc 缺席时采用文档侧定位 */
    const locText = locLabel(citation.loc ?? resolved?.loc);
    if (locText && locText !== lastLocLabel) {
      lastLocLabel = locText;
      locEl.textContent = locText;
    }
    const before = resolved?.contextBefore?.trim();
    const after = resolved?.contextAfter?.trim();
    const hasCtx = !!(before || after);
    expandBtn.hidden = !hasCtx;
    if (hasCtx) {
      if (before) ctxBefore.textContent = before;
      if (after) ctxAfter.textContent = after;
    }
  }

  /* ── 跳转锚定 ── */

  function anchorTo(citation: KbCitation): void {
    const anchorEl = typeof o.anchor === 'function' ? o.anchor() : o.anchor;
    if (!anchorEl || typeof anchorEl.querySelector !== 'function') return;
    const nodes = Array.from(anchorEl.querySelectorAll<HTMLElement>('[data-kb-loc]'));
    if (nodes.length === 0) return;
    const key = citation.documentId || citation.id;
    let target = nodes.find((n) => n.dataset.kbLoc === key);
    if (!target && citation.loc) {
      /* 数值最近匹配：data-kb-loc 形如 "start:end" 或单值，取与 loc.start 最近者 */
      let best: HTMLElement | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const n of nodes) {
        const raw = n.dataset.kbLoc ?? '';
        const start = Number(raw.split(':')[0]);
        if (!Number.isFinite(start)) continue;
        const dist = Math.abs(start - citation.loc.start);
        if (dist < bestDist) {
          bestDist = dist;
          best = n;
        }
      }
      target = best ?? undefined;
    }
    if (!target) return;
    for (const n of nodes) n.classList.toggle('is-current', n === target);
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ── 开合 + 焦点管理（对齐 ai-context 抽屉行为模式） ── */

  function isOpen(): boolean {
    return !aside.hidden || aside.classList.contains('is-open');
  }

  function finishHide(restoreFocus: boolean): void {
    aside.hidden = true;
    aside.classList.remove('is-open');
    if (restoreFocus && lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function trapFocus(ke: KeyboardEvent): void {
    const focusables = Array.from(
      aside.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((n) => !n.hidden && n.getAttribute('aria-hidden') !== 'true');
    if (focusables.length === 0) {
      ke.preventDefault();
      aside.focus?.();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (ke.shiftKey) {
      if (active === first || !aside.contains(active)) {
        ke.preventDefault();
        last.focus();
      }
    } else if (active === last || !aside.contains(active)) {
      ke.preventDefault();
      first.focus();
    }
  }

  const onKeydown = (e: Event): void => {
    if (destroyed || !isOpen()) return;
    const ke = e as KeyboardEvent;
    if (ke.key === 'Escape') {
      ke.preventDefault();
      handle.close();
    } else if (ke.key === 'Tab') {
      trapFocus(ke);
    }
  };
  document.addEventListener('keydown', onKeydown);

  const onCloseClick = (): void => handle.close();
  closeBtn.addEventListener('click', onCloseClick);

  const onExpandClick = (): void => handle.expand();
  expandBtn.addEventListener('click', onExpandClick);

  const handle: KbPassageHandle = {
    open(citation: KbCitation): void {
      if (destroyed) return;
      current = normalizeCitation(citation);
      openToken++;
      const token = openToken;

      titleEl.textContent = current.title;
      const iconSvg = svgIcon(getKbSourceType(current.kind).icon);
      if (iconSvg) {
        headIcon.textContent = '';
        headIcon.appendChild(iconSvg);
      }
      lastLocLabel = locLabel(current.loc);
      locEl.textContent = lastLocLabel;

      /* 正文：同步直染，异步先占位（fill 时 token 校验防旧请求覆盖新打开） */
      textEl.textContent = '';
      textEl.appendChild(h('span', 'kb-meta', '加载中…'));
      let pending = false;
      let syncDoc: KbPassageDoc | null = null;
      try {
        const r = o.getDocument?.(current) ?? null;
        if (isPromiseLike<KbPassageDoc | null | undefined>(r)) {
          pending = true;
          void r.then(
            (doc_) => {
              if (destroyed || token !== openToken) return;
              fillBody(current as KbCitation, doc_ ?? null);
            },
            () => {
              if (destroyed || token !== openToken) return;
              fillBody(current as KbCitation, null);
            },
          );
        } else {
          syncDoc = r;
        }
      } catch {
        syncDoc = null;
      }
      if (!pending) fillBody(current, syncDoc);

      if (!isOpen()) {
        lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        aside.hidden = false;
        void aside.offsetWidth; /* reflow：滑入 transition 从 translateX(100%) 起步 */
        aside.classList.add('is-open');
      }
      closeBtn.focus();
      anchorTo(current);
      emitIcen(aside, 'icen:kb-passage-jump', { citation: current });
      o.onJump?.(current);
    },

    close(): void {
      if (destroyed || (!aside.classList.contains('is-open') && aside.hidden)) return;
      aside.classList.remove('is-open');
      emitIcen(aside, 'icen:kb-passage-close', {});
      o.onClose?.();
      current = null;
      pendingTerms = null;
      let done = false;
      const onEnd = (): void => {
        if (done) return;
        done = true;
        aside.removeEventListener('transitionend', onEnd);
        finishHide(true);
      };
      aside.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, CLOSE_FALLBACK_MS); /* reduced-motion / 无 transition 兜底 */
    },

    highlight(terms: string | string[]): void {
      if (destroyed) return;
      const list = (Array.isArray(terms) ? terms : [terms]).map((t) => t.trim()).filter(Boolean);
      pendingTerms = list.length ? list : null;
      /* 正文未填充（异步取数中）时只记账，fill 完成后由 renderPlainText 补染 */
      if (current && current.permission === 'readable' && plainText) applyHighlight(list);
    },

    expand(_delta?: number): void {
      if (destroyed || !current) return;
      /* 当前仅一层上下文（contextBefore/After 一次性展示，天然幂等）；delta 为层级预留参数 */
      ctxBefore.hidden = false;
      ctxAfter.hidden = false;
      expandBtn.hidden = true;
      aside.classList.add('is-expanded');
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('keydown', onKeydown);
      closeBtn.removeEventListener('click', onCloseClick);
      expandBtn.removeEventListener('click', onExpandClick);
      finishHide(false); /* 静默关闭：不派事件、不抢焦点 */
      current = null;
      plainText = '';
      pendingTerms = null;
      el.textContent = '';
    },
  };

  return handle;
}
