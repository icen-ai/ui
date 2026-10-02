/*
 * @icen.ai/ui — Behavior: ai-composer（AI 输入台 v2，与 components/ai-chat.css 配套）
 *
 * DOM 契约（v2，规格 §8；v1 旧结构无 toolbar 时照常工作，见「向后兼容」）：
 *   <div class="ai-composer" data-ai-composer [.is-running]>
 *     <div class="ai-composer-queue" hidden><!-- 排队消息 chips（v1 已有） --></div>
 *     <div class="ai-composer-refs" hidden><!-- @ 引用 chips（setComposerRefs） --></div>
 *     <div class="ai-composer-attach" hidden><!-- 附件 chips（v1 已有） --></div>
 *     <div class="ai-composer-box control">
 *       <textarea class="ai-composer-input" rows="1" placeholder="…"></textarea>
 *       <div class="ai-composer-actions"><!-- v1 旧结构：附件 + 发送 --></div>
 *       <div class="ai-composer-toolbar"><!-- v2 工具条：models/usage 配置时出现 -->
 *         <button class="ai-composer-model" data-ai-model-open>provider 图标 + 模型名 + chevron</button>
 *         <span class="ai-composer-spacer"></span>
 *         <span class="ai-composer-usage" data-ai-usage></span>   <!-- 用量环挂载点 -->
 *         <button class="ai-composer-btn" data-ai-attach></button>
 *         <button class="ai-composer-send" data-ai-send></button>  ← 运行态变 .is-stop 停止钮
 *       </div>
 *     </div>
 *   </div>
 *   弹层 .ai-composer-popup（portal body，JS 动态创建/移除，listbox 语义）：
 *     模型切换 / 斜杠命令 / @ 引用三模式共用基座，含搜索框、分组、空态、底部提示。
 *     尺寸走 PanelSizing 契约：composer 根 data-panel-* 为用户覆盖（三弹层共用），
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
 *                                搜索过滤 + 当前勾选；选择派 icen:ai-model-change
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
 *   bindComposer(el, opts?) → { unbind() }：事件驱动把 composer ↔ 消息区 ↔ client ↔
 *         用量环接成闭环。opts.client + opts.messages = 对话全托管（send → renderAiMessage
 *         用户消息 + client.stream → assistant 流式渲染 → done 收尾；错误 → setError+fail；
 *         stop → cancel；排队消息自动续发）；opts.usage.from = 'context'（默认，环语义
 *         正确的上下文估算）| 'billing'（计费累加）| AiAuditor（summary()）；running 自动
 *         管理（send→running / icen:ai-done→解除）。不传 client 为纯状态绑定（渐进采用）。
 *         opts.popoverSizing（PanelSizing）整体覆盖三弹层尺寸（> composer 根 data-panel-*）。
 *
 * 向后兼容：未配置 models/usage 时工具条不出现，v1 markup（.ai-composer-actions 旧结构）
 *   零改动可用；配置后 v1 的 attach/send 按钮被移入工具条（事件监听不受影响）。
 * 按钮图标：data-ai-send / data-ai-attach 为空时注入库内默认 SVG（经 ai-core svgIcon() 消毒）。
 * SSR 下为 no-op；文本一律 textContent，禁 innerHTML。
 */

import { formatTokens, contextEstimate, svgIcon, type AiUsage } from './ai-core';
import { closePopover, openPopover, resolvePanelSizing, type PanelSizing } from './popover';
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
  description?: string;
  /** 参数提示（如 "<path>"），弹层命令行右侧灰色展示 */
  argsHint?: string;
}

export type AiComposerRefKind = 'file' | 'folder' | 'doc' | 'agent';

export interface AiComposerRefSource {
  kind: AiComposerRefKind;
  id: string;
  label: string;
  sub?: string;
}

/* ══════════════ 组件局部常量 ══════════════ */

const MAX_ROWS_DEFAULT = 8;
const HISTORY_LIMIT = 50;
/** 缓存读占比 ≥ 40% 时，模型弹层底部提示升级为 warning 色（Kimi Code 细节） */
const CACHE_WARN_RATIO = 0.4;

const SEND_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>';
const STOP_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
const ATTACH_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

const svgWrap = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICON_CHEVRON = svgWrap('<path d="m6 9 6 6 6-6"/>');
const ICON_CHECK = svgWrap('<path d="M20 6 9 17l-5-5"/>');
const ICON_INFO = svgWrap('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>');
const ICON_FILE = svgWrap(
  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
);
const ICON_FOLDER = svgWrap(
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
);
const ICON_DOC = svgWrap(
  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
);
const ICON_BOT = svgWrap(
  '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
);

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
  file: { label: '文件', icon: ICON_FILE, order: 0 },
  folder: { label: '文件夹', icon: ICON_FOLDER, order: 1 },
  doc: { label: '文档', icon: ICON_DOC, order: 2 },
  agent: { label: '代理', icon: ICON_BOT, order: 3 },
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
const QUEUES = new WeakMap<HTMLElement, string[]>();
const MODELS = new WeakMap<HTMLElement, { providers: AiProviderOption[]; current: AiComposerCurrentModel }>();
/** 选中模型的 context——usage ring total 的默认值 */
const MODEL_CTX = new WeakMap<HTMLElement, number>();
const COMMANDS = new WeakMap<HTMLElement, AiComposerCommand[]>();
const REF_SOURCES = new WeakMap<HTMLElement, AiComposerRefSource[]>();
const ACTIVE_REFS = new WeakMap<HTMLElement, AiComposerRefSource[]>();
const USAGE = new WeakMap<HTMLElement, { usage: AiUsage; opts: AiUsageRingOpts }>();
const TODO = new WeakMap<HTMLElement, AiTodoItem[]>();
const HISTORIES = new WeakMap<HTMLElement, { items: string[]; index: number }>();
const POPUP = new WeakMap<HTMLElement, ComposerPopup>();
/** setupComposer 注册的 submit 闭包（弹层无匹配 Enter 回退发送用） */
const SUBMITS = new WeakMap<HTMLElement, () => void>();
/** bindComposer opts.popoverSizing：三弹层共用的程序面整体覆盖（> composer 根 data-panel-* > 内置默认） */
const POPUP_SIZING = new WeakMap<HTMLElement, PanelSizing>();

/* ══════════════ 小工具 ══════════════ */

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function emit<K extends keyof IcenEventMap>(target: HTMLElement, name: K, detail: IcenEventMap[K]): void {
  emitIcen(target, name, detail);
}

/** el 传 composer 容器或其内部任意元素，就近解析 [data-ai-composer]。 */
function resolveComposer(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>('[data-ai-composer]');
}

function getTextarea(composer: HTMLElement): HTMLTextAreaElement | null {
  return composer.querySelector<HTMLTextAreaElement>('.ai-composer-input');
}

/* autosize：rows(默认 1)…maxRows(默认 8)，超出后内滚（setup 与 v2 文本插入口共用） */
function autosizeTa(ta: HTMLTextAreaElement): void {
  const composer = ta.closest<HTMLElement>('[data-ai-composer]');
  const maxRows = Number(composer?.getAttribute('data-max-rows')) || MAX_ROWS_DEFAULT;
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
  const sendBtn = composer.querySelector<HTMLButtonElement>('[data-ai-send]');
  if (sendBtn && !sendBtn.hasChildNodes()) {
    const sendWrap = document.createElement('span');
    sendWrap.className = 'ai-composer-send-icon';
    sendWrap.dataset.aiSendIcon = 'send';
    const stopWrap = document.createElement('span');
    stopWrap.className = 'ai-composer-send-icon';
    stopWrap.dataset.aiSendIcon = 'stop';
    const sendSvg = svgIcon(SEND_ICON);
    const stopSvg = svgIcon(STOP_ICON);
    if (sendSvg) sendWrap.appendChild(sendSvg);
    if (stopSvg) stopWrap.appendChild(stopSvg);
    sendBtn.append(sendWrap, stopWrap);
  }
  const attachBtn = composer.querySelector<HTMLButtonElement>('[data-ai-attach]');
  if (attachBtn && !attachBtn.hasChildNodes()) {
    const icon = svgIcon(ATTACH_ICON);
    if (icon) attachBtn.appendChild(icon);
  }
  const sendIcon = sendBtn?.querySelector<HTMLElement>('[data-ai-send-icon="send"]') ?? null;
  const stopIcon = sendBtn?.querySelector<HTMLElement>('[data-ai-send-icon="stop"]') ?? null;
  return { sendBtn, sendIcon, stopIcon };
}

/* chips（queue / attach / refs 共用结构） */

function makeChip(text: string, removable: boolean, ariaLabel: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'ai-composer-chip';
  const label = document.createElement('span');
  label.className = 'ai-composer-chip-text';
  label.textContent = text;
  chip.appendChild(label);
  if (removable) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ai-composer-chip-remove';
    remove.setAttribute('aria-label', ariaLabel);
    remove.textContent = '×';
    chip.appendChild(remove);
  }
  return chip;
}

/** 队列 chips 渲染（模块级：setupComposer 与 bindComposer 的排队自动发送共用） */
function renderQueueChips(composer: HTMLElement): void {
  const queueEl = composer.querySelector<HTMLElement>('.ai-composer-queue');
  if (!queueEl) return;
  const queue = QUEUES.get(composer) ?? [];
  queueEl.replaceChildren(...queue.map((text, i) => makeChip(text, true, `移除排队消息 ${i + 1}`)));
  queueEl.hidden = queue.length === 0;
}

/* ══════════════ v1 运行态（§4.3 契约，不变）══════════════ */

/**
 * 运行态切换（spec §4.3）：
 * el 传 composer 容器或其内部任意元素（含发送钮自身），就近解析 [data-ai-composer]。
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
  const sendBtn = composer.querySelector<HTMLButtonElement>('[data-ai-send]');
  if (!sendBtn) return;
  sendBtn.classList.toggle('is-stop', running);
  sendBtn.setAttribute('aria-label', running ? '停止生成' : '发送');
  const sendIcon = sendBtn.querySelector<HTMLElement>('[data-ai-send-icon="send"]');
  const stopIcon = sendBtn.querySelector<HTMLElement>('[data-ai-send-icon="stop"]');
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
    badge.className = 'ai-composer-model-badge';
    badge.textContent = (provider.label.trim()[0] ?? '?').toUpperCase();
    slot.appendChild(badge);
  }
  return slot;
}

function buildModelButton(composer: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ai-composer-model';
  btn.setAttribute('data-ai-model-open', '');
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
  const btn = composer.querySelector<HTMLElement>('[data-ai-model-open]');
  if (!cfg || !btn) return;
  const provider = cfg.providers.find((p) => p.id === cfg.current.provider) ?? cfg.providers[0];
  if (!provider) return;
  const model = provider.models.find((m) => m.id === cfg.current.model) ?? provider.models[0];
  if (!model) return;

  const iconSlot = btn.querySelector<HTMLElement>('.ai-composer-model-icon')
    ?? (() => {
      const slot = document.createElement('span');
      slot.className = 'ai-composer-model-icon';
      btn.prepend(slot);
      return slot;
    })();
  iconSlot.replaceChildren(providerMark(provider, 'ai-composer-model-provider-icon'));

  let name = btn.querySelector<HTMLElement>('.ai-composer-model-name');
  if (!name) {
    name = document.createElement('span');
    name.className = 'ai-composer-model-name';
    btn.insertBefore(name, btn.querySelector('.ai-composer-model-chevron'));
  }
  name.textContent = model.label;
  btn.setAttribute('aria-label', `模型 ${model.label}（${provider.label}）`);
  if (!btn.querySelector('.ai-composer-model-chevron')) {
    const chev = svgIcon(ICON_CHEVRON);
    if (chev) {
      const wrap = document.createElement('span');
      wrap.className = 'ai-composer-model-chevron';
      wrap.appendChild(chev);
      btn.appendChild(wrap);
    }
  }
}

/**
 * 工具条装配/重排（幂等）。仅当配置了 models 或 usage 时创建工具条；
 * v1 的 attach/send 按钮被移入工具条（事件监听挂在元素上，随元素移动保留）。
 * 作者手写的 .ai-composer-toolbar 结构只补缺、不重排。
 */
function syncToolbar(composer: HTMLElement): void {
  const box = composer.querySelector<HTMLElement>('.ai-composer-box');
  if (!box || !getTextarea(composer)) return;
  const modelsCfg = MODELS.get(composer);
  const usageCfg = USAGE.get(composer);
  if (!modelsCfg && !usageCfg) return;

  let bar = composer.querySelector<HTMLElement>('.ai-composer-toolbar');

  /* 模型钮（仅 models 配置时存在；只移除 JS 自动创建的） */
  let modelBtn = composer.querySelector<HTMLElement>('[data-ai-model-open]');
  if (modelsCfg && !modelBtn) {
    modelBtn = buildModelButton(composer);
    modelBtn.dataset.aiModelOpen = 'auto';
    updateModelButton(composer);
  }
  if (!modelsCfg && modelBtn?.dataset.aiModelOpen === 'auto') {
    modelBtn.remove();
    modelBtn = null;
  }

  /* 用量环挂载点 */
  let usageMount = composer.querySelector<HTMLElement>('.ai-composer-usage');
  if (usageCfg && !usageMount) {
    usageMount = document.createElement('span');
    usageMount.className = 'ai-composer-usage';
    usageMount.dataset.aiUsage = 'auto';
  }
  if (!usageCfg && usageMount?.dataset.aiUsage === 'auto') {
    usageMount.remove();
    usageMount = null;
  }

  const attach = composer.querySelector<HTMLElement>('[data-ai-attach]');
  const send = composer.querySelector<HTMLElement>('[data-ai-send]');

  if (bar) {
    /* 作者已写好 v2 结构：只补缺的模型钮/用量挂载点，不重排既有子元素 */
    if (modelBtn && modelBtn.parentElement !== bar) bar.insertBefore(modelBtn, bar.firstChild);
    if (usageMount && usageMount.parentElement !== bar) {
      bar.insertBefore(usageMount, attach && attach.parentElement === bar ? attach : null);
    }
  } else {
    bar = document.createElement('div');
    bar.className = 'ai-composer-toolbar';
    bar.appendChild(modelBtn ?? document.createComment('model'));
    const spacer = document.createElement('span');
    spacer.className = 'ai-composer-spacer';
    bar.appendChild(spacer);
    if (usageMount) bar.appendChild(usageMount);
    if (attach) bar.appendChild(attach);
    if (send) bar.appendChild(send);
    box.appendChild(bar);
  }

  /* 清空后的 v1 按钮容器移除（忽略空白文本节点） */
  const legacy = composer.querySelector<HTMLElement>('.ai-composer-actions');
  if (legacy && legacy.childElementCount === 0 && !(legacy.textContent ?? '').trim()) {
    legacy.remove();
  }
}

/** 用量环重渲染：显式 opts.total 优先，否则用选中模型的 context。 */
function refreshUsageRing(composer: HTMLElement): void {
  const cfg = USAGE.get(composer);
  const mount = composer.querySelector<HTMLElement>('.ai-composer-usage');
  if (!cfg || !mount) return;
  const explicit = typeof cfg.opts.total === 'number' && cfg.opts.total > 0;
  renderAiUsageRing(mount, cfg.usage, {
    ...cfg.opts,
    total: explicit ? cfg.opts.total : MODEL_CTX.get(composer),
  });
}

/* ══════════════ v2 弹层基座（portal body，一次性动态面板，listbox 语义）══════════════ */

interface ComposerPopup {
  mode: 'model' | 'command' | 'ref';
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
}

const visibleOptions = (s: ComposerPopup): HTMLButtonElement[] =>
  s.options.filter((o) => !o.hidden);

function setPopupFocus(s: ComposerPopup, idx: number): void {
  const vis = visibleOptions(s);
  s.options.forEach((o) => o.classList.remove('is-focused'));
  if (vis.length === 0) {
    s.focused = -1;
    return;
  }
  s.focused = Math.max(0, Math.min(idx, vis.length - 1));
  const cur = vis[s.focused];
  cur.classList.add('is-focused');
  cur.scrollIntoView({ block: 'nearest' });
}

function movePopupFocus(s: ComposerPopup, delta: number): void {
  const vis = visibleOptions(s);
  if (vis.length === 0) return;
  setPopupFocus(s, (s.focused + delta + vis.length) % vis.length);
}

/** 过滤后隐藏空分组、切换空态、焦点回第一个可见项。 */
function settlePopup(s: ComposerPopup): void {
  for (const g of s.groups) {
    g.hidden = !Array.from(g.querySelectorAll<HTMLElement>('.ai-composer-popup-option'))
      .some((o) => !o.hidden);
  }
  s.emptyEl.hidden = visibleOptions(s).length > 0;
  setPopupFocus(s, 0);
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
      e.preventDefault();
      const vis = visibleOptions(s);
      const opt = vis[s.focused] ?? vis[0];
      if (opt) {
        s.pick(opt);
        return;
      }
      /* 无匹配项：Enter 回退为普通发送（未知命令不拦截、进消息流），Tab 仅关弹层 */
      closePopup(composer, false);
      if (e.key === 'Enter') SUBMITS.get(composer)?.();
      return;
    }
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
  POPUP.delete(composer);
  if (s.searchInput && s.keydownHandler) {
    s.searchInput.removeEventListener('keydown', s.keydownHandler);
  }
  if (s.mode === 'model') {
    composer.querySelector('[data-ai-model-open]')?.setAttribute('aria-expanded', 'false');
  }
  if (s.mode !== 'model') {
    getTextarea(composer)?.setAttribute('aria-expanded', 'false');
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
 * 三弹层（模型/命令/引用）共用的尺寸解析（PanelSizing 契约）：
 * 用户属性面 = composer 根上的 data-panel-*（data-panel-width/min/max/min-height/max-height，
 * 三弹层共用一套）；程序面 = bindComposer opts.popoverSizing（整体覆盖三个弹层）；
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
  panel.className = 'ai-composer-popup';
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
  openPopover(panel, {
    anchor: init.anchor,
    side: 'top',
    align: 'start',
    offset: 8,
    sizing: resolvePopupSizing(composer, init.sizing),
    onClose: () => {
      if (POPUP.get(composer) === session) POPUP.delete(composer);
      panel.remove();
    },
  });
  POPUP.set(composer, session);
  /* 点击 / 悬停与键盘共用一个 is-focused（select.ts 同款） */
  panel.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const opt = t.closest<HTMLButtonElement>('.ai-composer-popup-option');
    if (opt && panel.contains(opt) && !opt.hidden) session.pick(opt);
  });
  panel.addEventListener('mouseover', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const opt = t.closest<HTMLButtonElement>('.ai-composer-popup-option');
    if (!opt || opt.hidden) return;
    const idx = visibleOptions(session).indexOf(opt);
    if (idx >= 0) setPopupFocus(session, idx);
  });
  return session;
}

/* ── 模型弹层 ── */

function openModelPopup(composer: HTMLElement): void {
  const cfg = MODELS.get(composer);
  if (!cfg) return;
  const btn = composer.querySelector<HTMLElement>('[data-ai-model-open]');
  const anchor = btn ?? composer.querySelector('.ai-composer-box') ?? composer;
  const ta = getTextarea(composer);

  const session = mountPopup(composer, {
    mode: 'model',
    anchor,
    sizing: { minWidth: 220, maxWidth: 320, maxHeight: 340 },
    returnFocus: btn ?? ta,
    pick: (opt) => {
      const provider = opt.dataset.provider ?? '';
      const model = opt.dataset.model ?? '';
      const label = opt.dataset.label ?? model;
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
      search.className = 'ai-composer-popup-search';
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'ai-composer-popup-search-input';
      input.placeholder = '搜索模型';
      input.setAttribute('aria-label', '搜索模型');
      search.appendChild(input);
      s.panel.appendChild(search);
      s.searchInput = input;

      /* 分组列表 */
      const list = document.createElement('div');
      list.className = 'ai-composer-popup-list';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', '选择模型');
      for (const p of cfg.providers) {
        const group = document.createElement('div');
        group.className = 'ai-composer-popup-group';
        const glabel = document.createElement('div');
        glabel.className = 'ai-composer-popup-group-label';
        glabel.appendChild(providerMark(p, 'ai-composer-popup-group-icon'));
        const gtext = document.createElement('span');
        gtext.textContent = p.label;
        glabel.appendChild(gtext);
        group.appendChild(glabel);
        for (const m of p.models) {
          const opt = document.createElement('button');
          opt.type = 'button';
          opt.className = 'ai-composer-popup-option';
          opt.setAttribute('role', 'option');
          opt.dataset.provider = p.id;
          opt.dataset.providerLabel = p.label;
          opt.dataset.model = m.id;
          opt.dataset.label = m.label;
          if (typeof m.context === 'number') opt.dataset.context = String(m.context);
          const selected = cfg.current.provider === p.id && cfg.current.model === m.id;
          opt.setAttribute('aria-selected', String(selected));
          const icon = document.createElement('span');
          icon.className = 'ai-composer-popup-option-icon';
          icon.appendChild(providerMark(p, 'ai-composer-popup-option-provider-icon'));
          const label = document.createElement('span');
          label.className = 'ai-composer-popup-option-label';
          label.textContent = m.label;
          const meta = document.createElement('span');
          meta.className = 'ai-composer-popup-option-meta';
          meta.textContent = typeof m.context === 'number' ? formatTokens(m.context) : '';
          const check = document.createElement('span');
          check.className = 'ai-composer-popup-option-check';
          const checkSvg = svgIcon(ICON_CHECK);
          if (checkSvg) check.appendChild(checkSvg);
          opt.append(icon, label, meta, check);
          group.appendChild(opt);
          s.options.push(opt);
        }
        list.appendChild(group);
        s.groups.push(group);
      }
      s.panel.appendChild(list);

      s.emptyEl.className = 'ai-composer-popup-empty';
      s.emptyEl.textContent = '无匹配模型';
      s.emptyEl.hidden = true;
      s.panel.appendChild(s.emptyEl);

      /* 底部提示：切换模型会使 prompt 缓存失效；cacheRead 占比高时升级 warning 色 */
      const foot = document.createElement('div');
      foot.className = 'ai-composer-popup-foot';
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
      footText.textContent = '切换模型会使 prompt 缓存失效';
      foot.appendChild(footText);
      s.panel.appendChild(foot);

      /* 键盘接管：搜索框内 ↑↓/Enter/Tab/Esc */
      s.keydownHandler = (e) => popupKeydown(composer, s, e);
      input.addEventListener('keydown', s.keydownHandler);
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        for (const opt of s.options) {
          const hay = `${opt.dataset.label ?? ''} ${opt.dataset.providerLabel ?? ''}`.toLowerCase();
          opt.hidden = q !== '' && !hay.includes(q);
        }
        settlePopup(s);
      });
    },
  });

  btn?.setAttribute('aria-expanded', 'true');
  session.searchInput?.focus();
}

/* ── 命令弹层 ── */

function openCommandPopup(composer: HTMLElement, token: string): void {
  const commands = COMMANDS.get(composer);
  if (!commands || commands.length === 0) return;
  const box = composer.querySelector('.ai-composer-box') ?? composer;
  const ta = getTextarea(composer);
  const boxRect = box.getBoundingClientRect();

  const session = mountPopup(composer, {
    mode: 'command',
    anchor: box,
    sizing: { minWidth: Math.min(Math.max(boxRect.width, 200), 320), maxWidth: 360, maxHeight: 320 },
    returnFocus: ta,
    pick: (opt) => {
      const name = opt.dataset.name ?? '';
      /* args = 输入中命令名后的剩余文本（首个空白起） */
      const m = /^\/\S*\s+([\s\S]*)$/.exec(ta?.value ?? '');
      const args = m ? m[1] : '';
      if (ta) {
        ta.value = '';
        autosizeTa(ta);
      }
      emit(composer, 'icen:ai-command', { name, args });
      closePopup(composer);
    },
    build: (s) => {
      const list = document.createElement('div');
      list.className = 'ai-composer-popup-list';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', '命令');
      const group = document.createElement('div');
      group.className = 'ai-composer-popup-group';
      for (const c of commands) {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'ai-composer-popup-option ai-composer-popup-cmd';
        opt.setAttribute('role', 'option');
        opt.dataset.name = c.name;
        opt.dataset.hay = `${c.name} ${c.description ?? ''}`.toLowerCase();
        const line = document.createElement('span');
        line.className = 'ai-composer-popup-cmd-line';
        const nameEl = document.createElement('span');
        nameEl.className = 'ai-composer-popup-cmd-name';
        nameEl.textContent = `/${c.name}`;
        line.appendChild(nameEl);
        if (c.argsHint) {
          const argsEl = document.createElement('span');
          argsEl.className = 'ai-composer-popup-cmd-args';
          argsEl.textContent = c.argsHint;
          line.appendChild(argsEl);
        }
        opt.appendChild(line);
        if (c.description) {
          opt.appendChild(Object.assign(document.createElement('span'), {
            className: 'ai-composer-popup-cmd-desc',
            textContent: c.description,
          }));
        }
        group.appendChild(opt);
        s.options.push(opt);
      }
      list.appendChild(group);
      s.groups.push(group);
      s.panel.appendChild(list);

      s.emptyEl.className = 'ai-composer-popup-empty';
      s.emptyEl.textContent = '无匹配命令';
      s.emptyEl.hidden = true;
      s.panel.appendChild(s.emptyEl);
    },
  });

  ta?.setAttribute('aria-expanded', 'true');
  filterCommandOptions(session, token);
}

function commandToken(value: string): string {
  /* 过滤令牌：'/' 后首个空白前的部分（参数区不影响过滤） */
  return value.slice(1).split(/\s/, 1)[0] ?? '';
}

function filterCommandOptions(s: ComposerPopup, token: string): void {
  const q = token.trim().toLowerCase();
  for (const opt of s.options) {
    opt.hidden = q !== '' && !(opt.dataset.hay ?? '').includes(q);
  }
  settlePopup(s);
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
  filterCommandOptions(s, commandToken(value));
}

/* ── 引用弹层 ── */

function openRefPopup(
  composer: HTMLElement,
  range: { start: number; end: number },
  filter: string,
): void {
  const sources = REF_SOURCES.get(composer);
  if (!sources || sources.length === 0) return;
  const box = composer.querySelector('.ai-composer-box') ?? composer;
  const ta = getTextarea(composer);
  const boxRect = box.getBoundingClientRect();

  const session = mountPopup(composer, {
    mode: 'ref',
    anchor: box,
    sizing: { minWidth: Math.min(Math.max(boxRect.width, 200), 320), maxWidth: 360, maxHeight: 320 },
    returnFocus: ta,
    refRange: range,
    pick: (opt) => {
      const source = (REF_SOURCES.get(composer) ?? []).find((r) => r.id === opt.dataset.refId);
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
      list.className = 'ai-composer-popup-list';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', '引用');
      for (const kind of knownRefKinds(sources)) {
        const def = getRefKindDef(kind);
        const items = sources.filter((r) => r.kind === kind);
        if (items.length === 0) continue;
        const group = document.createElement('div');
        group.className = 'ai-composer-popup-group';
        group.dataset.kind = kind;
        group.appendChild(Object.assign(document.createElement('div'), {
          className: 'ai-composer-popup-group-label',
          textContent: def.label,
        }));
        for (const r of items) {
          const opt = document.createElement('button');
          opt.type = 'button';
          opt.className = 'ai-composer-popup-option';
          opt.setAttribute('role', 'option');
          opt.dataset.refId = r.id;
          opt.dataset.hay = `${r.label} ${r.sub ?? ''}`.toLowerCase();
          const icon = document.createElement('span');
          icon.className = 'ai-composer-popup-option-icon';
          const svg = svgIcon(def.icon);
          if (svg) icon.appendChild(svg);
          const label = document.createElement('span');
          label.className = 'ai-composer-popup-option-label';
          label.textContent = r.label;
          if (r.sub) {
            const sub = document.createElement('span');
            sub.className = 'ai-composer-popup-option-sub';
            sub.textContent = r.sub;
            label.appendChild(sub);
          }
          opt.append(icon, label);
          group.appendChild(opt);
          s.options.push(opt);
        }
        list.appendChild(group);
        s.groups.push(group);
      }
      s.panel.appendChild(list);

      s.emptyEl.className = 'ai-composer-popup-empty';
      s.emptyEl.textContent = '无匹配引用';
      s.emptyEl.hidden = true;
      s.panel.appendChild(s.emptyEl);
    },
  });

  ta?.setAttribute('aria-expanded', 'true');
  filterRefOptions(session, filter);
}

function filterRefOptions(s: ComposerPopup, filter: string): void {
  const q = filter.trim().toLowerCase();
  for (const opt of s.options) {
    opt.hidden = q !== '' && !(opt.dataset.hay ?? '').includes(q);
  }
  settlePopup(s);
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
  filterRefOptions(s, t.filter);
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
  const existing = composer.querySelector<HTMLElement>('.ai-composer-refs');
  if (existing) return existing;
  const row = document.createElement('div');
  row.className = 'ai-composer-refs';
  row.dataset.aiRefs = 'auto';
  row.hidden = true;
  /* §8 顺序：queue → refs → attach → box */
  const attach = composer.querySelector('.ai-composer-attach');
  const box = composer.querySelector('.ai-composer-box');
  composer.insertBefore(row, attach ?? box ?? null);
  return row;
}

function renderRefs(composer: HTMLElement): void {
  const row = composer.querySelector<HTMLElement>('.ai-composer-refs');
  const actives = ACTIVE_REFS.get(composer) ?? [];
  if (!row) return;
  row.replaceChildren(
    ...actives.map((src) => {
      const chip = makeChip(src.label, true, `移除引用 ${src.label}`);
      chip.dataset.refId = src.id;
      return chip;
    }),
  );
  row.hidden = actives.length === 0;
}

function addActiveRef(composer: HTMLElement, source: AiComposerRefSource): void {
  const actives = ACTIVE_REFS.get(composer) ?? [];
  if (actives.some((r) => r.id === source.id)) return; /* 同 id 不重复出 chip、不重复派事件 */
  actives.push(source);
  ACTIVE_REFS.set(composer, actives);
  renderRefs(composer);
  emit(composer, 'icen:ai-ref', { action: 'add', ref: source });
}

function removeActiveRef(composer: HTMLElement, source: AiComposerRefSource): void {
  const actives = ACTIVE_REFS.get(composer) ?? [];
  const idx = actives.findIndex((r) => r.id === source.id);
  if (idx === -1) return;
  actives.splice(idx, 1);
  ACTIVE_REFS.set(composer, actives);
  renderRefs(composer);
  /* 同步删文本里首个 `@label`（连同其后一个空白） */
  const ta = getTextarea(composer);
  if (ta) {
    const needle = `@${source.label}`;
    const at = ta.value.indexOf(needle);
    if (at !== -1) {
      let endIdx = at + needle.length;
      if (ta.value[endIdx] === ' ') endIdx += 1;
      ta.value = ta.value.slice(0, at) + ta.value.slice(endIdx);
      autosizeTa(ta);
    }
  }
  emit(composer, 'icen:ai-ref', { action: 'remove', ref: source });
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
  const queueEl = composer.querySelector<HTMLElement>('.ai-composer-queue');
  const attachEl = composer.querySelector<HTMLElement>('.ai-composer-attach');
  const { sendBtn, sendIcon, stopIcon } = ensureIcons(composer);

  /* v2 默认 placeholder（作者已写 placeholder 则不覆盖） */
  if (!ta.hasAttribute('placeholder')) {
    ta.setAttribute('placeholder', '输入消息，/ 命令 · @ 引用 · Enter 发送');
  }

  /* ── 队列 chips 渲染 ── */
  const renderQueue = (): void => renderQueueChips(composer);

  const enqueue = (text: string): void => {
    const queue = QUEUES.get(composer) ?? [];
    queue.push(text);
    QUEUES.set(composer, queue);
    renderQueue();
  };

  /* ── 发送 / 排队 / 停止 ── */
  const isRunning = (): boolean => RUNNING.get(composer) ?? false;

  const submit = (): void => {
    const text = ta.value;
    if (!text.trim()) return;
    ta.value = '';
    autosizeTa(ta);
    if (isRunning()) {
      enqueue(text);
      emit(composer, 'icen:ai-queue', { text });
    } else {
      pushHistory(composer, text);
      emit(composer, 'icen:ai-send', { text });
    }
  };
  SUBMITS.set(composer, submit);

  /* 运行中 ↑：把最后一条排队消息取回输入框重新编辑（Claude Code 模式）。
     队列是事件源（icen:ai-queue / icen:ai-dequeue 双向同步），取回即移除，按契约派 dequeue。 */
  const takeBackLastQueued = (): void => {
    const queue = QUEUES.get(composer) ?? [];
    if (queue.length === 0) return;
    const index = queue.length - 1;
    const text = queue.pop() as string;
    QUEUES.set(composer, queue);
    renderQueue();
    ta.value = text;
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
    ta.value = h.items[h.index] as string;
    autosizeTa(ta);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (composing || e.isComposing) return; /* IME 组合态全程挂起（含方向键，不打断候选选择） */
    const session = POPUP.get(composer);
    if (session) {
      popupKeydown(composer, session, e);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'ArrowUp') {
      const h = HISTORIES.get(composer);
      const browsing = (h?.index ?? -1) >= 0;
      if (ta.value === '') {
        if (isRunning() && (QUEUES.get(composer) ?? []).length > 0) {
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
  };
  const onCompositionEnd = (): void => {
    composing = false;
  };

  const onSendClick = (): void => {
    if (isRunning()) {
      emit(composer, 'icen:ai-stop', {});
    } else {
      submit();
    }
  };

  /* chip × 移除（queue 派 icen:ai-dequeue {index}；refs 派 icen:ai-ref remove；attach chip 纯视觉移除） */
  const onQueueClick = (e: MouseEvent): void => {
    const btn = e.target instanceof Element ? e.target.closest('.ai-composer-chip-remove') : null;
    if (!btn) return;
    const index = Array.from(queueEl?.querySelectorAll('.ai-composer-chip-remove') ?? []).indexOf(btn);
    const queue = QUEUES.get(composer) ?? [];
    if (index >= 0 && index < queue.length) {
      queue.splice(index, 1);
      QUEUES.set(composer, queue);
      renderQueue();
      emit(composer, 'icen:ai-dequeue', { index });
    }
  };

  /* refs chip ×（委托在 composer 上：refs 行可能是 setComposerRefs 晚于 init 才创建） */
  const onRefsClick = (e: MouseEvent): void => {
    const btn = e.target instanceof Element ? e.target.closest('.ai-composer-chip-remove') : null;
    if (!btn || !btn.closest('.ai-composer-refs')) return;
    const id = btn.closest<HTMLElement>('.ai-composer-chip')?.dataset.refId;
    const source = (ACTIVE_REFS.get(composer) ?? []).find((r) => r.id === id);
    if (source) removeActiveRef(composer, source);
  };

  /* ── 附件（钮选 / 粘贴 / 拖放三入口共用）── */
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.hidden = true;
  fileInput.multiple = true;
  composer.appendChild(fileInput);

  const onAttachClick = (): void => {
    fileInput.click();
  };

  const addFiles = (files: File[]): void => {
    if (files.length === 0) return;
    if (attachEl) {
      for (const f of files) {
        const chip = makeChip(f.name, true, `移除附件 ${f.name}`);
        const remove = chip.querySelector<HTMLButtonElement>('.ai-composer-chip-remove');
        remove?.addEventListener('click', () => chip.remove(), { once: true });
        attachEl.appendChild(chip);
      }
      attachEl.hidden = false;
    }
    emit(composer, 'icen:ai-attach', { files });
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
  const boxEl = composer.querySelector<HTMLElement>('.ai-composer-box');
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
  composer.querySelector('[data-ai-attach]')?.addEventListener('click', onAttachClick);
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
    composer.querySelector('[data-ai-attach]')?.removeEventListener('click', onAttachClick);
    fileInput.removeEventListener('change', onFileChange);
    fileInput.remove();
    el.__icenAiComposerInit = false;
  };
}

/**
 * 初始化 root 下的全部 [data-ai-composer]（root 自身匹配时包含自身）。
 * 幂等；返回销毁函数（复刻 initBackTop 约定）。
 */
export function initAiComposer(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (isBrowser()) {
    const scope = root ?? document;
    const candidates: HTMLElement[] = [];
    if (scope instanceof Element && scope.matches('[data-ai-composer]')) {
      candidates.push(scope as HTMLElement);
    }
    candidates.push(...Array.from(scope.querySelectorAll<HTMLElement>('[data-ai-composer]')));
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
 * 配置模型切换（§8）：工具条出现模型钮，弹层按 provider 分组 + 搜索过滤 + 当前勾选。
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
    const btn = composer.querySelector<HTMLElement>('[data-ai-model-open]');
    if (btn?.dataset.aiModelOpen === 'auto') btn.remove();
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
    if (session?.mode === 'command') closePopup(composer);
    return;
  }
  COMMANDS.set(composer, list);
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
    const mount = composer.querySelector<HTMLElement>('.ai-composer-usage');
    if (mount?.dataset.aiUsage === 'auto') mount.remove();
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
  let chip = composer.querySelector<HTMLElement>('.ai-composer-todo');
  if (!items || items.length === 0) {
    TODO.delete(composer);
    chip?.remove();
    return;
  }
  TODO.set(composer, items);
  if (!chip) {
    chip = document.createElement('button');
    (chip as HTMLButtonElement).type = 'button';
    chip.className = 'ai-composer-todo';
    chip.setAttribute('aria-haspopup', 'true');
    chip.addEventListener('click', () => {
      const cur = TODO.get(composer);
      if (!cur) return;
      const p = document.createElement('div');
      p.className = 'popover ai-composer-todo-pop';
      p.hidden = true;
      const title = document.createElement('div');
      title.className = 'ai-usage-popover-title';
      title.textContent = '当前待办';
      const body = document.createElement('div');
      body.className = 'ai-usage-popover-body';
      renderAiTodo(body, cur);
      p.append(title, body);
      openPopover(p, {
        anchor: chip as HTMLElement,
        side: 'top',
        align: 'end',
        onClose: () => p.remove(),
      });
    });
    const icon = svgIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>',
    );
    if (icon) chip.appendChild(icon);
    chip.appendChild(document.createElement('span')).className = 'ai-composer-todo-label';
    const toolbar = composer.querySelector<HTMLElement>('.ai-composer-toolbar');
    const usage = composer.querySelector<HTMLElement>('.ai-composer-usage');
    if (toolbar) toolbar.insertBefore(chip, usage ?? null);
    else {
      const box = composer.querySelector<HTMLElement>('.ai-composer-box');
      box?.before(chip);
    }
  }
  const done = items.filter((t) => t.status === 'done').length;
  const failed = items.some((t) => t.status === 'error' || t.status === 'cancelled');
  chip.classList.toggle('is-done', done === items.length && !failed);
  chip.classList.toggle('is-error', failed);
  chip.setAttribute('aria-label', `当前待办 ${done}/${items.length}${failed ? '（有失败项）' : ''}`);
  const label = chip.querySelector<HTMLElement>('.ai-composer-todo-label');
  if (label) label.textContent = `${done}/${items.length}`;
}

/* ══════════════ 绑定层 bindComposer（spec §11，「零接线全链路」的胶水） ══════════════ */

export interface AiComposerBindOpts {
  /**
   * 传入即托管对话（client 模式）：icen:ai-send → renderAiMessage 用户消息 + running +
   * client.stream → assistant 消息 + createAiStream 逐 chunk 追加 → done 收尾（meta 自动填
   * token/成本）；错误 → setError + fail；stop → session.cancel()；排队消息每轮完成自动发送。
   * 需要 messages 容器。history 由绑定层维护（system 消息可先经 client 直接对话时自带）。
   */
  client?: AiClient;
  /** 消息挂载容器（.ai-chat-scroll 或任意元素；client 模式必填） */
  messages?: HTMLElement;
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
   * 三弹层（模型/命令/引用）尺寸的整体程序覆盖（PanelSizing 契约）：
   * 优先于 composer 根上的 data-panel-*（三弹层共用的用户覆盖面）与各弹层内置默认，
   * 一次设置对三个弹层同时生效。
   */
  popoverSizing?: PanelSizing;
}

export interface AiComposerBinding {
  /** 解绑全部监听并中止进行中的托管会话（composer 本身的 init 不受影响） */
  unbind(): void;
}

const BOUND = new WeakSet<HTMLElement>();

const USAGE_KEYS: Array<keyof AiUsage> = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'total'];

function accumulateUsage(acc: AiUsage, add?: AiUsage): void {
  if (!add) return;
  for (const k of USAGE_KEYS) {
    const v = add[k];
    if (typeof v === 'number' && Number.isFinite(v)) acc[k] = (acc[k] as number | undefined ?? 0) + v;
  }
}

/**
 * composer ↔ 消息区 ↔ client ↔ 用量环的闭环绑定（事件驱动，传输会话所有权仍归消费方）。
 * 不传 client 时为纯状态绑定（send→running、done→解除、环更新），渐进采用。
 * 注意：running 自动管理依赖 client 派发的 icen:ai-done；无 client 的纯事件用法需
 * 自行派发该事件或传 running:false。
 */
export function bindComposer(el: HTMLElement, opts: AiComposerBindOpts = {}): AiComposerBinding {
  const noop = (): void => undefined;
  if (!isBrowser()) return { unbind: noop };
  const composer = resolveComposer(el);
  if (!composer) return { unbind: noop };
  if (BOUND.has(composer)) return { unbind: noop }; /* 防重复绑定 */
  BOUND.add(composer);

  /* 三弹层尺寸整体覆盖（> composer 根 data-panel-* > 内置默认；跨 bind/unbind 保留的配置） */
  if (opts.popoverSizing) POPUP_SIZING.set(composer, opts.popoverSizing);

  const disposers: Array<() => void> = [];
  const usageCfg = opts.usage;
  const manageRunning = opts.running ?? true;

  /* ── 用量环自动更新（icen:ai-done 驱动）── */
  if (usageCfg) {
    let cost = 0;
    let billing: AiUsage = {};
    const onDone = (e: Event): void => {
      const detail = (e as CustomEvent<AiDoneEventDetail>).detail;
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
        accumulateUsage(billing, detail.usage);
        usage = billing;
      } else {
        usage = usageCfg.from.summary();
      }
      setComposerUsage(composer, usage, {
        total: usageCfg.total,
        cost: cost > 0 ? Math.round(cost * 1e6) / 1e6 : undefined,
      });
    };
    document.addEventListener('icen:ai-done', onDone);
    disposers.push(() => document.removeEventListener('icen:ai-done', onDone));
  }

  /* ── client 模式：对话全托管 ── */
  if (opts.client && opts.messages) {
    const client = opts.client;
    const messages = opts.messages;
    const history: AiChatMessage[] = [];
    let session: AiStreamSession | null = null;

    const metaOf = (r: { usage: AiUsage; cost?: number }): string => {
      const tok = r.usage.total ?? 0;
      const parts = [tok > 0 ? `${formatTokens(tok)} tok` : '完成'];
      if (typeof r.cost === 'number') parts.push(`$${r.cost.toFixed(4)}`);
      return `刚刚 · ${parts.join(' · ')}`;
    };

    const startTurn = (): void => {
      const assistant: AiMessageHandle = renderAiMessage(messages, {
        role: 'assistant',
        content: '',
        streaming: true,
        model: client.config.model,
      });
      const streamH: AiStreamHandle = assistant.stream();
      setComposerRunning(composer, true);
      const s = client.stream({ messages: [...history] });
      session = s;
      let failed = false;
      void (async () => {
        for await (const chunk of s) {
          if (chunk.type === 'text') streamH.append(chunk.delta);
          else if (chunk.type === 'error') {
            failed = true;
            streamH.fail();
            assistant.setError(chunk.message);
          }
        }
        const result = await s.done;
        session = null;
        if (!failed) streamH.done();
        assistant.setMeta(metaOf(result));
        if (result.text) history.push({ role: 'assistant', content: result.text });
        setComposerRunning(composer, false);
        /* 排队消息自动发送下一条（Claude Code 模式） */
        const queue = QUEUES.get(composer) ?? [];
        if (queue.length > 0) {
          const next = queue.shift() as string;
          QUEUES.set(composer, queue);
          renderQueueChips(composer);
          emit(composer, 'icen:ai-dequeue', { index: 0 });
          send(next);
        }
      })();
    };

    const send = (text: string): void => {
      renderAiMessage(messages, { role: 'user', content: text });
      history.push({ role: 'user', content: text });
      startTurn();
    };

    const onSend = (e: Event): void => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text;
      if (typeof text === 'string' && text) send(text);
    };
    const onStop = (): void => {
      session?.cancel();
    };
    composer.addEventListener('icen:ai-send', onSend);
    composer.addEventListener('icen:ai-stop', onStop);
    disposers.push(() => {
      composer.removeEventListener('icen:ai-send', onSend);
      composer.removeEventListener('icen:ai-stop', onStop);
      session?.cancel();
    });
  } else if (manageRunning) {
    /* ── 纯状态绑定：send → running；done → 解除 ── */
    const onSend = (): void => setComposerRunning(composer, true);
    const onDone = (): void => setComposerRunning(composer, false);
    composer.addEventListener('icen:ai-send', onSend);
    document.addEventListener('icen:ai-done', onDone);
    disposers.push(() => {
      composer.removeEventListener('icen:ai-send', onSend);
      document.removeEventListener('icen:ai-done', onDone);
    });
  }

  return {
    unbind(): void {
      for (const dispose of disposers) dispose();
      disposers.length = 0;
      BOUND.delete(composer);
    },
  };
}
