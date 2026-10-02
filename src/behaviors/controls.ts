/*
 * @icen.ai/ui — Behavior: controls（表单选择控件 / 步进器 / 分段 / 步骤条 / 评分 / 分页 / 静态表排序）
 * 与 components/switch.css、segmented.css（.segmented/.stepper）、steps.css、media.css（.rating）、
 * pagination.css、table.css（th[data-sort]）配套。
 *
 * 全部 document 级事件委托：页面级一次 init 即接管后续插入的 DOM；重复调用幂等
 * （返回 no-op，同 events.ts initGestures 约定）；返回销毁函数（摘除委托 + 复位
 * 幂等标记，销毁后可重新 init）。SSR（window 未定义）下全部返回 no-op。
 * 状态只写 aria-* / .is-* 类名与 textContent，绝不 innerHTML；事件统一走 emitIcen。
 *
 * ── initSwitch：开关 / 勾选框 / 单选（switch.css）──
 * 契约：
 *   <button class="switch" role="switch" aria-checked="true|false" [disabled]>
 *     <span class="switch-thumb"></span>
 *   </button>
 *   <button class="checkbox" role="checkbox" aria-checked="true|false|mixed" [disabled]></button>
 *   <div class="radio-group" role="radiogroup">           ← 或 [data-radio-group] 容器
 *     <button class="radio-item" role="radio" aria-checked="…">…</button> × n
 *   </div>                                                  ← .radio-card[role="radio"] 同理
 *   <label class="checkbox-row">…<button class="checkbox" role="checkbox">…</button></label>
 * 行为：点击 / Space / Enter——
 *   - switch：aria-checked 布尔翻转；
 *   - checkbox：三态循环 true→false→mixed→true（首次点击仍处于 mixed 的元素视为
 *     初始半选，mixed→false，此后并入循环）；
 *   - radio：组内互斥（aria-checked + .is-selected 同步；重复点击已选项 no-op）；
 *   - .checkbox-row 整行可点（CSS cursor:pointer 契约），行内原生交互元素不劫持。
 * 事件映射：switch → icen:switch-change { el, checked }；
 *   checkbox / radio（含 .checkbox-row 回退路径）→ icen:check-change { el, checked: boolean | 'mixed' }。
 *
 * ── initStepper：数字步进器（segmented.css .stepper）──
 * 契约（依 segmented.css 头注释，按钮方向由 data-step 承载，±1 之外可写 ±n）：
 *   <div class="stepper">
 *     <button class="stepper-btn" data-step="-1">−</button>
 *     <input class="stepper-input" type="number" min="0" max="100" />
 *     <button class="stepper-btn" data-step="1">+</button>
 *   </div>
 * 行为：点击 .stepper-btn → 关联 .stepper-input 取值 ± data-step（缺省 1），
 *   clamp 到 input 的 min/max（缺省 ±∞），浮点步长去尾噪后回写 input.value。
 * 事件：icen:stepper-change { el: .stepper 根, value, delta }（delta 为实际增量，
 *   触界 clamp 时为 0，事件仍派发）。
 *
 * ── initSegmented：分段控件（segmented.css .segmented）──
 * 契约：
 *   <div class="segmented" role="radiogroup">
 *     <button class="segmented-item" role="radio" [aria-checked] [data-value]>…</button> × n
 *   </div>
 * 行为：点击 .segmented-item → 组内 .is-active 互斥 + role="radio" 项同步
 *   aria-checked（重复点击当前项 no-op）。toggle-group 同族变体不在此列（纯 CSS，
 *   使用方自行驱动）。
 * 事件：icen:segmented-change { el: .segmented 容器, value: data-value ?? String(index), index }。
 *
 * ── initSteps：步骤条（steps.css）──
 * 契约：.steps（ol）> .step（li）四态类 step--finish/process/wait/error；
 *   可点击步骤额外标 role="button"（可配 .step--clickable 视觉，建议 tabindex="0"）。
 * 行为：点击 .step[role="button"] → 激活点位移：目标步 step--process + .is-active、
 *   之前全部 step--finish、之后全部 step--wait（目标步原有 step--error 让位于
 *   process，其余步骤的 error 保留）。
 * 事件：icen:step-change { step, index }（index 为该步在容器内的序号，0 起算）。
 *
 * ── initRating：星级评分（media.css .rating）──
 * 契约：
 *   <div class="rating">                                  ← .rating--readonly 只读，不接线
 *     <button class="rating-star" aria-label="n 星">svg</button> × n
 *     <span class="rating-value">3</span>                 ← 可选，选中后自动回写数值
 *   </div>
 * 行为：点击 .rating-star → 重建选中态：该星及之前 .is-filled（其余清除，
 *   残留 .is-half 一并清除）。
 * 事件：icen:rating-change { el: .rating 容器, value }（1 起算；点击当前值不衰减）。
 *
 * ── initPagination：分页（pagination.css）──
 * 契约：
 *   <nav class="pagination" aria-label="分页">
 *     <button class="page-btn" aria-label="上一页">‹</button>   ← 方向钮：aria-label 或
 *     <button class="page-btn [.is-active]" aria-current="page">1</button>   data-dir="prev|next"
 *     <span class="page-ellipsis">…</span>                      ← 省略号非按钮，天然跳过
 *     <button class="page-btn" data-page="5">5</button>        ← 页码：data-page > 文本数字 > 序号
 *     <button class="page-btn" aria-label="下一页">›</button>
 *   </nav>
 * 行为：点击数字页码 → .is-active / aria-current 位移；点击方向钮 → 当前页 ±1，
 *   目标页码钮存在则同步位移（被省略号折叠时只派事件，由消费方重排按钮）。
 *   总页数与省略号折叠策略归消费方，本行为只做单次点击语义。
 * 事件：icen:page-change { page }。
 *
 * ── initTableSort：静态表排序（table.css th[data-sort]）──
 * 契约（table.css：th[data-sort] 中性 ↕ / ='asc' ↑ / ='desc' ↓）：
 *   <th data-sort="price">价格</th>          ← 中性态：属性值即列 key
 * 行为：点击 th[data-sort] → 单列排序循环 asc→desc→无；排序中属性值被方向
 *   （asc/desc）占用，原始列 key 首次交互时转存 data-sort-key，回「无」时还原；
 *   同表其他 th 一并复位为各自 key。
 * 事件：icen:sort-change { th, key: 原始 data-sort 列 key, dir: 'asc'|'desc'|null }。
 *
 * kit 兼容：segmented 的 kit 入口（scripts/slugs.mjs SLUG_EXPORTS）从本模块统一
 * re-export，故此处转发 input.ts 的 initInput（OTP 行为），保证 kit/segmented
 * 同时带出 OTP 与分段 / 步进接线。
 */

import { emitIcen } from './events';

/* ── 公共小工具 ── */

/** 禁用判定：原生 disabled / aria-disabled / .is-disabled / data-disabled 任一命中。 */
function isDisabled(el: HTMLElement): boolean {
  return (
    (el instanceof HTMLButtonElement && el.disabled) ||
    el.hasAttribute('disabled') ||
    el.getAttribute('aria-disabled') === 'true' ||
    el.classList.contains('is-disabled') ||
    el.hasAttribute('data-disabled')
  );
}

function isActivateKey(ev: KeyboardEvent): boolean {
  return ev.key === 'Enter' || ev.key === ' ';
}

interface DelegatedHandlers {
  click?: (ev: MouseEvent) => void;
  keydown?: (ev: KeyboardEvent) => void;
}

/**
 * 造一个 document 级委托 init：幂等（已启动时重复调用返回 no-op）、SSR 安全、
 * 返回销毁函数（摘除委托并复位幂等标记，销毁后可重新 init）。
 */
function createDelegatedInit(handlers: DelegatedHandlers): () => void {
  let inited = false;
  return () => {
    if (inited || typeof document === 'undefined') return () => {};
    inited = true;
    if (handlers.click) document.addEventListener('click', handlers.click);
    if (handlers.keydown) document.addEventListener('keydown', handlers.keydown);
    return () => {
      if (handlers.click) document.removeEventListener('click', handlers.click);
      if (handlers.keydown) document.removeEventListener('keydown', handlers.keydown);
      inited = false;
    };
  };
}

/* ── 1. switch / checkbox / radio ── */

const SWITCH_LIKE = '.switch[role="switch"], .checkbox[role="checkbox"], '
  + '.radio-item[role="radio"], .radio[role="radio"], .radio-card[role="radio"]';

/** 首次观察到的 checkbox 记账：仍处 mixed 即视为「初始半选」，首击 mixed→false。 */
const seenCheckboxes = new WeakSet<HTMLElement>();

function toggleSwitch(el: HTMLElement): void {
  const checked = el.getAttribute('aria-checked') !== 'true';
  el.setAttribute('aria-checked', String(checked));
  emitIcen(el, 'icen:switch-change', { el, checked });
}

function toggleCheckbox(el: HTMLElement): void {
  const cur = el.getAttribute('aria-checked') ?? 'false';
  const firstSeen = !seenCheckboxes.has(el);
  seenCheckboxes.add(el);
  let next: 'true' | 'false' | 'mixed';
  if (cur === 'mixed') next = firstSeen ? 'false' : 'true';
  else next = cur === 'true' ? 'false' : 'mixed';
  el.setAttribute('aria-checked', next);
  const checked: boolean | 'mixed' = next === 'mixed' ? 'mixed' : next === 'true';
  emitIcen(el, 'icen:check-change', { el, checked });
}

function selectRadio(el: HTMLElement): void {
  if (el.getAttribute('aria-checked') === 'true') return;
  const group = el.closest('[data-radio-group], .radio-group, [role="radiogroup"], .radio-card-grid');
  const peers = group
    ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')).filter(
        (it) => it.closest('[data-radio-group], .radio-group, [role="radiogroup"], .radio-card-grid') === group,
      )
    : [el];
  for (const it of peers) {
    const on = it === el;
    it.classList.toggle('is-selected', on);
    it.setAttribute('aria-checked', String(on));
  }
  emitIcen(el, 'icen:check-change', { el, checked: true });
}

function activateSwitchLike(el: HTMLElement): void {
  if (el.matches('.switch[role="switch"]')) toggleSwitch(el);
  else if (el.matches('.checkbox[role="checkbox"]')) toggleCheckbox(el);
  else selectRadio(el);
}

/** 命中本次点击的开关类控件：直属优先；否则 .checkbox-row 整行点击回退到行内 checkbox。 */
function resolveSwitchTarget(t: EventTarget | null): HTMLElement | null {
  if (!(t instanceof Element)) return null;
  const direct = t.closest<HTMLElement>(SWITCH_LIKE);
  if (direct) return isDisabled(direct) ? null : direct;
  const row = t.closest<HTMLElement>('.checkbox-row');
  if (row && !t.closest('button, a, input, select, textarea, [contenteditable]')) {
    const box = row.querySelector<HTMLElement>('.checkbox[role="checkbox"]');
    if (box && !isDisabled(box)) return box;
  }
  return null;
}

function onSwitchClick(ev: MouseEvent): void {
  const el = resolveSwitchTarget(ev.target);
  if (el) activateSwitchLike(el);
}

function onSwitchKeydown(ev: KeyboardEvent): void {
  if (!isActivateKey(ev)) return;
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const el = t.closest<HTMLElement>(SWITCH_LIKE);
  if (!el || isDisabled(el)) return;
  ev.preventDefault();
  activateSwitchLike(el);
}

/**
 * 接线开关 / 勾选框 / 单选（document 级委托，页面级一次即可，重复调用幂等）。
 * 点击 / Space / Enter 驱动 aria-checked（checkbox 三态循环含初始半选例外；
 * radio 组内互斥），派 icen:switch-change / icen:check-change。
 * 返回销毁函数：摘除委托并复位幂等标记，销毁后可重新 initSwitch。SSR 下返回 no-op。
 */
export const initSwitch = createDelegatedInit({ click: onSwitchClick, keydown: onSwitchKeydown });

/* ── 2. stepper ── */

function stepStepper(btn: HTMLElement): void {
  const root = btn.closest<HTMLElement>('.stepper');
  if (!root) return;
  const input = root.querySelector<HTMLInputElement>('input.stepper-input, input[type="number"]');
  if (!input || input.disabled) return;
  const step = Number(btn.getAttribute('data-step')) || 1;
  const minAttr = input.min;
  const maxAttr = input.max;
  const min = minAttr !== '' && Number.isFinite(Number(minAttr)) ? Number(minAttr) : -Infinity;
  const max = maxAttr !== '' && Number.isFinite(Number(maxAttr)) ? Number(maxAttr) : Infinity;
  const base = Number.isFinite(Number(input.value)) ? Number(input.value) : 0;
  /* toPrecision(12)：浮点步长（如 0.1）去二进制尾噪 */
  const next = Number(Math.min(max, Math.max(min, base + step)).toPrecision(12));
  const delta = next - base;
  input.value = String(next);
  emitIcen(root, 'icen:stepper-change', { el: root, value: next, delta });
}

function onStepperClick(ev: MouseEvent): void {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const btn = t.closest<HTMLElement>('.stepper-btn');
  if (!btn || isDisabled(btn)) return;
  stepStepper(btn);
}

/**
 * 接线数字步进器（document 级委托，重复调用幂等）。
 * .stepper 内 .stepper-btn[data-step] 点击 → .stepper-input 数值 ±step 并 clamp 到
 * min/max，派 icen:stepper-change { el: .stepper 根, value, delta }（触界 delta 为 0）。
 * 返回销毁函数：摘除委托并复位幂等标记，销毁后可重新 initStepper。SSR 下返回 no-op。
 */
export const initStepper = createDelegatedInit({ click: onStepperClick });

/* ── 3. segmented ── */

function selectSegmentedItem(item: HTMLElement): void {
  const container = item.closest<HTMLElement>('.segmented');
  if (!container) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>('.segmented-item')).filter(
    (it) => it.closest('.segmented') === container,
  );
  const index = items.indexOf(item);
  if (index === -1) return;
  if (item.classList.contains('is-active') || item.getAttribute('aria-checked') === 'true') return;
  for (const it of items) {
    const on = it === item;
    it.classList.toggle('is-active', on);
    if (it.getAttribute('role') === 'radio') it.setAttribute('aria-checked', String(on));
  }
  emitIcen(container, 'icen:segmented-change', {
    el: container,
    value: item.getAttribute('data-value') ?? String(index),
    index,
  });
}

function onSegmentedClick(ev: MouseEvent): void {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const item = t.closest<HTMLElement>('.segmented-item');
  if (!item || isDisabled(item)) return;
  selectSegmentedItem(item);
}

/**
 * 接线分段控件（document 级委托，重复调用幂等）。
 * .segmented 内 .segmented-item 点击 → 组内 .is-active 互斥 + role="radio" 项同步
 * aria-checked，派 icen:segmented-change { el: 容器, value: data-value ?? String(index), index }。
 * 返回销毁函数：摘除委托并复位幂等标记，销毁后可重新 initSegmented。SSR 下返回 no-op。
 */
export const initSegmented = createDelegatedInit({ click: onSegmentedClick });

/* ── 4. steps ── */

function activateStep(step: HTMLElement): void {
  const container = step.closest<HTMLElement>('.steps');
  if (!container) return;
  const list = Array.from(container.querySelectorAll<HTMLElement>('.step')).filter(
    (s) => s.closest('.steps') === container,
  );
  const index = list.indexOf(step);
  if (index === -1) return;
  list.forEach((s, i) => {
    s.classList.toggle('is-active', i === index);
    if (i < index) {
      s.classList.add('step--finish');
      s.classList.remove('step--process', 'step--wait');
    } else if (i === index) {
      s.classList.add('step--process');
      s.classList.remove('step--finish', 'step--wait', 'step--error');
    } else {
      s.classList.add('step--wait');
      s.classList.remove('step--finish', 'step--process');
    }
  });
  emitIcen(container, 'icen:step-change', { step, index });
}

function onStepsClick(ev: MouseEvent): void {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const step = t.closest<HTMLElement>('.step[role="button"]');
  if (!step || isDisabled(step)) return;
  activateStep(step);
}

function onStepsKeydown(ev: KeyboardEvent): void {
  if (!isActivateKey(ev)) return;
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const step = t.closest<HTMLElement>('.step[role="button"]');
  if (!step) return;
  ev.preventDefault();
  activateStep(step);
}

/**
 * 接线可点击步骤条（document 级委托，重复调用幂等）。
 * .steps 内 .step[role="button"] 点击（或聚焦后 Space / Enter）→ 激活点位移
 * （目标 step--process + .is-active，之前 finish、之后 wait），派
 * icen:step-change { step, index }。返回销毁函数：摘除委托并复位幂等标记，
 * 销毁后可重新 initSteps。SSR 下返回 no-op。
 */
export const initSteps = createDelegatedInit({ click: onStepsClick, keydown: onStepsKeydown });

/* ── 5. rating ── */

function rateStar(star: HTMLElement): void {
  const container = star.closest<HTMLElement>('.rating');
  if (!container || container.classList.contains('rating--readonly')) return;
  const stars = Array.from(container.querySelectorAll<HTMLElement>('.rating-star')).filter(
    (s) => s.closest('.rating') === container,
  );
  const index = stars.indexOf(star);
  if (index === -1) return;
  const value = index + 1;
  stars.forEach((s, i) => {
    s.classList.remove('is-half');
    s.classList.toggle('is-filled', i <= index);
  });
  const valueEl = container.querySelector<HTMLElement>('.rating-value');
  if (valueEl) valueEl.textContent = String(value);
  emitIcen(container, 'icen:rating-change', { el: container, value });
}

function onRatingClick(ev: MouseEvent): void {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const star = t.closest<HTMLElement>('.rating-star');
  if (!star || isDisabled(star)) return;
  rateStar(star);
}

/**
 * 接线星级评分（document 级委托，重复调用幂等）。
 * .rating 内 .rating-star 点击 → 该星及之前 .is-filled（重建选中态，清除残留
 * is-half），.rating-value 存在时回写数值（textContent），派
 * icen:rating-change { el: 容器, value }（1 起算）；.rating--readonly 不接线。
 * 返回销毁函数：摘除委托并复位幂等标记，销毁后可重新 initRating。SSR 下返回 no-op。
 */
export const initRating = createDelegatedInit({ click: onRatingClick });

/* ── 6. pagination ── */

/** 页码取值：data-page > 按钮文本数字 > 按钮序号（1 起算）。 */
function pageOf(btn: HTMLElement, btns: HTMLElement[]): number {
  const dp = btn.getAttribute('data-page');
  if (dp != null && dp.trim() !== '' && Number.isFinite(Number(dp))) return Number(dp);
  const text = Number((btn.textContent ?? '').trim());
  if (Number.isFinite(text) && text > 0) return text;
  return btns.indexOf(btn) + 1;
}

/** 方向钮判定：data-dir 或 aria-label（上一页 / prev / 下一页 / next 等）。 */
function dirOf(btn: HTMLElement): -1 | 0 | 1 {
  const dir = (btn.getAttribute('data-dir') ?? '').toLowerCase();
  if (dir === 'prev' || dir === '-1' || dir === 'previous') return -1;
  if (dir === 'next' || dir === '+1' || dir === '1') return 1;
  const label = btn.getAttribute('aria-label');
  /* 锚定整串匹配：prev 是 preview 的子串会误判成上一页；aria-label 约定为纯方向词，
     整句 label 不参与此推断——需要宽松匹配时请显式写 data-dir */
  if (label && /^上一页$|^上一张$|^向前$|^(prev|previous)$/i.test(label)) return -1;
  if (label && /^下一页$|^下一张$|^向后$|^next$/i.test(label)) return 1;
  return 0;
}

function setActivePage(btn: HTMLElement, btns: HTMLElement[]): void {
  for (const b of btns) {
    const on = b === btn;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
}

function goPage(btn: HTMLElement): void {
  const nav = btn.closest('.pagination');
  if (!nav) return;
  const btns = Array.from(nav.querySelectorAll<HTMLElement>('.page-btn')).filter(
    (b) => b.closest('.pagination') === nav,
  );
  const dir = dirOf(btn);
  if (dir !== 0) {
    const curBtn = btns.find(
      (b) => b.classList.contains('is-active') || b.getAttribute('aria-current') === 'page',
    );
    const cur = curBtn ? pageOf(curBtn, btns) : 1;
    const target = Math.max(1, cur + dir);
    /* 目标页码钮可见（未被省略号折叠）则同步位移；不可见只派事件，由消费方重排 */
    const targetBtn = btns.find((b) => dirOf(b) === 0 && pageOf(b, btns) === target);
    if (targetBtn) setActivePage(targetBtn, btns);
    emitIcen(nav, 'icen:page-change', { page: target });
    return;
  }
  const page = pageOf(btn, btns);
  setActivePage(btn, btns);
  emitIcen(nav, 'icen:page-change', { page });
}

function onPaginationClick(ev: MouseEvent): void {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const btn = t.closest<HTMLElement>('.page-btn');
  if (!btn || isDisabled(btn)) return;
  goPage(btn);
}

/**
 * 接线分页（document 级委托，重复调用幂等）。
 * .pagination 内 .page-btn 点击 → .is-active / aria-current 位移并派
 * icen:page-change { page }；页码取 data-page > 按钮文本数字 > 序号，上下页按钮按
 * aria-label / data-dir 推断方向（当前页 ±1，目标钮被省略号折叠时只派事件）。
 * 总页数与省略号折叠策略归消费方。返回销毁函数：摘除委托并复位幂等标记，
 * 销毁后可重新 initPagination。SSR 下返回 no-op。
 */
export const initPagination = createDelegatedInit({ click: onPaginationClick });

/* ── 7. 静态表排序 ── */

/** 列 key 取值：排序中 data-sort 被方向占用，以转存的 data-sort-key 为准；
 *  未转存时取 data-sort 原值（本身就是方向则视为空 key）。 */
function sortKeyOf(th: HTMLElement): string {
  const cur = th.getAttribute('data-sort') ?? '';
  return th.getAttribute('data-sort-key') ?? (cur === 'asc' || cur === 'desc' ? '' : cur);
}

/** 复位一个表头为其中性态（data-sort 还原为列 key）。 */
function resetSortHeader(th: HTMLElement): void {
  th.setAttribute('data-sort', sortKeyOf(th));
}

function cycleSort(th: HTMLElement): void {
  const cur = th.getAttribute('data-sort') ?? '';
  /* 排序中 data-sort 被方向占用，列 key 以 data-sort-key 为准（首次交互转存） */
  const key = sortKeyOf(th);
  if (!th.hasAttribute('data-sort-key') && key !== '') th.setAttribute('data-sort-key', key);
  const dir: 'asc' | 'desc' | null = cur === 'asc' ? 'desc' : cur === 'desc' ? null : 'asc';
  /* 单列排序：同表其他可排序表头复位 */
  const table = th.closest<HTMLElement>('table');
  if (table) {
    for (const h of table.querySelectorAll<HTMLElement>('th[data-sort]')) {
      if (h !== th) resetSortHeader(h);
    }
  }
  /* 中性态（dir=null）还原列 key，CSS 回到 ↕ */
  th.setAttribute('data-sort', dir ?? key);
  emitIcen(table ?? th, 'icen:sort-change', { th, key, dir });
}

function onSortClick(ev: MouseEvent): void {
  const t = ev.target;
  if (!(t instanceof Element)) return;
  const th = t.closest<HTMLElement>('th[data-sort]');
  if (!th) return;
  cycleSort(th);
}

/**
 * 接线静态表排序（document 级委托，重复调用幂等）。
 * th[data-sort] 点击 → asc→desc→无 循环（data-sort 属性即方向载体，列 key 首次
 * 交互转存 data-sort-key，中性态还原；同表其他表头复位），派
 * icen:sort-change { th, key, dir }。行数据重排归消费方（ datatable 场景用
 * behaviors/datatable 的 icen:table-sort-change）。返回销毁函数：摘除委托并
 * 复位幂等标记，销毁后可重新 initTableSort。SSR 下返回 no-op。
 */
export const initTableSort = createDelegatedInit({ click: onSortClick });

/* ── kit 兼容 re-export ──
 * segmented 的 kit 入口（scripts/slugs.mjs SLUG_BEHAVIOR/SLUG_EXPORTS）指向本模块，
 * OTP 行为仍在 input.ts：这里转发 initInput，使 kit/segmented 一条 import 同时
 * 带出 OTP（initInput）与分段 / 步进（initSegmented / initStepper）。 */
export { initInput } from './input';
