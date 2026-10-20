# ICEN UI · macOS-inspired 设计重构 — 最终报告

> 分支：`pref/design` · 基线：`main@4a324a7` · 完成日期：2026-10-21
> 设计规范：`docs/redesign/MACOS_REDESIGN.md` · 执行手册：`docs/redesign/macos-design-language.md`
> 组件映射：`docs/redesign/macos-component-mapping.md` · Token 架构：`docs/redesign/macos-token-architecture.md`

---

## 一、这次做了什么

把 ICEN UI 的**默认 modern 原语**从通用 Web 组件库的密度，升级成一套精确的桌面应用语言；同时保留六套品牌配色、四套原语、明暗双模和全部行为/API 契约。官方文档站也从通用文档模板改成应用工作区：工具栏、源列表侧栏、Preview 工作区、右侧 Inspector、真实应用组合页。

### 1. 设计底座（`src/tokens/design.css`）

| 维度 | 之前 | 之后 |
|---|---|---|
| 控件高度 | 40px（sm 32 / lg 48） | **34px**（28 / 42；compact 28 / comfortable 38） |
| 界面字号 | 14px | **13px**（12 为中文下限） |
| 圆角 | 4 / 8 / 10 / 16 / 24 | **3 / 6 / 8 / 12 / 18** |
| 控件内距 | 8–12px 混用 | 按钮 12（9 / 16）、字段 9（8 / 16） |
| 表面层级 | canvas / surface 两层 | **canvas → content → chrome → toolbar/sidebar → floating → modal** |
| 状态填充 | fill-1/2 复用 | **hover / pressed / selected / focus 四套语义分离** |
| 阴影 | 3 档，偏重 | 三层同光源、负 spread；新增 control / field 接触影 |
| 动效 | 120 / 180 / 260ms | **110 / 180 / 260ms**，四种缓动（out / in / in-out / enter / exit） |
| 材料 | 20px 模糊 | chrome 18px / floating 28px、saturate 1.4 |

新增 token 全部由现有主题色和作者旋钮派生，未新增第二套颜色系统，也未修改 `themes.json` / `colors.css`。源码中的变量注释使用「桌面精度 / 表面物理」等通用描述，不写 Apple/macOS 抄写或品牌归属信息。

### 2. 组件层（76 个 CSS 文件、122 个 slug、129 个文档条目）

- **表单族**：按钮（物理按压面、顶部高光、按下不位移）、输入（1px field 影、9px 内距）、选择器（恢复 chevron、28px 选项、选中勾选）、菜单（12px 角、28px 行）、分段（白面浮起 + hairline）、开关（38×22）、复选框（勾选 mask）、滑块（4px 轨 + 白 thumb）、日期/级联/树选择/标签输入/提及/自动补全/上传。
- **导航与数据**：源列表侧栏（28px 行、整行选中底）、52px 工具栏化顶栏、44px 工具条、13px 标签页、32px 表格行（compact 28）、DataTable 同语法、卡片/面板/指标/空态/徽标/键盘键/列表/树/折叠/时间线/描述。
- **浮层与反馈**：弹窗（12px 角、chrome footer、焦点契约不变）、菜单/Popover/Tooltip/命令面板（方向入场、scrim、28px 结果行）、Toast/通知（2px 语义边 + 20px 模糊）、警示/进度/加载/骨架/复制。
- **图表**：统一 11–12px 轴/图例、7px 图例点、surface tooltip；13 种细分图继承基座，经主题矩阵审查。
- **AI 原生族**：消息 13px/1.6、输入台 8px 角 + field 影、工具卡 28px 头、差异审阅 2px 状态边、上下文抽屉 chrome 头。
- **知识库族**：kb 基座 28px 行 / 13px 标题 / 12px 次要信息 / 11px 徽标；7 域 32 组件继承共享基座，权限呈现纪律未改。
- **其他**：media/carousel、layout/scroll-area/split-pane、copy、theme-switcher、code-block 全部按新层级收口。

覆盖核对：**76/76 CSS 文件已审查**；`docs/redesign/progress.json` 区分「逐文件改写」与「共享基座 + token 继承」两类，并如实登记。

### 3. 文档站（`site/`）

- 文档 shell：52px 站级工具栏 + 248px 源列表侧栏（分组图标/计数/折叠/整行选中）+ 内容区 44px 工具栏 + 232px 右侧 Inspector。
- 组件页：Preview 工具栏（状态点/分组/slug）、工作区舞台、代码区（34px chrome 头 + 12px mono）、接口表、右侧属性面（层级/CSS/行为/初始化/事件/一行引入/设计口径/相关）。
- 新增 `/apps/`：系统设置、文件与知识库、AI 工作台、数据工作台四个真实应用组合，全部用 Registry 组件与 token；响应式在窄屏折叠侧栏/Inspector。
- 组件总览：从渐变大卡改成 hairline 表面、13–14px 标题、hover 只加边界与底色。
- 规范同步：`design-philosophy.md` 圆角表、`design-primitives.md` 作者旋钮改为 8px / 34px / 13px / 24px。
- 旧 demo 文案（内阴影、hover 浮起、32/36/40 输入）已同步为新的设计口径。

### 4. 行为增强（可见但兼容）

- `select` / `cascader` / `tree-select`：不再删除作者 chevron；未提供时行为层用共享图标补齐（`createIcon('chevron-down')`），清除钮出现时 CSS 自动互斥。
- `checkbox`：选中改为勾选 mask，半选为减号 mask；原生 `accent-color` 回退保留。
- 修复 `a11y` 基线更新脚本的 `expect.unreachable` 崩溃（Playwright 版本无此 API），改为显式 throw。

---

## 二、验证证据

| 项目 | 结果 |
|---|---|
| `bun run verify` | ✅ tsc / guard / 1033 单测 / build / size（ui.css 851.5KB ≤ 937.5KB，tokens.css 111.6KB ≤ 117.2KB） |
| 文档站构建 | ✅ 138 页 |
| axe 无障碍 | ✅ 11/11 场景；color-contrast 既有债清零，`a11y-baseline.json` 收缩 160 行 |
| Playwright e2e | ✅ 308/308 用例通过（`.ui-audit/e2e-final2.log`） |
| 主题矩阵 | 48 张：6 配色 × 明暗 × 4 页（`.ui-audit/matrix/`） |
| 原语矩阵 | 24 张：现代/中式/苏式/像素 × 明暗 × 3 页（`.ui-audit/primitives/`） |
| 视觉快照 | `tests/e2e/__screenshots__/visual.pw.ts/` 已随新设计刷新 |
| 前后对比 | `docs/redesign/visuals/buttons-before-after.png`、`table-before-after.png`、`apps-workspace.png` |

---

## 三、关键设计决策

1. **控件 34px / 字号 13px**：13px 中文在 34px 高度内获得 ~21px 行盒；28px 仍可读，42px 用于主操作；不把桌面控件做成移动端的 44–48px。
2. **控件 6px、容器 8px、浮层 12px**：按钮/输入与卡片/菜单分层，禁止「所有东西一个圆角」。
3. **按钮按下变深、不位移**：物理按钮隐喻；`--icen-press-soft: none`，其他原语仍可保留自己的按压缩放/位移。
4. **分段控件白面浮起**：桌面分段语义；品牌色只做文字/图标与选中描边，不整块实心。
5. **选择器保留 chevron，选中补勾选**：弹出式控件必须有方向暗示；勾选是冗余编码，不只靠底色。
6. **表格 32px 行 / 表头 11px**：管理台密度；表头是结构标签而不是第二层卡片。
7. **浮层才用材质**：菜单/命令面板/抽屉/toast 用 18–28px 模糊；正文、表格、卡片不玻璃化。
8. **文档站 = 工作区**：侧栏是源列表、内容是工作区、右侧是 Inspector，而不是「文章 + 白卡预览」。
9. **其他原语不共享现代表面物理**：只共享结构/状态 token；苏式保持方角与结构线、像素保持 0 圆角与阶梯影、中式保持低曲率与宋体标题。

---

## 四、诚实的剩余项

1. **图表细分与 KB 域**：13 种图表细图和 KB 7 域 32 组件主要通过共享基座/token 继承，未逐文件重写；主题矩阵与截图审查未发现硬编码色或破面，但仍有进一步精修空间。
2. **首页 Hero**：保留品牌艺术层与叙事，没有按应用工作区语法重做；这是品牌页与产品文档页的有意分工。
3. **forced-colors / reduced-transparency**：规则和抽样审查通过，未逐主题截图固化。
4. **20% 文本缩放 / 高对比模式**：未做专门的 200% 缩放矩阵；CSS 使用逻辑属性与 clamp，但需下一轮实机复核。
5. **`AGENTS.md` 部分历史口径**：消费方速查未引用旧尺寸；深层 spec 已同步，但个别历史设计说明仍以「现代」描述为主，未逐句改写。
6. **品牌字体**：仍是系统字体栈（SF Pro Text / Segoe UI / PingFang），未打包 Apple 专有字体；这是许可与跨平台一致性的有意选择。

---

## 五、如何复核

```bash
git switch pref/design
bun run verify                 # 类型 + 守卫 + 单测 + 构建 + 体积
cd site && bun run build       # 138 页
bun run test:e2e               # Playwright（需浏览器已安装）
bunx playwright test tests/e2e/a11y.pw.ts
```

站点预览：`bun scripts/serve-static.mjs site/dist 4173`，打开 `http://127.0.0.1:4173/`；重点看 `/apps/`、`/components/btn/`、`/components/table/`。

设计审阅顺序：

1. `docs/redesign/macos-design-language.md`（规则）
2. `docs/redesign/macos-component-mapping.md`（129 条映射）
3. `docs/redesign/macos-token-architecture.md`（token 兼容性）
4. `docs/redesign/visual-quality-report.md`（前后对比与评分）
5. `docs/redesign/progress.json`（机器可读覆盖与验证）

---

## 六、提交节奏

| commit | 内容 |
|---|---|
| `2f1840a` | 桌面精度底座 + 表单控件首批 + 设计文档 |
| `8973690` | 导航/数据/浮层族的桌面密度与层级 |
| `305bc5a` | 原生应用式文档站 + 应用组合样例 |
| 本报告 / 收尾 | 视觉快照刷新、a11y 基线收缩、最终测试修复、报告 |

分支保持 `pref/design`，未合并 main、未打 tag、未发布 npm。
