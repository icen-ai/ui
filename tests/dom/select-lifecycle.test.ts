import {afterEach,expect,test} from 'bun:test';
import {initSelect,refreshSelect} from '../../src/behaviors/select';
const cleanups:(()=>void)[]=[];
afterEach(()=>cleanups.splice(0).forEach((fn)=>fn()));
function mount(attrs='') {
  const root=document.createElement('div');root.className='icen-select';root.setAttribute('data-icen-select','');
  root.innerHTML='<button class="icen-select-trigger"><span class="icen-select-value is-empty">Fruit</span></button><div class="icen-select-panel" hidden><button class="icen-select-option" data-icen-value="a">Apple</button><button class="icen-select-option" data-icen-value="b">Banana</button><button class="icen-select-option" data-icen-value="bb">Blueberry</button><button class="icen-select-option is-disabled" data-icen-value="c">Cherry</button></div><input type="hidden" data-icen-select-value>';
  for(const attr of attrs.split(' ').filter(Boolean))root.setAttribute(attr,'');
  document.body.append(root);cleanups.push(()=>root.remove());
  return root;
}
function key(el:Element,key:string,extra:KeyboardEventInit={}) { el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,...extra})); }
const tick=()=>new Promise((resolve)=>setTimeout(resolve,0));

test('search combobox lives outside its listbox and announces the focused result without moving the caret',()=>{
  const root=mount('data-icen-select-search');cleanups.push(initSelect(root));
  const trigger=root.querySelector<HTMLButtonElement>('.icen-select-trigger')!;trigger.click();
  const panel=document.querySelector<HTMLElement>('.icen-select-panel')!,input=panel.querySelector<HTMLInputElement>('input')!;
  const list=panel.querySelector('[role="listbox"]')!;
  expect(list.contains(input)).toBe(false);expect(input.getAttribute('aria-controls')).toBe(list.id);
  input.value='b';input.dispatchEvent(new InputEvent('input',{bubbles:true}));
  expect(panel.querySelector<HTMLElement>('[data-icen-value="a"]')!.hidden).toBe(true);
  key(input,'ArrowDown');expect(document.activeElement).toBe(input);
  expect(document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent).toBe('Blueberry');
  key(input,'Enter',{isComposing:true});expect(root.querySelector<HTMLInputElement>('input')!.value).toBe('');
  key(input,'Enter');expect(root.querySelector<HTMLInputElement>('input')!.value).toBe('bb');expect(document.activeElement).toBe(trigger);
});
test('search Escape clears before closing; Tab exits from the field position and IME filtering waits for commit',()=>{
  const root=mount('data-icen-select-search');cleanups.push(initSelect(root));root.querySelector<HTMLButtonElement>('button')!.click();
  const panel=document.querySelector<HTMLElement>('.icen-select-panel')!,input=panel.querySelector<HTMLInputElement>('input')!;
  input.value='no match';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
  expect(panel.querySelector<HTMLElement>('[data-icen-value="a"]')!.hidden).toBe(false);
  input.dispatchEvent(new Event('compositionend',{bubbles:true}));expect(panel.querySelector<HTMLElement>('[role="listbox"]')!.hidden).toBe(true);
  key(input,'Escape');expect(input.value).toBe('');expect(panel.hidden).toBe(false);
  key(input,'Escape');expect(panel.hidden).toBe(true);
  root.querySelector<HTMLButtonElement>('button')!.click();key(input,'Tab');expect(panel.hidden).toBe(true);expect(document.activeElement).toBe(root.querySelector('button'));
});
test('Home/End, typeahead and disabled skipping work without committing until Enter',()=>{
  const root=mount();cleanups.push(initSelect(root));const trigger=root.querySelector<HTMLButtonElement>('button')!;
  key(trigger,'b');expect(document.activeElement?.textContent).toBe('Banana');
  key(document.activeElement!,'l');expect(document.activeElement?.textContent).toBe('Blueberry');
  key(document.activeElement!,'Home');expect(document.activeElement?.textContent).toBe('Apple');
  key(document.activeElement!,'End');expect(document.activeElement?.textContent).toBe('Blueberry');
  expect(root.querySelector<HTMLInputElement>('input')!.value).toBe('');key(document.activeElement!,'Enter');expect(root.querySelector<HTMLInputElement>('input')!.value).toBe('bb');
});
test('native initial values, dynamic labels/options and explicit refresh stay silent and update form state',async()=>{
  const root=mount();root.querySelector<HTMLInputElement>('input')!.value='b';let changes=0;root.addEventListener('icen:select-change',()=>changes++);
  cleanups.push(initSelect(root));expect(root.querySelector('.icen-select-value')?.textContent).toBe('Banana');
  const panel=root.querySelector<HTMLElement>('.icen-select-panel')!;
  panel.querySelector('[data-icen-value="b"]')!.textContent='Banana updated';await tick();expect(root.querySelector('.icen-select-value')?.textContent).toBe('Banana updated');
  const fresh=document.createElement('button');fresh.className='icen-select-option';fresh.dataset.icenValue='d';fresh.textContent='Dragonfruit';panel.append(fresh);await tick();
  expect(fresh.getAttribute('role')).toBe('option');expect(fresh.closest('[role="listbox"]')).not.toBeNull();
  panel.querySelector('.is-selected')!.classList.remove('is-selected');fresh.classList.add('is-selected');refreshSelect(root);
  expect(root.querySelector<HTMLInputElement>('input')!.value).toBe('d');expect(changes).toBe(0);
});
test('destroy/re-init clears transient limits, repeated init does not duplicate change events or leave a portal',()=>{
  const root=mount('data-icen-select-multiple');root.setAttribute('data-icen-select-max','1');
  const first=initSelect(root);root.querySelector<HTMLButtonElement>('button')!.click();
  const panel=document.querySelector<HTMLElement>('.icen-select-panel')!;panel.querySelector<HTMLButtonElement>('[data-icen-value="a"]')!.click();first();
  const second=initSelect(root);cleanups.push(second);initSelect(root);let count=0;root.addEventListener('icen:select-change',()=>count++);
  root.querySelector<HTMLButtonElement>('.icen-select-chip-x')!.click();
  expect(panel.querySelector('[data-icen-value="b"]')?.classList.contains('is-disabled')).toBe(false);
  expect(panel.querySelector('[data-icen-value="c"]')?.classList.contains('is-disabled')).toBe(true);expect(count).toBe(1);
  second();expect(panel.parentElement).toBe(root);
});
