/*
 * @icen.ai/ui — Behavior: theme（主题切换：色彩预设 / 明暗 / 风格 profile）
 * 类全部挂在 <html> 上，与 tokens/colors.css、tokens/style-profiles.css 配套：
 *   - preset: clay 是 :root 默认（挂 'clay' 或什么都不挂都算 clay），其余挂同名类
 *   - dark:   true 时挂 'dark' 类
 *   - style:  挂 `style-${style}` 类（modern 也显式挂 .style-modern）
 * 页面加载早期调用 initTheme() 防闪烁。全部函数带 SSR 守卫。
 */

export interface ThemeState {
  preset: string;
  dark: boolean;
  style: string;
}

export const PRESETS = ['clay', 'piano', 'art', 'vangogh', 'ink', 'retro'] as const;
export const STYLES = ['modern', 'retro', 'terminal'] as const;
export const STORAGE_KEY = 'icen.ui.theme';

const FALLBACK: ThemeState = { preset: 'clay', dark: false, style: 'modern' };

function isBrowser(): boolean {
  return typeof document !== 'undefined';
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
    (PRESETS as readonly string[]).includes(t.preset) &&
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

/** 把主题应用到 <html>：先清掉所有 preset/style/dark 相关类，再按 t 挂回。 */
export function applyTheme(t: ThemeState): void {
  if (!isBrowser()) return;
  const cls = document.documentElement.classList;
  for (const p of PRESETS) cls.remove(p);
  for (const s of STYLES) cls.remove(`style-${s}`);
  cls.remove('dark');
  cls.add(t.preset); // clay 也显式挂 'clay'，与 :root 默认等价
  if (t.dark) cls.add('dark');
  cls.add(`style-${t.style}`);
}

/** 合并当前主题与 patch，应用并持久化，返回新态。patch 中的非法枚举值回退默认。 */
export function setTheme(patch: Partial<ThemeState>): ThemeState {
  const merged: ThemeState = { ...getTheme(), ...patch };
  const next: ThemeState = {
    preset: (PRESETS as readonly string[]).includes(merged.preset) ? merged.preset : FALLBACK.preset,
    dark: merged.dark === true,
    style: (STYLES as readonly string[]).includes(merged.style) ? merged.style : FALLBACK.style,
  };
  applyTheme(next);
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

/** 页面加载早期调用：读持久化主题并应用，防闪烁。 */
export function initTheme(): ThemeState {
  const t = getTheme();
  applyTheme(t);
  return t;
}
