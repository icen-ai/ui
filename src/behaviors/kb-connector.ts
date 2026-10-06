/*
 * @icen.ai/ui — Behavior: kb-connector（数据源连接器卡：健康 4 信号 + 同步操作）
 * 与 components/kb-ingest.css 配套。
 *
 * DOM 契约（docs/spec/kb-family.md §5.8；数据契约 kb-core KbConnector / connectorHealth）：
 *   <div class="icen-kb-connector-grid">
 *     <div class="icen-kb-connector is-healthy|is-stale|is-failing|is-off"
 *          data-icen-connector-id="…" data-icen-schedule="0 ✱/2 ✱ ✱ ✱（cron 原值）" data-icen-cred="ok|expired|none">
 *       <div class="icen-kb-connector-head">
 *         <span class="icen-kb-source-icon">…svg（getKbSourceType(kind).icon）…</span>
 *         <span class="icen-kb-connector-main">
 *           <span class="icen-kb-connector-name">Confluence</span>
 *           <span class="icen-kb-connector-sub">空间：/engineering</span>
 *         </span>
 *         <span class="icen-kb-meta icen-kb-connector-schedule">同步计划（人类可读 → icen-kb-meta；cron 原值 → icen-kb-chip icen-mono 不换行）</span>
 *       </div>
 *       <div class="icen-kb-connector-metrics">
 *         <div class="icen-kb-connector-signal"><span class="icen-kb-dot is-ok|is-warn|is-err"></span>
 *           <span class="icen-kb-connector-signal-label">健康</span><span class="icen-kb-connector-signal-value">正常</span></div>
 *         <div class="icen-kb-connector-signal"><span class="icen-kb-connector-signal-label">已同步</span>
 *           <span class="icen-kb-num icen-kb-connector-signal-value">1,204</span></div>
 *         <div class="icen-kb-connector-signal"><span class="icen-kb-connector-signal-label">抓取率</span>
 *           <span class="icen-kb-num icen-kb-connector-signal-value">86/天</span></div>
 *         <div class="icen-kb-connector-signal"><span class="icen-kb-connector-signal-label">变更率</span>
 *           <span class="icen-kb-num icen-kb-connector-signal-value">12/天</span></div>
 *         <div class="icen-kb-connector-signal"><span class="icen-kb-connector-signal-label">凭证</span>
 *           <span class="icen-kb-connector-signal-value icen-kb-connector-cred">…正常 | is-expired 凭证过期 | is-none 未配置…</span></div>
 *       </div>
 *       <div class="icen-kb-connector-foot">
 *         <span class="icen-kb-meta kb-connector-last">最近同步 3 小时前</span>
 *         <span class="icen-kb-connector-actions">
 *           <button type="button" class="icen-kb-btn" data-icen-kb-connector-sync>立即同步</button>
 *           <button type="button" class="icen-kb-btn" data-icen-kb-connector-reauth>重新授权</button>
 *           <button type="button" class="icen-kb-btn" data-icen-kb-connector-schedule>编辑计划</button>
 *         </span>
 *       </div>
 *     </div>…
 *     [空态 .icen-kb-empty]
 *   </div>
 *
 * 行为：
 *   - renderKbConnectors(el, connectors)：快照渲染（normalizeConnector 宽进严出），
 *     健康类 = kb-core connectorHealth（Glean 模型：enabled≠健康，24h 停滞=stale，
 *     抓取失败/凭证过期=failing）映射为卡左缘 2px 色条与状态点；
 *     已同步/抓取率/变更率走 formatCount；最近同步走 relativeTime。返回 el（SSR 原样）。
 *   - initKbConnectors(root?)：幂等（scope.__icenKbConnectorInit）+ 返回销毁函数，
 *     root 缺省 document 级委托：
 *     · [data-icen-kb-connector-sync]     → icen:kb-connector-sync { connectorId }
 *     · [data-icen-kb-connector-reauth]   → icen:kb-connector-reauth { connectorId }
 *     · [data-icen-kb-connector-schedule] → icen:kb-connector-schedule { connectorId, schedule }
 *       （schedule 取卡片 data-icen-schedule，即渲染时的 c.schedule 原值）
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
import { t } from './i18n';

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

/** 健康态 → 状态点类（kb.css .icen-kb-dot 语义色；off 用默认 faint） */
const HEALTH_DOT: Record<KbConnectorHealth, string> = {
  healthy: 'is-ok',
  stale: 'is-warn',
  failing: 'is-err',
  off: '',
};
const HEALTH_LABEL: Record<KbConnectorHealth, string> = {
  healthy: t('common.healthy'),
  stale: t('kbConnector.stale'),
  failing: t('kbConnector.failing'),
  off: t('kbConnector.off'),
};

/** 单信号行：label + value（value 由调用方给 Node 或字符串；value 一律 .icen-kb-num 右对齐） */
function buildSignal(label: string, value: string, dotClass = ''): HTMLElement {
  const cell = h('div', 'icen-kb-connector-signal');
  if (dotClass) cell.appendChild(h('span', `icen-kb-dot ${dotClass}`.trim()));
  cell.appendChild(h('span', 'icen-kb-connector-signal-label', label));
  cell.appendChild(h('span', 'icen-kb-num icen-kb-connector-signal-value', value));
  return cell;
}

/** cron 计划（含 ✱ 或五段）→ .icen-kb-chip mono 不换行；人类可读文本 → .icen-kb-meta */
function buildScheduleBadge(schedule: string): HTMLElement {
  const isCron = schedule.includes('*') || schedule.trim().split(/\s+/).length === 5;
  return isCron
    ? h('span', 'icen-kb-chip icen-kb-connector-schedule', schedule)
    : h('span', 'icen-kb-meta icen-kb-connector-schedule', schedule);
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
    el.appendChild(h('div', 'icen-kb-empty', t('kbConnector.empty')));
    return el;
  }
  const grid = h('div', 'icen-kb-connector-grid');
  list.forEach((c) => {
    const health = connectorHealth(c);
    const card = h('div', `icen-kb-connector is-${health}`);
    card.dataset.icenConnectorId = c.id;
    if (c.schedule) card.dataset.icenSchedule = c.schedule;
    card.dataset.icenCred = c.credential ?? 'ok';

    /* 头：类型图标（注册表）+ 名称/scope + 同步计划（mono） */
    const head = h('div', 'icen-kb-connector-head');
    const iconBox = h('span', 'icen-kb-source-icon');
    const typeDef = getKbSourceType(c.kind);
    const typeNode = svgIcon(typeDef.icon);
    if (typeNode) iconBox.appendChild(typeNode);
    head.appendChild(iconBox);
    const main = h('span', 'icen-kb-connector-main');
    main.appendChild(h('span', 'icen-kb-connector-name', c.name));
    if (c.scope) main.appendChild(h('span', 'icen-kb-connector-sub', c.scope));
    head.appendChild(main);
    if (c.schedule) head.appendChild(buildScheduleBadge(c.schedule));
    card.appendChild(head);

    /* 4 离散信号 + 凭证状态（CSS grid 两列对齐：.icen-kb-connector-metrics） */
    const signals = h('div', 'icen-kb-connector-metrics');
    signals.appendChild(buildSignal(t('common.healthy'), HEALTH_LABEL[health], HEALTH_DOT[health]));
    signals.appendChild(buildSignal(t('kbConnector.synced'), formatCount(c.itemsSynced)));
    signals.appendChild(buildSignal(t('kbConnector.crawlRate'), c.crawlRate != null ? t('kbConnector.perDay', { p0: formatCount(c.crawlRate) }) : '—'));
    signals.appendChild(buildSignal(t('kbConnector.changeRate'), c.changeRate != null ? t('kbConnector.perDay', { p0: formatCount(c.changeRate) }) : '—'));
    const credCell = h('div', 'icen-kb-connector-signal');
    credCell.appendChild(h('span', 'icen-kb-connector-signal-label', t('kbConnector.credentials')));
    if (c.credential === 'expired') {
      credCell.appendChild(h('span', 'icen-kb-connector-signal-value icen-kb-connector-cred is-expired', t('kbConnector.credentialsExpired')));
    } else if (c.credential === 'none') {
      credCell.appendChild(h('span', 'icen-kb-connector-signal-value icen-kb-connector-cred is-none', t('kbConnector.notConfigured')));
    } else {
      credCell.appendChild(h('span', 'icen-kb-connector-signal-value icen-kb-connector-cred is-ok', t('common.healthy')));
    }
    signals.appendChild(credCell);
    card.appendChild(signals);

    /* 脚：最近同步相对时间 + 操作三钮 */
    const foot = h('div', 'icen-kb-connector-foot');
    foot.appendChild(h(
      'span',
      'icen-kb-meta kb-connector-last',
      c.lastSyncAt ? t('kbConnector.lastSync', { p0: relativeTime(c.lastSyncAt) }) : t('kbConnector.neverSynced'),
    ));
    const actions = h('span', 'icen-kb-connector-actions');
    const sync = h('button', 'icen-kb-btn');
    sync.type = 'button';
    sync.dataset.icenKbConnectorSync = '';
    icon(sync, ICON_SYNC);
    sync.appendChild(document.createTextNode(t('kbConnector.syncNow')));
    actions.appendChild(sync);
    const reauth = h('button', 'icen-kb-btn');
    reauth.type = 'button';
    reauth.dataset.icenKbConnectorReauth = '';
    icon(reauth, ICON_KEY);
    reauth.appendChild(document.createTextNode(t('kbConnector.reauth')));
    actions.appendChild(reauth);
    const sched = h('button', 'icen-kb-btn');
    sched.type = 'button';
    sched.dataset.icenKbConnectorSchedule = '';
    icon(sched, ICON_CAL);
    sched.appendChild(document.createTextNode(t('kbConnector.editSchedule')));
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
    const card = t.closest<HTMLElement>('.icen-kb-connector[data-icen-connector-id]');
    if (!card) return;
    const connectorId = card.dataset.icenConnectorId ?? '';
    if (t.closest('[data-icen-kb-connector-sync]')) {
      emitIcen(card, 'icen:kb-connector-sync', { connectorId });
    } else if (t.closest('[data-icen-kb-connector-reauth]')) {
      emitIcen(card, 'icen:kb-connector-reauth', { connectorId });
    } else if (t.closest('[data-icen-kb-connector-schedule]')) {
      emitIcen(card, 'icen:kb-connector-schedule', { connectorId, schedule: card.dataset.icenSchedule ?? '' });
    }
  };

  target.addEventListener('click', onClick);
  return () => {
    target.removeEventListener('click', onClick);
    marked.__icenKbConnectorInit = false;
  };
}
