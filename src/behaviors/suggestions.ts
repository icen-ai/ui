/** Shared suggestion queries: invalidate at input time, abort cooperative work,
 * and guard every continuation, including the debounce interval and sync errors. */
import {createIcon} from './icons';
import {isAvailableForFocus,focusableWithin} from './focus';
import {t} from './i18n';

export interface SuggestionSourceContext {signal:AbortSignal;}
export function afterSuggestionField(input:HTMLElement,panel:HTMLElement):HTMLElement {
  if(typeof document === 'undefined')return input;
  const items=focusableWithin(document.body).filter((item)=>!panel.contains(item));
  return items[items.indexOf(input)+1] ?? input;
}
export function canQuery(input:HTMLInputElement | HTMLTextAreaElement):boolean {
  if(typeof document === 'undefined')return false;
  if(input.readOnly || !isAvailableForFocus(input) || input.closest('[aria-disabled="true"]'))return false;
  for(let parent=input.parentElement;parent;parent=parent.parentElement){
    if(parent.matches('fieldset[disabled]') && !parent.querySelector(':scope > legend')?.contains(input))return false;
  }
  return true;
}
/** Follow inherited disabled/hidden state as well as local sizing and direction. */
export function watchSuggestionField(input:HTMLElement,changed:()=>void):()=>void {
  if(typeof document === 'undefined')return ()=>{};
  const observer=new MutationObserver(changed);
  for(let node:HTMLElement | null=input;node;node=node.parentElement)observer.observe(node,{attributes:true,attributeFilter:['disabled','readonly','aria-disabled','hidden','inert','dir','style','class','data-icen-panel-width','data-icen-panel-min','data-icen-panel-max','data-icen-panel-max-height']});
  const removal=new MutationObserver(()=>{if(!input.isConnected)changed();});removal.observe(document.body,{childList:true,subtree:true});
  const resize=typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(changed);resize?.observe(input);
  return ()=>{observer.disconnect();removal.disconnect();resize?.disconnect();};
}
export function createSuggestionQuery<T>(source:(query:string,context:SuggestionSourceContext)=>T | Promise<T>,hooks:{pending():void;success(value:T):void;error(error:unknown):void}) {
  let sequence=0,dead=false,timer:ReturnType<typeof setTimeout> | null=null,controller:AbortController | null=null;
  function cancel():void {sequence++;if(timer)clearTimeout(timer);timer=null;const previous=controller;controller=null;previous?.abort();}
  return {
    cancel,
    run(query:string,delay=0):void {
      cancel();if(dead)return;
      const own=sequence,ac=new AbortController();controller=ac;let announced=false;
      const current=()=>!dead && sequence === own && !ac.signal.aborted;
      const pending=()=>{if(current() && !announced){announced=true;hooks.pending();}};
      const fail=(error:unknown)=>{if(current()){controller=null;hooks.error(error);}};
      const apply=(value:T)=>{if(!current())return;controller=null;try{hooks.success(value);}catch(error){fail(error);}};
      const run=()=>{
        timer=null;if(!current())return;
        try{const result=source(query,{signal:ac.signal});
          if(result && typeof (result as Promise<T>).then === 'function'){pending();void Promise.resolve(result).then(apply,fail);}
          else apply(result as T);
        }catch(error){fail(error);}
      };
      if(delay>0){pending();timer=setTimeout(run,delay);}else run();
    },
    destroy():void {cancel();dead=true;},
  };
}

/** Status and retry live beside the listbox, never among its option children. */
export function createSuggestionStatus(retry:()=>void,labels:{loading?:string;error?:string;retry?:string}={}) {
  if(typeof document === 'undefined')return {el:{} as HTMLElement,show(_state:'loading'|'error'|null){}};
  const el=document.createElement('div');el.className='icen-suggestion-status';el.setAttribute('role','status');el.hidden=true;
  const icon=document.createElement('span');icon.className='icen-suggestion-symbol';icon.setAttribute('aria-hidden','true');
  const text=document.createElement('bdi');text.className='icen-suggestion-copy';
  const button=document.createElement('button');button.type='button';button.className='icen-suggestion-retry';button.textContent=labels.retry ?? t('common.retry');
  button.addEventListener('pointerdown',(event)=>event.preventDefault());button.addEventListener('mousedown',(event)=>event.preventDefault());button.addEventListener('click',retry);
  el.append(icon,text,button);
  return {el,show(state:'loading'|'error'|null):void {
    el.hidden=state === null;el.classList.toggle('is-loading',state === 'loading');button.hidden=state !== 'error';
    if(!state)return;
    icon.replaceChildren(createIcon(state === 'loading' ? 'spinner' : 'circle-info')!);
    text.textContent=state === 'loading' ? labels.loading ?? t('suggestions.loading') : labels.error ?? t('suggestions.error');
  }};
}
