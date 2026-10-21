// motion.ts 单元测试：手动覆盖优先于系统偏好；订阅可销毁；SSR 保守默认由 tests/ssr-guard.test.ts 全量覆盖。
import { afterEach, describe, expect, test } from 'bun:test';
import { icenMotionOverride, icenMotionReduced, onIcenMotionChange, setIcenMotion } from '../../src/behaviors/motion';

interface MqStub {
  matches: boolean;
  media: string;
  addEventListener: (_: string, cb: () => void) => void;
  removeEventListener: (_: string, cb: () => void) => void;
  fire: (v: boolean) => void;
}

function stubMatchMedia(initial: boolean): MqStub {
  const listeners = new Set<() => void>();
  const stub: MqStub = {
    matches: initial,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    fire: (v: boolean) => { stub.matches = v; listeners.forEach((cb) => cb()); },
  };
  (window as unknown as { matchMedia: () => MqStub }).matchMedia = () => stub;
  return stub;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-icen-motion');
});

describe('icenMotionOverride', () => {
  test('无属性 = null；只认 reduce/full；非法值回退 null', () => {
    expect(icenMotionOverride()).toBeNull();
    document.documentElement.setAttribute('data-icen-motion', 'reduce');
    expect(icenMotionOverride()).toBe('reduce');
    document.documentElement.setAttribute('data-icen-motion', 'full');
    expect(icenMotionOverride()).toBe('full');
    document.documentElement.setAttribute('data-icen-motion', 'nope');
    expect(icenMotionOverride()).toBeNull();
  });
});

describe('icenMotionReduced', () => {
  test('跟随系统偏好（matchMedia）', () => {
    const mq = stubMatchMedia(true);
    expect(icenMotionReduced()).toBe(true);
    mq.matches = false;
    expect(icenMotionReduced()).toBe(false);
  });
  test('手动 reduce 覆盖系统 no-preference；手动 full 覆盖系统 reduce', () => {
    stubMatchMedia(false);
    setIcenMotion('reduce');
    expect(icenMotionReduced()).toBe(true);
    stubMatchMedia(true);
    setIcenMotion('full');
    expect(icenMotionReduced()).toBe(false);
  });
});

describe('setIcenMotion', () => {
  test('null 移除属性（回到跟随系统）', () => {
    stubMatchMedia(false);
    setIcenMotion('reduce');
    expect(document.documentElement.getAttribute('data-icen-motion')).toBe('reduce');
    setIcenMotion(null);
    expect(document.documentElement.hasAttribute('data-icen-motion')).toBe(false);
    expect(icenMotionReduced()).toBe(false);
  });
});

describe('onIcenMotionChange', () => {
  test('属性改写与系统切换都触发；销毁后静默', async () => {
    const mq = stubMatchMedia(false);
    const seen: boolean[] = [];
    const off = onIcenMotionChange((reduced) => seen.push(reduced));
    setIcenMotion('reduce');
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver 微任务
    expect(seen).toEqual([true]);
    mq.fire(true);
    expect(seen).toEqual([true, true]); // reduce 属性仍在 → 仍是 true
    off();
    setIcenMotion(null);
    mq.fire(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([true, true]); // 销毁后不再追加
  });
});
