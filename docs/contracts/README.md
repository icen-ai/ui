# 公共契约（contracts）

库的公共 API 面的机器可读事实源。政策（分层定义、0.x 纪律、1.0 判定）在 [../versioning.md](../versioning.md)；这里只有机制。

| 文件 | 是什么 | 维护方式 |
| --- | --- | --- |
| `snapshot.json` | 公共面快照：类名 / data 属性 / CSS 变量 / 事件 / JS 导出 / 类型签名 | `bun run contracts:update` 生成，随变更同 PR 提交；守卫与 CI 做漂移检查 |
| `tiers.json` | 模块 → 稳定性分层（core / beta / lab） | 手改；守卫强制每个 CSS 模块归类，构建期盖章进 `registry.json` |
| `size-budget.json` | 构建产物体积预算（字节） | 超支即红；随 PR 提高预算（diff 即评审点） |
| `coverage-floor.json` | src/** 覆盖率地板（lcov 口径） | 棘轮，只许升；CI `bun run test:coverage` 执行 |

## 命令

```bash
bun run contracts                            # 漂移检查（移除/签名变化=破坏，新增=留痕）
bun run contracts:update                     # 确认有意变更后重新生成快照
bun run contracts:diff <refA> [refB|-]       # tag 间 diff，每条差异带分层归类
bun run contracts:diff v0.11.0 v0.13.0 --gate core   # 1.0 判定第一条：两个 minor 间 Core 面零破坏
```

快照只记录「存在面」与「签名面」，不预判语义——同名改行为、默认值变化归 CHANGELOG 纪律与评审。

## 已知盲区（诚实清单）

- **语义漂移**：签名没变但行为含义变了——靠 CHANGELOG 与评审。
- **CSS 变量默认值**：名字在、值变不在本面——主题改动走视觉基线对拍。
- **留痕的破坏**：守卫拦截「不留痕的漂移」；「同 PR 更新快照的破坏」由 CI 的 CHANGELOG 联动检查与评审拦截。
