# @icen.ai/ui — Icen Design System

icen.ai 全生态的统一设计系统：**设计 tokens（6 色彩预设 × 明暗双模 × 风格配置）+ 无框架组件 CSS + 行为 JS**。工程形态与 `@icen.ai/cli` 一致（Bun + TS + tsup + ESM + MIT）。

- 色彩预设：`clay`（默认，陶土橙 × 纸白 = icen 品牌）/ `piano` / `art` / `vangogh` / `ink` / `retro`，各含 `.dark` 变体
- 风格配置：`.style-modern` / `.style-retro` / `.style-terminal`（几何/密度/动效/字体 token，与色彩正交）
- 组件：btn / panel / pill / form / tabs / stat / table / toast（全部消费 `--token-*`，框架无关）
- 行为：`theme`（预设/明暗/风格切换 + localStorage + 防闪烁语义）、`tabs`、`toast`、`copy`

## 使用

```bash
bun add @icen.ai/ui
```

```css
@import '@icen.ai/ui/tokens.css';
@import '@icen.ai/ui/ui.css';   /* tokens + base + 全部组件；也可按 ./components/btn.css 单引 */
```

```html
<html class="piano dark">       <!-- 预设类 + 可选 dark；clay 为 :root 默认 -->
```

```ts
import { initTheme, toggleDark, setTheme, initTabs, initCopy, toast } from '@icen.ai/ui';
initTheme();   // 尽早调用（或内联同步脚本防闪烁，见 accounts Base.astro）
initTabs();    // [data-tabs] > [data-tab] + [data-tab-panel] 契约
initCopy();    // .copy-btn[data-copy] 委托
toast.ok('已保存');
```

## 文档站（已上线 <https://ui.icen.ai>）

`site/` 是公开文档站（首页 / 色彩预设色板 / 组件演示，导航栏实时换肤换明暗）。部署：

```bash
cd site && bun install && bun run build
bunx wrangler pages deploy dist --project-name=icen-ui   # 需 CLOUDFLARE_ACCOUNT_ID
```

Pages 项目 `icen-ui`（aidoll 账号），自定义域 `ui.icen.ai` → CNAME `icen-ui.pages.dev`（已在 dashboard 激活）。

## 构建

```bash
bun install
bun run build   # tsup（behaviors → dist/*.mjs）+ scripts/build-css.ts（css → dist/）
```

产物：`dist/tokens.css`（三 token 文件拼合）、`dist/ui.css`（tokens+base+组件）、`dist/base.css`、`dist/tokens/*`、`dist/components/*`、`dist/behaviors/*.mjs`、`dist/index.mjs`、`dist/registry.json`。

## 目录

```
src/tokens/colors.css          # 6 预设 × 明暗（移植自 opengal 的 Icen Design System；
                               #   clay 基值已原地校准到 accounts.icen.ai 视觉）
src/tokens/style-profiles.css  # density/motion/typography + .style-*
src/tokens/typography.css      # icen canonical 字体栈（IBM Plex Mono + CJK 宋体）
src/base.css                   # 元素基线 + 无箭头细滚动条（全部消费 token）
src/components/*.css           # 8 个无框架组件
src/behaviors/*.ts             # theme / tabs / toast / copy
scripts/build-css.ts           # CSS 产物构建（拼合 + registry.json）
site/                          # 文档站骨架（ui.icen.ai，独立 Astro 应用）
```

## 消费方接入（accounts 模式）

accounts 目前以 **vendor** 方式消费：`bun run sync:ui`（accounts 仓库内）把本仓库 `dist/` 复制到 `src/styles/vendor/icen/`，布局里 import 对应 CSS/JS。npm 发布后可改为包引入。
