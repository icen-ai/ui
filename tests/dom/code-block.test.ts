// code-block 行为 DOM 测试：renderCodeBlock 渲染契约 / shiki HTML 归一 / diff 分类 /
// 折叠阈值 / initCodeBlock 委托（行号·换行·折叠·复制）。
// DOM 契约：src/components/code-block.css 头注释 + behaviors/code-block.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import { renderCodeBlock, initCodeBlock } from '../../src/behaviors/code-block';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, unmountAll } from '../helpers/dom';

const TS_CODE = 'const a = 1;\nconst b = 2;\nconst c = 3;';

function render(opts: Parameters<typeof renderCodeBlock>[1]): HTMLElement {
  const host = mount('<div id="cb"></div>');
  const el = host.querySelector<HTMLElement>('#cb');
  if (!el) throw new Error('挂载失败');
  renderCodeBlock(el, opts);
  return el.querySelector<HTMLElement>('.icen-code-block') ?? el;
}

afterEach(() => unmountAll());

describe('renderCodeBlock · 纯文本路径', () => {
  test('结构：figure/head/徽标/工具钮/逐行 span', () => {
    const fig = render({ code: TS_CODE, lang: 'ts', file: 'src/a.ts', title: '示例' });
    expect(fig.tagName).toBe('FIGURE');
    expect(fig.classList.contains('icen-code-block')).toBe(true);
    expect(fig.querySelector('.icen-code-block-file')?.textContent).toBe('src/a.ts');
    expect(fig.querySelector('.icen-code-block-title')?.textContent).toBe('示例');
    expect(fig.querySelector('.icen-code-block-lang')).toBeNull(); /* file 优先，lang 徽标不渲染 */
    const lines = fig.querySelectorAll('.icen-code-block-line');
    expect(lines.length).toBe(3);
    expect(lines[0]?.textContent).toBe('const a = 1;');
    expect(fig.querySelector('[data-icen-code-block-num]')).toBeTruthy();
    expect(fig.querySelector('[data-icen-code-block-wrap]')).toBeTruthy();
    expect(fig.querySelector('[data-icen-code-block-copy]')).toBeTruthy();
    expect(fig.querySelector('[data-icen-code-block-fold]')).toBeNull(); /* 3 行不折叠 */
  });

  test('lang 无 file 时渲染语言徽标；shell 族换终端图标（svg 存在即过）', () => {
    const fig = render({ code: 'bun run dev', lang: 'bash' });
    expect(fig.querySelector('.icen-code-block-lang')?.textContent).toBe('bash');
    expect(fig.querySelector('.icen-code-block-icon svg')).toBeTruthy();
  });

  test('XSS 面：code 中的标记进 textContent，不产生元素', () => {
    const fig = render({ code: '<script>alert(1)<\/script>\n<img src=x onerror=1>' });
    expect(fig.querySelectorAll('script').length).toBe(0);
    expect(fig.querySelectorAll('img').length).toBe(0);
    expect(fig.querySelectorAll('.icen-code-block-line')[1]?.textContent).toBe('<img src=x onerror=1>');
  });

  test('默认隐藏行号（--nonum）；num: true 显示', () => {
    expect(render({ code: TS_CODE, lang: 'ts' }).classList.contains('icen-code-block--nonum')).toBe(true);
    const shown = render({ code: TS_CODE, lang: 'ts', num: true });
    expect(shown.classList.contains('icen-code-block--nonum')).toBe(false);
    expect(shown.querySelector('[data-icen-code-block-num]')?.getAttribute('aria-pressed')).toBe('true');
  });

  test('高亮行 lines: [2] 命中第 2 行', () => {
    const fig = render({ code: TS_CODE, lines: [2] });
    const lines = [...fig.querySelectorAll('.icen-code-block-line')];
    expect(lines[0]?.classList.contains('icen-code-block-line--hl')).toBe(false);
    expect(lines[1]?.classList.contains('icen-code-block-line--hl')).toBe(true);
  });
});

describe('renderCodeBlock · shiki HTML 槽位', () => {
  const SHIKI_HTML =
    '<pre class="shiki github-light" style="background-color:#fff;--shiki-dark-bg:#0d1117;--shiki-dark:#e6edf3">' +
    '<code><span class="line"><span style="color:#1f1e1c;--shiki-dark:#e6edf3">const a = 1;</span></span>' +
    '<span class="line">const b = 2;</span></code></pre>';

  test('采用外部 pre：剥内联背景、打双主题钩子、.line 归一', () => {
    const fig = render({ html: SHIKI_HTML, lang: 'ts' });
    const pre = fig.querySelector('pre');
    expect(pre?.className).toContain('shiki'); /* shiki 原 pre 被原位采用 */
    expect(pre?.hasAttribute('data-icen-dual-theme')).toBe(true);
    expect(pre?.getAttribute('style')?.includes('background-color')).toBe(false);
    expect(fig.querySelectorAll('.icen-code-block-line').length).toBe(2);
    expect(fig.querySelectorAll('.line').length).toBe(0); /* 旧类已移除 */
    expect(pre?.querySelector('span[style]')?.getAttribute('style')?.includes('--shiki-dark')).toBe(true); /* token 色保留 */
  });

  test('裸片段（无 pre）包进自建 pre>code', () => {
    const fig = render({ html: '<span class="line">a</span><span class="line">b</span>' });
    const pre = fig.querySelector('pre');
    expect(pre?.querySelector('code')).toBeTruthy();
    expect(fig.querySelectorAll('.icen-code-block-line').length).toBe(2);
  });

  test('行间空白文本节点剥除（white-space: pre 下 \\n 会渲染成空行、行距翻倍）', () => {
    const fig = render({
      html: '<pre><code><span class="line">a</span>\n<span class="line"><span style="color:#f00">const</span> <span style="color:#00f">b</span></span>\n<span class="line">c</span></code></pre>',
    });
    const code = fig.querySelector('code')!;
    const blanks = [...code.childNodes].filter(
      (n) => n.nodeType === 3 && !(n.textContent ?? '').trim(),
    );
    expect(blanks.length).toBe(0); /* 行间 \n 已清除 */
    /* 行内 token 之间的空格文本保留 */
    const line2 = code.querySelectorAll('.icen-code-block-line')[1]!;
    const space = [...line2.childNodes].some((n) => n.nodeType === 3 && n.textContent === ' ');
    expect(space).toBe(true);
  });
});

describe('renderCodeBlock · diff 模式', () => {
  const DIFF = '@@ -1,2 +1,2 @@\n-const old = 1;\n+const next = 2;\n context line';

  test('行分类 + counter-set + 默认显示行号', () => {
    const fig = render({ code: DIFF, lang: 'diff' });
    expect(fig.classList.contains('icen-code-block--diff')).toBe(true);
    expect(fig.classList.contains('icen-code-block--nonum')).toBe(false); /* diff 默认带行号 */
    const lines = [...fig.querySelectorAll('.icen-code-block-line')];
    expect(lines[0]?.classList.contains('icen-code-block-line--meta')).toBe(true);
    expect(lines[1]?.classList.contains('icen-code-block-line--del')).toBe(true);
    expect(lines[1]?.style.getPropertyValue('counter-set')).toContain('icen-cb-dl-o');
    expect(lines[2]?.classList.contains('icen-code-block-line--add')).toBe(true);
    expect(lines[2]?.style.getPropertyValue('counter-set')).toContain('icen-cb-dl-n');
    expect(lines[3]?.classList.contains('icen-code-block-line--ctx')).toBe(true);
  });
});

describe('renderCodeBlock · 折叠', () => {
  function many(n: number): string {
    return Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');
  }

  test('超过 30 行自动折叠：is-folded + 折叠钮 + 展开条（共 N 行）', () => {
    const fig = render({ code: many(42), lang: 'ts' });
    expect(fig.classList.contains('is-folded')).toBe(true);
    expect(fig.querySelector('[data-icen-code-block-fold]')?.getAttribute('aria-expanded')).toBe('false');
    const tail = fig.querySelector('.icen-code-block-tail');
    expect(tail).toBeTruthy();
    expect(fig.querySelector('.icen-code-block-count')?.textContent).toBe('共 42 行');
  });

  test('fold: false 永不折叠；fold: 数字阈值', () => {
    expect(render({ code: many(42), fold: false }).classList.contains('is-folded')).toBe(false);
    expect(render({ code: many(6), fold: 5 }).classList.contains('is-folded')).toBe(true);
    expect(render({ code: many(6), fold: 10 }).classList.contains('is-folded')).toBe(false);
  });

  test('行号 gutter 定档：≥3 位数设 --cb-gutter（含 diff 行号）；两位数不设', () => {
    expect(render({ code: many(101), lang: 'ts' }).style.getPropertyValue('--cb-gutter')).toBe('3ch');
    expect(render({ code: many(42), lang: 'ts' }).style.getPropertyValue('--cb-gutter')).toBe('');
    /* diff 计数跨百（hunk 起点高）同样定档 */
    const diff = render({ code: '@@ -120,3 +120,3 @@\n ctx\n-old\n+new', lang: 'diff' });
    expect(diff.style.getPropertyValue('--cb-gutter')).toBe('3ch');
  });
});

describe('initCodeBlock · 委托交互', () => {
  test('幂等：重复 init 只派一次 toggle', () => {
    const toggles: unknown[] = [];
    onIcen('icen:code-block-toggle', (e) => toggles.push(e.detail));
    const fig = render({ code: TS_CODE, lang: 'ts', num: true });
    initCodeBlock(fig.parentElement!);
    initCodeBlock(fig.parentElement!);
    fire(fig.querySelector('[data-icen-code-block-num]')!, 'click');
    expect(toggles.length).toBe(1);
  });

  test('行号切换：--nonum 翻转 + aria-pressed + tooltip 文案 + 事件值', () => {
    const seen: Array<{ action: string; value: boolean }> = [];
    onIcen('icen:code-block-toggle', (e) => seen.push(e.detail));
    const fig = render({ code: TS_CODE, lang: 'ts', num: true });
    initCodeBlock(fig.parentElement!);
    const btn = fig.querySelector<HTMLElement>('[data-icen-code-block-num]')!;
    fire(btn, 'click');
    expect(fig.classList.contains('icen-code-block--nonum')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('data-icen-tooltip')).toBe('显示行号');
    expect(seen.at(-1)).toEqual({ el: fig, action: 'num', value: false });
    fire(btn, 'click');
    expect(fig.classList.contains('icen-code-block--nonum')).toBe(false);
    expect(seen.at(-1)?.value).toBe(true);
  });

  test('换行切换：--wrap + aria-pressed', () => {
    const fig = render({ code: TS_CODE, lang: 'ts' });
    initCodeBlock(fig.parentElement!);
    const btn = fig.querySelector<HTMLElement>('[data-icen-code-block-wrap]')!;
    fire(btn, 'click');
    expect(fig.classList.contains('icen-code-block--wrap')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  test('点击展开条展开（reduced-motion 直接落位）', () => {
    const fig = render({ code: Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n'), lang: 'ts' });
    /* 桩 matchMedia 为 reduced（happy-dom 的 MediaQueryList.matches 只读，整体替换） */
    const originalMM = window.matchMedia;
    const stub = (): MediaQueryList =>
      ({ matches: true }) as unknown as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: stub });
    try {
      initCodeBlock(fig.parentElement!);
      fire(fig.querySelector('.icen-code-block-tail')!, 'click');
      expect(fig.classList.contains('is-folded')).toBe(false);
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMM });
    }
  });

  test('复制：clipboard 成功 → .is-done + icen:copy-success；失败 → icen:copy-error', async () => {
    const fig = render({ code: TS_CODE, lang: 'ts' });
    const nav = navigator as Navigator & { clipboard?: Clipboard };
    const original = Object.getOwnPropertyDescriptor(nav, 'clipboard');
    let calls = 0;
    Object.defineProperty(nav, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { calls += 1; if (calls === 1) throw new Error('denied'); return text; } },
    });
    const events: string[] = [];
    onIcen('icen:copy-error', () => events.push('error'));
    onIcen('icen:copy-success', () => events.push('success'));
    initCodeBlock(fig.parentElement!);
    const btn = fig.querySelector<HTMLElement>('[data-icen-code-block-copy]')!;
    fire(btn, 'click');
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toEqual(['error']); /* 第一次抛错（execCommand 回退在 happy-dom 也失败） */
    fire(btn, 'click');
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toEqual(['error', 'success']);
    expect(btn.classList.contains('is-done')).toBe(true);
    expect(calls).toBe(2);
    /* 还原 clipboard 桩 */
    if (original) Object.defineProperty(nav, 'clipboard', original);
    else delete (nav as { clipboard?: unknown }).clipboard;
  });

  test('销毁后可重新 init（返回的 destroy 摘除委托；scoped root 隔离 document 级委托）', () => {
    const seen: unknown[] = [];
    onIcen('icen:code-block-toggle', (e) => seen.push(e.detail));
    const fig = render({ code: TS_CODE, lang: 'ts' });
    const scope = fig.parentElement as ParentNode; /* 挂载容器（#cb）作 scoped root */
    const destroy = initCodeBlock(scope);
    destroy();
    fire(fig.querySelector('[data-icen-code-block-num]')!, 'click');
    expect(seen.length).toBe(0);
    initCodeBlock(scope);
    fire(fig.querySelector('[data-icen-code-block-num]')!, 'click');
    expect(seen.length).toBe(1);
  });
});
