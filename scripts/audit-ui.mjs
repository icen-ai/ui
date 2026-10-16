// Browser evidence for every built component document. Run after site build:
// node scripts/audit-ui.mjs [baseURL] [--screenshots]
import { chromium } from '@playwright/test';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
const base = process.argv.find((arg)=>arg.startsWith('http')) ?? 'http://127.0.0.1:4173';
const screenshots = process.argv.includes('--screenshots');
const out = new URL('../.ui-audit/',import.meta.url);
await mkdir(out,{recursive:true});
const pages = (await readdir(new URL('../site/dist/components/',import.meta.url),{withFileTypes:true})).filter((entry)=>entry.isDirectory()).map((entry)=>entry.name);
const browser = await chromium.launch();
const report = [];
try {
  const page = await browser.newPage();
  let errors = [];
  page.on('pageerror',(error)=>errors.push(error.message));
  page.on('console',(message)=>{if(message.type()==='error') errors.push(message.text());});
  for (const slug of pages) {
    errors=[];
    const result={slug,errors:[],views:[]};
    await page.setViewportSize({width:1440,height:1000});
    try {
      await page.goto(`${base}/components/${slug}/`);
      await page.locator('[data-icen-demo-ready]').waitFor({timeout:8000});
      for (const width of [1440,390]) {
        await page.setViewportSize({width,height:1000});
        await page.evaluate(()=>new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        result.views.push(await page.evaluate(()=>({
          width:innerWidth, documentOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
          textIcons:[...document.querySelectorAll('.demo-stage button,.demo-stage [role="button"]')].filter((el)=>!el.querySelector('svg') && /^[×✕✗✓✔⌄▾▸▴▿›‹←→↑↓⨯]+$/.test(el.textContent.trim())).map((el)=>({className:el.className,text:el.textContent.trim()})),
          emptyButtons:[...document.querySelectorAll('.demo-stage button')].filter((el)=>!el.hidden && getComputedStyle(el).display!=='none' && !el.textContent.trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title')).map((el)=>el.className),
        })));
        if(screenshots) await page.screenshot({path:new URL(`${slug}-${width}.png`,out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:false});
      }
    } catch(error) { errors.push(error.message); }
    result.errors=[...new Set(errors)];report.push(result);
    if(report.length%20===0) console.log(`Inspected ${report.length}/${pages.length} component documents`);
  }
} finally { await browser.close(); }
await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));
const issues=report.filter((item)=>item.errors.length || item.views.some((view)=>view.documentOverflow>1 || view.textIcons.length || view.emptyButtons.length));
console.log(JSON.stringify({pages:report.length,issues},null,2));
