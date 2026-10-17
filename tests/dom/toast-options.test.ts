import {afterEach,expect,test} from 'bun:test';
import {toast} from '../../src/behaviors/toast';
afterEach(()=>toast.dismiss());
test('documented toast options reach the renderer through both callable and named APIs',()=>{
  const first=toast('Saved','success',{ms:5000,closable:true,progress:true});
  const row=document.querySelector<HTMLElement>('.icen-toast')!;
  expect(row.querySelector('button svg')?.getAttribute('viewBox')).toBe('0 0 20 20');
  expect(row.querySelector<HTMLElement>('.icen-toast-progress-fill')?.style.animationDuration).toBe('5000ms');
  first.dismiss();expect(row.classList.contains('is-leaving')).toBe(true);
  toast.info('Updated',{closable:true,ms:5000});expect(document.querySelectorAll('.icen-toast-close').length).toBe(2);
});
test('action helpers accept the same options while retaining synchronous false callbacks',()=>{
  let calls=0;toast.action('Removed','Undo',()=>{calls++;return false;},{closable:true,ms:5000});
  const row=document.querySelector<HTMLElement>('.icen-toast')!;
  row.querySelector<HTMLButtonElement>('.icen-toast-action')!.click();
  expect(calls).toBe(1);expect(row.classList.contains('is-leaving')).toBe(false);
  row.querySelector<HTMLButtonElement>('.icen-toast-close')!.click();expect(row.classList.contains('is-leaving')).toBe(true);
});
