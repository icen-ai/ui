/*
 * @icen.ai/ui — Behavior: ai-tools（AI 工具体系：UI 能力注册为模型可调用的工具）
 *
 * 定位：AI 族的「手」。任何 UI 能力（图表渲染、diff 应用、todo 写入……）都可
 * 注册为 AiToolDef；宿主通过 createAiToolArea 声明「AI 在这块区域可用哪些工具、
 * 最多挂载几个」——挂不挂、挂哪些、挂几层，全部宿主说了算。库自带 render_chart
 * 一个内置工具（吃 ChartSpec 纯 JSON，零函数回调）。
 *
 * 三层控制（从粗到细）：
 *   1. 不 import 本模块 = 生态里根本没有工具体系（tree-shake 友好）
 *   2. createAiToolArea(el, { tools: ['render_chart'], max: 4 }) — 区域白名单 + 上限
 *      （超出上限 LRU 淘汰最旧挂载；tools 支持通配 'chart-*'）
 *   3. 运行时：area.setTools/setMax/clear + unregisterAiTool 全局下架
 *
 * 模型侧接线（自有 agent loop / 任意框架）：
 *   aiToolsToOpenAI()  → OpenAI chat.completions tools 参数格式（function 定义）
 *   aiToolsToMcp()     → MCP tools 格式（name/description/inputSchema）
 *   aiToolsManifest()  → 能力清单文本（system prompt 直接贴）
 *   模型回 tool_call 后：area.call(name, JSON.parse(arguments)) → 挂载 + 渲染
 *
 * 事件（bubbles）：icen:ai-tool-call {name, input, el} / icen:ai-tool-result
 *   {name, ok, el, error?, count} / icen:ai-tool-evict {name, el}
 *
 * SSR 安全；禁 innerHTML（渲染走各组件自己的安全路径）。
 */

import { renderChart, type ChartSpec, type ChartHandle } from './charts';

/* ══════════════ 工具注册表 ══════════════ */

/** 一个 UI 工具：模型可调用的可视化/交互能力 */
export interface AiToolDef<TInput = unknown> {
  /** 工具名（模型侧 function name；建议 snake_case） */
  name: string;
  /** 给模型看的一段说明（何时用、返回什么） */
  description: string;
  /** 输入 JSON Schema（OpenAI function.parameters / MCP inputSchema 兼容） */
  inputSchema: Record<string, unknown>;
  /** 执行：input → 在 mount 上渲染；返回值作为工具结果（进回执/审计） */
  run: (input: TInput, mount: HTMLElement) => unknown;
  /** 结果呈现：'mount'（默认，渲染即呈现）/ 'data'（run 返回值为准，不占挂载位） */
  present?: 'mount' | 'data';
}

export interface AiToolRecord {
  def: AiToolDef;
  /** 挂载元素（present='mount' 时有值） */
  el?: HTMLElement;
  /** render_chart 等返回的句柄（可 update/destroy） */
  handle?: unknown;
  ts: number;
  input: unknown;
  result: unknown;
}

const toolRegistry = new Map<string, AiToolDef>();

/** 注册（或覆盖同名）一个工具；第三方扩展入口 */
export function registerAiTool(def: AiToolDef): void {
  if (def && typeof def.name === 'string' && def.name && typeof def.run === 'function') {
    toolRegistry.set(def.name, def);
  }
}

/** 全局下架一个工具（所有区域随即不可再调用它） */
export function unregisterAiTool(name: string): void {
  toolRegistry.delete(name);
}

export function getAiTool(name: string): AiToolDef | undefined {
  return toolRegistry.get(name);
}

export function listAiTools(): AiToolDef[] {
  return Array.from(toolRegistry.values());
}

/** 白名单匹配：精确名或 'chart-*' 通配 */
function toolAllowed(name: string, allow: string[] | undefined): boolean {
  if (!allow || allow.length === 0) return true;
  return allow.some((pat) => (pat.endsWith('*') ? name.startsWith(pat.slice(0, -1)) : pat === name));
}

/* ══════════════ 内置工具：render_chart ══════════════ */

const CHART_SPEC_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      description: '图表类型，缺省自动推断',
      enum: ['line', 'area', 'vbar', 'hbar', 'stack', 'donut', 'radar', 'heatmap', 'calendar', 'sparkline', 'gauge', 'scatter'],
    },
    title: { type: 'string', description: '图表标题（渲染在头部行左侧）' },
    labels: { type: 'array', items: { type: 'string' }, description: '类目轴（line/vbar/hbar）' },
    values: { type: 'array', items: { type: 'number' }, description: '单系列数值（与 labels 配对）' },
    series: {
      type: 'array',
      description: '多系列（line/vbar/radar）',
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
      description: '占比型（donut/stack）：[{label,value}]',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, value: { type: 'number' } },
        required: ['label', 'value'],
      },
    },
    axes: { type: 'array', items: { type: 'string' }, description: '雷达轴名' },
    points: {
      type: 'array',
      description: '散点/气泡：[{x,y,size?,label?}]',
      items: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, size: { type: 'number' }, label: { type: 'string' } },
      },
    },
    dates: { type: 'array', items: { type: 'string' }, description: '贡献日历 ISO 日期（与 values 配对）' },
    data: {
      type: 'array',
      description: '任意维度原始记录 + dims 字段映射（自动透视成 类目 × 系列）',
      items: { type: 'object' },
    },
    dims: {
      type: 'object',
      description: 'data[] 的字段映射：{label?, series?, value?, x?, y?}',
      properties: {
        label: { type: 'string' },
        series: { type: 'string' },
        value: { type: 'string' },
        x: { type: 'string' },
        y: { type: 'string' },
      },
    },
    tone: { type: 'string', enum: ['accent', 'success', 'warning', 'error', 'muted'] },
    stacked: { type: 'boolean', description: 'vbar 多系列堆叠（默认分组）' },
    fill: { type: 'boolean', description: 'line 多系列填充面积' },
    format: {
      type: 'object',
      description: '数值格式化：{notation?: compact|percent|ms, unit?}',
      properties: {
        notation: { type: 'string', enum: ['compact', 'percent', 'ms', 'raw'] },
        unit: { type: 'string' },
      },
    },
    legend: { type: 'boolean', description: 'false = 初始隐藏图例' },
    tooltip: { type: 'boolean', description: 'false = 关闭内置提示' },
  },
};

registerAiTool({
  name: 'render_chart',
  description:
    '在用户界面渲染一张图表可视化。输入一份图表规格（纯 JSON）：labels+values（类目数值）、series（多系列）、segments（占比）、points（散点气泡）、dates（贡献日历）任给其一；type 缺省时按数据形态自动选型（时间序列→折线、占比→环形、日期→贡献日历、坐标点→散点）。图表带交互（悬停提示/点击/右键）与可隐藏图例。',
  inputSchema: CHART_SPEC_SCHEMA,
  run: (input, mount): unknown => {
    const handle = renderChart(mount, input as ChartSpec);
    return { mounted: true, chart: handle.spec.type ?? 'auto' };
  },
});

/* ══════════════ 挂载区（AI 工具的渲染区域 + 挂载控制）══════════════ */

export interface AiToolAreaOptions {
  /** 工具白名单（精确名或 'chart-*' 通配；缺省 = 全部已注册工具） */
  tools?: string[];
  /** 最多同时挂载数（超出 LRU 淘汰最旧；缺省不限） */
  max?: number;
  /** 挂载项的最小高度提示（px，默认 240） */
  itemMinHeight?: number;
}

export interface AiToolArea {
  el: HTMLElement;
  /** 当前挂载数 */
  readonly count: number;
  /** 调用一个工具（模型 tool_call 的落地入口）：白名单外或未注册返回 null */
  call(name: string, input: unknown): AiToolRecord | null;
  /** 白名单内且未注册？ */
  can(name: string): boolean;
  /** 运行时改白名单 / 上限 */
  setTools(tools: string[] | undefined): void;
  setMax(max: number | undefined): void;
  /** 清空全部挂载 */
  clear(): void;
  /** 挂载变化回调（call/evict/clear 后触发） */
  onChange(fn: (records: AiToolRecord[]) => void): () => void;
}

function isBrowserTools(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function emitArea(area: HTMLElement, name: string, detail: unknown): void {
  try {
    area.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  } catch {
    /* 非 DOM 环境静默 */
  }
}

/**
 * 创建 AI 工具挂载区：宿主声明「这块区域归 AI 用」——可白名单工具、限数量
 * （LRU 淘汰）。每次 call 渲染为一个 .ai-tools-item 卡（标题行 = 工具名 +
 * 时间 + 移除钮，体 = 工具自己的渲染）。事件 icen:ai-tool-call / -result /
 * -evict（bubbles），area 上也可原生 addEventListener。
 */
export function createAiToolArea(el: HTMLElement, opts: AiToolAreaOptions = {}): AiToolArea {
  const noop = (): void => undefined;
  if (!isBrowserTools()) {
    return { el, get count() { return 0; }, call: () => null, can: () => false, setTools: noop, setMax: noop, clear: noop, onChange: () => noop };
  }
  const area = el;
  area.classList.add('ai-tools-mount');
  let allow: string[] | undefined = opts.tools;
  let max: number | undefined = opts.max;
  let seq = 0;
  const records: AiToolRecord[] = [];
  const listeners: Array<(records: AiToolRecord[]) => void> = [];

  const notify = (): void => {
    for (const fn of listeners) fn(records.slice());
  };

  const evictOldest = (): void => {
    const oldest = records.find((r) => r.el);
    if (!oldest || !oldest.el) return;
    oldest.el.remove();
    const idx = records.indexOf(oldest);
    if (idx >= 0) {
      records.splice(idx, 1);
      emitArea(area, 'icen:ai-tool-evict', { name: oldest.def.name, el: oldest.el });
    }
  };

  const areaApi: AiToolArea = {
    el: area,
    get count() {
      return records.filter((r) => r.el).length;
    },
    can(name: string): boolean {
      return toolAllowed(name, allow) && toolRegistry.has(name);
    },
    setTools(tools: string[] | undefined): void {
      allow = tools;
    },
    setMax(next: number | undefined): void {
      max = next;
      while (max != null && records.filter((r) => r.el).length > max) evictOldest();
    },
    clear(): void {
      for (const r of records) r.el?.remove();
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
    call(name: string, input: unknown): AiToolRecord | null {
      const def = toolRegistry.get(name);
      if (!def || !toolAllowed(name, allow)) return null;
      void seq;

      /* 挂载位：标题行（折叠钮 + 工具名 + 时间 + 移除钮）+ 渲染体（可折叠，默认展开） */
      const item = document.createElement('div');
      item.className = 'ai-tools-item';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'ai-tools-item-head';
      head.setAttribute('aria-expanded', 'true');
      const chevron = document.createElement('span');
      chevron.className = 'ai-tools-item-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '▾';
      const label = document.createElement('span');
      label.className = 'ai-tools-item-name';
      label.textContent = def.name;
      const meta = document.createElement('span');
      meta.className = 'ai-tools-item-meta';
      meta.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const remove = document.createElement('span');
      remove.className = 'ai-tools-item-remove';
      remove.setAttribute('role', 'button');
      remove.setAttribute('aria-label', `移除 ${def.name} 挂载`);
      remove.textContent = '×';
      const mount = document.createElement('div');
      mount.className = 'ai-tools-item-body';
      mount.style.minHeight = `${opts.itemMinHeight ?? 240}px`;
      head.append(chevron, label, meta, remove);
      item.append(head, mount);
      area.appendChild(item);
      /* head 点击 = 折叠切换；× 单独拦下（不冒泡成折叠） */
      head.addEventListener('click', (e) => {
        if (e.target instanceof Element && e.target.closest('.ai-tools-item-remove')) return;
        const open = head.getAttribute('aria-expanded') === 'true';
        head.setAttribute('aria-expanded', String(!open));
        mount.hidden = open;
        item.classList.toggle('is-collapsed', open);
      });

      const record: AiToolRecord = { def, el: item, ts: Date.now(), input, result: undefined };
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        item.remove();
        const i = records.indexOf(record);
        if (i >= 0) records.splice(i, 1);
        notify();
      });

      emitArea(area, 'icen:ai-tool-call', { name, input, el: item });
      let ok = true;
      let error: string | undefined;
      try {
        record.result = def.run(input, mount);
        record.handle = record.result;
      } catch (err) {
        ok = false;
        error = err instanceof Error ? err.message : String(err);
        mount.textContent = `工具执行失败：${error}`;
      }
      records.push(record);
      emitArea(area, 'icen:ai-tool-result', { name, ok, el: item, error, count: records.length });

      /* 上限：LRU 淘汰（保留最新 max 个） */
      while (max != null && records.filter((r) => r.el).length > max) evictOldest();
      notify();
      return record;
    },
  };
  return areaApi;
}

/* ══════════════ 模型侧导出（agent loop 直接消费）══════════════ */

/** 导出为 OpenAI chat.completions tools 参数格式（可传 names / 通配过滤） */
export function aiToolsToOpenAI(
  names?: string[],
): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
  return listAiTools()
    .filter((d) => toolAllowed(d.name, names))
    .map((d) => ({
      type: 'function' as const,
      function: { name: d.name, description: d.description, parameters: d.inputSchema },
    }));
}

/** 导出为 MCP tools 格式（name / description / inputSchema） */
export function aiToolsToMcp(
  names?: string[],
): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return listAiTools()
    .filter((d) => toolAllowed(d.name, names))
    .map((d) => ({ name: d.name, description: d.description, inputSchema: d.inputSchema }));
}

/** 能力清单文本（贴 system prompt：可用工具 × 数据形态一览） */
export function aiToolsManifest(names?: string[]): string {
  const tools = listAiTools().filter((d) => toolAllowed(d.name, names));
  if (tools.length === 0) return '（无已注册的 UI 工具）';
  return [
    '可用 UI 工具（调用后在用户界面挂载可视化结果）：',
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
