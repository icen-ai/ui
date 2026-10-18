import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {ICON_PATHS} from '../../src/behaviors/icons';
const require=createRequire(import.meta.url);

test('group disclosure keeps actions aligned and keyboard focus stable across primitives and modes',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]){
    await page.goto('/components/notification/');await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;el.dataset.icenTheme=dark?'dark':'light';},{primitive,dark});
    await page.locator('#notif-group').click();const latest=page.locator('#docs-review-2'),first=page.locator('#docs-review-0'),button=latest.locator('.icen-notification-group-toggle');
    await expect(first).toBeHidden();await expect(button).toHaveAttribute('aria-expanded','false');await expect(button).toHaveText('3 条同组通知，3 条未读');
    await expect(button.locator('svg')).toHaveAttribute('viewBox','0 0 20 20');await button.focus();await button.press('Enter');
    await expect(first).toBeVisible();await expect(button).toBeFocused();await expect(button).toHaveAttribute('aria-expanded','true');
    await first.getByRole('button',{name:'查看批注'}).click();await expect(page.locator('.icen-toast-msg')).toHaveText('已定位到这条批注');
    await button.focus();await button.press('Space');await expect(first).toBeHidden();await expect(button).toBeFocused();
    await page.locator('#notif-read').click();await expect(button).toHaveText('3 条同组通知');
    await latest.getByRole('button',{name:'关闭',exact:true}).click();await expect(latest).toHaveCount(0);await expect(page.locator('#docs-review-1')).toBeVisible();
    await expect(page.locator('.icen-notification-group-toggle')).toHaveText('2 条同组通知');
    await page.screenshot({path:'.ui-audit/notification-group-'+primitive+(dark?'-dark':'')+'.png'});
  }
});

test('group disclosure is usable on a touch RTL viewport with reduced motion and no serious accessibility issues',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try{
    const page=await context.newPage();await page.goto('/components/notification/');await page.locator('html').evaluate((el)=>el.dir='rtl');
    await page.locator('#notif-group').tap();const button=page.locator('.icen-notification-group-toggle');const box=(await button.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);
    await button.tap();await expect(page.locator('#docs-review-0')).toBeVisible();await expect(page.locator('#docs-review-0')).toHaveCSS('animation-name','none');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.addScriptTag({path:require.resolve('axe-core')});
    const issues=await page.locator('[data-icen-notif-default]').evaluate(async(el)=>{const result=await (window as any).axe.run(el,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.filter((issue:any)=>['serious','critical'].includes(issue.impact)).map((issue:any)=>issue.id);});
    expect(issues).toEqual([]);await page.screenshot({path:'.ui-audit/notification-group-mobile-rtl.png'});
  }finally{await context.close();}
});

test('saved notification survives unmount, unrelated activity, page navigation and reload until explicit dismissal',async({page})=>{
  const errors:string[]=[];page.on('pageerror',(error)=>errors.push(error.message));
  await page.goto('/components/notification/');await page.locator('#notif-save').click();
  const saved=page.locator('#docs-saved-export');await expect(saved).toHaveCount(1);
  await page.locator('#notif-unmount').click();await expect(saved).toHaveCount(0);
  await page.locator('#notif-info').click();await page.locator('#notif-restore').click();await expect(saved).toHaveCount(1);
  await page.locator('a[href="/components/copy/"]:visible').first().click();await expect(saved).toHaveCount(0);
  await page.locator('a[href="/components/notification/"]:visible').first().click();await page.locator('#notif-restore').click();await expect(saved).toHaveCount(1);
  await page.reload();await page.locator('#notif-restore').click();await expect(saved).toHaveCount(1);
  await saved.locator('.icen-notification-close').click();await expect(saved).toHaveCount(0);
  await page.locator('#notif-unmount').click();await page.locator('#notif-restore').click();
  await expect(page.locator('#notif-archive-status')).toHaveText('没有待恢复的提醒。');
  await page.locator('#notif-save').click();await page.locator('#notif-forget').click();await page.reload();
  await page.locator('#notif-restore').click();await expect(saved).toHaveCount(0);expect(errors).toEqual([]);
});

test('async toast has a stable SVG busy slot, inline retry and one successful continuation across primitives/modes',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]) {
    await page.goto('/components/toast/');
    await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;el.dataset.icenTheme=dark?'dark':'light';},{primitive,dark});
    await page.locator('#toast-demo-async').click();const row=page.locator('.icen-toast').filter({hasText:'已移到回收站'}),action=row.getByRole('button',{name:'撤销',exact:true});
    const before=(await action.boundingBox())!;await action.click();await expect(action).toHaveAttribute('aria-busy','true');
    await expect(action.locator('.icen-feedback-action-spinner svg')).toBeVisible();
    const busy=(await action.boundingBox())!;expect(busy.width).toBeCloseTo(before.width,1);expect(busy.height).toBeCloseTo(before.height,1);
    await expect(row.getByRole('alert')).toHaveText('撤销未完成，请重试。');await expect(action).not.toHaveAttribute('aria-busy');await expect(row).toBeVisible();
    await action.click();await expect(row).toHaveCount(0);await expect(page.locator('.icen-toast-msg')).toHaveText('已恢复「设计规范.md」');
  }
});

test('notification actions wait, expose retry feedback and keep the focused action available until success',async({page})=>{
  await page.goto('/components/notification/');await page.locator('#notif-async').click();
  const row=page.locator('.icen-notification'),action=row.getByRole('button',{name:'立即同步'});
  await action.focus();await action.press('Enter');await expect(action).toHaveAttribute('aria-busy','true');await expect(action).toBeFocused();
  await page.screenshot({path:'.ui-audit/notification-busy.png'});
  await expect(row.locator('.icen-feedback-error')).toHaveText('同步未完成，请重试。');await expect(action).toBeFocused();
  await page.screenshot({path:'.ui-audit/notification-retry.png'});
  await action.press('Enter');await expect(row).toHaveCount(0);await expect(page.locator('.icen-toast-msg')).toHaveText('更改已同步');
});

test('closing a pending operation cancels its continuation and navigation leaves no late feedback',async({page})=>{
  const errors:string[]=[];page.on('pageerror',(error)=>errors.push(error.message));
  await page.goto('/components/notification/');await page.locator('#notif-async').click();const row=page.locator('.icen-notification');
  await row.getByRole('button',{name:'立即同步'}).click();await row.getByRole('button',{name:'关闭',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(row).toHaveCount(0);await page.waitForTimeout(800);await expect(page.locator('.icen-toast')).toHaveCount(0);
  await page.locator('#notif-async').click();await page.locator('.icen-notification').getByRole('button',{name:'立即同步'}).click();
  await page.locator('.doc-pager-next').click();await page.waitForTimeout(800);
  await expect(page.locator('.icen-notification,.icen-toast')).toHaveCount(0);expect(errors).toEqual([]);
});

test('feedback status uses shared SVG geometry and progress changes from busy to a completed check',async({page})=>{
  await page.goto('/components/notification/');
  for(const [id,name] of [['notif-info','circle-info'],['notif-success','circle-check'],['notif-warn','triangle-alert'],['notif-error','circle-error']]) {
    await page.locator('#'+id).click();
    await expect(page.locator('.icen-notification').last().locator('.icen-notification-icon svg')).toHaveAttribute('viewBox','0 0 20 20');
    const path=page.locator('.icen-notification').filter({has:page.locator(`.icen-notification-icon path[d="${ICON_PATHS[name as keyof typeof ICON_PATHS]}"]`)});
    await expect(path).toHaveCount(1);
  }
  await page.locator('#notif-clear').click();await expect(page.locator('.icen-notification')).toHaveCount(0);
  await page.locator('#notif-progress').click();const row=page.locator('.icen-notification');
  await expect(row.locator('.icen-notification-icon path')).toHaveAttribute('d',ICON_PATHS.spinner);
  await expect(row).toHaveClass(/is-complete/,{timeout:6000});await expect(row.locator('.icen-notification-icon path')).toHaveAttribute('d',ICON_PATHS['circle-check']);
});

test('retry UI remains accessible on touch/RTL and in reduced motion',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try {
    const page=await context.newPage();await page.goto('/components/notification/');await page.locator('html').evaluate((el)=>el.dir='rtl');
    await page.locator('#notif-async').tap();const row=page.locator('.icen-notification'),action=row.getByRole('button',{name:'立即同步'});
    const box=(await action.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);
    await action.tap();await expect(action.locator('.icen-feedback-action-spinner svg')).toHaveCSS('animation-name','none');
    await expect(row.locator('.icen-feedback-error')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(row.locator('.icen-feedback-error bdi')).toHaveCSS('direction','ltr');
    await page.addScriptTag({path:require.resolve('axe-core')});
    const violations=await row.evaluate(async(root)=>{
      const result=await (window as any).axe.run(root,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
      return result.violations.filter((issue:any)=>['serious','critical'].includes(issue.impact)).map((issue:any)=>({id:issue.id,nodes:issue.nodes.map((node:any)=>node.target)}));
    });expect(violations).toEqual([]);await page.screenshot({path:'.ui-audit/notification-retry-mobile.png'});
  }finally{await context.close();}
});

test('body navigation and sibling action buttons are independently keyboard-operable',async({page})=>{
  await page.goto('/components/notification/');await page.locator('#notif-actions').click();const row=page.locator('.icen-notification');
  await row.getByRole('button',{name:'作品已保存',exact:true}).press('Enter');await expect(page.locator('.icen-toast-msg')).toHaveText('点击了通知体');
  await row.getByRole('button',{name:'继续编辑',exact:true}).press('Enter');await expect(row).toHaveCount(0);
  await expect(page.locator('.icen-toast-msg').last()).toHaveText('打开编辑器');
  await page.locator('#notif-link').click();await page.locator('.icen-notification').getByRole('link',{name:'打开主题工作室'}).click();
  await expect(page).toHaveURL(/\/modern\//);
});
