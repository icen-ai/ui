/*
 * @icen.ai/ui — Behavior: kb-explain（问数域 · 口径解释折叠面板，与 components/kb-data.css 配套）
 *
 * DOM 契约（renderKbExplain 构建，规格 docs/spec/kb-family.md §5.18）：
 *   <div class="kb-explain" data-kb-explain>
 *     <button type="button" class="kb-fold-head kb-explain-head" aria-expanded="false">
 *       <span class="kb-fold-caret">▶</span>
 *       <span>这个数字是怎么算出来的</span>
 *       <span class="kb-num kb-explain-count">7</span>          <!-- 参与要素计数（摘要行纪律） -->
 *     </button>
 *     <div class="kb-explain-body" hidden>
 *       <div class="kb-explain-group"><span class="kb-explain-group-label">表</span>
 *         <span class="kb-chip">orders</span>…</div>            <!-- 四组：表/列/筛选/聚合，有才渲 -->
 *       …
 *       <div class="kb-explain-metrics">
 *         <div class="kb-explain-metric">
 *           <span class="kb-explain-metric-name">GMV（含税）</span>
 *           <a class="kb-explain-metric-ref" href="…">查看口径</a>   <!-- ref 有才渲 -->
 *         </div>…
 *       </div>
 *     </div>
 *   </div>
 *
 * 行为：
 *   - 折叠面板：点摘要行切换展开（160ms ease-out 由 kb.css/.kb-fold-caret 提供），
 *     派 icen:kb-explain-toggle {el, open}（events.ts 已登记）
 *   - 监听器直挂在渲染时新建的摘要行按钮上（快照重渲自然回收，无 init/销毁负担）
 *   - 四组要素 chips 与指标口径行「有才渲」；全空时折叠体给 .kb-empty 空态（无死路）
 */

import { h, type KbExplainFact } from './kb-core';
import { emitIcen } from './events';

/** 宽进严出：素对象 → KbExplainFact（各组过滤为非空字符串，不抛异常） */
function toExplainFact(raw: KbExplainFact | Partial<KbExplainFact>): KbExplainFact {
  const r = (raw ?? {}) as Partial<KbExplainFact>;
  const list = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const out = v.map((s) => String(s ?? '').trim()).filter(Boolean);
    return out.length ? out : undefined;
  };
  const metrics = Array.isArray(r.metrics)
    ? r.metrics
        .filter((m): m is { name: string; ref?: string } => !!m && typeof m === 'object')
        .map((m) => ({
          name: String(m.name ?? ''),
          ref: typeof m.ref === 'string' && m.ref ? m.ref : undefined,
        }))
        .filter((m) => m.name)
    : undefined;
  return {
    tables: list(r.tables),
    columns: list(r.columns),
    filters: list(r.filters),
    aggregates: list(r.aggregates),
    metrics: metrics?.length ? metrics : undefined,
  };
}

/** 一组要素 chips（表/列/筛选/聚合共用；有才渲染） */
function renderGroup(label: string, items: string[] | undefined): HTMLElement | null {
  if (!items?.length) return null;
  const group = h('div', 'kb-explain-group');
  group.appendChild(h('span', 'kb-explain-group-label', label));
  for (const item of items) group.appendChild(h('span', 'kb-chip', item));
  return group;
}

/**
 * 渲染口径解释折叠面板（快照式：重复调用整段重建，默认折叠），返回挂载元素 el
 * （render* 约定；SSR 原样返回）。展开体：表/列/筛选/聚合四组 .kb-chip（有才渲）
 * + 指标口径行（name + ref 深链）。切换派 icen:kb-explain-toggle {el, open}。
 */
export function renderKbExplain(
  el: HTMLElement,
  fact: KbExplainFact | Partial<KbExplainFact>,
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const f = toExplainFact(fact);
  el.textContent = '';

  const root = h('div', 'kb-explain');
  root.dataset.kbExplain = '';

  /* 摘要行（折叠头）：标题 + 参与要素计数 */
  const count =
    (f.tables?.length ?? 0) +
    (f.columns?.length ?? 0) +
    (f.filters?.length ?? 0) +
    (f.aggregates?.length ?? 0) +
    (f.metrics?.length ?? 0);

  const head = h('button', 'kb-fold-head kb-explain-head');
  head.type = 'button';
  head.setAttribute('aria-expanded', 'false');
  head.appendChild(h('span', 'kb-fold-caret', '\u25B8'));
  head.appendChild(h('span', 'kb-explain-title', '这个数字是怎么算出来的'));
  if (count > 0) {
    const countBox = h('span', 'kb-num kb-explain-count', String(count));
    countBox.classList.add('kb-fold-count');
    head.appendChild(countBox);
  }
  root.appendChild(head);

  /* 展开体 */
  const body = h('div', 'kb-explain-body');
  body.hidden = true;

  const groups: Array<HTMLElement | null> = [
    renderGroup('表', f.tables),
    renderGroup('列', f.columns),
    renderGroup('筛选', f.filters),
    renderGroup('聚合', f.aggregates),
  ];
  for (const g of groups) if (g) body.appendChild(g);

  if (f.metrics?.length) {
    const metrics = h('div', 'kb-explain-metrics');
    for (const m of f.metrics) {
      const row = h('div', 'kb-explain-metric');
      row.appendChild(h('span', 'kb-explain-metric-name', m.name));
      if (m.ref) {
        const a = h('a', 'kb-explain-metric-ref', '查看口径');
        a.href = m.ref;
        row.appendChild(a);
      }
      metrics.appendChild(row);
    }
    body.appendChild(metrics);
  }

  if (body.children.length === 0) {
    body.appendChild(h('div', 'kb-empty', '暂无口径信息'));
  }
  root.appendChild(body);

  head.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    head.setAttribute('aria-expanded', String(open));
    emitIcen(head, 'icen:kb-explain-toggle', { el: root, open });
  });

  el.appendChild(root);
  return el;
}
