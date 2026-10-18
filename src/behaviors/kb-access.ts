/*
 * @icen.ai/ui — Behavior: kb-access（权限域 kb-perm：访问申请流——被拒五件套 + 状态机，
 * 与 components/kb-perm.css 段B 配套；spec docs/spec/kb-family.md §9.3）
 *
 * DOM 契约（requester 模式）：
 *   <div class="icen-kb-access" data-icen-state="idle|requested|pending_review|granted|expiring|expired|denied|revoked">
 *     <div class="icen-kb-access-denied">                        ← 被拒五件套（未获权状态才呈现）
 *       <div class="icen-kb-access-title">🔒 资源名</div>          ← 资源名（锁形 svg 经 svgIcon 消毒）
 *       <p class="icen-kb-access-why">此内容仅对授权者开放…</p>     ← 原因文案（opts.deniedHint 缺省模板）
 *       <div class="icen-kb-access-owner">负责人：内容 owner 李四</div>
 *       <div class="icen-kb-access-actions">
 *         <button class="icen-kb-access-btn" data-icen-access-request>申请访问</button>      ← 主作用（icen-accent）
 *         <button class="icen-kb-access-btn--ghost" data-icen-access-switch>切换身份</button> ← 次作用（宿主回调，
 *                                                                            不派库事件——身份切换是宿主关注）
 *       </div>
 *     </div>
 *     <icen-form class="icen-kb-access-form" hidden>                  ← data-icen-access-request 点开（再点收起）
 *       <icen-textarea class="icen-kb-access-reason" placeholder="说明业务原因（审批人可见）"></icen-textarea>
 *       <div class="icen-kb-access-roles">
 *         <button class="icen-kb-access-role [is-on]" data-icen-role="viewer|commenter|editor">可查看…</button>×3
 *       </div>                                              ← 角色三选（请求方不可申请 owner）
 *       <label class="icen-kb-access-duration-row">访问时长
 *         <icen-select class="icen-kb-access-duration"><option value="">永久</option>
 *           <option value="7">7 天</option><option value="30">30 天</option></icen-select>
 *       </label>
 *       <div class="icen-kb-meta icen-kb-access-route">请求将发送给：内容 owner 李四</div>   ← 路由明示（§9.0.2 审批路由）
 *       <button class="icen-kb-access-submit" data-icen-access-submit>提交申请</button>
 *     </icen-form>
 *     <div class="icen-kb-access-state">                         ← 状态徽章族（kbAccessStateLabel）
 *       <span class="icen-kb-chip" data-icen-state="granted">已开通</span>
 *       <span class="icen-kb-num icen-kb-access-countdown">7 天后到期</span>                ← granted/expiring 附倒计时
 *       <button class="icen-kb-access-act" data-icen-access-renew>申请续期</button>         ← expiring（warning）
 *       <button class="icen-kb-access-act" data-icen-access-reapply>重新申请</button>       ← expired/denied/revoked 回表单
 *     </div>
 *   </div>
 *
 * DOM 契约（approver 模式）：
 *   <div class="icen-kb-access icen-kb-access--approver" data-icen-state="requested">
 *     <div class="icen-kb-access-queue">
 *       <div class="icen-kb-access-req">
 *         <span class="icen-kb-access-req-user">张三</span>
 *         <span class="icen-kb-access-req-resource">Q3 财报</span>
 *         <span class="icen-kb-chip">可查看</span>               ← 申请角色 chip
 *         <span class="icen-kb-meta">接入财务系统做对账</span>      ← 理由（无则不渲染）
 *         <span class="icen-kb-num">3 分钟前</span>               ← relativeTime(submittedAt)
 *         <span class="icen-kb-access-req-actions">
 *           <icen-select class="icen-kb-access-approve-role">viewer|commenter|editor</icen-select>
 *           <button class="icen-kb-access-btn--ghost" data-icen-access-approve>批准</button>
 *           <icen-textarea class="icen-kb-access-note" placeholder="给请求人的留言（可选）"></icen-textarea>
 *           <button class="icen-kb-access-btn--ghost" data-icen-access-deny>拒绝</button>
 *         </span>
 *       </div>
 *     </div>
 *     <div class="icen-kb-access-state">…决定后回显（已批准 · 可编辑 / 已拒绝）</div>
 *   </div>
 *
 * mock 示例：
 *   createKbAccess(el, {
 *     request: { id: 'req-1', requester: '张三', resource: 'Q3 财报 · 财务部空间',
 *                role: 'viewer', state: 'idle', submittedAt: new Date().toISOString(),
 *                approverNote: '内容 owner 李四' },
 *     deniedHint: '此文档标记为「机密」，需要负责人单独授权',
 *     onRequest: (r) => api.submit(r),
 *   });
 *
 * 状态机（快照语义，不设定时器；宿主持数据，组件只在渲染瞬间做时间派生）：
 *   idle ──提交表单──▶ requested（派 icen:kb-access-request {request}）
 *   requested/pending_review ──审批侧 setState──▶ granted(可带 expiresAt) / denied / revoked
 *   granted ──expiresAt 落入 7 天窗口──▶ expiring（渲染时派生：warning + 申请续期）
 *   granted/expiring ──expiresAt 已过──▶ expired（渲染时自动转 + 派 icen:kb-access-expire {id}；
 *                                          setState('granted') 传过去时间同样处理——到期演示路径）
 *   expired/denied/revoked ──重新申请──▶ 回表单 → requested（续期走同一 request 事件，数据侧关联原单）
 *
 * denied 呈现纪律（§9.3）：不做刺眼红色终态（业界静默默契）——中性灰文案
 * 「未通过——可调整理由后重新申请」，主推重新申请而非惩罚性终态。
 *
 * 事件（events.ts 已登记；与 opts.onRequest / opts.onDecide 回调双通道）：
 *   icen:kb-access-request { request }                       — 表单提交（新申请与续期/重申请同通道）
 *   icen:kb-access-decide  { id, decision:'approve'|'deny', role? } — approver 批准（带最终角色）/ 拒绝
 *   icen:kb-access-expire  { id }                            — 渲染瞬间发现已过期（快照派生）
 *   拒绝留言：事件契约冻结不含留言字段；textarea 留言仅作 UI 便利，宿主需要时在
 *   onDecide 回调里读取 DOM（.icen-kb-access-note 的 value）或走自有通道——不在库事件里私加字段。
 *
 * 渲染只写 textContent/createElement（禁 innerHTML），SVG 一律经 svgIcon() 消毒；
 * SSR（无 document）返回静态句柄：setState/destroy no-op、getState 返回 normalize 后的请求副本。
 */

import {
  h,
  KB_ROLES,
  kbAccessStateLabel,
  kbRoleLabel,
  normalizeAccessRequest,
  relativeTime,
  svgIcon,
  type KbAccessRequest,
  type KbAccessState,
  type KbRole,
} from './kb-core';
import { kbSelect } from './kb-select';
import { emitIcen } from './events';
import { t as icenT } from './i18n';

/* ── 图标（单色线性 1.5px，一律经 svgIcon 消毒） ── */

const ico = (d: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICON_LOCK = ico('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>');
const ICON_USER_SWITCH = ico('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>');

/** createKbAccess 入参（spec §9.3；request 宽进——素对象经 normalizeAccessRequest 归一） */
export interface KbAccessOpts {
  /** 当前访问请求（内部持有副本，不打脏调用方数据） */
  request: KbAccessRequest | Record<string, unknown>;
  /** requester = 申请人视角（被拒五件套 + 表单）；approver = 审批人视角（队列卡）。缺省 requester */
  mode?: 'requester' | 'approver';
  /** 表单提交回调（与 icen:kb-access-request 双通道） */
  onRequest?: (r: KbAccessRequest) => void;
  /** 审批决定回调（与 icen:kb-access-decide 双通道；approve 时 role = 批准档位） */
  onDecide?: (id: string, decision: 'approve' | 'deny', role?: KbRole) => void;
  /** 被拒原因文案（缺省固定模板「此内容仅对授权者开放」——不给受限侧任何更多信息，§9.0.3） */
  deniedHint?: string;
  /** 切换身份回调（宿主关注：切换固定身份集重查权限；不派库事件） */
  onSwitchIdentity?: () => void;
}

/** createKbAccess 句柄（函数名冻结于 spec §9.3） */
export interface KbAccessHandle {
  /** 合并更新请求字段（Partial）或整体切状态（单字符串）；带过期时间的 granted 会即时派生 expired */
  setState(next: Partial<KbAccessRequest> | KbAccessState): void;
  /** 当前请求（normalize 后的副本；外部修改不影响内部） */
  getState(): KbAccessRequest;
  /** 清空 DOM 与标记（幂等；同一 el 重复 create 会先销毁旧实例） */
  destroy(): void;
}

/** 即将到期派生窗口：granted 且 expiresAt 距今 ≤7 天 → 渲染为 expiring（与表单「7 天」档同尺度） */
const EXPIRING_WINDOW_MS = 7 * 86_400_000;
let accessFormSequence = 0;

/** 请求方可申请的角色（owner 不开放自助申请——负责人由治理侧指定） */
const REQUESTABLE_ROLES: readonly KbRole[] = ['viewer', 'commenter', 'editor'];

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * 未来向倒计时文案（relativeTime 是过去向语义——到期是未来向，故本地小函数）：
 * 'N 分钟后' / 'N 小时后' / 'N 天后'；已到点返回 '已到期'；不可解析返回 ''。
 */
function untilText(at: string | undefined, now: Date): string {
  if (!at) return '';
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return '';
  const diff = t - now.getTime();
  if (diff <= 0) return icenT('kbAccess.expired');
  if (diff < HOUR_MS) return icenT('kbAccess.minutesLeft', { p0: Math.max(1, Math.floor(diff / MIN_MS)) });
  if (diff < DAY_MS) return icenT('kbAccess.hoursLeft', { p0: Math.floor(diff / HOUR_MS) });
  return icenT('kbAccess.daysLeft', { p0: Math.floor(diff / DAY_MS) });
}

/** expiresAt 是否为可解析时间 */
function parseTs(at: string | undefined): number | null {
  if (!at) return null;
  const t = Date.parse(at);
  return Number.isFinite(t) ? t : null;
}

interface AccessHost extends HTMLElement {
  __icenKbAccess?: { destroy(): void };
}

/**
 * 创建访问申请流（requester：被拒五件套 + 表单 + 状态徽章族；approver：审批队列卡）。
 * 申请端保留原生表单节点：setState 不打断选区、组合输入与时长；切换资源才清空草稿。
 */
export function createKbAccess(el: HTMLElement, opts: KbAccessOpts): KbAccessHandle {
  const host = el as AccessHost;

  /* SSR：静态句柄（方法 no-op；getState 返回 normalize 后的请求副本） */
  if (typeof document === 'undefined') {
    const snapshot = normalizeAccessRequest(opts.request);
    return {
      setState: () => undefined,
      getState: () => ({ ...snapshot }),
      destroy: () => undefined,
    };
  }

  host.__icenKbAccess?.destroy(); /* 同一 el 重复 create：先销毁旧实例 */
  host.replaceChildren();

  const mode = opts.mode === 'approver' ? 'approver' : 'requester';
  let req = normalizeAccessRequest(opts.request);
  let destroyed = false;

  /* 表单本地态（重建时保留用户输入） */
  let formOpen = false;
  let formRole: KbRole = REQUESTABLE_ROLES.includes(req.role) ? req.role : 'viewer';
  let formDuration = '';
  let formReason = req.reason ?? '';
  let formEl: HTMLFormElement | null = null;
  let deniedKey = '';
  const formId = `icen-kb-access-form-${++accessFormSequence}`;

  /** 渲染瞬间的到期派生：过期 → expired（派事件一次）；7 天窗口内 → expiring。快照语义，不设定时器。 */
  const deriveExpiry = (): void => {
    if (req.state !== 'granted' && req.state !== 'expiring') return;
    const t = parseTs(req.expiresAt);
    if (t == null) return;
    const now = Date.now();
    if (t <= now) {
      req = { ...req, state: 'expired' };
      /* 到期回收是授权侧事实（对授权侧诚实），派事件供宿主同步数据 */
      emitIcen(host, 'icen:kb-access-expire', { id: req.id });
      return;
    }
    if (t - now <= EXPIRING_WINDOW_MS && req.state === 'granted') {
      req = { ...req, state: 'expiring' }; /* 派生呈现态；数据侧可滞后，UI 先诚实 */
    }
  };

  /* ── 表单提交：组请求 → requested → 派事件 + 回调 → 收起表单 ── */
  const submitForm = (form: HTMLFormElement): void => {
    if (destroyed || !formOpen || req.state === 'requested' || req.state === 'pending_review') return;
    const ownedFocus = host.contains(host.ownerDocument.activeElement);
    const reasonEl = form.querySelector<HTMLTextAreaElement>('.icen-kb-access-reason');
    const durationEl = form.querySelector<HTMLInputElement>('.icen-kb-access-duration input[data-icen-select-value]');
    const reason = reasonEl?.value.trim() ?? '';
    const days = Number(durationEl?.value ?? '');
    const expiresAt =
      Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * DAY_MS).toISOString() : undefined;
    formReason = reason;
    formDuration = durationEl?.value ?? '';
    req = normalizeAccessRequest({
      ...req,
      role: formRole,
      reason: reason || undefined,
      expiresAt,
      state: 'requested',
      submittedAt: new Date().toISOString(),
    });
    formOpen = false;
    render();
    if (ownedFocus) host.querySelector<HTMLElement>('.icen-kb-access-state')?.focus({preventScroll:true});
    emitIcen(host, 'icen:kb-access-request', { request: { ...req } });
    opts.onRequest?.({ ...req });
  };

  /* ── 审批决定：更新本地状态（回显决定），事件 + 回调双通道 ── */
  const decide = (decision: 'approve' | 'deny', role?: KbRole): void => {
    if (destroyed) return;
    req = normalizeAccessRequest({
      ...req,
      state: decision === 'approve' ? 'granted' : 'denied',
      role: decision === 'approve' && role && KB_ROLES.includes(role) ? role : req.role,
      decidedAt: new Date().toISOString(),
    });
    emitIcen(host, 'icen:kb-access-decide', {
      id: req.id,
      decision,
      role: decision === 'approve' ? req.role : undefined,
    });
    opts.onDecide?.(req.id, decision, decision === 'approve' ? req.role : undefined);
    render();
  };

  /* ── 构件小件 ── */

  const ghostBtn = (label: string, attr: string, title?: string): HTMLButtonElement => {
    const btn = h('button', 'icen-kb-access-btn icen-kb-access-btn--ghost', label);
    btn.type = 'button';
    btn.setAttribute(attr, '');
    if (title) btn.setAttribute('aria-label', title);
    return btn;
  };

  /** 被拒五件套卡（资源名 / 原因 / owner / 申请 / 切换身份） */
  const buildDeniedCard = (): HTMLElement => {
    const card = h('div', 'icen-kb-access-denied');
    const title = h('div', 'icen-kb-access-title');
    const lock = svgIcon(ICON_LOCK);
    if (lock) title.appendChild(lock);
    title.appendChild(h('span', undefined, req.resource || icenT('kbAccess.restrictedContent')));
    card.appendChild(title);
    /* 原因文案：deniedHint ?? 固定模板（模板零信息增量——不给受限侧任何可探测分支，§9.0.3） */
    card.appendChild(h('p', 'icen-kb-access-why', opts.deniedHint ?? icenT('kbAccess.restrictedHint')));
    card.appendChild(h('div', 'icen-kb-access-owner', icenT('kbAccess.ownerPrefix', { p0: req.approverNote || icenT('kbAccess.ownerLabel') })));

    const actions = h('div', 'icen-kb-access-actions');
    const primary = h('button', 'icen-kb-access-btn', icenT('common.requestAccess'));
    primary.type = 'button';
    primary.dataset.icenAccessRequest = '';
    primary.setAttribute('aria-controls', formId);
    primary.setAttribute('aria-label', icenT('common.requestAccessFor', { p0: req.resource || icenT('kbAccess.defaultSubject') }));
    primary.addEventListener('click', () => {
      if (destroyed) return;
      formOpen = !formOpen; /* 再点收起 = 免取消钮的关闭路径 */
      render();
      if (formOpen) formEl?.querySelector<HTMLTextAreaElement>('.icen-kb-access-reason')?.focus({preventScroll:true});
    });
    actions.appendChild(primary);
    const switchBtn = ghostBtn(icenT('kbAccess.switchIdentity'), 'data-icen-access-switch', icenT('kbAccess.switchIdentityTip'));
    const switchIcon = svgIcon(ICON_USER_SWITCH);
    if (switchIcon) switchBtn.prepend(switchIcon);
    /* 身份切换是宿主关注（固定身份集的哪一员），不派库事件——只走回调 */
    switchBtn.addEventListener('click', () => opts.onSwitchIdentity?.());
    actions.appendChild(switchBtn);
    card.appendChild(actions);
    return card;
  };

  /** 申请表单（理由 + 角色三选 + 时长 + 路由明示 + 提交） */
  const buildForm = (): HTMLFormElement => {
    const form = h('form', 'icen-kb-access-form');
    form.id = formId;
    form.hidden = !formOpen;

    const reason = document.createElement('textarea');
    reason.className = 'icen-kb-access-reason';
    reason.value = formReason;
    reason.placeholder = icenT('kbAccess.reasonPlaceholder');
    reason.setAttribute('aria-label', icenT('kbAccess.reasonLabel'));
    reason.rows = 3;
    form.appendChild(reason);

    const roles = h('div', 'icen-kb-access-roles');
    roles.setAttribute('role', 'group');
    roles.setAttribute('aria-label', icenT('kbAccess.roleLabel'));
    for (const r of REQUESTABLE_ROLES) {
      const chip = h('button', `icen-kb-access-role${formRole === r ? ' is-on' : ''}`, kbRoleLabel(r));
      chip.type = 'button';
      chip.dataset.icenRole = r;
      chip.setAttribute('aria-pressed', String(formRole === r));
      chip.addEventListener('click', () => {
        if (destroyed) return;
        formRole = r;
        roles.querySelectorAll<HTMLButtonElement>('[data-icen-role]').forEach(option => {
          const selected = option.dataset.icenRole === r;
          option.classList.toggle('is-on', selected);
          option.setAttribute('aria-pressed', String(selected));
        });
      });
      roles.appendChild(chip);
    }
    form.appendChild(roles);

    const durationRow = h('label', 'icen-kb-access-duration-row');
    durationRow.appendChild(h('span', undefined, icenT('kbAccess.durationLabel')));
    const duration = kbSelect({
      cls: 'icen-kb-access-duration',
      sm: true,
      options: [
        { value: '', label: icenT('kbAccess.durationForever') },
        { value: '7', label: icenT('kbAccess.duration7d') },
        { value: '30', label: icenT('kbAccess.duration30d') },
      ],
      value: formDuration,
      ariaLabel: icenT('kbAccess.durationLabel'),
    });
    durationRow.appendChild(duration.el);
    form.appendChild(durationRow);

    /* 路由明示（Confluence 十年踩坑：请求发给谁必须写明，§9.0.2） */
    form.appendChild(h('div', 'icen-kb-meta icen-kb-access-route', icenT('kbAccess.requestToPrefix', { p0: req.approverNote || icenT('kbAccess.ownerLabel') })));

    const submit = h('button', 'icen-kb-access-submit', icenT('kbAccess.submitRequest'));
    submit.type = 'submit';
    submit.dataset.icenAccessSubmit = '';
    form.appendChild(submit);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForm(form);
    });
    return form;
  };

  /** 状态徽章族：chip + 倒计时 + 续期/重申请文字钮（denied 中性化，revoked 弱化） */
  const buildStateRow = (): HTMLElement => {
    const row = h('div', 'icen-kb-access-state');
    row.setAttribute('role', 'status');
    row.setAttribute('aria-atomic', 'true');
    row.tabIndex = -1;
    const chip = h('span', 'icen-kb-chip', kbAccessStateLabel(req.state));
    chip.dataset.icenState = req.state;
    row.appendChild(chip);

    const countdown = untilText(req.expiresAt, new Date());
    if ((req.state === 'granted' || req.state === 'expiring') && countdown) {
      row.appendChild(h('span', 'icen-kb-num icen-kb-access-countdown', icenT('kbAccess.expiresAt', { p0: countdown })));
    }

    if (req.state === 'requested' || req.state === 'pending_review') {
      row.appendChild(h('span', 'icen-kb-meta', icenT('kbAccess.waitingApproval', { p0: req.approverNote || icenT('kbAccess.ownerLabel') })));
      return row;
    }
    if (req.state === 'expiring') {
      const renew = h('button', 'icen-kb-access-act', icenT('kbAccess.requestRenewal'));
      renew.type = 'button';
      renew.dataset.icenAccessRenew = '';
      renew.addEventListener('click', () => {
        formOpen = true; /* 续期走同一表单/同一 request 事件，数据侧关联原授权 */
        render();
        formEl?.querySelector<HTMLTextAreaElement>('.icen-kb-access-reason')?.focus({preventScroll:true});
      });
      row.appendChild(renew);
      return row;
    }
    if (req.state === 'expired') {
      const reapply = h('button', 'icen-kb-access-act', icenT('kbAccess.reapply'));
      reapply.type = 'button';
      reapply.dataset.icenAccessReapply = '';
      reapply.addEventListener('click', () => {
        formOpen = true;
        render();
        formEl?.querySelector<HTMLTextAreaElement>('.icen-kb-access-reason')?.focus({preventScroll:true});
      });
      row.appendChild(reapply);
      return row;
    }
    if (req.state === 'denied') {
      /* 不做刺眼红色终态（业界静默默契）：中性灰文案 + 可再次尝试，永不惩罚性断头 */
      row.appendChild(h('span', 'icen-kb-meta', icenT('kbAccess.deniedHint')));
      const reapply = h('button', 'icen-kb-access-act', icenT('kbAccess.reapply'));
      reapply.type = 'button';
      reapply.dataset.icenAccessReapply = '';
      reapply.addEventListener('click', () => {
        formOpen = true;
        render();
        formEl?.querySelector<HTMLTextAreaElement>('.icen-kb-access-reason')?.focus({preventScroll:true});
      });
      row.appendChild(reapply);
      return row;
    }
    if (req.state === 'revoked') {
      row.appendChild(h('span', 'icen-kb-meta', icenT('kbAccess.revokedHint')));
      const reapply = h('button', 'icen-kb-access-act', icenT('kbAccess.reapply'));
      reapply.type = 'button';
      reapply.dataset.icenAccessReapply = '';
      reapply.addEventListener('click', () => {
        formOpen = true;
        render();
        formEl?.querySelector<HTMLTextAreaElement>('.icen-kb-access-reason')?.focus({preventScroll:true});
      });
      row.appendChild(reapply);
    }
    return row;
  };

  /** approver 队列卡：请求人/资源/角色/理由/时间 + 批准（选档确认）/ 拒绝（附留言可选） */
  const buildQueue = (): HTMLElement => {
    const queue = h('div', 'icen-kb-access-queue');
    const card = h('div', 'icen-kb-access-req');

    card.appendChild(h('span', 'icen-kb-access-req-user', req.requester || icenT('kbAccess.unknownRequester')));
    card.appendChild(h('span', 'icen-kb-access-req-resource', req.resource || icenT('kbAccess.restrictedContent')));
    card.appendChild(h('span', 'icen-kb-chip kb-access-req-role', kbRoleLabel(req.role)));
    if (req.reason) card.appendChild(h('span', 'icen-kb-meta icen-kb-access-req-reason', req.reason));
    card.appendChild(h('span', 'icen-kb-num icen-kb-access-req-at', relativeTime(req.submittedAt)));

    const pending = req.state === 'idle' || req.state === 'requested' || req.state === 'pending_review';
    if (pending) {
      const actions = h('span', 'icen-kb-access-req-actions');

      const roleSel = kbSelect({
        cls: 'icen-kb-access-approve-role',
        sm: true,
        options: REQUESTABLE_ROLES.map((r) => ({ value: r, label: icenT('kbAccess.grantAsPrefix', { p0: kbRoleLabel(r) }) })),
        value: REQUESTABLE_ROLES.includes(req.role) ? req.role : 'viewer',
        ariaLabel: icenT('kbAccess.grantRoleLabel'),
      });
      actions.appendChild(roleSel.el);

      const approve = ghostBtn(icenT('common.approve'), 'data-icen-access-approve', icenT('kbAccess.approveTip'));
      approve.addEventListener('click', () => decide('approve', roleSel.getValue() as KbRole));
      actions.appendChild(approve);

      /* 拒绝留言：UI 便利；事件契约（冻结）不含留言字段，宿主经 onDecide 自行读取或走自有通道 */
      const note = document.createElement('textarea');
      note.className = 'icen-kb-access-note';
      note.placeholder = icenT('kbAccess.approverNotePlaceholder');
      note.rows = 1;
      note.setAttribute('aria-label', icenT('kbAccess.denyNoteLabel'));
      actions.appendChild(note);

      const deny = ghostBtn(icenT('common.reject'), 'data-icen-access-deny', icenT('kbAccess.rejectTip'));
      deny.addEventListener('click', () => decide('deny'));
      actions.appendChild(deny);

      card.appendChild(actions);
    } else {
      /* 已决定回显（决定人视角的时间与结论，对授权侧诚实） */
      const decided = req.state === 'granted' || req.state === 'expiring' ? icenT('kbAccess.approvedBadge', { p0: kbRoleLabel(req.role) }) : kbAccessStateLabel(req.state);
      const echo = h('span', 'icen-kb-meta icen-kb-access-req-decided', decided);
      if (req.decidedAt) echo.appendChild(h('span', 'icen-kb-num', ` · ${relativeTime(req.decidedAt)}`));
      card.appendChild(echo);
    }

    queue.appendChild(card);
    return queue;
  };

  /* Requester controls retain their native identity: selection, IME composition,
   * scroll position and focus survive status/owner updates. */
  const render = (): void => {
    if (destroyed) return;
    deriveExpiry();
    if (destroyed) return; // An expiry listener may synchronously dispose this instance.

    /* 打断保护：宿主 setState 触发的重渲不吞掉用户已输入未提交的内容 */
    const prevReason = host.querySelector<HTMLTextAreaElement>('.icen-kb-access-reason');
    if (prevReason) formReason = prevReason.value;
    const prevDuration = host.querySelector<HTMLSelectElement>('.icen-kb-access-duration');
    if (prevDuration) formDuration = prevDuration.value;

    host.className = mode === 'approver' ? 'icen-kb-access icen-kb-access--approver' : 'icen-kb-access';
    host.dataset.icenState = req.state;
    if (mode === 'approver') {
      host.replaceChildren(buildQueue(), buildStateRow());
    } else {
      const grantedLike = req.state === 'granted' || req.state === 'expiring';
      if (!formEl) { formEl = buildForm(); host.appendChild(formEl); }
      formEl.hidden = !formOpen;
      const oldCard = host.querySelector('.icen-kb-access-denied');
      const key = JSON.stringify([req.resource, req.approverNote]);
      if (grantedLike) oldCard?.remove();
      else if (!oldCard || key !== deniedKey) {
        const card = buildDeniedCard();
        if (oldCard) oldCard.replaceWith(card);
        else host.insertBefore(card, formEl);
      }
      deniedKey = key;
      const requestButton = host.querySelector<HTMLButtonElement>('[data-icen-access-request]');
      if (requestButton) {
        requestButton.setAttribute('aria-expanded', String(formOpen));
        requestButton.disabled = req.state === 'requested' || req.state === 'pending_review';
      }
      const route = formEl.querySelector('.icen-kb-access-route');
      if (route) route.textContent = icenT('kbAccess.requestToPrefix', {p0:req.approverNote || icenT('kbAccess.ownerLabel')});
      const state = host.querySelector('.icen-kb-access-state');
      const nextState = buildStateRow();
      if (state) state.replaceChildren(...nextState.childNodes);
      else host.appendChild(nextState);
    }
  };

  const setState = (next: Partial<KbAccessRequest> | KbAccessState): void => {
    if (destroyed) return;
    const editing = formEl?.contains(host.ownerDocument.activeElement);
    const previous = req;
    req = normalizeAccessRequest(typeof next === 'string' ? { ...req, state: next } : { ...req, ...next });
    if (previous.id !== req.id || previous.resource !== req.resource || previous.requester !== req.requester) {
      formEl?.remove();
      formEl = null;
      formOpen = false;
      formReason = req.reason ?? '';
      formDuration = '';
      formRole = REQUESTABLE_ROLES.includes(req.role) ? req.role : 'viewer';
    }
    if (['granted', 'requested', 'pending_review'].includes(req.state)) formOpen = false;
    render();
    if (editing && !formOpen) host.querySelector<HTMLElement>('.icen-kb-access-state')?.focus({preventScroll:true});
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    formEl = null;
    host.replaceChildren();
    host.classList.remove('icen-kb-access', 'icen-kb-access--approver');
    delete host.dataset.icenState;
    delete host.__icenKbAccess;
  };
  host.__icenKbAccess = { destroy };

  render();
  return { setState, getState: () => ({ ...req }), destroy };
}
