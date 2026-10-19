// safeUrl 协议守卫 + 全部不可信 URL 槽位的对抗语料回归（SECURITY.md「安全设计要点」对应条目）。
// 语料逐条 pin 语义：绕过尝试必须拒绝（或在浏览器侧本就惰性、注释写明依据），合法输入必须放行。
// 发现新绕过的流程：先往 REJECT_CORPUS 加复现条目（红），再修 src/behaviors/url-safety.ts（绿）；
// 新开的 href/src 槽位（模型输出 / 知识库元数据 / 宿主透传 → DOM）在下方槽位套件补对应断言。
import { describe, expect, test } from 'bun:test';
import { safeUrl } from '../../src/behaviors/url-safety';
import { renderAiMessage } from '../../src/behaviors/ai-chat';
import { renderKbExplain } from '../../src/behaviors/kb-explain';
import { createNotificationCenter } from '../../src/behaviors/notification';

interface CorpusEntry {
  uri: string;
  /** 意图注释：这条为什么必须拒绝（或为什么放行是安全的） */
  why: string;
}

/* ── 拒绝语料：可执行 / 可承载脚本的协议及其混淆变体 ── */
const REJECT_CORPUS: CorpusEntry[] = [
  { uri: 'javascript:alert(1)', why: '基础形态：可执行 scheme 直写' },
  { uri: 'JaVaScRiPt:alert(1)', why: '大小写混合（scheme 大小写不敏感）' },
  { uri: 'JAVASCRIPT:alert(1)', why: '全大写变体' },
  { uri: '  javascript:alert(1)', why: '前导空格：浏览器剥首尾空白后才识别 scheme' },
  { uri: '\tjavascript:alert(1)', why: '前导 tab：同上' },
  { uri: 'javascript:alert(1) \n', why: '尾随空白 + 换行' },
  { uri: 'java\tscript:alert(1)', why: '内嵌 tab：WHATWG 解析移除全部 tab——kb-explain 旧正则 ^\\s*javascript\\s*: 曾被此绕过（回归钉扎）' },
  { uri: 'java\nscript:alert(1)', why: '内嵌 LF：同上' },
  { uri: 'java\rscript:alert(1)', why: '内嵌 CR：同上' },
  { uri: '\x00javascript:alert(1)', why: 'NUL 前缀：C0 控制字符混淆' },
  { uri: '\x01javascript:alert(1)', why: 'C0 前缀：浏览器剥首尾 C0；旧正则 \\s 字符集不含 \\x01，曾绕过（回归钉扎）' },
  { uri: '\x1fjavascript:alert(1)', why: 'C0 上界' },
  { uri: '\x7fjavascript:alert(1)', why: 'DEL 前缀（保守拒绝：浏览器不剥 \\x7f、本就惰性，但混淆一律拒）' },
  { uri: ' \t\n\x01javascript:alert(1)', why: '混合前导控制字符与空白' },
  { uri: ' javascript:alert(1)', why: 'NBSP 前缀：浏览器不剥 NBSP（惰性），守卫 trim 后仍拒（保守方向，允许过杀）' },
  { uri: 'vbscript:msgbox(1)', why: 'VBScript 遗产 scheme（IE 已死，两边语义对齐统一拒绝）' },
  { uri: 'VbScript:x', why: 'vbscript 大小写变体' },
  { uri: 'vb\tscript:x', why: 'vbscript 内嵌 tab' },
  { uri: 'data:text/html,<script>alert(1)</script>', why: 'data:text/html 直接承载脚本标记' },
  { uri: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', why: 'data:text/html 带 base64 参数' },
  { uri: 'DATA:TEXT/HTML,x', why: 'data:text/html 大小写变体' },
  { uri: 'data: text/html,x', why: 'MIME 段前导空白（浏览器会 trim MIME type）' },
  { uri: 'data:\ttext/html,x', why: 'MIME 段 tab 混淆（tab 先被归一移除，等价上一条）' },
  { uri: 'data:text/html ,x', why: 'MIME 段尾随空白（前缀判定天然覆盖）' },
  { uri: '', why: '空串：归一后为空，无可渲染目标，按拒绝处理' },
  { uri: '   ', why: '纯空白：同上（收紧于旧 ai-chat safeHref——旧实现会放行空白串）' },
];

/* ── 放行语料：合法输入 + 浏览器侧本就惰性的形态（每条注明惰性依据） ── */
const ALLOW_CORPUS: CorpusEntry[] = [
  { uri: 'https://example.com/path?q=1#frag', why: '常规 https' },
  { uri: 'http://example.com', why: '常规 http' },
  { uri: 'https://ui.icen.ai/components/kb-explain/', why: '域名内 URL' },
  { uri: 'mailto:security@icen.ai', why: 'mailto' },
  { uri: 'tel:+8613800138000', why: 'tel' },
  { uri: '/docs/guide', why: '站内绝对路径' },
  { uri: './sibling', why: '相对路径' },
  { uri: '../up', why: '上级相对路径' },
  { uri: '#section', why: '页内锚点' },
  { uri: '?q=1', why: '纯查询串' },
  { uri: '//evil.com/x', why: '协议相对：不携带可执行 scheme，协议守卫不拦（是否允许外链是消费方策略，非协议守卫职责）' },
  { uri: 'data:image/png;base64,iVBORw0KGgo=', why: '图片 data:（消息媒体 / 头像渲染是契约功能）' },
  { uri: 'data:application/pdf;base64,JVBERi0=', why: 'PDF data:（file 部件下载是契约功能）' },
  { uri: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', why: 'SVG data:（img 上下文不执行 SVG 内脚本，惰性）' },
  { uri: 'blob:https://example.com/550e8400-e29b-41d4-a716-446655440000', why: '同源对象 URL（upload 缩略图 / datatable 导出同款形态）' },
  { uri: 'file:///etc/passwd', why: 'file: 在 web 页面上下文点击惰性（浏览器拦跨上下文导航）；协议守卫只管执行面' },
  { uri: 'ftp://example.com/f', why: '其余常规 scheme 不在拒绝面' },
  { uri: '%6Aavascript:alert(1)', why: 'percent 编码 scheme：浏览器不对 scheme 做百分号解码 → 整串按相对路径解析，惰性' },
  { uri: '%256Aavascript%3Aalert(1)', why: '双重编码：同上（%25 解一层仍是 %6A，浏览器同样不解）' },
  { uri: 'javascript&colon;alert(1)', why: 'HTML 实体：库渲染走 DOM 属性赋值（a.href=…），不存在实体解码环节 → 惰性（依赖 innerHTML 禁令纪律）' },
  { uri: '&#106;avascript:alert(1)', why: '数字字符引用：同上' },
  { uri: 'ｊavascript:alert(1)', why: '全角首字母（U+FF4A）：WHATWG scheme 首字符必须 ASCII alpha → 按相对路径惰性' },
  { uri: 'ｊａｖａｓｃｒｉｐｔ：alert(1)', why: '全角字母 + 全角冒号：同上（全角冒号不是 scheme 分隔符）' },
  { uri: 'java script:alert(1)', why: 'scheme 内嵌空格：浏览器不移除空格，scheme 非法 → 惰性' },
  { uri: 'javascript :alert(1)', why: 'scheme 尾随空格：同上（kb-explain 旧正则 \\s*: 曾拦，对齐后放行——浏览器侧本就惰性）' },
];

describe('safeUrl · 拒绝语料（绕过尝试）', () => {
  for (const { uri, why } of REJECT_CORPUS) {
    test(`拒绝 ${JSON.stringify(uri)} —— ${why}`, () => {
      expect(safeUrl(uri)).toBeUndefined();
    });
  }
});

describe('safeUrl · 放行语料（合法 / 惰性，原样返回不改写）', () => {
  for (const { uri, why } of ALLOW_CORPUS) {
    test(`放行 ${JSON.stringify(uri)} —— ${why}`, () => {
      /* 放行必须原样返回（判定归一 ≠ 改写），调用方拿到的就是输入串 */
      expect(safeUrl(uri)).toBe(uri);
    });
  }
});

/* ══ 槽位端对端：不可信输入 → DOM 的真实落点 ══ */

describe('槽位 · renderAiMessage resource-link（模型输出 → a.href）', () => {
  const linkOf = (uri: string): HTMLAnchorElement => {
    const host = document.createElement('div');
    renderAiMessage(host, { role: 'assistant', content: [{ type: 'resource-link', uri, name: '来源' }] });
    return host.querySelector<HTMLAnchorElement>('a.icen-ai-msg-link')!;
  };

  test('javascript: → 锚点不落 href，名称文本仍可见（textContent 纪律）', () => {
    const a = linkOf('javascript:alert(1)');
    expect(a.hasAttribute('href')).toBe(false);
    expect(a.textContent).toBe('来源');
  });

  test('JaVaScRiPt: / java\\tscript: 变体 → 同样不落 href', () => {
    expect(linkOf('JaVaScRiPt:alert(1)').hasAttribute('href')).toBe(false);
    expect(linkOf('java\tscript:alert(1)').hasAttribute('href')).toBe(false);
  });

  test('data:text/html → 不落 href', () => {
    expect(linkOf('data:text/html,<script>alert(1)</script>').hasAttribute('href')).toBe(false);
  });

  test('https: → href 原样落', () => {
    expect(linkOf('https://example.com/spec').getAttribute('href')).toBe('https://example.com/spec');
  });

  test('相对路径 / 锚点照常放行', () => {
    expect(linkOf('/docs/x').getAttribute('href')).toBe('/docs/x');
    expect(linkOf('#frag').getAttribute('href')).toBe('#frag');
  });
});

describe('槽位 · renderAiMessage file 下载链（safeUrl + https?/data 白名单双闸）', () => {
  const chipOf = (url: string | undefined): HTMLElement => {
    const host = document.createElement('div');
    renderAiMessage(host, { role: 'assistant', content: [{ type: 'file', url, filename: 'report.pdf' }] });
    return host;
  };
  const downloadOf = (url: string | undefined): HTMLAnchorElement | null =>
    chipOf(url).querySelector<HTMLAnchorElement>('a.icen-ai-msg-file-link');

  test('javascript: url → 不渲下载锚点，文件名 chip 仍在', () => {
    const host = chipOf('javascript:alert(1)');
    expect(host.querySelector('a.icen-ai-msg-file-link')).toBeNull();
    expect(host.querySelector('.icen-ai-msg-file')!.textContent).toContain('report.pdf');
  });

  test('data:text/html → 双闸各自都能拦（safeUrl 先拒）', () => {
    expect(downloadOf('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  test('data:application/pdf → 下载锚点保留（契约功能）', () => {
    const a = downloadOf('data:application/pdf;base64,JVBERi0=')!;
    expect(a.getAttribute('href')).toBe('data:application/pdf;base64,JVBERi0=');
  });

  test('https: → 下载锚点保留', () => {
    expect(downloadOf('https://example.com/r.pdf')!.getAttribute('href')).toBe('https://example.com/r.pdf');
  });

  test('Files API file_id（无 url）→ 本就无锚点', () => {
    expect(downloadOf(undefined)).toBeNull();
  });
});

describe('槽位 · renderAiMessage 媒体 src（image / audio / video）', () => {
  const mediaOf = (part: Record<string, unknown>): HTMLElement => {
    const host = document.createElement('div');
    renderAiMessage(host, { role: 'assistant', content: [part as never] });
    return host;
  };

  test('image url=javascript: → 部件不渲（本次补守的新收口槽位）', () => {
    expect(mediaOf({ type: 'image', url: 'javascript:alert(1)' }).querySelector('img')).toBeNull();
  });

  test('video url=data:text/html → 部件不渲', () => {
    expect(mediaOf({ type: 'video', url: 'data:text/html,x' }).querySelector('video')).toBeNull();
  });

  test('image data+mimeType=image/png → data:image src 放行', () => {
    const img = mediaOf({ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }).querySelector('img')!;
    expect(img.getAttribute('src')).toBe('data:image/png;base64,aGVsbG8=');
  });

  test('audio url=https → src 原样落', () => {
    const audio = mediaOf({ type: 'audio', url: 'https://example.com/a.mp3' }).querySelector('audio')!;
    expect(audio.getAttribute('src')).toBe('https://example.com/a.mp3');
  });
});

describe('槽位 · renderKbExplain metric ref（知识库元数据 → a.href）', () => {
  const refOf = (ref: string): HTMLAnchorElement | null => {
    const el = document.createElement('div');
    renderKbExplain(el, { metrics: [{ name: 'GMV', ref }] });
    return el.querySelector<HTMLAnchorElement>('a.icen-kb-explain-metric-ref');
  };

  test('java\\tscript: —— 旧正则实现被绕过，换 safeUrl 后不渲链接（回归钉扎）', () => {
    expect(refOf('java\tscript:alert(1)')).toBeNull();
  });

  test('\\x01javascript: —— 同上（C0 前缀回归）', () => {
    expect(refOf('\x01javascript:alert(1)')).toBeNull();
  });

  test('vbscript: / data:text/html → 不渲', () => {
    expect(refOf('vbscript:msgbox(1)')).toBeNull();
    expect(refOf('data:text/html,<script>x</script>')).toBeNull();
  });

  test('站内相对路径照常渲（含 rel=noopener）', () => {
    const a = refOf('/docs/metric#gmv')!;
    expect(a.getAttribute('href')).toBe('/docs/metric#gmv');
    expect(a.rel).toBe('noopener');
  });

  test('https 深链照常渲', () => {
    expect(refOf('https://wiki.example.com/gmv')!.getAttribute('href')).toBe('https://wiki.example.com/gmv');
  });
});

describe('槽位 · notification link / avatar（宿主透传 → a.href / img.src，本次补守）', () => {
  test('link=javascript: → 链接整条不渲（不留无 href 死链）', () => {
    const center = createNotificationCenter(document.body);
    center.push({ title: '导出完成', options: { link: 'javascript:alert(1)' } });
    expect(center.el.querySelector('a.icen-notification-link')).toBeNull();
    center.destroy();
  });

  test('link 为站内路径 → 照常渲', () => {
    const center = createNotificationCenter(document.body);
    center.push({ title: '导出完成', options: { link: '/exports/1.csv' } });
    expect(center.el.querySelector('a.icen-notification-link')!.getAttribute('href')).toBe('/exports/1.csv');
    center.destroy();
  });

  test('avatar=javascript: → 不渲 img，落 kind 图标兜底', () => {
    const center = createNotificationCenter(document.body);
    center.push({ title: '消息', options: { avatar: 'javascript:alert(1)' } });
    expect(center.el.querySelector('img.icen-notification-avatar')).toBeNull();
    /* 兜底图标槽位仍在（非空槽） */
    expect(center.el.querySelector('.icen-notification-icon')).not.toBeNull();
    center.destroy();
  });

  test('avatar=https → img 照常渲', () => {
    const center = createNotificationCenter(document.body);
    center.push({ title: '消息', options: { avatar: 'https://example.com/a.png' } });
    expect(center.el.querySelector('img.icen-notification-avatar')!.getAttribute('src')).toBe('https://example.com/a.png');
    center.destroy();
  });
});
