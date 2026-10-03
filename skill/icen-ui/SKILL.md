---
name: icen-ui
name_zh: 冰点设计系统
name_en: ICEN Design System
description: Build production UI with @icen.ai/ui — a zero-dependency, framework-agnostic component library with a JSON-driven chart layer, an AI-native chat family, and a knowledge-base evidence family (citations, retrieval tuning, eval, ACL). Use when the user wants to build or restyle interfaces, pick and render charts/dashboards/data visualization, wire an AI chat experience (streaming, tool calls, todos, usage/audit), build RAG/knowledge-base evidence UIs (inline citations, source lists, retrieval playground, NL2SQL answers, permission boundaries), listen to typed icen:* events/gestures, switch themes/dark mode, or install UI components on demand in vanilla/React/Vue/Astro projects.
desc_zh: 用冰点设计系统搭界面：图表选型直出、AI 聊天五步接入、知识库证据与权限一族打尽、主题暗色一条龙，零依赖按需装。
desc_en: Build UI with the ICEN design system: chart picking, AI chat wiring, knowledge-base evidence UI, and theming recipes — zero dependency, install on demand.
version: 0.2.0
tags:
  - ui
  - design-system
  - charts
  - ai
  - knowledge-base
keywords:
  - 组件
  - 图表
  - 设计系统
  - dashboard
  - 可视化
  - dark mode
  - ai chat
  - component
  - chart
  - theme
  - 知识库
  - RAG
  - 引用
  - citation
  - 权限
  - acl
  - gesture
---

# ICEN UI Playbooks

Task-driven playbooks for `@icen.ai/ui`. This skill decides **WHEN and WHICH**; exact signatures live in the
package itself — read them there, do not rely on memory:

| Truth | Where |
| --- | --- |
| Consumer quickstart + rules | `node_modules/@icen.ai/ui/AGENTS.md` (section 一) |
| Full type surface w/ constraint JSDoc | `node_modules/@icen.ai/ui/dist/behaviors/<module>.d.mts` |
| KB family spec (incl. §9 permissions) | `node_modules/@icen.ai/ui/docs/spec/kb-family.md` (shipped in the package) |
| Full docs for RAG | <https://ui.icen.ai/llms-full.txt> (index: `/llms.txt`) |
| Interactive docs / DOM contracts | <https://ui.icen.ai/components/<slug>/> |
| KB flagship workbench (all families wired) | <https://ui.icen.ai/kb/> |

## 0. Ground rules (read before generating code)

- Zero dependency, ESM + TypeScript. Components = CSS + behavior JS; no framework binding — call behavior
  functions in React `useEffect` / Vue `onMounted`.
- ALWAYS `@import '@icen.ai/ui/tokens.css';` before any component CSS (everything consumes `--token-*`).
- **Astro trap**: css imports inside kit entries get tree-shaken in page `<script>` — import component CSS in
  the layout frontmatter instead. Vite SPA / webpack unaffected.
- Behaviors are idempotent and SSR-safe; rendering writes `textContent` only — never `innerHTML`.
- Custom events use the `icen:` prefix (`icen:chart-*`, `icen:ai-*`, `icen:kb-*`); listen through `onIcen`.

## 1. Install the right granularity

```bash
bun add @icen.ai/ui && bunx @icen.ai/ui list   # all 114 slugs
bunx @icen.ai/ui add btn charts kb             # per-slug import lines; kb = whole evidence family in one slug
```

- Whole library: `@import '@icen.ai/ui/ui.css';`
- One component, css+js in one line: `import '@icen.ai/ui/kit/btn';`
- Behavior only: `import { renderChart } from '@icen.ai/ui/behaviors/charts';`
- Machine-readable slug list: `@icen.ai/ui/registry.json`.

## 2. Chart playbook (most requested)

Pick the type from the data shape, then render via ONE entry point — `renderChart(el, spec)` takes pure JSON
(omit `type` and `inferChartType` picks it: date / 年月 / weekday / semver / bare-year labels → line).

| Data shape | Type |
| --- | --- |
| Time / version sequence (trend) | `line` (fill → `area`) |
| Parts of a whole | `donut` (single bar → `stack`) |
| Compare few categories | `vbar` (`stacked: true` for multi-series) |
| Many categories / long labels | `hbar` |
| Calendar activity (GitHub-style) | `calendar` |
| Density matrix (dow × hour) | `heatmap` |
| Correlation / 3 dims | `scatter` (x / y / size) |
| Relations / network (nodes + edges) | `graph` — `renderGraph` + `layoutGraph` (deterministic, drag relaxes locally) |
| Geo / positioned points (x, y) | `map` — `renderMap` |
| Multi-axis quality snapshot | `radar` |
| Single KPI | `gauge`; inline trend | `sparkline` |

`graph` / `map` live outside the published `ChartType` union — call `renderGraph` / `renderMap` directly,
not `renderChart({ type: 'graph' })`.

```ts
import { renderChart } from '@icen.ai/ui/behaviors/charts';
const c = renderChart(el, { type: 'line', title: '各版本能力数', labels, series: [{ name: '组件', values }], format: { unit: ' 个' } });
c.on('click', (e) => { /* e.detail: { index, seriesIndex, seriesName, label, value, pointerX, pointerY } */ });
// hover/out/dblclick/contextmenu + legend-toggle all built in; tooltip portal on by default;
// header carries the legend eye (show/hide all metrics). update(spec) re-renders, destroy() cleans up.
```

AI-driven rendering (model calls the tool): `createAiToolArea(mount, { tools: ['render_chart'], max: 4 })`
from `behaviors/ai-tools`; export schemas to the model with `aiToolsToOpenAI() / aiToolsToMcp()`.

## 3. AI chat wiring in 5 steps

1. **Provider**: `createAiClient({ provider, model, apiKey })` (`behaviors/ai-provider`) — `chat()` or
   `stream()` (SSE); audit via `createAiAuditor()`; per-request `icen:ai-done` carries usage/cost/ttftMs.
2. **Composer**: `initAiComposer(el)` + `setComposerModels(el, listAiProviders(), { provider, model })`.
3. **Zero-wiring bind**: `bindComposer(composer, { client, messages: chatEl })` — send → stream → stop →
   queue → error → usage ring, all closed-loop in one line.
4. **Live artifacts**: `renderAiToolCall` / `renderAiSubagent` (7-state machine
   `pending|running|streaming|approval|done|error|cancelled`); todos as industry pattern — collapsed
   TodoWrite card in the flow + `setComposerTodo(composer, items)` chip at the input (x/y, is-done/is-error).
   Session UX: `ai-threads` (thread tree), `ai-branch` (message branch switcher), `ai-feedback`
   (👍👎 + reason popover, event carries the anchor el).
5. **Context drawer**: `renderAiContext(el, { usage, audit, files, mcpServers, skills })` + trigger
   `data-ai-context-open`; multimodal messages pass parts arrays (`text|image|audio|video|file|resource_link`),
   normalized from OpenAI/Anthropic/MCP wire formats by `normalizeContentParts`.

## 4. KB playbook — RAG / knowledge-base evidence UI

Reach for the kb family (32 slugs, `icen:kb-*` events) when the product must show **where knowledge came
from and whether it can be trusted**. Division of labor: ai family narrates the process (thinking), kb family
presents evidence (sources / trust / usage); the permission domain presents boundaries (who sees what, why).

| Need | Domain → slugs |
| --- | --- |
| Inline `[n]` marks / source lists / passage re-read / conflicts | evidence: `kb-citation kb-sources kb-passage kb-conflict` |
| Ingest pipelines / chunk review / connectors / Q&A pairs | ingest: `kb-pipeline kb-chunks kb-segment kb-connector kb-metadata kb-qa` |
| Retrieval tuning / filter builder / rerank A-B / recall tests | retrieval: `kb-retrieval kb-filter kb-rerank kb-hittest` |
| NL→SQL / answers w/ honest truncation / clarify | data: `kb-sql kb-answer kb-clarify` |
| Trace / human review / knowledge gaps / eval | governance: `kb-explain kb-trace kb-review kb-gap kb-eval` |
| Canvas / checkpoints / MCP sandbox / chains | workbench: `kb-canvas kb-checkpoint kb-sandbox kb-chain` |
| Who can see what & why | permissions: `kb-acl kb-who-can kb-access kb-audit kb-visibility` |

```ts
import { renderCitationText, initKbCitation } from '@icen.ai/ui/behaviors/kb-citation';
import { parseInlineCitations, normalizeCitation, evaluateAcl, scorePercent } from '@icen.ai/ui/behaviors/kb-core';
import { createKbRetrieval } from '@icen.ai/ui/behaviors/kb-retrieval';
import { createKbFilter } from '@icen.ai/ui/behaviors/kb-filter';

renderCitationText(el, text, sources);                  // [1][2] in text → interactive marks
initKbCitation();                                       // page-wide delegation (idempotent)
const filter = createKbFilter(el, { node, fields, onChange });  // tree → serialize('mongo'|'odata') dual DSL
```

- Business data ALWAYS passes kb-core normalize first (`normalizeCitation` / `normalizeChunk` / …, 60+ in
  `behaviors/kb-core`); never hand-shape component props from raw payloads.
- **Score discipline** (family-wide): score always carries metric + higherIsBetter (l2 auto-inverted);
  null / missing renders `—`, never guessed, never zero.
- **Permission discipline** (spec §9.0, non-negotiable): retrieval isolation = query-time **pre-filter** only;
  honest to the authorized side, silent to the restricted side — no culled counts / titles / scores, and
  "don't know" is indistinguishable from "can't say"; `evaluateAcl(entries, identity)` = explicit deny →
  allow union → default deny (fail-closed); identities come from a server-fixed set, never free input.
  `kb-visibility`'s admin contrast view is the only sanctioned exception and ships its own warning bar.

## 5. Events, gestures & controls

- ONE listener entry: `onIcen(el, 'icen:chart-click', fn)` — typed `IcenEventMap`, selector delegation,
  `{ within, signal, once }` options; emitting goes through `emitIcen` only; `setEventPolicy` overrides
  default browser actions for gesture events.
- Declarative gestures on any container: `data-gestures="click dblclick contextmenu longpress text-select"`
  (space-separated; movement guard + disambiguation built in). Call `initGestures()` once per page.
- Pure-CSS controls get behavior from `behaviors/controls`: `initSwitch` (switch / tri-state / radio group),
  `initStepper`, `initSegmented`, `initSteps`, `initRating`, `initPagination`, `initTableSort` — each emits
  `icen:*-change`.

## 6. Theme / dark mode / density

- Presets are classes on `<html>`: `clay` (default) / `piano` / `art` / `vangogh` / `ink` / `retro`; pair with
  `dark` (`class="piano dark"`). Style profiles: `.style-modern / .style-retro / .style-terminal`
  (retro-effects.css activates pixel chrome under `.style-retro` only).
- Density per container: `data-density` attribute. Never hardcode colors/radii/motion — consume `--token-*`.

## 7. Pitfalls checklist

- Unstyled components → `tokens.css` missing or imported after component CSS.
- Astro shows raw unstyled kit components → css import shaken from client bundle; move to layout frontmatter.
- Tool-call card input renders as JSON and looks "collapsed" → by design (machine data folds); chart/error/
  approval/multimodal outputs expand by default.
- Usage ring vs billing: ring uses `contextEstimate(history)`, audit/billing uses response `normalizeUsage` +
  `estimateCost` — don't mix the two口径.
- KB score `null` turned into a number (or direction guessed/inverted) — must render `—` per score discipline.
- Hand-writing kb DOM instead of `render*` / `init*` — DOM contracts live on each docs page; don't replicate.

## 8. When NOT to use this library

- Needs a virtualized 100k-row grid, WebGL, or SSR framework components with hydration — not this library.
- Project already standardizes on another design system — do not mix two token systems in one app.
- Pure chat chrome with no evidence/permission surface — the ai family alone is enough; don't pull kb slugs.
