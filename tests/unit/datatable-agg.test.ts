// datatable 聚合纯函数语义测试：computeAggregates 的五种内置聚合 + 自定义函数。
// 语义源：src/behaviors/datatable.ts（分组头摘要 chip / 汇总行共用同一口径；
// 数字直取、字符串数字计入、空与非数字跳过；无有效值「—」不猜）。
import { describe, expect, test } from 'bun:test';
import { computeAggregates, type TableColumn } from '../../src/behaviors/datatable';

interface Row {
  dept: string;
  amount: number | string | null;
  qty?: number | string;
}

const cols = (aggregate: TableColumn<Row>['aggregate'], key: keyof Row = 'amount'): Array<TableColumn<Row>> => [
  { key: String(key), title: String(key), aggregate },
];

describe('computeAggregates（行分组 + 汇总行共用的聚合口径）', () => {
  test('sum：数字直取，字符串数字计入，空/null/非数字跳过', () => {
    const rows: Row[] = [
      { dept: 'A', amount: 10 },
      { dept: 'A', amount: '20.5' },
      { dept: 'A', amount: null },
      { dept: 'A', amount: 'abc' },
      { dept: 'A', amount: 0 },
    ];
    expect(computeAggregates(rows, cols('sum'))).toEqual({ amount: '30.5' });
  });

  test('avg：均值四舍五入到 2 位（10/3 = 3.33），整数均值不添尾零', () => {
    const rows: Row[] = [
      { dept: 'A', amount: 3 },
      { dept: 'A', amount: 3 },
      { dept: 'A', amount: 4 },
    ];
    expect(computeAggregates(rows, cols('avg'))).toEqual({ amount: '3.33' });
    expect(computeAggregates([{ dept: 'A', amount: 10 }, { dept: 'A', amount: 10 }, { dept: 'A', amount: 2 }], cols('avg'))).toEqual({ amount: '7.33' });
    expect(computeAggregates([{ dept: 'A', amount: 4 }, { dept: 'A', amount: 6 }], cols('avg'))).toEqual({ amount: '5' });
  });

  test('min/max：只统计可转数字的值', () => {
    const rows: Row[] = [
      { dept: 'A', amount: 3 },
      { dept: 'A', amount: '9' },
      { dept: 'A', amount: null },
    ];
    expect(computeAggregates(rows, cols('min'))).toEqual({ amount: '3' });
    expect(computeAggregates(rows, cols('max'))).toEqual({ amount: '9' });
  });

  test('count：非空即计（与类型无关），null/undefined/空串跳过', () => {
    const rows: Row[] = [
      { dept: 'A', amount: 0 },        /* 0 非空，计 */
      { dept: 'A', amount: 'x' },
      { dept: 'A', amount: null },
      { dept: 'A', amount: '' },
    ];
    expect(computeAggregates(rows, cols('count'))).toEqual({ amount: '2' });
  });

  test('无有效数字值 → 「—」（不猜价），空行集同此', () => {
    const rows: Row[] = [{ dept: 'A', amount: null }, { dept: 'A', amount: 'n/a' }];
    expect(computeAggregates(rows, cols('sum'))).toEqual({ amount: '—' });
    expect(computeAggregates(rows, cols('avg'))).toEqual({ amount: '—' });
    expect(computeAggregates(rows, cols('min'))).toEqual({ amount: '—' });
    expect(computeAggregates([], cols('sum'))).toEqual({ amount: '—' });
    expect(computeAggregates([], cols('count'))).toEqual({ amount: '0' });
  });

  test('自定义函数：收同一口径过滤后的数字数组，返回串由宿主决定', () => {
    const rows: Row[] = [
      { dept: 'A', amount: 1 },
      { dept: 'A', amount: 2 },
      { dept: 'A', amount: 'bad' },
      { dept: 'A', amount: 3 },
    ];
    const median = (values: number[]): string => {
      const sorted = [...values].sort((a, b) => a - b);
      return String(sorted[Math.floor(sorted.length / 2)]);
    };
    expect(computeAggregates(rows, cols(median))).toEqual({ amount: '2' });
  });

  test('多列各算各的：aggregate 缺省列不进结果集', () => {
    const rows: Row[] = [
      { dept: 'A', amount: 1, qty: 2 },
      { dept: 'A', amount: 3, qty: 4 },
    ];
    const columns: Array<TableColumn<Row>> = [
      { key: 'dept', title: '部门' },
      { key: 'amount', title: '金额', aggregate: 'sum' },
      { key: 'qty', title: '数量', aggregate: 'sum' },
    ];
    expect(computeAggregates(rows, columns)).toEqual({ amount: '4', qty: '6' });
  });
});
