/*
 * @icen.ai/ui — Behavior: kb-sql（问数域 · 生成 SQL 卡片，与 components/kb-data.css 配套）
 *
 * DOM 契约（renderKbSql 构建，规格 docs/spec/kb-family.md §5.15）：
 *   <div class="kb-sql" data-kb-sql [.is-editing]>
 *     <div class="kb-sql-head">
 *       <span class="kb-sql-title">生成的 SQL</span>
 *       <span class="kb-badge kb-badge--admin">仅管理员可见</span>        <!-- visibility==='admin' -->
 *       <span class="kb-meta">postgres</span>                             <!-- dialect 有才渲 -->
 *       <span class="kb-sql-tables"><span class="kb-chip">orders</span>…</span>
 *       <span class="kb-sql-actions">
 *         <button type="button" class="kb-sql-btn" data-kb-sql-copy>复制</button>
 *         <button type="button" class="kb-sql-btn" data-kb-sql-edit>编辑重跑</button>  <!-- editable 才渲 -->
 *       </span>
 *     </div>
 *     <pre class="kb-sql-code" data-kb-sql-code>…highlightSql 的 token 树…</pre>
 *     <div class="kb-sql-fix">                                            <!-- prevSql 存在且≠sql -->
 *       <div class="kb-sql-fix-head">
 *         <span class="kb-sql-fix-title">检测到上版报错，修复建议已就绪</span>
 *         <button type="button" class="kb-sql-btn kb-sql-btn--apply" data-kb-sql-apply>应用修复并重跑</button>
 *       </div>
 *       <div class="kb-sql-fix-diff">…makeSqlDiff → parseUnifiedDiff → renderAiDiff（默认展开）…</div>
 *     </div>
 *     <div class="kb-sql-editor" hidden>                                  <!-- initKbSql 编辑态切换 -->
 *       <textarea class="kb-sql-textarea" data-kb-sql-textarea" spellcheck="false"></textarea>
 *       <div class="kb-sql-editor-actions">
 *         <button type="button" class="kb-sql-btn" data-kb-sql-cancel>取消</button>
 *         <button type="button" class="kb-sql-btn kb-sql-btn--run" data-kb-sql-confirm>确认并重跑</button>
 *       </div>
 *     </div>
 *   </div>
 *
 * 行为：
 *   - highlightSql(sql)：零依赖 SQL 着色 → DocumentFragment（span.kb-sql-tok--kw/-str/-num/-fn/-cmt）；
 *     流式安全：未闭合字符串 / 块注释按普通文本 token 收尾，不吞后续输入
 *   - makeSqlDiff(a, b)：两段 SQL 的行级 unified diff 文本（LCS + 3 行上下文），纯函数、SSR 安全；
 *     交 parseUnifiedDiff + renderAiDiff 渲染（复用 ai-diff 域，不重复造 diff 视图）
 *   - renderKbSql(el, query, opts?)：快照渲染（重复调用整段重建）；opts 回调与事件双通道
 *   - initKbSql(root?)：幂等标记驱动（__icenKbSqlInit）+ 返回销毁函数；事件委托：
 *       · data-kb-sql-copy   → 复制当前 SQL（源=pre.textContent，即 token 拼接原文）
 *       · data-kb-sql-edit   → 进入编辑态（pre 藏、textarea 现，初值=当前 SQL）
 *       · data-kb-sql-confirm→ 退出编辑态并把 pre 重渲为新 SQL，
 *                              派 icen:kb-sql-edit {sql} + icen:kb-sql-rerun {sql}
 *       · data-kb-sql-cancel / Escape → 放弃编辑还原
 *       · data-kb-sql-apply  → 派 icen:kb-sql-rerun {sql}（sql=修复版）
 *       · textarea 内 Ctrl/Cmd+Enter 确认、Escape 取消
 *     修正卡的 diff 折叠/接受/拒绝复用 initAiDiff（同根委托，幂等共存）
 *   - 事件（events.ts 已登记）：icen:kb-sql-edit {sql} / icen:kb-sql-rerun {sql}
 */

import { h, svgIcon, type KbSqlQuery, normalizeSqlQuery } from './kb-core';
import { emitIcen } from './events';
import { parseUnifiedDiff, renderAiDiff, initAiDiff } from './ai-diff';

/* ── 图标（单色线性 1.5px，一律经 svgIcon 消毒） ── */

const ico = (d: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON_COPY = ico('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>');
const ICON_EDIT = ico('<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>');
const ICON_WRENCH = ico('<path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.5 12l-2.5-2.5Z"/>');

/* ═══════════════ highlightSql：零依赖 SQL 着色 ═══════════════ */

/** 关键词表（大小写不敏感；GROUP BY / ORDER BY 等以单词粒度各自命中） */
const SQL_KEYWORDS: ReadonlySet<string> = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'JOIN', 'ON', 'AND', 'OR', 'NOT',
  'LIMIT', 'HAVING', 'WITH', 'AS', 'UNION', 'ALL', 'INSERT', 'INTO', 'VALUES', 'UPDATE',
  'SET', 'DELETE', 'CREATE', 'TABLE', 'VIEW', 'INDEX', 'DROP', 'ALTER', 'ADD', 'DISTINCT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS',
  'NATURAL', 'USING', 'ASC', 'DESC', 'NULLS', 'IS', 'NULL', 'IN', 'LIKE', 'ILIKE', 'BETWEEN',
  'EXISTS', 'OVER', 'PARTITION', 'WINDOW', 'OFFSET', 'FETCH', 'EXCEPT', 'INTERSECT', 'PRIMARY',
  'FOREIGN', 'KEY', 'REFERENCES', 'DEFAULT', 'UNIQUE', 'CONSTRAINT', 'CHECK', 'TRUE', 'FALSE',
  'INTERVAL', 'RECURSIVE', 'RETURNING', 'CONFLICT',
]);

interface SqlToken {
  text: string;
  /** kw 关键词 / str 字符串 / num 数字 / fn 函数名 / cmt 注释；null = 普通文本 */
  kind: 'kw' | 'str' | 'num' | 'fn' | 'cmt' | null;
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isWordHead = (c: string): boolean => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isWordChar = (c: string): boolean => isWordHead(c) || isDigit(c);
const isPlain = (c: string): boolean => !isDigit(c) && !isWordHead(c) && c !== "'" && c !== '-' && c !== '/';

/**
 * 单遍扫描切词：注释（-- 与 块注释）→ 字符串（'' 转义）→ 数字 → 词（关键词/函数名）→ 其余原样。
 * 流式安全：未闭合的字符串与块注释把余文按普通 token 收尾（下一次快照重渲自然修正）。
 */
function tokenizeSql(sql: string): SqlToken[] {
  const out: SqlToken[] = [];
  const n = sql.length;
  let i = 0;
  while (i < n) {
    const ch = sql[i]!;

    /* 行注释 -- … 至行尾（换行符留给下一段） */
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? n : nl;
      out.push({ text: sql.slice(i, end), kind: 'cmt' });
      i = end;
      continue;
    }

    /* 块注释 /* … *\/ */
    if (ch === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      if (close === -1) {
        out.push({ text: sql.slice(i), kind: null }); /* 未闭合（流式中）：普通 token 收尾 */
        break;
      }
      out.push({ text: sql.slice(i, close + 2), kind: 'cmt' });
      i = close + 2;
      continue;
    }

    /* 单引号字符串（'' 转义） */
    if (ch === "'") {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          closed = true;
          break;
        }
        j++;
      }
      if (!closed) {
        out.push({ text: sql.slice(i), kind: null }); /* 未闭合（流式中）：普通 token 收尾 */
        break;
      }
      out.push({ text: sql.slice(i, j + 1), kind: 'str' });
      i = j + 1;
      continue;
    }

    /* 数字（含小数点；负号留给运算符段，避免把 a-1 误判） */
    if (isDigit(ch)) {
      let j = i;
      while (j < n && (isDigit(sql[j]!) || sql[j] === '.')) j++;
      out.push({ text: sql.slice(i, j), kind: 'num' });
      i = j;
      continue;
    }

    /* 词：关键词优先；非关键词后跟（可含空白的）"(" 判为函数名 */
    if (isWordHead(ch)) {
      let j = i;
      while (j < n && isWordChar(sql[j]!)) j++;
      const word = sql.slice(i, j);
      let kind: SqlToken['kind'] = null;
      if (SQL_KEYWORDS.has(word.toUpperCase())) {
        kind = 'kw';
      } else {
        let k = j;
        while (k < n && (sql[k] === ' ' || sql[k] === '\t')) k++;
        if (sql[k] === '(') kind = 'fn';
      }
      out.push({ text: word, kind });
      i = j;
      continue;
    }

    /* 其余（运算符/标点/空白）批量作普通 token；落单的 - / 前进一位防死循环 */
    let j = i;
    while (j < n && isPlain(sql[j]!)) j++;
    if (j === i) j = i + 1;
    out.push({ text: sql.slice(i, j), kind: null });
    i = j;
  }
  return out;
}

/**
 * 零依赖 SQL 着色：关键词（大小写不敏感）/ 单引号字符串 / 行注释与块注释 / 数字 /
 * 函数名（后跟 "(" 的词）→ span token（.kb-sql-tok--kw/-str/-num/-fn/-cmt）。
 * 纯 DOM 构造（createElement + textContent，无 innerHTML）；流式安全（未闭合
 * 字符串/注释按普通文本收尾，下一次重渲自然修正）。着色是语法层级信号，不是装饰。
 */
export function highlightSql(sql: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const t of tokenizeSql(String(sql ?? ''))) {
    if (t.kind) {
      const span = document.createElement('span');
      span.className = `kb-sql-tok--${t.kind}`;
      span.textContent = t.text;
      frag.appendChild(span);
    } else {
      frag.appendChild(document.createTextNode(t.text));
    }
  }
  return frag;
}

/* ═══════════════ makeSqlDiff：行级 unified diff（纯函数） ═══════════════ */

type DiffOp = { t: 'ctx' | 'del' | 'add'; text: string };

/** 行级 LCS（O(n·m)；超限退化为整段替换，SQL 修正场景量级远低于阈值） */
function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  if (n * m > 1_000_000) {
    return [
      ...a.map((text): DiffOp => ({ t: 'del', text })),
      ...b.map((text): DiffOp => ({ t: 'add', text })),
    ];
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: 'ctx', text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ t: 'del', text: a[i]! });
      i++;
    } else {
      ops.push({ t: 'add', text: b[j]! });
      j++;
    }
  }
  while (i < n) ops.push({ t: 'del', text: a[i++]! });
  while (j < m) ops.push({ t: 'add', text: b[j++]! });
  return ops;
}

/**
 * 生成两段 SQL 的 unified diff 文本（-/+ 行对 + 3 行上下文 hunks），
 * 可直接交 parseUnifiedDiff 解析。纯函数、SSR 安全；a===b 时返回只有
 * 文件头的空 diff（渲染端呈现「无差异内容」）。
 * 已知边界：被删行本身以「-- 」开头（SQL 行注释）时会与 unified diff 的
 * 文件头语法撞车（ai-diff 解析器按 --- 归为旧文件名行），该行在 diff 视图
 * 中缺显但不影响其余行 —— git header 预置旧路径可保文件名不被污染。
 */
export function makeSqlDiff(a: string, b: string): string {
  const ops = diffLines(String(a ?? '').split('\n'), String(b ?? '').split('\n'));
  const CTX = 3;

  /* 前缀行号表：oldAt[k]/newAt[k] = 第 k 个 op 之前的旧/新文件行号 */
  const n = ops.length;
  const oldAt = new Array<number>(n + 1);
  const newAt = new Array<number>(n + 1);
  oldAt[0] = 1;
  newAt[0] = 1;
  for (let k = 0; k < n; k++) {
    oldAt[k + 1] = oldAt[k]! + (ops[k]!.t === 'add' ? 0 : 1);
    newAt[k + 1] = newAt[k]! + (ops[k]!.t === 'del' ? 0 : 1);
  }

  /* 变更窗口 → hunks（相邻变更间距 ≤ 2·CTX 合并） */
  const hunks: string[] = [];
  let i = 0;
  while (i < n) {
    let change = -1;
    for (let k = i; k < n; k++) {
      if (ops[k]!.t !== 'ctx') {
        change = k;
        break;
      }
    }
    if (change === -1) break;

    const start = Math.max(0, change - CTX);
    let end = change;
    let sinceChange = 0;
    for (let k = change; k < n; k++) {
      if (ops[k]!.t !== 'ctx') {
        sinceChange = 0;
        end = k;
      } else {
        sinceChange++;
        if (sinceChange <= CTX) end = k;
        else break;
      }
    }
    const stop = end + 1;

    const slice = ops.slice(start, stop);
    const oldCount = slice.filter((o) => o.t !== 'add').length;
    const newCount = slice.filter((o) => o.t !== 'del').length;
    /* 空侧的起点按 unified diff 惯例取插入位置前一行 */
    const oStart = oldCount === 0 ? Math.max(0, oldAt[start]! - 1) : oldAt[start]!;
    const nStart = newCount === 0 ? Math.max(0, newAt[start]! - 1) : newAt[start]!;

    const body = slice.map((o) => `${o.t === 'del' ? '-' : o.t === 'add' ? '+' : ' '}${o.text}`).join('\n');
    hunks.push(`@@ -${oStart},${oldCount} +${nStart},${newCount} @@\n${body}`);
    i = stop;
  }

  return ['diff --git a/prev.sql b/sql.sql', '--- a/prev.sql', '+++ b/sql.sql', ...hunks].join('\n');
}

/* ═══════════════ renderKbSql：快照渲染 ═══════════════ */

/** renderKbSql 选项：handle 回调通道（事件通道恒开，二者独立可用） */
export interface KbSqlRenderOptions {
  /** 卡片标题（缺省「生成的 SQL」） */
  title?: string;
  /** 编辑确认回调（与 icen:kb-sql-edit 同语义） */
  onEdit?: (sql: string) => void;
  /** 重跑回调：编辑确认与「应用修复并重跑」共用（与 icen:kb-sql-rerun 同语义） */
  onRerun?: (sql: string) => void;
}

/** 造「icon + 文本」按钮（icon 经 svgIcon 消毒；文本 span 单列，便于运行时改文案） */
function iconBtn(
  cls: string,
  dataAttr: string,
  icon: string,
  label: string,
): HTMLButtonElement {
  const btn = h('button', cls);
  btn.type = 'button';
  btn.setAttribute(dataAttr, '');
  const iconBox = h('span', 'kb-sql-btn-icon');
  const svg = svgIcon(icon);
  if (svg) iconBox.appendChild(svg);
  btn.appendChild(iconBox);
  btn.appendChild(h('span', 'kb-sql-btn-text', label));
  return btn;
}

/**
 * 渲染生成 SQL 卡片（快照式：重复调用整段重建 el 内容），返回挂载元素 el
 * （render* 约定；SSR 原样返回）。结构：头（标题/可见性徽标/引用表 chips/操作钮）
 * + 着色码块 + 修正卡（prevSql 存在且≠sql 时，diff 复用 ai-diff 域渲染，默认展开）
 * + 编辑态 textarea（editable 时预置，由 initKbSql 切换显隐）。
 */
export function renderKbSql(
  el: HTMLElement,
  query: KbSqlQuery | Partial<KbSqlQuery>,
  opts?: KbSqlRenderOptions,
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const q = normalizeSqlQuery(query as Partial<KbSqlQuery>);
  el.textContent = '';

  const card = h('div', 'kb-sql');
  card.dataset.kbSql = '';

  /* 头 */
  const head = h('div', 'kb-sql-head');
  head.appendChild(h('span', 'kb-sql-title', opts?.title ?? '生成的 SQL'));
  if (q.visibility === 'admin') head.appendChild(h('span', 'kb-badge kb-badge--admin', '仅管理员可见'));
  if (q.dialect) head.appendChild(h('span', 'kb-meta', q.dialect));
  if (q.tables?.length) {
    const tables = h('span', 'kb-sql-tables');
    for (const t of q.tables) tables.appendChild(h('span', 'kb-chip', t));
    head.appendChild(tables);
  }
  const actions = h('span', 'kb-sql-actions');
  actions.appendChild(iconBtn('kb-sql-btn', 'data-kb-sql-copy', ICON_COPY, '复制'));
  if (q.editable) actions.appendChild(iconBtn('kb-sql-btn', 'data-kb-sql-edit', ICON_EDIT, '编辑重跑'));
  head.appendChild(actions);
  card.appendChild(head);

  /* 着色码块（pre.textContent 即当前 SQL 全文 —— 复制/编辑/修复重跑的单一事实源） */
  const pre = h('pre', 'kb-sql-code');
  pre.setAttribute('data-kb-sql-code', '');
  pre.appendChild(highlightSql(q.sql));
  card.appendChild(pre);

  /* 修正卡：prevSql 存在且 ≠ sql 才呈现（「修复已就绪」心智） */
  if (typeof q.prevSql === 'string' && q.prevSql !== q.sql) {
    const fix = h('div', 'kb-sql-fix');
    const fixHead = h('div', 'kb-sql-fix-head');
    const fixTitle = h('span', 'kb-sql-fix-title');
    const warnSvg = svgIcon(ico('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'));
    if (warnSvg) fixTitle.appendChild(warnSvg);
    fixTitle.appendChild(h('span', '', '检测到上版报错，修复建议已就绪'));
    fixHead.appendChild(fixTitle);
    const applyBtn = iconBtn('kb-sql-btn kb-sql-btn--apply', 'data-kb-sql-apply', ICON_WRENCH, '应用修复并重跑');
    fixHead.appendChild(applyBtn);
    fix.appendChild(fixHead);

    const diffBox = h('div', 'kb-sql-fix-diff');
    renderAiDiff(diffBox, { files: parseUnifiedDiff(makeSqlDiff(q.prevSql, q.sql)) });
    /* 修正卡首屏即见差异（ai-diff 默认折叠是为长文件列表，此处单文件修复直出） */
    diffBox.querySelectorAll<HTMLElement>('.ai-diff-file').forEach((file) => {
      const body = file.querySelector<HTMLElement>('.ai-diff-body');
      if (body) body.hidden = false;
      file.querySelector<HTMLElement>('.ai-diff-head')?.setAttribute('aria-expanded', 'true');
    });
    fix.appendChild(diffBox);
    card.appendChild(fix);

    if (opts?.onRerun) {
      const onRerun = opts.onRerun;
      applyBtn.addEventListener('click', () => onRerun(pre.textContent ?? ''));
    }
  }

  /* 编辑态（预置隐藏；initKbSql 委托切换；确认走事件 + opts 回调双通道） */
  if (q.editable) {
    const editor = h('div', 'kb-sql-editor');
    editor.hidden = true;
    const ta = document.createElement('textarea');
    ta.className = 'kb-sql-textarea';
    ta.setAttribute('data-kb-sql-textarea', '');
    ta.spellcheck = false;
    editor.appendChild(ta);

    const editorActions = h('div', 'kb-sql-editor-actions');
    const cancelBtn = h('button', 'kb-sql-btn', '取消');
    cancelBtn.type = 'button';
    cancelBtn.setAttribute('data-kb-sql-cancel', '');
    const confirmBtn = h('button', 'kb-sql-btn kb-sql-btn--run', '确认并重跑');
    confirmBtn.type = 'button';
    confirmBtn.setAttribute('data-kb-sql-confirm', '');
    editorActions.appendChild(cancelBtn);
    editorActions.appendChild(confirmBtn);
    editor.appendChild(editorActions);
    card.appendChild(editor);

    const onEdit = opts?.onEdit;
    const onRerun = opts?.onRerun;
    if (onEdit || onRerun) {
      confirmBtn.addEventListener('click', () => {
        const sql = ta.value;
        if (!sql.trim()) return;
        onEdit?.(sql);
        onRerun?.(sql);
      });
    }
  }

  el.appendChild(card);
  return el;
}

/* ═══════════════ initKbSql：委托交互（幂等 + 销毁） ═══════════════ */

interface KbSqlScope extends ParentNode {
  __icenKbSqlInit?: boolean;
}

const noopDestroy = (): void => undefined;

/* 「已复制」回显计时器（WeakMap 防重复计时） */
const copyTimers = new WeakMap<HTMLElement, number>();

function flashCopied(textSpan: HTMLElement): void {
  textSpan.textContent = '已复制';
  const prev = copyTimers.get(textSpan);
  if (prev != null) clearTimeout(prev);
  copyTimers.set(
    textSpan,
    window.setTimeout(() => {
      textSpan.textContent = '复制';
      copyTimers.delete(textSpan);
    }, 1200),
  );
}

function copyText(text: string): void {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => undefined);
    return;
  }
  /* 旧环境兜底：临时 textarea + execCommand */
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* 静默：复制失败不阻断交互 */
  }
  ta.remove();
}

function setEditMode(card: HTMLElement, editing: boolean): void {
  const pre = card.querySelector<HTMLElement>('.kb-sql-code');
  const editor = card.querySelector<HTMLElement>('.kb-sql-editor');
  const ta = card.querySelector<HTMLTextAreaElement>('.kb-sql-textarea');
  if (!pre || !editor || !ta) return;
  editor.hidden = !editing;
  pre.hidden = editing;
  card.classList.toggle('is-editing', editing);
  if (editing) {
    ta.value = pre.textContent ?? '';
    ta.focus();
  }
}

/** 确认编辑：pre 重渲为新 SQL（更新单一事实源）→ 退出编辑态 → 派 edit + rerun */
function confirmEdit(card: HTMLElement, source: Element): void {
  const ta = card.querySelector<HTMLTextAreaElement>('.kb-sql-textarea');
  const sql = ta?.value ?? '';
  if (!sql.trim()) return;
  const pre = card.querySelector<HTMLElement>('.kb-sql-code');
  if (pre) {
    pre.textContent = '';
    pre.appendChild(highlightSql(sql));
  }
  setEditMode(card, false);
  emitIcen(source, 'icen:kb-sql-edit', { sql });
  emitIcen(source, 'icen:kb-sql-rerun', { sql });
}

/**
 * 委托初始化：复制 / 编辑态切换 / 确认重跑 / 应用修复。幂等（同 root 重复调用
 * 安全），返回销毁函数（移除监听并复位标记，可重新 init）；SSR 返回空销毁。
 * 内部同时挂 initAiDiff（修正卡 diff 的折叠与接受/拒绝），销毁时一并回收。
 */
export function initKbSql(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return noopDestroy;
  const scope = root ?? document;
  const marked = scope as KbSqlScope;
  if (marked.__icenKbSqlInit) return noopDestroy;
  marked.__icenKbSqlInit = true;

  const destroyAiDiff = initAiDiff(scope);
  const target = scope as ParentNode & EventTarget;

  const currentSql = (card: HTMLElement): string =>
    card.querySelector('.kb-sql-code')?.textContent ?? '';

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const card = t.closest<HTMLElement>('[data-kb-sql]');
    if (!card) return;

    const copyBtn = t.closest<HTMLButtonElement>('[data-kb-sql-copy]');
    if (copyBtn) {
      copyText(currentSql(card));
      const label = copyBtn.querySelector('.kb-sql-btn-text');
      if (label instanceof HTMLElement) flashCopied(label);
      return;
    }

    if (t.closest('[data-kb-sql-edit]')) {
      setEditMode(card, true);
      return;
    }

    if (t.closest('[data-kb-sql-cancel]')) {
      setEditMode(card, false);
      return;
    }

    const confirmBtn = t.closest<HTMLButtonElement>('[data-kb-sql-confirm]');
    if (confirmBtn) {
      confirmEdit(card, confirmBtn);
      return;
    }

    const applyBtn = t.closest<HTMLButtonElement>('[data-kb-sql-apply]');
    if (applyBtn) {
      emitIcen(applyBtn, 'icen:kb-sql-rerun', { sql: currentSql(card) });
    }
  };

  const onKeydown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    const t = ke.target instanceof Element ? ke.target : null;
    if (!t || !t.matches('[data-kb-sql-textarea]')) return;
    const card = t.closest<HTMLElement>('[data-kb-sql]');
    if (!card) return;
    if (ke.key === 'Escape') {
      ke.preventDefault();
      setEditMode(card, false);
      return;
    }
    if (ke.key === 'Enter' && (ke.ctrlKey || ke.metaKey)) {
      ke.preventDefault();
      confirmEdit(card, t);
    }
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKeydown);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('keydown', onKeydown);
    marked.__icenKbSqlInit = false;
    destroyAiDiff();
  };
}
