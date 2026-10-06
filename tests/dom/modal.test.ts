// modal 行为 DOM 测试：打开/关闭（hidden + portal + body 滚动锁）、focus trap（Tab 循环）、
// ESC 关闭、焦点还原、aria 同步（role/aria-modal/aria-labelledby/describedby）、
// backdrop 点击与 data-icen-close-on-* 禁用开关、initModal 委托 + 销毁。
// DOM 契约：src/components/modal.css 头注释 + behaviors/modal.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import { closeModal, initModal, openModal } from '../../src/behaviors/modal';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, unmountAll } from '../helpers/dom';

const MODAL_HTML = `
  <button class="opener" data-icen-modal-open="m1">打开</button>
  <div class="icen-modal-backdrop" data-icen-modal="m1" hidden>
    <div class="icen-modal">
      <h3 class="icen-modal-title">确认删除</h3>
      <p class="icen-modal-description">该操作不可撤销</p>
      <button class="btn-a" type="button">取消</button>
      <button class="btn-b" type="button">确认</button>
      <button class="closer" data-icen-modal-close type="button">×</button>
    </div>
  </div>
`;

afterEach(() => {
  closeModal('m1');
  unmountAll();
  document.querySelectorAll('.icen-modal-backdrop').forEach((b) => b.remove());
});

function backdrop(): HTMLElement {
  return document.querySelector<HTMLElement>('.icen-modal-backdrop')!;
}

describe('openModal / closeModal（核心生命周期）', () => {
  test('打开：hidden 翻转 + portal 到 body + 滚动锁 + 初始焦点第一个可聚焦 + 派 icen:modal-open', () => {
    mount(MODAL_HTML);
    const ids: string[] = [];
    onIcen('icen:modal-open', (e) => ids.push(e.detail.id));
    const prevOverflow = document.body.style.overflow;
    openModal('m1');
    expect(backdrop().hidden).toBe(false);
    expect(backdrop().parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(document.querySelector('.btn-a')); /* 首个可聚焦 */
    expect(ids).toEqual(['m1']);
    closeModal('m1');
    expect(document.body.style.overflow).toBe(prevOverflow);
  });

  test('aria 同步：role=dialog + aria-modal + 自动 aria-labelledby/describedby 绑定标题与描述', () => {
    mount(MODAL_HTML);
    openModal('m1');
    const panel = backdrop().querySelector<HTMLElement>('.icen-modal')!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    const title = panel.querySelector('.icen-modal-title')!;
    const desc = panel.querySelector('.icen-modal-description')!;
    expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.id).toBe('modal-title-m1');
    expect(panel.getAttribute('aria-describedby')).toBe(desc.id);
    closeModal('m1');
  });

  test('ESC 关闭 + 焦点还原到打开前元素 + 派 icen:modal-close', () => {
    mount(MODAL_HTML);
    const events: string[] = [];
    onIcen('icen:modal-close', (e) => events.push(e.detail.id));
    const opener = document.querySelector<HTMLElement>('.opener')!;
    opener.focus();
    expect(document.activeElement).toBe(opener);
    openModal('m1');
    expect(document.activeElement).not.toBe(opener);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(backdrop().hidden).toBe(true);
    expect(events).toEqual(['m1']);
    expect(document.activeElement).toBe(opener); /* 焦点还原 */
  });

  test('data-icen-close-on-escape="false"：ESC 不关闭', () => {
    mount(MODAL_HTML.replace('data-icen-modal="m1"', 'data-icen-modal="m1" data-icen-close-on-escape="false"'));
    openModal('m1');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(backdrop().hidden).toBe(false);
    closeModal('m1');
  });

  test('focus trap：Tab 在首/尾可聚焦间循环（面板内只有按钮们）', () => {
    mount(MODAL_HTML);
    openModal('m1');
    const panel = backdrop().querySelector<HTMLElement>('.icen-modal')!;
    const first = panel.querySelector<HTMLElement>('.btn-a')!;
    const last = panel.querySelector<HTMLElement>('.closer')!;
    first.focus();
    expect(document.activeElement).toBe(first);

    /* 焦点在最后一个 → Tab 回绕到第一个 */
    last.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    /* 焦点在第一个 → Shift+Tab 回绕到最后一个 */
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    closeModal('m1');
  });

  test('重复 openModal 同 id 幂等；未找到的 id 跳过打开（不派发）', () => {
    mount(MODAL_HTML);
    const ids: string[] = [];
    onIcen('icen:modal-open', (e) => ids.push(e.detail.id));
    openModal('m1');
    openModal('m1'); /* 同 id 早退 */
    expect(ids).toEqual(['m1']);
    closeModal('不存在'); /* 无 backdrop：静默 */
  });
});

describe('initModal（触发器/关闭钮/backdrop 委托）', () => {
  test('opener 点击打开（补 aria-haspopup=dialog）；close 钮点击关闭；backdrop 点击关闭', () => {
    mount(MODAL_HTML);
    const destroy = initModal();
    expect(document.querySelector('.opener')!.getAttribute('aria-haspopup')).toBe('dialog');
    fire(document.querySelector('.opener')!, 'click');
    expect(backdrop().hidden).toBe(false);
    fire(document.querySelector('.closer')!, 'click');
    expect(backdrop().hidden).toBe(true);

    fire(document.querySelector('.opener')!, 'click');
    fire(backdrop(), 'click'); /* 点中 backdrop 本身 */
    expect(backdrop().hidden).toBe(true);

    fire(document.querySelector('.opener')!, 'click');
    fire(document.querySelector('.icen-modal')!, 'click'); /* 点面板内部：不关 */
    expect(backdrop().hidden).toBe(false);
    closeModal('m1');
    destroy();
  });

  test('data-icen-close-on-overlay="false"：backdrop 点击不关闭', () => {
    mount(MODAL_HTML.replace('data-icen-modal="m1"', 'data-icen-modal="m1" data-icen-close-on-overlay="false"'));
    const destroy = initModal();
    fire(document.querySelector('.opener')!, 'click');
    fire(backdrop(), 'click');
    expect(backdrop().hidden).toBe(false);
    destroy(); /* 销毁时顺带关闭开着 modal（复位滚动锁/监听/焦点） */
    expect(backdrop().hidden).toBe(true);
  });

  test('销毁函数摘除委托并复位幂等标记（销毁后 opener 点击无反应，可重新 init）', () => {
    mount(MODAL_HTML);
    const destroy = initModal();
    initModal(); /* 幂等早退 */
    fire(document.querySelector('.opener')!, 'click');
    expect(backdrop().hidden).toBe(false);
    closeModal('m1');
    destroy();
    fire(document.querySelector('.opener')!, 'click');
    expect(backdrop().hidden).toBe(true); /* 委托已摘除 */
    initModal();
    fire(document.querySelector('.opener')!, 'click');
    expect(backdrop().hidden).toBe(false); /* 重新接管 */
    closeModal('m1');
    initModal()(); /* 收尾销毁 */
  });
});
