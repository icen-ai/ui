import { t } from './i18n';
import { iconHTML } from './icons';
import { parseSvg } from './svg-parse';
/*
 * @icen.ai/ui — Behavior: ai-core（AI 原生组件族核心：状态机 / kind 注册表 / 协议适配器 / 格式化 / svgIcon）
 *
 * 全部 AI 条目共享的 7 态状态机：pending → running → streaming → done，分支 approval / error / cancelled。
 * 组件只消费归一化模型（AiToolCallModel / AiUsage），不认识任何 provider；
 * OpenAI tool_calls / Anthropic tool_use|tool_result / AI SDK tool-* part / 素朴对象由适配层翻译。
 *
 * 完整 API：
 *   aiStatusLabel('running')            → '执行中'
 *   registerAiKind('docker', {...})     → 第三方 kind 扩展（MCP / skill 也是 tool-call 的 kind）
 *   getAiKind('shell')                  → 内置 kind 定义；未注册回退 'note'
 *   inferKind('Bash') / 'mcp__fs__read' → 'shell' / 'mcp'
 *   normalizeToolCall(raw)              → AiToolCallModel
 *   normalizeUsage(raw)                 → AiUsage
 *   formatTokens(1234)                  → '1.2k'
 *   formatDuration(1234)                → '1.2s'
 *   svgIcon(svgString)                  → 消毒后的 SVGElement；SSR 返回 null
 *
 *   集群共享构件（其他 AI 模块从这里 import）：
 *   AI_STATUSES                         → 状态机七态表（readonly）
 *   h('div', 'cls', 'text')             → 极简 DOM 构件（createElement + 可选 class + 可选 text）
 *   addUsage(sum, u)                    → 六键用量求和（非破坏性，返回新对象）
 *
 *   标准化内容模型（spec §10，2026-10 业界调研：AI SDK v5 parts / MCP / OpenAI / Anthropic）：
 *   normalizeContentParts(raw)          → AiContentPart[]（四族 wire → 一套 parts）
 *   normalizeMcpContent(raw)            → MCP 场景别名（含 EmbeddedResource / resource_link）
 *   contentToText(content)              → 拼接 text 部件（复制 / 降级传输）
 *   aiContentUrl(part)                  → 渲染地址（url 或 data URI）
 *   estimateTokens(content|usage)       → token 粗估（CJK ×0.6 + 其余 ÷4 + 媒体经验值）
 *   contextEstimate(usage)              → 下一轮上下文估算（上下文环正确口径；≠ 累计计费）
 *
 * SSR 安全：除 svgIcon（有 document 守卫）与 h（触碰 document，需调用方在自身 SSR 守卫内使用）外全部纯函数。文本一律 textContent，禁 innerHTML。
 */

/* ════════════════════════════════════════════
   状态机（一切 AI 条目共享）
   ════════════════════════════════════════════ */

export type AiStatus =
  | 'pending'
  | 'running'
  | 'streaming'
  | 'approval'
  | 'done'
  | 'error'
  | 'cancelled';

/** 状态机七态（规格 §1 的唯一语言）——集群共享（切 is-* 类 / 校验 wire status 用） */
export const AI_STATUSES: readonly AiStatus[] = [
  'pending',
  'running',
  'streaming',
  'approval',
  'done',
  'error',
  'cancelled',
];

function isAiStatus(v: string): v is AiStatus {
  return (AI_STATUSES as readonly string[]).includes(v);
}

/** 中文状态标签：等待/执行中/流式中/待确认/完成/失败/已取消 */
export function aiStatusLabel(s: AiStatus): string {
  const labels: Record<AiStatus, string> = {
    pending: t('aiCore.statusPending'),
    running: t('aiCore.statusRunning'),
    streaming: t('aiCore.statusStreaming'),
    approval: t('aiCore.statusApproval'),
    done: t('aiCore.statusDone'),
    error: t('aiCore.statusError'),
    cancelled: t('aiCore.statusCancelled'),
  };
  return labels[s] ?? s;
}

/* ════════════════════════════════════════════
   用量模型
   ════════════════════════════════════════════ */

export interface AiUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  total?: number;
}

/* 六键键序：归一化 AiUsage 的全部数值槽（audit 聚合 / 用量环求和共用） */
const USAGE_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'total'] as const;

/** 六键用量求和（非破坏性：不动入参，返回新对象）；语义对齐 ai-provider 的同名私有实现，集群共用 */
export function addUsage(sum: AiUsage, u: AiUsage): AiUsage {
  const out: AiUsage = { ...sum };
  for (const k of USAGE_KEYS) {
    const v = u[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = ((out[k] as number | undefined) ?? 0) + v;
  }
  return out;
}

/* ════════════════════════════════════════════
   kind 注册表（多态用 kind 注册表：MCP / skill 是 tool-call 的 kind）
   ════════════════════════════════════════════ */

export type AiKindTint = 'accent' | 'success' | 'warning' | 'error' | 'info' | 'muted';

export interface AiKindDef {
  /** 一行中文名（tool-call 卡片的标题区展示） */
  label: string;
  /** 内联 SVG 字符串（内置为共享 20×20 网格，保留自定义 SVG）；渲染时务必经 svgIcon() 消毒 */
  icon: string;
  /** 图标/状态点着色槽，默认 accent */
  tint?: AiKindTint;
  /** 从 input 提取一行摘要（路径/命令等）；无信息时返回 '' */
  summarize?: (input: unknown) => string;
}

/** tool-call 归一化模型（subagent 的嵌套活动流复用同一模型——递归即继承） */
export interface AiToolCallModel {
  id: string;
  name: string;
  kind: string;
  status: AiStatus;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: { reason?: string };
  durationMs?: number;
  usage?: AiUsage;
  /** subagent 嵌套活动流 */
  activities?: AiToolCallModel[];
}

/* Built-in AI kinds share the library optical grid; registered SVG overrides stay supported. */
const ICON_TERMINAL = iconHTML('terminal');
const ICON_FILE = iconHTML('file');
const ICON_FILE_PEN = iconHTML('edit');
const ICON_FILE_PLUS = iconHTML('plus');
const ICON_TRASH = iconHTML('trash');
const ICON_SEARCH = iconHTML('search');
const ICON_FOLDER_SEARCH = iconHTML('folder');
const ICON_SCAN_SEARCH = iconHTML('search');
const ICON_GLOBE = iconHTML('globe');
const ICON_DOWNLOAD = iconHTML('download');
const ICON_BLOCKS = iconHTML('server');
const ICON_ZAP = iconHTML('sparkle');
const ICON_LIST = iconHTML('list');
const ICON_LIST_CHECKS = iconHTML('list');
const ICON_BOT = iconHTML('agent');
const ICON_CHART = iconHTML('chart-line');
const ICON_FILE_TEXT = iconHTML('document');

/* ── input 摘要辅助 ── */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickStr(input: unknown, keys: string[]): string | undefined {
  if (!isObj(input)) return undefined;
  for (const k of keys) {
    const v = input[k];
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

function firstLine(s: string, max = 80): string {
  const line = s.split('\n', 1)[0]?.trim() ?? '';
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function filePathOf(input: unknown): string | undefined {
  return pickStr(input, ['file_path', 'path', 'file', 'filename']);
}

const summarizePath = (input: unknown): string | undefined => filePathOf(input);

function summarizeRead(input: unknown): string | undefined {
  const p = filePathOf(input);
  if (!p) return undefined;
  const offset = pickNum(input, ['offset', 'start_line']);
  if (offset == null) return p;
  const limit = pickNum(input, ['limit', 'end_line']);
  return limit != null ? `${p}:${offset}-${offset + limit}` : `${p}:${offset}`;
}

function summarizeShell(input: unknown): string | undefined {
  const cmd = typeof input === 'string' ? input : pickStr(input, ['command', 'cmd', 'script']);
  return cmd ? firstLine(cmd) : undefined;
}

function summarizeGrep(input: unknown): string | undefined {
  const pattern = pickStr(input, ['pattern', 'regex', 'query']);
  const p = filePathOf(input);
  if (pattern) return p ? `${firstLine(pattern, 40)} · ${p}` : firstLine(pattern);
  return p;
}

/* 适配到契约签名 (input: unknown) => string：无信息时归一为 '' */
const sum = (fn: (input: unknown) => string | undefined): ((input: unknown) => string) => {
  return (input) => fn(input) ?? '';
};

/* ── 内置 kinds（spec §4.4 清单）── */

const BUILTIN_KINDS: Record<string, AiKindDef> = {
  shell: { label: t('aiCore.kindShell'), icon: ICON_TERMINAL, tint: 'accent', summarize: sum(summarizeShell) },
  read: { label: t('aiCore.kindRead'), icon: ICON_FILE, tint: 'info', summarize: sum(summarizeRead) },
  edit: { label: t('aiCore.kindEdit'), icon: ICON_FILE_PEN, tint: 'warning', summarize: sum(summarizePath) },
  write: { label: t('aiCore.kindWrite'), icon: ICON_FILE_PLUS, tint: 'warning', summarize: sum(summarizePath) },
  rm: { label: t('aiCore.kindDelete'), icon: ICON_TRASH, tint: 'error', summarize: sum(summarizePath) },
  grep: { label: t('aiCore.kindGrep'), icon: ICON_SEARCH, tint: 'info', summarize: sum(summarizeGrep) },
  glob: { label: t('aiCore.kindGlob'), icon: ICON_FOLDER_SEARCH, tint: 'info', summarize: sum((i) => pickStr(i, ['pattern', 'glob', 'path'])) },
  browser: { label: t('aiCore.kindBrowser'), icon: ICON_GLOBE, tint: 'accent', summarize: sum((i) => pickStr(i, ['url', 'uri', 'target'])) },
  search: { label: t('aiCore.kindSearch'), icon: ICON_SCAN_SEARCH, tint: 'accent', summarize: sum((i) => pickStr(i, ['query', 'q', 'pattern'])) },
  fetch: { label: t('aiCore.kindFetch'), icon: ICON_DOWNLOAD, tint: 'info', summarize: sum((i) => pickStr(i, ['url', 'uri', 'endpoint'])) },
  mcp: { label: 'MCP', icon: ICON_BLOCKS, tint: 'muted', summarize: sum((i) => pickStr(i, ['tool', 'method', 'name'])) },
  skill: { label: t('aiCore.kindSkill'), icon: ICON_ZAP, tint: 'accent', summarize: sum((i) => pickStr(i, ['skill', 'name', 'command'])) },
  todo: {
    label: t('aiCore.kindTodo'), icon: ICON_LIST, tint: 'info',
    summarize: sum((input) => {
      const items = input && typeof input === 'object' && Array.isArray((input as Record<string, unknown>).items)
        ? ((input as Record<string, unknown>).items as unknown[]) : Array.isArray(input) ? input : [];
      const done = items.filter((it) => (it as Record<string, unknown>)?.status === 'done').length;
      return items.length > 0 ? t('aiCore.todoProgress', { p0: done, p1: items.length }) : '';
    }),
  },
  plan: { label: t('aiCore.kindPlan'), icon: ICON_LIST_CHECKS, tint: 'info' },
  subagent: { label: t('aiCore.kindSubagent'), icon: ICON_BOT, tint: 'accent', summarize: sum((i) => pickStr(i, ['task', 'description', 'prompt', 'message', 'subagent_type'])) },
  note: { label: t('aiCore.kindNote'), icon: ICON_FILE_TEXT, tint: 'muted' },
  chart: { label: t('aiCore.kindChart'), icon: ICON_CHART, tint: 'info', summarize: sum((i) => pickStr(i, ['title', 'name'])) },
};

const kindRegistry = new Map<string, AiKindDef>(Object.entries(BUILTIN_KINDS));

/** 注册（或覆盖）一个 kind；name 大小写不敏感。第三方扩展入口。 */
export function registerAiKind(name: string, def: AiKindDef): void {
  const key = name.trim().toLowerCase();
  if (key) kindRegistry.set(key, def);
}

/** 取 kind 定义；未注册回退内置 'note'。 */
export function getAiKind(name: string): AiKindDef {
  /* 注册表以含 note 的内置集初始化且只 set 不 delete——兜底直接取内置常量即可，无需第二层 get/回退对象 */
  return kindRegistry.get(name.trim().toLowerCase()) ?? BUILTIN_KINDS.note;
}

/* ── kind 推断 ── */

/* 规则按优先级排列，首命中生效（覆盖业界主流 tool 命名） */
const KIND_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^mcp__/, 'mcp'],
  [/chart|plot|visuali[sz]e|render_chart/, 'chart'],
  [/bash|shell|terminal|powershell|zsh|\bcmd\b|exec/, 'shell'],
  [/todo/, 'todo'],
  [/sub.?agent|^task$|dispatch|spawn|agent/, 'subagent'],
  [/plan/, 'plan'],
  [/skill/, 'skill'],
  [/note|memo/, 'note'],
  [/grep|ripgrep|\brg\b|search.*(code|file|text)/, 'grep'],
  [/glob|find|\bls\b|list.?file/, 'glob'],
  [/edit|patch|replace|modify|rename/, 'edit'],
  [/write|create|new.?file/, 'write'],
  [/delete|remove|\brm\b|trash|unlink/, 'rm'],
  [/read|view|open|cat/, 'read'],
  [/fetch|curl|wget|http|download|request/, 'fetch'],
  [/browse|navigate|\bclick\b|page/, 'browser'],
  [/search|query|lookup/, 'search'],
];

/** 从 tool 名推断 kind：Bash/Shell→shell、Read→read、mcp__*→mcp 等。 */
export function inferKind(toolName: string): string {
  const n = toolName.trim().toLowerCase();
  if (!n) return 'note';
  for (const [re, kind] of KIND_RULES) {
    if (re.test(n)) return kind;
  }
  return 'note';
}

/* ════════════════════════════════════════════
   适配器：业界 wire 格式 → 归一化模型
   ════════════════════════════════════════════ */

/* AI SDK part type / AG-UI 事件名 → 7 态（spec §1 协议映射） */
const WIRE_STATUS: Record<string, AiStatus> = {
  'tool-input-streaming': 'pending', // AI SDK
  'tool-input-available': 'pending', // AI SDK
  'tool-output-available': 'done', // AI SDK
  'tool-output-error': 'error', // AI SDK
  'approval-requested': 'approval', // AI SDK
  'tool_call_result': 'done', // AG-UI TOOL_CALL_RESULT
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

/**
 * 归一化 tool-call：
 *   OpenAI tool_calls 项（function.name / function.arguments JSON 串）
 *   Anthropic tool_use block（input）/ tool_result block（content / is_error）
 *   AI SDK tool-* part（toolCallId / toolName / input / output）
 *   素朴对象（id / name / kind / status / input / output / errorText），字符串视为 name
 */
export function normalizeToolCall(raw: unknown): AiToolCallModel {
  if (typeof raw === 'string') {
    return { id: '', name: raw, kind: inferKind(raw), status: 'pending' };
  }
  const src = isObj(raw) ? raw : {};
  const fn = isObj(src.function) ? src.function : undefined;
  const type = str(src.type) ?? '';

  const name = str(src.name) ?? str(src.toolName) ?? (fn ? str(fn.name) : undefined) ?? '';
  const id = str(src.id) ?? str(src.toolCallId) ?? str(src.tool_use_id) ?? '';

  let input: unknown = src.input ?? src.args ?? src.arguments ?? (fn ? fn.arguments : undefined);
  if (typeof input === 'string' && input) {
    try {
      input = JSON.parse(input);
    } catch {
      /* 非法 JSON 串保留原文（素朴字符串输入） */
    }
  }

  let output: unknown = src.output ?? src.result;
  if (output === undefined && type === 'tool_result') output = src.content;

  let errorText = str(src.errorText) ?? (typeof src.error === 'string' ? src.error : undefined);

  /* 状态：wire type 优先，其次显式 status，最后从 output/error 推断 */
  let status: AiStatus | undefined = WIRE_STATUS[type];
  if (!status && type === 'tool_use') status = 'pending';
  if (!status && type === 'tool_result') status = src.is_error ? 'error' : 'done';
  const rawStatus = str(src.status) ?? '';
  if (!status && isAiStatus(rawStatus)) status = rawStatus;
  if (!status) status = errorText ? 'error' : output !== undefined ? 'done' : 'pending';

  if (status === 'error' && !errorText && typeof output === 'string') errorText = output;

  const approval = isObj(src.approval) ? { reason: str(src.approval.reason) } : undefined;
  const durationMs = pickNum(src, ['durationMs', 'duration']);
  const usageRaw = normalizeUsage(src.usage);
  const usage = Object.keys(usageRaw).length > 0 ? usageRaw : undefined;
  const activities = Array.isArray(src.activities)
    ? src.activities.map((a) => normalizeToolCall(a))
    : undefined;

  return {
    id,
    name,
    kind: str(src.kind) ?? inferKind(name),
    status,
    input,
    output,
    errorText,
    approval,
    durationMs,
    usage,
    activities,
  };
}

/**
 * 归一化用量：
 *   OpenAI usage（prompt_tokens / completion_tokens / prompt_tokens_details.cached_tokens /
 *   completion_tokens_details.reasoning_tokens / total_tokens）
 *   Anthropic usage（input_tokens / output_tokens / cache_read_input_tokens /
 *   cache_creation_input_tokens）
 *   DeepSeek usage（顶层 prompt_cache_hit_tokens → cacheRead）
 *   Kimi usage（顶层 cached_tokens → cacheRead；prompt_tokens_details.cache_write_tokens → cacheWrite）
 *   Gemini usageMetadata（promptTokenCount / candidatesTokenCount /
 *   cachedContentTokenCount / thoughtsTokenCount / totalTokenCount）
 *   素朴对象（input / output / cacheRead / cacheWrite / reasoning / total）
 */
export function normalizeUsage(raw: unknown): AiUsage {
  if (!isObj(raw)) return {};
  const usage: AiUsage = {};

  const input =
    pickNum(raw, ['input']) ??
    pickNum(raw, ['prompt_tokens']) ??
    pickNum(raw, ['promptTokenCount']) ??
    pickNum(raw, ['input_tokens']);
  const output =
    pickNum(raw, ['output']) ??
    pickNum(raw, ['completion_tokens']) ??
    pickNum(raw, ['candidatesTokenCount']) ??
    pickNum(raw, ['output_tokens']);
  const cacheRead =
    pickNum(raw, ['cacheRead', 'cache_read']) ??
    pickNum(raw, ['cache_read_input_tokens']) ??
    pickNum(raw, ['prompt_cache_hit_tokens']) ??
    pickNum(raw, ['cached_tokens']) ??
    pickNum(raw, ['cachedContentTokenCount']) ??
    (isObj(raw.prompt_tokens_details) ? pickNum(raw.prompt_tokens_details, ['cached_tokens']) : undefined);
  const cacheWrite =
    pickNum(raw, ['cacheWrite', 'cache_write']) ??
    pickNum(raw, ['cache_creation_input_tokens']) ??
    pickNum(raw, ['cacheCreationTokenCount']) ??
    (isObj(raw.prompt_tokens_details)
      ? pickNum(raw.prompt_tokens_details, ['cache_write_tokens'])
      : undefined);
  const reasoning =
    pickNum(raw, ['reasoning']) ??
    pickNum(raw, ['thoughtsTokenCount']) ??
    (isObj(raw.completion_tokens_details)
      ? pickNum(raw.completion_tokens_details, ['reasoning_tokens'])
      : undefined);
  /* total 缺省时回退为全段求和（归一化模型里 input 不含缓存——
     OpenAI 的 prompt_tokens 含 cached、Anthropic 的 input_tokens 不含 cache_read，
     归一后缓存已分列，总量必须加回，否则占比失真） */
  const total =
    pickNum(raw, ['total']) ??
    pickNum(raw, ['total_tokens']) ??
    pickNum(raw, ['totalTokenCount']) ??
    (input != null || output != null || cacheRead != null || cacheWrite != null || reasoning != null
      ? (input ?? 0) + (output ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0) + (reasoning ?? 0)
      : undefined);

  if (input != null) usage.input = input;
  if (output != null) usage.output = output;
  if (cacheRead != null) usage.cacheRead = cacheRead;
  if (cacheWrite != null) usage.cacheWrite = cacheWrite;
  if (reasoning != null) usage.reasoning = reasoning;
  if (total != null) usage.total = total;
  return usage;
}

/* ════════════════════════════════════════════
   格式化
   ════════════════════════════════════════════ */

function trim1(v: number): string {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** 1234 → "1.2k"；999 → "999"；2_400_000 → "2.4M" */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) return `${trim1(n / 1000)}k`;
  return `${trim1(n / 1_000_000)}M`;
}

/** 1234 → "1.2s"；800 → "800ms"；65_000 → "1m5s"；3_700_000 → "1h2m" */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${trim1(ms / 1000)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  if (ms < 3_600_000) return s > 0 ? `${m}m${s}s` : `${m}m`;
  const h = Math.floor(ms / 3_600_000);
  const rm = Math.round((ms % 3_600_000) / 60_000);
  return rm > 0 ? `${h}h${rm}m` : `${h}h`;
}

/* ════════════════════════════════════════════
   标准化内容模型 AiContent（spec §10）
   调研依据（2026-10）：AI SDK v5 UIMessage parts / MCP 内容类型 /
   OpenAI content parts / Anthropic content blocks——一套 parts 表达任意输入，
   渲染组件、估算器、传输层全部只认这一套。
   ════════════════════════════════════════════ */

export interface AiTextPart {
  type: 'text';
  text: string;
  /** 流式状态（AI SDK TextUIPart 对齐）；渲染不依赖，消费方可选 */
  state?: 'streaming' | 'done';
}

/** 媒体部件族：url 与 data 二选一（data 为无前缀 base64，必须伴随 mimeType） */
export interface AiImagePart {
  type: 'image';
  url?: string;
  data?: string;
  mimeType?: string;
  /** 替代文本 */
  alt?: string;
}

export interface AiAudioPart {
  type: 'audio';
  url?: string;
  data?: string;
  mimeType?: string;
}

export interface AiVideoPart {
  type: 'video';
  url?: string;
  data?: string;
  mimeType?: string;
}

export interface AiFilePart {
  type: 'file';
  url?: string;
  data?: string;
  mimeType?: string;
  /** 文件名（url 槽对 openai 族承载 Files API file_id 时也作展示名） */
  filename?: string;
}

export type AiMediaPart = AiImagePart | AiAudioPart | AiVideoPart | AiFilePart;

/** MCP ResourceLink：引用未内联的资源 */
export interface AiResourceLinkPart {
  type: 'resource-link';
  uri: string;
  name?: string;
  mimeType?: string;
}

export type AiContentPart = AiTextPart | AiMediaPart | AiResourceLinkPart;

/** 消息与工具回执的内容：字符串（纯文本捷径）或部件数组（多模态） */
export type AiContent = string | AiContentPart[];

const PART_TYPES = new Set(['text', 'image', 'audio', 'video', 'file', 'resource-link']);

/** 单部件守卫：type 合法且槽位类型正确（text 看 text、resource-link 看 uri、媒体看 url 或 data+mimeType） */
export function isAiContentPart(v: unknown): v is AiContentPart {
  if (!isObj(v)) return false;
  const t = v.type;
  if (typeof t !== 'string' || !PART_TYPES.has(t)) return false;
  if (t === 'text') return typeof v.text === 'string';
  if (t === 'resource-link') return typeof v.uri === 'string';
  return typeof v.url === 'string' || (typeof v.data === 'string' && typeof v.mimeType === 'string');
}

/** 渲染地址归一：url 直取；data + mimeType 拼 data URI（base64） */
export function aiContentUrl(part: AiContentPart): string | undefined {
  if (part.type === 'text' || part.type === 'resource-link') return undefined;
  if (typeof part.url === 'string' && part.url) return part.url;
  if (typeof part.data === 'string' && part.data && typeof part.mimeType === 'string') {
    return `data:${part.mimeType};base64,${part.data}`;
  }
  return undefined;
}

/* ── wire → parts 归一化（OpenAI / Anthropic / MCP / 素朴，逐项探测）── */

/** OpenAI `data:<mime>;base64,<data>` URI 拆解成 data + mimeType */
function splitDataUri(uri: string): { data: string; mimeType: string } | undefined {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(uri);
  return m ? { mimeType: m[1] ?? '', data: m[2] ?? '' } : undefined;
}

function partFromOpenAi(item: Record<string, unknown>): AiContentPart | undefined {
  const type = str(item.type) ?? '';
  if (type === 'text' && typeof item.text === 'string') return { type: 'text', text: item.text };
  if (type === 'image_url') {
    const iu = isObj(item.image_url) ? item.image_url : undefined;
    const url = iu ? str(iu.url) : undefined;
    if (!url) return undefined;
    const inline = splitDataUri(url);
    return inline
      ? { type: 'image', data: inline.data, mimeType: inline.mimeType }
      : { type: 'image', url };
  }
  if (type === 'input_audio') {
    const ia = isObj(item.input_audio) ? item.input_audio : undefined;
    const data = ia ? str(ia.data) : undefined;
    const fmt = ia ? str(ia.format) : undefined;
    if (!data) return undefined;
    return { type: 'audio', data, mimeType: fmt ? `audio/${fmt}` : 'audio/wav' };
  }
  if (type === 'file') {
    const f = isObj(item.file) ? item.file : undefined;
    const fileId = f ? str(f.file_id) ?? str(f.filename) : undefined;
    if (!fileId) return undefined;
    return { type: 'file', url: fileId, filename: str(f?.filename) };
  }
  return undefined;
}

/** anthropic source（base64 | url 两种形态）→ 媒体部件 */
function partFromAnthropicSource(
  mediaType: 'image' | 'audio' | 'file',
  src: unknown,
  fallbackMime: string,
): AiContentPart | undefined {
  if (!isObj(src)) return undefined;
  if (str(src.type) === 'url') {
    const url = str(src.url);
    return url ? { type: mediaType, url } : undefined;
  }
  const data = str(src.data);
  const mimeType = str(src.media_type) ?? fallbackMime;
  return data ? { type: mediaType, data, mimeType } : undefined;
}

function partFromAnthropic(block: Record<string, unknown>): AiContentPart | undefined {
  const type = str(block.type) ?? '';
  if (type === 'text' && typeof block.text === 'string') return { type: 'text', text: block.text };
  if (type === 'image') return partFromAnthropicSource('image', block.source, 'image/png');
  if (type === 'audio') return partFromAnthropicSource('audio', block.source, 'audio/wav');
  if (type === 'document') return partFromAnthropicSource('file', block.source, 'application/pdf');
  return undefined;
}

function partFromMcp(item: Record<string, unknown>): AiContentPart | undefined {
  const type = str(item.type) ?? '';
  if (type === 'text' && typeof item.text === 'string') return { type: 'text', text: item.text };
  if (type === 'image' || type === 'audio') {
    const data = str(item.data);
    const mimeType = str(item.mimeType) ?? (type === 'image' ? 'image/png' : 'audio/wav');
    return data ? { type, data, mimeType } : undefined;
  }
  if (type === 'resource_link') {
    const uri = str(item.uri) ?? str(item.url);
    return uri ? { type: 'resource-link', uri, name: str(item.name), mimeType: str(item.mimeType) } : undefined;
  }
  if (type === 'resource') {
    /* EmbeddedResource：text 文本或 blob base64（mimeType 决定形态） */
    const res = isObj(item.resource) ? item.resource : undefined;
    if (!res) return undefined;
    const uri = str(res.uri);
    const mimeType = str(res.mimeType) ?? '';
    const text = str(res.text);
    if (text) return { type: 'text', text };
    const blob = str(res.blob);
    if (blob) {
      if (mimeType.startsWith('image/')) return { type: 'image', data: blob, mimeType };
      if (mimeType.startsWith('audio/')) return { type: 'audio', data: blob, mimeType };
      if (mimeType.startsWith('video/')) return { type: 'video', data: blob, mimeType };
      return { type: 'file', data: blob, mimeType: mimeType || 'application/octet-stream', filename: uri?.split('/').pop() };
    }
    return uri ? { type: 'resource-link', uri, mimeType: mimeType || undefined } : undefined;
  }
  return undefined;
}

/**
 * 归一化内容部件：OpenAI content parts / Anthropic content blocks /
 * MCP content 数组（含 EmbeddedResource）/ 素朴（本类型族原样通过）。
 * 未知形态剔除；空结果返回 []。
 */
export function normalizeContentParts(raw: unknown): AiContentPart[] {
  if (typeof raw === 'string') return raw ? [{ type: 'text', text: raw }] : [];
  if (!Array.isArray(raw)) return [];
  const out: AiContentPart[] = [];
  for (const item of raw) {
    if (isAiContentPart(item)) {
      out.push(item);
      continue;
    }
    if (!isObj(item)) continue;
    const part = partFromOpenAi(item) ?? partFromAnthropic(item) ?? partFromMcp(item);
    if (part) out.push(part);
  }
  return out;
}

/** MCP 场景别名（同 normalizeContentParts，可发现性） */
export const normalizeMcpContent = normalizeContentParts;

/** 拼接全部 text 部件（复制按钮 / 不支持多模态的降级传输用） */
export function contentToText(content: AiContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is AiTextPart => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/* ── 估算器（spec §10.4）── */

const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;

function estimatePartTokens(part: AiContentPart): number {
  switch (part.type) {
    case 'text':
      return estimateTextTokens(part.text);
    case 'image':
      return 1000; /* 经验值：中等分辨率视觉 token */
    case 'audio':
      return 1500; /* 无时长信息的中短音频 */
    case 'video':
      return 6000; /* 前瞻位经验值 */
    case 'file':
      return 500; /* 文档内容未知 */
    case 'resource-link':
      return estimateTextTokens(part.name ?? part.uri);
  }
}

function estimateTextTokens(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const rest = text.length - cjk;
  return Math.max(1, Math.round(cjk * 0.6 + rest / 4));
}

/**
 * token 估算（无依赖启发式）：CJK 字符 ×0.6 + 其余字符 ÷4；
 * 媒体部件给经验值。传 AiUsage 时直接返回归一 total。
 */
export function estimateTokens(content: AiContent | AiUsage): number {
  if (typeof content === 'string') return estimateTextTokens(content);
  if (Array.isArray(content)) return content.reduce((acc, p) => acc + estimatePartTokens(p), 0);
  const u = normalizeUsage(content);
  return u.total ?? (u.input ?? 0) + (u.output ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0) + (u.reasoning ?? 0);
}

/**
 * 下一轮上下文估算（上下文环的正确口径，spec §10.4）：
 * input + cacheRead + cacheWrite + output（+ 单列的 reasoning）——
 * 本次输出会成为下轮输入的一部分。与 auditor.summary()（累计计费）语义不同。
 */
export function contextEstimate(usage: AiUsage): number {
  const u = normalizeUsage(usage);
  return (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0) + (u.output ?? 0) + (u.reasoning ?? 0);
}

/* ════════════════════════════════════════════
   DOM 构件（集群共用）
   ════════════════════════════════════════════ */

/** 极简 DOM 构件：createElement + 可选 className + 可选 textContent —— 集群共用，免四处 createElement 三连 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  if (typeof document === 'undefined') throw new Error('h() 仅浏览器环境可用（SSR 时由调用方守卫，见模块头注释）');
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/* ════════════════════════════════════════════
   svgIcon：DOMParser 消毒解析
   ════════════════════════════════════════════ */

/**
 * 把内联 SVG 字符串解析为消毒后的 SVGElement：
 *   - 剥全部 on* 事件属性；剔除 script / foreignObject 子树
 *   - 剔除 javascript: 协议的 href / xlink:href（纵深防御）
 *   - SSR（无 document / DOMParser）返回 null
 */
export function svgIcon(svg: string): SVGElement | null {
  /* 实现收敛到 svg-parse 单点（xmlns 归一 + 消毒 + importNode） */
  return parseSvg(svg);
}
