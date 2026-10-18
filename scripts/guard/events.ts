// 事件纪律守卫：字面量层防绕过（编译器管类型，这里管字符串）。
//  1. 禁止裸写 new CustomEvent('icen:…')——必须走 emitIcen（全库唯一派生口）；
//  2. emitIcen 的字符串/模板字面量事件名必须 ^icen:[a-z0-9-]+ 且已登记 IcenEventMap；
//  3. 反向核对：IcenEventMap 每个登记事件必须在 behaviors 源码里有字面提及
//     （发射/监听/模板前缀均可）——抓「登记了却没人用」的死条目与拼写漂移。
// 注意：本地 emit/emitArea/dispatch 包装最终都汇到 emitIcen，字面量会被本守卫收编。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SRC, listFiles, type GuardResult } from './shared';

/** 手势层豁免：由 events.ts 的 emit(host, type, …) 按 IcenGestureEvent 联合类型变量派发，
 *  类型联合与 IcenEventMap 同表维护，结构性保证，不重复字面核对。
 *  swipe 四向同此豁免：由 events.ts 手势引擎经 emitIcen 模板 `icen:swipe-${dir}` 派发
 *  （策略层不收，无策略查找）。 */
const GESTURE_EXEMPT = new Set([
  'icen:click', 'icen:dblclick', 'icen:contextmenu', 'icen:longpress', 'icen:text-select',
  'icen:swipe-left', 'icen:swipe-right', 'icen:swipe-up', 'icen:swipe-down',
]);

/** 前瞻登记豁免：契约先于实现冻结（防止并行施工各自注册冲突），随附实现模块落地后移除。 */
const FORWARD_EXEMPT = new Set([
  'icen:table-cell-edit', 'icen:table-column-reorder', 'icen:table-group-toggle', 'icen:table-column-resize',
  'icen:form-field-validate', 'icen:form-valid', 'icen:form-invalid',
  'icen:chart-zoom', 'icen:ai-tool-approve', 'icen:ai-tool-reject',
  'icen:locale-change',
  'icen:mention-select', 'icen:autocomplete-select', 'icen:autocomplete-change',
]);

const EVENT_NAME_RE = /^icen:[a-z0-9-]+$/;

export async function checkEvents(): Promise<GuardResult> {
  const violations: string[] = [];

  /* 从 events.ts 的 IcenEventMap 提取登记事件名（'icen:xxx': Detail 形态） */
  const eventsSrc = await readFile(join(SRC, 'behaviors', 'events.ts'), 'utf8');
  const registered = new Set([...eventsSrc.matchAll(/'(icen:[a-z0-9-]+)'\s*:/g)].map((m) => m[1]));

  const files = await listFiles(join(SRC, 'behaviors'), '.ts');
  const mentioned = new Set<string>(); /* 反向核对：源码中字面提及的事件名 */

  for (const file of files) {
    const rel = `src/behaviors/${file}`;
    const src = await readFile(join(SRC, 'behaviors', file), 'utf8');
    const lines = src.split('\n');

    /* 反向核对素材：任意引号的 icen: 字面量（发射/监听/注释均计入提及） */
    if (file !== 'events.ts') {
      for (const m of src.matchAll(/['"`](icen:[a-z0-9-]+)['"`]/g)) mentioned.add(m[1]);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = i + 1;

      /* 规则 1：裸写 new CustomEvent('icen:…')（单/双引号与模板前缀形态） */
      for (const m of line.matchAll(/new\s+CustomEvent\(\s*['"`](icen:[^'"`]*)['"`]/g)) {
        violations.push(`${rel}:${lineNo}: 裸写 new CustomEvent('${m[1]}')——领域事件必须走 emitIcen`);
      }

      /* 规则 2：emitIcen 字面量事件名（第二参数） */
      for (const m of line.matchAll(/emitIcen\(\s*[^,]+,\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)) {
        const name = m[2];
        if (!EVENT_NAME_RE.test(name)) {
          violations.push(`${rel}:${lineNo}: emitIcen 事件名 '${name}' 不符合 ^icen:[a-z0-9-]+$`);
        } else if (!registered.has(name)) {
          violations.push(`${rel}:${lineNo}: emitIcen 事件名 '${name}' 未登记进 events.ts 的 IcenEventMap`);
        }
      }

      /* 规则 2b：emitIcen 模板字面量（`icen:chart-${type}` 形态）——静态前缀须是登记名的前缀 */
      for (const m of line.matchAll(/emitIcen\(\s*[^,]+,\s*`([^`]*)`/g)) {
        const prefix = m[1].split('${')[0] ?? '';
        if (!prefix) continue;
        if (!EVENT_NAME_RE.test(prefix)) {
          violations.push(`${rel}:${lineNo}: emitIcen 模板前缀 '${prefix}' 不符合 ^icen:[a-z0-9-]+$`);
        } else if (![...registered].some((r) => r.startsWith(prefix))) {
          violations.push(`${rel}:${lineNo}: emitIcen 模板前缀 '${prefix}' 不是任何登记事件名的前缀`);
        }
      }
    }

    /* 反向核对素材：模板前缀展开（如 icen:chart- → hover/click/… 全部登记名） */
    if (file !== 'events.ts') {
      for (const m of src.matchAll(/['"`](icen:[a-z0-9-]+-?)\$\{/g)) {
        for (const r of registered) if (r.startsWith(m[1])) mentioned.add(r);
      }
    }
  }

  /* 规则 3：登记了却无任何字面提及（发射/监听都没有）→ 死条目嫌疑 */
  for (const name of registered) {
    if (GESTURE_EXEMPT.has(name) || FORWARD_EXEMPT.has(name) || mentioned.has(name)) continue;
    violations.push(`events.ts: '${name}' 已登记 IcenEventMap，但 behaviors 源码无任何字面提及（死登记？）`);
  }

  return { title: `事件纪律（裸 CustomEvent 禁令 / emitIcen 字面量 × IcenEventMap 双向核对，共 ${registered.size} 个登记事件）`, violations };
}
