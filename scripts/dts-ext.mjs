// tsup 的 outExtension 只改 JS；DTS 落的是 .d.ts。ESM 产物 .mjs 的声明必须同名 .d.mts
// （node16/bundler 解析 foo.mjs → 找 foo.d.mts），这里构建后统一改名。
// 同时把声明文件里的相对引用从 .js 改写为 .mjs——产物是 .mjs，指向 .js 的 specifier
// 在 node16 解析下找不到（attw InternalResolutionError 的来源）。
// 顺带清空 dist 下残留的空目录（tsup dts 按源码目录结构落盘，改名后留下空壳）。
import { readdirSync, readFileSync, writeFileSync, renameSync, statSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

let n = 0;
let rewired = 0;
const fixSpecifiers = (file) => {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/(from|import)\s+(['"])(\.\.?\/[^'"]+)\.js(['"])/g, (_m, kw, q1, spec, q2) => {
    rewired++;
    return `${kw} ${q1}${spec}.mjs${q2}`;
  });
  if (after !== before) writeFileSync(file, after);
};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (name.endsWith('.d.ts')) { renameSync(p, p.slice(0, -5) + '.d.mts'); n++; fixSpecifiers(p.slice(0, -5) + '.d.mts'); }
    else if (name.endsWith('.d.mts')) fixSpecifiers(p);
  }
};
walk(DIST);

// 自底向上删空目录（dist 根除外）
const prune = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { prune(p); if (readdirSync(p).length === 0) rmdirSync(p); }
  }
};
prune(DIST);

console.log(`dts-ext: ${n} 个 .d.ts → .d.mts，${rewired} 处 specifier 改写 .js → .mjs`);
