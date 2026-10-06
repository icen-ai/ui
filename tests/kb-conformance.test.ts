// kb 族诚实呈现一致性套件：spec §9 八条安全纪律的组件层自动化证明（§9.9 映射表的事实源）。
// 每个用例在 happy-dom 里真实渲染组件后断言 DOM：违规即 CI 红。
// 覆盖：分数纪律（null→「—」无条 / l2 反转 / 轨道定宽）· 打码纪律（hidden 整行消失）·
//       引用白名单（is-dead / is-revoked 中性态）· 截断声明 · DSL 诚实 · 权限域三件套。
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mount, unmountAll, nextTick, fire } from './helpers/dom';

import { createKbRetrieval } from '../src/behaviors/kb-retrieval';
import { renderKbRerankCompare } from '../src/behaviors/kb-rerank';
import { renderKbEvalCompare } from '../src/behaviors/kb-eval';
import { renderKbHitStats } from '../src/behaviors/kb-hittest';
import { renderKbTrace } from '../src/behaviors/kb-trace';
import { renderKbSources } from '../src/behaviors/kb-sources';
import { renderCitationText, initKbCitation } from '../src/behaviors/kb-citation';
import { renderKbAnswer } from '../src/behaviors/kb-answer';
import { createKbFilter } from '../src/behaviors/kb-filter';
import { renderKbWhoCan } from '../src/behaviors/kb-who-can';
import { renderKbVisibility } from '../src/behaviors/kb-visibility';
import { createKbAccess } from '../src/behaviors/kb-access';
import type { KbCitation } from '../src/behaviors/kb-core';

/** 建一个挂进测试容器的裸宿主元素。 */
function hostEl(): HTMLElement {
  const host = mount('');
  const el = document.createElement('div');
  host.appendChild(el);
  return el;
}

beforeEach(() => mount(''));
afterEach(() => {
  document.querySelectorAll('.icen-kb-citation-card').forEach((n) => n.remove());
  unmountAll();
});

/* ═══════════════ 纪律 1-2（分数）：null → 「—」且不渲染条；l2 自动反转；轨道定宽 ═══════════════ */

describe('分数纪律：null/缺失 → 「—」+ 不渲染分数条（§9 + AGENTS 分数纪律）', () => {
  test('kb-retrieval 命中行：score null 无 .icen-kb-score-bar、值「—」；有分才有条', () => {
    const el = hostEl();
    const h = createKbRetrieval(el);
    h.renderHits([
      { chunkId: 'c1', snippet: 's1', score: null },
      { chunkId: 'c2', snippet: 's2', score: 0.73, scoreKind: 'cosine' },
    ]);
    const rows = el.querySelectorAll('.icen-kb-hit');
    expect(rows).toHaveLength(2);
    const nullRow = rows[0]!;
    expect(nullRow.querySelector('.icen-kb-score-bar')).toBeNull();
    expect(nullRow.querySelector('.icen-kb-score-value')?.textContent).toBe('—');
    const scoredRow = rows[1]!;
    expect(scoredRow.querySelector('.icen-kb-score-bar > i')).not.toBeNull();
    expect(scoredRow.querySelector('.icen-kb-score-value')?.textContent).toBe('0.730');
    h.destroy();
  });

  test('kb-retrieval：l2 距离自动反转（0.1 → 条宽 90%），scoreKind 必显', () => {
    const el = hostEl();
    const h = createKbRetrieval(el);
    h.renderHits([{ chunkId: 'c1', snippet: 's', score: 0.1, scoreKind: 'l2' }]);
    const row = el.querySelector('.icen-kb-hit')!;
    expect(row.querySelector<HTMLElement>('.icen-kb-score-bar > i')?.style.width).toBe('90.0%');
    expect(row.querySelector('.icen-kb-chip--kind')?.textContent).toBe('l2');
    h.destroy();
  });

  test('kb-rerank 双列：null 分「落选/新进」侧也不渲染条', () => {
    const el = hostEl();
    renderKbRerankCompare(el, {
      before: [{ chunkId: 'a', snippet: 's', score: 0.488, scoreKind: 'cosine' }],
      after: [{ chunkId: 'a', snippet: 's', score: null, scoreKind: 'rerank' }],
    });
    const beforeCell = el.querySelector('.icen-kb-rerank-col--before')!;
    expect(beforeCell.querySelector('.icen-kb-score-bar > i')).not.toBeNull();
    expect(beforeCell.querySelector('.icen-kb-score-value')?.textContent).toBe('0.488');
    const afterCell = el.querySelector('.icen-kb-rerank-col--after')!;
    expect(afterCell.querySelector('.icen-kb-score-bar')).toBeNull();
    expect(afterCell.querySelector('.icen-kb-score-value')?.textContent).toBe('—');
  });

  test('kb-rerank before 列 l2 反转（列内 max 基准：0.025/0.05 → 50%）', () => {
    const el = hostEl();
    renderKbRerankCompare(el, {
      before: [
        { chunkId: 'x', snippet: 's', score: 0.05, scoreKind: 'l2' },
        { chunkId: 'y', snippet: 's', score: 0.025, scoreKind: 'l2' },
      ],
      after: [],
    });
    const widths = [...el.querySelectorAll<HTMLElement>('.icen-kb-rerank-col--before .icen-kb-score-bar > i')].map(
      (i) => i.style.width,
    );
    expect(widths).toEqual(['0.0%', '50.0%']); /* l2：0.05 距离最远 → 0%；0.025 减半 → 50% */
  });

  test('kb-eval 对比表：null 指标渲染「—」；无可用均分 → 「A 均分 —」（不是 0）', () => {
    const el = hostEl();
    renderKbEvalCompare(el, {
      runs: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      rows: [{ key: 'k1', input: 'q1', scoresA: { f1: null }, scoresB: { f1: 0.8 } }],
    });
    const nums = [...el.querySelectorAll('.icen-kb-eval-num')].map((n) => n.textContent);
    expect(nums[0]).toBe('—'); /* A 侧 null */
    expect(el.textContent).toContain('A 均分 —');
  });

  test('kb-hittest 统计头：hitRate/avgScore 为 null（未跑）→ 「—」，不是 0%', () => {
    const el = hostEl();
    renderKbHitStats(el, { total: 3, passed: 2, hitRate: null, avgScore: null });
    expect(el.querySelector('.icen-kb-hittest-hitrate')?.textContent).toBe('—');
    const labels = [...el.querySelectorAll('.icen-kb-hittest-stat')].map((s) => s.textContent);
    expect(labels.some((t) => t?.includes('—'))).toBe(true);
  });

  test('kb-trace 内嵌命中：score null 不渲染条 + 「—」（文件头 DOM 契约同款承诺）', () => {
    const el = hostEl();
    renderKbTrace(el, [
      {
        id: 's1',
        kind: 'retrieval',
        name: '检索',
        status: 'done',
        hits: [
          { chunkId: 'c1', title: 't1', snippet: 's', score: null },
          { chunkId: 'c2', title: 't2', snippet: 's', score: 0.5, scoreKind: 'cosine' },
        ],
      },
    ]);
    const rows = el.querySelectorAll('.icen-kb-trace-hit');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector('.icen-kb-score-bar')).toBeNull();
    expect(rows[0]!.querySelector('.icen-kb-score-value')?.textContent).toBe('—');
    expect(rows[1]!.querySelector<HTMLElement>('.icen-kb-score-bar > i')?.style.width).toBe('50%');
  });
});

describe('分数条轨道定宽：域 CSS 钉死 flex: 0 0 64px，长度只经内联 i 宽度（AGENTS 分数条纪律）', () => {
  test('kb-search.css（retrieval/rerank）与 kb-ops.css（trace）都有定宽轨道规则', () => {
    const read = (p: string): string => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
    for (const css of ['../src/components/kb-search.css', '../src/components/kb-ops.css']) {
      const src = read(css);
      expect(src, css).toMatch(/\.icen-kb-(?:retrieval|rerank|trace-hit)[\s\S]*?icen-kb-score-bar\s*\{[^}]*flex:\s*0\s+0\s+64px/);
      expect(src, css).toContain('width: 64px');
    }
  });
});

/* ═══════════════ 纪律 2（打码）：hidden 整行消失；requestable 锁+标题+申请入口 ═══════════════ */

describe('打码纪律：对授权侧诚实、对受限侧沉默（§9.0-2/3）', () => {
  test('kb-sources：permission=hidden 的来源整行不渲染，标题不出现在 DOM 任何文本节点', () => {
    const el = hostEl();
    renderKbSources(
      el,
      [
        { id: 's1', title: '机密文档α', permission: 'hidden' },
        { id: 's2', title: '公开文档', permission: 'readable' },
      ] as KbCitation[],
    );
    expect(el.querySelector('[data-icen-kb-source-id="s1"]')).toBeNull();
    expect(el.textContent).not.toContain('机密文档α');
    expect(el.querySelectorAll('.icen-kb-source')).toHaveLength(1);
  });

  test('kb-sources：requestable → 受限行 + 锁徽标 + 标题（metadata 形态）+「申请访问」入口', () => {
    const el = hostEl();
    renderKbSources(el, [{ id: 's2', title: '受限文档β', permission: 'requestable' }]);
    const row = el.querySelector('.icen-kb-source.is-restricted');
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain('受限文档β'); /* metadata 形态：锁+标题（打码是 CSS 视觉层） */
    expect(row!.querySelector('.icen-kb-badge--restricted')).not.toBeNull();
    const req = row!.querySelector('[data-icen-kb-source-request]');
    expect(req?.textContent).toBe('申请访问');
  });
});

/* ═══════════════ 纪律 6（引用白名单）：无效编号 is-dead；revoked 中性态无链无引文 ═══════════════ */

describe('引用白名单：citation 只生成自过滤后集合；revoked 中性态（§9.0-6）', () => {
  test('无效编号降级 .is-dead 纯文本（非按钮、不进可读流）', () => {
    const el = hostEl();
    renderCitationText(el, '见 [1] 与 [9]', [{ id: 'a', index: 1, title: '有效来源' }]);
    const live = el.querySelector('button.icen-kb-citation[data-icen-cite="1"]');
    expect(live).not.toBeNull();
    const dead = el.querySelector('[data-icen-cite="9"]');
    expect(dead?.classList.contains('is-dead')).toBe(true);
    expect(dead?.tagName).not.toBe('BUTTON'); /* 纯文本降级：不可点 */
    expect(dead?.getAttribute('aria-hidden')).toBe('true');
    expect(dead?.textContent).toBe('9');
  });

  test('revoked 历史引用：hover 卡中性「来源已不可用」，无 href、无 citedText', async () => {
    const el = hostEl();
    const revoked = {
      id: 'x',
      index: 1,
      title: '已收回文档',
      url: 'https://internal.example/secret',
      citedText: '机密引用原文',
      permission: 'readable',
      revoked: true,
    } as unknown as KbCitation;
    const destroy = initKbCitation(el, { hoverDelay: 1, sources: [revoked] });
    renderCitationText(el, '参考 [1]', [revoked]);
    const mark = el.querySelector('.icen-kb-citation')!;
    fire(mark, 'pointerover');
    await nextTick(30);
    const card = document.querySelector('.icen-kb-citation-card');
    expect(card).not.toBeNull();
    expect(card!.querySelector('.is-revoked')?.textContent).toBe('来源已不可用');
    expect(card!.textContent).not.toContain('机密引用原文'); /* 正文不下发 */
    expect(card!.querySelector('.icen-kb-citation-card-quote')).toBeNull();
    expect(card!.querySelector('a')).toBeNull(); /* 不留裸链 */
    fire(mark, 'pointerout');
    await nextTick(10);
    destroy();
  });
});

/* ═══════════════ 纪律：截断声明（不静默）+ DSL 诚实 ═══════════════ */

describe('截断声明：结果集被截断必须显式说话（行数截断要声明）', () => {
  test('kb-answer：truncated=true → 显式 notice（显示 N/总数 + LIMIT）；未截断 → 无 notice', () => {
    const el = hostEl();
    renderKbAnswer(el, {
      kind: 'generated',
      result: {
        columns: [{ name: 'c1' }],
        rows: [['v1']],
        truncated: true,
        rowCount: 1,
        totalRows: 500,
        limit: 1,
      },
    });
    const notice = el.querySelector('.icen-kb-result-truncated');
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain('已截断');
    expect(notice!.textContent).toContain('1/500');
    expect(notice!.textContent).toContain('LIMIT 1');

    const el2 = hostEl();
    renderKbAnswer(el2, {
      kind: 'generated',
      result: { columns: [{ name: 'c1' }], rows: [['v1']], truncated: false, rowCount: 1 },
    });
    expect(el2.querySelector('.icen-kb-result-truncated')).toBeNull(); /* 未截断不谎报 */
  });
});

describe('DSL 诚实：无效规则不进 mongo/odata 序列化输出（§9.7）', () => {
  test('kb-filter：混合节点里空字段规则被丢弃，双 DSL 只剩可发送规则', () => {
    const el = hostEl();
    const h = createKbFilter(el, {
      node: {
        type: 'group',
        op: 'and',
        children: [
          { type: 'rule', field: 'status', op: 'eq', value: 'published' },
          { type: 'rule', field: '', op: 'eq', value: 'secret' }, /* 无效：空字段 */
        ],
      },
    });
    const mongo = h.serialize('mongo');
    expect(mongo).toContain('status');
    expect(mongo).not.toContain('secret');
    expect(mongo).not.toContain('""');
    const odata = h.serialize('odata');
    expect(odata).toContain('status');
    expect(odata).not.toContain('secret');
    /* DSL 镜像（组件内 code 元素）与序列化同源同纪律 */
    expect(el.querySelector('.icen-kb-filter-dsl-text')?.textContent).not.toContain('secret');
    h.destroy();
  });
});

/* ═══════════════ 权限域：who-can / visibility / access ═══════════════ */

describe('权限域呈现：非 admin 视图零泄露对照；警示条常驻；被拒五件套齐全（§9.0-2）', () => {
  test('kb-who-can：普通检查视图不出现「若权限不同」式对照文案', () => {
    const el = hostEl();
    const h = renderKbWhoCan(el, {
      identities: [
        { user: 'u1', groups: ['eng'], label: '张三' },
        { user: 'u2', groups: [], label: '李四' },
      ],
      entries: [{ subject: { kind: 'user', id: 'u1', label: '张三' }, role: 'viewer' }],
    });
    expect(el.textContent).not.toContain('若权限不同');
    expect(el.textContent).not.toContain('你会看到');
    expect(el.querySelector('.icen-kb-whocan-verdict')?.textContent).toBe('可查看');
    h.setIdentity('u2'); /* 集合内身份切换 */
    expect(el.querySelector('.icen-kb-whocan-verdict')?.textContent).toBe('无权限');
    expect(el.querySelector('.icen-kb-whocan-result')?.classList.contains('is-denied')).toBe(true);
    h.destroy();
  });

  test('kb-visibility：组件头常驻 admin 警示条；hidden 命中整行不渲染（连标题也不出现）', () => {
    const el = hostEl();
    renderKbVisibility(el, {
      query: '季度营收',
      identities: [{ user: 'u1', groups: [], label: '普通成员' }],
      hits: [
        { id: 'h1', title: '公开财报', snippet: '摘录' },
        { id: 'h2', title: '机密纪要γ', snippet: '秘密' },
      ],
      evaluateHit: (hit) => (hit.id === 'h1' ? 'full' : 'hidden'),
    });
    const warn = el.querySelector('.icen-kb-visibility-warn');
    expect(warn).not.toBeNull();
    expect(warn!.textContent).toContain('admin');
    expect(el.textContent).not.toContain('机密纪要γ'); /* hidden = 不存在（§9.0-3） */
    expect(el.querySelector('[data-icen-hit-id="h2"]')).toBeNull();
    expect(el.querySelector('.icen-kb-visibility-count')?.textContent).toBe('安全计数 1'); /* 授权集合内计数 */
  });

  test('kb-access：被拒五件套（资源名/原因/owner/申请/切换身份）齐备', () => {
    const el = hostEl();
    const h = createKbAccess(el, {
      request: {
        id: 'r1',
        requester: '王五',
        resource: 'Q3 财报',
        role: 'viewer',
        state: 'idle',
        submittedAt: '2026-10-06T00:00:00.000Z',
        approverNote: '内容 owner 李四',
      },
    });
    const denied = el.querySelector('.icen-kb-access-denied');
    expect(denied).not.toBeNull();
    expect(denied!.querySelector('.icen-kb-access-title')?.textContent).toContain('Q3 财报');
    expect(denied!.querySelector('.icen-kb-access-why')?.textContent).toBeTruthy(); /* 原因（恒定文案，零信息增量） */
    expect(denied!.querySelector('.icen-kb-access-owner')?.textContent).toContain('内容 owner 李四');
    expect(denied!.querySelector('[data-icen-access-request]')?.textContent).toBe('申请访问');
    expect(denied!.querySelector('[data-icen-access-switch]')?.textContent).toBe('切换身份');
    /* 恒定文案纪律：缺省原因模板不给受限侧任何可探测分支 */
    expect(denied!.querySelector('.icen-kb-access-why')?.textContent).toBe('此内容仅对授权者开放');
    h.destroy();
  });
});
