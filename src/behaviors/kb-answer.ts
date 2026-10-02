/*
 * @icen.ai/ui — Behavior: kb-answer（问数域 · Chat-with-Data 答案组合容器，与 components/kb-data.css 配套）
 *
 * DOM 契约（renderKbAnswer 构建，规格 docs/spec/kb-family.md §5.16）：
 *   <article class="kb-answer" data-kind="generated|verified">
 *     <div class="kb-answer-badges">
 *       (verified) <button type="button" class="kb-verified" data-asset-id="…">
 *         <span class="kb-badge kb-badge--trusted">…svg…认证答案</span>
 *         <span class="kb-verified-via">命中资产：参数化查询</span>
 *         <span class="kb-verified-hint">参数可改重跑</span>
 *       </button>
 *       (permissionNotice) <div class="kb-perm">                     <!-- 不可关闭（诚实呈现） -->
 *         <span class="kb-perm-text">已按你的数据权限过滤：{rowLevelPolicy}</span>
 *         <span class="kb-perm-mask"><span class="kb-perm-mask-label">已脱敏列：</span>
 *           <span class="kb-chip">phone</span>…</span>
 *       </div>
 *     </div>
 *     <div class="kb-answer-body">答案正文…<sup class="kb-citation" data-cite="3">[3]</sup>…</div>
 *     <div class="kb-answer-clarify">…renderKbClarify…</div>
 *     <div class="kb-answer-explain">…renderKbExplain…</div>
 *     <div class="kb-answer-results">
 *       <div class="kb-result-meta"><span class="kb-num">N 行</span><span class="kb-num">…ms</span>
 *         <span class="kb-result-export"><button class="kb-result-export-btn" data-format>导出 csv</button>…</span></div>
 *       <div class="kb-result-scroll"><table class="kb-result-table">
 *         <thead><tr><th>列名</th>…</tr></thead>                     <!-- sticky 表头；数字列 .kb-num -->
 *         <tbody><tr><td>…</td>…</tr>…</tbody>                       <!-- null → 「—」(muted) -->
 *       </table></div>
 *       (truncated) <div class="kb-notice kb-result-truncated">已截断：显示 N/M 行（LIMIT L）</div>
 *     </div>
 *     <div class="kb-answer-chart">
 *       <div class="kb-chart-switch"><button class="kb-chart-chip [.is-active]">折线|柱状|饼图</button>…</div>
 *       <div class="chart kb-chart-mount">…renderChart（ChartSpec）…</div>
 *     </div>
 *     <div class="kb-answer-followups"><span class="kb-followups-label">追问建议</span>
 *       <button type="button" class="kb-chip kb-followup">按季度拆分看趋势</button>…</div>
 *   </article>
 *
 * 组合纪律：
 *   - 认证优先于生成：kind==='verified' 且有 verifiedVia 才出认证徽章（success 只给徽章，
 *     数字本身永远中性 —— 数字域纪律）；角标流本文件内简化实现（sup.kb-citation data-cite，
 *     与 kb-ground 域类名一致，不 import kb-citation 模块；无效编号 [n] 降级纯文本）
 *   - clarify/explain 槽内调本域 renderKbClarify / renderKbExplain；图表区复用 charts 的
 *     renderChart（ChartSpec 归一 + update 原地重渲）
 *   - 导出走 opts.onExport(format)（无回调则按钮禁用）；追问走 opts.onFollowUp(text)；
 *     认证徽章点击派 icen:kb-verified-open {assetId}（events.ts 已登记）
 *   - 快照渲染：重复调用整段重建；SSR 原样返回挂载元素
 */

import {
  h,
  svgIcon,
  parseInlineCitations,
  normalizeQueryResult,
  formatCount,
  type KbAnswerKind,
  type KbVerifiedVia,
  type KbCitation,
  type KbClarification,
  type KbExplainFact,
  type KbPermissionNotice,
  type KbQueryResult,
} from './kb-core';
import { emitIcen } from './events';
import { renderKbClarify } from './kb-clarify';
import { renderKbExplain } from './kb-explain';
import { renderChart, normalizeChartSpec } from './charts';
import type { ChartSpec } from './charts';

/* ── 模型与选项 ── */

/** 问数答案的组合模型（各槽位有才渲；共享类型一律 import 自 kb-core） */
export interface KbAnswerModel {
  /** generated 生成式 / verified 命中可信资产 */
  kind: KbAnswerKind;
  verifiedVia?: KbVerifiedVia;
  /** 答案正文（可含 [n] 引用编号） */
  body?: string;
  /** 与正文 [n] 对齐的来源（编号有效性据此判定，无效编号降级纯文本） */
  citations?: KbCitation[];
  clarify?: KbClarification;
  explain?: KbExplainFact;
  permissionNotice?: KbPermissionNotice;
  result?: KbQueryResult | Partial<KbQueryResult>;
  /** ChartSpec（纯 JSON 或其字符串；走 normalizeChartSpec 归一） */
  chartSpec?: unknown;
  followUps?: string[];
}

/** renderKbAnswer 选项：handle 回调通道（事件通道恒开） */
export interface KbAnswerOptions {
  /** 结果导出（format 取自 result.exportFormats；未提供则导出钮禁用） */
  onExport?: (format: string) => void;
  /** 追问建议点击 */
  onFollowUp?: (text: string) => void;
  /** 认证徽章点击（与 icen:kb-verified-open 同语义） */
  onVerifiedOpen?: (assetId: string) => void;
}

const ASSET_TYPE_LABELS: Record<KbVerifiedVia['assetType'], string> = {
  'parameterized-query': '参数化查询',
  function: '函数',
  curated: '人工策展',
};

const ICON_TRUSTED =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';
const ICON_SHIELD =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>';

/* ── 徽章区（认证 + 权限提示） ── */

function renderVerifiedBadge(via: KbVerifiedVia, opts?: KbAnswerOptions): HTMLElement {
  const btn = h('button', 'kb-verified');
  btn.type = 'button';
  if (via.assetId) btn.dataset.assetId = via.assetId;

  const badge = h('span', 'kb-badge kb-badge--trusted');
  const svg = svgIcon(ICON_TRUSTED);
  if (svg) badge.appendChild(svg);
  badge.appendChild(document.createTextNode('认证答案'));
  btn.appendChild(badge);

  btn.appendChild(h('span', 'kb-verified-via', `命中资产：${ASSET_TYPE_LABELS[via.assetType] ?? via.assetType}`));
  if (via.note) btn.appendChild(h('span', 'kb-verified-note', via.note));
  btn.appendChild(h('span', 'kb-verified-hint', '参数可改重跑'));

  btn.addEventListener('click', () => {
    emitIcen(btn, 'icen:kb-verified-open', { assetId: via.assetId });
    opts?.onVerifiedOpen?.(via.assetId);
  });
  return btn;
}

function renderPermissionNotice(p: KbPermissionNotice): HTMLElement {
  const box = h('div', 'kb-perm');
  const iconBox = h('span', 'kb-perm-icon');
  const svg = svgIcon(ICON_SHIELD);
  if (svg) iconBox.appendChild(svg);
  box.appendChild(iconBox);
  box.appendChild(h('span', 'kb-perm-text', p.rowLevelPolicy ? `已按你的数据权限过滤：${p.rowLevelPolicy}` : '已按你的数据权限过滤'));
  if (p.maskedColumns?.length) {
    const mask = h('span', 'kb-perm-mask');
    mask.appendChild(h('span', 'kb-perm-mask-label', '已脱敏列：'));
    for (const col of p.maskedColumns) mask.appendChild(h('span', 'kb-chip', col));
    box.appendChild(mask);
  }
  /* 权限提示不可关闭：诚实呈现数据边界，不提供任何 dismiss 入口 */
  return box;
}

/* ── 正文（[n] → 简化引用角标流） ── */

/**
 * 把含 [n] 的正文切段渲染为文本 + sup.kb-citation 角标流。
 * 简化实现（不依赖 kb-ground 域）：编号对上 citations 才升级为角标（title=来源标题），
 * 无 citations 或越界编号按纯文本原样保留 —— 「不信任模型生成编号」纪律。
 */
function renderBody(text: string, citations: KbCitation[] | undefined): HTMLElement {
  const box = h('div', 'kb-answer-body');
  for (const seg of parseInlineCitations(text)) {
    if (typeof seg.n === 'number' && citations && seg.n >= 1 && seg.n <= citations.length) {
      const sup = h('sup', 'kb-citation', `[${seg.n}]`);
      sup.dataset.cite = String(seg.n);
      const c = citations[seg.n - 1];
      if (c?.title) sup.title = c.title;
      box.appendChild(sup);
    } else {
      box.appendChild(document.createTextNode(seg.text));
    }
  }
  return box;
}

/* ── 结果表 ── */

const NUMERIC_TYPES: ReadonlySet<string> = new Set([
  'number', 'int', 'integer', 'float', 'double', 'decimal', 'numeric', 'bigint', 'smallint', 'real',
]);

/** 数字列判定：显式 type 优先；缺省看该列首条非空值是否为 number */
function isNumericColumn(
  col: { name: string; type?: string },
  colIndex: number,
  rows: Array<Array<string | number | null>>,
): boolean {
  if (col.type) return NUMERIC_TYPES.has(col.type.toLowerCase());
  for (const row of rows) {
    const v = row[colIndex];
    if (v == null) continue;
    return typeof v === 'number';
  }
  return false;
}

function renderResult(result: KbQueryResult, opts?: KbAnswerOptions): HTMLElement | null {
  if (!result.columns.length) return null;
  const wrap = h('div', 'kb-answer-results');

  /* 摘要行：行数 · 时长 · 导出钮组（onExport 缺席则禁用 —— 无死路也不给假按钮） */
  const meta = h('div', 'kb-result-meta');
  meta.appendChild(h('span', 'kb-num', `${formatCount(result.rowCount)} 行`));
  if (result.durationMs != null) {
    meta.appendChild(h('span', 'kb-num kb-result-dur', `${Math.round(result.durationMs)} ms`));
  }
  if (result.exportFormats?.length) {
    const exports = h('span', 'kb-result-export');
    for (const fmt of result.exportFormats) {
      const btn = h('button', 'kb-result-export-btn', `导出 ${fmt}`);
      btn.type = 'button';
      btn.dataset.format = fmt;
      if (!opts?.onExport) btn.disabled = true;
      else btn.addEventListener('click', () => opts.onExport?.(fmt));
      exports.appendChild(btn);
    }
    meta.appendChild(exports);
  }
  wrap.appendChild(meta);

  /* 滚动容器 + sticky 表头表格 */
  const scroll = h('div', 'kb-result-scroll');
  const table = h('table', 'kb-result-table');
  const numCols = result.columns.map((c, i) => isNumericColumn(c, i, result.rows));

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  result.columns.forEach((c, i) => {
    headRow.appendChild(h('th', numCols[i] ? 'kb-num' : '', c.name));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of result.rows) {
    const tr = document.createElement('tr');
    result.columns.forEach((_, i) => {
      const v = row[i];
      if (v == null) {
        const td = h('td', 'kb-result-null', '—');
        tr.appendChild(td);
      } else {
        tr.appendChild(h('td', typeof v === 'number' ? 'kb-num' : '', String(v)));
      }
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  scroll.appendChild(table);
  wrap.appendChild(scroll);

  /* 截断声明（契约不是 bug：truncated 必须说话） */
  if (result.truncated) {
    const total = result.totalRows != null ? formatCount(result.totalRows) : '—';
    const limitPart = result.limit != null ? `（LIMIT ${formatCount(result.limit)}）` : '';
    wrap.appendChild(h('div', 'kb-notice kb-result-truncated', `已截断：显示 ${formatCount(result.rowCount)}/${total} 行${limitPart}`));
  }
  return wrap;
}

/* ── 图表区（renderChart 复用 + 类型切换） ── */

const CHART_SWITCHES: ReadonlyArray<{ type: 'line' | 'vbar' | 'donut'; label: string }> = [
  { type: 'line', label: '折线' },
  { type: 'vbar', label: '柱状' },
  { type: 'donut', label: '饼图' },
];

/** spec 允许三形态切换：类目数值（labels+values/series）或占比（segments） */
function switchable(spec: ChartSpec): boolean {
  const hasCat = (spec.labels?.length ?? 0) > 0 && ((spec.values?.length ?? 0) > 0 || (spec.series?.length ?? 0) > 0);
  return hasCat || (spec.segments?.length ?? 0) > 0;
}

/** 目标形态的 spec（segments ↔ labels/values 互转；line/vbar 需类目轴，donut 需占比段） */
function specAsType(base: ChartSpec, target: 'line' | 'vbar' | 'donut'): ChartSpec {
  if (target === 'donut') {
    if (base.segments?.length) return { ...base, type: 'donut' };
    const labels = base.labels ?? [];
    const values = base.values ?? [];
    return {
      ...base,
      type: 'donut',
      segments: labels.map((label, i) => ({ label, value: values[i] ?? 0 })),
    };
  }
  if ((!base.labels?.length || !(base.values?.length || base.series?.length)) && base.segments?.length) {
    return {
      ...base,
      type: target,
      labels: base.segments.map((s) => s.label),
      values: base.segments.map((s) => s.value),
      segments: undefined,
    };
  }
  return { ...base, type: target };
}

function renderChartArea(raw: unknown): HTMLElement | null {
  if (raw == null) return null;
  const norm = normalizeChartSpec(raw);
  const area = h('div', 'kb-answer-chart');

  const mount = h('div', 'chart kb-chart-mount');
  const handle = renderChart(mount, norm);
  /* 切换 chips 只在 spec 允许三形态时给（scatter/calendar 等不硬塞） */
  if (switchable(handle.spec)) {
    const switchRow = h('div', 'kb-chart-switch');
    const chips = new Map<string, HTMLButtonElement>();
    for (const s of CHART_SWITCHES) {
      const chip = h('button', 'kb-chart-chip', s.label);
      chip.type = 'button';
      chip.dataset.chartType = s.type;
      if (handle.spec.type === s.type) chip.classList.add('is-active');
      chip.addEventListener('click', () => {
        if (chip.classList.contains('is-active')) return;
        chips.forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        handle.update(specAsType(handle.spec, s.type));
      });
      chips.set(s.type, chip);
      switchRow.appendChild(chip);
    }
    area.appendChild(switchRow);
  }
  area.appendChild(mount);
  return area;
}

/* ── 组合渲染 ── */

/**
 * 渲染问数答案组合容器（快照式：重复调用整段重建），返回挂载元素 el
 * （render* 约定；SSR 原样返回）。槽位顺序：徽章区（认证 + 权限提示）→ 正文
 * （[n] 角标流）→ 澄清反问 → 口径解释折叠 → 结果表（截断声明 + 导出）→ 图表区
 * （ChartSpec + 类型切换）→ 追问建议。各槽位有才渲；权限提示不可关闭。
 */
export function renderKbAnswer(
  el: HTMLElement,
  model: KbAnswerModel | Partial<KbAnswerModel>,
  opts?: KbAnswerOptions,
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const m = model ?? {};
  el.textContent = '';

  const root = h('article', 'kb-answer');
  root.dataset.kind = m.kind === 'verified' ? 'verified' : 'generated';

  /* 徽章区：认证徽章（verified 优先呈现）+ 权限提示（不可关闭） */
  const badges = h('div', 'kb-answer-badges');
  if (m.kind === 'verified' && m.verifiedVia) badges.appendChild(renderVerifiedBadge(m.verifiedVia, opts));
  if (m.permissionNotice && (m.permissionNotice.rowLevelPolicy || m.permissionNotice.maskedColumns?.length)) {
    badges.appendChild(renderPermissionNotice(m.permissionNotice));
  }
  if (badges.children.length > 0) root.appendChild(badges);

  /* 正文 */
  if (typeof m.body === 'string' && m.body) root.appendChild(renderBody(m.body, m.citations));

  /* 澄清反问槽 */
  if (m.clarify && (m.clarify.question || m.clarify.options?.length)) {
    const slot = h('div', 'kb-answer-clarify');
    renderKbClarify(slot, m.clarify);
    root.appendChild(slot);
  }

  /* 口径解释槽（四组要素与指标全空则不占位） */
  if (m.explain) {
    const f = m.explain;
    const hasAny =
      f.tables?.length || f.columns?.length || f.filters?.length || f.aggregates?.length || f.metrics?.length;
    if (hasAny) {
      const slot = h('div', 'kb-answer-explain');
      renderKbExplain(slot, f);
      root.appendChild(slot);
    }
  }

  /* 结果表 */
  if (m.result) {
    const resultBox = renderResult(normalizeQueryResult(m.result as Partial<KbQueryResult>), opts);
    if (resultBox) root.appendChild(resultBox);
  }

  /* 图表区 */
  const chartArea = renderChartArea(m.chartSpec);
  if (chartArea) root.appendChild(chartArea);

  /* 追问建议（点击走 onFollowUp 回调通道；未提供回调时 chips 保持常态展示） */
  const followUps = (m.followUps ?? []).map((s) => String(s ?? '').trim()).filter(Boolean);
  if (followUps.length > 0) {
    const row = h('div', 'kb-answer-followups');
    row.appendChild(h('span', 'kb-followups-label', '追问建议'));
    for (const text of followUps) {
      const chip = h('button', 'kb-chip kb-followup', text);
      chip.type = 'button';
      chip.addEventListener('click', () => opts?.onFollowUp?.(text));
      row.appendChild(chip);
    }
    root.appendChild(row);
  }

  el.appendChild(root);
  return el;
}
