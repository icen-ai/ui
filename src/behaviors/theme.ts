/** Theme = palette + dark mode + primitive. The default theme and primitive are 本真; 像素 is an independent primitive.
 * data-icen-preset selects color; data-icen-style selects the primitive.
 * Legacy modern/retro/terminal preferences migrate to benzhen, retaining palette
 * and dark mode. Geometry/materials never replace the selected color theme. */

import themes from '../tokens/themes.json';
import { emitIcen } from './events';
import { prepareDesignChange } from './design';

export interface ThemeState {
  preset: string;
  dark: boolean;
  style: string;
}

export const PRESETS = themes.map((theme)=>theme.id);
export const PRIMITIVES = ['benzhen', 'pixel'] as const;
/** @deprecated Use PRIMITIVES. The style field/attribute now selects a primitive. */
export const STYLES = PRIMITIVES;
const customPrimitives = new Set<string>();
const REMOVED_STYLES = new Set(['modern','retro','terminal']);
export function registerPrimitive(name: string): boolean {
  if (!/^[a-z][a-z0-9-]{1,20}$/.test(name) || REMOVED_STYLES.has(name)) return false;
  if ((PRIMITIVES as readonly string[]).includes(name)) return true;
  customPrimitives.add(name); return true;
}
export function listPrimitives(): string[] { return [...PRIMITIVES,...customPrimitives]; }
function normalizePrimitive(name: unknown): string {
  return typeof name === 'string' && listPrimitives().includes(name) ? name : 'benzhen';
}
export const STORAGE_KEY = 'icen.ui.theme';

/** 自建预设的合法名（2–21 位，小写字母开头，仅小写字母/数字/连字符）。 */
const PRESET_NAME_RE = /^[a-z][a-z0-9-]{1,20}$/;
/** 与主题机制冲突的保留名：dark = 明暗切换；style-* = 风格 profile。 */
const RESERVED_PRESET_NAMES = new Set<string>(['retro', 'dark', 'style-modern', 'style-retro', 'style-terminal', ...STYLES.map((s) => `style-${s}`)]);

/** 已注册的自建预设（registerThemePreset 登记，listThemePresets 一并列出）。 */
const customPresets = new Set<string>();

const FALLBACK: ThemeState = { preset: 'benzhen', dark: false, style: 'benzhen' };

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
 * 注册宿主自建预设（宿主先在自家 CSS 写好 `.<name>` 与 `.<name>[data-icen-theme="dark"]` 完整 token 面，
 * 仿照 colors.css 的既有主题）。名字须命中 /^[a-z][a-z0-9-]{1,20}$/ 且不与
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
  return [...new Set([...PRESETS, ...customPresets])];
}

/** 默认主题：本真主题 + 跟随系统明暗 + 本真原语。SSR 下返回离线兜底值。 */
export function getDefaultTheme(): ThemeState {
  if (!isBrowser() || typeof window.matchMedia !== 'function') {
    return { ...FALLBACK };
  }
  return {
    preset: 'benzhen',
    dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    style: 'benzhen',
  };
}

function isThemeState(v: unknown): v is ThemeState {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.preset === 'string' &&
    /* 持久化路径与 setTheme 同一开放白名单：自建预设跨刷新存活 */
    (isValidPreset(t.preset) || t.preset === 'retro') &&
    typeof t.dark === 'boolean' &&
    typeof t.style === 'string'
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
    const normalized = { preset: parsed.preset === 'retro' ? FALLBACK.preset : parsed.preset, dark: parsed.dark, style: normalizePrimitive(parsed.style) };
    if (normalized.style !== parsed.style || normalized.preset !== parsed.preset) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { /* Keep normalized appearance when storage is read-only. */ }
    }
    return normalized;
  } catch {
    return getDefaultTheme();
  }
}

/** 上次已应用的主题（供自建预设类清理与「实际变更」判定；SSR 下恒为 null）。 */
let lastApplied: ThemeState | null = null;

/**
 * 唯一生效点（私有 apply）：主题层全部落在 <html> 的 data 属性上——
 *   data-icen-preset="clay|piano|…"（clay 也显式写，与缺省 :root 默认等价）
 *   data-icen-theme="dark"（亮色 = 摘除该属性）
 *   data-icen-style="benzhen"
 * 选择器自我文档化且与任何第三方类名零冲突（[data-icen-theme="dark"] 是全业界最危险的类名，类形态已废弃）。
 * 与上次生效状态不同时，从 documentElement 派发 icen:theme-change { preset, dark, style }；
 * 首次应用（页面初始化）不派发——同 tabs「初始化定位不派发」纪律。
 */
function apply(t: ThemeState): void {
  if (!isBrowser()) return;
  prepareDesignChange();
  const root = document.documentElement;
  const hadAppearance = root.hasAttribute('data-icen-style');
  root.setAttribute('data-icen-preset', t.preset);
  if (t.dark) root.setAttribute('data-icen-theme', 'dark');
  else root.removeAttribute('data-icen-theme');
  root.removeAttribute('data-icen-design'); // obsolete fourth axis
  root.setAttribute('data-icen-style', t.style);

  const changed =
    hadAppearance &&
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
  apply({ ...t, style: normalizePrimitive(t.style) });
}

/** 合并当前主题与 patch，应用并持久化，返回新态。patch 中的非法枚举值回退默认。 */
export function setTheme(patch: Partial<ThemeState>): ThemeState {
  const merged: ThemeState = { ...getCurrentTheme(), ...patch };
  const next: ThemeState = {
    preset: isValidPreset(merged.preset) ? merged.preset : FALLBACK.preset,
    dark: merged.dark === true,
    style: normalizePrimitive(merged.style),
  };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 存储不可用（隐私模式等）时仅应用不持久化 */
    }
  }
  apply(next);
  return next;
}

/** 当前实际生效的外观；applyTheme 或存储不可写时仍准确。getTheme 专门读取持久化偏好。 */
export function getCurrentTheme(): ThemeState {
  if (!isBrowser()) return getDefaultTheme();
  const root = document.documentElement;
  const preset = root.getAttribute('data-icen-preset');
  const style = root.getAttribute('data-icen-style');
  if (!preset || !style) return getTheme();
  return { preset, style: normalizePrimitive(style), dark: root.getAttribute('data-icen-theme') === 'dark' };
}

/** 切换明暗，返回新态。 */
export function toggleDark(): ThemeState {
  return setTheme({ dark: !getCurrentTheme().dark });
}

/** 只切原语（本真 / 像素；旧风格与非法值回退本真），返回新态。 */
export function setPrimitive(primitive: string): ThemeState { return setTheme({style:primitive}); }
/** @deprecated Use setPrimitive; deleted styles are normalized to benzhen. */
export function setStyle(style: string): ThemeState { return setPrimitive(style); }

/* 模块级幂等守卫：mql change 监听只挂一次 */
let systemListenerAttached = false;
let storageListenerAttached = false;

/** 页面加载早期调用：读持久化主题并应用，防闪烁。
 *  无持久化偏好时，自动跟随系统的 prefers-color-scheme 变化（实时）；
 *  一旦用户显式 setTheme / toggleDark，跟随停止（持久化优先）。
 *  重复调用幂等（系统监听不会重复挂）。 */
export function initTheme(): ThemeState {
  const t = getTheme();
  applyTheme(t);

  if (isBrowser() && !storageListenerAttached) {
    storageListenerAttached = true;
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY || event.key === null) applyTheme(getTheme());
    });
  }

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
