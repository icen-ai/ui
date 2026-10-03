## What it is

Task playbooks for the ICEN design system (@icen.ai/ui). When you say "draw a chart", "wire an AI chat", "build a knowledge-base UI", "switch the theme", or "install a few components", the AI follows a playbook instead of guessing APIs — picking the right chart type, wiring the chat loop in five steps, choosing evidence components by domain, and installing exactly the right granularity.

## What it does

- **Charts, decided for you**: describe the data shape (time series / parts-of-whole / comparison / calendar activity / correlation / network graph / map…) and get the correct chart type rendered from one pure-JSON spec — hover, click, double-click, right-click, and the legend eye are all built in
- **AI chat in five steps**: from provider setup to streaming, tool-call cards, todo state, usage and audit — one zero-wiring binding closes the loop
- **Knowledge-base evidence family**: everything a RAG product needs to show where knowledge came from — inline citations, source lists, retrieval tuning, rerank A/B, NL2SQL answers, eval and governance, plus permission boundaries (who can see what, and why); the "honest to the authorized, silent to the restricted" discipline is built into the components
- **Theme & dark mode**: six color presets × three style profiles × light/dark, switched in one sentence without hardcoding a single color
- **Install on demand**: 114 components addressable per slug (CLI / one-line kit entries / registry.json), zero dependency, no framework binding

## Facts and playbooks, separated

The single source of API truth lives inside the npm package (AGENTS.md + type declarations); this skill only decides when and which path — it never drifts from the package.

## Who it's for

Developers in any stack (vanilla / React / Vue / Astro) who want a restrained design system their AI can drive directly.
