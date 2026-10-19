# 测试体系：四道门 + 浏览器验收舱

最后更新：2026-10-18。

`@icen.ai/ui` 的信任链分两层：**快速门**（本地秒回，开发循环内跑）+ **浏览器验收舱**（真实 chromium，重，按需/CI 跑）。两者分工不同，不互相替代。

## 快速门：`bun run verify`（四道门）

```bash
bun run verify   # = tsc + guard + test + build，全绿才算数
```

| 门 | 命令 | 证明什么 |
| --- | --- | --- |
| 1 类型 | `bunx tsc --noEmit` | 行为 TS / React / Vue 封装签名自洽 |
| 2 纪律 | `bun run guard` | 11 项守卫：CSS 纪律（hex/z-index/keyframes/滚动条/!important/头注释）/ token 引用闭合 / registry 一致性 + **稳定性分层覆盖（tiers.json 显式归类）** / 事件字面量（含 IcenEventMap 登记）/ SSR 守卫与 innerHTML 红线 / 命名空间 / 权限域诚实呈现 / RTL 逻辑属性 / 类名同步（JS↔CSS 同形态）/ 操作图标 / **契约快照漂移（公共面 vs snapshot.json：移除=破坏性红牌，新增=留痕黄牌）** |
| 3 单测 | `bun test` | happy-dom 里的契约与行为（见下「分工心智」；含 React/Vue 封装契约 `tests/unit/*-wrapper.test.*`：StrictMode 双挂载/卸载清理/事件桥解绑；Core 族一致性套件 `tests/conformance/`：init 幂等 / destroy 可重入 / 事件登记+协议形态 / 键盘焦点 / XSS 文本纪律，表驱动 harness 与 kb-conformance 同形态） |
| 4 产物 | `bun run build` | tsup + css 构建出 dist（registry.json 含 tiers 盖章），文档站构建冒烟在 CI |

## 浏览器验收舱：e2e 两层（真实 chromium）

被测对象 = 文档站静态产物（`site/dist`，`pretest:e2e` 自动重建），由 `scripts/serve-static.mjs`（零依赖 node:http）伺服在 127.0.0.1:4173。

```bash
bun run test:e2e        # 跑两层（自动先构建文档站）
```

- **视觉回归**（`tests/e2e/visual.pw.ts`）：8 页 fullPage 截图与基线比对（`maxDiffPixelRatio: 0.01`），另对 `/` 与 `/components/btn/` 打 dark（`localStorage icen.ui.theme={"preset":"dongyun","dark":true,"style":"modern"}`）与 RTL（`<html dir="rtl">`）变体；`animations: 'disabled'` 定格交互动画防抖动。
- **无障碍扫描**（`tests/e2e/a11y.pw.ts`）：axe-core 注入页面。门禁语义是**债只许减不许增**——critical/serious 违规对照已提交的 `a11y-baseline.json`：基线内（既有债，全部位于红线文件 src/** tokens·组件·行为 与 site/src/** 站壳样式，本工作流不得修改）→ 打印规则/目标/修法提示，不 fail；**基线外（新增违规）→ fail**。moderate/minor 只聚合打印。基线更新：`A11Y_UPDATE_BASELINE=1 bunx playwright test tests/e2e/a11y.pw.ts`（须随 PR 人工评审提交）。同页面清单 8 页各一条，外加 3 条交互后再扫：打开 modal 对话框、展开 select 面板（浮层 portal 态）、表单提交触发错误态——证明动态/浮层态同样被盯住。

### 为什么 e2e 文件是 `.pw.ts` 而不是 `.spec.ts`

bun 的测试扫描器按文件名匹配 `*.spec.*` / `*.test.*`，**且 bun 1.3.5 的 bunfig 没有任何生效的 discovery 排除项**（`[test] exclude` / `pathIgnorePatterns` 均已实测无效，`.spec.ts` 放到任何目录都会被 `bun test` 拾起并在 `test()` 调用处抛错）。红线是「`bun test` 不得扫到 e2e」，所以 e2e 用例用 bun 不认识的 `.pw.ts` 后缀，`playwright.config.ts` 里 `testMatch: '**/*.pw.ts'` 显式收编。`bunfig.toml` 仍留了 `pathIgnorePatterns` 作为升级 bun 后的双保险。

### 基线更新流程

```bash
bun run pretest:e2e                                            # 1. 重建 site/dist
bunx playwright test --update-snapshots                        # 2. 重生成视觉基线
A11Y_UPDATE_BASELINE=1 bunx playwright test tests/e2e/a11y.pw.ts # 2b. 重生成无障碍债基线（须人工评审）
bun run test:e2e                                               # 3. 复跑一次确认稳定
```

**该更基线的改动**（随同一 PR 提交 `tests/e2e/__screenshots__/`）：tokens 基值/预设/明暗面、组件 CSS 视觉（颜色/圆角/间距/阴影/排版）、文档站样式与内容结构、demo 数据变化。**不该更基线的改动**：字体渲染环境变化（换 OS/换浏览器版本）、动画时序——这两类要么换环境重打全套，要么修截图条件（如加 mask），不许用 `--update-snapshots` 掩盖真实回归。

**OS 敏感性**：基线在 Windows 生成；Linux CI 因字体渲染差异首次对比可能失败——在 CI 同构环境（Linux + 同版本 chromium）重打基线后提交，不要放宽 `maxDiffPixelRatio` 迁就。

### CI

`.github/workflows/e2e.yml`：push main / PR / 手动触发；构建文档站 → `playwright install --with-deps chromium` → `bun run test:e2e`；失败时上传 `playwright-report/` 与 `test-results/`（7 天保留）。**e2e 不进 `bun run verify` 默认链**（重）。

## happy-dom 与真实浏览器的分工心智

| | happy-dom（`bun test`） | 真实 chromium（e2e） |
| --- | --- | --- |
| 回答的问题 | **逻辑对不对**：normalize/契约/事件委托/状态机/求值语义 | **渲染像不像、键盘读屏能不能用**：布局、主题变量、RTL 镜像、焦点环、ARIA |
| 速度 | 毫秒级，450+ 用例全量 ~12s | 分钟级，只跑 8 页 + 变体 |
| 典型缺陷只有它能抓 | 行为分支覆盖、kb 诚实呈现泄露文案 | 颜色对比度不足、focus trap 缺失、暗色 token 断裂、RTL 未镜像 |
| 典型缺陷它抓不到 | 视觉回归、对比度、真实字体排版 | 纯函数内部边界（e2e 不替代单测） |

一句话：**单测证明「逻辑对」，e2e 证明「别人生产环境里看到/读到/操作到的东西对」**。改 CSS 视觉必须同时过 guard（纪律）+ e2e 基线（事实）；改行为必须同时过单测（逻辑）+ axe（无障碍）。

## 视觉冒烟（demo 健康巡检）

`node scripts/visual-smoke.mjs`（需先启动 `cd site && bun run dev` 或静态 serve `site/dist`）：遍历全组件页，断言无巨型失控 SVG（>64px）、无空图表容器、无 JS 错误。demo/文档类视觉回归的第一道网。

**深度巡检两件套**：
- `node scripts/audit-interact.mjs`（目标 `NEW=http://…`，默认 4573 preview）：12 个高风险组件的真实点击/输入巡检（select/cascader/tree-select/mentions/autocomplete/progress/tabs/modal/date-picker/charts tooltip/ai-tool-call 图表回执/ai-composer 命令层）——「面板能不能开、选了有没有回显、进度条是不是零宽」这类功能级回归。
- `node scripts/audit-visual.mjs`（`OLD=基线站 NEW=当前站`）：双站全页截图 + pixelmatch diff + 页内断言（巨型/隐身 SVG、文本硬裁切、空色板、黑盘圆环、空图表、裸 JSON 图表回执、JS 错误），报告落 `.parity/report.json`——迁移/大改前后的逐页像素对拍。
