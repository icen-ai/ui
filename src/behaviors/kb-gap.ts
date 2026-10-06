/*
 * @icen.ai/ui — Behavior: kb-gap（无答案/未命中查询分析，观测治理域；与 components/kb-ops.css 配套）
 *
 * DOM 契约（类名固定，docs/spec/kb-family.md §5.21）：
 *   <div class="icen-kb-gap">
 *     <div class="icen-kb-gap-trend" role="img" aria-label="未命中查询趋势">
 *       <i class="icen-kb-gap-bar" style="height:62%" title="10-01 · 34"></i>×12   ← 纯 div/i 柱（自绘，不依赖 charts）
 *     </div>
 *     <div class="icen-kb-gap-table">
 *       <div class="icen-kb-gap-row icen-kb-gap-row--head">
 *         <span>查询</span><span class="icen-kb-gap-num">次数</span><span class="icen-kb-gap-num">占比</span>
 *         <span class="icen-kb-gap-head-zero">零点击率 <span class="icen-kb-gap-note" title="…">零点击 ≠ 失败</span></span>
 *         <span class="icen-kb-gap-num">最近出现</span><span></span>
 *       </div>
 *       <div class="icen-kb-gap-row">
 *         <span class="icen-kb-gap-query" title="…">查不到报销政策</span>
 *         <span class="icen-kb-num icen-kb-gap-num">34</span>
 *         <span class="icen-kb-num icen-kb-gap-num">12.5%</span>
 *         <span class="icen-kb-num icen-kb-gap-num">41.2%</span>
 *         <span class="icen-kb-gap-lastseen">3 天前</span>
 *         <span class="icen-kb-gap-actions">
 *           <button class="icen-kb-gap-action" data-icen-kb-gap-action="create-doc" data-icen-kb-gap-query="…">建文档</button>
 *           <button class="icen-kb-gap-action" data-icen-kb-gap-action="add-synonym" data-icen-kb-gap-query="…">加同义词</button>
 *         </span>
 *       </div>…
 *     </div>
 *     <div class="icen-kb-empty">没有未命中查询——覆盖良好</div>   ← queries 为空时
 *   </div>
 *
 * 口径纪律：「零点击 ≠ 失败」（用户可能已从引用片段得到答案）——表头以小字注释 +
 * title tooltip 声明，不把零点击染成告警色。
 *
 * 事件（emitIcen，bubbles）：
 *   icen:kb-gap-action { query, action: 'create-doc' | 'add-synonym' }  — 行内行动钮（initKbGap 委托派发）
 *
 * initKbGap：document 级 click 委托，幂等标记 + 销毁函数；动态插入的 .icen-kb-gap 自动
 * 接管（root 参数仅保持 kb 族 API 对称）。SSR 下 no-op；渲染只写
 * textContent/createElement（禁 innerHTML，无 SVG）。
 */

import { formatCount, formatPercent, h, relativeTime, type KbGapQuery } from './kb-core';
import { emitIcen } from './events';
import { t } from './i18n';

/** 趋势柱取点数（自绘 div 柱，取 trend 末尾 N 根） */
const TREND_BARS = 12;

/** 趋势单点（label 如 '10-01'，value 为当日未命中次数） */
export interface KbGapTrendPoint {
  label: string;
  value: number;
}

/** renderKbGap 入参模型 */
export interface KbGapModel {
  queries: KbGapQuery[];
  trend?: KbGapTrendPoint[];
}

/**
 * 渲染无答案分析视图（快照：整体替换 el 内容）。返回挂载容器 el。
 * queries 为空时渲染空态「没有未命中查询——覆盖良好」（无死路：覆盖良好也是一等状态）。
 */
export function renderKbGap(el: HTMLElement, model: KbGapModel): HTMLElement {
  if (typeof document === 'undefined') return el;
  el.className = 'icen-kb-gap';
  el.replaceChildren();

  /* 顶部迷你趋势：纯 CSS 柱条（不依赖 charts），高度 = value / max */
  if (model.trend && model.trend.length) {
    const trend = h('div', 'icen-kb-gap-trend');
    trend.setAttribute('role', 'img');
    trend.setAttribute('aria-label', t('kbGap.title'));
    const pts = model.trend.slice(-TREND_BARS);
    const max = Math.max(1, ...pts.map((p) => (Number.isFinite(p.value) ? p.value : 0)));
    for (const p of pts) {
      const v = Number.isFinite(p.value) ? p.value : 0;
      const bar = h('i', 'icen-kb-gap-bar');
      bar.style.height = `${Math.max(2, (v / max) * 100)}%`;
      bar.title = `${p.label} · ${formatCount(v)}`;
      trend.append(bar);
    }
    el.append(trend);
  }

  if (!model.queries.length) {
    el.append(h('div', 'icen-kb-empty', t('kbGap.empty')));
    return el;
  }

  const table = h('div', 'icen-kb-gap-table');

  /* 表头：零点击率列附「零点击 ≠ 失败」口径注释（小字 + title tooltip） */
  const head = h('div', 'icen-kb-gap-row icen-kb-gap-row--head');
  const zeroHead = h('span', 'icen-kb-gap-head-zero');
  const note = h('span', 'icen-kb-gap-note', t('kbGap.zeroClickTitle'));
  note.title = t('kbGap.zeroClickHint');
  zeroHead.append(h('span', undefined, t('kbGap.zeroClickRate')), note);
  head.append(
    h('span', undefined, t('kbGap.colQuery')),
    h('span', 'icen-kb-gap-num', t('kbGap.colCount')),
    h('span', 'icen-kb-gap-num', t('kbGap.colShare')),
    zeroHead,
    h('span', 'icen-kb-gap-num', t('kbGap.colLastSeen')),
    h('span', undefined, ''),
  );
  table.append(head);

  /* 数据行：query（mono）/ 次数 / 占比 / 零点击率 / 最近出现 / 行内两行动钮 */
  const ACTIONS: ReadonlyArray<readonly ['create-doc' | 'add-synonym', string]> = [
    ['create-doc', t('kbGap.createDoc')],
    ['add-synonym', t('kbGap.addSynonym')],
  ];
  for (const q of model.queries) {
    const row = h('div', 'icen-kb-gap-row');
    const queryEl = h('span', 'icen-kb-gap-query', q.text);
    queryEl.title = q.text;
    row.append(
      queryEl,
      h('span', 'icen-kb-num icen-kb-gap-num', formatCount(q.count)),
      h('span', 'icen-kb-num icen-kb-gap-num', formatPercent(q.shareOfAllQueries)),
      h('span', 'icen-kb-num icen-kb-gap-num', formatPercent(q.zeroClickRate)),
      h('span', 'icen-kb-gap-lastseen', q.lastSeenAt ? relativeTime(q.lastSeenAt) : '—'),
    );
    const actions = h('span', 'icen-kb-gap-actions');
    for (const [action, label] of ACTIONS) {
      const btn = h('button', 'icen-kb-gap-action', label);
      btn.type = 'button';
      btn.dataset.icenKbGapAction = action;
      btn.dataset.icenKbGapQuery = q.text;
      actions.append(btn);
    }
    row.append(actions);
    table.append(row);
  }
  el.append(table);
  return el;
}

/* ── init：document 级 click 委托，幂等 + 销毁 ── */

let gapInit = false;
let gapTeardown: (() => void) | null = null;

/**
 * 初始化无答案分析交互：document 级 click 委托 → 行内行动钮派发
 * icen:kb-gap-action { query, action }。幂等（重复调用安全）；返回销毁函数
 * （解绑委托并复位幂等标记，销毁后可重新 init）。委托挂 document 级：动态插入的
 * .icen-kb-gap 自动接管（root 参数仅保持 kb 族 API 对称）。SSR 下 no-op。
 */
export function initKbGap(root?: ParentNode): () => void {
  if (typeof document === 'undefined' || gapInit) return () => {};
  gapInit = true;

  const onClick = (e: MouseEvent): void => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLElement>('[data-icen-kb-gap-action]');
    if (!btn || !btn.closest('.icen-kb-gap')) return;
    const action = btn.dataset.icenKbGapAction === 'add-synonym' ? 'add-synonym' : 'create-doc';
    emitIcen(btn, 'icen:kb-gap-action', { query: btn.dataset.icenKbGapQuery ?? '', action });
  };

  document.addEventListener('click', onClick);
  gapTeardown = (): void => {
    document.removeEventListener('click', onClick);
    gapInit = false;
    gapTeardown = null;
  };
  return gapTeardown;
}
