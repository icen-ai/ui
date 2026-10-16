/*
 * 文档站语法高亮 —— shiki 双主题（与 icen-ai/blog 同款：github-light-default ×
 * github-dark-default），构建期（Astro SSR）执行，浏览器零 JS 零包体。
 * token 色内联在 span 的 color/--shiki-dark 变量里；暗色切换由组件 CSS
 * （[data-icen-theme="dark"] [data-icen-dual-theme] span → var(--shiki-dark)）接管。
 * 高亮器单例惰性创建，站点构建进程内复用；未注册语言按需 loadLanguage。
 */
import { createHighlighter, type Highlighter } from 'shiki';

/** 站内出现的语言别名 → shiki 语言 id */
const LANG_ALIAS: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  jsx: 'jsx',
  tsx: 'tsx',
  vue: 'html',
  astro: 'html',
  sh: 'bash',
  shell: 'bash',
  console: 'bash',
  zsh: 'bash',
};

const THEMES = { light: 'github-light-default', dark: 'github-dark-default' } as const;
const BASE_LANGS = ['typescript', 'javascript', 'html', 'css', 'bash', 'json', 'txt'] as const;

let highlighterPromise: Promise<Highlighter> | undefined;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: [...BASE_LANGS],
  });
  return highlighterPromise;
}

/** 站内语言别名归一（未知名兜底 txt——shiki 对未知语言抛错，文档示例不值得为此炸构建） */
export function normalizeLang(lang: string): string {
  const l = LANG_ALIAS[lang?.toLowerCase()] ?? lang?.toLowerCase();
  return l || 'txt';
}

async function render(code: string, lang: string): Promise<string> {
  const highlighter = await getHighlighter();
  let l = normalizeLang(lang);
  if (!highlighter.getLoadedLanguages().includes(l)) {
    try {
      await highlighter.loadLanguage(l as Parameters<Highlighter['loadLanguage']>[0]);
    } catch {
      l = 'txt';
    }
  }
  return highlighter.codeToHtml(code.replace(/\n$/, ''), { lang: l, themes: THEMES });
}

/**
 * 代码 → shiki 双主题完整 <pre> HTML（.line 行 span 与 --shiki-dark 变量内联）。
 * 输出交给 ui 包 codeBlockHTML({ html }) 采纳（剥背景 / .line 归一 / 双主题钩子）。
 */
export async function shikiPre(code: string, lang: string): Promise<string> {
  return render(code, lang);
}

/**
 * 代码 → 只取 shiki 的 <code> 内层（无 pre 壳、无背景）——给 PmInstall 这类
 * 自带外壳的紧凑展示位用；token 色 / 双主题变量照常内联。
 */
export async function shikiInner(code: string, lang: string): Promise<string> {
  const full = await render(code, lang);
  const m = /<code[^>]*>([\s\S]*)<\/code>/.exec(full);
  return m ? m[1]! : '';
}
