/** Shared feedback runtime: overlapping pause reasons, cancellable async actions
 * and stable button geometry. No DOM is created at import time; SSR is safe. */
import { createIcon } from './icons';

export interface CountdownState { duration: number; remaining: number; paused: boolean; timer: number; startedAt: number; }
export interface FeedbackClock {
  pause(reason?: string): void;
  resume(reason?: string): void;
  reset(ms: number): void;
  destroy(): void;
}
export function createFeedbackClock(el: HTMLElement, state: CountdownState, expire: ()=>void, progress: string, pauseOnHover: ()=>boolean = ()=>true): FeedbackClock {
  if(typeof document === 'undefined')return {pause(){},resume(){},reset(){},destroy(){}};
  const reasons=new Set<string>();
  const ac=new AbortController();
  let destroyed=false;
  function sync(reset = false): void {
    state.paused=state.duration>0 && reasons.size>0;
    el.classList.toggle('is-paused',state.paused);
    const fill=el.querySelector<HTMLElement>(progress);
    if(fill) {
      if(reset) {fill.style.animationName='none';void fill.offsetWidth;fill.style.animationName='';fill.style.animationDuration=`${state.duration}ms`;}
      fill.style.animationPlayState=state.paused ? 'paused' : 'running';
    }
  }
  function stop(): void {
    if(!state.timer)return;
    window.clearTimeout(state.timer);state.timer=0;
    state.remaining=Math.max(0,state.remaining-(Date.now()-state.startedAt));
  }
  function start(): void {
    if(destroyed || state.duration<=0 || reasons.size || state.timer)return;
    if(state.remaining<=0){expire();return;}
    state.startedAt=Date.now();
    state.timer=window.setTimeout(()=>{state.timer=0;state.remaining=0;if(!destroyed)expire();},state.remaining);
  }
  const clock:FeedbackClock={
    pause(reason='manual'){if(destroyed)return;reasons.add(reason);stop();sync();},
    resume(reason='manual'){if(destroyed)return;reasons.delete(reason);sync();start();},
    reset(ms){if(destroyed)return;stop();state.duration=Number.isFinite(ms) ? Math.max(0,ms) : 0;state.remaining=state.duration;sync(true);start();},
    destroy(){if(destroyed)return;destroyed=true;stop();reasons.clear();ac.abort();},
  };
  el.addEventListener('mouseenter',()=>{if(pauseOnHover())clock.pause('hover');},{signal:ac.signal});
  el.addEventListener('mouseleave',()=>clock.resume('hover'),{signal:ac.signal});
  el.addEventListener('focusin',()=>clock.pause('focus'),{signal:ac.signal});
  el.addEventListener('focusout',(event)=>{if(!(event.relatedTarget instanceof Node) || !el.contains(event.relatedTarget))clock.resume('focus');},{signal:ac.signal});
  const visibility=()=>document.hidden ? clock.pause('visibility') : clock.resume('visibility');
  document.addEventListener('visibilitychange',visibility,{signal:ac.signal});
  if(document.hidden)reasons.add('visibility');
  if(el.contains(document.activeElement))reasons.add('focus');
  clock.reset(state.duration);return clock;
}

export type FeedbackAction = (signal: AbortSignal)=>void | boolean | Promise<void | boolean>;
interface PendingAction { abort(): void; }
const pending=new WeakMap<HTMLElement,PendingAction>();
/** Cancel the UI continuation and signal cooperative work; stale promises never
 * dismiss a replaced card or resurrect controls after the owner was destroyed. */
export function cancelFeedbackAction(card: HTMLElement): void { pending.get(card)?.abort(); }
export function runFeedbackAction(card: HTMLElement, button: HTMLButtonElement, action: FeedbackAction, hooks: {
  busy(value: boolean): void;
  complete(accepted: boolean): void;
  error(error: unknown): void;
}): void {
  if(typeof document === 'undefined')return;
  if(pending.has(card) || card.classList.contains('is-leaving') || !card.isConnected)return;
  const ac=new AbortController();
  const controls=Array.from(card.querySelectorAll<HTMLButtonElement>('.icen-toast-action,.icen-notification-action'));
  const original=controls.map((item)=>item.getAttribute('aria-disabled'));
  let spinner: HTMLElement | null=null;
  let busy=false;
  let signalled=false;
  const restore=()=>{
    if(busy) {
      busy=false;
      controls.forEach((item,index)=>original[index] == null ? item.removeAttribute('aria-disabled') : item.setAttribute('aria-disabled',original[index]!));
      button.removeAttribute('aria-busy');spinner?.remove();
    }
    if(signalled){signalled=false;hooks.busy(false);}
  };
  const operation:PendingAction={abort(){ac.abort();if(pending.get(card) === operation){pending.delete(card);restore();}}};
  pending.set(card,operation);
  const finish=(result: void | boolean, error?: unknown)=>{
    if(ac.signal.aborted || pending.get(card) !== operation)return;
    pending.delete(card);
    try {
      if(card.isConnected && !card.classList.contains('is-leaving')) {
        if(error !== undefined)hooks.error(error);else hooks.complete(result !== false);
      }
    } finally {restore();}
  };
  try {
    signalled=true;hooks.busy(true);
    const result=action(ac.signal);
    if(result && typeof (result as Promise<unknown>).then === 'function') {
      busy=true;controls.forEach((item)=>item.setAttribute('aria-disabled','true'));button.setAttribute('aria-busy','true');
      let label=button.querySelector('.icen-feedback-action-label');
      if(!label){label=document.createElement('span');label.className='icen-feedback-action-label';while(button.firstChild)label.append(button.firstChild);button.append(label);}
      spinner=document.createElement('span');spinner.className='icen-feedback-action-spinner';spinner.setAttribute('aria-hidden','true');spinner.append(createIcon('spinner')!);button.append(spinner);
      void Promise.resolve(result).then((value)=>finish(value),(error)=>finish(false,error ?? new Error('Action rejected')));
    } else finish(result as void | boolean);
  } catch(error){finish(false,error ?? new Error('Action failed'));}
}

export function setFeedbackError(host: HTMLElement, message?: string): void {
  if(typeof document === 'undefined')return;
  let error=host.querySelector<HTMLElement>(':scope > .icen-feedback-error');
  if(!message){error?.remove();return;}
  if(!error){error=document.createElement('span');error.className='icen-feedback-error';error.setAttribute('role','alert');host.append(error);}
  setFeedbackText(error,message);
}
/** Isolate caller text from the layout direction (CJK/Latin in an RTL shell). */
export function setFeedbackText(host: HTMLElement, value: string): void {
  if(typeof document === 'undefined')return;
  const text=document.createElement('bdi');text.textContent=value;host.replaceChildren(text);
}
const origins=new WeakMap<HTMLElement,HTMLElement[]>();
export function rememberFeedbackOrigin(card: HTMLElement): void {
  if(typeof document === 'undefined')return;
  const focused=document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previous=focused?.closest<HTMLElement>('.icen-toast,.icen-notification');
  const chain=[...(focused ? [focused] : []),...(previous ? origins.get(previous) ?? [] : [])];
  origins.set(card,[...new Set(chain)].filter((item)=>item.isConnected));
}
export function restoreFeedbackFocus(card: HTMLElement): void {
  if(typeof document === 'undefined')return;
  const origin=origins.get(card)?.find((item)=>item.isConnected && !item.closest('[hidden],[inert],.is-leaving') && !item.matches(':disabled,[aria-disabled="true"]'));
  if(card.contains(document.activeElement))origin?.focus({preventScroll:true});
}
