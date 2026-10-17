/** Mention suggestions for native multiline textareas. Trigger/caret queries
 * share cancellable source ownership with autocomplete. The popup contains a
 * named listbox plus sibling loading/empty/retry states; the textarea retains its
 * native textbox role (aria-expanded is not valid on a multiline textbox).
 * Supports safe renderItem, disabled entries, original ARIA restoration, native
 * input after insertion, exact-label tracking, and an idempotent close/destroy.
 */

import { emitIcen } from './events';
import { t } from './i18n';
import {canQuery,createSuggestionQuery,createSuggestionStatus,watchSuggestionField,afterSuggestionField,type SuggestionSourceContext} from './suggestions';
import { revealPopoverItem, computePopoverLayout, resolvePanelSizing, sizingToLayout, claimMenuFocus, type PopoverLayoutOptions } from './popover';

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
  /** 查询过滤源：按 query 返回候选（同步数组或 Promise；空结果显示 noResultsLabel） */
  source: (query: string, context: SuggestionSourceContext) => MentionItem[] | Promise<MentionItem[]>;
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
  errorLabel?: string;
  retryLabel?: string;
  noResultsLabel?: string;
  renderItem?: (item: MentionItem, query: string) => Node | string;
  /** 选中回调（在 icen:mention-select 派发后调用） */
  onSelect?: (item: MentionItem) => void;
}

export interface MentionsHandle {
  /** 当前 track 中的提及（已按文本实时摘除失效项） */
  getMentions(): MentionItem[];
  /** Cancel the current suggestions without modifying the text. */
  close(): void;
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

const mounted=new WeakMap<HTMLTextAreaElement,MentionsHandle>();
export function createMentions(el: HTMLElement, opts: MentionsOptions): MentionsHandle {
  /* SSR 守卫：window/document 未定义时静默返回 noop handle */
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { getMentions: () => [], close:()=>{}, destroy: () => undefined };
  }
  if (!opts || typeof opts.source !== 'function') {
    return { getMentions: () => [], close:()=>{}, destroy: () => undefined };
  }

  const found = el instanceof HTMLTextAreaElement
    ? el
    : (el.querySelector<HTMLTextAreaElement>('textarea.icen-input')
        ?? el.querySelector<HTMLTextAreaElement>('textarea'));
  if (!found) {
    console.warn('[@icen.ai/ui] mentions: el 内未找到 textarea，已跳过创建');
    return { getMentions: () => [], close:()=>{}, destroy: () => undefined };
  }
  /* 非空别名：提升式函数声明在作用域入口取声明类型（含 null），别名把非空面钉死 */
  const ta: HTMLTextAreaElement = found;
  mounted.get(ta)?.destroy();
  const attrs=['aria-haspopup','aria-expanded','aria-controls','aria-activedescendant','aria-autocomplete','aria-busy'];
  const original=attrs.map((key)=>ta.getAttribute(key));

  const trigger = opts.trigger ?? '@';
  const count=(value:number | undefined,fallback:number,min:number)=>Number.isFinite(value) ? Math.max(min,Math.floor(value!)) : fallback;
  const max=count(opts.max,8,1),minChars=count(opts.minChars,0,0),debounceMs=count(opts.debounceMs,160,0);
  const loadingLabel = opts.loadingLabel ?? t('mentions.loading');

  /* ── 状态 ── */
  let mentions: MentionItem[] = [];
  let items: MentionItem[] = [];
  let activeIndex = -1;
  let current: TriggerMatch | null = null;
  let currentQuery = '';
  let open = false;
  let composing = false;
  /** Query ownership and presentation state. */
  let busy=false,failed=false;
  let lastComposition:string | null=null,release:(()=>void) | null=null;

  let destroyed = false;

  /* ── 面板（portal 到 body）── */
  const panelId = `icen-mentions-panel-${++panelSeq}`;
  const panel = document.createElement('div');
  panel.className = 'icen-mentions-panel';
  panel.id = panelId;
  panel.hidden = true;
  const list=document.createElement('div');list.className='icen-mentions-list';list.id=panelId+'-list';list.setAttribute('role','listbox');
  list.setAttribute('aria-label',ta.getAttribute('aria-label') || ta.labels?.[0]?.textContent?.trim() || t('suggestions.options'));
  panel.append(list);
  document.body.appendChild(panel);

  const notice=createSuggestionStatus(()=>{ta.focus({preventScroll:true});onValueChanged(0);},{loading:loadingLabel,error:opts.errorLabel,retry:opts.retryLabel});
  const status=notice.el;status.classList.add('icen-mentions-status');panel.append(status);
  const empty=document.createElement('div');empty.className='icen-mentions-empty';empty.setAttribute('role','status');empty.hidden=true;empty.textContent=opts.noResultsLabel ?? t('suggestions.empty');panel.append(empty);
  const query=createSuggestionQuery(opts.source,{
    pending(){if(!canQuery(ta))return;busy=true;failed=false;items=[];activeIndex=-1;list.replaceChildren();empty.hidden=true;ta.setAttribute('aria-busy','true');notice.show('loading');syncActive();setOpen(true);position();},
    success(raw){if(!canQuery(ta)){close();return;}busy=false;failed=false;ta.removeAttribute('aria-busy');notice.show(null);renderItems(normalizeItems(raw));empty.hidden=items.length>0;setOpen(true);position();},
    error(){if(!canQuery(ta)){close();return;}busy=false;failed=true;items=[];activeIndex=-1;list.replaceChildren();empty.hidden=true;ta.removeAttribute('aria-busy');notice.show('error');syncActive();setOpen(true);position();},
  });

  /* ── 镜像 div（caret 量坐标用，见文件头技法说明）── */
  const mirror = document.createElement('div');
  const MIRROR_PROPS = [
    'box-sizing', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'line-height', 'text-indent', 'letter-spacing', 'word-spacing','direction','text-align','tab-size','word-break','text-transform',
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
    mirror.style.whiteSpace=ta.wrap === 'off' ? 'pre' : 'pre-wrap';
    mirror.style.width = `${ta.offsetWidth || ta.clientWidth}px`;
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
    if(!canQuery(ta)){close();return;}panel.dir=getComputedStyle(ta).direction;
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
      contentHeightHint: panel.scrollHeight || items.length * 36 + 48,
    };
    const layout = computePopoverLayout(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      sizingToLayout(resolvePanelSizing(el), layoutOpts),
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
    close();
  }

  /* ── 开/关 ── */
  function setOpen(next: boolean): void {
    if (destroyed || open === next) return;
    open = next;
    panel.hidden = !next;
    ta.removeAttribute('aria-expanded'); // Multiline textbox does not support aria-expanded.
    if (next) {
      release=claimMenuFocus(close);
      window.addEventListener('resize', onWindowChange);
      window.addEventListener('scroll', onWindowChange, true);
      document.addEventListener('pointerdown', onDocPointerDown, true);
      position();
      syncActive(); /* 打开后重指 active（渲染时面板尚闭，activedescendant 需补挂） */
    } else {
      release?.();release=null;
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      ta.removeAttribute('aria-activedescendant');
    }
  }

  function close():void {query.cancel();busy=false;failed=false;ta.removeAttribute('aria-busy');setOpen(false);}

  function firstEnabledIndex(): number {
    return items.findIndex((it) => !it.disabled);
  }

  /** active 项视觉 + aria-activedescendant 同步（is-active 永不单独出现，复合在 option 上）。 */
  function syncActive(): void {
    Array.from(panel.querySelectorAll<HTMLElement>('.icen-mentions-option')).forEach((optEl, i) => {
      const active = i === activeIndex;
      optEl.classList.toggle('is-active', active);
      if (active) optEl.setAttribute('aria-selected', 'true');
      else optEl.setAttribute('aria-selected','false');
    });
    const activeItem = items[activeIndex];
    if (open && !busy && activeItem && !activeItem.disabled) {
      ta.setAttribute('aria-activedescendant', `${panelId}-opt-${activeIndex}`);
      const active=panel.querySelector<HTMLElement>('.icen-mentions-option.is-active');
      if (active) revealPopoverItem(active,panel);
    } else {
      ta.removeAttribute('aria-activedescendant');
    }
  }

  function renderItems(values: MentionItem[]): void {
    panel.querySelectorAll('.icen-mentions-option').forEach((n) => n.remove());
    items = values.slice(0, max);
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
      const text=document.createElement('bdi');text.textContent=item.label;label.append(text);
      if(opts.renderItem){const rendered=opts.renderItem(item,currentQuery);if(typeof rendered === 'string')label.textContent=rendered;else label.replaceChildren(rendered);}
      opt.appendChild(label);
      /* mousedown preventDefault：保住 textarea 焦点（click 仍触发选中） */
      opt.addEventListener('pointerdown',(e)=>e.preventDefault());
      opt.addEventListener('mousedown', (e) => e.preventDefault());
      opt.addEventListener('click', () => {
        if (!item.disabled) select(item);
      });
      list.appendChild(opt);
    });
    activeIndex = firstEnabledIndex();
    syncActive();
  }

  function moveActive(dir: 1 | -1): void {
    if (items.length === 0 || firstEnabledIndex()<0) return;
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
    mentions = mentions.filter((m) => new RegExp('(^|\\s)'+escapeRegExp(trigger+m.label)+'(?=$|[^\\p{L}\\p{N}_])','u').test(ta.value));
  }

  /** 选中：替换 `@query` → `@label `（尾随空格），track 进数组并派事件。 */
  function select(item: MentionItem): void {
    if (!current || busy || destroyed || !canQuery(ta) || !open || ta.selectionStart !== ta.selectionEnd) return;
    const match=findTrigger(ta.value.slice(0,ta.selectionStart ?? ta.value.length),trigger);if(!match || match.start !== current.start || match.query !== currentQuery){onValueChanged();return;}
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
    close();
    ta.focus({preventScroll:true});
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    if(destroyed)return;
    emitIcen(ta, 'icen:mention-select', { id: item.id, label: item.label, query });
    if(!destroyed)opts.onSelect?.(item);
  }

  function schedule(value:string,delay=debounceMs):void {
    if(destroyed || !canQuery(ta))return;
    currentQuery=value;items=[];activeIndex=-1;list.replaceChildren();empty.hidden=true;ta.removeAttribute('aria-activedescendant');query.run(value,delay);
  }
  function onValueChanged(delay=debounceMs):void {
    if(destroyed || composing || !canQuery(ta)){close();return;}
    prune();const caret=ta.selectionStart ?? ta.value.length;
    const match=ta.selectionStart === ta.selectionEnd ? findTrigger(ta.value.slice(0,caret),trigger) : null;
    current=match;
    if(!match || match.query.length<minChars){close();notice.show(null);return;}
    schedule(match.query,delay);
  }

  /* ── 事件接线 ── */
  const onInput = (): void => {
    if (composing) return;
    if(lastComposition !== null){const same=lastComposition === ta.value;lastComposition=null;if(same)return;}
    onValueChanged();
  };
  const onCompositionStart = (): void => {
    composing = true;lastComposition=null;close();
  };
  const onCompositionEnd = (): void => {
    composing = false;
    onValueChanged();lastComposition=ta.value;
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if(destroyed || composing || e.isComposing || e.keyCode === 229 || !canQuery(ta))return;
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();e.stopPropagation();
        close(); /* Esc 关层不动文本 */
      }
      return;
    }
    if (!open) return;
    if(e.key === 'Tab' && !e.shiftKey && failed){e.preventDefault();panel.querySelector<HTMLButtonElement>('.icen-suggestion-retry')?.focus();return;}
    if(e.key === 'Enter' && failed){e.preventDefault();onValueChanged(0);return;}
    if(busy)return;
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
  const onBlur = (event:FocusEvent): void => {
    if(event.relatedTarget instanceof Node && (panel.contains(event.relatedTarget) || event.relatedTarget === ta))return;
    /* 失焦关层（点击选项走 mousedown preventDefault，不会先触发 blur） */
    close();
  };

  const events=new AbortController();
  const caretChanged=()=>{if(composing || destroyed)return;const match=ta.selectionStart === ta.selectionEnd ? findTrigger(ta.value.slice(0,ta.selectionStart ?? ta.value.length),trigger) : null;if(match?.start !== current?.start || match?.query !== current?.query)onValueChanged();else if(open)position();};
  ta.addEventListener('keyup',(event)=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))caretChanged();},{signal:events.signal});
  ta.addEventListener('click',caretChanged,{signal:events.signal});
  panel.addEventListener('focusout',onBlur,{signal:events.signal});
  panel.addEventListener('keydown',(event)=>{if(event.key === 'Tab'){event.preventDefault();const target=event.shiftKey ? ta : afterSuggestionField(ta,panel);target.focus({preventScroll:true});if(!event.shiftKey && target === ta)close();return;}if(event.key === 'Escape' && !event.isComposing){event.preventDefault();event.stopPropagation();close();ta.focus({preventScroll:true});}},{signal:events.signal});
  ta.form?.addEventListener('reset',(event)=>queueMicrotask(()=>{if(!destroyed && !event.defaultPrevented){close();prune();}}),{signal:events.signal});
  const stopWatching=watchSuggestionField(ta,()=>{if(!canQuery(ta))close();else if(open)position();});
  ta.addEventListener('input', onInput);
  ta.addEventListener('compositionstart', onCompositionStart);
  ta.addEventListener('compositionend', onCompositionEnd);
  ta.addEventListener('keydown', onKeyDown);
  ta.addEventListener('blur', onBlur);

  /* a11y 接线（destroy 时还原） */
  ta.setAttribute('aria-haspopup', 'listbox');
  ta.removeAttribute('aria-expanded');
  ta.setAttribute('aria-controls', list.id);ta.setAttribute('aria-autocomplete','list');ta.removeAttribute('aria-activedescendant');ta.removeAttribute('aria-busy');

  const handle:MentionsHandle={
    close(){if(!destroyed)close();},
    getMentions(): MentionItem[] {
      prune();
      return mentions.map((item)=>({...item}));
    },
    destroy(): void {
      if (destroyed) return;
      close();destroyed = true;query.destroy();events.abort();stopWatching();
      panel.remove();
      mirror.remove();
      ta.removeEventListener('input', onInput);
      ta.removeEventListener('compositionstart', onCompositionStart);
      ta.removeEventListener('compositionend', onCompositionEnd);
      ta.removeEventListener('keydown', onKeyDown);
      ta.removeEventListener('blur', onBlur);
      attrs.forEach((key,index)=>original[index] === null ? ta.removeAttribute(key) : ta.setAttribute(key,original[index]!));if(mounted.get(ta) === handle)mounted.delete(ta);
      mentions = [];
    },
  };
  mounted.set(ta,handle);return handle;
}
