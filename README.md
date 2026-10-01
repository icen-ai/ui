# @icen.ai/ui — Icen Design System

icen.ai 全生态的统一设计系统：**设计 tokens（6 色彩预设 × 明暗双模 × 3 风格 profile）+ 无框架组件 CSS（51 组件）+ 行为 JS（25 behaviors）**。工程形态与 `@icen.ai/cli` 一致（Bun + TS + tsup + ESM + MIT）。

- 色彩预设：`clay`（默认，陶土橙 × 纸白 = icen 品牌）/ `piano` / `art` / `vangogh` / `ink` / `retro`，各含 `.dark` 变体
- 风格配置：`.style-modern` / `.style-retro` / `.style-terminal`（几何 / 密度 / 动效 / 字体 token，与色彩正交）
- 可选效果层：`retro-effects.css`（CRT 扫描线 / 颗粒 / 像素边框 / 打字机光标 —— 仅 `.style-retro` 激活时生效，按需 import）
- 组件：btn / form / input / select / slider / switch / tag-input / upload / modal / popover / tooltip / menu（含 dropdown + context-menu）/ tabs / nav / sidebar / breadcrumb / pagination / steps / segmented / accordion / tree / carousel / charts / table / stat / card / panel / pill / tag / badge / empty / feedback / content / media / toolbar / split-pane / date-picker / command-palette / notification / copy / scroll-area / back-top / datatable / layout（51 个组件 CSS，含 charts 基座 + 9 个细分图表）
- 行为：theme / tabs / toast / copy / input / select / slider / tag-input / upload / modal / dropdown / popover / context-menu / accordion / tree / carousel / charts / nav / sidebar / datatable / notification / back-top / command-palette / date-picker / split-pane（25 个，全部 SSR 守卫 + 幂等 init + textContent-only）

## 使用

```bash
bun add @icen.ai/ui
```

```css
@import '@icen.ai/ui/tokens.css';
@import '@icen.ai/ui/ui.css';   /* tokens + base + 全部组件；也可按 ./components/btn.css 单引 */
/* 可选：仅 .style-retro 下生效的像素效果层 */
@import '@icen.ai/ui/retro-effects.css';
```

```html
<html class="piano dark">       <!-- 预设类 + 可选 dark；clay 为 :root 默认 -->
```

```ts
import {
  initTheme, toggleDark, setTheme,
  initTabs, initCopy, initInput, initSelect, initSlider, initTagInput,
  initUpload, initModal, initDropdown, initContextMenu,
  initAccordion, initTree, initCarousel, initNav, initSidebar,
  openPopover, closePopover,
  renderLine, renderVBar,
  toast,
} from '@icen.ai/ui';

initTheme();                       // 尽早调用（或内联同步脚本防闪烁，见 accounts Base.astro）
initTabs();                        // [data-tabs] > [data-tab] + [data-tab-panel] 契约；切换派发 icen:tab-change
initCopy();                        // .copy-btn[data-copy] 委托
toast.ok('已保存');                // 或 toast.action('已删除', '撤销', undo)；类名 .toast--success 等
renderLine(el, { labels, series }); // 函数式组件（charts / datatable）：无 init，直接渲染
```

## 文档站（已上线 <https://ui.icen.ai>）

`site/` 是公开文档站（首页 / 色彩预设色板 / 组件演示，导航栏实时换肤换明暗）。部署：

```bash
cd site && bun install && bun run build
bunx wrangler pages deploy dist --project-name=icen-ui   # 需 CLOUDFLARE_ACCOUNT_ID
```

Pages 项目 `icen-ui`（aidoll 账号），自定义域 `ui.icen.ai` → CNAME `icen-ui.pages.dev`。**已接 Git 自动部署**：push 到 `main` 即由 Cloudflare 构建（根目录 `site`，命令 `bun install && bun run build`，输出 `dist`），无需 wrangler 手动部署、无需任何 token/secret。

## 构建

```bash
bun install
bun run build   # tsup（behaviors → dist/*.mjs）+ scripts/build-css.ts（css → dist/）
```

产物：`dist/tokens.css`（colors + style-profiles + typography 拼合）、`dist/ui.css`（tokens+base+组件）、`dist/base.css`、`dist/retro-effects.css`（按需）、`dist/tokens/*`、`dist/components/*`、`dist/behaviors/*.mjs`、`dist/index.mjs`、`dist/registry.json`（含 tokens/tokensExtras/base/components/behaviors 清单）。

## 目录

```
src/tokens/colors.css          # 6 预设 × 明暗（clay 基值已校准到 accounts.icen.ai 视觉）
src/tokens/style-profiles.css  # density/motion/typography + .style-modern/.retro/.terminal
                               #   retro 段选择器引用 base.css 的 .pressable/.control/.lift
src/tokens/typography.css      # icen canonical 字体栈（IBM Plex Mono + CJK 宋体）
src/tokens/retro-effects.css   # 可选效果层：CRT/扫描线/像素工具类（不进 tokens.css 拼合）
src/base.css                   # 元素基线 + 滚动条 + z-index 标尺 + 6 个交互基元
                               #   .pressable / .control / .field / .lift / .surface-elevated / .focus-ring
                               #   + a11y 工具类 .sr-only / .skip-link + 工具类 .mono/.dim/.faint/.numeric
src/components/*.css           # 51 个无框架组件 CSS
src/behaviors/*.ts             # 25 个 behaviors
scripts/build-css.ts           # CSS 产物构建（拼合 + registry.json）
site/                          # 文档站骨架（ui.icen.ai，独立 Astro 应用）
```

## 消费方接入

`@icen.ai/ui` 已发布 npm（OIDC trusted publishing，打 `v*` tag 即自动发版）。两种消费方式均可：

- **包引入（推荐）**：`bun add @icen.ai/ui`，按 `./tokens.css` / `./ui.css` / `./kit/<slug>` 引入。
- **vendor 复制**：accounts 目前走这条路——`bun run sync:ui`（accounts 仓库内）把本仓库 `dist/` 复制到 `src/styles/vendor/icen/`，布局里 import 对应 CSS/JS。适合需要锁定版本或离线构建的场景。
