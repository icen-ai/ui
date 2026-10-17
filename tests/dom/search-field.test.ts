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
