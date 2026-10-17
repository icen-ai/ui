import { createFeedbackClock, runFeedbackAction, cancelFeedbackAction, setFeedbackError, setFeedbackText, rememberFeedbackOrigin, restoreFeedbackFocus, type FeedbackAction, type FeedbackClock } from './feedback';
import { createIcon, type IconName } from './icons';
import { t } from './i18n';
import { parseSvg } from './svg-parse';
const clocks=new WeakMap<NotificationRecord,FeedbackClock>();
/*
 * @icen.ai/ui — Behavior: notification（通知栈 v2，与 components/notification.css 配套）
 *
 * 与 toast / alert 的差异：
 *   - toast     = 瞬时轻提示（2.6s 自动消失），右下角
 *   - alert     = 内嵌警示条（页面流内，非浮层）
 *   - notification = 持久通知栈（右上角），工程级能力：
 *       · 进度通知（带进度条，可动态更新）
 *       · Promise confirm（确认对话框形态）
 *       · 多动作按钮（primary / ghost / danger）
 *       · hover 暂停 + 倒计时进度条
 *       · 优先级置顶（priority: 'high'）
 *       · 已读 / 未读标记
 *       · 自定义图标 / 头像
 *       · 同 tag 分组折叠
 *       · localStorage 持久化
 *       · 详情链接
 *       · 全套回调（onShow / onClose / onClick）
 *       · NotificationHandle 函数式 API（dismiss / update / setProgress / markRead / pause / resume）
 *
 * ── 全局便捷 API ──
 *   notify(title, opts?) → NotificationHandle | null
 *   notify.success / warn / error / info(title, opts?) → handle
 *   notify.icen-progress(title, { progress: 0.5, progressLabel }) → handle（可 setProgress 更新）
 *   notify.confirm(title, { confirmLabel, cancelLabel }) → Promise<boolean>
 *   notify.dismiss(id?)                 关闭单条（id 缺省=全部）
 *   notify.clear()                      全清
 *   notify.markRead(id?)                标记已读（id 缺省=全部）
 *   notify.get(id) / getAll()           读取
 *   notify.update(id, patch)            更新
 *   notify.config({ position, maxStack, pauseOnHover, persist, sound })
 *
 * ── 多容器函数式 API（对齐 createTable 模式）──
 *   const center = createNotificationCenter(document.body, { position: 'bottom-right' });
 *   const h = center.push({ title, kind: 'success', description });
 *   h.setProgress(0.8); h.update({ title: '新标题' }); h.dismiss();
 *   center.markAllRead(); center.clear(); center.destroy();
 *
 * SSR 下为 no-op。文本赋值一律 textContent；用户传入的 SVG 图标字符串经 DOMParser
 * 消毒（仅接纳 <svg> 根元素，剔除 on* 属性与 script/foreignObject 后代）。
 */

export type NotificationKind = 'success' | 'warning' | 'error' | 'info';

export interface NotificationAction {
  /** 按钮文字 */
  label: string;
  /** 同步/异步操作；false 保持打开，reject 提供重试反馈；关闭时 abort signal。 */
  onClick?: FeedbackAction;
  /** 视觉变体：默认 ghost / primary 实底 / danger 危险色 */
  type?: 'primary' | 'ghost' | 'danger';
  /** 点击后是否保持通知打开（默认 false） */
  keepOpen?: boolean;
}

export interface NotificationOptions {
  /** 显式 id（不传自动生成；用于后续 update/dismiss/get） */
  id?: string;
  /** 副标题（正文） */
  description?: string;
  /** 自动关闭延时（毫秒），默认 0 = 不自动关闭 */
  duration?: number;
  /** 是否显示关闭按钮，默认 true */
  closable?: boolean;
  /** hover 时暂停自动关闭倒计时，默认跟随全局 config.pauseOnHover */
  pauseOnHover?: boolean;
  /** duration > 0 时是否显示底部倒计时进度条，默认 true */
  showCountdown?: boolean;
  /** 自定义图标：SVG 字符串 / 图片 URL / false（关闭） */
  icon?: string | false;
  /** Shared ICEN symbol; icon:false still disables the slot. */
  iconName?: IconName;
  /** 头像 URL（会覆盖 kind 图标） */
  avatar?: string;
  /** 优先级：normal（默认）/ high（置顶） */
  priority?: 'normal' | 'high';
  /** 未读标记，默认 false（push 后可 markRead） */
  unread?: boolean;
  /** 多动作按钮（actions 优先于 actionLabel） */
  actions?: NotificationAction[];
  /** 兼容旧版单按钮 */
  actionLabel?: string;
  onAction?: FeedbackAction;
  /** Inline copy for a rejected action; defaults to localized retry guidance. */
  actionError?: string;
  /** 进度（0–1）；progress > 0 时显示进度条。推荐用 notify.icen-progress() 返回的 handle.setProgress */
  progress?: number;
  /** 进度条下方文字（如「正在导出 64%」） */
  progressLabel?: string;
  /** 详情链接（绝对 / 相对路径） */
  link?: string;
  linkLabel?: string;
  /** 分组键：同 tag 的多条会聚合显示计数 */
  tag?: string;
  /** 自定义数据（持久化时保留） */
  data?: unknown;
  /** 点击通知体的回调（不含按钮与关闭） */
  onClick?: (handle: NotificationHandle) => void;
  /** 显示后回调 */
  onShow?: (handle: NotificationHandle) => void;
  /** 关闭后回调 */
  onClose?: (handle: NotificationHandle) => void;
}

export interface NotificationConfig {
  /** 位置：top-right（默认）/ top-left / bottom-left / bottom-right */
  position?: 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right';
  /** 同屏最大堆叠，默认 5；超出从最早的开始折叠/移除 */
  maxStack?: number;
  /** hover 暂停倒计时，默认 true */
  pauseOnHover?: boolean;
  /** 持久化：true 用默认 key / 字符串=自定义 key / 不传=不持久化 */
  persist?: boolean | string;
  /** 声音提示：true 用默认蜂鸣 / 字符串=data URL / 不传=无声 */
  sound?: boolean | string;
}

export interface NotificationHandle {
  /** 通知 id */
  id: string;
  /** 当前 DOM 元素（可能已脱离 DOM） */
  el: HTMLElement;
  /**
   * 关闭本条。设计边界：dismiss 不可拦截（无 before-close 钩子，onClose 只能事后观察）；
   * 持久化走 localStorage 是当前设计边界（无网络/多端同步，配额或隐私模式受限时静默放弃）。
   */
  dismiss(): void;
  /** 部分更新（title / description / progress / unread / actions / tag 等） */
  update(patch: NotificationUpdatePatch): void;
  /** 设置进度（0–1）与可选标签 */
  setProgress(value: number, label?: string): void;
  /** 标记已读 */
  markRead(): void;
  /** 暂停自动关闭倒计时 */
  pause(): void;
  /** 恢复自动关闭倒计时（继续剩余时间） */
  resume(): void;
}

/** update 接受的局部字段（title 在 push 时传，update 时也接受） */
export interface NotificationUpdatePatch {
  iconName?: IconName;
  title?: string;
  description?: string;
  duration?: number;
  unread?: boolean;
  progress?: number;
  progressLabel?: string;
  actions?: NotificationAction[];
  tag?: string;
  priority?: 'normal' | 'high';
  icon?: string | false;
  avatar?: string;
  link?: string;
  linkLabel?: string;
}

/**
 * 通知的内部记录形态，同时是 get(id) / getAll() 的公开返回类型
 * （导出以便消费方对返回值做类型注解）。
 */
export interface NotificationRecord {
  id: string;
  title: string;
  kind: NotificationKind;
  opts: NotificationOptions;
  el: HTMLElement | null;
  createdAt: number;
  // hover 暂停簿记
  duration: number;
  remaining: number;
  paused: boolean;
  timer: number;
  /** 本次计时的起始时间戳（pause 时据此扣减 remaining） */
  startedAt: number;
  /** 所属 NotificationCenter 的局部配置（全局单例通知为 undefined） */
  cfgRef?: Required<NotificationConfig>;
  /** 所属 center 的 localStore（全局通知为 undefined）；dismiss 时同步清理，避免残留僵尸记录 */
  ownerStore?: Map<string, NotificationRecord>;
  /** attachTimer 注入的重启入口（update duration 时按新时长重启计时） */
  restartTimer?: () => void;
  /** hover 暂停监听是否已绑定（attachTimer 幂等保护） */
  hoverBound?: boolean;
}

interface NotifyFn {
  (title: string, opts?: NotificationOptions): NotificationHandle | null;
  success(title: string, opts?: NotificationOptions): NotificationHandle | null;
  warn(title: string, opts?: NotificationOptions): NotificationHandle | null;
  error(title: string, opts?: NotificationOptions): NotificationHandle | null;
  info(title: string, opts?: NotificationOptions): NotificationHandle | null;
  progress(title: string, opts?: NotificationOptions): NotificationHandle | null;
  confirm(title: string, opts?: NotificationConfirmOptions): Promise<boolean>;
  /**
   * 关闭单条（id 缺省 = 全部）。设计边界：dismiss 不可拦截、持久化走 localStorage
   * 是当前设计边界（详见 NotificationHandle.dismiss）。
   */
  dismiss(id?: string): void;
  clear(): void;
  markRead(id?: string): void;
  update(id: string, patch: NotificationUpdatePatch): void;
  get(id: string): NotificationRecord | null;
  getAll(): NotificationRecord[];
  config(opts: NotificationConfig): void;
}

export interface NotificationConfirmOptions extends Omit<NotificationOptions, 'actions' | 'duration' | 'closable'> {
  confirmLabel?: string;
  cancelLabel?: string;
  /** 自动关闭毫秒（默认 0 = 不自动关闭） */
  duration?: number;
}

/* ═══ 常量与图标库 ═══ */

const KIND_SYMBOL = { success:'circle-check', warning:'triangle-alert', error:'circle-error', info:'circle-info' } as const;

/* ═══ 全局状态 ═══ */

let cfg: Required<NotificationConfig> = {
  position: 'top-right',
  maxStack: 5,
  pauseOnHover: true,
  persist: false,
  sound: false,
};

const store = new Map<string, NotificationRecord>();
const globalInit: { done: boolean; dispose?: ()=>void } = { done: false };

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function genId(): string {
  return 'notif-' + Math.random().toString(36).slice(2, 10);
}

/* ═══ 容器 ═══ */

function ensureContainer(): HTMLElement {
  const sel = `.icen-notification-container[data-icen-notif-default]`;
  const existing = document.body.querySelector<HTMLElement>(sel);
  if (existing) {
    syncContainerPosition(existing);
    return existing;
  }
  const el = document.createElement('div');
  el.className = 'icen-notification-container';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', t('notification.ariaLabel'));
  el.dataset.icenNotifDefault = '';
  syncContainerPosition(el);
  document.body.appendChild(el);
  return el;
}

function syncContainerPosition(el: HTMLElement): void {
  el.dataset.icenPosition = cfg.position;
}

/* ═══ 持久化 ═══ */

const DEFAULT_PERSIST_KEY = 'icen.ui.notifications';

/** 出现过的持久化 key（persistSave 据此把已清空的 key 覆写为 []）。 */
const knownPersistKeys = new Set<string>();

function persistKeyFor(p: boolean | string): string | null {
  if (p === true) return DEFAULT_PERSIST_KEY;
  if (typeof p === 'string' && p.length > 0) return p;
  return null;
}

/** 记录所属的持久化配置：center 通知读 local，全局通知读 cfg。 */
function recordPersist(record: NotificationRecord): boolean | string {
  return record.cfgRef ? record.cfgRef.persist : cfg.persist;
}

interface PersistedItem {
  id: string;
  title: string;
  kind: NotificationKind;
  description?: string;
  tag?: string;
  unread?: boolean;
  priority?: 'normal' | 'high';
  progress?: number;
  progressLabel?: string;
  link?: string;
  linkLabel?: string;
  data?: unknown;
  createdAt?: number;
}

function persistSave(): void {
  try {
    // 按记录所属 persist 配置分组写 key；已知 key 即使没有记录也要覆写为 []
    const groups = new Map<string, PersistedItem[]>();
    for (const key of knownPersistKeys) groups.set(key, []);
    for (const r of store.values()) {
      const key = persistKeyFor(recordPersist(r));
      if (!key) continue;
      knownPersistKeys.add(key);
      let bucket = groups.get(key);
      if (!bucket) {
        bucket = [];
        groups.set(key, bucket);
      }
      if (r.opts.duration) continue; // 有时效的通知不持久化
      bucket.push({
        id: r.id,
        title: r.title,
        kind: r.kind,
        description: r.opts.description ?? '',
        tag: r.opts.tag,
        unread: r.opts.unread,
        priority: r.opts.priority,
        progress: r.opts.progress,
        progressLabel: r.opts.progressLabel,
        link: r.opts.link,
        linkLabel: r.opts.linkLabel,
        data: r.opts.data,
        createdAt: r.createdAt,
      });
    }
    for (const [key, items] of groups) {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch {
    /* quota / privacy mode → 静默放弃 */
  }
}

function persistLoad(key: string): PersistedItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 从持久化 key 恢复通知到指定容器（不入任何 store，由调用方登记）。 */
function restorePersisted(
  container: HTMLElement,
  key: string,
  cfgRef?: Required<NotificationConfig>,
): NotificationRecord[] {
  const records: NotificationRecord[] = [];
  for (const item of persistLoad(key)) {
    const record: NotificationRecord = {
      id: item.id,
      title: item.title,
      kind: item.kind,
      opts: {
        id: item.id,
        description: item.description,
        tag: item.tag,
        unread: item.unread,
        priority: item.priority,
        progress: item.progress,
        progressLabel: item.progressLabel,
        link: item.link,
        linkLabel: item.linkLabel,
        data: item.data,
      },
      el: null,
      createdAt: item.createdAt ?? Date.now(),
      duration: 0,
      remaining: 0,
      paused: false,
      timer: 0,
      startedAt: 0,
      cfgRef,
    };
    const handle = makeHandle(record);
    const el = renderNotification(record, container, () => handle);
    record.el = el;
    handle.el = el;
    attachTimer(record,handle);
    pushToContainer(container, el, record.opts.priority ?? 'normal');
    records.push(record);
  }
  return records;
}

/* ═══ 声音 ═══ */

let audioCtx: AudioContext | null = null;

function playSound(sound: boolean | string): void {
  if (!sound) return;
  try {
    if (typeof sound === 'string') {
      const audio = new Audio(sound);
      void audio.play();
      return;
    }
    // 默认蜂鸣：用 WebAudio 合成两短音
    if (!audioCtx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = now + i * 0.08;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  } catch {
    /* autoplay policy 拒绝 → 静默 */
  }
}

/* ═══ DOM 渲染 ═══ */

function buildIcon(record: NotificationRecord): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'icen-notification-icon';
  wrap.setAttribute('aria-hidden', 'true');
  const { icon, avatar } = record.opts;
  if (avatar) {
    const img = document.createElement('img');
    img.className = 'icen-notification-avatar';
    img.src = avatar;
    img.alt = '';
    img.loading = 'lazy';
    wrap.appendChild(img);
    return wrap;
  }
  if (icon === false) {
    wrap.style.display = 'none';
    return wrap;
  }
  if(record.opts.iconName){const symbol=createIcon(record.opts.iconName);if(symbol){wrap.append(symbol);return wrap;}}
  if (typeof icon === 'string' && icon.length > 0) {
    // SVG 字符串或图片 URL；其余按纯文本展示
    if (/^https?:\/\/|^data:image\//.test(icon) || icon.endsWith('.png') || icon.endsWith('.jpg') || icon.endsWith('.svg') || icon.endsWith('.webp')) {
      const img = document.createElement('img');
      img.className = 'icen-notification-avatar';
      img.src = icon;
      img.alt = '';
      wrap.appendChild(img);
    } else {
      const svg = parseSvg(icon);
      if (svg) wrap.appendChild(svg);
      if(!svg)wrap.append(createIcon(KIND_SYMBOL[record.kind])!);
    }
    return wrap;
  }
  const progressing=record.kind === 'info' && record.opts.progress !== undefined;
  const name=progressing ? record.opts.progress!>=1 ? 'circle-check' : 'spinner' : KIND_SYMBOL[record.kind];
  const fallback=createIcon(name);
  if(fallback){if(name === 'spinner')fallback.classList.add('icen-notification-busy-symbol');wrap.append(fallback);}
  return wrap;
}

function buildTitle(title: string): HTMLElement {
  const el = document.createElement('p');
  el.className = 'icen-notification-title';
  setFeedbackText(el,title);
  return el;
}

function buildDescription(text: string): HTMLElement {
  const el = document.createElement('p');
  el.className = 'icen-notification-message';
  // 支持显式换行
  el.style.whiteSpace = 'pre-wrap';
  setFeedbackText(el,text);
  return el;
}

function buildActions(record: NotificationRecord): HTMLElement | null {
  const actions = record.opts.actions !== undefined
    ? record.opts.actions
    : record.opts.actionLabel
      ? [{ label: record.opts.actionLabel, onClick: record.opts.onAction }]
      : null;
  if (!actions || actions.length === 0) return null;

  const wrap = document.createElement('div');
  wrap.className = 'icen-notification-actions';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icen-notification-action';
    if (a.type === 'primary') btn.classList.add('icen-notification-action--primary');
    else if (a.type === 'danger') btn.classList.add('icen-notification-action--danger');
    setFeedbackText(btn,a.label);
    btn.addEventListener('click',(ev)=>{
      ev.stopPropagation();
      const card=record.el;if(!card || store.get(record.id) !== record)return;
      const content=card.querySelector<HTMLElement>('.icen-notification-content')!;
      setFeedbackError(content);
      runFeedbackAction(card,btn,a.onClick ?? (()=>undefined),{
        busy(value){const clock=clocks.get(record);if(value){clock?.pause('action');clock?.resume('failure');}else clock?.resume('action');},
        complete(accepted){if(!accepted)clocks.get(record)?.pause('failure');else if(!a.keepOpen && store.get(record.id) === record)dismissRecord(record.id);},
        error(){clocks.get(record)?.pause('failure');setFeedbackError(content,record.opts.actionError ?? t('common.actionFailed'));},
      });
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

function buildLink(record: NotificationRecord): HTMLElement | null {
  const { link, linkLabel } = record.opts;
  if (!link) return null;
  const wrap = document.createElement('div');
  wrap.className = 'icen-notification-link-wrap';
  const a = document.createElement('a');
  a.className = 'icen-notification-link';
  a.href = link;
  a.textContent = linkLabel ?? t('notification.viewDetails');
  a.addEventListener('click', (ev) => ev.stopPropagation());
  wrap.appendChild(a);
  return wrap;
}

function buildProgressBar(record: NotificationRecord): HTMLElement | null {
  const { progress, progressLabel } = record.opts;
  if (progress === undefined || progress < 0) return null;
  const wrap = document.createElement('div');
  wrap.className = 'icen-notification-progress';
  const track = document.createElement('div');
  track.className = 'icen-notification-progress-track';
  const fill = document.createElement('div');
  fill.className = 'icen-notification-progress-bar';
  const pct = Math.min(100, Math.max(0, progress * 100));
  fill.style.width = pct + '%';
  track.appendChild(fill);
  wrap.appendChild(track);
  if (progressLabel) {
    const lbl = document.createElement('span');
    lbl.className = 'icen-notification-progress-label';
    lbl.textContent = progressLabel;
    wrap.appendChild(lbl);
  } else if (progress > 0) {
    const lbl = document.createElement('span');
    lbl.className = 'icen-notification-progress-label';
    lbl.textContent = Math.round(pct) + '%';
    wrap.appendChild(lbl);
  }
  return wrap;
}

function buildCountdownBar(record: NotificationRecord): HTMLElement | null {
  if (!record.duration || record.duration <= 0) return null;
  if (record.opts.showCountdown === false) return null;
  const bar = document.createElement('div');
  bar.className = 'icen-notification-countdown';
  bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('div');
  fill.className = 'icen-notification-countdown-fill';
  fill.style.animationDuration = record.duration + 'ms';
  fill.style.animationPlayState = 'running';
  bar.appendChild(fill);
  return bar;
}

/** 按 record.duration 同步底部倒计时条（update duration 时调用；不存在则补建，归零则移除）。 */
function syncCountdownBar(record: NotificationRecord): void {
  const el = record.el;
  if (!el) return;
  const existing = el.querySelector('.icen-notification-countdown');
  if (record.duration <= 0 || record.opts.showCountdown === false) {
    existing?.remove();
    return;
  }
  let fill: HTMLElement | null;
  if (existing) {
    fill = existing.querySelector<HTMLElement>('.icen-notification-countdown-fill');
  } else {
    const bar = buildCountdownBar(record);
    if (!bar) return;
    el.appendChild(bar);
    fill = bar.querySelector<HTMLElement>('.icen-notification-countdown-fill');
  }
  if (fill) {
    // 重置动画以匹配新时长（清内联 animation 触发 reflow 后重放）
    fill.style.animation = 'none';
    void fill.offsetWidth;
    fill.style.animation = '';
    fill.style.animationDuration = record.duration + 'ms';
    fill.style.animationPlayState = 'running';
  }
}

function buildClose(record: NotificationRecord): HTMLElement | null {
  if (record.opts.closable === false) return null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icen-notification-close icen-icon-action';
  btn.setAttribute('data-icen-reveal','');
  btn.setAttribute('aria-label', t('common.close'));
  const svg = createIcon('close');
  if (svg) btn.appendChild(svg);
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    dismissRecord(record.id);
  });
  return btn;
}

function renderNotification(
  record: NotificationRecord,
  container: HTMLElement,
  getHandle: () => NotificationHandle,
): HTMLElement {
  const el = document.createElement('div');
  let cls = record.kind === 'info' ? 'icen-notification' : `icen-notification icen-notification--${record.kind}`;
  rememberFeedbackOrigin(el);
  if (record.opts.priority === 'high') cls += ' is-priority';
  if (record.opts.unread) cls += ' is-unread';
  if (record.opts.progress !== undefined && record.opts.progress >= 0) cls += ' is-progress';
  if (record.opts.avatar) cls += ' icen-has-avatar';
  if((record.opts.progress ?? 0)>=1)cls += ' is-complete';
  if (record.opts.onClick) {
    cls += ' is-clickable';
  }
  el.setAttribute('role',record.kind === 'error' || record.kind === 'warning' ? 'alert' : 'status');
  el.className = cls;
  el.id = record.id;

  const icon = buildIcon(record);
  el.appendChild(icon);

  const content = document.createElement('div');
  content.className = 'icen-notification-content';
  const title=buildTitle(record.title);
  if(record.opts.onClick) {
    const open=document.createElement('button');open.type='button';open.className='icen-notification-open';setFeedbackText(open,record.title);
    title.replaceChildren(open);
  }
  content.appendChild(title);
  if (record.opts.description) content.appendChild(buildDescription(record.opts.description));

  const actions = buildActions(record);
  if (actions) content.appendChild(actions);

  const link = buildLink(record);
  if (link) content.appendChild(link);

  const progress = buildProgressBar(record);
  if (progress) content.appendChild(progress);

  el.appendChild(content);

  const close = buildClose(record);
  if (close) el.appendChild(close);

  const countdown = buildCountdownBar(record);
  if (countdown) el.appendChild(countdown);

  // 点击通知体
  if (record.opts.onClick) {
    const onClick = record.opts.onClick;
    el.addEventListener('click', (ev) => {
      const control=ev.target instanceof Element ? ev.target.closest('button,a,input,select,textarea,[role="button"]') : null;
      if(control && !control.classList.contains('icen-notification-open'))return;
      onClick(getHandle());
    });
  }

  record.el = el;
  return el;
}

/* ═══ 入栈 / 出栈 ═══ */

function pushToContainer(container: HTMLElement, el: HTMLElement, priority: 'normal' | 'high'): void {
  if (priority === 'high') {
    // 高优先级置顶：插到第一个非高优先级之前
    const firstNormal = Array.from(container.children).find((c) =>
      c instanceof HTMLElement && !c.classList.contains('is-priority'),
    );
    if (firstNormal) container.insertBefore(el, firstNormal);
    else container.appendChild(el);
  } else {
    container.appendChild(el);
  }
}

/**
 * 退场动画兜底时长（毫秒）：与 components/notification.css 的退场过渡时长对齐并留少量余量；
 * transitionend 因元素被隐藏 / display:none 等原因不触发时，由此超时保证节点必定移除。
 */
const LEAVE_FALLBACK_MS = 360;

function removeOne(el: HTMLElement, onClose?: () => void): void {
  if (el.classList.contains('is-leaving')) return;
  restoreFeedbackFocus(el);
  el.inert=true;el.setAttribute('aria-hidden','true');
  el.classList.add('is-leaving');
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    el.removeEventListener('transitionend',onTransition);window.clearTimeout(fallback);
    el.remove();
    onClose?.();
  };
  const onTransition=(event:TransitionEvent)=>{if(event.target === el)finish();};
  el.addEventListener('transitionend',onTransition);
  const fallback=window.setTimeout(finish,LEAVE_FALLBACK_MS);
}

/**
 * 超出堆叠上限时折叠最早的可折叠项。maxStack 与删除语义由调用方注入：
 * 全局路径传 cfg.maxStack 且只删全局 store；center 路径传 local.maxStack 且
 * 需双删（localStore 是该 center get/getAll 的数据源，store 是全量索引）。
 * 计时器记录统一从全局 store 查——center 记录写入/清理均双 store 同步，二者必然同源。
 */
function trimStack(
  container: HTMLElement,
  maxStack: number,
  remove: (id: string) => void,
): void {
  const rows=Array.from(container.querySelectorAll<HTMLElement>(':scope > .icen-notification:not(.is-leaving)'));
  while(rows.length>maxStack){
    const read=rows.findIndex((item)=>!item.classList.contains('is-priority') && !item.classList.contains('is-unread'));
    const index=read>=0 ? read : rows.findIndex((item)=>!item.classList.contains('is-priority'));
    const target=rows.splice(index<0 ? 0 : index,1)[0];
    const record=store.get(target.id);if(record)stopRuntime(record);
    remove(target.id);
    removeOne(target,record ? ()=>record.opts.onClose?.(makeHandle(record)) : undefined);
  }
}

/* ═══ 倒计时 + hover 暂停 ═══ */

function attachTimer(record: NotificationRecord, handle: NotificationHandle): void {
  if(!record.el)return;
  let clock=clocks.get(record);
  if(!clock){clock=createFeedbackClock(record.el,record,()=>dismissRecord(record.id),'.icen-notification-countdown-fill',()=>record.opts.pauseOnHover ?? record.cfgRef?.pauseOnHover ?? cfg.pauseOnHover);clocks.set(record,clock);}
  record.restartTimer=()=>clock!.reset(record.duration);
  handle.pause=()=>clock!.pause();
  handle.resume=()=>{clock!.resume('failure');clock!.resume();};
}
function stopRuntime(record: NotificationRecord): void {
  clocks.get(record)?.destroy();clocks.delete(record);
  if(record.timer){window.clearTimeout(record.timer);record.timer=0;}
  if(record.el)cancelFeedbackAction(record.el);
}

/* ═══ Handle 工厂 ═══ */

function makeHandle(record: NotificationRecord): NotificationHandle {
  const handle: NotificationHandle = {
    id: record.id,
    el: record.el ?? document.createElement('div'),
    dismiss: () => {if(store.get(record.id) === record)dismissRecord(record.id);},
    update: (patch) => {if(store.get(record.id) === record)updateRecord(record.id, patch);},
    setProgress: (value, label) => {if(store.get(record.id) === record)updateRecord(record.id, {
      progress: Math.min(1, Math.max(0, value)),
      progressLabel: label,
    });},
    markRead: () => {if(store.get(record.id) === record)updateRecord(record.id, { unread: false });},
    pause: () => clocks.get(record)?.pause(),
    resume: () => {clocks.get(record)?.resume('failure');clocks.get(record)?.resume();},
  };
  return handle;
}

/* ═══ 记录操作 ═══ */

/**
 * showRecord 与 center.push 的公共入栈流水线：
 * 构造 record → makeHandle → renderNotification → pushToContainer → 注册 store →
 * attachTimer → trimStack → persistSave → playSound → onShow。
 * 两条调用路径的差异全部参数化（差异点与理由）：
 *   - maxStack：全局读 cfg（可被 notify.config 热更），center 读 local（可被 center.config 热更）
 *   - cfgRef：center 记录挂 local 配置（驱动持久化分组、pauseOnHover、声音），全局为 undefined
 *   - ownerStore：center 双写（localStore 为其 get/getAll 数据源，全局 store 兼作
 *     全量索引以复用 dismissRecord / trimStack），全局路径仅写全局 store
 */
function pushRecord(
  title: string,
  kind: NotificationKind,
  opts: NotificationOptions,
  container: HTMLElement,
  maxStack: number,
  cfgRef?: Required<NotificationConfig>,
  ownerStore?: Map<string, NotificationRecord>,
): NotificationHandle {
  const id = opts.id ?? genId();
  if(store.has(id))dismissRecord(id,true);
  document.querySelectorAll<HTMLElement>('.icen-notification.is-leaving').forEach((el)=>{if(el.id === id)el.remove();});
  const duration = opts.duration ?? 0;
  const record: NotificationRecord = {
    id,
    title,
    kind,
    // 默认值放展开前会被显式传入的 { unread: undefined } 覆盖回 undefined，故先展开再兜底
    opts: { ...opts, unread: opts.unread ?? false, id },
    el: null,
    createdAt: Date.now(),
    duration,
    remaining: duration,
    paused: false,
    timer: 0,
    startedAt: 0,
    cfgRef,
    ownerStore,
  };

  const handle = makeHandle(record);
  const el = renderNotification(record, container, () => handle);
  record.el = el;
  handle.el = el;

  pushToContainer(container, el, record.opts.priority ?? 'normal');
  // center 先写 localStore 再写全局索引 store；全局路径 ownerStore 为 undefined，仅写全局 store
  ownerStore?.set(id, record);
  store.set(id, record);

  attachTimer(record, handle);
  trimStack(container, maxStack, (removedId) => {
    ownerStore?.delete(removedId);
    store.delete(removedId);
  });
  persistSave();
  playSound(cfgRef?.sound ?? cfg.sound);

  opts.onShow?.(handle);

  return handle;
}

function showRecord(
  title: string,
  kind: NotificationKind,
  opts: NotificationOptions,
): NotificationHandle | null {
  if (!isBrowser()) return null;

  const container = ensureContainer();
  // 全局单例路径：maxStack/声音读全局 cfg，不挂 cfgRef / ownerStore
  return pushRecord(title, kind, opts, container, cfg.maxStack);
}

function dismissRecord(id: string, immediate = false): void {
  const record = store.get(id);
  if (!record) {
    // 兜底：DOM 上找
    const el = document.getElementById(id);
    if (el && el.classList.contains('icen-notification')) removeOne(el);
    return;
  }
  stopRuntime(record);
  const handle = makeHandle(record);
  const onClose = record.opts.onClose;
  store.delete(id);
  record.ownerStore?.delete(id);
  if (record.el && immediate) {restoreFeedbackFocus(record.el);record.el.remove();onClose?.(handle);}
  else if (record.el) removeOne(record.el, () => onClose?.(handle));
  else onClose?.(handle);
  persistSave();
}

function updateRecord(id: string, patch: NotificationUpdatePatch): void {
  const record = store.get(id);
  if (!record) return;
  const wasComplete=(record.opts.progress ?? 0)>=1;
  const wasProgress=record.opts.progress !== undefined;
  if (patch.title !== undefined) record.title = patch.title;
  if (patch.description !== undefined) record.opts.description = patch.description;
  if (patch.duration !== undefined) {
    record.duration = patch.duration;
    record.remaining = patch.duration;
  }
  if (patch.unread !== undefined) record.opts.unread = patch.unread;
  if (patch.progress !== undefined) record.opts.progress = patch.progress;
  if (patch.progressLabel !== undefined) record.opts.progressLabel = patch.progressLabel;
  if (patch.actions !== undefined) record.opts.actions = patch.actions;
  if (patch.tag !== undefined) record.opts.tag = patch.tag;
  if (patch.priority !== undefined) record.opts.priority = patch.priority;
  if (patch.icon !== undefined) record.opts.icon = patch.icon;
  if (patch.iconName !== undefined) record.opts.iconName = patch.iconName;
  if (patch.avatar !== undefined) record.opts.avatar = patch.avatar;
  if (patch.link !== undefined) record.opts.link = patch.link;
  if (patch.linkLabel !== undefined) record.opts.linkLabel = patch.linkLabel;

  // 局部 DOM 更新（避免完全重渲染丢失 hover/timer 状态）
  const el = record.el;
  if (!el) return;
  if(patch.actions !== undefined) {
    cancelFeedbackAction(el);
    if(store.get(id) !== record)return;
    const old=el.querySelector<HTMLElement>('.icen-notification-actions'),owned=old?.contains(document.activeElement);
    const next=buildActions(record),target=next?.querySelector<HTMLButtonElement>('button') ?? el.querySelector<HTMLButtonElement>('.icen-notification-close');
    if(owned && !target)restoreFeedbackFocus(el);
    old?.remove();
    if(next)el.querySelector('.icen-notification-content')?.append(next);
    if(owned)target?.focus({preventScroll:true});
    if(!el.contains(document.activeElement))clocks.get(record)?.resume('focus');
  }
  if(patch.icon !== undefined || patch.iconName !== undefined || patch.avatar !== undefined || (patch.progress !== undefined && (!wasProgress || wasComplete !== (patch.progress>=1)))) {
    el.querySelector('.icen-notification-icon')?.replaceWith(buildIcon(record));
    el.classList.toggle('icen-has-avatar',Boolean(record.opts.avatar));
  }
  if(patch.link !== undefined || patch.linkLabel !== undefined) {
    el.querySelector('.icen-notification-link-wrap')?.remove();
    const link=buildLink(record);if(link)el.querySelector('.icen-notification-content')?.append(link);
  }

  if (patch.duration !== undefined && el.isConnected) {
    // 通知在显示中：按新 duration 重启运行中的计时，并同步倒计时条
    syncCountdownBar(record);
    if (record.restartTimer) record.restartTimer();
    else if (patch.duration > 0) attachTimer(record, makeHandle(record));
  }
  if (patch.title !== undefined) {
    const t = el.querySelector<HTMLElement>('.icen-notification-title');
    if (t) setFeedbackText((t.querySelector<HTMLElement>('.icen-notification-open') ?? t),patch.title);
  }
  if (patch.description !== undefined) {
    let m = el.querySelector<HTMLElement>('.icen-notification-message');
    if (patch.description) {
      if (!m) {
        m = document.createElement('p');
        m.className = 'icen-notification-message';
        m.style.whiteSpace = 'pre-wrap';
        const content = el.querySelector('.icen-notification-content');
        const titleEl = content?.querySelector('.icen-notification-title');
        if (titleEl && titleEl.nextSibling) content?.insertBefore(m, titleEl.nextSibling);
        else content?.appendChild(m);
      }
      setFeedbackText(m,patch.description);
    } else if (m) {
      m.remove();
    }
  }
  if (patch.unread !== undefined) {
    el.classList.toggle('is-unread', patch.unread);
  }
  if (patch.priority !== undefined) {
    el.classList.toggle('is-priority', patch.priority === 'high');
    if(el.parentElement)pushToContainer(el.parentElement,el,patch.priority);
  }
  if (patch.progress !== undefined || patch.progressLabel !== undefined) {
    el.classList.add('is-progress');
    el.classList.toggle('is-complete',(record.opts.progress ?? 0)>=1);
    let progWrap = el.querySelector<HTMLElement>('.icen-notification-progress');
    const pct = Math.min(100, Math.max(0, (record.opts.progress ?? 0) * 100));
    if (!progWrap) {
      progWrap = document.createElement('div');
      progWrap.className = 'icen-notification-progress';
      const track = document.createElement('div');
      track.className = 'icen-notification-progress-track';
      const fill = document.createElement('div');
      fill.className = 'icen-notification-progress-bar';
      track.appendChild(fill);
      progWrap.appendChild(track);
      el.querySelector('.icen-notification-content')?.appendChild(progWrap);
    }
    const fill = progWrap.querySelector<HTMLElement>('.icen-notification-progress-bar');
    if (fill) fill.style.width = pct + '%';
    let lbl = progWrap.querySelector<HTMLElement>('.icen-notification-progress-label');
    const labelText = record.opts.progressLabel ?? Math.round(pct) + '%';
    if (!lbl) {
      lbl = document.createElement('span');
      lbl.className = 'icen-notification-progress-label';
      progWrap.appendChild(lbl);
    }
    lbl.textContent = labelText;
  }
  persistSave();
}

/* ═══ Promise confirm ═══ */

function confirmDialog(
  title: string,
  opts: NotificationConfirmOptions = {},
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!isBrowser()) {
      resolve(false);
      return;
    }
    let resolved = false;
    const settle = (val: boolean): void => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };
    const confirmLabel = opts.confirmLabel ?? t('common.confirm');
    const cancelLabel = opts.cancelLabel ?? t('common.cancel');
    const actions: NotificationAction[] = [
      {
        label: cancelLabel,
        type: 'ghost',
        onClick: () => settle(false),
      },
      {
        label: confirmLabel,
        type: 'primary',
        onClick: () => settle(true),
      },
    ];
    const handle = showRecord(title, 'info', {
      ...opts,
      actions,
      closable: false,
      onClose: () => settle(false),
    });
    if (!handle) settle(false);
  });
}

/* ═══ 多容器函数式 API ═══ */

export interface NotificationCenterHandle {
  push(notif: NotificationPushInput): NotificationHandle | null;
  dismiss(id?: string): void;
  clear(): void;
  markAllRead(): void;
  /** 销毁容器：移除 DOM、清掉其所有 timer 与监听器；之后 push 返回 null */
  destroy(): void;
  get(id: string): NotificationRecord | null;
  getAll(): NotificationRecord[];
  config(opts: NotificationConfig): void;
  el: HTMLElement;
}

export interface NotificationPushInput {
  title: string;
  kind?: NotificationKind;
  options?: NotificationOptions;
}

/**
 * 创建一个独立的通知中心容器（可同时存在多个，比如顶部=警告、右下=消息）。
 * 注意：默认全局 notify.* 走单例容器，与本函数创建的额外容器并存。
 */
export function createNotificationCenter(
  parent?: ParentNode,
  opts: NotificationConfig = {},
): NotificationCenterHandle {
  if (!isBrowser()) {
    return {
      push: () => null,
      dismiss() { /* noop */ },
      clear() { /* noop */ },
      markAllRead() { /* noop */ },
      destroy() { /* noop */ },
      get: () => null,
      getAll: () => [],
      config() { /* noop */ },
      // SSR 桩：非真实元素，destroy 前不得触碰 el（本分支内其余方法均为 no-op）
      el: {} as HTMLElement,
    };
  }
  const mount: ParentNode = parent ?? document.body;

  const local: Required<NotificationConfig> = {
    position: opts.position ?? 'top-right',
    maxStack: opts.maxStack ?? 5,
    pauseOnHover: opts.pauseOnHover ?? true,
    persist: opts.persist ?? false,
    sound: opts.sound ?? false,
  };

  const container = document.createElement('div');
  container.className = 'icen-notification-container';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', t('notification.ariaLabel'));
  container.dataset.icenPosition = local.position;
  mount.appendChild(container);

  const localStore = new Map<string, NotificationRecord>();
  let destroyed = false;

  // 恢复本 center 持久化的通知
  const pKey = persistKeyFor(local.persist);
  if (pKey) {
    knownPersistKeys.add(pKey);
    for (const r of restorePersisted(container, pKey, local)) {
      r.ownerStore = localStore;
      localStore.set(r.id, r);
      store.set(r.id, r);
    }
  }

  function push(input: NotificationPushInput): NotificationHandle | null {
    if (destroyed) return null;
    // 局部 center 路径：maxStack/声音读 local，记录挂 cfgRef/ownerStore 双写两个 store；
    // 显式 id 与全局路径一致：替换同 id 记录，旧句柄不会影响新记录。
    return pushRecord(
      input.title,
      input.kind ?? 'info',
      input.options ?? {},
      container,
      local.maxStack,
      local,
      localStore,
    );
  }

  function dismiss(id?: string): void {
    if(id){if(localStore.has(id))dismissRecord(id);return;}
    Array.from(localStore.keys()).forEach((key)=>dismissRecord(key));
  }

  function clear(): void {
    dismiss();
  }

  function markAllRead(): void {
    localStore.forEach((rec) => {
      rec.opts.unread = false;
      rec.el?.classList.remove('is-unread');
    });
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    // 清掉所有计时器与记录（元素上的监听器随容器 DOM 一并移除）
    const closing=Array.from(localStore.values());
    localStore.forEach((rec) => {
      stopRuntime(rec);
      if(rec.el)restoreFeedbackFocus(rec.el);
      store.delete(rec.id);
    });
    localStore.clear();
    container.remove();
    closing.forEach((rec)=>rec.opts.onClose?.(makeHandle(rec)));
  }

  return {
    push,
    dismiss,
    clear,
    markAllRead,
    destroy,
    get: (id) => localStore.get(id) ?? null,
    getAll: () => Array.from(localStore.values()),
    config: (next) => {
      if (next.position) { local.position = next.position; container.dataset.icenPosition = next.position; }
      if (typeof next.maxStack === 'number' && Number.isFinite(next.maxStack) && next.maxStack>=1) {local.maxStack=Math.floor(next.maxStack);trimStack(container,local.maxStack,(id)=>{localStore.delete(id);store.delete(id);});}
      if (typeof next.pauseOnHover === 'boolean') local.pauseOnHover = next.pauseOnHover;
      if (next.persist !== undefined) {
        local.persist = next.persist;
        const k = persistKeyFor(next.persist);
        if (k) knownPersistKeys.add(k);
      }
      if (next.sound !== undefined) local.sound = next.sound;
    },
    el: container,
  };
}

/* ═══ 全局 notify ═══ */

export const notify: NotifyFn = Object.assign(
  (title: string, opts?: NotificationOptions) => showRecord(title, 'info', opts ?? {}),
  {
    success: (title: string, opts?: NotificationOptions) => showRecord(title, 'success', opts ?? {}),
    warn: (title: string, opts?: NotificationOptions) => showRecord(title, 'warning', opts ?? {}),
    error: (title: string, opts?: NotificationOptions) => showRecord(title, 'error', opts ?? {}),
    info: (title: string, opts?: NotificationOptions) => showRecord(title, 'info', opts ?? {}),
    progress: (title: string, opts?: NotificationOptions) => showRecord(title, 'info', { progress: opts?.progress ?? 0, ...opts }),
    confirm: (title: string, opts?: NotificationConfirmOptions) => confirmDialog(title, opts),
    dismiss: (id?: string) => {
      if (!isBrowser()) return;
      if (id) { dismissRecord(id); return; }
      Array.from(store.keys()).forEach((k) => dismissRecord(k));
    },
    clear: () => {
      if (!isBrowser()) return;
      Array.from(store.keys()).forEach((k) => dismissRecord(k));
    },
    markRead: (id?: string) => {
      if (!isBrowser()) return;
      if (id) { updateRecord(id, { unread: false }); return; }
      store.forEach((_, k) => updateRecord(k, { unread: false }));
    },
    update: (id: string, patch: NotificationUpdatePatch) => updateRecord(id, patch),
    get: (id: string) => store.get(id) ?? null,
    getAll: () => Array.from(store.values()),
    config: (opts: NotificationConfig) => {
      if(!isBrowser())return;
      if (opts.position) {
        cfg.position = opts.position;
        const c = document.body.querySelector<HTMLElement>('.icen-notification-container[data-icen-notif-default]');
        if (c) c.dataset.icenPosition = opts.position;
      }
      if (typeof opts.maxStack === 'number' && Number.isFinite(opts.maxStack) && opts.maxStack>=1) {cfg.maxStack=Math.floor(opts.maxStack);const c=document.querySelector<HTMLElement>('[data-icen-notif-default]');if(c)trimStack(c,cfg.maxStack,(id)=>store.delete(id));}
      if (typeof opts.pauseOnHover === 'boolean') cfg.pauseOnHover = opts.pauseOnHover;
      if (opts.persist !== undefined) {
        cfg.persist = opts.persist;
        const k = persistKeyFor(opts.persist);
        if (k) knownPersistKeys.add(k);
      }
      if (opts.sound !== undefined) cfg.sound = opts.sound;
    },
  },
);

/**
 * 委托初始化：建立默认容器 + 恢复持久化通知。幂等。
 * 返回销毁函数：移除本次恢复的持久化通知（连同 DOM 与 store 记录），默认容器已空时
 * 一并回收，并复位幂等标记（可重新 init）。注意：销毁只回收 init 恢复的内容；
 * notify() 逐条创建的通知不在回收范围（由宿主自行 dismiss），destroy 后 push 仍可用。
 */
export function initNotification(): () => void {
  if (!isBrowser()) return () => {};
  if (globalInit.done) return globalInit.dispose!;
  globalInit.done = true;
  const container = ensureContainer();
  // 恢复持久化通知
  const key = persistKeyFor(cfg.persist);
  const restored: NotificationRecord[] = [];
  if (key) {
    knownPersistKeys.add(key);
    for (const r of restorePersisted(container, key)) {
      store.set(r.id, r);
      restored.push(r);
    }
  }
  const dispose=() => {
    if(globalInit.dispose !== dispose)return;
    for (const r of restored) {
      stopRuntime(r);
      if(store.get(r.id) === r)store.delete(r.id);
      r.el?.remove();
    }
    restored.length = 0;
    /* 默认容器已空则一并回收（仍有活跃通知时保留容器） */
    if (container.childElementCount === 0) container.remove();
    globalInit.done = false;globalInit.dispose=undefined;
  };
  globalInit.dispose=dispose;return dispose;
}
