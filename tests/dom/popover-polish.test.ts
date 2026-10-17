import {afterEach, expect, test} from 'bun:test';
import {initPopover, openPopover, closePopover} from '../../src/behaviors/popover';

const cleanup: (() => void)[] = [];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function fixture() {
  const host = document.createElement('div');
  const trigger = document.createElement('button');
  trigger.setAttribute('data-icen-popover-target', 'demo-panel');
  trigger.textContent = '筛选';
  const panel = document.createElement('div');
  panel.className = 'icen-popover';
  panel.id = 'demo-panel';
  panel.hidden = true;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'icen-popover-close';
  panel.append(closeBtn);
  host.append(trigger, panel);
  document.body.append(host);
  return { host, trigger, panel, closeBtn };
}

afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren(); });

test('declarative trigger toggles the portalled panel and syncs aria state', async () => {
  const { host, trigger, panel } = fixture();
  cleanup.push(initPopover(host));

  trigger.click();
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-controls')).toBe('demo-panel');
  expect(panel.hidden).toBe(false);
  expect(panel.parentElement).toBe(document.body); // portal

  trigger.click(); // 再点关闭
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await wait(300); // 退场落定后还原门户
  expect(panel.hidden).toBe(true);
  expect(panel.parentElement).toBe(host);
});

test('close button inside the panel closes it; Escape still governs the top layer', async () => {
  const { host, trigger, panel, closeBtn } = fixture();
  cleanup.push(initPopover(host));
  trigger.click();
  expect(panel.hidden).toBe(false);
  closeBtn.click();
  await wait(300);
  expect(panel.hidden).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

test('reopening during the exit keeps the same portal record and never duplicates placeholders', async () => {
  const { host, trigger, panel } = fixture();
  cleanup.push(initPopover(host));
  trigger.click();
  closePopover(panel); // 开始退场
  expect(panel.dataset.icenState).toBe('closing');
  expect(panel.parentElement).toBe(document.body); // 退场期间仍在 body

  trigger.click(); // 退场中重开：续接而非重建
  expect(panel.dataset.icenState).toBeUndefined();
  expect(panel.hidden).toBe(false);
  expect(host.querySelectorAll('li, .icen-popover')).toHaveLength(0); // 面板不在原位
  await wait(300);
  expect(panel.parentElement).toBe(document.body); // 重开后不再 finalize

  closePopover(panel);
  await wait(300);
  expect(panel.parentElement).toBe(host); // 最终正常归还
  expect(host.firstChild).toBe(trigger); // 占位注释已移除，顺序如初
});

test('programmatic close on an unopened panel is a no-op and dispose settles open panels', async () => {
  const { host, trigger, panel } = fixture();
  closePopover(panel); // 未打开：安静跳过
  const dispose = initPopover(host);
  trigger.click();
  expect(panel.parentElement).toBe(document.body);
  dispose();
  await wait(300);
  expect(panel.hidden).toBe(true);
  expect(panel.parentElement).toBe(host);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  trigger.click(); // 委托已摘除，不再打开
  expect(panel.parentElement).toBe(host);
});

test('reduced-motion close finalizes immediately without a closing phase', async () => {
  const { host, trigger, panel } = fixture();
  cleanup.push(initPopover(host));
  trigger.click();
  closePopover(panel);
  await tick();
  expect(panel.dataset.icenState).toBe('closing'); // happy-dom 无动画偏好：走退场分支
  await wait(300);
  expect(panel.hidden).toBe(true);
  expect(panel.parentElement).toBe(host);
});
