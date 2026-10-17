import {afterEach, expect, test} from 'bun:test';
import {renderAiDiff, initAiDiff} from '../../src/behaviors/ai-diff';
import {renderKbSources} from '../../src/behaviors/kb-sources';
import {renderAiThreads} from '../../src/behaviors/ai-threads';

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren(); });

test('ai-diff heads are real toggle buttons sibling to the decision actions (no nested interactives)', () => {
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(initAiDiff());
  renderAiDiff(host, { files: [{ path: 'src/a.ts', status: 'modified', addCount: 3, delCount: 1, hunks: [] }] });
  const head = host.querySelector('.icen-ai-diff-head')!;
  expect(head.getAttribute('role')).toBeNull(); // 行壳不再冒充按钮
  const toggle = head.querySelector('.icen-ai-diff-toggle')!;
  expect(toggle.tagName).toBe('BUTTON');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  const actions = head.querySelector('.icen-ai-diff-actions')!;
  expect(toggle.contains(actions)).toBe(false); // 平级
  (toggle as HTMLButtonElement).click();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelector('.icen-ai-diff-body')!.hidden).toBe(false); // body 是 head 的兄弟
  const accept = head.querySelector<HTMLButtonElement>('[data-icen-ai-diff-accept]')!;
  accept.click();
  expect(host.querySelector('.icen-ai-diff-file')!.classList.contains('is-accepted')).toBe(true);
});

test('kb restricted rows are inert containers with only the request button actionable', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const sources = [
    { id: 'open1', title: '公开手册', url: 'https://a.dev', kind: 'doc', permission: 'readable', useCount: 2 },
    { id: 'lock1', title: '受限口径', url: 'https://b.dev', kind: 'doc', permission: 'restricted', useCount: 0 },
  ] as any;
  renderKbSources(host, sources);
  const rows = host.querySelectorAll('.icen-kb-source');
  expect(rows[0].tagName).toBe('BUTTON'); // 可读行 = 真按钮
  const locked = rows[1];
  expect(locked.getAttribute('role')).toBeNull(); // 受限行是纯容器
  expect(locked.querySelector('.icen-kb-source-request')).not.toBeNull(); // 唯一动作在位
});

test('ai threads expose a real main button sibling to the overflow action', () => {
  const host = document.createElement('div');
  document.body.append(host);
  renderAiThreads(host, { items: [{ key: 't1', label: '供应商准入流程梳理' }] } as any);
  const thread = host.querySelector('.icen-ai-thread')!;
  expect(thread.getAttribute('role')).toBeNull();
  const main = thread.querySelector('.icen-ai-thread-main')!;
  expect(main.tagName).toBe('BUTTON');
  expect(thread.querySelector('.icen-ai-thread-action')).not.toBeNull();
  expect(main.contains(thread.querySelector('.icen-ai-thread-action'))).toBe(false);
});
