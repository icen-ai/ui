# 主题系统兼容预算

主题、原语与 token 是差异化亮点，也是最容易造成**隐性破坏**的层——改名一个变量
不报错、不测试失败，只在消费方页面上悄悄变样。本文把「什么允许、什么必须公告、
什么机制在拦」一次钉死。

## 预算规则

1. **token 进 `tokens.css` 即公共 API。** 全部 `--icen-*` 变量在契约快照
   （`docs/contracts/snapshot.json`）留痕：新增须 `bun run contracts:update` 随 PR
   提交；移除 / 改名是 **Core 破坏性变更**，守卫直接红牌（见 versioning.md 纪律）。
2. **新增随时可以，静默重定义不行。** 给已有 token 换「含义」（例如把
   `--icen-token-text-muted` 的角色从正文次级改成装饰级）视同改名——CHANGELOG
   逐条公告，且必须附对比度影响说明。
3. **预设只增不改义。** 新预设随时可加（注册后进 `listThemePresets()` 枚举）；
   已有预设（modern / dongyun / jugou / piano / monet / vangogh）的语义 token
   不得重定义。**机制**：`tests/unit/design-tokens.test.ts` 校验 12 个预设块
   （6 预设 × 明暗）键集完全一致——新预设缺键、老预设改键都会红。
4. **原语同规。** modern / chinese / soviet / pixel 四套原语文件只做覆盖、不造
   孤儿 token（`token-references` 守卫校验引用闭合）。
5. **每次主题改动必须全量过四道门 + 视觉基线**，其中对比度是硬门：
   - `tests/unit/theme-colors.test.ts` —— 6 预设 × 明暗的对比度矩阵（正文 ≥ 4.5:1，
     组件边界 ≥ 3:1）；
   - `tests/unit/code-contrast.test.ts` / `token-references` 守卫；
   - `tests/e2e/visual.pw.ts` 视觉基线（主题改动须 `--update-snapshots` 同步提交）。
6. **设计工具导出与 CSS token 一致性。** DTCG（`bun run dtcg`）与 Tokens Studio /
   Figma（`bun run design-tokens`）从同一 `src/tokens/*.css` 生成；
   `design-tokens.test.ts` 校验导出完整性。已知诚实盲区：`color-mix()` 等非十六进制
   值在经典版 DTCG color 类型里**不可表示**（构建告警明示，不猜不近似）——这类
   token 在导出里缺席是已知事实，不是回归。

## 与分层的关系

token / 主题 / 原语全部属 **Core**（tiers.json），即 1.0 冻结轨道——主题面的
「稳定两个 minor」与组件契约同口径，由同一份契约快照机器判定。
