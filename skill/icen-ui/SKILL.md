---
name: icen-ui
name_zh: 冰点设计系统
name_en: ICEN Design System
description: Build production UI with @icen.ai/ui — a zero-dependency, framework-agnostic component library with a JSON-driven chart layer and an AI-native chat family. Use when the user wants to build or restyle interfaces, pick and render charts/dashboards/data visualization, wire an AI chat experience (streaming, tool calls, todos, usage/audit), switch themes/dark mode, or install UI components on demand in vanilla/React/Vue/Astro projects.
desc_zh: 用冰点设计系统搭界面：图表选型直出、AI 聊天五步接入、主题暗色一条龙，零依赖按需装。
desc_en: Build UI with the ICEN design system: chart picking, AI chat wiring, and theming recipes — zero dependency, install on demand.
version: 0.1.0
tags:
  - ui
  - design-system
  - charts
  - ai
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
---

# ICEN UI Playbooks

Task-driven playbooks for `@icen.ai/ui`. This skill decides **WHEN and WHICH**; exact signatures live in the
package itself — read them there, do not rely on memory:

| Truth | Where |
| --- | --- |
| Consumer quickstart + rules | `node_modules/@icen.ai/ui/AGENTS.md` (section 一) |
| Full type surface w/ constraint JSDoc | `node_modules/@icen.ai/ui/dist/behaviors/<module>.d.mts` |
| Full docs for RAG | <https://ui.icen.ai/llms-full.txt> (index: `/llms.txt`) |
| Interactive docs / DOM contracts | <https://ui.icen.ai/components/<slug>/> |

## 0. Ground rules (read before generating code)

- Zero dependency, ESM + TypeScript. Components = CSS + behavior JS; no framework binding — call behavior
  functions in React `useEffect` / Vue `onMounted`.
- ALWAYS `@import '@icen.ai/ui/tokens.css';` before any component CSS (everything consumes `--token-*`).
- **Astro trap**: css imports inside kit entries get tree-shaken in page `<script>` — import component CSS in
  the layout frontmatter instead. Vite SPA / webpack unaffected.
- Behaviors are idempotent and SSR-safe; rendering writes `textContent` only — never `innerHTML`.
- Custom events use the `icen:` prefix (`icen:chart-*`, `icen:ai-*`).

## 1. Install the right granularity

```bash
bun add @icen.ai/ui && bunx @icen.ai/ui list   # all 77 slugs
bunx @icen.ai/ui add btn charts                # print import lines per slug
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
| Multi-axis quality snapshot | `radar` |
| Single KPI | `gauge`; inline trend | `sparkline` |

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
5. **Context drawer**: `renderAiContext(el, { usage, audit, files, mcpServers, skills })` + trigger
   `data-ai-context-open`; multimodal messages pass parts arrays (`text|image|audio|video|file|resource_link`),
   normalized from OpenAI/Anthropic/MCP wire formats by `normalizeContentParts`.

## 4. Theme / dark mode / density

- Presets are classes on `<html>`: `clay` (default) / `piano` / `art` / `vangogh` / `ink` / `retro`; pair with
  `dark` (`class="piano dark"`). Style profiles: `.style-modern / .style-retro / .style-terminal`.
- Density per container: `data-density` attribute. Never hardcode colors/radii/motion — consume `--token-*`.

## 5. Pitfalls checklist

- Unstyled components → `tokens.css` missing or imported after component CSS.
- Astro shows raw unstyled kit components → css import shaken from client bundle; move to layout frontmatter.
- Tool-call card input renders as JSON and looks "collapsed" → by design (machine data folds); chart/error/
  approval/multimodal outputs expand by default.
- Usage ring vs billing: ring uses `contextEstimate(history)`, audit/billing uses response `normalizeUsage` +
  `estimateCost` — don't mix the two口径.

## 6. When NOT to use this library

- Needs a virtualized 100k-row grid, WebGL, or SSR framework components with hydration — not this library.
- Project already standardizes on another design system — do not mix two token systems in one app.
