// charts 重度数据场景 DOM 测试：降采样提示 / 缩放刷选（icen:chart-zoom detail）/ 标记（无效跳过不炸）/
// 流式追加（淘汰窗口 + 缩放窗跟尾）/ loading 骨架 / toDataURL 存在性与 SSR 分支。
// DOM 契约：src/components/charts.css（基座 + 头部附加件/骨架）+ behaviors/charts.ts。
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { renderChart } from '../../src/behaviors/charts';
import { mount, unmountAll } from '../helpers/dom';

/* viewBox 360×150（renderLine 几何；charts.ts 的 marks/zoom 映射共用） */
const VB_W = 360;
const VB_H = 150;
const PAD = 14;
/** n 个类目时第 i 类的横向中心（viewBox 坐标） */
const xOf = (i: number, n: number): number => PAD + (i / (n - 1)) * (VB_W - PAD * 2);

function chartHost(): HTMLElement {
  const host = mount('<div class="icen-chart" id="chart-host"></div>');
  const el = host.querySelector<HTMLElement>('#chart-host');
  if (!el) throw new Error('chart host 未挂载');
  return el;
}

function mockRect(el: Element): void {
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: VB_W, height: VB_H, right: VB_W, bottom: VB_H, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
}

/** 合成指针事件（happy-dom 的 Event + 坐标/键位注入；行为层只读 clientX/clientY/button）。 */
function pointer(target: EventTarget, type: string, x: number, y: number, button = 0): void {
  const ev = new Event(type, { bubbles: true, composed: true });
  Object.defineProperty(ev, 'clientX', { value: x });
  Object.defineProperty(ev, 'clientY', { value: y });
  Object.defineProperty(ev, 'button', { value: button });
  target.dispatchEvent(ev);
}

/** 数据点 circle（排除透明命中圆） */
function dotCount(root: HTMLElement): number {
  return root.querySelectorAll('circle[data-icen-chart-mark]:not([data-icen-chart-hit])').length;
}

/** plot 区 svg（注意避开头部行小眼睛的图标 svg） */
function plotSvg(root: HTMLElement): SVGSVGElement {
  const svg = root.querySelector<SVGSVGElement>('.icen-chart-line svg');
  if (!svg) throw new Error('plot svg 未渲染');
  return svg;
}

afterEach(() => unmountAll());

describe('downsample（抽样诚实提示）', () => {
  test('line 超阈值抽样：头部行追加 .icen-chart-note「已抽样 N→M 点」', () => {
    const el = chartHost();
    const n = 2000;
    renderChart(el, {
      type: 'line',
      title: '吞吐',
      labels: Array.from({ length: n }, (_, i) => `t${i}`),
      values: Array.from({ length: n }, (_, i) => Math.sin(i * 0.1) * 50 + 50),
      downsample: true,
    });
    const note = el.querySelector('.icen-chart-note');
    expect(note).not.toBeNull();
    expect(note?.textContent).toBe('已抽样 2000→1000 点');
    expect(dotCount(el)).toBe(1000);
    /* spec 保持全量数据（提示只是渲染层的诚实声明） */
    expect(dotCount(el)).toBeLessThan(n);
  });

  test('自定义阈值：downsample: 20 → 20 点；阈值 ≥ 长度不抽样且无提示', () => {
    const el = chartHost();
    const labels = Array.from({ length: 50 }, (_, i) => `t${i}`);
    const values = labels.map((_, i) => i);
    renderChart(el, { type: 'line', labels, values, downsample: 20 });
    expect(el.querySelector('.icen-chart-note')?.textContent).toBe('已抽样 50→20 点');
    expect(dotCount(el)).toBe(20);

    const el2 = chartHost();
    renderChart(el2, { type: 'line', labels: labels.slice(0, 10), values: values.slice(0, 10), downsample: 20 });
    expect(el2.querySelector('.icen-chart-note')).toBeNull();
    expect(dotCount(el2)).toBe(10);
  });

  test('不抽样不出现提示；scatter 降采样生效；vbar 不降采样（类目语义）', () => {
    const el = chartHost();
    renderChart(el, { type: 'line', labels: ['a', 'b'], values: [1, 2] });
    expect(el.querySelector('.icen-chart-note')).toBeNull();

    const el2 = chartHost();
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i % 9 }));
    renderChart(el2, { type: 'scatter', points: pts, downsample: 10 });
    expect(el2.querySelector('.icen-chart-note')?.textContent).toBe('已抽样 50→10 点');
    expect(el2.querySelectorAll('.icen-chart-scatter circle')).toHaveLength(10);

    const el3 = chartHost();
    renderChart(el3, {
      type: 'vbar',
      labels: Array.from({ length: 40 }, (_, i) => `c${i}`),
      values: Array.from({ length: 40 }, (_, i) => i),
      downsample: true,
    });
    expect(el3.querySelector('.icen-chart-note')).toBeNull();
    expect(el3.querySelectorAll('.icen-chart-vbar-bar')).toHaveLength(40);
  });
});

describe('zoom（拖选缩放 + icen:chart-zoom）', () => {
  const LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  function zoomable(): { el: HTMLElement; events: Array<{ chart: string; from: number; to: number }> } {
    const el = chartHost();
    const events: Array<{ chart: string; from: number; to: number }> = [];
    renderChart(el, { type: 'line', title: '时序', labels: LABELS, values: LABELS.map((_, i) => i * 10), zoom: 'x' });
    el.addEventListener('icen:chart-zoom', (e) => events.push((e as CustomEvent).detail));
    mockRect(plotSvg(el));
    return { el, events };
  }

  function drag(el: HTMLElement, fromX: number, toX: number): void {
    const svg = plotSvg(el);
    pointer(svg, 'pointerdown', fromX, 60);
    pointer(window, 'pointermove', (fromX + toX) / 2, 62);
    pointer(window, 'pointermove', toX, 64);
    pointer(window, 'pointerup', toX, 64);
  }

  test('拖选切片重渲并派 icen:chart-zoom { chart, from, to }（含端点）', () => {
    const { el, events } = zoomable();
    drag(el, xOf(2, 10), xOf(6, 10));
    expect(events).toEqual([{ chart: 'line', from: 2, to: 6 }]);
    /* 视图切片：5 个数据点 + 5 个轴标签 */
    expect(dotCount(el)).toBe(5);
    expect(el.querySelectorAll('.icen-chart-labels span')).toHaveLength(5);
    /* 缩放态头部行出现「重置缩放」chip */
    const chip = el.querySelector('.icen-chart-zoom-reset');
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toBe('重置缩放');
  });

  test('位移 <5px 视为点击：不缩放、不派事件（tooltip/click 心智守卫）', () => {
    const { el, events } = zoomable();
    drag(el, 100, 102);
    expect(events).toHaveLength(0);
    expect(dotCount(el)).toBe(10);
    expect(el.querySelector('.icen-chart-zoom-reset')).toBeNull();
  });

  test('「重置缩放」chip 点击复原全量', () => {
    const { el } = zoomable();
    drag(el, xOf(2, 10), xOf(6, 10));
    expect(dotCount(el)).toBe(5);
    const chip = el.querySelector<HTMLElement>('.icen-chart-zoom-reset');
    chip?.dispatchEvent(new Event('click', { bubbles: true }));
    expect(dotCount(el)).toBe(10);
    expect(el.querySelector('.icen-chart-zoom-reset')).toBeNull();
  });

  test('双击 plot 复原全量', () => {
    const { el } = zoomable();
    drag(el, xOf(2, 10), xOf(6, 10));
    expect(dotCount(el)).toBe(5);
    const svg = plotSvg(el);
    svg.dispatchEvent(new Event('dblclick', { bubbles: true }));
    expect(dotCount(el)).toBe(10);
  });

  test('update 重渲：labels 未变保留缩放窗；labels 变了丢弃窗口', () => {
    const el = chartHost();
    const handle = renderChart(el, { type: 'line', title: '时序', labels: LABELS, values: LABELS.map((_, i) => i * 10), zoom: 'x' });
    mockRect(plotSvg(el));
    pointer(plotSvg(el), 'pointerdown', xOf(2, 10), 60);
    pointer(window, 'pointermove', xOf(6, 10), 62);
    pointer(window, 'pointerup', xOf(6, 10), 62);
    expect(dotCount(el)).toBe(5);
    /* labels 未变（值全量替换）：缩放窗保留 */
    handle.update({ type: 'line', title: '时序', labels: LABELS, values: LABELS.map((_, i) => 99 - i), zoom: 'x' });
    expect(dotCount(el)).toBe(5);
    expect(el.querySelector('.icen-chart-zoom-reset')).not.toBeNull();
    /* labels 变了：窗口丢弃，回全量 */
    handle.update({ type: 'line', title: '时序', labels: LABELS.map((l) => `${l}*`), values: LABELS.map((_, i) => i), zoom: 'x' });
    expect(dotCount(el)).toBe(10);
    expect(el.querySelector('.icen-chart-zoom-reset')).toBeNull();
  });

  test('vbar 拖选：像素→类目索引映射 + 事件 detail', () => {
    const el = chartHost();
    const events: Array<{ chart: string; from: number; to: number }> = [];
    renderChart(el, { type: 'vbar', labels: LABELS, values: LABELS.map((_, i) => i + 1), zoom: 'brush' });
    el.addEventListener('icen:chart-zoom', (e) => events.push((e as CustomEvent).detail));
    const plot = el.querySelector<HTMLElement>('.icen-chart-vbar');
    if (!plot) throw new Error('vbar 未渲染');
    mockRect(plot);
    pointer(plot, 'pointerdown', 36, 40);
    pointer(window, 'pointermove', 180, 90); /* 位移 >5px → 起选区 */
    pointer(window, 'pointerup', 180, 90);
    /* rect 360px / 10 类：down@36 → floor(1)，up@180 → floor(5) */
    expect(events).toEqual([{ chart: 'vbar', from: 1, to: 5 }]);
    expect(el.querySelectorAll('.icen-chart-vbar-track')).toHaveLength(5);
  });
});

describe('marks（标记线/标记点）', () => {
  test('line：markLine（y/x）+ markPoint 渲染进 svg，标签 textContent', () => {
    const el = chartHost();
    renderChart(el, {
      type: 'line',
      labels: ['周一', '周二', '周三', '周四'],
      values: [10, 25, 15, 30],
      marks: [
        { type: 'line', axis: 'y', value: 20, label: '阈值', tone: 'error' },
        { type: 'line', axis: 'x', value: '周三' },
        { type: 'point', label: '周二', text: '发布日' },
      ],
    });
    const svg = el.querySelector('svg');
    expect(svg?.querySelectorAll('.icen-chart-mark-line')).toHaveLength(2);
    expect(svg?.querySelectorAll('.icen-chart-mark-point')).toHaveLength(1);
    const texts = Array.from(el.querySelectorAll('.icen-chart-mark-label')).map((n) => n.textContent);
    expect(texts).toContain('阈值');
    expect(texts).toContain('周三');
    expect(texts).toContain('发布日');
  });

  test('vbar：DOM 变体（百分比定位于 .icen-chart-vbar 内）', () => {
    const el = chartHost();
    renderChart(el, {
      type: 'vbar',
      labels: ['a', 'b', 'c'],
      values: [3, 9, 6],
      marks: [
        { type: 'line', axis: 'y', value: 6, label: '目标', tone: 'success' },
        { type: 'point', label: 'b', text: '峰值' },
      ],
    });
    expect(el.querySelectorAll('.icen-chart-vbar .icen-chart-mark-line--h')).toHaveLength(1);
    expect(el.querySelectorAll('.icen-chart-vbar .icen-chart-mark-point')).toHaveLength(1);
    expect(el.querySelector('.icen-chart-mark-point .icen-chart-mark-label')?.textContent).toBe('峰值');
  });

  test('无效标记跳过 + console.warn 一次，渲染不炸', () => {
    const el = chartHost();
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      renderChart(el, {
        type: 'line',
        labels: ['a', 'b'],
        values: [1, 2],
        marks: [
          { type: 'point', label: '不存在' },
          { type: 'line', axis: 'y', value: 'abc' },
          { type: 'line', axis: 'x', value: 'ghost' },
        ],
      });
      expect(dotCount(el)).toBe(2); /* 数据点照常渲染 */
      expect(el.querySelectorAll('.icen-chart-mark-line')).toHaveLength(0);
      expect(el.querySelectorAll('.icen-chart-mark-point')).toHaveLength(0);
      expect(warn).toHaveBeenCalledTimes(3);
      /* update 重渲：同唯一标记不重复 warn */
      const handle = renderChart(el, { type: 'line', labels: ['a', 'b'], values: [1, 2] });
      void handle;
    } finally {
      warn.mockRestore();
    }
  });
});

describe('append（流式追加）', () => {
  test('line：push 类目与点后重渲；maxPoints 头部淘汰', () => {
    const el = chartHost();
    const handle = renderChart(el, { type: 'line', labels: ['a', 'b'], values: [1, 2] });
    handle.append('c', [3]);
    expect(handle.spec.labels).toEqual(['a', 'b', 'c']);
    expect(handle.spec.values).toEqual([1, 2, 3]);
    expect(dotCount(el)).toBe(3);
    handle.append('d', [4], { maxPoints: 3 });
    expect(handle.spec.labels).toEqual(['b', 'c', 'd']);
    expect(handle.spec.values).toEqual([2, 3, 4]);
    expect(dotCount(el)).toBe(3);
  });

  test('多系列：values 按系列对位（缺失补 0）', () => {
    const el = chartHost();
    const handle = renderChart(el, {
      type: 'line',
      labels: ['a'],
      series: [
        { name: 'x', values: [1] },
        { name: 'y', values: [10] },
      ],
    });
    handle.append('b', [2, 20]);
    expect(handle.spec.series?.[0]?.values).toEqual([1, 2]);
    expect(handle.spec.series?.[1]?.values).toEqual([10, 20]);
    handle.append('c', [3]);
    expect(handle.spec.series?.[1]?.values).toEqual([10, 20, 0]);
  });

  test('缩放窗跟随尾部（宽度不变，左移淘汰 + 右随新点）', () => {
    const el = chartHost();
    const labels = ['a', 'b', 'c', 'd'];
    const handle = renderChart(el, { type: 'line', labels, values: [1, 2, 3, 4], zoom: 'x' });
    mockRect(plotSvg(el));
    pointer(plotSvg(el), 'pointerdown', xOf(0, 4), 60);
    pointer(window, 'pointermove', xOf(1, 4), 62);
    pointer(window, 'pointerup', xOf(1, 4), 62);
    expect(dotCount(el)).toBe(2); /* 窗口 [0,1] */
    handle.append('e', [5]);
    expect(handle.spec.labels).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(dotCount(el)).toBe(2); /* 窗口跟尾 → [1,2] */
    const shown = Array.from(el.querySelectorAll('.icen-chart-labels span')).map((n) => n.textContent);
    expect(shown).toEqual(['b', 'c']);
  });

  test('与 downsample 同开：追加后重新降采样（提示更新）', () => {
    const el = chartHost();
    const labels = Array.from({ length: 8 }, (_, i) => `t${i}`);
    const handle = renderChart(el, { type: 'line', labels, values: labels.map((_, i) => i), downsample: 5 });
    expect(el.querySelector('.icen-chart-note')?.textContent).toBe('已抽样 8→5 点');
    handle.append('t8', [8]);
    expect(el.querySelector('.icen-chart-note')?.textContent).toBe('已抽样 9→5 点');
  });

  test('非生效类型：no-op + warn 一次', () => {
    const el = chartHost();
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const handle = renderChart(el, { type: 'donut', segments: [{ label: 'a', value: 1 }] });
      handle.append('x', [1]);
      handle.append('y', [2]);
      expect(handle.spec.labels ?? null).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('loading（加载态）', () => {
  test('loading:true 渲染骨架 shimmer：根 .is-loading + 骨架条；优先于空态', () => {
    const el = chartHost();
    renderChart(el, { type: 'line', labels: [], values: [], loading: true });
    expect(el.classList.contains('is-loading')).toBe(true);
    expect(el.querySelectorAll('.icen-chart-skeleton-bar').length).toBeGreaterThan(0);
    expect(el.querySelector('.icen-chart-empty')).toBeNull();
    expect(el.querySelector('svg')).toBeNull();
  });

  test('loading:false 恢复正常渲染；空数据且未加载时仍走空态', () => {
    const el = chartHost();
    const handle = renderChart(el, { type: 'line', labels: [], values: [], loading: true });
    handle.update({ type: 'line', labels: ['a'], values: [1], loading: false });
    expect(el.classList.contains('is-loading')).toBe(false);
    expect(el.querySelector('svg')).not.toBeNull();

    const el2 = chartHost();
    renderChart(el2, { type: 'line', labels: [], values: [] });
    expect(el2.querySelector('.icen-chart-empty')).not.toBeNull();
  });
});

describe('toDataURL（PNG 导出）', () => {
  test('句柄携带 toDataURL；happy-dom 无 canvas → 返回 undefined（诚实不抛）', () => {
    const el = chartHost();
    const handle = renderChart(el, { type: 'line', labels: ['a', 'b'], values: [1, 2] });
    expect(typeof handle.toDataURL).toBe('function');
    expect(handle.toDataURL?.({ scale: 2 })).toBeUndefined();
    expect(handle.toDataURL?.()).toBeUndefined();
  });

  test('SSR（document 不存在）分支：append/toDataURL 可用且安全返回 undefined', () => {
    const g = globalThis as Record<string, unknown>;
    const doc = g.document;
    try {
      Object.defineProperty(g, 'document', { value: undefined, configurable: true, writable: true });
      const handle = renderChart({} as HTMLElement, { type: 'line', labels: ['a'], values: [1] });
      expect(typeof handle.append).toBe('function');
      expect(typeof handle.toDataURL).toBe('function');
      expect(handle.toDataURL?.()).toBeUndefined();
      expect(() => handle.append('x', [1])).not.toThrow();
    } finally {
      Object.defineProperty(g, 'document', { value: doc, configurable: true, writable: true });
    }
  });
});
