# 版本与稳定性政策

唯一的政策文件。分层、0.x 纪律、弃用、主题预算、1.0 门槛、支持周期，全部在这里。
机器执行面：守卫（`bun run guard`）、契约快照（`docs/contracts/`）、CI 联动检查——本文不重复规则明细，只写规则背后的承诺。

## 稳定性分层

全库不是一条稳定曲线。事实源 [`contracts/tiers.json`](contracts/tiers.json)，守卫强制每个 CSS 模块显式归类，构建期盖章进 `registry.json`，文档站徽标同源。

- **Core**：基础组件 + 主题 + i18n + 事件体系。1.0 冻结轨道。
- **Beta**：图表 / AI / 知识库三族。随 minor 快速演进。
- 聚合入口（`kb` / `charts` umbrella）与其族同为 Beta。
- **方向纪律**：Core 禁止运行时依赖 Beta（守卫 `tier-direction` 机械执行；类型级引用须 `guard:allow-beta-type` 登记）。

Beta 用于生产：可以，但锁 minor 版本并盯 CHANGELOG。Beta 晋升 Core 的五条标准：契约快照连续两个 minor 零破坏（机器判）· conformance 套件覆盖 · 文档页完整 · 至少一个真实消费场景 · 无障碍核查。

## 0.x 纪律（收敛期）

当前没有外部用户——可以自由破坏而不欠迁移债，规则据此设定：

1. **破坏性变更只进 minor**；patch 只修 bug。
2. **CHANGELOG 逐条公告**破坏条目（以快照 diff 为准；CI 检查 snapshot 与 CHANGELOG 联动）。Core 破坏置顶、Beta（图表/AI/KB）单列段落——押生产锁 minor 的 Beta 用户要能一眼分拣。
3. **不留兼容层、不写迁移指南**：改名/删除直接做。迁移设计从 1.0 起才成为义务。
4. 快照扩面：`bun run contracts:update` 随 PR 提交。

一句话：0.x 的 minor = 可能痛的升级（明说，但不扶你过去）；1.0 的 major = 我们扶你过去。

## 弃用政策

弃用标记：`@deprecated 用 X 替代（0.12 移除）`（TS JSDoc 与 CSS 头注释同构；全角括号、major.minor 数字，可带 v）。
守卫强制：标记必须带移除版本；移除版本须晚于当前版本至少一个 minor（公告期）；到期必须真的删。
新增 `@deprecated` 必须同 PR 在 CHANGELOG 留痕（CI 联动检查）。
删除发生时快照守卫按破坏性变更接管公告纪律。

## 主题预算

token 是公共 API，改名不报错、只在消费方页面悄悄变样——纪律：

1. `--icen-*` 变量进快照留痕；移除/改名 = Core 破坏性变更。
2. 预设只增不改义（已有六预设的语义 token 不得重定义；测试锁死键集与对比度矩阵）。
   **静默重定义（不改名只换含义/值）视同改名**：须 CHANGELOG 公告并附对比度影响说明——快照不覆盖变量值，这条靠评审执行。
3. 原语只做覆盖、不造孤儿 token（token 引用闭合守卫）。
4. 主题改动必过 verify 全门 + 视觉基线；对比度硬门由 `theme-colors` / `code-contrast` 测试执行——
   **诚实边界**：矩阵覆盖 themes.json 扁平键对与 accentStrong×onAccent；color-mix 派生面（fill-1/fill-2/accent-subtle）
   与「组件边界 ≥3:1」（WCAG 1.4.11）目前无机器门，由 axe e2e 与评审兜底。
5. 设计工具导出（DTCG / Tokens Studio / Figma）与 CSS 同源；`color-mix()` 等不可表示值明示跳过，不猜不近似。

## 1.0 判定（机器可查）

三条同时满足才发 1.0：

1. **Core 面稳定两个 minor**：`bun run contracts:diff v<前两个minor的tag> <当前> --gate core` 通过。
2. **全门常态化全绿**：verify 与 CI 各门连续两个 minor 无跳过、守卫豁免零新增欠账。
3. **文档与实现同步**：文档站 / AGENTS.md / llms-full.txt 与实现逐条对齐。

首个可作 diff 基线的 tag 是 v0.11.0（快照机制在 v0.10.0 tag 之后引入）。
Beta 层不在 1.0 冻结范围内；1.0 同日上线迁移页体系（`/vm/x-to-y`，由 contracts:diff 生成骨架）。

## 版本支持矩阵

| 版本线 | 支持级别 |
| --- | --- |
| 最新 minor | 全部修复（安全 + bug + 功能） |
| 更早版本线（0.x） | 停止支持——0.x 收敛期不留回填机制，升级即跟上 |
| 1.0 起 | 最新 major 全量修；上一 major 仅安全修复，窗口 6 个月 |

## 发布机制

发版 = 改 `package.json` version → 把 CHANGELOG 顶部 `[Unreleased]` 小节改名为 `## [x.y.z] — 日期` → push main → `git tag v<x.y.z> && git push origin v<x.y.z>`。
CI（`.github/workflows/publish.yml`）校验 tag 与版本一致、CHANGELOG 含该版本小节 → 跑全部门 → OIDC trusted publishing 发 npm（provenance，无长期 token）→ 自动建 GitHub Release（notes 取自 CHANGELOG 对应小节）。
