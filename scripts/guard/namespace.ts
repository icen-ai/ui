// 命名空间守卫：库自有类名必须 icen- 前缀（.is-* 状态类豁免）、
// 库自有 data 钩子必须 data-icen- 前缀、全局变量族必须 --icen-*——
// 与 Bootstrap 类名表的碰撞报告应恒为零（类名防冲突的验收证明）。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SRC, listFiles, type GuardResult } from './shared';

/** 业界主流全局类名抽样（Bootstrap 5 全量核心 + Tailwind 常见自定义层）：碰撞面审计基准。 */
const INDUSTRY_CLASSES = [
  'btn', 'card', 'modal', 'table', 'form', 'input', 'select', 'nav', 'menu', 'tabs', 'toast',
  'alert', 'badge', 'pill', 'tag', 'panel', 'stat', 'empty', 'tree', 'slider', 'upload', 'sidebar',
  'tooltip', 'popover', 'dropdown', 'carousel', 'accordion', 'breadcrumb', 'pagination', 'steps',
  'switch', 'rating', 'progress', 'spinner', 'skeleton', 'avatar', 'media', 'content', 'list',
  'grid', 'stack', 'divider', 'surface', 'field', 'control', 'pressable', 'lift', 'dark', 'active',
  'show', 'hide', 'collapse', 'fade', 'close', 'open', 'disabled', 'readonly', 'checked', 'selected',
];

const CLASS_RE = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
const ATTR_RE = /\[(data-[a-z0-9-]+)/g;
const VAR_DEF_RE = /(?<![\w-])--(token|density|radius|duration|ease|z|font|accent|bg|text|border|color|shadow|line-height|letter-spacing)-/g;

export async function checkNamespace(): Promise<GuardResult> {
  const violations: string[] = [];
  const cssFiles = [
    ...(await listFiles(join(SRC, 'components'), '.css')).map((f) => join('components', f)),
    ...(await listFiles(join(SRC, 'tokens'), '.css')).map((f) => join('tokens', f)),
    'base.css',
  ];
  const libClasses = new Set<string>();
  const sanitize = (text: string) => text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\([^)]*\)/g, '')           // url() 内的 .com/.woff2 等不误报
    .replace(/(['"])[^'"\n]*\1/g, '');       // 字符串字面量（format("woff2") 等）
  for (const rel of cssFiles) {
    const text = sanitize(await readFile(join(SRC, rel), 'utf8'));
    for (const m of text.matchAll(CLASS_RE)) {
      const name = m[1];
      if (name.startsWith('icen-') || name.startsWith('is-')) continue;
      violations.push(`${rel}: 类名 .${name} 缺少 icen- 前缀（命名空间纪律：库自有类一律 .icen-*）`);
      libClasses.add(name);
    }
    for (const m of text.matchAll(ATTR_RE)) {
      const attr = m[1];
      if (attr.startsWith('data-icen-')) continue;
      violations.push(`${rel}: 属性选择器 [${attr}] 缺少 data-icen- 前缀`);
    }
    for (const m of text.matchAll(VAR_DEF_RE)) {
      violations.push(`${rel}: 全局变量 --${m[1]}- 缺少 --icen- 前缀（7 族 token 一律 --icen-*）`);
    }
  }
  /* 行为层的 data 钩子（querySelector/getAttribute/dataset 等字面量） */
  for (const f of await listFiles(join(SRC, 'behaviors'), '.ts')) {
    const text = await readFile(join(SRC, 'behaviors', f), 'utf8');
    for (const m of text.matchAll(/['"`](\[?)(data-[a-z0-9-]+)/g)) {
      const attr = m[2];
      if (attr.startsWith('data-icen-')) continue;
      violations.push(`behaviors/${f}: data 钩子 ${attr} 缺少 data-icen- 前缀`);
    }
  }
  /* 业界碰撞面：库当前类名与 INDUSTRY_CLASSES 的交集应恒为空（全部已 icen- 化） */
  const collisions: string[] = [];
  for (const rel of cssFiles) {
    const text = sanitize(await readFile(join(SRC, rel), 'utf8'));
    for (const m of text.matchAll(CLASS_RE)) {
      if (INDUSTRY_CLASSES.includes(m[1])) collisions.push(m[1]);
    }
  }
  if (collisions.length) {
    violations.push(`与业界主流类名碰撞 ${collisions.length} 个：${[...new Set(collisions)].join(' / ')}`);
  }
  return { title: `命名空间（icen- 类名 / data-icen- 钩子 / --icen- 变量族；业界碰撞面 ${INDUSTRY_CLASSES.length} 类基准）`, violations };
}
