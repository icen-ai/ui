# 稳定性分层

> **状态：已采纳（2026-10-19）。** 事实源 [`tiers.json`](./tiers.json)，
> 守卫强制每个 CSS 模块显式归类（未标 = 拦），构建期盖章进
> `registry.json` 的 `tiers` 字段，文档站组件页徽标同源。
>
> **采纳时的两条决策记录：**
> 1. **单包内分层，不拆包**（`@icen.ai/ui-charts` 等留到 1.0 后再评估）：
>    单一维护者下拆包先付发布协调成本，而 kb→charts、ai→code-block 的交叉
>    依赖还在加深；分层承诺用单包机制兑现。
> 2. **0.x 收敛期无外部用户——破坏不留兼容层、不写迁移指南**（见
>    [../versioning.md](../versioning.md) 0.x 纪律）：改名 / 删除直接做，
>    公共面上的历史包袱趁没有用户清零；**迁移设计从 1.0 起才成为义务**。

## 问题

README 目前把组件 / 图表 / AI / 知识库 / 主题 / React/Vue 平铺在同一层。用户无从
分辨什么是可以押上生产的稳定核，什么是演进速度天然更快的领域面（AI 协议、检索
形态每季都在变）。公共契约快照量出的 **2822 个契约点**（1833 类名 + 220 属性 +
268 变量 + 160 事件 + 341 导出）全走同一个版本线，意味着每个 minor 都是全库面的
隐性迁移审查。

## 三层定义

| 层级 | 内容 | 承诺 |
|---|---|---|
| **Core** | 基础组件 + 主题 + i18n + 事件体系 | 1.0 冻结目标：0.x 期间破坏只进 minor 且逐条公告；1.0 后破坏只进 major |
| **Product** | charts / AI / KB 三族 | beta：允许随 minor 演进（含破坏），CHANGELOG 单列 beta 段落 + 迁移说明 |
| **Lab** | 站点工作台、CLI 实验、孵化中的新原语/新预设 | 不承诺兼容，不进入默认产物；转正需过 Core 同款守卫面 |

## 具体归类（草案）

- **Core**：`tokens/*`、`base`；表单输入族（input / select / tree-select / cascader /
  autocomplete / date-picker / tag-input / mentions / upload / form-validate）；
  按钮卡片徽标标签（btn / card / badge / tag / pill / empty / stat）；浮层反馈
  （modal / popover / tooltip / toast / notification / dropdown / context-menu /
  command-palette / feedback / copy / code-block）；导航布局（nav / tabs / sidebar /
  breadcrumb / pagination / steps / carousel / tree / accordion / split-pane /
  scroll-area / panel / segmented / toolbar / layout）；主题与基建
  （theme / theme-switcher / i18n / events / icons / controls / focus）。
- **Product（beta）**：`charts.ts` + 13 个图组件与 spec 层；`ai-*` 全族 +
  composer；`kb-*` 全族（32 组件）。
- **Lab**：`site/` 的设计工作台页（modern.astro）等站点实验；未注册进
  registry 的孵化物。

**React / Vue 封装**：作为 Core 的从属面随 Core 承诺，但需单列版本矩阵与
SSR / StrictMode 行为说明（见下「待办」）。

## 落地路径（不拆包版，已实施 1–4）

1. ~~`registry.json` 每个组件加 `tier` 字段~~ ✅ `docs/contracts/tiers.json` 为事实源，build-css 盖章 `registry.tiers`（module→tier），守卫校验覆盖与取值；
2. ~~文档站组件页顶栏显示稳定性徽标~~ ✅ `[slug].astro` 徽标（Core · 稳定 / Beta · 演进中，含悬停说明与 i18n）；
3. ~~CHANGELOG 按层分节~~ ✅ 纪律写入 `docs/versioning.md`（Core 破坏置顶逐条公告，beta 段落单列）；
4. ~~1.0 判定改为「Core 层面连续两个 minor 快照零移除」~~ ✅ versioning.md checklist 第一条已机器化（tag 间 snapshot diff + tiers.json 过滤）。

## 待办（后续批次）

- [ ] React / Vue 兼容矩阵：版本支持、SSR / RSC、StrictMode 双挂载、事件清理。
- [ ] 文档站 /components 索引页按层着色/分组（详情页徽标已上线）。
- [ ] 迁移页（`/vm/x-to-y`）：**1.0 起才建**——0.x 收敛期明确不提供（无用户，无迁移债）；
      届时直接从两个 tag 的 snapshot diff 生成骨架。
