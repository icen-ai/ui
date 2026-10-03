/*
 * @icen.ai/ui — Behavior: kb-visibility（检索可见性对照器，权限域 kb-perm，spec §9.5；
 * 与 components/kb-perm.css 段C 配套）
 *
 * 定位：admin 审计/教学专用——同一批检索命中在多个身份下的可见性并置对照，表达
 * 「这一列少掉的行」（volume leakage 的可视化教具）。命中差异对照对普通用户构成泄露
 * （判据：任何随受限集合变化的可观察量都是侧信道，spec §9.0-2），因此组件头常驻警示条，
 * 禁止嵌入终端用户界面。
 *
 * DOM 契约（render 快照 + 句柄）：
 *   <div class="kb-visibility">
 *     <div class="kb-visibility-warn">admin 审计视图——命中差异对照对普通用户构成泄露，勿嵌入终端用户界面</div>
 *     <div class="kb-visibility-bar">
 *       <button class="kb-chip kb-visibility-idn" data-identity-user aria-pressed>身份 label</button>…
 *         ← 点击聚焦该列（.kb-visibility-col.is-focused；再点取消），派 icen:kb-visibility-identity {identity}
 *       <span class="kb-meta">查询：{query}</span>              ← 只读回显（展示件不提供输入）
 *       <button class="kb-chip kb-layer-chip" data-layer="pre|post|none">pre ✓</button>
 *         ← 点击循环 pre→post→none，派 icen:kb-visibility-layer {layer}；title 语义见 LAYER_TITLE
 *     </div>
 *     <div class="kb-visibility-grid">
 *       <div class="kb-visibility-col [.is-focused]" data-identity-user>
 *         <header><span>身份 label</span><span class="kb-meta">note</span></header>
 *         <div class="kb-visibility-count kb-num">安全计数 n</div>
 *         <div class="kb-visibility-hits">
 *           <div class="kb-visibility-hit" data-visibility="full|summary|metadata|restricted" data-hit-id>…</div>
 *         </div>
 *       </div>…
 *     </div>
 *     <div class="kb-visibility-lesson">三条教学项 + muted「以上对照仅限 admin 审计」</div>
 *   </div>
 *
 * 命中行呈现（五级 KbVisibility 映射，kb-core §9.6）：
 *   full      = 标题 + snippet（内容态）
 *   summary   = 标题 + AI 摘要段（.kb-visibility-summary）+「原文不可用」禁用钮（摘要权限 ≠ 原文权限）
 *   metadata / restricted = 锁图标（svgIcon）+ 标题 + 打码条（.kb-visibility-snippet 空元素，纯 CSS 块）
 *               + restricted 附「申请访问」文字钮 → opts.onRequest(hit, identity)
 *               ——展示件不派权限域申请事件，申请流（kb-access）由宿主经回调接线
 *   hidden    = 该行在该列内不渲染——对照器表达的就是「这一列少掉的行」（security trimming）
 *
 * 安全计数语义（admin 审计视角）：n = 该身份下 visibility ∈ full/summary/metadata/restricted 的命中数
 *   （授权集合内；hidden 不计不显示）。注意：普通用户视图连这个计数都不允许给，只可给
 *   「结果已按你的权限过滤」恒定文案（spec §9.0-5 volume leakage 纪律；缓解只有 padding 取整）。
 *
 * evaluateHit 缺省：全部返回 'full'（演示语义；宿主注入真实求值，可接 kb-core evaluateAcl 的
 * 身份×条目求值）。SSR 返回静态 stub 句柄。
 *
 * 事件（权限域共用，kb-retrieval 的检索身份/过滤层控件同款）：
 *   icen:kb-visibility-identity {identity} / icen:kb-visibility-layer {layer}
 *
 * SSR 安全：无 document 时返回静态句柄；渲染只写 textContent/createElement（禁 innerHTML），
 * SVG 一律经 kb-core svgIcon 消毒；destroy 摘监听（AbortController）并清空装配内容。
 */

import {
  h,
  svgIcon,
  normalizeIdentity,
  formatCount,
  type KbIdentity,
  type KbVisibility,
} from './kb-core';
import { emitIcen } from './events';
import { KB_ICON_LOCK } from './kb-citation';

/* ══════════════ 类型 ══════════════ */

/** 对照命中的最小数据单元（标题必有；snippet=原文摘录 / summary=AI 摘要，二者权限语义不同） */
export interface KbVisibilityHit {
  id: string;
  title: string;
  /** 原文摘录（visibility=full 时呈现） */
  snippet?: string;
  /** AI 摘要（visibility=summary 时呈现；摘要权限 ≠ 原文权限） */
  summary?: string;
  documentId?: string;
}

/** renderKbVisibility 配置项 */
export interface KbVisibilityOpts {
  /** 查询回显（只读展示，不提供输入） */
  query: string;
  /** 对照身份集（固定身份集，spec §9.0-8：来自服务端验证 token，不接受自由输入） */
  identities: KbIdentity[];
  /** 对照命集（各身份列共享同一批行，行的去留由 evaluateHit 决定） */
  hits: KbVisibilityHit[];
  /** 命中×身份 → 可见性五级；缺省全部 'full'（演示语义，真实求值由宿主注入） */
  evaluateHit?: (hit: KbVisibilityHit, identity: KbIdentity) => KbVisibility;
  /** 过滤层徽标初值（缺省 'pre'；点击循环 pre→post→none） */
  layer?: 'pre' | 'post' | 'none';
  /** 「申请访问」文字钮回调（宿主接 kb-access 申请流；展示件不派申请事件） */
  onRequest?: (hit: KbVisibilityHit, identity: KbIdentity) => void;
}

/** renderKbVisibility 返回的可操作句柄 */
export interface KbVisibilityHandle {
  /** 设置过滤层（重绘徽标并派 icen:kb-visibility-layer {layer}） */
  setFilterLayer(l: 'pre' | 'post' | 'none'): void;
  /** 查询某身份×命中的可见性（查无身份/命中返回 'hidden'——fail-closed，spec §9.0-4） */
  getVisibility(identityUser: string, hitId: string): KbVisibility;
  /** 销毁：摘除监听、清空装配内容、复位幂等标记 */
  destroy(): void;
}

interface MarkedVisibilityEl extends HTMLElement {
  __icenKbVisibility?: KbVisibilityHandle;
}

/* ══════════════ 常量 ══════════════ */

type Layer = 'pre' | 'post' | 'none';

const LAYER_ORDER: readonly Layer[] = ['pre', 'post', 'none'];

const LAYER_LABEL: Record<Layer, string> = { pre: 'pre ✓', post: 'post ⚠', none: 'none ✕' };

const LAYER_TITLE: Record<Layer, string> = {
  pre: 'pre-filter：ACL 在检索执行体内生效——安全基线',
  post: 'post-filter：分数已可观察——缺陷层，仅演示',
  none: 'none：fail-open，无身份过滤返回全部——危险，仅演示',
};

/** 教学段三条（admin 审计视角的安全课；spec §9.5） */
const LESSON_ITEMS: readonly string[] = [
  'fail-open：Kendra 无身份上下文返回全部文档——检索必须携带服务端身份',
  'post-filter：topK 被无权结果占用且相似度分数可被观察',
  '计数差异即 volume leakage：对普通用户只可给「已按权限过滤」恒定文案，缓解只有 padding 取整',
];

/** SSR 静态 stub 句柄（接口完整可用但无副作用；getVisibility 同缺省演示语义返回 'full'） */
const STUB_HANDLE: KbVisibilityHandle = {
  setFilterLayer: () => {},
  getVisibility: () => 'full',
  destroy: () => {},
};

/** 宽进严出：hits 原始输入 → 契约对象 */
function normalizeHit(raw: KbVisibilityHit | Record<string, unknown>): KbVisibilityHit {
  const r = raw as Partial<KbVisibilityHit>;
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? '未命名命中'),
    snippet: typeof r.snippet === 'string' ? r.snippet : undefined,
    summary: typeof r.summary === 'string' ? r.summary : undefined,
    documentId: typeof r.documentId === 'string' ? r.documentId : undefined,
  };
}

/* ══════════════ 工厂 ══════════════ */

/**
 * 渲染检索可见性对照器（admin 审计专用；每身份一列 + 安全计数 + 五级命中行 + 教学段）。
 * 幂等（同元素重复 render 先销毁既有装配）；SSR 返回静态 stub；destroy 摘监听并清空。
 */
export function renderKbVisibility(el: HTMLElement, opts: KbVisibilityOpts): KbVisibilityHandle {
  if (typeof document === 'undefined' || !el) return STUB_HANDLE;
  const marked = el as MarkedVisibilityEl;
  /* 同元素重复 render：先销毁上一代句柄（摘监听），再全量重建 */
  marked.__icenKbVisibility?.destroy();

  const ctrl = new AbortController();
  const listen = (target: EventTarget, type: string, fn: EventListenerOrEventListenerObject): void => {
    target.addEventListener(type, fn, { signal: ctrl.signal });
  };

  const identities = (Array.isArray(opts.identities) ? opts.identities : []).map(normalizeIdentity);
  const hits = (Array.isArray(opts.hits) ? opts.hits : []).map(normalizeHit).filter((hit) => hit.id);
  const evalHit =
    typeof opts.evaluateHit === 'function'
      ? opts.evaluateHit
      : (): KbVisibility => 'full' /* 缺省演示语义：全部可见，真实求值由宿主注入 */;
  let layer: Layer = opts.layer === 'post' || opts.layer === 'none' ? opts.layer : 'pre';
  let focusedUser: string | null = null;
  let destroyed = false;

  el.textContent = '';
  el.classList.add('kb-visibility');

  /* ── 警示条（常驻：对照本身构成泄露，admin 审计例外，spec §9.0-2） ── */
  el.appendChild(
    h('div', 'kb-visibility-warn', 'admin 审计视图——命中差异对照对普通用户构成泄露，勿嵌入终端用户界面'),
  );

  /* ── bar：身份 chip 组 · 查询回显 · 过滤层徽标 ── */

  const bar = h('div', 'kb-visibility-bar');
  const chipMap = new Map<string, HTMLButtonElement>();
  for (const identity of identities) {
    const chip = h('button', 'kb-chip kb-visibility-idn', identity.label ?? identity.user);
    chip.type = 'button';
    chip.dataset.identityUser = identity.user;
    chip.setAttribute('aria-pressed', 'false');
    chip.setAttribute('aria-label', `聚焦身份 ${identity.label ?? identity.user} 的列`);
    bar.appendChild(chip);
    chipMap.set(identity.user, chip);
  }
  bar.appendChild(h('span', 'kb-meta', `查询：${opts.query || '—'}`));

  const layerChip = h('button', 'kb-chip kb-layer-chip');
  layerChip.type = 'button';
  bar.appendChild(layerChip);

  function paintLayer(): void {
    layerChip.dataset.layer = layer;
    layerChip.textContent = LAYER_LABEL[layer];
    layerChip.title = LAYER_TITLE[layer];
    layerChip.setAttribute('aria-label', `过滤层：${LAYER_TITLE[layer]}`);
  }
  paintLayer();

  el.appendChild(bar);

  /* ── grid：每身份一列（header 只放身份 label + note——有效角色属 kb-who-can 的职责，不在此重复） ── */

  const grid = h('div', 'kb-visibility-grid');
  const colMap = new Map<string, HTMLElement>();

  function buildHitRow(hit: KbVisibilityHit, identity: KbIdentity): HTMLElement | null {
    const visibility = evalHit(hit, identity);
    if (visibility === 'hidden') return null; /* hidden = 列内不可见——「这一列少掉的行」正是对照器要表达的 */
    const row = h('div', 'kb-visibility-hit');
    row.dataset.visibility = visibility;
    row.dataset.hitId = hit.id;

    const titleRow = h('div', 'kb-visibility-hit-title');
    if (visibility === 'metadata' || visibility === 'restricted') {
      const lock = svgIcon(KB_ICON_LOCK);
      if (lock) titleRow.appendChild(lock);
    }
    titleRow.appendChild(h('span', 'kb-visibility-hit-title-text', hit.title));
    row.appendChild(titleRow);

    if (visibility === 'full') {
      if (hit.snippet) row.appendChild(h('div', 'kb-visibility-snippet kb-meta', hit.snippet));
    } else if (visibility === 'summary') {
      if (hit.summary) row.appendChild(h('div', 'kb-visibility-summary', hit.summary));
      const origOff = h('button', 'kb-visibility-origoff', '原文不可用');
      origOff.type = 'button';
      origOff.disabled = true; /* 摘要权限 ≠ 原文权限：显式禁用，不做可点假象 */
      origOff.setAttribute('aria-disabled', 'true');
      row.appendChild(origOff);
    } else {
      /* metadata / restricted：打码条（空元素，块状呈现见 kb-perm.css） */
      row.appendChild(h('div', 'kb-visibility-snippet'));
      if (visibility === 'restricted') {
        const request = h('button', 'kb-visibility-request', '申请访问');
        request.type = 'button';
        request.setAttribute('aria-label', `申请访问 ${hit.title}`);
        row.appendChild(request);
      }
    }
    return row;
  }

  for (const identity of identities) {
    const col = h('div', 'kb-visibility-col');
    col.dataset.identityUser = identity.user;

    const head = h('header');
    head.appendChild(h('span', 'kb-visibility-idn-label', identity.label ?? identity.user));
    if (identity.note) head.appendChild(h('span', 'kb-meta', identity.note));
    col.appendChild(head);

    /* 安全计数（admin 语义：授权集合内 = visibility ≠ hidden 的命中数；hidden 不计不显示。
       普通用户视图连此计数都不允许——只可给恒定文案（spec §9.0-5），见教学段第三条。 */
    let safeCount = 0;
    const hitsBox = h('div', 'kb-visibility-hits');
    for (const hit of hits) {
      const row = buildHitRow(hit, identity);
      if (row) {
        hitsBox.appendChild(row);
        safeCount++;
      }
    }
    col.appendChild(h('div', 'kb-visibility-count kb-num', `安全计数 ${formatCount(safeCount)}`));
    col.appendChild(hitsBox);

    grid.appendChild(col);
    colMap.set(identity.user, col);
  }
  el.appendChild(grid);

  /* ── 教学段（admin 课） ── */

  const lesson = h('div', 'kb-visibility-lesson');
  const lessonList = h('ul');
  for (const item of LESSON_ITEMS) lessonList.appendChild(h('li', undefined, item));
  lesson.appendChild(lessonList);
  lesson.appendChild(h('div', 'kb-meta kb-visibility-lesson-note', '以上对照仅限 admin 审计'));
  el.appendChild(lesson);

  /* ── 交互 ── */

  function applyLayer(next: Layer): void {
    if (destroyed || next === layer) return;
    layer = next;
    paintLayer();
    emitIcen(el, 'icen:kb-visibility-layer', { layer });
  }

  function setFocus(user: string | null): void {
    focusedUser = user;
    for (const [u, col] of colMap) col.classList.toggle('is-focused', u === user);
    for (const [u, chip] of chipMap) chip.setAttribute('aria-pressed', u === user ? 'true' : 'false');
  }

  listen(bar, 'click', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const chip = target?.closest<HTMLButtonElement>('.kb-visibility-idn');
    if (chip) {
      const user = chip.dataset.identityUser ?? '';
      setFocus(focusedUser === user ? null : user); /* 再点取消聚焦 */
      const identity = identities.find((i) => i.user === user);
      if (identity) emitIcen(el, 'icen:kb-visibility-identity', { identity });
      return;
    }
    const layerBtn = target?.closest<HTMLButtonElement>('.kb-layer-chip');
    if (layerBtn) {
      const idx = LAYER_ORDER.indexOf(layer);
      applyLayer(LAYER_ORDER[(idx + 1) % LAYER_ORDER.length]!); /* pre→post→none 循环 */
    }
  });

  /* 申请访问文字钮：委托到 grid；只走 opts.onRequest 回调（展示件不派权限域申请事件，宿主接 kb-access） */
  listen(grid, 'click', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const btn = target?.closest<HTMLButtonElement>('.kb-visibility-request');
    if (!btn) return;
    const row = btn.closest<HTMLElement>('.kb-visibility-hit');
    const col = btn.closest<HTMLElement>('.kb-visibility-col');
    if (!row || !col) return;
    const hit = hits.find((x) => x.id === (row.dataset.hitId ?? ''));
    const identity = identities.find((i) => i.user === (col.dataset.identityUser ?? ''));
    if (hit && identity) opts.onRequest?.(hit, identity);
  });

  /* ── 句柄 ── */

  const handle: KbVisibilityHandle = {
    setFilterLayer(l: Layer): void {
      applyLayer(l === 'post' || l === 'none' ? l : 'pre');
    },
    getVisibility(identityUser: string, hitId: string): KbVisibility {
      const identity = identities.find((i) => i.user === identityUser);
      const hit = hits.find((x) => x.id === hitId);
      if (!identity || !hit) return 'hidden'; /* fail-closed（spec §9.0-4）：未知身份/命中默认拒绝 */
      return evalHit(hit, identity);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      ctrl.abort();
      el.classList.remove('kb-visibility');
      el.textContent = '';
      delete marked.__icenKbVisibility;
    },
  };

  marked.__icenKbVisibility = handle;
  return handle;
}
