import { afterEach, beforeEach, expect, test, spyOn } from 'bun:test';
import { createThemeSwitcher, initThemeSwitcher, themeSwitcherHTML } from '../../src/behaviors/theme-switcher';
import { applyTheme, getCurrentTheme, getTheme, initTheme, setTheme, STORAGE_KEY } from '../../src/behaviors/theme';
import { setIcenLocale, resetIcenLocale, ICEN_LOCALE_EN_US } from '../../src/behaviors/i18n';

const disposers: (() => void)[] = [];
const mounts: HTMLElement[] = [];
function mount() { const el = document.createElement('div'); document.body.append(el); mounts.push(el); return el; }
beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-icen-style'); initTheme(); });
afterEach(() => { disposers.splice(0).forEach((dispose) => dispose()); mounts.splice(0).forEach((el) => el.remove()); initThemeSwitcher(); resetIcenLocale(); });

test('independent controls share state and persistence is current inside the change event', () => {
  const a = mount(), b = mount();
  disposers.push(createThemeSwitcher(a,{layout:'inline'}).destroy,createThemeSwitcher(b,{kind:'mode'}).destroy);
  let persisted = '';
  const listener = () => { persisted = getTheme().preset; };
  document.addEventListener('icen:theme-change',listener);
  a.querySelector<HTMLButtonElement>('[data-icen-axis="theme"][data-icen-value="ink"]')!.click();
  expect(persisted).toBe('ink');
  b.querySelector<HTMLButtonElement>('button')!.click();
  expect(getCurrentTheme()).toEqual({preset:'ink',style:'benzhen',dark:true});
  expect(a.querySelector('[data-icen-axis="mode"][data-icen-value="dark"]')?.getAttribute('aria-pressed')).toBe('true');
  document.removeEventListener('icen:theme-change',listener);
});

test('applied-only and storage-blocked changes retain all axes across consecutive controls', () => {
  initTheme();
  applyTheme({preset:'piano',dark:true,style:'pixel'});
  const spy = spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('quota'); });
  try {
    const a = mount(); disposers.push(createThemeSwitcher(a,{kind:'mode'}).destroy);
    a.querySelector<HTMLButtonElement>('button')!.click();
    expect(getCurrentTheme()).toEqual({preset:'piano',dark:false,style:'pixel'});
    setTheme({preset:'ink'});
    expect(getCurrentTheme()).toEqual({preset:'ink',dark:false,style:'pixel'});
  } finally { spy.mockRestore(); }
});

test('SSR labels escape markup, hydrate idempotently and preserve caller labels and sizing', () => {
  const a=mount(); a.innerHTML=themeSwitcherHTML({labels:{benzhen:'<img onerror="oops">'},sizing:{width:280},size:'sm'});
  expect(a.querySelector('img')).toBeNull();
  initThemeSwitcher(a); initThemeSwitcher(a);
  expect(a.querySelector('.icen-theme-switcher-name')?.textContent).toBe('<img onerror="oops">');
  const trigger=a.querySelector<HTMLButtonElement>('button')!;
  trigger.click(); expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const panel=document.getElementById(trigger.getAttribute('aria-controls')!)!;
  expect(panel.style.width).toBe('280px');
  panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

test('empty declarative roots initialize only once and changing mode never opens a panel', () => {
  const a=mount(); a.setAttribute('data-icen-theme-switcher',''); a.dataset.icenKind='mode';
  initThemeSwitcher(a); initThemeSwitcher(a);
  expect(a.querySelectorAll('button')).toHaveLength(1);
  expect(a.querySelector('[role="dialog"]')).toBeNull();
  a.querySelector<HTMLButtonElement>('button')!.click(); expect(getCurrentTheme().dark).toBe(true);
});

test('other tabs update every instance; live locale updates retain the selected theme', () => {
  const a=mount(); disposers.push(createThemeSwitcher(a,{layout:'inline'}).destroy);
  localStorage.setItem(STORAGE_KEY,JSON.stringify({preset:'clay',style:'pixel',dark:true}));
  window.dispatchEvent(new StorageEvent('storage',{key:STORAGE_KEY}));
  expect(getCurrentTheme()).toEqual({preset:'clay',style:'pixel',dark:true});
  expect(a.querySelector('[data-icen-value="clay"]')?.getAttribute('aria-pressed')).toBe('true');
  setIcenLocale(ICEN_LOCALE_EN_US);
  expect(a.querySelector('[data-icen-value="clay"]')?.textContent).toContain('Clay');
});

test('destroy removes open portals and recreated controls have one listener', () => {
  const a=mount();
  const old=createThemeSwitcher(a); a.querySelector<HTMLButtonElement>('button')!.click();
  const panel=document.querySelector('.icen-theme-switcher-panel:not([hidden])'); expect(panel).not.toBeNull();
  old.destroy(); expect(panel?.isConnected).toBe(false);
  const current=createThemeSwitcher(a,{kind:'mode'}); disposers.push(current.destroy);
  initThemeSwitcher(a); a.querySelector<HTMLButtonElement>('button')!.click();
  expect(getCurrentTheme().dark).toBe(true);
});
