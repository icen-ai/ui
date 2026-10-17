import {afterEach,expect,test} from 'bun:test';
import {initDropdown,openDropdown,closeDropdown} from '../../src/behaviors/dropdown';
import {openContextMenu,closeContextMenu,initContextMenu} from '../../src/behaviors/context-menu';
import {openPopover,closePopover} from '../../src/behaviors/popover';
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).reverse().forEach((fn)=>fn());closeDropdown(false);closeContextMenu();});
function fixture(){
  const host=document.createElement('div');host.innerHTML='<form><div data-icen-dropdown><button data-icen-dropdown-trigger>Actions</button><div data-icen-dropdown-menu hidden><button class="icen-menu-item"><span class="icen-menu-item-label">Apple</span></button><button class="icen-menu-item" aria-disabled="true">Unavailable</button><button class="icen-menu-item"><span class="icen-menu-item-label">Banana</span></button><button class="icen-menu-item"><span class="icen-menu-item-label">Blueberry</span></button></div></div></form>';
  document.body.append(host);cleanups.push(()=>host.remove());const dispose=initDropdown(host);cleanups.push(dispose);
  return {host,dispose,trigger:host.querySelector<HTMLButtonElement>('[data-icen-dropdown-trigger]')!};
}
function key(el:Element,key:string,extra:KeyboardEventInit={}){el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,...extra}));}

test('dropdown uses real roving focus, first/last opening, typeahead, disabled skipping and one native activation',()=>{
  const {host,trigger}=fixture();expect(trigger.type).toBe('button');
  let changes=0,clicks=0;document.addEventListener('icen:menu-select',()=>changes++,{once:true});
  host.querySelectorAll('button')[3].addEventListener('click',()=>clicks++);
  key(trigger,'ArrowUp');expect(document.activeElement?.textContent).toBe('Blueberry');
  key(document.activeElement!,'Home');expect(document.activeElement?.textContent).toBe('Apple');
  key(document.activeElement!,'b');expect(document.activeElement?.textContent).toBe('Banana');
  key(document.activeElement!,'Enter');expect(changes).toBe(1);expect(clicks).toBe(1);expect(document.activeElement).toBe(trigger);
  trigger.click();key(document.activeElement!,'ArrowDown');expect(document.activeElement?.textContent).toBe('Banana');
  key(document.activeElement!,'Escape',{isComposing:true});expect(trigger.getAttribute('aria-expanded')).toBe('true');
  key(document.activeElement!,'Tab');expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

test('disabled clicks never invoke host actions, repeated init retains open state, disposal restores nodes and supports re-init',()=>{
  const {host,trigger,dispose}=fixture();const disabled=host.querySelector<HTMLButtonElement>('[aria-disabled]')!;
  let clicks=0;disabled.addEventListener('click',()=>clicks++);
  trigger.click();disabled.click();expect(clicks).toBe(0);expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(initDropdown(host)).toBe(dispose);expect(trigger.getAttribute('aria-expanded')).toBe('true');
  dispose();expect(host.querySelector('[data-icen-dropdown-menu]')?.children.length).toBe(4);expect(document.querySelector('[role="menu"]')).toBeNull();
  const again=initDropdown(host);cleanups.push(again);trigger.click();expect(document.querySelector('[role="menu"]')).not.toBeNull();
});

test('programmatic open works without a delegate and preserves host-managed checkbox state and real node identity',()=>{
  const {host,trigger,dispose}=fixture();dispose();
  const item=host.querySelector<HTMLButtonElement>('.icen-menu-item')!;item.setAttribute('role','menuitemcheckbox');item.setAttribute('aria-checked','false');item.setAttribute('data-icen-menu-keep-open','');
  item.addEventListener('click',()=>item.setAttribute('aria-checked','true'));
  openDropdown(trigger);item.click();expect(item.getAttribute('aria-checked')).toBe('true');expect(trigger.getAttribute('aria-expanded')).toBe('true');
  closeDropdown();openDropdown(trigger);
  expect(document.querySelector('.icen-menu-item') === item).toBe(true);
  const cleanup=initDropdown(host);cleanup();
  expect(host.querySelector('.icen-menu-item') === item).toBe(true);expect(item.querySelector('svg')).not.toBeNull();
});

test('context menu uses named SVGs, retains callbacks and returns keyboard focus on Escape or Tab',async()=>{
  const button=document.createElement('button');button.textContent='Origin';document.body.append(button);cleanups.push(()=>button.remove());button.focus();
  const dispose=initContextMenu();cleanups.push(dispose);expect(initContextMenu()).toBe(dispose);
  let activated=0;
  openContextMenu(10,10,[{label:'Apple',iconName:'edit',onClick:()=>activated++},{label:'Disabled',disabled:true},{label:'Banana'}]);
  await new Promise((resolve)=>setTimeout(resolve,30));
  expect(document.querySelector('.icen-menu-item-icon svg')).not.toBeNull();
  key(document.activeElement!,'End');expect(document.activeElement?.textContent).toBe('Banana');
  key(document.activeElement!,'Home');key(document.activeElement!,' ',{isComposing:true});expect(activated).toBe(0);
  key(document.activeElement!,' ');expect(activated).toBe(1);expect(document.activeElement).toBe(button);
});

test('dropdown and context menus share one interaction owner when opened programmatically',()=>{
  const {trigger}=fixture();openDropdown(trigger);expect(trigger.getAttribute('aria-expanded')).toBe('true');
  openContextMenu(12,12,[{label:'Context action'}]);expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.querySelectorAll('[role="menu"]:not([aria-hidden="true"])').length).toBe(1);
  openDropdown(trigger);expect(document.querySelector('.icen-menu--context')).toBeNull();
  expect(document.querySelectorAll('[role="menu"]:not([aria-hidden="true"])').length).toBe(1);
});

test('Escape closes only the action menu and preserves an enclosing popover',()=>{
  const {host,trigger}=fixture();host.hidden=true;openPopover(host,{anchor:trigger});cleanups.push(()=>closePopover(host));
  openDropdown(trigger);key(document.activeElement!,'Escape');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(host.hidden).toBe(false);
  expect(document.activeElement === trigger).toBe(true);
});
