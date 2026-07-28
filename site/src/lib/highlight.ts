/*
 * 文档站轻量语法高亮 —— 单行 token 化，输出带 .tok-* class 的 HTML。
 * 不做完整 parser：每行独立扫描（多行注释/字符串不跨行，文档代码片段足够）。
 * token 颜色由 site.css 的 .tok-* 规则定义，全部消费语义 --token-*。
 */

export type CodeLang = 'html' | 'js' | 'ts' | 'css' | 'bash';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Rule {
  re: RegExp;
  /** group index → token class；键 0 表示整段匹配一个 token。 */
  map: Record<number, string>;
}

function scan(line: string, rule: Rule): string {
  let out = '';
  let last = 0;
  rule.re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = rule.re.exec(line)) !== null) {
    out += escapeHtml(line.slice(last, m.index));
    const whole = m[0];
    if (rule.map[0] !== undefined) {
      out += `<span class="${rule.map[0]}">${escapeHtml(whole)}</span>`;
    } else {
      /* 按捕获组在 whole 内的顺序切分，逐组包 token（未映射组原样转义） */
      let inner = '';
      let cur = 0;
      for (let gi = 1; gi < m.length; gi++) {
        const g = m[gi];
        if (g === undefined) continue;
        const at = whole.indexOf(g, cur);
        if (at === -1) continue;
        inner += escapeHtml(whole.slice(cur, at));
        const cls = rule.map[gi];
        inner += cls ? `<span class="${cls}">${escapeHtml(g)}</span>` : escapeHtml(g);
        cur = at + g.length;
      }
      inner += escapeHtml(whole.slice(cur));
      out += inner;
    }
    last = m.index + whole.length;
    if (whole.length === 0) rule.re.lastIndex += 1; // 防零宽死循环
  }
  out += escapeHtml(line.slice(last));
  return out;
}

const RULES: Record<string, Rule> = {
  html: {
    re: /(<!--[\s\S]*?-->)|(<\/?[\w-]+|\/?>)|([\w-]+)(=)("[^"]*")/g,
    map: { 1: 'tok-com', 2: 'tok-tag', 3: 'tok-attr', 5: 'tok-str' },
  },
  js: {
    re: /(\/\/.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|export|default|const|let|var|function|return|new|await|async|if|else|for|while|of|in|typeof|void|null|undefined|true|false|this|class|extends)\b|\b(\d+(?:\.\d+)?)\b/g,
    map: { 1: 'tok-com', 2: 'tok-str', 3: 'tok-kw', 4: 'tok-num' },
  },
  css: {
    re: /(\/\*[\s\S]*?\*\/)|("[^"]*")|(@[\w-]+)|(--[\w-]+)|([.#][\w-]+)|([\w-]+)(?=\s*:)/g,
    map: { 1: 'tok-com', 2: 'tok-str', 3: 'tok-kw', 4: 'tok-var', 5: 'tok-tag', 6: 'tok-attr' },
  },
  bash: {
    re: /(#.*$)|("[^"]*")|\b(bun|bunx|pnpm|npm|npx|yarn|git|cd|add|install|dlx|run|import)(?=\s|'|"|$)/g,
    map: { 1: 'tok-com', 2: 'tok-str', 3: 'tok-kw' },
  },
};

/** 单行高亮，返回 HTML。未知 lang 仅转义。 */
export function highlightLine(line: string, lang: CodeLang | string): string {
  const rule = RULES[lang === 'ts' ? 'js' : lang];
  return rule ? scan(line, rule) : escapeHtml(line);
}

/** 整段代码 → 每行一个 HTML 字符串（供 CodeBlock 包行号）。 */
export function highlightLines(code: string, lang: CodeLang | string): string[] {
  return code.replace(/\n$/, '').split('\n').map((l) => highlightLine(l, lang));
}
