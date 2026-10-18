/* 组件 CSS 全量 glob 聚合 —— Docs 布局经此处一次性引入全部组件 CSS。
 * 为什么不在 .astro frontmatter 里直接写 glob：Astro 编译器会把裸 import.meta.glob 表达式语句
 * 编译成坏标识符，独立 .ts 模块由 Vite 正常转换。
 * 纪律：手工清单模式曾漏引 cascader/tree-select/mentions/autocomplete/form-validate 五件致页面裸奔，
 * glob 让「新组件忘登记」在文档站不可能发生。层序由 tokens.css 顶部 @layer 声明锚定。 */
import.meta.glob('../../../src/components/*.css', { eager: true });
