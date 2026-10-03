/*
 * @icen.ai/ui — Behavior: kb-audit（权限域 kb-perm：权限审计时间线——通道过滤 + 权限异味节 +
 * 事件时间线，与 components/kb-perm.css 段B 配套；spec docs/spec/kb-family.md §9.4）
 *
 * DOM 契约（renderKbAudit 构建）：
 *   <div class="kb-audit" data-active-channel="all|read|permission|request|system">
 *     <div class="kb-audit-bar">
 *       <div class="kb-audit-channels" role="group" aria-label="审计通道过滤">
 *         <button class="kb-chip" data-channel="all" aria-pressed="true">全部</button>
 *         <button class="kb-chip" data-channel="read" aria-pressed="false">读取</button>
 *         <button class="kb-chip" data-channel="permission" aria-pressed="false">权限变更</button>
 *         <button class="kb-chip" data-channel="request" aria-pressed="false">申请</button>
 *         <button class="kb-chip" data-channel="system" aria-pressed="false">系统</button>
 *       </div>
 *       <button class="kb-audit-export" data-audit-export>导出 CSV</button>
 *     </div>
 *     <div class="kb-audit-hygiene">                       <!-- opts.hygiene 传入才渲染 -->
 *       <div class="kb-hygiene is-high|is-medium|is-low" data-hygiene-id="…">
 *         <span class="kb-badge">过度共享</span>            <!-- kbHygieneLabel(kind) -->
 *         <span class="kb-hygiene-resource">Q3 薪酬表.xlsx</span>
 *         <span class="kb-num kb-hygiene-metric">对 1,204 人可见</span>
 *         <span class="kb-meta kb-hygiene-hint">…处置建议…</span>
 *         <button class="kb-hygiene-act" data-hygiene-act>处置</button>
 *       </div>…
 *     </div>
 *     <ol class="kb-audit-list">
 *       <li class="kb-audit-entry [is-breakglass]" data-channel="read|permission|request|system">
 *         <span class="kb-audit-at kb-num">10-03 14:22</span>
 *         <span class="kb-audit-actor" data-kind="human|app|system">张三</span>
 *         <span class="kb-audit-action kb-chip">读取</span>          <!-- kbAuditActionLabel -->
 *         <span class="kb-audit-detail">下载导出 · Q3 财报.xlsx</span> <!-- 资源并入 detail 尾部 -->
 *         <span class="kb-meta kb-audit-alert">已实时告警安全团队</span> <!-- 仅 break-glass 行 -->
 *       </li>…
 *     </ol>
 *   </div>
 *
 * mock 示例：
 *   renderKbAudit(el, {
 *     entries: [
 *       { id: 'a1', at: new Date().toISOString(), actor: { kind: 'human', name: '张三' },
 *         action: 'read', resource: 'Q3 财报.xlsx', detail: '下载导出 12 条记录' },
 *       { id: 'a2', at: new Date().toISOString(), actor: { kind: 'app', name: '权限同步服务' },
 *         action: 'break_glass', resource: '董事会纪要', detail: '应急访问 · 双人复核中', breakGlass: true },
 *     ],
 *     hygiene: [{ id: 'h1', kind: 'overexposed', resource: 'Q3 薪酬表.xlsx',
 *                 metric: '对 1,204 人可见', hint: '建议收紧为薪酬组', severity: 'high' }],
 *   });
 *   const dispose = initKbAudit();   // document 委托；销毁时 dispose()
 *
 * 行为说明：
 *   - renderKbAudit(el, opts)：快照渲染（重复调用整段重建）；entries 经 normalizeAuditEntry、
 *     hygiene 经 normalizeHygieneIssue 宽进严出；行 data-channel = auditChannelOf(action)（渲染时写死，
 *     过滤即纯 DOM 显隐）；空 entries 渲染 .kb-empty。
 *   - initKbAudit(root?)：幂等标记（root.__icenKbAuditInit）+ 返回销毁函数（可重新 init）；委托：
 *       · 通道 chip → 更新容器 data-active-channel + 全部 chip 的 aria-pressed + 逐行显隐
 *         （JS 直控 .kb-audit-entry.hidden——CSS 兄弟选择器跨层不可靠，不用）
 *         → 派 icen:kb-audit-filter {channel}
 *       · 导出钮 → 派 icen:kb-audit-export {channel}（channel = 当前激活通道，含 'all'；
 *         CSV 生成本身是宿主职责，UI 只声明意图）
 *       · 异味处置钮 → 派 icen:kb-hygiene-action {issue}（issue = 渲染时登记的 normalize 后对象）
 *   - 数据侧纪律（UI 不重复实现）：读取事件同用户同资源 5 分钟窗口去重由数据层负责
 *     （Microsoft Purview 范式——审计采集端折叠重复读取，时间线只呈现折叠后的事实），
 *     UI 对 entries 原样渲染、不去重不重排（时序与排序归数据侧，重排会破坏审计证据链）。
 *   - break-glass：行常驻警示色（.is-breakglass，CSS）+ 行尾「已实时告警安全团队」
 *     （审计粒度 ≥ 常规，§9.0.7）；is-breakglass 判定 = entry.breakGlass === true 或 action === 'break_glass'。
 *
 * 事件（events.ts 已登记）：
 *   icen:kb-audit-filter { channel }      — channel: 'all' | 'read' | 'permission' | 'request' | 'system'
 *   icen:kb-audit-export { channel }      — 同上，导出当前过滤视图
 *   icen:kb-hygiene-action { issue }      — 权限异味处置入口
 *
 * 渲染只写 textContent/createElement（禁 innerHTML），无 SVG 需求；SSR 下 render* 原样返回 el、
 * init* 返回 no-op 销毁。
 */

import {
  auditChannelOf,
  h,
  kbAuditActionLabel,
  kbHygieneLabel,
  normalizeAuditEntry,
  normalizeHygieneIssue,
  type KbAuditEntry,
  type KbHygieneIssue,
} from './kb-core';
import { emitIcen } from './events';

/** renderKbAudit 入参（宽进：契约对象或素对象皆可，内部 normalize） */
export interface KbAuditOptions {
  /** 审计事件（原样渲染；排序与读取去重归数据侧，见文件头纪律说明） */
  entries: Array<KbAuditEntry | Record<string, unknown>>;
  /** 权限异味节（传入才渲染该节） */
  hygiene?: Array<KbHygieneIssue | Record<string, unknown>>;
}

/** 通道 chip 的标签表（顺序即渲染顺序；data-channel 值 = KbAuditChannel | 'all'） */
const CHANNEL_CHIPS: ReadonlyArray<readonly [string, string]> = [
  ['all', '全部'],
  ['read', '读取'],
  ['permission', '权限变更'],
  ['request', '申请'],
  ['system', '系统'],
];

/** 审计时间戳：MM-DD HH:mm（本地时区；跨年事件由数据侧补年份列，UI 保持行内紧凑） */
function fmtStamp(at: string): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return at || '—';
  const d = new Date(t);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 异味行 → normalize 后 issue 的委托查表（render 登记，init 处置时取用） */
const hygieneIssueMap = new WeakMap<HTMLElement, KbHygieneIssue>();

/**
 * 渲染权限审计时间线（快照式：重复调用整段重建 el 内容），返回挂载元素 el。
 * 结构：通道过滤 bar + 导出钮 → 权限异味节（opts.hygiene 传入才渲染）→ 事件时间线。
 */
export function renderKbAudit(el: HTMLElement, opts: KbAuditOptions): HTMLElement {
  if (typeof document === 'undefined') return el;

  const entries = (Array.isArray(opts.entries) ? opts.entries : []).map(normalizeAuditEntry);
  const hygiene = Array.isArray(opts.hygiene) ? opts.hygiene.map(normalizeHygieneIssue) : undefined;

  el.textContent = '';
  const root = h('div', 'kb-audit');
  root.dataset.activeChannel = 'all';

  /* bar：通道 chip 组 + 导出钮（导出意图走事件，CSV 生成归宿主） */
  const bar = h('div', 'kb-audit-bar');
  const channels = h('div', 'kb-audit-channels');
  channels.setAttribute('role', 'group');
  channels.setAttribute('aria-label', '审计通道过滤');
  for (const [value, label] of CHANNEL_CHIPS) {
    const chip = h('button', 'kb-chip', label);
    chip.type = 'button';
    chip.dataset.channel = value;
    chip.setAttribute('aria-pressed', String(value === 'all'));
    channels.appendChild(chip);
  }
  bar.appendChild(channels);
  const exportBtn = h('button', 'kb-audit-export', '导出 CSV');
  exportBtn.type = 'button';
  exportBtn.dataset.auditExport = '';
  exportBtn.setAttribute('aria-label', '导出当前过滤视图为 CSV');
  bar.appendChild(exportBtn);
  root.appendChild(bar);

  /* 权限异味节（治理发现；传入才渲染——空数组给「未发现」回执，不给空洞容器） */
  if (hygiene) {
    const section = h('div', 'kb-audit-hygiene');
    section.setAttribute('role', 'list');
    section.setAttribute('aria-label', '权限异味');
    if (!hygiene.length) {
      section.appendChild(h('div', 'kb-empty', '未发现权限异味'));
    } else {
      for (const issue of hygiene) {
        const row = h('div', `kb-hygiene is-${issue.severity}`);
        row.setAttribute('role', 'listitem');
        row.dataset.hygieneId = issue.id;
        hygieneIssueMap.set(row, issue); /* 处置钮委托取用（init 时） */
        row.appendChild(h('span', 'kb-badge kb-hygiene-kind', kbHygieneLabel(issue.kind)));
        row.appendChild(h('span', 'kb-hygiene-resource', issue.resource));
        row.appendChild(h('span', 'kb-num kb-hygiene-metric', issue.metric));
        row.appendChild(h('span', 'kb-meta kb-hygiene-hint', issue.hint));
        const act = h('button', 'kb-hygiene-act', '处置');
        act.type = 'button';
        act.dataset.hygieneAct = '';
        act.setAttribute('aria-label', `处置：${kbHygieneLabel(issue.kind)} · ${issue.resource}`);
        row.appendChild(act);
        section.appendChild(row);
      }
    }
    root.appendChild(section);
  }

  /* 时间线：at / actor / action chip / detail（资源并入尾部）/ break-glass 行尾告警回执 */
  const list = h('ol', 'kb-audit-list');
  if (!entries.length) {
    list.appendChild(h('li', 'kb-empty', '暂无审计事件'));
  } else {
    for (const e of entries) {
      const breakglass = e.breakGlass || e.action === 'break_glass';
      const row = h('li', `kb-audit-entry${breakglass ? ' is-breakglass' : ''}`);
      row.dataset.channel = auditChannelOf(e.action); /* 渲染时写死通道，过滤 = 纯显隐 */
      row.appendChild(h('span', 'kb-audit-at kb-num', fmtStamp(e.at)));
      const actor = h('span', 'kb-audit-actor', e.actor.name);
      actor.dataset.kind = e.actor.kind; /* system/app 弱化色（CSS） */
      row.appendChild(actor);
      row.appendChild(h('span', 'kb-audit-action kb-chip', kbAuditActionLabel(e.action)));
      /* 资源缺省并入 detail：'下载导出 12 条' · 'Q3 财报.xlsx'（时间线保持四列紧凑） */
      row.appendChild(h('span', 'kb-audit-detail', e.resource ? `${e.detail} · ${e.resource}` : e.detail));
      if (breakglass) row.appendChild(h('span', 'kb-meta kb-audit-alert', '已实时告警安全团队'));
      list.appendChild(row);
    }
  }
  root.appendChild(list);

  el.appendChild(root);
  return el;
}

interface AuditScope extends ParentNode {
  __icenKbAuditInit?: boolean;
}

const noopDestroy = (): void => undefined;

/**
 * 初始化审计交互（root 级委托，缺省 document；幂等标记 + 返回销毁函数，销毁后可重新 init）：
 * 通道过滤（JS 直控行显隐 + aria-pressed + 容器 data-active-channel）/ 导出 / 异味处置。
 * SSR 返回 no-op。
 */
export function initKbAudit(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return noopDestroy;
  const scope = root ?? document;
  const marked = scope as AuditScope;
  if (marked.__icenKbAuditInit) return noopDestroy;
  marked.__icenKbAuditInit = true;
  const target = scope as ParentNode & EventTarget;

  /** 应用通道过滤：容器 data-active-channel（供样式钩子）+ chip aria-pressed + 行显隐 */
  const applyFilter = (auditRoot: HTMLElement, channel: string): void => {
    auditRoot.dataset.activeChannel = channel;
    auditRoot.querySelectorAll<HTMLButtonElement>('.kb-audit-channels .kb-chip').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.channel === channel));
    });
    auditRoot.querySelectorAll<HTMLElement>('.kb-audit-entry').forEach((row) => {
      row.hidden = channel !== 'all' && row.dataset.channel !== channel;
    });
  };

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;

    /* 异味处置：先命中（行内还有其他可点区域的余地） */
    const actBtn = t.closest<HTMLButtonElement>('[data-hygiene-act]');
    if (actBtn) {
      const row = actBtn.closest<HTMLElement>('.kb-hygiene');
      const issue = row ? hygieneIssueMap.get(row) : undefined;
      if (issue) emitIcen(actBtn, 'icen:kb-hygiene-action', { issue });
      return;
    }

    const auditRoot = t.closest<HTMLElement>('.kb-audit');
    if (!auditRoot) return;

    /* 通道过滤（chip 是按钮；含 'all'） */
    const chip = t.closest<HTMLButtonElement>('.kb-audit-channels .kb-chip[data-channel]');
    if (chip) {
      const channel = chip.dataset.channel ?? 'all';
      applyFilter(auditRoot, channel);
      emitIcen(chip, 'icen:kb-audit-filter', { channel: channel as 'all' | 'read' | 'permission' | 'request' | 'system' });
      return;
    }

    /* 导出：意图事件（CSV 生成归宿主），channel = 当前激活通道 */
    const exportBtn = t.closest<HTMLButtonElement>('[data-audit-export]');
    if (exportBtn) {
      const channel = auditRoot.dataset.activeChannel ?? 'all';
      emitIcen(exportBtn, 'icen:kb-audit-export', { channel: channel as 'all' | 'read' | 'permission' | 'request' | 'system' });
    }
  };

  target.addEventListener('click', onClick);
  return () => {
    target.removeEventListener('click', onClick);
    marked.__icenKbAuditInit = false;
  };
}
