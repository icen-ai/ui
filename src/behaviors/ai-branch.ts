/*
 * @icen.ai/ui — Behavior: ai-branch（回答分支版本切换器 ‹ 2/3 ›，与 components/ai-chat.css 的 .ai-branch 段配套）
 *
 * DOM 契约（类名固定，docs/spec/kb-family.md §5.27）：
 *   <div class="ai-branch" data-index="1" data-count="3" role="group" aria-label="分支版本">
 *     <button class="ai-branch-prev" type="button" aria-label="上一版本" [disabled]>‹</button>
 *     <span class="ai-branch-page">2/3</span>                     ← mono 数字（当前从 1 计）
 *     <button class="ai-branch-next" type="button" aria-label="下一版本" [disabled]>›</button>
 *   </div>
 *   count ≤ 1 时挂载容器渲染为空并置 hidden + aria-hidden（单版本无切换语义）。
 *
 * 行为：
 *   renderAiBranch(el, model)  快照渲染（textContent/createElement，禁 innerHTML）；index 钳制
 *                              到 [0, count-1]；边界钮禁用。返回挂载容器 el（render* 返回
 *                              挂载元素约定，SSR 原样返回）。
 *   initAiBranch(root?)        幂等（__icenAiBranchInit）+ 返回销毁函数；scope 级委托：
 *                              prev/next → icen:ai-branch-change {index: 钳制后的 index±1, count}
 *                              （自 .ai-branch 根派发；DOM 同步更新页码与禁用态，宿主可按需
 *                              重渲染覆盖）。按钮为原生 button，键盘走原生 click。
 *
 * SSR 下 render 原样返回挂载元素、init 为 no-op。
 */

import { h } from './ai-core';
import { emitIcen } from './events';

/* ── 模型 ── */

export interface AiBranchModel {
  /** 当前分支（0 起；渲染时钳制到 [0, count-1]） */
  index: number;
  /** 分支总数；≤1 时渲染为空（aria-hidden） */
  count: number;
}

interface MarkedScope extends ParentNode {
  __icenAiBranchInit?: boolean;
}

function clampIndex(index: number, count: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  if (index > count - 1) return count - 1;
  return Math.floor(index);
}

/* ── 渲染 ── */

/**
 * 渲染 ‹ index+1/count › 分支切换器：count ≤ 1 时挂载容器清空并置 hidden + aria-hidden；
 * 边界（首/末）对应方向钮禁用。返回挂载容器 el（render* 返回挂载元素约定，SSR 原样返回）。
 */
export function renderAiBranch(el: HTMLElement, model: AiBranchModel): HTMLElement {
  if (typeof document === 'undefined') return el;
  el.textContent = '';
  const count = Number.isFinite(model.count) ? Math.floor(model.count) : 0;
  if (count <= 1) {
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  el.hidden = false;
  el.removeAttribute('aria-hidden');

  const index = clampIndex(model.index, count);
  const root = h('div', 'ai-branch');
  root.dataset.index = String(index);
  root.dataset.count = String(count);
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '分支版本');

  const prev = h('button', 'ai-branch-prev', '‹');
  prev.type = 'button';
  prev.setAttribute('aria-label', '上一版本');
  prev.disabled = index <= 0;
  root.appendChild(prev);

  root.appendChild(h('span', 'ai-branch-page', `${index + 1}/${count}`));

  const next = h('button', 'ai-branch-next', '›');
  next.type = 'button';
  next.setAttribute('aria-label', '下一版本');
  next.disabled = index >= count - 1;
  root.appendChild(next);

  el.appendChild(root);
  return el;
}

/* ── 委托初始化 ── */

/**
 * 分支切换委托初始化：prev/next 点击 → icen:ai-branch-change {index, count}
 * （index 为钳制后的 index±1）；同时同步 data-index / 页码 / 边界禁用态（宿主不重渲染也可用，
 * 重渲染覆盖亦安全）。幂等（scope 挂 __icenAiBranchInit）；返回销毁函数。SSR 下为 no-op。
 */
export function initAiBranch(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as MarkedScope;
  if (marked.__icenAiBranchInit) return () => undefined;
  marked.__icenAiBranchInit = true;
  const target = scope as ParentNode & EventTarget;

  const step = (branch: HTMLElement, delta: -1 | 1): void => {
    const count = Number(branch.dataset.count ?? '');
    if (!Number.isFinite(count) || count <= 1) return;
    const current = clampIndex(Number(branch.dataset.index ?? '0'), count);
    const index = clampIndex(current + delta, count);
    if (index === current) return; // 边界（禁用钮理论上不派发，双保险）
    branch.dataset.index = String(index);
    const page = branch.querySelector<HTMLElement>('.ai-branch-page');
    if (page) page.textContent = `${index + 1}/${count}`;
    const prev = branch.querySelector<HTMLButtonElement>('.ai-branch-prev');
    if (prev) prev.disabled = index <= 0;
    const next = branch.querySelector<HTMLButtonElement>('.ai-branch-next');
    if (next) next.disabled = index >= count - 1;
    emitIcen(branch, 'icen:ai-branch-change', { index, count });
  };

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const branch = t.closest<HTMLElement>('.ai-branch');
    if (!branch) return;
    if (t.closest('.ai-branch-prev')) step(branch, -1);
    else if (t.closest('.ai-branch-next')) step(branch, 1);
  };

  target.addEventListener('click', onClick);

  return () => {
    target.removeEventListener('click', onClick);
    marked.__icenAiBranchInit = false;
  };
}
