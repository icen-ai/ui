import {test, expect} from '@playwright/test';

async function probe(btn: ReturnType<import('@playwright/test').Page['locator']>, label: string) {
  const info = await btn.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const layers = Array.from(el.querySelectorAll('.icen-copy-content, .icen-copy-result')).map((k) => {
      const r = k.getBoundingClientRect();
      return {cls: k.className.replace('icen-feedback-action-label', '').trim(), cx: +(r.x + r.width / 2 - b.x).toFixed(1), cy: +(r.y + r.height / 2 - b.y).toFixed(1)};
    });
    return {w: b.width, h: b.height, layers};
  });
  console.log(label, JSON.stringify(info));
  return info;
}

test('copy buttons keep layers stacked and centered', async ({page}) => {
  // 首页 install-chip（30px 圆钮）
  await page.goto('/');
  await page.setViewportSize({width: 1440, height: 900});
  const chip = page.locator('.install-copy');
  const a = await probe(chip, 'home.idle ');
  expect(Math.abs(a.layers[0].cx - 15)).toBeLessThan(1.6);
  await chip.click();
  await page.waitForTimeout(150);
  const b1 = await probe(chip, 'home.done ');
  expect(Math.abs(b1.layers[1].cx - 15)).toBeLessThan(1.6);

  // 组件页 复制当前页
  await page.goto('/components/btn/');
  const doc = page.locator('.doc-copy-page');
  const c = await probe(doc, 'docs.idle ');
  expect(Math.abs(c.layers[0].cx - c.w / 2)).toBeLessThan(2);
  await doc.click();
  await page.waitForTimeout(150);
  const d = await probe(doc, 'docs.done ');
  expect(Math.abs(d.layers[1].cx - d.w / 2)).toBeLessThan(2);

  // 定制页 tw-copy
  await page.goto('/customize/');
  const tw = page.locator('#tw-copy');
  const e = await probe(tw, 'tw.idle   ');
  expect(Math.abs(e.layers[0].cx - e.w / 2)).toBeLessThan(2);

  // hover 截图留档
  await page.goto('/');
  await page.locator('.install-copy').hover();
  await page.waitForTimeout(200);
  await page.locator('.install-chip').screenshot({path: '.ui-audit/copy-fix-chip.png'});
});
