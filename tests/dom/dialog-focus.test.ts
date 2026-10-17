import {afterEach,expect,test} from 'bun:test';
import {initModal,openModal,closeModal} from '../../src/behaviors/modal';
import {openPopover,closePopover} from '../../src/behaviors/popover';
import {focusableWithin} from '../../src/behaviors/focus';
const cleanups:(()=>void)[]=[];
afterEach(()=>{closeModal('focus-dialog');cleanups.splice(0).reverse().forEach((cleanup)=>cleanup());});
function fixture(){
  const host=document.createElement('section');host.innerHTML='<button data-icen-modal-open="focus-dialog">Open</button><div class="icen-modal-backdrop" data-icen-modal="focus-dialog" hidden><div class="icen-modal"><h2 class="icen-modal-title">Focus</h2><div hidden><button>Hidden</button></div><div style="display:none"><button>CSS hidden</button></div><button aria-disabled="true">Unavailable</button><button tabindex="-1">Programmatic</button><button class="first">First</button><button class="icen-modal-close">x</button></div></div>';
  document.body.append(host);cleanups.push(()=>host.remove());const dispose=initModal(host);cleanups.push(dispose);
  return {host,dispose,backdrop:host.querySelector<HTMLElement>('.icen-modal-backdrop')!,trigger:host.querySelector<HTMLButtonElement>('button')!};
}
test('dialog skips hidden ancestry and unavailable items; programmatic initial focus remains supported',()=>{
  const {backdrop,trigger}=fixture();trigger.click();expect(document.activeElement?.textContent).toBe('First');
  expect(focusableWithin(backdrop).length).toBe(2);
  expect(backdrop.querySelector('.icen-modal-close svg')?.getAttribute('viewBox')).toBe('0 0 20 20');
  closeModal('focus-dialog');openModal('focus-dialog',{initialFocus:backdrop.querySelector('button[tabindex="-1"]') as HTMLElement});
  expect(document.activeElement?.textContent).toBe('Programmatic');
});
test('modal disposer is shared, restores the real portal node and permits reinitialization',()=>{
  const {host,dispose,backdrop,trigger}=fixture();trigger.click();expect(initModal(host) === dispose).toBe(true);dispose();
  expect(backdrop.parentElement === host).toBe(true);expect(document.body.style.overflow).not.toBe('hidden');
  const again=initModal(host);cleanups.push(again);trigger.click();expect(backdrop.hidden).toBe(false);
});
test('removing an open modal releases scroll lock and listeners without resurrecting the removed node',async()=>{
  const {backdrop,trigger}=fixture();trigger.focus();trigger.click();backdrop.remove();
  await new Promise((resolve)=>setTimeout(resolve,0));
  expect(document.body.style.overflow).not.toBe('hidden');expect(backdrop.isConnected).toBe(false);expect(document.activeElement === trigger).toBe(true);
});
test('an inner popover owns Escape before its parent dialog, and restores focus to its anchor',()=>{
  const {backdrop,trigger}=fixture();trigger.click();const anchor=backdrop.querySelector<HTMLElement>('.first')!;
  const pop=document.createElement('div'),input=document.createElement('input');pop.hidden=true;pop.append(input);backdrop.querySelector('.icen-modal')!.append(pop);cleanups.push(()=>closePopover(pop));
  openPopover(pop,{anchor,initialFocus:input});expect(document.activeElement === input).toBe(true);
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(pop.hidden).toBe(true);expect(backdrop.hidden).toBe(false);expect(document.activeElement === anchor).toBe(true);
  anchor.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(backdrop.hidden).toBe(true);
});
