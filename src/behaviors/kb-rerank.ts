import { createIcon } from './icons';
/*
 * @icen.ai/ui — Behavior: kb-rerank（rerank A/B 对比，与 components/kb-search.css 配套）
 * 市场空白组件（docs/spec/kb-family.md §5.13）：直观回答「rerank 到底改了什么」。
 *
 * DOM 契约（render 快照渲染，返回挂载容器）：
 *   <div class="icen-kb-rerank" data-icen-kb-rerank [.is-off]>
 *     <div class="icen-kb-rerank-head">
 *       <span class="icen-kb-badge kb-rerank-model">…模型名…</span>
 *       <span class="icen-kb-rerank-switch-label">重排对比</span>
 *       <button class="icen-kb-switch" role="switch" aria-checked="true" data-icen-kb-rerank-toggle></button>
 *     </div>
 *     <div class="icen-kb-rerank-grid">                        ← icen-grid 1fr 56px 1fr
 *       <div class="icen-kb-rerank-colhead">重排前 <span class="icen-kb-chip icen-kb-chip--kind">cosine</span></div>
 *       <div class="icen-kb-rerank-colhead icen-kb-rerank-colhead--delta">Δ</div>
 *       <div class="icen-kb-rerank-colhead">重排后 <span class="icen-kb-chip icen-kb-chip--kind">rerank</span></div>
 *       <div class="icen-kb-rerank-row">                        ← display:contents，三格同排
 *         <div class="icen-kb-rerank-col kb-rerank-col--before [.is-missing]>
 *           <span class="icen-kb-rerank-rank icen-kb-num">1</span>
 *           <span class="icen-kb-rerank-title">…</span>
 *           <span class="icen-kb-score">…bar + 值…</span>
 *         </div>
 *         <div class="icen-kb-rerank-delta [.is-up|.is-down]">↑3 | ↓2 | —</div>
 *         <div class="icen-kb-rerank-col icen-kb-rerank-col--after [.is-missing]">…</div>
 *       </div>…
 *       [<div class="icen-kb-empty">…空态…</div>]
 *     </div>
 *   </div>
 *
 * 行为：
 *   - 按 key 稳定 join（documentId + chunkId）：before/after 两列 union；after 有序优先，
 *     before-only 条目（被 rerank 淘汰）殿后并标「落选」，after-only 标「新进」。
 *   - delta 用 kb-core rerankDelta（after.rank − before.rank）：负 = 上升 ↑N（is-up 绿）、
 *     正 = 下降 ↓N（is-down 红）、0 或单侧缺失 → 「—」。
 *   - 双分数列：before 列用原 scoreKind 归一（列内 max 为条长基准），after 列 scoreKind
 *     一律标 'rerank'；score null → 不渲条 + 值「—」。
 *   - 开关（role=switch）：切换派 icen:kb-rerank-toggle {enabled, model}；关闭时容器挂
 *     .is-off（重排后列压淡——显式禁用不隐藏，Dify 纪律）。
 *   - SSR 下 no-op（返回宿主 el）；渲染只写 textContent/createElement，禁 innerHTML。
 */

import {
  h, normalizeHit, formatScore, scorePercent, rerankDelta, type KbRetrievalHit, type KbScoreKind,
} from './kb-core';
import { emitIcen } from './events';
import { t } from './i18n';

/* ══════════════ 类型 ══════════════ */

/** renderKbRerankCompare 输入 */
export interface KbRerankCompareOpts {
  /** 重排前列表（顺序即 rank） */
  before: KbRetrievalHit[];
  /** 重排后列表（顺序即 rank） */
  after: KbRetrievalHit[];
  /** rerank 模型名（顶部徽标；缺省 'rerank'） */
  model?: string;
}

/* ══════════════ 工具 ══════════════ */

function hitKey(hit: KbRetrievalHit): string {
  return `${hit.documentId ?? ''}::${hit.chunkId}`;
}

function hitTitle(hit: KbRetrievalHit): string {
  return hit.title ?? hit.documentId ?? hit.chunkId;
}

/** 列内分数条基准：该列有限分数的最大值（空/全 null → 1） */
function columnMax(hits: KbRetrievalHit[]): number {
  let max = 0;
  for (const hit of hits) {
    if (typeof hit.score === 'number' && Number.isFinite(hit.score)) max = Math.max(max, Math.abs(hit.score));
  }
  return max > 0 ? max : 1;
}

/* ══════════════ 渲染 ══════════════ */

/**
 * 快照渲染 rerank A/B 双列对比（三列 grid：前 | Δ | 后）。按 documentId+chunkId 稳定
 * join，中部 delta 箭头（↑绿/↓红/—），顶部模型徽标 + 开关（icen:kb-rerank-toggle）。
 * 返回挂载容器；SSR 下 no-op 返回宿主 el。
 */
export function renderKbRerankCompare(el: HTMLElement, opts: KbRerankCompareOpts): HTMLElement {
  if (typeof document === 'undefined' || !el) return el;
  const before = (opts.before ?? []).map((hit) => normalizeHit(hit as unknown as Record<string, unknown>));
  const after = (opts.after ?? []).map((hit) => normalizeHit(hit as unknown as Record<string, unknown>));

  el.textContent = '';
  const box = h('div', 'icen-kb-rerank');
  box.dataset.icenKbRerank = '';

  /* ── 头部：模型徽标 + 开关 ── */

  const head = h('div', 'icen-kb-rerank-head');
  const modelBadge = h('span', 'icen-kb-badge kb-rerank-model', opts.model ? `rerank · ${opts.model}` : 'rerank');
  const switchLabel = h('span', 'icen-kb-rerank-switch-label icen-kb-meta', t('kbRerank.compareTitle'));
  const switchBtn = h('button', 'icen-kb-switch');
  switchBtn.type = 'button';
  switchBtn.role = 'switch';
  switchBtn.dataset.icenKbRerankToggle = '';
  switchBtn.setAttribute('aria-checked', 'true');
  switchBtn.setAttribute('aria-label', t('kbRerank.enableCompare'));
  head.append(modelBadge, switchLabel, switchBtn);

  /* ── 网格 ── */

  const grid = h('div', 'icen-kb-rerank-grid');
  const beforeKind: KbScoreKind | undefined = before[0]?.scoreKind;
  const headL = h('div', 'icen-kb-rerank-colhead', t('kbRerank.before'));
  headL.appendChild(h('span', 'icen-kb-chip icen-kb-chip--kind', beforeKind ?? t('kbRerank.unmarked')));
  const headD = h('div', 'icen-kb-rerank-colhead icen-kb-rerank-colhead--delta', 'Δ');
  const headR = h('div', 'icen-kb-rerank-colhead', t('kbRerank.after'));
  headR.appendChild(h('span', 'icen-kb-chip icen-kb-chip--kind', 'rerank'));
  grid.append(headL, headD, headR);

  const beforeMax = columnMax(before);
  const afterMax = columnMax(after);

  const beforeByKey = new Map(before.map((hit, i) => [hitKey(hit), { hit, rank: i + 1 }] as const));
  const afterByKey = new Map(after.map((hit, i) => [hitKey(hit), { hit, rank: i + 1 }] as const));

  /* 行序：after rank 优先（用户最关心重排后的榜首），before-only（落选）殿后 */
  const orderedKeys: string[] = [];
  for (const [key] of afterByKey) orderedKeys.push(key);
  for (const [key] of beforeByKey) if (!afterByKey.has(key)) orderedKeys.push(key);

  if (!orderedKeys.length) {
    grid.appendChild(h('div', 'icen-kb-empty', t('kbRerank.empty')));
  }

  const scoreCell = (hit: KbRetrievalHit | undefined, kind: KbScoreKind | undefined, max: number): HTMLElement => {
    const score = h('span', 'icen-kb-score');
    if (hit) {
      const pct = scorePercent(hit.score, kind, max);
      if (pct != null) {
        const barEl = h('span', 'icen-kb-score-bar');
        const fill = h('i');
        fill.style.width = `${pct.toFixed(1)}%`;
        barEl.appendChild(fill);
        score.appendChild(barEl);
      }
      score.appendChild(h('span', 'icen-kb-score-value', formatScore(hit.score)));
    } else {
      score.appendChild(h('span', 'icen-kb-score-value', '—'));
    }
    return score;
  };

  const colCell = (
    hit: KbRetrievalHit | undefined,
    rank: number | undefined,
    kind: KbScoreKind | undefined,
    max: number,
    side: 'before' | 'after',
  ): HTMLElement => {
    const cell = h('div', `icen-kb-rerank-col icen-kb-rerank-col--${side}`);
    if (!hit) {
      cell.classList.add('is-missing');
      cell.append(
        h('span', 'icen-kb-rerank-rank icen-kb-num', '—'),
        h('span', 'icen-kb-rerank-missing', side === 'before' ? t('kbRerank.newIn') : t('kbRerank.dropped')),
        h('span', 'icen-kb-score'),
      );
      return cell;
    }
    cell.append(
      h('span', 'icen-kb-rerank-rank icen-kb-num', String(rank)),
      h('span', 'icen-kb-rerank-title', hitTitle(hit)),
      scoreCell(hit, kind, max),
    );
    return cell;
  };

  for (const key of orderedKeys) {
    const b = beforeByKey.get(key);
    const a = afterByKey.get(key);
    const row = h('div', 'icen-kb-rerank-row');
    row.dataset.icenKey = key;

    const deltaCell = h('div', 'icen-kb-rerank-delta');
    if (b && a) {
      const delta = rerankDelta({ key, before: { rank: b.rank }, after: { rank: a.rank } });
      if (delta == null || delta === 0) {
        deltaCell.textContent = '—';
      } else if (delta < 0) {
        deltaCell.classList.add('is-up');
        deltaCell.append(createIcon('arrow-up',{size:12})!,document.createTextNode(String(Math.abs(delta))));
        deltaCell.title = t('kbRerank.up', { p0: Math.abs(delta) });
      } else {
        deltaCell.classList.add('is-down');
        deltaCell.append(createIcon('arrow-down',{size:12})!,document.createTextNode(String(delta)));
        deltaCell.title = t('kbRerank.down', { p0: delta });
      }
    } else {
      deltaCell.textContent = '—';
    }

    row.append(
      colCell(b?.hit, b?.rank, b?.hit.scoreKind, beforeMax, 'before'),
      deltaCell,
      colCell(a?.hit, a?.rank, 'rerank', afterMax, 'after'),
    );
    grid.appendChild(row);
  }

  /* ── 开关：关闭 → 容器 .is-off（after 列压淡），派 icen:kb-rerank-toggle ── */

  switchBtn.addEventListener('click', () => {
    const enabled = switchBtn.getAttribute('aria-checked') !== 'true';
    switchBtn.setAttribute('aria-checked', enabled ? 'true' : 'false');
    box.classList.toggle('is-off', !enabled);
    emitIcen(box, 'icen:kb-rerank-toggle', { enabled, model: opts.model });
  });

  box.append(head, grid);
  el.appendChild(box);
  return box;
}
