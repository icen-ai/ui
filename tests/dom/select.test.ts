// select 行为 DOM 测试：搜索过滤（含分组自动隐藏与 empty 态）、多选 chips + max 上限、
// 单选选中与 hidden input 同步、面板 portal 到 body、initSelect 幂等、销毁归位后可重 init。
// DOM 契约：src/components/select.css 头注释 + behaviors/select.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import { initSelect } from '../../src/behaviors/select';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';

afterEach(() => {
  unmountAll();
  /* 面板 portal 到 body 后脱离 mount 宿主：用例间统一清扫，防 querySelector 命中残留 */
  document.querySelectorAll('.icen-select-panel').forEach((p) => p.remove());
});

const SELECT_HTML = `
  <div class="icen-select" data-icen-select>
    <button class="icen-select-trigger" aria-haspopup="listbox" aria-expanded="false">
      <span class="icen-select-value is-empty">请选择</span>
    </button>
    <div class="icen-select-panel" hidden>
      <button class="icen-select-option" data-icen-value="a">Alpha</button>
      <button class="icen-select-option" data-icen-value="b">Beta</button>
      <button class="icen-select-option" data-icen-value="c">Gamma</button>
    </div>
    <icen-input type="hidden" data-icen-select-value></icen-input>
  </div>
`;

const GROUPED_SEARCH_HTML = `
  <div class="icen-select" data-icen-select data-icen-select-search>
    <button class="icen-select-trigger"><span class="icen-select-value is-empty">选城市</span></button>
    <div class="icen-select-panel" hidden>
      <div class="icen-select-group">
        <div class="icen-select-group-label">华东</div>
        <button class="icen-select-option" data-icen-value="sh" data-icen-keywords="魔都 上海">上海</button>
        <button class="icen-select-option" data-icen-value="hz">杭州</button>
      </div>
      <div class="icen-select-group">
        <div class="icen-select-group-label">华南</div>
        <button class="icen-select-option" data-icen-value="sz">深圳</button>
      </div>
    </div>
  </div>
`;

const MULTI_HTML = `
  <div class="icen-select" data-icen-select data-icen-select-multiple data-icen-select-max="2">
    <button class="icen-select-trigger"><span class="icen-select-value is-empty">多选</span></button>
    <div class="icen-select-panel" hidden>
      <button class="icen-select-option" data-icen-value="a">甲</button>
      <button class="icen-select-option" data-icen-value="b">乙</button>
      <button class="icen-select-option" data-icen-value="c">丙</button>
    </div>
    <icen-input type="hidden" data-icen-select-value></icen-input>
    <span class="icen-select-clear" hidden>×</span>
  </div>
`;

function trigger(): HTMLElement {
  return document.querySelector<HTMLElement>('.icen-select-trigger')!;
}

function panel(): HTMLElement {
  return document.querySelector<HTMLElement>('.icen-select-panel')!;
}

function options(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.icen-select-option'));
}

describe('单选 select', () => {
  test('trigger 点击开面板：portal 到 body、aria-expanded、is-open；选项点击选中并关面板', () => {
    mount(SELECT_HTML);
    const destroy = initSelect();
    fire(trigger(), 'click');
    expect(panel().hidden).toBe(false);
    expect(panel().parentElement).toBe(document.body); /* portal 跳出容器 */
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.icen-select')!.classList.contains('is-open')).toBe(true);

    fire(options()[1]!, 'click'); /* Beta */
    const selected = options().filter((o) => o.classList.contains('is-selected'));
    expect(selected).toHaveLength(1);
    expect(selected[0]!.getAttribute('data-icen-value')).toBe('b');
    expect(document.querySelector('.icen-select-value')!.textContent).toBe('Beta');
    expect(document.querySelector('.icen-select-value')!.classList.contains('is-empty')).toBe(false);
    expect(panel().hidden).toBe(true); /* 单选选中即关 */
    expect((document.querySelector("[data-icen-select-value]") as unknown as { value: string }).value).toBe('b');
    destroy();
  });

  test('icen:select-change detail：value / values / label 三槽；重复 init 幂等不重复派发', () => {
    const details: unknown[] = [];
    mount(SELECT_HTML);
    onIcen('icen:select-change', (e) => details.push(e.detail));
    const destroy = initSelect();
    initSelect();
    fire(trigger(), 'click');
    fire(options()[0]!, 'click');
    expect(details).toEqual([{ value: 'a', values: ['a'], label: 'Alpha' }]);
    destroy();
  });

  test('Esc 关闭并回焦 trigger；外点关闭', () => {
    mount(SELECT_HTML + '<div class="outside">外</div>');
    const destroy = initSelect();
    fire(trigger(), 'click');
    expect(panel().hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel().hidden).toBe(true);

    fire(trigger(), 'click');
    fire(document.querySelector('.outside')!, 'pointerdown');
    expect(panel().hidden).toBe(true);
    destroy();
  });

  test('销毁函数：打开态销毁先收浮层（隐藏面板）+ 幂等标记复位，可重新 init', () => {
    mount(SELECT_HTML);
    const destroy = initSelect();
    fire(trigger(), 'click');
    expect(panel().hidden).toBe(false);
    destroy();
    expect(panel().hidden).toBe(true); /* 打开态销毁：面板被收起 */
    const container = document.querySelector<HTMLElement>('[data-icen-select]')!;
    expect((container as unknown as { __icenSelectInit?: boolean }).__icenSelectInit).toBe(false);
  });

  /* v0.10 已修复：销毁时若面板 portal 在 body 则归位容器（select.ts 销毁路径），重 init 可再开。回归锁： */
  test('销毁后可重新 init 并再次开面板（portal 归位契约）', () => {
    mount(SELECT_HTML);
    const destroy = initSelect();
    fire(trigger(), 'click');
    destroy();
    initSelect();
    fire(trigger(), 'click');
    expect(panel().hidden).toBe(false);
  });
});

describe('搜索过滤（data-icen-select-search）', () => {
  test('输入过滤选项；data-icen-keywords 辅助命中；分组全过滤时隐藏；无结果显示 empty 态', async () => {
    mount(GROUPED_SEARCH_HTML);
    const destroy = initSelect();
    fire(trigger(), 'click');
    await nextTick(); /* 打开时搜索框 setTimeout 聚焦 */
    const input = panel().querySelector<HTMLInputElement>('.icen-select-search-input')!;
    expect(input).toBeDefined(); /* 搜索输入框自动插入 */

    input.value = '深';
    fire(input, 'input');
    expect(options().map((o) => o.hidden)).toEqual([true, true, false]);
    expect(panel().querySelector<HTMLElement>('.icen-select-group')!.hidden).toBe(true); /* 华东全滤掉 */
    expect(panel().querySelectorAll<HTMLElement>('.icen-select-group')[1]!.hidden).toBe(false);

    input.value = '魔都';
    fire(input, 'input');
    expect(options().map((o) => o.hidden)).toEqual([false, true, true]); /* keywords 辅助命中上海 */

    input.value = '不存在的东西';
    fire(input, 'input');
    expect(options().every((o) => o.hidden)).toBe(true);
    const empty = panel().querySelector<HTMLElement>('.icen-select-empty')!;
    expect(empty.hidden).toBe(false); /* empty 态自动创建并显示 */
    expect(empty.textContent).toBe('无匹配项');
    destroy();
  });
});

describe('多选（data-icen-select-multiple）', () => {
  test('点选切换不关面板：chips 渲染、hidden input 逗号同步、icen:select-change values 数组', () => {
    const details: unknown[] = [];
    mount(MULTI_HTML);
    onIcen('icen:select-change', (e) => details.push(e.detail));
    const destroy = initSelect();
    fire(trigger(), 'click');
    fire(options()[0]!, 'click');
    fire(options()[2]!, 'click');
    expect(panel().hidden).toBe(false); /* 多选不关面板 */

    const chips = Array.from(document.querySelectorAll<HTMLElement>('.icen-select-chip'));
    expect(chips.map((c) => c.querySelector('span')!.textContent)).toEqual(['甲', '丙']); /* 首子 span 为标签，× 另挂 */
    expect(document.querySelector<HTMLElement>('.icen-select-value')!.hidden).toBe(true);
    expect((document.querySelector("[data-icen-select-value]") as unknown as { value: string }).value).toBe('a,c');
    expect(details).toHaveLength(2);
    expect(details[1]).toMatchObject({ value: 'a', values: ['a', 'c'] });
    destroy();
  });

  test('max=2 上限：达到后其余选项 is-disabled，点 disabled 无效果', () => {
    mount(MULTI_HTML);
    const destroy = initSelect();
    fire(trigger(), 'click');
    fire(options()[0]!, 'click');
    fire(options()[1]!, 'click');
    expect(options()[2]!.classList.contains('is-disabled')).toBe(true);
    fire(options()[2]!, 'click');
    expect(options()[2]!.classList.contains('is-selected')).toBe(false);
    expect(document.querySelectorAll('.icen-select-chip')).toHaveLength(2);
    destroy();
  });

  test('清除钮：清空全部选中并恢复占位', () => {
    mount(MULTI_HTML);
    const destroy = initSelect();
    fire(trigger(), 'click');
    fire(options()[0]!, 'click');
    const clearBtn = document.querySelector<HTMLElement>('.icen-select-clear')!;
    expect(clearBtn.hidden).toBe(false); /* 有选中才显示 */
    fire(clearBtn, 'click');
    expect(options().every((o) => !o.classList.contains('is-selected'))).toBe(true);
    expect((document.querySelector("[data-icen-select-value]") as unknown as { value: string }).value).toBe('');
    expect(clearBtn.hidden).toBe(true);
    destroy();
  });
});
