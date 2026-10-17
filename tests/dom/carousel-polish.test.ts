import {afterEach, expect, test} from 'bun:test';
import {initCarousel} from '../../src/behaviors/carousel';

const cleanup: (() => void)[] = [];

function fixture(slides = 3, attrs = '') {
  const carousel = document.createElement('div');
  carousel.className = 'icen-carousel';
  const track = document.createElement('div');
  track.className = 'icen-carousel-track';
  for (let i = 0; i < slides; i++) {
    const s = document.createElement('div');
    s.className = 'icen-carousel-slide';
    s.textContent = `内容 ${i + 1}`;
    track.append(s);
  }
  const prev = document.createElement('button');
  prev.className = 'icen-carousel-arrow icen-carousel-arrow--prev';
  const next = document.createElement('button');
  next.className = 'icen-carousel-arrow icen-carousel-arrow--next';
  const dots = document.createElement('div');
  dots.className = 'icen-carousel-dots';
  carousel.append(track, prev, next, dots);
  if (attrs) carousel.setAttribute('data-extra', attrs);
  document.body.append(carousel);
  return { carousel, prev, next, dots };
}
function key(el: HTMLElement, name: string) { el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })); }

afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren(); });

test('keyboard mirrors visual direction under RTL and announces status through a live line', () => {
  const { carousel } = fixture();
  cleanup.push(initCarousel());
  const status = () => carousel.querySelector('.icen-carousel-status');
  expect(status()?.getAttribute('role')).toBe('status');
  expect(status()?.textContent).toBe('第 1 / 3 张');

  key(carousel, 'ArrowRight');
  expect(status()?.textContent).toBe('第 2 / 3 张');
  key(carousel, 'ArrowLeft');
  expect(status()?.textContent).toBe('第 1 / 3 张');

  carousel.style.direction = 'rtl';
  key(carousel, 'ArrowLeft'); // RTL：左键 = 视觉前进
  expect(status()?.textContent).toBe('第 2 / 3 张');
  key(carousel, 'ArrowRight');
  expect(status()?.textContent).toBe('第 1 / 3 张');

  key(carousel, 'End');
  expect(status()?.textContent).toBe('第 3 / 3 张');
  key(carousel, 'Home');
  expect(status()?.textContent).toBe('第 1 / 3 张');
});

test('slides carry W3C semantics and dispose restores authored attributes', () => {
  const { carousel } = fixture();
  carousel.setAttribute('aria-roledescription', '作品精选'); // 作者声明优先
  cleanup.push(initCarousel());
  expect(carousel.getAttribute('aria-roledescription')).toBe('作品精选');
  const slides = carousel.querySelectorAll('.icen-carousel-slide');
  expect(slides[1].getAttribute('role')).toBe('group');
  expect(slides[1].getAttribute('aria-roledescription')).toBe('幻灯片');
  expect(slides[1].getAttribute('aria-label')).toBe('第 2 张');
  expect(slides[0].getAttribute('aria-hidden')).toBe('false');
  expect(slides[1].getAttribute('aria-hidden')).toBe('true');
});

test('authored index slot stays in sync; dispose removes generated nodes and allows re-init', () => {
  const { carousel, next } = fixture(4);
  const slot = document.createElement('span');
  slot.className = 'icen-carousel-index';
  carousel.append(slot);
  const dispose = initCarousel();
  expect(slot.textContent).toBe('1 / 4');
  next.click();
  expect(slot.textContent).toBe('2 / 4');
  expect(carousel.querySelectorAll('.icen-carousel-dot')).toHaveLength(4);

  dispose();
  expect(carousel.querySelector('.icen-carousel-status')).toBeNull();
  expect(carousel.querySelectorAll('.icen-carousel-dot')).toHaveLength(0);
  expect(carousel.hasAttribute('aria-roledescription')).toBe(false);
  const slide = carousel.querySelector('.icen-carousel-slide')!;
  expect(slide.hasAttribute('role')).toBe(false);
  expect(slide.hasAttribute('aria-hidden')).toBe(false);

  cleanup.push(initCarousel()); // 销毁后可重新 init
  expect(carousel.querySelectorAll('.icen-carousel-dot')).toHaveLength(4);
  expect(slot.textContent).toBe('1 / 4'); // index 钳位后重染
});

test('dots navigate directly with aria-current and change events fire only on user navigation', () => {
  const { carousel } = fixture();
  const events: number[] = [];
  carousel.addEventListener('icen:carousel-change', (e) => events.push((e as CustomEvent).detail.index));
  cleanup.push(initCarousel());
  expect(events).toEqual([]); // 初始化不派发
  const dots = carousel.querySelectorAll<HTMLButtonElement>('.icen-carousel-dot');
  expect(dots[2].getAttribute('aria-label')).toBe('第 3 张');
  dots[2].click();
  expect(events).toEqual([2]);
  expect(dots[2].getAttribute('aria-current')).toBe('true');
  expect(dots[0].hasAttribute('aria-current')).toBe(false);
});
