// dist/react.mjs 头部补 'use client' 指令（RSC 边界标记：该入口只允许客户端引用）。
// tsup 的 banner 是全入口级的，不能单给 react——构建后由本脚本幂等补写。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const p = fileURLToPath(new URL('../dist/react.mjs', import.meta.url));
const src = readFileSync(p, 'utf8');
if (!/^["']use client["'];/m.test(src.slice(0, 200))) {
  writeFileSync(p, `'use client';\n${src}`);
  console.log('react-use-client: dist/react.mjs 已补 banner');
} else {
  console.log('react-use-client: banner 已存在，跳过');
}
