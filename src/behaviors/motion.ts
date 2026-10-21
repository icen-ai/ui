/*
 * motion.ts — 动效偏好的唯一运行时口径（与 base.css 的降级链同步）。
 * 判定优先级：<html data-icen-motion="reduce|full"> 手动覆盖 > 系统 prefers-reduced-motion。
 * 全部 SSR 安全（无 DOM 环境返回保守默认）；onIcenMotionChange 返回销毁函数。
 * 用途：JS 驱动的动画（视差 / autoplay / canvas 循环）按 icenMotionReduced() 停运动、保留状态表达。
 */

/** 手动覆盖值（`<html data-icen-motion>` 只认 reduce/full；无属性或非法值 = null = 跟随系统）。 */
export type IcenMotionMode = 'reduce' | 'full';

/** 当前手动覆盖。SSR 返回 null。 */
export function icenMotionOverride(): IcenMotionMode | null {
  if (typeof document === 'undefined') return null;
  const v = document.documentElement.getAttribute('data-icen-motion');
  return v === 'reduce' || v === 'full' ? v : null;
}

/** 是否处于降级态：手动 reduce > 手动 full > 系统偏好。SSR/无 matchMedia 返回 false（不降级）。 */
export function icenMotionReduced(): boolean {
  const override = icenMotionOverride();
  if (override) return override === 'reduce';
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 订阅降级态变化（系统偏好切换 + data-icen-motion 属性改写），返回销毁函数。
 * 设置属性本身即触发回调（MutationObserver 同帧），消费方无需手动补一次——但初始值不主动回调。
 * SSR 返回 noop。
 */
export function onIcenMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const notify = () => cb(icenMotionReduced());
  const mq = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  mq?.addEventListener('change', notify);
  const mo = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === 'data-icen-motion')) notify();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-icen-motion'] });
  return () => {
    mq?.removeEventListener('change', notify);
    mo.disconnect();
  };
}

/** 设置/清除手动覆盖（写 `<html data-icen-motion>`；null = 移除属性、跟随系统）。SSR 静默跳过。 */
export function setIcenMotion(mode: IcenMotionMode | null): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (mode === null) el.removeAttribute('data-icen-motion');
  else el.setAttribute('data-icen-motion', mode);
}
