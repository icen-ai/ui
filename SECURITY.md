# 安全政策

最后更新：2026-10-19。

本文面向两类读者：想**报告漏洞**的人，和需要在评审/采购环节快速建立**工程信任**的人。我们只写可以验证的事实，不做空头承诺。

## 支持版本

| 版本线 | 状态 | 说明 |
| --- | --- | --- |
| 0.10.x | **当前线** | 接收全部修复（安全 + bug + 功能） |
| 更早版本线 | 停止支持 | 不再接收任何修复 |

诚实声明：这是一个 0.x 的设计系统库，由小团队维护，**没有付费支持合同，也没有 24 小时值班 SLA**。但我们对以下承诺负责，并且每一条都有机器可验证的机制支撑（见「安全设计要点」）。

## 报告漏洞

**首选渠道：GitHub Security Advisories（私密）**

<https://github.com/icen-ai/ui/security/advisories/new>

Private vulnerability report 只对维护者可见，适合先保密、协商修复窗口的常规流程。

**兜底渠道：邮件**

`security@icen.ai`

适合无法使用 GitHub 的场景（例如你所在组织禁止在第三方平台提交安全信息）。请在邮件中附：受影响版本、复现步骤或最小 PoC、影响评估（如有）。

请不要对含 exploit 细节的公开 issue 直接开单——先用上述私密渠道。

## 响应承诺

- **72 小时内确认收到**：你会得到一条回复，确认漏洞已登记，并给出初步严重程度判断；72 小时是上限，不是目标。
- **修复节奏**：确认后按严重程度排期——高危（可导致消费方应用 XSS / 权限绕过）优先于一切功能开发，并尽量在公开细节之前备好修复版本。
- **披露**：默认遵循「修复发布后再公开细节」；如果你更倾向协调披露（coordinated disclosure），在首次联系时说明即可。
- **不会发生的事**：不会要求你签署 NDA 才受理报告；不会因为报告问题而追究善意研究者的责任。

如果我们的响应没有达到上述承诺，你有权把细节公开——这写在这里，就是让你可以引用它。

## 安全设计要点（评审速览）

以下每一条都由 CI 上的守卫/测试机器强制执行（`bun run guard` + `bun test`），不是文档口号：

1. **textContent-only 渲染纪律**：所有行为模块（`src/behaviors/*.ts`）对用户可见文本一律写 `textContent`，**禁止 `innerHTML =`**（清空 `= ''` 与一处登记的图标槽位契约除外，见 `scripts/guard/behavior-discipline.ts` 的 ALLOWLIST 及理由）。渲染类注入（XSS 主入口）在源头被堵死。
2. **SSR 守卫**：凡引用 `document` / `window` 的模块必须含 `typeof document === 'undefined'` 形态守卫——服务端渲染场景不会在 import 期炸掉。守卫逐文件核对。
3. **事件契约编译期校验**：自定义事件统一 `icen:` 前缀，detail 契约全量登记 `IcenEventMap`；事件守卫双向核对（发射侧字面量 × 登记表），拼错事件名或 detail 不符在编译期/CI 报错，禁止裸写 `new CustomEvent`。
4. **权限域 fail-closed 语义**：知识库权限域的求值 `evaluateAcl(entries, identity)` 是纯函数——先显式 deny → allow 并集 → **默认拒绝**；当前时间经 `now` 参数注入（守卫钉死，禁直读 `Date.now()`，求值可复现可测试）。检索期隔离唯一安全基线是 query-time pre-filter，「不知道」与「不能说」不可区分等纪律由 `tests/kb-conformance.test.ts` 逐条自动化证明，泄露文案模式由守卫扫描。
5. **OIDC provenance 发布链**：发包只经 GitHub Actions 的 OIDC trusted publishing（打 `v*` tag 触发），**不存在任何长期 npm token**；npm 包设置已设为「Require 2FA and disallow tokens」——除这条 CI 外没有任何凭据能发包。每次发布带 npm provenance 声明，可独立审计。
6. **零运行时依赖**：`dependencies` 为空（react/react-dom/vue 均为 optional peer，不装不影响核心库）。供应链攻击面 = 你自己的锁文件 + 这一个包，没有传递依赖树可被破坏。
7. **12 项纪律守卫**：CSS 纪律 / registry 一致性 / 事件双向核对 / 行为模块纪律（SSR + innerHTML 禁令）/ 命名空间碰撞面（对 Bootstrap 5 全量核心 + Tailwind 常见层 59 类基线恒零碰撞）/ 权限域诚实呈现扫描 / 分层依赖方向（Core 不运行时依赖 Beta）——任一违规 CI 即红，无法合入。
8. **cascade layers 隔离**：全部产物 CSS 包在 `@layer icen.*` 内，消费方自己的无层样式永远赢库样式——库的样式不会意外覆盖你应用的安全相关样式（如 `display: none` 的敏感区）。
9. **URL 协议守卫**：不可信输入（模型输出 / 知识库元数据 / 宿主透传）落成 `href` / `src` 前一律过 `safeUrl`（`src/behaviors/url-safety.ts`，ai-chat / kb-explain / notification 同源共用）——按 WHATWG 归一（剥控制字符与首尾空白、小写化）后拒绝 `javascript:` / `vbscript:` / `data:text/html`。对抗语料（大小写变体、内嵌 tab/LF/CR、C0 控制字符前缀、percent 双重编码、HTML 实体、全角变体等 51 条）逐条注明意图并固化在 `tests/unit/url-safety.test.ts`，配合 23 条槽位端对端断言（链接不落 `href`、部件不渲染、兜底不缺席）——绕过尝试的回归由 `bun test` 强制执行。

## 已知边界（诚实清单）

- 库不处理认证、不存储用户数据，威胁模型集中在「渲染注入 + 供应链 + 权限呈现语义」三类。
- 权限域组件的正确性依赖**宿主传入真实身份与 ACL 数据**——组件保证呈现语义 fail-closed 与诚实，但喂给它伪造的身份集不是它能防御的范围（规格 `docs/spec/kb-family.md` §9.0 有完整边界声明）。
- 0.x 期间破坏性变更只在 minor 发生，CHANGELOG 逐条写明契约变化；版本纪律见 [docs/versioning.md](./docs/versioning.md)。
