// toast / notification 反馈两件 DOM 测试：toast 语义类名 + 自动消失计时 + 句柄提前关闭 +
// maxStack + action 回调；notification 持久栈（语义类 / 进度 / 已读）+ notify.confirm 的
// Promise<boolean> 双通道（按钮 / 关闭）。
// 语义源：src/behaviors/toast.ts、src/behaviors/notification.ts（反馈三件正交之两件）。
import { afterEach, describe, expect, test } from 'bun:test';
import { toast } from '../../src/behaviors/toast';
import { notify } from '../../src/behaviors/notification';
import { mount, nextTick, unmountAll } from '../helpers/dom';

afterEach(async () => {
  toast.dismiss();
  notify.dismiss();
  await nextTick(450); /* 等退场兜底计时器（400ms）走完，避免跨用例残留 */
  unmountAll();
  document.querySelectorAll('.icen-toast-container, .icen-notification-container').forEach((c) => c.remove());
});

const toasts = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.icen-toast'));

describe('toast（瞬时轻提示）', () => {
  test('语义类名：success/error → .icen-toast--success / .icen-toast--error（warn/info 同理）；默认 info', () => {
    toast.success('保存成功');
    toast.error('提交失败');
    toast.warn('额度告警');
    toast.info('普通提示');
    toast('裸调用');
    const classes = toasts().map((t) => t.className);
    expect(classes[0]).toContain('icen-toast--success');
    expect(classes[1]).toContain('icen-toast--error');
    expect(classes[2]).toContain('icen-toast--warning');
    expect(classes[3]).toContain('icen-toast--info');
    expect(classes[4]).toContain('icen-toast--info'); /* 默认 info */
    expect(toasts()[0]!.querySelector('.icen-toast-msg')!.textContent).toBe('保存成功');
    /* 容器级 aria-live */
    expect(document.querySelector('.icen-toast-container')!.getAttribute('aria-live')).toBe('polite');
  });

  test('自动消失：ms 到时移除（退场兜底 400ms 内离开 DOM）', async () => {
    toast.success('一闪而过', 30);
    expect(toasts()).toHaveLength(1);
    await nextTick(500);
    expect(toasts()).toHaveLength(0);
  });

  test('句柄 dismiss() 提前关闭（幂等）：退场类先挂，随后移除', async () => {
    const h = toast.info('手动关');
    h.dismiss();
    expect(toasts()[0]!.classList.contains('is-leaving')).toBe(true);
    await nextTick(500);
    expect(toasts()).toHaveLength(0);
    h.dismiss(); /* 幂等不抛 */
  });

  test('toast.dismiss() 清空全部', () => {
    toast.info('a');
    toast.info('b');
    expect(toasts()).toHaveLength(2);
    toast.dismiss();
    expect(toasts()).toHaveLength(0);
  });

  test('maxStack 上限：超出的最早一条进退场（400ms 兜底后离开 DOM）', async () => {
    toast.config({ maxStack: 2 });
    toast.info('1');
    toast.info('2');
    toast.info('3');
    expect(toasts()).toHaveLength(3); /* 退场动画期内短暂超限（设计允许） */
    expect(toasts()[0]!.classList.contains('is-leaving')).toBe(true);
    await nextTick(500);
    expect(toasts().map((t) => t.textContent)).toEqual(['2', '3']);
    toast.config({ maxStack: 5 }); /* 还原，防跨用例残留 */
  });

  test('action 回调：onAction 返回 false 阻止关闭，否则关闭', async () => {
    let calls = 0;
    toast.action('已删除', '撤销', () => { calls++; return false; }, 60000);
    const btn = toasts()[0]!.querySelector<HTMLButtonElement>('.icen-toast-action')!;
    btn.click();
    expect(calls).toBe(1);
    expect(toasts()).toHaveLength(1); /* 返回 false：不关闭 */
    btn.click();
    expect(toasts()).toHaveLength(1);

    toast.action('将关闭', '好的', () => undefined, 60000);
    const btn2 = toasts()[1]!.querySelector<HTMLButtonElement>('.icen-toast-action')!;
    btn2.click();
    await nextTick(500);
    expect(toasts().map((t) => t.textContent)).toEqual(['已删除撤销']); /* 第二条已退场 */
  });
});

describe('notification（持久通知栈）', () => {
  test('语义类名 notification--success / --warning / --error；info 无修饰类', () => {
    notify.success('构建完成');
    notify.warn('证书将到期');
    notify.error('部署失败');
    notify.info('常规消息');
    const items = Array.from(document.querySelectorAll<HTMLElement>('.icen-notification'));
    expect(items[0]!.className).toContain('icen-notification--success');
    expect(items[1]!.className).toContain('icen-notification--warning');
    expect(items[2]!.className).toContain('icen-notification--error');
    expect(items[3]!.className).not.toContain('notification--');
  });

  test('持久栈默认不自动关闭（无 duration 不消失）；进度通知 setProgress 更新', async () => {
    const h = notify.progress('导出中', { progress: 0.2 });
    await nextTick(300);
    expect(document.querySelectorAll('.icen-notification')).toHaveLength(1); /* 仍在 */
    h.setProgress(0.8);
    const fill = document.querySelector<HTMLElement>('.icen-notification-progress-bar')!;
    expect(fill.style.width).toBe('80%');
    h.dismiss();
    await nextTick(500);
    expect(document.querySelectorAll('.icen-notification')).toHaveLength(0);
  });

  test('notify.confirm：点「确认」resolve(true)；点「取消」resolve(false)', async () => {
    mount('<button class="noop">占位</button>');
    const p = notify.confirm('确定删除？', { confirmLabel: '删除', cancelLabel: '再想想' });
    const item = document.querySelector<HTMLElement>('.icen-notification')!;
    const buttons = Array.from(item.querySelectorAll<HTMLButtonElement>('.icen-notification-action'));
    expect(buttons.map((b) => b.textContent)).toEqual(['再想想', '删除']); /* 取消在前，确认主按钮在后 */
    buttons[1]!.click();
    await expect(p).resolves.toBe(true);
  });

  test('notify.confirm：关闭路径（点取消钮）resolve(false)；confirm 通知 closable=false', async () => {
    const p = notify.confirm('继续？');
    await nextTick();
    const item = document.querySelector<HTMLElement>('.icen-notification')!;
    expect(item.querySelector('.icen-notification-close')).toBeNull(); /* confirm 禁关闭钮 */
    const cancel = Array.from(item.querySelectorAll<HTMLButtonElement>('.icen-notification-action'))[0]!;
    cancel.click();
    await expect(p).resolves.toBe(false);
    await nextTick(500);
    expect(document.querySelectorAll('.icen-notification')).toHaveLength(0);
  });

  test('markRead 去除 is-unread；notify.dismiss(id) 单条关闭', async () => {
    const h = notify.info('新消息', { unread: true });
    expect(document.querySelector('.icen-notification')!.classList.contains('is-unread')).toBe(true);
    notify.markRead(h.id);
    expect(document.querySelector('.icen-notification')!.classList.contains('is-unread')).toBe(false);
    notify.dismiss(h.id);
    await nextTick(500);
    expect(document.querySelectorAll('.icen-notification')).toHaveLength(0);
  });
});
