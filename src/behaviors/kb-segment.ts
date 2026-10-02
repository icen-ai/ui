/*
 * @icen.ai/ui — Behavior: kb-segment（分段策略表单 + 实时预览，与 components/kb-ingest.css 配套）
 *
 * DOM 契约（docs/spec/kb-family.md §5.7；数据契约 kb-core KbSegmentConfig / segmentText）：
 *   <div class="kb-segment">
 *     <div class="kb-segment-form">
 *       <div class="kb-segment-locked kb-notice" hidden>                 <!-- config.locked 时显示 -->
 *         lock svg 分段模式创建后不可更改，参数可随时调整
 *       </div>
 *       <label class="kb-field">
 *         <span class="kb-field-label">分段模式</span>
 *         <div class="kb-seg kb-segment-mode" role="radiogroup">        ← kb 域自持 segmented
 *           <button class="kb-seg-item [is-active]" role="radio" data-value="auto">自动</button>
 *           <button class="kb-seg-item" role="radio" data-value="custom">自定义</button>
 *           <button class="kb-seg-item" role="radio" data-value="parent-child">父子</button>
 *         </div>
 *       </label>
 *       <label class="kb-field">
 *         <span class="kb-field-label">分隔符</span>
 *         <input class="kb-input kb-input--mono kb-segment-delimiter" placeholder="\n\n">
 *       </label>
 *       <label class="kb-field">
 *         <span class="kb-field-label">最大长度</span>
 *         <input class="kb-input kb-segment-max" type="number" min="1">
 *       </label>
 *       <label class="kb-field">
 *         <span class="kb-field-label">重叠</span>
 *         <input class="kb-input kb-segment-overlap" type="number" min="0">
 *       </label>
 *       <div class="kb-segment-overlap-error kb-notice" hidden>重叠需小于最大长度</div>
 *       <div class="kb-segment-clean">                                    ← kb-core KB_CLEAN_OPTIONS 三勾选
 *         <label><input type="checkbox" value="collapse-blank">合并连续空行</label>
 *         <label><input type="checkbox" value="strip-url">去除链接</label>
 *         <label><input type="checkbox" value="strip-email">去除邮箱</label>
 *       </div>
 *       <div class="kb-segment-pc-notice kb-notice" hidden>子分段按长度自动生成</div>
 *     </div>
 *     <div class="kb-segment-preview">
 *       <div class="kb-segment-stats">
 *         <span class="kb-num">N 段</span><span class="kb-num">均长 x</span><span class="kb-num">≈y tokens</span>
 *       </div>
 *       <div class="kb-segment-blocks">
 *         <div class="kb-segment-block">
 *           <span class="kb-num kb-segment-block-no">01</span>
 *           <div class="kb-segment-block-text [is-open]">…（CSS 截断 200px，点击展开）</div>
 *         </div>…（前 20 段）
 *       </div>
 *       <div class="kb-segment-more kb-notice" hidden>共 N 段，仅预览前 20 段</div>
 *     </div>
 *   </div>
 *
 * 行为（createKbSegment 返回句柄 { getConfig, setConfig, refresh, destroy }）：
 *   - 左表单右预览双栏（≤720px 纵排，CSS）；预览走 kb-core segmentText 纯函数真实切分
 *     （非估算），segmentStats 三指标 + 前 20 段卡片（内容 200px 截断，点击整卡展开/收起）。
 *   - 任一表单变更：即时重算预览 + 派 icen:kb-segment-change { config }（自 el 根）+
 *     调 opts.onChange(config)（handle/事件双通道）。
 *   - locked（模式创建后锁定，Dify 纪律）：模式 segmented 禁用 + 顶部警示文案，
 *     其余参数（分隔符/长度/重叠/清洗）仍可随时调整。
 *   - 校验：重叠 ≥ 最大长度时给 .kb-segment-overlap-error 提示（不阻断预览：
 *     segmentText 内部对 overlap 自钳制，预览仍真实可用）。
 *   - parent-child 模式：提示「子分段按长度自动生成」（父段不再二次切分，见 kb-core）。
 *   - setConfig 为程序化赋值（同步表单 + 重算预览，不派事件）；getConfig 返回归一化副本。
 *   - 监听器直挂 el（AbortController 统一摘除）；SSR（无 document）下返回惰性句柄。
 */

import {
  h,
  normalizeSegmentConfig,
  segmentStats,
  segmentText,
  svgIcon,
  KB_CLEAN_OPTIONS,
  type KbCleanOption,
  type KbSegmentConfig,
} from './kb-core';
import { emitIcen } from './events';

/* ── 域内小工具 ── */

const svg = (d: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON_LOCK = svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>');

function icon(parent: HTMLElement, svgStr: string): void {
  const node = svgIcon(svgStr);
  if (node) parent.appendChild(node);
}

const MODES: Array<KbSegmentConfig['mode']> = ['auto', 'custom', 'parent-child'];
const MODE_LABELS: Record<KbSegmentConfig['mode'], string> = {
  auto: '自动',
  custom: '自定义',
  'parent-child': '父子',
};
const CLEAN_LABELS: Record<KbCleanOption, string> = {
  'collapse-blank': '合并连续空行',
  'strip-url': '去除链接',
  'strip-email': '去除邮箱',
};
const PREVIEW_LIMIT = 20;

/** createKbSegment 选项 */
export interface KbSegmentOpts {
  /** 初始分段配置（宽进：走 normalizeSegmentConfig 归一） */
  config?: Partial<KbSegmentConfig>;
  /** 预览样本文本（真实切分的素材） */
  sample?: string;
  /** 用户变更回调（与 icen:kb-segment-change 事件双通道） */
  onChange?: (config: KbSegmentConfig) => void;
}

/** createKbSegment 句柄 */
export interface KbSegmentHandle {
  /** 当前配置（归一化副本，调用方可安全改写） */
  getConfig(): KbSegmentConfig;
  /** 程序化赋值（合并 + 同步表单 + 重算预览；不派事件不触发 onChange） */
  setConfig(config: Partial<KbSegmentConfig>): void;
  /** 重算预览；给 sample 则同时更换样本 */
  refresh(sample?: string): void;
  /** 摘除全部监听（销毁后句柄方法仍可读写，但不再响应交互/派事件） */
  destroy(): void;
}

/* ── 构建 ── */

function buildModeSeg(cfg: KbSegmentConfig): HTMLElement {
  const seg = h('div', 'kb-seg kb-segment-mode');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', '分段模式');
  MODES.forEach((m) => {
    const item = h('button', `kb-seg-item kb-segment-mode-item${cfg.mode === m ? ' is-active' : ''}`);
    item.type = 'button';
    item.setAttribute('role', 'radio');
    item.setAttribute('aria-checked', String(cfg.mode === m));
    if (cfg.locked) item.disabled = true;
    item.dataset.value = m;
    item.textContent = MODE_LABELS[m];
    seg.appendChild(item);
  });
  return seg;
}

function buildCleanGroup(cfg: KbSegmentConfig): HTMLElement {
  const group = h('div', 'kb-segment-clean');
  KB_CLEAN_OPTIONS.forEach((opt) => {
    const label = h('label', 'kb-segment-clean-item');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = opt;
    cb.checked = cfg.clean.includes(opt);
    cb.dataset.kbSegmentClean = opt;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(CLEAN_LABELS[opt]));
    group.appendChild(label);
  });
  return group;
}

/* ── 句柄 ── */

/**
 * 挂载分段策略编辑器（左表单右预览）并返回句柄。
 * 表单任一用户变更 → 即时用 kb-core segmentText 真实切分重算预览，并
 * 派 icen:kb-segment-change { config } + 调 opts.onChange（双通道）。
 * SSR（无 document）下返回惰性句柄（getConfig 可用，DOM 操作 no-op）。
 */
export function createKbSegment(el: HTMLElement, opts?: KbSegmentOpts): KbSegmentHandle {
  const o = opts ?? {};
  let cfg = normalizeSegmentConfig(o.config);
  let sample = typeof o.sample === 'string' ? o.sample : '';
  let alive = true;

  /* SSR：无 DOM，只保留读写配置的惰性句柄 */
  if (typeof document === 'undefined') {
    return {
      getConfig: () => normalizeSegmentConfig(cfg),
      setConfig: (next) => { cfg = normalizeSegmentConfig({ ...cfg, ...next }); },
      refresh: () => undefined,
      destroy: () => undefined,
    };
  }

  const ac = new AbortController();
  const listen = (
    node: EventTarget,
    type: string,
    fn: (e: Event) => void,
  ): void => {
    node.addEventListener(type, fn, { signal: ac.signal });
  };

  el.textContent = '';
  el.classList.add('kb-segment-host');
  const root = h('div', 'kb-segment');

  /* ── 左：表单 ── */
  const form = h('div', 'kb-segment-form');

  const lockedNotice = h('div', 'kb-segment-locked kb-notice');
  icon(lockedNotice, ICON_LOCK);
  lockedNotice.appendChild(document.createTextNode('分段模式创建后不可更改，参数可随时调整'));
  if (!cfg.locked) lockedNotice.hidden = true;
  form.appendChild(lockedNotice);

  /* 模式字段用 div 而非 label：内含按钮组，label 会把文本点击转发给首个按钮 */
  const modeField = h('div', 'kb-field');
  modeField.appendChild(h('span', 'kb-field-label', '分段模式'));
  const modeSeg = buildModeSeg(cfg);
  modeField.appendChild(modeSeg);
  form.appendChild(modeField);

  const delimField = h('label', 'kb-field');
  delimField.appendChild(h('span', 'kb-field-label', '分隔符'));
  const delimInput = h('input', 'kb-input kb-input--mono kb-segment-delimiter');
  delimInput.type = 'text';
  delimInput.placeholder = '\\n\\n';
  delimInput.value = cfg.delimiter ?? '';
  delimInput.setAttribute('aria-label', '分段分隔符');
  delimField.appendChild(delimInput);
  form.appendChild(delimField);

  const maxField = h('label', 'kb-field');
  maxField.appendChild(h('span', 'kb-field-label', '最大长度'));
  const maxInput = h('input', 'kb-input kb-segment-max');
  maxInput.type = 'number';
  maxInput.min = '1';
  maxInput.step = '1';
  maxInput.value = String(cfg.maxLength);
  maxInput.setAttribute('aria-label', '分段最大长度');
  maxField.appendChild(maxInput);
  form.appendChild(maxField);

  const overlapField = h('label', 'kb-field');
  overlapField.appendChild(h('span', 'kb-field-label', '重叠'));
  const overlapInput = h('input', 'kb-input kb-segment-overlap');
  overlapInput.type = 'number';
  overlapInput.min = '0';
  overlapInput.step = '1';
  overlapInput.value = String(cfg.overlap);
  overlapInput.setAttribute('aria-label', '分段重叠');
  overlapField.appendChild(overlapInput);
  form.appendChild(overlapField);

  const overlapError = h('div', 'kb-segment-overlap-error kb-notice', '重叠需小于最大长度');
  overlapError.hidden = true;
  form.appendChild(overlapError);
  form.appendChild(buildCleanGroup(cfg));

  const pcNotice = h('div', 'kb-segment-pc-notice kb-notice', '子分段按长度自动生成');
  pcNotice.hidden = cfg.mode !== 'parent-child';
  form.appendChild(pcNotice);
  root.appendChild(form);

  /* ── 右：预览 ── */
  const preview = h('div', 'kb-segment-preview');
  const stats = h('div', 'kb-segment-stats');
  preview.appendChild(stats);
  const blocks = h('div', 'kb-segment-blocks');
  preview.appendChild(blocks);
  const more = h('div', 'kb-segment-more kb-notice');
  more.hidden = true;
  preview.appendChild(more);
  root.appendChild(preview);
  el.appendChild(root);

  /* ── 内部：表单 → cfg → 预览/事件 ── */

  const syncModeSeg = (): void => {
    modeSeg.querySelectorAll<HTMLElement>('.kb-segment-mode-item').forEach((it) => {
      const on = it.dataset.value === cfg.mode;
      it.classList.toggle('is-active', on);
      it.setAttribute('aria-checked', String(on));
    });
  };

  const syncForm = (): void => {
    syncModeSeg();
    delimInput.value = cfg.delimiter ?? '';
    maxInput.value = String(cfg.maxLength);
    overlapInput.value = String(cfg.overlap);
    modeSeg.querySelectorAll<HTMLInputElement>('[data-kb-segment-clean]').forEach((cb) => {
      cb.checked = cfg.clean.includes(cb.value as KbCleanOption);
    });
    pcNotice.hidden = cfg.mode !== 'parent-child';
  };

  const validate = (): void => {
    const invalid = cfg.overlap >= cfg.maxLength;
    overlapError.hidden = !invalid;
    overlapInput.setAttribute('aria-invalid', String(invalid));
  };

  const apply = (): void => {
    validate();
    refresh();
    if (!alive) return;
    emitIcen(el, 'icen:kb-segment-change', { config: normalizeSegmentConfig(cfg) });
    o.onChange?.(normalizeSegmentConfig(cfg));
  };

  const readForm = (): void => {
    const mode = modeSeg.querySelector<HTMLElement>('.kb-segment-mode-item.is-active')?.dataset.value;
    const delim = delimInput.value;
    const max = Math.floor(Number(maxInput.value));
    const overlap = Math.floor(Number(overlapInput.value));
    const clean = Array.from(
      form.querySelectorAll<HTMLInputElement>('[data-kb-segment-clean]:checked'),
    ).map((cb) => cb.value as KbCleanOption);
    cfg = normalizeSegmentConfig({
      mode: (mode === 'custom' || mode === 'parent-child' ? mode : 'auto'),
      delimiter: delim || undefined,
      maxLength: Number.isFinite(max) && max > 0 ? max : cfg.maxLength,
      overlap: Number.isFinite(overlap) && overlap >= 0 ? overlap : cfg.overlap,
      clean,
      locked: cfg.locked,
    });
  };

  /* 模式切换（locked 时按钮已 disabled，天然不触发） */
  listen(modeSeg, 'click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const item = t?.closest<HTMLElement>('.kb-segment-mode-item');
    if (!item || item.classList.contains('is-active')) return;
    readForm();
    cfg = normalizeSegmentConfig({ ...cfg, mode: item.dataset.value as KbSegmentConfig['mode'] });
    syncForm();
    apply();
  });
  listen(delimInput, 'input', () => { readForm(); apply(); });
  listen(maxInput, 'input', () => { readForm(); apply(); });
  listen(overlapInput, 'input', () => { readForm(); apply(); });
  form.querySelectorAll<HTMLInputElement>('[data-kb-segment-clean]').forEach((cb) => {
    listen(cb, 'change', () => { readForm(); apply(); });
  });

  /* 预览块点击展开/收起（200px 截断的渐进披露） */
  listen(blocks, 'click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const text = t?.closest<HTMLElement>('.kb-segment-block-text');
    if (text) text.classList.toggle('is-open');
  });

  /* ── 预览重算（segmentText 纯函数真实切分） ── */

  function refresh(nextSample?: string): void {
    if (typeof nextSample === 'string') sample = nextSample;
    stats.textContent = '';
    blocks.textContent = '';
    const segs = segmentText(sample, cfg);
    const st = segmentStats(segs);
    stats.appendChild(h('span', 'kb-num kb-segment-stat', `${st.count} 段`));
    stats.appendChild(h('span', 'kb-num kb-segment-stat', `均长 ${st.avgLength}`));
    stats.appendChild(h('span', 'kb-num kb-segment-stat', `≈${st.tokensEstimate} tokens`));
    segs.slice(0, PREVIEW_LIMIT).forEach((text, i) => {
      const block = h('div', 'kb-segment-block');
      block.appendChild(h('span', 'kb-num kb-segment-block-no', String(i + 1).padStart(2, '0')));
      const body = h('div', 'kb-segment-block-text', text);
      body.title = '点击展开/收起';
      block.appendChild(body);
      blocks.appendChild(block);
    });
    if (!segs.length) blocks.appendChild(h('div', 'kb-empty', '样本为空，暂无可预览分段'));
    more.textContent = segs.length > PREVIEW_LIMIT ? `共 ${segs.length} 段，仅预览前 ${PREVIEW_LIMIT} 段` : '';
    more.hidden = segs.length <= PREVIEW_LIMIT;
  }

  /* 初始预览（不派事件） */
  validate();
  refresh();

  return {
    getConfig(): KbSegmentConfig {
      return normalizeSegmentConfig(cfg);
    },
    setConfig(next: Partial<KbSegmentConfig>): void {
      cfg = normalizeSegmentConfig({ ...cfg, ...next });
      if (typeof document === 'undefined') return;
      syncForm();
      validate();
      refresh();
    },
    refresh,
    destroy(): void {
      alive = false;
      ac.abort();
    },
  };
}
