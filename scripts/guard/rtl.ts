// RTL 守卫：流向布局的物理方向属性必须迁移为 CSS 逻辑属性（mdn logical properties）。
// 范围：src/components/*.css + src/tokens/*.css（src/base.css 归并行任务，不在此扫描）。
// 物理方向只允许保留给「真正的视口物理坐标」：JS 计算的浮层定位、图表坐标系、
// 物理变体名（--sheet-left / data-icen-side='left' / --right 时间线）、开关等物理隐喻控件、
// 数字列物理对齐惯例、居中（left:50%+translate(-50%)）、CSS 字形半边构成。
// 豁免机制：
//   ① 行尾 /* guard:allow-physical 理由 */（同行，剥注释后仍可判定——先查原始行）；
//   ② 文件级白名单 PHYSICAL_FILES（文件头注释已声明豁免理由，见各文件头）。
// 新增豁免必须二选一，裸物理方向属性一律红。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SRC, listFiles, stripComments, type GuardResult } from './shared';

/* ────────────────────────────────────────────────────────────
 * 文件级白名单（file = basename；命中即豁免该文件全部物理方向命中，
 * 理由必须同时写进该文件的头注释——双向同步是纪律）
 * ──────────────────────────────────────────────────────────── */

/** 图表坐标系：plot 内百分比定位 / 参考线 / 值标签全部按物理坐标计算，RTL 不镜像。 */
const CHART_FILES = [
  'charts.css',
  'chart-area.css',
  'chart-bar.css',
  'chart-gauge.css',
  'chart-graph.css',
  'chart-heatmap.css',
  'chart-line.css',
  'chart-pie.css',
  'chart-radar.css',
  'chart-scatter.css',
  'chart-sparkline.css',
  'chart-stack.css',
];

const PHYSICAL_FILES: Record<string, string> = Object.fromEntries([
  ...CHART_FILES.map((f): [string, string] => [f, '图表坐标系物理面（plot 百分比定位/参考线/值标签，RTL 不镜像）——文件头注释已声明']),
  ['ai-diff.css', 'diff 视图是物理 LTR 代码面（行号槽/代码列/分隔线，源码不随界面方向镜像）——文件头注释已声明'],
  ['tooltip.css', 'data-icen-tooltip-side 是物理侧边契约浮层（left/right 定位与水平居中配套）——文件头注释已声明'],
]);

/** 行内豁免标记：同行出现即视为已声明理由。 */
const ALLOW_PHYSICAL_MARKER = 'guard:allow-physical';

/** 括号感知分词：把声明值按空白切分，但 calc()/var() 内的空格不切。 */
function splitTopLevel(value: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) tokens.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

export async function checkRtl(): Promise<GuardResult> {
  const violations: string[] = [];
  const compFiles = await listFiles(join(SRC, 'components'), '.css');
  const tokenFiles = await listFiles(join(SRC, 'tokens'), '.css');
  const files = [
    ...compFiles.map((f) => join('components', f)),
    ...tokenFiles.map((f) => join('tokens', f)),
  ];

  for (const rel of files) {
    const base = rel.split(/[\\/]/).pop() ?? rel;
    const fileReason = PHYSICAL_FILES[base];
    if (fileReason) continue; /* 文件级豁免：头注释已声明 */

    const raw = await readFile(join(SRC, rel), 'utf8');
    const rawLines = raw.split('\n');
    const codeLines = stripComments(rawLines);

    for (let i = 0; i < codeLines.length; i++) {
      const line = codeLines[i];
      const lineNo = i + 1;
      if (!line.trim()) continue;
      /* 豁免判定：原始行带标记即放行 */
      const annotated = rawLines[i].includes(ALLOW_PHYSICAL_MARKER);
      if (annotated) continue;

      const report = (what: string) =>
        violations.push(`${rel}:${lineNo}: ${what}（流向布局请用逻辑属性；物理保留须行尾 ${ALLOW_PHYSICAL_MARKER} 理由 或进 PHYSICAL_FILES 文件级白名单）`);

      /* 规则 1：margin/padding/border 的 left/right 长属性 */
      if (/\b(?:margin|padding|inset)-(left|right)\s*:/.test(line)) {
        report('物理方向属性');
      }
      /* 规则 2：border-left/right（含 -width/-color/-style） */
      if (/\bborder-(?:left|right)(?:-(?:width|color|style))?\s*:/.test(line)) {
        report('物理方向边框');
      }
      /* 规则 3：text-align / float / clear 的物理值 */
      if (/\btext-align\s*:\s*(?:left|right)\b/.test(line)) {
        report('物理 text-align（数字列等惯例请行尾标注豁免）');
      }
      if (/\b(?:float|clear)\s*:\s*(?:left|right)\b/.test(line)) {
        report('物理 float/clear');
      }
      /* 规则 4：独立 left:/right: 声明（浮层坐标 / 居中 / 物理变体须标注豁免） */
      if (/(?:^|[\s;{])(?:left|right)\s*:\s*[^;{}]*;/.test(line)) {
        report('物理 left/right 定位');
      }
      /* 规则 5：margin/padding 四值 shorthand 的 inline 不对称（第 2 值 ≠ 第 4 值 = 左右不同） */
      for (const m of line.matchAll(/\b(margin|padding)\s*:\s*([^;{}]+);/g)) {
        const tokens = splitTopLevel(m[2].trim());
        if (tokens.length === 4 && tokens[1] !== tokens[3]) {
          report(`非对称 ${m[1]} shorthand（左右值不同，请拆逻辑长属性或标注豁免）`);
        }
      }
      /* 规则 6：border-radius 四值 shorthand 的水平角不对称（ss≠se 或 ee≠es）；
         垂直角不对称（block 侧圆角）天然方向无关，不查 */
      for (const m of line.matchAll(/\bborder-radius\s*:\s*([^;{}]+);/g)) {
        const tokens = splitTopLevel(m[1].trim());
        if (tokens.length === 4 && (tokens[0] !== tokens[1] || tokens[2] !== tokens[3])) {
          report('水平角不对称 border-radius（请用 border-*-radius 逻辑角或标注豁免）');
        }
      }
    }
  }

  const unique = [...new Set(violations)];
  return { title: 'RTL（物理方向属性 → CSS 逻辑属性）', violations: unique };
}
