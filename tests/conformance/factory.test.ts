// Core 函数渲染族一致性套件：renderChart（charts.ts，handle 生命周期）/ createTable（datatable）/
// toast / notification（瞬时与持久反馈）。与标记驱动族同纪律，断言面换成 create/render 形态：
// 句柄生命周期（update 保监听 / destroy 清场可重建）· 事件登记与 detail 形态 · 键盘焦点 ·
// textContent 文本纪律（XSS 探针串原样成文本）。
import { afterEach, describe, expect, test } from 'bun:test';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';
import { XSS_TEXT, capture, cleanupOverlays, expectRegistered, expectTextOnly, key } from './helpers';

import { renderChart } from '../../src/behaviors/charts';
import { createTable } from '../../src/behaviors/datatable';
import { toast } from '../../src/behaviors/toast';
import { createNotificationCenter } from '../../src/behaviors/notification';

afterEach(() => {
  toast.dismiss();
  toast.config({ maxStack: 5 }); // maxStack 是模块级配置，复位防串味
  unmountAll();
  cleanupOverlays();
});

/** 建一个挂进测试容器的裸宿主元素（同 kb-conformance 形态）。 */
function hostEl(): HTMLElement {
  const host = mount('');
  const el = document.createElement('div');
  host.appendChild(el);
  return el;
}

/* ═══════════════ renderChart：handle 生命周期 + 事件契约 ═══════════════ */

describe('renderChart 句柄生命周期', () => {
  const SPEC = { type: 'vbar', title: '销量', labels: ['A', 'B'], values: [3, 5] } as const;

  test('渲染：标题/标记齐备；update 原地重渲且事件委托存活；destroy 清场后可重建', () => {
    const el = hostEl();
    const cap = capture(['icen:chart-click']);
    const chart = renderChart(el, { ...SPEC });
    try {
      expect(el.querySelector('.icen-chart-title')?.textContent).toBe('销量');
      const marks = el.querySelectorAll('[data-icen-chart-mark]');
      expect(marks.length).toBe(2);

      fire(marks[0]!, 'click');
      expect(cap.count()).toBe(1);
      const detail = cap.events[0]!.detail as { index: number; label: string; value: number; chart: string; type: string };
      expect(detail).toMatchObject({ index: 0, label: 'A', value: 3, chart: 'vbar', type: 'click' });

      chart.update({ type: 'vbar', title: '销量v2', labels: ['C'], values: [9] });
      expect(el.querySelector('.icen-chart-title')?.textContent).toBe('销量v2');
      const marks2 = el.querySelectorAll('[data-icen-chart-mark]');
      expect(marks2.length).toBe(1);
      fire(marks2[0]!, 'click'); // 委托跨 update 存活（挂 el 不挂子树）
      expect(cap.count()).toBe(2);
      expect((cap.events[1]!.detail as { label: string }).label).toBe('C');

      chart.destroy();
      expect(el.textContent).toBe(''); // destroy 清场
      fire(el, 'click');
      expect(cap.count()).toBe(2); // 监听已摘
      expect(el.querySelector('[data-icen-chart-mark]')).toBeNull();

      const again = renderChart(el, { ...SPEC }); // 同元素可重建
      expect(again.el.querySelectorAll('[data-icen-chart-mark]').length).toBe(2);
      again.destroy();
    } finally {
      cap.restore();
    }
  });

  test('handle.on(name, fn) 监听糖：与 document 捕获同源 detail；返回解绑函数', () => {
    const el = hostEl();
    const chart = renderChart(el, { ...SPEC });
    const seen: unknown[] = [];
    const off = chart.on('click', (detail) => seen.push(detail));
    try {
      fire(el.querySelector('[data-icen-chart-mark]')!, 'click');
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ index: 0, value: 3 });
      off();
      fire(el.querySelector('[data-icen-chart-mark]')!, 'click');
      expect(seen).toHaveLength(1); // 解绑后不再收
    } finally {
      chart.destroy();
    }
  });

  test('hover 契约：pointerover 派 enter 并点亮内置 tooltip（portal 单例）；pointerout 派 leave 并熄灭', () => {
    const el = hostEl();
    const cap = capture(['icen:chart-hover']);
    const chart = renderChart(el, { ...SPEC });
    try {
      const mark = el.querySelector('[data-icen-chart-mark]')!;
      fire(mark, 'pointerover');
      fire(mark, 'pointerout');
      expect(cap.events.map((e) => (e.detail as { phase?: string }).phase)).toEqual(['enter', 'leave']);
      expect(cap.events[0]!.detail).toMatchObject({ index: 0, label: 'A', value: 3 });
      expectRegistered(['icen:chart-hover', 'icen:chart-click', 'icen:chart-dblclick', 'icen:chart-contextmenu']);
    } finally {
      cap.restore();
      chart.destroy();
    }
  });

  test('图例契约：多系列图例行 role=button tabindex=0；点击/Enter 切换 .is-off 派 legend-toggle；眼睛派 legend-visibility', () => {
    const el = hostEl();
    const cap = capture(['icen:chart-legend-toggle', 'icen:chart-legend-visibility']);
    const chart = renderChart(el, {
      type: 'vbar',
      title: '对比',
      labels: ['A'],
      series: [
        { name: '甲系', values: [1] },
        { name: '乙系', values: [2] },
      ],
    });
    try {
      const row = el.querySelector<HTMLElement>('.icen-chart-legend-toggle-item')!;
      expect(row.getAttribute('role')).toBe('button');
      expect(row.tabIndex).toBe(0); // 可聚焦契约
      fire(row, 'click');
      expect(row.classList.contains('is-off')).toBe(true);
      expect(row.getAttribute('aria-pressed')).toBe('false');
      // key 契约（charts.ts toggleLegend）：`${seriesIndex}:${seriesName}` 复合键
      expect(cap.events[0]!.detail).toMatchObject({ key: '0:甲系', seriesIndex: 0, hidden: true });
      key(row, 'Enter'); // 键盘等价路径
      expect(row.classList.contains('is-off')).toBe(false);
      expect((cap.events[1]!.detail as { hidden: boolean }).hidden).toBe(false);

      const eye = el.querySelector<HTMLElement>('.icen-chart-legend-eye')!;
      fire(eye, 'click');
      expect(el.getAttribute('data-icen-legend-hidden')).toBe('true');
      expect(cap.events[2]!.type).toBe('icen:chart-legend-visibility');
      expect(cap.events[2]!.detail).toEqual({ visible: false });
      expectRegistered(['icen:chart-legend-toggle', 'icen:chart-legend-visibility']);
    } finally {
      cap.restore();
      chart.destroy();
    }
  });

  test('XSS 文本纪律：title 与 labels 的 <img onerror> 原样成文本', () => {
    const el = hostEl();
    const chart = renderChart(el, { type: 'vbar', title: XSS_TEXT, labels: [XSS_TEXT], values: [1] });
    try {
      expectTextOnly(el.querySelector('.icen-chart-title')!);
      expectTextOnly(el);
    } finally {
      chart.destroy();
    }
  });
});

/* ═══════════════ createTable：渲染/交互/生命周期契约 ═══════════════ */

describe('createTable 契约', () => {
  interface Row {
    name: string;
    n: number;
  }
  const rows12 = (): Row[] => Array.from({ length: 12 }, (_, i) => ({ name: `行${i + 1}`, n: i + 1 }));

  test('渲染：.icen-datatable 根 + 行齐备；分页默认 10/页，点页码派 icen:table-page-change', () => {
    const el = hostEl();
    const cap = capture(['icen:table-page-change']);
    const table = createTable<Row>(el, {
      columns: [
        { key: 'name', title: '名称' },
        { key: 'n', title: '数量', sortable: true },
      ],
      data: rows12(),
    });
    try {
      expect(el.querySelector('.icen-datatable')).not.toBeNull();
      expect(el.textContent).toContain('行1');
      // 分页默认 10/页：首屏恰好 10 个数据行（summary 行无 data-icen-row），第 11 行（索引 10）不在首屏
      expect(el.querySelectorAll('.icen-dt-body [data-icen-row]')).toHaveLength(10);
      expect(el.querySelector('[data-icen-row="10"]')).toBeNull();
      const page2 = Array.from(el.querySelectorAll<HTMLElement>('.icen-dt-page-btn')).find((b) => b.textContent === '2')!;
      fire(page2, 'click');
      expect(cap.count()).toBe(1);
      expect(cap.events[0]!.detail).toEqual({ page: 2, pageSize: 10 });
      expect(el.textContent).toContain('行11');
      expectRegistered(['icen:table-page-change', 'icen:table-page-size-change']);
    } finally {
      cap.restore();
      table.destroy();
    }
  });

  test('排序：点表头 升→降→取消 循环派 icen:table-sort-change（取消不派）+ aria-sort 同步；Enter/Space 键盘等价（tabindex=0）', () => {
    const el = hostEl();
    const cap = capture(['icen:table-sort-change']);
    const table = createTable<Row>(el, {
      columns: [{ key: 'n', title: '数量', sortable: true }],
      data: rows12(),
      pagination: false,
    });
    try {
      // applySorts 内部 renderAll() 整体重渲——每次交互后必须重新取 head（旧引用已脱离 DOM）
      const head = () => el.querySelector<HTMLElement>('.icen-dt-cell--head.is-sortable')!;
      expect(head().tabIndex).toBe(0); // 键盘可达
      fire(head(), 'click');
      expect(cap.events[0]!.detail).toEqual({ key: 'n', dir: 'asc' });
      expect(head().getAttribute('aria-sort')).toBe('ascending');
      fire(head(), 'click');
      expect(cap.events[1]!.detail).toEqual({ key: 'n', dir: 'desc' });
      expect(head().getAttribute('aria-sort')).toBe('descending');
      // 键盘路径（Enter/Space 与点击同语义）：第三击 = 取消排序——排序栈空则不派事件
      // （applySorts 仅在主排序存在时派发），aria-sort 归 none
      key(head(), 'Enter');
      expect(cap.count()).toBe(2);
      expect(head().getAttribute('aria-sort')).toBe('none');
      expectRegistered(['icen:table-sort-change']);
    } finally {
      cap.restore();
      table.destroy();
    }
  });

  test('搜索：160ms 防抖派 icen:table-search-change 并过滤行', async () => {
    const el = hostEl();
    const cap = capture(['icen:table-search-change']);
    const table = createTable<Row>(el, {
      columns: [{ key: 'name', title: '名称' }],
      data: rows12(),
      searchable: true,
    });
    try {
      const input = el.querySelector<HTMLInputElement>('.icen-dt-search-input')!;
      input.value = '行1';
      fire(input, 'input');
      await nextTick(220); // 内置 160ms 防抖
      expect(cap.count()).toBe(1);
      expect(cap.events[0]!.detail).toEqual({ query: '行1' });
      expect(el.textContent).toContain('行12'); // 「行1」前缀匹配 行1/行10/行11/行12
      expect(el.textContent).not.toContain('行2');
    } finally {
      cap.restore();
      table.destroy();
    }
  });

  test('destroy：清空宿主且不再响应；同元素可重建', () => {
    const el = hostEl();
    const table = createTable<Row>(el, { columns: [{ key: 'name', title: '名称' }], data: rows12() });
    table.destroy();
    expect(el.textContent).toBe('');
    const again = createTable<Row>(el, { columns: [{ key: 'name', title: '名称' }], data: rows12() });
    expect(el.textContent).toContain('行1');
    again.destroy();
  });

  test('XSS 文本纪律：列标题与单元格值的 <img onerror> 原样成文本（columns.render→Node 是唯一声明的口子，不喂）', () => {
    const el = hostEl();
    const table = createTable<Row>(el, {
      columns: [
        { key: 'name', title: XSS_TEXT },
        { key: 'n', title: '数量' },
      ],
      data: [{ name: XSS_TEXT, n: 1 }],
      pagination: false,
    });
    try {
      expectTextOnly(el.querySelector('.icen-dt-head-title')!);
      expectTextOnly(el);
    } finally {
      table.destroy();
    }
  });
});

/* ═══════════════ toast：瞬时反馈契约 ═══════════════ */

describe('toast 契约（纯文本纪律 + 容器单例 + 句柄）', () => {
  test('容器自动创建且唯一（role=status aria-live=polite）；语义类挂对；dismiss 幂等可重复调', async () => {
    const h1 = toast.success('已保存');
    const h2 = toast.error('失败');
    try {
      const containers = document.body.querySelectorAll(':scope > .icen-toast-container');
      expect(containers).toHaveLength(1); // body 末尾唯一
      expect(containers[0]!.getAttribute('role')).toBe('status');
      expect(containers[0]!.getAttribute('aria-live')).toBe('polite');
      const rows = containers[0]!.querySelectorAll('.icen-toast');
      expect(rows).toHaveLength(2);
      expect(rows[0]!.classList.contains('icen-toast--success')).toBe(true);
      expect(rows[1]!.classList.contains('icen-toast--error')).toBe(true);
      expect(rows[0]!.querySelector('.icen-toast-msg')!.textContent).toBe('已保存');
      expect(rows[1]!.getAttribute('role')).toBe('alert'); // error 升 alert
      h1.dismiss();
      h1.dismiss(); // 幂等
      expect(rows[0]!.classList.contains('is-leaving')).toBe(true);
      await nextTick(450); // 400ms 兜底移除
      expect(document.querySelectorAll('.icen-toast:not(.is-leaving)')).toHaveLength(1);
      expect(document.contains(rows[0]!)).toBe(false);
    } finally {
      h2.dismiss();
    }
  });

  test('maxStack：超出移除最早的（toast.config 可调；移除走 is-leaving 退场，文本只统计存活项）', () => {
    toast.config({ maxStack: 2 });
    toast('一');
    toast('二');
    toast('三');
    const live = document.querySelectorAll('.icen-toast:not(.is-leaving)');
    expect(live).toHaveLength(2);
    // 被挤出的最早项挂 .is-leaving 滞留 DOM 等退场——存活集只认非 leaving 项
    const texts = Array.from(document.querySelectorAll('.icen-toast:not(.is-leaving) .icen-toast-msg')).map((n) => n.textContent);
    expect(texts).toEqual(['二', '三']);
  });

  test('closable：关闭钮点击即关；progress 条动画时长 = 保留时长', () => {
    const h = toast('带关闭', 'info', { closable: true, progress: true, ms: 1500 });
    const el = document.querySelector<HTMLElement>('.icen-toast')!;
    const close = el.querySelector<HTMLElement>('.icen-toast-close')!;
    expect(close.getAttribute('aria-label')).toBeTruthy();
    const fill = el.querySelector<HTMLElement>('.icen-toast-progress-fill')!;
    expect(fill.style.animationDuration).toBe('1500ms');
    fire(close, 'click');
    expect(el.classList.contains('is-leaving')).toBe(true);
    h.dismiss();
  });

  test('XSS 文本纪律：message 的 <img onerror> 原样成文本；icon SVG 字符串经消毒（剥 on*/剔 script）', () => {
    const h = toast(XSS_TEXT, 'info', { icon: '<svg><script>window.__icenXss=1</script><circle r="1" onerror="window.__icenXss=1" /></svg>' });
    try {
      const el = document.querySelector<HTMLElement>('.icen-toast')!;
      expectTextOnly(el.querySelector('.icen-toast-msg')!);
      expectTextOnly(el);
      const icon = el.querySelector('.icen-toast-icon svg');
      expect(icon).not.toBeNull();
      expect(icon!.querySelector('script')).toBeNull(); // 消毒纪律
      expect(icon!.querySelector('[onerror]')).toBeNull();
    } finally {
      h.dismiss();
    }
  });
});

/* ═══════════════ notification：持久通知栈契约 ═══════════════ */

describe('notification（createNotificationCenter）契约', () => {
  test('容器 role=region + 位置 data 属性；push/update/dismiss/destroy 生命周期；onShow/onClose 回调', async () => {
    const host = mount('');
    let shown = 0;
    let closed = 0;
    const center = createNotificationCenter(host, { position: 'bottom-right' });
    try {
      const container = host.querySelector<HTMLElement>('.icen-notification-container')!;
      expect(container.getAttribute('role')).toBe('region');
      expect(container.dataset.icenPosition).toBe('bottom-right');

      const h = center.push({ title: '构建完成', kind: 'success', options: { id: 'n1', description: '耗时 3s', onShow: () => shown++, onClose: () => closed++ } });
      expect(h).not.toBeNull();
      expect(shown).toBe(1);
      const card = container.querySelector<HTMLElement>('.icen-notification')!;
      expect(card.querySelector('.icen-notification-title')!.textContent).toBe('构建完成');
      expect(card.querySelector('.icen-notification-message')!.textContent).toBe('耗时 3s');
      expect(center.get('n1')).not.toBeNull();

      h!.update({ title: '构建完成（重试）' });
      expect(card.querySelector('.icen-notification-title')!.textContent).toBe('构建完成（重试）');

      h!.dismiss();
      expect(center.get('n1')).toBeNull(); // 记录同步出栈
      // onClose 在退场收尾（transitionend 或 360ms 兜底超时，removeOne→finish）后才回调
      await nextTick(400);
      expect(closed).toBe(1); // onClose 事后观察

      center.destroy();
      expect(host.querySelector('.icen-notification-container')).toBeNull(); // destroy 摘容器
      expect(center.push({ title: 'x' })).toBeNull(); // 销毁后 push 拒绝
    } finally {
      center.destroy();
    }
  });

  test('XSS 文本纪律：title/description 的 <img onerror> 原样成文本', () => {
    const host = mount('');
    const center = createNotificationCenter(host);
    try {
      center.push({ title: XSS_TEXT, kind: 'info', options: { description: XSS_TEXT } });
      const card = host.querySelector<HTMLElement>('.icen-notification')!;
      expectTextOnly(card.querySelector('.icen-notification-title')!);
      expectTextOnly(card.querySelector('.icen-notification-message')!);
      expectTextOnly(card);
    } finally {
      center.destroy();
    }
  });
});
