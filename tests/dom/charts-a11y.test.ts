// charts a11y 层 DOM 测试：自动摘要（aria-describedby）、数据表替代视图、键盘游标
// （方向键/Home/End/系列切换/Esc 缩放复位）与 live region 播报。
// DOM 契约：src/behaviors/charts.ts 的 a11y 块 + src/components/charts.css。
import { afterEach, describe, expect, test } from 'bun:test';
import { renderChart } from '../../src/behaviors/charts';
import { mount, unmountAll } from '../helpers/dom';

afterEach(() => {
  unmountAll();
  document.querySelectorAll<HTMLElement>('.icen-chart-tooltip').forEach((t) => { t.hidden = true; });
});

function host(): HTMLElement {
  mount('<div class="chart-host"></div>');
  return document.querySelector<HTMLElement>('.chart-host')!;
}

const LINE = {
  type: 'line',
  title: '季度收入',
  labels: ['一月', '二月', '三月', '四月'],
  series: [
    { name: '今年', values: [3, 5, 4, 8] },
    { name: '去年', values: [2, 4, 3, 6] },
  ],
} as const;

function keydown(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('图表 a11y：自动摘要', () => {
  test('summary 默认开启：sr-only 摘要经 aria-describedby 挂到图形，含系列数/范围/最值/趋势', () => {
    const el = host();
    const h = renderChart(el, { ...LINE });
    const graphic = el.querySelector('[role="img"]')!;
    const id = graphic.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    const summary = el.querySelector<HTMLElement>(`#${id}`)!;
    expect(summary.className).toBe('icen-chart-summary');
    expect(summary.textContent).toContain('2 个系列');
    expect(summary.textContent).toContain('一月');
    expect(summary.textContent).toContain('四月');
    expect(summary.textContent).toContain('最大 8');
    expect(summary.textContent).toContain('趋势上升');
    h.destroy();
  });

  test('a11y.summary=false 时无摘要节点', () => {
    const el = host();
    const h = renderChart(el, { ...LINE, a11y: { summary: false, keyboard: false } });
    expect(el.querySelector('.icen-chart-summary')).toBeNull();
    expect(el.querySelector('[role="img"]')!.getAttribute('aria-describedby')).toBeNull();
    h.destroy();
  });
});

describe('图表 a11y：数据表替代视图', () => {
  test('a11y.table=true 渲染 sr-only 数据表（表头系列名 + 行类目/值）', () => {
    const el = host();
    const h = renderChart(el, { ...LINE, a11y: { table: true } });
    const table = el.querySelector('table.icen-chart-table')!;
    expect(table).toBeTruthy();
    expect(table.querySelector('caption')!.textContent).toContain('季度收入');
    const head = Array.from(table.querySelectorAll('thead th')).map((c) => c.textContent);
    expect(head).toEqual(['', '今年', '去年']);
    const firstRow = Array.from(table.querySelectorAll('tbody tr')[0]!.querySelectorAll('td')).map((c) => c.textContent);
    expect(firstRow).toEqual(['一月', '3', '2']);
    h.destroy();
  });
});

describe('图表 a11y：键盘游标', () => {
  test('line：方向键移点、ArrowDown 切系列、Home/End 跳首尾；live region 播报', () => {
    const el = host();
    const h = renderChart(el, { ...LINE });
    const graphic = el.querySelector<HTMLElement>('[data-icen-chart-kb]')!;
    expect(graphic.getAttribute('tabindex')).toBe('0');
    const live = () => el.querySelector('.icen-chart-live')?.textContent ?? '';

    keydown(graphic, 'ArrowRight');
    expect(live()).toContain('今年');
    expect(live()).toContain('二月');
    expect(live()).toContain('第 2/4 点');
    const dot = () => el.querySelector('circle.icen-chart-kb-focus');
    expect(dot()).toBeTruthy();

    keydown(graphic, 'ArrowDown');
    expect(live()).toContain('去年');
    keydown(graphic, 'End');
    expect(live()).toContain('第 4/4 点');
    keydown(graphic, 'Home');
    expect(live()).toContain('第 1/4 点');
    expect(live()).toContain('一月');

    /* 边界 clamp：越界不再移动 */
    keydown(graphic, 'ArrowLeft');
    expect(live()).toContain('第 1/4 点');
    h.destroy();
  });

  test('vbar（纯 DOM）：柱条获得游标类；update 重渲后游标保持', () => {
    const el = host();
    const h = renderChart(el, { type: 'vbar', labels: ['A', 'B', 'C'], values: [1, 2, 3] });
    const graphic = el.querySelector<HTMLElement>('[data-icen-chart-kb]')!;
    keydown(graphic, 'ArrowRight');
    const bars = el.querySelectorAll('.icen-chart-vbar-bar');
    expect(bars[1]!.classList.contains('icen-chart-kb-focus')).toBe(true);
    h.update({ type: 'vbar', labels: ['A', 'B', 'C'], values: [4, 5, 6] });
    const bars2 = el.querySelectorAll('.icen-chart-vbar-bar');
    expect(bars2[1]!.classList.contains('icen-chart-kb-focus')).toBe(true);
    h.destroy();
  });

  test('a11y.keyboard=false：不挂 tabindex 与游标入口', () => {
    const el = host();
    const h = renderChart(el, { ...LINE, a11y: { keyboard: false } });
    expect(el.querySelector('[data-icen-chart-kb]')).toBeNull();
    expect(el.querySelector('[role="img"]')!.getAttribute('tabindex')).toBeNull();
    h.destroy();
  });

  test('destroy 解绑键盘监听（静默不抛）', () => {
    const el = host();
    const h = renderChart(el, { ...LINE });
    const graphic = el.querySelector<HTMLElement>('[data-icen-chart-kb]')!;
    h.destroy();
    expect(() => keydown(graphic, 'ArrowRight')).not.toThrow();
  });
});
