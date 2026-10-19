# 陌生人 Dogfood 验收记录

「自己人觉得文档写清了」不算数——本文记录**零上下文陌生人验收**：把库交给一个
没有任何项目记忆的代理，只给消费方能拿到的三样东西，看它能不能独立把真实界面
做出来。卡住的每一处都是文档或库的真实缺口，逐条登记处置。

与 [acceptance.md](./acceptance.md) 的分工：acceptance 是 AI/KB 族的**维度验收矩阵**
（每版都要过）；本文是**一次性陌生人视角事件**的存档，跑出新卡点就往这里追加一节。

## 2026-10-19 · 首次陌生人验收

**方法**

- 代理零上下文：不读本仓库源码，不给口头提示，只看消费方真实可得的材料——
  npm 产物（`dist/` + `.d.mts` + 包内 AGENTS.md）、<https://ui.icen.ai/llms-full.txt>、
  文档站组件页。
- 任务：做一个真实小页面——登录表单 + 数据表 + 筛选（select）+ 弹窗 + 主题切换。
- 实测：Playwright 驱动真实浏览器断言交互结果，不看「看起来对」的截图。

**卡点清单与处置**

| # | 卡点 | 根因 | 处置 |
| --- | --- | --- | --- |
| 1 | 提交按钮在布局中位移 | 库实现缺陷 | **修库**（本轮代码修复） |
| 2 | CSS 引入行表述含糊：README 写 tokens.css + ui.css 两行，ui.css 头注释却自称「全量（tokens+base+components）」——到底引一个还是两个；纯 `<link>` / 无构建场景无示例 | 文档 | **修文档**（本轮）：README / AGENTS.md / llms.txt 统一口径——ui.css = 全量单文件（含 tokens）一行即可；tokens.css 是「单引个别组件 CSS」按需场景的底座；纯静态补 `<link>` 相对路径示例 |
| 3 | 亮色主题语义：静态写 `data-icen-theme="light"` 被 `initTheme` 直接删掉 | 文档 | **修文档**（本轮）：AGENTS.md 消费段 / README 快速示例 / 文档站首页与外观切换页明示二态契约——dark = 写属性，light = 移除属性，没有 `"light"` 值 |
| 4 | `icen:select-change` 事件名与 detail 形状（`{value, values, label}`）在 llms-full.txt 与类型面查不到 | 文档 | **修文档**（本轮）：文档站 select 条目补事件节（多选 / 清空的 detail 形状按 `src/behaviors/select.ts` 核实），behavior 头注释同步补事件契约 |
| 5 | datatable 改 pageSize 后页码回显不更新 | 库实现缺陷 | **修库**（本轮代码修复） |
| 6 | datatable summary 空数据时残留空行 | 库实现缺陷 | **修库**（本轮代码修复） |
| 7 | 纯静态场景 `file://` 直开页面，ES module / `@import` 被浏览器 CORS 拦截 | 环境常识，但陌生人不知道 | **文档补一句**（本轮）：README / AGENTS.md / 文档站首页注明「ES module 直引需经静态服务器」 |
| 8 | FetchURL 工具抓 llms-full.txt 受限 | 工具链限制，与库无关 | **不处置**（工具链侧问题，记录在案） |

**复盘口径**

- 8 个卡点 = 3 修库 + 4 修文档 + 1 不处置。文档类缺口全部在同一轮补齐并随
  站点构建重新生成 llms-full.txt，不留「以后再说」。
- 「修库」三条（1/5/6）走正常 PR 纪律：测试先行、`bun run verify` 四道门。
