// form-validate 行为 DOM 测试：initFormValidate 幂等/销毁、错误呈现与 aria 接线、
// 事件契约（icen:form-field-validate / -valid / -invalid）、默认 submit 优先策略
// （提交后出错字段 input 复验 + 防抖）、竞态守卫、IME 组合态挂起、show_form 工具。
// DOM 契约：src/components/form-validate.css 头注释 + behaviors/form-validate.ts。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  createFormValidator,
  initFormValidate,
  registerValidator,
  unregisterValidator,
} from '../../src/behaviors/form-validate';
import { getAiTool } from '../../src/behaviors/ai-tools';
import { onIcen } from '../../src/behaviors/events';
import { fire, mount, nextTick, unmountAll } from '../helpers/dom';

const FORM_HTML = `
  <form data-icen-validate data-icen-validate-summary>
    <div class="icen-field">
      <label class="icen-field-label" for="fv-name">用户名</label>
      <input id="fv-name" class="icen-form-input" name="username" required minlength="3" />
    </div>
    <div class="icen-field">
      <label class="icen-field-label" for="fv-email">邮箱</label>
      <input id="fv-email" class="icen-form-input" name="email" type="email" required />
    </div>
    <div class="icen-field">
      <label class="icen-field-label" for="fv-pwd">密码</label>
      <input id="fv-pwd" class="icen-form-input" name="password" type="password" required />
    </div>
    <div class="icen-field">
      <label class="icen-field-label" for="fv-pwd2">确认密码</label>
      <input id="fv-pwd2" class="icen-form-input" name="confirm" data-icen-validate="matches:password" />
    </div>
    <button type="submit">提交</button>
  </form>
`;

/** 四个字段全部填合法值（confirm 与 password 一致）。 */
function fillAllValid(): void {
  input('username').value = 'icen';
  input('email').value = 'hi@icen.ai';
  input('password').value = 'secret';
  input('confirm').value = 'secret';
}

function form(): HTMLFormElement {
  const el = document.querySelector('form');
  if (!(el instanceof HTMLFormElement)) throw new Error('form 未挂载');
  return el;
}

function input(name: string): HTMLInputElement {
  const el = document.querySelector(`input[name="${name}"]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`input ${name} 未挂载`);
  return el;
}

function fieldWrap(name: string): HTMLElement {
  const wrap = input(name).closest('.icen-field');
  if (!wrap) throw new Error(`字段 ${name} 无包装器`);
  return wrap as HTMLElement;
}

function errorText(name: string): string | null {
  return fieldWrap(name).querySelector('p.icen-field-error')?.textContent ?? null;
}

/** 派发 cancelable 的 submit（行为层 preventDefault 接管）。 */
function fireSubmit(f: HTMLFormElement): Event {
  return fire(f, 'submit', { cancelable: true });
}

/** initFormValidate 建立的委托在用例间需显式销毁（模块级幂等标记 + document 监听）。 */
let initDestroy: (() => void) | null = null;

afterEach(() => {
  if (initDestroy) {
    initDestroy();
    initDestroy = null;
  }
  unmountAll();
  unregisterValidator('taken');
});

describe('initFormValidate', () => {
  test('自动给 form[data-icen-validate] 挂 novalidate；幂等重复调用安全', () => {
    mount(FORM_HTML);
    initDestroy = initFormValidate();
    initFormValidate();
    expect(form().hasAttribute('novalidate')).toBe(true);
  });

  test('委托路径：未显式 createFormValidator，提交也走校验（submit 捕获阶段补挂 handle）', async () => {
    const invalid: Array<{ errors: Record<string, string>; first: string | null }> = [];
    const valid: string[][] = [];
    onIcen('icen:form-invalid', (e) => invalid.push(e.detail));
    onIcen('icen:form-valid', (e) => valid.push(e.detail.names));
    mount(FORM_HTML);
    initDestroy = initFormValidate();
    fireSubmit(form());
    await nextTick();
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.first).toBe('username');
    expect(Object.keys(invalid[0]?.errors ?? {})).toEqual(['username', 'email', 'password']);
    expect(valid).toHaveLength(0);

    /* 销毁：委托与 ensure 建立的 handle 一并移除，提交不再被接管 */
    initDestroy?.();
    initDestroy = null;
    const again: unknown[] = [];
    const off = onIcen('icen:form-invalid', (e) => again.push(e.detail));
    fireSubmit(form());
    await nextTick();
    expect(again).toHaveLength(0);
    off();
  });

  test('销毁后可重新 init', async () => {
    const seen: unknown[] = [];
    onIcen('icen:form-invalid', (e) => seen.push(e.detail));
    mount(FORM_HTML);
    initFormValidate()();
    initDestroy = initFormValidate();
    fireSubmit(form());
    await nextTick();
    expect(seen).toHaveLength(1);
  });
});

describe('createFormValidator：错误呈现与事件契约', () => {
  test('invalid：包装器 .is-error + 自动错误元素（role=alert）+ aria 接线 + 事件 detail', async () => {
    const fieldEvents: Array<{ name: string; valid: boolean; message?: string }> = [];
    onIcen('icen:form-field-validate', (e) => fieldEvents.push(e.detail));
    mount(FORM_HTML);
    const handle = createFormValidator(form(), { scrollToError: false });
    const ev = fireSubmit(form());
    await nextTick();

    expect(ev.defaultPrevented).toBe(true); /* 提交由校验层接管 */
    expect(handle.errors()).toEqual({
      username: '此项为必填项',
      email: '此项为必填项',
      password: '此项为必填项',
    });

    const wrap = fieldWrap('username');
    expect(wrap.classList.contains('is-error')).toBe(true);
    expect(wrap.getAttribute('data-icen-invalid')).toBe('true');
    const errEl = wrap.querySelector('p.icen-field-error');
    expect(errEl).not.toBeNull();
    expect(errEl?.getAttribute('role')).toBe('alert');
    expect(errEl?.textContent).toBe('此项为必填项');
    expect(input('username').getAttribute('aria-invalid')).toBe('true');
    expect(input('username').getAttribute('aria-describedby')).toBe(errEl?.id);
    expect(errEl?.id).toMatch(/^icen-fv-err-/);

    /* 每字段事件（含 valid:false + message） */
    const nameEvent = fieldEvents.find((e) => e.name === 'username');
    expect(nameEvent?.valid).toBe(false);
    expect(nameEvent?.message).toBe('此项为必填项');
    expect(fieldEvents.filter((e) => e.valid === false)).toHaveLength(3);

    /* 错误汇总（data-icen-validate-summary）渲染在表单顶部 */
    const summary = form().querySelector(':scope > .icen-form-validate-summary');
    expect(summary).not.toBeNull();
    expect(summary?.getAttribute('role')).toBe('alert');
    const items = form().querySelectorAll('a.icen-form-validate-summary-item');
    expect(items.length).toBe(3);
    expect(items[0]?.getAttribute('data-icen-fv-name')).toBe('username');
    expect(items[0]?.textContent).toContain('用户名');
  });

  test('valid：icen:form-valid { names }，错误元素摘除，默认不挂 .is-valid', async () => {
    const valid: Array<{ names: string[] }> = [];
    onIcen('icen:form-valid', (e) => valid.push(e.detail));
    mount(FORM_HTML);
    createFormValidator(form(), { scrollToError: false });
    fillAllValid();
    fireSubmit(form());
    await nextTick();

    expect(valid).toHaveLength(1);
    expect(valid[0]?.names).toEqual(['username', 'email', 'password', 'confirm']);
    expect(form().querySelector('.icen-form-validate-summary')).toBeNull();
    expect(fieldWrap('username').classList.contains('is-error')).toBe(false);
    expect(fieldWrap('username').querySelector('p.icen-field-error')).toBeNull();
    expect(input('username').hasAttribute('aria-invalid')).toBe(false);
    expect(input('username').hasAttribute('aria-describedby')).toBe(false);
    expect(fieldWrap('username').classList.contains('is-valid')).toBe(false); /* 未开 show-valid */
  });

  test('data-icen-validate-show-valid：通过后挂 .is-valid', async () => {
    mount(FORM_HTML);
    form().setAttribute('data-icen-validate-show-valid', '');
    createFormValidator(form(), { scrollToError: false });
    fillAllValid();
    fireSubmit(form());
    await nextTick();
    expect(fieldWrap('username').classList.contains('is-valid')).toBe(true);
    expect(fieldWrap('username').getAttribute('data-icen-valid')).toBe('true');
  });

  test('matches 跨字段：不一致报错，改回一致后复验通过', async () => {
    mount(FORM_HTML);
    const handle = createFormValidator(form(), { scrollToError: false });
    fillAllValid();
    input('confirm').value = 'nope';
    fireSubmit(form());
    await nextTick();
    expect(handle.errors().confirm).toBe('两次输入不一致');
    expect(errorText('confirm')).toBe('两次输入不一致');

    input('confirm').value = 'secret';
    const ok = await handle.validateField('confirm');
    expect(ok).toBe(true);
    expect(handle.errors().confirm).toBeUndefined();
    expect(fieldWrap('confirm').classList.contains('is-error')).toBe(false);
    expect(errorText('confirm')).toBeNull();
  });

  test('自定义消息：data-icen-msg-<rule> 覆盖默认文案', async () => {
    mount(FORM_HTML);
    input('username').setAttribute('data-icen-msg-required', '请输入用户名');
    const handle = createFormValidator(form(), { scrollToError: false });
    fireSubmit(form());
    await nextTick();
    expect(handle.errors().username).toBe('请输入用户名');
    expect(errorText('username')).toBe('请输入用户名');
  });
});

describe('默认策略：提交后出错字段 input 复验（防抖）+ 未触碰字段 blur 补验', () => {
  test('出错字段 input 防抖复验；未出错字段不因 input 误验', async () => {
    mount(FORM_HTML);
    createFormValidator(form(), { strategy: { debounceMs: 10 }, scrollToError: false });
    fillAllValid();
    input('email').value = 'bad-email';
    fireSubmit(form());
    await nextTick();
    expect(errorText('email')).toBe('请输入有效的邮箱地址');
    expect(form().querySelectorAll('a.icen-form-validate-summary-item').length).toBe(1);

    /* 仍是坏值：复验保持错误态 */
    input('email').value = 'still-bad';
    fire(input('email'), 'input');
    await nextTick(40);
    expect(errorText('email')).toBe('请输入有效的邮箱地址');

    /* 改对：防抖复验后错误摘除 */
    input('email').value = 'ok@icen.ai';
    fire(input('email'), 'input');
    await nextTick(40);
    expect(fieldWrap('email').classList.contains('is-error')).toBe(false);
    expect(errorText('email')).toBeNull();
    expect(form().querySelector('.icen-form-validate-summary')).toBeNull();

    /* 未出错字段（username 已通过）input 不重复校验（字段事件零新增） */
    const fieldEvents: string[] = [];
    const off = onIcen('icen:form-field-validate', (e) => fieldEvents.push(e.detail.name));
    input('username').value = 'icen2';
    fire(input('username'), 'input');
    await nextTick(40);
    expect(fieldEvents).toHaveLength(0);
    off();
  });

  test('blur 补验未触碰字段（提交后）', async () => {
    mount(FORM_HTML);
    createFormValidator(form(), { scrollToError: false });
    fillAllValid();
    fireSubmit(form());
    await nextTick();

    input('email').value = '';
    fire(input('email'), 'focusout');
    await nextTick();
    expect(fieldWrap('email').classList.contains('is-error')).toBe(true);
    expect(errorText('email')).toBe('此项为必填项');
  });

  test('IME 组合态期间 input 挂起，compositionend 后再输入即复验', async () => {
    mount(FORM_HTML);
    createFormValidator(form(), { strategy: { debounceMs: 5 }, scrollToError: false });
    fillAllValid();
    input('email').value = 'bad';
    fireSubmit(form());
    await nextTick();
    expect(fieldWrap('email').classList.contains('is-error')).toBe(true);

    const email = input('email');
    fire(email, 'compositionstart');
    email.value = 'ok@icen.ai';
    fire(email, 'input');
    await nextTick(30);
    /* 组合态中挂起：错误仍在（未被 5ms 防抖复验清掉） */
    expect(fieldWrap('email').classList.contains('is-error')).toBe(true);

    fire(email, 'compositionend');
    fire(email, 'input');
    await nextTick(30);
    expect(fieldWrap('email').classList.contains('is-error')).toBe(false);
    expect(errorText('email')).toBeNull();
  });
});

describe('异步自定义校验', () => {
  test('校验中 .is-validating + aria-busy；异步失败呈现返回消息；竞态守卫最新为准', async () => {
    let resolveSlow: ((v: true | string) => void) | null = null;
    registerValidator('taken', (value) => {
      if (value !== 'admin') return true;
      return new Promise<true | string>((res) => {
        resolveSlow = res;
      });
    });
    mount(`
      <form data-icen-validate>
        <div class="icen-field">
          <label class="icen-field-label">用户名</label>
          <input class="icen-form-input" name="user" required data-icen-validate="taken" />
        </div>
        <button type="submit">提交</button>
      </form>
    `);
    const handle = createFormValidator(form(), { scrollToError: false });
    const field = input('user');

    field.value = 'admin';
    const p1 = handle.validateField('user');
    expect(fieldWrap('user').classList.contains('is-validating')).toBe(true);
    expect(field.getAttribute('aria-busy')).toBe('true');
    await nextTick(); /* 让 evaluateRules 进入自定义校验分支 */
    resolveSlow?.('该用户名已被占用');
    const ok1 = await p1;
    expect(ok1).toBe(false);
    expect(fieldWrap('user').classList.contains('is-validating')).toBe(false);
    expect(errorText('user')).toBe('该用户名已被占用');

    /* 竞态：慢校验挂起时发起新校验，旧结果丢弃不呈现 */
    let resolveOld: ((v: true | string) => void) | null = null;
    registerValidator('taken', (value) =>
      value === 'admin'
        ? new Promise<true | string>((res) => {
            resolveOld = res;
          })
        : true,
    );
    field.value = 'admin';
    const slow = handle.validateField('user'); /* 慢：挂起 */
    expect(fieldWrap('user').classList.contains('is-validating')).toBe(true);
    await nextTick(); /* 慢校验进入挂起 */
    field.value = 'icen';
    const fast = await handle.validateField('user'); /* 快：立即通过 */
    expect(fast).toBe(true);
    expect(fieldWrap('user').classList.contains('is-error')).toBe(false);
    resolveOld?.('过期结果：不应呈现');
    await slow;
    expect(errorText('user')).toBeNull();
    expect(handle.errors().user).toBeUndefined();
    expect(fieldWrap('user').classList.contains('is-validating')).toBe(false);
  });
});

describe('reset / destroy / errors', () => {
  test('reset 清除状态与呈现（不动表单值）', async () => {
    mount(FORM_HTML);
    const handle = createFormValidator(form(), { scrollToError: false });
    fireSubmit(form());
    await nextTick();
    expect(Object.keys(handle.errors()).length).toBe(3); /* confirm 空 == password 空，matches 通过 */

    input('username').value = 'icen';
    handle.reset();
    expect(handle.errors()).toEqual({});
    expect(fieldWrap('username').classList.contains('is-error')).toBe(false);
    expect(fieldWrap('username').querySelector('p.icen-field-error')).toBeNull();
    expect(input('username').hasAttribute('aria-describedby')).toBe(false);
    expect(form().querySelector('.icen-form-validate-summary')).toBeNull();
    expect(input('username').value).toBe('icen'); /* 值不动 */

    /* reset 后提交状态归零：字段 input 不再复验 */
    input('email').value = 'whatever';
    fire(input('email'), 'input');
    await nextTick(30);
    expect(fieldWrap('email').classList.contains('is-error')).toBe(false);
  });

  test('destroy 摘除监听：提交不再校验；幂等（重复 destroy 安全）', async () => {
    const seen: unknown[] = [];
    onIcen('icen:form-invalid', (e) => seen.push(e.detail));
    mount(FORM_HTML);
    const handle = createFormValidator(form(), { scrollToError: false });
    handle.destroy();
    handle.destroy();
    fireSubmit(form());
    await nextTick();
    expect(seen).toHaveLength(0);

    /* 同表单可重新创建 handle */
    const handle2 = createFormValidator(form(), { scrollToError: false });
    expect(handle2).not.toBe(handle);
    fireSubmit(form());
    await nextTick();
    expect(seen).toHaveLength(1);
    handle2.destroy();
  });

  test('同 form 单例：重复 createFormValidator 返回同一 handle（幂等）', () => {
    mount(FORM_HTML);
    const a = createFormValidator(form());
    const b = createFormValidator(form(), { strategy: { on: 'input' } });
    expect(a).toBe(b);
    a.destroy();
    const c = createFormValidator(form());
    expect(c).not.toBe(a);
    c.destroy();
  });
});

describe('指针按下期布局守卫（blur 复验位移吃掉提交点击的回归）', () => {
  test('按下期间 summary/错误元素结构不变、事件照常；pointerup 后下一帧补齐；click 落钮提交链路到达', async () => {
    mount(FORM_HTML);
    const handle = createFormValidator(form(), { strategy: { debounceMs: 5 }, scrollToError: false });

    /* 首次提交：username 违反 minlength=3，summary + 字段错误元素就位 */
    fillAllValid();
    input('username').value = 'ab';
    fireSubmit(form());
    await nextTick();
    expect(typeof handle.errors().username).toBe('string');
    expect(form().querySelectorAll('a.icen-form-validate-summary-item')).toHaveLength(1);
    const errElId = fieldWrap('username').querySelector('p.icen-field-error')?.id;
    expect(errElId).toBeTruthy();

    /* 首次提交的事件落定后再挂监听，只观察按下期复验的事件 */
    const fieldEvents: Array<{ name: string; valid: boolean; message?: string }> = [];
    const valids: string[][] = [];
    onIcen('icen:form-field-validate', (e) => fieldEvents.push(e.detail));
    onIcen('icen:form-valid', (e) => valids.push(e.detail.names));

    /* 用户修好 username，聚焦未离开就直接按下提交钮：
       input 防抖复验（5ms）落定在按下期间（mousedown → blur → 复验） */
    const btn = form().querySelector('button[type="submit"]') as HTMLButtonElement;
    let clicks = 0;
    btn.addEventListener('click', () => clicks++);
    input('username').value = 'icen';
    fire(input('username'), 'input');
    fire(btn, 'pointerdown');
    await nextTick(30);

    /* 事件契约不推迟：字段复验事件即时到达 */
    expect(fieldEvents).toEqual([{ name: 'username', valid: true }]);
    expect(handle.errors()).toEqual({});
    /* 按下期间零结构位移：summary 原样（仍在、仍 1 条），错误元素未摘除 */
    expect(form().querySelectorAll('a.icen-form-validate-summary-item')).toHaveLength(1);
    expect(fieldWrap('username').querySelector('p.icen-field-error')?.id).toBe(errElId);
    /* 非位移呈现照常：wrap 类/aria 已同步复位 */
    expect(fieldWrap('username').classList.contains('is-error')).toBe(false);
    expect(input('username').hasAttribute('aria-invalid')).toBe(false);

    /* pointerup → 下一帧统一补齐结构变更：错误元素摘除 + summary 移除 */
    fire(btn, 'pointerup');
    await nextTick(30);
    expect(fieldWrap('username').querySelector('p.icen-field-error')).toBeNull();
    expect(form().querySelector('.icen-form-validate-summary')).toBeNull();

    /* click 落在按钮上 → submit → 全量校验通过 → form-valid 到达 */
    btn.click();
    expect(clicks).toBe(1);
    await nextTick();
    expect(valids).toEqual([['username', 'email', 'password', 'confirm']]);
    handle.destroy();
  });

  test('strategy.on=blur：按下期间 blur 校验同样推迟结构变更；pointercancel 也触发补齐', async () => {
    mount(FORM_HTML);
    const handle = createFormValidator(form(), { strategy: { on: 'blur' }, scrollToError: false });
    const btn = form().querySelector('button[type="submit"]')!;

    fire(btn, 'pointerdown');
    fire(input('username'), 'focusout'); /* blur 即校验 → required 失败 */
    await nextTick();

    /* 按下期间：错误元素未创建（结构变更推迟）；类/aria 即刻同步 */
    expect(fieldWrap('username').querySelector('p.icen-field-error')).toBeNull();
    expect(fieldWrap('username').classList.contains('is-error')).toBe(true);
    expect(input('username').getAttribute('aria-invalid')).toBe('true');
    expect(handle.errors().username).toBe('此项为必填项');
    /* blur 复验路径本就不创建 summary（创建/摘除归 validate() 管） */
    expect(form().querySelector('.icen-form-validate-summary')).toBeNull();

    /* pointercancel → 下一帧补齐：错误元素创建 + aria-describedby 接线 */
    fire(btn, 'pointercancel');
    await nextTick(30);
    const errEl = fieldWrap('username').querySelector('p.icen-field-error');
    expect(errEl?.textContent).toBe('此项为必填项');
    expect(input('username').getAttribute('aria-describedby')).toBe(errEl?.id);
    handle.destroy();
  });

  test('无指针按下时复验立即落 DOM（既有行为不变）', async () => {
    mount(FORM_HTML);
    const handle = createFormValidator(form(), { scrollToError: false });
    fillAllValid();
    input('email').value = 'bad-email';
    fireSubmit(form());
    await nextTick();
    expect(form().querySelectorAll('a.icen-form-validate-summary-item')).toHaveLength(1);

    /* 改好后 blur 复验：无指针按下，错误元素摘除 + summary 移除立即生效（不走推迟队列） */
    input('email').value = 'ok@icen.ai';
    fire(input('email'), 'focusout');
    await nextTick();
    expect(fieldWrap('email').querySelector('p.icen-field-error')).toBeNull();
    expect(form().querySelector('.icen-form-validate-summary')).toBeNull();
    handle.destroy();
  });
});

describe('show_form（AI 工具）', () => {
  test('已自动注册；run 渲染表单进 mount，提交（过校验）resolve 值对象，渲染体摘除', async () => {
    const def = getAiTool('show_form');
    expect(def).toBeDefined();
    expect(def?.present).toBe('mount');
    expect(def?.description).toBe('向用户渲染一个结构化表单收集输入');

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const result = def!.run(
      {
        title: '收集信息',
        submitLabel: '确认',
        fields: [
          { name: 'nickname', label: '昵称', required: true, help: '3-20 个字符' },
          { name: 'contact', label: '邮箱', type: 'email', required: true },
          { name: 'age', label: '年龄', type: 'number', min: 18, max: 120 },
          { name: 'bio', label: '简介', type: 'textarea' },
          { name: 'role', label: '角色', type: 'select', options: [{ label: '管理员', value: 'admin' }, '访客'] },
        ],
      },
      mountEl,
    ) as Promise<Record<string, unknown>>;

    const root = mountEl.querySelector('.icen-ai-form');
    expect(root).not.toBeNull();
    expect(mountEl.querySelector('.icen-ai-form-title')?.textContent).toBe('收集信息');
    expect(mountEl.querySelectorAll('.icen-field').length).toBe(5);
    expect(mountEl.querySelector('select[name="role"] option[value="admin"]')?.textContent).toBe('管理员');
    expect(mountEl.querySelector('input[name="nickname"]')?.hasAttribute('required')).toBe(true);
    expect(mountEl.querySelector('[data-icen-ai-form-cancel]')).not.toBeNull();
    expect(mountEl.querySelector('form')?.hasAttribute('data-icen-validate-summary')).toBe(true);

    /* 未填必填直接提交 → 不 resolve（Promise 仍 pending），渲染体仍在 */
    fire(mountEl.querySelector('form')!, 'submit', { cancelable: true });
    await nextTick();
    expect(mountEl.querySelector('.icen-form-validate-summary')).not.toBeNull();

    /* 填好再提交 → resolve 值对象 */
    (mountEl.querySelector('input[name="nickname"]') as HTMLInputElement).value = 'icen';
    (mountEl.querySelector('input[name="contact"]') as HTMLInputElement).value = 'a@b.c';
    (mountEl.querySelector('input[name="age"]') as HTMLInputElement).value = '30';
    (mountEl.querySelector('select[name="role"]') as HTMLSelectElement).value = 'admin';
    fire(mountEl.querySelector('form')!, 'submit', { cancelable: true });

    const values = (await Promise.race([result, nextTick(500).then(() => null)])) as Record<string, unknown> | null;
    expect(values).not.toBeNull();
    expect(values).toEqual({
      nickname: 'icen',
      contact: 'a@b.c',
      age: '30',
      bio: '',
      role: 'admin',
    });
    expect(mountEl.querySelector('.icen-ai-form')).toBeNull(); /* 渲染体已摘除 */
    mountEl.remove();
  });

  test('点「取消」resolve { cancelled: true }', async () => {
    const def = getAiTool('show_form')!;
    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const result = def.run({ fields: [{ name: 'x', label: 'X' }] }, mountEl) as Promise<{ cancelled: true }>;
    (mountEl.querySelector('[data-icen-ai-form-cancel]') as HTMLButtonElement).click();
    const values = await Promise.race([result, nextTick(300).then(() => null)]);
    expect(values).toEqual({ cancelled: true });
    expect(mountEl.querySelector('.icen-ai-form')).toBeNull();
    mountEl.remove();
  });
});
