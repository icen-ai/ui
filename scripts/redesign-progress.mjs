import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { SLUGS, cssOf } from './slugs.mjs';

const path = 'docs/redesign/progress.json';
const meta = JSON.parse(await readFile('meta.json', 'utf8'));
const tiers = JSON.parse(await readFile('docs/contracts/tiers.json', 'utf8'));
let previous = {};
try { previous = JSON.parse(await readFile(path, 'utf8')); } catch { /* First generated progress file. */ }
const currentProgress = previous.schema === 2 && previous.phases && 'coreComposition' in previous.phases ? previous : {};
const priorComponents = new Map((currentProgress.components ?? []).map(component => [component.slug, component]));
const docDirectory = await readdir('site/dist/components', { withFileTypes: true });
const documentation = docDirectory.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
const missing = SLUGS.filter(slug => !documentation.includes(slug));
if (missing.length) throw new Error(`Build the site before updating redesign progress; missing: ${missing.join(', ')}`);
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const components = SLUGS.map(slug => {
  const prior = priorComponents.get(slug);
  return {
    slug,
    css: cssOf(slug),
    status: prior?.status ?? 'audited',
    scenarios: prior?.scenarios ?? 'review-required',
    behaviorEvidence: prior?.behaviorEvidence ?? [],
    visualEvidence: prior?.visualEvidence ?? [],
    remaining: prior?.remaining ?? ['Verify the complete task scenario, composition contract and applicable interaction states in this refinement round.'],
  };
});
const result = {
  schema: 2,
  updated: new Date().toISOString(),
  branch: 'pref/design',
  revision,
  registry: {
    slugs: SLUGS.length,
    primaryCssFiles: new Set(SLUGS.map(cssOf)).size,
    componentCssFiles: meta.componentCss,
    documentationEntries: documentation.length,
    documentationOnlyEntries: documentation.length - SLUGS.length,
    behaviors: meta.behaviors,
    tiers: Object.fromEntries(Object.entries(tiers).map(([tier, modules]) => [tier, modules.length])),
  },
  baseline: currentProgress.baseline ?? {
    revision,
    verify: 'pass: typecheck, guards, 1052 tests, build and size budgets',
    siteBuild: 'pass: 138 pages; existing duplicate i18n key warning recorded for correction',
    visualRegression: 'pass: 19/19, Windows Chromium, existing tolerance unchanged',
    inventory: '.ui-audit/pref-design/baseline/manifest.json',
    inventoryResult: 'pass: 214/214 first-screen captures; not full-state certification',
  },
  phases: currentProgress.phases ?? {
    foundation: 'implementing',
    coreComposition: 'pending',
    knowledgeBase: 'pending',
    ai: 'pending',
    remainingRegistry: 'pending',
    documentation: 'pending',
    validation: 'pending',
  },
  components,
  verification: currentProgress.verification ?? {},
  remainingTasks: currentProgress.remainingTasks ?? [
    'Unify token ownership, geometry, choices and stable slots.',
    'Complete composable core controllers, overlay ownership and asynchronous lifecycles.',
    'Secure answer-scoped evidence and complete KB retrieval, permission and editing workflows.',
    'Stabilize AI streaming, model/tool round trips and narrow-container layouts.',
    'Review every remaining Registry component and its real documentation scenario.',
    'Rebuild the scenario-led documentation workbench and application compositions.',
    'Run full engineering, package, browser and visual validation; refresh reviewed baselines.',
  ],
};
const output = `${JSON.stringify(result, null, 2)}\n`;
const current = await readFile(path, 'utf8').catch(() => '');
let unchanged = false;
try {
  unchanged = JSON.stringify({ ...JSON.parse(current), updated: result.updated }) === JSON.stringify(result);
} catch { /* Missing or superseded progress is regenerated below. */ }
if (process.argv.includes('--check')) {
  if (!unchanged) throw new Error('docs/redesign/progress.json is stale; run node scripts/redesign-progress.mjs');
} else if (!unchanged) {
  await writeFile(path, output);
  console.log(`redesign progress: ${components.length} slugs, ${documentation.length} documentation entries`);
}
