import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('published tokens preserve hidden semantics for flex/grid components and preserve until-found',async({page})=>{
  await page.goto('/components/select/');
  await page.setContent('<html><head></head><body>'+['icen-select-option','icen-cascader-cols','icen-tree-select-chips','icen-ai-msg-actions','icen-btn'].map((name)=>`<div class="${name}" hidden>Hidden</div>`).join('')+'<div class="icen-btn" hidden="until-found" id="findable">Findable</div></body></html>');
  for (const file of ['tokens.css','components/select.css','components/cascader.css','components/tree-select.css','components/ai-chat.css','components/btn.css']) await page.addStyleTag({content:readFileSync('dist/'+file,'utf8')});
  for (const primitive of ['modern','pixel']) for (const dark of [false,true]) {
    await page.locator('html').evaluate((root,{primitive,dark})=>{root.setAttribute('data-icen-style',primitive);dark ? root.setAttribute('data-icen-theme','dark') : root.removeAttribute('data-icen-theme');},{primitive,dark});
    for(const el of await page.locator('[hidden]:not([hidden="until-found"])').all()) await expect(el).toHaveCSS('display','none');
    await expect(page.locator('#findable')).not.toHaveCSS('display','none');
  }
});

test('search filters visually, keeps typing focus, announces results and supports two-stage Escape in every primitive/mode',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]) {
    await page.goto('/components/select/');
    await page.locator('html').evaluate((root,{primitive,dark})=>{root.setAttribute('data-icen-style',primitive);dark ? root.setAttribute('data-icen-theme','dark') : root.removeAttribute('data-icen-theme');},{primitive,dark});
    const trigger=page.locator('.demo-stage [data-icen-select-search] .icen-select-trigger');await trigger.click();
    const panel=page.locator('.icen-select-panel:not([hidden])'),search=panel.getByRole('combobox');
    await search.fill('州');
    const clear=panel.getByRole('button',{name:'清空搜索'});
    await expect(clear.locator('svg')).toBeVisible();
    await search.press('Tab');await expect(clear).toBeFocused();await clear.press('Enter');
    await expect(search).toHaveValue('');await expect(search).toBeFocused();
    await expect(clear).toBeHidden();await search.fill('州');
    await clear.click();await expect(search).toHaveValue('');await expect(search).toBeFocused();await search.fill('州');
    await expect(panel.getByRole('option')).toHaveCount(2);
    await expect(panel.locator('[data-icen-value="sh"]')).toBeHidden();
    const list=panel.getByRole('listbox');expect(await list.locator('input').count()).toBe(0);
    await search.press('ArrowDown');await expect(search).toBeFocused();
    await expect(search).toHaveAttribute('aria-activedescendant',await panel.locator('[data-icen-value="gz"]').getAttribute('id') as string);
    await search.press('Escape');await expect(search).toHaveValue('');await expect(panel).toBeVisible();
    await search.fill('no matching city');await expect(panel.getByRole('status')).toBeVisible();await expect(list).toBeHidden();
    await search.press('Escape');await search.press('Escape');await expect(trigger).toBeFocused();await expect(panel).toBeHidden();
    await trigger.click();await search.fill('州');await search.press('ArrowDown');await search.press('Enter');await expect(trigger).toContainText('广州');
  }
});

test('dynamic options use the real listbox and open search has no serious accessibility violations',async({page})=>{
  await page.goto('/components/select/');
  await page.locator('[data-icen-select-search] .icen-select-trigger').click();
  const panel=page.locator('.icen-select-panel:not([hidden])');
  await panel.evaluate((root)=>{const option=document.createElement('button');option.className='icen-select-option';option.dataset.icenValue='cd';option.textContent='成都';root.append(option);});
  await panel.getByRole('combobox').fill('成都');
  await expect(panel.getByRole('listbox').getByRole('option',{name:'成都'})).toBeVisible();
  await page.addScriptTag({path:require.resolve('axe-core')});
  const violations=await panel.evaluate(async(root)=>{
    const result=await (window as any).axe.run(root,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return result.violations.filter((issue:any)=>['critical','serious'].includes(issue.impact)).map((issue:any)=>({id:issue.id,nodes:issue.nodes.map((node:any)=>node.target)}));
  });expect(violations).toEqual([]);
  await page.screenshot({path:'.ui-audit/select-search-open.png',fullPage:false});
});

test('all sizes preserve their height with chips; keyboard selection and RTL use the same geometry',async({page})=>{
  await page.goto('/components/select/');
  const root=page.locator('.demo-stage [data-icen-select-multiple]'),trigger=root.locator('.icen-select-trigger');
  for(const size of ['sm','md','lg']) {
    await trigger.evaluate((button,size)=>{button.classList.remove('icen-select-trigger--sm','icen-select-trigger--lg');if(size!=='md')button.classList.add('icen-select-trigger--'+size);},size);
    await trigger.press('End');
    await expect(page.locator('.icen-select-option.is-focused')).toHaveText('Go');
    await page.keyboard.press('Home');await expect(page.locator('.icen-select-option.is-focused')).toHaveText('TypeScript');
    await page.keyboard.press('Enter');await page.keyboard.press('Escape');
    const expected=await root.evaluate((el,size)=>(()=>{const probe=document.createElement('div');probe.style.cssText='position:absolute;visibility:hidden;height:var(--icen-density-input-height-'+size+')';el.append(probe);const height=getComputedStyle(probe).height;probe.remove();return height;})(),size);
    await expect(trigger).toHaveCSS('height',expected);
    const chip=(await root.locator('.icen-select-chip').boundingBox())!,control=(await trigger.boundingBox())!;
    expect(chip.y).toBeGreaterThanOrEqual(control.y);expect(chip.y+chip.height).toBeLessThanOrEqual(control.y+control.height);
    await root.locator('.icen-select-chip-x').focus();await page.keyboard.press('Enter');
  }
  await page.locator('html').evaluate((el)=>el.dir='rtl');
  await trigger.press('r');await expect(page.locator('.icen-select-option.is-focused')).toHaveText('React');
  await page.keyboard.press('Enter');await page.keyboard.press('Escape');
  const control=(await trigger.boundingBox())!,chip=(await root.locator('.icen-select-chip').boundingBox())!;
  expect(chip.x).toBeGreaterThanOrEqual(control.x);expect(chip.x+chip.width).toBeLessThanOrEqual(control.x+control.width);
});

test('opening and choosing an authored select inside a form never submits the form',async({page})=>{
  await page.goto('/components/select/');
  const root=page.locator('.demo-stage [data-icen-select]').first();
  await root.evaluate((root)=>{
    const form=document.createElement('form');root.before(form);form.append(root);
    form.dataset.submits='0';form.addEventListener('submit',(event)=>{event.preventDefault();form.dataset.submits=String(Number(form.dataset.submits)+1);});
  });
  await root.locator('.icen-select-trigger').click();
  await page.locator('.icen-select-panel:visible').getByRole('option').first().click();
  await expect(root.locator('..')).toHaveAttribute('data-submits','0');
});

test('a long searchable list scrolls internally and keeps the active result below its sticky search field',async({page})=>{
  await page.goto('/components/select/');
  const trigger=page.locator('[data-icen-select-search] .icen-select-trigger');await trigger.click();
  const panel=page.locator('.icen-select-panel:not([hidden])');
  await panel.evaluate((panel)=>{
    const list=panel.querySelector('[data-icen-select-options]')!;list.replaceChildren();
    for(let i=0;i<30;i++){const option=document.createElement('button');option.className='icen-select-option';option.dataset.icenValue=String(i);option.textContent='选项 '+i;list.append(option);}
  });
  const search=panel.getByRole('combobox');await search.fill('选项');const scroll=await page.evaluate(()=>scrollY);
  for(let i=0;i<20;i++)await search.press('ArrowDown');
  expect(await panel.evaluate((el)=>el.scrollTop)).toBeGreaterThan(0);
  for(let i=0;i<20;i++)await search.press('ArrowUp');
  const active=panel.locator('.is-focused'),bounds=(await active.boundingBox())!,searchBounds=(await panel.locator('.icen-select-search').boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(searchBounds.y+searchBounds.height-1);
  expect(Math.abs((await page.evaluate(()=>scrollY))-scroll)).toBeLessThan(2);
});
