# 公共契约快照（contracts snapshot）

`docs/contracts/snapshot.json` 是库的**公共 API 面的机器可读清单**，由
`bun run contracts:update` 从源码抽取生成，随变更同 PR 提交；
`bun run contracts`（及 `bun run guard` 第 11 项守卫）对它做漂移检查。

## 为什么存在

[docs/versioning.md](../versioning.md) 的 1.0 标准第一条是「API 稳定两个 minor」，
但此前只能靠人工记忆与 CHANGELOG 自述。快照把契约面钉成可 diff 的数据：

- **移除 / 改名** = 破坏性变更：守卫直接报红，必须在 minor 里逐条公告并给迁移说明；
- **新增** = 扩面：同样要过守卫（跑 `contracts:update` 留痕），防止「顺手加」；
- 两个 minor tag 处的快照可从 git 检出互 diff——1.0 第一条标准从此**机器可查**。

快照只记录「存在面」，不预判语义；同名改行为、默认值变化仍归 CHANGELOG 纪律。

## 覆盖的六个面

| 面 | 抽取规则 | 当前规模（v0.10.0 基线） |
|---|---|---|
| `classes` | `src/**/*.{css}` 选择器中的 `.icen-*`（注释剥离后） | 1833 |
| `dataAttributes` | `src/**/*.{css,ts,tsx}` 中的 `data-icen-*` | 220 |
| `cssVariables` | `src/**/*.{css,ts,tsx}` 中的 `--icen-*` | 268 |
| `events` | `src/**/*.{ts,tsx}` 中带引号的 `icen:*` 字面量 | 160 |
| `jsExports` | `import src/index.ts` 的运行时导出名 | 343 |
| `types` | TS 编译器 API 从 `src/index.ts` 导出面生成的规范化签名（函数签名 / 接口字段 / 类型别名展开式 / 类成员；不依赖 dist 产物） | 648 |

`types` 面的漂移分类：**符号消失或签名变化 = 破坏性（breaking）**，签名变化成对展示
`旧 → 新`；**新增 = additive**。守卫与 `bun run contracts` 同口径输出。

## 命令

```bash
bun run contracts          # 漂移检查（CI / guard 同口径）
bun run contracts:update   # 确认有意变更后重新生成快照
```

## 已知盲区（诚实清单）

- **语义漂移**：签名没变但行为/视觉含义变了——靠 CHANGELOG 与评审。
- **CSS 变量默认值**：名字在、值变（如对比度、尺寸）不在本面——主题改动走视觉基线对拍。
- **选择器等价重写**（如 `:is()` 合并）不影响抽取结果，属无害重构。

## 与稳定性分层的关系

面的「稳定性」不是全库一刀切——见 [stability-tiers.md](./stability-tiers.md)（草案）：
分层采纳后，1.0 的「稳定两个 minor」按 **Core 层面**判定，beta 层（charts / AI / KB）
允许在公告前提下随 minor 演进。
