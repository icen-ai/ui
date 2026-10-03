/*
 * @icen.ai/ui — Behavior: kb-core（知识库族共享核心：类型契约 + 纯函数 + 注册表，无 UI 无副作用）
 *
 * 心智模型（docs/spec/kb-family.md §0）：ai-* 描述「AI 在做什么」（过程），
 * kb-* 呈现「知识从哪来、可信吗、怎么用」（证据与资产）。本模块是 kb 族的
 * 单一契约源：所有 kb-*.ts 行为模块 import 类型与工具一律来自这里，不各自定义。
 *
 * 契约分七段：
 *   §1 引用与溯源（KbCitation / KbLocation 三分型 / parseInlineCitations）
 *   §2 评分纪律（scoreKind 语义 / null 分数 / l2 反向 / formatScore）
 *   §3 chunk 与解析管线（KbChunk / KbPipelineRun 状态机 / 连接器健康 4 信号模型）
 *   §4 分段策略（KbSegmentConfig + segmentText 纯函数预览）
 *   §5 检索（KbRetrievalHit/Params + 过滤 AST 双序列化 + rerank 对比 + 召回测试）
 *   §6 问数（SQL 可见性 / KbQueryResult 截断契约 / 澄清 / 认证答案 / 口径解释）
 *   §7 观测与工作台（span 树 / 标注队列 / 评估判级 / 无答案 / 检查点 / 沙箱消息）
 *
 * 设计纪律：
 *   - 全部纯函数（无 document 依赖，SSR 安全）；normalize* 宽进严出（素对象 → 契约对象）
 *   - 「不信任模型生成编号/URL」：parseInlineCitations 只切段，有效性由渲染端对照来源数降级
 *   - 分数永远可 null（无分命中、非有限值），UI 必须处理「—」态
 *   - h/svgIcon 自 ai-core 转发（kb 模块统一从 kb-core 拿，避免两套工具函数）
 */

export { h, svgIcon } from './ai-core';

/* ═══════════════ §1 引用与溯源 ═══════════════ */

/** 来源类型（内置 10 种；registerKbSourceType 开放扩展，镜像 ai-core 的 kind 注册表） */
export type KbSourceKind =
  | 'doc' | 'web' | 'wiki' | 'sheet' | 'db' | 'ticket' | 'code' | 'api' | 'image' | 'mail';

export interface KbSourceTypeDef {
  label: string;
  /** 单色线性 svg（16×16 viewBox 24 的 path 集，经 svgIcon 消毒） */
  icon: string;
}

const ic = (label: string, d: string): KbSourceTypeDef => ({ label, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>` });

const BUILTIN_SOURCE_TYPES: Record<string, KbSourceTypeDef> = {
  doc: ic('文档', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  web: ic('网页', '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>'),
  wiki: ic('知识库', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  sheet: ic('表格', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  db: ic('数据库', '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>'),
  ticket: ic('工单', '<path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z"/><path d="M13 5v14"/>'),
  code: ic('代码', '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'),
  api: ic('接口', '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"/>'),
  image: ic('图片', '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.6-4.6a2 2 0 0 0-2.8 0L3 21"/>'),
  mail: ic('邮件', '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>'),
};

const sourceTypeRegistry = new Map<string, KbSourceTypeDef>(Object.entries(BUILTIN_SOURCE_TYPES));

/** 开放注册来源类型（自定义连接器的图标与名称；覆盖同名内置） */
export function registerKbSourceType(name: string, def: KbSourceTypeDef): void {
  sourceTypeRegistry.set(name, def);
}
export function unregisterKbSourceType(name: string): void {
  if (!Object.prototype.hasOwnProperty.call(BUILTIN_SOURCE_TYPES, name)) sourceTypeRegistry.delete(name);
}
export function getKbSourceType(name: string | undefined): KbSourceTypeDef {
  if (name) return sourceTypeRegistry.get(name) ?? BUILTIN_SOURCE_TYPES.doc!;
  return BUILTIN_SOURCE_TYPES.doc!;
}
export function listKbSourceTypes(): string[] {
  return [...sourceTypeRegistry.keys()];
}

/** 引用定位三分型（Anthropic Citations 契约）：span 单位在 kind 上写死，防字符/字节错位 */
export interface KbLocation {
  kind: 'char' | 'page' | 'block';
  start: number;
  end: number;
  /** 仅 char 型需要声明（gemini 字节教训）：缺省 char */
  unit?: 'char' | 'byte';
}

export type KbPermission = 'readable' | 'restricted' | 'requestable';

export type KbScoreKind = 'cosine' | 'dot' | 'ip' | 'l2' | 'bm25' | 'rrf' | 'dbsf' | 'rerank' | 'hybrid';

/** 引用/来源对象（hover 卡、来源列表、passage 查看器的公共数据单元） */
export interface KbCitation {
  id: string;
  /** 展示编号（来源列表中的 [n]；渲染端负责与正文角标对齐） */
  index?: number;
  title: string;
  url?: string;
  kind?: string;
  /** 逐字原文引用（≤150 字符为宜；受限时置空） */
  citedText?: string;
  /** 摘录（列表用，可长于 citedText） */
  snippet?: string;
  date?: string;
  score?: number | null;
  scoreKind?: KbScoreKind;
  official?: boolean;
  permission?: KbPermission;
  /** 文档责任人（企业常见：找谁确认口径） */
  owner?: string;
  loc?: KbLocation;
  documentId?: string;
  /** 被引次数（来源列表排序用） */
  useCount?: number;
}

export function normalizeCitation(raw: KbCitation | Record<string, unknown>): KbCitation {
  const r = raw as Partial<KbCitation>;
  const score = typeof r.score === 'number' && Number.isFinite(r.score) ? r.score : r.score == null ? null : null;
  return {
    id: String(r.id ?? ''),
    index: typeof r.index === 'number' ? r.index : undefined,
    title: String(r.title ?? '未命名来源'),
    url: typeof r.url === 'string' && r.url ? r.url : undefined,
    kind: typeof r.kind === 'string' ? r.kind : undefined,
    citedText: typeof r.citedText === 'string' ? r.citedText : undefined,
    snippet: typeof r.snippet === 'string' ? r.snippet : undefined,
    date: typeof r.date === 'string' ? r.date : undefined,
    score: score === undefined ? null : score,
    scoreKind: r.scoreKind,
    official: r.official === true,
    permission: r.permission === 'restricted' || r.permission === 'requestable' ? r.permission : 'readable',
    owner: typeof r.owner === 'string' ? r.owner : undefined,
    loc: r.loc,
    documentId: typeof r.documentId === 'string' ? r.documentId : undefined,
    useCount: typeof r.useCount === 'number' ? r.useCount : undefined,
  };
}

/** 正文 `[3]` / `[web:3]` 的切段结果：text 段与编号段交替 */
export interface KbCiteSegment {
  text: string;
  /** 编号段的序号（无则纯文本段） */
  n?: number;
}

const CITE_RE = /\[(\d{1,3})\]/g;

/** 累积文本切段（流式安全：delta 边界处的 `[3` 自然留在文本段，补全后下一次切段生效） */
export function parseInlineCitations(text: string): KbCiteSegment[] {
  const out: KbCiteSegment[] = [];
  if (!text) return out;
  let last = 0;
  CITE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITE_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], n: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function collectCitationNumbers(text: string): number[] {
  return parseInlineCitations(text)
    .filter((s): s is KbCiteSegment & { n: number } => typeof s.n === 'number')
    .map((s) => s.n);
}

/* ═══════════════ §2 评分纪律 ═══════════════ */

export const KB_SCORE_KINDS: readonly KbScoreKind[] = [
  'cosine', 'dot', 'ip', 'l2', 'bm25', 'rrf', 'dbsf', 'rerank', 'hybrid',
];

const LOWER_IS_BETTER: ReadonlySet<string> = new Set(['l2']);

/** 该分数语义下「越大越好」还是「越小越好」（跨模型不可比，UI 严禁基数解读） */
export function scoreHigherIsBetter(kind: KbScoreKind | undefined): boolean {
  return kind != null && LOWER_IS_BETTER.has(kind) ? false : true;
}

/** null / 非有限 → '—'（无分命中是一等状态，不是异常） */
export function formatScore(v: number | null | undefined, digits = 3): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits).replace(/\.?0+$/, (s) => (s.includes('.') ? '' : s));
}

/** 分数条宽度占比（0–100；l2 反向归一；无值返回 null 不渲染条） */
export function scorePercent(v: number | null | undefined, kind?: KbScoreKind, max = 1): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const pct = scoreHigherIsBetter(kind) ? (v / max) * 100 : (1 - v / max) * 100;
  return Math.max(0, Math.min(100, pct));
}

/* ═══════════════ §3 chunk 与解析管线 ═══════════════ */

export interface KbChunk {
  id: string;
  documentId: string;
  content: string;
  keywords?: string[];
  /** available=false：不删除但排除出检索（RAGFlow 语义） */
  available: boolean;
  page?: number;
  start?: number;
  end?: number;
  imageId?: string;
  meta?: Record<string, string | number>;
  edited?: boolean;
}

export function normalizeChunk(raw: Record<string, unknown>): KbChunk {
  const kw = Array.isArray(raw.keywords) ? raw.keywords.map(String) : undefined;
  return {
    id: String(raw.id ?? ''),
    documentId: String(raw.documentId ?? ''),
    content: String(raw.content ?? ''),
    keywords: kw && kw.length ? kw : undefined,
    available: raw.available !== false,
    page: typeof raw.page === 'number' ? raw.page : undefined,
    start: typeof raw.start === 'number' ? raw.start : undefined,
    end: typeof raw.end === 'number' ? raw.end : undefined,
    imageId: typeof raw.imageId === 'string' ? raw.imageId : undefined,
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta as Record<string, string | number> : undefined,
    edited: raw.edited === true,
  };
}

export type KbRunStatus = 'unstart' | 'queued' | 'running' | 'cancel' | 'done' | 'fail';

export const KB_RUN_STATUSES: readonly KbRunStatus[] = ['unstart', 'queued', 'running', 'cancel', 'done', 'fail'];

const RUN_LABELS: Record<KbRunStatus, string> = {
  unstart: '未开始',
  queued: '排队中',
  running: '进行中',
  cancel: '已取消',
  done: '已完成',
  fail: '失败',
};

export function kbRunStatusLabel(s: KbRunStatus): string {
  return RUN_LABELS[s] ?? s;
}

export interface KbPipelineStep {
  key: string;
  label: string;
  status: KbRunStatus;
  detail?: string;
  elapsedMs?: number;
  count?: number;
}

export interface KbPipelineRun {
  documentId: string;
  title?: string;
  status: KbRunStatus;
  /** 0–100（可选：无细粒度进度时缺省，用步骤状态表达） */
  progress?: number;
  steps: KbPipelineStep[];
  chunkCount?: number;
  elapsedMs?: number;
  error?: { stage?: string; message: string };
}

const STEP = (raw: Record<string, unknown>): KbPipelineStep => ({
  key: String(raw.key ?? ''),
  label: String(raw.label ?? raw.key ?? ''),
  status: KB_RUN_STATUSES.includes(raw.status as KbRunStatus) ? raw.status as KbRunStatus : 'unstart',
  detail: typeof raw.detail === 'string' ? raw.detail : undefined,
  elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : undefined,
  count: typeof raw.count === 'number' ? raw.count : undefined,
});

export function normalizePipelineRun(raw: Record<string, unknown>): KbPipelineRun {
  const steps = Array.isArray(raw.steps) ? raw.steps.map((s) => STEP(s as Record<string, unknown>)) : [];
  return {
    documentId: String(raw.documentId ?? ''),
    title: typeof raw.title === 'string' ? raw.title : undefined,
    status: KB_RUN_STATUSES.includes(raw.status as KbRunStatus) ? raw.status as KbRunStatus : 'unstart',
    progress: typeof raw.progress === 'number' ? Math.max(0, Math.min(100, raw.progress)) : undefined,
    steps,
    chunkCount: typeof raw.chunkCount === 'number' ? raw.chunkCount : undefined,
    elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : undefined,
    error: raw.error && typeof raw.error === 'object'
      ? { stage: typeof (raw.error as Record<string, unknown>).stage === 'string' ? (raw.error as Record<string, unknown>).stage as string : undefined, message: String((raw.error as Record<string, unknown>).message ?? '') }
      : undefined,
  };
}

/* 连接器健康：4 离散信号 + 阈值（Glean 模型：enabled ≠ 健康） */

export interface KbSyncMetrics {
  added?: number;
  updated?: number;
  deleted?: number;
  failed?: number;
  lastSyncAt?: string;
}

export type KbConnectorHealth = 'healthy' | 'stale' | 'failing' | 'off';

export interface KbConnector {
  id: string;
  name: string;
  kind?: string;
  scope?: string;
  enabled: boolean;
  lastSyncAt?: string;
  lastCrawlStatus?: 'ok' | 'fail' | 'none';
  itemsSynced?: number;
  /** 24h 抓取速率（条/天） */
  crawlRate?: number;
  /** 变更速率（webhook 健康信号：持续 0 = 变更通道失效） */
  changeRate?: number;
  credential?: 'ok' | 'expired' | 'none';
  schedule?: string;
  metrics?: KbSyncMetrics;
}

export function normalizeConnector(raw: Record<string, unknown>): KbConnector {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    kind: typeof raw.kind === 'string' ? raw.kind : undefined,
    scope: typeof raw.scope === 'string' ? raw.scope : undefined,
    enabled: raw.enabled !== false,
    lastSyncAt: typeof raw.lastSyncAt === 'string' ? raw.lastSyncAt : undefined,
    lastCrawlStatus: raw.lastCrawlStatus === 'ok' || raw.lastCrawlStatus === 'fail' ? raw.lastCrawlStatus : 'none',
    itemsSynced: typeof raw.itemsSynced === 'number' ? raw.itemsSynced : undefined,
    crawlRate: typeof raw.crawlRate === 'number' ? raw.crawlRate : undefined,
    changeRate: typeof raw.changeRate === 'number' ? raw.changeRate : undefined,
    credential: raw.credential === 'expired' || raw.credential === 'none' ? raw.credential : 'ok',
    schedule: typeof raw.schedule === 'string' ? raw.schedule : undefined,
    metrics: raw.metrics && typeof raw.metrics === 'object' ? raw.metrics as KbSyncMetrics : undefined,
  };
}

/** 健康判定（不可逆优先级：off < failing < stale < healthy；停滞阈值 24h） */
export function connectorHealth(c: KbConnector, now: Date = new Date()): KbConnectorHealth {
  if (!c.enabled) return 'off';
  if (c.lastCrawlStatus === 'fail' || c.credential === 'expired' || c.credential === 'none') return 'failing';
  const last = c.lastSyncAt ? Date.parse(c.lastSyncAt) : NaN;
  const staleMs = 24 * 60 * 60 * 1000;
  if (!Number.isFinite(last) || now.getTime() - last > staleMs) return 'stale';
  return 'healthy';
}

/* ═══════════════ §4 分段策略 ═══════════════ */

export type KbCleanOption = 'collapse-blank' | 'strip-url' | 'strip-email';

export const KB_CLEAN_OPTIONS: readonly KbCleanOption[] = ['collapse-blank', 'strip-url', 'strip-email'];

export interface KbSegmentConfig {
  mode: 'auto' | 'custom' | 'parent-child';
  delimiter?: string;
  maxLength: number;
  overlap: number;
  clean: KbCleanOption[];
  /** 模式创建后锁定（Dify 纪律：模式不可改、参数可调） */
  locked?: boolean;
}

export function normalizeSegmentConfig(raw?: Partial<KbSegmentConfig>): KbSegmentConfig {
  const r = raw ?? {};
  return {
    mode: r.mode === 'custom' || r.mode === 'parent-child' ? r.mode : 'auto',
    delimiter: typeof r.delimiter === 'string' && r.delimiter ? r.delimiter : r.mode === 'custom' || r.mode === 'parent-child' ? undefined : '\n\n',
    maxLength: typeof r.maxLength === 'number' && r.maxLength > 0 ? Math.floor(r.maxLength) : 500,
    overlap: typeof r.overlap === 'number' && r.overlap >= 0 ? Math.floor(r.overlap) : 50,
    clean: Array.isArray(r.clean) ? r.clean.filter((c) => KB_CLEAN_OPTIONS.includes(c)) : [],
    locked: r.locked === true,
  };
}

const URL_RE = /https?:\/\/\S+/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;

function cleanText(text: string, clean: KbCleanOption[]): string {
  let out = text;
  if (clean.includes('collapse-blank')) out = out.replace(/\n{3,}/g, '\n\n');
  if (clean.includes('strip-url')) out = out.replace(URL_RE, '');
  if (clean.includes('strip-email')) out = out.replace(EMAIL_RE, '');
  return out;
}

/** 分隔符字面量 → 正则（支持 \n 转义写法） */
function delimiterToRe(delim: string): RegExp {
  const literal = delim.replace(/\\n/g, '\n').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(literal, 'g');
}

/**
 * 纯函数分段预览（真实切分非估算）：清洗 → 分隔符切 → 超长块按 maxLength/overlap 二次切。
 * parent-child 模式返回父段（分隔符级），子段由 maxLength 切分交给渲染端二级展示。
 */
export function segmentText(text: string, config: KbSegmentConfig): string[] {
  const cfg = normalizeSegmentConfig(config);
  const cleaned = cleanText(text ?? '', cfg.clean);
  if (!cleaned.trim()) return [];
  const parts: string[] = [];
  if (cfg.mode === 'custom' || cfg.mode === 'parent-child' || (cfg.mode === 'auto' && cfg.delimiter)) {
    const re = delimiterToRe(cfg.delimiter ?? '\n\n');
    for (const seg of cleaned.split(re)) {
      const s = seg.trim();
      if (s) parts.push(s);
    }
  } else {
    parts.push(cleaned.trim());
  }
  /* 超长块二次切分（auto/custom 都做；parent-child 的父段不再切） */
  if (cfg.mode === 'parent-child') return parts;
  const out: string[] = [];
  for (const p of parts) {
    if (p.length <= cfg.maxLength) {
      out.push(p);
      continue;
    }
    const overlap = Math.min(cfg.overlap, Math.max(0, cfg.maxLength - 1));
    for (let i = 0; i < p.length; i += cfg.maxLength - overlap) {
      out.push(p.slice(i, i + cfg.maxLength));
      if (i + cfg.maxLength >= p.length) break;
    }
  }
  return out;
}

export interface KbSegmentStats {
  count: number;
  avgLength: number;
  /** tokens 粗估（≈ 字符/2，中英混排经验值；标注「≈」） */
  tokensEstimate: number;
}

export function segmentStats(chunks: string[]): KbSegmentStats {
  const count = chunks.length;
  const total = chunks.reduce((n, c) => n + c.length, 0);
  return { count, avgLength: count ? Math.round(total / count) : 0, tokensEstimate: Math.round(total / 2) };
}

/* ═══════════════ §5 检索 ═══════════════ */

export interface KbRetrievalHit {
  chunkId: string;
  documentId?: string;
  title?: string;
  snippet: string;
  score?: number | null;
  scoreKind?: KbScoreKind;
  /** 分数拆解（Weaviate explainScore 纪律）：向量分 / 关键词分占比 */
  vectorPart?: number;
  keywordPart?: number;
  explain?: string;
  page?: number;
  meta?: Record<string, string | number>;
}

export function normalizeHit(raw: Record<string, unknown>): KbRetrievalHit {
  const score = typeof raw.score === 'number' && Number.isFinite(raw.score) ? raw.score : null;
  return {
    chunkId: String(raw.chunkId ?? raw.id ?? ''),
    documentId: typeof raw.documentId === 'string' ? raw.documentId : undefined,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    snippet: String(raw.snippet ?? raw.content ?? ''),
    score,
    scoreKind: raw.scoreKind as KbScoreKind | undefined,
    vectorPart: typeof raw.vectorPart === 'number' ? raw.vectorPart : undefined,
    keywordPart: typeof raw.keywordPart === 'number' ? raw.keywordPart : undefined,
    explain: typeof raw.explain === 'string' ? raw.explain : undefined,
    page: typeof raw.page === 'number' ? raw.page : undefined,
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta as Record<string, string | number> : undefined,
  };
}

export interface KbRetrievalParams {
  topK: number;
  mode: 'vector' | 'keyword' | 'hybrid';
  /** hybrid：语义权重 0–1（1=纯语义） */
  alpha?: number;
  rerank?: boolean;
  rerankModel?: string;
  /** null = 不启用阈值（未启用 rerank 时阈值无效 → 渲染端显示 N/A） */
  threshold?: number | null;
}

export function normalizeRetrievalParams(raw?: Partial<KbRetrievalParams>): KbRetrievalParams {
  const r = raw ?? {};
  return {
    topK: typeof r.topK === 'number' && r.topK > 0 ? Math.floor(r.topK) : 5,
    mode: r.mode === 'vector' || r.mode === 'keyword' || r.mode === 'hybrid' ? r.mode : 'hybrid',
    alpha: typeof r.alpha === 'number' ? Math.max(0, Math.min(1, r.alpha)) : 0.5,
    rerank: r.rerank === true,
    rerankModel: typeof r.rerankModel === 'string' ? r.rerankModel : undefined,
    threshold: typeof r.threshold === 'number' ? r.threshold : null,
  };
}

/** 检索请求的完整形态（playground 与生产共用同一契约，DSL 可复制） */
export interface KbRetrievalQuery {
  query: string;
  params: KbRetrievalParams;
  filter?: KbFilterNode | null;
}

/* 过滤 AST（结构化为源，双序列化：Mongo 风格 / OData 字符串） */

export type KbFilterOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists';

export const KB_FILTER_OPS: readonly KbFilterOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'exists'];

export type KbFilterNode =
  | { type: 'group'; op: 'and' | 'or'; children: KbFilterNode[] }
  | { type: 'rule'; field: string; op: KbFilterOp; value?: string | number | boolean | Array<string | number> };

export function normalizeFilterNode(raw: unknown): KbFilterNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.type === 'group') {
    const children = Array.isArray(r.children)
      ? r.children.map(normalizeFilterNode).filter((c): c is KbFilterNode => c !== null)
      : [];
    return children.length ? { type: 'group', op: r.op === 'or' ? 'or' : 'and', children } : null;
  }
  if (r.type === 'rule') {
    const field = String(r.field ?? '').trim();
    const op = KB_FILTER_OPS.includes(r.op as KbFilterOp) ? r.op as KbFilterOp : null;
    if (!field || !op) return null;
    let value: string | number | boolean | Array<string | number> | undefined;
    if (Array.isArray(r.value)) value = r.value.map((v) => (typeof v === 'number' ? v : String(v)));
    else if (typeof r.value === 'number' || typeof r.value === 'string' || typeof r.value === 'boolean') value = r.value;
    return { type: 'rule', field, op, value };
  }
  return null;
}

const MONGO_OP: Record<KbFilterOp, string | null> = {
  eq: '$eq', ne: '$ne', gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte', in: '$in', contains: '$regex', exists: '$exists',
};

export function filterToMongo(node: KbFilterNode | null | undefined): Record<string, unknown> | null {
  const n = normalizeFilterNode(node);
  if (!n) return null;
  if (n.type === 'group') {
    const key = n.op === 'or' ? '$or' : '$and';
    return { [key]: n.children.map((c) => filterToMongo(c) ?? {}) };
  }
  if (n.op === 'exists') return { [n.field]: { $exists: n.value !== false } };
  if (n.op === 'contains') {
    const v = Array.isArray(n.value) ? String(n.value[0] ?? '') : String(n.value ?? '');
    return { [n.field]: { $regex: v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
  }
  const mk = MONGO_OP[n.op];
  if (!mk) return null;
  const value = Array.isArray(n.value) ? n.value : (n.value ?? '');
  return { [n.field]: { [mk]: value } };
}

function odataQuote(v: string | number): string {
  return typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
}

const ODATA_OP: Record<KbFilterOp, string> = {
  eq: 'eq', ne: 'ne', gt: 'gt', gte: 'ge', lt: 'lt', lte: 'le', in: 'in', contains: 'contains', exists: 'exists',
};

export function filterToOData(node: KbFilterNode | null | undefined): string {
  const n = normalizeFilterNode(node);
  if (!n) return '';
  if (n.type === 'group') {
    const join = n.op === 'or' ? ' or ' : ' and ';
    return n.children.map((c) => `(${filterToOData(c)})`).join(join);
  }
  if (n.op === 'contains') {
    const v = Array.isArray(n.value) ? String(n.value[0] ?? '') : String(n.value ?? '');
    return `contains(${n.field},${odataQuote(v)})`;
  }
  if (n.op === 'in') {
    const list: Array<string | number> = Array.isArray(n.value)
      ? n.value
      : [typeof n.value === 'number' ? n.value : String(n.value ?? '')];
    return `${n.field} in (${list.map(odataQuote).join(',')})`;
  }
  if (n.op === 'exists') return n.value === false ? `${n.field} eq null` : `${n.field} ne null`;
  const raw = Array.isArray(n.value) ? n.value[0] : n.value;
  const value: string | number = typeof raw === 'number' ? raw : String(raw ?? '');
  return `${n.field} ${ODATA_OP[n.op]} ${odataQuote(value)}`;
}

/* rerank A/B 对比（市场空白组件的数据底座） */

export interface KbRerankItem {
  /** 稳定 key（chunk id；rerank 响应的 index 不足以跨请求稳定 join） */
  key: string;
  title?: string;
  before?: { rank: number; score?: number | null };
  after?: { rank: number; score?: number | null };
}

/** 排名变化：正 = 下降 n 位，负 = 上升 n 位（箭头语义由渲染端定） */
export function rerankDelta(item: KbRerankItem): number | null {
  if (!item.before || !item.after) return null;
  return item.after.rank - item.before.rank;
}

/* 召回测试集 */

export interface KbHitTestCase {
  id: string;
  question: string;
  expectedChunkIds?: string[];
  lastHits?: Array<{ chunkId: string; score?: number | null; rank?: number }>;
  passed?: boolean;
  pinned?: boolean;
}

export interface KbHitStats {
  total: number;
  passed: number;
  /** 无 case 或未跑过 → null（不是 0） */
  hitRate: number | null;
  avgScore: number | null;
}

export function hitTestStats(cases: KbHitTestCase[]): KbHitStats {
  const ran = cases.filter((c) => c.passed !== undefined);
  const passed = ran.filter((c) => c.passed === true);
  const scores = ran.flatMap((c) => (c.lastHits ?? []).map((h) => h.score)).filter((s): s is number => typeof s === 'number');
  return {
    total: cases.length,
    passed: passed.length,
    hitRate: ran.length ? passed.length / ran.length : null,
    avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
  };
}

/* ═══════════════ §6 问数 ═══════════════ */

export interface KbSqlQuery {
  sql: string;
  dialect?: string;
  tables?: string[];
  /** SQL 可见性是权限问题（Vanna/Genie 纪律），不是展示偏好 */
  visibility: 'all' | 'admin';
  editable: boolean;
  /** 修正循环：上一版 SQL（存在且报错时渲染 diff 修复卡） */
  prevSql?: string;
  reasoning?: string;
}

export function normalizeSqlQuery(raw: Partial<KbSqlQuery>): KbSqlQuery {
  return {
    sql: String(raw.sql ?? ''),
    dialect: typeof raw.dialect === 'string' ? raw.dialect : undefined,
    tables: Array.isArray(raw.tables) ? raw.tables.map(String) : undefined,
    visibility: raw.visibility === 'admin' ? 'admin' : 'all',
    editable: raw.editable !== false,
    prevSql: typeof raw.prevSql === 'string' ? raw.prevSql : undefined,
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : undefined,
  };
}

export interface KbQueryResult {
  columns: Array<{ name: string; type?: string }>;
  rows: Array<Array<string | number | null>>;
  totalRows?: number;
  /** 截断是契约不是 bug（WrenAI row-limit 纪律）：true 必须显示声明 */
  truncated: boolean;
  limit?: number;
  rowCount: number;
  durationMs?: number;
  exportFormats?: string[];
}

export function normalizeQueryResult(raw: Partial<KbQueryResult>): KbQueryResult {
  const columns = Array.isArray(raw.columns)
    ? raw.columns.map((c) => (typeof c === 'string' ? { name: c } : { name: String((c as { name?: string }).name ?? ''), type: (c as { type?: string }).type }))
    : [];
  return {
    columns,
    rows: Array.isArray(raw.rows) ? raw.rows.map((r) => (Array.isArray(r) ? r.map((v) => (typeof v === 'number' || typeof v === 'string' ? v : null)) : [])) : [],
    totalRows: typeof raw.totalRows === 'number' ? raw.totalRows : undefined,
    truncated: raw.truncated === true,
    limit: typeof raw.limit === 'number' ? raw.limit : undefined,
    rowCount: typeof raw.rowCount === 'number' ? raw.rowCount : (Array.isArray(raw.rows) ? raw.rows.length : 0),
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
    exportFormats: Array.isArray(raw.exportFormats) ? raw.exportFormats.map(String) : undefined,
  };
}

export interface KbClarification {
  id?: string;
  question: string;
  options: Array<{ label: string; value: string }>;
  /** 为什么反问（弱化展示：口径歧义/缺时间范围…） */
  reason?: string;
}

export type KbAnswerKind = 'generated' | 'verified';

export interface KbVerifiedVia {
  assetId: string;
  assetType: 'parameterized-query' | 'function' | 'curated';
  note?: string;
}

export interface KbExplainFact {
  tables?: string[];
  columns?: string[];
  filters?: string[];
  aggregates?: string[];
  /** 命中的指标口径（可深链语义层定义） */
  metrics?: Array<{ name: string; ref?: string }>;
}

export interface KbPermissionNotice {
  rowLevelPolicy?: string;
  maskedColumns?: string[];
}

/* ═══════════════ §7 观测与工作台 ═══════════════ */

export type KbSpanKind = 'retrieval' | 'generation' | 'rerank' | 'embed' | 'tool' | 'guard' | 'chunk' | 'query' | 'agent';

export const KB_SPAN_KINDS: readonly KbSpanKind[] = [
  'retrieval', 'generation', 'rerank', 'embed', 'tool', 'guard', 'chunk', 'query', 'agent',
];

const SPAN_LABELS: Record<KbSpanKind, string> = {
  retrieval: '检索', generation: '生成', rerank: '重排', embed: '向量化',
  tool: '工具', guard: '护栏', chunk: '切片', query: '查询', agent: '代理',
};

export function kbSpanKindLabel(k: KbSpanKind): string {
  return SPAN_LABELS[k] ?? k;
}

export type KbSpanStatus = 'running' | 'done' | 'error' | 'cancel';

export const KB_SPAN_STATUSES: readonly KbSpanStatus[] = ['running', 'done', 'error', 'cancel'];

function toSpanStatus(v: unknown): KbSpanStatus {
  return v === 'running' || v === 'error' || v === 'cancel' ? v : 'done';
}

export interface KbSpan {
  id: string;
  parentId?: string;
  kind: KbSpanKind;
  name: string;
  status: KbSpanStatus;
  startedAt?: number | string;
  elapsedMs?: number;
  detail?: string;
  usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number };
  /** retrieval span 内嵌命中（差异化的核心展示） */
  hits?: KbRetrievalHit[];
  error?: string;
}

export function normalizeSpans(raw: Array<Record<string, unknown>>): KbSpan[] {
  const spans: KbSpan[] = raw.map((r) => ({
    id: String(r.id ?? ''),
    parentId: typeof r.parentId === 'string' ? r.parentId : undefined,
    kind: KB_SPAN_KINDS.includes(r.kind as KbSpanKind) ? r.kind as KbSpanKind : 'tool',
    name: String(r.name ?? ''),
    status: toSpanStatus(r.status),
    startedAt: typeof r.startedAt === 'number' || typeof r.startedAt === 'string' ? r.startedAt : undefined,
    elapsedMs: typeof r.elapsedMs === 'number' ? r.elapsedMs : undefined,
    detail: typeof r.detail === 'string' ? r.detail : undefined,
    usage: r.usage && typeof r.usage === 'object' ? r.usage as KbSpan['usage'] : undefined,
    hits: Array.isArray(r.hits) ? r.hits.map((h) => normalizeHit(h as Record<string, unknown>)) : undefined,
    error: typeof r.error === 'string' ? r.error : undefined,
  })).filter((s) => s.id);
  /* 父先于子（稳定树渲染）；孤儿（父不存在）容忍为顶层 */
  const byId = new Map(spans.map((s) => [s.id, s] as const));
  return [...spans].sort((a, b) => {
    const da = depthOf(a, byId, 0);
    const db = depthOf(b, byId, 0);
    return da === db ? indexIn(spans, a) - indexIn(spans, b) : da - db;
  });
}

function depthOf(span: KbSpan, byId: Map<string, KbSpan>, guard: number): number {
  if (guard > 32 || !span.parentId) return 0;
  const parent = byId.get(span.parentId);
  return parent ? depthOf(parent, byId, guard + 1) + 1 : 0;
}

function indexIn(spans: KbSpan[], target: KbSpan): number {
  const i = spans.findIndex((s) => s.id === target.id);
  return i === -1 ? spans.length : i;
}

/* 标注队列 */

export interface KbScoreConfig {
  name: string;
  type: 'categorical' | 'numeric';
  /** categorical 的选项（键盘 1–9 对应前 9 项） */
  categories?: string[];
  description?: string;
}

export interface KbReviewTask {
  id: string;
  target: { kind: 'trace' | 'message' | 'answer'; id: string; label?: string };
  status: 'open' | 'done';
  assignee?: string;
  scores?: Array<{ name: string; value: string | number }>;
}

/* 评估对比 */

export type KbEvalGrade = 'improvement' | 'regression' | 'tradeoff' | 'tie';

export interface KbEvalRow {
  key: string;
  input: string;
  outputA?: string;
  outputB?: string;
  expected?: string;
  scoresA?: Record<string, number | null>;
  scoresB?: Record<string, number | null>;
}

/** Summary 判级（Braintrust 心智）：分数提升但成本/时延恶化 → tradeoff */
export function evalGrade(
  scoreDelta: number | null,
  costDeltaPct?: number | null,
  latencyDeltaPct?: number | null,
): KbEvalGrade {
  if (scoreDelta == null || Math.abs(scoreDelta) < 1e-9) {
    if (scoreDelta == null) return 'tie';
    const worse = (costDeltaPct != null && costDeltaPct > 5) || (latencyDeltaPct != null && latencyDeltaPct > 15);
    return worse ? 'tradeoff' : 'tie';
  }
  if (scoreDelta > 0) {
    const worse = (costDeltaPct != null && costDeltaPct > 5) || (latencyDeltaPct != null && latencyDeltaPct > 15);
    return worse ? 'tradeoff' : 'improvement';
  }
  return 'regression';
}

export function meanScore(scores: Record<string, number | null> | undefined): number | null {
  if (!scores) return null;
  const vals = Object.values(scores).filter((v): v is number => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function deltaLabel(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
}

/* 无答案分析 */

export interface KbGapQuery {
  text: string;
  count: number;
  shareOfAllQueries?: number;
  zeroClickRate?: number;
  lastSeenAt?: string;
}

/* 检查点（Cursor 语义：默认只回滚内容、保留对话） */

export type KbCheckpointScope = 'content' | 'conversation' | 'both';

export interface KbCheckpoint {
  id: string;
  label?: string;
  at: string | number;
  reason?: string;
  scopeOptions?: KbCheckpointScope[];
}

/* 工具链条与画布 */

export interface KbChainStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

export interface KbCanvasVersion {
  id: string;
  label?: string;
  at: string | number;
  current?: boolean;
}

export interface KbCanvasSelection {
  text: string;
}

/* 沙箱消息（MCP Apps 对齐：postMessage JSON-RPC 2.0 信封） */

export interface KbSandboxMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

/* ══════════════ 权限域契约（kb-perm，spec §9.6；调研 2026-10-03-kb-permissions）══════════════ */

/** 角色四档（Drive 范式，权限序单调：viewer < commenter < editor < owner） */
export type KbRole = 'viewer' | 'commenter' | 'editor' | 'owner';

export const KB_ROLES: readonly KbRole[] = ['viewer', 'commenter', 'editor', 'owner'];

export function kbRoleLabel(r: KbRole | null): string {
  return r === 'viewer' ? '可查看' : r === 'commenter' ? '可评论' : r === 'editor' ? '可编辑' : r === 'owner' ? '负责人' : '无权限';
}

/** 权限序比较：roleA ⊇ roleB（owner 最大） */
export function roleAtLeast(role: KbRole, floor: KbRole): boolean {
  return KB_ROLES.indexOf(role) >= KB_ROLES.indexOf(floor);
}

/**
 * 可见性五级（调研结论：四维授权求值后的「输出状态」，非独立开关）。
 * hidden=检索/列表/计数都不出现（security trimming）｜metadata=知道存在（锁+标题）｜
 * restricted=metadata+申请通道｜summary=AI 摘要可见原文受限（新一代层级）｜full=内容态
 */
export type KbVisibility = 'hidden' | 'metadata' | 'restricted' | 'summary' | 'full';

export const KB_VISIBILITIES: readonly KbVisibility[] = ['hidden', 'metadata', 'restricted', 'summary', 'full'];

export function kbVisibilityLabel(v: KbVisibility): string {
  return v === 'hidden' ? '不可见' : v === 'metadata' ? '仅元数据' : v === 'restricted' ? '受限' : v === 'summary' ? '仅摘要' : '可见';
}

/** 授权主体（组是一等主体——部门树不当 ACL 用，业界共识） */
export interface KbSubject {
  kind: 'user' | 'group' | 'org' | 'anyone' | 'link';
  id: string;
  label: string;
  /** 呈现注记：「24 成员 · 由 IT 管理」「系统自动」 */
  note?: string;
}

export interface KbAclEntry {
  subject: KbSubject;
  role: KbRole;
  /** 继承来源（容器名）；缺省 = 直接授权 */
  inheritedFrom?: string;
  /** 到期一等公民：ISO 时间；到期自动回收 */
  expiresAt?: string;
  /** 显式拒绝（一票否决，置顶呈现） */
  deny?: boolean;
  /** 系统自动态（Limited Access 类）：不可手工增删 */
  system?: boolean;
}

export function normalizeAclEntry(raw: KbAclEntry | Record<string, unknown>): KbAclEntry {
  const r = raw as Partial<KbAclEntry>;
  const s = (r.subject ?? {}) as Partial<KbSubject>;
  const kind: KbSubject['kind'] =
    s.kind === 'user' || s.kind === 'group' || s.kind === 'org' || s.kind === 'anyone' || s.kind === 'link' ? s.kind : 'user';
  return {
    subject: { kind, id: String(s.id ?? ''), label: String(s.label ?? '未命名主体'), note: typeof s.note === 'string' ? s.note : undefined },
    role: KB_ROLES.includes(r.role as KbRole) ? (r.role as KbRole) : 'viewer',
    inheritedFrom: typeof r.inheritedFrom === 'string' && r.inheritedFrom ? r.inheritedFrom : undefined,
    expiresAt: typeof r.expiresAt === 'string' && r.expiresAt ? r.expiresAt : undefined,
    deny: r.deny === true,
    system: r.system === true,
  };
}

/** 请求身份（来自服务端验证 token 的固定身份集——不接受自由输入，Kendra 自报身份教训） */
export interface KbIdentity {
  user: string;
  groups: string[];
  label?: string;
  note?: string;
}

export function normalizeIdentity(raw: KbIdentity | Record<string, unknown>): KbIdentity {
  const r = raw as Partial<KbIdentity>;
  return {
    user: String(r.user ?? ''),
    groups: Array.isArray(r.groups) ? r.groups.map(String) : [],
    label: typeof r.label === 'string' ? r.label : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
  };
}

/** 可见性策略（文档级）：discoverable=无权限时是否可发现（Drive allowFileDiscovery；企业内部缺省可见存在） */
export interface KbVisibilityPolicy {
  discoverable?: boolean;
  /** 无权限但 AI 摘要可见（L2.5，摘要权限 ≠ 原文权限） */
  summaryAllowed?: boolean;
}

export function visibilityForRole(role: KbRole | null, policy?: KbVisibilityPolicy): KbVisibility {
  if (role) return 'full';
  if (policy?.summaryAllowed === true) return 'summary';
  return policy?.discoverable === false ? 'hidden' : 'metadata';
}

/** 有效权限决策：结论 + 扁平原因链（SharePoint Check Permissions 范式） */
export interface KbAclDecision {
  role: KbRole | null;
  visibility: KbVisibility;
  /** 命中的授权来源（deny 置顶；via: direct|inherit|link） */
  chain: Array<{ entry: KbAclEntry; via: 'direct' | 'inherit' | 'link' }>;
  /** 显式 deny 的一票否决来源（最强信号，UI 置顶红） */
  deniedBy?: KbSubject;
  /** 本决策中最近的将来到期（倒计时/续期入口的数据源） */
  expiresAt?: string;
}

function subjectMatches(subject: KbSubject, identity: KbIdentity): boolean {
  if (subject.kind === 'user') return subject.id === identity.user || subject.label === identity.user;
  if (subject.kind === 'group') return identity.groups.includes(subject.id) || identity.groups.includes(subject.label);
  if (subject.kind === 'org' || subject.kind === 'anyone') return true;
  return false; // link 不参与身份求值（独立呈现、独立可撤销）
}

/**
 * 有效权限求值（纯函数）：先显式 deny（一票否决）→ 再 allow 并集（角色取权限序最大）→ 默认拒绝。
 * 多角色叠加语义 = SharePoint/Azure/Zanzibar 主流范式；first-match 是 NTFS 反教材，禁止。
 */
export function evaluateAcl(
  entries: Array<KbAclEntry | Record<string, unknown>>,
  identity: KbIdentity | Record<string, unknown>,
  policy?: KbVisibilityPolicy,
): KbAclDecision {
  const list = (Array.isArray(entries) ? entries : []).map((e) => normalizeAclEntry(e));
  const id = normalizeIdentity(identity);
  const matched = list.filter((e) => subjectMatches(e.subject, id));
  const chain: KbAclDecision['chain'] = matched.map((entry) => ({
    entry,
    via: entry.subject.kind === 'link' ? 'link' : entry.inheritedFrom ? 'inherit' : 'direct',
  }));
  const deny = matched.find((e) => e.deny);
  if (deny) {
    return { role: null, visibility: visibilityForRole(null, { ...policy, summaryAllowed: false }), chain, deniedBy: deny.subject };
  }
  const grants = matched.filter((e) => !e.deny);
  const role = grants.reduce<KbRole | null>((acc, e) => (acc && roleAtLeast(acc, e.role) ? acc : e.role), null);
  const futureExpiry = grants
    .map((e) => Date.parse(e.expiresAt ?? ''))
    .filter((t) => Number.isFinite(t) && t > Date.now())
    .sort((a, b) => a - b)[0];
  return {
    role,
    visibility: visibilityForRole(role, policy),
    chain,
    expiresAt: Number.isFinite(futureExpiry) ? new Date(futureExpiry).toISOString() : undefined,
  };
}

/** 访问申请状态机（Entra entitlement 收敛到 UI 需要的 9 态） */
export type KbAccessState =
  | 'idle'
  | 'requested'
  | 'pending_review'
  | 'granted'
  | 'expiring'
  | 'expired'
  | 'denied'
  | 'revoked';

export const KB_ACCESS_STATES: readonly KbAccessState[] = [
  'idle', 'requested', 'pending_review', 'granted', 'expiring', 'expired', 'denied', 'revoked',
];

export function kbAccessStateLabel(s: KbAccessState): string {
  return (
    {
      idle: '未申请',
      requested: '已提交',
      pending_review: '待审批',
      granted: '已开通',
      expiring: '即将到期',
      expired: '已过期',
      denied: '未通过',
      revoked: '已收回',
    } as Record<KbAccessState, string>
  )[s] ?? s;
}

export interface KbAccessRequest {
  id: string;
  requester: string;
  resource: string;
  role: KbRole;
  reason?: string;
  state: KbAccessState;
  submittedAt: string;
  /** 路由明示：请求将发送给谁（页面级找 owner / 空间级找 admin——Confluence 十年踩坑） */
  approverNote?: string;
  decidedBy?: string;
  decidedAt?: string;
  /** granted 的到期（一等公民；缺省 = 永不过期） */
  expiresAt?: string;
}

export function normalizeAccessRequest(raw: KbAccessRequest | Record<string, unknown>): KbAccessRequest {
  const r = raw as Partial<KbAccessRequest>;
  const state: KbAccessState = KB_ACCESS_STATES.includes(r.state as KbAccessState) ? (r.state as KbAccessState) : 'idle';
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  return {
    id: String(r.id ?? ''),
    requester: String(r.requester ?? ''),
    resource: String(r.resource ?? ''),
    role: KB_ROLES.includes(r.role as KbRole) ? (r.role as KbRole) : 'viewer',
    reason: str(r.reason),
    state,
    submittedAt: str(r.submittedAt) ?? new Date().toISOString(),
    approverNote: str(r.approverNote),
    decidedBy: str(r.decidedBy),
    decidedAt: str(r.decidedAt),
    expiresAt: str(r.expiresAt),
  };
}

/** 审计动作（读取与预览分列是 Purview 范式；break_glass 审计粒度 ≥ 常规） */
export type KbAuditAction =
  | 'read'
  | 'preview'
  | 'permission_change'
  | 'grant'
  | 'revoke'
  | 'request'
  | 'approve'
  | 'deny'
  | 'delegation'
  | 'break_glass'
  | 'sync';

export const KB_AUDIT_ACTIONS: readonly KbAuditAction[] = [
  'read', 'preview', 'permission_change', 'grant', 'revoke', 'request', 'approve', 'deny', 'delegation', 'break_glass', 'sync',
];

export function kbAuditActionLabel(a: KbAuditAction): string {
  return (
    {
      read: '读取',
      preview: '预览',
      permission_change: '权限变更',
      grant: '授予',
      revoke: '收回',
      request: '申请',
      approve: '批准',
      deny: '拒绝',
      delegation: '委派',
      break_glass: '应急访问',
      sync: '权限同步',
    } as Record<KbAuditAction, string>
  )[a] ?? a;
}

/** 审计通道（时间线过滤维度） */
export type KbAuditChannel = 'read' | 'permission' | 'request' | 'system';

export const KB_AUDIT_CHANNELS: readonly KbAuditChannel[] = ['read', 'permission', 'request', 'system'];

export function auditChannelOf(a: KbAuditAction): KbAuditChannel {
  if (a === 'read' || a === 'preview') return 'read';
  if (a === 'permission_change' || a === 'grant' || a === 'revoke' || a === 'delegation' || a === 'sync') return 'permission';
  if (a === 'request' || a === 'approve' || a === 'deny') return 'request';
  return 'system';
}

export interface KbAuditEntry {
  id: string;
  at: string;
  actor: { kind: 'human' | 'app' | 'system'; name: string };
  action: KbAuditAction;
  resource?: string;
  detail: string;
  /** 应急访问标记：行级警示 + 「实时告警已通知安全团队」 */
  breakGlass?: boolean;
}

export function normalizeAuditEntry(raw: KbAuditEntry | Record<string, unknown>): KbAuditEntry {
  const r = raw as Partial<KbAuditEntry>;
  const actor = (r.actor ?? {}) as { kind?: string; name?: string };
  const kind = actor.kind === 'app' || actor.kind === 'system' ? actor.kind : 'human';
  return {
    id: String(r.id ?? ''),
    at: String(r.at ?? ''),
    actor: { kind, name: String(actor.name ?? '未知') },
    action: KB_AUDIT_ACTIONS.includes(r.action as KbAuditAction) ? (r.action as KbAuditAction) : 'read',
    resource: typeof r.resource === 'string' && r.resource ? r.resource : undefined,
    detail: String(r.detail ?? ''),
    breakGlass: r.breakGlass === true,
  };
}

/** 权限异味（治理发现）：6 种，均为「源系统权限卫生」问题——RAG 只是放大器 */
export type KbHygieneKind =
  | 'org_wide_link'
  | 'broad_group'
  | 'sensitive_mismatch'
  | 'broken_inheritance'
  | 'orphaned_owner'
  | 'overexposed';

export const KB_HYGIENE_KINDS: readonly KbHygieneKind[] = [
  'org_wide_link', 'broad_group', 'sensitive_mismatch', 'broken_inheritance', 'orphaned_owner', 'overexposed',
];

export function kbHygieneLabel(k: KbHygieneKind): string {
  return (
    {
      org_wide_link: '组织级链接',
      broad_group: '过宽组授权',
      sensitive_mismatch: '敏感度错配',
      broken_inheritance: '断继承',
      orphaned_owner: '负责人缺位',
      overexposed: '过度暴露',
    } as Record<KbHygieneKind, string>
  )[k] ?? k;
}

export interface KbHygieneIssue {
  id: string;
  kind: KbHygieneKind;
  resource: string;
  /** 量化数字（不去重暴露面计数等） */
  metric: string;
  hint: string;
  severity: 'high' | 'medium' | 'low';
}

export function normalizeHygieneIssue(raw: KbHygieneIssue | Record<string, unknown>): KbHygieneIssue {
  const r = raw as Partial<KbHygieneIssue>;
  const severity = r.severity === 'high' || r.severity === 'medium' || r.severity === 'low' ? r.severity : 'medium';
  return {
    id: String(r.id ?? ''),
    kind: KB_HYGIENE_KINDS.includes(r.kind as KbHygieneKind) ? (r.kind as KbHygieneKind) : 'overexposed',
    resource: String(r.resource ?? ''),
    metric: String(r.metric ?? ''),
    hint: String(r.hint ?? ''),
    severity,
  };
}

/* ═══════════════ 共享格式化 ═══════════════ */

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

/** 相对时间（来源日期/同步时间/检查点通用）：'刚刚' / 'N 分钟前' / 'N 小时前' / 'N 天前' / 超过 30 天给日期 */
export function relativeTime(input: string | number | Date, now: Date = new Date()): string {
  const t = input instanceof Date ? input.getTime() : typeof input === 'number' ? input : Date.parse(input);
  if (!Number.isFinite(t)) return typeof input === 'string' ? input : '—';
  const diff = now.getTime() - t;
  const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
  if (diff < MIN) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  const d = new Date(t);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return ymd;
}
