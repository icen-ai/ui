/*
 * @icen.ai/ui — Behavior: ai-provider（provider 适配层：填入 key 即工作）
 *
 * 规格唯一事实源：docs/spec/ai-native.md §9。零依赖；全部 SSR 守卫；禁 innerHTML（无 DOM 操作，
 * 唯请求完成时于 document 派 icen:ai-usage 事件）。
 *
 * ── 注册表（§9.1，2026-10 调研值）──
 *   listAiProviders()             → 内置五家：openai / claude / deepseek / glm / kimi
 *   getAiProvider('kimi')         → 单家定义（baseURL/chatPath/wire/auth/extraHeaders/models/pricing/browserDirect）
 *   registerAiProvider(def)       → 第三方/自建网关注册（同 id 覆盖）
 *   estimateCost(usage, p, m)     → 按定价表估算成本（USD）；未命中定价返回 undefined（不猜价）
 *
 * ── 客户端（§9.2，多模态 §10）──
 *   const client = createAiClient({ provider: 'deepseek', apiKey, baseURL?, model?, onAudit?, auditor?, fetch? });
 *   client.config                 → 只读 { provider, baseURL, model }
 *   await client.chat(req)        → { text, usage（归一）, cost?, parts?（多模态回执）, finishReason?, raw? }
 *   const s = client.stream(req)  → AsyncIterable<AiStreamChunk> + cancel() + done: Promise<AiChatResult>
 *     for await (const c of s)    → { type:'text', delta } | { type:'done' } | { type:'error', message }
 *   · AiChatMessage.content 支持 string | AiContentPart[]（ai-core 标准化内容，多模态）：
 *     openai 族映射 text/image_url/input_audio/file(file_id)；anthropic 族映射 text/image/audio/document(pdf)
 *     + cache_control 断点（cacheControl: true 时本消息末块生效）；video 两族均诚实报不支持
 *   · role 'tool' + toolCallId：openai 族 → tool_call_id 消息；anthropic 族 → user 的 tool_result block（真回灌）
 *   · openai 族（OpenAI/DeepSeek/GLM/Kimi）：POST {baseURL}{chatPath}，Authorization: Bearer，
 *     流式自动注入 stream_options.include_usage（AI SDK 同款）；SSE 按空行分帧 + [DONE] 收尾，
 *     choices[].delta.content 累积
 *   · anthropic 族：POST /messages，x-api-key + anthropic-version + dangerous-direct-browser-access
 *     （后两个来自注册表 extraHeaders）；max_tokens 缺省 4096；system 从 messages 抽为顶层参数；
 *     SSE 按 event: 分派（content_block_delta 的 text_delta 出文本）；usage 取 message_start 的
 *     input 系 + message_delta 的 output（快照替换，不 += 累加）
 *   · 错误统一抛 AiProviderError { provider, status, type, message, raw }：
 *     OpenAI/DeepSeek error.{message,type}、Kimi 自有 type 枚举、GLM 业务码信封、
 *     Anthropic {type:'error',error:{type,message}} 双层包装均映射；非 2xx 读 body 解析；
 *     不支持的输入形态 type='unsupported'
 *   · CORS 诚实：浏览器直连失败（TypeError）且 browserDirect 非 'yes' 时，message 追加代理建议
 *
 * ── 审计（§9.3 / §12.2）──
 *   const auditor = createAiAuditor({ persist?: 'my-key'（localStorage）, max?: 100（环形） });
 *   auditor.log(entry) / list() / clear() / summary()（全量聚合 AiUsage）
 *   / totals()（{ usage, cost, requests, errors, avgTtftMs }）/ byModel()（provider/model 分组）
 *   client 每次请求自动产 AiAuditEntry（含 cost 定价估算 + ttftMs 首 token 延迟；onAudit 回调 +
 *   传 auditor 实例则自动 log）；请求完成在 document 派 icen:ai-usage（detail=归一 usage）与
 *   icen:ai-done（detail=AiDoneEventDetail：status/provider/model/usage/cost/error/durationMs/ttftMs，
 *   bubbles）——bindComposer 绑定层与用量面板监听即实时更新
 */

import {
  normalizeUsage,
  normalizeContentParts,
  contentToText,
  aiContentUrl,
  type AiUsage,
  type AiContent,
  type AiContentPart,
} from './ai-core';
import { emitIcen } from './events';

/* ════════════════════════════════════════════
   小工具（本地副本，与 ai-core 同语义）
   ════════════════════════════════════════════ */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickStr(src: unknown, keys: string[]): string | undefined {
  if (!isObj(src)) return undefined;
  for (const k of keys) {
    const v = src[k];
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

function pickNum(src: unknown, keys: string[]): number | undefined {
  if (!isObj(src)) return undefined;
  for (const k of keys) {
    const v = src[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

function compactNums(v: Record<string, number | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) if (n != null) out[k] = n;
  return out;
}

let idSeq = 0;
/** 审计 id：时间戳 + 递增序号 + 随机缀，无外部依赖（crypto 非处处可用） */
function genEntryId(): string {
  idSeq = (idSeq + 1) % 46656;
  return `ai-${Date.now().toString(36)}-${idSeq.toString(36).padStart(3, '0')}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function isAbortError(e: unknown): boolean {
  /* DOMException（浏览器/undici 的 AbortError）在现代引擎里不一定是 Error 实例，认 name */
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';
}

/* ════════════════════════════════════════════
   注册表（§9.1）
   ════════════════════════════════════════════ */

export interface AiProviderModel {
  id: string;
  label: string;
  /** 上下文窗口 token 数（模型选择弹层展示如 1M） */
  context?: number;
  /** 单次输出上限 token 数 */
  outputLimit?: number;
  /** 定价（USD / MTok，2026-10 调研近似值）；缺省 = 不猜价（estimateCost 返回 undefined） */
  pricing?: AiPricing;
}

/** 定价（USD / MTok）：cacheRead 缺省按 input 价；cacheWrite 缺省按 input × 1.25（cache 写溢价惯例） */
export interface AiPricing {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface AiProviderDef {
  id: string;
  label: string;
  /** 单色 svg 字母章（渲染时经 ai-core svgIcon() 消毒） */
  icon: string;
  /** 默认 API 基址；createAiClient 可覆盖（自定义网关/代理是一等公民） */
  baseURL: string;
  /** /chat/completions | /messages */
  chatPath: string;
  /** 线协议族：openai 族（OpenAI/DeepSeek/GLM/Kimi）| anthropic 族 */
  wire: 'openai' | 'anthropic';
  /** bearer → Authorization: Bearer；x-api-key → x-api-key 头 */
  auth: 'bearer' | 'x-api-key';
  /** 附加请求头（如 anthropic-version / dangerous-direct-browser-access） */
  extraHeaders?: Record<string, string>;
  models: AiProviderModel[];
  /** 浏览器直连 CORS：'yes'（Anthropic 官方支持）/ 'no'（OpenAI 官方禁止）/ 'unknown'（无承诺，建议代理） */
  browserDirect: 'yes' | 'no' | 'unknown';
}

/* 单色字母章：圆 + 居中字母（消费 currentColor），渲染侧经 svgIcon() 消毒 */
const letterBadge = (ch: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9.4"/><text x="12" y="15.9" text-anchor="middle" font-size="10.5" font-weight="600" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor" stroke="none">${ch}</text></svg>`;

/* 内置五家（2026-10 调研值；顺序即默认模型——models[0]） */
const BUILTIN_PROVIDERS: readonly AiProviderDef[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    icon: letterBadge('O'),
    baseURL: 'https://api.openai.com/v1',
    chatPath: '/chat/completions',
    wire: 'openai',
    auth: 'bearer',
    browserDirect: 'no', // 官方禁止浏览器直连（CORS + 安全策略）
    models: [
      { id: 'gpt-5', label: 'GPT-5', context: 400_000, outputLimit: 128_000, pricing: { input: 1.25, output: 10, cacheRead: 0.125 } },
      { id: 'gpt-5-mini', label: 'GPT-5 Mini', context: 400_000, outputLimit: 128_000, pricing: { input: 0.25, output: 2, cacheRead: 0.025 } },
      { id: 'gpt-5.1', label: 'GPT-5.1', context: 400_000, outputLimit: 128_000, pricing: { input: 1.25, output: 10, cacheRead: 0.125 } },
      { id: 'gpt-5.5', label: 'GPT-5.5', context: 1_000_000, outputLimit: 128_000, pricing: { input: 2, output: 12, cacheRead: 0.2 } },
    ],
  },
  {
    id: 'claude',
    label: 'Claude',
    icon: letterBadge('C'),
    baseURL: 'https://api.anthropic.com/v1',
    chatPath: '/messages',
    wire: 'anthropic',
    auth: 'x-api-key',
    extraHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    browserDirect: 'yes', // 官方支持浏览器直连（CORS 白名单）
    models: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', context: 500_000, outputLimit: 64_000, pricing: { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 } },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', context: 500_000, outputLimit: 64_000, pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 } },
      { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', context: 200_000, outputLimit: 64_000, pricing: { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 } },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', context: 200_000, outputLimit: 64_000, pricing: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 } },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: letterBadge('D'),
    baseURL: 'https://api.deepseek.com/v1',
    chatPath: '/chat/completions',
    wire: 'openai',
    auth: 'bearer',
    browserDirect: 'unknown', // 无承诺，建议代理
    models: [
      { id: 'deepseek-flash', label: 'DeepSeek Flash', context: 128_000, outputLimit: 8_000, pricing: { input: 0.14, output: 0.28, cacheRead: 0.014 } },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', context: 1_000_000, outputLimit: 128_000, pricing: { input: 0.55, output: 1.1, cacheRead: 0.055 } },
    ],
  },
  {
    id: 'glm',
    label: 'GLM（智谱）',
    icon: letterBadge('G'),
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    chatPath: '/chat/completions',
    wire: 'openai',
    auth: 'bearer', // API key 直接当 Bearer；JWT 可选不做
    browserDirect: 'unknown',
    models: [
      { id: 'glm-5.3', label: 'GLM-5.3', context: 200_000, outputLimit: 128_000, pricing: { input: 0.55, output: 2.2, cacheRead: 0.055 } },
      { id: 'glm-5.3-flash', label: 'GLM-5.3 Flash', context: 128_000, outputLimit: 64_000, pricing: { input: 0.14, output: 0.55, cacheRead: 0.014 } },
      { id: 'glm-5.2', label: 'GLM-5.2', context: 128_000, outputLimit: 64_000, pricing: { input: 0.5, output: 3, cacheRead: 0.05 } },
      { id: 'glm-4.6', label: 'GLM-4.6', context: 200_000, outputLimit: 128_000, pricing: { input: 0.6, output: 2.2, cacheRead: 0.06 } },
    ],
  },
  {
    id: 'kimi',
    label: 'Kimi（月之暗面）',
    icon: letterBadge('K'),
    baseURL: 'https://api.moonshot.cn/v1',
    chatPath: '/chat/completions',
    wire: 'openai',
    auth: 'bearer',
    browserDirect: 'unknown',
    models: [
      { id: 'kimi-k3', label: 'Kimi K3', context: 1_000_000, outputLimit: 128_000, pricing: { input: 3, output: 15, cacheRead: 0.3 } },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', context: 256_000, outputLimit: 128_000, pricing: { input: 1.1, output: 3.3, cacheRead: 0.11 } },
      { id: 'kimi-k2.6', label: 'Kimi K2.6', context: 256_000, outputLimit: 128_000, pricing: { input: 0.95, output: 3, cacheRead: 0.1 } },
    ],
  },
];

const providerRegistry = new Map<string, AiProviderDef>(BUILTIN_PROVIDERS.map((d) => [d.id, d]));

/** 注册（或覆盖）一个 provider；第三方/自建网关注册入口。 */
export function registerAiProvider(def: AiProviderDef): void {
  if (def && typeof def.id === 'string' && def.id) providerRegistry.set(def.id, def);
}

/** 取 provider 定义；未注册返回 undefined。 */
export function getAiProvider(id: string): AiProviderDef | undefined {
  return providerRegistry.get(id);
}

/** 全部已注册 provider（副本数组，内置在前）。 */
export function listAiProviders(): AiProviderDef[] {
  return Array.from(providerRegistry.values());
}

/* ════════════════════════════════════════════
   定价估算（spec §12.1；未命中定价返回 undefined，不猜价）
   ════════════════════════════════════════════ */

/** 按注册表定价估算一次用量的成本（USD）：cacheRead 缺省按 input 价、cacheWrite 缺省按 input × 1.25。 */
export function estimateCost(usage: AiUsage, provider: string, model: string): number | undefined {
  const p = getAiProvider(provider)?.models.find((m) => m.id === model)?.pricing;
  if (!p) return undefined;
  const u = normalizeUsage(usage);
  const cost =
    ((u.input ?? 0) / 1e6) * p.input +
    ((u.output ?? 0) / 1e6) * p.output +
    ((u.cacheRead ?? 0) / 1e6) * (p.cacheRead ?? p.input) +
    ((u.cacheWrite ?? 0) / 1e6) * (p.cacheWrite ?? p.input * 1.25);
  return Math.round(cost * 1e6) / 1e6;
}

/* ════════════════════════════════════════════
   错误归一（§9.2）
   ════════════════════════════════════════════ */

export class AiProviderError extends Error {
  readonly provider: string;
  /** HTTP 状态码；网络层失败为 0 */
  readonly status: number;
  /** 归一错误类型：provider 的 error.type/code，或 network / cancelled / parse / http_error */
  readonly type: string;
  /** 原始错误体（HTTP body / 异常对象），排障用 */
  readonly raw?: unknown;

  constructor(init: { provider: string; status: number; type: string; message: string; raw?: unknown }) {
    super(init.message);
    this.name = 'AiProviderError';
    this.provider = init.provider;
    this.status = init.status;
    this.type = init.type;
    this.raw = init.raw;
  }
}

/* 非 2xx body 提取（GLM 业务码信封、Kimi 自有 type、Anthropic 双层包装均映射）：
   OpenAI/DeepSeek/Kimi { error: { message, type? } }；GLM { error: { code, message } } 或旧版 { code, msg }；
   Anthropic { type: 'error', error: { type, message } }（取内层，外层 'error' 只是包装）。 */
function extractHttpError(raw: unknown, status: number): { type: string; message: string } {
  const e = isObj(raw) && isObj(raw.error) ? raw.error : isObj(raw) ? raw : undefined;
  const message =
    pickStr(e, ['message', 'msg', 'error_description']) ??
    (typeof raw === 'string' && raw ? raw : '') ??
    `HTTP ${status}`;
  /* GLM 业务码信封：code 是字符串业务码（旧版为数字），type 缺省时以 code 充任 */
  const rawCode = e?.code;
  const code =
    typeof rawCode === 'string' && rawCode
      ? rawCode
      : typeof rawCode === 'number' && Number.isFinite(rawCode)
        ? String(rawCode)
        : undefined;
  const type = pickStr(e, ['type']) ?? code ?? 'http_error';
  return { type, message };
}

async function readHttpError(res: Response, provider: string): Promise<AiProviderError> {
  const status = res.status;
  let raw: unknown;
  let text = '';
  try {
    text = await res.text();
  } catch {
    /* body 不可读 */
  }
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }
  }
  const { type, message } = extractHttpError(raw, status);
  return new AiProviderError({ provider, status, type, message, raw });
}

/* ════════════════════════════════════════════
   审计（§9.3）
   ════════════════════════════════════════════ */

export interface AiAuditEntry {
  id: string;
  /** epoch 毫秒 */
  ts: number;
  provider: string;
  model: string;
  baseURL: string;
  /** 是否流式请求 */
  stream: boolean;
  status: 'ok' | 'error';
  durationMs: number;
  /** 首 token 延迟（流式；非流式缺省） */
  ttftMs?: number;
  /** 本次成本（USD，定价表命中时） */
  cost?: number;
  /** 归一 usage（错误且无用量信息时缺省） */
  usage?: AiUsage;
  /** 错误信息（含取消：'请求已取消'） */
  error?: string;
}

/** 审计聚合汇总（spec §12.2） */
export interface AiAuditTotals {
  usage: AiUsage;
  cost: number;
  requests: number;
  errors: number;
  /** 平均首 token 延迟（有 ttft 记录的条目） */
  avgTtftMs?: number;
}

export interface AiAuditor {
  log(entry: AiAuditEntry): void;
  /** 全部记录（时间升序，副本） */
  list(): AiAuditEntry[];
  clear(): void;
  /** 全量聚合（各段求和）——直接喂 renderAiUsage / renderAiUsageRing */
  summary(): AiUsage;
  /** 完整汇总：usage + cost + 计数 + 平均 TTFT——喂 renderAiAudit 的 totals 行 */
  totals(): AiAuditTotals;
  /** 按 `${provider}/${model}` 分组聚合 */
  byModel(): Record<string, AiUsage>;
}

export interface AiAuditorOptions {
  /** localStorage key：给则持久化（写读该 key）；SSR/隐私模式下静默降级为内存环形 */
  persist?: string;
  /** 环形上限，默认 100；超出丢弃最旧 */
  max?: number;
}

const USAGE_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'total'] as const;

function addUsage(sum: AiUsage, u?: AiUsage): AiUsage {
  if (!u) return sum;
  for (const k of USAGE_KEYS) {
    const v = u[k];
    if (typeof v === 'number' && Number.isFinite(v)) sum[k] = ((sum[k] as number | undefined) ?? 0) + v;
  }
  return sum;
}

function isAuditEntry(v: unknown): v is AiAuditEntry {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.ts === 'number' &&
    typeof v.provider === 'string' &&
    typeof v.model === 'string' &&
    typeof v.baseURL === 'string' &&
    typeof v.stream === 'boolean' &&
    (v.status === 'ok' || v.status === 'error') &&
    typeof v.durationMs === 'number'
  );
}

/** 环形审计器：max 条封顶；persist 给 localStorage key 则写读它（SSR 安全）。 */
export function createAiAuditor(opts?: AiAuditorOptions): AiAuditor {
  const max = Math.max(1, Math.floor(opts?.max ?? 100));
  const persistKey = opts?.persist;
  let entries: AiAuditEntry[] = [];

  const storage = (): Storage | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null; // 隐私模式等
    }
  };

  if (persistKey) {
    try {
      const raw = storage()?.getItem(persistKey);
      const parsed: unknown = raw ? JSON.parse(raw) : undefined;
      if (Array.isArray(parsed)) entries = parsed.filter(isAuditEntry).slice(-max);
    } catch {
      /* 损坏的持久化数据静默丢弃 */
    }
  }

  const save = (): void => {
    if (!persistKey) return;
    try {
      storage()?.setItem(persistKey, JSON.stringify(entries));
    } catch {
      /* 配额满/隐私模式：内存环形仍工作 */
    }
  };

  return {
    log(entry) {
      entries.push(entry);
      if (entries.length > max) entries.splice(0, entries.length - max);
      save();
    },
    list() {
      return entries.slice();
    },
    clear() {
      entries = [];
      save();
    },
    summary() {
      const sum: AiUsage = {};
      for (const e of entries) addUsage(sum, e.usage);
      return sum;
    },
    totals() {
      const usage: AiUsage = {};
      let cost = 0;
      let errors = 0;
      let ttftSum = 0;
      let ttftN = 0;
      for (const e of entries) {
        addUsage(usage, e.usage);
        if (typeof e.cost === 'number') cost += e.cost;
        if (e.status === 'error') errors++;
        if (typeof e.ttftMs === 'number') {
          ttftSum += e.ttftMs;
          ttftN++;
        }
      }
      const totals: AiAuditTotals = {
        usage,
        cost: Math.round(cost * 1e6) / 1e6,
        requests: entries.length,
        errors,
      };
      if (ttftN > 0) totals.avgTtftMs = Math.round(ttftSum / ttftN);
      return totals;
    },
    byModel() {
      const out: Record<string, AiUsage> = {};
      for (const e of entries) {
        const key = `${e.provider}/${e.model}`;
        addUsage((out[key] ??= {}), e.usage);
      }
      return out;
    },
  };
}

/* ════════════════════════════════════════════
   请求 / 响应模型（§9.2）
   ════════════════════════════════════════════ */

export type AiChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiChatMessage {
  role: AiChatRole;
  /** 标准化内容（spec §10）：字符串（纯文本）或 AiContentPart[]（多模态） */
  content: AiContent;
  /** role 'tool' 时必填：openai 族 → tool_call_id；anthropic 族 → 映射为 user 的 tool_result block（真回灌） */
  toolCallId?: string;
  /** anthropic 族：本消息末块打 cache_control 断点（prompt 缓存一等公民）；openai 族自动缓存、忽略 */
  cacheControl?: boolean;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  /** 覆盖客户端默认模型 */
  model?: string;
  temperature?: number;
  /** anthropic 族必填（API 层），缺省 4096 */
  maxTokens?: number;
  /** 外部中止信号（与 stream 会话的 cancel() 叠加生效） */
  signal?: AbortSignal;
}

export interface AiChatResult {
  text: string;
  /** ai-core normalizeUsage 归一；无任何用量信息时为 {} */
  usage: AiUsage;
  /** 定价表命中时的本次成本（USD） */
  cost?: number;
  /** 响应内容部件（非流式且响应为 content parts 数组时归一出，含图/文件等多模态回执） */
  parts?: AiContentPart[];
  finishReason?: string;
  /** 原始 usage 对象（流式=最终快照；排障用） */
  raw?: unknown;
}

export type AiStreamChunk =
  | { type: 'text'; delta: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface AiStreamSession extends AsyncIterable<AiStreamChunk> {
  /** 中止本次流式请求（幂等）；done 会以已累积的部分结果结算 */
  cancel(): void;
  /** 流式完成后结算：始终 resolve（含错误/取消，text/usage 为已累积部分） */
  done: Promise<AiChatResult>;
}

export interface AiClientConfig {
  readonly provider: string;
  readonly baseURL: string;
  readonly model: string;
}

export interface AiClientOptions {
  /** 注册表 id（listAiProviders/getAiProvider 可查）；未注册抛错 */
  provider: string;
  apiKey: string;
  /** 覆盖 provider 默认基址（自定义网关/代理） */
  baseURL?: string;
  /** 缺省取 provider.models[0].id */
  model?: string;
  /** 每次请求产出审计记录（回调形式） */
  onAudit?: (entry: AiAuditEntry) => void;
  /** 传 auditor 实例则每次请求自动 log */
  auditor?: AiAuditor;
  /** mock fetch 注入（AI SDK 同款）——单测与文档站离线 demo 用 */
  fetch?: typeof fetch;
}

export interface AiClient {
  chat(req: AiChatRequest): Promise<AiChatResult>;
  stream(req: AiChatRequest): AiStreamSession;
  readonly config: AiClientConfig;
}

/* ════════════════════════════════════════════
   SSE 解析器两套（§9.2：缓冲按空行切，不按 read 边界）
   ════════════════════════════════════════════ */

/** SSE 一帧（data: 必有；event: 可选） */
interface SseFrame {
  event?: string;
  data: string;
}

/** 解析器 → pump 的内部事件 */
type StreamEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'usage'; usage: unknown }
  | { kind: 'finish'; reason?: string }
  | { kind: 'error'; type: string; message: string };

/** 一帧 = 多行；收集 data:/event: 行（跳过注释与 id:/retry:），data 多行以 \n 拼接 */
function parseSseFrame(raw: string): SseFrame | undefined {
  if (!raw.trim()) return undefined;
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    } else if (line.startsWith('event:')) {
      event = line.slice(6).replace(/^ /, '') || undefined;
    }
    /* id: / retry: 等行忽略 */
  }
  const data = dataLines.join('\n');
  if (!data) return undefined;
  return event ? { event, data } : { data };
}

/**
 * SSE 帧迭代器：缓冲按空行（\r?\n\r?\n）切分，不按 read 边界；
 * 优先走 res.body 增量读取（真流式），body 缺失时退回整段 arrayBuffer。
 * signal 竞速：真实 fetch 中止会 error 掉 body，这里再叠一层，兼容不 error body 的环境。
 */
async function* iterateSse(res: Response, signal?: AbortSignal): AsyncGenerator<SseFrame> {
  const decoder = new TextDecoder();
  let buf = '';
  const drain = function* (): Generator<SseFrame> {
    for (;;) {
      const m = /\r?\n\r?\n/.exec(buf);
      if (!m) break;
      const raw = buf.slice(0, m.index);
      buf = buf.slice(m.index + m[0].length);
      const frame = parseSseFrame(raw);
      if (frame) yield frame;
    }
  };

  if (res.body) {
    const reader = res.body.getReader();
    let onAbort: (() => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => {
      onAbort = () => {
        const e = new Error('Aborted');
        e.name = 'AbortError';
        reject(e);
      };
      if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }
    });
    abortPromise.catch(() => {}); // 读取循环已结束后触发也不产生 unhandledRejection
    try {
      for (;;) {
        const { done, value } = await Promise.race([reader.read(), abortPromise]);
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        yield* drain();
      }
      buf += decoder.decode();
    } finally {
      if (onAbort && signal) signal.removeEventListener('abort', onAbort);
      try {
        reader.releaseLock();
      } catch {
        /* 已中断的流忽略 */
      }
    }
  } else {
    buf += decoder.decode(await res.arrayBuffer());
  }
  const tail = parseSseFrame(buf);
  if (tail) yield tail;
}

/* openai 族（OpenAI/DeepSeek/GLM/Kimi）：data: 帧 + [DONE] 收尾；
   choices[].delta.content 出文本；usage 由末帧（choices: []）携带（include_usage 的回报） */
async function* parseOpenAiStream(res: Response, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  for await (const frame of iterateSse(res, signal)) {
    if (frame.data === '[DONE]') return;
    let j: unknown;
    try {
      j = JSON.parse(frame.data);
    } catch {
      continue; // 半帧/坏帧跳过
    }
    if (!isObj(j)) continue;
    const choice = Array.isArray(j.choices) && isObj(j.choices[0]) ? j.choices[0] : undefined;
    if (choice) {
      const delta = isObj(choice.delta) ? choice.delta : undefined;
      if (delta && typeof delta.content === 'string' && delta.content) {
        yield { kind: 'text', delta: delta.content };
      }
      if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
        yield { kind: 'finish', reason: choice.finish_reason };
      }
    }
    if (j.usage != null) yield { kind: 'usage', usage: j.usage };
  }
}

/* anthropic 族：event: 分派；usage 取 message_start 的 input 系 + message_delta 的
   output（快照替换，不 += 累加）；error 事件产出后结束 */
async function* parseAnthropicStream(res: Response, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  let usage: Record<string, number> = {};
  for await (const frame of iterateSse(res, signal)) {
    let j: unknown;
    try {
      j = JSON.parse(frame.data);
    } catch {
      continue;
    }
    if (!isObj(j)) continue;
    const type = (typeof j.type === 'string' && j.type) || frame.event || '';
    if (type === 'message_start') {
      const u = isObj(j.message) && isObj(j.message.usage) ? j.message.usage : undefined;
      if (u) {
        usage = compactNums({
          input_tokens: pickNum(u, ['input_tokens']),
          cache_read_input_tokens: pickNum(u, ['cache_read_input_tokens']),
          cache_creation_input_tokens: pickNum(u, ['cache_creation_input_tokens']),
        });
        if (Object.keys(usage).length) yield { kind: 'usage', usage };
      }
    } else if (type === 'content_block_delta') {
      const d = isObj(j.delta) ? j.delta : undefined;
      if (d && d.type === 'text_delta' && typeof d.text === 'string' && d.text) {
        yield { kind: 'text', delta: d.text };
      }
    } else if (type === 'message_delta') {
      const d = isObj(j.delta) ? j.delta : undefined;
      if (d && typeof d.stop_reason === 'string' && d.stop_reason) {
        yield { kind: 'finish', reason: d.stop_reason };
      }
      const u = isObj(j.usage) ? j.usage : undefined;
      const out = u ? pickNum(u, ['output_tokens']) : undefined;
      if (out != null) {
        usage = { ...usage, output_tokens: out };
        yield { kind: 'usage', usage };
      }
    } else if (type === 'message_stop') {
      return;
    } else if (type === 'error') {
      const e = isObj(j.error) ? j.error : undefined;
      yield {
        kind: 'error',
        type: pickStr(e, ['type']) ?? 'stream_error',
        message: pickStr(e, ['message']) ?? '流式响应错误',
      };
      return;
    }
    /* ping / content_block_start / content_block_stop 等忽略 */
  }
}

/* ════════════════════════════════════════════
   请求组装（多模态内容映射，spec §9.2 / §10）
   ════════════════════════════════════════════ */

function unsupported(provider: string, what: string): AiProviderError {
  return new AiProviderError({
    provider,
    status: 0,
    type: 'unsupported',
    message: `${provider} 线协议不支持 ${what}`,
  });
}

/** parts → openai 族 content（字符串捷径直取；部件逐项映射，video 诚实报不支持） */
function toOpenAiContent(provider: string, content: AiContent): string | unknown[] {
  if (typeof content === 'string') return content;
  const out: unknown[] = [];
  for (const part of content) {
    if (part.type === 'text') {
      out.push({ type: 'text', text: part.text });
    } else if (part.type === 'image') {
      const url = aiContentUrl(part);
      if (url) out.push({ type: 'image_url', image_url: { url } });
    } else if (part.type === 'audio') {
      if (!part.data) throw unsupported(provider, '仅 URL 的音频（input_audio 需 base64，请先取回内联）');
      const format = (part.mimeType ?? 'audio/wav').split('/')[1] ?? 'wav';
      out.push({ type: 'input_audio', input_audio: { data: part.data, format } });
    } else if (part.type === 'video') {
      throw unsupported(provider, 'video 输入（无主流 chat API 支持）');
    } else if (part.type === 'file') {
      /* url 槽承载 file_id（Files API 上传产物） */
      if (!part.url) throw unsupported(provider, 'base64 文件（file 部件需 Files API file_id，请置于 url 槽）');
      out.push({ type: 'file', file: { file_id: part.url } });
    } else {
      out.push({ type: 'text', text: `[资源] ${part.name ?? ''} (${part.uri})`.trim() });
    }
  }
  return out;
}

/** parts → anthropic 族 content blocks（document 支持 pdf；video 诚实报不支持） */
function toAnthropicBlocks(provider: string, content: AiContent): unknown[] {
  if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : [];
  const out: Array<Record<string, unknown>> = [];
  for (const part of content) {
    if (part.type === 'text') {
      out.push({ type: 'text', text: part.text });
    } else if (part.type === 'image') {
      const source = part.url
        ? { type: 'url', url: part.url }
        : { type: 'base64', media_type: part.mimeType ?? 'image/png', data: part.data ?? '' };
      out.push({ type: 'image', source });
    } else if (part.type === 'audio') {
      if (!part.data) throw unsupported(provider, '仅 URL 的音频（audio 块需 base64 source）');
      out.push({ type: 'audio', source: { type: 'base64', media_type: part.mimeType ?? 'audio/wav', data: part.data } });
    } else if (part.type === 'video') {
      throw unsupported(provider, 'video 输入');
    } else if (part.type === 'file') {
      const mime = part.mimeType ?? 'application/pdf';
      if (mime !== 'application/pdf') throw unsupported(provider, `非 PDF 文件块（document 块为 application/pdf，收到 ${mime}）`);
      const source = part.url
        ? { type: 'url', url: part.url }
        : { type: 'base64', media_type: mime, data: part.data ?? '' };
      out.push({ type: 'document', source });
    } else {
      out.push({ type: 'text', text: `[资源] ${part.name ?? ''} (${part.uri})`.trim() });
    }
  }
  return out;
}

function buildOpenAiBody(provider: string, req: AiChatRequest, model: string, streaming: boolean): Record<string, unknown> {
  const messages = req.messages.map((m) => {
    if (m.role === 'tool') {
      if (!m.toolCallId) throw unsupported(provider, "role 'tool' 且缺 toolCallId（openai 族需 tool_call_id）");
      return { role: 'tool', content: contentToText(m.content), tool_call_id: m.toolCallId };
    }
    return { role: m.role, content: toOpenAiContent(provider, m.content) };
  });
  const body: Record<string, unknown> = { model, messages, stream: streaming };
  if (req.temperature != null) body.temperature = req.temperature;
  if (req.maxTokens != null) body.max_tokens = req.maxTokens;
  /* AI SDK 同款：流式自动注入，末帧才带 usage */
  if (streaming) body.stream_options = { include_usage: true };
  return body;
}

/* anthropic：system 从 messages 抽为顶层参数（多段空行拼接；末段带 cacheControl 时用块数组形态打断点）；
   role 'tool' + toolCallId 映射为 user 的 tool_result block（对话真回灌）；max_tokens 必填，缺省 4096 */
function buildAnthropicBody(provider: string, req: AiChatRequest, model: string, streaming: boolean): Record<string, unknown> {
  const systemMsgs = req.messages.filter((m) => m.role === 'system');
  const system = systemMsgs.map((m) => contentToText(m.content)).join('\n\n');
  const messages = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        if (!m.toolCallId) throw unsupported(provider, "role 'tool' 且缺 toolCallId（anthropic 族映射 tool_result 需 tool_use_id）");
        return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: toAnthropicBlocks(provider, m.content) }] };
      }
      const blocks = toAnthropicBlocks(provider, m.content) as Array<Record<string, unknown>>;
      if (m.cacheControl && blocks.length > 0) blocks[blocks.length - 1]!.cache_control = { type: 'ephemeral' };
      return { role: m.role as 'user' | 'assistant', content: blocks };
    });
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: req.maxTokens ?? 4096,
  };
  if (system) {
    body.system = systemMsgs.some((m) => m.cacheControl)
      ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
      : system;
  }
  if (req.temperature != null) body.temperature = req.temperature;
  if (streaming) body.stream = true;
  return body;
}

function buildHeaders(def: AiProviderDef, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  for (const [k, v] of Object.entries(def.extraHeaders ?? {})) headers[k] = v;
  if (def.auth === 'x-api-key') headers['x-api-key'] = apiKey;
  else headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

/* ac 与外部 signal 任一 abort 即 abort（组合，互不覆盖） */
function joinSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  const c = new AbortController();
  if (a.aborted || b.aborted) {
    c.abort();
    return c.signal;
  }
  const fwd = (): void => {
    if (!c.signal.aborted) c.abort();
  };
  a.addEventListener('abort', fwd, { once: true });
  b.addEventListener('abort', fwd, { once: true });
  return c.signal;
}

/** 请求完成即在 document 派 icen:ai-usage（detail=归一 usage，bubbles）——环/面板监听即实时更新 */
function dispatchUsageEvent(usage: AiUsage): void {
  if (typeof document === 'undefined') return;
  try {
    emitIcen(document, 'icen:ai-usage', usage);
  } catch {
    /* 非 DOM 环境静默 */
  }
}

/** icen:ai-done 的 detail（spec §5；绑定层 bindComposer 的驱动事件） */
export interface AiDoneEventDetail {
  status: 'ok' | 'error' | 'cancelled';
  provider: string;
  model: string;
  stream: boolean;
  usage?: AiUsage;
  cost?: number;
  error?: string;
  durationMs: number;
  ttftMs?: number;
}

/** 请求收尾在 document 派 icen:ai-done（chat 与 stream 的 finally 均派；bubbles） */
function dispatchDoneEvent(detail: AiDoneEventDetail): void {
  if (typeof document === 'undefined') return;
  try {
    emitIcen(document, 'icen:ai-done', detail);
  } catch {
    /* 非 DOM 环境静默 */
  }
}

/* ════════════════════════════════════════════
   客户端（§9.2）
   ════════════════════════════════════════════ */

export function createAiClient(options: AiClientOptions): AiClient {
  const lookedUp = getAiProvider(options.provider);
  if (!lookedUp) {
    throw new Error(`[ai-provider] 未注册的 provider: ${options.provider}（可用：${listAiProviders()
      .map((d) => d.id)
      .join(' / ')}）`);
  }
  const def: AiProviderDef = lookedUp;
  const baseURL = (options.baseURL ?? def.baseURL).replace(/\/+$/, '');
  const chatPath = def.chatPath.startsWith('/') ? def.chatPath : `/${def.chatPath}`;
  const url = `${baseURL}${chatPath}`;
  const defaultModel = options.model ?? def.models[0]?.id ?? '';
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));

  /** 异常归一：AiProviderError 透传；AbortError → cancelled；其余 → network（TypeError 追加 CORS 建议） */
  const normalizeThrown = (err: unknown): AiProviderError => {
    if (err instanceof AiProviderError) return err;
    if (isAbortError(err)) {
      return new AiProviderError({ provider: def.id, status: 0, type: 'cancelled', message: '请求已取消', raw: err });
    }
    const msg = err instanceof Error ? err.message : String(err);
    /* CORS 诚实：浏览器直连失败（TypeError）且 provider 未承诺支持时，建议走代理 */
    const corsHint =
      err instanceof TypeError && def.browserDirect !== 'yes'
        ? `；浏览器直连 ${def.label}（${def.baseURL}）很可能被 CORS 拦截，建议经代理/自建网关转发`
        : '';
    return new AiProviderError({
      provider: def.id,
      status: 0,
      type: 'network',
      message: `网络请求失败：${msg}${corsHint}`,
      raw: err,
    });
  };

  async function post(req: AiChatRequest, streaming: boolean, signal?: AbortSignal): Promise<Response> {
    const model = req.model ?? defaultModel;
    const body =
      def.wire === 'anthropic'
        ? buildAnthropicBody(def.id, req, model, streaming)
        : buildOpenAiBody(def.id, req, model, streaming);
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: buildHeaders(def, options.apiKey),
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw normalizeThrown(err);
    }
    if (!res.ok) throw await readHttpError(res, def.id);
    return res;
  }

  function audit(
    req: AiChatRequest,
    streaming: boolean,
    status: 'ok' | 'error',
    usage: AiUsage,
    durationMs: number,
    error?: string,
    ttftMs?: number,
  ): { entry: AiAuditEntry; cost?: number } {
    const model = req.model ?? defaultModel;
    const cost = estimateCost(usage, def.id, model);
    const entry: AiAuditEntry = {
      id: genEntryId(),
      ts: Date.now(),
      provider: def.id,
      model,
      baseURL,
      stream: streaming,
      status,
      durationMs,
      ttftMs,
      cost,
      usage: Object.keys(usage).length > 0 ? usage : undefined,
      error,
    };
    try {
      options.onAudit?.(entry);
      options.auditor?.log(entry);
    } catch {
      /* 审计回调自身异常不影响主流程 */
    }
    return { entry, cost };
  }

  const publishUsage = (usage: AiUsage): void => {
    if (Object.keys(usage).length > 0) dispatchUsageEvent(usage);
  };

  async function chat(req: AiChatRequest): Promise<AiChatResult> {
    const t0 = Date.now();
    try {
      const res = await post(req, false, req.signal);
      const text = await res.text();
      let j: unknown;
      try {
        j = text ? JSON.parse(text) : undefined;
      } catch {
        throw new AiProviderError({ provider: def.id, status: res.status, type: 'parse', message: '响应不是合法 JSON', raw: text });
      }
      if (j === undefined) {
        throw new AiProviderError({ provider: def.id, status: res.status, type: 'parse', message: '响应为空', raw: text });
      }

      let outText = '';
      let outParts: AiContentPart[] | undefined;
      let finishReason: string | undefined;
      let usageRaw: unknown;
      if (isObj(j)) {
        if (def.wire === 'anthropic') {
          const blocks = Array.isArray(j.content) ? j.content : [];
          outParts = normalizeContentParts(blocks);
          outText = contentToText(outParts);
          finishReason = pickStr(j, ['stop_reason']);
        } else {
          const choice = Array.isArray(j.choices) && isObj(j.choices[0]) ? j.choices[0] : undefined;
          const message = choice && isObj(choice.message) ? choice.message : undefined;
          const content = message?.content;
          if (typeof content === 'string') {
            outText = content;
          } else if (Array.isArray(content)) {
            outParts = normalizeContentParts(content);
            outText = contentToText(outParts);
          }
          finishReason = choice ? pickStr(choice, ['finish_reason']) : undefined;
        }
        usageRaw = j.usage;
      }
      const usage = normalizeUsage(usageRaw);
      publishUsage(usage);
      const { cost } = audit(req, false, 'ok', usage, Date.now() - t0);
      dispatchDoneEvent({
        status: 'ok',
        provider: def.id,
        model: req.model ?? defaultModel,
        stream: false,
        usage,
        cost,
        durationMs: Date.now() - t0,
      });
      const result: AiChatResult = { text: outText, usage, cost, finishReason, raw: j };
      if (outParts && outParts.length > 0) result.parts = outParts;
      return result;
    } catch (err) {
      const e = normalizeThrown(err);
      audit(req, false, 'error', {}, Date.now() - t0, e.message);
      dispatchDoneEvent({
        status: e.type === 'cancelled' ? 'cancelled' : 'error',
        provider: def.id,
        model: req.model ?? defaultModel,
        stream: false,
        error: e.message,
        durationMs: Date.now() - t0,
      });
      throw e;
    }
  }

  function stream(req: AiChatRequest): AiStreamSession {
    const ac = new AbortController();
    const signal = joinSignals(ac.signal, req.signal);
    const chunks: AiStreamChunk[] = [];
    const waiters: Array<() => void> = [];
    let finished = false;

    let resolveDone!: (r: AiChatResult) => void;
    const done: Promise<AiChatResult> = new Promise((res) => {
      resolveDone = res;
    });

    const notify = (): void => {
      const w = waiters.splice(0, waiters.length);
      for (const fn of w) fn();
    };
    const push = (c: AiStreamChunk): void => {
      chunks.push(c);
      notify();
    };

    /* eager start：stream() 即发起请求（背压以内存缓冲为代价，chat 量级可接受） */
    void (async () => {
      const t0 = Date.now();
      let text = '';
      let finishReason: string | undefined;
      let usageRaw: unknown;
      let status: 'ok' | 'error' = 'ok';
      let error: string | undefined;
      let errorType: string | undefined;
      let ttftMs: number | undefined;
      try {
        const res = await post(req, true, signal);
        const events =
          def.wire === 'anthropic' ? parseAnthropicStream(res, signal) : parseOpenAiStream(res, signal);
        for await (const ev of events) {
          if (ev.kind === 'text') {
            if (ttftMs == null) ttftMs = Date.now() - t0;
            text += ev.delta;
            push({ type: 'text', delta: ev.delta });
          } else if (ev.kind === 'usage') {
            usageRaw = ev.usage; // 快照替换：anthropic 双段 / openai 单帧，均不 += 累加
          } else if (ev.kind === 'finish') {
            finishReason = ev.reason;
          } else {
            status = 'error';
            error = ev.message;
            push({ type: 'error', message: ev.message });
          }
        }
        if (status === 'ok') push({ type: 'done' });
      } catch (err) {
        const e = normalizeThrown(err);
        status = 'error';
        error = e.message;
        errorType = e.type;
        /* 主动取消（cancel() / 外部 signal）静默收尾，不产 error chunk */
        if (e.type !== 'cancelled') push({ type: 'error', message: e.message });
      } finally {
        const usage = normalizeUsage(usageRaw);
        publishUsage(usage);
        const { cost } = audit(
          req,
          true,
          errorType === 'cancelled' ? 'error' : status,
          usage,
          Date.now() - t0,
          errorType === 'cancelled' ? '请求已取消' : error,
          ttftMs,
        );
        dispatchDoneEvent({
          status: errorType === 'cancelled' ? 'cancelled' : status,
          provider: def.id,
          model: req.model ?? defaultModel,
          stream: true,
          usage,
          cost,
          error: errorType === 'cancelled' ? undefined : error,
          durationMs: Date.now() - t0,
          ttftMs,
        });
        finished = true;
        notify();
        ac.abort(); // 幂等：挂起的 reader/连接清理
        resolveDone({ text, usage, cost, finishReason, raw: usageRaw });
      }
    })();

    /* 单消费者迭代器（push→pull 适配；早退 return() 即 abort，done 照常结算） */
    const iterator: AsyncIterator<AiStreamChunk> = {
      next(): Promise<IteratorResult<AiStreamChunk>> {
        if (chunks.length > 0) return Promise.resolve({ value: chunks.shift() as AiStreamChunk, done: false });
        if (finished) return Promise.resolve({ value: undefined, done: true });
        return new Promise<IteratorResult<AiStreamChunk>>((resolve) => {
          waiters.push(() => {
            resolve(iterator.next());
          });
        });
      },
      return(): Promise<IteratorResult<AiStreamChunk>> {
        ac.abort();
        return Promise.resolve({ value: undefined, done: true });
      },
    };

    return {
      [Symbol.asyncIterator]() {
        return iterator;
      },
      cancel() {
        ac.abort();
      },
      done,
    };
  }

  const config: AiClientConfig = Object.freeze({ provider: def.id, baseURL, model: defaultModel });
  return { chat, stream, config };
}
