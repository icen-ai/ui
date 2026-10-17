import {afterEach, expect, test} from 'bun:test';
import {initCopy} from '../../src/behaviors/copy';

const cleanup: (() => void)[] = [];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture(icon = false) {
  const host = document.createElement('div');
  const button = document.createElement('button');
  button.className = 'icen-copy-btn';
  button.dataset.icenCopy = 'one\n\nthree';
  button.setAttribute('aria-label', '复制地址');
  if (icon) button.dataset.icenCopyIcon = '';
  else {const label = document.createElement('strong'); label.textContent = '复制地址'; button.append(label);}
  host.append(button); document.body.append(host);
  const original = button.firstChild;
  const dispose = initCopy(host); cleanup.push(dispose);
  return {host, button, original, dispose};
}
function clipboard(writeText: (text: string) => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
  cleanup.push(() => {if (previous) Object.defineProperty(navigator, 'clipboard', previous); else delete (navigator as any).clipboard;});
}
afterEach(() => {cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren();});

test('copy deduplicates async work, retains author nodes and reserves success text separately', async () => {
  let finish!: () => void; const writes: string[] = [];
  clipboard(text => {writes.push(text); return new Promise<void>(resolve => finish = resolve);});
  const {button, original, dispose} = fixture();
  button.click(); button.click();
  expect(writes).toEqual(['one\n\nthree']); expect(button.getAttribute('aria-busy')).toBe('true');
  finish(); await tick();
  expect(button.classList.contains('is-done')).toBe(true);
  expect(button.contains(original)).toBe(true); expect(button.querySelector('strong') === original).toBe(true);
  expect(button.nextElementSibling?.getAttribute('role')).toBe('status');
  dispose(); expect(button.firstChild === original).toBe(true); expect(button.childNodes.length).toBe(1);
  expect(button.getAttribute('aria-label')).toBe('复制地址'); expect(button.hasAttribute('aria-busy')).toBe(false);
});

test('failure is described visibly, retries cleanly and restores an existing description', async () => {
  let calls = 0; clipboard(async () => {if (++calls === 1) throw new Error('denied');});
  const previous = document.execCommand; document.execCommand = () => false; cleanup.push(() => document.execCommand = previous);
  const {button, dispose} = fixture(); button.setAttribute('aria-describedby', 'author-help');
  button.click(); await tick();
  const status = button.nextElementSibling!;
  expect(status.textContent).toBe('未能复制，请重试。'); expect(button.getAttribute('aria-describedby')).toBe('author-help ' + status.id);
  button.click(); await tick(); expect(button.classList.contains('is-error')).toBe(false); expect(button.classList.contains('is-done')).toBe(true);
  expect(button.parentElement!.querySelectorAll('.icen-copy-feedback').length).toBe(1);
  dispose(); expect(button.getAttribute('aria-describedby')).toBe('author-help');
});

test('nested scopes delegate once and repeated or stale disposers cannot stop another owner', async () => {
  let writes = 0; clipboard(async () => {writes++;});
  const {host, button, dispose} = fixture(true);
  const global = initCopy(); cleanup.push(global);
  expect(initCopy(host) === dispose).toBe(true);
  button.click(); await tick(); expect(writes).toBe(1);
  dispose(); expect(button.querySelector('.icen-copy-content') !== null).toBe(true);
  const next = initCopy(host); cleanup.push(next); dispose();
  button.click(); await tick(); expect(writes).toBe(2);
  next(); global(); expect(button.childNodes.length).toBe(0);
});

test('dispose and disabled fieldsets cancel late failures without fallback, events or resurrected UI', async () => {
  let reject!: (error: Error) => void, fallback = 0, events = 0;
  clipboard(() => new Promise<void>((_resolve, no) => reject = no));
  const previous = document.execCommand; document.execCommand = () => {fallback++; return false;}; cleanup.push(() => document.execCommand = previous);
  const {host, button, dispose} = fixture(); button.addEventListener('icen:copy-error', () => events++);
  const fieldset = document.createElement('fieldset'); host.append(fieldset); fieldset.append(button);
  button.click(); fieldset.disabled = true; await tick(); reject(new Error('late')); await tick();
  expect(fallback).toBe(0); expect(events).toBe(0); expect(button.hasAttribute('aria-busy')).toBe(false);
  fieldset.disabled = false; button.click(); dispose(); reject(new Error('later')); await tick();
  expect(fallback).toBe(0); expect(events).toBe(0); expect(host.querySelectorAll('.icen-copy-feedback').length).toBe(0);
});

test('dynamically inserted and removed buttons receive symbols and release their pending work', async () => {
  let reject!: (error: Error) => void;
  clipboard(() => new Promise<void>((_resolve, no) => reject = no));
  const {host, button} = fixture(true);
  const other = button.cloneNode(false) as HTMLButtonElement; host.append(other); await tick();
  expect(other.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 20 20');
  other.click(); other.remove(); await tick(); reject(new Error('late')); await tick();
  expect(other.hasAttribute('aria-busy')).toBe(false); expect(other.childNodes.length).toBe(0);
});

test('copy prevents implicit form submission and respects cancelled and aria-disabled clicks', async () => {
  let writes = 0, submits = 0; clipboard(async () => {writes++;});
  const {host, button} = fixture(); const form = document.createElement('form'); host.append(form); form.append(button);
  form.addEventListener('submit', event => {event.preventDefault(); submits++;});
  button.setAttribute('aria-disabled', 'true'); button.click(); await tick(); expect(writes).toBe(0);
  button.removeAttribute('aria-disabled');
  const cancel = (event: Event) => event.preventDefault(); button.addEventListener('click', cancel);
  button.click(); await tick(); expect(writes).toBe(0); button.removeEventListener('click', cancel);
  button.click(); await tick(); expect(writes).toBe(1); expect(submits).toBe(0);
  host.setAttribute('aria-disabled', 'true'); await tick();
  button.click(); await tick(); expect(writes).toBe(1); expect(submits).toBe(0);
});

test('author slot replacement and live idle labels remain usable through reinitialization', async () => {
  clipboard(async () => {}); const {button, dispose} = fixture();
  button.textContent = '复制新地址'; button.setAttribute('aria-label', '复制新地址'); button.click(); await tick();
  expect(button.querySelector('.icen-copy-content')?.textContent).toBe('复制新地址');
  dispose(); expect(button.textContent).toBe('复制新地址'); expect(button.getAttribute('aria-label')).toBe('复制新地址');
});

test('custom writes expose cancellation, diagnose rejection and retry without changing author nodes', async () => {
  const {host, button, original, dispose} = fixture(); dispose();
  let context!: {signal: AbortSignal}, finish!: () => void, attempts = 0, reason = '';
  const release = initCopy(host, {write: async (_text, next) => {
    context = next;
    if (++attempts === 1) throw new Error('native bridge denied');
    await new Promise<void>(resolve => finish = resolve);
  }}); cleanup.push(release);
  button.addEventListener('icen:copy-error', event => reason = (event as CustomEvent).detail.reason);
  button.click(); await tick(); expect(reason).toBe('native bridge denied');
  button.click(); expect(context.signal.aborted).toBe(false); host.remove(); await tick();
  expect(context.signal.aborted).toBe(true); finish(); await tick();
  expect(button.classList.contains('is-done')).toBe(false); expect(button.firstChild === original).toBe(true);
});

test('first legend stays interactive inside a disabled fieldset and idle author labels survive disposal', async () => {
  let writes = 0; clipboard(async () => {writes++;});
  const {host, button, dispose} = fixture(); const fieldset = document.createElement('fieldset'), legend = document.createElement('legend');
  host.append(fieldset); fieldset.append(legend); legend.append(button); fieldset.disabled = true;
  button.click(); await tick(); expect(writes).toBe(1);
  dispose(); const release = initCopy(host); cleanup.push(release);
  button.setAttribute('aria-label', '新的宿主名称'); release(); expect(button.getAttribute('aria-label')).toBe('新的宿主名称');
});
