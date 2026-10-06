/*
 * @icen.ai/ui — Behavior: mentions（@ 提及输入，与 components/mentions.css 配套）
 *
 * createMentions(el, opts) → MentionsHandle：
 *   el 传包装容器（内含宿主渲染的 <icen-textarea class="icen-input">）或 icen-textarea 直元素。
 *
 * 交互：
 *   - textarea 输入中检测光标前的 trigger token：触发边界 = 行首/空白后（`(^|\s)@query`，
 *     query 为不含空白与 trigger 字符的连续串）；命中即弹层（portal 到 body），
 *     查询字符数 ≥ minChars 才调 source（默认 0 = 输入 @ 即出）。
 *   - source(query) 负责过滤（同步数组或 Promise 皆可；keywords 字段是给 source 做
 *     辅助匹配用的元数据，组件不消费）；结果截断到 max 条；空结果直接关层。
 *   - 异步竞态守卫：只渲染最新一次 query 的结果（seq 单调递增，晚到丢弃）。
 *   - 键盘：↑↓ 循环移动 active（跳过 disabled），Enter 选中（IME 组合态不拦截），
 *     Esc 关层不动文本；点击选项选中（mousedown preventDefault 保焦点在 textarea）。
 *   - 选中：把 `@query` 替换为 `@label `（label + 尾随空格），光标落在插入文本之后，
 *     同时 track 进 mentions 数组（id/label 双全）。
 *   - 诚实一致性：任何输入变化后，文本里已不存在 `@label` 的 mention 自动从数组摘除
 *     （getMentions() 只返回仍然活在文本里的提及）。
 *   - 失焦 / 外点（textarea 与面板之外）关层；窗口 resize/scroll 重定位。
 *
 * caret 定位技法（镜像 div 量坐标，经典 textarea-caret-position 方案）：
 *   textarea 不暴露像素级 caret 坐标，故建一个 off-screen 镜像 div：逐条拷贝计算样式
 *   （box-sizing / padding / border / font / line-height / text-indent / letter-spacing…），
 *   写入 caret 之前的全文 + 一个零宽标记 span，读标记的 offsetTop/offsetLeft/offsetHeight
 *   即得 caret 相对 textarea 内边距盒的坐标（加回 border 宽），再叠 textarea 的视口 rect
 *   并减掉 scrollTop/scrollLeft，得到视口锚点交给 popover 布局引擎。渲染只走 textContent。
 *
 * a11y：textarea 挂 aria-haspopup="listbox" / aria-expanded / aria-controls；
 *   面板 role="listbox"，选项 role="option" + id，active 项经 aria-activedescendant 指认；
 *   异步加载态渲染 .icen-mentions-status（role="status"），文案 = opts.loadingLabel。
 *
 * 面板尺寸契约（PanelSizing）：包装容器可挂 data-icen-panel-width / -min / -max /
 *   -max-height，经 resolvePanelSizing 读入布局。
 *
 * 事件（bubbles + composed + cancelable，detail 契约见 events.ts IcenEventMap）：
 *   选中 → icen:mention-select { id, label, query }（textarea 上派发，随后调 opts.onSelect）
 *
 * SSR 安全（window 未定义静默返回 noop handle）；渲染只写 textContent（禁 innerHTML）；
 * destroy() 摘除监听/面板/镜像并还原 textarea 的 aria 属性。
 */

import { emitIcen } from './events';
import { t } from './i18n';
import { computePopoverLayout, resolvePanelSizing, sizingToLayout, type PopoverLayoutOptions } from './popover';

/** 一条提及候选项（id/label 双全：id 是业务键，label 是插入文本的展示名）。 */
export interface MentionItem {
  /** 业务唯一键（随 icen:mention-select 事件回给宿主） */
  id: string;
  /** 展示名：选中后插入文本的为 `@label ` */
  label: string;
  /** 辅助匹配关键字（给 source 过滤用，组件不消费） */
  keywords?: string;
  /** true = 置灰不可选（键盘导航跳过，点击不生效） */
  disabled?: boolean;
}

export interface MentionsOptions {
  /** 查询过滤源：按 query 返回候选（同步数组或 Promise；空结果 = 关层） */
  source: (query: string) => MentionItem[] | Promise<MentionItem[]>;
  /** 触发字符（默认 '@'） */
  trigger?: string;
  /** 面板最多显示条数（默认 8） */
  max?: number;
  /** 触发所需最少查询字符数（默认 0 = 输入 @ 即出） */
  minChars?: number;
  /** source 调用防抖（默认 160ms；0 = 同步立即调） */
  debounceMs?: number;
  /** 异步加载态占位文案（默认取 i18n mentions.loading，可被 opts 覆盖） */
  loadingLabel?: string;
  /** 选中回调（在 icen:mention-select 派发后调用） */
  onSelect?: (item: MentionItem) => void;
}

export interface MentionsHandle {
  /** 当前 track 中的提及（已按文本实时摘除失效项） */
  getMentions(): MentionItem[];
  /** 摘除全部监听/计时器/面板/镜像，还原 textarea aria 属性 */
  destroy(): void;
}

let panelSeq = 0;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 归一 source 结果：只收 { id: string, label: string } 形态的对象，其余诚实丢弃。 */
function normalizeItems(raw: unknown): MentionItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MentionItem[] = [];
  for (const it of raw) {
    if (it && typeof it === 'object' && !Array.isArray(it)) {
      const o = it as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.label !== 'string') continue;
      out.push({
        id: o.id,
        label: o.label,
        keywords: typeof o.keywords === 'string' ? o.keywords : undefined,
        disabled: o.disabled === true,
      });
    }
  }
  return out;
}

interface TriggerMatch {
  /** trigger 字符在 value 中的下标（替换区间的起点） */
  start: number;
  /** token 中的查询串（trigger 之后、caret 之前） */
  query: string;
}

/** 检测光标前的 trigger token：边界 = 行首或空白后，query 不含空白与 trigger 字符。 */
function findTrigger(text: string, trigger: string): TriggerMatch | null {
  if (!trigger) return null;
  const re = new RegExp(`(^|\\s)${escapeRegExp(trigger)}([^\\s${escapeRegExp(trigger)}]*)$`);
  const m = text.match(re);
  if (!m) return null;
  const start = (m.index ?? 0) + m[1].length;
  return { start, query: m[2] ?? '' };
}

export function createMentions(el: HTMLElement, opts: MentionsOptions): MentionsHandle {
  /* SSR 守卫：window/document 未定义时静默返回 noop handle */
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { getMentions: () => [], destroy: () => undefined };
  }
  if (!opts || typeof opts.source !== 'function') {
    return { getMentions: () => [], destroy: () => undefined };
  }

  const found = el instanceof HTMLTextAreaElement
    ? el
    : (el.querySelector<HTMLTextAreaElement>('textarea.input')
        ?? el.querySelector<HTMLTextAreaElement>('textarea'));
  if (!found) {
    console.warn('[@icen.ai/ui] mentions: el 内未找到 textarea，已跳过创建');
    return { getMentions: () => [], destroy: () => undefined };
  }
  /* 非空别名：提升式函数声明在作用域入口取声明类型（含 null），别名把非空面钉死 */
  const ta: HTMLTextAreaElement = found;

  const trigger = opts.trigger ?? '@';
  const max = Math.max(1, opts.max ?? 8);
  const minChars = Math.max(0, opts.minChars ?? 0);
  const debounceMs = Math.max(0, opts.debounceMs ?? 160);
  const loadingLabel = opts.loadingLabel ?? t('mentions.loading');

  /* ── 状态 ── */
  let mentions: MentionItem[] = [];
  let items: MentionItem[] = [];
  let activeIndex = -1;
  let current: TriggerMatch | null = null;
  let currentQuery = '';
  let open = false;
  let composing = false;
  /** 异步竞态守卫：seq 单调递增，渲染时比对，晚到的结果丢弃 */
  let seq = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  /* ── 面板（portal 到 body）── */
  const panelId = `icen-mentions-panel-${++panelSeq}`;
  const panel = document.createElement('div');
  panel.className = 'icen-mentions-panel';
  panel.id = panelId;
  panel.hidden = true;
  panel.setAttribute('role', 'listbox');
  document.body.appendChild(panel);

  const status = document.createElement('div');
  status.className = 'icen-mentions-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  status.textContent = loadingLabel;
  panel.appendChild(status);

  /* ── 镜像 div（caret 量坐标用，见文件头技法说明）── */
  const mirror = document.createElement('div');
  const MIRROR_PROPS = [
    'box-sizing', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'line-height', 'text-indent', 'letter-spacing', 'word-spacing',
  ];
  mirror.style.position = 'absolute';
  mirror.style.top = '-9999px';
  mirror.style.left = '0';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  document.body.appendChild(mirror);

  /** caret 相对 textarea 内边距盒的坐标（含 border 宽补偿）；测试环境测量全 0 也不炸。 */
  function measureCaret(): { top: number; left: number; height: number } {
    const cs = getComputedStyle(ta);
    for (const p of MIRROR_PROPS) mirror.style.setProperty(p, cs.getPropertyValue(p));
    mirror.style.width = `${ta.clientWidth}px`;
    mirror.textContent = '';
    const caret = ta.selectionStart ?? ta.value.length;
    mirror.appendChild(document.createTextNode(ta.value.slice(0, caret)));
    const marker = document.createElement('span');
    marker.textContent = '​'; /* 零宽标记：撑起行盒（含尾随换行情形），offsetHeight 即行高 */
    mirror.appendChild(marker);
    const num = (v: string): number => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      top: marker.offsetTop + num(cs.getPropertyValue('border-top-width')),
      left: marker.offsetLeft + num(cs.getPropertyValue('border-left-width')),
      height: marker.offsetHeight || num(cs.getPropertyValue('line-height')) || 20,
    };
  }

  /* ── 面板定位：caret 视口锚点 → popover 视口智能布局 ── */
  function position(): void {
    const caret = measureCaret();
    const rect = ta.getBoundingClientRect();
    const left = rect.left + caret.left - ta.scrollLeft;
    const top = rect.top + caret.top - ta.scrollTop;
    const anchor = {
      left,
      top,
      right: left + 2,
      bottom: top + caret.height,
      width: 2,
      height: caret.height,
    };
    const layoutOpts: PopoverLayoutOptions = {
      side: 'bottom',
      align: 'start',
      contentHeightHint: items.length * 36 + 16,
    };
    const layout = computePopoverLayout(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      sizingToLayout(resolvePanelSizing(el instanceof HTMLTextAreaElement ? null : el), layoutOpts),
    );
    panel.style.left = `${layout.left}px`;
    panel.style.top = `${layout.top}px`;
    panel.style.width = `${layout.width}px`;
    panel.style.maxHeight = `${layout.maxHeight}px`;
    panel.dataset.icenSide = layout.side;
  }

  function onWindowChange(): void {
    if (open) position();
  }
  function onDocPointerDown(e: Event): void {
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (panel.contains(target) || ta.contains(target)) return;
    setOpen(false);
  }

  /* ── 开/关 ── */
  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    panel.hidden = !next;
    ta.setAttribute('aria-expanded', String(next));
    if (next) {
      window.addEventListener('resize', onWindowChange);
      window.addEventListener('scroll', onWindowChange, true);
      document.addEventListener('pointerdown', onDocPointerDown, true);
      position();
      syncActive(); /* 打开后重指 active（渲染时面板尚闭，activedescendant 需补挂） */
    } else {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      ta.removeAttribute('aria-activedescendant');
    }
  }

  function firstEnabledIndex(): number {
    return items.findIndex((it) => !it.disabled);
  }

  /** active 项视觉 + aria-activedescendant 同步（is-active 永不单独出现，复合在 option 上）。 */
  function syncActive(): void {
    Array.from(panel.querySelectorAll<HTMLElement>('.icen-mentions-option')).forEach((optEl, i) => {
      const active = i === activeIndex;
      optEl.classList.toggle('is-active', active);
      if (active) optEl.setAttribute('aria-selected', 'true');
      else optEl.removeAttribute('aria-selected');
    });
    const activeItem = items[activeIndex];
    if (open && activeItem && !activeItem.disabled) {
      ta.setAttribute('aria-activedescendant', `${panelId}-opt-${activeIndex}`);
    } else {
      ta.removeAttribute('aria-activedescendant');
    }
  }

  function renderItems(list: MentionItem[]): void {
    panel.querySelectorAll('.icen-mentions-option').forEach((n) => n.remove());
    items = list.slice(0, max);
    items.forEach((item, i) => {
      const opt = document.createElement('div');
      opt.className = 'icen-mentions-option';
      opt.id = `${panelId}-opt-${i}`;
      opt.setAttribute('role', 'option');
      if (item.disabled) {
        opt.classList.add('is-disabled');
        opt.setAttribute('aria-disabled', 'true');
      }
      const label = document.createElement('span');
      label.className = 'icen-mentions-option-label';
      label.textContent = item.label;
      opt.appendChild(label);
      /* mousedown preventDefault：保住 textarea 焦点（click 仍触发选中） */
      opt.addEventListener('mousedown', (e) => e.preventDefault());
      opt.addEventListener('click', () => {
        if (!item.disabled) select(item);
      });
      panel.appendChild(opt);
    });
    activeIndex = firstEnabledIndex();
    syncActive();
  }

  function moveActive(dir: 1 | -1): void {
    if (items.length === 0) return;
    let idx = activeIndex < 0 ? (dir === 1 ? -1 : 0) : activeIndex;
    for (let n = 0; n < items.length; n++) {
      idx = (idx + dir + items.length) % items.length;
      if (!items[idx]!.disabled) break;
    }
    activeIndex = idx;
    syncActive();
  }

  /** 诚实一致性：文本里已不存在 `@label` 的 mention 从数组摘除。 */
  function prune(): void {
    mentions = mentions.filter((m) => ta.value.includes(`${trigger}${m.label}`));
  }

  /** 选中：替换 `@query` → `@label `（尾随空格），track 进数组并派事件。 */
  function select(item: MentionItem): void {
    if (!current) return;
    const value = ta.value;
    const caret = ta.selectionStart ?? value.length;
    const insert = `${trigger}${item.label} `;
    ta.value = value.slice(0, current.start) + insert + value.slice(caret);
    const pos = current.start + insert.length;
    ta.setSelectionRange(pos, pos);
    mentions.push({
      id: item.id,
      label: item.label,
      keywords: item.keywords,
      disabled: item.disabled,
    });
    prune();
    const query = currentQuery;
    current = null;
    setOpen(false);
    ta.focus();
    emitIcen(ta, 'icen:mention-select', { id: item.id, label: item.label, query });
    opts.onSelect?.(item);
  }

  /* ── 查询调度：防抖 + 竞态守卫 + 异步加载态 ── */
  function runSource(query: string): void {
    const mySeq = ++seq;
    let result: ReturnType<MentionsOptions['source']>;
    try {
      result = opts.source(query);
    } catch {
      setOpen(false);
      return;
    }
    const thenable =
      result !== null && (typeof result === 'object' || typeof result === 'function')
        ? (result as { then?: unknown }).then
        : undefined;
    if (typeof thenable === 'function') {
      if (!open) setOpen(true); /* 加载态占位先可见（面板只含 status 与旧列表） */
      status.hidden = false;
      Promise.resolve(result as PromiseLike<unknown>).then(
        (raw) => {
          if (destroyed || mySeq !== seq) return; /* 晚到丢弃：只渲染最新 query */
          status.hidden = true;
          const list = normalizeItems(raw);
          if (list.length === 0) {
            setOpen(false);
            return;
          }
          renderItems(list);
          if (!open) setOpen(true);
          else position();
        },
        () => {
          if (destroyed || mySeq !== seq) return;
          status.hidden = true;
          setOpen(false); /* 源失败：诚实关层，不编造候选 */
        },
      );
    } else {
      status.hidden = true;
      const list = normalizeItems(result);
      if (list.length === 0) {
        setOpen(false);
        return;
      }
      renderItems(list);
      if (!open) setOpen(true);
      else position();
    }
  }

  function schedule(query: string): void {
    currentQuery = query;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (debounceMs > 0) {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runSource(query);
      }, debounceMs);
    } else {
      runSource(query);
    }
  }

  function onValueChanged(): void {
    prune();
    const caret = ta.selectionStart ?? ta.value.length;
    const match = findTrigger(ta.value.slice(0, caret), trigger);
    current = match;
    if (!match || match.query.length < minChars) {
      seq++; /* 作废在途查询 */
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      status.hidden = true;
      setOpen(false);
      return;
    }
    schedule(match.query);
  }

  /* ── 事件接线 ── */
  const onInput = (): void => {
    if (composing) return; /* IME 组合态挂起检测（compositionend 后补一次） */
    onValueChanged();
  };
  const onCompositionStart = (): void => {
    composing = true;
  };
  const onCompositionEnd = (): void => {
    composing = false;
    onValueChanged();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false); /* Esc 关层不动文本 */
      }
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter') {
      /* IME 组合态期间 Enter 是确认候选词，绝不拦截 */
      if (composing || e.isComposing) return;
      const item = items[activeIndex];
      if (item && !item.disabled) {
        e.preventDefault();
        select(item);
      }
    }
  };
  const onBlur = (): void => {
    /* 失焦关层（点击选项走 mousedown preventDefault，不会先触发 blur） */
    setOpen(false);
  };

  ta.addEventListener('input', onInput);
  ta.addEventListener('compositionstart', onCompositionStart);
  ta.addEventListener('compositionend', onCompositionEnd);
  ta.addEventListener('keydown', onKeyDown);
  ta.addEventListener('blur', onBlur);

  /* a11y 接线（destroy 时还原） */
  ta.setAttribute('aria-haspopup', 'listbox');
  ta.setAttribute('aria-expanded', 'false');
  ta.setAttribute('aria-controls', panelId);

  return {
    getMentions(): MentionItem[] {
      return mentions.slice();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      seq++;
      if (debounceTimer) clearTimeout(debounceTimer);
      setOpen(false);
      panel.remove();
      mirror.remove();
      ta.removeEventListener('input', onInput);
      ta.removeEventListener('compositionstart', onCompositionStart);
      ta.removeEventListener('compositionend', onCompositionEnd);
      ta.removeEventListener('keydown', onKeyDown);
      ta.removeEventListener('blur', onBlur);
      ta.removeAttribute('aria-haspopup');
      ta.removeAttribute('aria-expanded');
      ta.removeAttribute('aria-controls');
      ta.removeAttribute('aria-activedescendant');
      mentions = [];
    },
  };
}
