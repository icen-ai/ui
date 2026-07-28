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
  behaviorInit?: Record<string, string>;
  script?: string;
}
/** 组件分组的展示名（顺序即侧栏顺序）。数据原拆为四组：展示 / 表格 / 图表 / 反馈。 */
export const GROUPS: string[] = ['基础', '表单', '浮层', '数据展示', '表格', '图表', '反馈', '导航'];

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
    desc: '基础按钮：默认 / primary / danger / sm 四种变体。',
    demo: `<div class="demo-row">
  <button class="btn">默认</button>
  <button class="btn btn-primary">主要</button>
  <button class="btn btn-danger">危险</button>
  <button class="btn btn-sm">小号</button>
</div>`,
    usage: `<button class="btn">默认</button>
<button class="btn btn-primary">主要</button>
<button class="btn btn-danger">危险</button>
<button class="btn btn-sm">小号</button>`,
  },
  {
    slug: 'panel',
    name: '面板',
    group: '基础',
    desc: '白卡片容器（panel-block）+ 标题栏（panel-title），用于承载一组相关内容。',
    demo: `<div class="panel-block">
  <div class="panel-title"><span>面板标题</span><span>PANEL</span></div>
  <div class="panel-body">
    白卡片容器 + 标题栏，用于承载一组相关内容。
  </div>
</div>`,
    usage: `<div class="panel-block">
  <div class="panel-title"><span>标题</span></div>
  <div class="panel-body">…内容…</div>
</div>`,
  },
  {
    slug: 'pill',
    name: '徽章',
    group: '基础',
    desc: '语义色状态徽章，纪律：仅绿 / 黄 / 红 + 品牌 accent。',
    demo: `<div class="demo-row">
  <span class="pill">默认</span>
  <span class="pill ok">正常</span>
  <span class="pill warn">警告</span>
  <span class="pill bad">异常</span>
  <span class="pill accent">强调</span>
</div>`,
    usage: `<span class="pill ok">运行中</span>
<span class="pill warn">降级</span>
<span class="pill bad">已停止</span>`,
  },
  {
    slug: 'tabs',
    name: '标签页',
    group: '基础',
    desc: '与 behaviors/tabs 配套的 data 契约分区导航——下面是可点击切换的 live demo。',
    demo: `<div data-tabs>
  <nav class="page-tabs">
    <button class="page-tab active" data-tab="overview">概览</button>
    <button class="page-tab" data-tab="usage">用法</button>
    <button class="page-tab" data-tab="api">契约</button>
  </nav>
  <section data-tab-panel="overview">
    <p>三分区可点击切换。激活态 = .active 类，未激活面板挂 hidden。</p>
  </section>
  <section data-tab-panel="usage" hidden>
    <p>引入 behaviors/tabs 后调用 initTabs()，事件委托在 [data-tabs] 容器上。</p>
  </section>
  <section data-tab-panel="api" hidden>
    <p>契约：data-tabs（容器）→ data-tab（页签）→ data-tab-panel（面板）；可选 data-tabs-hash 与 location.hash 同步。</p>
  </section>
</div>`,
    usage: `import { initTabs } from '@icen.ai/ui/behaviors/tabs';
initTabs();`,
    behaviors: ['tabs'],
    behaviorInit: { tabs: 'initTabs' },
  },
  {
    slug: 'stat',
    name: '指标卡',
    group: '基础',
    desc: 'stat-grid 自适应网格 + stat-card；数字支持 accent / warn 变体。',
    demo: `<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-num">1,280</div>
    <div class="stat-label">用户总数</div>
  </div>
  <div class="stat-card">
    <div class="stat-num accent">96.2%</div>
    <div class="stat-label">本周可用性</div>
  </div>
  <div class="stat-card">
    <div class="stat-num warn">12</div>
    <div class="stat-label">待处理告警</div>
  </div>
</div>`,
    usage: `<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-num accent">96.2%</div>
    <div class="stat-label">本周可用性</div>
  </div>
</div>`,
  },
  {
    slug: 'table',
    name: '表格',
    group: '表格',
    desc: 'table-wrap 负责窄屏横向滚动；行 hover 高亮，ops 列右对齐放 btn-sm。',
    demo: `<div class="table-wrap">
  <table class="admin-table">
    <thead>
      <tr><th>名称</th><th>状态</th><th class="ops">操作</th></tr>
    </thead>
    <tbody>
      <tr><td>gateway</td><td><span class="pill ok">运行中</span></td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">停用</button></td></tr>
      <tr><td>accounts</td><td><span class="pill ok">运行中</span></td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">停用</button></td></tr>
      <tr><td>billing</td><td><span class="pill warn">降级</span></td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">停用</button></td></tr>
      <tr><td>archive</td><td><span class="pill bad">已停止</span></td><td class="ops"><button class="btn btn-sm">编辑</button><button class="btn btn-sm">启用</button></td></tr>
    </tbody>
  </table>
</div>`,
    usage: `<div class="table-wrap">
  <table class="admin-table">
    <thead><tr><th>名称</th><th class="ops">操作</th></tr></thead>
    <tbody>
      <tr><td>gateway</td><td class="ops"><button class="btn btn-sm">编辑</button></td></tr>
    </tbody>
  </table>
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

  /* ══════════ 表单 ══════════ */
  {
    slug: 'input',
    name: '输入框',
    group: '表单',
    desc: 'wrapper 式输入族：三档尺寸，前后缀、清除钮、密码切换、错误/禁用态，含多行与搜索框。',
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
  <div class="input-wrap control is-error">
    <input class="input" value="校验未通过的内容" />
  </div>
  <div class="input-wrap control is-disabled">
    <input class="input" disabled placeholder="禁用态" />
  </div>
</div>
<div class="demo-col" style="margin-top:16px">
  <div class="textarea-wrap control">
    <textarea class="textarea" data-autosize data-min-rows="3" data-max-rows="6" placeholder="输入多行文本，高度随内容自适应（3–6 行）"></textarea>
  </div>
  <div class="input-wrap control input-wrap--search">
    <span class="input-leading">${svgSearch}</span>
    <input class="input" type="search" placeholder="搜索文档、组件、令牌…" />
    <button class="input-clear" type="button" aria-label="清空">${svgX}</button>
  </div>
</div>`,
    usage: `import { initInput } from '@icen.ai/ui/behaviors/input';
initInput(); // 清除钮 / 密码切换 / textarea autosize / OTP`,
    behaviors: ['input'],
    behaviorInit: { input: 'initInput' },
  },
  {
    slug: 'select',
    name: '选择器',
    group: '表单',
    desc: '触发器与 input 同视觉；弹层支持 ↑↓ 移动、Enter 选中、Esc / 外点关闭，选中值同步隐藏 input。',
    demo: `<div class="demo-col">
  <div class="select" data-select>
    <button class="select-trigger pressable focus-ring" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="select-value is-empty">选择一种水果</span>
      ${svgChevron}
    </button>
    <div class="select-panel" hidden>
      <button class="select-option" type="button" data-value="apple">苹果</button>
      <button class="select-option" type="button" data-value="banana">香蕉</button>
      <button class="select-option" type="button" data-value="orange">橙子</button>
    </div>
    <input type="hidden" data-select-value name="fruit" />
  </div>
</div>`,
    usage: `import { initSelect } from '@icen.ai/ui/behaviors/select';
initSelect();`,
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
document.querySelectorAll('.switch[role="switch"], .checkbox[role="checkbox"]').forEach((el) => {
  el.addEventListener('click', () => {
    el.setAttribute('aria-checked', el.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
  });
});
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
    behaviors: ['input'],
    behaviorInit: { input: 'initInput' },
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
  },
  {
    slug: 'upload',
    name: '上传',
    group: '表单',
    desc: '点击 / Enter / Space 打开文件选择；拖入高亮，drop 后文件写入 input.files 并派发 change。',
    demo: `<div class="demo-col">
  <div class="upload control lift focus-ring" role="button" tabindex="0" aria-label="上传文件">
    <input type="file" multiple />
    <div class="upload-icon">${svgPlus}</div>
    <p class="upload-title">点击或拖拽文件到此处上传</p>
    <p class="upload-desc">支持多选，单文件不超过 2GB</p>
    <p class="upload-error" id="demo-upload-files" hidden></p>
  </div>
</div>`,
    usage: `import { initUpload } from '@icen.ai/ui/behaviors/upload';
initUpload();`,
    behaviors: ['upload'],
    behaviorInit: { upload: 'initUpload' },
    script: `document.querySelectorAll('.upload input[type="file"]').forEach((input) => {
  input.addEventListener('change', () => {
    const msg = document.getElementById('demo-upload-files');
    if (!(msg instanceof HTMLElement) || !(input instanceof HTMLInputElement)) return;
    const names = Array.from(input.files ?? []).map((f) => f.name);
    msg.hidden = names.length === 0;
    msg.textContent = names.length > 0 ? '已选择：' + names.join('、') : '';
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
    usage: `import { initModal, open, close } from '@icen.ai/ui/behaviors/modal';
initModal(); // 事件委托一次绑定，后续 open(id) / close(id) 可编程控制`,
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
    desc: '图标 + 标题 + 描述 + 可选动作按钮。',
    demo: `<div class="empty">
  <div class="empty-icon">${inboxSvg}</div>
  <p class="empty-title">暂无收藏</p>
  <p class="empty-desc">你还没有收藏任何作品，去逛逛找点喜欢的吧。</p>
  <div class="empty-action"><button class="btn btn-primary btn-sm">去发现</button></div>
</div>`,
    usage: `<div class="empty">
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
// dots 自动生成；首尾循环；当前 dot 挂 .active`,
    behaviors: ['carousel'],
    behaviorInit: { carousel: 'initCarousel' },
  },
  {
    slug: 'charts',
    name: '图表总览',
    group: '图表',
    desc: '零依赖纯 SVG/DOM 渲染（无 ECharts）——10 种图表一站式总览。实际使用时请按需安装细分类型（kit/chart-line 等），只引你需要的图表的 CSS + JS。',
    demo: `<div class="chart-grid">
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
    usage: `// 按需导入：只有被引用的函数和这份 CSS 会进包，其余组件零成本
import '@icen.ai/ui/components/charts.css';
import { renderHeatmap, renderSparkline, renderGauge } from '@icen.ai/ui/behaviors/charts';

renderHeatmap(el, { values: 近180天数值数组, weeks: 26 });       // GitHub 式贡献图
renderHeatmap(el, { data: [{ date: '2026-07-01', value: 5 }] }); // 或精确日期形态
renderSparkline(el, { values: [3, 8, 5, 12, 9, 14, 11] });       // 迷你趋势线
renderGauge(el, { value: 64, label: '完成率' });                  // 进度环
renderVBar(el,  { labels: ['一月','二月'], values: [12, 19] });  // 另有 vbar/hbar/stack/donut/line`,
    behaviors: ['charts'],
    script: `const renderVBar = chartsMod.renderVBar;
const renderHBar = chartsMod.renderHBar;
const renderStack = chartsMod.renderStack;
const renderDonut = chartsMod.renderDonut;
const renderLine = chartsMod.renderLine;
const renderHeatmap = chartsMod.renderHeatmap;
const renderSparkline = chartsMod.renderSparkline;
const renderGauge = chartsMod.renderGauge;
const on = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
on('chart-vbar', (el) => renderVBar(el, { labels: ['一月', '二月', '三月', '四月', '五月', '六月'], values: [12, 19, 8, 24, 16, 28] }));
on('chart-hbar', (el) => renderHBar(el, { labels: ['搜索', '推荐', '分享', '直接访问'], values: [320, 240, 160, 80], tone: 'success' }));
on('chart-stack', (el) => renderStack(el, { segments: [{ label: '已完成', value: 45, tone: 'success' }, { label: '进行中', value: 30 }, { label: '待处理', value: 25, tone: 'warning' }] }));
on('chart-donut', (el) => renderDonut(el, { segments: [{ label: '研发', value: 48 }, { label: '设计', value: 32, tone: 'success' }, { label: '测试', value: 20, tone: 'warning' }] }));
on('chart-line', (el) => renderLine(el, { labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], values: [8, 14, 9, 18, 22, 16, 25] }));
on('chart-gauge', (el) => renderGauge(el, { value: 64, label: '完成率' }));
on('chart-spark', (el) => renderSparkline(el, { values: [4, 7, 5, 9, 6, 11, 8, 13, 10, 15, 12, 17, 14, 19] }));
on('chart-heatmap', (el) => {
  // 确定性伪随机（sin 模式），近 26 周 × 7 天
  const values = Array.from({ length: 182 }, (_, i) => {
    const base = Math.abs(Math.sin(i * 0.61)) * 7;
    const spike = i % 17 === 0 ? 8 : 0;
    const rest = i % 11 === 0 ? -99 : 0; // 周期性休息日
    return Math.max(0, Math.round(base + spike + rest));
  });
  renderHeatmap(el, { values, weeks: 26 });
});`,
  },
  {
    slug: 'chart-line',
    name: '折线图',
    group: '图表',
    desc: '面积渐变 + 网格 + 数据点的折线趋势图。独立安装：只引这一份 CSS + renderLine。',
    demo: `<div class="chart-grid">
  <div style="grid-column:1/-1">
    <p class="chart-cap">一周活跃用户趋势</p>
    <div class="chart" id="line-demo"></div>
  </div>
</div>`,
    usage: `import '@icen.ai/ui/kit/chart-line';
import { renderLine } from '@icen.ai/ui/kit/chart-line';

renderLine(el, { labels: ['周一','周二','周三','周四','周五','周六','周日'], values: [8, 14, 9, 18, 22, 16, 25] });`,
    behaviors: ['charts'],
    script: `const renderLine = chartsMod.renderLine;
const el = document.getElementById('line-demo');
if (el) renderLine(el, { labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], values: [8, 14, 9, 18, 22, 16, 25] });`,
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
    slug: 'datatable',
    name: '数据表格',
    group: '表格',
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
);
