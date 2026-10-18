import {test, expect, type Locator} from '@playwright/test';
import {ICON_PATHS} from '../../src/behaviors/icons';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
async function noCheck(root: Locator) {
  expect(await root.locator('svg path').evaluateAll((paths, checks) => paths.some(path => checks.includes(path.getAttribute('d') ?? '')), [ICON_PATHS.check, 'M20 6 9 17l-5-5'])).toBe(false);
}

test('appearance controls omit arrows and check slots while every palette has a contained selected surface', async ({page}) => {
  await page.goto('/components/copy/'); await page.locator('#preset-select button').first().click();
  const panel = page.locator('.icen-theme-switcher-panel[role=dialog]:visible');
  await expect(page.locator('.icen-theme-switcher-chevron')).toHaveCount(0); await expect(panel.locator('.icen-theme-switcher-check')).toHaveCount(0);
  await page.addScriptTag({path: require.resolve('axe-core')});
  for (const preset of ['modern','dongyun','jugou','piano','monet','vangogh']) {
    const card = panel.locator('[data-icen-value="' + preset + '"]'); await card.click(); await page.locator('#preset-select button').first().click(); await expect(card).toHaveAttribute('aria-pressed','true');
    for (const dark of [false,true]) {
      await page.locator('html').evaluate((el,dark) => el.dataset.icenTheme = dark ? 'dark' : 'light', dark); await page.waitForTimeout(350);
      const shadow = await card.evaluate(el => getComputedStyle(el).boxShadow); expect(shadow).toContain('inset');
      await noCheck(panel);
      const issues = await panel.evaluate(async root => {const result = await (window as any).axe.run(root,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}); return result.violations.filter((v:any) => ['serious','critical'].includes(v.impact)).map((v:any) => v.id);});
      expect(issues).toEqual([]);
    }
  }
  await panel.locator('[data-icen-value="modern"]').click(); await page.locator('#preset-select button').first().click(); await page.locator('html').evaluate(el => el.dataset.icenTheme = 'light'); await page.waitForTimeout(350);
  await panel.screenshot({path:'.ui-audit/selection-theme.png',animations:'disabled'});
  const cardBounds=(await panel.boundingBox())!, triggerBounds=(await page.locator('#preset-select').boundingBox())!;
  const x=Math.max(0,Math.min(cardBounds.x,triggerBounds.x)-12), y=Math.max(0,Math.min(cardBounds.y,triggerBounds.y)-12);
  await page.screenshot({path:'.ui-audit/selection-overview.png',animations:'disabled',clip:{x,y,width:Math.max(cardBounds.x+cardBounds.width,triggerBounds.x+triggerBounds.width)+12-x,height:Math.max(cardBounds.y+cardBounds.height,triggerBounds.y+triggerBounds.height)+12-y}});
  await page.screenshot({path:'.ui-audit/selection-header.png',animations:'disabled'});
});

test('select, cascading and tree choices use geometry without dropdown arrows or selection ticks', async ({page}) => {
  for (const primitive of ['modern','pixel']) for (const dark of [false,true]) {
    await page.goto('/components/select/'); await page.locator('html').evaluate((el,{primitive,dark}) => {el.dataset.icenStyle=primitive;el.dataset.icenTheme=dark?'dark':'light';},{primitive,dark});
    const trigger = page.locator('.demo-stage .icen-select-trigger').first(); await expect(trigger.locator('.icen-select-chevron')).toHaveCount(0); await trigger.click();
    const panel = page.locator('.icen-select-panel:visible'); const option = panel.getByRole('option').first(); await option.click(); await trigger.click();
    const selected = panel.locator('.is-selected').first(); await expect(selected).toHaveAttribute('aria-selected','true');
    expect(await selected.evaluate(el => getComputedStyle(el,'::after').maskImage)).toBe('none'); expect(await selected.evaluate(el => getComputedStyle(el).boxShadow)).toContain('inset'); await noCheck(panel);
    await page.goto('/components/cascader/'); const cascader = page.locator('#demo-cascader .icen-cascader-trigger'); await expect(cascader.locator('svg')).toHaveCount(0); await cascader.click();
    const cascaderPanel = page.locator('.icen-cascader-panel:visible'); await cascaderPanel.getByRole('combobox').fill('深圳'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await cascader.click();
    await noCheck(cascaderPanel); const leaf = cascaderPanel.locator('.is-selected').last(); expect(await leaf.evaluate(el => getComputedStyle(el,'::after').maskImage)).toBe('none');
    await page.goto('/components/tree-select/'); const tree = page.locator('#demo-tree-select .icen-tree-select-trigger'); await expect(tree.locator('.icen-tree-select-chevron')).toHaveCount(0); await tree.click();
    const treePanel = page.locator('.icen-tree-select-panel:visible'); const row = treePanel.locator('.icen-tree-select-row').first(); await row.press('Enter');
    const core = treePanel.locator('.is-checked .icen-tree-select-check').first();
    if (await core.count()) expect(await core.evaluate(el => getComputedStyle(el,'::after').maskImage)).toBe('none');
    await noCheck(treePanel);
  }
});

test('menu checks and AI model selection retain semantics without glyph slots', async ({page}) => {
  await page.goto('/components/dropdown/'); const trigger = page.locator('.demo-stage [data-icen-dropdown-trigger]'); await expect(trigger.locator('svg')).toHaveCount(0); await trigger.click();
  const menu = page.locator('.icen-menu:visible'), choice = menu.getByRole('menuitemcheckbox',{name:'接收更新'});
  await expect(choice).toHaveAttribute('aria-checked','true'); await expect(menu.locator('.icen-menu-item-check')).toHaveCount(0); await noCheck(menu);
  expect(await choice.evaluate(el => getComputedStyle(el).boxShadow)).toContain('inset'); await choice.press('Space'); await expect(choice).toHaveAttribute('aria-checked','false');
  await page.goto('/components/ai-composer/'); const model = page.locator('[data-icen-ai-model-open]').first(); await expect(model.locator('.icen-ai-composer-model-chevron')).toHaveCount(0); await model.click();
  const popup = page.locator('.icen-ai-composer-popup:visible'); await expect(popup.locator('.icen-ai-composer-popup-option-check')).toHaveCount(0);
  await noCheck(popup); const selected = popup.locator('[aria-selected=true]').first(); await expect(selected).toBeVisible(); expect(await selected.evaluate(el => getComputedStyle(el).boxShadow)).toContain('inset');
});

test('native and custom checkboxes keep real checked and mixed states with square cores', async ({page}) => {
  await page.goto('/components/switch/'); const checked = page.locator('.demo-stage .icen-checkbox').nth(1);
  expect(await checked.evaluate(el => getComputedStyle(el,'::before').clipPath)).toBe('none');
  await checked.press('Space'); await expect(checked).toHaveAttribute('aria-checked','false');
  const mixed = page.locator('.demo-stage .icen-checkbox[aria-checked=mixed]'); expect(await mixed.evaluate(el => getComputedStyle(el,'::before').height)).toBe('2px');
  await page.goto('/components/datatable/'); const native = page.locator('input.icen-dt-check').first(); await expect(native).toHaveCSS('appearance','none'); await native.check(); await expect(native).toBeChecked();
  await expect(native).toHaveCSS('background-clip','content-box');
  await page.goto('/components/kb-segment/'); const clean = page.locator('input[data-icen-kb-segment-clean]').first(); await expect(clean).toHaveCSS('appearance','none');
});

test('touch RTL and forced colors retain an unmistakable selected surface without added symbols', async ({browser}) => {
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',forcedColors:'active'});
  try {const page=await context.newPage(); await page.goto('/components/theme-switcher/'); await page.locator('html').evaluate(el => {el.dir='rtl';el.dataset.icenStyle='pixel';});
    const trigger=page.locator('#appearance-mobile button').first(); await trigger.tap(); const panel=page.locator('.icen-theme-switcher-panel[role=dialog]:visible');
    const selected=panel.locator('[aria-pressed=true]').first(); await expect(selected).toHaveCSS('outline-style','double'); await noCheck(panel);
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44); expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {await context.close();}
});
