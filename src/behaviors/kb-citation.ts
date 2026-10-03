/*
 * @icen.ai/ui — Behavior: kb-citation（行内引用角标 + hover 引用卡，与 components/kb-ground.css 配套）
 *
 * DOM 契约（docs/spec/kb-family.md §5.1）：
 *   正文角标（renderCitationText / renderCitationMark 产物）：
 *   <button class="kb-citation" type="button" data-cite="3">3</button>
 *
 *   无效编号降级（sources 已提供且 n 查无来源 ——「不信任模型生成编号」纪律）：
 *   <sup class="kb-citation is-dead" data-cite="9">9</sup>   ← 灰显、不可点
 *
 *   hover ≥300ms 引用卡（initKbCitation 委托产生，经 popover portal 挂 body）：
 *   <div class="kb-citation-card" role="tooltip">
 *     <div class="kb-citation-card-head"><span class="kb-citation-card-icon">svg</span>
 *       <span class="kb-citation-card-title">标题</span></div>
 *     <div class="kb-citation-card-domain">docs.example.com</div>
 *     <div class="kb-quote kb-citation-card-quote [kb-citation-card-masked]">citedText ≤150 字</div>
 *     <div class="kb-citation-card-badges">
 *       <span class="kb-badge kb-badge--official">官方</span>
 *       <span class="kb-badge kb-badge--stale"><i class="kb-dot is-warn"></i>3 天前</span>
 *       <span class="kb-badge kb-badge--restricted">🔒 受限</span>   ← 受限时 quote 打码
 *     </div>
 *   </div>
 *
 * 行为说明：
 *   - renderCitationMark(n)：造单枚活角标（button 语义，Enter/Space 原生可点，aria-label「来源 n」）
 *   - renderCitationText(el, text, sources?)：kb-core parseInlineCitations 把含 [3] 的文本切成
 *     文本节点 + 角标的混合流（流式安全：delta 边界的 "[3" 自然留在文本段，增量文本重渲该 el 即可）；
 *     sources 提供时写入来源注册表，超界编号落 .is-dead
 *   - initKbCitation(root?, opts?)：root 级委托（幂等 WeakSet 标记 + 返回销毁函数）：
 *     click → icen:kb-citation-open { citation }（查无数据时派合成占位 citation，不吞交互）；
 *     hover ≥ opts.hoverDelay（默认 300ms）且 opts.getCard / 来源注册表能给出数据 →
 *     openPopover 浮 .kb-citation-card（PanelSizing 契约；离开角标即收卡；点击角标也先收卡）
 *   - setKbCitationSources / getKbCitationSources：模块级来源注册表（答案区与来源列表共享数据源）
 *
 * 引用白名单纪律（spec §9.0-6，评审必查）：citation 只能生成自过滤后检索集合——
 *   禁止「LLM 见过、UI 滤引用」（制造可感知不一致 = citation leak：模型答案里出现过、
 *   引用区却查无此源的错位本身就是泄露信号）。权限收回后的历史引用呈现中性
 *   「来源已不可用」态（.is-revoked），不删不留裸链；hover 卡对 revoked 来源
 *   （citation 上 revoked?: true，非 KbCitation 契约字段，局部窄化读取）不再渲染 citedText。
 *
 * SSR 安全：无 document 时 render* 原样返回 el、init* 返回 no-op 销毁；
 * 渲染只写 textContent/createElement（禁 innerHTML），SVG 一律经 kb-core 转发的 svgIcon() 消毒。
 */

import {
  h,
  normalizeCitation,
  parseInlineCitations,
  relativeTime,
  svgIcon,
  getKbSourceType,
  type KbCitation,
} from './kb-core';
import { emitIcen } from './events';
import { closePopover, openPopover } from './popover';

/* ── 共享常量与图标（证据域 ground 的公共小件，供 kb-sources / kb-passage 复用） ── */

/** 来源新鲜度阈值：date 距今超过 90 天视为 stale（来源列表/引用卡/冲突组共用） */
export const KB_STALE_DAYS = 90;

/** 受限权限徽标的锁形线性图标（24 viewBox，stroke 1.5，经 svgIcon 消毒后插入） */
export const KB_ICON_LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

const DAY_MS = 86_400_000;
const HOVER_DELAY_MS = 300;
const CITE_TEXT_MAX = 150;

/** 判断引用是否过期（date 缺失或不可解析时返回 false —— 无证据不告警的诚实纪律） */
export function isKbCitationStale(citation: KbCitation, now: Date = new Date()): boolean {
  if (!citation.date) return false;
  const t = Date.parse(citation.date);
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t > KB_STALE_DAYS * DAY_MS;
}

/** 取来源 URL 的域名（无 URL / 非法 URL 返回空串；引用卡与来源列表共用） */
export function kbDomainOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/* ── 来源注册表（模块级：一处登记，角标/hover 卡/来源列表共享） ── */

let registrySources: KbCitation[] = [];

/** 覆盖来源注册表（renderCitationText 传 sources 时自动调用；宿主也可手动喂数据） */
export function setKbCitationSources(sources: KbCitation[]): void {
  registrySources = Array.isArray(sources) ? sources.map(normalizeCitation) : [];
}

/** 读取来源注册表当前快照（调试 / 测试 / 二次渲染用） */
export function getKbCitationSources(): KbCitation[] {
  return registrySources.slice();
}

/** 编号 → 来源：优先显式 index 字段，否则按 1 基数组位；查无返回 undefined */
function lookupCitation(pool: KbCitation[], n: number): KbCitation | undefined {
  if (!pool.length) return undefined;
  const byIndex = pool.find((c) => c.index === n);
  if (byIndex) return byIndex;
  return n >= 1 && n <= pool.length ? pool[n - 1] : undefined;
}

/** 查无来源时的占位 citation（保住交互链路：点击仍可派事件，宿主自行取数补全） */
function syntheticCitation(n: number): KbCitation {
  return normalizeCitation({ id: `cite-${n}`, index: n, title: `来源 ${n}` });
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/* ── 角标构件 ── */

/** 造一枚行内引用角标 `<button class="kb-citation" data-cite="{n}">`（有效性由渲染端对照来源数降级）；SSR 无元素可造，返回 null */
export function renderCitationMark(n: number): HTMLButtonElement | null {
  if (typeof document === 'undefined') return null;
  const btn = h('button', 'kb-citation', String(n));
  btn.type = 'button';
  btn.dataset.cite = String(n);
  btn.setAttribute('aria-label', `来源 ${n}`);
  return btn;
}

/** 内部：带有效性判定的角标（dead 时降级为不可点的 sup，保持与活角标同款视觉重量） */
function citationMark(n: number, pool: KbCitation[] | undefined): HTMLElement {
  if (pool && !lookupCitation(pool, n)) {
    const sup = h('sup', 'kb-citation is-dead', String(n));
    sup.dataset.cite = String(n);
    sup.setAttribute('aria-hidden', 'true'); /* 无效编号是装饰残留，不进可读流 */
    return sup;
  }
  /* SSR 下 renderCitationMark 返回 null：dead 分支的 sup 同样依赖 document，此处一并收敛为 sup 文本兜底 */
  return renderCitationMark(n) ?? h('sup', 'kb-citation is-dead', String(n));
}

/**
 * 把含 [3] 的文本渲染成「文本节点 + 角标」混合流（流式安全：增量文本整体重渲该 el）。
 * sources 提供时写入来源注册表（hover 卡数据源）并对超界编号渲染 .is-dead。
 */
export function renderCitationText(el: HTMLElement, text: string, sources?: KbCitation[]): HTMLElement {
  if (typeof document === 'undefined') return el;
  const pool = sources && sources.length ? sources.map(normalizeCitation) : undefined;
  if (pool) setKbCitationSources(pool);
  el.textContent = '';
  for (const seg of parseInlineCitations(text ?? '')) {
    if (typeof seg.n === 'number') el.appendChild(citationMark(seg.n, pool));
    else if (seg.text) el.appendChild(document.createTextNode(seg.text));
  }
  return el;
}

/* ── hover 引用卡 ── */

function buildBadgeRow(citation: KbCitation, now: Date): HTMLElement {
  const row = h('div', 'kb-citation-card-badges');
  if (citation.official) row.appendChild(h('span', 'kb-badge kb-badge--official', '官方'));
  if (citation.date) {
    const b = h('span', 'kb-badge', relativeTime(citation.date, now));
    if (isKbCitationStale(citation, now)) {
      b.classList.add('kb-badge--stale');
      b.prepend(h('i', 'kb-dot is-warn'));
    }
    row.appendChild(b);
  }
  if (citation.permission !== 'readable') {
    const lock = h('span', 'kb-badge kb-badge--restricted', '受限');
    const svg = svgIcon(KB_ICON_LOCK);
    if (svg) lock.prepend(svg);
    row.appendChild(lock);
  }
  return row;
}

/** 组装 hover 引用卡（favicon 位用来源类型图标；受限时 citedText 打码；
 * revoked 来源（权限收回后的历史引用，spec §9.0-6）附中性「来源已不可用」chip，citedText 不渲染） */
function buildCitationCard(citation: KbCitation, now: Date): HTMLElement {
  const card = h('div', 'kb-citation-card');
  card.setAttribute('role', 'tooltip');

  /* revoked 非 KbCitation 契约字段：局部窄化读取，不扩 kb-core 类型（宿主数据侧自行标注） */
  const revoked = (citation as { revoked?: boolean }).revoked === true;

  const head = h('div', 'kb-citation-card-head');
  const icon = h('span', 'kb-citation-card-icon');
  const svg = svgIcon(getKbSourceType(citation.kind).icon);
  if (svg) icon.appendChild(svg);
  head.appendChild(icon);
  head.appendChild(h('span', 'kb-citation-card-title', citation.title));
  /* 中性 chip（faint，禁红）：「不知道」与「不能说」不可区分的呈现态——不删不留裸链 */
  if (revoked) head.appendChild(h('span', 'kb-chip is-revoked', '来源已不可用'));
  card.appendChild(head);

  const domain = kbDomainOf(citation.url) || getKbSourceType(citation.kind).label;
  card.appendChild(h('div', 'kb-citation-card-domain', domain));

  if (!revoked) {
    const quoteText = clip(citation.citedText ?? citation.snippet ?? '', CITE_TEXT_MAX);
    if (quoteText) {
      const quote = h('div', 'kb-quote kb-citation-card-quote', quoteText);
      if (citation.permission !== 'readable') quote.classList.add('kb-citation-card-masked');
      card.appendChild(quote);
    }
  }

  const badges = buildBadgeRow(citation, now);
  if (badges.childElementCount > 0) card.appendChild(badges);
  return card;
}

/* ── init：委托 click + hover 防抖浮卡 ── */

/** initKbCitation 的配置项：来源表 / hover 卡数据源 / 浮卡防抖时长 */
export interface KbCitationInitOptions {
  /** 来源表（按编号解析角标；提供后超界编号在渲染端落 .is-dead） */
  sources?: KbCitation[];
  /** hover 卡数据源：入参为注册表查得（或合成）的 citation，返回增强数据；返回 null/undefined 落回注册表结果 */
  getCard?: (citation: KbCitation) => KbCitation | null | undefined;
  /** hover 浮卡防抖（默认 300ms） */
  hoverDelay?: number;
}

interface HoverState {
  timer: ReturnType<typeof setTimeout> | null;
  panel: HTMLElement | null;
  mark: HTMLElement | null;
}

/* 模块级单例：同一时刻至多一张引用卡（跨 init 作用域共用，后悬停者接管） */
const hover: HoverState = { timer: null, panel: null, mark: null };

function cancelHoverTimer(): void {
  if (hover.timer) {
    clearTimeout(hover.timer);
    hover.timer = null;
  }
}

function closeHoverCard(): void {
  cancelHoverTimer();
  hover.mark = null;
  if (hover.panel) {
    const panel = hover.panel;
    hover.panel = null;
    closePopover(panel); /* onClose 回调里 panel.remove() */
  }
}

const initedScopes = new WeakSet<object>();

/**
 * 初始化引用角标交互（root 级委托；幂等 WeakSet 标记，返回销毁函数，销毁后可重新 init）。
 * click → icen:kb-citation-open { citation }；hover ≥300ms 且有数据 → openPopover 浮引用卡。
 */
export function initKbCitation(root?: ParentNode, opts?: KbCitationInitOptions): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const key: object = scope;
  if (initedScopes.has(key)) return () => undefined;
  initedScopes.add(key);
  const target = scope as ParentNode & EventTarget;

  const poolOf = (): KbCitation[] =>
    opts?.sources && opts.sources.length ? opts.sources : registrySources;

  /** hover 卡数据：注册表命中，或 getCard 增强；两者皆无 → 不浮卡 */
  const cardDataFor = (n: number): KbCitation | null => {
    const found = lookupCitation(poolOf(), n) ?? null;
    if (opts?.getCard) return opts.getCard(found ?? syntheticCitation(n)) ?? found;
    return found;
  };

  const citeNum = (mark: Element): number => {
    const n = Number(mark.getAttribute('data-cite'));
    return Number.isFinite(n) && n >= 1 ? n : 0;
  };

  const showCard = (mark: HTMLElement): void => {
    const n = citeNum(mark);
    if (n < 1) return;
    const data = cardDataFor(n);
    if (!data) return;
    const panel = buildCitationCard(data, new Date());
    hover.panel = panel;
    openPopover(panel, {
      anchor: mark,
      side: 'bottom',
      align: 'start',
      sizing: { minWidth: 280, maxWidth: 340, maxHeight: 360 },
      onClose: () => {
        panel.remove();
        if (hover.panel === panel) hover.panel = null;
      },
    });
  };

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    const mark = t?.closest<HTMLElement>('.kb-citation');
    if (!mark || mark.classList.contains('is-dead')) return;
    const n = citeNum(mark);
    if (n < 1) return;
    closeHoverCard();
    const citation =
      cardDataFor(n) ?? lookupCitation(poolOf(), n) ?? syntheticCitation(n);
    emitIcen(mark, 'icen:kb-citation-open', { citation });
  };

  const onPointerOver = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    const mark = t?.closest<HTMLElement>('.kb-citation:not(.is-dead)');
    if (!mark || hover.mark === mark) return;
    closeHoverCard();
    hover.mark = mark;
    hover.timer = setTimeout(() => {
      hover.timer = null;
      if (hover.mark === mark && mark.isConnected) showCard(mark);
    }, opts?.hoverDelay ?? HOVER_DELAY_MS);
  };

  const onPointerOut = (e: Event): void => {
    if (!hover.mark) return;
    const rt = (e as PointerEvent).relatedTarget;
    if (rt instanceof Node && hover.mark.contains(rt)) return;
    closeHoverCard();
  };

  target.addEventListener('click', onClick);
  target.addEventListener('pointerover', onPointerOver);
  target.addEventListener('pointerout', onPointerOut);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('pointerover', onPointerOver);
    target.removeEventListener('pointerout', onPointerOut);
    initedScopes.delete(key);
    if (hover.mark && scope instanceof Node && scope.contains(hover.mark)) closeHoverCard();
  };
}
