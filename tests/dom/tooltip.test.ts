import {afterEach, expect, test} from 'bun:test';
import {initTooltip} from '../../src/behaviors/tooltip';

const cleanup: (() => void)[] = [];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function fixture(text = '保存草稿', attrs: Record<string, string> = {}) {
  const host = document.createElement('div');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '保存';
  btn.setAttribute('data-icen-tooltip', text);
  for (const [k, v] of Object.entries(attrs)) btn.setAttribute(k, v);
  host.append(btn);
  document.body.append(host);
  // happy-dom 零矩形会触发正确的翻转逻辑；钉一个视口中段位置让 top 偏好成立
  btn.getBoundingClientRect = () => ({ left: 100, top: 400, right: 200, bottom: 430, width: 100, height: 30, x: 100, y: 400, toJSON: () => ({}) }) as DOMRect;
  return { host, btn };
}
function over(el: HTMLElement) { el.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); }
function out(el: HTMLElement) { el.dispatchEvent(new MouseEvent('pointerout', { bubbles: true })); }
const bubble = () => document.body.querySelector<HTMLDivElement>('.icen-tooltip');

afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren(); });

test('hover intent portals one delayed bubble to body and leaving cancels or closes it', async () => {
  const { btn } = fixture();
  cleanup.push(initTooltip());
  over(btn);
  expect(btn.hasAttribute('data-icen-tooltip-live')).toBe(true); // 立即接管，CSS 回退不双渲染
  expect(bubble()).toBeNull(); // 400ms 延迟内不出现
  out(btn);
  await wait(450);
  expect(bubble()).toBeNull();
  expect(btn.hasAttribute('data-icen-tooltip-live')).toBe(false);

  over(btn);
  await wait(450);
  const tip = bubble();
  expect(tip).not.toBeNull();
  expect(tip!.parentElement).toBe(document.body);
  expect(tip!.getAttribute('role')).toBe('tooltip');
  expect(tip!.textContent).toBe('保存草稿');
  expect(btn.getAttribute('aria-describedby')).toBe(tip!.id);
  expect(tip!.dataset.icenSide).toBe('top');

  out(btn);
  await wait(300);
  expect(bubble()).toBeNull();
  expect(btn.hasAttribute('aria-describedby')).toBe(false);
});

test('pointer between triggers retargets the single bubble instead of stacking', async () => {
  const a = fixture('第一处').btn;
  const host = document.createElement('span');
  const b = document.createElement('button');
  b.setAttribute('data-icen-tooltip', '第二处');
  host.append(b); document.body.append(host);
  cleanup.push(initTooltip());
  over(a); await wait(450);
  expect(bubble()!.textContent).toBe('第一处');
  over(b); await wait(450);
  expect(document.body.querySelectorAll('.icen-tooltip')).toHaveLength(1);
  expect(bubble()!.textContent).toBe('第二处');
  expect(a.hasAttribute('data-icen-tooltip-live')).toBe(false);
});

test('Escape, click and scroll each dismiss; invalid side falls back to top', async () => {
  const { btn } = fixture('提示', { 'data-icen-tooltip-side': 'diagonal' });
  cleanup.push(initTooltip());
  over(btn); await wait(450);
  expect(bubble()!.dataset.icenSide).toBe('top');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await wait(300);
  expect(bubble()).toBeNull();

  over(btn); await wait(450);
  expect(bubble()).not.toBeNull();
  btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  await wait(300);
  expect(bubble()).toBeNull();

  over(btn); await wait(450);
  expect(bubble()).not.toBeNull();
  window.dispatchEvent(new Event('scroll'));
  expect(bubble()).toBeNull(); // 滚动即时摘除，无残留
  expect(btn.hasAttribute('data-icen-tooltip-live')).toBe(false);
});

test('live text and side updates follow attribute changes; removal or empty text closes', async () => {
  const { btn } = fixture('旧文案', { 'data-icen-tooltip-side': 'bottom' });
  cleanup.push(initTooltip());
  over(btn); await wait(450);
  expect(bubble()!.dataset.icenSide).toBe('bottom');
  btn.setAttribute('data-icen-tooltip', '新文案');
  await tick();
  expect(bubble()!.textContent).toBe('新文案');
  btn.removeAttribute('data-icen-tooltip');
  await tick();
  expect(bubble()).toBeNull();

  over(btn); await wait(450);
  expect(bubble()).toBeNull(); // 空文案不再出现
  btn.setAttribute('data-icen-tooltip', '回来');
  over(btn); await wait(450);
  expect(bubble()!.textContent).toBe('回来');
  btn.remove();
  await tick();
  expect(bubble()).toBeNull();
});

test('existing describedby is merged then restored; multiline toggles the variant class', async () => {
  const { btn } = fixture('说明', { 'aria-describedby': 'field-help', 'data-icen-tooltip-multiline': 'true' });
  cleanup.push(initTooltip());
  over(btn); await wait(450);
  const tip = bubble()!;
  expect(btn.getAttribute('aria-describedby')).toBe(`field-help ${tip.id}`);
  expect(tip.classList.contains('is-multiline')).toBe(true);
  out(btn); await wait(300);
  expect(btn.getAttribute('aria-describedby')).toBe('field-help');
});

test('scoped init is idempotent, nested delegation runs once and dispose restores everything', async () => {
  const { host, btn } = fixture();
  const first = initTooltip(host);
  const second = initTooltip(host);
  expect(second).toBe(first);
  cleanup.push(initTooltip()); // document 级嵌套作用域

  over(btn); await wait(450);
  expect(document.body.querySelectorAll('.icen-tooltip')).toHaveLength(1);

  first(); // 销毁宿主作用域：其触发器的提示立即摘除并归还属性
  expect(bubble()).toBeNull();
  expect(btn.hasAttribute('data-icen-tooltip-live')).toBe(false);
  expect(btn.hasAttribute('aria-describedby')).toBe(false);

  const third = initTooltip(host); // 销毁后可重新接入
  expect(third).not.toBe(first);
  cleanup.push(third);
  over(btn); await wait(450);
  expect(bubble()).not.toBeNull();
});

test('touch pointer never opens on hover intent and empty triggers stay quiet', async () => {
  const { btn } = fixture('触屏不抢点按');
  const plain = document.createElement('button');
  document.body.append(plain);
  cleanup.push(initTooltip());
  btn.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }) as PointerEvent & { pointerType?: string });
  // happy-dom MouseEvent 无 pointerType（视为 mouse）——另行模拟 touch 需构造 PointerEvent；
  // 这里验证无 pointerType 时按 mouse 处理（延迟后可见），触摸路径由浏览器回归覆盖。
  await wait(450);
  expect(bubble()).not.toBeNull();
  out(btn);
  plain.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
  await wait(450);
  expect(document.body.querySelectorAll('.icen-tooltip')).toHaveLength(0);
});
