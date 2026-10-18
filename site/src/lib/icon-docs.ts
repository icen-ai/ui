import { ICON_PATHS, iconHTML } from '../../../src/behaviors/icons';
import type { ComponentDoc } from './components';
export const ICON_DOC: ComponentDoc = {
  slug:'icon',name:'界面图标',group:'基础',
  desc:'同一套精确绘制的 SVG 图标：操作、方向与状态通用，可输出服务端 HTML 或原生 DOM。',
  detail:{
    features:[
      '**网格**：固定 20px 光学网格，统一线宽与端点，不同字号保持对齐',
      '**输出**：`iconHTML` 服务端 HTML（全转义）；`createIcon` 原生 DOM，无字体依赖',
      '**语义**：带 `label` 自动 `role="img"`；在已有名称的按钮中默认 `aria-hidden`',
      '**扩展**：`registerIcon` 注册自有图形走同一网格；只接受 SVG path，不执行脚本',
      '**次要动作**：`.icen-icon-action` + `data-icen-reveal` 悬停 / 聚焦显现，触屏常显',
    ],
    notes:[
      '次要动作槽位固定、显现不位移；只用于次要操作，不要隐藏主要操作或关键状态。',
      '方向图标的 RTL 语义由所在组件决定，通用图标不会擅自翻转。',
    ],
  },
  demoLayout: 'stretch',
  demo:`<div class="icon-demo-grid">${Object.keys(ICON_PATHS).map((name)=>`<div class="icon-demo-cell">${iconHTML(name,{size:20})}<code>${name}</code></div>`).join('')}</div>
  <p class="doc-note">同一个图形在不同字号下保持对齐。</p>
  <div class="demo-row">${[12,16,20,24,32].map((size)=>`<span>${iconHTML('check',{size})} ${size}px</span>`).join('')}</div>
  <p class="doc-note">次要动作保留固定槽位。悬停这一行，或按 Tab 聚焦，移除按钮显现；内容不会位移。</p>
  <div class="icon-demo-quiet" id="icon-demo-quiet"><span>产品设计规范</span><button type="button" class="icen-icon-action" data-icen-reveal aria-label="移除规范">${iconHTML('close')}</button></div>
  <p id="icon-demo-removed" hidden role="status">规范已移除。<button type="button" class="icen-btn icen-btn-sm" id="icon-demo-undo">撤销</button></p>`,
  script: `var row = document.getElementById('icon-demo-quiet');
var status = document.getElementById('icon-demo-removed');
var remove = row.querySelector('button');
var undo = document.getElementById('icon-demo-undo');
remove.addEventListener('click', function () { row.hidden = true; status.hidden = false; undo.focus(); });
undo.addEventListener('click', function () { status.hidden = true; row.hidden = false; remove.focus(); });`,
  usage:`import { iconHTML, createIcon, registerIcon } from '@icen.ai/ui/kit/icon';

// 在服务端模板中输出 SVG；所有标签和属性均转义。
const html = iconHTML('chevron-down', { size: 16 });
// 在已经有名称的按钮中，图标默认 aria-hidden，不重复朗读。
button.setAttribute('aria-label', '关闭');
const closeIcon = createIcon('close');
if (closeIcon) button.append(closeIcon);

// 独立图标提供 label 后自动带 role="img"。
const completeIcon = createIcon('check', { label: '已完成', size: 20 });
if (completeIcon) container.append(completeIcon);

// 自有图形使用同一光学网格。只接受 SVG path，不执行脚本或注入 HTML。
registerIcon('app-mark', 'M3 3h14v14H3Z');
iconHTML('app-mark');

// 标记驱动的次要动作：.icen-icon-action + data-icen-reveal。
// 父级 hover / focus-within 显示，触屏常显。不要隐藏主要操作或关键状态。
// 方向图标的 RTL 语义由所在组件决定，通用图标不会擅自翻转。`,
};
