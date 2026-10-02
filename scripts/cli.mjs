#!/usr/bin/env node
/*
 * @icen.ai/ui — CLI：按需引入脚手架
 * 不做 shadcn 式源码拷贝（本包是单一事实源，消费侧一律引包内产物），
 * 只解析 slug → 打印正确的一行引入（kit 入口已自动带上 CSS 与 behavior）。
 *
 * 用法：
 *   bunx --bun @icen.ai/ui add <slug...>   打印引入行（多个 slug 空格分隔）
 *   bunx --bun @icen.ai/ui list            列出全部组件 slug
 * 数据源：同目录 registry.json（构建期由 scripts/build-css.ts 写入，映射数据源为 scripts/slugs.mjs）。
 */
import { readFileSync } from 'node:fs';

const registry = JSON.parse(readFileSync(new URL('./registry.json', import.meta.url), 'utf8'));
const SLUGS = registry.slugs ?? {};

const [cmd, ...rest] = process.argv.slice(2);
const slugs = rest.filter((a) => !a.startsWith('-'));

const HELP = `@icen.ai/ui — 按需引入脚手架

  add <slug...>   打印组件的一行引入（CSS + behavior 自动带上）
  list            列出全部 ${Object.keys(SLUGS).length} 个组件 slug

示例：
  bunx --bun @icen.ai/ui add breadcrumb
  bunx --bun @icen.ai/ui add accordion tabs

前提：已安装本包（bun add @icen.ai/ui），并在入口引入 tokens：
  import '@icen.ai/ui/tokens.css';`;

function importLines(slug) {
  const meta = SLUGS[slug];
  const path = `@icen.ai/ui/kit/${slug}`;
  if (meta.init) {
    return [
      `import { ${meta.init} } from '${path}';`,
      `${meta.init}();`,
    ];
  }
  const lines = [`import '${path}';`];
  if (meta.exports) lines.push(`// 可用导出：${meta.exports.join(' / ')}`);
  return lines;
}

function suggest(bad) {
  const keys = Object.keys(SLUGS);
  return keys.filter((k) => k.includes(bad) || bad.includes(k)).slice(0, 3);
}

if (cmd === 'add' && slugs.length > 0) {
  let failed = false;
  for (const slug of slugs) {
    if (!SLUGS[slug]) {
      const near = suggest(slug);
      console.error(`✗ 未知组件「${slug}」${near.length ? `（是不是：${near.join(' / ')}？）` : '（用 list 查看全部 slug）'}`);
      failed = true;
      continue;
    }
    console.log(`\n  ${slug}`);
    for (const line of importLines(slug)) console.log(`    ${line}`);
  }
  console.log('');
  process.exit(failed ? 1 : 0);
} else if (cmd === 'list') {
  for (const [slug, meta] of Object.entries(SLUGS)) {
    const bits = [meta.css.replace(/\.css$/, '')];
    if (meta.init) bits.push(meta.init);
    console.log(`  ${slug.padEnd(14)} ${bits.join(' · ')}`);
  }
} else {
  console.log(HELP);
  process.exit(cmd === 'add' ? 1 : 0);
}
