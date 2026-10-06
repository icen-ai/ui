// 图表通用层契约测试：normalizeChartSpec（别名归一 + data[]+dims pivot）、
// inferChartType 自动选型（确定性规则）、chartFormatValue 四档格式化。
import { describe, expect, test } from 'bun:test';
import { chartFormatValue, inferChartType, normalizeChartSpec } from '../../src/behaviors/charts';

describe('normalizeChartSpec（别名归一 + 类型纠正 + 数值容错）', () => {
  test('业界/LLM 别名全部归一到 canonical 类型', () => {
    const cases: Array<[string, string]> = [
      ['bar', 'vbar'],
      ['column', 'vbar'],
      ['horizontal-bar', 'hbar'],
      ['ranking', 'hbar'],
      ['pie', 'donut'],
      ['ring', 'donut'],
      ['stacked-bar', 'stack'],
      ['time', 'line'],
      ['trend-line', 'line'],
      ['contribution-graph', 'calendar'],
      ['heat', 'heatmap'],
      ['bubble', 'scatter'],
      ['dial', 'gauge'],
      ['mini', 'sparkline'],
      ['spider', 'radar'],
    ];
    for (const [alias, canonical] of cases) {
      expect(normalizeChartSpec({ type: alias }).type).toBe(canonical);
    }
  });

  test('大小写不敏感；未知类型原样保留（向前兼容新图型）', () => {
    expect(normalizeChartSpec({ type: '  BAR ' }).type).toBe('vbar');
    expect(normalizeChartSpec({ type: 'future-kind' }).type).toBe('future-kind');
  });

  test('字符串输入走 JSON.parse；坏 JSON 返回空 spec（不抛异常）', () => {
    expect(normalizeChartSpec('{"type":"pie","labels":["a"],"values":[1]}')).toEqual({
      type: 'donut',
      labels: ['a'],
      values: [1],
    });
    expect(normalizeChartSpec('{oops')).toEqual({});
    expect(normalizeChartSpec(42)).toEqual({});
  });

  test('data[] + dims pivot：多系列矩阵，稀疏缺失值填 0', () => {
    const spec = normalizeChartSpec({
      data: [
        { quarter: 'Q1', team: '甲', amount: 10 },
        { quarter: 'Q2', team: '甲', amount: 30 },
        { quarter: 'Q1', team: '乙', amount: 20 },
      ],
      dims: { label: 'quarter', series: 'team', value: 'amount' },
    });
    expect(spec.labels).toEqual(['Q1', 'Q2']);
    expect(spec.series).toEqual([
      { name: '甲', values: [10, 30] },
      { name: '乙', values: [20, 0] }, /* Q2 缺失 → 0 */
    ]);
  });

  test('data[] 无 series 字段 → 单系列 values；显式 values 优先于 pivot', () => {
    expect(normalizeChartSpec({ data: [{ label: 'a', value: 3 }, { label: 'b', value: 4 }] })).toEqual({
      data: [{ label: 'a', value: 3 }, { label: 'b', value: 4 }],
      labels: ['a', 'b'],
      values: [3, 4],
    });
    expect(normalizeChartSpec({ data: [{ label: 'a', value: 3 }], values: [9] }).values).toEqual([9]);
  });

  test('日历型 {date,value} 记录保持 data 原样（heatMap/calendar 自行消费）', () => {
    const spec = normalizeChartSpec({ data: [{ date: '2024-01-01', value: 2 }] });
    expect(spec.data).toEqual([{ date: '2024-01-01', value: 2 }]);
    expect(spec.labels).toBeUndefined();
    expect(spec.values).toBeUndefined();
  });

  test('数值容错：千分位/百分号字符串转数值，非数值丢弃', () => {
    expect(normalizeChartSpec({ values: ['1,234', '56%', 'junk', 7] }).values).toEqual([1234, 56, 7]);
  });
});

describe('inferChartType（未指定 type 的确定性自动选型）', () => {
  test('时序标签 → line：ISO 日期 / 纯年份 / 年月 / 星期 / 版本号', () => {
    expect(inferChartType({ labels: ['2024-01-01', '2024-01-02', '2024-01-03'] })).toBe('line');
    expect(inferChartType({ labels: ['2021', '2022', '2023', '2024'] })).toBe('line');
    expect(inferChartType({ labels: ['2024年1月', '2024年2月'] })).toBe('line');
    expect(inferChartType({ labels: ['周一', '周二', '周三'] })).toBe('line');
    expect(inferChartType({ labels: ['v0.1', 'v0.2', 'v0.3'] })).toBe('line');
  });

  test('脏标签容忍 4 成：6 成命中即判时间轴', () => {
    expect(inferChartType({ labels: ['2024-01-01', '2024-01-02', 'note', '2024-01-04', '2024-01-05'] })).toBe('line');
    expect(inferChartType({ labels: ['2024-01-01', 'x', 'y'] })).toBe('vbar');
  });

  test('非时序：≤8 类目单系列 → vbar；>8 类目 → hbar（长类目横排）', () => {
    expect(inferChartType({ labels: ['苹果', '香蕉', '橙'], values: [1, 2, 3] })).toBe('vbar');
    const nine = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    expect(inferChartType({ labels: nine, values: nine.map((_, i) => i) })).toBe('hbar');
  });

  test('结构化数据形态优先：points→scatter / dates→calendar / segments→donut / axes≥3→radar', () => {
    expect(inferChartType({ points: [{ x: 1, y: 2 }] })).toBe('scatter');
    expect(inferChartType({ dates: ['2024-01-01'], values: [1] })).toBe('calendar');
    expect(inferChartType({ segments: [{ label: 'a', value: 1 }] })).toBe('donut');
    expect(inferChartType({ axes: ['速', '质', '稳', '省'], values: [1, 2, 3, 4] })).toBe('radar');
  });

  test('无 labels：多系列 → line；单 series values>1 → line；max+单值 → gauge；空 → vbar', () => {
    expect(inferChartType({ series: [{ name: 'a', values: [1, 2] }, { name: 'b', values: [3, 4] }] })).toBe('line');
    expect(inferChartType({ values: [1, 2, 3] })).toBe('line');
    expect(inferChartType({ values: [42], max: 100 })).toBe('gauge');
    expect(inferChartType({})).toBe('vbar');
  });
});

describe('chartFormatValue（format 描述符 → 格式化函数）', () => {
  test('缺省 = raw 直通（String(v)）', () => {
    const fmt = chartFormatValue();
    expect(fmt(123.4)).toBe('123.4');
    expect(fmt(-7)).toBe('-7');
  });

  test('raw 档：保留 ≤2 位小数四舍五入', () => {
    const fmt = chartFormatValue({ notation: 'raw' });
    expect(fmt(3.456)).toBe('3.46');
    expect(fmt(7)).toBe('7');
  });

  test('compact 档：千 → k，百万 → M，千以下原样', () => {
    const fmt = chartFormatValue({ notation: 'compact' });
    expect(fmt(999)).toBe('999');
    expect(fmt(1500)).toBe('1.5k');
    expect(fmt(3_400_000)).toBe('3.4M');
  });

  test('percent 档：保留 1 位小数', () => {
    const fmt = chartFormatValue({ notation: 'percent' });
    expect(fmt(0.84)).toBe('0.8%');
    expect(fmt(1)).toBe('1%');
  });

  test('ms 档：四档递进 ms / s / m，零与负数归 0ms', () => {
    const fmt = chartFormatValue({ notation: 'ms' });
    expect(fmt(0)).toBe('0ms');
    expect(fmt(-5)).toBe('0ms');
    expect(fmt(520)).toBe('520ms');
    expect(fmt(2400)).toBe('2.4s');
    expect(fmt(120_000)).toBe('2m');
  });

  test('unit 后缀拼接：固定前拼一个空格；unit 自带前导空格时产生双空格（实现契约）', () => {
    expect(chartFormatValue({ unit: '个' })(5)).toBe('5 个');
    expect(chartFormatValue({ notation: 'compact', unit: '次' })(2300)).toBe('2.3k 次');
    expect(chartFormatValue({ unit: ' 个' })(5)).toBe('5  个'); /* AGENTS.md 文档示例的写法 */
  });
});
