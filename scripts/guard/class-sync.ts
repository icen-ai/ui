// 类名同步守卫：JS/TS 侧引用的组件类名必须与 CSS 侧定义同形态。
//  why：BEM 修饰族在 CSS 与 JS 模板字面量两侧各写一次（.icen-ai-msg--error ↔ `icen-ai-msg--${role}`），
//  一侧改形另一侧静默失效——单测绿（happy-dom 不管样式）、冒烟绿（不抛错），只有像素才知道。
// 规则：JS 引用「带连字符的未前缀类 X」且 CSS 中不存在 .X 但存在 .icen-X → 违规。
//   覆盖模板静态段（`ai-msg--` 前缀族按族判定）。is-* 状态类、站点本地类（demo-*/kbws-* 等）豁免。
// 豁免：行尾 /* guard:allow-class-sync 理由 */。
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, SRC, stripComments, type GuardResult } from './shared';

const SITE = join(ROOT, 'site/src');

async function walk(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, exts)));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

async function cssClassSet(): Promise<Set<string>> {
  const set = new Set<string>();
  const files = [...(await walk(SRC, ['.css'])), ...(await walk(join(SITE, 'styles'), ['.css']))];
  for (const f of files) {
    const txt = await readFile(f, 'utf8');
    for (const m of txt.matchAll(/\.((?:icen-)?[a-z][a-zA-Z0-9]*(?:(?:--|-)[a-zA-Z0-9]+)*)/g)) set.add(m[1]);
  }
  return set;
}

/** 站点壳/演示本地类：前缀名单（这些永不该进 icen- 命名空间） */
const SITE_LOCAL = /^(demo-|site-|doc-|tok-|page-|palette-|swatch|ic-|kbws-|hero-|llms-|pm-|ref-)/;
/** 状态类纪律：.is-* 永不单独出现在选择器，天然隔离 */
const STATE = /^is-/;

function tokensFromLine(line: string): string[] {
  if (!/class|classList|querySelector|closest\(|matches\(|\bh\(|setAttribute\('class'/.test(line)) return [];
  const tokens: string[] = [];
  for (const m of line.matchAll(/['"`]([^'"`]*)['"`]/g)) {
    const s = m[1];
    if (!/[a-z]-[a-z]/.test(s)) continue; /* 组件类必带连字符，元素名/role/事件天然跳过 */
    if (/^[@./]|^\w+:\/\//.test(s)) continue;
    if (s.includes(' ')) {
      /* 多类串：整串必须只含类表字符（小写/数字/连字符/空白），混入中文/标点即自由文本 */
      if (/^[a-z0-9][a-zA-Z0-9\s-]*$/.test(s)) tokens.push(...s.split(/\s+/));
      continue;
    }
    tokens.push(s);
  }
  return tokens.map((t) => t.replace(/\$\{[^}]*\}/g, '').trim()).filter(Boolean);
}

export async function checkClassSync(): Promise<GuardResult> {
  const css = await cssClassSet();
  const violations: string[] = [];
  const files = [
    ...(await walk(join(SRC, 'behaviors'), ['.ts'])),
    ...(await walk(join(SRC, 'react'), ['.tsx', '.ts'])),
    ...(await walk(join(SRC, 'vue'), ['.ts'])),
    ...(await walk(join(SITE, 'lib'), ['.ts'])),
  ];
  for (const f of files) {
    const raw = (await readFile(f, 'utf8')).split('\n');
    const code = stripComments(raw);
    for (let i = 0; i < code.length; i++) {
      const line = code[i]!;
      if (raw[i]!.includes('guard:allow-class-sync')) continue;
      for (const tok of tokensFromLine(line)) {
        if (tok.startsWith('icen-') || !tok.includes('-') || STATE.test(tok) || SITE_LOCAL.test(tok)) continue;
        if (css.has(tok)) continue;
        if (tok.endsWith('--')) {
          /* 模板静态前缀族：`x--${mod}` —— CSS 有 icen-x--* 族而无 x--* 族 → 错位 */
          const prefixedFamily = [...css].some((c) => c.startsWith(`icen-${tok}`));
          const plainFamily = [...css].some((c) => c.startsWith(tok));
          if (prefixedFamily && !plainFamily)
            violations.push(`${f.replace(ROOT + '\\', '').replace(ROOT + '/', '')}:${i + 1} 模板修饰族 \`${tok}*\` 未前缀化（CSS 仅有 .icen-${tok}*）`);
        } else if (css.has(`icen-${tok}`)) {
          violations.push(`${f.replace(ROOT + '\\', '').replace(ROOT + '/', '')}:${i + 1} '${tok}' 未前缀化（CSS 仅有 .icen-${tok}）`);
        }
      }
    }
  }
  /* 规则2（CSS 值误前缀）：CSS 关键字与类名碰撞词在值位置被加成 icen-* 必为迁移错位
     （`:icen-center`/`:icen-grid` 永非法——合法 icen-* 值只有 keyframes 动画名与 var() 引用） */
  const CSS_VALUE_WORDS = /[:;,]\s*icen-(center|grid|flex|block|inline|inline-block|none|auto|left|right|top|bottom|absolute|relative|fixed|sticky|hidden|visible|solid|dashed|bold|middle|baseline|wrap|nowrap|column|row|start|end)\b/;
  const valueScanFiles = [
    ...(await walk(join(SRC, 'behaviors'), ['.ts'])),
    ...(await walk(SITE, ['.ts', '.astro'])),
  ];
  for (const f of valueScanFiles) {
    const lines = (await readFile(f, 'utf8')).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!/style=|cssText|<style/.test(line)) continue;
      if (CSS_VALUE_WORDS.test(line))
        violations.push(`${f.replace(ROOT + '\\', '').replace(ROOT + '/', '')}:${i + 1} CSS 值位置出现 icen- 前缀关键字（迁移错位）：${line.trim().slice(0, 100)}`);
    }
  }
  return { title: '类名同步（JS 引用 ↔ CSS 定义同形态 + CSS 值关键字防撞，迁移错位零容忍）', violations };
}
