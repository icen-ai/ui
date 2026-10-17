import {afterEach,expect,test} from 'bun:test';
import {toast} from '../../src/behaviors/toast';
import {notify,createNotificationCenter} from '../../src/behaviors/notification';
const wait=(ms=0)=>new Promise((resolve)=>setTimeout(resolve,ms));
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).reverse().forEach((fn)=>fn());toast.dismiss();notify.clear();toast.config({maxStack:5});notify.config({maxStack:5});document.querySelectorAll('.icen-toast,.icen-notification').forEach((el)=>el.remove());});
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}

test('toast waits for async work, prevents duplicate activation and keeps rejected work retryable',async()=>{
  const first=deferred<void>(),second=deferred<void>();let calls=0;
  toast.action('Saved','Retry',()=>++calls === 1 ? first.promise : second.promise,{ms:50,closable:true,progress:true});
  const row=document.querySelector<HTMLElement>('.icen-toast')!,button=row.querySelector<HTMLButtonElement>('.icen-toast-action')!;
  button.click();button.click();expect(calls).toBe(1);expect(button.getAttribute('aria-busy')).toBe('true');
  await wait(100);expect(row.classList.contains('is-leaving')).toBe(false);
  first.reject(new Error('Network'));await wait();expect(button.hasAttribute('aria-busy')).toBe(false);
  expect(row.querySelector('[role="alert"]')?.textContent).toBeTruthy();await wait(90);expect(row.classList.contains('is-leaving')).toBe(false);
  button.click();expect(row.querySelector('.icen-feedback-error')).toBeNull();second.resolve();await wait();
  expect(calls).toBe(2);expect(row.classList.contains('is-leaving')).toBe(true);
});

test('focus and hover pause independently, and resuming one never releases the other',async()=>{
  toast.success('Pause',{ms:80,closable:true,progress:true});const row=document.querySelector<HTMLElement>('.icen-toast')!,close=row.querySelector<HTMLButtonElement>('button')!;
  row.dispatchEvent(new Event('mouseenter'));close.focus();row.dispatchEvent(new Event('mouseleave'));
  await wait(130);expect(row.classList.contains('is-leaving')).toBe(false);expect(row.querySelector<HTMLElement>('.icen-toast-progress-fill')!.style.animationPlayState).toBe('paused');
  close.blur();await wait(130);expect(row.classList.contains('is-leaving')).toBe(true);
});

test('explicit zero duration is persistent and clearing aborts pending work without stale UI continuations',async()=>{
  const operation=deferred<void>();let signal:AbortSignal | undefined;
  const h=toast.action('Persistent','Run',(s)=>{signal=s;return operation.promise;},{ms:0,closable:true,progress:true});
  const row=document.querySelector<HTMLElement>('.icen-toast')!;expect(row.querySelector('.icen-toast-progress')).toBeNull();
  row.querySelector<HTMLButtonElement>('.icen-toast-action')!.click();await wait(50);expect(row.classList.contains('is-leaving')).toBe(false);
  toast.dismiss();expect(signal?.aborted).toBe(true);operation.resolve();await wait();h.resume();expect(document.querySelector('.icen-toast')).toBeNull();
});

test('notification paused state survives duration updates and any handle obtained by callbacks can resume it',async()=>{
  const h=notify.info('Paused',{duration:80})!;h.pause();h.update({duration:100});
  expect(notify.get(h.id)?.paused).toBe(true);await wait(150);expect(notify.get(h.id)).not.toBeNull();
  h.resume();await wait(150);expect(notify.get(h.id)).toBeNull();
});

test('same-id replacement and actions updates abort stale actions and stale handles cannot mutate the replacement',async()=>{
  const operation=deferred<void>();let signal:AbortSignal | undefined;
  const first=notify.info('Old',{id:'feedback-replace',actions:[{label:'Work',onClick:(s)=>{signal=s;return operation.promise;}}]})!;
  first.el.querySelector<HTMLButtonElement>('.icen-notification-action')!.click();
  const next=notify.info('New',{id:'feedback-replace'})!;expect(signal?.aborted).toBe(true);expect(document.querySelectorAll('#feedback-replace').length).toBe(1);
  first.update({title:'Stale'});first.dismiss();operation.resolve();await wait();expect(notify.get(next.id)?.title).toBe('New');
  next.update({actions:[{label:'Fresh',keepOpen:true}],link:'/tokens/',linkLabel:'Tokens'});
  expect(next.el.querySelector('.icen-notification-action')?.textContent).toBe('Fresh');expect(next.el.querySelector('a')?.getAttribute('href')).toBe('/tokens/');
  next.dismiss();notify.info('Again',{id:'feedback-replace'});expect(document.querySelectorAll('#feedback-replace').length).toBe(1);
  const legacy=notify.info('Legacy',{actionLabel:'Old action'} )!;
  legacy.update({actions:[]});expect(legacy.el.querySelector('.icen-notification-action')).toBeNull();
});

test('destroying a center aborts its actions, settles close once and never leaves a running timer',async()=>{
  const center=createNotificationCenter(document.body);cleanups.push(()=>center.destroy());const operation=deferred<void>();let signal:AbortSignal | undefined,closed=0;
  const h=center.push({title:'Work',options:{duration:60,actions:[{label:'Run',onClick:(s)=>{signal=s;return operation.promise;}}],onClose:()=>closed++}})!;
  h.el.querySelector<HTMLButtonElement>('.icen-notification-action')!.click();center.destroy();operation.resolve();await wait(90);
  expect(signal?.aborted).toBe(true);expect(closed).toBe(1);expect(center.getAll().length).toBe(0);expect(notify.get(h.id)).toBeNull();
});

test('stack eviction settles confirmation promises and releases runtime ownership',async()=>{
  notify.config({maxStack:1});const confirmed=notify.confirm('Pending confirmation');notify.info('Next');
  expect(await confirmed).toBe(false);expect(notify.getAll().length).toBe(1);
});

test('shrinking stack limits retires every excess record and emits close callbacks exactly once',async()=>{
  let closed=0;for(let i=0;i<4;i++)notify.info('Item '+i,{onClose:()=>closed++});
  notify.config({maxStack:1});expect(notify.getAll().length).toBe(1);await wait(420);expect(closed).toBe(3);
});

test('clickable notification body has a native title action and does not intercept keys meant for sibling actions',()=>{
  let opened=0,acted=0;const h=notify.info('Open item',{onClick:()=>opened++,actions:[{label:'Do work',keepOpen:true,onClick:()=>acted++}]})!;
  expect(h.el.getAttribute('role')).toBe('status');expect(h.el.querySelector('[role="button"]')).toBeNull();
  h.el.querySelector<HTMLButtonElement>('.icen-notification-open')!.click();expect(opened).toBe(1);
  const action=h.el.querySelector<HTMLButtonElement>('.icen-notification-action')!;
  const event=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});action.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);action.click();expect(acted).toBe(1);expect(opened).toBe(1);
  h.update({title:'Updated'});expect(h.el.querySelector('.icen-notification-open')?.textContent).toBe('Updated');
});

test('nested feedback returns focus to the surviving trigger, with an outside fallback when its card retires',()=>{
  const trigger=document.createElement('button');trigger.textContent='Origin';document.body.append(trigger);cleanups.push(()=>trigger.remove());trigger.focus();
  const notice=notify.info('Parent',{onClick:()=>undefined})!;const title=notice.el.querySelector<HTMLButtonElement>('.icen-notification-open')!;title.focus();
  const first=toast.info('Child',{closable:true,ms:0});const close=document.querySelector<HTMLButtonElement>('.icen-toast-close')!;close.focus();first.dismiss();
  expect(document.activeElement === title).toBe(true);
  toast.dismiss();const second=toast.info('Child',{closable:true,ms:0});const next=document.querySelector<HTMLButtonElement>('.icen-toast-close')!;next.focus();notice.dismiss();second.dismiss();
  expect(document.activeElement === trigger).toBe(true);
});
