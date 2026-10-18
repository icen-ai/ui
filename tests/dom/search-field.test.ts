import {expect,test} from 'bun:test';
import {enhanceSearchField} from '../../src/behaviors/input';

test('search clear is a single labelled SVG action with native input semantics and symmetric cleanup',async()=>{
  const host=document.createElement('div'),input=document.createElement('input');
  input.type='search';input.value='Query';host.append(input);document.body.append(host);
  const handle=enhanceSearchField(input);
  try {
    expect(enhanceSearchField(input)).toBe(handle);
    const clear=host.querySelector<HTMLButtonElement>('button')!;
    expect(host.querySelectorAll('button').length).toBe(1);
    expect(clear.querySelector('svg')).not.toBeNull();expect(clear.getAttribute('aria-label')).toBeTruthy();
    let events=0;input.addEventListener('input',()=>events++);
    clear.click();expect(input.value).toBe('');expect(events).toBe(1);
    expect(clear.hidden).toBe(true);expect(document.activeElement).toBe(input);
    input.value='Again';handle.refresh();expect(clear.hidden).toBe(false);
    input.readOnly=true;await new Promise((resolve)=>setTimeout(resolve,0));expect(clear.hidden).toBe(true);
    clear.click();expect(input.value).toBe('Again');expect(events).toBe(1);
    input.readOnly=false;input.disabled=true;handle.refresh();expect(clear.hidden).toBe(true);
    input.disabled=false;handle.refresh();expect(clear.hidden).toBe(false);
    handle.destroy();expect(host.querySelector('button')).toBeNull();expect(host.classList.contains('icen-search-field')).toBe(false);
    const next=enhanceSearchField(input);handle.destroy();expect(host.querySelectorAll('button').length).toBe(1);
    next.destroy();expect(input.classList.contains('icen-search-input')).toBe(false);
  } finally {handle.destroy();host.remove();}
});

test('enhancement keeps the original field, draft selection and sibling order across teardown',()=>{
  const host=document.createElement('div'),before=document.createElement('span'),input=document.createElement('input'),after=document.createElement('span');
  input.value='仍在编辑的草稿';host.append(before,input,after);document.body.append(host);input.focus();input.setSelectionRange(1,4);
  const handle=enhanceSearchField(input);
  try{
    expect(document.activeElement===input).toBe(true);expect(input.value).toBe('仍在编辑的草稿');expect([input.selectionStart,input.selectionEnd]).toEqual([1,4]);
    handle.destroy();expect(Array.from(host.childNodes).map(n=>n===before?'before':n===input?'input':n===after?'after':'extra')).toEqual(['before','input','after']);
    expect(document.activeElement===input).toBe(true);expect(input.value).toBe('仍在编辑的草稿');
  }finally{handle.destroy();host.remove()}
});
