import { afterEach, expect, test } from 'bun:test';
import { createDesign, mountDesign, setDesign } from '../../src/behaviors/design';

afterEach(() => { setDesign(null); });
test('design axis survives color theme changes and reset selects 现代 and preserves the primitive', () => {
  const root = document.documentElement;
  root.setAttribute('data-icen-preset','monet');
  root.setAttribute('data-icen-style','modern');
  setDesign('modern');
  root.setAttribute('data-icen-theme','dark');
  expect(root.getAttribute('data-icen-preset')).toBe('modern');
  setDesign(null);
  expect(root.getAttribute('data-icen-preset')).toBe('modern');
  expect(root.getAttribute('data-icen-style')).toBe('modern');
  root.removeAttribute('data-icen-theme');
});
test('mounted brand styles have independent, reversible lifetimes', () => {
  const palette = { canvas:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#555555',accent:'#883311',onAccent:'#ffffff' };
  const compiled = createDesign({name:'my-brand',light:palette,dark:palette});
  const count = document.head.querySelectorAll('style').length;
  const dispose = mountDesign(compiled,'test-nonce');
  expect(document.head.querySelectorAll('style').length).toBe(count+1);
  expect((document.head.lastElementChild as HTMLStyleElement)?.nonce).toBe('test-nonce');
  dispose(); dispose();
  expect(document.head.querySelectorAll('style').length).toBe(count);
});
