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
 * 切换 = track.style.transform = translateX(-i*100%)；首尾循环；当前 dot 挂 .active。
 * dots 按 slide 数量自动生成（button.carousel-dot，aria-label「第 N 张」），点击直达。
 * 同一容器重复 init 幂等。SSR 下为 no-op。
 */

interface MarkedElement extends Element {
  __icenCarouselInit?: boolean;
}

function setup(carousel: Element): void {
  const el = carousel as MarkedElement;
  if (el.__icenCarouselInit) return;
  el.__icenCarouselInit = true;

  const track = carousel.querySelector<HTMLElement>(':scope > .carousel-track');
  if (!track) return;
  const slides = Array.from(track.querySelectorAll<HTMLElement>(':scope > .carousel-slide'));
  const count = slides.length;
  if (count === 0) return;

  const prev = carousel.querySelector<HTMLButtonElement>('.carousel-arrow--prev');
  const next = carousel.querySelector<HTMLButtonElement>('.carousel-arrow--next');
  const dotsBox = carousel.querySelector<HTMLElement>('.carousel-dots');

  let index = 0;
  const dots: HTMLButtonElement[] = [];

  if (dotsBox && count > 1) {
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

  function render(): void {
    if (!track) return;
    track.style.transform = `translateX(${-index * 100}%)`;
    slides.forEach((s, i) => s.setAttribute('aria-hidden', String(i !== index)));
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
      if (i === index) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
    carousel.dispatchEvent(new CustomEvent('icen:carousel-change', {
      bubbles: true,
      detail: { index, count },
    }));
  }

  function go(i: number): void {
    // 循环：越过首尾回卷
    index = ((i % count) + count) % count;
    render();
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
  render();
}

/** 为 root 下每个 .carousel 初始化（root 自身是 .carousel 也算）。 */
export function initCarousel(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const containers: Element[] = [];
  if (root instanceof Element && root.matches('.carousel')) containers.push(root);
  containers.push(...Array.from(root.querySelectorAll('.carousel')));
  for (const c of containers) setup(c);
}
