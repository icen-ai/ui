# 贡献指南

仓库约定的完整细节在 [AGENTS.md](./AGENTS.md)（也随 npm 包发布）；本文只保留上手所需。

## 环境

**Bun 1.3+**（仓库唯一的运行时与包管理器，CI 同款）。

```bash
git clone https://github.com/icen-ai/ui.git && cd ui
bun install
bun run verify    # tsc + 守卫 + 测试 + 构建 + 体积预算，全绿 = 可以提 PR
```

守卫红了先读它的输出——**每条违规文案自带修法**；确属例外的进对应守卫文件的 ALLOWLIST 并写清理由。守卫清单即 [scripts/guard/index.ts](scripts/guard/index.ts) 的注册表，本文不抄录（抄录必漂移）。

## 加组件

按顺序走；漏的每一步都有对应守卫拦下，但自己走一遍比被 CI 打回来快。

1. **CSS**：`src/components/<name>.css`，一文件一组件；头注释列出完整 DOM 契约（槽位 / 状态类 / data 钩子）。
2. **行为**（如有交互）：`src/behaviors/<name>.ts`——幂等 init、返回销毁函数、SSR 守卫、文本只写 `textContent`。
3. **登记 slug**：`scripts/slugs.mjs`（kit 入口 / CLI / registry / 文档站的共同事实源）。
4. **登记事件**：自定义事件统一 `icen:` 前缀，detail 契约登记进 `IcenEventMap`（`src/behaviors/events.ts`），派发只经 `emitIcen`。
5. **标分层**：`docs/contracts/tiers.json` 显式归类 core / beta / lab（图表 / AI / KB 新成员一律 beta）。
6. **契约留痕**：扩了公共面就跑 `bun run contracts:update` 随 PR 提交；移除/改名既有条目 = 破坏性变更，须进 CHANGELOG（CI 联动检查）。
7. **文档站条目**：`site/` 对应分组加一节（demo / 用法 / kit 三段齐全）；稳定性徽标与接口表自动生成。
8. **测试**：`tests/unit/<name>.test.ts`（纯契约）+ `tests/dom/<name>.test.ts`（委托行为）；改 kb 族权限语义时先改 `tests/kb-conformance.test.ts` 预期再改实现。

## PR 规范

- 一个 PR 一件事；重命名 / 格式化 / 行为变更分开提。
- 描述写清做了什么 + 为什么；破坏性变更必须显式标注（PR 模板里有检查单）。
- 贴 `bun run verify` 的输出结尾；任何一门红了先标 Draft。
- 改组件 = CSS 头注释 + 文档站 + 测试三处同 PR；只改文档站 typo 可以不带测试。

## AI 辅助

欢迎。仓库为「人和 AI 一起维护」设计：`AGENTS.md` 与站点的 `llms-full.txt` 是 AI 的输入面，类型真相在 `dist/*.d.mts`。守卫对 AI 生成的代码和人类写的同等待遇；PR 责任主体是你本人——请通读你提交的每一行。
