/*
 * @icen.ai/ui — Behavior: kb-acl（文档权限面板：SharePoint 权限页范式；权限域 kb-perm，
 * spec docs/spec/kb-family.md §9.1；样式 components/kb-perm.css 段A）
 *
 * DOM 契约（renderKbAcl 快照装配；骨架冻结于 spec §9.1）：
 *   <section class="kb-acl">
 *     <header class="kb-acl-head">
 *       <div class="kb-acl-title">[lock svg]<span class="kb-acl-title-text">资源名</span></div>
 *       <button class="kb-acl-act [.is-danger]" data-acl-break | data-acl-restore>
 *         停止继承（默认，中性 ghost）/ 恢复继承（broken 时；恢复将丢弃本项自定义授权 →
 *         is-danger 克制描边，不做实底）
 *       </button>
 *     </header>
 *     <div class="kb-acl-inherit [.is-broken|.is-partial]">          ← 继承 banner 三态
 *       默认态：继承自 财务部空间 <span class="kb-acl-chain-link">/</span> 公司库（parentChain 面包式）
 *       is-broken：已停止继承——本项权限独立于父级
 *       is-partial（默认态叠加）：… <span class="kb-acl-chain-link">·</span> {label}：N 个子项已脱离
 *       parentChain 为空：根级资源——无父级继承
 *     </div>
 *     <div class="kb-acl-grants">                                    ← 直接访问区
 *       <div class="kb-acl-sec">直接访问</div>
 *       <div class="kb-acl-grant [.is-deny|.is-system|.is-expiring]">
 *         <span class="kb-acl-subject" data-kind="user|group|org|anyone|link">
 *           <span class="kb-acl-subject-label">主体</span>
 *           [<span class="kb-acl-note kb-meta">24 成员 · 由 IT 管理 | 系统自动，不可手工移除</span>]
 *         </span>
 *         <span class="kb-acl-role kb-chip">可查看|可评论|可编辑|负责人|拒绝(deny 行)</span>
 *         <span class="kb-acl-meta">继承自 X · 2026-11-01 到期 · 系统管理</span>
 *         <button class="kb-acl-remove" data-acl-remove aria-label="移除 主体">×</button>
 *       </div>…                                                       ← deny 行 DOM 上即置顶
 *       （空集：<div class="kb-acl-none kb-meta">暂无直接授权</div>）
 *     </div>
 *     <div class="kb-acl-links">                                     ← 链接访问区（同 grant 行构造）
 *       <div class="kb-acl-sec">链接访问</div>…（空集：无链接 muted 行）
 *     </div>
 *     <footer class="kb-acl-foot">
 *       <button class="kb-acl-grant-btn" data-acl-grant>授予访问</button>
 *       [<span class="kb-meta">对 1,204 人可见</span>]                ← exposureCount 缺省不渲染该句
 *     </footer>
 *   </section>
 *
 * 事件（initKbAcl 委托派发，与 opts 回调双通道；detail 契约登记于 events.ts）：
 *   icen:kb-acl-grant   {}                              ← data-acl-grant
 *   icen:kb-acl-remove  { subject }                     ← data-acl-remove（is-system 行 CSS 隐藏 + 委托二次拒绝）
 *   icen:kb-acl-inherit { action: 'break'|'restore' }   ← data-acl-break / data-acl-restore
 *
 * mock 示例（文档站/联调直接可用）：
 *   renderKbAcl(el, {
 *     resource: 'FY27 预算模型.xlsx',
 *     parentChain: ['财务部空间', '公司库'],
 *     broken: false,
 *     exceptions: { label: '子文件夹', count: 3 },
 *     entries: [
 *       { subject: { kind: 'user',  id: 'u-1', label: '李四' }, role: 'owner' },
 *       { subject: { kind: 'group', id: 'g-finance', label: 'finance-team',
 *                    note: '24 成员 · 由 IT 管理' },
 *         role: 'editor', inheritedFrom: '财务部空间' },
 *       { subject: { kind: 'group', id: 'g-intern', label: 'intern-summer', note: '4 成员' },
 *         role: 'viewer', expiresAt: '2026-11-01' },
 *       { subject: { kind: 'group', id: 'g-dlp', label: 'DLP-外发管控' }, role: 'viewer', deny: true },
 *       { subject: { kind: 'user',  id: 'u-sys', label: '有限访问' }, role: 'viewer', system: true },
 *     ],
 *     links: [
 *       { subject: { kind: 'link', id: 'l-1', label: '共享链接', note: '组织内任何人' },
 *         role: 'viewer', expiresAt: '2026-11-15' },
 *     ],
 *     exposureCount: 1204,
 *   }, { onGrant() {}, onRemove(subject) {}, onBreak() {}, onRestore() {} });
 *
 * 安全纪律（spec §9.0）：
 *   - system 行（Limited Access 类系统态）不可手工移除：CSS 隐藏移除钮 + 委托层二次拒绝（双保险）
 *   - deny 行置顶（DOM 排序 + CSS order:-1 双重保证），红色语义只落在角色徽标/meta（克制）
 *   - exposureCount 为不去重暴露面计数（过度授权警示「对 1,204 人可见」）；缺省沉默
 *   - 到期一等公民：未来 → 「2026-11-01 到期」（14 天内加 .is-expiring 警示色）；已过期 → 「已过期（N 天前）」
 *
 * SSR 安全：无 document 时 render* 原样返回 el、init* 返回 no-op 销毁；
 * 渲染只写 textContent/createElement（禁 innerHTML），SVG 一律经 kb-core 转发的 svgIcon() 消毒。
 */

import {
  formatCount,
  h,
  kbRoleLabel,
  normalizeAclEntry,
  relativeTime,
  svgIcon,
  type KbAclEntry,
  type KbSubject,
} from './kb-core';
import { emitIcen } from './events';
import { KB_ICON_LOCK } from './kb-citation';

/* ══════════════ 类型 ══════════════ */

/** kb-acl 面板数据快照（renderKbAcl 入参；normalizeAclModel 宽进严出） */
export interface KbAclModel {
  /** 资源名（标题栏呈现） */
  resource: string;
  /** 父级链（近 → 远，面包式「继承自 A / B」） */
  parentChain: string[];
  /** 已停止继承（banner 警示态 + 头部按钮变「恢复继承」） */
  broken: boolean;
  /** 子项脱离继承的例外摘要（is-partial 态文案）；null/缺省 = 无例外 */
  exceptions?: { label: string; count: number } | null;
  /** 直接授权行（deny 行渲染时置顶） */
  entries: KbAclEntry[];
  /** 链接访问行（subject.kind = link） */
  links: KbAclEntry[];
  /** 不去重暴露面计数（「对 N 人可见」过度授权警示）；缺省/null = 不渲染 */
  exposureCount?: number | null;
}

/** renderKbAcl 的回调通道（与 icen:kb-acl-* 事件双通道） */
export interface KbAclRenderOptions {
  /** 「授予访问」点击（data-acl-grant） */
  onGrant?: () => void;
  /** 行移除点击（data-acl-remove；system 行 CSS 隐藏 + 委托二次拒绝，不会触发） */
  onRemove?: (subject: KbSubject) => void;
  /** 「停止继承」（data-acl-break） */
  onBreak?: () => void;
  /** 「恢复继承」（data-acl-restore） */
  onRestore?: () => void;
}

/** 素对象 → KbAclModel（宽进严出：entries/links 逐条 normalizeAclEntry） */
export function normalizeAclModel(raw: KbAclModel | Record<string, unknown>): KbAclModel {
  const r = raw as Partial<KbAclModel>;
  const ex = r.exceptions;
  return {
    resource: String(r.resource ?? '未命名资源'),
    parentChain: Array.isArray(r.parentChain) ? r.parentChain.map(String).filter(Boolean) : [],
    broken: r.broken === true,
    exceptions:
      ex && typeof ex === 'object'
        ? { label: String(ex.label ?? '例外'), count: Number.isFinite(ex.count) ? ex.count : 0 }
        : null,
    entries: Array.isArray(r.entries) ? r.entries.map((e) => normalizeAclEntry(e)) : [],
    links: Array.isArray(r.links) ? r.links.map((e) => normalizeAclEntry(e)) : [],
    exposureCount: typeof r.exposureCount === 'number' && Number.isFinite(r.exposureCount) ? r.exposureCount : null,
  };
}

/* ══════════════ 内部工具 ══════════════ */

/** 面板 → opts 回调查表（render 时登记，init 委托命中时取用） */
const aclPanelMap = new WeakMap<HTMLElement, KbAclRenderOptions | undefined>();
/** 行 → ACL 条目查表（data-acl-remove 命中行后取 subject） */
const aclRowMap = new WeakMap<HTMLElement, KbAclEntry>();

const DAY_MS = 86_400_000;
/** 距到期 ≤14 天视为「即将到期」（.is-expiring 警示色） */
const EXPIRING_SOON_MS = 14 * DAY_MS;

/** Y-M-D 短日期（本地时区；到期呈现不做长格式） */
function ymdOf(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 到期 meta 文案：未来 → 「2026-11-01 到期」；过去 → 「已过期（N 天前）」；不可解析 → ''（诚实跳过） */
function expiryMeta(expiresAt: string | undefined, now: Date): { text: string; soon: boolean } {
  if (!expiresAt) return { text: '', soon: false };
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return { text: '', soon: false };
  if (t <= now.getTime()) return { text: `已过期（${relativeTime(t, now)}）`, soon: false };
  return { text: `${ymdOf(t)} 到期`, soon: t - now.getTime() <= EXPIRING_SOON_MS };
}

/** deny 行置顶（稳定排序：deny 在前，组内保持原序） */
function denyFirst(entries: KbAclEntry[]): KbAclEntry[] {
  return [...entries].sort((a, b) => Number(b.deny === true) - Number(a.deny === true));
}

/** 单条授权行（grants 与 links 区共用；data-kind 由 CSS 决定组/链接前圆点） */
function buildAclRow(entry: KbAclEntry, now: Date): HTMLElement {
  const row = h('div', 'kb-acl-grant');
  if (entry.deny) row.classList.add('is-deny');
  if (entry.system) row.classList.add('is-system');
  aclRowMap.set(row, entry);

  const subject = h('span', 'kb-acl-subject');
  subject.dataset.kind = entry.subject.kind;
  subject.appendChild(h('span', 'kb-acl-subject-label', entry.subject.label));
  /* system 行固定呈现系统注记（不可手工移除的明示）；其余行用主体自带 note（成员数/管理方） */
  const note = entry.system ? '系统自动，不可手工移除' : entry.subject.note;
  if (note) subject.appendChild(h('span', 'kb-acl-note kb-meta', note));

  const role = h('span', 'kb-acl-role kb-chip', entry.deny ? '拒绝' : kbRoleLabel(entry.role));

  const metaBits: string[] = [];
  if (entry.inheritedFrom) metaBits.push(`继承自 ${entry.inheritedFrom}`);
  const expiry = expiryMeta(entry.expiresAt, now);
  if (expiry.text) {
    metaBits.push(expiry.text);
    if (expiry.soon) row.classList.add('is-expiring');
  }
  if (entry.system) metaBits.push('系统管理');

  const remove = h('button', 'kb-acl-remove', '×');
  remove.type = 'button';
  remove.dataset.aclRemove = '';
  remove.setAttribute('aria-label', `移除 ${entry.subject.label}`);
  remove.title = `移除 ${entry.subject.label}`;

  row.append(subject, role);
  if (metaBits.length) row.appendChild(h('span', 'kb-acl-meta', metaBits.join(' · ')));
  row.appendChild(remove);
  return row;
}

/* ══════════════ 渲染 ══════════════ */

/**
 * 渲染文档权限面板（快照；返回挂载容器 el）。结构见文件头 DOM 契约；
 * 行级交互不在此绑定——统一走 initKbAcl 的 root 级委托（幂等，返回销毁）。
 */
export function renderKbAcl(
  el: HTMLElement,
  model: KbAclModel | Record<string, unknown>,
  opts?: KbAclRenderOptions,
): HTMLElement {
  if (typeof document === 'undefined') return el;
  const m = normalizeAclModel(model);
  const now = new Date();

  el.textContent = '';
  el.classList.add('kb-acl');
  aclPanelMap.set(el, opts);

  /* —— 头：资源名 + 继承开关（恢复继承丢弃自定义授权 → 破坏性，danger 克制描边） —— */
  const title = h('div', 'kb-acl-title');
  const lock = svgIcon(KB_ICON_LOCK);
  if (lock) title.appendChild(lock);
  title.appendChild(h('span', 'kb-acl-title-text', m.resource));

  const inheritBtn = h(
    'button',
    m.broken ? 'kb-acl-act is-danger' : 'kb-acl-act',
    m.broken ? '恢复继承' : '停止继承',
  );
  inheritBtn.type = 'button';
  if (m.broken) {
    inheritBtn.dataset.aclRestore = '';
    inheritBtn.title = '恢复继承将丢弃本项自定义的权限';
  } else {
    inheritBtn.dataset.aclBreak = '';
    inheritBtn.title = '停止从父级继承，改为独立管理本项权限';
  }

  const head = h('header', 'kb-acl-head');
  head.append(title, inheritBtn);
  el.appendChild(head);

  /* —— 继承 banner 三态 —— */
  const banner = h('div', 'kb-acl-inherit');
  if (m.broken) {
    banner.classList.add('is-broken');
    banner.appendChild(h('span', 'kb-acl-inherit-text', '已停止继承——本项权限独立于父级'));
  } else {
    if (m.parentChain.length) {
      banner.appendChild(h('span', 'kb-acl-inherit-label', '继承自'));
      m.parentChain.forEach((name, i) => {
        if (i > 0) banner.appendChild(h('span', 'kb-acl-chain-link', '/'));
        banner.appendChild(h('span', 'kb-acl-chain-node', name));
      });
    } else {
      banner.appendChild(h('span', 'kb-acl-inherit-label', '根级资源——无父级继承'));
    }
    if (m.exceptions) {
      banner.classList.add('is-partial');
      banner.appendChild(h('span', 'kb-acl-chain-link', '·'));
      banner.appendChild(h('span', 'kb-acl-exceptions', `${m.exceptions.label}：${m.exceptions.count} 个子项已脱离`));
    }
  }
  el.appendChild(banner);

  /* —— 直接访问区（deny 置顶） —— */
  const grants = h('div', 'kb-acl-grants');
  grants.appendChild(h('div', 'kb-acl-sec', '直接访问'));
  const orderedEntries = denyFirst(m.entries);
  if (!orderedEntries.length) grants.appendChild(h('div', 'kb-acl-none kb-meta', '暂无直接授权'));
  for (const entry of orderedEntries) grants.appendChild(buildAclRow(entry, now));
  el.appendChild(grants);

  /* —— 链接访问区（同 grant 行；无链接是常态，muted 呈现） —— */
  const links = h('div', 'kb-acl-links');
  links.appendChild(h('div', 'kb-acl-sec', '链接访问'));
  const orderedLinks = denyFirst(m.links);
  if (!orderedLinks.length) links.appendChild(h('div', 'kb-acl-none kb-meta', '无链接'));
  for (const entry of orderedLinks) links.appendChild(buildAclRow(entry, now));
  el.appendChild(links);

  /* —— foot：授予访问（面板唯一 accent 级主行动）+ 暴露面计数（缺省沉默） —— */
  const foot = h('footer', 'kb-acl-foot');
  const grantBtn = h('button', 'kb-acl-grant-btn', '授予访问');
  grantBtn.type = 'button';
  grantBtn.dataset.aclGrant = '';
  foot.appendChild(grantBtn);
  if (m.exposureCount != null) {
    foot.appendChild(h('span', 'kb-meta', `对 ${formatCount(m.exposureCount)} 人可见`));
  }
  el.appendChild(foot);

  return el;
}

/* ══════════════ 交互委托 ══════════════ */

interface MarkedAclScope extends ParentNode {
  __icenKbAclInit?: boolean;
}

/**
 * 初始化 kb-acl 面板交互（root 级 click 委托，默认 document；幂等标记 __icenKbAclInit，
 * 返回销毁函数，销毁后可重新 init）。命中 data-acl-grant / data-acl-remove /
 * data-acl-break / data-acl-restore 时派 icen:kb-acl-* 事件并回调 renderKbAcl 登记的 opts
 * （双通道）。is-system 行的移除钮在委托层二次拒绝（CSS 隐藏是第一重）。
 */
export function initKbAcl(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const scope = root ?? document;
  const marked = scope as MarkedAclScope;
  if (marked.__icenKbAclInit) return () => undefined;
  marked.__icenKbAclInit = true;
  const target = scope as ParentNode & EventTarget;

  const onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const panel = t.closest<HTMLElement>('.kb-acl');
    if (!panel) return;
    const opts = aclPanelMap.get(panel);
    if (opts === undefined && !aclPanelMap.has(panel)) return; /* 非 renderKbAcl 装配的静态面板不派发 */

    /* 行移除：命中行 → 弱表取 entry → 派发（system 行二次拒绝） */
    const removeBtn = t.closest<HTMLElement>('[data-acl-remove]');
    if (removeBtn) {
      const row = removeBtn.closest<HTMLElement>('.kb-acl-grant');
      const entry = row ? aclRowMap.get(row) : undefined;
      if (!entry || row?.classList.contains('is-system')) return;
      emitIcen(row ?? panel, 'icen:kb-acl-remove', { subject: entry.subject });
      opts?.onRemove?.(entry.subject);
      return;
    }

    /* 授予访问 */
    if (t.closest('[data-acl-grant]')) {
      emitIcen(panel, 'icen:kb-acl-grant', {});
      opts?.onGrant?.();
      return;
    }

    /* 停止/恢复继承 */
    const inheritBtn = t.closest<HTMLElement>('[data-acl-break], [data-acl-restore]');
    if (inheritBtn) {
      const action: 'break' | 'restore' = inheritBtn.hasAttribute('data-acl-restore') ? 'restore' : 'break';
      emitIcen(panel, 'icen:kb-acl-inherit', { action });
      if (action === 'break') opts?.onBreak?.();
      else opts?.onRestore?.();
    }
  };

  target.addEventListener('click', onClick);
  return () => {
    target.removeEventListener('click', onClick);
    marked.__icenKbAclInit = false;
  };
}
