import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('tag editing keeps nodes and keyboard focus, explains rejected drafts and submits native values', async ({page}) => {
  for (const primitive of ['modern','pixel']) for (const dark of [false,true]) {
    await page.goto('/components/tag-input/'); await page.locator('html').evaluate((el,{primitive,dark}) => {el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme');},{primitive,dark});
    const root=page.locator('#tags-topics'), field=page.locator('#tags-topics-field');
    await root.locator('.icen-tag-chip').first().evaluate(el => (window as any).firstTag=el);
    await field.fill('动效'); await field.press('Enter'); await expect(root.locator('.icen-tag-chip')).toHaveCount(3);
    expect(await root.locator('.icen-tag-chip').first().evaluate(el => el === (window as any).firstTag)).toBe(true);
    await page.getByRole('button',{name:'保存主题',exact:true}).click(); await expect(page.locator('#tags-form-result')).toHaveText('已保存主题：界面设计、排版、动效。');
    await field.focus(); await field.press('ArrowLeft'); const action=root.getByRole('button',{name:'移除 动效'}); await expect(action).toBeFocused(); await action.press('Delete');
    await expect(root.getByRole('button',{name:'移除 排版'})).toBeFocused(); await page.keyboard.press('Escape'); await expect(field).toBeFocused();
    await field.fill('排版'); await field.press('Enter'); await expect(field).toHaveValue('排版'); await expect(field).toHaveAttribute('aria-invalid','true'); await expect(root.locator('+ [role=status]')).toContainText('已有');
    await field.fill('摄影，光影，材质，动效'); await field.press('Enter'); await expect(root.locator('.icen-tag-chip')).toHaveCount(5); await expect(field).toHaveValue('动效'); await expect(root.locator('+ [role=status]')).toContainText('最多 5');
    await page.getByRole('button',{name:'恢复初始主题'}).click(); await expect(root.locator('.icen-tag-chip')).toHaveCount(2); await expect(field).toHaveValue(''); await expect(page.locator('#tags-form-result')).toHaveText('已恢复最初的作品主题。');
  }
});

test('paste, IME, required forms and read-only transitions preserve real native editing', async ({page}) => {
  await page.goto('/components/tag-input/'); const root=page.locator('#tags-topics'), field=page.locator('#tags-topics-field');
  await field.evaluate(el => {const transfer=new DataTransfer();transfer.setData('text','摄影,动效\n艺术指导');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));});
  await expect(root.locator('.icen-tag-chip')).toHaveCount(5); await page.getByRole('button',{name:'恢复初始主题'}).click(); await expect(root.locator('.icen-tag-chip')).toHaveCount(2);
  await field.dispatchEvent('compositionstart'); await field.fill('中文'); await field.press('Enter'); await expect(root.locator('.icen-tag-chip')).toHaveCount(2);
  await field.dispatchEvent('compositionend'); await field.press('Enter'); await expect(root.locator('.icen-tag-chip')).toHaveCount(3);
  const review=page.locator('#tags-review-field'); await expect(review).toHaveAttribute('readonly',''); await page.getByRole('button',{name:'编辑审阅范围',exact:true}).click(); await expect(review).toBeFocused(); await expect(review).not.toHaveAttribute('readonly');
  await review.fill('信息架构'); await review.press('Enter'); await expect(page.locator('#tags-review .icen-tag-chip')).toHaveCount(3);
  await page.getByRole('button',{name:'完成编辑',exact:true}).click(); await expect(page.locator('#tags-review .icen-tag-chip-x:visible')).toHaveCount(0); await expect(page.locator('#tags-locked-field')).toBeDisabled();
  await root.evaluate(el => el.setAttribute('data-icen-tags','')); await expect(root.locator('.icen-tag-chip')).toHaveCount(0); await expect(field).toHaveAttribute('required','');
  expect(await field.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(false); await field.fill('新主题'); await page.getByRole('button',{name:'保存主题',exact:true}).click(); await expect(page.locator('#tags-form-result')).toHaveText('已保存主题：新主题。');
});

for (const preset of ['modern','dongyun','jugou','piano','monet','vangogh']) test(`tag sizes and error feedback stay readable in ${preset}`, async ({page}) => {
  await page.goto('/components/tag-input/'); await page.addScriptTag({path:require.resolve('axe-core')});
  for (const primitive of ['modern','pixel']) for (const dark of [false,true]) {
    await page.locator('html').evaluate((el,{preset,primitive,dark}) => {el.dataset.icenPreset=preset;el.dataset.icenStyle=primitive;dark ? el.dataset.icenTheme='dark' : el.removeAttribute('data-icen-theme');},{preset,primitive,dark});
    const field=page.locator('#tags-topics-field'); await field.fill('界面设计'); await field.press('Enter'); await page.waitForTimeout(400);
    const issues=await page.locator('.demo-stage').evaluate(async root => {const result=await (window as any).axe.run(root,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.filter((v:any) => ['serious','critical'].includes(v.impact)).map((v:any) => ({id:v.id,targets:v.nodes.map((n:any) => n.target)}));});
    expect(issues).toEqual([]);
    await expect(page.locator('#tags-topics .icen-tag-chip-x svg').first()).toHaveAttribute('viewBox','0 0 20 20');
  }
  if(preset==='modern')await page.locator('.demo-stage').screenshot({path:'.ui-audit/tags-desktop.png',animations:'disabled'});
});

test('touch RTL removal keeps the draft, uses generous stable slots and never scrolls the document sideways', async ({browser}) => {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try {const page=await context.newPage(); await page.goto('/components/tag-input/'); await page.locator('html').evaluate(el => {el.dir='rtl';el.dataset.icenStyle='pixel';el.dataset.icenTheme='dark';});
    const root=page.locator('#tags-topics'), field=page.locator('#tags-topics-field'); await field.fill('尚未提交的草稿');
    const action=root.locator('.icen-tag-chip-x').first(); const box=(await action.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);await expect(action).toHaveCSS('opacity','1');
    await action.tap(); await expect(root.locator('.icen-tag-chip')).toHaveCount(1);await expect(field).toHaveValue('尚未提交的草稿');await expect(field).toBeFocused();
    await expect(root.locator('.icen-tag-chip')).toHaveCSS('animation-name','none'); expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('.demo-stage').screenshot({path:'.ui-audit/tags-mobile-rtl.png',animations:'disabled'});
    await root.evaluate(el => el.setAttribute('data-icen-tags',JSON.stringify(['很长的双向设计说明 Design '.repeat(60)])));
    const label=root.locator('.icen-tag-chip-label'); await expect(label).toContainText('Design');
    expect(await label.evaluate(el => el.scrollWidth>el.clientWidth)).toBe(true);expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const longChip=(await root.locator('.icen-tag-chip').boundingBox())!, longAction=(await root.locator('.icen-tag-chip-x').boundingBox())!;
    expect(longAction.x).toBeGreaterThanOrEqual(longChip.x);expect(longAction.x+longAction.width).toBeLessThanOrEqual(longChip.x+longChip.width+1);
    await page.emulateMedia({forcedColors:'active'});const remaining=root.locator('.icen-tag-chip-x');await remaining.focus();await expect(remaining).toHaveCSS('outline-style','solid');
  }finally{await context.close();}
});

test('tag documents dispose and re-enter without stale fields, feedback or duplicate initialization', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/components/tag-input/');
  await page.locator('#tags-topics-field').fill('临时');await page.locator('#tags-topics-field').press('Enter');await page.locator('.doc-pager-next').click();
  await expect(page.locator('.icen-tag-input-feedback')).toHaveCount(0);await page.locator('a[href="/components/tag-input/"]:visible').first().click();
  await expect(page.locator('.demo-stage .icen-tag-input-feedback')).toHaveCount(4);await expect(page.locator('#tags-topics .icen-tag-chip')).toHaveCount(2);await expect(page.locator('#tags-review-field')).toHaveAttribute('readonly','');
  expect(errors).toEqual([]);
});
