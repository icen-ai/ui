// 图表大数据基准（方法学见 docs/spec/charts-scale-a11y.md §6）：
// 测 JS 侧耗时（降采样 / 归一化 / DOM 渲染调用），不含浏览器绘制与合成——绘制预算靠 e2e 视觉舱验收。
// 运行：bun scripts/bench-charts.mjs。输出为量级参考，硬件相关，不比绝对值、只看量级与回归趋势。
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
const { lttb, normalizeChartSpec, renderChart } = await import('../src/behaviors/charts.ts');

const now = () => performance.now();
const bench = (label, fn, repeat = 5) => {
  fn(); // 预热（JIT）
  const t0 = now();
  for (let i = 0; i < repeat; i++) fn();
  console.log(`${label.padEnd(46)} ${((now() - t0) / repeat).toFixed(2)} ms/次`);
};
const seq = (n) =>
  Array.from({ length: n }, (_, i) => ({ x: i, y: Math.sin(i / 100) * 50 + (i % 7) }));

for (const n of [1e3, 1e4, 1e5, 1e6]) {
  const pts = seq(n);
  bench(`lttb ${n}→1000`, () => { lttb(pts, 1000, (p) => p.x, (p) => p.y); });
}
for (const n of [1e3, 1e4, 1e5]) {
  const labels = Array.from({ length: n }, (_, i) => `t${i}`);
  const values = labels.map((_, i) => i % 97);
  bench(`normalizeChartSpec ${n} 类目`, () => { normalizeChartSpec({ type: 'line', labels, values }); });
}
for (const n of [1e3, 1e4]) {
  const labels = Array.from({ length: n }, (_, i) => `t${i}`);
  const values = labels.map((_, i) => i % 97);
  const host = document.createElement('div');
  document.body.appendChild(host);
  bench(`renderChart line ${n}（LTTB 默认开）`, () => {
    const h = renderChart(host, { type: 'line', labels, values, downsample: true });
    h.destroy();
    host.textContent = '';
  }, 3);
  host.remove();
}
console.log('—— 口径：bun + happy-dom，JS 侧耗时；绘制/合成预算见 spec §6 性能预算表');
