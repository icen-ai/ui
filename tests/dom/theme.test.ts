// theme 行为测试：initTheme / setTheme / toggleDark 写 <html> 的 data-icen-preset /
// data-icen-theme / data-icen-style；icen:theme-change 只在实际变化时派发（初始化不派发）；
// registerThemePreset / listThemePresets 自建预设白名单。
// 语义源：src/behaviors/theme.ts（v0.10 起主题全 data 属性化）。
import { beforeEach, describe, expect, test } from 'bun:test';
import {
  PRESETS,
  STORAGE_KEY,
  applyTheme,
  getTheme,
  initTheme,
  listThemePresets,
  registerThemePreset,
  setStyle,
  setTheme,
  toggleDark,
  PRIMITIVES,
  setPrimitive,
} from '../../src/behaviors/theme';
import { onIcen } from '../../src/behaviors/events';

function html(): HTMLElement {
  return document.documentElement;
}

beforeEach(() => {
  window.localStorage.clear();
  html().removeAttribute('data-icen-preset');
  html().removeAttribute('data-icen-theme');
  html().removeAttribute('data-icen-style');
});

describe('initTheme / setTheme / toggleDark（data 属性写入）', () => {
  test('首次 initTheme 应用持久化/默认主题但不派发 icen:theme-change（初始化纪律）', () => {
    const events: unknown[] = [];
    onIcen('icen:theme-change', (e) => events.push(e.detail));
    const t = initTheme(); /* 本文件首个应用调用：lastApplied 为 null → 不派发 */
    expect(t.preset).toBe('benzhen');
    expect(html().getAttribute('data-icen-preset')).toBe('benzhen');
    expect(html().getAttribute('data-icen-style')).toBe('benzhen');
    expect(html().hasAttribute('data-icen-theme')).toBe(false); /* 亮色 = 摘除属性 */
    expect(events).toHaveLength(0);
  });

  test('setTheme 写三属性：dark=true 挂 data-icen-theme="dark"，false 摘除', () => {
    const events: Array<{ preset: string; dark: boolean; style: string }> = [];
    onIcen('icen:theme-change', (e) => events.push(e.detail));
    initTheme(); /* 建立基准（不派发） */

    setTheme({ dark: true });
    expect(html().getAttribute('data-icen-theme')).toBe('dark');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ preset: 'benzhen', dark: true, style: 'benzhen' });

    setTheme({ dark: true }); /* 状态未变：不派发 */
    expect(events).toHaveLength(1);

    setTheme({ preset: 'piano', style: 'retro' });
    expect(html().getAttribute('data-icen-preset')).toBe('piano');
    expect(html().getAttribute('data-icen-style')).toBe('benzhen');
    expect(events).toHaveLength(2);

    setTheme({ dark: false }); /* 回到亮色：属性摘除 + 派发 */
    expect(html().hasAttribute('data-icen-theme')).toBe(false);
    expect(events).toHaveLength(3);
  });

  test('toggleDark 翻转 getTheme 的 dark；setStyle 非法值回退本真', () => {
    initTheme();
    const before = getTheme().dark;
    const t1 = toggleDark();
    expect(t1.dark).toBe(!before);
    expect(toggleDark().dark).toBe(before); /* 翻回 */

    expect(setStyle('terminal').style).toBe('benzhen');
    expect(setStyle('不存在的风格').style).toBe('benzhen');
  });

  test('非法枚举回退：preset 不在白名单回退本真，style 不在有效原语回退 modern', () => {
    initTheme();
    const t = setTheme({ preset: 'Dark', style: 'fancy' });
    expect(t.preset).toBe('benzhen');
    expect(t.style).toBe('benzhen');
    expect(html().getAttribute('data-icen-preset')).toBe('benzhen');
  });

  test('setTheme 持久化到 localStorage；getTheme 读回（坏数据回退默认）', () => {
    initTheme();
    setTheme({ preset: 'ink', dark: true, style: 'benzhen' });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(getTheme()).toEqual({ preset: 'ink', dark: true, style: 'benzhen' });

    window.localStorage.setItem(STORAGE_KEY, '{broken');
    expect(getTheme().preset).toBe('benzhen'); /* 坏 JSON 回退默认 */
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: 'dark', dark: true, style: 'benzhen' }));
    expect(getTheme().preset).toBe('benzhen'); /* 保留名 dark 非法 → 整体回退默认 */
  });

  test('applyTheme 只应用不持久化（与 setTheme 的差异）', () => {
    window.localStorage.clear();
    initTheme();
    applyTheme({ preset: 'art', dark: false, style: 'benzhen' });
    expect(html().getAttribute('data-icen-preset')).toBe('art');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull(); /* 未写存储 */
  });
});

describe('registerThemePreset / listThemePresets（自建预设开放白名单）', () => {
  test('本真 and 像素 are built in; removed stored styles migrate without losing palette or dark mode', () => {
    expect(PRIMITIVES).toEqual(['benzhen','pixel']);
    for (const style of ['modern','retro','terminal']) {
      window.localStorage.setItem(STORAGE_KEY,JSON.stringify({preset:'piano',dark:true,style}));
      expect(getTheme()).toEqual({preset:'piano',dark:true,style:'benzhen'});
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({preset:'piano',dark:true,style:'benzhen'});
      expect(setPrimitive(style).style).toBe('benzhen');
    }
  });
  test('removed retro palette migrates to 本真 and preserves dark mode and pixel primitive',()=>{
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify({preset:'retro',dark:true,style:'pixel'}));
    expect(getTheme()).toEqual({preset:'benzhen',dark:true,style:'pixel'});
    expect(registerThemePreset('retro')).toBe(false);
    expect(setTheme({preset:'retro'}).preset).toBe('benzhen');
  });
  test('内置 6 套恒在；合法自建名注册后进入枚举（顺序稳定，内置在前）', () => {
    expect(PRESETS).toEqual(['benzhen', 'clay', 'piano', 'art', 'vangogh', 'ink']);
    expect(registerThemePreset('ocean')).toBe(true);
    expect(listThemePresets()).toEqual([...PRESETS, 'ocean']);
  });

  test('保留名与非法名拒绝：dark / style-* / 大写开头 / 超长 / 单位长度', () => {
    expect(registerThemePreset('dark')).toBe(false); /* 明暗切换保留 */
    expect(registerThemePreset('style-modern')).toBe(false); /* 风格保留 */
    expect(registerThemePreset('Ocean')).toBe(false); /* 大写开头不合 ^[a-z] */
    expect(registerThemePreset('a')).toBe(false); /* 至少 2 位 */
    expect(registerThemePreset('x'.repeat(22))).toBe(false); /* 至多 21 位 */
    const list = listThemePresets();
    for (const bad of ['dark', 'style-modern', 'Ocean', 'a', 'x'.repeat(22)]) {
      expect(list).not.toContain(bad); /* 拒绝名不进枚举（'ocean' 为上一用例合法注册，留在表内） */
    }
  });

  test('未注册的自建预设同样可 setTheme（注册只影响枚举）', () => {
    initTheme();
    const t = setTheme({ preset: 'midnight-blue' });
    expect(t.preset).toBe('midnight-blue');
    expect(html().getAttribute('data-icen-preset')).toBe('midnight-blue');
  });
});
