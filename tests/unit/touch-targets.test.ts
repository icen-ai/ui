// base.css 触屏适配层静态断言：目标尺寸底线块（pointer: coarse + ≥40px + 密度 token max()）
// 与 hover 抬升守卫形态。静态读源文本（CSS 无运行时，文本即契约）。
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../../src/base.css', import.meta.url)), 'utf8');

/** 抽取 @media (query) 块体（裸查询串传入，内部转义；块内规则花括号均缩进，
 *  媒体块自身以行首 `}` 收尾，故非贪婪匹配到行首右括号即块界）。 */
function mediaBlocks(query: string): string[] {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`@media\\s*\\(${escaped}\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'g');
  return [...src.matchAll(re)].map((m) => m[1] ?? '');
}

describe('base.css 触屏目标尺寸底线', () => {
  test('pointer: coarse 块含 40px 底线，密度 token 经 max() 继续生效', () => {
    const coarse = mediaBlocks('pointer: coarse').join('\n');
    expect(coarse).toContain('min-block-size: max(var(--icen-density-input-height-md), 40px)');
    expect(coarse).toContain('min-inline-size: max(var(--icen-density-input-height-md), 40px)');
  });

  test('交互基元与控件全部进底线清单', () => {
    const target = mediaBlocks('pointer: coarse')
      .filter((b) => b.includes('40px'))
      .join('\n');
    for (const sel of ['.icen-pressable', '.icen-control', '.icen-field', 'button.icen-btn', "a[role='button']"]) {
      expect(target).toContain(sel);
    }
  });
});

describe('base.css hover 抬升守卫', () => {
  test('.icen-lift:hover 抬升包在 @media (hover: hover) and (pointer: fine) 内；focus-within 全设备保留', () => {
    const hoverGuards = mediaBlocks('hover: hover) and (pointer: fine').join('\n');
    expect(hoverGuards).toContain('.icen-lift:hover');
    expect(src).toMatch(/\.icen-lift:focus-within\s*\{[^}]*translateY\(-1px\)/);
  });
});
