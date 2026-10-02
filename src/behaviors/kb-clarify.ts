/*
 * @icen.ai/ui — Behavior: kb-clarify（问数域 · 澄清反问卡，与 components/kb-data.css 配套）
 *
 * DOM 契约（renderKbClarify 构建，规格 docs/spec/kb-family.md §5.17）：
 *   <div class="kb-clarify [.is-answered]" data-clarify-id? >
 *     <div class="kb-clarify-q">
 *       <span class="kb-clarify-qicon">…svg…</span>
 *       <span class="kb-clarify-qtext">「销售额」指含税还是不含税？</span>
 *     </div>
 *     <div class="kb-clarify-opts">
 *       <button type="button" class="kb-clarify-opt [.is-picked]" data-value data-label>含税口径</button>…
 *     </div>
 *     <div class="kb-clarify-resolved" hidden>已解析：<b class="kb-clarify-picked">含税口径</b></div>
 *     <div class="kb-clarify-reason">检测到口径歧义，先确认再生成 SQL</div>   <!-- reason 有才渲 -->
 *   </div>
 *
 * 行为：
 *   - 点选选项（点选非打字）：命中项加 .is-picked，其余选项禁用，根加 .is-answered，
 *     显示「已解析：{label}」回显行；同一卡只能答一次（重答 = 数据快照重渲 renderKbClarify）
 *   - 事件：icen:kb-clarify-answer {id, value, label}（events.ts 已登记）；
 *     opts.onAnswer 为 handle 回调通道（与事件同 detail）
 *   - 监听器直挂在渲染时新建的选项按钮上（快照重渲自然回收，无 init/销毁负担）
 */

import { h, svgIcon, type KbClarification } from './kb-core';
import { emitIcen } from './events';

const ICON_HELP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4"/><path d="M12 17.5h.01"/></svg>';

/** renderKbClarify 选项：handle 回调通道（事件通道恒开） */
export interface KbClarifyOptions {
  /** 点选某选项后的回调（与 icen:kb-clarify-answer 同 detail） */
  onAnswer?: (answer: { id?: string; value: string; label: string }) => void;
}

/** 宽进严出：素对象 → KbClarification（question/options 容错，不抛异常） */
function toClarification(raw: KbClarification | Partial<KbClarification>): KbClarification {
  const r = raw as Partial<KbClarification> ?? {};
  const options = Array.isArray(r.options)
    ? r.options
        .filter((o): o is { label: string; value: string } => !!o && typeof o === 'object')
        .map((o) => ({ label: String(o.label ?? ''), value: String(o.value ?? o.label ?? '') }))
        .filter((o) => o.label)
    : [];
  return {
    id: typeof r.id === 'string' && r.id ? r.id : undefined,
    question: String(r.question ?? ''),
    options,
    reason: typeof r.reason === 'string' && r.reason ? r.reason : undefined,
  };
}

/**
 * 渲染澄清反问卡（快照式：重复调用整段重建，重置为未答态），返回挂载元素 el
 * （render* 约定；SSR 原样返回）。问题行 + 选项 chips（点选高亮 .is-picked、
 * 答后禁用其余并回显「已解析：{label}」）+ reason 弱化小字。
 */
export function renderKbClarify(
  el: HTMLElement,
  c: KbClarification | Partial<KbClarification>,
  opts?: KbClarifyOptions,
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const clar = toClarification(c);
  el.textContent = '';

  const root = h('div', 'kb-clarify');
  if (clar.id) root.dataset.clarifyId = clar.id;

  /* 问题行 */
  const q = h('div', 'kb-clarify-q');
  const iconBox = h('span', 'kb-clarify-qicon');
  const svg = svgIcon(ICON_HELP);
  if (svg) iconBox.appendChild(svg);
  q.appendChild(iconBox);
  q.appendChild(h('span', 'kb-clarify-qtext', clar.question));
  root.appendChild(q);

  /* 选项 chips（空选项不渲 —— 问题本身仍可见，由消费方决定追问渠道） */
  const optsWrap = h('div', 'kb-clarify-opts');
  const resolved = h('div', 'kb-clarify-resolved');
  resolved.hidden = true;

  const pick = (btn: HTMLButtonElement): void => {
    if (root.classList.contains('is-answered')) return;
    root.classList.add('is-answered');
    btn.classList.add('is-picked');
    Array.from(optsWrap.querySelectorAll<HTMLButtonElement>('.kb-clarify-opt')).forEach((b) => {
      if (b !== btn) b.disabled = true;
    });
    resolved.textContent = '';
    resolved.appendChild(document.createTextNode('已解析：'));
    resolved.appendChild(h('b', 'kb-clarify-picked', btn.dataset.label ?? ''));
    resolved.hidden = false;
    const answer = { id: clar.id, value: btn.dataset.value ?? '', label: btn.dataset.label ?? '' };
    emitIcen(btn, 'icen:kb-clarify-answer', answer);
    opts?.onAnswer?.(answer);
  };

  for (const o of clar.options) {
    const btn = h('button', 'kb-clarify-opt', o.label);
    btn.type = 'button';
    btn.dataset.value = o.value;
    btn.dataset.label = o.label;
    btn.addEventListener('click', () => pick(btn));
    optsWrap.appendChild(btn);
  }
  if (optsWrap.children.length > 0) root.appendChild(optsWrap);
  root.appendChild(resolved);

  /* 弱化说明：为什么反问（口径歧义/缺时间范围…） */
  if (clar.reason) root.appendChild(h('div', 'kb-clarify-reason', clar.reason));

  el.appendChild(root);
  return el;
}
