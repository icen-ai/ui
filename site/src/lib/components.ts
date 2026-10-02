/*
 * 组件文档注册表 —— 文档站单一数据源。
 * demo / script 拆解自原四个合集演示页（forms / overlays / data / navig）与 components 合集页。
 * behaviors 列出该页需要动态加载的 src/behaviors/*.ts 模块；behaviorInit 给出各模块的 init 函数名
 * （toast / charts / popover 无 init，靠 script 字段做额外接线）。
 */

import { cssOf } from '../../../scripts/slugs.mjs';

export interface ComponentDoc {
  slug: string;
  name: string;
  group: string;
  desc: string;
  demo: string;
  usage: string;
  behaviors?: string[];
  behaviorInit?: Record<string, string | string[]>;
  script?: string;
}
/** 组件分组的展示名（顺序即侧栏顺序）。原「数据」已拆为三组：数据展示（含表格）/ 图表 / 反馈。 */
export const GROUPS: string[] = ['基础', 'AI 原生', '表单', '数据展示', '图表', '浮层', '反馈', '导航'];

/** slug → 组件 css 文件名（单一事实源在 scripts/slugs.mjs，与 kit 入口/CLI 共享）。 */
export function cssFor(slug: string): string {
  return cssOf(slug);
}

/* ── 演示内联 SVG（与原合集页一致） ── */
const svgX = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const svgEye = `<svg data-icon="show" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const svgEyeOff = `<svg data-icon="hide" hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.16 3.19"/><path d="M6.61 6.61A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10.5 10.5 0 0 0 5.17-1.34"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
const svgSearch = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
const svgChevron = `<svg class="select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
const svgPlus = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const svgDown = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
const svgUp = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
const starSvg = `<svg viewBox="0 0 24 24" stroke-linejoin="round"><path d="M12 2.5l2.95 6.26 6.85.72-5.1 4.63 1.4 6.74L12 17.6l-6.1 3.25 1.4-6.74-5.1-4.63 6.85-.72z"/></svg>`;
const chevronSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
const accChevron = `<svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
const infoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
const checkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`;
const warnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const xSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const inboxSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`;
const avatarImg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect width='48' height='48' fill='%23d97757'/><circle cx='24' cy='18' r='8' fill='%23fffdf9'/><path d='M8 44c3-10 10-14 16-14s13 4 16 14z' fill='%23fffdf9'/></svg>`;

export const COMPONENTS: ComponentDoc[] = [
  /* ══════════ 基础 ══════════ */
  {
    slug: 'btn',
    name: '按钮',
    group: '基础',
    desc: '5 变体（默认 / primary / danger / ghost / link）+ 3 尺寸（sm / 默认 / lg）+ 图标钮 + loading spinner + 错误态 + block 通栏。',
    demo: `<div class="demo-row">
  <button class="btn">默认</button>
  <button class="btn btn-primary">主要</button>
  <button class="btn btn-danger">危险</button>
  <button class="btn btn-ghost">幽灵</button>
  <button class="btn btn-link">链接</button>
</div>
<div class="demo-row" style="margin-top:14px">
  <button class="btn btn-sm">小号</button>
  <button class="btn">默认</button>
  <button class="btn btn-lg">大号</button>
</div>
<div class="demo-row" style="margin-top:14px">
  <button class="btn btn-primary"><svg class="btn-icon-start" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>新建项目</button>
  <button class="btn btn-icon" aria-label="设置"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/></svg></button>
  <button class="btn btn-sm is-loading" aria-busy="true">加载中</button>
  <button class="btn is-error">错误态</button>
  <button class="btn btn-block">通栏按钮</button>
</div>`,
    usage: `<button class="btn">默认</button>
<button class="btn btn-primary">主要</button>
<button class="btn btn-danger">危险</button>
<button class="btn btn-ghost">幽灵</button>
<button class="btn btn-link">链接</button>

<!-- 尺寸 -->
<button class="btn btn-sm">小号</button>
<button class="btn btn-lg">大号</button>

<!-- 图标 -->
<button class="btn btn-primary">
  <svg class="btn-icon-start">…</svg>
  <span class="btn-text">文本</span>
</button>
<button class="btn btn-icon" aria-label="设置"><svg>…</svg></button>

<!-- loading（加 .is-loading + aria-busy） -->
<button class="btn is-loading" aria-busy="true">加载中</button>`,
  },
  {
    slug: 'panel',
    name: '面板',
    group: '基础',
    desc: '白卡片容器（panel）+ 标题栏（panel-title），用于承载一组相关内容。增强：副标题（panel-subtitle）、可折叠（--collapsible + .is-collapsed）、强调变体（--accent）、平面变体（--flat）。',
    demo: `<div class="panel">
  <div class="panel-title">
    <div class="panel-title-text">
      <span>面板标题</span>
      <span class="panel-subtitle">带副标题描述的示例</span>
    </div>
    <div class="panel-title-actions"><button class="btn btn-sm">刷新</button></div>
  </div>
  <div class="panel-body">
    白卡片容器 + 标题栏 + 副标题，用于承载一组相关内容。panel-subtitle 会自动缩小并转为描述色。
  </div>
  <div class="panel-foot">
    <button class="btn btn-sm">取消</button>
    <button class="btn btn-sm btn-primary">保存</button>
  </div>
</div>
<div class="panel panel--collapsible" id="demo-panel-collapse" style="margin-top:16px">
  <div class="panel-title">
    <div class="panel-title-text">
      <span>可折叠面板</span>
      <span class="panel-subtitle">点击标题栏展开/折叠</span>
    </div>
    <div class="panel-title-actions">
      <button class="panel-toggle" aria-expanded="true" type="button"><svg class="panel-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg></button>
    </div>
  </div>
  <div class="panel-body">点击右上角箭头可折叠/展开此面板内容。</div>
</div>`,
    usage: `<div class="panel [--flush] [--accent] [--flat] [--collapsible] [.is-collapsed]">
  <div class="panel-title">
    <div class="panel-title-text">
      <span>标题</span>
      <span class="panel-subtitle">副标题</span>
    </div>
    <div class="panel-title-actions">…</div>
  </div>
  <div class="panel-body">…内容…</div>
  <div class="panel-foot">…底栏…</div>
</div>`,
    script: `// 可折叠面板的演示接线
document.querySelectorAll('.panel--collapsible').forEach((panel) => {
  const toggle = panel.querySelector('.panel-toggle');
  const title = panel.querySelector('.panel-title');
  const handler = () => {
    panel.classList.toggle('is-collapsed');
    const collapsed = panel.classList.contains('is-collapsed');
    toggle?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  };
  toggle?.addEventListener('click', (ev) => ev.stopPropagation());
  title?.addEventListener('click', handler);
});`,
  },
  {
    slug: 'pill',
    name: '徽章',
    group: '基础',
    desc: '语义色状态徽章，纪律：仅绿 / 黄 / 红 + 品牌 accent。',
    demo: `<div class="demo-row">
  <span class="pill">默认</span>
  <span class="pill pill--success">正常</span>
  <span class="pill pill--warning">警告</span>
  <span class="pill pill--error">异常</span>
  <span class="pill pill--accent">强调</span>
</div>`,
    usage: `<span class="pill pill--success">运行中</span>
<span class="pill pill--warning">降级</span>
<span class="pill pill--error">已停止</span>`,
  },
  {
    slug: 'tag',
    name: '标签',
    group: '基础',
    desc: '中性展示标签（区别于 pill 的状态语义）：可选关闭按钮、选中态、图标、五档语义色与三档尺寸。',
    demo: `<div class="demo-row">
  <span class="tag">默认</span>
  <span class="tag is-selected">已选中</span>
  <span class="tag tag--accent">品牌色</span>
  <span class="tag tag--success">成功</span>
  <span class="tag tag--warning">警告</span>
  <span class="tag tag--error">错误</span>
  <span class="tag tag--info">信息</span>
</div>
<div class="demo-row" style="margin-top:14px">
  <span class="tag tag--sm">小号</span>
  <span class="tag">默认</span>
  <span class="tag tag--lg">大号</span>
</div>
<div class="demo-row" style="margin-top:14px">
  <span class="tag">
    <span class="tag-label">前端</span>
    <button class="tag-close" type="button" aria-label="移除">${svgX}</button>
  </span>
  <span class="tag">
    <span class="tag-label">设计</span>
    <button class="tag-close" type="button" aria-label="移除">${svgX}</button>
  </span>
  <span class="tag tag--accent">
    <span class="tag-label">VIP</span>
    <button class="tag-close" type="button" aria-label="移除">${svgX}</button>
  </span>
</div>`,
    usage: `<span class="tag">默认标签</span>
<span class="tag is-selected">筛选条件</span>
<span class="tag tag--accent">品牌色</span>
<span class="tag">
  <span class="tag-label">可移除</span>
  <button class="tag-close" type="button" aria-label="移除">×</button>
</span>
<!-- 语义色：tag--accent/success/warning/error/info；尺寸：tag--sm/lg -->`,
    script: `// 关闭按钮的演示接线（实际由消费方决定是否从 DOM 移除）
document.querySelectorAll('.tag-close').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tag = btn.closest('.tag');
    tag?.remove();
  });
});`,
  },
  {
    slug: 'tabs',
    name: '标签页',
    group: '基础',
    desc: '与 behaviors/tabs 配套的 data 契约分区导航——下面是可点击切换的 live demo。',
    demo: `<div data-tabs>
  <nav class="tabs">
    <button class="page-tab is-active" data-tab="overview">概览</button>
    <button class="page-tab" data-tab="usage">用法</button>
    <button class="page-tab" data-tab="api">契约</button>
  </nav>
  <section data-tab-panel="overview">
    <p>三分区可点击切换。激活态 = .is-active 类，未激活面板挂 hidden。</p>
  </section>
  <section data-tab-panel="usage" hidden>
    <p>引入 behaviors/tabs 后调用 initTabs()，事件委托在 [data-tabs] 容器上。</p>
  </section>
  <section data-tab-panel="api" hidden>
    <p>契约：data-tabs（容器）→ data-tab（页签）→ data-tab-panel（面板）；可选 data-tabs-hash 与 location.hash 同步。</p>
  </section>
</div>`,
    usage: `import { initTabs } from '@icen.ai/ui/behaviors/tabs';
initTabs(); // 激活态挂 .is-active；切换时容器派发 icen:tab-change（detail { tab, panel, index }）`,
    behaviors: ['tabs'],
    behaviorInit: { tabs: 'initTabs' },
  },
  {
    slug: 'stat',
    name: '指标卡',
    group: '基础',
    desc: 'stat-grid 自适应网格 + stat-card；支持趋势 delta、图标、交互 hover。增强：横向布局（dashboard 顶栏）、迷你 sparkline 槽、SVG 进度环、加载骨架态。',
    demo: `<div class="stat-grid">
  <div class="stat-card stat-card--interactive">
    <div class="stat-head">
      <span class="stat-label">用户总数</span>
      <span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
    </div>
    <div class="stat-body">
      <div class="stat-num">1,280</div>
      <div class="stat-delta up">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15 6-6 6 6"/></svg>
        +12.4% <span class="stat-period">比上周</span>
      </div>
    </div>
  </div>
  <div class="stat-card stat-card--interactive">
    <div class="stat-head">
      <span class="stat-label">可用性</span>
      <span class="stat-icon icon--success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg></span>
    </div>
    <div class="stat-body">
      <div class="stat-num stat-num--accent">96.2%</div>
      <div class="stat-delta up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15 6-6 6 6"/></svg> +2.1%</div>
    </div>
    <div class="stat-progress">
      <svg class="stat-ring" viewBox="0 0 36 36">
        <circle class="stat-ring-track" cx="18" cy="18" r="15.5" fill="none" />
        <circle class="stat-ring-fill" cx="18" cy="18" r="15.5" fill="none" style="stroke-dasharray:93.6,97.4" />
      </svg>
    </div>
  </div>
  <div class="stat-card stat-card--interactive">
    <div class="stat-head">
      <span class="stat-label">待处理告警</span>
      <span class="stat-icon icon--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>
    </div>
    <div class="stat-body">
      <div class="stat-num stat-num--warning">12</div>
      <div class="stat-delta down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 9-6 6-6-6"/></svg> -3 <span class="stat-period">比昨日</span></div>
    </div>
  </div>
  <div class="stat-card stat-card--horizontal">
    <div class="stat-head">
      <span class="stat-label">请求/秒</span>
      <span class="stat-icon icon--info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span>
    </div>
    <div class="stat-body">
      <div class="stat-num">8,452</div>
      <div class="stat-delta flat">— <span class="stat-period">稳定</span></div>
    </div>
  </div>
</div>`,
    usage: `<div class="stat-grid [--2|--3|--4]">
  <div class="stat-card [--interactive] [--horizontal] [--sm] [.is-loading]">
    <div class="stat-head">
      <span class="stat-label">标签</span>
      <span class="stat-icon [.icon--success|.icon--warning|.icon--error|.icon--info]">…svg…</span>
    </div>
    <div class="stat-body">
      <div class="stat-num [.stat-num--accent|.stat-num--warning|.stat-num--error|.stat-num--info]">数字</div>
      <div class="stat-delta [.up|.down|.flat]">趋势</div>
    </div>
    <div class="stat-progress">…SVG ring…</div>
  </div>
</div>`,
  },
  {
    slug: 'toast',
    name: '轻提示',
    group: '基础',
    desc: '与 behaviors/toast 配套（toast.css 提供容器与滑入动画）：toast.ok / err / warn。',
    demo: `<div class="demo-row">
  <button class="btn" id="toast-demo-ok">成功提示</button>
  <button class="btn" id="toast-demo-err">错误提示</button>
  <button class="btn" id="toast-demo-warn">警告提示</button>
</div>`,
    usage: `import { toast } from '@icen.ai/ui/behaviors/toast';
toast.ok('已保存');
toast.err('保存失败');
toast.warn('配额将尽');`,
    behaviors: ['toast'],
    script: `const toast = toastMod.toast;
document.getElementById('toast-demo-ok')?.addEventListener('click', () => toast.ok('保存成功'));
document.getElementById('toast-demo-err')?.addEventListener('click', () => toast.err('保存失败：网络超时'));
document.getElementById('toast-demo-warn')?.addEventListener('click', () => toast.warn('配额已用 80%'));`,
  },
  {
    slug: 'toolbar',
    name: '工具条',
    group: '基础',
    desc: '横向承载按钮 / 控件的容器。与 segmented 区别——toolbar 是宽松容器（可分组、可分隔、可换行），segmented 是紧贴互斥分段选择。',
    demo: `<div class="toolbar" style="margin-bottom:14px">
  <div class="toolbar-group">
    <button class="btn btn-sm" aria-label="加粗"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg></button>
    <button class="btn btn-sm" aria-label="斜体"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg></button>
    <button class="btn btn-sm" aria-label="下划线"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg></button>
  </div>
  <span class="toolbar-separator"></span>
  <div class="toolbar-group">
    <button class="btn btn-sm" aria-label="左对齐"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="15" y1="12" y2="12"/><line x1="3" x2="18" y1="18" y2="18"/></svg></button>
    <button class="btn btn-sm" aria-label="居中"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="6" x2="18" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg></button>
  </div>
  <span class="toolbar-spacer"></span>
  <span class="toolbar-label accent">3 项已选</span>
  <button class="btn btn-sm btn-danger">删除</button>
</div>

<div class="toolbar toolbar--elevated" style="margin-bottom:14px">
  <button class="btn btn-sm btn-primary">新建</button>
  <button class="btn btn-sm">导入</button>
  <button class="btn btn-sm">导出</button>
  <span class="toolbar-separator"></span>
  <input class="form-input" placeholder="搜索…" style="width:160px;height:28px;font-size:12px" />
</div>

<div class="toolbar toolbar--sm toolbar--wrap">
  <span class="toolbar-label">小号紧凑</span>
  <button class="btn btn-sm">刷新</button>
  <button class="btn btn-sm">设置</button>
  <span class="toolbar-separator"></span>
  <button class="btn btn-sm">查看日志</button>
  <button class="btn btn-sm">监控</button>
</div>`,
    usage: `<div class="toolbar [--sm|--lg|--wrap|--elevated|--borderless]">
  <div class="toolbar-group">
    <button class="btn btn-sm">…</button>
    <button class="btn btn-sm">…</button>
  </div>
  <span class="toolbar-separator"></span>
  <span class="toolbar-spacer"></span>
  <span class="toolbar-label">右侧文字</span>
</div>
<!-- 分组 toolbar-group / 分隔符 toolbar-separator / 弹性占位 toolbar-spacer -->`,
  },
  {
    slug: 'split-pane',
    name: '分栏拖拽',
    group: '基础',
    desc: '与 behaviors/split-pane 配套：可拖拽的分栏容器，支持水平 / 垂直方向，双击分隔条复位 50%，键盘 ←→ ↑↓ 调整。',
    demo: `<p class="chart-cap">水平分栏（拖拽中间分隔条）</p>
<div class="split-pane" data-split-pane style="height:200px;margin-top:6px">
  <div class="split-pane-first" style="padding:14px;font-size:var(--density-font-size-sm);color:var(--token-text-muted)">左侧面板：常用于文件树 / 列表 / 导航。拖动中间分隔条调整比例，双击复位到 50%。</div>
  <div class="split-pane-divider" role="separator" aria-label="拖拽调整"></div>
  <div class="split-pane-second" style="padding:14px;font-size:var(--density-font-size-sm);color:var(--token-text-muted)">右侧面板：主内容 / 详情区。键盘聚焦分隔条后可用 ← → 调整，Home/End 复位极值。</div>
</div>
<p class="chart-cap" style="margin-top:20px">垂直分栏（上下）</p>
<div class="split-pane split-pane--vertical" data-split-pane style="height:240px;margin-top:6px">
  <div class="split-pane-first" style="padding:14px;font-size:var(--density-font-size-sm);color:var(--token-text-muted)">上侧面板</div>
  <div class="split-pane-divider" role="separator" aria-label="拖拽调整"></div>
  <div class="split-pane-second" style="padding:14px;font-size:var(--density-font-size-sm);color:var(--token-text-muted)">下侧面板</div>
</div>`,
    usage: `import { initSplitPane } from '@icen.ai/ui/behaviors/split-pane';
initSplitPane();

<!-- DOM 契约 -->
<div class="split-pane [--vertical]" data-split-pane style="--split:50%; height:400px">
  <div class="split-pane-first">左侧</div>
  <div class="split-pane-divider" role="separator"></div>
  <div class="split-pane-second">右侧</div>
</div>
<!-- data-split-min/max（默认 10/90）、data-split-step（键盘步长，默认 2） -->`,
    behaviors: ['split-pane'],
    behaviorInit: { 'split-pane': 'initSplitPane' },
  },

  /* ══════════ 表单 ══════════ */
  {
    slug: 'form',
    name: '表单布局',
    group: '表单',
    desc: '字段结构（form / form-field / form-label / form-hint / form-error）+ 裸 form-input / form-textarea + 页面级 banner-ok / banner-err 横幅。与 input.css 的 wrapper 互补：input 处理"单控件外壳"，form 处理"字段→label→hint 的纵向布局"。',
    demo: `<form class="form" style="max-width:420px">
  <fieldset class="form-field">
    <label class="form-label" for="demo-form-name">作品名称<span class="req">*</span></label>
    <input class="form-input" id="demo-form-name" placeholder="3-30 个字符" value="星野之下" />
    <span class="form-hint">必填，3–30 个字符，可含中英文与数字</span>
  </fieldset>
  <fieldset class="form-field">
    <label class="form-label" for="demo-form-desc">简介</label>
    <textarea class="form-textarea" id="demo-form-desc" placeholder="一句话介绍"></textarea>
    <span class="form-hint">选填，最多 200 字</span>
  </fieldset>
  <fieldset class="form-field" data-invalid="true">
    <label class="form-label" for="demo-form-slug">Slug<span class="req">*</span></label>
    <input class="form-input" id="demo-form-slug" data-invalid="true" value="ab" />
    <span class="form-error">Slug 至少 3 个字符</span>
  </fieldset>
  <fieldset class="form-field">
    <label class="form-label" for="demo-form-disabled">禁用示例</label>
    <input class="form-input" id="demo-form-disabled" value="只读内容" disabled />
  </fieldset>
</form>
<div class="banner-ok banner-block" style="margin-top:20px">✓ 已保存：表单校验通过</div>
<div class="banner-err banner-block">✗ 提交失败：网络错误，请稍后重试</div>`,
    usage: `<form class="form">
  <fieldset class="form-field">
    <label class="form-label" for="x">姓名<span class="req">*</span></label>
    <input class="form-input" id="x" />
    <span class="form-hint">辅助提示</span>
    <span class="form-error">错误信息</span>
  </fieldset>
</form>
<!-- form-input 同时支持原生 :invalid 与 [data-invalid=true] 驱动错误态 -->`,
  },
  {
    slug: 'input',
    name: '输入框',
    group: '表单',
    desc: 'wrapper 式输入族：三档尺寸，前后缀、清除钮、密码切换、错误/禁用态，含多行与搜索框。增强：字符计数器（maxlength / data-count）、输入掩码（data-mask）、IME 安全、blur 自动 trim。',
    demo: `<div class="demo-col">
  <div class="input-wrap control input-wrap--sm">
    <input class="input" placeholder="小号（32px）" />
  </div>
  <div class="input-wrap control">
    <input class="input" placeholder="默认（36px）" />
  </div>
  <div class="input-wrap control input-wrap--lg">
    <input class="input" placeholder="大号（40px）" />
  </div>
</div>
<div class="demo-col" style="margin-top:16px">
  <div class="input-wrap control">
    <span class="input-leading">¥</span>
    <input class="input" placeholder="0.00" />
    <span class="input-trailing">元</span>
  </div>
  <div class="input-wrap control">
    <input class="input" value="点右侧 × 可清空" />
    <button class="input-clear" type="button" aria-label="清空">${svgX}</button>
  </div>
  <div class="input-wrap control">
    <input class="input" type="password" value="secret-123" />
    <button class="input-pw-toggle" type="button">${svgEye}${svgEyeOff}</button>
  </div>
  <div class="input-wrap control">
    <input class="input" value="带字符计数" maxlength="20" />
  </div>
  <div class="input-wrap control is-error">
    <input class="input" value="校验未通过的内容" />
  </div>
  <div class="input-wrap control is-disabled">
    <input class="input" disabled placeholder="禁用态" />
  </div>
</div>
<div class="demo-col" style="margin-top:16px">
  <p class="chart-cap" style="margin:0 0 6px">输入掩码（data-mask）——手机号 / 信用卡</p>
  <div class="input-wrap control" style="max-width:240px">
    <input class="input" data-mask="###-####-####" placeholder="138-1234-5678" />
  </div>
  <div class="input-wrap control" style="max-width:280px">
    <input class="input" data-mask="####-####-####-####" placeholder="4111-2222-3333-4444" />
  </div>
  <div class="textarea-wrap control">
    <textarea class="textarea" data-autosize data-min-rows="3" data-max-rows="6" maxlength="100" placeholder="带字符计数 + 自适应高度的多行文本（最多 100 字）"></textarea>
  </div>
  <div class="input-wrap control input-wrap--search">
    <span class="input-leading">${svgSearch}</span>
    <input class="input" type="search" placeholder="搜索文档、组件、令牌…" />
    <button class="input-clear" type="button" aria-label="清空">${svgX}</button>
  </div>
</div>`,
    usage: `import { initInput } from '@icen.ai/ui/behaviors/input';
initInput(); // 清除钮 / 密码切换 / textarea autosize / OTP / 字符计数 / 输入掩码

<!-- 字符计数 -->
<input class="input" maxlength="20" />

<!-- 输入掩码（# 数字 / A 字母 / * 任意） -->
<input class="input" data-mask="###-####-####" placeholder="手机号" />
<input class="input" data-mask="####-####-####-####" placeholder="信用卡" />

<!-- blur 自动去空白 -->
<input class="input" data-trim />`,
    behaviors: ['input'],
    behaviorInit: { input: 'initInput' },
  },
  {
    slug: 'select',
    name: '选择器',
    group: '表单',
    desc: '触发器与 input 同视觉；弹层支持 ↑↓ 移动、Enter 选中、Esc / 外点关闭，选中值同步隐藏 input。选项内容支持任意 HTML（色卡/图标/多行）。增强：data-select-search 可搜索过滤、data-select-multiple 多选（逗号分隔）、data-select-max 上限；面板尺寸走全库统一 PanelSizing 契约：data-panel-width 固定宽 / -min / -max 夹取 / -max-height 高度上限。',
    demo: `<div class="demo-col">
  <p class="chart-cap" style="margin:0 0 6px">基础单选</p>
  <div class="select" data-select style="max-width:280px">
    <button class="select-trigger pressable focus-ring" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="select-value is-empty">选择一种水果</span>
      ${svgChevron}
    </button>
    <div class="select-panel" hidden>
      <button class="select-option" type="button" data-value="apple">苹果</button>
      <button class="select-option" type="button" data-value="banana">香蕉</button>
      <button class="select-option" type="button" data-value="orange">橙子</button>
      <button class="select-option" type="button" data-value="grape">葡萄</button>
      <button class="select-option" type="button" data-value="mango">芒果</button>
    </div>
    <input type="hidden" data-select-value name="fruit" />
  </div>
  <p class="chart-cap" style="margin:14px 0 6px">可搜索（data-select-search）</p>
  <div class="select" data-select data-select-search style="max-width:280px">
    <button class="select-trigger pressable focus-ring" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="select-value is-empty">搜索城市…</span>
      ${svgChevron}
    </button>
    <div class="select-panel" hidden>
      <div class="select-group">
        <p class="select-group-label">华北</p>
        <button class="select-option" type="button" data-value="bj">北京</button>
        <button class="select-option" type="button" data-value="tj">天津</button>
      </div>
      <div class="select-group">
        <p class="select-group-label">华东</p>
        <button class="select-option" type="button" data-value="sh">上海</button>
        <button class="select-option" type="button" data-value="hz">杭州</button>
        <button class="select-option" type="button" data-value="nj">南京</button>
      </div>
      <div class="select-group">
        <p class="select-group-label">华南</p>
        <button class="select-option" type="button" data-value="gz">广州</button>
        <button class="select-option" type="button" data-value="sz">深圳</button>
      </div>
    </div>
    <input type="hidden" data-select-value name="city" />
  </div>
  <p class="chart-cap" style="margin:14px 0 6px">多选（data-select-multiple + data-select-max="3"；chips 单项 × 悬停出现，右侧 × 清除全部）</p>
  <div class="select" data-select data-select-multiple data-select-max="3" data-select-placeholder="选择标签（最多 3 个）" style="max-width:280px">
    <button class="select-trigger pressable focus-ring" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="select-value is-empty">选择标签（最多 3 个）</span>
      ${svgChevron}
    </button>
    <button class="select-clear" type="button" aria-label="清除全部" hidden>×</button>
    <div class="select-panel" hidden>
      <button class="select-option" type="button" data-value="ts">TypeScript</button>
      <button class="select-option" type="button" data-value="react">React</button>
      <button class="select-option" type="button" data-value="vue">Vue</button>
      <button class="select-option" type="button" data-value="svelte">Svelte</button>
      <button class="select-option" type="button" data-value="rust">Rust</button>
      <button class="select-option" type="button" data-value="go">Go</button>
    </div>
    <input type="hidden" data-select-value name="tags" />
  </div>
  <p class="chart-cap" style="margin:14px 0 6px">富选项（任意 HTML）+ 固定面板宽（data-panel-width，全库浮层统一 PanelSizing 契约）</p>
  <div class="select" data-select data-panel-width="216" style="max-width:216px">
    <button class="select-trigger pressable focus-ring" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="select-value is-empty">选择色彩预设</span>
      ${svgChevron}
    </button>
    <div class="select-panel" hidden>
      <button class="select-option" type="button" data-value="clay"><span class="opt-dots" aria-hidden="true"><i style="background:#faf9f5"></i><i style="background:#d97757"></i><i style="background:#7a9cb0"></i></span>clay 陶土</button>
      <button class="select-option" type="button" data-value="piano"><span class="opt-dots" aria-hidden="true"><i style="background:#f1eee6"></i><i style="background:#b89145"></i><i style="background:#566370"></i></span>piano 钢琴</button>
      <button class="select-option" type="button" data-value="vangogh"><span class="opt-dots" aria-hidden="true"><i style="background:#e8ddb2"></i><i style="background:#1f527c"></i><i style="background:#476f45"></i></span>vangogh 梵高</button>
    </div>
    <input type="hidden" data-select-value name="preset" />
  </div>
</div>`,
    usage: `import { initSelect } from '@icen.ai/ui/behaviors/select';
initSelect();

<!-- 基础单选 -->
<div class="select" data-select>…</div>

<!-- 可搜索（带分组） -->
<div class="select" data-select data-select-search>…</div>

<!-- 多选 + 上限 -->
<div class="select" data-select data-select-multiple data-select-max="3">…</div>
<!-- 多选：trigger 同级加 .select-clear（叠进右侧）清除全部；选中项渲染为 chips（单项 × 悬停出现） -->

<!-- 富选项：.select-option 内可直接写任意 HTML（色卡 / 图标 / 多行） -->
<!-- 面板尺寸（全库统一 PanelSizing 契约，浮层组件通用）：
     data-panel-width="216"        固定宽（最高优先）
     data-panel-min / -max         以 trigger 宽为基准夹取
     data-panel-max-height="320"   高度上限（select 默认 240） -->`,
    behaviors: ['select'],
    behaviorInit: { select: 'initSelect' },
  },
  {
    slug: 'slider',
    name: '滑块',
    group: '表单',
    desc: '透明原生 range 覆盖层驱动填充与滑块；双滑块带选中段与 lo ≤ hi − step 钳制。',
    demo: `<div class="demo-col">
  <div class="slider-row"><span>音量</span><span id="demo-slider-val">40</span></div>
  <div class="slider">
    <div class="slider-track"></div>
    <div class="slider-fill" style="width:40%"></div>
    <div class="slider-thumb" style="left:calc(40% - 8px)"></div>
    <input class="slider-native" id="demo-slider" type="range" min="0" max="100" value="40" aria-label="音量" />
  </div>
</div>
<div class="demo-col" style="margin-top:16px">
  <div class="slider-row"><span>价格区间</span><span id="demo-dual-val">20 – 80</span></div>
  <div class="slider slider--dual" id="demo-dual">
    <div class="slider-track"></div>
    <div class="slider-range" style="left:20%; right:20%"></div>
    <div class="slider-thumb slider-thumb--lo" style="left:calc(20% - 8px)"></div>
    <div class="slider-thumb slider-thumb--hi" style="left:calc(80% - 8px)"></div>
    <input class="slider-native" type="range" data-thumb="lo" min="0" max="100" value="20" aria-label="最小值" />
    <input class="slider-native" type="range" data-thumb="hi" min="0" max="100" value="80" aria-label="最大值" />
  </div>
</div>`,
    usage: `import { initSlider } from '@icen.ai/ui/behaviors/slider';
initSlider();`,
    behaviors: ['slider'],
    behaviorInit: { slider: 'initSlider' },
    script: `const single = document.getElementById('demo-slider');
const singleVal = document.getElementById('demo-slider-val');
single?.addEventListener('input', () => {
  if (singleVal && single instanceof HTMLInputElement) singleVal.textContent = single.value;
});
const dual = document.getElementById('demo-dual');
const dualVal = document.getElementById('demo-dual-val');
dual?.querySelectorAll('.slider-native').forEach((n) => {
  n.addEventListener('input', () => {
    const lo = dual.querySelector('[data-thumb="lo"]');
    const hi = dual.querySelector('[data-thumb="hi"]');
    if (dualVal && lo instanceof HTMLInputElement && hi instanceof HTMLInputElement) {
      dualVal.textContent = lo.value + ' – ' + hi.value;
    }
  });
});`,
  },
  {
    slug: 'tag-input',
    name: '标签输入',
    group: '表单',
    desc: 'Enter / 逗号提交、重复静默清空、空草稿 Backspace 删尾、blur 提交；达到 data-max 边框转 warning 色并拒加。',
    demo: `<div class="demo-col">
  <div class="tag-input control" data-tags="设计,前端" data-max="5">
    <input class="tag-input-field" placeholder="输入后回车添加（最多 5 个）" />
  </div>
</div>`,
    usage: `import { initTagInput } from '@icen.ai/ui/behaviors/tag-input';
initTagInput();`,
    behaviors: ['tag-input'],
    behaviorInit: { 'tag-input': 'initTagInput' },
  },
  {
    slug: 'switch',
    name: '开关与选择',
    group: '表单',
    desc: '纯 CSS 状态组件：开关两档尺寸；勾选框三态（未选 / 已选 / 半选）；单选行组排他。',
    demo: `<div class="demo-row">
  <button class="switch" type="button" role="switch" aria-checked="true" aria-label="标准开关（开）"><span class="switch-thumb"></span></button>
  <button class="switch" type="button" role="switch" aria-checked="false" aria-label="标准开关（关）"><span class="switch-thumb"></span></button>
  <button class="switch switch--sm" type="button" role="switch" aria-checked="true" aria-label="小号开关"><span class="switch-thumb"></span></button>
</div>
<div class="demo-row" style="margin-top:16px">
  <button class="checkbox focus-ring" type="button" role="checkbox" aria-checked="false" aria-label="未选中"></button>
  <button class="checkbox focus-ring" type="button" role="checkbox" aria-checked="true" aria-label="已选中"></button>
  <button class="checkbox focus-ring" type="button" role="checkbox" aria-checked="mixed" aria-label="半选"></button>
</div>
<div class="demo-col" style="margin-top:16px">
  <div class="radio-group" role="radiogroup" aria-label="套餐">
    <button class="radio-item motion is-selected" type="button" role="radio" aria-checked="true"><span class="radio-dot"></span>基础版</button>
    <button class="radio-item motion" type="button" role="radio" aria-checked="false"><span class="radio-dot"></span>专业版</button>
    <button class="radio-item motion" type="button" role="radio" aria-checked="false"><span class="radio-dot"></span>旗舰版</button>
  </div>
</div>`,
    usage: `<button class="switch" type="button" role="switch" aria-checked="false">
  <span class="switch-thumb"></span>
</button>
<!-- 状态由使用方驱动：点击切换 aria-checked，CSS 负责全部视觉 -->`,
    script: `// 纯 CSS 状态组件的演示接线（实际项目由使用方状态驱动）
/* 开关/勾选交互已由 behaviors/controls 的 initSwitch 接管（含三态与键盘） */
document.querySelectorAll('.radio-group').forEach((group) => {
  group.querySelectorAll('.radio-item').forEach((item) => {
    item.addEventListener('click', () => {
      group.querySelectorAll('.radio-item').forEach((it) => {
        it.classList.toggle('is-selected', it === item);
        it.setAttribute('aria-checked', it === item ? 'true' : 'false');
      });
    });
  });
});`,

    behaviors: ['controls'],
    behaviorInit: { controls: 'initSwitch' },
  },
  {
    slug: 'segmented',
    name: '分段选择',
    group: '表单',
    desc: '同族四件：分段控件（两档尺寸）、toggle-group、数字步进器、OTP 单元格（输入跳格 / 粘贴分摊）。',
    demo: `<div class="demo-row">
  <div class="segmented control" role="radiogroup" aria-label="统计周期">
    <button class="segmented-item motion pressable" type="button">日</button>
    <button class="segmented-item motion pressable is-active" type="button">周</button>
    <button class="segmented-item motion pressable" type="button">月</button>
  </div>
  <div class="segmented segmented--sm control" role="radiogroup" aria-label="小号分段">
    <button class="segmented-item motion pressable is-active" type="button">列表</button>
    <button class="segmented-item motion pressable" type="button">网格</button>
  </div>
</div>
<div class="demo-row" style="margin-top:16px">
  <div class="toggle-group control" role="group" aria-label="对齐方式">
    <button class="toggle-item motion pressable is-active" type="button">左对齐</button>
    <button class="toggle-item motion pressable" type="button">居中</button>
    <button class="toggle-item motion pressable" type="button">右对齐</button>
  </div>
</div>
<div class="demo-row" style="margin-top:16px">
  <div class="stepper control">
    <button class="stepper-btn pressable" type="button" data-step="-1" aria-label="减少">${svgDown}</button>
    <input class="stepper-input" type="number" value="3" min="0" max="10" step="1" aria-label="数量" />
    <button class="stepper-btn pressable" type="button" data-step="1" aria-label="增加">${svgUp}</button>
  </div>
  <div class="otp" role="group" aria-label="短信验证码">
    <input class="otp-cell" maxlength="1" inputmode="numeric" aria-label="第 1 位" />
    <input class="otp-cell" maxlength="1" inputmode="numeric" aria-label="第 2 位" />
    <input class="otp-cell" maxlength="1" inputmode="numeric" aria-label="第 3 位" />
    <input class="otp-cell" maxlength="1" inputmode="numeric" aria-label="第 4 位" />
  </div>
</div>`,
    usage: `import { initInput } from '@icen.ai/ui/behaviors/input';
initInput(); // OTP 单元格的输入跳格 / 粘贴分摊由 input behavior 处理
// segmented / toggle-group / stepper 为纯 CSS 契约，选中态由使用方切换`,
    script: `document.querySelectorAll('.segmented, .toggle-group').forEach((group) => {
  group.querySelectorAll('.segmented-item, .toggle-item').forEach((item) => {
    item.addEventListener('click', () => {
      group.querySelectorAll('.segmented-item, .toggle-item').forEach((it) => {
        it.classList.toggle('is-active', it === item);
      });
    });
  });
});
document.querySelectorAll('.stepper').forEach((s) => {
  const input = s.querySelector('.stepper-input');
  if (!(input instanceof HTMLInputElement)) return;
  s.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.getAttribute('data-step')) || 1;
      const min = input.min === '' ? -Infinity : Number(input.min);
      const max = input.max === '' ? Infinity : Number(input.max);
      input.value = String(Math.min(max, Math.max(min, (Number(input.value) || 0) + step)));
    });
  });
});`,

    behaviors: ['input', 'controls'],
    behaviorInit: { input: 'initInput', controls: ['initSegmented', 'initStepper'] },
  },
  {
    slug: 'upload',
    name: '上传',
    group: '表单',
    desc: '点击 / Enter / Space 打开文件选择；拖入高亮，drop 后文件写入 input.files 并派发 change。增强（data-upload-list）：自动渲染文件列表，图片缩略图、大小格式化、单文件移除、accept/max-size/max-files 校验。',
    demo: `<div class="demo-col">
  <div class="upload control lift focus-ring" data-upload-list data-max-size="5242880" data-max-files="6" role="button" tabindex="0" aria-label="上传文件" style="max-width:480px">
    <input type="file" multiple accept="image/*,.pdf,.doc,.docx" />
    <div class="upload-icon">${svgPlus}</div>
    <p class="upload-title">点击或拖拽文件到此处上传</p>
    <p class="upload-desc">支持图片 / PDF / DOC，单个 ≤ 5 MB，最多 6 个</p>
    <p class="upload-error" id="demo-upload-files" hidden></p>
  </div>
</div>`,
    usage: `import { initUpload } from '@icen.ai/ui/behaviors/upload';
initUpload();

<!-- 基础上传（无列表） -->
<div class="upload" role="button" tabindex="0">
  <input type="file" multiple />
  …
</div>

<!-- 增强上传（文件列表 + 校验） -->
<div class="upload" data-upload-list data-max-size="5242880" data-max-files="6"
     role="button" tabindex="0">
  <input type="file" multiple accept="image/*,.pdf" />
  …
</div>
<!-- 事件：icen:upload { files } / icen:upload-error { file, reason } / icen:upload-remove { file } -->`,
    behaviors: ['upload'],
    behaviorInit: { upload: 'initUpload' },
    script: `document.querySelectorAll('.upload[data-upload-list]').forEach((zone) => {
  zone.addEventListener('icen:upload-error', (ev) => {
    const detail = ev.detail;
    const msg = document.getElementById('demo-upload-files');
    if (msg) {
      msg.hidden = false;
      msg.textContent = detail.reason + (detail.file ? '：' + detail.file.name : '');
      setTimeout(() => { msg.hidden = true; }, 3000);
    }
  });
});`,
  },
  {
    slug: 'date-picker',
    name: '日期选择',
    group: '表单',
    desc: '与 behaviors/date-picker 配套：点击触发器弹出日历面板，支持月份导航 / 今日 / 清除 / min-max 限制 / 周首日配置。纯 JS 渲染，零依赖。',
    demo: `<div class="demo-row">
  <div class="date-picker" data-date-picker data-date-picker-placeholder="选择发布日期">
    <button class="date-picker-trigger" type="button">
      <span class="date-picker-value is-empty"></span>
      <span class="date-picker-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg></span>
    </button>
    <input type="hidden" name="date1" />
  </div>
  <div class="date-picker" data-date-picker data-date-picker-placeholder="有范围限制" data-date-picker-min="2026-07-01" data-date-picker-max="2026-12-31">
    <button class="date-picker-trigger" type="button">
      <span class="date-picker-value is-empty"></span>
      <span class="date-picker-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg></span>
    </button>
    <input type="hidden" name="date2" value="2026-07-29" />
  </div>
</div>`,
    usage: `import { initDatePicker } from '@icen.ai/ui/behaviors/date-picker';
initDatePicker();

<div class="date-picker" data-date-picker>
  <button class="date-picker-trigger" type="button">
    <span class="date-picker-value is-empty"></span>
    <span class="date-picker-icon">…日历 svg…</span>
  </button>
  <input type="hidden" name="date" />
</div>
<!-- 可选 data-date-picker-format/min/max/week-start/placeholder -->`,
    behaviors: ['date-picker'],
    behaviorInit: { 'date-picker': 'initDatePicker' },
    script: `// hidden input 值变化监听演示
document.querySelectorAll('.date-picker input[type="hidden"]').forEach((inp) => {
  inp.addEventListener('change', () => {
    console.log('date change:', inp.value);
  });
});`,
  },
];

/* ══════════ 浮层 ══════════ */
COMPONENTS.push(
  {
    slug: 'modal',
    name: '对话框',
    group: '浮层',
    desc: 'data-modal 契约 + behaviors/modal：焦点陷阱、滚动锁、Esc/遮罩关闭、焦点还原；Sheet 四向贴边滑入。',
    demo: `<div class="demo-row">
  <button class="btn" data-modal-open="demo-modal-sm">小号对话框</button>
  <button class="btn" data-modal-open="demo-modal-md">默认对话框</button>
  <button class="btn" data-modal-open="demo-modal-lg">大号对话框</button>
  <button class="btn" data-modal-open="demo-sheet-right">右侧 Sheet</button>
</div>

<div class="modal-backdrop" data-modal="demo-modal-sm" hidden>
  <div class="modal modal--sm">
    <div class="modal-header">
      <div>
        <h3 class="modal-title">小号对话框</h3>
        <p class="modal-description">max-width 360px，Esc / 点击遮罩可关闭</p>
      </div>
      <button class="modal-close" data-modal-close aria-label="关闭">×</button>
    </div>
    <div class="modal-body">
      <p>焦点已锁定在对话框内：Tab 会在关闭钮与底部按钮之间循环，关闭后焦点还原到触发按钮。</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-sm" data-modal-close>取消</button>
      <button class="btn btn-sm btn-primary" data-modal-close>确定</button>
    </div>
  </div>
</div>

<div class="modal-backdrop" data-modal="demo-modal-md" hidden>
  <div class="modal">
    <div class="modal-header">
      <div>
        <h3 class="modal-title">默认对话框</h3>
        <p class="modal-description">max-width 480px</p>
      </div>
      <button class="modal-close" data-modal-close aria-label="关闭">×</button>
    </div>
    <div class="modal-body">
      <p>面板进场为 dialogScaleIn 200ms：scale(.96) translateY(8px) → scale(1) translateY(0)。</p>
      <p>同时只允许打开一个浮层对话框——打开另一个会自动关掉当前这个。</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-sm" data-modal-close>取消</button>
      <button class="btn btn-sm btn-primary" data-modal-close>保存</button>
    </div>
  </div>
</div>

<div class="modal-backdrop" data-modal="demo-modal-lg" hidden>
  <div class="modal modal--lg">
    <div class="modal-header">
      <div>
        <h3 class="modal-title">大号对话框</h3>
        <p class="modal-description">max-width 640px，内容超高时 modal-body 内部滚动</p>
      </div>
      <button class="modal-close" data-modal-close aria-label="关闭">×</button>
    </div>
    <div class="modal-body">
      <p>背景已滚动锁定（body overflow 关闭时恢复旧值）。</p>
      <p>尺寸档：modal--sm 360 / 默认 480 / modal--lg 640 / modal--xl 800 / modal--full 全屏。</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-sm" data-modal-close>关闭</button>
    </div>
  </div>
</div>

<div class="modal-backdrop" data-modal="demo-sheet-right" hidden>
  <div class="modal modal--sheet-right">
    <div class="modal-header">
      <div>
        <h3 class="modal-title">右侧 Sheet</h3>
        <p class="modal-description">宽 360px，translateX(40px) 滑入</p>
      </div>
      <button class="modal-close" data-modal-close aria-label="关闭">×</button>
    </div>
    <div class="modal-body">
      <p>Sheet 变体：modal--sheet-left / right / top / bottom，圆角只保留非贴边侧。</p>
      <p>宽度档：默认 360px，modal--sheet-sm 280px，modal--sheet-lg 480px（上下方向为 300px / 50vh）。</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-sm" data-modal-close>关闭</button>
    </div>
  </div>
</div>`,
    usage: `import { initModal, openModal, closeModal } from '@icen.ai/ui/behaviors/modal';
initModal();            // 事件委托一次绑定
openModal('confirm');   // 编程打开（可传 { initialFocus } 控制初始焦点）
closeModal('confirm');  // 编程关闭；开合均派 icen:modal-open / icen:modal-close`,
    behaviors: ['modal'],
    behaviorInit: { modal: 'initModal' },
  },
  {
    slug: 'dropdown',
    name: '下拉菜单',
    group: '浮层',
    desc: 'trigger + [data-dropdown-menu] 模板；面板 fixed 定位在 trigger 下方 4px，视口 12px margin 内 clamp，空间不足翻上。',
    demo: `<div class="dropdown" data-dropdown>
  <button class="btn dropdown-trigger" data-dropdown-trigger aria-haspopup="menu">操作 ▾</button>
  <div data-dropdown-menu hidden>
    <div class="menu-label">文件</div>
    <button class="menu-item pressable" id="dd-rename">
      <span class="menu-item-icon"></span>
      <span class="menu-item-label">重命名</span>
      <span class="menu-item-shortcut">F2</span>
    </button>
    <button class="menu-item pressable" id="dd-share">
      <span class="menu-item-icon"></span>
      <span class="menu-item-label">分享</span>
    </button>
    <div class="menu-separator"></div>
    <button class="menu-item pressable menu-item--danger" id="dd-delete">
      <span class="menu-item-icon"></span>
      <span class="menu-item-label">删除</span>
      <span class="menu-item-shortcut">⌫</span>
    </button>
  </div>
</div>`,
    usage: `import { initDropdown } from '@icen.ai/ui/behaviors/dropdown';
initDropdown();
// 面板由 JS portal 到 body；click / ArrowDown 打开，↑↓ 高亮，Enter 激活，Esc / 外点 / 滚动关闭`,
    behaviors: ['dropdown', 'toast'],
    behaviorInit: { dropdown: 'initDropdown' },
    script: `const toast = toastMod.toast;
document.getElementById('dd-rename')?.addEventListener('click', () => toast.ok('重命名'));
document.getElementById('dd-share')?.addEventListener('click', () => toast.ok('已创建分享链接'));
document.getElementById('dd-delete')?.addEventListener('click', () => toast.err('已删除'));`,
  },
  {
    slug: 'context-menu',
    name: '右键菜单',
    group: '浮层',
    desc: '全局单例：registerContextMenu(id, items) 注册，[data-context-menu="id"] 命中；支持 header / separator / danger / disabled，触屏长按触发。',
    demo: `<div class="ctx-zone" data-context-menu="demo-file">
  右键我（触屏长按 520ms）—— 自定义菜单
</div>
<p class="dim" style="margin:8px 0 0">区域外右键则是默认菜单：后退 / 前进 / 刷新 / 复制页面链接。</p>`,
    usage: `import { initContextMenu, registerContextMenu } from '@icen.ai/ui/behaviors/context-menu';

registerContextMenu('demo-file', [
  { type: 'header', label: 'report-2026.qmd', description: '文档 · 2.4 MB' },
  { label: '重命名', shortcut: 'F2', onClick: () => toast.ok('重命名') },
  { label: '复制链接', onClick: () => toast.ok('已复制链接') },
  { type: 'separator' },
  { label: '移到回收站', danger: true, shortcut: '⌫', onClick: () => toast.warn('已移到回收站') },
  { label: '高级操作（不可用）', disabled: true },
]);
initContextMenu();`,
    behaviors: ['context-menu', 'toast'],
    behaviorInit: { 'context-menu': 'initContextMenu' },
    script: `const registerContextMenu = contextMenuMod.registerContextMenu;
const toast = toastMod.toast;
registerContextMenu('demo-file', [
  { type: 'header', label: 'report-2026.qmd', description: '文档 · 2.4 MB' },
  { label: '重命名', shortcut: 'F2', onClick: () => toast.ok('重命名') },
  { label: '复制链接', onClick: () => toast.ok('已复制链接') },
  { type: 'separator' },
  { label: '移到回收站', danger: true, shortcut: '⌫', onClick: () => toast.warn('已移到回收站') },
  { label: '高级操作（不可用）', disabled: true },
]);`,
  },
  {
    slug: 'popover',
    name: '浮层',
    group: '浮层',
    desc: 'computePopoverLayout 纯函数选侧（prefer → 翻对侧 → 取大侧）；openPopover 负责 portal、跟随重算与外点/Esc 关闭。',
    demo: `<div class="demo-row">
  <button class="btn" id="popover-demo-trigger">筛选 ▾</button>
</div>
<div class="popover" id="popover-demo-panel" hidden>
  <div class="form-field">
    <label class="form-label" for="popover-demo-input">包含关键词</label>
    <input class="form-input" id="popover-demo-input" placeholder="例如：overlay" />
  </div>
  <div class="demo-row" style="margin-top:10px">
    <button class="btn btn-sm btn-primary" id="popover-demo-apply">应用</button>
  </div>
</div>`,
    usage: `import { openPopover, closePopover, computePopoverLayout } from '@icen.ai/ui/behaviors/popover';

openPopover(panel, { anchor: trigger, side: 'bottom', align: 'start' });
// panel 移入 body 定位；resize / 捕获 scroll 重算；外点 / Esc 关闭并还原`,
    behaviors: ['popover', 'toast'],
    script: `const openPopover = popoverMod.openPopover;
const closePopover = popoverMod.closePopover;
const toast = toastMod.toast;
const popTrigger = document.getElementById('popover-demo-trigger');
const popPanel = document.getElementById('popover-demo-panel');
popTrigger?.addEventListener('click', () => {
  if (popTrigger && popPanel) {
    openPopover(popPanel, { anchor: popTrigger, side: 'bottom', align: 'start' });
  }
});
document.getElementById('popover-demo-apply')?.addEventListener('click', () => {
  if (popPanel) closePopover(popPanel);
  toast.ok('已应用筛选');
});`,
  },
  {
    slug: 'tooltip',
    name: '提示',
    group: '浮层',
    desc: '纯 CSS：data-tooltip 文案 + data-tooltip-side 方向；hover 延迟 400ms，键盘 focus-visible 立即出现。',
    demo: `<div class="demo-row">
  <button class="btn" data-tooltip="默认在上方">上</button>
  <button class="btn" data-tooltip="下方提示" data-tooltip-side="bottom">下</button>
  <button class="btn" data-tooltip="左侧提示" data-tooltip-side="left">左</button>
  <button class="btn" data-tooltip="右侧提示" data-tooltip-side="right">右</button>
</div>`,
    usage: `<!-- 纯 CSS：hover 延迟 400ms 出现，focus-visible 立即出现 -->
<button class="btn" data-tooltip="文案" data-tooltip-side="top">目标</button>
<!-- data-tooltip-side 可选 top | bottom | left | right -->`,
  },
  {
    slug: 'command-palette',
    name: '命令面板',
    group: '浮层',
    desc: '与 behaviors/command-palette 配套：⌘K / Ctrl+K 唤起的命令面板，搜索过滤、↑↓ 导航、Enter 执行、ESC 关闭，常用于编辑器 / 后台快速跳转。',
    demo: `<div class="demo-row">
  <button class="btn btn-primary" data-command-palette-open="demo-cp">打开命令面板</button>
  <span class="dim" style="font-size:12px;align-self:center">或按 <kbd class="kbd kbd--sm">Ctrl</kbd> + <kbd class="kbd kbd--sm">K</kbd></span>
</div>

<div class="command-palette-backdrop" data-command-palette="demo-cp" hidden>
  <div class="command-palette">
    <div class="command-palette-search">
      <span class="command-palette-search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
      <input class="command-palette-input" placeholder="输入命令名或关键字…" />
      <kbd class="command-palette-esc">ESC</kbd>
    </div>
    <div class="command-palette-body">
      <div class="command-palette-group">
        <p class="command-palette-group-label">操作</p>
        <button class="command-palette-item" type="button" data-command-palette-keyword="create new">
          <span class="command-palette-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
          <span class="command-palette-item-label">新建项目</span>
          <kbd class="command-palette-item-kbd">⌘N</kbd>
        </button>
        <button class="command-palette-item" type="button" data-command-palette-keyword="open file">
          <span class="command-palette-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></span>
          <span class="command-palette-item-label">打开文件</span>
          <kbd class="command-palette-item-kbd">⌘O</kbd>
        </button>
        <button class="command-palette-item" type="button" data-command-palette-keyword="search find">
          <span class="command-palette-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
          <span class="command-palette-item-label">全局搜索</span>
        </button>
      </div>
      <div class="command-palette-group">
        <p class="command-palette-group-label">导航</p>
        <button class="command-palette-item" type="button" data-command-palette-keyword="goto dashboard home">
          <span class="command-palette-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
          <span class="command-palette-item-label">回到首页</span>
          <span class="command-palette-item-hint">/</span>
        </button>
        <button class="command-palette-item" type="button" data-command-palette-keyword="settings preferences config">
          <span class="command-palette-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></span>
          <span class="command-palette-item-label">打开设置</span>
        </button>
        <button class="command-palette-item" type="button" data-command-palette-keyword="theme dark light color">
          <span class="command-palette-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg></span>
          <span class="command-palette-item-label">切换主题</span>
          <span class="command-palette-item-hint">预设 6 种</span>
        </button>
      </div>
      <div class="command-palette-empty" hidden>无匹配命令</div>
    </div>
    <div class="command-palette-foot">
      <span class="command-palette-foot-hint">
        <kbd>↑↓</kbd> 导航 <kbd>↵</kbd> 执行 <kbd>esc</kbd> 关闭
      </span>
    </div>
  </div>
</div>`,
    usage: `import { initCommandPalette } from '@icen.ai/ui/behaviors/command-palette';
initCommandPalette(); // 全局 ⌘K / Ctrl+K 自动触发

// 命令项可加 data-command-palette-keyword 补充关键字
// 加 data-command-palette-keep-open 执行后不关闭面板`,
    behaviors: ['command-palette', 'toast'],
    script: `const toast = toastMod.toast;
document.querySelectorAll('#demo-cp, .command-palette-backdrop[data-command-palette="demo-cp"] .command-palette-item').forEach((item) => {
  item.addEventListener('click', () => {
    const label = item.querySelector('.command-palette-item-label')?.textContent ?? '';
    if (label) toast.ok('已执行：' + label);
  });
});`,
  },
);

/* ══════════ 数据 ══════════ */
COMPONENTS.push(
  {
    slug: 'card',
    name: '卡片',
    group: '数据展示',
    desc: '四变体（默认 / elevated / outlined / glass）+ interactive 浮起 + is-selected 双圈选中。',
    demo: `<div class="demo-row">
  <div class="card" style="width:230px">
    <div class="card-head">
      <div>
        <h3 class="card-title">默认卡片</h3>
        <p class="card-desc">bg card + 内阴影</p>
      </div>
    </div>
    <div class="card-body">纸面质感的基础容器，适合承载一组相关信息。</div>
    <div class="card-foot">
      <span class="card-meta">更新于 2 小时前</span>
      <span class="card-action"><button class="btn btn-sm">查看</button></span>
    </div>
  </div>
  <div class="card card--elevated" style="width:230px">
    <div class="card-head"><div><h3 class="card-title">浮起卡片</h3><p class="card-desc">shadow-card 硬投影</p></div></div>
    <div class="card-body">比默认更靠前一级，用于强调。</div>
  </div>
  <div class="card card--outlined" style="width:230px">
    <div class="card-head"><div><h3 class="card-title">描边卡片</h3><p class="card-desc">粗描边、无阴影</p></div></div>
    <div class="card-body">低噪声场景使用，如嵌套在面板里。</div>
  </div>
  <div style="padding:18px;border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--token-glow),var(--token-glow-cold))">
    <div class="card card--glass" style="width:210px">
      <div class="card-head"><div><h3 class="card-title">玻璃卡片</h3><p class="card-desc">surface-glass + 背景模糊</p></div></div>
      <div class="card-body">叠在彩色背景上呈现磨砂质感。</div>
    </div>
  </div>
  <div class="card card--interactive" style="width:230px">
    <div class="card-head"><div><h3 class="card-title">可交互卡片</h3><p class="card-desc">hover 浮起（.lift 同款）</p></div></div>
    <div class="card-body">鼠标悬停试试：上移 1px + 投影 + 描边变色。</div>
  </div>
  <div class="card is-selected" style="width:230px">
    <div class="card-head"><div><h3 class="card-title">选中态</h3><p class="card-desc">.is-selected 双圈高亮</p></div></div>
    <div class="card-body">accent 2px 内圈 + 底色 4px 外圈。</div>
  </div>
</div>`,
    usage: `<div class="card">
  <div class="card-head"><h3 class="card-title">标题</h3></div>
  <div class="card-body">内容</div>
  <div class="card-foot"><span class="card-meta">元信息</span></div>
</div>
<!-- 变体：card--elevated / card--outlined / card--glass / card--interactive；选中态 .is-selected -->`,
  },
  {
    slug: 'empty',
    name: '空状态',
    group: '数据展示',
    desc: '图标 + 标题 + 描述 + 可选动作按钮。类型预设：--error / --404 / --search / --maintenance / --network，自动改图标底色与基调。',
    demo: `<div class="demo-row" style="align-items:flex-start;gap:16px">
  <div class="empty empty--illustrated" style="flex:1;min-width:200px">
    <div class="empty-icon">${inboxSvg}</div>
    <p class="empty-title">暂无收藏</p>
    <p class="empty-desc">你还没有收藏任何作品，去逛逛找点喜欢的吧。</p>
    <div class="empty-action"><button class="btn btn-primary btn-sm">去发现</button></div>
  </div>
  <div class="empty empty--search" style="flex:1;min-width:200px">
    <div class="empty-icon">${svgSearch}</div>
    <p class="empty-title">未找到匹配结果</p>
    <p class="empty-desc">尝试调整搜索关键词或清除筛选条件</p>
    <div class="empty-action"><button class="btn btn-sm">清除筛选</button></div>
  </div>
</div>
<div class="demo-row" style="align-items:flex-start;gap:16px;margin-top:16px">
  <div class="empty empty--error" style="flex:1;min-width:200px">
    <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg></div>
    <p class="empty-title">加载失败</p>
    <p class="empty-desc">数据获取异常，请稍后重试</p>
    <div class="empty-action"><button class="btn btn-sm btn-primary">重试</button></div>
  </div>
  <div class="empty empty--404 empty--illustrated" style="flex:1;min-width:200px">
    <h3 class="empty-title">404</h3>
    <p class="empty-desc">你访问的页面不存在或已被移除</p>
    <div class="empty-action"><button class="btn btn-sm">返回首页</button></div>
  </div>
</div>`,
    usage: `<div class="empty [.empty--sm|.empty--lg]
     [.empty--error|.empty--404|.empty--search|.empty--maintenance|.empty--network]
     [.empty--illustrated]">
  <div class="empty-icon">…svg…</div>
  <p class="empty-title">暂无数据</p>
  <p class="empty-desc">描述文字</p>
  <div class="empty-action"><button class="btn btn-primary btn-sm">动作</button></div>
</div>`,
  },
  {
    slug: 'alert',
    name: '警示',
    group: '反馈',
    desc: 'info / success / warning / error 四态警示条，带关闭按钮（演示 JS 点击移除）。',
    demo: `<div class="demo-col-wide">
  <div class="alert alert--info">
    <span class="alert-icon">${infoSvg}</span>
    <div class="alert-content">
      <p class="alert-title">版本更新</p>
      <div class="alert-body">v0.2.0 已发布：新增数据展示族组件。</div>
    </div>
    <button class="alert-close" type="button" aria-label="关闭">${xSvg}</button>
  </div>
  <div class="alert alert--success">
    <span class="alert-icon">${checkSvg}</span>
    <div class="alert-content">
      <p class="alert-title">构建成功</p>
      <div class="alert-body">dist 产物已生成，耗时 42 秒。</div>
    </div>
    <button class="alert-close" type="button" aria-label="关闭">${xSvg}</button>
  </div>
  <div class="alert alert--warning">
    <span class="alert-icon">${warnSvg}</span>
    <div class="alert-content">
      <p class="alert-title">配额将尽</p>
      <div class="alert-body">本月构建时长已用 80%，超出后将排队执行。</div>
    </div>
    <button class="alert-close" type="button" aria-label="关闭">${xSvg}</button>
  </div>
  <div class="alert alert--error">
    <span class="alert-icon">${warnSvg}</span>
    <div class="alert-content">
      <p class="alert-title">发布失败</p>
      <div class="alert-body">资源校验未通过：封面图尺寸不足 640×960。</div>
    </div>
    <button class="alert-close" type="button" aria-label="关闭">${xSvg}</button>
  </div>
</div>`,
    usage: `<div class="alert alert--success">
  <span class="alert-icon">…svg…</span>
  <div class="alert-content">
    <p class="alert-title">标题</p>
    <div class="alert-body">正文</div>
  </div>
  <button class="alert-close" type="button" aria-label="关闭">×</button>
</div>`,
    script: `// alert 关闭是页面级演示（非组件 behavior）：点击移除整条
document.querySelectorAll('.alert-close').forEach((btn) => {
  btn.addEventListener('click', () => btn.closest('.alert')?.remove());
});`,
  },
  {
    slug: 'result',
    name: '结果页',
    group: '反馈',
    desc: '终态展示（success 一例；另有 error / warning / info 变体）。',
    demo: `<div class="result result--success">
  <div class="result-icon">${checkSvg}</div>
  <h3 class="result-title">发布成功</h3>
  <p class="result-desc">作品「星野之下」已上架，预计 5 分钟后全量生效。</p>
  <div class="result-extra">
    <button class="btn btn-primary btn-sm">查看作品</button>
    <button class="btn btn-sm">返回列表</button>
  </div>
</div>`,
    usage: `<div class="result result--success">
  <div class="result-icon">…svg…</div>
  <h3 class="result-title">标题</h3>
  <p class="result-desc">描述</p>
  <div class="result-extra">…动作按钮…</div>
</div>`,
  },
  {
    slug: 'progress',
    name: '进度条',
    group: '反馈',
    desc: '默认 6px 轨道 / progress--sm 4px，右侧 tabular-nums 百分比标签。',
    demo: `<div class="progress">
  <div class="progress-track"><div class="progress-bar" style="width:64%"></div></div>
  <span class="progress-label">64%</span>
</div>
<div class="progress progress--sm" style="margin-top:14px">
  <div class="progress-track"><div class="progress-bar" style="width:32%"></div></div>
  <span class="progress-label">32%</span>
</div>`,
    usage: `<div class="progress">
  <div class="progress-track"><div class="progress-bar" style="width:64%"></div></div>
  <span class="progress-label">64%</span>
</div>`,
  },
  {
    slug: 'spinner',
    name: '加载指示',
    group: '反馈',
    desc: 'sm 16px / 默认 20px / lg 32px，1s 线性旋转。',
    demo: `<div class="demo-row">
  <div class="spinner spinner--sm"></div>
  <div class="spinner"></div>
  <div class="spinner spinner--lg"></div>
</div>`,
    usage: `<div class="spinner"></div>
<div class="spinner spinner--sm"></div>
<div class="spinner spinner--lg"></div>`,
  },
  {
    slug: 'skeleton',
    name: '骨架屏',
    group: '反馈',
    desc: '呼吸脉冲占位块；skeleton--circle 为圆形。',
    demo: `<div style="display:flex;align-items:center;gap:12px">
  <div class="skeleton skeleton--circle" style="width:40px;height:40px"></div>
  <div style="flex:1;display:flex;flex-direction:column;gap:8px">
    <div class="skeleton" style="height:12px;width:45%"></div>
    <div class="skeleton" style="height:12px;width:80%"></div>
  </div>
</div>
<div class="skeleton" style="height:12px;width:100%;margin-top:12px"></div>
<div class="skeleton" style="height:12px;width:66%;margin-top:8px"></div>`,
    usage: `<div class="skeleton" style="height:12px;width:80%"></div>
<div class="skeleton skeleton--circle" style="width:40px;height:40px"></div>`,
  },
  {
    slug: 'copy',
    name: '复制按钮',
    group: '反馈',
    desc: '与 behaviors/copy 配套：命中 .copy-btn[data-copy] 写入剪贴板，成功后文本变「已复制」1.4s 还原；图标变体加 data-copy-icon 仅切 .is-done 类。与 toast 的区别——copy 是原地反馈，toast 是全局通知。',
    demo: `<div class="demo-row">
  <button class="copy-btn" data-copy="npm i @icen.ai/ui">复制安装命令</button>
  <button class="copy-btn copy-btn--ghost" data-copy="https://ui.icen.ai">复制链接</button>
  <button class="copy-btn copy-btn--icon" data-copy="ABCD-1234-EFGH-5678" data-copy-icon aria-label="复制密钥">
    <svg class="copy-icon-clipboard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    <svg class="copy-icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
  </button>
</div>`,
    usage: `import { initCopy } from '@icen.ai/ui/behaviors/copy';
initCopy(); // 委托监听，自动处理所有 .copy-btn[data-copy]`,
    behaviors: ['copy'],
    behaviorInit: { copy: 'initCopy' },
  },
  {
    slug: 'notification',
    name: '通知栈',
    group: '反馈',
    desc: '与 behaviors/notification 配套：工程级持久通知栈——进度通知、Promise confirm、多按钮、hover 暂停+倒计时进度、优先级置顶、已读未读、自定义图标/头像、详情链接、localStorage 持久化、多容器。与 toast（瞬时）/ alert（内嵌）正交。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <span class="toolbar-label">语义</span>
  <button class="btn btn-sm" id="notif-info">info</button>
  <button class="btn btn-sm btn-primary" id="notif-success">success</button>
  <button class="btn btn-sm" id="notif-warn">warn</button>
  <button class="btn btn-sm btn-danger" id="notif-error">error</button>
</div>
<div class="toolbar" style="margin-bottom:10px">
  <span class="toolbar-label">特性</span>
  <button class="btn btn-sm" id="notif-progress">进度通知</button>
  <button class="btn btn-sm" id="notif-confirm">Promise 确认</button>
  <button class="btn btn-sm" id="notif-multi">多按钮</button>
  <button class="btn btn-sm" id="notif-countdown">倒计时(8s)</button>
  <button class="btn btn-sm" id="notif-priority">高优先级</button>
</div>
<div class="toolbar" style="margin-bottom:10px">
  <span class="toolbar-label">丰富</span>
  <button class="btn btn-sm" id="notif-avatar">带头像</button>
  <button class="btn btn-sm" id="notif-link">带链接</button>
  <button class="btn btn-sm" id="notif-unread">未读标记</button>
  <button class="btn btn-sm" id="notif-actions">actions 回调</button>
  <button class="btn btn-sm" id="notif-update">动态更新</button>
</div>
<div class="toolbar">
  <span class="toolbar-spacer"></span>
  <span class="toolbar-label" id="notif-count">0 条</span>
  <button class="btn btn-sm" id="notif-read">全部已读</button>
  <button class="btn btn-sm" id="notif-clear">清空</button>
</div>`,
    usage: `import { notify, createNotificationCenter } from '@icen.ai/ui/behaviors/notification';

// ── 便捷 API ──
notify.success('已发布', { description: '5 分钟后全量生效' });
notify.warn('配额将尽', { description: '已用 80%', duration: 8000 });  // 8s 自动关闭
notify.error('发布失败', { description: '封面图尺寸不足' });

// ── 进度通知（返回 handle，可动态 setProgress）──
const h = notify.progress('正在导出', { progressLabel: '准备中…' });
let p = 0;
const timer = setInterval(() => {
  p += 0.08;
  if (p >= 1) {
    h.setProgress(1, '完成');
    clearInterval(timer);
    setTimeout(() => h.dismiss(), 1500);
  } else {
    h.setProgress(p, '导出中 ' + Math.round(p * 100) + '%');
  }
}, 300);

// ── Promise confirm（阻塞式确认）──
const ok = await notify.confirm('确认删除该作品？', {
  description: '此操作不可撤销，相关数据将被清除。',
  confirmLabel: '删除',
  cancelLabel: '取消',
});
if (ok) { /* 执行删除 */ }

// ── 多按钮 ──
notify.info('评论了你的作品', {
  description: '「很喜欢这段配乐」—— 沈墨',
  avatar: 'https://example.com/u.jpg',
  actions: [
    { label: '回复', type: 'primary', onClick: () => openReply() },
    { label: '忽略', onClick: () => {} },
  ],
  link: '/works/123',
  linkLabel: '查看作品',
});

// ── 高优先级置顶 + 未读 ──
notify.error('服务中断', {
  description: 'gateway-001 不可达，已自动切换备用节点',
  priority: 'high',
  unread: true,
});

// ── Handle 方法 ──
h.update({ title: '新标题', description: '更新后' });
h.markRead();
h.pause(); h.resume();
h.dismiss();
notify.markRead();        // 全部已读
notify.clear();           // 全清
notify.get(id);           // 读取
notify.getAll();          // 全部

// ── 多容器（独立位置与配置）──
const center = createNotificationCenter(document.body, {
  position: 'bottom-right',
  maxStack: 3,
  persist: 'app:messages',
});
center.push({ title: '新消息', kind: 'info', options: { description: '…' } });
center.markAllRead();
center.clear();

// ── 全局配置 ──
notify.config({ position: 'top-right', maxStack: 5, pauseOnHover: true });`,
    behaviors: ['notification', 'toast'],
    script: `const notify = notificationMod.notify;
const toast = toastMod.toast;
const countEl = document.getElementById('notif-count');
function refreshCount() {
  const all = notify.getAll();
  if (countEl) countEl.textContent = all.length + ' 条 · ' + all.filter(r => r.opts.unread).length + ' 未读';
}
setInterval(refreshCount, 500);

// ── 语义 ──
document.getElementById('notif-info')?.addEventListener('click', () => {
  notify.info('版本更新', { description: 'v0.6.0 已发布，语义类名全面收敛', unread: true });
  refreshCount();
});
document.getElementById('notif-success')?.addEventListener('click', () => {
  notify.success('已发布', { description: '「星野之下」5 分钟后全量生效', duration: 6000, unread: true });
  refreshCount();
});
document.getElementById('notif-warn')?.addEventListener('click', () => {
  notify.warn('配额将尽', { description: '本月构建时长已用 80%，超出将排队执行', unread: true });
  refreshCount();
});
document.getElementById('notif-error')?.addEventListener('click', () => {
  notify.error('发布失败', { description: '封面图尺寸不足 640×960，请更换后重试', priority: 'high', unread: true });
  refreshCount();
});

// ── 进度通知 ──
document.getElementById('notif-progress')?.addEventListener('click', () => {
  const h = notify.progress('正在导出 PDF', { progressLabel: '准备中…', duration: 0 });
  let p = 0;
  const t = setInterval(() => {
    p += 0.07 + Math.random() * 0.06;
    if (p >= 1) {
      h.setProgress(1, '导出完成');
      clearInterval(t);
      setTimeout(() => { h.update({ title: '导出完成', description: '文件已下载' }); }, 400);
      setTimeout(() => h.dismiss(), 2200);
    } else {
      h.setProgress(p, '导出中 ' + Math.round(p * 100) + '%');
    }
  }, 280);
  refreshCount();
});

// ── Promise confirm ──
document.getElementById('notif-confirm')?.addEventListener('click', async () => {
  const ok = await notify.confirm('确认删除该作品？', {
    description: '此操作不可撤销，相关数据将被清除。',
    confirmLabel: '删除',
    cancelLabel: '取消',
  });
  if (ok) toast.ok('已删除（演示）');
  else toast.warn('已取消');
});

// ── 多按钮 ──
document.getElementById('notif-multi')?.addEventListener('click', () => {
  notify.info('构建失败', {
    description: 'tsup 报错：src/index.ts 第 12 行类型不匹配',
    actions: [
      { label: '查看日志', type: 'primary', onClick: () => toast.ok('打开日志') },
      { label: '重试', onClick: () => toast.ok('已重新触发构建') },
      { label: '忽略' },
    ],
  });
  refreshCount();
});

// ── 倒计时 ──
document.getElementById('notif-countdown')?.addEventListener('click', () => {
  notify.info('会话即将过期', {
    description: '5 分钟内无操作将自动退出，请及时保存。hover 通知可暂停倒计时',
    duration: 8000,
  });
});

// ── 高优先级 ──
document.getElementById('notif-priority')?.addEventListener('click', () => {
  notify.error('磁盘空间不足', {
    description: '剩余 128 MB，构建任务可能失败',
    priority: 'high',
    unread: true,
    actions: [{ label: '清理缓存', type: 'primary', onClick: () => toast.ok('已清理 256 MB') }],
  });
  refreshCount();
});

// ── 头像 ──
document.getElementById('notif-avatar')?.addEventListener('click', () => {
  notify.success('沈墨 回复了你', {
    description: '「这段配乐很棒，用在了第 3 章」',
                avatar: 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22><rect width=%2248%22 height=%2248%22 fill=%22%233d8a5a%22/><text x=%2224%22 y=%2230%22 font-size=%2220%22 text-anchor=%22middle%22 fill=%22white%22>沈</text></svg>',
    link: '#',
    linkLabel: '查看对话',
    unread: true,
  });
  refreshCount();
});

// ── 链接 ──
document.getElementById('notif-link')?.addEventListener('click', () => {
  notify.info('新版本 v0.6.0', {
    description: '类名收敛：pill/toast/stat 语义修饰符统一为 --success/--warning/--error/--info',
    link: '#',
    linkLabel: '查看更新日志 →',
  });
  refreshCount();
});

// ── 未读标记 ──
document.getElementById('notif-unread')?.addEventListener('click', () => {
  notify.info('你有 3 条新评论', {
    description: '来自「星野之下」、「雨停之前」',
    unread: true,
    onClick: (h) => { h.markRead(); toast.ok('已标记为已读'); },
  });
  refreshCount();
});

// ── actions 回调（演示 onShow / onClick / onClose 全回调）──
document.getElementById('notif-actions')?.addEventListener('click', () => {
  notify.success('作品已保存', {
    description: '可随时回到编辑器继续',
    onShow: () => console.log('[notif] onShow'),
    onClick: (h) => { toast.info('点击了通知体'); h.markRead(); },
    onClose: () => console.log('[notif] onClose'),
    actions: [
      { label: '继续编辑', type: 'primary', onClick: () => toast.ok('打开编辑器') },
      { label: '查看', keepOpen: true, onClick: () => toast.info('保持打开') },
    ],
  });
  refreshCount();
});

// ── 动态更新 ──
document.getElementById('notif-update')?.addEventListener('click', () => {
  const h = notify.info('准备就绪', { description: '即将开始下载…', duration: 0 });
  setTimeout(() => h.update({ title: '下载中', description: '正在获取资源 (1/3)' }), 600);
  setTimeout(() => h.update({ description: '正在解压文件 (2/3)' }), 1500);
  setTimeout(() => h.update({ title: '完成', description: '所有资源已就绪' }), 2400);
  setTimeout(() => h.dismiss(), 4000);
  refreshCount();
});

// ── 全局操作 ──
document.getElementById('notif-read')?.addEventListener('click', () => {
  notify.markRead();
  toast.ok('已全部标记为已读');
  refreshCount();
});
document.getElementById('notif-clear')?.addEventListener('click', () => {
  notify.clear();
  toast.ok('已清空');
  refreshCount();
});`,
  },
  {
    slug: 'avatar',
    name: '头像',
    group: '数据展示',
    desc: 'xs 20 / sm 28 / 默认 36 / lg 48；文字兜底或 img 填充（object-fit: cover）。',
    demo: `<div class="demo-row">
  <span class="avatar avatar--xs">沈</span>
  <span class="avatar avatar--sm">顾</span>
  <span class="avatar"><img src="${avatarImg}" alt="林晚晴" /></span>
  <span class="avatar avatar--lg">林</span>
</div>`,
    usage: `<span class="avatar">沈</span>
<span class="avatar avatar--lg"><img src="…" alt="名字" /></span>`,
  },
  {
    slug: 'media-card',
    name: '媒体卡',
    group: '数据展示',
    desc: '2/3 封面（此处用色块代替图片）；hover 上浮 6px + accent 辉光，底部信息条滑出（延迟 80ms）。',
    demo: `<div class="demo-row">
  <div class="media-card" style="width:148px">
    <div class="media-card-cover" style="background:linear-gradient(160deg,var(--token-accent),var(--token-accent-deep))"></div>
    <div class="media-card-overlay">
      <div style="font-size:12px;font-weight:600">星野之下</div>
      <div style="font-size:10px;opacity:.85">视觉小说 · 全年龄</div>
    </div>
  </div>
  <div class="media-card" style="width:148px">
    <div class="media-card-cover" style="background:linear-gradient(160deg,var(--token-accent-cold),var(--token-info))"></div>
    <div class="media-card-overlay">
      <div style="font-size:12px;font-weight:600">雨停之前</div>
      <div style="font-size:10px;opacity:.85">悬疑短篇 · 连载中</div>
    </div>
  </div>
</div>`,
    usage: `<div class="media-card" style="width:148px">
  <div class="media-card-cover" style="background:…"></div>
  <div class="media-card-overlay">
    <div>标题</div>
    <div>副标题</div>
  </div>
</div>`,
  },
  {
    slug: 'rating',
    name: '评分',
    group: '数据展示',
    desc: 'is-filled 实星 / is-half 半星（warning 色）；另有 rating--sm / rating--lg 尺寸。',
    demo: `<div class="demo-row">
  <div class="rating" role="group" aria-label="评分 3.5 星，满分 5 星">
    <button class="rating-star is-filled" type="button" aria-label="1 星">${starSvg}</button>
    <button class="rating-star is-filled" type="button" aria-label="2 星">${starSvg}</button>
    <button class="rating-star is-filled" type="button" aria-label="3 星">${starSvg}</button>
    <button class="rating-star is-half" type="button" aria-label="4 星">${starSvg}</button>
    <button class="rating-star" type="button" aria-label="5 星">${starSvg}</button>
  </div>
</div>`,
    usage: `<div class="rating" role="group" aria-label="评分 3.5 星，满分 5 星">
  <button class="rating-star is-filled" type="button" aria-label="1 星">…星形 svg…</button>
  <button class="rating-star is-half" type="button" aria-label="4 星">…星形 svg…</button>
  <button class="rating-star" type="button" aria-label="5 星">…星形 svg…</button>
</div>
<!-- 填充态由使用方按分数挂 .is-filled / .is-half -->`,

    behaviors: ['controls'],
    behaviorInit: { controls: 'initRating' },
  },
  {
    slug: 'kbd',
    name: '键盘键',
    group: '数据展示',
    desc: '按键帽（含 kbd--sm）与行内代码片 code-inline。',
    demo: `<p style="margin:0">按 <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">K</kbd> 打开命令面板，输入 <code class="code-inline">preset piano dark</code> 切换预设，<kbd class="kbd kbd--sm">Esc</kbd> 关闭。</p>`,
    usage: `<kbd class="kbd">Ctrl</kbd> + <kbd class="kbd kbd--sm">K</kbd>
<code class="code-inline">行内代码</code>`,
  },
  {
    slug: 'list',
    name: '列表',
    group: '数据展示',
    desc: '行间 1px 分隔线 + hover 底色的分隔列表。',
    demo: `<ul class="list">
  <li class="list-item" style="display:flex;align-items:center;gap:8px"><span>账号安全</span><span class="faint" style="margin-left:auto;font-size:11px">已开启二次验证</span></li>
  <li class="list-item" style="display:flex;align-items:center;gap:8px"><span>消息通知</span><span class="faint" style="margin-left:auto;font-size:11px">仅关注的人</span></li>
  <li class="list-item" style="display:flex;align-items:center;gap:8px"><span>数据同步</span><span class="faint" style="margin-left:auto;font-size:11px">每 15 分钟</span></li>
</ul>`,
    usage: `<ul class="list">
  <li class="list-item">条目一</li>
  <li class="list-item">条目二</li>
</ul>`,
  },
  {
    slug: 'accordion',
    name: '折叠面板',
    group: '数据展示',
    desc: '与 behaviors/accordion 配套；本例容器带 data-single（展开一项自动收起其余）。',
    demo: `<div class="accordion" data-single>
  <div class="accordion-item is-open">
    <button class="accordion-trigger" type="button" aria-expanded="true"><span>什么是 @icen.ai/ui？</span>${accChevron}</button>
    <div class="accordion-panel"><div class="accordion-panel-inner">icen.ai 生态的统一设计系统：设计 tokens + 无框架组件 CSS + 行为 JS，所有前端从这里取设计资产。</div></div>
  </div>
  <div class="accordion-item">
    <button class="accordion-trigger" type="button" aria-expanded="false"><span>如何切换色彩预设？</span>${accChevron}</button>
    <div class="accordion-panel"><div class="accordion-panel-inner">预设类挂在 html 上：clay（默认）/ piano / art / vangogh / ink / retro，各含 .dark 变体，可与 .style-* 风格配置正交组合。</div></div>
  </div>
  <div class="accordion-item">
    <button class="accordion-trigger" type="button" aria-expanded="false"><span>组件可以直接写死颜色吗？</span>${accChevron}</button>
    <div class="accordion-panel"><div class="accordion-panel-inner">不可以。组件 CSS 只消费 --token-* 变量，语义色仅绿 / 黄 / 红 + 品牌 accent 四档。</div></div>
  </div>
</div>`,
    usage: `import { initAccordion } from '@icen.ai/ui/behaviors/accordion';
initAccordion();
// 容器带 data-single 时展开一项会收起其余`,
    behaviors: ['accordion'],
    behaviorInit: { accordion: 'initAccordion' },
  },
  {
    slug: 'timeline',
    name: '时间线',
    group: '数据展示',
    desc: '五档语义色圆点 + 连接线，时间右对齐 tabular-nums。',
    demo: `<div class="timeline">
  <div class="timeline-item">
    <div class="timeline-dot timeline-dot--success">${checkSvg}</div>
    <div class="timeline-body">
      <div class="timeline-head"><span class="timeline-title">构建完成</span><span class="timeline-time">10:24</span></div>
      <p class="timeline-desc">dist 产物 18 个文件，耗时 42 秒。</p>
    </div>
  </div>
  <div class="timeline-item">
    <div class="timeline-dot timeline-dot--accent">${infoSvg}</div>
    <div class="timeline-body">
      <div class="timeline-head"><span class="timeline-title">发布到预发环境</span><span class="timeline-time">10:31</span></div>
      <p class="timeline-desc">预发域名已更新，开始回归验证。</p>
    </div>
  </div>
  <div class="timeline-item">
    <div class="timeline-dot timeline-dot--warning">${warnSvg}</div>
    <div class="timeline-body">
      <div class="timeline-head"><span class="timeline-title">发现一处视觉回归</span><span class="timeline-time">10:46</span></div>
      <p class="timeline-desc">暗色模式下卡片描边对比度偏低，已回滚待修。</p>
    </div>
  </div>
  <div class="timeline-item">
    <div class="timeline-dot timeline-dot--info">${infoSvg}</div>
    <div class="timeline-body">
      <div class="timeline-head"><span class="timeline-title">重新发布</span><span class="timeline-time">11:20</span></div>
      <p class="timeline-desc">修复后全量生效，监控指标正常。</p>
    </div>
  </div>
</div>`,
    usage: `<div class="timeline">
  <div class="timeline-item">
    <div class="timeline-dot timeline-dot--success">…svg…</div>
    <div class="timeline-body">
      <div class="timeline-head"><span class="timeline-title">标题</span><span class="timeline-time">10:24</span></div>
      <p class="timeline-desc">描述</p>
    </div>
  </div>
</div>`,
  },
  {
    slug: 'desc',
    name: '描述列表',
    group: '数据展示',
    desc: 'desc--bordered 格线列表（--desc-cols 控制列数，--desc-span 跨列）。',
    demo: `<div class="desc desc--bordered">
  <p class="desc-title">发布信息</p>
  <dl class="desc-grid" style="--desc-cols:2">
    <div class="desc-item"><dt>作品名称</dt><dd>星野之下</dd></div>
    <div class="desc-item"><dt>版本</dt><dd>v1.3.0</dd></div>
    <div class="desc-item"><dt>构建状态</dt><dd>成功</dd></div>
    <div class="desc-item"><dt>更新时间</dt><dd>2026-07-28 10:24</dd></div>
    <div class="desc-item" style="--desc-span:2"><dt>简介</dt><dd>一款关于星空与约定的短篇视觉小说。</dd></div>
  </dl>
</div>`,
    usage: `<div class="desc desc--bordered">
  <p class="desc-title">标题</p>
  <dl class="desc-grid" style="--desc-cols:2">
    <div class="desc-item"><dt>键</dt><dd>值</dd></div>
  </dl>
</div>`,
  },
  {
    slug: 'tree',
    name: '树形',
    group: '数据展示',
    desc: '与 behaviors/tree 配套：三层可折叠 + 叶子单选 + 禁用节点。',
    demo: `<ul class="tree">
  <li>
    <div class="tree-node" style="--depth:0">
      <button class="tree-toggle" type="button" aria-expanded="true" aria-label="折叠/展开">${chevronSvg}</button>
      <span class="tree-label">素材库</span>
    </div>
    <ul>
      <li>
        <div class="tree-node" style="--depth:1">
          <button class="tree-toggle" type="button" aria-expanded="true" aria-label="折叠/展开">${chevronSvg}</button>
          <span class="tree-label">角色立绘</span>
        </div>
        <ul>
          <li><div class="tree-node is-selected" style="--depth:2"><span class="tree-toggle" aria-hidden="true"></span><span class="tree-label">主角·常服.png</span></div></li>
          <li><div class="tree-node" style="--depth:2"><span class="tree-toggle" aria-hidden="true"></span><span class="tree-label">主角·礼服.png</span></div></li>
        </ul>
      </li>
      <li><div class="tree-node" style="--depth:1"><span class="tree-toggle" aria-hidden="true"></span><span class="tree-label">背景音乐</span></div></li>
      <li><div class="tree-node is-disabled" style="--depth:1"><span class="tree-toggle" aria-hidden="true"></span><span class="tree-label">未授权素材（禁用）</span></div></li>
    </ul>
  </li>
  <li>
    <div class="tree-node" style="--depth:0">
      <button class="tree-toggle is-collapsed" type="button" aria-expanded="false" aria-label="折叠/展开">${chevronSvg}</button>
      <span class="tree-label">剧本（默认折叠）</span>
    </div>
    <ul hidden>
      <li><div class="tree-node" style="--depth:1"><span class="tree-toggle" aria-hidden="true"></span><span class="tree-label">第一章.txt</span></div></li>
      <li><div class="tree-node" style="--depth:1"><span class="tree-toggle" aria-hidden="true"></span><span class="tree-label">第二章.txt</span></div></li>
    </ul>
  </li>
</ul>`,
    usage: `import { initTree } from '@icen.ai/ui/behaviors/tree';
initTree();
// toggle 折叠/展开子 ul；点击叶子节点单选（.is-selected）`,
    behaviors: ['tree'],
    behaviorInit: { tree: 'initTree' },
  },
  {
    slug: 'carousel',
    name: '轮播',
    group: '数据展示',
    desc: '与 behaviors/carousel 配套：箭头 / 自动圆点 / 循环切换（三张色块幻灯）。',
    demo: `<div class="carousel">
  <div class="carousel-track">
    <div class="carousel-slide"><div style="height:170px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--token-accent),var(--token-accent-deep));color:#fff">第一张 · 陶土橙</div></div>
    <div class="carousel-slide"><div style="height:170px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--token-success),var(--token-info));color:#fff">第二张 · 青绿过渡</div></div>
    <div class="carousel-slide"><div style="height:170px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--token-accent-cold),var(--token-accent));color:#fff">第三张 · 冷蓝回暖</div></div>
  </div>
  <button class="carousel-arrow carousel-arrow--prev" type="button" aria-label="上一张"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
  <button class="carousel-arrow carousel-arrow--next" type="button" aria-label="下一张"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
  <div class="carousel-dots"></div>
</div>`,
    usage: `import { initCarousel } from '@icen.ai/ui/behaviors/carousel';
initCarousel();
// dots 自动生成；首尾循环；当前 dot 挂 .is-active`,
    behaviors: ['carousel'],
    behaviorInit: { carousel: 'initCarousel' },
  },
  {
    slug: 'badge',
    name: '徽标',
    group: '数据展示',
    desc: '角标式徽标：数字计数 / 纯圆点，挂在外层元素的角上（外层需 position: relative）。区别于 pill（行内状态徽章）。',
    demo: `<div class="demo-row">
  <span class="badge-host">
    <button class="btn" type="button">消息</button>
    <span class="badge">9</span>
  </span>
  <span class="badge-host">
    <button class="btn" type="button">通知</button>
    <span class="badge">99+</span>
  </span>
  <span class="badge-host">
    <button class="btn btn-primary" type="button">收件箱</button>
    <span class="badge badge--accent">3</span>
  </span>
  <span class="badge-host">
    <button class="btn" type="button">待办</button>
    <span class="badge badge--dot badge--error"></span>
  </span>
</div>
<div class="demo-row" style="margin-top:14px">
  <span class="badge-host">
    <span class="avatar">沈</span>
    <span class="badge badge--bottom badge--dot badge--success"></span>
  </span>
  <span class="badge-host">
    <span class="avatar"><img src="${avatarImg}" alt="头像" /></span>
    <span class="badge badge--bottom badge--dot badge--warning"></span>
  </span>
  <span class="badge-host">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--token-text-muted)"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
    <span class="badge badge--sm badge--error">5</span>
  </span>
</div>`,
    usage: `<span class="badge-host">
  <button class="btn">消息</button>
  <span class="badge">9</span>
</span>
<!-- 纯圆点：badge--dot；语义色：--success/--warning/--error/--accent/--info -->
<!-- 底部角（头像在线点）：badge--bottom；尺寸：badge--sm/lg -->`,
  },
  {
    slug: 'scroll-area',
    name: '滚动容器',
    group: '数据展示',
    desc: '显式带视觉边界的滚动区。全局已有细薄滚动条（base.css），本组件用于强调"可滚动"或限定方向的场景。',
    demo: `<div class="demo-row" style="align-items:flex-start">
  <div class="scroll-area scroll-area--inset" style="width:240px;height:140px;font-size:var(--density-font-size-sm);color:var(--token-text-muted)">
    <p>inset 变体：内嵌阴影 + 背景色 + 圆角边框，<strong>强烈暗示可滚动</strong>。</p>
    <p>这里是一段超长内容，必须超出 140px 高度才能看到滚动条效果。</p>
    <p>第二条：overscroll-behavior: contain 已开启，不会把滚动传到外层。</p>
    <p>第三条：触屏使用惯性滚动（-webkit-overflow-scrolling: touch）。</p>
    <p>第四条：prefers-reduced-motion: reduce 时自动关闭平滑滚动。</p>
    <p>第五条：滚动条宽度随变体调整（sm 6px / 默认 8px / lg 12px）。</p>
    <p>第六条：可通过 tabindex="0" 让本容器可被键盘聚焦。</p>
  </div>
  <div class="scroll-area scroll-area--y scroll-area--sm" style="width:160px;height:140px;padding:8px;background:var(--token-bg-soft);border-radius:var(--radius-md);font-size:var(--density-font-size-sm)">
    <div style="height:280px;display:flex;flex-direction:column;gap:6px">
      <div class="demo-box">条 1</div>
      <div class="demo-box">条 2</div>
      <div class="demo-box">条 3</div>
      <div class="demo-box">条 4</div>
      <div class="demo-box">条 5</div>
      <div class="demo-box">条 6</div>
      <div class="demo-box">条 7</div>
    </div>
  </div>
  <div class="scroll-area scroll-area--x scroll-area--lg" style="max-width:240px;padding-bottom:8px">
    <div style="display:flex;gap:8px;width:520px">
      <div class="demo-box" style="flex-shrink:0">横向 A</div>
      <div class="demo-box" style="flex-shrink:0">横向 B</div>
      <div class="demo-box" style="flex-shrink:0">横向 C</div>
      <div class="demo-box" style="flex-shrink:0">横向 D</div>
      <div class="demo-box" style="flex-shrink:0">横向 E</div>
    </div>
  </div>
</div>`,
    usage: `<div class="scroll-area scroll-area--inset" style="height:200px">
  超长内容…
</div>
<!-- 变体：--sm/--lg（滚动条宽度）/--x/--y/--both（轴向）/--inset（带边界）/--fade（渐隐遮罩）-->`,
  },
  {
    slug: 'charts',
    name: '图表总览',
    group: '图表',
    desc: '零依赖纯 SVG/DOM 渲染（无 ECharts）——12 种图表 + 通用层。renderChart 统一入口吃一份纯 JSON 规格（ChartSpec）：type 缺省自动推断、data[] + dims 任意维度透视、内置 tooltip、icen:chart-hover/click/dblclick/contextmenu 交互事件族、图例点击切换系列。下方 demo 可切换图型并实时看事件日志；实际使用请按需安装细分类型（kit/chart-line 等）。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <span class="toolbar-label">通用层</span>
  <button class="btn btn-sm btn-primary" type="button" data-chart-spec="line">多系列折线</button>
  <button class="btn btn-sm" type="button" data-chart-spec="vbar">分组柱状</button>
  <button class="btn btn-sm" type="button" data-chart-spec="stacked">堆叠柱状</button>
  <button class="btn btn-sm" type="button" data-chart-spec="scatter">散点气泡</button>
  <button class="btn btn-sm" type="button" data-chart-spec="calendar">贡献日历</button>
  <button class="btn btn-sm" type="button" data-chart-spec="donut">环形占比</button>
</div>
<p class="demo-label" style="margin:0 0 10px">悬停看 tooltip · 单击/双击/右键数据点 · 点图例行切换系列 · 标题右侧小眼睛隐藏/显示图例——事件日志在下方</p>
<div class="chart" id="chart-universal" style="border:1px solid var(--token-line-soft);border-radius:var(--radius-md);padding:12px"></div>
<p class="demo-label" id="chart-event-log" style="margin-top:8px">事件日志：等待交互…</p>
<div class="chart-grid" style="margin-top:16px">
  <div>
    <p class="chart-cap">垂直柱状 · 每月投稿</p>
    <div class="chart" id="chart-vbar"></div>
  </div>
  <div>
    <p class="chart-cap">水平条形 · 流量来源</p>
    <div class="chart" id="chart-hbar"></div>
  </div>
  <div>
    <p class="chart-cap">堆叠条 · 任务进度</p>
    <div class="chart" id="chart-stack"></div>
  </div>
  <div>
    <p class="chart-cap">环形 · 工时分布</p>
    <div class="chart" id="chart-donut"></div>
  </div>
  <div>
    <p class="chart-cap">进度环 · 完成率</p>
    <div class="chart" id="chart-gauge"></div>
  </div>
  <div>
    <p class="chart-cap">迷你趋势 · 近 14 天</p>
    <div class="chart" id="chart-spark"></div>
  </div>
  <div style="grid-column:1/-1">
    <p class="chart-cap">折线 · 一周活跃</p>
    <div class="chart" id="chart-line"></div>
  </div>
  <div style="grid-column:1/-1">
    <p class="chart-cap">贡献图 · 近 26 周</p>
    <div class="chart" id="chart-heatmap"></div>
  </div>
</div>`,
    usage: `// ── 通用层（推荐；纯 JSON 规格，AI 调用层同构）──
import { renderChart } from '@icen.ai/ui/behaviors/charts';

const handle = renderChart(el, {
  title: '一周活跃',
  labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  series: [
    { name: 'Web', values: [8, 14, 9, 18, 22, 16, 25] },
    { name: 'CLI', values: [3, 5, 4, 8, 6, 11, 9] },
  ],
  format: { notation: 'compact', unit: '次' },
  // type 缺省自动推断（时间序→line / 占比→donut / dates→calendar / points→scatter…）
  // tooltip: false 关闭内置提示；stacked: true 堆叠柱；legend: false 初始隐藏图例
});
// 头部小眼睛切换全部图例（派 icen:chart-legend-visibility）；点图例项切换单系列
handle.on('click', (d) => console.log(d.label, d.value, d.seriesName));
handle.on('contextmenu', (d, e) => openContextMenu(e, d));  // 右键接自家 context-menu
handle.update(nextSpec);   // 原地重渲染（事件委托保留）

// 任意维度原始记录 + 字段映射（pivot 成 类目 × 系列）
renderChart(el, {
  data: [{ 城市: '北京', 渠道: '直营', 销量: 120 }, /* … */],
  dims: { label: '城市', series: '渠道', value: '销量' },
});

// 容错归一（LLM/外部输入友好）：'bar'→vbar、'pie'→donut、字符串数字、JSON 字符串
import { normalizeChartSpec, inferChartType } from '@icen.ai/ui/behaviors/charts';

// ── 底层渲染器（按需安装细分类型 kit/chart-line 等，只引需要的 CSS + JS）──
import { renderHeatmap, renderCalendar, renderScatter } from '@icen.ai/ui/behaviors/charts';
renderHeatmap(el, { values: 近180天数值数组, weeks: 26 });        // 周格热力
renderCalendar(el, { dates: ['2026-07-01', /* … */], values: [5, /* … */] }); // 贡献日历（月份标签）
renderScatter(el, { points: [{ x: 1, y: 2, size: 30, label: 'A' }] }); // 散点/气泡`,
    behaviors: ['charts'],
    script: `const M = chartsMod;
const on = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };

/* ── 通用层：renderChart + 交互事件日志 ── */
const uni = document.getElementById('chart-universal');
const logEl = document.getElementById('chart-event-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2200);
}

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const SPECS = {
  line: { title: '一周活跃（多系列折线 · 自动推断）', labels: DAYS,
    series: [
      { name: 'Web', values: [8, 14, 9, 18, 22, 16, 25] },
      { name: 'CLI', values: [3, 5, 4, 8, 6, 11, 9] },
      { name: 'API', values: [12, 11, 15, 13, 17, 14, 19] },
    ] },
  vbar: { type: 'vbar', title: '季度注册（分组柱状）', labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { name: '个人', values: [420, 480, 510, 620] },
      { name: '团队', values: [180, 220, 260, 310] },
    ], format: { notation: 'compact' } },
  stacked: { type: 'vbar', stacked: true, title: '季度注册（堆叠柱状）', labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { name: '个人', values: [420, 480, 510, 620] },
      { name: '团队', values: [180, 220, 260, 310] },
    ], format: { notation: 'compact' } },
  scatter: { type: 'scatter', title: '构建时长 × 包体积（气泡 = 测试数）',
    points: Array.from({ length: 26 }, function (_, i) {
      return { x: Math.round((2 + i * 0.4) * 10) / 10, y: Math.round((30 + Math.sin(i * 0.7) * 22 + i * 1.6) * 10) / 10, size: 4 + (i % 5) * 9, label: '构建 #' + (i + 1) };
    }), format: { unit: 's' } },
  calendar: { type: 'calendar', title: '近 18 周提交（贡献日历）',
    dates: Array.from({ length: 126 }, function (_, i) {
      const d = new Date(); d.setDate(d.getDate() - (125 - i));
      return d.toISOString().slice(0, 10);
    }),
    values: Array.from({ length: 126 }, function (_, i) {
      return Math.max(0, Math.round(Math.abs(Math.sin(i * 0.61)) * 7 + (i % 17 === 0 ? 6 : 0) - (i % 11 === 0 ? 9 : 0)));
    }) },
  donut: { type: 'donut', title: '工时分布（环形占比）',
    segments: [{ label: '研发', value: 48 }, { label: '设计', value: 32 }, { label: '测试', value: 20 }] },
};

let handle = null;
function show(key) {
  if (!uni) return;
  if (handle) handle.update(SPECS[key]);
  else handle = M.renderChart(uni, SPECS[key]);
}
show('line');
document.querySelectorAll('[data-chart-spec]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    show(btn.getAttribute('data-chart-spec'));
    document.querySelectorAll('[data-chart-spec]').forEach(function (b) { b.classList.toggle('btn-primary', b === btn); });
  });
});
if (uni && handle) {
  const brief = function (d) {
    const where = d.seriesName ? d.seriesName + ' · ' : '';
    return where + (d.label ?? '') + ' = ' + d.value;
  };
  handle.on('hover', function (d) { if (d.phase === 'enter') log('hover · ' + brief(d)); });
  handle.on('click', function (d) { log('click · ' + brief(d)); });
  handle.on('dblclick', function (d) { log('dblclick · ' + brief(d)); });
  handle.on('contextmenu', function (d) { log('contextmenu · ' + brief(d) + '（默认菜单已拦，可接 context-menu 组件）'); });
  uni.addEventListener('icen:chart-legend-toggle', function (e) {
    log('legend-toggle · ' + e.detail.key + (e.detail.hidden ? ' 已隐藏' : ' 已显示'));
  });
}

/* ── 底层渲染器总览 ── */
on('chart-vbar', (el) => M.renderVBar(el, { labels: ['一月', '二月', '三月', '四月', '五月', '六月'], values: [12, 19, 8, 24, 16, 28] }));
on('chart-hbar', (el) => M.renderHBar(el, { labels: ['搜索', '推荐', '分享', '直接访问'], values: [320, 240, 160, 80], tone: 'success' }));
on('chart-stack', (el) => M.renderStack(el, { segments: [{ label: '已完成', value: 45, tone: 'success' }, { label: '进行中', value: 30 }, { label: '待处理', value: 25, tone: 'warning' }] }));
on('chart-donut', (el) => M.renderDonut(el, { segments: [{ label: '研发', value: 48 }, { label: '设计', value: 32, tone: 'success' }, { label: '测试', value: 20, tone: 'warning' }] }));
on('chart-line', (el) => M.renderLine(el, { labels: DAYS, values: [8, 14, 9, 18, 22, 16, 25] }));
on('chart-gauge', (el) => M.renderGauge(el, { value: 64, label: '完成率' }));
on('chart-spark', (el) => M.renderSparkline(el, { values: [4, 7, 5, 9, 6, 11, 8, 13, 10, 15, 12, 17, 14, 19] }));
on('chart-heatmap', (el) => {
  const values = Array.from({ length: 182 }, (_, i) => {
    const base = Math.abs(Math.sin(i * 0.61)) * 7;
    const spike = i % 17 === 0 ? 8 : 0;
    const rest = i % 11 === 0 ? -99 : 0;
    return Math.max(0, Math.round(base + spike + rest));
  });
  M.renderHeatmap(el, { values, weeks: 26 });
});`,
  },
  {
    slug: 'chart-line',
    name: '折线图',
    group: '图表',
    desc: '面积渐变 + 网格 + 数据点的折线趋势图；series 多系列走调色盘 + 可切换图例（点击图例行显隐系列）。独立安装：只引这一份 CSS + renderLine。',
    demo: `<div class="chart-grid">
  <div style="grid-column:1/-1">
    <p class="chart-cap">一周活跃用户趋势（多系列 · 点图例切换）</p>
    <div class="chart" id="line-demo"></div>
  </div>
</div>`,
    usage: `import '@icen.ai/ui/kit/chart-line';
import { renderLine } from '@icen.ai/ui/kit/chart-line';

renderLine(el, { labels: ['周一','周二','周三','周四','周五','周六','周日'], values: [8, 14, 9, 18, 22, 16, 25] });

// 多系列（调色盘自动分配 + 可切换图例）
renderLine(el, {
  labels: ['周一', '周日…'],
  series: [
    { name: 'Web', values: [8, /* … */] },
    { name: 'CLI', values: [3, /* … */] },
  ],
});`,
    behaviors: ['charts'],
    script: `const renderLine = chartsMod.renderLine;
const el = document.getElementById('line-demo');
if (el) renderLine(el, {
  labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  series: [
    { name: 'Web', values: [8, 14, 9, 18, 22, 16, 25] },
    { name: 'CLI', values: [3, 5, 4, 8, 6, 11, 9] },
    { name: 'API', values: [12, 11, 15, 13, 17, 14, 19] },
  ],
});`,
  },
  {
    slug: 'chart-bar',
    name: '柱状图',
    group: '图表',
    desc: 'renderVBar 垂直柱状 + renderHBar 水平条形两种形态，同一 kit 入口。',
    demo: `<div class="chart-grid">
  <div>
    <p class="chart-cap">月度投稿（垂直柱状）</p>
    <div class="chart" id="bar-vbar"></div>
  </div>
  <div>
    <p class="chart-cap">流量来源（水平条形）</p>
    <div class="chart" id="bar-hbar"></div>
  </div>
</div>`,
    usage: `import { renderVBar, renderHBar } from '@icen.ai/ui/kit/chart-bar';

renderVBar(el,  { labels: ['一月','二月'], values: [12, 19] });
renderHBar(el,  { labels: ['搜索','直接'], values: [320, 80], tone: 'success' });`,
    behaviors: ['charts'],
    script: `const renderVBar = chartsMod.renderVBar;
const renderHBar = chartsMod.renderHBar;
const on = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
on('bar-vbar', (el) => renderVBar(el, { labels: ['一月', '二月', '三月', '四月', '五月', '六月'], values: [12, 19, 8, 24, 16, 28] }));
on('bar-hbar', (el) => renderHBar(el, { labels: ['搜索', '推荐', '分享', '直接访问'], values: [320, 240, 160, 80], tone: 'success' }));`,
  },
  {
    slug: 'chart-pie',
    name: '饼图',
    group: '图表',
    desc: '环形分割图（renderDonut）+ 图例百分比。支持多段、自定义色调与格式化。',
    demo: `<div class="chart-grid">
  <div>
    <p class="chart-cap">工时分布（环形）</p>
    <div class="chart" id="pie-demo"></div>
  </div>
</div>`,
    usage: `import { renderDonut } from '@icen.ai/ui/kit/chart-pie';

renderDonut(el, {
  segments: [
    { label: '研发', value: 48 },
    { label: '设计', value: 32, tone: 'success' },
    { label: '测试', value: 20, tone: 'warning' },
  ],
});`,
    behaviors: ['charts'],
    script: `const renderDonut = chartsMod.renderDonut;
const el = document.getElementById('pie-demo');
if (el) renderDonut(el, { segments: [{ label: '研发', value: 48 }, { label: '设计', value: 32, tone: 'success' }, { label: '测试', value: 20, tone: 'warning' }] });`,
  },
  {
    slug: 'chart-radar',
    name: '雷达图',
    group: '图表',
    desc: 'N 轴蛛网雷达图（renderRadar），支持多系列叠加对比 + 图例。',
    demo: `<div class="chart-grid">
  <div>
    <p class="chart-cap">角色能力对比</p>
    <div class="chart" id="radar-demo"></div>
  </div>
</div>`,
    usage: `import { renderRadar } from '@icen.ai/ui/kit/chart-radar';

renderRadar(el, {
  axes: ['攻击', '防御', '速度', '技巧', '魔法', '运气'],
  series: [
    { name: '战士', values: [9, 8, 5, 6, 2, 5] },
    { name: '法师', values: [3, 4, 6, 7, 9, 6], tone: 'success' },
  ],
});`,
    behaviors: ['charts'],
    script: `const renderRadar = chartsMod.renderRadar;
const el = document.getElementById('radar-demo');
if (el) renderRadar(el, {
  axes: ['攻击', '防御', '速度', '技巧', '魔法', '运气'],
  series: [
    { name: '战士', values: [9, 8, 5, 6, 2, 5] },
    { name: '法师', values: [3, 4, 6, 7, 9, 6], tone: 'success' },
  ],
});`,
  },
  {
    slug: 'chart-heatmap',
    name: '热力图',
    group: '图表',
    desc: 'GitHub 式贡献图热力格（renderHeatmap）：7 行 × N 周，5 档色阶。支持精确日期或便捷数组。',
    demo: `<div class="chart-grid">
  <div style="grid-column:1/-1">
    <p class="chart-cap">近 26 周活跃热力图</p>
    <div class="chart" id="heatmap-demo"></div>
  </div>
</div>`,
    usage: `import { renderHeatmap } from '@icen.ai/ui/kit/chart-heatmap';

renderHeatmap(el, { values: 近180天数值数组, weeks: 26 });       // 便捷形态
renderHeatmap(el, { data: [{ date: '2026-07-01', value: 5 }] }); // 精确日期形态`,
    behaviors: ['charts'],
    script: `const renderHeatmap = chartsMod.renderHeatmap;
const el = document.getElementById('heatmap-demo');
if (el) {
  const values = Array.from({ length: 182 }, (_, i) => {
    const base = Math.abs(Math.sin(i * 0.61)) * 7;
    const spike = i % 17 === 0 ? 8 : 0;
    const rest = i % 11 === 0 ? -99 : 0;
    return Math.max(0, Math.round(base + spike + rest));
  });
  renderHeatmap(el, { values, weeks: 26 });
}`,
  },
  {
    slug: 'chart-area',
    name: '面积图',
    group: '图表',
    desc: '以面积填充为主体的趋势图（renderArea），与折线同族但视觉更厚重。',
    demo: `<div class="chart-grid">
  <div style="grid-column:1/-1">
    <p class="chart-cap">季度营收趋势（面积）</p>
    <div class="chart" id="area-demo"></div>
  </div>
</div>`,
    usage: `import { renderArea } from '@icen.ai/ui/kit/chart-area';

renderArea(el, {
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  values: [120, 180, 150, 210],
  tone: 'success',
});`,
    behaviors: ['charts'],
    script: `const renderArea = chartsMod.renderArea;
const el = document.getElementById('area-demo');
if (el) renderArea(el, { labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [120, 180, 150, 210], tone: 'success' });`,
  },
  {
    slug: 'chart-stack',
    name: '堆叠条',
    group: '图表',
    desc: '100% 堆叠条形图（renderStack），展示各部分占比 + 图例。',
    demo: `<div class="chart-grid">
  <div style="grid-column:1/-1">
    <p class="chart-cap">任务进度分布</p>
    <div class="chart" id="stack-demo"></div>
  </div>
</div>`,
    usage: `import { renderStack } from '@icen.ai/ui/kit/chart-stack';

renderStack(el, {
  segments: [
    { label: '已完成', value: 45, tone: 'success' },
    { label: '进行中', value: 30 },
    { label: '待处理', value: 25, tone: 'warning' },
  ],
});`,
    behaviors: ['charts'],
    script: `const renderStack = chartsMod.renderStack;
const el = document.getElementById('stack-demo');
if (el) renderStack(el, { segments: [{ label: '已完成', value: 45, tone: 'success' }, { label: '进行中', value: 30 }, { label: '待处理', value: 25, tone: 'warning' }] });`,
  },
  {
    slug: 'chart-gauge',
    name: '仪表盘',
    group: '图表',
    desc: '环形单值仪表盘（renderGauge），中心显示百分比，适合 KPI 完成率。',
    demo: `<div class="chart-grid">
  <div>
    <p class="chart-cap">发布完成率</p>
    <div class="chart" id="gauge-demo"></div>
  </div>
</div>`,
    usage: `import { renderGauge } from '@icen.ai/ui/kit/chart-gauge';

renderGauge(el, { value: 64, label: '完成率' });`,
    behaviors: ['charts'],
    script: `const renderGauge = chartsMod.renderGauge;
const el = document.getElementById('gauge-demo');
if (el) renderGauge(el, { value: 64, label: '完成率' });`,
  },
  {
    slug: 'chart-sparkline',
    name: '迷你趋势',
    group: '图表',
    desc: '无轴迷你趋势线（renderSparkline），嵌入指标卡 / 表格单元格的利器。',
    demo: `<div class="chart-grid">
  <div>
    <p class="chart-cap">近 14 天活跃（迷你）</p>
    <div class="chart" id="spark-demo"></div>
  </div>
</div>`,
    usage: `import { renderSparkline } from '@icen.ai/ui/kit/chart-sparkline';

renderSparkline(el, { values: [4, 7, 5, 9, 6, 11, 8, 13, 10, 15] });`,
    behaviors: ['charts'],
    script: `const renderSparkline = chartsMod.renderSparkline;
const el = document.getElementById('spark-demo');
if (el) renderSparkline(el, { values: [4, 7, 5, 9, 6, 11, 8, 13, 10, 15, 12, 17, 14, 19] });`,
  },
  {
    slug: 'chart-scatter',
    name: '散点气泡',
    group: '图表',
    desc: '散点/气泡图（renderScatter）：坐标域自动 nice 取整 + 边界刻度；points 的 size 为第三维时映射气泡半径 3–10。数据点带交互标记（hover/单击/双击/右键走 renderChart 通用层）。',
    demo: `<div class="chart-grid">
  <div style="grid-column:1/-1">
    <p class="chart-cap">构建时长 × 包体积（气泡 = 测试数）</p>
    <div class="chart" id="scatter-demo"></div>
  </div>
</div>`,
    usage: `import { renderScatter } from '@icen.ai/ui/kit/chart-scatter';

renderScatter(el, {
  points: [
    { x: 3.2, y: 48, size: 12, label: 'web' },
    { x: 5.1, y: 72, size: 30, label: 'cli' },
  ],
  tone: 'accent',
});
// 交互：配 renderChart 走通用层（tooltip + icen:chart-* 事件族）
import { renderChart } from '@icen.ai/ui/behaviors/charts';
renderChart(el, { type: 'scatter', points: [/* 同上 */] }).on('click', (d) => { /* d.label / d.value */ });`,
    behaviors: ['charts'],
    script: `const el = document.getElementById('scatter-demo');
if (el && chartsMod.renderScatter) {
  chartsMod.renderScatter(el, {
    points: Array.from({ length: 26 }, function (_, i) {
      return { x: Math.round((2 + i * 0.4) * 10) / 10, y: Math.round((30 + Math.sin(i * 0.7) * 22 + i * 1.6) * 10) / 10, size: 4 + (i % 5) * 9, label: '构建 #' + (i + 1) };
    }),
  });
}`,
  },
  {
    slug: 'chart-calendar',
    name: '贡献日历',
    group: '图表',
    desc: '贡献日历（renderCalendar，GitHub 提交图同款）：dates + values 自动按周布局，月份标签 + 星期列 + 5 档色阶图例。周格热力（renderHeatmap）的日历完整形态。',
    demo: `<div class="chart-grid">
  <div style="grid-column:1/-1">
    <p class="chart-cap">近 18 周提交</p>
    <div class="chart" id="calendar-demo"></div>
  </div>
</div>`,
    usage: `import { renderCalendar } from '@icen.ai/ui/kit/chart-calendar';

renderCalendar(el, {
  dates: ['2026-06-01', '2026-06-02', /* … */],   // ISO 日期（旧 → 新）
  values: [5, 12, /* … */],                        // 与 dates 配对
});
// 或精确形态 data: [{ date, value }[]]；色阶 tone 可覆盖
// 交互：配 renderChart({ type: 'calendar', dates, values }) 走通用层`,
    behaviors: ['charts'],
    script: `const el = document.getElementById('calendar-demo');
if (el && chartsMod.renderCalendar) {
  const dates = Array.from({ length: 126 }, function (_, i) {
    const d = new Date(); d.setDate(d.getDate() - (125 - i));
    return d.toISOString().slice(0, 10);
  });
  const values = dates.map(function (_, i) {
    return Math.max(0, Math.round(Math.abs(Math.sin(i * 0.61)) * 7 + (i % 17 === 0 ? 6 : 0) - (i % 11 === 0 ? 9 : 0)));
  });
  chartsMod.renderCalendar(el, { dates: dates, values: values });
}`,
  },
  {
    slug: 'table',
    name: '表格',
    group: '数据展示',
    desc: 'table-wrap 负责窄屏横向滚动；行 hover 高亮，ops 列右对齐放 btn-sm。增强：--zebra 斑马纹、caption 标题、--sticky-col 首列粘滞、行状态色（row-success/warning/error）、展开行（row-expand）。',
    demo: `<div class="table-wrap table-wrap--bordered">
  <table class="table table--zebra">
    <caption class="table-caption">服务实例清单 · 2026 年 7 月</caption>
    <thead>
      <tr><th>名称</th><th>区域</th><th>状态</th><th class="num">实例数</th><th class="ops">操作</th></tr>
    </thead>
    <tbody>
      <tr><td>gateway</td><td>us-east-1</td><td><span class="pill pill--success">运行中</span></td><td class="num">4</td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">停用</button></td></tr>
      <tr><td>accounts</td><td>us-west-2</td><td><span class="pill pill--success">运行中</span></td><td class="num">2</td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">停用</button></td></tr>
      <tr class="row-warning"><td>billing</td><td>eu-west-1</td><td><span class="pill pill--warning">降级</span></td><td class="num">2</td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">停用</button></td></tr>
      <tr class="row-error"><td>archive</td><td>ap-northeast-1</td><td><span class="pill pill--error">已停止</span></td><td class="num">0</td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">启用</button></td></tr>
      <tr><td>search</td><td>us-east-1</td><td><span class="pill pill--success">运行中</span></td><td class="num">6</td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">停用</button></td></tr>
    </tbody>
    <tfoot>
      <tr><td colspan="3">合计</td><td class="num">14</td><td></td></tr>
    </tfoot>
  </table>
</div>`,
    usage: `<div class="table-wrap [--bordered]">
  <table class="table [--zebra] [--compact|--dense] [--sticky-col]">
    <caption class="table-caption">标题</caption>
    <thead><tr><th>名称</th><th class="ops">操作</th></tr></thead>
    <tbody>
      <tr class="row-link [.is-selected] [.row-success|.row-warning|.row-error]">
        <td>gateway</td>
        <td class="ops"><button class="btn btn-sm">编辑</button></td>
      </tr>
    </tbody>
    <tfoot><tr><td>合计</td></tr></tfoot>
  </table>
</div>`,

    behaviors: ['controls'],
    behaviorInit: { controls: 'initTableSort' },
  },
  {
    slug: 'datatable',
    name: '数据表格',
    group: '数据展示',
    desc: 'createTable 函数式 API：搜索 / 排序 / 筛选 / 多选（Shift 范围选）/ 分页 / 虚拟滚动（万级行）/ 行展开 / 列宽拖拽 / 列显隐 / 冻结列 / CSV 导出 / 行右键。管线缓存，零依赖。',
    demo: `<div class="demo-col-wide" style="width:100%">
  <p class="chart-cap">全功能：搜索 / 排序 / 列筛选 / 多选 / 分页 / 行展开 / 列宽拖拽 / 列显隐 / 导出 / 冻结列 / 右键行</p>
  <div id="dt-main"></div>
  <p class="chart-cap" style="margin-top:20px">紧凑密度 + 行着色（rowClassName）</p>
  <div id="dt-compact"></div>
  <p class="chart-cap" style="margin-top:20px">虚拟滚动：10,000 行（滚动试试）</p>
  <div id="dt-virtual"></div>
</div>`,
    usage: `import { createTable } from '@icen.ai/ui/kit/datatable';

const table = createTable(el, {
  columns: [
    { key: 'name', title: '名称', sortable: true, width: '160px', frozen: true },
    { key: 'status', title: '状态', filterable: true,
      render: (v) => pillNode(v) },            // 返回 Node = 嵌套任意组件
    { key: 'updated', title: '更新', sortable: true },
    { key: 'ops', title: '操作', render: (_v, row) => actionsNode(row) },
  ],
  data: rows,
  rowKey: 'id',                               // 多选/展开跨页保持的依据
  searchable: true,                           // 内置搜索（160ms 防抖）
  selectable: true,                           // 多选 + 表头三态 + Shift 范围选
  pagination: true, pageSize: 10,             // 分页；或 virtual: true 万级行虚拟滚动
  resizable: true,                            // 列宽拖拽（默认开）
  columnVisibility: true,                     // 工具栏列显隐开关
  exportable: true,                           // 工具栏 CSV 导出按钮
  density: 'compact',                         // 紧凑密度（可选）
  rowClassName: (row) => row.status === '已停止' ? 'row-offline' : '',
  expandable: (row) => detailNode(row),       // 行展开（虚拟模式外可用）
  contextMenu: (row) => [                     // 行右键（复用 context-menu，kit 已带 menu.css）
    { label: '重命名', shortcut: 'F2', onClick: () => toast.ok('重命名') },
    { type: 'separator' },
    { label: '停止服务', danger: true, onClick: () => toast.warn('已停止') },
  ],
  onSelectionChange: (rows) => console.log(rows.length),
  onSortChange: (key, dir) => console.log(key, dir),
});

table.setData(next);      // 换数据
table.getData();          // 取当前管线数据（搜索→筛选→排序后）
table.exportCSV('服务列表.csv'); // 导出
table.showColumn('updated');    // 显示列
table.hideColumn('ops');        // 隐藏列
table.destroy();`,
    behaviors: ['datatable', 'toast'],
    script: `const createTable = datatableMod.createTable;
const toast = toastMod.toast;

const STATUSES = ['运行中', '降级', '已停止'];
const TONE = { '运行中': 'ok', '降级': 'warn', '已停止': 'bad' };
const CATS = ['网关', '存储', '计算', '数据'];
const BASE = ['gateway', 'accounts', 'billing', 'archive', 'search', 'cdn', 'queue', 'cache', 'auth', 'audit', 'notify', 'backup'];
const OWNERS = ['沈墨', '顾远', '林晚晴', '苏叶', '陆之昂', '韩清'];

const pill = (text) => {
  const s = document.createElement('span');
  s.className = 'pill ' + TONE[text];
  s.textContent = text;
  return s;
};
const ownerNode = (name) => {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:8px';
  const av = document.createElement('span');
  av.className = 'avatar avatar--sm';
  av.textContent = name[0];
  const t = document.createElement('span');
  t.textContent = name;
  wrap.append(av, t);
  return wrap;
};
const opsNode = (row) => {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;gap:6px';
  const view = document.createElement('button');
  view.className = 'btn btn-sm';
  view.textContent = '查看';
  view.addEventListener('click', (ev) => { ev.stopPropagation(); toast.ok('查看 ' + row.name); });
  const restart = document.createElement('button');
  restart.className = 'btn btn-sm';
  restart.textContent = '重启';
  restart.addEventListener('click', (ev) => { ev.stopPropagation(); toast.warn('已下发重启：' + row.name); });
  wrap.append(view, restart);
  return wrap;
};

const rows = Array.from({ length: 247 }, (_, i) => ({
  id: 'svc-' + (i + 1),
  name: BASE[i % BASE.length] + '-' + String(i + 1).padStart(3, '0'),
  status: STATUSES[i % 9 === 8 ? 2 : i % 5 === 4 ? 1 : 0],
  cat: CATS[i % CATS.length],
  owner: OWNERS[i % OWNERS.length],
  version: 'v' + (1 + (i % 4)) + '.' + (i % 10),
  updated: '2026-07-' + String(1 + (i % 28)).padStart(2, '0'),
}));

const mainEl = document.getElementById('dt-main');
if (mainEl) {
  createTable(mainEl, {
    columns: [
      { key: 'name', title: '名称', sortable: true, width: '150px', frozen: true },
      { key: 'status', title: '状态', filterable: true, width: '90px', render: (v) => pill(String(v)) },
      { key: 'owner', title: '负责人', width: '116px', render: (v) => ownerNode(String(v)) },
      { key: 'cat', title: '分类', filterable: true, width: '80px' },
      { key: 'version', title: '版本', width: '70px' },
      { key: 'updated', title: '更新时间', sortable: true, width: '106px' },
      { key: 'ops', title: '操作', width: '122px', render: (_v, row) => opsNode(row) },
    ],
    data: rows,
    rowKey: 'id',
    searchable: true,
    searchPlaceholder: '搜索名称 / 负责人…',
    selectable: true,
    pagination: true,
    pageSize: 10,
    striped: true,
    resizable: true,
    columnVisibility: true,
    exportable: true,
    expandable: (row) =>
      row.name + ' · ' + row.cat + ' · ' + row.owner + ' 维护。最近发布 ' + row.version +
      '（' + row.updated + '），当前状态「' + row.status + '」。这里是行展开区域，可以嵌套任意 Node。',
    contextMenu: (row) => [
      { type: 'header', label: row.name, description: row.cat + ' · ' + row.owner },
      { label: '重命名', shortcut: 'F2', onClick: () => toast.ok('重命名 ' + row.name) },
      { label: '复制链接', onClick: () => toast.ok('已复制链接') },
      { type: 'separator' },
      { label: '停止服务', danger: true, shortcut: '⌫', onClick: () => toast.warn('已停止 ' + row.name) },
    ],
    onRowClick: (row) => toast.ok('行点击：' + row.name),
  });
}

const compactEl = document.getElementById('dt-compact');
if (compactEl) {
  createTable(compactEl, {
    columns: [
      { key: 'name', title: '实例', sortable: true, width: '180px' },
      { key: 'status', title: '状态', filterable: true, width: '80px', render: (v) => pill(String(v)) },
      { key: 'version', title: '版本', width: '60px' },
      { key: 'updated', title: '更新', sortable: true, width: '90px' },
    ],
    data: rows.slice(0, 80),
    rowKey: 'id',
    density: 'compact',
    searchable: true,
    pagination: true,
    pageSize: 15,
    rowClassName: (row) => row.status === '已停止' ? 'dt-row--danger' : '',
  });
}

const bigEl = document.getElementById('dt-virtual');
if (bigEl) {
  const big = Array.from({ length: 10000 }, (_, i) => ({
    id: 'log-' + (i + 1),
    name: BASE[i % BASE.length] + '-' + String(i + 1).padStart(5, '0'),
    metric: Math.round(Math.abs(Math.sin(i * 0.37)) * 1000),
    status: STATUSES[i % 7 === 6 ? 1 : 0],
  }));
  createTable(bigEl, {
    columns: [
      { key: 'name', title: '实例', sortable: true, width: '220px' },
      { key: 'metric', title: '请求量', sortable: true, width: '120px', align: 'right' },
      { key: 'status', title: '状态', filterable: true, render: (v) => pill(String(v)) },
    ],
    data: big,
    rowKey: 'id',
    searchable: true,
    virtual: true,
    height: '360px',
    striped: true,
  });
}`,
  },
);

/* ══════════ 导航 ══════════ */
COMPONENTS.push(
  {
    slug: 'nav',
    name: '顶栏',
    group: '导航',
    desc: '三段式玻璃顶栏（左 / 中 / 右）+ pill 导航钮；data-scroll-reactive 时滚动超过 12px 切 .is-scrolled。',
    demo: `<nav class="nav nav--sticky" data-scroll-reactive>
  <div class="nav-left">
    <span class="demo-logo">◆ ICEN</span>
  </div>
  <div class="nav-center">
    <button class="nav-btn motion pressable focus-ring is-active">概览</button>
    <button class="nav-btn motion pressable focus-ring">文档</button>
    <button class="nav-btn motion pressable focus-ring">社区</button>
  </div>
  <div class="nav-right">
    <button class="nav-btn nav-btn--icon motion pressable focus-ring" aria-label="搜索">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    </button>
    <span class="nav-divider"></span>
    <button class="nav-btn motion pressable focus-ring">登录</button>
  </div>
</nav>`,
    usage: `import { initNav } from '@icen.ai/ui/behaviors/nav';
initNav(); // scrollY > 12 时给 .nav[data-scroll-reactive] 加 .is-scrolled`,
    behaviors: ['nav'],
    behaviorInit: { nav: 'initNav' },
  },
  {
    slug: 'sidebar',
    name: '侧栏',
    group: '导航',
    desc: '分组可折叠（grid 0fr↔1fr 动画，chevron 随开合旋转），条目支持图标与 .is-active。',
    demo: `<aside class="sidebar">
  <div class="sidebar-group is-open">
    <button class="sidebar-group-title" aria-expanded="true">快速开始</button>
    <div class="sidebar-group-panel"><div class="sidebar-group-panel-inner">
      <a class="sidebar-item" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"/><path d="m16 19 2 2 4-4"/></svg>
        <span>安装</span>
      </a>
      <a class="sidebar-item is-active" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
        <span>快速上手</span>
      </a>
    </div></div>
  </div>
  <div class="sidebar-group">
    <button class="sidebar-group-title" aria-expanded="false">进阶指南</button>
    <div class="sidebar-group-panel"><div class="sidebar-group-panel-inner">
      <a class="sidebar-item" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
        <span>更新日志</span>
      </a>
    </div></div>
  </div>
</aside>`,
    usage: `import { initSidebar } from '@icen.ai/ui/behaviors/sidebar';
initSidebar(); // 点击 .sidebar-group-title 切父 group 的 .is-open + aria-expanded`,
    behaviors: ['sidebar'],
    behaviorInit: { sidebar: 'initSidebar' },
  },
  {
    slug: 'breadcrumb',
    name: '面包屑',
    group: '导航',
    desc: '分隔符由 .breadcrumb-sep 的 ::after（›）提供；当前页挂 aria-current="page"。',
    demo: `<nav class="breadcrumb" aria-label="面包屑">
  <ol>
    <li><a class="breadcrumb-link" href="/">首页</a><span class="breadcrumb-sep" aria-hidden="true"></span></li>
    <li><a class="breadcrumb-link" href="/components/">组件库</a><span class="breadcrumb-sep" aria-hidden="true"></span></li>
    <li><a class="breadcrumb-link" href="/components/breadcrumb/">导航组件</a><span class="breadcrumb-sep" aria-hidden="true"></span></li>
    <li><span class="breadcrumb-current" aria-current="page">面包屑</span></li>
  </ol>
</nav>`,
    usage: `<nav class="breadcrumb" aria-label="面包屑">
  <ol>
    <li><a class="breadcrumb-link" href="/">首页</a><span class="breadcrumb-sep" aria-hidden="true"></span></li>
    <li><span class="breadcrumb-current" aria-current="page">当前页</span></li>
  </ol>
</nav>`,
  },
  {
    slug: 'pagination',
    name: '分页',
    group: '导航',
    desc: '纯样式契约（翻页逻辑归消费方）：1 … 4 [5] 6 … 12 静态演示，含禁用态与省略号。',
    demo: `<nav class="pagination" aria-label="分页">
  <button class="page-btn motion is-disabled" aria-label="上一页">‹</button>
  <button class="page-btn motion">1</button>
  <span class="page-ellipsis">…</span>
  <button class="page-btn motion">4</button>
  <button class="page-btn motion is-active" aria-current="page">5</button>
  <button class="page-btn motion">6</button>
  <span class="page-ellipsis">…</span>
  <button class="page-btn motion">12</button>
  <button class="page-btn motion" aria-label="下一页">›</button>
</nav>`,
    usage: `<nav class="pagination" aria-label="分页">
  <button class="page-btn motion is-disabled" aria-label="上一页">‹</button>
  <button class="page-btn motion is-active" aria-current="page">1</button>
  <button class="page-btn motion" aria-label="下一页">›</button>
</nav>`,

    behaviors: ['controls'],
    behaviorInit: { controls: 'initPagination' },
  },
  {
    slug: 'steps',
    name: '步骤条',
    group: '导航',
    desc: '三态 finish / process / wait，连接线颜色跟随已完成步骤；横向与垂直共用同一 DOM，仅容器加 .steps--vertical。',
    demo: `<ol class="steps">
  <li class="step step--finish">
    <span class="step-line"></span>
    <span class="step-dot">✓</span>
    <div class="step-body">
      <div class="step-title">注册账号</div>
      <div class="step-desc">邮箱验证通过</div>
    </div>
  </li>
  <li class="step step--finish">
    <span class="step-line"></span>
    <span class="step-dot">✓</span>
    <div class="step-body">
      <div class="step-title">实名认证</div>
      <div class="step-desc">审核已完成</div>
    </div>
  </li>
  <li class="step step--process">
    <span class="step-line"></span>
    <span class="step-dot">3</span>
    <div class="step-body">
      <div class="step-title">填写资料</div>
      <div class="step-desc">正在进行</div>
    </div>
  </li>
  <li class="step step--wait">
    <span class="step-line"></span>
    <span class="step-dot">4</span>
    <div class="step-body">
      <div class="step-title">完成</div>
      <div class="step-desc">等待前序步骤</div>
    </div>
  </li>
</ol>
<ol class="steps steps--vertical" style="margin-top:20px">
  <li class="step step--finish">
    <span class="step-line"></span>
    <span class="step-dot">✓</span>
    <div class="step-body">
      <div class="step-title">创建项目</div>
      <div class="step-desc">仓库初始化完成</div>
    </div>
  </li>
  <li class="step step--process">
    <span class="step-line"></span>
    <span class="step-dot">2</span>
    <div class="step-body">
      <div class="step-title">配置流水线</div>
      <div class="step-desc">正在编辑 .cnb.yml</div>
    </div>
  </li>
  <li class="step step--wait">
    <span class="step-line"></span>
    <span class="step-dot">3</span>
    <div class="step-body">
      <div class="step-title">部署上线</div>
      <div class="step-desc">等待触发</div>
    </div>
  </li>
</ol>`,
    usage: `<ol class="steps">
  <li class="step step--finish">
    <span class="step-line"></span>
    <span class="step-dot">✓</span>
    <div class="step-body">
      <div class="step-title">已完成</div>
      <div class="step-desc">描述</div>
    </div>
  </li>
  <li class="step step--process">…</li>
  <li class="step step--wait">…</li>
</ol>`,

    behaviors: ['controls'],
    behaviorInit: { controls: 'initSteps' },
  },
  {
    slug: 'back-top',
    name: '回到顶部',
    group: '导航',
    desc: '与 behaviors/back-top 配套：滚动超过阈值（默认 320px）出现的悬浮按钮，点击平滑滚回顶部。支持手写按钮或 autoCreate 全自动。',
    demo: `<div class="demo-row">
  <button class="btn" id="back-top-demo">向下滚动本页测试 →</button>
</div>
<p class="dim" style="margin:8px 0 0;font-size:12px">点击按钮平滑滚到页面底部，右下角会浮出回到顶部按钮（autoCreate 模式）。</p>`,
    usage: `import { initBackTop } from '@icen.ai/ui/behaviors/back-top';

// 全自动：portal 一个默认按钮到 body，滚到顶
initBackTop({ autoCreate: true });

// 或手写：
// <button class="back-top" data-back-top type="button" aria-label="回到顶部">…svg…</button>
// initBackTop();
// 可选 data-* 或 opts：threshold（默认 320）/ target（滚动容器）/ offset（滚到多少 px）`,
    behaviors: ['back-top'],
    script: `const initBackTop = backTopMod.initBackTop;
initBackTop({ autoCreate: true });
document.getElementById('back-top-demo')?.addEventListener('click', () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});`,
  },
  {
    slug: 'layout',
    name: '布局工具',
    group: '导航',
    desc: 'stack / divider / surface / text / grid / center / container / aspect / visually-hidden 全部工具类，无 JS。',
    demo: `<h3 class="demo-sub">stack 间距与分布</h3>
<div class="stack stack--gap-4">
  <p class="demo-label">stack--gap-1（4px）</p>
  <div class="stack stack--row stack--gap-1">
    <span class="demo-box">甲</span><span class="demo-box">乙</span><span class="demo-box">丙</span>
  </div>
  <p class="demo-label">stack--gap-4（16px）</p>
  <div class="stack stack--row stack--gap-4">
    <span class="demo-box">甲</span><span class="demo-box">乙</span><span class="demo-box">丙</span>
  </div>
  <p class="demo-label">stack--gap-8（32px）</p>
  <div class="stack stack--row stack--gap-8">
    <span class="demo-box">甲</span><span class="demo-box">乙</span><span class="demo-box">丙</span>
  </div>
  <p class="demo-label">stack--justify-between</p>
  <div class="stack stack--row stack--justify-between">
    <span class="demo-box">左</span><span class="demo-box">右</span>
  </div>
</div>
<h3 class="demo-sub">surface 三变体</h3>
<div class="grid grid--cols-3 grid--gap-16">
  <div class="surface">默认 · inset 阴影</div>
  <div class="surface surface--elevated">elevated · 卡片阴影</div>
  <div class="surface surface--overlay">overlay · 强底浮层</div>
</div>
<div class="surface surface--p-lg" style="margin-top:12px">surface--p-lg · padding 20px</div>
<h3 class="demo-sub">text 字号 / 色档 / 截断</h3>
<div class="stack stack--gap-2">
  <span class="text--xs">xs 11px · 辅助说明文字</span>
  <span class="text--sm">sm 12px · 辅助说明文字</span>
  <span class="text--base">base 13px · 正文文字</span>
  <span class="text--md">md 14px · 正文文字</span>
  <span class="text--lg">lg 15px · 强调文字</span>
  <span class="text--xl">xl 18px · 小节标题</span>
  <span class="text--2xl">2xl 22px · 页面标题</span>
  <div class="stack stack--row stack--gap-3">
    <span class="text--muted">muted</span>
    <span class="text--faint">faint</span>
    <span class="text--accent">accent</span>
    <span class="text--success">success</span>
    <span class="text--warning">warning</span>
    <span class="text--error">error</span>
  </div>
  <div class="text--truncate" style="max-width:220px">truncate · 这是一段会被省略号截断的超长文本内容</div>
</div>
<h3 class="demo-sub">grid 三列</h3>
<div class="grid grid--cols-3 grid--gap-12">
  <div class="demo-box">列一</div>
  <div class="demo-box">列二</div>
  <div class="demo-box">列三</div>
  <div class="demo-box">列四</div>
  <div class="demo-box">列五</div>
  <div class="demo-box">列六</div>
</div>
<h3 class="demo-sub">divider / center / aspect / visually-hidden</h3>
<div class="stack stack--gap-4">
  <p class="demo-label">divider 水平 / 垂直</p>
  <div class="divider"></div>
  <div class="stack stack--row stack--items-stretch stack--gap-3" style="height:36px">
    <span class="demo-box">左</span>
    <div class="divider divider--vertical"></div>
    <span class="demo-box">右</span>
  </div>
  <p class="demo-label">center 居中盒</p>
  <div class="center surface" style="height:64px">居中内容</div>
  <p class="demo-label">aspect 16:9 比例盒</p>
  <div class="aspect" style="max-width:320px"><div class="demo-fill center">16 : 9</div></div>
  <p class="demo-label">visually-hidden（下句含一段只读给屏幕阅读器的文本）</p>
  <p class="text--sm">评分 4.5 星<span class="visually-hidden">，满分 5 星</span></p>
</div>`,
    usage: `<div class="stack stack--gap-4">纵向间距栈</div>
<div class="stack stack--row stack--justify-between">横向分布</div>
<div class="grid grid--cols-3 grid--gap-12">三列网格</div>
<div class="surface surface--elevated">浮起表面</div>
<span class="text--sm text--muted">辅助文字</span>
<div class="divider"></div>`,
  },

  /* ══════════ AI（AI 原生组件族，规格 docs/spec/ai-native.md）══════════ */
  {
    slug: 'ai-overview',
    name: 'AI 总览',
    group: 'AI 原生',
    desc: '一段可播放的完整对话《分析 AI 迭代历史》——把 AI 族全部能力按真实工作流串起来：思考（reasoning 流式+自动折叠）→ 规划（todo activeForm 推进）→ 网络搜索 / 接口调用（工具卡）→ 二次思考 → 正文流式 → render_chart 可视化（默认展开）→ 人工审批（点「允许」继续）→ history.md 差异审阅（accept/reject）→ 文件标签 → 子智能体（嵌套活动流）→ 失败重试（自动展开）→ 多模态回执（架构图）→ 收尾（token/成本、上下文抽屉、审计面板）。输入台 v2（模型切换/命令/@引用/上下文环）全程参与。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <button class="btn btn-sm btn-primary" type="button" id="ai-ov-play">▶ 播放全流程</button>
  <button class="btn btn-sm" type="button" id="ai-ov-reset">↺ 重置</button>
  <span class="toolbar-spacer"></span>
  <button class="btn btn-sm" type="button" data-ai-context-open="#ai-ov-ctx-host">上下文</button>
</div>
<p class="demo-label" id="ai-ov-stage" style="margin:0 0 10px">场景：分析 AI 迭代历史 · 全组件走一遍（约 30 秒，中途有一处需要你点「允许」）</p>
<div class="ai-chat" id="ai-ov-chat" style="height:520px;border:1px solid var(--token-line-soft);border-radius:var(--radius-md);padding:10px">
  <div class="ai-chat-scroll" id="ai-ov-scroll"></div>
</div>
<div class="ai-composer" data-ai-composer id="ai-ov-composer" style="margin-top:10px">
  <div class="ai-composer-queue" hidden></div>
  <div class="ai-composer-attach" hidden></div>
  <div class="ai-composer-box control">
    <textarea class="ai-composer-input" rows="1" placeholder="播放中回车会排队（icen:ai-queue）· / 命令 · @ 引用"></textarea>
    <div class="ai-composer-actions">
      <button class="ai-composer-btn" data-ai-attach type="button" aria-label="附件"></button>
      <button class="ai-composer-send" data-ai-send type="button" aria-label="发送"></button>
    </div>
  </div>
</div>
<div id="ai-ov-ctx-host"></div>
<div class="toolbar" style="margin-top:14px">
  <span class="toolbar-label">审计</span>
  <span class="toolbar-spacer"></span>
  <span class="toolbar-label" id="ai-ov-audit-meta">随流程累计</span>
</div>
<div id="ai-ov-audit" style="margin-top:8px"></div>`,
    usage: `<!-- 本页是「活文档」：全部子组件的独立文档见侧栏 AI 分组各页 -->`,
    behaviors: ['ai-chat', 'ai-composer', 'ai-tool', 'ai-diff', 'ai-panel', 'ai-core', 'ai-provider'],
    behaviorInit: { 'ai-chat': 'initAiChat', 'ai-composer': 'initAiComposer', 'ai-panel': 'initAiContext', 'ai-diff': 'initAiDiff' },
    script: `/* AI 总览：可播放的全组件工作流（分析 AI 迭代历史） */
const M = { chat: aiChatMod, comp: aiComposerMod, tool: aiToolMod, diff: aiDiffMod, panel: aiPanelMod, core: aiCoreMod, prov: aiProviderMod };
const scroll = document.getElementById('ai-ov-scroll');
const composer = document.getElementById('ai-ov-composer');
const stageEl = document.getElementById('ai-ov-stage');
const playBtn = document.getElementById('ai-ov-play');
const resetBtn = document.getElementById('ai-ov-reset');
const auditor = M.prov.createAiAuditor();
let cancelled = false; let timers = [];
const sleep = function (ms) { return new Promise(function (res) { timers.push(setTimeout(res, ms)); }); };
function stage(t) { if (stageEl) stageEl.textContent = t; }
function logAudit(p, m, ok, usage, ttft) {
  auditor.log({ id: 'ov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5), ts: Date.now(), provider: p, model: m, baseURL: '', stream: true, status: ok ? 'ok' : 'error', durationMs: 900 + Math.round(Math.random() * 2400), ttftMs: ttft, cost: M.prov.estimateCost(usage || {}, p, m), usage: usage, error: ok ? undefined : '网络请求失败：连接被对端重置（type=network）' });
}
function tCost() { const t = auditor.totals(); return t.cost > 0 ? t.cost : undefined; }
function refreshAudit() {
  const host = document.getElementById('ai-ov-audit');
  if (host) M.panel.renderAiAudit(host, auditor, { limit: 8, onClear: function () { auditor.clear(); refreshAudit(); } });
  const meta = document.getElementById('ai-ov-audit-meta');
  if (meta) { const t = auditor.totals(); meta.textContent = t.requests + ' 次请求 · ' + (t.cost > 0 ? '$' + t.cost.toFixed(4) : '—'); }
}
function user(text) { M.chat.renderAiMessage(scroll, { role: 'user', content: text, meta: '刚刚' }); }
function bodyStream(text, ms) {
  const msg = M.chat.renderAiMessage(scroll, { role: 'assistant', content: '', model: 'kimi-k3', streaming: true });
  const s = msg.stream();
  return new Promise(function (res) {
    let i = 0;
    const t = setInterval(function () {
      if (cancelled) { clearInterval(t); s.done(); res(); return; }
      const next = Math.min(text.length, i + 3 + Math.floor(Math.random() * 4));
      s.append(text.slice(i, next));
      i = next;
      if (i >= text.length) { clearInterval(t); s.done(); msg.setMeta('刚刚 · 1.8k tok'); res(); }
    }, Math.max(18, (ms || 1800) / (text.length / 5)));
    timers.push(t);
  });
}
function reasoning(text, ms) {
  const r = document.createElement('div'); r.className = 'ai-reasoning is-streaming';
  const head = document.createElement('button'); head.type = 'button'; head.className = 'ai-reasoning-head'; head.setAttribute('aria-expanded', 'true');
  const label = document.createElement('span'); label.className = 'ai-reasoning-label'; label.textContent = '思考过程';
  const time = document.createElement('span'); time.className = 'ai-reasoning-time';
  head.append(label, time);
  const bodyEl = document.createElement('div'); bodyEl.className = 'ai-reasoning-body';
  r.append(head, bodyEl); scroll.appendChild(r);
  const s = M.chat.createAiStream(bodyEl);
  return new Promise(function (res) {
    let i = 0;
    const t = setInterval(function () {
      if (cancelled) { clearInterval(t); s.cancel(); res(); return; }
      const next = Math.min(text.length, i + 5);
      s.append(text.slice(i, next));
      i = next;
      if (i >= text.length) { clearInterval(t); s.done(); res(); }
    }, Math.max(16, (ms || 1500) / (text.length / 5)));
    timers.push(t);
  });
}
let todoCard = null;
function todo(list) {
  /* 业界模式：待办是对话里的工具调用（折叠卡，摘要 x/y 完成），实时状态挂输入框 chip */
  const input = { items: list };
  const doneN = list.filter(function (t) { return t.status === 'done'; }).length;
  if (!todoCard) todoCard = card('TodoWrite', 'todo', { input: input });
  /* 每次工具调用即时结算：done 态 + 耗时，摘要行 x/y 与 chip/弹层三处同源 */
  todoCard.update({ input: input, status: 'done', durationMs: 120 + doneN * 60, output: doneN + '/' + list.length + ' 完成' });
  M.comp.setComposerTodo(composer, list);
}
function card(name, kind, model) {
  const holder = document.createElement('div');
  scroll.appendChild(holder);
  return M.tool.renderAiToolCall(holder, Object.assign({ id: 'ov-' + name + '-' + Date.now(), name: name, kind: kind, status: 'pending' }, model));
}
const U = function (n) { return { prompt_tokens: n, completion_tokens: Math.round(n / 8), prompt_tokens_details: { cached_tokens: Math.round(n * 0.6) } }; };

async function play() {
  if (!scroll) return;
  if (playBtn && playBtn.disabled) { stage('演示进行中 · 点 ↺ 重置后可重放'); return; }
  cancelled = false; if (playBtn) playBtn.disabled = true;
  M.comp.setComposerRunning(composer, true);
  stage('① 用户提问');
  user('分析我们产品这一年多的 AI 迭代历史，给我一份完整的演进报告');
  await sleep(500);

  stage('② 思考：拆解任务');
  await reasoning('用户要迭代历史的完整分析。先明确数据源：git log、发布记录、changelog。计划：搜索公开资料，调内部接口拿发布数据，提炼阶段叙事，做能力增长可视化，最后落一份 history.md。风险：数据口径要统一，按版本对齐。', 1600);
  logAudit('kimi', 'kimi-k3', true, M.core.normalizeUsage(U(14200)), 210);

  stage('③ 规划（TodoWrite 工具 + 输入框待办 chip）');
  todo([
    { content: '搜集公开迭代资料', status: 'running', activeForm: '正在搜索公开迭代资料' },
    { content: '拉取内部发布记录', status: 'pending' },
    { content: '提炼阶段叙事与数据', status: 'pending' },
    { content: '渲染能力增长可视化', status: 'pending' },
    { content: '写入 docs/history.md', status: 'pending' },
  ]);
  await sleep(900);

  stage('④ 网络搜索（工具卡）');
  const s1 = card('WebSearch', 'browser', { input: { query: 'icen ui AI 组件 迭代 发布' } });
  await sleep(700); s1.update({ status: 'running' });
  await sleep(1100); s1.update({ status: 'done', output: '命中 24 条 · 相关 6 条（v0.1 单一事实源 → v0.5 工程级 → v0.7 AI 族 → v0.8 工具体系）', durationMs: 1800 });

  stage('⑤ 接口调用（fetch 工具卡）');
  const s2 = card('ApiFetch', 'fetch', { input: { url: '/api/releases?product=ui' } });
  await sleep(600); s2.update({ status: 'running' });
  await sleep(1000); s2.update({ status: 'done', output: { ok: true, releases: 9, tags: ['v0.1.1', 'v0.2.0', 'v0.3.0', 'v0.4.0', 'v0.5.0', 'v0.6.0', 'v0.7.0', 'v0.7.1', 'v0.8.0'] }, durationMs: 1400 });
  logAudit('kimi', 'kimi-k3', true, M.core.normalizeUsage(U(18600)), 240);
  todo([
    { content: '搜集公开迭代资料', status: 'done' },
    { content: '拉取内部发布记录', status: 'done' },
    { content: '提炼阶段叙事与数据', status: 'running', activeForm: '正在提炼阶段叙事与数据' },
    { content: '渲染能力增长可视化', status: 'pending' },
    { content: '写入 docs/history.md', status: 'pending' },
  ]);
  await sleep(400);

  stage('⑥ 二次思考');
  await reasoning('数据齐了：9 个 tag、四个大阶段。叙事按设计系统、工程级、AI 原生、工具体系四幕展开；配一张各版本能力数折线。', 900);
  logAudit('kimi', 'kimi-k3', true, M.core.normalizeUsage(U(22400)), 180);

  stage('⑦ 正文流式（createAiStream）');
  await bodyStream('一年多的迭代可以概括为四幕：v0.1 确立「单一事实源」的设计系统底座；v0.5 把 51 个组件全部拉到工程级深度；v0.7 引入 AI 原生组件族（11 个 slug + 7 态状态机）；v0.8 收口为工具体系——图表通用层 + AI 挂载区。下面用数据说话：', 2000);
  /* 叙事成稿 = 提炼完成；待办 chip 与对话内 TodoWrite 卡三处同源推进 */
  todo([
    { content: '搜集公开迭代资料', status: 'done' },
    { content: '拉取内部发布记录', status: 'done' },
    { content: '提炼阶段叙事与数据', status: 'done' },
    { content: '渲染能力增长可视化', status: 'running', activeForm: '正在渲染能力增长可视化' },
    { content: '写入 docs/history.md', status: 'pending' },
  ]);

  stage('⑧ render_chart（默认展开）');
  const s3 = card('render_chart', 'chart', {
    input: { type: 'line', labels: ['v0.1', 'v0.2', 'v0.3', 'v0.4', 'v0.5', 'v0.6', 'v0.7', 'v0.8'] },
    output: { type: 'chart', spec: { type: 'line', title: '各版本能力数（多系列折线）', labels: ['v0.1', 'v0.2', 'v0.3', 'v0.4', 'v0.5', 'v0.6', 'v0.7', 'v0.8'], series: [{ name: '组件', values: [31, 41, 43, 47, 51, 55, 66, 67] }, { name: 'AI 专属', values: [0, 0, 0, 0, 0, 0, 11, 13] }, { name: '图表类型', values: [1, 5, 10, 10, 10, 10, 10, 12] }] } },
  });
  s3.update({ status: 'done', durationMs: 240 });
  await sleep(1200);
  /* 图表落成 = 渲染完成，写入开始（下一幕审批的对象） */
  todo([
    { content: '搜集公开迭代资料', status: 'done' },
    { content: '拉取内部发布记录', status: 'done' },
    { content: '提炼阶段叙事与数据', status: 'done' },
    { content: '渲染能力增长可视化', status: 'done' },
    { content: '写入 docs/history.md', status: 'running', activeForm: '正在写入 docs/history.md' },
  ]);

  stage('⑨ 待人审批（点「允许」继续，12 秒后自动允许）');
  const ap = card('Edit', 'edit', { input: { file_path: 'docs/history.md' }, status: 'approval', approval: { reason: '写入 docs/history.md（新增 1 文件，+46 行）' } });
  let wait = 12;
  const ok = await new Promise(function (res) {
    let cd = 0;
    const settle = function (v) { if (cd) clearInterval(cd); res(v); };
    ap.el.addEventListener('icen:ai-approve', function once() { ap.el.removeEventListener('icen:ai-approve', once); settle(true); });
    cd = setInterval(function () {
      wait--;
      if (wait > 0) stage('⑨ 待人审批（' + wait + ' 秒后自动允许，或点「允许」）');
      else settle(false);
    }, 1000);
    timers.push(cd);
  });
  ap.update({ status: 'done', output: '46 行已写入 docs/history.md', durationMs: 400 });
  stage(ok ? '⑩ 已批准' : '⑩ 超时自动批准（演示）');

  stage('⑩ history.md 差异审阅（accept/reject 可点）');
  const diffHost = document.createElement('div'); scroll.appendChild(diffHost);
  M.diff.renderAiDiff(diffHost, { files: M.diff.parseUnifiedDiff([
    'diff --git a/docs/history.md b/docs/history.md',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/docs/history.md',
    '@@ -0,0 +1,5 @@',
    '+# UI 迭代历史',
    '+',
    '+## 四幕',
    '+1. v0.1 设计系统单一事实源（31 组件 / 19 behaviors）',
    '+2. v0.5 工程级强化（51 组件 / 25 behaviors）',
  ].join('\\n')) });
  await sleep(1000);

  stage('⑪ 文件标签（ai-files）');
  const filesRow = document.createElement('div'); filesRow.className = 'ai-files'; filesRow.style.margin = '6px 0';
  [['docs/history.md', 'is-added'], ['docs/spec/ai-native.md', 'is-modified'], ['src/behaviors/ai-tools.ts', 'is-added']].forEach(function (f) {
    const chip = document.createElement('span'); chip.className = 'ai-file-chip ' + f[1];
    const ic = document.createElement('span'); ic.className = 'ai-file-icon';
    const sv = M.core.svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>');
    if (sv) ic.appendChild(sv);
    chip.append(ic, document.createTextNode(f[0]));
    filesRow.appendChild(chip);
  });
  scroll.appendChild(filesRow);
  await sleep(700);

  stage('⑫ 子智能体（嵌套活动流）');
  const saHost = document.createElement('div'); scroll.appendChild(saHost);
  const sa = M.tool.renderAiSubagent(saHost, { id: 'ov-sub', name: 'verify', kind: 'subagent', status: 'running', input: { task: '交叉核验版本号与日期' }, activities: [
    { id: 'a1', name: 'Read', kind: 'read', status: 'done', input: { file_path: 'CHANGELOG.md' }, output: '9 个版本条目', durationMs: 300 },
    { id: 'a2', name: 'Grep', kind: 'grep', status: 'running', input: { pattern: 'v0' } },
  ] });
  await sleep(1200);
  sa.update({ status: 'done', durationMs: 2400, output: '版本号与日期全部对上，无出入', activities: [
    { id: 'a1', name: 'Read', kind: 'read', status: 'done', input: { file_path: 'CHANGELOG.md' }, output: '9 个版本条目', durationMs: 300 },
    { id: 'a2', name: 'Grep', kind: 'grep', status: 'done', input: { pattern: 'v0' }, output: '37 处命中', durationMs: 900 },
  ] });
  await sleep(500);

  stage('⑬ 失败重试（自动展开，Copilot 模式）');
  const er = card('Shell', 'shell', { input: { command: 'git log --oneline' }, status: 'running' });
  await sleep(900);
  er.update({ status: 'error', errorText: '网络请求失败：连接被对端重置（type=network），已自动重试', durationMs: 1600 });
  logAudit('kimi', 'kimi-k3', false, undefined);
  await sleep(900);
  er.update({ status: 'done', output: '214 commits · 峰值在 v0.5 与 v0.8 两个窗口', durationMs: 900 });

  stage('⑭ 多模态回执（架构图 image 部件）');
  const arch = "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='120'><rect width='320' height='120' rx='8' fill='#f5f2ea' stroke='#c9c4b8'/><rect x='14' y='42' width='74' height='36' rx='6' fill='#d97757' opacity='0.85'/><rect x='100' y='42' width='74' height='36' rx='6' fill='#c9c4b8'/><rect x='186' y='42' width='74' height='36' rx='6' fill='#c9c4b8'/><rect x='272' y='42' width='34' height='36' rx='6' fill='#3d8a5a' opacity='0.8'/><line x1='88' y1='60' x2='100' y2='60' stroke='#8a857a'/><line x1='174' y1='60' x2='186' y2='60' stroke='#8a857a'/><line x1='260' y1='60' x2='272' y2='60' stroke='#8a857a'/><text x='51' y='64' font-size='10' text-anchor='middle' fill='#fff'>tokens</text><text x='137' y='64' font-size='10' text-anchor='middle' fill='#5a564d'>CSS</text><text x='223' y='64' font-size='10' text-anchor='middle' fill='#5a564d'>AI 族</text><text x='289' y='64' font-size='9' text-anchor='middle' fill='#fff'>工具</text><text x='160' y='24' font-size='11' text-anchor='middle' fill='#5a564d'>生态分层（v0.8）</text></svg>";
  M.chat.renderAiMessage(scroll, {
    role: 'assistant', model: 'kimi-k3',
    content: [
      { type: 'text', text: '最终架构分层如右（image 部件 + file 部件同屏）：' },
      { type: 'image', url: 'data:image/svg+xml;utf8,' + encodeURIComponent(arch), alt: '生态分层架构图' },
      { type: 'file', mimeType: 'application/pdf', filename: '迭代报告.pdf' },
    ],
    meta: '刚刚 · 1.1k tok',
  });
  await sleep(600);

  stage('⑮ 收尾');
  todo([
    { content: '搜集公开迭代资料', status: 'done' },
    { content: '拉取内部发布记录', status: 'done' },
    { content: '提炼阶段叙事与数据', status: 'done' },
    { content: '渲染能力增长可视化', status: 'done' },
    { content: '写入 docs/history.md', status: 'done' },
  ]);
  await bodyStream('报告完成：四幕叙事 + 能力曲线 + history.md 已落盘。上下文抽屉（右上「上下文」按钮）里有用量、文件、MCP、Skills 与本次全量审计。', 1200);
  logAudit('kimi', 'kimi-k3', true, M.core.normalizeUsage(U(26800)), 200);
  M.comp.setComposerRunning(composer, false);
  refreshAudit();
  const ctxHost = document.getElementById('ai-ov-ctx-host');
  if (ctxHost) M.panel.renderAiContext(ctxHost, {
    usage: M.core.normalizeUsage(U(26800)), usageTotal: 1000000, usageCost: tCost(),
    audit: auditor,
    files: [{ path: 'docs/history.md', status: 'added' }, { path: 'src/behaviors/ai-tools.ts', status: 'added' }, { path: 'docs/spec/ai-native.md', status: 'modified' }],
    mcpServers: [{ name: 'github', tools: 24 }, { name: 'filesystem', tools: 12 }, { name: 'browser', status: 'disconnected' }],
    skills: [{ name: 'release-skills', description: '发版流程' }, { name: 'icen-cn-doc', description: '中文文体' }],
  });
  stage('完成 · ' + auditor.list().length + ' 次请求 · ' + (tCost() ? '$' + tCost().toFixed(4) : '—') + ' · 点 ↺ 可重放');
  if (playBtn) playBtn.disabled = false;
}

function reset() {
  cancelled = true;
  timers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); timers = [];
  if (scroll) scroll.textContent = '';
  todoCard = null;
  M.comp.setComposerTodo(composer, null);
  M.comp.setComposerRunning(composer, false);
  stage('场景：分析 AI 迭代历史 · 全组件走一遍（约 30 秒；中途有一处审批，可点「允许」或等 12 秒自动允许）');
  if (playBtn) playBtn.disabled = false;
}

M.tool.initAiTool();
M.tool.initAiSubagent();
M.comp.setComposerModels(composer, M.prov.listAiProviders(), { provider: 'kimi', model: 'kimi-k3' });
M.comp.setComposerCommands(composer, [
  { name: 'report', description: '生成迭代报告', argsHint: '[产品]' },
  { name: 'compact', description: '压缩上下文' },
]);
M.comp.setComposerRefs(composer, [
  { kind: 'file', id: 'f1', label: 'CHANGELOG.md', sub: '4.2k tok' },
  { kind: 'folder', id: 'f2', label: 'docs/spec/', sub: '3 个规格' },
  { kind: 'agent', id: 'a1', label: 'verify', sub: '核验型子代理' },
]);
M.comp.setComposerUsage(composer, { input: 0 }, { total: 1000000 });
composer?.addEventListener('icen:ai-model-change', function (e) { stage('模型切换 → ' + e.detail.label); });
composer?.addEventListener('icen:ai-queue', function (e) { stage('已排队（运行中回车）：' + e.detail.text.slice(0, 24)); });
playBtn?.addEventListener('click', play);
resetBtn?.addEventListener('click', reset);
refreshAudit();`,
  },
  {
    slug: 'ai-chat',
    name: 'AI 会话',
    group: 'AI 原生',
    desc: 'AI 会话容器（AI 族门面条目）：滚动钉底跟随、上滚暂停跟随并浮出「回到底部 · N 条」浮动钮（缺失自动补建）；消息 copy / retry 操作委托（icen:ai-copy / icen:ai-retry）；reasoning 折叠委托。配套 createAiStream 流式追加（含 fail() 错误路径）与 renderAiMessage 消息渲染原语（多模态部件 + 错误变体）；data-density 三档控制信息密度。下方 demo 是零接线全链路：bindComposer 一行把 composer ↔ 消息区 ↔ createAiClient（mock provider SSE 流式）↔ 上下文环（contextEstimate 正确口径）接成闭环，排队消息自动续发，审计自动累计成本。',
    demo: `<div class="toolbar" style="margin-bottom:10px">
  <span class="toolbar-label">密度</span>
  <button class="btn btn-sm" type="button" data-ai-density="verbose">verbose</button>
  <button class="btn btn-sm btn-primary" type="button" data-ai-density="normal">normal</button>
  <button class="btn btn-sm" type="button" data-ai-density="summary">summary</button>
  <span class="toolbar-spacer"></span>
  <span class="toolbar-label">发消息试试</span>
</div>
<p class="demo-label" style="margin:0 0 10px">bindComposer 零接线：mock provider 流式回包 · 上下文环 = contextEstimate（下一轮估算）口径</p>
<div class="ai-chat" id="ai-chat-demo" data-density="normal" style="height:380px;border:1px solid var(--token-line-soft);border-radius:var(--radius-md);padding:10px">
  <div class="ai-chat-scroll">
    <div class="ai-msg ai-msg--user">
      <span class="ai-msg-avatar">我</span>
      <div style="min-width:0">
        <div class="ai-msg-body">帮我梳理这次发布前的检查清单，重点是构建验证和回滚路径。</div>
        <div class="ai-msg-meta">12:04 · 28 tok</div>
      </div>
    </div>
    <div class="ai-msg ai-msg--assistant">
      <span class="ai-msg-avatar">AI</span>
      <div style="min-width:0">
        <div class="ai-msg-body">好，先跑一下构建确认基线。</div>
      </div>
    </div>
    <div class="ai-reasoning is-done">
      <button class="ai-reasoning-head" type="button" aria-expanded="false">
        <span class="ai-reasoning-label">思考过程</span><span class="ai-reasoning-time">2.1s</span>
      </button>
      <div class="ai-reasoning-body" hidden>用户关注发布风险，清单需要覆盖：构建是否全绿、类型检查、关键页面冒烟、回滚路径。本次发布有 tag，回滚安全，可以先给结论。</div>
    </div>
    <div class="ai-tool ai-tool--shell is-done" data-ai-id="demo-chat-shell" data-ai-kind="shell">
      <button class="ai-tool-head" type="button" aria-expanded="false">
        <span class="ai-item-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg></span>
        <span class="ai-item-main">
          <span class="ai-item-title">Shell</span>
          <span class="ai-item-sub">bun run build</span>
        </span>
        <span class="ai-item-status" role="img" aria-label="完成"></span>
        <span class="ai-item-meta">3.2s</span>
      </button>
      <div class="ai-tool-body" hidden>
        <div class="ai-tool-io"><div class="ai-tool-io-label">输入</div><pre class="ai-tool-io-content">bun run build</pre></div>
        <div class="ai-tool-io"><div class="ai-tool-io-label">输出</div><pre class="ai-tool-io-content">tsup ✓ · build-css: 55 components + 75 kit 入口 → dist/</pre></div>
      </div>
    </div>
  </div>
</div>
<div class="ai-composer" data-ai-composer id="ai-chat-composer" style="margin-top:10px">
  <div class="ai-composer-queue" hidden></div>
  <div class="ai-composer-attach" hidden></div>
  <div class="ai-composer-box control">
    <textarea class="ai-composer-input" rows="1" placeholder="输入消息，/ 命令 · @ 引用 · Enter 发送 · 运行中回车排队"></textarea>
    <div class="ai-composer-actions">
      <button class="ai-composer-btn" data-ai-attach type="button" aria-label="附件"></button>
      <button class="ai-composer-send" data-ai-send type="button" aria-label="发送"></button>
    </div>
  </div>
</div>`,
    usage: `import { initAiChat, createAiStream, renderAiMessage } from '@icen.ai/ui/kit/ai-chat';
initAiChat();   // 钉底跟随 / 上滚暂停 / .ai-chat-jump 缺失自动补建 / copy·retry / reasoning 折叠

// 消息渲染原语（多模态部件 + 错误变体；spec §10 标准化内容）
const msg = renderAiMessage(scrollEl, {
  role: 'user',
  content: [
    { type: 'text', text: '这张图里有什么？' },
    { type: 'image', data: base64, mimeType: 'image/png' },
  ],
  meta: '12:04 · 1.2k tok',
});
msg.stream().append('…');   // 正文末开流式节点（textContent 级，不解析 HTML）
msg.setError('网络中断');    // → .ai-msg--error + 错误文本行

// 零接线全链路（composer ↔ 消息区 ↔ client ↔ 上下文环）：
import { bindComposer } from '@icen.ai/ui/kit/ai-composer';
const binding = bindComposer(composer, {
  client,                        // createAiClient(...)
  messages: scrollEl,            // renderAiMessage 挂载点
  usage: { from: 'context' },    // 环 = contextEstimate（正确口径）；'billing' | AiAuditor 亦可
});
// binding.unbind() 解绑`,
    behaviors: ['ai-chat', 'ai-tool', 'ai-composer', 'ai-provider'],
    behaviorInit: { 'ai-chat': 'initAiChat', 'ai-tool': 'initAiTool', 'ai-composer': 'initAiComposer' },
    script: `const chatEl = document.getElementById('ai-chat-demo');
const composer = document.getElementById('ai-chat-composer');
const scrollEl = chatEl ? chatEl.querySelector('.ai-chat-scroll') : null;

/* 模拟 provider：mock fetch 返回 OpenAI 族 SSE 流（离线演示全链路） */
const REPLIES = [
  '构建已验证通过（3.2s，55 组件 + 75 kit 入口）。发布检查清单：\\n1. 构建 · bun run build 全绿\\n2. 类型 · tsc --noEmit 零错误\\n3. 回滚 · revert tag 即可，本次无数据库变更',
  '收到，已计入会话上下文。注意右下角上下文环——口径是「下一轮上下文估算」（本轮输入+缓存+输出），不是累计计费；切模型时环的 total 会跟着所选模型的窗口走。',
];
let turn = 0;
function mockFetch() {
  const t = turn++;
  const text = REPLIES[t % REPLIES.length];
  const frames = [];
  for (let i = 0; i < text.length; i += 3) {
    frames.push('data: ' + JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 3) } }] }) + '\\n\\n');
  }
  frames.push('data: ' + JSON.stringify({ choices: [], usage: { prompt_tokens: 138000 + t * 42000, completion_tokens: 180 + t * 60, prompt_tokens_details: { cached_tokens: 96000 } } }) + '\\n\\n');
  frames.push('data: [DONE]\\n\\n');
  return Promise.resolve(new Response(new ReadableStream({
    start(c) {
      (function push() {
        const f = frames.shift();
        if (f == null) return c.close();
        c.enqueue(new TextEncoder().encode(f));
        setTimeout(push, 24);
      })();
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } }));
}

/* 客户端 + 审计器（cost 由注册表定价表自动算出，进 icen:ai-done → 环的成本位） */
const auditor = aiProviderMod.createAiAuditor();
const client = aiProviderMod.createAiClient({ provider: 'kimi', apiKey: 'demo-key', auditor: auditor, fetch: mockFetch });

/* 输入台 v2：模型切换（真实注册表）+ /命令 + @引用（上下文环 total 随模型窗口联动） */
aiComposerMod.setComposerModels(composer, aiProviderMod.listAiProviders(), { provider: 'kimi', model: 'kimi-k3' });
aiComposerMod.setComposerCommands(composer, [
  { name: 'plan', description: '进入计划模式', argsHint: '[任务]' },
  { name: 'clear', description: '清空上下文' },
  { name: 'compact', description: '压缩对话历史' },
]);
aiComposerMod.setComposerRefs(composer, [
  { kind: 'file', id: 'f1', label: 'src/app.ts', sub: '2.1k tok' },
  { kind: 'folder', id: 'f2', label: 'src/auth/', sub: '12 文件' },
  { kind: 'agent', id: 'a1', label: 'explore', sub: '搜索型子代理' },
]);

/* 零接线全链路：一行绑定（消息渲染 / 运行态 / 停止 / 排队续发 / 上下文环 / 错误路径全接管） */
if (composer && scrollEl) {
  aiComposerMod.bindComposer(composer, { client: client, messages: scrollEl, usage: { from: 'context' } });
}

/* 密度三档切换 */
document.querySelectorAll('[data-ai-density]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    chatEl?.setAttribute('data-density', btn.getAttribute('data-density') || 'normal');
    document.querySelectorAll('[data-ai-density]').forEach(function (b) {
      b.classList.toggle('btn-primary', b === btn);
    });
  });
});`,
  },
  {
    slug: 'ai-message',
    name: 'AI 消息',
    group: 'AI 原生',
    desc: '消息行基元 .ai-msg：user / assistant / system / tool 四角色（avatar 语义色）+ meta 时间 · token（summary 档隐藏）+ hover / focus-within 浮出 copy · retry 操作钮。renderAiMessage 渲染原语消费标准化内容（spec §10）：字符串或部件数组——文字 / 图片 / 音频 / 视频 / 文件 / 资源链接（MCP ResourceLink）任意组合，另支持错误变体（.ai-msg--error）与流式节点。操作委托由 initAiChat 提供（消息须挂在 .ai-chat 容器内）。',
    demo: `<div class="ai-chat" style="height:auto">
  <div class="ai-msg ai-msg--user" style="margin-bottom:10px">
    <span class="ai-msg-avatar">我</span>
    <div style="min-width:0">
      <div class="ai-msg-body">把这句话翻译成英文：「潮水褪去，才知道谁在裸泳。」</div>
      <div class="ai-msg-meta">12:04 · 21 tok</div>
    </div>
  </div>
  <div class="ai-msg ai-msg--assistant" style="margin-bottom:10px">
    <span class="ai-msg-avatar">AI</span>
    <div style="min-width:0">
      <div class="ai-msg-body">"Only when the tide goes out do you discover who's been swimming naked."</div>
      <div class="ai-msg-meta">12:04 · 34 tok</div>
    </div>
    <div class="ai-msg-actions">
      <button type="button" data-ai-msg-action="copy" aria-label="复制"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></button>
      <button type="button" data-ai-msg-action="retry" aria-label="重试"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
    </div>
  </div>
  <div class="ai-msg ai-msg--system" style="margin-bottom:10px">
    <span class="ai-msg-avatar">SYS</span>
    <div style="min-width:0">
      <div class="ai-msg-body">上下文已压缩：38k → 21k tokens</div>
      <div class="ai-msg-meta">12:06</div>
    </div>
  </div>
  <div class="ai-msg ai-msg--tool">
    <span class="ai-msg-avatar">TL</span>
    <div style="min-width:0">
      <div class="ai-msg-body">grep「formatDate」命中 6 处（src/utils/date.ts 等）</div>
      <div class="ai-msg-meta">12:06 · 0.4s</div>
    </div>
  </div>
</div>
<div class="toolbar" style="margin-top:10px">
  <button class="btn btn-sm btn-primary" type="button" id="ai-msg-add-mm">添加多模态消息</button>
  <button class="btn btn-sm" type="button" id="ai-msg-add-mcp">添加 MCP 回执消息</button>
  <button class="btn btn-sm" type="button" id="ai-msg-add-err">添加错误消息</button>
</div>
<div class="ai-chat" id="ai-msg-dyn" style="height:auto;margin-top:8px;border-top:1px dashed var(--token-line-soft);padding-top:8px">
  <div class="ai-chat-scroll"></div>
</div>
<p class="demo-label" id="ai-msg-log" style="margin-top:8px">悬停 assistant 消息看 copy / retry 操作钮；上方按钮演示 renderAiMessage 的部件渲染</p>`,
    usage: `import { renderAiMessage, initAiChat } from '@icen.ai/ui/kit/ai-message';
initAiChat();   // copy / retry / 折叠委托（消息须挂在 .ai-chat 容器内）

// 纯文本捷径
renderAiMessage(scrollEl, { role: 'user', content: '帮我看看这张图', meta: '12:04 · 21 tok' });

// 多模态部件（spec §10 标准化内容，同一套 parts 直达传输层）
renderAiMessage(scrollEl, {
  role: 'user',
  content: [
    { type: 'text', text: '这张图里有什么？' },
    { type: 'image', data: base64, mimeType: 'image/png', alt: '截图' },
    { type: 'file', url: fileUrl, mimeType: 'application/pdf', filename: 'report.pdf' },
  ],
});

// MCP 回执零改动进消息：normalizeMcpContent 把 tool result 的 content 数组归一成部件
import { normalizeMcpContent } from '@icen.ai/ui';
const parts = normalizeMcpContent(result.content);   // text / image / audio / resource_link / resource
renderAiMessage(scrollEl, { role: 'tool', content: parts, meta: '0.4s' });

// 错误路径：流失败 → fail()；渲染层 → setError
const msg = renderAiMessage(scrollEl, { role: 'assistant', content: '', model: 'kimi-k3' });
const s = msg.stream();
s.append('…');
s.fail();              // 正文节点挂 .is-error，追加终止
msg.setError('网络中断'); // 消息挂 .ai-msg--error + 错误文本行`,
    behaviors: ['ai-chat', 'ai-core'],
    behaviorInit: { 'ai-chat': 'initAiChat' },
    script: `const logEl = document.getElementById('ai-msg-log');
const logDefault = logEl ? logEl.textContent : '';
function flash(msg) {
  if (!logEl) return;
  logEl.textContent = msg;
  setTimeout(function () { logEl.textContent = logDefault; }, 1600);
}
document.querySelectorAll('.ai-msg').forEach(function (m) {
  m.addEventListener('icen:ai-copy', function () { flash('icen:ai-copy · 已复制该消息正文'); });
  m.addEventListener('icen:ai-retry', function () { flash('icen:ai-retry · 演示环境未真正重发'); });
});

/* renderAiMessage：多模态 / MCP 回执 / 错误三条路径 */
const dyn = document.querySelector('#ai-msg-dyn .ai-chat-scroll');
document.getElementById('ai-msg-add-mm')?.addEventListener('click', function () {
  if (!dyn) return;
  const bars = [42, 58, 50, 66, 61, 74, 70].map(function (h, i) {
    return "<rect x='" + (20 + i * 34) + "' y='" + (90 - h) + "' width='22' height='" + h + "' rx='3' fill='" + (i === 5 ? '#d97757' : '#c9c4b8') + "'/>";
  }).join('');
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='100'>" + bars + "<line x1='12' y1='92' x2='248' y2='92' stroke='#c9c4b8'/></svg>";
  aiChatMod.renderAiMessage(dyn, {
    role: 'assistant',
    content: [
      { type: 'text', text: '本周构建时长趋势（image 部件 + file 部件 + resource-link 部件同屏）：' },
      { type: 'image', url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), alt: '构建时长柱状图' },
      { type: 'file', mimeType: 'application/pdf', filename: 'build-report.pdf' },
      { type: 'resource-link', uri: 'mcp://fs/docs/发布手册.md', name: '发布手册' },
    ],
    model: 'kimi-k3',
    meta: '刚刚 · 1.1k tok',
  });
});
document.getElementById('ai-msg-add-mcp')?.addEventListener('click', function () {
  if (!dyn) return;
  /* MCP tool result 的 content 数组 → 部件（零改动进消息体） */
  const parts = aiCoreMod.normalizeMcpContent([
    { type: 'text', text: '搜索完成，命中 3 个文件；关联资源：' },
    { type: 'resource_link', uri: 'file:///src/auth/session.ts', name: 'src/auth/session.ts' },
    { type: 'resource_link', uri: 'file:///src/auth/oauth.ts', name: 'src/auth/oauth.ts' },
  ]);
  aiChatMod.renderAiMessage(dyn, { role: 'tool', content: parts, meta: '0.3s' });
});
document.getElementById('ai-msg-add-err')?.addEventListener('click', function () {
  if (!dyn) return;
  const msg = aiChatMod.renderAiMessage(dyn, { role: 'assistant', content: '构建检查进行到一半…', model: 'kimi-k3' });
  const stream = msg.stream();
  let n = 0;
  const timer = setInterval(function () {
    stream.append('构建中…');
    if (++n >= 3) {
      clearInterval(timer);
      stream.fail();
      msg.setError('网络请求失败：连接被对端重置（AiProviderError type=network）');
    }
  }, 220);
});`,
  },
  {
    slug: 'ai-reasoning',
    name: 'AI 推理',
    group: 'AI 原生',
    desc: '推理块 .ai-reasoning：流式中 head 显示 shimmer「正在思考…」（--ai-shimmer-duration 变量化时长）；createAiStream 的 done() 自动折叠并回填耗时；head 点击展开 / 折叠（initAiChat 委托）。summary 密度档默认折叠。',
    demo: `<div class="ai-chat" style="height:auto">
  <div class="ai-reasoning is-streaming" id="ai-reasoning-live">
    <button class="ai-reasoning-head" type="button" aria-expanded="true">
      <span class="ai-reasoning-label">思考过程</span><span class="ai-reasoning-time"></span>
    </button>
    <div class="ai-reasoning-body" id="ai-reasoning-stream"></div>
  </div>
  <div class="ai-reasoning is-done" style="margin-top:12px">
    <button class="ai-reasoning-head" type="button" aria-expanded="false">
      <span class="ai-reasoning-label">思考过程</span><span class="ai-reasoning-time">3.4s</span>
    </button>
    <div class="ai-reasoning-body" hidden>1. 目标函数是凸的，先证存在唯一极小值。2. 对约束求拉格朗日乘子，得到闭式解。3. 回代验证边界条件成立，结论可靠。</div>
  </div>
</div>
<p class="demo-label" style="margin-top:8px">上面一块流式结束后自动折叠并回填耗时；下面一块点击 head 展开 / 折叠</p>`,
    usage: `<div class="ai-reasoning is-done">
  <button class="ai-reasoning-head" aria-expanded="false">
    <span class="ai-reasoning-label">思考过程</span><span class="ai-reasoning-time">3s</span>
  </button>
  <div class="ai-reasoning-body" hidden>…</div>
</div>

<!-- 流式推理：宿主在 .ai-reasoning 内时 done() 自动折叠 + 回填耗时 -->
import { createAiStream, initAiChat } from '@icen.ai/ui/kit/ai-reasoning';
initAiChat();   // head 展开/折叠委托
const s = createAiStream(document.querySelector('.ai-reasoning-body'));
s.append('…');
s.done();   // 或 s.cancel()（取消不折叠、不计耗时）`,
    behaviors: ['ai-chat'],
    behaviorInit: { 'ai-chat': 'initAiChat' },
    script: `const target = document.getElementById('ai-reasoning-stream');
const THINK = '用户要的是发布检查清单。先确认构建状态——这是最容易翻车的一步，本次构建 3.2s 已通过。然后按风险排序：类型检查、冒烟、回滚路径。回滚依赖 tag，本次有 v0.6.1，安全。';
if (target) {
  const stream = aiChatMod.createAiStream(target);
  let pos = 0;
  const timer = setInterval(function () {
    const next = Math.min(THINK.length, pos + 3 + Math.floor(Math.random() * 4));
    stream.append(THINK.slice(pos, next));
    pos = next;
    if (pos >= THINK.length) {
      stream.done();
      clearInterval(timer);
    }
  }, 70);
}`,
  },
  {
    slug: 'ai-composer',
    name: 'AI 输入台',
    group: 'AI 原生',
    desc: 'AI 输入台：autosize（默认 8 行上限后内滚）、Enter 发送 / Shift+Enter 换行、IME 组合态安全、附件 chips（钮选 / 粘贴文件 / 拖放文件三入口共用 icen:ai-attach，拖放时输入框高亮）；setComposerRunning 切换运行态——发送钮变停止钮（icen:ai-stop），运行中回车转为排队 chip（icen:ai-queue / icen:ai-dequeue，可单个 × 移除）。事件 icen:ai-send {text} / icen:ai-attach {files}。bindComposer 绑定层可一行接通全链路（见 ai-chat 页 demo）。',
    demo: `<div class="ai-composer" data-ai-composer id="ai-composer-demo">
  <div class="ai-composer-queue" hidden></div>
  <div class="ai-composer-attach" hidden></div>
  <div class="ai-composer-box control">
    <textarea class="ai-composer-input" rows="1" placeholder="输入消息，/ 命令 · @ 引用 · Enter 发送"></textarea>
    <div class="ai-composer-actions">
      <button class="ai-composer-btn" data-ai-attach type="button" aria-label="附件"></button>
      <button class="ai-composer-send" data-ai-send type="button" aria-label="发送"></button>
    </div>
  </div>
</div>
<div class="toolbar" style="margin-top:10px">
  <button class="btn btn-sm btn-primary" type="button" id="ai-composer-run">模拟运行 / 解除</button>
  <span class="toolbar-label" id="ai-composer-log">模型切换 / /命令 / @引用 / 发送事件回显在这里</span>
</div>
<div id="ai-composer-out" style="margin-top:10px;display:flex;flex-direction:column;gap:6px"></div>`,
    usage: `import { initAiComposer, setComposerRunning, setComposerModels, setComposerCommands, setComposerRefs, setComposerUsage } from '@icen.ai/ui/kit/ai-composer';
initAiComposer();

<div class="ai-composer" data-ai-composer>
  <div class="ai-composer-queue" hidden></div>
  <div class="ai-composer-attach" hidden></div>
  <div class="ai-composer-box control">
    <textarea class="ai-composer-input" rows="1" placeholder="输入消息，/ 命令 · @ 引用 · Enter 发送"></textarea>
    <div class="ai-composer-actions">
      <button class="ai-composer-btn" data-ai-attach aria-label="附件"></button>
      <button class="ai-composer-send" data-ai-send aria-label="发送"></button>
    </div>
  </div>
</div>

// v2：模型切换（多源 × 多模型，弹层分组+搜索+缓存失效提示）
setComposerModels(el, providers, { provider: 'kimi', model: 'kimi-k3' });
// / 斜杠命令（拦截执行不进消息流，icen:ai-command {name, args}）
setComposerCommands(el, [{ name: 'plan', description: '进入计划模式', argsHint: '[任务]' }]);
// @ 引用（file/folder/doc/agent 分组，chip 分离渲染，icen:ai-ref）
setComposerRefs(el, [{ kind: 'file', id: 'f1', label: 'src/app.ts', sub: '2.1k tok' }]);
// 上下文环（模型 context 自动作 total；bindComposer 的 usage.from='context' 自动驱动）
setComposerUsage(el, usage, { cost: 0.3124 });

// 运行态：发送钮 → 停止钮（icen:ai-stop）；运行中回车排队（icen:ai-queue/dequeue）；
// 空输入 ↑ 取回历史；运行中 ↑ 取回排队消息重新编辑
// 附件三入口：钮选 / 在输入框粘贴文件 / 拖放文件到输入框（.is-dragover 高亮）

// 零接线全链路（推荐）：一行绑定 composer ↔ 消息区 ↔ client ↔ 上下文环
import { bindComposer } from '@icen.ai/ui/kit/ai-composer';
const binding = bindComposer(el, {
  client,                          // createAiClient(...)
  messages: scrollEl,              // renderAiMessage 挂载点
  usage: { from: 'context' },      // 环口径：'context'（正确口径）| 'billing' | auditor
});
// binding.unbind() 解绑`,
    behaviors: ['ai-composer', 'ai-provider'],
    behaviorInit: { 'ai-composer': 'initAiComposer' },
    script: `const composer = document.getElementById('ai-composer-demo');
const out = document.getElementById('ai-composer-out');
const logEl = document.getElementById('ai-composer-log');
function log(msg) { if (logEl) logEl.textContent = msg; }
/* v2 配置：模型切换（真实 provider 注册表）+ 斜杠命令 + @ 引用 + 上下文环 */
aiComposerMod.setComposerModels(composer, aiProviderMod.listAiProviders(), { provider: 'kimi', model: 'kimi-k3' });
aiComposerMod.setComposerCommands(composer, [
  { name: 'plan', description: '先出计划再执行', argsHint: '[任务]' },
  { name: 'clear', description: '清空上下文' },
  { name: 'compact', description: '压缩对话历史' },
  { name: 'review', description: '审查代码', argsHint: '[路径]' },
]);
aiComposerMod.setComposerRefs(composer, [
  { kind: 'file', id: 'f1', label: 'src/app.ts', sub: '2.1k tok' },
  { kind: 'file', id: 'f2', label: 'src/auth/index.ts', sub: '860 tok' },
  { kind: 'folder', id: 'f3', label: 'src/components/', sub: '55 文件' },
  { kind: 'doc', id: 'd1', label: '发布手册', sub: 'docs/' },
  { kind: 'agent', id: 'a1', label: 'explore', sub: '搜索型子代理' },
]);
aiComposerMod.setComposerUsage(composer, { input: 138000, output: 12000, cacheRead: 96000 }, { cost: 0.3124 });
function addMsg(text) {
  if (!out || !text) return;
  const row = document.createElement('div');
  row.className = 'ai-msg ai-msg--user';
  const avatar = document.createElement('span');
  avatar.className = 'ai-msg-avatar';
  avatar.textContent = '我';
  const wrap = document.createElement('div');
  const body = document.createElement('div');
  body.className = 'ai-msg-body';
  body.textContent = text;
  wrap.appendChild(body);
  row.append(avatar, wrap);
  out.appendChild(row);
}
composer?.addEventListener('icen:ai-send', function (e) {
  addMsg(e.detail.text);
  log('icen:ai-send · ' + e.detail.text);
});
composer?.addEventListener('icen:ai-model-change', function (e) {
  log('icen:ai-model-change · ' + e.detail.provider + ' / ' + e.detail.model + (e.detail.context ? '（' + Math.round(e.detail.context / 1000) + 'k 上下文）' : ''));
});
composer?.addEventListener('icen:ai-command', function (e) {
  log('icen:ai-command · /' + e.detail.name + (e.detail.args ? ' ' + e.detail.args : '') + '（已被拦截，未进消息流）');
});
composer?.addEventListener('icen:ai-ref', function (e) {
  log('icen:ai-ref · ' + (e.detail.action === 'add' ? '引用' : '移除') + ' ' + e.detail.ref.label);
});
composer?.addEventListener('icen:ai-queue', function (e) { log('icen:ai-queue · 已排队：' + e.detail.text); });
composer?.addEventListener('icen:ai-dequeue', function (e) { log('icen:ai-dequeue · 移除第 ' + (e.detail.index + 1) + ' 条排队消息'); });
composer?.addEventListener('icen:ai-stop', function () {
  aiComposerMod.setComposerRunning(composer, false);
  log('icen:ai-stop · 已停止（运行态解除）');
});
composer?.addEventListener('icen:ai-attach', function (e) { log('icen:ai-attach · ' + e.detail.files.length + ' 个文件'); });
document.getElementById('ai-composer-run')?.addEventListener('click', function () {
  const running = composer?.classList.contains('is-running') ?? false;
  aiComposerMod.setComposerRunning(composer, !running);
  log(!running ? '已进入运行态：发送钮变停止钮，此时回车进入排队，↑ 可取回' : '已解除运行态');
});`,
  },
  {
    slug: 'ai-tool-call',
    name: 'AI 工具调用',
    group: 'AI 原生',
    desc: '工具调用卡 .ai-tool：kind 修饰类（--shell/--read/--edit/--mcp/--rm…，kind 注册表驱动 --ai-item-tint 与图标）+ 7 态状态机（失败条目自动展开）+ 审批内联按钮（icen:ai-approve / icen:ai-reject，detail {id, kind}）。renderAiToolCall(el, model) 动态建卡，返回 { el, update(patch) } 做流式状态流转；输入/输出走注册表 summarize 或压缩 JSON。',
    demo: `<div style="display:flex;flex-direction:column;gap:8px;width:100%">
  <div class="ai-tool ai-tool--shell is-done" data-ai-id="demo-t1" data-ai-kind="shell">
    <button class="ai-tool-head" type="button" aria-expanded="false">
      <span class="ai-item-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg></span>
      <span class="ai-item-main"><span class="ai-item-title">Shell</span><span class="ai-item-sub">bun run build</span></span>
      <span class="ai-item-status" role="img" aria-label="完成"></span>
      <span class="ai-item-meta">3.2s</span>
    </button>
    <div class="ai-tool-body" hidden>
      <div class="ai-tool-io"><div class="ai-tool-io-label">输入</div><pre class="ai-tool-io-content">bun run build</pre></div>
      <div class="ai-tool-io"><div class="ai-tool-io-label">输出</div><pre class="ai-tool-io-content">tsup ✓ · build-css ✓（3.2s）</pre></div>
    </div>
  </div>
  <div class="ai-tool ai-tool--read is-done" data-ai-id="demo-t2" data-ai-kind="read">
    <button class="ai-tool-head" type="button" aria-expanded="false">
      <span class="ai-item-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>
      <span class="ai-item-main"><span class="ai-item-title">Read</span><span class="ai-item-sub">src/utils/date.ts:1-50</span></span>
      <span class="ai-item-status" role="img" aria-label="完成"></span>
      <span class="ai-item-meta">0.4s</span>
    </button>
    <div class="ai-tool-body" hidden>
      <div class="ai-tool-io"><div class="ai-tool-io-label">输入</div><pre class="ai-tool-io-content">{ "file": "src/utils/date.ts", "range": [1, 50] }</pre></div>
      <div class="ai-tool-io"><div class="ai-tool-io-label">输出</div><pre class="ai-tool-io-content">export function formatDate(…)</pre></div>
    </div>
  </div>
  <div class="ai-tool ai-tool--mcp is-running" data-ai-id="demo-t3" data-ai-kind="mcp">
    <button class="ai-tool-head" type="button" aria-expanded="false">
      <span class="ai-item-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/></svg></span>
      <span class="ai-item-main"><span class="ai-item-title">MCP</span><span class="ai-item-sub">github · create_issue</span></span>
      <span class="ai-item-status" role="img" aria-label="执行中"></span>
      <span class="ai-item-meta">2.8s</span>
    </button>
    <div class="ai-tool-body" hidden>
      <div class="ai-tool-io"><div class="ai-tool-io-label">输入</div><pre class="ai-tool-io-content">{ "repo": "icen/ui", "title": "ai-chat 上滚后 jump 钮计数不对" }</pre></div>
    </div>
  </div>
  <div class="ai-tool ai-tool--edit is-approval" data-ai-id="demo-t4" data-ai-kind="edit">
    <button class="ai-tool-head" type="button" aria-expanded="false">
      <span class="ai-item-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></span>
      <span class="ai-item-main"><span class="ai-item-title">Edit</span><span class="ai-item-sub">src/config.ts:12</span></span>
      <span class="ai-item-status" role="img" aria-label="待人确认"></span>
      <span class="ai-item-meta"></span>
    </button>
    <div class="ai-tool-body" hidden>
      <div class="ai-tool-io"><div class="ai-tool-io-label">输入</div><pre class="ai-tool-io-content">{ "file": "src/config.ts", "old": "timeout: 3000", "new": "timeout: 8000" }</pre></div>
      <div class="ai-tool-approval">
        <div class="ai-tool-approval-reason">修改运行配置需要人工确认：超时时间 3s → 8s</div>
        <button class="btn btn-sm btn-primary" data-ai-approve type="button">允许</button>
        <button class="btn btn-sm" data-ai-reject type="button">拒绝</button>
      </div>
    </div>
  </div>
  <div class="ai-tool ai-tool--rm is-error" data-ai-id="demo-t5" data-ai-kind="rm">
    <button class="ai-tool-head" type="button" aria-expanded="false">
      <span class="ai-item-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span>
      <span class="ai-item-main"><span class="ai-item-title">Rm</span><span class="ai-item-sub">dist/cache.json</span></span>
      <span class="ai-item-status" role="img" aria-label="失败"></span>
      <span class="ai-item-meta">0.1s</span>
    </button>
    <div class="ai-tool-body" hidden>
      <div class="ai-tool-io"><div class="ai-tool-io-label">输入</div><pre class="ai-tool-io-content">rm dist/cache.json</pre></div>
      <div class="ai-tool-io"><div class="ai-tool-io-label">输出</div><pre class="ai-tool-io-content">rm: dist/cache.json: No such file or directory</pre></div>
    </div>
  </div>
</div>
<div class="toolbar" style="margin-top:12px">
  <button class="btn btn-sm btn-primary" type="button" id="ai-tool-run">模拟执行（pending → running → done）</button>
  <span class="toolbar-label" id="ai-tool-log">rm 失败卡自动展开 · 审批卡展开后允许 / 拒绝</span>
</div>
<div id="ai-tool-live" style="margin-top:8px"></div>
<div class="toolbar" style="margin-top:14px">
  <span class="toolbar-label">AI 工具挂载区</span>
  <button class="btn btn-sm btn-primary" type="button" id="ai-tools-call">模拟 AI 调用 render_chart</button>
  <button class="btn btn-sm" type="button" id="ai-tools-chart-receipt">工具卡内嵌图</button>
  <span class="toolbar-spacer"></span>
  <button class="btn btn-sm" type="button" id="ai-tools-max">上限：2</button>
  <button class="btn btn-sm" type="button" id="ai-tools-clear">清空</button>
</div>
<p class="demo-label" style="margin:6px 0 10px">createAiToolArea：白名单 ['render_chart'] · max=2（超出 LRU 淘汰最旧）· 点模拟调用连发三种图看淘汰</p>
<div id="ai-tools-area"></div>
<div id="ai-tools-receipt" style="margin-top:12px"></div>
<p class="demo-label" id="ai-tools-log" style="margin-top:8px">工具体系事件日志</p>`, 
    usage: `import { initAiTool, renderAiToolCall } from '@icen.ai/ui/kit/ai-tool-call';
initAiTool();   // 展开/折叠 + 审批按钮委托（icen:ai-approve / icen:ai-reject，detail {id, kind}）

<!-- 静态卡：kind 修饰类 + 7 态；失败 is-error 首次渲染自动展开 -->
<div class="ai-tool ai-tool--edit is-approval" data-ai-id="t-1" data-ai-kind="edit">
  <button class="ai-tool-head" aria-expanded="false">…</button>
  <div class="ai-tool-body" hidden>
    <div class="ai-tool-approval">
      <button class="btn btn-sm btn-primary" data-ai-approve>允许</button>
      <button class="btn btn-sm" data-ai-reject>拒绝</button>
    </div>
  </div>
</div>

// 动态建卡（流式场景），update(patch) 做状态流转
const h = renderAiToolCall(el, {
  id: 't-2', name: 'Shell', kind: 'shell', status: 'pending',
  input: { cmd: 'bun run build' },   // 摘要行：注册表 summarize 或压缩 JSON
});
h.update({ status: 'running' });
h.update({ status: 'running' });
h.update({ status: 'done', output: '…', durationMs: 3200 });

// 工具回执内嵌图：output 为 {type:'chart',spec} 或裸 ChartSpec → 展开区直接渲染小图
h.update({ status: 'done', kind: 'chart', output: { type: 'chart', spec: { labels: ['Q1','Q2'], values: [4, 7] } } });

// ── AI 工具体系（ai-tools）：UI 能力注册为模型工具，宿主全控 ──
import { createAiToolArea, registerAiTool, aiToolsToOpenAI, aiToolsManifest } from '@icen.ai/ui';
const area = createAiToolArea(el, { tools: ['render_chart'], max: 4 });  // 白名单 + 上限（LRU）
area.call('render_chart', toolCallArgs);   // 模型 tool_call 的落地入口
registerAiTool({ name: 'highlight_row', description: '…', inputSchema: {/* OpenAI/MCP 兼容 */}, run: (input, mount) => {/*…*/} });
aiToolsToOpenAI();    // → chat.completions tools 参数
aiToolsManifest();    // → system prompt 能力清单`,
    behaviors: ['ai-tool', 'ai-tools', 'charts'],
    behaviorInit: { 'ai-tool': 'initAiTool' },
    script: `const host = document.getElementById('ai-tool-live');
const logEl = document.getElementById('ai-tool-log');
let handle = null;
const timers = [];
document.getElementById('ai-tool-run')?.addEventListener('click', function () {
  if (!host) return;
  while (timers.length) clearTimeout(timers.pop());
  const btn = document.getElementById('ai-tool-run');
  if (btn) btn.disabled = true;
  handle = aiToolMod.renderAiToolCall(host, {
    id: 'live-1', name: 'Shell', kind: 'shell', status: 'pending',
    input: { cmd: 'bun run test:ui' },
  });
  aiToolMod.initAiTool();   // 给动态建卡补挂展开委托（幂等）
  timers.push(setTimeout(function () { handle?.update({ status: 'running' }); }, 800));
  timers.push(setTimeout(function () {
    handle?.update({ status: 'done', output: '127 passed · 0 failed', durationMs: 8400 });
    if (btn) btn.disabled = false;
  }, 2800));
});
/* 审批事件回显 */
document.querySelectorAll('.ai-tool').forEach(function (card) {
  card.addEventListener('icen:ai-approve', function (e) {
    if (logEl) logEl.textContent = 'icen:ai-approve · id=' + e.detail.id + ' kind=' + e.detail.kind;
  });
  card.addEventListener('icen:ai-reject', function (e) {
    if (logEl) logEl.textContent = 'icen:ai-reject · id=' + e.detail.id + ' kind=' + e.detail.kind;
  });
});

/* ── 工具体系：挂载区（白名单 + LRU 上限）与工具卡内嵌图 ── */
const areaEl = document.getElementById('ai-tools-area');
const toolsLog = document.getElementById('ai-tools-log');
function tlog(msg) { if (toolsLog) toolsLog.textContent = msg; }
let area = null;
if (areaEl && aiToolsMod) {
  area = aiToolsMod.createAiToolArea(areaEl, { tools: ['render_chart'], max: 2 });
  areaEl.addEventListener('icen:ai-tool-evict', function (e) { tlog('icen:ai-tool-evict · LRU 淘汰 ' + e.detail.name); });
  areaEl.addEventListener('icen:ai-tool-result', function (e) { tlog('icen:ai-tool-result · ' + e.detail.name + (e.detail.ok ? ' ✓' : ' ✗')); });
}
const AI_SPECS = [
  { title: '模型延迟（自动选型：折线）', labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'], values: [120, 98, 145, 132, 160, 141], format: { notation: 'ms' } },
  { type: 'donut', title: '错误分布（环形）', segments: [{ label: '超时', value: 12 }, { label: '限流', value: 7 }, { label: '5xx', value: 3 }] },
  { type: 'scatter', title: '延迟 × 流量（散点）', points: Array.from({ length: 18 }, function (_, i) { return { x: Math.round((i * 37) % 90 + 10), y: Math.round((i * 53) % 140 + 20), size: 5 + (i % 4) * 8 }; }) },
];
let specTurn = 0;
document.getElementById('ai-tools-call')?.addEventListener('click', function () {
  if (!area) return;
  const rec = area.call('render_chart', AI_SPECS[specTurn++ % AI_SPECS.length]);
  if (!rec) tlog('调用被拒：工具不在白名单或未注册');
});
document.getElementById('ai-tools-clear')?.addEventListener('click', function () { area?.clear(); tlog('已清空挂载区'); });
const maxBtn = document.getElementById('ai-tools-max');
let maxVal = 2;
maxBtn?.addEventListener('click', function () {
  maxVal = maxVal === 2 ? 1 : 2;
  if (maxBtn) maxBtn.textContent = '上限：' + maxVal;
  area?.setMax(maxVal);
  tlog('setMax(' + maxVal + ') — 超限部分立即 LRU 淘汰');
});
document.getElementById('ai-tools-chart-receipt')?.addEventListener('click', function () {
  const host = document.getElementById('ai-tools-receipt');
  if (!host) return;
  host.textContent = '';
  aiToolMod.renderAiToolCall(host, {
    id: 'chart-1', name: 'render_chart', kind: 'chart', status: 'done',
    input: { type: 'bar', labels: ['Q1', 'Q2', 'Q3'], values: [4, 7, 6] },
    output: { type: 'chart', spec: { title: '季度调用量', labels: ['Q1', 'Q2', 'Q3'], series: [{ name: 'API', values: [420, 510, 620] }, { name: 'Web', values: [260, 300, 380] }] } },
    durationMs: 240,
  });
  aiToolMod.initAiTool();
});`,
  },
  {
    slug: 'ai-subagent',
    name: 'AI 子智能体',
    group: 'AI 原生',
    desc: '子智能体卡 .ai-subagent：activities（AiToolCallModel[]）递归渲染工具卡 / 推理块 / 再嵌套子代理（缩进 + 左侧引导线表达层级）；展开时活动项按 --ai-activity-index 逐条 icen-pop-in 渐入；底部完成回执区。renderAiSubagent(el, model) 返回 update(patch)；第三方 kind 走 ai-core 的 registerAiKind 扩展（demo 里注册了一个 deploy kind）。',
    demo: `<div style="display:flex;flex-direction:column;gap:12px;width:100%">
  <div id="ai-sub-live"></div>
  <div id="ai-sub-done"></div>
</div>
<p class="demo-label" style="margin-top:8px">上面：运行中，活动流实时更新 · 下面：已完成，点头展开看逐条渐入的嵌套活动（含一层子代理）</p>`,
    usage: `import { initAiSubagent, renderAiSubagent } from '@icen.ai/ui/kit/ai-subagent';
initAiSubagent();   // head 展开/折叠委托（嵌套卡各自独立监听）

// activities 是 AiToolCallModel[]，kind: 'subagent' 的项递归渲染子卡
const h = renderAiSubagent(el, {
  id: 'sa-1', name: 'explore', kind: 'subagent', status: 'running',
  input: { task: '搜索 auth 模块的所有入口' },
  activities: [
    { id: 'a1', name: 'Grep', kind: 'grep', status: 'done', input: { pattern: 'auth' }, output: '6 处命中', durationMs: 900 },
  ],
});
// 活动流按 id 增量 diff：已有的 update、新增的 append（渐入）、消失的移除
h.update({ status: 'done', durationMs: 12400, output: 'auth 模块共 3 个入口' });
// 第三方 kind：registerAiKind('deploy', { label, icon, tint, summarize })`,
    behaviors: ['ai-tool', 'ai-core'],
    behaviorInit: { 'ai-tool': 'initAiSubagent' },
    script: `/* 第三方 kind 扩展：注册表开放（ai-core） */
aiCoreMod.registerAiKind('deploy', {
  label: 'Deploy',
  tint: 'warning',
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  summarize: function (input) { return '部署到 ' + ((input && input.target) || '?'); },
});
/* 运行中的子代理：活动流随时间推进 */
const liveHost = document.getElementById('ai-sub-live');
let liveHandle = null;
if (liveHost) {
  liveHandle = aiToolMod.renderAiSubagent(liveHost, {
    id: 'sa-1', name: 'explore', kind: 'subagent', status: 'running',
    input: { task: '梳理 auth 模块的所有入口' },
    activities: [
      { id: 'a1', name: 'Grep', kind: 'grep', status: 'done', input: { pattern: 'auth', path: 'src' }, output: '6 处命中', durationMs: 900 },
      { id: 'a2', name: 'Read', kind: 'read', status: 'running', input: { file: 'src/auth/index.ts' } },
    ],
  });
  setTimeout(function () {
    liveHandle?.update({
      durationMs: 4200,
      activities: [
        { id: 'a1', name: 'Grep', kind: 'grep', status: 'done', input: { pattern: 'auth', path: 'src' }, output: '6 处命中', durationMs: 900 },
        { id: 'a2', name: 'Read', kind: 'read', status: 'done', input: { file: 'src/auth/index.ts' }, output: '导出 session / login / guard 三个入口', durationMs: 1600 },
        { id: 'a3', name: 'Grep', kind: 'grep', status: 'running', input: { pattern: 'middleware' } },
      ],
    });
  }, 2200);
  setTimeout(function () {
    liveHandle?.update({
      status: 'done',
      durationMs: 12400,
      output: 'auth 模块共 3 个入口：session / login / guard，均在 src/auth/ 下导出，可安全重构。',
      activities: [
        { id: 'a1', name: 'Grep', kind: 'grep', status: 'done', input: { pattern: 'auth', path: 'src' }, output: '6 处命中', durationMs: 900 },
        { id: 'a2', name: 'Read', kind: 'read', status: 'done', input: { file: 'src/auth/index.ts' }, output: '导出 session / login / guard 三个入口', durationMs: 1600 },
        { id: 'a3', name: 'Grep', kind: 'grep', status: 'done', input: { pattern: 'middleware' }, output: '注册点在 src/app.ts:44', durationMs: 1100 },
      ],
    });
  }, 4600);
}
/* 已完成的子代理：嵌套一层子代理 + 第三方 deploy kind */
const doneHost = document.getElementById('ai-sub-done');
if (doneHost) {
  aiToolMod.renderAiSubagent(doneHost, {
    id: 'sa-2', name: 'reviewer', kind: 'subagent', status: 'done', durationMs: 18300,
    input: { task: '审查发布清单 diff' },
    output: '3 个文件审查完毕：2 处建议修改，1 处 LGTM，回滚路径安全。',
    activities: [
      { id: 'b1', name: 'Read', kind: 'read', status: 'done', input: { file: 'src/release.ts' }, durationMs: 700 },
      { id: 'b2', name: 'Shell', kind: 'shell', status: 'done', input: { cmd: 'git diff --stat' }, output: '3 files changed, +48 −12', durationMs: 1200 },
      { id: 'b3', name: 'audit', kind: 'subagent', status: 'done', durationMs: 9600,
        input: { task: '检查回滚路径' },
        output: '回滚脚本存在且 tag v0.6.0 可用',
        activities: [
          { id: 'b3a', name: 'Read', kind: 'read', status: 'done', input: { file: 'scripts/rollback.sh' }, durationMs: 800 },
          { id: 'b3b', name: 'Shell', kind: 'shell', status: 'done', input: { cmd: 'git tag -l v0.6.*' }, output: 'v0.6.0  v0.6.1', durationMs: 600 },
        ] },
      { id: 'b4', name: 'deploy', kind: 'deploy', status: 'done', input: { target: 'staging' }, output: '✓ 已部署，健康检查通过', durationMs: 5200 },
    ],
  });
}
/* 动态建卡后补挂委托（幂等；静态场景由 initAiSubagent 统一处理） */
aiToolMod.initAiSubagent();
aiToolMod.initAiTool();`,
  },
  {
    slug: 'ai-diff',
    name: 'AI 差异审阅',
    group: 'AI 原生',
    desc: '差异审阅卡 .ai-diff：parseUnifiedDiff(text) 解析 unified diff（git / 传统头、add/del/rename/binary 均可）→ renderAiDiff(el, {files}) DOM 渲染（行号 + add/del 着色 + hunk 头，全 textContent）；initAiDiff 委托展开 / 接受 / 拒绝——icen:ai-diff-accept / icen:ai-diff-reject（detail {path}），决策后盖状态章并淡化。',
    demo: `<div id="ai-diff-demo" style="width:100%"></div>
<p class="demo-label" id="ai-diff-log" style="margin-top:8px">点头展开行号与着色 · 「接受 / 拒绝」后盖状态章（icen:ai-diff-accept / icen:ai-diff-reject）</p>`,
    usage: `import { initAiDiff, renderAiDiff, parseUnifiedDiff } from '@icen.ai/ui/kit/ai-diff';

// 真实 unified diff → 结构化 files → DOM 渲染（重复调用替换内容）
renderAiDiff(el, { files: parseUnifiedDiff(diffText) });
initAiDiff();   // 展开/折叠 + 接受/拒绝（icen:ai-diff-accept / icen:ai-diff-reject，detail {path}）

// AiDiffFile：{ path, oldPath?, status: added|modified|deleted|renamed, addCount, delCount, hunks }
// hunk：{ oldStart, oldCount, newStart, newCount, header, lines: [{ type: ctx|add|del, oldNo, newNo, text }] }`,
    behaviors: ['ai-diff'],
    script: `const diffText = [
  'diff --git a/src/utils/date.ts b/src/utils/date.ts',
  'index 3f2a1c9..8e7d4f2 100644',
  '--- a/src/utils/date.ts',
  '+++ b/src/utils/date.ts',
  '@@ -10,7 +10,9 @@ export function formatDate(input: string): string',
  '   const pad = (n: number) => String(n).padStart(2, "0");',
  '   return y + "-" + pad(m) + "-" + pad(d);',
  ' }',
  '-export const DATE_FMT = "YYYY-MM-DD";',
  '+export const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MMM D"] as const;',
  '+export type DateFormat = (typeof DATE_FORMATS)[number];',
  ' ',
  ' export function parseDate(input: string): Date | null {',
  '   const m = /^(\\\\d{4})-(\\\\d{2})-(\\\\d{2})$/.exec(input);',
  'diff --git a/src/utils/format.ts b/src/utils/format.ts',
  'new file mode 100644',
  'index 0000000..5b3e9a1',
  '--- /dev/null',
  '+++ b/src/utils/format.ts',
  '@@ -0,0 +1,4 @@',
  '+/** 千分位格式化 */',
  '+export function formatNumber(n: number): string {',
  '+  return n.toLocaleString("en-US");',
  '+}',
].join('\\n');
const host = document.getElementById('ai-diff-demo');
if (host) {
  aiDiffMod.renderAiDiff(host, { files: aiDiffMod.parseUnifiedDiff(diffText) });
  aiDiffMod.initAiDiff();   // 动态渲染后挂展开 / 接受 / 拒绝委托（幂等）
}
const logEl = document.getElementById('ai-diff-log');
const logDefault = logEl ? logEl.textContent : '';
host?.addEventListener('icen:ai-diff-accept', function (e) {
  if (!logEl) return;
  logEl.textContent = 'icen:ai-diff-accept · ' + e.detail.path;
  setTimeout(function () { logEl.textContent = logDefault; }, 2000);
});
host?.addEventListener('icen:ai-diff-reject', function (e) {
  if (!logEl) return;
  logEl.textContent = 'icen:ai-diff-reject · ' + e.detail.path;
  setTimeout(function () { logEl.textContent = logDefault; }, 2000);
});`,
  },
  {
    slug: 'ai-files',
    name: 'AI 文件标签',
    group: 'AI 原生',
    desc: '文件 chips .ai-file-chip（纯 CSS 族，无 behavior）：is-added / is-modified / is-deleted 三态 × 类型修饰类（--ts/--js/--css/--json/--md/--img/--other，图标由消费方注入 svg）；renderAiContext 的文件区复用同款 chips。',
    demo: `<div class="ai-files">
  <span class="ai-file-chip is-added ai-file-chip--ts"><span class="ai-file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg></span>src/utils/format.ts</span>
  <span class="ai-file-chip is-modified ai-file-chip--css"><span class="ai-file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/></svg></span>src/components/ai-chat.css</span>
  <span class="ai-file-chip is-modified ai-file-chip--json"><span class="ai-file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/></svg></span>package.json</span>
  <span class="ai-file-chip is-modified ai-file-chip--md"><span class="ai-file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg></span>README.md</span>
  <span class="ai-file-chip is-deleted ai-file-chip--js"><span class="ai-file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg></span>scripts/old-build.js</span>
  <span class="ai-file-chip is-added ai-file-chip--img"><span class="ai-file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg></span>assets/cover.png</span>
</div>
<p class="demo-label" style="margin-top:8px">纯 CSS 族：is-added（绿）/ is-modified（accent）/ is-deleted（红，删除线）× 文件类型图标 · renderAiContext 文件区同款</p>`,
    usage: `<!-- 纯 CSS 组件，无 behavior；文件图标由消费方注入 svg -->
<div class="ai-files">
  <span class="ai-file-chip is-added ai-file-chip--ts">
    <span class="ai-file-icon">…svg…</span>src/foo.ts
  </span>
</div>
<!-- 类型修饰类：--ts / --js / --css / --json / --md / --img / --other -->`,
  },
  {
    slug: 'ai-todo',
    name: 'AI 任务清单',
    group: 'AI 原生',
    desc: '任务清单 .ai-todo：进度条（feedback progress 视觉）+ N/M 计数 + 7 态条目；running 条目用 activeForm 替换文案（Claude Code 模式）。renderAiTodo(el, items) 渲染；data-ai-todo-interactive 容器可点击循环状态 pending → running → done（icen:ai-todo-toggle {index, status}），默认只读。',
    demo: `<div id="ai-todo-demo" data-ai-todo-interactive style="width:100%"></div>
<p class="demo-label" id="ai-todo-log" style="margin-top:8px">点击任意任务循环状态 pending → running → done（running 时文案切 activeForm）</p>`,
    usage: `import { renderAiTodo, initAiTodo } from '@icen.ai/ui/kit/ai-todo';

renderAiTodo(el, [
  { content: '搭建 tokens 合并构建', status: 'done' },
  { content: '联调接口', status: 'running', activeForm: '正在联调接口…' },  // Claude Code 模式运行文案
  { content: '写测试', status: 'pending' },
]);
initAiTodo();   // data-ai-todo-interactive 容器可点击循环状态（icen:ai-todo-toggle {index, status}）

<!-- 静态手写等价契约 -->
<div class="ai-todo" data-ai-todo-interactive>
  <div class="ai-todo-head"><span class="ai-todo-progress">2/5</span>
    <div class="ai-todo-bar" role="progressbar"><i style="width:40%"></i></div></div>
  <div class="ai-todo-item is-running">
    <span class="ai-item-status"></span>
    <span class="ai-todo-text">实现登录页</span>
    <span class="ai-todo-active">正在实现登录页…</span>
  </div>
</div>`,
    behaviors: ['ai-panel'],
    script: `const host = document.getElementById('ai-todo-demo');
const logEl = document.getElementById('ai-todo-log');
const logDefault = logEl ? logEl.textContent : '';
if (host) {
  aiPanelMod.renderAiTodo(host, [
    { content: '搭建 tokens 合并构建', status: 'done' },
    { content: '实现 ai-item 基元与 7 态状态机', status: 'done' },
    { content: '编写组件文档与交互 demo', status: 'running', activeForm: '正在编写组件文档与交互 demo…' },
    { content: '跑通 tsc 与文档站构建', status: 'pending' },
    { content: '发布 v0.7.0', status: 'pending' },
  ]);
  aiPanelMod.initAiTodo();   // 动态渲染后挂交互委托（幂等）
  host.addEventListener('icen:ai-todo-toggle', function (e) {
    if (!logEl) return;
    logEl.textContent = 'icen:ai-todo-toggle · 第 ' + (e.detail.index + 1) + ' 项 → ' + e.detail.status;
    setTimeout(function () { logEl.textContent = logDefault; }, 1800);
  });
}`,
  },
  {
    slug: 'ai-usage',
    name: 'AI 用量条',
    group: 'AI 原生',
    desc: '上下文用量 .ai-usage 双形态：分段条（renderAiUsage）+ 上下文窗口环形指示器（renderAiUsageRing，Claude Desktop 式常驻小环，点击弹出完整分解，弹层复用 popover）。分段条 = 分段条 + 图例 + 占比行；配色契约 input=accent / output=success / cacheRead=info / cacheWrite=warning / reasoning=faint。缓存分列计费诚实：cacheRead ≈ 0.1× 输入价、cacheWrite ≈ 1.25× 输入价（行业惯例，展示与算账口径一致）。配套 renderAiAudit 审计面板：totals（请求数/失败/累计 tokens/累计成本/平均 TTFT）+ byModel 分组 + 最近条目，与 createAiAuditor 的条目（含 cost 定价估算与 ttftMs）闭环。',
    demo: `<div style="display:flex;align-items:center;gap:12px;width:100%;margin-bottom:14px">
  <div id="ai-usage-ring-demo"></div>
  <span class="demo-label">上下文窗口环（Claude Desktop 式）：点击弹出完整分解</span>
</div>
<div id="ai-usage-demo" style="width:100%"></div>
<p class="demo-label" style="margin-top:8px">缓存读 ≈ 0.1× 输入价、缓存写 ≈ 1.25× 输入价——分列展示，计费口径诚实</p>
<div class="toolbar" style="margin-top:14px">
  <span class="toolbar-label">审计面板</span>
  <span class="toolbar-spacer"></span>
  <button class="btn btn-sm" type="button" id="ai-audit-seed">再跑两条</button>
</div>
<p class="demo-label" style="margin:6px 0 10px">renderAiAudit · 预置 8 条记录的 auditor（含错误与 TTFT）</p>
<div id="ai-audit-demo" style="width:100%"></div>`,
    usage: `import { renderAiUsage, renderAiUsageRing, renderAiAudit } from '@icen.ai/ui/kit/ai-usage';

// 分段条形态
renderAiUsage(el, {
  input: 42000, output: 18000, cacheRead: 96000, cacheWrite: 12000, reasoning: 8000,
}, { total: 200000, cost: 0.3124 });

// 上下文窗口环形指示器（点击弹出完整分解，复用 popover）
renderAiUsageRing(el, { input: 42000, /* … */ }, { total: 200000 });
// 状态档：<60% accent / 60–85% warning / >85% error + 脉冲

// 审计面板：totals + byModel + 最近条目（source 为 auditor 或条目数组，快照渲染）
import { createAiClient, createAiAuditor, estimateCost } from '@icen.ai/ui';
const auditor = createAiAuditor({ persist: 'my-audit', max: 100 });
const client = createAiClient({ provider: 'kimi', apiKey, auditor });
// …每次请求自动 log（含 cost 定价估算 + ttftMs 首 token 延迟）…
renderAiAudit(el, auditor, { limit: 10 });   // 清除钮派 icen:ai-audit-clear，或 opts.onClear

// 手动估一笔（注册表定价；未命中返回 undefined，不猜价）
const cost = estimateCost(usage, 'kimi', 'kimi-k3');`,
    behaviors: ['ai-panel', 'ai-provider', 'ai-core'],
    script: `const host = document.getElementById('ai-usage-demo');
if (host) {
  aiPanelMod.renderAiUsage(host, {
    input: 42000, output: 18000, cacheRead: 96000, cacheWrite: 12000, reasoning: 8000,
  }, { total: 200000, cost: 0.3124 });
}
const ringHost = document.getElementById('ai-usage-ring-demo');
if (ringHost) {
  aiPanelMod.renderAiUsageRing(ringHost, {
    input: 42000, output: 18000, cacheRead: 96000, cacheWrite: 12000, reasoning: 8000,
  }, { total: 200000, cost: 0.3124 });
}

/* 审计面板：预置混合记录（两家 provider、含一条错误与取消、含 TTFT） */
const auditor = aiProviderMod.createAiAuditor();
function seedAudit(n) {
  const models = [['kimi', 'kimi-k3'], ['claude', 'claude-sonnet-5-5'], ['deepseek', 'deepseek-v4-pro']];
  for (let i = 0; i < n; i++) {
    const t = Date.now() - (n - i) * 96000;
    const [p, m] = models[i % models.length];
    const err = i === 2;
    const u = err ? undefined : aiCoreMod.normalizeUsage({
      prompt_tokens: 38000 + i * 5200,
      completion_tokens: 900 + i * 210,
      prompt_tokens_details: { cached_tokens: 96000 + i * 8000 },
    });
    auditor.log({
      id: 'demo-' + t + '-' + i,
      ts: t,
      provider: p,
      model: m,
      baseURL: 'https://demo.local',
      stream: i % 3 !== 2,
      status: err ? 'error' : 'ok',
      durationMs: 900 + i * 340,
      ttftMs: i % 3 !== 2 ? 180 + i * 30 : undefined,
      cost: aiProviderMod.estimateCost(u ?? {}, p, m),
      usage: u,
      error: err ? '网络请求失败：浏览器直连被 CORS 拦截，建议经代理' : undefined,
    });
  }
}
const auditHost = document.getElementById('ai-audit-demo');
function renderAudit() {
  if (auditHost) aiPanelMod.renderAiAudit(auditHost, auditor, { limit: 8, onClear: function () { auditor.clear(); renderAudit(); } });
}
seedAudit(8);
renderAudit();
document.getElementById('ai-audit-seed')?.addEventListener('click', function () { seedAudit(2); renderAudit(); });`,
  },
  {
    slug: 'ai-context',
    name: 'AI 上下文面板',
    group: 'AI 原生',
    desc: '上下文抽屉 .ai-context：触发器 [data-ai-context-open] 全局委托开合（属性值可为 #id 选择器），fixed 右侧滑入（--z-chrome），Esc / 外点关闭、Tab 焦点圈禁；renderAiContext 组合渲染用量（renderAiUsage）+ 审计节（audit 传 auditor 或条目数组，紧凑形态）+ 文件 chips + MCP server 行（.ai-item：connected→is-done / disconnected→is-error）+ Skills 列表；.ai-context--inline 为页面流内嵌变体（不参与开合）。',
    demo: `<div class="toolbar">
  <button class="btn btn-sm btn-primary" type="button" data-ai-context-open>打开上下文面板</button>
  <span class="toolbar-spacer"></span>
  <span class="toolbar-label">Esc / 外点关闭</span>
</div>
<p class="demo-label" style="margin:6px 0 10px">Tab 焦点圈禁 · 滑入走 --z-chrome 标尺 · 含审计节</p>
<div id="ai-context-demo"></div>`,
    usage: `import { initAiContext, renderAiContext } from '@icen.ai/ui/kit/ai-context';

renderAiContext(document.getElementById('ctx'), {
  usage: { input: 42000, cacheRead: 96000, cacheWrite: 12000, output: 18000, reasoning: 8000 },
  usageTotal: 200000,          // 传给 renderAiUsage 的 opts.total
  usageCost: 0.3124,           // 追加 $ 成本行
  audit: auditor,              // auditor 实例或 AiAuditEntry[]：自动出现「审计」节（§12.2 紧凑形态）
  files: [{ path: 'src/foo.ts', status: 'modified' }],
  mcpServers: [{ name: 'github', tools: 24 }],          // connected（默认）→ is-done
  skills: [{ name: 'webbridge', description: '浏览器自动化' }],
});
initAiContext();   // 触发器 [data-ai-context-open] 全局委托；Esc / 外点关闭；焦点圈禁

<!-- 触发器（任意元素；属性值可为 #id 选择器定位指定抽屉） -->
<button data-ai-context-open>上下文</button>
<div id="ctx"></div>
<!-- .ai-context--inline 为页面流内嵌变体：不做 fixed、不参与开合 -->`,
    behaviors: ['ai-panel', 'ai-provider'],
    behaviorInit: { 'ai-panel': 'initAiContext' },
    script: `const host = document.getElementById('ai-context-demo');
const auditor = aiProviderMod.createAiAuditor();
auditor.log({ id: 'a1', ts: Date.now() - 320000, provider: 'kimi', model: 'kimi-k3', baseURL: '', stream: true, status: 'ok', durationMs: 2100, ttftMs: 220, cost: 0.1628, usage: { input: 38200, output: 1240, cacheRead: 96000, total: 135440 } });
auditor.log({ id: 'a2', ts: Date.now() - 96000, provider: 'claude', model: 'claude-sonnet-5-5', baseURL: '', stream: true, status: 'ok', durationMs: 3400, ttftMs: 410, cost: 0.2901, usage: { input: 41000, output: 2100, cacheRead: 88000, cacheWrite: 9000, total: 140100 } });
if (host) {
  aiPanelMod.renderAiContext(host, {
    usage: { input: 42000, output: 18000, cacheRead: 96000, cacheWrite: 12000, reasoning: 8000 },
    usageTotal: 200000,
    usageCost: 0.3124,
    audit: auditor,
    files: [
      { path: 'src/behaviors/ai-core.ts', status: 'modified' },
      { path: 'src/components/ai-chat.css', status: 'modified' },
      { path: 'docs/spec/ai-native.md', status: 'added' },
      { path: 'scripts/slugs.mjs', status: 'modified' },
    ],
    mcpServers: [
      { name: 'github', tools: 24, status: 'connected' },
      { name: 'filesystem', tools: 12, status: 'connected' },
      { name: 'browser', status: 'disconnected' },
    ],
    skills: [
      { name: 'kimi-webbridge', description: '浏览器自动化' },
      { name: 'update-config', description: '配置诊断与修改' },
      { name: 'write-goal', description: '目标合约编写' },
    ],
  });
}`,
  },
);
