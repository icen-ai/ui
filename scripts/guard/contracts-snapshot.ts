/*
 * 守卫：契约快照漂移（公共 API 面 vs docs/contracts/snapshot.json）。
 * 实现复用 scripts/contracts.ts（单一事实源）；移除/改名按 docs/versioning.md
 * 属破坏性变更必须公告，新增扩面需更新快照随 PR 提交——两者都拦。
 */
import type { GuardResult } from './shared';
import { checkDrift } from '../contracts';

export async function checkContractsSnapshot(): Promise<GuardResult> {
  return {
    title: '契约快照（类名 / data 属性 / CSS 变量 / 事件 / JS 导出 / 类型签名 vs snapshot.json）',
    violations: await checkDrift(),
  };
}
