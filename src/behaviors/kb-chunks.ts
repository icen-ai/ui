/*
 * @icen.ai/ui — Behavior: kb-chunks（chunk 编辑器：行内编辑 / 启停 / 关键词 / 双通道搜索）
 * 与 components/kb-ingest.css 配套。
 *
 * DOM 契约（docs/spec/kb-family.md §5.6；数据契约 kb-core KbChunk）：
 *   <div class="kb-chunks">
 *     <div class="kb-chunks-bar">
 *       <div class="kb-seg kb-chunks-mode" role="radiogroup">         ← kb 域自持（不依赖 controls.ts）
 *         <button type="button" class="kb-seg-item [is-active]" role="radio"
 *                 aria-checked="…" data-value="text">全文</button>
 *         <button type="button" class="kb-seg-item" role="radio" data-value="vector">语义</button>
 *       </div>
 *       <input class="kb-input kb-chunks-search" type="search" placeholder="搜索 chunk…" data-kb-chunk-search>
 *       <button type="button" class="kb-btn kb-chunks-add" data-kb-chunk-add>+ 新增</button>
 *     </div>
 *     <div class="kb-chunk-list">
 *       <div class="kb-chunk [is-off] [is-edited]" data-chunk-id="…">
 *         <label class="kb-chunk-switch" title="available=false：不删除但排除出检索">
 *           <input type="checkbox" [checked] data-kb-chunk-toggle>
 *           <i class="kb-chunk-switch-track"><i class="kb-chunk-switch-thumb"></i></i>
 *           <span class="kb-chunk-switch-label">启用</span>
 *         </label>
 *         <div class="kb-chunk-main">
 *           <div class="kb-chunk-content" contenteditable="true" data-kb-chunk-content
 *                data-original="…原文…">…content…</div>
 *           <div class="kb-chunk-keywords" data-kb-chunk-keywords>
 *             <span class="kb-chip kb-chunk-keyword">tag
 *               <button type="button" class="kb-chunk-keyword-x" data-kb-chunk-keyword-remove aria-label="移除关键词">×</button>
 *             </span>…
 *             <input class="kb-chunk-keyword-input" placeholder="+ 关键词" data-kb-chunk-keyword-input>
 *           </div>
 *           <div class="kb-chunk-meta kb-meta">#3 · 第 2 页 · <span class="kb-chunk-edited-flag">已编辑</span></div>
 *         </div>
 *         <button type="button" class="kb-btn kb-chunk-remove" data-kb-chunk-remove>删除</button>
 *       </div>…
 *       [空态 .kb-empty]
 *     </div>
 *   </div>
 *
 * 行为：
 *   - renderKbChunks(el, chunks, opts?)：快照渲染，返回挂载容器 el（SSR 原样返回）。
 *     opts.documentId 供 add 事件（缺省取首个 chunk 的 documentId）；
 *     opts.searchMode / opts.query 设定搜索条初值；opts.placeholder 覆盖占位文案。
 *   - initKbChunks(root?)：幂等（scope.__icenKbChunksInit）+ 返回销毁函数，root 缺省 document 级委托：
 *     · available 开关（change）→ 行 is-off 类切换 + icen:kb-chunk-toggle { chunkId, available }
 *     · content 行内编辑（contenteditable，blur 且内容变化才提交）→ is-edited + meta 出「已编辑」
 *       + icen:kb-chunk-edit { chunkId }
 *     · 关键词 chips 自实现（不依赖 tag-input behavior）：chip × 删除 / 输入框 Enter 新增
 *       → 同样派 icen:kb-chunk-edit { chunkId }
 *     · 删除钮 → icen:kb-chunk-remove { chunkId }（只派事件不删行：删除是不可逆操作，由消费方确认后重渲染）
 *     · 新增钮 → icen:kb-chunk-add { documentId }
 *     · 搜索（输入 200ms 防抖）→ 全文模式本地过滤行（内容+关键词包含即命中）；语义模式不过滤
 *       （交给消费方语义召回后重渲染），两种模式都派 icen:kb-chunk-search { mode, query }
 *   - is-off 行整体降透明度（CSS）；渲染只写 textContent / createElement，SVG 过 svgIcon()。
 */

import {
  h,
  normalizeChunk,
  svgIcon,
  type KbChunk,
} from './kb-core';
import { emitIcen } from './events';

/* ── 域内小工具 ── */

const svg = (d: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON_PLUS = svg('<path d="M5 12h14"/><path d="M12 5v14"/>');

function icon(parent: HTMLElement, svgStr: string): void {
  const node = svgIcon(svgStr);
  if (node) parent.appendChild(node);
}

/** 搜索输入契约 */
export type KbChunkSearchMode = 'text' | 'vector';

/** renderKbChunks 选项 */
export interface KbChunksOpts {
  /** 新增 chunk 归属的文档（add 事件 detail）；缺省取首个 chunk 的 documentId */
  documentId?: string;
  /** 搜索条模式初值（缺省 'text' 全文） */
  searchMode?: KbChunkSearchMode;
  /** 搜索条初值（同时用于本地过滤） */
  query?: string;
  /** 搜索框占位文案 */
  placeholder?: string;
  /** 空态文案 */
  emptyText?: string;
}

const MODE_LABELS: Record<KbChunkSearchMode, string> = { text: '全文', vector: '语义' };

/* ── 构建 ── */

function buildSearchBar(opts: KbChunksOpts): HTMLElement {
  const bar = h('div', 'kb-chunks-bar');
  const mode = opts.searchMode === 'vector' ? 'vector' : 'text';
  const seg = h('div', 'kb-seg kb-chunks-mode');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', '搜索模式');
  (['text', 'vector'] as KbChunkSearchMode[]).forEach((m) => {
    const item = h('button', `kb-seg-item kb-chunks-mode-item${m === mode ? ' is-active' : ''}`);
    item.type = 'button';
    item.setAttribute('role', 'radio');
    item.setAttribute('aria-checked', String(m === mode));
    item.dataset.value = m;
    item.textContent = MODE_LABELS[m];
    seg.appendChild(item);
  });
  bar.appendChild(seg);

  const input = h('input', 'kb-input kb-chunks-search');
  input.type = 'search';
  input.placeholder = opts.placeholder ?? (mode === 'text' ? '全文搜索 chunk…' : '语义搜索 chunk…');
  input.value = opts.query ?? '';
  input.dataset.kbChunkSearch = '';
  input.setAttribute('aria-label', '搜索 chunk');
  bar.appendChild(input);

  const add = h('button', 'kb-btn kb-chunks-add');
  add.type = 'button';
  add.dataset.kbChunkAdd = '';
  icon(add, ICON_PLUS);
  add.appendChild(document.createTextNode('新增'));
  bar.appendChild(add);
  return bar;
}

function buildKeywordChip(word: string): HTMLElement {
  const chip = h('span', 'kb-chip kb-chunk-keyword');
  chip.appendChild(document.createTextNode(word));
  const x = h('button', 'kb-chunk-keyword-x');
  x.type = 'button';
  x.dataset.kbChunkKeywordRemove = '';
  x.setAttribute('aria-label', `移除关键词 ${word}`);
  x.textContent = '×';
  chip.appendChild(x);
  return chip;
}

function buildChunkRow(chunk: KbChunk, index: number): HTMLElement {
  const row = h('div', `kb-chunk${chunk.available ? '' : ' is-off'}${chunk.edited ? ' is-edited' : ''}`);
  row.dataset.chunkId = chunk.id;

  const sw = h('label', 'kb-chunk-switch');
  sw.title = '关闭后不删除，仅排除出检索';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = chunk.available;
  cb.dataset.kbChunkToggle = '';
  cb.setAttribute('aria-label', `chunk ${index + 1} 启用`);
  sw.appendChild(cb);
  sw.appendChild(h('i', 'kb-chunk-switch-track', '')).appendChild(h('i', 'kb-chunk-switch-thumb'));
  sw.appendChild(h('span', 'kb-chunk-switch-label', '启用'));
  row.appendChild(sw);

  const main = h('div', 'kb-chunk-main');
  const content = h('div', 'kb-chunk-content', chunk.content);
  content.contentEditable = 'true';
  content.dataset.kbChunkContent = '';
  content.dataset.original = chunk.content;
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-multiline', 'true');
  content.setAttribute('aria-label', `chunk ${index + 1} 内容`);
  main.appendChild(content);

  const kw = h('div', 'kb-chunk-keywords');
  kw.dataset.kbChunkKeywords = '';
  (chunk.keywords ?? []).forEach((word) => kw.appendChild(buildKeywordChip(word)));
  const kwInput = h('input', 'kb-chunk-keyword-input');
  kwInput.type = 'text';
  kwInput.placeholder = '+ 关键词';
  kwInput.dataset.kbChunkKeywordInput = '';
  kwInput.setAttribute('aria-label', `chunk ${index + 1} 新增关键词`);
  kw.appendChild(kwInput);
  main.appendChild(kw);

  const metaBits = [`#${index + 1}`];
  if (typeof chunk.page === 'number') metaBits.push(`第 ${chunk.page} 页`);
  if (chunk.edited) metaBits.push('已编辑');
  main.appendChild(h('div', 'kb-chunk-meta kb-meta', metaBits.join(' · ')));
  row.appendChild(main);

  const remove = h('button', 'kb-btn kb-chunk-remove');
  remove.type = 'button';
  remove.dataset.kbChunkRemove = '';
  remove.textContent = '删除';
  remove.setAttribute('aria-label', `删除 chunk ${index + 1}`);
  row.appendChild(remove);
  return row;
}

/* ── 渲染 ── */

/**
 * 渲染 chunk 编辑器（快照：整树重建后返回挂载容器 el）。
 * chunks 经 kb-core normalizeChunk 宽进严出；空数组给空态。SSR（无 document）下原样返回 el。
 */
export function renderKbChunks(
  el: HTMLElement,
  chunks: KbChunk[],
  opts?: KbChunksOpts,
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const o = opts ?? {};
  const list = (Array.isArray(chunks) ? chunks : []).map(
    (c) => normalizeChunk(c as unknown as Record<string, unknown>),
  );
  el.textContent = '';
  const root = h('div', 'kb-chunks');
  root.dataset.documentId = o.documentId ?? list[0]?.documentId ?? '';
  root.appendChild(buildSearchBar(o));
  const listBox = h('div', 'kb-chunk-list');
  if (!list.length) {
    listBox.appendChild(h('div', 'kb-empty', o.emptyText ?? '暂无 chunk'));
  } else {
    list.forEach((c, i) => listBox.appendChild(buildChunkRow(c, i)));
  }
  root.appendChild(listBox);
  el.appendChild(root);
  return el;
}

/* ── 交互 ── */

interface ChunksScope extends ParentNode {
  __icenKbChunksInit?: boolean;
}

/** 搜索防抖计时器（input 元素 → timer id；销毁不清除挂钟，到期派发无害） */
const searchTimers = new WeakMap<HTMLInputElement, ReturnType<typeof setTimeout>>();

/** 全文本地过滤：内容或任一关键词包含即命中（大小写不敏感） */
function filterRowsLocally(root: HTMLElement, query: string): void {
  const q = query.trim().toLowerCase();
  root.querySelectorAll<HTMLElement>('.kb-chunk[data-chunk-id]').forEach((row) => {
    if (!q) {
      row.style.removeProperty('display');
      return;
    }
    const content = row.querySelector<HTMLElement>('[data-kb-chunk-content]')?.textContent ?? '';
    const keywords = Array.from(row.querySelectorAll<HTMLElement>('.kb-chunk-keyword'))
      .map((k) => k.firstChild?.textContent ?? '')
      .join('\n');
    const hit = `${content}\n${keywords}`.toLowerCase().includes(q);
    row.style.display = hit ? '' : 'none';
  });
}

/** 当前搜索模式（从 segmented 激活项读，缺省 text） */
function currentSearchMode(root: HTMLElement): KbChunkSearchMode {
  const active = root.querySelector<HTMLElement>('.kb-chunks-mode-item.is-active');
  return active?.dataset.value === 'vector' ? 'vector' : 'text';
}

/** meta 行追加「已编辑」标记（幂等：已存在则跳过） */
function markEdited(row: HTMLElement): void {
  row.classList.add('is-edited');
  const meta = row.querySelector<HTMLElement>('.kb-chunk-meta');
  if (meta && !meta.querySelector('.kb-chunk-edited-flag')) {
    meta.appendChild(document.createTextNode(' · '));
    meta.appendChild(h('span', 'kb-chunk-edited-flag', '已编辑'));
  }
}

/** chunk 行内变更统一出口：标记 + 派 icen:kb-chunk-edit */
function emitEdit(row: HTMLElement): void {
  markEdited(row);
  emitIcen(row, 'icen:kb-chunk-edit', { chunkId: row.dataset.chunkId ?? '' });
}

/**
 * 接线 chunk 行内编辑 / 启停 / 关键词 / 增删 / 搜索（scope 级事件委托，重复调用幂等）。
 * root 缺省 document：页面一次 init 即接管后续插入的 chunk 列表。
 * 返回销毁函数：摘除全部委托并复位幂等标记，销毁后可重新 initKbChunks。SSR 下 no-op。
 */
export function initKbChunks(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as ChunksScope;
  if (marked.__icenKbChunksInit) return () => undefined;
  marked.__icenKbChunksInit = true;
  const target = scope as ParentNode & EventTarget;

  const chunkRootOf = (node: HTMLElement): HTMLElement | null =>
    node.closest<HTMLElement>('.kb-chunks');
  const rowOf = (node: HTMLElement): HTMLElement | null =>
    node.closest<HTMLElement>('.kb-chunk[data-chunk-id]');

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const el = t instanceof HTMLElement ? t : null;
    if (!el) return;

    /* 新增 */
    const addBtn = el.closest<HTMLElement>('[data-kb-chunk-add]');
    if (addBtn) {
      const wrap = chunkRootOf(addBtn);
      emitIcen(addBtn, 'icen:kb-chunk-add', { documentId: wrap?.dataset.documentId ?? '' });
      return;
    }
    /* 删除（只派事件：不可逆操作交消费方确认后重渲染） */
    const rmBtn = el.closest<HTMLElement>('[data-kb-chunk-remove]');
    if (rmBtn) {
      const row = rowOf(rmBtn);
      if (row) emitIcen(row, 'icen:kb-chunk-remove', { chunkId: row.dataset.chunkId ?? '' });
      return;
    }
    /* 关键词 chip 删除 */
    const kwX = el.closest<HTMLElement>('[data-kb-chunk-keyword-remove]');
    if (kwX) {
      const row = rowOf(kwX);
      const chip = kwX.closest<HTMLElement>('.kb-chunk-keyword');
      if (chip) chip.remove();
      if (row) emitEdit(row);
      return;
    }
    /* 搜索模式切换（kb 域自持 segmented：互斥 + aria 同步 + 重新过滤/派发） */
    const modeItem = el.closest<HTMLElement>('.kb-chunks-mode-item');
    if (modeItem) {
      const seg = modeItem.closest<HTMLElement>('.kb-chunks-mode');
      if (!seg || modeItem.classList.contains('is-active')) return;
      seg.querySelectorAll<HTMLElement>('.kb-chunks-mode-item').forEach((it) => {
        const on = it === modeItem;
        it.classList.toggle('is-active', on);
        it.setAttribute('aria-checked', String(on));
      });
      const wrap = chunkRootOf(modeItem);
      const search = wrap?.querySelector<HTMLInputElement>('[data-kb-chunk-search]') ?? null;
      const mode = currentSearchMode(wrap ?? seg);
      if (search) search.placeholder = mode === 'text' ? '全文搜索 chunk…' : '语义搜索 chunk…';
      if (wrap) {
        if (mode === 'text') filterRowsLocally(wrap, search?.value ?? '');
        else wrap.querySelectorAll<HTMLElement>('.kb-chunk[data-chunk-id]').forEach((r) => r.style.removeProperty('display'));
        emitIcen(wrap, 'icen:kb-chunk-search', { mode, query: search?.value ?? '' });
      }
    }
  };

  const onChange = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    /* available 开关 */
    if (t.hasAttribute('data-kb-chunk-toggle')) {
      const row = rowOf(t);
      if (!row) return;
      row.classList.toggle('is-off', !t.checked);
      emitIcen(row, 'icen:kb-chunk-toggle', { chunkId: row.dataset.chunkId ?? '', available: t.checked });
    }
  };

  const onKeydown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter') return;
    const t = ke.target;
    if (!(t instanceof HTMLInputElement)) return;
    /* 关键词新增（Enter 提交；空值忽略） */
    if (t.hasAttribute('data-kb-chunk-keyword-input')) {
      ke.preventDefault();
      const word = t.value.trim();
      const row = rowOf(t);
      if (!word || !row) return;
      const kw = t.closest<HTMLElement>('[data-kb-chunk-keywords]');
      if (kw) kw.insertBefore(buildKeywordChip(word), t);
      t.value = '';
      emitEdit(row);
    }
  };

  /* contenteditable blur 提交（focusout 冒泡；内容未变不派发） */
  const onFocusOut = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.hasAttribute('data-kb-chunk-content')) return;
    const row = rowOf(t);
    if (!row) return;
    const next = t.textContent ?? '';
    if (next === (t.dataset.original ?? '')) return;
    t.dataset.original = next;
    emitEdit(row);
  };

  /* 搜索输入（200ms 防抖：本地过滤 + 事件双通道） */
  const onInput = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.hasAttribute('data-kb-chunk-search')) return;
    const wrap = chunkRootOf(t);
    if (!wrap) return;
    const prev = searchTimers.get(t);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      searchTimers.delete(t);
      const mode = currentSearchMode(wrap);
      if (mode === 'text') filterRowsLocally(wrap, t.value);
      emitIcen(wrap, 'icen:kb-chunk-search', { mode, query: t.value });
    }, 200);
    searchTimers.set(t, timer);
  };

  target.addEventListener('click', onClick);
  target.addEventListener('change', onChange);
  target.addEventListener('keydown', onKeydown);
  target.addEventListener('focusout', onFocusOut);
  target.addEventListener('input', onInput);
  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('change', onChange);
    target.removeEventListener('keydown', onKeydown);
    target.removeEventListener('focusout', onFocusOut);
    target.removeEventListener('input', onInput);
    marked.__icenKbChunksInit = false;
  };
}
