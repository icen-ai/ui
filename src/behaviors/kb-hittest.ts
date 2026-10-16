/*
 * @icen.ai/ui — Behavior: kb-hittest（召回测试集，与 components/kb-search.css 配套）
 *
 * DOM 契约（create 装配，规格 docs/spec/kb-family.md §5.14）：
 *   <div class="icen-kb-hittest" data-icen-kb-hittest>
 *     <div class="icen-kb-hittest-stats">                          ← renderKbHitStats 快照填充
 *       <div class="icen-kb-hittest-stat kb-hittest-stat--rate">
 *         <span class="icen-kb-hittest-stat-label">命中率</span>
 *         <span class="icen-kb-num icen-kb-hittest-hitrate">62.5%</span></div>
 *       <div class="icen-kb-hittest-stat"><span class="icen-kb-hittest-stat-label">均分</span>
 *         <span class="icen-kb-num">0.72</span></div>
 *       <div class="icen-kb-hittest-stat"><span class="icen-kb-hittest-stat-label">通过</span>
 *         <span class="icen-kb-num">5/8</span></div>
 *       <span class="icen-kb-badge">参数仅本次会话生效</span>
 *     </div>
 *     <div class="icen-kb-hittest-list">
 *       <div class="icen-kb-hittest-row [.is-pass|.is-fail]">
 *         <button class="icen-kb-hittest-pin [.is-pinned]">…pin svg…</button>
 *         <span class="icen-kb-hittest-q">问题文本</span>
 *         <span class="icen-kb-hittest-expected"><span class="icen-kb-chip">chunkA</span>…[+N]</span>
 *         <span class="icen-kb-hittest-result icen-kb-num">✓ | ✗ | —</span>
 *         <button class="icen-kb-hittest-remove">×</button>
 *       </div>…
 *       [<div class="icen-kb-empty">…空态…</div>]
 *     </div>
 *     <div class="icen-kb-hittest-add">
 *       <icen-input class="icen-kb-hittest-input" placeholder="新增问题，Enter 添加" />
 *       <button class="icen-kb-hittest-add-btn">添加</button>
 *     </div>
 *     <button class="icen-kb-run">运行全部</button>                ← 本视图唯一 icen-accent
 *   </div>
 *
 * 行为：
 *   - case.passed 计算：lastHits 与 expectedChunkIds 交集非空（本模块派生，不信任外部
 *     传入的 passed 字段）；无 lastHits 或无期望 → 未跑过（—），不进分母。
 *   - 统计走 kb-core hitTestStats（命中率 null = 未跑，不是 0）；renderKbHitStats 单独
 *     导出，可脱离列表只渲染统计头。
 *   - pin 图标钮：置顶固定（渲染时 pinned 优先，稳定排序）；删除钮移除；两者均为本地
 *     状态变更（经 getCases/setCases 与宿主同步）。
 *   - 新增问题（Enter / 添加钮）→ 本地追加 + 派 icen:kb-hittest-add {question}。
 *   - 「运行全部」→ 派 icen:kb-hittest-run {}（onRun 双通道，回调携带当前 cases）；
 *     实际检索由宿主执行后 setCases 回填 lastHits。
 *   - SSR 下 no-op（stub 句柄）；同元素重复 create 幂等；destroy 摘监听并清空。
 * 渲染纪律：只写 textContent/createElement，禁 innerHTML；SVG 经 kb-core svgIcon 消毒。
 */

import { createIcon } from './icons';
import {
  h, svgIcon, hitTestStats, formatScore, formatPercent, type KbHitTestCase, type KbHitStats,
} from './kb-core';
import { emitIcen } from './events';
import { t } from './i18n';

/* ══════════════ 类型 ══════════════ */

/** createKbHitTest 配置项 */
export interface KbHitTestOpts {
  /** 初始用例集 */
  cases?: KbHitTestCase[];
  /** 「运行全部」回调（与 icen:kb-hittest-run 双通道；参数为携带派生 passed 的当前用例） */
  onRun?: (cases: KbHitTestCase[]) => void;
}

/** createKbHitTest 返回的可操作句柄 */
export interface KbHitTestHandle {
  /** 当前用例（深拷贝；passed 为交集派生值） */
  getCases(): KbHitTestCase[];
  /** 整体重设用例集并刷新列表与统计 */
  setCases(cases: KbHitTestCase[]): void;
  /** 触发运行全部（派 icen:kb-hittest-run + onRun） */
  run(): void;
  /** 销毁：摘除监听、清空装配内容、复位幂等标记 */
  destroy(): void;
}

interface MarkedHitTestEl extends HTMLElement {
  __icenKbHitTest?: KbHitTestHandle;
}

/* ══════════════ 常量与图标 ══════════════ */

/** 期望命中 chips 最多展示前 3 个（其余折进 +N） */
const EXPECTED_CHIP_LIMIT = 3;

const ICON_PIN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>';
const ICON_RUN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 4 14 8-14 8z"/></svg>';

let caseSeq = 0;

/* ══════════════ 工具 ══════════════ */

/** passed 派生：lastHits ∩ expectedChunkIds 非空；未跑或无期望 → undefined（不进分母） */
function derivePassed(c: KbHitTestCase): boolean | undefined {
  if (!c.lastHits?.length) return undefined;
  if (!c.expectedChunkIds?.length) return undefined;
  const expected = new Set(c.expectedChunkIds);
  return c.lastHits.some((hh) => expected.has(hh.chunkId));
}

function cloneCase(c: KbHitTestCase): KbHitTestCase {
  return {
    ...c,
    expectedChunkIds: c.expectedChunkIds ? [...c.expectedChunkIds] : undefined,
    lastHits: c.lastHits?.map((hh) => ({ ...hh })),
  };
}

function newCaseId(): string {
  return `kbht-${++caseSeq}-${Date.now().toString(36)}`;
}

/* ══════════════ 统计头（独立导出） ══════════════ */

/**
 * 快照渲染召回统计头：命中率大数字（.icen-kb-num）+ 均分 + 通过 x/y + 参数快照徽标
 * 「参数仅本次会话生效」。清空并填充宿主 el，返回统计容器；SSR 返回宿主 el。
 */
export function renderKbHitStats(el: HTMLElement, stats: KbHitStats): HTMLElement {
  if (typeof document === 'undefined' || !el) return el;
  el.textContent = '';
  const box = h('div', 'icen-kb-hittest-stats');

  const rate = h('div', 'icen-kb-hittest-stat kb-hittest-stat--rate');
  rate.append(
    h('span', 'icen-kb-hittest-stat-label', t('kbHittest.hitRate')),
    h('span', 'icen-kb-num icen-kb-hittest-hitrate', formatPercent(stats.hitRate)),
  );

  const avg = h('div', 'icen-kb-hittest-stat');
  avg.append(
    h('span', 'icen-kb-hittest-stat-label', t('kbHittest.avgScore')),
    h('span', 'icen-kb-num', formatScore(stats.avgScore)),
  );

  const pass = h('div', 'icen-kb-hittest-stat');
  pass.append(
    h('span', 'icen-kb-hittest-stat-label', t('kbHittest.pass')),
    h('span', 'icen-kb-num', `${stats.passed}/${stats.total}`),
  );

  const badge = h('span', 'icen-kb-badge', t('kbHittest.sessionOnly'));
  badge.title = t('kbHittest.sessionOnlyHint');

  box.append(rate, avg, pass, badge);
  el.appendChild(box);
  return box;
}

/* ══════════════ 工厂 ══════════════ */

/**
 * 装配召回测试集：问题列表（pin 置顶 / 期望命中 chips / 最近结果 ✓✗— / 删除）+
 * 新增问题输入 + 运行全部（派 icen:kb-hittest-run；新增派 icen:kb-hittest-add）。
 * 统计头经 renderKbHitStats 随用例集自动刷新。幂等；SSR 返回 stub；destroy 摘监听并清空。
 */
export function createKbHitTest(el: HTMLElement, opts: KbHitTestOpts = {}): KbHitTestHandle {
  if (typeof document === 'undefined' || !el) {
    const stub: KbHitTestHandle = {
      getCases: () => [], setCases: () => {}, run: () => {}, destroy: () => {},
    };
    return stub;
  }
  const marked = el as MarkedHitTestEl;
  if (marked.__icenKbHitTest) return marked.__icenKbHitTest;

  const ctrl = new AbortController();
  const listen = (target: EventTarget, type: string, fn: EventListener): void => {
    target.addEventListener(type, fn, { signal: ctrl.signal });
  };

  let cases: KbHitTestCase[] = (opts.cases ?? []).map(cloneCase);
  let destroyed = false;

  el.classList.add('icen-kb-hittest');
  el.dataset.kbHitTest = '';
  el.textContent = '';

  const statsBox = h('div', 'kb-hittest-stats-slot');
  const listBox = h('div', 'icen-kb-hittest-list');
  const input = h('input', 'icen-kb-hittest-input') as HTMLInputElement;
  input.type = 'text';
  input.placeholder = t('kbHittest.addPlaceholder');
  input.setAttribute('aria-label', t('kbHittest.addAria'));
  const addBtn = h('button', 'icen-kb-hittest-add-btn', t('common.add'));
  addBtn.type = 'button';
  const addRow = h('div', 'icen-kb-hittest-add');
  addRow.append(input, addBtn);
  const runBtn = h('button', 'icen-kb-run', t('kbHittest.runAll'));
  runBtn.type = 'button';
  const runIcon = svgIcon(ICON_RUN);
  if (runIcon) runBtn.prepend(runIcon);

  el.append(statsBox, listBox, addRow, runBtn);

  /* ── 渲染 ── */

  function orderedCases(): KbHitTestCase[] {
    return cases
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (a.c.pinned === b.c.pinned ? a.i - b.i : a.c.pinned ? -1 : 1))
      .map((x) => x.c);
  }

  function renderList(): void {
    listBox.textContent = '';
    if (!cases.length) {
      listBox.appendChild(h('div', 'icen-kb-empty', t('kbHittest.empty')));
      return;
    }
    for (const c of orderedCases()) {
      const passed = derivePassed(c);
      const row = h('div', 'icen-kb-hittest-row');
      if (passed === true) row.classList.add('is-pass');
      if (passed === false) row.classList.add('is-fail');

      const pin = h('button', 'icen-kb-hittest-pin');
      pin.type = 'button';
      pin.title = c.pinned ? t('kbHittest.unpin') : t('kbHittest.pin');
      pin.setAttribute('aria-label', pin.title);
      pin.setAttribute('aria-pressed', c.pinned ? 'true' : 'false');
      if (c.pinned) pin.classList.add('is-pinned');
      const pinIcon = svgIcon(ICON_PIN);
      if (pinIcon) pin.appendChild(pinIcon);
      pin.dataset.id = c.id;

      const q = h('span', 'icen-kb-hittest-q', c.question);

      const expected = h('span', 'icen-kb-hittest-expected');
      const ids = c.expectedChunkIds ?? [];
      for (const id of ids.slice(0, EXPECTED_CHIP_LIMIT)) {
        expected.appendChild(h('span', 'icen-kb-chip', id));
      }
      if (ids.length > EXPECTED_CHIP_LIMIT) {
        expected.appendChild(h('span', 'icen-kb-chip', `+${ids.length - EXPECTED_CHIP_LIMIT}`));
      }
      if (!ids.length) expected.appendChild(h('span', 'icen-kb-chip', t('kbHittest.noExpectation')));

      const result = h('span', 'icen-kb-hittest-result icen-kb-num', passed === undefined ? '—' : '');
      if (passed !== undefined) result.append(createIcon(passed ? 'check' : 'close')!);
      result.title = passed === undefined ? t('kbHittest.notRun') : passed ? t('kbHittest.expectHit') : t('kbHittest.expectMiss');

      result.setAttribute('role','img');
      result.setAttribute('aria-label',result.title);
      const remove = h('button', 'icen-kb-hittest-remove');
  remove.append(createIcon('close')!);
      remove.type = 'button';
      remove.title = t('kbHittest.deleteQuestion');
      remove.setAttribute('aria-label', t('kbHittest.deleteQuestion'));
      remove.dataset.id = c.id;

      row.append(pin, q, expected, result, remove);
      listBox.appendChild(row);
    }
  }

  function renderStats(): void {
    renderKbHitStats(statsBox, hitTestStats(cases.map((c) => ({ ...c, passed: derivePassed(c) }))));
  }

  function refresh(): void {
    renderList();
    renderStats();
  }

  /* ── 交互 ── */

  function addQuestion(): void {
    const question = input.value.trim();
    if (!question || destroyed) return;
    cases = [...cases, { id: newCaseId(), question }];
    input.value = '';
    refresh();
    emitIcen(el, 'icen:kb-hittest-add', { question });
  }

  listen(listBox, 'click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const pin = target.closest('.icen-kb-hittest-pin');
    if (pin instanceof HTMLButtonElement) {
      const c = cases.find((x) => x.id === pin.dataset.id);
      if (c) {
        c.pinned = !c.pinned;
        refresh();
      }
      return;
    }
    const remove = target.closest('.icen-kb-hittest-remove');
    if (remove instanceof HTMLButtonElement) {
      cases = cases.filter((x) => x.id !== remove.dataset.id);
      refresh();
    }
  });

  listen(input, 'keydown', (ev) => {
    const e = ev as KeyboardEvent;
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      addQuestion();
    }
  });
  listen(addBtn, 'click', () => addQuestion());
  listen(runBtn, 'click', () => handle.run());

  refresh();

  /* ── 句柄 ── */

  const handle: KbHitTestHandle = {
    getCases(): KbHitTestCase[] {
      return cases.map((c) => cloneCase({ ...c, passed: derivePassed(c) }));
    },
    setCases(next: KbHitTestCase[]): void {
      cases = (next ?? []).map(cloneCase);
      refresh();
    },
    run(): void {
      if (destroyed) return;
      emitIcen(el, 'icen:kb-hittest-run', {});
      opts.onRun?.(cases.map((c) => cloneCase({ ...c, passed: derivePassed(c) })));
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      ctrl.abort();
      el.classList.remove('icen-kb-hittest');
      delete el.dataset.kbHitTest;
      el.textContent = '';
      delete (el as MarkedHitTestEl).__icenKbHitTest;
    },
  };

  marked.__icenKbHitTest = handle;
  return handle;
}
