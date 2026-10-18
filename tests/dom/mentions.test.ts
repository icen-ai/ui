// mentions 行为验收：@触发 / 查询过滤 / 异步源（加载态 + 竞态 + 失败重试）/ 对象化提及
// （token 原子性、Backspace/Delete 整体删除、getValue 内容块、目录与自定义 kind）/
// setValue 混合数组 / 粘贴纯文本 / IME 组合态挂起 / Esc 与键盘导航 / 表单回填与 destroy 还原。
// 语义源：src/behaviors/mentions.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';
import { createMentions, type MentionEntity, type MentionItem, type MentionsHandle } from '../../src/behaviors/mentions';

/** 目录成员：完整 user 对象（email/role 必须全量保留进 MentionEntity.item）。 */
const PEOPLE: MentionItem[] = [
  { id: 'u1', label: 'alice', keywords: 'ali 艾丽丝', email: 'alice@example.com', role: '工程师' },
  { id: 'u2', label: 'alina' },
  { id: 'u3', label: 'bob' },
  { id: 'u4', label: 'carol', disabled: true },
];

const filterPeople = (q: string): MentionItem[] =>
  PEOPLE.filter((p) => p.label.includes(q) || (p.keywords ?? '').includes(q));

const handles: MentionsHandle[] = [];

function setup(opts?: Partial<Parameters<typeof createMentions>[1]>, html?: string) {
  const host = mount(html ?? '<div class="icen-mentions"><textarea class="icen-input"></textarea></div>');
  const ta = host.querySelector<HTMLTextAreaElement>('textarea')!;
  const handle = createMentions(host, { source: filterPeople, debounceMs: 0, ...opts });
  handles.push(handle);
  const editor = host.querySelector<HTMLElement>('.icen-mentions-editor')!;
  return { host, ta, editor, handle };
}

/** 测试侧 offset → DOM 位置（与实现同口径：token 只计 bdi 文本）。 */
function caretTo(editor: HTMLElement, offset: number): void {
  let acc = 0;
  let pos: { node: Node; offset: number } = { node: editor, offset: editor.childNodes.length };
  const children = Array.from(editor.childNodes);
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const isToken = child instanceof HTMLElement && child.classList.contains('icen-mention-token');
    const len = isToken
      ? (child.querySelector('bdi')?.textContent ?? '').length
      : child instanceof Text ? child.data.length : (child.textContent ?? '').length;
    if (child instanceof Text) {
      if (offset <= acc + len) { pos = { node: child, offset: offset - acc }; break; }
    } else if (offset < acc + len) { pos = { node: editor, offset: i }; break; }
    else if (offset === acc + len) { pos = { node: editor, offset: i + 1 }; break; }
    acc += len;
  }
  const sel = window.getSelection()!;
  const range = document.createRange();
  range.setStart(pos.node, pos.offset);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** 模拟整段输入：清空编辑区、caret 到末尾、插纯文本、派 input（等价旧测试的 value 赋值）。 */
function setEditorText(editor: HTMLElement, text: string): void {
  while (editor.firstChild) editor.removeChild(editor.firstChild);
  if (text) editor.appendChild(document.createTextNode(text));
  const sel = window.getSelection()!;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  fire(editor, 'input');
}

/** 在 caret 处追加纯文本（不触发面板外的副作用，走真实 DOM 编辑 + input）。 */
function typeText(editor: HTMLElement, text: string): void {
  const sel = window.getSelection()!;
  let range: Range | null = null;
  if (sel.rangeCount) {
    const r = sel.getRangeAt(0);
    if (editor.contains(r.startContainer)) range = r;
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  editor.normalize();
  fire(editor, 'input');
}

function press(editor: HTMLElement, key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  editor.dispatchEvent(ev);
  return ev;
}

function paste(editor: HTMLElement, text: string): Event {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
  editor.dispatchEvent(ev);
  return ev;
}

const panel = (): HTMLElement => document.querySelector<HTMLElement>('.icen-mentions-panel')!;
const options = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.icen-mentions-option'));
const tokens = (editor: HTMLElement): HTMLElement[] =>
  Array.from(editor.querySelectorAll<HTMLElement>('.icen-mention-token'));

afterEach(() => {
  while (handles.length) handles.pop()!.destroy();
  unmountAll();
});

describe('createMentions · 编辑区替换与 DOM 契约', () => {
  test('textarea 被替换为富文本编辑区：contenteditable/role/aria/id/class/placeholder/rows 转移', () => {
    const { host, ta, editor } = setup({}, '<div class="icen-mentions"><textarea id="m-text" class="icen-input" rows="2" placeholder="输入 @ 提及" aria-label="成员">草稿</textarea></div>');
    expect(host.querySelector('textarea')).toBeNull();
    expect(ta.isConnected).toBe(false);
    expect(editor.tagName).toBe('DIV');
    expect(editor.classList.contains('icen-mentions-editor')).toBe(true);
    expect(editor.classList.contains('icen-input')).toBe(true);
    expect(editor.getAttribute('contenteditable')).toBe('true');
    expect(editor.getAttribute('role')).toBe('textbox');
    expect(editor.getAttribute('aria-multiline')).toBe('true');
    expect(editor.tabIndex).toBe(0);
    expect(editor.id).toBe('m-text');
    expect(ta.getAttribute('id')).toBe(null); /* id 不重复 */
    expect(editor.dataset.icenPlaceholder).toBe('输入 @ 提及');
    expect(editor.getAttribute('placeholder')).toBe(null); /* 占位文本不进值 */
    expect(editor.getAttribute('aria-label')).toBe('成员');
    expect(editor.style.getPropertyValue('--icen-mentions-rows')).toBe('2');
    expect(editor.classList.contains('is-empty')).toBe(false);
    expect(editor.textContent).toBe('草稿'); /* 初始值作为纯文本起稿 */
  });

  test('label[for=id] 点击聚焦编辑区', () => {
    const root = mount('<label for="m-text2" id="m-label">成员</label><div class="icen-mentions"><textarea id="m-text2" class="icen-input"></textarea></div>');
    const handle = createMentions(root, { source: filterPeople, debounceMs: 0 });
    handles.push(handle);
    const editor = root.querySelector<HTMLElement>('.icen-mentions-editor')!;
    expect(editor.getAttribute('aria-label')).toBe('成员');
    root.querySelector('#m-label')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(editor);
  });

  test('空编辑区挂 is-empty 占位类，输入后移除', () => {
    const { editor } = setup({}, '<div class="icen-mentions"><textarea class="icen-input" placeholder="提及成员"></textarea></div>');
    expect(editor.classList.contains('is-empty')).toBe(true);
    setEditorText(editor, 'hi');
    expect(editor.classList.contains('is-empty')).toBe(false);
  });

  test('el 直接传 textarea 同样工作', () => {
    const host = mount('<div class="icen-mentions"><textarea class="icen-input"></textarea></div>');
    const ta = host.querySelector<HTMLTextAreaElement>('textarea')!;
    const handle = createMentions(ta, { source: filterPeople, debounceMs: 0 });
    handles.push(handle);
    const editor = host.querySelector<HTMLElement>('.icen-mentions-editor')!;
    expect(editor.isConnected).toBe(true);
    expect(host.querySelector('textarea')).toBeNull();
  });
});

describe('createMentions · @ 触发与候选面板', () => {
  test('@ 触发（minChars 0）：面板弹出并列出候选，多行 textbox 语义接线', () => {
    const { editor } = setup();
    setEditorText(editor, '@');
    expect(panel().hidden).toBe(false);
    expect(panel().querySelector('[role="listbox"] [role="status"]')).toBeNull();
    expect(options().length).toBe(4);
    expect(editor.getAttribute('aria-haspopup')).toBe('listbox');
    expect(editor.hasAttribute('aria-expanded')).toBe(false);
    expect(editor.getAttribute('aria-controls')).toBe(panel().querySelector('[role="listbox"]')!.id);
    expect(editor.getAttribute('aria-autocomplete')).toBe('list');
  });

  test('触发边界：行首/空白后才触发（email 形态 a@b 不弹层）', () => {
    const { editor } = setup();
    setEditorText(editor, 'a@b');
    expect(panel().hidden).toBe(true);
    setEditorText(editor, '你好 @b');
    expect(panel().hidden).toBe(false);
    expect(options().length).toBe(1); /* bob */
  });

  test('minChars：查询字符不足关层，达到即开', () => {
    const { editor } = setup({ minChars: 2 });
    setEditorText(editor, '@a');
    expect(panel().hidden).toBe(true);
    setEditorText(editor, '@al');
    expect(panel().hidden).toBe(false);
  });

  test('查询过滤：source 按 query 过滤（label + keywords）', () => {
    const { editor } = setup();
    setEditorText(editor, '@ali');
    expect(options().length).toBe(2); /* alice + alina */
    setEditorText(editor, '@lin');
    expect(options().length).toBe(1); /* 仅 alina（keywords 命中 alice 的 ali 不含 lin） */
    expect(options()[0]!.textContent).toContain('alina');
  });

  test('max：面板最多显示条数', () => {
    const { editor } = setup({ max: 2 });
    setEditorText(editor, '@');
    expect(options().length).toBe(2);
  });

  test('异步源：加载态占位（opts.loadingLabel）→ 结果渲染', async () => {
    let resolveSource: (() => void) | null = null;
    const { editor } = setup({
      loadingLabel: '查询中…',
      source: () =>
        new Promise<MentionItem[]>((res) => {
          resolveSource = () => res(filterPeople(''));
        }),
    });
    setEditorText(editor, '@');
    await nextTick();
    expect(panel().hidden).toBe(false);
    const status = panel().querySelector<HTMLElement>('.icen-mentions-status')!;
    expect(status.hidden).toBe(false);
    expect(editor.getAttribute('aria-busy')).toBe('true');
    expect(status.querySelector('.icen-suggestion-copy')?.textContent).toBe('查询中…');
    resolveSource!();
    await nextTick();
    expect(status.hidden).toBe(true);
    expect(editor.hasAttribute('aria-busy')).toBe(false);
    expect(options().length).toBe(4);
  });

  test('异步竞态守卫：只渲染最新 query 的结果', async () => {
    const resolvers: Array<{ q: string; res: (v: MentionItem[]) => void }> = [];
    const { editor } = setup({
      source: (q) => new Promise<MentionItem[]>((res) => resolvers.push({ q, res })),
    });
    setEditorText(editor, '@a');
    await nextTick();
    setEditorText(editor, '@al');
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

  test('source 失败 → 错误态 + 重试成功', async () => {
    let calls = 0;
    const { editor } = setup({
      source: () => {
        calls++;
        return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve(filterPeople(''));
      },
    });
    setEditorText(editor, '@');
    await nextTick();
    expect(panel().querySelector<HTMLElement>('.icen-mentions-status')!.hidden).toBe(false);
    expect(panel().querySelector<HTMLButtonElement>('.icen-suggestion-retry')!.hidden).toBe(false);
    press(editor, 'Enter'); /* 失败态 Enter 原地重试 */
    await nextTick();
    expect(calls).toBe(2);
    expect(options().length).toBe(4);
  });

  test('键盘导航：↑↓ 循环移动 active 并同步 aria-activedescendant（跳过 disabled）', () => {
    const { editor } = setup();
    setEditorText(editor, '@');
    expect(editor.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);
    press(editor, 'ArrowDown');
    expect(editor.getAttribute('aria-activedescendant')).toBe(options()[1]!.id);
    /* 回卷跳过 disabled 的 carol（末位）→ 落在 bob */
    press(editor, 'ArrowUp');
    press(editor, 'ArrowUp');
    expect(editor.getAttribute('aria-activedescendant')).toBe(options()[2]!.id);
    expect(options()[2]!.textContent).toContain('bob');
  });

  test('Esc 关层不动文本', () => {
    const { editor, handle } = setup();
    setEditorText(editor, '@ali');
    const ev = press(editor, 'Escape');
    expect(ev.defaultPrevented).toBe(true);
    expect(panel().hidden).toBe(true);
    expect(handle.getText()).toBe('@ali');
    expect(editor.hasAttribute('aria-expanded')).toBe(false);
  });

  test('空结果保留明确提示，状态不是 listbox 选项', () => {
    const { editor } = setup({ source: () => [] });
    setEditorText(editor, '@zzz');
    expect(panel().hidden).toBe(false);
    expect(panel().querySelector<HTMLElement>('.icen-mentions-empty')?.hidden).toBe(false);
    expect(panel().querySelector('[role="listbox"] [role="status"]')).toBeNull();
  });
});

describe('createMentions · 对象化提及（select 模式）', () => {
  test('选中：Enter 把 @query 替换为原子 token，item 保留完整 user 对象', () => {
    const { editor, handle } = setup();
    const events: CustomEvent[] = [];
    editor.addEventListener('icen:mention-select', (e) => events.push(e as CustomEvent));
    setEditorText(editor, 'hi @ali');
    press(editor, 'Enter');
    expect(handle.getText()).toBe('hi @alice ');
    const token = tokens(editor)[0]!;
    expect(token.classList.contains('is-directory')).toBe(true);
    expect(token.getAttribute('contenteditable')).toBe('false'); /* 光标不可进入 */
    expect(token.dataset.icenMentionId).toBe('u1');
    expect(token.querySelector('bdi')!.textContent).toBe('@alice');
    /* 完整对象保留：email/role 都在 */
    const mention = handle.getMentions()[0]!;
    expect(mention).toEqual({
      type: 'mention',
      id: 'u1',
      label: 'alice',
      kind: 'directory',
      item: { id: 'u1', label: 'alice', keywords: 'ali 艾丽丝', email: 'alice@example.com', role: '工程师' },
    });
    /* 事件 detail：item 是完整 MentionEntity */
    expect(events.length).toBe(1);
    expect(events[0]!.detail.item).toEqual(mention);
    expect(events[0]!.detail.query).toBe('ali');
    /* onSelect 双通道（第二实例） */
    let picked: MentionEntity | null = null;
    const second = setup({ onSelect: (entity) => { picked = entity; } });
    setEditorText(second.editor, '@bo');
    press(second.editor, 'Enter');
    expect(picked?.id).toBe('u3');
    expect(second.handle.getMentions()[0]!.label).toBe('bob');
  });

  test('getValue() 返回 text/mention 内容块，不猜字符串', () => {
    const { editor, handle } = setup();
    setEditorText(editor, 'hi @ali');
    press(editor, 'Enter');
    const value = handle.getValue();
    expect(value[0]).toEqual({ type: 'text', text: 'hi ' });
    expect(value[1]!.type).toBe('mention');
    expect((value[1] as MentionEntity).item).toMatchObject({ id: 'u1', email: 'alice@example.com' });
    expect(value[2]).toEqual({ type: 'text', text: ' ' }); /* 插入的尾随空格是独立文本块 */
    expect(value.length).toBe(3);
  });

  test('点击选中同样生效（mousedown 不抢焦点）', () => {
    const { editor, handle } = setup();
    setEditorText(editor, '@ali');
    options()[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    options()[0]!.click();
    expect(handle.getText()).toBe('@alice ');
    expect(handle.getMentions().length).toBe(1);
  });

  test('disabled 项：Enter 不选中（active 初始跳过）', () => {
    const { editor, handle } = setup();
    setEditorText(editor, '@car'); /* 只剩 carol（disabled） */
    expect(options().length).toBe(1);
    expect(options()[0]!.classList.contains('is-disabled')).toBe(true);
    expect(editor.getAttribute('aria-activedescendant')).toBe(null);
    press(editor, 'Enter');
    expect(handle.getText()).toBe('@car'); /* 未替换 */
    expect(handle.getMentions().length).toBe(0);
    expect(tokens(editor).length).toBe(0);
  });

  test('Backspace 整体删除 token：preventDefault、对象立刻消失、change 事件', () => {
    const { editor, handle } = setup();
    setEditorText(editor, 'hi @ali');
    const changes: CustomEvent[] = [];
    editor.addEventListener('icen:mention-change', (e) => changes.push(e as CustomEvent));
    press(editor, 'Enter');
    expect(handle.getMentions().length).toBe(1);
    expect(changes.length).toBe(1); /* 选中插入本身是一次变化 */
    expect(changes[0]!.detail.mentions.length).toBe(1);
    /* caret 贴着 token 末尾（token end offset = 9） */
    caretTo(editor, 9); /* 'hi @alice' 末尾 = token end */
    const ev = press(editor, 'Backspace');
    expect(ev.defaultPrevented).toBe(true);
    expect(handle.getText()).toBe('hi ');
    expect(tokens(editor).length).toBe(0);
    expect(handle.getMentions()).toEqual([]);
    expect(handle.getValue()).toEqual([{ type: 'text', text: 'hi ' }]);
    expect(changes.length).toBe(2);
    expect(changes[1]!.detail.text).toBe('hi ');
    expect(changes[1]!.detail.mentions).toEqual([]);
    expect(changes[1]!.detail.value).toEqual([{ type: 'text', text: 'hi ' }]);
  });

  test('Backspace 两步语义：先删尾随空格（默认文本编辑），贴住 token 后整体删除', () => {
    const { editor, handle } = setup();
    setEditorText(editor, 'hi @ali');
    press(editor, 'Enter');
    caretTo(editor, 10); /* 'hi @alice ' 末尾（token 后空格） */
    const first = press(editor, 'Backspace');
    expect(first.defaultPrevented).toBe(false); /* 空格不是 token：走默认文本删除 */
    /* happy-dom 无原生默认删除，这里模拟浏览器删空格的结果并派 input */
    if (handle.getText() === 'hi @alice ') {
      const last = editor.childNodes[editor.childNodes.length - 1] as Text;
      last.deleteData(last.data.length - 1, 1);
      fire(editor, 'input');
    }
    expect(handle.getText()).toBe('hi @alice');
    caretTo(editor, 9);
    const second = press(editor, 'Backspace'); /* 贴住 token 末尾 → 整体删除 */
    expect(second.defaultPrevented).toBe(true);
    expect(handle.getText()).toBe('hi ');
    expect(handle.getMentions()).toEqual([]);
  });

  test('Delete 贴着 token 起点整体删除', () => {
    const { editor, handle } = setup();
    handle.setValue([{ id: 'u3', label: 'bob' }, ' 在吗']);
    caretTo(editor, 0);
    const ev = press(editor, 'Delete');
    expect(ev.defaultPrevented).toBe(true);
    expect(handle.getText()).toBe(' 在吗');
    expect(handle.getMentions()).toEqual([]);
  });

  test('弹层关闭时 Enter 插入换行（多行语义）', () => {
    const { editor, handle } = setup();
    setEditorText(editor, '第一行');
    caretTo(editor, 3);
    const ev = press(editor, 'Enter');
    expect(ev.defaultPrevented).toBe(true);
    expect(handle.getText()).toBe('第一行\n');
  });

  test('paste 只接受纯文本（HTML 不进编辑区）', () => {
    const { editor, handle } = setup();
    setEditorText(editor, '');
    const ev = paste(editor, '<b>粗体</b> 与\n换行');
    expect(ev.defaultPrevented).toBe(true);
    expect(editor.querySelector('b')).toBeNull();
    expect(handle.getText()).toBe('<b>粗体</b> 与\n换行');
    expect(handle.getValue()).toEqual([{ type: 'text', text: '<b>粗体</b> 与\n换行' }]);
  });

  test('IME 组合态挂起：composition 期间不检测，compositionend 后补检；组合期 Enter 不拦截', () => {
    const { editor, handle } = setup();
    fire(editor, 'compositionstart');
    setEditorText(editor, '@ali');
    expect(panel().hidden).toBe(true); /* 组合态中挂起 */
    fire(editor, 'compositionend');
    expect(panel().hidden).toBe(false); /* 补检：ali 命中 alice */
    /* IME 组合态期间 Enter 是确认候选，不选中 */
    fire(editor, 'compositionstart');
    const ev = press(editor, 'Enter');
    expect(ev.defaultPrevented).toBe(false);
    expect(handle.getText()).toBe('@ali');
    fire(editor, 'compositionend');
  });
});

describe('createMentions · 自定义模式（mode: custom）', () => {
  test('无匹配：显示可创建的自定义项（创建文案 + 自定义徽标），Enter 生成虚线自定义 token', () => {
    const { editor, handle } = setup({ mode: 'custom' });
    setEditorText(editor, '@林');
    expect(panel().hidden).toBe(false);
    expect(options().length).toBe(1); /* 只有「创建」项 */
    expect(panel().querySelector<HTMLElement>('.icen-mentions-empty')!.hidden).toBe(true);
    const createOpt = options()[0]!;
    expect(createOpt.classList.contains('icen-mentions-option--create')).toBe(true);
    expect(createOpt.textContent).toContain('创建“林”');
    expect(createOpt.querySelector('.icen-mentions-option-badge')!.textContent).toBe('自定义');
    press(editor, 'Enter');
    const token = tokens(editor)[0]!;
    expect(token.classList.contains('is-custom')).toBe(true);
    expect(token.querySelector('.icen-mention-badge')!.textContent).toBe('自定义');
    const mention = handle.getMentions()[0]!;
    expect(mention.kind).toBe('custom');
    expect(mention.item).toEqual({ id: 'custom:林', label: '林' });
    expect(handle.getText()).toBe('@林 ');
  });

  test('createCustom 返回完整自定义对象：全量保留进实体', () => {
    const { editor, handle } = setup({
      mode: 'custom',
      createCustom: (query) => ({ id: `ext:${query}`, label: query, email: `${query}@ext.example`, source: 'crm' }),
    });
    let picked: MentionEntity | null = null;
    editor.addEventListener('icen:mention-select', (e) => { picked = (e as CustomEvent).detail.item; });
    setEditorText(editor, '@小舟');
    press(editor, 'Enter');
    const mention = handle.getMentions()[0]!;
    expect(mention.kind).toBe('custom');
    expect(mention.item).toEqual({ id: 'ext:小舟', label: '小舟', email: '小舟@ext.example', source: 'crm' });
    expect(picked?.item).toEqual(mention.item);
  });

  test('有候选时仍追加「创建 …」（候选无完全同名），键盘可导航到创建项', () => {
    const { editor, handle } = setup({ mode: 'custom' });
    setEditorText(editor, '@ali');
    expect(options().length).toBe(3); /* alice + alina + 创建"ali" */
    expect(options()[2]!.classList.contains('icen-mentions-option--create')).toBe(true);
    press(editor, 'ArrowDown');
    press(editor, 'ArrowDown');
    expect(editor.getAttribute('aria-activedescendant')).toBe(options()[2]!.id);
    press(editor, 'Enter');
    const mention = handle.getMentions()[0]!;
    expect(mention.kind).toBe('custom');
    expect(mention.label).toBe('ali');
    expect(handle.getText()).toBe('@ali ');
  });

  test('候选有完全同名时不追加创建项', () => {
    const { editor } = setup({ mode: 'custom' });
    setEditorText(editor, '@alice');
    expect(options().length).toBe(1);
    expect(options()[0]!.classList.contains('icen-mentions-option--create')).toBe(false);
    expect(options()[0]!.textContent).toContain('alice');
  });

  test('select 模式绝不出现创建项（无匹配只有 noResults）', () => {
    const { editor } = setup();
    setEditorText(editor, '@不存在');
    expect(options().length).toBe(0);
    expect(panel().querySelector('.icen-mentions-option--create')).toBeNull();
    expect(panel().querySelector<HTMLElement>('.icen-mentions-empty')!.hidden).toBe(false);
  });

  test('custom 的空查询（裸 @）不追加创建项', () => {
    const { editor } = setup({ mode: 'custom' });
    setEditorText(editor, '@');
    expect(options().length).toBe(4);
    expect(panel().querySelector('.icen-mentions-option--create')).toBeNull();
  });
});

describe('createMentions · setValue / 数据模型', () => {
  test('setValue 混合数组：文本 + 原始 user 对象 + mention 块 + 换行', () => {
    const { editor, handle } = setup();
    handle.setValue([
      '评审 ',
      { id: 'u1', label: 'alice', email: 'alice@example.com', role: '工程师' },
      { type: 'text', text: ' 和 ' },
      { type: 'mention', id: 'x1', label: '外部顾问', kind: 'custom', item: { id: 'x1', label: '外部顾问', source: 'manual' } },
      '\n请知悉',
    ]);
    expect(handle.getText()).toBe('评审 @alice 和 @外部顾问\n请知悉');
    const value = handle.getValue();
    expect(value.map((v) => v.type)).toEqual(['text', 'mention', 'text', 'mention', 'text']);
    expect(value[1]).toMatchObject({ id: 'u1', kind: 'directory' });
    expect((value[1] as MentionEntity).item).toMatchObject({ email: 'alice@example.com', role: '工程师' });
    expect(value[3]).toMatchObject({ id: 'x1', kind: 'custom' });
    const mentions = handle.getMentions();
    expect(mentions.map((m) => m.kind)).toEqual(['directory', 'custom']);
    const domTokens = tokens(editor);
    expect(domTokens[0]!.classList.contains('is-directory')).toBe(true);
    expect(domTokens[1]!.classList.contains('is-custom')).toBe(true);
    expect(domTokens[1]!.querySelector('.icen-mention-badge')!.textContent).toBe('自定义');
  });

  test('setValue 原始对象：label 取 name ?? id 推导', () => {
    const { handle } = setup();
    handle.setValue([{ id: 'u9', name: '王小明', email: 'w@x.y' }, ' / ', { id: 'u8' }]);
    expect(handle.getText()).toBe('@王小明 / @u8');
    const mentions = handle.getMentions();
    expect(mentions[0]!.label).toBe('王小明');
    expect(mentions[0]!.item).toMatchObject({ name: '王小明', email: 'w@x.y' });
    expect(mentions[1]!.label).toBe('u8');
    expect(mentions[1]!.kind).toBe('directory');
  });

  test('setValue 纯字符串 = 纯文本（不猜提及）', () => {
    const { handle } = setup();
    handle.setValue('@alice 只是文本');
    expect(handle.getText()).toBe('@alice 只是文本');
    expect(handle.getMentions()).toEqual([]);
    expect(handle.getValue()).toEqual([{ type: 'text', text: '@alice 只是文本' }]);
  });

  test('setValue 不派事件（与 autocomplete.setValue 约定一致），随后编辑正常派 change', () => {
    const { editor, handle } = setup();
    const changes: CustomEvent[] = [];
    editor.addEventListener('icen:mention-change', (e) => changes.push(e as CustomEvent));
    handle.setValue([{ id: 'u1', label: 'alice' }]);
    expect(changes.length).toBe(0);
    caretTo(editor, 6); /* '@alice' 末尾 = token end */
    press(editor, 'Backspace');
    expect(changes.length).toBe(1);
    expect(changes[0]!.detail.mentions).toEqual([]);
  });
});

describe('createMentions · 表单与生命周期', () => {
  test('name 转移到同名 hidden input 并同步纯文本；destroy 恢复 textarea 并回填', () => {
    const { host, ta, editor, handle } = setup({}, '<form id="mf"><div class="icen-mentions"><textarea name="members" class="icen-input" placeholder="提及"></textarea></div></form>');
    const hidden = host.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden).toBeTruthy();
    expect(hidden.name).toBe('members');
    expect(ta.getAttribute('name')).toBe(null);
    expect(editor.dataset.icenPlaceholder).toBe('提及');
    setEditorText(editor, 'hi @ali');
    press(editor, 'Enter');
    expect(hidden.value).toBe('hi @alice ');
    handle.destroy();
    const taBack = host.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(taBack).toBe(ta);
    expect(taBack.value).toBe('hi @alice '); /* 当前纯文本回填 */
    expect(taBack.getAttribute('name')).toBe('members');
    expect(taBack.getAttribute('placeholder')).toBe('提及');
    expect(host.querySelector('input[type="hidden"]')).toBeNull();
    expect(host.querySelector('.icen-mentions-editor')).toBeNull();
    expect(document.querySelector('.icen-mentions-panel')).toBeNull();
    expect(handle.getMentions()).toEqual([]);
  });

  test('destroy：摘除面板/监听并恢复 textarea（id 还原，重复 destroy 幂等）', () => {
    const { host, ta, editor, handle } = setup({}, '<div class="icen-mentions"><textarea id="m-id" class="icen-input"></textarea></div>');
    setEditorText(editor, '@');
    handle.destroy();
    expect(document.querySelector('.icen-mentions-panel')).toBe(null);
    const taBack = host.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(taBack.getAttribute('id')).toBe('m-id');
    expect(taBack.value).toBe('@');
    handle.destroy(); /* 二次调用安全 */
    expect(host.querySelectorAll('textarea').length).toBe(1);
  });

  test('destroy 后 change/select 不再派发', () => {
    const { editor, handle } = setup();
    const changes: CustomEvent[] = [];
    editor.addEventListener('icen:mention-change', (e) => changes.push(e as CustomEvent));
    handle.destroy();
    fire(editor, 'input');
    press(editor, 'Backspace');
    expect(changes.length).toBe(0);
  });

  test('form reset：编辑区恢复初始值', async () => {
    const { editor, handle } = setup({}, '<form><div class="icen-mentions"><textarea class="icen-input">初始草稿</textarea></div></form>');
    expect(handle.getText()).toBe('初始草稿');
    setEditorText(editor, '改掉了 @ali');
    press(editor, 'Enter');
    expect(handle.getText()).toBe('改掉了 @alice ');
    const form = document.querySelector<HTMLFormElement>('form')!;
    fire(form, 'reset');
    await nextTick(); /* reset 恢复走微任务（与原生 reset 默认行为时序对齐） */
    expect(handle.getText()).toBe('初始草稿');
    expect(handle.getMentions()).toEqual([]);
  });

  test('textarea 禁用/隐藏时不可查询（面板不打开），编辑区不可编辑', () => {
    const { editor } = setup({}, '<div class="icen-mentions"><textarea class="icen-input" disabled></textarea></div>');
    expect(editor.getAttribute('aria-disabled')).toBe('true');
    expect(editor.getAttribute('contenteditable')).toBe('false');
    expect(editor.tabIndex).toBe(-1);
    setEditorText(editor, '@');
    expect(panel().hidden).toBe(true);
  });
});
