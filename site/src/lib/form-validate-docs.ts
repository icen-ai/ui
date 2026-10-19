/*
 * 表单校验（form-validate）组件文档 —— 文档站组件页数据（site/src/lib/components.ts 统一注册导航）。
 * 导出名 FORM_VALIDATE_DOCS：ComponentDoc 形态，slug='form-validate'（scripts/slugs.mjs 已登记）。
 * 契约源：src/behaviors/form-validate.ts（头注释）+ src/components/form-validate.css（DOM 契约头注释）。
 * script 字段是纯 JS（new Function 执行，禁 TS 语法）；模块形参名 formValidateMod。
 */
import type { ComponentDoc } from './components';

export const FORM_VALIDATE_DOCS: ComponentDoc = {
  slug: 'form-validate',
  name: '表单校验',
  group: '表单',
  desc: '原生约束优先的零依赖校验层：HTML5 属性即 schema，submit 优先策略 + 可异步具名校验。',
  detail: {
    features: [
      '**规则**：`required` / `type` / `minlength` / `maxlength` / `pattern` / `min` / `max` / `step` 即 schema',
      '**扩展**：`data-icen-validate` 只承载额外规则（`matches:<字段名>` 跨字段）',
      '**自定义**：`registerValidator` 注册具名校验，可异步',
      '**消息**：`data-icen-msg-<rule>` 单字段消息；`setValidateMessages` 全局 i18n',
      '**策略**：首次提交全量校验，出错字段 input 即时复验（160ms 防抖），未触碰字段 blur 补验',
      '**呈现**：`.icen-field` 挂 `.is-error`，自动插入 `role=alert` 错误文案并接线 ARIA',
      '**事件**：`icen:form-field-validate` / `icen:form-valid` / `icen:form-invalid`',
    ],
    notes: [
      '异步校验挂 `.is-validating` + `aria-busy`，竞态守卫最新为准；`data-icen-validate-summary` 顶部错误清单并聚焦首错；IME 组合态挂起。',
      '内置 AI 工具 `show_form`（随 `behaviors/ai-tools` 注册，与 `render_chart` 同款内置）：渲染结构化表单收集输入，提交 resolve 值对象，取消 resolve `{ cancelled: true }`；渲染体由本模块的 `runShowForm` 承担。',
    ],
  },
  demo: `<form class="icen-form" id="demo-fv-form" data-icen-validate data-icen-validate-summary data-icen-validate-show-valid style="max-width:460px">
  <div class="icen-field">
    <label class="icen-field-label" for="demo-fv-user">用户名</label>
    <input id="demo-fv-user" class="icen-form-input" name="username" required minlength="3" data-icen-validate="taken" data-icen-msg-required="请输入用户名" placeholder="试试 admin（异步重名）" />
    <span class="icen-field-hint">必填，3 个以上字符；admin 会被 mock 重名校验拒绝</span>
  </div>
  <div class="icen-field">
    <label class="icen-field-label" for="demo-fv-email">邮箱</label>
    <input id="demo-fv-email" class="icen-form-input" name="email" type="email" required placeholder="you@icen.ai" />
  </div>
  <div class="icen-field">
    <label class="icen-field-label" for="demo-fv-pwd">密码</label>
    <input id="demo-fv-pwd" class="icen-form-input" name="password" type="password" required minlength="6" />
  </div>
  <div class="icen-field">
    <label class="icen-field-label" for="demo-fv-pwd2">确认密码</label>
    <input id="demo-fv-pwd2" class="icen-form-input" name="confirm" type="password" data-icen-validate="matches:password" />
  </div>
  <div class="icen-field">
    <label class="icen-field-label" for="demo-fv-age">年龄</label>
    <input id="demo-fv-age" class="icen-form-input" name="age" type="number" min="18" max="120" />
    <span class="icen-field-hint">选填，18–120</span>
  </div>
  <div class="icen-form-actions">
    <button type="submit" class="icen-btn icen-btn-primary">提交</button>
    <button type="button" class="icen-btn icen-btn-ghost" id="demo-fv-reset">复位校验态</button>
  </div>
</form>
<p class="demo-label" id="demo-fv-log" style="margin-top:10px">直接提交看全量校验 → 改出错字段即时复验 → 全部通过派 icen:form-valid</p>`,
  usage: `import { initFormValidate, createFormValidator, registerValidator, setValidateMessages }
  from '@icen.ai/ui/kit/form-validate';

initFormValidate();   // document 委托 + 幂等；form[data-icen-validate] 自动挂 novalidate

<!-- HTML5 属性即 schema；data-icen-validate 只承载额外规则 -->
<form data-icen-validate data-icen-validate-summary data-icen-validate-show-valid>
  <input name="email" type="email" required data-icen-msg-required="邮箱必填" />
  <input name="confirm" data-icen-validate="matches:password" />
  <input name="code" data-icen-validate="unique:invite" />
</form>

<!-- 具名自定义校验（可异步；true 通过，string 即消息） -->
registerValidator('unique', async (value, field, form) => {
  const res = await fetch('/api/check?code=' + encodeURIComponent(value));
  return res.ok ? true : '邀请码无效';
});

<!-- i18n 全局消息表（占位符 {min} {max} {step} {length} {label}） -->
setValidateMessages({ required: '{label}不能为空', email: '邮箱格式有误' });

<!-- 程序化单表单（同 form 单例，init 与显式创建共享） -->
const handle = createFormValidator(formEl, {
  strategy: { on: 'submit', debounceMs: 160 },   // on: 'submit'|'blur'|'input'；缺省 = submit 优先策略
  scrollToError: true,                            // 失败聚焦首错 + scrollIntoView
});
await handle.validate();          // true | false；事件 icen:form-valid / icen:form-invalid 双通道
await handle.validateField('email');
handle.errors();                  // { 字段名: 消息 }
handle.reset();                   // 清状态与呈现（不动值）
handle.destroy();

// 事件（detail 契约见 events.ts IcenEventMap）：
//   icen:form-field-validate { name, valid, message? }   每字段校验完
//   icen:form-valid   { names }                            整表通过（通过字段名数组）
//   icen:form-invalid { errors, first }                    未过（errors + 第一个错误字段名）

// AI 工具（import 本模块即自动注册）：
//   show_form —— 向用户渲染一个结构化表单收集输入；
//   area.call('show_form', { title, fields: [{ name, label, type, required, pattern, min, max, options, help }], submitLabel })
//   → run 返回 Promise：提交（过校验）resolve 表单值对象；「取消」resolve { cancelled: true }`,
  behaviors: ['form-validate'],
  behaviorInit: { 'form-validate': 'initFormValidate' },
  script: `const form = document.getElementById('demo-fv-form');
const logEl = document.getElementById('demo-fv-log');
const logDefault = logEl ? logEl.textContent : '';
let logTimer = null;
function log(msg, sticky) {
  if (!logEl) return;
  logEl.textContent = msg;
  clearTimeout(logTimer);
  if (!sticky) logTimer = setTimeout(function () { logEl.textContent = logDefault; }, 2600);
}

if (form && formValidateMod) {
  /* mock 异步重名校验：admin 永远被占用（.is-validating + aria-busy 可见） */
  formValidateMod.registerValidator('taken', function (value) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(value === 'admin' ? '该用户名已被占用（mock）' : true);
      }, 500);
    });
  });

  form.addEventListener('icen:form-invalid', function (e) {
    var detail = e.detail;
    log('icen:form-invalid：' + Object.keys(detail.errors).length + ' 项未通过，首错 = ' + detail.first, true);
  });
  form.addEventListener('icen:form-valid', function (e) {
    log('icen:form-valid：通过字段 ' + e.detail.names.join(' / '), true);
  });

  /* initFormValidate 已为该表单建过 handle：createFormValidator 幂等返回同一实例 */
  var handle = formValidateMod.createFormValidator(form);
  var resetBtn = document.getElementById('demo-fv-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      handle.reset();
      log('校验态已复位（表单值不动）');
    });
  }
}`,
};
