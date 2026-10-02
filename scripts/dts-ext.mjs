// tsup 的 outExtension 只改 JS；DTS 落的是 .d.ts。ESM 产物 .mjs 的声明必须同名 .d.mts
// （node16/bundler 解析 foo.mjs → 找 foo.d.mts），这里构建后统一改名。
import { readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let n = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (name.endsWith('.d.ts')) { renameSync(p, p.slice(0, -5) + '.d.mts'); n++; }
  }
};
walk(fileURLToPath(new URL('../dist', import.meta.url)));
console.log(`dts-ext: ${n} 个 .d.ts → .d.mts`);
