/*
 * /kb 工作台 mock 语料与接线数据
 *
 * 纯 TS 数据模块：全部 mock 语料、打分器与各标签页的接线数据集中于此，
 * 页面脚本（site/src/pages/kb.astro 的 bundled module）import 消费。
 * 设计对齐 docs/spec/kb-family.md §1–2：分数可 null（— 是一等状态）、
 * 截断是契约、权限受限打码、数字永远中性——mock 数据同样遵守这些纪律。
 *
 * 打分器 scoreQuery 是真实计算（非硬编码表）：query 分词（CJK 二元组 + 拉丁词）
 * 与预切分 chunk 的 token 重合度 → 0–1 分 + vectorPart/keywordPart 拆解；
 * 受限语料块恒为 score:null（演示「无分命中」态）。
 */

import type {
  KbAccessRequest,
  KbAclEntry,
  KbAuditEntry,
  KbCitation,
  KbCheckpoint,
  KbChunk,
  KbConnector,
  KbEvalRow,
  KbFilterNode,
  KbGapQuery,
  KbHitTestCase,
  KbHygieneIssue,
  KbIdentity,
  KbPipelineRun,
  KbRetrievalHit,
  KbRetrievalParams,
  KbReviewTask,
  KbScoreConfig,
  KbSegmentConfig,
  KbSpan,
  KbVisibility,
} from '../../../src/behaviors/kb-core';
import type { ChartSpec, GraphSpec, MapSpec } from '../../../src/behaviors/charts';

/* ═══════════════ 时间基准（模块加载时刻；relativeTime/connectorHealth 以真实时钟消费） ═══════════════ */

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 86_400_000;
const iso = (msAgo: number): string => new Date(NOW - msAgo).toISOString();
const isoDay = (daysAgo: number, hour = 9): string => {
  const d = new Date(NOW - daysAgo * DAY);
  d.setHours(hour, 12, 0, 0);
  return d.toISOString();
};

/* ═══════════════ §1 语料：四篇中文企业文档 ═══════════════ */

export interface ShowcaseDoc {
  id: string;
  title: string;
  kind: string;
  owner: string;
  updated: string;
  /** 全文（分段预览的样本与 passage 原文都从这里取材） */
  content: string;
}

export const CORPUS_DOCS: ShowcaseDoc[] = [
  {
    id: 'doc-vendor',
    title: '供应商准入手册 v4.2',
    kind: 'wiki',
    owner: '采购部 · 顾清',
    updated: iso(6 * HOUR),
    content: [
      '第三章 准入材料清单。新供应商申请准入需提交以下材料：营业执照副本、近两年审计报告、质量体系认证（ISO 9001 或同等）、样品检测报告，以及环保合规声明。',
      '第三章第二节 流程与时限。流程依次为：在线提交申请 → 资质初审（5 个工作日）→ 现场审核（A/B 级候选必做）→ 供应商分级评定 → 签署框架协议。全流程目标 20 个工作日内完成。',
      '第四章 供应商分级与账期。综合评分 ≥ 85 为 A 级，70–84 为 B 级，60–69 为 C 级。付款账期：A 级 60 天、B 级 45 天、C 级 30 天。连续两个季度评分下滑即触发复审。',
    ].join('\n\n'),
  },
  {
    id: 'doc-q3',
    title: '2026 Q3 季度经营复盘',
    kind: 'doc',
    owner: '经营分析部 · 沈以宁',
    updated: iso(3 * DAY),
    content: [
      '二、各区域毛利率。华东 34.2%、华南 31.8%、华北 28.6%、西南 22.4%、东北 26.9%。环比看，华东 +1.2pct、华北 +0.6pct，华南 -0.4pct、西南 -1.1pct。',
      '三、口径说明。毛利率 =（营业收入 − 营业成本）/ 营业收入，全量按不含税口径统计；区域归属以客户主体注册地为准。经营会决议：Q4 华南区供应链降本 3pct，由采购部牵头。',
    ].join('\n\n'),
  },
  {
    id: 'doc-sec',
    title: '数据安全分级规范 v2.3',
    kind: 'doc',
    owner: '安全委员会',
    updated: isoDay(118),
    content: [
      '第三章 数据分级。全司数据分四级：L1 公开、L2 内部、L3 机密、L4 核心机密。客户联系方式、合同金额属 L3；源代码、密钥属 L4。',
      '第三章第三节 使用约束。L3 及以上文档外发需经 DLP 审批并添加水印；客户手机号在任何展示界面一律脱敏（如 138****5678）；L4 数据禁止离开生产网。',
      '第五章 定级复核。新增字段上线前由数据 Owner 完成定级；每季度安全委员会复核一次全量定级，超期未复核的字段自动降级为 L3 并告警。',
    ].join('\n\n'),
  },
  {
    id: 'doc-board',
    title: '董事会经营简报（未公开）',
    kind: 'mail',
    owner: '董事长办公室',
    updated: iso(20 * HOUR),
    content: [
      '本期简报含未公开的并购意向与毛利率目标区间，属 L3 机密，仅限董事会成员查阅。摘要段落按权限策略对普通账号打码展示。',
    ].join('\n\n'),
  },
];

/* ═══════════════ §2 问答：来源（KbCitation）+ 预置问题 + 生成引擎 ═══════════════ */

/** 引用来源池：角标编号 ↔ 来源的映射由渲染端按数组序对齐 */
export const CORPUS_CITATIONS: KbCitation[] = [
  {
    id: 'cite-vendor-mat',
    title: '供应商准入手册 v4.2 · 准入材料清单',
    kind: 'wiki',
    url: 'https://wiki.icen.ai/procurement/vendor-handbook#s3',
    official: true,
    date: iso(6 * HOUR),
    permission: 'readable',
    documentId: 'doc-vendor',
    citedText: '新供应商申请准入需提交以下材料：营业执照副本、近两年审计报告、质量体系认证（ISO 9001 或同等）、样品检测报告，以及环保合规声明。',
    loc: { kind: 'page', start: 3, end: 3 },
    score: 0.87,
    scoreKind: 'hybrid',
  },
  {
    id: 'cite-vendor-flow',
    title: '供应商准入手册 v4.2 · 流程与账期',
    kind: 'wiki',
    url: 'https://wiki.icen.ai/procurement/vendor-handbook#s4',
    official: true,
    date: iso(6 * HOUR),
    permission: 'readable',
    documentId: 'doc-vendor',
    citedText: '综合评分 ≥ 85 为 A 级。付款账期：A 级 60 天、B 级 45 天、C 级 30 天。连续两个季度评分下滑即触发复审。',
    loc: { kind: 'page', start: 4, end: 4 },
    score: 0.74,
    scoreKind: 'hybrid',
  },
  {
    id: 'cite-q3-margin',
    title: '2026 Q3 季度经营复盘 · 各区域毛利率',
    kind: 'doc',
    date: iso(3 * DAY),
    permission: 'readable',
    documentId: 'doc-q3',
    citedText: '华东 34.2%、华南 31.8%、华北 28.6%、西南 22.4%、东北 26.9%。毛利率 =（营业收入 − 营业成本）/ 营业收入，全量按不含税口径统计。',
    loc: { kind: 'char', start: 214, end: 402, unit: 'char' },
    score: 0.91,
    scoreKind: 'hybrid',
  },
  {
    id: 'cite-sec',
    title: '数据安全分级规范 v2.3 · 使用约束',
    kind: 'doc',
    official: true,
    date: isoDay(118),
    permission: 'readable',
    documentId: 'doc-sec',
    citedText: 'L3 及以上文档外发需经 DLP 审批并添加水印；客户手机号在任何展示界面一律脱敏（如 138****5678）。',
    loc: { kind: 'block', start: 12, end: 18 },
    score: 0.66,
    scoreKind: 'hybrid',
  },
  {
    id: 'cite-board',
    title: '董事会经营简报（未公开）',
    kind: 'mail',
    date: iso(20 * HOUR),
    permission: 'restricted',
    owner: '董事长办公室',
    documentId: 'doc-board',
    citedText: '本期简报含未公开的并购意向与毛利率目标区间，属 L3 机密，仅限董事会成员查阅。本期营收符合预算进度，目标区间详见附件 B。',
    score: null,
    scoreKind: 'hybrid',
  },
];

/** kb-passage 的取数表（getDocument 回调查这里） */
export const PASSAGE_DOCS: Record<string, { content: string; contextBefore?: string; contextAfter?: string }> = {
  'doc-vendor': {
    content: CORPUS_DOCS[0]!.content,
    contextBefore: '（第二章 供应商合作原则……前文略）',
    contextAfter: '（第五章 退出机制……后文略）',
  },
  'doc-q3': {
    content: CORPUS_DOCS[1]!.content,
    contextBefore: '（一、总体经营情况……前文略）',
    contextAfter: '（四、下季度重点……后文略）',
  },
  'doc-sec': {
    content: CORPUS_DOCS[2]!.content,
    contextBefore: '（第二章 组织与职责……前文略）',
    contextAfter: '（第六章 事件处置……后文略）',
  },
  'doc-board': { content: '' },
};

export interface QaPreset {
  q: string;
  /** 回答正文（[n] 与 cites 序对齐） */
  a: string;
  cites: string[];
}

export const QA_PRESETS: QaPreset[] = [
  {
    q: '新供应商准入需要哪些材料？',
    a: '新供应商准入需提交五类材料：营业执照副本、近两年审计报告、质量体系认证（ISO 9001 或同等）、样品检测报告与环保合规声明 [1]。流程依次为在线提交 → 资质初审（5 个工作日）→ 现场审核 → 分级评定 → 签署框架协议 [2]。',
    cites: ['cite-vendor-mat', 'cite-vendor-flow'],
  },
  {
    q: '上一季度各区域毛利率多少？口径是什么？',
    a: '2026 Q3 各区域毛利率：华东 34.2%、华南 31.8%、华北 28.6%、西南 22.4%、东北 26.9% [1]。口径为（营业收入 − 营业成本）/ 营业收入，全量按不含税口径统计，区域归属以客户主体注册地为准 [1]。另：Q4 华南区已立项供应链降本 3pct [2]。',
    cites: ['cite-q3-margin', 'cite-vendor-flow'],
  },
];

const clipText = (s: string, max = 64): string => (s.length > max ? `${s.slice(0, max)}…` : s);

/**
 * 自由输入的 mock 问答引擎：走真实打分器取 top2，拼装带 [1][2] 角标的回答。
 * 零命中时返回无引用回答（渲染端给 kb-sources 空态——无死路）。
 */
export function buildFreeAnswer(query: string): { text: string; cites: string[] } {
  const hits = scoreQuery(query, { topK: 4, mode: 'hybrid', alpha: 0.6, rerank: false, threshold: null })
    .filter((h) => h.score != null);
  if (!hits.length) {
    return {
      text: `知识库中未命中与「${clipText(query, 24)}」直接相关的内容。可以换个说法重试，或到「观测」标签页查看未命中查询的治理建议（建文档 / 加同义词）。`,
      cites: [],
    };
  }
  const docTitle = (documentId?: string): string =>
    CORPUS_DOCS.find((d) => d.id === documentId)?.title ?? documentId ?? '未命名文档';
  /* 引用按文档去重：同一文档的多段命中共用一个编号（与来源列表一一对应） */
  const seenDocs = new Set<string>();
  const picked: Array<{ hit: (typeof hits)[number]; n: number }> = [];
  for (const hit of hits) {
    const docId = hit.documentId ?? '';
    if (seenDocs.has(docId)) continue;
    seenDocs.add(docId);
    picked.push({ hit, n: picked.length + 1 });
    if (picked.length >= 2) break;
  }
  const parts = picked.map(({ hit, n }) => `${clipText(hit.snippet.replace(/\s+/g, ' '), 72)} [${n}]`);
  return {
    text: `关于「${clipText(query, 24)}」，检索到以下依据：${parts.join('；')}。来源：《${docTitle(picked[0]!.hit.documentId)}》${
      picked[1] ? `与《${docTitle(picked[1]!.hit.documentId)}》` : ''
    }。以上为语料重合度示意回答，非真实生成。`,
    cites: picked.map(({ hit }) => {
      const docId = hit.documentId ?? '';
      return CORPUS_CITATIONS.find((c) => c.documentId === docId)?.id ?? 'cite-vendor-mat';
    }),
  };
}

/* ═══════════════ §3 检索域：chunk 预切分 + 真实打分器 ═══════════════ */

export const RETRIEVAL_CHUNKS: KbChunk[] = [
  {
    id: 'chk-v-101',
    documentId: 'doc-vendor',
    content: '新供应商申请准入需提交以下材料：营业执照副本、近两年审计报告、质量体系认证（ISO 9001 或同等）、样品检测报告，以及环保合规声明。',
    keywords: ['准入', '材料清单', 'ISO 9001'],
    available: true,
    page: 3,
  },
  {
    id: 'chk-v-102',
    documentId: 'doc-vendor',
    content: '流程依次为：在线提交申请 → 资质初审（5 个工作日）→ 现场审核（A/B 级候选必做）→ 供应商分级评定 → 签署框架协议。全流程目标 20 个工作日内完成。',
    keywords: ['流程', '初审', '现场审核'],
    available: true,
    page: 3,
  },
  {
    id: 'chk-v-103',
    documentId: 'doc-vendor',
    content: '综合评分 ≥ 85 为 A 级，70–84 为 B 级，60–69 为 C 级。付款账期：A 级 60 天、B 级 45 天、C 级 30 天。',
    keywords: ['分级', '账期', '评分'],
    available: true,
    page: 4,
  },
  {
    id: 'chk-q-201',
    documentId: 'doc-q3',
    content: '各区域毛利率：华东 34.2%、华南 31.8%、华北 28.6%、西南 22.4%、东北 26.9%。环比：华东 +1.2pct、西南 -1.1pct。',
    keywords: ['毛利率', '区域', '环比'],
    available: true,
    page: 2,
  },
  {
    id: 'chk-q-202',
    documentId: 'doc-q3',
    content: '毛利率 =（营业收入 − 营业成本）/ 营业收入，全量按不含税口径统计；区域归属以客户主体注册地为准。Q4 华南区供应链降本 3pct。',
    keywords: ['口径', '不含税', '降本'],
    available: true,
    page: 3,
  },
  {
    id: 'chk-s-301',
    documentId: 'doc-sec',
    content: '数据分四级：L1 公开、L2 内部、L3 机密、L4 核心机密。客户联系方式、合同金额属 L3；源代码、密钥属 L4。',
    keywords: ['分级', 'L3', 'L4'],
    available: true,
    page: 3,
  },
  {
    id: 'chk-s-302',
    documentId: 'doc-sec',
    content: 'L3 及以上文档外发需经 DLP 审批并添加水印；客户手机号在任何展示界面一律脱敏（如 138****5678）；L4 数据禁止离开生产网。',
    keywords: ['外发', 'DLP', '脱敏'],
    available: true,
    page: 4,
  },
  {
    id: 'chk-s-303',
    documentId: 'doc-sec',
    content: '每季度安全委员会复核一次全量定级，超期未复核的字段自动降级为 L3 并告警。（历史版本：2019 版曾要求全部字段每年线下报备，已于 v2.0 废止。）',
    keywords: ['复核', '定级'],
    available: false, /* is-off：不删除但排除出检索 */
    page: 5,
    meta: { offReason: '历史条款已废止' },
  },
  {
    id: 'chk-b-401',
    documentId: 'doc-board',
    content: '本期简报含未公开的并购意向与毛利率目标区间，属 L3 机密，仅限董事会成员查阅。毛利率 经营 目标 董事会。',
    keywords: ['董事会', '毛利率目标'],
    available: true,
    page: 1,
  },
];

/* —— 打分器：token 重合（真实计算，非查表）—— */

/** 分词：CJK 相邻二元组 + 拉丁/数字词（≥2 字符）；小写归一 */
export function tokenizeZh(text: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();
  const runs = lower.match(/[\u4e00-\u9fff]+|[a-z0-9][a-z0-9.+-]+/g) ?? [];
  for (const run of runs) {
    if (/^[\u4e00-\u9fff]+$/.test(run)) {
      for (let i = 0; i + 1 < run.length; i++) out.push(run.slice(i, i + 2));
      if (run.length === 1) out.push(run);
    } else if (run.length >= 2) {
      out.push(run);
    }
  }
  return out;
}

/** 确定性字符串哈希（djb2 → 0–1）：给「语义分」提供稳定抖动源 */
function hash01(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return (h % 10_000) / 10_000;
}

const chunkTokens = new Map<string, Set<string>>(
  RETRIEVAL_CHUNKS.map((c) => [c.id, new Set([...tokenizeZh(c.content), ...(c.keywords ?? []).map((k) => k.toLowerCase())])]),
);

/**
 * mock 检索打分器：关键词分 = query token 对 chunk token 的重合率；
 * 语义分 = 重合率与确定性哈希的混合（同一 query+chunk 结果恒定）。
 * 按 params.mode / alpha 组合出 0–1 分与 vectorPart/keywordPart 拆解；
 * 受限块（doc-board）恒 score:null ——「无分命中」一等状态演示。
 */
export function scoreQuery(query: string, params: KbRetrievalParams): KbRetrievalHit[] {
  const qTokens = [...new Set(tokenizeZh(query ?? ''))];
  if (!qTokens.length) return [];
  const mode = params.mode;
  const alpha = mode === 'vector' ? 1 : mode === 'keyword' ? 0 : params.alpha ?? 0.5;

  const build = (chunk: (typeof RETRIEVAL_CHUNKS)[number], hitTokens: string[], semantic: boolean): KbRetrievalHit => {
    const kw = hitTokens.length / qTokens.length;
    const sem = kw * 0.7 + hash01(`${query}::${chunk.id}`) * 0.3;
    const vec = Math.min(0.97, 0.08 + sem);
    const score = alpha * vec + (1 - alpha) * kw;
    const restricted = chunk.documentId === 'doc-board';
    const doc = CORPUS_DOCS.find((d) => d.id === chunk.documentId);
    return {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      title: `${doc?.title ?? chunk.documentId} · 第 ${chunk.page ?? '?'} 页`,
      snippet: chunk.content,
      score: restricted ? null : Math.round(Math.max(0.04, Math.min(0.97, score)) * 1000) / 1000,
      scoreKind: 'hybrid',
      vectorPart: Math.round(vec * 1000) / 1000,
      keywordPart: Math.round(kw * 1000) / 1000,
      page: chunk.page,
      explain: `命中词 ${hitTokens.length}/${qTokens.length}（${hitTokens.slice(0, 4).join(' / ') || '无'}）；语义 ${vec.toFixed(2)} × 关键词 ${kw.toFixed(2)}，α=${alpha.toFixed(2)}${semantic ? '；语义召回（零词重合）' : ''}${restricted ? '；受限块不下发分数' : ''}`,
      meta: hitTokens.length ? { hit: `${hitTokens.length} 词` } : { hit: '语义召回' },
    };
  };

  const keywordHits: KbRetrievalHit[] = [];
  const semanticOnly: Array<{ hit: KbRetrievalHit; vec: number }> = [];
  for (const chunk of RETRIEVAL_CHUNKS) {
    if (!chunk.available) continue;
    const tokens = chunkTokens.get(chunk.id)!;
    const hitTokens = qTokens.filter((t) => tokens.has(t));
    if (hitTokens.length > 0) keywordHits.push(build(chunk, hitTokens, false));
    else if (mode !== 'keyword') {
      /* 向量/混合模式：零词重合的块仍有语义分（确定性哈希），作为语义召回候选 */
      semanticOnly.push({ hit: build(chunk, hitTokens, true), vec: hash01(`${query}::${chunk.id}`) });
    }
  }
  keywordHits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  semanticOnly.sort((a, b) => b.vec - a.vec);
  /* 关键词命中优先；语义召回最多补 2 块（vector 模式放开到 topK）。
     混合模式下零词重合 = 域外语料 → 判零结果（演示「零结果 → 观测治理」链路）；
     纯向量模式仍给语义召回（跨语言/无精确词是向量模式的存在理由）。 */
  const pad = mode === 'vector' ? params.topK : keywordHits.length ? 2 : 0;
  const scored = [...keywordHits, ...semanticOnly.slice(0, pad).map((s) => s.hit)];
  const finite = scored.filter((s) => s.score != null);
  const nulls = scored.filter((s) => s.score == null);
  return [...finite.slice(0, params.topK), ...nulls.slice(0, 1)];
}

/** rerank 对比数据：对固定 query 的打分结果做确定性重排（演示 before/after） */
export function buildRerankDemo(): { before: KbRetrievalHit[]; after: KbRetrievalHit[]; model: string } {
  const base = scoreQuery('供应商 准入 材料 流程 账期', { topK: 6, mode: 'hybrid', alpha: 0.5, rerank: false, threshold: null })
    .filter((h) => h.score != null);
  const before = base.map((h, i) => ({ ...h, scoreKind: 'cosine' as const }));
  /* rerank 后：意图相关（材料/流程）前置，账期细节下沉一位 */
  const order = [0, 1, 3, 2, 4, 5].map((i) => before[i]).filter(Boolean) as typeof before;
  const after = order.map((h, i) => ({
    ...h,
    score: Math.round(Math.min(0.98, (h.score ?? 0.5) + (i === 0 ? 0.06 : i === 1 ? 0.02 : -0.04 * i)) * 1000) / 1000,
    scoreKind: 'rerank' as const,
  }));
  return { before, after, model: 'bge-reranker-v2' };
}

/** 召回测试集（3 题；expectedChunkIds 与 RETRIEVAL_CHUNKS 对齐） */
export const HIT_CASES: KbHitTestCase[] = [
  { id: 'ht-1', question: '新供应商准入需要哪些材料？', expectedChunkIds: ['chk-v-101', 'chk-v-102'], pinned: true },
  { id: 'ht-2', question: '毛利率的统计口径是什么？', expectedChunkIds: ['chk-q-202'] },
  { id: 'ht-3', question: '客户手机号展示有什么要求？', expectedChunkIds: ['chk-s-302'] },
];

/** 检索 playground 的初始过滤树（kb-filter 初值；mongo/odata 双序列化由组件完成） */
export const FILTER_DEMO: KbFilterNode = {
  type: 'group',
  op: 'and',
  children: [
    { type: 'rule', field: 'kind', op: 'eq', value: 'doc' },
    {
      type: 'group',
      op: 'or',
      children: [
        { type: 'rule', field: 'owner', op: 'contains', value: '安全' },
        { type: 'rule', field: 'updated', op: 'gte', value: '2026-07-01' },
      ],
    },
  ],
};

/* ═══════════════ §4 摄取域：连接器 / 管线 / 分段 / chunk 编辑器 ═══════════════ */

export const CONNECTORS: KbConnector[] = [
  {
    id: 'con-confluence',
    name: 'Confluence',
    kind: 'wiki',
    scope: '空间：/procurement + /security',
    enabled: true,
    lastSyncAt: iso(2 * HOUR),
    lastCrawlStatus: 'ok',
    itemsSynced: 1204,
    crawlRate: 86,
    changeRate: 12,
    credential: 'ok',
    schedule: '每周一 08:00',
    metrics: { added: 18, updated: 64, deleted: 2, failed: 0, lastSyncAt: iso(2 * HOUR) },
  },
  {
    id: 'con-sharepoint',
    name: 'SharePoint',
    kind: 'doc',
    scope: '站点：经营分析 / sites/ops-review',
    enabled: true,
    lastSyncAt: iso(3 * DAY + 2 * HOUR),
    lastCrawlStatus: 'ok',
    itemsSynced: 3862,
    crawlRate: 0,
    changeRate: 0,
    credential: 'ok',
    schedule: '每天 03:00',
    metrics: { added: 0, updated: 0, deleted: 0, failed: 0, lastSyncAt: iso(3 * DAY + 2 * HOUR) },
  },
  {
    id: 'con-ticket',
    name: '工单系统',
    kind: 'ticket',
    scope: '视图：已解决方案库',
    enabled: true,
    lastSyncAt: iso(9 * HOUR),
    lastCrawlStatus: 'fail',
    itemsSynced: 7518,
    crawlRate: 240,
    changeRate: 33,
    credential: 'expired',
    schedule: '手动',
    metrics: { added: 0, updated: 0, deleted: 0, failed: 412, lastSyncAt: iso(9 * HOUR) },
  },
];

const VENDOR_STEPS = [
  { key: 'download', label: '下载', status: 'done' as const, detail: 'PDF 12 页', elapsedMs: 812 },
  { key: 'parse', label: '解析', status: 'done' as const, detail: '3 表 / 12 页', elapsedMs: 2410 },
  { key: 'clean', label: '清洗', status: 'done' as const, detail: '去页眉 34 处', elapsedMs: 380 },
  { key: 'segment', label: '切分', status: 'done' as const, count: 42, elapsedMs: 1180 },
  { key: 'embed', label: '向量化', status: 'done' as const, detail: 'bge-m3', count: 42, elapsedMs: 3120 },
  { key: 'index', label: '入库', status: 'done' as const, elapsedMs: 640 },
];

export const PIPELINE_RUNS: KbPipelineRun[] = [
  {
    documentId: 'doc-vendor',
    title: '供应商准入手册 v4.2.pdf',
    status: 'done',
    steps: VENDOR_STEPS,
    chunkCount: 42,
    elapsedMs: 8542,
  },
  {
    documentId: 'doc-q3',
    title: '2026 Q3 季度经营复盘.docx',
    status: 'running',
    progress: 64,
    steps: [
      VENDOR_STEPS[0]!,
      { ...VENDOR_STEPS[1]!, detail: '1 表 / 8 页' },
      { ...VENDOR_STEPS[2]!, detail: '去批注 6 处', elapsedMs: 210 },
      { key: 'segment', label: '切分', status: 'done' as const, count: 18, elapsedMs: 640 },
      { key: 'embed', label: '向量化', status: 'running' as const, detail: 'bge-m3 · 12/18', count: 12 },
      { key: 'index', label: '入库', status: 'unstart' as const },
    ],
    chunkCount: 18,
  },
  {
    documentId: 'doc-sec',
    title: '数据安全分级规范 v2.3（扫描件）.pdf',
    status: 'fail',
    steps: [
      { key: 'download', label: '下载', status: 'done' as const, detail: '扫描版 PDF 9 页', elapsedMs: 940 },
      { key: 'parse', label: '解析', status: 'fail' as const, detail: '无文本层', elapsedMs: 1210 },
      { key: 'clean', label: '清洗', status: 'unstart' as const },
      { key: 'segment', label: '切分', status: 'unstart' as const },
      { key: 'embed', label: '向量化', status: 'unstart' as const },
      { key: 'index', label: '入库', status: 'unstart' as const },
    ],
    error: { stage: '解析阶段', message: '扫描版 PDF 无文本层——请上传 OCR 版本后重跑，或接入 OCR 管线（管理台 → 解析配置）' },
  },
];

/** 失败文档「重跑」按钮的成功快照（接线侧 setTimeout 后替换渲染） */
export function pipelineRerunResult(documentId: string): KbPipelineRun {
  if (documentId === 'doc-sec') {
    return {
      documentId: 'doc-sec',
      title: '数据安全分级规范 v2.3（OCR 后）.pdf',
      status: 'done',
      steps: [
        { key: 'download', label: '下载', status: 'done', detail: 'OCR 版 PDF 9 页', elapsedMs: 1080 },
        { key: 'parse', label: '解析', status: 'done', detail: 'OCR 置信度 0.94', elapsedMs: 3260 },
        { key: 'clean', label: '清洗', status: 'done', detail: '去噪 121 处', elapsedMs: 520 },
        { key: 'segment', label: '切分', status: 'done', count: 31, elapsedMs: 910 },
        { key: 'embed', label: '向量化', status: 'done', detail: 'bge-m3', count: 31, elapsedMs: 2280 },
        { key: 'index', label: '入库', status: 'done', count: 31, elapsedMs: 480 },
      ],
      chunkCount: 31,
      elapsedMs: 8530,
    };
  }
  return PIPELINE_RUNS[0]!;
}

/** 分段策略样例文本（真实走 segmentText 切分；含 URL/邮箱/多空行供清洗选项演示） */
export const SEGMENT_SAMPLE = [
  '供应商准入材料清单。营业执照副本、近两年审计报告、质量体系认证、样品检测报告。',
  '',
  '',
  '办理入口：https://procure.icen.ai/vendor/apply，咨询邮箱 vendor@icen.ai。',
  '资质初审 5 个工作日；现场审核仅 A/B 级候选必做；评分 ≥ 85 为 A 级，账期 60 天。',
  '',
  '复审规则：连续两个季度评分下滑触发复审；复审材料与首次准入一致。',
].join('\n');

export const SEGMENT_CONFIG: Partial<KbSegmentConfig> = {
  mode: 'auto',
  delimiter: '\\n\\n',
  maxLength: 120,
  overlap: 20,
  clean: ['collapse-blank', 'strip-url'],
};

/** chunk 编辑器数据（≥6 条：含 is-off、keywords、已编辑标记） */
export const EDITOR_CHUNKS: KbChunk[] = [
  {
    id: 'chk-v-101',
    documentId: 'doc-vendor',
    content: '新供应商申请准入需提交以下材料：营业执照副本、近两年审计报告、质量体系认证（ISO 9001 或同等）、样品检测报告，以及环保合规声明。',
    keywords: ['准入', '材料清单'],
    available: true,
    page: 3,
    edited: true,
  },
  {
    id: 'chk-v-102',
    documentId: 'doc-vendor',
    content: '流程依次为：在线提交申请 → 资质初审（5 个工作日）→ 现场审核（A/B 级候选必做）→ 供应商分级评定 → 签署框架协议。',
    keywords: ['流程', '初审'],
    available: true,
    page: 3,
  },
  {
    id: 'chk-v-103',
    documentId: 'doc-vendor',
    content: '综合评分 ≥ 85 为 A 级，70–84 为 B 级，60–69 为 C 级。付款账期：A 级 60 天、B 级 45 天、C 级 30 天。',
    keywords: ['分级', '账期'],
    available: true,
    page: 4,
  },
  {
    id: 'chk-v-104',
    documentId: 'doc-vendor',
    content: '（历史条款）2019 版要求全部供应商每年线下报备年检材料，已于 v4.0 废止。',
    keywords: ['废止'],
    available: false,
    page: 5,
    meta: { offReason: '已废止条款' },
  },
  {
    id: 'chk-q-201',
    documentId: 'doc-q3',
    content: '各区域毛利率：华东 34.2%、华南 31.8%、华北 28.6%、西南 22.4%、东北 26.9%。',
    keywords: ['毛利率', '区域'],
    available: true,
    page: 2,
  },
  {
    id: 'chk-q-202',
    documentId: 'doc-q3',
    content: '毛利率 =（营业收入 − 营业成本）/ 营业收入，全量按不含税口径统计；区域归属以客户主体注册地为准。',
    keywords: ['口径', '不含税'],
    available: true,
    page: 3,
  },
  {
    id: 'chk-s-301',
    documentId: 'doc-sec',
    content: '数据分四级：L1 公开、L2 内部、L3 机密、L4 核心机密。客户联系方式、合同金额属 L3。',
    keywords: ['L3', '分级'],
    available: true,
    page: 3,
  },
];

/* ═══════════════ §5 问数域：SQL + 答案组合 ═══════════════ */

export const SQL_QUERY = {
  sql: [
    "SELECT region_name,",
    "       ROUND((SUM(revenue_excl_tax) - SUM(cogs_excl_tax))",
    "             / NULLIF(SUM(revenue_excl_tax), 0), 4) AS gross_margin",
    "FROM dws_region_summary",
    "WHERE quarter = '2026Q3'",
    "  AND is_deleted = false",
    "GROUP BY region_name",
    "ORDER BY gross_margin DESC;",
  ].join('\n'),
  prevSql: [
    "SELECT region_name,",
    "       ROUND(SUM(revenue) - SUM(cogs) / SUM(revenue), 4) AS gross_margin",
    "FROM dws_region_summary",
    "WHERE quarter = '2026Q3'",
    "GROUP BY region_name",
    "ORDER BY gross_margin DESC;",
  ].join('\n'),
  dialect: 'postgres',
  tables: ['dws_region_summary'],
  visibility: 'all' as const,
  editable: true,
  reasoning: '上版把 SUM(revenue) 当不含税口径且运算优先级有误；本版改用 revenue_excl_tax/cogs_excl_tax 并补 is_deleted 过滤。',
};

export const ANSWER_CHART: ChartSpec = {
  type: 'line',
  title: '2026 Q3 各区域毛利率（不含税）',
  labels: ['华东', '华南', '华北', '东北', '西南'],
  values: [34.2, 31.8, 28.6, 26.9, 22.4],
  format: { notation: 'percent' },
};

export const ANSWER_MODEL = {
  kind: 'verified' as const,
  verifiedVia: {
    assetId: 'pq-region-gross-margin',
    assetType: 'parameterized-query' as const,
    note: '区域毛利率 · 季度（参数：quarter）',
  },
  body: '上一季度（2026 Q3）各区域毛利率：华东 34.2% 居首，西南 22.4% 最低；环比仅华东、华北改善 [1]。以下结果由语义层认证资产生成，口径为不含税。',
  citations: [CORPUS_CITATIONS[2]!],
  clarify: {
    id: 'tax-scope',
    question: '「毛利率」按含税还是不含税口径？',
    options: [
      { label: '不含税（财务默认）', value: 'excl' },
      { label: '含税', value: 'incl' },
    ],
    reason: '检测到口径歧义：财务报表默认不含税，部分业务看板使用含税——已按不含税生成，可点选切换。',
  },
  explain: {
    tables: ['dws_region_summary'],
    columns: ['region_name', 'revenue_excl_tax', 'cogs_excl_tax'],
    filters: ["quarter = '2026Q3'", 'is_deleted = false'],
    aggregates: ['SUM(revenue_excl_tax)', 'SUM(cogs_excl_tax)'],
    metrics: [{ name: '毛利率（不含税）', ref: '/kb/data/metrics/gm-excl' }],
  },
  permissionNotice: {
    rowLevelPolicy: '明细行仅可见你所属大区（华东）',
    maskedColumns: ['customer_phone'],
  },
  result: {
    columns: [
      { name: '区域', type: 'text' },
      { name: '毛利率 (%)', type: 'numeric' },
      { name: '环比 (pct)', type: 'numeric' },
    ],
    rows: [
      ['华东', 34.2, 1.2],
      ['华南', 31.8, -0.4],
      ['华北', 28.6, 0.6],
      ['东北', 26.9, null],
      ['西南', 22.4, -1.1],
    ] as Array<Array<string | number | null>>,
    rowCount: 5,
    totalRows: 31,
    truncated: true,
    limit: 5,
    durationMs: 246,
    exportFormats: ['csv', 'xlsx'],
  },
  chartSpec: ANSWER_CHART,
  followUps: ['按季度拆分看趋势', '华南降本进展如何', '按含税口径重算'],
};

/* ═══════════════ §6 观测域：trace / 标注 / 无答案 / 评估 ═══════════════ */

export const TRACE_SPANS: KbSpan[] = [
  {
    id: 'sp-retr',
    kind: 'retrieval',
    name: 'hybrid 检索 · topK=6',
    status: 'done',
    elapsedMs: 212,
    detail: 'α=0.6 · 授权集合内命中 5 块',
    hits: scoreQuery('供应商 准入 材料 流程 账期', { topK: 5, mode: 'hybrid', alpha: 0.6, rerank: false, threshold: null }),
  },
  { id: 'sp-embed', parentId: 'sp-retr', kind: 'embed', name: 'bge-m3 向量化', status: 'done', elapsedMs: 38, detail: 'query 24 tok' },
  {
    id: 'sp-guard',
    parentId: 'sp-retr',
    kind: 'guard',
    name: '权限过滤',
    status: 'done',
    elapsedMs: 9,
    /* 呈现纪律（spec §9.0-2）：对受限侧沉默——只陈述恒定事实，不带被裁数量 */
    detail: 'pre-filter 已按检索身份裁剪候选集',
  },
  { id: 'sp-rerank', kind: 'rerank', name: 'bge-reranker-v2', status: 'done', elapsedMs: 184, detail: '5 → 3，阈值 0.35 淘汰 2' },
  {
    id: 'sp-gen',
    kind: 'generation',
    name: 'glm-5.3 生成',
    status: 'done',
    elapsedMs: 1930,
    detail: '引用 2 处 · 温度 0.2',
    usage: { inputTokens: 1840, outputTokens: 320, costUsd: 0.0021 },
  },
  {
    id: 'sp-pii',
    parentId: 'sp-gen',
    kind: 'guard',
    name: 'PII 复扫',
    status: 'error',
    elapsedMs: 14,
    error: '检测到 1 个手机号未脱敏（chk-s-302）——已按 L3 策略替换为 138****5678 后放行',
  },
];

export const REVIEW_CONFIGS: KbScoreConfig[] = [
  { name: '正确性', type: 'categorical', categories: ['对', '部分对', '错'], description: '与引用原文是否一致' },
  { name: '完整性', type: 'numeric', description: '0–10 · 是否答全用户问题' },
];

export const REVIEW_QUEUE: KbReviewTask[] = [
  {
    id: 'rv-1',
    target: { kind: 'answer', id: 'ans-8412', label: '新供应商准入需要哪些材料？' },
    status: 'open',
    assignee: '李航',
    scores: [{ name: '正确性', value: '对' }],
  },
  {
    id: 'rv-2',
    target: { kind: 'answer', id: 'ans-8407', label: '上一季度各区域毛利率多少？' },
    status: 'open',
    assignee: '沈以宁',
  },
  {
    id: 'rv-3',
    target: { kind: 'trace', id: 'trace-4821', label: 'RAG 链路 #4821 · PII 复扫报错' },
    status: 'open',
  },
];

export const GAP_QUERIES: KbGapQuery[] = [
  { text: '差旅报销标准 酒店限额', count: 34, shareOfAllQueries: 0.125, zeroClickRate: 0.412, lastSeenAt: iso(2 * DAY) },
  { text: '试用期社保缴纳基数', count: 21, shareOfAllQueries: 0.077, zeroClickRate: 0.286, lastSeenAt: iso(5 * DAY) },
];

export const GAP_TREND: Array<{ label: string; value: number }> = Array.from({ length: 12 }, (_, i) => ({
  label: new Date(NOW - (11 - i) * DAY).toISOString().slice(5, 10),
  value: Math.round(14 + 10 * Math.abs(Math.sin(i * 0.83)) + (i === 9 ? 12 : 0)),
}));

export const EVAL_RUNS = [
  { id: 'run-118', label: 'run-118 · 基线' },
  { id: 'run-127', label: 'run-127 · +重排' },
];

export const EVAL_ROWS: KbEvalRow[] = [
  {
    key: 'q-12',
    input: '新供应商准入需要哪些材料？',
    outputA: '需要营业执照、审计报告等材料，具体请联系采购部。',
    outputB: '需提交五类材料：营业执照副本、近两年审计报告、质量体系认证、样品检测报告与环保合规声明。',
    expected: '五类材料清单（营业执照/审计报告/体系认证/检测报告/环保声明）',
    scoresA: { faithfulness: 0.4, relevance: 0.6 },
    scoresB: { faithfulness: 0.95, relevance: 0.9 },
  },
  {
    key: 'q-31',
    input: '客户手机号在报表里怎么展示？',
    outputA: '手机号需要脱敏处理。',
    outputB: '按 L3 策略一律脱敏（138****5678），外发还需 DLP 审批与水印。',
    expected: '脱敏格式 + DLP 审批要求',
    scoresA: { faithfulness: 0.7, relevance: 0.5 },
    scoresB: { faithfulness: 0.9, relevance: 0.85 },
  },
  {
    key: 'q-07',
    input: 'A 级供应商的账期是多久？',
    outputA: 'A 级供应商付款账期为 60 天，连续两季度评分下滑触发复审。',
    outputB: 'A 级供应商付款账期为 45 天。',
    expected: '60 天（A 级）',
    scoresA: { faithfulness: 1.0, relevance: 0.95 },
    scoresB: { faithfulness: 0.5, relevance: 0.9 },
  },
];

/* ═══════════════ §7 Agent 域：画布 / diff / 检查点 / 沙箱 / 图谱 ═══════════════ */

export const AGENT_CHAT_SEED: Array<{ role: 'user' | 'assistant'; content: string; meta?: string }> = [
  { role: 'user', content: '把《数据安全分级规范》第 3 章改写成可执行的 checklist。' },
  {
    role: 'assistant',
    content: '已定位 3.1–3.4 节共 9 条规范。计划：改写为 9 项检查项，外发审批类单独分组；改完会在右栏生成 diff 供你逐文件审阅。',
    meta: 'glm-5.3 · 刚刚',
  },
  { role: 'user', content: '术语统一用「数据等级」，不要再出现「密级」。' },
];

export const AGENT_DOC_FRAGMENT = {
  title: '数据安全分级规范 v2.3 · 第三章',
  paragraphs: [
    '3.1 全司数据分四级：L1 公开、L2 内部、L3 机密、L4 核心机密。',
    '3.3 L3 及以上文档外发需经 DLP 审批并添加水印；客户手机号在任何展示界面一律脱敏（如 138****5678）。',
    '3.4 L4 数据禁止离开生产网；每季度安全委员会复核一次全量定级。',
  ],
};

/** 画布右栏的两文件 unified diff（parseUnifiedDiff 消费；含修改 + 新增） */
export const AGENT_DIFF = [
  'diff --git a/docs/security-spec.md b/docs/security-spec.md',
  '--- a/docs/security-spec.md',
  '+++ b/docs/security-spec.md',
  '@@ -12,7 +12,7 @@',
  ' 第三章 数据等级',
  '-全司数据按密级分为四级。',
  '+全司数据按数据等级分为四级：L1 公开、L2 内部、L3 机密、L4 核心机密。',
  ' 客户联系方式、合同金额属 L3。',
  ' ',
  '@@ -28,5 +28,6 @@',
  ' L3 及以上文档外发需经 DLP 审批并添加水印。',
  '-手机号需脱敏。',
  '+客户手机号在任何展示界面一律脱敏（如 138****5678）。',
  '+每季度安全委员会复核一次全量定级，超期字段自动降级为 L3 并告警。',
  'diff --git a/docs/security-spec-checklist.md b/docs/security-spec-checklist.md',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/docs/security-spec-checklist.md',
  '@@ -0,0 +1,4 @@',
  '+# 第三章 Checklist',
  '+1. 外发前：DLP 审批已通过，水印已添加',
  '+2. 展示前：手机号已脱敏为 138****5674 格式',
  '+3. 定级：新增字段已完成定级，L4 未离开生产网',
  '+4. 复核：本季度定级复核记录已归档',
].join('\n');

export const AGENT_VERSIONS = [
  { id: 'v1', label: 'v1 · 初稿 9 项', at: NOW - 40 * 60_000 },
  { id: 'v2', label: 'v2 · 术语统一', at: NOW - 14 * 60_000 },
  { id: 'v3', label: 'v3 · checklist 拆分', at: NOW - 2 * 60_000, current: true },
];

export const AGENT_CHECKPOINTS: KbCheckpoint[] = [
  { id: 'cp-1', label: '改写前', at: NOW - 32 * 60_000, reason: '改写前自动保存', scopeOptions: ['content', 'both'] },
  { id: 'cp-2', label: '术语统一前', at: NOW - 15 * 60_000, reason: '批量替换前自动保存' },
  { id: 'cp-3', label: 'checklist 拆分前', at: NOW - 3 * 60_000, reason: '新文件创建前自动保存' },
];

/** 沙箱子应用：极简 MCP echo（单引号拼接；宿主 call('echo') 后在帧内回显回包） */
export const SANDBOX_HTML: string =
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
  '<style>' +
  "body{margin:0;font:13px/1.7 ui-monospace,Menlo,Consolas,monospace;color:#7a9a8a;background:#101613;padding:14px}" +
  ".t{font-weight:700;color:#a8c8b0;font-size:12px;letter-spacing:1px;margin-bottom:8px}" +
  ".log{white-space:pre-wrap;word-break:break-all;color:#c9d8cd}" +
  '</style></head><body>' +
  '<div class="t">ECHO · MCP 子应用</div>' +
  '<div class="log" id="log">等待宿主调用…</div>' +
  '<script>' +
  'var logEl=document.getElementById("log");' +
  'function log(m){logEl.textContent=m}' +
  'window.addEventListener("message",function(e){' +
  'var m=e.data;' +
  'if(!m||m.jsonrpc!=="2.0"||m.method==null){return}' +
  'if(m.method==="echo"){' +
  'var r={echo:(m.params&&m.params.text)||"",at:new Date().toISOString()};' +
  'log("收到 "+JSON.stringify(m.params)+"\\n回包 "+JSON.stringify(r));' +
  'e.source.postMessage({jsonrpc:"2.0",id:m.id,result:r},"*")' +
  '}' +
  '});' +
  'parent.postMessage({jsonrpc:"2.0",method:"app.ready"},"*");' +
  '</script></body></html>';

/** 实体图：三簇（供应商域 / 客户域 / 合规域）共 11 节点 */
export const GRAPH_SPEC: GraphSpec = {
  type: 'graph',
  title: '知识实体图 · 三域',
  nodes: [
    { id: 'supplier', label: '供应商', cluster: 'vendor', weight: 14, meta: { docs: 12 } },
    { id: 'audit', label: '审计报告', cluster: 'vendor' },
    { id: 'iso', label: 'ISO 9001', cluster: 'vendor' },
    { id: 'payment', label: '付款账期', cluster: 'vendor', weight: 10 },
    { id: 'grade', label: '供应商分级', cluster: 'vendor', weight: 11 },
    { id: 'customer', label: '客户', cluster: 'customer', weight: 13, meta: { docs: 21 } },
    { id: 'region', label: '区域', cluster: 'customer', weight: 10 },
    { id: 'margin', label: '毛利率', cluster: 'customer', weight: 12 },
    { id: 'order', label: '订单', cluster: 'customer' },
    { id: 'dlp', label: 'DLP 审批', cluster: 'compliance' },
    { id: 'mask', label: '手机号脱敏', cluster: 'compliance', weight: 9 },
    { id: 'level', label: '数据等级', cluster: 'compliance', weight: 12 },
  ],
  edges: [
    { source: 'supplier', target: 'audit', weight: 2 },
    { source: 'supplier', target: 'iso' },
    { source: 'supplier', target: 'grade', weight: 2 },
    { source: 'grade', target: 'payment', weight: 2 },
    { source: 'grade', target: 'level' },
    { source: 'customer', target: 'region', weight: 2 },
    { source: 'customer', target: 'order' },
    { source: 'region', target: 'margin', weight: 2 },
    { source: 'margin', target: 'payment' },
    { source: 'customer', target: 'mask', weight: 2 },
    { source: 'mask', target: 'dlp', weight: 2 },
    { source: 'mask', target: 'level', weight: 2 },
  ],
  clusterLabels: { vendor: '供应商域', customer: '客户域', compliance: '合规域' },
};

/** 投影点图：三簇散布（UMAP 产物示意） */
export const MAP_SPEC: MapSpec = {
  type: 'map',
  title: '语料投影 · UMAP',
  points: [
    { id: 'p1', x: 0.18, y: 0.24, cluster: 'vendor', label: '准入材料' },
    { id: 'p2', x: 0.24, y: 0.16, cluster: 'vendor', label: '准入流程' },
    { id: 'p3', x: 0.14, y: 0.35, cluster: 'vendor', label: '分级账期' },
    { id: 'p4', x: 0.29, y: 0.30, cluster: 'vendor', label: '现场审核' },
    { id: 'p5', x: 0.52, y: 0.62, cluster: 'customer', label: '区域毛利率' },
    { id: 'p6', x: 0.60, y: 0.55, cluster: 'customer', label: '口径说明' },
    { id: 'p7', x: 0.47, y: 0.72, cluster: 'customer', label: '降本项目' },
    { id: 'p8', x: 0.82, y: 0.28, cluster: 'compliance', label: '数据等级' },
    { id: 'p9', x: 0.88, y: 0.38, cluster: 'compliance', label: 'DLP 审批' },
    { id: 'p10', x: 0.76, y: 0.18, cluster: 'compliance', label: '脱敏规则' },
  ],
  clusters: { vendor: '供应商域', customer: '客户域', compliance: '合规域' },
};

/** Agent 标签页的流式链路示例步骤（运行按钮逐步推进） */
export const AGENT_CHAIN_STEPS = [
  { key: 'retrieve', label: '检索', status: 'pending' as const, detail: 'hybrid · topK=5' },
  { key: 'rewrite', label: '改写', status: 'pending' as const, detail: 'glm-5.3 · 温度 0.2' },
  { key: 'diff', label: '生成 diff', status: 'pending' as const, detail: '2 文件' },
  { key: 'review', label: '等待审阅', status: 'pending' as const, detail: '接受 / 拒绝' },
];

/* ═══════════════ §8 权限域（kb-perm，spec §9）：身份 / ACL / 申请 / 审计 / 可见性对照 ═══════════════ */
/*
 * 安全纪律（§9.0）同步到 mock：身份是固定身份集（服务端 token 枚举，无自由输入）；
 * deny 一票否决；到期一等公民；break-glass 审计粒度 ≥ 常规。演示数据围绕《2026 财务规划》
 * （公司库 › 财务部空间 继承链）与三个身份展开，与 /kb「权限」标签接线一一对应。
 */

/**
 * 固定身份集：张三 = 普通销售（仅组织基线授权）；王五 = 财务部（finance-team 继承 Editor）；
 * 系统审计员 = 服务账号（auditors / compliance 组）。
 */
export const PERM_IDENTITIES: KbIdentity[] = [
  { user: 'zhangsan', label: '张三 · 华东销售部', groups: ['sales-east', 'project-q3'] },
  { user: 'wangwu', label: '王五 · 财务部', groups: ['finance-team', 'auditors'] },
  { user: 'auditor', label: '系统审计员', groups: ['auditors', 'compliance'] },
];

/** 《2026 财务规划》的 ACL 面板模型（renderKbAcl 消费；结构对齐 spec §9.1 的 KbAclModel） */
export const PERM_ACL_DEMO: {
  resource: string;
  parentChain: string[];
  broken: boolean;
  exceptions?: { label: string; count: number };
  entries: KbAclEntry[];
  links: KbAclEntry[];
  exposureCount?: number;
} = {
  resource: '2026 财务规划',
  parentChain: ['公司库', '财务部空间'],
  /* 继承未断但有子项例外（banner 呈现「例外 1 项」的 is-partial 态） */
  broken: false,
  exceptions: { label: 'Q3 并购草案.docx', count: 1 },
  entries: [
    { subject: { kind: 'org', id: 'org-all', label: '全体员工' }, role: 'viewer', inheritedFrom: '公司库' },
    {
      subject: { kind: 'group', id: 'finance-team', label: 'finance-team', note: '24 成员 · 由 IT 管理' },
      role: 'editor',
      inheritedFrom: '财务部空间',
    },
    { subject: { kind: 'group', id: 'auditors', label: 'auditors', note: '6 成员' }, role: 'viewer' },
    { subject: { kind: 'user', id: 'u-lisi', label: '李四' }, role: 'owner' },
    { subject: { kind: 'user', id: 'u-rival', label: '竞对黑名单' }, role: 'viewer', deny: true },
    { subject: { kind: 'org', id: 'sys-limited', label: 'Limited Access', note: '系统自动' }, role: 'viewer', system: true },
  ],
  links: [
    {
      subject: { kind: 'link', id: 'l-finplan-org', label: '组织内任何有链接者' },
      role: 'viewer',
      expiresAt: '2026-11-01T00:00:00.000Z',
    },
  ],
  exposureCount: 1204,
};

/** 张三对《2026 财务规划》的访问申请（初始 idle；/kb 页由「演进按钮组」推进状态机） */
export const PERM_REQUEST_DEMO: KbAccessRequest = {
  id: 'req-2026-1101',
  requester: '张三',
  resource: '2026 财务规划',
  role: 'viewer',
  reason: 'Q4 区域预算对齐需要财务规划的口径',
  state: 'idle',
  submittedAt: iso(4 * HOUR),
  approverNote: '内容负责人：李四（财务部）',
};

/** 权限审计时间线（新 → 旧；含一条 break-glass 与 system actor 的权限同步） */
export const PERM_AUDIT_DEMO: KbAuditEntry[] = [
  {
    id: 'au-8',
    at: iso(18 * 60_000),
    actor: { kind: 'human', name: '李四' },
    action: 'revoke',
    resource: '2026 财务规划',
    detail: '收回张三的 viewer 授权（Q3 项目结项，权限回收）',
  },
  {
    id: 'au-7',
    at: iso(46 * 60_000),
    actor: { kind: 'app', name: '系统审计员' },
    action: 'break_glass',
    resource: 'Q3 并购草案.docx',
    detail: '双人复核中',
    breakGlass: true,
  },
  {
    id: 'au-6',
    at: iso(2 * HOUR),
    actor: { kind: 'system', name: '权限服务' },
    action: 'sync',
    resource: '2026 财务规划',
    detail: '与财务部空间对齐授权（3 条变更落库）',
  },
  {
    id: 'au-5',
    at: iso(3 * HOUR),
    actor: { kind: 'human', name: '李四' },
    action: 'approve',
    resource: '2026 财务规划',
    detail: '批准张三的申请：viewer（30 天到期）',
  },
  {
    id: 'au-4',
    at: iso(3 * HOUR + 9 * 60_000),
    actor: { kind: 'human', name: '张三' },
    action: 'request',
    resource: '2026 财务规划',
    detail: '申请 viewer：Q4 区域预算对齐需要口径',
  },
  {
    id: 'au-3',
    at: isoDay(1, 16),
    actor: { kind: 'human', name: '李四' },
    action: 'permission_change',
    resource: '财务部空间',
    detail: 'finance-team：Viewer → Editor（部门改版权限下放）',
  },
  {
    id: 'au-2',
    at: isoDay(1, 10),
    actor: { kind: 'human', name: '王五' },
    action: 'preview',
    resource: '2026 财务规划',
    detail: '预览摘要，未下载原文',
  },
  {
    id: 'au-1',
    at: isoDay(2, 9),
    actor: { kind: 'human', name: '张三' },
    action: 'read',
    resource: '2026 财务规划',
    detail: '全文读取（检索引用进入）',
  },
];

/** 权限异味（治理发现，admin 视图）：源系统权限卫生问题——RAG 只是放大器 */
export const PERM_HYGIENE_DEMO: KbHygieneIssue[] = [
  {
    id: 'hyg-1',
    kind: 'overexposed',
    resource: '2026 财务规划',
    metric: '对 1,204 人可见',
    hint: '继承链带来的宽授权——按「最小知悉」改为定向组',
    severity: 'high',
  },
  {
    id: 'hyg-2',
    kind: 'org_wide_link',
    resource: '供应商名录',
    metric: '组织内链接 · 28 天',
    hint: '组织级链接长期存在——改为指定人员并设短到期',
    severity: 'high',
  },
  {
    id: 'hyg-3',
    kind: 'broken_inheritance',
    resource: 'Q3 并购草案.docx',
    metric: '1 个子项断继承',
    hint: '断开后不随父容器收紧——复核是否必要',
    severity: 'medium',
  },
  {
    id: 'hyg-4',
    kind: 'orphaned_owner',
    resource: '离职交接清单',
    metric: '负责人已禁用',
    hint: '尽快移交 owner，避免审批无人路由',
    severity: 'medium',
  },
];

/** 可见性对照的 mock 命中（标题复用检索语料；summary = AI 摘要级命中的摘要文本） */
export const PERM_HITS_DEMO: Array<{ id: string; title: string; snippet: string; summary?: string }> = [
  { id: 'pv-h1', title: '供应商准入手册 v4.2', snippet: '第三章 准入材料清单。营业执照副本、近两年审计报告、质量体系认证……' },
  { id: 'pv-h2', title: '准入材料清单', snippet: '五类材料：营业执照 / 审计报告 / 体系认证 / 检测报告 / 环保声明。' },
  { id: 'pv-h3', title: '流程与账期', snippet: '在线提交 → 资质初审（5 个工作日）→ 现场审核 → 分级评定 → 签署框架协议。' },
  {
    id: 'pv-h4',
    title: '2026 财务规划',
    snippet: '含 Q4 预算缺口与降本目标的财务规划……',
    summary: '财务规划要点的 AI 摘要：预算缺口 2.3%、供应链降本 3pct 由采购部牵头（原文受限）',
  },
  {
    id: 'pv-h5',
    title: '并购意向简报',
    snippet: '拟收购标的与估值区间的董事会简报……',
    summary: '并购意向简报的 AI 摘要：一家标的、估值区间待尽调收敛（原文受限）',
  },
  { id: 'pv-h6', title: 'Q3 目标', snippet: '华东大区 Q3 新签目标 1.2 亿，同比 +18%……' },
];

/**
 * 可见性对照的演示求值规则（写死，供 renderKbVisibility 的 evaluateHit）：
 * - 《2026 财务规划》/《并购意向简报》（受限财务文档）→ 王五 full、系统审计员 summary
 *   （演示 summary 级：AI 摘要可见、原文受限）、张三 metadata（知道存在、可申请）、其余身份 full；
 * - 《Q3 目标》→ project-q3 组 full，其他身份 metadata；
 * - 其余文档 → 全部 full。
 */
export function permEvaluateHit(hit: { title?: string }, identity: KbIdentity): KbVisibility {
  const t = hit.title ?? '';
  if (t.includes('财务规划') || t.includes('并购')) {
    if (identity.user === 'zhangsan') return 'metadata';
    if (identity.user === 'auditor') return 'summary';
    return 'full';
  }
  if (t.includes('Q3 目标')) return identity.groups.includes('project-q3') ? 'full' : 'metadata';
  return 'full';
}
