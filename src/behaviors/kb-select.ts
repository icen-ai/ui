/*
 * @icen.ai/ui — Behavior: kb-select（kb 族的弹层选择器构建器）
 *
 * kb-* 域模块一律经此构建选择器，不直接写原生 <select>：原生下拉的展开弹层是
 * 操作系统渲染，任何 CSS 都进不去——本库「无原始控件」纪律在 kb 族的落点。
 * 视觉/键盘/portal 弹层全部走 select.css + select.ts 既有契约（icen-select），
 * 域类名挂在容器上只管宽度布局（与 input recipe 同一分工：域 CSS 不碰面样式）。
 *
 * 用法：
 *   const sel = kbSelect({
 *     cls: 'icen-kb-filter-op',            // 域布局类（可选）
 *     options: [{ value: 'eq', label: '等于' }, …],
 *     value: 'eq',                          // 初始值（不在集合内按空处理）
 *     ariaLabel: '运算符',                   // trigger 的 aria-label
 *     sm: true,                             // 28px 密度（icen-select-trigger--sm）
 *     panelMin: 140,                        // 面板最小宽（PanelSizing 契约，可选）
 *     onChange: (v) => { … },               // 选中回调（经 icen:select-change）
 *   });
 *   row.append(sel.el);
 *   sel.getValue(); sel.setValue('ne'); sel.setDisabled(true);
 *
 * 句柄与行为实例同生命周期：initSelect 对断开 DOM 自动 dispose，容器重挂后可重新 init。
 */

import { h } from './kb-core';
import { initSelect, refreshSelect } from './select';

export interface KbSelectOption {
  value: string;
  label: string;
}

export interface KbSelectHandle {
  /** .icen-select 容器（域类名在此元素上） */
  el: HTMLElement;
  getValue(): string;
  /** 静态重置选中（refreshSelect 语义：不派 change、不触发 onChange） */
  setValue(value: string): void;
  setDisabled(disabled: boolean): void;
}

export function kbSelect(cfg: {
  cls?: string;
  options: ReadonlyArray<KbSelectOption>;
  value?: string;
  ariaLabel?: string;
  sm?: boolean;
  panelMin?: number;
  panelWidth?: number;
  onChange?: (value: string) => void;
}): KbSelectHandle {
  if (typeof document === 'undefined') {
    /* SSR 守卫：kb 族的 create/render 系列在无 DOM 环境本就不会触达构建器，此句柄仅满足类型 */
    return { el: null as unknown as HTMLElement, getValue: () => '', setValue: () => undefined, setDisabled: () => undefined };
  }
  const initial = cfg.options.some((o) => o.value === (cfg.value ?? '')) ? (cfg.value as string) : '';
  const labelOf = (v: string): string => cfg.options.find((o) => o.value === v)?.label ?? '';

  const box = h('div', `icen-select${cfg.cls ? ` ${cfg.cls}` : ''}`);
  box.setAttribute('data-icen-select', '');
  /* 面板宽缺省=触发器宽（PanelSizing 契约）——kb 触发器常只显示当前短标签
    （如操作符「等于」45px），选项更长时面板会被夹窄折行，给 96px 下限兜底 */
  box.setAttribute('data-icen-panel-min', String(cfg.panelMin ?? 96));
  if (cfg.panelWidth != null) box.setAttribute('data-icen-panel-width', String(cfg.panelWidth));

  const trigger = h('button', `icen-select-trigger icen-pressable icen-focus-ring${cfg.sm ? ' icen-select-trigger--sm' : ''}`);
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (cfg.ariaLabel) trigger.setAttribute('aria-label', cfg.ariaLabel);
  trigger.appendChild(h('span', `icen-select-value${initial ? '' : ' is-empty'}`, labelOf(initial)));

  const panel = h('div', 'icen-select-panel');
  panel.hidden = true;
  for (const o of cfg.options) {
    const opt = h('button', 'icen-select-option', o.label);
    opt.type = 'button';
    opt.setAttribute('data-icen-value', o.value);
    panel.appendChild(opt);
  }

  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.setAttribute('data-icen-select-value', '');
  hidden.value = initial;

  box.append(trigger, panel, hidden);
  initSelect(box);
  if (cfg.onChange) box.addEventListener('icen:select-change', (ev) => cfg.onChange!((ev as CustomEvent<{ value: string }>).detail.value));

  return {
    el: box,
    getValue: (): string => hidden.value,
    setValue(value: string): void {
      /* refresh() 以选项 .is-selected 类为源回写 label/hidden/data-icen-value，
         所以编程设值先拨类再 refresh（不派 change、不触发 onChange） */
      const v = cfg.options.some((o) => o.value === value) ? value : '';
      for (const opt of Array.from(box.querySelectorAll('.icen-select-option'))) {
        opt.classList.toggle('is-selected', opt.getAttribute('data-icen-value') === v);
      }
      refreshSelect(box);
    },
    setDisabled(disabled: boolean): void {
      trigger.disabled = disabled;
      if (disabled) box.setAttribute('aria-disabled', 'true');
      else box.removeAttribute('aria-disabled');
    },
  };
}
