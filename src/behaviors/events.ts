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
  return source.dispatchEvent(
    new CustomEvent<IcenGestureDetail>(type, {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true,
    }),
  );
}

/** 全局委托监听（document 级），返回解绑函数。 */
export function onIcen(
  type: string,
  handler: (e: CustomEvent<IcenGestureDetail>) => void,
): () => void {
  if (typeof document === 'undefined') return () => {};
  const fn = (e: Event) => handler(e as CustomEvent<IcenGestureDetail>);
  document.addEventListener(type, fn);
  return () => document.removeEventListener(type, fn);
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
