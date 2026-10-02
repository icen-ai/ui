/*
 * @icen.ai/ui — Behavior: ai-tool（AI 工具调用卡 + 子智能体卡，与 components/ai-tool.css 配套）
 *
 * DOM 契约（类名固定，规格 §4.4 / §4.5）：
 *   工具调用卡：
 *   <div class="ai-tool ai-tool--shell is-done" data-ai-id="…" data-ai-kind="shell">
 *     <button class="ai-tool-head" type="button" aria-expanded="false">
 *       <span class="ai-item-icon" aria-hidden="true">…svg…</span>
 *       <span class="ai-item-main">
 *         <span class="ai-item-title">Read</span>
 *         <span class="ai-item-sub">src/foo.ts:1-50</span>
 *       </span>
 *       <span class="ai-item-status" role="img" aria-label="完成"></span>
 *       <span class="ai-item-meta">0.4s</span>
 *     </button>
 *     <div class="ai-tool-body" hidden>
 *       <div class="ai-tool-io"><div class="ai-tool-io-label">输入</div><pre class="ai-tool-io-content">…</pre></div>
 *       <div class="ai-tool-io"><div class="ai-tool-io-label">输出</div><pre class="ai-tool-io-content">…</pre></div>
 *       <div class="ai-tool-approval">            ← 仅 .is-approval 时显示（纯 CSS 驱动）
 *         <div class="ai-tool-approval-reason" hidden>审批原因</div>  ← 可选，model.approval.reason
 *         <button class="btn btn-sm btn-primary" data-ai-approve type="button">允许</button>
 *         <button class="btn btn-sm" data-ai-reject type="button">拒绝</button>
 *       </div>
 *     </div>
 *   </div>
 *
 *   子智能体卡：
 *   <div class="ai-subagent is-running" data-ai-id="…" data-ai-kind="subagent">
 *     <button class="ai-subagent-head" type="button" aria-expanded="false">…head 结构同上…</button>
 *     <div class="ai-subagent-body" hidden>
 *       <div class="ai-subagent-stream">          ← 嵌套 .ai-tool / .ai-subagent（行间 --ai-activity-index 驱动 stagger）
 *         …
 *       </div>
 *       <div class="ai-subagent-result">完成回执摘要</div>
 *     </div>
 *   </div>
 *
 * 状态机 7 态（.is-pending/.is-running/.is-streaming/.is-approval/.is-done/.is-error/.is-cancelled）：
 * 视觉全由 CSS 消费；JS 只负责切类 + aria 等价（aria-expanded / hidden / status aria-label）。
 * .is-error 条目首次渲染自动展开（Copilot 模式）。
 *
 * 事件（全部 bubbles，规格 §5）：
 *   icen:ai-toggle  { el, open }          — head 展开/折叠
 *   icen:ai-approve { id, kind }          — data-ai-approve 点击（工具审批）
 *   icen:ai-reject  { id, kind }          — data-ai-reject 点击
 *
 * initAiTool / initAiSubagent：每卡片一个监听（accordion 同款 per-container 委托），
 * 幂等（__icenAiToolInit / __icenAiSubagentInit 标记）；动态新增卡片后重跑 init 即可接管。
 * SSR 下为 no-op；文本一律 textContent（禁 innerHTML，SVG 走 ai-core 的 svgIcon() 消毒解析）。
 */

import {
  aiStatusLabel,
  formatDuration,
  getAiKind,
  normalizeContentParts,
  svgIcon,
  type AiStatus,
  type AiToolCallModel,
} from './ai-core';
import { renderAiContentPart } from './ai-chat';

/* ── 状态机（规格 §1，唯一语言） ── */
const AI_STATUSES: readonly AiStatus[] = [
  'pending',
  'running',
  'streaming',
  'approval',
  'done',
  'error',
  'cancelled',
];

interface MarkedElement extends HTMLElement {
  __icenAiToolInit?: boolean;
  __icenAiSubagentInit?: boolean;
}

export interface AiToolCallHandle {
  el: HTMLElement;
  update(patch: Partial<AiToolCallModel>): void;
}

export interface AiSubagentHandle {
  el: HTMLElement;
  update(patch: Partial<AiToolCallModel>): void;
}

/* ── DOM 小工具（DOM API，禁 innerHTML） ── */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function setStatusClass(item: HTMLElement, status: AiStatus): void {
  for (const s of AI_STATUSES) item.classList.toggle(`is-${s}`, s === status);
}

/* 值 → 文本（textContent 安全路径） */
function prettyValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return String(value);
  }
}

function compactValue(value: unknown, max = 160): string {
  if (value == null) return '';
  let text: string;
  if (typeof value === 'string') {
    text = value.replace(/\s+/g, ' ').trim();
  } else {
    try {
      text = JSON.stringify(value) ?? '';
    } catch {
      text = String(value);
    }
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/* 摘要行：kind 注册表的 summarize 优先，否则 input 的压缩 JSON */
function summarizeInput(model: AiToolCallModel): string {
  const kind = getAiKind(model.kind);
  if (typeof kind.summarize === 'function') {
    try {
      const text = kind.summarize(model.input);
      if (text) return text;
    } catch {
      /* 注册表 summarize 抛错时落到默认压缩 */
    }
  }
  return compactValue(model.input);
}

/* ── head / body 骨架（.ai-item-* 零件的组装） ── */
interface HeadParts {
  head: HTMLButtonElement;
  iconEl: HTMLSpanElement;
  titleEl: HTMLSpanElement;
  subEl: HTMLSpanElement;
  statusEl: HTMLSpanElement;
  metaEl: HTMLSpanElement;
}

function buildHead(headClass: string): HeadParts {
  const head = h('button', headClass);
  head.type = 'button';
  head.setAttribute('aria-expanded', 'false');

  const iconEl = h('span', 'ai-item-icon');
  iconEl.setAttribute('aria-hidden', 'true');
  const main = h('span', 'ai-item-main');
  const titleEl = h('span', 'ai-item-title');
  const subEl = h('span', 'ai-item-sub');
  const statusEl = h('span', 'ai-item-status');
  statusEl.setAttribute('role', 'img');
  const metaEl = h('span', 'ai-item-meta');

  main.append(titleEl, subEl);
  head.append(iconEl, main, statusEl, metaEl);
  return { head, iconEl, titleEl, subEl, statusEl, metaEl };
}

interface IoParts {
  root: HTMLDivElement;
  pre: HTMLPreElement;
  /** 多模态回执容器（MCP content 数组 → 媒体/链接，spec §10.3） */
  media: HTMLDivElement;
}

function buildIo(label: string): IoParts {
  const root = h('div', 'ai-tool-io');
  root.append(h('div', 'ai-tool-io-label', label));
  const pre = h('pre', 'ai-tool-io-content');
  const media = h('div', 'ai-tool-io-media');
  media.hidden = true;
  root.append(pre, media);
  return { root, pre, media };
}

function setIo(io: IoParts, value: unknown): void {
  /* MCP / 业界 wire 的 content 数组（或显式 AiContentPart[]）→ 多模态回执渲染 */
  const parts = Array.isArray(value) ? normalizeContentParts(value) : [];
  if (parts.length > 0) {
    io.pre.textContent = '';
    io.pre.hidden = true;
    io.media.replaceChildren();
    for (const part of parts) {
      const node = renderAiContentPart(part);
      if (node) io.media.appendChild(node);
    }
    io.media.hidden = io.media.childElementCount === 0;
    io.root.hidden = io.media.hidden;
    return;
  }
  io.media.replaceChildren();
  io.media.hidden = true;
  const text = prettyValue(value).trim();
  io.pre.textContent = text;
  io.pre.hidden = false;
  io.root.hidden = !text;
}

function buildApproval(): { root: HTMLDivElement; reason: HTMLDivElement } {
  const root = h('div', 'ai-tool-approval');
  const reason = h('div', 'ai-tool-approval-reason');
  reason.hidden = true;
  const allow = h('button', 'btn btn-sm btn-primary', '允许');
  allow.type = 'button';
  allow.setAttribute('data-ai-approve', '');
  const deny = h('button', 'btn btn-sm', '拒绝');
  deny.type = 'button';
  deny.setAttribute('data-ai-reject', '');
  root.append(reason, allow, deny);
  return { root, reason };
}

/* 注册表 tint → 内联局部变量（第三方 registerAiKind 的 tint 生效；内置 kind 由 CSS 修饰类兜底同值） */
function applyTint(item: HTMLElement, model: AiToolCallModel): void {
  const tint = getAiKind(model.kind).tint;
  if (tint) item.style.setProperty('--ai-item-tint', `var(--token-${tint})`);
  else item.style.removeProperty('--ai-item-tint');
}

function applyKindVisual(parts: HeadParts, model: AiToolCallModel): void {
  const kind = getAiKind(model.kind);
  parts.titleEl.textContent = kind.label || model.name;
  parts.iconEl.replaceChildren();
  const svg = svgIcon(kind.icon);
  if (svg) parts.iconEl.append(svg);
  const sub = summarizeInput(model);
  parts.subEl.textContent = sub;
  parts.subEl.hidden = !sub;
}

function applyStatusMeta(parts: HeadParts, status: AiStatus, meta: string): void {
  parts.statusEl.setAttribute('aria-label', aiStatusLabel(status));
  parts.metaEl.textContent = meta;
  parts.metaEl.hidden = !meta;
}

/* ══════════════════════════════════════════════════════════════
   renderAiToolCall — DOM API 构建整卡（流式场景），返回 { el, update }
   ══════════════════════════════════════════════════════════════ */
export function renderAiToolCall(el: HTMLElement, model: AiToolCallModel): AiToolCallHandle {
  if (typeof document === 'undefined') {
    return { el: el, update: () => undefined };
  }

  const item = el as MarkedElement;
  let current: AiToolCallModel = model;

  item.className = `ai-tool ai-tool--${model.kind}`;
  item.dataset.aiId = model.id;
  item.dataset.aiKind = model.kind;

  const parts = buildHead('ai-tool-head');
  const body = h('div', 'ai-tool-body');
  body.hidden = true;
  const inputIo = buildIo('输入');
  const outputIo = buildIo('输出');
  const approval = buildApproval();
  body.append(inputIo.root, outputIo.root, approval.root);
  item.append(parts.head, body);

  const setOpen = (open: boolean, fire = true): void => {
    parts.head.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    if (fire) {
      item.dispatchEvent(
        new CustomEvent('icen:ai-toggle', { detail: { el: item, open }, bubbles: true }),
      );
    }
  };

  let prevStatus: AiStatus | null = null;
  const apply = (m: AiToolCallModel): void => {
    setStatusClass(item, m.status);
    applyTint(item, m);
    applyKindVisual(parts, m);
    const meta = m.durationMs != null ? formatDuration(m.durationMs) : '';
    applyStatusMeta(parts, m.status, meta);
    setIo(inputIo, m.input);
    setIo(outputIo, m.errorText ?? m.output);
    const reason = m.approval?.reason ? compactValue(m.approval.reason, 300) : '';
    approval.reason.textContent = reason;
    approval.reason.hidden = !reason;
    if (m.status === 'error' && prevStatus !== 'error') setOpen(true); // 失败首次渲染自动展开
    prevStatus = m.status;
  };

  apply(current);

  return {
    el: item,
    update(patch: Partial<AiToolCallModel>): void {
      current = { ...current, ...patch };
      apply(current);
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   renderAiSubagent — 子智能体卡；activities 递归复用 renderAiToolCall
   ══════════════════════════════════════════════════════════════ */
export function renderAiSubagent(el: HTMLElement, model: AiToolCallModel): AiSubagentHandle {
  if (typeof document === 'undefined') {
    return { el: el, update: () => undefined };
  }

  const item = el as MarkedElement;
  let current: AiToolCallModel = model;

  item.className = 'ai-subagent';
  item.dataset.aiId = model.id;
  item.dataset.aiKind = model.kind;

  const parts = buildHead('ai-subagent-head');
  const body = h('div', 'ai-subagent-body');
  body.hidden = true;
  const stream = h('div', 'ai-subagent-stream');
  const result = h('div', 'ai-subagent-result');
  result.hidden = true;
  body.append(stream, result);
  item.append(parts.head, body);

  const setOpen = (open: boolean, fire = true): void => {
    parts.head.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    if (fire) {
      item.dispatchEvent(
        new CustomEvent('icen:ai-toggle', { detail: { el: item, open }, bubbles: true }),
      );
    }
  };

  /* 活动流：按 id 持有句柄——已存在的 update，新增的 append（附 --ai-activity-index 驱动 stagger 渐入），消失的移除 */
  const activityHandles = new Map<string, AiToolCallHandle | AiSubagentHandle>();

  const renderActivities = (activities: AiToolCallModel[] | undefined): void => {
    const list = activities ?? [];
    const seen = new Set<string>();
    list.forEach((act, index) => {
      seen.add(act.id);
      const existing = activityHandles.get(act.id);
      if (existing) {
        existing.update(act);
      } else {
        const host = document.createElement('div');
        const handle =
          act.kind === 'subagent' ? renderAiSubagent(host, act) : renderAiToolCall(host, act);
        handle.el.style.setProperty('--ai-activity-index', String(index));
        activityHandles.set(act.id, handle);
        stream.append(handle.el);
      }
    });
    for (const [id, handle] of activityHandles) {
      if (!seen.has(id)) {
        handle.el.remove();
        activityHandles.delete(id);
      }
    }
  };

  let prevStatus: AiStatus | null = null;
  const apply = (m: AiToolCallModel): void => {
    setStatusClass(item, m.status);
    applyTint(item, m);
    applyKindVisual(parts, m);
    const steps = m.activities?.length ?? 0;
    const meta = [m.durationMs != null ? formatDuration(m.durationMs) : '', steps > 0 ? `${steps} 步` : '']
      .filter(Boolean)
      .join(' · ');
    applyStatusMeta(parts, m.status, meta);
    renderActivities(m.activities);
    const receipt = compactValue(m.output);
    result.textContent = receipt;
    result.hidden = !receipt;
    if (m.status === 'error' && prevStatus !== 'error') setOpen(true); // 失败首次渲染自动展开
    prevStatus = m.status;
  };

  apply(current);

  return {
    el: item,
    update(patch: Partial<AiToolCallModel>): void {
      current = { ...current, ...patch };
      apply(current);
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   initAiTool / initAiSubagent — 委托展开/折叠 + 审批按钮（幂等，SSR no-op）
   ══════════════════════════════════════════════════════════════ */

function setupItem(
  item: HTMLElement,
  kind: 'tool' | 'subagent',
): void {
  const marked = item as MarkedElement;
  const flag = kind === 'tool' ? '__icenAiToolInit' : '__icenAiSubagentInit';
  if (marked[flag]) return;
  marked[flag] = true;

  const headClass = kind === 'tool' ? '.ai-tool-head' : '.ai-subagent-head';
  const bodyClass = kind === 'tool' ? '.ai-tool-body' : '.ai-subagent-body';
  const head = item.querySelector<HTMLElement>(`:scope > ${headClass}`);
  const body = item.querySelector<HTMLElement>(`:scope > ${bodyClass}`);

  const setOpen = (open: boolean, fire = true): void => {
    head?.setAttribute('aria-expanded', String(open));
    if (body) body.hidden = !open;
    if (fire) {
      item.dispatchEvent(
        new CustomEvent('icen:ai-toggle', { detail: { el: item, open }, bubbles: true }),
      );
    }
  };

  item.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;

    /* 审批按钮（嵌套卡片的事件由各自 listener 处理：closest 必须命中本卡片） */
    const ownerOf = (node: Element): Element | null => node.closest('.ai-tool, .ai-subagent');
    const approveBtn = target.closest('[data-ai-approve]');
    if (approveBtn && ownerOf(approveBtn) === item) {
      item.dispatchEvent(
        new CustomEvent('icen:ai-approve', {
          detail: { id: item.dataset.aiId ?? '', kind: item.dataset.aiKind ?? '' },
          bubbles: true,
        }),
      );
      return;
    }
    const rejectBtn = target.closest('[data-ai-reject]');
    if (rejectBtn && ownerOf(rejectBtn) === item) {
      item.dispatchEvent(
        new CustomEvent('icen:ai-reject', {
          detail: { id: item.dataset.aiId ?? '', kind: item.dataset.aiKind ?? '' },
          bubbles: true,
        }),
      );
      return;
    }

    /* head 展开/折叠（键盘走原生 button 的 Enter/Space → click） */
    const headEl = target.closest('.ai-tool-head, .ai-subagent-head');
    if (!headEl || ownerOf(headEl) !== item || !head) return;
    setOpen(head.getAttribute('aria-expanded') !== 'true');
  });

  /* 失败条目首次渲染自动展开（aria-expanded + hidden 同步） */
  if (item.classList.contains('is-error') && body?.hidden) setOpen(true);
}

function initItems(
  root: ParentNode | undefined,
  selector: '.ai-tool' | '.ai-subagent',
  kind: 'tool' | 'subagent',
): void {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;
  const items: HTMLElement[] = [];
  if (scope instanceof Element && scope.matches(selector)) items.push(scope as HTMLElement);
  items.push(...Array.from(scope.querySelectorAll<HTMLElement>(selector)));
  for (const item of items) setupItem(item, kind);
}

/** 初始化 root 下所有工具调用卡（root 自身是 .ai-tool 也算）。重复调用幂等。 */
export function initAiTool(root?: ParentNode): void {
  initItems(root, '.ai-tool', 'tool');
}

/** 初始化 root 下所有子智能体卡（含嵌套；root 自身是 .ai-subagent 也算）。重复调用幂等。 */
export function initAiSubagent(root?: ParentNode): void {
  initItems(root, '.ai-subagent', 'subagent');
}
