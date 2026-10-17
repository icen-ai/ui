import {afterEach,expect,test} from 'bun:test';
import {notify,createNotificationCenter,type NotificationCenterHandle} from '../../src/behaviors/notification';
const centers:NotificationCenterHandle[]=[];
const wait=(ms:number)=>new Promise((resolve)=>setTimeout(resolve,ms));
function push(title:string,options:Parameters<typeof notify>[1]={}){return notify.info(title,{tag:'work',...options})!;}
function toggle(el:HTMLElement){return el.querySelector<HTMLButtonElement>('.icen-notification-group-toggle')!;}
afterEach(()=>{centers.splice(0).forEach((c)=>c.destroy());notify.clear();notify.config({persist:false,maxStack:5});document.querySelectorAll('.icen-notification-container').forEach((el)=>el.remove());localStorage.removeItem('group.archive');});

test('tag groups keep original cards, expose count and controls, and toggle with native button behavior',()=>{
  let calls=0;const a=push('First',{actions:[{label:'Reply',keepOpen:true,onClick:()=>{calls++;}}]}),b=push('Second'),c=push('Latest');
  expect(a.el.hidden).toBe(true);expect(a.el.inert).toBe(true);expect(b.el.hidden).toBe(true);expect(c.el.hidden).toBe(false);
  const button=toggle(c.el);expect(button.textContent).toBe('3 条同组通知');expect(button.getAttribute('aria-controls')?.split(' ')).toEqual([a.id,b.id]);
  expect(button.querySelector('svg')).not.toBeNull();button.click();expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(a.el.hidden).toBe(false);expect(a.el.inert).toBe(false);a.el.querySelector<HTMLButtonElement>('.icen-notification-action')!.click();expect(calls).toBe(1);
  button.click();expect(a.el.hidden).toBe(true);c.dismiss();expect(b.el.hidden).toBe(false);expect(toggle(b.el).textContent).toBe('2 条同组通知');
  b.dismiss();expect(a.el.hidden).toBe(false);expect(toggle(a.el)).toBeNull();
});

test('priority chooses a visible representative and retagging a reused disclosure changes its actual group',()=>{
  const a=push('Priority',{priority:'high'}),b=push('Newest');expect(a.el.hidden).toBe(false);expect(b.el.hidden).toBe(true);
  a.update({priority:'normal'});expect(b.el.hidden).toBe(false);expect(a.el.hidden).toBe(true);
  b.update({tag:'other'});expect(a.el.hidden).toBe(false);expect(toggle(b.el)).toBeNull();
  const c=push('Third',{tag:'other'});expect(b.el.hidden).toBe(true);toggle(c.el).click();expect(b.el.hidden).toBe(false);
  c.update({tag:'work'});expect(b.el.hidden).toBe(false);expect(a.el.hidden).toBe(true);
  const current=toggle(c.el);current.click();expect(a.el.hidden).toBe(false);expect(b.el.hidden).toBe(false);
  current.click();expect(a.el.hidden).toBe(true);
});

test('focused actions are never hidden by an incoming group member and group toggle focus follows the new summary',()=>{
  const a=push('First',{actions:[{label:'Action',keepOpen:true}]}),action=a.el.querySelector<HTMLButtonElement>('.icen-notification-action')!;
  action.focus();const b=push('Next');expect(a.el.hidden).toBe(false);expect(document.activeElement === action).toBe(true);
  const button=toggle(b.el);button.focus();button.click();const c=push('Third');expect(document.activeElement === toggle(c.el)).toBe(true);
  expect(a.el.hidden).toBe(true);expect(b.el.hidden).toBe(true);
});

test('collapsed members preserve remaining lifetime and resume only when visible',async()=>{
  const a=push('Timed',{duration:100}),b=push('Summary');await wait(150);expect(notify.get(a.id)).not.toBeNull();
  toggle(b.el).click();await wait(160);expect(notify.get(a.id)).toBeNull();expect(toggle(b.el)).toBeNull();
});

test('pending work keeps a group expanded until it completes and cannot be collapsed over its action',async()=>{
  let finish!:()=>void;const pending=new Promise<void>((resolve)=>{finish=resolve;});
  const a=push('First',{actions:[{label:'Run',keepOpen:true,onClick:()=>pending}]}),b=push('Second');
  toggle(b.el).click();a.el.querySelector<HTMLButtonElement>('.icen-notification-action')!.click();
  const button=toggle(b.el);expect(button.getAttribute('aria-disabled')).toBe('true');button.click();expect(a.el.hidden).toBe(false);
  finish();await wait(0);expect(button.hasAttribute('aria-disabled')).toBe(false);button.click();expect(a.el.hidden).toBe(true);
});

test('groups are container-scoped and remount from saved records in their default collapsed state',()=>{
  const first=createNotificationCenter(document.body,{persist:'group.archive'});centers.push(first);
  const a=first.push({title:'A',options:{tag:'same'}})!,b=first.push({title:'B',options:{tag:'same'}})!;toggle(b.el).click();
  const other=createNotificationCenter(document.body);centers.push(other);const lone=other.push({title:'Other',options:{tag:'same'}})!;expect(toggle(lone.el)).toBeNull();
  first.destroy();const restored=createNotificationCenter(document.body,{persist:'group.archive'});centers.push(restored);
  expect(restored.get(a.id)?.el?.hidden).toBe(true);expect(toggle(restored.get(b.id)!.el!).getAttribute('aria-expanded')).toBe('false');
});

test('removing a last disclosure restores its origin when the card has no other focusable action',()=>{
  const origin=document.createElement('button');document.body.append(origin);origin.focus();
  const a=push('First',{closable:false}),b=push('Summary',{closable:false});toggle(b.el).focus();
  b.update({tag:''});expect(toggle(b.el)).toBeNull();expect(document.activeElement === origin).toBe(true);
  expect(a.el.hidden).toBe(false);origin.remove();
});
