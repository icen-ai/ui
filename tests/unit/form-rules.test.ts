// form-validate 规则引擎单元测试：resolveFieldRules（HTML5 属性即 schema）+
// evaluateRules（空值语义 / 各原生约束 / matches / 自定义异步校验 / 消息覆盖）。
// 不触 DOM 呈现层——那是 tests/dom/form-validate.test.ts 的职责。
import { afterEach, describe, expect, test } from 'bun:test';
import {
  evaluateRules,
  fieldLabel,
  fieldValue,
  registerValidator,
  resolveFieldRules,
  setValidateMessages,
  unregisterValidator,
  type FieldElement,
} from '../../src/behaviors/form-validate';

function makeField(attrs: Record<string, string>, tag = 'input'): FieldElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'value') (el as HTMLInputElement).value = v;
    else el.setAttribute(k, v);
  }
  return el as FieldElement;
}

afterEach(() => {
  unregisterValidator('unique');
});

describe('resolveFieldRules：原生约束即 schema', () => {
  test('required / type / minlength / maxlength / pattern / min / max / step 全部入规则集', () => {
    const f = makeField({
      name: 'age', type: 'number', required: '', minlength: '1', maxlength: '3',
      pattern: '[0-9]+', min: '18', max: '120', step: '1',
    });
    expect(resolveFieldRules(f).map((r) => r.rule)).toEqual([
      'required', 'number', 'minlength', 'maxlength', 'pattern', 'min', 'max', 'step',
    ]);
  });

  test('email/url 由 type 推导；step="any" 不进规则集；data-icen-validate 追加额外规则', () => {
    const email = makeField({ name: 'e', type: 'email' });
    expect(resolveFieldRules(email).map((r) => r.rule)).toEqual(['email']);

    const any = makeField({ name: 'n', type: 'number', step: 'any', min: '0' });
    expect(resolveFieldRules(any).map((r) => r.rule)).toEqual(['number', 'min']);

    const extra = makeField({ name: 'c', 'data-icen-validate': 'matches:password unique:username flag' });
    expect(resolveFieldRules(extra)).toEqual([
      { rule: 'matches', arg: 'password' },
      { rule: 'unique', arg: 'username' },
      { rule: 'flag', arg: undefined },
    ]);
  });

  test('无任何约束 → 空规则集（字段不参与校验与事件）', () => {
    expect(resolveFieldRules(makeField({ name: 'x' }))).toEqual([]);
  });
});

describe('evaluateRules：空值语义对齐 HTML5', () => {
  test('非 required 规则对空值放行（valueMissing 归 required 管）', async () => {
    const f = makeField({ name: 'e', type: 'email', minlength: '3', pattern: 'a+', min: '2', max: '9', step: '2' });
    const rules = resolveFieldRules(f);
    expect(await evaluateRules('', rules, { field: f })).toBe(true);
  });

  test('required：trim 后非空通过；checkbox/radio 取 checked 语义', async () => {
    const text = makeField({ name: 't', required: '' });
    expect(await evaluateRules('   ', resolveFieldRules(text), { field: text })).toBe('此项为必填项');
    expect(await evaluateRules(' ok ', resolveFieldRules(text), { field: text })).toBe(true);

    const cb = makeField({ name: 'c', type: 'checkbox', required: '' }) as FieldElement;
    expect(await evaluateRules('', resolveFieldRules(cb), { field: cb })).toBe('此项为必填项');
    (cb as HTMLInputElement).checked = true;
    expect(await evaluateRules('on', resolveFieldRules(cb), { field: cb })).toBe(true);
  });

  test('email / url / number', async () => {
    const email = makeField({ name: 'e', type: 'email' });
    expect(await evaluateRules('bad', resolveFieldRules(email), { field: email })).toBe('请输入有效的邮箱地址');
    expect(await evaluateRules('a@b.co', resolveFieldRules(email), { field: email })).toBe(true);

    const url = makeField({ name: 'u', type: 'url' });
    expect(await evaluateRules('not-a-url', resolveFieldRules(url), { field: url })).toBe('请输入有效的链接地址');
    expect(await evaluateRules('https://icen.ai/x', resolveFieldRules(url), { field: url })).toBe(true);

    const num = makeField({ name: 'n', type: 'number' });
    expect(await evaluateRules('abc', resolveFieldRules(num), { field: num })).toBe('请输入有效的数字');
    expect(await evaluateRules('-3.5', resolveFieldRules(num), { field: num })).toBe(true);
  });

  test('minlength/maxlength：含 {min}/{max} 占位符；空值不误伤', async () => {
    const f = makeField({ name: 'p', minlength: '3', maxlength: '5' });
    expect(await evaluateRules('ab', resolveFieldRules(f), { field: f })).toBe('至少输入 3 个字符');
    expect(await evaluateRules('abcdef', resolveFieldRules(f), { field: f })).toBe('最多输入 5 个字符');
    expect(await evaluateRules('abcd', resolveFieldRules(f), { field: f })).toBe(true);
  });

  test('pattern：HTML5 整串匹配语义；非法正则不猜（放行）', async () => {
    const f = makeField({ name: 'code', pattern: '[a-z]+' });
    expect(await evaluateRules('ABC', resolveFieldRules(f), { field: f })).toBe('输入格式不正确');
    expect(await evaluateRules('abc', resolveFieldRules(f), { field: f })).toBe(true);
    expect(await evaluateRules('abc-def', resolveFieldRules(f), { field: f })).toBe('输入格式不正确');

    const bad = makeField({ name: 'b', pattern: '([a-z' });
    expect(await evaluateRules('anything', resolveFieldRules(bad), { field: bad })).toBe(true);
  });

  test('min/max：数值比较 + 消息占位符；date 走 ISO 字典序', async () => {
    const num = makeField({ name: 'n', type: 'number', min: '18', max: '65' });
    expect(await evaluateRules('17', resolveFieldRules(num), { field: num })).toBe('不能小于 18');
    expect(await evaluateRules('66', resolveFieldRules(num), { field: num })).toBe('不能大于 65');
    expect(await evaluateRules('30', resolveFieldRules(num), { field: num })).toBe(true);

    const date = makeField({ name: 'd', type: 'date', min: '2026-01-01', max: '2026-12-31' });
    expect(await evaluateRules('2025-12-31', resolveFieldRules(date), { field: date })).toBe('不能小于 2026-01-01');
    expect(await evaluateRules('2026-06-01', resolveFieldRules(date), { field: date })).toBe(true);
  });

  test('step：base 取 min，缺省 0；浮点步长去尾噪', async () => {
    const f = makeField({ name: 'q', type: 'number', step: '0.1', min: '0' });
    expect(await evaluateRules('0.3', resolveFieldRules(f), { field: f })).toBe(true);
    expect(await evaluateRules('0.35', resolveFieldRules(f), { field: f })).toBe('数值必须是 0.1 的倍数');

    const base = makeField({ name: 'q2', type: 'number', step: '5', min: '10' });
    expect(await evaluateRules('15', resolveFieldRules(base), { field: base })).toBe(true);
    expect(await evaluateRules('12', resolveFieldRules(base), { field: base })).toBe('数值必须是 5 的倍数');
  });

  test('matches：跨字段相等；目标字段缺失时放行', async () => {
    const form = document.createElement('form');
    const pwd = makeField({ name: 'password', value: 'secret' });
    const confirm = makeField({ name: 'confirm', 'data-icen-validate': 'matches:password' });
    form.append(pwd, confirm);
    expect(await evaluateRules('nope', resolveFieldRules(confirm), { field: confirm, form })).toBe('两次输入不一致');
    expect(await evaluateRules('secret', resolveFieldRules(confirm), { field: confirm, form })).toBe(true);

    const orphan = makeField({ name: 'x', 'data-icen-validate': 'matches:ghost' });
    expect(await evaluateRules('anything', resolveFieldRules(orphan), { field: orphan, form })).toBe(true);
  });

  test('顺序求值：首个失败即返回（required 先于后续规则）', async () => {
    const f = makeField({ name: 'e', type: 'email', required: '' });
    expect(await evaluateRules('', resolveFieldRules(f), { field: f })).toBe('此项为必填项');
    expect(await evaluateRules('bad', resolveFieldRules(f), { field: f })).toBe('请输入有效的邮箱地址');
  });
});

describe('消息覆盖：data-icen-msg-* 与 setValidateMessages', () => {
  test('data-icen-msg-<rule> 覆盖单字段消息', async () => {
    const f = makeField({ name: 'u', required: '', 'data-icen-msg-required': '用户名必填' });
    expect(await evaluateRules('', resolveFieldRules(f), { field: f })).toBe('用户名必填');
  });

  test('setValidateMessages 全局覆盖 + 占位符保留；空串恢复默认', async () => {
    setValidateMessages({ required: '{label}不能为空', email: '邮箱格式有误' });
    try {
      const f = makeField({ name: 'u', required: '', 'aria-label': '用户名' });
      expect(await evaluateRules('', resolveFieldRules(f), { field: f })).toBe('用户名不能为空');
      const e = makeField({ name: 'e', type: 'email' });
      expect(await evaluateRules('x', resolveFieldRules(e), { field: e })).toBe('邮箱格式有误');

      setValidateMessages({ required: '' }); /* 空串恢复默认 */
      expect(await evaluateRules('', resolveFieldRules(f), { field: f })).toBe('此项为必填项');
    } finally {
      setValidateMessages({ required: undefined, email: undefined });
    }
    const e2 = makeField({ name: 'e2', type: 'email' });
    expect(await evaluateRules('x', resolveFieldRules(e2), { field: e2 })).toBe('请输入有效的邮箱地址');
  });
});

describe('自定义校验：registerValidator（可异步）', () => {
  test('异步 true 通过；string 作为消息原文；未注册规则放行', async () => {
    registerValidator('unique', (value) =>
      new Promise<true | string>((res) => setTimeout(() => res(value === 'admin' ? '该用户名已被占用' : true), 5)),
    );
    const f = makeField({ name: 'u', 'data-icen-validate': 'unique' });
    expect(await evaluateRules('admin', resolveFieldRules(f), { field: f })).toBe('该用户名已被占用');
    expect(await evaluateRules('icen', resolveFieldRules(f), { field: f })).toBe(true);

    const ghost = makeField({ name: 'g', 'data-icen-validate': 'not-registered' });
    expect(await evaluateRules('x', resolveFieldRules(ghost), { field: ghost })).toBe(true);
  });

  test('自定义规则接原生约束之后（required 先失败）', async () => {
    registerValidator('unique', () => '不走到这里');
    const f = makeField({ name: 'u', required: '', 'data-icen-validate': 'unique' });
    expect(await evaluateRules('', resolveFieldRules(f), { field: f })).toBe('此项为必填项');
  });
});

describe('小工具：fieldValue / fieldLabel', () => {
  test('fieldValue：勾选类取 checked 语义，其余取 value', () => {
    const cb = makeField({ name: 'c', type: 'checkbox', value: 'yes' }) as HTMLInputElement;
    expect(fieldValue(cb)).toBe('');
    cb.checked = true;
    expect(fieldValue(cb)).toBe('yes');

    const text = makeField({ name: 't', value: 'hi' });
    expect(fieldValue(text)).toBe('hi');
  });

  test('fieldLabel：包装器 label > aria-label > placeholder > fallback', () => {
    const wrap = document.createElement('div');
    wrap.className = 'icen-field';
    const label = document.createElement('label');
    label.className = 'icen-field-label';
    label.textContent = '邮箱';
    const input = makeField({ name: 'e' });
    wrap.append(label, input);
    expect(fieldLabel(input)).toBe('邮箱');
    expect(fieldLabel(null, 'x')).toBe('x');

    const bare = makeField({ name: 'b', 'aria-label': '昵称' });
    expect(fieldLabel(bare)).toBe('昵称');
  });
});
