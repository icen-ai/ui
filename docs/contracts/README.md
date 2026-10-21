# 公共契约（contracts）

库的公共 API 面的机器可读事实源。政策（分层定义、0.x 纪律、1.0 判定）在 [../versioning.md](../versioning.md)；这里只有机制。

| 文件 | 是什么 | 维护方式 |
| --- | --- | --- |
| `snapshot.json` | 公共面快照：类名 / data 属性 / CSS 变量 / 事件 / JS 导出 / 类型签名 | `bun run contracts:update` 生成，随变更同 PR 提交；守卫与 CI 做漂移检查 |
| `tiers.json` | 模块 → 稳定性分层（core / beta / lab） | 手改；守卫强制每个 CSS 模块归类，构建期盖章进 `registry.json` |
| `size-budget.json` | 构建产物体积预算（字节） | 超支即红；随 PR 提高预算（diff 即评审点） |
| `coverage-floor.json` | src/** 覆盖率地板（lcov 口径） | 棘轮，只许升；CI `bun run test:coverage` 执行 |

## 数字与版本（meta.json）

仓库根 `meta.json` 是「数量与版本主张」的唯一产物：版本、组件/行为/图表/预设/原语/令牌计数、kb 域数、测试统计（静态扫描口径）、关键产物体积（raw + gzip）。

- 生成：`bun run meta`（扫描 `scripts/slugs.mjs` / `src/behaviors/charts.ts` / `src/tokens/themes.json` / `tests/` / `dist/`）；手写数字一律视为漂移。
- 消费：README 用 `<!-- meta:key -->值<!-- /meta:key -->` 标记（脚本同步）；文档站经 `site/src/lib/meta.ts` 构建期插值。
- 守卫：`bun run guard` 的「meta 一致性」检查——meta.json 新鲜度、`package.json` 版本与描述、README 标记同步、站点文案硬编码数量主张（历史叙事行用 `meta-ok` 或版本号豁免）。
- 统计口径全部写在 `scripts/meta-core.mjs` 注释里；改动口径 = 改脚本 + 随 PR 说明。

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
