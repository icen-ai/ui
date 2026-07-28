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
 *   renderArea(el,  { labels, values, tone? })            面积（与折线同族，面积渐变更浓、无数据点强调）
 *   renderRadar(el, { axes, series })                     雷达/蛛网（N 轴 + 多系列 + 图例）
 *   renderHeatmap(el, { data | values, weeks?, tone? })   GitHub 贡献图式热力格（7 行 × N 周，5 档色阶 + 图例）
 *   renderSparkline(el, { values, tone? })                迷你趋势线（SVG 96×28，无轴，末点高亮）
 *   renderGauge(el, { value, max?, tone?, label? })       进度环（环形单值 + 中心百分比）
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

/** 面积图（与折线同族，以面积填充为视觉主体） */
export function renderArea(el: HTMLElement, opts: ChartSeriesOptions): void {
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
  const gradientId = `icen-chart-area-${++lineGradientSeq}`;

  const wrap = document.createElement('div');
  wrap.className = 'chart-area';
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });

  const defs = svgEl('defs', {});
  const gradient = svgEl('linearGradient', { id: gradientId, x1: '0', x2: '0', y1: '0', y2: '1' });
  gradient.appendChild(svgEl('stop', { offset: '0%', 'stop-color': tone, 'stop-opacity': '0.5' }));
  gradient.appendChild(svgEl('stop', { offset: '100%', 'stop-color': tone, 'stop-opacity': '0.05' }));
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
    'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));

  for (const p of points) {
    const title = svgEl('title', {});
    title.textContent = `${p.label}: ${fmt(opts, p.value)}`;
    const inv = svgEl('circle', {
      cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: '2',
      fill: 'transparent',
    });
    inv.appendChild(title);
    svg.appendChild(inv);
  }

  wrap.append(svg, labelsRow(labels.slice(-7)));
  el.appendChild(wrap);
}

/* ═══════════ 雷达图 ═══════════ */

export interface RadarSeries {
  name: string;
  /** 各轴的值（0..max，顺序与 axes 一致）。元素类型须可转 number。 */
  values: number[];
  tone?: ChartTone;
}

export interface ChartRadarOptions {
  /** 各轴名（顺时针排列，首轴指向正上方） */
  axes: string[];
  /** 一个或多个系列。values 长度须等于 axes 长度 */
  series: RadarSeries[];
  /** 各轴最大值（默认取全部系列该轴最大向上取整） */
  max?: number;
  /** 网格环层数（默认 4） */
  levels?: number;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

/** 雷达图（N 轴蛛网 + 多系列多边形 + 图例）。 */
export function renderRadar(el: HTMLElement, opts: ChartRadarOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';
  const axes = opts.axes;
  const n = axes.length;
  if (n < 3 || opts.series.length === 0) { renderEmpty(el, opts.emptyLabel); return; }

  // 计算最大值（单一 max 或从数据推断）
  let maxVal = opts.max ?? 0;
  if (opts.max == null) {
    for (const s of opts.series) {
      for (let i = 0; i < n; i++) maxVal = Math.max(maxVal, s.values[i] ?? 0);
    }
    maxVal = niceCeil(maxVal);
  }
  if (maxVal <= 0) maxVal = 1;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const levels = Math.max(2, opts.levels ?? 4);

  const angleOf = (i: number): number => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, r: number): { x: number; y: number } => ({
    x: cx + r * Math.cos(angleOf(i)),
    y: cy + r * Math.sin(angleOf(i)),
  });

  const wrap = document.createElement('div');
  wrap.className = 'chart-radar';
  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img' });

  // 网格环（levels 层正多边形）
  for (let lv = 1; lv <= levels; lv++) {
    const r = (radius * lv) / levels;
    const pts = Array.from({ length: n }, (_, i) => {
      const p = pointAt(i, r);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    svg.appendChild(svgEl('polygon', {
      points: pts,
      fill: 'none',
      stroke: 'var(--token-line-soft)',
      'stroke-width': '1',
      'stroke-dasharray': lv === levels ? '0' : '3 2',
    }));
  }

  // 轴线 + 轴标签
  for (let i = 0; i < n; i++) {
    const edge = pointAt(i, radius);
    svg.appendChild(svgEl('line', {
      x1: String(cx), y1: String(cy),
      x2: edge.x.toFixed(1), y2: edge.y.toFixed(1),
      stroke: 'var(--token-line-soft)', 'stroke-width': '1',
    }));
    const labelP = pointAt(i, radius + 14);
    const txt = svgEl('text', {
      x: labelP.x.toFixed(1), y: labelP.y.toFixed(1),
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': '9', fill: 'var(--token-text-muted)',
    });
    txt.textContent = axes[i] ?? '';
    svg.appendChild(txt);
  }

  // 数据多边形（各系列）
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  for (const s of opts.series) {
    const tone = toneVar(s.tone);
    const pts = Array.from({ length: n }, (_, i) => {
      const v = Math.max(0, Math.min(maxVal, s.values[i] ?? 0));
      const p = pointAt(i, (v / maxVal) * radius);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');

    const polyFill = svgEl('polygon', {
      points: pts,
      fill: tone,
      'fill-opacity': '0.16',
      stroke: tone,
      'stroke-width': '2',
      'stroke-linejoin': 'round',
    });
    const title = svgEl('title', {});
    title.textContent = `${s.name}: ${s.values.map((v) => fmt(opts, v)).join(' / ')}`;
    polyFill.appendChild(title);
    svg.appendChild(polyFill);

    for (let i = 0; i < n; i++) {
      const v = Math.max(0, Math.min(maxVal, s.values[i] ?? 0));
      const p = pointAt(i, (v / maxVal) * radius);
      svg.appendChild(svgEl('circle', {
        cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: '2.5',
        fill: 'var(--token-card)', stroke: tone, 'stroke-width': '1.5',
      }));
    }
    legend.appendChild(legendItem(s.name, '', s.tone));
  }

  wrap.append(svg, legend);
  el.appendChild(wrap);
}

/** 把一个正数向上取整到 "好看" 的刻度值（1/2/5/10/20/50/…） */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const frac = v / base;
  let nice: number;
  if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}

/* ═══════════ 贡献图 / 迷你趋势 / 进度环 ═══════════ */

export interface HeatmapDatum {
  /** YYYY-MM-DD；仅用于 tooltip 与首周对齐 */
  date: string;
  value: number;
}

export interface ChartHeatmapOptions {
  /** 精确形态：日期 + 值（旧 → 新）。与 values 二选一，data 优先。 */
  data?: HeatmapDatum[];
  /** 便捷形态：最近 N 天的值（旧 → 新），日期从今天回推 */
  values?: number[];
  /** 列数（周），默认按数据量推算（向上取整到整周） */
  weeks?: number;
  tone?: ChartTone;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** GitHub 贡献图式热力格：7 行（周一 → 周日）× N 周列，5 档色阶。 */
export function renderHeatmap(el: HTMLElement, opts: ChartHeatmapOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';

  let entries: HeatmapDatum[];
  if (opts.data && opts.data.length > 0) {
    entries = opts.data;
  } else if (opts.values && opts.values.length > 0) {
    const today = new Date();
    entries = opts.values.map((value, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (opts.values!.length - 1 - i));
      return { date: isoDate(d), value };
    });
  } else {
    renderEmpty(el, opts.emptyLabel);
    return;
  }

  const weeks = opts.weeks ?? Math.ceil(entries.length / 7);
  // 只保留最后 weeks 周的数据（超出截断，与 GitHub 的窗口语义一致）
  if (entries.length > weeks * 7) entries = entries.slice(entries.length - weeks * 7);

  const max = Math.max(...entries.map((e) => e.value), 1);
  const levelOf = (v: number): number => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

  const wrap = document.createElement('div');
  wrap.className = 'chart-heatmap';
  if (opts.tone) wrap.style.setProperty('--chart-tone', toneVar(opts.tone));

  const grid = document.createElement('div');
  grid.className = 'chart-heatmap-grid';
  grid.setAttribute('role', 'img');

  // 首周对齐：第一个日期是星期几（周一 = 0），前面补占位格
  const first = new Date(`${entries[0]!.date}T00:00:00`);
  const pad = (first.getDay() + 6) % 7;
  for (let i = 0; i < pad; i++) {
    const blank = document.createElement('span');
    blank.className = 'chart-heatmap-cell is-blank';
    grid.appendChild(blank);
  }
  for (const entry of entries) {
    const cell = document.createElement('span');
    cell.className = 'chart-heatmap-cell';
    cell.dataset.level = String(levelOf(entry.value));
    cell.setAttribute('title', `${entry.date}：${fmt(opts, entry.value)}`);
    grid.appendChild(cell);
  }

  // 图例：少 → 多（5 档）
  const legend = document.createElement('div');
  legend.className = 'chart-heatmap-legend';
  const less = document.createElement('span');
  less.textContent = '少';
  const more = document.createElement('span');
  more.textContent = '多';
  legend.appendChild(less);
  for (let lv = 0; lv <= 4; lv++) {
    const cell = document.createElement('span');
    cell.className = 'chart-heatmap-cell';
    cell.dataset.level = String(lv);
    legend.appendChild(cell);
  }
  legend.appendChild(more);

  wrap.append(grid, legend);
  el.appendChild(wrap);
}

/** 迷你趋势线（无轴小图，适合嵌入指标卡）。 */
export function renderSparkline(el: HTMLElement, opts: ChartSeriesOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';
  const values = opts.values;
  if (values.length === 0) { renderEmpty(el, opts.emptyLabel); return; }

  const width = 96;
  const height = 28;
  const pad = 3;
  const max = Math.max(...values, 1);
  const tone = toneVar(opts.tone);

  const points = values.map((value, i) => ({
    x: values.length <= 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2),
    y: height - pad - (value / max) * (height - pad * 2),
    value,
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const area = `${line} L${last.x.toFixed(1)},${height - pad} L${first.x.toFixed(1)},${height - pad} Z`;

  const gradientId = `icen-chart-line-${++lineGradientSeq}`;
  const wrap = document.createElement('div');
  wrap.className = 'chart-sparkline';
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });

  const defs = svgEl('defs', {});
  const gradient = svgEl('linearGradient', { id: gradientId, x1: '0', x2: '0', y1: '0', y2: '1' });
  gradient.appendChild(svgEl('stop', { offset: '0%', 'stop-color': tone, 'stop-opacity': '0.28' }));
  gradient.appendChild(svgEl('stop', { offset: '100%', 'stop-color': tone, 'stop-opacity': '0.02' }));
  defs.appendChild(gradient);
  svg.appendChild(defs);

  svg.appendChild(svgEl('path', { d: area, fill: `url(#${gradientId})` }));
  svg.appendChild(svgEl('path', {
    d: line, fill: 'none', stroke: tone,
    'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
  const dot = svgEl('circle', {
    cx: last.x.toFixed(1), cy: last.y.toFixed(1), r: '2.4',
    fill: 'var(--token-card)', stroke: tone, 'stroke-width': '1.6',
  });
  const title = svgEl('title', {});
  title.textContent = fmt(opts, last.value);
  dot.appendChild(title);
  svg.appendChild(dot);

  wrap.appendChild(svg);
  el.appendChild(wrap);
}

export interface ChartGaugeOptions {
  value: number;
  max?: number;
  tone?: ChartTone;
  /** 中心百分比下方的小标签 */
  label?: string;
  formatValue?: (value: number) => string;
}

/** 进度环（环形单值 + 中心百分比）。 */
export function renderGauge(el: HTMLElement, opts: ChartGaugeOptions): void {
  if (typeof document === 'undefined') return;
  el.textContent = '';
  const max = opts.max ?? 100;
  const ratio = max > 0 ? Math.min(1, Math.max(0, opts.value / max)) : 0;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  const wrap = document.createElement('div');
  wrap.className = 'chart-gauge';
  if (opts.tone) wrap.style.setProperty('--chart-tone', toneVar(opts.tone));

  const svg = svgEl('svg', { viewBox: '0 0 120 120', role: 'img' });
  svg.style.transform = 'rotate(-90deg)';
  svg.appendChild(svgEl('circle', {
    cx: '60', cy: '60', r: String(radius),
    fill: 'none', stroke: 'var(--token-line-soft)', 'stroke-width': '10',
  }));
  const dash = ratio * circumference;
  svg.appendChild(svgEl('circle', {
    cx: '60', cy: '60', r: String(radius),
    fill: 'none',
    stroke: toneVar(opts.tone),
    'stroke-width': '10',
    'stroke-dasharray': `${dash} ${circumference - dash}`,
    'stroke-linecap': 'round',
  }));

  const center = document.createElement('div');
  center.className = 'chart-gauge-center';
  const val = document.createElement('span');
  val.className = 'chart-gauge-value';
  val.textContent = opts.formatValue ? opts.formatValue(opts.value) : `${Math.round(ratio * 100)}%`;
  center.appendChild(val);
  if (opts.label) {
    const lab = document.createElement('span');
    lab.className = 'chart-gauge-label';
    lab.textContent = opts.label;
    center.appendChild(lab);
  }

  wrap.append(svg, center);
  el.appendChild(wrap);
}
