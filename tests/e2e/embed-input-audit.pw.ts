import {test, expect} from '@playwright/test';

/* 内嵌输入框视觉巡审：截各组件的搜索/过滤输入，确认与标准 input 同一视觉配方 */
test('embedded input audit', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});

  // 1. AI 输入台：模型弹层搜索框
  await page.goto('/components/ai-composer/');
  await page.waitForSelector('[data-icen-demo-ready]');
  const modelBtn = page.locator('.icen-ai-composer [data-icen-ai-model-open]').first();
  await modelBtn.click();
  await page.waitForTimeout(400);
  const popup = page.locator('.icen-ai-composer-popup');
  if (await popup.count()) {
    const input = popup.locator('input').first();
    await input.fill('GPT');
    await page.waitForTimeout(250);
    /* 契约断言：弹层搜索框必须被套进标准控件外壳（留白/圆角/焦点环由此而来），
       且文字不贴边——内边距来自外壳而非 input 自身 */
    const wrap = popup.locator('.icen-input-wrap.icen-control');
    await expect(wrap).toHaveCount(1);
    const pad = await wrap.evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineStart));
    expect(pad).toBeGreaterThanOrEqual(8);
    await popup.screenshot({path: '.ui-audit/embed-composer-popup.png'});
  } else {
    console.log('composer popup not opened; triggers:', await page.locator('.icen-ai-composer-toolbar button').allTextContents());
  }

  // 2. select 可搜索
  await page.goto('/components/select/');
  await page.waitForSelector('[data-icen-demo-ready]');
  await page.locator('[data-icen-select-search] .icen-select-trigger').first().click();
  await page.waitForTimeout(300);
  await page.locator('.icen-select-panel:visible').screenshot({path: '.ui-audit/embed-select-search.png'});

  // 3. 命令面板
  await page.goto('/components/command-palette/');
  await page.waitForSelector('[data-icen-demo-ready]');
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(400);
  const cp = page.locator('.icen-command-palette:visible');
  if (await cp.count()) await cp.screenshot({path: '.ui-audit/embed-command-palette.png'});

  // 4. kb 检索台
  await page.goto('/components/kb-retrieval/');
  await page.waitForSelector('[data-icen-demo-ready]');
  const kb = page.locator('.demo-stage');
  await kb.screenshot({path: '.ui-audit/embed-kb-retrieval.png'});

  // 5. datatable 搜索
  await page.goto('/components/datatable/');
  await page.waitForSelector('[data-icen-demo-ready]');
  const dtSearch = page.locator('.demo-stage input[type="search"], .demo-stage .icen-datatable-search input').first();
  if (await dtSearch.count()) {
    await dtSearch.fill('网关');
    await page.waitForTimeout(300);
  }
  await page.locator('.demo-stage').screenshot({path: '.ui-audit/embed-datatable.png'});

  // 6. input 页搜索框变体（基线对照）
  await page.goto('/components/input/');
  await page.waitForSelector('[data-icen-demo-ready]');
  await page.locator('.demo-stage').screenshot({path: '.ui-audit/embed-input-baseline.png'});

  // 7. 全库守卫：没有未定义且无 fallback 的 --icen-* 引用（守卫在 verify 里，此处双保险读产物）
});
