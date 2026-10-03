/*
 * @icen.ai/ui — Behavior: kb-review（人工标注/审查队列，观测治理域；与 components/kb-ops.css 配套）
 *
 * DOM 契约（类名固定，docs/spec/kb-family.md §5.20）：
 *   <div class="kb-review" tabindex?>(keybind)
 *     <div class="kb-review-queue">
 *       <div class="kb-review-filter">分配人 <select class="kb-review-filter-select">全部|@a|…</select></div>
 *       <div class="kb-review-list">
 *         <button class="kb-review-item [is-active] [is-done]" data-task-id="…">
 *           <span class="kb-dot [is-ok]"></span>            ← open 灰 / done 绿
 *           <span class="kb-review-item-main"><span class="kb-review-item-title">label</span></span>
 *           <span class="kb-review-item-kind">回答</span>
 *           <span class="kb-review-item-assignee">@李四</span>
 *         </button>…
 *       </div>
 *     </div>
 *     <div class="kb-review-card" tabindex="0">            ← 全键盘流挂载点（keybind 在组件容器上、命中卡片内才生效）
 *       <div class="kb-review-card-head">
 *         <span class="kb-review-card-kind">回答</span>
 *         <span class="kb-review-card-title">target 标题</span>
 *         <select class="kb-review-assign">未分配|姓名…</select>   ← 仅 opts.assignees 提供时
 *       </div>
 *       <div class="kb-review-rubrics">
 *         <div class="kb-review-rubric" data-config-name="正确性">
 *           <div class="kb-review-rubric-name">正确性 <span class="kb-review-rubric-desc">…</span></div>
 *           categorical → <div class="kb-review-chips">
 *             <button class="kb-review-chip [is-on]" data-opt="对"><span class="kb-key">1</span>对</button>…（前 9 项带数字角标）
 *           </div>
 *           numeric → <div class="kb-review-slider-row">
 *             <input class="kb-review-slider" type="range" min="0" max="10" step="0.5">
 *             <span class="kb-num kb-review-slider-value">7.5</span></div>
 *         </div>…
 *       </div>
 *       <div class="kb-review-foot">
 *         <button class="kb-review-submit">完成并下一条 <span class="kb-key">⌘↵</span></button>
 *         <span class="kb-review-hint">? 快捷键</span>
 *       </div>
 *       <div class="kb-review-keys" hidden>…快捷键小浮层（.kb-key 表）…</div>
 *     </div>
 *   </div>
 *
 * 全键盘流（审查卡聚焦时）：←/→ 切条目（滑杆聚焦时让位原生调值）、1–9 选 categorical
 * （聚焦在某 rubric 行内优先作用于该行，否则首个 categorical）、Cmd/Ctrl+Enter 提交并下一条、
 * ? 显隐快捷键浮层、Esc 关浮层。
 *
 * 事件（emitIcen，bubbles；与 opts.onAction 回调双通道）：
 *   icen:kb-review-score  { taskId, name, value }     — 打分（categorical 选项值 / numeric 数值）
 *   icen:kb-review-submit { taskId }                  — 完成（自动 next()）
 *   icen:kb-review-assign { taskId, assignee }        — 分配（opts.assignees 提供时）
 *   onAction({type:'select'|'score'|'submit'|'assign', taskId, name?, value?})
 *
 * createKbReview 返回句柄 { el, current, next, prev, submit, destroy }；destroy 解绑
 * 键盘监听并清空 DOM（幂等；对同一 el 重复 create 会先销毁旧实例）。SSR 下渲染 no-op、方法安全。
 * 渲染只写 textContent/createElement（禁 innerHTML，无 SVG）。
 */

import { h, type KbReviewTask, type KbScoreConfig } from './kb-core';
import { emitIcen } from './events';

/** onAction 回调的动作信封（与 icen:kb-review-* 事件双通道；select 无对应事件，仅回调） */
export interface KbReviewActionDetail {
  type: 'select' | 'score' | 'submit' | 'assign';
  taskId: string;
  /** score：配置名 */
  name?: string;
  /** score：选项/数值；assign：分配人 */
  value?: string | number;
}

/** createKbReview 入参 */
export interface KbReviewOpts {
  /** 审查队列（内部持有副本，不打脏调用方数据） */
  queue: KbReviewTask[];
  /** rubric 配置（categorical / numeric） */
  configs: KbScoreConfig[];
  /** 动作回调（与事件双通道） */
  onAction?: (action: KbReviewActionDetail) => void;
  /** 分配人名单（提供时审查卡显示分配下拉） */
  assignees?: string[];
}

/** createKbReview 句柄（函数名冻结于 spec §5.20） */
export interface KbReviewHandle {
  el: HTMLElement;
  /** 当前（可见列表中的）任务；空返回 null */
  current(): KbReviewTask | null;
  /** 下一条（循环）；返回新当前任务 */
  next(): KbReviewTask | null;
  /** 上一条（循环） */
  prev(): KbReviewTask | null;
  /** 完成当前任务（置 done + 派发 submit + 自动 next） */
  submit(): void;
  /** 解绑键盘监听并清空 DOM（幂等） */
  destroy(): void;
}

/** target.kind 的展示标签 */
const KIND_LABELS: Record<string, string> = { trace: '轨迹', message: '消息', answer: '回答' };

/** numeric 滑杆值显示：7.5 / 5 / 0 */
const fmtSlider = (v: number): string => v.toFixed(1).replace(/\.0$/, '');

function cloneTask(t: KbReviewTask): KbReviewTask {
  return {
    ...t,
    target: { ...t.target },
    scores: t.scores ? t.scores.map((s) => ({ ...s })) : undefined,
  };
}

function distinctAssignees(tasks: KbReviewTask[]): string[] {
  const out: string[] = [];
  for (const t of tasks) if (t.assignee && !out.includes(t.assignee)) out.push(t.assignee);
  return out;
}

interface ReviewState {
  tasks: KbReviewTask[];
  configs: KbScoreConfig[];
  assignees: string[];
  onAction?: (action: KbReviewActionDetail) => void;
  /** '' = 全部 */
  filter: string;
  /** 可见列表中的当前下标 */
  idx: number;
  keysOpen: boolean;
}

interface ReviewHost extends HTMLElement {
  __icenKbReview?: { destroy(): void };
}

/**
 * 创建标注/审查队列（左右结构：队列列表 + 审查卡），返回带导航/提交/销毁的句柄。
 * 键盘处理挂在组件容器上、仅当焦点位于审查卡内才生效；destroy 解绑。
 */
export function createKbReview(el: HTMLElement, opts: KbReviewOpts): KbReviewHandle {
  if (typeof document === 'undefined') {
    /* SSR：静态句柄（方法 no-op，current 恒 null）——文档站契约自述对齐 */
    const noop = (): void => undefined;
    return { el, current: () => null, next: () => null, prev: () => null, submit: noop, destroy: noop };
  }
  const host = el as ReviewHost;
  host.__icenKbReview?.destroy(); /* 同一 el 重复 create：先销毁旧实例 */

  const state: ReviewState = {
    tasks: opts.queue.map(cloneTask),
    configs: opts.configs,
    assignees: opts.assignees ?? [],
    onAction: opts.onAction,
    filter: '',
    idx: 0,
    keysOpen: false,
  };
  let destroyed = false;

  const fire = (action: KbReviewActionDetail): void => {
    state.onAction?.(action);
  };
  const visible = (): KbReviewTask[] =>
    state.tasks.filter((t) => !state.filter || t.assignee === state.filter);

  const getScore = (task: KbReviewTask, name: string): string | number | undefined =>
    task.scores?.find((s) => s.name === name)?.value;
  const setScore = (task: KbReviewTask, name: string, value: string | number): void => {
    if (!task.scores) task.scores = [];
    const entry = task.scores.find((s) => s.name === name);
    if (entry) entry.value = value;
    else task.scores.push({ name, value });
  };

  const emitScore = (task: KbReviewTask, name: string, value: string | number): void => {
    emitIcen(host, 'icen:kb-review-score', { taskId: task.id, name, value });
    fire({ type: 'score', taskId: task.id, name, value });
  };
  const score = (task: KbReviewTask, name: string, value: string | number): void => {
    setScore(task, name, value);
    emitScore(task, name, value);
    render();
  };
  const assign = (task: KbReviewTask, assignee: string): void => {
    task.assignee = assignee || undefined;
    emitIcen(host, 'icen:kb-review-assign', { taskId: task.id, assignee });
    fire({ type: 'assign', taskId: task.id, value: assignee });
    render();
  };

  /** 切到可见列表的第 i 条（循环取模）；派发 select 回调 */
  const selectIdx = (i: number): KbReviewTask | null => {
    const vis = visible();
    if (!vis.length) {
      state.idx = 0;
      render();
      return null;
    }
    const len = vis.length;
    state.idx = ((i % len) + len) % len;
    const task = vis[state.idx]!;
    render();
    fire({ type: 'select', taskId: task.id });
    return task;
  };

  const next = (): KbReviewTask | null => (destroyed ? null : selectIdx(state.idx + 1));
  const prev = (): KbReviewTask | null => (destroyed ? null : selectIdx(state.idx - 1));

  const submit = (): void => {
    if (destroyed) return;
    const task = visible()[state.idx];
    if (!task) return;
    task.status = 'done';
    emitIcen(host, 'icen:kb-review-submit', { taskId: task.id });
    fire({ type: 'submit', taskId: task.id });
    next();
  };

  /* ── 键盘流（挂组件容器；焦点在审查卡内才生效；destroy 解绑） ── */
  const onKeyDown = (e: KeyboardEvent): void => {
    if (destroyed) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.kb-review-card')) return;
    if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    const isRange = target instanceof HTMLInputElement && target.type === 'range';

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (isRange) return; /* 滑杆原生左右调值 */
      e.preventDefault();
      if (e.key === 'ArrowRight') next();
      else prev();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === '?') {
      e.preventDefault();
      state.keysOpen = !state.keysOpen;
      render();
      return;
    }
    if (e.key === 'Escape' && state.keysOpen) {
      state.keysOpen = false;
      render();
      return;
    }
    if (!isRange && e.key >= '1' && e.key <= '9') {
      const n = Number(e.key);
      const rubricRow = target.closest<HTMLElement>('.kb-review-rubric');
      let cfg: KbScoreConfig | undefined;
      if (rubricRow) cfg = state.configs.find((c) => c.name === rubricRow.dataset.configName);
      cfg ??= state.configs.find((c) => c.type === 'categorical');
      if (!cfg || cfg.type !== 'categorical') return;
      const opt = (cfg.categories ?? [])[n - 1];
      const task = visible()[state.idx];
      if (!opt || !task) return;
      e.preventDefault();
      score(task, cfg.name, opt);
    }
  };
  host.addEventListener('keydown', onKeyDown);

  /* ── 渲染（快照整树重建；重渲后把焦点还给审查卡，键盘流不断） ── */
  const render = (): void => {
    if (destroyed || typeof document === 'undefined') return;
    const doc = host.ownerDocument;
    const active = doc.activeElement;
    const hadFocus = active instanceof HTMLElement && host.contains(active);

    host.className = 'kb-review';
    host.replaceChildren();

    /* 左：队列列表 */
    const queueCol = h('div', 'kb-review-queue');
    const filterWrap = h('div', 'kb-review-filter');
    filterWrap.append(h('span', 'kb-review-filter-label', '分配人'));
    const filterSel = h('select', 'kb-review-filter-select');
    const allOpt = h('option', undefined, '全部');
    allOpt.value = '';
    filterSel.append(allOpt);
    for (const a of distinctAssignees(state.tasks)) {
      const o = h('option', undefined, a);
      o.value = a;
      filterSel.append(o);
    }
    filterSel.value = state.filter;
    filterSel.addEventListener('change', () => {
      state.filter = filterSel.value;
      state.idx = 0;
      render();
    });
    filterWrap.append(filterSel);
    queueCol.append(filterWrap);

    const vis = visible();
    const listEl = h('div', 'kb-review-list');
    if (!vis.length) {
      listEl.append(h('div', 'kb-empty', state.filter ? '该分配人下没有条目' : '队列为空'));
    } else {
      vis.forEach((t, i) => {
        const item = h('button', `kb-review-item${t.status === 'done' ? ' is-done' : ''}${i === state.idx ? ' is-active' : ''}`);
        item.type = 'button';
        item.dataset.taskId = t.id;
        const main = h('span', 'kb-review-item-main');
        main.append(h('span', 'kb-review-item-title', t.target.label || t.target.id));
        item.append(
          h('span', `kb-dot${t.status === 'done' ? ' is-ok' : ''}`),
          main,
          h('span', 'kb-review-item-kind', KIND_LABELS[t.target.kind] ?? t.target.kind),
          h('span', 'kb-review-item-assignee', t.assignee ? `@${t.assignee}` : ''),
        );
        item.addEventListener('click', () => {
          if (i !== state.idx) selectIdx(i);
        });
        listEl.append(item);
      });
    }
    queueCol.append(listEl);

    /* 右：审查卡 */
    const card = h('div', 'kb-review-card');
    card.tabIndex = 0;
    const task = vis[state.idx];
    if (!task) {
      card.append(h('div', 'kb-empty', '没有待审查条目'));
    } else {
      const head = h('div', 'kb-review-card-head');
      head.append(
        h('span', 'kb-review-card-kind', KIND_LABELS[task.target.kind] ?? task.target.kind),
        h('span', 'kb-review-card-title', task.target.label || task.target.id),
      );
      if (state.assignees.length) {
        const sel = h('select', 'kb-review-assign');
        const placeholder = h('option', undefined, '未分配');
        placeholder.value = '';
        sel.append(placeholder);
        for (const a of state.assignees) {
          const o = h('option', undefined, a);
          o.value = a;
          sel.append(o);
        }
        sel.value = task.assignee ?? '';
        sel.addEventListener('change', () => assign(task, sel.value));
        head.append(sel);
      }
      card.append(head);

      const rubrics = h('div', 'kb-review-rubrics');
      for (const cfg of state.configs) {
        const row = h('div', 'kb-review-rubric');
        row.dataset.configName = cfg.name;
        const nameEl = h('div', 'kb-review-rubric-name', cfg.name);
        if (cfg.description) nameEl.append(h('span', 'kb-review-rubric-desc', cfg.description));
        row.append(nameEl);

        if (cfg.type === 'categorical') {
          const chips = h('div', 'kb-review-chips');
          (cfg.categories ?? []).forEach((opt, oi) => {
            const chip = h('button', `kb-review-chip${getScore(task, cfg.name) === opt ? ' is-on' : ''}`);
            chip.type = 'button';
            chip.dataset.opt = opt;
            if (oi < 9) chip.append(h('span', 'kb-key', String(oi + 1))); /* 数字角标（1–9） */
            chip.append(h('span', 'kb-review-chip-label', opt));
            chip.addEventListener('click', () => score(task, cfg.name, opt));
            chips.append(chip);
          });
          row.append(chips);
        } else {
          const cur = typeof getScore(task, cfg.name) === 'number' ? (getScore(task, cfg.name) as number) : 5;
          const sliderRow = h('div', 'kb-review-slider-row');
          const input = h('input', 'kb-review-slider');
          input.type = 'range';
          input.min = '0';
          input.max = '10';
          input.step = '0.5';
          input.value = String(cur);
          input.setAttribute('aria-label', cfg.name);
          const val = h('span', 'kb-num kb-review-slider-value', fmtSlider(cur));
          /* input 只更新本地（整树重渲会打断拖拽）；change 才走事件通道 */
          input.addEventListener('input', () => {
            const v = Number(input.value);
            setScore(task, cfg.name, v);
            val.textContent = fmtSlider(v);
          });
          input.addEventListener('change', () => emitScore(task, cfg.name, Number(input.value)));
          sliderRow.append(input, val);
          row.append(sliderRow);
        }
        rubrics.append(row);
      }
      card.append(rubrics);

      const foot = h('div', 'kb-review-foot');
      const submitBtn = h('button', 'kb-review-submit');
      submitBtn.type = 'button';
      submitBtn.append(h('span', undefined, '完成并下一条'), h('span', 'kb-key', '⌘↵'));
      submitBtn.addEventListener('click', () => submit());
      foot.append(submitBtn, h('span', 'kb-review-hint', '? 快捷键'));
      card.append(foot);
    }

    /* 快捷键小浮层（? 切换） */
    const keys = h('div', 'kb-review-keys');
    keys.hidden = !state.keysOpen;
    const KEY_ROWS: ReadonlyArray<readonly [string, string]> = [
      ['←/→', '切换条目'],
      ['1–9', '选择选项'],
      ['⌘/Ctrl ↵', '完成并下一条'],
      ['?', '显示/隐藏本提示'],
      ['Esc', '关闭提示'],
    ];
    for (const [k, label] of KEY_ROWS) {
      const r = h('div', 'kb-review-keys-row');
      r.append(h('span', 'kb-key', k), h('span', undefined, label));
      keys.append(r);
    }
    card.append(keys);

    host.append(queueCol, card);
    if (hadFocus) card.focus();
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    host.removeEventListener('keydown', onKeyDown);
    host.replaceChildren();
    host.classList.remove('kb-review');
    delete host.__icenKbReview;
  };
  host.__icenKbReview = { destroy };

  render();
  return {
    el: host,
    current: () => (destroyed ? null : visible()[state.idx] ?? null),
    next,
    prev,
    submit,
    destroy,
  };
}
