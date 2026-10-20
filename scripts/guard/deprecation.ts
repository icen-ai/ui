// 弃用纪律：@deprecated 标记必须带移除版本且至少提前一个 minor 公告。
// 约定（TS JSDoc 与 CSS 头注释同构）：
//   @deprecated 用 xxx 替代（0.12 移除）
// 规则：① 必须写移除版本；② 移除版本必须晚于当前版本至少一个 minor（公告期）；
//       ③ 到期的条目必须真的移除（移除后契约快照守卫按破坏性变更接管公告纪律）。
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, SRC, type GuardResult } from './shared';

const MARK = /@deprecated\b[^\n]*?（(\d+)\.(\d+)(?:\.\d+)?\s*移除）/;
const MARK_ANY = /@deprecated\b/g;

async function collect(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...(await collect(p, exts)));
    else if (exts.some((e) => name.name.endsWith(e))) out.push(p);
  }
  return out.sort();
}

export async function checkDeprecation(): Promise<GuardResult> {
  const violations: string[] = [];
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const [curMajor, curMinor] = String(pkg.version).split('.').map(Number);

  const files = await collect(SRC, ['.ts', '.tsx', '.css']);
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    const rel = f.replace(`${SRC}\\`, '').replace(`${SRC}/`, '');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(MARK_ANY)) {
        const withVersion = line.match(MARK);
        if (!withVersion) {
          violations.push(`${rel}:${i + 1} — @deprecated 必须带移除版本：「@deprecated 用 X 替代（<次版本> 移除）」`);
          continue;
        }
        const [, maj, min] = withVersion[0].match(/（(\d+)\.(\d+)/) ?? [];
        const rmMajor = Number(maj);
        const rmMinor = Number(min);
        if (rmMajor < curMajor || (rmMajor === curMajor && rmMinor <= curMinor)) {
          violations.push(
            `${rel}:${i + 1} — 弃用公告期不足或已到期（当前 ${curMajor}.${curMinor}，标 ${rmMajor}.${rmMinor} 移除）：弃用须至少提前一个 minor；到期即删除`,
          );
        }
      }
    });
  }
  return { title: '弃用纪律（@deprecated 带移除版本 + 一个 minor 公告期）', violations };
}
