/*
 * @icen.ai/ui — Behavior: kb-pipeline（文档解析管线时间线，与 components/kb-ingest.css 配套）
 *
 * DOM 契约（docs/spec/kb-family.md §5.5；状态机 kb-core KB_RUN_STATUSES）：
 *   <div class="icen-kb-pipeline is-<status>" data-icen-document-id="…">
 *     <div class="icen-kb-pipeline-head">
 *       <button type="button" class="icen-kb-fold-head icen-kb-pipeline-toggle" aria-expanded="false|true">
 *         <span class="icen-kb-fold-caret">chevron svg</span>
 *         <span class="icen-kb-pipeline-state is-<status>">
 *           <span class="icen-kb-dot [is-ok|is-err|is-live]"></span><span>已完成</span>
 *         </span>
 *         <span class="icen-kb-pipeline-title">文档标题 / documentId</span>
 *         <span class="icen-kb-num kb-pipeline-chunks">12 chunks</span>
 *         <span class="icen-kb-num kb-pipeline-elapsed">12s</span>
 *         <span class="icen-kb-fold-count">5 步</span>
 *       </button>
 *       <button type="button" class="icen-kb-btn icen-kb-pipeline-rerun" data-icen-kb-pipeline-rerun>重跑</button>
 *     </div>
 *     <div class="icen-kb-pipeline-progress" role="progressbar" …>          <!-- 仅 run.icen-progress 定义时 -->
 *     <div class="kb-pipeline-body" hidden>
 *       <ol class="icen-kb-pipeline-steps">
 *         <li class="icen-kb-pipeline-step is-<status>">
 *           <span class="icen-kb-dot [is-ok|is-err|is-live]"></span>
 *           <span class="icen-kb-pipeline-step-label">解析</span>
 *           <span class="icen-kb-step-detail">3 页 / 2 表</span>
 *           <span class="icen-kb-num">×12</span>                            <!-- icen-step.count 可选 -->
 *           <span class="icen-kb-num icen-kb-pipeline-step-elapsed">12s</span>
 *         </li>…
 *       </ol>
 *       <div class="icen-kb-pipeline-error">                                <!-- 仅 fail + error 存在时 -->
 *         <span class="icen-kb-pipeline-error-stage">解析阶段</span>
 *         <span class="icen-kb-pipeline-error-msg">原因文本</span>
 *       </div>
 *     </div>
 *   </div>
 *
 *   runs 数组输入时外层包 <div class="icen-kb-pipeline-list">（纵向卡片列表）；空数组给 .icen-kb-empty。
 *
 * 行为：
 *   - renderKbPipeline(el, run | runs)：快照渲染（整树重建），返回挂载容器 el（SSR 原样返回）。
 *     折叠初值与 ai-reasoning 同契约：running / fail 自动展开，其余折叠；重渲染前记录
 *     已有卡片的用户折叠态（按 data-icen-document-id），用户展开/收过则不再被自动态覆盖。
 *   - initKbPipeline(root?)：幂等（scope.__icenKbPipelineInit）+ 返回销毁函数；
 *     root 缺省 document 级委托（后续插入的 DOM 一并接管）。
 *     · 点击 .icen-kb-pipeline-toggle → aria-expanded / body hidden 翻转，
 *       从卡片根派 icen:kb-pipeline-toggle { el, open }
 *     · 点击 [data-icen-kb-pipeline-rerun] → 派 icen:kb-pipeline-rerun { documentId }（失败重跑
 *       粒度 = 单文档，无死路纪律）
 *   - 渲染只写 textContent / createElement；SVG 一律经 kb-core 转发 svgIcon() 消毒。
 */

import {
  h,
  kbRunStatusLabel,
  normalizePipelineRun,
  svgIcon,
  type KbPipelineRun,
  type KbRunStatus,
} from './kb-core';
import { emitIcen } from './events';
import { t } from './i18n';

/* ── 域内小工具 ── */

const svg = (d: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON_CARET = svg('<path d="m9 18 6-6-6-6"/>');
const ICON_RERUN = svg('<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>');
const ICON_ALERT = svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>');

/** 消毒后挂图标（svgIcon SSR / 解析失败返回 null 时静默跳过） */
function icon(parent: HTMLElement, svgStr: string): void {
  const node = svgIcon(svgStr);
  if (node) parent.appendChild(node);
}

/** 状态 → 状态点类（kb.css .icen-kb-dot 语义色的唯一入口） */
const STATUS_DOT: Record<KbRunStatus, string> = {
  unstart: '',
  queued: '',
  running: 'is-live',
  cancel: '',
  done: 'is-ok',
  fail: 'is-err',
};

/** 耗时格式：<1s → ms；<60s → s；再往上 → m+s（等宽由 .icen-kb-num 承担） */
function fmtMs(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s ? `${m}m${s}s` : `${m}m`;
}

/* ── 构建 ── */

function buildStepStep(raw: KbPipelineRun['steps'][number]): HTMLElement {
  const li = h('li', `icen-kb-pipeline-step is-${raw.status}`);
  li.appendChild(h('span', `icen-kb-dot ${STATUS_DOT[raw.status]}`.trim()));
  li.appendChild(h('span', 'icen-kb-pipeline-step-label', raw.label));
  if (raw.detail) li.appendChild(h('span', 'icen-kb-step-detail', raw.detail));
  if (typeof raw.count === 'number') li.appendChild(h('span', 'icen-kb-num', `×${raw.count}`));
  const elapsed = fmtMs(raw.elapsedMs);
  if (elapsed) li.appendChild(h('span', 'icen-kb-num icen-kb-pipeline-step-elapsed', elapsed));
  return li;
}

function buildRunCard(run: KbPipelineRun, userOpen: boolean | undefined): HTMLElement {
  const card = h('div', `icen-kb-pipeline is-${run.status}`);
  card.dataset.icenDocumentId = run.documentId;

  /* 头：折叠摘要行（状态徽章 + 标题 + chunkCount + 耗时）+ 重跑钮 */
  const head = h('div', 'icen-kb-pipeline-head');
  const toggle = h('button', 'icen-kb-fold-head icen-kb-pipeline-toggle');
  toggle.type = 'button';
  const open = userOpen ?? (run.status === 'running' || run.status === 'fail');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-controls', `${run.documentId}-body`);
  const caret = h('span', 'icen-kb-fold-caret');
  icon(caret, ICON_CARET);
  toggle.appendChild(caret);

  const state = h('span', `icen-kb-pipeline-state is-${run.status}`);
  state.appendChild(h('span', `icen-kb-dot ${STATUS_DOT[run.status]}`.trim()));
  state.appendChild(h('span', 'icen-kb-pipeline-state-label', kbRunStatusLabel(run.status)));
  toggle.appendChild(state);
  toggle.appendChild(h('span', 'icen-kb-pipeline-title', run.title || run.documentId));
  if (typeof run.chunkCount === 'number') {
    toggle.appendChild(h('span', 'icen-kb-num kb-pipeline-chunks', `${run.chunkCount} chunks`));
  }
  const elapsed = fmtMs(run.elapsedMs);
  if (elapsed) toggle.appendChild(h('span', 'icen-kb-num kb-pipeline-elapsed', elapsed));
  toggle.appendChild(h('span', 'icen-kb-fold-count icen-kb-meta', t('common.steps', { p0: run.steps.length })));
  head.appendChild(toggle);

  const rerun = h('button', 'icen-kb-btn icen-kb-pipeline-rerun');
  rerun.type = 'button';
  rerun.dataset.icenKbPipelineRerun = '';
  rerun.textContent = t('kbPipeline.rerun');
  icon(rerun, ICON_RERUN);
  head.appendChild(rerun);
  card.appendChild(head);

  /* 可选细粒度进度条（run.icen-progress 0–100） */
  if (typeof run.progress === 'number') {
    const bar = h('div', 'icen-kb-pipeline-progress');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', t('kbPipeline.progress'));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(Math.round(run.progress)));
    const fill = document.createElement('i');
    fill.style.width = `${Math.round(run.progress)}%`;
    bar.appendChild(fill);
    card.appendChild(bar);
  }

  /* 折叠体：步骤时间线 + 失败错误区 */
  const body = h('div', 'kb-pipeline-body');
  body.id = `${run.documentId}-body`;
  if (!open) body.hidden = true;
  const steps = h('ol', 'icen-kb-pipeline-steps');
  run.steps.forEach((s) => steps.appendChild(buildStepStep(s)));
  body.appendChild(steps);

  if (run.status === 'fail' && run.error) {
    const err = h('div', 'icen-kb-pipeline-error');
    icon(err, ICON_ALERT);
    const failedStep = run.steps.find((s) => s.status === 'fail');
    err.appendChild(h('span', 'icen-kb-pipeline-error-stage', run.error.stage ?? failedStep?.label ?? t('kbPipeline.unknownStage')));
    err.appendChild(h('span', 'icen-kb-pipeline-error-msg', run.error.message));
    body.appendChild(err);
  }
  card.appendChild(body);
  return card;
}

/* ── 渲染 ── */

/**
 * 渲染解析管线时间线（快照：整树重建后返回挂载容器 el）。
 * 单 run 渲染单卡；runs 数组渲染纵向列表（外层 .icen-kb-pipeline-list）；空数组给空态。
 * 重渲染会保留用户已展开/收起过的卡片折叠态（按 data-icen-document-id 匹配）。
 * SSR（无 document）下原样返回 el。
 */
export function renderKbPipeline(
  el: HTMLElement,
  run: KbPipelineRun | KbPipelineRun[],
): HTMLElement {
  if (typeof document === 'undefined') return el;
  /* 记录已有卡片的用户折叠态（「用户展开过则不再自动收」跨快照成立） */
  const userOpen = new Map<string, boolean>();
  el.querySelectorAll<HTMLElement>('.icen-kb-pipeline[data-icen-document-id]').forEach((card) => {
    const btn = card.querySelector<HTMLElement>('.icen-kb-pipeline-toggle');
    if (btn) userOpen.set(card.dataset.icenDocumentId ?? '', btn.getAttribute('aria-expanded') === 'true');
  });

  el.textContent = '';
  const runs = (Array.isArray(run) ? run : [run]).map(
    (r) => normalizePipelineRun(r as unknown as Record<string, unknown>),
  );
  if (!runs.length) {
    el.appendChild(h('div', 'icen-kb-empty', t('kbPipeline.empty')));
    return el;
  }
  const cards = runs.map((r) => buildRunCard(r, userOpen.get(r.documentId)));
  if (cards.length === 1) {
    el.appendChild(cards[0]!);
  } else {
    const list = h('div', 'icen-kb-pipeline-list');
    cards.forEach((c) => list.appendChild(c));
    el.appendChild(list);
  }
  return el;
}

/* ── 交互 ── */

interface PipelineScope extends ParentNode {
  __icenKbPipelineInit?: boolean;
}

/**
 * 接线管线折叠与单文档重跑（scope 级事件委托，重复调用幂等）。
 * root 缺省 document：页面一次 init 即接管后续插入的管线卡。
 * 返回销毁函数：摘除委托并复位幂等标记，销毁后可重新 initKbPipeline。SSR 下 no-op。
 */
export function initKbPipeline(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as PipelineScope;
  if (marked.__icenKbPipelineInit) return () => undefined;
  marked.__icenKbPipelineInit = true;
  const target = scope as ParentNode & EventTarget;

  const toggleCard = (card: HTMLElement, btn: HTMLElement): void => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    const body = card.querySelector<HTMLElement>(':scope > .kb-pipeline-body');
    if (body) body.hidden = !open;
    emitIcen(card, 'icen:kb-pipeline-toggle', { el: card, open });
  };

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const rerunBtn = t.closest<HTMLElement>('[data-icen-kb-pipeline-rerun]');
    if (rerunBtn) {
      const card = rerunBtn.closest<HTMLElement>('.icen-kb-pipeline');
      if (!card) return;
      emitIcen(card, 'icen:kb-pipeline-rerun', { documentId: card.dataset.icenDocumentId ?? '' });
      return;
    }
    const btn = t.closest<HTMLElement>('.icen-kb-pipeline-toggle');
    if (btn) {
      const card = btn.closest<HTMLElement>('.icen-kb-pipeline');
      if (card) toggleCard(card, btn);
    }
  };

  target.addEventListener('click', onClick);
  return () => {
    target.removeEventListener('click', onClick);
    marked.__icenKbPipelineInit = false;
  };
}
