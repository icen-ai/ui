/** Mention input with object-level mention entities. createMentions accepts a
 * host containing a native `<textarea class="icen-input">` (declarative markup
 * stays unchanged) and replaces it with a rich editor
 * `div.icen-input.icen-mentions-editor` (contenteditable, role=textbox,
 * aria-multiline). Directory and custom mentions render as atomic
 * `<span class="icen-mention-token is-directory|is-custom" contenteditable="false">`
 * pills: the caret can never enter a token, Backspace/Delete remove the whole
 * token, and the model behind every token keeps the complete source object
 * (getValue()/getMentions() return entity blocks, never regex guesses). The
 * `@query` trigger/caret queries share cancellable source ownership with
 * autocomplete; the portal panel keeps its named listbox plus sibling
 * loading/empty/retry states, and multi-line textbox semantics intentionally
 * omit aria-expanded. Render-only text is always written via textContent.
 *
 * 模式（opts.mode）：'select'（默认）只能从 source 候选中选择；'custom' 允许把
 * 当前 query 创建为自定义提及（createCustom 可返回完整自定义对象，默认
 * `{ id: 'custom:'+query, label: query }`，token 虚线边 + 「自定义」徽标）。
 */

import { emitIcen } from './events';
import { t } from './i18n';
import { isAvailableForFocus } from './focus';
import {createSuggestionQuery,createSuggestionStatus,watchSuggestionField,afterSuggestionField,type SuggestionSourceContext} from './suggestions';
import { revealPopoverItem, computePopoverLayout, resolvePanelSizing, sizingToLayout, claimMenuFocus, type PopoverLayoutOptions } from './popover';

/** 一条提及候选/数据对象：id 必填，展示名取 label ?? name ?? id；额外字段（email/role…）全量保留。 */
export type MentionItem<T = Record<string, unknown>> = {
  /** 业务唯一键（随 MentionEntity 与 icen:mention-select 回给宿主） */
  id: string;
  /** 展示名（优先于 name/id） */
  label?: string;
  /** 展示名（label 缺省时回退） */
  name?: string;
  /** 辅助匹配关键字（给 source 过滤用，组件不消费） */
  keywords?: string;
  /** true = 置灰不可选（键盘导航跳过，点击不生效） */
  disabled?: boolean;
} & T;

/** 一个仍存活于编辑区中的提及实体：item 是完整原始 user/custom 对象。 */
export interface MentionEntity<T = Record<string, unknown>> {
  type: 'mention';
  id: string;
  /** 展示名（label ?? name ?? id 推导后的最终值） */
  label: string;
  /** directory = 来自 source 候选；custom = 自定义创建的提及 */
  kind: 'directory' | 'custom';
  /** 完整源对象（目录成员保留完整 user 对象；自定义保留完整自定义对象） */
  item: MentionItem<T>;
}

/** 内容块：纯文本段或原子提及段（getValue() 的返回单元）。 */
export type MentionValue<T = Record<string, unknown>> =
  | { type: 'text'; text: string }
  | MentionEntity<T>;

export interface MentionsOptions<T = Record<string, unknown>> {
  /** 查询过滤源：按 query 返回候选（同步数组或 Promise）；返回值可携带任意额外字段，全量保留进实体 */
  source: (query: string, context: SuggestionSourceContext) => MentionItem<T>[] | Promise<MentionItem<T>[]>;
  /** 触发字符（默认 '@'） */
  trigger?: string;
  /** 选择模式：'select'（默认）只能从候选中选；'custom' 允许把当前 query 创建成自定义提及 */
  mode?: 'select' | 'custom';
  /** custom 模式：宿主返回完整自定义对象（缺省 `{ id: 'custom:'+query, label: query }`） */
  createCustom?: (query: string) => MentionItem<T>;
  /** 面板最多显示条数（默认 8；不含追加的「创建 …」项） */
  max?: number;
  /** 触发所需最少查询字符数（默认 0 = 输入 @ 即出） */
  minChars?: number;
  /** source 调用防抖（默认 160ms；0 = 同步立即调） */
  debounceMs?: number;
  /** 异步加载态占位文案（默认取 i18n mentions.loading，可被 opts 覆盖） */
  loadingLabel?: string;
  errorLabel?: string;
  retryLabel?: string;
  noResultsLabel?: string;
  renderItem?: (item: MentionItem<T>, query: string) => Node | string;
  /** 内容变化（在 icen:mention-change 派发后调用） */
  onChange?: (value: MentionValue<T>[], text: string) => void;
  /** 选中回调（在 icen:mention-select 派发后调用；item 是完整 MentionEntity） */
  onSelect?: (entity: MentionEntity<T>) => void;
}

export interface MentionsHandle<T = Record<string, unknown>> {
  /** 内容块视图：text/mention 交替；mention 块携带完整源对象 */
  getValue(): MentionValue<T>[];
  /** 纯文本视图（token 展开为 `@label`） */
  getText(): string;
  /** 当前仍存在的提及实体（只含存活 token） */
  getMentions(): MentionEntity<T>[];
  /** 程序化设值：纯文本字符串，或 string | MentionValue | 原始对象 的混合数组（有 id 的对象渲染成原子提及） */
  setValue(value: string | Array<string | MentionValue<T> | MentionItem<T>>): void;
  /** Cancel the current suggestions without modifying the text. */
  close(): void;
  /** 关闭面板、摘除监听/计时器，恢复原始 textarea 并回填当前纯文本 */
  destroy(): void;
}

let panelSeq = 0;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** label 推导：label ?? name ?? id。 */
function itemLabel(item: { id: string; label?: string; name?: string }): string {
  return item.label ?? item.name ?? item.id;
}

/** 归一一条 source 结果：只校验 string id；label 推导，其余字段全量保留（不丢 email/role 等）。 */
function normalizeItem(raw: unknown): MentionItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  const base = { ...o, id: o.id } as MentionItem;
  const label = itemLabel(base);
  return { ...base, label };
}

/** 归一 source 结果数组：诚实丢弃无 string id 的条目。 */
function normalizeItems(raw: unknown): MentionItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MentionItem[] = [];
  for (const it of raw) {
    const item = normalizeItem(it);
    if (item) out.push(item);
  }
  return out;
}

interface TriggerMatch {
  /** trigger 字符在纯文本中的下标（替换区间的起点） */
  start: number;
  /** token 中的查询串（trigger 之后、caret 之前） */
  query: string;
}

/** 检测光标前的 trigger token：边界 = 行首或空白后，query 不含空白与 trigger 字符。 */
function findTrigger(text: string, trigger: string): TriggerMatch | null {
  if (!trigger) return null;
  const re = new RegExp(`(^|\\s)${escapeRegExp(trigger)}([^\\s${escapeRegExp(trigger)}]*)$`);
  const m = text.match(re);
  if (!m) return null;
  const start = (m.index ?? 0) + m[1].length;
  return { start, query: m[2] ?? '' };
}

/** token 的纯文本贡献：`@label`。 */
function tokenText(el: HTMLElement, trigger: string): string {
  const bdi = el.querySelector('bdi');
  return bdi?.textContent ?? `${trigger}${el.dataset.icenMentionLabel ?? ''}`;
}

const mounted = new WeakMap<HTMLElement, MentionsHandle<unknown>>();

export function createMentions<T = Record<string, unknown>>(el: HTMLElement, opts: MentionsOptions<T>): MentionsHandle<T> {
  /* SSR 守卫：window/document 未定义时静默返回 noop handle */
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { getValue: () => [], getText: () => '', getMentions: () => [], setValue() {}, close() {}, destroy() {} };
  }
  if (!opts || typeof opts.source !== 'function') {
    return { getValue: () => [], getText: () => '', getMentions: () => [], setValue() {}, close() {}, destroy() {} };
  }

  const found = el instanceof HTMLTextAreaElement
    ? el
    : (el.querySelector<HTMLTextAreaElement>('textarea.icen-input')
        ?? el.querySelector<HTMLTextAreaElement>('textarea'));
  if (!found) {
    console.warn('[@icen.ai/ui] mentions: el 内未找到 textarea，已跳过创建');
    return { getValue: () => [], getText: () => '', getMentions: () => [], setValue() {}, close() {}, destroy() {} };
  }
  if (!found.isConnected) {
    console.warn('[@icen.ai/ui] mentions: textarea 已不在文档中（可能已创建过实例），已跳过创建');
    return { getValue: () => [], getText: () => '', getMentions: () => [], setValue() {}, close() {}, destroy() {} };
  }
  /* 非空别名：提升式函数声明在作用域入口取声明类型（含 null），别名把非空面钉死 */
  const ta: HTMLTextAreaElement = found;
  /* form 关联与初始值须在摘出 textarea 之前捕获（摘出后 ta.form 解析不到） */
  const formEl = ta.form;
  const initialValue = ta.value;

  /* ── 富文本编辑区：替换 textarea（id/class/aria-label/placeholder/rows 转移，避免重复）── */
  const editor = document.createElement('div');
  editor.className = ta.className ? `${ta.className} icen-mentions-editor` : 'icen-mentions-editor';
  const originalId = ta.getAttribute('id');
  const originalPlaceholder = ta.getAttribute('placeholder');
  const originalName = ta.getAttribute('name');
  const ariaLabel = ta.getAttribute('aria-label');
  /* label[for] 不能标注 div：labels 依赖原 id，必须在转移 id 前捕获文本 */
  const linkedLabel = ta.labels?.[0]?.textContent?.trim() || null;
  const fieldLabel = ariaLabel ?? linkedLabel;
  if (originalId !== null) {
    editor.id = originalId;
    ta.removeAttribute('id');
  }
  if (fieldLabel !== null) editor.setAttribute('aria-label', fieldLabel);
  if (originalPlaceholder !== null) {
    editor.dataset.icenPlaceholder = originalPlaceholder;
    ta.removeAttribute('placeholder');
  }
  const rows = ta.getAttribute('rows');
  if (rows !== null) editor.style.setProperty('--icen-mentions-rows', rows);
  editor.setAttribute('contenteditable', 'true');
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-multiline', 'true');
  editor.tabIndex = 0;
  /* 禁用/只读沿 textarea 转移：不仅关查询，也关闭 contenteditable 与焦点入口 */
  const originalAriaDisabled = ta.getAttribute('aria-disabled');
  if (ta.disabled || ta.readOnly || originalAriaDisabled === 'true') {
    editor.setAttribute('aria-disabled', 'true');
    editor.setAttribute('contenteditable', 'false');
    editor.tabIndex = -1;
  }
  /* 面板 aria-label：labels 依赖 id，须在移除 id 之前捕获 */
  const listboxLabel = fieldLabel ?? t('suggestions.options');

  /* 同名 hidden input 承接纯文本（表单提交口径），textarea 的 name 移交 */
  let hidden: HTMLInputElement | null = null;
  if (originalName !== null) {
    hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = originalName;
    ta.removeAttribute('name');
  }

  /* 初始内容：textarea 原始值作为纯文本起稿（无对象可还原，提及一律经 source/setValue 建立） */
  if (initialValue) editor.appendChild(document.createTextNode(initialValue));
  ta.before(editor);
  if (hidden) editor.after(hidden);
  ta.remove();

  const trigger = opts.trigger ?? '@';
  const mode = opts.mode === 'custom' ? 'custom' : 'select';
  const count = (value: number | undefined, fallback: number, min: number): number =>
    Number.isFinite(value) ? Math.max(min, Math.floor(value!)) : fallback;
  const max = count(opts.max, 8, 1);
  const minChars = count(opts.minChars, 0, 0);
  const debounceMs = count(opts.debounceMs, 160, 0);
  const loadingLabel = opts.loadingLabel ?? t('mentions.loading');

  /* ── 状态 ── */
  /** 每个 token DOM 与其 MentionEntity 的绑定（getValue/getMentions 的唯一事实源） */
  const tokenData = new Map<HTMLElement, MentionEntity<T>>();
  let items: MentionItem<T>[] = [];
  /** 面板条目：候选项 + custom 模式的「创建 …」虚拟项 */
  type PanelEntry = { kind: 'item'; item: MentionItem<T> } | { kind: 'create'; query: string };
  let entries: PanelEntry[] = [];
  let activeIndex = -1;
  let current: TriggerMatch | null = null;
  let currentQuery = '';
  let open = false;
  let composing = false;
  /** Query ownership and presentation state. */
  let busy = false;
  let failed = false;
  let lastComposition: string | null = null;
  let release: (() => void) | null = null;
  let lastText = '';
  let destroyed = false;

  /* ── 面板（portal 到 body）── */
  const panelId = `icen-mentions-panel-${++panelSeq}`;
  const panel = document.createElement('div');
  panel.className = 'icen-mentions-panel';
  panel.id = panelId;
  panel.hidden = true;
  const list = document.createElement('div');
  list.className = 'icen-mentions-list';
  list.id = `${panelId}-list`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', listboxLabel);
  panel.append(list);
  document.body.appendChild(panel);

  const notice = createSuggestionStatus(() => { editor.focus({ preventScroll: true }); onValueChanged(0); },
    { loading: loadingLabel, error: opts.errorLabel, retry: opts.retryLabel });
  const status = notice.el;
  status.classList.add('icen-mentions-status');
  panel.append(status);
  const empty = document.createElement('div');
  empty.className = 'icen-mentions-empty';
  empty.setAttribute('role', 'status');
  empty.hidden = true;
  empty.textContent = opts.noResultsLabel ?? t('suggestions.empty');
  panel.append(empty);

  const query = createSuggestionQuery(opts.source, {
    pending() { if (!canQuery()) return; busy = true; failed = false; items = []; entries = []; activeIndex = -1; list.replaceChildren(); empty.hidden = true; editor.setAttribute('aria-busy', 'true'); notice.show('loading'); syncActive(); setOpen(true); position(); },
    success(raw) { if (!canQuery()) { close(); return; } busy = false; failed = false; editor.removeAttribute('aria-busy'); notice.show(null); renderItems(normalizeItems(raw) as unknown as MentionItem<T>[]); empty.hidden = entries.length > 0; setOpen(true); position(); },
    error() { if (!canQuery()) { close(); return; } busy = false; failed = true; items = []; entries = []; activeIndex = -1; list.replaceChildren(); empty.hidden = true; editor.removeAttribute('aria-busy'); notice.show('error'); syncActive(); setOpen(true); position(); },
  });

  /* ── 纯文本映射：offset ⇄ DOM ── */
  interface TextMark { start: number; end: number; el: HTMLElement }
  interface TextMap { text: string; marks: TextMark[] }

  function isTokenEl(node: Node): node is HTMLElement {
    return node instanceof HTMLElement && node.classList.contains('icen-mention-token');
  }

  /** 编辑区全文（token 展开为 `@label`）+ token 的 offset 区间表。 */
  function readText(): TextMap {
    let text = '';
    const marks: TextMark[] = [];
    for (const child of Array.from(editor.childNodes)) {
      if (isTokenEl(child)) {
        const start = text.length;
        text += tokenText(child, trigger);
        marks.push({ start, end: text.length, el: child });
      } else if (child instanceof Text) {
        text += child.data;
      } else if (child instanceof HTMLBRElement) {
        text += '\n';
      } else if (child instanceof HTMLElement) {
        text += child.textContent ?? '';
      }
    }
    return { text, marks };
  }

  /** 编辑区纯文本（占位同步/隐藏域/getText 的口径）。 */
  function currentText(): string {
    return readText().text;
  }

  /** 光标前的 trigger 命中：命中点落在 token 内部（@ 是 token 文本而非真实输入）时无效。 */
  function triggerAt(map: TextMap, caret: number): TriggerMatch | null {
    const match = findTrigger(map.text.slice(0, caret), trigger);
    if (!match) return null;
    if (map.marks.some((m) => match.start >= m.start && match.start < m.end)) return null;
    return match;
  }

  /** 全局文本 offset → DOM 位置（token 内部钳制到其边界）。 */
  function positionFromOffset(map: TextMap, offset: number): { node: Node; offset: number } {
    let acc = 0;
    const children = Array.from(editor.childNodes);
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      let len = 0;
      if (child instanceof Text) len = child.data.length;
      else if (child instanceof HTMLBRElement) len = 1;
      else if (isTokenEl(child)) len = tokenText(child, trigger).length;
      else if (child instanceof HTMLElement) len = child.textContent?.length ?? 0;
      if (child instanceof Text) {
        if (offset <= acc + len) return { node: child, offset: offset - acc };
      } else if (offset < acc + len) {
        return { node: editor, offset: i };
      } else if (offset === acc + len) {
        return { node: editor, offset: i + 1 };
      }
      acc += len;
    }
    return { node: editor, offset: children.length };
  }

  /** DOM 位置 → 全局文本 offset（selection 落进 token 时钳制到其起点）。 */
  function offsetOfPosition(node: Node, nodeOffset: number): number | null {
    if (!editor.contains(node)) return null;
    if (node === editor) {
      let acc = 0;
      const children = Array.from(editor.childNodes);
      for (let i = 0; i < nodeOffset && i < children.length; i++) {
        const child = children[i]!;
        acc += child instanceof Text ? child.data.length
          : child instanceof HTMLBRElement ? 1
            : isTokenEl(child) ? tokenText(child, trigger).length
              : child.textContent?.length ?? 0;
      }
      return acc;
    }
    let acc = 0;
    let found = false;
    const walk = (parent: Node): void => {
      for (const child of Array.from(parent.childNodes)) {
        if (found) return;
        if (child === node) { acc += node.nodeType === 3 ? Math.min(nodeOffset, (node as Text).data.length) : 0; found = true; return; }
        if (child instanceof Text) acc += child.data.length;
        else if (child instanceof HTMLBRElement) acc += 1;
        else if (isTokenEl(child)) acc += tokenText(child, trigger).length;
        else walk(child);
      }
    };
    walk(editor);
    return found ? acc : null;
  }

  function selectionRange(): Range | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.startContainer) && range.startContainer !== editor) return null;
    if (!editor.contains(range.endContainer) && range.endContainer !== editor) return null;
    return range;
  }

  function selectionCollapsed(): boolean {
    const range = selectionRange();
    return !!range && range.startContainer === range.endContainer && range.startOffset === range.endOffset;
  }

  function getCaretOffset(): number | null {
    const range = selectionRange();
    if (!range || !selectionCollapsed()) return null;
    return offsetOfPosition(range.startContainer, range.startOffset);
  }

  function setCaret(offset: number): void {
    const pos = positionFromOffset(readText(), offset);
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStart(pos.node, pos.offset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* ── 可查询性：editor 版 canQuery（disabled/hidden/inert/fieldset 纪律同 input）── */
  function canQuery(): boolean {
    if (!isAvailableForFocus(editor)) return false;
    if (editor.closest('[aria-disabled="true"]')) return false;
    for (let parent = editor.parentElement; parent; parent = parent.parentElement) {
      if (parent.matches('fieldset[disabled]') && !parent.querySelector(':scope > legend')?.contains(editor)) return false;
    }
    return true;
  }

  /* ── 面板定位：selection caret rect（测试环境缺 Range 几何时回落 editor rect）── */
  function position(): void {
    if (!canQuery()) { close(); return; }
    panel.dir = getComputedStyle(editor).direction;
    let anchor: { left: number; top: number; right: number; bottom: number; width: number; height: number };
    const range = selectionRange();
    const caretRect = range?.getBoundingClientRect ? range.getBoundingClientRect() : null;
    const hasCaretGeometry = !!caretRect && (caretRect.width !== 0 || caretRect.height !== 0 || caretRect.left !== 0 || caretRect.top !== 0);
    if (caretRect && hasCaretGeometry) {
      anchor = {
        left: caretRect.left, top: caretRect.top,
        right: caretRect.right, bottom: caretRect.bottom,
        width: caretRect.width, height: caretRect.height || 20,
      };
    } else {
      const rect = editor.getBoundingClientRect();
      anchor = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: Math.min(rect.height || 24, 24) };
    }
    const layoutOpts: PopoverLayoutOptions = {
      side: 'bottom',
      align: 'start',
      contentHeightHint: panel.scrollHeight || entries.length * 36 + 48,
    };
    const layout = computePopoverLayout(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      sizingToLayout(resolvePanelSizing(el), layoutOpts),
    );
    panel.style.left = `${layout.left}px`;
    panel.style.top = `${layout.top}px`;
    panel.style.width = `${layout.width}px`;
    panel.style.maxHeight = `${layout.maxHeight}px`;
    panel.dataset.icenSide = layout.side;
  }

  function onWindowChange(): void {
    if (open) position();
  }
  function onDocPointerDown(e: Event): void {
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (panel.contains(target) || editor.contains(target)) return;
    close();
  }
  /** label[for=editorId] 点击聚焦编辑区（div 非 labelable 元素，原生 for 不生效，此处补焦） */
  const onLabelClick = (e: MouseEvent): void => {
    if (!editor.id) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const label = target.closest('label[for]');
    if (label && label.getAttribute('for') === editor.id) {
      e.preventDefault();
      editor.focus({ preventScroll: true });
    }
  };

  /* ── 开/关 ── */
  function setOpen(next: boolean): void {
    if (destroyed || open === next) return;
    open = next;
    panel.hidden = !next;
    editor.removeAttribute('aria-expanded'); // Multiline textbox does not support aria-expanded.
    if (next) {
      release = claimMenuFocus(close);
      window.addEventListener('resize', onWindowChange);
      window.addEventListener('scroll', onWindowChange, true);
      document.addEventListener('pointerdown', onDocPointerDown, true);
      position();
      syncActive(); /* 打开后重指 active（渲染时面板尚闭，activedescendant 需补挂） */
    } else {
      release?.(); release = null;
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      editor.removeAttribute('aria-activedescendant');
    }
  }

  function close(): void { query.cancel(); busy = false; failed = false; editor.removeAttribute('aria-busy'); setOpen(false); }

  function entryEnabled(entry: PanelEntry | undefined): entry is PanelEntry {
    return !!entry && (entry.kind === 'create' || !entry.item.disabled);
  }

  function firstEnabledIndex(): number {
    return entries.findIndex((entry) => entryEnabled(entry));
  }

  /** active 项视觉 + aria-activedescendant 同步（is-active 永不单独出现，复合在 option 上）。 */
  function syncActive(): void {
    Array.from(panel.querySelectorAll<HTMLElement>('.icen-mentions-option')).forEach((optEl, i) => {
      const active = i === activeIndex;
      optEl.classList.toggle('is-active', active);
      optEl.setAttribute('aria-selected', String(active));
    });
    const activeEntry = entries[activeIndex];
    if (open && !busy && entryEnabled(activeEntry)) {
      editor.setAttribute('aria-activedescendant', `${panelId}-opt-${activeIndex}`);
      const active = panel.querySelector<HTMLElement>('.icen-mentions-option.is-active');
      if (active) revealPopoverItem(active, panel);
    } else {
      editor.removeAttribute('aria-activedescendant');
    }
  }

  /** 追加 custom 模式的「创建 …」虚拟项：query 非空且候选没有完全同名时。 */
  function withCreateEntry(values: MentionItem<T>[]): PanelEntry[] {
    const next: PanelEntry[] = values.slice(0, max).map((item) => ({ kind: 'item', item }));
    if (mode === 'custom' && currentQuery.trim()) {
      const exact = values.some((item) => itemLabel(item) === currentQuery);
      if (!exact) next.push({ kind: 'create', query: currentQuery });
    }
    return next;
  }

  function renderItemOption(entry: PanelEntry & { kind: 'item' }, opt: HTMLElement): void {
    const { item } = entry;
    if (item.disabled) {
      opt.classList.add('is-disabled');
      opt.setAttribute('aria-disabled', 'true');
    }
    const label = document.createElement('span');
    label.className = 'icen-mentions-option-label';
    const text = document.createElement('bdi');
    text.textContent = itemLabel(item);
    label.append(text);
    if (opts.renderItem) { const rendered = opts.renderItem(item, currentQuery); if (typeof rendered === 'string') label.textContent = rendered; else label.replaceChildren(rendered); }
    opt.appendChild(label);
    /* mousedown preventDefault：保住编辑区焦点（click 仍触发选中） */
    opt.addEventListener('pointerdown', (e) => e.preventDefault());
    opt.addEventListener('mousedown', (e) => e.preventDefault());
    opt.addEventListener('click', () => {
      if (!item.disabled) select(item);
    });
  }

  function renderCreateOption(entry: PanelEntry & { kind: 'create' }, opt: HTMLElement): void {
    opt.classList.add('icen-mentions-option--create');
    const label = document.createElement('span');
    label.className = 'icen-mentions-option-label';
    const text = document.createElement('bdi');
    text.textContent = t('mentions.create', { p0: entry.query });
    label.append(text);
    const badge = document.createElement('span');
    badge.className = 'icen-mentions-option-badge';
    badge.textContent = t('mentions.customBadge');
    opt.append(label, badge);
    opt.addEventListener('pointerdown', (e) => e.preventDefault());
    opt.addEventListener('mousedown', (e) => e.preventDefault());
    opt.addEventListener('click', () => selectCreate(entry.query));
  }

  function renderItems(values: MentionItem<T>[]): void {
    panel.querySelectorAll('.icen-mentions-option').forEach((n) => n.remove());
    items = values;
    entries = withCreateEntry(values);
    entries.forEach((entry, i) => {
      const opt = document.createElement('div');
      opt.className = 'icen-mentions-option';
      opt.id = `${panelId}-opt-${i}`;
      opt.setAttribute('role', 'option');
      if (entry.kind === 'create') renderCreateOption(entry, opt);
      else renderItemOption(entry, opt);
      list.appendChild(opt);
    });
    activeIndex = firstEnabledIndex();
    syncActive();
  }

  function moveActive(dir: 1 | -1): void {
    if (entries.length === 0 || firstEnabledIndex() < 0) return;
    let idx = activeIndex < 0 ? (dir === 1 ? -1 : 0) : activeIndex;
    for (let n = 0; n < entries.length; n++) {
      idx = (idx + dir + entries.length) % entries.length;
      if (entryEnabled(entries[idx])) break;
    }
    activeIndex = idx;
    syncActive();
  }

  /* ── token 工厂与内容块读取 ── */
  function createTokenEl(entity: MentionEntity<T>): HTMLElement {
    const span = document.createElement('span');
    span.className = `icen-mention-token ${entity.kind === 'custom' ? 'is-custom' : 'is-directory'}`;
    span.setAttribute('contenteditable', 'false');
    span.dataset.icenMentionId = entity.id;
    span.dataset.icenMentionLabel = entity.label;
    const bdi = document.createElement('bdi');
    bdi.textContent = `${trigger}${entity.label}`;
    span.appendChild(bdi);
    if (entity.kind === 'custom') {
      const badge = document.createElement('span');
      badge.className = 'icen-mention-badge';
      badge.textContent = t('mentions.customBadge');
      span.appendChild(badge);
    }
    tokenData.set(span, entity);
    return span;
  }

  function getValue(): MentionValue<T>[] {
    const value: MentionValue<T>[] = [];
    let buffer = '';
    const flush = (): void => {
      if (buffer) { value.push({ type: 'text', text: buffer }); buffer = ''; }
    };
    for (const child of Array.from(editor.childNodes)) {
      if (isTokenEl(child)) {
        flush();
        const entity = tokenData.get(child);
        if (entity) {
          value.push(entity);
        } else {
          const label = child.dataset.icenMentionLabel ?? '';
          value.push({
            type: 'mention',
            id: child.dataset.icenMentionId ?? label,
            label,
            kind: child.classList.contains('is-custom') ? 'custom' : 'directory',
            item: { id: child.dataset.icenMentionId ?? label, label } as MentionItem<T>,
          });
        }
      } else if (child instanceof Text) {
        buffer += child.data;
      } else if (child instanceof HTMLBRElement) {
        buffer += '\n';
      } else if (child instanceof HTMLElement) {
        buffer += child.textContent ?? '';
      }
    }
    flush();
    return value;
  }

  function getMentions(): MentionEntity<T>[] {
    const out: MentionEntity<T>[] = [];
    for (const child of Array.from(editor.childNodes)) {
      if (isTokenEl(child)) {
        const entity = tokenData.get(child);
        if (entity) out.push(entity);
      }
    }
    return out;
  }

  /* ── 变化通知（只在原生 input 事件一个入口，防重复派发）── */
  function syncField(): void {
    if (hidden) hidden.value = currentText();
    editor.classList.toggle('is-empty', currentText().length === 0);
  }

  function emitChangeIfNeeded(): void {
    const text = currentText();
    if (text === lastText) return;
    lastText = text;
    const value = getValue();
    const mentions = getMentions();
    emitIcen(editor, 'icen:mention-change', { value, text, mentions });
    if (!destroyed) opts.onChange?.(value, text);
  }

  /** 程序化编辑后的统一收尾：派发原生 input（bubbles），由 onInput 完成通知与检测。 */
  function fireInput(): void {
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ── 原子编辑 ── */
  /** caret 处插入纯文本（Enter 换行 / paste 共用）。 */
  function insertTextAtCaret(text: string): void {
    const map = readText();
    const range = selectionRange();
    let startOffset = map.text.length;
    let useRange: Range;
    if (range) {
      startOffset = offsetOfPosition(range.startContainer, range.startOffset) ?? map.text.length;
      useRange = range;
    } else {
      useRange = document.createRange();
      useRange.selectNodeContents(editor);
      useRange.collapse(false);
    }
    useRange.deleteContents();
    useRange.insertNode(document.createTextNode(text));
    editor.normalize();
    setCaret(Math.min(startOffset + text.length, currentText().length));
  }

  /** 把 [start,end) 文本区间替换为 token + 尾随空格，caret 落到空格后。 */
  function insertMentionAt(entity: MentionEntity<T>, start: number, end: number): void {
    const map = readText();
    const token = createTokenEl(entity);
    const from = positionFromOffset(map, start);
    const to = positionFromOffset(map, end);
    const range = document.createRange();
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    range.deleteContents();
    range.insertNode(token);
    token.after(document.createTextNode(' '));
    editor.normalize();
    setCaret(start + tokenText(token, trigger).length + 1);
  }

  /** 整体删除一个 token：顺带合并双空格，caret 落到 token 原起点，派 change。 */
  function removeTokenAtomic(token: HTMLElement): void {
    const mark = readText().marks.find((m) => m.el === token);
    const caretOffset = mark ? mark.start : null;
    const prev = token.previousSibling;
    const next = token.nextSibling;
    token.remove();
    if (prev instanceof Text && next instanceof Text && prev.data.endsWith(' ') && next.data.startsWith(' ')) {
      next.deleteData(0, 1);
    }
    editor.normalize();
    const text = currentText();
    setCaret(Math.min(caretOffset ?? text.length, text.length));
    fireInput();
  }

  /** Backspace/Delete 贴着 token 边界时整体删除该 token；返回是否已处理。 */
  function deleteTokenByKey(key: 'Backspace' | 'Delete'): boolean {
    if (!selectionCollapsed()) return false; /* 有选区交给浏览器按原子块删除 */
    const caret = getCaretOffset();
    if (caret == null) return false;
    const mark = readText().marks.find((m) => (key === 'Backspace' ? m.end === caret : m.start === caret));
    if (!mark) return false;
    removeTokenAtomic(mark.el);
    return true;
  }

  /* ── 选中（select 模式候选 / custom 模式创建）── */
  function select(item: MentionItem<T>): void {
    if (!current || busy || destroyed || !canQuery() || !open) return;
    const caret = getCaretOffset();
    if (caret == null || !selectionCollapsed()) { onValueChanged(); return; }
    const match = triggerAt(readText(), caret);
    if (!match || match.start !== current.start || match.query !== currentQuery) { onValueChanged(); return; }
    const label = itemLabel(item);
    const entity: MentionEntity<T> = { type: 'mention', id: item.id, label, kind: 'directory', item };
    insertMentionAt(entity, match.start, caret);
    const firedQuery = currentQuery;
    current = null;
    close();
    editor.focus({ preventScroll: true });
    fireInput();
    if (destroyed) return;
    emitIcen(editor, 'icen:mention-select', { item: entity, query: firedQuery });
    if (!destroyed) opts.onSelect?.(entity);
  }

  function selectCreate(rawQuery: string): void {
    if (!current || busy || destroyed || !canQuery() || !open) return;
    const caret = getCaretOffset();
    if (caret == null || !selectionCollapsed()) { onValueChanged(); return; }
    const match = triggerAt(readText(), caret);
    if (!match || match.start !== current.start || match.query !== currentQuery) { onValueChanged(); return; }
    const queryText = rawQuery;
    let custom: MentionItem | null = null;
    try { custom = opts.createCustom ? normalizeItem(opts.createCustom(queryText)) : null; } catch { custom = null; }
    const item = (custom ?? { id: `custom:${queryText}`, label: queryText }) as MentionItem<T>;
    const label = itemLabel(item);
    const entity: MentionEntity<T> = { type: 'mention', id: item.id, label, kind: 'custom', item };
    insertMentionAt(entity, match.start, caret);
    const firedQuery = currentQuery;
    current = null;
    close();
    editor.focus({ preventScroll: true });
    fireInput();
    if (destroyed) return;
    emitIcen(editor, 'icen:mention-select', { item: entity, query: firedQuery });
    if (!destroyed) opts.onSelect?.(entity);
  }

  function schedule(value: string, delay = debounceMs): void {
    if (destroyed || !canQuery()) return;
    currentQuery = value; entries = []; activeIndex = -1; list.replaceChildren(); empty.hidden = true; editor.removeAttribute('aria-activedescendant'); query.run(value, delay);
  }
  function onValueChanged(delay = debounceMs): void {
    if (destroyed || composing || !canQuery()) { close(); return; }
    const caret = selectionCollapsed() ? getCaretOffset() : null;
    const match = caret != null ? triggerAt(readText(), caret) : null;
    current = match;
    if (!match || match.query.length < minChars) { close(); notice.show(null); return; }
    schedule(match.query, delay);
  }

  /* ── 事件接线 ── */
  const onInput = (): void => {
    if (composing || destroyed) return;
    if (lastComposition !== null) { const same = lastComposition === currentText(); lastComposition = null; if (same) return; }
    syncField();
    emitChangeIfNeeded();
    onValueChanged();
  };
  const onCompositionStart = (): void => {
    composing = true; lastComposition = null; close();
  };
  const onCompositionEnd = (): void => {
    composing = false;
    syncField();
    onValueChanged();
    lastComposition = currentText();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (destroyed || composing || e.isComposing || e.keyCode === 229 || !canQuery()) return;
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault(); e.stopPropagation();
        close(); /* Esc 关层不动文本 */
      }
      return;
    }
    if (open) {
      if (e.key === 'Tab' && !e.shiftKey && failed) { e.preventDefault(); panel.querySelector<HTMLButtonElement>('.icen-suggestion-retry')?.focus(); return; }
      if (e.key === 'Enter' && failed) { e.preventDefault(); onValueChanged(0); return; }
      if (busy) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (e.key === 'Enter') {
        /* IME 组合态期间 Enter 是确认候选词，绝不拦截 */
        if (composing || e.isComposing) return;
        const entry = entries[activeIndex];
        if (entryEnabled(entry)) {
          e.preventDefault();
          if (entry.kind === 'create') selectCreate(entry.query);
          else select(entry.item);
        }
        return;
      }
      return;
    }
    /* 弹层关闭态的编辑语义 */
    if (e.key === 'Enter') {
      e.preventDefault();
      insertTextAtCaret('\n');
      fireInput();
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      /* 原子删除：caret 贴着 token 边界时 preventDefault 并整体删除 token */
      if (deleteTokenByKey(e.key)) e.preventDefault();
    }
  };
  const onBlur = (event: FocusEvent): void => {
    if (event.relatedTarget instanceof Node && (panel.contains(event.relatedTarget) || event.relatedTarget === editor)) return;
    /* 失焦关层（点击选项走 mousedown preventDefault，不会先触发 blur） */
    close();
  };
  const onPaste = (e: ClipboardEvent): void => {
    if (destroyed || !canQuery()) return;
    e.preventDefault(); /* 只接受纯文本：HTML/富文本一律不进编辑区 */
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    insertTextAtCaret(text.replace(/\r\n?/g, '\n'));
    fireInput();
  };

  const events = new AbortController();
  const caretChanged = (): void => {
    if (composing || destroyed) return;
    const caret = selectionCollapsed() ? getCaretOffset() : null;
    const match = caret != null ? triggerAt(readText(), caret) : null;
    if (match?.start !== current?.start || match?.query !== current?.query) onValueChanged();
    else if (open) position();
  };
  editor.addEventListener('keyup', (event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) caretChanged(); }, { signal: events.signal });
  editor.addEventListener('click', caretChanged, { signal: events.signal });
  panel.addEventListener('focusout', onBlur, { signal: events.signal });
  panel.addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); const target = event.shiftKey ? editor : afterSuggestionField(editor, panel); target.focus({ preventScroll: true }); if (!event.shiftKey && target === editor) close(); return; } if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); close(); editor.focus({ preventScroll: true }); } }, { signal: events.signal });
  /* form reset：原生 reset 只重置表单内字段，编辑区是 contenteditable——恢复初始值（初始纯文本） */
  const formReset = (event: Event): void => {
    queueMicrotask(() => { if (!destroyed && !event.defaultPrevented) handle.setValue(initialValue); });
  };
  formEl?.addEventListener('reset', formReset, { signal: events.signal });
  const stopWatching = watchSuggestionField(editor, () => { if (!canQuery()) close(); else if (open) position(); });
  editor.addEventListener('input', onInput);
  editor.addEventListener('compositionstart', onCompositionStart);
  editor.addEventListener('compositionend', onCompositionEnd);
  editor.addEventListener('keydown', onKeyDown);
  editor.addEventListener('blur', onBlur);
  editor.addEventListener('paste', onPaste);
  /* label[for=editorId] 聚焦接线常驻（div 非 labelable 元素，原生 for 语义不生效） */
  document.addEventListener('click', onLabelClick, true);

  /* a11y 接线（editor 随 destroy 移除，无需还原） */
  editor.setAttribute('aria-haspopup', 'listbox');
  editor.removeAttribute('aria-expanded');
  editor.setAttribute('aria-controls', list.id);
  editor.setAttribute('aria-autocomplete', 'list');
  editor.removeAttribute('aria-activedescendant');
  editor.removeAttribute('aria-busy');
  syncField();
  lastText = currentText();

  function appendSetPart(part: string | MentionValue<T> | MentionItem<T>): void {
    if (typeof part === 'string') {
      if (part) editor.appendChild(document.createTextNode(part));
      return;
    }
    if (!part || typeof part !== 'object') return;
    if ('type' in part && part.type === 'text') {
      if (part.text) editor.appendChild(document.createTextNode(String(part.text)));
      return;
    }
    if ('type' in part && part.type === 'mention') {
      const entity = part as MentionEntity<T>;
      const item = entity.item ?? ({ id: entity.id, label: entity.label } as MentionItem<T>);
      editor.appendChild(createTokenEl({ type: 'mention', id: entity.id, label: entity.label, kind: entity.kind, item }));
      return;
    }
    /* 原始对象：有 string id 即渲染成原子提及（kind 可显式指定 custom） */
    const item = normalizeItem(part) as MentionItem<T> | null;
    if (item) {
      const kind = (part as { kind?: unknown }).kind === 'custom' ? 'custom' : 'directory';
      editor.appendChild(createTokenEl({ type: 'mention', id: item.id, label: itemLabel(item), kind, item }));
    }
  }

  const handle: MentionsHandle<T> = {
    getValue,
    getText: () => currentText(),
    getMentions,
    setValue(value) {
      if (destroyed) return;
      close();
      while (editor.firstChild) editor.removeChild(editor.firstChild);
      const parts = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
      for (const part of parts) appendSetPart(part);
      editor.normalize();
      syncField();
      lastText = currentText();
    },
    close() { if (!destroyed) close(); },
    destroy(): void {
      if (destroyed) return;
      close(); destroyed = true; query.destroy(); events.abort(); stopWatching();
      document.removeEventListener('click', onLabelClick, true);
      panel.remove();
      const text = currentText();
      ta.value = text;
      if (hidden) { ta.setAttribute('name', hidden.name); hidden.remove(); hidden = null; }
      if (originalId !== null) ta.setAttribute('id', originalId);
      if (originalPlaceholder !== null) ta.setAttribute('placeholder', originalPlaceholder);
      if (originalAriaDisabled !== null) ta.setAttribute('aria-disabled', originalAriaDisabled);
      editor.before(ta);
      editor.remove();
      if (mounted.get(editor) === handle) mounted.delete(editor);
      tokenData.clear();
    },
  };
  mounted.set(editor, handle);
  return handle;
}
