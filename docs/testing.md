# 测试体系

信任链分三层，各司其职、互不替代：

| 层 | 命令 | 回答的问题 | 何时跑 |
| --- | --- | --- | --- |
| 本地快门 | `bun run verify`（tsc + guard + bun test + build + size） | 逻辑对不对、纪律破没破、产物出不出 | 每次提交前，秒级-分钟级 |
| CI 慢门 | `bun run test:coverage`（覆盖率地板）· `bun run check:pkg`（publint + attw）· 契约-CHANGELOG 联动（PR） | 覆盖率债只减不增、包面不退化、破坏必公告 | 每个 PR / push（并行 job，不拖墙钟） |
| 浏览器验收舱 | `bun run test:e2e` | 渲染像不像、键盘读屏能不能用 | CI 独立 workflow；本地按需 |

**心智**：单测证明「逻辑对」（happy-dom，毫秒级），e2e 证明「生产环境里别人看到/读到/操作到的东西对」（真实 chromium，分钟级）。改 CSS 视觉过 guard + e2e 基线；改行为过单测 + axe。

## 覆盖率与体积（棘轮文件）

- `docs/contracts/coverage-floor.json`：src/** 的行/函数覆盖率地板（lcov 口径）。**只许升不许降**——下调的 diff 即评审点。
- `docs/contracts/size-budget.json`：dist 关键产物的字节预算，超支即红。
- 弱覆盖模块清单（补齐顺序按此）：kb 族后半（kb-clarify / kb-hittest / kb-pipeline / kb-sql / kb-review / kb-sandbox / kb-audit 等）、ai 族 ai-panel / ai-threads / ai-chat / ai-diff、基础件 nav / slider。补一个模块就把地板往上拧一点。

## e2e 要点

- 用例后缀 `.pw.ts`（bun 的扫描器认 `*.test.*`/`*.spec.*` 且 bunfig 排除不生效，`.pw.ts` 是规避红线；playwright.config.ts 显式 `testMatch` 收编）。
- 视觉基线在 `tests/e2e/__screenshots__/`，随 git 提交。**基线对 OS/字体敏感（Windows 生成）**——Linux CI 红了就在同构环境 `bun run test:e2e:update` 重打提交，不许放宽 `maxDiffPixelRatio` 迁就。
- axe 门禁语义是**债只许减不许增**：基线 `tests/e2e/a11y-baseline.json` 内打印修法不 fail，基线外新增即 fail；更新基线走 `A11Y_UPDATE_BASELINE=1 bunx playwright test tests/e2e/a11y.pw.ts`（须人工评审提交）。
- 巡检脚本（非门禁）：`scripts/visual-smoke.mjs`（demo 健康）、`scripts/audit-interact.mjs`（高风险组件真实交互）、`scripts/audit-visual.mjs`（双站像素对拍）、`scripts/audit-ui.mjs`（构建后基础巡检，报告落 `.ui-audit/`）。

## CI 全景

`ci.yml`：core（tsc + guard + 覆盖率）/ pack（build + size + check:pkg）/ site-smoke / wrapper-compat-react（18/19）/ wrapper-compat-vue（3.3/3.5）并行；`e2e.yml` 独立；`publish.yml` 发版跑全门。
