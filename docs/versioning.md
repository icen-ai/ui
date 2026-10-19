# 版本纪律与发布政策

本文回答三个问题：**0.x 期间破坏性变更怎么管**、**什么时候发 1.0**、**每个版本线支持多久**。写在这里就是为了让你可以在评审与采购环节直接引用。

## 稳定性分层（先读这个）

全库不是一条稳定曲线。组件按 [docs/contracts/stability-tiers.md](./contracts/stability-tiers.md) 分两层，事实源 `docs/contracts/tiers.json`，守卫强制每个 CSS 模块显式归类：

- **Core（52 模块）**：基础组件 + 主题 + i18n + 事件体系。1.0 冻结轨道。
- **Beta（24 模块）**：图表 / AI / 知识库三族。随 minor 快速演进，公告但不受 Core 纪律约束。

文档站每个组件页的徽标（Core · 稳定 / Beta · 演进中）即此分层。

## 0.x 纪律（当前阶段：收敛期，无外部用户）

0.x 不代表随意，但**当前没有外部用户**——这是收敛期最大的资产：可以自由破坏而不欠任何人迁移债。规则据此设定：

1. **破坏性变更只在 minor 发生**：patch 只修 bug，永不改公共契约。
2. **CHANGELOG 逐条写明**改了什么（契约面变化以 [contracts 快照](./contracts/snapshot.json) diff 为准，`bun run contracts` 守卫拦截未留痕的增删）。
3. **不留兼容层、不写迁移指南**：改名 / 删除直接做，不提供旧写法过渡、不维护弃用垫片。收敛优先——公共面上的历史包袱趁没有用户清零。
4. **迁移设计从 1.0 起才成为义务**：1.0 后破坏只进 major，且每次必须配迁移页（`/vm/x-to-y`，从 tag 间快照 diff 生成骨架）。在那之前不预支这个成本。

对应关系一句话：**0.x 的 minor = 可能痛的升级（我们明说，但不扶你过去）；1.0 的 major = 我们扶你过去。**

## 1.0 冻结标准（checklist）

1.0 不是「感觉成熟了」就发，而是下面三条**同时**满足才发：

- [ ] **Core 面稳定满 2 个 minor（机器可查）**：连续两个 minor 的 tag 处 `docs/contracts/snapshot.json` 中 Core 层条目（按 tiers.json 过滤）零移除、零改名；`bun run contracts` 全程无未留痕漂移。
- [ ] **测试与守卫全绿常态化**：`bun run verify` 四道门（tsc + guard + test + build）连续两个 minor 周期无跳过、无 ALLOWLIST 新增欠账（每条豁免都带理由且经过评审）。
- [ ] **文档与 llms.txt 同步**：文档站、`AGENTS.md`、`llms-full.txt` 与实现逐条对齐。

Beta 层（图表 / AI / KB）**不在 1.0 冻结范围内**：它们可以在 1.0 后继续随 minor 演进（含公告过的破坏），直到各自满足上述标准再单独冻结。

1.0 发布同时冻结语义化版本纪律：此后**Core** 破坏性变更只在 major，minor 只加功能，patch 只修 bug。

## 版本支持矩阵

| 版本线 | 支持级别 | 截止时间 |
| --- | --- | --- |
| 最新 0.x minor | 全部修复（安全 + bug + 功能） | — |
| 上一个 0.x minor | 仅安全修复 | 发新 minor 后 **3 个月**（0.x 期间的折中窗口；1.0 后改为 6 个月） |
| 更早版本线 | 停止支持 | — |

## 发布机制（与政策配套的工程事实）

- 发版 = 改 `package.json` version → push main → `git tag v<x.y.z> && git push origin v<x.y.z>` → CI（`.github/workflows/publish.yml`）自动构建发 npm，带 provenance。
- npm 包设置为「Require 2FA and disallow tokens」：除这条 CI 外没有任何凭据能发包，发布链本身不可被 token 泄露攻破。
