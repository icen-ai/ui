// kb-core 契约层语义测试：evaluateAcl 求值矩阵 / scorePercent 分数纪律 / 过滤器双 DSL。
// 语义源：src/behaviors/kb-core.ts（spec §9：先显式 deny → allow 并集 → 默认拒绝）。
import { describe, expect, test } from 'bun:test';
import {
  evaluateAcl, filterToMongo, filterToOData, scorePercent,
  type KbAclEntry, type KbFilterNode, type KbIdentity, type KbSubject,
} from '../../src/behaviors/kb-core';

const user = (id: string, label = id): KbSubject => ({ kind: 'user', id, label });
const group = (id: string, label = id): KbSubject => ({ kind: 'group', id, label });
const org = (): KbSubject => ({ kind: 'org', id: 'org', label: '全员' });
const link = (id: string): KbSubject => ({ kind: 'link', id, label: '链接' });

const ID: KbIdentity = { user: 'u1', groups: ['eng'] };

describe('evaluateAcl（spec §9：deny 一票否决 → allow 并集 → fail-closed）', () => {
  test('显式 deny 优先于一切 allow（deny 置顶红，角色清空）', () => {
    const entries: KbAclEntry[] = [
      { subject: user('u1'), role: 'viewer' },
      { subject: group('eng'), role: 'editor' },
      { subject: user('u1'), role: 'viewer', deny: true },
    ];
    const d = evaluateAcl(entries, ID);
    expect(d.role).toBeNull();
    expect(d.deniedBy?.id).toBe('u1');
    expect(d.chain).toHaveLength(3); /* 原因链保留全部命中（deny + 两条 allow） */
  });

  test('deny 分支连 summaryAllowed 一并压掉（对受限侧沉默）', () => {
    const d = evaluateAcl([{ subject: user('u1'), role: 'viewer', deny: true }], ID, {
      summaryAllowed: true,
      discoverable: true,
    });
    expect(d.role).toBeNull();
    expect(d.visibility).toBe('metadata'); /* summary 被否决，只剩元数据态 */
  });

  test('多 allow 取并集：viewer + editor → editor（权限序最大，非 first-match）', () => {
    const d = evaluateAcl(
      [
        { subject: user('u1'), role: 'viewer' },
        { subject: group('eng'), role: 'editor' },
      ],
      ID,
    );
    expect(d.role).toBe('editor');
    expect(d.visibility).toBe('full');
    expect(d.deniedBy).toBeUndefined();
  });

  test('无任何匹配 → null + 默认拒绝（fail-closed，不猜权限）', () => {
    const d = evaluateAcl([{ subject: user('stranger'), role: 'owner' }], ID);
    expect(d.role).toBeNull();
    expect(d.visibility).toBe('metadata'); /* 缺省可见存在 */
    expect(d.chain).toHaveLength(0);
  });

  test('policy.discoverable=false 时无匹配 → hidden（检索/列表/计数都不出现）', () => {
    const d = evaluateAcl([], ID, { discoverable: false });
    expect(d.role).toBeNull();
    expect(d.visibility).toBe('hidden');
  });

  test('org 主体全员命中；link 主体不参与身份求值', () => {
    expect(evaluateAcl([{ subject: org(), role: 'commenter' }], ID).role).toBe('commenter');
    expect(evaluateAcl([{ subject: link('tok'), role: 'owner' }], ID).role).toBeNull();
  });

  test('expiresAt：过期授权自动回收不计入求值；decision 携带最近将来到期；now 可注入', () => {
    const now = new Date('2026-10-06T00:00:00.000Z');
    const iso = (s: string): string => new Date(s).toISOString();
    const d = evaluateAcl(
      [
        { subject: user('u1'), role: 'viewer', expiresAt: iso('2026-10-01') }, /* 已过期 → 回收 */
        { subject: group('eng'), role: 'editor', expiresAt: iso('2026-10-13') },
        { subject: group('eng'), role: 'owner', expiresAt: iso('2020-01-01') }, /* 已过期 → 回收 */
      ],
      ID,
      undefined,
      now,
    );
    expect(d.role).toBe('editor'); /* 过期 owner 被回收，并集只取存活授权 */
    expect(d.expiresAt).toBe(iso('2026-10-13')); /* 倒计时取存活授权中最近将来 */

    /* 全过期 → 视同无权限（fail-closed，spec §9.0-7） */
    const allExpired = evaluateAcl(
      [{ subject: user('u1'), role: 'owner', expiresAt: iso('2020-01-01') }],
      ID,
      undefined,
      now,
    );
    expect(allExpired.role).toBeNull();

    /* 过期 deny 同样回收：不再一票否决 */
    const expiredDeny = evaluateAcl(
      [
        { subject: user('u1'), role: 'viewer', deny: true, expiresAt: iso('2020-01-01') },
        { subject: user('u1'), role: 'viewer' },
      ],
      ID,
      undefined,
      now,
    );
    expect(expiredDeny.role).toBe('viewer');
    expect(expiredDeny.deniedBy).toBeUndefined();

    const none = evaluateAcl([{ subject: user('u1'), role: 'viewer' }], ID);
    expect(none.expiresAt).toBeUndefined();

    const denied = evaluateAcl([{ subject: user('u1'), role: 'viewer', deny: true, expiresAt: iso('2026-10-13') }], ID);
    expect(denied.expiresAt).toBeUndefined(); /* deny 分支无到期倒计时 */
  });
});

describe('scorePercent（l2 距离反转；null 不渲染条）', () => {
  test('越大越好语义直接归一', () => {
    expect(scorePercent(0.73)).toBe(73);
    expect(scorePercent(0.73, 'cosine')).toBe(73);
    expect(scorePercent(50, 'bm25', 200)).toBe(25);
  });

  test('l2 距离反转（越小越好 → 离 0 越近占比越高）', () => {
    expect(scorePercent(0.1, 'l2')).toBe(90);
    expect(scorePercent(0, 'l2')).toBe(100);
    expect(scorePercent(1, 'l2')).toBe(0);
  });

  test('null / undefined / NaN → null（无分命中是一等状态）', () => {
    expect(scorePercent(null)).toBeNull();
    expect(scorePercent(undefined, 'cosine')).toBeNull();
    expect(scorePercent(Number.NaN)).toBeNull();
  });

  test('夹取到 0–100（条长度不越界）', () => {
    expect(scorePercent(1.4)).toBe(100);
    expect(scorePercent(-0.2)).toBe(0);
    expect(scorePercent(400, 'l2', 100)).toBe(0);
  });
});

describe('filterToMongo / filterToOData（同一 KbFilterNode 双 DSL 输出）', () => {
  const node: KbFilterNode = {
    type: 'group',
    op: 'and',
    children: [
      { type: 'rule', field: 'status', op: 'eq', value: 'published' },
      {
        type: 'group',
        op: 'or',
        children: [
          { type: 'rule', field: 'year', op: 'gte', value: 2020 },
          { type: 'rule', field: 'title', op: 'contains', value: 'RAG Guide' },
        ],
      },
      { type: 'rule', field: 'deleted', op: 'exists', value: false },
      { type: 'rule', field: 'tags', op: 'in', value: ['a', 'b'] },
    ],
  };

  test('Mongo 快照：$and/$or 嵌套 + $regex 转义 + $exists 反转 + $in 数组', () => {
    expect(filterToMongo(node)).toEqual({
      $and: [
        { status: { $eq: 'published' } },
        {
          $or: [
            { year: { $gte: 2020 } },
            { title: { $regex: 'RAG Guide', $options: 'i' } },
          ],
        },
        { deleted: { $exists: false } },
        { tags: { $in: ['a', 'b'] } },
      ],
    });
  });

  test('OData 快照：and/or 括号包络 + ge/contains 函数 + eq null 形态 + in 列表', () => {
    expect(filterToOData(node)).toBe(
      "(status eq 'published') and ((year ge 2020) or (contains(title,'RAG Guide'))) and (deleted eq null) and (tags in ('a','b'))",
    );
  });

  test('无效/空输入：Mongo 返 null，OData 返空串（诚实纪律，不猜）', () => {
    expect(filterToMongo(null)).toBeNull();
    expect(filterToMongo(undefined)).toBeNull();
    expect(filterToOData(null)).toBe('');
    expect(filterToOData({ type: 'rule', op: 'eq' } as unknown as KbFilterNode)).toBe(''); /* 无 field → normalize 丢弃 */
  });

  test('OData 字符串引号转义；contains 的 Mongo 正则元字符转义', () => {
    const quote: KbFilterNode = { type: 'rule', field: 'name', op: 'eq', value: "o'clock" };
    expect(filterToOData(quote)).toBe("name eq 'o''clock'");
    const regex: KbFilterNode = { type: 'rule', field: 'v', op: 'contains', value: '1.5*' };
    expect(filterToMongo(regex)).toEqual({ v: { $regex: '1\\.5\\*', $options: 'i' } });
  });
});
