import { expect, test } from 'bun:test';
import { initSelect } from '../../src/behaviors/select';
import { FOCUSABLE } from '../../src/behaviors/modal';

test('native hidden input receives selected value and change event',()=>{
  const root=document.createElement('div');root.className='icen-select';root.setAttribute('data-icen-select','');
  const trigger=document.createElement('button');trigger.className='icen-select-trigger';
  const label=document.createElement('span');label.className='icen-select-value';trigger.append(label);
  const panel=document.createElement('div');panel.className='icen-select-panel';panel.hidden=true;
  const option=document.createElement('button');option.className='icen-select-option';option.setAttribute('data-icen-value','pixel');option.textContent='像素';panel.append(option);
  const input=document.createElement('input');input.type='hidden';input.setAttribute('data-icen-select-value','');
  root.append(trigger,panel,input);document.body.append(root);
  let changes=0;input.addEventListener('change',()=>changes++);
  const dispose=initSelect(root);trigger.click();option.click();
  expect(input.value).toBe('pixel');expect(changes).toBe(1);
  dispose();root.remove();
});
test('dialog focus contract includes native form controls and excludes hidden inputs',()=>{
  const input=document.createElement('input');expect(input.matches(FOCUSABLE)).toBe(true);
  input.type='hidden';expect(input.matches(FOCUSABLE)).toBe(false);
  expect(document.createElement('textarea').matches(FOCUSABLE)).toBe(true);
  expect(document.createElement('select').matches(FOCUSABLE)).toBe(true);
});
