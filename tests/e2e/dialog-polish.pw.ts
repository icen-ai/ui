import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('dialogs share SVG actions and native focus cycling across primitives, modes and sizes',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]) {
    await page.goto('/components/modal/');
    await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme');},{primitive,dark});
    for(const id of ['demo-modal-sm','demo-modal-md','demo-modal-lg']) {
      const trigger=page.locator(`[data-icen-modal-open="${id}"]`);await trigger.press('Enter');
      const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
      const close=dialog.locator('.icen-modal-close');
      await expect(id === 'demo-modal-md' ? dialog.getByLabel('工作区名称') : close).toBeFocused();
      await expect(close.locator('svg')).toHaveAttribute('viewBox','0 0 20 20');await close.focus();
      await close.press('Shift+Tab');const last=dialog.locator('.icen-modal-footer button').last();await expect(last).toBeFocused();
      await last.press('Tab');await expect(close).toBeFocused();
      await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
    }
  }
});

test('dialog dismissal retires visually, reverses on rapid reopen and returns the portal to its source',async({page})=>{
  await page.goto('/components/modal/');const trigger=page.locator('[data-icen-modal-open="demo-modal-md"]');await trigger.click();
  const backdrop=page.locator('[data-icen-modal="demo-modal-md"]');await expect(backdrop).toHaveCSS('opacity','1');
  const retiring=await backdrop.evaluate((el)=>{
    (el.querySelector('.icen-modal-close') as HTMLButtonElement).click();
    return {hidden:el.hasAttribute('hidden'),inert:(el as HTMLElement).inert,display:getComputedStyle(el).display};
  });expect(retiring.hidden).toBe(true);expect(retiring.inert).toBe(true);expect(retiring.display).not.toBe('none');
  await trigger.press('Enter');await expect(page.getByRole('dialog',{name:'保存工作区'})).toBeVisible();
  await page.keyboard.press('Escape');await expect.poll(()=>backdrop.evaluate((el)=>Boolean(el.closest('.demo-stage')))).toBe(true);
  await expect(page.locator('body')).not.toHaveCSS('overflow','hidden');
});

test('save action works and leaving a live modal restores scroll lock and removes portalled content',async({page})=>{
  await page.goto('/components/modal/');await page.locator('[data-icen-modal-open="demo-modal-md"]').click();
  await page.getByLabel('工作区名称').fill('研究工作区');await page.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('.icen-toast-msg')).toHaveText('已保存「研究工作区」（演示）');
  await page.locator('[data-icen-modal-open="demo-sheet-right"]').click();
  await page.locator('.doc-pager-next').evaluate((el)=>(el as HTMLAnchorElement).click());
  await expect(page).toHaveURL(/\/dropdown\//);await expect(page.locator('.icen-modal-backdrop')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow','hidden');
});

test('mobile large sheet stays in the viewport, close is 44px and reduced motion is immediate',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:700},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try {
    const page=await context.newPage();await page.goto('/components/modal/');
    await page.locator('.icen-modal--sheet-right').evaluate((el)=>el.classList.add('icen-modal--lg'));
    await page.locator('[data-icen-modal-open="demo-sheet-right"]').tap();
    const dialog=page.getByRole('dialog'),box=(await dialog.boundingBox())!,close=dialog.locator('.icen-modal-close'),hit=(await close.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);expect(box.height).toBeLessThanOrEqual(700);
    expect(hit.width).toBeGreaterThanOrEqual(44);expect(hit.height).toBeGreaterThanOrEqual(44);
    await close.tap();await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await context.close();}
});

test('interactive popover focuses its field and returns focus after Escape or apply',async({page})=>{
  await page.goto('/components/popover/');const trigger=page.locator('[data-icen-popover-target="popover-demo-panel"]');await trigger.click();
  const input=page.locator('#popover-demo-input');await expect(input).toBeFocused();await input.press('Escape');await expect(trigger).toBeFocused();
  await trigger.click();await input.fill('材质');await page.locator('#popover-demo-apply').click();await expect(trigger).toBeFocused();
});

test('dialog has no serious accessibility violations and quiet toast/notification close actions remain keyboard-accessible',async({page})=>{
  await page.goto('/components/modal/');await page.locator('[data-icen-modal-open="demo-modal-md"]').click();
  await page.addScriptTag({path:require.resolve('axe-core')});
  const issues=await page.getByRole('dialog').evaluate(async(root)=>{
    const report=await (window as any).axe.run(root,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return report.violations.filter((issue:any)=>['serious','critical'].includes(issue.impact)).map((issue:any)=>({id:issue.id,nodes:issue.nodes.map((node:any)=>node.target)}));
  });expect(issues).toEqual([]);await page.screenshot({path:'.ui-audit/dialog-open.png'});
  await page.goto('/components/toast/');await page.locator('#toast-demo-close').click();const toast=page.locator('.icen-toast');
  const close=toast.getByRole('button',{name:'关闭'});await close.focus();await expect(close).toHaveCSS('opacity','1');await expect(close.locator('svg')).toHaveAttribute('viewBox','0 0 20 20');
  await close.press('Enter');await expect(toast).toHaveCount(0);await expect(page.locator('#toast-demo-close')).toBeFocused();
  await page.goto('/components/notification/');await page.locator('#notif-info').click();const notice=page.locator('.icen-notification').first(),dismiss=notice.getByRole('button',{name:'关闭'});
  await dismiss.focus();await expect(dismiss).toHaveCSS('opacity','1');await expect(dismiss.locator('svg')).toHaveAttribute('viewBox','0 0 20 20');await dismiss.press('Enter');await expect(notice).toHaveCount(0);await expect(page.locator('#notif-info')).toBeFocused();
  await page.locator('#notif-progress').click();await expect(page.locator('.icen-notification')).toHaveCount(1);
  await page.locator('.doc-pager-next').click();await expect(page.locator('.icen-notification')).toHaveCount(0);
});
