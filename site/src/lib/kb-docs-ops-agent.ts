/* 知识库族组件文档 —— 治理域（ops）+ 工作台域（agent）+ AI 族扩展 + 图谱 分片。 */
import type { ComponentDoc } from './components';

/**
 * 本分片覆盖 docs/spec/kb-family.md §5.19–5.28：kb-trace / kb-review / kb-gap / kb-eval（治理域）、
 * kb-canvas / kb-checkpoint / kb-sandbox / kb-chain（工作台域）、ai-threads / ai-feedback / ai-branch
 * （AI 族扩展）与 chart-graph / chart-map（图谱，charts.ts 追加的 renderGraph / renderMap）。
 * script 为纯 JS（new Function 执行，禁 TS / 嵌套反引号），形参为各 behavior 模块的
 * camelCase + 'Mod'（kbTraceMod / kbCanvasMod / aiDiffMod / chartsMod …），判空调用。
 */
export const KB_DOCS_OPS_AGENT: ComponentDoc[] = [
  /* ══════════ 治理域（ops） ══════════ */
  {
    slug: 'kb-trace',
    name: '调用链追踪',
    group: '知识库',
    desc: 'RAG/LLM 调用链 span 树：query → 检索（展开体内嵌命中列表与分数条）→ 重排 → 生成的嵌套耗时条（宽度按同级最大耗时占比），error / running 分支默认展开，展开体自动渲染 detail、usage（↑↓ tok / $ 成本）与错误原因。initKbTrace 为 document 级委托（click 选中+折叠 / Enter / Space），动态插入免重跑；事件 icen:kb-trace-select / icen:kb-trace-toggle。数据经 kb-core normalizeSpans 归一（父先子后、孤儿容忍为顶层）。',
    demo: `<div id="kb-trace-demo"></div>
<p class="demo-label" id="kb-trace-log" style="margin-top:8px">点击行选中并折叠子 span · error 分支默认展开 · 展开「检索」span 看内嵌命中与分数条（无分命中显示「—」）</p>`,
    usage: `import { renderKbTrace, initKbTrace } from '@icen.ai/ui/kit/kb-trace';

initKbTrace();   // document 级委托（click / Enter / Space），幂等 + 返回销毁函数

renderKbTrace(el, [
  { id: 'q1', kind: 'query', name: '差旅报销上限是多少？', status: 'done', elapsedMs: 2380 },
  { id: 'r1', parentId: 'q1', kind: 'retrieval', name: 'hybrid search', status: 'done', elapsedMs: 340,
    hits: [{ chunkId: 'c-412', snippet: '单笔 5000 元以上需审批', score: 0.87, scoreKind: 'hybrid' }] },
  { id: 'rr1', parentId: 'r1', kind: 'rerank', name: 'bge-reranker', status: 'done', elapsedMs: 180 },
  { id: 'g1', parentId: 'q1', kind: 'generation', name: 'glm-4.6', status: 'done', elapsedMs: 1520,
    usage: { inputTokens: 1240, outputTokens: 380, costUsd: 0.0021 } },
  { id: 't1', parentId: 'q1', kind: 'tool', name: '联网检索兜底', status: 'error',
    error: '上游 502（已跳过，不影响主链路）' },
]);
// 展开体按需渲染 detail / usage / hits / error；kind 枚举见 kb-core（检索/生成/重排/向量化/工具/护栏…）
el.addEventListener('icen:kb-trace-toggle', (e) => console.log(e.detail.spanId, e.detail.open));`,
    behaviors: ['kb-trace'],
    behaviorInit: { 'kb-trace': 'initKbTrace' },
    script: `const host = document.getElementById('kb-trace-demo');
const log = document.getElementById('kb-trace-log');
if (host && kbTraceMod) {
  kbTraceMod.renderKbTrace(host, [
    { id: 'q1', kind: 'query', name: '差旅报销上限是多少？', status: 'done', elapsedMs: 2380, detail: '会话 #8841 · 用户提问' },
    { id: 'r1', parentId: 'q1', kind: 'retrieval', name: 'hybrid search', status: 'done', elapsedMs: 340,
      detail: '向量 0.6 + BM25 0.4 · topK 8 · 阈值后存活 3',
      hits: [
        { chunkId: 'c-412', title: '差旅报销管理办法（2026 修订）', snippet: '单笔 5000 元以上需部门主管审批', score: 0.87, scoreKind: 'hybrid' },
        { chunkId: 'c-388', title: '财务共享中心 FAQ', snippet: '打车票需附行程单方可提交', score: 0.71, scoreKind: 'hybrid' },
        { chunkId: 'c-207', title: '报销系统操作手册', snippet: '提交路径：费用 → 报销单 → 附件', score: null, scoreKind: 'bm25' }
      ] },
    { id: 'rr1', parentId: 'r1', kind: 'rerank', name: 'bge-reranker-v2', status: 'done', elapsedMs: 180, detail: '8 → 3 条 · 阈值 0.35' },
    { id: 'g1', parentId: 'q1', kind: 'generation', name: 'glm-4.6', status: 'done', elapsedMs: 1520,
      usage: { inputTokens: 1240, outputTokens: 380, costUsd: 0.0021 } },
    { id: 't1', parentId: 'q1', kind: 'tool', name: '联网检索兜底', status: 'error', elapsedMs: 62,
      detail: '知识库低分时自动触发',
      error: '上游 502：connector/web-search 不可达（已跳过，不影响主链路）' }
  ]);
  host.addEventListener('icen:kb-trace-select', function (e) {
    if (log) log.textContent = 'icen:kb-trace-select · ' + e.detail.spanId;
  });
  host.addEventListener('icen:kb-trace-toggle', function (e) {
    if (log) log.textContent = 'icen:kb-trace-toggle · ' + e.detail.spanId + (e.detail.open ? ' 展开' : ' 折叠');
  });
}`,
  },
  {
    slug: 'kb-review',
    name: '标注队列',
    group: '知识库',
    desc: '人工标注 / 审查队列：左侧队列（分配人过滤 + 状态点）+ 右侧审查卡（rubric 行——categorical chips（前 9 项带数字角标）与 numeric 0–10 滑杆）。全键盘流内建：←/→ 切条目、1–9 选选项、⌘/Ctrl+Enter 完成并下一条、? 显隐快捷键浮层。createKbReview 返回 { current, next, prev, submit, destroy } 句柄；打分 / 提交 / 分配走事件（icen:kb-review-score / -submit / -assign）与 onAction 回调双通道。',
    demo: `<div id="kb-review-demo"></div>
<p class="demo-label" id="kb-review-log" style="margin-top:8px">全键盘流（先点进右侧审查卡）：← → 切条目 · 1–9 选选项 · ⌘/Ctrl+↵ 完成并下一条 · ? 快捷键 · Esc 关闭 · 左上可按分配人过滤</p>`,
    usage: `import { createKbReview } from '@icen.ai/ui/kit/kb-review';

const review = createKbReview(el, {
  queue: [
    { id: 'rv-1', target: { kind: 'answer', id: 'a-8841', label: '生育津贴流程回答' }, status: 'open', assignee: '李瑶' },
  ],
  configs: [
    { name: '相关性', type: 'categorical', categories: ['相关', '部分相关', '不相关'] },
    { name: '忠实度', type: 'categorical', categories: ['忠实', '有臆造', '无法判断'] },
    { name: '可用性', type: 'numeric' },        // 0–10 滑杆（step 0.5）
  ],
  assignees: ['李瑶', '周明'],                  // 提供时审查卡带分配下拉（可省）
  onAction: (a) => console.log(a.type, a.taskId, a.name, a.value),
});
// 全键盘流内建在审查卡上（无需宿主接线）：←/→ 切条目 · 1–9 选 categorical · ⌘/Ctrl+Enter 完成 · ? 快捷键
review.next(); review.prev(); review.submit(); review.destroy();
// 事件双通道：icen:kb-review-score {taskId, name, value} / -submit {taskId} / -assign {taskId, assignee}`,
    behaviors: ['kb-review'],
    script: `const host = document.getElementById('kb-review-demo');
const log = document.getElementById('kb-review-log');
if (host && kbReviewMod) {
  kbReviewMod.createKbReview(host, {
    queue: [
      { id: 'rv-1', target: { kind: 'answer', id: 'a-8841', label: '生育津贴申请流程回答' }, status: 'open', assignee: '李瑶' },
      { id: 'rv-2', target: { kind: 'trace', id: 't-2207', label: '差旅报销 · 调用链' }, status: 'open', assignee: '周明' },
      { id: 'rv-3', target: { kind: 'message', id: 'm-9930', label: '供应商准入答复（轮次 4）' }, status: 'open' }
    ],
    configs: [
      { name: '相关性', type: 'categorical', categories: ['相关', '部分相关', '不相关'], description: '回答与问题的对应程度' },
      { name: '忠实度', type: 'categorical', categories: ['忠实', '有臆造', '无法判断'], description: '是否忠于引用来源原文' },
      { name: '可用性', type: 'numeric', description: '可直接采用的程度（0–10）' }
    ],
    assignees: ['李瑶', '周明', '陈珂'],
    onAction: function (a) {
      if (!log) return;
      const tail = a.name ? ' · ' + a.name + ' = ' + a.value : (a.type === 'assign' && a.value ? ' · 分配给 ' + a.value : '');
      log.textContent = 'icen:kb-review-' + a.type + ' · ' + a.taskId + tail;
    }
  });
}`,
  },
  {
    slug: 'kb-gap',
    name: '无答案分析',
    group: '知识库',
    desc: '无答案 / 未命中查询分析：顶部 12 根自绘趋势柱（纯 div/i，不依赖 charts）+ 零结果 Top 表（次数 / 占比 / 零点击率 / 最近出现 / 行内行动钮「建文档」「加同义词」）。口径纪律内建：「零点击 ≠ 失败」以表头小字 + tooltip 声明，不染告警色；queries 为空渲染空态「没有未命中查询——覆盖良好」。initKbGap 为 document 级 click 委托 → icen:kb-gap-action { query, action }。',
    demo: `<div id="kb-gap-demo"></div>
<p class="demo-label" id="kb-gap-log" style="margin-top:8px">行内「建文档 / 加同义词」→ icen:kb-gap-action · 悬停表头「零点击 ≠ 失败」看口径注释 · 悬停趋势柱看日期与次数</p>`,
    usage: `import { renderKbGap, initKbGap } from '@icen.ai/ui/kit/kb-gap';

initKbGap();   // document 级 click 委托（幂等 + 销毁函数），动态插入免重跑
renderKbGap(el, {
  queries: [
    { text: '生育津贴怎么申请', count: 34, shareOfAllQueries: 0.021, zeroClickRate: 0.412,
      lastSeenAt: new Date(Date.now() - 3 * 864e5).toISOString() },
  ],
  trend: [{ label: '10-01', value: 34 }],   // 自绘柱，取末 12 根；缺省不渲染趋势区
});
// queries 为空 → 空态「没有未命中查询——覆盖良好」（覆盖良好是一等状态，无死路）
el.addEventListener('icen:kb-gap-action', (e) => {
  // e.detail = { query, action: 'create-doc' | 'add-synonym' }
});`,
    behaviors: ['kb-gap'],
    behaviorInit: { 'kb-gap': 'initKbGap' },
    script: `const host = document.getElementById('kb-gap-demo');
const log = document.getElementById('kb-gap-log');
if (host && kbGapMod) {
  const trend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    trend.push({
      label: String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
      value: 16 + Math.round(Math.abs(Math.sin((11 - i) * 0.83)) * 18)
    });
  }
  const ago = function (ms) { return new Date(Date.now() - ms).toISOString(); };
  kbGapMod.renderKbGap(host, {
    trend: trend,
    queries: [
      { text: '生育津贴怎么申请', count: 34, shareOfAllQueries: 0.021, zeroClickRate: 0.412, lastSeenAt: ago(3 * 86400000) },
      { text: '异地社保转移怎么办', count: 27, shareOfAllQueries: 0.017, zeroClickRate: 0.63, lastSeenAt: ago(86400000) },
      { text: '试用期有几天年假', count: 19, shareOfAllQueries: 0.012, zeroClickRate: 0.21, lastSeenAt: ago(6 * 3600000) },
      { text: '电脑补贴标准是多少', count: 12, shareOfAllQueries: 0.008, zeroClickRate: 0.58, lastSeenAt: ago(2 * 86400000) }
    ]
  });
  host.addEventListener('icen:kb-gap-action', function (e) {
    if (log) log.textContent = 'icen:kb-gap-action · ' + (e.detail.action === 'create-doc' ? '建文档' : '加同义词') + '：「' + e.detail.query + '」';
  });
}`,
  },
  {
    slug: 'kb-eval',
    name: '评估对比',
    group: '知识库',
    desc: '评估 run 对比表（Braintrust 心智）：头部 runA/runB 下拉切换 → icen:kb-eval-compare，Summary 行自动判级徽章（提升 / 回归 / 权衡 / 持平，kb-core evalGrade）+ 全行均分与百分点差；结果表每指标 A / B / Δ 三列（正绿负负红、null 显「—」），行点击展开双栏字符级 diff（A 独有红 / B 独有绿，零依赖自写简版）；存在回归行时自动出现「仅看回归」过滤钮。',
    demo: `<div id="kb-eval-demo"></div>
<p class="demo-label" id="kb-eval-log" style="margin-top:8px">点行展开双栏字符级 diff · Q-03 是回归行（v4 忠实度掉到 0.4）→「仅看回归」过滤钮自动出现 · 切头部下拉派发 icen:kb-eval-compare</p>`,
    usage: `import { renderKbEvalCompare } from '@icen.ai/ui/kit/kb-eval';

renderKbEvalCompare(el, {
  runs: [{ id: 'v3', label: '提示词 v3' }, { id: 'v4', label: '提示词 v4' }],
  metrics: ['相关性', '忠实度'],          // 缺省从 scoresA/scoresB 键序并集推导
  rows: [{
    key: 'Q-01', input: '差旅报销上限是多少？',
    outputA: '报销上限 5000 元。', outputB: '国内差旅单笔上限 5000 元，超标需事前审批。',
    expected: '单笔 5000 元',
    scoresA: { '相关性': 0.8, '忠实度': 0.75 }, scoresB: { '相关性': 0.9, '忠实度': 0.85 },
  }],
});
// Summary 判级走 kb-core evalGrade（分数提升但成本/时延恶化 → tradeoff）；
// 行点击展开双栏 diff + 期望；回归行存在时出现「仅看回归」过滤钮
el.addEventListener('icen:kb-eval-compare', (e) => refetch(e.detail.runA, e.detail.runB));`,
    behaviors: ['kb-eval'],
    script: `const host = document.getElementById('kb-eval-demo');
const log = document.getElementById('kb-eval-log');
if (host && kbEvalMod) {
  kbEvalMod.renderKbEvalCompare(host, {
    runs: [{ id: 'v3', label: '提示词 v3' }, { id: 'v4', label: '提示词 v4' }],
    metrics: ['相关性', '忠实度'],
    rows: [
      { key: 'Q-01', input: '差旅报销上限是多少？',
        outputA: '报销上限为 5000 元，超标需提前审批。', outputB: '国内差旅单笔报销上限 5000 元，超标需部门主管在 OA 事前审批并附说明。',
        expected: '单笔 5000 元；超标需事前审批',
        scoresA: { '相关性': 0.8, '忠实度': 0.75 }, scoresB: { '相关性': 0.9, '忠实度': 0.85 } },
      { key: 'Q-02', input: '供应商准入要几个工作日？',
        outputA: '5 个工作日。', outputB: '自材料齐全起 5 个工作日完成准入。', expected: '5 个工作日',
        scoresA: { '相关性': 0.9, '忠实度': 0.9 }, scoresB: { '相关性': 0.9, '忠实度': 0.9 } },
      { key: 'Q-03', input: '社保断缴影响公积金贷款吗？',
        outputA: '断缴满 3 个月影响贷款额度，需补缴后恢复。', outputB: '断缴会导致公积金贷款受阻，建议尽快处理以免影响买房。',
        expected: '连续缴存 6 个月方可申请；断缴重新计算缴存月',
        scoresA: { '相关性': 0.7, '忠实度': 0.65 }, scoresB: { '相关性': 0.6, '忠实度': 0.4 } },
      { key: 'Q-04', input: '年会当天请假怎么走流程？',
        outputA: '找行政登记即可。', outputB: '在 OA 提交「年会请假」流程并抄送直属主管，当天免审批。',
        expected: 'OA 流程 + 抄送主管',
        scoresA: { '相关性': 0.6, '忠实度': 0.5 }, scoresB: { '相关性': 0.95, '忠实度': 0.9 } }
    ]
  });
  host.addEventListener('icen:kb-eval-compare', function (e) {
    if (log) log.textContent = 'icen:kb-eval-compare · ' + e.detail.runA + ' vs ' + e.detail.runB + '（消费方重取 rows 后重渲）';
  });
}`,
  },
  /* ══════════ 工作台域（agent） ══════════ */
  {
    slug: 'kb-canvas',
    name: '双栏工作台',
    group: '知识库',
    desc: 'Agent 双栏工作台画布：左对话流 / 右文档（各自滚动容器，宿主内容经 setChat / setDoc 挂入）+ 6px 比例分隔条（pointer 拖拽 rAF 批处理、←/→ 微调、双击复位 0.42，自实现不依赖 split-pane）+ 右栏内联 diff（复用 ai-diff，addDiff 接 parseUnifiedDiff 产物）+ 底部版本时间轴（addVersion，current 抢占高亮）+ 划词 AI 工具条（setSelectionTools 注入，选中文本浮「改写 / 补引用 / 总结」→ icen:kb-canvas-ai {instruction, selection}）。',
    demo: `<div id="kb-canvas-demo"></div>
<p class="demo-label" id="kb-canvas-log" style="margin-top:8px">拖中间分隔条调比例（双击复位）· 右栏划选文本浮 AI 工具条 · 底部版本轴点击切换 · 右侧 diff 卡可展开并接受 / 拒绝</p>`,
    usage: `import { createKbCanvas } from '@icen.ai/ui/kit/kb-canvas';
import { parseUnifiedDiff } from '@icen.ai/ui/kit/ai-diff';

const canvas = createKbCanvas(el, {
  minRatio: 0.2,                                // 左栏最小占比（同时约束右栏）
  onAI: (d) => runInstruction(d.instruction, d.selection),     // 与 icen:kb-canvas-ai 事件双通道
  onVersion: (d) => checkout(d.versionId),                     // 与 icen:kb-canvas-version 双通道
});
canvas.setChat(chatNode);                        // 左栏对话流（Node 或纯文本）
canvas.setDoc(docNode);                          // 右栏文档
canvas.addDiff(parseUnifiedDiff(diffText));      // 右栏追加 ai-diff 渲染的内联 diff
canvas.addVersion({ id: 'v3', label: '批量改写', at: Date.now(), current: true });
canvas.setSelectionTools([                       // 划词工具条（空数组 = 关闭）
  { label: '改写', instruction: '改写选中文本，保持口径一致' },
  { label: '补引用', instruction: '为选中文本补充引用来源' },
  { label: '总结', instruction: '将选中文本总结为三点' },
]);
canvas.destroy();
// 分隔条：拖拽 rAF 批处理 · ←/→ ±0.02 · Home/End 极值 · 双击复位 0.42（split-pane 心智）`,
    behaviors: ['kb-canvas', 'ai-diff'],
    behaviorInit: { 'ai-diff': 'initAiDiff' },
    script: `const host = document.getElementById('kb-canvas-demo');
const log = document.getElementById('kb-canvas-log');
const tlog = function (msg) { if (log) log.textContent = msg; };
if (host && kbCanvasMod && aiDiffMod) {
  const canvas = kbCanvasMod.createKbCanvas(host, {
    onAI: function (d) {
      tlog('icen:kb-canvas-ai · ' + d.instruction + (d.selection ? ' · 选区「' + d.selection.text.slice(0, 12) + '…」' : ''));
    },
    onVersion: function (d) { tlog('icen:kb-canvas-version · ' + d.versionId + '（宿主按版本回滚内容）'); }
  });
  /* 左栏：mock 对话流（Node 经 appendChild 挂入，宿主保留所有权） */
  const chat = document.createDocumentFragment();
  const msg = function (role, text) {
    const p = document.createElement('p');
    p.style.cssText = 'margin:0 0 10px;font-size:12.5px;line-height:1.7';
    p.style.color = role === 'user' ? 'var(--token-text-muted)' : 'var(--token-text)';
    p.textContent = (role === 'user' ? '我：' : '助理：') + text;
    return p;
  };
  chat.append(
    msg('user', '把《差旅报销管理办法》的审批口径改准确一点，再补一条行程单要求。'),
    msg('ai', '好的，已检索 3 个来源并完成改写（见右侧 diff），引用核对均通过。')
  );
  canvas.setChat(chat);
  /* 右栏：文档原文 */
  const doc = document.createElement('div');
  doc.style.cssText = 'font-size:12.5px;line-height:1.9;color:var(--token-text)';
  doc.textContent = '第二条 单笔报销限额为 5000 元。第三条 发票抬头须为公司全称。';
  canvas.setDoc(doc);
  /* 右栏追加内联 diff：ai-diff 复用（宿主传入 parseUnifiedDiff 产物） */
  canvas.addDiff(aiDiffMod.parseUnifiedDiff([
    '--- a/知识库/差旅报销管理办法.md',
    '+++ b/知识库/差旅报销管理办法.md',
    '@@ -2,4 +2,5 @@',
    ' 第二条 单笔报销限额为 5000 元。',
    '-超标需提前邮件审批。',
    '+单笔 5000 元以上需部门主管在 OA 事前审批。',
    '+差旅报销需附行程单。',
    ' 第三条 发票抬头须为公司全称。'
  ].join('\\n')));
  /* 底部版本时间轴：current=true 抢占高亮 */
  canvas.addVersion({ id: 'v1', label: 'v1 · 初稿导入', at: Date.now() - 40 * 60000 });
  canvas.addVersion({ id: 'v2', label: 'v2 · 补引用', at: Date.now() - 22 * 60000 });
  canvas.addVersion({ id: 'v3', label: 'v3 · 批量改写', at: Date.now() - 6 * 60000, current: true });
  /* 划词工具条：选中右栏文本 → 浮「改写 / 补引用 / 总结」 */
  canvas.setSelectionTools([
    { label: '改写', instruction: '改写选中文本，保持口径一致' },
    { label: '补引用', instruction: '为选中文本补充引用来源' },
    { label: '总结', instruction: '将选中文本总结为三点' }
  ]);
}`,
  },
  {
    slug: 'kb-checkpoint',
    name: '检查点',
    group: '知识库',
    desc: 'Agent 检查点时间轴：时钟 icon + 相对时间 + label / reason 的时间轴按钮；initKbCheckpoint 点击弹出恢复菜单（挂 body、fixed 定位、视口夹取），scope 三选默认预选「仅内容（保留对话）」——Cursor 语义，回滚产物、保留讨论过程，审计友好。scopeOptions 未提供的恢复范围禁用；Esc / 外点 / 滚动关闭；选择 → icen:kb-checkpoint-restore { checkpointId, scope }。',
    demo: `<div id="kb-checkpoint-demo"></div>
<p class="demo-label" id="kb-checkpoint-log" style="margin-top:8px">点击检查点弹恢复菜单（默认预选「仅内容 · 保留对话」）·「补引用后」scopeOptions 受限：仅 content 可选，其余两项禁用</p>`,
    usage: `import { renderKbCheckpoints, initKbCheckpoint } from '@icen.ai/ui/kit/kb-checkpoint';

initKbCheckpoint();   // 委托点击弹恢复菜单（幂等 + 销毁函数）
renderKbCheckpoints(el, [
  { id: 'cp-3', label: '批量改写前', reason: '每页重切前自动保存', at: Date.now() - 14 * 60000 },
  { id: 'cp-2', label: '补引用后', at: Date.now() - 52 * 60000, scopeOptions: ['content'] },
  // scopeOptions 缺省 = 内容 / 对话 / 两者三项全开；提供则未列项禁用（该检查点未包含此范围）
]);
// 恢复菜单默认预选「仅内容（保留对话）」：回滚产物、保留讨论（审计与复盘友好）
el.addEventListener('icen:kb-checkpoint-restore', (e) => restore(e.detail.checkpointId, e.detail.scope));`,
    behaviors: ['kb-checkpoint'],
    behaviorInit: { 'kb-checkpoint': 'initKbCheckpoint' },
    script: `const host = document.getElementById('kb-checkpoint-demo');
const log = document.getElementById('kb-checkpoint-log');
if (host && kbCheckpointMod) {
  kbCheckpointMod.renderKbCheckpoints(host, [
    { id: 'cp-3', label: '批量改写前', reason: '每页重切前自动保存', at: Date.now() - 14 * 60000 },
    { id: 'cp-2', label: '补引用后', at: Date.now() - 52 * 60000, scopeOptions: ['content'] },
    { id: 'cp-1', label: '初稿导入', at: Date.now() - 3 * 3600000 }
  ]);
  host.addEventListener('icen:kb-checkpoint-restore', function (e) {
    if (log) log.textContent = 'icen:kb-checkpoint-restore · ' + e.detail.checkpointId + ' · scope=' + e.detail.scope;
  });
}`,
  },
  {
    slug: 'kb-sandbox',
    name: '沙箱工具容器',
    group: '知识库',
    desc: 'MCP App 沙箱工具容器（MCP Apps 对齐）：iframe sandbox="allow-scripts"（绝不加 allow-same-origin）+ postMessage JSON-RPC 2.0 双向桥。load 三种来源（ui:// 声明式资源走 opts.resolve / html 片段 srcdoc / URL），idle / loading / ready / error 四态由 data-state 纯 CSS 驱动；call(name, args) 返回 Promise（默认 8s 超时，重载 / 销毁一律 reject pending）；全部出入站信封经 icen:kb-sandbox-message + onMessage 双通道可观测，子帧 app.ready 通知即就绪。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <button class="btn btn-sm btn-primary" type="button" id="kb-sandbox-load">load('ui://demo/echo')</button>
  <button class="btn btn-sm" type="button" id="kb-sandbox-call">call('echo', { text, n })</button>
</div>
<div id="kb-sandbox-demo"></div>
<p class="demo-label" id="kb-sandbox-log" style="margin-top:8px">先 load 等 app.ready 转 ready，再 call：子应用把参数原样回传 · 入站双闸（只信自家帧 + 可选 origin 白名单）</p>`,
    usage: `import { createKbSandbox } from '@icen.ai/ui/kit/kb-sandbox';

const sb = createKbSandbox(el, {
  timeoutMs: 8000,                          // 单次 call 超时（默认 8000）
  resolve: (uri) => (uri === 'ui://demo/echo' ? ECHO_APP_HTML : null),  // ui:// 声明式资源（可异步）
  onMessage: (m) => audit(m.channel, m.payload),   // 与 icen:kb-sandbox-message 事件双通道
});
sb.load('ui://demo/echo');                  // 也接受 html 片段 / http(s) URL
sb.call('app.callServerTool', { id: 42 }).then((result) => apply(result));
sb.destroy();

// 子帧内最小 bootstrap（放进沙箱 html；闭合标签请拆开写 '<\\/script>' 防宿主脚本被截断）：
// <script>
//   window.addEventListener('message', (e) => {
//     const m = e.data;
//     if (!m || m.jsonrpc !== '2.0' || m.method == null) return;
//     e.source.postMessage({ jsonrpc: '2.0', id: m.id, result: { ok: true } }, '*');
//   });
//   parent.postMessage({ jsonrpc: '2.0', method: 'app.ready' }, '*');
// <\\/script>`,
    behaviors: ['kb-sandbox'],
    script: `const host = document.getElementById('kb-sandbox-demo');
const log = document.getElementById('kb-sandbox-log');
const tlog = function (msg) { if (log) log.textContent = msg; };
if (host && kbSandboxMod) {
  /* 极简 MCP 子应用：app.ready 通知 + 响应 echo 工具调用把参数回传（单引号拼接，闭合标签拆开写） */
  const APP_HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">'
    + '<div style="font:12px/1.7 -apple-system,Segoe UI,sans-serif;color:#999;padding:10px">echo 工具已就绪 · 沙箱帧内运行（allow-scripts，无 same-origin）</div>'
    + '<script>'
    + 'window.addEventListener("message", function (e) {'
    + '  var m = e.data;'
    + '  if (!m || m.jsonrpc !== "2.0" || m.id == null || m.method !== "echo") return;'
    + '  e.source.postMessage({ jsonrpc: "2.0", id: m.id, result: { echo: m.params, at: Date.now() } }, "*");'
    + '});'
    + 'parent.postMessage({ jsonrpc: "2.0", method: "app.ready" }, "*");'
    + '<\\/script></body></html>';

  const sb = kbSandboxMod.createKbSandbox(host, {
    resolve: function (uri) { return uri === 'ui://demo/echo' ? APP_HTML : null; },
    onMessage: function (m) {
      if (m.channel === 'in' && m.payload && m.payload.method === 'app.ready') tlog('app.ready → 沙箱就绪（data-state=ready）');
    }
  });
  document.getElementById('kb-sandbox-load')?.addEventListener('click', function () {
    sb.load('ui://demo/echo');
    tlog('load(ui://demo/echo) → loading，等子帧 app.ready 转 ready');
  });
  document.getElementById('kb-sandbox-call')?.addEventListener('click', function () {
    sb.call('echo', { text: '报销上限', n: 5000 }).then(
      function (r) { tlog('call("echo", {...}) 成功 → ' + JSON.stringify(r)); },
      function (err) { tlog('call("echo") 失败 → ' + err.message + '（先点左侧 load 让应用就绪）'); }
    );
  });
}`,
  },
  {
    slug: 'kb-chain',
    name: '工具链条',
    group: '知识库',
    desc: 'Agent 工具链条横向摘要条（与 ai-tool-call 单卡互补的「一屏看完整个链」视角）：检索 → 重排 → 生成 → 引用核对等步骤，四态状态点（pending 空心 / running accent 脉冲 / done 实心绿 / error 实心红，运动感来自动效不来自颜色）。幂等重渲：同一 el 重复调用只原位更新状态类 / label / title / 可点性，不重建 DOM（流式安全无闪烁）；running（或 error）及之前的步骤可点击 → icen:kb-chain-step { index, step }。',
    demo: `<div id="kb-chain-demo"></div>
<p class="demo-label" id="kb-chain-log" style="margin-top:8px">2.6s 后生成完成、引用核对转 running（幂等重渲不重建 DOM）· 点击已到达步骤派发 icen:kb-chain-step · 未到达步骤置灰不可点</p>`,
    usage: `import { renderKbChain, initKbChain } from '@icen.ai/ui/kit/kb-chain';

initKbChain();   // 委托点击 + Enter/Space（幂等 + 销毁函数）
renderKbChain(el, [
  { key: 'retrieve', label: '检索', status: 'done', detail: '3 页 / 2 表 · topK 8' },
  { key: 'generate', label: '生成', status: 'running', detail: '流式输出中' },
  { key: 'verify', label: '引用核对', status: 'pending' },
]);
// 流式推进：重复调用只更新状态类与 detail（WeakMap 同步步骤数据），长度变化才增删节点
el.addEventListener('icen:kb-chain-step', (e) => jumpTo(e.detail.step.key));`,
    behaviors: ['kb-chain'],
    behaviorInit: { 'kb-chain': 'initKbChain' },
    script: `const host = document.getElementById('kb-chain-demo');
const log = document.getElementById('kb-chain-log');
if (host && kbChainMod) {
  kbChainMod.renderKbChain(host, [
    { key: 'retrieve', label: '检索', status: 'done', detail: '3 页 / 2 表 · topK 8' },
    { key: 'rerank', label: '重排', status: 'done', detail: '8 → 3 · bge-reranker' },
    { key: 'generate', label: '生成', status: 'running', detail: '流式输出中 · 已 380 tok' },
    { key: 'verify', label: '引用核对', status: 'pending', detail: '逐条比对引用与来源' }
  ]);
  /* 幂等重渲：只原位更新状态/标题，不重建 DOM（保住 CSS 过渡与焦点） */
  setTimeout(function () {
    kbChainMod.renderKbChain(host, [
      { key: 'retrieve', label: '检索', status: 'done', detail: '3 页 / 2 表 · topK 8' },
      { key: 'rerank', label: '重排', status: 'done', detail: '8 → 3 · bge-reranker' },
      { key: 'generate', label: '生成', status: 'done', detail: '512 tok · 1.5s' },
      { key: 'verify', label: '引用核对', status: 'running', detail: '3 条引用比对中' }
    ]);
  }, 2600);
  host.addEventListener('icen:kb-chain-step', function (e) {
    if (log) log.textContent = 'icen:kb-chain-step · #' + e.detail.index + ' ' + e.detail.step.label;
  });
}`,
  },
  /* ══════════ AI 族扩展 ══════════ */
  {
    slug: 'ai-threads',
    name: '会话列表',
    group: 'AI 原生',
    desc: 'AI 会话列表：分组模式（今天 / 昨天 / 更早，组头可折叠；archived 项沉底收进「已归档」组并降透明）或平铺模式，activeKey 高亮当前会话（aria-current），每项带「···」动作钮（只做事件挂载点，菜单本体由宿主实现）。initAiThreads 委托选择 / 动作 / 组头折叠；setAiThreadsActive 供外部路由同步激活态，对静态手写 DOM 一视同仁。事件 icen:ai-thread-select { key } / icen:ai-thread-action { action, key }。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <button class="btn btn-sm" type="button" id="ai-threads-route">模拟外部路由切换激活态</button>
</div>
<div id="ai-threads-demo" style="max-width:340px"></div>
<p class="demo-label" id="ai-threads-log" style="margin-top:8px">今天 / 昨天 / 更早分组（组头可折叠）· 已归档沉底降透明 · 点 ··· 派发动作事件（菜单宿主实现）</p>`,
    usage: `import { renderAiThreads, initAiThreads, setAiThreadsActive } from '@icen.ai/ui/kit/ai-threads';

initAiThreads();   // 委托：选择 / 动作挂载点 / 组头折叠（幂等 + 销毁函数）
renderAiThreads(el, {
  groups: true,                  // 分组模式（组头可折叠）；缺省/false 平铺
  activeKey: 't-2',
  items: [
    { key: 't-1', label: '差旅报销口径核对', group: '今天' },
    { key: 't-6', label: '2026 招聘 JD 草稿', group: '更早', archived: true },   // 归档沉底
  ],
});
setAiThreadsActive(el, 't-4');   // 外部路由同步激活态（key 空串清空全部激活）
el.addEventListener('icen:ai-thread-select', (e) => route(e.detail.key));
el.addEventListener('icen:ai-thread-action', (e) => openMenu(e.detail.key));     // 菜单本体宿主实现`,
    behaviors: ['ai-threads'],
    behaviorInit: { 'ai-threads': 'initAiThreads' },
    script: `const host = document.getElementById('ai-threads-demo');
const log = document.getElementById('ai-threads-log');
const tlog = function (msg) { if (log) log.textContent = msg; };
if (host && aiThreadsMod) {
  const KEYS = ['t-2', 't-4', 't-1'];
  let turn = 0;
  aiThreadsMod.renderAiThreads(host, {
    groups: true,
    activeKey: 't-2',
    items: [
      { key: 't-1', label: '差旅报销上限口径核对', group: '今天' },
      { key: 't-2', label: '供应商准入流程梳理', group: '今天' },
      { key: 't-3', label: '社保断缴影响评估', group: '昨天' },
      { key: 't-4', label: '年会场地合同要点', group: '昨天' },
      { key: 't-5', label: '新版员工手册问答初版', group: '更早' },
      { key: 't-6', label: '2026 招聘 JD 草稿', group: '更早', archived: true }
    ]
  });
  host.addEventListener('icen:ai-thread-select', function (e) {
    tlog('icen:ai-thread-select · ' + e.detail.key + '（宿主按 key 路由 + 同步激活态）');
    aiThreadsMod.setAiThreadsActive(host, e.detail.key);
  });
  host.addEventListener('icen:ai-thread-action', function (e) {
    tlog('icen:ai-thread-action · ' + e.detail.action + ' ' + e.detail.key + '（菜单本体由宿主实现）');
  });
  document.getElementById('ai-threads-route')?.addEventListener('click', function () {
    const key = KEYS[turn++ % KEYS.length];
    aiThreadsMod.setAiThreadsActive(host, key);
    tlog('setAiThreadsActive(el, ' + key + ') · 外部路由同步激活态');
  });
}`,
  },
  {
    slug: 'ai-feedback',
    name: '回答反馈',
    group: 'AI 原生',
    desc: '回答级反馈：有帮助 / 无帮助双钮 + 踩后原因枚举 chips（默认五项：答案有误 / 引用不符 / 内容过时 / 无引用依据 / 越权信息，可自定义）+ 提交终态。状态机内建：点赞锁定不展开原因；点踩锁定并展开 chips（单选可切换），提交后进入 .is-done 终态显示感谢文案；再点已选钮回中性。每次投票与提交派 icen:ai-feedback { value: 1|-1|0, reason? }，与 onFeedback 回调双通道。',
    demo: `<div id="ai-feedback-demo"></div>
<p class="demo-label" id="ai-feedback-log" style="margin-top:8px">点「踩」展开原因 chips（默认五项）· 选因提交进入感谢终态 · 再点已选钮回中性 · 点「赞」不展开原因</p>`,
    usage: `import { renderAiFeedback, initAiFeedback } from '@icen.ai/ui/kit/ai-feedback';

initAiFeedback();   // 委托驱动全部状态切换（幂等 + 销毁函数）
renderAiFeedback(el, {
  // reasons 缺省五项：答案有误 / 引用不符 / 内容过时 / 无引用依据 / 越权信息
  reasons: ['答案有误', '引用不符', '内容过时'],   // 可自定义枚举
  onFeedback: (d) => report(d),                    // 与 icen:ai-feedback 事件双通道
});
// 状态机：点「踩」锁定并展开原因（单选可切换）→ 提交进入 .is-done 终态；
// 点「赞」锁定不展开原因；再点已选钮回中性（value 0）`,
    behaviors: ['ai-feedback'],
    behaviorInit: { 'ai-feedback': 'initAiFeedback' },
    script: `const host = document.getElementById('ai-feedback-demo');
const log = document.getElementById('ai-feedback-log');
if (host && aiFeedbackMod) {
  aiFeedbackMod.renderAiFeedback(host, {
    onFeedback: function (d) {
      if (log) log.textContent = 'icen:ai-feedback · value=' + d.value + (d.reason ? ' · reason=' + d.reason : '');
    }
  });
}`,
  },
  {
    slug: 'ai-branch',
    name: '分支切换',
    group: 'AI 原生',
    desc: '回答分支版本切换器「‹ 2/3 ›」：当前从 1 计的页码 + 边界方向钮禁用；count ≤ 1 时容器渲染为空并置 hidden + aria-hidden（单版本无切换语义）。initAiBranch 委托 prev/next 点击：DOM 自动同步页码 / data-index / 边界禁用态（宿主不重渲染也可用，重渲染覆盖亦安全），并派发 icen:ai-branch-change { index, count }；按钮为原生 button，键盘走原生 click。',
    demo: `<div id="ai-branch-demo"></div>
<p class="demo-label" id="ai-branch-log" style="margin-top:8px">‹ 2/3 ›：边界方向钮禁用 · 切换派发 icen:ai-branch-change（宿主按 index 换分支内容）· count ≤ 1 时自动隐藏</p>`,
    usage: `import { renderAiBranch, initAiBranch } from '@icen.ai/ui/kit/ai-branch';

initAiBranch();   // prev/next 委托（幂等）；DOM 自动同步页码与禁用态
renderAiBranch(el, { index: 1, count: 3 });   // index 0 起、渲染时钳制到 [0, count-1]
// count ≤ 1 时容器清空并 hidden + aria-hidden（单版本无切换语义）
el.addEventListener('icen:ai-branch-change', (e) => showBranch(e.detail.index, e.detail.count));`,
    behaviors: ['ai-branch'],
    behaviorInit: { 'ai-branch': 'initAiBranch' },
    script: `const host = document.getElementById('ai-branch-demo');
const log = document.getElementById('ai-branch-log');
if (host && aiBranchMod) {
  aiBranchMod.renderAiBranch(host, { index: 1, count: 3 });
  host.addEventListener('icen:ai-branch-change', function (e) {
    if (log) log.textContent = 'icen:ai-branch-change · index=' + e.detail.index + ' · ' + (e.detail.index + 1) + '/' + e.detail.count;
  });
}`,
  },
  /* ══════════ 图谱 ══════════ */
  {
    slug: 'chart-graph',
    name: '知识图谱',
    group: '图表',
    desc: 'renderGraph：GraphRAG 实体关系力导向 node-link——确定性布局（id 升序环初始化 + 300 轮松弛，无随机源，同数据同布局）、簇着色走既有调色盘（图例可点隐藏整簇，边随任一端簇隐藏淡化）、weight 映射节点半径 6–18px（缺省用度中心性）与边宽 0.6–2.5px、节点可拖拽（局部松弛 20 轮 / rAF 批处理）；事件走既有 icen:chart-* 通道，detail.datum = { id, label, cluster?, meta? } 点击节点回实体卡数据；directed: true 时边带箭头。layoutGraph 为可单测纯函数。',
    demo: `<div class="chart" id="chart-graph-demo"></div>
<p class="demo-label" id="chart-graph-log" style="margin-top:8px">悬停看实体 · 点击节点回实体卡数据（detail.datum.meta）· 拖拽节点局部松弛 · 点图例隐藏整簇（边随端点淡化）</p>`,
    usage: `import { renderGraph, layoutGraph } from '@icen.ai/ui/kit/chart-graph';

const h = renderGraph(el, {
  type: 'graph',
  nodes: [
    { id: 'co-1', label: '冰岩科技', cluster: 'company', weight: 9, meta: { desc: '集团母公司' } },
    { id: 'pr-1', label: 'ICEN UI', cluster: 'product' },   // weight 缺省用度中心性定尺寸
  ],
  edges: [{ source: 'co-1', target: 'pr-1', weight: 9 }],   // weight → 线宽 0.6–2.5px
  clusterLabels: { company: '公司', product: '产品', person: '人物' },
  // directed: true 时边带箭头
});
h.on('click', (d) => openEntityCard(d.datum));   // { id, label, cluster?, meta? }（meta 原样回传）
h.update(nextSpec);                              // 原地重渲（重新布局；确定性：同数据同布局）
layoutGraph(nodes, edges, { seed: 8 });          // 纯函数：id → { x, y }（可单测）`,
    behaviors: ['charts'],
    script: `const host = document.getElementById('chart-graph-demo');
const log = document.getElementById('chart-graph-log');
const tlog = function (msg) { if (log) log.textContent = msg; };
if (host && chartsMod) {
  const h = chartsMod.renderGraph(host, {
    type: 'graph',
    title: 'GraphRAG 实体关系（公司 / 产品 / 人物）',
    nodes: [
      { id: 'co-1', label: '冰岩科技', cluster: 'company', weight: 9, meta: { desc: '集团母公司' } },
      { id: 'co-2', label: '华北云服', cluster: 'company', weight: 5, meta: { desc: '云基础设施供应商' } },
      { id: 'co-3', label: '智链数据', cluster: 'company', weight: 6, meta: { desc: '数据服务商' } },
      { id: 'pr-1', label: 'ICEN UI', cluster: 'product', weight: 8, meta: { desc: '企业级组件库' } },
      { id: 'pr-2', label: '知识中枢', cluster: 'product', weight: 6, meta: { desc: '企业知识库平台' } },
      { id: 'pr-3', label: '数据网关', cluster: 'product', weight: 4, meta: { desc: '数据接入网关' } },
      { id: 'pe-1', label: '林岸', cluster: 'person', weight: 5, meta: { desc: '创始人 / CEO' } },
      { id: 'pe-2', label: '陈珂', cluster: 'person', weight: 4, meta: { desc: 'ICEN UI 维护者' } },
      { id: 'pe-3', label: '周明', cluster: 'person', weight: 3, meta: { desc: '知识中枢架构师' } },
      { id: 'pe-4', label: '苏禾', cluster: 'person', weight: 3, meta: { desc: '数据合规负责人' } }
    ],
    edges: [
      { source: 'co-1', target: 'pr-1', weight: 9 },
      { source: 'co-1', target: 'pr-2', weight: 7 },
      { source: 'co-2', target: 'pr-3', weight: 6 },
      { source: 'co-3', target: 'pr-2', weight: 5 },
      { source: 'co-3', target: 'pr-3', weight: 4 },
      { source: 'co-1', target: 'co-2', weight: 4 },
      { source: 'pe-1', target: 'co-1', weight: 8 },
      { source: 'pe-2', target: 'pr-1', weight: 6 },
      { source: 'pe-3', target: 'pr-2', weight: 5 },
      { source: 'pe-4', target: 'co-3', weight: 7 },
      { source: 'pe-4', target: 'co-2', weight: 3 },
      { source: 'pe-1', target: 'pe-2', weight: 2 },
      { source: 'pe-2', target: 'pe-3', weight: 2 },
      { source: 'pe-3', target: 'pr-3', weight: 3 },
      { source: 'co-3', target: 'pe-1', weight: 3 }
    ],
    clusterLabels: { company: '公司', product: '产品', person: '人物' }
  });
  h.on('click', function (d) {
    if (d.datum) tlog('click · ' + d.datum.label + ' · ' + (d.datum.meta ? d.datum.meta.desc : '无 meta'));
  });
}`,
  },
  {
    slug: 'chart-map',
    name: '嵌入地图',
    group: '图表',
    desc: 'renderMap：embedding 2D 投影地图（renderScatter 的去轴变体）——坐标为预投影值（UMAP / t-SNE 产物，本组件只做视口 min-max 缩放不算投影），无轴刻度只留细虚线网格；点 4px 半透明（fill-opacity 0.7，高密度层叠可辨），簇着色走既有调色盘 + 可点击图例隐藏整簇；点选走 icen:chart-click，detail.datum = { id, label, cluster?, meta? } 回 chunk 数据（meta 原样回传）。',
    demo: `<div class="chart" id="chart-map-demo"></div>
<p class="demo-label" id="chart-map-log" style="margin-top:8px">悬停看簇名 · 点击点回 chunk 数据 · 点图例隐藏整簇 · 坐标为预投影值（UMAP / t-SNE 产物，组件不做投影）</p>`,
    usage: `import { renderMap } from '@icen.ai/ui/kit/chart-map';

const h = renderMap(el, {
  type: 'map',
  points: [
    // x/y 为预投影 2D 坐标（UMAP / t-SNE 产物）；组件只做视口 min-max 缩放
    { id: 'chunk-91', x: 0.31, y: 0.62, cluster: 'policy', label: '差旅报销办法 #3',
      meta: { doc: '差旅报销管理办法.md' } },
  ],
  clusters: { policy: '制度文档', faq: 'FAQ 问答' },   // 簇 key → 图例名
});
h.on('click', (d) => openChunkPanel(d.datum));   // datum.meta 原样回传（点选回 chunk）
h.update(nextSpec);                              // 原地重渲（保留事件委托与句柄）`,
    behaviors: ['charts'],
    script: `const host = document.getElementById('chart-map-demo');
const log = document.getElementById('chart-map-log');
const tlog = function (msg) { if (log) log.textContent = msg; };
if (host && chartsMod) {
  /* 3 簇 mock 投影点：黄金角确定性散布（无随机源，每次刷新同布局） */
  const GROUPS = [
    { key: 'policy', name: '制度', cx: 0.30, cy: 0.64, spread: 0.17, n: 12 },
    { key: 'faq', name: 'FAQ', cx: 0.68, cy: 0.34, spread: 0.20, n: 9 },
    { key: 'ticket', name: '工单', cx: 0.52, cy: 0.80, spread: 0.13, n: 10 }
  ];
  const points = [];
  GROUPS.forEach(function (g) {
    for (let i = 0; i < g.n; i++) {
      const ang = i * 2.399963;
      const rad = g.spread * Math.sqrt((i + 1) / g.n);
      points.push({
        id: g.key + '-' + (i + 1),
        x: Math.round((g.cx + rad * Math.cos(ang)) * 10000) / 10000,
        y: Math.round((g.cy + rad * Math.sin(ang)) * 10000) / 10000,
        cluster: g.key,
        label: g.name + ' chunk #' + (i + 1)
      });
    }
  });
  const h = chartsMod.renderMap(host, {
    type: 'map',
    title: '知识库 chunk 嵌入投影（UMAP 产物 · 3 簇）',
    points: points,
    clusters: { policy: '制度文档', faq: 'FAQ 问答', ticket: '工单沉淀' }
  });
  h.on('click', function (d) {
    if (d.datum) tlog('click · ' + d.datum.label + ' · cluster=' + (d.datum.cluster || '—') + '（点选回 chunk）');
  });
}`,
  },
];
