import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

for(const preset of ['modern','dongyun','jugou','piano','monet','vangogh'])test(`code paper stays readable in ${preset} light and dark`,async({page})=>{
  await page.goto('/components/code-block/');
  await page.addScriptTag({path:require.resolve('axe-core')});
  for(const dark of [false,true]){
    await page.locator('html').evaluate((el,{preset,dark})=>{el.dataset.icenPreset=preset;el.dataset.icenTheme=dark?'dark':'light';},{preset,dark});
    // Measure the settled palette rather than a mixed frame of its transition.
    await page.waitForTimeout(400);
    const findings=await page.evaluate(async()=>{const result=await (window as any).axe.run(Array.from(document.querySelectorAll('.icen-code-block')),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.filter((v:any)=>['serious','critical'].includes(v.impact)).map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)}));});
    expect(findings).toEqual([]);
  }
});

test('code actions keep exact source, expose retry and synchronize interrupted folding',async({page})=>{
  await page.addInitScript(()=>{(window as any).copied=[];(window as any).denyCopy=true;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{if((window as any).denyCopy)throw new Error('denied');(window as any).copied.push(text);}}});document.execCommand=()=>false;});
  await page.goto('/components/code-block/');
  const figure=page.locator('.demo-stage .icen-code-block').first();await figure.hover();
  const pre=figure.locator('pre');await expect(pre).toHaveAttribute('tabindex','0');await expect(pre).toHaveAttribute('aria-label','src/boot.ts');
  const num=figure.locator('[data-icen-code-block-num]'),wrap=figure.locator('[data-icen-code-block-wrap]');
  await num.click();await expect(num).toHaveAttribute('aria-pressed','false');await wrap.click();await expect(wrap).toHaveAttribute('aria-pressed','true');
  const copy=figure.locator('[data-icen-code-block-copy]');await copy.click();await expect(figure.locator('[role=status]')).toHaveText('未能复制，请重试。');await expect(copy).toHaveAttribute('aria-label','重试复制');
  await page.evaluate(()=>(window as any).denyCopy=false);await copy.click();await expect(copy).toHaveClass(/is-done/);
  const source=await pre.locator('.icen-code-block-line').allTextContents();expect(await page.evaluate(()=>(window as any).copied)).toEqual([source.join('\n')]);await expect(figure.locator('[role=status]')).toHaveCount(1);
  const long=page.locator('.demo-stage .icen-code-block').nth(1),fold=long.locator('[data-icen-code-block-fold]');await long.hover();
  await fold.click();await expect(fold).toHaveAttribute('aria-expanded','true');await fold.click();await expect(fold).toHaveAttribute('aria-expanded','false');
  await expect.poll(()=>long.locator('pre').evaluate(el=>el.style.maxHeight)).toBe('');await expect(long.locator('.icen-code-block-tail')).toHaveAttribute('aria-expanded','false');
  await long.screenshot({path:'.ui-audit/code-block-folded.png',animations:'disabled'});
});

test('touch code actions retain generous targets and keyboard regions in RTL reduced motion',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  try{const page=await context.newPage();await page.goto('/components/code-block/');await page.locator('html').evaluate(el=>{el.dir='rtl';el.dataset.icenStyle='pixel';el.dataset.icenTheme='dark';});
    const figure=page.locator('.demo-stage .icen-code-block').first();
    for(const button of await figure.locator('button').all()){const size=(await button.boundingBox())!;expect(size.height).toBeGreaterThanOrEqual(44);expect(size.width).toBeGreaterThanOrEqual(44);}
    await figure.locator('pre').focus();await expect(figure.locator('pre')).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await figure.screenshot({path:'.ui-audit/code-block-mobile-pixel.png',animations:'disabled'});
    await page.emulateMedia({forcedColors:'active'});
    const systemInk=await page.evaluate(()=>{const probe=document.createElement('span');probe.style.color='CanvasText';document.body.append(probe);const ink=getComputedStyle(probe).color;probe.remove();return ink;});
    await expect(figure.locator('pre span').first()).toHaveCSS('color',systemInk);
  }finally{await context.close();}
});
