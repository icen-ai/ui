# ICEN UI · Token 架构

> 当前变量契约。事实源是运行时源码，不是历史报告或截图。
> 本文只定义变量所有权、推导、消费与导出；组件迁移状态和场景要求见组件映射表。

## 1. 单一所有权

| 层 | 事实源 | 职责与边界 |
| --- | --- | --- |
| 配色种子 | `src/tokens/themes.json` | 主题明暗色、材料与光影种子；`colors.css` 是生成物，不手改 |
| 内容排版与绝对动效基值 | `typography.css`、`motion.css` | 内容字号尺度、绝对时长/缓动/位移基值；不另建组件反馈别名 |
| 语义变量 | `src/tokens/design.css` | 默认原语的几何、排版角色、表面、反馈、焦点和组件动效别名的唯一权威 |
| 元素基线 | `src/base.css` | 只消费语义变量；提供 reset、组合基元、层级标尺及减少动态的行为压制 |
| 材料适配 | `src/components/material.css` 及同类适配文件 | 将变量组合成 content/chrome/floating 与组件配方；不恢复第二套默认值 |
| 组件 | `src/components/*.css` | 消费 `--icen-*`；组件私有的 `--btn-*`、`--ai-item-*` 等只作局部装配槽 |
| 导出 | `scripts/dtcg.mjs`、`scripts/design-tokens.mjs` | 从 token 源生成设计工具格式；不是运行时第二事实源 |

关键规则：

- `design.css` 拥有 `--icen-control-*`、`--icen-choice-*`、`--icen-option-*`、`--icen-toolbar-*`、`--icen-data-row-*`、`--icen-surface-radius-*`、`--icen-overlay-*`，以及反馈、焦点、禁用和 `--icen-duration/ease/tx-*` 语义别名。
- `base.css` 不得重声明这些值；`material.css` 只做适配；组件不得硬编码另一套颜色、圆角、层级或时长。局部循环动画时长可留在组件局部变量中，但反馈语义仍取共享变量。
- 在 `:root, [data-icen-preset], [data-icen-theme="dark"]` 边界重算表面、焦点和光影，防止已解析值跨主题冻结。在密度边界重算全部依赖角色，防止嵌套密度冻结。
- `style-profiles.css` 是回退层，不是当前默认值的阅读捷径。默认原语与其他原语可以覆盖同一结构角色，但各自字体、材料、光影和视觉身份保持独立。

## 2. 几何角色

### 2.1 控件、选择与行

| 角色 | 当前默认 / 推导 | 消费意图 |
| --- | --- | --- |
| `--icen-control-height-sm/md/lg` | 28 / 32 / 40px，分别引用 density input 高度 | 小型、默认、大型控件；不在组件内做高度加减 |
| `--icen-density-item-height` | 跟随 sm，默认 28px | KB 与其他行内操作的密度节奏 |
| `--icen-control-affix-size` | 24px；粗指针 44px | 清除、密码显隐、chip 移除等命中槽 |
| `--icen-control-affix-icon` | 12px | affix 内图形，不等于命中区 |
| `--icen-control-icon` | 15px | 常规控件图标 |
| `--icen-control-chevron-size` | 12px | 展开/披露图形 |
| `--icen-choice-size` / `--icen-choice-dot-size` | 16 / 8px | checkbox、radio 及选择标记 |
| `--icen-option-height` | 跟随 control sm | 菜单和选项行 |
| `--icen-option-slot` / `--icen-option-check-size` | 18 / 14px | 选项前置对齐槽与末端勾选 |
| `--icen-option-radius` / `--icen-option-font-weight` | `radius-xs` / 400 | 选项轮廓与普通字重 |
| `--icen-toolbar-height(-sm/-lg)` | 由对应 control 高度加 density 间距 | 工具条外框，而非写死窗口栏高度 |
| `--icen-data-row-height` | `max(28px, control-sm + 2 × density-space-2xs)` | 数据行角色的统一入口；声明不等于所有表格已迁移 |

控件内距保持独立角色：按钮 `sm/md/lg = 10/12/16px`；字段常规内距 9px，sm 为 8px；控件间距 6px，紧密间距 4px；边框 1px。

### 2.2 圆角与表面

`R = --icen-design-radius`，默认 8px：

| 角色 | 推导 | 默认值 | 用途 |
| --- | --- | --- | --- |
| `radius-xs` | `max(0, R − 4)` | 4px | 选项、微表面 |
| `radius-sm` | `max(0, R − 2)` | 6px | 常规控件 |
| `radius-md` | `R` | 8px | 大控件、content 表面 |
| `radius-lg` | `R + 4` | 12px | panel 与 floating 表面 |
| `radius-xl` | `R + 8` | 16px | modal 表面 |
| `radius-full` | 常量 | 999px | 胶囊语义件 |

组件角色不是另起一套数值：`control-radius-sm/control-radius = radius-sm`，`control-radius-lg = radius-md`；`surface-radius-content = radius-md`，`surface-radius-panel/floating = radius-lg`，`surface-radius-modal = radius-xl`。分段等嵌套控件从外半径扣除实际 padding 与边框，并为负值兜底 0。

表面层级为 canvas → content → chrome/toolbar/sidebar → floating → modal。`shadow-card/elevated/overlay/control/field/inset` 使用简化、同光源的接触影与环境影；静态内容面默认不投影。默认原语的标准表面不透明且不消费背景模糊，既有 glass 变量仅供其他原语和自有材料配方使用。

### 2.3 排版角色

| 角色 | 当前规则 |
| --- | --- |
| 字号 | `title/section/control/caption` 引用 density 的 `lg/md/md/xs`，默认 15/13/13/12px |
| 字重 | `control/title/label = 500/600/500` |
| 字距 | control 与默认标题均为 0；caption 为 `.01em` |
| 行高 | body 1.55，heading 1.25 |
| 数字 | body 为 `font-variant-numeric: normal`；只有 `.icen-numeric`、表格、指标及明确数据区使用 lining/tabular numerals |

字号不随 compact 缩小；density 只提供各角色的字号尺度。局部旧的负字距或固定标题尺寸属于待迁移组件规则，不改变这里的角色定义。

## 3. 密度公式

令 `H = --icen-design-control-height`（默认 32px），`d = --icen-design-density-offset`：

```text
normal:      d = 0px,   spacing scale = 1
compact:     d = -4px,  spacing scale = .75
comfortable: d = +6px,  spacing scale = 1.25

sm = max(24px, H + d - 4px)
md = H + d
lg = H + d + 8px
item-height = sm
```

| 密度 | sm | md | lg | item-height |
| --- | ---: | ---: | ---: | ---: |
| normal | 28px | 32px | 40px | 28px |
| compact | 24px | 28px | 36px | 24px |
| comfortable | 34px | 38px | 46px | 34px |

间距以 `space = --icen-design-space`（默认 4px）为种子，`2xs/xs/sm/md/lg/xl/2xl/3xl/4xl` 分别乘 `.5/1/2/3/4/6/8/12/16` 与 spacing scale。字号只由 `F = --icen-design-font-size` 推导，不乘 density scale：`2xs/xs = max(12px,F−2)`，`sm = max(12px,F−1)`，`md = F`，`lg = F+2`，`xl = F+6`，`2xl = F+12`。

粗指针下，sm/md/lg 各自对计算结果取 44px 下限，item-height 同样不低于 44px，affix 改为 44px。视觉图形不必放大到 44px；可扩展命中区或保持较小图形外观。

## 4. 稳定槽位

令 `F = --icen-field-padding-inline`（常规 9px）：

```text
trailing-slot = F + chevron(12px) + control-gap(6px)
clear-slot    = trailing-slot + affix(24px | 44px) + control-gap-sm(4px)
```

| 场景 | trailing-slot | clear-slot |
| --- | ---: | ---: |
| 常规指针 | 27px | 55px |
| 粗指针 | 27px | 75px |

- 披露图标位于字段内距指定的末端位置；清除按钮位于披露图标内侧，二者必须同时存在、各有独立命中槽，不得互相隐藏或覆盖。
- 清除能力在装配时确定后，文本/chips 使用相应预留槽；显隐清除按钮只改变操作可见性，不移动外框、披露图标或相邻控件。多选 chips 与 trigger 是同层组合，不嵌套交互元素。
- 默认 `select` 已消费这组变量；其他复合触发器必须逐项迁移，不能以 token 已声明宣称全部对齐。
- 浮层几何与运动分离：menu offset 2px 且不缩放；popover offset 6px、scale `.99`；dialog offset 2px、scale `.985`；sheet offset 12px。入场形变不得参与定位测量或改变占位。

## 5. 反馈、焦点与动效所有权

| 语义 | 当前值 / 规则 |
| --- | --- |
| hover / pressed / selected | 中性 ink 4% / 8% 透明填充；accent 10% 透明填充 |
| 键盘当前项 | 中性当前行反馈与可见焦点；不同于持久 selected |
| 持久选中 | `fill-selected`；需要冗余编码的选项保留末端 check glyph |
| 焦点指示 | `color-mix(accent 78%, surface)`，混合结果为不透明色 |
| 外焦点环 | `0 0 0 2px surface, 0 0 0 4px focus-indicator` |
| 禁用 | `opacity: .48`，不改变几何 |
| 按压 | `press/press-soft: none`；以填充和内影反馈，不改变布局 |
| 动效别名 | `duration-* = motion-duration-* × design-motion`；`ease-*` 引用共享缓动；`tx-*` 是组件消费的组合简写 |
| 减少动态 | 系统 reduce 时 `design-motion = 0`；`data-icen-motion="reduce"` 强制降级，`"full"` 可覆盖系统降级 |

原生 checkbox 保留 `appearance: auto` 与 `accent-color: accent-strong`，维持表单值、mixed 状态和键盘行为；button checkbox 用共享 check mask。forced-colors 下由系统色接管边界和焦点，不以阴影作为唯一状态提示。

## 6. 兼容与导出

### 6.1 运行时兼容

- 保留作者旋钮：`design-radius/space/control-height/font-size/font/motion` 及既有主题材料参数。配色 preset、原语 style、明暗 theme、密度 density 仍是独立轴。
- 亮色通过移除 `data-icen-theme` 表示，暗色为 `data-icen-theme="dark"`；主题与密度属性应位于合适祖先，使 portal 内容继承同一上下文。
- 其他原语继续拥有自己的字体、轮廓、材料和光影配方；共享结构角色不意味着把默认原语的表面物理套给它们。
- `data-icen-transparency="reduced"` 与系统减少透明偏好提供实面降级；forced-colors、RTL、粗指针与减少动态走各自既有路径。
- 新组件优先组合共享基元和变量，不新增平行色板、全局组件魔法值或第二套反馈/焦点/动效别名。token 存在与组件迁移完成是两件事。

### 6.2 DTCG classic

`scripts/dtcg.mjs` 仅实现 DTCG 第二版编辑草案（2022-06-14）的 classic 标量/别名形态：

- 输出每个 preset 的 light/dark 有效级联，环境为默认原语、normal、常规指针。媒体、supports、container 条件被排除，因此不会把粗指针、减少动态、嵌套密度或其他原语覆盖混入基值。
- `control/choice/option/toolbar` 归入同名 dimension 组；`data-row` 归入 `data` dimension；`surface-radius` 归入 `surface` dimension；`overlay` 归入 `overlay` dimension。
- `overlay-popover-scale`、`overlay-dialog-scale` 和 `motion-stagger-count` 覆盖为 number；`option-font-weight` 为 number；`control-focus-border` 为 color；滚动条尺寸/ inset /时长也有各自类型覆盖。font-weight 不会导出成 fontFamily。
- 支持同单位的有限 `calc/min/max/clamp` 算术、变量解析和合法的 px/rem/ms 标量；单位冲突、未知函数、断链与循环引用均失败关闭。
- `var()` 只在目标已导出时生成 `{preset.mode.group.token}` 别名。
- `color-mix()`、多层/inset shadow、`linear()`/`steps()` 等超 classic 表示能力的值，以及无类型映射的变量，明确跳过并记录在 `$extensions['ai.icen.skipped']`。
- `--icen-tx-*` 等复合 transition 简写不作为 dimension/duration 猜导，按不可表示项显式跳过；`clamp()` 内容排版若无法归约为 classic dimension，也同样跳过。

### 6.3 设计工具格式

`scripts/design-tokens.mjs` 只消费 DTCG 产物，不回头发明另一套解析语义：Tokens Studio 保留 token set 与主题映射；Figma Variables 将 color 转 COLOR，dimension/number 转 FLOAT（统一 px 口径，rem ×16），duration/cubicBezier/fontFamily 转 STRING。单模式 token、跨集合或不可解析别名及不可表示值明确跳过并打印，不进入产物。
