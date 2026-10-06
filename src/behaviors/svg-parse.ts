/**
 * @icen.ai/ui — 内联 SVG 字符串 → 消毒 SVGElement（全库单点，ai-core.svgIcon / notification / toast /
 * back-top / charts 全部经此）。SSR 安全：无 document/DOMParser 返回 null。
 *
 * 纪律：
 *  - 缺 xmlns 自动补——image/svg+xml 是 XML 严格解析，无 xmlns 的 <svg> 落在空命名空间，
 *    浏览器一律不渲染（图标作者按 HTML 习惯常省 xmlns，曾致库内 19 处图标存量隐身）；
 *  - 消毒：剥全部 on* 事件属性、剔除 script/foreignObject 子树、剔除 javascript: 协议的
 *    href/xlink:href（纵深防御）；
 *  - 只接纳 <svg> 根元素，解析失败/含 parsererror 返回 null（不猜不兜底）。
 */
export function parseSvg(source: string): SVGElement | null {
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') return null;
  const trimmed = source.trimStart();
  if (!trimmed.startsWith('<svg')) return null;
  const src = /^<svg(?![^>]*\bxmlns[=:])/i.test(trimmed)
    ? trimmed.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
    : trimmed;
  let parsed: Document;
  try {
    parsed = new DOMParser().parseFromString(src, 'image/svg+xml');
  } catch {
    return null;
  }
  const root = parsed.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) return null;

  const sanitize = (el: Element): void => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if ((name === 'href' || name === 'xlink:href') && attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'script' || tag === 'foreignobject') {
        child.remove();
        continue;
      }
      sanitize(child);
    }
  };
  sanitize(root);

  return document.importNode(root, true) as unknown as SVGElement;
}
