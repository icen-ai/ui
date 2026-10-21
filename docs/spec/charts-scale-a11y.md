# 图表：数据规模、无障碍与手势（spec）

面向实现者与评审。现状事实源：`src/behaviors/charts.ts`（统一 ChartSpec + renderChart）、`src/components/charts.css`。本文件给出规模分级、渲染策略、读屏语义、键盘与手势模型、性能预算与测试策略。已落地项标注 ✅（含验证方式），接口草案标注 🔵（未实现，类型即合同）。

## 1. 数据规模分级与渲染策略

| 级别 | 规模 | 渲染策略 | 现状 |
| --- | --- | --- | --- |
| S | ≤1e3 点 | 纯 SVG/DOM 直渲，无抽样 | ✅ 默认路径 |
| M | 1e3–1e5 | SVG + LTTB 降采样（默认阈值 1000，`spec.downsample`）| ✅ `lttb()` 纯函数 + `downsampleView`；抽样时头部行提示「已抽样 N→M 点」（诚实呈现，不静默） |
| L | 1e5–1e6 | LTTB + 视窗（zoom/append 窗口切片后才对视图抽样）| ✅ zoom 窗与 `append(maxPoints)` 头部淘汰已落地 |
| XL | ≥1e6 | 分层混合：Canvas  raster 层 + SVG 交互层（热点/游标/焦点环）| 🔵 接口草案见 §7；当前 SVG 上限实测见 §6 |

降采样算法选择：**LTTB**（保形状特征，极值不丢）为默认；min-max 分桶适合密度热力预览但不保峰形，作为 🔵 `sampling.method: 'minmax'` 草案保留；时序流式场景用 `append` 的窗口淘汰而非重抽样。

渲染器选择原则：SVG 保交互与 a11y（每点是真实节点，可挂 title/焦点）；Canvas 只在 XL 级引入且必须叠加 SVG 交互层——读屏语义与键盘游标不因渲染器切换而退步。

## 2. 长列表 / 表格 / 树的虚拟滚动

| 组件 | 现状 | 方案 |
| --- | --- | --- |
| datatable | ✅ `virtual: true` 固定行高窗口化（`rowHeight` 可调，与分页互斥） | 万级行流畅；动态行高 🔵（测量缓存 + 预估高度 + 滚动锚定，见下） |
| table | 静态展示组件 | 数据量大时用 datatable；table 不引入虚拟化（职责分离） |
| tree | 无虚拟化 | 🔵 同 datatable 窗口化；展开/收起时以「首个可见节点的 key + 偏移」做滚动锚定 |

动态行高草案（🔵）：`virtual: { estimatedRowHeight: number; measure?: true }`——IntersectionObserver-free，渲染后测量真实高并写回缓存，滚动锚定 = 记录锚点 key 与其在行内的偏移，重渲后恢复。滚动锚定同样适用于 prepend（聊天/日志流）。

## 3. 屏幕阅读器语义

每个图形的语义三层（✅ 已落地，`tests/dom/charts-a11y.test.ts` 7 项）：

1. **可访问名**：`role="img"` + `aria-label` = 标题（图型）或图型（既有行为，axe 债已清）。
2. **自动摘要**：sr-only `<p>` 经 `aria-describedby` 挂载——系列数、类目范围、最值及其类目、首系列趋势（升/降/平）；scatter 播报 x/y 范围。`spec.a11y.summary: false` 可关。
3. **数据表替代视图**：`spec.a11y.table: true` 追加 sr-only `<table>`（caption + thead 系列名 + tbody 类目/值行；scatter 为 x/y 两列）。读屏器按表格语义逐格导航，复制导出同源。

各图型语义矩阵：

| 图型 | role/label | 摘要 | 键盘游标 |
| --- | --- | --- | --- |
| line/area | img + describedby ✅ | ✅ 范围/最值/趋势 | ✅ 点级（系列×点） |
| vbar/hbar | DOM 容器 img + describedby ✅ | ✅ | ✅ 柱条级 |
| scatter | img + describedby ✅ | ✅ x/y 范围 | ✅ 点级 |
| donut/radar | img ✅ | ✅ 最值 | 🔵（段导航） |
| heatmap/calendar | aria-label 网格 ✅ | ✅ 最值 | 🔵（格导航） |
| gauge/sparkline | img ✅ | ✅ 单值退化 | —（单值无导航必要） |
| graph/map | img ✅ | 🔵 节点/边计数 | 🔵 |

**不只靠颜色**：多系列折线的区分 = 颜色 + 图例文本 + tooltip/播报中的系列名 + 标记点形状（marks）；键盘游标与播报完全不依赖颜色。纹理/虚线族（stroke-dasharray 轮换）作为 🔵 增强项保留（打印/单色场景）。

## 4. 键盘导航模型与 live region

✅ 已落地（`spec.a11y.keyboard` 默认开）：

- 图形可聚焦（`tabindex=0` + `:focus-visible` 环）；**←/→** 逐点、**↑/↓** 切系列（多系列）、**Home/End** 跳首尾、**Esc** 重置缩放窗。
- 游标视觉：SVG 点圆放大加粗（`r` 几何属性 + stroke-width；不支持 `r` 的浏览器退化为描边），DOM 柱条用 accent 轮廓环。
- 播报：单个 `aria-live="polite"` region 随图表存活，播报「系列 · 类目：值，第 i/n 点」；先清空再写入保证同值重报。
- 与 tooltip/事件族正交：键盘导航不触发 hover 事件，避免双通道噪音。

## 5. 交互手势

现状（✅）：`spec.zoom: 'x'|'brush'` 指针拖选缩放（统一 pointer 事件，位移 <5px 视为点击；pointercancel 按 pointerup 收口）；头部 chip 与双击 plot 复原；`icen:chart-zoom {chart,from,to}` 广播。

本分支补齐（✅）：**触屏冲突**——zoom 启用时 plot 的 `touch-action`：`'x'` 为 `pan-y`（垂直留给页面滚动，水平拦拖选），`'brush'` 为 `none`（自由框选接管）。惯性不做（类目语义图表的惯性滚动会造成定位歧义，有意拒绝）。

键盘等价：方向键游标 = 平移/浏览等价；Esc = 重置等价；双指缩放的键盘等价 🔵（`+`/`-` 以游标为中心缩放，接口预留）。

触屏替代：tooltip 已有点击语义；游标类在触屏上不显示（无焦点）。

## 6. 性能预算与基准

预算（验收口径，桌面中端机 Chrome；首绘 = renderChart 同步返回 + 一帧）：

| 指标 | 预算 | 量级依据 |
| --- | --- | --- |
| LTTB 1e6→1000 | <10ms JS | 实测 5.25ms（bun，本机） |
| normalizeChartSpec 1e5 类目 | <10ms JS | 实测 3.27ms |
| renderChart line 1e4（抽样开） | <100ms JS（happy-dom 口径） | 实测 63.9ms；浏览器 DOM 低于此 |
| 交互帧（游标/图例切换） | <16ms | 类切换 + 单点重绘 |
| 内存 | 视图点数 ≤ 抽样阈值 + 窗口 | LTTB 输出 ≤1000 点 |

基准方法：`bun scripts/bench-charts.mjs`（可重复，口径写在脚本头注释：JS 侧耗时，不含绘制/合成；绘制预算由 e2e 视觉舱与人工 DevTools Performance 抽样验收）。数字为量级参考，随硬件变——评审看量级与回归趋势，不比绝对值。

## 7. 接口草案（🔵 未实现，类型即合同）

```ts
/** XL 级（≥1e6）分层渲染：Canvas raster + SVG 交互层。a11y 层语义不因渲染器切换而退步。 */
interface ChartCanvasRenderer {
  /** 绘制视窗内点云（OffscreenCanvas 可迁移 Worker） */
  paint(view: ChartSpec, window: { from: number; to: number }): void;
  /** 命中测试交给 SVG 交互层（分桶索引），本层只管画 */
  destroy(): void;
}

/** Worker 降采样池：大数据 LTTB 移出主线程；返回 Promise，不阻塞首绘 */
interface ChartSamplingWorker {
  sample(points: readonly { x: number; y: number }[], threshold: number): Promise<readonly number[]>;
  terminate(): void;
}

/** 声音化（可选增强，默认关）：逐点音高映射值域，键盘游标移动时发声 */
interface ChartSonifyOptions {
  enabled: boolean;          // 默认 false；开启需用户动作（音频上下文策略）
  rangeHz?: [number, number]; // 默认 [220, 880]
}
```

落地顺序建议：Worker 降采样 > Canvas 层 > sonification。每一层都必须先过 a11y 回归（摘要/表格/键盘游标不降级）。

## 8. 测试策略

- ✅ DOM 测试 `tests/dom/charts-a11y.test.ts`：摘要内容、describedby 接线、数据表结构、键盘全键位、边界 clamp、update 后游标保持、destroy 解绑。
- ✅ 既有 axe 基线（`tests/e2e/a11y.pw.ts` + a11y-baseline.json）覆盖组件页；本层新增的 sr-only 节点不改变像素（视觉基线无漂移）。
- ✅ LTTB 单元测试（`tests/unit/charts-lttb.test.ts`）。
- 手测矩阵（发布前人工）：NVDA + Chrome（摘要/表格/游标播报）、VoiceOver + Safari（macOS/iOS 各一）、键盘-only 全流程（焦点可见、无键盘陷阱）、200% 缩放与 Windows 高对比（forced-colors 已有滚动条/焦点环兜底）。
- 视觉回归：游标类只在键盘聚焦时出现，默认截图不含；`a11y.table` 的 sr-only 表格不渲染进位图。
