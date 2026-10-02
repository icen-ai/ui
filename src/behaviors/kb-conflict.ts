/*
 * @icen.ai/ui — Behavior: kb-conflict（来源冲突组：同一主张的多版本对勘，与 components/kb-ground.css 配套）
 *
 * DOM 契约（docs/spec/kb-family.md §5.4）：
 *   <div class="kb-conflict">
 *     <div class="kb-conflict-claim"><i class="kb-dot is-warn"></i>同一主张…</div>
 *     <div class="kb-conflict-versions">
 *       <button class="kb-conflict-ver is-current" type="button" data-kb-source-id="…">
 *         <span class="kb-conflict-ver-head">
 *           <span class="kb-conflict-ver-date kb-num">2026-08-01</span>
 *           <span class="kb-conflict-ver-badges">…kb-badge--official / --stale…</span>
 *         </span>
 *         <span class="kb-conflict-ver-title">版本来源标题</span>
 *         <span class="kb-conflict-ver-sub">域名/类型</span>
 *       </button>
 *       <button class="kb-conflict-ver is-older" …>…</button>   ← faded + stale 徽标
 *     </div>
 *   </div>
 *
 * 行为说明：
 *   - renderKbConflict(el, groups, opts?)：每组 = claim 行 + 版本卡横排；
 *     is-current 判定：优先 official 来源，否则最新 date（都无则首个版本），其余版本
 *     faded（.is-older）+ 满足 >90 天 stale 判定时加 .kb-badge--stale
 *   - 点击版本卡 → icen:kb-source-open { source }（与来源列表同一事件契约，
 *     宿主据此打开 passage / 外链），opts.onOpen 回调双通道；本组件无 init（渲染即接线）
 *
 * SSR 安全：无 document 时 render* 原样返回 el；渲染只写 textContent/createElement（禁 innerHTML），
 * SVG 一律经 kb-core 转发的 svgIcon() 消毒。
 */

import { h, normalizeCitation, relativeTime, getKbSourceType, type KbCitation } from './kb-core';
import { emitIcen } from './events';
import { isKbCitationStale, kbDomainOf } from './kb-citation';

/** 冲突组：一条共享主张 + 相互矛盾的多个来源版本 */
export interface KbConflictGroup {
  claim: string;
  versions: KbCitation[];
}

/** renderKbConflict 的配置项：stale 判定基准时钟 / 点击版本卡回调 */
export interface KbConflictOptions {
  /** stale 判定的基准时钟（测试注入用；缺省 new Date()） */
  now?: Date;
  /** 点击版本卡回调（与 icen:kb-source-open 事件双通道） */
  onOpen?: (source: KbCitation) => void;
}

/** is-current 判定：official 优先，其次最新日期，都无则首个版本（至少保一版可读） */
function pickCurrent(versions: KbCitation[]): KbCitation | undefined {
  const official = versions.find((v) => v.official);
  if (official) return official;
  let best: KbCitation | undefined;
  let bestAt = Number.NEGATIVE_INFINITY;
  for (const v of versions) {
    const t = v.date ? Date.parse(v.date) : NaN;
    if (Number.isFinite(t) && t > bestAt) {
      bestAt = t;
      best = v;
    }
  }
  return best ?? versions[0];
}

/** 版本卡日期：对勘场景给绝对日期（相对时间看不出先后），不可解析时原样展示 */
function dateLabel(source: KbCitation): string {
  if (!source.date) return '—';
  const t = Date.parse(source.date);
  if (!Number.isFinite(t)) return source.date;
  const d = new Date(t);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return ymd;
}

function buildVersionCard(
  source: KbCitation,
  current: KbCitation | undefined,
  now: Date,
  onOpen?: (s: KbCitation) => void,
): HTMLElement {
  const isCurrent = source === current || source.id === current?.id;
  const ver = h('button', `kb-conflict-ver${isCurrent ? ' is-current' : ' is-older'}`);
  ver.type = 'button';
  ver.dataset.kbSourceId = source.id;

  const head = h('span', 'kb-conflict-ver-head');
  head.appendChild(h('span', 'kb-conflict-ver-date kb-num', dateLabel(source)));
  const badges = h('span', 'kb-conflict-ver-badges');
  if (source.official) badges.appendChild(h('span', 'kb-badge kb-badge--official', '官方'));
  if (!isCurrent && isKbCitationStale(source, now)) {
    const stale = h('span', 'kb-badge kb-badge--stale', relativeTime(source.date ?? '', now));
    stale.prepend(h('i', 'kb-dot is-warn'));
    badges.appendChild(stale);
  }
  head.appendChild(badges);
  ver.appendChild(head);

  ver.appendChild(h('span', 'kb-conflict-ver-title', source.title));
  const typeDef = getKbSourceType(source.kind);
  const subBits = [kbDomainOf(source.url) || typeDef.label, source.owner ? `责任人 ${source.owner}` : ''];
  ver.appendChild(h('span', 'kb-conflict-ver-sub', subBits.filter(Boolean).join(' · ')));

  ver.addEventListener('click', () => {
    emitIcen(ver, 'icen:kb-source-open', { source });
    onOpen?.(source);
  });
  return ver;
}

/**
 * 渲染来源冲突组（claim 行 + 版本卡横排；is-current 高亮最新/官方，其余 faded + stale 徽标）。
 * 返回挂载容器 el。
 */
export function renderKbConflict(
  el: HTMLElement,
  groups: KbConflictGroup[],
  opts?: KbConflictOptions,
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const now = opts?.now ?? new Date();
  el.textContent = '';
  for (const group of Array.isArray(groups) ? groups : []) {
    const box = h('div', 'kb-conflict');
    const claim = h('div', 'kb-conflict-claim');
    claim.prepend(h('i', 'kb-dot is-warn'));
    claim.appendChild(document.createTextNode(group.claim ?? ''));
    box.appendChild(claim);

    const versions = h('div', 'kb-conflict-versions');
    const list = (Array.isArray(group.versions) ? group.versions : []).map(normalizeCitation);
    const current = pickCurrent(list);
    for (const v of list) versions.appendChild(buildVersionCard(v, current, now, opts?.onOpen));
    box.appendChild(versions);
    el.appendChild(box);
  }
  return el;
}
