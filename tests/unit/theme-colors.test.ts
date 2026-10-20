import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import themes from '../../src/tokens/themes.json';
import {renderThemeColors} from '../../scripts/theme-colors.mjs';
import {designContrast} from '../../src/behaviors/design';

test('six curated themes have readable text and actions on all three surfaces',()=>{
  expect(themes.map(t=>t.id)).toEqual(['modern','dongyun','jugou','piano','monet','vangogh']);
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
test('palette CSS is reproducible and covers exactly the curated themes',()=>{
  const css=readFileSync(new URL('../../src/tokens/colors.css',import.meta.url),'utf8');
  expect(css).toBe(renderThemeColors(themes));
  const ids=[...new Set([...css.matchAll(/\[data-icen-preset="([a-z-]+)"\]/g)].map((m)=>m[1]))];
  expect(ids.sort()).toEqual(themes.map((t)=>t.id).sort());
  for(const t of themes) expect(css).toContain(`[data-icen-preset="${t.id}"][data-icen-theme="dark"]`);
});
test('derived tint surfaces keep AA for text pairs (fill-1 / accent-subtle，2026-10 审计锁定)',()=>{
  /* 扁平键对之外的派生面：fill-1 = ink 4%、accent-subtle = accent 10%，均叠在底层上。
     把审计修复过的配对锁进矩阵——这些就是此前六处对比度逃逸的家族。 */
  const mix=(fg:string,bg:string,a:number)=>{
    const p=(h:string)=>[1,3,5].map((i)=>parseInt(h.slice(i,i+2),16));
    const [r,g,b]=p(fg),[R,G,B]=p(bg);
    const h=(x:number)=>Math.round(x).toString(16).padStart(2,'0');
    return '#'+h(r*a+R*(1-a))+h(g*a+G*(1-a))+h(b*a+B*(1-a));
  };
  for(const theme of themes) for(const mode of ['light','dark'] as const) {
    const p=theme[mode];
    for(const base of ['bg','surface'] as const) {
      const fill1=mix(p.ink,p[base],0.04);
      const accentSubtle=mix(p.accent,p[base],0.10);
      expect(designContrast(p.ink,fill1),`${theme.id}/${mode}: ink on fill-1(${base})`).toBeGreaterThanOrEqual(4.5);
      expect(designContrast(p.accentText,accentSubtle),`${theme.id}/${mode}: accent-text on accent-subtle(${base})`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
