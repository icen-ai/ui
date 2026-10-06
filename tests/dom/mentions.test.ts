// mentions 行为验收：@触发 / 查询过滤 / 异步源（加载态 + 竞态）/ 选中插入文本 + track /
// 删文本同步摘除 / IME 组合态挂起 / Esc 关层 / 键盘导航与 aria-activedescendant。
// 语义源：src/behaviors/mentions.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';
import { createMentions, type MentionItem, type MentionsHandle } from '../../src/behaviors/mentions';

const PEOPLE: MentionItem[] = [
  { id: 'u1', label: 'alice', keywords: 'ali 艾丽丝' },
  { id: 'u2', label: 'alina' },
  { id: 'u3', label: 'bob' },
  { id: 'u4', label: 'carol', disabled: true },
];

const filterPeople = (q: string): MentionItem[] =>
  PEOPLE.filter((p) => p.label.includes(q) || (p.keywords ?? '').includes(q));

const handles: MentionsHandle[] = [];

function setup(opts?: Partial<Parameters<typeof createMentions>[1]>) {
  const host = mount('<div class="icen-mentions"><textarea class="icen-input"></textarea></div>');
  const ta = host.querySelector<HTMLTextAreaElement>('textarea')!;
  const handle = createMentions(host, { source: filterPeople, debounceMs: 0, ...opts });
  handles.push(handle);
  return { host, ta, handle };
}

function type(ta: HTMLTextAreaElement, value: string): void {
  ta.value = value;
  ta.setSelectionRange(value.length, value.length);
  fire(ta, 'input');
}

function press(ta: HTMLTextAreaElement, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  ta.dispatchEvent(ev);
  return ev;
}

const panel = (): HTMLElement => document.querySelector<HTMLElement>('.icen-mentions-panel')!;
const options = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.icen-mentions-option'));

afterEach(() => {
  while (handles.length) handles.pop()!.destroy();
  unmountAll();
});

describe('createMentions', () => {
  test('@ 触发（minChars 0）：面板弹出并列出候选，combobox 语义接线', () => {
    const { ta } = setup();
    type(ta, '@');
    expect(panel().hidden).toBe(false);
    expect(panel().getAttribute('role')).toBe('listbox');
    expect(options().length).toBe(4);
    expect(ta.getAttribute('aria-haspopup')).toBe('listbox');
    expect(ta.getAttribute('aria-expanded')).toBe('true');
    expect(ta.getAttribute('aria-controls')).toBe(panel().id);
  });

  test('触发边界：行首/空白后才触发（email 形态 a@b 不弹层）', () => {
    const { ta } = setup();
    type(ta, 'a@b');
    expect(panel().hidden).toBe(true);
    type(ta, '你好 @b');
    expect(panel().hidden).toBe(false);
    expect(options().length).toBe(1); /* bob */
  });

  test('minChars：查询字符不足关层，达到即开', () => {
    const { ta } = setup({ minChars: 2 });
    type(ta, '@a');
    expect(panel().hidden).toBe(true);
    type(ta, '@al');
    expect(panel().hidden).toBe(false);
  });

  test('查询过滤：source 按 query 过滤（label + keywords）', () => {
    const { ta } = setup();
    type(ta, '@ali');
    expect(options().length).toBe(2); /* alice + alina */
    type(ta, '@lin');
    expect(options().length).toBe(1); /* 仅 alina（keywords 命中 alice 的 ali 不含 lin） */
    expect(options()[0]!.textContent).toContain('alina');
  });

  test('max：面板最多显示条数', () => {
    const { ta } = setup({ max: 2 });
    type(ta, '@');
    expect(options().length).toBe(2);
  });

  test('异步源：加载态占位（opts.loadingLabel）→ 结果渲染', async () => {
    let resolveSource: (() => void) | null = null;
    const { ta } = setup({
      loadingLabel: '查询中…',
      source: () =>
        new Promise<MentionItem[]>((res) => {
          resolveSource = () => res(filterPeople(''));
        }),
    });
    type(ta, '@');
    await nextTick();
    expect(panel().hidden).toBe(false);
    const status = panel().querySelector<HTMLElement>('.icen-mentions-status')!;
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe('查询中…');
    resolveSource!();
    await nextTick();
    expect(status.hidden).toBe(true);
    expect(options().length).toBe(4);
  });

  test('异步竞态守卫：只渲染最新 query 的结果', async () => {
    const resolvers: Array<{ q: string; res: (v: MentionItem[]) => void }> = [];
    const { ta } = setup({
      source: (q) => new Promise<MentionItem[]>((res) => resolvers.push({ q, res })),
    });
    type(ta, '@a');
    await nextTick();
    type(ta, '@al');
    await nextTick();
    expect(resolvers.length).toBe(2);
    /* 旧 query 的晚到结果丢弃 */
    resolvers[0]!.res([{ id: 'stale', label: 'stale' }]);
    await nextTick();
    expect(options().some((o) => o.textContent === 'stale')).toBe(false);
    resolvers[1]!.res([{ id: 'fresh', label: 'fresh' }]);
    await nextTick();
    expect(options().length).toBe(1);
    expect(options()[0]!.textContent).toContain('fresh');
  });

  test('键盘导航：↑↓ 循环移动 active 并同步 aria-activedescendant（跳过 disabled）', () => {
    const { ta } = setup();
    type(ta, '@');
    /* 初始 active = 第一项 */
    expect(ta.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);
    press(ta, 'ArrowDown');
    expect(ta.getAttribute('aria-activedescendant')).toBe(options()[1]!.id);
    /* 回卷跳过 disabled 的 carol（末位）→ 落在 bob */
    press(ta, 'ArrowUp');
    press(ta, 'ArrowUp');
    expect(ta.getAttribute('aria-activedescendant')).toBe(options()[2]!.id);
    expect(options()[2]!.textContent).toContain('bob');
  });

  test('选中：Enter 替换 @query 为 @label（尾随空格）、track 进数组并派 icen:mention-select', () => {
    const { ta, handle } = setup();
    const events: CustomEvent[] = [];
    ta.addEventListener('icen:mention-select', (e) => events.push(e as CustomEvent));
    let picked: MentionItem | null = null;
    type(ta, 'hi @ali');
    press(ta, 'Enter');
    expect(ta.value).toBe('hi @alice ');
    expect(handle.getMentions()).toEqual([{ id: 'u1', label: 'alice', keywords: 'ali 艾丽丝', disabled: false }]);
    expect(events.length).toBe(1);
    expect(events[0]!.detail).toEqual({ id: 'u1', label: 'alice', query: 'ali' });
    /* onSelect 双通道 */
    const { ta: ta2, handle: h2 } = setup({ onSelect: (item) => { picked = item; } });
    type(ta2, '@bo');
    press(ta2, 'Enter');
    expect(picked?.id).toBe('u3');
    expect(h2.getMentions()[0]!.label).toBe('bob');
  });

  test('点击选中同样生效（mousedown 不抢焦点）', () => {
    const { ta, handle } = setup();
    type(ta, '@ali');
    options()[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    options()[0]!.click();
    expect(ta.value).toBe('@alice ');
    expect(handle.getMentions().length).toBe(1);
  });

  test('disabled 项：Enter 不选中（active 初始跳过）', () => {
    const { ta, handle } = setup();
    type(ta, '@car'); /* 只剩 carol（disabled） */
    expect(options().length).toBe(1);
    expect(options()[0]!.classList.contains('is-disabled')).toBe(true);
    expect(ta.getAttribute('aria-activedescendant')).toBe(null);
    press(ta, 'Enter');
    expect(ta.value).toBe('@car'); /* 未替换 */
    expect(handle.getMentions().length).toBe(0);
  });

  test('诚实一致性：文本里没了的 mention 自动从数组摘除', () => {
    const { ta, handle } = setup();
    type(ta, '@ali');
    press(ta, 'Enter');
    expect(handle.getMentions().length).toBe(1);
    /* 用户退格删掉 @alice 标签 */
    type(ta, 'hi ');
    expect(handle.getMentions().length).toBe(0);
  });

  test('IME 组合态挂起：composition 期间不检测，compositionend 后补检', () => {
    const { ta } = setup();
    fire(ta, 'compositionstart');
    type(ta, '@ali');
    expect(panel().hidden).toBe(true); /* 组合态中挂起 */
    fire(ta, 'compositionend');
    expect(panel().hidden).toBe(false); /* 补检：ali 命中 alice */
    /* IME 组合态期间 Enter 是确认候选，不选中 */
    fire(ta, 'compositionstart');
    const ev = press(ta, 'Enter');
    expect(ev.defaultPrevented).toBe(false);
    fire(ta, 'compositionend');
  });

  test('Esc 关层不动文本', () => {
    const { ta } = setup();
    type(ta, '@ali');
    const ev = press(ta, 'Escape');
    expect(ev.defaultPrevented).toBe(true);
    expect(panel().hidden).toBe(true);
    expect(ta.value).toBe('@ali');
    expect(ta.getAttribute('aria-expanded')).toBe('false');
  });

  test('空结果直接关层', () => {
    const { ta } = setup({ source: () => [] });
    type(ta, '@zzz');
    expect(panel().hidden).toBe(true);
  });

  test('destroy：摘面板/监听并还原 aria 属性', () => {
    const { ta, handle } = setup();
    type(ta, '@');
    handle.destroy();
    expect(document.querySelector('.icen-mentions-panel')).toBe(null);
    expect(ta.getAttribute('aria-haspopup')).toBe(null);
    expect(ta.getAttribute('aria-expanded')).toBe(null);
    expect(ta.getAttribute('aria-controls')).toBe(null);
    expect(handle.getMentions()).toEqual([]);
  });
});
