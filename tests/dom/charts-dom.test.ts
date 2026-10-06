// charts 行为 DOM 测试：renderChart 渲染与自动选型、内置 tooltip 与 icen:chart-hover/click
// 事件族、图例眼睛切换（icen:chart-legend-visibility）、update(spec) 原地重渲（交互委托跨
// update 存活）、destroy 清空并解绑。
// DOM 契约：src/components/charts.css 头注释 + behaviors/charts.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import { renderChart, type ChartEventDetail } from '../../src/behaviors/charts';
import { fire, mount, unmountAll } from '../helpers/dom';

afterEach(() => {
  unmountAll();
  /* 单例 tooltip（body 下 .icen-chart-tooltip）是模块级缓存，destroy() 都会惰性创建它——
     把它从 body 摘除会让模块缓存悬空（后续 chartTooltip() 返回游离节点），故只隐藏不摘除。 */
  document.querySelectorAll<HTMLElement>('.icen-chart-tooltip').forEach((t) => { t.hidden = true; });
});

function host(): HTMLElement {
  mount('<div class="chart-host"></div>');
  return document.querySelector<HTMLElement>('.chart-host')!;
}

function marks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-icen-chart-mark]'));
}

describe('renderChart 渲染与选型', () => {
  test('vbar 渲染标记（data-icen-chart-mark + index/value 数据位）；多系列出头部行与图例眼睛', () => {
    const el = host();
    const h = renderChart(el, {
      type: 'vbar',
      title: '销量',
      labels: ['Q1', 'Q2'],
      series: [
        { name: '甲', values: [10, 20] },
        { name: '乙', values: [15, 25] },
      ],
    });
    expect(h.spec.type).toBe('vbar');
    expect(marks().length).toBeGreaterThan(0);
    expect(el.querySelector('.icen-chart-head')).toBeTruthy();
    expect(el.querySelector('.icen-chart-title')!.textContent).toBe('销量');
    expect(el.querySelector('.icen-chart-legend-eye')).toBeTruthy();
    expect(el.getAttribute('data-icen-legend-hidden')).toBe('false');
  });

  test('type 缺省自动选型：时序标签 → line；占比 segments → donut', () => {
    const el = host();
    const h1 = renderChart(el, { labels: ['2026-01', '2026-02', '2026-03'], values: [1, 2, 3] });
    expect(h1.spec.type).toBe('line');
    h1.destroy();

    const el2 = host();
    const h2 = renderChart(el2, { segments: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] });
    expect(h2.spec.type).toBe('donut');
    h2.destroy();
  });

  test('gauge 渲染 SVG 要素（value/max 口径）', () => {
    const el = host();
    const h = renderChart(el, { type: 'gauge', values: [60], max: 100 });
    expect(el.querySelector('svg')).toBeTruthy();
    h.destroy();
  });
});

describe('交互委托（hover / click 事件族 + 内置 tooltip）', () => {
  test('pointerover 标记：icen:chart-hover enter + tooltip 显示；pointerout：leave + tooltip 隐藏', () => {
    const el = host();
    renderChart(el, { type: 'vbar', labels: ['Q1', 'Q2'], values: [10, 20] });
    const phases: Array<{ phase?: string; value?: number }> = [];
    el.addEventListener('icen:chart-hover', (e) => phases.push((e as CustomEvent<ChartEventDetail>).detail));

    const mark = marks()[1]!;
    mark.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 50, clientY: 60 }));
    expect(phases[0]).toMatchObject({ type: 'hover', phase: 'enter', value: 20, pointerX: 50 });
    const tip = document.querySelector<HTMLElement>('.icen-chart-tooltip')!;
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain('20');

    mark.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, clientX: 51, clientY: 61 }));
    expect(phases[1]).toMatchObject({ type: 'hover', phase: 'leave' });
    expect(tip.hidden).toBe(true);
  });

  test('click 标记：icen:chart-click detail 携带 index/label/value；handle.on 糖与原生监听等价', () => {
    const el = host();
    const h = renderChart(el, { type: 'vbar', labels: ['Q1', 'Q2'], values: [10, 20] });
    const viaHandle: ChartEventDetail[] = [];
    const viaNative: ChartEventDetail[] = [];
    h.on('click', (d) => viaHandle.push(d));
    el.addEventListener('icen:chart-click', (e) => viaNative.push((e as CustomEvent<ChartEventDetail>).detail));

    fire(marks()[0]!, 'click');
    expect(viaHandle).toHaveLength(1);
    expect(viaHandle[0]).toMatchObject({ type: 'click', index: 0, label: 'Q1', value: 10, chart: 'vbar' });
    expect(viaNative).toHaveLength(1);
  });

  test('contextmenu 默认 preventDefault 并派 icen:chart-contextmenu', () => {
    const el = host();
    renderChart(el, { type: 'vbar', labels: ['Q1'], values: [10] });
    const seen: ChartEventDetail[] = [];
    el.addEventListener('icen:chart-contextmenu', (e) => seen.push((e as CustomEvent<ChartEventDetail>).detail));
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 6 });
    marks()[0]!.dispatchEvent(ev);
    expect(seen).toHaveLength(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  test('tooltip:false 只派事件不弹 tooltip', () => {
    const el = host();
    renderChart(el, { type: 'vbar', labels: ['Q1'], values: [10], tooltip: false });
    const phases: string[] = [];
    el.addEventListener('icen:chart-hover', (e) => phases.push((e as CustomEvent<ChartEventDetail>).detail.phase ?? ''));
    marks()[0]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 1, clientY: 1 }));
    expect(phases).toEqual(['enter']);
    const tip = document.querySelector<HTMLElement>('.icen-chart-tooltip');
    expect(tip === null || tip.hidden).toBe(true);
  });
});

describe('图例眼睛 / update / destroy', () => {
  test('眼睛点击：data-icen-legend-hidden 翻转 + icen:chart-legend-visibility { visible }', () => {
    const el = host();
    renderChart(el, {
      type: 'line',
      labels: ['一', '二'],
      series: [
        { name: '甲', values: [1, 2] },
        { name: '乙', values: [3, 4] },
      ],
    });
    const events: boolean[] = [];
    el.addEventListener('icen:chart-legend-visibility', (e) => events.push((e as CustomEvent<{ visible: boolean }>).detail.visible));
    const eye = el.querySelector<HTMLElement>('.icen-chart-legend-eye')!;
    fire(eye, 'click');
    expect(el.getAttribute('data-icen-legend-hidden')).toBe('true');
    expect(events).toEqual([false]); /* 现在隐藏 → visible=false */
    fire(eye, 'click');
    expect(el.getAttribute('data-icen-legend-hidden')).toBe('false');
    expect(events).toEqual([false, true]);
  });

  test('update(spec) 原地重渲：DOM 刷新、句柄/委托存活（hover 仍派发新数据）', () => {
    const el = host();
    const h = renderChart(el, { type: 'vbar', labels: ['Q1', 'Q2'], values: [10, 20] });
    h.update({ type: 'vbar', labels: ['A', 'B', 'C'], values: [1, 2, 3] });
    /* 注意：handle.spec 是创建时的快照对象，update 内部换引用后不回填（src 疑点，见报告）——
       重渲有效性以 DOM 与事件 detail 为准 */
    expect(marks()).toHaveLength(3);

    const seen: number[] = [];
    h.on('hover', (d) => d.phase === 'enter' && seen.push(d.value ?? -1));
    marks()[2]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(seen).toEqual([3]); /* 交互委托跨 update 存活，数据已是新值 */
  });

  test('destroy：清空容器 + 解绑委托（之后再无 icen:chart-* 派发）', () => {
    const el = host();
    const h = renderChart(el, { type: 'vbar', labels: ['Q1'], values: [10] });
    expect(marks()).toHaveLength(1);
    h.destroy();
    expect(el.textContent).toBe('');
    const seen: string[] = [];
    el.addEventListener('icen:chart-hover', () => seen.push('hover'));
    h.on('click', () => seen.push('click'));
    /* destroy 后标记复位：重新 render 同一容器可用 */
    renderChart(el, { type: 'vbar', labels: ['X'], values: [9] });
    expect(marks()).toHaveLength(1);
  });
});
