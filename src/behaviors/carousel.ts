/*
 * @icen.ai/ui — Behavior: carousel（轮播，与 components/media.css 的 .carousel 配套）
 *
 * DOM 契约：
 *   <div class="carousel">
 *     <div class="carousel-track">
 *       <div class="carousel-slide">…</div> × n
 *     </div>
 *     <button class="carousel-arrow carousel-arrow--prev" aria-label="上一张">…</button>
 *     <button class="carousel-arrow carousel-arrow--next" aria-label="下一张">…</button>
 *     <div class="carousel-dots"></div>   <!-- 留空，dot 按钮由本 behavior 自动生成 -->
 *   </div>
 *
 * 切换 = track.style.transform = translateX(-i*100%)；首尾循环；当前 dot 挂 .is-active。
 * dots 按 slide 数量自动生成（button.carousel-dot，aria-label「第 N 张」），点击直达；
 * slide 动态增删后导航/渲染时重新统计，数量变化即重建 dots。
 * icen:carousel-change 仅在用户导航（箭头/dots/键盘）时派发，初始化不派发。
 * 同一容器重复 init 幂等。SSR 下为 no-op。
 */

interface MarkedElement extends Element {
  __icenCarouselInit?: boolean;
}

function setup(carousel: Element): void {
  const el = carousel as MarkedElement;
  if (el.__icenCarouselInit) return;
  el.__icenCarouselInit = true;

  const trackQ = carousel.querySelector<HTMLElement>(':scope > .carousel-track');
  if (!trackQ) return;
  const track: HTMLElement = trackQ;

  const prev = carousel.querySelector<HTMLButtonElement>('.carousel-arrow--prev');
  const next = carousel.querySelector<HTMLButtonElement>('.carousel-arrow--next');
  const dotsBox = carousel.querySelector<HTMLElement>('.carousel-dots');

  let index = 0;
  let slides = querySlides();
  let count = slides.length;
  if (count === 0) return;
  let dots: HTMLButtonElement[] = [];

  function querySlides(): HTMLElement[] {
    return Array.from(track.querySelectorAll<HTMLElement>(':scope > .carousel-slide'));
  }

  function buildDots(): void {
    if (!dotsBox) return;
    while (dotsBox.firstChild) dotsBox.removeChild(dotsBox.firstChild);
    dots = [];
    if (count <= 1) return;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `第 ${i + 1} 张`);
      dot.addEventListener('click', () => go(i));
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

  function render(): void {
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
    carousel.dispatchEvent(new CustomEvent('icen:carousel-change', {
      bubbles: true,
      detail: { index, count },
    }));
  }

  prev?.addEventListener('click', () => go(index - 1));
  next?.addEventListener('click', () => go(index + 1));

  /* 键盘 ←/→/Home/End（仅当焦点在 carousel 内） */
  carousel.addEventListener('keydown', (ev: Event) => {
    const kev = ev as KeyboardEvent;
    switch (kev.key) {
      case 'ArrowLeft':  kev.preventDefault(); go(index - 1); break;
      case 'ArrowRight': kev.preventDefault(); go(index + 1); break;
      case 'Home':       kev.preventDefault(); go(0); break;
      case 'End':        kev.preventDefault(); go(count - 1); break;
    }
  });

  /* reduced-motion：取消 transition 防闪烁（CSS 已守，行为层不再二次处理） */
  buildDots();
  render();
}

/** 为 root 下每个 .carousel 初始化（root 自身是 .carousel 也算）。 */
export function initCarousel(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;
  const containers: Element[] = [];
  if (scope instanceof Element && scope.matches('.carousel')) containers.push(scope);
  containers.push(...Array.from(scope.querySelectorAll('.carousel')));
  for (const c of containers) setup(c);
}
