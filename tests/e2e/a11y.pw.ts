// 无障碍扫描：axe-core 注入真实 chromium。
// 门禁语义：critical/serious 违规对照已提交基线（a11y-baseline.json）——
//   · 基线内（既有债）→ 打印证据（规则/目标/修法提示），不 fail，债只许减不许增；
//   · 基线外（新增违规）→ fail，CI 红。
// 基线更新：A11Y_UPDATE_BASELINE=1 bunx playwright test tests/e2e/a11y.pw.ts（须随 PR 人工评审提交）。
// 既有债全部位于红线文件（src/** tokens·组件·行为、site/src/** 站壳样式），本工作流不得修，
// 故采用「基线锁存」而非「零容忍」——见 docs/testing.md 与交付报告。
import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core');
const BASELINE_FILE = new URL('./a11y-baseline.json', import.meta.url);
const UPDATING = process.env.A11Y_UPDATE_BASELINE === '1';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'icen-btn', path: '/components/btn/' },
  { name: 'icen-datatable', path: '/components/datatable/' },
  { name: 'form-validate', path: '/components/form-validate/' },
  { name: 'charts', path: '/components/charts/' },
  { name: 'icen-modal', path: '/components/modal/' },
  { name: 'kb', path: '/kb/' },
  { name: 'frameworks', path: '/frameworks/' },
];

type AxeNode = { target: string[]; failureSummary?: string };
type AxeViolation = {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
};

// 既有债的修法提示（按规则 id），打印进报告，清债时逐条核销
const FIX_HINTS: Record<string, string> = {
  'color-contrast':
    'clay 的 muted 灰 #9d9b93 对纸白仅 2.78:1（WCAG AA 需 4.5:1）——调 --icen-token-text-muted 基值或站壳 site.css 的次级文字色；tok-* 高亮色需按背景重校',
  'label-content-name-mismatch':
    'SiteHeader 品牌链的可见文案未进可访问名（aria-label 覆盖），风格 select trigger 的 aria-label="风格" 不含可见值——可访问名须含可见文本（site/src/components/SiteHeader.astro）',
  'scrollable-region-focusable':
    '代码块 pre 溢出滚动但无 tabindex="0"——站点 CodeBlock 给可滚动区加键盘入口（site/src/components/CodeBlock.astro）',
  'svg-img-alt':
    '图表 svg role="img" 无替代文本——charts 渲染器按 spec.title/系列名归一生成 aria-label（src/behaviors/charts.ts）',
  'role-img-alt': 'heatmap 网格 div role="img" 无标签——同 charts 渲染器补 aria-label（src/behaviors/charts.ts）',
  'aria-required-children':
    'datatable role="row" 的直接子元素缺 role="gridcell/columnheader"——行渲染补 cell 角色（src/behaviors/datatable.ts）',
  'nested-interactive': 'kb 受限源行（button.is-restricted）内嵌套交互控件——源卡结构解嵌套（src/components/kb-ground.css 对应 demo 数据/渲染）',
};

// 目标选择器归一化：剥 nth-child、data-icen-key/row/index 等易漂移定位，保证基线不被内容微调打碎
function normalizeTarget(t: string): string {
  return t
    .replace(/:nth-child\(\d+\)/g, '')
    .replace(/\[data-icen-(?:key|row|index|depth|tab|group|panel|chart-type)="[^"]*"\]/g, '[data-icen-*]')
    .replace(/\s+/g, ' ')
    .trim();
}

function format(v: AxeViolation, node?: AxeNode): string {
  const head = `[${v.impact}] ${v.id} — ${v.help}`;
  const hint = FIX_HINTS[v.id] ? `\n    修法: ${FIX_HINTS[v.id]}` : '';
  const detail = node ? `\n    目标: ${node.target.join(' ')}\n    ${(node.failureSummary ?? '').replace(/\n+/g, ' · ')}` : '';
  return `${head}${detail}${hint}\n    规则详情: ${v.helpUrl}`;
}

type Baseline = Record<string, Record<string, string[]>>; // label → ruleId → 归一化目标集

function loadBaseline(): Baseline {
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function installAxe(page: Page) {
  await page.addScriptTag({ path: AXE_PATH });
}

async function scan(page: Page): Promise<AxeViolation[]> {
  return page.evaluate(async () => {
    const results = await (window as unknown as { axe: any }).axe.run(document, {
      resultTypes: ['violations'],
    });
    return results.violations;
  });
}

async function assertA11y(page: Page, label: string) {
  const violations = await scan(page);
  const hard = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  const soft = violations.filter((v) => v.impact === 'moderate' || v.impact === 'minor');
  if (soft.length > 0) {
    console.log(`\n[a11y:${label}] moderate/minor 共 ${soft.length} 条（不 fail，建议择期修）：`);
    for (const v of soft) for (const n of v.nodes) console.log(format(v, n));
  }
  if (hard.length === 0) return;

  const baseline = loadBaseline();
  if (UPDATING) {
    baseline[label] = Object.fromEntries(
      hard.map((v) => [v.id, [...new Set(v.nodes.flatMap((n) => n.target.map(normalizeTarget)))]]),
    );
    writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`[a11y:${label}] 已写入基线（${hard.length} 条规则），须人工评审后提交 a11y-baseline.json`);
    expect.unreachable(`${label}: a11y 基线已更新，确认差异后请重新运行`);
  }

  const known = baseline[label] ?? {};
  const fresh: string[] = [];
  let knownCount = 0;
  for (const v of hard) {
    const seen = new Set<string>();
    for (const n of v.nodes) {
      for (const raw of n.target) {
        const t = normalizeTarget(raw);
        if ((known[v.id] ?? []).includes(t)) {
          knownCount++;
          if (!seen.has(t)) {
            seen.add(t);
            console.log(`[a11y:${label}] 既有债 ${v.id}: ${t}`);
          }
        } else {
          fresh.push(format(v, n));
        }
      }
    }
  }
  // 债只许减：基线里已不存在的条目提醒人工核销，不 fail
  const fired = new Set(hard.map((v) => v.id));
  const stale = Object.keys(known).filter((id) => !fired.has(id));
  if (stale.length > 0) console.log(`[a11y:${label}] 基线中以下规则本页已清零，请从 a11y-baseline.json 核销: ${stale.join(', ')}`);

  expect(
    fresh,
    `[${label}] 新增 ${fresh.length} 条基线外 critical/serious 违规（既有债 ${knownCount} 条仍锁存）：\n${fresh.join('\n')}`,
  ).toEqual([]);
}

for (const p of PAGES) {
  test(`${p.name}: ${p.path}`, async ({ page }) => {
    await page.goto(p.path, { waitUntil: 'networkidle' });
    if (p.path.startsWith('/kb')) {
      // /kb/ 首屏定时模拟流落定后再扫（同 visual.pw.ts 的 settle 语义）
      await page.locator('.icen-kb-chain-label').first().waitFor({ timeout: 15_000 });
      await page.waitForTimeout(3000);
    }
    await installAxe(page);
    await assertA11y(page, p.name);
  });
}

// ── 交互后再扫：浮层/动态态也必须干净（新增违规同样 fail）────────────────

test('modal: 打开对话框后扫描', async ({ page }) => {
  await page.goto('/components/modal/', { waitUntil: 'networkidle' });
  await installAxe(page);
  await page.locator('button[data-icen-modal-open="demo-modal-md"]').click();
  const dialog = page.locator('[data-icen-modal="demo-modal-md"]'); // backdrop，hidden 属性切可见性
  await expect(dialog).toBeVisible(); // 浮层 portal 到 body
  await page.waitForTimeout(400); // 入场动画落定再扫：axe 对 transition 中间态（半透明）会误算对比度
  await assertA11y(page, 'modal-open');
  await page.keyboard.press('Escape'); // a11y 纪律：ESC 关闭
  await expect(dialog).toBeHidden();
});

test('kb: 展开 select 面板后扫描', async ({ page }) => {
  await page.goto('/kb/', { waitUntil: 'networkidle' });
  await page.locator('.icen-kb-chain-label').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(3000); // 首屏模拟流落定，避免整页扫描时序抖动
  await installAxe(page);
  await page.locator('#preset-select .icen-select-trigger').click();
  const panel = page.locator('.icen-select-panel >> visible=true'); // 面板 portal 到 body（浮层态）
  await expect(panel).toBeVisible();
  await assertA11y(page, 'kb-select-panel');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('form-validate: 提交触发错误态后扫描', async ({ page }) => {
  await page.goto('/components/form-validate/', { waitUntil: 'networkidle' });
  await installAxe(page);
  await page.locator('button[type="submit"].icen-btn-primary').first().click();
  const summary = page.locator('[data-icen-validate-summary]');
  await expect(summary).toBeVisible(); // 校验摘要 + 行内错误渲染完毕
  await assertA11y(page, 'form-validate-errors');
});
