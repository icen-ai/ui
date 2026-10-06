// 权限域诚实呈现守卫（spec §9.0：对授权侧诚实、对受限侧沉默——违规即 CI 红）。
//  1. 泄露文案模式扫描（src/behaviors/kb-*.ts + site/src/lib/kb-*.ts）：
//     「被裁数量」型文案对受限侧构成 volume leakage（§9.0-2/5：被裁条数/条件分支一律不出现），
//     三条模式任一命中即违规；豁免：行尾注释 guard:allow-honesty + 理由。
//  2. evaluateAcl 纯函数形态钉死（kb-core.ts）：当前时间必须经 now 参数注入
//     （求值可复现、可测试），函数体内禁止直读 Date.now()。
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { ROOT, SRC, listFiles, stripComments, type GuardResult } from './shared';

/** 泄露文案模式库（命中即违规；SPEC §9.0-2 受限侧信号清单的「数量/条件」表述） */
const LEAK_PATTERNS: ReadonlyArray<{ re: RegExp; name: string }> = [
  { re: /剔(除|掉).{0,6}(条|个|块)/, name: '剔除数量型泄露' },
  { re: /被(过滤|隐藏|裁剪).{0,8}(条|个|块|篇)/, name: '被裁数量型泄露' },
  { re: /\d+\s*条.{0,4}(无权限|受限)/, name: '按权限计件型泄露' },
];

/** 行级豁免标记（须带理由） */
const EXEMPT_RE = /guard:allow-honesty/;

/** 参与扫描的文件（kb 族行为 + 文档站 kb 数据/展示件） */
async function kbTargets(): Promise<Array<{ rel: string; abs: string }>> {
  const out: Array<{ rel: string; abs: string }> = [];
  const behaviorDir = join(SRC, 'behaviors');
  for (const f of await listFiles(behaviorDir, '.ts')) {
    if (!f.startsWith('kb-')) continue;
    const abs = join(behaviorDir, f);
    out.push({ rel: `src/behaviors/${f}`, abs });
  }
  const siteLib = join(ROOT, 'site', 'src', 'lib');
  try {
    for (const f of await listFiles(siteLib, '.ts')) {
      if (!f.startsWith('kb-')) continue;
      const abs = join(siteLib, f);
      out.push({ rel: `site/src/lib/${f}`, abs });
    }
  } catch {
    /* site/ 不存在时仅扫 src（发布产物场景） */
  }
  return out;
}

/** 从 evaluateAcl 函数体起点截到下一个顶层 export（函数体探针用） */
function evaluateAclBody(src: string): string | null {
  const start = src.indexOf('export function evaluateAcl');
  if (start === -1) return null;
  const rest = src.slice(start);
  const end = rest.indexOf('\nexport ');
  return end === -1 ? rest : rest.slice(0, end);
}

export async function checkKbHonesty(): Promise<GuardResult> {
  const violations: string[] = [];

  /* 规则 1：泄露文案模式（剥块注释后扫代码行——注释里的纪律复述不算违规，字符串文案才算） */
  const targets = await kbTargets();
  for (const t of targets) {
    const raw = await readFile(t.abs, 'utf8');
    const lines = stripComments(raw.split('\n'));
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.trim() || EXEMPT_RE.test(line)) continue;
      for (const p of LEAK_PATTERNS) {
        if (p.re.test(line)) {
          violations.push(`${t.rel}:${i + 1}: ${p.name}：「${line.trim().slice(0, 60)}」`);
        }
      }
    }
  }

  /* 规则 2：evaluateAcl 纯函数形态（now 注入 + 禁 Date.now 直读） */
  const corePath = join(SRC, 'behaviors', 'kb-core.ts');
  const coreRel = relative(ROOT, corePath).replace(/\\/g, '/');
  const core = await readFile(corePath, 'utf8');
  const body = evaluateAclBody(core);
  if (!body) {
    violations.push(`${coreRel}: 未找到 evaluateAcl 函数（契约漂移？守卫需同步更新）`);
  } else {
    const sig = body.slice(0, body.indexOf(')') + 1);
    if (!/\bnow[?]?:/.test(sig)) {
      violations.push(`${coreRel}: evaluateAcl 签名缺少可注入的 now 参数（求值必须可复现、可测试）`);
    }
    if (/Date\.now\s*\(/.test(body)) {
      violations.push(`${coreRel}: evaluateAcl 函数体内直读 Date.now()——当前时间必须经 now 参数注入`);
    }
  }

  return {
    title: `权限域诚实呈现（泄露文案 ${LEAK_PATTERNS.length} 模式 + evaluateAcl 纯函数，共 ${targets.length} 个文件）`,
    violations,
  };
}
