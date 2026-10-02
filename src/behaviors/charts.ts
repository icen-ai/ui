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
 * ── 底层渲染器（保留直调；多系列与交互标记已内建）──
 *   全部返回传入的容器 el，并在收尾自动挂交互委托（bindChartEvents）——
 *   直调底层渲染器同样能收 icen:chart-* 事件（hover/click/dblclick/contextmenu
 *   + 内置 tooltip），无需经过 renderChart。
 *   renderVBar(el,  { labels, values, series?, stacked?, tone? })   垂直柱状（分组/堆叠）
 *   renderHBar(el,  { labels, values, tone? })                      水平条形
 *   renderStack(el, { segments:[{label,value,tone?}] })             堆叠条 + 图例
 *   renderDonut(el, { segments })                                   环形（dasharray 累加）+ 图例百分比
 *   renderLine(el,  { labels, values, series?, fill?, tone? })      折线（多系列调色盘 + 可切换图例）
 *   renderArea(el,  { labels, values, tone? })                      面积
 *   renderRadar(el, { axes, series })                               雷达/蛛网（多系列 + 可切换图例）
 *   renderHeatmap(el, { data | values, weeks?, tone?, weekStart?, labels? })  周格热力（7 行 × N 周，5 档色阶）
 *   renderCalendar(el, { dates+values | data, tone?, weekStart?, labels? })   贡献日历（月份标签 + 星期列，GitHub 同款）
 *   renderSparkline(el, { values, tone? })                          迷你趋势线
 *   renderGauge(el, { value, max?, tone?, label? })                 进度环
 *   renderScatter(el, { points, tone?, xLabel?, yLabel? })          散点/气泡（size 第三维 → 半径 3–10）
 *
 * ── 通用层（renderChart 统一入口，AI 调用层的直接底座）──
 *   renderChart(el, spec) → { el, spec, update(spec), on(name, fn), destroy() }
 *     spec 为纯 JSON（ChartSpec）：type 缺省由 inferChartType 推断（时间序→line、
 *     占比→donut、dates→calendar、points→scatter…）；labels/values/series/segments/
 *     axes/points 直给，或 data[] + dims 字段映射（任意维度记录 pivot 成类目×系列）。
 *     交互委托（挂 el 存活，跨 update）：icen:chart-hover（phase enter/move/leave，
 *     detail 含 index/seriesIndex/seriesName/label/value/指针坐标）/ click / dblclick /
 *     contextmenu（默认 preventDefault，接自家 context-menu 组件）；内置 tooltip
 *     portal 跟随指针（spec.tooltip: false 关闭）；spec.title 渲染 .chart-title。
 *     图例可见性：有图例的图型渲染头部行（.chart-head = 标题 + 小眼睛钮），
 *     点击切换根 data-legend-hidden（容器级 CSS 隐藏全部图型图例，统一继承），
 *     派 icen:chart-legend-visibility { visible }；spec.legend=false 定初值。
 *   normalizeChartSpec(raw)   归一：字符串 JSON.parse / 类型别名（bar→vbar、pie→donut、
 *                             contribution→calendar…）/ 字符串数值容错 / data[] pivot；不抛异常
 *   inferChartType(spec)      自动选型（确定性规则）
 *   chartFormatValue(format)  格式化描述符 → 函数（compact/percent/ms + unit 后缀——
 *                             替代函数回调，可 JSON 序列化，AI 可给）
 *   bindChartEvents(root)     交互委托独立挂载（幂等，返回解绑；renderChart 内部同款）
 *   registerChartTone(name, cssVar)  注册自定义调色盘档位（tone 命名取色）
 *
 * 空数据（values 为空 / segments 总和 ≤ 0）渲染 .chart-empty（emptyLabel 可覆盖，默认「暂无数据」）。
 * 图例切换（多系列 line/vbar/radar）：点击图例行 → 同系列标记与行挂 .is-off（纯视觉淡化，
 * 不重排），派 icen:chart-legend-toggle {key, seriesIndex, hidden}。
 */

import { emitIcen } from './events';

/** 色调名：内置 5 语义名（经 --token-* 取色）；`string & {}` 保自动补全同时放行 registerChartTone 注册的命名档 */
export type ChartTone = 'accent' | 'success' | 'warning' | 'error' | 'muted' | (string & {});

export interface ChartSeriesOptions extends ChartChromeOptions {
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

export interface ChartSegmentsOptions extends ChartChromeOptions {
  segments: ChartSegment[];
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/* 自定义调色盘档位注册表（name → CSS 变量）：toneVar 先查这里再回退内置语义名 */
const REGISTERED_TONES = new Map<string, string>();

/**
 * 注册自定义调色盘档位（CSS 变量名，宿主须在样式里提供该变量）；tone 取值在
 * 内置 5 语义名（accent/success/warning/error/muted）与调色盘序号之外的自定义
 * 命名档。注册后任意 tone 槽位（spec.series[i].tone / segments[].tone / 各渲染器
 * opts.tone）用该名字取色；查不到该变量时浏览器回退到初始色。
 *
 * @example
 * ```css
 * :root { --my-brand: #e2543e; }
 * ```
 * registerChartTone('brand', '--my-brand');
 * spec.series[0].tone = 'brand';
 */
export function registerChartTone(name: string, cssVar: string): void {
  if (!name || !cssVar) return;
  REGISTERED_TONES.set(name, cssVar.startsWith('var(') ? cssVar : `var(${cssVar})`);
}

function toneVar(tone: ChartTone = 'accent'): string {
  const registered = REGISTERED_TONES.get(tone);
  if (registered) return registered;
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

/** 求最大值（下限 1，防除零）。循环实现，避免超大数组 Math.max(...values) 栈溢出 */
function maxOf(values: number[]): number {
  let max = 1;
  for (const v of values) if (v > max) max = v;
  return max;
}

/** 轴标签抽样：数据点多于 max 时均匀抽取 max 个（含首尾），与点位的全宽坐标系对齐 */
function sampleLabels(labels: string[], max = 7): string[] {
  if (labels.length <= max) return labels;
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    out.push(labels[Math.round((i * (labels.length - 1)) / (max - 1))] ?? '');
  }
  return out;
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

/* ═══ 通用层共享助手（多系列 / 调色 / 数据标记 / 交互图例）═══ */

/** 多系列系列项（ChartSpec 的 series 与各图型共用形态）；tone 可为语义名或调色盘序号 1..6 */
export interface ChartSeriesSpec {
  name: string;
  values: number[];
  tone?: ChartTone | number;
}

/** 单系列 values / 多系列 series 两种输入归一为系列数组 */
function normalizeSeriesInput(opts: { values?: number[]; tone?: ChartTone; series?: ChartSeriesSpec[] }): ChartSeriesSpec[] {
  if (opts.series && opts.series.length > 0) return opts.series;
  return [{ name: '', values: opts.values ?? [], tone: opts.tone }];
}

/** 调色盘（与 charts.css 的 .chart-tone-1..6 一致）：序号 → CSS 变量；字符串 tone（语义名 / registerChartTone 注册名）先查注册表再回退内置 */
function toneOf(tone: ChartTone | number | undefined, seriesIndex: number): string | undefined {
  if (typeof tone === 'string') return toneVar(tone);
  if (typeof tone === 'number') return paletteVar(tone);
  return seriesIndex > 0 ? paletteVar(((seriesIndex - 1) % 6) + 1) : undefined;
}
const PALETTE_VARS = [
  'var(--token-accent)',
  'var(--token-accent-cold)',
  'var(--token-success)',
  'var(--token-warning)',
  'var(--token-info)',
  'color-mix(in srgb, var(--token-text) 50%, transparent)',
];
function paletteVar(index: number): string {
  const i = ((Math.floor(index) - 1) % 6 + 6) % 6;
  return PALETTE_VARS[i]!;
}

/** 交互事件携带的标记数据（renderChart 委托层据此派 icen:chart-* 事件） */
export interface ChartMarkData {
  index?: number;
  seriesIndex?: number;
  seriesName?: string;
  label?: string;
  value?: number;
}

function setMarkData(node: Element, data: ChartMarkData): void {
  node.setAttribute('data-chart-mark', '1');
  if (data.index != null) node.setAttribute('data-chart-index', String(data.index));
  if (data.seriesIndex != null) node.setAttribute('data-chart-series', String(data.seriesIndex));
  if (data.seriesName != null) node.setAttribute('data-chart-series-name', String(data.seriesName));
  if (data.label != null) node.setAttribute('data-chart-label', String(data.label));
  if (data.value != null) node.setAttribute('data-chart-value', String(data.value));
}

function copyMarkData(target: Element, source: Element): void {
  for (const attr of Array.from(source.attributes)) {
    if (attr.name.startsWith('data-chart-')) target.setAttribute(attr.name, attr.value);
  }
}

/* ═══ 图表 chrome（全部渲染器统一继承）：头部行 + 图例可见性小眼睛 ═══
 * 任何渲染出图例的图型（以及给了 title 的任意图型）都渲染 .chart-head：
 * 标题（左）+ 小眼睛钮（右）。点击切换根 data-legend-hidden，容器级 CSS
 * 隐藏全部图例；图表体渲染进内层 .chart-body（渲染器契约是清空传入 el，
 * 头部不能与图表体同层）。 */

const CHART_EYE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>';
const CHART_EYE_OFF_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

function parseChartSvg(svg: string): Element | null {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const el = doc.documentElement;
    return el && el.tagName.toLowerCase() === 'svg' && !doc.querySelector('parsererror')
      ? document.importNode(el, true)
      : null;
  } catch {
    return null;
  }
}

/** chrome 选项（各渲染器 options 皆含）：title 进头部行；legend=false 初始隐藏图例 */
export interface ChartChromeOptions {
  title?: string;
  legend?: boolean;
}

/** 跨渲染存活的图例隐藏状态（renderChart 的 update 复渲染沿用；直调不传=每次新状态） */
export interface ChartLegendState {
  hidden: boolean | null;
}

/**
 * 渲染外壳：head（title + 小眼睛，仅 title 或有图例时）+ .chart-body 图表体。
 * paint 在 body 上作画（渲染器契约=清空传入 el，故不能直接挂 el）。
 */
function withChrome(
  el: HTMLElement,
  opts: ChartChromeOptions,
  hasLegend: boolean,
  paint: (body: HTMLElement) => void,
  state?: ChartLegendState,
): void {
  /* 已在 chrome 内（renderChart 的 .chart-body）：直接作画，不重复包装头部 */
  if (el.dataset.chartBody != null) {
    el.textContent = '';
    paint(el);
    return;
  }
  el.textContent = '';
  const body = document.createElement('div');
  body.className = 'chart-body';
  body.dataset.chartBody = '';
  if (!opts.title && !hasLegend) {
    el.appendChild(body);
    paint(body);
    return;
  }
  let hidden = state && state.hidden != null ? state.hidden : opts.legend === false;
  if (state) state.hidden = hidden;
  el.setAttribute('data-legend-hidden', String(hidden));

  const head = document.createElement('div');
  head.className = 'chart-head';
  const title = document.createElement('div');
  title.className = 'chart-title';
  title.textContent = opts.title ?? '';
  if (!opts.title) title.setAttribute('aria-hidden', 'true');

  const eye = document.createElement('button');
  eye.type = 'button';
  eye.className = 'chart-legend-eye';
  eye.dataset.chartLegendEye = '';
  const syncEye = (): void => {
    const nowHidden = el.getAttribute('data-legend-hidden') === 'true';
    eye.setAttribute('aria-pressed', String(!nowHidden));
    eye.setAttribute('aria-label', nowHidden ? '显示图例' : '隐藏图例');
    eye.setAttribute('title', nowHidden ? '显示图例' : '隐藏图例');
    const icon = parseChartSvg(nowHidden ? CHART_EYE_OFF_SVG : CHART_EYE_SVG);
    if (icon) eye.replaceChildren(icon);
  };
  eye.addEventListener('click', () => {
    const nowHidden = el.getAttribute('data-legend-hidden') === 'true';
    hidden = !nowHidden;
    if (state) state.hidden = hidden;
    el.setAttribute('data-legend-hidden', String(hidden));
    syncEye();
    emitIcen(el, 'icen:chart-legend-visibility', { visible: hidden ? false : true });
  });
  syncEye();

  head.append(title, eye);
  el.append(head, body);
  paint(body);
}

/** 图例项元信息（toggleLegend 消费） */
interface LegendKey {
  key: string;
  label: string;
  tone?: ChartTone | number;
  si: number;
}

/**
 * 可切换图例：点击图例行 → 同 key 的全部标记（data-chart-key）与图例行本身
 * 挂/摘 .is-off（纯视觉淡化，不重排）。标记侧由调用方在生成时附 data-chart-key。
 */
function toggleLegend(items: LegendKey[], scope: ParentNode, _opts: unknown): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'chart-legend chart-legend--toggle';
  for (const item of items) {
    const row = legendItem(item.label, '', item.tone as ChartTone | undefined);
    row.classList.add('chart-legend-toggle-item');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.setAttribute('aria-pressed', 'true');
    row.dataset.chartKey = item.key;
    const dot = row.querySelector<HTMLElement>('.chart-legend-dot');
    const toneColor = toneOf(item.tone, item.si + 1);
    if (dot && toneColor) dot.style.setProperty('--chart-tone', toneColor);
    const toggle = (): void => {
      const off = row.classList.toggle('is-off');
      row.setAttribute('aria-pressed', String(!off));
      scope.querySelectorAll(`[data-chart-key="${CSS.escape(item.key)}"]`).forEach((m) => {
        m.classList.toggle('is-off', off);
      });
      emitIcen(legend, 'icen:chart-legend-toggle', { key: item.key, seriesIndex: item.si, hidden: off });
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
    legend.appendChild(row);
  }
  /* 给同 key 标记补 data-chart-key（本图渲染域内、按系列序号对位） */
  for (const item of items) {
    scope.querySelectorAll(`[data-chart-series="${item.si}"]`).forEach((m) => {
      if (!m.hasAttribute('data-chart-key')) m.setAttribute('data-chart-key', item.key);
    });
  }
  return legend;
}

/** 垂直柱状图（单系列，或 series 多系列分组/堆叠——通用层与 renderChart 消费） */
export interface ChartVBarOptions extends ChartSeriesOptions {
  /** 多系列（labels 共用，values 长度对齐）；缺省回落单系列 values */
  series?: ChartSeriesSpec[];
  /** 多系列时堆叠（默认分组并排） */
  stacked?: boolean;
}

export function renderVBar(el: HTMLElement, opts: ChartVBarOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  const seriesList = normalizeSeriesInput(opts);
  const labels = opts.labels ?? [];
  const n = Math.min(labels.length, ...seriesList.map((s) => s.values.length));
  withChrome(el, opts, seriesList.length > 1, (body) => {
  if (n === 0 || seriesList.length === 0) { renderEmpty(body, opts.emptyLabel); return; }

  const labelsUsed = labels.slice(0, n);
  /* 分组模式按簇内最大值归一；堆叠按各行合计的最大值归一 */
  let max = 1;
  if (opts.stacked && seriesList.length > 1) {
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const s of seriesList) sum += Math.max(0, s.values[i] ?? 0);
      if (sum > max) max = sum;
    }
  } else {
    for (const s of seriesList) max = Math.max(max, maxOf(s.values.slice(0, n)));
  }

  const wrap = document.createElement('div');
  wrap.className = 'chart-vbar';
  if (opts.tone) wrap.style.setProperty('--chart-tone', toneVar(opts.tone));
  for (let i = 0; i < n; i++) {
    const track = document.createElement('div');
    track.className = 'chart-vbar-track';
    if (seriesList.length > 1) {
      track.classList.add('chart-vbar-track--multi');
      if (opts.stacked) track.classList.add('chart-vbar-track--stacked');
    }
    seriesList.forEach((s, si) => {
      const value = s.values[i] ?? 0;
      const bar = document.createElement('div');
      bar.className = 'chart-vbar-bar';
      const height = value > 0 ? Math.max(6, (value / max) * 100) : 0;
      bar.style.height = `${height}%`;
      const toneColor = toneOf(s.tone, si);
      if (toneColor) bar.style.setProperty('--chart-tone', toneColor);
      bar.setAttribute('title', seriesList.length > 1 ? `${labelsUsed[i]} · ${s.name}: ${fmt(opts, value)}` : `${labelsUsed[i]}: ${fmt(opts, value)}`);
      setMarkData(bar, {
        index: i,
        seriesIndex: seriesList.length > 1 ? si : undefined,
        seriesName: seriesList.length > 1 ? s.name : undefined,
        label: labelsUsed[i] ?? '',
        value,
      });
      track.appendChild(bar);
    });
    wrap.appendChild(track);
  }
  body.append(wrap, labelsRow(labelsUsed));
  if (seriesList.length > 1) body.appendChild(toggleLegend(seriesList.map((s, si) => ({ key: s.name, label: s.name, tone: s.tone, si })), wrap, opts));
  });
  attachChartInteraction(el, 'vbar');
  return el;
}

/** 水平条形图 */
export function renderHBar(el: HTMLElement, opts: ChartSeriesOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, false, (body) => {
  const n = Math.min(opts.labels.length, opts.values.length);
  if (n === 0) { renderEmpty(body, opts.emptyLabel); return; }

  const labels = opts.labels.slice(0, n);
  const values = opts.values.slice(0, n);
  const max = maxOf(values);

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
    /* 0 值不画最小宽度（画 0）；>0 的极小值保留 2% 可视最小宽度 */
    bar.style.width = value > 0 ? `${Math.max(2, (value / max) * 100)}%` : '0%';
    setMarkData(bar, { index: i, label: labels[i] ?? '', value });
    const val = document.createElement('span');
    val.className = 'chart-hbar-value';
    val.textContent = fmt(opts, value);
    track.appendChild(bar);
    row.append(label, track, val);
    wrap.appendChild(row);
  });
  body.appendChild(wrap);
  });
  attachChartInteraction(el, 'hbar');
  return el;
}

/** 堆叠条形图（单条 100% + 图例） */
export function renderStack(el: HTMLElement, opts: ChartSegmentsOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, opts.segments.length > 0, (body) => {
  const total = opts.segments.reduce((sum, s) => sum + s.value, 0);
  if (opts.segments.length === 0 || total <= 0) { renderEmpty(body, opts.emptyLabel); return; }

  const bar = document.createElement('div');
  bar.className = 'chart-stack';
  for (const seg of opts.segments) {
    const s = document.createElement('div');
    s.className = 'chart-stack-seg';
    s.style.width = `${(seg.value / total) * 100}%`;
    if (seg.tone) s.style.setProperty('--chart-tone', toneVar(seg.tone));
    s.setAttribute('title', `${seg.label}: ${fmt(opts, seg.value)}`);
    setMarkData(s, { index: opts.segments.indexOf(seg), label: seg.label, value: seg.value });
    bar.appendChild(s);
  }

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  for (const seg of opts.segments) {
    legend.appendChild(legendItem(seg.label, fmt(opts, seg.value), seg.tone));
  }
  body.append(bar, legend);
  });
  attachChartInteraction(el, 'stack');
  return el;
}

/** 环形图（SVG stroke-dasharray 累加）+ 图例百分比 */
export function renderDonut(el: HTMLElement, opts: ChartSegmentsOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, opts.segments.length > 0, (body) => {
  const total = opts.segments.reduce((sum, s) => sum + s.value, 0);
  if (opts.segments.length === 0 || total <= 0) { renderEmpty(body, opts.emptyLabel); return; }

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
  opts.segments.forEach((seg, segIndex) => {
    const dash = (seg.value / total) * circumference;
    const arc = svgEl('circle', {
      cx: '60', cy: '60', r: String(radius),
      fill: 'none',
      stroke: toneVar(seg.tone),
      'stroke-width': '14',
      'stroke-dasharray': `${dash} ${circumference - dash}`,
      'stroke-dashoffset': String(-offset),
      'stroke-linecap': 'butt',
    });
    setMarkData(arc, { index: segIndex, label: seg.label, value: seg.value });
    svg.appendChild(arc);
    offset += dash;
  });

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  for (const seg of opts.segments) {
    legend.appendChild(legendItem(seg.label, `${Math.round((seg.value / total) * 100)}%`, seg.tone));
  }
  wrap.append(svg, legend);
  body.appendChild(wrap);
  });
  attachChartInteraction(el, 'donut');
  return el;
}

// 折线面积渐变 id 计数器（同页多图时保持唯一）
let lineGradientSeq = 0;

/** 折线图（面积渐变 + 网格 + 数据点 + 底部 ≤7 个轴标签；series 多系列走调色盘 + 可切换图例） */
export interface ChartLineOptions extends ChartSeriesOptions {
  /** 多系列（labels 共用）；缺省回落单系列 values */
  series?: ChartSeriesSpec[];
  /** 多系列时是否填充面积（默认首系列填充；area 类型全填充） */
  fill?: boolean;
}

export function renderLine(el: HTMLElement, opts: ChartLineOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  const seriesList = normalizeSeriesInput(opts);
  const labels = opts.labels ?? [];
  const n = Math.min(labels.length, ...seriesList.map((s) => s.values.length));
  withChrome(el, opts, seriesList.length > 1, (body) => {
  if (n === 0 || seriesList.length === 0) { renderEmpty(body, opts.emptyLabel); return; }

  const labelsUsed = labels.slice(0, n);
  const width = 360;
  const height = 150;
  const pad = 14;
  let max = 1;
  for (const s of seriesList) max = Math.max(max, maxOf(s.values.slice(0, n)));

  const wrap = document.createElement('div');
  wrap.className = 'chart-line';
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
  const defs = svgEl('defs', {});

  for (let i = 0; i < 4; i++) {
    const y = pad + (i * (height - pad * 2)) / 3;
    svg.appendChild(svgEl('line', {
      x1: String(pad), x2: String(width - pad), y1: String(y), y2: String(y),
      stroke: 'var(--token-line-soft)', 'stroke-width': '1',
    }));
  }

  seriesList.forEach((s, si) => {
    const tone = toneOf(s.tone, si) ?? toneVar(opts.tone);
    const values = s.values.slice(0, n);
    const points = values.map((value, i) => ({
      i,
      x: n <= 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2),
      y: height - pad - (Math.max(0, value) / max) * (height - pad * 2),
      value,
      label: labelsUsed[i] ?? '',
    }));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const last = points[points.length - 1]!;
    const first = points[0]!;

    const fillArea = seriesList.length === 1 || opts.fill;
    if (fillArea) {
      const area = `${line} L${last.x.toFixed(1)},${height - pad} L${first.x.toFixed(1)},${height - pad} Z`;
      const gradientId = `icen-chart-line-${++lineGradientSeq}`;
      const gradient = svgEl('linearGradient', { id: gradientId, x1: '0', x2: '0', y1: '0', y2: '1' });
      const strong = seriesList.length > 1 ? '0.20' : '0.32';
      gradient.appendChild(svgEl('stop', { offset: '0%', 'stop-color': tone, 'stop-opacity': strong }));
      gradient.appendChild(svgEl('stop', { offset: '100%', 'stop-color': tone, 'stop-opacity': '0.02' }));
      defs.appendChild(gradient);
      const areaPath = svgEl('path', { d: area, fill: `url(#${gradientId})` });
      if (seriesList.length > 1) {
        setMarkData(areaPath, { seriesIndex: si, seriesName: s.name, label: s.name, value: values.reduce((a, b) => a + b, 0) });
      }
      svg.appendChild(areaPath);
    }

    const linePath = svgEl('path', {
      d: line, fill: 'none', stroke: tone,
      'stroke-width': seriesList.length > 1 ? '2' : '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    });
    const lineTitle = svgEl('title', {});
    lineTitle.textContent = s.name || '数值';
    linePath.appendChild(lineTitle);
    setMarkData(linePath, { seriesIndex: si, seriesName: s.name, label: s.name, value: values[values.length - 1] ?? 0 });
    svg.appendChild(linePath);

    for (const p of points) {
      const dot = svgEl('circle', {
        cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: '3',
        fill: 'var(--token-card)', stroke: tone, 'stroke-width': '2',
      });
      const title = svgEl('title', {});
      title.textContent = seriesList.length > 1 ? `${p.label} · ${s.name}: ${fmt(opts, p.value)}` : `${p.label}: ${fmt(opts, p.value)}`;
      dot.appendChild(title);
      setMarkData(dot, {
        index: p.i,
        seriesIndex: seriesList.length > 1 ? si : undefined,
        seriesName: seriesList.length > 1 ? s.name : undefined,
        label: p.label,
        value: p.value,
      });
      svg.appendChild(dot);
      /* 加大命中区（透明 8px 圆，hover/点击手感） */
      const hit = svgEl('circle', {
        cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: '8', fill: 'transparent',
        'data-chart-hit': '1',
      });
      copyMarkData(hit, dot);
      svg.appendChild(hit);
    }
  });

  if (defs.firstChild) svg.insertBefore(defs, svg.firstChild);
  wrap.append(svg, labelsRow(sampleLabels(labelsUsed)));
  body.appendChild(wrap);
  if (seriesList.length > 1) body.appendChild(toggleLegend(seriesList.map((s, si) => ({ key: s.name, label: s.name, tone: s.tone, si })), wrap, opts));
  });
  attachChartInteraction(el, 'line');
  return el;
}

/** 面积图（与折线同族，以面积填充为视觉主体） */
export function renderArea(el: HTMLElement, opts: ChartSeriesOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, false, (body) => {
  const n = Math.min(opts.labels.length, opts.values.length);
  if (n === 0) { renderEmpty(body, opts.emptyLabel); return; }

  const labels = opts.labels.slice(0, n);
  const values = opts.values.slice(0, n);

  const width = 360;
  const height = 150;
  const pad = 14;
  const max = maxOf(values);
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

  wrap.append(svg, labelsRow(sampleLabels(labels)));
  body.appendChild(wrap);
  });
  attachChartInteraction(el, 'area');
  return el;
}

/* ═══════════ 雷达图 ═══════════ */

export interface RadarSeries {
  name: string;
  /** 各轴的值（0..max，顺序与 axes 一致）。元素类型须可转 number。 */
  values: number[];
  tone?: ChartTone;
}

export interface ChartRadarOptions extends ChartChromeOptions {
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
export function renderRadar(el: HTMLElement, opts: ChartRadarOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, opts.series.length > 1, (body) => {
  const axes = opts.axes;
  const n = axes.length;
  if (n < 3 || opts.series.length === 0) { renderEmpty(body, opts.emptyLabel); return; }

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

  // 数据多边形（各系列，多系列走可切换图例）
  const legendItems: LegendKey[] = [];
  opts.series.forEach((s, si) => {
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
    setMarkData(polyFill, { seriesIndex: si, seriesName: s.name || undefined, label: s.name, value: s.values.reduce((a, b) => a + (b || 0), 0) });
    svg.appendChild(polyFill);

    for (let i = 0; i < n; i++) {
      const v = Math.max(0, Math.min(maxVal, s.values[i] ?? 0));
      const p = pointAt(i, (v / maxVal) * radius);
      const dot = svgEl('circle', {
        cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: '2.5',
        fill: 'var(--token-card)', stroke: tone, 'stroke-width': '1.5',
      });
      setMarkData(dot, { index: i, seriesIndex: si, seriesName: s.name || undefined, label: axes[i] ?? '', value: s.values[i] ?? 0 });
      svg.appendChild(dot);
    }
    legendItems.push({ key: s.name || `系列${si + 1}`, label: s.name || `系列${si + 1}`, tone: s.tone, si });
  });

  wrap.append(svg, opts.series.length > 1 ? toggleLegend(legendItems, wrap, opts) : (() => {
    const l = document.createElement('div');
    l.className = 'chart-legend';
    return l;
  })());
  body.appendChild(wrap);
  });
  attachChartInteraction(el, 'radar');
  return el;
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

/** calendar/heatmap 本地化文案：纯字符串描述符，保持 JSON 可序列化（ChartSpec 是 AI 可调用的纯 JSON 契约，禁函数） */
export interface ChartI18nLabels {
  /** 周标签（7 项，行序与 weekStart 对齐；缺省 ['一','','三','','五','','日']，weekStart=0 时自动旋转为周日首） */
  weekdays?: string[];
  /** 月标签（12 项，索引即月 0..11；缺省 `${m+1}月`） */
  months?: string[];
  /** 色阶图例左端文案（默认「少」） */
  less?: string;
  /** 色阶图例右端文案（默认「多」） */
  more?: string;
}

export interface ChartHeatmapOptions extends ChartChromeOptions {
  /** 精确形态：日期 + 值（旧 → 新）。与 values 二选一，data 优先。 */
  data?: HeatmapDatum[];
  /** 便捷形态：最近 N 天的值（旧 → 新），日期从今天回推 */
  values?: number[];
  /** 列数（周），默认按数据量推算（向上取整到整周） */
  weeks?: number;
  tone?: ChartTone;
  /** 本地化：周首日（0=周日，默认 1=周一；与 date-picker 的 data-date-picker-week-start 语义对齐）与标签文案（纯字符串，保持 JSON 可序列化） */
  weekStart?: 0 | 1;
  labels?: ChartI18nLabels;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 周一首默认周标签（['一','','三','','五','','日']）按 JS 星期序号（0=周日..6=周六）取文案 */
function weekdayLabelAt(defaults: string[], day: number): string {
  return defaults[(day + 6) % 7] ?? '';
}

/** GitHub 贡献图式热力格：7 行（默认周一 → 周日，weekStart=0 则周日起）× N 周列，5 档色阶。 */
export function renderHeatmap(el: HTMLElement, opts: ChartHeatmapOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, true, (body) => {

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
    renderEmpty(body, opts.emptyLabel);
    return;
  }

  const weeks = opts.weeks ?? Math.ceil(entries.length / 7);
  // 只保留最后 weeks 周的数据（超出截断，与 GitHub 的窗口语义一致）
  if (entries.length > weeks * 7) entries = entries.slice(entries.length - weeks * 7);

  const max = maxOf(entries.map((e) => e.value));
  const levelOf = (v: number): number => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

  const wrap = document.createElement('div');
  wrap.className = 'chart-heatmap';
  if (opts.tone) wrap.style.setProperty('--chart-tone', toneVar(opts.tone));

  const grid = document.createElement('div');
  grid.className = 'chart-heatmap-grid';
  grid.setAttribute('role', 'img');

  // 首周对齐：第一个日期是星期几（周首日 = 第 0 行），前面补占位格
  const weekStart = opts.weekStart === 0 ? 0 : 1;
  const first = new Date(`${entries[0]!.date}T00:00:00`);
  const pad = (first.getDay() + 7 - weekStart) % 7;
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
    setMarkData(cell, { index: entries.indexOf(entry), label: entry.date, value: entry.value });
    grid.appendChild(cell);
  }

  // 图例：少 → 多（5 档；文案可经 labels.less/labels.more 本地化）
  const legend = document.createElement('div');
  legend.className = 'chart-heatmap-legend';
  const less = document.createElement('span');
  less.textContent = opts.labels?.less ?? '少';
  const more = document.createElement('span');
  more.textContent = opts.labels?.more ?? '多';
  legend.appendChild(less);
  for (let lv = 0; lv <= 4; lv++) {
    const cell = document.createElement('span');
    cell.className = 'chart-heatmap-cell';
    cell.dataset.level = String(lv);
    legend.appendChild(cell);
  }
  legend.appendChild(more);

  wrap.append(grid, legend);
  body.appendChild(wrap);
  });
  attachChartInteraction(el, 'heatmap');
  return el;
}

/** 迷你趋势线（无轴小图，适合嵌入指标卡）。 */
export function renderSparkline(el: HTMLElement, opts: ChartSeriesOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, false, (body) => {
  const values = opts.values;
  if (values.length === 0) { renderEmpty(body, opts.emptyLabel); return; }

  const width = 96;
  const height = 28;
  const pad = 3;
  const max = maxOf(values);
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
  body.appendChild(wrap);
  });
  attachChartInteraction(el, 'sparkline');
  return el;
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
export function renderGauge(el: HTMLElement, opts: ChartGaugeOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
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
  attachChartInteraction(el, 'gauge');
  return el;
}

/* ═══════════ 日历热力图（GitHub 贡献图完整形态：月份标签 + 周格）═══════════ */

export interface ChartCalendarOptions extends ChartChromeOptions {
  /** ISO 日期数组（YYYY-MM-DD，与 values 配对；或用 data） */
  dates?: string[];
  values?: number[];
  /** 精确形态：{date, value}[]（与 dates+values 二选一，优先） */
  data?: HeatmapDatum[];
  tone?: ChartTone;
  /** 本地化：周首日（0=周日，默认 1=周一；与 date-picker 的 data-date-picker-week-start 语义对齐）与标签文案（纯字符串，保持 JSON 可序列化） */
  weekStart?: 0 | 1;
  labels?: ChartI18nLabels;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

/** 贡献日历（calendar heatmap）：dates → 自动周布局 + 月份标签，GitHub 同款。周首日与文案可经 weekStart/labels 本地化。 */
export function renderCalendar(el: HTMLElement, opts: ChartCalendarOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, true, (body) => {

  let entries: HeatmapDatum[];
  if (opts.data && opts.data.length > 0) {
    entries = opts.data;
  } else if (opts.dates && opts.dates.length > 0 && opts.values) {
    entries = opts.dates.slice(0, opts.values.length).map((date, i) => ({ date, value: opts.values![i] ?? 0 }));
  } else {
    renderEmpty(body, opts.emptyLabel);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'chart-calendar';
  if (opts.tone) wrap.style.setProperty('--chart-tone', toneVar(opts.tone));

  /* 月份标签行：按周列定位（第 N 周的左缘），同月只标第一次出现 */
  const weekStart = opts.weekStart === 0 ? 0 : 1;
  /* 周标签：默认 ['一','','三','','五','','日']（周一首）；weekStart=0 时同一组文案自动旋转为周日首（与 date-picker 同语义），labels.weekdays 可整体覆盖 */
  const weekdayDefaults = ['一', '', '三', '', '五', '', '日'];
  const weekdayLabels = opts.labels?.weekdays
    ?? weekdayDefaults.map((_, i) => weekdayLabelAt(weekdayDefaults, (weekStart + i) % 7));
  const monthLabel = (m: number): string => opts.labels?.months?.[m] ?? `${m + 1}月`;
  const grid = document.createElement('div');
  grid.className = 'chart-heatmap-grid';
  grid.setAttribute('role', 'img');
  const months = document.createElement('div');
  months.className = 'chart-calendar-months';
  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'chart-calendar-weekdays';
  weekdayLabels.forEach((w) => {
    const s = document.createElement('span');
    s.textContent = w;
    weekdayRow.appendChild(s);
  });

  const max = maxOf(entries.map((e) => e.value));
  const levelOf = (v: number): number => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

  /* 首周对齐：第一个日期是星期几（周首日 = 第 0 行），前面补占位格 */
  const first = new Date(`${entries[0]!.date}T00:00:00`);
  const pad = (first.getDay() + 7 - weekStart) % 7;
  for (let i = 0; i < pad; i++) {
    const blank = document.createElement('span');
    blank.className = 'chart-heatmap-cell is-blank';
    grid.appendChild(blank);
  }
  let lastMonth = -1;
  entries.forEach((entry, i) => {
    const d = new Date(`${entry.date}T00:00:00`);
    const col = Math.floor((pad + i) / 7);
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      const label = document.createElement('span');
      label.className = 'chart-calendar-month';
      label.textContent = monthLabel(d.getMonth());
      label.style.setProperty('--col', String(col));
      months.appendChild(label);
    }
    const cell = document.createElement('span');
    cell.className = 'chart-heatmap-cell';
    cell.dataset.level = String(levelOf(entry.value));
    cell.setAttribute('title', `${entry.date}：${fmt(opts, entry.value)}`);
    setMarkData(cell, { index: i, label: entry.date, value: entry.value });
    grid.appendChild(cell);
  });

  /* 图例：少 → 多（文案可经 labels.less/labels.more 本地化） */
  const legend = document.createElement('div');
  legend.className = 'chart-heatmap-legend';
  const less = document.createElement('span');
  less.textContent = opts.labels?.less ?? '少';
  const more = document.createElement('span');
  more.textContent = opts.labels?.more ?? '多';
  legend.appendChild(less);
  for (let lv = 0; lv <= 4; lv++) {
    const cell = document.createElement('span');
    cell.className = 'chart-heatmap-cell';
    cell.dataset.level = String(lv);
    legend.appendChild(cell);
  }
  legend.appendChild(more);

  const columns = Math.max(1, Math.ceil((pad + entries.length) / 7));
  months.style.setProperty('--columns', String(columns));
  wrap.append(months, weekdayRow, grid, legend);
  body.appendChild(wrap);
  });
  attachChartInteraction(el, 'calendar');
  return el;
}

/* ═══════════ 散点 / 气泡图 ═══════════ */

export interface ChartPointSpec {
  x: number;
  y: number;
  /** 第三维：气泡大小（映射到半径 3–10） */
  size?: number;
  label?: string;
}

export interface ChartScatterOptions extends ChartChromeOptions {
  points: ChartPointSpec[];
  tone?: ChartTone;
  /** X 轴名称（图例/tooltip 用） */
  xLabel?: string;
  yLabel?: string;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

/** 散点图（可选 size 第三维 → 气泡）；坐标域自动 nice 取整 + 边界刻度 */
export function renderScatter(el: HTMLElement, opts: ChartScatterOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  withChrome(el, opts, false, (body) => {
  const pts = opts.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length === 0) { renderEmpty(body, opts.emptyLabel); return; }

  const width = 360;
  const height = 220;
  const pad = 30;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, sMax = 0;
  for (const p of pts) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
    if ((p.size ?? 0) > sMax) sMax = p.size ?? 0;
  }
  if (xMax === xMin) xMax = xMin + 1;
  if (yMax === yMin) yMax = yMin + 1;
  const rOf = (size?: number): number => (size && sMax > 0 ? 3 + (size / sMax) * 7 : 4);

  const wrap = document.createElement('div');
  wrap.className = 'chart-scatter';
  const tone = toneVar(opts.tone);
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });

  /* 网格：3 横 + 4 竖 + 边界刻度值 */
  const xAt = (x: number): number => pad + ((x - xMin) / (xMax - xMin)) * (width - pad * 2);
  const yAt = (y: number): number => height - pad - ((y - yMin) / (yMax - yMin)) * (height - pad * 2);
  for (let i = 0; i <= 3; i++) {
    const y = pad + (i * (height - pad * 2)) / 3;
    svg.appendChild(svgEl('line', {
      x1: String(pad), x2: String(width - pad), y1: String(y), y2: String(y),
      stroke: 'var(--token-line-soft)', 'stroke-width': '1',
    }));
    const tv = yMin + ((yMax - yMin) * (3 - i)) / 3;
    const txt = svgEl('text', {
      x: String(pad - 4), y: String(y + 3), 'text-anchor': 'end', 'font-size': '8', fill: 'var(--token-text-faint)',
    });
    txt.textContent = String(Math.round(tv * 10) / 10);
    svg.appendChild(txt);
  }
  for (let i = 0; i <= 4; i++) {
    const x = pad + (i * (width - pad * 2)) / 4;
    svg.appendChild(svgEl('line', {
      x1: String(x), x2: String(x), y1: String(pad), y2: String(height - pad),
      stroke: 'var(--token-line-soft)', 'stroke-width': '1', 'stroke-dasharray': '2 3',
    }));
    const tv = xMin + ((xMax - xMin) * i) / 4;
    const txt = svgEl('text', {
      x: String(x), y: String(height - pad + 12), 'text-anchor': 'middle', 'font-size': '8', fill: 'var(--token-text-faint)',
    });
    txt.textContent = String(Math.round(tv * 10) / 10);
    svg.appendChild(txt);
  }
  if (opts.yLabel) {
    const t = svgEl('text', { x: '10', y: String(pad - 10), 'font-size': '8', fill: 'var(--token-text-faint)' });
    t.textContent = opts.yLabel;
    svg.appendChild(t);
  }
  if (opts.xLabel) {
    const t = svgEl('text', { x: String(width - pad), y: String(pad - 10), 'text-anchor': 'end', 'font-size': '8', fill: 'var(--token-text-faint)' });
    t.textContent = opts.xLabel;
    svg.appendChild(t);
  }

  pts.forEach((p, i) => {
    const c = svgEl('circle', {
      cx: xAt(p.x).toFixed(1), cy: yAt(p.y).toFixed(1), r: rOf(p.size).toFixed(1),
      fill: tone, 'fill-opacity': '0.55', stroke: tone, 'stroke-width': '1',
    });
    const title = svgEl('title', {});
    title.textContent = `${p.label ?? `#${i + 1}`}: (${p.x}, ${p.y}${p.size != null ? `, size ${p.size}` : ''})`;
    c.appendChild(title);
    setMarkData(c, { index: i, label: p.label ?? `#${i + 1}`, value: p.y });
    c.dataset.chartX = String(p.x);
    svg.appendChild(c);
  });

  wrap.appendChild(svg);
  body.appendChild(wrap);
  });
  attachChartInteraction(el, 'scatter');
  return el;
}

/* ══════════════════════════════════════════════════════════════
   ChartSpec 通用层（统一规格 + 单一入口 + 交互事件族 + tooltip）
   ————————————————————————————————————————————————————————————————
   设计：全部现有 render* 保留为底层；renderChart(el, spec) 归一 → 推断 →
   分发，并挂交互委托（icen:chart-hover / click / dblclick / contextmenu，
   detail 携带 index/seriesIndex/seriesName/label/value）与可选内置 tooltip。
   spec 为纯 JSON（无函数回调），是后续 AI 调用层（chartToolDefinition /
   chart kind）的直接输入——人给函数、AI 给 format 描述符，两全。
   ══════════════════════════════════════════════════════════════ */

export type ChartType =
  | 'line' | 'area' | 'vbar' | 'hbar' | 'stack' | 'donut'
  | 'radar' | 'heatmap' | 'calendar' | 'sparkline' | 'gauge' | 'scatter';

/** 数值格式化描述符（替代函数回调——可 JSON 序列化，AI 可给） */
export interface ChartValueFormat {
  /** 值后缀单位（"ms" / "¥" / "个"） */
  unit?: string;
  /** compact：1.2k/3.4M；percent：原值即百分数补 %；ms：时长自适应（800ms/1.2s/3m）；raw（默认） */
  notation?: 'compact' | 'percent' | 'ms' | 'raw';
}

/** 任意维度数据记录 + 维度映射（data[] 路径：字段名可完全自定义） */
export interface ChartDims {
  /** 类目/横轴字段（默认 'label'） */
  label?: string;
  /** 系列分组字段（默认 'series'；存在即多系列） */
  series?: string;
  /** 数值字段（默认 'value'） */
  value?: string;
  /** 散点 x 字段（默认 'x'） */
  x?: string;
  /** 散点 y 字段（默认 'y'） */
  y?: string;
  /** 散点 size 字段（默认 'size'） */
  size?: string;
}

/** 统一图表规格（纯 JSON；type 缺省由 inferChartType 推断） */
export interface ChartSpec {
  type?: string;
  title?: string;
  /** 类目轴（line/area/vbar/hbar） */
  labels?: string[];
  /** 单系列值（labels 配对；多系列用 series） */
  values?: number[];
  /** 多系列（line/vbar/radar） */
  series?: ChartSeriesSpec[];
  /** 占比型（donut/stack） */
  segments?: ChartSegment[];
  /** 雷达轴 */
  axes?: string[];
  /** 散点（或经 dims 从 data[] 提取） */
  points?: ChartPointSpec[];
  /** 任意维度原始记录 + dims 字段映射（pivot 到上述形态） */
  data?: Record<string, unknown>[];
  dims?: ChartDims;
  /** 贡献日历：ISO 日期（与 values 配对） */
  dates?: string[];
  tone?: ChartTone;
  /** vbar 多系列：堆叠（默认分组） */
  stacked?: boolean;
  /** line 多系列：填充面积 */
  fill?: boolean;
  weeks?: number;
  /** radar/gauge 的值域上限 */
  max?: number;
  /** radar 网格层数 */
  levels?: number;
  format?: ChartValueFormat;
  /** 内置 tooltip（默认开；false 关闭后只派事件） */
  tooltip?: boolean;
  /** 图例：false = 初始隐藏（头部行的小眼睛仍可再展开）；true/缺省 = 显示 */
  legend?: boolean;
  emptyLabel?: string;
  /** 本地化透传（calendar/heatmap）：weekStart 0=周日/1=周一 与标签文案，纯字符串保持 JSON 可序列化 */
  i18n?: ChartI18nLabels & { weekStart?: 0 | 1 };
}

/** 格式化描述符 → 函数（底层渲染器的 formatValue 槽） */
export function chartFormatValue(format?: ChartValueFormat): (value: number) => string {
  if (!format) return (v) => String(v);
  const notation = format.notation ?? 'raw';
  return (v: number) => {
    let text: string;
    if (notation === 'compact') {
      const abs = Math.abs(v);
      text = abs >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M`
        : abs >= 1000 ? `${Math.round(v / 100) / 10}k`
        : String(v);
    } else if (notation === 'percent') {
      text = `${Math.round(v * 10) / 10}%`;
    } else if (notation === 'ms') {
      if (v <= 0) text = '0ms';
      else if (v < 1000) text = `${Math.round(v)}ms`;
      else if (v < 60_000) text = `${Math.round(v / 100) / 10}s`;
      else text = `${Math.floor(v / 60_000)}m`;
    } else {
      text = String(Math.round(v * 100) / 100);
    }
    return format.unit ? `${text} ${format.unit}` : text;
  };
}

/* ── data[] + dims → pivot ── */

function pivotData(spec: ChartSpec): Partial<ChartSpec> & { axes?: string[] } {
  const data = spec.data;
  if (!Array.isArray(data) || data.length === 0) return {};
  const d = spec.dims ?? {};
  const labelField = d.label ?? 'label';
  const seriesField = d.series ?? 'series';
  const valueField = d.value ?? 'value';
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
  const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

  /* 散点形态：dims.x/y 字段存在数值即走 points */
  if (d.x || data.some((r) => typeof r.x === 'number')) {
    const xf = d.x ?? 'x';
    const yf = d.y ?? 'y';
    const sf = d.size ?? 'size';
    const lf = d.label ?? 'label';
    const points = data
      .filter((r) => r[xf] != null && r[yf] != null)
      .map((r) => ({
        x: num(r[xf]),
        y: num(r[yf]),
        size: r[sf] != null ? num(r[sf]) : undefined,
        label: r[lf] != null ? str(r[lf]) : undefined,
      }));
    return { points };
  }

  /* 一般形态：label 去重保序为类目；series 字段存在即分组多系列 */
  const labels: string[] = [];
  const seenLabel = new Set<string>();
  const hasSeries = data.some((r) => r[seriesField] != null && r[seriesField] !== '');
  const seriesNames: string[] = [];
  const seenSeries = new Set<string>();
  for (const r of data) {
    const l = str(r[labelField]);
    if (!seenLabel.has(l)) { seenLabel.add(l); labels.push(l); }
    if (hasSeries) {
      const sn = str(r[seriesField]);
      if (!seenSeries.has(sn)) { seenSeries.add(sn); seriesNames.push(sn); }
    }
  }
  const labelIndex = new Map(labels.map((l, i) => [l, i]));
  const seriesIndex = new Map(seriesNames.map((s, i) => [s, i]));
  const matrix = seriesNames.map(() => labels.map(() => NaN));
  for (const r of data) {
    const li = labelIndex.get(str(r[labelField])) ?? 0;
    const si = hasSeries ? seriesIndex.get(str(r[seriesField])) ?? 0 : 0;
    (matrix[si] ?? [])[li] = num(r[valueField]);
  }
  /* 缺失值填 0（稀疏矩阵在柱/线族友好） */
  for (const row of matrix) for (let i = 0; i < row.length; i++) if (Number.isNaN(row[i]!)) row[i]! = 0;

  if (hasSeries) {
    return {
      labels,
      series: seriesNames.map((name, si) => ({ name, values: matrix[si] ?? [] })),
    };
  }
  return { labels, values: matrix[0] ?? [] };
}

/* ── 归一化（业界/LLM 友好别名 + 类型纠正）── */

const CHART_TYPE_ALIASES: Record<string, ChartType> = {
  bar: 'vbar', column: 'vbar', 'vertical-bar': 'vbar', 'bar-vertical': 'vbar',
  'horizontal-bar': 'hbar', 'bar-horizontal': 'hbar', ranking: 'hbar',
  pie: 'donut', ring: 'donut', 'pie-chart': 'donut',
  'stacked-bar': 'stack', 'stacked-bar-100': 'stack', ratio: 'stack',
  time: 'line', timeline: 'line', trend: 'line', 'trend-line': 'line',
  contribution: 'calendar', 'contribution-graph': 'calendar', 'calendar-heatmap': 'calendar',
  heat: 'heatmap', matrix: 'heatmap',
  bubble: 'scatter', 'scatter-plot': 'scatter',
  dial: 'gauge', progress: 'gauge',
  mini: 'sparkline', 'trend-sparkline': 'sparkline',
  spider: 'radar', 'radar-chart': 'radar',
};

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[,\s%]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * 归一化 ChartSpec：字符串输入尝试 JSON.parse；类型别名纠正；数值容错转换；
 * data[] + dims pivot 到 labels/values/series/points。不抛异常——纠不了的
 * 字段丢弃，返回的 spec 一定可交给 infer/render（空数据走 .chart-empty）。
 */
export function normalizeChartSpec(raw: unknown): ChartSpec {
  let src: unknown = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch { return {}; }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) {
    /* 数组捷径：[{label,value}] 记录数组当 data[] 用 */
    if (Array.isArray(raw)) src = { data: raw };
    else return {};
  }
  const s = src as Record<string, unknown>;
  const spec: ChartSpec = {};

  if (typeof s.type === 'string') {
    const t = s.type.trim().toLowerCase();
    spec.type = CHART_TYPE_ALIASES[t] ?? t;
  }
  for (const k of ['title', 'tone', 'emptyLabel'] as const) {
    if (typeof s[k] === 'string') (spec as Record<string, unknown>)[k] = s[k];
  }
  for (const k of ['stacked', 'fill', 'tooltip', 'legend'] as const) {
    if (typeof s[k] === 'boolean') (spec as Record<string, unknown>)[k] = s[k];
  }
  for (const k of ['weeks', 'max', 'levels'] as const) {
    const n = toNum(s[k]);
    if (n != null) (spec as Record<string, unknown>)[k] = n;
  }

  if (Array.isArray(s.labels)) spec.labels = s.labels.map((v) => String(v ?? ''));
  if (Array.isArray(s.values)) {
    const values = s.values.map(toNum).filter((v): v is number => v != null);
    if (values.length > 0) spec.values = values;
  }
  if (Array.isArray(s.dates)) spec.dates = s.dates.map((v) => String(v ?? ''));
  if (Array.isArray(s.axes)) spec.axes = s.axes.map((v) => String(v ?? ''));
  if (Array.isArray(s.series)) {
    const series = s.series
      .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
      .map((v, i) => {
        const values = Array.isArray(v.values) ? v.values.map(toNum).filter((n): n is number => n != null) : [];
        const sv: ChartSeriesSpec = { name: String(v.name ?? `系列${i + 1}`), values };
        const tone = v.tone;
        if (typeof tone === 'string' || typeof tone === 'number') sv.tone = tone as ChartTone | number;
        return sv;
      })
      .filter((v) => v.values.length > 0);
    if (series.length > 0) spec.series = series;
  }
  if (Array.isArray(s.segments)) {
    const segments = s.segments
      .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
      .map((v) => {
        const seg: ChartSegment = { label: String(v.label ?? v.name ?? ''), value: toNum(v.value) ?? 0 };
        if (typeof v.tone === 'string') seg.tone = v.tone as ChartTone;
        return seg;
      })
      .filter((v) => v.label !== '' || v.value !== 0);
    if (segments.length > 0) spec.segments = segments;
  }
  if (Array.isArray(s.points)) {
    const points = s.points
      .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
      .map((v) => ({
        x: toNum(v.x) ?? 0,
        y: toNum(v.y) ?? 0,
        size: toNum(v.size),
        label: typeof v.label === 'string' ? v.label : undefined,
      }));
    if (points.length > 0) spec.points = points;
  }
  if (Array.isArray(s.data)) spec.data = s.data.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
  if (s.dims && typeof s.dims === 'object' && !Array.isArray(s.dims)) spec.dims = s.dims as ChartDims;
  if (s.format && typeof s.format === 'object') {
    const f = s.format as Record<string, unknown>;
    const format: ChartValueFormat = {};
    if (typeof f.unit === 'string') format.unit = f.unit;
    if (typeof f.notation === 'string' && ['compact', 'percent', 'ms', 'raw'].includes(f.notation)) {
      format.notation = f.notation as ChartValueFormat['notation'];
    }
    spec.format = format;
  }

  /* data[] pivot（显式形态优先；heatmap/calendar 的 {date,value} 记录保持 data 原样） */
  const isDateRecords = spec.data?.length && spec.data[0] && 'date' in (spec.data[0] as Record<string, unknown>);
  if (spec.data && spec.data.length > 0 && !isDateRecords && !spec.series && !spec.points && !spec.values && !spec.segments) {
    Object.assign(spec, pivotData(spec));
  }
  return spec;
}

/** 类目标签是否呈时间序（ISO 日期 / 年月 / 季度 / 星期）——line 推断依据 */
function looksTemporal(labels: string[]): boolean {
  if (labels.length === 0) return false;
  let hits = 0;
  for (const l of labels) {
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(l)) hits++;
    else if (/^\d{4}\/\d{1,2}(\/\d{1,2})?$/.test(l)) hits++;
    else if (/^\d{4}年/.test(l)) hits++;
    else if (/^[Qq][1-4]$/.test(l)) hits++;
    else if (/^(周一|周二|周三|周四|周五|周六|周日|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(l)) hits++;
    else if (/^第?\d+[日时周月]/.test(l)) hits++;
    else if (/^(v|ver\.?|version[ .]?)?\d+(\.\d+)+$/i.test(l)) hits++; /* v0.8 / 1.2.3 版本序列 */
    else if (/^\d{4}$/.test(l)) hits++; /* 纯年份 */
  }
  return hits / labels.length >= 0.6;
}

/** 未指定 type 时的自动选型（确定性规则，AI 只给数据也能画对） */
export function inferChartType(spec: ChartSpec): ChartType {
  if (spec.points && spec.points.length > 0) return 'scatter';
  if (spec.dates && spec.dates.length > 0) return 'calendar';
  if (spec.segments && spec.segments.length > 0) return 'donut';
  if (spec.axes && spec.axes.length >= 3) return 'radar';
  const labels = spec.labels ?? [];
  const multiSeries = (spec.series?.length ?? 0) > 1;
  if (labels.length > 0) {
    if (looksTemporal(labels)) return 'line';
    if (multiSeries) return 'vbar';
    return labels.length > 8 ? 'hbar' : 'vbar';
  }
  if (multiSeries) return 'line';
  if (spec.values && spec.values.length > 1) return 'line';
  if (typeof spec.max === 'number' && spec.values && spec.values.length === 1) return 'gauge';
  return 'vbar';
}

/* ── renderChart：单一入口 + 交互委托 + tooltip ── */

export type ChartEventName = 'hover' | 'click' | 'dblclick' | 'contextmenu';

export interface ChartEventDetail extends ChartMarkData {
  type: ChartEventName;
  /** hover 专有：enter / leave / move */
  phase?: 'enter' | 'move' | 'leave';
  /** 归一后的图型 */
  chart: ChartType;
  /** 事件发生时的标记元素 */
  target?: Element;
  /** 指针视口坐标（tooltip 定位/自定义浮层用） */
  pointerX?: number;
  pointerY?: number;
}

export interface ChartHandle {
  el: HTMLElement;
  /** 归一 + 推断后的当前规格 */
  spec: ChartSpec;
  /** 原地重渲染（保留事件委托与句柄） */
  update(next: ChartSpec | unknown): void;
  /** icen:chart-<name> 监听糖（hover/click/dblclick/contextmenu）；返回解绑函数 */
  on(name: ChartEventName, listener: (detail: ChartEventDetail, event: Event) => void): () => void;
  /** 清空渲染并解绑交互委托（destroy 后可重新 renderChart） */
  destroy(): void;
}

function dispatchChartEvent(
  root: HTMLElement,
  type: ChartEventName,
  mark: Element,
  chart: ChartType,
  phase?: 'enter' | 'move' | 'leave',
  pointer?: { x: number; y: number },
): void {
  const read = (name: string): string | undefined => mark.getAttribute(name) ?? undefined;
  const numOr = (v: string | undefined): number | undefined => (v == null ? undefined : Number(v));
  const detail: ChartEventDetail = {
    type,
    phase,
    chart,
    index: numOr(read('data-chart-index')),
    seriesIndex: numOr(read('data-chart-series')),
    seriesName: read('data-chart-series-name'),
    label: read('data-chart-label'),
    value: numOr(read('data-chart-value')),
    target: mark,
    pointerX: pointer?.x,
    pointerY: pointer?.y,
  };
  emitIcen(root, `icen:chart-${type}`, detail);
}

/* 内置 tooltip（单例 portal，token 样式；textContent only） */
let tooltipEl: HTMLElement | null = null;
function chartTooltip(): HTMLElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.hidden = true;
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}
function tooltipText(mark: Element): string {
  const label = mark.getAttribute('data-chart-label') ?? '';
  const series = mark.getAttribute('data-chart-series-name');
  const value = mark.getAttribute('data-chart-value');
  const head = series ? (label ? `${series} · ${label}` : series) : label;
  return value != null ? `${head}：${value}` : head;
}
function moveTooltip(x: number, y: number): void {
  const tip = chartTooltip();
  const pad = 12;
  const w = tip.offsetWidth || 120;
  const h = tip.offsetHeight || 28;
  let left = x + pad;
  let top = y - h - pad;
  if (left + w > window.innerWidth - 8) left = x - w - pad;
  if (top < 8) top = y + pad;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/* ── 交互委托（bindChartEvents：renderChart 与底层渲染器共用）── */

/** 派发 icen:chart-* 时读取的每容器元数据（图型 + tooltip 开关；renderChart 写动态 getter，直调渲染器写静态值） */
interface ChartDelegateMeta {
  type(): ChartType;
  tooltip(): boolean;
}
const chartDelegateMeta = new WeakMap<HTMLElement, ChartDelegateMeta>();
const chartDelegateUnbind = new WeakMap<HTMLElement, () => void>();

/**
 * 在图表容器上挂交互委托（幂等，沿用 __icenChartBound 标记）：pointer / click /
 * dblclick / contextmenu 归一到 [data-chart-mark] 标记 → icen:chart-hover
 * （phase enter/move/leave）/ icen:chart-click / icen:chart-dblclick /
 * icen:chart-contextmenu（均 bubbles，detail 含 index/seriesIndex/seriesName/
 * label/value/指针坐标；右键默认 preventDefault），内置 tooltip portal 跟随指针。
 *
 * renderChart 内部即调它；12 个底层渲染器（renderVBar…renderScatter）收尾也会
 * 自动调用——**直调底层渲染器同样能收 icen:chart-\* 事件**，无需经过 renderChart
 * （detail.chart 报该渲染器的图型）。容器已处于某个绑定了委托的外层图表容器
 * 内时自动跳过（renderChart → 底层渲染器路径，外层已覆盖该子树，防重复派发）。
 * 返回解绑函数（移除全部监听并复位标记；解绑后可重新 bind / 重新渲染）。
 */
export function bindChartEvents(root: HTMLElement): () => void {
  const noop = (): void => undefined;
  if (typeof document === 'undefined') return noop;
  const attached = root as HTMLElement & { __icenChartBound?: boolean };
  if (attached.__icenChartBound) {
    const prev = chartDelegateUnbind.get(root);
    if (prev) return prev;
  }
  /* 外层已有图表委托（__icenChartBound 沿父链）：跳过防同一标记重复派发 */
  for (let p: HTMLElement | null = root.parentElement; p; p = p.parentElement) {
    if ((p as HTMLElement & { __icenChartBound?: boolean }).__icenChartBound) return noop;
  }

  const typeNow = (): ChartType => chartDelegateMeta.get(root)?.type() ?? 'vbar';
  const tipEnabled = (): boolean => chartDelegateMeta.get(root)?.tooltip() ?? true;
  const markOf = (e: Event): Element | null => {
    const t = e.target;
    return t instanceof Element ? t.closest('[data-chart-mark]') : null;
  };
  let hoverMark: Element | null = null;

  const enterMark = (mark: Element, x: number, y: number): void => {
    hoverMark = mark;
    mark.classList.add('is-hover');
    dispatchChartEvent(root, 'hover', mark, typeNow(), 'enter', { x, y });
    if (tipEnabled()) {
      const tip = chartTooltip();
      tip.textContent = tooltipText(mark);
      tip.hidden = false;
      moveTooltip(x, y);
    }
  };
  const leaveMark = (pointer?: { x: number; y: number }): void => {
    if (!hoverMark) return;
    hoverMark.classList.remove('is-hover');
    dispatchChartEvent(root, 'hover', hoverMark, typeNow(), 'leave', pointer);
    hoverMark = null;
    chartTooltip().hidden = true;
  };

  const bindings: Array<[string, EventListener]> = [];
  const on = <T extends Event>(type: string, fn: (e: T) => void): void => {
    const listener: EventListener = (evt) => fn(evt as T);
    root.addEventListener(type, listener);
    bindings.push([type, listener]);
  };

  on<PointerEvent>('pointerover', (e) => {
    const mark = markOf(e);
    if (!mark || mark === hoverMark) return;
    leaveMark({ x: e.clientX, y: e.clientY });
    enterMark(mark, e.clientX, e.clientY);
  });
  on<PointerEvent>('pointermove', (e) => {
    if (hoverMark && tipEnabled()) {
      dispatchChartEvent(root, 'hover', hoverMark, typeNow(), 'move', { x: e.clientX, y: e.clientY });
      moveTooltip(e.clientX, e.clientY);
    }
  });
  on<PointerEvent>('pointerout', (e) => {
    const mark = markOf(e);
    if (mark && mark === hoverMark) leaveMark({ x: e.clientX, y: e.clientY });
  });
  on<Event>('pointerleave', () => leaveMark());
  on<MouseEvent>('click', (e) => {
    const mark = markOf(e);
    if (mark) dispatchChartEvent(root, 'click', mark, typeNow(), undefined, { x: e.clientX, y: e.clientY });
  });
  on<MouseEvent>('dblclick', (e) => {
    const mark = markOf(e);
    if (mark) dispatchChartEvent(root, 'dblclick', mark, typeNow(), undefined, { x: e.clientX, y: e.clientY });
  });
  on<MouseEvent>('contextmenu', (e) => {
    const mark = markOf(e);
    if (!mark) return;
    e.preventDefault();
    dispatchChartEvent(root, 'contextmenu', mark, typeNow(), undefined, { x: e.clientX, y: e.clientY });
  });

  const unbind = (): void => {
    for (const [type, listener] of bindings) root.removeEventListener(type, listener);
    bindings.length = 0;
    attached.__icenChartBound = false;
    chartDelegateUnbind.delete(root);
    if (hoverMark) {
      hoverMark.classList.remove('is-hover');
      hoverMark = null;
    }
    chartTooltip().hidden = true;
  };
  attached.__icenChartBound = true;
  chartDelegateUnbind.set(root, unbind);
  return unbind;
}

/** 底层渲染器收尾统一调用：登记自身图型元数据 + 挂交互委托（外层已委托的子树内自动跳过） */
function attachChartInteraction(el: HTMLElement, type: ChartType): void {
  chartDelegateMeta.set(el, { type: () => type, tooltip: () => true });
  bindChartEvents(el);
}

/** 该图型是否有图例（决定头部行是否渲染小眼睛） */
function hasLegendOf(spec: ChartSpec): boolean {
  switch (spec.type) {
    case 'donut':
    case 'stack':
      return (spec.segments?.length ?? 0) > 0;
    case 'heatmap':
    case 'calendar':
      return true;
    case 'line':
    case 'vbar':
    case 'radar':
      return (spec.series?.length ?? 0) > 1;
    default:
      return false;
  }
}

/**
 * 统一入口：normalizeChartSpec → inferChartType（type 缺省时）→ 分发到底层
 * 渲染器，并在 el 上挂交互委托（hover/click/dblclick/contextmenu → icen:chart-*，
 * bubbles，detail 含 index/seriesIndex/seriesName/label/value/指针坐标）与可选
 * tooltip（spec.tooltip !== false 时 portal 跟随指针；右键默认 preventDefault）。
 * spec.title 有值时渲染 .chart-title。返回 { el, spec, update, on, destroy }。
 */
export function renderChart(el: HTMLElement, raw: ChartSpec | unknown): ChartHandle {
  const noop = (): void => undefined;
  if (typeof document === 'undefined') {
    return { el, spec: {}, update: noop, on: () => noop, destroy: noop };
  }
  const root = el;

  let current = normalizeChartSpec(raw);

  const typeOf = (): ChartType => (current.type as ChartType) ?? 'vbar';

  /** 跨 update 存活的图例隐藏状态（withChrome 消费；spec.legend 显式值在 render 时覆写） */
  const legendState: ChartLegendState = { hidden: null };

  const render = (): void => {
    if (!current.type) current = { ...current, type: inferChartType(current) };
    const spec = current;
    const formatValue = chartFormatValue(spec.format);
    if (spec.legend !== undefined) legendState.hidden = spec.legend === false;
    withChrome(root, spec, hasLegendOf(spec), (body) => {
      switch (spec.type) {
        case 'line':
          renderLine(body, { labels: spec.labels ?? [], values: spec.values ?? [], series: spec.series, tone: spec.tone, fill: spec.fill, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        case 'area':
          renderLine(body, { labels: spec.labels ?? [], values: spec.values ?? [], series: spec.series, tone: spec.tone, fill: true, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        case 'vbar':
          renderVBar(body, { labels: spec.labels ?? [], values: spec.values ?? [], series: spec.series, stacked: spec.stacked, tone: spec.tone, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        case 'hbar':
          renderHBar(body, { labels: spec.labels ?? [], values: spec.values ?? [], tone: spec.tone, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        case 'stack':
          renderStack(body, { segments: spec.segments ?? [], formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        case 'donut':
          renderDonut(body, { segments: spec.segments ?? [], formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        case 'radar': {
          const series = spec.series
            ? spec.series.map((s) => ({ name: s.name, values: s.values, tone: typeof s.tone === 'string' ? s.tone : undefined }))
            : spec.values
              ? [{ name: '', values: spec.values }]
              : [];
          renderRadar(body, { axes: spec.axes ?? spec.labels ?? [], series, max: spec.max, levels: spec.levels, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        }
        case 'heatmap':
          renderHeatmap(body, { values: spec.values, data: spec.data as HeatmapDatum[] | undefined, weeks: spec.weeks, tone: spec.tone, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend, weekStart: spec.i18n?.weekStart, labels: spec.i18n });
          break;
        case 'calendar':
          renderCalendar(body, { dates: spec.dates, values: spec.values, data: spec.data as HeatmapDatum[] | undefined, tone: spec.tone, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend, weekStart: spec.i18n?.weekStart, labels: spec.i18n });
          break;
        case 'sparkline':
          renderSparkline(body, { labels: spec.labels ?? [], values: spec.values ?? [], tone: spec.tone, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        case 'gauge':
          renderGauge(body, { value: spec.values?.[0] ?? 0, max: spec.max, tone: spec.tone, label: spec.labels?.[0], formatValue });
          break;
        case 'scatter':
          renderScatter(body, { points: spec.points ?? [], tone: spec.tone, formatValue, emptyLabel: spec.emptyLabel, title: spec.title, legend: spec.legend });
          break;
        default:
          renderEmpty(body, spec.emptyLabel);
      }
    });
  };

  /* 交互委托（挂 root 一次，跨 update 存活；标记随渲染更替）。图型与 tooltip
     开关经 meta 动态读取（update 换 type / 关 tooltip 即时生效）。 */
  chartDelegateMeta.set(root, { type: typeOf, tooltip: () => current.tooltip !== false });
  const unbindEvents = bindChartEvents(root);

  render();

  return {
    el: root,
    spec: current,
    update(next: ChartSpec | unknown): void {
      current = normalizeChartSpec(next);
      render();
    },
    on(name: ChartEventName, listener: (detail: ChartEventDetail, event: Event) => void): () => void {
      const handler = (event: Event): void => {
        listener((event as CustomEvent<ChartEventDetail>).detail, event);
      };
      root.addEventListener(`icen:chart-${name}`, handler as EventListener);
      return () => root.removeEventListener(`icen:chart-${name}`, handler as EventListener);
    },
    destroy(): void {
      root.textContent = '';
      unbindEvents();
      chartTooltip().hidden = true;
    },
  };
}
