import {afterEach,expect,test} from 'bun:test';
import {initDatePicker} from '../../src/behaviors/date-picker';
const disposers:(()=>void)[]=[];
const tick=()=>new Promise((resolve)=>setTimeout(resolve,0));
function fixture(value='2026-01-31',min='',max=''){
  const form=document.createElement('form'),root=document.createElement('div');root.className='icen-date-picker';root.dataset.icenDatePicker='';root.dataset.icenDatePickerMin=min;root.dataset.icenDatePickerMax=max;
  const input=document.createElement('input');input.type='hidden';input.name='date';input.defaultValue=value;root.append(input);const fieldset=document.createElement('fieldset');fieldset.append(root);form.append(fieldset);document.body.append(form);
  const dispose=initDatePicker(root);disposers.push(dispose);const trigger=root.querySelector<HTMLButtonElement>('button')!;
  return {form,fieldset,root,input,trigger,dispose};
}
const panel=()=>document.querySelector<HTMLElement>('.icen-date-picker-panel')!;
function key(name:string,shiftKey=false){document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:name,shiftKey,bubbles:true,cancelable:true}));}
const focused=()=>document.activeElement?.getAttribute('data-icen-date');
afterEach(()=>{disposers.splice(0).forEach((fn)=>fn());document.body.replaceChildren();});

test('strict dates reject overflow while early years and leap days keep their actual native value',()=>{
  const bad=fixture('2026-02-31');expect(bad.trigger.getAttribute('aria-invalid')).toBe('true');expect(bad.input.value).toBe('2026-02-31');
  bad.trigger.click();expect(panel().querySelector('[aria-selected="true"]')).toBeNull();bad.dispose();
  const early=fixture('0099-02-28');expect(early.trigger.textContent).toBe('0099-02-28');early.trigger.click();expect(focused()).toBe('0099-02-28');early.dispose();
  const leap=fixture('2024-02-29');leap.trigger.click();expect(focused()).toBe('2024-02-29');expect(panel().querySelectorAll('[role="row"]').length).toBe(6);
});

test('date grid has one tab stop and continuous day, week, month and year keyboard navigation',()=>{
  const {trigger}=fixture();trigger.click();expect(focused()).toBe('2026-01-31');
  expect(panel().querySelectorAll('.icen-date-picker-cell[tabindex="0"]').length).toBe(1);
  key('PageDown');expect(focused()).toBe('2026-02-28');key('Home');expect(focused()).toBe('2026-02-23');key('End');expect(focused()).toBe('2026-03-01');
  key('ArrowDown');expect(focused()).toBe('2026-03-08');key('PageUp',true);expect(focused()).toBe('2025-03-08');key('ArrowLeft');expect(focused()).toBe('2025-03-07');
  key('Escape');expect(panel()).toBeNull();expect(document.activeElement === trigger).toBe(true);expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

test('range guards include today and month navigation; committing and clearing emit native changes exactly once',()=>{
  const {root,input,trigger}=fixture('2000-02-15','2000-02-10','2000-02-20');let native=0,domain=0;
  input.addEventListener('change',()=>native++);root.addEventListener('icen:date-change',()=>domain++);trigger.click();
  expect(panel().querySelector<HTMLButtonElement>('.icen-date-picker-today')!.disabled).toBe(true);
  expect([...panel().querySelectorAll<HTMLButtonElement>('.icen-date-picker-nav')].every((b)=>b.disabled)).toBe(true);
  key('Home');expect(focused()).toBe('2000-02-14');key('ArrowUp');expect(focused()).toBe('2000-02-10');
  panel().querySelector<HTMLButtonElement>('[data-icen-date="2000-02-19"]')!.click();expect(input.value).toBe('2000-02-19');expect(native).toBe(1);expect(domain).toBe(1);
  trigger.click();panel().querySelector<HTMLButtonElement>('.icen-date-picker-clear')!.click();expect(input.value).toBe('');expect(native).toBe(2);expect(domain).toBe(2);
});

test('external native changes and form reset repaint value and synchronize an open calendar',async()=>{
  const {form,input,trigger}=fixture('2026-11-09');input.value='2026-12-21';input.dispatchEvent(new Event('change',{bubbles:true}));expect(trigger.textContent).toBe('2026-12-21');
  trigger.click();expect(focused()).toBe('2026-12-21');form.reset();await tick();expect(trigger.textContent).toBe('2026-11-09');expect(focused()).toBe('2026-11-09');
});

test('disabled input and removed trigger release the portal; reinitialization and repeated disposers do not duplicate work',async()=>{
  const first=fixture(),again=initDatePicker(first.root);first.trigger.click();again();expect(panel()).toBeNull();expect(first.root.querySelector('button')).toBeNull();
  const next=initDatePicker(first.root);disposers.push(next);const trigger=first.root.querySelector<HTMLButtonElement>('button')!;trigger.click();first.dispose();expect(panel()).not.toBeNull();
  first.input.disabled=true;await tick();expect(panel()).toBeNull();first.input.disabled=false;await tick();trigger.click();first.root.remove();await tick();expect(panel()).toBeNull();
});

test('invalid ranges have an honest empty state and constraints can change while open',async()=>{
  const {root,trigger}=fixture('2026-11-09','2026-12-01','2026-11-01');trigger.click();
  expect(panel().querySelector('[role="status"]')?.textContent).toBe('没有可选日期');expect(panel().querySelectorAll('.icen-date-picker-cell:not(:disabled)').length).toBe(0);
  root.dataset.icenDatePickerMin='2026-11-01';root.dataset.icenDatePickerMax='2026-11-30';await tick();expect(panel().querySelector('[role="status"]')).toBeNull();expect(focused()).toBe('2026-11-09');
});

test('RTL day arrows follow the visual grid, and month buttons retain a meaningful focus after repaint',()=>{
  const {root,trigger}=fixture('2026-11-09');root.style.direction='rtl';trigger.click();key('ArrowLeft');expect(focused()).toBe('2026-11-10');key('ArrowRight');expect(focused()).toBe('2026-11-09');
  panel().querySelector<HTMLButtonElement>('[data-icen-date-nav="next"]')!.click();expect(document.activeElement?.getAttribute('data-icen-date-nav')).toBe('next');
  expect(panel().querySelector('.icen-date-picker-title')?.textContent).toBe('2026 年 12 月');
});

test('canceled resets preserve the value and an inherited disabled fieldset releases the calendar',async()=>{
  const {form,fieldset,input,trigger}=fixture();input.value='2026-12-21';input.dispatchEvent(new Event('change'));
  form.addEventListener('reset',(event)=>event.preventDefault(),{once:true});form.reset();await tick();expect(input.value).toBe('2026-12-21');
  trigger.click();expect(Boolean(panel())).toBe(true);fieldset.disabled=true;await tick();expect(panel() === null).toBe(true);expect(trigger.getAttribute('aria-disabled')).toBe('true');
});

test('open calendar consumes live panel sizing, formatting and local direction without losing the date focus',async()=>{
  const {root,trigger}=fixture();trigger.click();root.dataset.icenPanelWidth='350';root.dataset.icenDatePickerFormat='yyyy/mm/dd';root.style.direction='rtl';await tick();
  expect(panel().style.width).toBe('350px');expect(panel().dir).toBe('rtl');expect(trigger.textContent).toBe('2026/01/31');expect(focused()).toBe('2026-01-31');
});
