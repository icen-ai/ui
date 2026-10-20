import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('homepage, header and component instances share all three axes through navigation and reload', async ({page}) => {
  const errors:string[]=[]; page.on('pageerror',(e)=>errors.push(e.message));
  await page.goto('/');
  await page.locator('.presets-sec [data-icen-value="monet"]').click();
  await expect(page.locator('#appearance-select .icen-theme-switcher-name')).toHaveText('莫奈');
  await page.locator('#appearance-select button').first().click();
  await page.locator('[role="dialog"]:visible [data-icen-value="piano"]').click();
  await expect(page.locator('.presets-sec [data-icen-value="piano"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.presets-sec [data-icen-value="monet"]')).toHaveAttribute('aria-pressed','false');
  await page.goto('/components/theme-switcher/');
  const settings=page.locator('.demo-stage [data-icen-layout="inline"]');
  await settings.locator('[data-icen-value="vangogh"]').click();
  await expect(page.locator('#appearance-select .icen-theme-switcher-name')).toHaveText('梵高');
  await settings.locator('[data-icen-value="pixel"]').click();
  /* 顶导外观控件是 kind=all：触发器名字位显示当前配色预设，原语切换不改变它——
     断言落在 html 属性与面板选中态上 */
  await expect(page.locator('#appearance-select .icen-theme-switcher-name')).toHaveText('梵高');
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel');
  await settings.locator('[data-icen-value="dark"]').click();
  await expect(page.locator('#dark-toggle button')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('html')).toHaveAttribute('data-icen-theme','dark');
  await page.locator('.nav-links a[href="/tokens/"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','vangogh');
  await page.goBack();
  /* popstate 恢复 = 网络取页 + ClientRouter 换页，并行套件下静态伺服可能排队——给足等待 */
  await expect(page.locator('#appearance-select .icen-theme-switcher-name')).toHaveText('梵高',{timeout:15000});
  /* popstate 恢复三轴都要断言：配色名之外，原语轴也必须在换页后复原 */
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel',{timeout:15000});
  await expect(settings.locator('[data-icen-value="dark"]')).toHaveAttribute('aria-pressed','true',{timeout:15000});
  await page.reload();
  await expect(settings.locator('[data-icen-value="vangogh"]')).toHaveAttribute('aria-pressed','true');
  expect(errors).toEqual([]);
});

test('portalled appearance menus support keyboard, focus return, view constraints and all palettes',async ({page})=>{
  await page.goto('/components/theme-switcher/');
  const trigger=page.locator('.demo-stage [data-icen-display="icon"] .icen-theme-switcher-trigger').first();
  await trigger.focus(); await page.keyboard.press('ArrowDown');
  const dialog=page.locator('[role="dialog"]:visible');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-icen-value="light"]').first()).toBeFocused();
  await page.keyboard.press('End'); await expect(dialog.locator('[data-icen-value="pixel"]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.locator('button').first()).toBeFocused();
  await dialog.locator('[data-icen-value="monet"]').click();
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAccessibleName('外观：莫奈');
  await dialog.locator('[data-icen-value="dark"]').click();
  await page.screenshot({path:'test-results/switcher-dark-menu.png',fullPage:false});
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await expect(dialog).toBeHidden();
  await page.screenshot({path:'test-results/switcher-dark.png',fullPage:true});
});

test('changes synchronize across tabs', async ({context})=>{
  const first=await context.newPage(),second=await context.newPage();
  await first.goto('/components/theme-switcher/'); await second.goto('/components/theme-switcher/');
  await first.locator('.demo-stage [data-icen-layout="inline"] [data-icen-value="vangogh"]').click();
  await expect(second.locator('#appearance-select .icen-theme-switcher-name')).toHaveText('梵高');
  await second.locator('#dark-toggle button').click();
  await expect(first.locator('#dark-toggle button')).toHaveAttribute('aria-pressed','true');
});

test('light/dark, pixel and mobile RTL are accessible and do not overflow', async({page})=>{
  await page.goto('/components/theme-switcher/');
  await page.addScriptTag({path:require.resolve('axe-core')});
  for (const dark of [false,true]) {
    if(dark) await page.locator('#dark-toggle button').click();
    const violations=await page.evaluate(async()=>{
      const result=await (window as any).axe.run(document.querySelector('.demo-stage'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
      return result.violations.filter((v:any)=>['serious','critical'].includes(v.impact)).map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>n.target)}));
    });
    expect(violations).toEqual([]);
  }
  await page.locator('#dark-toggle button').click();
  await page.screenshot({path:'test-results/switcher-light.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('html').evaluate((root)=>root.dir='rtl');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#appearance-select button').first().click();
  const bounds=await page.locator('[role="dialog"]:visible').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await page.locator('.demo-stage [data-icen-layout="inline"] [data-icen-value="pixel"]').click();
  await page.screenshot({path:'test-results/switcher-mobile-pixel.png',fullPage:true});
});
