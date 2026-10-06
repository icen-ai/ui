// kb-core 契约层补充测试（不与 kb-core.test.ts 撞车）：分段策略真实切分 / 连接器健康四态 /
// 评估四级判定 / 行内角标切段 / 访问申请归一 / 无效规则不进 DSL。
// 语义源：src/behaviors/kb-core.ts（§3 连接器 / §4 分段 / §9 权限域）。
import { describe, expect, test } from 'bun:test';
import {
  connectorHealth,
  evalGrade,
  filterToMongo,
  filterToOData,
  normalizeAccessRequest,
  parseInlineCitations,
  segmentStats,
  segmentText,
  type KbConnector,
  type KbFilterNode,
} from '../../src/behaviors/kb-core';

const NOW = new Date('2026-10-06T12:00:00.000Z');
const isoHoursAgo = (h: number): string => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('segmentText / segmentStats（真实切分非估算）', () => {
  test('auto 模式按 \\n\\n 分隔符切段并去空白；空文本返回 []', () => {
    const cfg = { mode: 'auto', maxLength: 500, overlap: 50, clean: [] } as const;
    expect(segmentText('第一段。\n\n第二段。\n\n\n\n第三段。', cfg as never)).toEqual(['第一段。', '第二段。', '第三段。']);
    expect(segmentText('   ', cfg as never)).toEqual([]);
  });

  test('custom 模式按自定义分隔符切；clean 选项先清洗（折叠空行 / 去 URL / 去邮箱）', () => {
    const cfg = { mode: 'custom', delimiter: '###', maxLength: 500, overlap: 50, clean: [] } as const;
    expect(segmentText('甲###乙', cfg as never)).toEqual(['甲', '乙']);

    const cleaned = segmentText('a\n\n\n\nb https://x.y/z user@x.com', {
      mode: 'auto', maxLength: 500, overlap: 50, clean: ['collapse-blank', 'strip-url', 'strip-email'],
    });
    expect(cleaned).toEqual(['a', 'b']); /* 清洗后按 \n\n 切段，段内 trim */
  });

  test('超长块按 maxLength/overlap 二次切（窗口步长 = maxLength − overlap）', () => {
    const chunks = segmentText('a'.repeat(25), { mode: 'auto', maxLength: 10, overlap: 2, clean: [] });
    expect(chunks.map((c) => c.length)).toEqual([10, 10, 9]); /* 步长 8：0-10 / 8-18 / 16-26(截断) */
    expect(chunks[0]).toBe('a'.repeat(10));
  });

  test('parent-child 模式父段不再二次切分（父段 = 分隔符级，子段交渲染端）', () => {
    const chunks = segmentText('a'.repeat(30), { mode: 'parent-child', maxLength: 10, overlap: 2, clean: [] });
    expect(chunks).toEqual(['a'.repeat(30)]);
  });

  test('segmentStats：count / avgLength 四舍五入 / tokensEstimate = 总字符 ÷ 2', () => {
    expect(segmentStats(['abcd', 'ef'])).toEqual({ count: 2, avgLength: 3, tokensEstimate: 3 });
    expect(segmentStats([])).toEqual({ count: 0, avgLength: 0, tokensEstimate: 0 });
  });
});

describe('connectorHealth（不可逆优先级 off < failing < stale < healthy）', () => {
  const base: KbConnector = { id: 'c1', name: '连接器一', enabled: true };

  test('enabled=false 一律 off——即使其他信号全部健康（enabled≠healthy）', () => {
    expect(connectorHealth({ ...base, enabled: false, lastSyncAt: isoHoursAgo(1), lastCrawlStatus: 'ok' }, NOW)).toBe('off');
  });

  test('lastCrawlStatus=fail / credential=expired|none → failing（优先于 stale）', () => {
    expect(connectorHealth({ ...base, lastSyncAt: isoHoursAgo(1), lastCrawlStatus: 'fail' }, NOW)).toBe('failing');
    expect(connectorHealth({ ...base, lastSyncAt: isoHoursAgo(1), credential: 'expired' }, NOW)).toBe('failing');
    expect(connectorHealth({ ...base, lastSyncAt: isoHoursAgo(1), credential: 'none' }, NOW)).toBe('failing');
  });

  test('24h 无同步或 lastSyncAt 缺失/不可解析 → stale', () => {
    expect(connectorHealth({ ...base, lastSyncAt: isoHoursAgo(25) }, NOW)).toBe('stale');
    expect(connectorHealth(base, NOW)).toBe('stale');
    expect(connectorHealth({ ...base, lastSyncAt: '不是日期' }, NOW)).toBe('stale');
  });

  test('24h 内有成功同步 → healthy', () => {
    expect(connectorHealth({ ...base, lastSyncAt: isoHoursAgo(23) }, NOW)).toBe('healthy');
    expect(connectorHealth({ ...base, lastSyncAt: isoHoursAgo(1) }, NOW)).toBe('healthy');
  });
});

describe('evalGrade（improvement / regression / tradeoff / tie 四级）', () => {
  test('分数升且无代价恶化 → improvement；分数降 → regression', () => {
    expect(evalGrade(0.1)).toBe('improvement');
    expect(evalGrade(0.1, 0, 0)).toBe('improvement');
    expect(evalGrade(-0.05)).toBe('regression');
    expect(evalGrade(-0.05, -50, -50)).toBe('regression'); /* 分数降不救代价 */
  });

  test('分数升但成本 >5% 或时延 >15% → tradeoff', () => {
    expect(evalGrade(0.1, 6)).toBe('tradeoff');
    expect(evalGrade(0.1, null, 16)).toBe('tradeoff');
    expect(evalGrade(0.1, 5, 15)).toBe('improvement'); /* 恰在阈值内不算恶化 */
  });

  test('分数持平（|Δ|<1e-9）→ 视代价 tie / tradeoff；scoreDelta=null → tie', () => {
    expect(evalGrade(0)).toBe('tie');
    expect(evalGrade(0, 10)).toBe('tradeoff');
    expect(evalGrade(0, null, 20)).toBe('tradeoff');
    expect(evalGrade(null)).toBe('tie');
    expect(evalGrade(null, 99, 99)).toBe('tie');
  });
});

describe('parseInlineCitations（[n] 角标切分）', () => {
  test('交替切段：text 段与编号段（n 为数字）', () => {
    expect(parseInlineCitations('结论[1]与[2]一致')).toEqual([
      { text: '结论' },
      { text: '[1]', n: 1 },
      { text: '与' },
      { text: '[2]', n: 2 },
      { text: '一致' },
    ]);
  });

  test('开头即角标 / 连续角标 / 无角标三种边界', () => {
    expect(parseInlineCitations('[3]来源')).toEqual([{ text: '[3]', n: 3 }, { text: '来源' }]);
    expect(parseInlineCitations('x[1][2]')).toEqual([{ text: 'x' }, { text: '[1]', n: 1 }, { text: '[2]', n: 2 }]);
    expect(parseInlineCitations('没有角标')).toEqual([{ text: '没有角标' }]);
    expect(parseInlineCitations('')).toEqual([]);
  });

  test('无效编号降级为纯文本：超 3 位 / 非数字 / 半角括号不成立', () => {
    expect(parseInlineCitations('见[1234]')).toEqual([{ text: '见[1234]' }]); /* 超过 3 位不切 */
    expect(parseInlineCitations('见[12a]')).toEqual([{ text: '见[12a]' }]);
    expect(parseInlineCitations('见［5］')).toEqual([{ text: '见［5］' }]); /* 全角括号不切 */
  });
});

describe('normalizeAccessRequest（九态状态机的数据归一）', () => {
  test('合法状态/角色直取；缺省 submittedAt 补当前 ISO', () => {
    const r = normalizeAccessRequest({ id: 'r1', requester: 'u1', resource: 'doc/1', role: 'editor', state: 'pending_review' });
    expect(r).toMatchObject({ id: 'r1', role: 'editor', state: 'pending_review' });
    expect(Number.isNaN(Date.parse(r.submittedAt))).toBe(false);
  });

  test('非法 state 回退 idle；非法 role 回退 viewer；空串字段回退空串不猜', () => {
    const r = normalizeAccessRequest({ id: '', requester: '', resource: '', role: 'superadmin', state: 'weird', reason: '' });
    expect(r).toMatchObject({ id: '', requester: '', resource: '', role: 'viewer', state: 'idle', reason: undefined });
  });

  test('可选槽位：approverNote（路由明示）/ decidedBy / expiresAt 仅在非空字符串时保留', () => {
    const full = normalizeAccessRequest({
      id: 'r2', requester: 'u', resource: 'd', role: 'viewer', state: 'granted',
      approverNote: '空间管理员审批', decidedBy: 'admin', decidedAt: '2026-10-01T00:00:00.000Z', expiresAt: '2026-12-01T00:00:00.000Z',
    });
    expect(full.approverNote).toBe('空间管理员审批');
    expect(full.decidedBy).toBe('admin');
    expect(full.expiresAt).toBe('2026-12-01T00:00:00.000Z');
    expect(normalizeAccessRequest({ id: 'x', requester: 'u', resource: 'd', role: 'viewer', state: 'idle', approverNote: '' }).approverNote).toBeUndefined();
  });
});

describe('无效规则不进 DSL（filterToMongo / filterToOData 诚实镜像）', () => {
  test('未知 op / 空 field 的规则被 normalize 剔除，不镜像进 DSL', () => {
    const bad = { type: 'rule', field: 'status', op: 'regex' } as unknown as KbFilterNode;
    expect(filterToMongo(bad)).toBeNull();
    expect(filterToOData(bad)).toBe('');
    const emptyField = { type: 'rule', field: '  ', op: 'eq', value: 1 } as unknown as KbFilterNode;
    expect(filterToMongo(emptyField)).toBeNull();
  });

  test('组内混合有效/无效：仅有效子规则进组', () => {
    const node: KbFilterNode = {
      type: 'group',
      op: 'and',
      children: [
        { type: 'rule', field: 'a', op: 'eq', value: 1 },
        { type: 'rule', field: 'b', op: 'bogus' } as unknown as KbFilterNode,
      ],
    };
    expect(filterToMongo(node)).toEqual({ $and: [{ a: { $eq: 1 } }] });
    expect(filterToOData(node)).toBe('(a eq 1)');
  });

  test('全无效的组整体不落库（Mongo null / OData 空串）', () => {
    const allBad: KbFilterNode = {
      type: 'group',
      op: 'or',
      children: [{ type: 'rule', field: 'a', op: 'nope' } as unknown as KbFilterNode],
    };
    expect(filterToMongo(allBad)).toBeNull();
    expect(filterToOData(allBad)).toBe('');
  });
});
