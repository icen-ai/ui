// conformance 套件共享基座：表驱动 harness（init 幂等 / destroy 可重入 / 事件登记与协议形态）
// + XSS 文本纪律断言 + 键盘派发 + 门户残留清场。
// 与 tests/kb-conformance.test.ts 同形态：happy-dom 真实渲染后断言 DOM，违规即 CI 红。
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { IcenEventMap } from '../../src/behaviors/events';

/** XSS 探针串：喂给渲染路径后必须原样成文本节点，不得物化成元素。 */
export const XSS_TEXT = '<img src=x onerror="window.__icenXss=1">';

/** 派发键盘事件（行为层全部走委托/容器监听，必须 bubbles）。 */
export function key(target: Element | Document | Window, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
}

/** 捕获一组 icen: 事件（document 级；协议层 bubbles+composed 保证到达）。 */
export interface Capture {
  events: CustomEvent[];
  count(): number;
  restore(): void;
}

export function capture(names: readonly string[]): Capture {
  const events: CustomEvent[] = [];
  const handlers: Array<[string, EventListener]> = [];
  for (const name of names) {
    const fn: EventListener = (e) => events.push(e as CustomEvent);
    document.addEventListener(name, fn);
    handlers.push([name, fn]);
  }
  return {
    events,
    count: () => events.length,
    restore: () => {
      for (const [name, fn] of handlers) document.removeEventListener(name, fn);
      handlers.length = 0;
    },
  };
}

/** IcenEventMap 登记断言（运行时读源码——tests 不进 tsconfig，登记检查必须是运行时的）。 */
export function expectRegistered(names: readonly string[]): void {
  const src = readFileSync(fileURLToPath(new URL('../../src/behaviors/events.ts', import.meta.url)), 'utf8');
  const start = src.indexOf('export interface IcenEventMap');
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('\n}', start);
  const block = src.slice(start, end);
  for (const name of names) {
    expect(block, `IcenEventMap 未登记 ${name}`).toContain(`'${name}':`);
  }
}

/**
 * 序列化注入检查：剥离全部属性后再查裸标记。属性面（aria-label / title / data-*）里的
 * payload 原文是惰性文本、不能物化成元素；textContent 渲染的文本序列化必转义（&lt;），
 * 剥离属性后若仍出现 '<img'/'<script' 即说明走了未声明的 innerHTML 注入。
 */
export function expectSerializedEscaped(root: Element): void {
  const clone = root.cloneNode(true) as Element;
  const strip = (node: Element): void => {
    for (const name of node.getAttributeNames()) node.removeAttribute(name);
    for (const child of node.children) strip(child);
  };
  strip(clone);
  expect(clone.innerHTML).not.toContain('<img');
  expect(clone.innerHTML).not.toContain('<script');
}

/** 文本纪律：payload 原样落在 textContent、无 img/script 物化、剥离属性面后序列化呈转义态。 */
export function expectTextOnly(root: Element, payload: string = XSS_TEXT): void {
  expect(root.textContent).toContain(payload);
  expect(root.querySelector('img')).toBeNull();
  expect(root.querySelector('script')).toBeNull();
  expect((window as unknown as Record<string, unknown>).__icenXss).toBeUndefined();
  expectSerializedEscaped(root);
}

/** 清场：摘除 body 直挂的门户/单例残留（popover 面板、tooltip、菜单、toast/notification 容器等）。
 *  注意：.icen-chart-tooltip 不在此列——charts.ts 的 tooltip 是模块级单例（引用长存），
 *  摘元素会让模块引用指向游离节点、后续图表 hover 静默失 tooltip；隐藏态滞留与生产一致。 */
export function cleanupOverlays(): void {
  const stray = [
    '.icen-tooltip',
    '.icen-menu',
    '.icen-popover',
    '.icen-select-panel',
    '.icen-date-picker-panel',
    '.icen-modal-backdrop',
    '.icen-command-palette-backdrop',
    '.icen-toast-container',
    '.icen-notification-container',
    '.icen-kb-citation-card',
  ];
  for (const sel of stray) {
    document.body.querySelectorAll(`:scope > ${sel}`).forEach((n) => n.remove());
  }
  /* charts 内置 tooltip 是模块级单例缓存（charts.ts tooltipEl，destroy() 也会惰性创建）：
     一旦被后续测试文件的 body 整体清场（document.body.replaceChildren()，如 carousel-polish）
     摘除，模块缓存即悬空——之后 chartTooltip() 返回游离节点，charts-dom 等用例查询落空。
     本套件清场时把它迁出 body（挂 documentElement）：body 级清场够不着、document 级查询仍命中，
     与 charts-dom.test.ts 头注释「只隐藏不摘除」的纪律同一目的。 */
  const chartTip = document.body.querySelector(':scope > .icen-chart-tooltip');
  if (chartTip) document.documentElement.appendChild(chartTip);
  delete (window as unknown as Record<string, unknown>).__icenXss;
}

/** 表驱动用例：每个 test 调一次 run()（挂契约标记 + 返回交互闭包）。 */
export interface InitCaseRun {
  /** 调 init，返回销毁函数 */
  init: () => () => void;
  /** 一次关键交互（触发回调/类名切换/事件） */
  act: () => void | Promise<void>;
  /** 副作用信号计数：一次交互恰好 +1；缺省 = 捕获到的契约事件数 */
  signal?: () => number;
}

export interface InitCase {
  /** 组件名（报告与 describe 标题用） */
  name: string;
  /** 关键交互派发的 icen: 事件（登记断言 + 计数靶；编译期同时受 keyof IcenEventMap 约束） */
  events: readonly (keyof IcenEventMap)[];
  /** 契约承诺「同一作用域重复 init 返回同一销毁函数」时打开（popover/tooltip/modal/palette/dropdown/context-menu） */
  sameDisposer?: boolean;
  run: () => InitCaseRun;
  /** detail 形态断言（事件契约测试末段调用，入参 = 捕获序列） */
  checkDetail?: (events: CustomEvent[]) => void;
}

function safeDispose(fn: (() => void) | undefined): void {
  try {
    fn?.();
  } catch {
    /* 重复销毁防御：dispose 幂等性各自有 guard，此处兜底不掩测试失败 */
  }
}

/**
 * 标记驱动 init 族的三条可执行契约：
 *   1. init 幂等——重复 init 后一次交互只生效一次（sameDisposer 时校验同一引用）；
 *   2. destroy——摘除监听（销毁后交互无响应）且可重新 init；
 *   3. 事件——名称登记在 events.ts 的 IcenEventMap，且协议形态 bubbles+composed+cancelable。
 */
export function describeInitConformance(c: InitCase): void {
  describe(`${c.name}`, () => {
    test('init 幂等：重复 init 不产生重复监听（一次交互只生效一次）', async () => {
      const k = c.run();
      const cap = capture(c.events);
      const d1 = k.init();
      let d2: (() => void) | undefined;
      try {
        d2 = k.init();
        if (c.sameDisposer) expect(d2).toBe(d1);
        await k.act();
        expect(k.signal?.() ?? cap.count()).toBe(1);
      } finally {
        cap.restore();
        safeDispose(d1);
        if (d2 && d2 !== d1) safeDispose(d2);
      }
    });

    test('destroy 摘除监听（交互无响应）且可重新 init', async () => {
      const k = c.run();
      const cap = capture(c.events);
      const d1 = k.init();
      try {
        d1();
        await k.act();
        expect(k.signal?.() ?? cap.count()).toBe(0);
        const d2 = k.init();
        try {
          await k.act();
          expect(k.signal?.() ?? cap.count()).toBe(1);
        } finally {
          safeDispose(d2);
        }
      } finally {
        cap.restore();
      }
    });

    test('事件契约：名称登记于 IcenEventMap；协议形态 bubbles+composed+cancelable；detail 符合契约', async () => {
      expectRegistered(c.events);
      if (c.events.length === 0) return;
      const k = c.run();
      const cap = capture(c.events);
      const d = k.init();
      try {
        await k.act();
        expect(cap.events.length).toBeGreaterThan(0);
        for (const ev of cap.events) {
          expect(c.events as readonly string[]).toContain(ev.type);
          expect(ev).toBeInstanceOf(CustomEvent);
          expect(ev.bubbles).toBe(true);
          expect(ev.composed).toBe(true);
          expect(ev.cancelable).toBe(true);
          expect(typeof ev.detail).toBe('object');
        }
        c.checkDetail?.(cap.events);
      } finally {
        safeDispose(d);
        cap.restore();
      }
    });
  });
}
