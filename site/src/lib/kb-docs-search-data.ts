/*
 * 知识库族组件文档 —— 检索域（search）+ 问数域（data）分片。
 * 覆盖 kb-retrieval / kb-filter / kb-rerank / kb-hittest（检索调试）与
 * kb-sql / kb-answer / kb-clarify / kb-explain（Chat-with-Data）共 8 条。
 * 导出名与签名对照 src/behaviors/kb-*.ts；契约源 kb-core（规格 docs/spec/kb-family.md §5.11–5.18）。
 */
import type { ComponentDoc } from './components';

export const KB_DOCS_SEARCH_DATA: ComponentDoc[] = [
  /* ══════════ 检索域（kb-search.css）══════════ */
  {
    slug: 'kb-retrieval',
    name: '检索调试台',
    group: '知识库',
    desc: 'createKbRetrieval 装配检索 playground：参数栏（向量/关键词/混合模式 · topK 步进 · alpha 混合权重滑杆 · 重排开关 · 阈值滑杆联动「存活 N 条」）+ 可复制参数 JSON 行 + 命中列表。分数纪律：score null → 值「—」不渲条、scoreKind 必显 chip、vectorPart/keywordPart 微型双段条、explain 折叠拆解；Enter 或「运行」派 icen:kb-retrieval-run（onRun 双通道）。',
    demo: `<div id="demo-kb-retrieval"></div>
<p class="demo-label" id="kb-retrieval-log" style="margin-top:8px">Enter 或点「运行」→ 300ms mock 检索回填命中 · 切模式看 scoreKind 变化 · 第 5 条为无分命中（「—」态）· 点「拆解」看打分构成</p>`,
    usage: `import { createKbRetrieval } from '@icen.ai/ui/kit/kb-retrieval';

const handle = createKbRetrieval(el, {
  params: { mode: 'hybrid', topK: 5, alpha: 0.6, rerank: true },   // 宽进严出（normalizeRetrievalParams）
  onRun: (query) => {
    // 与 icen:kb-retrieval-run {query} 双通道；真实检索由宿主执行
    handle.setBusy(true);                     // 运行钮禁用 + .is-busy
    search(query).then((hits) => {
      handle.renderHits(hits);                // KbRetrievalHit[]：score 可 null、scoreKind 必带
      handle.setBusy(false);
    });
  },
});

handle.getParams();              // 归一副本（threshold 投影：rerank 关闭 → null）
handle.setParams({ topK: 8 });
handle.setThreshold(0.35);       // 阈值滑杆 + 「存活 N/M 条」联动（score null 在任何正阈值下不存活）`,
    behaviors: ['kb-retrieval', 'kb-core'],
    script: `const host = document.getElementById('demo-kb-retrieval');
const logEl = document.getElementById('kb-retrieval-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2400);
}

/* mock 语料：中文企业知识库（经营分析 / 供应链 / HR / 财务口径） */
const CORPUS = [
  { chunkId: 'chunk-001', documentId: 'doc-bi-monthly', title: '2026 年三季度经营分析月报', snippet: '华东大区 Q3 销售额 3.42 亿，环比下滑 6.8%：主因渠道去库存与两张大单递延至 Q4 确认。', page: 12, meta: { 部门: '经营分析部', 密级: '内部' } },
  { chunkId: 'chunk-002', documentId: 'doc-supply-review', title: '供应链季度复盘', snippet: '原材料价格上行叠加供应商切换期，交付周期从 14 天拉长到 21 天，影响 Q3 出货节奏。', page: 3, meta: { 部门: '供应链部', 密级: '内部' } },
  { chunkId: 'chunk-003', documentId: 'doc-bi-monthly', title: '2026 年三季度经营分析月报', snippet: '华南大区逆势增长 4.1%，新零售渠道贡献主要增量，会员复购率提升至 38%。', page: 15, meta: { 部门: '经营分析部', 密级: '内部' } },
  { chunkId: 'chunk-004', documentId: 'doc-hr-plan', title: '销售组织编制与激励方案', snippet: 'Q3 销售团队扩编 12 人，新人产能爬坡约一个季度，短期人效指标被摊薄。', page: 7, meta: { 部门: '人力资源部', 密级: '秘密' } },
  { chunkId: 'chunk-006', documentId: 'doc-competitor', title: '竞品价格战跟踪', snippet: '竞品 8 月起降价 8%，本品牌未跟进，华东部分渠道份额被动流失约 2.3pct。', page: 2, meta: { 部门: '市场部', 密级: '内部' } },
  { chunkId: 'chunk-005', documentId: 'doc-finance-cal', title: '财务口径说明（销售额）', snippet: '销售额默认含税口径；与不含税口径差异约 13%，跨报表对比前先统一口径。', page: 1, meta: { 部门: '财务部', 密级: '内部' } },
];

/* mock 打分：按模式给 scoreKind 与拆解；chunk-006 固定无分（score null →「—」是一等状态，不是异常） */
function mockHits(params) {
  return CORPUS.slice(0, params.topK).map(function (c, i) {
    const hit = { chunkId: c.chunkId, documentId: c.documentId, title: c.title, snippet: c.snippet, page: c.page, meta: c.meta };
    if (c.chunkId === 'chunk-006') {
      hit.score = null;
      hit.scoreKind = 'rrf';
      hit.explain = '融合检索（rrf）未回传分数：无分命中不渲染分数条，值显示「—」';
      return hit;
    }
    if (params.mode === 'vector') {
      hit.score = Math.round((0.93 - i * 0.07) * 1000) / 1000;
      hit.scoreKind = 'cosine';
    } else if (params.mode === 'keyword') {
      hit.score = Math.round((8.6 - i * 0.9) * 100) / 100;
      hit.scoreKind = 'bm25';
    } else {
      const vec = Math.round((0.66 - i * 0.06) * 100) / 100;
      const kw = Math.round((0.34 + i * 0.05) * 100) / 100;
      hit.score = Math.round((0.93 - i * 0.07) * 1000) / 1000;
      hit.scoreKind = 'hybrid';
      hit.vectorPart = vec;
      hit.keywordPart = kw;
      hit.explain = 'cosine 语义 ' + vec.toFixed(2) + ' + bm25 关键词 ' + kw.toFixed(2) + '（alpha=' + (params.alpha ?? 0.5) + ' 加权融合）';
    }
    return hit;
  });
}

let runSeq = 0;
const handle = kbRetrievalMod.createKbRetrieval(host, {
  params: { mode: 'hybrid', topK: 5, alpha: 0.6, rerank: true },
  onRun: function (query) {
    handle.setBusy(true);
    const seq = ++runSeq;
    setTimeout(function () {
      if (seq !== runSeq) return;          /* 忽略过期响应 */
      const hits = mockHits(query.params);
      handle.renderHits(hits);
      handle.setBusy(false);
      log('icen:kb-retrieval-run · ' + query.params.mode + ' topK=' + query.params.topK + ' → 300ms 回填 ' + hits.length + ' 条 · top1 ' + kbCoreMod.formatScore(hits[0] && hits[0].score) + '（' + (hits[0] && hits[0].scoreKind) + '）');
    }, 300);
  },
});
/* 首屏预渲染一版命中（query 分词高亮按当前输入重切） */
handle.renderHits(mockHits({ mode: 'hybrid', topK: 5, alpha: 0.6 }));`,
  },
  {
    slug: 'kb-filter',
    name: '过滤构建器',
    group: '知识库',
    desc: 'createKbFilter 行式过滤器构建器：rule 行（字段 / 9 种操作符 / 值）+ AND/OR 组嵌套（≤2 层，超层禁用增钮不隐藏）+ DSL 双表示镜像（filterToMongo 的 JSON ↔ filterToOData 字符串，tab 切换可复制）。DOM 即状态（随时从树解析 KbFilterNode，无并行漂移）；任意变更派 icen:kb-filter-change {node, valid}（onChange 双通道）。',
    demo: `<div id="demo-kb-filter"></div>
<p class="demo-label" id="kb-filter-log" style="margin-top:8px">任意增删规则 / 切 AND-OR / 输入值 → icen:kb-filter-change · 底部 DSL 镜像实时同步（Mongo / OData tab 可切换复制）· 属于（in）用逗号分隔多值</p>`,
    usage: `import { createKbFilter } from '@icen.ai/ui/kit/kb-filter';

const handle = createKbFilter(el, {
  fields: ['部门', '密级', '年份', '来源系统', '文档类型', '成本中心'],   // 字段建议（datalist，仍可自由输入）
  node: { type: 'group', op: 'and', children: [
    { type: 'rule', field: '密级', op: 'eq', value: '内部' },
    { type: 'rule', field: '年份', op: 'gte', value: 2023 },
    { type: 'group', op: 'or', children: [
      { type: 'rule', field: '部门', op: 'in', value: ['财务部', '供应链部'] },
      { type: 'rule', field: '来源系统', op: 'contains', value: 'SAP' },
    ] },
  ] },
  onChange: (node, valid) => {
    console.log(valid, handle.serialize('mongo'), handle.serialize('odata'));
  },
});
handle.get();                       // → KbFilterNode | null（空构建器 = 无过滤 = valid）
handle.set({ type: 'rule', field: '密级', op: 'eq', value: '公开' });   // 裸 rule 自动包根组`,
    behaviors: ['kb-filter'],
    script: `const host = document.getElementById('demo-kb-filter');
const logEl = document.getElementById('kb-filter-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2600);
}
if (host) {
  const handle = kbFilterMod.createKbFilter(host, {
    fields: ['部门', '密级', '年份', '来源系统', '文档类型', '成本中心'],
    node: { type: 'group', op: 'and', children: [
      { type: 'rule', field: '密级', op: 'eq', value: '内部' },
      { type: 'rule', field: '年份', op: 'gte', value: 2023 },
      { type: 'group', op: 'or', children: [
        { type: 'rule', field: '部门', op: 'in', value: ['财务部', '供应链部'] },
        { type: 'rule', field: '来源系统', op: 'contains', value: 'SAP' },
      ] },
    ] },
  });
  /* 变更回显：事件通道 + 双序列化（mongo JSON / odata 字符串） */
  host.addEventListener('icen:kb-filter-change', function (e) {
    log('icen:kb-filter-change · valid=' + e.detail.valid + ' · mongo ' + handle.serialize('mongo') + ' · odata ' + handle.serialize('odata'));
  });
}`,
  },
  {
    slug: 'kb-rerank',
    name: '重排对比',
    group: '知识库',
    desc: 'renderKbRerankCompare 三列 grid（重排前 | Δ | 重排后）：按 documentId+chunkId 稳定 join，after 名次优先、before-only 条目（落选）殿后；Δ 用 after.rank − before.rank（↑N 绿 / ↓N 红 / —），单侧缺失标「新进 / 落选」；双分数列各按列内 max 归一，after 列 scoreKind 一律 rerank。顶部模型徽标 + 开关（icen:kb-rerank-toggle，关闭后重排后列压淡不隐藏）。',
    demo: `<div id="demo-kb-rerank"></div>
<p class="demo-label" id="kb-rerank-log" style="margin-top:8px">↑3 / ↓2 / — 与「新进 / 落选」一次看全 · 点右上开关对比开/关（关闭 = 重排后列压淡，显式禁用不隐藏）</p>`,
    usage: `import { renderKbRerankCompare } from '@icen.ai/ui/kit/kb-rerank';

const box = renderKbRerankCompare(el, {
  model: 'bge-reranker-v2-m3',                 // 顶部徽标；缺省 'rerank'
  before: [                                     // 顺序即 rank；score null → 值「—」不渲条
    { chunkId: 'c-301', documentId: 'doc-supplier', title: '供应商准入与考核标准', snippet: '…', score: 0.61, scoreKind: 'cosine' },
    /* … */
  ],
  after: [                                      // 按 documentId+chunkId join；多出的标「新进」
    { chunkId: 'c-118', documentId: 'doc-supplier', title: '原材料价格月度跟踪', snippet: '…', score: 0.97, scoreKind: 'rerank' },
    /* … */
  ],
});
box.addEventListener('icen:kb-rerank-toggle', (e) => {
  // e.detail { enabled, model }；关闭时容器挂 .is-off（after 列压淡）
});`,
    behaviors: ['kb-rerank'],
    script: `const host = document.getElementById('demo-kb-rerank');
const logEl = document.getElementById('kb-rerank-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2400);
}
if (host) {
  const box = kbRerankMod.renderKbRerankCompare(host, {
    model: 'bge-reranker-v2-m3',
    /* 重排前：cosine 召回 Top6（rank 5 无分命中演示「—」） */
    before: [
      { chunkId: 'c-301', documentId: 'doc-supplier', title: '供应商准入与季度考核标准', snippet: '准入看质量、交付、成本三维评分。', score: 0.61, scoreKind: 'cosine' },
      { chunkId: 'c-118', documentId: 'doc-supplier', title: '原材料价格月度跟踪（Q3）', snippet: '大宗原料价格环比上行 4.2%。', score: 0.58, scoreKind: 'cosine' },
      { chunkId: 'c-207', documentId: 'doc-quality', title: '来料检验规范 A 版', snippet: '按物料等级抽检，A 类全检。', score: 0.55, scoreKind: 'cosine' },
      { chunkId: 'c-052', documentId: 'doc-supplier', title: '供应商切换实施方案', snippet: '双供应商并行 6 周过渡。', score: 0.52, scoreKind: 'cosine' },
      { chunkId: 'c-089', documentId: 'doc-finance', title: '采购付款账期政策', snippet: '账期 60 天，返利按季度结算。', score: null, scoreKind: 'cosine' },
      { chunkId: 'c-144', documentId: 'doc-supplier', title: '双源采购风险清单', snippet: '单一来源物料共 17 项。', score: 0.41, scoreKind: 'cosine' },
    ],
    /* 重排后：↑3（c-052）/ ↓2（c-301、c-207）/ 新进（c-155）；c-089、c-144 落选殿后 */
    after: [
      { chunkId: 'c-118', documentId: 'doc-supplier', title: '原材料价格月度跟踪（Q3）', snippet: '大宗原料价格环比上行 4.2%。', score: 0.97, scoreKind: 'rerank' },
      { chunkId: 'c-052', documentId: 'doc-supplier', title: '供应商切换实施方案', snippet: '双供应商并行 6 周过渡。', score: 0.93, scoreKind: 'rerank' },
      { chunkId: 'c-301', documentId: 'doc-supplier', title: '供应商准入与季度考核标准', snippet: '准入看质量、交付、成本三维评分。', score: 0.88, scoreKind: 'rerank' },
      { chunkId: 'c-155', documentId: 'doc-quality', title: '来料不合格处理流程', snippet: '不合格批退回并冻结库存。', score: 0.81, scoreKind: 'rerank' },
      { chunkId: 'c-207', documentId: 'doc-quality', title: '来料检验规范 A 版', snippet: '按物料等级抽检，A 类全检。', score: 0.76, scoreKind: 'rerank' },
    ],
  });
  box.addEventListener('icen:kb-rerank-toggle', function (e) {
    log('icen:kb-rerank-toggle · enabled=' + e.detail.enabled + ' · model=' + (e.detail.model || 'rerank'));
  });
}`,
  },
  {
    slug: 'kb-hittest',
    name: '召回测试',
    group: '知识库',
    desc: 'createKbHitTest 召回回归测试集：问题列表（pin 置顶 / 期望 chunk chips（超 3 折 +N）/ 最近结果 ✓✗— / 删除）+ 新增问题 + 「运行全部」。passed 由 lastHits ∩ expectedChunkIds 派生（不信任外部传入）；统计头走 hitTestStats（命中率 null = 未跑过而非 0），renderKbHitStats 可脱离列表单独渲染；徽标「参数仅本次会话生效」。',
    demo: `<div id="demo-kb-hittest"></div>
<p class="demo-label" id="kb-hittest-log" style="margin-top:8px">「运行全部」→ 300ms mock 检索逐题回填 lastHits（期望命中在前排 → ✓，否则 ✗）· Enter 新增问题 · pin 图标置顶固定</p>`,
    usage: `import { createKbHitTest, renderKbHitStats } from '@icen.ai/ui/kit/kb-hittest';
import { hitTestStats } from '@icen.ai/ui';   // kb-core 纯函数（主入口同源）

const handle = createKbHitTest(el, {
  cases: [
    { id: 'q1', question: 'Q3 华东销售额为什么下滑？', expectedChunkIds: ['chunk-001'], pinned: true },
    { id: 'q2', question: '供应商切换对交付周期的影响？', expectedChunkIds: ['chunk-052'] },
    /* … */
  ],
  onRun: (cases) => {
    // 检索由宿主执行（测试参数仅本次会话生效），跑完 setCases 回填 lastHits
    const next = cases.map((c) => ({ ...c, lastHits: runRetrieval(c.question) }));
    handle.setCases(next);           // passed 在内部按交集派生
  },
});

// 统计头单独复用：命中率大数字 + 均分 + 通过 x/y（未跑 hitRate 为 null →「—」）
renderKbHitStats(el, hitTestStats(cases));`,
    behaviors: ['kb-hittest', 'kb-core'],
    script: `const host = document.getElementById('demo-kb-hittest');
const logEl = document.getElementById('kb-hittest-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2600);
}

/* 5 条中文测试问题（期望命中的 chunk 预先登记） */
const CASES = [
  { id: 'q1', question: 'Q3 华东大区销售额下滑的原因？', expectedChunkIds: ['chunk-001', 'chunk-014'], pinned: true },
  { id: 'q2', question: '供应商切换对交付周期的影响？', expectedChunkIds: ['chunk-052'] },
  { id: 'q3', question: '销售额的含税与不含税口径差异？', expectedChunkIds: ['chunk-005'] },
  { id: 'q4', question: '销售团队扩编对人效的影响？', expectedChunkIds: ['chunk-004'] },
  { id: 'q5', question: '华南大区逆势增长的驱动因素？', expectedChunkIds: ['chunk-003'] },
];
const POOL = ['chunk-001', 'chunk-014', 'chunk-118', 'chunk-052', 'chunk-005', 'chunk-004', 'chunk-003', 'chunk-207'];
const MISS = { q2: true, q4: true };   /* mock：这两题检索未命中期望 → ✗（演示命中率非满分） */

function mockHitsFor(c) {
  const expected = c.expectedChunkIds || [];
  const pool = POOL.filter(function (id) { return expected.indexOf(id) === -1; });
  const ids = expected.length === 0 || MISS[c.id] ? pool.slice(0, 3) : [expected[0], pool[0], pool[1]];
  return ids.map(function (id, i) {
    return { chunkId: id, score: Math.round((0.88 - i * 0.13) * 1000) / 1000, rank: i + 1 };
  });
}

let runToken = 0;
if (host) {
  const handle = kbHittestMod.createKbHitTest(host, {
    cases: CASES,
    onRun: function (cases) {
      const token = ++runToken;
      setTimeout(function () {
        if (token !== runToken) return;
        const next = cases.map(function (c) {
          return Object.assign({}, c, { lastHits: mockHitsFor(c) });
        });
        handle.setCases(next);
        const s = kbCoreMod.hitTestStats(next);
        log('icen:kb-hittest-run · 回填 ' + next.length + ' 题 · 命中率 ' + kbCoreMod.formatPercent(s.hitRate) + '（' + s.passed + '/' + s.total + ' 通过 · 均分 ' + kbCoreMod.formatScore(s.avgScore) + '）');
      }, 300);
    },
  });
  host.addEventListener('icen:kb-hittest-add', function (e) {
    log('icen:kb-hittest-add · ' + e.detail.question + '（未设期望 → 结果「—」不进分母）');
  });
}`,
  },
  /* ══════════ 问数域（kb-data.css）══════════ */
  {
    slug: 'kb-sql',
    name: 'SQL 卡片',
    group: '知识库',
    desc: 'renderKbSql 生成 SQL 卡片：头（可见性徽标「仅管理员可见」/ dialect / 引用表 chips / 复制 / 编辑重跑）+ highlightSql 零依赖着色（关键词/字符串/注释/数字/函数名，流式安全）+ prevSql 修正卡（makeSqlDiff 行级 unified diff → 复用 ai-diff 渲染 + 「应用修复并重跑」）+ 编辑态 textarea（Ctrl/Cmd+Enter 确认、Esc 取消）。initKbSql 幂等委托：icen:kb-sql-edit / icen:kb-sql-rerun（内部一并挂 initAiDiff）。',
    demo: `<div id="demo-kb-sql"></div>
<p class="demo-label" id="kb-sql-log" style="margin-top:8px">「编辑重跑」→ textarea 改 SQL · Ctrl+Enter 确认 · Esc 取消 · 修正卡是 prevSql → 当前版的 diff（复用 ai-diff，行号 + 着色）· 「应用修复并重跑」派 icen:kb-sql-rerun</p>`,
    usage: `import { renderKbSql, initKbSql, highlightSql, makeSqlDiff } from '@icen.ai/ui/kit/kb-sql';

renderKbSql(el, {
  sql: 'SELECT r.region_name, d.quarter, SUM(d.amount_tax_inc) …',
  dialect: 'postgres',
  tables: ['dws.sales_order_detail', 'dim.region'],   // 引用表 chips
  visibility: 'admin',        // SQL 可见性是权限问题：admin → 徽标「仅管理员可见」
  editable: true,             // 头部出「编辑重跑」，编辑态切 textarea
  prevSql: 'SELECT …(上一版报错的 SQL)',     // 存在且 ≠ sql → 修正卡 diff（复用 ai-diff）
  reasoning: '按季度聚合区域销售额',
}, {
  onEdit: (sql) => {},        // 与 icen:kb-sql-edit 同语义
  onRerun: (sql) => {},       // 编辑确认与「应用修复」共用（icen:kb-sql-rerun）
});
initKbSql();                  // 复制 / 编辑态 / 确认 / 应用修复（幂等，返回销毁函数）

highlightSql(sql);            // → DocumentFragment（零依赖着色，可单独使用）
makeSqlDiff(prev, next);      // → unified diff 文本（纯函数，可交 parseUnifiedDiff）`,
    behaviors: ['kb-sql', 'ai-diff'],
    behaviorInit: { 'kb-sql': 'initKbSql' },
    script: `const host = document.getElementById('demo-kb-sql');
const logEl = document.getElementById('kb-sql-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2400);
}

/* 中文企业分析场景：按季度聚合区域销售额（含税口径）· prevSql 为上一版报错 SQL */
const PREV = [
  'SELECT region, quarter, SUM(amount) AS sales_amt',
  'FROM dws.sales_order_detail',
  'GROUP BY region, quarter',
  'ORDER BY region',
].join('\\n');
const CUR = [
  '-- 按季度聚合区域销售额（含税口径，对齐指标层 gmv_tax_inc）',
  'SELECT r.region_name AS region,',
  '       d.quarter,',
  '       SUM(d.amount_tax_inc) AS sales_amt',
  'FROM dws.sales_order_detail d',
  'JOIN dim.region r ON r.region_id = d.region_id',
  'WHERE d.year = 2026 AND d.is_return = FALSE',
  'GROUP BY r.region_name, d.quarter',
  'HAVING SUM(d.amount_tax_inc) > 0',
  'ORDER BY r.region_name, d.quarter ASC',
  'LIMIT 500',
].join('\\n');

if (host) {
  kbSqlMod.renderKbSql(host, {
    sql: CUR,
    prevSql: PREV,
    dialect: 'postgres',
    tables: ['dws.sales_order_detail', 'dim.region'],
    visibility: 'admin',
    editable: true,
    reasoning: '先过滤本年度与非退货单，再按区域 × 季度聚合含税销售额',
  }, {
    onRerun: function (sql) {
      log('onRerun · ' + sql.split('\\n').length + ' 行 SQL 已提交重跑');
    },
  });
  host.addEventListener('icen:kb-sql-edit', function (e) {
    log('icen:kb-sql-edit · 编辑确认（pre 重渲为新 SQL）');
  });
  host.addEventListener('icen:kb-sql-rerun', function (e) {
    log('icen:kb-sql-rerun · ' + e.detail.sql.slice(0, 46) + '…');
  });
}`,
  },
  {
    slug: 'kb-answer',
    name: '问数答案',
    group: '知识库',
    desc: 'renderKbAnswer 问数答案组合容器（快照渲染，各槽有才渲）：认证徽章（verified 命中可信资产，数字本身永远中性）+ 权限提示（行级过滤 + 已脱敏列，不可关闭）+ 正文 [n] 角标流（无效编号降级纯文本）+ 澄清反问 / 口径解释内嵌槽 + 结果表（sticky 表头、null「—」、截断声明、导出）+ ChartSpec 图表（折线/柱状/饼图切换，复用 renderChart）+ 追问建议。事件与回调双通道：icen:kb-verified-open / onExport / onFollowUp。',
    demo: `<div id="demo-kb-answer"></div>
<p class="demo-label" id="kb-answer-log" style="margin-top:8px">点认证徽章 / 图表类型 chips（折线→柱状→饼图）/ 追问 chips / 导出 → 事件与回调双通道回显 · 结果表含截断声明与 null「—」· 权限提示不可关闭（诚实呈现）</p>`,
    usage: `import { renderKbAnswer } from '@icen.ai/ui/kit/kb-answer';

renderKbAnswer(el, {
  kind: 'verified',              // 认证优先于生成；数字本身永远中性
  verifiedVia: { assetId: 'pq-region-quarter-sales', assetType: 'parameterized-query', note: '口径：含税' },
  permissionNotice: { rowLevelPolicy: '华东大区 · 仅本人管辖门店', maskedColumns: ['customer_phone'] },
  body: '华东大区 Q3 销售额 3.42 亿，环比下滑 6.8% [1]，华南逆势增长 4.1% [2]。',   // [n] 角标流
  citations: [{ id: 's1', title: '2026 年三季度经营分析月报', kind: 'doc' }, /* … */],
  clarify: { question: '「Q3」按自然季度还是财季统计？', options: [{ label: '自然季度', value: 'calendar' }] },
  explain: { tables: ['dws.sales_order_detail'], columns: ['amount_tax_inc'], filters: ['year = 2026'],
             aggregates: ['SUM(amount_tax_inc)'], metrics: [{ name: '销售额（含税）', ref: 'https://…' }] },
  result: { columns: [{ name: '区域' }, { name: '销售额', type: 'number' }], rows: [['华东', 34200.9]],
            truncated: true, totalRows: 128, limit: 8, rowCount: 8, durationMs: 460, exportFormats: ['csv', 'xlsx'] },
  chartSpec: { type: 'line', labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: '华东', values: [3.9, 3.8, 3.42, 3.6] }] },
  followUps: ['按门店拆分看明细', '对比去年同期'],
}, {
  onExport: (fmt) => {},          // 未提供则导出钮禁用（不给假按钮）
  onFollowUp: (text) => {},
  onVerifiedOpen: (assetId) => {},  // 与 icen:kb-verified-open 同语义
});`,
    behaviors: ['kb-answer', 'charts'],
    script: `const host = document.getElementById('demo-kb-answer');
const logEl = document.getElementById('kb-answer-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2400);
}
if (host) {
  kbAnswerMod.renderKbAnswer(host, {
    kind: 'verified',
    verifiedVia: { assetId: 'pq-region-quarter-sales', assetType: 'parameterized-query', note: '口径：含税' },
    permissionNotice: { rowLevelPolicy: '华东大区 · 仅本人管辖门店', maskedColumns: ['customer_phone', 'contact_name'] },
    body: '华东大区 Q3 销售额 3.42 亿，环比下滑 6.8%：主因渠道去库存与两张大单递延至 Q4 确认 [1]；华南逆势增长 4.1%，新零售渠道贡献主要增量 [2]。',
    citations: [
      { id: 's1', index: 1, title: '2026 年三季度经营分析月报', kind: 'doc', documentId: 'doc-bi-monthly' },
      { id: 's2', index: 2, title: '区域销售日报（10-01）', kind: 'sheet', documentId: 'sheet-daily-sales' },
    ],
    clarify: {
      id: 'clarify-quarter',
      question: '「Q3」按自然季度还是财季（7 月起）统计？',
      options: [
        { label: '自然季度（7–9 月）', value: 'calendar' },
        { label: '财季（第 3 财季）', value: 'fiscal' },
      ],
      reason: '检测到时间口径歧义，先确认再冻结 SQL',
    },
    explain: {
      tables: ['dws.sales_order_detail', 'dim.region'],
      columns: ['region_id', 'quarter', 'amount_tax_inc', 'is_return'],
      filters: ['year = 2026', 'is_return = false', 'region_id IN (31, 32)'],
      aggregates: ['SUM(amount_tax_inc)', 'COUNT(order_id)'],
      metrics: [{ name: '销售额（含税）', ref: 'https://semantic.icen.ai/metrics/gmv-tax-inc' }],
    },
    result: {
      columns: [{ name: '区域' }, { name: '季度' }, { name: '销售额（万元）', type: 'number' }, { name: '订单数', type: 'number' }, { name: '客单价（元）', type: 'number' }],
      rows: [
        ['华东', 'Q1', 39021.4, 12043, 3242],
        ['华东', 'Q2', 38012.7, 11890, 3197],
        ['华东', 'Q3', 34200.9, 10904, 3137],
        ['华南', 'Q1', 27011.2, 9420, 2867],
        ['华南', 'Q2', 29004.5, 9888, 2933],
        ['华南', 'Q3', 30189.3, 10156, 2972],
        ['华北', 'Q3', 25410.8, 9315, 2729],
        ['西南', 'Q3', null, null, null],
      ],
      truncated: true, totalRows: 128, limit: 8, rowCount: 8, durationMs: 462,
      exportFormats: ['csv', 'xlsx'],
    },
    chartSpec: {
      type: 'line', title: '区域季度销售额（亿元 · 含税）',
      labels: ['Q1', 'Q2', 'Q3', 'Q4 预测'],
      series: [
        { name: '华东', values: [3.9, 3.8, 3.42, 3.6] },
        { name: '华南', values: [2.7, 2.9, 3.02, 3.1] },
      ],
      format: { unit: '亿' },
    },
    followUps: ['按门店拆分看明细', '对比去年同期', '换成不含税口径再看'],
  }, {
    onExport: function (fmt) { log('onExport · 导出 ' + fmt + '（回调缺席时导出钮禁用）'); },
    onFollowUp: function (text) { log('onFollowUp · ' + text); },
    onVerifiedOpen: function (assetId) { log('icen:kb-verified-open · assetId=' + assetId); },
  });
  /* 内嵌槽的事件冒泡到容器：澄清 / 口径解释 */
  host.addEventListener('icen:kb-clarify-answer', function (e) { log('icen:kb-clarify-answer · ' + e.detail.label); });
  host.addEventListener('icen:kb-explain-toggle', function (e) { log('icen:kb-explain-toggle · ' + (e.detail.open ? '展开' : '折叠')); });
}`,
  },
  {
    slug: 'kb-clarify',
    name: '澄清反问',
    group: '知识库',
    desc: 'renderKbClarify 澄清反问卡（快照渲染，重渲重置为未答态）：问题行 + 选项 chips 点选（点选非打字）+ 答后回显「已解析：…」并禁用其余选项（同一卡只能答一次）+ reason 弱化小字。点选派 icen:kb-clarify-answer {id, value, label}（onAnswer 双通道）；kb-answer 的澄清槽内部复用本组件。',
    demo: `<div id="demo-kb-clarify"></div>
<div class="toolbar" style="margin-top:12px">
  <span class="toolbar-label">答过即锁定 · 重答 = 数据快照重渲</span>
  <span class="toolbar-spacer"></span>
  <button class="btn btn-sm" type="button" id="kb-clarify-reset">重置为未答态</button>
</div>
<p class="demo-label" id="kb-clarify-log" style="margin-top:8px">点选项 → icen:kb-clarify-answer · 回显「已解析：…」并禁用其余选项</p>`,
    usage: `import { renderKbClarify } from '@icen.ai/ui/kit/kb-clarify';

renderKbClarify(el, {
  id: 'clarify-tax-scope',          // 事件 detail 会带上（可选）
  question: '「销售额」指含税还是不含税？',
  options: [
    { label: '含税口径（默认）', value: 'tax_inc' },
    { label: '不含税口径', value: 'tax_exc' },
    { label: '两种都看（并列对比）', value: 'both' },
  ],
  reason: '检测到口径歧义，先确认再生成 SQL',   // 弱化小字，有才渲
}, {
  onAnswer: ({ id, value, label }) => {},   // 与 icen:kb-clarify-answer 同 detail
});`,
    behaviors: ['kb-clarify'],
    script: `const host = document.getElementById('demo-kb-clarify');
const logEl = document.getElementById('kb-clarify-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2400);
}
function render() {
  if (!host) return;
  kbClarifyMod.renderKbClarify(host, {
    id: 'clarify-tax-scope',
    question: '「销售额」指含税还是不含税口径？',
    options: [
      { label: '含税口径（默认）', value: 'tax_inc' },
      { label: '不含税口径', value: 'tax_exc' },
      { label: '两种都看（并列对比）', value: 'both' },
    ],
    reason: '检测到指标口径歧义：含税 / 不含税差异约 13%，先确认再生成 SQL',
  }, {
    onAnswer: function (a) { log('icen:kb-clarify-answer · id=' + (a.id || '—') + ' value=' + a.value + ' label=' + a.label); },
  });
}
render();
document.getElementById('kb-clarify-reset')?.addEventListener('click', function () {
  render();
  log('快照重渲：重置为未答态（同一卡只能答一次）');
});`,
  },
  {
    slug: 'kb-explain',
    name: '口径解释',
    group: '知识库',
    desc: 'renderKbExplain 口径解释折叠面板（快照渲染，默认折叠）：摘要行「这个数字是怎么算出来的」+ 参与要素计数徽标；展开体为 表/列/筛选/聚合 四组 chips（有才渲）+ 指标口径行（name + ref 深链「查看口径」），全空给空态无死路。切换派 icen:kb-explain-toggle {el, open}；kb-answer 的口径槽内部复用本组件。',
    demo: `<div style="display:flex;flex-direction:column;gap:12px;width:100%">
  <div id="demo-kb-explain"></div>
  <div id="demo-kb-explain-2"></div>
</div>
<p class="demo-label" id="kb-explain-log" style="margin-top:8px">点摘要行展开 · 计数徽标 = 参与要素总数 · 「查看口径」深链语义层指标定义 · 上面是经营分析场景，下面是供应链库存场景</p>`,
    usage: `import { renderKbExplain } from '@icen.ai/ui/kit/kb-explain';

renderKbExplain(el, {
  tables: ['dws.sales_order_detail', 'dim.region'],      // 四组要素各有才渲
  columns: ['region_id', 'quarter', 'amount_tax_inc'],
  filters: ['year = 2026', 'is_return = false'],
  aggregates: ['SUM(amount_tax_inc)'],
  metrics: [{ name: '销售额（含税）', ref: 'https://semantic.icen.ai/metrics/gmv-tax-inc' }],
  // ref 有才渲「查看口径」深链；四组与指标全空 → 展开体给空态（无死路）
});
// 折叠切换派 icen:kb-explain-toggle {el, open}`,
    behaviors: ['kb-explain'],
    script: `const host = document.getElementById('demo-kb-explain');
const host2 = document.getElementById('demo-kb-explain-2');
const logEl = document.getElementById('kb-explain-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2400);
}
/* 经营分析：区域季度销售额的口径拆解 */
if (host) {
  kbExplainMod.renderKbExplain(host, {
    tables: ['dws.sales_order_detail', 'dim.region'],
    columns: ['region_id', 'quarter', 'amount_tax_inc', 'is_return'],
    filters: ['year = 2026', 'is_return = false'],
    aggregates: ['SUM(amount_tax_inc)', 'COUNT(order_id)'],
    metrics: [{ name: '销售额（含税）', ref: 'https://semantic.icen.ai/metrics/gmv-tax-inc' }],
  });
  host.addEventListener('icen:kb-explain-toggle', function (e) {
    log('icen:kb-explain-toggle · 经营分析 · ' + (e.detail.open ? '展开' : '折叠'));
  });
}
/* 供应链：库存周转的口径拆解（第二个场景） */
if (host2) {
  kbExplainMod.renderKbExplain(host2, {
    tables: ['ods.wms_inventory_snapshot'],
    columns: ['sku_id', 'warehouse_id', 'qty_on_hand', 'std_cost'],
    filters: ["snapshot_date = '2026-09-30'", 'warehouse_type = 前置仓'],
    aggregates: ['AVG(qty_on_hand)', 'SUM(qty_on_hand * std_cost)'],
    metrics: [{ name: '库存周转天数', ref: 'https://semantic.icen.ai/metrics/inventory-turnover' }],
  });
  host2.addEventListener('icen:kb-explain-toggle', function (e) {
    log('icen:kb-explain-toggle · 供应链 · ' + (e.detail.open ? '展开' : '折叠'));
  });
}`,
  },
];
