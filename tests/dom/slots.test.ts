import { afterEach, expect, test } from 'bun:test';
import { clearIcenSlot, mountIcenSlot } from '../../src/behaviors/slots';

afterEach(() => document.body.replaceChildren());

test('string slots stay text-only and preserve the host contract', () => {
  const host = document.createElement('div');
  host.className = 'consumer-owned custom-class';
  document.body.append(host);
  mountIcenSlot(host, '<img src=x onerror=alert(1)>');
  expect(host.className).toBe('consumer-owned custom-class');
  expect(host.querySelector('img')).toBeNull();
  expect(host.textContent).toBe('<img src=x onerror=alert(1)>');
  clearIcenSlot(host);
  expect(host.childNodes).toHaveLength(0);
  expect(host.className).toBe('consumer-owned custom-class');
});

test('the same node is not recreated, focused state survives, and stale disposers are inert', () => {
  const host = document.createElement('div');
  const button = document.createElement('button');
  button.textContent = 'Continue';
  document.body.append(host);
  const first = mountIcenSlot(host, button);
  button.focus();
  mountIcenSlot(host, button);
  expect(document.activeElement).toBe(button);
  expect(host.firstChild).toBe(button);
  const replacement = document.createElement('span');
  mountIcenSlot(host, replacement);
  first();
  expect(host.firstChild).toBe(replacement);
});

test('renderer cleanup is owned by generation and render failure preserves current content', () => {
  const host = document.createElement('div');
  document.body.append(host);
  let disposed = 0;
  mountIcenSlot(host, () => ({ node: document.createTextNode('ready'), destroy: () => { disposed++; } }));
  mountIcenSlot(host, 'next');
  expect(disposed).toBe(1);
  expect(host.textContent).toBe('next');
  expect(() => mountIcenSlot(host, () => { throw new Error('render failed'); })).toThrow('render failed');
  expect(host.textContent).toBe('next');
  clearIcenSlot(host);
  clearIcenSlot(host);
  expect(host.childNodes).toHaveLength(0);
});

test('clear removes only slot-owned nodes, not nodes moved elsewhere by the consumer', () => {
  const host = document.createElement('div');
  const other = document.createElement('div');
  const node = document.createElement('span');
  document.body.append(host, other);
  mountIcenSlot(host, node);
  other.append(node);
  clearIcenSlot(host);
  expect(node.parentNode).toBe(other);
});
