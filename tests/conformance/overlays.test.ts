// Core 浮层族一致性套件：popover / tooltip / modal / select / date-picker / command-palette /
// dropdown / context-menu。表驱动三契约（init 幂等 / destroy 可重入 / 事件登记+协议形态）
// 走 describeInitConformance（helpers.ts）；焦点/键盘与 XSS 文本纪律按组件头注释契约抽查。
// DOM 契约与事件契约的事实源：src/behaviors/<name>.ts 头注释 + src/components/<name>.css 头注释。
import { afterEach, describe, expect, test } from 'bun:test';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';
import {
  XSS_TEXT,
  capture,
  cleanupOverlays,
  describeInitConformance,
  expectTextOnly,
  key,
  type InitCaseRun,
} from './helpers';

import { initPopover } from '../../src/behaviors/popover';
import { initTooltip } from '../../src/behaviors/tooltip';
import { initModal } from '../../src/behaviors/modal';
import { initSelect } from '../../src/behaviors/select';
import { initDatePicker } from '../../src/behaviors/date-picker';
import { initCommandPalette } from '../../src/behaviors/command-palette';
import { initDropdown } from '../../src/behaviors/dropdown';
import { initContextMenu, registerContextMenu, unregisterContextMenu } from '../../src/behaviors/context-menu';

afterEach(() => {
  unregisterContextMenu('cm-conf');
  unmountAll();
  cleanupOverlays();
});

/* ═══════════════ 表驱动：init 幂等 / destroy / 事件登记 ═══════════════ */

const CASES: Parameters<typeof describeInitConformance>[0][] = [
  {
    name: 'popover（锚定浮层）',
    events: [], // 契约：popover 无领域事件（头注释未声明，纯 aria/portal 行为）
    sameDisposer: true, // 「同一 root 重复 init 返回同一销毁函数」
    run(): InitCaseRun {
      const host = mount(`
        <button data-icen-popover-target="p1">开</button>
        <div class="icen-popover" id="p1" hidden><button data-icen-autofocus>内</button></div>
      `);
      const trigger = host.querySelector<HTMLElement>('[data-icen-popover-target]')!;
      return {
        init: () => initPopover(host),
        act: () => fire(trigger, 'click'),
        // 一次点击 = 打开（aria-expanded=true）；若重复绑定会开→关归零，被本信号抓住
        signal: () => (trigger.getAttribute('aria-expanded') === 'true' ? 1 : 0),
      };
    },
  },
  {
    name: 'tooltip（气泡提示）',
    events: [], // 契约：tooltip 无领域事件（aria-describedby + role=tooltip 即全部呈现面）
    sameDisposer: true, // 「同一 root 重复 init 返回同一销毁函数」
    run(): InitCaseRun {
      const host = mount('<button data-icen-tooltip="提示文本">悬</button>');
      const trigger = host.querySelector('button')!;
      return {
        init: () => initTooltip(host),
        act: () => {
          // 键盘 :focus-visible 立即显示（头注释触发约定）；手动补 focusin 保证重入场景再派
          trigger.focus();
          trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        },
        signal: () => document.querySelectorAll('.icen-tooltip[role="tooltip"]').length,
      };
    },
  },
  {
    name: 'modal（对话框）',
    events: ['icen:modal-open'],
    sameDisposer: true, // document 级单例委托，重复 init 返回同一销毁函数
    run(): InitCaseRun {
      mount(`
        <button data-icen-modal-open="m1">开</button>
        <div class="icen-modal-backdrop" data-icen-modal="m1" hidden>
          <div class="icen-modal">
            <h2 class="icen-modal-title">标题</h2>
            <button data-icen-modal-close>关</button>
            <button class="ok">好</button>
          </div>
        </div>
      `);
      const opener = document.querySelector<HTMLElement>('[data-icen-modal-open]')!;
      return {
        init: () => initModal(),
        act: () => fire(opener, 'click'),
      };
    },
    checkDetail: (events) => {
      expect(events[0]!.detail).toEqual({ id: 'm1' });
    },
  },
  {
    name: 'select（弹层选择器）',
    events: ['icen:select-change'],
    run(): InitCaseRun {
      const host = mount(`
        <div class="icen-select" data-icen-select>
          <button class="icen-select-trigger"><span class="icen-select-value is-empty">占位</span></button>
          <div class="icen-select-panel" hidden>
            <button class="icen-select-option" data-icen-value="a">甲</button>
            <button class="icen-select-option" data-icen-value="b">乙</button>
          </div>
          <input type="hidden" data-icen-select-value />
        </div>
      `);
      return {
        init: () => initSelect(host),
        act: () => {
          fire(host.querySelector('.icen-select-trigger')!, 'click'); // 开面板（portal 到 body）
          fire(document.querySelectorAll('.icen-select-option')[1]!, 'click'); // 选「乙」
        },
      };
    },
    checkDetail: (events) => {
      expect(events[0]!.detail).toEqual({ value: 'b', values: ['b'], label: '乙' });
    },
  },
  {
    name: 'date-picker（日期选择）',
    events: ['icen:date-change'],
    run(): InitCaseRun {
      const host = mount('<div class="icen-date-picker" data-icen-date-picker><input type="hidden" name="d" /></div>');
      return {
        init: () => initDatePicker(host),
        act: () => {
          const trigger = host.querySelector('.icen-date-picker-trigger');
          if (trigger) fire(trigger, 'click'); // destroy 后触发器被回收，点击路径整体缺席
          const day = document.querySelector(
            '.icen-date-picker-panel .icen-date-picker-cell:not(.is-outside):not(.is-disabled)',
          );
          if (day) fire(day, 'click');
        },
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { value: string; date: Date | null };
      expect(detail.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(detail.date).toBeInstanceOf(Date);
    },
  },
  {
    name: 'command-palette（命令面板）',
    events: ['icen:command-palette-open'],
    sameDisposer: true, // document 级单例委托
    run(): InitCaseRun {
      mount(`
        <button data-icen-command-palette-open="cp">开</button>
        <div class="icen-command-palette-backdrop" data-icen-command-palette="cp" hidden>
          <div class="icen-command-palette">
            <input class="icen-command-palette-input" />
            <div class="icen-command-palette-body">
              <button class="icen-command-palette-item" type="button" data-icen-value="x">条目甲</button>
            </div>
          </div>
        </div>
      `);
      const opener = document.querySelector('[data-icen-command-palette-open]')!;
      return {
        init: () => initCommandPalette(),
        act: () => fire(opener, 'click'),
      };
    },
    checkDetail: (events) => {
      expect(events[0]!.detail).toEqual({}); // 契约：detail 为空对象
    },
  },
  {
    name: 'dropdown（下拉菜单）',
    events: ['icen:menu-select'],
    sameDisposer: true, // 「initDropdown(scope?) 返回幂等 disposer」
    run(): InitCaseRun {
      const host = mount(`
        <div data-icen-dropdown>
          <button data-icen-dropdown-trigger>菜单</button>
          <div data-icen-dropdown-menu hidden>
            <button class="icen-menu-item" data-icen-value="a">甲</button>
            <button class="icen-menu-item" data-icen-value="b">乙</button>
          </div>
        </div>
      `);
      const trigger = host.querySelector('[data-icen-dropdown-trigger]')!;
      return {
        init: () => initDropdown(host),
        act: () => {
          fire(trigger, 'click');
          const item = document.body.querySelector<HTMLElement>(':scope > .icen-menu .icen-menu-item');
          if (item) fire(item, 'click'); // destroy 后无面板，此步缺席
        },
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { source: HTMLElement; item: HTMLElement; value: string; label: string };
      expect(detail.value).toBe('a'); // 实现读 data-icen-value（头注释写 dataset.value，不符——见报告）
      expect(detail.label).toBe('甲');
      expect(detail.item.classList.contains('icen-menu-item')).toBe(true);
      expect(detail.source.classList.contains('icen-menu')).toBe(true);
    },
  },
  {
    name: 'context-menu（右键菜单）',
    events: ['icen:menu-select'],
    sameDisposer: true, // document 级单例委托
    run(): InitCaseRun {
      const host = mount('<div data-icen-context-menu="cm-conf">区</div>');
      registerContextMenu('cm-conf', [{ label: '刷新' }]);
      const zone = host.querySelector('[data-icen-context-menu]')!;
      return {
        init: () => initContextMenu(),
        act: () => {
          zone.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
          const item = document.body.querySelector<HTMLElement>(':scope > .icen-menu--context .icen-menu-item');
          if (item) fire(item, 'click');
        },
      };
    },
    checkDetail: (events) => {
      const detail = events[0]!.detail as { value: string; label: string };
      expect(detail.label).toBe('刷新');
      expect(detail.value).toBe(''); // 条目未带 data-icen-value → 空串
    },
  },
];

for (const c of CASES) describeInitConformance(c);

/* ═══════════════ popover：焦点/键盘契约 ═══════════════ */

describe('popover 焦点/键盘契约', () => {
  test('打开：panel portal 到 body、同步 aria-expanded/controls、聚焦 [data-icen-autofocus]', () => {
    const host = mount(`
      <button data-icen-popover-target="p1">开</button>
      <div class="icen-popover" id="p1" hidden><button data-icen-autofocus>内</button></div>
    `);
    const d = initPopover(host);
    try {
      const trigger = host.querySelector<HTMLElement>('[data-icen-popover-target]')!;
      const panel = document.getElementById('p1')!;
      fire(trigger, 'click');
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(trigger.getAttribute('aria-controls')).toBe('p1');
      expect(panel.parentElement).toBe(document.body); // portal 跳出祖先 stacking context
      expect(panel.hidden).toBe(false);
      expect(document.activeElement).toBe(panel.querySelector('[data-icen-autofocus]'));
    } finally {
      d();
    }
  });

  test('Esc 关闭：aria-expanded 归 false、焦点还原触发器；再点重开', () => {
    const host = mount(`
      <button data-icen-popover-target="p1">开</button>
      <div class="icen-popover" id="p1" hidden><button data-icen-autofocus>内</button></div>
    `);
    const d = initPopover(host);
    try {
      const trigger = host.querySelector<HTMLElement>('[data-icen-popover-target]')!;
      fire(trigger, 'click');
      key(document.activeElement!, 'Escape');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger); // ownsFocus → returnFocus=anchor
      fire(trigger, 'click'); // 重开续接
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    } finally {
      d();
    }
  });
});

/* ═══════════════ tooltip：呈现/键盘/XSS 契约 ═══════════════ */

describe('tooltip 呈现与文本纪律', () => {
  test('打开期间 aria-describedby 指向气泡（role=tooltip）、触发器挂 live 抑制 CSS 回退；Escape 关闭', async () => {
    const host = mount('<button data-icen-tooltip="提示文本">悬</button>');
    const trigger = host.querySelector('button')!;
    const d = initTooltip(host);
    try {
      trigger.focus();
      trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      const bubble = document.querySelector<HTMLElement>('.icen-tooltip')!;
      expect(bubble.getAttribute('role')).toBe('tooltip');
      expect(bubble.textContent).toBe('提示文本');
      expect(trigger.getAttribute('aria-describedby')).toContain(bubble.id);
      expect(trigger.hasAttribute('data-icen-tooltip-live')).toBe(true);
      await nextTick(30); // rAF 后挂 is-open
      expect(bubble.classList.contains('is-open')).toBe(true);
      key(trigger, 'Escape');
      expect(bubble.classList.contains('is-open')).toBe(false); // 视觉先退场
      await nextTick(300); // LEAVE_TIMEOUT_MS=240 落定摘除
      expect(document.querySelector('.icen-tooltip')).toBeNull();
    } finally {
      d();
    }
  });

  test('销毁进行中的显示：dispose 立即摘除气泡并归还触发器属性', () => {
    const host = mount('<button data-icen-tooltip="提示文本">悬</button>');
    const trigger = host.querySelector('button')!;
    const d = initTooltip(host);
    trigger.focus();
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.querySelector('.icen-tooltip')).not.toBeNull();
    d();
    expect(document.querySelector('.icen-tooltip')).toBeNull(); // 「立即摘除气泡」
    expect(trigger.hasAttribute('data-icen-tooltip-live')).toBe(false);
  });

  test('XSS 文本纪律：data-icen-tooltip 的 <img onerror> 原样成文本', () => {
    const host = mount('<button>悬</button>');
    const trigger = host.querySelector('button')!;
    trigger.setAttribute('data-icen-tooltip', XSS_TEXT); // 属性注入绕开 mount 的 innerHTML
    const d = initTooltip(host);
    try {
      trigger.focus();
      trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      const bubble = document.querySelector<HTMLElement>('.icen-tooltip')!;
      expectTextOnly(bubble);
    } finally {
      d();
    }
  });
});

/* ═══════════════ modal：焦点陷阱/键盘/呈现契约 ═══════════════ */

describe('modal 焦点与键盘契约', () => {
  const MOUNT = `
    <button data-icen-modal-open="m1">开</button>
    <div class="icen-modal-backdrop" data-icen-modal="m1" hidden>
      <div class="icen-modal">
        <h2 class="icen-modal-title">标题</h2>
        <button data-icen-modal-close>关</button>
        <button class="ok">好</button>
      </div>
    </div>
  `;

  test('打开：backdrop portal 到 body、role=dialog/aria-modal/tabindex=-1、aria-labelledby 自动绑标题、聚焦首个可聚焦', () => {
    mount(MOUNT);
    const d = initModal();
    try {
      const opener = document.querySelector<HTMLElement>('[data-icen-modal-open]')!;
      opener.focus();
      fire(opener, 'click');
      const backdrop = document.querySelector<HTMLElement>('.icen-modal-backdrop')!;
      const panel = backdrop.querySelector<HTMLElement>('.icen-modal')!;
      expect(backdrop.parentElement).toBe(document.body); // portal
      expect(backdrop.hidden).toBe(false);
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(panel.getAttribute('aria-modal')).toBe('true');
      expect(panel.tabIndex).toBe(-1);
      const title = panel.querySelector<HTMLElement>('.icen-modal-title')!;
      expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
      expect(opener.getAttribute('aria-haspopup')).toBe('dialog'); // initModal normalizeControls
      expect(document.body.style.overflow).toBe('hidden'); // 滚动锁
      expect(document.activeElement).toBe(panel.querySelector('[data-icen-modal-close]')); // 首个可聚焦
    } finally {
      d();
    }
  });

  test('Esc 关闭：派 icen:modal-close {id}、焦点还原打开器、滚动锁复位；Tab 焦点陷阱循环', () => {
    mount(MOUNT);
    const cap = capture(['icen:modal-close']);
    const d = initModal();
    try {
      const opener = document.querySelector<HTMLElement>('[data-icen-modal-open]')!;
      opener.focus();
      fire(opener, 'click');
      const panel = document.querySelector<HTMLElement>('.icen-modal')!;
      const closeBtn = panel.querySelector<HTMLElement>('[data-icen-modal-close]')!;
      const okBtn = panel.querySelector<HTMLElement>('.ok')!;

      // Tab 陷阱：焦点在末位时 Tab 绕回首位
      okBtn.focus();
      key(window, 'Tab');
      expect(document.activeElement).toBe(closeBtn);
      // Shift+Tab 在首位时绕回末位
      key(window, 'Tab', { shiftKey: true });
      expect(document.activeElement).toBe(okBtn);

      key(window, 'Escape');
      expect(cap.count()).toBe(1);
      expect(cap.events[0]!.detail).toEqual({ id: 'm1' });
      expect(document.activeElement).toBe(opener); // 焦点还原
      expect(document.body.style.overflow).toBe(''); // 滚动锁恢复旧值
      expect(document.querySelector('.icen-modal-backdrop')!.hasAttribute('hidden')).toBe(true);
    } finally {
      cap.restore();
      d();
    }
  });

  test('关闭钮委托：点 [data-icen-modal-close] 关闭', () => {
    mount(MOUNT);
    const cap = capture(['icen:modal-close']);
    const d = initModal();
    try {
      fire(document.querySelector('[data-icen-modal-open]')!, 'click');
      fire(document.querySelector('[data-icen-modal-close]')!, 'click');
      expect(cap.count()).toBe(1);
    } finally {
      cap.restore();
      d();
    }
  });
});

/* ═══════════════ select：键盘/XSS/表单同步契约 ═══════════════ */

describe('select 键盘与文本纪律', () => {
  const SELECT_HTML = `
    <div class="icen-select" data-icen-select>
      <button class="icen-select-trigger"><span class="icen-select-value is-empty">占位</span></button>
      <div class="icen-select-panel" hidden>
        <button class="icen-select-option" data-icen-value="a">甲</button>
        <button class="icen-select-option" data-icen-value="b">乙</button>
      </div>
      <input type="hidden" data-icen-select-value />
    </div>
  `;

  test('键盘：trigger ArrowDown 打开并聚焦首项；↓ 移动 .is-focused；Enter 选中；Esc 关闭并焦点回 trigger', () => {
    const host = mount(SELECT_HTML);
    const cap = capture(['icen:select-change']);
    const d = initSelect(host);
    try {
      const trigger = host.querySelector<HTMLElement>('.icen-select-trigger')!;
      expect(trigger.getAttribute('aria-haspopup')).toBe('listbox'); // init 期补齐
      key(trigger, 'ArrowDown');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      const options = document.querySelectorAll<HTMLElement>('.icen-select-option');
      expect(options[0]!.classList.contains('is-focused')).toBe(true);
      key(trigger, 'ArrowDown');
      expect(options[1]!.classList.contains('is-focused')).toBe(true);
      key(trigger, 'Enter');
      expect(cap.count()).toBe(1);
      expect((cap.events[0]!.detail as { value: string }).value).toBe('b');
      expect(trigger.getAttribute('aria-expanded')).toBe('false'); // 选中即关
      // 重开再 Esc
      key(trigger, 'ArrowDown');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      key(trigger, 'Escape');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    } finally {
      cap.restore();
      d();
    }
  });

  test('选中同步：hidden input value + 原生 change 双通道；trigger 文本更新', () => {
    const host = mount(SELECT_HTML);
    const d = initSelect(host);
    try {
      const hidden = host.querySelector<HTMLInputElement>('input[data-icen-select-value]')!;
      let nativeChange = 0;
      hidden.addEventListener('change', () => nativeChange++);
      fire(host.querySelector('.icen-select-trigger')!, 'click');
      fire(document.querySelectorAll('.icen-select-option')[1]!, 'click');
      expect(hidden.value).toBe('b');
      expect(nativeChange).toBe(1);
      expect(host.querySelector('.icen-select-value')!.textContent).toBe('乙');
      expect(host.querySelector('.icen-select-value')!.classList.contains('is-empty')).toBe(false);
    } finally {
      d();
    }
  });

  test('XSS 文本纪律：选项文本 <img onerror> 经 trigger 值回显仍原样成文本', () => {
    const host = mount(SELECT_HTML);
    const opt = host.querySelectorAll('.icen-select-option')[1]!;
    opt.textContent = XSS_TEXT; // 行为层渲染路径的输入面（作者 HTML 本身可信，不测）
    const d = initSelect(host);
    try {
      fire(host.querySelector('.icen-select-trigger')!, 'click');
      fire(document.querySelectorAll('.icen-select-option')[1]!, 'click');
      expectTextOnly(host.querySelector('.icen-select-value')!);
      expectTextOnly(host);
    } finally {
      d();
    }
  });
});

/* ═══════════════ date-picker：键盘/呈现/XSS 契约 ═══════════════ */

describe('date-picker 键盘与呈现契约', () => {
  test('trigger 自动生成（aria-haspopup=dialog/expanded=false）；打开：panel role=dialog portal 到 body、aria 接线', () => {
    const host = mount('<div class="icen-date-picker" data-icen-date-picker><input type="hidden" name="d" /></div>');
    const d = initDatePicker(host);
    try {
      const root = host.querySelector('.icen-date-picker')!;
      const trigger = root.querySelector<HTMLElement>('.icen-date-picker-trigger')!;
      expect(trigger).not.toBeNull(); // 「Trigger/value/icon are created when absent」
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      fire(trigger, 'click');
      const panel = document.body.querySelector<HTMLElement>(':scope > .icen-date-picker-panel')!;
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.querySelector('.icen-date-picker-grid')!.getAttribute('role')).toBe('grid');
    } finally {
      d();
    }
  });

  test('Esc 关闭并焦点回 trigger；trigger ArrowDown 也可打开；选中回写 hidden input 值', () => {
    const host = mount('<div class="icen-date-picker" data-icen-date-picker><input type="hidden" name="d" /></div>');
    const cap = capture(['icen:date-change']);
    const d = initDatePicker(host);
    try {
      const root = host.querySelector('.icen-date-picker')!;
      const trigger = root.querySelector<HTMLElement>('.icen-date-picker-trigger')!;
      const input = root.querySelector<HTMLInputElement>('input[type="hidden"]')!;
      key(trigger, 'ArrowDown'); // 头注释：trigger 上 ↓/↑ 打开
      expect(document.body.querySelector(':scope > .icen-date-picker-panel')).not.toBeNull();
      const day = document.querySelector<HTMLElement>(
        '.icen-date-picker-panel .icen-date-picker-cell:not(.is-outside):not(.is-disabled)',
      )!;
      fire(day, 'click');
      expect(cap.count()).toBe(1);
      expect(input.value).toBe((cap.events[0]!.detail as { value: string }).value); // native form value
      expect(document.body.querySelector(':scope > .icen-date-picker-panel')).toBeNull(); // 选中即关
      expect(document.activeElement).toBe(trigger); // 焦点归还
      // 再开 → Esc
      fire(trigger, 'click');
      expect(document.body.querySelector(':scope > .icen-date-picker-panel')).not.toBeNull();
      key(document, 'Escape');
      expect(document.body.querySelector(':scope > .icen-date-picker-panel')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      cap.restore();
      d();
    }
  });

  test('XSS 文本纪律：data-icen-date-picker-placeholder 的 <img onerror> 原样成文本', () => {
    const host = mount('<div class="icen-date-picker" data-icen-date-picker><input type="hidden" name="d" /></div>');
    const root = host.querySelector('.icen-date-picker')!;
    root.setAttribute('data-icen-date-picker-placeholder', XSS_TEXT);
    const d = initDatePicker(host);
    try {
      expectTextOnly(root.querySelector('.icen-date-picker-value')!);
    } finally {
      d();
    }
  });
});

/* ═══════════════ command-palette：键盘/呈现契约 ═══════════════ */

describe('command-palette 键盘契约', () => {
  const PALETTE_HTML = `
    <button data-icen-command-palette-open="cp">开</button>
    <div class="icen-command-palette-backdrop" data-icen-command-palette="cp" hidden>
      <div class="icen-command-palette">
        <input class="icen-command-palette-input" />
        <div class="icen-command-palette-body">
          <button class="icen-command-palette-item" type="button" data-icen-value="x">条目甲</button>
          <button class="icen-command-palette-item" type="button" data-icen-value="y">条目乙</button>
        </div>
      </div>
    </div>
  `;

  test('打开：backdrop 显现、滚动锁、聚焦搜索框；↑↓ 移动 is-active；点击条目派 menu-select（一次）并关闭', () => {
    mount(PALETTE_HTML);
    const cap = capture(['icen:command-palette-open', 'icen:command-palette-close', 'icen:menu-select']);
    const d = initCommandPalette();
    try {
      const opener = document.querySelector<HTMLElement>('[data-icen-command-palette-open]')!;
      opener.focus();
      fire(opener, 'click');
      const backdrop = document.querySelector<HTMLElement>('.icen-command-palette-backdrop')!;
      expect(backdrop.hidden).toBe(false);
      expect(document.body.style.overflow).toBe('hidden');
      const input = backdrop.querySelector<HTMLInputElement>('.icen-command-palette-input')!;
      expect(document.activeElement).toBe(input); // 打开聚焦搜索框
      expect(opener.getAttribute('aria-haspopup')).toBe('dialog');

      // 打开即首项 is-active（openCommandPalette 末尾 filterPanel → setActive(panel, 0)）
      const items = backdrop.querySelectorAll('.icen-command-palette-item');
      expect(items[0]!.classList.contains('is-active')).toBe(true);
      key(input, 'ArrowDown');
      expect(items[0]!.classList.contains('is-active')).toBe(false);
      expect(items[1]!.classList.contains('is-active')).toBe(true);
      key(input, 'ArrowUp');
      expect(items[0]!.classList.contains('is-active')).toBe(true);

      fire(items[0]!, 'click'); // 点击路径：恰好一次 menu-select
      const menuSelects = cap.events.filter((e) => e.type === 'icen:menu-select');
      expect(menuSelects).toHaveLength(1);
      const detail = menuSelects[0]!.detail as { value: string; label: string };
      expect(detail.value).toBe('x');
      expect(detail.label).toBe('条目甲');
      expect(cap.events.filter((e) => e.type === 'icen:command-palette-close')).toHaveLength(1); // 默认选中即关
      expect(document.body.style.overflow).toBe('');
    } finally {
      cap.restore();
      d();
    }
  });

  test('全局快捷键 Ctrl+K 打开；Esc 关闭（焦点还原）', () => {
    mount(PALETTE_HTML);
    const cap = capture(['icen:command-palette-open', 'icen:command-palette-close']);
    const d = initCommandPalette();
    try {
      const opener = document.querySelector<HTMLElement>('[data-icen-command-palette-open]')!;
      opener.focus();
      key(window, 'k', { ctrlKey: true });
      expect(cap.events.filter((e) => e.type === 'icen:command-palette-open')).toHaveLength(1);
      key(document.querySelector('.icen-command-palette-input')!, 'Escape');
      expect(cap.events.filter((e) => e.type === 'icen:command-palette-close')).toHaveLength(1);
      expect(document.activeElement).toBe(opener);
    } finally {
      cap.restore();
      d();
    }
  });

  // 修复后契约：Enter 选中收敛到 click 路径（document 委托派一次），与鼠标点击同次数。
  test('Enter 选中 DOM 条目：menu-select 恰好派发一次（与点击路径一致）', () => {
    mount(PALETTE_HTML);
    const cap = capture(['icen:menu-select']);
    const d = initCommandPalette();
    try {
      fire(document.querySelector('[data-icen-command-palette-open]')!, 'click');
      const input = document.querySelector('.icen-command-palette-input')!;
      key(input, 'ArrowDown');
      key(input, 'Enter');
      expect(cap.count()).toBe(1);
    } finally {
      cap.restore();
      d();
    }
  });
});

/* ═══════════════ dropdown：键盘/呈现契约 ═══════════════ */

describe('dropdown 键盘与呈现契约', () => {
  const DROPDOWN_HTML = `
    <div data-icen-dropdown>
      <button data-icen-dropdown-trigger>菜单</button>
      <div data-icen-dropdown-menu hidden>
        <button class="icen-menu-item" data-icen-value="a">甲</button>
        <button class="icen-menu-item" data-icen-value="b">乙</button>
      </div>
    </div>
  `;

  test('打开：模板子节点搬入 body 的 .icen-menu[role=menu]、trigger aria-expanded/controls、条目 role=menuitem', () => {
    const host = mount(DROPDOWN_HTML);
    const d = initDropdown(host);
    try {
      const trigger = host.querySelector<HTMLElement>('[data-icen-dropdown-trigger]')!;
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu'); // init 期补齐
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      fire(trigger, 'click');
      const panel = document.body.querySelector<HTMLElement>(':scope > .icen-menu')!;
      expect(panel.getAttribute('role')).toBe('menu');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
      const item = panel.querySelector<HTMLElement>('.icen-menu-item')!;
      expect(item.getAttribute('role')).toBe('menuitem');
    } finally {
      d();
    }
  });

  test('trigger ArrowDown 打开并高亮首项（roving tabindex）；Esc 关闭并焦点回 trigger', async () => {
    const host = mount(DROPDOWN_HTML);
    const d = initDropdown(host);
    try {
      const trigger = host.querySelector<HTMLElement>('[data-icen-dropdown-trigger]')!;
      trigger.focus();
      key(trigger, 'ArrowDown');
      const panel = document.body.querySelector<HTMLElement>(':scope > .icen-menu')!;
      expect(panel).not.toBeNull();
      await nextTick(30); // openDropdown 的 rAF 聚焦首项
      const first = panel.querySelectorAll<HTMLElement>('.icen-menu-item')[0]!;
      expect(first.classList.contains('is-highlighted')).toBe(true);
      expect(first.tabIndex).toBe(0);
      expect(panel.querySelectorAll<HTMLElement>('.icen-menu-item')[1]!.tabIndex).toBe(-1);
      key(first, 'Escape');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    } finally {
      d();
    }
  });
});

/* ═══════════════ context-menu：呈现/键盘/XSS 契约 ═══════════════ */

describe('context-menu 呈现与文本纪律', () => {
  test('打开：.icen-menu.icen-menu--context[role=menu] 落 body；条目点击派 menu-select + 调 onClick；Esc 关闭', () => {
    const host = mount('<div data-icen-context-menu="cm-conf">区</div>');
    let clicked = 0;
    registerContextMenu('cm-conf', [{ label: '刷新', onClick: () => clicked++ }, { type: 'separator' }, { label: ' pinned', disabled: true }]);
    const cap = capture(['icen:menu-select']);
    const d = initContextMenu();
    try {
      const zone = host.querySelector('[data-icen-context-menu]')!;
      zone.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
      const panel = document.body.querySelector<HTMLElement>(':scope > .icen-menu--context')!;
      expect(panel.getAttribute('role')).toBe('menu');
      expect(panel.querySelector('.icen-menu-separator')).not.toBeNull();
      const items = panel.querySelectorAll<HTMLElement>('.icen-menu-item');
      expect(items[0]!.getAttribute('role')).toBe('menuitem');
      expect(items[1]!.hasAttribute('disabled')).toBe(true); // disabled 条目不接线
      fire(items[0]!, 'click');
      expect(clicked).toBe(1);
      expect(cap.count()).toBe(1);
      expect(document.body.querySelector(':scope > .icen-menu--context')).toBeNull(); // 选中即关
      // 重开 → Esc 关闭
      zone.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
      expect(document.body.querySelector(':scope > .icen-menu--context')).not.toBeNull();
      key(document.body.querySelector(':scope > .icen-menu--context .icen-menu-item')!, 'Escape');
      expect(document.body.querySelector(':scope > .icen-menu--context')).toBeNull();
    } finally {
      cap.restore();
      d();
    }
  });

  test('XSS 文本纪律：条目 label 的 <img onerror> 原样成文本（icon 是唯一声明的 innerHTML 口子，不喂）', () => {
    const host = mount('<div data-icen-context-menu="cm-conf">区</div>');
    registerContextMenu('cm-conf', [{ label: XSS_TEXT }]);
    const d = initContextMenu();
    try {
      host.querySelector('[data-icen-context-menu]')!.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }),
      );
      const panel = document.body.querySelector<HTMLElement>(':scope > .icen-menu--context')!;
      expectTextOnly(panel.querySelector('.icen-menu-item-label')!);
      expectTextOnly(panel);
    } finally {
      d();
    }
  });

  test('未注册 id 命中默认菜单；destroy 顺带关掉开着的菜单', () => {
    const host = mount('<div data-icen-context-menu="cm-unregistered">区</div>');
    const d = initContextMenu();
    try {
      host.querySelector('[data-icen-context-menu]')!.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }),
      );
      const panel = document.body.querySelector<HTMLElement>(':scope > .icen-menu--context');
      expect(panel).not.toBeNull(); // 默认菜单（后退/前进/刷新/复制链接）
      d();
      expect(document.body.querySelector(':scope > .icen-menu--context')).toBeNull();
    } finally {
      d();
    }
  });
});
