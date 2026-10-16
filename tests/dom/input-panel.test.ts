import { expect, test } from 'bun:test';
import { initInput } from '../../src/behaviors/input';
import { initPanel, setPanelExpanded } from '../../src/behaviors/panel';

test('default document initialization binds real password/clear inputs, masks, counters and trim once',()=>{
  const host=document.createElement('div');
  host.innerHTML='<div class="icen-input-wrap"><input class="icen-input" type="password" value="secret"><button class="icen-input-pw-toggle"></button><button class="icen-input-clear"></button></div><div class="icen-input-wrap"><input class="icen-input" data-icen-mask="###-####" data-icen-count></div><input class="icen-input" data-icen-trim value="  design  ">';
  document.body.append(host);
  initInput();initInput();
  const password=host.querySelector<HTMLInputElement>('input')!;
  const visibility=host.querySelector<HTMLButtonElement>('.icen-input-pw-toggle')!;
  expect(visibility.getAttribute('aria-label')).toBe('显示密码');
  visibility.click();expect(password.type).toBe('text');expect(visibility.getAttribute('aria-label')).toBe('隐藏密码');
  host.querySelector<HTMLButtonElement>('.icen-input-clear')!.click();expect(password.value).toBe('');
  const masked=host.querySelector<HTMLInputElement>('[data-icen-mask]')!;
  masked.value='1234567';masked.dispatchEvent(new Event('input',{bubbles:true}));expect(masked.value).toBe('123-4567');
  expect(host.querySelectorAll('.icen-input-counter')).toHaveLength(1);
  const trim=host.querySelector<HTMLInputElement>('[data-icen-trim]')!;trim.dispatchEvent(new Event('blur'));expect(trim.value).toBe('design');
  host.remove();
});
test('collapsible panel toggle is a real keyboard-compatible button; header actions stay independent and destroy is effective',()=>{
  const host=document.createElement('div');host.innerHTML='<section class="icen-panel icen-panel--collapsible"><div class="icen-panel-title"><span class="icen-panel-title-text">统计</span><button class="icen-panel-toggle"></button><button class="other">保存</button></div><div class="icen-panel-body">内容</div></section>';
  document.body.append(host);
  const dispose=initPanel(host);initPanel(host);
  const panel=host.querySelector<HTMLElement>('.icen-panel')!,toggle=host.querySelector<HTMLButtonElement>('.icen-panel-toggle')!;
  let events=0;host.addEventListener('icen:panel-toggle',()=>events++);
  toggle.click();expect(panel.classList.contains('is-collapsed')).toBe(true);expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(events).toBe(1);
  expect(toggle.getAttribute('aria-label')).toBe('展开 统计');expect(toggle.getAttribute('aria-controls')).toBe(host.querySelector('.icen-panel-body')!.id);
  host.querySelector<HTMLButtonElement>('.other')!.click();expect(events).toBe(1);
  setPanelExpanded(panel,true);expect(events).toBe(1);
  dispose();toggle.click();expect(events).toBe(1);host.remove();
});
