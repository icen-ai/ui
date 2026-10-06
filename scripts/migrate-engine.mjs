#!/usr/bin/env bun
/*
 * @icen.ai/ui — 命名空间迁移引擎（scripts/prefix-migrate.mjs 与 dist/cli.mjs 共用）
 *
 * 把「全局 CSS 设计系统」的命名空间冲突面收敛到零（对齐 GOV.UK `govuk-` /
 * Spectrum `spectrum-` / Bootstrap `data-bs-*` / Carbon `bx--` 的业界实践）：
 *
 *   1. 组件类名      .btn            → .icen-btn（.is-* 状态类不前缀——纪律：永不单独出现，
 *                                          永远与根类复合 .icen-tab.is-active，天然隔离）
 *   2. 主题层        .piano / .dark / .style-retro（挂在 <html> 上的类）
 *                                   → data-icen-preset / data-icen-theme="dark" / data-icen-style
 *                     （.dark 是全业界最危险的类名；类→data 属性是唯一彻底隔离的形态）
 *   3. data 钩子     data-tabs       → data-icen-tabs（全量，含 ai/kb 族——统一一条心智规则：
 *                                          库拥有的钩子一律 data-icen- 前缀）
 *   4. 全局 CSS 变量 --token- / --density- / --radius- / --duration- / --ease- / --z- / --font-
 *                                   → --icen-token- 等 7 族；组件作用域变量（--btn-/--ai- 等）
 *                                     不前缀——只随根类作用于子树，根类已前缀即继承链已隔离
 *
 * 设计要点：
 *   - 代码文件走逐字符 tokenizer（字符串/模板/注释/正则字面量四态），标识符永不被误改；
 *   - 幂等：所有规则带边界守卫，已迁移文件再跑零变更；
 *   - 引擎与映射分离：buildMap() 从 ui 源码 CSS 提取；消费方 CLI 用构建期内嵌的 migrate-map.json。
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execSync } from 'node:child_process';

/* ───────────────────────── 映射构建（从 ui 源码提取） ───────────────────────── */

const THEME_PRESETS = ['clay', 'piano', 'art', 'vangogh', 'ink', 'retro'];
const THEME_STYLES = ['modern', 'retro', 'terminal'];
export const VAR_FAMILIES = ['token', 'density', 'radius', 'duration', 'ease', 'z', 'font', 'accent', 'bg', 'text', 'border', 'color', 'shadow', 'line-height', 'letter-spacing'];

/** 去掉 CSS 注释（契约头注释里的示例类名不应进入映射）。 */
function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

/** 仅从 { 之前的选择器段提取类名（@media/@supports 前奏与声明体跳过）。 */
export function extractClassesFromCss(cssText) {
  const text = stripCssComments(cssText);
  const classes = new Set();
  /* '{' 用 lookahead 不消费——否则 @media 前奏匹配会吃掉嵌套规则的分界符（.motion 漏网根因） */
  for (const m of text.matchAll(/(^|[{},])\s*([^{}@][^{}]*?)(?=\{)/g)) {
    const sel = m[2].trim();
    if (!sel || sel.includes('@')) continue;
    if (/^[a-zA-Z-]+\s*:/.test(sel)) continue; // 声明行兜底
    if (/^(from|to|\d+(\.\d+)?%)$/.test(sel)) continue; // keyframes 帧
    for (const cm of sel.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) classes.add(cm[1]);
  }
  return classes;
}

/** data-* 属性：CSS 属性选择器 + TS 源码字面量（含 startsWith/模板前缀形态 'data-chart-'）。 */
export function extractDataAttrs(text) {
  const attrs = new Set();
  for (const m of text.matchAll(/\bdata-[a-z0-9-]*[a-z0-9]/g)) attrs.add(m[0]);
  for (const m of text.matchAll(/['"`](data-[a-z0-9-]+-)['"`]/g)) attrs.add(m[1]);
  return attrs;
}

function camelize(attr) {
  return attr.replace(/^data-/, '').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** 从 ui 源码目录构建迁移映射（工作树版——仅适合尚未迁移的源码）。 */
export function buildMap(uiSrcDir) {
  const cssFiles = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir)) {
      const p = join(dir, ent);
      if (statSync(p).isDirectory()) walk(p);
      else if (ent.endsWith('.css')) cssFiles.push(p);
    }
  };
  walk(uiSrcDir);
  const cssTexts = cssFiles.map((f) => readFileSync(f, 'utf8'));
  const tsTexts = [];
  const behDir = join(uiSrcDir, 'behaviors');
  if (existsSync(behDir)) {
    for (const ent of readdirSync(behDir)) {
      if (!ent.endsWith('.ts')) continue;
      tsTexts.push(readFileSync(join(behDir, ent), 'utf8'));
    }
  }
  return buildMapFromTexts(cssTexts, tsTexts);
}

/**
 * 从 git HEAD 构建迁移映射（锚定迁移前事实源——工作树已部分迁移时仍安全）。
 * 迁移是「HEAD 旧形态 → 新形态」的确定性映射，可重复执行且幂等。
 */
export function buildMapFromGit(repoRoot) {
  const listing = execSync('git ls-tree -r --name-only HEAD src', { cwd: repoRoot, encoding: 'utf8' });
  const paths = listing.split('\n').filter((p) =>
    p.endsWith('.css') || (p.startsWith('src/behaviors') && p.endsWith('.ts')));
  const cssTexts = [];
  const tsTexts = [];
  for (const p of paths) {
    try {
      const text = execSync(`git show "HEAD:${p}"`, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (p.endsWith('.css')) cssTexts.push(text);
      else tsTexts.push(text);
    } catch { /* 新增文件不在 HEAD，跳过 */ }
  }
  return buildMapFromTexts(cssTexts, tsTexts);
}

function buildMapFromTexts(cssTexts, tsTexts) {
  const rawClasses = new Set();
  const attrs = new Set();
  for (const text of cssTexts) {
    if (!text) continue;
    for (const c of extractClassesFromCss(text)) rawClasses.add(c);
    for (const a of extractDataAttrs(text)) attrs.add(a);
  }
  for (const text of tsTexts) {
    if (!text) continue;
    for (const a of extractDataAttrs(text)) attrs.add(a);
  }

  const classes = {};
  const skipped = [];
  for (const name of [...rawClasses].sort()) {
    if (name.startsWith('is-')) { skipped.push(name); continue; }
    if (name.startsWith('icen-')) { skipped.push(name); continue; }      // 幂等防线：已迁移形态不进映射
    if (name === 'dark' || THEME_PRESETS.includes(name)) { skipped.push(name); continue; }
    if (THEME_STYLES.some((s) => name === `style-${s}`)) { skipped.push(name); continue; }
    classes[name] = `icen-${name}`;
  }
  attrs.delete('data-theme');
  const attrList = [...attrs].filter((a) => !a.startsWith('data-icen-') && !a.startsWith('data-astro-')).sort();

  return {
    version: 1,
    classes,
    stateClassPrefix: 'is-',
    attrs: attrList,
    themePresets: THEME_PRESETS,
    themeStyles: THEME_STYLES,
    varFamilies: VAR_FAMILIES,
    skippedThemeClasses: skipped,
  };
}

/* ───────────────────────── 正则集编译 ───────────────────────── */

const CLASS_EDGE = 'a-zA-Z0-9_-';
function esc(re) { return re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function compileMap(map) {
  const classNames = Object.keys(map.classes).sort((a, b) => b.length - a.length);
  const classAlt = classNames.map(esc).join('|');
  const attrs = [...map.attrs].sort((a, b) => b.length - a.length);
  const attrAlt = attrs.map(esc).join('|');
  const camelMap = new Map(attrs.map((a) => {
    const c = camelize(a);
    return [c, 'icen' + c[0].toUpperCase() + c.slice(1)];
  }));
  const camelAlt = [...camelMap.keys()].sort((a, b) => b.length - a.length).map(esc).join('|');
  const themeClassAlt = ['dark', ...map.themePresets.filter((p) => p !== 'clay'), ...map.themeStyles.map((s) => `style-${s}`)].map(esc).join('|');
  const varAlt = map.varFamilies.map(esc).join('|');
  return {
    classSet: new Map(Object.entries(map.classes)),
    attrSet: new Set(attrs),
    camelMap,
    protectSet: new Set(map.protect ?? []),
    themePresets: map.themePresets,
    themeStyles: map.themeStyles,
    /* .name 带点形式。故意不加左边界——复合选择器 .a.b 的第二个类点号前是单词字符；
       误伤防护靠「类名表只含库自有类」（file.css 的 css 不在表内）。 */
    reDotClass: classAlt ? new RegExp(`\\.(${classAlt})(?![a-zA-Z0-9-])`, 'g') : null,
    reAttrSelector: attrAlt ? new RegExp(`\\[(${attrAlt})(?![a-z0-9-])`, 'g') : null,
    reAttrName: attrAlt ? new RegExp(`(?<![a-zA-Z0-9-])(${attrAlt})(?=[=\\s>])`, 'g') : null,
    reBareClass: classAlt ? new RegExp(`(?<![${CLASS_EDGE}])(${classAlt})(?![a-zA-Z0-9-])`, 'g') : null,
    reBareAttr: attrAlt ? new RegExp(`(?<![a-zA-Z0-9-])(${attrAlt})(?![a-z0-9-])`, 'g') : null,
    reDataset: camelAlt ? new RegExp(`\\bdataset\\.(${camelAlt})\\b`, 'g') : null,
    reVar: new RegExp(`(?<![a-zA-Z0-9-])--(${varAlt})-`, 'g'),
    reThemeClass: themeClassAlt ? new RegExp(`(?<![${CLASS_EDGE}])(${themeClassAlt})(?![a-zA-Z0-9-])`, 'g') : null,
    reThemeDot: themeClassAlt ? new RegExp(`\\.(${themeClassAlt})(?![a-zA-Z0-9-])`, 'g') : null,
  };
}

function themeSelectorReplacement(name) {
  if (name === 'dark') return '[data-icen-theme="dark"]';
  if (name.startsWith('style-')) return `[data-icen-style="${name.slice(6)}"]`;
  return `[data-icen-preset="${name}"]`;
}

/* ───────────────────────── CSS / 注释 / 标记 ───────────────────────── */

/** 契约注释迁移：跨行 class="..."（token 原地替换）+ 逐行点/属性/裸 data-x/变量族。 */
function migrateComment(text, R) {
  let out = text;
  out = out.replace(/\bclass=(["'])((?:(?!\1)[\s\S])*?)\1/g, (m, q, list) => {
    const adds = [];
    let newList = list
      .replace(/(^|\s+)dark(?=\s|$)/g, (mm, pre) => { adds.push('data-icen-theme="dark"'); return pre; })
      .replace(/(^|\s+)style-(modern|retro|terminal)(?=\s|$)/g, (mm, pre, s) => { adds.push(`data-icen-style="${s}"`); return pre; })
      .replace(/(^|\s+)(piano|art|vangogh|ink|retro)(?=\s|$)/g, (mm, pre, p) => { adds.push(`data-icen-preset="${p}"`); return pre; });
    newList = newList.replace(/[^\s]+/g, (t) => R.classSet.get(t) ?? t);
    return `class=${q}${newList}${q}${adds.length ? ' ' + adds.join(' ') : ''}`;
  });
  out = out.split('\n').map((line) => {
    let l = line.replace(R.reVar, (_, fam) => `--icen-${fam}-`);
    if (R.reThemeDot) l = l.replace(R.reThemeDot, (_, name) => themeSelectorReplacement(name));
    if (R.reDotClass) l = l.replace(R.reDotClass, (_, name) => `.${R.classSet.get(name)}`);
    if (R.reAttrSelector) l = l.replace(R.reAttrSelector, (_, a) => `[data-icen-${a.slice(5)}`);
    if (R.reBareAttr) l = l.replace(R.reBareAttr, (_, a) => `data-icen-${a.slice(5)}`);
    if ((l.includes('<') || l.includes('class=')) && R.reBareClass) {
      l = l.replace(R.reBareClass, (m2, name, offset, whole) => {
        if (whole[offset - 1] === '.') return m2;
        if (R.protectSet.has(name)) return m2;
        return R.classSet.get(name);
      });
    }
    return l;
  }).join('\n');
  return out;
}

/** CSS 文本（含 <style> 块；头注释契约也一并处理）。 */
export function migrateCssText(text, R, warnings, file) {
  let out = text;
  out = out.replace(R.reVar, (_, fam) => `--icen-${fam}-`);
  if (R.reThemeDot) out = out.replace(R.reThemeDot, (_, name) => themeSelectorReplacement(name));
  if (R.reDotClass) out = out.replace(R.reDotClass, (_, name) => `.${R.classSet.get(name)}`);
  if (R.reAttrSelector) out = out.replace(R.reAttrSelector, (_, a) => `[data-icen-${a.slice(5)}`);
  out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => migrateComment(m, R));
  return out;
}

/** HTML 标记（.astro/.html/.vue 与 .md 中的 HTML）。 */
export function migrateMarkupText(text, R, warnings, file) {
  let out = text;
  out = out.replace(/\b(class|className)=(["'])((?:(?!\2)[^<>])*?)\2/g, (m, attr, q, list) => {
    const adds = [];
    let newList = list
      .replace(/(^|\s+)dark(?=\s|$)/g, (mm, pre) => { adds.push('data-icen-theme="dark"'); return pre; })
      .replace(/(^|\s+)style-(modern|retro|terminal)(?=\s|$)/g, (mm, pre, s) => { adds.push(`data-icen-style="${s}"`); return pre; })
      .replace(/(^|\s+)(piano|art|vangogh|ink|retro)(?=\s|$)/g, (mm, pre, p) => { adds.push(`data-icen-preset="${p}"`); return pre; });
    newList = newList.replace(/[^\s]+/g, (t) => R.classSet.get(t) ?? t);
    return `${attr}=${q}${newList}${q}${adds.length ? ' ' + adds.join(' ') : ''}`;
  });
  if (R.reAttrName) out = out.replace(R.reAttrName, (_, a) => `data-icen-${a.slice(5)}`);
  out = out.replace(R.reVar, (_, fam) => `--icen-${fam}-`);
  return out;
}

/* ───────────────────────── 代码 tokenizer（逐字符，四态） ───────────────────────── */

const SELECTOR_HINT = /^[.\[#:&*>+~a-zA-Z0-9_\- '"=()$%,\]]/;
const PROSE_HINT = /[，。；？！、一-鿿]|\.{3}|\w+[.!?]\s/;

function migrateStringContent(content, R, warnings, file, protectedCtx) {
  /* 事件名整串（'icen:tab-change'）原样；只是「包含」icen: 文本的长内容（demo HTML 的 placeholder 等）不误伤 */
  if (/^icen:[a-z0-9-]+$/.test(content.trim())) return content;
  const trimmed0 = content.trim();
  /* slug/模块名语境（slug: '…'、behaviors: […]、behaviorInit: {'…'}）里的保护 token 不转换——
     它们是包资产名；同样的拼写在 className/类表语境是类名，必须转（由 protectedCtx 区分） */
  if (protectedCtx && R.protectSet.has(trimmed0)) return content;
  /* 模块说明符/路径形态原样返回（'./behaviors/toast'、'@icen.ai/ui/tokens.css'、'x/y/z'） */
  if (/^(\.{1,2}\/|@?[\w.-]+\/)[\w@./-]*$/.test(trimmed0)) return content;
  if (/^[a-z0-9@./_-]+\.(css|mjs|ts|js|json|astro|svg|png|woff2?)$/i.test(trimmed0)) return content;
  let out = content;
  /* 单 token 且「类名 ∩ HTML 标签名/领域词」（input/select/table/form/center/steps…）：
     可能是 h() 造元素、DOM 枚举值或数据字段——不静默转换，交人工（classList 语境走 'class' 模式不会到这里） */
  if ((HTML_TAGS.has(trimmed0) || AMBIGUOUS_TOKENS.has(trimmed0)) && R.classSet.has(trimmed0)) {
    warnings.push(`${file}: 字符串 '${trimmed0}' 同为类名与标签/领域词，已跳过自动转换（若为类用法请手动改 'icen-${trimmed0}'）`);
    return content;
  }
  /* 字符串里的标记片段（模板里的 <html class="piano dark"> 等）走标记规则 */
  if (/<[a-zA-Z]/.test(content) && /class=|data-[a-z]/.test(content)) {
    out = migrateMarkupText(out, R, warnings, file);
  }
  /* 字符串里的代码片段（demo script 模板里的 JS：className = 'ai-files' 等嵌套引号形态）递归走代码 tokenizer。
     与上面标记分支不互斥：demo 模板往往 markup 与 JS 混排（<div> 片段 + className='x' 赋值共存） */
  if (/['"]/.test(content) && /\b(const|let|var|function|await|return|if|for)\b|=>|\.class(Name|List)/.test(content)) {
    out = migrateCodeText(out, R, warnings, file);
  }
  out = out.replace(R.reVar, (_, fam) => `--icen-${fam}-`);
  const trimmed = content.trim();
  const looksSelector = SELECTOR_HINT.test(trimmed) && !PROSE_HINT.test(content)
    && (/[.[\]#:]/.test(trimmed) || /^[a-z0-9-]+( [a-z0-9-]+)*$/.test(trimmed));
  if (looksSelector) {
    if (R.reThemeDot) out = out.replace(R.reThemeDot, (_, name) => themeSelectorReplacement(name));
    if (R.reDotClass) out = out.replace(R.reDotClass, (_, name) => `.${R.classSet.get(name)}`);
    if (R.reAttrSelector) out = out.replace(R.reAttrSelector, (_, a) => `[data-icen-${a.slice(5)}`);
    if (R.reBareAttr) out = out.replace(R.reBareAttr, (_, a) => `data-icen-${a.slice(5)}`);
    if (R.reBareClass) {
      out = out.replace(R.reBareClass, (m, name, offset, whole) => {
        if (whole[offset - 1] === '.') return m;
        if (protectedCtx && R.protectSet.has(name)) return m;
        return R.classSet.get(name);
      });
    }
    if (R.reThemeClass) {
      out = out.replace(R.reThemeClass, (m, name, offset, whole) => {
        if (whole[offset - 1] === '.') return m;
        warnings.push(`${file}: 代码字符串中的主题类 '${name}' 需人工改为 data 属性（${trimmed.slice(0, 60)}）`);
        return m;
      });
    }
  } else {
    if (R.reBareAttr) out = out.replace(R.reBareAttr, (_, a) => `data-icen-${a.slice(5)}`);
    const t = trimmed;
    if (R.classSet.has(t)) {
      if (HTML_TAGS.has(t)) {
        /* 类名 ∩ 标签名：可能是 createElement 辅助 h('input') 或领域键——不静默转换，人工确认 */
        warnings.push(`${file}: 字符串 '${t}' 同为类名与 HTML 标签名，已跳过自动转换（若为类用法请手动改 'icen-${t}'）`);
      } else {
        out = out.replace(new RegExp(`(?<![${CLASS_EDGE}])${esc(t)}(?![a-zA-Z0-9-])`, 'g'), R.classSet.get(t));
      }
    } else if (t === 'dark' || t.startsWith('style-')) {
      warnings.push(`${file}: 代码中的主题类 '${t}' 需人工迁移（classList→data 属性）`);
    }
  }
  return out;
}

/**
 * API 感知的字符串迁移模式：
 *   selector — querySelector/querySelectorAll/matches/closest：只转 .类 与 [data-]，裸 token 是元素选择器
 *   raw      — createElement/createElementNS 的 tag 名、模块说明符：原样
 *   attr     — setAttribute/getAttribute 等的属性名实参：只转 data-x
 *   auto     — 其余（classList/类表/选择器串试探）
 */
function stringModeFor(ident, dotted, argIndex) {
  if (ident === 'querySelector' || ident === 'querySelectorAll' || ident === 'matches' || ident === 'closest') return 'selector';
  if (ident === 'createElement' || ident === 'createElementNS') return 'raw';
  if ((ident === 'setAttribute' || ident === 'getAttribute' || ident === 'hasAttribute'
    || ident === 'removeAttribute' || ident === 'toggleAttribute' || ident === 'setAttributeNS') && argIndex === 0) return 'attr';
  if (dotted === 'classList' && (ident === 'add' || ident === 'remove' || ident === 'toggle' || ident === 'contains' || ident === 'replace')) return 'class';
  return 'auto';
}

const HTML_TAGS = new Set(('a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s samp script section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr').split(' '));

/* 类名 ∩ 常见领域词（DOM 枚举值 / 数据字段名）：单 token 自动模式下歧义，警告并跳过 */
const AMBIGUOUS_TOKENS = new Set(('center ops chart accent left right top bottom start end auto none all current open closed checked selected disabled hidden readonly required value label title name type key index count total icon text note meta time date user role state status mode size width height min max step rows cols data items options fields rules actions events marks links files pages groups views panels cards lists steps desc').split(' '));

function migrateStringByMode(content, mode, R, warnings, file, protectedCtx) {
  if (mode === 'raw') return content;
  if (mode === 'attr') {
    return content.replace(R.reBareAttr ?? /$^/g, (_, a) => `data-icen-${a.slice(5)}`);
  }
  if (mode === 'selector') {
    let out = content.replace(R.reVar, (_, fam) => `--icen-${fam}-`);
    if (R.reThemeDot) out = out.replace(R.reThemeDot, (_, name) => themeSelectorReplacement(name));
    if (R.reDotClass) out = out.replace(R.reDotClass, (_, name) => `.${R.classSet.get(name)}`);
    if (R.reAttrSelector) out = out.replace(R.reAttrSelector, (_, a) => `[data-icen-${a.slice(5)}`);
    return out;
  }
  if (mode === 'class') {
    const t = content.trim();
    if (R.classSet.has(t)) return content.replace(t, R.classSet.get(t));
    return content;
  }
  return migrateStringContent(content, R, warnings, file, protectedCtx);
}
function isRegexContext(prevSig, prevWord) {
  if (prevSig === '') return true;
  if ('(=,:;!&|?{}[]+-*%<>^~'.includes(prevSig)) return true;
  return /^(return|typeof|case|delete|void|in|of|instanceof|new|yield|await|else|do)$/.test(prevWord);
}

/** 判定字符串是否处于 slug/模块名注册语境（据上游已产出文本的尾部形态）。 */
function inRegistryCtx(out) {
  return /(slug|behaviors|behaviorInit|init|module|modules)\s*:\s*(\[[^\]]*)?$/.test(out.slice(-80));
}

/**
 * 代码文本迁移（逐字符 tokenizer）：
 *   字符串/模板静态段 → migrateStringContent；注释 → migrateComment；
 *   正则字面量原样保留；dataset.x → dataset.icenX；标识符绝不触碰。
 */
export function migrateCodeText(text, R, warnings, file) {
  let out = '';
  let i = 0;
  const n = text.length;
  let prevSig = '';       // 前一有效字符（非空白非注释）
  let prevWord = '';      // 前一标识符单词
  const parenStack = [];  // [{ mode, arg }] — API 感知字符串迁移模式
  const curMode = () => (parenStack.length ? parenStack[parenStack.length - 1].mode : 'auto');
  while (i < n) {
    const ch = text[i];
    const two = text.slice(i, i + 2);

    /* 行注释 */
    if (two === '//') {
      let j = text.indexOf('\n', i);
      if (j === -1) j = n;
      out += migrateComment(text.slice(i, j), R);
      i = j;
      continue;
    }
    /* 块注释 */
    if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      out += migrateComment(text.slice(i, j), R);
      i = j;
      continue;
    }
    /* 字符串 */
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && text[j] !== ch) {
        if (text[j] === '\\') j += 1;
        j += 1;
      }
      if (j >= n) {
        /* 未闭合（JSX 文本里的撇号等）——原样吐出，不补引号 */
        out += text.slice(i);
        i = n;
        prevSig = ch; prevWord = '';
        continue;
      }
      const inner = text.slice(i + 1, j);
      out += ch + migrateStringByMode(inner, curMode() === 'auto' ? 'auto' : curMode(), R, warnings, file, inRegistryCtx(out)) + ch;
      i = j + 1;
      prevSig = ch; prevWord = '';
      continue;
    }
    /* 模板串：静态段迁移，${} 内递归走 tokenizer */
    if (ch === '`') {
      let j = i + 1;
      let buf = '';
      let seg = '';
      while (j < n) {
        if (text[j] === '\\') { seg += text[j] + (text[j + 1] ?? ''); j += 2; continue; }
        if (text[j] === '`') break;
        if (text[j] === '$' && text[j + 1] === '{') {
          buf += migrateStringByMode(seg, curMode(), R, warnings, file, inRegistryCtx(out + buf));
          seg = '';
          let depth = 1;
          let k = j + 2;
          const codeStart = k;
          while (k < n && depth > 0) {
            if (text[k] === '{') depth += 1;
            else if (text[k] === '}') depth -= 1;
            k += 1;
          }
          const expr = text.slice(codeStart, k - 1);
          buf += '${' + migrateCodeText(expr, R, warnings, file) + '}';
          j = k;
          continue;
        }
        seg += text[j];
        j += 1;
      }
      buf += migrateStringByMode(seg, curMode(), R, warnings, file, inRegistryCtx(out + buf));
      out += '`' + buf + (j < n ? '`' : '');
      i = Math.min(j + 1, n);
      prevSig = '`'; prevWord = '';
      continue;
    }
    /* 正则字面量（原样） */
    if (ch === '/' && isRegexContext(prevSig, prevWord)) {
      let j = i + 1;
      let inClass = false;
      let body = '';
      let closed = false;
      while (j < n) {
        const c = text[j];
        if (c === '\\') { body += c + (text[j + 1] ?? ''); j += 2; continue; }
        if (c === '\n') break;
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) { closed = true; break; }
        body += c;
        j += 1;
      }
      if (closed) {
        let flags = '';
        let k = j + 1;
        while (k < n && /[gimsuy]/.test(text[k])) { flags += text[k]; k += 1; }
        out += '/' + body + '/' + flags;
        i = k;
        prevSig = '/'; prevWord = '';
        continue;
      }
      /* 不是正则（除法等）——按普通字符 */
    }
    /* dataset.x */
    if (ch === 'd' && text.startsWith('dataset.', i)) {
      const mRest = text.slice(i + 8).match(/^([A-Za-z][\w]*)/);
      if (mRest && R.camelMap.has(mRest[1])) {
        out += `dataset.${R.camelMap.get(mRest[1])}`;
        i += 8 + mRest[1].length;
        prevSig = 'x'; prevWord = '';
        continue;
      }
    }
    /* 调用语境追踪：ident( → 压栈；, → 实参序号；) → 弹栈 */
    if (ch === '(') {
      const tail = out.slice(-64).match(/([\w$]+(?:\.[\w$]+)*)$/);
      if (tail) {
        const parts = tail[1].split('.');
        parenStack.push({ mode: stringModeFor(parts[parts.length - 1], parts[parts.length - 2] ?? '', 0), arg: 0 });
      } else {
        parenStack.push({ mode: 'auto', arg: 0 });
      }
      out += ch;
      prevSig = ch; prevWord = '';
      i += 1;
      continue;
    }
    if (ch === ',' && parenStack.length) {
      parenStack[parenStack.length - 1].arg += 1;
      out += ch;
      prevSig = ch; prevWord = '';
      i += 1;
      continue;
    }
    if (ch === ')' && parenStack.length) {
      parenStack.pop();
      out += ch;
      prevSig = ch; prevWord = '';
      i += 1;
      continue;
    }
    /* 普通字符 */
    out += ch;
    if (/[a-zA-Z0-9_$]/.test(ch)) {
      prevWord += ch;
      prevSig = ch;
    } else if (!/\s/.test(ch)) {
      prevSig = ch;
      prevWord = '';
    }
    i += 1;
  }
  return out;
}

/* ───────────────────────── Markdown ───────────────────────── */

export function migrateMarkdownText(text, R, warnings, file) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((p, i) => {
    if (i % 2 === 1) {
      let out2 = migrateCssText(p, R, warnings, file);
      out2 = migrateMarkupText(out2, R, warnings, file);
      out2 = migrateCodeText(out2, R, warnings, file);
      return out2;
    }
    return p.split(/(`[^`\n]+`)/g).map((seg, j) => {
      if (j % 2 === 1) {
        let out2 = migrateCssText(seg, R, warnings, file);
        if (R.reBareAttr) out2 = out2.replace(R.reBareAttr, (_, a) => `data-icen-${a.slice(5)}`);
        return out2;
      }
      return migrateComment(seg, R);
    }).join('');
  }).join('');
}

/* ───────────────────────── 文件遍历与驱动 ───────────────────────── */

const CODE_EXT = new Set(['.ts', '.mts', '.tsx', '.js', '.mjs', '.jsx']);
const MARKUP_EXT = new Set(['.astro', '.html', '.vue', '.svelte']);
const CSS_EXT = new Set(['.css']);
const MD_EXT = new Set(['.md']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.astro', '.wrangler', '.idea', 'temp', '.next', '.vercel', '.handedit']);
const SKIP_FILES = new Set(['CHANGELOG.md', 'migrate-engine.mjs', 'prefix-migrate.mjs', 'slugs.mjs', 'slugs.d.mts', 'cli.mjs']);

export function collectFiles(roots) {
  const files = [];
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      const base = p.split(/[\\/]/).pop();
      if (SKIP_DIRS.has(base)) return;
      for (const ent of readdirSync(p)) walk(join(p, ent));
    } else {
      const base = p.split(/[\\/]/).pop();
      if (SKIP_FILES.has(base)) return;
      const ext = extname(p);
      if (CODE_EXT.has(ext) || MARKUP_EXT.has(ext) || CSS_EXT.has(ext) || MD_EXT.has(ext)) files.push(p);
    }
  };
  for (const r of roots) if (existsSync(r)) walk(r);
  return files;
}

/** 标记文件区域切分：astro frontmatter/<script> → 代码；<style> → CSS；其余 → 标记+CSS。 */
function splitRegions(text, ext) {
  const regions = [];
  let rest = text;
  if (ext === '.astro' && rest.startsWith('---')) {
    const end = rest.indexOf('\n---', 3);
    if (end !== -1) {
      regions.push({ kind: 'code', text: rest.slice(0, end + 4) });
      rest = rest.slice(end + 4);
    }
  }
  const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let last = 0;
  let m;
  while ((m = re.exec(rest)) !== null) {
    if (m.index > last) regions.push({ kind: 'markup', text: rest.slice(last, m.index) });
    regions.push({ kind: m[1].toLowerCase() === 'script' ? 'code' : 'css', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < rest.length) regions.push({ kind: 'markup', text: rest.slice(last) });
  return regions;
}

/** 标记区中的 `{...}` 表达式是 JS——剥出来走代码 tokenizer（防 `doc.desc` 属性访问被类名规则误转）。 */
function migrateMarkupRegion(text, R, warnings, file) {
  let out = '';
  let i = 0;
  const n = text.length;
  let last = 0;
  while (i < n) {
    /* 跳过引号属性值内的内容（class="{...}" 之类 astro 不这么写；属性值里的 { 是字面量） */
    if (text[i] === '{') {
      /* 找平衡 }（跳过内部字符串/模板/注释） */
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        const c = text[j];
        if (c === '"' || c === "'" || c === '`') {
          let k = j + 1;
          while (k < n && text[k] !== c) { if (text[k] === '\\') k += 1; k += 1; }
          j = k + 1;
          continue;
        }
        if (c === '{') depth += 1;
        else if (c === '}') depth -= 1;
        j += 1;
      }
      if (depth === 0) {
        out += migrateCssText(migrateMarkupText(text.slice(last, i), R, warnings, file), R, warnings, file);
        const expr = text.slice(i + 1, j - 1);
        /* JSX 混合表达式（含标记）：先走标记规则（class=/data- 属性），再走代码 tokenizer（字符串/注释） */
        out += '{' + (expr.includes('<')
          ? migrateCodeText(migrateMarkupText(expr, R, warnings, file), R, warnings, file)
          : migrateCodeText(expr, R, warnings, file)) + '}';
        last = j;
        i = j;
        continue;
      }
    }
    i += 1;
  }
  if (last < n) out += migrateCssText(migrateMarkupText(text.slice(last), R, warnings, file), R, warnings, file);
  return out;
}

/** 迁移一组文件。opts: { write?: boolean } → { changed, warnings, scanned } */
export function migratePaths(roots, map, opts = {}) {
  const R = compileMap(map);
  const changed = [];
  const warnings = [];
  let scanned = 0;
  for (const file of collectFiles(roots)) {
    scanned += 1;
    const ext = extname(file);
    const text = readFileSync(file, 'utf8');
    /* 文件级豁免指令：前 500 字符内含 icen-migrate: off 即跳过（如 guard 的业界类名基线表） */
    if (text.slice(0, 500).includes('icen-migrate: off')) continue;
    let out = text;
    if (CSS_EXT.has(ext)) out = migrateCssText(text, R, warnings, file);
    else if (CODE_EXT.has(ext)) out = migrateCodeText(text, R, warnings, file);
    else if (MARKUP_EXT.has(ext)) {
      out = splitRegions(text, ext).map((r) => {
        if (r.kind === 'code') return migrateCodeText(r.text, R, warnings, file);
        if (r.kind === 'css') return migrateCssText(r.text, R, warnings, file);
        return migrateMarkupRegion(r.text, R, warnings, file);
      }).join('');
    } else if (MD_EXT.has(ext)) out = migrateMarkdownText(text, R, warnings, file);
    if (out !== text) {
      const aLines = text.split('\n'), bLines = out.split('\n');
      let replacements = 0;
      for (let k = 0; k < Math.max(aLines.length, bLines.length); k++) if (aLines[k] !== bLines[k]) replacements += 1;
      changed.push({ file, replacements });
      if (opts.write) writeFileSync(file, out);
    }
  }
  return { changed, warnings, scanned };
}
