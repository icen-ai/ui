/*
 * @icen.ai/ui — Behavior: ai-tools（AI 工具体系：UI 能力注册为模型可调用的工具）
 *
 * 定位：AI 族的「手」。任何 UI 能力（图表渲染、diff 应用、todo 写入……）都可
 * 注册为 AiToolDef；宿主通过 createAiToolArea 声明「AI 在这块区域可用哪些工具、
 * 最多挂载几个」——挂不挂、挂哪些、挂几层，全部宿主说了算。库自带 render_chart /
 * render_datatable 两个内置工具（吃纯 JSON：ChartSpec / columns+rows，零函数回调）。
 *
 * 三层控制（从粗到细）：
 *   1. 不 import 本模块 = 生态里根本没有工具体系（tree-shake 友好）
 *   2. createAiToolArea(el, { tools: ['render_chart'], max: 4 }) — 区域白名单 + 上限
 *      （超出上限 LRU 淘汰最旧挂载；tools 支持通配 'chart-*'）
 *   3. 运行时：area.setTools/setMax/clear + unregisterAiTool 全局下架
 *
 * 执行契约（AiToolDef，全部向后兼容扩展）：
 *   run(input, mount, ctx) — ctx: { signal: AbortSignal, progress(line) }；
 *   允许返回 Promise（area 落定后写 record.icen-result——Promise 结果契约）；
 *   timeoutMs 超时 → 结果 { ok:false, error:{ code:'timeout' } }（同步 run 无法中断，
 *   超时只作用于 Promise 型 run，诚实注明）；requiresApproval → 挂载卡先呈审批区
 *   （原因行 + 批准/拒绝），批准派 icen:ai-tool-approve 并执行，拒绝派
 *   icen:ai-tool-reject、卡片 is-cancelled、结果 code 'rejected'；
 *   idempotent → 同名 + JSON.stringify(input) 相同的在途调用复用同一条记录。
 *   失败统一信封：record.icen-result = { ok:false, error:{ code, … } }（事件 icen:ai-tool-result
 *   的 error 字段按 events.ts 契约仍为 string，机器可读细节在 record.icen-result 上）。
 *
 * 参数校验（诚实纪律）：validateToolArgs 支持 type/required/properties/enum/items（一层）/
 * minimum/maximum/minLength/maxLength；不支持的 schema 关键字（oneOf/anyOf/$ref/format……）
 * 不猜不静默——记入 unvalidated 清单。area.call 默认开校验（opts.validate=false 可关），
 * 失败 → 挂载卡错误态列出 errors + result ok:false，不执行 run。
 *
 * 模型侧接线（自有 agent loop / 任意框架）：
 *   aiToolsToOpenAI()/aiToolsToAnthropic() → 各家 chat tools 参数格式
 *   aiToolsToMcp()     → MCP tools/list 形态
 *   aiToolsToAiSdk()   → Vercel AI SDK v5 tool() 描述表（纯 JSON 描述，不 execute——执行在宿主侧挂载）
 *   aiToolsManifest()  → 能力清单文本（system prompt 直接贴）
 *   模型回 tool_call 后：area.call(name, parseAiToolArgs(args)) → 挂载 + 渲染
 *
 * 事件（bubbles）：icen:ai-tool-call {name, input, el} / icen:ai-tool-result
 *   {name, ok, el, error?, count} / icen:ai-tool-evict {name, el} /
 *   icen:ai-tool-approve {name, input, el} / icen:ai-tool-reject {name, input, el}
 *
 * SSR 安全；禁 innerHTML（渲染走各组件自己的安全路径）。
 */

import { renderChart, type ChartSpec } from './charts';
import { createTable, type TableColumn } from './datatable';
import { emitIcen, type IcenEventMap } from './events';
import { t } from './i18n';

/* ══════════════ 工具注册表 ══════════════ */

/** run 第三参：执行上下文（AbortSignal + 活动流追加口） */
export interface AiToolRunContext {
  /** 执行中止信号：超时、卡片被移除/淘汰/清空、unregister 下架时 abort */
  signal: AbortSignal;
  /** 活动流：一行一行追加进挂载卡的活动流区域（.icen-ai-tools-item-stream） */
  progress(line: string): void;
}

/** 一个 UI 工具：模型可调用的可视化/交互能力 */
export interface AiToolDef<TInput = unknown> {
  /** 工具名（模型侧 function name；建议 snake_case） */
  name: string;
  /** 给模型看的一段说明（何时用、返回什么）；requiresApproval 时也作为审批区原因行 */
  description: string;
  /** 输入 JSON Schema（OpenAI parameters / MCP inputSchema 兼容；校验见 validateToolArgs） */
  inputSchema: Record<string, unknown>;
  /**
   * 执行：input → 在 mount 上渲染；返回值作为工具结果（同步直返，或 Promise——
   * area 落定后写 record.icen-result）。第三参 ctx 可选消费（旧两参签名向后兼容）。
   */
  run: (input: TInput, mount: HTMLElement, ctx: AiToolRunContext) => unknown;
  /** 结果呈现：'mount'（默认，渲染即呈现）/ 'data'（run 返回值为准，不占挂载位） */
  present?: 'mount' | 'data';
  /**
   * 超时毫秒数：超时 → 结果 { ok:false, error:{ code:'timeout' } }，卡片错误态，signal abort。
   * 只作用于返回 Promise 的 run（同步 run 在单线程内无法中断，诚实注明）；缺省 = 永不超时。
   */
  timeoutMs?: number;
  /**
   * 执行前需宿主审批：call 时挂载卡先呈审批区（原因行 = description + 输入预览，批准/拒绝按钮）。
   * 批准 → 派 icen:ai-tool-approve 并执行；拒绝 → 派 icen:ai-tool-reject，卡片 .is-cancelled，
   * 结果 { ok:false, error:{ code:'rejected' } }。仅 'mount' 模式生效（'data' 模式无卡可审批）。
   */
  requiresApproval?: boolean;
  /** 幂等：同名 + JSON.stringify(归一 input) 相同的在途调用复用同一条记录（不重复挂载、不重复执行） */
  idempotent?: boolean;
}

export interface AiToolRecord {
  def: AiToolDef;
  /** 挂载元素（present='mount' 时有值；'data' 模式不占挂载位、无 el） */
  el?: HTMLElement;
  ts: number;
  input: unknown;
  /**
   * 结果：run 返回值（Promise 型在落定后写入）。失败统一为诚实信封
   * { ok:false, error:{ code:'validation'|'exec'|'timeout'|'rejected', … } }；
   * 事件 icen:ai-tool-result 的 error 字段按 events.ts 契约为 string，机器可读细节在此。
   */
  result: unknown;
}

const toolRegistry = new Map<string, AiToolDef>();

/** 存活挂载区登记：unregisterAiTool 下架时联动摘除各区域该工具的已挂载卡 */
const LIVE_AREAS = new Set<{ el: HTMLElement; purge: (name: string) => void }>();

/** 注册（或覆盖同名）一个工具；第三方扩展入口 */
export function registerAiTool(def: AiToolDef): void {
  if (def && typeof def.name === 'string' && def.name && typeof def.run === 'function') {
    toolRegistry.set(def.name, def);
  }
}

/**
 * 全局下架一个工具（所有区域随即不可再调用它）；各区域已挂载的卡同步收尾移除
 * （record.el 存在则出 DOM + 出 records，照移除钮路径）。
 */
export function unregisterAiTool(name: string): void {
  toolRegistry.delete(name);
  for (const entry of LIVE_AREAS) {
    /* 顺带清扫失联区域（宿主丢弃 DOM 后未 clear 的登记），防闭包滞留 */
    if (!entry.el.isConnected) {
      LIVE_AREAS.delete(entry);
      continue;
    }
    entry.purge(name);
  }
}

/** 按名查已注册工具（call/can 内部同走此口；未注册返回 undefined） */
export function getAiTool(name: string): AiToolDef | undefined {
  return toolRegistry.get(name);
}

/** 全部已注册工具的快照数组（模型侧导出四族共享的归一管线底座） */
export function listAiTools(): AiToolDef[] {
  return Array.from(toolRegistry.values());
}

/** 白名单匹配：精确名或 'chart-*' 通配 */
function toolAllowed(name: string, allow: string[] | undefined): boolean {
  if (!allow || allow.length === 0) return true;
  return allow.some((pat) => (pat.endsWith('*') ? name.startsWith(pat.slice(0, -1)) : pat === name));
}

/* ══════════════ 参数校验（诚实纪律：不支持的关键字进 unvalidated，不猜不静默）══════════════ */

export interface AiToolValidationError {
  /** 出错参数路径（JSON-pointer 风：'$' 为根；'$.tags[1]'、'$.series[2].name'） */
  path: string;
  message: string;
}

export interface AiToolValidationResult {
  ok: boolean;
  errors: AiToolValidationError[];
  /** 本次未生效的 schema 关键字清单（schema 路径：'$.email.format'、'$.matrix.items.items'）——校验器不猜 */
  unvalidated: string[];
}

/** 真正执行的校验关键字 */
const VALIDATED_KEYWORDS = new Set([
  'type', 'required', 'properties', 'enum', 'items', 'minimum', 'maximum', 'minLength', 'maxLength',
]);

/** 注解类关键字：不作出校验承诺，既不执行也不进 unvalidated（description/title/default 等） */
const ANNOTATION_KEYWORDS = new Set([
  'description', 'title', 'default', 'examples', '$id', '$schema', '$comment', 'deprecated', 'readOnly', 'writeOnly',
]);

/** JSON Schema type 的已知取值（未知类型名不猜：记 unvalidated 并放行） */
const KNOWN_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

function safeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined; /* 循环引用等：不猜 */
  }
}

function typeNameOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function typeMatches(value: unknown, expected: string): boolean {
  switch (expected) {
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
    case 'boolean':
      return typeof value === expected;
    default:
      return true;
  }
}

function isPlainSchemaNode(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 递归校验单个值。path = 参数路径（报错的定位），loc = schema 路径（unvalidated 的定位），
 * arrayDepth = 数组嵌套深度（items 只展开一层：深度 ≥1 的数组不再展开，记 unvalidated）。
 */
function checkSchemaNode(
  value: unknown,
  schema: Record<string, unknown>,
  path: string,
  loc: string,
  errors: AiToolValidationError[],
  unvalidated: Set<string>,
  arrayDepth: number,
): void {
  /* 诚实清单：visited 节点上出现的不支持校验关键字（annotation 不作出承诺、静默跳过） */
  for (const key of Object.keys(schema)) {
    if (!VALIDATED_KEYWORDS.has(key) && !ANNOTATION_KEYWORDS.has(key)) unvalidated.add(`${loc}.${key}`);
  }
  if (value === undefined) return; /* 缺省值由 required 断言，此处不做类型猜测 */

  /* enum：原始值严格相等；对象/数组按 JSON 串比较（循环引用不猜） */
  if (Array.isArray(schema.enum)) {
    const valueJson = safeJson(value);
    const hit = schema.enum.some((opt) => {
      if (opt !== null && typeof opt === 'object') return valueJson !== undefined && safeJson(opt) === valueJson;
      return opt === value;
    });
    if (!hit) {
      errors.push({
        path,
        message: t('aiTools.notInEnum', { p0: schema.enum.map((o) => (typeof o === 'string' ? o : safeJson(o) ?? '?')).join(' / ') }),
      });
    }
    return; /* enum 已给出取值断言，不再叠加 type 检查 */
  }

  /* type（数组形态的联合类型不猜，记 unvalidated） */
  const expected = schema.type;
  if (expected !== undefined) {
    if (Array.isArray(expected)) {
      unvalidated.add(`${loc}.type`);
    } else if (typeof expected === 'string') {
      if (!KNOWN_TYPES.has(expected)) {
        unvalidated.add(`${loc}.type`);
      } else if (!typeMatches(value, expected)) {
        errors.push({ path, message: t('aiTools.typeMismatch', { p0: expected, p1: typeNameOf(value) }) });
        return;
      }
    }
  }

  /* 数值界 / 字符串界 */
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push({ path, message: t('aiTools.numMin', { p0: value, p1: schema.minimum }) });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push({ path, message: t('aiTools.numMax', { p0: value, p1: schema.maximum }) });
    }
  }
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push({ path, message: t('aiTools.strMin', { p0: value.length, p1: schema.minLength }) });
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push({ path, message: t('aiTools.strMax', { p0: value.length, p1: schema.maxLength }) });
    }
  }

  /* 对象：required + properties（properties 递归不限深度） */
  if (isPlainSchemaNode(value)) {
    const obj = value;
    if (Array.isArray(schema.required)) {
      for (const r of schema.required) {
        if (typeof r === 'string' && !(r in obj)) {
          errors.push({ path: `${path}.${r}`, message: t('aiTools.missingRequired') });
        }
      }
    }
    if (isPlainSchemaNode(schema.properties)) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (isPlainSchemaNode(sub) && obj[key] !== undefined) {
          checkSchemaNode(obj[key], sub, `${path}.${key}`, `${loc}.properties.${key}`, errors, unvalidated, arrayDepth);
        }
      }
    }
  }

  /* 数组：items 只展开一层（arrayDepth ≥1 的数组元素不再下钻，记 unvalidated） */
  if (Array.isArray(value) && isPlainSchemaNode(schema.items)) {
    if (arrayDepth >= 1) {
      unvalidated.add(`${loc}.items`);
    } else {
      value.forEach((el, i) => {
        checkSchemaNode(el, schema.items as Record<string, unknown>, `${path}[${i}]`, `${loc}.items`, errors, unvalidated, arrayDepth + 1);
      });
    }
  }
}

/**
 * 工具参数校验：支持 type / required / properties / enum / items（一层）/ minimum / maximum /
 * minLength / maxLength。不支持的 schema 关键字（oneOf/anyOf/allOf/$ref/format/pattern/
 * additionalProperties/minItems……）不猜不静默——记入 unvalidated 清单（schema 路径）。
 * 只检查实际出现的节点；缺省可选字段不做任何断言。
 */
export function validateToolArgs(schema: Record<string, unknown>, args: unknown): AiToolValidationResult {
  const errors: AiToolValidationError[] = [];
  const unvalidated = new Set<string>();
  if (isPlainSchemaNode(schema)) {
    checkSchemaNode(args, schema, '$', '$', errors, unvalidated, 0);
  } else {
    unvalidated.add('$'); /* schema 本身不是对象：整体无法校验，诚实标注 */
  }
  return { ok: errors.length === 0, errors, unvalidated: Array.from(unvalidated) };
}

/* ══════════════ 内置工具：render_chart ══════════════ */

const CHART_SPEC_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      description: t('aiTools.chart.type'),
      enum: ['line', 'area', 'vbar', 'hbar', 'stack', 'donut', 'radar', 'heatmap', 'calendar', 'sparkline', 'gauge', 'scatter'],
    },
    title: { type: 'string', description: t('aiTools.chart.title') },
    labels: { type: 'array', items: { type: 'string' }, description: t('aiTools.chart.labels') },
    values: { type: 'array', items: { type: 'number' }, description: t('aiTools.chart.values') },
    series: {
      type: 'array',
      description: t('aiTools.chart.series'),
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          values: { type: 'array', items: { type: 'number' } },
        },
        required: ['name', 'values'],
      },
    },
    segments: {
      type: 'array',
      description: t('aiTools.chart.segments'),
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, value: { type: 'number' } },
        required: ['label', 'value'],
      },
    },
    axes: { type: 'array', items: { type: 'string' }, description: t('aiTools.chart.radarAxes') },
    points: {
      type: 'array',
      description: t('aiTools.chart.points'),
      items: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, size: { type: 'number' }, label: { type: 'string' } },
      },
    },
    dates: { type: 'array', items: { type: 'string' }, description: t('aiTools.chart.dates') },
    data: {
      type: 'array',
      description: t('aiTools.chart.data'),
      items: { type: 'object' },
    },
    dims: {
      type: 'object',
      description: t('aiTools.chart.dims'),
      properties: {
        label: { type: 'string' },
        series: { type: 'string' },
        value: { type: 'string' },
        x: { type: 'string' },
        y: { type: 'string' },
      },
    },
    tone: { type: 'string', enum: ['accent', 'success', 'warning', 'error', 'muted'] },
    stacked: { type: 'boolean', description: t('aiTools.chart.stacked') },
    fill: { type: 'boolean', description: t('aiTools.chart.area') },
    format: {
      type: 'object',
      description: t('aiTools.chart.format'),
      properties: {
        notation: { type: 'string', enum: ['compact', 'percent', 'ms', 'raw'] },
        unit: { type: 'string' },
      },
    },
    legend: { type: 'boolean', description: t('aiTools.chart.legend') },
    tooltip: { type: 'boolean', description: t('aiTools.chart.tooltip') },
    downsample: {
      type: ['boolean', 'number'],
      description: t('aiTools.chart.lttb'),
    },
    zoom: {
      type: 'string',
      enum: ['x', 'brush'],
      description: t('aiTools.chart.zoom'),
    },
    marks: {
      type: 'array',
      description: t('aiTools.chart.marks'),
      items: { type: 'object' },
    },
  },
};

registerAiTool({
  name: 'render_chart',
  description:
    t('aiTools.chart.description'),
  inputSchema: CHART_SPEC_SCHEMA,
  run: (input, mount): unknown => {
    const handle = renderChart(mount, input as ChartSpec);
    return { mounted: true, chart: handle.spec.type ?? 'auto' };
  },
});

/* ══════════════ 内置工具：render_datatable ══════════════ */

/** 列归一（容错）：只收带 string key 的列；title 缺省/非字符串回退 key；sortable/filterable 仅收 true。 */
function normalizeDatatableColumns(raw: unknown): TableColumn[] {
  if (!Array.isArray(raw)) return [];
  const out: TableColumn[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue;
    const o = it as Record<string, unknown>;
    if (typeof o.key !== 'string' || !o.key) continue;
    out.push({
      key: o.key,
      title: typeof o.title === 'string' && o.title ? o.title : o.key,
      sortable: o.sortable === true,
      filterable: o.filterable === true,
    });
  }
  return out;
}

/** 行归一（容错）：只收对象行（null / 数组 / 原始值诚实丢弃），字段名对齐列 key。 */
function normalizeDatatableRows(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is Record<string, unknown> => r !== null && typeof r === 'object' && !Array.isArray(r),
  );
}

const DATATABLE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: { type: 'string', description: t('aiTools.datatable.title') },
    columns: {
      type: 'array',
      description: t('aiTools.datatable.columns'),
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          sortable: { type: 'boolean' },
          filterable: { type: 'boolean' },
        },
        required: ['key', 'title'],
      },
    },
    rows: {
      type: 'array',
      description: t('aiTools.datatable.rows'),
      items: { type: 'object' },
    },
  },
  required: ['columns', 'rows'],
};

registerAiTool({
  name: 'render_datatable',
  description: t('aiTools.datatable.description'),
  inputSchema: DATATABLE_SCHEMA,
  run: (input, mount): unknown => {
    const args = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const title = typeof args.title === 'string' ? args.title : undefined;
    /* 宽进严出：列/行先归一再喂 createTable（searchable + pagination + exportable 全开） */
    const columns = normalizeDatatableColumns(args.columns);
    const rows = normalizeDatatableRows(args.rows);
    createTable(mount, { columns, data: rows, searchable: true, pagination: true, exportable: true });
    return { title, rows: rows.length };
  },
});

/* ══════════════ 挂载区（AI 工具的渲染区域 + 挂载控制）══════════════ */

export interface AiToolAreaOptions {
  /** 工具白名单（精确名或 'chart-*' 通配；缺省 = 全部已注册工具） */
  tools?: string[];
  /** 最多同时挂载数（超出 LRU 淘汰最旧挂载；缺省不限） */
  max?: number;
  /** 挂载项的最小高度提示（px，默认 240） */
  itemMinHeight?: number;
}

export interface AiToolCallOptions {
  /**
   * 执行前用 validateToolArgs 校验参数（默认 true）：失败 → 挂载卡错误态列出 errors +
   * 派 icen:ai-tool-result {ok:false}，不执行 run。校验是诚实纪律——关闭即退回模型输入裸执行。
   */
  validate?: boolean;
}

export interface AiToolArea {
  el: HTMLElement;
  /** 当前挂载数（含执行中/待审批的挂载卡） */
  readonly count: number;
  /**
   * 调用一个工具（模型 tool_call 的落地入口）：白名单外或未注册返回 null。
   * 校验（可关）→ 幂等复用 → 挂载卡 → 审批（requiresApproval 时挂起等待）→ 执行。
   * 同步 run 落定后返回；Promise 型 run 在落定后写 record.icen-result 并补派 result 事件。
   */
  call(name: string, input: unknown, opts?: AiToolCallOptions): AiToolRecord | null;
  /** 白名单内且已注册？ */
  can(name: string): boolean;
  /** 运行时改白名单 / 上限 */
  setTools(tools: string[] | undefined): void;
  setMax(max: number | undefined): void;
  /** 清空全部挂载（在途执行 signal abort） */
  clear(): void;
  /** 挂载变化回调（call 挂载时与每次 result 落定时各触发一次；evict/clear 后触发） */
  onChange(fn: (records: AiToolRecord[]) => void): () => void;
}

function isBrowserTools(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function emitArea<K extends keyof IcenEventMap>(area: HTMLElement, name: K, detail: IcenEventMap[K]): void {
  try {
    emitIcen(area, name, detail);
  } catch {
    /* 非 DOM 环境静默 */
  }
}

/** 挂载卡部件引用（避免 querySelector 回查，全部 textContent 构建） */
interface ItemParts {
  item: HTMLElement;
  body: HTMLElement;
  approval?: HTMLElement;
  error?: HTMLElement;
  stream?: HTMLElement;
}

/* 挂载卡状态类（7 态状态机的挂载区形态；is-streaming 预留给流式工具） */
const ITEM_STATES = ['is-pending', 'is-running', 'is-streaming', 'is-approval', 'is-done', 'is-error', 'is-cancelled'];

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return String(value);
  }
}

/**
 * 创建 AI 工具挂载区：宿主声明「这块区域归 AI 用」——可白名单工具、限数量
 * （超出上限 LRU 淘汰最旧挂载）。每次 call 渲染为一个 .icen-ai-tools-item 卡
 * （标题行 = 折叠钮 + 工具名 + 时间 + 状态点 + 移除钮；体 = 审批区（仅审批态）+
 * 错误清单（仅失败态）+ 工具自己的渲染 + 活动流（progress 追加））。
 * 事件 icen:ai-tool-call / -result / -evict / -approve / -reject（bubbles），
 * area 上也可原生 addEventListener。
 */
export function createAiToolArea(el: HTMLElement, opts: AiToolAreaOptions = {}): AiToolArea {
  const noop = (): void => undefined;
  if (!isBrowserTools()) {
    return { el, get count() { return 0; }, call: () => null, can: () => false, setTools: noop, setMax: noop, clear: noop, onChange: () => noop };
  }
  const area = el;
  area.classList.add('icen-ai-tools-mount');
  let allow: string[] | undefined = opts.tools;
  let max: number | undefined = opts.max;
  const records: AiToolRecord[] = [];
  const listeners: Array<(records: AiToolRecord[]) => void> = [];
  /** 幂等去重：在途调用的复用表（name + 归一 input 的 JSON 键） */
  const inflight = new Map<string, AiToolRecord>();
  /** 在途执行的 AbortController（超时/移除/淘汰/清空时 abort） */
  const controllers = new WeakMap<AiToolRecord, AbortController>();

  const notify = (): void => {
    for (const fn of listeners) fn(records.slice());
  };

  const inflightKey = (name: string, args: Record<string, unknown>): string => `${name}::${safeStringify(args)}`;

  const abortRecord = (record: AiToolRecord): void => {
    controllers.get(record)?.abort();
  };

  const setItemState = (parts: ItemParts, state: string | null): void => {
    for (const s of ITEM_STATES) parts.item.classList.remove(s);
    if (state) parts.item.classList.add(state);
  };

  /** 错误清单：逐行 textContent，插到 body 之前（失败呈现优先于工具自渲染） */
  const showError = (parts: ItemParts, lines: string[]): void => {
    const box = document.createElement('div');
    box.className = 'icen-ai-tools-item-error';
    box.setAttribute('role', 'alert');
    for (const line of lines) {
      const row = document.createElement('div');
      row.className = 'icen-ai-tools-item-error-line';
      row.textContent = line;
      box.appendChild(row);
    }
    parts.item.insertBefore(box, parts.body);
    parts.error = box;
  };

  /** 活动流：progress(line) 追加一行（懒建容器，挂卡底部） */
  const appendStream = (parts: ItemParts, line: string): void => {
    if (!parts.stream) {
      const box = document.createElement('div');
      box.className = 'icen-ai-tools-item-stream';
      parts.item.appendChild(box);
      parts.stream = box;
    }
    const row = document.createElement('div');
    row.className = 'icen-ai-tools-item-stream-line';
    row.textContent = line;
    parts.stream.appendChild(row);
  };

  const evictOldest = (): void => {
    const oldest = records.find((r) => r.el);
    if (!oldest || !oldest.el) return;
    abortRecord(oldest);
    oldest.el.remove();
    const idx = records.indexOf(oldest);
    if (idx >= 0) {
      records.splice(idx, 1);
      emitArea(area, 'icen:ai-tool-evict', { name: oldest.def.name, el: oldest.el });
    }
  };

  /** 上限收敛：LRU 淘汰最旧挂载（保留最新 max 个；无 el 的 data 记录不占名额） */
  const enforceMax = (): void => {
    while (max != null && records.filter((r) => r.el).length > max) evictOldest();
  };

  /* unregisterAiTool 下架联动：摘除本区域该工具的全部记录（有 el 的先出 DOM），照移除钮路径收尾 */
  const purgeTool = (toolName: string): void => {
    let removed = false;
    for (let i = records.length - 1; i >= 0; i--) {
      const r = records[i];
      if (r.def.name !== toolName) continue;
      abortRecord(r);
      r.el?.remove();
      records.splice(i, 1);
      removed = true;
    }
    if (removed) notify();
  };
  LIVE_AREAS.add({ el: area, purge: purgeTool });

  /* 挂载卡骨架：标题行（折叠钮 + 工具名 + 时间 + 状态点 + 移除钮）+ 空体（工具渲染目标） */
  const buildItem = (def: AiToolDef): ItemParts => {
    const item = document.createElement('div');
    item.className = 'icen-ai-tools-item';
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'icen-ai-tools-item-head';
    head.setAttribute('aria-expanded', 'true');
    const chevron = document.createElement('span');
    chevron.className = 'icen-ai-tools-item-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '▾';
    const label = document.createElement('span');
    label.className = 'icen-ai-tools-item-name';
    label.textContent = def.name;
    const meta = document.createElement('span');
    meta.className = 'icen-ai-tools-item-meta';
    meta.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const status = document.createElement('span');
    status.className = 'icen-ai-tools-item-status';
    status.setAttribute('aria-hidden', 'true');
    const remove = document.createElement('span');
    remove.className = 'icen-ai-tools-item-remove';
    remove.setAttribute('role', 'button');
    remove.tabIndex = 0; /* span 非原生按钮，键盘可达需手动补 */
    remove.setAttribute('aria-label', t('aiTools.removeMount', { p0: def.name }));
    remove.textContent = '×';
    const body = document.createElement('div');
    body.className = 'icen-ai-tools-item-body';
    body.style.minHeight = `${opts.itemMinHeight ?? 240}px`;
    head.append(chevron, label, meta, status, remove);
    item.append(head, body);
    area.appendChild(item);
    /* head 点击 = 折叠切换；× 单独拦下（不冒泡成折叠） */
    head.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('.icen-ai-tools-item-remove')) return;
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
      item.classList.toggle('is-collapsed', open);
    });
    /* a11y：× 是 span[role=button]，Enter/Space 经 head 代理激活；stopPropagation +
       preventDefault 防键盘事件外冒、防 Space 滚屏（remove.click 走既有移除路径） */
    head.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!(e.target instanceof Element) || !e.target.closest('.icen-ai-tools-item-remove')) return;
      e.preventDefault();
      e.stopPropagation();
      remove.click();
    });
    return { item, body };
  };

  /**
   * 执行一条记录：run(input, mount, ctx)——同步落定立即收尾；Promise 落定后写
   * record.icen-result 再收尾。超时只作用于 Promise 型 run（定时器触发 → signal abort +
   * 结果 code 'timeout'，竞速后晚到的兑现/拒绝丢弃并吞掉不冒 unhandledrejection）。
   */
  const execRecord = (
    record: AiToolRecord,
    def: AiToolDef,
    args: Record<string, unknown>,
    mount: HTMLElement,
    parts: ItemParts | null,
  ): void => {
    const controller = new AbortController();
    controllers.set(record, controller);
    const ctx: AiToolRunContext = {
      signal: controller.signal,
      progress: parts ? (line) => appendStream(parts, line) : () => undefined,
    };
    if (parts) setItemState(parts, 'is-running');

    const finish = (ok: boolean, error: string | undefined, result: unknown): void => {
      controllers.delete(record);
      record.result = result;
      if (parts) {
        setItemState(parts, ok ? 'is-done' : 'is-error');
        if (!ok && error) showError(parts, [error]);
      }
      emitArea(area, 'icen:ai-tool-result', { name: def.name, ok, el: parts ? parts.item : area, error, count: records.length });
      inflight.delete(inflightKey(def.name, args));
      enforceMax();
      notify();
    };

    try {
      const out = def.run(args, mount, ctx);
      const thenable =
        out !== null && (typeof out === 'object' || typeof out === 'function')
          ? (out as { then?: unknown }).then
          : undefined;
      if (typeof thenable === 'function') {
        const p = Promise.resolve(out as PromiseLike<unknown>);
        p.catch(() => undefined); /* 超时竞速后晚到的拒绝不冒 unhandledrejection */
        let timedOut = false;
        let to: ReturnType<typeof setTimeout> | null = null;
        const timeoutP =
          def.timeoutMs != null && def.timeoutMs > 0
            ? new Promise<never>((_, reject) => {
                to = setTimeout(() => {
                  timedOut = true;
                  controller.abort();
                  reject(new Error('timeout'));
                }, def.timeoutMs);
              })
            : null;
        void Promise.race(timeoutP ? [p, timeoutP] : [p]).then(
          (value) => {
            if (to) clearTimeout(to);
            if (timedOut) return; /* 超时已收尾：晚到的兑现丢弃 */
            finish(true, undefined, value);
          },
          (err: unknown) => {
            if (to) clearTimeout(to);
            if (timedOut) {
              finish(false, t('aiTools.execTimeout', { p0: def.timeoutMs ?? 0 }), { ok: false, error: { code: 'timeout', timeoutMs: def.timeoutMs } });
            } else {
              const msg = err instanceof Error ? err.message : String(err);
              finish(false, t('aiTools.execFailed', { p0: msg }), { ok: false, error: { code: 'exec', message: msg } });
            }
          },
        );
      } else {
        finish(true, undefined, out);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finish(false, t('aiTools.execFailed', { p0: msg }), { ok: false, error: { code: 'exec', message: msg } });
    }
  };

  /**
   * 校验失败的诚实收尾：挂载卡错误态逐行列出 errors（data 模式无卡则只记结果），
   * 派 call + result（ok:false），不执行 run。
   */
  const failValidation = (
    def: AiToolDef,
    args: Record<string, unknown>,
    rawInput: unknown,
    errors: AiToolValidationError[],
    unvalidated: string[],
  ): AiToolRecord => {
    const lines = errors.map((e) => `${e.path}: ${e.message}`);
    const result = { ok: false, error: { code: 'validation' as const, errors, unvalidated } };
    let record: AiToolRecord;
    if (def.present === 'data') {
      record = { def, ts: Date.now(), input: rawInput, result };
      records.push(record);
      emitArea(area, 'icen:ai-tool-call', { name: def.name, input: rawInput, el: area });
      emitArea(area, 'icen:ai-tool-result', {
        name: def.name, ok: false, el: area, error: t('aiTools.validationFailed', { p0: errors.length }), count: records.length,
      });
      notify();
      return record;
    }
    const parts = buildItem(def);
    setItemState(parts, 'is-error');
    showError(parts, lines);
    record = { def, el: parts.item, ts: Date.now(), input: rawInput, result };
    records.push(record);
    emitArea(area, 'icen:ai-tool-call', { name: def.name, input: rawInput, el: parts.item });
    emitArea(area, 'icen:ai-tool-result', {
      name: def.name, ok: false, el: parts.item, error: t('aiTools.validationFailed', { p0: errors.length }), count: records.length,
    });
    enforceMax();
    notify();
    return record;
  };

  const areaApi: AiToolArea = {
    el: area,
    get count() {
      return records.filter((r) => r.el).length;
    },
    can(name: string): boolean {
      return toolAllowed(name, allow) && getAiTool(name) != null;
    },
    setTools(tools: string[] | undefined): void {
      allow = tools;
    },
    setMax(next: number | undefined): void {
      max = next;
      enforceMax();
    },
    clear(): void {
      for (const r of records) {
        abortRecord(r);
        r.el?.remove();
      }
      records.length = 0;
      notify();
    },
    onChange(fn: (records: AiToolRecord[]) => void): () => void {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    call(name: string, input: unknown, opts?: AiToolCallOptions): AiToolRecord | null {
      const def = getAiTool(name);
      if (!def || !toolAllowed(name, allow)) return null;
      const args = parseAiToolArgs(input);

      /* 参数校验（默认开）：失败 → 卡片错误态 + result ok:false，不执行 run */
      if (opts?.validate !== false) {
        const v = validateToolArgs(def.inputSchema, args);
        if (!v.ok) return failValidation(def, args, input, v.errors, v.unvalidated);
      }

      /* 幂等复用：同名同输入的在途调用复用同一条记录（不重复挂载、不重复执行） */
      const key = inflightKey(name, args);
      if (def.idempotent) {
        const existing = inflight.get(key);
        if (existing) return existing;
      }

      /* present:'data'（纯数据工具）：不建挂载卡、record 无 el、不占 max 挂载位；
         仍进 records、仍派 call/result 事件与 onChange，供宿主审计。 */
      if (def.present === 'data') {
        const record: AiToolRecord = { def, ts: Date.now(), input, result: undefined };
        records.push(record);
        if (def.idempotent) inflight.set(key, record);
        emitArea(area, 'icen:ai-tool-call', { name, input, el: area });
        notify();
        execRecord(record, def, args, document.createElement('div'), null);
        return record;
      }

      /* 挂载位（present:'mount'，默认）：标题行 + 审批区（仅审批态）+ 错误清单（仅失败态）+ 渲染体 + 活动流 */
      const parts = buildItem(def);
      const record: AiToolRecord = { def, el: parts.item, ts: Date.now(), input, result: undefined };
      records.push(record);
      if (def.idempotent) inflight.set(key, record);

      const remove = parts.item.querySelector('.icen-ai-tools-item-remove');
      remove?.addEventListener('click', (e) => {
        e.stopPropagation();
        abortRecord(record);
        parts.item.remove();
        const i = records.indexOf(record);
        if (i >= 0) records.splice(i, 1);
        notify();
      });

      emitArea(area, 'icen:ai-tool-call', { name, input, el: parts.item });
      notify();

      /* 审批门禁：requiresApproval 的挂载卡先挂起，批准才执行（'data' 模式无卡，审批不生效） */
      if (def.requiresApproval) {
        setItemState(parts, 'is-approval');
        const approval = document.createElement('div');
        approval.className = 'icen-ai-tools-item-approval';
        const reason = document.createElement('div');
        reason.className = 'icen-ai-tools-item-approval-reason';
        reason.textContent = def.description;
        const preview = document.createElement('div');
        preview.className = 'icen-ai-tools-item-approval-preview';
        preview.textContent = safeStringify(args);
        const reasonBox = document.createElement('div');
        reasonBox.className = 'icen-ai-tools-item-approval-text';
        reasonBox.append(reason, preview);
        const approveBtn = document.createElement('button');
        approveBtn.type = 'button';
        approveBtn.className = 'icen-btn icen-btn-sm icen-btn-primary';
        approveBtn.textContent = t('common.approve');
        const rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.className = 'icen-btn icen-btn-sm';
        rejectBtn.textContent = t('common.reject');
        approval.append(reasonBox, approveBtn, rejectBtn);
        parts.item.insertBefore(approval, parts.body);
        parts.approval = approval;

        approveBtn.addEventListener('click', () => {
          approval.remove();
          parts.approval = undefined;
          emitArea(area, 'icen:ai-tool-approve', { name: def.name, input: args, el: parts.item });
          execRecord(record, def, args, parts.body, parts);
        });
        rejectBtn.addEventListener('click', () => {
          approval.remove();
          parts.approval = undefined;
          emitArea(area, 'icen:ai-tool-reject', { name: def.name, input: args, el: parts.item });
          setItemState(parts, 'is-cancelled');
          record.result = { ok: false, error: { code: 'rejected' } };
          inflight.delete(key);
          emitArea(area, 'icen:ai-tool-result', { name: def.name, ok: false, el: parts.item, error: 'rejected', count: records.length });
          enforceMax();
          notify();
        });
        return record;
      }

      execRecord(record, def, args, parts.body, parts);
      return record;
    },
  };
  return areaApi;
}

/* ══════════════ 模型侧导出（agent loop 直接消费；四族共享同一归一管线）══════════════ */

/** 归一工具描述：四个导出的共享中间形态（私有——公共面是各家的映射结果） */
interface AiToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function toDescriptors(names?: string[]): AiToolDescriptor[] {
  return listAiTools()
    .filter((d) => toolAllowed(d.name, names))
    .map((d) => ({ name: d.name, description: d.description, inputSchema: d.inputSchema }));
}

/** 导出为 OpenAI chat.completions tools 参数格式（可传 names / 通配过滤） */
export function aiToolsToOpenAI(
  names?: string[],
): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
  return toDescriptors(names).map((d) => ({
    type: 'function' as const,
    function: { name: d.name, description: d.description, parameters: d.inputSchema },
  }));
}

/** 导出为 Anthropic messages tools 格式（name / description / input_schema） */
export function aiToolsToAnthropic(
  names?: string[],
): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
  return toDescriptors(names).map((d) => ({ name: d.name, description: d.description, input_schema: d.inputSchema }));
}

/** 导出为 MCP tools 格式（name / description / inputSchema） */
export function aiToolsToMcp(
  names?: string[],
): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return toDescriptors(names).map((d) => ({ name: d.name, description: d.description, inputSchema: d.inputSchema }));
}

/**
 * 导出为 Vercel AI SDK v5 的 tool() 描述表：{ [name]: { description, inputSchema } }——
 * 纯 JSON 描述可直接喂 tool()；不携带 execute（执行在宿主侧经 createAiToolArea 挂载）。
 */
export function aiToolsToAiSdk(names?: string[]): Record<string, { description: string; inputSchema: Record<string, unknown> }> {
  const out: Record<string, { description: string; inputSchema: Record<string, unknown> }> = {};
  for (const d of toDescriptors(names)) out[d.name] = { description: d.description, inputSchema: d.inputSchema };
  return out;
}

/** 能力清单文本（贴 system prompt：可用工具 × 数据形态一览） */
export function aiToolsManifest(names?: string[]): string {
  const tools = toDescriptors(names);
  if (tools.length === 0) return t('aiTools.none');
  return [
    t('aiTools.manifestHeader'),
    ...tools.map((d) => `- ${d.name}：${d.description}`),
  ].join('\n');
}

/** 模型 tool_call 参数容错解析（JSON 字符串 / 对象直给 / 坏 JSON 返回 {}） */
export function parseAiToolArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* 坏 JSON 落 {} */
    }
  }
  return {};
}
