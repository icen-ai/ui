// evaluateAcl 语义矩阵锁定（spec §9：权限域求值契约的自动化证明）。
// 语义源：src/behaviors/kb-core.ts（先显式 deny → allow 并集取最高角色 → 默认拒绝 fail-closed；
// expiresAt 到期自动回收——过期条目不计入求值，全部过期 = 无授权）。
// now 一律显式注入：求值必须可复现，不依赖墙钟。
import { describe, expect, test } from 'bun:test';
import {
  evaluateAcl,
  KB_ROLES,
  type KbAclEntry,
  type KbIdentity,
  type KbSubject,
} from '../../src/behaviors/kb-core';

const NOW = new Date('2026-10-06T00:00:00.000Z');
const iso = (s: string): string => new Date(s).toISOString();
const FUTURE = iso('2026-12-01');
const PAST = iso('2020-01-01');

const user = (id: string, label = id): KbSubject => ({ kind: 'user', id, label });
const group = (id: string, label = id): KbSubject => ({ kind: 'group', id, label });
const org = (label = '全员'): KbSubject => ({ kind: 'org', id: 'org-1', label });
const anyone = (): KbSubject => ({ kind: 'anyone', id: 'anyone', label: '任何人' });
const link = (id: string): KbSubject => ({ kind: 'link', id, label: '链接' });

const ID: KbIdentity = { user: 'u1', groups: ['eng', 'design'] };

describe('求值主序：deny → allow 并集 → fail-closed', () => {
  test('deny 优先于一切 allow（含 inherited 来源的 deny）', () => {
    const d = evaluateAcl(
      [
        { subject: user('u1'), role: 'viewer' },
        { subject: group('eng'), role: 'editor', inheritedFrom: '父空间' },
        { subject: group('design'), role: 'viewer', deny: true, inheritedFrom: 'DLP 策略' },
      ],
      ID,
      undefined,
      NOW,
    );
    expect(d.role).toBeNull();
    expect(d.deniedBy?.id).toBe('design'); /* deny 置顶呈现的来源 */
    expect(d.chain.length).toBe(3); /* 原因链保留全部命中（授权侧诚实） */
  });

  test('多 allow 并集取最高角色（KB_ROLES 单调序，非 first-match）', () => {
    /* viewer < commenter < editor < owner：两两组合都要并到高者 */
    const pairs: Array<[KbAclEntry['role'], KbAclEntry['role']]> = [
      ['viewer', 'commenter'],
      ['commenter', 'editor'],
      ['editor', 'owner'],
      ['owner', 'viewer'],
    ];
    for (const [a, b] of pairs) {
      const hi = KB_ROLES[Math.max(KB_ROLES.indexOf(a), KB_ROLES.indexOf(b))];
      const d1 = evaluateAcl(
        [
          { subject: user('u1'), role: a },
          { subject: group('eng'), role: b },
        ],
        ID,
        undefined,
        NOW,
      );
      expect(d1.role).toBe(hi);
      /* 输入序反转结论不变（并集与顺序无关） */
      const d2 = evaluateAcl(
        [
          { subject: group('eng'), role: b },
          { subject: user('u1'), role: a },
        ],
        ID,
        undefined,
        NOW,
      );
      expect(d2.role).toBe(hi);
    }
  });

  test('无匹配 → role null + 默认拒绝（fail-closed，不猜权限）', () => {
    const d = evaluateAcl([{ subject: user('stranger'), role: 'owner' }], ID, undefined, NOW);
    expect(d.role).toBeNull();
    expect(d.deniedBy).toBeUndefined(); /* 无显式 deny——只是没命中，不是被拒绝 */
    expect(d.chain).toHaveLength(0);
  });

  test('空条目集 / 空身份 → 同样 fail-closed（诚实 null，不猜）', () => {
    expect(evaluateAcl([], ID, undefined, NOW).role).toBeNull();
    const noId = evaluateAcl([{ subject: user('u1'), role: 'viewer' }], {} as KbIdentity, undefined, NOW);
    expect(noId.role).toBeNull(); /* 身份缺 user 字段 → normalize 为 ''，匹配不到任何 user 条目 */
  });
});

describe('expiresAt：到期自动回收（spec §9.0-7）', () => {
  test('过期 grant 不计入角色并集；decision 携带存活授权中最近的 expiresAt（倒计时数据源）', () => {
    const d = evaluateAcl(
      [
        { subject: user('u1'), role: 'viewer', expiresAt: PAST },
        { subject: group('eng'), role: 'editor', expiresAt: iso('2026-10-13') },
        { subject: group('design'), role: 'owner', expiresAt: PAST },
      ],
      ID,
      undefined,
      NOW,
    );
    expect(d.role).toBe('editor');
    expect(d.expiresAt).toBe(iso('2026-10-13'));
  });

  test('全部过期 → 视同无权限（fail-closed），原因链清空（过期不是理由）', () => {
    const d = evaluateAcl([{ subject: user('u1'), role: 'owner', expiresAt: PAST }], ID, undefined, NOW);
    expect(d.role).toBeNull();
    expect(d.chain).toHaveLength(0);
  });

  test('过期 deny 同样回收：不再一票否决，存活 allow 生效', () => {
    const d = evaluateAcl(
      [
        { subject: user('u1'), role: 'viewer', deny: true, expiresAt: PAST },
        { subject: user('u1'), role: 'commenter', expiresAt: FUTURE },
      ],
      ID,
      undefined,
      NOW,
    );
    expect(d.role).toBe('commenter');
    expect(d.deniedBy).toBeUndefined();
  });

  test('now 注入决定生死：同一组条目随 now 前后结论翻转（求值可复现）', () => {
    const entries = [{ subject: user('u1'), role: 'editor', expiresAt: iso('2026-10-07') }];
    expect(evaluateAcl(entries, ID, undefined, new Date('2026-10-06T00:00:00.000Z')).role).toBe('editor');
    expect(evaluateAcl(entries, ID, undefined, new Date('2026-10-08T00:00:00.000Z')).role).toBeNull();
  });

  test('expiresAt 不可解析 → 视为永不过期（normalize 诚实缺省，不猜回收）', () => {
    const d = evaluateAcl(
      [{ subject: user('u1'), role: 'viewer', expiresAt: 'not-a-date' }],
      ID,
      undefined,
      NOW,
    );
    expect(d.role).toBe('viewer');
    expect(d.expiresAt).toBeUndefined(); /* 不可解析的到期不进倒计时 */
  });

  test('永不过期（缺省）与限时授权并存 → expiresAt 只反映限时的', () => {
    const d = evaluateAcl(
      [
        { subject: user('u1'), role: 'viewer' },
        { subject: group('eng'), role: 'commenter', expiresAt: FUTURE },
      ],
      ID,
      undefined,
      NOW,
    );
    expect(d.role).toBe('commenter');
    expect(d.expiresAt).toBe(FUTURE);
  });
});

describe('身份集：组 / org / anyone / link（spec §9.0-8，固定身份集）', () => {
  test('identity.groups 参与组条目匹配', () => {
    const d = evaluateAcl([{ subject: group('design'), role: 'editor' }], ID, undefined, NOW);
    expect(d.role).toBe('editor');
  });

  test('kind:org 条目对该组全体成员生效', () => {
    const member: KbIdentity = { user: 'u-anyone', groups: [] };
    expect(evaluateAcl([{ subject: org(), role: 'commenter' }], member, undefined, NOW).role).toBe('commenter');
  });

  test('kind:anyone 对任意身份生效', () => {
    const anon: KbIdentity = { user: 'guest-1', groups: [] };
    expect(evaluateAcl([{ subject: anyone(), role: 'viewer' }], anon, undefined, NOW).role).toBe('viewer');
  });

  test('kind:link 不参与身份求值（独立呈现、独立可撤销）', () => {
    const d = evaluateAcl([{ subject: link('tok-1'), role: 'owner' }], ID, undefined, NOW);
    expect(d.role).toBeNull();
  });

  test('user 条目只认本人（id 或 label 命中），不串他人', () => {
    expect(evaluateAcl([{ subject: user('u2') }], ID, undefined, NOW).role).toBeNull();
    expect(evaluateAcl([{ subject: user('u1', '张三') }], { user: '张三', groups: [] }, undefined, NOW).role).toBe(
      'viewer',
    );
  });
});

describe('normalize 兜底：缺字段诚实收敛，不猜（spec §9.6）', () => {
  test('条目缺 role → viewer；缺 subject → user 型空 id（匹配不到人）', () => {
    const d = evaluateAcl([{} as KbAclEntry], ID, undefined, NOW);
    expect(d.role).toBeNull(); /* 空 id 主体匹配不到 u1 */
  });

  test('身份缺 groups → 空数组（组条目不再命中）；条目类型宽进（素对象直接喂）', () => {
    const d = evaluateAcl(
      [{ subject: { kind: 'group', id: 'eng', label: 'eng' }, role: 'editor' }],
      { user: 'u1' } as KbIdentity,
      undefined,
      NOW,
    );
    expect(d.role).toBeNull();
    expect(d.chain).toHaveLength(0);
  });

  test('policy.discoverable=false 且无权限 → hidden（与「不知道不可区分」对齐）', () => {
    const d = evaluateAcl([{ subject: user('u1'), role: 'viewer', deny: true }], ID, { discoverable: false }, NOW);
    expect(d.role).toBeNull();
    expect(d.visibility).toBe('hidden');
  });
});
