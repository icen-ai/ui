import {test,expect,type Page,type Locator} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
async function popup(page:Page,input:Locator){return page.locator('#'+await input.getAttribute('aria-controls')).locator('..');}
async function issues(page:Page,selector:string){await page.addScriptTag({path:require.resolve('axe-core')});return page.evaluate(async(selector)=>{const roots=[document.querySelector('.demo-stage'),document.querySelector(selector)].filter(Boolean);const r=await (window as any).axe.run(roots,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.filter((v:any)=>['serious','critical'].includes(v.impact)).map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>n.target)}));},selector);}

test('project suggestions retain native editing, strict commits and free text across primitives and modes',async({page})=>{
  for(const primitive of ['benzhen','pixel'])for(const dark of [false,true]){
    await page.goto('/components/autocomplete/');await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;el.dataset.icenTheme=dark?'dark':'light';},{primitive,dark});
    const input=page.locator('#demo-autocomplete-input'),panel=await popup(page,input);await input.fill('海');await expect(panel.getByRole('option')).toHaveText('海边的房间');
    await expect(panel.locator('mark')).toHaveText('海');await input.press('Enter');await expect(input).toHaveValue('海边的房间');await expect(page.locator('#autocomplete-log')).toHaveText('已选择：海边的房间');
    await input.fill('不存在的项目');await expect(panel.locator('.icen-autocomplete-empty')).toBeVisible();await input.press('Escape');await expect(input).toHaveValue('海边的房间');
    const free=page.locator('#demo-autocomplete-free');await free.fill('摄影');await page.locator('label[for="demo-autocomplete-input"]').click();await expect(free).toHaveValue('摄影');await expect(page.locator('#autocomplete-free-log')).toHaveText('当前分类：摄影');
  }
});

test('async autocomplete exposes stable SVG loading, real retry and cancellation through blur and route changes',async({page})=>{
  const errors:string[]=[];page.on('pageerror',(error)=>errors.push(error.message));await page.goto('/components/autocomplete/');
  const input=page.locator('#demo-autocomplete-async'),panel=await popup(page,input);await page.locator('#autocomplete-fail').click();await input.fill('林');
  await expect(input).toHaveAttribute('aria-busy','true');await expect(panel.locator('.icen-suggestion-symbol svg')).toHaveAttribute('viewBox','0 0 20 20');
  const field=(await input.locator('..').boundingBox())!,bounds=(await panel.boundingBox())!;expect(Math.abs(field.x-bounds.x)).toBeLessThan(1);expect(Math.abs(field.width-bounds.width)).toBeLessThan(1);
  await page.screenshot({path:'.ui-audit/autocomplete-loading.png',animations:'disabled'});await expect(panel.getByRole('button',{name:'重试'})).toBeVisible();await expect(panel.getByRole('option')).toHaveCount(0);
  await input.press('Tab');await expect(panel.getByRole('button',{name:'重试'})).toBeFocused();await page.screenshot({path:'.ui-audit/autocomplete-retry.png',animations:'disabled'});
  await page.keyboard.press('Enter');await expect(input).toBeFocused();await expect(panel.getByRole('option')).toContainText('林晚晴');await input.press('Enter');await expect(input).toHaveValue('林晚晴');
  await input.fill('沈');await expect(input).toHaveAttribute('aria-busy','true');await page.locator('#demo-autocomplete-free').click();await expect(panel).toBeHidden();await page.waitForTimeout(850);await expect(panel).toBeHidden();
  await input.fill('ali');await expect(input).toHaveAttribute('aria-busy','true');await page.locator('a[href="/components/mentions/"]:visible').first().click();await expect(page.locator('.icen-autocomplete-panel')).toHaveCount(0);
  await page.waitForTimeout(700);expect(errors).toEqual([]);
});

test('mentions keep the textarea native, skip disabled people, insert input and prune whole names',async({page})=>{
  for(const primitive of ['benzhen','pixel'])for(const dark of [false,true]){
    await page.goto('/components/mentions/');await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;el.dataset.icenTheme=dark?'dark':'light';},{primitive,dark});
    const input=page.locator('#mentions-text'),panel=await popup(page,input);await input.fill('@ali');await expect(input).not.toHaveAttribute('aria-expanded');
    await input.press('ArrowDown');await input.press('Enter');await expect(input).toHaveValue('@Alina ');await expect(page.locator('#mentions-log')).toHaveText('当前提及：@Alina');
    await input.fill('@Alina 与 @');await expect(panel.getByRole('option',{name:/Carol/})).toHaveAttribute('aria-disabled','true');
    for(let i=0;i<4;i++)await input.press('ArrowDown');await input.press('Enter');await expect(input).toHaveValue('@Alina 与 @林晚晴 ');
    await input.fill('@Alina2 ');await expect(page.locator('#mentions-log')).toHaveText('还没有选择成员。');
    await input.fill('@ali');expect(await issues(page,'.icen-mentions-panel:not([hidden])')).toEqual([]);
  }
});

test('touch RTL suggestions preserve focus through retry and selection, with readable states and reduced motion',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try{
    const page=await context.newPage();
    for(const kind of ['autocomplete','mentions']){
      await page.goto('/components/'+kind+'/');await page.locator('html').evaluate((el)=>el.dir='rtl');const input=page.locator(kind === 'autocomplete' ? '#demo-autocomplete-async' : '#mentions-async-text'),panel=await popup(page,input);
      await page.locator(kind === 'autocomplete' ? '#autocomplete-fail' : '#mentions-fail').tap();await input.fill(kind === 'autocomplete' ? '林' : '@林');
      await expect(panel.locator('.icen-suggestion-symbol svg')).toHaveCSS('animation-name','none');const retry=panel.getByRole('button',{name:'重试'});await expect(retry).toBeVisible();const hit=(await retry.boundingBox())!;expect(hit.height).toBeGreaterThanOrEqual(44);expect(hit.width).toBeGreaterThanOrEqual(44);
      await retry.tap();await expect(input).toBeFocused();const item=panel.getByRole('option').first();await expect(item).toBeVisible();expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await issues(page,kind === 'autocomplete' ? '.icen-autocomplete-panel:not([hidden])' : '.icen-mentions-panel:not([hidden])')).toEqual([]);
      await page.screenshot({path:'.ui-audit/'+kind+'-mobile-rtl.png',animations:'disabled'});await item.tap();await expect(input).toBeFocused();await expect(input).toHaveValue(kind === 'autocomplete' ? '林晚晴' : '@林晚晴 ');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }finally{await context.close();}
});

test('long candidate navigation scrolls only its popup and restores author state after SPA re-entry',async({page})=>{
  await page.goto('/components/autocomplete/');const input=page.locator('#demo-autocomplete-input');await input.evaluate((el)=>el.setAttribute('data-icen-panel-max-height','95'));
  await input.press('ArrowDown');const panel=await popup(page,input);await input.press('ArrowUp');const row=panel.locator('.is-active');await expect(row).toHaveText('色彩研究');expect(await panel.evaluate((el)=>el.scrollTop)).toBeGreaterThan(0);
  const a=(await row.boundingBox())!,b=(await panel.boundingBox())!;expect(a.y+a.height).toBeLessThanOrEqual(b.y+b.height+1);expect(await page.evaluate(()=>scrollY)).toBe(0);
  await page.locator('a[href="/components/mentions/"]:visible').first().click();await page.locator('a[href="/components/autocomplete/"]:visible').first().click();await expect(page.locator('.icen-autocomplete-panel')).toHaveCount(3);
  await page.locator('#demo-autocomplete-input').fill('本真');await expect(page.locator('.icen-autocomplete-panel:visible').getByRole('option')).toHaveCount(1);
});
