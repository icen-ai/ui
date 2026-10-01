/*
 * @icen.ai/ui — Behavior: ai-panel（AI 任务面板族：todo / usage / context，与 components/ai-panel.css 配套）
 *
 * DOM 契约：
 *   ai-todo（规格 §4.8）：
 *   <div class="ai-todo" [data-ai-todo-interactive]>
 *     <div class="ai-todo-head">
 *       <span class="ai-todo-progress">2/5</span>
 *       <div class="ai-todo-bar" role="progressbar" aria-valuemin="0" …><i style="width:40%"></i></div>
 *     </div>
 *     <div class="ai-todo-item is-pending|running|streaming|approval|done|error|cancelled" data-index="0">
 *       <span class="ai-item-status"></span>                       <!-- 状态点，纯 CSS 由 .is-* 驱动 -->
 *       <span class="ai-todo-text">实现登录页</span>
 *       <span class="ai-todo-active">正在实现登录页…</span>       <!-- activeForm：is-running 时替换 text -->
 *     </div>
 *   </div>
 *
 *   ai-usage（规格 §4.9）：
 *   <div class="ai-usage">
 *     <div class="ai-usage-bar" role="img" aria-label="…">
 *       <i class="ai-usage-seg ai-usage-seg--input|output|cache-read|cache-write|reasoning" style="width:35%"></i>…
 *     </div>
 *     <div class="ai-usage-legend">
 *       <span class="ai-usage-legend-item"><i class="ai-usage-dot ai-usage-seg--input"></i>
 *         <span class="ai-usage-legend-label">输入</span> <span class="ai-usage-legend-value">35k</span></span>…
 *     </div>
 *     <div class="ai-usage-total">82k / 200k · 41%</div>           <!-- opts.total 给上限才显示百分比 -->
 *   </div>
 *
 *   ai-context（规格 §4.10）：
 *   <aside class="ai-context [.ai-context--inline]" hidden role="dialog" aria-label="上下文">
 *     <div class="ai-context-head"><span>上下文</span><button type="button" data-ai-context-close aria-label="关闭">×</button></div>
 *     <section class="ai-context-section"><h3>用量</h3>…ai-usage…</section>
 *     <section class="ai-context-section"><h3>文件 (3)</h3><div class="ai-files">…chips…</div></section>
 *     <section class="ai-context-section"><h3>MCP (2)</h3>
 *       <div class="ai-item is-done|is-error">                        <!-- 已连接 / 断开 -->
 *         <span class="ai-item-icon">…svg…</span>
 *         <span class="ai-item-main"><span class="ai-item-title">github</span></span>
 *         <span class="ai-item-side"><span class="ai-item-status"></span><span class="ai-item-meta">12 工具</span></span>
 *       </div></section>
 *     <section class="ai-context-section"><h3>Skills</h3>…同上 .ai-item 行（无状态点）…</section>
 *   </aside>
 *
 * 行为：
 *   - renderAiTodo(el, items)：DOM API 渲染；进度 x/y + 进度条（feedback progress 视觉，token 消费）；
 *     is-running 项以 activeForm 替换原文案（CSS 驱动，JS 同步类名）
 *   - initAiTodo(root?)：幂等（__icenAiTodoInit）；仅 data-ai-todo-interactive 容器可交互，
 *     点击/Enter/Space 循环 pending→running→done→pending，更新状态类/进度/aria，
 *     派 icen:ai-todo-toggle {index, status}（bubbles）；默认只读。返回销毁函数
 *   - renderAiUsage(el, usage, opts?)：normalizeUsage 归一后分段条 + 图例 + 占比；
 *     input=accent / output=success / cacheRead=info / cacheWrite=warning / reasoning=faint
 *   - renderAiContext(el, model)：组合渲染，内部复用 renderAiUsage 与 ai-file-chip
 *   - initAiContext(root?)：幂等（__icenAiContextInit）；[data-ai-context-open] 委托开合
 *     （属性值可作 #id / 类选择器，空值取默认抽屉），抽屉 fixed 右侧滑入（--z-chrome），
 *     Esc / 外点 / [data-ai-context-close] 关闭并还原焦点；Tab 焦点圈禁；
 *     .ai-context--inline 为页面流内嵌变体（不参与开合）。返回销毁函数
 */

import {
  aiStatusLabel,
  formatTokens,
  normalizeUsage,
  svgIcon,
  type AiStatus,
  type AiUsage,
} from './ai-core';

/* ── 小工具 ── */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function dispatch(node: Node, name: string, detail: unknown): void {
  node.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}

const STATUS_CLASSES: AiStatus[] = [
  'pending', 'running', 'streaming', 'approval', 'done', 'error', 'cancelled',
];

function stripStatusClasses(node: HTMLElement): void {
  for (const s of STATUS_CLASSES) node.classList.remove(`is-${s}`);
}

/* ══════════════ ai-todo（§4.8） ══════════════ */

export interface AiTodoItem {
  content: string;
  status: AiStatus;
  /** Claude Code 模式：running 时的替换文案 */
  activeForm?: string;
}

function buildTodoHead(done: number, total: number): HTMLElement {
  const head = el('div', 'ai-todo-head');
  head.appendChild(el('span', 'ai-todo-progress', `${done}/${total}`));
  const bar = el('div', 'ai-todo-bar');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', String(total));
  bar.setAttribute('aria-valuenow', String(done));
  bar.setAttribute('aria-label', '任务进度');
  const fill = document.createElement('i');
  fill.style.width = total > 0 ? `${Math.round((done / total) * 100)}%` : '0%';
  bar.appendChild(fill);
  head.appendChild(bar);
  return head;
}

function buildTodoItem(item: AiTodoItem, index: number): HTMLElement {
  const row = el('div', `ai-todo-item is-${item.status}`);
  row.dataset.index = String(index);
  row.appendChild(el('span', 'ai-item-status'));
  row.appendChild(el('span', 'ai-todo-text', item.content));
  /* activeForm 缺省时退化为 content，保证 is-running 替换后不空 */
  row.appendChild(el('span', 'ai-todo-active', item.activeForm ?? item.content));
  return row;
}

/**
 * 渲染 todo 列表（DOM API，全 textContent）。全部完成时容器加 .is-complete。
 */
export function renderAiTodo(elm: HTMLElement, items: AiTodoItem[]): void {
  if (typeof document === 'undefined') return;
  elm.textContent = '';
  const root = el('div', 'ai-todo');
  const list = Array.isArray(items) ? items : [];
  const done = list.filter((i) => i.status === 'done').length;
  root.appendChild(buildTodoHead(done, list.length));
  list.forEach((item, i) => root.appendChild(buildTodoItem(item, i)));
  if (list.length > 0 && done === list.length) root.classList.add('is-complete');
  elm.appendChild(root);
}

interface MarkedScope extends ParentNode {
  __icenAiTodoInit?: boolean;
}

const TODO_NEXT: Record<string, AiStatus> = {
  pending: 'running',
  running: 'done',
  done: 'pending',
};

function todoItemStatus(item: HTMLElement): AiStatus {
  for (const s of STATUS_CLASSES) {
    if (item.classList.contains(`is-${s}`)) return s;
  }
  return 'pending';
}

/** 从 DOM 重算进度（静态手写 DOM 与 renderAiTodo 产物走同一套） */
function refreshTodoProgress(todo: HTMLElement): void {
  const items = Array.from(todo.querySelectorAll<HTMLElement>('.ai-todo-item'));
  const done = items.filter((i) => i.classList.contains('is-done')).length;
  const total = items.length;
  const progress = todo.querySelector<HTMLElement>('.ai-todo-progress');
  if (progress) progress.textContent = `${done}/${total}`;
  const bar = todo.querySelector<HTMLElement>('.ai-todo-bar');
  if (bar) {
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(done));
    const fill = bar.querySelector<HTMLElement>('i');
    if (fill) fill.style.width = total > 0 ? `${Math.round((done / total) * 100)}%` : '0%';
  }
  todo.classList.toggle('is-complete', total > 0 && done === total);
}

function toggleTodoItem(item: HTMLElement): void {
  const todo = item.closest('[data-ai-todo-interactive]');
  if (!todo || !todo.hasAttribute('data-ai-todo-interactive')) return;
  const index = Array.from(
    todo.querySelectorAll('.ai-todo-item'),
  ).indexOf(item);
  const next = TODO_NEXT[todoItemStatus(item)] ?? 'pending';

  stripStatusClasses(item);
  item.classList.add(`is-${next}`);
  /* running 时若有独立 activeForm 文案则同步（静态 DOM 可写 data-active-form） */
  if (next === 'running') {
    const active = item.querySelector<HTMLElement>('.ai-todo-active');
    if (active && item.dataset.activeForm) {
      active.textContent = item.dataset.activeForm;
    }
  }
  const text = item.querySelector('.ai-todo-text')?.textContent ?? '';
  if (!item.hasAttribute('aria-label')) {
    item.setAttribute('aria-label', `${text}，状态：${aiStatusLabel(next)}`);
  }

  refreshTodoProgress(todo as HTMLElement);
  dispatch(item, 'icen:ai-todo-toggle', { index, status: next });
}

/**
 * todo 委托初始化：仅 data-ai-todo-interactive 容器可点击循环状态（pending→running→done），
 * 只读列表不挂交互。重复调用安全；返回销毁函数。
 */
export function initAiTodo(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as MarkedScope;
  if (marked.__icenAiTodoInit) return () => undefined;
  marked.__icenAiTodoInit = true;
  const target = scope as ParentNode & EventTarget;

  /* 升级交互项：role/tabindex（aria-label 覆盖 pending 初值） */
  scope.querySelectorAll<HTMLElement>(
    '[data-ai-todo-interactive] > .ai-todo-item',
  ).forEach((item) => {
    if (item.getAttribute('role') === 'button') return;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    const text = item.querySelector('.ai-todo-text')?.textContent ?? '';
    item.setAttribute('aria-label', `${text}，状态：${aiStatusLabel(todoItemStatus(item))}`);
  });

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    const item = t?.closest<HTMLElement>('.ai-todo-item');
    if (!item || !(item.closest('[data-ai-todo-interactive]') instanceof HTMLElement)) return;
    toggleTodoItem(item);
  };

  const onKeydown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const t = ke.target instanceof Element ? ke.target : null;
    const item = t?.closest<HTMLElement>('.ai-todo-item');
    if (!item || !(item.closest('[data-ai-todo-interactive]') instanceof HTMLElement)) return;
    ke.preventDefault();
    toggleTodoItem(item);
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKeydown);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('keydown', onKeydown);
    marked.__icenAiTodoInit = false;
  };
}

/* ══════════════ ai-usage（§4.9） ══════════════ */

export interface AiUsageRenderOpts {
  /** 上下文上限（如 200k）：给出时 total 行显示 82k / 200k · 41% */
  total?: number;
  /** 成本（USD）：给出时追加到 total 行 */
  cost?: number;
}

interface UsageSeg {
  key: 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'reasoning';
  className: string;
  label: string;
  value: number;
}

/**
 * 渲染用量分段条 + 图例 + 占比。
 * 配色契约：input=accent / output=success / cacheRead=info / cacheWrite=warning / reasoning=faint。
 */
export function renderAiUsage(
  elm: HTMLElement,
  usage: AiUsage,
  opts: AiUsageRenderOpts = {},
): void {
  if (typeof document === 'undefined') return;
  const u = normalizeUsage(usage);

  const segs: UsageSeg[] = [
    { key: 'input', className: 'ai-usage-seg--input', label: '输入', value: u.input ?? 0 },
    { key: 'output', className: 'ai-usage-seg--output', label: '输出', value: u.output ?? 0 },
    { key: 'cacheRead', className: 'ai-usage-seg--cache-read', label: '缓存读', value: u.cacheRead ?? 0 },
    { key: 'cacheWrite', className: 'ai-usage-seg--cache-write', label: '缓存写', value: u.cacheWrite ?? 0 },
    { key: 'reasoning', className: 'ai-usage-seg--reasoning', label: '推理', value: u.reasoning ?? 0 },
  ];
  const activeSegs = segs.filter((s) => s.value > 0);
  const sum = activeSegs.reduce((acc, s) => acc + s.value, 0);
  const total = u.total ?? sum;

  elm.textContent = '';
  const root = el('div', 'ai-usage');

  /* 分段条 */
  const bar = el('div', 'ai-usage-bar');
  const summary = activeSegs.length > 0
    ? activeSegs.map((s) => `${s.label} ${formatTokens(s.value)}`).join('，')
    : '暂无用量';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `用量：${summary}`);
  for (const s of activeSegs) {
    const seg = document.createElement('i');
    seg.className = `ai-usage-seg ${s.className}`;
    seg.style.width = sum > 0 ? `${(s.value / sum) * 100}%` : '0%';
    bar.appendChild(seg);
  }
  root.appendChild(bar);

  /* 图例（缓存分列，计费诚实） */
  if (activeSegs.length > 0) {
    const legend = el('div', 'ai-usage-legend');
    for (const s of activeSegs) {
      const item = el('span', 'ai-usage-legend-item');
      const dot = document.createElement('i');
      dot.className = `ai-usage-dot ${s.className}`;
      dot.setAttribute('aria-hidden', 'true');
      item.appendChild(dot);
      item.appendChild(el('span', 'ai-usage-legend-label', s.label));
      item.appendChild(el('span', 'ai-usage-legend-value', formatTokens(s.value)));
      legend.appendChild(item);
    }
    root.appendChild(legend);
  }

  /* 总量行：total 给上限时显示百分比 */
  const totalParts = [formatTokens(total)];
  if (typeof opts.total === 'number' && opts.total > 0) {
    const pct = Math.min(100, Math.round((total / opts.total) * 100));
    totalParts.push(` / ${formatTokens(opts.total)} · ${pct}%`);
  }
  if (typeof opts.cost === 'number' && Number.isFinite(opts.cost)) {
    totalParts.push(` · $${opts.cost.toFixed(4)}`);
  }
  root.appendChild(el('div', 'ai-usage-total', totalParts.join('')));

  elm.appendChild(root);
}

/* ══════════════ ai-context（§4.10） ══════════════ */

export interface AiContextFile {
  path: string;
  status?: 'added' | 'modified' | 'deleted';
}

export interface AiContextMcpServer {
  name: string;
  tools?: number;
  /** connected（默认）→ .is-done；disconnected → .is-error */
  status?: 'connected' | 'disconnected';
}

export interface AiContextSkill {
  name: string;
  description?: string;
}

export interface AiContextModel {
  usage?: AiUsage;
  /** 传 renderAiUsage 的 opts（上限/成本），可选扩展 */
  usageTotal?: number;
  usageCost?: number;
  files?: AiContextFile[];
  mcpServers?: AiContextMcpServer[];
  skills?: AiContextSkill[];
}

/* ── 文件类型图标（lucide 风格最简路径，经 ai-core svgIcon 消毒解析） ── */

const svgWrap = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const FILE_OUTLINE = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>';
const ICON_FILE = svgWrap(FILE_OUTLINE);
const ICON_FILE_CODE = svgWrap(`${FILE_OUTLINE}<path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>`);
const ICON_BRACES = svgWrap(
  '<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/>' +
  '<path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>',
);
const ICON_FILE_TEXT = svgWrap(`${FILE_OUTLINE}<path d="M16 13H8"/><path d="M16 17H8"/>`);
const ICON_IMAGE = svgWrap(
  '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
);
const ICON_SERVER = svgWrap(
  '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/>' +
  '<path d="M6 6h.01"/><path d="M6 18h.01"/>',
);
const ICON_SPARKLES = svgWrap(
  '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
);

type FileKind = 'ts' | 'js' | 'css' | 'json' | 'md' | 'img' | 'other';

function fileKind(path: string): FileKind {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  const ext = m ? m[1].toLowerCase() : '';
  if (['ts', 'tsx', 'mts', 'cts'].includes(ext)) return 'ts';
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'js';
  if (['css', 'scss', 'less'].includes(ext)) return 'css';
  if (ext === 'json') return 'json';
  if (['md', 'markdown'].includes(ext)) return 'md';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'avif'].includes(ext)) return 'img';
  return 'other';
}

function fileKindIcon(kind: FileKind): string {
  switch (kind) {
    case 'ts': case 'js': return ICON_FILE_CODE;
    case 'css': case 'json': return ICON_BRACES;
    case 'md': return ICON_FILE_TEXT;
    case 'img': return ICON_IMAGE;
    default: return ICON_FILE;
  }
}

function renderFileChip(file: AiContextFile): HTMLElement {
  const kind = fileKind(file.path);
  const chip = el('span', `ai-file-chip ai-file-chip--${kind} is-${file.status ?? 'modified'}`);
  const icon = el('span', 'ai-file-icon');
  const svg = svgIcon(fileKindIcon(kind));
  if (svg) icon.appendChild(svg);
  chip.appendChild(icon);
  chip.appendChild(document.createTextNode(file.path));
  return chip;
}

function renderSection(title: string): { section: HTMLElement; body: HTMLElement } {
  const section = el('section', 'ai-context-section');
  section.appendChild(el('h3', '', title));
  const body = el('div', 'ai-context-section-body');
  section.appendChild(body);
  return { section, body };
}

/**
 * 组合渲染上下文抽屉：usage → renderAiUsage；files → ai-file-chip；
 * mcpServers / skills → .ai-item 行。aside 默认 hidden，由 initAiContext 开合。
 */
export function renderAiContext(elm: HTMLElement, model: AiContextModel): void {
  if (typeof document === 'undefined') return;
  elm.textContent = '';
  const m = model ?? {};
  const aside = el('aside', 'ai-context');
  aside.hidden = true;

  /* head */
  const head = el('div', 'ai-context-head');
  head.appendChild(el('span', '', '上下文'));
  const closeBtn = el('button', '', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('data-ai-context-close', '');
  closeBtn.setAttribute('aria-label', '关闭');
  head.appendChild(closeBtn);
  aside.appendChild(head);

  /* 用量 */
  if (m.usage) {
    const { section, body } = renderSection('用量');
    renderAiUsage(body, m.usage, { total: m.usageTotal, cost: m.usageCost });
    aside.appendChild(section);
  }

  /* 文件 */
  const files = Array.isArray(m.files) ? m.files : [];
  if (files.length > 0) {
    const { section, body } = renderSection(`文件 (${files.length})`);
    const chips = el('div', 'ai-files');
    for (const f of files) chips.appendChild(renderFileChip(f));
    body.appendChild(chips);
    aside.appendChild(section);
  }

  /* MCP servers（.ai-item：is-done 已连接 / is-error 断开） */
  const servers = Array.isArray(m.mcpServers) ? m.mcpServers : [];
  if (servers.length > 0) {
    const { section, body } = renderSection(`MCP (${servers.length})`);
    for (const s of servers) {
      const ok = s.status !== 'disconnected';
      const row = el('div', `ai-item is-${ok ? 'done' : 'error'}`);
      const icon = el('span', 'ai-item-icon');
      const svg = svgIcon(ICON_SERVER);
      if (svg) icon.appendChild(svg);
      row.appendChild(icon);
      const main = el('span', 'ai-item-main');
      main.appendChild(el('span', 'ai-item-title', s.name));
      row.appendChild(main);
      const side = el('span', 'ai-item-side');
      side.appendChild(el('span', 'ai-item-status'));
      side.appendChild(el('span', 'ai-item-meta', typeof s.tools === 'number' ? `${s.tools} 工具` : ''));
      row.appendChild(side);
      body.appendChild(row);
    }
    aside.appendChild(section);
  }

  /* Skills（.ai-item 行） */
  const skills = Array.isArray(m.skills) ? m.skills : [];
  if (skills.length > 0) {
    const { section, body } = renderSection('Skills');
    for (const s of skills) {
      const row = el('div', 'ai-item');
      const icon = el('span', 'ai-item-icon');
      const svg = svgIcon(ICON_SPARKLES);
      if (svg) icon.appendChild(svg);
      row.appendChild(icon);
      const main = el('span', 'ai-item-main');
      main.appendChild(el('span', 'ai-item-title', s.name));
      if (s.description) main.appendChild(el('span', 'ai-item-sub', s.description));
      row.appendChild(main);
      body.appendChild(row);
    }
    aside.appendChild(section);
  }

  elm.appendChild(aside);
}

/* ── initAiContext ── */

interface ContextMarkedScope extends ParentNode {
  __icenAiContextInit?: boolean;
}

function isInline(drawer: HTMLElement): boolean {
  return drawer.classList.contains('ai-context--inline');
}

/**
 * 触发器 [data-ai-context-open] 委托开合：
 *   - 属性值为 #id / 选择器时定位对应抽屉，空值取 scope 内第一个非 inline 抽屉
 *   - 打开：去 hidden → reflow → .is-open 滑入（CSS transition），焦点移入 close 钮
 *   - 关闭：[data-ai-context-close] / Esc / 外点；.is-open 移除 → transition 结束（或兜底计时）
 *     后恢复 hidden，焦点还原触发器；Tab/Shift+Tab 焦点圈禁
 *   - .ai-context--inline 为页面流内嵌变体：不参与开合、不做 fixed
 */
export function initAiContext(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as ContextMarkedScope;
  if (marked.__icenAiContextInit) return () => undefined;
  marked.__icenAiContextInit = true;
  const target = scope as ParentNode & EventTarget;

  /* 触发器 aria 初值（对齐 dropdown.ts 的 init 升级模式） */
  scope.querySelectorAll<HTMLElement>('[data-ai-context-open]').forEach((t) => {
    if (!t.hasAttribute('aria-expanded')) t.setAttribute('aria-expanded', 'false');
  });

  let lastTrigger: HTMLElement | null = null;

  const drawers = (): HTMLElement[] =>
    Array.from(scope.querySelectorAll<HTMLElement>('.ai-context')).filter((d) => !isInline(d));

  function resolveDrawer(trigger: Element): HTMLElement | null {
    const sel = trigger.getAttribute('data-ai-context-open');
    if (sel) {
      const found = scope.querySelector<HTMLElement>(sel);
      if (found && found.classList.contains('ai-context') && !isInline(found)) return found;
    }
    return drawers()[0] ?? null;
  }

  function syncTriggers(drawer: HTMLElement | null, open: boolean): void {
    scope.querySelectorAll<HTMLElement>('[data-ai-context-open]').forEach((t) => {
      if (!drawer || resolveDrawer(t) === drawer) {
        t.setAttribute('aria-expanded', String(open));
      }
    });
  }

  function openDrawer(drawer: HTMLElement, trigger: HTMLElement | null): void {
    /* 单例：开新关旧 */
    drawers().forEach((d) => {
      if (d !== drawer && !d.hidden) closeDrawer(d, false);
    });
    lastTrigger = trigger;
    if (!drawer.hasAttribute('role')) {
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'false');
      if (!drawer.hasAttribute('aria-label')) drawer.setAttribute('aria-label', '上下文');
    }
    drawer.hidden = false;
    void drawer.offsetWidth; // reflow，让 transition 从 translateX(100%) 起步
    drawer.classList.add('is-open');
    syncTriggers(drawer, true);
    const closeBtn = drawer.querySelector<HTMLElement>('[data-ai-context-close]');
    (closeBtn ?? drawer).focus?.();
  }

  function closeDrawer(drawer: HTMLElement, restoreFocus: boolean): void {
    if (drawer.hidden && !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    syncTriggers(drawer, false);
    const finish = (): void => {
      drawer.hidden = true;
      if (restoreFocus && lastTrigger && document.contains(lastTrigger)) {
        lastTrigger.focus();
      }
      lastTrigger = null;
    };
    let done = false;
    const onEnd = (): void => {
      if (done) return;
      done = true;
      drawer.removeEventListener('transitionend', onEnd);
      finish();
    };
    drawer.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, 300); // reduced-motion / 无 transition 兜底
  }

  function trapFocus(drawer: HTMLElement, ke: KeyboardEvent): void {
    const focusables = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((n) => !n.hidden && n.getAttribute('aria-hidden') !== 'true');
    if (focusables.length === 0) {
      ke.preventDefault();
      drawer.focus?.();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (ke.shiftKey) {
      if (active === first || !drawer.contains(active)) {
        ke.preventDefault();
        last.focus();
      }
    } else if (active === last || !drawer.contains(active)) {
      ke.preventDefault();
      first.focus();
    }
  }

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;

    const closeBtn = t.closest('[data-ai-context-close]');
    if (closeBtn) {
      const drawer = closeBtn.closest('.ai-context');
      if (drawer instanceof HTMLElement && !isInline(drawer)) closeDrawer(drawer, true);
      return;
    }

    const trigger = t.closest<HTMLElement>('[data-ai-context-open]');
    if (trigger) {
      const drawer = resolveDrawer(trigger);
      if (!drawer) return;
      if (drawer.hidden || !drawer.classList.contains('is-open')) {
        openDrawer(drawer, trigger);
      } else {
        closeDrawer(drawer, true);
      }
      return;
    }

    /* 外点：任何打开中的非 inline 抽屉都关闭（scope 内） */
    if (!t.closest('.ai-context')) {
      drawers().forEach((d) => {
        if (d.classList.contains('is-open')) closeDrawer(d, true);
      });
    }
  };

  const onKeydown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Escape') {
      drawers().forEach((d) => {
        if (d.classList.contains('is-open')) closeDrawer(d, true);
      });
      return;
    }
    if (ke.key === 'Tab') {
      const open = drawers().find((d) => d.classList.contains('is-open') && !d.hidden);
      if (open) trapFocus(open, ke);
      return;
    }
    /* 非 button 触发器的键盘等价 */
    if (ke.key === 'Enter' || ke.key === ' ') {
      const t = ke.target instanceof Element ? ke.target : null;
      const trigger = t?.closest<HTMLElement>('[data-ai-context-open]');
      if (!trigger || trigger.tagName === 'BUTTON') return;
      ke.preventDefault();
      trigger.click();
    }
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKeydown);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('keydown', onKeydown);
    marked.__icenAiContextInit = false;
  };
}
