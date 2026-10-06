#!/usr/bin/env bun
/*
 * 命名空间迁移驱动（本仓库用）。
 *   bun scripts/prefix-migrate.mjs            # dry-run 报告
 *   bun scripts/prefix-migrate.mjs --write    # 落盘
 *   bun scripts/prefix-migrate.mjs --roots=src,site/src --write
 * 映射锚定 git HEAD（迁移前事实源），可重复执行且幂等。
 * 消费方项目用 npm 包内 `icen-ui migrate <paths...>`（dist/cli.mjs，读 dist/migrate-map.json）。
 */
import { buildMapFromGit, migratePaths } from './migrate-engine.mjs';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const write = args.includes('--write');
const rootsArg = args.find((a) => a.startsWith('--roots='));
const roots = rootsArg
  ? rootsArg.slice('--roots='.length).split(',').map((r) => join(uiRoot, r.trim()))
  : [join(uiRoot, 'src'), join(uiRoot, 'site', 'src'), join(uiRoot, 'scripts'), join(uiRoot, 'docs'), join(uiRoot, 'skill'), join(uiRoot, 'tests'), uiRoot + '/README.md', uiRoot + '/AGENTS.md', uiRoot + '/CLAUDE.md'].filter((p) => existsSync(p));

/* 映射优先用冻结资产（scripts/migrate-map.v1.json）；缺失才从 git HEAD 重建（仅迁移前的仓库状态可用） */
let map;
if (existsSync(join(uiRoot, 'scripts', 'migrate-map.v1.json'))) {
  map = JSON.parse(readFileSync(join(uiRoot, 'scripts', 'migrate-map.v1.json'), 'utf8'));
} else {
  map = buildMapFromGit(uiRoot);
}
/* slug 与 behavior 模块名保护：包资产名（kit 路径/CLI 参数/模块文件名），与类名同形但不转换 */
try {
  const mod = await import('./slugs.mjs');
  const slugs = Array.isArray(mod.SLUGS) ? mod.SLUGS : Object.keys(mod.SLUGS ?? {});
  const { readdirSync } = await import('node:fs');
  const behaviors = readdirSync(join(uiRoot, 'src', 'behaviors')).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, ''));
  map.protect = [...new Set([...slugs.filter((s) => typeof s === 'string'), ...behaviors])];
} catch {
  map.protect = [];
}
console.log(`映射：${Object.keys(map.classes).length} 个类名，${map.attrs.length} 个 data 属性，主题预设 ${map.themePresets.length}，变量族 ${map.varFamilies.join('/')}，保护 slug ${map.protect.length}`);

if (write || args.includes('--emit-map')) {
  mkdirSync(join(uiRoot, 'dist'), { recursive: true });
  writeFileSync(join(uiRoot, 'dist', 'migrate-map.json'), JSON.stringify(map, null, 2));
}

const { changed, warnings, scanned } = migratePaths(roots, map, { write });
console.log(`\n扫描 ${scanned} 个文件，${write ? '已改写' : '将改写'} ${changed.length} 个：`);
for (const c of changed) console.log(`  ${c.file.replace(uiRoot, '.')}  ±${c.replacements} 行`);
if (warnings.length) {
  console.log(`\n⚠ 需人工处理 ${warnings.length} 处：`);
  for (const w of [...new Set(warnings)]) console.log(`  ${w}`);
}
if (!write) console.log('\n（dry-run，加 --write 落盘）');
