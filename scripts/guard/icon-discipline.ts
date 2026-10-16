// Prevent font-dependent operation symbols from returning to renderer output.
// Prose, keyboard key names and mathematical content are deliberately excluded.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SRC, listFiles, type GuardResult } from './shared';
const glyph = '[×✕✗✓✔⌄▾▸▴▿›‹←→↑↓⨯]+';
const rules = [
  new RegExp(`\\.textContent\\s*=\\s*(['"])${glyph}\\1`),
  new RegExp(`\\bcontent:\\s*(['"])${glyph}\\1`),
  new RegExp(`\\bh\\(['"]button['"][^\\n]*,\\s*(['"])${glyph}\\1\\s*\\)`),
];
export async function checkIconDiscipline(): Promise<GuardResult> {
  const violations:string[]=[];
  for(const [folder,extension] of [['behaviors','.ts'],['components','.css']] as const) {
    for(const file of await listFiles(join(SRC,folder),extension)) {
      const lines=(await readFile(join(SRC,folder,file),'utf8')).split('\n');
      lines.forEach((line,index)=>{
        if(/^\s*(\*|\/\/)/.test(line))return;
        if(rules.some((rule)=>rule.test(line))) violations.push(`src/${folder}/${file}:${index+1}: 操作符号请使用 icons.ts 的 SVG 或同源 CSS mask`);
      });
    }
  }
  return {title:'图标纪律（操作与状态图形使用 SVG / 同源 mask）',violations};
}
