/*
 * @icen.ai/ui — Behavior: form-validate（表单校验层：原生约束优先的零依赖校验）
 * 与 components/form-validate.css 配套。
 *
 * 核心哲学：HTML5 原生约束属性（required / type / minlength / maxlength / pattern /
 * min / max / step）就是 schema——零新词汇；data-icen-validate 只承载额外规则（空格分隔）：
 *   matches:<字段名>      跨字段相等（如确认密码）
 *   <具名>[:<参数>]       registerValidator(name, fn) 注册的自定义校验（fn 可异步）
 * 自定义消息：data-icen-msg-<rule>="..."（如 data-icen-msg-required="必填"）；
 * i18n 全局消息表：setValidateMessages({ required, email, min, ... })。
 *
 * DOM 契约：
 *   <form data-icen-validate [data-icen-validate-summary] [data-icen-validate-show-valid]>
 *     字段 = form 内有 name 的 input / textarea / select（disabled / 无 name / 提交类不参与）。
 *     initFormValidate() 自动给 form[data-icen-validate] 挂 novalidate（原生气泡让位呈现层）。
 *     错误呈现：最近的 .icen-field / .icen-form-field 包装器挂 .is-error + data-icen-invalid="true"，
 *       自动创建 <p class="icen-field-error" role="alert">（id 自动生成，控件 aria-describedby 接线），
 *       控件同步 aria-invalid="true"；通过后摘除（自动创建的）错误元素并挂 .is-valid
 *       （仅 form 或字段带 data-icen-validate-show-valid 时）；异步校验期间包装器 .is-validating
 *       + 控件 aria-busy="true"，竞态守卫：最新一次校验结果为准，旧结果丢弃。
 *     提交失败：data-icen-validate-summary → 表单顶部渲染 .icen-form-validate-summary 错误清单
 *       （锚点聚焦字段）+ focus 第一个错误字段（scrollIntoView 可选，opts.scrollToError）。
 *   </form>
 *
 * UX 策略（默认 submit 优先）：首次提交全量校验（submit 事件由校验层接管 preventDefault）；
 *   之后出错字段 input 即时复验（160ms 防抖，strategy.debounceMs 可调），未触碰字段 blur 时校验；
 *   strategy.on: 'submit' = 只提交时校验（无 live 复验）；'blur' = 字段 blur 即校验；
 *   'input' = 输入即校验（防抖）。IME 组合态（compositionstart/end）期间不触发校验。
 * 指针按下期布局守卫：form 内 pointerdown → 字段 blur 复验若立刻落 DOM（summary 插入/移除/重写、
 *   字段错误元素创建/摘除/hidden 翻转）会把提交按钮在 mousedown 与 mouseup 之间顶位移，
 *   click 落空。按下期间只写不位移的内容（wrap 类/aria/既有可见错误元素文本），结构变更
 *   推迟到 pointerup/pointercancel 后下一帧（click 派发之后）统一补齐；校验事件不推迟。
 *
 * API：
 *   initFormValidate(root?)                document 委托 + 幂等 + 返回销毁函数（SSR 下 no-op）
 *   createFormValidator(form, opts?)       → { validate, validateField, reset, errors, destroy }
 *                                          （同一 form 只会有一个 handle，重复创建幂等返回既有实例）
 *   registerValidator(name, fn)            具名自定义校验注册（fn: (value, field, form) => true | string | Promise）
 *   unregisterValidator(name)              下架
 *   setValidateMessages(messages)          i18n 全局消息表（占位符 {min} {max} {step} {length} {label}）
 *
 * 事件（bubbles + composed + cancelable，detail 契约见 events.ts IcenEventMap）：
 *   每字段校验完 → icen:form-field-validate { name, valid, message? }
 *   整表通过     → icen:form-valid   { names }（通过字段名数组）
 *   整表未过     → icen:form-invalid { errors, first }（first = 第一个错误字段名，无则 null）
 *
 * AI 工具 show_form：向用户渲染一个结构化表单收集输入，present: 'mount'，
 *   run 返回 Promise：用户提交（过校验）→ resolve 表单值对象；
 *   用户点「取消」→ resolve { cancelled: true }。渲染契约（.icen-ai-form*）见
 *   form-validate.css 头注释。分层纪律（docs/versioning.md）：Core 模块
 *   不得运行时依赖 Beta——本模块只导出 runShowForm / SHOW_FORM_SCHEMA，
 *   注册动作在 ai-tools.ts（Beta → Core 方向）完成，import 本模块不再有注册副作用。
 *
 * SSR 安全；渲染只写 textContent（绝不 innerHTML）；事件统一走 emitIcen。
 */

import { emitIcen } from './events';
import { t } from './i18n';

/* ════════════ 类型 ════════════ */

/** 可校验字段元素。 */
export type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** 一条校验规则（rule 名 = 消息 key）。 */
export interface FieldRule {
  /** required / email / url / number / minlength / maxlength / pattern / min / max / icen-step / matches / <custom> */
  rule: string;
  /** matches 的目标字段名、自定义规则的参数（data-icen-validate="matches:pwd unique:username"） */
  arg?: string;
  /** 原生属性原文（min/max/step/minlength/maxlength/pattern），消息占位符用 */
  attr?: string;
}

/** 自定义校验函数：通过返回 true；失败返回错误消息字符串（可异步）。 */
export type CustomValidatorFn = (
  value: string,
  field: FieldElement,
  form: HTMLFormElement | null,
) => true | string | Promise<true | string>;

export interface FormValidateStrategy {
  /** 'submit' = 仅提交时校验（默认策略：提交后出错字段 input 复验 + 未触碰字段 blur 补验） */
  on?: 'submit' | 'blur' | 'input';
  /** input 复验防抖（默认 160ms） */
  debounceMs?: number;
}

export interface FormValidateOptions {
  strategy?: FormValidateStrategy;
  /** 提交失败时聚焦第一个错误字段并 scrollIntoView（默认 true） */
  scrollToError?: boolean;
}

export interface FormValidator {
  readonly form: HTMLFormElement;
  /** 全量校验（提交语义）：更新呈现 + 汇总 + 派 icen:form-valid / icen:form-invalid */
  validate(): Promise<boolean>;
  /** 单字段校验：更新呈现并派 icen:form-field-validate */
  validateField(name: string): Promise<boolean>;
  /** 复位校验状态与呈现（不动表单值） */
  reset(): void;
  /** 当前错误表（字段名 → 消息） */
  errors(): Record<string, string>;
  /** 摘除监听与计时器、清呈现（handle 失效） */
  destroy(): void;
}

/* ════════════ i18n 消息表 ════════════ */

const DEFAULT_MESSAGES: Record<string, string> = {
  required: t('formValidate.required'),
  email: t('formValidate.email'),
  url: t('formValidate.url'),
  number: t('formValidate.number'),
  minlength: t('formValidate.minlength'),
  maxlength: t('formValidate.maxlength'),
  pattern: t('formValidate.pattern'),
  min: t('formValidate.min'),
  max: t('formValidate.max'),
  step: t('formValidate.step'),
  matches: t('formValidate.matches'),
};

/** 全局消息表（默认值见 DEFAULT_MESSAGES；setValidateMessages 覆盖）。 */
const messageTable: Record<string, string> = { ...DEFAULT_MESSAGES };

/** i18n 全局消息表：setValidateMessages({ required: '必填', email: '…' })；传空串删回默认。 */
export function setValidateMessages(messages: Record<string, string | undefined>): void {
  for (const key of Object.keys(messages)) {
    const value = messages[key];
    if (typeof value === 'string' && value) messageTable[key] = value;
    else if (value === '' || value === undefined) {
      if (key in DEFAULT_MESSAGES) messageTable[key] = DEFAULT_MESSAGES[key]!;
      else delete messageTable[key];
    }
  }
}

/** 占位符替换：{min} {max} {step} {length} {label} 等。 */
function formatMessage(template: string, tokens: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in tokens ? String(tokens[key]) : m));
}

/* ════════════ 自定义校验注册表 ════════════ */

const customValidators = new Map<string, CustomValidatorFn>();

/** 注册具名自定义校验（覆盖同名）；fn 可异步返回 true | string 错误消息。 */
export function registerValidator(name: string, fn: CustomValidatorFn): void {
  if (name && typeof fn === 'function') customValidators.set(name, fn);
}

/** 下架具名自定义校验。 */
export function unregisterValidator(name: string): void {
  customValidators.delete(name);
}

/* ════════════ 规则解析（纯函数，单测直接覆盖）════════════ */

function attrNumber(el: HTMLElement, name: string): number | null {
  const raw = el.getAttribute(name);
  if (raw == null || raw === '' || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}

/**
 * 从字段元素解析规则集（原生约束 → data-icen-validate 额外规则，顺序即优先级）。
 * HTML5 属性即 schema；未注册语义的 data-icen-validate token 进入规则集但校验时放行。
 */
export function resolveFieldRules(field: FieldElement): FieldRule[] {
  const rules: FieldRule[] = [];
  const type = (field.getAttribute('type') ?? '').toLowerCase();

  if (field.hasAttribute('required')) rules.push({ rule: 'required' });
  if (type === 'email' || type === 'url') rules.push({ rule: type });
  if (type === 'number' || type === 'range') rules.push({ rule: 'number' });

  const minlength = attrNumber(field, 'minlength');
  if (minlength != null) rules.push({ rule: 'minlength', attr: String(minlength) });
  const maxlength = attrNumber(field, 'maxlength');
  if (maxlength != null) rules.push({ rule: 'maxlength', attr: String(maxlength) });

  const pattern = field.getAttribute('pattern');
  if (pattern) rules.push({ rule: 'pattern', attr: pattern });

  const min = field.getAttribute('min');
  if (min != null && min !== '') rules.push({ rule: 'min', attr: min });
  const max = field.getAttribute('max');
  if (max != null && max !== '') rules.push({ rule: 'max', attr: max });
  const step = field.getAttribute('step');
  if (step != null && step !== '' && step !== 'any') rules.push({ rule: 'step', attr: step });

  const extra = field.getAttribute('data-icen-validate') ?? '';
  for (const token of extra.trim().split(/\s+/)) {
    if (!token) continue;
    const idx = token.indexOf(':');
    const rule = idx === -1 ? token : token.slice(0, idx);
    const arg = idx === -1 ? undefined : token.slice(idx + 1) || undefined;
    if (!rule || (rule === 'matches' && !arg)) continue;
    rules.push({ rule, arg });
  }
  return rules;
}

/** 字段取值：勾选类取 checked 语义，其余取 value。 */
export function fieldValue(field: FieldElement): string {
  if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
    return field.checked ? field.value || 'on' : '';
  }
  return field.value;
}

/** 字段标签（消息 {label} 占位符 + 错误汇总链接文案）：label 元素 > aria-label > placeholder > name > fallback。 */
export function fieldLabel(field: FieldElement | null | undefined, fallback = ''): string {
  if (!field) return fallback;
  const wrap = field.closest('.icen-field, .icen-form-field');
  const labelEl = wrap?.querySelector('.icen-field-label, .icen-form-label, label');
  const text = labelEl?.textContent?.replace(/\s+/g, ' ').trim();
  return (
    text ||
    field.getAttribute('aria-label') ||
    field.getAttribute('placeholder') ||
    field.getAttribute('name') ||
    fallback
  );
}

function ruleMessage(
  field: FieldElement | undefined,
  rule: string,
  tokens: Record<string, string | number>,
): string {
  const custom = field?.getAttribute(`data-icen-msg-${rule}`);
  const template = custom || messageTable[rule] || DEFAULT_MESSAGES[rule] || t('formValidate.invalid');
  return formatMessage(template, tokens);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_TYPES = new Set(['number', 'range']);

/** min/max 数值比较：number/range 用数值，日期/时间类用 ISO 字符串字典序。 */
function compareValue(field: FieldElement | undefined, value: string, attr: string): number | null {
  const numericAttr = Number.isFinite(Number(attr));
  const type = field?.getAttribute('type')?.toLowerCase() ?? '';
  if (numericAttr && (NUMBER_TYPES.has(type) || Number.isFinite(Number(value)))) {
    if (!Number.isFinite(Number(value))) return null;
    return Number(value) - Number(attr);
  }
  if (!numericAttr) return value < attr ? -1 : value > attr ? 1 : 0;
  return null;
}

async function applyRule(value: string, rule: FieldRule, ctx: { field?: FieldElement; form?: HTMLFormElement | null }): Promise<true | string> {
  const field = ctx.field;
  const tokens: Record<string, string | number> = {
    min: rule.attr ?? '',
    max: rule.attr ?? '',
    step: rule.attr ?? '',
    length: value.length,
    label: fieldLabel(field, rule.arg ?? rule.rule),
  };

  switch (rule.rule) {
    case 'required': {
      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        return field.checked ? true : ruleMessage(field, 'required', tokens);
      }
      if (field instanceof HTMLInputElement && field.type === 'radio') {
        const form = ctx.form ?? field.form;
        const checked = form
          ? Array.from(form.elements).some(
              (el) => el instanceof HTMLInputElement && el.type === 'radio' && el.name === field.name && el.checked,
            )
          : field.checked;
        return checked ? true : ruleMessage(field, 'required', tokens);
      }
      return value.trim() !== '' ? true : ruleMessage(field, 'required', tokens);
    }
    case 'email':
      return value === '' || EMAIL_RE.test(value) ? true : ruleMessage(field, 'email', tokens);
    case 'url': {
      if (value === '') return true;
      try {
        new URL(value);
        return true;
      } catch {
        return ruleMessage(field, 'url', tokens);
      }
    }
    case 'number':
      return value === '' || Number.isFinite(Number(value)) ? true : ruleMessage(field, 'number', tokens);
    case 'minlength': {
      if (value === '') return true; /* minlength 不隐含 required */
      const min = Number(rule.attr);
      return value.length >= min ? true : ruleMessage(field, 'minlength', tokens);
    }
    case 'maxlength': {
      if (value === '') return true;
      const max = Number(rule.attr);
      return value.length <= max ? true : ruleMessage(field, 'maxlength', tokens);
    }
    case 'pattern': {
      if (value === '') return true;
      try {
        /* HTML5 pattern 语义 = 整串匹配（隐含 ^(?:…)$） */
        return new RegExp(`^(?:${rule.attr})$`).test(value) ? true : ruleMessage(field, 'pattern', tokens);
      } catch {
        return true; /* 非法正则无法求值：放行，不猜 */
      }
    }
    case 'min': {
      if (value === '') return true;
      const cmp = compareValue(field, value, rule.attr ?? '');
      return cmp == null || cmp >= 0 ? true : ruleMessage(field, 'min', tokens);
    }
    case 'max': {
      if (value === '') return true;
      const cmp = compareValue(field, value, rule.attr ?? '');
      return cmp == null || cmp <= 0 ? true : ruleMessage(field, 'max', tokens);
    }
    case 'step': {
      if (value === '') return true;
      const step = Number(rule.attr);
      if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(Number(value))) return true;
      /* step base：min 属性优先，缺省 0（数值控件口径） */
      const minAttr = field?.getAttribute('min');
      const base = minAttr != null && minAttr !== '' && Number.isFinite(Number(minAttr)) ? Number(minAttr) : 0;
      const rem = Math.abs((Number(value) - base) % step);
      return rem < 1e-9 || step - rem < 1e-9 ? true : ruleMessage(field, 'step', tokens);
    }
    case 'matches': {
      const form = ctx.form ?? field?.form ?? null;
      const other = form && rule.arg ? form.elements.namedItem(rule.arg) : null;
      const otherEl = other instanceof Element ? (other as FieldElement) : null;
      if (!otherEl) return true;
      return value === otherEl.value ? true : ruleMessage(field, 'matches', tokens);
    }
    default: {
      /* 具名自定义校验（未注册 = 放行，不阻塞） */
      const fn = customValidators.get(rule.rule);
      if (!fn || !field) return true;
      const result = await fn(value, field, ctx.form ?? field.form ?? null);
      return result === true ? true : typeof result === 'string' ? result : true;
    }
  }
}

/**
 * 顺序求值规则集，首个失败即返回其消息（原生约束优先于自定义规则）。
 * 空值语义对齐 HTML5：非 required 规则对空值放行（valueMissing 归 required 管）。
 */
export async function evaluateRules(
  value: string,
  rules: FieldRule[],
  ctx: { field?: FieldElement; form?: HTMLFormElement | null } = {},
): Promise<true | string> {
  for (const rule of rules) {
    const fail = await applyRule(value, rule, ctx);
    if (fail !== true) return fail;
  }
  return true;
}

/* ════════════ DOM 呈现与状态 ════════════ */

const DEFAULT_DEBOUNCE = 160;
let uidSeq = 0;

/** 每表单 handle 的运行态。 */
interface FormState {
  errors: Map<string, string>;
  touched: Set<string>;
  submitted: boolean;
  /** 字段级竞态守卫：最新一次校验序号为准 */
  seq: Map<string, number>;
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
}

/** 同 form 单例：createFormValidate 幂等 + initFormValidate 与显式创建共享状态。 */
const liveValidators = new WeakMap<HTMLFormElement, FormValidator>();

/** IME 组合态：元素级事实，模块级 WeakMap 共享（同 input.ts 本地跟踪口径）。 */
const composingFlags = new WeakMap<Element, boolean>();
const compositionTracked = new WeakSet<Element>();

function trackComposition(el: Element): void {
  if (compositionTracked.has(el)) return;
  compositionTracked.add(el);
  el.addEventListener('compositionstart', () => composingFlags.set(el, true));
  el.addEventListener('compositionend', () => composingFlags.set(el, false));
}

function isComposing(el: Element): boolean {
  return composingFlags.get(el) === true;
}

/** 收集参与校验的字段：有 name、非 disabled、非提交类/文件类的 input/textarea/select。 */
export function collectFormFields(form: HTMLFormElement): FieldElement[] {
  const out: FieldElement[] = [];
  for (const el of Array.from(form.elements)) {
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLTextAreaElement) &&
      !(el instanceof HTMLSelectElement)
    ) {
      continue;
    }
    if (el.disabled || !el.name) continue;
    if (el instanceof HTMLInputElement) {
      const type = (el.getAttribute('type') ?? '').toLowerCase();
      if (['submit', 'button', 'reset', 'image', 'file'].includes(type)) continue;
    }
    out.push(el);
  }
  return out;
}

function findFormField(form: HTMLFormElement, name: string): FieldElement | null {
  const item = form.elements.namedItem(name);
  if (
    item instanceof Element &&
    (item instanceof HTMLInputElement || item instanceof HTMLTextAreaElement || item instanceof HTMLSelectElement)
  ) {
    return item;
  }
  if (item instanceof RadioNodeList) {
    for (const el of Array.from(item as ArrayLike<Element>)) {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        return el;
      }
    }
  }
  return null;
}

function fieldWrap(field: FieldElement): HTMLElement | null {
  return closestSelfOrAncestor(field, '.icen-field, .icen-form-field') as HTMLElement | null;
}

/**
 * closest 含自身：先 matches 自判再走上层——happy-dom 部分版本的 closest 不含自身，
 * 而 input 事件目标常即控件本身，不能依赖裸 closest 的自匹配。
 */
function closestSelfOrAncestor(el: Element, selector: string): Element | null {
  return el.matches(selector) ? el : el.closest(selector);
}

function ensureControlId(field: FieldElement): string {
  if (!field.id) field.id = `icen-fv-${++uidSeq}`;
  return field.id;
}

/** 直属于本包装器的错误元素（不穿透嵌套字段）。 */
function findErrorEl(wrap: HTMLElement): HTMLElement | null {
  for (const el of Array.from(wrap.children)) {
    if (el instanceof HTMLElement && el.classList.contains('icen-field-error')) return el;
  }
  return null;
}

function setValidating(field: FieldElement, on: boolean): void {
  const wrap = fieldWrap(field);
  if (wrap) wrap.classList.toggle('is-validating', on);
  if (on) field.setAttribute('aria-busy', 'true');
  else field.removeAttribute('aria-busy');
}

interface FieldOutcome {
  ok: boolean;
  message?: string;
}

function presentField(field: FieldElement, outcome: FieldOutcome, showValid: boolean): void {
  const wrap = fieldWrap(field);
  setValidating(field, false);

  if (!wrap) {
    /* 无包装器：控件 aria 仍同步，错误消息无处挂载 */
    if (!outcome.ok) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    return;
  }

  if (!outcome.ok) {
    wrap.classList.add('is-error');
    wrap.setAttribute('data-icen-invalid', 'true');
    wrap.classList.remove('is-valid');
    wrap.removeAttribute('data-icen-valid');
    let errEl = findErrorEl(wrap);
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'icen-field-error';
      errEl.id = `icen-fv-err-${++uidSeq}`;
      errEl.setAttribute('role', 'alert');
      errEl.setAttribute('data-icen-fv-auto', '');
      wrap.appendChild(errEl);
    }
    errEl.hidden = false;
    errEl.textContent = outcome.message ?? '';
    field.setAttribute('aria-invalid', 'true');
    const described = new Set((field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    described.add(errEl.id);
    field.setAttribute('aria-describedby', Array.from(described).join(' '));
    return;
  }

  wrap.classList.remove('is-error');
  wrap.removeAttribute('data-icen-invalid');
  field.removeAttribute('aria-invalid');
  const errEl = findErrorEl(wrap);
  if (errEl) {
    const rest = (field.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .filter((id) => id !== errEl.id);
    if (rest.length) field.setAttribute('aria-describedby', rest.join(' '));
    else field.removeAttribute('aria-describedby');
    if (errEl.hasAttribute('data-icen-fv-auto')) errEl.remove();
    else {
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }
  if (showValid) {
    wrap.classList.add('is-valid');
    wrap.setAttribute('data-icen-valid', 'true');
  } else {
    wrap.classList.remove('is-valid');
    wrap.removeAttribute('data-icen-valid');
  }
}

function clearFieldPresentation(field: FieldElement): void {
  const wrap = fieldWrap(field);
  if (wrap) {
    wrap.classList.remove('is-error', 'is-valid', 'is-validating');
    wrap.removeAttribute('data-icen-invalid');
    wrap.removeAttribute('data-icen-valid');
    const errEl = findErrorEl(wrap);
    if (errEl?.hasAttribute('data-icen-fv-auto')) errEl.remove();
    else if (errEl) {
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }
  field.removeAttribute('aria-invalid');
  field.removeAttribute('aria-busy');
  const rest = (field.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((id) => !id.startsWith('icen-fv-err-'));
  if (rest.length) field.setAttribute('aria-describedby', rest.join(' '));
  else field.removeAttribute('aria-describedby');
}

function focusField(field: FieldElement): void {
  try {
    field.focus();
  } catch {
    /* 测试/无焦点实现环境静默 */
  }
  if (typeof field.scrollIntoView === 'function') {
    try {
      const reduced =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      field.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    } catch {
      try {
        field.scrollIntoView();
      } catch {
        /* noop */
      }
    }
  }
}

/* ════════════ 错误汇总 ════════════ */

function renderSummary(form: HTMLFormElement, errorsObj: Record<string, string>): void {
  if (!form.hasAttribute('data-icen-validate-summary')) return;
  const names = Object.keys(errorsObj);
  const existing = form.querySelector<HTMLElement>(':scope > .icen-form-validate-summary');
  if (names.length === 0) {
    existing?.remove();
    return;
  }
  let box = existing;
  if (!box) {
    box = document.createElement('div');
    box.className = 'icen-form-validate-summary';
    box.setAttribute('role', 'alert');
    box.setAttribute('data-icen-fv-auto', '');
    box.addEventListener('click', (e) => {
      const a = e.target instanceof Element ? closestSelfOrAncestor(e.target, 'a[data-icen-fv-name]') : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      e.preventDefault();
      const field = findFormField(form, a.getAttribute('data-icen-fv-name') ?? '');
      if (field) focusField(field);
    });
    form.prepend(box);
  }
  box.textContent = '';
  const title = document.createElement('p');
  title.className = 'icen-form-validate-summary-title';
  title.textContent = t('formValidate.summary', { p0: names.length });
  const list = document.createElement('ul');
  list.className = 'icen-form-validate-summary-list';
  for (const name of names) {
    const field = findFormField(form, name);
    if (!field) continue;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'icen-form-validate-summary-item';
    a.href = `#${ensureControlId(field)}`;
    a.setAttribute('data-icen-fv-name', name);
    a.textContent = `${fieldLabel(field, name)}：${errorsObj[name]}`;
    li.appendChild(a);
    list.appendChild(li);
  }
  box.append(title, list);
}

/* ════════════ createFormValidator ════════════ */

/**
 * 为单个表单创建校验 handle（同一 form 单例：重复创建幂等返回既有实例，
 * strategy 以首次创建为准）。提交事件由校验层接管（preventDefault），
 * 通过/未过分别派 icen:form-valid / icen:form-invalid，消费方走事件或 await validate()。
 * SSR 下返回 no-op handle。
 */
export function createFormValidator(form: HTMLFormElement, opts: FormValidateOptions = {}): FormValidator {
  if (typeof document === 'undefined') {
    const stub = (): void => undefined;
    return {
      form,
      validate: async () => true,
      validateField: async () => true,
      reset: stub,
      errors: () => ({}),
      destroy: stub,
    };
  }
  const existing = liveValidators.get(form);
  if (existing) return existing;

  const state: FormState = {
    errors: new Map(),
    touched: new Set(),
    submitted: false,
    seq: new Map(),
    debounceTimers: new Map(),
  };

  /* 指针按下期的布局位移守卫（实锤场景：mousedown 在提交钮 → 输入框 blur 触发防抖复验 →
     summary 或字段错误元素的插入/摘除/重写把按钮顶位移约一行高，mouseup 落空、click 丢失）。
     纪律：按下期间只写不造成位移的内容（wrap 类 / aria / 既有可见错误元素的文本），
     结构性变更（summary 插入/移除/重写、错误元素创建/摘除/hidden 翻转、aria-describedby
     接线）入队，pointerup/pointercancel 后下一帧（click 已派发完）统一补齐。
     校验事件（icen:form-field-validate 等）照常即时派发——事件契约不变。 */
  let pointerDown = false;
  const pendingPresent = new Map<FieldElement, { outcome: FieldOutcome; showValid: boolean }>();
  let pendingSummary: Record<string, string> | null = null;
  let flushScheduled = false;

  const showValidFor = (field: FieldElement): boolean =>
    field.hasAttribute('data-icen-validate-show-valid') ||
    form.hasAttribute('data-icen-validate-show-valid');

  async function checkField(field: FieldElement): Promise<boolean> {
    const name = field.name;
    const rules = resolveFieldRules(field);
    if (rules.length === 0) return true;
    trackComposition(field);

    const seq = (state.seq.get(name) ?? 0) + 1;
    state.seq.set(name, seq);
    const hasAsync = rules.some((r) => customValidators.has(r.rule));
    if (hasAsync) setValidating(field, true);

    const result = await evaluateRules(fieldValue(field), rules, { field, form });

    /* 竞态守卫：期间又发起一次校验 → 丢弃旧结果 */
    if (state.seq.get(name) !== seq) {
      if (hasAsync) setValidating(field, false);
      return !state.errors.has(name);
    }
    if (hasAsync) setValidating(field, false);

    const outcome: FieldOutcome = result === true ? { ok: true } : { ok: false, message: result };
    if (outcome.ok) state.errors.delete(name);
    else state.errors.set(name, outcome.message ?? '');
    presentFieldGuarded(field, outcome, showValidFor(field));
    /* 错误汇总随单字段复验联动刷新（存在才刷；创建/摘除归 validate() 管） */
    if (form.querySelector(':scope > .icen-form-validate-summary')) {
      renderSummaryGuarded(errors());
    }
    emitIcen(
      field,
      'icen:form-field-validate',
      outcome.ok ? { name, valid: true } : { name, valid: false, message: outcome.message },
    );
    return outcome.ok;
  }

  function debouncedCheck(field: FieldElement): void {
    const name = field.name;
    const timer = state.debounceTimers.get(name);
    if (timer) clearTimeout(timer);
    const delay = opts.strategy?.debounceMs ?? DEFAULT_DEBOUNCE;
    state.debounceTimers.set(
      name,
      setTimeout(() => {
        state.debounceTimers.delete(name);
        void checkField(field);
      }, delay),
    );
  }

  /** 按下期间的非位移呈现：类/aria 即刻同步；结构变更入队，归 flush 的完整 presentField 补齐。 */
  function presentFieldPressed(field: FieldElement, outcome: FieldOutcome, showValid: boolean): void {
    pendingPresent.set(field, { outcome, showValid });
    const wrap = fieldWrap(field);
    setValidating(field, false);
    if (!wrap) {
      /* 无包装器：控件 aria 仍同步 */
      if (!outcome.ok) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
      return;
    }
    if (!outcome.ok) {
      wrap.classList.add('is-error');
      wrap.setAttribute('data-icen-invalid', 'true');
      wrap.classList.remove('is-valid');
      wrap.removeAttribute('data-icen-valid');
      field.setAttribute('aria-invalid', 'true');
      /* 已有可见错误元素：原位改文本不位移；元素缺失 / hidden 翻转 / describedby 接线归 flush */
      const errEl = findErrorEl(wrap);
      if (errEl && !errEl.hidden) errEl.textContent = outcome.message ?? '';
      return;
    }
    wrap.classList.remove('is-error');
    wrap.removeAttribute('data-icen-invalid');
    field.removeAttribute('aria-invalid');
    /* 错误元素摘除 / hidden 翻转归 flush；is-valid 类先行同步 */
    if (showValid) {
      wrap.classList.add('is-valid');
      wrap.setAttribute('data-icen-valid', 'true');
    } else {
      wrap.classList.remove('is-valid');
      wrap.removeAttribute('data-icen-valid');
    }
  }

  function presentFieldGuarded(field: FieldElement, outcome: FieldOutcome, showValid: boolean): void {
    if (pointerDown) presentFieldPressed(field, outcome, showValid);
    else presentField(field, outcome, showValid);
  }

  function renderSummaryGuarded(errorsObj: Record<string, string>): void {
    if (pointerDown) pendingSummary = errorsObj;
    else renderSummary(form, errorsObj);
  }

  /** pointerup 后下一帧（click 派发之后）统一落盘推迟的结构变更。 */
  function flushDeferredPresentation(): void {
    flushScheduled = false;
    if (destroyed) return;
    const items = Array.from(pendingPresent.entries());
    pendingPresent.clear();
    const summary = pendingSummary;
    pendingSummary = null;
    for (const [field, it] of items) presentField(field, it.outcome, it.showValid);
    if (summary) renderSummary(form, summary);
  }

  function scheduleFlush(): void {
    if (flushScheduled) return;
    flushScheduled = true;
    /* rAF 回调在 click 派发后、下一次绘制前运行；无 rAF 的环境退化为宏任务 */
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flushDeferredPresentation);
    else setTimeout(flushDeferredPresentation, 0);
  }

  function resolveEventField(target: EventTarget | null): FieldElement | null {
    if (!(target instanceof Element)) return null;
    const el = closestSelfOrAncestor(target, 'input, textarea, select');
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLTextAreaElement) &&
      !(el instanceof HTMLSelectElement)
    ) {
      return null;
    }
    if (el.form !== form || el.disabled || !el.name) return null;
    if (el instanceof HTMLInputElement) {
      const type = (el.getAttribute('type') ?? '').toLowerCase();
      if (['submit', 'button', 'reset', 'image', 'file'].includes(type)) return null;
    }
    return el;
  }

  const onSubmit = (e: Event): void => {
    e.preventDefault();
    void validate();
  };
  const onFocusOut = (e: FocusEvent): void => {
    const field = resolveEventField(e.target);
    if (!field) return;
    state.touched.add(field.name);
    const mode = opts.strategy?.on;
    if (mode === 'blur') void checkField(field);
    else if (!mode && state.submitted) void checkField(field);
  };
  const onInput = (e: Event): void => {
    const field = resolveEventField(e.target);
    if (!field) return;
    trackComposition(field);
    if (isComposing(field)) return; /* IME 组合态挂起，compositionend 后的 input 再补 */
    state.touched.add(field.name);
    const mode = opts.strategy?.on;
    if (mode === 'input') debouncedCheck(field);
    else if (!mode && state.submitted && state.errors.has(field.name)) debouncedCheck(field);
  };

  async function validate(): Promise<boolean> {
    state.submitted = true;
    const fields = collectFormFields(form);
    const names: string[] = [];
    let firstInvalid: FieldElement | null = null;
    for (const field of fields) {
      if (resolveFieldRules(field).length === 0) continue;
      names.push(field.name);
      const ok = await checkField(field);
      if (!ok && !firstInvalid) firstInvalid = field;
    }
    const errorsSnapshot = errors();
    if (firstInvalid) {
      renderSummaryGuarded(errorsSnapshot);
      emitIcen(form, 'icen:form-invalid', { errors: errorsSnapshot, first: firstInvalid.name });
      if (opts.scrollToError !== false) focusField(firstInvalid);
      return false;
    }
    renderSummaryGuarded({});
    emitIcen(form, 'icen:form-valid', { names });
    return true;
  }

  function errors(): Record<string, string> {
    return Object.fromEntries(state.errors);
  }

  function reset(): void {
    state.errors.clear();
    state.touched.clear();
    state.submitted = false;
    state.seq.clear();
    for (const timer of state.debounceTimers.values()) clearTimeout(timer);
    state.debounceTimers.clear();
    /* 推迟队列一并清掉：已调度的 flush 遇到空队列自然 no-op */
    pendingPresent.clear();
    pendingSummary = null;
    for (const field of collectFormFields(form)) clearFieldPresentation(field);
    form.querySelector(':scope > .icen-form-validate-summary')?.remove();
  }

  /* 按下只守主键/触摸（右键不触发 blur 复验链）；happy-dom 等环境派 plain Event（无 button）按主键处理 */
  const onFormPointerDown = (e: Event): void => {
    const btn = (e as PointerEvent).button;
    if (typeof btn === 'number' && btn !== 0) return;
    pointerDown = true;
  };
  /* pointerup/pointercancel 在 document 捕获阶段收（抬手落点可能在 form 外）；
     window blur 兜底：按下期间切窗导致 pointerup 丢失时不至于永久挂起 */
  const onPressEnd = (): void => {
    if (!pointerDown) return;
    pointerDown = false;
    if (pendingPresent.size > 0 || pendingSummary !== null) scheduleFlush();
  };

  form.addEventListener('submit', onSubmit);
  form.addEventListener('focusout', onFocusOut);
  form.addEventListener('input', onInput);
  form.addEventListener('pointerdown', onFormPointerDown, true);
  document.addEventListener('pointerup', onPressEnd, true);
  document.addEventListener('pointercancel', onPressEnd, true);
  window.addEventListener('blur', onPressEnd);

  let destroyed = false;
  const handle: FormValidator = {
    form,
    validate,
    async validateField(name: string): Promise<boolean> {
      const field = findFormField(form, name);
      if (!field || field.disabled) return true;
      return checkField(field);
    },
    reset,
    errors,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      form.removeEventListener('submit', onSubmit);
      form.removeEventListener('focusout', onFocusOut);
      form.removeEventListener('input', onInput);
      form.removeEventListener('pointerdown', onFormPointerDown, true);
      document.removeEventListener('pointerup', onPressEnd, true);
      document.removeEventListener('pointercancel', onPressEnd, true);
      window.removeEventListener('blur', onPressEnd);
      reset();
      liveValidators.delete(form);
    },
  };
  liveValidators.set(form, handle);
  return handle;
}

/* ════════════ initFormValidate（document 委托 + 幂等 + 销毁）════════════ */

function ensureNovalidate(form: HTMLFormElement): void {
  form.setAttribute('novalidate', '');
}

/* 委托路径自建的 form → handle 登记：销毁只回收自己建的句柄，
   不误杀宿主 createFormValidator 直建的（误杀后 novalidate 仍挂着、监听已摘，
   宿主表单会无校验裸提交） */
const delegatedHandles = new WeakMap<HTMLFormElement, FormValidator>();

function ensureFormHandle(form: HTMLFormElement): void {
  if (!liveValidators.has(form)) {
    const handle = createFormValidator(form);
    delegatedHandles.set(form, handle);
  }
}

function scopedValidateForms(scope: ParentNode): HTMLFormElement[] {
  const forms: HTMLFormElement[] = [];
  /* scope 自身即目标表单也算（不走 closest：happy-dom 部分版本 closest 不含自身） */
  if (scope instanceof HTMLFormElement && scope.hasAttribute('data-icen-validate')) {
    forms.push(scope);
  }
  forms.push(
    ...Array.from(scope.querySelectorAll('form[data-icen-validate]')).filter(
      (el): el is HTMLFormElement => el instanceof HTMLFormElement,
    ),
  );
  return forms;
}

let formValidateInited = false;

/**
 * 接线表单校验（document 级委托，页面级一次即可，重复调用幂等）。
 * 现有与后续插入的 form[data-icen-validate] 自动补 novalidate 并挂 handle
 * （submit 捕获阶段 ensure，冒泡阶段 handle 的 submit 监听接管校验）。
 * 返回销毁函数：摘除委托、销毁 scope 内由委托路径建立的 handle 并复位幂等标记，
 * 销毁后可重新 initFormValidate。SSR 下返回 no-op。
 */
export function initFormValidate(root?: ParentNode): () => void {
  if (formValidateInited || typeof document === 'undefined') return () => {};
  formValidateInited = true;
  const scope: ParentNode = root ?? document;

  for (const form of scopedValidateForms(scope)) {
    ensureNovalidate(form);
    ensureFormHandle(form);
  }

  const onSubmitCapture = (e: Event): void => {
    const target = e.target;
    const formEl = target instanceof Element ? closestSelfOrAncestor(target, 'form[data-icen-validate]') : null;
    if (!(formEl instanceof HTMLFormElement)) return;
    ensureNovalidate(formEl);
    ensureFormHandle(formEl);
  };
  scope.addEventListener('submit', onSubmitCapture, true);

  return () => {
    scope.removeEventListener('submit', onSubmitCapture, true);
    /* 摘除委托并销毁 scope 内由 ensure 路径建立、且仍是同一个的 handle（同 initTabs 销毁口径） */
    for (const form of scopedValidateForms(scope)) {
      const own = delegatedHandles.get(form);
      if (own && liveValidators.get(form) === own) own.destroy();
    }
    formValidateInited = false;
  };
}

/* ════════════ AI 工具：show_form ════════════ */

/** show_form 字段规格（inputSchema 的运行时形态）。 */
export interface ShowFormFieldSpec {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'url' | 'textarea' | 'select' | 'date';
  required?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  options?: Array<string | { label: string; value: string }>;
  help?: string;
}

export interface ShowFormSpec {
  title?: string;
  fields: ShowFormFieldSpec[];
  submitLabel?: string;
}

export type ShowFormResult = Record<string, unknown> | { cancelled: true };

/** show_form 的 inputSchema（注册在 ai-tools.ts，见文件尾内置工具段）。 */
export const SHOW_FORM_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: { type: 'string', description: t('formValidate.tool.title') },
    fields: {
      type: 'array',
      description: t('formValidate.tool.fields'),
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: t('formValidate.tool.name') },
          label: { type: 'string', description: t('formValidate.tool.label') },
          type: {
            type: 'string',
            enum: ['text', 'email', 'number', 'url', 'textarea', 'select', 'date'],
            description: t('formValidate.tool.type'),
          },
          required: { type: 'boolean', description: t('formValidate.tool.required') },
          pattern: { type: 'string', description: t('formValidate.tool.pattern') },
          min: { type: 'number', description: t('formValidate.tool.min') },
          max: { type: 'number', description: t('formValidate.tool.max') },
          options: {
            type: 'array',
            description: t('formValidate.tool.options'),
            items: {
              anyOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: { label: { type: 'string' }, value: { type: 'string' } },
                  required: ['label', 'value'],
                },
              ],
            },
          },
          help: { type: 'string', description: t('formValidate.tool.help') },
        },
        required: ['name', 'label'],
      },
    },
    submitLabel: { type: 'string', description: t('formValidate.tool.submitText') },
  },
  required: ['fields'],
};

/** 容错归一：坏输入不抛错（缺 name 的字段丢弃），缺 fields 给空表。 */
function normalizeShowForm(input: unknown): ShowFormSpec {
  const raw = (input ?? {}) as Partial<ShowFormSpec>;
  const fields: ShowFormFieldSpec[] = [];
  if (Array.isArray(raw.fields)) {
    for (const f of raw.fields as Array<Partial<ShowFormFieldSpec>>) {
      if (!f || typeof f !== 'object') continue;
      const name = typeof f.name === 'string' ? f.name.trim() : '';
      if (!name) continue;
      const label = typeof f.label === 'string' && f.label ? f.label : name;
      fields.push({
        name,
        label,
        type: f.type,
        required: f.required === true,
        pattern: typeof f.pattern === 'string' ? f.pattern : undefined,
        min: typeof f.min === 'number' ? f.min : undefined,
        max: typeof f.max === 'number' ? f.max : undefined,
        options: Array.isArray(f.options) ? f.options : undefined,
        help: typeof f.help === 'string' ? f.help : undefined,
      });
    }
  }
  return {
    title: typeof raw.title === 'string' && raw.title ? raw.title : undefined,
    fields,
    submitLabel: typeof raw.submitLabel === 'string' && raw.submitLabel ? raw.submitLabel : undefined,
  };
}

function renderShowFormField(spec: ShowFormFieldSpec): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'icen-field';

  const id = `icen-ai-form-${++uidSeq}`;
  const label = document.createElement('label');
  label.className = 'icen-field-label';
  label.htmlFor = id;
  label.textContent = spec.label;
  if (spec.required) {
    const req = document.createElement('span');
    req.className = 'icen-req';
    req.textContent = '*';
    label.appendChild(req);
  }
  wrap.appendChild(label);

  let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (spec.type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.className = 'icen-form-textarea';
    ta.setAttribute('rows', '3');
    control = ta;
  } else if (spec.type === 'select') {
    const sel = document.createElement('select');
    sel.className = 'icen-form-input';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('formValidate.selectPlaceholder');
    sel.appendChild(placeholder);
    for (const opt of spec.options ?? []) {
      const option = document.createElement('option');
      if (typeof opt === 'string') {
        option.value = opt;
        option.textContent = opt;
      } else {
        option.value = opt.value;
        option.textContent = opt.label;
      }
      sel.appendChild(option);
    }
    control = sel;
  } else {
    const input = document.createElement('input');
    input.className = 'icen-form-input';
    input.type = spec.type ?? 'text';
    control = input;
  }
  control.id = id;
  control.name = spec.name;
  if (spec.required) control.required = true;
  if (spec.pattern) control.setAttribute('pattern', spec.pattern);
  if (spec.min != null) control.setAttribute('min', String(spec.min));
  if (spec.max != null) control.setAttribute('max', String(spec.max));
  wrap.appendChild(control);

  if (spec.help) {
    const hint = document.createElement('span');
    hint.className = 'icen-field-hint';
    hint.textContent = spec.help;
    wrap.appendChild(hint);
  }
  return wrap;
}

function collectFormValues(form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of collectFormFields(form)) {
    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      out[field.name] = field.checked;
      continue;
    }
    if (field instanceof HTMLInputElement && field.type === 'radio') {
      if (!(field.name in out)) out[field.name] = field.checked ? field.value : '';
      else if (field.checked) out[field.name] = field.value;
      continue;
    }
    out[field.name] = field.value;
  }
  return out;
}

/**
 * show_form 渲染：表单进 mount，返回一个 Promise——用户提交（过校验）resolve 表单值对象；
 * 点「取消」resolve { cancelled: true }。表单自带 data-icen-validate + 错误汇总，
 * 取消/提交后渲染体自动摘除（挂载卡本体归 AI 工具挂载区管理）。
 * 由 ai-tools.ts 注册为内置工具 show_form 的 run（本模块不做注册，见文件头分层纪律）。
 */
export function runShowForm(input: unknown, mount: HTMLElement): Promise<ShowFormResult> {
  return new Promise<ShowFormResult>((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ cancelled: true });
      return;
    }
    const spec = normalizeShowForm(input);

    const root = document.createElement('div');
    root.className = 'icen-ai-form';
    if (spec.title) {
      const title = document.createElement('p');
      title.className = 'icen-ai-form-title';
      title.textContent = spec.title;
      root.appendChild(title);
    }

    const form = document.createElement('form');
    form.className = 'icen-form icen-ai-form-fields';
    form.setAttribute('data-icen-validate', '');
    form.setAttribute('data-icen-validate-summary', '');
    form.setAttribute('novalidate', '');
    for (const field of spec.fields) form.appendChild(renderShowFormField(field));

    const actions = document.createElement('div');
    actions.className = 'icen-ai-form-actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'icen-btn icen-btn-primary';
    submit.textContent = spec.submitLabel ?? t('common.submit');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'icen-btn icen-btn-ghost';
    cancel.setAttribute('data-icen-ai-form-cancel', '');
    cancel.textContent = t('common.cancel');
    actions.append(submit, cancel);
    form.appendChild(actions);

    root.appendChild(form);
    mount.appendChild(root);

    const handle = createFormValidator(form, { scrollToError: true });

    const finish = (value: ShowFormResult): void => {
      form.removeEventListener('icen:form-valid', onValid);
      cancel.removeEventListener('click', onCancel);
      handle.destroy();
      root.remove();
      resolve(value);
    };
    const onValid = (): void => {
      finish(collectFormValues(form));
    };
    const onCancel = (): void => {
      finish({ cancelled: true });
    };
    form.addEventListener('icen:form-valid', onValid);
    cancel.addEventListener('click', onCancel);
  });
}

/* show_form 的注册在 ai-tools.ts（内置工具段）——分层纪律：Core 不 import Beta。 */
