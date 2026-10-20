import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('AI stop pauses pending work; retry keeps the response and next draft stable',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/components/ai-chat/');
  const messages=page.locator('#ai-chat-demo .icen-ai-chat-scroll'),field=page.locator('#ai-chat-composer textarea');
  const users=await messages.locator('.icen-ai-msg--user').count();
  await field.fill('梳理现代材料');await field.press('Enter');
  const response=messages.locator('.icen-ai-msg--assistant').last();await expect(response).toHaveClass(/is-streaming/);
  await response.evaluate(el=>(window as any).stableResponse=el);
  await field.fill('接着核对配色');await field.press('Enter');
  await expect(page.locator('#ai-chat-composer .icen-ai-composer-queue')).toBeVisible();
  await page.getByRole('button',{name:'停止生成',exact:true}).click();
  await expect(response.locator('.icen-ai-msg-meta')).toHaveText('已停止');
  await expect(response).not.toHaveClass(/is-streaming/);
  await page.waitForTimeout(400);await expect(messages.locator('.icen-ai-msg--user')).toHaveCount(users+1);
  await field.focus();await field.press('ArrowUp');await expect(field).toHaveValue('接着核对配色');
  await field.fill('还在编写的草稿');await response.getByRole('button',{name:'继续生成',exact:true}).click();
  await expect(field).toHaveValue('还在编写的草稿');
  await expect(response).not.toHaveClass(/is-streaming/,{timeout:8000});
  await expect(response.locator('.icen-ai-msg-meta')).toContainText('tok');
  expect(await response.evaluate(el=>el===(window as any).stableResponse)).toBe(true);
  await expect(messages.locator('.icen-ai-msg--user')).toHaveCount(users+1);expect(errors).toEqual([]);
});

test('AI failure is visible and retryable; navigation cancels the demo stream cleanly',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/components/ai-chat/');
  await page.locator('#ai-chat-fail-next').click();const field=page.locator('#ai-chat-composer textarea');
  await field.fill('演示恢复');await field.press('Enter');
  const response=page.locator('#ai-chat-demo .icen-ai-msg--assistant').last();
  await expect(response.locator('[role=status]')).toBeVisible();
  await expect(response).toHaveClass(/icen-ai-msg--error/);
  await field.fill('保留的下一条');await response.getByRole('button',{name:'继续生成',exact:true}).click();
  await expect(field).toHaveValue('保留的下一条');await expect(response).toHaveClass(/is-streaming/);
  await page.locator('.doc-pager-next').click();await expect(page).toHaveURL(/\/components\/ai-message\//);
  await page.waitForTimeout(800);expect(errors).toEqual([]);
  await page.goto('/components/ai-chat/');await field.fill('重新进入');await field.press('Enter');
  await expect(page.locator('#ai-chat-demo .icen-ai-msg--assistant').last()).not.toHaveClass(/is-streaming/,{timeout:8000});
  expect(errors).toEqual([]);
});

test('permission form retains selection, role and duration before submission in both primitives and modes',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]){
    await page.goto('/components/kb-access/');await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme')},{primitive,dark});
    const root=page.locator('#kb-access-demo');const open=root.locator('[data-icen-access-request]');await open.click();
    const field=root.locator('.icen-kb-access-reason');await expect(field).toBeFocused();
    await field.fill('为现代核对排版和材料');await field.evaluate(el=>(window as any).reasonNode=el);
    /* 时长选择器是弹层 icen-select：开面板 → 点选项，值落在 hidden input */
    await root.locator('.icen-kb-access-duration .icen-select-trigger').click();
    await page.locator('body > .icen-select-panel [data-icen-value="7"]').click();
    const duration=root.locator('.icen-kb-access-duration input[data-icen-select-value]');
    const editor=root.locator('[data-icen-role=editor]');await editor.focus();await editor.press('Space');
    await expect(editor).toBeFocused();await expect(editor).toHaveAttribute('aria-pressed','true');
    expect(await field.evaluate(el=>el===(window as any).reasonNode)).toBe(true);await expect(duration).toHaveValue('7');
    await open.click();await expect(field).toBeHidden();await open.click();await expect(field).toHaveValue('为现代核对排版和材料');
    await expect(duration).toHaveValue('7');await root.locator('[data-icen-access-submit]').click();
    await expect(root.locator('.icen-kb-access-state')).toBeFocused();await expect(open).toBeDisabled();await expect(root).toHaveAttribute('data-icen-state','requested');
    // A seven-day grant enters the existing seven-day expiry warning window.
    await page.locator('#kb-access-advance').click();await expect(root).toHaveAttribute('data-icen-state','expiring');
    await expect(root.locator('.icen-kb-access-countdown')).toContainText('天后');
  }
});

test('opened checkpoint choices stay readable and named in both primitives and modes',async({page})=>{
  await page.goto('/components/kb-checkpoint/');await page.addScriptTag({path:require.resolve('axe-core')});
  const trigger=page.locator('#kb-checkpoint-demo .icen-kb-checkpoint').first();
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]) {
    await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme')},{primitive,dark});
    await trigger.press('ArrowDown');const menu=page.locator('.icen-kb-checkpoint-menu');
    const issues=await menu.evaluate(async el=>{
      await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
      const result=await (window as any).axe.run(el,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
      return result.violations.filter((v:any)=>['serious','critical'].includes(v.impact)).map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)}));
    });
    expect(issues).toEqual([]);await expect(menu.locator('.icen-kb-checkpoint-menu-check')).toHaveCount(0);
    if(primitive==='modern'&&!dark)await menu.screenshot({path:'.ui-audit/workflow-checkpoint-menu.png'});
    await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  }
});

test('checkpoint menus fit touch RTL, share panel sizing, skip restricted scopes and return focus',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  try{const page=await context.newPage();await page.goto('/components/kb-checkpoint/');await page.locator('html').evaluate(el=>el.dir='rtl');
    const host=page.locator('#kb-checkpoint-demo');await host.evaluate(el=>el.setAttribute('data-icen-panel-width','300'));
    const trigger=host.locator('.icen-kb-checkpoint').first();await trigger.focus();await trigger.press('ArrowDown');
    const menu=page.locator('.icen-kb-checkpoint-menu');await expect(menu.locator('[data-icen-scope=content]')).toBeFocused();
    const rect=(await menu.boundingBox())!;expect(Math.abs(rect.width-300)).toBeLessThan(2);expect(rect.x).toBeGreaterThanOrEqual(8);expect(rect.x+rect.width).toBeLessThanOrEqual(382);
    await page.keyboard.press('End');await expect(menu.locator('[data-icen-scope=both]')).toBeFocused();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
    const restricted=host.locator('[data-icen-checkpoint-id=cp-2]');await restricted.press('ArrowDown');
    await page.keyboard.press('ArrowDown');await expect(menu.locator('[data-icen-scope=content]')).toBeFocused();
    await page.keyboard.press('Enter');await expect(restricted).toBeFocused();await expect(page.locator('#kb-checkpoint-log')).toContainText('scope=content');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await host.screenshot({path:'.ui-audit/workflow-checkpoints-rtl.png'});
  }finally{await context.close()}
});
