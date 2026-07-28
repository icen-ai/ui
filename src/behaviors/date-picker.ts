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
 *
 * behavior 渲染日历面板（portal 到 body），点选后更新 hidden input + 触发 change 事件。
 */

interface MarkedPicker extends HTMLElement {
  __icenDatePickerInit?: boolean;
}

let openPicker: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let outsideHandler: ((e: Event) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

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
  const pw = 280;
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

const CAL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>';

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

  let html = `<div class="date-picker-head">
    <button class="date-picker-nav" data-dp-nav="-1" type="button" aria-label="上一月">‹</button>
    <span class="date-picker-title">${year} 年 ${month + 1} 月</span>
    <button class="date-picker-nav" data-dp-nav="1" type="button" aria-label="下一月">›</button>
  </div><div class="date-picker-weekdays">${labels
    .map((l) => `<span>${l}</span>`)
    .join('')}</div><div class="date-picker-grid">`;

  for (const d of cells) {
    const isOutside = d.getMonth() !== month;
    const ds = toDateStr(d);
    const isToday = d.getTime() === today.getTime();
    const isSelected = selected && ds === toDateStr(selected);
    const disabled = (min && d < min) || (max && d > max);
    const classes = ['date-picker-cell'];
    if (isOutside) classes.push('is-outside');
    if (isToday) classes.push('is-today');
    if (isSelected) classes.push('is-selected');
    if (disabled) classes.push('is-disabled');
    html += `<button type="button" class="${classes.join(' ')}" data-dp-date="${ds}"${
      disabled ? ' disabled' : ''
    }>${d.getDate()}</button>`;
  }
  html += `</div><div class="date-picker-foot">
    <button type="button" class="date-picker-today" data-dp-today>今天</button>
    <button type="button" class="date-picker-clear" data-dp-clear>清除</button>
  </div>`;

  panel.innerHTML = html;

  // 事件
  panel.querySelector('[data-dp-nav="-1"]')?.addEventListener('click', () => {
    ctx.view = new Date(year, month - 1, 15);
    renderCalendar(panel, { ...ctx, view: ctx.view });
  });
  panel.querySelector('[data-dp-nav="1"]')?.addEventListener('click', () => {
    ctx.view = new Date(year, month + 1, 15);
    renderCalendar(panel, { ...ctx, view: ctx.view });
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-dp-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ds = btn.dataset.dpDate;
      if (!ds) return;
      const d = parseDateStr(ds);
      if (d) onPick(d);
    });
  });
  panel.querySelector('[data-dp-today]')?.addEventListener('click', () => {
    onPick(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  });
  panel.querySelector('[data-dp-clear]')?.addEventListener('click', () => {
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
}

function setupPicker(container: HTMLElement): void {
  const el = container as MarkedPicker;
  if (el.__icenDatePickerInit) return;
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
    trigger.innerHTML = `<span class="date-picker-value${initialDate ? '' : ' is-empty'}"></span><span class="date-picker-icon">${CAL_ICON}</span>`;
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
  }

  trigger.addEventListener('click', () => {
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
    const view = selected ?? new Date();
    view.setDate(15);

    positionPanel(panel, trigger);
    renderCalendar(panel, {
      view,
      selected,
      min,
      max,
      weekStart,
      onPick: (d: Date | null) => {
        if (d === null) {
          if (hidden) {
            hidden.value = '';
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else {
          if (hidden) {
            hidden.value = toDateStr(d);
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
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

    // 窗口滚动 / resize 重定位
    const reposition = (): void => {
      if (openPicker === el && panel && !panel.hidden) positionPanel(panel, trigger);
    };
    window.addEventListener('scroll', reposition, { passive: true, once: false });
    window.addEventListener('resize', reposition, { passive: true });
  });
}

/** 初始化：扫描 root 下的 .date-picker[data-date-picker]。 */
export function initDatePicker(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  if (typeof window === 'undefined') return;
  const pickers: Element[] = [];
  if (root instanceof Element && root.matches('.date-picker[data-date-picker]')) pickers.push(root);
  pickers.push(...Array.from(root.querySelectorAll('.date-picker[data-date-picker]')));
  for (const p of pickers) setupPicker(p as HTMLElement);
}
