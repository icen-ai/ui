/*
 * @icen.ai/ui — Behavior: charts（轻量图表渲染，与 components/charts.css 配套）
 *
 * 纯 DOM 渲染（无框架、无依赖）：全部 createElement / createElementNS 构建，
 * 文本一律 textContent，禁 innerHTML。SSR 下为 no-op。
 *
 * 契约：调用方传入的 el 建议自带 .chart 类；渲染函数会先清空 el 再填充。
 * 色调 tone = 'accent' | 'success' | 'warning' | 'error' | 'muted'，经 CSS 变量注入
 * （条/段上设 --chart-tone，SVG 上直接写 stroke/fill 为 var(--token-*)）。
 *
 *   renderVBar(el,  { labels, values, tone? })            垂直柱状（.chart-vbar）
 *   renderHBar(el,  { labels, values, tone? })            水平条形（.chart-hbar）
 *   renderStack(el, { segments:[{label,value,tone?}] })   堆叠条 + 图例
 *   renderDonut(el, { segments })                         环形（SVG viewBox 120，r42 粗 14，-90° 起笔）+ 图例百分比
 *   renderLine(el,  { labels, values, tone? })            折线（SVG 360×150，面积渐变 + 4 网格线 + ≤7 轴标签）
 *
 * 空数据（values 为空 / segments 总和 ≤ 0）渲染 .chart-empty（emptyLabel 可覆盖，默认「暂无数据」）。
 */

export type ChartTone = 'accent' | 'success' | 'warning' | 'error' | 'muted';

export interface ChartSeriesOptions {
  labels: string[];
  values: number[];
  tone?: ChartTone;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

export interface ChartSegment {
  label: string;
  value: number;
  tone?: ChartTone;
}

export interface ChartSegmentsOptions {
  segments: ChartSegment[];
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function toneVar(tone: ChartTone = 'accent'): string {
  switch (tone) {
    case 'success': return 'var(--token-success)';
    case 'warning': return 'var(--token-warning)';
    case 'error': return 'var(--token-error)';
    case 'muted': return 'var(--token-text-faint)';
    case 'accent':
    default: return 'var(--token-accent)';
  }
}

function fmt(opts: { formatValue?: (value: number) => string }, value: number): string {
  return opts.formatValue ? opts.formatValue(value) : String(value);
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function renderEmpty(el: HTMLElement, label?: string): void {
  const box = document.createElement('div');
  box.className = 'chart-empty';
  box.textContent = label ?? '暂无数据';
  el.appendChild(box);
}

/** 图例行：dot + label + value（dot 上写 --chart-tone） */
function legendItem(label: string, valueText: string, tone?: ChartTone): HTMLElement {
  const row = document.createElement('div');
  row.className = 'chart-legend-item';
  const dot = document.createElement('span');
  dot.className = 'chart-legend-dot';
  if (tone) dot.style.setProperty('--chart-tone', toneVar(tone));
  const name = document.createElement('span');
  name.className = 'chart-legend-label';
  name.textContent = label;
  const val = document.createElement('span');
  val.className = 'chart-legend-value';
  val.textContent = valueText;
  row.append(dot, name, val);
  return row;
}

/** 底部轴标签行（vbar / line 共用） */
function labelsRow(labels: string[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'chart-labels';
  for (const label of labels) {
    const span = document.createElement('span');
    span.textContent = label;
    row.appendChild(span);
  }
  return row;
}

/** 垂直柱状图 */
export function renderVBar(el: HTMLElement, opts: ChartSeriesOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';
  const n = Math.min(opts.labels.length, opts.values.length);
  if (n === 0) { renderEmpty(el, opts.emptyLabel); return; }

  const labels = opts.labels.slice(0, n);
  const values = opts.values.slice(0, n);
  const max = Math.max(...values, 1);

  const wrap = document.createElement('div');
  wrap.className = 'chart-vbar';
  if (opts.tone) wrap.style.setProperty('--chart-tone', toneVar(opts.tone));
  values.forEach((value, i) => {
    const track = document.createElement('div');
    track.className = 'chart-vbar-track';
    const bar = document.createElement('div');
    bar.className = 'chart-vbar-bar';
    bar.style.height = `${Math.max(6, (value / max) * 100)}%`;
    bar.setAttribute('title', `${labels[i]}: ${fmt(opts, value)}`);
    track.appendChild(bar);
    wrap.appendChild(track);
  });
  el.append(wrap, labelsRow(labels));
}

/** 水平条形图 */
export function renderHBar(el: HTMLElement, opts: ChartSeriesOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';
  const n = Math.min(opts.labels.length, opts.values.length);
  if (n === 0) { renderEmpty(el, opts.emptyLabel); return; }

  const labels = opts.labels.slice(0, n);
  const values = opts.values.slice(0, n);
  const max = Math.max(...values, 1);

  const wrap = document.createElement('div');
  wrap.className = 'chart-hbar';
  if (opts.tone) wrap.style.setProperty('--chart-tone', toneVar(opts.tone));
  values.forEach((value, i) => {
    const row = document.createElement('div');
    row.className = 'chart-hbar-row';
    const label = document.createElement('span');
    label.className = 'chart-hbar-label';
    label.textContent = labels[i] ?? '';
    const track = document.createElement('div');
    track.className = 'chart-hbar-track';
    const bar = document.createElement('div');
    bar.className = 'chart-hbar-bar';
    bar.style.width = `${Math.max(2, (value / max) * 100)}%`;
    const val = document.createElement('span');
    val.className = 'chart-hbar-value';
    val.textContent = fmt(opts, value);
    track.appendChild(bar);
    row.append(label, track, val);
    wrap.appendChild(row);
  });
  el.appendChild(wrap);
}

/** 堆叠条形图（单条 100% + 图例） */
export function renderStack(el: HTMLElement, opts: ChartSegmentsOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';
  const total = opts.segments.reduce((sum, s) => sum + s.value, 0);
  if (opts.segments.length === 0 || total <= 0) { renderEmpty(el, opts.emptyLabel); return; }

  const bar = document.createElement('div');
  bar.className = 'chart-stack';
  for (const seg of opts.segments) {
    const s = document.createElement('div');
    s.className = 'chart-stack-seg';
    s.style.width = `${(seg.value / total) * 100}%`;
    if (seg.tone) s.style.setProperty('--chart-tone', toneVar(seg.tone));
    s.setAttribute('title', `${seg.label}: ${fmt(opts, seg.value)}`);
    bar.appendChild(s);
  }

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  for (const seg of opts.segments) {
    legend.appendChild(legendItem(seg.label, fmt(opts, seg.value), seg.tone));
  }
  el.append(bar, legend);
}

/** 环形图（SVG stroke-dasharray 累加）+ 图例百分比 */
export function renderDonut(el: HTMLElement, opts: ChartSegmentsOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';
  const total = opts.segments.reduce((sum, s) => sum + s.value, 0);
  if (opts.segments.length === 0 || total <= 0) { renderEmpty(el, opts.emptyLabel); return; }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  const wrap = document.createElement('div');
  wrap.className = 'chart-donut';

  const svg = svgEl('svg', { viewBox: '0 0 120 120', role: 'img' });
  svg.style.transform = 'rotate(-90deg)';
  svg.appendChild(svgEl('circle', {
    cx: '60', cy: '60', r: String(radius),
    fill: 'none', stroke: 'var(--token-line-soft)', 'stroke-width': '14',
  }));
  let offset = 0;
  for (const seg of opts.segments) {
    const dash = (seg.value / total) * circumference;
    svg.appendChild(svgEl('circle', {
      cx: '60', cy: '60', r: String(radius),
      fill: 'none',
      stroke: toneVar(seg.tone),
      'stroke-width': '14',
      'stroke-dasharray': `${dash} ${circumference - dash}`,
      'stroke-dashoffset': String(-offset),
      'stroke-linecap': 'butt',
    }));
    offset += dash;
  }

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  for (const seg of opts.segments) {
    legend.appendChild(legendItem(seg.label, `${Math.round((seg.value / total) * 100)}%`, seg.tone));
  }
  wrap.append(svg, legend);
  el.appendChild(wrap);
}

// 折线面积渐变 id 计数器（同页多图时保持唯一）
let lineGradientSeq = 0;

/** 折线图（面积渐变 + 网格 + 数据点 + 底部 ≤7 个轴标签） */
export function renderLine(el: HTMLElement, opts: ChartSeriesOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';
  const n = Math.min(opts.labels.length, opts.values.length);
  if (n === 0) { renderEmpty(el, opts.emptyLabel); return; }

  const labels = opts.labels.slice(0, n);
  const values = opts.values.slice(0, n);

  const width = 360;
  const height = 150;
  const pad = 14;
  const max = Math.max(...values, 1);
  const tone = toneVar(opts.tone);

  const points = values.map((value, i) => ({
    x: values.length <= 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2),
    y: height - pad - (value / max) * (height - pad * 2),
    value,
    label: labels[i] ?? '',
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const area = `${line} L${last.x.toFixed(1)},${height - pad} L${first.x.toFixed(1)},${height - pad} Z`;
  const gradientId = `icen-chart-line-${++lineGradientSeq}`;

  const wrap = document.createElement('div');
  wrap.className = 'chart-line';
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });

  const defs = svgEl('defs', {});
  const gradient = svgEl('linearGradient', { id: gradientId, x1: '0', x2: '0', y1: '0', y2: '1' });
  gradient.appendChild(svgEl('stop', { offset: '0%', 'stop-color': tone, 'stop-opacity': '0.32' }));
  gradient.appendChild(svgEl('stop', { offset: '100%', 'stop-color': tone, 'stop-opacity': '0.02' }));
  defs.appendChild(gradient);
  svg.appendChild(defs);

  for (let i = 0; i < 4; i++) {
    const y = pad + (i * (height - pad * 2)) / 3;
    svg.appendChild(svgEl('line', {
      x1: String(pad), x2: String(width - pad), y1: String(y), y2: String(y),
      stroke: 'var(--token-line-soft)', 'stroke-width': '1',
    }));
  }

  svg.appendChild(svgEl('path', { d: area, fill: `url(#${gradientId})` }));
  svg.appendChild(svgEl('path', {
    d: line, fill: 'none', stroke: tone,
    'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));

  for (const p of points) {
    const dot = svgEl('circle', {
      cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: '3',
      fill: 'var(--token-card)', stroke: tone, 'stroke-width': '2',
    });
    const title = svgEl('title', {});
    title.textContent = `${p.label}: ${fmt(opts, p.value)}`;
    dot.appendChild(title);
    svg.appendChild(dot);
  }

  wrap.append(svg, labelsRow(labels.slice(-7)));
  el.appendChild(wrap);
}
