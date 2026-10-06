// i18n 行为级验收：setIcenLocale(ICEN_LOCALE_EN_US) 后渲染代表性组件，
// 断言渲染结果（textContent + aria-label/title/placeholder 属性）零 CJK 字符；
// resetIcenLocale 后回中文。这是「行为层文案无遗漏进 locale」的 DOM 级证明。
// 覆盖：empty 占位（chart 空态）/ select 空态 / datatable 空态 / pagination（条/页）/
//       upload 超尺寸报错 / ai-tool 审批按钮。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  getIcenLocale,
  ICEN_LOCALE_EN_US,
  resetIcenLocale,
  setIcenLocale,
} from '../../src/behaviors/i18n';
import { renderChart } from '../../src/behaviors/charts';
import { initSelect } from '../../src/behaviors/select';
import { createTable } from '../../src/behaviors/datatable';
import { initUpload } from '../../src/behaviors/upload';
import { getAiKind, registerAiKind } from '../../src/behaviors/ai-core';
import { renderAiToolCall } from '../../src/behaviors/ai-tool';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';

const CJK = /[一-鿿]/;

/** 收集目标根下全部用户可见字符串：文本节点 + a11y/提示属性。 */
function visibleStrings(root: ParentNode): string[] {
  const out: string[] = [];
  const walk = (n: Node): void => {
    if (n.nodeType === 3) {
      const s = n.textContent ?? '';
      if (s.trim()) out.push(s);
      return;
    }
    if (n instanceof Element) {
      for (const attr of ['aria-label', 'title', 'placeholder']) {
        const v = n.getAttribute(attr);
        if (v) out.push(v);
      }
    }
    n.childNodes.forEach(walk);
  };
  walk(root);
  return out;
}

function expectNoCjk(root: ParentNode, scope: string): void {
  const hits = visibleStrings(root).filter((s) => CJK.test(s));
  expect(hits, `${scope} 应零 CJK，命中：${hits.join(' | ')}`).toEqual([]);
}

afterEach(() => {
  resetIcenLocale();
  unmountAll();
  /* select 面板 portal 到 body：脱离 mount 宿主，用例间统一清扫 */
  document.querySelectorAll('.icen-select-panel').forEach((p) => p.remove());
});

describe('en-US 下渲染零 CJK（无遗漏证明）', () => {
  test('empty 占位：chart 空数据态', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    const el = mount('<div id="c"></div>').querySelector('#c') as HTMLElement;
    const handle = renderChart(el, { type: 'line', labels: [], values: [] });
    const empty = el.querySelector('.icen-chart-empty');
    expect(empty?.textContent).toBe('No data');
    expectNoCjk(el, 'chart 空态');
    handle.destroy();
  });

  test('select 空态 + 搜索占位（面板 portal 到 body）', async () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    mount(`
      <div class="icen-select" data-icen-select data-icen-select-search>
        <button class="icen-select-trigger"><span class="icen-select-value is-empty">Pick a city</span></button>
        <div class="icen-select-panel" hidden>
          <button class="icen-select-option" data-icen-value="sh">Shanghai</button>
          <button class="icen-select-option" data-icen-value="hz">Hangzhou</button>
        </div>
      </div>`);
    initSelect();
    document.querySelector<HTMLElement>('.icen-select-trigger')!.click();
    await nextTick();
    const panel = document.querySelector<HTMLElement>('.icen-select-panel');
    expect(panel?.hidden).toBe(false);
    const search = panel?.querySelector<HTMLInputElement>('input');
    expect(search?.placeholder).toBe('Search…');
    search!.value = 'zzz';
    fire(search!, 'input');
    await nextTick();
    expect(panel?.querySelector('.icen-select-empty')?.textContent).toBe('No matches');
    expectNoCjk(panel!, 'select 面板');
  });

  test('datatable 空态', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    const el = mount('<div id="dt"></div>').querySelector('#dt') as HTMLElement;
    const handle = createTable(el, { columns: [{ key: 'name', title: 'Name' }], data: [] });
    const empty = el.querySelector('.icen-dt-empty');
    expect(empty?.textContent).toContain('No data');
    expectNoCjk(el, 'datatable 空态');
    handle.destroy();
  });

  test('pagination：条/页、共 N 条、上一页/下一页 aria', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    const el = mount('<div id="dt2"></div>').querySelector('#dt2') as HTMLElement;
    const rows = Array.from({ length: 12 }, (_, i) => ({ name: `row-${i}` }));
    const handle = createTable(el, { columns: [{ key: 'name', title: 'Name' }], data: rows, pageSize: 10 });
    const footer = el.querySelector('.icen-dt-footer') ?? el;
    const text = footer.textContent ?? '';
    expect(text).toContain('10 / page');
    expect(text).toContain('12 items total');
    expectNoCjk(el, 'datatable 分页工具栏');
    handle.destroy();
  });

  test('upload 超尺寸报错（icen:upload-error reason）', async () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    mount(`
      <div class="icen-upload" data-icen-upload data-icen-max-size="8">
        <input type="file" />
      </div>`);
    initUpload();
    const zone = document.querySelector<HTMLElement>('[data-icen-upload]')!;
    const input = zone.querySelector<HTMLInputElement>('input')!;
    const reasons: string[] = [];
    const off = onIcen('icen:upload-error', (e) => reasons.push(e.detail.reason), { within: zone });
    const big = new File(['x'.repeat(64)], 'big.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [big], configurable: true });
    fire(input, 'change');
    await nextTick();
    off();
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('File exceeds');
    expect(CJK.test(reasons[0]!)).toBe(false);
    expectNoCjk(zone, 'upload 区');
  });

  test('ai-tool 审批按钮（允许/拒绝）', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    /* kind 注册表是模块级快照：用 registerAiKind 覆盖 'search' 为英文标签，
       断言完整卡零 CJK 后恢复原注册（label 保持导入期快照原值）。 */
    const original = { ...getAiKind('search') };
    registerAiKind('search', { ...original, label: 'Search' });
    try {
      const el = mount('<div id="tool"></div>').querySelector('#tool') as HTMLElement;
      renderAiToolCall(el, {
        id: 't1',
        name: 'web_search',
        kind: 'search',
        status: 'approval',
        approval: { reason: 'Search the web for this query?' },
      });
      const buttons = [...el.querySelectorAll('button')].map((b) => b.textContent);
      expect(buttons).toContain('Allow');
      expect(buttons).toContain('Reject');
      expectNoCjk(el, 'ai-tool 审批卡');
    } finally {
      registerAiKind('search', original);
    }
  });

  test('getIcenLocale 快照回读与渲染一致', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    const el = mount('<div id="dt3"></div>').querySelector('#dt3') as HTMLElement;
    const handle = createTable(el, { columns: [{ key: 'n', title: 'N' }], data: [] });
    expect(el.textContent).toContain(getIcenLocale()['datatable.empty']);
    expectNoCjk(el, 'datatable 空态（快照一致性）');
    handle.destroy();
  });
});

describe('reset 回中文', () => {
  test('resetIcnLocale 后渲染回 zh-CN', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    resetIcenLocale();
    const el = mount('<div id="dt4"></div>').querySelector('#dt4') as HTMLElement;
    const handle = createTable(el, { columns: [{ key: 'name', title: 'Name' }], data: [] });
    expect(el.querySelector('.icen-dt-empty')?.textContent).toContain('暂无数据');
    handle.destroy();
  });

  test('切换两次不串味：en → zh → en', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    expect(getIcenLocale()['select.noMatch']).toBe('No matches');
    resetIcenLocale();
    expect(getIcenLocale()['select.noMatch']).toBe('无匹配项');
    setIcenLocale(ICEN_LOCALE_EN_US);
    expect(getIcenLocale()['select.noMatch']).toBe('No matches');
  });
});
