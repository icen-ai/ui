# ICEN UI · Token 架构（本次重构）

> 目标：在不改变六套配色身份、不引入第二套设计系统的前提下，为默认 modern 原语补齐桌面应用所需的几何、表面、层级与状态语义。
> 事实源顺序：`src/tokens/colors.css`（生成，勿手改）→ `style-profiles.css` → `typography.css` → `design.css` → `chinese/soviet/pixel.css` → `src/base.css` → `src/components/*.css`。

---

## 1. 既有架构（复用，不重建）

四轴正交：**配色 preset × 原语 style × 明暗 theme × 密度 density**，全部挂 `<html>` data 属性。

| 层 | 文件 | 职责 |
|---|---|---|
| 作者种子 | `src/tokens/themes.json` → `colors.css` | 12 个基础色 + 语义色 + 材料参数，每套主题明暗完整 |
| 语义映射 | `colors.css` 生成段 | `--icen-token-surface/text/line/fill/accent-*` 等 |
| 原语几何 | `design.css` / `pixel.css` / `chinese.css` / `soviet.css` | 字号、圆角、控制高度、字体、动效、表面物理 |
| 元素基线 | `base.css` | reset、焦点环、滚动条、交互基元 class、z-index 标尺 |
| 材料与组件适配 | `material.css` + `material-chinese.css` + `material-soviet.css` | content/chrome/floating 配方、现代表面物理 |

本次**没有**新增独立的设计系统文件；所有新增 token 均落在 `design.css` 的 modern 原语面，其他原语通过既有覆盖机制保持独立。

---

## 2. 新增 token（全部进 `design.css`，随 tokens.css 分发）

### 2.1 控件几何

| Token | 默认值 | 说明 |
|---|---|---|
| `--icen-control-height-sm/md/lg` | 28 / 34 / 42 | density 高度的语义别名，组件读意图而非算差值 |
| `--icen-control-radius-sm/…/lg` | 3 / 6 / 8 | 复选框、按钮/输入、大控件 |
| `--icen-control-padding-inline-sm/…/lg` | 9 / 12 / 16 | 按钮密度 |
| `--icen-field-padding-inline(-sm)` | 9 / 8 | 输入、选择器、日期触发器的文本内距 |
| `--icen-control-gap(-sm)` | 6 / 4 | 图标与文字、行内槽位 |
| `--icen-control-icon` | 15px | 控件内图标基线尺寸 |
| `--icen-control-border-width` | 1px | 控件描边 |

### 2.2 排版角色

| Token | 值 | 说明 |
|---|---|---|
| `--icen-font-size-title/section/control/caption` | 15 / 13 / 13 / 12 | 语义别名，仍由 density 字号推导 |
| `--icen-font-weight-control/title/label` | 500 / 600 / 500 | 字重角色 |
| `--icen-letter-spacing-control/caption` | -.006em / .01em | 小字号光学修正 |

### 2.3 表面与状态

在 `:root, [data-icen-preset], [data-icen-theme="dark"]` 边界重新计算，避免跨主题冻结：

| Token | 推导 | 用途 |
|---|---|---|
| `--icen-token-surface-chrome` | canvas 46% + surface | 工具栏/导航 |
| `--icen-token-surface-toolbar` | canvas 38% + surface | 顶栏 |
| `--icen-token-surface-sidebar` | canvas 66% + surface | 侧栏 |
| `--icen-token-surface-content` | surface | 内容面 |
| `--icen-token-surface-raised` | raised | 抬起块 |
| `--icen-token-surface-pressed` | ink 8% + surface | 按压面 |
| `--icen-token-surface-selected` | accent-subtle | 选中面 |
| `--icen-token-surface-glass-chrome` | toolbar 88% | 半透明 chrome |
| `--icen-token-fill-hover` | ink 5% | hover 提示 |
| `--icen-token-fill-pressed` | ink 9% | 按压 |
| `--icen-token-fill-selected` | accent 13% | 持久选中 |
| `--icen-token-separator-soft/…/strong` | line-soft/line/line-strong | 分隔层级 |
| `--icen-token-focus-indicator` | accent 62% | 焦点外环 |
| `--icen-token-control-border(-hover)` | ink 19% / 28% | 控件边界 |
| `--icen-token-material-blur-chrome/floating` | 18px / 28px | 模糊半径 |
| `--icen-material-saturate` | 1.4 | 模糊饱和度 |

### 2.4 阴影与材料

| Token | 变化 |
|---|---|
| `--icen-token-shadow-card` | 三层（contact 1px / near 3–8px / ambient 10–24px），负 spread |
| `--icen-token-shadow-elevated` | 三层，更远 ambient（26–52px） |
| `--icen-token-shadow-overlay` | 三层，44–88px ambient |
| `--icen-token-shadow-control` | inset 顶部高光 + 1px contact（新增） |
| `--icen-token-shadow-field` | 1px inset（新增） |
| `--icen-token-material-light/edge` | 由主题的 highlight/edge strength 推导，未改语义 |
| `--icen-token-scrim` | 阴影色 38%（原 32%），modal 聚焦更强 |

### 2.5 动效

| Token | 新值 |
|---|---|
| `--icen-duration-fast/normal/slow` | 110 / 180 / 260ms |
| `--icen-ease-out` | `cubic-bezier(.22,.8,.24,1)` |
| `--icen-ease-in` | `cubic-bezier(.5,0,.8,.2)`（新增） |
| `--icen-ease-in-out` | `cubic-bezier(.45,0,.25,1)`（新增） |
| `--icen-ease-enter` | `cubic-bezier(.16,1,.3,1)`（新增） |
| `--icen-ease-exit` | `cubic-bezier(.4,0,1,1)`（新增） |
| `--icen-press-soft` | `none`（现代不再整体缩放按钮） |

---

## 3. 原语隔离策略

- modern 专属规则统一包在 `:root:where(:not([data-icen-style]),[data-icen-style="modern"])` 或 `:root:where([data-icen-style="modern"])`，不污染其他原语。
- 其他原语已有 token 覆盖（pixel 直角/点阵/阶梯影；chinese 低曲率/宋体标题；soviet 方正/结构线）继续生效。
- 共享的是**结构语义**（高度阶梯、间距、焦点、状态 token），不共享 modern 的表面物理。
- `material.css` 中跨原语的选中/原生 checkbox 共享规则保留；modern 的渐变、hairline、模糊在其后以 modern 作用域补充。

---

## 4. 兼容性

- **零破坏**：所有新增 token 都有 fallback 使用点或仅在 modern 生效；既有 `--icen-design-*` 作者旋钮保留（radius / space / control-height / font-size / motion 仍可覆盖）。
- **radius 联动**：xs/sm/md/lg/xl 仍由 `--icen-design-radius` 推导（-5/-2/0/+4/+10），作者改基准值仍整体缩放。
- **密度联动**：控件高度、间距、字号继续走 density 三族；compact 下 28px，coarse pointer 下 44px 底线不变。
- **主题联动**：表面、边界、阴影全部由当前主题的 ink/surface/shadow/edge/highlight 参数 `color-mix()` 派生，无硬编码色。
- **构建**：`bun run build` 会重新生成 `colors.css`、`tokens.css`、`ui.css`、DTCG；本次新增 token 不需要手改生成产物。
- **预算**：新增声明预计 < 8KB（ui.css/tokens.css 各有 ~12% 余量）；如超预算，按 `docs/contracts/size-budget.json` 评审点调整并记录。

---

## 5. 不新增的东西

- 不新增第二套颜色 token（`--icen-native-*` 之类）。
- 不新增组件私有颜色；组件只消费 `--icen-token-*`。
- 不为单组件写一次性魔法数字；几何走 control token，微构件圆角按守卫登记。
- 不引入 Tailwind / CSS-in-JS / 新依赖。
- 不把设计师的截图数值直接当 CSS px；经浏览器实测后收敛到上面的阶梯。
