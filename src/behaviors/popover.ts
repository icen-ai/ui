/*
 * @icen.ai/ui — Behavior: popover（锚定浮层，与 components/popover.css 配套）
 *
 * computePopoverLayout：纯函数，视口智能布局（空间足够用 prefer 侧，不够翻
 * 对侧，都不够取大侧；x/y clamp 到视口 margin 内）。移植自 opengal
 * overlay/viewport-smart-popover 的 computeViewportPopoverLayout。
 *
 * openPopover(panel, { anchor, ...opts })：panel 移到 document.body（跳出祖先
 * stacking context），未算出布局前 visibility:hidden；window resize 与捕获
 * scroll 时重算；外点/Esc 关闭；closePopover 视觉先退场（可中断重开续接），
 * 落定后还原 panel 到原位置。
 *
 * initPopover(root?)：声明式委托——<button data-icen-popover-target="panelId">
 * 点击开关（退场中再点 = 重开续接），同步 aria-haspopup/expanded/controls；
 * 面板内 .icen-popover-close（或 data-icen-popover-dismiss）点击关闭；
 * 触发器 data-icen-side/align 优先，其次面板首开时的同名属性，缺省 bottom/start；
 * 面板内 [data-icen-autofocus] / [autofocus] 为初始焦点。重复 init 幂等返回同一
 * disposer；dispose 摘除委托并关闭本作用域打开的浮层。SSR 下为 no-op。
 */

/** 布局锚矩形（视口坐标，宽高齐全，元素锚或手工锚共用此形状）。 */
export interface PopoverRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** 视口尺寸（可用空间计算的基准）。 */
export interface PopoverViewport {
  width: number;
  height: number;
}

/** 浮层相对锚的展开侧。 */
export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';
/** 浮层与锚的对齐方式（stretch = 纵向侧时随锚宽拉伸）。 */
export type PopoverAlign = 'start' | 'center' | 'end' | 'stretch';

export interface PopoverLayoutOptions {
  side?: PopoverSide;
  align?: PopoverAlign;
  offset?: number;
  margin?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** 内容预期高度：避免用被裁剪的实测高度参与选侧 */
  contentHeightHint?: number;
}

/* ═══════════ 面板尺寸统一契约（PanelSizing） ═══════════
   全库浮层面板共用同一套尺寸心智模型：
   - 属性面（声明式，挂组件根/面板元素）：data-icen-panel-width（固定宽，最高优先）/
     data-icen-panel-min（最小宽）/ data-icen-panel-max（最大宽）/ data-icen-panel-min-height /
     data-icen-panel-max-height（高度上限）
   - 程序面（命令式）：PanelSizing 对象，经 resolvePanelSizing 与属性面合并（程序面优先）
   - 值域：正数 px（与布局引擎同构）；百分比/rem/CSS 变量不属于本契约
   消费方：select / dropdown / context-menu / date-picker / command-palette / modal /
   openPopover。布局引擎只认解析后的纯数字，属性读写全部收敛在本模块。 */
export interface PanelSizing {
  /** 固定宽（最高优先，跳过 min/max 夹取） */
  width?: number;
  /** 最小宽（默认 = 锚点/trigger 宽或组件 CSS 默认） */
  minWidth?: number;
  /** 最大宽 */
  maxWidth?: number;
  /** 最小高（与 PopoverLayoutOptions.minHeight 对齐） */
  minHeight?: number;
  /** 高度上限 */
  maxHeight?: number;
}

/** Reveal an item inside one explicit scrollport. Never scrolls document ancestors;
 * use this instead of scrollIntoView for portalled menus and nested listboxes. */
export function revealPopoverItem(item: HTMLElement, scrollport: HTMLElement, opts: {focus?: boolean; axis?: 'block' | 'inline' | 'both'} = {}): void {
  if (typeof document === 'undefined') return;
  if (opts.focus) item.focus({preventScroll:true});
  const rect=item.getBoundingClientRect(), bounds=scrollport.getBoundingClientRect();
  const style=getComputedStyle(scrollport);
  const inset=(value:string,extent:number):number=>{
    const amount=Number.parseFloat(value) || 0;
    return value.endsWith('%') ? amount*extent/100 : amount;
  };
  if (opts.axis !== 'inline') {
    const top=bounds.top+scrollport.clientTop+inset(style.scrollPaddingTop,scrollport.clientHeight);
    const bottom=bounds.top+scrollport.clientTop+scrollport.clientHeight-inset(style.scrollPaddingBottom,scrollport.clientHeight);
    if (rect.top<top) scrollport.scrollTop-=top-rect.top;
    else if (rect.bottom>bottom) scrollport.scrollTop+=rect.bottom-bottom;
  }
  if (opts.axis === 'inline' || opts.axis === 'both') {
    const left=bounds.left+scrollport.clientLeft+inset(style.scrollPaddingLeft,scrollport.clientWidth);
    const right=bounds.left+scrollport.clientLeft+scrollport.clientWidth-inset(style.scrollPaddingRight,scrollport.clientWidth);
    if (rect.left<left) scrollport.scrollLeft-=left-rect.left;
    else if (rect.right>right) scrollport.scrollLeft+=rect.right-right;
  }
}

const PANEL_SIZING_ATTRS = {
  width: 'data-icen-panel-width',
  minWidth: 'data-icen-panel-min',
  maxWidth: 'data-icen-panel-max',
  minHeight: 'data-icen-panel-min-height',
  maxHeight: 'data-icen-panel-max-height',
} as const;

/** 从元素读取 data-panel-* 尺寸属性（非法/缺失字段跳过，不抛异常）。 */
export function readPanelSizing(el: Element | null | undefined): PanelSizing {
  const out: PanelSizing = {};
  if (!el) return out;
  for (const key of Object.keys(PANEL_SIZING_ATTRS) as (keyof PanelSizing)[]) {
    const raw = el.getAttribute(PANEL_SIZING_ATTRS[key]);
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

/** 合并尺寸：程序面 overrides 优先于属性面（undefined 字段不覆盖）。 */
export function resolvePanelSizing(
  el: Element | null | undefined,
  overrides?: PanelSizing | null,
): PanelSizing {
  const base = readPanelSizing(el);
  if (!overrides) return base;
  for (const key of Object.keys(overrides) as (keyof PanelSizing)[]) {
    const v = overrides[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) base[key] = v;
  }
  return base;
}

/** 把 PanelSizing 折算进布局 opts：固定宽 → min=max；否则 min/max 夹取；maxHeight 透传。 */
export function sizingToLayout<T extends { minWidth?: number; maxWidth?: number; maxHeight?: number }>(
  sizing: PanelSizing,
  opts: T,
): T {
  const out = { ...opts };
  if (sizing.minWidth != null) out.minWidth = sizing.minWidth;
  if (sizing.maxWidth != null) out.maxWidth = sizing.maxWidth;
  if (sizing.width != null) {
    out.minWidth = sizing.width;
    out.maxWidth = sizing.width;
  }
  if (sizing.maxHeight != null) out.maxHeight = sizing.maxHeight;
  return out;
}

/** 把尺寸契约内联到自建面板（dropdown / context-menu / date-picker 等 fixed 面板）。
 *  传 null 复位全部内联尺寸——单例面板跨实例复用时防「上次的设置串味」。
 *  视口守卫：width / maxWidth 一律夹到 视口宽 − 24px（窄屏上过大的 data-icen-panel-width 不溢出，
 *  与 computePopoverLayout 的 availableWidth 同一纪律，不再两套标准）。 */
export function applyPanelSizing(panel: HTMLElement, sizing: PanelSizing | null): void {
  if (sizing == null) {
    panel.style.width = '';
    panel.style.minWidth = '';
    panel.style.maxWidth = '';
    panel.style.minHeight = '';
    panel.style.maxHeight = '';
    return;
  }
  const vw = typeof document === 'undefined' ? Number.POSITIVE_INFINITY : document.documentElement.clientWidth;
  const fitW = (n: number): number => Math.min(n, Math.max(80, vw - 24));
  if (sizing.width != null) {
    /* 固定宽需同时盖掉 CSS 侧的 max-width 上限（如 menu 320 / command-palette 560） */
    const w = fitW(sizing.width);
    panel.style.width = `${w}px`;
    panel.style.maxWidth = `${w}px`;
  }
  if (sizing.minWidth != null) panel.style.minWidth = `${fitW(sizing.minWidth)}px`;
  if (sizing.maxWidth != null && sizing.width == null) panel.style.maxWidth = `${fitW(sizing.maxWidth)}px`;
  if (sizing.minHeight != null) panel.style.minHeight = `${sizing.minHeight}px`;
  if (sizing.maxHeight != null) panel.style.maxHeight = `${sizing.maxHeight}px`;
}

export interface PopoverLayout {
  side: PopoverSide;
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export interface OpenPopoverOptions extends PopoverLayoutOptions {
  anchor: Element | PopoverRect;
  /** 统一面板尺寸契约（优先于面板元素的 data-panel-* 与上方直接尺寸字段） */
  sizing?: PanelSizing;
  /** 关闭（含外点/Esc 触发的关闭）后的回调 */
  onClose?: () => void;
  /** Optional initial focus inside an interactive panel. */
  initialFocus?: HTMLElement;
  /** Restore the anchor only if the panel still owns focus; default true. */
  restoreFocus?: boolean;
}

const DEFAULT_MIN_WIDTH = 220;
const DEFAULT_MAX_WIDTH = 420;
const DEFAULT_MIN_HEIGHT = 120;
const DEFAULT_MAX_HEIGHT = 420;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function chooseSide(
  preferredSide: PopoverSide,
  availableTop: number,
  availableBottom: number,
  desiredHeight: number,
): PopoverSide {
  const preferredSpace = preferredSide === 'top' ? availableTop : availableBottom;
  const oppositeSpace = preferredSide === 'top' ? availableBottom : availableTop;
  if (preferredSpace >= desiredHeight) return preferredSide;
  if (oppositeSpace >= desiredHeight) return preferredSide === 'top' ? 'bottom' : 'top';
  if (preferredSpace >= oppositeSpace) return preferredSide;
  return preferredSide === 'top' ? 'bottom' : 'top';
}

function horizontalAnchor(anchor: PopoverRect, width: number, align: PopoverAlign): number {
  if (align === 'center') return anchor.left + anchor.width / 2 - width / 2;
  if (align === 'end') return anchor.right - width;
  return anchor.left;
}

/** 视口智能布局：返回 {side, left, top, width, maxHeight}。
 *  纵向侧（top/bottom）：选侧按上下空间，宽按 min/max 夹取，高按内容预期。
 *  横向侧（left/right）：锚点左右翻转，宽取 min（无内容测量，横向侧取下限），
 *  高占满可用空间，纵向按 align（start/center/end；stretch 视作 start）贴锚。 */
export function computePopoverLayout(
  anchor: PopoverRect,
  viewport: PopoverViewport,
  opts: PopoverLayoutOptions = {},
): PopoverLayout {
  const margin = opts.margin ?? 12;
  const offset = opts.offset ?? 8;
  const preferredSide = opts.side ?? 'top';
  const align = opts.align ?? 'start';

  if (preferredSide === 'left' || preferredSide === 'right') {
    const minWidth = Math.max(1, opts.minWidth ?? DEFAULT_MIN_WIDTH);
    const availableLeft = Math.max(0, anchor.left - margin - offset);
    const availableRight = Math.max(0, viewport.width - anchor.right - margin - offset);
    /* 翻转阈值按调用方实际下限（tooltip 等小气泡不再因默认 220 误判翻转） */
    const side: PopoverSide =
      (preferredSide === 'left' ? availableLeft : availableRight) >= minWidth
        ? preferredSide
        : preferredSide === 'left' ? 'right' : 'left';
    const maxWidth = Math.min(
      Math.max(opts.maxWidth ?? DEFAULT_MAX_WIDTH, minWidth),
      side === 'left' ? availableLeft : availableRight,
    );
    /* 横向侧无内容测量（面板未先量宽），宽取下限 min：min..max 夹取在无测量值时
       恒等于 min，直接落定 */
    const width = minWidth;
    const left = clamp(
      side === 'left' ? anchor.left - offset - width : anchor.right + offset,
      margin,
      viewport.width - margin - width,
    );
    const availableHeight = Math.max(80, viewport.height - margin * 2);
    const maxHeight = Math.min(opts.maxHeight ?? DEFAULT_MAX_HEIGHT, availableHeight);
    const desired = clamp(opts.contentHeightHint ?? Math.min(anchor.height, maxHeight), 40, maxHeight);
    const anchorTop = align === 'center' ? anchor.top + anchor.height / 2 - desired / 2
      : align === 'end' ? anchor.bottom - desired
      : anchor.top;
    const top = clamp(anchorTop, margin, viewport.height - margin - desired);
    return { side, left, top, width, maxHeight };
  }

  const availableWidth = Math.max(80, viewport.width - margin * 2);
  const requestedMinWidth = Math.max(1, opts.minWidth ?? DEFAULT_MIN_WIDTH);
  const requestedMaxWidth = Math.max(requestedMinWidth, opts.maxWidth ?? DEFAULT_MAX_WIDTH);
  const maxWidth = Math.min(requestedMaxWidth, availableWidth);
  const minWidth = Math.min(requestedMinWidth, maxWidth);
  const availableTop = Math.max(0, anchor.top - margin - offset);
  const availableBottom = Math.max(0, viewport.height - anchor.bottom - margin - offset);
  /* 兜底 80：极矮视口也保留最小可用高，避免负值把面板压成 0 高 */
  const availableHeight = Math.max(80, viewport.height - margin * 2);
  const minHeight = Math.min(Math.max(80, opts.minHeight ?? DEFAULT_MIN_HEIGHT), availableHeight);
  const requestedMaxHeight = Math.max(minHeight, opts.maxHeight ?? DEFAULT_MAX_HEIGHT);
  const fallbackHeight = Math.min(260, requestedMaxHeight);
  const contentHeight = opts.contentHeightHint != null && opts.contentHeightHint > 0 ? opts.contentHeightHint : fallbackHeight;
  const desiredHeight = clamp(contentHeight, minHeight, Math.min(requestedMaxHeight, availableHeight));
  /* 选侧：优先侧放得下用优先侧，放不下翻对侧，两侧都放不下取空间大者 */
  const side = chooseSide(preferredSide, availableTop, availableBottom, desiredHeight);
  const sideSpace = side === 'top' ? availableTop : availableBottom;
  /* 高度上限三重钳制：请求值 × 选中侧空间（sideSpace 为 0 时退两侧较大者，防锚贴边
     时算出 0 高）× 视口可用高 */
  const maxHeight = Math.min(
    requestedMaxHeight,
    Math.max(80, sideSpace || Math.max(availableTop, availableBottom)),
    availableHeight,
  );
  const positionedHeight = clamp(desiredHeight, 40, maxHeight);
  const width = align === 'stretch' ? clamp(anchor.width, minWidth, maxWidth) : maxWidth;
  const left = clamp(horizontalAnchor(anchor, width, align), margin, viewport.width - margin - width);
  const desiredTop =
    side === 'top' ? anchor.top - offset - positionedHeight : anchor.bottom + offset;
  const top = clamp(desiredTop, margin, viewport.height - margin - positionedHeight);

  return { side, left, top, width, maxHeight };
}

interface OpenState {
  panel: HTMLElement;
  anchor: Element | PopoverRect;
  opts: PopoverLayoutOptions;
  onClose?: () => void;
  placeholder: Comment;
  /* 新版 lib.dom 中 hidden 为 string | boolean（'until-found' 等字符串值） */
  wasHidden: string | boolean;
  prevVisibility: string;
  returnFocus: HTMLElement | null;
  resizeObserver?: ResizeObserver;
  layoutFrame?: number;
}

const openPanels = new Map<HTMLElement, OpenState>();
/* 退场中的面板：保留 OpenState 至 finalize；重开从当前动画位置续接，不重建门户 */
const closingPanels = new Map<HTMLElement, { state: OpenState; timer: number; onEnd: (event: Event) => void }>();
const EXIT_FALLBACK_MS = 240;
let menuCloser: (()=>void) | null = null;
/** Shared ownership for action menus: opening one retires the previous renderer
 * without stealing focus. The release handle cannot release a newer owner. */
export function claimMenuFocus(close: ()=>void): ()=>void {
  menuCloser?.();menuCloser=close;
  return ()=>{if(menuCloser === close)menuCloser=null;};
}

function rectFromElement(el: Element): PopoverRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function resolveAnchor(state: OpenState): PopoverRect | null {
  if (state.anchor instanceof Element) {
    if (!state.anchor.isConnected) return null;
    return rectFromElement(state.anchor);
  }
  return state.anchor;
}

function relayout(state: OpenState): void {
  const anchor = resolveAnchor(state);
  if (!anchor) {
    closePopover(state.panel);
    return;
  }
  let layout = computePopoverLayout(
    anchor,
    { width: window.innerWidth, height: window.innerHeight },
    state.opts,
  );
  const { panel } = state;
  const scrollPositions=[panel,...panel.querySelectorAll<HTMLElement>('*')]
    .filter(node=>node.scrollTop!==0||node.scrollLeft!==0)
    .map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
  // Resolve width before reading real content height. A guessed 260px position
  // with a real 400px panel places its lower portion over the anchor.
  panel.style.width = `${layout.width}px`;
  if (state.opts.contentHeightHint == null && (layout.side === 'top' || layout.side === 'bottom')) {
    panel.style.maxHeight = `${Math.min(state.opts.maxHeight ?? DEFAULT_MAX_HEIGHT, Math.max(80,window.innerHeight - (state.opts.margin ?? 12)*2))}px`;
    const measured = panel.offsetHeight; // untransformed: entrance scale must not change geometry
    if (measured > 0) layout = computePopoverLayout(anchor,{width:window.innerWidth,height:window.innerHeight},{...state.opts,contentHeightHint:measured});
  }
  panel.style.left = `${layout.left}px`;
  panel.style.width = `${layout.width}px`;
  panel.style.maxHeight = `${layout.maxHeight}px`;
  let top=layout.top;
  const actualHeight=panel.offsetHeight;
  if(actualHeight>0 && (layout.side==='top'||layout.side==='bottom')){
    const desired=layout.side==='top'?anchor.top-(state.opts.offset??8)-actualHeight:anchor.bottom+(state.opts.offset??8);
    const margin=state.opts.margin??12;top=clamp(desired,margin,window.innerHeight-margin-actualHeight);
  }
  panel.style.top = `${top}px`;
  for(const pos of scrollPositions){pos.node.scrollTop=pos.top;pos.node.scrollLeft=pos.left;}
  panel.dataset.icenSide = layout.side;
  panel.style.visibility = state.prevVisibility;
}

function observeOpenPanel(state: OpenState): void {
  if(typeof ResizeObserver==='undefined')return;
  state.resizeObserver=new ResizeObserver(()=>{
    if(state.layoutFrame!=null)return;
    state.layoutFrame=window.requestAnimationFrame(()=>{
      state.layoutFrame=undefined;
      if(openPanels.get(state.panel)===state)relayout(state);
    });
  });
  state.resizeObserver.observe(state.panel);
  if(state.anchor instanceof Element)state.resizeObserver.observe(state.anchor);
}

function onWindowChange(event?: Event): void {
  openPanels.forEach(state=>{
    // An internal list scroll moves its content, not its own anchor. Measuring
    // it again can clamp its scroll position while testing unconstrained height.
    if(event?.type==='scroll' && event.target instanceof Node && state.panel.contains(event.target))return;
    relayout(state);
  });
}

function onOutsidePointerDown(e: Event): void {
  const target = e.target;
  if (!(target instanceof Node)) return;
  openPanels.forEach((state) => {
    if (state.panel.contains(target)) return;
    if (state.anchor instanceof Element && state.anchor.contains(target)) return;
    closePopover(state.panel);
  });
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || e.keyCode === 229 || menuCloser) return;
  // 只关最上层（最后打开的），逐次 Esc 逐层关闭
  const states = Array.from(openPanels.values());
  const top = states[states.length - 1];
  if (top) {
    e.preventDefault();
    e.stopPropagation();
    closePopover(top.panel);
  }
}

/** 打开浮层：panel 移入 body 并按 anchor 布局；重复调用同一 panel 为先关后开；
 *  退场中重开从当前动画位置续接（复用既有门户记录，不重复插占位）。 */
export function openPopover(panel: HTMLElement, options: OpenPopoverOptions): void {
  if (typeof document === 'undefined') return;

  /* 中断退场：取消回收定时，复用原 OpenState（placeholder/returnFocus 仍有效） */
  const pending = closingPanels.get(panel);
  if (pending) {
    window.clearTimeout(pending.timer);
    panel.removeEventListener('transitionend', pending.onEnd);
    closingPanels.delete(panel);
    delete panel.dataset.icenState;
    openPanels.set(panel, pending.state);
    panel.hidden = false;
    panel.style.visibility = 'hidden';
    relayout(pending.state);
    observeOpenPanel(pending.state);
    if (openPanels.size === 1) {
      window.addEventListener('resize', onWindowChange);
      window.addEventListener('scroll', onWindowChange, true);
      document.addEventListener('pointerdown', onOutsidePointerDown, true);
      window.addEventListener('keydown', onKeyDown, true);
    }
    const ifs = options.initialFocus;
    if (ifs && panel.contains(ifs)) ifs.focus({ preventScroll: true });
    return;
  }

  if (openPanels.has(panel)) closePopover(panel);

  const { anchor, onClose, sizing, initialFocus, restoreFocus, ...rest } = options;
  /* 尺寸契约：opts.sizing > 面板元素 data-panel-* > 上方直接尺寸字段 */
  const layoutOpts = sizingToLayout(resolvePanelSizing(panel, sizing), rest);

  // 记录原位，关闭后还原
  const placeholder = document.createComment('popover-anchor');
  panel.parentNode?.insertBefore(placeholder, panel);
  const wasHidden = panel.hidden;
  const prevVisibility = panel.style.visibility;

  const state: OpenState = {
    panel,
    anchor,
    opts: layoutOpts,
    onClose,
    placeholder,
    wasHidden,
    prevVisibility,
    returnFocus: restoreFocus === false ? null : anchor instanceof HTMLElement ? anchor : document.activeElement instanceof HTMLElement ? document.activeElement : null,
  };
  openPanels.set(panel, state);

  document.body.appendChild(panel);
  panel.hidden = false;
  panel.style.visibility = 'hidden';
  relayout(state);
  observeOpenPanel(state);
  if(initialFocus && panel.contains(initialFocus))initialFocus.focus({preventScroll:true});

  if (openPanels.size === 1) {
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
  }
}

/* 退场 finalize：还原门户位置、hidden、尺寸与可见性（在 DOM 已拆除时安全跳过） */
function finalizeClose(panel: HTMLElement, state: OpenState): void {
  delete panel.dataset.icenState;
  panel.style.visibility = state.prevVisibility;
  /* hidden 还原：字符串值（如 until-found）走 setAttribute，布尔走属性赋值 */
  if (typeof state.wasHidden === 'string') panel.setAttribute('hidden', state.wasHidden);
  else panel.hidden = state.wasHidden;
  panel.style.left = '';
  panel.style.top = '';
  panel.style.width = '';
  panel.style.maxHeight = '';
  delete panel.dataset.icenSide;
  if (state.placeholder.parentNode) {
    state.placeholder.parentNode.insertBefore(panel, state.placeholder);
    state.placeholder.remove();
  }
}

/** 关闭浮层：视觉先退场（可被打断重开），finalize 再还原门户；焦点与 onClose 立即结算。
 *  immediate: true 供卸载/销毁路径——跳过退场直接 finalize（拆页时不把面板留在 body）。 */
export function closePopover(panel: HTMLElement, opts?: { immediate?: boolean }): void {
  if (typeof document === 'undefined') return;
  const state = openPanels.get(panel);
  if (!state) return;
  openPanels.delete(panel);
  state.resizeObserver?.disconnect();
  if(state.layoutFrame!=null){window.cancelAnimationFrame(state.layoutFrame);state.layoutFrame=undefined;}
  const ownsFocus=panel.contains(document.activeElement);
  if(ownsFocus && state.returnFocus?.isConnected)state.returnFocus.focus({preventScroll:true});

  if (openPanels.size === 0) {
    window.removeEventListener('resize', onWindowChange);
    window.removeEventListener('scroll', onWindowChange, true);
    document.removeEventListener('pointerdown', onOutsidePointerDown, true);
    window.removeEventListener('keydown', onKeyDown, true);
  }
  state.onClose?.();

  /* reduced-motion 或节点已拆除：跳过退场动画直接 finalize */  const calm = opts?.immediate || (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (calm || !panel.isConnected) {
    finalizeClose(panel, state);
    return;
  }
  panel.dataset.icenState = 'closing';
  const finalize = (): void => {
    const pending = closingPanels.get(panel);
    if (!pending || pending.state !== state) return;
    window.clearTimeout(pending.timer);
    panel.removeEventListener('transitionend', pending.onEnd);
    closingPanels.delete(panel);
    finalizeClose(panel, state);
  };
  const onEnd = (event: Event): void => {
    if (event.target === panel && (event as TransitionEvent).propertyName === 'opacity') finalize();
  };
  panel.addEventListener('transitionend', onEnd);
  closingPanels.set(panel, {
    state,
    timer: window.setTimeout(finalize, EXIT_FALLBACK_MS),
    onEnd,
  });
}

/* ═══════════ 声明式接入（data-icen-popover-target 触发器委托） ═══════════ */

const popoverScopes = new WeakMap<ParentNode, () => void>();
/* 面板首开时记住作者声明的默认侧/对齐（布局写回的 dataset.icenSide 不冒充作者意图） */
const popoverDefaults = new WeakMap<HTMLElement, { side?: PopoverSide; align?: PopoverAlign }>();

function rememberPopoverDefaults(panel: HTMLElement): { side?: PopoverSide; align?: PopoverAlign } {
  let defaults = popoverDefaults.get(panel);
  if (!defaults) {
    const side = panel.dataset.icenSide;
    const align = panel.getAttribute('data-icen-align');
    defaults = {
      side: side === 'top' || side === 'bottom' || side === 'left' || side === 'right' ? side : undefined,
      align: align === 'start' || align === 'center' || align === 'end' ? align : undefined,
    };
    popoverDefaults.set(panel, defaults);
  }
  return defaults;
}

/**
 * 声明式浮层委托：<button data-icen-popover-target="panelId"> 点击开关 .icen-popover 面板，
 * 同步触发器 aria-haspopup/aria-expanded/aria-controls；面板内 .icen-popover-close 点击关闭。
 * 同一 root 重复调用返回同一销毁函数；销毁摘除委托并关闭本作用域打开的浮层。SSR 下返回 no-op。
 */
export function initPopover(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;
  const existing = popoverScopes.get(scope);
  if (existing) return existing;

  /* panel → trigger（本作用域打开的），dispose 时逐一结算；
     关闭钮监听挂在 panel 自身（面板 portal 到 body 后已不在作用域内，委托捕获不到） */
  const opened = new Map<HTMLElement, HTMLElement>();
  const dismissHandlers = new Map<HTMLElement, (event: Event) => void>();
  const watchDismiss = (panel: HTMLElement): void => {
    if (dismissHandlers.has(panel)) return;
    const handler = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.icen-popover-close, [data-icen-popover-dismiss]')) closePopover(panel);
    };
    panel.addEventListener('click', handler);
    dismissHandlers.set(panel, handler);
  };

  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const trigger = target.closest<HTMLElement>('[data-icen-popover-target]');
    if (!trigger || !(scope as Node).contains(trigger)) return;
    const id = trigger.getAttribute('data-icen-popover-target') ?? '';
    const panel = document.getElementById(id);
    if (!panel || !panel.classList.contains('icen-popover')) return;

    if (openPanels.has(panel)) {
      closePopover(panel);
      return;
    }
    /* 退场中再点 = 重开续接（openPopover 的 closing 分支处理），此处直接放行 */

    const defaults = rememberPopoverDefaults(panel);
    const sideAttr = trigger.getAttribute('data-icen-side') as PopoverSide | null;
    const alignAttr = trigger.getAttribute('data-icen-align') as PopoverAlign | null;
    if (!trigger.hasAttribute('aria-haspopup')) trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'true');
    if (panel.id) trigger.setAttribute('aria-controls', panel.id);
    opened.set(panel, trigger);
    watchDismiss(panel);
    openPopover(panel, {
      anchor: trigger,
      side: sideAttr ?? defaults.side ?? 'bottom',
      align: alignAttr ?? defaults.align ?? 'start',
      initialFocus: panel.querySelector<HTMLElement>('[data-icen-autofocus], [autofocus]') ?? undefined,
      onClose: () => {
        opened.delete(panel);
        trigger.setAttribute('aria-expanded', 'false');
      },
    });
  };

  scope.addEventListener('click', onClick);
  const dispose = (): void => {
    scope.removeEventListener('click', onClick);
    for (const panel of [...opened.keys()]) closePopover(panel, { immediate: true });
    for (const [panel, handler] of dismissHandlers) panel.removeEventListener('click', handler);
    dismissHandlers.clear();
    popoverScopes.delete(scope);
  };
  popoverScopes.set(scope, dispose);
  return dispose;
}
