/*
 * @icen.ai/ui — Behavior: events（统一事件体系：手势 × 协议 × 策略 三层）
 *
 * 顶层设计（全库事件心智模型，一次学习处处可用）：
 *
 *   1. 手势层 Gesture —— 通用指针/键盘手势的归一化：
 *      任意容器挂 data-gestures="click dblclick contextmenu longpress text-select"（空格分隔）
 *      即开通对应 icen: 事件；组件内建领域事件（icen:chart-* / icen:ai-* / icen:tab-change…）
 *      不变，两者互补。click 与 dblclick 同开时单击延迟 220ms 派发（双击到达即取消单击）。
 *      位移守卫：按下→松开位移 >5px 视为拖拽/划词，不派 click/dblclick；longpress 派发后
 *      尾随的松开单击也抑制。
 *      拖拽不在此层：文件拖放走 upload，排序/分割走各自组件，原生 HTML5 DnD 自行接线。
 *
 *   2. 协议层 Protocol —— 全部 CustomEvent：bubbles + composed + cancelable。
 *      手势事件 detail 统一包络 IcenGestureDetail；领域事件 detail 契约登记在 IcenEventMap
 *      （onIcen 与 emitIcen 双侧共享同一张表，拼错事件名或 detail 结构不符都会被编译器拦下）。
 *      广播事件（如 icen:ai-done / icen:ai-usage，从 document 派发的全局生命周期通知）
 *      不经过任何元素子树：onIcen 的全局与 { within } 形态都能收到，选择器委托形态不适用。
 *
 *   3. 策略层 Policy —— setEventPolicy(type, fn | null) 给手势事件注册全站默认行为：
 *      事件未被 preventDefault 时触发策略。用户在一处即可赋予/覆盖/禁用全站默认，
 *      如 setEventPolicy('icen:contextmenu', e => openMyMenu(e))。
 *      策略只作用于手势层 5 种事件（类型已收死，领域事件传不进来）；
 *      领域事件（icen:chart-* 等）由组件自带交互契约负责。
 *
 * 原生菜单抑制约定（contextmenu 特有）：有监听方 preventDefault 或存在策略时，
 * 压掉浏览器原生右键菜单；两者皆无则原生菜单照常出现（不打扰默认行为）。
 *
 * SSR 下全部 no-op；initGestures 幂等，返回销毁函数（摘除 document 级委托，可重新 init）。
 */

import type { ChartEventDetail } from './charts';
import type { AiUsage } from './ai-core';
import type { AiDoneEventDetail } from './ai-provider';
import type { AiComposerRefSource } from './ai-composer';

export interface IcenGestureDetail {
  /** 手势命中源：最近的 [data-gestures] 宿主 */
  source: HTMLElement;
  /** 原始 DOM 事件（click / contextmenu / pointerdown / mouseup…） */
  originalEvent: Event;
  /** 视口坐标（指针手势） */
  x: number;
  y: number;
  /** 划词文本（仅 icen:text-select） */
  text?: string;
}

export type IcenPolicy = (e: CustomEvent<IcenGestureDetail>) => void;

/** 手势层事件名（策略层只认这五种，编译期收死）。 */
export type IcenGestureEvent =
  | 'icen:click'
  | 'icen:dblclick'
  | 'icen:contextmenu'
  | 'icen:longpress'
  | 'icen:text-select';

/* ── 协议层绑定：全库事件一个入口 ── */

/**
 * 全库事件注册表：事件名 → detail 契约。onIcen 推断、emitIcen 校验，双侧同表。
 * 新增事件必须在此登记（模板签名兜底只留给宿主自定义事件）。
 */
export interface IcenEventMap {
  /* 手势层（本模块） */
  'icen:click': IcenGestureDetail;
  'icen:dblclick': IcenGestureDetail;
  'icen:contextmenu': IcenGestureDetail;
  'icen:longpress': IcenGestureDetail;
  'icen:text-select': IcenGestureDetail;

  /* 图表（charts.ts） */
  'icen:chart-hover': ChartEventDetail;
  'icen:chart-click': ChartEventDetail;
  'icen:chart-dblclick': ChartEventDetail;
  'icen:chart-contextmenu': ChartEventDetail;
  'icen:chart-legend-toggle': { key: string; seriesIndex: number; hidden: boolean };
  'icen:chart-legend-visibility': { visible: boolean };

  /* 基础交互 */
  'icen:tab-change': { tab: HTMLElement | null; panel: HTMLElement | null; index: number };
  'icen:tags-change': { tags: string[] };
  'icen:otp-complete': { code: string };
  'icen:slider-input': { value?: number; lo?: number; hi?: number };
  'icen:slider-change': { value?: number; lo?: number; hi?: number };
  'icen:switch-change': { el: HTMLElement; checked: boolean };
  'icen:check-change': { el: HTMLElement; checked: boolean | 'mixed' };
  'icen:stepper-change': { el: HTMLElement; value: number; delta: number };
  'icen:segmented-change': { el: HTMLElement; value: string; index: number };
  'icen:step-change': { step: HTMLElement; index: number };
  'icen:rating-change': { el: HTMLElement; value: number };
  'icen:page-change': { page: number };
  'icen:sort-change': { th: HTMLElement; key: string; dir: 'asc' | 'desc' | null };
  'icen:nav-select': { item: HTMLElement; index: number };
  'icen:sidebar-toggle': { group: HTMLElement; open: boolean };
  'icen:sidebar-collapse': { collapsed: boolean };
  'icen:split-change': { value: number };
  'icen:copy-success': { text: string };
  'icen:copy-error': { text: string; reason: string };
  'icen:back-top': Record<string, never>;

  /* 浮层与菜单 */
  'icen:modal-open': { id: string };
  'icen:modal-close': { id: string };
  'icen:command-palette-open': Record<string, never>;
  'icen:command-palette-close': Record<string, never>;
  'icen:menu-select': { source: HTMLElement; item: HTMLElement; value: string; label: string };

  /* 选择类 */
  'icen:select-change': { value: string; values: string[]; label: string };
  'icen:date-change': { value: string; date: Date | null };

  /* 结构化交互 */
  'icen:accordion-toggle': { item: HTMLElement; index: number; open: boolean };
  'icen:tree-select': { node: HTMLElement };
  'icen:tree-toggle': { node: HTMLElement; open: boolean };
  'icen:carousel-change': { index: number; count: number };
  'icen:theme-change': { preset: string; dark: boolean; style: string };

  /* 数据表（datatable.ts；与 handle 回调双通道） */
  'icen:table-sort-change': { key: string; dir: 'asc' | 'desc' };
  'icen:table-page-change': { page: number; pageSize: number };
  'icen:table-page-size-change': { pageSize: number };
  'icen:table-filter-change': { key: string; values: string[] };
  'icen:table-search-change': { query: string };
  'icen:table-selection-change': { selected: unknown[] };
  'icen:table-row-click': { row: unknown; index: number };
  'icen:table-row-toggle': { row: unknown; index: number; expanded: boolean };
  'icen:table-columns-change': { hidden: string[] };
  'icen:table-export': { count: number };

  /* 上传（upload.ts） */
  'icen:upload': { files: File[] };
  'icen:upload-error': { file: File | null; reason: string };
  'icen:upload-remove': { file: File };

  /* AI 族 */
  'icen:ai-toggle': { el: HTMLElement; open: boolean };
  'icen:ai-copy': { el: HTMLElement };
  'icen:ai-retry': { el: HTMLElement };
  'icen:ai-approve': { id: string; kind: string };
  'icen:ai-reject': { id: string; kind: string };
  'icen:ai-diff-accept': { path: string };
  'icen:ai-diff-reject': { path: string };
  'icen:ai-send': { text: string };
  'icen:ai-stop': Record<string, never>;
  'icen:ai-queue': { text: string };
  'icen:ai-dequeue': { index: number };
  'icen:ai-attach': { files: File[] };
  'icen:ai-model-change': { provider: string; model: string; label: string; context?: number };
  'icen:ai-command': { name: string; args: string };
  'icen:ai-ref': { action: 'add' | 'remove'; ref: AiComposerRefSource };
  'icen:ai-todo-toggle': { index: number; status: string };
  'icen:ai-audit-clear': Record<string, never>;
  'icen:ai-context-open': Record<string, never>;
  'icen:ai-context-close': Record<string, never>;
  'icen:ai-tool-call': { name: string; input: unknown; el: HTMLElement };
  'icen:ai-tool-result': { name: string; ok: boolean; el: HTMLElement; error?: string; count: number };
  'icen:ai-tool-evict': { name: string; el: HTMLElement };
  /* 广播（ai-provider 从 document 派发的全局生命周期，见文件头「广播事件」） */
  'icen:ai-usage': AiUsage;
  'icen:ai-done': AiDoneEventDetail;

  /* 宿主自定义事件兜底 */
  [key: `icen:${string}`]: unknown;
}

export interface IcenListenOptions {
  /** 只监听该子树内冒泡上来的事件（组件实例级绑定；广播事件无视此限定） */
  within?: Element | Document;
  /** AbortSignal：abort 即解绑（React useEffect 清理 / 批量卸载场景） */
  signal?: AbortSignal;
  /** 只触发一次（触发后自动解绑） */
  once?: boolean;
}

/**
 * 统一绑定器（全库事件一个入口）：
 *   onIcen('icen:tab-change', (e) => e.detail.index)                       全局
 *   onIcen('icen:chart-click', '.chart', (e) => …)                          选择器委托
 *   onIcen('icen:upload', (e) => …, { within: formEl })                     子树限定
 *   onIcen('icen:ai-done', (e) => …, { signal: ctrl.signal })               广播 + 信号解绑
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
  const once = opts?.once === true;
  let off: () => void = () => {};
  const fn = (e: Event): void => {
    /* 广播事件（target 非 Element，如 document 派发的 icen:ai-done）：
       全局 / within 形态直接送达；选择器委托无 DOM 源可匹配，不适用。 */
    const broadcast = !(e.target instanceof Element);
    if (selector) {
      if (broadcast) return;
      const detail = (e as CustomEvent).detail as { source?: unknown } | undefined;
      const src = detail?.source instanceof Element ? detail.source : e.target;
      if (!(src instanceof Element) || !src.closest(selector)) return;
    }
    handler(e as CustomEvent);
    if (once) off();
  };
  within.addEventListener(type, fn);
  off = (): void => {
    within.removeEventListener(type, fn);
    opts?.signal?.removeEventListener('abort', off);
  };
  if (opts?.signal) {
    if (opts.signal.aborted) { off(); return () => {}; }
    opts.signal.addEventListener('abort', off, { once: true });
  }
  return off;
}

/**
 * 全库唯一派生口：bubbles + composed + cancelable。返回 false = 被消费方 preventDefault。
 * 组件作者派发领域事件一律走这里（不要裸写 new CustomEvent）；detail 契约见 IcenEventMap。
 * 从 document 派发 = 全局广播（绕过子树，onIcen 全局/within 均可收）。
 */
export function emitIcen<K extends keyof IcenEventMap>(
  source: Element | Document,
  type: K,
  detail: IcenEventMap[K],
): boolean {
  return source.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true }),
  );
}

const policies = new Map<IcenGestureEvent, IcenPolicy>();

/** 注册/覆盖某手势事件的全站默认行为；传 null 移除（= 禁用该默认）。
 *  只接受手势层五种事件——领域事件的默认行为归组件交互契约，不会被静默忽略。 */
export function setEventPolicy(type: IcenGestureEvent, policy: IcenPolicy | null): void {
  if (policy) policies.set(type, policy);
  else policies.delete(type);
}

export function getEventPolicy(type: IcenGestureEvent): IcenPolicy | undefined {
  return policies.get(type);
}

/** 清空全部策略（测试/热重载用）。 */
export function resetEventPolicies(): void {
  policies.clear();
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
function emit(
  host: HTMLElement,
  type: IcenGestureEvent,
  originalEvent: Event,
  text?: string,
): CustomEvent<IcenGestureDetail> {
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
let gesturesTeardown: (() => void) | null = null;

/**
 * 启动手势层（全局委托一次，幂等；重复调用安全）。
 * 返回销毁函数：摘除全部 document 级委托并复位幂等标记，销毁后可重新 init。
 */
export function initGestures(): () => void {
  if (gesturesInit || typeof document === 'undefined') return () => {};
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
  const onDownPos = (e: PointerEvent): void => {
    downPos = { x: e.clientX, y: e.clientY };
    suppressTrailingClick = false;
  };
  /** 拖拽/划词判定：true = 这次松开不构成单击 */
  const isDragRelease = (e: MouseEvent): boolean =>
    downPos != null && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > CLICK_DRAG_TOLERANCE;
  const onClick = (e: MouseEvent): void => {
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
  };
  const onDblClick = (e: MouseEvent): void => {
    const host = gestureHost(e, 'dblclick');
    if (!host) return;
    cancelPendingClick();
    if (isDragRelease(e)) return;
    emit(host, 'icen:dblclick', e);
  };

  /* contextmenu：有拦截或策略时压掉原生菜单，否则原生照常 */
  const onContextMenu = (e: MouseEvent): void => {
    const host = gestureHost(e, 'contextmenu');
    if (!host) return;
    const hasPolicy = policies.has('icen:contextmenu');
    const ev = emit(host, 'icen:contextmenu', e);
    if (ev.defaultPrevented || hasPolicy) e.preventDefault();
  };

  /* longpress：pointerdown 起 520ms，位移 >12px 或抬起即取消（触屏为主） */
  let lp: { host: HTMLElement; e: PointerEvent; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
  const clearLp = (): void => {
    if (lp) clearTimeout(lp.timer);
    lp = null;
  };
  const onLpDown = (e: PointerEvent): void => {
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
  };
  const onLpMove = (e: PointerEvent): void => {
    if (!lp) return;
    if (Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > LONGPRESS_MOVE) clearLp();
  };

  /* text-select（划词）：mouseup 后选区非空且锚点在宿主内才派发 */
  const onTextSelect = (e: MouseEvent): void => {
    const host = gestureHost(e, 'text-select');
    if (!host) return;
    const sel = window.getSelection();
    const text = sel?.toString() ?? '';
    if (!text.trim() || !sel || !host.contains(sel.anchorNode)) return;
    emit(host, 'icen:text-select', e, text);
  };

  document.addEventListener('pointerdown', onDownPos);
  document.addEventListener('click', onClick);
  document.addEventListener('dblclick', onDblClick);
  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('pointerdown', onLpDown);
  document.addEventListener('pointermove', onLpMove);
  document.addEventListener('pointerup', clearLp);
  document.addEventListener('pointercancel', clearLp);
  document.addEventListener('mouseup', onTextSelect);

  gesturesTeardown = (): void => {
    document.removeEventListener('pointerdown', onDownPos);
    document.removeEventListener('click', onClick);
    document.removeEventListener('dblclick', onDblClick);
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('pointerdown', onLpDown);
    document.removeEventListener('pointermove', onLpMove);
    document.removeEventListener('pointerup', clearLp);
    document.removeEventListener('pointercancel', clearLp);
    document.removeEventListener('mouseup', onTextSelect);
    cancelPendingClick();
    clearLp();
    gesturesInit = false;
    gesturesTeardown = null;
  };
  return gesturesTeardown;
}

/** 摘除手势层委托（等同 initGestures 返回的销毁函数；未启动时为 no-op）。 */
export function destroyGestures(): void {
  gesturesTeardown?.();
}
