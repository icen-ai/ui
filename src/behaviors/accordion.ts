/*
 * @icen.ai/ui — Behavior: accordion（手风琴，与 components/content.css 的 .accordion 配套）
 *
 * DOM 契约：
 *   <div class="accordion" data-single>
 *     <div class="accordion-item is-open">
 *       <button class="accordion-trigger" aria-expanded="true">
 *         标题 <svg class="accordion-chevron">…</svg>
 *       </button>
 *       <div class="accordion-panel"><div class="accordion-panel-inner">内容</div></div>
 *     </div>
 *   </div>
 *
 * 展开 = item 挂 .is-open + trigger aria-expanded 同步；容器带 data-single 时展开一项会收起其余。
 * 面板高度过渡纯 CSS（grid-template-rows 0fr→1fr）。同一容器重复 init 幂等。SSR 下为 no-op。
 */

interface MarkedElement extends Element {
  __icenAccordionInit?: boolean;
}

function setup(container: Element): void {
  const el = container as MarkedElement;
  if (el.__icenAccordionInit) return;
  el.__icenAccordionInit = true;

  const single = container.hasAttribute('data-single');

  container.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest('.accordion-trigger');
    if (!trigger) return;
    // 嵌套 accordion 时只处理直接属于本容器的 trigger
    const item = trigger.closest('.accordion-item');
    if (!item || trigger.closest('.accordion') !== container) return;
    if (item.classList.contains('is-disabled')) return;

    const open = item.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', String(open));

    if (single && open) {
      container.querySelectorAll('.accordion-item.is-open').forEach((other) => {
        if (other === item) return;
        other.classList.remove('is-open');
        other.querySelector('.accordion-trigger')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  /* 键盘导航：Home/End 跳到首/末项；Space/Enter 在 focus 时 toggle */
  container.addEventListener('keydown', (ev) => {
    const kev = ev as KeyboardEvent;
    const target = kev.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest('.accordion-trigger');
    if (!trigger || trigger.closest('.accordion') !== container) return;

    const triggers = Array.from(
      container.querySelectorAll<HTMLElement>('.accordion-item:not(.is-disabled) > .accordion-trigger'),
    );
    const idx = triggers.indexOf(trigger as HTMLElement);
    if (idx === -1) return;

    if (kev.key === 'Home') {
      kev.preventDefault();
      triggers[0]?.focus();
    } else if (kev.key === 'End') {
      kev.preventDefault();
      triggers[triggers.length - 1]?.focus();
    }
  });
}

/** 为 root 下每个 .accordion 容器初始化（root 自身是 .accordion 也算）。 */
export function initAccordion(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;
  const containers: Element[] = [];
  if (scope instanceof Element && scope.matches('.accordion')) containers.push(scope);
  containers.push(...Array.from(scope.querySelectorAll('.accordion')));
  for (const c of containers) setup(c);
}
