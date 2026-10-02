/*
 * @icen.ai/ui — Behavior: tag-input（多值标签编辑，与 components/tag-input.css 配套）
 *
 * DOM 契约：
 *   <div class="tag-input" data-tags="初始,标签" data-max="5">
 *     <input class="tag-input-field" placeholder="…" />
 *   </div>
 *
 * 行为：初始化按 data-tags（逗号分隔）渲染 .tag-chip（文本用 textContent，× 为
 * button.tag-chip-x）；Enter / 逗号提交草稿（trim；重复值被拒绝——清空草稿并短暂
 * .is-shake 抖动反馈；达到 data-max 拒加并保留草稿）；空草稿 Backspace 删尾 chip；blur 提交草稿；chip × mousedown
 * preventDefault 防 blur 抢跑、click 删除；达到 data-max 容器加 .is-max。
 * 每次变化把最新 tags 回写容器 data-tags 并派发 icen:tags-change { tags }；
 * tags 非空时清空 placeholder。
 * 同一容器重复 init 幂等；initTagInput 返回销毁函数（移除 field 全部监听并复位
 * 幂等标记，销毁后可重新 init；销毁至重 init 之间残留 chip 的点击不派发）。SSR 下返回 no-op。
 */

import { emitIcen } from './events';

interface MarkedTagInput extends HTMLElement {
  __icenTagInit?: boolean;
}

function setup(wrap: HTMLElement): (() => void) | undefined {
  const el = wrap as MarkedTagInput;
  if (el.__icenTagInit) return undefined;
  el.__icenTagInit = true;

  const fieldEl = wrap.querySelector<HTMLInputElement>('.tag-input-field');
  if (!fieldEl) return undefined;
  const field = fieldEl; // 闭包内不保留 narrowing，转为非空常量
  const maxAttr = wrap.getAttribute('data-max');
  // data-max="0" / 非法值视为不限（落到 Infinity）：保持现行为，仅声明语义
  const max = maxAttr ? Number(maxAttr) || Infinity : Infinity;
  const placeholder = field.placeholder;

  /* 销毁后残留 chip 的监听不派发（重 init 会整体重建 chip） */
  let alive = true;

  /* IME 组合态跟踪：compositionend 在部分浏览器里晚于 Enter 的 keydown，
     仅看 ev.isComposing 会漏判，本地跟踪兜底 */
  let isComposing = false;
  const onCompositionStart = (): void => { isComposing = true; };
  const onCompositionEnd = (): void => { isComposing = false; };

  let tags: string[] = (wrap.getAttribute('data-tags') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  /* 自动 aria-label 只在宿主未提供时维护：首次自动写入后记 flag，之后 sync 无条件
     更新计数文案——否则「共 N 个」只写一次即陈旧 */
  const autoLabel = !wrap.hasAttribute('aria-label');

  function sync(): void {
    wrap.setAttribute('data-tags', tags.join(','));
    wrap.classList.toggle('is-max', tags.length >= max);
    field.placeholder = tags.length === 0 ? placeholder : '';
    if (autoLabel) wrap.setAttribute('aria-label', `标签输入，共 ${tags.length} 个`);
  }

  function emit(): void {
    if (!alive) return;
    emitIcen(wrap, 'icen:tags-change', { tags: [...tags] });
  }

  /* 重复值拒绝的抖动反馈：容器挂 .is-shake（tag-input.css 的 tag-shake keyframes，
     默认 0.32s ≈ 定时器 320ms）。强制 reflow 重启动画（连续重复时也能再抖）；
     一次性定时器摘类，destroy 时清理 */
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;
  function shake(): void {
    el.classList.remove('is-shake');
    void el.offsetWidth;
    el.classList.add('is-shake');
    if (shakeTimer) clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => {
      el.classList.remove('is-shake');
      shakeTimer = null;
    }, 320);
  }

  function remove(index: number): void {
    if (!alive) return;
    tags.splice(index, 1);
    render();
    emit();
  }

  function chip(tag: string, index: number): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = 'tag-chip';
    const label = document.createElement('span');
    label.textContent = tag;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'tag-chip-x focus-ring';
    x.textContent = '×';
    x.setAttribute('aria-label', `移除 ${tag}`);
    // 防 input blur 抢跑：blur 会先提交草稿，再轮到 remove，顺序会乱
    x.addEventListener('mousedown', (ev) => ev.preventDefault());
    x.addEventListener('click', () => remove(index));
    el.append(label, x);
    return el;
  }

  function render(): void {
    wrap.querySelectorAll('.tag-chip').forEach((c) => c.remove());
    tags.forEach((t, i) => wrap.insertBefore(chip(t, i), field));
    sync();
  }

  function commit(): void {
    if (!alive) return;
    const v = field.value.trim();
    if (!v) return;
    if (tags.length >= max) return; // 拒加，保留草稿让用户看到未被接受
    if (tags.includes(v)) { // 重复：拒绝——清空草稿并抖动反馈
      field.value = '';
      shake();
      return;
    }
    tags.push(v);
    field.value = '';
    render();
    emit();
  }

  const onKeyDown = (ev: KeyboardEvent): void => {
    // IME 组合中（中文/日文输入法选词）Enter 是确认候选，不提交
    if (isComposing || ev.isComposing) return;
    if (ev.key === 'Enter' || ev.key === ',') {
      ev.preventDefault();
      commit();
    } else if (ev.key === 'Backspace' && !field.value && tags.length > 0) {
      remove(tags.length - 1);
    }
  };

  field.addEventListener('compositionstart', onCompositionStart);
  field.addEventListener('compositionend', onCompositionEnd);
  field.addEventListener('keydown', onKeyDown);
  field.addEventListener('blur', commit);

  render();

  /* 销毁：移除 field 全部监听并复位幂等标记（可重新 init） */
  return () => {
    alive = false;
    if (shakeTimer) clearTimeout(shakeTimer);
    field.removeEventListener('compositionstart', onCompositionStart);
    field.removeEventListener('compositionend', onCompositionEnd);
    field.removeEventListener('keydown', onKeyDown);
    field.removeEventListener('blur', commit);
    el.__icenTagInit = false;
  };
}

/**
 * 为 root 下每个 .tag-input 容器初始化（root 自身匹配也算；data-tags 为可选初始值配置）。
 * 返回销毁函数：移除本次挂上的全部监听并复位幂等标记（销毁后可重新 init）。SSR 下返回 no-op。
 */
export function initTagInput(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (typeof document !== 'undefined') {
    const scope = root ?? document;
    const containers: HTMLElement[] = [];
    if (scope instanceof HTMLElement && scope.matches('.tag-input')) containers.push(scope);
    containers.push(...Array.from(scope.querySelectorAll<HTMLElement>('.tag-input')));
    for (const c of containers) {
      const cleanup = setup(c);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
