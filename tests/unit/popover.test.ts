// popover 尺寸契约测试：readPanelSizing 属性面读取（非法值跳过）、resolvePanelSizing
// 程序面 > 属性面优先级、applyPanelSizing 的视口夹取（宽一律夹到视口宽 −24px）与 null 复位、
// sizingToLayout 固定宽盖 min/max。
// 语义源：src/behaviors/popover.ts（PanelSizing 统一契约）。
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  applyPanelSizing,
  computePopoverLayout,
  readPanelSizing,
  resolvePanelSizing,
  sizingToLayout,
} from '../../src/behaviors/popover';
import { mount, unmountAll } from '../helpers/dom';

beforeEach(() => {
  /* happy-dom 默认 clientWidth=0：夹到视口 −24 的断言需要一个真实视口宽 */
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1000, configurable: true });
});

afterEach(() => unmountAll());

describe('readPanelSizing（属性面读取）', () => {
  test('五个 data-icen-panel-* 属性全量读取为数字', () => {
    mount('<div data-icen-panel-width="320" data-icen-panel-min="200" data-icen-panel-max="480" data-icen-panel-min-height="120" data-icen-panel-max-height="360"></div>');
    expect(readPanelSizing(document.querySelector('[data-icen-panel-width]'))).toEqual({
      width: 320,
      minWidth: 200,
      maxWidth: 480,
      minHeight: 120,
      maxHeight: 360,
    });
  });

  test('非法值跳过不抛：0 / 负数 / NaN / 缺失；null 元素返回空对象', () => {
    mount('<div data-icen-panel-width="0" data-icen-panel-max="-5" data-icen-panel-min="abc"></div>');
    expect(readPanelSizing(document.querySelector('[data-icen-panel-width]'))).toEqual({}); /* 三个属性全部非法 → 空 */
    expect(readPanelSizing(null)).toEqual({});
    expect(readPanelSizing(document.querySelector('.不存在'))).toEqual({});
  });
});

describe('resolvePanelSizing（程序面 > 属性面）', () => {
  test('程序面 overrides 逐字段覆盖属性面；undefined 字段不覆盖', () => {
    mount('<div class="sz-a" data-icen-panel-width="320" data-icen-panel-max="480"></div>');
    const el = document.querySelector('.sz-a')!;
    expect(resolvePanelSizing(el, { width: 500 })).toEqual({ width: 500, maxWidth: 480 });
    expect(resolvePanelSizing(el, { width: 500, maxWidth: undefined })).toEqual({ width: 500, maxWidth: 480 });
  });

  test('overrides 里的非法值（0 / 负 / NaN）不写入结果；无 overrides 时纯属性面', () => {
    mount('<div class="sz-b" data-icen-panel-width="320"></div>');
    const el = document.querySelector('.sz-b')!;
    expect(resolvePanelSizing(el, { width: 0, minWidth: -1, maxWidth: Number.NaN })).toEqual({ width: 320 });
    expect(resolvePanelSizing(el)).toEqual({ width: 320 });
    expect(resolvePanelSizing(el, null)).toEqual({ width: 320 });
  });
});

describe('applyPanelSizing（内联到自建面板 + 视口夹取 + null 复位）', () => {
  test('宽度夹到视口 −24px：视口 1000 时 width=2000 夹为 976，且固定宽连带盖 max-width', () => {
    const panel = document.createElement('div');
    document.body.appendChild(panel);
    applyPanelSizing(panel, { width: 2000 });
    expect(panel.style.width).toBe('976px');
    expect(panel.style.maxWidth).toBe('976px'); /* 固定宽盖掉 CSS 侧 max-width 上限 */
  });

  test('视口内不夹：width=320 原样写入；min/max 宽同样吃夹取', () => {
    const panel = document.createElement('div');
    document.body.appendChild(panel);
    applyPanelSizing(panel, { width: 320 });
    expect(panel.style.width).toBe('320px');
    applyPanelSizing(panel, { maxWidth: 5000 });
    expect(panel.style.maxWidth).toBe('976px');
    applyPanelSizing(panel, { minWidth: 120 });
    expect(panel.style.minWidth).toBe('120px');
  });

  test('高度不经视口夹取：min/maxHeight 原样内联；null 一次复位全部五槽', () => {
    const panel = document.createElement('div');
    document.body.appendChild(panel);
    applyPanelSizing(panel, { width: 2000, minWidth: 100, maxWidth: 3000, minHeight: 80, maxHeight: 240 });
    expect(panel.style.minHeight).toBe('80px');
    expect(panel.style.maxHeight).toBe('240px');
    applyPanelSizing(panel, null);
    expect(panel.style.width).toBe('');
    expect(panel.style.minWidth).toBe('');
    expect(panel.style.maxWidth).toBe('');
    expect(panel.style.minHeight).toBe('');
    expect(panel.style.maxHeight).toBe('');
  });

  test('有固定宽时 maxWidth 字段不再单独写（固定宽优先，防互相覆盖）', () => {
    const panel = document.createElement('div');
    document.body.appendChild(panel);
    applyPanelSizing(panel, { width: 300, maxWidth: 500 });
    expect(panel.style.width).toBe('300px');
    expect(panel.style.maxWidth).toBe('300px');
  });
});

describe('sizingToLayout（折算进布局 opts）', () => {
  test('固定宽 → min=max=width（跳过夹取）；maxHeight 透传', () => {
    expect(sizingToLayout({ width: 300 }, { minWidth: 100, maxWidth: 500, maxHeight: 200 }))
      .toEqual({ minWidth: 300, maxWidth: 300, maxHeight: 200 });
    expect(sizingToLayout({ minWidth: 150 }, { minWidth: 100 })).toEqual({ minWidth: 150 });
    expect(sizingToLayout({}, { minWidth: 100 })).toEqual({ minWidth: 100 });
  });
});

describe('computePopoverLayout（视口智能选侧，锁定纯函数口径）', () => {
  const anchor = { left: 400, top: 300, right: 500, bottom: 330, width: 100, height: 30 };
  const viewport = { width: 1024, height: 768 };

  test('优先侧空间足够用优先侧；不足翻对侧', () => {
    expect(computePopoverLayout(anchor, viewport, { side: 'top', contentHeightHint: 200 }).side).toBe('top');
    const nearTop = { ...anchor, top: 40, bottom: 70 };
    expect(computePopoverLayout(nearTop, viewport, { side: 'top', contentHeightHint: 200 }).side).toBe('bottom');
  });

  test('x 夹取到视口 margin 内（align=start 时面板不溢出右缘）', () => {
    const nearRight = { left: 1000, top: 300, right: 1020, bottom: 330, width: 20, height: 30 };
    const layout = computePopoverLayout(nearRight, viewport, { side: 'top', contentHeightHint: 100 });
    expect(layout.left + layout.width).toBeLessThanOrEqual(viewport.width - 12);
  });
});
