import { describe, expect, test } from 'bun:test';
import { createDesign, designContrast, type DesignDefinition } from '../../src/behaviors/design';

const brand: DesignDefinition = {
  name: 'brand-test', radius: 12, space: 4, glassOpacity: 90,
  light: { canvas:'#f5f6f8', surface:'#ffffff', ink:'#202124', muted:'#616671', accent:'#0062cc', onAccent:'#ffffff' },
  dark: { canvas:'#15171b', surface:'#25282e', ink:'#f2f4f7', muted:'#aeb5c2', accent:'#89b9ff', onAccent:'#10223c' },
};
describe('brand authoring', () => {
  test('compiles both independent palettes and custom geometry for static/SSR use', () => {
    const compiled = createDesign(brand);
    expect(compiled.cssText).toContain(':root[data-icen-preset="brand-test"][data-icen-theme="dark"]');
    expect(compiled.cssText).toContain('--icen-design-on-accent: #10223c');
    expect(compiled.cssText.match(/--icen-design-radius: 12px/g)).toHaveLength(2);
    expect(compiled.cssText).toContain('--icen-design-glass-opacity: 90%');
    expect(Object.isFrozen(compiled)).toBe(true);
  });
  test('rejects contrast failures in either mode, including muted text', () => {
    expect(() => createDesign({...brand, dark:{...brand.dark,muted:'#555555'}})).toThrow('dark.muted');
    expect(() => createDesign({...brand, light:{...brand.light,onAccent:'#cccccc'}})).toThrow('onAccent');
    expect(() => createDesign({...brand, light:{...brand.light,accent:'#ffccdd'}})).toThrow('light.accent');
  });
  test('rejects injected CSS, incomplete palettes and invalid numeric knobs', () => {
    expect(() => createDesign({...brand,name:'x"]{body{display:none'})).toThrow();
    expect(() => createDesign({...brand,font:'sans-serif; display:none'})).toThrow();
    expect(() => createDesign({...brand,space:NaN})).toThrow();
    expect(() => createDesign({...brand,radius:-1})).toThrow();
    expect(() => createDesign({...brand,light:{...brand.light,ink:'red; color:blue'}})).toThrow();
    expect(() => createDesign({...brand,light:{canvas:'#ffffff'} as DesignDefinition['light']})).toThrow();
  });
  test('contrast calculation uses linear sRGB', () => {
    expect(designContrast('#000000','#ffffff')).toBe(21);
    expect(designContrast('#777777','#777777')).toBe(1);
    expect(() => designContrast('red','#ffffff')).toThrow();
  });
});
