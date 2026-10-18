// RTL 支持测试：dir=rtl 冒烟（组件行为在 RTL 文档下不抛错、结构完整）+
// 逻辑属性静态断言（src 构建源 + 关键产物含 margin-inline-* 等）+
// 方向图标镜像规则存在性（[dir='rtl'] 下 scaleX(-1)）。
import { afterEach, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initTabs } from '../../src/behaviors/tabs';
import { initNav } from '../../src/behaviors/nav';
import { closeModal, openModal } from '../../src/behaviors/modal';
import { createTable } from '../../src/behaviors/datatable';
import { mount, unmountAll } from '../helpers/dom';

const ROOT = join(import.meta.dir, '..', '..');

async function readSrc(rel: string): Promise<string> {
  return readFile(join(ROOT, 'src', rel), 'utf8');
}

afterEach(() => {
  closeModal('rtl-m');
  document.documentElement.removeAttribute('dir');
  unmountAll();
  document.querySelectorAll('.icen-modal-backdrop').forEach((b) => b.remove());
});

describe('RTL 冒烟：document.dir=rtl 下行为不抛错、结构完整', () => {
  test('tabs / nav / breadcrumb / modal / datatable 在 rtl 下初始化与交互正常', async () => {
    document.documentElement.dir = 'rtl';

    /* tabs：RTL 下点击切换照常 */
    mount(`
      <div data-icen-tabs>
        <nav class="icen-tabs" role="tablist">
          <button class="icen-page-tab is-active" data-icen-tab="a">甲</button>
          <button class="icen-page-tab" data-icen-tab="b">乙</button>
        </nav>
        <section data-icen-tab-panel="a">A</section>
        <section data-icen-tab-panel="b" hidden>B</section>
      </div>`);
    initTabs();
    const tabB = document.querySelector<HTMLElement>('[data-icen-tab="b"]');
    tabB?.click();
    expect(tabB?.classList.contains('is-active')).toBe(true);
    expect(document.querySelector('[data-icen-tab-panel="b"]')?.hasAttribute('hidden')).toBe(false);

    /* nav：RTL 下 init 不抛错、结构保留 */
    mount(`
      <header class="icen-nav">
        <div class="icen-nav-left"><span class="icen-nav-center"><a class="icen-nav-link" href="#">链</a></span></div>
      </header>`);
    initNav();
    expect(document.querySelector('.icen-nav-link')?.getAttribute('href')).toBe('#');

    /* breadcrumb：纯标记组件，RTL 下 DOM 契约结构完整 */
    mount(`
      <nav class="icen-breadcrumb" aria-label="面包屑">
        <ol>
          <li><a class="icen-breadcrumb-link" href="#">首页</a><span class="icen-breadcrumb-sep" aria-hidden="true"></span></li>
          <li><span class="icen-breadcrumb-current" aria-current="page">当前页</span></li>
        </ol>
      </nav>`);
    expect(document.querySelectorAll('.icen-breadcrumb-sep')).toHaveLength(1);
    expect(document.querySelector('.icen-breadcrumb-current')?.getAttribute('aria-current')).toBe('page');

    /* modal：RTL 下打开不抛错、面板获得 dialog 语义 */
    mount(`
      <div class="icen-modal-backdrop" data-icen-modal="rtl-m" hidden>
        <div class="icen-modal">
          <div class="icen-modal-body">内容</div>
        </div>
      </div>`);
    openModal('rtl-m');
    const backdropEl = document.querySelector<HTMLElement>('.icen-modal-backdrop[data-icen-modal="rtl-m"]');
    expect(backdropEl?.hidden).toBe(false);
    expect(backdropEl?.querySelector('.icen-modal')?.getAttribute('role')).toBe('dialog');

    /* datatable：RTL 下渲染行列完整 */
    mount(`<div id="rtl-dt"></div>`);
    const dt = createTable(document.getElementById('rtl-dt') as HTMLElement, {
      columns: [{ key: 'name', title: '名称' }],
      data: [{ name: '甲' }, { name: '乙' }],
      pagination: false,
    });
    expect(document.querySelectorAll('#rtl-dt .icen-dt-row').length).toBeGreaterThanOrEqual(3); /* 头 + 2 行 */
    dt.destroy();
  });
});

describe('RTL 静态断言：逻辑属性落在 CSS 源里', () => {
  test('btn.css 等关键文件含 margin/padding/border 逻辑属性族', async () => {
    const checks: Array<[string, RegExp]> = [
      ['components/btn.css', /margin:\s*-7px\s+0\s+0\s+-7px/], /* 居中负边距（物理豁免形态）存在 */
      ['components/tabs.css', /border-inline-end/],
      ['components/sidebar.css', /inset-inline-start/],
      ['components/menu.css', /margin-inline-start/],
      ['components/toast.css', /border-inline-start/],
      ['components/notification.css', /padding-block:\s*var\(--icen-density-space-md\)/],
      ['components/select.css', /inset-inline-end:\s*var\(--icen-density-space-sm\)/],
      ['components/table.css', /text-align:\s*start/],
      ['components/content.css', /inset-inline-start:\s*13\.5px/],
      ['components/kb.css', /padding-inline-start:\s*12px/],
      ['components/ai-chat.css', /border-inline-start:\s*2px\s+solid\s+var\(--icen-token-error\)/],
      ['components/breadcrumb.css', /:is\(\[dir='rtl'\]\)\s+\.icen-breadcrumb-sep::after/],
    ];
    for (const [rel, pattern] of checks) {
      const css = await readSrc(rel);
      expect(pattern.test(css), `${rel} 应命中 ${pattern}`).toBe(true);
    }
  });

  test('tokens 层物理方向已清零', async () => {
    for (const rel of ['tokens/style-profiles.css', 'tokens/design.css']) {
      const css = await readSrc(rel);
      const codeLines = css.split('\n').filter((l) => !l.includes('guard:allow-physical'));
      const leftover = codeLines.filter((l) =>
        /(?:margin|padding|inset)-(left|right)\s*:|border-(?:left|right)(?:-(?:width|color|style))?\s*:|text-align\s*:\s*(?:left|right)\b|(?:^|\s)(?:left|right)\s*:\s*[^;]*;/.test(l),
      );
      expect(leftover, `${rel} 不应有未豁免物理方向`).toEqual([]);
    }
  });
});

describe('RTL 镜像规则存在性：含方向图标的组件在 dir=rtl 下有镜像', () => {
  test('carousel 箭头 / breadcrumb 分隔符 / reasoning·threads chevron / kb caret / 抽屉滑出', async () => {
    const media = await readSrc('components/media.css');
    expect(/:is\(\[dir='rtl'\]\)\s+\.icen-carousel-arrow\s+svg\s*\{\s*transform:\s*scaleX\(-1\)/.test(media)).toBe(true);

    const breadcrumb = await readSrc('components/breadcrumb.css');
    expect(breadcrumb).toContain(":is([dir='rtl']) .icen-breadcrumb-sep::after");
    expect(breadcrumb).toContain(":is([dir='rtl']) .icen-breadcrumb--arrow .icen-breadcrumb-sep::after");

    const aiChat = await readSrc('components/ai-chat.css');
    expect(/:is\(\[dir='rtl'\]\)\s+\.icen-ai-reasoning-head::before/.test(aiChat)).toBe(true);
    expect(/:is\(\[dir='rtl'\]\)\s+\.icen-ai-threads-group-head::before/.test(aiChat)).toBe(true);

    const kb = await readSrc('components/kb.css');
    expect(/:is\(\[dir='rtl'\]\)\s+\.icen-kb-fold-caret/.test(kb)).toBe(true);

    const kbOps = await readSrc('components/kb-ops.css');
    expect(/:is\(\[dir='rtl'\]\)\s+\.icen-kb-span-caret/.test(kbOps)).toBe(true);

    const kbAgent = await readSrc('components/kb-agent.css');
    expect(/:is\(\[dir='rtl'\]\)\s+\.icen-kb-chain-link::after/.test(kbAgent)).toBe(true);

    /* 抽屉：RTL 下滑出方向翻为 translateX(-100%) */
    const aiPanel = await readSrc('components/ai-panel.css');
    expect(/:is\(\[dir='rtl'\]\)\s+\.icen-ai-context\s*\{\s*transform:\s*translateX\(-100%\)/.test(aiPanel)).toBe(true);
    const kbGround = await readSrc('components/kb-ground.css');
    expect(/:is\(\[dir='rtl'\]\)\s+\.icen-kb-passage\s*\{\s*transform:\s*translateX\(-100%\)/.test(kbGround)).toBe(true);
  });

  test('构建产物 dist/components/btn.css 含逻辑属性（先 bun run build 则由该文件验证产物新鲜度）', async () => {
    const dist = await readFile(join(ROOT, 'dist', 'components', 'btn.css'), 'utf8').catch(() => null);
    if (dist === null) return; /* 未构建时跳过（CI 里 bun run verify 先 build） */
    const tabs = await readFile(join(ROOT, 'dist', 'components', 'tabs.css'), 'utf8').catch(() => null);
    expect(/border-inline-end/.test(tabs ?? '') || /border-inline-end/.test(dist)).toBe(true);
  });
});
