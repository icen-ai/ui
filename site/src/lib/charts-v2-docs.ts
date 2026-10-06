/*
 * charts 重度数据场景文档分片（v1.0）——降采样 / 缩放刷选 / 标记 / 流式追加 / 导出 / 加载态各一节。
 * 覆盖 renderChart 纯 JSON spec 的六个新字段与 handle.append / handle.toDataURL；
 * 主会话统一注册进 COMPONENTS 导航（本文件只产出数据，与 kb-docs-*.ts 同形态）。
 * 契约源：src/behaviors/charts.ts（lttb / normalizeChartSpec / renderChart 管线）。
 */
import type { ComponentDoc } from './components';

export const CHARTS_V2_DOCS: ComponentDoc[] = [
  {
    slug: 'charts-downsample',
    name: '降采样（LTTB）',
    group: '图表',
    desc: 'spec.downsample：大点数序列渲染前的 Largest-Triangle-Three-Buckets 视觉保形抽样（纯函数 lttb 导出可单测）。true → 阈值 1000；number → 自定阈值；line/area/scatter 生效（vbar 类目语义不降采样）。保端点保序、峰值优先；发生抽样时头部行追加 faint 提示 .icen-chart-note「已抽样 N→M 点」（诚实纪律：不抽样不出现，spec 数据保持全量）。阈值 <3 或 ≥长度原样返回。',
    demo: `<p class="demo-label" style="margin:0 0 10px">5000 点正弦波以 downsample: true 渲染（阈值 1000）——头部行出现「已抽样」提示 · 数据点实际只画 1000 个</p>
<div class="icen-chart" id="demo-charts-downsample" style="border:1px solid var(--icen-token-line-soft);border-radius:var(--icen-radius-md);padding:12px"></div>
<p class="demo-label" id="charts-downsample-status" style="margin-top:8px">…</p>`,
    usage: `import { renderChart } from '@icen.ai/ui/behaviors/charts';

renderChart(el, {
  type: 'line',
  labels, values,            // 5000 点全量数据（spec 保持全量，提示只是渲染层声明）
  downsample: true,          // true → 阈值 1000；number（如 200）→ 自定阈值
});
/* 头部行自动追加 faint 提示：已抽样 5000→1000 点（.icen-chart-note）
   纯 DOM 图型不降采样：vbar 类目语义，点必须逐个可点 */

// lttb 纯函数也可单独使用（任意序列）：
import { lttb } from '@icen.ai/ui/behaviors/charts';
const sampled = lttb(points, 1000, (p) => p.x, (p) => p.y);
// 保端点 / 保序 / 阈值 <3 或 ≥长度原样返回`,
    behaviors: ['charts'],
    script: `const M = chartsMod;
const host = document.getElementById('demo-charts-downsample');
const status = document.getElementById('charts-downsample-status');
if (host) {
  const N = 5000;
  const labels = Array.from({ length: N }, function (_, i) { return 't' + i; });
  const values = Array.from({ length: N }, function (_, i) {
    return Math.round((Math.sin(i * 0.01) * 40 + Math.sin(i * 0.113) * 12 + 50) * 100) / 100;
  });
  M.renderChart(host, { type: 'line', title: '5000 点吞吐（LTTB 抽样）', labels, values, downsample: true });
  const note = host.querySelector('.icen-chart-note');
  const dots = host.querySelectorAll('circle[data-icen-chart-mark]:not([data-icen-chart-hit])').length;
  if (status) status.textContent = '头部提示：「' + (note ? note.textContent : '无') + '」 · 实际绘制 ' + dots + ' / ' + N + ' 点';
}`,
  },
  {
    slug: 'charts-zoom',
    name: '缩放 / 刷选',
    group: '图表',
    desc: 'spec.zoom（line/area/vbar）：在 plot 区按下拖出选区（半透明 rect，--icen-token-accent 10% 填充），松开后按选区像素→类目索引映射切片重渲并派 icen:chart-zoom { chart, from, to }（类目索引区间含端点）。缩放态头部行出现「重置缩放」chip，双击 plot 也复原；位移 <5px 视为点击（tooltip/图例/事件照常）；update 重渲 labels 未变时保留缩放窗，append 时窗口跟随尾部。\'x\' 横向拖选，\'brush\' 自由框选（仍按类目索引区间切片）。',
    demo: `<p class="demo-label" style="margin:0 0 10px">在图上按住拖选一段 → 切片重渲并派 icen:chart-zoom · 点「重置缩放」chip 或双击 plot 复原 · 拖距 &lt;5px 仍是点击</p>
<div class="icen-chart" id="demo-charts-zoom" style="border:1px solid var(--icen-token-line-soft);border-radius:var(--icen-radius-md);padding:12px"></div>
<p class="demo-label" id="charts-zoom-log" style="margin-top:8px">事件日志：等待拖选…</p>`,
    usage: `const handle = renderChart(el, {
  type: 'line', labels, values,
  zoom: 'x',                   // 'x' 横向拖选 | 'brush' 自由框选
});
el.addEventListener('icen:chart-zoom', (e) => {
  const { chart, from, to } = e.detail;   // 类目索引区间（含端点）
  fetchRange(from, to).then((detail) => handle.update({ type: 'line', labels, values: detail, zoom: 'x' }));
});
/* 复原：头部「重置缩放」chip / 双击 plot / 选满全量（update 时 labels 未变窗口保留） */`,
    behaviors: ['charts'],
    script: `const M = chartsMod;
const host = document.getElementById('demo-charts-zoom');
const logEl = document.getElementById('charts-zoom-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 3000);
}
if (host) {
  const N = 60;
  const labels = Array.from({ length: N }, function (_, i) { return 'T' + (i + 1); });
  const values = labels.map(function (_, i) { return Math.round((Math.sin(i * 0.35) * 30 + 50 + (i % 9) * 2) * 10) / 10; });
  const handle = M.renderChart(host, { type: 'line', title: '分钟级时序（拖选缩放）', labels, values, zoom: 'x' });
  host.addEventListener('icen:chart-zoom', function (e) {
    log('icen:chart-zoom · icen-chart=' + e.detail.chart + ' · [' + e.detail.from + ' … ' + e.detail.to + ']（窗口 ' + (e.detail.to - e.detail.from + 1) + ' 类）');
    void handle;
  });
}`,
  },
  {
    slug: 'charts-marks',
    name: '标记线 / 标记点',
    group: '图表',
    desc: 'spec.marks（纯 JSON）：markLine 画水平（axis:\'y\'，数值）或垂直（axis:\'x\'，类目名/索引）参考线——dashed，--icen-token-<tone>（success/warning/error/info，缺省 muted）+ 尾部标签（视口内夹取）；markPoint 在对应类目/系列处画标记点 + text 标注。无效标记（类目不存在/值 NaN/系列越界）跳过并 console.warn 一次（按唯一标记去重），不炸渲染。',
    demo: `<p class="demo-label" style="margin:0 0 10px">阈值参考线（error tone）+ 版本发布垂直线 + 峰值标记点——「ghost」类目不存在，被跳过并 warn 一次</p>
<div class="icen-chart" id="demo-charts-marks" style="border:1px solid var(--icen-token-line-soft);border-radius:var(--icen-radius-md);padding:12px"></div>`,
    usage: `renderChart(el, {
  type: 'line', labels, values,
  marks: [
    { type: 'line', axis: 'y', value: 80, label: '告警阈值', tone: 'error' },
    { type: 'line', axis: 'y', value: 40, label: '水位下限' },        // 缺省 muted
    { type: 'line', axis: 'x', value: 'v1.0' },                      // 类目名（也接受索引 number）
    { type: 'point', label: '周三', seriesIndex: 1, text: '发布日' }, // 系列标记点
  ],
});
/* 无效标记诚实跳过：{ type: 'point', label: '不存在' } → console.warn 一次，渲染照常 */`,
    behaviors: ['charts'],
    script: `const M = chartsMod;
const host = document.getElementById('demo-charts-marks');
if (host) {
  const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  M.renderChart(host, {
    type: 'line',
    title: '一周活跃（带标记）',
    labels: DAYS,
    series: [
      { name: 'Web', values: [42, 58, 95, 66, 88, 52, 74] },
      { name: 'CLI', values: [18, 22, 61, 30, 42, 35, 28] },
    ],
    marks: [
      { type: 'line', axis: 'y', value: 80, label: '告警阈值', tone: 'error' },
      { type: 'line', axis: 'y', value: 40, label: '水位下限' },
      { type: 'line', axis: 'x', value: '周三', label: '发布' },
      { type: 'point', label: '周三', seriesIndex: 0, text: '峰值' },
      { type: 'point', label: 'ghost', text: '无效示例' },
    ],
  });
}`,
  },
  {
    slug: 'charts-append',
    name: '流式追加',
    group: '图表',
    desc: 'handle.append(label, values, { maxPoints })（line/area/vbar）：复用当前 spec 对象 push 类目与点后重渲（交互委托不动，高效路径）；超出 maxPoints 时头部淘汰（滑动窗口）；多系列 values 按系列对位（缺失补 0）；缩放窗开启时跟随尾部；与 downsample 同开时追加后重新降采样（提示更新）。非生效类型 no-op + console.warn 一次。',
    demo: `<p class="demo-label" style="margin:0 0 10px">点「推送一拍」模拟流式数据（maxPoints 30 滑动窗口）——头部行提示随追加更新</p>
<div class="icen-toolbar" style="margin:0 0 10px">
  <button class="icen-btn icen-btn-sm icen-btn-primary" type="button" id="charts-append-push">推送一拍</button>
  <button class="icen-btn icen-btn-sm" type="button" id="charts-append-burst">连推 10 拍</button>
</div>
<div class="icen-chart" id="demo-charts-append" style="border:1px solid var(--icen-token-line-soft);border-radius:var(--icen-radius-md);padding:12px"></div>
<p class="demo-label" id="charts-append-status" style="margin-top:8px">…</p>`,
    usage: `const handle = renderChart(el, { type: 'line', labels, values, downsample: true });
source.onTick((label, value) => {
  handle.append(label, [value], { maxPoints: 500 });  // 滑动窗口：超出头部淘汰
});
/* 多系列：handle.append(label, [s1, s2], { maxPoints })（缺失值补 0）
   缩放态 append：窗口跟随尾部；非 line/area/vbar → no-op + warn 一次 */`,
    behaviors: ['charts'],
    script: `const M = chartsMod;
const host = document.getElementById('demo-charts-append');
const status = document.getElementById('charts-append-status');
let tick = 0;
let handle = null;
function syncStatus() {
  if (!status || !handle) return;
  const note = host.querySelector('.icen-chart-note');
  status.textContent = 'spec 窗口：' + handle.spec.labels.length + ' 点（最新 ' + handle.spec.labels[handle.spec.labels.length - 1] + '）'
    + (note ? ' · ' + note.textContent : '');
}
if (host) {
  const labels = Array.from({ length: 12 }, function (_, i) { return 'T' + (i + 1); });
  handle = M.renderChart(host, {
    type: 'line',
    title: '实时吞吐（滑动窗口 30）',
    labels,
    values: labels.map(function (_, i) { return Math.round(40 + Math.sin(i * 0.6) * 20); }),
    downsample: 30,
  });
  syncStatus();
}
function push() {
  if (!handle) return;
  tick += 1;
  handle.append('T' + (12 + tick), [Math.round(40 + Math.sin((12 + tick) * 0.6) * 20 + Math.random() * 8)], { maxPoints: 30 });
  syncStatus();
}
const pushBtn = document.getElementById('charts-append-push');
if (pushBtn) pushBtn.addEventListener('click', push);
const burstBtn = document.getElementById('charts-append-burst');
if (burstBtn) burstBtn.addEventListener('click', function () { for (let i = 0; i < 10; i++) push(); });`,
  },
  {
    slug: 'charts-todataurl',
    name: '导出 PNG',
    group: '图表',
    desc: 'handle.toDataURL({ scale })（默认 2x）：SVG 序列化（补 xmlns/宽高）→ Image 载入 → canvas 光栅化 → PNG dataURL，按渲染内容缓存（同 scale 再次调用即时返回）。诚实不抛：SSR/无 canvas 环境、纯 DOM 图型（vbar 等根下无 SVG）返回 undefined；SVG→Image 异步——首次调用触发绘制返回 undefined，完成后（或下帧）同 scale 再取。典型接法：点「导出」→ 首调 undefined → rAF/setTimeout 后再取 → a[download] 落盘。',
    demo: `<p class="demo-label" style="margin:0 0 10px">导出当前折线为 PNG（2x 光栅化）——真实浏览器中第二次取值即得 dataURL</p>
<div class="icen-toolbar" style="margin:0 0 10px">
  <button class="icen-btn icen-btn-sm icen-btn-primary" type="button" id="charts-export-btn">导出 PNG</button>
</div>
<div class="icen-chart" id="demo-charts-export" style="border:1px solid var(--icen-token-line-soft);border-radius:var(--icen-radius-md);padding:12px"></div>
<p class="demo-label" id="charts-export-status" style="margin-top:8px">…</p>`,
    usage: `const handle = renderChart(el, { type: 'line', labels, values });
btn.addEventListener('click', () => {
  const first = handle.toDataURL?.({ scale: 2 });   // 首次：触发光栅化，可能 undefined（诚实）
  setTimeout(() => {
    const url = handle.toDataURL?.({ scale: 2 });   // 缓存命中：PNG dataURL
    if (!url) return;                                 // 无 canvas / 纯 DOM 图型：undefined 不抛
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.png';
    a.click();
  }, 60);
});`,
    behaviors: ['charts'],
    script: `const M = chartsMod;
const host = document.getElementById('demo-charts-export');
const btn = document.getElementById('charts-export-btn');
const status = document.getElementById('charts-export-status');
let handle = null;
if (host) {
  const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  handle = M.renderChart(host, {
    type: 'line',
    title: '一周活跃（导出 PNG）',
    labels: DAYS,
    series: [
      { name: 'Web', values: [8, 14, 9, 18, 22, 16, 25] },
      { name: 'CLI', values: [3, 5, 4, 8, 6, 11, 9] },
    ],
    marks: [{ type: 'line', axis: 'y', value: 20, label: '阈值', tone: 'warning' }],
  });
  if (status) {
    const probe = handle.toDataURL ? handle.toDataURL() : undefined;
    status.textContent = 'toDataURL 可用性探测：' + (probe ? '直接可用（' + probe.length + ' 字符）' : '当前环境无 canvas——返回 undefined（诚实分支，真实浏览器首次调用后第二次取值即得 PNG）');
  }
}
if (btn) btn.addEventListener('click', function () {
  if (!handle || !handle.toDataURL) return;
  handle.toDataURL({ scale: 2 });                 /* 首次触发光栅化 */
  setTimeout(function () {
    const url = handle.toDataURL({ scale: 2 });
    if (!url) {
      if (status) status.textContent = '本环境不支持 canvas 光栅化（返回 undefined，不抛异常）';
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.png';
    a.click();
    if (status) status.textContent = '已导出 PNG（' + url.length + ' 字符 dataURL）';
  }, 80);
});`,
  },
  {
    slug: 'charts-loading',
    name: '加载态',
    group: '图表',
    desc: 'spec.loading：true 时渲染骨架 shimmer（复用全库共享 keyframes icen-skeleton-pulse，类 .icen-chart.is-loading + .icen-chart-skeleton-bar），优先于空态（loading 期间不出现 .icen-chart-empty）；update 切回 false 即恢复数据渲染。与 downsample/zoom/marks 同开时加载态优先生效（数据就绪前不做几何计算）。',
    demo: `<p class="demo-label" style="margin:0 0 10px">切换 loading 看骨架 shimmer 与数据渲染互替（loading 优先于空态）</p>
<div class="icen-toolbar" style="margin:0 0 10px">
  <button class="icen-btn icen-btn-sm icen-btn-primary" type="button" id="charts-loading-toggle">切换加载态</button>
</div>
<div class="icen-chart" id="demo-charts-loading" style="border:1px solid var(--icen-token-line-soft);border-radius:var(--icen-radius-md);padding:12px"></div>`,
    usage: `const handle = renderChart(el, { type: 'line', labels: [], values: [], loading: true });
/* 骨架 shimmer（icen-skeleton-pulse）：.icen-chart.is-loading > .icen-chart-body > .icen-chart-skeleton-bar
   ——loading 优先于 emptyLabel（空数据 + loading 也只显示骨架） */
fetchData().then((data) => {
  handle.update({ type: 'line', labels: data.labels, values: data.values, loading: false });
});`,
    behaviors: ['charts'],
    script: `const M = chartsMod;
const host = document.getElementById('demo-charts-loading');
const btn = document.getElementById('charts-loading-toggle');
let handle = null;
let loading = true;
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
function paint() {
  if (!host) return;
  const spec = loading
    ? { type: 'line', title: '一周活跃', labels: [], values: [], loading: true }
    : { type: 'line', title: '一周活跃', labels: DAYS, values: [8, 14, 9, 18, 22, 16, 25], loading: false };
  if (handle) handle.update(spec);
  else handle = M.renderChart(host, spec);
}
paint();
if (btn) btn.addEventListener('click', function () { loading = !loading; paint(); });`,
  },
];
