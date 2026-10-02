// 生成 llms.txt / llms-full.txt —— 站点给模型看的文档层（https://llmstxt.org 提案形态）。
// 单一事实源：site/src/lib/components.ts 的文档注册表（slug/name/group/desc/usage）
//            + docs/spec/ai-native.md + 仓库 AGENTS.md 消费段。构建时再生成，永不漂移。
// 消费：site/package.json 的 dev/build 前置（写入 site/public/，Astro 原样拷到 dist 根）。
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_PUBLIC = join(ROOT, 'site', 'public');
const BASE = process.env.ICEN_DOCS_BASE ?? 'https://ui.icen.ai';

// bun 直读 TS 注册表；非 bun 环境兜底跳过（CI 可用 ICEN_SKIP_LLMS=1）
let REGISTRY = [];
try {
  const mod = await import(join(ROOT, 'site/src/lib/components.ts'));
  REGISTRY = mod.COMPONENTS ?? mod.default ?? [];
} catch (err) {
  if (process.env.ICEN_SKIP_LLMS === '1') process.exit(0);
  throw err;
}
if (process.env.ICEN_SKIP_LLMS === '1') process.exit(0);

const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };
const agents = read('AGENTS.md');
const consumer = agents.includes('# 第一段')
  ? agents.slice(agents.indexOf('# 第一段'), agents.indexOf('# 第二段')).trim()
  : '';
const spec = read('docs/spec/ai-native.md');

/* 复杂模块的类型面原文（dist 的 .d.mts，构建期自动内嵌 —— 零漂移的「深层 AGENTS 文档」） */
const DEEP_MODULES = [
  'ai-core', 'ai-chat', 'ai-composer', 'ai-tool', 'ai-panel', 'ai-diff', 'ai-provider', 'ai-tools', 'charts',
];

mkdirSync(SITE_PUBLIC, { recursive: true });

/* ── llms.txt：索引（名称 + 一句话 + 页面 URL，按文档站分组） ─────────────── */
const groups = new Map();
for (const c of REGISTRY) {
  if (!groups.has(c.group)) groups.set(c.group, []);
  groups.get(c.group).push(c);
}
const llms = [
  '# ICEN UI（@icen.ai/ui）',
  '',
  '> 零依赖设计系统：tokens（6 预设 × 明暗）+ 无框架组件 CSS + 行为 JS + AI 原生组件族'
    + '（7 态状态机 / 多模态内容模型 / provider 定价审计）+ 图表通用层（ChartSpec 纯 JSON，模型可直接调用）'
    + '+ 工具体系（UI 能力注册为模型工具，OpenAI/MCP/manifest 三出口）。',
  '',
  '用法：先 `bun add @icen.ai/ui`，`@import "@icen.ai/ui/tokens.css"` 再引组件；'
    + 'npm 包内 `AGENTS.md` 有消费方速查，`registry.json` 是 slug 机器清单。',
  '',
  '## 规格与手册',
  '',
  `- [AGENTS.md 消费方速查 + ai-native 规格 + 组件全表（全文）](${BASE}/llms-full.txt): 安装颗粒度/图表/AI 族/绑定/Provider/工具体系，全部带可复制示例`,
];
for (const [g, items] of groups) {
  llms.push('', `## ${g}`);
  for (const c of items) {
    const d = String(c.desc ?? '').split(/[。；;（(]/)[0];
    llms.push(`- [${c.name}（${c.slug}）](${BASE}/components/${c.slug}/): ${d}`);
  }
}
llms.push('');
writeFileSync(join(SITE_PUBLIC, 'llms.txt'), llms.join('\n'), 'utf8');

/* ── llms-full.txt：全文（手册 + 规格 + 每组件 desc + usage 示例） ─────────── */
const full = [
  '# ICEN UI（@icen.ai/ui）— 全量文档（llms-full.txt）',
  '',
  `站点: ${BASE} · 索引: ${BASE}/llms.txt · npm: @icen.ai/ui`,
  '',
  '════════════════════════════════════════════════════════',
  '## AGENTS.md 消费方速查',
  '════════════════════════════════════════════════════════',
  '',
  consumer || '（见 npm 包内 AGENTS.md）',
  '',
  '════════════════════════════════════════════════════════',
  '## ai-native 规格（docs/spec/ai-native.md）',
  '════════════════════════════════════════════════════════',
  '',
  spec || '（见仓库 docs/spec/ai-native.md）',
  '',
  '════════════════════════════════════════════════════════',
  '## API 类型面（复杂模块 .d.mts 原文，含全部 JSDoc 约束注释）',
  '════════════════════════════════════════════════════════',
  '',
  '以下为 npm 包内 `dist/behaviors/<模块>.d.mts` 的构建期快照——接口/类型/字段约束的唯一真相，',
  '与包内文件同源生成，永不漂移。其余模块类型面更薄，直接读包内同名 .d.mts。',
];
for (const m of DEEP_MODULES) {
  const d = read(`dist/behaviors/${m}.d.mts`);
  if (d) full.push('', `### behaviors/${m}.d.mts`, '', '```ts', d.trim(), '```');
}
full.push(
  '',
  '════════════════════════════════════════════════════════',
  '## 组件全表（desc + usage）',
  '════════════════════════════════════════════════════════',
);
for (const [g, items] of groups) {
  full.push('', `### ${g}`);
  for (const c of items) {
    full.push('', `#### ${c.name}（${c.slug}）`, '', String(c.desc ?? ''));
    if (c.usage) full.push('', '```ts', String(c.usage).trim(), '```');
  }
}
full.push('');
writeFileSync(join(SITE_PUBLIC, 'llms-full.txt'), full.join('\n'), 'utf8');

console.log(`llms.txt (${groups.size} 组 / ${REGISTRY.length} 组件) + llms-full.txt 已写入 site/public/`);
