# AI / KB 族验收矩阵（Beta 层）

图表 / AI / 知识库三族是 Beta 层（`docs/contracts/tiers.json`）：随 minor 快速演进。
「演示能跑」不算验收——本文把两族的验收维度钉成矩阵，**每行标注当前证据与缺口**；
缺口挂 [roadmap](./roadmap.md)。动这两族的 PR 不得让「已覆盖」行退化。

## AI 族（ai-*，规格 `docs/spec/ai-native.md`）

| 维度 | 必须验证 | 当前证据 | 缺口 |
| --- | --- | --- | --- |
| 协议 | OpenAI / Anthropic / MCP / AI SDK 四家归一 | `tests/unit/ai-provider.test.ts`（归一层） | 真实网络流的录制回放（CI 不打真 API） |
| 流式 | 中断 / 取消 / 部分输出 / 竞态作废 | ai-core 状态机测试（terminal 后 append 拒绝）；本轮审计修复 cancel/continue 槽 | 多标签页 / 离线恢复（app-owned 状态，见边界注） |
| 工具调用 | 参数错误 / 超时 / 重复调用 / 审批 | `tests/unit/ai-tools*.test.ts`（超时竞态 + schema） | 审批撤销后的 UI 态回归测试 |
| 渲染安全 | 不可信模型输出（链接 / SVG / markdown） | `safeHref` 控制符绕过已堵（本轮）；svg-parse 消毒（on* / script / javascript:）；守卫 innerHTML 红线 | shiki 高亮槽位的宿主侧约定文档化 |
| 状态 | 7 态状态机非法迁移 | `tests/unit/ai-core.test.ts` | — |
| 可用性 | 键盘 / 读屏 / 长文本 | 流式光标 keyframes 修复 + `role=log`/`aria-live`（本轮）；axe 基线 e2e | 真实读屏（NVDA/VoiceOver）通过记录 |
| 成本 | token 统计与用量环 | ai-usage 组件 + `icen:ai-usage` 事件（ai-core） | 失败重试的计费口径文档化 |

## KB 族（kb-*，规格 `docs/spec/kb-family.md`）

| 维度 | 必须验证 | 当前证据 | 缺口 |
| --- | --- | --- | --- |
| 权限语义 | 默认拒绝 / 显式拒绝否决 / 角色取大 / 过期剔除 / 失败关闭 | `tests/unit/kb-acl.test.ts`（evaluateAcl 矩阵）；kb-visibility fail-closed；`tests/kb-conformance.test.ts` | — |
| 诚实呈现 | 授权侧计数、受限侧沉默 | `scripts/guard/kb-honesty.ts` 守卫（3 泄露模式扫描） | — |
| 检索真实路径 | 检索为空 / 无分命中 / 分数归一 | `tests/unit/kb-core.test.ts`（scorePercent null 纪律）；本轮修复 bm25 值域归一 | — |
| 引用 | 越界编号降级 / 剪枝后按 index 对位 | 本轮修复 kb-answer index 对位 + dead sup 降级 | 多答案同页 hover 卡按根取池（本轮已修）的回归测试 |
| 渲染安全 | 用户名 / 元数据 / 段落文本 | 全族 textContent-only（守卫红线）；SVG 全走 svgIcon 消毒 | — |
| 审计 / 可见性 | 审计不可见项不渲染 | kb-audit `hidden` 显式覆盖 + 守卫 | — |
| 可用性 | 触达面 / 对比度 / 焦点 | 本轮精修（引用角标 24px、accent-text 六处、关键词输入焦点环） | 真实触屏设备通过记录 |

## 边界注（诚实声明）

- **会话与草稿归属应用**：线程切换 / 草稿持久化 / 多标签同步是宿主状态，库只提供
  无状态渲染 + 事件（`ai-threads` 状态less、`getComposerDraft` 显式取数）——这些
  不在本矩阵验收范围，文档站框架页写清用法即可。
- **沙箱安全模型**：`kb-sandbox` iframe `sandbox="allow-scripts"`（严禁
  `allow-same-origin`）、入站 `e.source` 校验、8000ms 调用上限——srcdoc 由宿主控制，
  宿主注入不可信 HTML 属于用法违规。

## 用法

- 动 AI / KB 族的 PR：对照本矩阵确认「已覆盖」行不退化（相关测试文件在 `bun test` 里必然跑到）；
  新覆盖的行当场补证据指针；
- 缺口清单的唯一出口是 [roadmap](./roadmap.md) 对应批次——不允诺「以后再说」而无归属。
