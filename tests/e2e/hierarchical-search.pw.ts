import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {ICON_PATHS} from '../../src/behaviors/icons';
const require=createRequire(import.meta.url);

test('cascader search keeps its caret, announces result paths, and clears from keyboard in both primitives and modes',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]) {
    await page.goto('/components/cascader/');
    await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme');},{primitive,dark});
    const trigger=page.locator('#demo-cascader .icen-cascader-trigger');await trigger.click();
    const panel=page.locator('.icen-cascader-panel:visible'),search=panel.getByRole('combobox');
    await search.press('ArrowRight');await expect(search).toBeFocused();await expect(panel.locator('.icen-cascader-col')).toHaveCount(1);
    await search.fill('深圳');await expect(panel.getByRole('option')).toHaveCount(2);
    await search.press('ArrowDown');await expect(search).toBeFocused();
    const active=await search.getAttribute('aria-activedescendant');await expect(page.locator('#'+active)).toContainText('南山区');
    await search.press('Tab');const clear=panel.getByRole('button',{name:'清空搜索'});await expect(clear).toBeFocused();
    await clear.press('Enter');await expect(search).toHaveValue('');await expect(search).toBeFocused();await expect(panel.locator('.icen-cascader-cols')).toBeVisible();
    await search.fill('深圳');await search.press('ArrowUp');await search.press('Enter');await expect(trigger).toContainText('广东 / 深圳 / 福田区');
  }
});

test('tree selection preserves focus after redraw, mirrors branch keys in RTL and exits in native tab order',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]) {
    await page.goto('/components/tree-select/');
    await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme');el.dir='rtl';},{primitive,dark});
    const trigger=page.locator('#demo-tree-select .icen-tree-select-trigger');await trigger.click();
    const panel=page.locator('.icen-tree-select-panel:visible'),search=panel.locator('input[type="search"]');
    await search.press('ArrowDown');const parent=panel.locator('[role="treeitem"][data-icen-value="ceo"]');await expect(parent).toBeFocused();
    await expect(parent.locator('.icen-tree-select-toggle svg path')).toHaveAttribute('d',ICON_PATHS['chevron-down']);
    await parent.press('Enter');await expect(parent).toBeFocused();await expect(parent).toHaveAttribute('aria-checked','mixed');
    await parent.press('Enter');await expect(parent).toHaveAttribute('aria-checked','false');
    await parent.press('Enter');await expect(parent).toHaveAttribute('aria-checked','mixed');
    const bounds=(await trigger.boundingBox())!,popup=(await panel.boundingBox())!;expect(popup.y).toBeGreaterThanOrEqual(bounds.y+bounds.height);
    await parent.press('ArrowRight');await expect(parent).toHaveAttribute('aria-expanded','false');
    await parent.press('ArrowLeft');await expect(parent).toHaveAttribute('aria-expanded','true');
    await parent.press('End');await expect(panel.locator('[data-icen-value="hr"]')).toBeFocused();
    await page.keyboard.press('Tab');await expect(panel).toBeHidden();
    expect(await page.evaluate(()=>document.activeElement?.closest('.icen-tree-select-panel')!=null)).toBe(false);
  }
});

test('open hierarchy panels have no serious accessibility errors, and page navigation disposes their portals',async({page})=>{
  for(const slug of ['cascader','tree-select']) {
    await page.goto('/components/'+slug+'/');await page.locator('.demo-stage .icen-'+slug+'-trigger').click();
    const panel=page.locator('.icen-'+slug+'-panel:visible');
    await panel.locator('input[type="search"]').fill(slug==='cascader'?'深圳':'DBA');
    await page.addScriptTag({path:require.resolve('axe-core')});
    const issues=await panel.evaluate(async(root)=>{
      const result=await (window as any).axe.run(root,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
      return result.violations.filter((issue:any)=>['serious','critical'].includes(issue.impact)).map((issue:any)=>({id:issue.id,nodes:issue.nodes.map((node:any)=>node.target)}));
    });expect(issues).toEqual([]);
    await page.screenshot({path:'.ui-audit/'+slug+'-search.png'});
    await page.locator('.doc-pager-next').click();await expect(page.locator('.icen-'+slug+'-panel')).toHaveCount(0);
    await page.goBack();await page.locator('.demo-stage .icen-'+slug+'-trigger').click();
    await expect(page.locator('.icen-'+slug+'-panel:visible')).toHaveCount(1);
  }
});

test('search clear uses a full touch target and reduced motion never blocks filtering',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try {
    const page=await context.newPage();await page.goto('/components/cascader/');
    await page.locator('.demo-stage .icen-cascader-trigger').tap();const panel=page.locator('.icen-cascader-panel:visible'),search=panel.locator('input');
    await search.fill('深圳');const clear=panel.getByRole('button',{name:'清空搜索'}),bounds=(await clear.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(await clear.evaluate((el)=>parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
    await clear.tap();await expect(search).toHaveValue('');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {await context.close();}
});
