import { test, expect } from '@playwright/test';

test('input examples bind native controls and panel examples do not require custom click wiring',async({page})=>{
  const errors:string[]=[];page.on('pageerror',(error)=>errors.push(error.message));
  await page.goto('/components/input/');
  const password=page.locator('.demo-stage input[type="password"]').first();
  await password.locator('..').getByRole('button',{name:'显示密码'}).click();
  await expect(page.getByRole('button',{name:'隐藏密码'})).toBeVisible();
  await expect(password).toHaveCount(0);
  await page.goto('/components/panel/');
  const toggle=page.locator('.demo-stage .icen-panel-toggle');
  await toggle.focus();await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await page.keyboard.press('Space');await expect(toggle).toHaveAttribute('aria-expanded','true');
  expect(errors).toEqual([]);
});

test('cascader maintains aligned action slots and expands columns without scrolling the document',async({page})=>{
  await page.goto('/components/cascader/');
  const trigger=page.locator('.icen-cascader-trigger').first();
  await trigger.scrollIntoViewIfNeeded(); const scroll=await page.evaluate(()=>scrollY);
  await trigger.click();
  await page.getByRole('option',{name:'浙江',exact:true}).click();
  await page.getByRole('option',{name:'杭州',exact:true}).click();
  expect(Math.abs((await page.evaluate(()=>scrollY))-scroll)).toBeLessThan(2);
  const panel=page.locator('.icen-cascader-panel');
  await expect(panel.locator('.icen-cascader-col')).toHaveCount(3);
  expect((await panel.boundingBox())!.width).toBeGreaterThan(440);
  await page.getByRole('option',{name:'西湖区',exact:true}).click();
  await page.locator('.icen-cascader').hover();
  await expect(page.locator('.icen-cascader-clear')).toHaveCSS('opacity','1');
  const centers=await page.locator('.icen-cascader').evaluate((el)=>['.icen-cascader-chevron','.icen-cascader-clear'].map((selector)=>{const r=el.querySelector(selector)!.getBoundingClientRect();return r.y+r.height/2;}));
  expect(Math.abs(centers[0]-centers[1])).toBeLessThan(1);
  await page.locator('.icen-cascader-clear').click();
  await expect(trigger).toContainText('请选择');
  await page.screenshot({path:'test-results/cascader-polished.png',fullPage:false});
});

test('all appearance icon shapes are real SVG and mode remains reachable without scrolling its menu',async({page})=>{
  await page.goto('/components/theme-switcher/');
  const trigger=page.locator('.demo-stage [data-icen-display="icon"] .icen-theme-switcher-trigger').first();
  await trigger.click();
  const panel=page.locator('[role="dialog"]:visible');
  await expect(panel.locator('[data-icen-value="dark"]')).toBeInViewport();
  expect(await page.locator('.icen-theme-switcher-chevron').first().evaluate((el)=>el.namespaceURI)).toBe('http://www.w3.org/2000/svg');
  await panel.locator('[data-icen-value="pixel"]').click();
  await panel.locator('[data-icen-value="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

test('clear actions remain discoverable to keyboard and touch; compact viewport keeps columns inside the screen',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();
  await page.goto('/components/cascader/');
  await page.locator('.icen-cascader-trigger').click();
  await page.getByRole('option',{name:'浙江',exact:true}).click();
  await page.getByRole('option',{name:'杭州',exact:true}).click();
  const rect=(await page.locator('.icen-cascader-panel').boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(390);
  await page.getByRole('option',{name:'西湖区',exact:true}).click();
  await expect(page.locator('.icen-cascader-clear')).toBeVisible();
  expect((await page.locator('.icen-cascader-clear').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await context.close();
});
