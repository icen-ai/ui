/* 文档行内微格式渲染 —— 组件 detail/features/notes 字段专用。
 * 支持两种标记：`code` → icen-code-inline（组件库 content.css），**强调** → <strong>。
 * 顺序：先整体 HTML 转义，再做标记替换——注册表里的文案绝不带裸 HTML 注入。 */

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function inlineMd(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code class="icen-code-inline">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
