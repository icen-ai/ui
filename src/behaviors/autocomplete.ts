/** Single-line combobox suggestions. A named listbox contains options only;
 * loading, empty and retry states are siblings. Sources receive AbortSignal,
 * replacement queries invalidate immediately (including debounce), and close /
 * blur / value replacement / destroy cancel every old continuation. IME editing
 * stays native; strict and freeSolo commits preserve the existing value API.
 */

import { emitIcen } from './events';
import { t } from './i18n';
import {canQuery,createSuggestionQuery,createSuggestionStatus,watchSuggestionField,afterSuggestionField,type SuggestionSourceContext} from './suggestions';
import { revealPopoverItem, computePopoverLayout, resolvePanelSizing, sizingToLayout, claimMenuFocus, type PopoverLayoutOptions } from './popover';

/** 候选项：裸字符串或 { value, label } 对（value 是提交值，label 是展示名）。 */
export type AutocompleteItem = string | { value: string; label: string };

/** 归一后的候选项（renderItem 收到的也是这个形态）。 */
export interface AutocompleteOption {
  value: string;
  label: string;
}

export interface AutocompleteOptions {
  /** 查询过滤源：按 query 返回候选（同步数组或 Promise） */
  source: (query: string, context: SuggestionSourceContext) => AutocompleteItem[] | Promise<AutocompleteItem[]>;
  /** 触发查询的最少字符数（默认 1） */
  minChars?: number;
  /** source 调用防抖（默认 160ms；0 = 同步立即调） */
  debounceMs?: number;
  /** 面板最多显示条数（默认 8） */
  maxItems?: number;
  /** true = 允许不在清单的任意输入（失焦落定，只派 change）；false（默认）= 失焦无选中回退原值 */
  freeSolo?: boolean;
  /** 自定义选项渲染：Node 直接挂载 / string 走 textContent（此时不做 <mark> 高亮） */
  renderItem?: (item: AutocompleteOption, query: string) => Node | string;
  /** 空结果态文案（默认取 i18n autocomplete.empty，可被 opts 覆盖） */
  noResultsLabel?: string;
  loadingLabel?: string;
  errorLabel?: string;
  retryLabel?: string;
}

export interface AutocompleteHandle {
  /** 最近提交值（选中值 / freeSolo 落定值 / 初始值） */
  getValue(): string;
  /** 设置值（同时更新显示值；不派事件、不开层） */
  setValue(v: string): void;
  /** 程序化开层（按当前输入值拉取并渲染，不受 minChars 限制） */
  open(): void;
  /** 关层（不动显示值） */
  close(): void;
  /** 摘除全部监听/计时器/面板，还原 input role/aria 属性 */
  destroy(): void;
}

let panelSeq = 0;

/** 归一候选项：裸 string → { value, label } 同值；对象必带 string value，label 缺省回退 value。 */
function normalizeItems(raw: unknown): AutocompleteOption[] {
  if (!Array.isArray(raw)) return [];
  const out: AutocompleteOption[] = [];
  for (const it of raw) {
    if (typeof it === 'string') {
      out.push({ value: it, label: it });
    } else if (it && typeof it === 'object' && !Array.isArray(it)) {
      const o = it as Record<string, unknown>;
      if (typeof o.value !== 'string') continue;
      out.push({ value: o.value, label: typeof o.label === 'string' ? o.label : o.value });
    }
  }
  return out;
}

/** 命中片段 <mark> 高亮（大小写不敏感，全部命中包裹；渲染只走 textContent/createElement）。 */
function renderHighlighted(el: HTMLElement, label: string, query: string): void {
  const q = query.trim();
  const hit = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (hit < 0) {
    el.textContent = label;
    return;
  }
  const lower = label.toLowerCase();
  const ql = q.toLowerCase();
  let idx = 0;
  let at = hit;
  while (at >= 0) {
    if (at > idx) el.appendChild(document.createTextNode(label.slice(idx, at)));
    const mark = document.createElement('mark');
    mark.textContent = label.slice(at, at + q.length);
    el.appendChild(mark);
    idx = at + q.length;
    at = lower.indexOf(ql, idx);
  }
  if (idx < label.length) el.appendChild(document.createTextNode(label.slice(idx)));
}

const mounted=new WeakMap<HTMLInputElement,AutocompleteHandle>();
export function createAutocomplete(input:HTMLInputElement,opts:AutocompleteOptions):AutocompleteHandle {
  const dead:AutocompleteHandle={getValue:()=>'',setValue(){},open(){},close(){},destroy(){}};
  if(typeof document === 'undefined' || typeof window === 'undefined' || !opts || typeof opts.source !== 'function')return dead;
  mounted.get(input)?.destroy();
  const integer=(value:number | undefined,fallback:number,min:number)=>Number.isFinite(value) ? Math.max(min,Math.floor(value!)) : fallback;
  const minChars=integer(opts.minChars,1,0),debounceMs=integer(opts.debounceMs,160,0),maxItems=integer(opts.maxItems,8,1);
  let committed=input.value,committedDisplay=input.value,currentQuery='',items:AutocompleteOption[]=[],activeIndex=-1;
  let open=false,composing=false,destroyed=false,busy=false,failed=false,lastComposition:string | null=null,openingDirection:1|-1=1;
  let release:(()=>void) | null=null;
  const attrs=['role','aria-autocomplete','aria-expanded','aria-controls','aria-activedescendant','aria-busy'];
  const original=attrs.map((key)=>input.getAttribute(key));
  const panelId='icen-autocomplete-panel-'+ ++panelSeq;
  const panel=document.createElement('div');panel.className='icen-autocomplete-panel';panel.id=panelId;panel.hidden=true;
  const list=document.createElement('div');list.className='icen-autocomplete-list';list.id=panelId+'-list';list.setAttribute('role','listbox');
  list.setAttribute('aria-label',input.getAttribute('aria-label') || input.labels?.[0]?.textContent?.trim() || t('suggestions.options'));
  const empty=document.createElement('div');empty.className='icen-autocomplete-empty';empty.setAttribute('role','status');empty.hidden=true;empty.textContent=opts.noResultsLabel ?? t('autocomplete.empty');
  const status=createSuggestionStatus(()=>{input.focus({preventScroll:true});schedule(currentQuery,0);},{loading:opts.loadingLabel,error:opts.errorLabel,retry:opts.retryLabel});
  panel.append(list,empty,status.el);document.body.append(panel);
  const events=new AbortController();
  const query=createSuggestionQuery(opts.source,{
    pending(){if(!canQuery(input))return;busy=true;failed=false;items=[];activeIndex=-1;list.replaceChildren();empty.hidden=true;input.setAttribute('aria-busy','true');status.show('loading');syncActive();setOpen(true);position();},
    success(raw){if(!canQuery(input)){close();return;}busy=false;failed=false;input.removeAttribute('aria-busy');status.show(null);render(normalizeItems(raw));setOpen(true);position();},
    error(){if(!canQuery(input)){close();return;}busy=false;failed=true;input.removeAttribute('aria-busy');items=[];activeIndex=-1;list.replaceChildren();empty.hidden=true;status.show('error');syncActive();setOpen(true);position();},
  });
  function position():void {
    if(!canQuery(input)){close();return;}
    panel.dir=getComputedStyle(input).direction;
    const rect=(input.closest<HTMLElement>('.icen-input-wrap') ?? input).getBoundingClientRect();
    const options:PopoverLayoutOptions={side:'bottom',align:panel.dir === 'rtl' ? 'end' : 'stretch',offset:6,contentHeightHint:panel.scrollHeight || items.length*36+48};
    const layout=computePopoverLayout(rect,{width:window.innerWidth,height:window.innerHeight},sizingToLayout(resolvePanelSizing(input),options));
    panel.style.left=layout.left+'px';panel.style.top=layout.top+'px';panel.style.width=layout.width+'px';panel.style.maxHeight=layout.maxHeight+'px';panel.dataset.icenSide=layout.side;
  }
  const onWindow=()=>{if(open)position();};
  const onOutside=(event:Event)=>{if(event.target instanceof Node && !panel.contains(event.target) && event.target !== input)close();};
  function setOpen(next:boolean):void {
    if(destroyed || open === next)return;
    open=next;panel.hidden=!next;input.setAttribute('aria-expanded',String(next));
    if(next){release=claimMenuFocus(close);window.addEventListener('resize',onWindow);window.addEventListener('scroll',onWindow,true);document.addEventListener('pointerdown',onOutside,true);position();syncActive();}
    else {release?.();release=null;window.removeEventListener('resize',onWindow);window.removeEventListener('scroll',onWindow,true);document.removeEventListener('pointerdown',onOutside,true);input.removeAttribute('aria-activedescendant');}
  }
  function close():void {query.cancel();busy=false;failed=false;input.removeAttribute('aria-busy');setOpen(false);}
  function syncActive():void {
    list.querySelectorAll<HTMLElement>('.icen-autocomplete-option').forEach((option,index)=>{option.classList.toggle('is-active',index === activeIndex);option.setAttribute('aria-selected',String(index === activeIndex));});
    const item=list.children[activeIndex];
    if(open && !busy && item instanceof HTMLElement){input.setAttribute('aria-activedescendant',item.id);revealPopoverItem(item,panel);}else input.removeAttribute('aria-activedescendant');
  }
  function render(values:AutocompleteOption[]):void {
    items=values.slice(0,maxItems);list.replaceChildren();
    items.forEach((item,index)=>{
      const row=document.createElement('div');row.className='icen-autocomplete-option';row.id=panelId+'-opt-'+index;row.setAttribute('role','option');
      if(opts.renderItem){const result=opts.renderItem(item,currentQuery);if(typeof result === 'string')row.textContent=result;else row.append(result);}else renderHighlighted(row,item.label,currentQuery);
      row.addEventListener('pointerdown',(event)=>event.preventDefault());row.addEventListener('mousedown',(event)=>event.preventDefault());row.addEventListener('click',()=>select(item));list.append(row);
    });
    empty.hidden=items.length>0;activeIndex=items.length ? openingDirection === -1 ? items.length-1 : 0 : -1;openingDirection=1;syncActive();
  }
  function schedule(value:string,delay=debounceMs):void {
    if(destroyed || !canQuery(input))return;
    currentQuery=value;items=[];activeIndex=-1;list.replaceChildren();empty.hidden=true;input.removeAttribute('aria-activedescendant');query.run(value,delay);
  }
  function select(item:AutocompleteOption):void {
    if(destroyed || !canQuery(input) || busy || !open)return;
    committed=item.value;committedDisplay=item.label;input.value=item.label;close();input.focus({preventScroll:true});
    emitIcen(input,'icen:autocomplete-select',{value:item.value,label:item.label});if(!destroyed)emitIcen(input,'icen:autocomplete-change',{value:item.value});
  }
  function revert():void {input.value=committedDisplay;}
  function changed():void {
    if(composing || destroyed || !canQuery(input))return;
    if(lastComposition !== null){const same=lastComposition === input.value;lastComposition=null;if(same)return;}
    emitIcen(input,'icen:autocomplete-change',{value:input.value});if(input.value.length<minChars){close();return;}schedule(input.value);
  }
  function blur(event:FocusEvent):void {
    if(event.relatedTarget instanceof Node && (panel.contains(event.relatedTarget) || event.relatedTarget === input))return;
    if(opts.freeSolo){committed=input.value;committedDisplay=input.value;emitIcen(input,'icen:autocomplete-change',{value:committed});}else revert();close();
  }
  input.addEventListener('input',changed,{signal:events.signal});
  input.addEventListener('compositionstart',()=>{composing=true;lastComposition=null;close();},{signal:events.signal});
  input.addEventListener('compositionend',()=>{composing=false;changed();lastComposition=input.value;},{signal:events.signal});
  input.addEventListener('keydown',(event)=>{
    if(destroyed || composing || event.isComposing || event.keyCode === 229 || !canQuery(input))return;
    if(event.key === 'Tab' && !event.shiftKey && open && failed){event.preventDefault();panel.querySelector<HTMLButtonElement>('.icen-suggestion-retry')?.focus();return;}
    if(event.key === 'ArrowDown' || event.key === 'ArrowUp'){
      event.preventDefault();const direction=event.key === 'ArrowDown' ? 1 : -1;
      if(!open){openingDirection=direction;schedule(input.value,0);}else if(!busy && items.length){activeIndex=(activeIndex+direction+items.length)%items.length;syncActive();}return;
    }
    if(event.key === 'Enter' && open){if(failed){event.preventDefault();schedule(currentQuery,0);}else if(!busy && items[activeIndex]){event.preventDefault();select(items[activeIndex]);}return;}
    if(event.key === 'Escape' && open){event.preventDefault();event.stopPropagation();revert();close();}
  },{signal:events.signal});
  input.addEventListener('blur',blur,{signal:events.signal});panel.addEventListener('focusout',blur,{signal:events.signal});
  panel.addEventListener('keydown',(event)=>{if(event.key === 'Tab'){event.preventDefault();const target=event.shiftKey ? input : afterSuggestionField(input,panel);target.focus({preventScroll:true});if(!event.shiftKey && target === input)close();return;}if(event.key === 'Escape' && !event.isComposing){event.preventDefault();event.stopPropagation();revert();close();input.focus({preventScroll:true});}},{signal:events.signal});
  input.form?.addEventListener('reset',(event)=>queueMicrotask(()=>{if(!destroyed && !event.defaultPrevented){close();committed=input.value;committedDisplay=input.value;}}),{signal:events.signal});
  const stopWatching=watchSuggestionField(input,()=>{if(!canQuery(input))close();else if(open)position();});
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',list.id);input.removeAttribute('aria-activedescendant');input.removeAttribute('aria-busy');
  const handle:AutocompleteHandle={
    getValue:()=>committed,
    setValue(value){if(destroyed)return;close();committed=value;committedDisplay=value;input.value=value;},
    open(){if(!destroyed && !open)schedule(input.value,0);},
    close(){if(!destroyed)close();},
    destroy(){if(destroyed)return;close();destroyed=true;query.destroy();events.abort();stopWatching();panel.remove();attrs.forEach((key,index)=>original[index] === null ? input.removeAttribute(key) : input.setAttribute(key,original[index]!));if(mounted.get(input) === handle)mounted.delete(input);},
  };
  mounted.set(input,handle);return handle;
}
