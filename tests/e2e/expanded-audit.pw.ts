// 全站展开态审计：每个组件页在 展开 details/手风琴 前后各跑一次 axe + 双宽度零横向溢出 + 页面零脚本异常。
// 对话框/浮层类开启器不在此触发（那是各专项的领域）；这里锁定的是「内容全部展开时的静态健康」。
import {test, expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readdirSync} from 'node:fs';
const require = createRequire(import.meta.url);

const slugs = readdirSync('site/dist/components', {withFileTypes: true})
  .filter(e => e.isDirectory()).map(e => e.name);

test.setTimeout(90_000);

for (const slug of slugs) {
  test(`expanded audit: ${slug}`, async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(`${slug}: ${e.message}`));
    await page.goto(`/components/${slug}/`);
    await page.waitForSelector('.demo-stage, main');
    await page.evaluate(() => document.fonts.ready);

    // 展开静态可展件：details + 页内手风琴触发器（不开 dialog/popover/菜单）
    await page.evaluate(() => {
      document.querySelectorAll('details:not([open])').forEach(d => { d.open = true; });
      document.querySelectorAll<HTMLElement>('.icen-accordion-trigger[aria-expanded="false"]').forEach(t => t.click());
    });
    await page.waitForTimeout(300);

    // 双宽度零横向溢出
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 1000});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${slug} @${width}px 横向溢出`).toBeLessThanOrEqual(1);
    }

    // 展开态 axe 只扫组件演示区（文档壳的既有债归 a11y 基线套件，不在这里重复记账）
    await page.setViewportSize({width: 1440, height: 1000});
    await page.addScriptTag({path: require.resolve('axe-core')});
    const issues = await page.locator('.demo-stage').evaluate(async root => {
      const r = await (window as any).axe.run(root, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}});
      return r.violations.filter((v: any) => ['serious', 'critical'].includes(v.impact))
        .map((v: any) => ({id: v.id, targets: v.nodes.map((n: any) => n.target.join(' ')).slice(0, 3)}));
    });
    expect(issues, `${slug} 展开态 axe`).toEqual([]);
    expect(errors).toEqual([]);
  });
}
