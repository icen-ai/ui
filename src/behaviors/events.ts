/*
 * @icen.ai/ui — Behavior: events（统一事件体系：手势 × 协议 × 策略 三层）
 *
 * 顶层设计（全库事件心智模型，一次学习处处可用）：
 *
 *   1. 手势层 Gesture —— 通用指针/键盘手势的归一化：
 *      任意容器挂 data-gestures="click dblclick contextmenu longpress select"（空格分隔）
 *      即开通对应 icen: 事件；组件内建领域事件（icen:chart-* / icen:ai-* / icen:tab-change…）
 *      不变，两者互补。click 与 dblclick 同开时单击延迟 220ms 派发（双击到达即取消单击）。
 *      位移守卫：按下→松开位移 >5px 视为拖拽/划词，不派 click/dblclick；longpress 派发后
 *      尾随的松开单击也抑制。
 *      拖拽不在此层：文件拖放走 upload，排序/分割走各自组件，原生 HTML5 DnD 自行接线。
 *
 *   2. 协议层 Protocol —— 全部 CustomEvent：bubbles + composed + cancelable，
 *      detail 统一包络 IcenGestureDetail { source, originalEvent, x, y, text? }。
 *
 *   3. 策略层 Policy —— setEventPolicy(type, fn | null) 给事件注册全站默认行为：
 *      事件未被 preventDefault 时触发策略。用户在一处即可赋予/覆盖/禁用全站默认，
 *      如 setEventPolicy('icen:contextmenu', e => openMyMenu(e))。
 *      策略只作用于手势层事件；领域事件（icen:chart-* 等）由组件自带交互契约负责。
 *
 * 原生菜单抑制约定（contextmenu 特有）：有监听方 preventDefault 或存在策略时，
 * 压掉浏览器原生右键菜单；两者皆无则原生菜单照常出现（不打扰默认行为）。
 *
 * SSR 下全部 no-op；initGestures 幂等。
 */

import type { ChartEventDetail } from './charts';

export interface IcenGestureDetail {
  /** 手势命中源：最近的 [data-gestures] 宿主 */
  source: HTMLElement;
  /** 原始 DOM 事件（click / contextmenu / pointerdown / mouseup…） */
  originalEvent: Event;
  /** 视口坐标（指针手势） */
  x: number;
  y: number;
  /** 划词文本（仅 icen:select） */
  text?: string;
}

export type IcenPolicy = (e: CustomEvent<IcenGestureDetail>) => void;

/* ── 协议层绑定：全库事件一个入口 ── */

/** 全库事件注册表：已知事件 → detail 类型；未列出的领域事件经模板签名宽松回退。 */
export interface IcenEventMap {
  /* 手势层（本模块） */
  'icen:click': IcenGestureDetail;
  'icen:dblclick': IcenGestureDetail;
  'icen:contextmenu': IcenGestureDetail;
  'icen:longpress': IcenGestureDetail;
  'icen:select': IcenGestureDetail;
  /* 图表（charts.ts） */
  'icen:chart-hover': ChartEventDetail;
  'icen:chart-click': ChartEventDetail;
  'icen:chart-dblclick': ChartEventDetail;
  'icen:chart-contextmenu': ChartEventDetail;
  'icen:chart-legend-toggle': ChartEventDetail;
  'icen:chart-legend-visibility': ChartEventDetail;
  /* tabs */
  'icen:tab-change': { tab: HTMLButtonElement | null; panel: HTMLElement | null; index: number };
  /* 其余领域事件（ai-* / upload-* / slider-* …）经模板签名宽松回退 */
  [key: `icen:${string}`]: unknown;
}

export interface IcenListenOptions {
  /** 只监听该子树内冒泡上来的事件（组件实例级绑定） */
  within?: Element | Document;
}

/**
 * 统一绑定器（全库事件一个入口）：
 *   onIcen('icen:tab-change', (e) => e.detail.index)                       全局
 *   onIcen('icen:chart-click', '.chart', (e) => …)                          选择器委托
 *   onIcen('icen:upload', (e) => …, { within: formEl })                     子树限定
 * 返回解绑函数 —— React useEffect / Vue onUnmounted 直接 return。
 */
export function onIcen<K extends keyof IcenEventMap>(
  type: K,
  handler: (e: CustomEvent<IcenEventMap[K]>) => void,
  opts?: IcenListenOptions,
): () => void;
export function onIcen<K extends keyof IcenEventMap>(
  type: K,
  selector: string,
  handler: (e: CustomEvent<IcenEventMap[K]>) => void,
  opts?: IcenListenOptions,
): () => void;
export function onIcen(
  type: string,
  a: ((e: CustomEvent) => void) | string,
  b?: ((e: CustomEvent) => void) | IcenListenOptions,
  c?: IcenListenOptions,
): () => void {
  if (typeof document === 'undefined') return () => {};
  const selector = typeof a === 'string' ? a : null;
  const handler = (selector ? b : a) as (e: CustomEvent) => void;
  const opts = (selector ? c : b) as IcenListenOptions | undefined;
  const within = opts?.within ?? document;
  const fn = (e: Event): void => {
    if (selector) {
      const detail = (e as CustomEvent).detail as { source?: unknown } | undefined;
      const src = detail?.source instanceof Element ? detail.source : e.target;
      if (!(src instanceof Element) || !src.closest(selector)) return;
    }
    handler(e as CustomEvent);
  };
  within.addEventListener(type, fn);
  return () => within.removeEventListener(type, fn);
}

/** 全库唯一派生口：bubbles + composed + cancelable。返回 false = 被消费方 preventDefault。
 *  组件作者派发领域事件一律走这里（不要裸写 new CustomEvent）。 */
export function emitIcen(source: Element | Document, type: string, detail?: unknown): boolean {
  return source.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true }),
  );
}

const policies = new Map<string, IcenPolicy>();

/** 注册/覆盖某事件的全站默认行为；传 null 移除（= 禁用该默认）。 */
export function setEventPolicy(type: string, policy: IcenPolicy | null): void {
  if (policy) policies.set(type, policy);
  else policies.delete(type);
}

export function getEventPolicy(type: string): IcenPolicy | undefined {
  return policies.get(type);
}

/** 清空全部策略（测试/热重载用）。 */
export function resetEventPolicies(): void {
  policies.clear();
}

/** 统一派发：bubbles + composed + cancelable；返回 false 表示被消费方 preventDefault。 */
export function dispatchIcen(
  source: HTMLElement,
  type: string,
  init: { originalEvent: Event; x?: number; y?: number; text?: string },
): boolean {
  const detail: IcenGestureDetail = {
    source,
    originalEvent: init.originalEvent,
    x: init.x ?? 0,
    y: init.y ?? 0,
  };
  if (init.text != null) detail.text = init.text;
  return emitIcen(source, type, detail);
}

/* ── 手势引擎 ── */

const LONGPRESS_MS = 520;
const LONGPRESS_MOVE = 12;
const CLICK_DELAY = 220;
const CLICK_DRAG_TOLERANCE = 5;

function gestureHost(e: Event, name: string): HTMLElement | null {
  const t = e.target;
  if (!(t instanceof Element)) return null;
  return t.closest<HTMLElement>(`[data-gestures~="${name}"]`);
}

function pointOf(e: Event): { x: number; y: number } {
  return e instanceof MouseEvent || (typeof PointerEvent !== 'undefined' && e instanceof PointerEvent)
    ? { x: e.clientX, y: e.clientY }
    : { x: 0, y: 0 };
}

/** 派发 →（未被拦截且有策略）→ 跑策略。返回事件对象。 */
function emit(host: HTMLElement, type: string, originalEvent: Event, text?: string): CustomEvent<IcenGestureDetail> {
  const { x, y } = pointOf(originalEvent);
  const detail: IcenGestureDetail = { source: host, originalEvent, x, y };
  if (text != null) detail.text = text;
  /* 需要事件对象本体（给策略与 defaultPrevented 判定），emitIcen 只返回布尔，这里自建后同协议派发 */
  const ev = new CustomEvent<IcenGestureDetail>(type, {
    detail,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  const delivered = host.dispatchEvent(ev);
  if (delivered) policies.get(type)?.(ev);
  return ev;
}

let gesturesInit = false;

/** 启动手势层（全局委托一次，幂等；重复调用安全）。 */
export function initGestures(): void {
  if (gesturesInit || typeof document === 'undefined') return;
  gesturesInit = true;

  /* click / dblclick：同开时单击延迟派发，双击到达即取消单击。
     位移守卫：按下→松开的位移超阈值视为拖拽/划词，不派单击/双击；
     长按已派 icen:longpress 时，尾随的单击也抑制（意图是长按）。 */
  let clickTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: { host: HTMLElement; e: MouseEvent } | null = null;
  let downPos: { x: number; y: number } | null = null;
  let suppressTrailingClick = false;
  const cancelPendingClick = (): void => {
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = null;
    pending = null;
  };
  document.addEventListener('pointerdown', (e) => {
    downPos = { x: e.clientX, y: e.clientY };
    suppressTrailingClick = false;
  });
  /** 拖拽/划词判定：true = 这次松开不构成单击 */
  const isDragRelease = (e: MouseEvent): boolean =>
    downPos != null && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > CLICK_DRAG_TOLERANCE;
  document.addEventListener('click', (e) => {
    const host = gestureHost(e, 'click');
    if (!host) return;
    if (suppressTrailingClick) { suppressTrailingClick = false; return; }
    if (isDragRelease(e)) return;
    if (host.matches('[data-gestures~="dblclick"]')) {
      if (clickTimer) clearTimeout(clickTimer);
      pending = { host, e };
      clickTimer = setTimeout(() => {
        clickTimer = null;
        const p = pending;
        pending = null;
        if (p) emit(p.host, 'icen:click', p.e);
      }, CLICK_DELAY);
    } else {
      emit(host, 'icen:click', e);
    }
  });
  document.addEventListener('dblclick', (e) => {
    const host = gestureHost(e, 'dblclick');
    if (!host) return;
    cancelPendingClick();
    if (isDragRelease(e)) return;
    emit(host, 'icen:dblclick', e);
  });

  /* contextmenu：有拦截或策略时压掉原生菜单，否则原生照常 */
  document.addEventListener('contextmenu', (e) => {
    const host = gestureHost(e, 'contextmenu');
    if (!host) return;
    const hasPolicy = policies.has('icen:contextmenu');
    const ev = emit(host, 'icen:contextmenu', e);
    if (ev.defaultPrevented || hasPolicy) e.preventDefault();
  });

  /* longpress：pointerdown 起 520ms，位移 >12px 或抬起即取消（触屏为主） */
  let lp: { host: HTMLElement; e: PointerEvent; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
  const clearLp = (): void => {
    if (lp) clearTimeout(lp.timer);
    lp = null;
  };
  document.addEventListener('pointerdown', (e) => {
    const host = gestureHost(e, 'longpress');
    if (!host) return;
    clearLp();
    lp = {
      host,
      e,
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        const cur = lp;
        lp = null;
        if (cur) {
          suppressTrailingClick = true;   /* 长按已派发，松开的尾随单击不算 */
          emit(cur.host, 'icen:longpress', cur.e);
        }
      }, LONGPRESS_MS),
    };
  });
  document.addEventListener('pointermove', (e) => {
    if (!lp) return;
    if (Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > LONGPRESS_MOVE) clearLp();
  });
  document.addEventListener('pointerup', clearLp);
  document.addEventListener('pointercancel', clearLp);

  /* select（划词）：mouseup 后选区非空且锚点在宿主内才派发 */
  document.addEventListener('mouseup', (e) => {
    const host = gestureHost(e, 'select');
    if (!host) return;
    const sel = window.getSelection();
    const text = sel?.toString() ?? '';
    if (!text.trim() || !sel || !host.contains(sel.anchorNode)) return;
    emit(host, 'icen:select', e, text);
  });
}
