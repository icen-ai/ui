/*
 * @icen.ai/ui — Behavior: ai-diff（AI 变更 diff 审阅，与 components/ai-diff.css 配套）
 *
 * DOM 契约（renderAiDiff 构建，类名与规格 §4.6 一致）：
 *   <div class="ai-diff">
 *     <div class="ai-diff-file is-added|is-modified|is-deleted|is-renamed
 *          [.is-accepted|.is-rejected]" data-path="src/foo.ts">
 *       <div class="ai-diff-head" role="button" tabindex="0" aria-expanded="false">
 *         <span class="ai-diff-path">src/foo.ts</span>          <!-- renamed：旧路径 → 新路径 -->
 *         <span class="ai-diff-stat"><b class="ai-diff-add">+12</b> <b class="ai-diff-del">−4</b></span>
 *         <span class="ai-diff-actions">
 *           <button type="button" data-ai-diff-accept>接受</button>
 *           <button type="button" data-ai-diff-reject>拒绝</button>
 *         </span>
 *         <span class="ai-diff-verdict" hidden>已接受|已拒绝</span>
 *       </div>
 *       <div class="ai-diff-body" hidden>
 *         <table class="ai-diff-table">
 *           <tr class="ai-diff-line--hunk"><td colspan="3">@@ -10,6 +10,8 @@</td></tr>
 *           <tr class="ai-diff-line--ctx|ai-diff-line--add|ai-diff-line--del">
 *             <td class="ai-diff-ln" aria-hidden="true">10</td>
 *             <td class="ai-diff-ln" aria-hidden="true">10</td>
 *             <td class="ai-diff-code">内容（行首 +/- 符号由 CSS ::before 提供）</td>
 *           </tr>
 *         </table>
 *       </div>
 *     </div>
 *   </div>
 *
 * 行为：
 *   - parseUnifiedDiff(text)：解析标准 unified diff（多文件 diff --git / hunk @@ / 行号追踪），
 *     纯函数、SSR 安全；返回结构化 AiDiffFile[]
 *   - renderAiDiff(el, { files })：全 DOM API 渲染，文本一律 textContent（禁 innerHTML）；
 *     body 默认折叠（长 diff 只露 head）；返回挂载元素 el（render* 约定，SSR 原样返回）
 *   - initAiDiff(root?)：幂等（__icenAiDiffInit），事件委托（渲染后注入的新文件同样生效）：
 *       · head 点击 / Enter / Space → 展开折叠 body，同步 aria-expanded，派 icen:ai-toggle {el, open}
 *       · [data-ai-diff-accept] / [data-ai-diff-reject] → 文件加 .is-accepted / .is-rejected
 *         （CSS 淡化 + .ai-diff-verdict 状态章），按钮 hidden 禁用，
 *         派 icen:ai-diff-accept / icen:ai-diff-reject（detail {path}，bubbles）
 *   - 返回销毁函数：移除监听、复位幂等标记（销毁后可重新 init）
 */

import { h } from './ai-core';
import { emitIcen } from './events';

/* ── 数据模型 ── */

export type AiDiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface AiDiffLine {
  /** ctx = 上下文 / add = 新增 / del = 删除 / hunk = hunk 头 */
  type: 'ctx' | 'add' | 'del' | 'hunk';
  /** 旧文件行号（add/hunk 行为 null） */
  oldNo: number | null;
  /** 新文件行号（del/hunk 行为 null） */
  newNo: number | null;
  /** 行内容（不含行首 + / - / 空格前缀与 hunk 头） */
  text: string;
}

export interface AiDiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  /** 原始 hunk 头文本（@@ -10,6 +10,8 @@ …） */
  header: string;
  lines: AiDiffLine[];
}

export interface AiDiffFile {
  /** 新路径（重命名时为 rename to 目标） */
  path: string;
  /** 重命名前的旧路径 */
  oldPath?: string;
  status: AiDiffFileStatus;
  hunks: AiDiffHunk[];
  addCount: number;
  delCount: number;
  /** 二进制文件（无文本 hunks） */
  binary?: boolean;
}

export interface AiDiffModel {
  files: AiDiffFile[];
}

/* ── 解析 ── */

const RE_HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const RE_OLD_FILE = /^--- (.*)$/;
const RE_NEW_FILE_LINE = /^\+\+\+ (.*)$/;
const RE_NEW_MODE = /^new file mode /;
const RE_DEL_MODE = /^deleted file mode /;
const RE_RENAME_FROM = /^rename from (.*)$/;
const RE_RENAME_TO = /^rename to (.*)$/;
const RE_BINARY = /^Binary files .* differ$/;

/** 剥离 a/ b/ 前缀、引号与传统 diff 的时间戳后缀 */
function parseDiffPath(token: string): string {
  let p = token.split('\t')[0].trim();
  if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
  if (p !== '/dev/null' && (p.startsWith('a/') || p.startsWith('b/'))) p = p.slice(2);
  return p;
}

/** 解析 diff --git 行的一对路径（支持引号包裹含空格路径） */
function parseGitHeader(line: string): { oldPath: string; newPath: string } | null {
  const m = /^diff --git\s+(\S+)\s+(.+)$/.exec(line);
  if (!m) return null;
  return { oldPath: parseDiffPath(m[1]), newPath: parseDiffPath(m[2]) };
}

function emptyFile(path: string): AiDiffFile {
  return { path, status: 'modified', hunks: [], addCount: 0, delCount: 0 };
}

/**
 * 解析标准 unified diff 文本（支持多文件 `diff --git`、纯 `---/+++` 单文件、
 * hunk `@@` 行号追踪、rename/new/deleted mode、Binary files）。
 * 无法解析的行被安全忽略；SSR 安全（不触碰 DOM）。
 */
export function parseUnifiedDiff(text: string): AiDiffFile[] {
  const files: AiDiffFile[] = [];
  if (typeof text !== 'string' || text.length === 0) return files;

  let cur: AiDiffFile | null = null;
  let hunk: AiDiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    /* 新文件起点：diff --git 头，或裸 --- 行（无 git 头的传统 unified diff） */
    const git = parseGitHeader(line);
    if (git) {
      cur = emptyFile(git.newPath);
      cur.oldPath = git.oldPath;
      files.push(cur);
      hunk = null;
      continue;
    }
    if (!cur && RE_OLD_FILE.test(line)) {
      cur = emptyFile('');
      files.push(cur);
      hunk = null;
    }
    if (!cur) continue;

    /* 元信息行 */
    if (RE_NEW_MODE.test(line)) {
      cur.status = 'added';
      continue;
    }
    if (RE_DEL_MODE.test(line)) {
      cur.status = 'deleted';
      continue;
    }
    const renameFrom = RE_RENAME_FROM.exec(line);
    if (renameFrom) {
      cur.oldPath = parseDiffPath(renameFrom[1]);
      cur.status = 'renamed';
      continue;
    }
    const renameTo = RE_RENAME_TO.exec(line);
    if (renameTo) {
      cur.path = parseDiffPath(renameTo[1]);
      cur.status = 'renamed';
      continue;
    }
    const oldLine = RE_OLD_FILE.exec(line);
    if (oldLine) {
      const p = parseDiffPath(oldLine[1]);
      if (p === '/dev/null') cur.status = 'added';
      else if (!cur.oldPath) cur.oldPath = p;
      continue;
    }
    const newLine = RE_NEW_FILE_LINE.exec(line);
    if (newLine) {
      const p = parseDiffPath(newLine[1]);
      if (p === '/dev/null') cur.status = 'deleted';
      else if (p) cur.path = p;
      continue;
    }
    if (RE_BINARY.test(line)) {
      cur.binary = true;
      hunk = null;
      continue;
    }

    /* hunk 头 */
    const hm = RE_HUNK.exec(line);
    if (hm) {
      hunk = {
        oldStart: Number(hm[1]),
        oldCount: hm[2] ? Number(hm[2]) : 1,
        newStart: Number(hm[3]),
        newCount: hm[4] ? Number(hm[4]) : 1,
        header: line,
        lines: [],
      };
      cur.hunks.push(hunk);
      oldNo = hunk.oldStart;
      newNo = hunk.newStart;
      continue;
    }

    if (!hunk) continue; // index/mode 等无关行

    /* "\ No newline at end of file" 标记：挂到上一行，不影响行号 */
    if (line.startsWith('\\')) continue;

    if (line.startsWith('+')) {
      hunk.lines.push({ type: 'add', oldNo: null, newNo: newNo++, text: line.slice(1) });
      cur.addCount++;
    } else if (line.startsWith('-')) {
      hunk.lines.push({ type: 'del', oldNo: oldNo++, newNo: null, text: line.slice(1) });
      cur.delCount++;
    } else {
      /* 上下文行：标准格式带一个空格前缀；空行与无前缀行按上下文兜底 */
      const body = line.startsWith(' ') ? line.slice(1) : line;
      hunk.lines.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: body });
    }
  }

  return files;
}

/* ── 渲染（DOM 构件 h 走 ai-core，集群共享） ── */

function renderLineRow(line: AiDiffLine): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.className = `ai-diff-line--${line.type}`;
  if (line.type === 'hunk') {
    const td = h('td', '', line.text);
    td.colSpan = 3;
    tr.appendChild(td);
    return tr;
  }
  const oldTd = h('td', 'ai-diff-ln', line.oldNo === null ? '' : String(line.oldNo));
  oldTd.setAttribute('aria-hidden', 'true');
  const newTd = h('td', 'ai-diff-ln', line.newNo === null ? '' : String(line.newNo));
  newTd.setAttribute('aria-hidden', 'true');
  tr.appendChild(oldTd);
  tr.appendChild(newTd);
  tr.appendChild(h('td', 'ai-diff-code', line.text));
  return tr;
}

function renderFile(file: AiDiffFile): HTMLElement {
  const root = h('div', `ai-diff-file is-${file.status}`);
  root.dataset.path = file.path;

  /* head */
  const head = h('div', 'ai-diff-head');
  head.setAttribute('role', 'button');
  head.tabIndex = 0;
  head.setAttribute('aria-expanded', 'false');

  const pathText = file.status === 'renamed' && file.oldPath
    ? `${file.oldPath} → ${file.path}`
    : file.path;
  head.appendChild(h('span', 'ai-diff-path', pathText));

  const stat = h('span', 'ai-diff-stat');
  if (file.addCount > 0) stat.appendChild(h('b', 'ai-diff-add', `+${file.addCount}`));
  if (file.delCount > 0) stat.appendChild(h('b', 'ai-diff-del', `−${file.delCount}`));
  if (stat.children.length > 0) head.appendChild(stat);

  const actions = h('span', 'ai-diff-actions');
  actions.appendChild(h('button', '', '接受')).setAttribute('data-ai-diff-accept', '');
  const rejectBtn = h('button', '', '拒绝');
  rejectBtn.setAttribute('data-ai-diff-reject', '');
  actions.appendChild(rejectBtn);
  head.appendChild(actions);

  const verdict = h('span', 'ai-diff-verdict');
  verdict.hidden = true;
  head.appendChild(verdict);
  root.appendChild(head);

  /* body（默认折叠，只露 head） */
  const body = h('div', 'ai-diff-body');
  body.hidden = true;
  const table = h('table', 'ai-diff-table');
  if (file.hunks.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'ai-diff-line--ctx';
    const td = h('td', '', file.binary ? '二进制文件，无法显示文本差异' : '无差异内容');
    td.colSpan = 3;
    tr.appendChild(td);
    table.appendChild(tr);
  } else {
    for (const hunk of file.hunks) {
      table.appendChild(renderLineRow({ type: 'hunk', oldNo: null, newNo: null, text: hunk.header }));
      for (const line of hunk.lines) table.appendChild(renderLineRow(line));
    }
  }
  body.appendChild(table);
  root.appendChild(body);
  return root;
}

/**
 * 渲染 diff 审阅卡（DOM API，全 textContent），返回挂载元素 el（render* 约定）。
 * 接受 parseUnifiedDiff 的产物；重复调用会替换 el 内容。
 */
export function renderAiDiff(el: HTMLElement, model: AiDiffModel): HTMLElement {
  if (typeof document === 'undefined') return el; /* SSR：原样返回挂载元素（render* SSR 分支口径） */
  el.textContent = '';
  const root = h('div', 'ai-diff');
  const files = Array.isArray(model?.files) ? model.files : [];
  for (const file of files) root.appendChild(renderFile(file));
  el.appendChild(root);
  return el;
}

/* ── 交互 ── */

interface MarkedScope extends ParentNode {
  __icenAiDiffInit?: boolean;
}

const noopDestroy = (): void => undefined;

/** 找最近的 .ai-diff-file（含 root 自身） */
function closestFile(node: Element | null): HTMLElement | null {
  const file = node?.closest('.ai-diff-file');
  return file instanceof HTMLElement ? file : null;
}

function filePath(file: HTMLElement): string {
  if (file.dataset.path) return file.dataset.path;
  return file.querySelector('.ai-diff-path')?.textContent ?? '';
}

function toggleFile(head: HTMLElement): void {
  const file = closestFile(head);
  if (!file) return;
  const body = file.querySelector<HTMLElement>('.ai-diff-body');
  if (!body) return;
  const open = body.hidden;
  body.hidden = !open;
  head.setAttribute('aria-expanded', String(open));
  emitIcen(file, 'icen:ai-toggle', { el: file, open });
}

function decide(btn: Element, accepted: boolean): void {
  const file = closestFile(btn);
  if (!file) return;
  if (file.classList.contains('is-accepted') || file.classList.contains('is-rejected')) return;

  file.classList.add(accepted ? 'is-accepted' : 'is-rejected');
  let verdict = file.querySelector<HTMLElement>('.ai-diff-verdict');
  if (!verdict) {
    verdict = h('span', 'ai-diff-verdict');
    file.querySelector('.ai-diff-head')?.appendChild(verdict);
  }
  verdict.textContent = accepted ? '已接受' : '已拒绝';
  verdict.hidden = false;

  file.querySelectorAll<HTMLButtonElement>(
    '[data-ai-diff-accept], [data-ai-diff-reject]',
  ).forEach((b) => {
    b.hidden = true;
    b.disabled = true;
  });

  emitIcen(file, accepted ? 'icen:ai-diff-accept' : 'icen:ai-diff-reject', { path: filePath(file) });
}

/**
 * 委托初始化：展开/折叠 + 接受/拒绝。重复调用安全；
 * 返回销毁函数（移除监听并复位标记，可重新 init）。
 */
export function initAiDiff(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return noopDestroy;
  const scope = root ?? document;
  const marked = scope as MarkedScope;
  if (marked.__icenAiDiffInit) return noopDestroy;
  marked.__icenAiDiffInit = true;

  const target = scope as ParentNode & EventTarget;

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;

    /* 决策按钮在 head 内，先处理并阻断展开（单次 closest 查询，命中即决策） */
    const acceptBtn = t.closest('[data-ai-diff-accept]');
    if (acceptBtn) {
      e.stopPropagation();
      decide(acceptBtn, true);
      return;
    }
    const rejectBtn = t.closest('[data-ai-diff-reject]');
    if (rejectBtn) {
      e.stopPropagation();
      decide(rejectBtn, false);
      return;
    }

    const head = t.closest<HTMLElement>('.ai-diff-head');
    if (head) toggleFile(head);
  };

  const onKeydown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const t = ke.target instanceof Element ? ke.target : null;
    if (!t || t.closest('button, a, input, textarea, select')) return;
    const head = t.closest<HTMLElement>('.ai-diff-head');
    if (!head) return;
    ke.preventDefault();
    toggleFile(head);
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKeydown);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('keydown', onKeydown);
    marked.__icenAiDiffInit = false;
  };
}
