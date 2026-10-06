// LTTB 降采样纯函数契约：保端点 / 保序 / 阈值边界 / 峰值保留；
// 另覆盖 normalizeChartSpec 对重度数据场景新字段（downsample/zoom/marks/loading）的容错归一。
import { describe, expect, test } from 'bun:test';
import { lttb, normalizeChartSpec } from '../../src/behaviors/charts';

/** 正弦波形 + 周期扰动（非单调，贴近真实时序） */
function wave(n: number): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => ({ x: i, y: Math.round(Math.sin(i * 0.5) * 100 + (i % 7) * 13) }));
}

describe('lttb（Largest-Triangle-Three-Buckets）', () => {
  test('保端点：抽样结果首末点与源数据一致', () => {
    const data = wave(500);
    const sampled = lttb(data, 50, (p) => p.x, (p) => p.y);
    expect(sampled).toHaveLength(50);
    expect(sampled[0]).toEqual(data[0]);
    expect(sampled[sampled.length - 1]).toEqual(data[data.length - 1]);
  });

  test('保序：抽样点的 x 严格递增（视觉连线不折返）', () => {
    const data = wave(1000);
    const sampled = lttb(data, 100, (p) => p.x, (p) => p.y);
    for (let i = 1; i < sampled.length; i++) {
      expect(sampled[i]!.x).toBeGreaterThan(sampled[i - 1]!.x);
    }
  });

  test('阈值边界：<3 或 ≥长度原样返回（同一引用，不发生拷贝）', () => {
    const data = wave(100);
    expect(lttb(data, 2, (p) => p.x, (p) => p.y)).toBe(data);
    expect(lttb(data, 0, (p) => p.x, (p) => p.y)).toBe(data);
    expect(lttb(data, -5, (p) => p.x, (p) => p.y)).toBe(data);
    expect(lttb(data, 100, (p) => p.x, (p) => p.y)).toBe(data);
    expect(lttb(data, 500, (p) => p.x, (p) => p.y)).toBe(data);
    /* 长度 ≤3 的任何阈值也原样返回 */
    const tiny = wave(3);
    expect(lttb(tiny, 100, (p) => p.x, (p) => p.y)).toBe(tiny);
  });

  test('峰值保留：孤立尖峰在重抽样后仍被选中', () => {
    const data = Array.from({ length: 200 }, (_, i) => ({ x: i, y: 1 }));
    data[100] = { x: 100, y: 9999 };
    const sampled = lttb(data, 20, (p) => p.x, (p) => p.y);
    expect(sampled.some((p) => p.y === 9999)).toBe(true);
  });

  test('抽样长度精确等于阈值（含最小合法阈值 3）', () => {
    const data = wave(60);
    expect(lttb(data, 3, (p) => p.x, (p) => p.y)).toHaveLength(3);
    expect(lttb(data, 17, (p) => p.x, (p) => p.y)).toHaveLength(17);
  });

  test('getX/getY 访问器真正参与面积计算（y 维度决定取舍）', () => {
    const xs = Array.from({ length: 100 }, (_, i) => i);
    /* 仅 y 相位不同的两条曲线，抽样点集合应不同（证明不是按索引机械抽） */
    const a = xs.map((x) => ({ x, y: Math.sin(x * 0.3) }));
    const b = xs.map((x) => ({ x, y: Math.cos(x * 0.3) + 50 }));
    const sa = lttb(a, 10, (p) => p.x, (p) => p.y).map((p) => p.x);
    const sb = lttb(b, 10, (p) => p.x, (p) => p.y).map((p) => p.x);
    expect(sa).not.toEqual(sb);
  });
});

describe('normalizeChartSpec（重度数据场景字段容错归一）', () => {
  test('downsample：boolean 原样；数值字符串转 number；非法丢弃', () => {
    expect(normalizeChartSpec({ downsample: true }).downsample).toBe(true);
    expect(normalizeChartSpec({ downsample: false }).downsample).toBe(false);
    expect(normalizeChartSpec({ downsample: '500' }).downsample).toBe(500);
    expect(normalizeChartSpec({ downsample: 250 }).downsample).toBe(250);
    expect(normalizeChartSpec({ downsample: 'lots' }).downsample).toBeUndefined();
    expect(normalizeChartSpec({}).downsample).toBeUndefined();
  });

  test('zoom：只认 x / brush，其余丢弃', () => {
    expect(normalizeChartSpec({ zoom: 'x' }).zoom).toBe('x');
    expect(normalizeChartSpec({ zoom: 'brush' }).zoom).toBe('brush');
    expect(normalizeChartSpec({ zoom: 'y' }).zoom).toBeUndefined();
    expect(normalizeChartSpec({ zoom: true }).zoom).toBeUndefined();
  });

  test('loading：boolean 归一', () => {
    expect(normalizeChartSpec({ loading: true }).loading).toBe(true);
    expect(normalizeChartSpec({ loading: 'yes' }).loading).toBeUndefined();
  });

  test('marks：合法项保留（可选字段类型校验），非法项剔除不炸', () => {
    const spec = normalizeChartSpec({
      marks: [
        { type: 'line', axis: 'y', value: 20, label: '阈值', tone: 'error' },
        { type: 'line', axis: 'x', value: '周三' },
        { type: 'point', label: '周二', seriesIndex: 1, value: 42, text: '发布' },
        { type: 'line', axis: 'z', value: 1 },          /* 非法 axis */
        { type: 'line', value: 1 },                      /* 缺 axis */
        { type: 'point' },                               /* 缺 label */
        { type: 'point', label: 42 },                    /* label 非字符串 */
        { type: 'nope' },                                /* 未知类型 */
        'junk',                                          /* 非对象 */
      ],
    });
    expect(spec.marks).toEqual([
      { type: 'line', axis: 'y', value: 20, label: '阈值', tone: 'error' },
      { type: 'line', axis: 'x', value: '周三' },
      { type: 'point', label: '周二', seriesIndex: 1, value: 42, text: '发布' },
    ]);
    /* tone 白名单外剔除、marks 全非法时字段整体不存在 */
    expect(normalizeChartSpec({ marks: [{ type: 'line', axis: 'y', value: 1, tone: 'brand' }] }).marks)
      .toEqual([{ type: 'line', axis: 'y', value: 1 }]);
    expect(normalizeChartSpec({ marks: [{ type: 'nope' }] }).marks).toBeUndefined();
  });

  test('新字段保持纯 JSON 可序列化（round-trip 无损）', () => {
    const spec = normalizeChartSpec({
      type: 'line',
      labels: ['a', 'b'],
      values: [1, 2],
      downsample: 100,
      zoom: 'x',
      loading: false,
      marks: [{ type: 'line', axis: 'y', value: 1.5 }],
    });
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
  });
});
