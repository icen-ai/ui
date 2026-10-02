/*
 * @icen.ai/ui — Behavior: kb-eval（评估 run 对比表，观测治理域；与 components/kb-ops.css 配套）
 *
 * DOM 契约（类名固定，docs/spec/kb-family.md §5.22）：
 *   <div class="kb-eval">
 *     <div class="kb-eval-bar">
 *       对比 <select class="kb-eval-run" data-run="a">…</select> vs <select class="kb-eval-run" data-run="b">…</select>
 *       [仅存在回归行时] <button class="kb-eval-filter" aria-pressed="false">仅看回归</button>
 *     </div>
 *     <div class="kb-eval-summary">
 *       <span class="kb-eval-grade is-improvement|is-regression|is-tradeoff|is-tie">提升|回归|权衡|持平</span>
 *       <span class="kb-num">A 均分 0.62</span> → <span class="kb-num">B 均分 0.71</span>
 *       <span class="kb-num kb-eval-delta [is-up|is-down]">+9.0pp</span>
 *       <span class="kb-meta">N 行</span>
 *     </div>
 *     <div class="kb-eval-tablewrap"><div class="kb-eval-table">
 *       <div class="kb-eval-grid kb-eval-grid--head">输入 | 输出 A | 输出 B | 期望 | [指标名 span 3]×m</div>
 *       <div class="kb-eval-grid kb-eval-grid--head">… | [A][B][Δ]×m</div>
 *       <div class="kb-eval-item">
 *         <div class="kb-eval-grid kb-eval-rowline" role="button" tabindex="0" aria-expanded="false">
 *           <span class="kb-eval-cell kb-eval-cell--input"><span class="kb-eval-key">key</span><span title>input</span></span>
 *           <span class="kb-eval-cell">outputA 截断</span> <span class="kb-eval-cell">outputB 截断</span>
 *           <span class="kb-eval-cell">expected 截断</span>
 *           <span class="kb-num kb-eval-num">0.9</span><span class="kb-num kb-eval-num">0.8</span>
 *           <span class="kb-num kb-eval-num kb-eval-delta is-down">-0.1</span> ×m（null → '—'）
 *         </div>
 *         <div class="kb-eval-detail" hidden>
 *           <div class="kb-eval-detail-col"><div class="kb-eval-detail-label">输出 A</div>
 *             <pre class="kb-eval-detail-pre">公共前缀<span class="kb-eval-diff-del">A 独有（红）</span>公共后缀</pre></div>
 *           <div class="kb-eval-detail-col">…输出 B…<span class="kb-eval-diff-ins">B 独有（绿）</span>…</div>
 *           <div class="kb-eval-detail-expected">期望：…</div>
 *         </div>
 *       </div>…
 *     </div></div>
 *   </div>
 *
 * Summary 判级走 kb-core evalGrade（meanScore 全行均值差）+ deltaLabel 百分点差；
 * 字符级 diff 为自写简版（公共前缀/后缀双指针截取，中段 A 独有红 / B 独有绿，零依赖）。
 *
 * 事件（emitIcen，bubbles）：
 *   icen:kb-eval-compare { runA, runB } — run 选择切换（消费方据新 run 对重取 rows 后重渲）
 *
 * 渲染只写 textContent/createElement（禁 innerHTML，无 SVG）；行展开/过滤为渲染内
 * 自含监听（随 DOM 快照生灭）；SSR 下 no-op。
 */

import {
  deltaLabel,
  evalGrade,
  formatScore,
  h,
  meanScore,
  type KbEvalGrade,
  type KbEvalRow,
} from './kb-core';
import { emitIcen } from './events';

/** 可选 run（下拉项） */
export interface KbEvalRunRef {
  id: string;
  label: string;
}

/** renderKbEvalCompare 入参模型 */
export interface KbEvalCompareModel {
  runs: KbEvalRunRef[];
  rows: KbEvalRow[];
  /** 指标列名（缺省从 rows 的 scoresA/scoresB 键序并集推导） */
  metrics?: string[];
}

const GRADE_LABELS: Record<KbEvalGrade, string> = {
  improvement: '提升',
  regression: '回归',
  tradeoff: '权衡',
  tie: '持平',
};

/** 指标列推导：scoresA/scoresB 键的并集（首次出现序） */
function deriveMetrics(rows: KbEvalRow[]): string[] {
  const seen: string[] = [];
  for (const r of rows) {
    for (const k of Object.keys(r.scoresA ?? {})) if (!seen.includes(k)) seen.push(k);
    for (const k of Object.keys(r.scoresB ?? {})) if (!seen.includes(k)) seen.push(k);
  }
  return seen;
}

/** 全 rows 的均分（行均分的均值；无可用值 → null，不是 0） */
function overallMean(rows: KbEvalRow[], key: 'scoresA' | 'scoresB'): number | null {
  const vals = rows
    .map((r) => meanScore(r[key]))
    .filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** 回归行判定：行均分 B < A；均分不可比时退化为任一指标 B 严格劣于 A */
function rowIsRegression(row: KbEvalRow): boolean {
  const ma = meanScore(row.scoresA);
  const mb = meanScore(row.scoresB);
  if (ma != null && mb != null) return mb < ma;
  const keys = new Set([...Object.keys(row.scoresA ?? {}), ...Object.keys(row.scoresB ?? {})]);
  for (const k of keys) {
    const a = row.scoresA?.[k];
    const b = row.scoresB?.[k];
    if (typeof a === 'number' && typeof b === 'number' && b < a) return true;
  }
  return false;
}

/** 字符级简版 diff（公共前缀 + 双指针公共后缀；中段各自独有） */
interface InlineDiff {
  prefix: string;
  aMid: string;
  bMid: string;
  suffix: string;
}
function diffInline(a: string, b: string): InlineDiff {
  const min = Math.min(a.length, b.length);
  let start = 0;
  while (start < min && a.charCodeAt(start) === b.charCodeAt(start)) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a.charCodeAt(endA - 1) === b.charCodeAt(endB - 1)) {
    endA--;
    endB--;
  }
  return { prefix: a.slice(0, start), aMid: a.slice(start, endA), bMid: b.slice(start, endB), suffix: a.slice(endA) };
}

function appendDiffText(pre: HTMLElement, prefix: string, mid: string, midClass: string, suffix: string): void {
  if (prefix) pre.append(h('span', undefined, prefix));
  if (mid) pre.append(h('span', midClass, mid));
  if (suffix) pre.append(h('span', undefined, suffix));
}

/** 结果表 grid 列模板：输入 | 输出A | 输出B | 期望 | 每指标 [A][B][Δ64px] */
function evalGridTemplate(metrics: string[]): string {
  const cols = ['minmax(140px, 1.2fr)', 'minmax(140px, 1fr)', 'minmax(140px, 1fr)', 'minmax(80px, 0.7fr)'];
  for (let i = 0; i < metrics.length; i++) cols.push('44px', '44px', '64px');
  return cols.join(' ');
}

function labelOf(runs: KbEvalRunRef[], id: string): string {
  return runs.find((r) => r.id === id)?.label ?? id;
}

function buildRunSelect(runs: KbEvalRunRef[], selected: string, tag: string): HTMLSelectElement {
  const sel = h('select', 'kb-eval-run');
  sel.dataset.run = tag;
  if (!runs.length) {
    const o = h('option', undefined, '—');
    o.value = '';
    sel.append(o);
  }
  for (const r of runs) {
    const o = h('option', undefined, r.label || r.id);
    o.value = r.id;
    sel.append(o);
  }
  sel.value = selected;
  return sel;
}

/** 截断单元格（CSS 省略号 + title 全文） */
function truncCell(text: string): HTMLElement {
  const c = h('span', 'kb-eval-cell', text);
  c.title = text;
  return c;
}

/** delta 单元格类名/文本（正 = is-up 绿，负 = is-down 红，null = '—'） */
function deltaCell(d: number | null, digits: number): HTMLElement {
  const cls = d == null ? '' : d > 0 ? ' is-up' : d < 0 ? ' is-down' : '';
  return h('span', `kb-num kb-eval-num kb-eval-delta${cls}`, d != null ? deltaLabel(d, digits) : '—');
}

/**
 * 渲染评估 run 对比（快照：整体替换 el 内容）。返回挂载容器 el。
 * 头部 runA/runB 下拉切换 → icen:kb-eval-compare { runA, runB }（消费方重取数据重渲）。
 */
export function renderKbEvalCompare(el: HTMLElement, model: KbEvalCompareModel): HTMLElement {
  if (typeof document === 'undefined') return el;
  const metrics = model.metrics && model.metrics.length ? model.metrics.slice() : deriveMetrics(model.rows);
  const runs = model.runs;
  const runA = runs[0]?.id ?? '';
  const runB = runs[1]?.id ?? runs[0]?.id ?? '';

  el.className = 'kb-eval';
  el.replaceChildren();

  /* 头部：run 选择（+ 条件性「仅看回归」过滤钮，行构建后回填） */
  const bar = h('div', 'kb-eval-bar');
  bar.append(h('span', undefined, '对比'));
  const selA = buildRunSelect(runs, runA, 'a');
  const selB = buildRunSelect(runs, runB, 'b');
  const emitCompare = (): void => {
    emitIcen(el, 'icen:kb-eval-compare', { runA: selA.value, runB: selB.value });
  };
  selA.addEventListener('change', emitCompare);
  selB.addEventListener('change', emitCompare);
  bar.append(selA, h('span', undefined, 'vs'), selB);
  el.append(bar);

  if (!model.rows.length) {
    el.append(h('div', 'kb-empty', '没有对比数据'));
    return el;
  }

  /* Summary 判级行：全 rows 均分差 + evalGrade 徽标 + deltaLabel 百分点差 */
  const meanA = overallMean(model.rows, 'scoresA');
  const meanB = overallMean(model.rows, 'scoresB');
  const delta = meanA != null && meanB != null ? meanB - meanA : null;
  const grade = evalGrade(delta);
  const summary = h('div', 'kb-eval-summary');
  summary.append(h('span', `kb-eval-grade is-${grade}`, GRADE_LABELS[grade]));
  summary.append(h('span', 'kb-num', `A 均分 ${formatScore(meanA)}`));
  summary.append(h('span', 'kb-meta', '→'));
  summary.append(h('span', 'kb-num', `B 均分 ${formatScore(meanB)}`));
  const ppCell = deltaCell(delta != null ? delta * 100 : null, 1);
  if (delta != null) ppCell.append('pp'); /* 百分点差（percentage points） */
  summary.append(ppCell);
  summary.append(h('span', 'kb-meta', `${model.rows.length} 行`));
  el.append(summary);

  /* 结果表（横向滚动容器 + 两行表头 + 行/展开体） */
  const wrap = h('div', 'kb-eval-tablewrap');
  const table = h('div', 'kb-eval-table');
  const template = evalGridTemplate(metrics);

  const head1 = h('div', 'kb-eval-grid kb-eval-grid--head');
  head1.style.gridTemplateColumns = template;
  head1.append(
    h('span', 'kb-eval-h', '输入'),
    h('span', 'kb-eval-h', `输出 ${labelOf(runs, runA)}`),
    h('span', 'kb-eval-h', `输出 ${labelOf(runs, runB)}`),
    h('span', 'kb-eval-h', '期望'),
  );
  for (const m of metrics) {
    const g = h('span', 'kb-eval-h kb-eval-h--group', m);
    g.style.gridColumn = 'span 3';
    head1.append(g);
  }
  const head2 = h('div', 'kb-eval-grid kb-eval-grid--head');
  head2.style.gridTemplateColumns = template;
  for (let i = 0; i < 4; i++) head2.append(h('span', 'kb-eval-h'));
  for (let i = 0; i < metrics.length; i++) {
    head2.append(
      h('span', 'kb-eval-h kb-eval-h--sub', 'A'),
      h('span', 'kb-eval-h kb-eval-h--sub', 'B'),
      h('span', 'kb-eval-h kb-eval-h--sub', 'Δ'),
    );
  }
  table.append(head1, head2);

  const items: Array<{ item: HTMLElement; regression: boolean }> = [];
  let filterOn = false;
  let hasRegression = false;

  for (const row of model.rows) {
    const regression = rowIsRegression(row);
    hasRegression = hasRegression || regression;
    const item = h('div', 'kb-eval-item');
    const line = h('div', 'kb-eval-grid kb-eval-rowline');
    line.style.gridTemplateColumns = template;
    line.tabIndex = 0;
    line.setAttribute('role', 'button');
    line.setAttribute('aria-expanded', 'false');

    const inputCell = h('span', 'kb-eval-cell kb-eval-cell--input');
    inputCell.append(h('span', 'kb-eval-key', row.key));
    const inputText = h('span', undefined, row.input);
    inputText.title = row.input;
    inputCell.append(inputText);
    line.append(inputCell, truncCell(row.outputA ?? '—'), truncCell(row.outputB ?? '—'), truncCell(row.expected ?? '—'));
    for (const m of metrics) {
      const a = row.scoresA?.[m] ?? null;
      const b = row.scoresB?.[m] ?? null;
      line.append(
        h('span', 'kb-num kb-eval-num', formatScore(a)),
        h('span', 'kb-num kb-eval-num', formatScore(b)),
        deltaCell(typeof a === 'number' && typeof b === 'number' ? b - a : null, 2),
      );
    }

    /* 展开体：双栏对照 + 字符级 diff + 期望 */
    const detail = h('div', 'kb-eval-detail');
    detail.hidden = true;
    const diff = diffInline(row.outputA ?? '', row.outputB ?? '');
    const colA = h('div', 'kb-eval-detail-col');
    colA.append(h('div', 'kb-eval-detail-label', '输出 A'));
    const preA = h('pre', 'kb-eval-detail-pre');
    appendDiffText(preA, diff.prefix, diff.aMid, 'kb-eval-diff-del', diff.suffix);
    colA.append(preA);
    const colB = h('div', 'kb-eval-detail-col');
    colB.append(h('div', 'kb-eval-detail-label', '输出 B'));
    const preB = h('pre', 'kb-eval-detail-pre');
    appendDiffText(preB, diff.prefix, diff.bMid, 'kb-eval-diff-ins', diff.suffix);
    colB.append(preB);
    detail.append(colA, colB);
    if (row.expected) {
      const exp = h('div', 'kb-eval-detail-expected');
      exp.append(h('span', 'kb-eval-detail-label', '期望'));
      exp.append(h('div', 'kb-eval-detail-pre', row.expected));
      detail.append(exp);
    }

    const toggle = (): void => {
      const open = line.getAttribute('aria-expanded') !== 'true';
      line.setAttribute('aria-expanded', String(open));
      detail.hidden = !open;
    };
    line.addEventListener('click', toggle);
    line.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle();
    });

    item.append(line, detail);
    items.push({ item, regression });
    table.append(item);
  }
  wrap.append(table);
  el.append(wrap);

  /* 「仅看回归」过滤钮：存在回归行才显示（spec §5.22） */
  if (hasRegression) {
    const btn = h('button', 'kb-eval-filter', '仅看回归');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      filterOn = !filterOn;
      btn.setAttribute('aria-pressed', String(filterOn));
      btn.classList.toggle('is-on', filterOn);
      for (const it of items) it.item.hidden = filterOn && !it.regression;
    });
    bar.append(btn);
  }

  return el;
}
