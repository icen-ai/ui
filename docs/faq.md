# 常见坑（FAQ）

答案全部来自真实接入踩坑记录（[dogfood.md](./dogfood.md)）。读完仍卡住 → 开 issue。

**CSS 到底引哪个？**
全量一行 `@import '@icen.ai/ui/ui.css'`（已含 tokens + base + 全部组件）。按需才引 `tokens.css` 底座 + 单引组件 CSS。两个都引不会错，但没必要。

**写了 `data-icen-theme="light"` 为什么不生效？**
明暗是二态契约：暗色 = 写 `data-icen-theme="dark"`；亮色 = **移除该属性**。没有 `"light"` 值，`initTheme` 会把它摘除。

**`file://` 双击打开页面，样式/JS 全挂。**
ES module 与 `@import` 受浏览器 CORS 限制，`file://` 直开必挂。起个静态服务器：`bunx serve` 或 `python -m http.server`。

**Astro 项目里组件样式丢了。**
kit 入口的 css import 在页面 `<script>`（client bundle）里会被摇树掉。组件 CSS 在布局 frontmatter 里引（或直接用全量 `ui.css`）。

**组件派发了什么事件、detail 长什么样？**
组件文档页的「接口」区块（由源码自动生成）；完整 detail 契约看 `dist/behaviors/events.d.mts` 的 `IcenEventMap`。

**怎么知道某组件是 Core 还是 Beta？**
文档站组件页顶部徽标；机器读 `registry.json` 的 `tiers` 字段。政策见 [versioning.md](./versioning.md)。

**升级后类名/事件名变了？**
0.x 纪律：破坏性变更只进 minor 且 CHANGELOG 逐条写明。对照 `bun run contracts:diff <旧tag> <新tag>` 的机器 diff 逐条核对。
