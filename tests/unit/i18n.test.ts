// i18n 本地化注册表单元测试：默认 zh-CN / 合并覆盖 / reset / 只读快照 /
// icen:locale-change 广播（changed 精确）/ 插值与数组型 key。
// 契约：src/behaviors/i18n.ts（文案唯一事实源；事件 detail 见 events.ts IcenEventMap）。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  getIcenLocale,
  ICEN_LOCALE_EN_US,
  ICEN_LOCALE_ZH_CN,
  resetIcenLocale,
  setIcenLocale,
  t,
} from '../../src/behaviors/i18n';
import { onIcen } from '../../src/behaviors/events';

afterEach(() => {
  resetIcenLocale();
});

describe('默认语言 zh-CN', () => {
  test('缺省取文案 = 库内历史硬编码中文', () => {
    expect(t('select.searchPlaceholder')).toBe('搜索…');
    expect(t('datatable.empty')).toBe('暂无数据');
    expect(t('upload.tooBig')).toBe('文件超过 {p0}');
    expect(t('pagination.pageSize')).toBe('{p0} 条/页');
  });

  test('zh-CN 表完整性：每个 key 都有非空文案（数组型非空元素）', () => {
    for (const [k, v] of Object.entries(ICEN_LOCALE_ZH_CN)) {
      if (Array.isArray(v)) expect(v.length, k).toBeGreaterThan(0);
      else expect(v.length, k).toBeGreaterThan(0);
    }
  });

  test('数组型 key 返回 string[]（星期/月份标签族）', () => {
    expect(t('datePicker.weekdays')).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    expect(t('datePicker.weekdaysSunFirst')).toEqual(['日', '一', '二', '三', '四', '五', '六']);
    expect(t('charts.calendarWeekdays')).toHaveLength(7);
  });

  test('en-US 表与 zh-CN 表 key 全集一致（类型与数量对齐）', () => {
    const zhKeys = Object.keys(ICEN_LOCALE_ZH_CN).sort();
    const enKeys = Object.keys(ICEN_LOCALE_EN_US).sort();
    expect(enKeys).toEqual(zhKeys);
    for (const k of zhKeys) {
      expect(Array.isArray(ICEN_LOCALE_EN_US[k as keyof IcenLocaleRef])).toBe(
        Array.isArray(ICEN_LOCALE_ZH_CN[k as keyof IcenLocaleRef]),
      );
    }
  });

  test('插值：{p0} 占位符替换；缺省变量原样保留', () => {
    expect(t('upload.tooBig', { p0: '2 MB' })).toBe('文件超过 2 MB');
    expect(t('datatable.selectedCount', { p0: 3 })).toBe('已选 3 项');
    expect(t('upload.tooBig')).toBe('文件超过 {p0}');
  });
});

type IcenLocaleRef = typeof ICEN_LOCALE_ZH_CN;

describe('setIcenLocale 合并覆盖', () => {
  test('部分覆盖：只改传入 key，其余保持 zh-CN', () => {
    setIcenLocale({ 'select.searchPlaceholder': 'Type to filter' });
    expect(t('select.searchPlaceholder')).toBe('Type to filter');
    expect(t('select.noMatch')).toBe('无匹配项');
  });

  test('全量切换 en-US', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    expect(t('select.searchPlaceholder')).toBe('Search…');
    expect(t('select.noMatch')).toBe('No matches');
    expect(t('datatable.empty')).toBe('No data');
    expect(t('upload.tooBig', { p0: '2 MB' })).toBe('File exceeds 2 MB');
    expect(t('pagination.pageSize', { p0: 10 })).toBe('10 / page');
    expect(t('datePicker.weekdays')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  test('重复合并：后写覆盖先写', () => {
    setIcenLocale({ 'select.searchPlaceholder': 'A' });
    setIcenLocale({ 'select.searchPlaceholder': 'B' });
    expect(t('select.searchPlaceholder')).toBe('B');
  });
});

describe('icen:locale-change 广播', () => {
  test('changed = 本次实际合并的 key（精确、保序）', () => {
    const seen: string[][] = [];
    const off = onIcen('icen:locale-change', (e) => seen.push(e.detail.changed));
    setIcenLocale({ 'select.searchPlaceholder': 'X', 'datatable.empty': 'Y' });
    expect(seen).toEqual([['select.searchPlaceholder', 'datatable.empty']]);
    off();
  });

  test('undefined 值的 key 不计入 changed、不合并', () => {
    const seen: string[][] = [];
    const off = onIcen('icen:locale-change', (e) => seen.push(e.detail.changed));
    setIcenLocale({ 'select.searchPlaceholder': undefined });
    expect(seen).toEqual([]);
    expect(t('select.searchPlaceholder')).toBe('搜索…');
    off();
  });

  test('reset 广播全量 key', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    const seen: string[][] = [];
    const off = onIcen('icen:locale-change', (e) => seen.push(e.detail.changed));
    resetIcenLocale();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(Object.keys(ICEN_LOCALE_ZH_CN));
    off();
  });
});

describe('getIcenLocale 只读快照', () => {
  test('改返回值不影响内部状态（含数组克隆）', () => {
    const snap = getIcenLocale() as unknown as Record<string, unknown>;
    expect(Object.isFrozen(snap)).toBe(true);
    /* 冻结快照：Reflect.set 返回 false（严格模式静默拒写），且内部状态不被污染 */
    expect(Reflect.set(snap, 'select.searchPlaceholder', 'HACK')).toBe(false);
    expect(t('select.searchPlaceholder')).toBe('搜索…');
    const wd = snap['datePicker.weekdays'] as string[];
    expect(Object.isFrozen(wd)).toBe(true);
    expect(() => wd.push('X')).toThrow();
    expect(t('datePicker.weekdays')).toHaveLength(7);
  });

  test('快照反映当前语言', () => {
    setIcenLocale(ICEN_LOCALE_EN_US);
    expect(getIcenLocale()['select.noMatch']).toBe('No matches');
    expect(getIcenLocale()['aiCore.statusApproval']).toBe('Awaiting approval');
  });
});
