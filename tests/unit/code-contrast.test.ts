import {expect,test} from 'bun:test';
import themes from '../../src/tokens/themes.json';
import {readableSyntax,syntaxInk} from '../../site/src/lib/code-contrast';
const rgb=(hex:string)=>[0,2,4].map((i)=>parseInt(hex.slice(1+i,3+i),16));
function luminance(color:number[]){const c=color.map((n)=>n/255).map((n)=>n<=.04045 ? n/12.92 : ((n+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
test('syntax text clears WCAG AA on all eight code papers, highlight and diff tints in both modes',()=>{
  for(const mode of ['light','dark'] as const)for(const color of ['#6e7781','#cf222e','#8250df','#0550ae','#8b949e','#ff7b72','#ffffff','#000000']){
    const ink=luminance(rgb(syntaxInk(color,mode)));
    for(const theme of themes){const palette=theme[mode],base=rgb(palette.surface);for(const role of ['surface','accent','success','error'] as const){const mix=role === 'surface' ? base : base.map((value,i)=>Math.round(value*(role === 'accent' ? .9 : .91)+rgb(palette[role])[i]*(role === 'accent' ? .1 : .09)));const paper=luminance(mix);expect((Math.max(ink,paper)+.05)/(Math.min(ink,paper)+.05)).toBeGreaterThanOrEqual(4.79);}}
  }
});
test('foreground calibration changes style colors only, retaining source literals and the dual theme contract',()=>{
  const html='<pre style="background-color:#ffffff;color:#ffffff"><code><span style="color:#6e7781;--shiki-dark:#000000">const value = ";color:#ffffff;";</span></code></pre>';
  const result=readableSyntax(html);expect(result).toContain('background-color:#ffffff');expect(result).toContain('const value = ";color:#ffffff;";');expect(result).toContain('--shiki-dark:');expect(result).not.toContain('style="color:#6e7781;');
});
