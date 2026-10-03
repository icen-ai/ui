/* 知识库族组件文档 —— 权限域（kb-perm）分片。 */
import type { ComponentDoc } from './components';

/**
 * 本分片覆盖 docs/spec/kb-family.md §9.1–9.5：kb-acl（SharePoint 权限页范式）/
 * kb-who-can（Check Permissions / view-as，差异化组件）/ kb-access（Drive 申请流 + 状态机）/
 * kb-audit（Purview 审计骨架 + 权限异味）/ kb-visibility（检索可见性对照，admin/审计专用）。
 * 安全纪律总纲见 spec §9.0：对授权侧诚实、对受限侧沉默；「不知道」与「不能说」不可区分。
 * script 为纯 JS（new Function 执行，禁 TS / 嵌套反引号），形参为各 behavior 模块的
 * camelCase + 'Mod'（kbAclMod / kbWhoCanMod / kbAccessMod / kbAuditMod / kbVisibilityMod），
 * 判空调用（模块未加载时 demo 里的静态 CSS 骨架仍然可见）。
 */
export const KB_DOCS_PERM: ComponentDoc[] = [
  {
    slug: 'kb-acl',
    name: '文档权限面板',
    group: '知识库',
    desc: 'SharePoint 权限页范式的资源级 ACL 面板：继承 banner 三态（继承含父链 / 已断继承警示 / 例外 N 项 is-partial）、授权行主体五类（user/group/org/anyone/link，组行带「24 成员 · 由 IT 管理」注记）、显式 deny 一票否决置顶红（order:-1）、Limited Access 类系统行不可删（is-system 隐藏删除钮）、链接授权带范围与到期（is-expiring）、exposureCount 过度授权警示「对 1,204 人可见」（不去重计数）。renderKbAcl(el, model, opts?) 快照渲染；求值语义（先显式 deny → allow 并集 → 默认拒绝）由 kb-core evaluateAcl 提供。',
    demo: `<div id="kb-acl-demo">
  <section class="kb-acl">
    <div class="kb-acl-inherit">继承自：公司库 <span class="kb-acl-chain-link">›</span> 财务部空间 <span class="kb-meta">例外 1 项</span></div>
    <div class="kb-acl-grant is-deny">
      <span class="kb-acl-subject" data-kind="user">竞对黑名单</span>
      <span class="kb-acl-role kb-chip">拒绝</span>
      <span class="kb-acl-meta">直接 · 一票否决</span>
    </div>
    <div class="kb-acl-grant">
      <span class="kb-acl-subject" data-kind="group">finance-team</span>
      <span class="kb-acl-role kb-chip">可编辑</span>
      <span class="kb-acl-meta">继承自 财务部空间 · 24 成员 · 由 IT 管理</span>
    </div>
    <div class="kb-acl-grant is-system">
      <span class="kb-acl-subject" data-kind="org">Limited Access</span>
      <span class="kb-acl-role kb-chip">可查看</span>
      <span class="kb-acl-meta">系统管理 · 不可手工增删</span>
    </div>
    <footer class="kb-acl-foot">
      <span class="kb-meta">对 <span class="kb-num">1,204</span> 人可见</span>
    </footer>
  </section>
</div>
<p class="demo-label" id="kb-acl-log" style="margin-top:8px">deny 行置顶红 · 组织内链接行 2026-11-01 到期（is-expiring）· 系统行无删除钮 · 底部「对 1,204 人可见」为过度授权警示</p>`,
    usage: `import { renderKbAcl } from '@icen.ai/ui/kit/kb-acl';

const request = {
  resource: '2026 财务规划',
  parentChain: ['公司库', '财务部空间'],   // 继承 banner 父链；broken: true 转已断警示态
  broken: false,
  exceptions: { label: 'Q3 并购草案.docx', count: 1 },   // 部分继承（例外 N 项，is-partial）
  entries: [
    { subject: { kind: 'group', id: 'finance-team', label: 'finance-team', note: '24 成员 · 由 IT 管理' },
      role: 'editor', inheritedFrom: '财务部空间' },
    { subject: { kind: 'user', id: 'u-lisi', label: '李四' }, role: 'owner' },
    { subject: { kind: 'user', id: 'u-rival', label: '竞对黑名单' }, role: 'viewer', deny: true },  // 一票否决置顶
    { subject: { kind: 'org', id: 'sys-limited', label: 'Limited Access', note: '系统自动' },
      role: 'viewer', system: true },                                                               // 系统行不可删
  ],
  links: [
    { subject: { kind: 'link', id: 'l-org', label: '组织内任何有链接者' },
      role: 'viewer', expiresAt: '2026-11-01T00:00:00.000Z' },   // 到期一等公民
  ],
  exposureCount: 1204,              // 「对 1,204 人可见」过度授权警示（不去重计数）
};
renderKbAcl(el, request, {
  onGrant: () => openSubjectPicker(),                     // 与 icen:kb-acl-grant 双通道
  onRemove: (subject) => api.revoke(subject.id),          // 与 icen:kb-acl-remove 双通道
  onBreak: () => api.breakInheritance(request.resource),  // 与 icen:kb-acl-inherit {action:'break'} 双通道
  onRestore: () => api.restoreInheritance(request.resource),
});
// 事件：icen:kb-acl-grant {} / icen:kb-acl-remove {subject} / icen:kb-acl-inherit {action:'break'|'restore'}`,
    behaviors: ['kb-acl'],
    script: `const host = document.getElementById('kb-acl-demo');
const log = document.getElementById('kb-acl-log');
if (host && kbAclMod) {
  kbAclMod.renderKbAcl(host, {
    resource: '2026 财务规划',
    parentChain: ['公司库', '财务部空间'],
    broken: false,
    exceptions: { label: 'Q3 并购草案.docx', count: 1 },
    exposureCount: 1204,
    entries: [
      { subject: { kind: 'org', id: 'org-all', label: '全体员工' }, role: 'viewer', inheritedFrom: '公司库' },
      { subject: { kind: 'group', id: 'finance-team', label: 'finance-team', note: '24 成员 · 由 IT 管理' }, role: 'editor', inheritedFrom: '财务部空间' },
      { subject: { kind: 'group', id: 'auditors', label: 'auditors', note: '6 成员' }, role: 'viewer' },
      { subject: { kind: 'user', id: 'u-lisi', label: '李四' }, role: 'owner' },
      { subject: { kind: 'user', id: 'u-rival', label: '竞对黑名单' }, role: 'viewer', deny: true },
      { subject: { kind: 'org', id: 'sys-limited', label: 'Limited Access', note: '系统自动' }, role: 'viewer', system: true }
    ],
    links: [
      { subject: { kind: 'link', id: 'l-org', label: '组织内任何有链接者' }, role: 'viewer', expiresAt: '2026-11-01T00:00:00.000Z' }
    ]
  });
  host.addEventListener('icen:kb-acl-inherit', function (e) {
    if (log) log.textContent = 'icen:kb-acl-inherit · ' + (e.detail.action === 'break' ? '停止继承（本项转独立权限）' : '恢复继承（重新跟随父容器）');
  });
  host.addEventListener('icen:kb-acl-remove', function (e) {
    if (log) log.textContent = 'icen:kb-acl-remove · ' + (e.detail.subject ? e.detail.subject.label : '');
  });
  host.addEventListener('icen:kb-acl-grant', function () {
    if (log) log.textContent = 'icen:kb-acl-grant · 打开主体选择器（宿主实现）';
  });
}`,
  },
  {
    slug: 'kb-who-can',
    name: '有效权限检查器',
    group: '知识库',
    desc: 'SharePoint「Check Permissions」/ Jira Permission Helper 范式的 view-as 检查器（差异化组件——Confluence 连原因链都没做全，业界缺口即本组件定位）：固定身份集下拉（来自服务端验证 token，不接受自由输入——Kendra 自报身份教训）→ 结论（有效角色 / 无权限 / 被策略拒绝）+ 扁平原因链（继承 / 直接 / 链接来源逐条列出，不做树）+ 叠加规则说明（多来源并集取权限序最大；deny 一票否决置顶红）。renderKbWhoCan(el, { identities, entries, evaluate? }) → handle { setIdentity(id), getResult() }；evaluate 缺省 = kb-core evaluateAcl（先显式 deny → allow 并集 → 默认拒绝 fail-closed）。',
    demo: `<div id="kb-whocan-demo">
  <div class="kb-whocan">
    <div class="kb-whocan-bar"><span class="kb-meta">身份：固定身份集（服务端 token，不接受自由输入）</span></div>
    <div class="kb-whocan-result">
      <div class="kb-whocan-verdict">可编辑（Editor）</div>
      <ul class="kb-whocan-chain">
        <li class="kb-whocan-reason"><span class="kb-badge">继承</span> 财务部空间 · finance-team · Editor <span class="kb-meta">24 成员 · 由 IT 管理</span></li>
        <li class="kb-whocan-reason"><span class="kb-badge">继承</span> 公司库 · 全体员工 · Viewer <span class="kb-meta">org</span></li>
      </ul>
      <div class="kb-whocan-rule">叠加规则：多来源并集 → Editor；无 Deny 生效</div>
    </div>
  </div>
</div>
<p class="demo-label" id="kb-whocan-log" style="margin-top:8px">下拉切换身份 → 结论 + 原因链即时重算（并集取权限序最大；deny 一票否决置顶红）</p>`,
    usage: `import { renderKbWhoCan } from '@icen.ai/ui/kit/kb-who-can';

const whocan = renderKbWhoCan(el, {
  // 身份集来自服务端验证 token 的固定集合——不接受自由输入（Kendra 自报身份教训）
  identities: [
    { user: 'zhangsan', label: '张三 · 华东销售部', groups: ['sales-east', 'project-q3'] },
    { user: 'wangwu', label: '王五 · 财务部', groups: ['finance-team', 'auditors'] },
    { user: 'auditor', label: '系统审计员', groups: ['auditors', 'compliance'] },
  ],
  entries: aclModel.entries,   // 与 kb-acl 面板同源；evaluate 缺省 = kb-core evaluateAcl
  // evaluate: (entries, identity, policy) => myPolicy.evaluate(entries, identity),   // 可注入宿主策略
});
whocan.setIdentity('wangwu');         // 以 user id 切换 view-as 身份
const decision = whocan.getResult();  // KbAclDecision：role / visibility / chain[] / deniedBy? / expiresAt?
// 事件：icen:kb-whocan-check {identity, decision}——原因链为扁平清单，不做树（Check Permissions 范式）`,
    behaviors: ['kb-who-can'],
    script: `const host = document.getElementById('kb-whocan-demo');
const log = document.getElementById('kb-whocan-log');
if (host && kbWhoCanMod) {
  const h = kbWhoCanMod.renderKbWhoCan(host, {
    identities: [
      { user: 'zhangsan', label: '张三 · 华东销售部', groups: ['sales-east', 'project-q3'] },
      { user: 'wangwu', label: '王五 · 财务部', groups: ['finance-team', 'auditors'] },
      { user: 'auditor', label: '系统审计员', groups: ['auditors', 'compliance'] }
    ],
    entries: [
      { subject: { kind: 'org', id: 'org-all', label: '全体员工' }, role: 'viewer', inheritedFrom: '公司库' },
      { subject: { kind: 'group', id: 'finance-team', label: 'finance-team', note: '24 成员 · 由 IT 管理' }, role: 'editor', inheritedFrom: '财务部空间' },
      { subject: { kind: 'group', id: 'auditors', label: 'auditors' }, role: 'viewer' },
      { subject: { kind: 'user', id: 'u-lisi', label: '李四' }, role: 'owner' },
      { subject: { kind: 'user', id: 'u-rival', label: '竞对黑名单' }, role: 'viewer', deny: true }
    ]
  });
  /* 演示并集：王五 = finance-team(Editor) ∪ auditors(Viewer) ∪ 全体员工(Viewer) → Editor */
  h.setIdentity('wangwu');
  host.addEventListener('icen:kb-whocan-check', function (e) {
    const d = e.detail || {};
    const who = d.identity ? (d.identity.label || d.identity.user) : '';
    const role = d.decision && d.decision.role ? d.decision.role : '无权限（默认拒绝）';
    const denied = d.decision && d.decision.deniedBy ? ' · 被策略拒绝：' + d.decision.deniedBy.label : '';
    if (log) log.textContent = 'icen:kb-whocan-check · ' + who + ' → ' + role + denied + '（原因链扁平清单）';
  });
}`,
  },
  {
    slug: 'kb-access',
    name: '访问申请流',
    group: '知识库',
    desc: 'Google Drive「请求访问」范式的访问申请流：被拒五件套（资源名 / 原因 / owner / 申请入口 / 切换身份）+ 申请表单（理由可必填、角色与时长、路由明示「请求将发送给：内容 owner 李四」——Confluence 十年路由踩坑的解）+ 九态状态机徽章族（idle → requested → pending_review → granted(expiresAt 倒计时) → expiring → expired → 重交；revoked 审批侧撤销；denied 不做刺眼红色终态——业界静默默契）+ mode="approver" 审批方视角（请求卡 + 批准选权限级 / 拒绝附留言）。createKbAccess(el, { request, mode?, onRequest?, onDecide? }) → handle { setState(next), getState() }；到期是一等公民：每条 grant 可带 expiresAt 三态呈现（永不过期 / 倒计时+续期 / 已过期+重交）。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <button class="btn btn-sm" type="button" id="kb-access-advance">推进状态机 →</button>
</div>
<div id="kb-access-demo">
  <div class="kb-access" data-state="idle">
    <div class="kb-access-denied">
      <div class="kb-access-title">2026 财务规划</div>
      <p class="kb-access-why">你没有访问权限——「不知道」与「不能说」不可区分（GitHub 404 惯例），此处仅提示可申请。</p>
      <div class="kb-access-owner">内容负责人：李四（财务部）</div>
    </div>
    <div class="kb-access-state"><span class="kb-chip" data-state="idle">未申请</span></div>
  </div>
</div>
<p class="demo-label" id="kb-access-log" style="margin-top:8px">点「推进状态机」：未申请 → 已提交（路由明示给内容负责人）→ 已开通（30 天到期倒计时）→ 已过期（中性「可重新申请」）→ 回到未申请</p>`,
    usage: `import { createKbAccess } from '@icen.ai/ui/kit/kb-access';
import type { KbAccessRequest } from '@icen.ai/ui/kit/kb-core';

const request: KbAccessRequest = {
  id: 'req-2026-1101', requester: '张三', resource: '2026 财务规划', role: 'viewer',
  reason: 'Q4 区域预算对齐需要财务口径', state: 'idle',
  submittedAt: new Date().toISOString(),
  approverNote: '内容负责人：李四（财务部）',   // 路由明示（页面级找 owner / 空间级找 admin）
};
const access = createKbAccess(el, {
  request,
  onRequest: (r) => api.submit(r),                        // 与 icen:kb-access-request 双通道
  onDecide: (d) => api.decide(d.id, d.decision, d.role),  // 与 icen:kb-access-decide 双通道
});
access.setState({ ...request, state: 'granted', decidedBy: '李四', decidedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() });   // 到期一等公民
access.getState();   // 当前 KbAccessRequest 快照
// 事件：icen:kb-access-request {request} / -decide {id, decision, role?} / -expire {id}`,
    behaviors: ['kb-access'],
    script: `const host = document.getElementById('kb-access-demo');
const log = document.getElementById('kb-access-log');
const tlog = function (msg) { if (log) log.textContent = msg; };
if (host && kbAccessMod) {
  const req = {
    id: 'req-2026-1101', requester: '张三', resource: '2026 财务规划', role: 'viewer',
    reason: 'Q4 区域预算对齐需要财务口径', state: 'idle',
    submittedAt: new Date().toISOString(),
    approverNote: '内容负责人：李四（财务部）'
  };
  const h = kbAccessMod.createKbAccess(host, {
    request: req,
    onRequest: function (r) { tlog('icen:kb-access-request · ' + r.requester + ' → ' + (r.approverNote || 'owner')); }
  });
  const NEXT = ['requested', 'granted', 'expired', 'idle'];
  const LABEL = {
    requested: '已提交——路由给内容负责人李四（approverNote 明示）',
    granted: '已批准 viewer——30 天到期，倒计时与续期入口就位',
    expired: '已过期——中性呈现「可重新申请」，不做刺眼终态',
    idle: '回到未申请——被拒五件套重新出现'
  };
  let step = 0;
  document.getElementById('kb-access-advance')?.addEventListener('click', function () {
    step = (step + 1) % NEXT.length;
    req.state = NEXT[step];
    if (req.state === 'granted') {
      req.decidedBy = '李四';
      req.decidedAt = new Date().toISOString();
      req.expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    }
    h.setState(req);
    tlog('setState → ' + req.state + ' · ' + LABEL[req.state]);
  });
}`,
  },
  {
    slug: 'kb-audit',
    name: '权限审计时间线',
    group: '知识库',
    desc: 'Microsoft Purview / Box 审计骨架的权限时间线：通道过滤 chips（全部 / 读取 / 权限变更 / 申请 / 系统）+ 导出 CSV；权限异味节（admin 治理发现六枚举：过度暴露 / 组织级链接 / 过宽组授权 / 敏感度错配 / 断继承 / 负责人缺位——源系统权限卫生问题，RAG 只是放大器）分高 / 中 / 低级；时间线行 actor 三类（human / app / system），读取与预览分列（Purview 范式）；break-glass 行常驻警示色 +「实时告警已通知安全团队」，审计粒度 ≥ 常规。renderKbAudit(el, { entries, hygiene? }) 快照 + initKbAudit(root?) document 级委托（通道过滤 / 导出 / 异味处置）；同用户同资源 5 分钟读取去重是数据侧纪律——UI 不重复渲染也不声明条数。',
    demo: `<div id="kb-audit-demo">
  <div class="kb-audit">
    <div class="kb-audit-bar">
      <div class="kb-audit-channels">
        <button class="kb-chip" type="button" aria-pressed="true">全部</button>
        <button class="kb-chip" type="button" aria-pressed="false">读取</button>
        <button class="kb-chip" type="button" aria-pressed="false">权限变更</button>
      </div>
    </div>
    <div class="kb-audit-hygiene">
      <div class="kb-hygiene is-high"><span class="kb-badge">过度暴露</span> 2026 财务规划 <span class="kb-meta">对 1,204 人可见</span> <button class="kb-hygiene-act kb-chip" type="button">处置</button></div>
    </div>
    <ol class="kb-audit-list">
      <li class="kb-audit-entry is-breakglass"><span class="kb-audit-at kb-num">10-03 14:22</span><span class="kb-audit-actor" data-kind="app">系统审计员</span><span class="kb-audit-action kb-chip">应急访问</span><span class="kb-audit-detail">双人复核中</span></li>
      <li class="kb-audit-entry"><span class="kb-audit-at kb-num">10-03 13:05</span><span class="kb-audit-actor" data-kind="human">张三</span><span class="kb-audit-action kb-chip">读取</span><span class="kb-audit-detail">全文读取</span></li>
    </ol>
  </div>
</div>
<p class="demo-label" id="kb-audit-log" style="margin-top:8px">通道 chips 过滤时间线 · 异味行「处置」与「导出 CSV」走事件 · break-glass 行常驻警示（审计粒度 ≥ 常规）</p>`,
    usage: `import { renderKbAudit, initKbAudit } from '@icen.ai/ui/kit/kb-audit';

initKbAudit();   // document 级委托（通道过滤 / 导出 / 异味处置；幂等 + 返回销毁函数）
renderKbAudit(el, {
  entries: [
    { id: 'au-1', at: new Date().toISOString(), actor: { kind: 'human', name: '张三' },
      action: 'read', resource: '2026 财务规划', detail: '全文读取' },
    { id: 'au-2', at: new Date().toISOString(), actor: { kind: 'app', name: '系统审计员' },
      action: 'break_glass', resource: 'Q3 并购草案.docx', detail: '双人复核中', breakGlass: true },
  ],
  hygiene: [
    { id: 'hyg-1', kind: 'overexposed', resource: '2026 财务规划', metric: '对 1,204 人可见',
      hint: '继承链带来的宽授权——按最小知悉改为定向组', severity: 'high' },
  ],
});
// 事件：icen:kb-audit-filter {channel} / icen:kb-audit-export {channel} / icen:kb-hygiene-action {issue}
// 读取去重（同用户同资源 5 分钟）是数据侧纪律——UI 不重复渲染，也不声明条数`,
    behaviors: ['kb-audit'],
    behaviorInit: { 'kb-audit': 'initKbAudit' },
    script: `const host = document.getElementById('kb-audit-demo');
const log = document.getElementById('kb-audit-log');
const ago = function (ms) { return new Date(Date.now() - ms).toISOString(); };
if (host && kbAuditMod) {
  kbAuditMod.renderKbAudit(host, {
    entries: [
      { id: 'au-8', at: ago(18 * 60000), actor: { kind: 'human', name: '李四' }, action: 'revoke', resource: '2026 财务规划', detail: '收回张三的 viewer 授权（项目结项）' },
      { id: 'au-7', at: ago(46 * 60000), actor: { kind: 'app', name: '系统审计员' }, action: 'break_glass', resource: 'Q3 并购草案.docx', detail: '双人复核中', breakGlass: true },
      { id: 'au-6', at: ago(2 * 3600000), actor: { kind: 'system', name: '权限服务' }, action: 'sync', resource: '2026 财务规划', detail: '与源系统对齐授权（3 条变更落库）' },
      { id: 'au-5', at: ago(3 * 3600000), actor: { kind: 'human', name: '李四' }, action: 'approve', resource: '2026 财务规划', detail: '批准张三的申请：viewer（30 天到期）' },
      { id: 'au-4', at: ago(4 * 3600000), actor: { kind: 'human', name: '张三' }, action: 'request', resource: '2026 财务规划', detail: '申请 viewer：Q4 区域预算对齐' },
      { id: 'au-3', at: ago(26 * 3600000), actor: { kind: 'human', name: '李四' }, action: 'permission_change', resource: '财务部空间', detail: 'finance-team：Viewer → Editor（权限下放）' },
      { id: 'au-2', at: ago(30 * 3600000), actor: { kind: 'human', name: '王五' }, action: 'preview', resource: '2026 财务规划', detail: '预览摘要，未下载原文' },
      { id: 'au-1', at: ago(50 * 3600000), actor: { kind: 'human', name: '张三' }, action: 'read', resource: '2026 财务规划', detail: '全文读取（检索引用进入）' }
    ],
    hygiene: [
      { id: 'hyg-1', kind: 'overexposed', resource: '2026 财务规划', metric: '对 1,204 人可见', hint: '继承链宽授权——按最小知悉改为定向组', severity: 'high' },
      { id: 'hyg-2', kind: 'org_wide_link', resource: '供应商名录', metric: '组织内链接 · 28 天', hint: '组织级链接长期存在——改为指定人员并设短到期', severity: 'high' },
      { id: 'hyg-3', kind: 'broken_inheritance', resource: 'Q3 并购草案.docx', metric: '1 个子项断继承', hint: '断开后不随父容器收紧——复核是否必要', severity: 'medium' },
      { id: 'hyg-4', kind: 'orphaned_owner', resource: '离职交接清单', metric: '负责人已禁用', hint: '尽快移交 owner，避免审批无人路由', severity: 'medium' }
    ]
  });
  host.addEventListener('icen:kb-audit-filter', function (e) {
    if (log) log.textContent = 'icen:kb-audit-filter · ' + e.detail.channel;
  });
  host.addEventListener('icen:kb-audit-export', function (e) {
    if (log) log.textContent = 'icen:kb-audit-export · ' + e.detail.channel + '（宿主生成 CSV）';
  });
  host.addEventListener('icen:kb-hygiene-action', function (e) {
    if (log) log.textContent = 'icen:kb-hygiene-action · ' + (e.detail.issue ? e.detail.issue.resource : '');
  });
}`,
  },
  {
    slug: 'kb-visibility',
    name: '检索可见性对照器',
    group: '知识库',
    desc: 'admin/审计专用的检索可见性对照器（安全对照组件，组件头常驻警示条：命中差异对照对普通用户构成泄露——任何随受限集合变化的可观察量都是侧信道）：固定身份集 × 同一查询的命中对照网格，每身份一列（有效角色 + 授权集合内安全计数 + 命中列表），可见性五级呈现（hidden 不渲染 / metadata 锁+标题+打码+申请 / restricted 附申请通道 / summary AI 摘要可见原文不可用 / full 正常）；过滤层徽标三态（pre ✓ 唯一安全基线——ANN 与 BM25 两侧同时生效 / post ⚠ 分数已可观察——缺陷层 / none ✕ fail-open——Kendra 教训）；教学段讲 volume leakage 与 padding 取整缓解。renderKbVisibility(el, { query, identities, hits, evaluateHit }) → handle { setFilterLayer(l), getVisibility(id, hit) }。',
    demo: `<div id="kb-visibility-demo">
  <div class="kb-visibility">
    <div class="kb-visibility-warn">admin 审计视图——勿嵌入终端用户界面</div>
    <div class="kb-visibility-bar"><span class="kb-meta">身份 chip 组 · 查询回显 · 过滤层徽标（pre ✓ / post ⚠ / none ✕）</span></div>
    <div class="kb-visibility-grid">
      <div class="kb-visibility-col">
        <header>张三 · 华东销售部</header>
        <div class="kb-visibility-count kb-num">安全计数 4</div>
        <div class="kb-visibility-hit" data-visibility="metadata"><span>2026 财务规划</span><span class="kb-visibility-snippet"></span></div>
      </div>
      <div class="kb-visibility-col">
        <header>王五 · 财务部</header>
        <div class="kb-visibility-count kb-num">安全计数 6</div>
        <div class="kb-visibility-hit" data-visibility="full"><span>2026 财务规划</span><span class="kb-visibility-snippet">含 Q4 预算缺口与降本目标……</span></div>
      </div>
      <div class="kb-visibility-col">
        <header>系统审计员</header>
        <div class="kb-visibility-count kb-num">安全计数 5</div>
        <div class="kb-visibility-hit" data-visibility="summary"><span>并购意向简报</span><span class="kb-visibility-summary">拟收购标的与估值区间（AI 摘要可见，原文受限）</span></div>
      </div>
    </div>
    <div class="kb-visibility-lesson">计数差异 = volume leakage（缓解只有 padding 取整）；post-filter 的分数已可观察；fail-open 是 Kendra 无 UserContext 的教训。</div>
  </div>
</div>
<p class="demo-label" id="kb-visibility-log" style="margin-top:8px">切身份 chip / 过滤层徽标派发事件 · metadata 列打码、summary 列给 AI 摘要、hidden 不渲染 · 此对照仅 admin 审计可用</p>`,
    usage: `import { renderKbVisibility } from '@icen.ai/ui/kit/kb-visibility';
import type { KbVisibility } from '@icen.ai/ui/kit/kb-core';

const vis = renderKbVisibility(el, {
  query: 'Q3 目标 · 财务规划 · 供应商准入',
  identities: [                       // 固定身份集（服务端 token；不接受自由输入）
    { user: 'zhangsan', label: '张三 · 华东销售部', groups: ['sales-east', 'project-q3'] },
    { user: 'wangwu', label: '王五 · 财务部', groups: ['finance-team', 'auditors'] },
    { user: 'auditor', label: '系统审计员', groups: ['auditors', 'compliance'] },
  ],
  hits: [
    { id: 'h-1', title: '2026 财务规划', snippet: '含 Q4 预算缺口与降本目标……',
      summary: '财务规划要点的 AI 摘要（原文受限）' },
  ],
  evaluateHit: (hit, identity): KbVisibility => policyEngine(identity, hit),   // 缺省走 hit 自带 visibility
});
vis.setFilterLayer('pre');                  // pre ✓（唯一安全基线）/ post ⚠（分数可观察）/ none ✕（fail-open）
vis.getVisibility('zhangsan', hits[0]!);    // 指定身份对指定命中的可见性
// 事件：icen:kb-visibility-identity {identity} / icen:kb-visibility-layer {layer}`,
    behaviors: ['kb-visibility'],
    script: `const host = document.getElementById('kb-visibility-demo');
const log = document.getElementById('kb-visibility-log');
const tlog = function (msg) { if (log) log.textContent = msg; };
if (host && kbVisibilityMod) {
  const IDENTITIES = [
    { user: 'zhangsan', label: '张三 · 华东销售部', groups: ['sales-east', 'project-q3'] },
    { user: 'wangwu', label: '王五 · 财务部', groups: ['finance-team', 'auditors'] },
    { user: 'auditor', label: '系统审计员', groups: ['auditors', 'compliance'] }
  ];
  const HITS = [
    { id: 'pv-h1', title: '供应商准入手册 v4.2', snippet: '第三章 准入材料清单。营业执照副本、近两年审计报告……' },
    { id: 'pv-h2', title: '准入材料清单', snippet: '五类材料：营业执照 / 审计报告 / 体系认证 / 检测报告 / 环保声明' },
    { id: 'pv-h3', title: '流程与账期', snippet: '在线提交 → 资质初审（5 个工作日）→ 现场审核 → 分级评定' },
    { id: 'pv-h4', title: '2026 财务规划', snippet: '含 Q4 预算缺口与降本目标……', summary: '财务规划要点的 AI 摘要（原文受限）' },
    { id: 'pv-h5', title: '并购意向简报', snippet: '拟收购标的与估值区间……', summary: '董事会简报的 AI 摘要（原文受限）' },
    { id: 'pv-h6', title: 'Q3 目标', snippet: '华东大区 Q3 新签目标 1.2 亿，同比 +18%……' }
  ];
  /* 演示求值规则（写死）：财务规划/并购简报 → 王五 full、审计员 summary（AI 摘要级）、张三 metadata、其余 full；
     Q3 目标 → project-q3 组 full、其他 metadata；其余文档全部 full */
  const evaluate = function (hit, identity) {
    const t = (hit && hit.title) || '';
    if (t.indexOf('财务规划') >= 0 || t.indexOf('并购') >= 0) {
      if (identity.user === 'zhangsan') return 'metadata';
      if (identity.user === 'auditor') return 'summary';
      return 'full';
    }
    if (t.indexOf('Q3 目标') >= 0) {
      return (identity.groups || []).indexOf('project-q3') >= 0 ? 'full' : 'metadata';
    }
    return 'full';
  };
  const h = kbVisibilityMod.renderKbVisibility(host, {
    query: 'Q3 目标 · 财务规划 · 供应商准入',
    identities: IDENTITIES,
    hits: HITS,
    evaluateHit: evaluate
  });
  h.setFilterLayer('pre');
  host.addEventListener('icen:kb-visibility-identity', function (e) {
    if (e.detail && e.detail.identity) tlog('icen:kb-visibility-identity · ' + (e.detail.identity.label || e.detail.identity.user));
  });
  host.addEventListener('icen:kb-visibility-layer', function (e) {
    const layer = e.detail.layer;
    tlog('icen:kb-visibility-layer · ' + layer + (layer === 'pre' ? '（唯一安全基线）' : layer === 'post' ? '（分数已可观察——缺陷层）' : '（fail-open 危险）'));
  });
}`,
  },
];
