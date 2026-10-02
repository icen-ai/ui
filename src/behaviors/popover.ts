/*
 * @icen.ai/ui — Behavior: popover（锚定浮层，与 components/popover.css 配套）
 *
 * computePopoverLayout：纯函数，视口智能布局（空间足够用 prefer 侧，不够翻
 * 对侧，都不够取大侧；x/y clamp 到视口 margin 内）。移植自 opengal
 * overlay/viewport-smart-popover 的 computeViewportPopoverLayout。
 *
 * openPopover(panel, { anchor, ...opts })：panel 移到 document.body（跳出祖先
 * stacking context），未算出布局前 visibility:hidden；window resize 与捕获
 * scroll 时重算；外点/Esc 关闭；closePopover 后还原 panel 到原位置。
 * SSR 下为 no-op。
 */

export interface PopoverRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface PopoverViewport {
  width: number;
  height: number;
}

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';
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
   - 属性面（声明式，挂组件根/面板元素）：data-panel-width（固定宽，最高优先）/
     data-panel-min（最小宽）/ data-panel-max（最大宽）/ data-panel-min-height /
     data-panel-max-height（高度上限）
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

const PANEL_SIZING_ATTRS = {
  width: 'data-panel-width',
  minWidth: 'data-panel-min',
  maxWidth: 'data-panel-max',
  minHeight: 'data-panel-min-height',
  maxHeight: 'data-panel-max-height',
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
 *  视口守卫：width / maxWidth 一律夹到 视口宽 − 24px（窄屏上过大的 data-panel-width 不溢出，
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
 *  横向侧（left/right）：锚点左右翻转，宽取 min..max（不随锚点 stretch），高占满可用空间，
 *  纵向按 align（start/center/end；stretch 视作 start）贴锚。 */
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
    const availableLeft = Math.max(0, anchor.left - margin - offset);
    const availableRight = Math.max(0, viewport.width - anchor.right - margin - offset);
    const side: PopoverSide =
      (preferredSide === 'left' ? availableLeft : availableRight) >= DEFAULT_MIN_WIDTH
        ? preferredSide
        : preferredSide === 'left' ? 'right' : 'left';
    const minWidth = Math.max(1, opts.minWidth ?? DEFAULT_MIN_WIDTH);
    const maxWidth = Math.min(
      Math.max(opts.maxWidth ?? DEFAULT_MAX_WIDTH, minWidth),
      side === 'left' ? availableLeft : availableRight,
    );
    const width = clamp(minWidth, Math.min(minWidth, maxWidth), Math.max(minWidth, maxWidth));
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
  const availableHeight = Math.max(80, viewport.height - margin * 2);
  const minHeight = Math.min(Math.max(80, opts.minHeight ?? DEFAULT_MIN_HEIGHT), availableHeight);
  const requestedMaxHeight = Math.max(minHeight, opts.maxHeight ?? DEFAULT_MAX_HEIGHT);
  const fallbackHeight = Math.min(260, requestedMaxHeight);
  const contentHeight = Math.max(opts.contentHeightHint ?? 0, fallbackHeight);
  const desiredHeight = clamp(contentHeight, minHeight, Math.min(requestedMaxHeight, availableHeight));
  const side = chooseSide(preferredSide, availableTop, availableBottom, desiredHeight);
  const sideSpace = side === 'top' ? availableTop : availableBottom;
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
}

const openPanels = new Map<HTMLElement, OpenState>();

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
  const layout = computePopoverLayout(
    anchor,
    { width: window.innerWidth, height: window.innerHeight },
    state.opts,
  );
  const { panel } = state;
  panel.style.left = `${layout.left}px`;
  panel.style.top = `${layout.top}px`;
  panel.style.width = `${layout.width}px`;
  panel.style.maxHeight = `${layout.maxHeight}px`;
  panel.dataset.side = layout.side;
  panel.style.visibility = state.prevVisibility;
}

function onWindowChange(): void {
  openPanels.forEach(relayout);
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
  if (e.key !== 'Escape') return;
  // 只关最上层（最后打开的），逐次 Esc 逐层关闭
  const states = Array.from(openPanels.values());
  const top = states[states.length - 1];
  if (top) {
    e.preventDefault();
    closePopover(top.panel);
  }
}

/** 打开浮层：panel 移入 body 并按 anchor 布局；重复调用同一 panel 为先关后开。 */
export function openPopover(panel: HTMLElement, options: OpenPopoverOptions): void {
  if (typeof document === 'undefined') return;
  if (openPanels.has(panel)) closePopover(panel);

  const { anchor, onClose, sizing, ...rest } = options;
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
  };
  openPanels.set(panel, state);

  document.body.appendChild(panel);
  panel.hidden = false;
  panel.style.visibility = 'hidden';
  relayout(state);

  if (openPanels.size === 1) {
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    window.addEventListener('keydown', onKeyDown);
  }
}

/** 关闭浮层：移除监听并把 panel 还原到打开前的位置与 hidden 状态。 */
export function closePopover(panel: HTMLElement): void {
  if (typeof document === 'undefined') return;
  const state = openPanels.get(panel);
  if (!state) return;
  openPanels.delete(panel);

  panel.style.visibility = state.prevVisibility;
  /* hidden 还原：字符串值（如 until-found）走 setAttribute，布尔走属性赋值 */
  if (typeof state.wasHidden === 'string') panel.setAttribute('hidden', state.wasHidden);
  else panel.hidden = state.wasHidden;
  panel.style.left = '';
  panel.style.top = '';
  panel.style.width = '';
  panel.style.maxHeight = '';
  delete panel.dataset.side;
  if (state.placeholder.parentNode) {
    state.placeholder.parentNode.insertBefore(panel, state.placeholder);
    state.placeholder.remove();
  }

  if (openPanels.size === 0) {
    window.removeEventListener('resize', onWindowChange);
    window.removeEventListener('scroll', onWindowChange, true);
    document.removeEventListener('pointerdown', onOutsidePointerDown, true);
    window.removeEventListener('keydown', onKeyDown);
  }

  state.onClose?.();
}
