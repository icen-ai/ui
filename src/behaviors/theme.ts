/*
 * @icen.ai/ui — Behavior: theme（主题切换：色彩预设 / 明暗 / 风格 profile）
 * 类全部挂在 <html> 上，与 tokens/colors.css、tokens/style-profiles.css 配套：
 *   - preset: clay 是 :root 默认（挂 'clay' 或什么都不挂都算 clay），其余挂同名类；
 *     内置 6 套之外，宿主可在自家 CSS 写好 `.<name>` / `.<name>.dark` 完整 token 面
 *     （第 7 套自建配色）后直接 setTheme({ preset: '<name>' })——预设名校验为开放白名单：
 *     合法类名 /^[a-z][a-z0-9-]{1,20}$/ 且不与 dark / style-* 保留字冲突即可。
 *   - dark:   true 时挂 'dark' 类
 *   - style:  挂 `style-${style}` 类（modern 也显式挂 .style-modern）
 * 页面加载早期调用 initTheme() 防闪烁。全部函数带 SSR 守卫。
 * 主题实际生效（与上次不同）时从 documentElement 派发
 *   icen:theme-change { preset, dark, style }（自 documentElement 冒泡——全局形态可收；
 *   within 为普通元素时事件路径不经过它，收不到）。
 */

import { emitIcen } from './events';

export interface ThemeState {
  preset: string;
  dark: boolean;
  style: string;
}

export const PRESETS = ['clay', 'piano', 'art', 'vangogh', 'ink', 'retro'] as const;
export const STYLES = ['modern', 'retro', 'terminal'] as const;
export const STORAGE_KEY = 'icen.ui.theme';

/** 自建预设的合法类名（2–21 位，小写字母开头，仅小写字母/数字/连字符）。 */
const PRESET_NAME_RE = /^[a-z][a-z0-9-]{1,20}$/;
/** 与主题机制冲突的保留类名：dark = 明暗切换；style-* = 风格 profile。 */
const RESERVED_PRESET_NAMES = new Set<string>(['dark', ...STYLES.map((s) => `style-${s}`)]);

/** 已注册的自建预设（registerThemePreset 登记，listThemePresets 一并列出）。 */
const customPresets = new Set<string>();

const FALLBACK: ThemeState = { preset: 'clay', dark: false, style: 'modern' };

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

/** 预设名合法性：内置 6 套，或「合法类名且不与保留字冲突」的自建预设。 */
function isValidPreset(name: string): boolean {
  return (
    (PRESETS as readonly string[]).includes(name) ||
    (PRESET_NAME_RE.test(name) && !RESERVED_PRESET_NAMES.has(name))
  );
}

/**
 * 注册宿主自建预设（宿主先在自家 CSS 写好 `.<name>` 与 `.<name>.dark` 完整 token 面，
 * 仿照 colors.css 现有 6 套）。名字须命中 /^[a-z][a-z0-9-]{1,20}$/ 且不与
 * dark / style-* 保留字冲突；注册只影响 listThemePresets() 枚举（UI 切换器用），
 * 不注册的自建预设同样可以 setTheme（校验同样放行）。返回是否接受注册。
 */
export function registerThemePreset(name: string): boolean {
  if (!PRESET_NAME_RE.test(name) || RESERVED_PRESET_NAMES.has(name)) return false;
  customPresets.add(name);
  return true;
}

/** 全部可用预设名：内置 6 套 + 已注册的自建预设（UI 切换器枚举用，顺序稳定）。 */
export function listThemePresets(): string[] {
  return [...PRESETS, ...customPresets];
}

/** 默认主题：clay + 跟随系统明暗 + modern。SSR 下返回离线兜底值。 */
export function getDefaultTheme(): ThemeState {
  if (!isBrowser() || typeof window.matchMedia !== 'function') {
    return { ...FALLBACK };
  }
  return {
    preset: 'clay',
    dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    style: 'modern',
  };
}

function isThemeState(v: unknown): v is ThemeState {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.preset === 'string' &&
    /* 持久化路径与 setTheme 同一开放白名单：自建预设跨刷新存活 */
    isValidPreset(t.preset) &&
    typeof t.dark === 'boolean' &&
    typeof t.style === 'string' &&
    (STYLES as readonly string[]).includes(t.style)
  );
}

/** 读 localStorage 中的持久化主题；缺失或坏数据回退默认。 */
export function getTheme(): ThemeState {
  if (!isBrowser()) return getDefaultTheme();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultTheme();
    const parsed: unknown = JSON.parse(raw);
    if (!isThemeState(parsed)) return getDefaultTheme();
    return { preset: parsed.preset, dark: parsed.dark, style: parsed.style };
  } catch {
    return getDefaultTheme();
  }
}

/** 上次已应用的主题（供自建预设类清理与「实际变更」判定；SSR 下恒为 null）。 */
let lastApplied: ThemeState | null = null;

/**
 * 唯一生效点（私有 apply）：先清掉所有 preset/style/dark 相关类，再按 t 挂回；
 * 自建预设类按 lastApplied 追溯摘除（内置 6 套走 PRESETS 循环）。
 * 与上次生效状态不同时，从 documentElement 派发 icen:theme-change { preset, dark, style }；
 * 首次应用（页面初始化）不派发——同 tabs「初始化定位不派发」纪律。
 */
function apply(t: ThemeState): void {
  if (!isBrowser()) return;
  const cls = document.documentElement.classList;
  if (lastApplied && !(PRESETS as readonly string[]).includes(lastApplied.preset)) {
    cls.remove(lastApplied.preset); // 上一个是自建预设，类名不在 PRESETS 里，需显式摘
  }
  for (const p of PRESETS) cls.remove(p);
  for (const s of STYLES) cls.remove(`style-${s}`);
  cls.remove('dark');
  cls.add(t.preset); // clay 也显式挂 'clay'，与 :root 默认等价
  if (t.dark) cls.add('dark');
  cls.add(`style-${t.style}`);

  const changed =
    lastApplied !== null &&
    (lastApplied.preset !== t.preset ||
      lastApplied.dark !== t.dark ||
      lastApplied.style !== t.style);
  lastApplied = { ...t };
  if (changed) {
    emitIcen(document.documentElement, 'icen:theme-change', {
      preset: t.preset,
      dark: t.dark,
      style: t.style,
    });
  }
}

/** 把主题应用到 <html> 并在状态实际变化时派发 icen:theme-change（见私有 apply）。 */
export function applyTheme(t: ThemeState): void {
  apply(t);
}

/** 合并当前主题与 patch，应用并持久化，返回新态。patch 中的非法枚举值回退默认。 */
export function setTheme(patch: Partial<ThemeState>): ThemeState {
  const merged: ThemeState = { ...getTheme(), ...patch };
  const next: ThemeState = {
    preset: isValidPreset(merged.preset) ? merged.preset : FALLBACK.preset,
    dark: merged.dark === true,
    style: (STYLES as readonly string[]).includes(merged.style) ? merged.style : FALLBACK.style,
  };
  apply(next);
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 存储不可用（隐私模式等）时仅应用不持久化 */
    }
  }
  return next;
}

/** 切换明暗，返回新态。 */
export function toggleDark(): ThemeState {
  return setTheme({ dark: !getTheme().dark });
}

/** 只切风格 profile（modern / retro / terminal；非法值回退 modern），返回新态。 */
export function setStyle(style: string): ThemeState {
  return setTheme({ style });
}

/* 模块级幂等守卫：mql change 监听只挂一次 */
let systemListenerAttached = false;

/** 页面加载早期调用：读持久化主题并应用，防闪烁。
 *  无持久化偏好时，自动跟随系统的 prefers-color-scheme 变化（实时）；
 *  一旦用户显式 setTheme / toggleDark，跟随停止（持久化优先）。
 *  重复调用幂等（系统监听不会重复挂）。 */
export function initTheme(): ThemeState {
  const t = getTheme();
  applyTheme(t);

  /* 仅在无持久化偏好时跟随系统明暗；用户主动 setTheme 写入 localStorage 后停止跟随。
     SSR 下 isBrowser() 为 false → no-op。 */
  if (
    isBrowser() &&
    typeof window.matchMedia === 'function' &&
    !systemListenerAttached &&
    !hasPersistedPreference()
  ) {
    /* 页面生命周期单例监听：跟随系统明暗贯穿整个会话，刻意不提供 destroy
       （监听本身轻量，且幂等守卫保证重复 init 不会叠加监听） */
    systemListenerAttached = true;
    let lastDark = t.dark;
    try {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = (ev: MediaQueryListEvent): void => {
        /* 用户可能在另一个 tab 设置了偏好；这里再次校验 */
        if (hasPersistedPreference()) return;
        if (ev.matches === lastDark) return;
        lastDark = ev.matches;
        applyTheme({ ...getTheme(), dark: ev.matches });
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange);
      } else {
        // Safari < 14 兜底
        mql.addListener(onChange);
      }
    } catch {
      /* matchMedia 不可用 → 静默放弃跟随 */
    }
  }
  return t;
}

function hasPersistedPreference(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
