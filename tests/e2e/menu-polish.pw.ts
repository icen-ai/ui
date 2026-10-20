import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('dropdown has real focus, fixed icon/selection slots and keyboard checkbox actions in every primitive/mode',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]) {
    await page.goto('/components/dropdown/');
    await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme');},{primitive,dark});
    const trigger=page.locator('.demo-stage [data-icen-dropdown-trigger]');await trigger.press('ArrowDown');
    const menu=page.getByRole('menu'),first=menu.getByRole('menuitem',{name:'重命名',exact:true});await expect(first).toBeFocused();
    await expect(menu).toHaveAttribute('aria-labelledby',await trigger.getAttribute('id') as string);
    const check=menu.getByRole('menuitemcheckbox',{name:'接收更新'}),labelX=await first.locator('.icen-menu-item-label').evaluate((el)=>el.getBoundingClientRect().x);
    expect(await check.locator('.icen-menu-item-label').evaluate((el)=>el.getBoundingClientRect().x)).toBeCloseTo(labelX,0);
    await menu.getByRole('menuitem',{name:'删除',exact:true}).hover();await page.keyboard.press('ArrowUp');await expect(check).toBeFocused();
    await check.press('Home');
    await first.press('ArrowDown');await expect(menu.getByRole('menuitem',{name:'分享',exact:true})).toBeFocused();
    await page.keyboard.press('ArrowDown');await expect(check).toBeFocused();await check.press('Space');
    await expect(check).toHaveAttribute('aria-checked','false');await expect(menu).toBeVisible();await expect(check).toBeFocused();
    await check.press('End');await expect(menu.getByRole('menuitem',{name:'删除',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(menu).toHaveCount(0);
    await trigger.click();await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');await trigger.click();await expect(page.getByRole('menuitem',{name:'重命名',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');
  }
});

test('menu actions dispatch once and do not submit an enclosing form',async({page})=>{
  await page.goto('/components/dropdown/');
  await page.locator('.demo-stage [data-icen-dropdown]').evaluate((root)=>{
    const form=document.createElement('form');root.before(form);form.append(root);
    (window as any).__menuCounts={submit:0,click:0,select:0};
    form.addEventListener('submit',(event)=>{event.preventDefault();(window as any).__menuCounts.submit++;});
    root.querySelector('#dd-rename')!.addEventListener('click',()=>(window as any).__menuCounts.click++);
    document.addEventListener('icen:menu-select',()=>(window as any).__menuCounts.select++);
  });
  await page.locator('.demo-stage [data-icen-dropdown-trigger]').press('Enter');
  await page.getByRole('menuitem',{name:'重命名',exact:true}).press('Enter');
  expect(await page.evaluate(()=>(window as any).__menuCounts)).toEqual({submit:0,click:1,select:1});
});

test('wide long menu measures its real bounds, flips, reveals the active row and exits in logical tab order',async({page})=>{
  await page.setViewportSize({width:390,height:700});await page.goto('/components/dropdown/');
  await page.locator('.demo-stage [data-icen-dropdown]').evaluate((root)=>{
    (root as HTMLElement).style.cssText='position:fixed;bottom:20px;right:12px;';root.setAttribute('data-icen-panel-width','350');root.setAttribute('data-icen-panel-max-height','180');
    const template=root.querySelector('[data-icen-dropdown-menu]')!;template.replaceChildren();
    for(let i=0;i<40;i++){const item=document.createElement('button');item.className='icen-menu-item';item.textContent='Item '+String(i).padStart(2,'0');template.append(item);}
    const after=document.createElement('button');after.id='menu-after';after.textContent='After menu';root.after(after);
  });
  const trigger=page.locator('.demo-stage [data-icen-dropdown-trigger]');await trigger.press('ArrowDown');
  const menu=page.getByRole('menu');await expect(menu).toHaveAttribute('data-icen-side','top');
  const box=(await menu.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(12);expect(box.x+box.width).toBeLessThanOrEqual(378);expect(box.height).toBeLessThanOrEqual(180);
  const scrollY=await page.evaluate(()=>scrollY);await page.keyboard.press('End');
  const last=menu.getByRole('menuitem',{name:'Item 39'});await expect(last).toBeFocused();
  expect(await menu.evaluate((el)=>el.scrollTop)).toBeGreaterThan(0);expect(await page.evaluate(()=>scrollY)).toBe(scrollY);
  await last.press('Tab');await expect(page.locator('#menu-after')).toBeFocused();await expect(page.getByRole('menu')).toHaveCount(0);
});

test('dropdown and context menu expose usable SVG actions with no serious accessibility violations and clean up on navigation',async({page})=>{
  for(const slug of ['dropdown','context-menu']) {
    await page.goto('/components/'+slug+'/');
    if(slug==='dropdown')await page.locator('.demo-stage [data-icen-dropdown-trigger]').click();
    else {await page.locator('.ctx-zone').focus();await page.keyboard.press('Shift+F10');}
    const menu=page.getByRole('menu');await expect(menu).toBeVisible();
    await expect(menu.locator('.icen-menu-item-icon svg').first()).toBeVisible();
    await page.addScriptTag({path:require.resolve('axe-core')});
    const issues=await menu.evaluate(async(root)=>{
      const report=await (window as any).axe.run(root,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
      return report.violations.filter((issue:any)=>['serious','critical'].includes(issue.impact)).map((issue:any)=>({id:issue.id,nodes:issue.nodes.map((node:any)=>node.target)}));
    });expect(issues).toEqual([]);
    await page.screenshot({path:'.ui-audit/'+slug+'-menu.png'});
    await page.keyboard.press('Escape');
    if(slug==='context-menu')await expect(page.locator('.ctx-zone')).toBeFocused();
    if(slug==='dropdown')await page.locator('.demo-stage [data-icen-dropdown-trigger]').click();
    else await page.keyboard.press('Shift+F10');
    await page.locator('.doc-pager-next').click();await expect(page.locator('.icen-menu')).toHaveCount(0);
  }
});

test('touch menu actions meet 44px and reduced motion removes exit delay',async({browser})=>{
  const context=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try {
    const page=await context.newPage();await page.goto('/components/dropdown/');const trigger=page.locator('.demo-stage [data-icen-dropdown-trigger]');await trigger.tap();
    const menu=page.getByRole('menu');for(const item of await menu.getByRole('menuitem').all())expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');await expect(page.locator('.icen-menu')).toHaveCount(0);
    await page.goto('/components/context-menu/');const zone=page.locator('.ctx-zone');
    const box=(await zone.boundingBox())!;await page.dispatchEvent('.ctx-zone','pointerdown',{pointerType:'touch',clientX:box.x+20,clientY:box.y+20});
    await expect(page.getByRole('menu')).toBeVisible();await page.dispatchEvent('.ctx-zone','pointerup',{pointerType:'touch'});
    for(const item of await page.getByRole('menu').getByRole('menuitem').all())expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }finally{await context.close();}
});
