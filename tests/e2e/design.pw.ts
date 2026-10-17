import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('published tokens + individual CSS share materials, density and brand overrides', async ({ page }) => {
  await page.goto('/benzhen/');
  // Test actual npm artifacts independently of the site's unlayered source CSS.
  await page.setContent('<html data-icen-preset="benzhen"><head></head><body><button class="icen-btn icen-btn-primary">保存</button><div data-icen-density="compact"><button class="icen-btn">紧凑</button><div data-icen-density="normal"><button class="icen-btn">标准</button></div></div><div data-icen-material="floating">菜单</div></body></html>');
  await page.addStyleTag({content:readFileSync('dist/tokens.css','utf8')});
  await page.addStyleTag({content:readFileSync('dist/base.css','utf8')});
  await page.addStyleTag({content:readFileSync('dist/components/btn.css','utf8')});
  await expect(page.getByRole('button',{name:'保存'})).toHaveCSS('height','40px');
  await expect(page.getByRole('button',{name:'紧凑'})).toHaveCSS('height','34px');
  await expect(page.getByRole('button',{name:'标准'})).toHaveCSS('height','40px');
  await expect(page.getByRole('button',{name:'紧凑'})).toHaveCSS('font-size','14px');
  await expect(page.getByRole('button',{name:'保存'})).toHaveCSS('background-color','rgb(0, 98, 204)');
  await page.locator('html').evaluate((el)=>el.setAttribute('data-icen-theme','dark'));
  await expect(page.getByRole('button',{name:'保存'})).toHaveCSS('background-color','rgb(145, 191, 255)');
  await page.addStyleTag({content:':root[data-icen-preset="other"]{--icen-design-accent:#225588;--icen-design-accent-strong:#225588;--icen-design-accent-text:#225588;--icen-design-radius:14px}'});
  await page.locator('html').evaluate((el)=>el.setAttribute('data-icen-preset','other'));
  await expect(page.getByRole('button',{name:'保存'})).toHaveCSS('background-color','rgb(34, 85, 136)');
  await expect(page.getByRole('button',{name:'保存'})).toHaveCSS('border-radius','14px');
  await page.locator('html').evaluate((el)=>el.setAttribute('data-icen-transparency','reduced'));
  await expect(page.locator('[data-icen-material="floating"]')).toHaveCSS('backdrop-filter','none');
});

test('workbench interactions, portalled menu and dialog keep the same design', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror',(error)=>errors.push(error.message));
  await page.goto('/benzhen/');
  await page.getByRole('button',{name:'保存更改'}).click();
  await expect(page.locator('#save-status')).toContainText('已保存');
  await page.getByRole('switch').click();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','false');
  await page.getByRole('button',{name:'更多操作'}).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem',{name:'新建笔记'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(page.getByRole('button',{name:'更多操作'})).toBeFocused();
  await page.getByRole('tab',{name:'知识工作台'}).click();
  await page.getByRole('button',{name:'新建笔记',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('border-radius','24px');
  await page.locator('#note-input').fill('材料测试');
  await page.getByRole('button',{name:'保存笔记'}).click();
  await expect(page.getByRole('cell',{name:'材料测试'})).toBeVisible();
  await page.getByRole('searchbox').fill('不存在的笔记');
  await expect(page.locator('#search-status')).toHaveText('0 份资料');
  await page.getByRole('tab',{name:'AI 对话'}).click();
  await page.locator('#chat-input').fill('保持安静');
  await page.getByRole('button',{name:'发送',exact:true}).click();
  await expect(page.locator('.studio-conversation')).toContainText('本地交互预览');
  await expect(errors).toEqual([]);
});

test('custom palette, geometry and opacity propagate into menus and both modes', async ({ page }) => {
  await page.goto('/benzhen/');
  await page.locator('#accent-control').fill('#294f86');
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','my-brand');
  await page.locator('#radius-control').fill('16');
  await expect(page.getByRole('button',{name:'保存更改'})).toHaveCSS('border-radius','16px');
  await page.locator('#opaque-control').check();
  await page.getByRole('button',{name:'更多操作'}).click();
  await expect(page.getByRole('menu')).toHaveCSS('backdrop-filter','none');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'深色模式',exact:true}).click();
  await expect(page.getByRole('button',{name:'保存更改'})).toHaveCSS('border-radius','16px');
  await page.locator('#density-control').selectOption('compact');
  await expect(page.getByRole('button',{name:'保存更改'})).toHaveCSS('height','34px');
  await expect(page.getByRole('button',{name:'保存更改'})).toHaveCSS('font-size','14px');
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'复制当前配方'}).click();
  const exported = await page.evaluate(()=>navigator.clipboard.readText());
  expect(exported).toContain('data-icen-preset="my-brand"');
  expect(exported).toContain('data-icen-density="compact"');
  expect(exported).toContain('data-icen-transparency="reduced"');
  expect(exported).toContain('[data-icen-theme="dark"]');
  await page.getByRole('button',{name:'恢复本真'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','benzhen');
  await expect(page.getByRole('button',{name:'保存更改'})).toHaveCSS('height','40px');
});

test('light and dark scenes have no serious accessibility violations', async ({ page }) => {
  await page.goto('/benzhen/');
  await page.addScriptTag({path:require.resolve('axe-core')});
  for (const dark of [false,true]) {
    if (dark) await page.getByRole('button',{name:'深色模式',exact:true}).click();
    for (const name of ['账户设置','知识工作台','AI 对话']) {
      await page.getByRole('tab',{name,exact:true}).click();
      const violations = await page.evaluate(async () => {
        const result = await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
        return result.violations.filter((v: any)=>['critical','serious'].includes(v.impact)).map((v: any)=>({id:v.id,targets:v.nodes.map((n: any)=>n.target)}));
      });
      expect(violations,`${dark?'dark':'light'} ${name}`).toEqual([]);
    }
  }
});

test('small touch layout, keyboard navigation, reduced motion and RTL remain usable', async ({ browser }) => {
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/benzhen/');
  await page.locator('#density-control').selectOption('compact');
  await expect(page.getByRole('button',{name:'保存更改'})).toHaveCSS('height','44px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('tab',{name:'账户设置'}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'知识工作台'})).toBeFocused();
  await page.locator('html').evaluate((el)=>el.setAttribute('dir','rtl'));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'账户设置'})).toBeFocused();
  await page.locator('html').evaluate((el)=>{el.setAttribute('dir','ltr');(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
  await page.screenshot({path:'test-results/benzhen-mobile.png',fullPage:true});
  await context.close();
});

test('rendered material study in both modes', async ({ page }) => {
  await page.goto('/benzhen/');
  await page.screenshot({path:'test-results/benzhen-light.png',fullPage:true});
  await page.getByRole('button',{name:'深色模式',exact:true}).click();
  await page.screenshot({path:'test-results/benzhen-dark.png',fullPage:true});
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(21, 23, 27)');
});

test('top primitive switch offers 本真 / 像素, preserves theme and survives navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','benzhen');
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','benzhen');
  await page.locator('#style-select .icen-theme-switcher-trigger').click();
  await expect(page.locator('[role="dialog"]:visible .icen-theme-switcher-option-name')).toHaveText(['本真','像素']);
  await page.locator('[role="dialog"]:visible [data-icen-value="pixel"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel');
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','benzhen');
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.fonts.check('12px "Icen Pixel"'))).toBe(true);
  await page.locator('#preset-select .icen-theme-switcher-trigger').click();
  await page.locator('[role="dialog"]:visible [data-icen-value="piano"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel');
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','piano');
  await page.goto('/components/btn/');
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel');
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','piano');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'test-results/pixel-components.png',fullPage:false});
  await page.locator('.nav-links a[href="/tokens/"]').click();
  await expect(page).toHaveURL(/\/tokens\//);
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel');
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','piano');
  await page.locator('#style-select .icen-theme-switcher-trigger').click();
  await page.locator('[role="dialog"]:visible [data-icen-value="benzhen"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','piano');
});

test('old persisted profile migrates before paint, preserving color and mode', async ({ page }) => {
  await page.addInitScript(()=>localStorage.setItem('icen.ui.theme',JSON.stringify({preset:'ink',dark:true,style:'terminal'})));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','benzhen');
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','ink');
  await expect(page.locator('html')).toHaveAttribute('data-icen-theme','dark');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('icen.ui.theme')!).style)).toBe('benzhen');
});

test('both primitives compose with every built-in theme in light and dark', async ({ page }) => {
  await page.goto('/components/btn/');
  const primary=page.locator('main .icen-btn-primary').first();
  for(const preset of ['benzhen','clay','piano','art','vangogh','ink']) {
    await page.locator('#preset-select .icen-theme-switcher-trigger').click();
    await page.locator(`[role="dialog"]:visible:not([data-icen-state="closing"]) [data-icen-value="${preset}"]`).click();
    for(const dark of [false,true]) {
      if(await page.locator('html').getAttribute('data-icen-theme')!== (dark?'dark':null)) await page.locator('#dark-toggle button').click();
      let palette='';
      for(const primitive of ['benzhen','pixel']) {
        await page.locator('#style-select .icen-theme-switcher-trigger').click();
        await page.locator(`[role="dialog"]:visible:not([data-icen-state="closing"]) [data-icen-value="${primitive}"]`).click();
        await expect(page.locator('html')).toHaveAttribute('data-icen-preset',preset);
        await expect(primary).toHaveCSS('border-radius',primitive==='pixel'?'0px':'10px');
        const color=await primary.evaluate(el=>getComputedStyle(el).backgroundColor);
        if(primitive==='benzhen') palette=color; else expect(color).toBe(palette);
      }
    }
  }
});

test('curated gallery exposes six themes, readable nested modes and no retro option',async({page})=>{
  await page.goto('/tokens/');
  await expect(page.locator('.palette-pair')).toHaveCount(6);
  await expect(page.locator('[data-icen-axis="theme"][data-icen-value="retro"]')).toHaveCount(0);
  await page.addScriptTag({path:require.resolve('axe-core')});
  const violations=await page.evaluate(async()=>{
    const result=await(window as any).axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return result.violations.filter((v:any)=>['critical','serious'].includes(v.impact)).map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)}));
  });
  expect(violations).toEqual([]);
  await page.screenshot({path:'test-results/curated-themes.png',fullPage:true});
});

test('removed retro palette restores 本真 while retaining pixel and dark mode',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('icen.ui.theme',JSON.stringify({preset:'retro',dark:true,style:'pixel'})));
  await page.goto('/tokens/');
  await expect(page.locator('html')).toHaveAttribute('data-icen-preset','benzhen');
  await expect(page.locator('html')).toHaveAttribute('data-icen-style','pixel');
  await expect(page.locator('html')).toHaveAttribute('data-icen-theme','dark');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('icen.ui.theme')!).preset)).toBe('benzhen');
});
