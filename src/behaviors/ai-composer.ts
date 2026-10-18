/*
 * @icen.ai/ui — Behavior: ai-composer（AI 输入台 v2，与 components/ai-chat.css 配套）
 *
 * DOM 契约（v2，规格 §8；v1 旧结构无 toolbar 时照常工作，见「向后兼容」）：
 *   <div class="icen-ai-composer" data-icen-ai-composer [.is-running]>
 *     <div class="icen-ai-composer-queue" hidden><!-- 排队消息 chips（v1 已有） --></div>
 *     <div class="icen-ai-composer-refs" hidden><!-- @ 引用 chips（setComposerRefs） --></div>
 *     <div class="icen-ai-composer-attach" hidden><!-- 附件 chips（v1 已有） --></div>
 *     <div class="icen-ai-composer-box icen-control">
 *       <icen-textarea class="icen-ai-composer-input" rows="1" placeholder="…"></icen-textarea>
 *       <div class="icen-ai-composer-actions"><!-- v1 旧结构：附件 + 发送 --></div>
 *       <div class="icen-ai-composer-toolbar"><!-- v2 工具条：models/usage 配置时出现 -->
 *         <button class="icen-ai-composer-model" data-icen-ai-model-open>provider 图标 + 模型名</button>
 *         <span class="icen-ai-composer-spacer"></span>
 *         <span class="icen-ai-composer-usage" data-icen-ai-usage></span>   <!-- 用量环挂载点 -->
 *         <button class="icen-ai-composer-btn" data-icen-ai-attach></button>
 *         <button class="icen-ai-composer-send" data-icen-ai-send></button>  ← 运行态变 .is-stop 停止钮
 *       </div>
 *     </div>
 *   </div>
 *   弹层 .icen-ai-composer-popup（portal body，JS 动态创建/移除，listbox 语义）：
 *     模型切换 / 斜杠命令 / @ 引用 / 资源目录四模式共用基座，含搜索框、分组、空态、底部提示。
 *     尺寸走 PanelSizing 契约：composer 根 data-panel-* 为用户覆盖（四弹层共用），
 *     bindComposer opts.popoverSizing 整体覆盖，原内置魔数仅为默认。
 *
 * v1 契约（§4.3，全部保留）：
 *   initAiComposer(root?)        幂等（__icenAiComposerInit）；autosize（默认上限 8 行后内滚）；
 *                                Enter 发送 / Shift+Enter 换行 / IME 组合态安全。发送派
 *                                icen:ai-send {text} 并清空。附件钮打开 file input，选中文件
 *                                生成 chip，派 icen:ai-attach {files}。返回销毁函数。
 *   setComposerRunning(el, bool) 运行态切换：发送钮变停止钮（.is-stop，点击派 icen:ai-stop {}），
 *                                此时回车转为入队：queue chip + 派 icen:ai-queue {text}；
 *                                chip × 移除 + 派 icen:ai-dequeue {index}。
 *
 * v2 新增（§8，全部可选配置）：
 *   setComposerModels(el, providers, current?)   工具条出现模型钮；弹层按 provider 分组 +
 *                                搜索过滤 + 当前轻高亮；选择派 icen:ai-model-change
 *                                {provider, model, label, context}；选中模型的 context 自动成为
 *                                setComposerUsage 的 total 默认值（显式 opts.total 优先）。
 *   setComposerCommands(el, commands)            输入开头 `/` 触发命令弹层（随输入过滤，
 *                                ↑↓/Enter/Tab/Esc）；选中派 icen:ai-command {name, args}
 *                                并清空输入（命令拦截不进消息流）。
 *   setComposerRefs(el, sources)                 任意位置 `@` 触发引用弹层（按 kind 分组）；
 *                                选中插入 `@label ` + refs chip +1，派 icen:ai-ref
 *                                {action:'add', ref}；chip × 移除（同时删文本首个 `@label`）
 *                                派 {action:'remove', ref}。kind 开放注册：registerRefKind
 *                                (kind, {label, icon?, order?})；未知 kind 不丢弃（通用文档
 *                                图标 + kind 原文兜底，排最后）。
 *   setComposerUsage(el, usage, opts)            工具条右侧挂 renderAiUsageRing（./ai-panel）。
 *   历史：发送成功的文本进历史数组（每 composer 独立）；输入为空时 ↑ 取回上一条；
 *         运行中 ↑ 优先取回最后一条排队消息（从队列移除并派 icen:ai-dequeue）。
 *   附件三入口：钮选 / textarea 粘贴文件 / box 拖放文件（共用 icen:ai-attach {files}，
 *         拖放时 box 挂 .is-dragover 高亮）。
 *
 * 绑定层（spec §11，「零接线全链路」）：
 *   bindComposer(el, opts?) → { retry(), unbind() }：事件驱动把 composer ↔ 消息区 ↔ client ↔
 *         用量环接成闭环。opts.client + opts.messages = 对话全托管（send → renderAiMessage
 *         用户消息 + client.stream → assistant 流式渲染 → done 收尾；错误 → setError+fail；
 *         stop → cancel；成功后队列自动续发，停止/失败暂停；retry() 或消息继续钮就地重试）；opts.usage.from = 'context'（默认，环语义
 *         正确的上下文估算）| 'billing'（计费累加）| AiAuditor（summary()）；running 自动
 *         管理（send→running / icen:ai-done→解除）。不传 client 为纯状态绑定（渐进采用）。
 *         opts.popoverSizing（PanelSizing）整体覆盖四弹层尺寸（> composer 根 data-panel-*）。
 *
 * 向后兼容：未配置 models/usage 时工具条不出现，v1 markup（.icen-ai-composer-actions 旧结构）
 *   零改动可用；配置后 v1 的 attach/send 按钮被移入工具条（事件监听不受影响）。
 * 按钮图标：data-icen-ai-send / data-icen-ai-attach 为空时注入库内默认 SVG（经 ai-core svgIcon() 消毒）。
 * SSR 下为 no-op；文本一律 textContent，禁 innerHTML。
 */

import { createIcon, iconHTML, type IconName } from './icons';
import { formatTokens, contextEstimate, svgIcon, addUsage, type AiUsage, type AiContent } from './ai-core';
import { revealPopoverItem, closePopover, openPopover, resolvePanelSizing, type PanelSizing } from './popover';
import { renderAiUsageRing, renderAiTodo, type AiUsageRingOpts } from './ai-panel';
import type { AiStatus } from './ai-core';
import type { AiTodoItem } from './ai-panel';
import {
  renderAiMessage,
  type AiMessageHandle,
  type AiStreamHandle,
} from './ai-chat';
import type { AiAuditor, AiChatMessage, AiClient, AiDoneEventDetail, AiStreamSession } from './ai-provider';
import { emitIcen, type IcenEventMap } from './events';
import { t } from './i18n';
import { enhanceSearchField, type SearchFieldHandle } from './input';

/* ══════════════ 类型 ══════════════ */

export interface AiProviderModelOption {
  id: string;
  label: string;
  /** 上下文窗口 token 数（如 1_000_000 → 弹层显示 1M） */
  context?: number;
}

export interface AiProviderOption {
  id: string;
  label: string;
  /** 单色 SVG 字符串（经 svgIcon 消毒）；缺失时用首字母圆形章（token 色） */
  icon?: string;
  models: AiProviderModelOption[];
}

export interface AiComposerCurrentModel {
  provider: string;
  model: string;
}

export interface AiComposerCommand {
  name: string;
  /** Human-readable name; /name remains the stable command identifier. */
  label?: string;
  description?: string;
  group?: string;
  icon?: IconName;
  keywords?: string[];
  /** Unavailable choices remain discoverable, with a reason, but cannot execute. */
  disabled?: boolean;
  /** 参数提示（如 "<path>"），弹层命令行右侧灰色展示 */
  argsHint?: string;
}

/** 引用 kind：内置 6 种 + 开放注册；`string & {}` 保自动补全同时放行 registerRefKind 注册的任意 kind（照 charts.ts ChartTone 手法） */
export type AiComposerRefKind = 'skill' | 'tool' | 'file' | 'folder' | 'doc' | 'agent' | (string & {});

export interface AiComposerRefSource {
  kind: AiComposerRefKind;
  id: string;
  label: string;
  sub?: string;
  description?: string;
  icon?: IconName;
  keywords?: string[];
  disabled?: boolean;
}

/** A snapshot of one submission. Existing text-only consumers remain compatible. */
export interface AiComposerSubmission {
  text: string;
  refs?: AiComposerRefSource[];
  files?: File[];
}

/* ══════════════ 组件局部常量 ══════════════ */

const MAX_ROWS_DEFAULT = 8;
const HISTORY_LIMIT = 50;
/** 缓存读占比 ≥ 40% 时，模型弹层底部提示升级为 warning 色（Kimi Code 细节） */
const CACHE_WARN_RATIO = 0.4;

const SEND_ICON = iconHTML('arrow-up');
const STOP_ICON = iconHTML('stop');
const ATTACH_ICON = iconHTML('paperclip');
const ICON_INFO = iconHTML('circle-info');
const ICON_FILE = iconHTML('file');
const ICON_FOLDER = iconHTML('folder');
const ICON_DOC = iconHTML('document');
const ICON_BOT = iconHTML('agent');

/* ── 引用 kind 注册表（照 ai-core registerAiKind 模式：内置默认 + Map 注册表 + 兜底） ── */

/** 引用 kind 定义（registerRefKind 的注册面）。 */
export interface AiComposerRefDef {
  /** 分组标题（弹层 group label；未知 kind 兜底为 kind 原文） */
  label: string;
  /** 单色 SVG 字符串（经 svgIcon 消毒）；缺省用通用文档图标 */
  icon?: string;
  /** 分组排序权重（小者在前）；缺省排在已知 kind 之后（最后） */
  order?: number;
}

/** 内部解析形态：三字段全部落定（label/icon/order 查找的统一返回）。 */
interface ResolvedRefKindDef {
  label: string;
  icon: string;
  order: number;
}

/** 内置 kind 默认（取代原 LABEL/ICON/ORDER 三张硬编码表；注册表可逐项覆盖）。 */
const REF_KIND_BUILTIN: Record<string, ResolvedRefKindDef> = {
  skill: { label: t('aiComposer.skills'), icon: iconHTML('sparkle'), order: -2 },
  tool: { label: t('aiComposer.tools'), icon: iconHTML('box'), order: -1 },
  file: { label: t('aiComposer.attachFile'), icon: ICON_FILE, order: 0 },
  folder: { label: t('aiComposer.attachFolder'), icon: ICON_FOLDER, order: 1 },
  doc: { label: t('aiComposer.attachDoc'), icon: ICON_DOC, order: 2 },
  agent: { label: t('aiComposer.attachAgent'), icon: ICON_BOT, order: 3 },
};

/** 未知且未注册 kind 的排序兜底（恒排最后）。 */
const REF_KIND_ORDER_LAST = Number.MAX_SAFE_INTEGER;

const REF_KIND_REGISTRY = new Map<string, AiComposerRefDef>();

/**
 * 注册（或覆盖）一个引用 kind（第三方扩展入口，照 registerAiKind 的 Map + 兜底模式）。
 * 注册后弹层分组标题/图标/排序取注册表值；未注册的未知 kind 不再静默丢弃——
 * 标题用 kind 原文、图标用通用文档图标、排序排最后。
 */
export function registerRefKind(kind: string, def: AiComposerRefDef): void {
  const key = kind.trim();
  if (key) REF_KIND_REGISTRY.set(key, def);
}

/** kind 定义查找（内置默认 + 注册表合并）：注册表优先 → 内置默认 → 通用兜底。 */
function getRefKindDef(kind: string): ResolvedRefKindDef {
  const reg = REF_KIND_REGISTRY.get(kind);
  const builtin = REF_KIND_BUILTIN[kind];
  return {
    label: reg?.label ?? builtin?.label ?? kind,
    icon: reg?.icon ?? builtin?.icon ?? ICON_DOC,
    order:
      reg && typeof reg.order === 'number' && Number.isFinite(reg.order)
        ? reg.order
        : builtin?.order ?? REF_KIND_ORDER_LAST,
  };
}

/**
 * 已知 kind 全集 = 内置 ∪ 注册表 ∪ 当前 sources 里出现过的 kind，按解析后的 order
 * 升序（未知 kind 恒排最后；同序保持插入序稳定）。渲染/过滤不依赖 AiComposerRefKind
 * 穷举——sources 传入联合之外的 kind 也会得到分组。
 */
function knownRefKinds(sources: AiComposerRefSource[]): string[] {
  const kinds = new Set<string>(Object.keys(REF_KIND_BUILTIN));
  for (const key of REF_KIND_REGISTRY.keys()) kinds.add(key);
  for (const s of sources) {
    if (typeof s?.kind === 'string' && s.kind) kinds.add(s.kind);
  }
  return Array.from(kinds).sort((a, b) => getRefKindDef(a).order - getRefKindDef(b).order);
}

/* ══════════════ 每 composer 状态（WeakMap，配置跨 init/destroy 保留）══════════════ */

interface MarkedComposer extends HTMLElement {
  __icenAiComposerInit?: boolean;
}

const RUNNING = new WeakMap<HTMLElement, boolean>();
const QUEUES = new WeakMap<HTMLElement, AiComposerSubmission[]>();
const FILES = new WeakMap<HTMLElement, File[]>();
const MODELS = new WeakMap<HTMLElement, { providers: AiProviderOption[]; current: AiComposerCurrentModel }>();
/** 选中模型的 context——usage ring total 的默认值 */
const MODEL_CTX = new WeakMap<HTMLElement, number>();
const COMMANDS = new WeakMap<HTMLElement, AiComposerCommand[]>();
const REF_SOURCES = new WeakMap<HTMLElement, AiComposerRefSource[]>();
const ACTIVE_REFS = new WeakMap<HTMLElement, AiComposerRefSource[]>();
const USAGE = new WeakMap<HTMLElement, { usage: AiUsage; opts: AiUsageRingOpts }>();
/** 待办业务状态（命名避开 TODO 扫描标记：这是数据不是待办） */
const TODO_STATES = new WeakMap<HTMLElement, AiTodoItem[]>();
const HISTORIES = new WeakMap<HTMLElement, { items: string[]; index: number }>();
const POPUP = new WeakMap<HTMLElement, ComposerPopup>();
/** setupComposer 注册的 submit 闭包（弹层无匹配 Enter 回退发送用） */
const SUBMITS = new WeakMap<HTMLElement, () => void>();
/** bindComposer opts.popoverSizing：四弹层共用的程序面整体覆盖（> composer 根 data-panel-* > 内置默认） */
const POPUP_SIZING = new WeakMap<HTMLElement, PanelSizing>();

/* ══════════════ 小工具 ══════════════ */

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function emit<K extends keyof IcenEventMap>(target: HTMLElement, name: K, detail: IcenEventMap[K]): void {
  emitIcen(target, name, detail);
}

/** el 传 composer 容器或其内部任意元素，就近解析 [data-icen-ai-composer]。 */
function resolveComposer(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>('[data-icen-ai-composer]');
}

function getTextarea(composer: HTMLElement): HTMLTextAreaElement | null {
  return composer.querySelector<HTMLTextAreaElement>('.icen-ai-composer-input');
}

/* autosize：rows(默认 1)…maxRows(默认 8)，超出后内滚（setup 与 v2 文本插入口共用） */
function autosizeTa(ta: HTMLTextAreaElement): void {
  const composer = ta.closest<HTMLElement>('[data-icen-ai-composer]');
  const maxRows = Number(composer?.getAttribute('data-icen-max-rows')) || MAX_ROWS_DEFAULT;
  const cs = window.getComputedStyle(ta);
  const lineHeight = parseFloat(cs.lineHeight) || 20;
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const minRows = Number(ta.getAttribute('rows')) || 1;
  ta.style.height = 'auto';
  const minH = minRows * lineHeight + padY;
  const maxH = maxRows * lineHeight + padY;
  ta.style.height = `${Math.max(minH, Math.min(ta.scrollHeight, maxH))}px`;
}

/* 注入默认图标（仅当按钮为空时）；返回 { send, stop } 图标节点便于状态切换。 */
function ensureIcons(
  composer: HTMLElement,
): { sendBtn: HTMLButtonElement | null; sendIcon: HTMLElement | null; stopIcon: HTMLElement | null } {
  const sendBtn = composer.querySelector<HTMLButtonElement>('[data-icen-ai-send]');
  if (sendBtn && !sendBtn.hasChildNodes()) {
    const sendWrap = document.createElement('span');
    sendWrap.className = 'icen-ai-composer-send-icon';
    sendWrap.dataset.icenAiSendIcon = 'send';
    const stopWrap = document.createElement('span');
    stopWrap.className = 'icen-ai-composer-send-icon';
    stopWrap.dataset.icenAiSendIcon = 'stop';
    const sendSvg = svgIcon(SEND_ICON);
    const stopSvg = svgIcon(STOP_ICON);
    if (sendSvg) sendWrap.appendChild(sendSvg);
    if (stopSvg) stopWrap.appendChild(stopSvg);
    sendBtn.append(sendWrap, stopWrap);
  }
  const attachBtn = composer.querySelector<HTMLButtonElement>('[data-icen-ai-attach]');
  if (attachBtn && !attachBtn.hasChildNodes()) {
    const icon = svgIcon(ATTACH_ICON);
    if (icon) attachBtn.appendChild(icon);
  }
  const sendIcon = sendBtn?.querySelector<HTMLElement>('[data-icen-ai-send-icon="send"]') ?? null;
  const stopIcon = sendBtn?.querySelector<HTMLElement>('[data-icen-ai-send-icon="stop"]') ?? null;
  return { sendBtn, sendIcon, stopIcon };
}

/* chips（queue / attach / refs 共用结构） */

function makeChip(text: string, removable: boolean, ariaLabel: string, icon?: IconName): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'icen-ai-composer-chip';
  if (icon) {
    const mark = document.createElement('span');
    mark.className = 'icen-ai-composer-chip-icon';
    const svg = createIcon(icon);
    if (svg) mark.append(svg);
    chip.append(mark);
  }
  const label = document.createElement('span');
  label.className = 'icen-ai-composer-chip-text';
  label.textContent = text;
  chip.appendChild(label);
  if (removable) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icen-ai-composer-chip-remove';
    remove.setAttribute('aria-label', ariaLabel);
    remove.replaceChildren(createIcon('close')!);
    chip.appendChild(remove);
  }
  return chip;
}

/** 队列 chips 渲染（模块级：setupComposer 与 bindComposer 的排队自动发送共用） */
function renderQueueChips(composer: HTMLElement): void {
  const queueEl = composer.querySelector<HTMLElement>('.icen-ai-composer-queue');
  if (!queueEl) return;
  const queue = QUEUES.get(composer) ?? [];
  queueEl.replaceChildren(...queue.map((draft, i) => makeChip(draft.text || [...(draft.files?.map(f=>f.name)??[]),...(draft.refs?.map(r=>r.label)??[])].join(' · '), true, t('aiComposer.removeQueued', { p0: i + 1 }), 'layers')));
  queueEl.hidden = queue.length === 0;
}

/* ══════════════ v1 运行态（§4.3 契约，不变）══════════════ */

/**
 * 运行态切换（spec §4.3）：
 * el 传 composer 容器或其内部任意元素（含发送钮自身），就近解析 [data-icen-ai-composer]。
 */
export function setComposerRunning(el: HTMLElement, running: boolean): void {
  const composer = resolveComposer(el);
  if (!composer) return;
  RUNNING.set(composer, running);
  composer.classList.toggle('is-running', running);
  if (running) {
    composer.setAttribute('aria-busy', 'true');
  } else {
    composer.removeAttribute('aria-busy');
  }
  const sendBtn = composer.querySelector<HTMLButtonElement>('[data-icen-ai-send]');
  if (!sendBtn) return;
  sendBtn.classList.toggle('is-stop', running);
  sendBtn.setAttribute('aria-label', running ? t('aiComposer.stop') : t('aiComposer.send'));
  const sendIcon = sendBtn.querySelector<HTMLElement>('[data-icen-ai-send-icon="send"]');
  const stopIcon = sendBtn.querySelector<HTMLElement>('[data-icen-ai-send-icon="stop"]');
  if (sendIcon) sendIcon.hidden = running;
  if (stopIcon) stopIcon.hidden = !running;
}

/* ══════════════ v2 工具条（模型钮 / spacer / 用量环 / 附件 / 发送）══════════════ */

/** provider 图标或首字母圆形章（token 色）。 */
function providerMark(provider: AiProviderOption, badgeClass: string): HTMLElement {
  const slot = document.createElement('span');
  slot.className = badgeClass;
  const svg = provider.icon ? svgIcon(provider.icon) : null;
  if (svg) {
    slot.appendChild(svg);
  } else {
    const badge = document.createElement('span');
    badge.className = 'icen-ai-composer-model-badge';
    badge.textContent = (provider.label.trim()[0] ?? '?').toUpperCase();
    slot.appendChild(badge);
  }
  return slot;
}

function buildModelButton(composer: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icen-ai-composer-model';
  btn.setAttribute('data-icen-ai-model-open', '');
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    if (POPUP.get(composer)) closePopup(composer, false);
    else openModelPopup(composer);
  });
  return btn;
}

function updateModelButton(composer: HTMLElement): void {
  const cfg = MODELS.get(composer);
  const btn = composer.querySelector<HTMLElement>('[data-icen-ai-model-open]');
  if (!cfg || !btn) return;
  const provider = cfg.providers.find((p) => p.id === cfg.current.provider) ?? cfg.providers[0];
  if (!provider) return;
  const model = provider.models.find((m) => m.id === cfg.current.model) ?? provider.models[0];
  if (!model) return;

  const iconSlot = btn.querySelector<HTMLElement>('.icen-ai-composer-model-icon')
    ?? (() => {
      const slot = document.createElement('span');
      slot.className = 'icen-ai-composer-model-icon';
      btn.prepend(slot);
      return slot;
    })();
  iconSlot.replaceChildren(providerMark(provider, 'icen-ai-composer-model-provider-icon'));

  let name = btn.querySelector<HTMLElement>('.icen-ai-composer-model-name');
  if (!name) {
    name = document.createElement('span');
    name.className = 'icen-ai-composer-model-name';
    btn.insertBefore(name, btn.querySelector('.icen-ai-composer-model-chevron'));
  }
  name.textContent = model.label;
  btn.setAttribute('aria-label', t('aiComposer.modelAria', { p0: model.label, p1: provider.label }));
  btn.querySelector('.icen-ai-composer-model-chevron')?.remove();
}

/**
 * 工具条装配/重排（幂等）。仅当配置了 models 或 usage 时创建工具条；
 * v1 的 attach/send 按钮被移入工具条（事件监听挂在元素上，随元素移动保留）。
 * 作者手写的 .icen-ai-composer-toolbar 结构只补缺、不重排。
 */
function syncToolbar(composer: HTMLElement): void {
  const box = composer.querySelector<HTMLElement>('.icen-ai-composer-box');
  if (!box || !getTextarea(composer)) return;
  const modelsCfg = MODELS.get(composer);
  const usageCfg = USAGE.get(composer);
  const hasLibrary = !!(COMMANDS.get(composer)?.length || REF_SOURCES.get(composer)?.length);
  if (!modelsCfg && !usageCfg && !hasLibrary && !composer.querySelector('.icen-ai-composer-toolbar')) return;

  let bar = composer.querySelector<HTMLElement>('.icen-ai-composer-toolbar');

  /* 模型钮（仅 models 配置时存在；只移除 JS 自动创建的） */
  let modelBtn = composer.querySelector<HTMLElement>('[data-icen-ai-model-open]');
  if (modelsCfg && !modelBtn) {
    modelBtn = buildModelButton(composer);
    modelBtn.dataset.icenAiModelOpen = 'auto';
    updateModelButton(composer);
  }
  if (!modelsCfg && modelBtn?.dataset.icenAiModelOpen === 'auto') {
    modelBtn.remove();
    modelBtn = null;
  }

  /* 用量环挂载点 */
  let usageMount = composer.querySelector<HTMLElement>('.icen-ai-composer-usage');
  if (usageCfg && !usageMount) {
    usageMount = document.createElement('span');
    usageMount.className = 'icen-ai-composer-usage';
    usageMount.dataset.icenAiUsage = 'auto';
  }
  if (!usageCfg && usageMount?.dataset.icenAiUsage === 'auto') {
    usageMount.remove();
    usageMount = null;
  }

  const attach = composer.querySelector<HTMLElement>('[data-icen-ai-attach]');
  const send = composer.querySelector<HTMLElement>('[data-icen-ai-send]');

  if (bar) {
    /* 作者已写好 v2 结构：只补缺的模型钮/用量挂载点，不重排既有子元素 */
    if (modelBtn && modelBtn.parentElement !== bar) bar.insertBefore(modelBtn, bar.firstChild);
    if (usageMount && usageMount.parentElement !== bar) {
      bar.insertBefore(usageMount, attach && attach.parentElement === bar ? attach : null);
    }
  } else {
    bar = document.createElement('div');
    bar.className = 'icen-ai-composer-toolbar';
    bar.appendChild(modelBtn ?? document.createComment('model'));
    const spacer = document.createElement('span');
    spacer.className = 'icen-ai-composer-spacer';
    bar.appendChild(spacer);
    if (usageMount) bar.appendChild(usageMount);
    if (attach) bar.appendChild(attach);
    if (send) bar.appendChild(send);
    box.appendChild(bar);
  }

  /* 清空后的 v1 按钮容器移除（忽略空白文本节点） */
  const legacy = composer.querySelector<HTMLElement>('.icen-ai-composer-actions');
  if (legacy && legacy.childElementCount === 0 && !(legacy.textContent ?? '').trim()) {
    legacy.remove();
  }
  let library = composer.querySelector<HTMLButtonElement>('[data-icen-ai-library]');
  if (hasLibrary && !library) {
    library = document.createElement('button');
    library.type = 'button';
    library.className = 'icen-ai-composer-btn icen-ai-composer-library';
    library.dataset.icenAiLibrary = 'auto';
    library.setAttribute('aria-label', t('aiComposer.library'));
    library.setAttribute('aria-haspopup', 'dialog');
    library.setAttribute('aria-expanded', 'false');
    library.append(createIcon('plus')!);
    library.addEventListener('click', () => {
      if (POPUP.get(composer)?.mode === 'library') closePopup(composer);
      else openComposerLibrary(composer);
    });
    bar.prepend(library);
  } else if (!hasLibrary && library?.dataset.icenAiLibrary === 'auto') library.remove();
}

/** 用量环重渲染：显式 opts.total 优先，否则用选中模型的 context。 */
function refreshUsageRing(composer: HTMLElement): void {
  const cfg = USAGE.get(composer);
  const mount = composer.querySelector<HTMLElement>('.icen-ai-composer-usage');
  if (!cfg || !mount) return;
  const explicit = typeof cfg.opts.total === 'number' && cfg.opts.total > 0;
  renderAiUsageRing(mount, cfg.usage, {
    ...cfg.opts,
    total: explicit ? cfg.opts.total : MODEL_CTX.get(composer),
  });
}

/* ══════════════ v2 弹层基座（portal body，一次性动态面板，listbox 语义）══════════════ */

interface ComposerPopup {
  mode: 'model' | 'command' | 'ref' | 'library';
  panel: HTMLElement;
  groups: HTMLElement[];
  options: HTMLButtonElement[];
  emptyEl: HTMLElement;
  focused: number;
  searchInput: HTMLInputElement | null;
  /** ref 模式：@token 的文本范围（start 为 '@' 下标，end 为 caret） */
  refRange: { start: number; end: number } | null;
  returnFocus: HTMLElement | null;
  keydownHandler: ((e: KeyboardEvent) => void) | null;
  pick: (opt: HTMLButtonElement) => void;
  control?: HTMLElement | null;
  category?: string;
  restoreFocus?: boolean;
  searchField?: SearchFieldHandle;
}

const visibleOptions = (s: ComposerPopup): HTMLButtonElement[] =>
  s.options.filter((o) => !o.hidden && o.getAttribute('aria-disabled') !== 'true');

let popupId = 0;

function setPopupFocus(s: ComposerPopup, idx: number): void {
  const vis = visibleOptions(s);
  s.options.forEach((o) => o.classList.remove('is-focused'));
  if (vis.length === 0) {
    s.focused = -1;
    s.control?.removeAttribute('aria-activedescendant');
    return;
  }
  s.focused = Math.max(0, Math.min(idx, vis.length - 1));
  const cur = vis[s.focused];
  cur.classList.add('is-focused');
  s.control?.setAttribute('aria-activedescendant', cur.id);
  revealPopoverItem(cur,s.panel.querySelector<HTMLElement>('.icen-ai-composer-popup-list') ?? s.panel);
}

function movePopupFocus(s: ComposerPopup, delta: number): void {
  const vis = visibleOptions(s);
  if (vis.length === 0) return;
  setPopupFocus(s, (s.focused + delta + vis.length) % vis.length);
}

/** 过滤后隐藏空分组、切换空态、焦点回第一个可见项。 */
function settlePopup(s: ComposerPopup): void {
  for (const g of s.groups) {
    g.hidden = !Array.from(g.querySelectorAll<HTMLElement>('.icen-ai-composer-popup-option'))
      .some((o) => !o.hidden);
  }
  s.emptyEl.hidden = s.options.some(o => !o.hidden);
  setPopupFocus(s, 0);
}

/** 弹层选项统一过滤（四弹层共用）：q 非空时按各 option 的 dataset.hay 隐藏不匹配项；hay 组装留在各弹层构建处。 */
function filterPopupOptions(s: ComposerPopup, q: string): void {
  const needle = q.trim().toLowerCase();
  for (const opt of s.options) {
    opt.hidden = (!!s.category && s.category !== 'all' && opt.dataset.category !== s.category)
      || (needle !== '' && !(opt.dataset.hay ?? '').includes(needle));
    // Highlight only text leaves, never replace DOM with untrusted search markup.
    for (const label of opt.querySelectorAll<HTMLElement>('[data-icen-search-text]')) {
      const text = label.dataset.icenSearchText ?? '';
      const at = needle ? text.toLowerCase().indexOf(needle) : -1;
      if (at < 0) label.textContent = text;
      else {
        const mark = document.createElement('mark'); mark.textContent = text.slice(at, at + needle.length);
        label.replaceChildren(document.createTextNode(text.slice(0,at)), mark, document.createTextNode(text.slice(at + needle.length)));
      }
    }
  }
  settlePopup(s);
}

function popupKeydown(composer: HTMLElement, s: ComposerPopup, e: KeyboardEvent): void {
  if (e.isComposing) return; /* IME 组合态安全 */
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      movePopupFocus(s, 1);
      return;
    case 'ArrowUp':
      e.preventDefault();
      movePopupFocus(s, -1);
      return;
    case 'Enter':
    case 'Tab': {
      if (e.key === 'Tab' && (s.mode === 'library' || s.mode === 'model')) {
        // Let focus leave a browse/search panel naturally. Typing-trigger completion keeps legacy Tab picking.
        return;
      }
      e.preventDefault();
      const vis = visibleOptions(s);
      const opt = vis[s.focused] ?? vis[0];
      if (opt) {
        s.pick(opt);
        return;
      }
      if(s.mode==='library'||s.mode==='model')return; // Search never submits the underlying draft.
      /* 无匹配项：Enter 回退为普通发送（未知命令不拦截、进消息流），Tab 仅关弹层 */
      closePopup(composer, false);
      if (e.key === 'Enter') SUBMITS.get(composer)?.();
      return;
    }
    case 'Home':
    case 'End':
      if (e.altKey || e.ctrlKey || e.metaKey) { e.preventDefault(); setPopupFocus(s, e.key === 'Home' ? 0 : visibleOptions(s).length - 1); }
      return;
    case 'Escape':
      e.preventDefault();
      closePopup(composer);
      return;
  }
}

/** 关弹层（restoreFocus=false 用于切换到另一个弹层或销毁时）。 */
function closePopup(composer: HTMLElement, restoreFocus = true): void {
  const s = POPUP.get(composer);
  if (!s) return;
  s.restoreFocus = restoreFocus;
  POPUP.delete(composer);
  if (s.searchInput && s.keydownHandler) {
    s.searchInput.removeEventListener('keydown', s.keydownHandler);
  }
  /* 互补条件合并：model 弹层的展开态锚在模型钮，其余两弹层锚在 textarea */
  s.control?.removeAttribute('aria-activedescendant');
  s.control?.removeAttribute('aria-controls');
  if (s.mode === 'library') {
    composer.querySelector('[data-icen-ai-library]')?.setAttribute('aria-expanded', 'false');
  } else if (s.mode === 'model') {
    composer.querySelector('[data-icen-ai-model-open]')?.setAttribute('aria-expanded', 'false');
  } else {
    getTextarea(composer)?.removeAttribute('aria-expanded');
  }
  closePopover(s.panel); /* onClose 里移除面板 */
  if (restoreFocus && s.returnFocus && s.returnFocus.isConnected) s.returnFocus.focus();
}

interface MountPopupInit {
  mode: ComposerPopup['mode'];
  anchor: Element;
  /** 本弹层的内置默认尺寸（原魔数）；实际生效见 resolvePopupSizing 的三层合并 */
  sizing: PanelSizing;
  returnFocus: HTMLElement | null;
  refRange?: { start: number; end: number } | null;
  pick: (opt: HTMLButtonElement) => void;
  build: (session: ComposerPopup) => void;
}

/**
 * 四弹层（模型/命令/引用/目录）共用的尺寸解析（PanelSizing 契约）：
 * 用户属性面 = composer 根上的 data-panel-*（data-icen-panel-width/min/max/min-height/max-height，
 * 四弹层共用一套）；程序面 = bindComposer opts.popoverSizing（整体覆盖四个弹层）；
 * init.sizing 的原魔数仅作缺省默认。优先级：popoverSizing > data-panel-* > 内置默认。
 */
function resolvePopupSizing(composer: HTMLElement, defaults: PanelSizing): PanelSizing {
  /* resolvePanelSizing：先读 composer 根属性面，程序面字段覆盖（契约内方向） */
  const explicit = resolvePanelSizing(composer, POPUP_SIZING.get(composer));
  /* 内置默认只填空：属性面/程序面显式给出的字段优先 */
  return { ...defaults, ...explicit };
}

function mountPopup(composer: HTMLElement, init: MountPopupInit): ComposerPopup {
  closePopup(composer, false);
  const panel = document.createElement('div');
  panel.className = 'icen-ai-composer-popup';
  panel.dataset.icenMaterial = 'floating';
  panel.dataset.icenMode = init.mode;
  panel.hidden = true;
  const session: ComposerPopup = {
    mode: init.mode,
    panel,
    groups: [],
    options: [],
    emptyEl: document.createElement('div'),
    focused: -1,
    searchInput: null,
    refRange: init.refRange ?? null,
    returnFocus: init.returnFocus,
    keydownHandler: null,
    pick: init.pick,
  };
  init.build(session);
  if(session.searchInput)session.searchField=enhanceSearchField(session.searchInput);
  const list = panel.querySelector<HTMLElement>('[role="listbox"]');
  if (list) {
    list.id = `icen-composer-list-${++popupId}`;
    session.options.forEach((o,i) => {o.id = `${list.id}-${i}`;o.tabIndex=-1;});
    session.control = session.searchInput ?? getTextarea(composer);
    session.control?.setAttribute('aria-controls', list.id);
    session.control?.setAttribute('aria-haspopup', 'listbox');
  }
  openPopover(panel, {
    anchor: init.anchor,
    side: 'top',
    align: 'start',
    offset: 8,
    sizing: resolvePopupSizing(composer, init.sizing),
    restoreFocus: false,
    onClose: () => {
      if (POPUP.get(composer) === session) POPUP.delete(composer);
      session.control?.removeAttribute('aria-activedescendant');
      session.control?.removeAttribute('aria-controls');
      composer.querySelector('[data-icen-ai-library]')?.setAttribute('aria-expanded', 'false');
      composer.querySelector('[data-icen-ai-model-open]')?.setAttribute('aria-expanded', 'false');
      getTextarea(composer)?.removeAttribute('aria-expanded');
      // Shared popover handles Escape in capture. Restore the real trigger, not its layout box.
      if (session.restoreFocus !== false && panel.contains(document.activeElement) && session.returnFocus?.isConnected) {
        session.returnFocus.focus({preventScroll:true});
      }
      session.searchField?.destroy();
      panel.remove();
    },
  });
  POPUP.set(composer, session);
  /* 点击 / 悬停与键盘共用一个 is-focused（select.ts 同款） */
  panel.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const opt = t.closest<HTMLButtonElement>('.icen-ai-composer-popup-option');
    if (opt && panel.contains(opt) && !opt.hidden && opt.getAttribute('aria-disabled') !== 'true') session.pick(opt);
  });
  panel.addEventListener('mouseover', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const opt = t.closest<HTMLButtonElement>('.icen-ai-composer-popup-option');
    if (!opt || opt.hidden || opt.getAttribute('aria-disabled') === 'true') return;
    const idx = visibleOptions(session).indexOf(opt);
    if (idx >= 0) setPopupFocus(session, idx);
  });
  panel.addEventListener('focusout', e => {
    const next=e.relatedTarget;
    if(next instanceof Node && !panel.contains(next) && next!==session.returnFocus)closePopup(composer,false);
  });
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !e.isComposing) {e.preventDefault(); closePopup(composer);}
    else if (e.target instanceof Element && e.target.closest('.icen-ai-composer-popup-option') && ['ArrowUp','ArrowDown'].includes(e.key)) {
      popupKeydown(composer,session,e);session.searchInput?.focus({preventScroll:true});
    }
  });
  return session;
}

/** 弹层空态装配（四弹层共用：默认隐藏，settlePopup 依可见项数切换）。 */
function appendPopupEmpty(s: ComposerPopup, text: string): void {
  s.emptyEl.className = 'icen-ai-composer-popup-empty';
  s.emptyEl.textContent = text;
  s.emptyEl.hidden = true;
  s.panel.appendChild(s.emptyEl);
}

/** 命令/引用弹层共用尺寸（随锚宽自适应）：200 下限防窄锚、320 上限防溢出、360 面板高。 */
function popupSizingFor(box: Element): PanelSizing {
  const w = box.getBoundingClientRect().width;
  return { width: Math.min(Math.max(w, 280), 440), maxWidth: 440, maxHeight: 400 };
}

function searchLeaf(text: string, className: string): HTMLElement {
  const el = document.createElement('span');el.className=className;el.textContent=text;el.dataset.icenSearchText=text;return el;
}

function resourceIcon(source: AiComposerRefSource): HTMLElement {
  const mark = document.createElement('span');mark.className='icen-ai-composer-popup-option-icon';
  const svg = (source.icon ? createIcon(source.icon) : null) ?? svgIcon(getRefKindDef(source.kind).icon);
  if(svg)mark.append(svg);return mark;
}

function resourceOption(source: AiComposerRefSource): HTMLButtonElement {
  const opt=document.createElement('button');opt.type='button';opt.className='icen-ai-composer-popup-option';opt.setAttribute('role','option');
  opt.dataset.refId=source.id;opt.dataset.refKind=source.kind;opt.dataset.category=source.kind;
  opt.dataset.hay=[source.label,source.description,source.sub,getRefKindDef(source.kind).label,...(source.keywords??[])].join(' ').toLowerCase();
  opt.setAttribute('aria-selected','false');if(source.disabled)opt.setAttribute('aria-disabled','true');
  const body=document.createElement('span');body.className='icen-ai-composer-popup-option-copy';
  body.append(searchLeaf(source.label,'icen-ai-composer-popup-option-label'));
  if(source.description||source.sub)body.append(searchLeaf(source.description??source.sub??'','icen-ai-composer-popup-option-sub'));
  opt.append(resourceIcon(source),body);return opt;
}

function commandOption(c: AiComposerCommand): HTMLButtonElement {
  const opt=document.createElement('button');opt.type='button';opt.className='icen-ai-composer-popup-option icen-ai-composer-popup-cmd';
  opt.setAttribute('role','option');opt.setAttribute('aria-selected','false');if(c.disabled)opt.setAttribute('aria-disabled','true');
  opt.dataset.name=c.name;opt.dataset.category='command';opt.dataset.hay=[c.name,c.label,c.description,c.group,...(c.keywords??[])].join(' ').toLowerCase();
  const mark=document.createElement('span');mark.className='icen-ai-composer-popup-option-icon';mark.append(createIcon(c.icon??'terminal')??createIcon('terminal')!);
  const body=document.createElement('span');body.className='icen-ai-composer-popup-option-copy';
  const line=document.createElement('span');line.className='icen-ai-composer-popup-cmd-line';
  line.append(searchLeaf(c.label??`/${c.name}`,'icen-ai-composer-popup-option-label'));
  if(c.label)line.append(searchLeaf(`/${c.name}`,'icen-ai-composer-popup-cmd-name'));
  if(c.argsHint)line.append(searchLeaf(c.argsHint,'icen-ai-composer-popup-cmd-args'));
  body.append(line);if(c.description)body.append(searchLeaf(c.description,'icen-ai-composer-popup-option-sub'));
  opt.append(mark,body);return opt;
}

function popupFoot(s: ComposerPopup, text: string): void {
  const foot=document.createElement('div');foot.className='icen-ai-composer-popup-foot';foot.textContent=text;s.panel.append(foot);
}

/** Browse without remembering syntax. Resource choices toggle; commands are staged for review, never run here. */
export function openComposerLibrary(el: HTMLElement, category = 'all'): void {
  if(!isBrowser())return;const composer=resolveComposer(el);if(!composer)return;
  const ta=getTextarea(composer);if(!ta||ta.disabled||ta.readOnly)return;
  const anchor=composer.querySelector<HTMLElement>('[data-icen-ai-library]')??ta;
  const sources=REF_SOURCES.get(composer)??[],commands=COMMANDS.get(composer)??[];
  if(!sources.length&&!commands.length)return;
  const session=mountPopup(composer,{
    mode:'library',anchor:composer,sizing:popupSizingFor(composer),returnFocus:anchor,
    pick:opt=>{
      if(opt.dataset.name){
        const draft=ta.value.replace(/^\/\S*\s?/, '');ta.value=`/${opt.dataset.name} ${draft}`;autosizeTa(ta);closePopup(composer,false);ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);return;
      }
      const source=sources.find(r=>r.id===opt.dataset.refId&&r.kind===opt.dataset.refKind);if(!source)return;
      const active=(ACTIVE_REFS.get(composer)??[]).some(r=>r.id===source.id&&r.kind===source.kind);
      if(active)removeActiveRef(composer,source);else addActiveRef(composer,source);
      opt.setAttribute('aria-selected',String(!active));
    },
    build:s=>{
      s.panel.setAttribute('role','dialog');s.panel.setAttribute('aria-label',t('aiComposer.library'));
      const search=document.createElement('div');search.className='icen-ai-composer-popup-search';
      const input=document.createElement('input');input.type='search';input.className='icen-ai-composer-popup-search-input';input.placeholder=t('aiComposer.searchLibrary');input.setAttribute('aria-label',t('aiComposer.searchLibrary'));search.append(input);s.searchInput=input;s.panel.append(search);
      const categories=[{id:'all',label:t('aiComposer.all')},...knownRefKinds(sources).filter(k=>sources.some(r=>r.kind===k)).map(k=>({id:k,label:getRefKindDef(k).label})),...(commands.length?[{id:'command',label:t('aiComposer.commands')}]:[])];
      s.category=categories.some(c=>c.id===category)?category:'all';
      const filters=document.createElement('div');filters.className='icen-ai-composer-popup-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label',t('aiComposer.refs'));
      for(const c of categories){
        const b=document.createElement('button');b.type='button';b.textContent=c.label;b.setAttribute('aria-pressed',String(c.id===s.category));
        b.addEventListener('click',()=>{s.category=c.id;for(const node of filters.querySelectorAll('button'))node.setAttribute('aria-pressed',String(node===b));filterPopupOptions(s,input.value);});filters.append(b);
      }
      s.panel.append(filters);
      const list=document.createElement('div');list.className='icen-ai-composer-popup-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',t('aiComposer.library'));list.setAttribute('aria-multiselectable','true');
      const addGroup=(title:string,options:HTMLButtonElement[])=>{
        const g=document.createElement('div');g.className='icen-ai-composer-popup-group';g.setAttribute('role','group');g.setAttribute('aria-label',title);g.append(searchLeaf(title,'icen-ai-composer-popup-group-label'),...options);list.append(g);s.groups.push(g);s.options.push(...options);
      };
      for(const kind of knownRefKinds(sources)){
        const options=sources.filter(r=>r.kind===kind).map(r=>{const opt=resourceOption(r);opt.setAttribute('aria-selected',String((ACTIVE_REFS.get(composer)??[]).some(a=>a.id===r.id&&a.kind===r.kind)));return opt;});
        if(options.length)addGroup(getRefKindDef(kind).label,options);
      }
      for(const group of new Set(commands.map(c=>c.group??t('aiComposer.commands'))))addGroup(group,commands.filter(c=>(c.group??t('aiComposer.commands'))===group).map(commandOption));
      s.panel.append(list);appendPopupEmpty(s,t('aiComposer.noLibraryMatch'));popupFoot(s,t('aiComposer.libraryHint'));
      input.addEventListener('input',()=>filterPopupOptions(s,input.value));input.addEventListener('keydown',e=>popupKeydown(composer,s,e));
    },
  });
  anchor.setAttribute('aria-expanded','true');filterPopupOptions(session,'');session.searchInput?.focus({preventScroll:true});
}

/* ── 模型弹层 ── */

function openModelPopup(composer: HTMLElement): void {
  const cfg = MODELS.get(composer);
  if (!cfg) return;
  const btn = composer.querySelector<HTMLElement>('[data-icen-ai-model-open]');
  const anchor = btn ?? composer.querySelector('.icen-ai-composer-box') ?? composer;
  const ta = getTextarea(composer);

  const session = mountPopup(composer, {
    mode: 'model',
    anchor,
    sizing: { minWidth: 220, maxWidth: 320, maxHeight: 340 },
    returnFocus: btn ?? ta,
    pick: (opt) => {
      const provider = opt.dataset.provider ?? '';
      const model = opt.dataset.model ?? '';
      const label = opt.dataset.icenLabel ?? model;
      const context = typeof opt.dataset.context === 'string' ? Number(opt.dataset.context) : undefined;
      MODELS.set(composer, { providers: cfg.providers, current: { provider, model } });
      if (typeof context === 'number' && Number.isFinite(context) && context > 0) {
        MODEL_CTX.set(composer, context);
      } else {
        MODEL_CTX.delete(composer); /* 无 context 显式清除，环回退无上限形态（不留陈旧值） */
      }
      updateModelButton(composer);
      emit(composer, 'icen:ai-model-change', { provider, model, label, context });
      refreshUsageRing(composer);
      closePopup(composer);
    },
    build: (s) => {
      /* 搜索框 */
      const search = document.createElement('div');
      search.className = 'icen-ai-composer-popup-search';
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'icen-ai-composer-popup-search-input';
      input.placeholder = t('aiComposer.searchModels');
      input.setAttribute('aria-label', t('aiComposer.searchModels'));
      search.appendChild(input);
      s.panel.appendChild(search);
      s.searchInput = input;

      /* 分组列表 */
      const list = document.createElement('div');
      list.className = 'icen-ai-composer-popup-list';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', t('aiComposer.selectModel'));
      for (const p of cfg.providers) {
        const group = document.createElement('div');
        group.className = 'icen-ai-composer-popup-group';
        const glabel = document.createElement('div');
        glabel.className = 'icen-ai-composer-popup-group-label';
        glabel.appendChild(providerMark(p, 'icen-ai-composer-popup-group-icon'));
        const gtext = document.createElement('span');
        gtext.textContent = p.label;
        glabel.appendChild(gtext);
        group.appendChild(glabel);
        for (const m of p.models) {
          const opt = document.createElement('button');
          opt.type = 'button';
          opt.className = 'icen-ai-composer-popup-option';
          opt.setAttribute('role', 'option');
          opt.dataset.provider = p.id;
          opt.dataset.providerLabel = p.label;
          opt.dataset.model = m.id;
          opt.dataset.icenLabel = m.label;
          /* hay：模型名 + provider 名（filterPopupOptions 的过滤口径） */
          opt.dataset.hay = `${m.label} ${p.label}`.toLowerCase();
          if (typeof m.context === 'number') opt.dataset.context = String(m.context);
          const selected = cfg.current.provider === p.id && cfg.current.model === m.id;
          opt.setAttribute('aria-selected', String(selected));
          const icon = document.createElement('span');
          icon.className = 'icen-ai-composer-popup-option-icon';
          icon.appendChild(providerMark(p, 'ai-composer-popup-option-provider-icon'));
          const label = document.createElement('span');
          label.className = 'icen-ai-composer-popup-option-label';
          label.textContent = m.label;
          const meta = document.createElement('span');
          meta.className = 'icen-ai-composer-popup-option-meta';
          meta.textContent = typeof m.context === 'number' ? formatTokens(m.context) : '';
          opt.append(icon, label, meta);
          group.appendChild(opt);
          s.options.push(opt);
        }
        list.appendChild(group);
        s.groups.push(group);
      }
      s.panel.appendChild(list);

      appendPopupEmpty(s, t('aiComposer.noModelMatch'));

      /* 底部提示：切换模型会使 prompt 缓存失效；cacheRead 占比高时升级 warning 色 */
      const foot = document.createElement('div');
      foot.className = 'icen-ai-composer-popup-foot';
      const usageCfg = USAGE.get(composer);
      if (usageCfg) {
        const u = usageCfg.usage;
        const used = (u.input ?? 0) + (u.output ?? 0) + (u.cacheRead ?? 0)
          + (u.cacheWrite ?? 0) + (u.reasoning ?? 0);
        if (used > 0 && (u.cacheRead ?? 0) / used >= CACHE_WARN_RATIO) {
          foot.classList.add('is-warn');
        }
      }
      const info = svgIcon(ICON_INFO);
      if (info) foot.appendChild(info);
      const footText = document.createElement('span');
      footText.textContent = t('aiComposer.cacheInvalidHint');
      foot.appendChild(footText);
      s.panel.appendChild(foot);

      /* 键盘接管：搜索框内 ↑↓/Enter/Tab/Esc */
      s.keydownHandler = (e) => popupKeydown(composer, s, e);
      input.addEventListener('keydown', s.keydownHandler);
      input.addEventListener('input', () => {
        filterPopupOptions(s, input.value);
      });
    },
  });

  btn?.setAttribute('aria-expanded', 'true');
  session.searchInput?.focus();
}

/* ── 命令弹层 ── */

function runComposerCommand(composer: HTMLElement, name: string): boolean {
  const command=COMMANDS.get(composer)?.find(c=>c.name===name&&!c.disabled);
  const ta=getTextarea(composer);
  if(!command||!ta||ta.disabled||ta.readOnly)return false;
  const args=/^\/\S*\s+([\s\S]*)$/.exec(ta.value)?.[1]??'';
  ta.value='';autosizeTa(ta);emit(composer,'icen:ai-command',{name:command.name,args});
  closePopup(composer);return true;
}

function openCommandPopup(composer: HTMLElement, token: string): void {
  const commands = COMMANDS.get(composer);
  if (!commands || commands.length === 0) return;
  const box = composer.querySelector('.icen-ai-composer-box') ?? composer;
  const ta = getTextarea(composer);

  const session = mountPopup(composer, {
    mode: 'command',
    anchor: box,
    sizing: popupSizingFor(box),
    returnFocus: ta,
    pick: (opt) => {
      runComposerCommand(composer,opt.dataset.name??'');
    },
    build: (s) => {
      const list = document.createElement('div');
      list.className = 'icen-ai-composer-popup-list';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', t('aiComposer.commands'));
      const group = document.createElement('div');
      group.className = 'icen-ai-composer-popup-group';
      for (const c of commands) {
        const opt = commandOption(c);
        group.appendChild(opt); s.options.push(opt);
      }
      list.appendChild(group);
      s.groups.push(group);
      s.panel.appendChild(list);

      appendPopupEmpty(s, t('aiComposer.noCommandMatch'));
      popupFoot(s, t('aiComposer.commandHint'));
    },
  });

  filterPopupOptions(session, token);
}

function commandToken(value: string): string {
  /* 过滤令牌：'/' 后首个空白前的部分（参数区不影响过滤） */
  return value.slice(1).split(/\s/, 1)[0] ?? '';
}

function updateCommandPopup(composer: HTMLElement, s: ComposerPopup): void {
  const ta = getTextarea(composer);
  const value = ta?.value ?? '';
  /* 触发条件失效（不再是 / 开头）→ 关闭。参数区（空白后）弹层保持打开，
     Enter 仍按「命令 + 已输入参数」拦截执行 */
  if (!value.startsWith('/')) {
    closePopup(composer, false);
    maybeOpenTriggerPopups(composer);
    return;
  }
  filterPopupOptions(s, commandToken(value));
}

/* ── 引用弹层 ── */

function openRefPopup(
  composer: HTMLElement,
  range: { start: number; end: number },
  filter: string,
): void {
  const sources = REF_SOURCES.get(composer);
  if (!sources || sources.length === 0) return;
  const box = composer.querySelector('.icen-ai-composer-box') ?? composer;
  const ta = getTextarea(composer);

  const session = mountPopup(composer, {
    mode: 'ref',
    anchor: box,
    sizing: popupSizingFor(box),
    returnFocus: ta,
    refRange: range,
    pick: (opt) => {
      const source = (REF_SOURCES.get(composer) ?? []).find((r) => r.id === opt.dataset.refId && r.kind === opt.dataset.refKind);
      const cur = POPUP.get(composer);
      const r = cur?.refRange ?? (ta ? findRefToken(ta) : null);
      if (source && ta && r) {
        const before = ta.value.slice(0, r.start + 1); /* 保留 '@' */
        const after = ta.value.slice(r.end);
        ta.value = before + source.label + ' ' + after;
        const caret = before.length + source.label.length + 1;
        ta.setSelectionRange(caret, caret);
        autosizeTa(ta);
        addActiveRef(composer, source);
      }
      closePopup(composer);
    },
    build: (s) => {
      const list = document.createElement('div');
      list.className = 'icen-ai-composer-popup-list';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', t('aiComposer.refs'));
      for (const kind of knownRefKinds(sources)) {
        const def = getRefKindDef(kind);
        const items = sources.filter((r) => r.kind === kind);
        if (items.length === 0) continue;
        const group = document.createElement('div');
        group.className = 'icen-ai-composer-popup-group';
        group.dataset.icenKind = kind;
        group.appendChild(Object.assign(document.createElement('div'), {
          className: 'icen-ai-composer-popup-group-label',
          textContent: def.label,
        }));
        for (const r of items) {
          const opt = resourceOption(r);
          opt.setAttribute('aria-selected', String((ACTIVE_REFS.get(composer) ?? []).some(a => a.id === r.id && a.kind === r.kind)));
          group.appendChild(opt);
          s.options.push(opt);
        }
        list.appendChild(group);
        s.groups.push(group);
      }
      s.panel.appendChild(list);

      appendPopupEmpty(s, t('aiComposer.noRefMatch'));
      popupFoot(s, t('aiComposer.refHint'));
    },
  });

  filterPopupOptions(session, filter);
}

function updateRefPopup(composer: HTMLElement, s: ComposerPopup): void {
  const ta = getTextarea(composer);
  const t = ta ? findRefToken(ta) : null;
  if (!t) {
    closePopup(composer, false);
    maybeOpenTriggerPopups(composer);
    return;
  }
  s.refRange = { start: t.start, end: t.end };
  filterPopupOptions(s, t.filter);
}

/* ── 触发探测：输入开头 '/' → 命令；任意位置 token 起点 '@' → 引用 ── */

function findRefToken(ta: HTMLTextAreaElement): { start: number; end: number; filter: string } | null {
  const value = ta.value;
  const end = ta.selectionStart ?? value.length;
  const at = value.lastIndexOf('@', end - 1);
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(value[at - 1] ?? '')) return null; /* 须为 token 起点 */
  const filter = value.slice(at + 1, end);
  if (/\s/.test(filter)) return null;
  return { start: at, end, filter };
}

function maybeOpenTriggerPopups(composer: HTMLElement): void {
  const ta = getTextarea(composer);
  if (!ta) return;
  const commands = COMMANDS.get(composer);
  if (commands && commands.length > 0 && ta.value.startsWith('/')) {
    openCommandPopup(composer, commandToken(ta.value));
    return;
  }
  const sources = REF_SOURCES.get(composer);
  if (sources && sources.length > 0) {
    const t = findRefToken(ta);
    if (t) openRefPopup(composer, { start: t.start, end: t.end }, t.filter);
  }
}

/* ══════════════ v2 引用 chips ══════════════ */

function ensureRefsRow(composer: HTMLElement): HTMLElement {
  const existing = composer.querySelector<HTMLElement>('.icen-ai-composer-refs');
  if (existing) return existing;
  const row = document.createElement('div');
  row.className = 'icen-ai-composer-refs';
  row.dataset.aiRefs = 'auto';
  row.hidden = true;
  /* §8 顺序：queue → refs → attach → box */
  const attach = composer.querySelector('.icen-ai-composer-attach');
  const box = composer.querySelector('.icen-ai-composer-box');
  composer.insertBefore(row, attach ?? box ?? null);
  return row;
}

function renderRefs(composer: HTMLElement): void {
  const row = composer.querySelector<HTMLElement>('.icen-ai-composer-refs');
  const actives = ACTIVE_REFS.get(composer) ?? [];
  if (!row) return;
  row.replaceChildren(
    ...actives.map((src) => {
      const chip = makeChip(src.label, true, t('aiComposer.removeRef', { p0: src.label }));
      chip.prepend(resourceIcon(src));
      chip.dataset.icenKind = src.kind;
      chip.dataset.refId = src.id;
      chip.dataset.refKind = src.kind;
      chip.title = [src.label,src.description??src.sub].filter(Boolean).join(' · ');
      return chip;
    }),
  );
  row.hidden = actives.length === 0;
}

function addActiveRef(composer: HTMLElement, source: AiComposerRefSource): void {
  const actives = ACTIVE_REFS.get(composer) ?? [];
  if (actives.some((r) => r.id === source.id && r.kind === source.kind)) return;
  actives.push(source);
  ACTIVE_REFS.set(composer, actives);
  renderRefs(composer);
  emit(composer, 'icen:ai-ref', { action: 'add', ref: source });
}

function removeActiveRef(composer: HTMLElement, source: AiComposerRefSource): void {
  const actives = ACTIVE_REFS.get(composer) ?? [];
  const idx = actives.findIndex((r) => r.id === source.id && r.kind === source.kind);
  if (idx === -1) return;
  actives.splice(idx, 1);
  ACTIVE_REFS.set(composer, actives);
  const activeButton = document.activeElement;
  const restore = activeButton instanceof Element && !!activeButton.closest('.icen-ai-composer-refs');
  renderRefs(composer);
  if (restore) {
    const buttons = composer.querySelectorAll<HTMLButtonElement>('.icen-ai-composer-refs .icen-ai-composer-chip-remove');
    (buttons[Math.min(idx,buttons.length-1)] ?? getTextarea(composer))?.focus({preventScroll:true});
  }
  /* 同步删文本里首个 `@label`（连同其后一个空白） */
  const ta = getTextarea(composer);
  if (ta && !actives.some(r=>r.label===source.label)) {
    const needle = `@${source.label}`;
    let at = ta.value.indexOf(needle);
    while(at!==-1 && ((at>0&&!/\s/.test(ta.value[at-1])) || (ta.value[at+needle.length]!==undefined&&!/\s/.test(ta.value[at+needle.length]))))at=ta.value.indexOf(needle,at+needle.length);
    if (at !== -1) {
      const start=ta.selectionStart,end=ta.selectionEnd,direction=ta.selectionDirection;
      let endIdx = at + needle.length;
      if (ta.value[endIdx] === ' ') endIdx += 1;
      ta.value = ta.value.slice(0, at) + ta.value.slice(endIdx);
      const shifted=(pos:number):number=>pos<=at?pos:pos<endIdx?at:pos-(endIdx-at);
      ta.setSelectionRange(shifted(start),shifted(end),direction);
      autosizeTa(ta);
    }
  }
  emit(composer, 'icen:ai-ref', { action: 'remove', ref: source });
}

function renderFiles(composer: HTMLElement): void {
  let row=composer.querySelector<HTMLElement>('.icen-ai-composer-attach');
  const files=FILES.get(composer)??[];
  if(!row&&files.length){row=document.createElement('div');row.className='icen-ai-composer-attach';composer.insertBefore(row,composer.querySelector('.icen-ai-composer-box'));}
  if(!row)return;
  row.replaceChildren(...files.map((file,index)=>{
    const chip=makeChip(file.name,true,t('aiComposer.removeAttachment',{p0:file.name}),'file');chip.dataset.icenFile=String(index);
    const size=document.createElement('span');size.className='icen-ai-composer-chip-meta';size.textContent=file.size<1024?`${file.size} B`:`${Math.ceil(file.size/1024)} KB`;chip.insertBefore(size,chip.lastElementChild);chip.title=file.name;return chip;
  }));row.hidden=!files.length;
}

/** Read-only snapshot for upload adapters and application-owned draft persistence. */
export function getComposerDraft(el: HTMLElement): AiComposerSubmission {
  if(!isBrowser())return {text:''};
  const c=resolveComposer(el);if(!c)return {text:''};
  const refs=ACTIVE_REFS.get(c)??[],files=FILES.get(c)??[];
  return {text:getTextarea(c)?.value??'',...(refs.length?{refs:refs.map(r=>({...r}))}:{}),...(files.length?{files:[...files]}:{})};
}

/* ══════════════ v2 历史（每 composer 独立）══════════════ */

function pushHistory(composer: HTMLElement, text: string): void {
  const h = HISTORIES.get(composer) ?? { items: [], index: -1 };
  if (h.items[h.items.length - 1] !== text) {
    h.items.push(text);
    if (h.items.length > HISTORY_LIMIT) h.items.shift();
  }
  h.index = -1;
  HISTORIES.set(composer, h);
}

/* ══════════════ 单个 composer 装配 ══════════════ */

function setupComposer(composer: HTMLElement): (() => void) | undefined {
  const el = composer as MarkedComposer;
  if (el.__icenAiComposerInit) return undefined;
  el.__icenAiComposerInit = true;

  const ta = getTextarea(composer);
  if (!ta) {
    el.__icenAiComposerInit = false;
    return undefined;
  }
  const queueEl = composer.querySelector<HTMLElement>('.icen-ai-composer-queue');
  const { sendBtn, sendIcon, stopIcon } = ensureIcons(composer);

  /* v2 默认 placeholder（作者已写 placeholder 则不覆盖） */
  if (!ta.hasAttribute('placeholder')) {
    ta.setAttribute('placeholder', t('aiComposer.placeholder'));
  }

  /* ── 队列 chips 渲染 ── */
  const renderQueue = (): void => renderQueueChips(composer);

  const enqueue = (draft: AiComposerSubmission): void => {
    const queue = QUEUES.get(composer) ?? [];
    queue.push({...draft,...(draft.refs?{refs:draft.refs.map(r=>({...r}))}:{}),...(draft.files?{files:[...draft.files]}:{})});
    QUEUES.set(composer, queue);
    renderQueue();
  };

  /* ── 发送 / 排队 / 停止 ── */
  const isRunning = (): boolean => RUNNING.get(composer) ?? false;

  const submit = (): void => {
    if (ta.disabled || ta.readOnly || composing) return;
    const draft = getComposerDraft(composer);
    if (!draft.text.trim() && !draft.files?.length && !draft.refs?.length) return;
    ta.value = '';
    autosizeTa(ta);
    ACTIVE_REFS.set(composer,[]); FILES.set(composer,[]);renderRefs(composer);renderFiles(composer);
    if (isRunning()) {
      enqueue(draft);
      emit(composer, 'icen:ai-queue', draft);
    } else {
      pushHistory(composer, draft.text);
      emit(composer, 'icen:ai-send', draft);
    }
  };
  SUBMITS.set(composer, submit);

  /* 运行中 ↑：把最后一条排队消息取回输入框重新编辑（Claude Code 模式）。
     队列是事件源（icen:ai-queue / icen:ai-dequeue 双向同步），取回即移除，按契约派 dequeue。 */
  const takeBackLastQueued = (): void => {
    const queue = QUEUES.get(composer) ?? [];
    if (queue.length === 0) return;
    const index = queue.length - 1;
    const draft = queue.pop()!;
    QUEUES.set(composer, queue);
    renderQueue();
    ta.value = draft.text;
    // Keep context added for the next draft while restoring this queued submission.
    for(const ref of draft.refs??[])addActiveRef(composer,ref);
    const files=FILES.get(composer)??[];FILES.set(composer,Array.from(new Set([...files,...(draft.files??[])])));renderFiles(composer);
    autosizeTa(ta);
    emit(composer, 'icen:ai-dequeue', { index });
  };

  const browseHistory = (delta: -1 | 1): void => {
    const h = HISTORIES.get(composer);
    if (!h || h.items.length === 0) return;
    if (delta === -1) {
      h.index = h.index === -1 ? h.items.length - 1 : Math.max(0, h.index - 1);
    } else {
      h.index += 1;
      if (h.index >= h.items.length) {
        h.index = -1;
        ta.value = '';
        autosizeTa(ta);
        return;
      }
    }
    ta.value = h.items[h.index] ?? '';
    autosizeTa(ta);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (composing || e.isComposing || ta.disabled || ta.readOnly) return;
    const session = POPUP.get(composer);
    if (session) {
      popupKeydown(composer, session, e);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if(ta.value.startsWith('/') && runComposerCommand(composer,commandToken(ta.value)))return;
      submit();
      return;
    }
    if (e.key === 'ArrowUp') {
      const h = HISTORIES.get(composer);
      const browsing = (h?.index ?? -1) >= 0;
      if (ta.value === '') {
        if ((QUEUES.get(composer) ?? []).length > 0) {
          e.preventDefault();
          takeBackLastQueued();
          return;
        }
        if (h && h.items.length > 0) {
          e.preventDefault();
          browseHistory(-1);
        }
      } else if (browsing) {
        e.preventDefault();
        browseHistory(-1);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      const h = HISTORIES.get(composer);
      if (h && h.index >= 0) {
        e.preventDefault();
        browseHistory(1);
      }
    }
  };

  const onInput = (): void => {
    autosizeTa(ta);
    if (composing) return;
    /* 浏览历史中编辑 → 退出浏览态 */
    const h = HISTORIES.get(composer);
    if (h && h.index >= 0 && ta.value !== h.items[h.index]) h.index = -1;
    const session = POPUP.get(composer);
    if (session) {
      if (session.mode === 'command') updateCommandPopup(composer, session);
      else if (session.mode === 'ref') updateRefPopup(composer, session);
    } else {
      maybeOpenTriggerPopups(composer);
    }
  };

  /* IME 组合态：compositionstart…end 期间挂发送（中文/日文输入法不打断组合字符） */
  let composing = false;
  const onCompositionStart = (): void => {
    composing = true;
    closePopup(composer,false);
  };
  const onCompositionEnd = (): void => {
    composing = false;
    onInput();
  };

  const onSendClick = (): void => {
    if (isRunning()) {
      emit(composer, 'icen:ai-stop', {});
    } else {
      submit();
    }
  };

  /* chip × 移除（queue 派 icen:ai-dequeue {index}；refs 派 icen:ai-ref remove；附件移除同步真实文件状态） */
  const onQueueClick = (e: MouseEvent): void => {
    const btn = e.target instanceof Element ? e.target.closest('.icen-ai-composer-chip-remove') : null;
    if (!btn) return;
    const index = Array.from(queueEl?.querySelectorAll('.icen-ai-composer-chip-remove') ?? []).indexOf(btn);
    const queue = QUEUES.get(composer) ?? [];
    if (index >= 0 && index < queue.length) {
      queue.splice(index, 1);
      QUEUES.set(composer, queue);
      renderQueue();
      const buttons=queueEl?.querySelectorAll<HTMLButtonElement>('.icen-ai-composer-chip-remove');
      (buttons?.[Math.min(index,buttons.length-1)]??ta).focus({preventScroll:true});
      emit(composer, 'icen:ai-dequeue', { index });
    }
  };

  /* refs chip ×（委托在 composer 上：refs 行可能是 setComposerRefs 晚于 init 才创建） */
  const onRefsClick = (e: MouseEvent): void => {
    const btn = e.target instanceof Element ? e.target.closest('.icen-ai-composer-chip-remove') : null;
    if (!btn || !btn.closest('.icen-ai-composer-refs')) return;
    const id = btn.closest<HTMLElement>('.icen-ai-composer-chip')?.dataset.refId;
    const kind=btn.closest<HTMLElement>('.icen-ai-composer-chip')?.dataset.refKind;
    const source = (ACTIVE_REFS.get(composer) ?? []).find((r) => r.id === id && r.kind === kind);
    if (source) removeActiveRef(composer, source);
  };

  /* ── 附件（钮选 / 粘贴 / 拖放三入口共用）── */
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.hidden = true;
  fileInput.multiple = true;
  composer.appendChild(fileInput);

  const onAttachClick = (): void => {
    if(!ta.disabled&&!ta.readOnly)fileInput.click();
  };

  const addFiles = (files: File[]): void => {
    if (!files.length || ta.disabled || ta.readOnly) return;
    const current=FILES.get(composer)??[];
    const accepted:File[]=[];
    for(const file of files) {
      if(![...current,...accepted].some(c=>c.name===file.name&&c.size===file.size&&c.lastModified===file.lastModified&&c.type===file.type))accepted.push(file);
    }
    if(!accepted.length)return;
    FILES.set(composer,[...current,...accepted]);renderFiles(composer);
    emit(composer, 'icen:ai-attach', { files:accepted });
  };
  const onRemoveFile = (e: MouseEvent): void => {
    const button=e.target instanceof Element?e.target.closest('.icen-ai-composer-attach .icen-ai-composer-chip-remove'):null;if(!button)return;
    const index=Number(button.closest<HTMLElement>('[data-icen-file]')?.dataset.icenFile);const files=FILES.get(composer)??[];
    if(!Number.isInteger(index)||index<0||index>=files.length)return;
    const [file]=files.splice(index,1);FILES.set(composer,files);renderFiles(composer);
    const buttons=composer.querySelectorAll<HTMLButtonElement>('.icen-ai-composer-attach .icen-ai-composer-chip-remove');(buttons[Math.min(index,buttons.length-1)]??ta).focus({preventScroll:true});
    emit(composer,'icen:ai-attachment-remove',{file,files:[...files]});
  };

  const onFileChange = (): void => {
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = '';
    addFiles(files);
  };

  /* 粘贴文件 → 附件（截图/拖进编辑器的图片直接落 chips；有文本时不拦截） */
  const onPaste = (e: ClipboardEvent): void => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  };

  /* 拖放文件 → 附件（box 高亮随 dragover/dragleave） */
  const boxEl = composer.querySelector<HTMLElement>('.icen-ai-composer-box');
  const onDragOver = (e: DragEvent): void => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    boxEl?.classList.add('is-dragover');
  };
  const onDragLeave = (): void => {
    boxEl?.classList.remove('is-dragover');
  };
  const onDrop = (e: DragEvent): void => {
    boxEl?.classList.remove('is-dragover');
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  };

  /* ── 监听装配 ── */
  ta.addEventListener('keydown', onKeydown);
  ta.addEventListener('input', onInput);
  ta.addEventListener('compositionstart', onCompositionStart);
  ta.addEventListener('compositionend', onCompositionEnd);
  ta.addEventListener('paste', onPaste);
  boxEl?.addEventListener('dragover', onDragOver);
  boxEl?.addEventListener('dragleave', onDragLeave);
  boxEl?.addEventListener('drop', onDrop);
  sendBtn?.addEventListener('click', onSendClick);
  queueEl?.addEventListener('click', onQueueClick);
  composer.addEventListener('click', onRefsClick);
  composer.addEventListener('click', onRemoveFile);
  composer.querySelector('[data-icen-ai-attach]')?.addEventListener('click', onAttachClick);
  fileInput.addEventListener('change', onFileChange);

  /* 同步既有运行态（setComposerRunning 先于 init 调用时） */
  const initialRunning = RUNNING.get(composer) ?? composer.classList.contains('is-running');
  if (initialRunning) setComposerRunning(composer, true);
  else {
    if (sendIcon) sendIcon.hidden = false;
    if (stopIcon) stopIcon.hidden = true;
  }
  autosizeTa(ta);
  renderQueue();
  renderRefs(composer);
  renderFiles(composer);

  return () => {
    closePopup(composer, false);
    ta.removeEventListener('keydown', onKeydown);
    ta.removeEventListener('input', onInput);
    ta.removeEventListener('compositionstart', onCompositionStart);
    ta.removeEventListener('compositionend', onCompositionEnd);
    ta.removeEventListener('paste', onPaste);
    boxEl?.removeEventListener('dragover', onDragOver);
    boxEl?.removeEventListener('dragleave', onDragLeave);
    boxEl?.removeEventListener('drop', onDrop);
    sendBtn?.removeEventListener('click', onSendClick);
    queueEl?.removeEventListener('click', onQueueClick);
    composer.removeEventListener('click', onRefsClick);
    composer.removeEventListener('click', onRemoveFile);
    composer.querySelector('[data-icen-ai-attach]')?.removeEventListener('click', onAttachClick);
    fileInput.removeEventListener('change', onFileChange);
    fileInput.remove();
    el.__icenAiComposerInit = false;
  };
}

/**
 * 初始化 root 下的全部 [data-icen-ai-composer]（root 自身匹配时包含自身）。
 * 幂等；返回销毁函数（复刻 initBackTop 约定）。
 */
export function initAiComposer(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (isBrowser()) {
    const scope = root ?? document;
    const candidates: HTMLElement[] = [];
    if (scope instanceof Element && scope.matches('[data-icen-ai-composer]')) {
      candidates.push(scope as HTMLElement);
    }
    candidates.push(...Array.from(scope.querySelectorAll<HTMLElement>('[data-icen-ai-composer]')));
    for (const composer of candidates) {
      const cleanup = setupComposer(composer);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}

/* ══════════════ v2 配置 API（全部可选；el 传 composer 或其内部任意元素）══════════════ */

/**
 * 配置模型切换（§8）：工具条出现模型钮，弹层按 provider 分组 + 搜索过滤 + 当前轻高亮。
 * current 缺省取第一个 provider 的第一个模型（静默选中，不派事件）。
 * 选择派 icen:ai-model-change {provider, model, label, context}；
 * 选中模型的 context 自动成为 setComposerUsage 的 total 默认值（显式 opts.total 优先）。
 * providers 传空数组 = 清除配置（移除 JS 自动创建的模型钮）。
 */
export function setComposerModels(
  el: HTMLElement,
  providers: AiProviderOption[],
  current?: AiComposerCurrentModel,
): void {
  if (!isBrowser()) return;
  const composer = resolveComposer(el);
  if (!composer) return;
  const list = (Array.isArray(providers) ? providers : []).filter(
    (p) => p && Array.isArray(p.models) && p.models.length > 0,
  );
  if (list.length === 0) {
    MODELS.delete(composer);
    MODEL_CTX.delete(composer);
    const btn = composer.querySelector<HTMLElement>('[data-icen-ai-model-open]');
    if (btn?.dataset.icenAiModelOpen === 'auto') btn.remove();
    syncToolbar(composer);
    refreshUsageRing(composer);
    return;
  }
  const cur: AiComposerCurrentModel = current ?? { provider: list[0].id, model: list[0].models[0].id };
  MODELS.set(composer, { providers: list, current: cur });
  const provider = list.find((p) => p.id === cur.provider) ?? list[0];
  const model = provider.models.find((m) => m.id === cur.model) ?? provider.models[0];
  if (typeof model.context === 'number' && model.context > 0) {
    MODEL_CTX.set(composer, model.context);
  } else {
    MODEL_CTX.delete(composer); /* 无 context 显式清除（bindComposer 与取回场景共用） */
  }
  syncToolbar(composer);
  updateModelButton(composer);
  refreshUsageRing(composer);
}

/**
 * 配置斜杠命令（§8）：输入开头 `/` 触发命令弹层（随输入过滤，↑↓/Enter/Tab/Esc）。
 * 选中派 icen:ai-command {name, args} 并清空输入（命令被拦截执行、不进消息流）。
 * commands 传空数组 = 清除配置。
 */
export function setComposerCommands(el: HTMLElement, commands: AiComposerCommand[]): void {
  if (!isBrowser()) return;
  const composer = resolveComposer(el);
  if (!composer) return;
  const list = (Array.isArray(commands) ? commands : []).filter((c) => c && typeof c.name === 'string' && c.name);
  if (list.length === 0) {
    COMMANDS.delete(composer);
    const session = POPUP.get(composer);
    if (session?.mode === 'command' || session?.mode === 'library') closePopup(composer);
    syncToolbar(composer);
    return;
  }
  COMMANDS.set(composer, list);
  syncToolbar(composer);
  if (POPUP.get(composer)) closePopup(composer);
}

/**
 * 配置 @ 引用源（§8）：任意位置 token 起点 `@` 触发引用弹层（按 kind 分组：内置
 * file/folder/doc/agent，可经 registerRefKind 扩展/覆盖；未知 kind 不丢弃——通用文档
 * 图标 + kind 原文兜底，排序缺省排最后）。
 * 选中后文本插入 `@label ` + refs chip +1，派 icen:ai-ref {action:'add', ref}；
 * chip × 移除 chip 并删文本里首个 `@label`，派 {action:'remove', ref}。
 */
export function setComposerRefs(el: HTMLElement, sources: AiComposerRefSource[]): void {
  if (!isBrowser()) return;
  const composer = resolveComposer(el);
  if (!composer) return;
  const list = (Array.isArray(sources) ? sources : []).filter((s) => s && typeof s.label === 'string' && s.label);
  REF_SOURCES.set(composer, list);
  syncToolbar(composer);
  if (POPUP.get(composer)) closePopup(composer);
  if (list.length === 0) {
    const session = POPUP.get(composer);
    if (session?.mode === 'ref') closePopup(composer);
  }
  ensureRefsRow(composer);
  renderRefs(composer);
}

/**
 * 配置用量环（§8）：工具条右侧挂 renderAiUsageRing（点击环弹出完整分段分解）。
 * total 缺省时用选中模型的 context（setComposerModels 闭环）；显式 opts.total 优先。
 * usage 传 null = 清除配置（移除 JS 自动创建的挂载点）。
 */
export function setComposerUsage(
  el: HTMLElement,
  usage: AiUsage | null,
  opts: AiUsageRingOpts = {},
): void {
  if (!isBrowser()) return;
  const composer = resolveComposer(el);
  if (!composer) return;
  if (!usage) {
    USAGE.delete(composer);
    const mount = composer.querySelector<HTMLElement>('.icen-ai-composer-usage');
    if (mount?.dataset.icenAiUsage === 'auto') mount.remove();
    syncToolbar(composer);
    return;
  }
  USAGE.set(composer, { usage, opts });
  syncToolbar(composer);
  refreshUsageRing(composer);
}

/**
 * 输入框旁的实时待办（业界模式：plan/todo 是工具调用，实时状态挂在输入区而非对话流）：
 * chip = 图标 + x/y，状态色随进度（进行中 accent / 全部完成 success / 有失败 warning）；
 * 点击弹出完整清单（popover + renderAiTodo，只读）。传 null 清除。
 */
export function setComposerTodo(el: HTMLElement, items: AiTodoItem[] | null): void {
  if (!isBrowser()) return;
  const composer = resolveComposer(el);
  if (!composer) return;
  let chip = composer.querySelector<HTMLButtonElement>('.icen-ai-composer-todo');
  if (!items || items.length === 0) {
    TODO_STATES.delete(composer);
    chip?.remove();
    return;
  }
  TODO_STATES.set(composer, items);
  if (!chip) {
    /* 局部 const 持有按钮：闭包内 let 的窄化会被 TS 还原成可空（原代码的 as 即为此） */
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icen-ai-composer-todo';
    btn.setAttribute('aria-haspopup', 'true');
    btn.addEventListener('click', () => {
      const cur = TODO_STATES.get(composer);
      if (!cur) return;
      const p = document.createElement('div');
      p.className = 'icen-popover icen-ai-composer-todo-pop';
      p.hidden = true;
      const title = document.createElement('div');
      title.className = 'icen-ai-usage-popover-title';
      title.textContent = t('aiComposer.currentTodos');
      const body = document.createElement('div');
      body.className = 'ai-usage-popover-body';
      renderAiTodo(body, cur);
      p.append(title, body);
      openPopover(p, {
        anchor: btn,
        side: 'top',
        align: 'end',
        onClose: () => p.remove(),
      });
    });
    chip = btn;
    const icon = svgIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>',
    );
    if (icon) chip.appendChild(icon);
    chip.appendChild(document.createElement('span')).className = 'ai-composer-todo-label';
    const toolbar = composer.querySelector<HTMLElement>('.icen-ai-composer-toolbar');
    const usage = composer.querySelector<HTMLElement>('.icen-ai-composer-usage');
    if (toolbar) toolbar.insertBefore(chip, usage ?? null);
    else {
      const box = composer.querySelector<HTMLElement>('.icen-ai-composer-box');
      box?.before(chip);
    }
  }
  const done = items.filter((t) => t.status === 'done').length;
  const failed = items.some((t) => t.status === 'error' || t.status === 'cancelled');
  chip.classList.toggle('is-done', done === items.length && !failed);
  chip.classList.toggle('is-error', failed);
  chip.setAttribute('aria-label', t('aiComposer.todoChip', { p0: done, p1: items.length, p2: failed ? t('aiComposer.todoHasError') : '' }));
  const label = chip.querySelector<HTMLElement>('.ai-composer-todo-label');
  if (label) label.textContent = `${done}/${items.length}`;
}

/* ══════════════ 绑定层 bindComposer（spec §11，「零接线全链路」的胶水） ══════════════ */

export interface AiComposerBindOpts {
  /**
   * 传入即托管对话（client 模式）：icen:ai-send → renderAiMessage 用户消息 + running +
   * client.stream → assistant 消息 + createAiStream 逐 chunk 追加 → done 收尾（meta 自动填
   * token/成本）；错误 → setError + fail；stop → session.cancel()；成功后续发队列，停止/失败暂停。
   * 需要 messages 容器。history 由绑定层维护（system 消息可先经 client 直接对话时自带）。
   */
  client?: AiClient;
  /** 消息挂载容器（.icen-ai-chat-scroll 或任意元素；client 模式必填） */
  messages?: HTMLElement;
  /** Resolve uploaded files / authorised resources into provider-neutral content parts.
   * Called for the captured submission, with cancellation. No upload or tool execution is guessed.
   * Files without an adapter produce a retryable error, rather than being silently dropped. */
  prepareMessage?: (draft: AiComposerSubmission, context: {signal: AbortSignal}) => AiContent | Promise<AiContent>;
  /** Pure-event bindings may scope done events to one conversation; defaults to document for compatibility. */
  eventTarget?: EventTarget;
  /**
   * 用量环自动更新（监听 document 的 icen:ai-done）：
   * 'context'（默认）= 上下文估算口径（ai-core contextEstimate——环语义正确）；
   * 'billing' = 请求用量累加（计费视角）；传 AiAuditor 实例 = auditor.summary()。
   * total 缺省沿用 setComposerModels 的模型 context 闭环。
   */
  usage?: { from: 'context' | 'billing' | AiAuditor; total?: number };
  /** 运行态自动管理（默认 true）：icen:ai-send → running；icen:ai-done → 解除 */
  running?: boolean;
  /**
   * 四弹层（模型/命令/引用/目录）尺寸的整体程序覆盖（PanelSizing 契约）：
   * 优先于 composer 根上的 data-panel-*（四弹层共用的用户覆盖面）与各弹层内置默认，
   * 一次设置对四个弹层同时生效。
   */
  popoverSizing?: PanelSizing;
}

export interface AiComposerBinding {
  /** Retry the latest failed/stopped managed response in place. False when busy or unavailable. */
  retry(): boolean;
  /** 解绑全部监听并中止进行中的托管会话（composer 本身的 init 不受影响） */
  unbind(): void;
}

const BOUND = new WeakSet<HTMLElement>();

/**
 * composer ↔ 消息区 ↔ client ↔ 用量环的闭环绑定（事件驱动，传输会话所有权仍归消费方）。
 * 不传 client 时为纯状态绑定（send→running、done→解除、环更新），渐进采用。
 * 注意：running 自动管理依赖 client 派发的 icen:ai-done；无 client 的纯事件用法需
 * 自行派发该事件或传 running:false。
 */
export function bindComposer(el: HTMLElement, opts: AiComposerBindOpts = {}): AiComposerBinding {
  const noop = (): void => undefined;
  if (!isBrowser()) return { unbind: noop, retry: () => false };
  const composer = resolveComposer(el);
  if (!composer) return { unbind: noop, retry: () => false };
  if (BOUND.has(composer)) return { unbind: noop, retry: () => false }; /* 防重复绑定 */
  BOUND.add(composer);

  /* 四弹层尺寸整体覆盖（> composer 根 data-panel-* > 内置默认；跨 bind/unbind 保留的配置） */
  if (opts.popoverSizing) POPUP_SIZING.set(composer, opts.popoverSizing);

  const disposers: Array<() => void> = [];
  const usageCfg = opts.usage;
  const manageRunning = opts.running ?? true;
  let bound = true;
  let retry = (): boolean => false;
  let updateUsage = (_detail: {usage?: AiUsage;cost?: number}): void => {};

  /* ── 用量环自动更新（icen:ai-done 驱动）── */
  if (usageCfg) {
    let cost = 0;
    let billing: AiUsage = {};
    updateUsage = (detail): void => {
      if (!detail?.usage) return;
      if (typeof detail.cost === 'number') cost += detail.cost;
      let usage: AiUsage;
      if (usageCfg.from === 'context') {
        /* 环的正确口径：下一轮上下文估算（segments 保留作弹层分解，total 为估算值） */
        const u = detail.usage;
        usage = {
          input: u.input,
          cacheRead: u.cacheRead,
          cacheWrite: u.cacheWrite,
          output: u.output,
          reasoning: u.reasoning,
          total: contextEstimate(u),
        };
      } else if (usageCfg.from === 'billing') {
        billing = addUsage(billing, detail.usage); /* 六键求和走 ai-core 共享实现 */
        usage = billing;
      } else {
        usage = usageCfg.from.summary();
      }
      setComposerUsage(composer, usage, {
        total: usageCfg.total,
        cost: cost > 0 ? Math.round(cost * 1e6) / 1e6 : undefined,
      });
    };
    if (!opts.client || !opts.messages) {
      const onDone=(e:Event):void=>updateUsage((e as CustomEvent<AiDoneEventDetail>).detail);
      const target=opts.eventTarget??document;
      target.addEventListener('icen:ai-done', onDone);
      disposers.push(() => target.removeEventListener('icen:ai-done', onDone));
    }
  }

  /* ── client 模式：对话全托管 ── */
  /* 给了 client 漏 messages：无法渲染消息流，降级为纯状态绑定（不静默吞掉配置错误） */
  if (opts.client && !opts.messages) {
    console.warn('[ai-composer] client 模式需要 opts.messages，已降级为纯状态绑定');
  }
  if (opts.client && opts.messages) {
    const client = opts.client;
    const messages = opts.messages;
    const history: AiChatMessage[] = [];
    interface Turn {
      assistant: AiMessageHandle;
      stream: AiStreamHandle;
      textNode: Element | null;
      request: AiChatMessage[];
      session: AiStreamSession | null;
      text: string;
      draft?: AiComposerSubmission;
      preparation: AbortController;
    }
    let active: Turn | null = null;
    let retryable: Turn | null = null;

    const metaOf = (r: { usage: AiUsage; cost?: number }): string => {
      const tok = r.usage.total ?? 0;
      const parts = [tok > 0 ? `${formatTokens(tok)} tok` : t('aiComposer.done')];
      if (typeof r.cost === 'number') parts.push(`$${r.cost.toFixed(4)}`);
      return t('aiComposer.justNow', { p0: parts.join(' · ') });
    };

    const startTurn = (previous?: Turn, draft?: AiComposerSubmission): void => {
      const assistant = previous?.assistant ?? renderAiMessage(messages, {
        role: 'assistant',
        content: '',
        streaming: true,
        model: client.config.model,
      });
      if (previous) {
        const restoreRetryFocus = assistant.body.contains(document.activeElement);
        previous.textNode?.remove();
        assistant.body.querySelectorAll('.icen-ai-msg-continue,.icen-ai-msg-error-text').forEach(node => node.remove());
        assistant.el.classList.remove('icen-ai-msg--error');
        assistant.setMeta('');
        if (restoreRetryFocus) assistant.el.querySelector<HTMLElement>('[data-icen-ai-msg-action="retry"]')?.focus({preventScroll:true});
      }
      const streamH: AiStreamHandle = assistant.stream();
      assistant.el.classList.add('is-streaming');
      const turn: Turn = {assistant,stream:streamH,textNode:assistant.body.lastElementChild,request:[...history],session:null,text:'',draft:previous?.draft??draft,preparation:new AbortController()};
      active = turn;
      retryable = null;
      setComposerRunning(composer, true);
      let failed = false;
      void (async () => {
        try {
          if (turn.draft && opts.prepareMessage) {
            const content=await opts.prepareMessage(turn.draft,{signal:turn.preparation.signal});
            if(!bound||active!==turn)return;
            turn.request[turn.request.length-1]={role:'user',content};
            history.splice(0,history.length,...turn.request);
          } else if(turn.draft?.files?.length) throw new Error(t('aiComposer.filesNeedAdapter'));
          const s = client.stream({ messages: turn.request });
          turn.session = s;
          // Handle rejected custom clients even if their iterator fails first.
          void s.done.catch(() => {});
          for await (const chunk of s) {
            if (!bound || active !== turn) return;
            if (chunk.type === 'text') { turn.text += chunk.delta; streamH.append(chunk.delta); }
            else if (chunk.type === 'error') {
              failed = true;
              streamH.fail();
              assistant.setError(chunk.message);
            }
          }
          const result = await s.done;
          if (!bound || active !== turn) return;
          if (!failed) { streamH.done(); assistant.setMeta(metaOf(result)); updateUsage(result); }
          if (result.text) history.push({ role: 'assistant', content: result.text });
        } catch (error) {
          if (!bound || active !== turn) return;
          failed = true;
          streamH.fail();
          assistant.setError(error instanceof Error ? error.message : String(error));
        } finally {
          if (!bound || active !== turn) return;
          active = null;
          assistant.el.classList.remove('is-streaming');
          setComposerRunning(composer, false);
          if (failed) { retryable = turn; return; }
          /* Queue advances only after a successful response. Stop/error leave it editable. */
          const queue = QUEUES.get(composer) ?? [];
          if (queue.length > 0) {
            const next = queue.shift()!;
            QUEUES.set(composer, queue);
            renderQueueChips(composer);
            emit(composer, 'icen:ai-dequeue', { index: 0 });
            if (bound) send(next);
          }
        }
      })();
    };

    const send = (draft: AiComposerSubmission): void => {
      if (!bound || active) return;
      const missingRefs=(draft.refs??[]).filter(r=>!draft.text.includes(`@${r.label}`));
      const text=[draft.text,...missingRefs.map(r=>`@${r.label}`)].filter(Boolean).join('\n');
      const message=renderAiMessage(messages, { role: 'user', content: draft.text });
      if(draft.refs?.length||draft.files?.length){
        const context=document.createElement('div');context.className='icen-ai-msg-context';
        for(const ref of draft.refs??[]){const chip=makeChip(ref.label,false,'');chip.prepend(resourceIcon(ref));context.append(chip);}
        for(const file of draft.files??[])context.append(makeChip(file.name,false,'','file'));
        message.body.append(context);
      }
      history.push({ role: 'user', content: text });
      startTurn(undefined,draft);
    };

    const onSend = (e: Event): void => {
      const draft = (e as CustomEvent<AiComposerSubmission>).detail;
      if (typeof draft?.text === 'string' && (draft.text || draft.files?.length || draft.refs?.length)) send(draft);
    };
    const onStop = (): void => {
      const turn = active;
      if (!turn) return;
      active = null; // Invalidate before abort: late chunks cannot change this or a newer turn.
      turn.preparation.abort();
      retryable = turn;
      turn.stream.cancel();
      turn.assistant.el.classList.remove('is-streaming');
      turn.assistant.setMeta(t('aiComposer.stopped'));
      if (turn.text) history.push({role:'assistant',content:turn.text});
      setComposerRunning(composer, false);
      turn.session?.cancel();
    };
    retry = (): boolean => {
      if (!bound || active || !retryable) return false;
      const turn = retryable;
      history.splice(0, history.length, ...turn.request);
      startTurn(turn);
      return true;
    };
    const onRetry = (event: Event): void => {
      if ((event as CustomEvent<{el: HTMLElement}>).detail?.el === retryable?.assistant.el) retry();
    };
    composer.addEventListener('icen:ai-send', onSend);
    composer.addEventListener('icen:ai-stop', onStop);
    messages.addEventListener('icen:ai-retry', onRetry);
    disposers.push(() => {
      composer.removeEventListener('icen:ai-send', onSend);
      composer.removeEventListener('icen:ai-stop', onStop);
      messages.removeEventListener('icen:ai-retry', onRetry);
      onStop();
      retryable = null;
    });
  } else if (manageRunning) {
    /* ── 纯状态绑定：send → running；done → 解除 ── */
    const onSend = (): void => setComposerRunning(composer, true);
    const onDone = (): void => setComposerRunning(composer, false);
    composer.addEventListener('icen:ai-send', onSend);
    const target=opts.eventTarget??document;
    target.addEventListener('icen:ai-done', onDone);
    disposers.push(() => {
      composer.removeEventListener('icen:ai-send', onSend);
      target.removeEventListener('icen:ai-done', onDone);
    });
  }

  return {
    retry: () => retry(),
    unbind(): void {
      if (!bound) return;
      bound = false;
      for (const dispose of disposers) dispose();
      disposers.length = 0;
      BOUND.delete(composer);
    },
  };
}
