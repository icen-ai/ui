import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('short viewport scrolls the active day inside the calendar and supports opaque and forced-color surfaces',async({page})=>{
  await page.setViewportSize({width:390,height:320});await page.goto('/components/date-picker/');
  await page.locator('#date-publish').evaluate((el)=>{el.style.position='fixed';el.style.top='70px';el.style.left='12px';el.style.width='170px';el.closest<HTMLElement>('[data-icen-date-picker]')!.style.direction='rtl';});
  await page.locator('html').evaluate((el)=>el.dataset.icenTransparency='reduced');await page.locator('#date-publish').click();const panel=page.locator('.icen-date-picker-panel');
  await expect(panel).toHaveAttribute('dir','rtl');await expect(panel).toHaveCSS('backdrop-filter','none');
  await page.keyboard.press('ArrowLeft');await expect(panel.locator('[data-icen-date="2026-10-18"]')).toBeFocused();
  await page.keyboard.press('End');const day=panel.locator('.icen-date-picker-cell[tabindex="0"]'),dayBox=(await day.boundingBox())!,panelBox=(await panel.boundingBox())!;
  expect(dayBox.y+dayBox.height).toBeLessThanOrEqual(panelBox.y+panelBox.height+1);expect(panelBox.y+panelBox.height).toBeLessThanOrEqual(309);
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  await page.emulateMedia({forcedColors:'active'});await expect(panel.locator('.icen-date-picker-cell.is-selected')).toHaveCSS('forced-color-adjust','none');
  await page.keyboard.press('Escape');await expect(page.locator('#date-publish')).toBeFocused();
});

test('calendar keeps one date focus, supports full keyboard movement and resets the native form in every primitive/mode',async({page})=>{
  for(const primitive of ['modern','pixel'])for(const dark of [false,true]){
    await page.goto('/components/date-picker/');await page.locator('html').evaluate((el,{primitive,dark})=>{el.dataset.icenStyle=primitive;el.dataset.icenTheme=dark?'dark':'light';},{primitive,dark});
    const trigger=page.locator('#date-publish');await expect(trigger.locator('svg')).toHaveAttribute('viewBox','0 0 20 20');
    await trigger.focus();await trigger.press('ArrowDown');const panel=page.locator('.icen-date-picker-panel');
    await expect(panel.locator('[data-icen-date="2026-10-17"]')).toBeFocused();await expect(panel.locator('.icen-date-picker-cell[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('PageDown');await expect(panel.locator('[data-icen-date="2026-11-17"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();await expect(page.locator('input[name="发布日期"]')).toHaveValue('2026-11-18');
    await expect(page.locator('#date-feedback')).toHaveText('发布日期：2026-11-18');await page.locator('#date-reset').click();await expect(trigger).toContainText('2026-10-17');
  }
});

test('range, month buttons, clear, disabled state and native tab order behave as a single date field',async({page})=>{
  await page.goto('/components/date-picker/');await page.locator('#date-release').click();const panel=page.locator('.icen-date-picker-panel');
  await expect(panel.locator('.icen-date-picker-nav').first()).toBeDisabled();await expect(panel.locator('.icen-date-picker-nav').last()).toBeDisabled();
  await expect(panel.locator('[data-icen-date="2026-12-01"]')).toBeDisabled();await expect(panel.locator('[data-icen-date="2026-11-09"]')).toBeFocused();
  await panel.locator('.icen-date-picker-clear').click();await expect(page.locator('input[name="十一月排期"]')).toHaveValue('');await expect(page.locator('#date-release')).toBeFocused();
  await page.locator('#date-publish').click();await panel.locator('[data-icen-date-nav="next"]').click();await expect(panel.locator('[data-icen-date-nav="next"]')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#date-publish')).toBeFocused();
  await page.locator('#date-publish').click();await panel.locator('.icen-date-picker-clear').focus();await page.keyboard.press('Tab');await expect(panel).toHaveCount(0);await expect(page.locator('#date-release')).toBeFocused();
  await expect(page.locator('#date-locked')).toBeDisabled();
});

test('measured calendar flips at the viewport edge and its portal and listeners are released on navigation',async({page})=>{
  const errors:string[]=[];page.on('pageerror',(error)=>errors.push(error.message));await page.goto('/components/date-picker/');
  await page.locator('#date-publish').evaluate((el)=>{el.style.position='fixed';el.style.bottom='12px';el.style.right='12px';el.style.width='170px';});
  await page.locator('#date-publish').click();const panel=page.locator('.icen-date-picker-panel');await expect(panel).toHaveAttribute('data-icen-side','top');
  const box=(await panel.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(11);expect(box.x+box.width).toBeLessThanOrEqual(1440-11);expect(box.y).toBeGreaterThanOrEqual(11);expect(box.y+box.height).toBeLessThanOrEqual(900-11);
  await page.keyboard.press('Escape');await page.locator('#date-review').click();await page.keyboard.press('Escape');
  await page.locator('a[href="/components/input/"]:visible').first().click();await expect(panel).toHaveCount(0);
  await page.locator('a[href="/components/date-picker/"]:visible').first().click();await page.locator('#date-publish').click();await expect(panel).toHaveCount(1);
  expect(errors).toEqual([]);await page.screenshot({path:'.ui-audit/calendar-desktop.png',animations:'disabled'});
});

test('touch RTL calendar has usable targets, reduced motion and no serious accessibility violations',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try{
    const page=await context.newPage();await page.goto('/components/date-picker/');await page.locator('html').evaluate((el)=>el.dir='rtl');await page.locator('#date-publish').tap();const panel=page.locator('.icen-date-picker-panel');
    const button=panel.locator('[data-icen-date="2026-10-17"]'),box=(await button.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('ArrowLeft');await expect(panel.locator('[data-icen-date="2026-10-18"]')).toBeFocused();await expect(panel).toHaveCSS('animation-name','none');
    const bounds=(await panel.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(11);expect(bounds.x+bounds.width).toBeLessThanOrEqual(379);
    await page.addScriptTag({path:require.resolve('axe-core')});const issues=await panel.evaluate(async(el)=>{const r=await (window as any).axe.run(el,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.filter((v:any)=>['serious','critical'].includes(v.impact)).map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>n.target)}));});expect(issues).toEqual([]);
    await page.screenshot({path:'.ui-audit/calendar-mobile-rtl.png',animations:'disabled'});
    await panel.locator('[data-icen-date="2026-10-18"]').tap();await expect(page.locator('#date-feedback')).toHaveText('发布日期：2026-10-18');
  }finally{await context.close();}
});
