// 分层依赖方向守卫：Core 不得被 Beta 拖着变（docs/versioning.md「边界规则」）。
//
// 规则（事实源 docs/contracts/tiers.json + 行为模块家族前缀）：
//   1. Core 行为模块禁止**运行时** import Beta 模块（值导入 / 动态 import，无豁免）。
//   2. Core 行为模块 import type Beta 模块 = 编译期耦合，须在该 import 语句上登记
//      /* guard:allow-beta-type 理由 */（运行期擦除，但 Beta 类型改名会拖垮 Core 编译，故留痕）。
//   3. Core CSS 引用 Beta 家族类名（.icen-ai-* / .icen-chart* / .kb-*），须行尾
//      /* guard:allow-beta-ref 理由 */，或进 BETA_REF_FILES 文件级白名单（理由同步写进文件头注释）。
//   Beta → Core 方向自由；src/index.ts（umbrella 入口）与 src/react / src/vue
//   （框架适配层，类型面 re-export 属文档声明的「Core 从属面」）不在本守卫扫描范围。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SRC, listFiles, stripComments, type GuardResult } from './shared';

/** Beta 行为模块家族前缀（无同名 CSS 的模块靠前缀归类；有同名 CSS 的以 tiers.json 为准）。 */
const BETA_BEHAVIOR = /^(ai-|kb-|charts$)/;

/** Beta 家族类名前缀（CSS 侧扫描面）。 */
const BETA_CLASS = /\.(?:icen-ai-[a-z0-9-]*|icen-chart[a-z0-9-]*|kb-[a-z0-9-]*)/g;

/** Core CSS 引用 Beta 类名的文件级白名单——理由必须写进对应文件头注释。
 *  新增条目 = 评审点：优先把适配移进 Beta 自己的 CSS，实在横切才登记。 */
const BETA_REF_FILES: Record<string, string> = {
  material: '材料适配是横切层：选中态/磨砂配方覆盖 ai-composer 弹层与 kb-checkpoint 菜单；Beta 类名变更仅静默降级，不破坏 Core 用户',
  'material-chinese': '同 material.css（中式原语同款横切适配）',
  'material-soviet': '同 material.css（苏式原语同款横切适配）',
  'form-validate': 'show_form 渲染体（.icen-ai-form*）归 Core 的 form-validate 所有（runShowForm 在本模块），类名沿用 ai 族命名是历史契约',
};

interface Tiers {
  core: string[];
  beta: string[];
  lab: string[];
}

/** 行为模块名 → tier（tiers.json 优先，无同名 CSS 的模块走家族前缀，缺省 core）。 */
function behaviorTier(name: string, tiers: Tiers): 'core' | 'beta' | 'lab' {
  if (tiers.beta.includes(name)) return 'beta';
  if (tiers.core.includes(name)) return 'core';
  if (tiers.lab.includes(name)) return 'lab';
  return BETA_BEHAVIOR.test(name) ? 'beta' : 'core';
}

/** 把从 `import` 起始行到 `;` 的完整语句拼起来（多行 import 展开为一行分析）。 */
function importStatements(lines: string[]): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  let buf = '';
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (start === -1) {
      if (/^\s*import\s/.test(line) || /^\s*import\s*type\s/.test(line)) {
        start = i;
        buf = line;
        if (line.includes(';')) {
          out.push({ start, text: buf });
          start = -1;
          buf = '';
        }
      } else if (/import\('\.\//.test(line)) {
        out.push({ start: i, text: line }); // 动态 import 单行采样
      }
      continue;
    }
    buf += `\n${line}`;
    if (line.includes(';')) {
      out.push({ start, text: buf });
      start = -1;
      buf = '';
    }
  }
  return out;
}

export async function checkTierDirection(): Promise<GuardResult> {
  const violations: string[] = [];
  const tiers = JSON.parse(
    await readFile(join(SRC, '..', 'docs', 'contracts', 'tiers.json'), 'utf8'),
  ) as Tiers;

  /* ── TS 侧：Core 行为模块 → Beta 模块的 import ── */
  const behaviorFiles = await listFiles(join(SRC, 'behaviors'), '.ts');
  const betaMods = new Set(
    behaviorFiles.filter((f) => behaviorTier(f.replace(/\.ts$/, ''), tiers) === 'beta'),
  );
  for (const f of behaviorFiles) {
    const mod = f.replace(/\.ts$/, '');
    if (behaviorTier(mod, tiers) !== 'core') continue;
    const lines = (await readFile(join(SRC, 'behaviors', f), 'utf8')).split(/\r?\n/);
    for (const stmt of importStatements(lines)) {
      const m = stmt.text.match(/from\s+['"]\.\/([a-z0-9-]+)['"]|import\(['"]\.\/([a-z0-9-]+)['"]\)/);
      if (!m) continue;
      const target = m[1] ?? m[2];
      if (!betaMods.has(`${target}.ts`)) continue;
      const isTypeOnly = /^\s*import\s+type\b/.test(stmt.text);
      const annotated = stmt.text.includes('guard:allow-beta-type');
      if (!isTypeOnly) {
        violations.push(
          `behaviors/${f}:${stmt.start + 1} Core 模块运行时依赖 Beta 模块 './${target}'——`
          + '方向必须反转（Beta import Core），或把共享部分下放到 Core',
        );
      } else if (!annotated) {
        violations.push(
          `behaviors/${f}:${stmt.start + 1} Core 模块 import type Beta 模块 './${target}'`
          + ' 未登记——语句上加 /* guard:allow-beta-type 理由 */（运行期擦除，但须留痕评审）',
        );
      }
    }
  }

  /* ── CSS 侧：Core CSS → Beta 家族类名引用 ── */
  for (const f of await listFiles(join(SRC, 'components'), '.css')) {
    const mod = f.replace(/\.css$/, '');
    if (!tiers.core.includes(mod)) continue;
    if (BETA_REF_FILES[mod]) continue; // 文件级白名单（理由在文件头注释）
    const rawLines = (await readFile(join(SRC, 'components', f), 'utf8')).split(/\r?\n/);
    const codeLines = stripComments(rawLines);
    for (let i = 0; i < codeLines.length; i++) {
      const hits = codeLines[i].match(BETA_CLASS);
      if (!hits) continue;
      if (rawLines[i].includes('guard:allow-beta-ref')) continue;
      violations.push(
        `components/${f}:${i + 1} Core CSS 引用 Beta 类名 ${[...new Set(hits)].join(' ')}`
        + '——行尾加 /* guard:allow-beta-ref 理由 */ 或把适配移进 Beta 自己的 CSS',
      );
    }
  }

  return { title: '分层依赖方向（Core 不运行时依赖 Beta；类型/CSS 引用须登记）', violations };
}
