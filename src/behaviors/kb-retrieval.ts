/*
 * @icen.ai/ui — Behavior: kb-retrieval（检索 playground，与 components/kb-search.css 配套）
 *
 * DOM 契约（create 装配，规格 docs/spec/kb-family.md §5.11）：
 *   <div class="kb-retrieval" data-kb-retrieval [.is-busy]>
 *     <div class="kb-retrieval-bar">
 *       <input class="kb-retrieval-query" placeholder="检索问题，Enter 运行" />
 *       <div class="kb-modes" role="radiogroup" aria-label="检索模式">
 *         <button class="kb-mode-item [.is-active]" role="radio" data-mode="vector|keyword|hybrid">…</button>×3
 *       </div>
 *       <div class="kb-step"><button class="kb-step-btn" data-step="-1">−</button>
 *         <span class="kb-step-value kb-num">5</span><button class="kb-step-btn" data-step="1">+</button></div>
 *       <div class="kb-alpha">
 *         <span class="kb-alpha-end" title="语义：跨语言/无精确词">语义 0.60（随动回显）</span>
 *         <input class="kb-range kb-alpha-range" type="range" min="0" max="1" step="0.05" />
 *         <span class="kb-alpha-end" title="关键词：大库快速精确">关键词</span>
 *       </div>
 *       <span class="kb-toggle"><button class="kb-switch" role="switch" aria-checked></button><span>重排</span></span>
 *       <div class="kb-threshold [.is-off]">
 *         <input class="kb-range kb-threshold-range" type="range" min="0" max="1" step="0.05" />
 *         <span class="kb-threshold-count kb-meta">阈值 0.50 · 存活 3（只显示授权集合内计数，
 *           不显示「/总数」分母——spec §9.7 计数安全化）</span>
 *       </div>
 *       [<span class="kb-retrieval-idn-group"><span class="kb-meta">身份</span>
 *         <select class="kb-retrieval-idn">…opts.identities…</select></span>]   ← 权限域增强（§9.7）：
 *           固定身份集给定才渲染；身份不变更检索逻辑，只派 icen:kb-visibility-identity {identity} + 回显
 *       <button class="kb-run">运行</button>                ← 全栏唯一 accent
 *       <button class="kb-chip kb-layer-chip" data-layer="pre|post|none">pre ✓</button>
 *         ← 权限域增强：过滤层徽标三态循环（默认 pre）；none/post 时 bar 下方渲染 .kb-notice 警示
 *       [<span class="kb-badge kb-badge--admin">admin</span>]  ← admin && aclOf 才渲染（§9.7；缺省零权限噪音）
 *     </div>
 *     [<div class="kb-notice" hidden>过滤层警示（仅 none/post）</div>]
 *     <div class="kb-params"><button class="kb-params-copy">…svg…</button>
 *       <code class="kb-params-text kb-meta">{…可复制参数 JSON…}</code></div>
 *     <div class="kb-hits">
 *       <div class="kb-hit">
 *         <div class="kb-hit-rank kb-num">1</div>
 *         <div class="kb-hit-main">
 *           <div class="kb-hit-title">…</div>
 *           <div class="kb-hit-snippet">…<mark data-hit="0|1|2">命中</mark>…</div>
 *           <div class="kb-hit-meta"><span class="kb-chip">…</span>…</div>
 *         </div>
 *         <div class="kb-hit-side">
 *           <span class="kb-score">[<span class="kb-score-bar"><i style="width:%"></i></span>]<span class="kb-score-value">…</span></span>
 *           <span class="kb-chip kb-chip--kind">cosine</span>          ← scoreKind 必须显示
 *           [<span class="kb-score-dual"><i></i><i></i></span>]        ← vectorPart/keywordPart 微型双段条
 *           [<button class="kb-hit-explain-toggle" aria-expanded="false">拆解</button><div class="kb-hit-explain" hidden>…</div>]
 *         </div>
 *       </div>…
 *       [<div class="kb-empty">…空态…</div>]
 *     </div>
 *   </div>
 *
 * 行为：
 *   - Enter（IME 组合态安全）或「运行」→ 组装 KbRetrievalQuery（query + params）派
 *     icen:kb-retrieval-run {query}，并回调 opts.onRun；运行是全栏唯一 accent（spec §1.1）。
 *   - 模式切换联动：alpha 滑杆仅在混合模式可用，其余模式显式禁用不隐藏（Dify 纪律）；
 *     阈值滑杆仅在重排开启时可用，关闭时显示 N/A（显式禁用不隐藏）。
 *   - 阈值滑杆与「存活 N 条」计数联动：阈值过滤在本端预览（对当前 hits 按 scoreKind
 *     方向归一后计数；score null 的命中在任意正阈值下不存活——诚实呈现边界）。
 *     计数安全化（spec §9.7）：只显示「存活 N」授权集合内语义，不显示「/总数」分母——
 *     未过滤前计数属 volume leakage（spec §9.0-5），title 注记说明；admin 审计对照用 kb-visibility。
 *   - 权限域增强（spec §9.7）：opts.identities 给定 → 「检索身份」select（身份不变更检索
 *     逻辑，只派 icen:kb-visibility-identity {identity} 与回显）；过滤层徽标三态循环
 *     pre（默认，安全基线）→ post（缺陷层演示）→ none（fail-open，Kendra 教训），后两者
 *     bar 下方渲染 .kb-notice 警示；opts.admin && opts.aclOf → hit 行尾附 visibility chip +
 *     bar 附 admin badge（缺省全不渲染——普通用户零权限噪音）。
 *   - renderHits：query 分词高亮（空白分词，多词 data-hit 0|1|2 轮转分色）；score null
 *     → 不渲染条 + 值「—」；scoreKind 必显 chip；vectorPart/keywordPart → 微型双段条；
 *     explain → 折叠小字（点击展开，aria-expanded）。
 *   - 参数行：.kb-meta mono 的可复制 JSON（点击复制钮，clipboard API + execCommand 兜底）。
 *   - SSR 下 no-op（返回 stub 句柄）；同一元素重复 create 幂等（返回既有句柄）；
 *     destroy() 摘除全部监听（AbortController）并清空装配内容。
 * 渲染纪律：只写 textContent/createElement，禁 innerHTML；SVG 一律经 kb-core svgIcon 消毒。
 */

import {
  h, svgIcon, normalizeHit, normalizeIdentity, normalizeRetrievalParams, formatScore, scorePercent,
  kbVisibilityLabel,
  type KbIdentity, KbRetrievalHit, KbRetrievalParams, KbRetrievalQuery, KbVisibility,
} from './kb-core';
import { emitIcen } from './events';

/* ══════════════ 类型 ══════════════ */

/** createKbRetrieval 配置项 */
export interface KbRetrievalOpts {
  /** 初始检索参数（宽进严出：走 normalizeRetrievalParams） */
  params?: Partial<KbRetrievalParams>;
  /** 运行回调（与 icen:kb-retrieval-run 事件双通道） */
  onRun?: (query: KbRetrievalQuery) => void;
  /** 分数归一上限（阈值存活计数用；默认 1，即 0–1 分数域） */
  thresholdMax?: number;
  /** 检索身份（权限域增强 spec §9.7）：固定身份集给定时渲染「检索身份」select。
   *  身份不变更检索逻辑（mock 不重算），只派 icen:kb-visibility-identity {identity}
   *  （权限域共用事件）并回显——固定身份集纪律见 spec §9.0-8（不接受自由输入身份） */
  identities?: KbIdentity[];
  /** admin 审计模式：与 aclOf 同时给定时 hit 行尾附 visibility chip、bar 附 admin badge（缺省全不渲染） */
  admin?: boolean;
  /** admin 模式下的逐命中可见性求值（宿主接权限数据；组件只做呈现，不做安全边界） */
  aclOf?: (hit: KbRetrievalHit) => KbVisibility;
  /** 过滤层徽标初值（默认 'pre' 安全基线；点击循环 pre→post→none，后两者 bar 下方渲染警示 notice） */
  layer?: 'pre' | 'post' | 'none';
}

/** createKbRetrieval 返回的可操作句柄 */
export interface KbRetrievalHandle {
  /** 当前参数（归一副本，改动不影响内部状态） */
  getParams(): KbRetrievalParams;
  /** 合并式更新参数并同步参数栏与存活计数 */
  setParams(patch: Partial<KbRetrievalParams>): void;
  /** 快照渲染命中列表（query 分词高亮 + 分数纪律） */
  renderHits(hits: KbRetrievalHit[]): void;
  /** 运行态切换（运行钮禁用 + 文案「运行中…」+ .is-busy） */
  setBusy(busy: boolean): void;
  /** 设置阈值（null = 不启用；同步滑杆与存活计数） */
  setThreshold(threshold: number | null): void;
  /** 当前过滤层（权限域增强：pre 安全基线 / post 缺陷层 / none fail-open） */
  getFilterLayer(): 'pre' | 'post' | 'none';
  /** 设置过滤层（内部重渲染徽标与 notice，派 icen:kb-visibility-layer {layer}） */
  setFilterLayer(l: 'pre' | 'post' | 'none'): void;
  /** 销毁：摘除监听、清空装配内容、复位幂等标记 */
  destroy(): void;
}

interface MarkedRetrievalEl extends HTMLElement {
  __icenKbRetrieval?: KbRetrievalHandle;
}

/* ══════════════ 常量与图标 ══════════════ */

const MODES: ReadonlyArray<readonly ['vector' | 'keyword' | 'hybrid', string]> = [
  ['vector', '向量'],
  ['keyword', '关键词'],
  ['hybrid', '混合'],
];

const TOP_K_MIN = 1;
const TOP_K_MAX = 50;
/** query 分词高亮最多取前 6 个词（长 query 防过度标记） */
const HIGHLIGHT_TERM_LIMIT = 6;

const ICON_RUN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 4 14 8-14 8z"/></svg>';
const ICON_COPY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

/* 过滤层三态（权限域增强 spec §9.7；语义与 kb-visibility 的对照器一致，事件共用） */
type RetrievalLayer = 'pre' | 'post' | 'none';

const LAYER_ORDER: readonly RetrievalLayer[] = ['pre', 'post', 'none'];

const LAYER_LABEL: Record<RetrievalLayer, string> = { pre: 'pre ✓', post: 'post ⚠', none: 'none ✕' };

const LAYER_TITLE: Record<RetrievalLayer, string> = {
  pre: 'pre-filter：ACL 在检索执行体内生效——安全基线',
  post: 'post-filter：分数已可观察——缺陷层，仅演示',
  none: 'none：fail-open，无身份过滤返回全部——危险，仅演示',
};

/** stub 句柄（SSR / 非法宿主时返回，接口完整可用但无副作用） */
const stubHandle = (): KbRetrievalHandle => ({
  getParams: () => normalizeRetrievalParams(),
  setParams: () => {},
  renderHits: () => {},
  setBusy: () => {},
  setThreshold: () => {},
  getFilterLayer: () => 'pre',
  setFilterLayer: () => {},
  destroy: () => {},
});

/* ══════════════ 工具 ══════════════ */

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** query 空白分词（拉丁词 ≥2 字符、CJK 单字也计入；去重去空，限量） */
function tokenizeQuery(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of query.trim().split(/\s+/)) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    if (t.length < 2 && !/[\u4e00-\u9fff]/.test(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= HIGHLIGHT_TERM_LIMIT) break;
  }
  return out;
}

/** 文本 → 带 <mark data-hit> 的节点流（多词轮转 3 色；只建 Text/mark，不碰 innerHTML） */
function highlightTerms(text: string, terms: string[]): Node[] {
  let nodes: Node[] = [document.createTextNode(text)];
  for (let ti = 0; ti < terms.length; ti++) {
    const re = new RegExp(escapeRe(terms[ti]), 'gi');
    const next: Node[] = [];
    for (const node of nodes) {
      if (!(node instanceof Text)) { next.push(node); continue; }
      const seg = node.data;
      let last = 0;
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(seg)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        if (m.index > last) next.push(document.createTextNode(seg.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.dataset.hit = String(ti % 3);
        mark.textContent = m[0];
        next.push(mark);
        last = m.index + m[0].length;
      }
      if (last < seg.length) next.push(document.createTextNode(seg.slice(last)));
    }
    nodes = next;
  }
  return nodes;
}

function copyText(text: string): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ══════════════ 工厂 ══════════════ */

/**
 * 装配检索 playground：参数栏（query/模式/topK/alpha/重排/阈值/运行）+ 可复制参数 JSON
 * 行 + 命中列表。运行派 icen:kb-retrieval-run {query}（onRun 双通道）；阈值存活数本端
 * 预览。幂等（同元素返回既有句柄）；SSR 返回 stub；destroy 摘监听并清空。
 */
export function createKbRetrieval(el: HTMLElement, opts: KbRetrievalOpts = {}): KbRetrievalHandle {
  if (typeof document === 'undefined' || !el) return stubHandle();
  const marked = el as MarkedRetrievalEl;
  if (marked.__icenKbRetrieval) return marked.__icenKbRetrieval;

  const ctrl = new AbortController();
  const listen = (
    target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, fn, { ...options, signal: ctrl.signal });
  };

  let params = normalizeRetrievalParams(opts.params);
  const thresholdMax = typeof opts.thresholdMax === 'number' && opts.thresholdMax > 0 ? opts.thresholdMax : 1;
  let hits: KbRetrievalHit[] = [];
  let busy = false;
  let destroyed = false;
  /** 阈值滑杆的原始值（0 = 不启用；getParams 时投影为 params.threshold） */
  let thresholdValue = params.threshold ?? 0;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  /* ── 权限域增强状态（spec §9.7）── */

  /** 过滤层三态：pre 默认（安全基线）→ post（缺陷层演示）→ none（fail-open） */
  let layer: RetrievalLayer = opts.layer === 'post' || opts.layer === 'none' ? opts.layer : 'pre';
  /** 固定身份集（normalize 后；opts.identities 缺省/空 → 不渲染身份控件） */
  const idnList = (Array.isArray(opts.identities) ? opts.identities : [])
    .map(normalizeIdentity)
    .filter((i) => i.user || i.label);
  /** admin 审计模式：admin && aclOf 同时给定才逐 hit 呈现 visibility chip（缺省零权限噪音） */
  const adminAcl = opts.admin === true && typeof opts.aclOf === 'function' ? opts.aclOf : null;

  /* ── 参数栏装配 ── */

  el.classList.add('kb-retrieval');
  el.dataset.kbRetrieval = '';
  el.textContent = '';

  const bar = h('div', 'kb-retrieval-bar');

  const queryInput = h('input', 'kb-retrieval-query') as HTMLInputElement;
  queryInput.type = 'text';
  queryInput.placeholder = '检索问题，Enter 运行';
  queryInput.setAttribute('aria-label', '检索问题');

  const modes = h('div', 'kb-modes');
  modes.role = 'radiogroup';
  modes.setAttribute('aria-label', '检索模式');
  const modeButtons = new Map<string, HTMLButtonElement>();
  for (const [mode, label] of MODES) {
    const btn = h('button', 'kb-mode-item', label);
    btn.type = 'button';
    btn.dataset.mode = mode;
    btn.role = 'radio';
    modes.appendChild(btn);
    modeButtons.set(mode, btn);
  }

  const topKDown = h('button', 'kb-step-btn', '−');
  topKDown.type = 'button';
  topKDown.dataset.step = '-1';
  topKDown.setAttribute('aria-label', '减少 topK');
  const topKValue = h('span', 'kb-step-value kb-num');
  const topKUp = h('button', 'kb-step-btn', '+');
  topKUp.type = 'button';
  topKUp.dataset.step = '1';
  topKUp.setAttribute('aria-label', '增加 topK');
  const step = h('div', 'kb-step');
  step.append(topKDown, topKValue, topKUp);
  const stepLabel = h('span', 'kb-step-label kb-meta', 'topK');
  step.setAttribute('aria-label', 'topK');

  const alphaEndL = h('span', 'kb-alpha-end', '语义');
  alphaEndL.title = '语义：跨语言/无精确词';
  const alphaRange = h('input', 'kb-range kb-alpha-range') as HTMLInputElement;
  alphaRange.type = 'range';
  alphaRange.min = '0';
  alphaRange.max = '1';
  alphaRange.step = '0.05';
  alphaRange.setAttribute('aria-label', '混合权重（左语义右关键词）');
  const alphaEndR = h('span', 'kb-alpha-end', '关键词');
  alphaEndR.title = '关键词：大库快速精确';
  const alpha = h('div', 'kb-alpha');
  alpha.append(alphaEndL, alphaRange, alphaEndR);

  const rerankSwitch = h('button', 'kb-switch');
  rerankSwitch.type = 'button';
  rerankSwitch.role = 'switch';
  rerankSwitch.setAttribute('aria-label', '重排');
  const rerankText = h('span', 'kb-toggle-label', '重排');
  const rerankToggle = h('span', 'kb-toggle');
  rerankToggle.append(rerankSwitch, rerankText);

  const thresholdRange = h('input', 'kb-range kb-threshold-range') as HTMLInputElement;
  thresholdRange.type = 'range';
  thresholdRange.min = '0';
  thresholdRange.max = '1';
  thresholdRange.step = '0.05';
  thresholdRange.setAttribute('aria-label', '分数阈值');
  const thresholdCount = h('span', 'kb-threshold-count kb-meta');
  const threshold = h('div', 'kb-threshold');
  threshold.append(thresholdRange, thresholdCount);

  const runBtn = h('button', 'kb-run', '运行');
  runBtn.type = 'button';
  const runIcon = svgIcon(ICON_RUN);
  if (runIcon) runBtn.prepend(runIcon);

  /* ── 检索身份控件（权限域增强 §9.7）：固定身份集给定时才渲染；身份不变更检索逻辑 ── */
  let idnSelect: HTMLSelectElement | null = null;
  let idnGroup: HTMLElement | null = null;
  if (idnList.length) {
    idnSelect = h('select', 'kb-retrieval-idn');
    idnSelect.setAttribute('aria-label', '检索身份');
    for (const idn of idnList) {
      const opt = h('option', undefined, idn.label ?? idn.user);
      opt.value = idn.user;
      idnSelect.appendChild(opt);
    }
    idnGroup = h('span', 'kb-retrieval-idn-group');
    idnGroup.append(h('span', 'kb-meta', '身份'), idnSelect);
  }

  /* ── 过滤层徽标（权限域增强 §9.7）：bar 尾部，点击循环三态 ── */
  const layerChip = h('button', 'kb-chip kb-layer-chip');
  layerChip.type = 'button';
  layerChip.setAttribute('aria-label', '过滤层');
  const paintLayer = (): void => {
    layerChip.dataset.layer = layer;
    layerChip.textContent = LAYER_LABEL[layer];
    layerChip.title = LAYER_TITLE[layer];
  };
  paintLayer();

  /* ── admin 徽标（§9.7）：admin && aclOf 时才附（普通用户零权限噪音） ── */
  const adminBadge = adminAcl ? h('span', 'kb-badge kb-badge--admin', 'admin') : null;

  bar.append(queryInput, modes, stepLabel, step, alpha, rerankToggle, threshold);
  if (idnGroup) bar.appendChild(idnGroup);
  bar.append(runBtn, layerChip);
  if (adminBadge) bar.appendChild(adminBadge);

  /* ── 参数 JSON 行（DSL 双表示纪律：可复制） ── */

  const paramsText = h('code', 'kb-params-text kb-meta');
  const paramsCopy = h('button', 'kb-params-copy');
  paramsCopy.type = 'button';
  paramsCopy.title = '复制参数 JSON';
  paramsCopy.setAttribute('aria-label', '复制参数 JSON');
  const copyIcon = svgIcon(ICON_COPY);
  if (copyIcon) paramsCopy.appendChild(copyIcon);
  const paramsRow = h('div', 'kb-params');
  paramsRow.append(paramsCopy, paramsText);

  /* ── 过滤层警示 notice（权限域增强 §9.7）：仅 none/post 渲染文案，pre 隐藏 ── */

  const layerNotice = h('div', 'kb-notice');
  layerNotice.hidden = true;
  const paintLayerNotice = (): void => {
    if (layer === 'none') {
      layerNotice.textContent = 'fail-open：当前查询未携带身份过滤，将返回全部候选（仅限调试）';
      layerNotice.hidden = false;
    } else if (layer === 'post') {
      layerNotice.textContent = 'post-filter：分数已在过滤前产生（缺陷层演示）';
      layerNotice.hidden = false;
    } else {
      layerNotice.textContent = '';
      layerNotice.hidden = true;
    }
  };
  paintLayerNotice();

  /* ── 命中列表容器 ── */

  const hitsBox = h('div', 'kb-hits');

  el.append(bar, layerNotice, paramsRow, hitsBox);

  /* ── 状态投影 ── */

  function currentQueryText(): string {
    return queryInput.value.trim();
  }

  /** 阈值投影纪律：rerank 关闭或滑杆为 0 → null（不启用） */
  function projectThreshold(): number | null {
    return params.rerank && thresholdValue > 0 ? thresholdValue : null;
  }

  function buildQueryObject(): KbRetrievalQuery {
    const p: KbRetrievalParams = { ...params, threshold: projectThreshold() };
    return { query: currentQueryText(), params: p };
  }

  function syncBar(): void {
    for (const [mode, btn] of modeButtons) {
      const active = mode === params.mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    }
    topKValue.textContent = String(params.topK);
    /* alpha 仅混合模式可用：显式禁用不隐藏（Dify 纪律）；左端 label 随动回显当前值 */
    const alphaOn = params.mode === 'hybrid';
    alphaRange.disabled = !alphaOn;
    alphaRange.value = String(params.alpha ?? 0.5);
    alphaEndL.textContent = `语义 ${(params.alpha ?? 0.5).toFixed(2)}`;
    alpha.classList.toggle('is-off', !alphaOn);
    /* 阈值仅重排开启时可用：关闭显示 N/A（显式禁用不隐藏） */
    rerankSwitch.setAttribute('aria-checked', params.rerank ? 'true' : 'false');
    thresholdRange.disabled = !params.rerank;
    thresholdRange.value = String(thresholdValue);
    threshold.classList.toggle('is-off', !params.rerank);
  }

  function updateSurvival(): void {
    /* 计数安全化（spec §9.7）：只显示授权集合内的「存活 N」，不显示「/总数」差值分母——
       未过滤前计数属 volume leakage（spec §9.0-5，唯一允许的裁剪提示是与命中无关的恒定文案）；
       分母对照属 admin 审计语义，请用 kb-visibility 对照器 */
    thresholdCount.title = '分母未过滤前计数属泄露，不显示';
    if (!params.rerank) {
      thresholdCount.textContent = '阈值 N/A'; /* rerank 关闭时阈值无效（显式禁用不隐藏，保持原逻辑） */
      return;
    }
    const t = thresholdValue;
    if (!(t > 0)) {
      thresholdCount.textContent = `阈值 关 · 存活 ${hits.length}`;
      return;
    }
    let alive = 0;
    for (const hit of hits) {
      const pct = scorePercent(hit.score, hit.scoreKind, thresholdMax);
      if (pct != null && pct >= t * 100 - 1e-9) alive++;
    }
    /* 阈值与存活同一行内联：关系一目了然 */
    thresholdCount.textContent = `阈值 ${t.toFixed(2)} · 存活 ${alive}`;
  }

  function updateParamsLine(): void {
    const q = buildQueryObject();
    paramsText.textContent = JSON.stringify(q);
  }

  function refreshDerived(): void {
    syncBar();
    updateParamsLine();
    updateSurvival();
  }

  /* ── 命中渲染 ── */

  function renderScoreSide(hit: KbRetrievalHit, side: HTMLElement): void {
    const score = h('span', 'kb-score');
    const pct = scorePercent(hit.score, hit.scoreKind, thresholdMax);
    if (pct != null) {
      const barEl = h('span', 'kb-score-bar');
      const fill = h('i');
      fill.style.width = `${pct.toFixed(1)}%`;
      barEl.appendChild(fill);
      score.appendChild(barEl);
    }
    const value = h('span', 'kb-score-value', formatScore(hit.score));
    score.appendChild(value);
    side.appendChild(score);

    /* scoreKind 必须显示（chip；未标注也要诚实标出） */
    const kind = h('span', 'kb-chip kb-chip--kind', hit.scoreKind ?? '未标');
    side.appendChild(kind);

    /* 微型双段条：向量占比 × 关键词占比 */
    if (hit.vectorPart != null && hit.keywordPart != null) {
      const dual = h('span', 'kb-score-dual');
      const vec = h('i', 'kb-score-dual-vec');
      const kw = h('i', 'kb-score-dual-kw');
      const sum = hit.vectorPart + hit.keywordPart;
      const vecPct = sum > 0 ? (hit.vectorPart / sum) * 100 : 50;
      vec.style.width = `${Math.max(0, Math.min(100, vecPct)).toFixed(1)}%`;
      kw.style.flex = '1 1 auto';
      dual.append(vec, kw);
      dual.title = `向量 ${(vecPct).toFixed(0)}% / 关键词 ${(100 - vecPct).toFixed(0)}%`;
      side.appendChild(dual);
    }

    /* explain → 折叠小字 */
    if (hit.explain) {
      const fold = h('div', 'kb-hit-explain-fold');
      const toggle = h('button', 'kb-hit-explain-toggle', '拆解');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      const body = h('div', 'kb-hit-explain kb-meta', hit.explain);
      body.hidden = true;
      fold.append(toggle, body);
      side.appendChild(fold);
    }
  }

  function renderMetaChips(hit: KbRetrievalHit, box: HTMLElement): void {
    if (hit.page != null) box.appendChild(h('span', 'kb-chip', `第 ${hit.page} 页`));
    if (hit.documentId) box.appendChild(h('span', 'kb-chip', hit.documentId));
    if (hit.meta) {
      for (const [k, v] of Object.entries(hit.meta).slice(0, 4)) {
        box.appendChild(h('span', 'kb-chip', `${k}: ${String(v)}`));
      }
    }
  }

  function renderHitRow(hit: KbRetrievalHit, index: number): HTMLElement {
    const row = h('div', 'kb-hit');
    const rank = h('div', 'kb-hit-rank kb-num', String(index + 1));
    const main = h('div', 'kb-hit-main');
    const title = h('div', 'kb-hit-title', hit.title ?? hit.documentId ?? hit.chunkId);
    const snippet = h('div', 'kb-hit-snippet');
    for (const node of highlightTerms(hit.snippet ?? '', tokenizeQuery(currentQueryText()))) {
      snippet.appendChild(node);
    }
    const metaBox = h('div', 'kb-hit-meta');
    renderMetaChips(hit, metaBox);
    main.append(title, snippet, metaBox);
    const side = h('div', 'kb-hit-side');
    renderScoreSide(hit, side);
    /* admin 审计模式（§9.7）：行尾 visibility chip——admin && aclOf 才渲染，缺省零权限噪音 */
    if (adminAcl) side.appendChild(h('span', 'kb-chip', kbVisibilityLabel(adminAcl(hit))));
    row.append(rank, main, side);
    return row;
  }

  function renderEmpty(): void {
    const empty = h('div', 'kb-empty', '输入问题并运行，命中结果将出现在这里');
    hitsBox.appendChild(empty);
  }

  /* ── 交互 ── */

  function run(): void {
    if (busy || destroyed) return;
    const query = buildQueryObject();
    emitIcen(el, 'icen:kb-retrieval-run', { query });
    opts.onRun?.(query);
  }

  listen(queryInput, 'input', () => {
    updateParamsLine();
    /* query 变化不影响已渲染 hit 的高亮（快照纪律：下次 renderHits 重新分词） */
  });
  listen(queryInput, 'keydown', (ev) => {
    const e = ev as KeyboardEvent;
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      run();
    }
  });

  listen(modes, 'click', (ev) => {
    const btn = (ev.target as Element | null)?.closest?.('.kb-mode-item');
    if (!(btn instanceof HTMLButtonElement) || btn.disabled) return;
    const mode = btn.dataset.mode as KbRetrievalParams['mode'];
    if (!mode || mode === params.mode) return;
    params = normalizeRetrievalParams({ ...params, mode });
    refreshDerived();
  });

  listen(step, 'click', (ev) => {
    const btn = (ev.target as Element | null)?.closest?.('.kb-step-btn');
    if (!(btn instanceof HTMLButtonElement) || btn.disabled) return;
    const dir = Number(btn.dataset.step) || 0;
    if (!dir) return;
    const next = Math.max(TOP_K_MIN, Math.min(TOP_K_MAX, params.topK + dir));
    if (next === params.topK) return;
    params = normalizeRetrievalParams({ ...params, topK: next });
    refreshDerived();
  });

  listen(alphaRange, 'input', () => {
    params = normalizeRetrievalParams({ ...params, alpha: Number(alphaRange.value) });
    refreshDerived();
  });

  listen(rerankSwitch, 'click', () => {
    params = normalizeRetrievalParams({ ...params, rerank: !params.rerank });
    refreshDerived();
  });

  listen(thresholdRange, 'input', () => {
    thresholdValue = Number(thresholdRange.value);
    updateSurvival();
    updateParamsLine();
  });

  listen(runBtn, 'click', () => run());

  /* ── 权限域增强交互（§9.7）── */

  /** 过滤层变更：重绘徽标 + notice，并派 icen:kb-visibility-layer {layer}（权限域共用事件） */
  function applyLayer(next: RetrievalLayer): void {
    if (destroyed || next === layer) return;
    layer = next;
    paintLayer();
    paintLayerNotice();
    emitIcen(el, 'icen:kb-visibility-layer', { layer });
  }

  listen(layerChip, 'click', () => {
    const idx = LAYER_ORDER.indexOf(layer);
    applyLayer(LAYER_ORDER[(idx + 1) % LAYER_ORDER.length]!); /* pre→post→none 循环 */
  });

  /* 检索身份：不变更检索逻辑（mock 不重算），只派 icen:kb-visibility-identity {identity}
     （权限域共用事件）并由原生 select 回显当前身份 */
  if (idnSelect) {
    const select = idnSelect;
    listen(select, 'change', () => {
      const identity = idnList.find((i) => i.user === select.value);
      if (identity) emitIcen(el, 'icen:kb-visibility-identity', { identity });
    });
  }

  listen(hitsBox, 'click', (ev) => {
    const btn = (ev.target as Element | null)?.closest?.('.kb-hit-explain-toggle');
    if (!(btn instanceof HTMLButtonElement)) return;
    const body = btn.parentElement?.querySelector('.kb-hit-explain');
    if (!body) return;
    const open = body.hasAttribute('hidden');
    body.toggleAttribute('hidden', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  listen(paramsCopy, 'click', () => {
    if (destroyed) return;
    const ok = copyText(paramsText.textContent ?? '');
    if (ok) {
      paramsCopy.classList.add('is-copied');
      paramsCopy.title = '已复制';
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        if (destroyed) return;
        paramsCopy.classList.remove('is-copied');
        paramsCopy.title = '复制参数 JSON';
      }, 1200);
    }
  });

  /* ── 句柄 ── */

  const handle: KbRetrievalHandle = {
    getParams(): KbRetrievalParams {
      return normalizeRetrievalParams({ ...params, threshold: projectThreshold() });
    },
    setParams(patch: Partial<KbRetrievalParams>): void {
      params = normalizeRetrievalParams({ ...params, ...patch });
      thresholdValue = params.threshold ?? thresholdValue;
      refreshDerived();
    },
    renderHits(next: KbRetrievalHit[]): void {
      hits = next
        .map((hit) => normalizeHit(hit as unknown as Record<string, unknown>))
        .filter((hit) => hit.chunkId || hit.snippet);
      hitsBox.textContent = '';
      if (!hits.length) renderEmpty();
      else for (let i = 0; i < hits.length; i++) hitsBox.appendChild(renderHitRow(hits[i]!, i));
      updateSurvival();
    },
    setBusy(next: boolean): void {
      busy = next && !destroyed;
      el.classList.toggle('is-busy', busy);
      runBtn.disabled = busy;
      runBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
      runBtn.textContent = busy ? '运行中…' : '运行';
      if (!busy) {
        const icon = svgIcon(ICON_RUN);
        if (icon) runBtn.prepend(icon);
      }
    },
    setThreshold(next: number | null): void {
      thresholdValue = typeof next === 'number' && Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0;
      refreshDerived();
    },
    getFilterLayer(): RetrievalLayer {
      return layer;
    },
    setFilterLayer(l: RetrievalLayer): void {
      applyLayer(l === 'post' || l === 'none' ? l : 'pre');
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      ctrl.abort();
      if (copyTimer) clearTimeout(copyTimer);
      el.classList.remove('kb-retrieval', 'is-busy');
      delete el.dataset.kbRetrieval;
      el.textContent = '';
      delete (el as MarkedRetrievalEl).__icenKbRetrieval;
    },
  };

  /* 投影 threshold 到 params（getParams 时统一投影，这里同步内部一致性） */
  refreshDerived();
  marked.__icenKbRetrieval = handle;
  return handle;
}
