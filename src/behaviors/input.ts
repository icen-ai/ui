/*
 * @icen.ai/ui — Behavior: input（清除钮 / 密码可见切换 / textarea 自适应 / OTP / 字符计数 / 输入掩码）
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
 *   ⑤ input.input[data-count] 或 input.input[maxlength] 或 textarea[maxlength] →
 *      自动插入/更新 .input-counter（N 或 N / Max），接近上限转 warning 色，到顶转 error 色。
 *   ⑥ input.input[data-mask="###-####-####"] → 实时掩码格式化（# 数字 / A 字母 / * 任意），
 *      原始值存 data-raw-value。
 *   ⑦ input.input[data-trim] → blur 时自动去除首尾空白。
 *
 * IME 安全：所有 input 事件处理在 compositionstart…compositionend 期间挂起，避免中文/日文
 *   输入法打断组合字符。
 *
 * 幂等：同一元素重复 init 不重复绑定。
 */

import { emitIcen } from './events';

interface MarkedElement extends Element {
  __icenInputInit?: boolean;
  __icenCounterInit?: boolean;
  __icenMaskInit?: boolean;
  __icenTrimInit?: boolean;
}

/* ── IME 组合态追踪（全局，跨所有 input）── */
let isComposing = false;
if (typeof document !== 'undefined') {
  document.addEventListener('compositionstart', () => { isComposing = true; });
  document.addEventListener('compositionend', () => { isComposing = false; });
}

/* ── 清除钮 ── */
function setupClear(wrap: Element): void {
  const btn = wrap.querySelector('.input-clear');
  const field = wrap.querySelector<HTMLInputElement>('input.input, textarea.textarea');
  if (!btn || !field) return;
  btn.addEventListener('click', () => {
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
  });
}

/* ── 密码可见切换 ── */
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

/* ── textarea 自适应 ── */
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

/* ── 字符计数器 ── */
function setupCounter(field: HTMLInputElement | HTMLTextAreaElement): void {
  const el = field as MarkedElement;
  if (el.__icenCounterInit) return;
  const maxAttr = field.getAttribute('maxlength');
  const dataCount = field.getAttribute('data-count');
  // 有 maxlength 或显式 data-count 都启用
  if (!maxAttr && dataCount === null) return;
  el.__icenCounterInit = true;

  const max = maxAttr ? Number(maxAttr) : 0;

  // 创建计数元素
  let counter: HTMLElement | null = null;
  const wrap = field.closest('.input-wrap, .textarea-wrap');

  if (wrap) {
    counter = wrap.querySelector('.input-counter');
    if (!counter) {
      counter = document.createElement('span');
      counter.className = 'input-counter';
      wrap.appendChild(counter);
      // input-wrap 需要加 position: relative 才能定位 counter
      if (wrap.classList.contains('input-wrap')) {
        wrap.classList.add('input-wrap--has-counter');
      }
    }
  }

  const counterEl = counter;
  if (!counterEl) return;

  function update(): void {
    const len = field.value.length;
    counterEl!.textContent = max > 0 ? `${len} / ${max}` : `${len}`;
    counterEl!.classList.remove('is-warn', 'is-error');
    if (max > 0) {
      const ratio = len / max;
      if (ratio >= 1) counterEl!.classList.add('is-error');
      else if (ratio >= 0.8) counterEl!.classList.add('is-warn');
    }
  }

  field.addEventListener('input', () => { if (!isComposing) update(); });
  update();
}

/* ── 输入掩码 ── */
function setupMask(field: HTMLInputElement): void {
  const el = field as MarkedElement;
  if (el.__icenMaskInit) return;
  const mask = field.getAttribute('data-mask');
  if (!mask) return;
  el.__icenMaskInit = true;

  const maskChars: string[] = [];
  for (const ch of mask) maskChars.push(ch);

  /** 判断掩码位置是否为输入位（# 数字 / A 字母 / * 任意）。 */
  function isInputSlot(ch: string): boolean {
    return ch === '#' || ch === 'A' || ch === '*';
  }

  function validate(rawChar: string, slotType: string): boolean {
    if (slotType === '#') return /[0-9]/.test(rawChar);
    if (slotType === 'A') return /[a-zA-Z]/.test(rawChar);
    return true; // '*'
  }

  function applyMask(input: string): string {
    let result = '';
    let rawIdx = 0;
    const rawChars = input.split('');
    for (let i = 0; i < maskChars.length && rawIdx < rawChars.length; i++) {
      const slot = maskChars[i];
      if (isInputSlot(slot)) {
        // 跳过不符合当前 slot 的字符
        while (rawIdx < rawChars.length && !validate(rawChars[rawIdx], slot)) {
          rawIdx++;
        }
        if (rawIdx < rawChars.length) {
          result += rawChars[rawIdx];
          rawIdx++;
        }
      } else {
        result += slot;
      }
    }
    return result;
  }

  /** 提取掩码值的纯输入部分（去掩码字符）。 */
  function extractRaw(formatted: string): string {
    let raw = '';
    for (let i = 0; i < formatted.length && i < maskChars.length; i++) {
      if (isInputSlot(maskChars[i])) raw += formatted[i];
    }
    return raw;
  }

  // 记录上次格式化后的值，避免光标跳动
  let lastFormatted = applyMask(field.value);
  field.value = lastFormatted;
  field.setAttribute('data-raw-value', extractRaw(lastFormatted));

  field.addEventListener('input', () => {
    if (isComposing) return;
    const cursorPos = field.selectionStart ?? 0;
    const oldRaw = extractRaw(lastFormatted);
    // 新增了多少个字符 → 预估 raw input
    const newFull = field.value;
    const newRaw = extractRaw(newFull);
    // 用户可能删了字符 → raw 变短 → 掩码也应该收缩
    const formatted = applyMask(newRaw);
    field.value = formatted;
    field.setAttribute('data-raw-value', extractRaw(formatted));
    lastFormatted = formatted;

    // 光标定位：跟在最后一个新输入位之后
    const rawDelta = newRaw.length - oldRaw.length;
    let targetCursor = cursorPos;
    if (rawDelta > 0) {
      // 向前找到下一个输入位末尾
      let count = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (isInputSlot(maskChars[i])) {
          count++;
          if (count >= newRaw.length) {
            targetCursor = i + 1;
            break;
          }
        }
      }
    } else if (rawDelta < 0) {
      // 删除：光标停在删除点
      targetCursor = Math.min(cursorPos, formatted.length);
    }
    field.setSelectionRange(targetCursor, targetCursor);
  });

  // 阻止不合法按键（但允许功能键）
  field.addEventListener('keydown', (ev) => {
    if (isComposing) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(ev.key)) return;
    // 检查下一个需要填充的 slot
    const currentRaw = extractRaw(field.value);
    const nextSlot = maskChars.find((ch, i) => {
      const filledSlots = maskChars.slice(0, i).filter(isInputSlot).length;
      return isInputSlot(ch) && filledSlots >= currentRaw.length;
    });
    if (nextSlot && !validate(ev.key, nextSlot)) {
      ev.preventDefault();
    }
  });
}

/* ── blur 自动 trim ── */
function setupTrim(field: HTMLInputElement | HTMLTextAreaElement): void {
  if (!field.hasAttribute('data-trim')) return;
  const el = field as MarkedElement;
  if (el.__icenTrimInit) return;
  el.__icenTrimInit = true;
  field.addEventListener('blur', () => {
    const trimmed = field.value.trim();
    if (trimmed !== field.value) {
      field.value = trimmed;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

/* ── OTP 单元格 ── */
function setupOtp(group: Element): void {
  const el = group as MarkedElement;
  if (el.__icenInputInit) return;
  el.__icenInputInit = true;

  const cells = Array.from(group.querySelectorAll<HTMLInputElement>('.otp-cell'));
  const syncFilled = (cell: HTMLInputElement): void => {
    cell.classList.toggle('is-filled', cell.value.length > 0);
  };

  cells.forEach((cell, i) => {
    /* 角色与无障碍补齐：自动给 cell 标 index */
    if (!cell.hasAttribute('aria-label')) {
      cell.setAttribute('aria-label', `第 ${i + 1} 位，共 ${cells.length} 位`);
    }
    syncFilled(cell);

    cell.addEventListener('input', () => {
      if (isComposing) return;
      const ch = cell.value.slice(-1);
      cell.value = ch;
      syncFilled(cell);
      if (ch && i < cells.length - 1) cells[i + 1].focus();
    });
    cell.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' && !cell.value && i > 0) {
        ev.preventDefault();
        cells[i - 1].focus();
      }
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
        syncFilled(target);
      }
      cells[Math.min(i + text.length, cells.length - 1)].focus();
    });
  });

  /* 集成事件：所有 cell 都填满时派发 complete，便于使用方接业务 */
  const fireComplete = (): void => {
    const code = cells.map((c) => c.value).join('');
    if (code.length === cells.length && cells.every((c) => c.value.length > 0)) {
      emitIcen(group, 'icen:otp-complete', { code });
      /** @deprecated 旧事件名（无 icen: 前缀），仅为兼容保留，请迁移到 icen:otp-complete */
      group.dispatchEvent(new CustomEvent('otp:complete', { detail: { code }, bubbles: true }));
    }
  };
  cells.forEach((cell) => cell.addEventListener('input', fireComplete));
}

/** 为 root 下所有输入类结构初始化（root 自身匹配也算）。幂等。 */
export function initInput(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;

  const wraps: Element[] = [];
  if (scope instanceof Element && scope.matches('.input-wrap')) wraps.push(scope);
  wraps.push(...Array.from(scope.querySelectorAll('.input-wrap')));
  for (const w of wraps) {
    const el = w as MarkedElement;
    if (el.__icenInputInit) continue;
    el.__icenInputInit = true;
    setupClear(w);
    setupPasswordToggle(w);
  }

  // textarea 自适应
  const textareas: HTMLTextAreaElement[] = [];
  if (scope instanceof HTMLTextAreaElement && scope.matches('[data-autosize]')) textareas.push(scope);
  textareas.push(...Array.from(scope.querySelectorAll<HTMLTextAreaElement>('textarea[data-autosize]')));
  for (const ta of textareas) setupAutosize(ta);

  // 字符计数器：所有有 maxlength / data-count 的 input/textarea
  const countedFields: (HTMLInputElement | HTMLTextAreaElement)[] = [];
  if (scope instanceof Element) {
    const fields = Array.from(scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[maxlength], input[data-count], textarea[maxlength], textarea[data-count]',
    ));
    countedFields.push(...fields);
    if (scope instanceof HTMLInputElement || scope instanceof HTMLTextAreaElement) {
      if (scope.hasAttribute('maxlength') || scope.hasAttribute('data-count')) countedFields.push(scope);
    }
  }
  for (const f of countedFields) setupCounter(f);

  // 输入掩码：有 data-mask 的 input
  const maskedInputs: HTMLInputElement[] = [];
  if (scope instanceof Element) {
    maskedInputs.push(...Array.from(scope.querySelectorAll<HTMLInputElement>('input[data-mask]')));
    if (scope instanceof HTMLInputElement && scope.hasAttribute('data-mask')) maskedInputs.push(scope);
  }
  for (const inp of maskedInputs) setupMask(inp);

  // 自动 trim
  const trimFields: (HTMLInputElement | HTMLTextAreaElement)[] = [];
  if (scope instanceof Element) {
    trimFields.push(...Array.from(scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-trim]')));
    if ((scope instanceof HTMLInputElement || scope instanceof HTMLTextAreaElement) && scope.hasAttribute('data-trim')) {
      trimFields.push(scope);
    }
  }
  for (const f of trimFields) setupTrim(f);

  // OTP
  const otps: Element[] = [];
  if (scope instanceof Element && scope.matches('.otp')) otps.push(scope);
  otps.push(...Array.from(scope.querySelectorAll('.otp')));
  for (const g of otps) setupOtp(g);
}
