import {afterEach,expect,test} from 'bun:test';
import {createCascader} from '../../src/behaviors/cascader';
import {createTreeSelect} from '../../src/behaviors/tree-select';
const cleanups:(()=>void)[]=[];
afterEach(()=>cleanups.splice(0).reverse().forEach((cleanup)=>cleanup()));
function host(){const el=document.createElement('div');document.body.append(el);cleanups.push(()=>el.remove());return el;}
function key(el:Element,key:string,extra:KeyboardEventInit={}){el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,...extra}));}
const nodes=[{value:'root',label:'Root',children:[{value:'disabled',label:'Item disabled',disabled:true},{value:'a',label:'Item A'},{value:'b',label:'Item B'}]}];

test('cascader search exposes one active descendant, skips disabled paths, preserves IME and clears before closing',()=>{
  const el=host(),handle=createCascader(el,{options:nodes,searchable:true});cleanups.push(()=>handle.destroy());handle.open();
  const panel=document.querySelector<HTMLElement>('.icen-cascader-panel')!,input=panel.querySelector<HTMLInputElement>('input')!;
  input.value='Item';input.dispatchEvent(new InputEvent('input',{bubbles:true}));
  const results=panel.querySelectorAll<HTMLElement>('[role="option"]');
  expect(panel.querySelector('.icen-cascader-result.is-disabled')!.getAttribute('aria-disabled')).toBe('true');
  key(input,'ArrowDown');expect(document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent).toContain('Item A');
  expect(document.activeElement).toBe(input);
  key(input,'Enter',{isComposing:true});expect(handle.getValue()).toEqual([]);
  input.value='Nothing';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
  expect(panel.querySelectorAll('.icen-cascader-result').length).toBe(3);
  input.dispatchEvent(new Event('compositionend',{bubbles:true}));expect(panel.querySelectorAll('.icen-cascader-result').length).toBe(0);
  key(input,'Escape');expect(input.value).toBe('');expect(panel.hidden).toBe(false);expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  key(input,'Tab');expect(panel.hidden).toBe(true);expect(document.activeElement).toBe(el.querySelector('button'));
  expect(results.length).toBeGreaterThan(0);
});

test('cascader blank search enters the first enabled column item and caret arrows never drill into branches',()=>{
  const el=host(),handle=createCascader(el,{options:[{value:'no',label:'Disabled',disabled:true},...nodes],searchable:true});cleanups.push(()=>handle.destroy());handle.open();
  const panel=document.querySelector<HTMLElement>('.icen-cascader-panel')!,input=panel.querySelector<HTMLInputElement>('input')!;
  key(input,'ArrowRight');expect(panel.querySelectorAll('.icen-cascader-col').length).toBe(1);expect(document.activeElement).toBe(input);
  key(input,'ArrowDown');expect((document.activeElement as HTMLElement).dataset.icenValue).toBe('root');
  key(document.activeElement!,'ArrowRight');expect((document.activeElement as HTMLElement).dataset.icenValue).toBe('a');
  key(document.activeElement!,'End');expect((document.activeElement as HTMLElement).dataset.icenValue).toBe('b');
});

test('tree search enters first or last enabled row, retains focus after multiselection, and exits through the trigger',()=>{
  const el=host(),handle=createTreeSelect(el,{nodes,searchable:true,multiple:true});cleanups.push(()=>handle.destroy());handle.open();
  const panel=document.querySelector<HTMLElement>('.icen-tree-select-panel')!,input=panel.querySelector<HTMLInputElement>('input')!;
  key(input,'ArrowDown');expect((document.activeElement as HTMLElement).dataset.icenValue).toBe('root');
  key(document.activeElement!,'Enter');expect(handle.getValue()).toEqual(['root']);expect((document.activeElement as HTMLElement).dataset.icenValue).toBe('root');
  key(document.activeElement!,'ArrowRight');key(document.activeElement!,'ArrowRight');
  expect((document.activeElement as HTMLElement).dataset.icenValue).toBe('a');
  key(document.activeElement!,'End');expect((document.activeElement as HTMLElement).dataset.icenValue).toBe('b');
  key(document.activeElement!,'Home');expect((document.activeElement as HTMLElement).dataset.icenValue).toBe('root');
  key(document.activeElement!,'Tab');expect(panel.hidden).toBe(true);expect(document.activeElement).toBe(el.querySelector('button'));
});

test('empty trees announce their state and all-disabled searches never focus an unavailable row',()=>{
  const el=host(),handle=createTreeSelect(el,{nodes:[],searchable:true});cleanups.push(()=>handle.destroy());handle.open();
  let panel=document.querySelector<HTMLElement>('.icen-tree-select-panel')!;
  expect(panel.querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(false);
  expect(panel.querySelector<HTMLElement>('[role="tree"]')!.hidden).toBe(true);
  handle.destroy();
  const next=createTreeSelect(el,{nodes:[{value:'no',label:'Unavailable',disabled:true}],searchable:true});cleanups.push(()=>next.destroy());next.open();
  panel=document.querySelector<HTMLElement>('.icen-tree-select-panel')!;const input=panel.querySelector<HTMLInputElement>('input')!;
  key(input,'ArrowDown');expect(document.activeElement).toBe(input);expect(panel.querySelector('.is-focused')).toBeNull();
});

test('a partially unavailable subtree can be selected and deselected symmetrically without selecting disabled descendants',()=>{
  const el=host(),handle=createTreeSelect(el,{nodes,multiple:true,checkable:true});cleanups.push(()=>handle.destroy());handle.open();
  const panel=document.querySelector<HTMLElement>('.icen-tree-select-panel')!;
  key(document.activeElement!,'Enter');expect(handle.getValue()).toEqual(['root','a','b']);
  expect(panel.querySelector('[data-icen-value="root"]')!.getAttribute('aria-checked')).toBe('mixed');
  key(document.activeElement!,'Enter');expect(handle.getValue()).toEqual([]);
  handle.destroy();handle.open();expect(document.querySelector('.icen-tree-select-panel')).toBeNull();
});
