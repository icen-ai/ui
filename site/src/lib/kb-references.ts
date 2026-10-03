/*
 * /kb 工作台「参考」标签数据 —— 设计决策的文献锚点。
 * 全部链接来自两轮调研的查证记录（docs/research/2026-10-03-ai-kb-components.md 与
 * docs/research/2026-10-03-kb-permissions.md），像参考文献一样可回溯：
 * 后续升级或替换设计时，先回到这些源头看业界是否已演进。
 * note 写明「本库采纳了它的什么决策」——锚点的意义在此。
 * date：论文/博客给发表年月（arXiv 编号可推），官方文档标「持续更新」——
 * 时间本身也是锚点信息（越新的决策越可能需要复查）。
 */

export interface KbReference {
  title: string;
  /** 出处（厂商/会议/论文号） */
  source: string;
  /** 发表/更新时间（论文给年月；官方文档持续更新） */
  date: string;
  url: string;
  /** 我们采纳的决策（一句话） */
  note: string;
}

export const KB_REFERENCES: ReadonlyArray<{ group: string; items: ReadonlyArray<KbReference> }> = [
  {
    group: '证据与引用',
    items: [
      {
        title: 'Citations — Anthropic Docs',
        source: 'Anthropic Platform',
        date: '官方文档 · 持续更新',
        url: 'https://platform.claude.com/docs/en/docs/build-with-claude/citations',
        note: '引用定位三分型（char/page/block + 单位写死）——kb-citation 的 KbLocation 契约直接对齐。',
      },
      {
        title: 'Streaming Citations Cookbook',
        source: 'Perplexity Docs',
        date: '官方文档 · 持续更新',
        url: 'https://docs.perplexity.ai',
        note: '正文 [N] 与 search_results 的 id 映射、绝不让模型生成 URL——无效编号降级为不可点角标的纪律出处。',
      },
      {
        title: 'ALCE: Enabling LLMs to Generate Text with Citations',
        source: 'Princeton NLP · EMNLP 2023',
        date: '2023-05（arXiv 2305.14627）',
        url: 'https://github.com/princeton-nlp/ALCE',
        note: '证明模型引用经常不被文档支持——引用必须程序化校验，不能信任模型自觉（权限域引用白名单的依据）。',
      },
    ],
  },
  {
    group: '摄取与分块',
    items: [
      {
        title: 'Configure Knowledge Base（解析 run 状态机）',
        source: 'RAGFlow Docs',
        date: '官方文档 · 持续更新',
        url: 'https://ragflow.io/docs/dev/configure_knowledge_base',
        note: 'UNSTART/RUNNING/CANCEL/DONE/FAIL 五态与文档粒度单点重跑——kb-pipeline 状态机原型。',
      },
      {
        title: 'Chunks（分块一等公民）',
        source: 'RAGFlow Docs',
        date: '官方文档 · 持续更新',
        url: 'https://ragflow.io/docs/dev/chunk',
        note: '改 keywords 提升召回 + 手动补块 + 双通道检索——kb-chunks 审阅/补块的设计原型。',
      },
      {
        title: 'Chunking and Cleaning Text',
        source: 'Dify Docs',
        date: '官方文档 · 持续更新',
        url: 'https://docs.dify.ai/zh/cloud/use-dify/knowledge/create-knowledge/chunking-and-cleaning-text',
        note: '「分段模式创建后不可改、参数可随时调」的边界显式化——kb-segment 锁定语义与实时预览的出处。',
      },
      {
        title: 'Connector Monitoring',
        source: 'Glean Docs',
        date: '官方文档 · 持续更新',
        url: 'https://docs.glean.com/connectors/monitoring',
        note: 'Active ≠ 抓取成功；健康 = 4 离散信号 + 阈值 + 不可关闭告警——kb-connector 健康模型原型。',
      },
      {
        title: 'LlamaParse',
        source: 'LlamaIndex Developers',
        date: '官方文档 · 持续更新',
        url: 'https://developers.llamaindex.ai/llamaparse/parse/',
        note: '自然语言 preset + 按文档类型路由的解析策略——kb-pipeline 文档类型模板的参照。',
      },
    ],
  },
  {
    group: '检索与重排',
    items: [
      {
        title: 'Additional Properties（distance / certainty / score / explainScore）',
        source: 'Weaviate Docs',
        date: '官方文档 · 持续更新',
        url: 'https://docs.weaviate.io/weaviate/api/graphql/additional-properties',
        note: '分数纪律黄金标准：metric + 归一 + 分数拆解三件套——kb-core 分数契约（higherIsBetter / null→「—」）原型。',
      },
      {
        title: 'Search Explorer',
        source: 'Microsoft Learn · Azure AI Search',
        date: '官方文档 · 持续更新',
        url: 'https://learn.microsoft.com/en-us/azure/search/search-explorer',
        note: '三视图（向查/拖图/JSON 全参数）与诚实呈现边界（空查询 score=1 无排序）——kb-retrieval playground 原型。',
      },
      {
        title: 'Rerank API',
        source: 'Cohere Docs',
        date: '官方文档 · 持续更新',
        url: 'https://docs.cohere.com/reference/rerank',
        note: '响应只有 {index, relevance_score}，前端 diff 即得 Δ——kb-rerank A/B 对比的契约出处（市场空白件）。',
      },
      {
        title: 'Filterable HNSW',
        source: 'Qdrant Engineering Blog',
        date: '2023-04',
        url: 'https://qdrant.tech/articles/filterable-hnsw/',
        note: '渗流理论证明「先检索后过滤」碎图掉召回——过滤必须进图遍历（pre-filter 语义的工程证据）。',
      },
      {
        title: 'Filters（允许集先行 + 自适应扫描）',
        source: 'Weaviate Docs',
        date: '官方文档 · 持续更新',
        url: 'https://docs.weaviate.io/weaviate/search/filters',
        note: '先由过滤求出允许集再检索、高选择性退化为暴力扫描保 100% 召回——kb-retrieval 阈值/存活语义参照。',
      },
    ],
  },
  {
    group: '权限与安全',
    items: [
      {
        title: 'RAG Security Cheat Sheet',
        source: 'OWASP',
        date: '2025 发布 · 持续维护',
        url: 'https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html',
        note: '「检索内容是数据不是指令」+ 检索前过滤铁律 + fail-closed——kb-perm 安全纪律总纲（spec §9.0）的第一出处。',
      },
      {
        title: 'OWASP Top 10 for LLM Applications',
        source: 'OWASP GenAI',
        date: '2025 版',
        url: 'https://genai.owasp.org/llm-top-10/',
        note: '提示注入与敏感泄露连续居首——检索上下文作为权限汇聚点的威胁模型依据。',
      },
      {
        title: 'Zanzibar: Google\'s Consistent, Global Authorization System',
        source: 'Google Research · USENIX ATC 2019',
        date: '2019-05',
        url: 'https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/',
        note: '关系元组 + 并集/交集/排除求值——kb-core evaluateAcl（先 deny→并集→默认拒绝）的语义原型。',
      },
      {
        title: 'Document Level Security',
        source: 'Elasticsearch Docs',
        date: '官方文档 · 持续更新',
        url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/document-level-security.html',
        note: 'DLS 下打分刻意用全局统计、聚合可能泄露、多角色取并集——分数/聚合侧信道的官方证据。',
      },
      {
        title: 'Security Trimming（search.in 过滤模式）',
        source: 'Microsoft Learn · Azure AI Search',
        date: '官方文档 · 持续更新',
        url: 'https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search',
        note: 'retrievable:false 不是安全机制、每条查询必须带 filter——「漏一条查询就裸奔」的官方口径。',
      },
      {
        title: 'Filtering on User Context',
        source: 'AWS Docs · Amazon Kendra',
        date: '官方文档 · 持续更新',
        url: 'https://docs.aws.amazon.com/kendra/latest/dg/user-context-filter.html',
        note: '无 UserContext 返回全部文档（fail-open）且不校验自报身份——playground 未启用过滤必须打醒目警告的教训来源。',
      },
      {
        title: 'Glean Security',
        source: 'Glean',
        date: '官方页面 · 持续更新',
        url: 'https://www.glean.com/security',
        note: '「对每次读写执行源系统权限」+ SSO 双侧验证——连接器同步 ACL、检索期执行的产品范式。',
      },
      {
        title: 'Understanding Permission Levels（继承 / Limited Access / Deny）',
        source: 'Microsoft Learn · SharePoint',
        date: '官方文档 · 持续更新',
        url: 'https://learn.microsoft.com/en-us/sharepoint/understanding-permission-levels',
        note: '继承四件套 + 系统自动角色 + web 级 deny 优先——kb-acl 继承 banner 与 deny 置顶的原型。',
      },
      {
        title: 'Manage Sharing（allowFileDiscovery / 继承级联）',
        source: 'Google Drive API',
        date: '官方文档 · 持续更新',
        url: 'https://developers.google.com/workspace/drive/api/guides/manage-sharing',
        note: '可搜索发现 ≠ 可读内容（元数据可见性开关）+ 子级只能放大不能缩减——可见性五级中 metadata 级的出处。',
      },
      {
        title: 'Is My Data in Your Retrieval Database?（RAG 成员推断攻击）',
        source: 'arXiv 2405.20446 · ICISSP 2025',
        date: '2024-05',
        url: 'https://arxiv.org/abs/2405.20446',
        note: 'RAG 输出会回显库内内容、可作 oracle 探测——「生成后过滤不是边界」的学术证据。',
      },
      {
        title: 'Riddle Me This! Stealthy Membership Inference Attacks on RAG',
        source: 'arXiv 2502.00306',
        date: '2025-02',
        url: 'https://arxiv.org/abs/2502.00306',
        note: '30 次查询、$0.02/文档即稳定推断受限文档存在——「差值计数即泄露」的定量依据。',
      },
      {
        title: 'HONEYBEE: Efficient RBAC for Vector Databases',
        source: 'arXiv 2505.01538 · SIGMOD 2026',
        date: '2025-05',
        url: 'https://arxiv.org/abs/2505.01538',
        note: '按角色结构动态分区的中间态方案（隔离索引 vs 共享+过滤谱系）——多租户检索架构升级时的回归点。',
      },
      {
        title: 'Privileged Identity Management（JIT 激活）',
        source: 'Microsoft Learn · Entra',
        date: '官方文档 · 持续更新',
        url: 'https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure',
        note: 'eligible→active 激活（审批+MFA+理由+时长上限）——kb-access 到期三态与临时权限印记的范式。',
      },
    ],
  },
  {
    group: '评测与治理',
    items: [
      {
        title: 'Compare Experiments（四级评测分级）',
        source: 'Braintrust Docs',
        date: '官方文档 · 持续更新',
        url: 'https://braintrust.dev/docs/evaluate/compare-experiments',
        note: 'Improvement/Regression/Tradeoff/Tie + baseline 自动选择——kb-eval 对比表的分级原型。',
      },
      {
        title: 'Test Retrieval（召回测试三设计）',
        source: 'Dify Docs',
        date: '官方文档 · 持续更新',
        url: 'https://docs.dify.ai/en/cloud/use-dify/knowledge/test-retrieval',
        note: '侧栏一等入口 / 试参数不污染生产 / Records 沉淀——kb-hittest 的交互原型。',
      },
      {
        title: 'Perform Access Review',
        source: 'Microsoft Learn · Entra ID Governance',
        date: '官方文档 · 持续更新',
        url: 'https://learn.microsoft.com/en-us/entra/id-governance/perform-access-review',
        note: '批量 Approve/Deny/Don\'t know + 建议引擎 + 决定与执行两段式——权限复核工作台（后续演进）的范式。',
      },
      {
        title: 'Audit Log Activities',
        source: 'Microsoft Learn · Purview',
        date: '官方文档 · 持续更新',
        url: 'https://learn.microsoft.com/en-us/purview/audit-log-activities',
        note: 'FileAccessed 与 FilePreviewed 分列、同用户同资源 5 分钟去重——kb-audit 时间线的事件模型出处。',
      },
    ],
  },
  {
    group: 'Agent 与沙箱',
    items: [
      {
        title: 'MCP Apps（沙箱化 UI 反调）',
        source: 'Model Context Protocol Blog',
        date: '2026-01-26',
        url: 'https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/',
        note: 'iframe allow-scripts 无同源 + postMessage 反调（callServerTool/updateModelContext）+ ui:// 资源——kb-sandbox 契约出处。',
      },
      {
        title: 'Our Unified Data Platform（Town Lake）',
        source: 'Cloudflare Blog',
        date: '2023-03',
        url: 'https://blog.cloudflare.com/our-unified-data-platform/',
        note: '表/schema 可见、PII 列默认 redacted、按会话解锁且全程留痕——「数据目录式可见性」与打码形态的参照。',
      },
    ],
  },
];
