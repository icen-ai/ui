/*
 * @icen.ai/ui — Behavior: input（清除钮 / 密码可见切换 / textarea 自适应 / OTP 单元格）
 * 与 components/input.css、components/segmented.css（.otp）配套，data 属性驱动。
 *
 * DOM 契约：
 *   ① .input-wrap 内同时存在 input.input 与 .input-clear → 点击清空、派发 input 事件并聚焦。
 *   ② .input-wrap 内存在 .input-pw-toggle → 切换包裹内 input 的 type（password ↔ text），
 *      按钮内 [data-icon="show"] / [data-icon="hide"] 两个图标随状态切换 hidden，
 *      aria-label 在「显示密码 / 隐藏密码」间同步。
 *   ③ textarea[data-autosize] → input 事件自适应高度：height:auto → scrollHeight，
 *      按 data-min-rows（默认 3）/ data-max-rows（可选）钳制；初始化时先跑一次。
 *   ④ .otp 容器内的 .otp-cell 单元格 → 输入取末字符并跳下一格；空格 Backspace / 方向键
 *      移动焦点；粘贴按字符分摊到后续单元格。
 * 幂等：同一元素重复 init 不重复绑定。
 */

interface MarkedElement extends Element {
  __icenInputInit?: boolean;
}

function setupClear(wrap: Element): void {
  const btn = wrap.querySelector('.input-clear');
  const field = wrap.querySelector<HTMLInputElement>('input.input');
  if (!btn || !field) return;
  btn.addEventListener('click', () => {
    field.value = '';
    // 派发 input 事件，让外部监听者与受控状态同步
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
  });
}

function setupPasswordToggle(wrap: Element): void {
  const btn = wrap.querySelector('.input-pw-toggle');
  const field = wrap.querySelector<HTMLInputElement>('input.input');
  if (!btn || !field) return;
  const iconShow = btn.querySelector<HTMLElement>('[data-icon="show"]');
  const iconHide = btn.querySelector<HTMLElement>('[data-icon="hide"]');
  btn.setAttribute('aria-label', '显示密码');
  btn.addEventListener('click', () => {
    const show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    if (iconShow) iconShow.hidden = show;
    if (iconHide) iconHide.hidden = !show;
    btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
  });
}

function resizeTextarea(ta: HTMLTextAreaElement): void {
  ta.style.height = 'auto';
  const cs = getComputedStyle(ta);
  const lineHeight = parseFloat(cs.lineHeight) || 20;
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const minRows = Number(ta.getAttribute('data-min-rows') ?? '3') || 3;
  const maxAttr = ta.getAttribute('data-max-rows');
  const maxRows = maxAttr ? Number(maxAttr) || 0 : 0;
  const minH = minRows * lineHeight + padY;
  const maxH = maxRows > 0 ? maxRows * lineHeight + padY : Infinity;
  ta.style.height = `${Math.max(minH, Math.min(ta.scrollHeight, maxH))}px`;
}

function setupAutosize(ta: HTMLTextAreaElement): void {
  const el = ta as HTMLTextAreaElement & MarkedElement;
  if (el.__icenInputInit) return;
  el.__icenInputInit = true;
  ta.addEventListener('input', () => resizeTextarea(ta));
  resizeTextarea(ta);
}

function setupOtp(group: Element): void {
  const el = group as MarkedElement;
  if (el.__icenInputInit) return;
  el.__icenInputInit = true;

  const cells = Array.from(group.querySelectorAll<HTMLInputElement>('.otp-cell'));
  cells.forEach((cell, i) => {
    cell.addEventListener('input', () => {
      const ch = cell.value.slice(-1);
      cell.value = ch;
      if (ch && i < cells.length - 1) cells[i + 1].focus();
    });
    cell.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' && !cell.value && i > 0) cells[i - 1].focus();
      if (ev.key === 'ArrowLeft' && i > 0) { ev.preventDefault(); cells[i - 1].focus(); }
      if (ev.key === 'ArrowRight' && i < cells.length - 1) { ev.preventDefault(); cells[i + 1].focus(); }
    });
    cell.addEventListener('paste', (ev) => {
      ev.preventDefault();
      const text = (ev.clipboardData?.getData('text') ?? '')
        .replace(/\s/g, '')
        .slice(0, cells.length - i);
      for (let k = 0; k < text.length; k++) {
        const target = cells[i + k];
        target.value = text[k] ?? '';
      }
      cells[Math.min(i + text.length, cells.length - 1)].focus();
    });
  });
}

/** 为 root 下所有输入类结构初始化（root 自身匹配也算）。幂等。 */
export function initInput(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;

  const wraps: Element[] = [];
  if (root instanceof Element && root.matches('.input-wrap')) wraps.push(root);
  wraps.push(...Array.from(root.querySelectorAll('.input-wrap')));
  for (const w of wraps) {
    const el = w as MarkedElement;
    if (el.__icenInputInit) continue;
    el.__icenInputInit = true;
    setupClear(w);
    setupPasswordToggle(w);
  }

  const textareas: HTMLTextAreaElement[] = [];
  if (root instanceof HTMLTextAreaElement && root.matches('[data-autosize]')) textareas.push(root);
  textareas.push(...Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea[data-autosize]')));
  for (const ta of textareas) setupAutosize(ta);

  const otps: Element[] = [];
  if (root instanceof Element && root.matches('.otp')) otps.push(root);
  otps.push(...Array.from(root.querySelectorAll('.otp')));
  for (const g of otps) setupOtp(g);
}
