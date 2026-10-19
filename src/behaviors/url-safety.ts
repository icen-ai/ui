/*
 * @icen.ai/ui — 契约: url-safety（不可信 URL 的协议守卫 · 纯函数无 DOM）
 *
 * 唯一事实源：凡不可信输入（模型输出 / 知识库元数据 / 宿主透传的用户内容）要落成
 * href / src 的槽位，一律先过 safeUrl。当前接入：ai-chat（resource-link / file 下载 /
 * image·audio·video 媒体 src）、kb-explain（metric ref 深链）、notification（link / avatar）。
 *
 * 语义（对抗语料逐条钉扎在 tests/unit/url-safety.test.ts，改语义先改语料）：
 *   拒绝：javascript: / vbscript:（含大小写变体、内嵌 tab/LF/CR、首尾 C0 控制字符与
 *         \x7f 混淆）、data:text/html（MIME 段允许前导空白）、归一后为空的输入；
 *   放行：http(s): / mailto: / tel: / 其余常规 scheme、data: 非 HTML 媒体（图片/音频/PDF
 *         下载是契约功能）、blob: / file:、相对路径、# 锚点、// 协议相对；
 *   惰性放行（浏览器侧本就不构成执行面，逐项依据写在语料注释里）：percent 编码 scheme
 *         （%6Aavascript: ——浏览器不对 scheme 做百分号解码）、HTML 实体（javascript&colon;
 *         ——DOM 属性赋值不解码实体；此结论依赖「渲染只写 textContent/属性赋值」纪律，
 *         innerHTML 禁令由 scripts/guard/behavior-discipline.ts 强制执行）、全角/Unicode
 *         变体（ｊavascript: ——WHATWG scheme 首字符必须是 ASCII alpha）。
 *
 * SSR 安全：纯函数，不触碰 document/window。
 */

/**
 * 不可信 URL → 可落成 href/src 的串；被判危险则返回 undefined（调用方跳过渲染该槽位）。
 * 归一只用于判定，返回的仍是原始 uri——浏览器解析时会做出同样的归一，不会出现
 * 「守卫看归一后、浏览器看原文」的判定分裂。
 */
export function safeUrl(uri: string): string | undefined {
  /* WHATWG URL 解析先移除全部 tab/LF/CR、剥首尾 C0 控制字符与空格，再识别 scheme；
     守卫必须在同一归一结果上判定，否则 java\tscript: / \x01javascript: 可绕过
     （kb-explain 旧正则 ^\s*(javascript|data|vbscript)\s*: 即被这两种形态绕过）。 */
  const s = uri.replace(/[\t\n\r\0-\x1f\x7f]/g, '').trim().toLowerCase();
  if (!s) return undefined; /* 空串/纯空白无可渲染目标，按拒绝处理 */
  if (s.startsWith('javascript:') || s.startsWith('vbscript:')) return undefined;
  /* data:text/html 可承载脚本标记（现代浏览器虽已拦顶层 data: 导航，纵深防御仍拒）；
     data: 其余媒体类型放行——图片/音频/PDF 的 data: 下载与媒体渲染是契约功能 */
  if (/^data:\s*text\/html/.test(s)) return undefined;
  return uri;
}
