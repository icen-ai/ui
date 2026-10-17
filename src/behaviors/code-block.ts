/*
 * @icen.ai/ui — Behavior: code-block（多行代码块，与 components/code-block.css 配套）
 *
 * DOM 契约见 code-block.css 头注释（figure.icen-code-block 家族）。
 *
 * 行为：
 *   - renderCodeBlock(el, opts)：全 DOM API 渲染（文本路径逐行 textContent，零 XSS 面），
 *     返回挂载元素 el（render* 约定，SSR 原样返回）。opts：
 *       · code：纯文本源码（安全路径）
 *       · html：已高亮 HTML（shiki 等可信输出；勿拼用户输入——同 context-menu icon 槽位契约）。
 *         接受完整 <pre>…</pre>（shiki 输出原样）或裸行片段；shiki 的 .line 自动归一为
 *         .icen-code-block-line，内联背景剥除，检测到 --shiki-dark 自动给 pre 打
 *         data-icen-dual-theme（暗色高亮切换的 CSS 钩子）
 *       · lang / file / title：徽标与标题；lang ∈ diff|patch 时进 diff 模式（行级红绿 +
 *         旧/新双行号 counter-set），diff 默认显示行号，其余默认隐藏
 *       · lines：高亮行（1 基）；num / wrap：初始态；fold：true 强制折叠 / false 永不 /
 *         数字 = 超过 N 行折叠（缺省 30）
 *   - initCodeBlock(root?)：幂等（scope disposer），事件委托（渲染后注入的块同样生效）：
 *       · [data-icen-code-block-num|wrap]：切换行号/换行，同步 aria-pressed 与 tooltip 文案
 *       · [data-icen-code-block-fold] / .icen-code-block-tail / 折叠态点击 pre：展开收起
 *         （max-height 过渡动画，prefers-reduced-motion 下直接落位）
 *       · [data-icen-code-block-copy]：整块正文写剪贴板（复用 copy 的 copyText 含
 *         execCommand 回退），成功 .is-done 1.5s（CSS 切对勾图标），派 icen:copy-success /
 *         icen:copy-error（与 copy 组件同事件契约）；失败有可见重试，等待中不重复复制
 *       · 切换类操作派 icen:code-block-toggle { el, action: 'num'|'wrap'|'fold', value }
 *   - 返回销毁函数：移除监听与观察器、取消动画和异步反馈、复位幂等标记（可重新 init）
 */

import {iconHTML} from './icons';
import {runFeedbackAction,cancelFeedbackAction} from './feedback';
import { parseSvg } from './svg-parse';
import { emitIcen } from './events';
import { t } from './i18n';
import { copyText } from './copy';

/* ── 常量 ── */

/** 超过此行数自动折叠（CSS 的 is-folded max-height 264px 与之配套） */
const FOLD_THRESHOLD = 30;
/** 折叠态可视高度（与 code-block.css 的 .is-folded > pre max-height 同值） */
const FOLD_MAX = 264;
/** 复制成功反馈时长（与 blog 端一致；CSS 对勾图标切换窗口） */
const COPY_DONE_MS = 1500;

const ICONS={file:iconHTML('file'),terminal:iconHTML('terminal'),branch:iconHTML('branch'),num:iconHTML('line-numbers'),wrap:iconHTML('wrap'),fold:iconHTML('chevron-down'),copy:iconHTML('copy'),check:iconHTML('check')};

const SHELL_LANGS = ['bash', 'sh', 'shell', 'zsh', 'console', 'terminal', 'fish', 'powershell', 'cmd'];
const DIFF_LANGS = ['diff', 'patch'];

/* ── 选项 ── */

export interface CodeBlockOptions {
  /** 纯文本源码（安全路径，逐行 textContent） */
  code?: string;
  /** 已高亮 HTML（shiki 等可信输出，勿拼用户输入）；完整 <pre> 或裸行片段均可 */
  html?: string;
  /** 语言徽标；diff/patch 进 diff 模式，shell 族换终端图标 */
  lang?: string;
  /** 文件名徽标（展示优先于 lang 徽标） */
  file?: string;
  /** 说明标题 */
  title?: string;
  /** 高亮行（1 基） */
  lines?: number[];
  /** 初始显示行号（缺省：diff 模式开，其余关） */
  num?: boolean;
  /** 初始自动换行 */
  wrap?: boolean;
  /** true 强制折叠 / false 永不 / 数字 = 超过 N 行折叠（缺省 30） */
  fold?: boolean | number;
}

/* ── 构件 ── */

function el(tag: 'figure' | 'figcaption' | 'span' | 'pre' | 'code' | 'button', className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function iconSpan(svg: string, className: string): HTMLElement {
  const span = el('span', className);
  const parsed = parseSvg(svg);
  if (parsed) span.appendChild(parsed);
  return span;
}

function headIconFor(lang: string | undefined): string {
  const l = (lang ?? '').toLowerCase();
  if (SHELL_LANGS.includes(l)) return ICONS.terminal;
  if (DIFF_LANGS.includes(l)) return ICONS.branch;
  return ICONS.file;
}

/** 工具钮：class + data 钩子 + tooltip + 内嵌图标（pressed 态可选） */
function actionBtn(hook: string, tip: string, icon: string, opts?: { pressed?: boolean; extraIcon?: string }): HTMLButtonElement {
  const btn = el('button', 'icen-code-block-btn') as HTMLButtonElement;
  btn.type = 'button';
  btn.setAttribute(`data-icen-code-block-${hook}`, '');
  btn.setAttribute('data-icen-tooltip', tip);
  // 头栏在 overflow:hidden 容器顶行，tooltip 一律朝下避免被裁
  btn.setAttribute('data-icen-tooltip-side', 'bottom');
  btn.setAttribute('aria-label', tip);
  if (opts?.pressed !== undefined) {
    btn.setAttribute('aria-pressed', String(opts.pressed));
    if (opts.pressed) btn.classList.add('is-on');
  }
  btn.appendChild(iconSpan(icon, 'icen-code-block-btn-icon'));
  if (opts?.extraIcon) btn.appendChild(iconSpan(opts.extraIcon, 'icen-code-block-btn-check'));
  return btn;
}

function retip(btn: Element, tip: string): void {
  btn.setAttribute('data-icen-tooltip', tip);
  btn.setAttribute('aria-label', tip);
}

/* ── shiki HTML 注入（可信槽位） ── */

/** 剥 shiki 内联背景（背景由容器统一接管）；返回是否检出 --shiki-dark（双主题） */
function adoptPre(pre: HTMLElement): boolean {
  let dual = false;
  const clean = (node: HTMLElement): void => {
    const style = node.getAttribute('style');
    if (!style) return;
    if (style.includes('--shiki-dark')) dual = true;
    const kept = style
      .split(';')
      .filter((part) => !/^\s*(background-color|background|--shiki-dark-bg|--shiki-bg)\s*:/.test(part))
      .join(';');
    if (kept.trim()) node.setAttribute('style', kept);
    else node.removeAttribute('style');
  };
  clean(pre);
  pre.querySelectorAll<HTMLElement>('[style]').forEach(clean);
  if (dual) pre.setAttribute('data-icen-dual-theme', '');
  return dual;
}

/**
 * 注入已高亮 HTML 并归一行类名：
 *   - 完整 <pre> 输出（shiki 原样）→ 剥背景/检双主题后原位采用；
 *   - 裸片段 → 包进自建 <pre><code>；
 *   - 行容器直接子级里的纯空白文本节点剥除（white-space: pre 下块级行间的 \n
 *     会渲染成空行、行距翻倍——与 blog rehype 管线的清除步骤同义）。
 * innerHTML 赋值是登记在 guard 的可信槽位（同 context-menu icon 契约）。
 */
function injectHighlighted(html: string): HTMLElement {
  const box = document.createElement('div');
  box.innerHTML = html; /* guard:allow-inner-html 可信槽位：调用方自己的高亮器输出，非用户文本 */
  /* shiki 行类归一：.line → .icen-code-block-line（其余类保留） */
  box.querySelectorAll<HTMLElement>('.line').forEach((node) => {
    node.classList.remove('line');
    node.classList.add('icen-code-block-line');
  });

  const extPre = box.querySelector('pre');
  if (extPre instanceof HTMLElement) {
    adoptPre(extPre);
    box.querySelectorAll('pre').forEach((p) => {
      if (p !== extPre) p.remove();
    });
    stripBlankTextNodes(extPre.querySelector('code') ?? extPre);
    return extPre;
  }
  const pre = el('pre', '');
  const code = el('code', '');
  while (box.firstChild) code.appendChild(box.firstChild);
  stripBlankTextNodes(code);
  pre.appendChild(code);
  return pre;
}

/** 删除容器直接子级里的纯空白文本节点（行间 \n；行内 token 间的空格文本不动） */
function stripBlankTextNodes(parent: ParentNode): void {
  [...parent.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) node.remove();
  });
}

/* ── diff 行分类（旧/新双行号 counter-set） ── */

const RE_HUNK = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/;
const RE_FILE_META = /^(\+\+\+|---)/;

/** diff 行分类；返回旧/新行号的最大值（供 gutter 按位数定档） */
function classifyDiff(lines: HTMLElement[]): number {
  let oldNo = 0;
  let newNo = 0;
  for (const line of lines) {
    const text = line.textContent ?? '';
    const hunk = RE_HUNK.exec(text);
    if (hunk) {
      oldNo = Number(hunk[1]) - 1;
      newNo = Number(hunk[2]) - 1;
      line.classList.add('icen-code-block-line--meta');
      continue;
    }
    if (RE_FILE_META.test(text)) {
      line.classList.add('icen-code-block-line--meta');
      continue;
    }
    if (text.startsWith('+')) {
      newNo += 1;
      line.classList.add('icen-code-block-line--add');
      line.style.setProperty('counter-set', `icen-cb-dl-n ${newNo}`);
    } else if (text.startsWith('-')) {
      oldNo += 1;
      line.classList.add('icen-code-block-line--del');
      line.style.setProperty('counter-set', `icen-cb-dl-o ${oldNo}`);
    } else {
      oldNo += 1;
      newNo += 1;
      line.classList.add('icen-code-block-line--ctx');
      line.style.setProperty('counter-set', `icen-cb-dl-n ${newNo}`);
    }
  }
  return Math.max(oldNo, newNo);
}

/* ── 渲染 ── */

/**
 * 渲染多行代码块（DOM API + 可信 HTML 槽位），返回挂载元素 el（render* 约定）。
 * 重复调用替换 el 内容；SSR 原样返回。交互由 initCodeBlock() 提供（页面级一次）。
 */
export function renderCodeBlock(target: HTMLElement, opts: CodeBlockOptions): HTMLElement {
  if (typeof document === 'undefined') return target;
  const lang = opts.lang?.toLowerCase();
  const isDiff = DIFF_LANGS.includes(lang ?? '');
  const showNum = opts.num ?? isDiff;
  const foldable =
    opts.fold === true ? true : opts.fold === false ? false : null; /* null = 按阈值 */

  const figure = el('figure', 'icen-code-block');
  if (isDiff) figure.classList.add('icen-code-block--diff');
  if (!showNum) figure.classList.add('icen-code-block--nonum');
  if (opts.wrap) figure.classList.add('icen-code-block--wrap');

  /* 标题栏：图标 + 徽标（file 优先 lang）+ 标题 + 工具钮 */
  const head = el('figcaption', 'icen-code-block-head');
  const id = el('span', 'icen-code-block-id');
  id.appendChild(iconSpan(headIconFor(lang), 'icen-code-block-icon'));
  if (opts.file) {
    id.appendChild(el('span', 'icen-code-block-file')).textContent = opts.file;
  } else if (lang) {
    id.appendChild(el('span', 'icen-code-block-lang')).textContent = lang;
  }
  if (opts.title) {
    id.appendChild(el('span', 'icen-code-block-title')).textContent = opts.title;
  }
  head.appendChild(id);

  const actions = el('span', 'icen-code-block-actions');
  const numBtn = actionBtn('num', showNum ? t('codeBlock.numHide') : t('codeBlock.numShow'), ICONS.num, { pressed: showNum });
  const wrapBtn = actionBtn('wrap', opts.wrap ? t('codeBlock.wrapOff') : t('codeBlock.wrapOn'), ICONS.wrap, { pressed: opts.wrap === true });
  const copyBtn = actionBtn('copy', t('codeBlock.copy'), ICONS.copy, { extraIcon: ICONS.check });
  actions.appendChild(numBtn);
  actions.appendChild(wrapBtn);
  actions.appendChild(copyBtn);
  head.appendChild(actions);
  figure.appendChild(head);

  /* 正文：纯文本路径（逐行 textContent）或可信高亮 HTML 路径 */
  let pre: HTMLElement;
  let lines: HTMLElement[];
  if (opts.html != null && opts.html !== '') {
    pre = injectHighlighted(opts.html);
    lines = [...pre.querySelectorAll<HTMLElement>('.icen-code-block-line')];
  } else {
    pre = el('pre', '');
    const code = el('code', '');
    const source = (opts.code ?? '').replace(/\n$/, '');
    for (const text of source.split('\n')) {
      const line = el('span', 'icen-code-block-line');
      line.textContent = text;
      code.appendChild(line);
    }
    pre.appendChild(code);
    lines = [...pre.querySelectorAll<HTMLElement>('.icen-code-block-line')];
  }
  pre.tabIndex=0;pre.setAttribute('role','region');pre.setAttribute('aria-label',opts.file || opts.title || opts.lang || t('codeBlock.region'));
  figure.appendChild(pre);

  /* diff 行分类 + 高亮行 */
  const maxNo = isDiff ? classifyDiff(lines) : lines.length;
  if (opts.lines && opts.lines.length > 0) {
    const hit = new Set(opts.lines);
    lines.forEach((line, i) => {
      if (hit.has(i + 1)) line.classList.add('icen-code-block-line--hl');
    });
  }

  /* 行号 gutter 定档：≥3 位数时按最大行号位数加宽（CSS 缺省 2ch，定宽保证各行对齐） */
  const gutterDigits = String(Math.max(1, maxNo)).length;
  if (gutterDigits > 2) figure.style.setProperty('--cb-gutter', `${gutterDigits}ch`);

  /* 折叠：阈值判定 + 折叠钮 + 底部展开条 */
  const total = lines.length;
  const fold =
    foldable === true ||
    (foldable === null && total > (typeof opts.fold === 'number' ? opts.fold : FOLD_THRESHOLD));
  if (fold && total > 0) {
    const foldBtn = actionBtn('fold', t('codeBlock.foldExpand'), ICONS.fold);
    foldBtn.setAttribute('aria-expanded', 'false'); /* 初始即折叠（is-folded 同步加上） */
    actions.insertBefore(foldBtn, copyBtn);

    const tail = el('button', 'icen-code-block-tail') as HTMLButtonElement;
    tail.type = 'button';
    tail.setAttribute('aria-label', t('codeBlock.linesTotal',{p0:String(total)})+', '+t('codeBlock.foldExpand'));tail.setAttribute('aria-expanded','false');
    const count = el('span', 'icen-code-block-count');
    count.textContent = t('codeBlock.linesTotal', { p0: String(total) });
    const less = el('span', 'icen-code-block-less');
    less.textContent = t('codeBlock.collapse');
    tail.append(count, less, iconSpan(ICONS.fold, 'icen-code-block-tail-icon'));
    figure.appendChild(tail);
    figure.classList.add('is-folded');
  }

  target.textContent = '';
  target.appendChild(figure);
  prepareFigure(figure);
  return target;
}

/* ── SSR 字符串渲染（与 renderCodeBlock 同构；Astro/JSX 构建期直出标记） ── */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * shiki 等 HTML 槽位的字符串版采纳（与 injectHighlighted 同规约）：
 *   - 完整 <pre> → 剥内联背景、检出 --shiki-dark 打 data-icen-dual-theme、.line → .icen-code-block-line；
 *   - 裸片段 → 包自建 <pre><code>；
 *   - lines 高亮集按行序注入 --hl 修饰类；
 *   - 标签间的换行空白剥除（white-space: pre 下，块级行 span 之间的 \n 文本节点
 *     会渲染成空行——行距翻倍；shiki 行结构输出必然带这些 \n，与 blog rehype
 *     管线的空白文本节点清除同义。只剥含换行的纯空白，行内 token 间空格不动）。
 */
function adoptHighlightedHtml(html: string, hl: Set<number>): { pre: string; total: number } {
  let total = 0;
  /* 单趟归一：class 属性内独立 token "line" → "icen-code-block-line"，行序命中加 --hl */
  const normalize = (src: string): string =>
    src.replace(/class="([^"]*)"/g, (_m, cls: string) => {
      const toks = cls.split(/\s+/).filter(Boolean);
      if (!toks.includes('line')) return `class="${cls}"`;
      total += 1;
      const next = toks.filter((tok) => tok !== 'line').map(esc);
      next.push(hl.has(total) ? 'icen-code-block-line icen-code-block-line--hl' : 'icen-code-block-line');
      return `class="${next.join(' ')}"`;
    });

  /* 标签间含换行的纯空白 → 删除（`>…\n…<`；空格/制表符单独出现不剥——那是行内容） */
  const stripInterTagNewlines = (src: string): string => src.replace(/>\s*\n\s*</g, '><');

  const trimmed = stripInterTagNewlines(html.trim());
  if (/^<pre[\s>]/i.test(trimmed)) {
    const dual = /--shiki-dark/.test(trimmed);
    let out = normalize(trimmed);
    /* 剥 pre 内联背景（背景由容器接管） */
    out = out.replace(/^<pre([^>]*)>/i, (_m, attrs: string) => {
      const kept = attrs
        .split(/(?=\sstyle=")/)
        .map((part) => {
          const m = /^\sstyle="([^"]*)"/.exec(part);
          if (!m) return part;
          const style = m[1]
            .split(';')
            .filter((decl) => !/^\s*(background-color|background|--shiki-dark-bg|--shiki-bg)\s*:/.test(decl))
            .join(';');
          return style.trim() ? ` style="${style}"` : '';
        })
        .join('');
      return `<pre${kept}${dual ? ' data-icen-dual-theme' : ''}>`;
    });
    return { pre: out, total };
  }
  const inner = normalize(trimmed);
  return { pre: `<pre><code>${inner}</code></pre>`, total };
}

/** 行文本 diff 分类（与 classifyDiff 同语义）；返回每行 { text, cls, counter } 与最大行号 */
function classifyDiffStrings(rows: string[]): { max: number; marks: Array<{ cls: string; counter?: string }> } {
  let oldNo = 0;
  let newNo = 0;
  const marks = rows.map((text) => {
    const hunk = RE_HUNK.exec(text);
    if (hunk) {
      oldNo = Number(hunk[1]) - 1;
      newNo = Number(hunk[2]) - 1;
      return { cls: 'icen-code-block-line--meta' };
    }
    if (RE_FILE_META.test(text)) return { cls: 'icen-code-block-line--meta' };
    if (text.startsWith('+')) {
      newNo += 1;
      return { cls: 'icen-code-block-line--add', counter: `counter-set: icen-cb-dl-n ${newNo}` };
    }
    if (text.startsWith('-')) {
      oldNo += 1;
      return { cls: 'icen-code-block-line--del', counter: `counter-set: icen-cb-dl-o ${oldNo}` };
    }
    oldNo += 1;
    newNo += 1;
    return { cls: 'icen-code-block-line--ctx', counter: `counter-set: icen-cb-dl-n ${newNo}` };
  });
  return { max: Math.max(oldNo, newNo), marks };
}

function btnHtml(hook: string, tip: string, icon: string, opts?: { pressed?: boolean; expanded?: boolean }): string {
  const state =
    opts?.pressed !== undefined
      ? ` aria-pressed="${opts.pressed}"${opts.pressed ? ' class="icen-code-block-btn is-on"' : ' class="icen-code-block-btn"'}`
      : opts?.expanded !== undefined
        ? ` aria-expanded="${opts.expanded}" class="icen-code-block-btn"`
        : ' class="icen-code-block-btn"';
  return `<button type="button" data-icen-code-block-${hook} data-icen-tooltip="${esc(tip)}" aria-label="${esc(tip)}"${state}>${icon}</button>`;
}

/**
 * code-block 的 SSR 字符串渲染器——与 renderCodeBlock 输出同构的 figure 标记，
 * 供 Astro/JSX 构建期直出（无 DOM 依赖，纯字符串；交互仍由 initCodeBlock() 提供）。
 * html 槽位不做 diff 行分类（高亮片段的 diff 请走 code 路径，或消费方自行注入行修饰类）。
 */
export function codeBlockHTML(opts: CodeBlockOptions): string {
  const lang = opts.lang?.toLowerCase();
  const isDiff = DIFF_LANGS.includes(lang ?? '');
  const showNum = opts.num ?? isDiff;
  const foldForced = opts.fold === true;
  const foldNever = opts.fold === false;
  const foldThreshold = typeof opts.fold === 'number' ? opts.fold : FOLD_THRESHOLD;

  const cls = ['icen-code-block'];
  if (isDiff) cls.push('icen-code-block--diff');
  if (!showNum) cls.push('icen-code-block--nonum');
  if (opts.wrap) cls.push('icen-code-block--wrap');

  /* 正文：html 采纳（含 lines 高亮）或纯文本路径（转义 + diff/高亮） */
  let pre: string;
  let total: number;
  let maxNo: number;
  const hl = new Set(opts.lines ?? []);
  if (opts.html != null && opts.html !== '') {
    const adopted = adoptHighlightedHtml(opts.html, hl);
    pre = adopted.pre;
    total = adopted.total;
    maxNo = total;
  } else {
    const rows = (opts.code ?? '').replace(/\n$/, '').split('\n');
    const marks = isDiff ? classifyDiffStrings(rows) : null;
    total = rows.length;
    maxNo = marks ? marks.max : total;
    const spans = rows.map((text, i) => {
      const mods = marks ? [marks.marks[i]!.cls] : [];
      if (hl.has(i + 1)) mods.push('icen-code-block-line--hl');
      const counter = marks?.marks[i]?.counter;
      return `<span class="icen-code-block-line${mods.length > 0 ? ` ${mods.join(' ')}` : ''}"${counter ? ` style="${counter}"` : ''}>${esc(text)}</span>`;
    });
    /* 行 span 之间不加任何空白：white-space: pre 下块级行间的文本节点会渲染成空行（行距翻倍） */
    pre = `<pre><code>${spans.join('')}</code></pre>`;
  }

  pre=pre.replace(/^<pre([^>]*)>/i,(_m,attrs:string)=>'<pre'+attrs.replace(/\s(?:tabindex|role|aria-label)=(?:"[^"]*"|'[^']*')/gi,'')+' tabindex="0" role="region" aria-label="'+esc(opts.file || opts.title || opts.lang || t('codeBlock.region'))+'">');
  const fold = !foldNever && total > 0 && (foldForced || total > foldThreshold);
  if (fold) cls.push('is-folded');
  const gutterDigits = String(Math.max(1, maxNo)).length;
  const styleAttr = gutterDigits > 2 ? ` style="--cb-gutter: ${gutterDigits}ch"` : '';

  const badge = opts.file
    ? `<span class="icen-code-block-file">${esc(opts.file)}</span>`
    : lang
      ? `<span class="icen-code-block-lang">${esc(lang)}</span>`
      : '';
  const title = opts.title ? `<span class="icen-code-block-title">${esc(opts.title)}</span>` : '';
  const foldBtn = fold
    ? btnHtml('fold', t('codeBlock.foldExpand'), `<span class="icen-code-block-btn-icon">${ICONS.fold}</span>`, { expanded: false })
    : '';
  const actions =
    `<span class="icen-code-block-actions">` +
    btnHtml('num', showNum ? t('codeBlock.numHide') : t('codeBlock.numShow'), `<span class="icen-code-block-btn-icon">${ICONS.num}</span>`, { pressed: showNum }) +
    btnHtml('wrap', opts.wrap ? t('codeBlock.wrapOff') : t('codeBlock.wrapOn'), `<span class="icen-code-block-btn-icon">${ICONS.wrap}</span>`, { pressed: opts.wrap === true }) +
    foldBtn +
    btnHtml('copy', t('codeBlock.copy'), `<span class="icen-code-block-btn-icon">${ICONS.copy}</span><span class="icen-code-block-btn-check">${ICONS.check}</span>`) +
    `</span>`;
  const head =
    `<figcaption class="icen-code-block-head">` +
    `<span class="icen-code-block-id"><span class="icen-code-block-icon">${headIconFor(lang)}</span>${badge}${title}</span>` +
    actions +
    `</figcaption>`;

  const tail = fold
    ? `<button type="button" class="icen-code-block-tail" aria-expanded="false" aria-label="${esc(t('codeBlock.linesTotal',{p0:String(total)})+', '+t('codeBlock.foldExpand'))}">` +
      `<span class="icen-code-block-count">${esc(t('codeBlock.linesTotal', { p0: String(total) }))}</span>` +
      `<span class="icen-code-block-less">${esc(t('codeBlock.collapse'))}</span>` +
      `<span class="icen-code-block-tail-icon">${ICONS.fold}</span>` +
      `</button>`
    : '';

  /* 结构层换行缩进（figure 子级各占一行，提升 view-source / 标记样例可读性）；
     pre 内部保持单行——white-space: pre 下行间换行会渲染成空行 */
  const parts = [head, pre, tail].filter(Boolean).map((part) => `  ${part}`);
  return `<figure class="${cls.join(' ')}"${styleAttr}>\n${parts.join('\n')}\n</figure>`;
}

/* ── Interaction ownership ── */
let regionSequence=0;
const handled=new WeakSet<Event>();
const scopes=new WeakMap<ParentNode,()=>void>();
const folds=new WeakMap<HTMLElement,{owner:object;cancel(reset?:boolean):void}>();
const copies=new WeakMap<HTMLElement,{owner:object;button:HTMLButtonElement;timer:number;pending:boolean}>();
function syncFold(fig:HTMLElement,fold:boolean):void {
  const button=fig.querySelector('[data-icen-code-block-fold]'),tail=fig.querySelector('.icen-code-block-tail');
  if(button){retip(button,t(fold ? 'codeBlock.foldExpand' : 'codeBlock.foldCollapse'));button.setAttribute('aria-expanded',String(!fold));}
  if(tail){const count=fig.querySelector('.icen-code-block-count')?.textContent ?? '';tail.setAttribute('aria-expanded',String(!fold));tail.setAttribute('aria-label',fold ? count+', '+t('codeBlock.foldExpand') : t('codeBlock.collapse')+', '+t('codeBlock.region'));}
}
function prepareFigure(fig:HTMLElement):void {
  const pre=fig.querySelector<HTMLElement>(':scope > pre');if(!pre)return;
  pre.tabIndex=0;pre.setAttribute('role','region');
  if(!pre.hasAttribute('aria-label'))pre.setAttribute('aria-label',fig.querySelector('.icen-code-block-file,.icen-code-block-title,.icen-code-block-lang')?.textContent || t('codeBlock.region'));
  if(!pre.id){do{pre.id='icen-code-region-'+ ++regionSequence;}while(document.getElementById(pre.id) && document.getElementById(pre.id) !== pre);}
  fig.querySelectorAll('[data-icen-code-block-num],[data-icen-code-block-wrap],[data-icen-code-block-fold],.icen-code-block-tail').forEach((control)=>control.setAttribute('aria-controls',pre.id));
  syncFold(fig,fig.classList.contains('is-folded'));
}
function setFold(fig:HTMLElement,fold:boolean,owner:object):void {
  const pre=fig.querySelector<HTMLElement>(':scope > pre');if(!pre)return;
  const height=pre.getBoundingClientRect().height;
  folds.get(fig)?.cancel(false);fig.classList.toggle('is-folded',fold);syncFold(fig,fold);
  const reduced=typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration=Math.max(...getComputedStyle(pre).transitionDuration.split(',').map((part)=>{const value=parseFloat(part)||0;return part.trim().endsWith('ms') ? value : value*1000;}));
  if(reduced || !height || duration<=0){pre.style.maxHeight='';return;}
  let frame=0,timer=0;
  const state={owner,cancel(reset=true){cancelAnimationFrame(frame);window.clearTimeout(timer);pre.removeEventListener('transitionend',ended);if(reset)pre.style.maxHeight='';if(folds.get(fig) === state)folds.delete(fig);}};
  const ended=(event:TransitionEvent)=>{if(event.target === pre && event.propertyName === 'max-height')state.cancel();};
  folds.set(fig,state);pre.style.maxHeight=height+'px';void pre.offsetHeight;
  pre.addEventListener('transitionend',ended);
  frame=requestAnimationFrame(()=>{if(folds.get(fig) !== state || !fig.isConnected){state.cancel();return;}pre.style.maxHeight=(fold ? Math.min(FOLD_MAX,pre.scrollHeight) : pre.scrollHeight)+'px';});
  timer=window.setTimeout(()=>state.cancel(),duration+80);
}
function clearCopy(fig:HTMLElement):void {
  const state=copies.get(fig);if(!state)return;
  cancelFeedbackAction(fig);window.clearTimeout(state.timer);state.button.classList.remove('is-done','is-error');retip(state.button,t('codeBlock.copy'));fig.querySelector('.icen-code-block-feedback')?.remove();copies.delete(fig);
}
function doCopy(button:HTMLButtonElement,fig:HTMLElement,owner:object):void {
  if(copies.get(fig)?.pending)return;
  clearCopy(fig);const pre=fig.querySelector('pre');if(!pre)return;
  const lines=Array.from(pre.querySelectorAll<HTMLElement>('.icen-code-block-line'));
  const text=lines.length ? lines.map((line)=>line.textContent ?? '').join('\n') : pre.textContent ?? '';
  const state={owner,button,timer:0,pending:false};copies.set(fig,state);let reason=t('copy.unknown');
  const feedback=(ok:boolean)=>{
    const status=document.createElement('p');status.className='icen-code-block-feedback'+(ok ? ' is-success' : '');status.setAttribute('role','status');status.textContent=ok ? t('copy.copied') : t('codeBlock.copyFailed');fig.append(status);
    button.classList.add(ok ? 'is-done' : 'is-error');retip(button,ok ? t('copy.copied') : t('codeBlock.copyRetry'));
    if(ok)state.timer=window.setTimeout(()=>{if(copies.get(fig) === state)clearCopy(fig);},COPY_DONE_MS);
    if(ok)emitIcen(button,'icen:copy-success',{text});else emitIcen(button,'icen:copy-error',{text,reason});
  };
  runFeedbackAction(fig,button,async(signal)=>{const result=await copyText(text,{signal});reason=result.reason ?? t('copy.unknown');return result.ok;},{busy(value){state.pending=value;},complete:feedback,error(){feedback(false);}});
}
function closestFigure(node:Element):HTMLElement | null {return node.closest<HTMLElement>('.icen-code-block');}
/** Shared event delegation, real repeated disposer, no nested-scope double action.
 * Every animation/async feedback belongs to the scope that started it. */
export function initCodeBlock(root?:ParentNode):()=>void {
  if(typeof document === 'undefined' || typeof window === 'undefined')return ()=>{};
  const scope=root ?? document,previous=scopes.get(scope);if(previous)return previous;
  const owner={},owned=new Set<HTMLElement>();let disposed=false;
  const collect=(node:ParentNode)=>{if(node instanceof HTMLElement && node.matches('.icen-code-block'))prepareFigure(node);node.querySelectorAll<HTMLElement>('.icen-code-block').forEach(prepareFigure);};collect(scope);
  const cleanup=(fig:HTMLElement)=>{if(folds.get(fig)?.owner === owner)folds.get(fig)?.cancel();if(copies.get(fig)?.owner === owner)clearCopy(fig);};
  const observer=new MutationObserver((records)=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof HTMLElement)collect(node);for(const fig of owned)if(!fig.isConnected){cleanup(fig);owned.delete(fig);}});
  observer.observe(scope,{childList:true,subtree:true});
  const target=scope as ParentNode & EventTarget;
  const onClick=(event:Event)=>{
    if(disposed || event.defaultPrevented || handled.has(event) || !(event.target instanceof Element))return;
    const node=event.target,fig=closestFigure(node);if(!fig || !(scope as Node).contains(fig))return;
    const control=node.closest<HTMLElement>('[data-icen-code-block-num],[data-icen-code-block-wrap],[data-icen-code-block-fold],[data-icen-code-block-copy],.icen-code-block-tail');
    const pre=node.closest('pre'),surface=!control && pre?.parentElement === fig && fig.classList.contains('is-folded') && !window.getSelection()?.toString();
    if(!control && !surface)return;if(control?.matches(':disabled,[aria-disabled="true"]'))return;
    handled.add(event);owned.add(fig);prepareFigure(fig);
    if(control?.hasAttribute('data-icen-code-block-copy')){if(control instanceof HTMLButtonElement)doCopy(control,fig,owner);return;}
    let action:'num'|'wrap'|'fold',value:boolean;
    if(control?.hasAttribute('data-icen-code-block-num')){action='num';value=!fig.classList.toggle('icen-code-block--nonum');control.classList.toggle('is-on',value);control.setAttribute('aria-pressed',String(value));retip(control,t(value ? 'codeBlock.numHide' : 'codeBlock.numShow'));}
    else if(control?.hasAttribute('data-icen-code-block-wrap')){action='wrap';value=fig.classList.toggle('icen-code-block--wrap');control.classList.toggle('is-on',value);control.setAttribute('aria-pressed',String(value));retip(control,t(value ? 'codeBlock.wrapOff' : 'codeBlock.wrapOn'));}
    else {action='fold';value=surface ? true : fig.classList.contains('is-folded');setFold(fig,!value,owner);}
    emitIcen(fig,'icen:code-block-toggle',{el:fig,action,value});
  };
  target.addEventListener('click',onClick);
  const dispose=()=>{if(disposed)return;disposed=true;target.removeEventListener('click',onClick);observer.disconnect();owned.forEach(cleanup);owned.clear();if(scopes.get(scope) === dispose)scopes.delete(scope);};
  scopes.set(scope,dispose);return dispose;
}
