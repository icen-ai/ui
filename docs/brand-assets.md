# ICEN 站点品牌资产

ICEN UI 与冰点账户统一采用 C 形圆环＋圆点。固定使用灰绿环与赤陶圆点，深色模式对应浅色版本；切换 UI 色彩预设不改变品牌身份。

`site/public/favicon.svg` 是品牌几何、颜色的事实源。`BrandMark.astro` 直接读取此文件，用于页头、页脚、首页背景与中式原语印记；首页画布中的标记也读取同一条 SVG 路径。界面操作与状态继续使用 ICEN UI 的 20px SVG 图标系统，站点搜索也走 `iconHTML`。

发布资产包含自适应 SVG、16/32/48px ICO、180px Apple Touch 图标、192/512px 应用图标与 `site.webmanifest`。应用图标包含纸色背景与安全留白。各站独立携带相同资产，构建不依赖兄弟仓库。

修改 SVG 后，在 UI 仓库使用本机 Chromium 重新生成，并同步到账户站：

```sh
bun scripts/brand-assets.mjs --accounts ../accounts
```

仅生成 UI 站资产时省略 `--accounts`。浏览器路径可通过 `BROWSER_EXECUTABLE` 指定；脚本不会下载浏览器。两个站的 SVG、ICO 和 PNG 应逐字节一致，manifest 保留各站的应用名称。

账户站与 UI 文档站使用相同版本的 `misans` 与 `@fontsource-variable/jetbrains-mono` 字体包，全部由本域托管。账户正文、标题与弹层统一 MiSans，代码和密钥使用 JetBrains Mono；中文按 unicode-range 分片加载。组件库本身不附带字体依赖。

2026-11-16 本地验证：文档站 138 页构建通过；61 项浏览器检查通过，包含首页、图标文档、主题页、原语工作室的 1440/390/320px 布局、六套真实配色 × 四种原语 × 明暗模式的品牌颜色、两站二进制资产一致性与深色 SVG 网站图标。账户站另通过 83 项界面检查与 80 项测试。一次性检查脚本与截图保存在 `~/.agents/tests/20261116/`。
