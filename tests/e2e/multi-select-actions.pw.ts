import { test,expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);

test('quiet icon example supports removal, undo and focus return',async({page})=>{
  await page.goto('/components/icon/');
  const row=page.locator('#icon-demo-quiet');
  await row.getByRole('button',{name:'移除规范'}).focus();
  await page.keyboard.press('Enter');await expect(row).toBeHidden();
  const undo=page.getByRole('button',{name:'撤销',exact:true});await expect(undo).toBeFocused();
  await page.keyboard.press('Enter');await expect(row).toBeVisible();
  await expect(row.getByRole('button',{name:'移除规范'})).toBeFocused();
});

test('mobile documents show the component first and keep navigation and all appearance axes available',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/components/tree-select/');
  await expect(page.locator('.docs-nav-disclosure')).toHaveJSProperty('open',false);
  await expect(page.locator('.icen-tree-select-trigger')).toBeInViewport();
  await expect(page.locator('.doc-desc')).toContainText('从组织或分类树');
  await page.locator('.docs-nav-toggle').click();
  await expect(page.locator('.docs-nav-disclosure')).toHaveJSProperty('open',true);
  await page.locator('.docs-side').getByRole('link',{name:'级联选择',exact:true}).click();
  await expect(page).toHaveURL(/\/cascader\//);
  await expect(page.locator('.docs-nav-disclosure')).toHaveJSProperty('open',false);
  await page.locator('#appearance-mobile .icen-theme-switcher-trigger').click();
  const dialog=page.locator('[role="dialog"]:visible');
  await dialog.locator('[data-icen-value="pixel"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel');
});

test('multiselect chips have stable slots, real keyboard actions and no nested controls in either primitive/mode',async({page})=>{
  for(const primitive of ['benzhen','pixel']) for(const dark of [false,true]) {
    await page.goto('/components/select/');
    await page.evaluate(({primitive,dark})=>{document.documentElement.setAttribute('data-icen-style',primitive);document.documentElement.toggleAttribute('data-icen-theme',dark);if(dark)document.documentElement.setAttribute('data-icen-theme','dark');},{primitive,dark});
    const root=page.locator('.demo-stage [data-icen-select-multiple]');
    const trigger=root.locator('.icen-select-trigger');await trigger.click();
    const panel=page.locator('.icen-select-panel:not([hidden])');
    await panel.getByRole('option',{name:'TypeScript',exact:true}).click();
    await panel.getByRole('option',{name:'React',exact:true}).click();
    await page.keyboard.press('Escape');
    await expect(trigger.locator('button,[role="button"]')).toHaveCount(0);
    const chip=root.locator('.icen-select-chip').first(),action=chip.getByRole('button',{name:'移除 TypeScript'});
    const before=await chip.boundingBox();await chip.hover();await expect(action).toHaveCSS('opacity','1');
    const after=await chip.boundingBox();expect(after!.width).toBeCloseTo(before!.width,1);
    await action.focus();await page.keyboard.press('Enter');
    await expect(root.locator('.icen-select-chip-x')).toHaveCount(1);
    await expect(root.getByRole('button',{name:'移除 React'})).toBeFocused();
    await page.keyboard.press('Space');await expect(root.locator('.icen-select-chip')).toHaveCount(0);await expect(trigger).toBeFocused();
  }
});

test('tree chip actions remain operable on touch and the control expands without overlap',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();await page.goto('/components/tree-select/');
  const root=page.locator('.icen-tree-select');await root.locator('.icen-tree-select-trigger').click();
  await page.getByRole('treeitem',{name:'人力资源',exact:true}).click();
  await page.keyboard.press('Escape');
  const action=root.getByRole('button',{name:'移除 人力资源'});
  await expect(action).toBeVisible();expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const chip=(await root.locator('.icen-tree-select-chip').boundingBox())!,trigger=(await root.locator('.icen-tree-select-trigger').boundingBox())!;
  expect(chip.y).toBeGreaterThanOrEqual(trigger.y);expect(chip.y+chip.height).toBeLessThanOrEqual(trigger.y+trigger.height);
  await page.screenshot({path:'test-results/tree-chips-touch.png',fullPage:false});
  await action.click();await expect(root.locator('.icen-tree-select-chip')).toHaveCount(0);
  await context.close();
});

test('selected chips and listbox roles have no serious accessibility violations',async({page})=>{
  await page.goto('/components/select/');
  const root=page.locator('.demo-stage [data-icen-select-multiple]');await root.locator('.icen-select-trigger').click();
  await page.locator('.icen-select-panel:not([hidden])').getByRole('option',{name:'TypeScript',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.addScriptTag({path:require.resolve('axe-core')});
  const issues=await page.evaluate(async()=>{
    const results=await (window as any).axe.run(document.querySelector('.demo-stage'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return results.violations.filter((issue:any)=>['serious','critical'].includes(issue.impact)).map((issue:any)=>({id:issue.id,targets:issue.nodes.map((n:any)=>n.target)}));
  });
  expect(issues).toEqual([]);
});
