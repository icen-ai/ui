import {afterEach,expect,test} from 'bun:test';
import {notify,createNotificationCenter,initNotification,type NotificationCenterHandle} from '../../src/behaviors/notification';

const centers:NotificationCenterHandle[]=[];
const disposers:(()=>void)[]=[];
const keys=['feedback.archive.a','feedback.archive.b','feedback.archive.c'];
function center(key:string,maxStack=5){const c=createNotificationCenter(document.body,{persist:key,maxStack});centers.push(c);return c;}
function snapshot(key:string){return JSON.parse(localStorage.getItem(key) ?? '[]');}
afterEach(()=>{
  disposers.splice(0).forEach((fn)=>fn());centers.splice(0).forEach((c)=>c.destroy());
  notify.clear();notify.config({persist:false,maxStack:5});keys.forEach((key)=>localStorage.removeItem(key));
  document.querySelectorAll('.icen-notification-container').forEach((el)=>el.remove());
});

test('unmounted snapshots survive unrelated center activity and remount with updated read state',()=>{
  const a=center(keys[0]);const h=a.push({title:'Export ready',options:{id:'archive-a',unread:true,data:{file:'report.pdf'}}})!;
  a.markAllRead();expect(snapshot(keys[0])[0].unread).toBe(false);a.destroy();
  const b=center(keys[1]);b.push({title:'Elsewhere'});b.clear();
  expect(snapshot(keys[0]).map((item:any)=>item.title)).toEqual(['Export ready']);
  const restored=center(keys[0]);expect(restored.get(h.id)?.title).toBe('Export ready');
  expect(restored.get(h.id)?.opts.data).toEqual({file:'report.pdf'});
  restored.clear();expect(snapshot(keys[0])).toEqual([]);restored.destroy();
  expect(center(keys[0]).getAll()).toHaveLength(0);
});

test('shared keys never duplicate live ids and dismiss removes only the owned entry',()=>{
  const a=center(keys[0]);a.push({title:'First',options:{id:'shared-first'}});
  const b=center(keys[0]);expect(b.getAll()).toHaveLength(0);b.push({title:'Second',options:{id:'shared-second'}});
  a.destroy();b.clear();expect(snapshot(keys[0]).map((item:any)=>item.id)).toEqual(['shared-first']);
  const restored=center(keys[0]);expect(restored.getAll()).toHaveLength(1);
  expect(document.querySelectorAll('#shared-first').length).toBe(1);
});

test('global init is repeatable without duplicate DOM and disposing restores does not erase its archive',()=>{
  notify.config({persist:keys[0]});notify.info('Saved global',{id:'saved-global'});
  const first=initNotification();expect(document.querySelectorAll('#saved-global').length).toBe(1);first();
  // A global notification created outside init remains explicitly owned by the caller.
  notify.config({persist:false});notify.clear();notify.config({persist:keys[0]});
  const dispose=initNotification();expect(notify.get('saved-global')?.title).toBe('Saved global');dispose();
  expect(notify.get('saved-global')).toBeNull();
  center(keys[1]).push({title:'Unrelated'});expect(snapshot(keys[0])).toHaveLength(1);
  const next=initNotification();disposers.push(next);expect(document.querySelectorAll('#saved-global').length).toBe(1);
  dispose();expect(notify.get('saved-global')).not.toBeNull();
});

test('restoration validates entries, deduplicates ids, clamps progress and enforces the visible stack limit',()=>{
  localStorage.setItem(keys[0],JSON.stringify([null,12,{},
    {id:'bad-kind',title:'Invalid',kind:'unknown'},
    {id:'valid-a',title:'Old title',kind:'info'},
    {id:'valid-a',title:'Latest title',kind:'info',progress:4},
    {id:'valid-b',title:'Priority',kind:'warning',priority:'high'},
  ]));
  const c=center(keys[0],1);expect(c.getAll().map((r)=>r.id)).toEqual(['valid-b']);
  expect(snapshot(keys[0]).map((item:any)=>item.id)).toEqual(['valid-b']);
  c.destroy();localStorage.setItem(keys[0],'{broken');expect(center(keys[0]).getAll()).toHaveLength(0);
});

test('changing keys moves live records, and timed updates and stack eviction delete their saved entries',()=>{
  const c=center(keys[0]);const h=c.push({title:'Move',options:{id:'archive-move'}})!;
  c.config({persist:keys[1]});expect(snapshot(keys[0])).toEqual([]);expect(snapshot(keys[1])[0].id).toBe(h.id);
  h.update({duration:10000});expect(snapshot(keys[1])).toEqual([]);
  h.update({duration:0});expect(snapshot(keys[1])).toHaveLength(1);
  c.config({maxStack:1});c.push({title:'Replacement',options:{id:'archive-replacement'}});
  expect(snapshot(keys[1]).map((item:any)=>item.id)).toEqual(['archive-replacement']);
  c.destroy();c.config({persist:keys[2]});expect(localStorage.getItem(keys[2])).toBeNull();
});
