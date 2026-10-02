/*
 * @icen.ai/ui — Behavior: kb-trace（RAG/LLM 调用链 span 树，观测治理域；与 components/kb-ops.css 配套）
 *
 * DOM 契约（类名固定，docs/spec/kb-family.md §5.19）：
 *   <div class="kb-trace">
 *     <div class="kb-span kb-span--child is-<kind> is-<status> [is-open]" data-span-id="…" data-parent-id="…"
 *          style="--depth:1" tabindex="0" role="button" aria-expanded="false" aria-controls="kb-trace-body-N">
 *       <span class="kb-span-caret" aria-hidden="true"></span>   ← 有子 span 才显示（占位保持对齐）
 *       <span class="kb-span-kind">检索</span>                    ← kbSpanKindLabel；retrieval 为 accent 线框，其余中性
 *       <span class="kb-span-name">hybrid search</span>
 *       <i class="kb-span-bar" style="width:34%"></i>            ← 宽度 = elapsedMs / 同级最大；error 红 / running 脉冲
 *       <span class="kb-num">212ms</span>                        ← <1000 显 ms，否则秒保留 1 位；无值 '—'
 *     </div>
 *     <div class="kb-trace-body kb-fold-body" data-for="<spanId>" style="--depth:1" hidden>
 *       <div class="kb-trace-detail">detail 文本</div>
 *       <div class="kb-trace-usage"><span class="kb-num">↑ 1.2k tok</span>…<span class="kb-num">$0.0012</span></div>
 *       <div class="kb-trace-hits">
 *         <div class="kb-trace-hit">
 *           <span class="kb-trace-hit-rank kb-num">1</span>
 *           <span class="kb-trace-hit-title">标题</span>
 *           <span class="kb-score"><span class="kb-score-bar"><i style="width:87%"></i></span>
 *             <span class="kb-score-value">0.87</span></span>
 *         </div>…
 *       </div>
 *       <div class="kb-trace-error">错误文本（红）</div>
 *     </div>
 *     …
 *   </div>
 *
 * 树形规则：
 *   - 数据先经 kb-core normalizeSpans（父先子后；--depth = 祖先链长度）；
 *   - 孤儿 span（parentId 无匹配）按顶层渲染（depth 0、参与顶层同级耗时归一）；
 *   - 折叠语义：行可见 = 祖先链全开；折叠时子 span 与自身展开体一并隐藏；
 *   - 默认展开集：status=error / running 初始展开（与 ai 族 Copilot 模式同构），其余初始折叠。
 *
 * 事件（emitIcen，bubbles）：
 *   icen:kb-trace-select { spanId }         — 行 click（选中/定位该 span）
 *   icen:kb-trace-toggle  { spanId, open }  — 折叠切换（click / Enter / Space）
 *
 * initKbTrace：document 级委托（click + keydown），幂等标记 + 销毁函数；委托挂
 * document，动态插入的 .kb-trace 免重跑 init（root 参数仅保持 kb 族 API 对称）。
 * SSR 下 no-op；渲染只写 textContent/createElement（禁 innerHTML，本组件无 SVG）。
 */

import {
  formatScore,
  h,
  kbSpanKindLabel,
  normalizeSpans,
  scorePercent,
  type KbRetrievalHit,
  type KbSpan,
} from './kb-core';
import { emitIcen } from './events';

/** 顶层（含孤儿）分组的内部 key（不可能与真实 span id 冲突） */
const ROOT_KEY = '\u0000root';

/** ms → '212ms' / '1.4s'（<1000 显 ms，否则秒保留 1 位；无值 '—'） */
function fmtElapsed(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** 祖先链长度（防环 guard 与 kb-core normalizeSpans 同口径）；父不存在按顶层 0 */
function depthOfSpan(span: KbSpan, byId: Map<string, KbSpan>, guard = 0): number {
  if (guard > 32 || !span.parentId) return 0;
  const parent = byId.get(span.parentId);
  return parent ? depthOfSpan(parent, byId, guard + 1) + 1 : 0;
}

/** 迷你命中行（复用 kb.css 的 .kb-score 序数条；分数 null → 不渲染条 + '—'） */
function buildHitRow(hit: KbRetrievalHit, rank: number): HTMLElement {
  const row = h('div', 'kb-trace-hit');
  row.append(h('span', 'kb-trace-hit-rank kb-num', String(rank)));
  row.append(h('span', 'kb-trace-hit-title', hit.title || hit.snippet || hit.chunkId));
  const score = h('span', 'kb-score');
  const bar = h('span', 'kb-score-bar');
  const fill = h('i'); /* 样式走 kb.css 的 .kb-score-bar > i */
  const pct = scorePercent(hit.score, hit.scoreKind);
  fill.style.width = pct != null ? `${pct}%` : '0%';
  bar.append(fill);
  score.append(bar, h('span', 'kb-score-value', formatScore(hit.score)));
  row.append(score);
  return row;
}

/** 展开体：detail / usage / hits（retrieval）/ error；全空返回 null（行不可展开） */
function buildSpanBody(span: KbSpan): HTMLElement | null {
  const usage = span.usage;
  const hasUsage = !!(usage && (usage.inputTokens != null || usage.outputTokens != null || usage.costUsd != null));
  const hasHits = span.kind === 'retrieval' && !!span.hits && span.hits.length > 0;
  if (!span.detail && !hasUsage && !hasHits && !span.error) return null;
  const body = h('div', 'kb-trace-body kb-fold-body');
  if (span.detail) body.append(h('div', 'kb-trace-detail', span.detail));
  if (hasUsage && usage) {
    const u = h('div', 'kb-trace-usage');
    if (usage.inputTokens != null) u.append(h('span', 'kb-num', `↑ ${usage.inputTokens} tok`));
    if (usage.outputTokens != null) u.append(h('span', 'kb-num', `↓ ${usage.outputTokens} tok`));
    if (usage.costUsd != null) u.append(h('span', 'kb-num', `$${formatScore(usage.costUsd, 4)}`));
    body.append(u);
  }
  if (hasHits && span.hits) {
    const wrap = h('div', 'kb-trace-hits');
    wrap.append(h('div', 'kb-trace-hits-label kb-meta', `命中 ${span.hits.length}`));
    span.hits.forEach((hit, i) => wrap.append(buildHitRow(hit, i + 1)));
    body.append(wrap);
  }
  if (span.error) body.append(h('div', 'kb-trace-error', span.error));
  return body;
}

/** 重算树可见性：行可见 = 祖先链全开；body 跟随所属行（行隐藏或自身折叠即隐藏） */
function applyTraceVisibility(trace: HTMLElement): void {
  const rows = Array.from(trace.querySelectorAll<HTMLElement>(':scope > .kb-span'));
  const byId = new Map(rows.map((r) => [r.dataset.spanId ?? '', r] as const));
  for (const row of rows) {
    const parent = row.dataset.parentId ? byId.get(row.dataset.parentId) : undefined;
    row.hidden = parent ? parent.hidden || parent.getAttribute('aria-expanded') === 'false' : false;
    const next = row.nextElementSibling;
    if (next instanceof HTMLElement && next.classList.contains('kb-trace-body')) {
      next.hidden = row.hidden || row.getAttribute('aria-expanded') === 'false';
    }
  }
}

/** 切换某行展开态（不可展开的行 no-op）：切类 + 重算可见性 + 派发 toggle 事件 */
function toggleSpanRow(trace: HTMLElement, row: HTMLElement): void {
  if (row.getAttribute('aria-expanded') == null) return;
  const open = row.getAttribute('aria-expanded') !== 'true';
  row.setAttribute('aria-expanded', String(open));
  row.classList.toggle('is-open', open);
  applyTraceVisibility(trace);
  emitIcen(trace, 'icen:kb-trace-toggle', { spanId: row.dataset.spanId ?? '', open });
}

/** span 序号发生器（aria-controls 唯一 id 用） */
let bodyUid = 0;

/**
 * 渲染 trace span 树（快照：整体替换 el 内容）。返回挂载容器 el。
 * spans 建议先经 kb-core normalizeSpans；本函数内部会再归一一次以保证父先子后与 kind/status 合法。
 */
export function renderKbTrace(el: HTMLElement, spans: KbSpan[]): HTMLElement {
  if (typeof document === 'undefined') return el;
  const list = normalizeSpans(spans as unknown as Array<Record<string, unknown>>);
  el.className = 'kb-trace';
  el.replaceChildren();
  if (!list.length) {
    el.append(h('div', 'kb-empty', '暂无调用链数据'));
    return el;
  }

  const byId = new Map(list.map((s) => [s.id, s] as const));
  const childIds = new Set(list.filter((s) => s.parentId && byId.has(s.parentId)).map((s) => s.parentId));
  /* 同级（含顶层/孤儿）最大耗时 → bar 宽度分母 */
  const maxByParent = new Map<string, number>();
  for (const s of list) {
    const key = s.parentId && byId.has(s.parentId) ? s.parentId : ROOT_KEY;
    const v = typeof s.elapsedMs === 'number' && s.elapsedMs > 0 ? s.elapsedMs : 0;
    if (v > (maxByParent.get(key) ?? 0)) maxByParent.set(key, v);
  }

  for (const span of list) {
    const depth = depthOfSpan(span, byId);
    const key = span.parentId && byId.has(span.parentId) ? span.parentId : ROOT_KEY;
    const max = maxByParent.get(key) ?? 0;
    const ms = typeof span.elapsedMs === 'number' && span.elapsedMs > 0 ? span.elapsedMs : 0;
    const width = max > 0 && ms > 0 ? Math.max(2, (ms / max) * 100) : 0;
    const hasKids = childIds.has(span.id);
    const body = buildSpanBody(span);
    const expandable = hasKids || body != null;
    const open = expandable && (span.status === 'error' || span.status === 'running');

    const row = h('div', `kb-span kb-span--${depth > 0 ? 'child' : 'root'} is-${span.kind} is-${span.status}`);
    if (open) row.classList.add('is-open');
    row.dataset.spanId = span.id;
    if (span.parentId) row.dataset.parentId = span.parentId;
    row.style.setProperty('--depth', String(depth));
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    if (expandable) row.setAttribute('aria-expanded', String(open));

    const caret = h('span', 'kb-span-caret');
    caret.setAttribute('aria-hidden', 'true');
    caret.hidden = !hasKids; /* 有子才显 */
    row.append(caret,
      h('span', 'kb-span-kind', kbSpanKindLabel(span.kind)),
      h('span', 'kb-span-name', span.name));
    const bar = h('i', 'kb-span-bar');
    bar.style.width = `${width}%`;
    row.append(bar, h('span', 'kb-num', fmtElapsed(span.elapsedMs)));
    el.append(row);

    if (body) {
      body.dataset.for = span.id;
      body.style.setProperty('--depth', String(depth));
      if (expandable) {
        body.id = `kb-trace-body-${++bodyUid}`;
        row.setAttribute('aria-controls', body.id);
      }
      body.hidden = !open;
      el.append(body);
    }
  }

  applyTraceVisibility(el);
  return el;
}

/* ── init：document 级委托（click + Enter/Space），幂等 + 销毁 ── */

let traceInit = false;
let traceTeardown: (() => void) | null = null;

/**
 * 初始化 trace 树交互：document 级委托（click 选中+折叠；Enter/Space 展开聚焦行）。
 * 幂等（重复调用安全）；返回销毁函数（解绑委托并复位幂等标记，销毁后可重新 init）。
 * 委托挂 document 级：动态插入的 .kb-trace 自动接管，无需重跑 init（root 参数仅保持 kb 族 API 对称）。
 */
export function initKbTrace(root?: ParentNode): () => void {
  if (typeof document === 'undefined' || traceInit) return () => {};
  traceInit = true;

  const rowOf = (e: Event): { row: HTMLElement; trace: HTMLElement } | null => {
    const target = e.target;
    if (!(target instanceof Element)) return null;
    const row = target.closest<HTMLElement>('.kb-span');
    if (!row) return null;
    const trace = row.closest<HTMLElement>('.kb-trace');
    return trace ? { row, trace } : null;
  };

  const onClick = (e: MouseEvent): void => {
    const hit = rowOf(e);
    if (!hit) return;
    emitIcen(hit.trace, 'icen:kb-trace-select', { spanId: hit.row.dataset.spanId ?? '' });
    toggleSpanRow(hit.trace, hit.row);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const hit = rowOf(e);
    if (!hit || hit.row !== e.target) return; /* 只响应行本体聚焦（行 tabindex=0） */
    e.preventDefault();
    toggleSpanRow(hit.trace, hit.row);
  };

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  traceTeardown = (): void => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    traceInit = false;
    traceTeardown = null;
  };
  return traceTeardown;
}
