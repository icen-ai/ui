/*
 * @icen.ai/ui — Behavior: slider（单值 / 双滑块，与 components/slider.css 配套）
 *
 * DOM 契约（单值）：
 *   <div class="slider">
 *     <div class="slider-track"></div>
 *     <div class="slider-fill"></div>
 *     <div class="slider-thumb"></div>
 *     <input class="slider-native" type="range" min="0" max="100" value="40" />
 *   </div>
 * 双滑块：.slider--dual 内 .slider-range + .slider-thumb--lo / .slider-thumb--hi
 *   + 两个 .slider-native[data-thumb="lo"|"hi"]。
 *
 * 行为：监听 .slider-native 的 input 事件，按 (value-min)/(max-min) 同步
 * .slider-fill 的 width% 与 .slider-thumb 的 left%；双滑块更新 .slider-range 的
 * left/right 与两个 thumb，并钳制 lo ≤ hi − step（反向同理 hi ≥ lo + step）。
 * 双滑块另按 lo/hi 位置给两个 native input 写 clip-path，把点击区域切成左右两半
 * （同 opengal DualRangeSlider，否则叠在上层的 input 会吞掉全部指针事件）。
 * 初始化时先同步一次；同一容器重复 init 幂等。
 */

interface MarkedSlider extends Element {
  __icenSliderInit?: boolean;
}

function pct(input: HTMLInputElement): number {
  const min = Number(input.min || '0');
  const max = Number(input.max || '100');
  const range = max - min;
  if (range <= 0) return 0; // min === max 时除零保护
  return ((Number(input.value) - min) / range) * 100;
}

function setupSingle(slider: Element, native: HTMLInputElement): void {
  const fill = slider.querySelector<HTMLElement>('.slider-fill');
  const thumb = slider.querySelector<HTMLElement>('.slider-thumb');
  const sync = (): void => {
    const p = pct(native);
    if (fill) fill.style.width = `${p}%`;
    if (thumb) thumb.style.left = `calc(${p}% - 8px)`;
  };
  native.addEventListener('input', sync);
  sync();
}

function setupDual(slider: Element, natives: HTMLInputElement[]): void {
  const lo = natives.find((n) => n.getAttribute('data-thumb') === 'lo') ?? natives[0];
  const hi = natives.find((n) => n.getAttribute('data-thumb') === 'hi') ?? natives[1];
  if (!lo || !hi || lo === hi) return;
  const range = slider.querySelector<HTMLElement>('.slider-range');
  const thumbLo = slider.querySelector<HTMLElement>('.slider-thumb--lo');
  const thumbHi = slider.querySelector<HTMLElement>('.slider-thumb--hi');

  const sync = (changed: HTMLInputElement | null): void => {
    const step = Number(lo.step || '1') || 1;
    let vLo = Number(lo.value);
    let vHi = Number(hi.value);
    if (changed === lo && vLo > vHi - step) { vLo = vHi - step; lo.value = String(vLo); }
    if (changed === hi && vHi < vLo + step) { vHi = vLo + step; hi.value = String(vHi); }
    const pLo = pct(lo);
    const pHi = pct(hi);
    if (range) {
      range.style.left = `${pLo}%`;
      range.style.right = `${100 - pHi}%`;
    }
    if (thumbLo) thumbLo.style.left = `calc(${pLo}% - 8px)`;
    if (thumbHi) thumbHi.style.left = `calc(${pHi}% - 8px)`;
    // 点击区域切分：lo 只响应自身位置以左，hi 只响应自身位置以右
    lo.style.clipPath = `inset(0 ${100 - pLo}% 0 0)`;
    hi.style.clipPath = `inset(0 0 0 ${pHi}%)`;
  };

  lo.addEventListener('input', () => sync(lo));
  hi.addEventListener('input', () => sync(hi));
  sync(null);
}

function setup(slider: Element): void {
  const el = slider as MarkedSlider;
  if (el.__icenSliderInit) return;
  el.__icenSliderInit = true;

  const natives = Array.from(slider.querySelectorAll<HTMLInputElement>('.slider-native'));
  if (natives.length === 0) return;
  if (slider.classList.contains('slider--dual')) setupDual(slider, natives);
  else setupSingle(slider, natives[0] as HTMLInputElement);
}

/** 为 root 下每个 .slider 容器初始化（root 自身是 .slider 也算）。 */
export function initSlider(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const containers: Element[] = [];
  if (root instanceof Element && root.matches('.slider')) containers.push(root);
  containers.push(...Array.from(root.querySelectorAll('.slider')));
  for (const c of containers) setup(c);
}
