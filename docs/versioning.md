# 版本纪律与发布政策

最后更新：2026-10-06（v0.10.0）。

本文回答三个问题：**0.x 期间破坏性变更怎么管**、**什么时候发 1.0**、**每个版本线支持多久 / deprecated 别名活多久**。写在这里就是为了让你可以在评审与采购环节直接引用。

## 0.x 纪律（当前阶段）

0.x 不代表随意。破坏性变更（类名 / data 属性 / CSS 变量 / 事件名 / 函数签名改名或删除）遵守三条：

1. **只在 minor 发生**：patch（0.10.1 → 0.10.2）只修 bug，永不改公共契约。紧急安全修复若必须动契约，按 minor 走并配齐第 2、3 条。
2. **必配 codemod**：破坏性 minor 随包发布官方迁移工具，消费方一条命令完成迁移。范式 = v0.10 的 `bunx @icen.ai/ui migrate src --write`：API 感知 tokenizer、歧义 token 保守跳过并给人工清单、映射冻结于随包发布的 `migrate-map.json`。以后每个破坏性 minor 都以此为模板——**先写 codemod，再发版**。
3. **必配迁移指南**：CHANGELOG 里有独立的「迁移指南」小节（0.10.0 即此格式），写清命令、人工清单处理建议、回退方式。

对应关系一句话：**minor = 可能痛的升级（工具把痛消化掉），patch = 无感升级**。如果你从 0.10.1 升到 0.10.x 最新版还需要改自己的代码，那是我们的 bug，请开 issue。

## 1.0 冻结标准（checklist）

1.0 不是「感觉成熟了」就发，而是下面四条**同时**满足才发：

- [ ] **API 面稳定满 2 个 minor**：连续两个 minor（含破坏性窗口）期间，公共导出（`dist/*.d.mts` 声明面）无未公告的签名变更；deprecation 清单全部处理完毕（删除或转正）。
- [ ] **测试与守卫全绿常态化**：`bun run verify` 四道门（tsc + guard + test + build）连续两个 minor 周期无跳过、无 ALLOWLIST 新增欠账（每条豁免都带理由且经过评审）。
- [ ] **文档与 llms.txt 同步**：文档站、`AGENTS.md`、`llms-full.txt` 与实现逐条对齐；1.0 的迁移指南覆盖 0.x 最后一个 minor。
- [ ] **迁移工具覆盖最近两个 minor**：发 1.0 时的 codemod 能从最近两个 0.x minor 全自动迁移（歧义清单除外），并在 CI 里用真实消费方代码（accounts 等生态项目）做迁移回归。

1.0 发布同时冻结语义化版本纪律：此后破坏性变更只在 major，minor 只加功能，patch 只修 bug。

## 版本支持矩阵

| 版本线 | 支持级别 | 截止时间 |
| --- | --- | --- |
| 最新 0.x minor | 全部修复（安全 + bug + 功能） | — |
| 上一个 0.x minor | 仅安全修复 | 发新 minor 后 **3 个月**（0.x 期间的折中窗口；1.0 后改为 6 个月） |
| 更早版本线 | 停止支持 | — |

当前实例：0.10.x 接收全部修复；0.9.x 仅安全修复至 2026-12-31（0.10 发布于 2026-10-06，三个月窗口的落地）。

## Deprecation 政策

- **提前公告**：API 废弃时，在该 minor 的 CHANGELOG 与 JSDoc（`.d.mts` 注释）中显式标注 deprecated 及替代写法。
- **存活期**：deprecated 别名至少存活到**下一个破坏性版本**才删除——0.x 期间即下一个破坏性 minor，1.0 后对齐语义化版本（下一个 major）。绝不静默删除。
- **双发机制**：事件类废弃走兼容双发。实例：OTP 完成事件当前双发 `icen:otp-complete`（新）与 `otp:complete`（deprecated），删除前两者行为一致、消费方有完整一个窗口期迁移。事件守卫对 deprecated 兼容事件有登记在案的豁免，不是漏网。
- **JS 方法别名同理**：如 `toast.ok()` → `toast.success()`，同属「deprecated 别名，下个大版本删」的范畴，政策一致。

## 发布机制（与政策配套的工程事实）

- 发版 = 改 `package.json` version → push main → `git tag v<x.y.z> && git push origin v<x.y.z>` → CI（`.github/workflows/publish.yml`）自动构建发 npm，带 provenance。
- npm 包设置为「Require 2FA and disallow tokens」：除这条 CI 外没有任何凭据能发包，发布链本身不可被 token 泄露攻破。
