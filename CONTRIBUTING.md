# 贡献指南

感谢考虑给 `@icen.ai/ui` 提贡献。本文件把「怎么搭环境」到「PR 怎么写才收」一次讲清；仓库内更完整的开发约定（规格唯一事实源、文档站约定等）在 [AGENTS.md](./AGENTS.md)，本文不重复抄录。

## 开发环境

- **Bun 1.3+**（仓库唯一的运行时与包管理器；CI 同款 `oven-sh/setup-bun`）。
- Node 仅个别脚本工具用到，不需要单独装。

```bash
git clone https://github.com/icen-ai/ui.git && cd ui
bun install
bun run verify    # 四道门：tsc --noEmit + guard + test + build
```

四道门全绿 = 你的改动可以进 PR。`verify` 里任何一门红了都不要先改测试预期让它过——守卫红通常意味着你违反了某条纪律，先读守卫输出的违规描述。

## 目录结构速览

```
src/tokens/*.css        # 设计 token（colors 6 预设 × 明暗 / 4 套原语 / style-profiles / typography）
src/base.css            # 元素基线 + 滚动条 + z-index 尺尺 + 6 个交互基元 + a11y 工具类
src/components/*.css    # 76 个无框架组件 CSS（每文件头注释 = 完整 DOM 契约）
src/behaviors/*.ts      # 87 个行为模块（SSR 守卫 + 幂等 init + textContent-only）
src/react/ src/vue/     # 官方薄封装（兼容契约见 docs/frameworks.md；契约测试 tests/unit/*-wrapper.test.*）
scripts/slugs.mjs       # slug 登记单一事实源（kit 入口 / CLI / 文档站都消费它）
docs/contracts/         # 稳定性分层 tiers.json + 公共契约快照 snapshot.json（守卫同源校验）
scripts/guard/          # 11 项纪律守卫源码（违规文案里写了修法）
tests/unit/ tests/dom/  # 契约测试 + 委托行为测试（bun test + happy-dom）
tests/kb-conformance.test.ts  # 权限域诚实呈现一致性套件
docs/                   # 治理文档（versioning / roadmap / acceptance / theming / frameworks / testing）
site/                   # 文档站（独立 Astro 应用，ui.icen.ai）
```

## 加组件的完整仪式

漏任何一步，CI 的守卫会替我们拦下你——但按顺序走一遍比被 CI 打回来快。

1. **写 CSS**：`src/components/<name>.css`，一个文件一个组件。**头注释必须列出完整 DOM 契约**（槽位、状态类、data 钩子）——守卫检查头注释存在与否。
2. **写 behavior**（如有交互）：`src/behaviors/<name>.ts`。铁律：函数**幂等**（重复调用安全，WeakSet/MarkedElement 标记）、提供**销毁函数**（移除监听 + 复位标记）、`typeof document === 'undefined'` **SSR 守卫**、文本只写 `textContent`。
3. **登记 slug**：`scripts/slugs.mjs` 的 `SLUGS` + 按需 `SLUG_BEHAVIOR` / `SLUG_INIT` / `SLUG_EXPORTS` / `EXTRA_CSS`。这是 kit 一行入口、CLI、`registry.json`、文档站的共同事实源，registry 守卫会核对登记名与真实导出是否一致。
4. **登记事件**：behavior 派发的自定义事件统一 `icen:` 前缀，且 detail 契约必须登记进 `IcenEventMap`（`behaviors/events.ts`）。`onIcen` / `emitIcen` 是绑定与派发的唯一入口——**禁裸写 `new CustomEvent`**，事件守卫双向核对。
5. **标注稳定性分层**：`docs/contracts/tiers.json` 给新 CSS 模块显式归类（`core` / `beta` / `lab`）。不标 = registry 守卫拦（新组件不许默认躺进 Core 的 1.0 冻结承诺）。图表 / AI / KB 族新成员一律 `beta`。
6. **契约快照留痕**：新类名 / data 钩子 / 变量 / 事件 / 导出会扩公共面——`bun run contracts:update` 更新 `docs/contracts/snapshot.json` 并随 PR 提交；**移除或改名任何既有条目 = Core 破坏性变更**，须按 docs/versioning.md 在 CHANGELOG 逐条公告（0.x 不写迁移指南，见收敛期纪律）。
7. **文档站条目**：`site/` 对应分组加一节（demo / 用法 / kit 三段齐全）；稳定性徽标自动来自 tiers.json，无需手填。纯文档站改动可以不配测试，但改组件行为必须同步文档。
8. **测试三件**：
   - `tests/unit/<name>.test.ts`——纯契约/normalize/纯函数；
   - `tests/dom/<name>.test.ts`——委托行为（mount/nextTick/fire 在 `tests/helpers/dom.ts`）；
   - `bun run guard` 全绿——你新加的类名/data 钩子/事件自然纳入 11 项守卫的扫描面，过不了就是违反了纪律，不是守卫误伤。

改 kb 族（尤其权限域）行为时，**先改 `tests/kb-conformance.test.ts` 预期**再改实现——安全纪律的测试是契约本身，不是实现细节的镜像。改 AI / KB 族另见 `docs/acceptance.md` 验收矩阵：已覆盖行不得退化。

## 纪律速查表（guard 11 项）

| 守卫 | 一句话 | 违反后怎么修 |
| --- | --- | --- |
| CSS 纪律 | 组件只消费 `--icen-token-*` 变量，禁写死 hex / z-index / keyframes / 滚动条样式 / `!important`；头注释必须存在 | 把值换成对应 token；确属语义性例外（如 print 绝对色）时进 `scripts/guard/css-discipline.ts` 的 ALLOWLIST 并写清理由 |
| token 引用闭合 | 组件引用的 `--icen-*` 变量必须在 tokens / base 有定义 | 补 token 定义或改用已有 token；主题面改动另见 docs/theming.md 兼容预算 |
| registry 一致性 | `slugs.mjs` 登记的 CSS / behavior / init / export 必须真实存在；**每个组件 CSS 必须在 `docs/contracts/tiers.json` 显式标 tier（core/beta/lab）** | 多数是登记名拼错或漏建文件——对齐 `slugs.mjs` 与 `src/` 实物；新组件去 tiers.json 归类（图表/AI/KB 新成员一律 beta） |
| 事件纪律 | 事件名 `icen:` 前缀 + 登记 `IcenEventMap` + 只经 `emitIcen` 派发；登记了就必须有字面量使用 | 补登记 / 改走 `emitIcen` / 删掉死登记；确有前瞻登记需求时进守卫的 `FORWARD_EXEMPT` 并注明落地模块 |
| 行为模块纪律 | 有 DOM 引用必有 SSR 守卫；禁 `.innerHTML =`（清空 `= ''` 除外）；禁 `dangerouslySetInnerHTML` | 加 `typeof document === 'undefined'` 守卫；改 `textContent`；图标槽位类契约进 ALLOWLIST 附理由 |
| 命名空间 | 新类名一律 `icen-` 前缀（`.is-*` 状态类只能与根类复合出现）、data 钩子 `data-icen-*`、全局变量 `--icen-*` | 改名；与业界 59 类基准撞名说明前缀缺失，不是守卫误报 |
| 权限域诚实呈现 | 禁「被裁 N 条 / 剔除 N 块」类泄露文案；`evaluateAcl` 保持纯函数（时间经 `now` 注入） | 换成与命中无关的恒定事实文案（行尾 `guard:allow-honesty 理由` 可豁免并需评审）；时间需求改走参数注入 |
| RTL 逻辑属性 | 方向敏感样式走逻辑属性（`inset-inline-start` 等）；物理属性需 `guard:allow-physical 物理语义` 注释 | 换逻辑属性；确属物理隐喻（开关滑块/时间线）加豁免注释 |
| 类名同步 | JS 里引用的 `icen-*` 类名必须与 CSS 定义同形态（防改名错位） | 对齐 JS 字符串与 CSS 选择器；迁移期类在守卫 ALLOWLIST 登记 |
| 图标纪律 | 操作与状态图形用 SVG / 同源 mask，不用 emoji 或装饰字符 | 换 `iconHTML()` 或 mask token |
| 契约快照 | 公共面（类名/data/变量/事件/导出）与 `docs/contracts/snapshot.json` 零漂移 | 扩面：`bun run contracts:update` 随 PR 提交；**移除/改名 = Core 破坏性变更**，按 docs/versioning.md 公告 |

## 命名空间契约（防冲突终态）

- 类名：`.icen-*`（唯一例外 `.is-*` 状态类，永不单独出现在选择器里，永远 `.icen-tab.is-active` 复合）。
- data 钩子：`data-icen-*`；全局 CSS 变量：`--icen-*` 十五族；组件作用域变量（`--btn-*` 等）不前缀（继承链随根类已隔离）。
- 事件：`icen:` 前缀，无例外。
- 主题层是 data 属性不是类：`data-icen-preset` / `data-icen-theme` / `data-icen-style` / `data-icen-density`。
- 全部产物 CSS 在 `@layer icen.tokens / icen.base / icen.components` 内——消费方无层样式永远赢库样式，不要写出层外的选择器。

## PR 规范

- **描述**：做了什么 + 为什么（链接相关 issue）。破坏性变更必须在描述里显式标注——0.x 纪律见 [docs/versioning.md](./docs/versioning.md)。
- **验收输出贴样**：PR 里贴 `bun run verify` 的四道门输出结尾（`✓ 全部守卫通过` + 测试计数 + build 成功行）。差一门就标 Draft，不要挂 Ready 碰 CI。
- **范围克制**：一个 PR 一件事。重命名 / 格式化 / 行为变更分开提。
- **文档同步**：改组件 = CSS 头注释 + 文档站 + 测试三处同 PR；只改 site 的 typo 可以不带测试。
- 仓库自带 `AGENTS.md`（AI 助手约定）与文档站 `llms-full.txt`——如果你预期审你 PR 的人有 AI 辅助工作流，这两份就是它们的输入。

## AI 助手友好声明

这个仓库是为「人和 AI 一起维护」设计的：

- **[AGENTS.md](./AGENTS.md)**：消费方速查 + 仓库开发约定，随 npm 包发布（`node_modules/@icen.ai/ui/AGENTS.md`）；
- **<https://ui.icen.ai/llms-full.txt>**：文档全文 + 类型面快照（构建期自动生成，单一事实源，不会漂移）；
- 类型真相在 `dist/*.d.mts`（JSDoc 含行为约束）——比任何文档都新；
- 纪律由守卫机器强制：AI 生成的代码过不了 `bun run guard`，和人类写的待遇相同。

用 AI 辅助生成贡献内容没有问题，但 PR 的责任主体是你本人——请通读并理解你提交的每一行。
