// codeBlockHTML（SSR 字符串渲染器）契约测试：与 renderCodeBlock 同构的标记输出。
// 纯字符串（无 DOM）；diff 分类 / 转义 / shiki 采纳 / gutter 定档 / 折叠。
import { describe, expect, test } from 'bun:test';
import { codeBlockHTML } from '../../src/behaviors/code-block';

const TS_CODE = 'const a = 1;\nconst b = 2;';

describe('codeBlockHTML · 纯文本路径', () => {
  test('结构：figure/head/徽标/四类钮位/pre 逐行 span', () => {
    const html = codeBlockHTML({ code: TS_CODE, lang: 'ts', file: 'src/a.ts', title: '示例', num: true });
    expect(html.startsWith('<figure class="icen-code-block"')).toBe(true);
    expect(html).toContain('<span class="icen-code-block-file">src/a.ts</span>');
    expect(html).toContain('<span class="icen-code-block-title">示例</span>');
    expect(html).toContain('data-icen-code-block-num');
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBeGreaterThanOrEqual(1); /* num 显示态 */
    expect(html).toContain('data-icen-code-block-wrap');
    expect(html).toContain('data-icen-code-block-copy');
    expect((html.match(/class="icen-code-block-line"/g) ?? []).length).toBe(2);
    expect(html).not.toContain('data-icen-code-block-fold'); /* 2 行不折叠 */
  });

  test('转义：code 与 title 中的标记原样转义', () => {
    const html = codeBlockHTML({ code: '<b>&"x"</b>', lang: 'ts', title: '<t>' });
    expect(html).toContain('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
    expect(html).toContain('<span class="icen-code-block-title">&lt;t&gt;</span>');
    expect(html).not.toContain('<b>');
  });

  test('默认隐藏行号（--nonum）；wrap 上初始态', () => {
    expect(codeBlockHTML({ code: TS_CODE, lang: 'ts' })).toContain('icen-code-block--nonum');
    const wrapped = codeBlockHTML({ code: TS_CODE, lang: 'ts', wrap: true });
    expect(wrapped).toContain('icen-code-block--wrap');
    expect(wrapped).toContain('aria-pressed="true"');
  });

  test('diff：行分类 + counter-set + 默认行号 + 高亮行', () => {
    const html = codeBlockHTML({ code: '@@ -1,2 +1,2 @@\n-old\n+new\n ctx', lang: 'diff', lines: [3] });
    expect(html).toContain('icen-code-block--diff');
    expect(html).not.toContain('icen-code-block--nonum');
    expect(html).toContain('icen-code-block-line--meta');
    expect(html).toContain('counter-set: icen-cb-dl-o 1');
    expect(html).toContain('counter-set: icen-cb-dl-n 2');
    expect(html).toContain('icen-code-block-line--add icen-code-block-line--hl'); /* 第 3 行命中高亮 */
  });

  test('折叠：阈值 / 强制 / 永不 + 展开条', () => {
    const many = Array.from({ length: 42 }, (_, i) => `l${i + 1}`).join('\n');
    const folded = codeBlockHTML({ code: many, lang: 'ts' });
    expect(folded).toContain('is-folded');
    expect(folded).toContain('data-icen-code-block-fold');
    expect(folded).toContain('aria-expanded="false"');
    expect(folded).toContain('<span class="icen-code-block-count">共 42 行</span>');
    expect(folded).toContain('class="icen-code-block-tail"');
    expect(codeBlockHTML({ code: many, lang: 'ts', fold: false })).not.toContain('is-folded');
    expect(codeBlockHTML({ code: 'x', lang: 'ts', fold: true })).toContain('is-folded');
  });

  test('gutter 定档：≥3 位数写 --cb-gutter', () => {
    const big = Array.from({ length: 101 }, (_, i) => `l${i + 1}`).join('\n');
    expect(codeBlockHTML({ code: big, lang: 'ts' })).toContain('style="--cb-gutter: 3ch"');
    expect(codeBlockHTML({ code: TS_CODE, lang: 'ts' })).not.toContain('--cb-gutter');
  });
});

describe('codeBlockHTML · shiki HTML 槽位', () => {
  const SHIKI =
    '<pre class="shiki github-light" style="background-color:#fff;--shiki-dark-bg:#0d1117;--shiki-dark:#eee">' +
    '<code><span class="line"><span style="color:#cf222e;--shiki-dark:#ff7b72">const</span> a = 1;</span>' +
    '<span class="line">const b = 2;</span></code></pre>';

  test('采纳外部 pre：剥背景 / 双主题钩子 / .line 归一 / lines 高亮', () => {
    const html = codeBlockHTML({ html: SHIKI, lang: 'ts', lines: [2], num: true });
    expect(html).toContain('data-icen-dual-theme');
    expect(html).toContain('style="--shiki-dark:#eee"'); /* 非背景声明保留 */
    expect(html).not.toContain('background-color');
    expect(html).not.toContain('--shiki-dark-bg'); /* 背景族声明剥除 */
    expect((html.match(/class="icen-code-block-line"/g) ?? []).length).toBe(1);
    expect(html).toContain('class="icen-code-block-line icen-code-block-line--hl"');
  });

  test('裸片段包自建 pre', () => {
    const html = codeBlockHTML({ html: '<span class="line">a</span>' });
    expect(html).toContain('tabindex="0" role="region" aria-label="代码内容"');
    expect(html).toContain('<code><span class="icen-code-block-line">a</span></code></pre>');
  });

  test('行间换行空白剥除（white-space: pre 下会渲染成空行、行距翻倍）', () => {
    /* shiki 输出形态：行 span 之间带 \n */
    const withNl = '<pre><code><span class="line">a</span>\n<span class="line">b</span>\n<span class="line">c</span></code></pre>';
    const html = codeBlockHTML({ html: withNl });
    expect(html).toContain('</span><span class="icen-code-block-line">c</span>');
    expect(html).not.toMatch(/<\/span>\s*\n\s*<span/);
    /* 行内 token 之间的空格文本不动 */
    const tokens = '<pre><code><span class="line"><span style="color:#f00">const</span> <span style="color:#00f">a</span></span></code></pre>';
    expect(codeBlockHTML({ html: tokens })).toContain('</span> <span style="color:#00f">a</span>');
    /* code 路径同样不加行间空白 */
    const code = codeBlockHTML({ code: 'a\nb', lang: 'ts' });
    expect(code).toContain('">a</span><span class="icen-code-block-line">');
  });
});
