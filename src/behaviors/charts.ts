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
interface ChartLegendState {
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
function toggleLegend(items: LegendKey[], scope: ParentNode): HTMLElement {
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
  if (seriesList.length > 1) body.appendChild(toggleLegend(seriesList.map((s, si) => ({ key: s.name, label: s.name, tone: s.tone, si })), wrap));
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
  for (const [segIndex, seg] of opts.segments.entries()) {
    const s = document.createElement('div');
    s.className = 'chart-stack-seg';
    s.style.width = `${(seg.value / total) * 100}%`;
    if (seg.tone) s.style.setProperty('--chart-tone', toneVar(seg.tone));
    s.setAttribute('title', `${seg.label}: ${fmt(opts, seg.value)}`);
    setMarkData(s, { index: segIndex, label: seg.label, value: seg.value });
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
  if (seriesList.length > 1) body.appendChild(toggleLegend(seriesList.map((s, si) => ({ key: s.name, label: s.name, tone: s.tone, si })), wrap));
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
  /** 各轴的值（0..max，顺序与 axes 一致） */
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

  /* 单系列无系列项可切：不追加空的 .chart-legend 占位 div */
  const legend = opts.series.length > 1 ? toggleLegend(legendItems, wrap) : null;
  wrap.append(svg, ...(legend ? [legend] : []));
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

/** 值 → 5 档色阶序号（0..4）：0 值单独一档，其余按 v/max 等比向上取整封顶 */
function levelOf(v: number, max: number): number {
  return v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4));
}

/** 首周对齐：第一个日期是星期几（周首日 = 第 0 行），前面补占位格；返回占位格数（calendar 定月份列用） */
function padFirstWeek(grid: HTMLElement, firstDate: string, weekStart: number): number {
  const first = new Date(`${firstDate}T00:00:00`);
  const pad = (first.getDay() + 7 - weekStart) % 7;
  for (let i = 0; i < pad; i++) {
    const blank = document.createElement('span');
    blank.className = 'chart-heatmap-cell is-blank';
    grid.appendChild(blank);
  }
  return pad;
}

/** 少 → 多 5 档色阶图例（文案可经 labels.less/labels.more 本地化） */
function heatmapLegend(labels?: ChartI18nLabels): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'chart-heatmap-legend';
  const less = document.createElement('span');
  less.textContent = labels?.less ?? '少';
  const more = document.createElement('span');
  more.textContent = labels?.more ?? '多';
  legend.appendChild(less);
  for (let lv = 0; lv <= 4; lv++) {
    const cell = document.createElement('span');
    cell.className = 'chart-heatmap-cell';
    cell.dataset.level = String(lv);
    legend.appendChild(cell);
  }
  legend.appendChild(more);
  return legend;
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

  const wrap = document.createElement('div');
  wrap.className = 'chart-heatmap';
  if (opts.tone) wrap.style.setProperty('--chart-tone', toneVar(opts.tone));

  const grid = document.createElement('div');
  grid.className = 'chart-heatmap-grid';
  grid.setAttribute('role', 'img');

  padFirstWeek(grid, entries[0]!.date, opts.weekStart === 0 ? 0 : 1);
  for (const [i, entry] of entries.entries()) {
    const cell = document.createElement('span');
    cell.className = 'chart-heatmap-cell';
    cell.dataset.level = String(levelOf(entry.value, max));
    cell.setAttribute('title', `${entry.date}：${fmt(opts, entry.value)}`);
    setMarkData(cell, { index: i, label: entry.date, value: entry.value });
    grid.appendChild(cell);
  }

  wrap.append(grid, heatmapLegend(opts.labels));
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

  const pad = padFirstWeek(grid, entries[0]!.date, weekStart);
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
    cell.dataset.level = String(levelOf(entry.value, max));
    cell.setAttribute('title', `${entry.date}：${fmt(opts, entry.value)}`);
    setMarkData(cell, { index: i, label: entry.date, value: entry.value });
    grid.appendChild(cell);
  });

  const legend = heatmapLegend(opts.labels);

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
    txt.textContent = fmt(opts, Math.round(tv * 10) / 10);
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
    txt.textContent = fmt(opts, Math.round(tv * 10) / 10);
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
    title.textContent = `${p.label ?? `#${i + 1}`}: (${fmt(opts, p.x)}, ${fmt(opts, p.y)}${p.size != null ? `, size ${fmt(opts, p.size)}` : ''})`;
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
    /* 数组捷径：[{label,value}] 记录数组当 data[] 用（字符串化数组经 JSON.parse 后在 src 上） */
    if (Array.isArray(src)) src = { data: src };
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

/** 容忍 4 成脏标签：6 成命中即判时间轴 */
const TEMPORAL_HIT_RATIO = 0.6;

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
  return hits / labels.length >= TEMPORAL_HIT_RATIO;
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
/** 按当前宿主图表应用 PanelSizing 契约：data-panel-max 覆盖 CSS 默认 280px 上限
    （单例 tooltip 跨图复用，每次显示以命中 mark 所属图表为准，未指定则复位）。 */
function applyTooltipSizing(host: Element | null): void {
  const tip = chartTooltip();
  const raw = host?.closest<HTMLElement>('.chart, [data-chart-root]')?.getAttribute('data-panel-max') ?? null;
  const n = raw != null ? Number(raw) : NaN;
  tip.style.maxWidth = Number.isFinite(n) && n > 0 ? `${n}px` : '';
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
  const pad = 12; /* 指针偏移 12px：tooltip 不遮指针下的命中标记 */
  const w = tip.offsetWidth || 120;
  const h = tip.offsetHeight || 28;
  let left = x + pad;
  let top = y - h - pad;
  /* 距视口边 8px 内翻面：默认侧放不下就翻到指针另一侧 */
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
      applyTooltipSizing(mark);
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

/* ══════════════════════════════════════════════════════════════
   知识图谱（GraphRAG / 实体关系）＋ 嵌入地图（embedding 2D 投影）
   ————————————————————————————————————————————————————————————————
   renderGraph(el, spec)：SVG 力导向 node-link——确定性布局（id 升序环初始化，
   迭代松弛 ~300 轮：成对斥力 + 边弹簧 + 中心引力，无 Math.random，同数据
   同布局），簇着色走既有调色盘，节点可拖拽（局部松弛 20 轮 / rAF 批处理）。
   renderMap(el, spec)：renderScatter 的去轴变体——坐标为预投影值（本库不算
   投影），无轴刻度只留细网格，点 4px 半透明。
   两者事件走既有 icen:chart-* 通道（bindChartEvents 同款语义：hover
   enter/move/leave + click/dblclick/contextmenu + 内置 tooltip），detail
   对齐 ChartEventDetail 并扩展 datum（{id, label, cluster?, meta?}，
   点击节点/点回实体卡数据）。本 section 纯追加：不改上方任何已发布函数/
   导出（'graph'/'map' 不进已发布联合 ChartType，detail.chart 经断言携带）。
   ══════════════════════════════════════════════════════════════ */

/** 图谱节点（GraphRAG 实体）。weight 缺省以度中心性（邻边数）参与定尺寸 */
export interface GraphNodeSpec {
  id: string;
  label?: string;
  /** 簇 key（社区/Leiden id 等）：配色按簇索引走既有调色盘 */
  cluster?: string;
  /** 节点权重（映射半径 6–18px）；缺省用度数 */
  weight?: number;
  /** 原始元数据：事件 datum 原样回传（实体卡数据源） */
  meta?: Record<string, unknown>;
}

/** 图谱边（默认无向；directed 时带箭头）。weight 映射线宽 0.6–2.5px */
export interface GraphEdgeSpec {
  source: string;
  target: string;
  weight?: number;
}

export interface GraphSpec extends ChartSpec {
  type: 'graph';
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
  /** 有向图：边带箭头（默认无向） */
  directed?: boolean;
  /** 簇 key → 显示名（图例 / tooltip） */
  clusterLabels?: Record<string, string>;
}

/** 嵌入地图点：x/y 为预投影 2D 坐标（UMAP/t-SNE 产物；本组件只做视口缩放，不算投影） */
export interface MapPointSpec {
  id: string;
  x: number;
  y: number;
  cluster?: string;
  label?: string;
  meta?: Record<string, unknown>;
}

export interface MapSpec extends ChartSpec {
  type: 'map';
  points: MapPointSpec[];
  /** 簇 key → 显示名（图例） */
  clusters?: Record<string, string>;
}

/** icen:chart-* 的 datum 负载：graph 命中节点 / map 命中点（meta 原样回传） */
export interface ChartDatum {
  id: string;
  label: string;
  cluster?: string;
  meta?: Record<string, unknown>;
}

/** graph / map 的事件 detail：既有 ChartEventDetail + datum */
export interface ChartDatumDetail extends ChartEventDetail {
  datum?: ChartDatum;
}

/** graph / map 句柄（对齐 ChartHandle 形状；事件 detail 换 ChartDatumDetail） */
export interface DatumChartHandle<S extends GraphSpec | MapSpec = GraphSpec | MapSpec> {
  el: HTMLElement;
  /** 归一后的当前规格 */
  spec: S;
  /** 原地重渲染（graph 重新布局；保留事件委托与句柄） */
  update(next: S | unknown): void;
  /** icen:chart-<name> 监听糖（hover/click/dblclick/contextmenu）；返回解绑函数 */
  on(name: ChartEventName, listener: (detail: ChartDatumDetail, event: Event) => void): () => void;
  /** 清空渲染并解绑委托（destroy 后可重新渲染） */
  destroy(): void;
}

/** 图型登记：'graph' / 'map' 不进已发布联合 ChartType（追加区不动既有导出），detail.chart 按字面量携带 */
const GRAPH_CHART_TYPE = 'graph' as unknown as ChartType;
const MAP_CHART_TYPE = 'map' as unknown as ChartType;

/* ── 确定性力导向布局（纯函数；导出便于单测）── */

export interface GraphLayoutOptions {
  /** 布局域宽（默认 320） */
  width?: number;
  /** 布局域高（默认 200） */
  height?: number;
  /** 松弛轮数（默认 300） */
  iterations?: number;
  /** 初始环相位偏移（度，默认 0）。无随机源——同输入 + 同 seed 必同布局 */
  seed?: number;
}

/** 布局内部态：buildLayoutState 构造；relaxLayout / fitLayout 消费；renderGraph 拖拽期复用 */
interface LayoutState {
  ids: string[];
  index: Map<string, number>;
  x: Float64Array;
  y: Float64Array;
  /** 无向边端点索引对（自环与未知端点已在构造期剔除） */
  pairs: Array<[number, number]>;
  width: number;
  height: number;
  /** FR 理想间距 sqrt(area/n)：斥力/弹簧系数随 n 收敛（k/√n 族） */
  k: number;
}

function buildLayoutState(
  nodes: Array<{ id: unknown }>,
  edges: Array<{ source: unknown; target: unknown }>,
  width: number,
  height: number,
): LayoutState {
  const ids: string[] = [];
  const index = new Map<string, number>();
  for (const node of nodes) {
    const id = String(node?.id ?? '').trim();
    if (!id || index.has(id)) continue;
    index.set(id, ids.length);
    ids.push(id);
  }
  const pairs: Array<[number, number]> = [];
  for (const edge of edges) {
    const a = index.get(String(edge?.source ?? '').trim());
    const b = index.get(String(edge?.target ?? '').trim());
    if (a == null || b == null || a === b) continue;
    pairs.push([a, b]);
  }
  const n = ids.length;
  return {
    ids,
    index,
    x: new Float64Array(n),
    y: new Float64Array(n),
    pairs,
    width,
    height,
    k: n > 0 ? Math.sqrt((width * height) / n) : 1,
  };
}

/** 迭代松弛：成对斥力（k²/d）+ 边弹簧（d²/k，封顶 3k）+ 中心引力；温度线性冷却限幅，位移 clamp 进布局域 */
function relaxLayout(state: LayoutState, rounds: number, pinned = -1, tempScale = 1): void {
  const { x, y, pairs, width, height, k } = state;
  const n = x.length;
  if (n <= 1 || rounds <= 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const gravity = 0.015;
  const tempStart = (Math.min(width, height) / 6) * tempScale;
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  for (let round = 0; round < rounds; round++) {
    dx.fill(0);
    dy.fill(0);
    const temp = Math.max(0.5, tempStart * (1 - round / rounds));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = x[j] - x[i];
        let vy = y[j] - y[i];
        let d2 = vx * vx + vy * vy;
        if (d2 < 0.01) {
          /* 完全重合：按索引做确定性分离（无随机源） */
          vx = 0.5 + ((j - i) % 7) * 0.25;
          vy = ((i * 3 + j) % 5) * 0.3 - 0.6;
          d2 = vx * vx + vy * vy;
        }
        const d = Math.sqrt(d2);
        const f = (k * k) / d;
        const ux = (vx / d) * f;
        const uy = (vy / d) * f;
        dx[i] -= ux;
        dy[i] -= uy;
        dx[j] += ux;
        dy[j] += uy;
      }
    }
    for (const [a, b] of pairs) {
      let vx = x[b] - x[a];
      let vy = y[b] - y[a];
      let d = Math.sqrt(vx * vx + vy * vy);
      if (d < 0.01) {
        vx = 1;
        vy = 0;
        d = 1;
      }
      const f = Math.min((d * d) / k, k * 3);
      const ux = (vx / d) * f;
      const uy = (vy / d) * f;
      dx[a] += ux;
      dy[a] += uy;
      dx[b] -= ux;
      dy[b] -= uy;
    }
    for (let i = 0; i < n; i++) {
      if (i === pinned) continue;
      dx[i] += (cx - x[i]) * gravity;
      dy[i] += (cy - y[i]) * gravity;
      const dm = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]);
      if (dm <= 0) continue;
      const v = Math.min(dm, temp) / dm;
      x[i] = Math.min(width, Math.max(0, x[i] + dx[i] * v));
      y[i] = Math.min(height, Math.max(0, y[i] + dy[i] * v));
    }
  }
}

/** 视口归一 fit：bbox 等比缩放进 [margin, 尺寸-margin] 并居中（防畸变，scale 封顶 4） */
function fitLayout(state: LayoutState, margin: number): void {
  const { x, y, width, height } = state;
  const n = x.length;
  if (n === 0) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (x[i] < minX) minX = x[i];
    if (x[i] > maxX) maxX = x[i];
    if (y[i] < minY) minY = y[i];
    if (y[i] > maxY) maxY = y[i];
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const scale = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanY, 4);
  const offX = (width - spanX * scale) / 2 - minX * scale;
  const offY = (height - spanY * scale) / 2 - minY * scale;
  for (let i = 0; i < n; i++) {
    x[i] = x[i] * scale + offX;
    y[i] = y[i] * scale + offY;
  }
}

/** 确定性初始布局：id 升序沿圆环排布（首节点正上方；seed 旋转相位） */
function initRingLayout(state: LayoutState, seed = 0): void {
  const { ids, index, x, y, width, height } = state;
  const n = ids.length;
  if (n === 0) return;
  if (n === 1) {
    x[0] = width / 2;
    y[0] = height / 2;
    return;
  }
  const order = [...ids].sort();
  const radius = (Math.min(width, height) / 2) * 0.76;
  const deg = ((seed % 360) + 360) % 360;
  const seedAngle = (deg * Math.PI) / 180;
  for (let rank = 0; rank < n; rank++) {
    const i = index.get(order[rank] ?? '') ?? -1;
    if (i < 0) continue;
    const angle = seedAngle - Math.PI / 2 + (rank * 2 * Math.PI) / n;
    x[i] = width / 2 + radius * Math.cos(angle);
    y[i] = height / 2 + radius * Math.sin(angle);
  }
}

/** 确定性力导向布局（纯函数，导出便于测试）：环初始化 → 松弛 → fit → id → {x, y} */
export function layoutGraph(
  nodes: Array<{ id: unknown }>,
  edges: Array<{ source: unknown; target: unknown }>,
  opts?: GraphLayoutOptions,
): Map<string, { x: number; y: number }> {
  const width = Math.max(16, opts?.width ?? 320);
  const height = Math.max(16, opts?.height ?? 200);
  const state = buildLayoutState(nodes, edges, width, height);
  if (state.ids.length === 0) return new Map();
  initRingLayout(state, opts?.seed ?? 0);
  relaxLayout(state, Math.max(1, Math.round(opts?.iterations ?? 300)));
  fitLayout(state, Math.max(8, Math.min(width, height) * 0.08));
  const out = new Map<string, { x: number; y: number }>();
  state.ids.forEach((id, i) => out.set(id, { x: state.x[i], y: state.y[i] }));
  return out;
}

/* ── datum 标记 + 事件委托（graph / map 共用；bindChartEvents 同款语义，detail 多携带 datum）── */

const datumMarkInfo = new WeakMap<Element, { datum: ChartDatum; tip: string }>();
const datumEventControl = new WeakMap<HTMLElement, { unbind(): void; suppressNextClick(): void }>();

function dispatchDatumEvent(
  root: HTMLElement,
  type: ChartEventName,
  mark: Element,
  phase?: 'enter' | 'move' | 'leave',
  pointer?: { x: number; y: number },
): void {
  const numOr = (v: string | null): number | undefined => (v == null ? undefined : Number(v));
  const detail: ChartDatumDetail = {
    type,
    phase,
    chart: chartDelegateMeta.get(root)?.type() ?? 'vbar',
    index: numOr(mark.getAttribute('data-chart-index')),
    seriesIndex: numOr(mark.getAttribute('data-chart-series')),
    seriesName: mark.getAttribute('data-chart-series-name') ?? undefined,
    label: mark.getAttribute('data-chart-label') ?? undefined,
    value: numOr(mark.getAttribute('data-chart-value')),
    target: mark,
    pointerX: pointer?.x,
    pointerY: pointer?.y,
    datum: datumMarkInfo.get(mark)?.datum,
  };
  emitIcen(root, `icen:chart-${type}`, detail);
}

/**
 * graph / map 交互委托（幂等，挂 el 存活跨 update）：pointer / click / dblclick /
 * contextmenu 归一到 [data-chart-mark] 标记 → icen:chart-hover（enter/move/leave）/
 * click / dblclick / contextmenu（detail 携带 datum + 指针坐标；右键默认
 * preventDefault），内置 tooltip portal 跟随指针。与 bindChartEvents 互为同款
 * 语义（图型/开关经 chartDelegateMeta 动态读取）；suppressNextClick 供拖拽
 * 释放后吞掉误触 click。
 */
function bindDatumEvents(root: HTMLElement): { unbind(): void; suppressNextClick(): void } {
  const existing = datumEventControl.get(root);
  if (existing) return existing;
  const tipEnabled = (): boolean => chartDelegateMeta.get(root)?.tooltip() ?? true;
  const markOf = (e: Event): Element | null => {
    const t = e.target;
    return t instanceof Element ? t.closest('[data-chart-mark]') : null;
  };
  let hoverMark: Element | null = null;
  let suppressClick = false;
  const bindings: Array<[string, EventListener]> = [];
  const on = <T extends Event>(type: string, fn: (e: T) => void): void => {
    const listener: EventListener = (evt) => fn(evt as T);
    root.addEventListener(type, listener);
    bindings.push([type, listener]);
  };
  const enterMark = (mark: Element, px: number, py: number): void => {
    hoverMark = mark;
    mark.classList.add('is-hover');
    dispatchDatumEvent(root, 'hover', mark, 'enter', { x: px, y: py });
    if (tipEnabled()) {
      const tip = chartTooltip();
      tip.textContent = datumMarkInfo.get(mark)?.tip ?? tooltipText(mark);
      applyTooltipSizing(mark);
      tip.hidden = false;
      moveTooltip(px, py);
    }
  };
  const leaveMark = (pointer?: { x: number; y: number }): void => {
    if (!hoverMark) return;
    hoverMark.classList.remove('is-hover');
    dispatchDatumEvent(root, 'hover', hoverMark, 'leave', pointer);
    hoverMark = null;
    chartTooltip().hidden = true;
  };
  on<PointerEvent>('pointerover', (e) => {
    const mark = markOf(e);
    if (!mark || mark === hoverMark) return;
    leaveMark({ x: e.clientX, y: e.clientY });
    enterMark(mark, e.clientX, e.clientY);
  });
  on<PointerEvent>('pointermove', (e) => {
    if (!hoverMark) return;
    dispatchDatumEvent(root, 'hover', hoverMark, 'move', { x: e.clientX, y: e.clientY });
    if (tipEnabled()) moveTooltip(e.clientX, e.clientY);
  });
  on<PointerEvent>('pointerout', (e) => {
    const mark = markOf(e);
    if (mark && mark === hoverMark) leaveMark({ x: e.clientX, y: e.clientY });
  });
  on<Event>('pointerleave', () => leaveMark());
  on<MouseEvent>('click', (e) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const mark = markOf(e);
    if (mark) dispatchDatumEvent(root, 'click', mark, undefined, { x: e.clientX, y: e.clientY });
  });
  on<MouseEvent>('dblclick', (e) => {
    const mark = markOf(e);
    if (mark) dispatchDatumEvent(root, 'dblclick', mark, undefined, { x: e.clientX, y: e.clientY });
  });
  on<MouseEvent>('contextmenu', (e) => {
    const mark = markOf(e);
    if (!mark) return;
    e.preventDefault();
    dispatchDatumEvent(root, 'contextmenu', mark, undefined, { x: e.clientX, y: e.clientY });
  });
  const control = {
    unbind(): void {
      for (const [type, listener] of bindings) root.removeEventListener(type, listener);
      bindings.length = 0;
      if (hoverMark) {
        hoverMark.classList.remove('is-hover');
        hoverMark = null;
      }
      chartTooltip().hidden = true;
      datumEventControl.delete(root);
    },
    suppressNextClick(): void {
      suppressClick = true;
    },
  };
  datumEventControl.set(root, control);
  return control;
}

/* ── 簇模型（graph / map 共用）：确定性簇序（key 升序）→ 调色盘取色 + 图例名 ── */

interface ClusterModel {
  keys: string[];
  indexOf: Map<string, number>;
  label(key: string): string;
  /** 簇索引 → 调色盘色（paletteVar 1..6 循环） */
  color(index: number): string;
}

function buildClusterModel(keys: Array<string | undefined>, labels?: Record<string, string>): ClusterModel | null {
  const seen = new Set<string>();
  for (const key of keys) {
    if (typeof key === 'string' && key !== '') seen.add(key);
  }
  if (seen.size === 0) return null;
  const list = [...seen].sort();
  return {
    keys: list,
    indexOf: new Map(list.map((k, i) => [k, i])),
    label: (key) => labels?.[key] ?? key,
    color: (index) => paletteVar(index + 1),
  };
}

/** datum 标记注册（bindDatumEvents 派发与内置 tooltip 取用） */
function registerDatumMark(mark: Element, datum: ChartDatum, tip: string): void {
  datumMarkInfo.set(mark, { datum, tip });
}

/** hover 文案截断（默认 8 字补 …；按码点切，不劈代理对） */
function truncateText(text: string, max = 8): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}

/** 指针视口坐标 → SVG viewBox 坐标（xMidYMid meet letterbox 补偿；rect 退化回中心） */
function svgClientPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / viewBoxWidth, rect.height / viewBoxHeight);
  if (!Number.isFinite(scale) || scale <= 0) {
    return { x: viewBoxWidth / 2, y: viewBoxHeight / 2 };
  }
  return {
    x: (clientX - rect.left - (rect.width - viewBoxWidth * scale) / 2) / scale,
    y: (clientY - rect.top - (rect.height - viewBoxHeight * scale) / 2) / scale,
  };
}

/* ── spec 归一（不抛异常：字符串 JSON.parse / 数值容错 / 未知端点边与自环剔除 / id 去重）── */

function normalizeGraphSpec(raw: unknown): GraphSpec {
  let src: unknown = raw;
  if (typeof src === 'string') {
    try {
      src = JSON.parse(src);
    } catch {
      src = {};
    }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) src = {};
  const s = src as Record<string, unknown>;
  const spec: GraphSpec = { ...normalizeChartSpec(s), type: 'graph', nodes: [], edges: [] };
  if (Array.isArray(s.nodes)) {
    const seen = new Set<string>();
    for (const v of s.nodes) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const r = v as Record<string, unknown>;
      const id = String(r.id ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const node: GraphNodeSpec = { id };
      if (r.label != null) node.label = String(r.label);
      if (typeof r.cluster === 'string' && r.cluster !== '') node.cluster = r.cluster;
      const weight = toNum(r.weight);
      if (weight != null) node.weight = weight;
      if (r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)) {
        node.meta = { ...(r.meta as Record<string, unknown>) };
      }
      spec.nodes.push(node);
    }
  }
  const known = new Set(spec.nodes.map((n) => n.id));
  if (Array.isArray(s.edges)) {
    for (const v of s.edges) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const r = v as Record<string, unknown>;
      const source = String(r.source ?? '').trim();
      const target = String(r.target ?? '').trim();
      if (!known.has(source) || !known.has(target) || source === target) continue;
      const edge: GraphEdgeSpec = { source, target };
      const weight = toNum(r.weight);
      if (weight != null) edge.weight = weight;
      spec.edges.push(edge);
    }
  }
  if (s.directed === true) spec.directed = true;
  if (s.clusterLabels && typeof s.clusterLabels === 'object' && !Array.isArray(s.clusterLabels)) {
    const labels: Record<string, string> = {};
    for (const [key, value] of Object.entries(s.clusterLabels)) {
      if (typeof value === 'string' && value !== '') labels[key] = value;
    }
    spec.clusterLabels = labels;
  }
  return spec;
}

function normalizeMapSpec(raw: unknown): MapSpec {
  let src: unknown = raw;
  if (typeof src === 'string') {
    try {
      src = JSON.parse(src);
    } catch {
      src = {};
    }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) src = {};
  const s = src as Record<string, unknown>;
  const spec: MapSpec = { ...normalizeChartSpec(s), type: 'map', points: [] };
  if (Array.isArray(s.points)) {
    const seen = new Set<string>();
    for (const v of s.points) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const r = v as Record<string, unknown>;
      const id = String(r.id ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const point: MapPointSpec = { id, x: toNum(r.x) ?? 0, y: toNum(r.y) ?? 0 };
      if (typeof r.cluster === 'string' && r.cluster !== '') point.cluster = r.cluster;
      if (r.label != null) point.label = String(r.label);
      if (r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)) {
        point.meta = { ...(r.meta as Record<string, unknown>) };
      }
      spec.points.push(point);
    }
  }
  if (s.clusters && typeof s.clusters === 'object' && !Array.isArray(s.clusters)) {
    const labels: Record<string, string> = {};
    for (const [key, value] of Object.entries(s.clusters)) {
      if (typeof value === 'string' && value !== '') labels[key] = value;
    }
    spec.clusters = labels;
  }
  return spec;
}

/* ═══ 知识图谱：renderGraph ═══ */

const GRAPH_W = 360;
const GRAPH_H = 260;
const GRAPH_PAD = 28;
const GRAPH_LW = GRAPH_W - GRAPH_PAD * 2;
const GRAPH_LH = GRAPH_H - GRAPH_PAD * 2;

/* 有向图箭头 marker id 计数器（同页多图唯一） */
let graphMarkerSeq = 0;

/**
 * 力导向知识图谱（GraphRAG 实体关系）。确定性布局（同数据同布局，无随机源）；
 * 节点半径 6–18px（weight 归一，缺省用度中心性）、边宽 0.6–2.5px（line-soft）、
 * 簇着色走既有调色盘（无 cluster 单色 tone）；节点拖拽 = pointer + 局部松弛
 * 20 轮（rAF 批处理）；hover 显示节点 label（≤8 字截断）+ 内置 tooltip；
 * 事件走既有通道 icen:chart-hover/click/dblclick/contextmenu，detail.datum =
 * {id, label, cluster?, meta?}（点击节点回实体卡数据）。图例可点击隐藏簇
 * （icen:chart-legend-toggle；边随任一端簇隐藏淡化）。
 */
export function renderGraph(el: HTMLElement, raw: GraphSpec | unknown): DatumChartHandle<GraphSpec> {
  const noop = (): void => undefined;
  let current = normalizeGraphSpec(raw);
  if (typeof document === 'undefined') {
    return { el, spec: current, update: noop, on: () => noop, destroy: noop };
  }
  const legendState: ChartLegendState = { hidden: null };

  /* 渲染态（每次 paint 重建；拖拽松弛复用 layout） */
  let layout: LayoutState | null = null;
  let svgRef: SVGSVGElement | null = null;
  let nodeEls: Element[] = [];
  let edgeList: Array<{ el: SVGLineElement; from: number; to: number }> = [];
  let nodeRadii: number[] = [];
  let directed = false;
  let arrowId = '';

  /** 边端点（有向：目标端缩短 r+4，箭头贴节点外缘不钻圆心） */
  const edgeEnds = (from: number, to: number): { x1: string; y1: string; x2: string; y2: string } => {
    const ax = GRAPH_PAD + (layout ? layout.x[from] : 0);
    const ay = GRAPH_PAD + (layout ? layout.y[from] : 0);
    const bx = GRAPH_PAD + (layout ? layout.x[to] : 0);
    const by = GRAPH_PAD + (layout ? layout.y[to] : 0);
    if (!directed) {
      return { x1: ax.toFixed(1), y1: ay.toFixed(1), x2: bx.toFixed(1), y2: by.toFixed(1) };
    }
    const dx = bx - ax;
    const dy = by - ay;
    const d = Math.hypot(dx, dy) || 1;
    const cut = (nodeRadii[to] ?? 6) + 4;
    return {
      x1: ax.toFixed(1),
      y1: ay.toFixed(1),
      x2: (bx - (dx / d) * cut).toFixed(1),
      y2: (by - (dy / d) * cut).toFixed(1),
    };
  };

  const paint = (body: HTMLElement): void => {
    directed = current.directed === true;
    layout = null;
    svgRef = null;
    nodeEls = [];
    edgeList = [];
    arrowId = '';
    const nodes = current.nodes;
    if (nodes.length === 0) {
      nodeRadii = [];
      renderEmpty(body, current.emptyLabel);
      return;
    }

    const clusters = buildClusterModel(nodes.map((n) => n.cluster), current.clusterLabels);
    const tone = toneVar(current.tone);
    const idOf = new Map(nodes.map((n, i) => [n.id, i]));

    /* 度中心性（weight 缺省用邻边数）→ 半径 6 + 归一×12（6–18px；等权取中位） */
    const degree = nodes.map(() => 0);
    for (const e of current.edges) {
      const a = idOf.get(e.source);
      const b = idOf.get(e.target);
      if (a == null || b == null || a === b) continue;
      degree[a] += 1;
      degree[b] += 1;
    }
    const weights = nodes.map((n, i) => n.weight ?? degree[i]);
    let wMin = Infinity;
    let wMax = -Infinity;
    for (const w of weights) {
      if (w < wMin) wMin = w;
      if (w > wMax) wMax = w;
    }
    nodeRadii = weights.map((w) => 6 + (wMax > wMin ? (w - wMin) / (wMax - wMin) : 0.5) * 12);

    /* 边宽 0.6–2.5px（weight 归一；全缺省/等值 → 统一 1px） */
    let eMin = Infinity;
    let eMax = -Infinity;
    for (const e of current.edges) {
      if (e.weight == null) continue;
      if (e.weight < eMin) eMin = e.weight;
      if (e.weight > eMax) eMax = e.weight;
    }
    const edgeWidth = (e: GraphEdgeSpec): number =>
      e.weight == null ? 1 : 0.6 + (eMax > eMin ? (e.weight - eMin) / (eMax - eMin) : 0.5) * 1.9;

    const wrap = document.createElement('div');
    wrap.className = 'chart-graph';
    if (current.tone) wrap.style.setProperty('--chart-tone', toneVar(current.tone));
    const svg = svgEl('svg', { viewBox: `0 0 ${GRAPH_W} ${GRAPH_H}`, role: 'img' });
    svgRef = svg;
    svg.addEventListener('pointerdown', onNodePointerDown);

    const defs = svgEl('defs', {});
    if (directed) {
      arrowId = `icen-chart-graph-arrow-${++graphMarkerSeq}`;
      const marker = svgEl('marker', {
        id: arrowId,
        viewBox: '0 0 8 8',
        refX: '7',
        refY: '4',
        markerWidth: '6',
        markerHeight: '6',
        orient: 'auto',
      });
      marker.appendChild(svgEl('path', { d: 'M0.5,0.8 L7.5,4 L0.5,7.2 Z', fill: 'var(--token-text-faint)' }));
      defs.appendChild(marker);
    }

    /* 确定性布局：环初始化 + 300 轮松弛 + fit（PAD 内缩的布局域） */
    layout = buildLayoutState(nodes, current.edges, GRAPH_LW, GRAPH_LH);
    initRingLayout(layout, 0);
    relaxLayout(layout, 300);
    fitLayout(layout, 20);

    const edgeLayer = svgEl('g', { class: 'chart-graph-edges' });
    const nodeLayer = svgEl('g', { class: 'chart-graph-nodes' });

    for (const e of current.edges) {
      const from = idOf.get(e.source);
      const to = idOf.get(e.target);
      if (from == null || to == null || from === to) continue;
      const line = svgEl('line', {
        ...edgeEnds(from, to),
        stroke: 'var(--token-line-soft)',
        'stroke-width': edgeWidth(e).toFixed(2),
        ...(directed ? { 'marker-end': `url(#${arrowId})` } : {}),
      });
      line.classList.add('chart-graph-edge');
      /* 簇隐藏联动数据：任一端所在簇隐藏 → 边淡化（图例切换后重算） */
      const fromKey = nodes[from]?.cluster;
      const toKey = nodes[to]?.cluster;
      if (fromKey) line.setAttribute('data-edge-cluster-from', fromKey);
      if (toKey) line.setAttribute('data-edge-cluster-to', toKey);
      edgeList.push({ el: line, from, to });
      edgeLayer.appendChild(line);
    }

    nodes.forEach((node, i) => {
      const clusterKey = node.cluster;
      const ci = clusterKey != null && clusters ? clusters.indexOf.get(clusterKey) : undefined;
      const clusterName = ci != null && clusters && clusterKey != null ? clusters.label(clusterKey) : undefined;
      const fill = clusters ? (ci != null ? clusters.color(ci) : 'var(--token-text-faint)') : tone;
      const pos = { x: GRAPH_PAD + layout!.x[i], y: GRAPH_PAD + layout!.y[i] };
      const g = svgEl('g', {
        class: 'chart-graph-node',
        transform: `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`,
      });
      g.setAttribute('data-chart-node-id', node.id);
      setMarkData(g, {
        index: i,
        seriesIndex: ci,
        seriesName: clusterName,
        label: node.label ?? node.id,
        value: weights[i],
      });
      const dot = svgEl('circle', {
        class: 'chart-graph-dot',
        r: (nodeRadii[i] ?? 6).toFixed(1),
        fill,
        'fill-opacity': '0.92',
        stroke: 'var(--token-card)',
        'stroke-width': '1.5',
      });
      /* 透明命中圆：小节点（r=6）也有 ≥11px 的 hover/点击/拖拽手感 */
      const hit = svgEl('circle', {
        class: 'chart-graph-hit',
        r: String(Math.max((nodeRadii[i] ?? 6) + 4, 11)),
        fill: 'transparent',
        'data-chart-hit': '1',
      });
      const labelText = truncateText(node.label ?? node.id);
      const head = clusterName ? `${clusterName} · ${labelText}` : labelText;
      const tip = weights[i] > 0 ? `${head}：${weights[i]}` : head;
      const title = svgEl('title', {});
      title.textContent = tip;
      g.append(dot, hit, title);
      registerDatumMark(g, { id: node.id, label: node.label ?? node.id, cluster: clusterKey, meta: node.meta }, tip);
      nodeEls.push(g);
      nodeLayer.appendChild(g);
    });

    svg.append(defs, edgeLayer, nodeLayer);
    wrap.appendChild(svg);
    body.appendChild(wrap);

    if (clusters) {
      const legend = toggleLegend(
        clusters.keys.map((key, ci) => ({ key, label: clusters.label(key), tone: ci + 1, si: ci })),
        wrap,
      );
      body.appendChild(legend);
      /* toggleLegend 按单 key 淡化标记（节点经 data-chart-series 对位）；边需
         「任一端簇隐藏即淡化」→ 图例切换（click / Enter/Space）后重算全部边 */
      const syncEdges = (): void => {
        const hiddenOf = (key: string | null): boolean =>
          key != null &&
          legend.querySelector(`[data-chart-key="${CSS.escape(key)}"]`)?.classList.contains('is-off') === true;
        for (const edge of edgeList) {
          edge.el.classList.toggle(
            'is-off',
            hiddenOf(edge.el.getAttribute('data-edge-cluster-from')) ||
              hiddenOf(edge.el.getAttribute('data-edge-cluster-to')),
          );
        }
      };
      legend.addEventListener('click', syncEdges);
      legend.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') syncEdges();
      });
    }
  };

  /** 拖拽松弛后的轻量重绘：只写节点 transform 与边端点（不重建 DOM） */
  const paintPositions = (): void => {
    if (!layout) return;
    for (let i = 0; i < nodeEls.length; i++) {
      nodeEls[i]?.setAttribute(
        'transform',
        `translate(${(GRAPH_PAD + layout.x[i]).toFixed(1)},${(GRAPH_PAD + layout.y[i]).toFixed(1)})`,
      );
    }
    for (const edge of edgeList) {
      const ends = edgeEnds(edge.from, edge.to);
      edge.el.setAttribute('x1', ends.x1);
      edge.el.setAttribute('y1', ends.y1);
      edge.el.setAttribute('x2', ends.x2);
      edge.el.setAttribute('y2', ends.y2);
    }
  };

  /* ── 节点拖拽：pointerdown（委托 svg）→ window pointermove/up；每帧局部松弛 20 轮 ── */
  let drag: { i: number; moved: boolean; raf: number; px: number; py: number } | null = null;

  const applyDragFrame = (): void => {
    if (!drag || !layout || !svgRef) return;
    const p = svgClientPoint(svgRef, drag.px, drag.py, GRAPH_W, GRAPH_H);
    const i = drag.i;
    layout.x[i] = Math.min(GRAPH_LW, Math.max(0, p.x - GRAPH_PAD));
    layout.y[i] = Math.min(GRAPH_LH, Math.max(0, p.y - GRAPH_PAD));
    relaxLayout(layout, 20, i, 0.4);
    paintPositions();
    drag.raf = 0;
  };

  const onDragMove = (e: PointerEvent): void => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.px) + Math.abs(e.clientY - drag.py) > 2) drag.moved = true;
    drag.px = e.clientX;
    drag.py = e.clientY;
    if (drag.raf === 0) drag.raf = requestAnimationFrame(applyDragFrame);
  };

  const endDrag = (): void => {
    if (!drag) return;
    if (drag.raf !== 0) cancelAnimationFrame(drag.raf);
    nodeEls[drag.i]?.classList.remove('is-drag');
    svgRef?.classList.remove('is-dragging');
    if (drag.moved) eventsControl.suppressNextClick();
    drag = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  };

  const onNodePointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !layout) return;
    const target = e.target;
    const g = target instanceof Element ? target.closest('.chart-graph-node') : null;
    if (!g) return;
    const i = layout.index.get(g.getAttribute('data-chart-node-id') ?? '');
    if (i == null) return;
    e.preventDefault();
    endDrag();
    drag = { i, moved: false, raf: 0, px: e.clientX, py: e.clientY };
    g.classList.add('is-drag');
    svgRef?.classList.add('is-dragging');
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  chartDelegateMeta.set(el, { type: () => GRAPH_CHART_TYPE, tooltip: () => current.tooltip !== false });
  const eventsControl = bindDatumEvents(el);

  const render = (): void => {
    if (drag) endDrag();
    const clusters = buildClusterModel(current.nodes.map((n) => n.cluster), current.clusterLabels);
    if (current.legend !== undefined) legendState.hidden = current.legend === false;
    withChrome(el, current, clusters != null, paint, legendState);
  };
  render();

  return {
    el,
    spec: current,
    update(next: GraphSpec | unknown): void {
      current = normalizeGraphSpec(next);
      render();
    },
    on(name: ChartEventName, listener: (detail: ChartDatumDetail, event: Event) => void): () => void {
      const handler = (event: Event): void => {
        listener((event as CustomEvent<ChartDatumDetail>).detail, event);
      };
      el.addEventListener(`icen:chart-${name}`, handler as EventListener);
      return () => el.removeEventListener(`icen:chart-${name}`, handler as EventListener);
    },
    destroy(): void {
      if (drag) endDrag();
      el.textContent = '';
      eventsControl.unbind();
      chartTooltip().hidden = true;
    },
  };
}

/* ═══ 嵌入地图：renderMap（renderScatter 去轴变体）═══ */

const MAP_W = 360;
const MAP_H = 220;
const MAP_PAD = 14;

/**
 * embedding 2D 散点地图：坐标为预投影值（UMAP/t-SNE 产物，本函数只做视口
 * min-max 缩放，不算投影）；无轴刻度只留细虚线网格；点 4px 半透明
 * （fill-opacity .7，高密度层叠可辨）；簇着色走既有调色盘 + 可点击图例。
 * 点击点 → icen:chart-click（detail.datum = {id, label, cluster?, meta?}，
 * 点选回 chunk）。TODO: lasso 框选（icen:chart-select + 命中列表），暂不做。
 */
export function renderMap(el: HTMLElement, raw: MapSpec | unknown): DatumChartHandle<MapSpec> {
  const noop = (): void => undefined;
  let current = normalizeMapSpec(raw);
  if (typeof document === 'undefined') {
    return { el, spec: current, update: noop, on: () => noop, destroy: noop };
  }
  const legendState: ChartLegendState = { hidden: null };

  const paint = (body: HTMLElement): void => {
    const points = current.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (points.length === 0) {
      renderEmpty(body, current.emptyLabel);
      return;
    }
    const clusters = buildClusterModel(points.map((p) => p.cluster), current.clusters);
    const tone = toneVar(current.tone);

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const p of points) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    if (xMax === xMin) xMax = xMin + 1;
    if (yMax === yMin) yMax = yMin + 1;
    const xAt = (x: number): number => MAP_PAD + ((x - xMin) / (xMax - xMin)) * (MAP_W - MAP_PAD * 2);
    const yAt = (y: number): number => MAP_H - MAP_PAD - ((y - yMin) / (yMax - yMin)) * (MAP_H - MAP_PAD * 2);

    const wrap = document.createElement('div');
    wrap.className = 'chart-map';
    if (current.tone) wrap.style.setProperty('--chart-tone', toneVar(current.tone));
    const svg = svgEl('svg', { viewBox: `0 0 ${MAP_W} ${MAP_H}`, role: 'img' });

    /* 细网格（去轴：预投影坐标的刻度无意义，只留参考线） */
    for (let i = 0; i <= 3; i++) {
      const y = MAP_PAD + (i * (MAP_H - MAP_PAD * 2)) / 3;
      svg.appendChild(svgEl('line', {
        x1: String(MAP_PAD),
        x2: String(MAP_W - MAP_PAD),
        y1: String(y),
        y2: String(y),
        stroke: 'var(--token-line-soft)',
        'stroke-width': '0.75',
        'stroke-dasharray': '2 4',
      }));
    }
    for (let i = 0; i <= 4; i++) {
      const x = MAP_PAD + (i * (MAP_W - MAP_PAD * 2)) / 4;
      svg.appendChild(svgEl('line', {
        x1: String(x),
        x2: String(x),
        y1: String(MAP_PAD),
        y2: String(MAP_H - MAP_PAD),
        stroke: 'var(--token-line-soft)',
        'stroke-width': '0.75',
        'stroke-dasharray': '2 4',
      }));
    }
    /* TODO: lasso 框选（icen:chart-select + 命中 datum 列表回传），暂不做 */

    points.forEach((p, i) => {
      const ci = p.cluster != null && clusters ? clusters.indexOf.get(p.cluster) : undefined;
      const clusterName = ci != null && clusters && p.cluster != null ? clusters.label(p.cluster) : undefined;
      const color = clusters ? (ci != null ? clusters.color(ci) : 'var(--token-text-faint)') : tone;
      const label = p.label ?? p.id;
      const labelText = truncateText(label);
      const tip = clusterName ? `${clusterName} · ${labelText}` : labelText;
      const g = svgEl('g', {
        class: 'chart-map-point',
        transform: `translate(${xAt(p.x).toFixed(1)},${yAt(p.y).toFixed(1)})`,
      });
      g.setAttribute('data-chart-point-id', p.id);
      setMarkData(g, { index: i, seriesIndex: ci, seriesName: clusterName, label });
      const dot = svgEl('circle', {
        class: 'chart-map-dot',
        r: '4',
        fill: color,
        'fill-opacity': '0.7',
        stroke: color,
        'stroke-width': '1',
      });
      const hit = svgEl('circle', { class: 'chart-map-hit', r: '9', fill: 'transparent', 'data-chart-hit': '1' });
      const title = svgEl('title', {});
      title.textContent = tip;
      g.append(dot, hit, title);
      registerDatumMark(g, { id: p.id, label, cluster: p.cluster, meta: p.meta }, tip);
      svg.appendChild(g);
    });

    wrap.appendChild(svg);
    body.appendChild(wrap);
    if (clusters) {
      body.appendChild(
        toggleLegend(
          clusters.keys.map((key, ci) => ({ key, label: clusters.label(key), tone: ci + 1, si: ci })),
          wrap,
        ),
      );
    }
  };

  chartDelegateMeta.set(el, { type: () => MAP_CHART_TYPE, tooltip: () => current.tooltip !== false });
  const eventsControl = bindDatumEvents(el);

  const render = (): void => {
    const clusters = buildClusterModel(current.points.map((p) => p.cluster), current.clusters);
    if (current.legend !== undefined) legendState.hidden = current.legend === false;
    withChrome(el, current, clusters != null, paint, legendState);
  };
  render();

  return {
    el,
    spec: current,
    update(next: MapSpec | unknown): void {
      current = normalizeMapSpec(next);
      render();
    },
    on(name: ChartEventName, listener: (detail: ChartDatumDetail, event: Event) => void): () => void {
      const handler = (event: Event): void => {
        listener((event as CustomEvent<ChartDatumDetail>).detail, event);
      };
      el.addEventListener(`icen:chart-${name}`, handler as EventListener);
      return () => el.removeEventListener(`icen:chart-${name}`, handler as EventListener);
    },
    destroy(): void {
      el.textContent = '';
      eventsControl.unbind();
      chartTooltip().hidden = true;
    },
  };
}
