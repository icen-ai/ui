/*
 * @icen.ai/ui — Behavior: kb-chain（Agent 工具链条横向摘要条，与 components/kb-agent.css 配套）
 *
 * DOM 契约（renderKbChain 构建，规格 docs/spec/kb-family.md §5.26）：
 *   <div class="kb-chain">
 *     <span class="kb-chain-step is-done" role="button" tabindex="0" aria-disabled="false"
 *           data-index="0" title="3 页 / 2 表（detail 存在时）">
 *       <i class="kb-chain-dot" aria-hidden="true"></i>
 *       <span class="kb-chain-label">检索</span>
 *     </span>
 *     <i class="kb-chain-link" aria-hidden="true"></i>
 *     <span class="kb-chain-step is-running" …>重排</span>…
 *   </div>
 *
 * 状态机（工作台域纪律：运动感来自动效不来自颜色，色只标语义）：
 *   is-pending  空心灰点（未到达）
 *   is-running  accent 实心 + kb-pulse 脉冲（进行中）
 *   is-done     success 实心（已完成）
 *   is-error    danger 实心（失败）
 *
 * 可点击规则：running（或 error）及其之前的步骤可点击（aria-disabled="false"），
 * 其后未开始的步骤置灰不可点；点击 → icen:kb-chain-step {index, step}。
 *
 * 流式友好：renderKbChain 幂等 —— 同一 el 重复调用只按 index 更新已存在节点的
 * 状态类 / label 文本 / title / 可点性（WeakMap 同步更新步骤数据），长度变化才增删节点，
 * 不整树重建（避免闪烁）。SSR 安全（无 document 时 render 原样返回、init 返回 no-op）。
 */

import { h } from './kb-core';
import type { KbChainStep } from './kb-core';
import { emitIcen } from './events';

type ChainStatus = KbChainStep['status'];

const CHAIN_STATUSES: readonly ChainStatus[] = ['pending', 'running', 'done', 'error'];

function normStatus(v: unknown): ChainStatus {
  return CHAIN_STATUSES.includes(v as ChainStatus) ? (v as ChainStatus) : 'pending';
}

/** render 与 init 的共享数据通道：步骤元素 → 最近一次渲染的步骤对象（rerender 原位刷新） */
const chainStepData = new WeakMap<HTMLElement, KbChainStep>();

/** 可点击边界：第一个 running/error 步骤的下标；无进行中/失败步骤时返回 -1（全部已完成/待开始） */
function frontierIndex(steps: KbChainStep[]): number {
  return steps.findIndex((s) => s.status === 'running' || s.status === 'error');
}

/** 原位更新一个步骤节点（不重建，保住 CSS 过渡与焦点）；结构不符返回 false 由调用方整段重建 */
function applyStep(node: HTMLElement, step: KbChainStep, index: number, clickable: boolean): boolean {
  const label = node.querySelector('.kb-chain-label');
  const dot = node.querySelector('.kb-chain-dot');
  if (!(label instanceof HTMLElement) || !(dot instanceof HTMLElement)) return false;
  node.className = `kb-chain-step is-${step.status}`;
  node.dataset.index = String(index);
  label.textContent = step.label;
  if (step.detail) node.title = step.detail;
  else node.removeAttribute('title');
  node.setAttribute('role', 'button');
  node.setAttribute('aria-disabled', clickable ? 'false' : 'true');
  node.tabIndex = clickable ? 0 : -1;
  chainStepData.set(node, step);
  return true;
}

function buildStep(step: KbChainStep, index: number, clickable: boolean): HTMLElement {
  const node = h('span', `kb-chain-step is-${step.status}`);
  const dot = h('i', 'kb-chain-dot');
  dot.setAttribute('aria-hidden', 'true');
  node.appendChild(dot);
  node.appendChild(h('span', 'kb-chain-label', step.label));
  applyStep(node, step, index, clickable);
  return node;
}

/**
 * 渲染工具链条横向摘要条（与 ai-tool-call 单卡互补的「一屏看完整个链」视角）。
 * 幂等：重复调用只更新状态类与 detail，不重建 DOM（流式安全）；返回挂载元素 el。
 */
export function renderKbChain(el: HTMLElement, steps: KbChainStep[]): HTMLElement {
  if (typeof document === 'undefined') return el; /* SSR：原样返回挂载元素（render* SSR 分支口径） */
  const list = Array.isArray(steps)
    ? steps.map((s) => ({ ...s, status: normStatus(s?.status) }))
    : [];

  let root = el.querySelector(':scope > .kb-chain');
  if (!(root instanceof HTMLElement)) {
    el.textContent = '';
    root = h('div', 'kb-chain');
    el.appendChild(root);
  }

  const n = list.length;
  const frontier = frontierIndex(list);
  const clickable = (i: number): boolean => (frontier === -1 ? list[i]!.status !== 'pending' : i <= frontier);

  /* 期望子节点序列：step, link, step, …（长度 2n-1）；结构或长度不符才整段重建 */
  const kids = Array.from(root.children) as HTMLElement[];
  const expect = n > 0 ? 2 * n - 1 : 0;
  let reusable = kids.length === expect;
  if (reusable) {
    for (let i = 0; i < n && reusable; i++) {
      if (!kids[2 * i]!.classList.contains('kb-chain-step')) reusable = false;
      const link = kids[2 * i + 1];
      if (link && !link.classList.contains('kb-chain-link')) reusable = false;
    }
  }

  if (!reusable) {
    root.textContent = '';
    for (let i = 0; i < n; i++) {
      root.appendChild(buildStep(list[i]!, i, clickable(i)));
      if (i < n - 1) root.appendChild(h('i', 'kb-chain-link'));
    }
    return el;
  }

  for (let i = 0; i < n; i++) {
    const node = kids[2 * i]!;
    if (!applyStep(node, list[i]!, i, clickable(i))) {
      const fresh = buildStep(list[i]!, i, clickable(i));
      root.replaceChild(fresh, node);
    }
  }
  return el;
}

interface MarkedChainScope extends ParentNode {
  __icenKbChainInit?: boolean;
}

const noopDestroy = (): void => undefined;

/**
 * 委托初始化：点击可点步骤 → icen:kb-chain-step {index, step}（自 el 冒泡，onIcen 可收）。
 * 幂等（重复调用安全）；返回销毁函数（移除监听并复位标记，可重新 init）。SSR 下 no-op。
 */
export function initKbChain(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return noopDestroy;
  const scope = root ?? document;
  const marked = scope as MarkedChainScope;
  if (marked.__icenKbChainInit) return noopDestroy;
  marked.__icenKbChainInit = true;

  const activate = (stepEl: HTMLElement): void => {
    if (stepEl.getAttribute('aria-disabled') === 'true') return;
    const index = Number(stepEl.dataset.index);
    const step = chainStepData.get(stepEl);
    if (!Number.isFinite(index) || !step) return;
    emitIcen(stepEl, 'icen:kb-chain-step', { index, step });
  };

  const target = scope as ParentNode & EventTarget;
  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    const stepEl = t?.closest<HTMLElement>('.kb-chain-step');
    if (stepEl) activate(stepEl);
  };
  const onKeydown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const t = ke.target instanceof Element ? ke.target : null;
    if (!t || t.closest('button, a, input, textarea, select')) return;
    const stepEl = t.closest<HTMLElement>('.kb-chain-step');
    if (!stepEl) return;
    ke.preventDefault();
    activate(stepEl);
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKeydown);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('keydown', onKeydown);
    marked.__icenKbChainInit = false;
  };
}
