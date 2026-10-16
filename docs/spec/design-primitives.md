# 设计原语与「本真」

本真（Benzhen）是 ICEN UI 的第一套完整设计方案。它把材料、字体、几何、密度、光影与反馈组织成同一套规则：内容安静，操作轻盈。它不宣称在主观审美上胜过某个平台；验收对象是可读性、层次、定制成本与真实交互品质。

## 启用

```css
@import '@icen.ai/ui/tokens.css';
@import '@icen.ai/ui/base.css';
@import '@icen.ai/ui/components/btn.css';
```

```html
<html lang="zh-CN" data-icen-preset="benzhen">
```

明暗继续使用 `data-icen-theme="dark"`；去掉这个属性就是亮色。支持 SSR，把属性在首屏直接写入 HTML 即可，无需客户端初始化。若产品跟随系统，在自己的首屏主题脚本中解析系统偏好。`data-icen-preset` 必须挂在 html，body portal 的菜单与弹窗才能继承同样的原语。

主题与原语是独立轴：`data-icen-preset` 选择配色主题，`data-icen-style` 选择原语。本真同时是默认主题和默认原语；像素是另一套原语。现保留本真、陶土、钢琴、艺术、梵高、墨六套主题；retro 复古主题已删除，modern / retro / terminal 原语及其特效已删除。旧偏好保留主题和明暗，原语自动迁移到本真。

## 四层结构

1. **作者种子** `--icen-design-*`：品牌色、表面、文字、几何、节奏、字体、材料参数。
2. **语义映射**：推导已有 `--icen-token-* / --icen-radius-* / --icen-density-*`，让现有组件受益。
3. **材料角色**：content / chrome / floating，共享边缘、模糊和阴影配方。
4. **组件适配**：按钮、输入、分段选择、菜单、弹窗等，处理仅靠变量无法表达的细节。

本真主题为中性瓷白＋冷蓝，独立于陶土；没有复用陶土的配色。

代码真相：`src/tokens/themes.json` 是全部主题的明暗配色与材料参数，`colors.css` 是生成的语义映射；`src/tokens/design.css` 是原语的几何与光影配方；`src/components/material.css` 是材料与组件规则；`src/behaviors/design.ts` 是可选的品牌编译 API。材料规则随 tokens.css 进入 icen.components layer，单组件按需引入同样成立，不要求导入全量 ui.css。不写属性时也默认使用本真。

## 材料

```html
<article data-icen-material="content">正文、表格、表单</article>
<nav data-icen-material="chrome">导航和工具栏</nav>
<aside data-icen-material="floating">临时操作</aside>
```

| 角色 | 背景 | 光与影 | 用途 |
| --- | --- | --- | --- |
| content | 不透明 | 轻边界，不投影 | 阅读与编辑 |
| chrome | 条件启用透光 | 顶部微光 | 导航与操作 |
| floating | 条件启用透光 | 接触影＋环境影＋顶部微光 | 临时面板 |

布局、定位和内边距归业务页面。材料不携带固定宽高，不强行让所有内容成为卡片。`data-icen-material` 的通用外轮廓使用 lg 圆角；需要贴边的站栏可由布局覆盖。

透明度只在支持 backdrop-filter 的浏览器中启用，否则自动使用不透明表面。`prefers-reduced-transparency: reduce` 与 `<html data-icen-transparency="reduced">` 都强制不透明。透明表面的实际对比度依赖背后内容，仍需实屏验证。

## 修改与新增品牌

简单微调只写 CSS，消费方无 layer 的样式优先于库：

```css
:root[data-icen-preset="benzhen"] {
  --icen-design-radius: 12px;
  --icen-design-glass-blur: 16px;
}
```

任何合法的新名字都可以复用配方。它默认继承本真种子；独立品牌建议提供完整明暗文字与表面色，并按需求替换语义色。

```css
:root[data-icen-preset="my-brand"] {
  --icen-design-accent: #244f87;
  --icen-design-accent-strong: #244f87;
  --icen-design-accent-text: #244f87;
  --icen-design-on-accent: #ffffff;
  --icen-design-radius: 12px;
}
:root[data-icen-preset="my-brand"][data-icen-theme="dark"] {
  --icen-design-accent: #aac9f1;
  --icen-design-accent-strong: #aac9f1;
  --icen-design-accent-text: #aac9f1;
  --icen-design-on-accent: #18283f;
}
```

更完整的品牌可以用可选 API 编译 CSS，适用于构建时、SSR 或浏览器。它要求两套明暗基础色，验证正文/辅助文字/链接在 canvas 与 surface 上、按钮标签在 accent 上都至少达到 4.5:1。颜色接受不透明的六位 hex，避免无法确定合成背景的对比度估计。

```ts
import { createDesign, mountDesign, setDesign } from '@icen.ai/ui/behaviors/design';

const brand = createDesign({
  name: 'my-brand', radius: 12, space: 4, controlHeight: 40,
  fontSize: 14, glassOpacity: 86, glassBlur: 18,
  light: {
    canvas: '#f5f6f8', surface: '#ffffff',
    ink: '#202124', muted: '#616671',
    accent: '#244f87', onAccent: '#ffffff',
  },
  dark: {
    canvas: '#15171b', surface: '#25282e',
    ink: '#f2f4f7', muted: '#aeb5c2',
    accent: '#aac9f1', onAccent: '#18283f',
  },
});

// 构建时：把 brand.cssText 写入自己的品牌样式表。
// 浏览器：也可动态挂载，支持可选 CSP nonce；卸载函数只移除这份样式。
const unmount = mountDesign(brand);
setDesign(brand.name);
// 恢复本真主题：setDesign(null); unmount();
```

`createDesign` 不自动改写作者颜色；对比度不够时抛错。工作室里的颜色选择器会演示按明暗分别调节色调的做法，导出的是处理后的真实配方。`mountDesign` 的参数应来自可信作者代码；它不是用于渲染任意终端用户 CSS 的安全沙箱。CSP 不允许内联样式时使用静态 CSS；需要内联时可传 `mountDesign(brand, nonce)`。

## 作者旋钮

| 名称（均以 --icen-design- 开头） | 本真亮 / 暗默认 | 意义 |
| --- | --- | --- |
| canvas / surface | #f5f6f8 / #fff；#15171b / #25282e | 页面与内容面 |
| ink / muted | #202124 / #616671；#f2f4f7 / #aeb5c2 | 正文与辅助字 |
| accent / on-accent | #0062cc / #fff；#89b9ff / #10223c | 动作与按钮文字 |
| success / warning / error / info | 明暗各有独立值，见源码 | 语义色 |
| radius | 10px | 六档轮廓的共同起点 |
| space | 4px | 布局节奏单位 |
| control-height | 40px | 标准操作高度 |
| font-size / font | 14px / 系统无衬线 | 界面阅读基准 |
| glass-opacity / glass-blur | 82% / 20px；88% / 20px | 操作层材料 |
| shadow-color / shadow-strength | 中性灰 11%；黑 28% | 接触影与环境影 |
| light / highlight-strength | 白 70%；白 9% | 表面边缘光 |
| edge-strength | 12% / 14% | 材料边界 |
| motion | 1 | 动效比例，0 为静止 |

CSS 作者可以直接覆盖全部种子；类型 API 暴露常用旋钮，并对数值范围进行检查。需要新材料配方时，用自有 data 属性消费既有语义 token，或扩展材料文件中的角色；无需复制每个组件。

## 本真的具体判断

- **文字**：界面系统无衬线；代码单独等宽；数据才使用 tabular-nums。取消全局 Numeric Math 混排。正文阅读可在业务排版中提高到 16px。
- **几何**：xs/sm/md/lg/xl 从共同控件半径推导；贴合内外轮廓同心，独立控件保留自身半径。分段选择内角扣掉外壳 padding 与边框。
- **密度**：normal / compact / comfortable 改变间距和控件高度，不缩小文字；嵌套密度可恢复 normal。触摸环境控件至少 44px。
- **反馈**：hover 以中性变化为主，主要动作用品牌色；键盘焦点始终明确。按压轻缩放，减少位置漂移。
- **选择**：分段选择使用中性表面和接触影，不把每次选择都变成品牌强调。
- **光照**：暗色保留遮挡阴影，降低高光并重新设置边缘，避免照搬亮色投影。
- **降级**：不支持 backdrop-filter、减少透明、减少动效、高对比度模式都有明确路径。

## 验收与边界

工作室 `/benzhen/` 使用库的真实 CSS 与行为，不是图片。三个场景覆盖资料保存、开关、资料搜索、新建笔记、菜单 portal、弹窗和本地对话反馈；不连接真实账户或 AI 服务。配方编译 API、DOM 生命周期与浏览器用例见 `tests/{unit,dom}/design.test.ts` 和 `tests/e2e/design.pw.ts`。

框架、用户字体和背后内容可能改变最终阅读效果；品牌作者仍应在目标系统与复杂背景中检查。任何“极其优雅”或“胜过 Apple”的判断都需要人的实际使用评审，本实现不以测试通过冒充审美结论。

## 像素原语

`<html data-icen-preset="benzhen" data-icen-style="pixel">`。顶部原语菜单可独立切换本真／像素。

像素采用 4px 网格、12px 原生中英文点阵、24/36/48px 标题、直角、2px 轮廓、2/4/8px 阶梯投影、机械按压和局部排线。内容与浮层都不透明，所有颜色继承当前主题；不附加 CRT 扫描线或闪烁。代码见 `src/tokens/pixel.css`，适配见 material.css。Fusion Pixel Font 按 OFL 1.1 本地分发，版本、校验和与上游许可证见 `src/fonts/README.md`。

运行时使用 `setPrimitive("pixel")`；自建原语先 `registerPrimitive("brand-shape")`，再用 `[data-icen-style="brand-shape"]` 覆盖几何、字体、光影参数。主题仍单独由 setTheme({preset:...}) 选择。

Apple 研究参考：[Materials](https://developer.apple.com/design/human-interface-guidelines/materials)、[Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)。本真实现以内容／操作分层、同心几何、文字可读性为准则；Web 材料不是系统 Liquid Glass 的光学模拟。

## 六套主题的校准

| 主题 | 日间 | 夜间 | 材料取向 |
| --- | --- | --- | --- |
| 本真 | 瓷白、清晰冷蓝 | 冷调石墨、浅蓝动作 | 清透、柔光，弱化边框 |
| 陶土 | 暖纸、陶红与棕墨 | 深陶棕、杏色动作 | 更厚、更不透明，漫射投影 |
| 钢琴 | 象牙白、乌木字、克制金棕 | 黑漆、香槟金 | 清晰边缘与细薄反光 |
| 艺术 | 画廊白、朱红锚点 | 中性炭灰、珊瑚红 | 低投影、稳定背景 |
| 梵高 | 麦色画布、钴蓝动作 | 深蓝、星光金 | 保留暖冷对照，控制大面积饱和度 |
| 墨 | 青灰纸、深松墨 | 墨绿、浅青玉 | 低反光、实色与安静留白 |

每套显式配置 bg / surface / raised 三层，正文／辅助／次要文字、文字强调和四类语义色在三层均验证 4.5:1；按钮另验 accentStrong × onAccent。图形强调、按钮填充、文字强调分别配置，使用原语或更换主题不会混淆其职责。

原始目录可通过 `@icen.ai/ui/tokens/themes.json` 读取。编辑本仓库主题先改目录，再运行 `bun run colors`；CSS 构建和 DTCG 导出也会确保生成文件新鲜。自定义品牌 API 会自动补齐强调色三个角色，手写 CSS 时应明确同时配置这三档。

## 操作符号与显隐节奏

界面图标采用同一套原创 SVG 光学网格。DOM、SSR 和 CSS mask 读取同一份路径，避免图标字体受平台字形、基线和字重影响。共享入口：

```ts
import { createIcon, iconHTML } from '@icen.ai/ui/kit/icon';
button.append(createIcon('close')); // button 自己提供 aria-label
const html = iconHTML('check', { size: 16, label: '已完成' });
```

次要操作占用稳定的命中槽位，通过 opacity 和轻微缩放出现；不会推开内容。键盘 focus-within 与 hover 等价，触屏没有 hover 时持续可见。主要入口与关键状态持续可见。多动作控件分别保留展开和清除槽位，不能通过重复末端 padding 把图标挤入文字区。级联面板按列扩展并限制在视口内，内部滚动不得带动文档。

图形保持克制、可辨认和对齐；参考 [Apple 的按钮设计指引](https://developer.apple.com/design/human-interface-guidelines/buttons) 中关于跨尺寸一致性的原则。具体 SVG 路径是本库自己的绘制，不依赖平台字体。
