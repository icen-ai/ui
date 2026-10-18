# 版本纪律与发布政策

本文回答三个问题：**0.x 期间破坏性变更怎么管**、**什么时候发 1.0**、**每个版本线支持多久**。写在这里就是为了让你可以在评审与采购环节直接引用。

## 0.x 纪律（当前阶段）

0.x 不代表随意。破坏性变更（类名 / data 属性 / CSS 变量 / 事件名 / 函数签名改名或删除）遵守两条：

1. **只在 minor 发生**：patch（0.10.1 → 0.10.2）只修 bug，永不改公共契约。紧急安全修复若必须动契约，按 minor 走。
2. **CHANGELOG 逐条写明**：破坏性 minor 在 CHANGELOG 里写清每项契约变化与替代写法，不静默变更。

对应关系一句话：**minor = 可能痛的升级，patch = 无感升级**。如果你从 0.10.1 升到 0.10.x 最新版还需要改自己的代码，那是我们的 bug，请开 issue。

## 1.0 冻结标准（checklist）

1.0 不是「感觉成熟了」就发，而是下面三条**同时**满足才发：

- [ ] **API 面稳定满 2 个 minor**：连续两个 minor 期间，公共导出（`dist/*.d.mts` 声明面）无未公告的签名变更。
- [ ] **测试与守卫全绿常态化**：`bun run verify` 四道门（tsc + guard + test + build）连续两个 minor 周期无跳过、无 ALLOWLIST 新增欠账（每条豁免都带理由且经过评审）。
- [ ] **文档与 llms.txt 同步**：文档站、`AGENTS.md`、`llms-full.txt` 与实现逐条对齐。

1.0 发布同时冻结语义化版本纪律：此后破坏性变更只在 major，minor 只加功能，patch 只修 bug。

## 版本支持矩阵

| 版本线 | 支持级别 | 截止时间 |
| --- | --- | --- |
| 最新 0.x minor | 全部修复（安全 + bug + 功能） | — |
| 上一个 0.x minor | 仅安全修复 | 发新 minor 后 **3 个月**（0.x 期间的折中窗口；1.0 后改为 6 个月） |
| 更早版本线 | 停止支持 | — |

## 发布机制（与政策配套的工程事实）

- 发版 = 改 `package.json` version → push main → `git tag v<x.y.z> && git push origin v<x.y.z>` → CI（`.github/workflows/publish.yml`）自动构建发 npm，带 provenance。
- npm 包设置为「Require 2FA and disallow tokens」：除这条 CI 外没有任何凭据能发包，发布链本身不可被 token 泄露攻破。
