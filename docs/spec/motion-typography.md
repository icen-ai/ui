# 动效令牌与排版尺度（spec）

面向实现者与评审。令牌定义在 `src/tokens/motion.css` 与 `src/tokens/typography.css`；运行时口径在 `src/behaviors/motion.ts`；DTCG 导出经 `scripts/dtcg.mjs`（`dist/tokens/dtcg.json`）。组件只消费令牌与语义别名，不写死时长、曲线、字号。

## 1. 动效令牌

### 1.1 时长阶梯

| 令牌 | 值 | 场景 | 反例 |
| --- | --- | --- | --- |
| `--icen-motion-duration-instant` | 0ms | 像素原语全量；状态复位 | 用它"省掉"必要的过渡反馈 |
| `--icen-motion-duration-fast` | 110ms | hover / press / 焦点环微反馈 | 浮层进出场（太短促） |
| `--icen-motion-duration-base` | 180ms | 展开收起、淡入淡出、勾选 | 页面级转场 |
| `--icen-motion-duration-slow` | 260ms | 浮层进出、modal、面板滑入 | 高频 hover 反馈（拖沓） |
| `--icen-motion-duration-deliberate` | 420ms | 页面级转场、强调入场 | 常规控件（必须克制，>420ms 需评审） |

消费口径：组件读语义别名 `--icen-duration-fast/normal/slow/deliberate`（design.css 映射 = 基值 × `--icen-design-motion`）；`instant` 同样有别名。新组件可直接读 `--icen-motion-duration-*` 基值（不缩放，用于设计工具对齐场景）。

### 1.2 缓动集

| 令牌 | 值 | 场景 | 反例 |
| --- | --- | --- | --- |
| `--icen-motion-ease-standard` | cubic-bezier(.45,0,.25,1) | 持续类状态变化（颜色、宽度） | 入场（缺加速初速感） |
| `--icen-motion-ease-enter` | cubic-bezier(.16,1,.3,1) | 入场：快出慢归 | 离场（会显犹豫） |
| `--icen-motion-ease-exit` | cubic-bezier(.4,0,1,1) | 离场：快进加速 | 入场（像被弹开） |
| `--icen-motion-ease-emphasized` | cubic-bezier(.22,.8,.24,1) | 强调：长减速弧（hero、落板） | 高频微交互 |
| `--icen-motion-ease-spring` | linear() 阻尼弹簧近似（过冲 ≈8%）；不支持 linear() 的浏览器回退 emphasized | 抽屉、卡片回弹 | 表单控件状态变化（过冲多余） |

回退声明在 `motion.css` 的 `@supports (transition-timing-function: linear(0,1))` 块——可降级增强，不 polyfill。`linear()` / `steps()` 超出 DTCG 经典版标量，导出时明示跳过（`dtcg.json` 的 `ai.icen.skipped`）。

### 1.3 幅度与编排

| 令牌 | 值 | 场景 | 反例 |
| --- | --- | --- | --- |
| `--icen-motion-shift-sm` | 2px | 行内微移（列表项 hover） | 弹层入场（幅度不足） |
| `--icen-motion-shift-md` | 6px | 浮层/气泡入场位移 | 抽屉 |
| `--icen-motion-shift-lg` | 12px | 抽屉/面板入场位移 | 行内微移（晃眼） |
| `--icen-motion-scale-enter` | .96 | 弹层入场起始缩放 | 大于 .96 的夸张缩放入场 |
| `--icen-motion-scale-press` | .985 | 按下形变 | 持续缩放循环 |
| `--icen-motion-stagger-step` | 24ms | 列表/卡片瀑布入场相邻延迟 | 超过 40ms 的排队（显卡顿） |
| `--icen-motion-stagger-count` | 5 | 级联上限，超出同拍 | 全列表逐项延迟（长尾等待） |

### 1.4 与预设、原语的联动

- 配色预设（themes.json 六套）不动效：动效与色彩正交。
- 原语：pixel 原语把 `--icen-motion-ease-*` 全部改写为 `steps(1, end)`，且 `--icen-design-motion: 0` 使时长归零（点阵逐帧美学）；chinese / soviet 沿用现代动效曲线，仅在其自有块覆盖排版与几何。
- 明暗：不动效。

## 2. reduced-motion 策略

降级链（实现于 `base.css`，运行时口径 `behaviors/motion.ts`）：

1. **默认遵循系统**：`@media (prefers-reduced-motion: reduce)` 时 `--icen-design-motion: 0` → 全部 `--icen-duration-*` 过渡瞬时完成；循环/环境动画（spinner、skeleton、脉冲）单次瞬时；平滑滚动关闭。（Chromium 实测：reduce 下 0s 被钳制为 0.01ms 序列化，语义等同瞬时，保证 transitionend 派发。）
2. **手动覆盖**：`<html data-icen-motion="reduce">` 无需系统设置即可降级；`"full"` 在系统降级时显式恢复（演示机、用户显式选择）。属性优先级高于系统偏好。
3. **降级而非移除**：状态变化仍然可见，只是瞬时完成；一次性的状态表达保留。组件编写约定：入场动画应同时含 opacity 与 transform——顺畅时是"移动+淡入"，降级时是瞬时呈现，不会出现"什么都没发生"。
4. **JS 同口径**：`icenMotionReduced()` 读取与 CSS 相同的判定（属性 > 系统）；`onIcenMotionChange(cb)` 统一订阅 matchMedia 与属性改写，返回销毁函数；`setIcenMotion(mode|null)` 写覆盖。JS 驱动的视差、autoplay、canvas 循环必须走此口径停止运动、保留状态。

反模式（守卫/评审拦截）：组件内写死 `transition-duration` 毫秒值；用 `!important` 自创降级块；JS 动画只读 matchMedia 不看手动覆盖。

## 3. 排版尺度

### 3.1 内容排版尺度（typography.css）

模块比例 1.250（大三度），`clamp()` 流体插值；面向内容/文档排版。控件字号仍由 `--icen-density-font-size-*` 驱动——**两套尺度解耦：密度档只压缩控件，不挤压阅读**。

| 令牌 | 区间（min→max） | 场景 |
| --- | --- | --- |
| `--icen-type-xs` | 11→12px | 角标、时间戳 |
| `--icen-type-sm` | 12.5→14.4px | 辅助说明、表注 |
| `--icen-type-md` | 14→16px | 正文基准 |
| `--icen-type-lg` | 16→20px | 小节标题、导语 |
| `--icen-type-xl` | 20→25px | 页标题 |
| `--icen-type-2xl` | 25→31.25px | 区块主标 |
| `--icen-type-3xl` | 31.25→39px | hero（克制使用） |

行高：`--icen-leading-tight` 1.3（大标题）/ `-base` 1.6（正文，CJK 混排安全下限）/ `-loose` 1.8（长文）。字距：`--icen-tracking-tight` -.02em（大号拉丁标题）/ `-base` 0 / `-wide` .04em（眉标）。字重：`--icen-weight-regular/medium/semibold/bold` = 400/500/600/700。

### 3.2 CJK 与拉丁混排

- 字体栈：`--icen-font-cjk` 默认跟随标题字体，栈内含 PingFang SC / Hiragino Sans GB / Microsoft YaHei（design.css）；像素原语整体替换为点阵字体。
- 标点挤压：`text-spacing-trim: trim-start` 渐进增强（Chrome 123+，`@supports` 守卫；不支持即浏览器默认，不 polyfill）。
- 数字：数据密集区用 `font-variant-numeric: lining-nums tabular-nums`（`.icen-numeric` / `.icen-font-math` 已消费；新增 `--icen-feature-data` 令牌供新组件）。
- CJK 字距一律 0（`--icen-tracking-tight` 仅拉丁大标题；不对 CJK 正文加字距）。

### 3.3 紧凑密度

`data-icen-density="compact|comfortable"` 只作用于 `--icen-density-*`（控件高度/间距/控件字号，style-profiles.css），不影响 `--icen-type-*` 内容尺度。数据密集界面应开密度档而不是缩小正文字号。

## 4. DTCG 导出

`bun run dtcg` 导出时长（duration）、缓动（cubicBezier）、位移（dimension）、缩放/行高/字重/级联数（number）各族；clamp()、`linear()`、`steps()`、font-feature-settings 字符串超出经典版标量，逐条记录在 `ai.icen.skipped` 并注明原因——不猜不静默。

## 5. 文档页信息结构（tokens 页扩展建议）

1. 动效族：时长阶梯演示条（同曲线五档并排播放）→ 缓动曲线卡（SVG 曲线 + 用途/反例）→ 幅度尺（shift/scale 对照）→ stagger 演示列表。
2. 降级演示：开关 `data-icen-motion="reduce|full|系统"`（调 `setIcenMotion`），同一块动画区实时对照。
3. 排版族：尺度阶梯表（实际渲染字号 + 区间）→ 行高/字距对照 → CJK 混排样张 → 密度档对照（控件 vs 内容）。
4. 每令牌一行：名称 / 值 / 一句话场景 / 反例（与本 spec 表格同源）。

## 验收

- `bun run guard` 全绿（token 引用、meta、契约快照含新增变量与 motion.ts 导出）。
- `bun test tests/unit/motion.test.ts` 5/5：覆盖优先级、订阅销毁、非法值回退。
- `bun scripts/dtcg.mjs` 导出 motion-duration/motion-ease 等族，linear()/clamp() 记入 skipped。
- reduced-motion e2e：系统 reduce 下 `--icen-duration-fast` 计算值 0ms；`data-icen-motion="full"` 恢复 110ms；手动 reduce 无需系统设置。
