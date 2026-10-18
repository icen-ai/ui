import {expect,test} from 'bun:test';
import {unresolvedTokenReferences} from '../../scripts/guard/token-references';

test('a missing token in a shorthand is rejected even when another value is valid',()=>{
  expect(unresolvedTokenReferences({'tokens.css':':root{--icen-space-xs:4px}', 'field.css':'.field {padding:var(--icen-space-2xs) var(--icen-space-xs)}'})).toEqual(['field.css:1: --icen-space-2xs 未定义且无 fallback，整条 CSS 声明会失效']);
});
test('shared definitions and explicit fallbacks are valid; comments do not define tokens',()=>{
  expect(unresolvedTokenReferences({'a.css':':root{--icen-space:4px}', 'b.css':'.field{padding:var(--icen-space);gap:var(--icen-optional,2px)}'})).toEqual([]);
  expect(unresolvedTokenReferences({'a.css':'/* --icen-missing:4px; */\n.field{padding:var(--icen-missing)}'})).toHaveLength(1);
});
