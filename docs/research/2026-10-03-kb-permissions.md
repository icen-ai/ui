# 2026-10-03 · 企业级知识库权限隔离调研（kb-perm 域设计依据）

调研日期：2026-10-03。方法：5 路并发调研（企业文档 ACL 权限模型 / 检索期权限安全过滤 / 权限 UI 呈现与访问流程 / RAG 权限攻击与防御 / 治理深度与多角色组合），核实约 100+ 来源（官方文档、OWASP、学术论文与安全事件披露），合并去重后见文末来源总索引。

本报告目的：为 kb-perm（权限域）组件设计提供跨五份调研的统一结论与全文归档，风格对齐 `docs/research/2026-10-03-ai-kb-components.md`。

**报告编号对照**

| 编号 | 主题 | 一句话结论 |
|---|---|---|
| 报告1 | 企业文档 ACL 权限模型 | 业界收敛为「四维授权模型 + 可见性分级输出」；继承是默认态、断继承是可还原的例外态 |
| 报告2 | 检索期权限安全过滤 | 查询期前置过滤（query-time pre-filter）是唯一安全黄金标准；计数/分数/聚合皆可成为泄露面 |
| 报告3 | 权限 UI 呈现与访问流程 | 被拒页五件套、申请-审批闭环、扁平原因清单是被三家以上验证的组件范式 |
| 报告4 | RAG 权限攻击与防御 | 权限判定必须发生在内容进入模型上下文之前；UI 诚实呈现义务止于「过滤发生了」 |
| 报告5 | 治理深度与多角色组合 | 多角色并集 + 显式 deny 例外是主流；审批/复核/到期/break-glass 均为 staged→apply 两段式 |

---

## 结论速览

### 1. 四维授权模型（报告1）

业界（SharePoint/M365、Google Drive、Confluence、Box、Notion、Zanzibar）收敛为**四维授权模型**，可见性分级不是第五维、而是四维运算后的输出状态：

| 维度 | 回答的问题 | 业界共识 |
|---|---|---|
| 组织维度 | 谁是主体容器 | 租户全员 → 站点/空间 → AD/Entra 安全组、Google Group → 个人；垂直继承 + 横向隔离 + 矩阵交叉。**组是唯一一等授权主体，部门树不直接当 ACL 用** |
| 角色维度 | 能做什么 | 4-5 档（owner/organizer/writer/commenter/reader 等）；权限级 = 权限原子集合（SharePoint permission level 范式）；commenter 独立档位是知识库关键 |
| 文档维度 | ACL 挂在哪一层 | 站点/空间 → 库/文件夹 → 条目级 unique permission；**继承是默认态，断继承是例外态**，且例外必须可枚举、可还原（SharePoint inherit banner + 例外清单 + Delete unique permissions 四件套） |
| 链接维度 | 如何到达 | Restricted / 特定人员 / 组织内 / 任何人；**链接是独立 ACL 实体**（自带角色+过期+密码），与直接授权分区呈现、分别可撤销 |

继承语义的不对称实例：Google Drive 继承来的权限在子级**只能放大不能缩减**（2025-09 起官方强制）；Confluence page restriction 只能在 space permission 之内收紧、不能放宽，且 view 限制父→子继承而 edit 限制不继承。

### 2. 可见性五级（报告1；报告3 交叉印证）

| 级别 | 语义 | 代表实现 |
|---|---|---|
| L0 完全隐藏 | security trimming：搜索、目录、计数完全不出现，「看不到 = 不存在」 | SharePoint 搜索（裁剪不可禁用）、Glean、Confluence 无 space 权限者 |
| L1 元数据可见 | 知道存在（标题/锁图标/位置），内容不可读 | Confluence 受限页进搜索/页面树带锁图标；Drive `allowFileDiscovery` |
| L2 内容受限页 | 403 + 原因摘要（脱敏）+ Request access 闭环，明示审批人是谁 | Confluence/Drive/Notion/SharePoint/Figma 被拒页 |
| L3 / L4 只读 / 可编辑 | 常规内容态 | 各家 viewer/editor 角色 |
| （预留）L2.5 摘要可见、原文受限 | AI 摘要权限 ≠ 原文权限，业界尚无统一范式 | 传统产品不提供；随 Copilot 类摘要正在成为新层级，UI 库应预留此态 |

搜索结果组件需同时支持「裁剪模式（L0）」与「锁图标模式（L1）」两种产品策略；「无权条目仍显示元数据」仅适用于数据目录类产品（Cloudflare Town Lake 范式），文档类产品全部选择彻底隐藏。

### 3. 求值语义（报告1、报告5）

- **主流范式 = 多角色并集 + 显式 deny 一票否决**（SharePoint、Azure RBAC、AWS IAM、Entra、Okta、NIST RBAC）。工程上最清晰的表述：先查显式拒绝 → 再查显式允许 → 否则默认拒绝。
- **Zanzibar/ReBAC 范式 = 集合算子**：`object#relation@user` 关系元组 + userset rewrite 的 union/intersection/exclusion；Check 无匹配关系即拒绝（**fail-closed**）。交集/排除算子比并集性能更贵（SpiceDB 官方提示）。
- **没有任何主流系统用 first-match**：NTFS 有序 ACE 是唯一残留，且非规范序 ACL 中 deny 可能永不触发——反面教材。
- **减法 ≠ 拒绝**（Azure NotActions 教训）：NotActions 只在同一角色定义内做减法，别的角色再授该 action 时仍有效；减法只属于角色定义编辑器，拒绝属于策略层，两者绝不混在同一控件。
- **每个有效权限必须可枚举其授予来源链**（直接授予 / 组 / 继承 / 链接 / access package），deny 必须标注否决来源层——SharePoint Check Permissions 与 Confluence「People who can view」是仅有的两个成熟范式。

### 4. 检索安全分层（报告2、报告4）

| 层 | 做什么 | 安全性质 |
|---|---|---|
| Index-time（索引期） | 摄取文档 + 摄取 ACL（Kendra `Principal`、Azure `group_ids`、ES DLS query、Glean connector 镜像） | 前置数据准备，**不是安全边界**；会过期（权限撤销滞后） |
| **Query-time pre-filter（查询期前置过滤）** | 把服务端验证的身份编译为过滤器，在检索执行体内部生效（Azure `search.in`、ES DLS、Kendra `UserContext`、Weaviate/Qdrant filtered search） | **唯一安全黄金标准**：未授权内容从未成为候选 |
| Query-time post-filter | 取回 top-k 后再过滤 | 不安全：相似度分数已被观察（喂侧信道）、top-k 不足额、内容已离开索引层进日志/重排/缓存 |
| Generation-time（生成期） | LLM 已看到文档，生成后审查输出 | 不是安全边界：paraphrase 即泄露（ConfAIde：GPT-4 39% / ChatGPT 57% 泄露率）；只能算纵深兜底 |
| Presentation-time（展示期） | 前端隐藏条目/过滤引用 | 最弱：制造答案与引用前后不一致的可感知泄露 |

四条配套纪律：
1. **混合检索双腿同过滤**：ACL filter 必须在 RRF 融合之前同时作用于向量腿与 BM25 腿（真实泄露案例：只过滤向量腿，BM25 纯关键词命中经融合直接泄露）。
2. **fail-closed**：Kendra 无 UserContext 时返回全部文档（官方明示 fail-open）、且不校验自报身份——身份必须来自服务端验证 token，权限服务不可用时拒绝而非放行。
3. **租户级物理隔离 + 租户内文档级 pre-filter**（Weaviate per-tenant shard vs Pinecone shared+filter 谱系；HONEYBEE 动态分区是可落地中间点）；定期跑跨租户探针断言 zero cross-boundary results。
4. **检索不是唯一防线**：间接提示注入（Slack AI / M365 Copilot 事件）与 confused deputy 要求「Access control must be enforced before content reaches the model」（OWASP）；RAG 只是放大器，安全性上界 = 源系统权限卫生（oversharing）。

### 5. 呈现纪律五条（报告2、报告3、报告4）

1. **计数只显示裁剪后的安全计数**：total、分页、facet、直方图、suggest 一律基于裁剪后集合；**永不显示「总数 vs 可见数」之差**——仅结果基数就足以支撑重建攻击（Count/Volume Attack），MIA 探针 30 次查询、每文档 <$0.02 即可推断成员关系。
2. **引用只能从裁剪后集合白名单生成**：禁止「LLM 见过、UI 过滤引用」的模式（只制造可感知的不一致泄露）；把 permission leak rate（答案引用了用户无权 chunk 的比例）列为常驻 QA/回归指标，引用做程序化 grounding 校验（ALCE 证明引用不可信）。
3. **存在性提示只能用与命中无关的恒定文案**：至多声明「结果已按你的权限过滤」这一事实，绝不带数量、不带条件分支；对未授权用户受限对象呈现为「不存在」（GitHub 404 惯例）——诚实呈现义务的对象是「过滤这件事发生了」，不是「被过滤对象的存在性」。
4. **空结果双语义 + fail-closed 可见**：区分「授权集合内确实无相关内容」与「权限校验失败」，两者文案均不涉及受限侧任何信息；权限服务超时/降级时 UI 显式显示「因权限校验不可用而未检索」，绝不静默退化为无过滤检索。
5. **调试能力最小化 + 新鲜度可见**：「显示被裁剪结果」开关仅对管理员/审计角色开放且默认关闭（否则 playground 自身就是 membership-inference oracle）；分数只取裁剪后集合内相对值；展示 ACL 同步时间戳与身份解析时间，提供「强制重同步」入口。

### 6. 组件映射表（五份报告合并）

| 组件（建议名） | 职责 | 最佳原型 | 来源 |
|---|---|---|---|
| `PermissionChip` 族（restricted / pending / expiring 三 variant，不拆分） | 锁图标 /「已请求」/「Access expires on …」徽章；状态即入口（Notion 范式） | Confluence 锁图标 · Atlassian 2026 pending 按钮 · Drive 到期文案 | 报告3 |
| `AccessDeniedPage`（被拒页五件套） | 资源名 + 原因说明 + owner 身份 + 申请主动作 + 切换账号/联系次动作；拒绝文案永远带下一步 | Drive / Figma / Notion / SharePoint 四家同构 | 报告3 |
| `AccessRequestDialog` + `AccessRequestsQueue` | 申请弹窗（留言 + 多角色请求，批准取最高）+ 审批收件箱（红点入口仅 pending 时出现 + 请求卡 + ellipsis 菜单 + Show History） | Google pending access proposals · SharePoint Access requests · Notion Inbox | 报告3 |
| `AccessRequestDrawer` + `ApprovalInbox`（治理级） | 理由（可强制）/ 时间窗口 / 代他人申请 / 多策略选择；状态机含 denied/expired/partially_delivered + Resubmit；委托与多阶段审批、Revoke approval、过期倒计时 | Entra 权利管理 · Okta request sequences | 报告5 |
| `ShareScopeSelector` | 范围（specific / 组织内 / anyone / 已有权限者）× 角色 × 链接设置（过期/密码）；组展开须处理「成员不可见」受限态 | Google 与 Microsoft 选项集几乎一一对应 | 报告3 |
| `InheritanceBanner` + `StopInheritingButton` / `RestoreInheritanceButton` | 继承状态条（父链）+ 断继承确认（危险操作）+ 恢复继承 + 例外子项清单 + Limited Access 系统态 badge | SharePoint 权限页四件套 | 报告1 |
| `ManageAccessPanel`（双区） | Direct access（人/组 + 角色 + 可移除）与 Links giving access（类型 + 到期/密码 + 可止付）分区呈现、分别可撤销 | SharePoint Manage access · Drive People + General access 双轨 | 报告1 |
| `GrantDialog` | 主体选择器（人/组，拒绝非安全通讯组）+ 权限级（默认 Edit，Show options 展开）+ 可选通知 + 文件夹穿透选项 | SharePoint Grant Permissions | 报告1 |
| `EffectivePermissionPanel`（view-as / 原因链） | 用户选择器 → 有效权限结论 + **扁平来源清单**（经由组 X（继承自 Y）/ 直接 / 链接 badge 列表，渐进披露），deny 置顶标注否决层；**不做完整树**（无产品做成） | SharePoint Check Permissions · Jira Permission Helper · Confluence People who can view | 报告1、3、5 |
| `ExpiringAccessBadge` + `ExpiringAccessList` | 到期倒计时 pill、时钟图标、续期请求入口、已过期态重交入口；每个 grant 强制带 `expiresAt`（nullable），三态：永不过期 / 将到期 / 已过期 | Box 时钟图标 · Drive per-person 到期 · Entra access package | 报告5 |
| `BreakGlassBanner` + `BreakGlassConfirmDialog` | 紧急访问常驻警示条幅 + 理由必填确认 + 审计标记（`breakGlass: true` 事件字段）；JIT 激活横幅含剩余时长倒计时，引用标注「经由临时权限访问」，到期不静默 | Entra PIM（eligible/审批/MFA）· 双人托管 break-glass 账户 | 报告4、5 |
| `AccessReviewWorkbench` | Due / Progress 表头、行内 Approve / Deny / Don't know + Reason、建议引擎（30 天未登录 / peer outlier）+ Accept recommendations、多阶段覆盖、不响应默认策略；**决定 staged → apply 分离** | Entra Access Reviews · SharePoint Site Access Reviews | 报告5 |
| `PermissionHygieneList`（异味发现卡片） | 异味枚举（org_wide_link / eeeu_group / sensitive_label_broad / broken_inheritance / orphaned_owner / excessive_permissioned_users）+ 量化数字（permissioned users 不去重计数）+ 处置 CTA | SharePoint DAG 报告 · Purview 敏感度错配事件 | 报告5 |
| `PermissionAuditLog` / `AuditTrailTimeline` | 过滤器（人/资源/动作/时间）+ 事件时间线 + 导出；read / permission-change / delegation 三通道；actor 三态 human / app / system；preview 与 view 分列两个事件 | Box User Activity Report · MS Purview Audit | 报告3、5 |
| `PermissionChangeLog` | who / when / what diff（增删了哪个主体、哪个组、哪条链接） | Purview sharing/permission 事件族 | 报告5 |
| 检索 Playground 安全信号组件（过滤层徽标 / chunk ACL 元数据行 / citation grounding 状态 / fail-closed 态 / 混合检索分腿过滤状态 / ACL 新鲜度） | 每条查询显式展示 ACL 过滤层级（pre-filter ★ / post-filter 缺陷 / none 危险）、身份与 filter 表达式摘要、每 chunk 的 ACL 标签、引用是否通过程序化 grounding 校验、权限服务降级提示 | Azure `search.in` · ES DLS · Kendra UserContext · OWASP RAG Cheat Sheet | 报告2、4 |

**跨组件工程原则**（报告5）：① 组合语义统一为「并集 + 显式 deny 例外优先」，禁止 first-match；② 一切 grant 可追溯来源、可解释否决层；③ 权限生效允许延迟（缓存失效语义）；④ 决定与执行两段式（审批与复核均 staged→apply）；⑤ break-glass 审计粒度 ≥ 常规访问并带实时告警。

**明确不做/慎做**（报告3）：无权条目显示元数据的搜索行（仅限数据目录场景且要警示元数据泄露）、显式「被拒绝」红色终态（静默是行业默契）、摘要文字打码条（文档产品无先例）、完整原因链树（降级为清单）、终端用户层数据驻留提示（无先例）。

---

## 五份报告全文归档

以下为五份独立调研报告的全文，正文原样保留（仅删除会话导语、未做其他改动）。

### 报告1：企业知识库/文档系统权限模型调研报告（面向 @icen.ai/ui kb 组件库）

> 提取自 agent_6addb4a9-9563-4438-b06d-974797cdb996（output.txt）。

# 企业知识库/文档系统权限模型调研报告（面向 @icen.ai/ui kb 组件库）

调研覆盖 SharePoint/Microsoft 365、Google Drive、Confluence、Box、Notion、Google Zanzibar（ReBAC）、NIST RBAC、Azure RBAC，共 20+ 来源（官方文档为主）。

---

## 0. TL;DR

- 业界收敛为**四维授权模型**：组织维度（谁是主体容器）× 角色维度（能做什么）× 文档维度（ACL 挂在哪一层）× 链接维度（如何到达）；「可见性分级」不是第五维，而是四维运算后的**输出状态**。
- **继承是默认态，断继承是例外态**，且例外必须可枚举、可还原（SharePoint 的 inherit banner + exceptions 列表 + Delete unique permissions 是完整范式）。
- 多角色叠加的主流语义是**并集 + deny 优先**（SharePoint/Azure）；Zanzibar 用集合运算（union/intersection/exclusion）把这套语义通用化。
- 可见性业界实际分 4 级：完全隐藏（security trimming）/ 元数据可见（锁图标，知道存在）/ 内容受限页（可申请权限）/ 完全可见。
- 权限 UI 的终极问题是「**为什么我看不到/能看到它**」——SharePoint 的 Check Permissions 是唯一做全原因链的，Confluence/Drive 都不完整，这是组件库的差异化机会。

---

## A. 核心概念图谱：四维授权 + 一个输出

```
┌─ 维度1 组织维度（主体是谁的容器）──────────────────────────────┐
│ 租户全员(Everyone except external users / "组织中任何人")      │
│   → 站点/空间(SharePoint site · Confluence space · Shared Drive)│
│     → AD/Entra 安全组 · Google Group（跨部门虚拟团队）          │
│       → 个人                                                   │
│ 语义：垂直继承(部门树/文件夹树自上而下) + 横向隔离(平级互不可见)  │
│       + 矩阵交叉(一人多组，group 为一等授权主体)                 │
├─ 维度2 角色维度（能做什么）───────────────────────────────────┤
│ 权限级 = 权限原子的集合（SharePoint Full Control/Edit/Contribute│
│ /Read/Limited Access…；Drive owner/organizer/writer/commenter/ │
│ reader；Box 7 种协作者角色；Confluence view/edit）              │
│ 组合语义：RBAC 并集(NIST) / deny 优先(SharePoint, Azure) /      │
│ Zanzibar userset rewrite(∪ ∩ −)                               │
├─ 维度3 文档维度（ACL 挂在哪一层）──────────────────────────────┤
│ 站点/空间级 → 库/文件夹级 → 条目级(item-level unique permission)│
│ 每条 ACL 记录：主体 + 角色是否继承(inherited/inheritedFrom)     │
├─ 维度4 链接维度（如何到达）───────────────────────────────────┤
│ Restricted(无链接) / 特定人员 / 组织内任何有链接者 / 任何人有链接│
│ 每条链接独立携带角色(viewer/commenter/editor)+过期+密码         │
│ allowFileDiscovery：可搜索发现 ≠ 可读内容（元数据可见性开关）    │
└───────────────────────────────────────────────────────────────┘
            ↓ 四维求值后的「输出状态」= 可见性分级
 L0 完全隐藏(列表/计数/搜索都不出现) → L1 元数据可见(锁图标，知道存在)
 → L2 内容受限页(403 + Request access) → L3 只读 → L4 可编辑
```

---

## B. 各维度业界做法与最佳实践（带来源）

### B1 组织维度

**垂直继承（自上而下）**
- **SharePoint**：site collection 根站点 → 子站点 → 列表/库 → 文件夹 → 条目，默认全继承。任一层可「Stop Inheriting Permissions」断继承获得 unique permissions；「Delete unique permissions」可还原（还原后状态条变回 "This library inherits permissions from its parent"）。关键细节：**把单个文档 share 给无权限者会自动隐式断继承该 item**，且之后父级权限变更不再作用于它；10 万条目以上的容器禁止断/恢复继承。权限页会显式列出「哪些子项脱离了本页控制」（"Some items of this list may have unique permissions… Show these items"）与「存在 Limited Access 用户」提示。[来源：Microsoft Learn 权限级文档](https://learn.microsoft.com/en-us/sharepoint/understanding-permission-levels)、[Microsoft Support：Customize permissions for a SharePoint list or library](https://support.microsoft.com/en-us/office/customize-permissions-for-a-sharepoint-list-or-library-02d770f3-59eb-4910-a608-5f84cc297782)
- **Google Drive**：子项默认继承父文件夹 ACL；**继承来的权限在子级只能放大不能缩减**（2025-09-22 起由 Google 强制，策略上"访问永远从父级级联"）；移动文件时按新父级重算 ACL；API 里每条 permission 带 `inherited: true` + `inheritedFrom` 指向来源。移除父级授权只回收继承部分，子级直接授权保留。[来源：Drive API manage-sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing)、[Google Workspace Updates Blog 2025-09](https://workspaceupdates.googleblog.com)、[官方帮助：Share folders](https://support.google.com/drive/answer/7166529)
- **Confluence**：三层结构 global permissions → space permissions → page restrictions；**page restriction 只能在 space permission 之内收紧、不能放宽**。继承语义不对称：**view 限制父页→子页继承，edit 限制不继承**（需逐页设置，2006 年至今的长期 feature request）。[来源：Atlassian 官方文档 add-or-remove-page-restrictions](https://support.atlassian.com/confluence-cloud/docs/add-or-remove-page-restrictions/)、[Atlassian Community：child pages inheritance](https://community.atlassian.com)

**横向隔离（平级互不可见）**
- Confluence 的做法是**以 space 为隔离单位做组白名单**：从 space view 权限中移除默认的 confluence-users 组，只加特定组（如 team-x-members），则无权限者看不到该 space 的目录与搜索结果；官方最佳实践是建一个中央 space-admins 组并在 default space permissions 中预置到所有新 space。[来源：Confluence Data Center Permissions best practices](https://confluence.atlassian.com/doc/permissions-best-practices)
- SharePoint 的做法是 **private team site**：私人团队站点禁止给 "Everyone except external users" 组授权，成员必须经 M365 Group 显式授予；public 站点则自动把该组加进 Members。[来源：Understanding permission levels](https://learn.microsoft.com/en-us/sharepoint/understanding-permission-levels)
- **要点**：业界没有一家用「部门树节点」直接当 ACL 主体——隔离单位是**站点/空间**，部门通过「AD/Google Group ↔ 空间」的映射间接表达。

**矩阵式/交叉组织（一人多部门、虚拟团队）**
- 通用解法是把 **group 作为一等授权主体**：SharePoint 组/Entra 安全组、Google Group。共享给组后，人员变动只需改组成员（由 Admin console/IT 集中管理）， removeFrom group = 全量自动回收。Shared Drive 有数量限额（约 100 组/600 成员）需要在 UI 上暴露。[来源：Lewis & Clark IT Shared Drives 指南](https://www.lclark.edu)、[Drive API（group 类型 permission）](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- Zanzibar 用 **Leopard 嵌套组索引**（成员关系的传递闭包、内存单次查询）解决嵌套组的展开性能，说明「一人多组、组套组」是 Google 规模下的真实一等场景。[来源：Zanzibar 论文](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/)、[Authzed 解读](https://authzed.com/blog/what-is-zanzibar/)

### B2 角色维度

**角色分级（业界事实标准 4-5 档）**
- Drive：owner / organizer（共享盘管理）/ **writer / commenter / reader** —— commenter 作为独立档位是知识库场景的关键（能反馈不能改）。
- SharePoint 权限级（permission level = 权限原子集合）：Full Control / Design / Edit / Contribute / Read / View Only / **Restricted Read** / **Limited Access**（系统自动）/ Approve / Manage Hierarchy；默认映射 Owners→Full Control、Members→Edit、Visitors→Read。权限之间存在**依赖闭包**（清除 Open 会自动清掉几乎所有其他权限）。[来源：Understanding permission levels](https://learn.microsoft.com/en-us/sharepoint/understanding-permission-levels)
- Box 7 档协作者角色：Co-Owner / Editor / Viewer Uploader / Previewer Uploader / Viewer / Previewer / Uploader（Uploader 只能上传、**看得到条目名但不能看内容**——上传收集场景）。单文件协作只允许 Editor/Viewer 两档。[来源：Box 官方协作者权限表](https://support.box.com/hc/en-us/articles/360044196413-Understanding-Collaborator-Permission-Levels)
- Notion：No access / Can view / Can comment / Can edit / **Full access**（Full access 者可管理他人权限）。[来源：Notion Sharing & permissions](https://www.notion.com/help/sharing-and-permissions)

**多角色叠加语义（effective permission）**
- **NIST RBAC**：user↔role、role↔permission 均为多对多，多角色时有效权限 = **并集**，叠加角色层级继承（senior 继承 junior）。[来源：NIST RBAC Model](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=916402)、[NIST CSRC](https://csrc.nist.gov/projects/role-based-access-control)
- **SharePoint 是「加法 + deny 优先」**：跨所有直接授权与组（含 AD 组）成员资格叠加取并集，但显式 Deny 覆盖一切 Grant（site collection admin 是例外）。[来源：Microsoft Q&A "Deny on my permissions"](https://learn.microsoft.com)、[Microsoft Support customize permissions](https://support.microsoft.com/en-us/office/customize-permissions-for-a-sharepoint-list-or-library-02d770f3-59eb-4910-a608-5f84cc297782)
- **Azure RBAC 分三件事**：allow 并集；**deny assignment 一票否决任何 role assignment**；而 `NotActions/NotDataActions` **不是 deny**，只是同一角色定义内从通配 allow 里做减法（别的角色再授该 action 时仍有效）。[来源：Azure deny assignments](https://learn.microsoft.com/en-us/azure/role-based-access-control/deny-assignments-list)、[Journey of the Geek: notActions 语义辨析](https://journeyofthegeek.com)
- **Google Zanzibar（ReBAC）**：一切授权存为关系元组 `object#relation@user`（如 `doc:readme#viewer@group:eng`）；权限计算 = 沿关系图做 **userset rewrite：union（或）/ intersection（且）/ exclusion（非）** 集合运算。经典 Drive 建模：`can_view = owner ∪ editor ∪ viewer ∪ parent.can_view`；intersection 表达「必须同时在 A 组和 B 组」，exclusion 表达「除黑名单外」。为 Drive/Calendar/Maps/YouTube/Cloud 提供万亿级 ACL、10ms 内判定，靠 Zookie 保证外部一致性。[来源：Zanzibar 论文](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/)、[Authzed](https://authzed.com/blog/what-is-zanzibar/)、[Aserto: How Drive models authz with Zanzibar](https://www.aserto.com)

### B3 文档维度：ACL 结构

- Drive 的 permission 资源是标准模型：**type（user/group/domain/anyone）× role**，`domain/anyone` 型可带 `allowFileDiscovery`；共享盘中角色可来自三层（盘成员/文件夹角色/文件角色），API 提供 `permissionDetails` 区分 inherited 与 direct，并建议 UI 直接读 `capabilities`（canShare/canComment…）而非自行解析 ACL。[来源：Drive API manage-sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- SharePoint 的 item-level unique permission 会**自动**给用户在站点/库层补一个 **Limited Access**（不可手工授予、不可删，用于渲染导航 UI 而不暴露其他内容）——这是「容器可见但内容不可见」的系统态。[来源：Understanding permission levels](https://learn.microsoft.com/en-us/sharepoint/understanding-permission-levels)、[Microsoft Q&A: Limited Access](https://learn.microsoft.com)
- Confluence 的 restriction 是「减法 ACL」：按用户/组分别设 view 与 edit 名单，且必须是 space permission 的子集；锁图标点开即显示「谁能看/谁能编辑」两个名单。[来源：add-or-remove-page-restrictions](https://support.atlassian.com/confluence-cloud/docs/add-or-remove-page-restrictions/)

### B4 链接维度

- **Microsoft 365 四类链接**：Anyone with the link（可强制过期+密码，免登录）/ People in your organization with the link / People with existing access（不授新权，直达）/ Specific people；管理员可设站点默认链接类型。[来源：Manage sharing settings](https://learn.microsoft.com/en-us/sharepoint/turn-external-sharing-on-or-off)、[Change the default sharing link type](https://learn.microsoft.com/en-us/sharepoint/change-default-sharing-link)
- **Drive 双轨制**：Share 弹窗分「People（直接邀请，可带通知/到期）」与「**General access**（Restricted 默认 / 任何人有链接 / 组织内有链接，各配 viewer/commenter/editor 角色）」两个区域；管理员可把组织默认 General access 锁为 Restricted。[来源：Share files from Google Drive](https://support.google.com/drive/answer/2494822)、[Workspace Admin: general access 默认值](https://knowledge.workspace.google.com/admin/drive/set-general-access-sharing-options-for-your-organization)
- **链接是独立 ACL 实体**：SharePoint 现代 Manage access 面板把「**Direct access**（人/组的显式授权）」与「**Links giving access**（各类链接）」分区展示、分别可撤销——这是链接维度的行业标杆 UI。[来源：Microsoft Support: OneDrive/SharePoint manage sharing](https://support.microsoft.com)、[Front Row Tech 对 Manage access 面板结构的描述](https://frontrowtech.com.au)

### B5 可见性分级（重点）

| 级别 | 语义 | 代表实现 |
|---|---|---|
| L0 完全隐藏 | 搜索（security trimming）、目录、计数中完全不出现 | SharePoint 搜索默认对无权限项安全裁剪，「看不到 = 不存在」；Confluence 无 space view 权限者看不到 space 及其中页面 |
| L1 元数据可见 | 知道存在（标题/锁图标/位置），内容不可读 | **Confluence 受限页出现在搜索/页面树/建议中并带锁图标**，点入被拒；Drive 的 `allowFileDiscovery: true`（domain/anyone 型可经搜索发现）vs false（unlisted，仅链接可达） |
| L2 受限页/申请通道 | 403 页 + Request access 闭环 | Confluence「Request access」→ 邮件给 owner/space admin → 「Grant access」直达授权弹窗（页面级与空间级请求路由到不同审批人，是已知易错点） |
| L2.5 摘要可见原文受限 | 看到摘要/标题+片段，原文受限 | 传统产品基本不提供；随 Copilot 类 AI 摘要正在成为新层级（摘要权限 ≠ 原文权限），业界尚无统一范式——UI 库应预留此态 |
| L3/L4 只读/可编辑 | 常规内容态 | 各家 viewer/editor 角色 |

来源：[Confluence page restrictions（锁图标语义）](https://support.atlassian.com/confluence-cloud/docs/add-or-remove-page-restrictions/)、[Atlassian Community：受限页在搜索/侧栏中的表现](https://community.atlassian.com)、[Drive API: allowFileDiscovery](https://developers.google.com/workspace/drive/api/guides/manage-sharing)、[SharePoint 搜索 security trimming 讨论](https://sharepoint.stackexchange.com)、[Confluence request access 流程](https://support.atlassian.com)、[Microsoft Learn：Limited Access 官方定义](https://learn.microsoft.com/en-us/sharepoint/understanding-permission-levels)

---

## C. Effective Permission 的 UI 呈现（「谁能看到这份文档」+ 原因链）

**SharePoint Check Permissions（行业唯一完整实现）**：经典权限页 ribbon → 输入任意用户/组 → 输出该用户对本对象的全部有效权限级，**每一条都标注来源**："Given through the …"（直接授权 / 某 SharePoint 组 / 某 AD 组 / 经父级继承），一次性回答「谁、经由什么、拿到什么」。[来源：SharePoint Maven: Check user access](https://sharepointmaven.com/how-to-check-user-access-and-permissions-for-a-file/)、[Microsoft Learn troubleshooting](https://learn.microsoft.com)

**各组件形态拆解（可直接映射为 kb 组件族）**：

1. **InheritanceBanner（继承状态条）**——SharePoint 权限页顶部三种状态文案：「inherits permissions from its parent」/ 已断继承 / 「Some items may have unique permissions → Show these items（例外清单弹窗）」+「There are limited access users → Show users」。
2. **StopInheritingButton / RestoreInheritanceButton**——断继承需确认（子项不再跟随父级）；「Delete unique permissions」恢复继承是危险操作（子级自定义权限被清除，且波及断继承的子项、不可恢复）。
3. **GrantDialog**——主体选择器（人/组，含 AD 组；明确拒绝非安全通讯组）+ 权限级选择（默认 Edit，Show options 展开）+ 可选通知邮件 + 文件夹特有的「Share everything in this folder, even items with unique permissions」。
4. **ManageAccessPanel（双区）**——Direct access 区（人/组 + 角色 + 可移除）与 Links giving access 区（链接类型 + 角色 + 到期/密码 + 可止付）；Drive 对应结构是 People 区 + General access 区。
5. **ReasonChainPanel（原因链，kb 库的核心差异化组件）**——推荐结构：

```
张三 对 《2026 财务规划》 的有效权限：可编辑 (Editor)
├─ [继承] 财务部空间 · 成员=Editor        ← 来自空间/库层（inheritedFrom: /finance）
│    └─ 张三 ∈ Google Group "finance-team"（成员 24 人 · 由 IT 管理）
├─ [直接] 李四 单独授予 · Viewer           ← 仅对本文档
└─ [链接] "组织中任何有链接者 · Viewer"     ← 链接维度独立存在
叠加规则：多来源取并集 → Editor；无 Deny 生效
（若存在 Deny：置顶红色行「被策略拒绝：DLP-外发管控」，并集后一票否决）
```

反向场景（「**为什么我看不到它**」）：403 受限页应给出**脱敏原因摘要 + 申请通道**——如「此页面仅对 [产品组] 开放，你不在该组中」+ Request access 按钮（Confluence 范式：请求路由到内容 owner 或 space admin，邮件内 Grant access 直达授权）。注意 Confluence 的教训：**页面级与空间级请求路由不同**是用户最大困惑点，UI 必须明示请求将发给谁。

---

## D. 给 UI 组件库（@icen.ai/ui kb 族）的硬结论

1. **权限 UI 必须能回答「为什么我看不到/能看到它」**：Check Permissions 式的「输入用户 → 有效权限 + 逐条来源链（直接/组/继承/链接）」应是 kb 族的一等组件；只有 SharePoint 做全了，Confluence/Drive 均缺失，这是差异化点。
2. **继承双态都要有一等 affordance**：默认态显示继承 banner（含父链）；断继承是显式危险操作且必须提供「恢复继承」与「例外子项清单」——SharePoint 的 inherit banner / Stop Inheriting / Delete unique permissions / Show these items 四件套是完整范式，缺一不可。
3. **链接与直接授权是两类实体，必须分区呈现、分别可撤销**（Direct access vs Links giving access）；链接控件要承载类型（特定人员/组织内/任何人）× 角色 × 过期 × 密码四个属性，且受管理员策略约束（如 Anyone 链接被禁时应禁用而非隐藏）。
4. **可见性数据模型按 4 级建模并分开渲染**：L0 隐藏（security trimming，搜索/目录/计数均不出现）、L1 元数据可见（锁图标 + 标题，点入被拒）、L2 受限页（403 + 原因摘要 + Request access 闭环，并明示审批人是谁）、L3+ 内容态；另预留「AI 摘要可见、原文受限」的 L2.5 态。搜索结果组件需同时支持「裁剪模式」和「锁图标模式」两种产品策略。
5. **多角色叠加默认并集、显式 Deny 一票否决并置顶警示**；绝不把「减法语义」（Azure NotActions 的教训：减法 ≠ 拒绝，别的来源可再授回）与「拒绝」混在同一控件——减法只属于角色定义编辑器，拒绝属于策略层。
6. **组（group）是组织维度的唯一授权主体**：部门树不要直接当 ACL 用；组 chip 需展示成员数与「由 IT/目录管理」的归属提示（资源 owner 不可编辑其成员）；嵌套组展开结果（一人经多组获得权限）必须在原因链里可展开。
7. **系统自动权限态要作为不可编辑的 system badge**：如 SharePoint Limited Access（item 级授权自动在站点层产生、不可手工创建/删除）——UI 上表现为「系统管理」标签 + 说明文案，避免管理员误删。
8. **受限不是死胡同**：所有 L1/L2 态都要挂 Request access 闭环（请求 → 通知 owner/space admin → Grant access 直达授权弹窗），并明确区分「页面级限制找内容 owner、空间级限制找 space admin」的路由提示——这是 Confluence 十年踩坑总结出的真实需求。

---

## 来源总览

**Microsoft**：[Understanding permission levels](https://learn.microsoft.com/en-us/sharepoint/understanding-permission-levels) · [Customize permissions for a list or library](https://support.microsoft.com/en-us/office/customize-permissions-for-a-sharepoint-list-or-library-02d770f3-59eb-4910-a608-5f84cc297782) · [Manage sharing settings](https://learn.microsoft.com/en-us/sharepoint/turn-external-sharing-on-or-off) · [Change default sharing link type](https://learn.microsoft.com/en-us/sharepoint/change-default-sharing-link) · [Azure deny assignments](https://learn.microsoft.com/en-us/azure/role-based-access-control/deny-assignments-list) · [Microsoft Q&A: Deny on my permissions / Limited Access](https://learn.microsoft.com) · [SharePoint Maven: Check user access](https://sharepointmaven.com/how-to-check-user-access-and-permissions-for-a-file/)
**Google**：[Drive API: manage sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing) · [Share files from Google Drive](https://support.google.com/drive/answer/2494822) · [Share folders](https://support.google.com/drive/answer/7166529) · [Workspace Admin: general access defaults](https://knowledge.workspace.google.com/admin/drive/set-general-access-sharing-options-for-your-organization) · [Workspace Updates Blog（2025-09 权限级联变更）](https://workspaceupdates.googleblog.com) · [Zanzibar 论文](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/)
**Atlassian**：[Page restrictions（Cloud）](https://support.atlassian.com/confluence-cloud/docs/add-or-remove-page-restrictions/) · [Confluence permissions 结构](https://support.atlassian.com) · [Permissions best practices（DC）](https://confluence.atlassian.com/doc/permissions-best-practices) · [Request access 流程](https://support.atlassian.com) · [Community：受限页搜索可见性 / 子页继承](https://community.atlassian.com)
**其他**：[Box: Understanding collaborator permission levels](https://support.box.com/hc/en-us/articles/360044196413-Understanding-Collaborator-Permission-Levels) · [Notion: Sharing & permissions](https://www.notion.com/help/sharing-and-permissions) · [NIST RBAC Model](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=916402) · [NIST CSRC RBAC](https://csrc.nist.gov/projects/role-based-access-control) · [Authzed: What is Zanzibar](https://authzed.com/blog/what-is-zanzibar/) · [Aserto: Drive + Zanzibar 建模](https://www.aserto.com) · [Journey of the Geek: notActions 语义](https://journeyofthegeek.com) · [Front Row Tech: Manage access 面板](https://frontrowtech.com.au) · [SharePoint StackExchange: 搜索裁剪](https://sharepoint.stackexchange.com)

### 报告2：企业级检索/RAG 检索期权限隔离（Secured Retrieval / Security Trimming）调研报告

> 提取自 agent_ec0a2376-5112-497f-8639-75e5adf5b7d7（output.txt），已删除会话导语（「调研完成（共查证 20+ 来源……）」）。

# 企业级检索/RAG 检索期权限隔离（Secured Retrieval / Security Trimming）调研报告

**调研方法说明**：以下事实均经 WebSearch + 官方文档全文抓取（Microsoft Learn、Elastic、AWS、Azure、Qdrant、Weaviate、Pinecone、Glean）与学术论文（arXiv/ACM/IEEE/ICISSP）交叉验证。全文末尾附来源清单。

---

## 0. 关键查证结果：Google「S2: Secured Sentences」论文**无法证实存在**

任务指定的「Google《S2: Secured Sentences》（2025）：per-sentence 加密、推理期过滤不解密」未能找到任何可验证的原始出处。已尝试：arXiv API 精确短语检索（0 命中）、Google/Bing 多轮变体检索（"Secured Sentences" + RAG/encryption/Google Research/Cloud Next）、OpenReview/ACM/Usenix 定向检索、Semantic Scholar（全部无匹配；网络上 "secured sentences" 短语只出现在刑法新闻中）。**结论：该论文很可能不存在、或名称被误记、或未被任何公开索引收录。**

主题上最接近的**真实**工作（可用于支撑同一论点）：
- **Pisces: Cryptography-based Private RAG**（OpenReview, X. Liang et al.）——加密检索 + 安全 LLM 推理，生成加密响应；
- **THOR**（DESILO/汉阳大学，ACM CCS 2025）——FHE 密文上跑 BERT 级推理；
- **SecureRAG: End-to-End Secure RAG**（OpenReview, Bassit et al.）——在强制访问控制的同时缓解 prompt 注入、数据抽取、embedding 泄露；
- **SD-RAG**（arXiv 2026.1）——RAG 中的选择性披露（Selective Disclosure）。

「S2」构想的核心启发——**权限判定发生在密文上、解密只发生在授权之后**——在现实系统中的对应物就是 query-time pre-filter：未授权内容从进入索引层的第一跳起就对请求身份不可见，而非「可见后再隐藏」。本报告其余部分以可验证的真实系统与论文为据。

---

## A) 检索期权限隔离的分层模型

| 层 | 做什么 | 谁在做 | 安全性质 |
|---|---|---|---|
| **Index-time**（索引期） | 摄取文档 + 摄取 ACL（不判定权限，只准备判定条件） | Kendra `Principal`/`AccessControlList`；Glean connector 镜像源系统 ACL；Azure `group_ids` 字段；ES 角色绑定 DLS query 定义 | **不是安全边界**，是前置数据准备。决定了「能不能裁得动」 |
| **Query-time pre-filter**（查询期前置过滤） | 把请求身份（用户/组 token）编译为过滤器，**在检索执行内部**生效 | Azure `search.in` filter；ES DLS 透明合并进每次 read；Kendra `UserContext`；Glean 每次读/写都按源系统权限执行；Weaviate/Qdrant/Pinecone filtered search | **唯一的安全黄金标准**。未授权内容从未成为候选 |
| **Query-time post-filter**（取回 top-k 后再过滤） | 先 ANN/检索拿 top-k，再按 ACL 丢弃 | 任何自研「检索后过滤」管线 | **不安全**：未授权内容已离开索引层（进过日志、重排器、缓存）；且 top-k 会不足额。Qdrant 的 filterable-HNSW 文章明确批评此法 |
| **Generation-time**（生成期） | LLM 已在上下文中看到文档，生成后再审查/过滤输出 | 输出审查、生成后 ACL 检查 | **不是安全边界**：paraphrase 即泄露（见 B-3）；MIA 研究证明输出会 echo 检索库内容 |
| **Presentation-time**（展示期） | UI 层隐藏条目/过滤引用/裁剪计数 | 前端过滤 | **最弱**：防不住已进入答案的内容，且制造引用/答案不一致（见 B-4） |

**各厂商实证：**

- **Elasticsearch DLS**（官方文档，已全文抓取）：角色 query 与 `read` 权限结合，「**不匹配角色 query 的文档永远不会被返回**」；多角色取并集（OR）；支持 `{{_user.username}}` 模板化把用户属性注入过滤器。**关键细节**：官方明示 DLS 下「scoring 使用全局索引统计、忽略角色 query」——刻意让分数不携带受限子集信息（见 B-2）；同时警告**聚合仍可能泄露**（见 B-6）。
- **Azure AI Search 安全过滤模式**（官方文档，已全文抓取）：文档带 `group_ids: Collection(Edm.String)`（`filterable:true`、`retrievable:false`），查询时注入 `filter: group_ids/any(g: search.in(g, 'group_id1, group_id2'))`，**服务端在返回前裁剪**。官方特别警告：`retrievable:false` 不是字段级安全，**「文档级授权靠对每一条查询施加 security filter 来强制」**——漏一条查询就裸奔。2025 年新增 Entra 内建 ACL：加用户 token 即自动裁剪，SDK 调用不变。
- **Amazon Kendra**（官方文档，已全文抓取）：索引期摄取 ACL（ALLOW/DENY 的 USER/GROUP `Principal`，每文档最多 200 条）；查询期通过 `UserContext`（token 或 UserId+Groups）过滤，**「只返回该用户有权限访问的文档」**。**两条高危事实**：(1) **「若查询未携带 user context，Kendra 返回所有文档」——fail-open**；(2) 官方声明「user context filtering 不是认证/鉴权控制，不校验传入 Query API 的用户组信息，应用层须自行保证其真实」——即身份注入若被伪造，过滤形同虚设。另提供 `CreateAccessControlConfiguration` 在不重建索引的情况下快速改 ACL（应对离职/转岗的权限撤销滞后）。
- **Microsoft SharePoint / Graph Search**：security trimming 内建且**不可禁用**（SharePoint Maven：「You cannot disable Search security trimming」）；Microsoft Learn Q&A 官方口径：「Search has security trimming; if the users have no access to the content, no results will be returned」。Graph Search API（delegated 身份）结果自动按用户权限裁剪；但应用身份（如 `Sites.Selected`）有已知的裁剪不符合预期的讨论。
- **Microsoft 365 Copilot / Semantic Index**：官方确认 grounding 是 **permission-trimmed** 的——Copilot 只能基于用户已有权限的内容作答；社区有权限收紧后仍短暂可用的缓存/传播延迟报告（见 B-7）。
- **Glean**（官方 security 页 + 第三方分析）：索引侧 connector 持续同步源系统 ACL/组成员/分享规则到统一数据模型；查询侧官方表述为「**Enforce source-system permissions on every read and write**」、SSO 先验证用户与 agent 身份、「agent 不应自动继承用户全部权限」；第三方（Knostic）确认其 ACL 在 index 与 query 两侧同时生效，并指出它忠实镜像源 ACL 但无法修复源系统的 oversharing（Glean 因此提供 oversharing 文档隐藏的管理员治理功能）。
- **向量库的 filtered search 语义（ACL 作为 metadata filter）**：
  - **Weaviate**：先由倒排索引（bitmap 加速）按 where-filter 求出「允许集」，再按集合大小自适应：候选集大→在允许集上跑 HNSW（遍历被剪枝到允许节点）；过滤器高选择性→**退化为对允许集的暴力扫描，保证 100% recall**。limit 作用于过滤后的最终集合。
  - **Qdrant**：filter 是请求的一部分，返回结果即满足 filter；官方 filterable-HNSW 文章从渗流理论（临界阈值 pc=1/⟨k⟩）解释了为什么先检索后过滤会碎图/掉召回，其方案是在图遍历中只用满足过滤的节点（payload 索引 + 额外 HNSW 边），标签交集过小则转线性扫描。
  - **Pinecone**：官方论文《Accurate and Efficient Metadata Filtering in Pinecone's Serverless Vector Database》明确过滤**「整合进向量检索过程本身」而非事后过滤**，高选择性 filter 下仍保持高准确率。

**混合检索（BM25+向量）的坑**：混合检索是两条独立检索腿 + RRF 融合。若 ACL filter 只加在向量腿，BM25 命中的未授权文档会经 RRF 融合直接泄露——真实修复案例见 knowledge-rag 的变更记录（「hybrid search 现把过滤在 RRF 融合**之前**同时作用于 BM25 结果，防止其他类目的纯关键词命中泄露」）。另注意 ES DLS 的角落语义：suggester 被忽略、profiling 被禁、terms enum 返回空——**各检索通道对同一权限模型的覆盖不一致本身就是泄露面**。

---

## B) 上下文泄露攻击面清单与防御

| # | 攻击面 | 机制 | 证据 | 防御 |
|---|---|---|---|---|
| 1 | **计数泄露** | 「找到 8 条」但只显示 5 条 → 未授权者推断隐藏内容存在；反复探测不同 query 的结果数可重构隐藏语料 | Cash et al.《Leakage-Abuse Attacks Against Searchable Encryption》(ACM, ~915 引用)：唯一结果数即可重构加密数据；《Practical Volume-Based Attacks on Encrypted Databases》(arXiv)：「result count leakage is difficult to eradicate completely」；**ES 官方 DLS 文档自己警告**：受限用户可经聚合「得知只存在于不可访问文档中的字段名与词项」 | UI 永远只显示**裁剪后的安全计数**；绝不暴露裁剪前总数或差值；确需模糊提示时做计数取整/padding（SEAL/SPARTA 的 ADJ-PADDING：向上取整到 x 的幂） |
| 2 | **分数/排序泄露** | 相似度分数或排序缺口暗示紧邻处有被过滤文档；BM25 分数若用未裁剪语料统计会编码受限文档信息 | ES DLS 官方行为：**「scoring uses global index stats, ignoring the role query」**——刻意让分数不反映受限子集 | 分数只在裁剪后集合内计算/展示；不显示未裁剪排名与 gap；UI 不暴露「第 N 名之后有断层」 |
| 3 | **摘要泄露** | 文档已进 LLM 上下文，生成时被 paraphrase——post-filter 防不住 | Anderson et al.（arXiv 2405.20446, ICISSP 2025）：RAG 输出会 echo 检索库内容，是 MIA 的直接通道；业界共识「authorization must occur before retrieval」（M365.FM/Control Core 等） | 权限过滤必须在进入 prompt 之前（query-time pre-filter）；生成期审查只能算纵深防御，不是边界 |
| 4 | **引用泄露（citation leak）** | LLM 在上下文见过未授权文档并引用它，前端再把引用过滤掉 → 答案内容与引用列表**前后不一致**，用户可感知「有被藏起来的来源」；更糟的是不过滤引用则直接给出未授权文档指针 | tianpan.co 定义 **permission leak rate** 指标 =「答案引用了请求用户当前无权检索的 chunk 的比例」；RapidFlare 提出 per-source permission split（agent 有检索权、用户永不知来源）；qaskills 测试指南要求以测试身份验证每条引用可达 | 引用/grounding 只能从**已裁剪的检索集合**白名单生成；把 citation-permission consistency 纳入回归测试指标 |
| 5 | **Membership inference / oracle attack** | 攻击者构造 prompt 探测某文本是否在知识库中（把检索系统当 oracle） | Anderson et al.（黑盒/灰盒、多模型、多数据集成功）；《Generating Is Believing》(IEEE 2025)；BudgetLeak（黑盒+预算约束）；Mask-based MIA (ACM)；MrMr（多模态，AAAI） | 检索层 ACL（论文将 access control 列为第一道防线）；不逐字回显原文；Choi et al. (ACL 2025) 的防御研究；论文自证的初步缓解——在 RAG 模板加输出约束指令（仅部分数据集有效） |
| 6 | **聚合/facet 泄露** | facet、直方图、`total_hits`、拼写建议等旁路通道绕过结果过滤 | ES 官方 DLS 警告（见 #1）；DLS 下 suggester 被忽略、terms enum 返回空——官方用「关闭功能」的方式堵旁路 | 所有衍生统计（计数、facet、聚合、suggest）一律基于裁剪后集合；无解的旁路功能直接禁用 |
| 7 | **权限撤销滞后（时序泄露）** | 权限被收回后索引 ACL 未同步，旧 ACL 仍放行；缓存/传播延迟窗口 | Copilot 社区报告权限收紧后内容仍短暂可见；向量索引 read-after-write 竞态（tianpan.co）；Kendra 专门提供 `CreateAccessControlConfiguration` 免重建索引快速改 ACL | ACL 增量同步 + 撤销快速通道；UI 标注 ACL 快照时间；把「权限变更→索引生效」延迟作为 SLA 指标 |
| 8 | **Fail-open / 身份伪造** | 查询不带身份 → 不过滤返回全部；或身份由客户端自报（伪造组列表） | **Kendra 官方文档两处明示**：无 UserContext 返回所有文档；且不校验 UserContext 真实性 | 默认拒绝：无身份的查询直接报错；身份只来自服务端验证的 token（如 Azure Entra token、Kendra token 模式），禁止客户端明文传组列表 |

---

## C) 「部分结果被权限裁剪」的 UI 呈现：业界做法

| 产品 | 呈现方式 | 来源 |
|---|---|---|
| **SharePoint / Microsoft Search** | **完全静默**。裁剪不可禁用、无任何「有结果被隐藏」提示；无权限=直接看不到（官方 Q&A：「no results will be returned」）。不同用户结果不同，但每个用户看到的都像完整世界 | Microsoft Learn Q&A；SharePoint Maven；getsharepoint |
| **Microsoft 365 Copilot** | **完全静默**，permission-trimmed grounding，答案只基于用户有权内容 | MS Tech Community（Semantic Index for Copilot） |
| **Glean** | 公开文档与帮助中心**未见任何「部分结果已按权限隐藏」横幅**；其产品设计前提是「你看到的=你有权访问的全部」，因此无需提示。另有管理员侧的 oversharing 治理（隐藏过度分享文档）而非终端用户提示 | glean.com/security；docs.glean.com；社区检索无横幅证据 |
| **Bing / 网页搜索** | 存在「Some results have been removed」提示，但属**法律删除/被遗忘权**场景，**不是权限裁剪**——说明「提示存在被移除结果」是可接受的产品形态，但它的信息量（存在性提示）恰好是权限场景要防的泄露 | van Hoboken (UvA) 学术研究援引 Bing 帮助页 |
| **Elastic（DLS）** | 面向管理员的文档明确警示聚合泄露风险——即官方立场是**不要向受限用户暴露未裁剪世界的任何统计** | ES DLS 官方文档 |
| **Amazon Kendra** | API 层无任何「被裁剪数量」字段返回；裁剪是纯服务端语义 | Kendra 官方文档 |

**频谱总结（泄露量递增）**：
1. **完全不提示（业界默认）**——SharePoint/Copilot/Glean/Kendra。防计数泄露最彻底；代价是用户可能误以为「没搜到=不存在」。
2. **只提示存在**（「部分结果因权限不可见」固定文案，不带数量、不带条件）——透明度较好，泄露的只是「存在某种受限匹配」这一恒定事实（攻击者从恒定提示中得到的信息增量为零，前提是提示与命中无关恒显示或恒不显示）。
3. **提示数量**（「8 条中的 5 条」）——**等于直接送出泄露计数**，是 searchable-encryption 文献中 volume leakage 的教科书场景，应禁止；确需缓解时用 padding/取整（ADJ-PADDING）。

---

## D) 给检索 Playground UI 的硬结论

1. **参数面板必须显式展示 ACL filter 状态**：以哪個身份（user OID）、哪些组、filter 表达式摘要（如 Azure 的 `group_ids/any(g: search.in(...))`）随每条查询发出，并标注 `server-side trimming: ON`。**未启用权限过滤的查询必须打醒目警告**——Kendra 的 fail-open（无 UserContext 返回全部文档）证明这条不是可选项；同理，身份必须来自服务端验证的 token，不接受 playground 输入框手填组名（Kendra 明示不校验自报身份）。
2. **命中数必须是裁剪后的安全计数**：total、每页计数、facet 计数、直方图、`total_hits` 全部基于裁剪后集合（ES 官方对聚合泄露的警告 + volume-based attacks 的结论）。**永远不显示「总数 vs 可见数」之差**，分页不得按裁剪前总数计算。
3. **引用只能来自裁剪后的检索集合**（citation whitelist）；把 **permission leak rate**（答案引用了用户无权 chunk 的比例）作为 playground 的常驻 QA 指标。禁止「LLM 见过、UI 过滤引用」的模式——那只会制造可感知的不一致泄露。
4. **混合检索视图要分腿展示过滤状态**：BM25 腿与向量腿各自标注是否携带同一 ACL filter（knowledge-rag 的真实泄露案例证明只过滤向量腿必漏）；重排器（reranker）输入也必须是融合后已过滤的集合。
5. **分数展示只取裁剪后集合内的相对值**：不显示未裁剪排名、名次断层、或基于全库统计的绝对分（对齐 ES「DLS 下 scoring 用全局统计」的动机）。
6. **「显示被裁剪结果」的调试开关只对管理员/审计角色开放且默认关闭**：否则 playground 自身就成了 membership-inference oracle（Anderson et al. 证明精心构造的查询 + 输出观察能判定库成员身份）。
7. **展示 ACL 新鲜度**：UI 显示索引 ACL 同步时间戳与身份解析时间；权限撤销后提供「强制重同步」入口（对应撤销滞后/竞态泄露）。
8. **若产品决定做「存在性提示」，只能用与命中无关的恒定文案**，绝不带数量、绝不带条件分支。

---

## 来源清单

**官方文档（全文抓取）**
1. [Elasticsearch Document Level Security](https://www.elastic.co/guide/en/elasticsearch/reference/current/document-level-security.html) — 含聚合泄露警告、全局统计打分、多角色 OR
2. [Azure AI Search Security Filter Pattern](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search) — `search.in` 过滤、`retrievable:false` 非安全机制警告
3. [Amazon Kendra Filtering on user context](https://docs.aws.amazon.com/kendra/latest/dg/user-context-filter.html) — ACL 摄取、UserContext、**无上下文返回全部文档**、不校验自报身份
4. [Qdrant Filtering](https://qdrant.tech/documentation/concepts/filtering/) 与 [Qdrant Filterable HNSW](https://qdrant.tech/articles/filterable-hnsw/) — 遍历中过滤、渗流阈值、post-filter 批评
5. [Weaviate Filters](https://docs.weaviate.io/weaviate/search/filters) 及 [vector-search 概念](https://docs.weaviate.io/weaviate/concepts/search/vector-search) — 允许集 + 自适应暴力扫描
6. [Microsoft Graph Search API overview](https://learn.microsoft.com/en-us/graph/search-concept-overview) 与 [Microsoft Learn Q&A（security trimming）](https://learn.microsoft.com/en-us/answers/) — 无权限即无结果、裁剪不可禁用（另见 [SharePoint Maven](https://www.sharepointmaven.com)、[Practical 365](https://practical365.com)）
7. [Glean Security](https://www.glean.com/security) —「Enforce source-system permissions on every read and write」（另见 [Knostic](https://www.knostic.ai)、[docs.glean.com](https://docs.glean.com)）

**厂商工程实践**
8. [Microsoft Entra access control for Azure AI Search](https://techcommunity.microsoft.com) — token 内建裁剪
9. [Microsoft 365 Copilot / Semantic Index（permission-trimmed grounding）](https://techcommunity.microsoft.com)
10. [Pinecone《Accurate and Efficient Metadata Filtering in Serverless Vector DB》](https://www.pinecone.io)（另见 [docs.pinecone.io](https://docs.pinecone.io)）
11. [knowledge-rag 变更记录（BM25 腿过滤修复）](https://pypi.org)
12. [ntit.ai《RAG Security Trimming》](https://ntit.ai)、[rubberduckdev.com Secure RAG with Azure AI Search](https://rubberduckdev.com)、[Tencent Cloud 企业 AI 检索访问控制](https://intl.cloud.tencent.com)

**学术/攻击研究**
13. [Anderson, Amit, Goldsteen — Is My Data in Your Retrieval Database? MIA Against RAG](https://arxiv.org/abs/2405.20446)（ICISSP 2025）
14. [Cash et al. — Leakage-Abuse Attacks Against Searchable Encryption (ACM 2015)](https://dl.acm.org)
15. [Practical Volume-Based Attacks on Encrypted Databases](https://arxiv.org)；[Why Your Encrypted Database Is Not Secure (IACR ePrint)](https://eprint.iacr.org)；[SEAL/SPARTA ADJ-PADDING](https://www.zekemilay.com)
16. [Generating Is Believing: MIA Against RAG (IEEE 2025)](https://ieeexplore.ieee.org)；[BudgetLeak](https://arxiv.org)；[Mask-based MIA (ACM)](https://dl.acm.org)；[Choi et al. 防御 (ACL 2025)](https://aclanthology.org)
17. [Pisces: Cryptography-based Private RAG](https://openreview.net)；[SecureRAG](https://openreview.net)；[THOR (CCS 2025)](https://desilo.ai)；[SD-RAG](https://arxiv.org)

**引用泄露与呈现**
18. [tianpan.co — permission leak rate / read-after-write race](https://tianpan.co)
19. [RapidFlare — per-source permission split](https://blog.rapidflare.ai)；[qaskills RAG QA 指南](https://qaskills.sh)
20. [van Hoboken (UvA) — Bing "results have been removed" 提示研究](https://pure.uva.nl)

**重要更正**：任务前提中的 Google《S2: Secured Sentences》论文经多渠道查证不存在于任何公开索引，报告中已用可验证的同类工作（Pisces/THOR/SecureRAG）替代支撑相应论点。

### 报告3：权限状态在知识库/搜索/文档 UI 上的呈现与访问流程——调研报告

> 提取自 agent_ea40940e-e66d-4d60-8316-c5f6cadcf697（output.txt），已删除会话导语（「调研完成。以下为最终报告。」）。

# 权限状态在知识库/搜索/文档 UI 上的呈现与访问流程——调研报告

> 调研对象：Google Drive/Workspace、Microsoft SharePoint/M365（Purview）、Atlassian Confluence/Jira、Notion、Figma、Box、Glean、Cloudflare 内部数据平台（Town Lake）。共查证 20+ 来源。

## A) 权限状态 → UI 呈现映射表

### A1. 搜索结果中的受限条目（不可见状态的呈现）

| 状态 | UI 呈现 | 代表产品 | 来源 |
|---|---|---|---|
| 完全无权限（主流默认） | **条目彻底不出现在搜索结果中**（security trimming，无任何痕迹） | SharePoint 搜索、Glean、Confluence（无查看权页面不进索引结果） | [Security Trimming and REST](https://sharepoint.sureshc.com)、[beri.net: Buy the Permission Model](https://www.beri.net)（引 Glean 文档："If a user can't open a document in the source system, that document can't be used as context"）、[Atlassian Community](https://community.atlassian.com) |
| 有权限但页面受限 | **锁图标徽章**（页面右上角/编辑器工具栏的 lock，点击可查看/修改 View/Edit restrictions；锁信息对有查看权的用户可见） | Confluence（页面锁图标，View restriction + Edit restriction 两层） | [Confluence DC 10.2 Page restrictions](https://confluence.atlassian.com)、[resumelens: Permissions vs Restrictions](https://www.resumelens.org)、[Atlassian Community](https://community.atlassian.com) |
| 出现但点开被拒（异常态） | 结果可见但点开跳 Access Denied（索引滞后/裁剪失效时） | SharePoint（索引延迟时出现 "you don't have access"） | [Microsoft Q&A](https://learn.microsoft.com)、[Restricted SharePoint Search 公告](https://techcommunity.microsoft.com) |
| 元数据可见 + 内容不可见（目录类产品） | **表/文档名可见、schema 可见，但数据列隐藏/打码**；拒绝文案可操作："this table needs review, click here to request one"，AI 助手直接推荐应申请的 RBAC 组并给深链 | Cloudflare Town Lake（表清单可见、未审核列从 `SELECT *` 隐藏、PII 列默认 redacted、按会话解锁且全程留痕） | [Cloudflare: Our Unified Data Platform](https://blog.cloudflare.com/our-unified-data-platform/) |
| AI 摘要/引用中的越权内容 | **引用不指向无权源**；权限被撤后历史引用可能残留（需处理的历史态） | Glean（citations 不引用无权源，但 revoke 后历史仍在） | [Glean Docs: Citations](https://docs.glean.com) |

**取舍结论**：文档类产品（Drive/SP/Confluence/Glean）统一选择「彻底隐藏」，因为展示标题/摘要即泄露元数据；只有**数据目录/数据平台**类产品选择「schema 可见、数据不可见」，因为「知道有什么表」本身是刚需。

### A2. 文档查看器 Access Denied 页结构

| 产品 | 页面构成 | 来源 |
|---|---|---|
| Google Drive | 文件名 + 「You need access」+ owner 姓名/邮箱 + **Request access 按钮**（附可选留言）+ **切换账号**入口 | [Google Drive Help](https://support.google.com/drive/thread/232501656/how-to-set-an-expiration-date-for-files-in-shared-drive?hl=en)、[Drive 有限访问说明](https://support.google.com/drive/answer/12315692?hl=en) |
| Notion | 页面内显示权限状态 **「No access」chip——状态标签本身即请求入口**，点击即向页面 creators/editors 发请求；owner 在 Inbox 中 accept/deny | [Notion: Sharing & permissions](https://www.notion.com/help/sharing-and-permissions)（已全文抓取） |
| Figma | 「You don't have access to this file」+ Request access 按钮 → 通知 owner 授予 view/edit | [Figma Help](https://help.figma.com)、[Figma Forum](https://forum.figma.com) |
| SharePoint | 站点被拒页 → 「request access」表单页（留言框 + 站点 owner 自定义欢迎语），提交后邮件给 owner | [MS Support: Set up and manage access requests](https://support.microsoft.com/en-us/office/set-up-and-manage-access-requests-94b26e0b-2822-49d4-929a-8455698654b3)（已全文抓取） |

**共性结构**：`说明（你为何看不到）+ 资源标识（文件名）+ 责任人（owner）+ 主动作（申请）+ 次动作（切换账号/联系方式）`。Google 的「切换账号」是独特且高频必要的兜底（多账号场景是被拒第一大原因）。

### A3. 打码/遮蔽（redaction）呈现

| 呈现方式 | 适用场景 | 来源 |
|---|---|---|
| 列级 redacted 默认值 + 会话级解锁开关（解锁后所有查询留痕） | 数据平台 PII 列 | [Cloudflare Town Lake](https://blog.cloudflare.com/our-unified-data-platform/) |
| 「未审核列」从 schema/查询中直接隐藏（而非打码）——避免未审列破坏已有看板 | 数据目录 | 同上 |
| 摘要中不引用（引用必须可点开） | AI 搜索答案 | [Glean Citations](https://docs.glean.com) |
| 文字打码条（黑色矩形） | 业界主流文档 UI **均未采用**——文档产品要么显示要么隐藏，无中间态 | （本次调研未见任何文档产品使用，属数据/截图类产品惯用） |

## B) 申请访问（Request Access）全流程状态机

```
┌─────────────┐   点击受限条目/链接   ┌──────────────────┐
│  可发现      │ ──────────────────> │  AccessDeniedPage │
│ (裁剪/锁标)  │                     └────────┬─────────┘
└─────────────┘                              │ 申请
                                             v
                                  ┌─────────────────────┐
                                  │ RequestForm          │
                                  │ · 留言(可选)          │
                                  │ · 角色选择(部分产品)    │
                                  └────────┬────────────┘
                                           v
        ┌────────── PENDING ──────────┐              │
        │ 请求方: 按钮变 inert「已请求」 │   审批方:      │
        │ (Drive 无官方 pending 页;    │   · Drive: Share 按钮红点
        │  Atlassian 2026 新增「查看    │     + 文件内直接批准/拒绝
        │  pending 状态」按钮)          │   · SharePoint: Access requests
        └───────┬──────────────┬──────┘     队列(ellipsis 菜单)
           批准 │           拒绝 │
                v                v
        ┌──────────────┐  ┌──────────────┐
        │ GRANTED      │  │ DECLINED     │
        │ · 角色+可选中 │  │ · 主流做法: 静默
        │   过期时间    │  │   不通知请求方
        │ · 通知+解锁   │  │   (SP 可附留言)│
        └────────┬───────┘  └──────────────┘
               │ 到期
               v
        ┌──────────────┐
        │ EXPIRED      │
        │ 权限回退(父级 │
        │ 权限/移除)    │
        └────────┬──────┘
               │ 重新申请(re-request)
               └──────> RequestForm
```

**各态 UI 事实（按产品）**

- **RequestForm 字段**：Google 的 access proposal 数据结构 = requester + recipient + message + **多组 role/view 对**（reader/commenter/writer 可同时请求，批准时取最高权限）（[Drive API: pending access proposals](https://developers.google.com/workspace/drive/api/guides/pending-access)，已全文抓取）。SharePoint 请求页含 owner 预设的自定义说明文案（[MS Support](https://support.microsoft.com/en-us/office/set-up-and-manage-access-requests-94b26e0b-2822-49d4-929a-8455698654b3)）。2024 年起 Google 允许审批方在 Chat 中直接选 viewer/commenter/editor 授予（[Workspace Updates 2024/11](https://workspaceupdates.googleblog.com/2024/11/auto-installed-google-drive-chat-app.html)）。
- **PENDING（审批方）**：Drive 2023/06 起 Share 按钮出现**通知红点**，可在文件内响应，不必依赖邮件（[Workspace Updates 2023/06](https://workspaceupdates.googleblog.com/2023/06/respond-to-access-requests-for-google-workspace-files-efficiently.html)）；SharePoint 在 Settings → Site contents → **Access requests** 出现待办按钮（仅当有 pending 时显示），队列内 ellipsis 菜单 → 选权限级别 → Approve/Decline；**Show History 查看历史请求**（含被拒记录）。Notion owner 在 **Inbox** 中看到请求并 accept/deny（[Notion Help](https://www.notion.com/help/sharing-and-permissions)）。
- **PENDING（请求方）**：Drive 官方无 pending 状态页，按钮提交后变为不可再提交的「已请求」态（论坛佐证，非官方文档）；**Atlassian 2026/08 宣布新增「查看 pending 请求状态」按钮**——请求方状态可见性正在成为新趋势。
- **DECLINED**：行业事实是**请求方几乎不收到明确拒绝通知**。Drive 的 decline 只是移除请求；SharePoint 可附留言拒绝；Confluence/Notion 可静默忽略。唯一显式「过期态」是 SharePoint 外部邀请 90 天过期（重发不延长）。
- **Time-boxed access（临时访问）**：
  - Google Drive：分享面板中人名旁 down-arrow → **Add expiration → 「Access expires」日期选择**（≤1 年，仅 Viewer/Commenter/Editor）；2025/11 起**到期 Editor 回退到其在父文件夹的权限**而非降为 Viewer（[Drive Help: Stop/limit/change sharing](https://support.google.com/drive/answer/2494893?hl=en)、[Workspace Updates 2025/11](https://workspaceupdates.googleblog.com)）。
  - Box：链接设置中日历控件设 per-link 过期；管理员可强制**自动过期策略**（最长天数）与**受邀协作者过期**（[Box Docs: Securing shared links](https://docs.box.com/en/box-fundamentals/for-users/collaborating/using-shared-links/securing-shared-links)、[Enterprise Settings](https://docs.box.com/en/box-admin-tools/box-admin-reference/enterprise-settings-content-sharing-tab)）。
  - SharePoint：链接级「Set expiration date」（[Handsontek](https://m365admin.handsontek.net)）。
  - Cloudflare：访问**默认 time-bounded**，「权限随工作结束而过期」。
  - **到期前提醒普遍是邮件而非产品内 UI**——这是业界空缺点。

## C) Admin 视角三件套的业界做法

### C1. View-as / Check Permissions（以某用户视角预览）

| 产品 | 交互 | 输出 | 来源 |
|---|---|---|---|
| SharePoint | Site Settings → Advanced Permissions → **Check Permissions**：输入任意用户 | 该用户对此站点/项的**有效权限级别**（Full Control/Edit/Read/Limited Access）+ 原因清单（直接授权、SharePoint 组、继承、sharing link） | [Technisaur: Advanced SharePoint Permissions](https://technisaur.com.au) |
| Confluence DC 8.2+ | Space Settings → **Inspect permissions**：输入用户名 | 空间权限 + 页面限制 + 组归属，判定 View/Edit 能否 | [Atlassian: Check who can view a page](https://confluence.atlassian.com) |
| Jira（同厂范式） | Admin → **Permission Helper**：用户 × 权限 × 项目/Issue | **Yes/No + 「because」原因**（项目角色/组/全局权限）；已知盲区：issue security 与 workflow 条件不覆盖 | [Skillbuilder 资料](https://www.scribd.com)、[ones.com](https://ones.com) |

**关键发现**：Confluence 的 Inspect permissions 被官方 feature request 指出**只给结论不给原因链**（无法指出是哪条父级限制导致结果）（[jira.atlassian.com](https://jira.atlassian.com)）——即「原因链」是业界公认的难点与缺口。

### C2. Effective permission 原因链展示

- **有原因链 UI 的仅两家**：SharePoint Check Permissions（列出「经由组 X / 经由链接 Y / 继承自父级」的授权来源清单）与 Jira Permission Helper（"Yes, because…"）。Google Drive 只显示「与组共享」的 group chip，展开成员受 Groups「who can view members」权限约束（[Groups 设置](https://support.google.com/a/users/answer/10376887?hl=en)），无继承链。
- 共享驱动器（shared drive）的继承语义是「成员见全部文件，权限随成员角色」——Drive 把继承**简化成容器成员制**，回避了链式展示（[How file access works in shared drives](https://support.google.com/a/users/answer/12380484?hl=en)）。
- 结论：业界呈现方式为「**扁平的原因清单（badge 列表）**」而非完整树；完整树没有产品做出来。

### C3. 权限审计 / 访问日志 UI 结构

| 产品 | 结构 | 来源 |
|---|---|---|
| Box Admin Console → Reports → **User Activity Report** | 过滤维度：用户/组 × 文件/文件夹 × 事件类型（preview/download/upload）→ **CSV 导出**；另有 Shared Links Report（含过期时间 UTC） | [Box Docs: User Activity Report](https://docs.box.com) |
| Microsoft **Purview Audit**（purview.microsoft.com/audit） | 日期范围 + Activities 过滤（**FileAccessed 与 FilePreviewed 是两个独立事件**）+ 用户/文件/URL 过滤 → 结果含用户、IP、时间戳 → 导出 CSV | [MS Learn: Audit log activities](https://learn.microsoft.com/en-us/purview/audit-log-activities)、[SharePoint Diary 教程](https://www.sharepointdiary.com/2019/09/sharepoint-online-search-audit-logs-in-security-compliance-center.html) |
| SharePoint 访问请求历史 | Access requests 页 **Show History**（谁请求过/批准/拒绝） | [MS Support](https://support.microsoft.com/en-us/office/set-up-and-manage-access-requests-94b26e0b-2822-49d4-929a-8455698654b3) |
| **主动式**：oversharing 治理 | SharePoint Advanced Management **oversharing dashboard**（标记 "shared with too many people" 站点）+ DAG 报告 + 站点 owner 的 access review/attestation 推送 | [VisualSP](https://www.visualsp.com)、[Rencore](https://rencore.com) |

**共性骨架**：`过滤器（人/资源/动作/时间）+ 事件时间线 + 导出`；进阶形态是「从被动查日志 → 主动推送超额共享告警给 owner 复核」。

## D) 给组件库的硬结论

### 值得做成组件（有 3 家以上验证的范式）

1. **`AccessDeniedPage`（被拒页）**——五件套结构已被 Drive/Figma/Notion/SP 共同验证：资源名 + 原因说明 + owner 身份 + 申请按钮 + 切换账号/联系方式。这是优先级最高的组件。
2. **`AccessRequestDialog`（申请弹窗）**——留言 + 角色选择（Google 数据结构支持多角色请求，取最高获批）；与被拒页组成同一 flow。
3. **`AccessRequestsQueue`（审批方收件箱）**——待办入口（仅在有 pending 时出现，SP/Drive 红点范式）+ 请求卡片（请求人/留言/角色/时间）+ ellipsis 菜单（选权限级别 → 批准/拒绝）+ 历史记录（Show History）。Drive、SP、Notion Inbox 三家同构。
4. **`PermissionChip` 徽章族**——`restricted`（锁）、`pending`（已请求，Atlassian 2026 新增范式）、`expiring`（"Access expires on 2026-11-01"，Drive 文案）。合并为一个组件的三个 variant，**不拆分**。
5. **`ShareScopeSelector`（分享范围选择器）**——范围（specific people / 组织内 / anyone / 已有权限者，Google 与 Microsoft 选项集几乎一一对应）× 角色（viewer/commenter/editor）× 链接设置（过期日、密码）。附**组展开**（group chip → 成员列表，须处理「成员不可见」受限态，受 group 设置约束）。
6. **`EffectivePermissionPanel`（view-as 面板）**——用户选择器（combobox）→ 有效权限结论 + **扁平原因清单**（「经由组 X（继承自 Y）」badge 列表，SP/Jira 范式）。做成渐进披露列表，**不做完整树**。
7. **`PermissionAuditLog`**——过滤器（人/资源/动作/时间）+ 时间线 + 导出按钮，以 Box/Purview 为骨架；预留「preview 与 view 分列为两个事件」的设计（微软明确区分 FilePreviewed/FileAccessed）。

### 合并

- 被拒页 + 申请弹窗 = 一个 `RequestAccessFlow`（page → dialog → pending chip 的闭环）。
- `RestrictedBadge` / `PendingChip` / `ExpiryBadge` 合并为 `PermissionChip` 家族（上文已述）。
- 审批队列与分享面板共享 `RequestReviewCard`（Drive 把两者合并进 Share 按钮红点）。

### 不做 / 慎做

1. **「无权条目仍显示元数据」的搜索结果行**——主流文档/搜索产品（SP/Glean/Confluence/Drive）全部选择彻底隐藏；该模式仅存在于数据目录类产品（Cloudflare），且依赖「审核中」这一中间状态。组件库若做，应限定命名（如 `CatalogRestrictedItem`）并显式警示元数据泄露风险。
2. **显式「被拒绝」红色终态**——没有主流产品通知请求方被拒（静默是行业默契，避免社交压力）；组件最多提供「请求已过期，可重新申请」的中性态。
3. **摘要文字打码条**——文档类产品无先例（要么显示要么隐藏），打码只属于数据列/PII 场景；不建议进通用文档组件库。
4. **完整原因链树**——仅两家有扁平清单，无产品做成树；Confluence 官方 feature request 证明连他们都没做好。降级为清单。
5. **数据驻留提示**——主流产品仅 admin console 层面体现（Box Zones、M365 Multi-Geo），终端用户权限 UI 无此惯例，不建议纳入组件库（本次未找到用户侧先例）。

### 值得抄的具体细节

- Notion：**权限状态 chip 即请求入口**（点 "No access" 直接发请求）——把状态与动作合一的最省空间范式。
- Google：Share 按钮红点 = pending 数量入口；access expires 的 per-person 到期（人名旁 down-arrow）。
- SharePoint：Access requests 入口**只在有 pending 时出现**；外部邀请的 90 天过期重置规则。
- Cloudflare：拒绝文案永远带下一步动作（"click here to request one" + AI 推荐应申请的组）——「拒绝即引导」是最佳文案范式。
- Glean：权限撤销后**历史中的引用残留**——组件库的 AuditLog/引用组件需定义 revoked 后的展示态。

**主要来源**：[MS Support: Access Requests](https://support.microsoft.com/en-us/office/set-up-and-manage-access-requests-94b26e0b-2822-49d4-929a-8455698654b3) · [Google Drive API: Pending Access](https://developers.google.com/workspace/drive/api/guides/pending-access) · [Notion: Sharing & Permissions](https://www.notion.com/help/sharing-and-permissions) · [Box: Securing Shared Links](https://docs.box.com/en/box-fundamentals/for-users/collaborating/using-shared-links/securing-shared-links) · [Box: User Activity Report](https://docs.box.com) · [Cloudflare: Unified Data Platform](https://blog.cloudflare.com/our-unified-data-platform/) · [MS Learn: Purview Audit](https://learn.microsoft.com/en-us/purview/audit-log-activities) · [Workspace Updates 2023/06](https://workspaceupdates.googleblog.com/2023/06/respond-to-access-requests-for-google-workspace-files-efficiently.html) · [Drive: Access Expires](https://support.google.com/drive/answer/2494893?hl=en) · [Confluence: Inspect Permissions](https://confluence.atlassian.com) · [Technisaur: Check Permissions](https://technisaur.com.au) · [beri.net: Permission Model](https://www.beri.net) · [Glean Docs: Citations](https://docs.glean.com) · [Restricted SharePoint Search](https://techcommunity.microsoft.com) · [VisualSP: Oversharing](https://www.visualsp.com)

### 报告4：RAG / 企业 LLM 系统中权限隔离失败的攻击面与工程防御——知识库 UI「诚实呈现安全边界」证据报告

> 提取自 agent_53fff3b8-ae70-402d-bd9f-3569b906b13c（output.txt）。

# RAG / 企业 LLM 系统中权限隔离失败的攻击面与工程防御
## ——知识库 UI「诚实呈现安全边界」证据报告

调研方法：并发检索学术库（arXiv / IEEE / ACM / CRYPTO / S&P / ICLR / SIGMOD）与工程实践（OWASP 官方 Cheat Sheet、向量数据库官方文档、Microsoft Learn、安全厂商披露），共 18 个有效来源（S1–S18，见文末）。关键结论均给出原文依据。

---

## A) 攻击面清单（攻击 × 原理 × 防御 × 来源）

### A1. 经由检索文档的间接提示注入 → 越权复述

| 项 | 内容 |
|---|---|
| 攻击 | 攻击者在**可写入的公开/低密级文档**（网页、PDF、邮件、公开频道）中埋入隐藏指令（零宽字符、隐形 Unicode tag 字符、白底白字），文档被摄取进知识库后命中受害者查询，LLM 把「数据」当「指令」执行：复述上下文中受限文档内容、外传数据 |
| 实证 | Slack AI（2024-08）：公开频道注入指令 → Slack AI 检索响应把**私有频道/DM 内容**拼进回答并经 URL 隐蔽信道外传；Slack 初判「按设计工作」，后修补并付赏金 [S10]。M365 Copilot（Black Hat 2024, Zenity/Bargury）：邮件内隐形 Unicode 注入 → Copilot 搜刮受害者邮箱 → ASCII 走私外传，有零交互演示 [S11]。OWASP LLM Top 10 中 Prompt Injection 连续各版本居首（LLM01），敏感信息泄露升至第二（LLM02），RAG 向量库跨租户泄漏/投毒被点名 [S9] |
| 原理 | 权限边界在**检索层**拦住了攻击者直接读受限文档，但 LLM 的 context 是权限汇聚点：攻击者无法读的内容与可写内容进入同一 context，注入的指令让模型以「受害者查询的合法权限」为攻击者搬运数据（confused deputy 变体） |
| 防御 | OWASP RAG Cheat Sheet：**"Retrieved content is DATA, not COMMANDS"**——用分隔符标记检索文本为数据；检索后重申系统指令；扫描注入标记（"SYSTEM:"、"ignore previous"）；限制检索量（默认 3–5 chunks / 2,000–4,000 tokens）防 context 洪泛；输出返回前全部验证（PII/密钥/越权内容脱敏）；高危动作需用户确认、工具白名单、**fail-closed** [S1]。关键：**"Access control must be enforced before content reaches the model"**——不要指望 LLM 自己执行访问规则 [S1] |

### A2. 知识库投毒（与 A1 同源，权限视角）

OWASP 称文档投毒是「最常见且立即可利用的 RAG 攻击向量」；防御为摄取时 SHA-256 哈希+检索前校验、来源白名单、审批流、索引快照与写权限收紧 [S1]。arXiv 2509.20324 将知识库投毒与文档级 membership inference 一并纳入首个 RAG 形式化威胁模型 [S2]。

### A3. 计数 / 排名侧信道：membership inference on retrieval

| 项 | 内容 |
|---|---|
| 攻击 | 未授权用户只凭**查询接口**推断受限文档是否在索引中：观察 topK 结果数量、排名变化、或「检索到 vs 未检索到」导致的生成差异 |
| 学术证据 | **"Riddle Me This!"（Interrogation Attack）**：构造「只有目标文档在场才答得出」的自然查询，**30 次查询、每文档成本 < $0.02** 即可推断成员关系，TPR@1%FPR 较前人提升 2 倍，且对检测器隐蔽（被捕获率比旧攻击低约 76 倍）[S4]。**Mask-based MIA**（arXiv 2410.20142）：针对存储版权/隐私语料的 RAG 做成员推断 [S5]。**IEEE MIA 论文**：BM25/TF-IDF 等词法检索器在推理期即通过检索行为泄漏知识库内容 [S6] |
| 侧信道理论根基 | 加密数据库领域的经典结论：**仅结果数量/体积就足以重建数据库**——Count Attack（Cash et al., CRYPTO 2015）只用结果基数（L1 泄漏）恢复查询 [S14]；Volume Attacks（Bristol, 2019）用范围查询结果体积重建数据 [S15]。RAG 的 topK 计数与排名位移是同一类泄漏面 |
| 防御 | ① OWASP：**预检索过滤**——"Pre-retrieval filtering is more secure as it prevents the similarity scores of restricted documents from being observed"（后过滤会让受限文档的相似度分数可被观察）[S1]；② 查询改写/扰动（Riddle Me This 指出其对改写敏感 [S4]）；③ 限速、异常查询审计；④ 拒绝向未授权用户回显任何「受限侧」信号（见 C 节） |

### A4. 间接泄露：把 context 中未授权内容 paraphrase 进答案

- **ConfAIde（ICLR 2024 Spotlight）**：GPT-4 / ChatGPT 在人类不会泄露的上下文中泄露敏感信息的比例分别为 **39% / 57%**，且隐私提示词和 CoT 都压不住 [S7]。企业场景即：检索层过滤正确，但模型在生成时把「碰巧在 context 里的」越权片段改写进答案。
- 后果链：一旦内容进入 context，它已进入模型、日志、缓存、计费流——**「生成后过滤」无法挽回已发生的泄漏**（这也是把它归为缺陷层的核心理由，见 B）。
- 防御：检索前 ACL（让未授权内容根本不进 context）+ 生成期 **citation grounding check**（每个事实断言必须能落到过滤后文档集合；ALCE 证明 LLM 引用经常不被文档支持、甚至幻造引用，所以 grounding 必须机器校验而非信任模型自觉）[S8]。

### A5. 权限同步失效（ingestion 时固化 ACL）

OWASP：**"Enforce access control checks at retrieval time, not just at ingestion time"**——权限在摄取后可能已收回；chunk 上必须携带（分类、owner、允许角色、允许租户）元数据，源文档权限变化时要重估 chunk 权限 [S1]。工程侧：Ragaboutit 指出这是同步问题，需变更检测、增量同步、权限关系变化时缓存失效 [S13]。

### A6. Confused deputy / Agent 越权

LLM Agent 安全形式化框架（arXiv 2026-03）指出典型失败：agent 以**自身服务身份的高权限**而非**发起用户权限**执行动作 [S12]。OWASP LLM Top 10 对应 excessive agency（如「只读分析查询不应拿到 UPDATE/DELETE 权限的连接」）。防御：检索与工具调用一律以发起用户身份做鉴权（query 带用户身份向下传递），工具最小权限、逐次授权 [S12][S9]。

### 现实放大器：过度共享（oversharing）

M365 Copilot 的共识结论：**"Copilot inherits the permissions of the user asking — it does not create new access, it reveals the access that was already there"**，并指数级放大既有权限配置错误（anyone-in-org 链接、断裂的继承）[S16]。即 RAG 系统的安全性上界 = 源系统权限卫生状况；这也是 admin 审计视图（D 节）的存在理由。

---

## B) 安全过滤的分层结论

```
L0 摄取期:  chunk 携带 ACL 元数据          —— 必要非充分（会过期, A5）
L1 检索前:  ACL 过滤进入 ANN/BM25 查询本身   —— 唯一安全基线 ★
L2 检索后:  取回 topK 再剔除无权限结果       —— 缺陷层（三重问题）
L3 生成后:  对答案扫描脱敏                  —— 缺陷层（纵深兜底, 不能单独存在）
```

**为什么 L2（检索后过滤）是缺陷**：
1. **泄漏面**：受限文档的相似度分数已在过滤前产生并可被观察（OWASP 明言）[S1]，喂养 A3 的计数/排名侧信道；
2. **正确性面**：topK 槽位被无权限结果占用，过滤后用户可能得到过少甚至零结果——这是租户隔离的安全/正确性双重问题 [S3][S17]；
3. **边界面**：越权内容已进入应用进程内存与日志。

**为什么 L3（生成后过滤）更是缺陷**：内容已进入模型 context、日志、缓存（A4 后果链）；对 membership inference 完全无效；LLM 改写会绕过字面匹配。Petronella 等 playbook 把「pre-retrieval / retrieval / post-generation」三层并列，但定位是**纵深防御**，其中 post-generation 只负责兜住生成文本中的意外泄漏 [S17]——顺序不可倒置：**先有 L1，L2/L3 只是复核**。

**混合检索的一致性要求**：vector 侧与 BM25/关键词侧必须**同一份 ACL 过滤、同一时刻生效**。IEEE 论文证明 BM25/TF-IDF 本身就通过行为泄漏内容 [S6]；只过滤向量侧而漏掉关键词侧，是常见工程缺口（hybrid merge 阶段的两路结果都必须来自过滤后空间）。

**隔离索引 vs 共享索引+过滤（multi-tenant 取舍）**：

| 模式 | 优点 | 代价 | 证据 |
|---|---|---|---|
| index/collection per tenant（物理分片） | 最强隔离：Weaviate 原生多租户「**Each tenant is stored on a separate shard**」「Data stored in one tenant is not visible to another tenant」 | 租户数大时内存与运维开销 | [S18] |
| 共享索引 + metadata filter（Pinecone 典型模式） | 规模与成本友好 | 隔离依赖过滤器正确性；复杂过滤伤性能 | [S17][S18] |
| 动态分区（HONEYBEE, SIGMOD 2026） | 按 RBAC 角色结构做重叠分区：比行级安全（共享+过滤）**延迟低至 13.5×**，仅多用 1.24× 内存；比专用 per-role 索引省约 90.4% 附加内存 | 工程复杂度 | [S3] |

结论：**租户级用物理隔离，租户内文档级 ACL 用 pre-filter**；HONEYBEE 类分区方案是「隔离索引」与「共享索引+过滤」谱系上的可落地中间点。OWASP 补充纪律：不要把所有 chunk 放单一扁平 namespace；定期跑跨租户探针查询，断言「**zero cross-boundary results**」[S1]。

**生成期防御的两条硬规则**：
1. **答案只允许引用过滤后文档集合**，引用做程序化 grounding 校验（ALCE 表明引用不可信，需机器验证）[S8]；
2. **明确回答「无权访问/未找到」而非静默**——但措辞要遵循 C 节判据（不确认受限对象的存在性）。fail-closed：权限服务不可用时拒绝而非放行 [S1]。

---

## C) 「可显示的计数/提示」vs「构成泄露的提示」——判据

四条判据（综合 OWASP 分数不可观察原则 [S1]、Count/Volume Attack 文献 [S14][S15]、GitHub 404 惯例 [S19]、ConfAIde [S7]）：

**判据 1 —— 信息属于哪个集合？**
- 只可显示**授权集合内**的聚合信息（“检索到 K 条你有权访问的文档”）。K 本身不泄露任何受限侧信息。
- **不可显示受限集合的存在性信号**：被过滤掉的条数 N、被过滤文档的标题/score/排名位移。「已按你的权限过滤 N 条」若 N 是受限侧计数，就是给每次查询一个**存在性 oracle**——Count Attack 已证明仅基数就能支撑重建攻击 [S14]，而 MIA 攻击 30 次查询、$0.02/文档即可稳定推断 [S4]。

**判据 2 —— 「不知道」与「不能说」不可区分吗？**
GitHub 官方文档明言：用 404 而非 403，是为了「**避免确认私有仓库的存在**」[S19]。同理，对未授权用户，受限文档在 UI/回答中应呈现为「不存在」——「找到 3 条」+「另有 2 条你没权限」等同于把 403 发给了攻击者。诚实呈现义务的对象是**过滤这件事发生了**，不是**被过滤对象的存在性**。

**判据 3 —— 用户对聚合数字的先验是否已经等于泄露？**
例外：若用户本来就能通过别的授权界面枚举同一集合（如部门成员能列出本部门全部文档数），则显示该集合总数无增量泄露。判据是**增量信息**，不是绝对信息。单查询、小样本、可脚本化重复的计数最危险（MIA 全靠低成本重复探测 [S4]）。

**判据 4 —— 提示是否可被用作差异探测器？**
任何随受限侧内容变化的可观察量（计数、延迟、排序、引用编号、token 数）都要当作侧信道审查。安全的提示必须是**授权侧的纯函数**：无论受限集合里有没有那份《2026 裁员名单》，界面输出完全一致。

**「显示过滤数量是否是泄露」的各方观点落点**：OWASP 立场（预过滤以防受限文档分数被观察）实质上已回答——受限侧的可观察量都应消除 [S1]；加密 DB 文献给了理论根据（基数即泄漏）[S14][S15]；GitHub 404 惯例给了工程先例（存在性敏感时拒绝≠确认）[S19]。反向观点（透明度派，如 GitLab 允许 403 以解释原因）仅在**资源存在性本身不敏感**时成立。对知识库 UI 的折中：向用户声明「结果已按你的权限过滤」这一**事实**（不含数量、不含对象），既满足诚实呈现，又不构成 oracle。

---

## D) 给 UI 组件库的硬结论

### D1. 检索 Playground 组件应呈现的安全信号

必须呈现：
1. **过滤层徽标**：每次检索标注 ACL 过滤发生在哪一层——`pre-filter（ANN 内）` / `post-filter（缺陷）` / `none（危险）`；hybrid 模式下分别标注向量侧与 BM25 侧（两侧必须同为 pre-filter）。
2. **每条 chunk 的 ACL 元数据行**：来源系统、分类、owner、允许角色/租户（来自 chunk 元数据 [S1]）——让开发者在 playground 里直接看见权限标签随结果走。
3. **Citation grounding 状态**：每条回答断言的引用是否通过「引用 ∈ 过滤后文档集合」的程序化校验；未通过则醒目标红（引用不可信是常态 [S8]）。
4. **fail-closed 状态**：权限服务超时/降级时，UI 显示「因权限校验不可用而未检索」，绝不静默退化为无过滤检索 [S1]。
5. **空结果的语义**：区分「授权集合内确实无相关内容」与「权限校验失败」，两者文案都不得提及受限侧任何信息。

禁止呈现（构成泄露，C 节判据）：
- 被过滤掉的**受限文档条数、标题、相似度分数、排名位移**；
- 任何「若权限不同你会看到 X」的对照视图（对普通用户；admin 审计视图除外，见 D2）。

### D2. Admin 审计组件应呈现的信号

1. **逐查询权限日志**：OWASP 要求记录「每次检索的查询身份 + 各 chunk 的访问元数据」[S1]；审计视图按 (用户, 查询, 返回 chunk 的 ACL) 展示，并记录鉴权决策理由（Ragaboutit：为 SOC 2/HIPAA/GDPR 取证留存决策日志）[S13]。
2. **跨租户零结果探针**：内置定时以租户 A 身份查租户 B 语料的哨兵查询，仪表盘断言 `cross-boundary hits = 0`，非零即告警 [S1]。
3. **oversharing 视图**：回答引用了「组织内过度共享」文档（如 anyone-in-org）的频率排行——因为 RAG 只是放大器，真正要修的是源权限 [S16]。
4. **权限回归测试面板**：把红队测试集跑进 CI——每个未授权角色的探测查询断言「不产生相关内容、不产生引用」；指标建议：越权引用率（目标 0）、跨租户命中（目标 0）、MIA 探针区分度（AUC 趋近 0.5）、citation-grounded 率；工程实践引用 Ragaboutit：「Automated testing can catch regressions introduced by system updates or configuration changes」+ 边界条件用例（权限刚收回、缓存失效、hybrid 两路）[S13]；测试判据参考 ox.security 框架（是否尝试越权、scope 是否正确强制、响应是否泄漏受保护内容）[S20]。

### D3. 临时提权（JIT / break-glass）的呈现

架构位置（PIM 模式，Microsoft Entra 官方 [S21]）：
- **eligible（可激活）而非 standing（常驻）**权限；激活需**审批 + MFA + 填写理由**，时长受管理员配置的上限约束，到期自动失效；全程通知与审计历史；续期/延长需重新审批。
- **break-glass 账户**独立于 PIM 之外、双人保管、仅限紧急（Veza 等实践 [S22]）。

UI 硬要求：
1. **激活时刻的显式横幅**：「本次为临时访问（角色 X，来源：审批人 Y），**剩余 HH:MM，到期自动收回**」——时长可见、倒计时可见；
2. **检索结果打上临时权限印记**：JIT 会话期间引用的文档在 citation 处标注「经由临时权限访问」，让事后审计能区分「常驻权限看到的」与「临时提权看到的」；
3. **到期不静默**：会话结束/权限回收时，playground 与聊天界面明确提示「临时权限已失效」，后续查询回到原权限集，不缓存任何 JIT 期间内容；
4. **审批侧视图**：待批请求展示申请人、理由、时长、影响范围（哪些 collection/文档 ACL 范围），对应 PIM 的 justification + approval + notification 三要素 [S21]。

---

## 来源

**学术**
- [S1] OWASP RAG Security Cheat Sheet（工程权威，含全部关键引文）: https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html
- [S2] RAG Security and Privacy: Formalizing the Threat Model and Attack Surface (ICDMW 2025, arXiv:2509.20324): https://arxiv.org/abs/2509.20324
- [S3] HONEYBEE: Efficient RBAC for Vector Databases via Dynamic Partitioning (SIGMOD 2026, arXiv:2505.01538): https://arxiv.org/abs/2505.01538
- [S4] Riddle Me This! Stealthy Membership Inference Attacks on RAG (arXiv:2502.00306): https://arxiv.org/abs/2502.00306
- [S5] Mask-based Membership Inference Attacks for RAG (arXiv:2410.20142): https://arxiv.org/abs/2410.20142
- [S6] Membership Inference Attack in RAG（BM25/TF-IDF 泄漏, IEEE）: https://ieeexplore.ieee.org/abstract/document/11700574
- [S7] ConfAIde: Can LLMs Keep a Secret?（ICLR 2024, arXiv:2310.17884）: https://arxiv.org/abs/2310.17884
- [S8] ALCE: Enabling LLMs to Generate Text with Citations（Gao et al., EMNLP 2023）: https://github.com/princeton-nlp/ALCE
- [S14] Count Attack（Cash et al., CRYPTO 2015）与 SSE 泄漏滥用攻击综述: https://link.springer.com/chapter/10.1007/978-981-10-7302-1_9 （载体见 [S15] 综述索引）；Volume Attacks（Univ. of Bristol）: https://research-information.bris.ac.uk/en/publications/encrypted-databases-new-volume-attacks-against-range-queries
- [S12] A Framework for Formalizing LLM Agent Security（confused deputy, arXiv 2026-03）: https://arxiv.org/abs/2503.07149 （以检索到的 arXiv 摘要为准）

**工程与事件**
- [S9] OWASP Top 10 for LLM Applications 综述（LLM01/LLM02 排名）: https://genai.owasp.org/llm-top-10/
- [S10] PromptArmor: Data Exfiltration from Slack AI via Indirect Prompt Injection (2024-08): https://promptarmor.substack.com/p/data-exfiltration-from-slack-ai-via-indirect-prompt-injection ；报道: https://www.techradar.com
- [S11] The Register: Copilot 劫持研究（Bargury, Black Hat 2024, ASCII smuggling）: https://www.theregister.com/2024/08/28/copilot_black_hat/
- [S13] Ragaboutit: The Ultimate Guide to RAG Authorization（权限回归测试引文）: https://ragaboutit.com/the-ultimate-guide-to-rag-authorization/
- [S16] M365 Copilot「继承用户权限、暴露既有 oversharing」共识（SC-100 指南等）: https://vladtalkstech.com
- [S17] Multi-tenant 模式对比（Pinecone filter vs Weaviate 原生多租户; Enterprise RAG Playbook）: https://llmops.report ；https://petronellatech.com
- [S18] Weaviate 官方多租户文档（per-tenant shard 隔离引文）: https://docs.weaviate.io/weaviate/manage-data/multi-tenancy
- [S19] GitHub REST API 文档（404 而非 403 以避免确认私有仓库存在）: https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api
- [S20] ox.security: AI Security Testing（越权/scope/泄漏三判据）: https://ox.security
- [S21] Microsoft Learn: What is Privileged Identity Management（JIT/时间限/审批/MFA/eligible-active 术语表）: https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure
- [S22] Veza: Azure 访问控制与 break-glass 双账户实践: https://veza.com

**一句话总纲**：权限隔离的唯一安全基线是「以发起用户身份、在检索执行体内部（ANN 与 BM25 两侧）做 pre-filter，混合检索与生成只消费过滤后集合」；UI 的诚实呈现义务止于陈述「过滤发生了」与展示授权侧信号——任何随受限集合变化的计数、分数、标题、时延，本身即是泄露。

### 报告5：企业知识库访问治理深度调研报告（kb-ops 治理域）

> 提取自 agent_773ac665-1ec5-4d61-ab4c-4af604b2c873（output.txt），已删除会话导语（「研究完成，共查证 20+ 个来源……」）。

# 企业知识库访问治理深度调研报告（kb-ops 治理域）

## A) 多角色组合语义结论表

用户同时是「销售部成员」+「Q3 项目组」+「审计员」时，对同一文档的有效权限，各家工程实现收敛于三种范式：**并集 + 显式 deny 例外（主流）**、**分层交集（guardrail 型）**、**有序 ACE（first-match，仅 NTFS 传统）**。没有任何主流系统用简单 first-match 处理多角色授权。

| 系统/模型 | 多来源组合规则 | Deny 语义 | 关键细节 |
|---|---|---|---|
| **Zanzibar**（Google Drive/Calendar 底层） | permission 由集合算子定义：**union**（`viewer = viewer ∪ editor`）、**intersection**、**exclusion**；论文 2.3 节经典式 `can_view = viewer ∩ ¬blocked` | exclusion（差集）实现 deny：有 `blocked` 关系即从结果中减去，即使同时有 viewer 关系 | Check API 递归展开 userset（组→组→直接关系）图遍历；无匹配关系即拒绝（**默认拒绝 / fail-closed**） |
| **SpiceDB**（Zanzibar 开源实现） | `permission can_view = viewer & editor - banned`：`&` 交集、`-` 排除、默认并集 | exclusion 最强（从左侧结果中减去） | 官方提示交集/排除比并集**性能更贵**，建模尽量用 union；排除算子曾有资源耗尽漏洞（CVE-2025-64529）——deny 路径要单独防护 |
| **OpenFGA**（Zanzibar 直系） | union + 递归 userset 展开（组、`folder#viewer` 继承） | 用「but not blocked」模式表达排除 | `check` 无关系时返回 `allowed:false`，即默认拒绝 |
| **AWS IAM** | 同账号 identity policy ∪ resource policy = **allow 并集**；叠加 permissions boundary / SCP / RCP 后取**交集** | **explicit deny 在任何一层都覆盖一切 allow**；无 allow 则 implicit deny | 工程上最清晰的表述：「先查显式拒绝 → 再查显式允许 → 否则默认拒绝」 |
| **SharePoint / OneDrive** | 站点/列表/条目级 role assignment 是**加法模型**：多角色 = 各角色权限并集，不存在用户可配置的条目级 deny ACE | deny 只存在于 web application policy（中央管理员全站级 Deny），优先级压过一切站点权限 | "Limited Access" 是系统自动生成的兜底角色（用户仅有子对象权限时保证可导航）；「拒绝」的操作语义是**移除 role assignment** 而非加 deny |
| **NTFS/Windows ACL**（对照） | 有序 ACE 求值（canonical order 内 deny 先于 allow 生效） | deny 优先，但**非规范序 ACL 中 deny 可能永不触发**——first-match 范式的经典缺陷 | 这是「为什么大家放弃 first-match」的反面教材 |
| **Entra / Okta**（组与许可） | 多组成员、多 access package 叠加 = 并集 | Conditional Access 的 Block 策略近似全局 deny（break-glass 账户必须显式排除在 Block 策略之外） | 权利管理中一个用户可同时持有多个 access package，各自带独立过期时间 |

**冲突在 UI 上如何解释**——两个成熟范式：
1. **SharePoint「Check Permissions」对话框**：输入任意用户，列出其获得当前对象权限的**完整来源链**（直接权限 / SharePoint 组 / M365 组 / Entra 安全组 / 共享链接），并解释 "None" vs "Limited Access" 的差异。这是「并集模型下解释为什么」的标准答案。
2. **Confluence「People who can view」**：页面上直接列出哪些人能看、以及**各自因为什么**（space permission / 用户组 / 页面 restriction）；同时明确规则：页面 restriction 只能收紧、永不超出 space 权限扩张——即「权限只能做交集式收紧，来源必须可枚举」。

**给 kb-ops 的硬规则**：多角色并集 + 显式 deny 例外（deny 最强、必须标注否决来源）；每个有效权限必须可枚举其授予来源链；把「继承只能收紧」作为默认心智模型。

## B) 访问审批全状态机（含 SLA / 升级 / 过期）

### B1. 请求-审批主状态机（以 Entra entitlement management 为基准，Okta 同构）

```
[草稿] 表单：理由(必填可强制) + 问卷 + 代他人申请 + 时间窗口(可选起止) + 多策略选择
   │ Submit
   ▼
Submitted ──► PendingApproval ──► Approved ──► Delivering ──► Delivered ──► (AccessExpiring 提醒) ──► AccessExpired
                 │  │                                    └► PartiallyDelivered（部分资源失败）
                 │  ├──► Denied（附理由，请求者可见）
                 │  └──► Expired（审批超时无人响应；通知重交）
                 ├──(请求者主动) Cancelled（仅 pending 期间可取消）
                 └──(升级) escalation：可配置转发给备用审批人/经理
事后纠错：审批人可 RevokeApproval（撤销已批准的访问，需填原因）
被拒/过期后：Resubmit 一键重交
```

- **审批人路由**：策略定义审批人（文档 owner / 指定组 / 部门管理员均可配置）；**单阶段内任一审批人做出决定即完成**该阶段（其余审批人可见决定与决策人——「先到先得、全员可见」）；**多阶段审批**每阶段至少一人批准才进入下一阶段；按权限级别升级用「多阶段」表达（如阶段1 = 资源 owner，阶段2 = 部门 admin）。
- **SLA 呈现**：请求详情向双方展示「提交时间 + 请求过期时间」（倒计时）；审批人邮件包含请求者、组织、业务理由、访问起止时间、过期时间；无响应 → 到期 Expired → 通知请求者重新提交。Okta 侧等价物：request sequences（审批链）、My Requests / My Catalogs / My Tasks 三视图 + 审批委托（delegates）。
- **生效通知**：Delivered 后发送「你现在拥有访问权」邮件（可禁用）；外部用户可能停在 consent 环节 → PartiallyDelivered 状态。

### B2. JIT / 时间盒激活子状态机（Entra PIM）

```
Eligible（资格态，无权限）
   │ Activate：MFA 校验(每会话一次) → 可选缩减 Scope → 可选延迟开始时间 → 填 Reason(可强制)
   ▼
[需审批: PendingApproval（可 Cancel）] ──► Active（临时 active assignment，数秒内生效）
   ▼  激活时长上限可配（默认 8h 量级、可至 96h）
Expired / 手动 Deactivate（激活后 5 分钟内禁用手动停用，防抖）→ 数秒内移除 active assignment
```

- 应用侧缓存会造成「已激活仍无权限 / 已停用仍有权限」的滞后——**组件库必须允许权限生效时间有延迟语义**。
- PIM 移动端支持对**即将到期的资格做续期请求**（request renewals for expiring assignments）。

### B3. 时间盒分享的到期与回收

| 平台 | 机制 | UI 范式 |
|---|---|---|
| Box | 管理员级强制链接过期策略；自动过期协作者 | 共享面板中**过期协作者名旁显示时钟图标**；链接可见性变更会重置过期时间 |
| Google Drive | 单用户级访问到期日（share 对话框 → Add expiration / "Access expires"）；Drive API `expirationTime`；共享云端硬盘文件 2025-11 起新支持 | 成员列表行内日期；API 上限约 1 年 |
| SharePoint | Anyone 链接租户级默认/最大过期天数（常见 30 天，`AnyoneLinkExpireInDays`） | 链接卡片显示到期日 |
| Entra | access package 的 access expires；到期前发「Extend access by [date]」提醒邮件；可续期或 Resubmit | 状态徽章 Access extended / Access expired |

**硬结论**：到期是一等公民——每个 grant 必带 `expiresAt`；到期前提醒（邮件/任务）+ 到期后**幂等自动回收**；UI 必须三态呈现「永不过期 / 将到期（倒计时+续期入口）/ 已过期（可重交）」。

### B4. Break-glass / 紧急访问

- **配置范式**（Entra 官方 + 社区基线一致）：至少 2 个 cloud-only 紧急账户；**从所有 Conditional Access（尤其 Block/MFA）策略显式排除**；专用组隔离；凭据约 90 天轮换、分人双托管（dual-custody，二人规则的物理形态）。
- **审批留痕**：医疗行业 break-the-glass 的合规红线是 **BTG 事件的审计粒度必须 ≥ 常规访问**（常见失败模式：BTG 日志反而更简略）；学界「controlled BTG」方案 = 紧急放行 + 事后问责记录。
- **监控范式**：任何 break-glass 登录触发**实时告警**（合法使用应极少），单独监控通道，不等周期复核。
- **UI 呈现**：访问界面常驻警示条幅（「你正在使用应急访问，本次操作将被记录并通知安全团队」）+ 独立确认对话框（理由必填）+ 审计日志行级 `breakGlass` 标记，与普通访问在时间线上视觉区分。

## C) Access Review / 权限异味的 UI 范式

### C1. Entra Access Reviews（复核工作台的标准形态）

- **清单头**：Name、**Due（截止日，之后 denied 用户才被移除）**、Resource、**Progress（已复核 n / 总数 m）**。
- **行级操作**：勾选一人或多人 → 批量 **Approve / Deny / Don't know**（Don't know = 保留访问 + 记入审计 + 对其他复核人可见评论）；Reason 框可配置为必填；结束前可随时改判；**多复核人时以最后一次提交为准（last response wins）**。
- **建议引擎**：两个信号——「30 天未登录建议 Deny」+「同伴异常（peer outlier）建议 Deny」；一键 **Accept recommendations**（可全部未复核项或选中项；不覆盖已有决定）。
- **多阶段复核**（2-3 阶段）：后阶段可见并**覆盖**前阶段决定；管理员可 Stop current stage 提前推进。
- **不响应默认**：可配置 reviewers 未处理项的自动决定（含 auto-remove）。
- **staging → apply 两段式**：Deny 不立即生效，待复核期结束/管理员停止后统一 apply——决定与执行分离。

### C2. SharePoint Site Access Reviews（把复核下放给站点 owner 的完整闭环）

1. Admin 在 DAG 报告中勾选站点（≤100/次；组织级权限报告每月上限 1000 次）→ 定制邮件（可自定义发件人/标题/说明/指引链接，防钓鱼）→ 发起。
2. Owner 收到**按报告类别定制的邮件**（EEEU / sharing links / 权限基线三模板）→ 打开专项复核页。
3. 复核页按异味类型给出结构化清单：**EEEU 组**（何时、被谁加入 → Remove users from group）；**近 28 天被共享的 items**（谁、何时共享 → Manage access → Remove access）；**sharing links**（链接 + 创建人 + 日期）；**oversharing 基线**（Number of permissioned users——明确不去重的暴露面计数；Number of groups——点开看每组人数；Links/EEEU 标记列）→ 权限用户数最多的 item 排最前。
4. **Complete review**（附评论回传 admin）；admin 侧「My review requests」跟踪 **pending / completed（复核人+时间）/ failed（owner 邮箱无效）**。
5. Owner 侧聚合入口：站点齿轮 → Site settings → **Site reviews**。

### C3. 权限异味（permission hygiene）清单——各家 admin center 的呈现

| 异味 | 检测/呈现方 | UI 形态 |
|---|---|---|
| 过度共享（org-wide/匿名链接） | SharePoint DAG 报告（Anyone / PeopleInYourOrg / specific-people 链接数排行、EEEU 内容、敏感标签站点，周期 28 天）；Google Workspace 安全调查工具（Drive Log Events，条件 `Visibility = External` 过滤导出） | 站点×数字 的表格 + 处置 CTA（发起复核 / restricted access control） |
| 敏感度错配 | Purview 审计事件 `DocumentSensitivityMismatchDetected`（Confidential 文档落在 General 站点） | 事件流标记 |
| 孤儿化（owner 离职/禁用） | 无官方单一功能：CoE Starter Kit orphan-check 流（owner 被禁用即标记）；社区用 CSOM `AadObjectId` 扫描 orphaned site users | 待办/标记列表 |
| 断继承（unique permissions） | 社区共识：唯一权限 = 混乱+性能+审计性差（m365.fm）；治理用组+继承、例外才断 | 例外清单 + reset to inherit |
| 读审计 | Purview 审计（`FileAccessed` 同用户同文件 5 分钟去重、`FilePreviewed`、`PageViewed`、`ClientViewSignaled`、3 小时 Extended 事件；`app@sharepoint` 系统行为归因）；SharePoint 站点级「内容查看」报告 vs Purview 全历史双轨；Confluence 有 `Viewed Confluence page` 事件但缺 IP/位置（已知缺陷） | 时间线 + actor 类型区分（human/app/system） |
| 权限变更历史 | Purview 审计 sharing/permission 事件族（加组/移组/改共享）；Exchange 委派事件（Add/Remove-MailboxPermission、SendAs/SendOnBehalf） | who/when/what diff 流 |
| 过度授权警示 | SharePoint owner 复核页把「此站点/文件夹对多少人可见」直接数字化（permissioned users 计数）；Azure DevOps 权限优化指南「Deny 只用于例外、限制显式 override」 | 数字徽章 + 阈值告警（「对 1200 人可见」的 UI 等价物） |

## D) 给 kb-ops 组件库的硬结论

**应做成独立组件（9 个）**：

1. **EffectiveAccessPanel**（有效权限解释器）：输入用户×资源 → 输出来源链列表（直接授予 / 组 / 继承 / 链接 / access package），deny 与例外高亮并标注否决层。数据契约 = 权限来源数组，不是单一布尔。（原型：SharePoint Check Permissions + Confluence People who can view）
2. **AccessRequestDrawer**：理由（可强制）+ 时间窗口 + 代申请 + 多策略选择；状态机枚举 `submitted / pending_approval / approved / delivering / delivered / partially_delivered / denied / canceled / expired / access_expiring / access_expired`，含 Resubmit。
3. **ApprovalInbox**：待审列表（请求人/理由/起止/**过期倒计时**）、批准/拒绝+理由、批量、**委托（delegate）**、多阶段进度条、Revoke approval。
4. **ExpiringAccessBadge + ExpiringAccessList**：到期倒计时 pill、时钟图标（Box 范式）、续期请求入口、已过期态的重交入口。每个 grant 强制带 `expiresAt` 字段（nullable）。
5. **BreakGlassBanner + BreakGlassConfirmDialog**：常驻警示条幅、理由必填确认、审计标记 API（`breakGlass: true` 事件字段）。
6. **AccessReviewWorkbench**：Due/Progress 表头、行内 Approve/Deny/Don't know + Reason、建议列（`inactiveDays` / `peerOutlier` 信号字段）+ Accept recommendations（全部/选中）、多阶段覆盖指示、no-response 默认策略展示；**决定 staged、apply 分离**。
7. **PermissionHygieneList（异味发现卡片）**：异味枚举 `org_wide_link / eeeu_group / sensitive_label_broad / broken_inheritance / orphaned_owner / excessive_permissioned_users`；每项带量化数字（permissioned users 不去重计数、groups、links 数）+ 处置 CTA（Manage access / 发起 owner 复核）。
8. **AuditTrailTimeline**：read / permission-change / delegation 三通道过滤；5 分钟去重说明；actor 三态（human / app / system）。
9. **PermissionChangeLog**：who / when / what diff（增删了哪个主体、哪个组、哪条链接）。

**只是数据字段、不做组件**：SLA 与升级配置（escalation 延迟天数、审批超时天数）、策略参数（多 policy 候选、PIM 最大激活时长、链接默认过期天数）、auto-apply / no-response 行为开关、建议引擎阈值（30 天未登录等）、报告阈值（链接数排行窗口）——这些属于 policy schema，由上述组件消费。

**跨组件工程原则**：① 组合语义统一为「并集 + 显式 deny 例外优先」，禁止 first-match；② 一切 grant 可追溯来源、可解释否决层；③ 权限生效允许延迟（缓存失效语义）；④ 决定与执行两段式（审批 staged→apply、复核 staged→apply）；⑤ BTG 审计粒度 ≥ 常规访问并带实时告警。

## 来源

- [Zanzibar: Google's Consistent, Global Authorization System（USENIX ATC '19 论文 PDF）](https://cs.brown.edu/courses/csci2390/2019/readings/zanzibar.pdf)
- [OpenFGA Concepts（union/userset 展开/默认拒绝）](https://openfga.dev/docs/concepts)
- [SpiceDB schema language（& 交集 / - 排除算子）](https://authzed.com)（及 [HNC 讨论](https://news.ycombinator.com)）
- [AWS IAM Policy evaluation logic（并集/交集/explicit deny）](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)
- [SharePoint 授权模型（加法模型、web app policy deny、Limited Access）](https://learn.microsoft.com/en-us/sharepoint/dev/user-guides/authorization-users-groups-and-the-object-model-in-sharepoint)
- [SharePoint「Check Permissions」实践](https://sharepoint.stackexchange.com/questions/305733/find-all-users-that-have-any-level-of-permissions-for-a-site)
- [Entra 权利管理：请求访问包（表单/期间/取消/重交）](https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-request-access)、[批准或拒绝请求（多阶段/过期/撤销）](https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-request-approve)、[请求过程与邮件通知（状态流/升级）](https://docs.azure.cn/en-us/entra/id-governance/entitlement-management-process)
- [Entra PIM 激活角色（MFA/时长/审批/取消/停用）](https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-how-to-activate-role)
- [Entra Access Reviews 复核操作（Approve/Deny/Don't know/建议/多阶段/不响应默认）](https://learn.microsoft.com/en-us/entra/id-governance/perform-access-review)
- [SharePoint Site Access Reviews（DAG 发起/owner 复核页/状态跟踪）](https://learn.microsoft.com/en-us/sharepoint/site-access-review)
- [DAG 数据访问治理报告（oversharing/EEEU/敏感标签）](https://learn.microsoft.com)（SharePoint 管理中心 Reports → Data access governance）
- [Okta Access Requests 入门（dashboard 请求/委托/审批链）](https://help.okta.com)、[Okta 开发者文档（My Requests / request sequences）](https://developer.okta.com)
- [Box 过期共享链接与自动过期协作者（时钟图标）](https://support.box.com)、[Box open links 默认 14 天](https://pulse.box.com)
- [Google Drive 访问到期（share 对话框 Add expiration）](https://workspaceupdates.googleblog.com)、[Drive API expirationTime](https://filerev.com)
- [SharePoint Anyone 链接过期默认（30 天/最大天数）](https://vladtalkstech.com)、[SharePoint Maven 链接过期设置](https://sharepointmaven.com)
- [Entra Conditional Access Block 策略（排除 break-glass 账户）](https://docs.microsoft.com)、[break-glass 基线（专用组/90 天轮换/双托管）](https://cloudgate.ae)、[BTG 审计粒度合规](https://www.riskintelligencejournal.com)（via 搜索摘要）、[ismslite：排除+单独监控](https://www.ismslite.de)
- [Purview 审计活动参考（FileAccessed/PageViewed/委派事件/去重规则）](https://learn.microsoft.com/en-us/purview/audit-log-activities)
- [Confluence「Check who can view a page」与 Viewed 事件缺陷](https://confluence.atlassian.com)、[Atlassian JIRA：审计事件无 IP](https://jira.atlassian.com)
- [Google Workspace 安全调查工具（Visibility=External）](https://knowledge.workspace.google.com/admin/security/security-checklist-for-medium-and-large-businesses-100-users)
- [断继承治理与 unique permissions 重置](https://morgantechspace.com)、[Why Breaking Inheritance is Destroying Your SharePoint](https://www.m365.fm)
- [orphaned users 扫描（Microsoft Q&A）](https://learn.microsoft.com)、[CoE Starter Kit orphan-check（owner 禁用即标记）](https://github.com)
- [Azure DevOps 权限优化（Deny only for exceptions）](https://learn.microsoft.com/en-us/azure/devops/organizations/security/optimize-permissions-performance)

---

## 来源总索引

五份报告来源清单合并去重（【N】为引用该来源的报告编号）。

**标准与授权模型**
- NIST RBAC Model（PDF）：https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=916402 【1】
- NIST CSRC RBAC：https://csrc.nist.gov/projects/role-based-access-control 【1】
- Google Zanzibar 论文页：https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/ 【1】；论文 PDF（USENIX ATC '19 镜像）：https://cs.brown.edu/courses/csci2390/2019/readings/zanzibar.pdf 【5】
- Authzed: What is Zanzibar：https://authzed.com/blog/what-is-zanzibar/ 【1】；SpiceDB schema language：https://authzed.com 【5】
- OpenFGA Concepts：https://openfga.dev/docs/concepts 【5】
- AWS IAM Policy evaluation logic：https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html 【5】
- Aserto: How Drive models authz with Zanzibar：https://www.aserto.com 【1】

**Microsoft / SharePoint / M365 / Entra**
- Understanding permission levels：https://learn.microsoft.com/en-us/sharepoint/understanding-permission-levels 【1】
- Customize permissions for a list or library：https://support.microsoft.com/en-us/office/customize-permissions-for-a-sharepoint-list-or-library-02d770f3-59eb-4910-a608-5f84cc297782 【1】
- SharePoint 授权模型（加法模型/web app policy deny/Limited Access）：https://learn.microsoft.com/en-us/sharepoint/dev/user-guides/authorization-users-groups-and-the-object-model-in-sharepoint 【5】
- Manage sharing settings：https://learn.microsoft.com/en-us/sharepoint/turn-external-sharing-on-or-off 【1】
- Change default sharing link type：https://learn.microsoft.com/en-us/sharepoint/change-default-sharing-link 【1】
- Azure deny assignments：https://learn.microsoft.com/en-us/azure/role-based-access-control/deny-assignments-list 【1】；NotActions 语义辨析：https://journeyofthegeek.com 【1】
- MS Support: Set up and manage access requests：https://support.microsoft.com/en-us/office/set-up-and-manage-access-requests-94b26e0b-2822-49d4-929a-8455698654b3 【3、5】
- Azure AI Search security filter（search.in / retrievable:false 警告）：https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search 【2】
- Microsoft Graph Search API：https://learn.microsoft.com/en-us/graph/search-concept-overview 【2】；Microsoft Learn Q&A（security trimming 不可禁用）：https://learn.microsoft.com/en-us/answers/ 【2、3】
- M365 Copilot / Semantic Index（permission-trimmed grounding）：https://techcommunity.microsoft.com 【2】；Copilot 继承用户权限/oversharing 共识：https://vladtalkstech.com 【4、5】
- Entra 权利管理：请求 https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-request-access · 批准 https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-request-approve · 过程与通知 https://docs.azure.cn/en-us/entra/id-governance/entitlement-management-process 【5】
- Entra PIM 概念（JIT/eligible/审批/MFA）：https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure 【4】；激活角色：https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-how-to-activate-role 【5】
- Entra Access Reviews：https://learn.microsoft.com/en-us/entra/id-governance/perform-access-review 【5】；SharePoint Site Access Reviews：https://learn.microsoft.com/en-us/sharepoint/site-access-review 【5】；DAG 数据访问治理报告（SharePoint 管理中心）【5】
- Entra Conditional Access（break-glass 排除）：https://docs.microsoft.com 【5】
- MS Purview Audit log activities：https://learn.microsoft.com/en-us/purview/audit-log-activities 【3、5】
- Azure DevOps 权限优化（Deny only for exceptions）：https://learn.microsoft.com/en-us/azure/devops/organizations/security/optimize-permissions-performance 【5】
- SharePoint Maven（Check user access / 链接过期）：https://sharepointmaven.com/how-to-check-user-access-and-permissions-for-a-file/ 【1、2、5】
- SharePoint StackExchange（搜索裁剪 / Check Permissions 实践）：https://sharepoint.stackexchange.com 【1、5】
- Front Row Tech: Manage access 面板：https://frontrowtech.com.au 【1】；Practical 365：https://practical365.com 【2】；VisualSP oversharing：https://www.visualsp.com 【3】；Rencore：https://rencore.com 【3】；Technisaur：https://technisaur.com.au 【3】；SharePoint Diary：https://www.sharepointdiary.com/2019/09/sharepoint-online-search-audit-logs-in-security-compliance-center.html 【3】；sharepoint.sureshc.com（Security Trimming and REST）【3】；Handsontek：https://m365admin.handsontek.net 【3】；Restricted SharePoint Search 公告：https://techcommunity.microsoft.com 【3】

**Google / Drive / Workspace**
- Drive API: manage sharing（permission 资源/allowFileDiscovery/capabilities）：https://developers.google.com/workspace/drive/api/guides/manage-sharing 【1】
- Drive API: pending access proposals（access proposal 数据结构）：https://developers.google.com/workspace/drive/api/guides/pending-access 【3】
- Share files：https://support.google.com/drive/answer/2494822 · Share folders：https://support.google.com/drive/answer/7166529 · 有限访问：https://support.google.com/drive/answer/12315692 · Stop/limit/change sharing（Access expires）：https://support.google.com/drive/answer/2494893 【1、3】
- Workspace Admin: general access 默认值：https://knowledge.workspace.google.com/admin/drive/set-general-access-sharing-options-for-your-organization 【1】
- Workspace Updates Blog（2023/06 请求红点 · 2024/11 Chat 审批 · 2025/09 权限级联 · 2025/11 到期回退）：https://workspaceupdates.googleblog.com 【1、3、5】
- How file access works in shared drives：https://support.google.com/a/users/answer/12380484 【3】；Google Groups 成员可见性：https://support.google.com/a/users/answer/10376887 【3】
- Google Workspace 安全调查工具（Visibility=External）：https://knowledge.workspace.google.com/admin/security/security-checklist-for-medium-and-large-businesses-100-users 【5】
- Lewis & Clark IT Shared Drives 指南：https://www.lclark.edu 【1】

**Atlassian / Jira**
- Confluence Cloud: page restrictions：https://support.atlassian.com/confluence-cloud/docs/add-or-remove-page-restrictions/ 【1】
- Confluence DC: permissions best practices：https://confluence.atlassian.com/doc/permissions-best-practices 【1】；DC 10.2 Page restrictions / Inspect permissions / Check who can view：https://confluence.atlassian.com 【3、5】
- Atlassian Community（受限页可见性/子页继承）：https://community.atlassian.com 【1、3】；jira.atlassian.com（Inspect permissions 无原因链的 feature request）【3】
- Jira Permission Helper（Skillbuilder/ones.com 资料）：https://www.scribd.com · https://ones.com 【3】

**Box / Notion / Figma / Okta / Cloudflare**
- Box: collaborator permission levels：https://support.box.com/hc/en-us/articles/360044196413-Understanding-Collaborator-Permission-Levels 【1】；Securing shared links：https://docs.box.com/en/box-fundamentals/for-users/collaborating/using-shared-links/securing-shared-links 【3】；Enterprise Settings（自动过期策略）：https://docs.box.com/en/box-admin-tools/box-admin-reference/enterprise-settings-content-sharing-tab 【3】；User Activity Report：https://docs.box.com 【3】；open links 默认 14 天：https://pulse.box.com 【5】
- Notion: Sharing & permissions：https://www.notion.com/help/sharing-and-permissions 【1、3】
- Figma Help / Forum：https://help.figma.com · https://forum.figma.com 【3】
- Okta Access Requests：https://help.okta.com · https://developer.okta.com 【5】
- Cloudflare: Our Unified Data Platform（Town Lake）：https://blog.cloudflare.com/our-unified-data-platform/ 【3】

**检索引擎与向量库**
- Elasticsearch Document Level Security：https://www.elastic.co/guide/en/elasticsearch/reference/current/document-level-security.html 【2】
- Amazon Kendra: Filtering on user context：https://docs.aws.amazon.com/kendra/latest/dg/user-context-filter.html 【2】
- Qdrant Filtering：https://qdrant.tech/documentation/concepts/filtering/ · Filterable HNSW：https://qdrant.tech/articles/filterable-hnsw/ 【2】
- Weaviate Filters：https://docs.weaviate.io/weaviate/search/filters · vector-search：https://docs.weaviate.io/weaviate/concepts/search/vector-search 【2】 · 多租户（per-tenant shard）：https://docs.weaviate.io/weaviate/manage-data/multi-tenancy 【2、4】
- Pinecone《Accurate and Efficient Metadata Filtering in Serverless Vector DB》：https://www.pinecone.io · https://docs.pinecone.io 【2、4】
- Glean Security（Enforce source-system permissions on every read and write）：https://www.glean.com/security 【2、3】；Glean Docs: Citations：https://docs.glean.com 【2、3】；Knostic（Glean ACL 分析）：https://www.knostic.ai 【2】
- knowledge-rag 变更记录（BM25 腿过滤修复）：https://pypi.org 【2】；ntit.ai：https://ntit.ai · rubberduckdev.com · Tencent Cloud：https://intl.cloud.tencent.com 【2】

**安全事件与工程实践**
- OWASP RAG Security Cheat Sheet：https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html 【4】；OWASP Top 10 for LLM Applications：https://genai.owasp.org/llm-top-10/ 【4】
- PromptArmor: Slack AI 数据外传（2024-08）：https://promptarmor.substack.com/p/data-exfiltration-from-slack-ai-via-indirect-prompt-injection · https://www.techradar.com 【4】
- The Register: Copilot 劫持研究（Bargury, Black Hat 2024, ASCII smuggling）：https://www.theregister.com/2024/08/28/copilot_black_hat/ 【4】
- Ragaboutit: The Ultimate Guide to RAG Authorization：https://ragaboutit.com/the-ultimate-guide-to-rag-authorization/ 【4】
- tianpan.co（permission leak rate / read-after-write race）：https://tianpan.co 【2】；RapidFlare（per-source permission split）：https://blog.rapidflare.ai 【2】；qaskills RAG QA 指南：https://qaskills.sh 【2】
- Multi-tenant 模式对比（Enterprise RAG Playbook）：https://llmops.report · https://petronellatech.com 【4】
- GitHub REST API（404 而非 403 惯例）：https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api 【4】
- ox.security: AI Security Testing：https://ox.security 【4】；Veza（break-glass 双账户）：https://veza.com 【4】
- break-glass 基线：https://cloudgate.ae · https://www.ismslite.de · BTG 审计粒度合规：https://www.riskintelligencejournal.com 【5】
- 断继承治理：https://morgantechspace.com · https://www.m365.fm 【5】；orphaned users 扫描（Microsoft Q&A）· CoE Starter Kit orphan-check：https://github.com 【5】
- beri.net: Buy the Permission Model：https://www.beri.net 【3】；resumelens（Permissions vs Restrictions）：https://www.resumelens.org 【3】

**学术（攻击、防御与密码学）**
- Anderson, Amit, Goldsteen — Is My Data in Your Retrieval Database? MIA Against RAG（arXiv 2405.20446, ICISSP 2025）：https://arxiv.org/abs/2405.20446 【2、4】
- Riddle Me This! Stealthy MIA on RAG（arXiv 2502.00306）：https://arxiv.org/abs/2502.00306 【4】
- Mask-based MIA for RAG（arXiv 2410.20142；ACM 版见 dl.acm.org）：https://arxiv.org/abs/2410.20142 【2、4】
- MIA in RAG（BM25/TF-IDF 行为泄漏, IEEE）：https://ieeexplore.ieee.org/abstract/document/11700574 【2、4】
- Generating Is Believing（IEEE 2025）：https://ieeexplore.ieee.org 【2】；BudgetLeak：https://arxiv.org 【2】；Choi et al. 防御（ACL 2025）：https://aclanthology.org 【2】
- ConfAIde（ICLR 2024 Spotlight, arXiv 2310.17884）：https://arxiv.org/abs/2310.17884 【4】
- ALCE（EMNLP 2023, Princeton NLP）：https://github.com/princeton-nlp/ALCE 【4】
- RAG 形式化威胁模型（ICDMW 2025, arXiv 2509.20324）：https://arxiv.org/abs/2509.20324 【4】
- HONEYBEE: RBAC for Vector DBs via Dynamic Partitioning（SIGMOD 2026, arXiv 2505.01538）：https://arxiv.org/abs/2505.01538 【4】
- A Framework for Formalizing LLM Agent Security（confused deputy）：https://arxiv.org/abs/2503.07149 【4】
- Cash et al. — Count Attack（CRYPTO 2015）/ Leakage-Abuse Attacks（ACM 2015）：https://link.springer.com/chapter/10.1007/978-981-10-7302-1_9 · https://dl.acm.org 【2、4】
- Volume Attacks（Univ. of Bristol）：https://research-information.bris.ac.uk/en/publications/encrypted-databases-new-volume-attacks-against-range-queries 【2、4】
- IACR ePrint: Why Your Encrypted Database Is Not Secure：https://eprint.iacr.org 【2】；SEAL/SPARTA ADJ-PADDING：https://www.zekemilay.com 【2】
- Pisces: Cryptography-based Private RAG：https://openreview.net 【2】；SecureRAG（Bassit et al.）：https://openreview.net 【2】；THOR（CCS 2025）：https://desilo.ai 【2】；SD-RAG（arXiv 2026.1）：https://arxiv.org 【2】
- van Hoboken（UvA）Bing「results removed」提示研究：https://pure.uva.nl 【2】

---

## 事实更正记录

**Google《S2: Secured Sentences》论文经查证不存在。**

- 原始任务前提中引用的「Google《S2: Secured Sentences》（2025）：per-sentence 加密、推理期过滤不解密」**未能在任何公开学术索引中找到可验证的原始出处**。查证渠道与结果：arXiv API 精确短语检索 **0 命中**；Google/Bing 多轮变体检索（"Secured Sentences" + RAG / encryption / Google Research / Cloud Next）**0 命中**；OpenReview / ACM / Usenix 定向检索 **0 命中**；Semantic Scholar **0 命中**。公开网络中 "secured sentences" 短语仅出现在刑法新闻报道中。结论：该论文很可能不存在、或名称被误记、或未被任何公开索引收录（详见报告2 第 0 节及文末「重要更正」）。
- **真实替代文献**（支撑同一论点「权限判定应发生在密文上、解密只发生在授权之后」）：
  - **Pisces: Cryptography-based Private RAG**（OpenReview, X. Liang et al.）——加密检索 + 安全 LLM 推理，生成加密响应；
  - **THOR**（DESILO / 汉阳大学，ACM CCS 2025）——FHE 密文上运行 BERT 级推理；
  - **SecureRAG: End-to-End Secure RAG**（OpenReview, Bassit et al.）——强制访问控制同时缓解 prompt 注入、数据抽取、embedding 泄露；
  - **SD-RAG**（arXiv 2026.1）——RAG 中的选择性披露（Selective Disclosure）。
- **影响范围**：该错误前提仅影响报告2（调研期内已自行发现并替换，报告正文中相应论点均由可验证文献与真实系统支撑）；报告1/3/4/5 未引用该论文。本归档的「结论速览」第 4 节中的检索安全分层结论全部来自 Azure AI Search / Elasticsearch DLS / Amazon Kendra / OWASP 等可验证来源。
- **易混淆说明**：报告4 内部来源编号 [S2] 指另一篇真实论文——RAG 形式化威胁模型（ICDMW 2025, arXiv:2509.20324），与被证伪的 Google「S2: Secured Sentences」无关。
