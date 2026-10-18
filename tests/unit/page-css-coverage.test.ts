/* 页面 CSS 覆盖审计：Base 布局系页面是选择性引 CSS（不像 Docs 全量 glob），
 * 「用了类但没引对应 CSS」会让组件裸奔（黑框 segmented 事故）。
 * 两道对账：
 *   ① 页面 markup/脚本里出现的 icen-* 类 → 归属 CSS 文件必须在引入清单内
 *   ② 页面脚本 import 的 render* 函数 → 对应图表/AI 族 CSS 必须在引入清单内
 * Docs 布局页（组件文档等）走 component-css 全量 glob，不在此列。
 */
import { test, expect } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const SRC = join(ROOT, 'src');
const SITE = join(ROOT, 'site/src');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/* 类 → 归属文件集合（库源码 + 站点样式表；注释不算归属）。
 * 覆盖判定（三层）：
 *   ① 站点样式表定义的类 = 站点自有 chrome，引了该站点样式即覆盖；
 *   ② 有族文件（icen-<fam>-* → components/<fam>.css）→ 族文件必须引入
 *     （防「被别的文件 :is() 顺手提了一嘴」的半裸：icen-table 只靠 material.css 的数字特性不算覆盖）；
 *   ③ 无族文件 → 任一归属文件已引即可。 */
const cssFiles = [
  'base.css',
  ...readdirSync(join(SRC, 'tokens')).filter((f) => f.endsWith('.css')).map((f) => `tokens/${f}`),
  ...readdirSync(join(SRC, 'components')).filter((f) => f.endsWith('.css')).map((f) => `components/${f}`),
];
const componentFiles = new Set(cssFiles.filter((f) => f.startsWith('components/')).map((f) => f.split('/').pop()!));
const FAMILY_ALIAS: Record<string, string> = { chart: 'charts.css' };
const siteCssFiles = readdirSync(join(SITE, 'styles')).filter((f) => f.endsWith('.css'));
const classOwner = new Map<string, Set<string>>();
const siteOwned = new Set<string>();
const absorb = (css: string, key: string, isSite: boolean) => {
  for (const m of stripComments(css).matchAll(/\.(icen-[\w-]+)/g)) {
    if (!classOwner.has(m[1])) classOwner.set(m[1], new Set());
    classOwner.get(m[1])!.add(key);
    if (isSite) siteOwned.add(m[1]);
  }
};
for (const f of cssFiles) absorb(readFileSync(join(SRC, f), 'utf8'), f.split('/').pop()!, false);
for (const f of siteCssFiles) absorb(readFileSync(join(SITE, 'styles', f), 'utf8'), f, true);

function covered(cls: string, imported: Set<string>): boolean {
  const owners = classOwner.get(cls);
  if (!owners) return true; /* 页面临时类 / 修饰态，不归属任何 CSS 文件 */
  for (const f of owners) if (siteCssFiles.includes(f) && imported.has(f)) return true;
  const fam = cls.split('-')[1];
  const famFile = componentFiles.has(`${fam}.css`) ? `${fam}.css` : FAMILY_ALIAS[fam];
  if (famFile) return imported.has(famFile);
  return [...owners].some((f) => imported.has(f));
}

/* render* 函数 → 必须的 CSS 文件（证据来自各组件 CSS 的根类归属） */
const RENDER_CSS: Record<string, string[]> = {
  renderLine: ['chart-line.css'], renderArea: ['chart-area.css'],
  renderVBar: ['chart-bar.css'], renderHBar: ['chart-bar.css'],
  renderDonut: ['chart-pie.css'], renderRadar: ['chart-radar.css'],
  renderHeatmap: ['chart-heatmap.css'], renderCalendar: ['chart-heatmap.css'],
  renderGauge: ['chart-gauge.css'], renderSparkline: ['chart-sparkline.css'],
  renderScatter: ['chart-scatter.css'], renderStack: ['chart-stack.css'],
  renderChart: ['charts.css'],
  renderAiMessage: ['ai-chat.css'], renderAiTodo: ['ai-panel.css', 'ai-chat.css'],
  renderAiUsageRing: ['ai-panel.css', 'ai-chat.css'], renderAiToolCall: ['ai-tool.css'],
};

const TARGETS: Array<{ page: string; extra: string[] }> = [
  {
    page: 'pages/index.astro',
    extra: ['layouts/Base.astro', 'components/SiteHeader.astro', 'components/SiteFooter.astro', 'components/ThemeRestore.astro', 'components/CodeBlock.astro', 'components/PmInstall.astro'],
  },
  { page: 'pages/modern.astro', extra: [] },
  { page: 'pages/kb.astro', extra: [] },
];

for (const { page, extra } of TARGETS) {
  test(`${page}：用到的 icen-* 类与 render* 函数的 CSS 都已引入`, () => {
    const files = [page, ...extra];
    const imported = new Set<string>();
    const used = new Set<string>();
    const renders = new Set<string>();
    for (const rel of files) {
      const src = readFileSync(join(SITE, rel), 'utf8');
      for (const m of src.matchAll(/import\s+'[^']*\/([\w-]+\.css)'/g)) imported.add(m[1]);
      for (const m of src.matchAll(/class(?:es)?(?::list)?=\{?\[?"([^"]+)"/g))
        m[1].split(/\s+/).forEach((c) => { if (c.startsWith('icen-')) used.add(c); });
      /* 脚本/模板字符串里以引号出现的类名（如 h('span','icen-…')） */
      for (const m of src.matchAll(/['"`](icen-[\w-]+)['"`]/g)) used.add(m[1]);
      for (const m of src.matchAll(/\b(render[A-Z]\w*)\s*[,(]/g)) {
        if (RENDER_CSS[m[1]]) renders.add(m[1]);
      }
    }
    const bareClasses = [...used].filter((c) => !covered(c, imported));
    const bareRenders = [...renders].filter((fn) =>
      !RENDER_CSS[fn].some((f) => imported.has(f)));
    expect(bareClasses).toEqual([]);
    expect(bareRenders).toEqual([]);
  });
}
