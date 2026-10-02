/*
 * @icen.ai/ui — Behavior: date-picker（日期选择，与 components/date-picker.css 配套）
 *
 * 契约：
 *   <div class="date-picker" data-date-picker>
 *     <button class="date-picker-trigger" type="button">
 *       <span class="date-picker-value">2026-07-29</span>
 *       <svg class="date-picker-icon">…</svg>
 *     </button>
 *     <input type="hidden" name="date" value="2026-07-29" />
 *   </div>
 *
 * 可选 data-*：
 *   data-date-picker-format="yyyy-mm-dd"  显示格式（默认 yyyy-mm-dd）
 *   data-date-picker-min="2026-01-01"     最小可选日期
 *   data-date-picker-max="2026-12-31"     最大可选日期
 *   data-date-picker-week-start="0"       周首日（0=周日，1=周一，默认 1）
 *   data-date-picker-placeholder="选择日期" 空值占位文本
 *   面板尺寸走全库统一 PanelSizing 契约：data-panel-width 覆盖默认 280 宽，
 *   data-panel-min / -max / -max-height 同理（面板为跨实例单例）。
 *
 * behavior 渲染日历面板（portal 到 body，DOM API 构建，禁 innerHTML），
 * 点选后更新 hidden input + 触发 change 事件。外点 / Esc 关闭；
 * 滚动 / resize 重定位监听随面板关闭一并移除。
 */

import { applyPanelSizing, readPanelSizing } from './popover';
import { emitIcen } from './events';

interface MarkedPicker extends HTMLElement {
  __icenDatePickerInit?: boolean;
}

let openPicker: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let outsideHandler: ((e: Event) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let repositionHandler: (() => void) | null = null;

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateStr(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function format(d: Date | null, fmt: string): string {
  if (!d) return '';
  return fmt
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/yy/g, String(d.getFullYear()).slice(-2))
    .replace(/mm/g, pad(d.getMonth() + 1))
    .replace(/m/g, String(d.getMonth() + 1))
    .replace(/dd/g, pad(d.getDate()))
    .replace(/d/g, String(d.getDate()));
}

function ensurePanel(): HTMLElement {
  if (panelEl && panelEl.isConnected) return panelEl;
  const el = document.createElement('div');
  el.className = 'date-picker-panel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '选择日期');
  el.hidden = true;
  document.body.appendChild(el);
  panelEl = el;
  return el;
}

function positionPanel(panel: HTMLElement, trigger: HTMLElement): void {
  const r = trigger.getBoundingClientRect();
  /* 面板尺寸契约（PanelSizing）：根上 data-panel-* 可覆盖默认 280 宽与高度上限；
     面板是跨实例单例，未指定的字段必须清空内联，避免串味 */
  const sizing = readPanelSizing(trigger.closest('[data-date-picker]'));
  /* 面板是跨实例单例：先复位全部内联尺寸再按本次契约应用（applyPanelSizing(null) 复位语义） */
  applyPanelSizing(panel, null);
  if (sizing.width != null || sizing.minWidth != null) {
    applyPanelSizing(panel, { width: sizing.width ?? sizing.minWidth, maxWidth: sizing.maxWidth, maxHeight: sizing.maxHeight });
  } else {
    applyPanelSizing(panel, sizing);
  }
  const pw = sizing.width ?? sizing.minWidth ?? 280;
  const ph = panel.offsetHeight || 320;
  let left = r.left;
  let top = r.bottom + 4;
  if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
  if (left < 12) left = 12;
  if (top + ph > window.innerHeight - 12) top = r.top - ph - 4;
  if (top < 12) top = 12;
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** trigger 的日历图标（DOM API 构建，替代原 innerHTML SVG 字符串）。 */
function buildCalIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '3');
  rect.setAttribute('y', '4');
  rect.setAttribute('width', '18');
  rect.setAttribute('height', '18');
  rect.setAttribute('rx', '2');
  rect.setAttribute('ry', '2');
  svg.appendChild(rect);
  const lines: Array<[string, string, string, string]> = [
    ['16', '16', '2', '6'],
    ['8', '8', '2', '6'],
    ['3', '21', '10', '10'],
  ];
  for (const [x1, x2, y1, y2] of lines) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('x2', x2);
    line.setAttribute('y1', y1);
    line.setAttribute('y2', y2);
    svg.appendChild(line);
  }
  return svg;
}

const WEEK_LABELS_ZH = ['一', '二', '三', '四', '五', '六', '日'];
const WEEK_LABELS_SUN = ['日', '一', '二', '三', '四', '五', '六'];

function renderCalendar(
  panel: HTMLElement,
  ctx: {
    view: Date;
    selected: Date | null;
    min: Date | null;
    max: Date | null;
    weekStart: number;
    onPick: (d: Date) => void;
  },
): void {
  const { view, selected, min, max, weekStart, onPick } = ctx;
  const year = view.getFullYear();
  const month = view.getMonth();
  const labels = weekStart === 0 ? WEEK_LABELS_SUN : WEEK_LABELS_ZH;

  const firstDay = new Date(year, month, 1);
  // day-of-month of the first grid cell (may be from prev month)
  const offsetRaw = firstDay.getDay(); // 0=Sun, 1=Mon ...
  const leadDays = weekStart === 0 ? offsetRaw : (offsetRaw + 6) % 7;
  const gridStart = new Date(year, month, 1 - leadDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  panel.textContent = '';

  const head = document.createElement('div');
  head.className = 'date-picker-head';
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'date-picker-nav';
  prevBtn.setAttribute('aria-label', '上一月');
  prevBtn.textContent = '‹';
  const title = document.createElement('span');
  title.className = 'date-picker-title';
  title.textContent = `${year} 年 ${month + 1} 月`;
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'date-picker-nav';
  nextBtn.setAttribute('aria-label', '下一月');
  nextBtn.textContent = '›';
  head.append(prevBtn, title, nextBtn);

  const weekdays = document.createElement('div');
  weekdays.className = 'date-picker-weekdays';
  for (const label of labels) {
    const s = document.createElement('span');
    s.textContent = label;
    weekdays.appendChild(s);
  }

  const grid = document.createElement('div');
  grid.className = 'date-picker-grid';
  for (const d of cells) {
    const isOutside = d.getMonth() !== month;
    const isToday = d.getTime() === today.getTime();
    const isSelected = selected !== null && toDateStr(d) === toDateStr(selected);
    const disabled = (min !== null && d < min) || (max !== null && d > max);
    const classes = ['date-picker-cell'];
    if (isOutside) classes.push('is-outside');
    if (isToday) classes.push('is-today');
    if (isSelected) classes.push('is-selected');
    if (disabled) classes.push('is-disabled');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = classes.join(' ');
    btn.textContent = String(d.getDate());
    if (disabled) btn.disabled = true;
    btn.addEventListener('click', () => onPick(d));
    grid.appendChild(btn);
  }

  const foot = document.createElement('div');
  foot.className = 'date-picker-foot';
  const todayBtn = document.createElement('button');
  todayBtn.type = 'button';
  todayBtn.className = 'date-picker-today';
  todayBtn.textContent = '今天';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'date-picker-clear';
  clearBtn.textContent = '清除';
  foot.append(todayBtn, clearBtn);

  panel.append(head, weekdays, grid, foot);

  // 事件
  prevBtn.addEventListener('click', () => {
    ctx.view = new Date(year, month - 1, 15);
    renderCalendar(panel, { ...ctx, view: ctx.view });
  });
  nextBtn.addEventListener('click', () => {
    ctx.view = new Date(year, month + 1, 15);
    renderCalendar(panel, { ...ctx, view: ctx.view });
  });
  todayBtn.addEventListener('click', () => {
    onPick(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  });
  clearBtn.addEventListener('click', () => {
    onPick(null as unknown as Date);
  });
}

function closePanel(): void {
  if (!panelEl) return;
  panelEl.hidden = true;
  openPicker?.querySelector('.date-picker-trigger')?.classList.remove('is-open');
  openPicker = null;
  if (outsideHandler) {
    document.removeEventListener('mousedown', outsideHandler);
    outsideHandler = null;
  }
  if (escHandler) {
    window.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  if (repositionHandler) {
    window.removeEventListener('scroll', repositionHandler);
    window.removeEventListener('resize', repositionHandler);
    repositionHandler = null;
  }
}

/** 已初始化容器（幂等 + 销毁后可重新 init）。 */
const pickersInit = new WeakSet<HTMLElement>();

function setupPicker(container: HTMLElement): () => void {
  if (pickersInit.has(container)) return () => {};
  pickersInit.add(container);
  const el = container as MarkedPicker;
  /* 本容器持久监听挂同一 AbortSignal：销毁一次摘净 */
  const ac = new AbortController();
  const disposers: Array<() => void> = [() => { ac.abort(); pickersInit.delete(container); }];
  if (el.__icenDatePickerInit) return () => {};
  el.__icenDatePickerInit = true;

  const fmt = el.dataset.datePickerFormat ?? 'yyyy-mm-dd';
  const minStr = el.dataset.datePickerMin;
  const maxStr = el.dataset.datePickerMax;
  const weekStart = Number(el.dataset.datePickerWeekStart ?? '1');
  const placeholder = el.dataset.datePickerPlaceholder ?? '选择日期';
  const min = minStr ? parseDateStr(minStr) : null;
  const max = maxStr ? parseDateStr(maxStr) : null;

  // 找到 hidden input
  const hidden = el.querySelector<HTMLInputElement>('input[type="hidden"]');
  const initialStr = hidden?.value ?? '';
  const initialDate = initialStr ? parseDateStr(initialStr) : null;

  // 找或构建触发器
  let trigger = el.querySelector<HTMLButtonElement>('.date-picker-trigger');
  if (!trigger) {
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'date-picker-trigger';
    const value = document.createElement('span');
    value.className = initialDate ? 'date-picker-value' : 'date-picker-value is-empty';
    const icon = document.createElement('span');
    icon.className = 'date-picker-icon';
    icon.appendChild(buildCalIcon());
    trigger.append(value, icon);
    el.prepend(trigger);
  }
  trigger.setAttribute('aria-haspopup', 'dialog');

  const valueEl = trigger.querySelector<HTMLElement>('.date-picker-value');
  function paint(): void {
    const v = hidden?.value ?? '';
    const d = v ? parseDateStr(v) : null;
    if (valueEl) {
      valueEl.textContent = d ? format(d, fmt) : placeholder;
      valueEl.classList.toggle('is-empty', !d);
    }
  }
  paint();

  if (hidden) {
    // 使用 MutationObserver 监听 hidden input 的 value 被外部修改
    const obs = new MutationObserver(() => paint());
    obs.observe(hidden, { attributes: true, attributeFilter: ['value'] });
    disposers.push(() => obs.disconnect());
  }

  const onTriggerClick = (): void => {
    if (openPicker === el) {
      closePanel();
      return;
    }
    closePanel();
    openPicker = el;
    trigger.classList.add('is-open');

    const panel = ensurePanel();
    panel.hidden = false;

    const selected = hidden?.value ? parseDateStr(hidden.value) : null;
    // clone 再改"日"：直接 setDate 会原地改 selected，重开时已选高亮错位成 15 号
    const view = selected ? new Date(selected.getTime()) : new Date();
    view.setDate(15);

    positionPanel(panel, trigger);
    renderCalendar(panel, {
      view,
      selected,
      min,
      max,
      weekStart,
      onPick: (d: Date | null) => {
        if (hidden) hidden.value = d ? toDateStr(d) : '';
        /* 领域事件走 icen: 契约；hidden input 的原生 change 保留给表单框架（双通道） */
        emitIcen(el, 'icen:date-change', { value: d ? toDateStr(d) : '', date: d });
        if (hidden) hidden.dispatchEvent(new Event('change', { bubbles: true }));
        paint();
        closePanel();
      },
    });

    // 外点 / Esc
    outsideHandler = (ev: Event) => {
      const t = ev.target instanceof Node ? ev.target : null;
      if (!t) return;
      if (panel.contains(t) || el.contains(t)) return;
      closePanel();
    };
    document.addEventListener('mousedown', outsideHandler);

    escHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closePanel();
      }
    };
    window.addEventListener('keydown', escHandler);

    // 窗口滚动 / resize 重定位（closePanel 统一移除）
    repositionHandler = () => {
      if (openPicker === el && !panel.hidden) positionPanel(panel, trigger);
    };
    window.addEventListener('scroll', repositionHandler, { passive: true });
    window.addEventListener('resize', repositionHandler, { passive: true });
  };
  trigger.addEventListener('click', onTriggerClick, { signal: ac.signal });

  return (): void => {
    for (const d of disposers) d();
  };
}

/** 返回销毁函数：摘除本次初始化容器的全部监听并复位幂等标记（可重新 init）。 */
export function initDatePicker(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => {};
  if (typeof window === 'undefined') return () => {};
  const scope = root ?? document;
  const pickers: Element[] = [];
  if (scope instanceof Element && scope.matches('.date-picker[data-date-picker]')) pickers.push(scope);
  pickers.push(...Array.from(scope.querySelectorAll('.date-picker[data-date-picker]')));
  const disposers: Array<() => void> = [];
  for (const p of pickers) disposers.push(setupPicker(p as HTMLElement));
  return (): void => {
    for (const d of disposers) d();
  };
}
