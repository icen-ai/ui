/*
 * @icen.ai/ui — Behavior: carousel（轮播，与 components/media.css 的 .icen-carousel 配套）
 *
 * DOM 契约：
 *   <div class="icen-carousel">
 *     <div class="icen-carousel-track">
 *       <div class="icen-carousel-slide">…</div> × n
 *     </div>
 *     <button class="icen-carousel-arrow icen-carousel-arrow--prev" aria-label="上一张">…</button>
 *     <button class="icen-carousel-arrow icen-carousel-arrow--next" aria-label="下一张">…</button>
 *     <div class="icen-carousel-dots"></div>   <!-- 留空，dot 按钮由本 behavior 自动生成 -->
 *   </div>
 *
 * 切换 = track.style.transform = translateX(-i*100%)；首尾循环；当前 dot 挂 .is-active。
 * dots 按 slide 数量自动生成（button.icen-carousel-dot，aria-label「第 N 张」），点击直达；
 * slide 动态增删后导航/渲染时重新统计，数量变化即重建 dots。
 * 触屏（pointer: coarse）自动开 data-icen-gestures="swipe"：swipe-left → 下一张、
 * swipe-right → 上一张（与箭头/dots/键盘同一 go() 通道），销毁时还原词位。
 * icen:carousel-change 仅在用户导航（箭头/dots/键盘/滑动）时派发，初始化不派发。
 * 同一容器重复 init 幂等；initCarousel 返回销毁函数（移除箭头/键盘/dots 监听并
 * 复位幂等标记，销毁后可重新 init）。SSR 下返回 no-op。
 */

import { emitIcen } from './events';
import { t } from './i18n';

interface MarkedElement extends Element {
  __icenCarouselInit?: boolean;
}

function setup(carousel: Element): (() => void) | undefined {
  const el = carousel as MarkedElement;
  if (el.__icenCarouselInit) return undefined;

  const track = carousel.querySelector<HTMLElement>(':scope > .icen-carousel-track');
  if (!track) return undefined;

  const prev = carousel.querySelector<HTMLButtonElement>('.icen-carousel-arrow--prev');
  const next = carousel.querySelector<HTMLButtonElement>('.icen-carousel-arrow--next');
  const dotsBox = carousel.querySelector<HTMLElement>('.icen-carousel-dots');

  /* 箭头 const（非提升的 function 声明）：守卫建立的 const 窄化才能保留进闭包体 */
  const querySlides = (): HTMLElement[] =>
    Array.from(track.querySelectorAll<HTMLElement>(':scope > .icen-carousel-slide'));

  let index = 0;
  let slides = querySlides();
  let count = slides.length;
  // 两个校验（track 存在 / 至少 1 张 slide）都过后再置位：结构不完整早退不置位，
  // 以便补全后重新 init 可重试
  if (count === 0) return undefined;
  el.__icenCarouselInit = true;
  let dots: HTMLButtonElement[] = [];

  /* 当前代 dots 的解绑函数（buildDots 重建时先摘旧监听，销毁时统一调用） */
  let dotOffs: Array<() => void> = [];

  function buildDots(): void {
    for (const off of dotOffs) off();
    dotOffs = [];
    if (!dotsBox) return;
    while (dotsBox.firstChild) dotsBox.removeChild(dotsBox.firstChild);
    dots = [];
    if (count <= 1) return;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'icen-carousel-dot';
      dot.setAttribute('aria-label', t('carousel.item', { p0: i + 1 }));
      const onDotClick = (): void => go(i);
      dot.addEventListener('click', onDotClick);
      dotOffs.push(() => dot.removeEventListener('click', onDotClick));
      dotsBox.appendChild(dot);
      dots.push(dot);
    }
  }

  /* slide 动态增删：重新统计，数量变化则重建 dots 并钳住 index */
  function syncSlides(): void {
    slides = querySlides();
    if (slides.length === count) return;
    count = slides.length;
    if (index >= count) index = Math.max(0, count - 1);
    buildDots();
  }

  const render = (): void => {
    track.style.transform = `translateX(${-index * 100}%)`;
    slides.forEach((s, i) => s.setAttribute('aria-hidden', String(i !== index)));
    dots.forEach((d, i) => {
      d.classList.toggle('is-active', i === index);
      if (i === index) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  }

  /* 用户导航入口：唯一派发 icen:carousel-change 的地方（初始化不派发） */
  function go(i: number): void {
    syncSlides();
    if (count === 0) return;
    // 循环：越过首尾回卷
    index = ((i % count) + count) % count;
    render();
    emitIcen(carousel, 'icen:carousel-change', { index, count });
  }

  const onPrev = (): void => go(index - 1);
  const onNext = (): void => go(index + 1);
  prev?.addEventListener('click', onPrev);
  next?.addEventListener('click', onNext);

  /* 触屏（pointer: coarse）自动开 swipe 翻页：swipe-left → 下一张，swipe-right → 上一张，
     与箭头/dots/键盘同一 go() 通道。不做跟手 drag（保持简单可靠）；reduced-motion 照常
     （滑动是操纵不是动画，守卫只压缩过渡时长）。仅 coarse 端开通并挂监听，
     销毁时摘监听并还原 swipe 词位（保留宿主原有其它手势词）。 */
  const onSwipeLeft = (): void => go(index + 1);
  const onSwipeRight = (): void => go(index - 1);
  let swipeOff: (() => void) | null = null;
  const coarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  if (coarse) {
    const tokens = (carousel.getAttribute('data-icen-gestures') ?? '').split(/\s+/).filter(Boolean);
    let addedToken = false;
    if (!tokens.includes('swipe')) {
      carousel.setAttribute('data-icen-gestures', [...tokens, 'swipe'].join(' '));
      addedToken = true;
    }
    carousel.addEventListener('icen:swipe-left', onSwipeLeft);
    carousel.addEventListener('icen:swipe-right', onSwipeRight);
    swipeOff = () => {
      carousel.removeEventListener('icen:swipe-left', onSwipeLeft);
      carousel.removeEventListener('icen:swipe-right', onSwipeRight);
      if (addedToken) {
        const rest = (carousel.getAttribute('data-icen-gestures') ?? '')
          .split(/\s+/)
          .filter((t) => t && t !== 'swipe');
        if (rest.length) carousel.setAttribute('data-icen-gestures', rest.join(' '));
        else carousel.removeAttribute('data-icen-gestures');
      }
    };
  }

  /* 键盘 ←/→/Home/End（仅当焦点在 carousel 内） */
  const onKeyDown = (ev: Event): void => {
    const kev = ev as KeyboardEvent;
    switch (kev.key) {
      case 'ArrowLeft':  kev.preventDefault(); go(index - 1); break;
      case 'ArrowRight': kev.preventDefault(); go(index + 1); break;
      case 'Home':       kev.preventDefault(); go(0); break;
      case 'End':        kev.preventDefault(); go(count - 1); break;
    }
  };
  carousel.addEventListener('keydown', onKeyDown);

  buildDots();
  render();

  /* 销毁：移除箭头/键盘/触屏滑动/当前代 dots 监听，清空 dots 容器并复位幂等标记（可重新 init） */
  return () => {
    prev?.removeEventListener('click', onPrev);
    next?.removeEventListener('click', onNext);
    carousel.removeEventListener('keydown', onKeyDown);
    swipeOff?.();
    for (const off of dotOffs) off();
    dotOffs = [];
    /* dots 全为本行为生成（buildDots 重建前先清容器），销毁时清空，对照 tabs 回收 .icen-tabs-ink */
    dotsBox?.replaceChildren();
    el.__icenCarouselInit = false;
  };
}

/**
 * 为 root 下每个 .icen-carousel 初始化（root 自身是 .icen-carousel 也算）。
 * 返回销毁函数：移除本次挂上的全部监听并复位幂等标记（销毁后可重新 init）。SSR 下返回 no-op。
 */
export function initCarousel(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (typeof document !== 'undefined') {
    const scope = root ?? document;
    const containers: Element[] = [];
    if (scope instanceof Element && scope.matches('.icen-carousel')) containers.push(scope);
    containers.push(...Array.from(scope.querySelectorAll('.icen-carousel')));
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
