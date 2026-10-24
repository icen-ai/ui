# ICEN UI · 全量设计精进进度

> 当前分支：`pref/design`。本文件记录 2026-10-25 开始的新一轮重构；此前报告中的 complete 不再作为本轮完成依据。
> 机器状态：`docs/redesign/progress.json`，由 `node scripts/redesign-progress.mjs` 从真实 Registry 和已构建文档目录校验。

## 当前结论

本轮处于 **foundation 实施中**。122 个可安装 slug 与 129 个文档入口已经重新盘点并保留参考映射，但组件的行为、真实场景和视觉状态仍需逐项验收；没有任何组件因旧报告或 token 继承而自动视为完成。

### 新验收口径

每个 slug 必须依次经过：

1. `audited`：DOM、CSS、行为、参考语义、场景和组合关系已盘点。
2. `implementing`：正在修改，不能作为完成证据。
3. `behavior-verified`：适用的 API、异步、键盘、焦点、销毁和边界状态有真实测试。
4. `visually-verified`：目标产物截图经过人工复核，而不只是成功生成。
5. `complete`：场景文档、工程测试、视觉复核和进度证据全部齐全。

合并 CSS 文件不等于合并验收。AI、KB、图表和 content/media/menu/feedback 的每个 slug 单独记录。

## 基线

| 项目 | 未修改代码的结果 |
| --- | --- |
| 分支 | `pref/design` 已同步远端并 fast-forward 到 main 最新 `d4089d6`，保留 main 的 motion、图表 a11y、排版与生命周期修复 |
| `bun run verify` | 通过：typecheck、guard、1052 tests、build、size |
| 文档站 | 通过：138 pages；记录一个既有 `site-i18n.ts` 重复键警告，后续清理 |
| 视觉回归 | 19/19，Windows Chromium，未改变现有容差 |
| Registry 巡检 | 214/214 首屏与代表矩阵，无脚本错误或页面横向溢出；`.ui-audit/pref-design/baseline/manifest.json` |
| 人工浏览器检查 | 已查看按钮、AI 输入台、KB 检索、知识库工作台、首页；不以自动截图替代审美判断 |

基线只证明原实现可构建、既有测试可通过。它不证明组件 API 足够组合、所有场景正确或视觉已经精致。

## 本轮已确认的问题

- `design.css`、`base.css`、`material.css` 对焦点、禁用和排版有竞争定义；默认 surface 与交互状态受层叠顺序影响。
- Select 的尺寸变体覆盖 trailing slot 预留；toggle 的现代适配选择器错误；原生与按钮 checkbox 使用不同选中语言。
- 控制器、异步状态和 slot 能力不一致；浮层 ownership 与 modal focus、局部 portal 上下文需要统一。
- KB 的引用空集合可回退到上一个答案的来源；受限原文可进入 DOM 后仅靠模糊遮盖。证据边界优先于视觉修改。
- AI 的 model/tool transport、流式更新、稳定 item DOM、用量语义和窄容器布局存在结构性缺口。
- 文档 Inspector 是只读信息；多个 KB 动作不改变模型，AI 示例存在自动批准；示例没有完整表达用户需求和失败后的下一步。
- 首页首屏计数动画会经过无意义中间值；应用页把四个窗口纵向堆叠，无法聚焦完整任务。

## 执行批次

| 批次 | 范围 | 当前状态 | 提交/验证 |
| --- | --- | --- | --- |
| R0 | 同步、审计、映射、工程与视觉基线 | complete | 上表基线；本文件与 progress schema 2 |
| R1 | Token 权威、基础几何、choice/option/stable slots | complete | verify 1060；site 138；专项 27；视觉 19；巡检 214 |
| R2 | Core 控制器、slot、overlay lease、异步与包装层 | pending | 待组合场景测试 |
| R3 | KB 证据、ACL、检索、编辑与权限工作流 | pending | 安全回归优先 |
| R4 | AI operation/conversation/tool loop/stable renderer | pending | 流式、乱序、焦点与窄容器 |
| R5 | 表格、图表、导航、内容、媒体与反馈 | pending | 逐 slug，而非按 CSS 文件盖章 |
| R6 | 全组件场景文档、首页、apps 与 KB 工作台 | pending | 真实 store 与完整任务 |
| R7 | 全量验证、视觉修正、治理和最终交付 | pending | verify / coverage / pkg / site / Playwright / 人工截图 |

### R1 完成证据

- 默认 modern 使用 28/32/40px 控件和 4/6/8/12/16px 语义轮廓；compact、comfortable、嵌套密度与 44px 触屏目标由同一公式推导。
- `design.css` 统一焦点、禁用、状态、表面和动效；`base.css` 不再恢复竞争默认值。新增 control/choice/option/toolbar/data-row/surface/overlay 角色，DTCG 与设计工具导出同步。
- Select 的 clear/chevron 分离且同时可用；Toggle 使用真实类名；菜单与 Select 区分键盘当前项和持久选中；原生 checkbox 保留勾选和 mixed 语义。
- Menu、Popover、Dialog、Sheet 使用各自运动语义；普通按压不改变布局。新增安全 `mountIcenSlot` 与可取消 `createOperation`，8 项专项行为测试通过。
- `bun run verify`：1060 pass / 0 fail，构建和 size 通过；文档站 138 pages；设计工具测试 12/12；基础专项浏览器 27/27；既有视觉基线 19/19；Registry 巡检 214/214。
- 证据：`.ui-audit/pref-design/foundation/manifest.json`、`tests/e2e/foundation-polish.pw.ts`、`tests/e2e/__screenshots__/visual.pw.ts/chromium/`。实际查看按钮、输入、Select、Switch、菜单及像素原语，修正 Select 隐藏 chevron 和输入示例旧文案。

## 剩余任务

R2–R7 尚未完成。基础几何和共享原语完成不等于每个组件的 API、场景和视觉状态已经完成；组件仍按各自证据推进。每批继续记录实际变更、测试命令、截图路径、关键决策和剩余问题。
