# Icen 设计哲学（Design Philosophy）

> 本文件是 icen 设计系统的**美学宪法**：不只规定"值是多少"，更规定"为什么"。
> 工程契约（类名/事件/守卫）在 `AGENTS.md`；本文件回答的是设计判断题——当两个实现都合法时，选哪个。
> 读者：组件作者、消费方设计师、以及要写第七套预设的人。

---

## 0. 元原则（八条，按优先级排序）

1. **诚实呈现**：不装饰不确定，不隐藏不确定。加载有骨架、截断有省略号、权限缺失打码并给申请口——UI 永远如实反映数据与系统状态。
2. **单一事实源**：任何设计决策只有一个权威出处。颜色/圆角/间距/时长/字体全部 token 化；组件不写死任何设计值。
3. **语义先于字面**：组件消费语义 token（`--icen-token-accent`），不消费原始色值。语义层的存在让"换肤"成为改语义映射，而不是改组件。
4. **几何同心**：嵌套圆角共圆心（内圆角 = 外圆角 − 间距）。视觉上的"不对齐"比"没设计"更廉价。
5. **克制动效**：动效是语义（抬升=可及、脉冲=活动、渐隐=去权），不是装饰。所有动画 ≤320ms，`prefers-reduced-motion` 归零，触屏无 hover 漂浮。
6. **密度弹性**：同一组件在紧凑管理台与宽松营销页都成立。密度是连续标尺（`--icen-density-*`），不是两套断点。
7. **无障碍底线是设计的一部分**：AA 对比度是硬约束（accent 明度三档由此而来）、焦点环永可见、状态不只靠颜色传达（图标/文字/形状冗余编码）。
8. **明暗同构**：dark 不是反色，是同一空间换了灯光。同一组件在两态下结构、节奏、层级完全一致，只有"光照"变化。

正交轴：**主题配色 × 原语 × 明暗 × 密度** 四个轴自由组合，任何一轴的切换不应破坏其它轴的决策。现代同时是默认原语与默认主题的名字；另有中式、苏式、像素三套原语。

---

## 1. 色彩

### 1.1 语义纪律
- 语义色只有五个：success 绿 / warning 黄 / error 红 / info 蓝 / accent 品牌色。语义色不表达装饰，只表达含义；装饰用中性层（fill-1/2、line-soft）。
- 中性阶梯是界面骨架：`bg → bg-soft → surface → surface-strong`（明度递进），`text → text-muted → text-faint`（注意力递减），`line-soft → line → line-strong`（分隔强度递进）。三级皆有意图：soft 是"分区"、line 是"边界"、strong 是"结构"。
- 派生色一律 `color-mix()` 从 token 现场推导（`accent-subtle = accent 14%`），不写死第二个色值——单一事实源在色彩上的体现。

### 1.2 accent 明度三档
| 档 | 角色 | 用于 |
|---|---|---|
| `accent` 亮档 | 品牌色 | 图标、边框、数据可视化等纯图形面 |
| `accent-strong` | 承文本填充 | 实心按钮/选中态等「accent 底 + on-accent 字」的面（AA 硬达标） |
| `accent-text` | 浅底文字 | 链接、弱强调文本 |

`--icen-token-on-accent` 是填充上的文字色：浅色模式多为白字深底；深色模式翻转为亮底深字（Material You 夜间惯例）。**承文本填充面禁止消费 accent 亮档**（守卫红线的设计理由：2.96:1 的品牌脸事故）。

### 1.3 业界参照
GitHub Primer 的语义色纪律、Radix Colors 的阶梯尺、Stripe 的"深档承文本"按钮。六套主题共享同一语义骨架；主题改变配色，原语决定几何、材质、排版与动效。

---

## 2. 几何（圆角与线）

### 2.1 圆角六档职责
| 档 | 现代默认值（随 design-radius 联动） | 职责 |
|---|---|---|
| `xs` | 3px | 微型件内角：复选框、菜单项、日期格、小标签 |
| `sm` | 6px | 控件：按钮、输入框、选择器 |
| `md` | 8px | 默认容器：卡片、面板、内嵌块 |
| `lg` | 12px | 浮层与大容器：菜单、popover、modal、工作台 |
| `xl` | 18px | 页面级容器/展示面 |
| `full` | 999px | **胶囊语义专用**（跑道形） |

### 2.2 同心圆法则（Concentric Corners，取法 Apple HIG）
嵌套圆角必须共圆心：**`R_inner = R_outer − gap`**（gap = 两层间距/padding）。

```css
.card { border-radius: var(--icen-radius-lg); padding: 12px; }
.card .thumb { border-radius: calc(var(--icen-radius-lg) - 12px); } /* 同心 */
```

- 同心结果小于 0 时内层**直角**（0），不要出现 1–3px 的"近似圆角差"——那是视觉噪声。
- `calc()` 不保档位时允许，但外层必须 token。
- 守卫强制：禁裸 999px、禁撞档裸值（6/8/10/12/16）、微构件裸值须登记。

### 2.3 胶囊与正圆的区分
- `full`（999px 跑道形）只给**胶囊语义件**：pill / badge / chip / switch 轨道与拇指 / 进度与 slider 轨道 / 分段控件。胶囊的水平拉伸语义是"可延展的容器"。
- `50%` 只给**几何正圆**：avatar、状态点、图标底。正圆的语义是"点"，不是"容器"。
- **容器永不用 full**：跑道形卡片是业余信号。modal/popover/panel/card 走 xs–xl 档。

### 2.4 线的角色
线（hairline）优先于阴影：能用 1px `line-soft` 分区就不用投影分隔。阴影只表达"海拔"（浮起），不表达"边界"。`dashed` 线表达"待定/可投放"（拖放区、占位）。

---

## 3. 深度与海拔

四层模型（从低到高）：`canvas（页面底）→ panel/sidebar（分区）→ card/control（内容件）→ overlay（浮层）`。

- 每个海拔有对应的 surface 色 + 阴影档（`shadow-card → shadow-elevated → shadow-overlay`）+ 可选 glow。
- **dark 模式减影加光**：深色下阴影不可见，海拔靠 surface 明度阶梯 + glow（accent-glow 微光）表达。直接复用浅色阴影是 dark 模式最常见的败笔。
- 浮层才投影。页面内静态件只用线与 surface 差分层。
- 参照：Fluent 的 elevation 分层、Material 3 的 tonal elevation（我们不用 tint 叠层，用明度阶梯+glow）、Linear 的克制。

## 4. 动效

- 三档时长：`tx-fast`（≈120–160ms，微反馈：hover/按压）、`tx-normal`（≈200–240ms，状态切换：展开/切换）、`tx-slow`（≤320ms，入场/大位移）。UI 反馈永不超 320ms——超过即动画，不是反馈。
- 缓动选型：进场 `ease-out`（快入慢停，回应感）、退场略快于进场、循环脉冲用 `ease-in-out`。
- 语义映射：`translateY(-N)` 抬升 = 可交互/可及；`pulse` 脉冲 = 进行中活动；`fade` = 出现/消失；`pop-in` = 新内容到达。
- 红线：`prefers-reduced-motion` 下全部压 0ms；`pointer: coarse` 下关 hover 抬升；`forced-colors` 保留焦点环。
- 参照：Material 的 emphasized easing、Apple 的弹簧哲学（CSS 里以 ease-out 近拟）、业界动效疲劳的教训（Stripe/Linear 的动效时长都极短）。

## 5. 字体排印

- 三族分工：`--icen-font-body`（界面与 prose）/ `--icen-font-mono`（代码、标识、需要等宽的数字）/ `--icen-font-heading`（标题）。现代的 body 与 heading 默认使用系统无衬线；像素原语决定自己的排版。数值对齐优先使用 tabular-nums，无需把所有界面文字改为等宽。
- **CJK 纪律**：小字号中文不走宋体/通用 monospace 回退（糊）；中文正文 ≥12px；数据用 tabular-nums。
- 字号/行高由 density token 出（`--icen-density-font-size-*`），组件不写死字号。
- 行长纪律：prose 60–75 字符；表单标签与控件同行（水平表单）或顶置（纵向表单）二选一不混用。
- 参照：IBM Plex 的"工程感人文"、Apple SF 的中性、iA 的行长研究。

## 6. 密度

- 密度是连续标尺不是断点：`--icen-density-space-*` / `--icen-density-font-size-*` / `--icen-density-input-height-*` 三族联动。
- 档位语义：`compact`（管理台/数据密集型）/ `normal`（默认）/ AI 族另有 `summary`（压淡次要信息，纯 CSS 实现）。
- compact 是"信息密度"，不是"缩小"——触控底线 40px 在任何档都不破（触屏守卫）。
- 参照：Carbon 的 density 系统、Salesforce 的 compact 变体。

## 7. 图标

- 线性图标族：`viewBox="0 0 24 24"`、stroke currentColor、stroke-width 2（通用）/ 1.5（kb 族细线）、圆头线帽。
- **尺寸契约**：图标 svg 必须自带 `width/height` 属性或有 CSS 类尺寸约束——无尺寸 svg 在 CSS 失效时会失控（默认 300×150）。这是血泪条款。
- `xmlns` 必备（DOMParser XML 严格解析的空命名空间陷阱——svg-parse 单点已兜底，作者仍应写全）。
- 图标不携带文字意义（旁边必有文本或 aria-label）；状态图标用语义色。

## 8. 材质与预设哲学（六套预设的人格）

| 预设 | 材质隐喻 | 气质 | 关键决策 |
|---|---|---|---|
| **modern** 现代 | 瓷面 × 柔光 | 清透、精确、安静 | 中性瓷白、冷蓝动作、冷调石墨夜间；独立校准 |
| **dongyun** 东韵 | 绢本 × 青瓷 × 沉墨 | 温润、疏朗、克制 | 宣纸暖白与低饱和青瓷，细边界和轻微纸面层次 |
| **jugou** 巨构 | 混凝土 × 搪瓷 × 氧化铁 | 坚实、纪念性、结构感 | 石灰白与炭黑承重，深朱红只标记关键动作 |
| **piano** 钢琴 | 象牙琴键 × 乌木 × 大漆 | 精致、对比、仪式感 | 高对比黑白骨架、金棕点缀（金底乌木字是 AA 设计）、漆面冷反光 glow |
| **monet** 莫奈 | 睡莲 × 水面柔光 | 静谧、通透、含蓄 | 蓝绿水面的柔光层叠，紫调只作含蓄点缀；取自莫奈《睡莲》 |
| **vangogh** 梵高 | 麦田 × 星空 × 杏花 | 浓烈、厚涂、浪漫 | 高饱和黄蓝对撞；粉底深字（杏花气质）——亮色承深字而非白字 |

每套预设都必须是**完整 token 面**（12 base + glow + derived + semantic + fill + shadow + outline + depth + scrollbar），不是改六个色——换预设 = 换材质，不是换滤镜。新增预设的完整清单见 `colors.css` 头注释与本文件 §11。

## 9. 原语（与配色主题独立）

- **现代 modern**（默认）：连续几何、系统排版、轻盈材料、双层柔影。
- **中式 chinese**：低曲率轮廓、宋体展示字、舒展行距、纤细边线与浅淡纸面投影；小字号和密集信息仍用无衬线。
- **苏式 soviet**：方正体块、凝练展示字、清楚结构线、定向投影与短促反馈；力量来自比例而非装饰符号。
- **像素 pixel**：整数网格、中英文点阵、实色材料、直角与阶梯投影、机械按压。
- 现代同时是一套独立的瓷白＋冷蓝主题。六个主题均可与四套原语组合。
- 最新架构、种子与配方以 `design-primitives.md` 为准。

## 10. 业界对标矩阵（我们取法谁，以及不抄什么）

| 维度 | 取法 | 不抄 |
|---|---|---|
| 圆角同心 | Apple HIG concentric corners | iOS 超大圆角泛滥（圆角过敏） |
| 语义色 | GitHub Primer | Material 的 60+ 语义角色（学习成本爆炸） |
| 明度阶梯 | Radix Colors 12 步 | 不强制 12 步——三级有意图的阶梯够用 |
| 海拔分层 | Fluent / Material tonal | Material 3 的 tonal overlay tint（污染品牌色） |
| 动效 | Material emphasized + Linear 克制 | 弹簧物理库的过度弹性（UI 不是玩具） |
| 密度 | Carbon / Salesforce | Salesforce 的三档断点跳跃（我们要连续标尺） |
| 暗色 | Apple Dark Mode 重打光 | 简单反相/降亮度 |
| 主题架构 | Radix Themes / shadcn token 面 | CSS-in-JS 运行时主题（性能与闪烁） |
| 无障碍 | Shopify Polaris 的"内建而非选配" | 事后补钉式 a11y |

## 11. 统一覆盖架构（消费方怎么改我们）

三层覆盖面，从轻到重：

**① 旋钮面（改几个变量）**——90% 定制只需动少数旋钮：

```css
/* 你的样式表（无层，恒赢库的三层 @layer） */
:root {
  --icen-token-accent: #5b6ee1;          /* 品牌色换档（strong/text 建议同步） */
  --icen-token-accent-strong: #4353c8;
  --icen-token-accent-text:  #3a49b8;
  --icen-radius-md: 6px;                 /* 全局圆角基准降一档 */
}
```

高频旋钮清单：`accent 三档` / `radius 六档` / `--icen-density-*` 三族 / 字体三族 / `tx-*` 动效三档 / `--icen-token-text-muted|faint`。文档站「定制」页的主题工作台可在线调这些旋钮并生成这段 CSS。

**② 预设作者面（写新一套）**：在 `themes.json` 新增完整明暗色板与材料参数，运行 `bun run colors`；运行时、站点与导出自动同步。要求：明暗双面完整、accent 三档实测 AA、语义五色齐备、depth 阶梯完整。

**③ 正交组合面**：`<html data-icen-preset="dongyun" data-icen-theme="dark" data-icen-style="chinese">` + 容器级 `data-icen-density="compact"`——四轴自由组合。

兜底纪律：`@layer icen.tokens/base/components` 保证消费方无层样式恒赢；Tokens Studio / Figma Variables 导出（`bun run design-tokens`）让设计稿与代码同值。

## 12. 红线（违反 = 守卫/评审必打回）

1. 组件写死颜色/圆角/间距/字号/时长（绕过 token）。
2. 承文本填充面消费 `accent` 亮档（必须 `accent-strong`）。
3. 容器用 `full` 跑道形圆角；正圆用 999px（应 50%）或反之。
4. 嵌套圆角不共圆心且无豁免注释。
5. 动效超 320ms / 无 reduced-motion 归零 / 触屏 hover 漂浮。
6. 图标 svg 无尺寸契约、缺 xmlns。
7. dark 模式直接复用浅色阴影（不打光改明度阶梯）。
8. 语义五色之外发明第六种"语义色"。
9. 状态只靠颜色传达（无图标/文字/形状冗余）。
10. 截断不声明（裸 nowrap 无省略号是文本 bleed 事故的同义词）。
