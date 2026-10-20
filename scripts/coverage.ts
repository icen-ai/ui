// 覆盖率棘轮（CI 用）：跑 bun test --coverage（lcov），汇总 src/** 行/函数覆盖率，
// 低于 docs/contracts/coverage-floor.json 即 exit(1)。门槛只许升不许降——降门槛的 diff 即评审点。
// 本地开发跑 bun test 即可（快）；本命令是 CI 的慢门，与 e2e 同级。
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const floor = JSON.parse(readFileSync(join(ROOT, 'docs', 'contracts', 'coverage-floor.json'), 'utf8'));

const run = spawnSync(process.execPath, ['test', '--coverage', '--coverage-reporter=lcov'], { cwd: ROOT, stdio: 'inherit' });
if (run.status !== 0) process.exit(run.status ?? 1);

const lcov = readFileSync(join(ROOT, 'coverage', 'lcov.info'), 'utf8');
let lf = 0, lh = 0, fnf = 0, fnh = 0;
let inSrc = false;
for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) {
    const p = line.slice(3).trim();
    inSrc = p.startsWith('src\\') || p.startsWith('src/') || p.includes('\\src\\') || p.includes('/src/');
  } else if (inSrc && line.startsWith('DA:')) {
    lf++;
    if (Number(line.split(',')[1]) > 0) lh++;
  } else if (inSrc && line.startsWith('FNF:')) fnf += Number(line.slice(4));
  else if (inSrc && line.startsWith('FNH:')) fnh += Number(line.slice(4));
}
const pct = (hit: number, found: number) => (found === 0 ? 100 : (hit / found) * 100);
const lines = pct(lh, lf);
const funcs = pct(fnh, fnf);
console.log(`覆盖率（src/**）：行 ${lines.toFixed(2)}%（地板 ${floor.lines}%）、函数 ${funcs.toFixed(2)}%（地板 ${floor.functions}%）`);
if (lines < floor.lines || funcs < floor.functions) {
  console.error('✗ 覆盖率跌破地板：补测试，或确需下调时随 PR 修改 coverage-floor.json（棘轮只许升）');
  process.exit(1);
}
console.log('✓ 覆盖率在地板之上');
