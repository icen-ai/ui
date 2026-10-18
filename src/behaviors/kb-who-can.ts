/*
 * @icen.ai/ui — Behavior: kb-who-can（有效权限检查器 view-as：SharePoint Check Permissions /
 * Jira Permission Helper 范式；原因链 = 扁平清单不做树——业界缺口即本组件定位。
 * 权限域 kb-perm，spec docs/spec/kb-family.md §9.2；样式 components/kb-perm.css 段A）
 *
 * DOM 契约（renderKbWhoCan 装配，返回可操作句柄）：
 *   <div class="icen-kb-whocan">
 *     <div class="icen-kb-whocan-bar">
 *       <icen-select class="icen-kb-whocan-user" aria-label="检查身份">…固定身份集（option=value user）…</icen-select>
 *       <button class="icen-kb-whocan-check" data-icen-whocan-check>检查</button>
 *     </div>
 *     <div class="icen-kb-whocan-result [.is-allowed|.is-denied]">
 *       <div class="icen-kb-whocan-verdict">可编辑 / 无权限</div>                  ← kbRoleLabel(decision.role)
 *       [<div class="icen-kb-whocan-deniedby">被策略拒绝：DLP-外发管控</div>]      ← deny 一票否决置顶红条
 *       <ul class="icen-kb-whocan-chain">
 *         <li class="icen-kb-whocan-reason [.is-inherit|.is-direct|.is-link|.is-deny]">
 *           <span class="icen-kb-badge">继承|直接|链接|拒绝</span>
 *           <span class="icen-kb-whocan-source">finance-team</span>
 *           <span class="icen-kb-whocan-role icen-kb-chip">可编辑</span>
 *           [<span class="icen-kb-meta">24 成员 · 由 IT 管理</span>]               ← subject.note
 *         </li>…   （空链：未命中任何授权——默认拒绝 fail-closed）
 *       </ul>
 *       <div class="icen-kb-whocan-rule">叠加规则：多来源并集 → 可编辑；无 Deny 生效</div>
 *       [<div class="icen-kb-whocan-expires icen-kb-meta">最近到期 29 天后</div>]
 *     </div>
 *   </div>
 *
 * 行为：
 *   - 身份来自服务端验证 token 的固定身份集（spec §9.0 纪律 8：不接受自由输入身份/组）——
 *     select 变更即重算；「检查」钮（data-icen-whocan-check）显式重算；setIdentity 只接受集合内 id
 *   - evaluate 缺省 = kb-core evaluateAcl（先显式 deny → allow 并集 → 默认拒绝，fail-closed）
 *   - 每次重算派 icen:kb-whocan-check { identity, decision }（与 opts.onCheck 双通道）
 *   - 句柄（create* 约定）：setIdentity(id) / getResult() / destroy()；同元素重复 render 先拆旧装配
 *   - 空身份集：select 与检查钮禁用 + 空态文案（无死路）；getResult() 恒 null
 *
 * mock 示例（文档站/联调直接可用）：
 *   renderKbWhoCan(el, {
 *     identities: [
 *       { user: 'u-1', groups: ['g-finance'], label: '李四（财务）' },
 *       { user: 'u-9', groups: [], label: '王五（外部顾问）' },
 *     ],
 *     entries: [
 *       { subject: { kind: 'group', id: 'g-finance', label: 'finance-team',
 *                    note: '24 成员 · 由 IT 管理' },
 *         role: 'editor', inheritedFrom: '财务部空间' },
 *       { subject: { kind: 'user', id: 'u-9', label: '王五' },
 *         role: 'viewer', expiresAt: '2026-10-20' },
 *       { subject: { kind: 'group', id: 'g-dlp', label: 'DLP-外发管控' }, role: 'viewer', deny: true },
 *     ],
 *     onCheck(identity, decision) {},
 *   });
 *
 * SSR 安全：无 document 时返回静态句柄（方法 no-op / getResult 返回 null）；
 * 渲染只写 textContent/createElement（禁 innerHTML），本组件无图标注入。
 */

import {
  evaluateAcl,
  h,
  kbRoleLabel,
  normalizeAclEntry,
  normalizeIdentity,
  relativeTime,
  type KbAclDecision,
  type KbAclEntry,
  type KbIdentity,
} from './kb-core';
import { kbSelect } from './kb-select';
import { emitIcen } from './events';
import { t as icenT } from './i18n';

/* ══════════════ 类型 ══════════════ */

/** renderKbWhoCan 配置项 */
export interface KbWhoCanOpts {
  /** 固定身份集（服务端验证 token 下发；select 选项即此集合，无自由输入） */
  identities: KbIdentity[];
  /** 被检查的 ACL 条目集（直接 + 继承 + 链接混排，via 由条目形态推导） */
  entries: KbAclEntry[];
  /** 求值函数（缺省 = kb-core evaluateAcl：先 deny → 并集 → 默认拒绝） */
  evaluate?: (identity: KbIdentity, entries: KbAclEntry[]) => KbAclDecision;
  /** 每次重算回调（与 icen:kb-whocan-check 双通道） */
  onCheck?: (identity: KbIdentity, decision: KbAclDecision) => void;
}

/** renderKbWhoCan 返回的可操作句柄 */
export interface KbWhoCanHandle {
  /** 切换检查身份并重算（固定身份集纪律：集合外 id 一律忽略） */
  setIdentity(id: string): void;
  /** 最近一次决策（未重算过/空身份集/SSR → null） */
  getResult(): KbAclDecision | null;
  /** 销毁：摘监听、清空装配内容、复位幂等标记 */
  destroy(): void;
}

interface MarkedWhoCanEl extends HTMLElement {
  __icenKbWhoCan?: KbWhoCanHandle;
}

/* ══════════════ 内部工具 ══════════════ */

const VIA_LABEL: Record<KbAclDecision['chain'][number]['via'], string> = {
  direct: icenT('kbWhoCan.direct'),
  inherit: icenT('kbWhoCan.inherit'),
  link: icenT('kbWhoCan.link'),
};

/** 倒计时文案：未来 → 「N 天后 / N 小时后 / 即将到期」；过去 → relativeTime（N 天前） */
function untilLabel(input: string, now: Date): string {
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return relativeTime(input, now);
  const diff = t - now.getTime();
  if (diff <= 0) return relativeTime(t, now);
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return icenT('kbWhoCan.daysUntil', { p0: days });
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return icenT('kbWhoCan.hoursUntil', { p0: hours });
  return icenT('kbCore.accessExpiring');
}

/* ══════════════ 装配 ══════════════ */

/**
 * 装配有效权限检查器（view-as）：固定身份集下拉 + 检查钮 + 结论区（verdict /
 * deny 置顶红条 / 扁平原因链 / 叠加规则行 / 最近到期 meta）。每次重算派
 * icen:kb-whocan-check { identity, decision }（onCheck 双通道）。
 * 同元素重复 render 幂等（先拆旧装配）；SSR 返回静态句柄。
 */
export function renderKbWhoCan(el: HTMLElement, opts: KbWhoCanOpts): KbWhoCanHandle {
  if (typeof document === 'undefined' || !el) {
    const stub: KbWhoCanHandle = {
      setIdentity: () => {},
      getResult: () => null,
      destroy: () => {},
    };
    return stub;
  }
  const marked = el as MarkedWhoCanEl;
  marked.__icenKbWhoCan?.destroy(); /* 重建语义：先拆旧装配再重渲 */

  const identities = (Array.isArray(opts.identities) ? opts.identities : []).map((i) =>
    normalizeIdentity(i as KbIdentity | Record<string, unknown>),
  );
  const entries = (Array.isArray(opts.entries) ? opts.entries : []).map((e) =>
    normalizeAclEntry(e as KbAclEntry | Record<string, unknown>),
  );
  const evaluate =
    opts.evaluate ??
    ((identity: KbIdentity, ents: KbAclEntry[]): KbAclDecision => evaluateAcl(ents, identity));

  const ctrl = new AbortController();
  const listen = (type: string, fn: EventListener): void => {
    el.addEventListener(type, fn, { signal: ctrl.signal });
  };
  let destroyed = false;
  let decision: KbAclDecision | null = null;

  el.textContent = '';
  el.classList.add('icen-kb-whocan');

  /* —— bar：固定身份集下拉 + 检查钮 —— */
  const select = kbSelect({
    cls: 'icen-kb-whocan-user',
    sm: true,
    options: identities.map((identity) => ({ value: identity.user, label: identity.label ?? identity.user })),
    value: identities[0]?.user,
    ariaLabel: icenT('kbWhoCan.checkIdentity'),
  });
  const checkBtn = h('button', 'icen-kb-whocan-check', icenT('kbWhoCan.check'));
  checkBtn.type = 'button';
  checkBtn.dataset.icenWhocanCheck = '';
  checkBtn.setAttribute('aria-label', icenT('kbWhoCan.recheckTip'));
  const bar = h('div', 'icen-kb-whocan-bar');
  bar.append(select.el, checkBtn);

  const result = h('div', 'icen-kb-whocan-result');
  el.append(bar, result);

  /* —— 结论区快照渲染 —— */
  function renderResult(d: KbAclDecision): void {
    result.textContent = '';
    result.classList.remove('is-allowed', 'is-denied');
    const allowed = d.role != null;
    result.classList.add(allowed ? 'is-allowed' : 'is-denied');

    result.appendChild(h('div', 'icen-kb-whocan-verdict', kbRoleLabel(d.role)));

    /* deny 一票否决置顶红条（最强信号优先呈现） */
    if (d.deniedBy) {
      result.appendChild(h('div', 'icen-kb-whocan-deniedby', icenT('kbWhoCan.deniedBy', { p0: d.deniedBy.label })));
    }

    /* 扁平原因链（不做树）：badge 来源 + 主体 + 角色 + 组 meta */
    const chain = h('ul', 'icen-kb-whocan-chain');
    if (!d.chain.length) {
      chain.appendChild(h('li', 'icen-kb-whocan-none icen-kb-meta', icenT('kbWhoCan.none')));
    } else {
      for (const link of d.chain) {
        const li = h('li', 'icen-kb-whocan-reason');
        li.classList.add(link.entry.deny ? 'is-deny' : `is-${link.via}`);
        li.appendChild(h('span', 'icen-kb-badge', link.entry.deny ? icenT('common.reject') : VIA_LABEL[link.via]));
        li.appendChild(h('span', 'icen-kb-whocan-source', link.entry.subject.label));
        li.appendChild(h('span', 'icen-kb-whocan-role icen-kb-chip', kbRoleLabel(link.entry.role)));
        if (link.entry.subject.note) li.appendChild(h('span', 'icen-kb-meta', link.entry.subject.note));
        chain.appendChild(li);
      }
    }
    result.appendChild(chain);

    result.appendChild(
      h(
        'div',
        'icen-kb-whocan-rule',
        icenT('kbWhoCan.stackRule', { p0: kbRoleLabel(d.role), p1: d.deniedBy ? icenT('kbWhoCan.denyVeto') : icenT('kbWhoCan.noDeny') }),
      ),
    );

    if (d.expiresAt) {
      result.appendChild(h('div', 'icen-kb-whocan-expires icen-kb-meta', icenT('kbWhoCan.expiresSoon', { p0: untilLabel(d.expiresAt, new Date()) })));
    }
  }

  /* —— 重算：固定身份集 → evaluate → 渲染 → 双通道通知 —— */
  function run(): void {
    if (destroyed) return;
    const identity = identities.find((i) => i.user === select.getValue());
    if (!identity) {
      decision = null;
      result.textContent = '';
      result.classList.remove('is-allowed', 'is-denied');
      return;
    }
    decision = evaluate(identity, entries);
    renderResult(decision);
    emitIcen(el, 'icen:kb-whocan-check', { identity, decision });
    opts.onCheck?.(identity, decision);
  }

  /* select 变更即重算；检查钮显式重算 */
  listen('icen:select-change', (ev) => {
    if (ev.target instanceof Node && select.el.contains(ev.target)) run();
  });
  listen('click', (ev) => {
    const t = ev.target;
    if (t instanceof Element && t.closest('[data-icen-whocan-check]')) run();
  });

  /* 空身份集：控件禁用 + 空态文案（固定集纪律下无身份 = 不可检查，不猜测） */
  if (!identities.length) {
    select.setDisabled(true);
    checkBtn.disabled = true;
    result.appendChild(h('div', 'icen-kb-empty', icenT('kbWhoCan.noIdentity')));
  } else {
    run(); /* 初始身份立即给出基线结论 */
  }

  /* —— 句柄 —— */
  const handle: KbWhoCanHandle = {
    setIdentity(id: string): void {
      if (destroyed) return;
      if (!identities.some((i) => i.user === id)) return; /* 集合外 id 静默忽略（不接受自由输入） */
      select.setValue(id);
      run();
    },
    getResult(): KbAclDecision | null {
      return decision;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      ctrl.abort();
      el.classList.remove('icen-kb-whocan');
      el.textContent = '';
      delete (el as MarkedWhoCanEl).__icenKbWhoCan;
    },
  };

  marked.__icenKbWhoCan = handle;
  return handle;
}
