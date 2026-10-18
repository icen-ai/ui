// A var() without a fallback invalidates its entire declaration when unresolved.
// Verify the shared token vocabulary, not merely the absence of CSS hex values.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {SRC,listFiles,stripComments,type GuardResult} from './shared';

export function unresolvedTokenReferences(sources: Record<string,string>): string[] {
  const entries=Object.entries(sources).map(([file,source])=>({file,lines:stripComments(source.split('\n'))}));
  const defined=new Set(entries.flatMap(({lines})=>Array.from(lines.join('\n').matchAll(/(--icen-[\w-]+)\s*:/g),m=>m[1])));
  return entries.flatMap(({file,lines})=>lines.flatMap((line,i)=>Array.from(line.matchAll(/var\(\s*(--icen-[\w-]+)\s*\)/g))
    .filter(m=>!defined.has(m[1])).map(m=>`${file}:${i+1}: ${m[1]} 未定义且无 fallback，整条 CSS 声明会失效`)));
}

export async function checkTokenReferences(): Promise<GuardResult> {
  const files=['base.css',...(await listFiles(join(SRC,'tokens'),'.css')).map(f=>`tokens/${f}`),...(await listFiles(join(SRC,'components'),'.css')).map(f=>`components/${f}`)];
  const entries=await Promise.all(files.map(async file=>[file,await readFile(join(SRC,file),'utf8')] as const));
  return {title:'Token 引用（无 fallback 的全局变量必须有定义）',violations:unresolvedTokenReferences(Object.fromEntries(entries))};
}
