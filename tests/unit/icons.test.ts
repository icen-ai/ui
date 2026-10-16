import { expect, test } from 'bun:test';
import { ICON_PATHS, iconHTML, iconPath, registerIcon, createIcon } from '../../src/behaviors/icons';

test('every symbol has the same optical grid and renders as a real SVG, never a font glyph',()=>{
  for (const name of Object.keys(ICON_PATHS)) {
    const svg=createIcon(name)!;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(svg.getAttribute('stroke-width')).toBe('1.6');
    expect(svg.textContent).toBe('');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(iconPath(name));
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  }
});
test('named icons are accessible; SSR labels and classes cannot inject markup',()=>{
  const label='" onload="alert(1) <img>';
  const html=iconHTML('close',{label,className:'" onclick="bad'});
  const box=document.createElement('div');box.innerHTML=html;
  expect(box.querySelector('img')).toBeNull();
  const svg=box.querySelector('svg')!;
  expect(svg.getAttribute('aria-label')).toBe(label);expect(svg.getAttribute('role')).toBe('img');
  expect(svg.hasAttribute('onload')).toBe(false);expect(svg.hasAttribute('onclick')).toBe(false);
});
test('custom symbols accept only path geometry and unknown symbols fail closed',()=>{
  expect(registerIcon('app-mark','M3 3h14v14H3Z')).toBe(true);
  expect(createIcon('app-mark')?.querySelector('path')?.getAttribute('d')).toBe('M3 3h14v14H3Z');
  expect(registerIcon('close','M0 0')).toBe(false);
  expect(registerIcon('unsafe','"><script>alert(1)</script>')).toBe(false);
  expect(iconHTML('missing')).toBe('');expect(createIcon('missing')).toBeNull();
});
