import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('line chart fills its container with points-aligned labels and honest alt text', async ({page}) => {
  await page.goto('/components/chart-line/');
  const svg = page.locator('.icen-chart-body .icen-chart-line > svg');
  await expect(svg).toBeVisible();
  // role=img 有替代文本（svg-img-alt 旧债已根治）
  await expect(svg).toHaveAttribute('aria-label', /折线图/);
  // 流式宽度：viewBox 宽 = 元素像素宽（scale 恒 1，无信箱畸变）
  const box = (await svg.boundingBox())!;
  const vb = await svg.getAttribute('viewBox');
  expect(Number(vb!.split(' ')[2])).toBe(Math.round(box.width));
  // 轴标签精确落在点位正下方（首个标签中心 = 首点 x）
  const offset = await page.evaluate(() => {
    const svg = document.querySelector('.icen-chart-body .icen-chart-line > svg')!;
    const pt = svg.querySelector('circle')!.getBoundingClientRect();
    const label = document.querySelector('.icen-chart-labels--points span')!.getBoundingClientRect();
    const r = svg.getBoundingClientRect();
    return Math.abs((pt.x + pt.width / 2) - (label.x + label.width / 2) - (0)) ;
  });
  expect(offset).toBeLessThan(2);
  // 容器收窄 → ResizeObserver 重渲染，几何跟随
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.waitForTimeout(500);
  const vb2 = await svg.getAttribute('viewBox');
  const box2 = (await svg.boundingBox())!;
  expect(Number(vb2!.split(' ')[2])).toBe(Math.round(box2.width));
  expect(Number(vb2!.split(' ')[2])).toBeLessThan(Number(vb!.split(' ')[2]));
});

test('charts umbrella page keeps clean axe with the new aria labels', async ({page}) => {
  await page.goto('/components/charts/');
  await page.addScriptTag({path: require.resolve('axe-core')});
  const issues = await page.locator('.demo-stage').evaluate(async root => {
    const r = await (window as any).axe.run(root, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa']}});
    return r.violations.filter((v: any) => ['serious','critical'].includes(v.impact)).map((v: any) => v.id);
  });
  expect(issues).toEqual([]);
});
