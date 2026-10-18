# 更新日志

## 0.10.0（开发中，未发布）

首个版本。当前形态一览：

- **设计令牌**：6 套色彩主题（现代 / 东韵 / 巨构 / 钢琴 / 莫奈 / 梵高）× 4 套设计原语（现代 / 中式 / 苏式 / 像素）× 明暗双模，全部挂在 `<html>` 的 data 属性上；配色目录单一事实源 `src/tokens/themes.json`
- **组件**：122 个无框架组件 slug（CSS 契约 + 按需行为 JS）；类名统一 `icen-` 前缀、钩子统一 `data-icen-*`、变量统一 `--icen-*`，产物全部进 cascade layers
- **AI 原生族**：会话 / 推理 / 工具调用 / 审批 / 输入台 / 用量与审计，7 态状态机 + 多模态内容模型 + provider 适配层 + UI-as-tool 工具体系
- **知识库族**：32 个组件覆盖 RAG 全链路（证据 / 摄取 / 检索 / 问数 / 治理 / 工作台 / 权限），权限域 fail-closed 语义由测试强制执行
- **图表**：ChartSpec 纯 JSON 通用层，13 种图，交互与 tooltip 内建
- **工程基座**：bun test + 10 项纪律守卫 + Playwright 浏览器验收；i18n 双语注册表；RTL 逻辑属性；设计工具导出（DTCG / Tokens Studio / Figma Variables）
- **发布链**：git tag → GitHub Actions OIDC trusted publishing → npm（带 provenance，无长期 token）
