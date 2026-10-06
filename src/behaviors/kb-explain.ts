/*
 * @icen.ai/ui — Behavior: kb-explain（问数域 · 口径解释折叠面板，与 components/kb-data.css 配套）
 *
 * DOM 契约（renderKbExplain 构建，规格 docs/spec/kb-family.md §5.18）：
 *   <div class="icen-kb-explain" data-icen-kb-explain>
 *     <button type="button" class="icen-kb-fold-head icen-kb-explain-head" aria-expanded="false">
 *       <span class="icen-kb-fold-caret">▶</span>
 *       <span>这个数字是怎么算出来的</span>
 *       <span class="icen-kb-num icen-kb-explain-count">7</span>          <!-- 参与要素计数（摘要行纪律） -->
 *     </button>
 *     <div class="icen-kb-explain-body" hidden>
 *       <div class="icen-kb-explain-group"><span class="icen-kb-explain-group-label">表</span>
 *         <span class="icen-kb-chip">orders</span>…</div>            <!-- 四组：表/列/筛选/聚合，有才渲 -->
 *       …
 *       <div class="icen-kb-explain-metrics">
 *         <div class="icen-kb-explain-metric">
 *           <span class="icen-kb-explain-metric-name">GMV（含税）</span>
 *           <a class="icen-kb-explain-metric-ref" href="…">查看口径</a>   <!-- ref 有才渲 -->
 *         </div>…
 *       </div>
 *     </div>
 *   </div>
 *
 * 行为：
 *   - 折叠面板：点摘要行切换展开（160ms ease-out 由 kb.css/.icen-kb-fold-caret 提供），
 *     派 icen:kb-explain-toggle {el, open}（events.ts 已登记）
 *   - 监听器直挂在渲染时新建的摘要行按钮上（快照重渲自然回收，无 init/销毁负担）
 *   - 四组要素 chips 与指标口径行「有才渲」；全空时折叠体给 .icen-kb-empty 空态（无死路）
 */

import { h, type KbExplainFact } from './kb-core';
import { emitIcen } from './events';
import { t } from './i18n';

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
  const group = h('div', 'icen-kb-explain-group');
  group.appendChild(h('span', 'icen-kb-explain-group-label', label));
  for (const item of items) group.appendChild(h('span', 'icen-kb-chip', item));
  return group;
}

/**
 * 渲染口径解释折叠面板（快照式：重复调用整段重建，默认折叠），返回挂载元素 el
 * （render* 约定；SSR 原样返回）。展开体：表/列/筛选/聚合四组 .icen-kb-chip（有才渲）
 * + 指标口径行（name + ref 深链）。切换派 icen:kb-explain-toggle {el, open}。
 */
export function renderKbExplain(
  el: HTMLElement,
  fact: KbExplainFact | Partial<KbExplainFact>,
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const f = toExplainFact(fact);
  el.textContent = '';

  const root = h('div', 'icen-kb-explain');
  root.dataset.icenKbExplain = '';

  /* 摘要行（折叠头）：标题 + 参与要素计数 */
  const count =
    (f.tables?.length ?? 0) +
    (f.columns?.length ?? 0) +
    (f.filters?.length ?? 0) +
    (f.aggregates?.length ?? 0) +
    (f.metrics?.length ?? 0);

  const head = h('button', 'icen-kb-fold-head icen-kb-explain-head');
  head.type = 'button';
  head.setAttribute('aria-expanded', 'false');
  head.appendChild(h('span', 'icen-kb-fold-caret', '\u25B8'));
  head.appendChild(h('span', 'icen-kb-explain-title', t('kbExplain.trigger')));
  if (count > 0) {
    const countBox = h('span', 'icen-kb-num icen-kb-explain-count', String(count));
    countBox.classList.add('icen-kb-fold-count');
    head.appendChild(countBox);
  }
  root.appendChild(head);

  /* 展开体 */
  const body = h('div', 'icen-kb-explain-body');
  body.hidden = true;

  const groups: Array<HTMLElement | null> = [
    renderGroup(t('kbExplain.groupTable'), f.tables),
    renderGroup(t('kbExplain.groupColumn'), f.columns),
    renderGroup(t('kbExplain.groupFilter'), f.filters),
    renderGroup(t('kbExplain.groupAgg'), f.aggregates),
  ];
  for (const g of groups) if (g) body.appendChild(g);

  if (f.metrics?.length) {
    const metrics = h('div', 'icen-kb-explain-metrics');
    for (const m of f.metrics) {
      const row = h('div', 'icen-kb-explain-metric');
      row.appendChild(h('span', 'icen-kb-explain-metric-name', m.name));
      if (m.ref) {
        /* 链接协议守卫：拒绝 javascript:/data:/vbscript: 注入，相对路径原样放行（对齐 ai-chat safeHref 纪律） */
        if (!/^\s*(javascript|data|vbscript)\s*:/i.test(m.ref)) {
          const a = h('a', 'icen-kb-explain-metric-ref', t('kbExplain.viewDefinition'));
          a.href = m.ref;
          a.rel = 'noopener';
          row.appendChild(a);
        }
      }
      metrics.appendChild(row);
    }
    body.appendChild(metrics);
  }

  if (body.children.length === 0) {
    body.appendChild(h('div', 'icen-kb-empty', t('kbExplain.empty')));
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
