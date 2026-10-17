/** Build-time syntax ink calibration. Keep the highlighter's hue, but make its
 * light/dark foregrounds readable on every built-in code paper and line tint. */
import themes from '../../../src/tokens/themes.json';
type RGB=[number,number,number];
const rgb=(hex:string):RGB=>[0,2,4].map((i)=>parseInt(hex.replace('#','').slice(i,i+2),16)) as RGB;
const luminance=(c:RGB)=>c.map((v)=>{v/=255;return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const blend=(a:RGB,b:RGB,t:number):RGB=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t)) as RGB;
const surfaces=(mode:'light'|'dark')=>themes.flatMap((theme)=>{const p=theme[mode],paper=rgb(p.surface);return [paper,...(['accent','success','error'] as const).map((key)=>blend(paper,rgb(p[key]),key === 'accent' ? .10 : .09))];});
const backgrounds={light:surfaces('light'),dark:surfaces('dark')};
const cache=new Map<string,string>();
export function syntaxInk(hex:string,mode:'light'|'dark'):string {
  const key=mode+hex;if(cache.has(key))return cache.get(key)!;
  const original=rgb(hex),target:RGB=mode === 'light' ? [0,0,0] : [255,255,255];
  const passes=(ink:RGB)=>{const l=luminance(ink);return backgrounds[mode].every((paper)=>{const b=luminance(paper);return (Math.max(l,b)+.05)/(Math.min(l,b)+.05)>=4.8;});};
  let result=original;
  if(!passes(original)){let low=0,high=1;for(let i=0;i<16;i++){const t=(low+high)/2;if(passes(blend(original,target,t)))high=t;else low=t;}result=blend(original,target,high);}
  const value='#'+result.map((v)=>v.toString(16).padStart(2,'0')).join('');cache.set(key,value);return value;
}
export function readableSyntax(html:string):string {
  return html.replace(/(<[^>]+\bstyle=")([^"]*)(")/gi,(_m,open:string,style:string,close:string)=>open+style
    .replace(/((?:^|;)\s*color:\s*)(#[a-f\d]{6})(?=\s*(?:;|$))/gi,(_m,prefix:string,color:string)=>prefix+syntaxInk(color,'light'))
    .replace(/((?:^|;)\s*--shiki-dark:\s*)(#[a-f\d]{6})(?=\s*(?:;|$))/gi,(_m,prefix:string,color:string)=>prefix+syntaxInk(color,'dark'))+close);
}
