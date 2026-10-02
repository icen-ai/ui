/*
 * @icen.ai/ui — Behavior: ai-feedback（回答级 👍/👎 反馈 + 踩因枚举，与 components/ai-panel.css 的 .ai-feedback 段配套）
 *
 * DOM 契约（类名固定，docs/spec/kb-family.md §5.27）：
 *   <div class="ai-feedback [.is-done]">
 *     <div class="ai-feedback-votes">
 *       <button class="ai-feedback-vote is-up" type="button" aria-pressed="false" aria-label="有帮助">…svg…</button>
 *       <button class="ai-feedback-vote is-down" type="button" aria-pressed="false" aria-label="无帮助">…svg…</button>
 *     </div>
 *     <div class="ai-feedback-reasons" hidden>                    ← 点 👎 展开；点 👍 不展开
 *       <button class="ai-feedback-chip [.is-picked]" type="button">答案有误</button>…
 *       <button class="ai-feedback-submit" type="button">提交</button>
 *     </div>
 *     <div class="ai-feedback-done" hidden>感谢反馈，已关联到该条回答的追踪记录</div>
 *   </div>
 *
 * 状态机：
 *   中性 →（点 👍）picked-up 锁定（对侧禁用）；→（点 👎）picked-down 锁定 + 展开原因 chips；
 *   再次点击已选钮 → 回中性（对侧恢复、chips 收起）。picked-down 下选 chip（单选可切换）后
 *   「提交」→ .is-done 终态（按钮与 chips 隐藏，显示感谢文案）。
 *   每次 vote 变更与提交都派 icen:ai-feedback {value: 1|-1|0, reason?, el}
 *   （el 为 .ai-feedback 根；事件与 opts.onFeedback 回调双通道）。
 *
 * 行为：
 *   renderAiFeedback(el, opts?)  快照渲染（reasons 默认五项枚举）；返回挂载容器 el
 *                                （render* 返回挂载元素约定，SSR 原样返回）。
 *   initAiFeedback(root?)        幂等（__icenAiFeedbackInit）+ 返回销毁函数；scope 级委托驱动
 *                                全部状态切换（渲染产物与静态手写 DOM 同一套类名契约）。
 *
 * SSR 下 render 原样返回挂载元素、init 为 no-op；文本一律 textContent，禁 innerHTML；
 * SVG 过 ai-core 的 svgIcon() 消毒解析。
 */

import { h, svgIcon } from './ai-core';
import { emitIcen } from './events';

/* ── 模型 ── */

/** 反馈事件 detail（与 IcenEventMap['icen:ai-feedback'] 同构；el 为 .ai-feedback 根） */
export interface AiFeedbackDetail {
  value: 1 | -1 | 0;
  reason?: string;
  el?: HTMLElement;
}

export interface AiFeedbackOpts {
  /** 踩因枚举（默认五项） */
  reasons?: string[];
  /** 反馈回调（与 icen:ai-feedback 事件双通道） */
  onFeedback?: (detail: AiFeedbackDetail) => void;
}

/** 默认踩因（kb-family §5.27：踩后原因枚举 chips） */
const DEFAULT_REASONS: readonly string[] = ['答案有误', '引用不符', '内容过时', '无引用依据', '越权信息'];

/* ── 图标（lucide 风格 24×24 stroke，svgIcon 消毒解析） ── */

const ICON_THUMB_UP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
const ICON_THUMB_DOWN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>';

interface MarkedScope extends ParentNode {
  __icenAiFeedbackInit?: boolean;
}

/* onFeedback 回调寄存：render 时写入、委托触发时读取（不污染元素 expando） */
const feedbackCallbacks = new WeakMap<HTMLElement, (detail: AiFeedbackDetail) => void>();

/* ── 渲染 ── */

/**
 * 渲染 👍/👎 双钮 + 踩因 chips + 提交/已提交态（快照渲染，全 textContent）。
 * 交互由 initAiFeedback 委托驱动；opts.onFeedback 与 icen:ai-feedback 事件双通道。
 * 返回挂载容器 el（render* 返回挂载元素约定，SSR 下原样返回）。
 */
export function renderAiFeedback(el: HTMLElement, opts: AiFeedbackOpts = {}): HTMLElement {
  if (typeof document === 'undefined') return el;
  el.textContent = '';
  const root = h('div', 'ai-feedback');

  const votes = h('div', 'ai-feedback-votes');
  for (const dir of ['is-up', 'is-down'] as const) {
    const btn = h('button', `ai-feedback-vote ${dir}`);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', dir === 'is-up' ? '有帮助' : '无帮助');
    const icon = svgIcon(dir === 'is-up' ? ICON_THUMB_UP : ICON_THUMB_DOWN);
    if (icon) btn.appendChild(icon);
    votes.appendChild(btn);
  }
  root.appendChild(votes);

  const reasons = h('div', 'ai-feedback-reasons');
  reasons.hidden = true;
  const chips = (opts.reasons && opts.reasons.length > 0 ? opts.reasons : Array.from(DEFAULT_REASONS))
    .filter((r) => typeof r === 'string' && r.trim() !== '');
  for (const r of chips) {
    const chip = h('button', 'ai-feedback-chip', r);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', 'false');
    reasons.appendChild(chip);
  }
  const submit = h('button', 'ai-feedback-submit', '提交');
  submit.type = 'button';
  reasons.appendChild(submit);
  root.appendChild(reasons);

  const done = h('div', 'ai-feedback-done', '感谢反馈，已关联到该条回答的追踪记录');
  done.hidden = true;
  root.appendChild(done);

  if (opts.onFeedback) feedbackCallbacks.set(root, opts.onFeedback);
  el.appendChild(root);
  return el;
}

/* ── 状态切换（委托侧共用；DOM 类名驱动，无 JS 内状态） ── */

function notify(root: HTMLElement, detail: AiFeedbackDetail): void {
  emitIcen(root, 'icen:ai-feedback', { value: detail.value, reason: detail.reason, el: root });
  const cb = feedbackCallbacks.get(root);
  if (cb) cb({ value: detail.value, reason: detail.reason, el: root });
}

function voteOf(btn: HTMLElement): 1 | -1 | undefined {
  if (btn.classList.contains('is-up')) return 1;
  if (btn.classList.contains('is-down')) return -1;
  return undefined;
}

/** 回中性：摘锁定、恢复双侧可用、收起原因区 */
function resetVotes(root: HTMLElement): void {
  for (const btn of Array.from(root.querySelectorAll<HTMLButtonElement>('.ai-feedback-vote'))) {
    btn.classList.remove('is-picked');
    btn.disabled = false;
    btn.setAttribute('aria-pressed', 'false');
  }
  const reasons = root.querySelector<HTMLElement>('.ai-feedback-reasons');
  if (reasons) reasons.hidden = true;
}

/** 锁定某一侧：picked + 对侧禁用；is-down 时展开原因 chips */
function pickVote(root: HTMLElement, btn: HTMLButtonElement, value: 1 | -1): void {
  for (const other of Array.from(root.querySelectorAll<HTMLButtonElement>('.ai-feedback-vote'))) {
    if (other === btn) {
      other.classList.add('is-picked');
      other.disabled = false;
      other.setAttribute('aria-pressed', 'true');
    } else {
      other.classList.remove('is-picked');
      other.disabled = true;
      other.setAttribute('aria-pressed', 'false');
    }
  }
  const reasons = root.querySelector<HTMLElement>('.ai-feedback-reasons');
  if (reasons) reasons.hidden = value !== -1;
}

/* ── 委托初始化 ── */

/**
 * 反馈委托初始化：vote 切换/取消、chip 单选、提交进入 .is-done 终态。
 * 幂等（scope 挂 __icenAiFeedbackInit）；返回销毁函数（解绑监听 + 复位标记，可重新 init）。
 * SSR 下为 no-op。按钮为原生 button，键盘 Enter/Space 走原生 click，无需键盘委托。
 */
export function initAiFeedback(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as MarkedScope;
  if (marked.__icenAiFeedbackInit) return () => undefined;
  marked.__icenAiFeedbackInit = true;
  const target = scope as ParentNode & EventTarget;

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const rootEl = t.closest<HTMLElement>('.ai-feedback');
    if (!rootEl || rootEl.classList.contains('is-done')) return;

    /* chip 单选（可切换） */
    const chip = t.closest<HTMLElement>('.ai-feedback-chip');
    if (chip) {
      const picked = chip.classList.contains('is-picked');
      for (const c of Array.from(rootEl.querySelectorAll<HTMLElement>('.ai-feedback-chip'))) {
        c.classList.remove('is-picked');
        c.setAttribute('aria-pressed', 'false');
      }
      if (!picked) {
        chip.classList.add('is-picked');
        chip.setAttribute('aria-pressed', 'true');
      }
      return;
    }

    /* 提交：携带选中原因进入终态 */
    if (t.closest('.ai-feedback-submit')) {
      const reason = rootEl.querySelector<HTMLElement>('.ai-feedback-chip.is-picked')?.textContent ?? undefined;
      rootEl.classList.add('is-done');
      const done = rootEl.querySelector<HTMLElement>('.ai-feedback-done');
      if (done) done.hidden = false;
      const reasons = rootEl.querySelector<HTMLElement>('.ai-feedback-reasons');
      if (reasons) reasons.hidden = true;
      notify(rootEl, { value: -1, reason: reason || undefined });
      return;
    }

    /* 👍/👎：已选再点回中性，未选锁定 */
    const voteBtn = t.closest<HTMLButtonElement>('.ai-feedback-vote');
    if (!voteBtn || voteBtn.disabled) return;
    const value = voteOf(voteBtn);
    if (value === undefined) return;
    if (voteBtn.classList.contains('is-picked')) {
      resetVotes(rootEl);
      notify(rootEl, { value: 0 });
    } else {
      pickVote(rootEl, voteBtn, value);
      notify(rootEl, { value });
    }
  };

  target.addEventListener('click', onClick);

  return () => {
    target.removeEventListener('click', onClick);
    marked.__icenAiFeedbackInit = false;
  };
}
