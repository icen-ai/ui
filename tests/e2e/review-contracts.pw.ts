import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('sampled chart ticks match their actual data points at narrow widths and in RTL', async ({page}) => {
  await page.route('**/__review/charts.mjs', route => route.fulfill({contentType:'text/javascript', body:readFileSync('dist/behaviors/charts.mjs','utf8')}));
  await page.goto('/components/chart-line/');
  await page.evaluate(async () => {
    const mod = await import(/* @vite-ignore */ '/__review/charts.mjs');
    const host = document.createElement('div'); host.id = 'review-chart'; host.className = 'icen-chart';
    host.style.width = '600px'; document.querySelector('.demo-stage')!.appendChild(host);
    (window as any).reviewChart = mod.renderChart(host, {type:'line',labels:Array.from({length:8},(_,i)=>'第'+i+'个很长的日期标签'),series:[{name:'Web',values:[1,2,3,4,3,2,4,5]},{name:'App',values:[2,3,4,3,2,3,5,6]},{name:'API',values:[3,4,5,4,3,4,6,7]}]});
  });
  const host=page.locator('#review-chart');
  for(const dir of ['ltr','rtl']) for(const width of [600,180]) {
    await page.locator('html').evaluate((el,dir)=>el.dir=dir,dir);
    await host.evaluate((el,width)=>el.style.width=width+'px',width);
    await expect.poll(()=>host.locator('.icen-chart-line svg').getAttribute('viewBox')).toBe(`0 0 ${width} 150`);
    const offsets=await host.evaluate(root=>Array.from(root.querySelectorAll<HTMLElement>('.icen-chart-labels--points span')).map(label=>{
      const point=root.querySelector<SVGCircleElement>(`circle[data-icen-chart-index="${label.dataset.icenChartIndex}"]`)!;
      const a=point.getBoundingClientRect(), b=label.getBoundingClientRect(), h=root.getBoundingClientRect();
      return {offset:Math.abs(a.x+a.width/2-b.x-b.width/2), inside:b.left>=h.left-1&&b.right<=h.right+1, truncated:label.scrollWidth>label.clientWidth};
    }));
    expect(offsets.every(x=>x.offset<1&&x.inside)).toBe(true);
    expect(offsets.some(x=>x.truncated)).toBe(true);
  }
  const colors=await host.evaluate(root=>({
    lines:Array.from(root.querySelectorAll('path[data-icen-chart-series]')).filter(el=>el.getAttribute('fill')==='none').map(el=>getComputedStyle(el).stroke),
    dots:Array.from(root.querySelectorAll('.icen-chart-legend-dot')).map(el=>getComputedStyle(el).backgroundColor)
  }));
  expect(new Set(colors.lines).size).toBe(3);
  expect(colors.lines).toEqual(colors.dots);
  await expect(host.locator('.icen-chart-legend-eye svg')).toHaveAttribute('viewBox','0 0 20 20');
  await host.locator('.icen-chart-legend-toggle-item').first().click();
  await host.evaluate(el=>el.style.width='420px');
  await expect.poll(()=>host.locator('.icen-chart-line svg').getAttribute('viewBox')).toBe('0 0 420 150');
  await expect(host.locator('.icen-chart-legend-toggle-item').first()).toHaveAttribute('aria-pressed','false');
  await expect(host.locator('path[data-icen-chart-series="0"]').last()).toHaveClass(/is-off/);
  await page.evaluate(()=>(window as any).reviewChart.destroy());
  await host.evaluate(el=>el.style.width='480px');
  await page.waitForTimeout(350);
  await expect(host.locator('svg')).toHaveCount(0); // Resize must not resurrect a disposed chart.
});

test('documentation previews inherit the selected primitive typography', async ({page}) => {
  await page.goto('/components/upload/');
  for(const primitive of ['modern','pixel']) {
    await page.locator('html').evaluate((el,primitive)=>el.dataset.icenStyle=primitive,primitive);
    const fonts=await page.locator('.demo-stage').evaluate(el=>{
      const probe=document.createElement('span');probe.style.fontFamily='var(--icen-font-body)';el.appendChild(probe);
      const fonts={actual:getComputedStyle(el).fontFamily,expected:getComputedStyle(probe).fontFamily};probe.remove();return fonts;
    });
    expect(fonts.actual).toBe(fonts.expected);
  }
});

test('inline theme choices form complete rows according to the container width', async ({page}) => {
  await page.goto('/components/theme-switcher/');
  const settings=page.locator('.demo-stage .icen-theme-switcher[data-icen-layout="inline"]');
  for(const [width,columns] of [[360,2],[690,3],[950,6]]) {
    await settings.evaluate((el,width)=>{el.style.maxInlineSize='none';el.style.width=width+'px'},width);
    await expect.poll(()=>settings.locator('.icen-theme-switcher-options--theme').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns);
  }
  const intrinsic=await settings.evaluate(el=>{
    const host=document.createElement('div');host.style.cssText='display:flex;flex-direction:column;align-items:center;width:690px';
    const clone=el.cloneNode(true) as HTMLElement;clone.removeAttribute('style');host.appendChild(clone);document.body.appendChild(host);
    const width=clone.getBoundingClientRect().width;host.remove();return width;
  });
  expect(intrinsic).toBe(690); // Container queries must not collapse an embedded control to zero width.
});
