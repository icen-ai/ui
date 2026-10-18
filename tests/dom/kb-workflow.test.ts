import {afterEach,expect,test} from 'bun:test';
import {createKbAccess} from '../../src/behaviors/kb-access';
import {initKbCheckpoint,renderKbCheckpoints} from '../../src/behaviors/kb-checkpoint';
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).reverse().forEach(off=>off());document.body.replaceChildren()});
const host=()=>{const el=document.createElement('div');document.body.append(el);return el};
test('permission requests retain native controls, selection and duration across role and owner changes',()=>{
  const el=host();const requests:unknown[]=[];
  const h=createKbAccess(el,{request:{id:'r1',resource:'设计规范',requester:'设计师',role:'viewer',state:'idle',submittedAt:new Date().toISOString()},onRequest:r=>requests.push(r)});cleanups.push(()=>h.destroy());
  el.querySelector<HTMLButtonElement>('[data-icen-access-request]')!.click();
  const field=el.querySelector<HTMLTextAreaElement>('textarea')!,form=el.querySelector('form')!;
  /* 时长为弹层选择器（icen-select）：开面板点选项，值落在 hidden input */
  el.querySelector<HTMLButtonElement>('.icen-kb-access-duration .icen-select-trigger')!.click();
  document.querySelector<HTMLButtonElement>('.icen-select-option[data-icen-value="7"]')!.click();
  const duration=el.querySelector<HTMLInputElement>('.icen-kb-access-duration input[data-icen-select-value]')!;
  field.value='核对现代的排版与交互';field.focus();field.setSelectionRange(2,5);
  const role=el.querySelector<HTMLButtonElement>('[data-icen-role="editor"]')!;role.focus();role.click();
  expect(el.querySelector('textarea')===field).toBe(true);expect(document.activeElement===role).toBe(true);
  field.focus();field.setSelectionRange(2,5);h.setState({approverNote:'新的负责人'});
  expect(el.querySelector('form')===form).toBe(true);expect(document.activeElement===field).toBe(true);
  expect([field.selectionStart,field.selectionEnd]).toEqual([2,5]);expect(duration.value).toBe('7');
  form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));expect(requests).toHaveLength(1);
  expect(h.getState().role).toBe('editor');expect(h.getState().reason).toBe(field.value);
  expect(el.querySelector('[data-icen-access-request]')!.hasAttribute('disabled')).toBe(true);
  expect(document.activeElement===el.querySelector('.icen-kb-access-state')).toBe(true);
});
test('switching the requested resource closes and clears the previous resource draft',()=>{
  const el=host();const h=createKbAccess(el,{request:{id:'r1',resource:'资源一'}});cleanups.push(()=>h.destroy());
  el.querySelector<HTMLButtonElement>('[data-icen-access-request]')!.click();el.querySelector<HTMLTextAreaElement>('textarea')!.value='仅适用于资源一';
  h.setState({id:'r2',resource:'资源二'});expect(el.querySelector('form')!.hidden).toBe(true);expect(el.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('');
});
test('checkpoint keyboard navigation skips unavailable scopes, returns focus and emits the actual scope once',()=>{
  const el=host();renderKbCheckpoints(el,[{id:'one',at:new Date().toISOString(),label:'改写前',scopeOptions:['content','both']}]);
  cleanups.push(initKbCheckpoint(el));cleanups.push(initKbCheckpoint());const restore:unknown[]=[];el.addEventListener('icen:kb-checkpoint-restore',e=>restore.push((e as CustomEvent).detail));
  const trigger=el.querySelector<HTMLButtonElement>('button')!;trigger.focus();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
  expect(document.activeElement?.getAttribute('data-icen-scope')).toBe('content');
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
  expect(document.activeElement?.getAttribute('data-icen-scope')).toBe('both');(document.activeElement as HTMLButtonElement).click();
  expect(restore).toEqual([{checkpointId:'one',scope:'both'}]);expect(document.activeElement===trigger).toBe(true);expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
test('explicitly empty checkpoint scopes stay unavailable; Escape still closes the menu',()=>{
  const el=host();renderKbCheckpoints(el,[{id:'none',at:new Date().toISOString(),scopeOptions:[]}]);cleanups.push(initKbCheckpoint(el));
  const trigger=el.querySelector<HTMLButtonElement>('button')!;trigger.click();
  expect(document.querySelectorAll('.icen-kb-checkpoint-menu button:not(:disabled)')).toHaveLength(0);
  expect(document.activeElement?.getAttribute('role')).toBe('menu');
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  expect(document.querySelectorAll('.icen-kb-checkpoint-menu')).toHaveLength(0);expect(document.activeElement===trigger).toBe(true);
});
test('checkpoint disposal closes its detached anchor but leaves another scope owner alone',()=>{
  const a=host(),b=host();renderKbCheckpoints(a,[{id:'a',at:new Date().toISOString()}]);renderKbCheckpoints(b,[{id:'b',at:new Date().toISOString()}]);
  const offA=initKbCheckpoint(a),offB=initKbCheckpoint(b);cleanups.push(offA,offB);
  a.querySelector<HTMLButtonElement>('button')!.click();offB();
  expect(document.querySelectorAll('.icen-kb-checkpoint-menu')).toHaveLength(1);
  a.remove();offA();expect(document.querySelectorAll('.icen-kb-checkpoint-menu')).toHaveLength(0);
});
test('an expiry listener can dispose an access panel without the renderer resurrecting it',()=>{
  const el=host();const h=createKbAccess(el,{request:{id:'expire',resource:'授权内容'}});cleanups.push(()=>h.destroy());
  el.addEventListener('icen:kb-access-expire',()=>h.destroy());
  h.setState({state:'granted',expiresAt:new Date(Date.now()-1000).toISOString()});expect(el.children.length).toBe(0);
});
