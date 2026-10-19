# React / Vue 官方封装：兼容契约矩阵

本文是 `@icen.ai/ui/react` 与 `@icen.ai/ui/vue` 的**承诺面**：每一行行为声明都给出
代码或测试的证据指针。封装哲学是「薄如蝉翼」——不复制状态、不重新实现组件，
只做生命周期接线、事件桥与类型面 re-export，底下是同一个命令式内核。

行为级证据：`tests/unit/react-wrapper.test.tsx`（StrictMode 双挂载 / 卸载清理 /
opts 更新路径 / handleRef 生命周期 / 事件桥解绑）与 `tests/unit/vue-wrapper.test.ts`
（mounted/unmounted 配对 / deep watch 更新 / getHandle / emits 桥解绑）。

## 支持矩阵

| 维度 | React 封装 | Vue 封装 | 证据 |
| --- | --- | --- | --- |
| 版本范围 | `react >= 18`（peer，可选依赖；开发与 CI 验证线 = 19.x） | `vue >= 3.3`（peer，可选依赖） | `package.json` peerDependencies |
| 形态 | 工厂 `createIcenComponent` + `useIcenInit` / `useIcenEvent` 原语 | `createVueRenderer` + `useIcenInit` / `useIcenEvent`；`defineComponent + h()`，无 SFC | `src/react/index.tsx` / `src/vue/index.ts` |
| SSR | 安全：全部接线在 `useEffect`（服务端不执行）；服务端渲染结果 = 空容器 div | 安全：全部接线在 `onMounted` | 源码头注释；`tests/ssr-guard.test.ts` 全量静态扫描 |
| RSC | 模块顶部 `'use client'`（构建脚本保证产物保留） | N/A（Vue 无 RSC 概念） | `src/react/index.tsx:12` + `scripts/react-use-client.mjs` |
| Hydration | 无 mismatch：React 只渲染容器 div，内容由 effect 客户端填充 | 同左（render 函数只出容器 div） | 工厂实现 |
| StrictMode 双挂载 | 安全：mount effect 清理函数 destroy → 二次 setup 重建，create/destroy 严格配对、句柄不泄漏 | N/A（Vue 无等价机制） | react-wrapper 测试「StrictMode 双挂载」用例 |
| 组件卸载 | destroy + 事件桥解绑 + `handleRef.current = null` | destroy + emits 桥解绑，句柄经 `getHandle()` 失效 | 两套 wrapper 测试的卸载用例 |
| props/opts 更新 | `JSON.stringify` 稳定比较：可序列化 opts 变化 → `cfg.update`（缺省 destroy+同容器重建）；不可序列化 opts 恒不触发（契约要求 opts 纯 JSON） | opts prop `deep watch`：深层突变 → `cfg.update`（缺省 destroy+重建） | 两套 wrapper 测试的 update 用例 |
| 受控 / 非受控 | 声明式 opts 进 + 命令式句柄出（`handleRef`）；无内部复制状态 | 同左，句柄经 `expose({ getHandle })` + 模板 ref | 工厂 API |
| 事件 | `eventRoot: true` 时子树内全部 `icen:*` 经 `onEvent(type, detail)` 透出；`useIcenEvent` 原语带 `AbortController` 清理 | `events: ['ai-send']` 声明式注册，kebab 化 `@ai-send` 监听（`onAiSend`） | 两套 wrapper 测试的事件桥用例 |
| TypeScript | 类型面 re-export（`ChartSpec` / `TableOptions` / `AiMessageModel`…）；工厂泛型 `createIcenComponent<Opts, Handle>` | 同左；props 经 `PropType<Opts>` 标注 | 两文件 type re-export 段；`tsc --noEmit` 门 |

## 明确不在承诺面（边界诚实清单）

- **v-model / 双向绑定**：无。封装是「opts 单向进 + 句柄命令式出」，框架原生双向绑定语义不在薄封装职责内（Vue 消费方可用 `watch` + `getHandle()` 自行搭）。
- **slots / children 组合**：React 的 `eventRoot` 容器支持嵌套子组件；Vue 封装不提供 slot 面（内核是命令式渲染）。
- **provide / inject**：不使用、不透出。
- **CSS 引入**：封装层不引 CSS——消费方照常 `@import '@icen.ai/ui/tokens.css'` 与组件 CSS（Astro 项目注意在布局 frontmatter 引组件 CSS，见 AGENTS.md）。
- **多版本 React 同页 / legacy context**：未验证，不承诺。

## 已知缺口（挂 roadmap，工程项）

- [ ] CI 上 React 18 / 19 双版本验证线（当前只在 19.x 上跑契约测试）。
- [ ] RSC 实舱（Next.js App Server Component 直接 import 的负路径测试——预期报错信息友好）。
