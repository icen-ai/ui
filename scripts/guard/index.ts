// 设计纪律守卫入口：顺序执行全部检查，任一违规 exit(1)。
// 运行：bun run guard（或 bun scripts/guard/index.ts）。
import { checkCssDiscipline } from './css-discipline';
import { checkRegistry } from './registry';
import { checkEvents } from './events';
import { checkBehaviorDiscipline } from './behavior-discipline';
import { checkNamespace } from './namespace';
import { checkKbHonesty } from './kb-honesty';
import { checkRtl } from './rtl';
import { checkIconDiscipline } from './icon-discipline';
import { checkClassSync } from './class-sync';
import type { GuardResult } from './shared';

const checks = [checkCssDiscipline, checkRegistry, checkEvents, checkBehaviorDiscipline, checkNamespace, checkKbHonesty, checkRtl, checkClassSync, checkIconDiscipline];

console.log('── 设计纪律守卫 ──────────────────────────────────────');
let failed = false;
for (const check of checks) {
  const result: GuardResult = await check();
  if (result.violations.length === 0) {
    console.log(`✓ ${result.title}`);
    continue;
  }
  failed = true;
  console.log(`✗ ${result.title}`);
  for (const v of result.violations) console.log(`    - ${v}`);
}
console.log('─────────────────────────────────────────────────────');
if (failed) {
  console.log('✗ 守卫未通过：以上违规需修复或登记 ALLOWLIST（注明原因）');
  process.exit(1);
}
console.log('✓ 全部守卫通过');
