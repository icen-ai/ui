import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import themes from '../../src/tokens/themes.json';
import {renderThemeColors} from '../../scripts/theme-colors.mjs';
import {designContrast} from '../../src/behaviors/design';

test('six curated themes have readable text and actions on all three surfaces',()=>{
  expect(themes.map(t=>t.id)).toEqual(['benzhen','clay','piano','art','vangogh','ink']);
  for(const theme of themes) for(const mode of ['light','dark'] as const) {
    const p=theme[mode];
    for(const bg of ['bg','surface','raised'] as const) {
      for(const fg of ['ink','muted','faint','accentText','success','warning','error','info'] as const) {
        expect(designContrast(p[bg],p[fg]),`${theme.id}/${mode}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(designContrast(p.accentStrong,p.onAccent),`${theme.id}/${mode}: primary label`).toBeGreaterThanOrEqual(4.5);
  }
});
test('palette CSS is reproducible and contains no removed theme',()=>{
  const css=readFileSync(new URL('../../src/tokens/colors.css',import.meta.url),'utf8');
  expect(css).toBe(renderThemeColors(themes));
  expect(css).not.toContain('[data-icen-preset="retro"]');
  for(const t of themes) expect(css).toContain(`[data-icen-preset="${t.id}"][data-icen-theme="dark"]`);
});
