/*
 * @icen.ai/ui — Behavior: tag-input（多值标签编辑，与 components/tag-input.css 配套）
 *
 * DOM 契约：
 *   <div class="tag-input" data-tags="初始,标签" data-max="5">
 *     <input class="tag-input-field" placeholder="…" />
 *   </div>
 *
 * 行为：初始化按 data-tags（逗号分隔）渲染 .tag-chip（文本用 textContent，× 为
 * button.tag-chip-x）；Enter / 逗号提交草稿（trim；重复值静默清空；达到 data-max
 * 拒加并保留草稿）；空草稿 Backspace 删尾 chip；blur 提交草稿；chip × mousedown
 * preventDefault 防 blur 抢跑、click 删除；达到 data-max 容器加 .is-max。
 * 每次变化把最新 tags 回写容器 data-tags；tags 非空时清空 placeholder。
 * 同一容器重复 init 幂等。
 */

interface MarkedTagInput extends HTMLElement {
  __icenTagInit?: boolean;
}

function setup(wrap: HTMLElement): void {
  const el = wrap as MarkedTagInput;
  if (el.__icenTagInit) return;
  el.__icenTagInit = true;

  const fieldEl = wrap.querySelector<HTMLInputElement>('.tag-input-field');
  if (!fieldEl) return;
  const field = fieldEl; // 闭包内不保留 narrowing，转为非空常量
  const maxAttr = wrap.getAttribute('data-max');
  const max = maxAttr ? Number(maxAttr) || Infinity : Infinity;
  const placeholder = field.placeholder;

  let tags: string[] = (wrap.getAttribute('data-tags') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  function sync(): void {
    wrap.setAttribute('data-tags', tags.join(','));
    wrap.classList.toggle('is-max', tags.length >= max);
    field.placeholder = tags.length === 0 ? placeholder : '';
  }

  function remove(index: number): void {
    tags.splice(index, 1);
    render();
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
    const v = field.value.trim();
    if (!v) return;
    if (tags.length >= max) return; // 拒加，保留草稿让用户看到未被接受
    if (tags.includes(v)) { field.value = ''; return; } // 重复：静默清空
    tags.push(v);
    field.value = '';
    render();
  }

  field.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ',') {
      ev.preventDefault();
      commit();
    } else if (ev.key === 'Backspace' && !field.value && tags.length > 0) {
      remove(tags.length - 1);
    }
  });
  field.addEventListener('blur', commit);

  render();
}

/** 为 root 下每个 .tag-input[data-tags] 容器初始化（root 自身匹配也算）。 */
export function initTagInput(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const containers: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches('.tag-input[data-tags]')) containers.push(root);
  containers.push(...Array.from(root.querySelectorAll<HTMLElement>('.tag-input[data-tags]')));
  for (const c of containers) setup(c);
}
