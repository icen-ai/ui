/** ICEN date picker: native form value, one shared calendar, continuous focus.
 * Mark a .icen-date-picker[data-icen-date-picker] containing a hidden input.
 * Trigger/value/icon are created when absent. Optional format/min/max/week-start/
 * placeholder and shared data-icen-panel-* sizing are read live. init returns an
 * idempotent disposer; open calendars release their portal, listeners and focus.
 */
import {createIcon} from './icons';
import {applyPanelSizing,computePopoverLayout,readPanelSizing,claimMenuFocus,revealPopoverItem} from './popover';
import {focusableWithin} from './focus';
import {emitIcen} from './events';
import {t} from './i18n';

let sequence=0;
let active:{root:HTMLElement;close(restore?:boolean):void} | null=null;
const instances=new WeakMap<HTMLElement,()=>void>();
function date(year:number,month:number,day:number):Date {
  const value=new Date(0);value.setHours(0,0,0,0);value.setFullYear(year,month,day);return value;
}
function iso(value:Date):string {return String(value.getFullYear()).padStart(4,'0')+'-'+String(value.getMonth()+1).padStart(2,'0')+'-'+String(value.getDate()).padStart(2,'0');}
function parse(value:string):Date | null {
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());if(!m || +m[1]<1)return null;
  const result=date(+m[1],+m[2]-1,+m[3]);return iso(result) === value.trim() ? result : null;
}
function display(value:Date,fmt:string):string {
  const parts:Record<string,string>={yyyy:String(value.getFullYear()).padStart(4,'0'),yy:String(value.getFullYear()).slice(-2),mm:String(value.getMonth()+1).padStart(2,'0'),m:String(value.getMonth()+1),dd:String(value.getDate()).padStart(2,'0'),d:String(value.getDate())};
  return fmt.replace(/yyyy|yy|mm|m|dd|d/g,(key)=>parts[key]);
}
function monthShift(value:Date,delta:number):Date {
  const first=date(value.getFullYear(),value.getMonth()+delta,1);
  return date(first.getFullYear(),first.getMonth(),Math.min(value.getDate(),date(first.getFullYear(),first.getMonth()+1,0).getDate()));
}
function setup(root:HTMLElement):()=>void {
  const previous=instances.get(root);if(previous)return previous;
  const input=root.querySelector<HTMLInputElement>('input[type="hidden"]');
  const initialValue=input?.value ?? '';
  const generated=!root.querySelector('.icen-date-picker-trigger');
  const trigger=root.querySelector<HTMLButtonElement>('.icen-date-picker-trigger') ?? document.createElement('button');
  if(!trigger.hasAttribute('type'))trigger.type='button';
  trigger.classList.add('icen-date-picker-trigger');
  let value=trigger.querySelector<HTMLElement>('.icen-date-picker-value');
  if(!value){value=document.createElement('span');value.className='icen-date-picker-value';trigger.prepend(value);}
  let symbol=trigger.querySelector<Element>('.icen-date-picker-icon');
  if(!(symbol instanceof HTMLElement)){const next=document.createElement('span');next.className='icen-date-picker-icon';if(symbol)symbol.replaceWith(next);else trigger.append(next);symbol=next;}
  symbol.replaceChildren(createIcon('calendar')!);symbol.setAttribute('aria-hidden','true');
  if(generated)root.prepend(trigger);
  const attrs=['aria-haspopup','aria-expanded','aria-controls','aria-disabled','aria-invalid','aria-describedby'];
  const saved=attrs.map((key)=>trigger.getAttribute(key));
  if(!value.id)value.id='icen-date-value-'+ ++sequence;
  trigger.setAttribute('aria-describedby',((trigger.getAttribute('aria-describedby') ?? '')+' '+value.id).trim());
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
  const ac=new AbortController();let disposed=false,panel:HTMLElement | null=null,opened:AbortController | null=null,release:(()=>void) | null=null;
  let selected:Date | null=null,min:Date | null=null,max:Date | null=null;
  let cursor=date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
  let view=date(cursor.getFullYear(),cursor.getMonth(),1);
  const inheritedDisabled=()=>{
    for(let parent=trigger.parentElement;parent;parent=parent.parentElement){
      if(parent.matches('fieldset[disabled]') && !parent.querySelector(':scope > legend')?.contains(trigger))return true;
    }
    return false;
  };
  const unavailable=()=>trigger.matches(':disabled') || inheritedDisabled() || Boolean(input?.disabled) || root.classList.contains('is-disabled') || root.getAttribute('aria-disabled') === 'true' || root.hasAttribute('data-icen-disabled');
  const allowed=(d:Date)=>d.getFullYear()>=1 && d.getFullYear()<=9999 && (!min || d>=min) && (!max || d<=max);
  const empty=()=>Boolean(min && max && min>max);
  function clamp(d:Date):Date {return min && d<min ? new Date(min) : max && d>max ? new Date(max) : d;}
  function paint():void {
    min=parse(root.dataset.icenDatePickerMin ?? '');max=parse(root.dataset.icenDatePickerMax ?? '');
    selected=parse(input?.value ?? '');
    const text=document.createElement('bdi');text.textContent=selected ? display(selected,root.dataset.icenDatePickerFormat ?? 'yyyy-mm-dd') : root.dataset.icenDatePickerPlaceholder ?? t('datePicker.selectDate');value!.replaceChildren(text);
    value!.classList.toggle('is-empty',!selected);
    trigger.setAttribute('aria-disabled',String(unavailable()));
    if(input?.value && (!selected || !allowed(selected)))trigger.setAttribute('aria-invalid','true');else trigger.removeAttribute('aria-invalid');
    if(panel && unavailable())close(false);
  }
  function position():void {
    if(!panel)return;
    if(!root.isConnected || unavailable()){close(false);return;}
    panel.dir=getComputedStyle(root).direction;
    const sizing=readPanelSizing(root),touch=window.matchMedia?.('(pointer: coarse)').matches;
    const desired=sizing.width ?? sizing.minWidth ?? (touch ? 344 : 300);
    applyPanelSizing(panel,null);
    applyPanelSizing(panel,{width:Math.min(desired,sizing.maxWidth ?? desired,Math.max(80,window.innerWidth-24))});
    panel.style.maxHeight='';
    const measured=panel.getBoundingClientRect();
    const layout=computePopoverLayout(trigger.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight},{side:'bottom',align:getComputedStyle(root).direction === 'rtl' ? 'end' : 'start',offset:6,margin:12,minWidth:measured.width || desired,maxWidth:measured.width || desired,maxHeight:sizing.maxHeight ?? Math.max(80,window.innerHeight-24),contentHeightHint:measured.height || panel.scrollHeight});
    panel.style.left=layout.left+'px';panel.style.top=layout.top+'px';panel.style.width=layout.width+'px';panel.style.maxHeight=layout.maxHeight+'px';panel.dataset.icenSide=layout.side;
  }
  function close(restore=true):void {
    if(!panel)return;
    const owns=panel.contains(document.activeElement);
    opened?.abort();opened=null;release?.();release=null;
    panel.remove();panel=null;trigger.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-controls');
    if(active?.root === root)active=null;
    if(restore && owns && root.isConnected && !unavailable())trigger.focus({preventScroll:true});
  }
  function pick(d:Date | null):void {
    if(disposed || unavailable() || (d && !allowed(d)))return;
    const next=d ? iso(d) : '';if(input)input.value=next;
    paint();close();emitIcen(root,'icen:date-change',{value:next,date:d});
    input?.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function render(focus:'day'|'prev'|'next'|null=null):void {
    if(!panel)return;
    const year=view.getFullYear(),month=view.getMonth(),weekStart=root.dataset.icenDatePickerWeekStart === '0' ? 0 : 1;
    const today=date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
    const titleId=panel.id+'-month';
    const head=document.createElement('div');head.className='icen-date-picker-head';
    const nav=(delta:number)=>{
      const b=document.createElement('button');b.type='button';b.className='icen-date-picker-nav';b.dataset.icenDateNav=delta<0 ? 'prev' : 'next';
      b.setAttribute('aria-label',t(delta<0 ? 'datePicker.prevMonth' : 'datePicker.nextMonth'));b.append(createIcon(delta<0 ? 'chevron-left' : 'chevron-right')!);
      const target=date(year,month+delta,1),end=date(year,month+delta+1,0);
      b.disabled=empty() || target.getFullYear()<1 || target.getFullYear()>9999 || Boolean(min && end<min) || Boolean(max && target>max);
      b.addEventListener('click',()=>{cursor=clamp(monthShift(cursor,delta));view=date(cursor.getFullYear(),cursor.getMonth(),1);render(delta<0 ? 'prev' : 'next');});return b;
    };
    const title=document.createElement('span');title.id=titleId;title.className='icen-date-picker-title';title.textContent=t('datePicker.yearMonth',{p0:year,p1:month+1});title.setAttribute('aria-live','polite');
    head.append(nav(-1),title,nav(1));
    const weekdays=document.createElement('div');weekdays.className='icen-date-picker-weekdays';weekdays.setAttribute('aria-hidden','true');
    for(const label of t(weekStart === 0 ? 'datePicker.weekdaysSunFirst' : 'datePicker.weekdays')){const span=document.createElement('span');span.textContent=label;weekdays.append(span);}
    const grid=document.createElement('div');grid.className='icen-date-picker-grid';grid.setAttribute('role','grid');grid.setAttribute('aria-labelledby',titleId);
    const offset=(date(year,month,1).getDay()-weekStart+7)%7;
    for(let week=0;week<6;week++){
      const row=document.createElement('div');row.className='icen-date-picker-week';row.setAttribute('role','row');
      for(let day=0;day<7;day++){
        const d=date(year,month,1-offset+week*7+day),key=iso(d),chosen=selected && key === iso(selected);
        const cell=document.createElement('span');cell.setAttribute('role','gridcell');cell.setAttribute('aria-selected',String(Boolean(chosen)));
        const b=document.createElement('button');b.type='button';b.className='icen-date-picker-cell';b.textContent=String(d.getDate());b.dataset.icenDate=key;b.setAttribute('aria-label',key);
        b.disabled=!allowed(d) || empty();b.tabIndex=!b.disabled && key === iso(cursor) ? 0 : -1;
        b.classList.toggle('is-outside',d.getMonth() !== month);b.classList.toggle('is-today',key === iso(today));b.classList.toggle('is-selected',Boolean(chosen));b.classList.toggle('is-disabled',b.disabled);
        if(key === iso(today))b.setAttribute('aria-current','date');
        b.addEventListener('click',()=>pick(d));b.addEventListener('focus',()=>{cursor=d;grid.querySelectorAll<HTMLButtonElement>('button').forEach((button)=>button.tabIndex=button === b ? 0 : -1);});
        cell.append(b);row.append(cell);
      }
      grid.append(row);
    }
    const foot=document.createElement('div');foot.className='icen-date-picker-foot';
    const now=document.createElement('button');now.type='button';now.className='icen-date-picker-today';now.textContent=t('datePicker.today');now.disabled=!allowed(today) || empty();now.addEventListener('click',()=>pick(today));
    const clear=document.createElement('button');clear.type='button';clear.className='icen-date-picker-clear';clear.textContent=t('datePicker.clear');clear.disabled=!input?.value;clear.addEventListener('click',()=>pick(null));foot.append(now,clear);
    panel.replaceChildren(head,weekdays,grid,foot);
    if(empty()){const status=document.createElement('p');status.className='icen-date-picker-empty';status.setAttribute('role','status');status.textContent=t('datePicker.noDates');panel.append(status);}
    position();
    if(focus && panel){const target=focus === 'day' ? panel.querySelector<HTMLButtonElement>('.icen-date-picker-cell[tabindex="0"]') : panel.querySelector<HTMLButtonElement>('[data-icen-date-nav="'+focus+'"]:not(:disabled)');const next=target ?? panel.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? panel;next.focus({preventScroll:true});revealPopoverItem(next,panel);}
  }
  function open():void {
    if(disposed || unavailable())return;
    active?.close(false);paint();
    cursor=clamp(selected ?? date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()));view=date(cursor.getFullYear(),cursor.getMonth(),1);
    const el=document.createElement('div');el.className='icen-date-picker-panel';el.id='icen-date-panel-'+ ++sequence;el.tabIndex=-1;el.dir=getComputedStyle(root).direction;el.setAttribute('role','dialog');el.setAttribute('aria-label',trigger.labels?.[0]?.textContent?.trim() || t('datePicker.selectDate'));panel=el;
    document.body.append(el);active={root,close};opened=new AbortController();const signal=opened.signal;
    release=claimMenuFocus(()=>close(false));trigger.classList.add('is-open');trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',el.id);render('day');
    document.addEventListener('pointerdown',(event)=>{if(event.target instanceof Node && !root.contains(event.target) && !el.contains(event.target))close(false);},{capture:true,signal});
    document.addEventListener('keydown',(event)=>{
      if(event.defaultPrevented || event.isComposing || event.keyCode === 229)return;
      if(event.key === 'Escape'){event.preventDefault();event.stopPropagation();close();return;}
      if(!el.contains(event.target as Node))return;
      if(event.key === 'Tab'){
        const focusables=focusableWithin(el),index=focusables.indexOf(document.activeElement as HTMLElement);
        if(event.shiftKey && (index === 0 || !focusables.length)){event.preventDefault();close(false);trigger.focus();}
        else if(!event.shiftKey && index === focusables.length-1){const all=focusableWithin(document.body).filter((item)=>!el.contains(item)),next=all[all.indexOf(trigger)+1];event.preventDefault();close(false);(next ?? trigger).focus();}return;
      }
      if(!(event.target instanceof Element) || !event.target.matches('.icen-date-picker-cell'))return;
      let candidate:Date | null=null;const rtl=getComputedStyle(root).direction === 'rtl';
      if(event.key === 'ArrowRight' || event.key === 'ArrowLeft')candidate=date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+(event.key === 'ArrowRight' ? 1 : -1)*(rtl ? -1 : 1));
      else if(event.key === 'ArrowUp' || event.key === 'ArrowDown')candidate=date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+(event.key === 'ArrowDown' ? 7 : -7));
      else if(event.key === 'Home' || event.key === 'End'){const start=root.dataset.icenDatePickerWeekStart === '0' ? 0 : 1,offset=(cursor.getDay()-start+7)%7;candidate=date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()-offset+(event.key === 'End' ? 6 : 0));}
      else if(event.key === 'PageUp' || event.key === 'PageDown')candidate=monthShift(cursor,(event.key === 'PageDown' ? 1 : -1)*(event.shiftKey ? 12 : 1));
      if(candidate){event.preventDefault();if(empty())return;cursor=clamp(candidate);if(!allowed(cursor))return;view=date(cursor.getFullYear(),cursor.getMonth(),1);render('day');}
    },{capture:true,signal});
    el.addEventListener('focusout',(event)=>{if(event.relatedTarget instanceof Node && !el.contains(event.relatedTarget) && event.relatedTarget !== trigger)close(false);},{signal});
    window.addEventListener('scroll',position,{capture:true,passive:true,signal});window.addEventListener('resize',position,{passive:true,signal});
  }
  trigger.addEventListener('click',()=>panel ? close(false) : open(),{signal:ac.signal});
  trigger.addEventListener('keydown',(event)=>{if(!event.isComposing && ['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(!panel)open();}},{signal:ac.signal});
  function refresh():void {paint();if(panel){cursor=clamp(selected ?? cursor);view=date(cursor.getFullYear(),cursor.getMonth(),1);const owned=panel.contains(document.activeElement);render(owned ? 'day' : null);}}
  input?.addEventListener('change',refresh,{signal:ac.signal});input?.addEventListener('input',refresh,{signal:ac.signal});
  // Hidden input value uses the attribute/default mode, so writes also mutate
  // defaultValue. Preserve the initialized value for a real component reset.
  input?.form?.addEventListener('reset',(event)=>queueMicrotask(()=>{if(!disposed && !event.defaultPrevented){if(input)input.value=initialValue;refresh();}}),{signal:ac.signal});
  const observer=new MutationObserver(refresh);observer.observe(root,{attributes:true,attributeFilter:['data-icen-date-picker-min','data-icen-date-picker-max','data-icen-date-picker-format','data-icen-date-picker-week-start','data-icen-date-picker-placeholder','data-icen-panel-width','data-icen-panel-min','data-icen-panel-max','data-icen-panel-max-height','aria-disabled','data-icen-disabled','class','dir','style']});
  if(input)observer.observe(input,{attributes:true,attributeFilter:['value','disabled']});
  observer.observe(trigger,{attributes:true,attributeFilter:['disabled']});
  for(let ancestor=root.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.matches('fieldset'))observer.observe(ancestor,{attributes:true,attributeFilter:['disabled']});
  const removed=new MutationObserver(()=>{if(panel && !root.isConnected)close(false);});removed.observe(document.body,{childList:true,subtree:true});
  paint();
  const dispose=()=>{if(disposed)return;disposed=true;close();ac.abort();observer.disconnect();removed.disconnect();attrs.forEach((key,i)=>saved[i] === null ? trigger.removeAttribute(key) : trigger.setAttribute(key,saved[i]!));if(generated)trigger.remove();instances.delete(root);};
  instances.set(root,dispose);return dispose;
}
export function initDatePicker(root?:ParentNode):()=>void {
  if(typeof document === 'undefined' || typeof window === 'undefined')return ()=>{};
  const scope=root ?? document,items:HTMLElement[]=[];
  if(scope instanceof HTMLElement && scope.matches('.icen-date-picker[data-icen-date-picker]'))items.push(scope);
  items.push(...scope.querySelectorAll<HTMLElement>('.icen-date-picker[data-icen-date-picker]'));
  const disposers=items.map(setup);return ()=>disposers.forEach((dispose)=>dispose());
}
