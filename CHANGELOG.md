# 更新日志

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [SemVer](https://semver.org/lang/zh-CN/)；
0.x 纪律（破坏只进 minor、逐条公告、收敛期不留兼容层）见 [docs/versioning.md](docs/versioning.md)。
契约面变化以 [docs/contracts/snapshot.json](docs/contracts/snapshot.json) 的机器 diff 为准
（`bun run contracts:diff <tagA> <tagB>`，CI 强制破坏性条目必须在本文件留痕）。

## [Unreleased] — 目标 0.11.0（含破坏性变更）

### 安全性

- **修复两个真实 XSS 绕过**（kb-explain 链接守卫：内嵌控制字符 `java\tscript:` 与 C0 控制符前缀），新增 `safeUrl` 协议守卫唯一事实源 + 74 条对抗语料与槽位断言；补齐裸奔槽位（notification 的 link/avatar、ai-chat 媒体 src）
- 全组件精修：7 项 P0 与 27 项逻辑缺陷修复（XSS、焦点、对比度、触达面）

### 破坏性变更（Core）

- 内置 AI 工具 `show_form` 的注册从 `form-validate`（Core）移至 `ai-tools`（Beta）：`import 'form-validate'` 不再有注册副作用，改用工具系统请引 `behaviors/ai-tools`；`form-validate` 新增导出 `runShowForm` / `SHOW_FORM_SCHEMA`（additive）

### 修复

- 站点语言自动检测（`navigator.languages`）使 e2e 在英文 locale 下全站变英文、中文断言全红——playwright 配置钉死 `locale: zh-CN`，验收舱与环境 locale 解耦
- SiteHeader 语言切换器可访问名不含可见文本（axe `label-content-name-mismatch`）——改 `aria-labelledby` 复合命名
- 六处展开态 axe 对比度违规修复：avatar 首字母与用户消息头像改用承文本档 `accent-text`（accent 亮档只做图形）、kb-pipeline 错误正文与站点 demo 色块由 muted 提为正文色、notification 操作钮去 muted 化
- e2e 测试代码漂移清偿：顶导外观控件统一为 `#appearance-select`（预设/原语二选一并入三轴面板）、明暗二态契约在测试侧对齐（禁写 `"light"` 值）、tabs roving tabindex 断言对齐 APG 焦点跟随契约、首页复制钮 `.install-copy` → `.pm-copy`、mentions 异步目录等待条件加固
- 文档站组件页新增「接口」区块（导出 / 事件 / 类型指针），由 slugs 登记表与行为源码构建期自动生成，不手填不漂移

### 新增（工程基座）

- 稳定性分层落地：Core（1.0 冻结轨道）/ Beta（图表、AI、KB 三族），事实源 `docs/contracts/tiers.json`，构建期盖章 `registry.json`，文档站组件页徽标同源；新守卫 `tier-direction`——Core 运行时 import Beta 即 CI 红
- 公共契约快照新增 `types` 面（TS 编译器 API 抽取导出面规范化签名）；新增 `bun run contracts:diff <refA> [refB] [--gate core]`——tag 间契约 diff + 分层过滤（1.0 判定与未来迁移页骨架共用）
- 行为 conformance 套件 `tests/conformance/`（26 个 Core 组件的 init 幂等 / destroy 清理 / 事件契约 / 键盘焦点 / XSS 文本纪律，125 用例）；抓出并修复两个真实 bug（command-palette Enter 双派事件、tree toggle 事件语义相反）
- 封装兼容矩阵 CI：React 18/19 × Vue 3.3/3.5 四条版本线实跑封装契约测试
- 弃用纪律机器化：`@deprecated 用 X 替代（<次版本> 移除）` 约定 + 守卫（无移除版本 / 公告期不足一个 minor / 到期未删 = CI 红）
- 体积预算（`docs/contracts/size-budget.json`）与覆盖率棘轮（`docs/contracts/coverage-floor.json`，lcov 口径）进 CI
- 包面检查 `bun run check:pkg`（publint + attw）；kit 子路径补齐类型面（`dist/components/<slug>.d.mts`）；修复声明文件 specifier 指向 `.js` 导致 node16 类型解析失败的缺陷
- 发布链：publish.yml 发版前跑全部门（tsc + guard + test + build + size + check:pkg）+ 校验 tag 与版本一致 + 发布成功自动建 GitHub Release
- CI 联动检查：契约快照含破坏性条目时 CHANGELOG 必须同 PR 改动
- dependabot（bun × 2 + github-actions）、PR 模板、issue 入口配置、CODE_OF_CONDUCT、LICENSE、.editorconfig
- 陌生人 dogfood 首轮验收：26/26 通过；3 处修库（form-validate 复验位移吃点击、datatable pageSize 回显、空 summaryRow）+ 5 处修文档，清单见 [docs/dogfood.md](docs/dogfood.md)
- 文档站：全站中英双语（4034 条词典）、hero 品牌化

## [0.10.0] — 2026-10-19

0.x 收敛线的起点：主题×原语矩阵、对象化提及输入、契约治理基座引入前的最后形态。

- 设计令牌：6 套色彩主题 × 4 套设计原语 × 明暗双模，全部挂在 `<html>` data 属性；配色单一事实源 `src/tokens/themes.json`
- 组件：122 个可安装 slug（CSS 契约 + 按需行为 JS）；类名 `icen-` / 钩子 `data-icen-*` / 变量 `--icen-*`；产物全部进 cascade layers
- AI 原生族：7 态状态机 + 多模态内容模型 + provider 适配层 + UI-as-tool 工具体系
- 知识库族：32 个组件覆盖 RAG 全链路，权限域 fail-closed 语义由测试强制
- 图表：ChartSpec 纯 JSON 通用层，13 种图，交互与 tooltip 内建
- 发布链：git tag → GitHub Actions OIDC trusted publishing → npm（provenance，无长期 token）

## 历史版本（0.1.0 – 0.9.0）

早期快速迭代期未逐条记录 changelog（npm 与 tag 可考）。要点：

- **0.9.0**（2026-10-03）：kb 族权限域（kb-perm）五件套 + `/kb` 八标签工作台
- **0.8.x**（2026-10-02）：AI 原生组件族与知识库族主体落地
- **0.5.0**（2026-07-29）：全量组件工程级强化
- **0.4.0**（2026-07-29）：图表细分类型 + 表格强化
- **0.3.0**（2026-07-29）：datatable（搜索/排序/筛选/分页/虚拟滚动）+ kit 一行入口与 CLI
- **0.2.x**（2026-07-28）：组件体系大扩编（31 组件 + 19 behaviors，复刻 opengal 体系）
- **0.1.x**（2026-07-28）：首个 npm 发布（tokens + 基础组件）

（0.6 / 0.7 未发布；0.1.0 无对应 git tag。）
