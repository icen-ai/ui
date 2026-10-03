/*
 * @icen.ai/ui — Behavior: kb-sources（来源列表：--row 答案上方横排 / --rail 侧栏纵列，
 * 与 components/kb-ground.css 配套）
 *
 * DOM 契约（docs/spec/kb-family.md §5.2）：
 *   <div class="kb-sources kb-sources--row|kb-sources--rail">
 *     <button class="kb-source" type="button" data-kb-source-id="…">       ← 可读来源：原生 button
 *       <span class="kb-source-icon">…svg…</span>
 *       <span class="kb-source-main">
 *         <span class="kb-source-title">标题</span>
 *         <span class="kb-source-sub">域名/类型 · 相对时间</span>
 *       </span>
 *       <span class="kb-source-side">
 *         <span class="kb-source-badges">…kb-badge--official / --stale / --restricted…</span>
 *         <span class="kb-num">被引 ×2</span>
 *       </span>
 *     </button>
 *     <div class="kb-source is-restricted" role="button" tabindex="0" data-kb-source-id="…">
 *       …同上结构 + <button class="kb-source-request" data-kb-source-request>申请访问</button>
 *     </div>                                                                ← 受限行：含真实按钮，
 *     行壳降级为 role=button（HTML 禁止 button 嵌套 button；init 补 Enter/Space 键控）
 *   </div>
 *   rail 变体：side（徽章/被引/申请访问）并入 kb-source-main 尾部——标题独占一行
 *   （line-clamp 2），meta 行与徽章行各自 flex-wrap（窄侧栏不挤压标题，见 kb-ground.css）。
 *   空态：<div class="kb-empty">下一条答案引用的段落将出现在这里</div>
 *
 * 行为说明：
 *   - renderKbSources(el, sources, opts?)：useCount 降序（无计数按原序稳定排后）；
 *     徽标组：official → .kb-badge--official「官方」；date 距今 >90 天 → .kb-badge--stale
 *     + 相对时间 + warning 点；permission 非 readable → 锁形徽标 + 申请访问按钮；
 *     opts.onlyCited 只保留被引过的来源（useCount > 0）；空集/空数组渲染 .kb-empty 文案；
 *     原始输入 permission === 'hidden' 的来源不渲染行（数据兜底，见下方权限映射）
 *   - initKbSources(root?)：root 级委托（幂等 WeakSet + 销毁函数）：
 *     点击来源行 / 申请访问按钮 → icen:kb-source-open { source }（受限来源宿主据此弹
 *     申请流程）；role=button 行补 Enter/Space 键控等价；与 opts.onOpen 回调双通道
 *
 * 权限映射（spec §9.7）：本组件的 permission 是引用域三级 KbPermission
 *   （readable/restricted/requestable），与权限域五级 KbVisibility 的对应关系：
 *   requestable ≈ metadata + 申请通道、restricted ≈ metadata（锁+标题+打码）、
 *   hidden（五级）来源不渲染该行——hidden = 检索层（security trimming）就不该出现，
 *   UI 永远不应收到；renderKbSources 对原始输入先判 hidden 再归一，纯数据兜底。
 *
 * SSR 安全：无 document 时 render* 原样返回 el、init* 返回 no-op 销毁；
 * 渲染只写 textContent/createElement（禁 innerHTML），SVG 一律经 kb-core 转发的 svgIcon() 消毒。
 */

import {
  getKbSourceType,
  h,
  normalizeCitation,
  relativeTime,
  svgIcon,
  type KbCitation,
} from './kb-core';
import { emitIcen } from './events';
import { isKbCitationStale, kbDomainOf, KB_ICON_LOCK } from './kb-citation';

/** renderKbSources 的配置项：布局变体 / onlyCited 过滤 / 基准时钟 / 点击回调 */
export interface KbSourcesOptions {
  /** 布局变体：row = 答案上方横排（默认）；rail = 侧栏纵列 */
  variant?: 'row' | 'rail';
  /** 只保留被引过的来源（useCount > 0；流式期间「随流填充」模式） */
  onlyCited?: boolean;
  /** 相对时间 / stale 判定的基准时钟（测试注入用；缺省 new Date()） */
  now?: Date;
  /** 点击来源行回调（与 icen:kb-source-open 事件双通道） */
  onOpen?: (source: KbCitation) => void;
}

/* 行 → 来源数据 / 回调 的委托查表（render 时登记，init 委托时取用） */
const rowSourceMap = new WeakMap<HTMLElement, KbCitation>();
const rowOpenMap = new WeakMap<HTMLElement, (source: KbCitation) => void>();

function buildBadges(source: KbCitation, now: Date): HTMLElement {
  const badges = h('span', 'kb-source-badges');
  if (source.official) badges.appendChild(h('span', 'kb-badge kb-badge--official', '官方'));
  if (source.date) {
    const b = h('span', 'kb-badge', relativeTime(source.date, now));
    if (isKbCitationStale(source, now)) {
      b.classList.add('kb-badge--stale');
      b.prepend(h('i', 'kb-dot is-warn'));
    }
    badges.appendChild(b);
  }
  if (source.permission !== 'readable') {
    const lock = h('span', 'kb-badge kb-badge--restricted', '受限');
    const svg = svgIcon(KB_ICON_LOCK);
    if (svg) lock.prepend(svg);
    badges.appendChild(lock);
  }
  return badges;
}

function buildSourceRow(
  source: KbCitation,
  now: Date,
  onOpen?: (s: KbCitation) => void,
  variant: 'row' | 'rail' = 'row',
): HTMLElement {
  const restricted = source.permission !== 'readable';
  /* 受限行内含「申请访问」真实按钮，行壳不能用 button（嵌套交互元素非法）→ role=button 降级 */
  const row: HTMLElement = restricted
    ? h('div', 'kb-source is-restricted')
    : h('button', 'kb-source');
  if (restricted) {
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
  } else {
    (row as HTMLButtonElement).type = 'button';
  }
  row.dataset.kbSourceId = source.id;
  rowSourceMap.set(row, source);
  if (onOpen) rowOpenMap.set(row, onOpen);

  const icon = h('span', 'kb-source-icon');
  const svg = svgIcon(getKbSourceType(source.kind).icon);
  if (svg) icon.appendChild(svg);
  row.appendChild(icon);

  const typeDef = getKbSourceType(source.kind);
  const main = h('span', 'kb-source-main');
  main.appendChild(h('span', 'kb-source-title', source.title));
  const subBits = [kbDomainOf(source.url) || typeDef.label, source.date ? relativeTime(source.date, now) : ''];
  main.appendChild(h('span', 'kb-source-sub', subBits.filter(Boolean).join(' · ')));

  const side = h('span', 'kb-source-side');
  side.appendChild(buildBadges(source, now));
  if (source.useCount && source.useCount > 0) {
    side.appendChild(h('span', 'kb-num', `被引 ×${source.useCount}`));
  }
  if (restricted) {
    const request = h('button', 'kb-source-request', '申请访问');
    request.type = 'button';
    request.dataset.kbSourceRequest = '';
    request.setAttribute('aria-label', `申请访问 ${source.title}`);
    side.appendChild(request);
  }

  if (variant === 'rail') {
    /* rail：side 收进 main 尾部——标题独占（line-clamp 2）、meta 行与徽章行各自换行，
       侧栏窄宽下绝不挤压标题成一行省略号再硬塞徽章 */
    main.appendChild(side);
    row.append(icon, main);
  } else {
    row.append(icon, main, side);
  }
  return row;
}

/**
 * 渲染来源列表（useCount 降序；--row 横排 / --rail 纵列；onlyCited 过滤；空态 .kb-empty）。
 * 返回挂载容器 el。
 */
export function renderKbSources(el: HTMLElement, sources: KbCitation[], opts?: KbSourcesOptions): HTMLElement {
  if (typeof document === 'undefined') return el;
  const now = opts?.now ?? new Date();
  const variant = opts?.variant === 'rail' ? 'rail' : 'row';
  /* hidden 来源不渲染（spec §9.7）：hidden = 检索层就不该出现（security trimming），
     正常永远不应流到 UI——此处对原始输入先判再过滤是数据兜底。必须放在 normalizeCitation
     之前：归一会把未知 permission 值（含 'hidden'）收敛为 readable，判归一后的对象就晚了。 */
  let list = (Array.isArray(sources) ? sources : [])
    .filter((raw) => (raw as { permission?: string }).permission !== 'hidden')
    .map((raw) => normalizeCitation(raw as KbCitation));
  if (opts?.onlyCited) list = list.filter((s) => (s.useCount ?? 0) > 0);

  el.textContent = '';
  el.classList.remove('kb-sources--row', 'kb-sources--rail'); /* 变体切换重渲时不残留旧类 */
  el.classList.add('kb-sources', `kb-sources--${variant}`);

  if (list.length === 0) {
    el.appendChild(h('div', 'kb-empty', '下一条答案引用的段落将出现在这里'));
    return el;
  }

  /* useCount 降序，稳定保持原序（同计数不乱跳） */
  const sorted = list
    .map((source, i) => ({ source, i }))
    .sort((a, b) => (b.source.useCount ?? 0) - (a.source.useCount ?? 0) || a.i - b.i);
  for (const { source } of sorted) el.appendChild(buildSourceRow(source, now, opts?.onOpen, variant));
  return el;
}

const initedScopes = new WeakSet<object>();

/**
 * 初始化来源列表交互（root 级委托；幂等 WeakSet 标记，返回销毁函数，销毁后可重新 init）。
 * 点击来源行 / 申请访问按钮 → icen:kb-source-open { source } + opts.onOpen 回调；
 * role=button 受限行补 Enter/Space 键控等价。
 */
export function initKbSources(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const key: object = scope;
  if (initedScopes.has(key)) return () => undefined;
  initedScopes.add(key);
  const target = scope as ParentNode & EventTarget;

  const fire = (row: HTMLElement): void => {
    const source = rowSourceMap.get(row);
    if (!source) return;
    emitIcen(row, 'icen:kb-source-open', { source });
    rowOpenMap.get(row)?.(source);
  };

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    /* 申请访问按钮：单独命中即止（避免与行壳重复派发） */
    const request = t.closest<HTMLElement>('[data-kb-source-request]');
    if (request) {
      const row = request.closest<HTMLElement>('[data-kb-source-id]');
      if (row) fire(row);
      return;
    }
    const row = t.closest<HTMLElement>('[data-kb-source-id].kb-source');
    if (row) fire(row);
  };

  const onKeydown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const t = e.target instanceof Element ? e.target : null;
    const row = t?.closest<HTMLElement>('.kb-source[role="button"]');
    if (!row) return;
    ke.preventDefault();
    fire(row);
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKeydown);

  return () => {
    target.removeEventListener('click', onClick);
    target.removeEventListener('keydown', onKeydown);
    initedScopes.delete(key);
  };
}
