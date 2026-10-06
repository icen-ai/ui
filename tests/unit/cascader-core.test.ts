// cascader / tree-select 纯函数单元测试：路径查找、搜索拍平过滤、三态求值。
// 模块级导出：behaviors/cascader.ts（findCascaderPath / collectCascaderLeafPaths /
// filterCascaderPaths / cascaderPathLabels）+ behaviors/tree-select.ts
//（flattenTreeNodes / filterTreeNodes / treeNodeCheckState）。
import { describe, expect, test } from 'bun:test';
import {
  cascaderPathLabels,
  collectCascaderLeafPaths,
  filterCascaderPaths,
  findCascaderPath,
  type CascaderOption,
} from '../../src/behaviors/cascader';
import {
  filterTreeNodes,
  flattenTreeNodes,
  treeNodeCheckState,
  type TreeNode,
} from '../../src/behaviors/tree-select';

const OPTIONS: CascaderOption[] = [
  {
    value: 'zj', label: '浙江', children: [
      { value: 'hz', label: '杭州' },
      { value: 'nb', label: '宁波', disabled: true },
    ],
  },
  {
    value: 'gd', label: '广东', children: [
      { value: 'gz', label: '广州' },
      {
        value: 'sz', label: '深圳', children: [
          { value: 'ns', label: '南山' },
          { value: 'ft', label: '福田' },
        ],
      },
    ],
  },
];

const NODES: TreeNode[] = [
  {
    value: 'rd', label: '研发', children: [
      { value: 'fe', label: '前端' },
      { value: 'be', label: '后端' },
    ],
  },
  {
    value: 'ops', label: '运维', children: [
      { value: 'sre', label: 'SRE', disabled: true },
      { value: 'dba', label: 'DBA' },
    ],
  },
  { value: 'hr', label: '人事' },
];

describe('findCascaderPath 路径查找', () => {
  test('完整路径返回节点链（含各级）', () => {
    const chain = findCascaderPath(OPTIONS, ['gd', 'sz', 'ns']);
    expect(chain).not.toBeNull();
    expect(chain!.map((n) => n.value)).toEqual(['gd', 'sz', 'ns']);
    expect(chain!.map((n) => n.label)).toEqual(['广东', '深圳', '南山']);
  });

  test('中间级前缀返回截断链', () => {
    const chain = findCascaderPath(OPTIONS, ['zj']);
    expect(chain!.map((n) => n.value)).toEqual(['zj']);
  });

  test('任一级失配返回 null（部分匹配也是 null，不半解析）', () => {
    expect(findCascaderPath(OPTIONS, ['zj', 'gz'])).toBeNull();
    expect(findCascaderPath(OPTIONS, ['xx'])).toBeNull();
    expect(findCascaderPath(OPTIONS, ['gd', 'sz', 'ns', 'deep'])).toBeNull();
  });

  test('空路径返回空链；disabled 节点可被路径命中（定值约束在行为层）', () => {
    expect(findCascaderPath(OPTIONS, [])).toEqual([]);
    expect(findCascaderPath(OPTIONS, ['zj', 'nb'])!.map((n) => n.value)).toEqual(['zj', 'nb']);
  });
});

describe('collectCascaderLeafPaths 叶子路径拍平', () => {
  test('只收集叶子路径，文档序（DFS 先序）', () => {
    const paths = collectCascaderLeafPaths(OPTIONS);
    expect(paths.map((p) => p.map((n) => n.value).join('/'))).toEqual([
      'zj/hz',
      'zj/nb',
      'gd/gz',
      'gd/sz/ns',
      'gd/sz/ft',
    ]);
  });

  test('含 disabled 节点的路径也保留（搜索可见，定值单独判）', () => {
    const paths = collectCascaderLeafPaths(OPTIONS);
    expect(paths.some((p) => p.some((n) => n.disabled))).toBe(true);
  });

  test('空树返回空', () => {
    expect(collectCascaderLeafPaths([])).toEqual([]);
  });
});

describe('filterCascaderPaths 跨级过滤', () => {
  const paths = collectCascaderLeafPaths(OPTIONS);

  test('命中叶子 label：保留该叶子路径', () => {
    const hits = filterCascaderPaths(paths, '杭州');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.map((n) => n.value)).toEqual(['zj', 'hz']);
  });

  test('命中中间级：其全部叶子路径保留（跨级）', () => {
    const hits = filterCascaderPaths(paths, '深圳');
    expect(hits.map((p) => p.map((n) => n.value).join('/'))).toEqual([
      'gd/sz/ns',
      'gd/sz/ft',
    ]);
  });

  test('大小写不敏感；空 query 与无命中返回空', () => {
    /* 拉丁 label 才能 exercise 大小写分支（中文 label 无大小写） */
    const latin = collectCascaderLeafPaths([
      { value: 'a', label: 'SRE 值班', children: [{ value: 'b', label: 'OnCall' }] },
    ]);
    expect(filterCascaderPaths(latin, 'sre')).toHaveLength(1);
    expect(filterCascaderPaths(latin, 'oncall')).toHaveLength(1);
    expect(filterCascaderPaths(paths, '')).toEqual([]);
    expect(filterCascaderPaths(paths, '  ')).toEqual([]);
    expect(filterCascaderPaths(paths, '火星')).toEqual([]);
  });
});

describe('cascaderPathLabels', () => {
  test('节点链 → label 数组', () => {
    const chain = findCascaderPath(OPTIONS, ['zj', 'hz'])!;
    expect(cascaderPathLabels(chain)).toEqual(['浙江', '杭州']);
    expect(cascaderPathLabels([])).toEqual([]);
  });
});

describe('flattenTreeNodes 拍平', () => {
  test('DFS 文档序 + 深度 + 父链', () => {
    const flat = flattenTreeNodes(NODES);
    expect(flat.map((e) => e.node.value)).toEqual(['rd', 'fe', 'be', 'ops', 'sre', 'dba', 'hr']);
    expect(flat.map((e) => e.depth)).toEqual([0, 1, 1, 0, 1, 1, 0]);
    expect(flat[1]!.parents.map((n) => n.value)).toEqual(['rd']);
    expect(flat[0]!.parents).toEqual([]);
  });
});

describe('filterTreeNodes 搜索过滤', () => {
  test('命中叶子：祖先进 keep + expand，兄弟不进 keep', () => {
    const res = filterTreeNodes(NODES, 'dba');
    expect(res.matched.has('dba')).toBe(true);
    expect(res.keep.has('dba')).toBe(true);
    expect(res.keep.has('ops')).toBe(true); /* 祖先保留 */
    expect(res.expand.has('ops')).toBe(true); /* 祖先自动展开 */
    expect(res.keep.has('sre')).toBe(false); /* 命中节点的兄弟不保留 */
    expect(res.keep.has('rd')).toBe(false);
    expect(res.keep.has('hr')).toBe(false);
  });

  test('命中中间级：子孙作为上下文保留可见（不进 matched，不高亮）', () => {
    const res = filterTreeNodes(NODES, '研发');
    expect(res.matched.has('rd')).toBe(true);
    expect(res.keep.has('rd')).toBe(true);
    expect(res.keep.has('fe')).toBe(true);
    expect(res.keep.has('be')).toBe(true);
    expect(res.matched.has('fe')).toBe(false); /* 仅命中词高亮 */
  });

  test('大小写不敏感；空 query 三集皆空', () => {
    const res = filterTreeNodes(NODES, 'sre');
    expect(res.matched.has('sre')).toBe(true);
    const empty = filterTreeNodes(NODES, '');
    expect(empty.matched.size).toBe(0);
    expect(empty.keep.size).toBe(0);
    expect(empty.expand.size).toBe(0);
    expect(filterTreeNodes(NODES, '火星').matched.size).toBe(0);
  });
});

describe('treeNodeCheckState 三态求值', () => {
  test('叶子：在集合 checked，不在 unchecked', () => {
    expect(treeNodeCheckState(NODES[2]!, new Set(['hr']))).toBe('checked');
    expect(treeNodeCheckState(NODES[2]!, new Set(['fe']))).toBe('unchecked');
  });

  test('父节点：自身 + 全部子孙在集合 → checked', () => {
    expect(treeNodeCheckState(NODES[0]!, new Set(['rd', 'fe', 'be']))).toBe('checked');
  });

  test('部分子孙在集合 → mixed（无论自身在否）', () => {
    expect(treeNodeCheckState(NODES[0]!, new Set(['rd', 'be']))).toBe('mixed');
    expect(treeNodeCheckState(NODES[0]!, new Set(['be']))).toBe('mixed');
  });

  test('全部子孙在但自身不在 → mixed（诚实呈现部分选择）', () => {
    expect(treeNodeCheckState(NODES[0]!, new Set(['fe', 'be']))).toBe('mixed');
  });

  test('全不在 → unchecked；disabled 子孙同规则', () => {
    expect(treeNodeCheckState(NODES[1]!, new Set(['rd']))).toBe('unchecked');
    expect(treeNodeCheckState(NODES[1]!, new Set(['ops', 'dba']))).toBe('mixed');
    expect(treeNodeCheckState(NODES[1]!, new Set(['ops', 'dba', 'sre']))).toBe('checked');
  });
});
