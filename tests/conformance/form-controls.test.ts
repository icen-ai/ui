// Core 表单控件/导航族一致性套件：tabs / controls（switch·stepper·segmented·steps·rating·
// pagination·静态表排序）/ slider / upload / tree / accordion / input / form-validate。
// 表驱动三契约（init 幂等 / destroy 可重入 / 事件登记+协议形态）走 describeInitConformance
// （./helpers.ts）；焦点/键盘与 XSS 文本纪律按 behaviors/*.ts 头注释契约抽查。
// 注意：controls.ts 七 init 是 document 级模块单例（createDelegatedInit）——每个用例内自销毁，
// 与 tests/dom/controls.test.ts 同款纪律。
import { afterEach, describe, expect, test } from 'bun:test';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';
import {
  XSS_TEXT,
  capture,
  cleanupOverlays,
  describeInitConformance,
  expectRegistered,
  expectSerializedEscaped,
  expectTextOnly,
  key,
  type InitCaseRun,
} from './helpers';

import { initTabs } from '../../src/behaviors/tabs';
import {
  initPagination,
  initRating,
  initSegmented,
  initStepper,
  initSteps,
  initSwitch,
  initTableSort,
} from '../../src/behaviors/controls';
import { initSlider } from '../../src/behaviors/slider';
import { initUpload } from '../../src/behaviors/upload';
import { initTree } from '../../src/behaviors/tree';
import { initAccordion } from '../../src/behaviors/accordion';
import { initInput } from '../../src/behaviors/input';
import { createFormValidator, initFormValidate } from '../../src/behaviors/form-validate';

afterEach(() => {
  unmountAll();
  cleanupOverlays();
});

/* ═══════════════ 表驱动：init 幂等 / destroy / 事件登记 ═══════════════ */

const TABS_HTML = `
  <div data-icen-tabs>
    <nav class="icen-tabs" role="tablist">
      <button class="icen-page-tab is-active" data-icen-tab="a" id="tab-a">甲</button>
      <button class="icen-page-tab" data-icen-tab="b" id="tab-b">乙</button>
    </nav>
    <section data-icen-tab-panel="a">面板A</section>
    <section data-icen-tab-panel="b" hidden>面板B</section>
  </div>
`;

const CASES: Parameters<typeof describeInitConformance>[0][] = [
  {
    name: 'tabs（分区切换）',
    events: ['icen:tab-change'],
    run(): InitCaseRun {
      const host = mount(TABS_HTML);
      const tabB = host.querySelector('[data-icen-tab="b"]')!;
      return {
        init: () => initTabs(host),
        act: () => fire(tabB, 'click'),
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { tab: HTMLElement | null; panel: HTMLElement | null; index: number };
      expect(detail.index).toBe(1);
      expect(detail.tab?.getAttribute('data-icen-tab')).toBe('b');
      expect(detail.panel?.getAttribute('data-icen-tab-panel')).toBe('b');
    },
  },
  {
    name: 'controls/switch（开关）',
    events: ['icen:switch-change'],
    run(): InitCaseRun {
      const host = mount('<button class="icen-switch" role="switch" aria-checked="false"><span class="icen-switch-thumb"></span></button>');
      const sw = host.querySelector('.icen-switch')!;
      return {
        init: () => initSwitch(),
        act: () => fire(sw, 'click'),
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { el: HTMLElement; checked: boolean };
      expect(detail.checked).toBe(true);
      expect(detail.el.getAttribute('aria-checked')).toBe('true');
    },
  },
  {
    name: 'controls/stepper（数字步进器）',
    events: ['icen:stepper-change'],
    run(): InitCaseRun {
      const host = mount(`
        <div class="icen-stepper">
          <button class="icen-stepper-btn" data-icen-step="-1">−</button>
          <input class="icen-stepper-input" type="number" min="0" max="10" value="5" />
          <button class="icen-stepper-btn" data-icen-step="1">+</button>
        </div>
      `);
      const plus = host.querySelector('[data-icen-step="1"]')!;
      return {
        init: () => initStepper(),
        act: () => fire(plus, 'click'),
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { el: HTMLElement; value: number; delta: number };
      expect(detail.value).toBe(6);
      expect(detail.delta).toBe(1);
    },
  },
  {
    name: 'controls/segmented（分段控件）',
    events: ['icen:segmented-change'],
    run(): InitCaseRun {
      const host = mount(`
        <div class="icen-segmented" role="radiogroup">
          <button class="icen-segmented-item is-active" role="radio" aria-checked="true" data-icen-value="a">甲</button>
          <button class="icen-segmented-item" role="radio" aria-checked="false" data-icen-value="b">乙</button>
        </div>
      `);
      const itemB = host.querySelectorAll('.icen-segmented-item')[1]!;
      return {
        init: () => initSegmented(),
        act: () => fire(itemB, 'click'),
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { el: HTMLElement; value: string; index: number };
      expect(detail.value).toBe('b');
      expect(detail.index).toBe(1);
    },
  },
  {
    name: 'controls/steps（步骤条）',
    events: ['icen:step-change'],
    run(): InitCaseRun {
      const host = mount(`
        <ol class="icen-steps">
          <li class="icen-step icen-step--finish">提交</li>
          <li class="icen-step icen-step--process is-active">审核</li>
          <li class="icen-step icen-step--wait" role="button" tabindex="0">归档</li>
        </ol>
      `);
      const step3 = host.querySelectorAll('.icen-step')[2]!;
      return {
        init: () => initSteps(),
        act: () => fire(step3, 'click'),
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { step: HTMLElement; index: number };
      expect(detail.index).toBe(2);
      expect(detail.step.classList.contains('is-active')).toBe(true);
    },
  },
  {
    name: 'controls/rating（星级评分）',
    events: ['icen:rating-change'],
    run(): InitCaseRun {
      const host = mount(`
        <div class="icen-rating">
          <button class="icen-rating-star" aria-label="1 星"></button>
          <button class="icen-rating-star" aria-label="2 星"></button>
          <button class="icen-rating-star" aria-label="3 星"></button>
          <button class="icen-rating-star" aria-label="4 星"></button>
          <button class="icen-rating-star" aria-label="5 星"></button>
          <span class="icen-rating-value"></span>
        </div>
      `);
      const star4 = host.querySelectorAll('.icen-rating-star')[3]!;
      return {
        init: () => initRating(),
        act: () => fire(star4, 'click'),
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { el: HTMLElement; value: number };
      expect(detail.value).toBe(4); // 1 起算
    },
  },
  {
    name: 'controls/pagination（分页）',
    events: ['icen:page-change'],
    run(): InitCaseRun {
      const host = mount(`
        <nav class="icen-pagination" aria-label="分页">
          <button class="icen-page-btn is-active" aria-current="page" data-icen-page="1">1</button>
          <button class="icen-page-btn" data-icen-page="2">2</button>
          <button class="icen-page-btn" data-icen-page="3">3</button>
        </nav>
      `);
      const page2 = host.querySelectorAll('.icen-page-btn')[1]!;
      return {
        init: () => initPagination(),
        act: () => fire(page2, 'click'),
      };
    },
    checkDetail: (events) => {
      expect(events[0]!.detail).toMatchObject({ page: 2 });
    },
  },
  {
    name: 'controls/table-sort（静态表排序）',
    events: ['icen:sort-change'],
    run(): InitCaseRun {
      const host = mount('<table><thead><tr><th data-icen-sort="price">价格</th></tr></thead></table>');
      const th = host.querySelector('th[data-icen-sort]')!;
      return {
        init: () => initTableSort(),
        act: () => fire(th, 'click'),
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { th: HTMLElement; key: string; dir: string | null };
      expect(detail.key).toBe('price'); // 原始列 key（属性值被方向占用时转存 data-icen-sort-key）
      expect(detail.dir).toBe('asc'); // 循环 asc→desc→无
    },
  },
  {
    name: 'slider（滑块）',
    events: ['icen:slider-input'],
    run(): InitCaseRun {
      const host = mount(`
        <div class="icen-slider">
          <div class="icen-slider-track"></div>
          <div class="icen-slider-fill"></div>
          <div class="icen-slider-thumb"></div>
          <input class="icen-slider-native" type="range" min="0" max="100" value="40" />
        </div>
      `);
      const native = host.querySelector<HTMLInputElement>('.icen-slider-native')!;
      return {
        init: () => initSlider(host),
        act: () => {
          native.value = '80';
          fire(native, 'input');
        },
      };
    },
    checkDetail: (events) => {
      expect(events[0]!.detail).toEqual({ value: 80 });
    },
  },
  {
    name: 'upload（拖放上传区）',
    events: ['icen:upload'],
    run(): InitCaseRun {
      const host = mount('<div class="icen-upload" role="button" tabindex="0" data-icen-upload-list><input type="file" /></div>');
      const zone = host.querySelector('.icen-upload')!;
      return {
        init: () => initUpload(host),
        act: () => {
          const ev = new Event('drop', { bubbles: true, cancelable: true });
          Object.assign(ev, { dataTransfer: { files: [new File(['hello'], 'a.txt', { type: 'text/plain' })] } });
          zone.dispatchEvent(ev);
        },
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { files: File[] };
      expect(detail.files).toHaveLength(1);
      expect(detail.files[0]!.name).toBe('a.txt');
    },
  },
  {
    name: 'tree（树形）',
    events: ['icen:tree-toggle'],
    run(): InitCaseRun {
      const host = mount(`
        <ul class="icen-tree">
          <li>
            <div class="icen-tree-node" style="--depth:0">
              <button class="icen-tree-toggle" aria-expanded="true">t</button>
              <span class="icen-tree-label">父</span>
            </div>
            <ul>
              <li>
                <div class="icen-tree-node" style="--depth:1">
                  <span class="icen-tree-toggle"></span>
                  <span class="icen-tree-label">子</span>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      `);
      const toggle = host.querySelector('.icen-tree-node .icen-tree-toggle')!;
      return {
        init: () => initTree(host),
        act: () => fire(toggle, 'click'), // 展开态 → 点击折叠
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { node: HTMLElement; open: boolean };
      /* 修复后契约：点击路径与键盘 ←/→ 路径同语义——派切换后的状态（展开态点击折叠 → open:false） */
      expect(detail.open).toBe(false);
      expect(detail.node.tagName).toBe('LI'); // 契约：node 为 .icen-tree-node 所在的 li
    },
  },
  {
    name: 'accordion（手风琴）',
    events: ['icen:accordion-toggle'],
    run(): InitCaseRun {
      const host = mount(`
        <div class="accordion">
          <div class="icen-accordion-item is-open">
            <button class="icen-accordion-trigger" aria-expanded="true">一</button>
            <div class="icen-accordion-panel"><div class="icen-accordion-panel-inner">A</div></div>
          </div>
          <div class="icen-accordion-item">
            <button class="icen-accordion-trigger" aria-expanded="false">二</button>
            <div class="icen-accordion-panel"><div class="icen-accordion-panel-inner">B</div></div>
          </div>
        </div>
      `);
      const trigger2 = host.querySelectorAll('.icen-accordion-trigger')[1]!;
      return {
        init: () => initAccordion(host),
        act: () => fire(trigger2, 'click'),
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { item: HTMLElement; index: number; open: boolean };
      expect(detail.index).toBe(1); // 直系 .icen-accordion-item 序号
      expect(detail.open).toBe(true);
      expect(detail.item.classList.contains('is-open')).toBe(true);
    },
  },
];

for (const c of CASES) describeInitConformance(c);

/* ═══════════════ tabs：键盘/ARIA 契约 ═══════════════ */

describe('tabs 键盘与 ARIA 契约', () => {
  test('点击激活：is-active/aria-selected 位移、panel hidden 切换、roving tabindex（活动 0 其余 -1）', () => {
    const host = mount(TABS_HTML);
    const d = initTabs(host);
    try {
      const [tabA, tabB] = Array.from(host.querySelectorAll<HTMLElement>('[data-icen-tab]'));
      fire(tabB!, 'click');
      expect(tabB!.classList.contains('is-active')).toBe(true);
      expect(tabB!.getAttribute('aria-selected')).toBe('true');
      expect(tabA!.getAttribute('aria-selected')).toBe('false');
      expect(tabB!.tabIndex).toBe(0);
      expect(tabA!.tabIndex).toBe(-1);
      expect(host.querySelector('[data-icen-tab-panel="a"]')!.hasAttribute('hidden')).toBe(true);
      expect(host.querySelector('[data-icen-tab-panel="b"]')!.hasAttribute('hidden')).toBe(false);
      expect(host.querySelector('[data-icen-tab-panel="b"]')!.getAttribute('aria-labelledby')).toBe('tab-b');
    } finally {
      d();
    }
  });

  test('manual 激活模式（缺省）：方向键只移焦点不激活；Enter 才激活', () => {
    const host = mount(TABS_HTML);
    const cap = capture(['icen:tab-change']);
    const d = initTabs(host);
    try {
      const [tabA, tabB] = Array.from(host.querySelectorAll<HTMLElement>('[data-icen-tab]'));
      tabA!.focus();
      key(tabA!, 'ArrowRight');
      expect(document.activeElement).toBe(tabB); // 焦点跟移
      expect(cap.count()).toBe(0); // manual：不激活
      expect(tabB!.getAttribute('aria-selected')).toBe('false');
      key(tabB!, 'Enter');
      expect(cap.count()).toBe(1);
      expect(tabB!.getAttribute('aria-selected')).toBe('true');
    } finally {
      cap.restore();
      d();
    }
  });

  test('init 期补齐 role/aria 默认值并初始定位：无 is-active 时激活首个 tab（aria-selected=true、不派发事件）', () => {
    const host = mount(`
      <div data-icen-tabs>
        <nav class="icen-tabs">
          <button class="icen-page-tab" data-icen-tab="a">甲</button>
          <button class="icen-page-tab" data-icen-tab="b">乙</button>
        </nav>
        <section data-icen-tab-panel="a">A</section>
        <section data-icen-tab-panel="b">B</section>
      </div>
    `);
    const cap = capture(['icen:tab-change']);
    const d = initTabs(host);
    try {
      const nav = host.querySelector('.icen-tabs')!;
      expect(nav.getAttribute('role')).toBe('tablist');
      const tabs = Array.from(host.querySelectorAll('[data-icen-tab]'));
      for (const b of tabs) expect(b.getAttribute('role')).toBe('tab');
      // 初始定位（tabs.ts setup 末尾 activate(names[0], emit:false)）：首个 tab 激活、其余 false
      expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
      expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
      expect(host.querySelector('[data-icen-tab-panel="b"]')!.hasAttribute('hidden')).toBe(true);
      expect(cap.count()).toBe(0); // 初始化定位不派发
    } finally {
      cap.restore();
      d();
    }
  });
});

/* ═══════════════ controls 族：键盘/状态契约抽查 ═══════════════ */

describe('controls 族键盘与状态契约', () => {
  test('switch：Space/Enter 键盘翻转 aria-checked 并各派一次 icen:switch-change', () => {
    mount('<button class="icen-switch" role="switch" aria-checked="false"></button>');
    const sw = document.querySelector<HTMLElement>('.icen-switch')!;
    const cap = capture(['icen:switch-change']);
    const d = initSwitch();
    try {
      key(sw, ' ');
      expect(sw.getAttribute('aria-checked')).toBe('true');
      key(sw, 'Enter');
      expect(sw.getAttribute('aria-checked')).toBe('false');
      expect(cap.count()).toBe(2);
    } finally {
      cap.restore();
      d();
    }
  });

  test('radio：方向键组内移动选中并跟焦；重复点击已选项 no-op 不派发', () => {
    const host = mount(`
      <div class="icen-radio-group" role="radiogroup">
        <button class="icen-radio-item" role="radio" aria-checked="true">甲</button>
        <button class="icen-radio-item" role="radio" aria-checked="false">乙</button>
      </div>
    `);
    const cap = capture(['icen:check-change']);
    const d = initSwitch();
    try {
      const [a, b] = Array.from(host.querySelectorAll<HTMLElement>('.icen-radio-item'));
      key(a!, 'ArrowRight');
      expect(cap.count()).toBe(1);
      expect(b!.getAttribute('aria-checked')).toBe('true');
      expect(b!.classList.contains('is-selected')).toBe(true);
      expect(document.activeElement).toBe(b); // 跟焦
      fire(b!, 'click'); // 已选项：no-op
      expect(cap.count()).toBe(1);
    } finally {
      cap.restore();
      d();
    }
  });

  test('segmented：ArrowRight 移动选中并跟焦（radio 模式同族）', () => {
    const host = mount(`
      <div class="icen-segmented" role="radiogroup">
        <button class="icen-segmented-item is-active" role="radio" aria-checked="true" data-icen-value="a">甲</button>
        <button class="icen-segmented-item" role="radio" aria-checked="false" data-icen-value="b">乙</button>
      </div>
    `);
    const cap = capture(['icen:segmented-change']);
    const d = initSegmented();
    try {
      const [a, b] = Array.from(host.querySelectorAll<HTMLElement>('.icen-segmented-item'));
      key(a!, 'ArrowRight');
      expect(cap.count()).toBe(1);
      expect(b!.classList.contains('is-active')).toBe(true);
      expect(b!.getAttribute('aria-checked')).toBe('true');
      expect(document.activeElement).toBe(b);
    } finally {
      cap.restore();
      d();
    }
  });

  test('stepper：触界 clamp 时 delta 为 0 但事件仍派发（头注释契约）', () => {
    const host = mount(`
      <div class="icen-stepper">
        <button class="icen-stepper-btn" data-icen-step="-1">−</button>
        <input class="icen-stepper-input" type="number" min="0" max="10" value="10" />
        <button class="icen-stepper-btn" data-icen-step="1">+</button>
      </div>
    `);
    const cap = capture(['icen:stepper-change']);
    const d = initStepper();
    try {
      const input = host.querySelector<HTMLInputElement>('.icen-stepper-input')!;
      fire(host.querySelector('[data-icen-step="1"]')!, 'click');
      expect(cap.count()).toBe(1);
      const detail = cap.events[0]!.detail as { value: number; delta: number };
      expect(detail.value).toBe(10); // clamp 到 max
      expect(detail.delta).toBe(0);
      expect(input.value).toBe('10');
    } finally {
      cap.restore();
      d();
    }
  });

  test('rating：点击第 4 星 → 前 4 颗 .is-filled、value 回写；分页：is-active/aria-current 位移', () => {
    const host = mount(`
      <div class="icen-rating">
        <button class="icen-rating-star" aria-label="1 星"></button>
        <button class="icen-rating-star" aria-label="2 星"></button>
        <button class="icen-rating-star" aria-label="3 星"></button>
        <button class="icen-rating-star" aria-label="4 星"></button>
        <button class="icen-rating-star" aria-label="5 星"></button>
        <span class="icen-rating-value"></span>
      </div>
      <nav class="icen-pagination" aria-label="分页">
        <button class="icen-page-btn is-active" aria-current="page" data-icen-page="1">1</button>
        <button class="icen-page-btn" data-icen-page="2">2</button>
      </nav>
    `);
    const d1 = initRating();
    const d2 = initPagination();
    try {
      fire(host.querySelectorAll('.icen-rating-star')[3]!, 'click');
      const filled = host.querySelectorAll('.icen-rating-star.is-filled');
      expect(filled).toHaveLength(4);
      expect(host.querySelector('.icen-rating-value')!.textContent).toBe('4');
      fire(host.querySelectorAll('.icen-page-btn')[1]!, 'click');
      const [p1, p2] = Array.from(host.querySelectorAll('.icen-page-btn'));
      expect(p1!.classList.contains('is-active')).toBe(false);
      expect(p1!.hasAttribute('aria-current')).toBe(false);
      expect(p2!.classList.contains('is-active')).toBe(true);
      expect(p2!.getAttribute('aria-current')).toBe('page');
    } finally {
      d1();
      d2();
    }
  });
});

/* ═══════════════ slider：同步契约 ═══════════════ */

describe('slider 同步契约', () => {
  test('init 即同步一次 fill/thumb 百分比；input 再同步；change 派 icen:slider-change', () => {
    const host = mount(`
      <div class="icen-slider">
        <div class="icen-slider-track"></div>
        <div class="icen-slider-fill"></div>
        <div class="icen-slider-thumb"></div>
        <input class="icen-slider-native" type="range" min="0" max="100" value="40" />
      </div>
    `);
    const cap = capture(['icen:slider-input', 'icen:slider-change']);
    const d = initSlider(host);
    try {
      const fill = host.querySelector<HTMLElement>('.icen-slider-fill')!;
      const thumb = host.querySelector<HTMLElement>('.icen-slider-thumb')!;
      expect(fill.style.width).toBe('40%'); // 初始化先同步一次
      expect(thumb.style.left).toBe('40%');
      const native = host.querySelector<HTMLInputElement>('.icen-slider-native')!;
      native.value = '75';
      fire(native, 'input');
      expect(fill.style.width).toBe('75%');
      expect(thumb.style.left).toBe('75%');
      fire(native, 'change');
      expect(cap.events.map((e) => e.type)).toEqual(['icen:slider-input', 'icen:slider-change']);
      expectRegistered(['icen:slider-input', 'icen:slider-change']);
    } finally {
      cap.restore();
      d();
    }
  });
});

/* ═══════════════ upload：键盘/校验/文本纪律 ═══════════════ */

describe('upload 键盘与文本纪律', () => {
  const UPLOAD_HTML = '<div class="icen-upload" role="button" tabindex="0" data-icen-upload-list><input type="file" /></div>';

  function drop(zone: Element, files: File[]): void {
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.assign(ev, { dataTransfer: { files } });
    zone.dispatchEvent(ev);
  }

  test('列表模式：drop 渲染 .icen-upload-list-item（文件名 textContent + 大小格式化），移除钮派 icen:upload-remove', () => {
    const host = mount(UPLOAD_HTML);
    const zone = host.querySelector('.icen-upload')!;
    const cap = capture(['icen:upload', 'icen:upload-remove']);
    const d = initUpload(host);
    try {
      drop(zone, [new File(['hello'], 'a.txt', { type: 'text/plain' })]);
      const item = zone.querySelector('.icen-upload-list-item')!;
      expect(item.querySelector('.icen-upload-list-item-name')!.textContent).toBe('a.txt');
      expect(item.querySelector('.icen-upload-list-item-size')!.textContent).toBe('5 B');
      fire(item.querySelector('.icen-upload-list-item-x')!, 'click');
      expect(cap.events.map((e) => e.type)).toEqual(['icen:upload', 'icen:upload-remove']);
      expect(zone.querySelector('.icen-upload-list-item')).toBeNull();
      expectRegistered(['icen:upload', 'icen:upload-error', 'icen:upload-remove']);
    } finally {
      cap.restore();
      d();
    }
  });

  test('校验：accept 拒收派 icen:upload-error {file, reason}，不入列表', () => {
    const host = mount('<div class="icen-upload" role="button" tabindex="0" data-icen-upload-list><input type="file" accept=".png" /></div>');
    const zone = host.querySelector('.icen-upload')!;
    const cap = capture(['icen:upload', 'icen:upload-error']);
    const d = initUpload(host);
    try {
      drop(zone, [new File(['x'], 'evil.exe', { type: 'application/x-msdownload' })]);
      expect(cap.events.map((e) => e.type)).toEqual(['icen:upload-error']);
      const detail = cap.events[0]!.detail as { file: File | null; reason: string };
      expect(detail.file?.name).toBe('evil.exe');
      expect(typeof detail.reason).toBe('string');
      expect(zone.querySelector('.icen-upload-list-item')).toBeNull();
    } finally {
      cap.restore();
      d();
    }
  });

  test('键盘：Enter/Space 在 dropzone 上触发 input.click（role=button 契约）', () => {
    const host = mount(UPLOAD_HTML);
    const zone = host.querySelector<HTMLElement>('.icen-upload')!;
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    let clicks = 0;
    input.click = () => clicks++; // 拦截文件选择器弹出
    const d = initUpload(host);
    try {
      key(zone, 'Enter');
      key(zone, ' ');
      expect(clicks).toBe(2);
    } finally {
      d();
    }
  });

  test('XSS 文本纪律：文件名 <img onerror> 原样成文本（含移除钮 aria-label 属性面）', () => {
    const host = mount(UPLOAD_HTML);
    const zone = host.querySelector('.icen-upload')!;
    const d = initUpload(host);
    try {
      drop(zone, [new File(['x'], XSS_TEXT, { type: 'text/plain' })]);
      const name = zone.querySelector('.icen-upload-list-item-name')!;
      expectTextOnly(name);
      expect(zone.querySelector('img')).toBeNull();
      // 属性面（移除钮 aria-label 含文件名原文）是惰性文本；剥离属性后序列化不得有裸标记
      expectSerializedEscaped(zone);
    } finally {
      d();
    }
  });
});

/* ═══════════════ tree：选择/键盘契约 ═══════════════ */

describe('tree 选择与键盘契约', () => {
  const TREE_HTML = `
    <ul class="icen-tree">
      <li>
        <div class="icen-tree-node" style="--depth:0">
          <button class="icen-tree-toggle" aria-expanded="true">t</button>
          <span class="icen-tree-label">父</span>
        </div>
        <ul>
          <li>
            <div class="icen-tree-node" style="--depth:1">
              <span class="icen-tree-toggle"></span>
              <span class="icen-tree-label">子一</span>
            </div>
          </li>
          <li>
            <div class="icen-tree-node" style="--depth:1">
              <span class="icen-tree-toggle"></span>
              <span class="icen-tree-label">子二</span>
            </div>
          </li>
        </ul>
      </li>
    </ul>
  `;

  test('init 期补 tabindex=0（roving 焦点）；点击叶子节点单选：is-selected 互斥 + icen:tree-select {node}；分支不参与单选', () => {
    const host = mount(TREE_HTML);
    const cap = capture(['icen:tree-select']);
    const d = initTree(host);
    try {
      const nodes = Array.from(host.querySelectorAll<HTMLElement>('.icen-tree-node'));
      for (const n of nodes) expect(n.tabIndex).toBe(0); // 契约：可键盘聚焦
      fire(nodes[1]!.querySelector('.icen-tree-label')!, 'click');
      expect(cap.count()).toBe(1);
      const detail = cap.events[0]!.detail as { node: HTMLElement };
      expect(detail.node).toBe(nodes[1]); // node = .icen-tree-node 元素
      expect(nodes[1]!.classList.contains('is-selected')).toBe(true);
      // 分支节点（有子 ul）不参与单选：点击 label 不派发、不摘已选
      fire(nodes[0]!.querySelector('.icen-tree-label')!, 'click');
      expect(cap.count()).toBe(1);
      expect(nodes[1]!.classList.contains('is-selected')).toBe(true);
      // 叶子互斥：点另一叶子 → 前一叶子摘除
      fire(nodes[2]!.querySelector('.icen-tree-label')!, 'click');
      expect(cap.count()).toBe(2);
      expect(nodes[1]!.classList.contains('is-selected')).toBe(false);
      expect(nodes[2]!.classList.contains('is-selected')).toBe(true);
      expectRegistered(['icen:tree-select', 'icen:tree-toggle']);
    } finally {
      cap.restore();
      d();
    }
  });

  test('键盘：← 折叠分支（派 icen:tree-toggle open:false）、→ 展开；↑/↓ 轮转焦点', () => {
    const host = mount(TREE_HTML);
    const cap = capture(['icen:tree-toggle']);
    const d = initTree(host);
    try {
      const branch = host.querySelector<HTMLElement>('.icen-tree-node')!;
      const childUl = host.querySelector('li > ul')!;
      branch.focus();
      key(branch, 'ArrowLeft');
      expect(childUl.hasAttribute('hidden')).toBe(true);
      expect((cap.events[0]!.detail as { open: boolean }).open).toBe(false);
      key(branch, 'ArrowRight');
      expect(childUl.hasAttribute('hidden')).toBe(false);
      expect((cap.events[1]!.detail as { open: boolean }).open).toBe(true);
      key(branch, 'ArrowDown');
      expect(document.activeElement).toBe(host.querySelectorAll('.icen-tree-node')[1]!);
    } finally {
      cap.restore();
      d();
    }
  });
});

/* ═══════════════ accordion：single 模式/键盘契约 ═══════════════ */

describe('accordion single 模式与键盘契约', () => {
  test('data-icen-single：展开一项收起其余（连带收起项不单独派发）；aria-expanded 同步', () => {
    const host = mount(`
      <div class="accordion" data-icen-single>
        <div class="icen-accordion-item is-open">
          <button class="icen-accordion-trigger" aria-expanded="true">一</button>
          <div class="icen-accordion-panel"><div class="icen-accordion-panel-inner">A</div></div>
        </div>
        <div class="icen-accordion-item">
          <button class="icen-accordion-trigger" aria-expanded="false">二</button>
          <div class="icen-accordion-panel"><div class="icen-accordion-panel-inner">B</div></div>
        </div>
      </div>
    `);
    const cap = capture(['icen:accordion-toggle']);
    const d = initAccordion(host);
    try {
      const items = Array.from(host.querySelectorAll('.icen-accordion-item'));
      fire(items[1]!.querySelector('.icen-accordion-trigger')!, 'click');
      expect(cap.count()).toBe(1); // 只有被切换项派发
      expect(items[1]!.classList.contains('is-open')).toBe(true);
      expect(items[0]!.classList.contains('is-open')).toBe(false); // 连带收起
      expect(items[0]!.querySelector('.icen-accordion-trigger')!.getAttribute('aria-expanded')).toBe('false');
      expect(items[1]!.querySelector('.icen-accordion-trigger')!.getAttribute('aria-expanded')).toBe('true');
    } finally {
      cap.restore();
      d();
    }
  });

  test('键盘：Home/End 在 trigger 间移焦点', () => {
    const host = mount(`
      <div class="accordion">
        <div class="icen-accordion-item"><button class="icen-accordion-trigger">一</button></div>
        <div class="icen-accordion-item"><button class="icen-accordion-trigger">二</button></div>
        <div class="icen-accordion-item"><button class="icen-accordion-trigger">三</button></div>
      </div>
    `);
    const d = initAccordion(host);
    try {
      const triggers = Array.from(host.querySelectorAll<HTMLElement>('.icen-accordion-trigger'));
      triggers[0]!.focus();
      key(triggers[0]!, 'End');
      expect(document.activeElement).toBe(triggers[2]);
      key(triggers[2]!, 'Home');
      expect(document.activeElement).toBe(triggers[0]);
    } finally {
      d();
    }
  });
});

/* ═══════════════ input：幂等/功能契约（无销毁函数——见报告契约清单） ═══════════════ */

describe('input 幂等与功能契约', () => {
  test('清除钮：重复 init 不重复绑定——一次点击恰好清空一次、只派一个 input 事件并聚焦', () => {
    const host = mount(`
      <div class="icen-input-wrap">
        <input class="icen-input" value="abc" />
        <button class="icen-input-clear" type="button">×</button>
      </div>
    `);
    const input = host.querySelector<HTMLInputElement>('.icen-input')!;
    let inputEvents = 0;
    input.addEventListener('input', () => inputEvents++);
    initInput(host);
    initInput(host); // 幂等早退
    fire(host.querySelector('.icen-input-clear')!, 'click');
    expect(inputEvents).toBe(1);
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input); // 清空后聚焦
  });

  test('字符计数器：maxlength 自动插入 .icen-input-counter（重复 init 只一个），input 实时更新', () => {
    const host = mount(`
      <div class="icen-input-wrap">
        <input class="icen-input" maxlength="10" />
      </div>
    `);
    initInput(host);
    initInput(host);
    const counters = host.querySelectorAll('.icen-input-counter');
    expect(counters).toHaveLength(1); // 重复 init 不重复插入
    expect(counters[0]!.textContent).toBe('0 / 10');
    const input = host.querySelector<HTMLInputElement>('.icen-input')!;
    input.value = 'abcde';
    fire(input, 'input');
    expect(counters[0]!.textContent).toBe('5 / 10');
  });

  test('掩码：###-#### 实时格式化，原始值存 data-icen-raw-value', () => {
    const host = mount('<input class="icen-input" data-icen-mask="###-####" />');
    const input = host.querySelector<HTMLInputElement>('.icen-input')!;
    initInput(host);
    input.value = '1234567';
    fire(input, 'input');
    expect(input.value).toBe('123-4567');
    expect(input.getAttribute('data-icen-raw-value')).toBe('1234567');
  });

  test('OTP：输入取末字符跳下一格，填满派 icen:otp-complete {code} + .is-complete', () => {
    const host = mount(`
      <div class="icen-otp">
        <input class="icen-otp-cell" maxlength="1" />
        <input class="icen-otp-cell" maxlength="1" />
        <input class="icen-otp-cell" maxlength="1" />
        <input class="icen-otp-cell" maxlength="1" />
      </div>
    `);
    const cap = capture(['icen:otp-complete']);
    initInput(host);
    try {
      const cells = Array.from(host.querySelectorAll<HTMLInputElement>('.icen-otp-cell'));
      cells.forEach((cell, i) => {
        cell.value = String(i + 1);
        fire(cell, 'input');
      });
      expect(cap.count()).toBe(1);
      expect(cap.events[0]!.detail).toEqual({ code: '1234' });
      expect(host.querySelector('.icen-otp')!.classList.contains('is-complete')).toBe(true);
      expectRegistered(['icen:otp-complete']);
    } finally {
      cap.restore();
    }
  });

  // 契约缺口（见报告）：initInput 返回 void——全库 init 族唯一无销毁函数的 Core 组件
  // （AGENTS.md「init 全部幂等且返回销毁函数」与本模块头注释只承诺幂等不一致；以源码为准）。
  test('形态记录：initInput 幂等但无销毁函数（返回 void）', () => {
    const host = mount('<input class="icen-input" maxlength="5" />');
    expect(initInput(host)).toBeUndefined();
  });
});

/* ═══════════════ form-validate：校验/事件/文本纪律 ═══════════════ */

describe('form-validate 校验契约', () => {
  const FORM_HTML = `
    <form data-icen-validate data-icen-validate-summary>
      <div class="icen-field">
        <label for="f-user">姓名</label>
        <input class="icen-input" id="f-user" name="username" required />
      </div>
      <button type="submit">提交</button>
    </form>
  `;

  test('createFormValidator 幂等同例；validate() 未过：错误呈现五件套 + 两个事件 + 聚焦首错', async () => {
    const host = mount(FORM_HTML);
    const form = host.querySelector('form')!;
    const field = form.querySelector<HTMLInputElement>('[name="username"]')!;
    const cap = capture(['icen:form-field-validate', 'icen:form-valid', 'icen:form-invalid']);
    const v1 = createFormValidator(form);
    try {
      expect(createFormValidator(form)).toBe(v1); // 同一 form 单例
      expect(await v1.validate()).toBe(false);
      expect(cap.events.map((e) => e.type)).toEqual(['icen:form-field-validate', 'icen:form-invalid']);
      const fd = cap.events[0]!.detail as { name: string; valid: boolean; message?: string };
      expect(fd.name).toBe('username');
      expect(fd.valid).toBe(false);
      expect(typeof fd.message).toBe('string');
      const id = cap.events[1]!.detail as { errors: Record<string, string>; first: string | null };
      expect(id.first).toBe('username');
      expect(typeof id.errors['username']).toBe('string');
      // 错误呈现：wrap is-error + data-icen-invalid + 自动 p.icen-field-error[role=alert] + aria 接线
      const wrap = field.closest('.icen-field')!;
      expect(wrap.classList.contains('is-error')).toBe(true);
      expect(wrap.getAttribute('data-icen-invalid')).toBe('true');
      const err = wrap.querySelector<HTMLElement>('.icen-field-error')!;
      expect(err.getAttribute('role')).toBe('alert');
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby')).toContain(err.id);
      expect(document.activeElement).toBe(field); // focus 第一个错误字段
      expect(form.querySelector('.icen-form-validate-summary')).not.toBeNull(); // summary 契约
      expectRegistered(['icen:form-field-validate', 'icen:form-valid', 'icen:form-invalid']);
    } finally {
      cap.restore();
      v1.destroy();
    }
  });

  test('通过路径：icen:form-valid {names}，错误元素摘除、wrap 复位', async () => {
    const host = mount(FORM_HTML);
    const form = host.querySelector('form')!;
    const field = form.querySelector<HTMLInputElement>('[name="username"]')!;
    const cap = capture(['icen:form-valid', 'icen:form-invalid']);
    const v = createFormValidator(form);
    try {
      await v.validate(); // 先制造错误态
      field.value = '张三';
      expect(await v.validate()).toBe(true);
      expect(cap.events.map((e) => e.type)).toEqual(['icen:form-invalid', 'icen:form-valid']);
      expect(cap.events[1]!.detail).toEqual({ names: ['username'] });
      const wrap = field.closest('.icen-field')!;
      expect(wrap.classList.contains('is-error')).toBe(false);
      expect(wrap.querySelector('.icen-field-error')).toBeNull(); // 自动创建的错误元素被摘除
      expect(field.hasAttribute('aria-invalid')).toBe(false);
    } finally {
      cap.restore();
      v.destroy();
    }
  });

  test('提交接管：submit 被 preventDefault；destroy 后放行（不再接管）且可重新创建', async () => {
    const host = mount(FORM_HTML);
    const form = host.querySelector('form')!;
    const cap = capture(['icen:form-invalid']);
    const v = createFormValidator(form);
    try {
      const ev1 = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(ev1);
      expect(ev1.defaultPrevented).toBe(true); // 校验层接管提交
      await nextTick(20);
      expect(cap.count()).toBe(1);
      v.destroy();
      const ev2 = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(ev2);
      expect(ev2.defaultPrevented).toBe(false); // 销毁后不再接管
      await nextTick(20);
      expect(cap.count()).toBe(1);
      const v2 = createFormValidator(form); // 销毁后可重新创建（新实例）
      expect(v2).not.toBe(v);
      expect(await v2.validate()).toBe(false);
      v2.destroy();
    } finally {
      cap.restore();
    }
  });

  test('initFormValidate：自动 novalidate + 幂等（重复 init 提交只接管一次）+ destroy 复位', async () => {
    const host = mount(FORM_HTML);
    const form = host.querySelector('form')!;
    const cap = capture(['icen:form-invalid']);
    const d1 = initFormValidate();
    const d2 = initFormValidate(); // 幂等：返回 no-op
    try {
      expect(form.hasAttribute('novalidate')).toBe(true); // 原生气泡让位呈现层
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await nextTick(20);
      expect(cap.count()).toBe(1); // 委托未翻倍
      d1();
      d2();
      const ev = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(ev);
      await nextTick(20);
      expect(cap.count()).toBe(1); // 销毁后不再校验
      const d3 = initFormValidate(); // 可重新 init
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await nextTick(20);
      expect(cap.count()).toBe(2);
      d3();
    } finally {
      cap.restore();
    }
  });

  test('XSS 文本纪律：data-icen-msg-required 的 <img onerror> 原样成文本', async () => {
    const host = mount(`
      <form data-icen-validate>
        <div class="icen-field"><input class="icen-input" name="a" required /></div>
      </form>
    `);
    const form = host.querySelector('form')!;
    const field = form.querySelector<HTMLInputElement>('[name="a"]')!;
    field.setAttribute('data-icen-msg-required', XSS_TEXT);
    const v = createFormValidator(form);
    try {
      await v.validate();
      const err = form.querySelector<HTMLElement>('.icen-field-error')!;
      expectTextOnly(err);
      expectTextOnly(form);
    } finally {
      v.destroy();
    }
  });
});
