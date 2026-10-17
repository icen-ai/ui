import {afterEach, expect, test} from 'bun:test';
import {createTagInput, initTagInput, type TagInputOptions} from '../../src/behaviors/tag-input';
const cleanup: (() => void)[] = [];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture(options: TagInputOptions = {}, raw = '设计,前端') {
  const form = document.createElement('form'), root = document.createElement('div'), field = document.createElement('input');
  root.className = 'icen-tag-input'; root.dataset.icenTags = raw; field.className = 'icen-tag-input-field'; field.name = 'topics'; field.placeholder = '添加方向'; field.required = true;
  root.append(field); form.append(root); document.body.append(form);
  const handle = createTagInput(root, options); cleanup.push(() => handle.destroy());
  return {form, root, field, handle};
}
function key(target: HTMLElement, name: string, extra: KeyboardEventInit = {}) {target.dispatchEvent(new KeyboardEvent('keydown', {key: name, bubbles: true, cancelable: true, ...extra}));}
afterEach(() => {cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren();});

test('tag edits preserve unaffected nodes, native repeated values and input/change events', async () => {
  const {root, field, form, handle} = fixture(); const first = root.querySelector('.icen-tag-chip')!;
  let input = 0, change = 0, tags = 0; root.addEventListener('input', () => input++); root.addEventListener('change', () => change++); root.addEventListener('icen:tags-change', () => tags++);
  field.value = '插画'; key(field, 'Enter'); await tick();
  expect(handle.getValue()).toEqual(['设计','前端','插画']); expect(root.querySelector('.icen-tag-chip') === first).toBe(true);
  expect(new FormData(form).getAll('topics')).toEqual(['设计','前端','插画']); expect(field.hasAttribute('name')).toBe(false);
  expect([input, change, tags]).toEqual([1,1,1]); expect(field.required).toBe(false);
  handle.setValue([]); expect(field.required).toBe(true); expect(field.placeholder).toBe('添加方向'); expect(new FormData(form).getAll('topics')).toEqual([]);
});

test('keyboard removal restores a neighbouring action and native editing remains available', () => {
  const {root, field, handle} = fixture(); field.focus(); field.setSelectionRange(0,0); key(field,'ArrowLeft');
  const last = root.querySelectorAll<HTMLButtonElement>('.icen-tag-chip-x')[1]; expect(document.activeElement === last).toBe(true);
  key(last,'Delete'); expect(handle.getValue()).toEqual(['设计']); expect(document.activeElement === root.querySelector('.icen-tag-chip-x')).toBe(true);
  key(root.querySelector<HTMLButtonElement>('.icen-tag-chip-x')!,'Escape'); expect(document.activeElement === field).toBe(true);
  key(field,'Backspace'); expect(handle.getValue()).toEqual([]); expect(document.activeElement === field).toBe(true);
});

test('duplicates and capacity retain rejected drafts with clear feedback; dynamic limits do not discard existing values', async () => {
  const {root, field, handle} = fixture({max:2}); field.value = '设计'; key(field,'Enter');
  expect(field.value).toBe('设计'); expect(field.getAttribute('aria-invalid')).toBe('true'); expect(root.nextElementSibling?.textContent).toContain('已有');
  root.dataset.icenMax = '4'; handle.update({max:undefined}); await tick(); field.value = '插画,排版,摄影'; key(field,'Enter');
  expect(handle.getValue()).toEqual(['设计','前端','插画','排版']); expect(field.value).toBe('摄影'); expect(root.nextElementSibling?.textContent).toContain('最多 4');
  root.dataset.icenMax = '1'; await tick(); expect(handle.getValue().length).toBe(4);
  handle.update({allowDuplicates:true,max:0}); field.value = '设计'; key(field,'Enter'); expect(handle.getValue().filter(value => value === '设计').length).toBe(2);
});

test('JSON values stay safe, external data and handles agree, and silent updates emit nothing', async () => {
  const {root, handle} = fixture({}, '["a,b","<img src=x>","a,b"]'); expect(handle.getValue()).toEqual(['a,b','<img src=x>']); expect(root.querySelector('img') === null).toBe(true);
  let changes = 0; root.addEventListener('icen:tags-change', () => changes++);
  handle.setValue(['保留'], {emit:false}); expect(changes).toBe(0);
  root.dataset.icenTags = '["外部","写入"]'; await tick(); expect(handle.getValue()).toEqual(['外部','写入']); expect(changes).toBe(1);
  const snapshot = handle.getValue(); snapshot.push('污染'); expect(handle.getValue()).toEqual(['外部','写入']);
});

test('IME and keyCode 229 never submit or delete during native composition', () => {
  const {field, handle} = fixture(); field.value = '中文'; field.dispatchEvent(new CompositionEvent('compositionstart'));
  key(field,'Enter'); key(field,','); expect(handle.getValue().length).toBe(2);
  field.dispatchEvent(new CompositionEvent('compositionend')); key(field,'Enter',{keyCode:229}); expect(handle.getValue().length).toBe(2);
  key(field,'Enter'); expect(handle.getValue()).toEqual(['设计','前端','中文']);
});

test('read-only and ancestor disabled state gate every mutation and native form inclusion', async () => {
  const {root, field, form, handle} = fixture({readOnly:true}); field.value = '不得添加'; key(field,'Enter');
  expect(handle.getValue().length).toBe(2); expect(root.querySelector<HTMLButtonElement>('button')!.hidden).toBe(true);
  expect(new FormData(form).getAll('topics')).toEqual(['设计','前端']);
  handle.update({readOnly:false}); form.setAttribute('aria-disabled','true'); await tick();
  expect(field.disabled).toBe(true); expect(root.getAttribute('aria-disabled')).toBe('true'); expect(new FormData(form).getAll('topics')).toEqual([]);
  form.removeAttribute('aria-disabled'); await tick(); expect(field.disabled).toBe(false); expect(root.getAttribute('aria-disabled')).toBe('false');
  field.readOnly = true; await tick(); key(field,'Enter'); expect(handle.getValue().length).toBe(2);
});

test('reset restores initial tags and draft, respects prevention and never runs after teardown', async () => {
  const {form, field, handle} = fixture(); handle.setValue(['新值']); field.value = '草稿';
  const cancel = (event: Event) => event.preventDefault(); form.addEventListener('reset',cancel); form.reset(); await tick(); expect(handle.getValue()).toEqual(['新值']);
  form.removeEventListener('reset',cancel); form.reset(); await tick(); expect(handle.getValue()).toEqual(['设计','前端']); expect(field.value).toBe('');
  handle.destroy(); expect(field.name).toBe('topics'); expect(field.required).toBe(true); expect(field.getAttribute('aria-describedby')).toBeNull();
  form.reset(); await tick(); expect(field.parentElement!.querySelectorAll('.icen-tag-chip').length).toBe(0);
});

test('scoped and explicit lifecycles share one instance, with real repeated and stale disposers', () => {
  const host = document.createElement('div'), root = document.createElement('div'), field = document.createElement('input');
  root.className = 'icen-tag-input'; field.className = 'icen-tag-input-field'; root.append(field); host.append(root); document.body.append(host);
  const local = initTagInput(host), global = initTagInput(); cleanup.push(global,local);
  expect(initTagInput(host) === local).toBe(true); const handle = createTagInput(root); cleanup.push(() => handle.destroy());
  handle.setValue(['一个']); local(); global(); expect(root.querySelectorAll('.icen-tag-chip').length).toBe(1);
  handle.destroy(); const next = initTagInput(host); cleanup.push(next); local(); field.value = '继续'; key(field,'Enter'); expect(root.dataset.icenTags).toBe('一个,继续');
});

test('dynamic late fields initialize once and unmount releases generated nodes and form ownership', async () => {
  const host = document.createElement('div'), root = document.createElement('div'); root.className = 'icen-tag-input'; host.append(root); document.body.append(host);
  const dispose = initTagInput(host); cleanup.push(dispose); const field = document.createElement('input'); field.className = 'icen-tag-input-field'; field.name = 'tags'; root.append(field); await tick();
  field.value = '新插入'; key(field,'Enter'); expect(root.querySelectorAll('.icen-tag-chip').length).toBe(1);
  host.remove(); await tick(); expect(root.querySelectorAll('.icen-tag-chip').length).toBe(0); expect(field.name).toBe('tags');
});

test('moving a live editor rebinds native form ownership, disabled ancestors and the feedback anchor', async () => {
  const {root, field, form, handle} = fixture(); const next = document.createElement('form'), container = document.createElement('div');
  next.append(container); document.body.append(next); container.append(root); await tick();
  expect(field.form === next).toBe(true); expect(root.nextElementSibling?.getAttribute('role')).toBe('status');
  container.setAttribute('aria-disabled','true'); await tick(); expect(field.disabled).toBe(true);
  container.removeAttribute('aria-disabled'); await tick(); expect(field.disabled).toBe(false);
  handle.setValue(['新表单']); form.reset(); await tick(); expect(handle.getValue()).toEqual(['新表单']);
  next.reset(); await tick(); expect(handle.getValue()).toEqual(['设计','前端']); expect(new FormData(next).getAll('topics')).toEqual(['设计','前端']);
});

test('native form submission commits accepted drafts and blocks unresolved duplicates', () => {
  const {form, field, handle} = fixture(); field.value = '摄影'; const accepted = new Event('submit',{bubbles:true,cancelable:true}); form.dispatchEvent(accepted);
  expect(accepted.defaultPrevented).toBe(false); expect(handle.getValue()).toEqual(['设计','前端','摄影']); expect(field.value).toBe('');
  field.value = '摄影'; const duplicate = new Event('submit',{bubbles:true,cancelable:true}); form.dispatchEvent(duplicate);
  expect(duplicate.defaultPrevented).toBe(true); expect(field.value).toBe('摄影'); expect(document.activeElement === field).toBe(true);
});
