import { themeSwitcherHTML } from '../../../src/behaviors/theme-switcher';
import type { ComponentDoc } from './components';

export const THEME_SWITCHER_DOC: ComponentDoc = {
  slug: 'theme-switcher',
  name: '外观切换',
  group: '基础',
  desc: '外观切换控件：主题、原语、明暗共享全局状态，六种展示 × 四档尺寸。',
  detail: {
    features: [
      '**展示**：`icon` / `color` / `color-name` / `name` / `swatch` / `swatch-name`',
      '**尺寸**：`xs` / `sm` / `md` / `lg` 四档，触屏自动保留 44px 点击区域',
      '**组合**：`kind` 取 `all` / `theme` / `primitive` / `mode`，独立与合并入口共享状态',
      '**布局**：`menu` 下拉与 `inline` 内嵌；`layout: inline` 免展开设置面板',
      '**接入**：`createThemeSwitcher` 挂载，或 SSR HTML + `initThemeSwitcher` 幂等接管',
      '**声明式**：空挂载点 `data-icen-theme-switcher` + data 属性，初始化自动生成控件',
      '**状态**：所有入口共享 `theme.ts`——`setTheme` 改一处，每个控件与全站立即同步',
    ],
    notes: [
      '自定义主题先提供该主题的 token CSS，再 `registerThemePreset` 登记；无色样数据时用当前语义色。',
      'Astro 布局 frontmatter 需另引 `theme-switcher.css`，避免 client bundle 摇掉 CSS。',
    ],
  },
  demoLayout: 'stretch',
  demo: `<section aria-label="展示形态">
    <h3>从一枚色样，到完整的外观入口</h3>
    <p class="doc-note">每个入口都包含主题、原语和明暗。紧凑时隐藏名称，展开后保留完整选择。</p>
    <div class="demo-row">${[
      ['icon','图标'],['color','双色圆'],['color-name','双色圆＋名称'],['name','名称'],['swatch','色卡'],['swatch-name','色卡＋名称'],
    ].map(([display,label]) => `<div class="switcher-demo-example"><span class="doc-note">${label}</span>${themeSwitcherHTML({display:display as 'icon'})}</div>`).join('')}</div>
  </section>
  <section aria-label="尺寸" class="switcher-demo-section">
    <h3>四档尺寸，一样的操作</h3>
    <p class="doc-note">XS 用在密集工具条，SM 用在顶栏，MD 用在常规界面，LG 用在设置入口。触屏自动保留 44px 点击区域。</p>
    <div class="demo-row">${(['xs','sm','md','lg'] as const).map((size) => `<div class="switcher-demo-example"><span class="doc-note">${size.toUpperCase()}</span>${themeSwitcherHTML({size,display:'swatch-name'})}</div>`).join('')}</div>
  </section>
  <section aria-label="独立组合" class="switcher-demo-section">
    <h3>按位置，自由组合</h3>
    <p class="doc-note">只放一个明暗按钮，或把三种控制并排使用。独立入口与合并入口共享状态。</p>
    <div class="demo-row">${themeSwitcherHTML({kind:'theme',display:'color-name',size:'sm'})}${themeSwitcherHTML({kind:'primitive',display:'name',size:'sm'})}${themeSwitcherHTML({kind:'mode',display:'icon',size:'sm'})}${themeSwitcherHTML({kind:'mode',display:'name',size:'lg'})}</div>
  </section>
  <section aria-label="设置面板" class="switcher-demo-section">
    <h3>无需展开的外观设置</h3>
    <p class="doc-note">色样随明暗更新，选择状态始终与全站一致。主题决定颜色，原语决定形状、字体与材质。</p>
    ${themeSwitcherHTML({layout:'inline',size:'lg'})}
  </section>`,
  usage: `import { createThemeSwitcher } from '@icen.ai/ui/kit/theme-switcher';

// 一个挂载点，不需要手写菜单或同步代码。
const appearance = createThemeSwitcher(el, {
  kind: 'all',             // all | theme | primitive | mode
  display: 'swatch-name',  // icon | color | color-name | name | swatch | swatch-name
  size: 'md',              // xs | sm | md | lg
  layout: 'menu',          // menu | inline
  sizing: { maxWidth: 320 },
});
// 卸载（React effect / Vue onUnmounted）
appearance.destroy();

// 服务端渲染：由同一棵组件树生成 HTML，客户端幂等接管。
import { themeSwitcherHTML, initThemeSwitcher } from '@icen.ai/ui/kit/theme-switcher';
const html = themeSwitcherHTML({ kind: 'theme', display: 'color-name', size: 'sm' });
initThemeSwitcher();

// 纯声明式：放一个空挂载点，初始化自动生成完整控件。
// <div data-icen-theme-switcher data-icen-kind="all"
//      data-icen-display="icon" data-icen-size="sm"></div>
// initThemeSwitcher();

// 所有入口共享 theme.ts。代码修改也立即反映到每个控件。
import { setTheme, getCurrentTheme, registerThemePreset } from '@icen.ai/ui/behaviors/theme';
setTheme({ preset: 'ink', style: 'pixel', dark: true });
getCurrentTheme(); // 当前实际生效状态（包括存储不可写时）

// 自定义主题：先提供该主题的 token CSS，再登记。
registerThemePreset('ocean');
createThemeSwitcher(el, { labels: { ocean: '海洋' } });
// 内置主题色样自动读取目录；自定义主题没有色样数据时使用当前语义色。

// Astro：布局 frontmatter 中另引 CSS（避免 client bundle 摇掉 CSS）。
// import '@icen.ai/ui/components/theme-switcher.css';`,
  behaviors: ['theme-switcher'],
  behaviorInit: {'theme-switcher':'initThemeSwitcher'},
};
