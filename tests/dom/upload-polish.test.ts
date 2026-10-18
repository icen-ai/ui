import {afterEach, expect, test} from 'bun:test';
import {initUpload} from '../../src/behaviors/upload';

const cleanup: (() => void)[] = [];

function fixture(list = true) {
  const zone = document.createElement('div');
  zone.className = 'icen-upload';
  zone.setAttribute('role', 'button');
  if (list) zone.setAttribute('data-icen-upload-list', '');
  zone.setAttribute('data-icen-max-size', '1024');
  zone.setAttribute('data-icen-max-files', '3');
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.setAttribute('accept', '.png,.md');
  zone.append(input);
  document.body.append(zone);
  return { zone, input };
}
const file = (name: string, size = 10, type = 'text/markdown') => new File(['x'.repeat(size)], name, { type });

afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren(); });

function choose(input: HTMLInputElement, files: File[]) {
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

test('list renders rows with shared icons, dedupes by identity and enforces accept/size/max', () => {
  const { zone, input } = fixture();
  const events: string[] = [];
  zone.addEventListener('icen:upload', () => events.push('upload'));
  zone.addEventListener('icen:upload-error', () => events.push('error'));
  cleanup.push(initUpload());

  const a = file('a.md');
  choose(input, [a, file('b.md'), file('c.md'), file('d.md')]); // 超 max-files=3
  expect(zone.querySelectorAll('.icen-upload-list-item')).toHaveLength(3);
  expect(events).toEqual(['error', 'upload']); // 超限截断先于派发
  expect(zone.querySelector('.icen-upload-list-item-icon svg')?.getAttribute('viewBox')).toBe('0 0 20 20');

  choose(input, [a]); // 同一文件对象（name+size+lastModified 全同）去重
  expect(zone.querySelectorAll('.icen-upload-list-item')).toHaveLength(3);
  expect(events.filter(e => e === 'error')).toHaveLength(1);

  choose(input, [file('big.md', 2048)]); // 超大小
  choose(input, [file('notes.txt', 10, 'text/plain')]); // 类型不符
  expect(events.filter(e => e === 'error')).toHaveLength(3);
  expect(Array.from(input.files ?? [], f => f.name)).toEqual(['a.md','b.md','c.md']);
});

test('non-list forms contain accepted files only and honor native single-file selection', () => {
  const {zone,input} = fixture(false);
  const changes: string[][] = [];
  zone.addEventListener('change',()=>changes.push(Array.from(input.files ?? [],f=>f.name)));
  cleanup.push(initUpload());
  choose(input,[file('accepted.md'),file('invalid.exe')]);
  expect(Array.from(input.files ?? [],f=>f.name)).toEqual(['accepted.md']);
  input.multiple=false;
  choose(input,[file('first.md'),file('second.md')]);
  expect(Array.from(input.files ?? [],f=>f.name)).toEqual(['first.md']);
  expect(changes).toEqual([['accepted.md'],['first.md']]);
  expect(zone.querySelectorAll('.icen-upload-list-item')).toHaveLength(0);
});

test('row removal emits events and disposal releases rows, listeners and the idempotency mark', () => {
  const { zone, input } = fixture();
  const removed: string[] = [];
  zone.addEventListener('icen:upload-remove', (e) => removed.push((e as CustomEvent).detail.file.name));
  const dispose = initUpload();
  cleanup.push(dispose);

  choose(input, [file('a.md'), file('b.md')]);
  expect(zone.querySelectorAll('.icen-upload-list-item')).toHaveLength(2);
  const firstX = zone.querySelector<HTMLButtonElement>('.icen-upload-list-item-x')!;
  expect(firstX.getAttribute('aria-label')).toContain('a.md');
  firstX.click();
  expect(removed).toEqual(['a.md']);
  expect(zone.querySelectorAll('.icen-upload-list-item')).toHaveLength(1);

  dispose();
  expect(zone.querySelector('.icen-upload-list')).toBeNull(); // 行为生成的列表随销毁摘除
  choose(input, [file('c.md')]); // 监听已摘：不再渲染
  expect(zone.querySelector('.icen-upload-list')).toBeNull();

  cleanup.push(initUpload()); // 销毁后可重新 init
  expect(zone.querySelectorAll('.icen-upload-list-item')).toHaveLength(1); // Rehydrate the native FileList.
  choose(input, [file('d.md')]);
  expect(Array.from(input.files ?? [],f=>f.name)).toEqual(['c.md','d.md']);
  expect(zone.querySelectorAll('.icen-upload-list-item')).toHaveLength(2);
});

test('author-provided list containers survive disposal (cleared, not removed)', () => {
  const { zone, input } = fixture();
  const authored = document.createElement('ul');
  authored.className = 'icen-upload-list';
  zone.append(authored);
  const dispose = initUpload();
  cleanup.push(dispose);
  choose(input, [file('a.md')]);
  expect(authored.children).toHaveLength(1);
  dispose();
  expect(authored.isConnected).toBe(true);
  expect(authored.children).toHaveLength(0);
});

test('recommended structure puts the dropzone in charge and the list beside it (no nested interactives)', () => {
  const zone = document.createElement('div');
  zone.className = 'icen-upload';
  zone.setAttribute('role', 'group');
  zone.setAttribute('data-icen-upload-list', '');
  const drop = document.createElement('div');
  drop.className = 'icen-upload-dropzone';
  drop.setAttribute('role', 'button');
  drop.tabIndex = 0;
  const input = document.createElement('input');
  input.type = 'file';
  drop.append(input);
  zone.append(drop);
  document.body.append(zone);
  cleanup.push(initUpload());

  choose(input, [file('a.md')]);
  const list = zone.querySelector('.icen-upload-list')!;
  expect(list.parentElement).toBe(zone); // 列表是 zone 的子级、dropzone 的兄弟
  expect(drop.contains(list)).toBe(false);
  expect(drop.querySelector('.icen-upload-list-item-x')).toBeNull(); // 可点区域内无嵌套按钮
  expect(list.querySelectorAll('.icen-upload-list-item-x')).toHaveLength(1);
  drop.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
  expect(drop.classList.contains('is-drag')).toBe(true);
  expect(zone.classList.contains('is-drag')).toBe(false); // 拖拽态在 dropzone 上
});

test('non-list zones emit once per change and drag state toggles cleanly', () => {
  const { zone, input } = fixture(false);
  const seen: number[] = [];
  zone.addEventListener('icen:upload', (e) => seen.push((e as CustomEvent).detail.files.length));
  cleanup.push(initUpload());
  choose(input, [file('a.md'), file('b.md')]);
  expect(seen).toEqual([2]);

  zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
  expect(zone.classList.contains('is-drag')).toBe(true);
  zone.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
  expect(zone.classList.contains('is-drag')).toBe(false);
});
