// 行为模块纪律守卫（AGENTS.md：behaviors 全部 SSR 守卫 + textContent-only + init 幂等）。
//  1. 文件内出现 document. / window. 引用 → 文件必须存在 typeof x ===/!== 'undefined' 守卫
//     （纯契约模块无 DOM 引用则自然通过；!== 形态同认，isBrowser() 帮手函数即此写法）；
//  2. 禁止 .innerHTML = 赋值——例外：= '' 清空语义，与 ALLOWLIST 登记的槽位契约；
//  3. 禁止 dangerouslySetInnerHTML（React 口头禅漏进无框架库即走私）。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SRC, listFiles, type GuardResult } from './shared';

/** SSR 守卫识别：typeof document === 'undefined' / typeof window !== 'undefined' 均算数 */
const SSR_GUARD_RE = /typeof (?:document|window)\s*(?:===?|!==?)\s*'undefined'/;

/** .innerHTML = 豁免（file = 模块文件名；pattern 命中该行即豁免）。 */
const INNER_HTML_ALLOWLIST: Array<{ file: string; pattern: RegExp; reason: string }> = [
  {
    file: 'context-menu.ts',
    pattern: /icon\.innerHTML = entry\.icon/,
    reason: '图标槽位契约：entry.icon 是调用方提供的可信 SVG 标记（非用户文本），语义即「注入标记」而非「写文本」',
  },
];

/** 形如 innerHTML = <右值> 的赋值（排除 == / === 比较） */
const INNER_HTML_ASSIGN_RE = /\.innerHTML\s*=\s*(?!=)/;

export async function checkBehaviorDiscipline(): Promise<GuardResult> {
  const violations: string[] = [];
  const files = await listFiles(join(SRC, 'behaviors'), '.ts');

  for (const file of files) {
    const rel = `src/behaviors/${file}`;
    const src = await readFile(join(SRC, 'behaviors', file), 'utf8');
    const lines = src.split('\n');

    /* 规则 1：DOM 引用 → SSR 守卫（文件级存在性，纯契约模块无引用自然通过） */
    if (/\b(?:document|window)\./.test(src) && !SSR_GUARD_RE.test(src)) {
      violations.push(`${rel}: 出现 document./window. 引用但文件内无 typeof document/window === 'undefined' SSR 守卫`);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = i + 1;

      /* 规则 2：.innerHTML = 赋值（'' / "" 清空语义放行，其余须登记） */
      if (INNER_HTML_ASSIGN_RE.test(line)) {
        const rhs = line.split(INNER_HTML_ASSIGN_RE)[1] ?? '';
        const firstToken = rhs.trim().split(/[;\s]/)[0] ?? '';
        if (firstToken === "''" || firstToken === '""') continue; /* innerHTML = '' 清空语义放行 */
        const hit = INNER_HTML_ALLOWLIST.find((a) => a.file === file && a.pattern.test(line));
        if (!hit) {
          violations.push(`${rel}:${lineNo}: .innerHTML 赋值被禁（渲染只写 textContent；清空请用 = ''，槽位契约请登记 ALLOWLIST）`);
        }
      }

      /* 规则 3：dangerouslySetInnerHTML 零容忍 */
      if (line.includes('dangerouslySetInnerHTML')) {
        violations.push(`${rel}:${lineNo}: dangerouslySetInnerHTML 出现在无框架库（XSS 红线）`);
      }
    }
  }

  return { title: `行为模块纪律（SSR 守卫 / innerHTML 禁令 / XSS 红线，共 ${files.length} 个模块）`, violations };
}
