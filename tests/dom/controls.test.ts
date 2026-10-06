// controls 行为 DOM 测试：initSwitch / initSteps / initRating / initPagination / initTableSort
// 的委托交互 + 「重复 init 不重复绑定 + 销毁函数可重 init」骨架。
// 注意：controls.ts 用 createDelegatedInit 的模块级 inited —— document 委托跨用例存活，
// 故每个用例都必须「本用例内首个 init 捕获的销毁函数在本用例内销毁」，保持自包含。
// DOM 契约：src/components/{switch,steps,media,pagination,table}.css 头注释 + behaviors/controls.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  initPagination,
  initRating,
  initSteps,
  initSwitch,
  initTableSort,
} from '../../src/behaviors/controls';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, unmountAll } from '../helpers/dom';

afterEach(() => unmountAll());

const STEPS_HTML = (clickable = 'wait'): string => `
  <ol class="icen-steps">
    <li class="icen-step icen-step--finish">提交</li>
    <li class="icen-step icen-step--process is-active">审核</li>
    <li class="icen-step icen-step--${clickable === 'wait' ? 'wait' : 'wait'}" role="button">归档</li>
  </ol>
`;

describe('initSwitch（委托骨架经 radio 路径验证；switch/checkbox 语义见 todo）', () => {
  const RADIO_HTML = `
    <div class="icen-radio-group" role="radiogroup">
      <button class="icen-radio-item" role="radio" aria-checked="true">甲</button>
      <button class="icen-radio-item" role="radio" aria-checked="false">乙</button>
      <button class="icen-radio-item" role="radio" aria-checked="false">丙</button>
    </div>
  `;

  test('radio 组内互斥：aria-checked + is-selected 同步，重复点击已选项 no-op 不派发；幂等不重复绑定', () => {
    const details: unknown[] = [];
    mount(RADIO_HTML);
    onIcen('icen:check-change', (e) => details.push(e.detail));
    const destroy = initSwitch();
    initSwitch(); /* 幂等早退：不重复绑定 */
    const items = Array.from(document.querySelectorAll<HTMLElement>('.icen-radio-item'));
    fire(items[1]!, 'click');
    expect(details).toHaveLength(1);
    expect(details[0]).toMatchObject({ checked: true });
    expect(items[1]!.getAttribute('aria-checked')).toBe('true');
    expect(items[1]!.classList.contains('is-selected')).toBe(true);
    expect(items[0]!.getAttribute('aria-checked')).toBe('false');

    fire(items[1]!, 'click'); /* 已选项：no-op */
    expect(details).toHaveLength(1);
    destroy();
  });

  test('radio 键盘激活（Space/Enter）+ 销毁停发 + 销毁后可重新 init', () => {
    const details: unknown[] = [];
    mount(RADIO_HTML);
    onIcen('icen:check-change', (e) => details.push(e.detail));
    const destroy = initSwitch();
    const items = Array.from(document.querySelectorAll<HTMLElement>('.icen-radio-item'));

    items[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(details).toHaveLength(1);
    expect(items[2]!.getAttribute('aria-checked')).toBe('true');

    destroy();
    items[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(details).toHaveLength(1); /* 已注销 */

    initSwitch();
    fire(items[1]!, 'click');
    expect(details).toHaveLength(2); /* 重新接管 */
    items[1]!.getAttribute('aria-checked');
    expect(items[1]!.getAttribute('aria-checked')).toBe('true');
    initSwitch()(); /* 收尾：重新 init 后也销毁，防跨用例残留 */
  });

  /* v0.10 已修复（迁移期 codemod 曾把 ARIA role 值误转为 role="icen-switch"，导致委托与分流分裂）：
     委托与分流统一 ARIA 标准 role="switch"/"checkbox"（WAI 值永不前缀化）。以下为回归锁。 */
  test('initSwitch：switch aria-checked 翻转 + icen:switch-change { el, checked }', () => {
    const details: unknown[] = [];
    mount('<button class="icen-switch" role="switch" aria-checked="false"><span class="icen-switch-thumb"></span></button>');
    onIcen('icen:switch-change', (e) => details.push(e.detail));
    const destroy = initSwitch();
    const el = document.querySelector<HTMLElement>('.icen-switch')!;
    fire(el, 'click');
    expect(el.getAttribute('aria-checked')).toBe('true');
    fire(el, 'click');
    expect(el.getAttribute('aria-checked')).toBe('false');
    expect(details).toEqual([
      { el, checked: true },
      { el, checked: false },
    ]);
    destroy();
  });

  test('initSwitch：checkbox 三态循环 true→false→mixed→true', () => {
    mount('<button class="icen-checkbox" role="checkbox" aria-checked="true"></button>');
    const destroy = initSwitch();
    const el = document.querySelector<HTMLElement>('.icen-checkbox')!;
    const states: Array<boolean | 'mixed'> = [];
    onIcen('icen:check-change', (e) => states.push(e.detail.checked));
    fire(el, 'click');
    fire(el, 'click');
    fire(el, 'click');
    expect(states).toEqual([false, 'mixed', true]);
    destroy();
  });
});

describe('initSteps', () => {
  test('点击可点步骤：激活点位移（前 finish / 目标 process+is-active / 后 wait），派 icen:step-change', () => {
    const details: Array<{ index: number }> = [];
    mount(STEPS_HTML());
    onIcen('icen:step-change', (e) => details.push(e.detail));
    const destroy = initSteps();
    const steps = Array.from(document.querySelectorAll<HTMLElement>('.icen-step'));
    fire(steps[2]!, 'click');
    expect(details).toHaveLength(1);
    expect(details[0]?.index).toBe(2);
    expect(steps[0]!.className).toContain('icen-step--finish');
    expect(steps[1]!.className).toContain('icen-step--finish');
    expect(steps[2]!.className).toContain('icen-step--process');
    expect(steps[2]!.classList.contains('is-active')).toBe(true);
    destroy();
  });

  test('骨架：重复 init 不重复绑定 + 销毁停发 + 销毁后可重新 init', () => {
    const details: number[] = [];
    mount(STEPS_HTML());
    onIcen('icen:step-change', (e) => details.push(e.detail.index));
    const destroy = initSteps();
    initSteps(); /* 幂等 */
    const step = document.querySelector<HTMLElement>('.icen-step[role="button"]')!;
    fire(step, 'click');
    expect(details).toEqual([2]);

    destroy();
    fire(step, 'click');
    expect(details).toEqual([2]); /* 已注销 */

    initSteps();
    fire(step, 'click');
    expect(details).toEqual([2, 2]); /* 重新接管 */
    initSteps()(); /* 收尾销毁 */
  });
});

describe('initRating', () => {
  const RATING_HTML = `
    <div class="icen-rating">
      <button class="icen-rating-star">1</button>
      <button class="icen-rating-star">2</button>
      <button class="icen-rating-star">3</button>
      <button class="icen-rating-star">4</button>
      <button class="icen-rating-star">5</button>
      <span class="icen-rating-value">0</span>
    </div>
  `;

  test('点第 n 星：该星及之前 is-filled，value 回写，派 icen:rating-change（1 起算）；幂等不重复绑定', () => {
    const details: number[] = [];
    mount(RATING_HTML);
    onIcen('icen:rating-change', (e) => details.push(e.detail.value));
    const destroy = initRating();
    initRating();
    const stars = Array.from(document.querySelectorAll<HTMLElement>('.icen-rating-star'));
    fire(stars[2]!, 'click');
    expect(details).toEqual([3]);
    expect(stars.map((s) => s.classList.contains('is-filled'))).toEqual([true, true, true, false, false]);
    expect(document.querySelector('.icen-rating-value')?.textContent).toBe('3');
    destroy();
  });

  test('readonly 变体不接线；销毁后可重新 init', () => {
    const details: number[] = [];
    mount(RATING_HTML.replace('class="icen-rating"', 'class="icen-rating icen-rating--readonly"'));
    onIcen('icen:rating-change', (e) => details.push(e.detail.value));
    const destroy = initRating();
    fire(document.querySelector('.icen-rating-star')!, 'click');
    expect(details).toEqual([]); /* readonly 不响应 */
    destroy();

    document.querySelector('.icen-rating')!.classList.remove('icen-rating--readonly'); /* 换成可点容器再验重 init */
    initRating();
    const stars = Array.from(document.querySelectorAll<HTMLElement>('.icen-rating-star'));
    fire(stars[4]!, 'click');
    expect(details).toEqual([5]);
    expect(stars[3]!.classList.contains('is-filled')).toBe(true);
    initRating()(); /* 收尾销毁 */
  });
});

describe('initPagination', () => {
  const PAGER_HTML = `
    <nav class="icen-pagination" aria-label="分页">
      <button class="icen-page-btn" data-icen-dir="prev" aria-label="上一页">‹</button>
      <button class="icen-page-btn is-active" aria-current="page" data-icen-page="1">1</button>
      <button class="icen-page-btn" data-icen-page="2">2</button>
      <button class="icen-page-btn" data-icen-page="3">3</button>
      <button class="icen-page-btn" data-icen-dir="next" aria-label="下一页">›</button>
    </nav>
  `;

  test('点页码：is-active / aria-current 位移 + icen:page-change { page }；幂等不重复绑定', () => {
    const pages: number[] = [];
    mount(PAGER_HTML);
    onIcen('icen:page-change', (e) => pages.push(e.detail.page));
    const destroy = initPagination();
    initPagination();
    const btns = Array.from(document.querySelectorAll<HTMLElement>('.icen-page-btn'));
    fire(btns[2]!, 'click'); /* 第 2 页 */
    expect(pages).toEqual([2]);
    expect(btns[2]!.classList.contains('is-active')).toBe(true);
    expect(btns[2]!.getAttribute('aria-current')).toBe('page');
    expect(btns[1]!.classList.contains('is-active')).toBe(false);
    expect(btns[1]!.hasAttribute('aria-current')).toBe(false);
    destroy();
  });

  test('方向钮：当前页 ±1 且目标钮可见则同步位移；第一页往前夹到 1', () => {
    const pages: number[] = [];
    mount(PAGER_HTML);
    onIcen('icen:page-change', (e) => pages.push(e.detail.page));
    const destroy = initPagination();
    const btns = Array.from(document.querySelectorAll<HTMLElement>('.icen-page-btn'));
    fire(btns[4]!, 'click'); /* next：1 → 2 */
    expect(pages).toEqual([2]);
    expect(btns[2]!.classList.contains('is-active')).toBe(true);
    fire(btns[0]!, 'click'); /* prev：2 → 1 */
    fire(btns[0]!, 'click'); /* prev：1 → 夹 1 */
    expect(pages).toEqual([2, 1, 1]);
    expect(btns[1]!.classList.contains('is-active')).toBe(true);
    destroy();
  });

  test('骨架：销毁停发 + 销毁后可重新 init', () => {
    const pages: number[] = [];
    mount(PAGER_HTML);
    onIcen('icen:page-change', (e) => pages.push(e.detail.page));
    const destroy = initPagination();
    fire(document.querySelector<HTMLElement>('[data-icen-page="2"]')!, 'click');
    expect(pages).toEqual([2]);
    destroy();
    fire(document.querySelector<HTMLElement>('[data-icen-page="3"]')!, 'click');
    expect(pages).toEqual([2]); /* 已注销：不派发也不翻页 */
    initPagination();
    fire(document.querySelector<HTMLElement>('[data-icen-page="3"]')!, 'click');
    expect(pages).toEqual([2, 3]);
    initPagination()(); /* 收尾销毁 */
  });
});

describe('initTableSort', () => {
  const TABLE_HTML = `
    <table>
      <thead><tr><th data-icen-sort="price">价格</th><th data-icen-sort="name">名称</th></tr></thead>
      <tbody></tbody>
    </table>
  `;

  test('th[data-icen-sort] 三态循环 asc→desc→无；列 key 转存 data-icen-sort-key；同表其他 th 复位', () => {
    const details: Array<{ key: string; dir: string | null }> = [];
    mount(TABLE_HTML);
    onIcen('icen:sort-change', (e) => details.push({ key: e.detail.key, dir: e.detail.dir }));
    const destroy = initTableSort();
    const price = document.querySelector<HTMLElement>('th[data-icen-sort="price"]')!;
    const name = document.querySelector<HTMLElement>('th[data-icen-sort="name"]')!;

    fire(price, 'click');
    expect(price.getAttribute('data-icen-sort')).toBe('asc');
    expect(price.getAttribute('data-icen-sort-key')).toBe('price');
    expect(details[0]).toEqual({ key: 'price', dir: 'asc' });

    fire(price, 'click');
    expect(price.getAttribute('data-icen-sort')).toBe('desc');
    expect(details[1]).toEqual({ key: 'price', dir: 'desc' });

    fire(name, 'click'); /* 切列：price 复位为列 key */
    expect(price.getAttribute('data-icen-sort')).toBe('price');
    expect(name.getAttribute('data-icen-sort')).toBe('asc');
    expect(details[2]).toEqual({ key: 'name', dir: 'asc' });

    fire(name, 'click');
    fire(name, 'click'); /* desc → 中性 */
    expect(name.getAttribute('data-icen-sort')).toBe('name');
    expect(details[4]).toEqual({ key: 'name', dir: null });
    destroy();
  });

  test('骨架：幂等不重复绑定 + 销毁停发 + 销毁后可重新 init', () => {
    const details: string[] = [];
    mount(TABLE_HTML);
    onIcen('icen:sort-change', (e) => details.push(`${e.detail.key}:${e.detail.dir}`));
    const destroy = initTableSort();
    initTableSort();
    const th = document.querySelector<HTMLElement>('th[data-icen-sort="price"]')!;
    fire(th, 'click');
    expect(details).toEqual(['price:asc']);
    destroy();
    fire(th, 'click');
    expect(details).toEqual(['price:asc']); /* 已注销 */
    initTableSort();
    fire(th, 'click');
    expect(details).toEqual(['price:asc', 'price:desc']); /* 重新接管：委托无状态，循环接着元素上的 asc 走 */
    initTableSort()(); /* 收尾销毁 */
  });
});
