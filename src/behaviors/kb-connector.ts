/*
 * @icen.ai/ui — Behavior: kb-connector（数据源连接器卡：健康 4 信号 + 同步操作）
 * 与 components/kb-ingest.css 配套。
 *
 * DOM 契约（docs/spec/kb-family.md §5.8；数据契约 kb-core KbConnector / connectorHealth）：
 *   <div class="kb-connector-grid">
 *     <div class="kb-connector is-healthy|is-stale|is-failing|is-off"
 *          data-connector-id="…" data-schedule="0 ✱/2 ✱ ✱ ✱（cron 原值）" data-cred="ok|expired|none">
 *       <div class="kb-connector-head">
 *         <span class="kb-source-icon">…svg（getKbSourceType(kind).icon）…</span>
 *         <span class="kb-connector-main">
 *           <span class="kb-connector-name">Confluence</span>
 *           <span class="kb-connector-sub">空间：/engineering</span>
 *         </span>
 *         <span class="kb-meta kb-connector-schedule">同步计划（人类可读 → kb-meta；cron 原值 → kb-chip mono 不换行）</span>
 *       </div>
 *       <div class="kb-connector-metrics">
 *         <div class="kb-connector-signal"><span class="kb-dot is-ok|is-warn|is-err"></span>
 *           <span class="kb-connector-signal-label">健康</span><span class="kb-connector-signal-value">正常</span></div>
 *         <div class="kb-connector-signal"><span class="kb-connector-signal-label">已同步</span>
 *           <span class="kb-num kb-connector-signal-value">1,204</span></div>
 *         <div class="kb-connector-signal"><span class="kb-connector-signal-label">抓取率</span>
 *           <span class="kb-num kb-connector-signal-value">86/天</span></div>
 *         <div class="kb-connector-signal"><span class="kb-connector-signal-label">变更率</span>
 *           <span class="kb-num kb-connector-signal-value">12/天</span></div>
 *         <div class="kb-connector-signal"><span class="kb-connector-signal-label">凭证</span>
 *           <span class="kb-connector-signal-value kb-connector-cred">…正常 | is-expired 凭证过期 | is-none 未配置…</span></div>
 *       </div>
 *       <div class="kb-connector-foot">
 *         <span class="kb-meta kb-connector-last">最近同步 3 小时前</span>
 *         <span class="kb-connector-actions">
 *           <button type="button" class="kb-btn" data-kb-connector-sync>立即同步</button>
 *           <button type="button" class="kb-btn" data-kb-connector-reauth>重新授权</button>
 *           <button type="button" class="kb-btn" data-kb-connector-schedule>编辑计划</button>
 *         </span>
 *       </div>
 *     </div>…
 *     [空态 .kb-empty]
 *   </div>
 *
 * 行为：
 *   - renderKbConnectors(el, connectors)：快照渲染（normalizeConnector 宽进严出），
 *     健康类 = kb-core connectorHealth（Glean 模型：enabled≠健康，24h 停滞=stale，
 *     抓取失败/凭证过期=failing）映射为卡左缘 2px 色条与状态点；
 *     已同步/抓取率/变更率走 formatCount；最近同步走 relativeTime。返回 el（SSR 原样）。
 *   - initKbConnectors(root?)：幂等（scope.__icenKbConnectorInit）+ 返回销毁函数，
 *     root 缺省 document 级委托：
 *     · [data-kb-connector-sync]     → icen:kb-connector-sync { connectorId }
 *     · [data-kb-connector-reauth]   → icen:kb-connector-reauth { connectorId }
 *     · [data-kb-connector-schedule] → icen:kb-connector-schedule { connectorId, schedule }
 *       （schedule 取卡片 data-schedule，即渲染时的 c.schedule 原值）
 *   - 渲染只写 textContent / createElement；SVG 过 kb-core svgIcon() 消毒。
 */

import {
  connectorHealth,
  formatCount,
  getKbSourceType,
  h,
  normalizeConnector,
  relativeTime,
  svgIcon,
  type KbConnector,
  type KbConnectorHealth,
} from './kb-core';
import { emitIcen } from './events';

/* ── 域内小工具 ── */

const svg = (d: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON_SYNC = svg('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>');
const ICON_KEY = svg('<circle cx="7.5" cy="15.5" r="5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>');
const ICON_CAL = svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>');

function icon(parent: HTMLElement, svgStr: string): void {
  const node = svgIcon(svgStr);
  if (node) parent.appendChild(node);
}

/** 健康态 → 状态点类（kb.css .kb-dot 语义色；off 用默认 faint） */
const HEALTH_DOT: Record<KbConnectorHealth, string> = {
  healthy: 'is-ok',
  stale: 'is-warn',
  failing: 'is-err',
  off: '',
};
const HEALTH_LABEL: Record<KbConnectorHealth, string> = {
  healthy: '正常',
  stale: '停滞',
  failing: '异常',
  off: '已停用',
};

/** 单信号行：label + value（value 由调用方给 Node 或字符串；value 一律 .kb-num 右对齐） */
function buildSignal(label: string, value: string, dotClass = ''): HTMLElement {
  const cell = h('div', 'kb-connector-signal');
  if (dotClass) cell.appendChild(h('span', `kb-dot ${dotClass}`.trim()));
  cell.appendChild(h('span', 'kb-connector-signal-label', label));
  cell.appendChild(h('span', 'kb-num kb-connector-signal-value', value));
  return cell;
}

/** cron 计划（含 ✱ 或五段）→ .kb-chip mono 不换行；人类可读文本 → .kb-meta */
function buildScheduleBadge(schedule: string): HTMLElement {
  const isCron = schedule.includes('*') || schedule.trim().split(/\s+/).length === 5;
  return isCron
    ? h('span', 'kb-chip kb-connector-schedule', schedule)
    : h('span', 'kb-meta kb-connector-schedule', schedule);
}

/* ── 渲染 ── */

/**
 * 渲染连接器卡网格（快照：整树重建后返回挂载容器 el）。
 * 卡片健康类 is-healthy/is-stale/is-failing/is-off 由 kb-core connectorHealth 判定；
 * 凭证以文字值呈现（expired=红 / none=warning / ok=muted，与指标网格排版统一）。空数组给空态。SSR（无 document）下原样返回 el。
 */
export function renderKbConnectors(
  el: HTMLElement,
  connectors: KbConnector[],
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const list = (Array.isArray(connectors) ? connectors : []).map(
    (c) => normalizeConnector(c as unknown as Record<string, unknown>),
  );
  el.textContent = '';
  if (!list.length) {
    el.appendChild(h('div', 'kb-empty', '暂无连接器'));
    return el;
  }
  const grid = h('div', 'kb-connector-grid');
  list.forEach((c) => {
    const health = connectorHealth(c);
    const card = h('div', `kb-connector is-${health}`);
    card.dataset.connectorId = c.id;
    if (c.schedule) card.dataset.schedule = c.schedule;
    card.dataset.cred = c.credential ?? 'ok';

    /* 头：类型图标（注册表）+ 名称/scope + 同步计划（mono） */
    const head = h('div', 'kb-connector-head');
    const iconBox = h('span', 'kb-source-icon');
    const typeDef = getKbSourceType(c.kind);
    const typeNode = svgIcon(typeDef.icon);
    if (typeNode) iconBox.appendChild(typeNode);
    head.appendChild(iconBox);
    const main = h('span', 'kb-connector-main');
    main.appendChild(h('span', 'kb-connector-name', c.name));
    if (c.scope) main.appendChild(h('span', 'kb-connector-sub', c.scope));
    head.appendChild(main);
    if (c.schedule) head.appendChild(buildScheduleBadge(c.schedule));
    card.appendChild(head);

    /* 4 离散信号 + 凭证状态（CSS grid 两列对齐：.kb-connector-metrics） */
    const signals = h('div', 'kb-connector-metrics');
    signals.appendChild(buildSignal('健康', HEALTH_LABEL[health], HEALTH_DOT[health]));
    signals.appendChild(buildSignal('已同步', formatCount(c.itemsSynced)));
    signals.appendChild(buildSignal('抓取率', c.crawlRate != null ? `${formatCount(c.crawlRate)}/天` : '—'));
    signals.appendChild(buildSignal('变更率', c.changeRate != null ? `${formatCount(c.changeRate)}/天` : '—'));
    const credCell = h('div', 'kb-connector-signal');
    credCell.appendChild(h('span', 'kb-connector-signal-label', '凭证'));
    if (c.credential === 'expired') {
      credCell.appendChild(h('span', 'kb-connector-signal-value kb-connector-cred is-expired', '凭证过期'));
    } else if (c.credential === 'none') {
      credCell.appendChild(h('span', 'kb-connector-signal-value kb-connector-cred is-none', '未配置'));
    } else {
      credCell.appendChild(h('span', 'kb-connector-signal-value kb-connector-cred is-ok', '正常'));
    }
    signals.appendChild(credCell);
    card.appendChild(signals);

    /* 脚：最近同步相对时间 + 操作三钮 */
    const foot = h('div', 'kb-connector-foot');
    foot.appendChild(h(
      'span',
      'kb-meta kb-connector-last',
      c.lastSyncAt ? `最近同步 ${relativeTime(c.lastSyncAt)}` : '从未同步',
    ));
    const actions = h('span', 'kb-connector-actions');
    const sync = h('button', 'kb-btn');
    sync.type = 'button';
    sync.dataset.kbConnectorSync = '';
    icon(sync, ICON_SYNC);
    sync.appendChild(document.createTextNode('立即同步'));
    actions.appendChild(sync);
    const reauth = h('button', 'kb-btn');
    reauth.type = 'button';
    reauth.dataset.kbConnectorReauth = '';
    icon(reauth, ICON_KEY);
    reauth.appendChild(document.createTextNode('重新授权'));
    actions.appendChild(reauth);
    const sched = h('button', 'kb-btn');
    sched.type = 'button';
    sched.dataset.kbConnectorSchedule = '';
    icon(sched, ICON_CAL);
    sched.appendChild(document.createTextNode('编辑计划'));
    actions.appendChild(sched);
    foot.appendChild(actions);
    card.appendChild(foot);
    grid.appendChild(card);
  });
  el.appendChild(grid);
  return el;
}

/* ── 交互 ── */

interface ConnectorScope extends ParentNode {
  __icenKbConnectorInit?: boolean;
}

/**
 * 接线连接器操作三钮（scope 级事件委托，重复调用幂等）。
 * root 缺省 document：页面一次 init 即接管后续插入的连接器卡。
 * 返回销毁函数：摘除委托并复位幂等标记，销毁后可重新 initKbConnectors。SSR 下 no-op。
 */
export function initKbConnectors(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as ConnectorScope;
  if (marked.__icenKbConnectorInit) return () => undefined;
  marked.__icenKbConnectorInit = true;
  const target = scope as ParentNode & EventTarget;

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const card = t.closest<HTMLElement>('.kb-connector[data-connector-id]');
    if (!card) return;
    const connectorId = card.dataset.connectorId ?? '';
    if (t.closest('[data-kb-connector-sync]')) {
      emitIcen(card, 'icen:kb-connector-sync', { connectorId });
    } else if (t.closest('[data-kb-connector-reauth]')) {
      emitIcen(card, 'icen:kb-connector-reauth', { connectorId });
    } else if (t.closest('[data-kb-connector-schedule]')) {
      emitIcen(card, 'icen:kb-connector-schedule', { connectorId, schedule: card.dataset.schedule ?? '' });
    }
  };

  target.addEventListener('click', onClick);
  return () => {
    target.removeEventListener('click', onClick);
    marked.__icenKbConnectorInit = false;
  };
}
