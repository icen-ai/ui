/*
 * 知识库族组件文档 —— 证据域（ground）+ 摄取域（ingest）分片。
 * 挂载：components.ts 末尾 COMPONENTS.push(...KB_DOCS_GROUND_INGEST)。
 * script 字段为纯 JS（文档站 new Function 以 camelCase+'Mod' 形参注入 behaviors 模块）：
 * 无 TS 语法、无嵌套反引号；mock 数据统一走中文企业知识库场景
 * （Confluence《供应商准入手册》/ 季度经营复盘会纪要 / 工单系统 / 官方数据字典），
 * 相对日期按 Date.now() 动态生成，保证徽标态（official / stale / restricted、
 * done / running / fail、healthy / stale / failing）在任何时间查看都成立。
 */
import type { ComponentDoc } from './components';

export const KB_DOCS_GROUND_INGEST: ComponentDoc[] = [
  /* ══════════ 知识库族 · umbrella ══════════ */
  {
    slug: 'kb',
    name: '知识库总览',
    group: '知识库',
    desc: 'kb 族伞形入口：ai 族描述思考（ai-chat / ai-tool… 呈现「AI 在做什么」），kb 族呈现证据（「知识从哪来、可信吗、怎么用」）——引用角标、解析管线、chunk、检索分数、SQL、trace 全部是让知识工作可验证的界面。数据契约与纯函数统一在 kb-core，视觉基座 kb.css（.kb-row / .kb-num 等宽数字 / .kb-quote 引用体 / 徽标），六域各持一份合并 CSS；kit/kb 一行装全家，细分 slug 可独立安装。',
    demo: `<p class="demo-label" style="margin:0 0 12px">ai 族描述思考，kb 族呈现证据。六域 27 个组件，共享数据契约 kb-core（类型 + 纯函数 + 来源类型注册表）与视觉基座 kb.css——数字一律等宽、引文一律引用体、来源 / 分数 / 日期只用语义色。</p>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;width:100%">
  <div style="border:1px solid var(--token-line-soft);border-left:2px solid var(--token-accent);border-radius:var(--radius-md);padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <strong style="font-size:13px">证据域 · ground</strong>
      <span class="kb-badge kb-badge--official">引用是主角</span>
    </div>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--token-text-muted);line-height:1.7">答案的证据链：行内引用角标（hover 引用卡）、来源列表、原文定位抽屉、来源冲突对勘（市场空白组件）。</p>
    <div class="mono" style="font-size:11.5px;color:var(--token-text-faint)">kb-citation · kb-sources · kb-passage · kb-conflict</div>
  </div>
  <div style="border:1px solid var(--token-line-soft);border-left:2px solid var(--token-line-soft);border-radius:var(--radius-md);padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <strong style="font-size:13px">摄取域 · ingest</strong>
      <span class="kb-badge">解析先行</span>
    </div>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--token-text-muted);line-height:1.7">进知识库之前：解析管线时间线、chunk 编辑器、分段策略实时预览、连接器健康、元数据、认证 QA 对。</p>
    <div class="mono" style="font-size:11.5px;color:var(--token-text-faint)">kb-pipeline · kb-chunks · kb-segment · kb-connector · kb-metadata · kb-qa</div>
  </div>
  <div style="border:1px solid var(--token-line-soft);border-left:2px solid var(--token-line-soft);border-radius:var(--radius-md);padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <strong style="font-size:13px">检索域 · search</strong>
      <span class="kb-badge">可解释分数</span>
    </div>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--token-text-muted);line-height:1.7">检索 playground（topK / 混合权重 / rerank）、过滤器构建器（Mongo / OData 双序列化）、rerank A/B 对比、召回测试集。</p>
    <div class="mono" style="font-size:11.5px;color:var(--token-text-faint)">kb-retrieval · kb-filter · kb-rerank · kb-hittest</div>
  </div>
  <div style="border:1px solid var(--token-line-soft);border-left:2px solid var(--token-success);border-radius:var(--radius-md);padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <strong style="font-size:13px">问数域 · data</strong>
      <span class="kb-badge kb-badge--trusted">认证优先于生成</span>
    </div>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--token-text-muted);line-height:1.7">生成 SQL 卡（可见性 / 修正 diff）、问数答案容器、澄清反问、口径解释面板。</p>
    <div class="mono" style="font-size:11.5px;color:var(--token-text-faint)">kb-sql · kb-answer · kb-clarify · kb-explain</div>
  </div>
  <div style="border:1px solid var(--token-line-soft);border-left:2px solid var(--token-warning);border-radius:var(--radius-md);padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <strong style="font-size:13px">治理域 · ops</strong>
      <span class="kb-badge">观测与标注</span>
    </div>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--token-text-muted);line-height:1.7">trace span 树、标注队列（全键盘流）、无答案分析（建文档 / 加同义词）、评估对比（判级徽章）。</p>
    <div class="mono" style="font-size:11.5px;color:var(--token-text-faint)">kb-trace · kb-review · kb-gap · kb-eval</div>
  </div>
  <div style="border:1px solid var(--token-line-soft);border-left:2px solid var(--token-accent-cold);border-radius:var(--radius-md);padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <strong style="font-size:13px">工作台域 · agent</strong>
      <span class="kb-badge">动效非颜色</span>
    </div>
    <p style="margin:0 0 8px;font-size:12.5px;color:var(--token-text-muted);line-height:1.7">双栏画布（划词 AI 操作）、检查点（只回滚内容保留对话）、沙箱容器（postMessage JSON-RPC）、工具链条。</p>
    <div class="mono" style="font-size:11.5px;color:var(--token-text-faint)">kb-canvas · kb-checkpoint · kb-sandbox · kb-chain</div>
  </div>
</div>`,
    usage: `// 一行装全家（kb.css 基座 + 六域 CSS 全带上；behavior 按需从各细分 kit 引入）
import '@icen.ai/ui/kit/kb';

// 六域一览（规格 docs/spec/kb-family.md；27 个组件）：
// 证据 ground   kb-citation / kb-sources / kb-passage / kb-conflict
// 摄取 ingest   kb-pipeline / kb-chunks / kb-segment / kb-connector / kb-metadata / kb-qa
// 检索 search   kb-retrieval / kb-filter / kb-rerank / kb-hittest
// 问数 data     kb-sql / kb-answer / kb-clarify / kb-explain
// 治理 ops      kb-trace / kb-review / kb-gap / kb-eval
// 工作台 agent  kb-canvas / kb-checkpoint / kb-sandbox / kb-chain

// 共享数据契约与纯函数（引用 / 分数 / chunk / 分段 / 连接器健康，SSR 安全）：
import { normalizeCitation, segmentText, connectorHealth, formatScore } from '@icen.ai/ui/behaviors/kb-core';`,
  },

  /* ══════════ 证据域 ground ══════════ */
  {
    slug: 'kb-citation',
    name: '行内引用',
    group: '知识库',
    desc: '行内引用角标 .kb-citation + hover 引用卡：renderCitationText(el, text, sources) 把含 [3] 的答案文本切成「文本节点 + 角标」混合流（流式安全：delta 边界的 "[3" 自然留在文本段，增量重渲该 el 即可），sources 同时写入模块级注册表供 hover 卡取数；hover ≥300ms 经 popover portal 浮 .kb-citation-card（类型图标 / 域名 / 引文 ≤150 字 / 官方·过期·受限徽标，受限引文打码）；超界编号自动降级 .is-dead 灰显不可点——「不信任模型生成编号」纪律。点击派 icen:kb-citation-open { citation }。',
    demo: `<p class="demo-label" style="margin:0 0 8px">答案正文由 renderCitationText 注入角标 —— 悬停角标 ≥300ms 看引用卡（官方 / 过期 / 受限三种徽标态），点击派事件；末尾 [9] 超出来源数，降级为灰显死角标</p>
<div class="kb-quote" id="demo-kb-citation-answer" style="font-size:13px;line-height:2.1"></div>
<div class="toolbar" style="margin-top:12px">
  <span class="toolbar-label" id="demo-kb-citation-log">事件日志：悬停 / 点击任一活角标</span>
</div>`,
    usage: `import { initKbCitation, renderCitationText } from '@icen.ai/ui/kit/kb-citation';
initKbCitation();   // root 级委托：click → icen:kb-citation-open；hover ≥300ms 浮引用卡（幂等 + 返回销毁函数）

// 把含 [n] 的答案文本渲染成「文本 + 角标」混合流；sources 写入注册表（hover 卡数据源）
renderCitationText(el, '按《供应商准入手册》需三证审核与验厂 [1]，Q3 起新增 ESG 项 [2]…', [
  { id: 's1', index: 1, title: '供应商准入手册 v3.2', url: 'https://confluence.corp/pages/vendor-onboarding',
    kind: 'wiki', official: true, date: '2026-09-28', useCount: 2,
    citedText: '新供应商准入需通过三证审核并完成现场验厂，评分低于 60 分不予通过。' },
  { id: 's2', index: 2, title: '2026 Q3 采购政策更新纪要', kind: 'doc', date: '2026-09-21',
    citedText: '自 Q3 起准入评分新增 ESG 维度，权重 15%。' },
]);
// 超界编号（如 [9]）自动降级 <sup class="kb-citation is-dead">（灰显、aria-hidden、不可点）
// 单独造角标：renderCitationMark(3) → <button class="kb-citation" data-cite="3">3</button>
// 注册表读写（答案区与来源列表共享数据源）：setKbCitationSources(sources) / getKbCitationSources()
// hover 卡兜底增强：initKbCitation(root, { getCard(citation) { return fetchDetail(citation); } })`,
    behaviors: ['kb-citation'],
    behaviorInit: { 'kb-citation': 'initKbCitation' },
    script: `const answer = document.getElementById('demo-kb-citation-answer');
const logEl = document.getElementById('demo-kb-citation-log');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
/* 来源注册表：official 官方 / 400 天前 stale / restricted 受限，三种徽标态齐全 */
const SOURCES = [
  { id: 's1', index: 1, title: '供应商准入手册 v3.2（采购部终版）', url: 'https://confluence.corp/pages/vendor-onboarding', kind: 'wiki', official: true, date: daysAgo(5), useCount: 2, owner: '采购部 · 王莉', citedText: '新供应商准入需通过营业执照、行业资质、质量体系三证审核，并完成现场验厂；准入评分低于 60 分不予通过。' },
  { id: 's2', index: 2, title: '2026 Q3 采购政策更新纪要', kind: 'doc', date: daysAgo(12), useCount: 1, owner: '采购部 · 王莉', citedText: '自 2026 年 Q3 起，供应商准入评分新增 ESG 维度（环保合规与社会责任），权重 15%。' },
  { id: 's3', index: 3, title: '供应商准入评分细则（2024 修订）', kind: 'doc', date: daysAgo(400), useCount: 1, citedText: '准入评分 = 资质 40 + 质量 35 + 交付 25，总分 100 分。' },
  { id: 's4', index: 4, title: 'HR 薪酬与竞业限制管理办法', kind: 'doc', permission: 'restricted', date: daysAgo(60), citedText: '竞业补偿标准与适用岗位清单仅向 HR 与法务开放。' },
];
if (answer && kbCitationMod) {
  /* 渲染答案正文（角标 + 文本混合流）；sources 同时写入模块级注册表，hover 卡据此取数 */
  kbCitationMod.renderCitationText(answer, '按《供应商准入手册》要求，新供应商需通过三证审核与现场验厂后方可准入 [1]；2026 年 Q3 起准入评分新增 ESG 维度 [2]，淘汰线仍为 60 分 [3]。涉及竞业条款的口径属受限文档 [4]，而超出来源数的引用会降级为死角标 [9]。', SOURCES);
  answer.addEventListener('icen:kb-citation-open', function (e) {
    log('icen:kb-citation-open · [' + e.detail.citation.index + '] ' + e.detail.citation.title);
  });
}`,
  },
  {
    slug: 'kb-sources',
    name: '来源列表',
    group: '知识库',
    desc: '来源列表 .kb-sources：--row 答案上方横排 / --rail 侧栏纵列两种布局；useCount 降序（被引 ×N，同计数稳定原序）；徽标覆盖 官方（accent 线框）/ 相对时间（>90 天自动 stale 加警示点）/ 受限（锁形徽标 + 申请访问按钮，行壳降级 role=button 补 Enter/Space 键控）；onlyCited 只保留被引过的来源（流式「随流填充」），空集给引导空态。点击来源行 / 申请访问 → icen:kb-source-open { source }（与冲突组、原文抽屉同一事件契约）。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <span class="toolbar-label">布局</span>
  <button class="btn btn-sm btn-primary" type="button" data-kb-sources-variant="row">row 横排</button>
  <button class="btn btn-sm" type="button" data-kb-sources-variant="rail">rail 纵列</button>
  <span class="toolbar-spacer"></span>
  <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--token-text-muted)"><input type="checkbox" id="demo-kb-sources-only">onlyCited（随流填充）</label>
</div>
<div id="demo-kb-sources-box" style="max-width:600px"></div>
<p class="demo-label" id="demo-kb-sources-log" style="margin-top:10px">事件日志：点击来源行或受限行的「申请访问」</p>`,
    usage: `import { renderKbSources, initKbSources } from '@icen.ai/ui/kit/kb-sources';
initKbSources();   // 委托点击 → icen:kb-source-open { source }；受限行补 Enter/Space 键控（幂等 + 销毁函数）

renderKbSources(el, sources, {
  variant: 'row',          // 'row' 答案上方横排（默认）| 'rail' 侧栏纵列
  onlyCited: false,        // true = 只保留被引过的来源（useCount > 0，流式随流填充）
  onOpen: (source) => openPassage(source),   // 与事件双通道
});
// 来源对象即 kb-core KbCitation：official / date（>90 天自动 stale）/ permission 受限加锁与申请入口
// 排序：useCount 降序（被引 ×N）；空数组渲染 .kb-empty「下一条答案引用的段落将出现在这里」`,
    behaviors: ['kb-sources'],
    behaviorInit: { 'kb-sources': 'initKbSources' },
    script: `const box = document.getElementById('demo-kb-sources-box');
const logEl = document.getElementById('demo-kb-sources-log');
const onlyCb = document.getElementById('demo-kb-sources-only');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
/* official / 新鲜 / stale（400 天）/ 无徽标 / restricted 五种形态；useCount 驱动排序 */
const SOURCES = [
  { id: 's1', index: 1, title: '供应商准入手册 v3.2（采购部终版）', url: 'https://confluence.corp/pages/vendor-onboarding', kind: 'wiki', official: true, date: daysAgo(5), useCount: 3 },
  { id: 's2', index: 2, title: '2026 Q3 季度经营复盘会纪要', kind: 'doc', date: daysAgo(12), useCount: 1 },
  { id: 's3', index: 3, title: '供应商准入评分细则（2024 修订）', kind: 'doc', date: daysAgo(400), useCount: 1 },
  { id: 's4', index: 4, title: 'IT 工单系统操作指引', url: 'https://tickets.corp/kb/1024', kind: 'ticket', date: daysAgo(30) },
  { id: 's5', index: 5, title: 'HR 薪酬与竞业限制管理办法', kind: 'doc', permission: 'restricted', date: daysAgo(60) },
];
let variant = 'row';
function render() {
  if (!box || !kbSourcesMod) return;
  kbSourcesMod.renderKbSources(box, SOURCES, { variant: variant, onlyCited: !!(onlyCb && onlyCb.checked) });
}
document.querySelectorAll('[data-kb-sources-variant]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    variant = btn.getAttribute('data-kb-sources-variant') || 'row';
    render();
    document.querySelectorAll('[data-kb-sources-variant]').forEach(function (b) { b.classList.toggle('btn-primary', b === btn); });
  });
});
if (onlyCb) onlyCb.addEventListener('change', render);
render();
if (box) box.addEventListener('icen:kb-source-open', function (e) {
  log('icen:kb-source-open · ' + e.detail.source.title + (e.detail.source.permission !== 'readable' ? '（受限，宿主接申请流程）' : ''));
});`,
  },
  {
    slug: 'kb-passage',
    name: '原文定位',
    group: '知识库',
    desc: '原文定位查看器 .kb-passage（右侧抽屉，滑入不打断对话）：open(citation) 渲染来源标题 + KbLocation 三分型位置徽标（第 N 页 / 块 a–b / 字符 a–b），getDocument 同异步取 { content, loc, contextBefore, contextAfter }，缺席回落 citedText → snippet；highlight(terms) 纯文本遍历 <mark> 多词轮转分色（data-hit 0|1|2）；expand() 展开上下文；受限权限正文 blur 打码 + 申请访问（派 icen:kb-source-open）。Esc 关闭 / Tab 圈禁 / 焦点还原，跳转派 icen:kb-passage-jump，关闭派 icen:kb-passage-close。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <button class="btn btn-sm btn-primary" type="button" id="demo-kb-passage-open">打开可读来源（第 3 页）</button>
  <button class="btn btn-sm" type="button" id="demo-kb-passage-restricted">打开受限来源（打码 + 申请访问）</button>
  <button class="btn btn-sm" type="button" id="demo-kb-passage-highlight">highlight 多词分色</button>
  <button class="btn btn-sm" type="button" id="demo-kb-passage-expand">expand 上下文</button>
  <button class="btn btn-sm" type="button" id="demo-kb-passage-close">close</button>
</div>
<p class="demo-label" style="margin:0 0 8px">右侧滑入抽屉（Esc 关闭，焦点还原触发前元素）</p>
<div id="demo-kb-passage-host"></div>
<p class="demo-label" id="demo-kb-passage-log" style="margin-top:8px">事件日志：等待交互</p>`,
    usage: `import { createKbPassage } from '@icen.ai/ui/kit/kb-passage';
const viewer = createKbPassage(hostEl, {
  getDocument: (citation) => fetch('/api/docs/' + citation.documentId).then((r) => r.json()),
  // 返回 { content, loc?, contextBefore?, contextAfter? }；未提供 / 落空回落 citedText → snippet
  // anchor: anchorEl,   // 提供后 open 时滚动定位容器内 [data-kb-loc]（精确匹配 → loc.start 最近匹配）
  onJump: (citation) => console.log('jump', citation.title),
});
viewer.open({ id: 'c1', title: '供应商准入手册 v3.2', kind: 'wiki', documentId: 'doc-vendor-32',
  loc: { kind: 'page', start: 3, end: 3 },          // KbLocation 三分型：char | page | block
  citedText: '评分低于 60 分不予通过' });
viewer.highlight(['供应商', '验厂']);   // <mark class="kb-passage-hit" data-hit="0|1|2"> 多词轮转分色
viewer.expand();                        // 展示 contextBefore / contextAfter（一层，幂等）
viewer.close();                         // 派 icen:kb-passage-close，焦点还原
// 受限来源（permission ≠ readable）正文自动打码 +「申请访问」→ icen:kb-source-open
// 事件：icen:kb-passage-jump { citation } / icen:kb-passage-close {}`,
    behaviors: ['kb-passage'],
    script: `const host = document.getElementById('demo-kb-passage-host');
const logEl = document.getElementById('demo-kb-passage-log');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
const READABLE = { id: 'c1', index: 1, title: '供应商准入手册 v3.2（采购部终版）', kind: 'wiki', official: true, documentId: 'doc-vendor-32', loc: { kind: 'page', start: 3, end: 3 }, url: 'https://confluence.corp/pages/vendor-onboarding', citedText: '新供应商准入需通过三证审核并完成现场验厂；评分低于 60 分不予通过。' };
const RESTRICTED = { id: 'c5', index: 5, title: 'HR 薪酬与竞业限制管理办法', kind: 'doc', permission: 'restricted', citedText: '竞业补偿标准与适用岗位清单仅向 HR 与法务开放，其余角色申请后可见。' };
let viewer = null;
if (host && kbPassageMod) {
  viewer = kbPassageMod.createKbPassage(host, {
    getDocument: function (c) {
      if (c.id !== 'c1') return null;   /* 受限来源不取原文（打码 + 申请访问） */
      return {
        content: '第 3 条 准入评分：新供应商准入评分由资质（40 分）、质量（35 分）、交付（25 分）三部分构成，总分 100 分。供应商需先通过三证审核，再由 SQE 完成现场验厂；涉及 ESG 加分项见第 4 条。评分低于 60 分不予通过准入，结果由采购部在准入系统中公示 3 个工作日。',
        loc: { kind: 'page', start: 3, end: 3 },
        contextBefore: '第 2 条 三证审核：营业执照、行业资质、质量体系缺一不可。',
        contextAfter: '第 4 条 ESG 加分：环保合规与社会责任最多加 15 分。',
      };
    },
  });
  host.addEventListener('icen:kb-passage-jump', function (e) { log('icen:kb-passage-jump · ' + e.detail.citation.title); });
  host.addEventListener('icen:kb-passage-close', function () { log('icen:kb-passage-close · 焦点已还原'); });
  host.addEventListener('icen:kb-source-open', function (e) { log('icen:kb-source-open（申请访问）· ' + e.detail.source.title); });
}
document.getElementById('demo-kb-passage-open')?.addEventListener('click', function () { viewer?.open(READABLE); });
document.getElementById('demo-kb-passage-restricted')?.addEventListener('click', function () { viewer?.open(RESTRICTED); });
document.getElementById('demo-kb-passage-highlight')?.addEventListener('click', function () {
  viewer?.highlight(['供应商', '验厂', '评分']);
  log('highlight([供应商, 验厂, 评分]) · 三词轮转 data-hit 0|1|2 分色');
});
document.getElementById('demo-kb-passage-expand')?.addEventListener('click', function () { viewer?.expand(); });
document.getElementById('demo-kb-passage-close')?.addEventListener('click', function () { viewer?.close(); });`,
  },
  {
    slug: 'kb-conflict',
    name: '来源冲突',
    group: '知识库',
    desc: '来源冲突组 .kb-conflict（市场空白组件）：同一主张的多版本对勘——claim 警示行 + 版本卡横排；is-current 自动判定（官方优先，否则最新日期，都无则首个版本），其余版本 faded（.is-older）+ 满足 >90 天 stale 判定加过期徽标；对勘场景日期用绝对值（相对时间看不出先后）。点击版本卡 → icen:kb-source-open { source }（与来源列表同一契约，宿主据此打开 passage / 外链）；渲染即接线，无 init。',
    demo: `<div class="kb-conflict">
  <div class="kb-conflict-claim"><i class="kb-dot is-warn"></i>同一主张：差旅住宿标准为一线城市每晚 600 元</div>
  <div class="kb-conflict-versions">
    <button class="kb-conflict-ver is-current" type="button" data-kb-source-id="cf1">
      <span class="kb-conflict-ver-head">
        <span class="kb-conflict-ver-date kb-num">2026-08-12</span>
        <span class="kb-conflict-ver-badges"><span class="kb-badge kb-badge--official">官方</span></span>
      </span>
      <span class="kb-conflict-ver-title">差旅费用管理制度（财务部终版）</span>
      <span class="kb-conflict-ver-sub">confluence.corp · 责任人 财务部 · 陈静</span>
    </button>
    <button class="kb-conflict-ver is-older" type="button" data-kb-source-id="cf2">
      <span class="kb-conflict-ver-head">
        <span class="kb-conflict-ver-date kb-num">2025-11-03</span>
        <span class="kb-conflict-ver-badges"><span class="kb-badge kb-badge--stale"><i class="kb-dot is-warn"></i>10 个月前</span></span>
      </span>
      <span class="kb-conflict-ver-title">差旅报销 FAQ（行政部旧版）</span>
      <span class="kb-conflict-ver-sub">confluence.corp · 责任人 行政部 · 刘洋</span>
    </button>
  </div>
</div>
<div class="kb-conflict" style="margin-top:12px">
  <div class="kb-conflict-claim"><i class="kb-dot is-warn"></i>同一主张：质保期自验收合格之日起 12 个月</div>
  <div class="kb-conflict-versions">
    <button class="kb-conflict-ver is-current" type="button" data-kb-source-id="cf3">
      <span class="kb-conflict-ver-head"><span class="kb-conflict-ver-date kb-num">2026-06-20</span><span class="kb-conflict-ver-badges"></span></span>
      <span class="kb-conflict-ver-title">采购合同模板 v5（法务更新）</span>
      <span class="kb-conflict-ver-sub">confluence.corp · 责任人 法务部 · 赵珂</span>
    </button>
    <button class="kb-conflict-ver is-older" type="button" data-kb-source-id="cf4">
      <span class="kb-conflict-ver-head">
        <span class="kb-conflict-ver-date kb-num">2025-05-08</span>
        <span class="kb-conflict-ver-badges"><span class="kb-badge kb-badge--stale"><i class="kb-dot is-warn"></i>1 年前</span></span>
      </span>
      <span class="kb-conflict-ver-title">供应商合作须知（2025 版）</span>
      <span class="kb-conflict-ver-sub">confluence.corp · 责任人 采购部 · 王莉</span>
    </button>
  </div>
</div>
<p class="demo-label" style="margin:12px 0 8px">renderKbConflict 动态渲染一组（无官方徽标时 is-current 落在最新日期版本）——点击版本卡派事件</p>
<div id="demo-kb-conflict-live"></div>
<p class="demo-label" id="demo-kb-conflict-log" style="margin-top:8px">事件日志：点击动态组任一版本卡</p>`,
    usage: `import { renderKbConflict } from '@icen.ai/ui/kit/kb-conflict';
renderKbConflict(el, [
  {
    claim: '同一主张：差旅住宿标准为一线城市每晚 600 元',
    versions: [
      { id: 'v1', title: '差旅费用管理制度（财务部终版）', official: true, date: '2026-08-12',
        owner: '财务部 · 陈静', url: 'https://confluence.corp/pages/travel' },
      { id: 'v2', title: '差旅报销 FAQ（行政部旧版）', date: '2025-11-03', owner: '行政部 · 刘洋' },
    ],
  },
], {
  onOpen: (source) => openPassage(source),   // 与 icen:kb-source-open 事件双通道（渲染即接线，无 init）
});
// is-current 判定：official 优先，否则最新 date；其余 .is-older faded + stale（>90 天）徽标
// 版本卡日期给绝对值（对勘要看出先后），域名/责任人做 sub 行`,
    behaviors: ['kb-conflict'],
    script: `const live = document.getElementById('demo-kb-conflict-live');
const logEl = document.getElementById('demo-kb-conflict-log');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
if (live && kbConflictMod) {
  kbConflictMod.renderKbConflict(live, [
    { claim: '同一主张：IT 工单首次响应时限为 2 小时（P1 级）',
      versions: [
        { id: 'v1', title: '官方数据字典 · 服务等级字段口径', kind: 'db', official: true, date: daysAgo(20), owner: '数据平台 · 李维' },
        { id: 'v2', title: '工单系统 SLA 配置页（快照）', kind: 'ticket', date: daysAgo(150), owner: 'IT 服务台 · 周明' },
      ] },
  ], {
    onOpen: function (source) { log('onOpen · ' + source.title); },
  });
  live.addEventListener('icen:kb-source-open', function (e) {
    log('icen:kb-source-open · ' + e.detail.source.title + (e.detail.source.official ? '（官方口径）' : '（旧版本，faded）'));
  });
}`,
  },

  /* ══════════ 摄取域 ingest ══════════ */
  {
    slug: 'kb-pipeline',
    name: '解析管线',
    group: '知识库',
    desc: '文档解析管线时间线 .kb-pipeline：折叠摘要行（状态徽章 + 标题 + N chunks + 耗时 + 步数）+ 步骤 ol + 失败错误区（阶段定位 + 原因），run.progress 可选细粒度进度条。六态状态机（unstart/queued/running/cancel/done/fail）；running / fail 自动展开、用户展开过则不再被自动态覆盖（与 ai-reasoning 同契约），重渲染保留折叠态。失败重跑粒度 = 单文档（无死路）：icen:kb-pipeline-rerun { documentId }；折叠派 icen:kb-pipeline-toggle { el, open }。',
    demo: `<p class="demo-label" style="margin:0 0 8px">三态各一张卡：done（折叠）/ running（自动展开 + 进度条）/ fail（自动展开 + 错误区）——点摘要行折叠，点「重跑」派事件</p>
<div id="demo-kb-pipeline"></div>
<p class="demo-label" id="demo-kb-pipeline-log" style="margin-top:8px">事件日志：等待交互</p>`,
    usage: `import { renderKbPipeline, initKbPipeline } from '@icen.ai/ui/kit/kb-pipeline';
initKbPipeline();   // 委托折叠 + 单文档重跑（root 缺省 document，后续插入的卡一并接管）

renderKbPipeline(el, {
  documentId: 'doc-vendor-32',
  title: '供应商准入手册 v3.2.pdf',
  status: 'fail',                          // unstart | queued | running | cancel | done | fail
  progress: 62,                            // 可选细粒度进度条（0–100）
  steps: [
    { key: 'upload', label: '上传',   status: 'done',   detail: '8.2 MB', elapsedMs: 420 },
    { key: 'parse',  label: '解析',   status: 'done',   detail: '26 页 · 2 表', elapsedMs: 3100 },
    { key: 'table',  label: '表格识别', status: 'fail',  detail: 'sheet「指标口径」', elapsedMs: 1800 },
    { key: 'chunk',  label: '切片',   status: 'unstart' },
  ],
  chunkCount: 48,
  elapsedMs: 12620,
  error: { stage: '表格识别', message: '合并单元格跨页断裂：B14 外键引用为空' },
});
// 数组输入渲染纵向列表（外层 .kb-pipeline-list）；空数组给空态「暂无解析任务」
// running / fail 折叠初值自动展开；用户操作过（按 data-document-id 记忆）则重渲染不覆盖
// 事件：icen:kb-pipeline-toggle { el, open } / icen:kb-pipeline-rerun { documentId }`,
    behaviors: ['kb-pipeline'],
    behaviorInit: { 'kb-pipeline': 'initKbPipeline' },
    script: `const box = document.getElementById('demo-kb-pipeline');
const logEl = document.getElementById('demo-kb-pipeline-log');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
/* 三种 run：done（全绿）/ running（进度条 + 部分步骤进行中）/ fail（错误区定位阶段与原因） */
const RUNS = [
  { documentId: 'doc-vendor-32', title: '供应商准入手册 v3.2.pdf', status: 'done', chunkCount: 48, elapsedMs: 12620,
    steps: [
      { key: 'upload', label: '上传', status: 'done', detail: '8.2 MB', elapsedMs: 420 },
      { key: 'parse', label: '解析', status: 'done', detail: '26 页 · 2 表', elapsedMs: 3100 },
      { key: 'table', label: '表格识别', status: 'done', detail: '2 表 · 14 行', elapsedMs: 1900, count: 14 },
      { key: 'chunk', label: '切片', status: 'done', detail: '语义 + 表格混排', elapsedMs: 2600, count: 48 },
      { key: 'embed', label: '向量化', status: 'done', detail: 'bge-m3', elapsedMs: 4100, count: 48 },
      { key: 'index', label: '入库', status: 'done', elapsedMs: 500 },
    ] },
  { documentId: 'doc-mins-107', title: '2026 Q3 季度经营复盘会纪要.docx', status: 'running', progress: 62,
    steps: [
      { key: 'upload', label: '上传', status: 'done', detail: '12.4 MB', elapsedMs: 610 },
      { key: 'parse', label: '解析', status: 'done', detail: '18 页 · 3 表', elapsedMs: 2800 },
      { key: 'table', label: '表格识别', status: 'running', detail: '第 4/6 张' },
      { key: 'chunk', label: '切片', status: 'queued' },
      { key: 'embed', label: '向量化', status: 'unstart' },
    ] },
  { documentId: 'doc-dict-58', title: '官方数据字典导出.xlsx', status: 'fail', elapsedMs: 2650,
    error: { stage: '表格识别', message: '合并单元格跨页断裂：B14 外键引用为空，无法归一为行列结构' },
    steps: [
      { key: 'upload', label: '上传', status: 'done', detail: '2.1 MB', elapsedMs: 210 },
      { key: 'parse', label: '解析', status: 'done', detail: '6 sheet', elapsedMs: 640 },
      { key: 'table', label: '表格识别', status: 'fail', detail: 'sheet「指标口径」', elapsedMs: 1800 },
      { key: 'chunk', label: '切片', status: 'unstart' },
    ] },
];
if (box && kbPipelineMod) {
  kbPipelineMod.renderKbPipeline(box, RUNS);
  box.addEventListener('icen:kb-pipeline-toggle', function (e) {
    const card = e.detail.el;
    log('icen:kb-pipeline-toggle · ' + (card && card.dataset ? card.dataset.documentId : '') + ' → ' + (e.detail.open ? '展开' : '折叠'));
  });
  box.addEventListener('icen:kb-pipeline-rerun', function (e) {
    log('icen:kb-pipeline-rerun · documentId=' + e.detail.documentId + '（失败重跑粒度 = 单文档）');
  });
}`,
  },
  {
    slug: 'kb-chunks',
    name: '分段编辑器',
    group: '知识库',
    desc: 'chunk 编辑器 .kb-chunks：行内直接编辑（contenteditable，blur 且内容变化才提交，meta 出「已编辑」）+ 启停开关（available=false 不删除、仅排除出检索——RAGFlow 语义，行整体降透明）+ 关键词 chips（域内自实现：× 删除 / Enter 新增）+ 全文|语义双通道搜索（全文本地过滤内容与关键词，语义模式交消费方召回后重渲染，两种模式都派事件）。删除只派事件不删行——不可逆操作由消费方确认后重渲染。事件族 icen:kb-chunk-toggle / edit / remove / add / search。',
    demo: `<p class="demo-label" style="margin:0 0 8px">直接改写正文（失焦提交）/ 点启用开关（第 4 条已停用）/ 敲 Enter 加关键词 / 全文搜索本地过滤（试试「评分」），切「语义」模式只派事件不过滤</p>
<div id="demo-kb-chunks"></div>
<p class="demo-label" id="demo-kb-chunks-log" style="margin-top:8px">事件日志：等待交互</p>`,
    usage: `import { renderKbChunks, initKbChunks } from '@icen.ai/ui/kit/kb-chunks';
initKbChunks();   // 行内编辑 / 启停 / 关键词 / 增删 / 搜索 全部 root 级委托（幂等 + 销毁函数）

renderKbChunks(el, [
  { id: 'ck-2', documentId: 'doc-vendor-32', available: true, page: 3,
    keywords: ['评分', '淘汰线'],
    content: '准入评分 = 资质 40 + 质量 35 + 交付 25；评分低于 60 分不予通过。' },
  { id: 'ck-4', documentId: 'doc-vendor-32', available: false, page: 6,
    content: '（历史口径，已被 v3.2 取代）准入评分 = 资质 50 + 质量 50。' },
], { documentId: 'doc-vendor-32', searchMode: 'text', query: '' });
// available=false → .is-off（排除出检索不删除）；edited → .is-edited + meta「已编辑」
// 事件：icen:kb-chunk-toggle { chunkId, available } / icen:kb-chunk-edit { chunkId }
//      icen:kb-chunk-remove { chunkId } / icen:kb-chunk-add { documentId }
//      icen:kb-chunk-search { mode: 'text' | 'vector', query }（输入 200ms 防抖）`,
    behaviors: ['kb-chunks'],
    behaviorInit: { 'kb-chunks': 'initKbChunks' },
    script: `const box = document.getElementById('demo-kb-chunks');
const logEl = document.getElementById('demo-kb-chunks-log');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
const CHUNKS = [
  { id: 'ck-1', documentId: 'doc-vendor-32', available: true, page: 2, keywords: ['准入', '三证审核'],
    content: '新供应商准入需通过营业执照、行业资质、质量体系三证审核，并完成现场验厂。' },
  { id: 'ck-2', documentId: 'doc-vendor-32', available: true, page: 3, keywords: ['评分', '淘汰线'],
    content: '准入评分 = 资质 40 + 质量 35 + 交付 25，总分 100 分；评分低于 60 分不予通过准入。' },
  { id: 'ck-3', documentId: 'doc-vendor-32', available: true, page: 4, keywords: ['ESG'], edited: true,
    content: '自 2026 年 Q3 起，准入评分新增 ESG 维度（环保合规与社会责任），权重 15%。' },
  { id: 'ck-4', documentId: 'doc-vendor-32', available: false, page: 6,
    content: '（历史口径，已被 v3.2 取代）准入评分 = 资质 50 + 质量 50，无交付维度。' },
];
if (box && kbChunksMod) {
  kbChunksMod.renderKbChunks(box, CHUNKS, { documentId: 'doc-vendor-32', placeholder: '全文搜索 chunk…（试试「评分」）' });
  box.addEventListener('icen:kb-chunk-toggle', function (e) {
    log('icen:kb-chunk-toggle · ' + e.detail.chunkId + ' → ' + (e.detail.available ? '启用' : '停用（不删除，排除出检索）'));
  });
  box.addEventListener('icen:kb-chunk-edit', function (e) { log('icen:kb-chunk-edit · ' + e.detail.chunkId + '（行内变更已提交）'); });
  box.addEventListener('icen:kb-chunk-remove', function (e) { log('icen:kb-chunk-remove · ' + e.detail.chunkId + '（只派事件，消费方确认后重渲染）'); });
  box.addEventListener('icen:kb-chunk-add', function (e) { log('icen:kb-chunk-add · documentId=' + e.detail.documentId); });
  box.addEventListener('icen:kb-chunk-search', function (e) { log('icen:kb-chunk-search · mode=' + e.detail.mode + ' query="' + e.detail.query + '"'); });
}`,
  },
  {
    slug: 'kb-segment',
    name: '分段策略',
    group: '知识库',
    desc: '分段策略编辑器 .kb-segment：左表单（模式 auto / custom / parent-child + 分隔符 + 最大长度 + 重叠 + 三项清洗勾选）右实时预览——预览走 kb-core segmentText 纯函数真实切分（非估算），N 段 / 均长 / ≈tokens 三指标 + 前 20 段卡片（200px 截断点击展开）。locked 锁模式不锁参数（Dify 纪律）；重叠 ≥ 最大长度即时校验且不阻断预览。任一变更派 icen:kb-segment-change { config }，句柄 getConfig / setConfig / refresh(sample) 程序化读写。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <button class="btn btn-sm" type="button" id="demo-kb-segment-lock">setConfig({ mode: 'parent-child', locked: true })</button>
  <span class="toolbar-label">样本：《供应商准入手册》第 3–6 条（真实切分，非估算）</span>
</div>
<div id="demo-kb-segment"></div>
<p class="demo-label" id="demo-kb-segment-log" style="margin-top:8px">事件日志：改动左侧任一参数，或点上方按钮程序化赋值</p>`,
    usage: `import { createKbSegment } from '@icen.ai/ui/kit/kb-segment';
const seg = createKbSegment(el, {
  config: { mode: 'auto', maxLength: 500, overlap: 50, clean: ['collapse-blank'] },
  sample: '第 3 条 准入评分\\n\\n第 4 条 ESG 加分\\n\\n…',   // 预览素材（segmentText 真实切分）
  onChange: (config) => saveDraft(config),        // 与 icen:kb-segment-change 事件双通道
});
seg.getConfig();                  // 归一化副本（调用方可安全改写）
seg.setConfig({ locked: true });  // 程序化赋值：同步表单 + 重算预览，不派事件不触发 onChange
seg.refresh(newSample);           // 换样本重算
seg.destroy();                    // 摘除全部监听
// locked：模式 segmented 禁用 + 顶部警示（模式创建后不可更改，参数可随时调整）
// parent-child：父段按分隔符切、子段按长度自动生成（提示行）；重叠 ≥ 最大长度即时校验`,
    behaviors: ['kb-segment'],
    script: `const host = document.getElementById('demo-kb-segment');
const logEl = document.getElementById('demo-kb-segment-log');
const lockBtn = document.getElementById('demo-kb-segment-lock');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
const SAMPLE = '第 3 条 准入评分：新供应商准入评分由资质（40 分）、质量（35 分）、交付（25 分）三部分构成，总分 100 分；评分低于 60 分不予通过准入。\\n\\n第 4 条 ESG 加分：自 2026 年 Q3 起，准入评分新增 ESG 维度（环保合规与社会责任），权重 15%，由采购部在季度评审中核定。\\n\\n第 5 条 验厂要求：SQE 须在资料初审通过后 10 个工作日内完成现场验厂，验厂 checklist 见附录 B；逾期未安排的申请自动退回。\\n\\n第 6 条 公示：准入结果在准入系统公示 3 个工作日，异议由采购部会同质量部复核。';
if (host && kbSegmentMod) {
  const seg = kbSegmentMod.createKbSegment(host, {
    config: { mode: 'auto', maxLength: 500, overlap: 50, clean: ['collapse-blank'] },
    sample: SAMPLE,
    onChange: function (config) {
      log('icen:kb-segment-change · mode=' + config.mode + ' maxLength=' + config.maxLength + ' overlap=' + config.overlap + ' clean=[' + config.clean.join(', ') + ']');
    },
  });
  lockBtn?.addEventListener('click', function () {
    seg.setConfig({ mode: 'parent-child', locked: true });
    log('setConfig（程序化赋值，不派事件）· 已切 parent-child 并锁定模式——模式按钮禁用，参数仍可调');
  });
}`,
  },
  {
    slug: 'kb-connector',
    name: '数据源连接',
    group: '知识库',
    desc: '数据源连接器卡 .kb-connector：Glean 式健康模型（enabled ≠ 健康：24h 未同步 = stale，抓取失败 / 凭证过期 = failing，停用 = off）映射为卡左缘色条 + 状态点；信号行 4 离散信号（健康 / 已同步 / 抓取率 / 变更率）+ 凭证徽标（过期红标 / 未配置灰标）；头部类型图标（来源类型注册表）+ scope + cron 同步计划（mono 展示）。操作三钮 → icen:kb-connector-sync / reauth / schedule { connectorId, schedule }。',
    demo: `<p class="demo-label" style="margin:0 0 8px">三张卡各占一态：healthy（3 小时前同步）/ stale（Jira 74 小时未同步）/ failing（HR 凭证过期 + 抓取失败）——点卡上三个操作按钮派事件</p>
<div id="demo-kb-connectors"></div>
<p class="demo-label" id="demo-kb-connector-log" style="margin-top:8px">事件日志：等待交互</p>`,
    usage: `import { renderKbConnectors, initKbConnectors } from '@icen.ai/ui/kit/kb-connector';
initKbConnectors();   // 委托三钮：sync / reauth / schedule（root 缺省 document，幂等 + 销毁函数）

renderKbConnectors(el, [
  { id: 'cn-1', name: 'Confluence', kind: 'wiki', scope: '空间：/engineering', enabled: true,
    lastSyncAt: new Date(Date.now() - 3 * 3600e3).toISOString(), lastCrawlStatus: 'ok',
    itemsSynced: 1204, crawlRate: 86, changeRate: 12, credential: 'ok', schedule: '0 */2 * * *' },
  { id: 'cn-2', name: 'Jira 工单', kind: 'ticket', enabled: true,
    lastSyncAt: new Date(Date.now() - 74 * 3600e3).toISOString(), lastCrawlStatus: 'ok',
    itemsSynced: 892, crawlRate: 24, changeRate: 31, credential: 'ok' },      // 24h 停滞 → stale
  { id: 'cn-3', name: 'HR 系统', kind: 'api', enabled: true, credential: 'expired' },  // → failing
]);
// 健康类由 kb-core connectorHealth 判定，卡片加 is-healthy / is-stale / is-failing / is-off
// kind 图标走来源类型注册表（registerKbSourceType 可扩展自定义连接器）
// 事件：icen:kb-connector-sync { connectorId } / icen:kb-connector-reauth { connectorId }
//      icen:kb-connector-schedule { connectorId, schedule }（schedule = 渲染时 cron 原值）`,
    behaviors: ['kb-connector'],
    behaviorInit: { 'kb-connector': 'initKbConnectors' },
    script: `const box = document.getElementById('demo-kb-connectors');
const logEl = document.getElementById('demo-kb-connector-log');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
function hoursAgo(n) { return new Date(Date.now() - n * 3600000).toISOString(); }
/* healthy / stale（>24h 停滞）/ failing（凭证过期 + 抓取失败）三态齐全 */
const CONNECTORS = [
  { id: 'cn-confluence', name: 'Confluence', kind: 'wiki', scope: '空间：采购与供应链', enabled: true,
    lastSyncAt: hoursAgo(3), lastCrawlStatus: 'ok', itemsSynced: 1204, crawlRate: 86, changeRate: 12,
    credential: 'ok', schedule: '0 */2 * * *' },
  { id: 'cn-jira', name: 'Jira 工单系统', kind: 'ticket', scope: '项目：VEND', enabled: true,
    lastSyncAt: hoursAgo(74), lastCrawlStatus: 'ok', itemsSynced: 892, crawlRate: 24, changeRate: 31,
    credential: 'ok', schedule: '30 1 * * *' },
  { id: 'cn-hr', name: 'HR 系统（花名册）', kind: 'api', scope: '组织与薪酬范围', enabled: true,
    lastSyncAt: hoursAgo(8), lastCrawlStatus: 'fail', itemsSynced: 356, crawlRate: 0, changeRate: 0,
    credential: 'expired', schedule: '0 3 * * 0' },
];
if (box && kbConnectorMod) {
  kbConnectorMod.renderKbConnectors(box, CONNECTORS);
  box.addEventListener('icen:kb-connector-sync', function (e) { log('icen:kb-connector-sync · ' + e.detail.connectorId); });
  box.addEventListener('icen:kb-connector-reauth', function (e) { log('icen:kb-connector-reauth · ' + e.detail.connectorId); });
  box.addEventListener('icen:kb-connector-schedule', function (e) { log('icen:kb-connector-schedule · ' + e.detail.connectorId + ' cron=' + e.detail.schedule); });
}`,
  },
  {
    slug: 'kb-metadata',
    name: '元数据',
    group: '知识库',
    desc: '元数据管理 .kb-metadata：字段定义表（类型徽标 string / number / time）+ 值绑定行内编辑；内置字段（title 等）值只读、不可移除（「内置」旗标）；底部新增行自定义字段名 + 类型三选。三类动作统一派 icen:kb-metadata-change { action: bind | define | remove, key }——define / remove 同时做本地 DOM 更新（直接操纵纪律），消费方可凭事件重渲染纠偏；空字段名即时标 aria-invalid 不动作。',
    demo: `<p class="demo-label" style="margin:0 0 8px">改自定义字段的值（change 提交）/ 底部新增字段（类型三选，空字段名即时校验）/ 移除自定义字段——内置字段 title 只读</p>
<div id="demo-kb-metadata"></div>
<p class="demo-label" id="demo-kb-metadata-log" style="margin-top:8px">事件日志：等待交互</p>`,
    usage: `import { renderKbMetadata, initKbMetadata } from '@icen.ai/ui/kit/kb-metadata';
initKbMetadata();   // 值绑定 / 新增 / 移除 委托（root 缺省 document，幂等 + 销毁函数）

renderKbMetadata(el, {
  fields: [
    { key: 'title', type: 'string', builtin: true, label: '标题' },   // 内置：只读、不可移除
    { key: 'department', type: 'string' },
    { key: 'reviewDate', type: 'time' },
    { key: 'scoreWeight', type: 'number' },
  ],
  values: { title: '供应商准入手册', department: '采购部', reviewDate: '2026-08-12', scoreWeight: 15 },
});
// 事件：icen:kb-metadata-change { action: 'bind' | 'define' | 'remove', key }
// define/remove 已做本地 DOM 更新（追加行 / 删行），消费方凭事件重渲染纠偏`,
    behaviors: ['kb-metadata'],
    behaviorInit: { 'kb-metadata': 'initKbMetadata' },
    script: `const box = document.getElementById('demo-kb-metadata');
const logEl = document.getElementById('demo-kb-metadata-log');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
if (box && kbMetadataMod) {
  kbMetadataMod.renderKbMetadata(box, {
    fields: [
      { key: 'title', type: 'string', builtin: true, label: '标题' },
      { key: 'department', type: 'string' },
      { key: 'version', type: 'string' },
      { key: 'reviewDate', type: 'time' },
      { key: 'scoreWeight', type: 'number' },
    ],
    values: { title: '供应商准入手册', department: '采购部', version: 'v3.2', reviewDate: '2026-08-12', scoreWeight: 15 },
  });
  box.addEventListener('icen:kb-metadata-change', function (e) {
    log('icen:kb-metadata-change · action=' + e.detail.action + ' key=' + e.detail.key);
  });
}`,
  },
  {
    slug: 'kb-qa',
    name: 'QA 对',
    group: '知识库',
    desc: '认证问答对编辑器 .kb-qa（数据域「可信资产」的最小单元）：Q / A 两列表格，单元格 contenteditable 行内编辑（focusout 且内容变化才提交）；新增本地追加空行并聚焦问题格；删除先派事件再删行、后续行序号顺位重排（事件索引稳定）；CSV 模板导入入口（question,answer 每行一对，UTF-8）。事件 icen:kb-qa-change { op: add | edit | remove, index } 与 icen:kb-qa-import { source }。',
    demo: `<p class="demo-label" style="margin:0 0 8px">单元格直接改写（失焦提交）/「+ 新增」追加空行并聚焦 / 删除（序号顺位重排）/「导入 CSV」派导入事件</p>
<div id="demo-kb-qa"></div>
<p class="demo-label" id="demo-kb-qa-log" style="margin-top:8px">事件日志：等待交互</p>`,
    usage: `import { renderKbQa, initKbQa } from '@icen.ai/ui/kit/kb-qa';
initKbQa();   // 行内编辑 / 增删行 / 导入 委托（root 缺省 document，幂等 + 销毁函数）

renderKbQa(el, [
  { question: '差旅住宿标准是多少？', answer: '一线城市每晚 600 元，其他城市 450 元（财务部 2026-08 终版）。' },
  { question: '供应商准入的淘汰线是多少分？', answer: '60 分；低于 60 分不予通过，结果公示 3 个工作日。' },
], { importSource: 'csv' });   // 导入事件 detail.source 可覆盖（缺省 'csv'）
// 事件：icen:kb-qa-change { op: 'add' | 'edit' | 'remove', index }
//      icen:kb-qa-import { source }（宿主弹文件选择，按模板解析后重渲染）`,
    behaviors: ['kb-qa'],
    behaviorInit: { 'kb-qa': 'initKbQa' },
    script: `const box = document.getElementById('demo-kb-qa');
const logEl = document.getElementById('demo-kb-qa-log');
function log(msg) { if (logEl) logEl.textContent = '事件日志：' + msg; }
const ROWS = [
  { question: '差旅住宿标准是多少？', answer: '一线城市每晚 600 元，其他城市 450 元（财务部 2026-08 终版）。' },
  { question: '供应商准入的淘汰线是多少分？', answer: '60 分；低于 60 分不予通过，结果在准入系统公示 3 个工作日。' },
  { question: '工单首次响应时限是多久？', answer: 'P1 级 2 小时，P2 级 8 小时（以官方数据字典 SLA 字段口径为准）。' },
];
if (box && kbQaMod) {
  kbQaMod.renderKbQa(box, ROWS);
  box.addEventListener('icen:kb-qa-change', function (e) {
    log('icen:kb-qa-change · op=' + e.detail.op + ' index=' + e.detail.index);
  });
  box.addEventListener('icen:kb-qa-import', function (e) {
    log('icen:kb-qa-import · source=' + e.detail.source + '（宿主弹文件选择，按模板解析后重渲染）');
  });
}`,
  },
];
