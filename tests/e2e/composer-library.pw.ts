import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('context library supports search, multi-selection, staged commands and stable drafts',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/components/ai-composer/');
  const root=page.locator('#ai-composer-demo'),field=root.locator('textarea');await field.fill('核对现代的层级');
  const trigger=root.getByRole('button',{name:'添加上下文与命令'});await trigger.click();
  const panel=page.getByRole('dialog',{name:'添加上下文与命令'}),search=panel.getByRole('searchbox');await expect(search).toBeFocused();
  const skill=panel.getByRole('option',{name:/界面设计/});await skill.click();await expect(skill).toHaveAttribute('aria-selected','true');
  await panel.getByRole('button',{name:'工具',exact:true}).click();await panel.getByRole('option',{name:/工作区搜索/}).click();
  await expect(panel.getByRole('option',{name:/GitHub/})).toHaveAttribute('aria-disabled','true');
  await expect(field).toHaveValue('核对现代的层级');await expect(root.locator('.icen-ai-composer-refs .icen-ai-composer-chip')).toHaveCount(2);
  await expect.poll(async()=>{const p=(await panel.boundingBox())!,r=(await root.boundingBox())!;return p.y+p.height<=r.y-6||p.y>=r.y+r.height+6}).toBe(true);
  await panel.getByRole('button',{name:'命令',exact:true}).click();await search.fill('审查');await expect(panel.locator('mark').first()).toHaveText('审查');
  await search.press('Enter');await expect(field).toHaveValue('/review 核对现代的层级');await expect(field).toBeFocused();await expect(panel).toHaveCount(0);
  await expect(page.locator('#ai-composer-log')).not.toContainText('icen:ai-command');await field.press('Enter');await expect(page.locator('#ai-composer-log')).toContainText('icen:ai-command · /review');
  expect(errors).toEqual([]);
});

test('library follows actual height and expanding context without covering the editor',async({page})=>{
  await page.setViewportSize({width:1280,height:1100});await page.goto('/components/ai-composer/');const root=page.locator('#ai-composer-demo');await root.locator('[data-icen-ai-library]').click();const panel=page.getByRole('dialog',{name:'添加上下文与命令'});
  const clear=async()=>{const p=(await panel.boundingBox())!,r=(await root.boundingBox())!;return p.y+p.height<=r.y-6||p.y>=r.y+r.height+6};
  await expect.poll(clear).toBe(true);await panel.getByRole('option',{name:/界面设计/}).click();await panel.getByRole('option',{name:/工作区搜索/}).click();await expect.poll(clear).toBe(true);
  const list=panel.locator('.icen-ai-composer-popup-list');await list.evaluate(el=>el.scrollTop=el.scrollHeight);
  await expect.poll(()=>list.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
  await page.waitForTimeout(100);expect(await list.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
  await panel.getByRole('searchbox').fill('没有这个项目');await expect.poll(clear).toBe(true);await panel.getByRole('searchbox').fill('');await expect.poll(clear).toBe(true);
  await page.setViewportSize({width:1280,height:720});await expect.poll(clear).toBe(true);await page.keyboard.press('Escape');await expect(root.locator('[data-icen-ai-library]')).toBeFocused();
});

test('file removal, queue snapshots and keyboard recovery agree with emitted data',async({page})=>{
  await page.goto('/components/ai-composer/');const root=page.locator('#ai-composer-demo'),field=root.locator('textarea');
  await root.evaluate(el=>{(window as any).drafts=[];el.addEventListener('icen:ai-queue',(e:any)=>(window as any).drafts.push({text:e.detail.text,files:e.detail.files?.map((f:File)=>f.name),refs:e.detail.refs?.map((r:any)=>r.kind)}))});
  await root.locator('input[type=file]').setInputFiles([{name:'design.txt',mimeType:'text/plain',buffer:Buffer.from('材料')},{name:'remove.txt',mimeType:'text/plain',buffer:Buffer.from('移除')}]);
  await root.getByRole('button',{name:'移除附件 remove.txt',exact:true}).click();
  await root.getByRole('button',{name:'添加上下文与命令'}).click();const panel=page.getByRole('dialog',{name:'添加上下文与命令'});
  await panel.getByRole('option',{name:/界面设计/}).click();await panel.getByRole('searchbox').press('Escape');
  await page.locator('#ai-composer-run').click();await field.fill('有上下文的排队消息');await field.press('Enter');
  expect(await page.evaluate(()=>(window as any).drafts)).toEqual([{text:'有上下文的排队消息',files:['design.txt'],refs:['skill']}]);
  await expect(root.locator('.icen-ai-composer-attach')).toBeHidden();await page.locator('#ai-composer-run').click();await field.press('ArrowUp');
  await expect(field).toHaveValue('有上下文的排队消息');await expect(root.locator('.icen-ai-composer-attach')).toContainText('design.txt');await expect(root.locator('.icen-ai-composer-refs')).toContainText('界面设计');
  await expect(root.locator('.icen-ai-composer-attach')).not.toContainText('remove.txt');
});

test('opened library, slash and reference panels stay accessible in both primitives and modes',async({page})=>{
  await page.goto('/components/ai-composer/');await page.addScriptTag({path:require.resolve('axe-core')});const root=page.locator('#ai-composer-demo'),field=root.locator('textarea');
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]){
    await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme')},{primitive,dark});
    for(const mode of ['library','command','ref']){
      if(mode==='library')await root.getByRole('button',{name:'添加上下文与命令'}).click();else await field.fill(mode==='command'?'/':'@');
      const panel=page.locator('.icen-ai-composer-popup');await expect(panel).toBeVisible();
      const issues=await panel.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));const r=await (window as any).axe.run({include:[['#ai-composer-demo'],['.icen-ai-composer-popup']]},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.filter((v:any)=>['serious','critical'].includes(v.impact)).map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary}))}))});expect(issues).toEqual([]);
      await expect(panel.locator('.icen-ai-composer-popup-option-check')).toHaveCount(0);
      const svg=panel.locator('.icen-ai-composer-popup-option-icon svg').first();await expect(svg).toHaveAttribute('viewBox','0 0 20 20');
      if(mode==='library')await panel.screenshot({path:`.ui-audit/ai-library-${primitive}-${dark?'dark':'light'}.png`});
      await page.keyboard.press('Escape');await field.fill('');
    }
  }
});

test('touch RTL, long names, forced colors and constrained panels preserve operability',async({browser})=>{
  const context=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  try{const page=await context.newPage();await page.goto('/components/ai-composer/');await page.locator('html').evaluate(el=>el.dir='rtl');const root=page.locator('#ai-composer-demo');
    await root.evaluate(el=>el.setAttribute('data-icen-panel-width','340'));const trigger=root.getByRole('button',{name:'添加上下文与命令'});await trigger.click();
    const panel=page.getByRole('dialog',{name:'添加上下文与命令'});const rect=(await panel.boundingBox())!;expect(rect.width).toBeCloseTo(340,0);expect(rect.x).toBeGreaterThanOrEqual(8);expect(rect.x+rect.width).toBeLessThanOrEqual(382);
    for(const selector of ['.icen-ai-composer-popup-filters button','.icen-ai-composer-popup-option'])for(const item of await panel.locator(selector).all()){const r=await item.boundingBox();if(r)expect(r.height).toBeGreaterThanOrEqual(44)}
    await panel.getByRole('searchbox').fill('design');await page.keyboard.press('Enter');await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
    const remove=root.getByRole('button',{name:'移除引用 界面设计'});const r=(await remove.boundingBox())!;expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);
    const filename='现代材料与组件状态对照 — 从工作区同步的长文件名称 '.repeat(4)+'.md';
    await root.locator('input[type=file]').setInputFiles({name:filename,mimeType:'text/markdown',buffer:Buffer.from('材料')});
    const fileChip=root.locator('.icen-ai-composer-attach .icen-ai-composer-chip');const fit=await fileChip.evaluate(el=>{const b=el.getBoundingClientRect(),r=el.querySelector('button')!.getBoundingClientRect(),text=el.querySelector('.icen-ai-composer-chip-text')!;return {fits:r.x>=b.x&&r.right<=b.right,ellipsis:text.scrollWidth>text.clientWidth,title:el.getAttribute('title')}});
    expect(fit).toEqual({fits:true,ellipsis:true,title:filename});
    await root.screenshot({path:'.ui-audit/ai-composer-mobile-rtl.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.emulateMedia({forcedColors:'active'});await trigger.click();await expect(panel).toBeVisible();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  }finally{await context.close()}
});

test('six palettes keep selected context readable in light and dark',async({page})=>{
  await page.goto('/components/ai-composer/');await page.addScriptTag({path:require.resolve('axe-core')});const trigger=page.locator('#ai-composer-demo [data-icen-ai-library]');await trigger.click();const panel=page.getByRole('dialog',{name:'添加上下文与命令'});await panel.getByRole('option',{name:/界面设计/}).click();
  for(const preset of ['modern','dongyun','jugou','piano','monet','vangogh'])for(const dark of [false,true]){
    await page.locator('html').evaluate((el,{preset,dark})=>{el.dataset.icenPreset=preset;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme')},{preset,dark});
    const issues=await panel.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));const r=await (window as any).axe.run(el,{runOnly:{type:'rule',values:['color-contrast']}});return r.violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)}))});expect(issues,`${preset}/${dark?'dark':'light'}`).toEqual([]);
  }
});
