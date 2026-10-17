/** Tag editing with stable chip identities, native form values and shared SVG slots.
 * Markup: .icen-tag-input > input.icen-tag-input-field. data-icen-tags accepts
 * comma-separated text or a JSON string array; data-icen-max <= 0 means unlimited.
 * data-icen-duplicate=true permits duplicates. data-icen-disabled/data-icen-readonly
 * is reflected into native controls. initTagInput owns its scope; createTagInput
 * exposes an explicit handle for framework lifecycles. All text uses textContent. */
import {createIcon} from './icons';
import {emitIcen} from './events';
import {t} from './i18n';

export interface TagInputOptions {
  value?: string[];
  max?: number;
  allowDuplicates?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Repeated native form entries, one per committed tag. Defaults to input.name. */
  name?: string;
}
export interface TagInputHandle {
  getValue(): string[];
  setValue(value: string[], options?: {emit?: boolean}): void;
  update(options: Omit<TagInputOptions, 'value'>): void;
  focus(): void;
  destroy(): void;
}
interface Entry {value: string; node: HTMLSpanElement; button: HTMLButtonElement;}
interface Controller {handle: TagInputHandle; owners: Set<object>; manual: boolean;}
const controllers = new WeakMap<HTMLElement, Controller>();
const scopes = new WeakMap<ParentNode, () => void>();
let sequence = 0;
const noop: TagInputHandle = {getValue: () => [], setValue() {}, update() {}, focus() {}, destroy() {}};

function parse(raw: string): string[] {
  if (raw.trim().startsWith('[')) {
    try {const value = JSON.parse(raw); if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');} catch {}
  }
  return raw.split(',');
}
function inheritedDisabled(field: HTMLInputElement, ownRoot: HTMLElement): boolean {
  for (let parent = field.parentElement; parent; parent = parent.parentElement) {
    if (parent !== ownRoot && parent.getAttribute('aria-disabled') === 'true') return true;
    if (parent.matches('fieldset[disabled]') && !parent.querySelector(':scope > legend')?.contains(field)) return true;
  }
  return false;
}
function setup(wrap: HTMLElement, initial: TagInputOptions): Controller | null {
  const candidate = wrap.querySelector<HTMLInputElement>('input.icen-tag-input-field');
  if (!candidate) return null;
  const field: HTMLInputElement = candidate;
  let options = {...initial}, alive = true, composing = false, seenConnected = wrap.isConnected;
  let entries: Entry[] = [], serial = '', json = (wrap.dataset.icenTags ?? '').trim().startsWith('[');
  let authorDisabled = field.disabled, authorReadonly = field.readOnly, authorRequired = field.required;
  let writtenDisabled = field.disabled, writtenReadonly = field.readOnly, writtenRequired = field.required;
  const rootDisabled = wrap.getAttribute('aria-disabled');
  let authorRootDisabled = rootDisabled === 'true', writtenRootDisabled = authorRootDisabled;
  const attrs = new Map<string, string | null>();
  for (const key of ['name','placeholder','aria-label','aria-describedby','aria-required','aria-invalid','disabled','readonly','required']) attrs.set(key, field.getAttribute(key));
  const rootRole = wrap.getAttribute('role'), rootLabel = wrap.getAttribute('aria-label');
  const autoRootLabel = !rootLabel && !wrap.hasAttribute('aria-labelledby');
  const placeholder = field.placeholder, originalName = field.name, draftDefault = field.defaultValue;
  const ac = new AbortController(), owners = new Set<object>();
  const status = document.createElement('span'); status.className = 'icen-tag-input-feedback'; status.setAttribute('role','status'); status.dir = 'auto';
  do {status.id = 'icen-tags-status-' + ++sequence;} while (document.getElementById(status.id));
  const count = document.createElement('span'); count.className = 'icen-tag-input-count'; count.setAttribute('aria-hidden','true');
  const values = document.createElement('span'); values.hidden = true;
  wrap.append(count, values); wrap.after(status);
  if (!rootRole) wrap.setAttribute('role','group');
  if (!field.labels?.length && !field.hasAttribute('aria-label') && !field.hasAttribute('aria-labelledby')) field.setAttribute('aria-label', t('tagInput.field'));
  field.setAttribute('aria-describedby', [attrs.get('aria-describedby'), status.id].filter(Boolean).join(' '));
  const maximum = (): number => {
    const n = options.max ?? Number(wrap.dataset.icenMax);
    return Number.isFinite(n) && n > 0 ? Math.max(1,Math.floor(n)) : Infinity;
  };
  const duplicates = (): boolean => options.allowDuplicates ?? wrap.dataset.icenDuplicate === 'true';
  const disabled = (): boolean => Boolean(options.disabled || authorDisabled || authorRootDisabled || inheritedDisabled(field,wrap) || wrap.matches('.is-disabled,[data-icen-disabled]'));
  const readonly = (): boolean => Boolean(options.readOnly || authorReadonly || wrap.hasAttribute('data-icen-readonly'));
  const editable = (): boolean => alive && !disabled() && !readonly();
  const restore = (el: HTMLElement, key: string, value: string | null): void => {if (value == null) el.removeAttribute(key); else el.setAttribute(key,value);};
  const message = (text = '', visible = false): void => {
    status.textContent = text; status.classList.toggle('is-visible', visible);
    if (visible) field.setAttribute('aria-invalid','true'); else restore(field,'aria-invalid',attrs.get('aria-invalid') ?? null);
  };
  const normalize = (items: string[]): string[] => {
    const result: string[] = [];
    for (const value of items) if (typeof value === 'string') {const text = value.trim(); if (text && (duplicates() || !result.includes(text))) result.push(text);}
    return result;
  };
  const classState = (name: string, value: boolean): void => {if (wrap.classList.contains(name) !== value) wrap.classList.toggle(name,value);};
  function sync(): void {
    const list = entries.map(entry => entry.value), max = maximum();
    serial = json || list.some(value => value.includes(',')) ? JSON.stringify(list) : list.join(',');
    if (wrap.dataset.icenTags !== serial) wrap.dataset.icenTags = serial;
    classState('is-max', list.length >= max);
    const off = disabled(), locked = readonly();
    writtenRootDisabled = off;
    if (wrap.getAttribute('aria-disabled') !== String(off)) wrap.setAttribute('aria-disabled',String(off));
    classState('is-unavailable', off); classState('is-readonly', locked);
    writtenDisabled = off; writtenReadonly = locked; writtenRequired = authorRequired && !list.length;
    if (field.disabled !== off) field.disabled = off;
    if (field.readOnly !== locked) field.readOnly = locked;
    if (field.required !== writtenRequired) field.required = writtenRequired;
    if (authorRequired) field.setAttribute('aria-required','true'); else restore(field,'aria-required',attrs.get('aria-required') ?? null);
    field.placeholder = list.length ? '' : placeholder;
    entries.forEach(entry => {entry.button.disabled = off; entry.button.hidden = locked;});
    if (autoRootLabel) wrap.setAttribute('aria-label',t('tagInput.ariaLabel',{p0:list.length}));
    count.textContent = Number.isFinite(max) ? list.length + ' / ' + max : String(list.length);
    count.hidden = !list.length && !Number.isFinite(max);
    const name = options.name ?? originalName;
    if (name) field.removeAttribute('name'); else restore(field,'name',attrs.get('name') ?? null);
    const hidden = list.map(value => {const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; input.disabled = off; const form = field.getAttribute('form'); if (form) input.setAttribute('form',form); return input;});
    values.replaceChildren(...(name ? hidden : []));
  }
  function emit(): void {
    wrap.dispatchEvent(new Event('input',{bubbles:true})); wrap.dispatchEvent(new Event('change',{bubbles:true}));
    emitIcen(wrap,'icen:tags-change',{tags:entries.map(entry => entry.value)});
  }
  function make(value: string): Entry {
    const node = document.createElement('span'); node.className = 'icen-tag-chip';
    const label = document.createElement('bdi'); label.className = 'icen-tag-chip-label'; label.textContent = value; label.title = value;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'icen-tag-chip-x';
    button.setAttribute('aria-label',t('tagInput.remove',{p0:value})); button.append(createIcon('close')!);
    node.append(label,button); return {value,node,button};
  }
  function replace(list: string[], notify: boolean): void {
    const normalized = normalize(list), oldValues = entries.map(entry => entry.value);
    const changed = normalized.length !== oldValues.length || normalized.some((value,index) => value !== oldValues[index]);
    const focused = wrap.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    const pool = [...entries];
    entries = normalized.map(value => {const index = pool.findIndex(entry => entry.value === value); return index < 0 ? make(value) : pool.splice(index,1)[0];});
    pool.forEach(entry => entry.node.remove());
    let anchor: Node = field;
    for (let i = entries.length - 1; i >= 0; i--) {const node = entries[i].node; if (node.parentNode !== wrap || node.nextSibling !== anchor) wrap.insertBefore(node,anchor); anchor = node;}
    sync();
    if (focused?.isConnected && document.activeElement !== focused && !disabled()) focused.focus({preventScroll:true});
    else if (focused && !focused.isConnected && !disabled()) field.focus({preventScroll:true});
    if (changed && notify) emit();
  }
  function remove(index: number): void {
    if (!editable() || !entries[index]) return;
    const entry = entries[index], focused = entry.node.contains(document.activeElement);
    entries.splice(index,1); entry.node.remove(); sync();
    if (focused) (entries[index]?.button ?? entries[index - 1]?.button ?? field).focus({preventScroll:true});
    message(t('tagInput.removed',{p0:entry.value})); emit();
  }
  function commit(raw = field.value): void {
    if (!editable() || composing) return;
    const pieces = raw.split(/[,，\r\n]+/).map(value => value.trim()).filter(Boolean);
    if (!pieces.length) return;
    const next = entries.map(entry => entry.value), rejected: string[] = [];
    let reason = '';
    for (const value of pieces) {
      if (!duplicates() && next.includes(value)) {rejected.push(value); reason ||= t('tagInput.duplicate',{p0:value});}
      else if (next.length >= maximum()) {rejected.push(value); reason ||= t('tagInput.limit',{p0:maximum()});}
      else next.push(value);
    }
    const added = next.length - entries.length;
    field.value = rejected.join(', ');
    replace(next,added > 0);
    if (reason) message(reason,true); else message(t('tagInput.added',{p0:added}));
  }
  const rootClick = (event: Event): void => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('.icen-tag-chip-x');
    if (button && wrap.contains(button)) {event.preventDefault(); remove(entries.findIndex(entry => entry.button === button));}
  };
  wrap.addEventListener('click',rootClick,{signal:ac.signal});
  wrap.addEventListener('pointerdown',event => {if (event.button === 0 && event.target instanceof Element && event.target.closest('.icen-tag-chip-x')) event.preventDefault();},{signal:ac.signal});
  wrap.addEventListener('keydown',event => {
    if (composing || event.isComposing || event.keyCode === 229 || !editable()) return;
    const target = event.target, index = entries.findIndex(entry => entry.button === target);
    const rtl = getComputedStyle(wrap).direction === 'rtl', previous = rtl ? 'ArrowRight' : 'ArrowLeft', next = rtl ? 'ArrowLeft' : 'ArrowRight';
    if (target === field) {
      if (event.key === 'Enter' || event.key === ',' || event.key === '，') {event.preventDefault(); commit();}
      else if (event.key === 'Backspace' && !field.value && entries.length) {event.preventDefault(); if (!event.repeat) remove(entries.length - 1);}
      else if (event.key === previous && field.selectionStart === 0 && field.selectionEnd === 0 && entries.length) {event.preventDefault(); entries[entries.length - 1].button.focus();}
    } else if (index >= 0) {
      if (event.key === 'Backspace' || event.key === 'Delete') {event.preventDefault(); if (!event.repeat) remove(index);}
      else if (event.key === previous || event.key === next) {event.preventDefault(); const to = index + (event.key === previous ? -1 : 1); (entries[to]?.button ?? field).focus();}
      else if (event.key === 'Home') {event.preventDefault(); entries[0]?.button.focus();}
      else if (event.key === 'End' || event.key === 'Escape') {event.preventDefault(); field.focus();}
    }
  },{signal:ac.signal});
  field.addEventListener('compositionstart',() => composing = true,{signal:ac.signal});
  field.addEventListener('compositionend',() => composing = false,{signal:ac.signal});
  field.addEventListener('input',() => {if (!composing) message();},{signal:ac.signal});
  field.addEventListener('blur',event => {if (!(event.relatedTarget instanceof Node) || !wrap.contains(event.relatedTarget)) commit();},{signal:ac.signal});
  field.addEventListener('paste',event => {
    if (!editable() || composing) return;
    const text = event.clipboardData?.getData('text') ?? '';
    if (!/[,，\r\n]/.test(text)) return;
    event.preventDefault(); commit(field.value.slice(0,field.selectionStart ?? 0) + text + field.value.slice(field.selectionEnd ?? field.value.length));
  },{signal:ac.signal});
  const baseline = normalize(options.value ?? parse(wrap.dataset.icenTags ?? ''));
  let form: HTMLFormElement | null = null, formEvents = new AbortController();
  const onReset = (event: Event): void => queueMicrotask(() => {
    if (!alive || event.defaultPrevented) return;
    composing = false; field.value = draftDefault; message(); replace(baseline,true);
  });
  const onSubmit = (event: Event): void => {
    if (!editable() || !field.value.trim()) return;
    commit();
    if (field.value.trim()) {event.preventDefault(); field.focus();}
  };
  const bindForm = (): void => {
    if (field.form === form) return;
    formEvents.abort(); formEvents = new AbortController(); form = field.form;
    form?.addEventListener('reset',onReset,{signal:formEvents.signal});
    form?.addEventListener('submit',onSubmit,{signal:formEvents.signal});
  };
  bindForm();
  const observer = new MutationObserver(() => {
    if (!alive) return;
    if (!wrap.isConnected && seenConnected) {handle.destroy(); return;}
    if (wrap.isConnected) seenConnected = true;
    if (field.disabled !== writtenDisabled) authorDisabled = field.disabled;
    if (field.readOnly !== writtenReadonly) authorReadonly = field.readOnly;
    if (field.required !== writtenRequired) authorRequired = field.required;
    if ((wrap.getAttribute('aria-disabled') === 'true') !== writtenRootDisabled) authorRootDisabled = wrap.getAttribute('aria-disabled') === 'true';
    bindForm();
    const external = wrap.dataset.icenTags ?? '';
    if (external !== serial) {json = external.trim().startsWith('['); message(); replace(parse(external),true);}
    else sync();
  });
  // Only author state attributes are observed; our chip, status and hidden-value
  // writes cannot recursively feed the observer.
  let ancestors: HTMLElement[] = [];
  const parentChain = (): HTMLElement[] => {const chain: HTMLElement[] = []; for (let item = wrap.parentElement; item; item = item.parentElement) chain.push(item); return chain;};
  const observeState = (): void => {
    observer.disconnect(); ancestors = parentChain();
    observer.observe(wrap,{attributes:true,attributeFilter:['data-icen-tags','data-icen-max','data-icen-duplicate','data-icen-disabled','data-icen-readonly','aria-disabled','class']});
    observer.observe(field,{attributes:true,attributeFilter:['disabled','readonly','required','form']});
    ancestors.forEach(ancestor => observer.observe(ancestor,{attributes:true,attributeFilter:['disabled','aria-disabled']}));
  };
  observeState();
  const removal = new MutationObserver(() => {
    if (seenConnected && !wrap.isConnected) {handle.destroy(); return;}
    if (!wrap.isConnected) return;
    seenConnected = true;
    if (status.previousSibling !== wrap) wrap.after(status);
    const chain = parentChain();
    if (chain.length !== ancestors.length || chain.some((item,index) => item !== ancestors[index])) {observeState(); bindForm(); sync();}
  });
  removal.observe(document.documentElement,{childList:true,subtree:true});
  const handle: TagInputHandle = {
    getValue: () => entries.map(entry => entry.value),
    setValue(value,next) {if (alive) {message(); replace(value,next?.emit !== false);}},
    update(next) {if (alive) {options = {...options,...next}; message(); sync();}},
    focus() {if (alive && !disabled()) field.focus();},
    destroy() {
      if (!alive) return;
      alive = false; ac.abort(); formEvents.abort(); observer.disconnect(); removal.disconnect();
      entries.forEach(entry => entry.node.remove()); status.remove(); count.remove(); values.remove();
      wrap.classList.remove('is-max','is-unavailable','is-readonly');
      restore(wrap,'role',rootRole); restore(wrap,'aria-disabled',rootDisabled); if (autoRootLabel) restore(wrap,'aria-label',rootLabel);
      attrs.forEach((value,key) => restore(field,key,value));
      if (controllers.get(wrap)?.handle === handle) controllers.delete(wrap);
    },
  };
  replace(baseline,false);
  return {handle,owners,manual:false};
}

/** Explicit lifecycle handle; repeated creation reuses the editor and updates options. */
export function createTagInput(root: HTMLElement, options: TagInputOptions = {}): TagInputHandle {
  if (typeof document === 'undefined' || typeof window === 'undefined') return noop;
  let controller = controllers.get(root);
  if (!controller) {controller = setup(root,options) ?? undefined; if (controller) controllers.set(root,controller);}
  else {controller.handle.update(options); if (options.value) controller.handle.setValue(options.value,{emit:false});}
  if (!controller) return noop;
  controller.manual = true;
  return controller.handle;
}

/** Dynamic scoped initialization. Overlapping scopes share each editor and only
 * the last scope disposes it; an explicit createTagInput handle owns its lifecycle. */
export function initTagInput(root?: ParentNode): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const scope = root ?? document, previous = scopes.get(scope); if (previous) return previous;
  const owner = {}, owned = new Map<HTMLElement,Controller>(); let disposed = false;
  const mount = (wrap: HTMLElement): void => {
    if (!(scope as Node).contains(wrap)) return;
    let controller = controllers.get(wrap);
    if (!controller) {controller = setup(wrap,{}) ?? undefined; if (controller) controllers.set(wrap,controller);}
    if (controller) {controller.owners.add(owner); owned.set(wrap,controller);}
  };
  const collect = (node: ParentNode): void => {
    if (node instanceof HTMLElement) {const wrap = node.closest<HTMLElement>('.icen-tag-input'); if (wrap) mount(wrap);}
    node.querySelectorAll<HTMLElement>('.icen-tag-input').forEach(mount);
  };
  const release = (controller: Controller): void => {controller.owners.delete(owner); if (!controller.owners.size && !controller.manual) controller.handle.destroy();};
  collect(scope);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement && ((scope as Node).contains(node) || node.contains(scope as Node))) collect(node);
    for (const [wrap,controller] of owned) if (!wrap.isConnected || !(scope as Node).contains(wrap)) {release(controller); owned.delete(wrap);}
  });
  observer.observe(scope,{childList:true,subtree:true});
  if (scope !== document && scope !== document.documentElement) observer.observe(document.documentElement,{childList:true,subtree:true});
  const dispose = (): void => {if (disposed) return; disposed = true; observer.disconnect(); owned.forEach(release); owned.clear(); if (scopes.get(scope) === dispose) scopes.delete(scope);};
  scopes.set(scope,dispose); return dispose;
}
