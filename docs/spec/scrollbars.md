# 滚动条

全局使用原生滚动条，不替换滚动容器、不拦截滚轮、不模拟滑块。Chromium/WebKit 使用统一无箭头样式；Firefox 使用标准细滚动条，具体几何由浏览器和系统控制。浏览器、系统或强制颜色模式的可访问性设置可覆盖皮肤。

标准 `scrollbar-color` / `scrollbar-width` 的非 auto 值会覆盖 WebKit 伪元素皮肤，因此支持伪元素的浏览器使用 auto 值以保留无箭头规则；其余浏览器使用标准属性回退。参考 [MDN scrollbar-color](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-color) 与 [WebKit 滚动条说明](https://webkit.org/blog/363/styling-scrollbars/)。

全量引入 `@icen.ai/ui/ui.css` 即包含样式。按需引入时使用 `tokens.css` + `base.css`，再加需要的组件 CSS；`kit/scroll-area` 导出行为和容器样式，仍需上述全局底座。只引 CSS 时保持可见。启用闲置策略：

```ts
import { initScrollArea } from '@icen.ai/ui/behaviors/scroll-area';
const dispose = initScrollArea(); // 文档委托，接管之后插入的原生滚动区与 portal
// 或 initScrollArea({ root: element, idleDelay: 1200 })
// 卸载时 dispose()：移除监听、清理定时器并恢复状态属性
```

| `data-icen-scrollbars` | 滚动时 | 悬停时 | 聚焦时 | 闲置后 |
| --- | --- | --- | --- | --- |
| `auto` | 显示 | 容器悬停时显示 | 显示 | 指针离开且失焦后隐藏 |
| `scroll`（启用行为后的默认） | 显示 | 不唤醒 | 显示 | 未聚焦时隐藏 |
| `visible` | 显示 | 显示 | 显示 | 显示 |
| `hidden` | 隐藏 | 隐藏 | 隐藏 | 隐藏，仍可滚动 |

策略在子树继承，嵌套组件可另设模式。默认 scroll 下，指针停在内容区不阻止闲置隐藏；菜单等需要悬停时保持可见的区域可显式使用 auto。文档根滚动条不因整页悬停一直亮起。无溢出时浏览器不绘制滑块。闲置策略只改变颜色，不反复增减宽度，因此停止滚动时不会造成内容跳动。`hidden` 会取消滚动条占位，适合已有其他导航提示的区域。需要持续位置提示时用 visible。需要直接键盘滚动的普通容器应提供 `tabindex="0"` 和名称。

```html
<div class="icen-scroll-area" tabindex="0" aria-label="运行日志"
     data-icen-scrollbars="scroll" data-icen-scrollbar-delay="1200"
     data-icen-scrollbar-gutter="stable"
     style="max-height:20rem; --icen-token-scrollbar-size:10px">
  …
</div>
```

| 局部控制槽 | 默认 | 用途 |
| --- | --- | --- |
| `--icen-token-scrollbar-size` | 8px | 双轴尺寸；`--sm` 6px、`--lg` 12px |
| `--icen-token-scrollbar-inset` | 2px | 滑块与槽边的透明内距 |
| `--icen-token-scrollbar-track` | transparent | 轨道颜色 |
| `--icen-token-scrollbar-thumb` / `-thumb-hover` | 当前主题墨色混合 | 默认/悬停滑块颜色 |
| `--icen-token-scrollbar-idle-delay` | 900ms | 停止滚动多久后隐藏 |
| `--icen-token-scrollbar-fade-duration` | normal 动效时长 | 支持原生滑块颜色过渡的浏览器使用；其他环境直接隐藏 |
| `--icen-token-scrollbar-gutter` | auto | 原生留槽策略 |

延时优先级：最近祖先的 `data-icen-scrollbar-delay`（毫秒）→ `idleDelay` 参数 → CSS token。运行时读取当前值，修改后下一次滚动生效。非法延时回退 900ms，范围限制为 0–60000ms。留槽也可用 `data-icen-scrollbar-gutter="auto|stable|both-edges"`，与是否显示滑块独立。

减少动效时禁用颜色过渡，保留延时显示/隐藏；强制颜色模式恢复系统可见滚动条。原生控件内部、跨源 iframe 与 Shadow DOM 的封闭内部由其宿主控制；如需开放影子树内的滚动活动跟踪，应在内部容器单独初始化。
